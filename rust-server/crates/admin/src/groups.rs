//! `admin/groups.ts`: the groups of a tenant, the two system ones, memberships.

use crate::common::{administering, audit, check_label, fields, js_string, label_key, require_elevated_session, strict_json, text};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::decide::ACTIONS;
use basedb_base::rbac::require::require_administration;
use basedb_base::time::{hex, random_bytes};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::Shared;
use serde_json::{json, Value};

pub const ADMINS: &str = "tenant_admin";
pub const EVERYONE: &str = "all_users";

#[derive(Debug, Clone)]
pub struct SystemGroupIds {
    pub admins: String,
    pub everyone: String,
}

#[derive(Debug, Clone)]
pub struct Group {
    pub id: String,
    pub label: String,
    pub system: Option<&'static str>,
}

#[derive(Debug, Clone)]
pub struct GroupSummary {
    pub id: String,
    pub label: String,
    pub system: Option<&'static str>,
    pub member_count: i64,
}

impl GroupSummary {
    pub fn json(&self) -> Value {
        json!({ "id": self.id, "label": self.label, "system": self.system, "member_count": self.member_count })
    }
}

fn system_of(name: &str, is_system: bool) -> Option<&'static str> {
    if !is_system {
        return None;
    }
    match name {
        ADMINS => Some("admins"),
        EVERYONE => Some("everyone"),
        _ => None,
    }
}

/// `ensureSystemGroups`.
pub async fn ensure_system_groups<E: Exec + Sync>(exec: &E, tenant_ref: &str, actor_id: &str) -> Result<SystemGroupIds, AppError> {
    let Some(tenant) = exec.first("SELECT id::text FROM _basedb.tenant WHERE ref = $1", &[&tenant_ref]).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    };
    let tenant_id: String = tenant.get(0);
    async fn ensure<E: Exec + Sync>(exec: &E, tenant_id: &str, actor_id: &str, name: &str, label: &str) -> Result<(String, bool), AppError> {
        if let Some(r) = exec
            .first("SELECT id::text FROM _basedb.role WHERE tenant_id = $1::text::uuid AND name = $2 AND deleted_at IS NULL", &[&tenant_id, &name])
            .await?
        {
            return Ok((r.get(0), false));
        }
        let rows = exec
            .query_op(
                "INSERT INTO _basedb.role (tenant_id, label, label_key, name, is_system, kind, created_by)
                 VALUES ($1::text::uuid, $2, $3, $4, true, 'group', $5::text::uuid) RETURNING id::text",
                &[&tenant_id, &label, &label_key(label), &name, &actor_id],
                SqlOp::Insert,
            )
            .await?;
        Ok((rows[0].get(0), true))
    }
    let (admins, created) = ensure(exec, &tenant_id, actor_id, ADMINS, "Administrateurs").await?;
    if created {
        for action in ACTIONS {
            exec.execute_op(
                "INSERT INTO _basedb.permission (role_id, scope_kind, action, granted_by)
                 VALUES ($1::text::uuid, 'tenant', $2, $3::text::uuid) ON CONFLICT DO NOTHING",
                &[&admins, &action.as_str(), &actor_id],
                SqlOp::Insert,
            )
            .await?;
        }
        exec.execute_op(
            "INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
             SELECT $1::text::uuid, u.id, $3::text::uuid FROM _basedb.app_user u
              WHERE u.tenant_id = $2::text::uuid AND u.is_instance_admin AND u.deleted_at IS NULL
             ON CONFLICT DO NOTHING",
            &[&admins, &tenant_id, &actor_id],
            SqlOp::Insert,
        )
        .await?;
    }
    let (everyone, _) = ensure(exec, &tenant_id, actor_id, EVERYONE, "Tous les utilisateurs").await?;
    exec.execute_op(
        "INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
         SELECT $1::text::uuid, u.id, $3::text::uuid FROM _basedb.app_user u
          WHERE u.tenant_id = $2::text::uuid AND u.deleted_at IS NULL AND NOT u.is_system
            AND NOT EXISTS (SELECT 1 FROM _basedb.role_member m
                             WHERE m.role_id = $1::text::uuid AND m.user_id = u.id)",
        &[&everyone, &tenant_id, &actor_id],
        SqlOp::Insert,
    )
    .await?;
    exec.execute_op(
        "INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
         SELECT $1::text::uuid, u.id, $3::text::uuid FROM _basedb.app_user u
          WHERE u.tenant_id = $2::text::uuid AND u.deleted_at IS NULL AND u.is_instance_admin
         ON CONFLICT DO NOTHING",
        &[&everyone, &tenant_id, &actor_id],
        SqlOp::Insert,
    )
    .await?;
    Ok(SystemGroupIds { admins, everyone })
}

