//! `admin/sharing.ts`: sharing a project or a base — invitations, people, acceptance.

use crate::access::{apply_level, key, load_level_grants, load_tree, locate, max, rank, AccessProject, Level, Levels};
use crate::common::{audit, fields, fr_cmp, iso, js_len, js_trim, lenient_json, valid_email};
use crate::sealing::{seal, unseal};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::{load_base_target, load_project_target, require_action};
use basedb_base::time::{b64url, random_bytes, sha256};
use basedb_base::tx::{with_transaction, Actor, ActorKind, RequestContext, TxOptions};
use basedb_base::Shared;
use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};

const SHARE_LEVELS: [Level; 3] = ["read", "edit", "manage"];
const INVITATION_DAYS: i32 = 7;
const SEAL_PURPOSE: &str = "invitation";

#[derive(Debug, Clone)]
pub struct Scope {
    pub kind: &'static str,
    pub id: String,
}

pub struct Where {
    pub project: AccessProject,
    pub path: Vec<String>,
    pub label: String,
}

fn check_level(level: Option<&Value>, allow_none: bool) -> Result<Level, AppError> {
    let found = level.and_then(Value::as_str).and_then(|l| {
        if allow_none && l == "none" {
            return Some("none");
        }
        SHARE_LEVELS.iter().copied().find(|s| *s == l)
    });
    found.ok_or_else(|| AppError::new("REQUEST_INVALID").with("field", json!("level")))
}

fn detail(kind: &str, id: &str) -> Map<String, Value> {
    let mut m = Map::new();
    m.insert(kind.to_string(), json!(id));
    m
}

/// `requireSharing`: the actor manages the scope; the scope placed in its project.
async fn require_sharing<E: Exec + Sync>(exec: &E, ctx: &RequestContext, scope: &Scope) -> Result<Where, AppError> {
    if ctx.actor.kind != ActorKind::User {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let target = if scope.kind == "project" { load_project_target(exec, ctx, &scope.id).await? } else { load_base_target(exec, ctx, &scope.id).await? };
    require_action(exec, ctx, Action::ManageSchema, target, detail(scope.kind, &scope.id)).await?;
    placed(exec, ctx, scope).await
}

async fn placed<E: Exec + Sync>(exec: &E, ctx: &RequestContext, scope: &Scope) -> Result<Where, AppError> {
    let tree = load_tree(exec, ctx).await?;
    let Some((project, path)) = locate(&tree, scope.kind, &scope.id) else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").details(Value::Object(detail(scope.kind, &scope.id))));
    };
    let last = path.last().cloned().unwrap_or_default();
    let label = if scope.kind == "project" {
        project.label.clone()
    } else {
        project.bases.iter().find(|b| key("base", &b.id) == last).map(|b| b.label.clone()).unwrap_or_default()
    };
    Ok(Where { project: project.clone(), path, label })
}

