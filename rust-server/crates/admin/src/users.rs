//! `admin/users.ts`: the accounts of a tenant — create, rename, disable, reset, groups.

use crate::common::{administering, audit, check_name, checked_email, fields, iso, iso_opt, strict_json, text};
use crate::groups::{administer, assert_another_admin, change_membership, ensure_system_groups, load_group, ADMINS, EVERYONE};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::auth::operations::normalize_email;
use basedb_base::auth::password::hash_password;
use basedb_base::auth::session::{revoke_sessions, RevokeScope};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, json_response, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::require::require_administration;
use basedb_base::time::random_bytes;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::Shared;
use chrono::{DateTime, Utc};
use serde_json::{json, Value};

const ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/// `randomInt(n)`: uniform, by rejection.
fn random_index(n: usize) -> usize {
    let limit = 256 - (256 % n);
    loop {
        let b = random_bytes(1)[0] as usize;
        if b < limit {
            return b % n;
        }
    }
}

/// `temporaryPassword`: four groups of five, easy to dictate.
pub fn temporary_password() -> String {
    (0..4).map(|_| (0..5).map(|_| ALPHABET[random_index(ALPHABET.len())] as char).collect::<String>()).collect::<Vec<_>>().join("-")
}

async fn load_users<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<Vec<(String, Value)>, AppError> {
    let rows = exec
        .rows(
            "SELECT u.id::text, u.email, u.display_name, u.is_instance_admin, u.disabled_at,
                    u.must_change_password, u.created_at,
                    (SELECT max(s.last_seen_at) FROM _basedb.session s WHERE s.user_id = u.id)
                      AS last_seen_at,
                    (SELECT json_agg(json_build_object('id', r.id, 'label', r.label, 'name', r.name)
                                     ORDER BY (r.name = $2) DESC, (r.name = $3) DESC, r.label)
                       FROM _basedb.role_member m
                       JOIN _basedb.role r ON r.id = m.role_id AND r.deleted_at IS NULL
                                          AND r.kind = 'group'
                      WHERE m.user_id = u.id) AS groups
               FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE t.ref = $1 AND u.deleted_at IS NULL
                AND (NOT u.is_system OR u.is_instance_admin)
              ORDER BY u.disabled_at IS NOT NULL, lower(u.display_name), lower(u.email)",
            &[&ctx.tenant_id, &ADMINS, &EVERYONE],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let id: String = r.get(0);
            let groups: Vec<Value> = r.get::<_, Option<Value>>(8).and_then(|g| g.as_array().cloned()).unwrap_or_default();
            let is_admin = r.get::<_, bool>(3) || groups.iter().any(|g| g["name"] == ADMINS);
            let disabled_at: Option<DateTime<Utc>> = r.get(4);
            let user = json!({
                "id": id,
                "email": r.get::<_, String>(1),
                "display_name": r.get::<_, String>(2),
                "is_admin": is_admin,
                "disabled": disabled_at.is_some(),
                "must_change_password": r.get::<_, bool>(5),
                "created_at": iso(r.get(6)),
                "last_seen_at": iso_opt(r.get(7)),
                "groups": groups.iter().map(|g| json!({ "id": g["id"], "label": g["label"] })).collect::<Vec<_>>(),
            });
            (id, user)
        })
        .collect())
}

async fn one_user<E: Exec + Sync>(exec: &E, ctx: &RequestContext, id: &str) -> Result<Value, AppError> {
    Ok(load_users(exec, ctx).await?.into_iter().find(|(i, _)| i == id).map(|(_, u)| u).unwrap_or(Value::Null))
}

struct Account {
    id: String,
    email: String,
    display_name: String,
    disabled: bool,
}

async fn load_user<E: Exec + Sync>(exec: &E, ctx: &RequestContext, user_id: &str) -> Result<Account, AppError> {
    let row = exec
        .first(
            "SELECT u.id::text, u.email, u.display_name, u.disabled_at IS NOT NULL
               FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE u.id::text = $1 AND t.ref = $2 AND u.deleted_at IS NULL",
            &[&user_id, &ctx.tenant_id],
        )
        .await?;
    let Some(r) = row else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("user", json!(user_id))) };
    Ok(Account { id: r.get(0), email: r.get(1), display_name: r.get(2), disabled: r.get(3) })
}