/// `loadGroups`: system groups first, then by label.
pub async fn load_groups<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<Vec<GroupSummary>, AppError> {
    let rows = exec
        .rows(
            "SELECT r.id::text, r.label, r.name, r.is_system,
                    (SELECT count(*) FROM _basedb.role_member m
                       JOIN _basedb.app_user u ON u.id = m.user_id AND u.deleted_at IS NULL
                      WHERE m.role_id = r.id) AS members
               FROM _basedb.role r
               JOIN _basedb.tenant t ON t.id = r.tenant_id
              WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
              ORDER BY (r.name = $2) DESC, (r.name = $3) DESC, r.label",
            &[&ctx.tenant_id, &ADMINS, &EVERYONE],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| GroupSummary { id: r.get(0), label: r.get(1), system: system_of(r.get::<_, &str>(2), r.get(3)), member_count: r.get(4) })
        .collect())
}

/// `loadGroup`: a live group of the tenant, or `RESOURCE_NOT_FOUND {group}`.
pub async fn load_group<E: Exec + Sync>(exec: &E, ctx: &RequestContext, group_id: &Value) -> Result<Group, AppError> {
    let key = js_string(group_id);
    let row = exec
        .first(
            "SELECT r.id::text, r.label, r.name, r.is_system
               FROM _basedb.role r
               JOIN _basedb.tenant t ON t.id = r.tenant_id
              WHERE r.id::text = $1 AND t.ref = $2 AND r.kind = 'group' AND r.deleted_at IS NULL",
            &[&key, &ctx.tenant_id],
        )
        .await?;
    let Some(r) = row else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("group", group_id.clone())) };
    Ok(Group { id: r.get(0), label: r.get(1), system: system_of(r.get::<_, &str>(2), r.get(3)) })
}

async fn assert_label_free<E: Exec + Sync>(exec: &E, ctx: &RequestContext, label: &str, except: Option<&str>) -> Result<(), AppError> {
    let clash = exec
        .rows(
            "SELECT r.id FROM _basedb.role r
               JOIN _basedb.tenant t ON t.id = r.tenant_id
              WHERE t.ref = $1 AND r.label_key = $2 AND r.deleted_at IS NULL
                AND ($3::text::uuid IS NULL OR r.id <> $3::text::uuid)",
            &[&ctx.tenant_id, &label_key(label), &except],
        )
        .await?;
    if !clash.is_empty() {
        return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)));
    }
    Ok(())
}

/// The preamble of every write: administration, a recent elevation, the system groups.
pub async fn administer<E: Exec + Sync>(exec: &E, ctx: &RequestContext, session_id: &str) -> Result<SystemGroupIds, AppError> {
    require_administration(exec, ctx).await?;
    require_elevated_session(exec, ctx, session_id).await?;
    ensure_system_groups(exec, &ctx.tenant_id, &ctx.actor.id).await
}

/// `changeMembership`.
pub async fn change_membership<E: Exec + Sync>(exec: &E, ctx: &RequestContext, group: &Group, user_id: &str, member: bool) -> Result<(), AppError> {
    if group.system == Some("everyone") {
        return Err(AppError::new("GROUP_SYSTEM_IMMUTABLE"));
    }
    let row = exec
        .first(
            "SELECT u.id::text, u.display_name AS label FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE u.id::text = $1 AND t.ref = $2 AND u.deleted_at IS NULL",
            &[&user_id, &ctx.tenant_id],
        )
        .await?;
    let Some(row) = row else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("user", json!(user_id))) };
    let user: String = row.get(0);
    if member {
        exec.execute_op(
            "INSERT INTO _basedb.role_member (role_id, user_id, granted_by)
             VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid) ON CONFLICT DO NOTHING",
            &[&group.id, &user, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
    } else {
        if group.system == Some("admins") {
            assert_another_admin(exec, &group.id, &user).await?;
        }
        exec.execute_op("DELETE FROM _basedb.role_member WHERE role_id = $1::text::uuid AND user_id = $2::text::uuid", &[&group.id, &user], SqlOp::Delete).await?;
    }
    let action = if member { "group.member_add" } else { "group.member_remove" };
    audit(exec, ctx, action, "role", Some(&group.id), Some(&group.label), json!({ "user": user })).await
}

/// `assertAnotherAdmin`: `LAST_TENANT_ADMIN` when nobody else active is left.
pub async fn assert_another_admin<E: Exec + Sync>(exec: &E, admins_group_id: &str, user_id: &str) -> Result<(), AppError> {
    exec.rows("SELECT id FROM _basedb.role WHERE id = $1::text::uuid FOR UPDATE", &[&admins_group_id]).await?;
    let n: i64 = exec
        .first(
            "SELECT count(*) AS n FROM _basedb.role_member m
               JOIN _basedb.app_user u ON u.id = m.user_id
              WHERE m.role_id = $1::text::uuid AND m.user_id <> $2::text::uuid
                AND u.deleted_at IS NULL AND u.disabled_at IS NULL",
            &[&admins_group_id, &user_id],
        )
        .await?
        .map(|r| r.get(0))
        .unwrap_or(0);
    if n == 0 {
        return Err(AppError::new("LAST_TENANT_ADMIN"));
    }
    Ok(())
}

