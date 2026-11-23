//! `auth/tokens.ts`, the administration half: minting, listing and revoking integration
//! tokens (`/admin/tokens`, `/me/tokens`). Verifying them is the base's (`auth/tokens.rs`).

use crate::common::{fields, iso, iso_opt, js_string, js_trim, nfc, strict_json};
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::auth::session::load_session_by_id;
use basedb_base::auth::{bearer_context, bearer_who, context_for};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Target, Verdict};
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::load_base_target;
use basedb_base::time::{random_bytes, sha256};
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use basedb_base::Shared;
use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use tokio_postgres::Row;

pub const TOKEN_MAX_DAYS: i64 = 365;
const BASE62: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const PREFIX_ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";

fn actions_of(access: &str) -> Option<&'static [Action]> {
    match access {
        "read" => Some(&[Action::Read]),
        "write" => Some(&[Action::Read, Action::Create, Action::Update]),
        "delete" => Some(&[Action::Read, Action::Create, Action::Update, Action::Delete]),
        _ => None,
    }
}

/// 256 bits written in base 62: 43 characters, left-padded.
pub fn base62(bytes: &[u8]) -> String {
    let mut n: Vec<u8> = bytes.to_vec();
    let mut out = Vec::new();
    while n.iter().any(|b| *b != 0) {
        let mut rem: u32 = 0;
        for b in n.iter_mut() {
            let cur = (rem << 8) | u32::from(*b);
            *b = (cur / 62) as u8;
            rem = cur % 62;
        }
        out.push(BASE62[rem as usize]);
    }
    while out.len() < 43 {
        out.push(b'0');
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

/// `randomInt(36)`, eight times: uniform by rejection.
fn new_prefix() -> String {
    let mut prefix = String::new();
    while prefix.len() < 8 {
        for b in random_bytes(16) {
            if b < 252 && prefix.len() < 8 {
                prefix.push(PREFIX_ALPHABET[usize::from(b % 36)] as char);
            }
        }
    }
    prefix
}

pub fn new_secret() -> (String, String) {
    let prefix = new_prefix();
    (format!("bdb_{prefix}_{}", base62(&random_bytes(32))), prefix)
}

async fn base_target<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> Result<Target, AppError> {
    load_base_target(exec, ctx, base_id).await?.ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)))
}

fn refuse_token_actor(ctx: &RequestContext) -> Result<(), AppError> {
    if ctx.actor.kind != ActorKind::User {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    Ok(())
}

async fn require_manage_tokens<E: Exec + Sync>(exec: &E, ctx: &RequestContext, target: &Target) -> Result<ActorGrants, AppError> {
    let grants = load_grants(exec, ctx).await?;
    match decide(ctx, &grants, Action::ManageTokens, target).verdict {
        Verdict::Invisible => Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(target.id))),
        Verdict::Forbidden => Err(AppError::new("ADMIN_REQUIRED").with("action", json!("manage_tokens"))),
        Verdict::Allowed => Ok(grants),
    }
}

const SUMMARY_COLUMNS: &str = "tk.id::text, tk.label, tk.token_prefix, tk.base_id::text, tk.all_environments,
       tk.allowed_surfaces::text[],
       tk.created_at, tk.expires_at, tk.last_used_at, tk.revoked_at, tk.suspended_at,
       tk.created_by::text,
       EXISTS (SELECT 1 FROM _basedb.permission p
                WHERE p.role_id = tk.role_id AND p.action IN ('create', 'update')) AS can_write,
       EXISTS (SELECT 1 FROM _basedb.permission p
                WHERE p.role_id = tk.role_id AND p.action = 'delete') AS can_delete";