async fn store_temporary_password<E: Exec + Sync>(exec: &E, instance_key: &str, user_id: &str, email: &str) -> Result<String, AppError> {
    let password = temporary_password();
    let stored = hash_password(instance_key, &password).await?;
    exec.execute_op(
        "INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
         VALUES ($1::text::uuid, 'password', $2, $3)
         ON CONFLICT (provider, subject)
         DO UPDATE SET password_hash = EXCLUDED.password_hash,
                       failed_attempts = 0,
                       locked_until = NULL",
        &[&user_id, &normalize_email(email), &stored],
        SqlOp::Insert,
    )
    .await?;
    exec.execute_op("UPDATE _basedb.app_user SET must_change_password = true WHERE id = $1::text::uuid", &[&user_id], SqlOp::Update).await?;
    Ok(password)
}

pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let c = &ctx;
    let users = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        ensure_system_groups(&tx, &c.tenant_id, &c.actor.id).await?;
        load_users(&tx, c).await
    })
    .await?;
    Ok(json_ok(json!({ "data": users.into_iter().map(|(_, u)| u).collect::<Vec<_>>() })))
}

pub async fn create(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let body = fields(&body)?;
    let email = checked_email(text(body, "email").unwrap_or(""))?;
    let display_name = check_name(Some(text(body, "display_name").unwrap_or("")))?;
    let group_ids: Vec<Value> = body.get("groups").and_then(Value::as_array).cloned().unwrap_or_default();
    let key = st.instance_key()?.to_string();
    let (c, s, e, n, g, k) = (&ctx, &session_id, &email, &display_name, &group_ids, &key);
    let (user, password) = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let system = administer(&tx, c, s).await?;
        let taken = tx
            .rows(
                "SELECT u.id FROM _basedb.app_user u
                   JOIN _basedb.tenant t ON t.id = u.tenant_id
                  WHERE t.ref = $1 AND lower(u.email) = lower($2) AND u.deleted_at IS NULL",
                &[&c.tenant_id, e],
            )
            .await?;
        if !taken.is_empty() {
            return Err(AppError::new("EMAIL_TAKEN").with("field", json!("email")));
        }
        let rows = tx
            .query_op(
                "INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
                 SELECT t.id, $2, $3, $4::text::uuid, $4::text::uuid FROM _basedb.tenant t WHERE t.ref = $1
                 RETURNING id::text",
                &[&c.tenant_id, e, n, &c.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let id: String = rows[0].get(0);
        // `new Set([everyone, ...groupIds])`: insertion order, duplicates dropped.
        let mut groups: Vec<Value> = vec![json!(system.everyone)];
        for g in g {
            if !groups.contains(g) {
                groups.push(g.clone());
            }
        }
        for group_id in &groups {
            if group_id.as_str() == Some(system.everyone.as_str()) {
                tx.execute_op(
                    "INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
                     VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid) ON CONFLICT DO NOTHING",
                    &[&system.everyone, &id, &c.actor.id],
                    SqlOp::Insert,
                )
                .await?;
                continue;
            }
            let group = load_group(&tx, c, group_id).await?;
            change_membership(&tx, c, &group, &id, true).await?;
        }
        let password = store_temporary_password(&tx, k, &id, e).await?;
        audit(&tx, c, "user.create", "app_user", Some(&id), Some(n), json!({})).await?;
        Ok((one_user(&tx, c, &id).await?, password))
    })
    .await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": { "user": user, "temporary_password": password } })))
}

