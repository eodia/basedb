//! Projects — the level above the base (chapter 02, chapter 05 §15), `catalog/projects.ts`.

use crate::description::{js_trim, normalize_description};
use crate::formula::FormulaDialect;
use crate::http::{checked_look, label_key, Look, LookInput};
use crate::projection::{project, snapshot, TargetFactory, BASE_ACTIONS};
use crate::queries::query_summaries;
use crate::sql_views::{sql_view_summaries, SummaryBase};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, Target, TargetKind, Verdict};
use basedb_base::rbac::require::{load_project_target, require_action};
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

/// How long an agent's proposal awaits a decision (`PROPOSAL_LIFETIME_MS`).
pub const PROPOSAL_LIFETIME_SECONDS: i64 = 86_400;

/// The verbs of « Gestion » (`LEVEL_ACTIONS.manage`).
pub const MANAGE_ACTIONS: [&str; 6] = ["read", "create", "update", "delete", "manage_schema", "manage_tokens"];

/// `openProposalCounts`: proposals awaiting a decision, per base.
pub async fn open_proposal_counts<E: Exec + Sync>(exec: &E, base_ids: &[String]) -> Result<HashMap<String, i32>, AppError> {
    if base_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let interval = format!("{PROPOSAL_LIFETIME_SECONDS} seconds");
    let rows = exec
        .rows(
            "SELECT base_id::text, count(*)::int AS n FROM _basedb.migration
              WHERE origin = 'mcp' AND status = 'proposed' AND base_id = ANY($1::text[]::uuid[])
                AND requested_at >= clock_timestamp() - $2::text::interval
              GROUP BY base_id",
            &[&base_ids, &interval],
        )
        .await?;
    Ok(rows.iter().map(|r| (r.get(0), r.get(1))).collect())
}

fn actions_json(actions: &[Action]) -> Value {
    Value::Array(actions.iter().map(|a| json!(a.as_str())).collect())
}

/// `listProjects`: the projects the caller sees, with their bases and tables.
pub async fn list_projects(pools: &Pools, ctx: &RequestContext) -> Result<Vec<Value>, AppError> {
    let s = snapshot(pools, ctx).await?;
    let bases = project(ctx, &s.grants, &s.raw, FormulaDialect::Fr);
    let factory = TargetFactory::new(ctx, &s.raw);
    let table_rows: HashMap<&str, _> = s.raw.tables.iter().map(|t| (t.id.as_str(), t)).collect();
    let table_actions = |id: &str, actions: &[Action]| -> Vec<Action> {
        let mut out = actions.to_vec();
        if let Some(row) = table_rows.get(id) {
            if decide(ctx, &s.grants, Action::ManageSchema, &factory.target(row)).verdict == Verdict::Allowed {
                out.push(Action::ManageSchema);
            }
        }
        out
    };

    let deciding: Vec<String> = bases.iter().filter(|b| b.base_actions.contains(&Action::ManageSchema)).map(|b| b.id.clone()).collect();
    let managed: HashSet<String> = deciding.iter().cloned().collect();
    let base_ids: Vec<String> = bases.iter().map(|b| b.id.clone()).collect();
    let summary_bases: Vec<SummaryBase> = bases
        .iter()
        .map(|b| SummaryBase {
            id: b.id.clone(),
            schema: b.name.clone(),
            readable: b.tables.iter().map(|t| (t.name.clone(), t.fields.iter().map(|f| f.name.clone()).collect())).collect(),
        })
        .collect();
    let (deciding, managed, base_ids, summary_bases) = (&deciding, &managed, &base_ids, &summary_bases);
    let (open, queries, views) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let open = open_proposal_counts(&tx, deciding).await?;
        let queries = query_summaries(&tx, ctx, base_ids, managed).await?;
        let views = sql_view_summaries(&tx, summary_bases, managed).await?;
        Ok((open, queries, views))
    })
    .await?;

    let mut out = Vec::new();
    for row in &s.raw.projects {
        let mut target = Target::new(TargetKind::Project, row.id.clone(), Some(ctx.tenant_id.clone()));
        target.project_id = Some(row.id.clone());
        let actions: Vec<Action> = BASE_ACTIONS.iter().copied().filter(|a| decide(ctx, &s.grants, *a, &target).verdict == Verdict::Allowed).collect();
        let inside: Vec<_> = bases.iter().filter(|b| b.project.id == row.id).collect();
        if !actions.contains(&Action::Read) && inside.is_empty() {
            continue;
        }
        let bases_json: Vec<Value> = inside
            .iter()
            .map(|b| {
                json!({
                    "id": b.id,
                    "name": b.name,
                    "label": b.label,
                    "description": b.description,
                    "color": b.color,
                    "icon": b.icon,
                    "image": b.image,
                    "actions": actions_json(&b.base_actions),
                    "openProposals": open.get(&b.id).copied().unwrap_or(0),
                    "environment": b.environment.to_json(),
                    "tables": b.tables.iter().map(|t| json!({
                        "id": t.id,
                        "name": t.name,
                        "label": t.label,
                        "color": t.color,
                        "icon": t.icon,
                        "image": t.image,
                        "actions": actions_json(&table_actions(&t.id, &t.actions)),
                    })).collect::<Vec<_>>(),
                    "sqlViews": views.get(&b.id).cloned().unwrap_or_default(),
                    "queries": queries.get(&b.id).cloned().unwrap_or_default(),
                })
            })
            .collect();
        out.push(json!({
            "id": row.id,
            "label": row.label,
            "description": row.description,
            "color": row.color,
            "icon": row.icon,
            "image": row.image,
            "actions": actions_json(&actions),
            "bases": bases_json,
        }));
    }
    Ok(out)
}

