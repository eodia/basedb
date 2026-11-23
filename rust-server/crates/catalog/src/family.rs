//! The environments of a base (`environments/family.ts`): one lineage, several bases.

use crate::http::label_key;
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_base;
use basedb_base::time::iso;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};

type R<T> = Result<T, AppError>;

/// `MAX_ENVIRONMENT_CHARS`.
pub const MAX_ENVIRONMENT_CHARS: usize = 60;

/// `EnvironmentSummary`.
#[derive(Debug, Clone)]
pub struct EnvironmentSummary {
    pub id: String,
    pub name: String,
    pub environment: String,
    pub production: bool,
    pub position: i32,
    pub table_count: i32,
    pub created_at: DateTime<Utc>,
    pub forked_from: Option<String>,
}

impl EnvironmentSummary {
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "environment": self.environment,
            "production": self.production,
            "position": self.position,
            "tableCount": self.table_count,
            "createdAt": iso(self.created_at),
            "forkedFrom": self.forked_from,
        })
    }
}

/// `Family`.
#[derive(Debug, Clone)]
pub struct Family {
    pub lineage_id: String,
    pub project_id: String,
    pub label: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    pub mcp_enabled: bool,
    pub environments: Vec<EnvironmentSummary>,
}

impl Family {
    pub fn to_json(&self) -> Value {
        json!({
            "lineageId": self.lineage_id,
            "projectId": self.project_id,
            "label": self.label,
            "description": self.description,
            "color": self.color,
            "icon": self.icon,
            "image": self.image,
            "mcpEnabled": self.mcp_enabled,
            "environments": self.environments.iter().map(EnvironmentSummary::to_json).collect::<Vec<_>>(),
        })
    }
}

/// `loadFamily`.
pub async fn load_family<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<Family> {
    let rows = exec
        .rows(
            "SELECT b.id::text, sn.name, b.label, b.description, b.color, b.icon, b.image, b.mcp_enabled,
                    b.project_id::text, b.lineage_id::text, b.environment, b.is_production,
                    b.environment_position::int, b.created_at, b.forked_from_base_id::text,
                    (SELECT count(*) FROM _basedb.table_def t
                      WHERE t.base_id = b.id AND t.deleted_at IS NULL)::int AS table_count
               FROM _basedb.base b
               JOIN _basedb.tenant te        ON te.id = b.tenant_id
               JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                            AND s.dropped_at IS NULL
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE te.ref = $2 AND b.deleted_at IS NULL
                AND b.lineage_id = (SELECT x.lineage_id FROM _basedb.base x WHERE x.id::text = $1)
              ORDER BY NOT b.is_production, b.environment_position, b.created_at",
            &[&base_id, &ctx.tenant_id],
        )
        .await?;
    let Some(self_row) = rows.iter().find(|r| r.get::<_, String>(0) == base_id) else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)));
    };
    let head = rows.iter().find(|r| r.get::<_, bool>(11)).unwrap_or(self_row);
    Ok(Family {
        lineage_id: self_row.get(9),
        project_id: head.get(8),
        label: head.get(2),
        description: head.get(3),
        color: head.get(4),
        icon: head.get(5),
        image: head.get(6),
        mcp_enabled: head.get(7),
        environments: rows
            .iter()
            .map(|r| EnvironmentSummary {
                id: r.get(0),
                name: r.get(1),
                environment: r.get(10),
                production: r.get(11),
                position: r.get(12),
                table_count: r.get(15),
                created_at: r.get(13),
                forked_from: r.get(14),
            })
            .collect(),
    })
}

/// `loadPair`: two distinct environments of one base, the source then the target.
pub async fn load_pair<E: Exec + Sync>(exec: &E, ctx: &RequestContext, source_id: &str, target_id: &str) -> R<(Family, EnvironmentSummary, EnvironmentSummary)> {
    let family = load_family(exec, ctx, source_id).await?;
    let source = family.environments.iter().find(|e| e.id == source_id).cloned();
    let target = family.environments.iter().find(|e| e.id == target_id).cloned();
    match (source, target) {
        (Some(s), Some(t)) if s.id != t.id => Ok((family, s, t)),
        _ => Err(AppError::new("ENVIRONMENT_MISMATCH").with("source", json!(source_id)).with("target", json!(target_id))),
    }
}

