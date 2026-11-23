//! Exiger un droit — la forme unique de chaque contrôle d'une opération de structure ou
//! d'administration (chapitre 05 §3.2, §8), tel `rbac/require.ts`.
//!
//! Une cible invisible répond `RESOURCE_NOT_FOUND`, exactement comme une cible absente ; une
//! cible visible mais pas permise répond `ADMIN_REQUIRED`.

use super::decide::*;
use super::loader::{load_grants, load_target};
use crate::db::Exec;
use crate::error::AppError;
use crate::tx::{ActorKind, RequestContext};
use serde_json::{json, Map, Value};

/// `loadBaseTarget`: a live base of the tenant, or `None`.
pub async fn load_base_target<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> Result<Option<Target>, AppError> {
    let row = exec
        .first(
            "SELECT b.id::text, b.project_id::text, b.mcp_enabled
               FROM _basedb.base b
               JOIN _basedb.tenant t ON t.id = b.tenant_id
              WHERE b.id::text = $1 AND t.ref = $2 AND b.is_live AND b.deleted_at IS NULL",
            &[&base_id, &ctx.tenant_id],
        )
        .await?;
    Ok(row.map(|r| {
        let id: String = r.get(0);
        let mut t = Target::new(TargetKind::Base, id.clone(), Some(ctx.tenant_id.clone()));
        t.project_id = r.get(1);
        t.base_id = Some(id);
        t.agents_excluded = !r.get::<_, bool>(2);
        t
    }))
}

/// `loadProjectTarget`: a live project of the tenant, or `None`.
pub async fn load_project_target<E: Exec + Sync>(exec: &E, ctx: &RequestContext, project_id: &str) -> Result<Option<Target>, AppError> {
    let row = exec
        .first(
            "SELECT p.id::text
               FROM _basedb.project p
               JOIN _basedb.tenant t ON t.id = p.tenant_id
              WHERE p.id::text = $1 AND t.ref = $2 AND p.deleted_at IS NULL",
            &[&project_id, &ctx.tenant_id],
        )
        .await?;
    Ok(row.map(|r| {
        let id: String = r.get(0);
        let mut t = Target::new(TargetKind::Project, id.clone(), Some(ctx.tenant_id.clone()));
        t.project_id = Some(id);
        t
    }))
}

/// `tenantTarget`.
pub fn tenant_target(ctx: &RequestContext) -> Target {
    Target::new(TargetKind::Tenant, ctx.tenant_id.clone(), Some(ctx.tenant_id.clone()))
}

fn with_action(details: &Map<String, Value>, action: Action) -> Value {
    let mut d = details.clone();
    d.insert("action".into(), json!(action.as_str()));
    Value::Object(d)
}

/// `requireAction`: demands `action` on `target`, returns the grants it was decided on.
pub async fn require_action<E: Exec + Sync>(
    exec: &E,
    ctx: &RequestContext,
    action: Action,
    target: Option<Target>,
    details: Map<String, Value>,
) -> Result<ActorGrants, AppError> {
    let grants = load_grants(exec, ctx).await?;
    let Some(target) = target else { return Err(AppError::new("RESOURCE_NOT_FOUND").details(Value::Object(details))) };
    let decision = decide(ctx, &grants, action, &target);
    match decision.verdict {
        Verdict::Invisible => {
            if visible_inside(exec, ctx, &grants, &target).await? {
                return Err(AppError::new("ADMIN_REQUIRED").details(with_action(&details, action)));
            }
            Err(AppError::new("RESOURCE_NOT_FOUND").details(Value::Object(details)))
        }
        Verdict::Forbidden => Err(AppError::new("ADMIN_REQUIRED").details(with_action(&details, action))),
        Verdict::Allowed => Ok(grants),
    }
}

/// `visibleInside`: the actor reads at least one table of a base or project.
pub async fn visible_inside<E: Exec + Sync>(exec: &E, ctx: &RequestContext, grants: &ActorGrants, target: &Target) -> Result<bool, AppError> {
    let sql = match target.kind {
        TargetKind::Base => "SELECT id::text FROM _basedb.table_def WHERE base_id = $1::text::uuid AND is_live AND deleted_at IS NULL",
        TargetKind::Project => {
            "SELECT t.id::text FROM _basedb.table_def t
               JOIN _basedb.base b ON b.id = t.base_id
              WHERE b.project_id = $1::text::uuid AND t.is_live AND t.deleted_at IS NULL AND b.is_live"
        }
        _ => return Ok(false),
    };
    for table in exec.rows(sql, &[&target.id]).await? {
        let id: String = table.get(0);
        if let Some(t) = load_target(exec, ctx, &id).await? {
            if decide(ctx, grants, Action::Read, &t).verdict == Verdict::Allowed {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn detail(key: &str, value: &str) -> Map<String, Value> {
    let mut m = Map::new();
    m.insert(key.into(), json!(value));
    m
}

/// `requireOnTable`.
pub async fn require_on_table<E: Exec + Sync>(exec: &E, ctx: &RequestContext, action: Action, table_id: &str) -> Result<ActorGrants, AppError> {
    let target = load_target(exec, ctx, table_id).await?;
    require_action(exec, ctx, action, target, detail("table", table_id)).await
}

/// `requireOnBase`.
pub async fn require_on_base<E: Exec + Sync>(exec: &E, ctx: &RequestContext, action: Action, base_id: &str) -> Result<ActorGrants, AppError> {
    let target = load_base_target(exec, ctx, base_id).await?;
    require_action(exec, ctx, action, target, detail("base", base_id)).await
}

/// `administers`: `manage_permissions` at tenant scope.
pub fn administers(ctx: &RequestContext, grants: &ActorGrants) -> bool {
    decide(ctx, grants, Action::ManagePermissions, &tenant_target(ctx)).verdict == Verdict::Allowed
}

/// `requireAdministration`: refused as an absence.
pub async fn require_administration<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<ActorGrants, AppError> {
    let grants = load_grants(exec, ctx).await?;
    if ctx.actor.kind != ActorKind::User || !administers(ctx, &grants) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    Ok(grants)
}

/// `requireOnField`: on the table the field belongs to.
pub async fn require_on_field<E: Exec + Sync>(exec: &E, ctx: &RequestContext, action: Action, field_id: &str) -> Result<ActorGrants, AppError> {
    let row = exec.first("SELECT table_id::text FROM _basedb.field WHERE id::text = $1 AND is_live", &[&field_id]).await?;
    let Some(row) = row else {
        load_grants(exec, ctx).await?;
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
    };
    let table_id: String = row.get(0);
    let target = load_target(exec, ctx, &table_id).await?;
    require_action(exec, ctx, action, target, detail("field", field_id)).await
}