pub async fn update(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let body = fields(&body)?;
    let display_name = match text(body, "display_name") {
        Some(n) => Some(check_name(Some(n))?),
        None => None,
    };
    let disabled = body.get("disabled").and_then(Value::as_bool);
    let (c, s, uid, dn) = (&ctx, &session_id, &id, &display_name);
    let user = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let system = administer(&tx, c, s).await?;
        let user = load_user(&tx, c, uid).await?;
        if let Some(name) = dn {
            tx.execute_op(
                "UPDATE _basedb.app_user
                    SET display_name = $2, updated_at = clock_timestamp(), updated_by = $3::text::uuid
                  WHERE id = $1::text::uuid",
                &[&user.id, name, &c.actor.id],
                SqlOp::Update,
            )
            .await?;
        }
        if disabled == Some(true) && !user.disabled {
            if user.id == c.actor.id {
                return Err(AppError::new("ACTION_FORBIDDEN").with("reason", json!("soi_meme")));
            }
            let n: i64 = tx
                .first("SELECT count(*) AS n FROM _basedb.role_member WHERE role_id = $1::text::uuid AND user_id = $2::text::uuid", &[&system.admins, &user.id])
                .await?
                .map(|r| r.get(0))
                .unwrap_or(0);
            if n > 0 {
                assert_another_admin(&tx, &system.admins, &user.id).await?;
            }
            tx.execute_op(
                "UPDATE _basedb.app_user
                    SET disabled_at = clock_timestamp(), updated_at = clock_timestamp(), updated_by = $2::text::uuid
                  WHERE id = $1::text::uuid",
                &[&user.id, &c.actor.id],
                SqlOp::Update,
            )
            .await?;
            revoke_sessions(&tx, RevokeScope::All { user_id: &user.id }, "account_disabled").await?;
            audit(&tx, c, "user.disable", "app_user", Some(&user.id), Some(&user.display_name), json!({})).await?;
        } else if disabled == Some(false) && user.disabled {
            tx.execute_op(
                "UPDATE _basedb.app_user
                    SET disabled_at = NULL, updated_at = clock_timestamp(), updated_by = $2::text::uuid
                  WHERE id = $1::text::uuid",
                &[&user.id, &c.actor.id],
                SqlOp::Update,
            )
            .await?;
            audit(&tx, c, "user.enable", "app_user", Some(&user.id), Some(&user.display_name), json!({})).await?;
        }
        one_user(&tx, c, &user.id).await
    })
    .await?;
    Ok(json_ok(json!({ "data": user })))
}

pub async fn reset_password(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let key = st.instance_key()?.to_string();
    let (c, s, uid, k) = (&ctx, &session_id, &id, &key);
    let password = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        administer(&tx, c, s).await?;
        let user = load_user(&tx, c, uid).await?;
        let password = store_temporary_password(&tx, k, &user.id, &user.email).await?;
        revoke_sessions(&tx, RevokeScope::All { user_id: &user.id }, "password_reset").await?;
        audit(&tx, c, "user.password_reset", "app_user", Some(&user.id), Some(&user.display_name), json!({})).await?;
        Ok(password)
    })
    .await?;
    Ok(json_ok(json!({ "data": { "temporary_password": password } })))
}

pub async fn set_groups(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let Some(wanted_all) = fields(&body)?.get("groups").and_then(Value::as_array).cloned() else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("groups")));
    };
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let (c, s, uid, w) = (&ctx, &session_id, &id, &wanted_all);
    let user = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let system = administer(&tx, c, s).await?;
        let user = load_user(&tx, c, uid).await?;
        let current = tx
            .rows(
                "SELECT m.role_id::text FROM _basedb.role_member m
                   JOIN _basedb.role r ON r.id = m.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
                  WHERE m.user_id = $1::text::uuid",
                &[&user.id],
            )
            .await?;
        let mut wanted: Vec<Value> = Vec::new();
        for g in w {
            if g.as_str() != Some(system.everyone.as_str()) && !wanted.contains(g) {
                wanted.push(g.clone());
            }
        }
        let mut held: Vec<String> = Vec::new();
        for r in &current {
            let id: String = r.get(0);
            if id != system.everyone && !held.contains(&id) {
                held.push(id);
            }
        }
        for g in &wanted {
            if !g.as_str().is_some_and(|g| held.iter().any(|h| h == g)) {
                let group = load_group(&tx, c, g).await?;
                change_membership(&tx, c, &group, &user.id, true).await?;
            }
        }
        for h in &held {
            if !wanted.iter().any(|g| g.as_str() == Some(h.as_str())) {
                let group = load_group(&tx, c, &json!(h)).await?;
                change_membership(&tx, c, &group, &user.id, false).await?;
            }
        }
        one_user(&tx, c, &user.id).await
    })
    .await?;
    Ok(json_ok(json!({ "data": user })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temporary_passwords_are_dictable() {
        let p = temporary_password();
        let parts: Vec<&str> = p.split('-').collect();
        assert_eq!(parts.len(), 4);
        assert!(parts.iter().all(|g| g.len() == 5 && g.bytes().all(|b| ALPHABET.contains(&b))));
        assert_ne!(temporary_password(), p);
    }
}
