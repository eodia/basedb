//! The life of a base and its tables (`catalog/lifecycle.ts`, `catalog/purge.ts`,
//! `catalog/physical.ts`): the administration role, and what was deleted.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Verdict, TENANT_SCOPE};
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::{load_base_target, visible_inside};
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use basedb_base::time::iso;
use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Value};

type R<T> = Result<T, AppError>;

/// `PURGE_DELAY_DAYS`: a deleted object may be purged thirty days after.
pub const PURGE_DELAY_DAYS: i64 = 30;

/// `isAdministration`: `is_instance_admin`, or `manage_schema` of tenant scope. A
/// `manage_schema` of lower scope never allows a physical rename, an alias drop or a purge.
pub fn is_administration(grants: &ActorGrants) -> bool {
    grants.is_instance_admin
        || grants.roles.iter().any(|role| {
            role.permissions.iter().any(|p| p.action == Action::ManageSchema && p.scope_kind == basedb_base::rbac::decide::ScopeKind::Tenant && p.scope_id == TENANT_SCOPE)
        })
}

/// `assertAdministration`.
pub fn assert_administration(grants: &ActorGrants, base_id: &str) -> R<()> {
    if is_administration(grants) {
        return Ok(());
    }
    Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)))
}

/// `assertManageSchema`: `manage_schema` at any scope covering the base.
pub async fn assert_manage_schema<E: Exec + Sync>(exec: &E, ctx: &RequestContext, grants: &ActorGrants, base_id: &str) -> R<()> {
    if is_administration(grants) {
        return Ok(());
    }
    let target = load_base_target(exec, ctx, base_id).await?;
    let verdict = match &target {
        None => Verdict::Invisible,
        Some(t) => decide(ctx, grants, Action::ManageSchema, t).verdict,
    };
    if verdict == Verdict::Allowed {
        return Ok(());
    }
    let visible = verdict == Verdict::Forbidden
        || match &target {
            Some(t) => visible_inside(exec, ctx, grants, t).await?,
            None => false,
        };
    Err(AppError::new(if visible { "ADMIN_REQUIRED" } else { "RESOURCE_NOT_FOUND" }).with("base", json!(base_id)))
}

/// `requireLifecycleAdmin` (`physical.ts`): a person with the administration role.
pub async fn require_lifecycle_admin<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<ActorGrants> {
    let grants = load_grants(exec, ctx).await?;
    if ctx.actor.kind == ActorKind::User && is_administration(&grants) {
        return Ok(grants);
    }
    let target = load_base_target(exec, ctx, base_id).await?;
    let visible = match &target {
        None => false,
        Some(t) => decide(ctx, &grants, Action::Read, t).verdict == Verdict::Allowed || visible_inside(exec, ctx, &grants, t).await?,
    };
    Err(AppError::new(if visible { "ADMIN_REQUIRED" } else { "RESOURCE_NOT_FOUND" }).with("base", json!(base_id)))
}

/// `listDeletedBases`, as `GET /admin/bases/deleted` publishes it: the administration
/// role only — anyone else gets an empty list.
pub async fn list_deleted_bases(pools: &Pools, ctx: &RequestContext) -> R<Vec<Value>> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        if !is_administration(&grants) {
            return Ok(Vec::new());
        }
        let rows = tx
            .rows(
                "SELECT b.id::text, n.name, b.label, b.deleted_at,
                        (SELECT count(*) FROM _basedb.table_def t
                          WHERE t.base_id = b.id AND t.is_purged = false) AS table_count
                   FROM _basedb.base b
                   JOIN _basedb.tenant t     ON t.id = b.tenant_id
                   JOIN _basedb.db_schema s  ON s.base_id = b.id AND s.role = 'current'
                   JOIN _basedb.physical_name n ON n.id = s.name_id
                  WHERE t.ref = $1::text AND b.deleted_at IS NOT NULL AND b.is_purged = false
                  ORDER BY b.deleted_at DESC",
                &[&ctx.tenant_id],
            )
            .await?;
        Ok(rows
            .iter()
            .map(|r| {
                let deleted_at: DateTime<Utc> = r.get(3);
                json!({
                    "id": r.get::<_, String>(0),
                    "name": r.get::<_, String>(1),
                    "label": r.get::<_, String>(2),
                    "deleted_at": iso(deleted_at),
                    "table_count": r.get::<_, i64>(4),
                })
            })
            .collect())
    })
    .await
}

/// `listDeletedTables`, as `GET /admin/bases/:base/deleted-tables` publishes it.
pub async fn list_deleted_tables(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Vec<Value>> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_lifecycle_admin(&tx, ctx, base_id).await?;
        let rows = tx
            .rows(
                "SELECT t.id::text, t.label, n.name, t.deleted_at, u.display_name AS deleted_by
                   FROM _basedb.table_def t
                   JOIN _basedb.physical_name n ON n.id = t.name_id
                   JOIN _basedb.base b          ON b.id = t.base_id AND b.is_live
                   JOIN _basedb.tenant te       ON te.id = b.tenant_id
                   LEFT JOIN _basedb.app_user u ON u.id = t.deleted_by
                  WHERE t.base_id = $1::text::uuid AND te.ref = $2::text AND t.deleted_at IS NOT NULL AND NOT t.is_purged
                  ORDER BY t.deleted_at DESC",
                &[&base_id, &ctx.tenant_id],
            )
            .await?;
        Ok(rows
            .iter()
            .map(|r| {
                let deleted_at: DateTime<Utc> = r.get(3);
                let deleted_at = basedb_base::time::from_ms(deleted_at.timestamp_millis());
                json!({
                    "id": r.get::<_, String>(0),
                    "label": r.get::<_, String>(1),
                    "name": r.get::<_, String>(2),
                    "deleted_at": iso(deleted_at),
                    "deleted_by": r.get::<_, Option<String>>(4),
                    "purgeable_from": iso(deleted_at + Duration::days(PURGE_DELAY_DAYS)),
                })
            })
            .collect())
    })
    .await
}