/// `personalRole`: the person's own role, created on first use.
pub async fn personal_role<E: Exec + Sync>(exec: &E, ctx: &RequestContext, user_id: &str) -> Result<String, AppError> {
    if let Some(r) = exec
        .first(
            "SELECT r.id::text FROM _basedb.role r
               JOIN _basedb.role_member m ON m.role_id = r.id
              WHERE r.kind = 'person' AND m.user_id = $1::text::uuid AND r.deleted_at IS NULL",
            &[&user_id],
        )
        .await?
    {
        return Ok(r.get(0));
    }
    let rows = exec
        .query_op(
            "INSERT INTO _basedb.role (tenant_id, label, label_key, name, is_system, kind, created_by)
             SELECT u.tenant_id, 'Accès de ' || u.display_name, '#person:' || u.id::text,
                    'person_' || replace(u.id::text, '-', ''), true, 'person', $2::text::uuid
               FROM _basedb.app_user u WHERE u.id = $1::text::uuid
             RETURNING id::text",
            &[&user_id, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
    let role: String = rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("rôle personnel non créé"))?;
    exec.execute_op(
        "INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid)",
        &[&role, &user_id, &ctx.actor.id],
        SqlOp::Insert,
    )
    .await?;
    Ok(role)
}

fn is_under(w: &Where, node_key: &str) -> bool {
    let node = w.path.last().map(String::as_str).unwrap_or("");
    if node.starts_with("project:") {
        return w.project.bases.iter().any(|b| key("base", &b.id) == node_key || b.tables.iter().any(|t| key("table", &t.id) == node_key));
    }
    w.project.bases.iter().find(|b| key("base", &b.id) == node).is_some_and(|b| b.tables.iter().any(|t| key("table", &t.id) == node_key))
}

/// `levelAt`: a role's level on the scope's node, and whether it comes from the project.
fn level_at(w: &Where, levels: Option<&Levels>) -> Option<(&'static str, &'static str)> {
    let levels = levels?;
    let node = w.path.last().cloned().unwrap_or_default();
    let project_key = key("project", &w.project.id);
    let from_project = levels.get(&project_key).copied().unwrap_or("none");
    let mut effective = "none";
    for n in &w.path {
        effective = max(effective, levels.get(n).copied().unwrap_or("none"));
    }
    if effective != "none" {
        let from = if node != project_key && from_project == effective { "project" } else { "here" };
        return Some((effective, from));
    }
    levels.keys().any(|k| *k != node && is_under(w, k)).then_some(("granular", "here"))
}

async fn sharing_of<E: Exec + Sync>(exec: &E, ctx: &RequestContext, instance_key: &str, scope: &Scope, w: &Where) -> Result<Value, AppError> {
    let personal = load_level_grants(exec, ctx, "person").await?;
    let role_ids: Vec<String> = personal.keys().cloned().collect();
    let owners = exec
        .rows(
            "SELECT r.id::text AS role_id, u.id::text AS user_id, u.display_name, u.email
               FROM _basedb.role r
               JOIN _basedb.role_member m ON m.role_id = r.id
               JOIN _basedb.app_user u    ON u.id = m.user_id AND u.deleted_at IS NULL
              WHERE r.kind = 'person' AND r.deleted_at IS NULL AND r.id = ANY($1::text[]::uuid[])",
            &[&role_ids],
        )
        .await?;
    let mut people: Vec<(String, Value)> = Vec::new();
    for o in &owners {
        let role: String = o.get(0);
        let Some((level, from)) = level_at(w, personal.get(&role)) else { continue };
        let user: String = o.get(1);
        let name: String = o.get(2);
        let you = user == ctx.actor.id;
        people.push((name.clone(), json!({ "user_id": user, "display_name": name, "email": o.get::<_, String>(3), "level": level, "from": from, "you": you })));
    }
    people.sort_by(|a, b| fr_cmp(&a.0, &b.0));

    let grouped = load_level_grants(exec, ctx, "group").await?;
    let group_ids: Vec<String> = grouped.keys().cloned().collect();
    let labels = exec
        .rows(
            "SELECT r.id::text, r.label FROM _basedb.role r
              WHERE r.kind = 'group' AND r.deleted_at IS NULL AND r.id = ANY($1::text[]::uuid[])
              ORDER BY r.label",
            &[&group_ids],
        )
        .await?;
    let mut groups = Vec::new();
    for g in &labels {
        let id: String = g.get(0);
        if let Some((level, _)) = level_at(w, grouped.get(&id)) {
            groups.push(json!({ "id": id, "label": g.get::<_, String>(1), "level": level }));
        }
    }

    let rows = exec
        .rows(
            "SELECT i.id::text, i.email, i.level, i.expires_at, u.display_name AS invited_by, i.token_sealed
               FROM _basedb.invitation i
               JOIN _basedb.app_user u ON u.id = i.created_by
              WHERE (i.scope_project_id = $1::text::uuid OR i.scope_base_id = $1::text::uuid)
                AND i.accepted_at IS NULL AND i.revoked_at IS NULL
                AND i.expires_at > clock_timestamp()
              ORDER BY i.created_at",
            &[&scope.id],
        )
        .await?;
    let invitations: Vec<Value> = rows
        .iter()
        .filter_map(|r| {
            let sealed: String = r.get(5);
            let token = unseal(instance_key, SEAL_PURPOSE, &sealed)?;
            Some(json!({
                "id": r.get::<_, String>(0),
                "email": r.get::<_, String>(1),
                "level": r.get::<_, String>(2),
                "expires_at": iso(r.get(3)),
                "invited_by": r.get::<_, String>(4),
                "token": token,
            }))
        })
        .collect();

    Ok(json!({
        "scope": { "kind": scope.kind, "id": scope.id, "label": w.label },
        "people": people.into_iter().map(|(_, p)| p).collect::<Vec<_>>(),
        "groups": groups,
        "invitations": invitations,
    }))
}

/// app.ts's `shareScope`.
fn share_scope(kind: &str, id: String) -> Result<Scope, AppError> {
    match kind {
        "project" => Ok(Scope { kind: "project", id }),
        "base" => Ok(Scope { kind: "base", id }),
        _ => Err(AppError::new("RESOURCE_NOT_FOUND").with("scope", json!(kind))),
    }
}

pub async fn get_sharing(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, kind, id)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let scope = share_scope(&kind, id)?;
    let key = st.instance_key()?.to_string();
    let (c, s, k) = (&ctx, &scope, &key);
    let sharing = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let w = require_sharing(&tx, c, s).await?;
        sharing_of(&tx, c, k, s, &w).await
    })
    .await?;
    Ok(json_ok(json!({ "data": sharing })))
}

