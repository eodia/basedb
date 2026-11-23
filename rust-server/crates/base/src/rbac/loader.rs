//! Chargement des droits et des cibles depuis le catalogue — chapitre 05 §3.2, étapes 5 et
//! 6, tel `rbac/loader.ts`. L'instantané est préparé ici, une fois, en amont de la décision.

use super::decide::*;
use super::rows::compile_row_rules;
use crate::db::Exec;
use crate::error::AppError;
use crate::tx::{ActorKind, RequestContext, Surface};
use serde_json::json;
use tokio_postgres::Row;

/// Kinds whose value the kernel computes (`COMPUTED_KINDS` of `ddl/emit.ts`).
pub const COMPUTED_KINDS: [&str; 6] = ["formula", "autonumber", "lookup", "rollup", "count", "button"];

struct PermissionRow {
    role_id: String,
    action: Option<String>,
    scope_kind: Option<String>,
    project: Option<String>,
    base: Option<String>,
    application: Option<String>,
    table: Option<String>,
}

fn permission_row(r: &Row) -> PermissionRow {
    PermissionRow { role_id: r.get(0), action: r.get(1), scope_kind: r.get(2), project: r.get(3), base: r.get(4), application: r.get(5), table: r.get(6) }
}

fn scope_id_of(r: &PermissionRow, kind: ScopeKind) -> Option<String> {
    match kind {
        ScopeKind::Tenant => Some(TENANT_SCOPE.into()),
        ScopeKind::Project => r.project.clone(),
        ScopeKind::Base => r.base.clone(),
        ScopeKind::Application => r.application.clone(),
        ScopeKind::Table => r.table.clone(),
    }
}

/// `rolesOf`: groups permission and restriction rows by role, in first-seen order.
fn roles_of(rows: &[PermissionRow], field_rows: &[(String, String, String)]) -> Vec<Role> {
    let mut roles: Vec<Role> = Vec::new();
    fn entry<'a>(roles: &'a mut Vec<Role>, id: &str) -> &'a mut Role {
        if let Some(i) = roles.iter().position(|r| r.id == id) {
            return &mut roles[i];
        }
        roles.push(Role { id: id.into(), ..Default::default() });
        roles.last_mut().unwrap()
    }
    for row in rows {
        let role = entry(&mut roles, &row.role_id);
        let (Some(action), Some(kind)) = (row.action.as_deref().and_then(Action::parse), row.scope_kind.as_deref().and_then(ScopeKind::parse)) else { continue };
        if let Some(scope_id) = scope_id_of(row, kind) {
            role.permissions.push(Permission { action, scope_kind: kind, scope_id });
        }
    }
    for (role_id, field_id, access) in field_rows {
        let role = entry(&mut roles, role_id);
        let mode = match access.as_str() {
            "hidden" => FieldMode::Hidden,
            "read" => FieldMode::ReadOnly,
            _ => continue,
        };
        role.field_restrictions.push(FieldRestriction { field_id: field_id.clone(), mode });
    }
    roles
}

const PERMISSION_COLUMNS: &str =
    "p.role_id::text, p.action, p.scope_kind, p.scope_project_id::text, p.scope_base_id::text, p.scope_application_id::text, p.scope_table_id::text";

fn field_rows(rows: Vec<Row>) -> Vec<(String, String, String)> {
    rows.iter().map(|r| (r.get(0), r.get(1), r.get(2))).collect()
}

