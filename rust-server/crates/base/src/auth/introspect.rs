//! L'introspection des jetons (RFC 7662, chapitre 13 §11), telle `auth/introspect.ts` : une
//! autre application, qui prouve qui ELLE est par un jeton d'intégration du même espace,
//! demande si un jeton qu'on lui a tendu est bon, et à qui il est.

use super::operations::authenticate_access_token;
use super::session::decode_access_token;
use super::tokens::{verify_api_token, TokenCache};
use crate::db::{Exec, Pools};
use crate::error::AppError;
use crate::time::sha256;
use crate::tx::Surface;
use chrono::{DateTime, Utc};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

fn integration() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^bdb_[a-z0-9]{8}_[0-9A-Za-z]{43}$").unwrap())
}

fn inactive() -> Value {
    json!({ "active": false })
}

struct Person {
    id: String,
    email: String,
    name: String,
    tenant: String,
    groups: Vec<String>,
}

async fn person_of(pools: &Pools, user_id: &str) -> Result<Option<Person>, AppError> {
    let exec = pools.catalog().await?;
    let row = exec
        .first(
            "SELECT u.id::text, u.email, u.display_name, t.ref AS tenant,
                    COALESCE(array_agg(r.label ORDER BY r.label) FILTER (WHERE r.id IS NOT NULL), '{}') AS groups
               FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
               LEFT JOIN _basedb.role_member m ON m.user_id = u.id
               LEFT JOIN _basedb.role r ON r.id = m.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
              WHERE u.id = $1::text::uuid AND u.disabled_at IS NULL AND u.deleted_at IS NULL
              GROUP BY u.id, u.email, u.display_name, t.ref",
            &[&user_id],
        )
        .await?;
    Ok(row.map(|r| {
        let email: String = r.get(1);
        let name: Option<String> = r.get(2);
        Person { id: r.get(0), name: name.unwrap_or_else(|| email.clone()), email, tenant: r.get(3), groups: r.get(4) }
    }))
}

fn seconds(at: DateTime<Utc>) -> i64 {
    at.timestamp_millis().div_euclid(1000)
}

fn person_fields(kind: &str, p: &Person) -> Map<String, Value> {
    let mut m = Map::new();
    m.insert("active".into(), json!(true));
    m.insert("token_type".into(), json!(kind));
    m.insert("sub".into(), json!(p.id));
    m.insert("username".into(), json!(p.email));
    m.insert("email".into(), json!(p.email));
    m.insert("name".into(), json!(p.name));
    m.insert("tenant".into(), json!(p.tenant));
    m.insert("groups".into(), json!(p.groups));
    m
}

/// `introspectToken`.
pub async fn introspect_token(
    pools: &Pools,
    cache: &TokenCache,
    instance_key: &str,
    caller: Option<&str>,
    token: Option<&str>,
    request_id: Option<&str>,
    ip: Option<&str>,
) -> Result<Value, AppError> {
    let application = verify_api_token(pools, cache, caller, Surface::Rest, request_id, ip).await?;
    let token = token.map(str::trim).unwrap_or("");
    if token.is_empty() {
        return Ok(inactive());
    }
    let now = Utc::now();
    if integration().is_match(token) {
        let found = {
            let exec = pools.catalog().await?;
            exec.first(
                "SELECT tk.created_by::text, tk.base_id::text AS base, tk.all_environments, tk.allowed_surfaces,
                        tk.created_at, tk.expires_at,
                        EXISTS (SELECT 1 FROM _basedb.permission p
                                 WHERE p.role_id = tk.role_id AND p.action IN ('create', 'update')) AS can_write,
                        EXISTS (SELECT 1 FROM _basedb.permission p
                                 WHERE p.role_id = tk.role_id AND p.action = 'delete') AS can_delete
                   FROM _basedb.api_token tk
                  WHERE tk.token_hash = $1
                    AND tk.revoked_at IS NULL AND tk.suspended_at IS NULL
                    AND (tk.expires_at IS NULL OR tk.expires_at > $2)",
                &[&sha256(token.as_bytes()), &now],
            )
            .await?
        };
        let Some(f) = found else { return Ok(inactive()) };
        let created_by: String = f.get(0);
        let Some(person) = person_of(pools, &created_by).await?.filter(|p| p.tenant == application.tenant_ref) else {
            return Ok(inactive());
        };
        let mut m = person_fields("integration_token", &person);
        m.insert("iat".into(), json!(seconds(f.get(4))));
        if let Some(exp) = f.get::<_, Option<DateTime<Utc>>>(5) {
            m.insert("exp".into(), json!(seconds(exp)));
        }
        m.insert("base".into(), json!(f.get::<_, Option<String>>(1)));
        m.insert("environments".into(), json!(if f.get::<_, bool>(2) { "all" } else { "one" }));
        let access = if f.get::<_, bool>(7) {
            "delete"
        } else if f.get::<_, bool>(6) {
            "write"
        } else {
            "read"
        };
        m.insert("access".into(), json!(access));
        m.insert("surfaces".into(), json!(f.get::<_, Vec<String>>(3)));
        return Ok(Value::Object(m));
    }
    let Some(claim) = decode_access_token(token) else { return Ok(inactive()) };
    let authenticated = match authenticate_access_token(pools, instance_key, Some(token)).await {
        Ok(a) => a,
        Err(e) if e.code == "AUTHENTICATION_REQUIRED" => return Ok(inactive()),
        Err(e) => return Err(e),
    };
    if authenticated.tenant_ref != application.tenant_ref {
        return Ok(inactive());
    }
    let Some(person) = person_of(pools, &authenticated.user_id).await? else { return Ok(inactive()) };
    let mut m = person_fields("access_token", &person);
    m.insert("exp".into(), json!((claim.expires_at_ms / 1000.0).floor() as i64));
    Ok(Value::Object(m))
}