pub async fn invite(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, kind, id)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let scope = share_scope(&kind, id)?;
    let body = fields(&body)?;
    let raw_email = body.get("email").and_then(Value::as_str).unwrap_or("");
    let level = check_level(body.get("level"), false)?;
    let email = js_trim(raw_email).to_string();
    if !valid_email(&email) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("email")));
    }
    let key = st.instance_key()?.to_string();
    let (c, s, k, e) = (&ctx, &scope, &key, &email);
    let invitation = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let w = require_sharing(&tx, c, s).await?;
        let token = b64url(&random_bytes(24));
        let (p, b) = ((s.kind == "project").then_some(s.id.as_str()), (s.kind == "base").then_some(s.id.as_str()));
        let rows = tx
            .query_op(
                "INSERT INTO _basedb.invitation
                   (tenant_id, scope_kind, scope_project_id, scope_base_id, level, email,
                    token_hash, token_sealed, expires_at, created_by)
                 SELECT t.id, $2, $3::text::uuid, $4::text::uuid, $5, $6, $7, $8,
                        clock_timestamp() + make_interval(days => $9), $10::text::uuid
                   FROM _basedb.tenant t WHERE t.ref = $1
                 RETURNING id::text, expires_at",
                &[&c.tenant_id, &s.kind, &p, &b, &level, e, &sha256(token.as_bytes()), &seal(k, SEAL_PURPOSE, &token), &INVITATION_DAYS, &c.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let row = rows.first().ok_or_else(|| AppError::internal("invitation non créée"))?;
        let (inv_id, expires): (String, DateTime<Utc>) = (row.get(0), row.get(1));
        audit(&tx, c, "invitation.create", s.kind, Some(&s.id), Some(&w.label), json!({ "email": e, "level": level })).await?;
        let me: String = tx.first("SELECT display_name FROM _basedb.app_user WHERE id = $1::text::uuid", &[&c.actor.id]).await?.map(|r| r.get(0)).unwrap_or_default();
        Ok(json!({ "id": inv_id, "email": e, "level": level, "expires_at": iso(expires), "invited_by": me, "token": token }))
    })
    .await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": invitation })))
}

pub async fn revoke(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (c, inv) = (&ctx, &id);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let row = tx
            .first(
                "SELECT i.scope_kind, coalesce(i.scope_project_id, i.scope_base_id)::text AS scope_id,
                        i.email
                   FROM _basedb.invitation i
                   JOIN _basedb.tenant t ON t.id = i.tenant_id
                  WHERE i.id::text = $1 AND t.ref = $2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL",
                &[inv, &c.tenant_id],
            )
            .await?;
        let Some(row) = row else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("invitation", json!(inv))) };
        let kind: String = row.get(0);
        let scope = Scope { kind: if kind == "project" { "project" } else { "base" }, id: row.get(1) };
        let email: String = row.get(2);
        let w = require_sharing(&tx, c, &scope).await?;
        tx.execute_op("UPDATE _basedb.invitation SET revoked_at = clock_timestamp() WHERE id::text = $1", &[inv], SqlOp::Update).await?;
        audit(&tx, c, "invitation.revoke", scope.kind, Some(&scope.id), Some(&w.label), json!({ "email": email })).await
    })
    .await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