fn check_label(label: &str) -> Result<String, AppError> {
    let trimmed = js_trim(label);
    if trimmed.is_empty() {
        return Err(AppError::new("LABEL_EMPTY"));
    }
    if trimmed.chars().count() > 255 {
        return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(255)));
    }
    Ok(trimmed.to_string())
}

async fn assert_label_free<E: Exec + Sync>(exec: &E, ctx: &RequestContext, label: &str, except: Option<&str>, creator: &str) -> Result<(), AppError> {
    let clash = exec
        .rows(
            "SELECT p.id FROM _basedb.project p
               JOIN _basedb.tenant t ON t.id = p.tenant_id
              WHERE t.ref = $1 AND p.label_key = $2 AND p.deleted_at IS NULL
                AND p.created_by = $4::text::uuid
                AND ($3::text::uuid IS NULL OR p.id <> $3::text::uuid)",
            &[&ctx.tenant_id, &label_key(label), &except, &creator],
        )
        .await?;
    if !clash.is_empty() {
        return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)));
    }
    Ok(())
}

/// `personalRole`: the person's own role, created on first use.
pub async fn personal_role<E: Exec + Sync>(exec: &E, ctx: &RequestContext, user_id: &str) -> Result<String, AppError> {
    let found = exec
        .first(
            "SELECT r.id::text FROM _basedb.role r
               JOIN _basedb.role_member m ON m.role_id = r.id
              WHERE r.kind = 'person' AND m.user_id = $1::text::uuid AND r.deleted_at IS NULL",
            &[&user_id],
        )
        .await?;
    if let Some(r) = found {
        return Ok(r.get(0));
    }
    let role = exec
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
    let id: String = role.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("personal role not created"))?;
    exec.execute_op(
        "INSERT INTO _basedb.role_member (role_id, user_id, granted_by) VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid)",
        &[&id, &user_id, &ctx.actor.id],
        SqlOp::Insert,
    )
    .await?;
    Ok(id)
}

/// `grantCreator`: « Gestion » on a project for whoever just created it.
pub async fn grant_creator<E: Exec + Sync>(exec: &E, ctx: &RequestContext, project_id: &str) -> Result<(), AppError> {
    let role = personal_role(exec, ctx, &ctx.actor.id).await?;
    for action in MANAGE_ACTIONS {
        exec.execute_op(
            "INSERT INTO _basedb.permission (role_id, scope_kind, scope_project_id, action, granted_by)
             VALUES ($1::text::uuid, 'project', $2::text::uuid, $3, $4::text::uuid) ON CONFLICT DO NOTHING",
            &[&role, &project_id, &action, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
    }
    Ok(())
}

fn look_fields(out: &mut Map<String, Value>, look: &Look) {
    look.insert_into(out);
}

/// `createProject`.
pub async fn create_project(pools: &Pools, ctx: &RequestContext, label: &str, description: Option<&Value>, look: Option<&LookInput>) -> Result<Value, AppError> {
    let label = check_label(label)?;
    let description = normalize_description(description, "description")?;
    let look = checked_look(look)?.unwrap_or_default();
    let (label, description, look) = (&label, &description, &look);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        if ctx.actor.kind != ActorKind::User {
            return Err(AppError::new("RESOURCE_NOT_FOUND"));
        }
        assert_label_free(&tx, ctx, label, None, &ctx.actor.id).await?;
        let rows = tx
            .query_op(
                "INSERT INTO _basedb.project
                   (tenant_id, label, label_key, description, color, icon, image, position,
                    created_by, updated_by)
                 SELECT t.id, $2, $3, $4, $6, $7, $8,
                        coalesce((SELECT max(position) + 1 FROM _basedb.project WHERE tenant_id = t.id), 0),
                        $5::text::uuid, $5::text::uuid
                   FROM _basedb.tenant t WHERE t.ref = $1
                 RETURNING id::text",
                &[&ctx.tenant_id, label, &label_key(label), description, &ctx.actor.id, &look.color, &look.icon, &look.image],
                SqlOp::Insert,
            )
            .await?;
        let id: String = rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("project not created"))?;
        grant_creator(&tx, ctx, &id).await?;
        let mut out = Map::new();
        out.insert("id".into(), json!(id));
        out.insert("label".into(), json!(label));
        out.insert("description".into(), json!(description));
        look_fields(&mut out, look);
        Ok(Value::Object(out))
    })
    .await
}