// ------------------------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------------------------

pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let c = &ctx;
    let groups = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        ensure_system_groups(&tx, &c.tenant_id, &c.actor.id).await?;
        load_groups(&tx, c).await
    })
    .await?;
    Ok(json_ok(json!({ "data": groups.iter().map(GroupSummary::json).collect::<Vec<_>>() })))
}

pub async fn create(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let label = check_label(text(fields(&body)?, "label").unwrap_or(""))?;
    let (c, s, l) = (&ctx, &session_id, &label);
    let group = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        administer(&tx, c, s).await?;
        assert_label_free(&tx, c, l, None).await?;
        let name = format!("groupe_{}", hex(&random_bytes(6)));
        let rows = tx
            .query_op(
                "INSERT INTO _basedb.role (tenant_id, label, label_key, name, kind, created_by)
                 SELECT t.id, $2, $3, $4, 'group', $5::text::uuid FROM _basedb.tenant t WHERE t.ref = $1
                 RETURNING id::text",
                &[&c.tenant_id, l, &label_key(l), &name, &c.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let id: String = rows[0].get(0);
        audit(&tx, c, "group.create", "role", Some(&id), Some(l), json!({})).await?;
        Ok(GroupSummary { id, label: l.clone(), system: None, member_count: 0 })
    })
    .await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": group.json() })))
}

pub async fn rename(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let label = check_label(text(fields(&body)?, "label").unwrap_or(""))?;
    let (c, s, l, gid) = (&ctx, &session_id, &label, &json!(id));
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        administer(&tx, c, s).await?;
        let group = load_group(&tx, c, gid).await?;
        if group.system.is_some() {
            return Err(AppError::new("GROUP_SYSTEM_IMMUTABLE"));
        }
        assert_label_free(&tx, c, l, Some(&group.id)).await?;
        tx.execute_op("UPDATE _basedb.role SET label = $2, label_key = $3 WHERE id = $1::text::uuid", &[&group.id, l, &label_key(l)], SqlOp::Update).await?;
        audit(&tx, c, "group.rename", "role", Some(&group.id), Some(l), json!({ "previous": group.label })).await
    })
    .await?;
    Ok(json_ok(json!({ "data": { "label": label } })))
}

pub async fn remove(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let (c, s, gid) = (&ctx, &session_id, &json!(id));
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        administer(&tx, c, s).await?;
        let group = load_group(&tx, c, gid).await?;
        if group.system.is_some() {
            return Err(AppError::new("GROUP_SYSTEM_IMMUTABLE"));
        }
        tx.execute_op(
            "UPDATE _basedb.role SET deleted_at = clock_timestamp(), deleted_by = $2::text::uuid WHERE id = $1::text::uuid",
            &[&group.id, &c.actor.id],
            SqlOp::Update,
        )
        .await?;
        audit(&tx, c, "group.delete", "role", Some(&group.id), Some(&group.label), json!({})).await
    })
    .await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

pub async fn members(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (c, gid) = (&ctx, &json!(id));
    let rows = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        let group = load_group(&tx, c, gid).await?;
        let rows = tx
            .rows(
                "SELECT u.id::text, u.email, u.display_name
                   FROM _basedb.role_member m
                   JOIN _basedb.app_user u ON u.id = m.user_id AND u.deleted_at IS NULL
                  WHERE m.role_id = $1::text::uuid
                  ORDER BY u.display_name, u.email",
                &[&group.id],
            )
            .await?;
        Ok(rows.iter().map(|r| json!({ "id": r.get::<_, String>(0), "email": r.get::<_, String>(1), "display_name": r.get::<_, String>(2) })).collect::<Vec<_>>())
    })
    .await?;
    Ok(json_ok(json!({ "data": rows })))
}

async fn membership(st: Shared, rid: RequestId, headers: HeaderMap, tenant: String, group: String, user: String, member: bool) -> ApiResult {
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let (c, s, gid, u) = (&ctx, &session_id, &json!(group), &user);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        administer(&tx, c, s).await?;
        let group = load_group(&tx, c, gid).await?;
        change_membership(&tx, c, &group, u, member).await
    })
    .await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

pub async fn add_member(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, group, user)): Path<(String, String, String)>) -> ApiResult {
    membership(st, rid, headers, tenant, group, user, true).await
}

pub async fn remove_member(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, group, user)): Path<(String, String, String)>) -> ApiResult {
    membership(st, rid, headers, tenant, group, user, false).await
}