pub async fn set_person(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, kind, id, user)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let scope = share_scope(&kind, id)?;
    let level = check_level(fields(&body)?.get("level"), true)?;
    if user == ctx.actor.id {
        return Err(AppError::new("ACTION_FORBIDDEN").with("reason", json!("son_propre_acces")));
    }
    let key = st.instance_key()?.to_string();
    let (c, s, k, u) = (&ctx, &scope, &key, &user);
    let sharing = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let w = require_sharing(&tx, c, s).await?;
        let personal = load_level_grants(&tx, c, "person").await?;
        let owner = tx
            .first(
                "SELECT r.id::text AS role_id, u.display_name
                   FROM _basedb.role r
                   JOIN _basedb.role_member m ON m.role_id = r.id
                   JOIN _basedb.app_user u    ON u.id = m.user_id
                   JOIN _basedb.tenant t      ON t.id = u.tenant_id
                  WHERE r.kind = 'person' AND r.deleted_at IS NULL AND u.id::text = $1 AND t.ref = $2",
                &[u, &c.tenant_id],
            )
            .await?;
        let role: Option<String> = owner.map(|o| o.get(0));
        let levels = role.as_ref().and_then(|r| personal.get(r));
        let at = level_at(&w, levels);
        let (Some(role), Some(levels), Some(at)) = (role.clone(), levels, at) else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("user", json!(u)));
        };
        if at.1 == "project" {
            return Err(AppError::new("ACTION_FORBIDDEN").with("reason", json!("herite")));
        }
        let mut mine = levels.clone();
        apply_level(&w.project, &w.path, level, &mut mine);
        crate::access::write_levels(&tx, c, &w.project, &role, &mine).await?;
        audit(&tx, c, "share.set", s.kind, Some(&s.id), Some(&w.label), json!({ "user": u, "level": level })).await?;
        sharing_of(&tx, c, k, s, &w).await
    })
    .await?;
    Ok(json_ok(json!({ "data": sharing })))
}

pub struct InvitationRow {
    pub id: String,
    pub scope_kind: String,
    pub scope_id: String,
    pub level: String,
    pub email: String,
    pub expires_at: DateTime<Utc>,
    pub accepted_by: Option<String>,
    pub created_by: String,
    pub invited_by: String,
}

/// `findInvitation`: a pending, unexpired invitation of the tenant, by its secret.
pub async fn find_invitation<E: Exec + Sync>(exec: &E, tenant_ref: &str, token: &str, lock: bool, accepted_by: Option<&str>) -> Result<Option<InvitationRow>, AppError> {
    let n = js_len(token);
    if !(16..=128).contains(&n) {
        return Ok(None);
    }
    let sql = format!(
        "SELECT i.id::text, i.scope_kind, coalesce(i.scope_project_id, i.scope_base_id)::text AS scope_id,
                i.level, i.email, i.expires_at, i.accepted_by::text, i.created_by::text,
                u.display_name AS invited_by
           FROM _basedb.invitation i
           JOIN _basedb.tenant t   ON t.id = i.tenant_id
           JOIN _basedb.app_user u ON u.id = i.created_by
          WHERE i.token_hash = $1 AND t.ref = $2 AND i.revoked_at IS NULL
            AND i.expires_at > clock_timestamp()
            AND (i.accepted_at IS NULL OR i.accepted_by::text = $3)
          {}",
        if lock { "FOR UPDATE OF i" } else { "" }
    );
    let row = exec.first(&sql, &[&sha256(token.as_bytes()), &tenant_ref, &accepted_by]).await?;
    Ok(row.map(|r| InvitationRow {
        id: r.get(0),
        scope_kind: r.get(1),
        scope_id: r.get(2),
        level: r.get(3),
        email: r.get(4),
        expires_at: r.get(5),
        accepted_by: r.get(6),
        created_by: r.get(7),
        invited_by: r.get(8),
    }))
}

