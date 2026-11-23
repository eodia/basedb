//! `POST /api/insights/reader` (`insights/embedded.ts`: `verifyInsightsToken`,
//! `readerContext`, `insightsReader`): insights asks, with a short JWT naming the person,
//! for the credentials of their reader role — provisioned over every base they read — and
//! for what it opens.

use crate::reader::reader_reaches;
use crate::sql_console::{password_of, provision_reader, role_of};
use crate::sql_views::{sql_view_summaries, SummaryBase};
use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue};
use axum::Extension;
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{json_ok, ApiResult, AppError};
use basedb_base::time::{b64url_decode, hmac_sha256};
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use basedb_base::{RequestId, Shared};
use chrono::Duration;
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

const MAX_TOKEN_SECONDS: f64 = 120.0;
const CLOCK_TOLERANCE_SECONDS: f64 = 5.0;
pub const READER_TTL_SECONDS: i64 = 300;

/// `InsightsClaims`.
#[derive(Debug, Clone, PartialEq)]
pub struct InsightsClaims {
    pub subject: String,
    pub scope: Option<String>,
}

/// `jwtVerify` of jose with `algorithms: ['HS256']`, `issuer: 'insights'`,
/// `audience: 'basedb'`, `requiredClaims: ['exp', 'sub']` and five seconds of tolerance.
fn jwt_claims(secret: &str, token: &str, now: f64) -> Option<Map<String, Value>> {
    let parts: Vec<&str> = token.split('.').collect();
    let [header, payload, signature] = parts.as_slice() else { return None };
    let header: Value = serde_json::from_slice(&b64url_decode(header)?).ok()?;
    let header = header.as_object()?;
    if header.contains_key("crit") || header.get("alg").and_then(Value::as_str) != Some("HS256") {
        return None;
    }
    let expected = hmac_sha256(secret.as_bytes(), &[parts[0].as_bytes(), b".", parts[1].as_bytes()]);
    if b64url_decode(signature)? != expected {
        return None;
    }
    let claims: Value = serde_json::from_slice(&b64url_decode(payload)?).ok()?;
    let claims = claims.as_object()?.clone();
    for required in ["exp", "sub", "iss", "aud"] {
        if !claims.contains_key(required) {
            return None;
        }
    }
    if claims.get("iss").and_then(Value::as_str) != Some("insights") {
        return None;
    }
    let audience_ok = match claims.get("aud") {
        Some(Value::String(a)) => a == "basedb",
        Some(Value::Array(items)) => items.iter().any(|a| a.as_str() == Some("basedb")),
        _ => false,
    };
    if !audience_ok {
        return None;
    }
    if let Some(iat) = claims.get("iat") {
        iat.as_f64()?;
    }
    if let Some(nbf) = claims.get("nbf") {
        if nbf.as_f64()? > now + CLOCK_TOLERANCE_SECONDS {
            return None;
        }
    }
    if claims.get("exp")?.as_f64()? <= now - CLOCK_TOLERANCE_SECONDS {
        return None;
    }
    Some(claims)
}

/// `verifyInsightsToken`: any failure is `AUTHENTICATION_REQUIRED`, and says no more.
pub fn verify_insights_token(secret: &str, token: Option<&str>, now_ms: i64) -> Result<InsightsClaims, AppError> {
    let refused = || AppError::new("AUTHENTICATION_REQUIRED");
    let token = token.filter(|t| !t.is_empty()).ok_or_else(refused)?;
    let seconds = now_ms.div_euclid(1000) as f64;
    let claims = jwt_claims(secret, token, seconds).ok_or_else(refused)?;
    let exp = claims.get("exp").and_then(Value::as_f64).ok_or_else(refused)?;
    if exp - seconds > MAX_TOKEN_SECONDS + CLOCK_TOLERANCE_SECONDS {
        return Err(refused());
    }
    if let Some(iat) = claims.get("iat").and_then(Value::as_f64) {
        if seconds - iat > MAX_TOKEN_SECONDS + CLOCK_TOLERANCE_SECONDS || iat - seconds > CLOCK_TOLERANCE_SECONDS {
            return Err(refused());
        }
    }
    let subject = claims.get("sub").and_then(Value::as_str).filter(|s| !s.is_empty()).ok_or_else(refused)?.to_string();
    let scope = claims.get("scope").and_then(Value::as_str).map(str::to_string);
    Ok(InsightsClaims { subject, scope })
}

/// `readerContext`: the person the claims name, as a context of theirs.
pub async fn reader_context(pools: &Pools, claims: &InsightsClaims, request_id: &str) -> Result<RequestContext, AppError> {
    let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("user", json!(claims.subject));
    if claims.scope.as_deref().is_some_and(|s| s != "reader") {
        return Err(AppError::new("AUTHENTICATION_REQUIRED"));
    }
    if !crate::js::is_uuid_ci(&claims.subject) {
        return Err(not_found());
    }
    let conn = pools.catalog().await?;
    let user = conn
        .first(
            "SELECT u.id::text, t.ref AS tenant_ref
               FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE u.id = $1::text::uuid AND u.disabled_at IS NULL AND u.deleted_at IS NULL",
            &[&claims.subject],
        )
        .await?
        .ok_or_else(not_found)?;
    let mut ctx = RequestContext::new(request_id, Actor::user(user.get::<_, String>(0)), user.get::<_, String>(1), Surface::Rest);
    ctx.deadline = ctx.timestamp + Duration::seconds(60);
    Ok(ctx)
}