/// `summaryOf` serialized as app.ts's `serializeToken`.
fn summary(row: &Row) -> Map<String, Value> {
    let (can_write, can_delete): (bool, bool) = (row.get(12), row.get(13));
    let access = if can_delete { "delete" } else if can_write { "write" } else { "read" };
    let mut m = Map::new();
    m.insert("id".into(), json!(row.get::<_, String>(0)));
    m.insert("label".into(), json!(row.get::<_, String>(1)));
    m.insert("prefix".into(), json!(row.get::<_, String>(2)));
    m.insert("base_id".into(), json!(row.get::<_, Option<String>>(3)));
    m.insert("environments".into(), json!(if row.get::<_, bool>(4) { "all" } else { "one" }));
    m.insert("access".into(), json!(access));
    m.insert("surfaces".into(), json!(row.get::<_, Vec<String>>(5)));
    m.insert("created_at".into(), json!(iso(row.get(6))));
    m.insert("expires_at".into(), iso_opt(row.get(7)));
    m.insert("last_used_at".into(), iso_opt(row.get(8)));
    m.insert("revoked_at".into(), iso_opt(row.get(9)));
    m.insert("suspended_at".into(), iso_opt(row.get(10)));
    m
}

async fn elevated<E: Exec + Sync>(exec: &E, ctx: &RequestContext, session_id: &str, check_revoked: bool) -> Result<(), AppError> {
    let now = Utc::now();
    let session = load_session_by_id(exec, session_id).await?;
    match session {
        Some(s) if s.user_id == ctx.actor.id && (!check_revoked || s.revoked_at.is_none()) && s.elevated_until.is_some_and(|u: DateTime<Utc>| u > now) => Ok(()),
        _ => Err(AppError::new("ELEVATION_REQUIRED")),
    }
}

/// The checks `createApiToken` makes before its transaction.
#[derive(Debug, Clone, PartialEq)]
pub struct Checked {
    pub label: String,
    pub access: &'static str,
    pub surfaces: Vec<String>,
    pub days: Option<i32>,
}

pub fn check_request(label: &str, access: Option<&Value>, environments: &str, surfaces: &[Value], days: Option<&Value>) -> Result<Checked, AppError> {
    let label = js_trim(&nfc(label)).to_string();
    if label.is_empty() {
        return Err(AppError::new("LABEL_EMPTY"));
    }
    if label.chars().count() > 200 {
        return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(200)));
    }
    // `Object.hasOwn(ACTIONS_OF, access)` converts the key to a string, as Node does.
    let access = access.map(js_string).and_then(|a| ["read", "write", "delete"].into_iter().find(|k| *k == a));
    let Some(access) = access else { return Err(AppError::new("REQUEST_INVALID").with("field", json!("access"))) };
    if environments != "all" && environments != "one" {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("environments")));
    }
    let mut unique: Vec<String> = Vec::new();
    for s in surfaces {
        match s.as_str() {
            Some(v @ ("rest" | "mcp")) => {
                if !unique.iter().any(|u| u == v) {
                    unique.push(v.to_string());
                }
            }
            _ => return Err(AppError::new("REQUEST_INVALID").with("field", json!("surfaces"))),
        }
    }
    if unique.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("surfaces")));
    }
    let days = match days.filter(|d| !d.is_null()) {
        None => None,
        Some(d) => {
            let n = d.as_f64().unwrap_or(f64::NAN);
            if n.fract() != 0.0 || !(1.0..=TOKEN_MAX_DAYS as f64).contains(&n) {
                return Err(AppError::new("TOKEN_EXPIRY_REQUIRED").with("maximum_days", json!(TOKEN_MAX_DAYS)));
            }
            Some(n as i32)
        }
    };
    Ok(Checked { label, access, surfaces: unique, days })
}