/// `updateProject`: `label` is `Some` when the body named one (already a text).
pub async fn update_project(pools: &Pools, ctx: &RequestContext, project_id: &str, label: Option<&str>, description: Option<&Value>, look: Option<&LookInput>) -> Result<Value, AppError> {
    let label = label.map(check_label).transpose()?;
    let sets_description = description.is_some();
    let description = if sets_description { normalize_description(description, "description")? } else { None };
    let look = checked_look(look)?;
    let (label, description, look) = (&label, &description, &look);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let target = load_project_target(&tx, ctx, project_id).await?;
        let mut details = Map::new();
        details.insert("project".into(), json!(project_id));
        require_action(&tx, ctx, Action::ManageSchema, target.clone(), details).await?;
        let id = target.map(|t| t.id).unwrap_or_default();
        if let Some(label) = label {
            let owner = tx.first("SELECT created_by::text FROM _basedb.project WHERE id = $1::text::uuid", &[&id]).await?;
            let creator = owner.and_then(|r| r.get::<_, Option<String>>(0)).unwrap_or_else(|| ctx.actor.id.clone());
            assert_label_free(&tx, ctx, label, Some(&id), &creator).await?;
        }
        let key = label.as_deref().map(label_key);
        let (sets_look, color, icon, image) = match look {
            Some(l) => (true, l.color.clone(), l.icon.clone(), l.image.clone()),
            None => (false, None, None, None),
        };
        let rows = tx
            .query_op(
                "UPDATE _basedb.project
                    SET label = CASE WHEN $2::boolean THEN $3::text ELSE label END,
                        label_key = CASE WHEN $2::boolean THEN $4::text ELSE label_key END,
                        description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
                        color = CASE WHEN $8::boolean THEN $9::text ELSE color END,
                        icon = CASE WHEN $8::boolean THEN $10::text ELSE icon END,
                        image = CASE WHEN $8::boolean THEN $11::text ELSE image END,
                        updated_at = clock_timestamp(), updated_by = $7::text::uuid
                  WHERE id = $1::text::uuid AND deleted_at IS NULL
                  RETURNING label, description, color, icon, image",
                &[&id, &label.is_some(), label, &key, &sets_description, description, &ctx.actor.id, &sets_look, &color, &icon, &image],
                SqlOp::Update,
            )
            .await?;
        let r = rows.first().ok_or_else(|| AppError::internal("Cannot read properties of undefined (reading 'label')"))?;
        Ok(json!({
            "label": r.get::<_, String>(0),
            "description": r.get::<_, Option<String>>(1),
            "color": r.get::<_, Option<String>>(2),
            "icon": r.get::<_, Option<String>>(3),
            "image": r.get::<_, Option<String>>(4),
        }))
    })
    .await
}

/// `deleteProject`: an empty project only.
pub async fn delete_project(pools: &Pools, ctx: &RequestContext, project_id: &str) -> Result<(), AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let target = load_project_target(&tx, ctx, project_id).await?;
        let mut details = Map::new();
        details.insert("project".into(), json!(project_id));
        require_action(&tx, ctx, Action::ManageSchema, target.clone(), details).await?;
        let id = target.map(|t| t.id).unwrap_or_default();
        let live = tx.first("SELECT count(*)::int8 FROM _basedb.base WHERE project_id = $1::text::uuid AND deleted_at IS NULL", &[&id]).await?;
        let n: i64 = live.map(|r| r.get(0)).unwrap_or(0);
        if n > 0 {
            return Err(AppError::new("PROJECT_NOT_EMPTY").with("bases", json!(n)));
        }
        tx.execute_op("DELETE FROM _basedb.permission WHERE scope_project_id = $1::text::uuid", &[&id], SqlOp::Delete).await?;
        tx.execute_op(
            "UPDATE _basedb.invitation SET revoked_at = clock_timestamp()
              WHERE scope_project_id = $1::text::uuid AND accepted_at IS NULL AND revoked_at IS NULL",
            &[&id],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op(
            "UPDATE _basedb.project
                SET deleted_at = clock_timestamp(), deleted_by = $2::text::uuid, updated_at = clock_timestamp()
              WHERE id = $1::text::uuid",
            &[&id, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        Ok(())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_a_project_label() {
        assert_eq!(check_label("  Ventes ").unwrap(), "Ventes");
        assert_eq!(check_label("  ").unwrap_err().code, "LABEL_EMPTY");
        assert_eq!(check_label(&"é".repeat(255)).unwrap().chars().count(), 255);
        assert_eq!(check_label(&"é".repeat(256)).unwrap_err().details["maximum"], json!(255));
    }
}