/// `loadGrants`: an actor's effective grants.
pub async fn load_grants<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<ActorGrants, AppError> {
    match ctx.actor.kind {
        ActorKind::System => return Ok(ActorGrants { is_instance_admin: true, ..Default::default() }),
        ActorKind::Form => return Ok(ActorGrants::default()),
        _ => {}
    }
    let Some(user) = exec
        .first(
            "SELECT u.is_instance_admin, t.ref AS tenant_ref
               FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE u.id = $1::text::uuid AND u.disabled_at IS NULL AND u.deleted_at IS NULL",
            &[&ctx.actor.id],
        )
        .await?
    else {
        return Err(AppError::new("AUTHENTICATION_REQUIRED").with("actor", json!(ctx.actor.id)));
    };
    if user.get::<_, String>(1) != ctx.tenant_id {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("tenant", json!(ctx.tenant_id)));
    }
    let rows = exec
        .rows(
            &format!(
                "SELECT {PERMISSION_COLUMNS}
                   FROM _basedb.role_member m
                   JOIN _basedb.role r ON r.id = m.role_id AND r.deleted_at IS NULL
                   LEFT JOIN _basedb.permission p ON p.role_id = r.id
                  WHERE m.user_id = $1::text::uuid"
            )
            .replace("p.role_id::text", "r.id::text"),
            &[&ctx.actor.id],
        )
        .await?;
    let fields = exec
        .rows(
            "SELECT fp.role_id::text, fp.field_id::text, fp.access
               FROM _basedb.role_member m
               JOIN _basedb.field_permission fp ON fp.role_id = m.role_id
              WHERE m.user_id = $1::text::uuid",
            &[&ctx.actor.id],
        )
        .await?;
    let roles = roles_of(&rows.iter().map(permission_row).collect::<Vec<_>>(), &field_rows(fields));
    let mut grants = ActorGrants { is_instance_admin: user.get(0), roles, ..Default::default() };
    if ctx.actor.kind == ActorKind::Token {
        if let Some(token_id) = &ctx.actor.token_id {
            load_token_bounds(exec, &ctx.actor.id, token_id, &mut grants).await?;
        }
    }
    Ok(grants)
}

/// `loadTokenBounds`: a token's role, base(s) and surfaces, read at every snapshot.
async fn load_token_bounds<E: Exec + Sync>(exec: &E, user_id: &str, token_id: &str, grants: &mut ActorGrants) -> Result<(), AppError> {
    let Some(token) = exec
        .first(
            "SELECT tk.role_id::text, tk.base_id::text, tk.allowed_surfaces,
                    CASE WHEN tk.all_environments THEN
                      (SELECT array_agg(e.id::text) FROM _basedb.base own
                         JOIN _basedb.base e ON e.lineage_id = own.lineage_id
                                            AND e.tenant_id = own.tenant_id
                                            AND e.is_live AND e.deleted_at IS NULL
                        WHERE own.id = tk.base_id)
                    END AS environments
               FROM _basedb.api_token tk
               JOIN _basedb.role r ON r.id = tk.role_id AND r.deleted_at IS NULL
              WHERE tk.id = $1::text::uuid AND tk.created_by = $2::text::uuid
                AND tk.revoked_at IS NULL AND tk.suspended_at IS NULL
                AND (tk.expires_at IS NULL OR tk.expires_at > clock_timestamp())",
            &[&token_id, &user_id],
        )
        .await?
    else {
        return Err(AppError::new("TOKEN_INVALID"));
    };
    let role_id: String = token.get(0);
    let rows = exec.rows(&format!("SELECT {PERMISSION_COLUMNS} FROM _basedb.permission p WHERE p.role_id = $1::text::uuid"), &[&role_id]).await?;
    let fields = exec
        .rows("SELECT fp.role_id::text, fp.field_id::text, fp.access FROM _basedb.field_permission fp WHERE fp.role_id = $1::text::uuid", &[&role_id])
        .await?;
    let role = roles_of(&rows.iter().map(permission_row).collect::<Vec<_>>(), &field_rows(fields))
        .into_iter()
        .next()
        .unwrap_or(Role { id: role_id, ..Default::default() });
    grants.token_role = Some(role);
    grants.token_base_id = Some(token.get(1));
    grants.token_base_ids = token.get(3);
    grants.token_allowed_surfaces = Some(token.get::<_, Vec<String>>(2).iter().filter_map(|s| Surface::parse(s)).collect());
    Ok(())
}