pub async fn create(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let base_ref = match body.get("base").and_then(Value::as_str) {
        Some(b) if !b.is_empty() => b.to_string(),
        _ => return Err(AppError::new("REQUEST_INVALID").with("field", json!("base"))),
    };
    let environments = match body.get("environments") {
        None => "all".to_string(),
        Some(Value::String(e)) if e == "all" || e == "one" => e.clone(),
        Some(_) => return Err(AppError::new("REQUEST_INVALID").with("field", json!("environments"))),
    };
    let lifetime = body.get("expires_in_days");
    if lifetime.is_some_and(|l| !l.is_null() && !l.is_number()) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("expires_in_days")));
    }
    let who = bearer_who(&st, &headers).await?;
    let ctx = context_for(&st, &who.user_id, &rid, Some(&tenant), None).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base_ref).await?;
    refuse_token_actor(&ctx)?;
    let default_surfaces = vec![json!("rest"), json!("mcp")];
    let surfaces = body.get("surfaces").and_then(Value::as_array).unwrap_or(&default_surfaces);
    let label = body.get("label").and_then(Value::as_str).unwrap_or("");
    let checked = check_request(label, body.get("access"), &environments, surfaces, lifetime)?;
    let raw_access = body.get("access").cloned().unwrap_or(Value::Null);

    let (c, s, k, b, env, ra) = (&ctx, &who.session_id, &checked, &base_id, &environments, &raw_access);
    let issued = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        elevated(&tx, c, s, true).await?;
        let target = base_target(&tx, c, b).await?;
        let grants = require_manage_tokens(&tx, c, &target).await?;
        let actions = actions_of(k.access).unwrap_or(&[]);
        let missing: Vec<&str> = actions.iter().filter(|a| decide(c, &grants, **a, &target).verdict != Verdict::Allowed).map(|a| a.as_str()).collect();
        if !missing.is_empty() {
            return Err(AppError::new("ROLE_NOT_DELEGABLE").with("missing", json!(missing)));
        }
        let family: Vec<(String, bool)> = if env == "one" {
            vec![(target.id.clone(), true)]
        } else {
            tx.rows(
                "SELECT e.id::text, e.is_production
                   FROM _basedb.base own
                   JOIN _basedb.base e ON e.lineage_id = own.lineage_id AND e.tenant_id = own.tenant_id
                                      AND e.is_live AND e.deleted_at IS NULL
                  WHERE own.id = $1::text::uuid
                  ORDER BY e.is_production DESC, e.environment_position",
                &[&target.id],
            )
            .await?
            .iter()
            .map(|r| (r.get(0), r.get(1)))
            .collect()
        };
        let bound_to = family.iter().find(|f| f.1).map(|f| f.0.clone()).unwrap_or_else(|| target.id.clone());
        let (secret, prefix) = new_secret();
        let tenant_id: String = tx
            .first("SELECT id::text FROM _basedb.tenant WHERE ref = $1", &[&c.tenant_id])
            .await?
            .map(|r| r.get(0))
            .ok_or_else(|| AppError::internal("tenant introuvable"))?;
        let role_label = format!("Jeton d'intégration {prefix}");
        let role: String = tx
            .query_op(
                "INSERT INTO _basedb.role (tenant_id, label, label_key, name, kind, created_by)
                 VALUES ($1::text::uuid, $2, lower($2), $3, 'token', $4::text::uuid) RETURNING id::text",
                &[&tenant_id, &role_label, &format!("jeton_{prefix}"), &c.actor.id],
                SqlOp::Insert,
            )
            .await?
            .first()
            .map(|r| r.get(0))
            .ok_or_else(|| AppError::internal("rôle de jeton non créé"))?;
        for (base, _) in &family {
            for action in actions {
                tx.execute_op(
                    "INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
                     VALUES ($1::text::uuid, 'base', $2::text::uuid, $3, $4::text::uuid)",
                    &[&role, base, &action.as_str(), &c.actor.id],
                    SqlOp::Insert,
                )
                .await?;
            }
        }
        let sql = format!(
            "WITH inserted AS (
               INSERT INTO _basedb.api_token
                 (tenant_id, label, token_prefix, token_hash, role_id, base_id, allowed_surfaces,
                  expires_at, created_by, all_environments)
               VALUES ($1::text::uuid, $2, $3, $4, $5::text::uuid, $6::text::uuid, $7::text[],
                       clock_timestamp() + make_interval(days => $8::int), $9::text::uuid, $10)
               RETURNING *)
             SELECT {SUMMARY_COLUMNS} FROM inserted tk"
        );
        let rows = tx
            .query_op(&sql, &[&tenant_id, &k.label, &prefix, &sha256(secret.as_bytes()), &role, &bound_to, &k.surfaces, &k.days, &c.actor.id, &(env == "all")], SqlOp::Insert)
            .await?;
        let row = rows.first().ok_or_else(|| AppError::internal("jeton non créé"))?;
        let mut out = summary(row);
        let mut entry = AuditEntry::new("token.create", "api_token");
        entry.object_id = out.get("id").and_then(Value::as_str).map(str::to_string);
        entry.object_name = Some(k.label.clone());
        entry.base_id = Some(target.id.clone());
        if let Value::Object(p) = json!({ "prefix": prefix, "access": ra, "surfaces": k.surfaces, "expires_in_days": k.days, "environments": env }) {
            entry.payload = p;
        }
        write_audit(&tx, c, &entry).await?;
        out.insert("access".into(), ra.clone());
        out.insert("secret".into(), json!(secret));
        Ok(Value::Object(out))
    })
    .await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": issued })))
}

pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let base_ref = match q.get("base") {
        Some(b) if !b.is_empty() => b.clone(),
        _ => return Err(AppError::new("REQUEST_INVALID").with("field", json!("base"))),
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base_ref).await?;
    refuse_token_actor(&ctx)?;
    let (c, b) = (&ctx, &base_id);
    let tokens = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::read_only(), |tx| async move {
        let target = base_target(&tx, c, b).await?;
        require_manage_tokens(&tx, c, &target).await?;
        let sql = format!(
            "SELECT {SUMMARY_COLUMNS}
               FROM _basedb.api_token tk
              WHERE tk.base_id = $1::text::uuid
                 OR (tk.all_environments AND tk.base_id IN (
                       SELECT e.id FROM _basedb.base own
                         JOIN _basedb.base e ON e.lineage_id = own.lineage_id
                        WHERE own.id = $1::text::uuid))
              ORDER BY tk.created_at DESC"
        );
        let rows = tx.rows(&sql, &[&target.id]).await?;
        Ok(rows.iter().map(|r| Value::Object(summary(r))).collect::<Vec<_>>())
    })
    .await?;
    Ok(json_ok(json!({ "data": tokens })))
}

pub async fn list_own(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    refuse_token_actor(&ctx)?;
    let c = &ctx;
    let tokens = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::read_only(), |tx| async move {
        let sql = format!(
            "SELECT {SUMMARY_COLUMNS},
                    sn.name AS base_name, b.label AS base_label,
                    b.environment, b.is_production
               FROM _basedb.api_token tk
               JOIN _basedb.tenant t ON t.id = tk.tenant_id
               LEFT JOIN _basedb.base b
                      ON b.id = tk.base_id AND b.is_live AND b.deleted_at IS NULL
               LEFT JOIN _basedb.db_schema s
                      ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
               LEFT JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE tk.created_by = $1::text::uuid AND t.ref = $2
              ORDER BY (tk.revoked_at IS NULL
                        AND (tk.expires_at IS NULL OR tk.expires_at > clock_timestamp())) DESC,
                       tk.created_at DESC"
        );
        let rows = tx.rows(&sql, &[&c.actor.id, &c.tenant_id]).await?;
        Ok(rows
            .iter()
            .map(|r| {
                let mut m = summary(r);
                let (name, label): (Option<String>, Option<String>) = (r.get(14), r.get(15));
                let base = match (name, label) {
                    (Some(name), Some(label)) => json!({
                        "name": name,
                        "label": label,
                        "environment": r.get::<_, Option<String>>(16).unwrap_or_else(|| "Production".into()),
                        "production": r.get::<_, Option<bool>>(17) != Some(false),
                    }),
                    _ => Value::Null,
                };
                m.insert("base".into(), base);
                Value::Object(m)
            })
            .collect::<Vec<_>>())
    })
    .await?;
    Ok(json_ok(json!({ "data": tokens })))
}