/// `invitationPreview`, serialized as `POST /auth/invitation` answers it.
pub async fn invitation_preview<E: Exec + Sync>(exec: &E, tenant_ref: &str, token: &str) -> Result<Value, AppError> {
    let row = find_invitation(exec, tenant_ref, token, false, None).await?;
    let Some(row) = row.filter(|r| r.accepted_by.is_none()) else { return Err(AppError::new("RESOURCE_NOT_FOUND")) };
    let sql = if row.scope_kind == "project" {
        "SELECT p.label, p.label AS project FROM _basedb.project p
          WHERE p.id::text = $1 AND p.deleted_at IS NULL"
    } else {
        "SELECT b.label, p.label AS project
           FROM _basedb.base b JOIN _basedb.project p ON p.id = b.project_id
          WHERE b.id::text = $1 AND b.deleted_at IS NULL AND b.is_live"
    };
    let Some(labels) = exec.first(sql, &[&row.scope_id]).await? else { return Err(AppError::new("RESOURCE_NOT_FOUND")) };
    Ok(json!({
        "scope": { "kind": row.scope_kind, "label": labels.get::<_, String>(0) },
        "project": labels.get::<_, String>(1),
        "level": row.level,
        "email": row.email,
        "invited_by": row.invited_by,
        "expires_at": iso(row.expires_at),
    }))
}

pub async fn accept(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let token = fields(&body)?.get("token").and_then(Value::as_str).unwrap_or("").to_string();
    if ctx.actor.kind != ActorKind::User {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let (c, t) = (&ctx, &token);
    let accepted = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let Some(row) = find_invitation(&tx, &c.tenant_id, t, true, Some(&c.actor.id)).await? else {
            return Err(AppError::new("RESOURCE_NOT_FOUND"));
        };
        let scope = Scope { kind: if row.scope_kind == "project" { "project" } else { "base" }, id: row.scope_id.clone() };
        let mut inviter = c.clone();
        inviter.actor = Actor::user(row.created_by.clone());
        let target = if scope.kind == "project" { load_project_target(&tx, &inviter, &scope.id).await? } else { load_base_target(&tx, &inviter, &scope.id).await? };
        let grants = load_grants(&tx, &inviter).await?;
        let allowed = target.as_ref().is_some_and(|t| decide(&inviter, &grants, Action::ManageSchema, t).verdict == Verdict::Allowed);
        if !allowed {
            return Err(AppError::new("RESOURCE_NOT_FOUND"));
        }
        let w = placed(&tx, c, &scope).await?;
        if row.accepted_by.is_none() {
            let role = personal_role(&tx, c, &c.actor.id).await?;
            let personal = load_level_grants(&tx, c, "person").await?;
            let mut mine = personal.get(&role).cloned().unwrap_or_default();
            let mut held = "none";
            for node in &w.path {
                held = max(held, mine.get(node).copied().unwrap_or("none"));
            }
            if rank(&row.level) > rank(held) {
                let level = crate::access::as_level(&row.level).unwrap_or("none");
                apply_level(&w.project, &w.path, level, &mut mine);
                crate::access::write_levels(&tx, c, &w.project, &role, &mine).await?;
            }
            tx.execute_op(
                "UPDATE _basedb.invitation SET accepted_at = clock_timestamp(), accepted_by = $2::text::uuid
                  WHERE id = $1::text::uuid",
                &[&row.id, &c.actor.id],
                SqlOp::Update,
            )
            .await?;
            audit(&tx, c, "invitation.accept", scope.kind, Some(&scope.id), Some(&w.label), json!({ "level": row.level })).await?;
        }
        Ok(json!({ "project_id": w.project.id, "base_id": if scope.kind == "base" { json!(scope.id) } else { Value::Null } }))
    })
    .await?;
    Ok(json_ok(json!({ "data": accepted })))
}