/// `loadTarget`: a table as a decision target — `None` when it is not a live table.
pub async fn load_target<E: Exec + Sync>(exec: &E, _ctx: &RequestContext, table_id: &str) -> Result<Option<Target>, AppError> {
    let Some(table) = exec
        .first(
            "SELECT t.id::text, t.base_id::text, ten.ref AS tenant_ref,
                    tn.name AS table_name, sn.name AS schema_name, b.mcp_enabled, b.project_id::text
               FROM _basedb.table_def t
               JOIN _basedb.base b        ON b.id = t.base_id
               JOIN _basedb.tenant ten    ON ten.id = b.tenant_id
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s   ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE t.id = $1::text::uuid AND t.is_live",
            &[&table_id],
        )
        .await?
    else {
        return Ok(None);
    };
    let fields = exec
        .rows(
            "SELECT f.id::text, n.name, f.kind, f.expose_to_agents,
                    EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live
              ORDER BY f.position",
            &[&table_id],
        )
        .await?;
    let applications = exec.rows("SELECT application_id::text FROM _basedb.application_table WHERE table_id = $1::text::uuid", &[&table_id]).await?;
    let rules = exec.rows("SELECT role_id::text, filter FROM _basedb.row_permission WHERE table_id = $1::text::uuid", &[&table_id]).await?;
    let named: Vec<(String, String)> = fields.iter().map(|f| (f.get(1), f.get(2))).collect();
    let rules: Vec<(String, String)> = rules.iter().map(|r| (r.get(0), r.get(1))).collect();

    let mut target = Target::new(TargetKind::Table, table.get::<_, String>(0), Some(table.get(2)));
    target.project_id = table.get(6);
    target.base_id = Some(table.get(1));
    target.application_ids = applications.iter().map(|a| a.get(0)).collect();
    target.field_ids = fields.iter().map(|f| f.get(0)).collect();
    target.agent_hidden_field_ids = fields.iter().filter(|f| !f.get::<_, bool>(3)).map(|f| f.get(0)).collect();
    target.agents_excluded = !table.get::<_, bool>(5);
    target.computed_field_ids =
        fields.iter().filter(|f| COMPUTED_KINDS.contains(&f.get::<_, String>(2).as_str()) || f.get::<_, bool>(4)).map(|f| f.get(0)).collect();
    target.row_rules = if rules.is_empty() { Default::default() } else { compile_row_rules(&rules, &named) };
    Ok(Some(target))
}

/// `loadFieldNames`: catalog key → physical name, in catalog order.
pub async fn load_field_names<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<Vec<(String, String)>, AppError> {
    let rows = exec
        .rows(
            "SELECT f.id::text, n.name
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live
              ORDER BY f.position",
            &[&table_id],
        )
        .await?;
    Ok(rows.iter().map(|r| (r.get(0), r.get(1))).collect())
}

/// A field as filtering and sorting need it (`loadFields`).
#[derive(Debug, Clone, PartialEq)]
pub struct LoadedField {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub stored: bool,
    pub rich: bool,
}

/// `loadFields`, in catalog order.
pub async fn load_fields<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<Vec<LoadedField>, AppError> {
    let rows = exec
        .rows(
            "SELECT f.id::text, n.name, f.kind,
                    CASE WHEN f.kind IN ('lookup', 'rollup', 'count', 'button') THEN false
                         WHEN f.kind = 'formula' THEN coalesce(fc.is_stored, true)
                         ELSE true END AS stored,
                    coalesce(tc.is_rich, false) AS rich
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
               LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
               LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
              WHERE f.table_id = $1::text::uuid AND f.is_live
              ORDER BY f.position",
            &[&table_id],
        )
        .await?;
    Ok(rows.iter().map(|r| LoadedField { id: r.get(0), name: r.get(1), kind: r.get(2), stored: r.get(3), rich: r.get(4) }).collect())
}