/// `insightsReader`: the role brought in line, its credentials, and what it opens.
pub async fn insights_reader(pools: &Pools, ctx: &RequestContext, instance_key: &str) -> Result<Value, AppError> {
    let user_id = ctx.actor.id.as_str();
    let reaches = reader_reaches(pools, ctx).await?;
    let role = role_of(user_id);
    let password = password_of(instance_key, user_id);
    let physical = provision_reader(pools, ctx, &role, &password, &reaches, true).await?;

    let bases: Vec<SummaryBase> = reaches.iter().map(|r| SummaryBase { id: r.base_id.clone(), schema: r.reach.schema.clone(), readable: r.reach.tables.clone() }).collect();
    let bases = &bases;
    let reaches_ref = &reaches;
    let views: HashMap<String, IndexMap<String, Vec<String>>> = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let listed = sql_view_summaries(&tx, bases, &HashSet::new()).await?;
        let mut schemas: Vec<String> = Vec::new();
        let mut names: Vec<String> = Vec::new();
        for r in reaches_ref {
            for v in listed.get(&r.base_id).map(Vec::as_slice).unwrap_or(&[]) {
                schemas.push(r.reach.schema.clone());
                names.push(v.get("name").and_then(Value::as_str).unwrap_or_default().to_string());
            }
        }
        let rows = tx
            .rows(
                "SELECT n.nspname::text, c.relname::text, a.attname::text
                   FROM unnest($1::text[], $2::text[]) AS wanted(nspname, relname)
                   JOIN pg_namespace n ON n.nspname = wanted.nspname
                   JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = wanted.relname
                                  AND c.relkind = 'v'
                   JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
                  ORDER BY n.nspname, c.relname, a.attnum",
                &[&schemas, &names],
            )
            .await?;
        let mut out: HashMap<String, IndexMap<String, Vec<String>>> = HashMap::new();
        for row in &rows {
            out.entry(row.get(0)).or_default().entry(row.get(1)).or_default().push(row.get(2));
        }
        Ok(out)
    })
    .await?;

    let schemas: Vec<Value> = reaches
        .iter()
        .map(|r| {
            let mut tables = Map::new();
            for (table, readable) in &r.reach.tables {
                let columns: Vec<&String> = physical.get(&r.reach.schema).and_then(|t| t.get(table)).map(|c| c.iter().filter(|c| readable.contains(*c)).collect()).unwrap_or_default();
                if !columns.is_empty() {
                    tables.insert(table.clone(), json!(columns));
                }
            }
            for (view, columns) in views.get(&r.reach.schema).into_iter().flatten() {
                tables.insert(view.clone(), json!(columns));
            }
            json!({ "schema": r.reach.schema, "label": r.label, "tables": crate::js::js_order(Value::Object(tables)) })
        })
        .collect();
    Ok(json!({ "user": role, "password": password, "ttl_seconds": READER_TTL_SECONDS, "schemas": schemas }))
}

/// `insightsToken` of `app.ts`: the bearer of the `Authorization` header.
fn insights_token(headers: &HeaderMap) -> Option<String> {
    let header = headers.get("authorization")?.to_str().ok()?;
    if header.to_lowercase().starts_with("bearer ") {
        Some(crate::description::js_trim(&header[7..]).to_string())
    } else {
        None
    }
}

/// `POST /api/insights/reader`.
pub async fn post_reader(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap) -> ApiResult {
    let config = st.cfg.insights.as_ref().ok_or_else(|| AppError::new("INSIGHTS_UNAVAILABLE").with("reason", json!("non_configure")))?;
    let claims = verify_insights_token(&config.secret, insights_token(&headers).as_deref(), chrono::Utc::now().timestamp_millis())?;
    let ctx = reader_context(&st.pools, &claims, &rid.0).await?;
    let key = st.instance_key()?.to_string();
    let body = insights_reader(&st.pools, &ctx, &key).await?;
    let mut res = json_ok(body);
    res.headers_mut().insert("cache-control", HeaderValue::from_static("no-store"));
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;
    use basedb_base::time::b64url;

    fn token(secret: &str, claims: Value) -> String {
        let header = b64url(br#"{"alg":"HS256","typ":"JWT"}"#);
        let payload = b64url(claims.to_string().as_bytes());
        let signature = hmac_sha256(secret.as_bytes(), &[header.as_bytes(), b".", payload.as_bytes()]);
        format!("{header}.{payload}.{}", b64url(&signature))
    }

    #[test]
    fn tokens_are_checked_as_jose_and_embedded_ts_do() {
        let now = 1_700_000_000_000i64;
        let s = now / 1000;
        let good = json!({ "iss": "insights", "aud": "basedb", "sub": "u", "iat": s, "exp": s + 60 });
        assert_eq!(verify_insights_token("k", Some(&token("k", good.clone())), now).unwrap(), InsightsClaims { subject: "u".into(), scope: None });
        assert!(verify_insights_token("other", Some(&token("k", good)), now).is_err());
        let long = json!({ "iss": "insights", "aud": "basedb", "sub": "u", "exp": s + 600 });
        assert!(verify_insights_token("k", Some(&token("k", long)), now).is_err());
        let expired = json!({ "iss": "insights", "aud": ["x", "basedb"], "sub": "u", "exp": s - 10 });
        assert!(verify_insights_token("k", Some(&token("k", expired)), now).is_err());
        let wrong_issuer = json!({ "iss": "basedb", "aud": "basedb", "sub": "u", "exp": s + 60 });
        assert!(verify_insights_token("k", Some(&token("k", wrong_issuer)), now).is_err());
        let scoped = json!({ "iss": "insights", "aud": ["basedb"], "sub": "u", "exp": s + 60, "scope": "reader" });
        assert_eq!(verify_insights_token("k", Some(&token("k", scoped)), now).unwrap().scope.as_deref(), Some("reader"));
        assert!(verify_insights_token("k", None, now).is_err());
    }
}