pub async fn revoke(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let who = bearer_who(&st, &headers).await?;
    let ctx = context_for(&st, &who.user_id, &rid, Some(&tenant), None).await?;
    refuse_token_actor(&ctx)?;
    let (c, s, t) = (&ctx, &who.session_id, &id);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        elevated(&tx, c, s, false).await?;
        let row = tx
            .first(
                "SELECT tk.id::text, tk.base_id::text, tk.label, tk.created_by::text
                   FROM _basedb.api_token tk
                   JOIN _basedb.tenant t ON t.id = tk.tenant_id
                  WHERE tk.id::text = $1 AND t.ref = $2",
                &[t, &c.tenant_id],
            )
            .await?;
        let Some((token_id, Some(base_id), label, created_by)) = row.map(|r| (r.get::<_, String>(0), r.get::<_, Option<String>>(1), r.get::<_, String>(2), r.get::<_, String>(3))) else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("token", json!(t)));
        };
        if created_by != c.actor.id {
            let target = base_target(&tx, c, &base_id).await?;
            require_manage_tokens(&tx, c, &target).await?;
        }
        tx.execute_op(
            "UPDATE _basedb.api_token
                SET revoked_at = coalesce(revoked_at, clock_timestamp()),
                    revoked_by = coalesce(revoked_by, $2::text::uuid)
              WHERE id = $1::text::uuid",
            &[&token_id, &c.actor.id],
            SqlOp::Update,
        )
        .await?;
        let mut entry = AuditEntry::new("token.revoke", "api_token");
        entry.object_id = Some(token_id);
        entry.object_name = Some(label);
        entry.base_id = Some(base_id);
        write_audit(&tx, c, &entry).await
    })
    .await?;
    st.token_cache.forget();
    Ok(empty(StatusCode::NO_CONTENT))
}

#[cfg(test)]
mod tests {
    use super::*;
    use basedb_base::auth::tokens::token_pattern;

    #[test]
    fn secrets_match_the_pattern_scanners_know() {
        for _ in 0..50 {
            let (secret, prefix) = new_secret();
            assert!(token_pattern().is_match(&secret), "{secret}");
            assert_eq!(&secret[4..12], prefix);
        }
    }

    #[test]
    fn base62_pads_and_converts() {
        assert_eq!(base62(&[0u8; 32]), "0".repeat(43));
        assert_eq!(base62(&[0, 61]), format!("{}z", "0".repeat(42)));
        assert_eq!(base62(&[0, 62]), format!("{}10", "0".repeat(41)));
        assert_eq!(base62(&[0xff; 32]).len(), 43);
    }

    #[test]
    fn requests_are_checked_in_node_order() {
        let rest = [json!("rest"), json!("rest"), json!("mcp")];
        let ok = check_request(" Agent ", Some(&json!("write")), "all", &rest, None).unwrap();
        assert_eq!(ok, Checked { label: "Agent".into(), access: "write", surfaces: vec!["rest".into(), "mcp".into()], days: None });
        assert_eq!(check_request(" ", Some(&json!("x")), "all", &rest, None).unwrap_err().code, "LABEL_EMPTY");
        assert_eq!(check_request(&"é".repeat(201), None, "all", &rest, None).unwrap_err().code, "LABEL_TOO_LONG");
        assert_eq!(check_request("a", Some(&json!(["read"])), "all", &rest, None).unwrap().access, "read");
        assert_eq!(check_request("a", None, "all", &rest, None).unwrap_err().code, "REQUEST_INVALID");
        assert!(check_request("a", Some(&json!("read")), "all", &[], None).is_err());
        assert!(check_request("a", Some(&json!("read")), "all", &[json!("ui")], None).is_err());
        for bad in [json!(0), json!(366), json!(1.5)] {
            assert_eq!(check_request("a", Some(&json!("read")), "all", &rest, Some(&bad)).unwrap_err().code, "TOKEN_EXPIRY_REQUIRED");
        }
        assert_eq!(check_request("a", Some(&json!("read")), "all", &rest, Some(&json!(365.0))).unwrap().days, Some(365));
        assert_eq!(check_request("a", Some(&json!("read")), "all", &rest, Some(&Value::Null)).unwrap().days, None);
    }
}