/// `createEnvironmentBase`: the EMPTY base of a new environment, its schema, and the
/// base-level grants of the environment it copies. Answers the summary and the source.
pub async fn create_environment_base(pools: &Pools, ctx: &RequestContext, base_id: &str, environment: &str, source_id: Option<&str>) -> R<(EnvironmentSummary, String)> {
    use crate::allocation::{allocate_name, AllocationRequest, Candidate, ObjectKind, ScopeKind, SCOPE_INSTANCE};
    let label = check_environment_label(environment)?;
    let label = &label;
    with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        let family = load_family(&tx, ctx, base_id).await?;
        let source = match source_id {
            None => family.environments.iter().find(|e| e.production).or(family.environments.first()),
            Some(id) => family.environments.iter().find(|e| e.id == id),
        };
        let Some(source) = source.cloned() else {
            return Err(AppError::new("ENVIRONMENT_MISMATCH").with("source", json!(source_id)));
        };
        require_on_base(&tx, ctx, Action::ManageSchema, &source.id).await?;
        let key = label_key(label);
        if family.environments.iter().any(|e| label_key(&e.environment) == key) {
            return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)).with("field", json!("environment")));
        }
        let Some(tenant) = tx.first("SELECT id::text, ref FROM _basedb.tenant WHERE ref = $1 AND deleted_at IS NULL", &[&ctx.tenant_id]).await? else {
            return Err(AppError::new("RESOURCE_NOT_FOUND"));
        };
        let (tenant_id, tenant_ref): (String, String) = (tenant.get(0), tenant.get(1));
        let position = family.environments.iter().map(|e| e.position).fold(0, i32::max) + 1;
        let base = tx
            .query_op(
                "INSERT INTO _basedb.base
                   (tenant_id, project_id, label, label_key, description, color, icon, image,
                    mcp_enabled, lineage_id, environment, environment_key, is_production,
                    environment_position, forked_from_base_id, created_by, updated_by)
                 VALUES ($1::text::uuid, $2::text::uuid, $3, $4, $5, $6, $7, $8, $9, $10::text::uuid, $11, $12, false, $13::int,
                         $14::text::uuid, $15::text::uuid, $15::text::uuid)
                 RETURNING id::text, created_at",
                &[
                    &tenant_id,
                    &family.project_id,
                    &family.label,
                    &label_key(&family.label),
                    &family.description,
                    &family.color,
                    &family.icon,
                    &family.image,
                    &family.mcp_enabled,
                    &family.lineage_id,
                    label,
                    &key,
                    &position,
                    &source.id,
                    &ctx.actor.id,
                ],
                SqlOp::Insert,
            )
            .await?;
        let row = base.first().ok_or_else(|| AppError::internal("Cannot read properties of undefined (reading 'id')"))?;
        let (new_id, created_at): (String, DateTime<Utc>) = (row.get(0), row.get(1));
        let mut request = AllocationRequest::new(Candidate::Label(format!("{} {}", family.label, label)), ObjectKind::Schema, ScopeKind::Instance, SCOPE_INSTANCE);
        request.tenant_id = Some(tenant_ref);
        let name = allocate_name(&tx, ctx, &request).await?;
        tx.execute_op(
            "INSERT INTO _basedb.db_schema (base_id, role, name_id, created_by)
             VALUES ($1::text::uuid, 'current', $2::text::uuid, $3::text::uuid)",
            &[&new_id, &name.name_id, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
        tx.execute_op(&crate::operations::sql_create_schema(&name.name)?, &[], SqlOp::Ddl).await?;
        tx.execute_op(
            "INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
             SELECT p.role_id, 'base', $2::text::uuid, p.action, $3::text::uuid
               FROM _basedb.permission p
              WHERE p.scope_kind = 'base' AND p.scope_base_id = $1::text::uuid
             ON CONFLICT DO NOTHING",
            &[&source.id, &new_id, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
        let summary = EnvironmentSummary {
            id: new_id,
            name: name.name,
            environment: label.clone(),
            production: false,
            position,
            table_count: 0,
            created_at,
            forked_from: Some(source.id.clone()),
        };
        Ok((summary, source.id))
    })
    .await
}

/// `listEnvironments`.
pub async fn list_environments(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Family> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        load_family(&tx, ctx, base_id).await
    })
    .await
}

/// `checkEnvironmentLabel`.
pub fn check_environment_label(raw: &str) -> R<String> {
    let label = crate::description::js_trim(raw).split(|c: char| c.is_whitespace()).filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" ");
    if label.is_empty() {
        return Err(AppError::new("LABEL_EMPTY").with("field", json!("environment")));
    }
    if label.chars().count() > MAX_ENVIRONMENT_CHARS {
        return Err(AppError::new("LABEL_TOO_LONG").with("field", json!("environment")).with("maximum", json!(MAX_ENVIRONMENT_CHARS)));
    }
    Ok(label)
}

/// `renameEnvironment`.
pub async fn rename_environment(pools: &Pools, ctx: &RequestContext, base_id: &str, environment: &str) -> R<Value> {
    let label = check_environment_label(environment)?;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let label = label.clone();
        async move {
            require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
            let family = load_family(&tx, ctx, base_id).await?;
            let key = label_key(&label);
            if family.environments.iter().any(|e| e.id != base_id && label_key(&e.environment) == key) {
                return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)).with("field", json!("environment")));
            }
            tx.execute_op(
                "UPDATE _basedb.base
                    SET environment = $2, environment_key = $3, catalog_version = catalog_version + 1,
                        updated_at = clock_timestamp(), updated_by = $4::text::uuid
                  WHERE id = $1::text::uuid",
                &[&base_id, &label, &key, &ctx.actor.id],
                SqlOp::Update,
            )
            .await?;
            tx.rows("SELECT pg_notify('basedb_catalog', $1::text)", &[&base_id]).await?;
            let me = family.environments.iter().find(|e| e.id == base_id).ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND"))?;
            let mut out = me.clone();
            out.environment = label;
            Ok(out.to_json())
        }
    })
    .await
}

/// `assertDeletableEnvironment`.
pub async fn assert_deletable_environment(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<()> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        let family = load_family(&tx, ctx, base_id).await?;
        if family.environments.iter().any(|e| e.id == base_id && e.production) {
            return Err(AppError::new("ENVIRONMENT_IS_PRODUCTION").with("base", json!(base_id)));
        }
        Ok(())
    })
    .await
}
