//! L'idempotence des écritures (chapitre 09 §7), telle `agent/idempotency.ts` : une clé par
//! acteur, revendiquée avant le travail, complétée par la réponse, relâchée sur un échec.
//!
//! Bail de 60 s, rétention de 24 h. Une clé rejouée avec d'autres paramètres répond
//! `IDEMPOTENCY_CONFLICT` ; une clé dont les droits ont changé depuis, `IDEMPOTENCY_STALE`.

use crate::db::{Exec, Pools};
use crate::error::{AppError, SqlOp};
use crate::time::sha256;
use crate::tx::{ActorKind, RequestContext};
use serde_json::{json, Value};

const LEASE_SECONDS: i32 = 60;
const RETENTION_HOURS: i32 = 24;

/// `Claim`.
#[derive(Debug, Clone, PartialEq)]
pub enum Claim {
    Claimed,
    Replay(Value),
}

fn actor_of(ctx: &RequestContext) -> (&'static str, String) {
    match (&ctx.actor.kind, &ctx.actor.token_id) {
        (ActorKind::Token, Some(token)) => ("token", token.clone()),
        _ => ("user", ctx.actor.id.clone()),
    }
}

/// `JSON.stringify`, numbers written as JavaScript writes them.
pub fn js_stringify(value: &Value) -> String {
    match value {
        Value::Number(n) => match n.as_f64() {
            Some(f) if n.is_f64() && f.fract() == 0.0 && f.abs() < 1e21 => format!("{}", f as i128),
            _ => n.to_string(),
        },
        Value::Array(items) => format!("[{}]", items.iter().map(js_stringify).collect::<Vec<_>>().join(",")),
        Value::Object(map) => {
            // A JavaScript object lists its array-index keys first, in numeric order.
            let index = |k: &str| k.parse::<u32>().ok().filter(|n| *n != u32::MAX && n.to_string() == k);
            let mut entries: Vec<(&String, &Value)> = map.iter().collect();
            entries.sort_by_key(|(k, _)| match index(k) {
                Some(n) => (0, n),
                None => (1, 0),
            });
            format!(
                "{{{}}}",
                entries.iter().map(|(k, v)| format!("{}:{}", Value::String((*k).clone()), js_stringify(v))).collect::<Vec<_>>().join(",")
            )
        }
        other => other.to_string(),
    }
}

fn canonical(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.iter().map(canonical).collect()),
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            Value::Object(keys.into_iter().map(|k| (k.clone(), canonical(&map[k]))).collect())
        }
        other => other.clone(),
    }
}

/// `paramsHash`: SHA-256 of the key-sorted JSON.
pub fn params_hash(params: &Value) -> Vec<u8> {
    sha256(js_stringify(&canonical(params)).as_bytes())
}

fn in_progress() -> AppError {
    AppError::new("IDEMPOTENCY_IN_PROGRESS").with("retry_after", json!(1))
}

/// `claimIdempotency`.
pub async fn claim_idempotency(pools: &Pools, ctx: &RequestContext, key: &str, tool: &str, hash: &[u8]) -> Result<Claim, AppError> {
    let (kind, id) = actor_of(ctx);
    let exec = pools.catalog().await?;
    for _ in 0..2 {
        let inserted = exec
            .query_op(
                "INSERT INTO _basedb.idempotency_key
                   (actor_kind, actor_id, key, tool, params_hash, authz_version,
                    lease_expires_at, expires_at)
                 SELECT $1, $2::text::uuid, $3, $4, $5, t.authz_version,
                        clock_timestamp() + make_interval(secs => $7::int),
                        clock_timestamp() + make_interval(hours => $8::int)
                   FROM _basedb.tenant t
                  WHERE t.ref = $6
                 ON CONFLICT (actor_kind, actor_id, key) DO NOTHING
                 RETURNING claim_id::text",
                &[&kind, &id, &key, &tool, &hash, &ctx.tenant_id, &LEASE_SECONDS, &RETENTION_HOURS],
                SqlOp::Insert,
            )
            .await?;
        if !inserted.is_empty() {
            return Ok(Claim::Claimed);
        }
        let Some(row) = exec
            .first(
                "SELECT k.tool, k.params_hash, k.response,
                        k.lease_expires_at > clock_timestamp() AS lease_live,
                        k.expires_at <= clock_timestamp() AS expired,
                        k.authz_version <> t.authz_version AS stale
                   FROM _basedb.idempotency_key k
                   JOIN _basedb.tenant t ON t.ref = $4
                  WHERE k.actor_kind = $1 AND k.actor_id = $2::text::uuid AND k.key = $3",
                &[&kind, &id, &key, &ctx.tenant_id],
            )
            .await?
        else {
            continue;
        };
        if row.get::<_, bool>(4) {
            exec.execute_op(
                "DELETE FROM _basedb.idempotency_key
                  WHERE actor_kind = $1 AND actor_id = $2::text::uuid AND key = $3 AND expires_at <= clock_timestamp()",
                &[&kind, &id, &key],
                SqlOp::Delete,
            )
            .await?;
            continue;
        }
        if row.get::<_, String>(0) != tool || row.get::<_, Vec<u8>>(1) != hash {
            return Err(AppError::new("IDEMPOTENCY_CONFLICT"));
        }
        if let Some(response) = row.get::<_, Option<Value>>(2) {
            if row.get::<_, bool>(5) {
                return Err(AppError::new("IDEMPOTENCY_STALE"));
            }
            return Ok(Claim::Replay(response));
        }
        if row.get::<_, bool>(3) {
            return Err(in_progress());
        }
        return Err(AppError::new("IDEMPOTENCY_INTERRUPTED"));
    }
    Err(in_progress())
}

/// `completeIdempotency`: the response kept for replays.
pub async fn complete_idempotency(pools: &Pools, ctx: &RequestContext, key: &str, response: &Value) -> Result<(), AppError> {
    let (kind, id) = actor_of(ctx);
    let exec = pools.catalog().await?;
    exec.execute_op(
        "UPDATE _basedb.idempotency_key
            SET response = $4::text::jsonb, http_status = 200
          WHERE actor_kind = $1 AND actor_id = $2::text::uuid AND key = $3",
        &[&kind, &id, &key, &js_stringify(response)],
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

/// `releaseIdempotency`: after a failure, the key is free again.
pub async fn release_idempotency(pools: &Pools, ctx: &RequestContext, key: &str) -> Result<(), AppError> {
    let (kind, id) = actor_of(ctx);
    let exec = pools.catalog().await?;
    exec.execute_op(
        "DELETE FROM _basedb.idempotency_key
          WHERE actor_kind = $1 AND actor_id = $2::text::uuid AND key = $3 AND response IS NULL",
        &[&kind, &id, &key],
        SqlOp::Delete,
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_ignores_key_order_and_writes_numbers_like_js() {
        assert_eq!(params_hash(&json!({"b": 1, "a": [1.0, {"y": 2, "x": "é"}]})), params_hash(&json!({"a": [1, {"x": "é", "y": 2}], "b": 1})));
        assert_eq!(js_stringify(&json!({"a": 1.0, "b": 1.5, "c": null})), r#"{"a":1,"b":1.5,"c":null}"#);
        assert_eq!(js_stringify(&json!({"b": 1, "10": 2, "2": 3, "02": 4})), r#"{"2":3,"10":2,"b":1,"02":4}"#);
        assert_eq!(crate::time::hex(&params_hash(&json!({}))), crate::time::hex(&sha256(b"{}")));
    }
}
