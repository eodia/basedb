//! `admin/access.ts`: levels per group over projects, bases and tables — the grid.

use crate::common::{administering, audit, fields, js_string, require_elevated_session, strict_json};
use crate::groups::{ensure_system_groups, load_group, load_groups, GroupSummary};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::require::require_administration;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::Shared;
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use std::collections::HashSet;

pub type Level = &'static str;

pub const ACCESS_LEVELS: [Level; 4] = ["none", "read", "edit", "manage"];

pub fn rank(level: &str) -> u8 {
    match level {
        "read" => 1,
        "edit" => 2,
        "manage" => 3,
        _ => 0,
    }
}

pub fn level_actions(level: &str) -> &'static [&'static str] {
    match level {
        "read" => &["read"],
        "edit" => &["read", "create", "update", "delete"],
        "manage" => &["read", "create", "update", "delete", "manage_schema", "manage_tokens"],
        _ => &[],
    }
}

pub fn as_level(value: &str) -> Option<Level> {
    ACCESS_LEVELS.iter().copied().find(|l| *l == value)
}

/// `levelOf`: the highest level whose verbs are all there.
pub fn level_of(actions: &HashSet<String>) -> Level {
    let mut found = "none";
    for level in ACCESS_LEVELS {
        if level_actions(level).iter().all(|a| actions.contains(*a)) {
            found = level;
        }
    }
    found
}

pub fn max(a: Level, b: Level) -> Level {
    if rank(a) >= rank(b) {
        a
    } else {
        b
    }
}

pub fn key(kind: &str, id: &str) -> String {
    format!("{kind}:{id}")
}

#[derive(Debug, Clone)]
pub struct AccessTable {
    pub id: String,
    pub name: String,
    pub label: String,
}

#[derive(Debug, Clone)]
pub struct AccessBase {
    pub id: String,
    pub name: String,
    pub label: String,
    pub tables: Vec<AccessTable>,
}

#[derive(Debug, Clone)]
pub struct AccessProject {
    pub id: String,
    pub label: String,
    pub bases: Vec<AccessBase>,
}

impl AccessProject {
    pub fn json(&self) -> Value {
        json!({
            "id": self.id,
            "label": self.label,
            "bases": self.bases.iter().map(|b| json!({
                "id": b.id, "name": b.name, "label": b.label,
                "tables": b.tables.iter().map(|t| json!({ "id": t.id, "name": t.name, "label": t.label })).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        })
    }
}

pub type Levels = IndexMap<String, Level>;
pub type Grants = IndexMap<String, Levels>;

/// `loadTree`: every live project, base and table of the tenant.
pub async fn load_tree<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<Vec<AccessProject>, AppError> {
    let projects = exec
        .rows(
            "SELECT p.id::text, p.label FROM _basedb.project p
               JOIN _basedb.tenant t ON t.id = p.tenant_id
              WHERE t.ref = $1 AND p.deleted_at IS NULL
              ORDER BY p.position, p.label",
            &[&ctx.tenant_id],
        )
        .await?;
    let bases = exec
        .rows(
            "SELECT b.id::text, b.project_id::text, b.label, sn.name
               FROM _basedb.base b
               JOIN _basedb.tenant t         ON t.id = b.tenant_id
               JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                            AND s.dropped_at IS NULL
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE t.ref = $1 AND b.is_live AND b.deleted_at IS NULL
              ORDER BY b.label",
            &[&ctx.tenant_id],
        )
        .await?;
    let tables = exec
        .rows(
            "SELECT td.id::text, td.base_id::text, td.label, tn.name
               FROM _basedb.table_def td
               JOIN _basedb.base b           ON b.id = td.base_id
               JOIN _basedb.tenant t         ON t.id = b.tenant_id
               JOIN _basedb.physical_name tn ON tn.id = td.name_id
              WHERE t.ref = $1 AND td.is_live AND td.deleted_at IS NULL AND b.is_live
              ORDER BY td.position, td.label",
            &[&ctx.tenant_id],
        )
        .await?;
    Ok(projects
        .iter()
        .map(|p| {
            let pid: String = p.get(0);
            let bases = bases
                .iter()
                .filter(|b| b.get::<_, Option<String>>(1).as_deref() == Some(pid.as_str()))
                .map(|b| {
                    let bid: String = b.get(0);
                    let tables = tables
                        .iter()
                        .filter(|t| t.get::<_, String>(1) == bid)
                        .map(|t| AccessTable { id: t.get(0), name: t.get(3), label: t.get(2) })
                        .collect();
                    AccessBase { id: bid, name: b.get(3), label: b.get(2), tables }
                })
                .collect();
            AccessProject { id: pid, label: p.get(1), bases }
        })
        .collect())
}

/// `loadGrants`: role → node → level, for the groups or for the people's own roles.
pub async fn load_level_grants<E: Exec + Sync>(exec: &E, ctx: &RequestContext, kind: &str) -> Result<Grants, AppError> {
    let rows = exec
        .rows(
            "SELECT p.role_id::text, p.scope_kind || ':' ||
                      coalesce(p.scope_project_id, p.scope_base_id, p.scope_table_id)::text AS scope,
                    p.action
               FROM _basedb.permission p
               JOIN _basedb.role r   ON r.id = p.role_id AND r.kind = $2 AND r.deleted_at IS NULL
               JOIN _basedb.tenant t ON t.id = r.tenant_id
              WHERE t.ref = $1 AND p.scope_kind IN ('project', 'base', 'table')",
            &[&ctx.tenant_id, &kind],
        )
        .await?;
    let mut actions: IndexMap<String, IndexMap<String, HashSet<String>>> = IndexMap::new();
    for r in &rows {
        actions.entry(r.get(0)).or_default().entry(r.get(1)).or_default().insert(r.get(2));
    }
    Ok(actions
        .into_iter()
        .map(|(role, by_scope)| {
            let levels: Levels = by_scope.into_iter().map(|(s, set)| (s, level_of(&set))).filter(|(_, l)| *l != "none").collect();
            (role, levels)
        })
        .collect())
}

/// `cellsOf`: what one group shows on every node.
fn cells_of(tree: &[AccessProject], direct: &Levels) -> Map<String, Value> {
    let mut cells = Map::new();
    let level_at = |cells: &Map<String, Value>, k: &str| cells.get(k).and_then(|c| c["level"].as_str().map(str::to_string));
    for project in tree {
        let pkey = key("project", &project.id);
        let plevel = direct.get(&pkey).copied().unwrap_or("none");
        for base in &project.bases {
            let bkey = key("base", &base.id);
            let blevel = max(plevel, direct.get(&bkey).copied().unwrap_or("none"));
            for table in &base.tables {
                let tkey = key("table", &table.id);
                let level = max(blevel, direct.get(&tkey).copied().unwrap_or("none"));
                cells.insert(tkey.clone(), json!({ "level": level, "direct": direct.contains_key(&tkey) }));
            }
            let uniform = base.tables.iter().all(|t| level_at(&cells, &key("table", &t.id)).as_deref() == Some(blevel));
            cells.insert(bkey.clone(), json!({ "level": if uniform { blevel } else { "granular" }, "direct": direct.contains_key(&bkey) }));
        }
        let uniform = project.bases.iter().all(|b| level_at(&cells, &key("base", &b.id)).as_deref() == Some(plevel));
        cells.insert(pkey.clone(), json!({ "level": if uniform { plevel } else { "granular" }, "direct": direct.contains_key(&pkey) }));
    }
    cells
}

/// `buildGraph`, serialized as the route answers it.
async fn build_graph<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<Value, AppError> {
    let groups = load_groups(exec, ctx).await?;
    let tree = load_tree(exec, ctx).await?;
    let grants = load_level_grants(exec, ctx, "group").await?;
    let mut cells = Map::new();
    for group in &groups {
        if group.system == Some("admins") {
            let all: Levels = tree.iter().map(|p| (key("project", &p.id), "manage")).collect();
            cells.insert(group.id.clone(), Value::Object(cells_of(&tree, &all)));
            continue;
        }
        let empty = Levels::new();
        cells.insert(group.id.clone(), Value::Object(cells_of(&tree, grants.get(&group.id).unwrap_or(&empty))));
    }
    Ok(json!({
        "groups": groups.iter().map(GroupSummary::json).collect::<Vec<_>>(),
        "projects": tree.iter().map(AccessProject::json).collect::<Vec<_>>(),
        "cells": cells,
    }))
}

/// `groupLevelsOnTable`: each group's level on one table; `None` for no live table.
pub async fn group_levels_on_table<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<Option<IndexMap<String, Level>>, AppError> {
    let tree = load_tree(exec, ctx).await?;
    let Some((_, path)) = locate(&tree, "table", table_id) else { return Ok(None) };
    let groups = load_groups(exec, ctx).await?;
    let grants = load_level_grants(exec, ctx, "group").await?;
    let mut out = IndexMap::new();
    for group in &groups {
        if group.system == Some("admins") {
            out.insert(group.id.clone(), "manage");
            continue;
        }
        let direct = grants.get(&group.id);
        let mut level = "none";
        for node in &path {
            level = max(level, direct.and_then(|d| d.get(node).copied()).unwrap_or("none"));
        }
        out.insert(group.id.clone(), level);
    }
    Ok(Some(out))
}

/// `locate`: the node's project and the keys from the project down to it.
pub fn locate<'a>(tree: &'a [AccessProject], kind: &str, id: &str) -> Option<(&'a AccessProject, Vec<String>)> {
    for project in tree {
        let pkey = key("project", &project.id);
        if kind == "project" && project.id == id {
            return Some((project, vec![pkey]));
        }
        for base in &project.bases {
            let bkey = key("base", &base.id);
            if kind == "base" && base.id == id {
                return Some((project, vec![pkey, bkey]));
            }
            for table in &base.tables {
                if kind == "table" && table.id == id {
                    return Some((project, vec![pkey, bkey, key("table", &table.id)]));
                }
            }
        }
    }
    None
}

fn children_of(project: &AccessProject, node: &str) -> Vec<String> {
    if node.starts_with("project:") {
        return project.bases.iter().map(|b| key("base", &b.id)).collect();
    }
    if node.starts_with("base:") {
        return project.bases.iter().find(|b| key("base", &b.id) == node).map(|b| b.tables.iter().map(|t| key("table", &t.id)).collect()).unwrap_or_default();
    }
    Vec::new()
}

pub fn descendants_of(project: &AccessProject, node: &str) -> Vec<String> {
    let mut out = Vec::new();
    for child in children_of(project, node) {
        let below = descendants_of(project, &child);
        out.push(child);
        out.extend(below);
    }
    out
}

/// `applyLevel`: explode ancestors granting more, set the node, drop redundant grants.
pub fn apply_level(project: &AccessProject, path: &[String], level: Level, grants: &mut Levels) {
    let node = path.last().cloned().unwrap_or_default();
    for ancestor in &path[..path.len().saturating_sub(1)] {
        let held = grants.get(ancestor).copied().unwrap_or("none");
        if rank(held) <= rank(level) {
            continue;
        }
        grants.shift_remove(ancestor);
        for child in children_of(project, ancestor) {
            let v = max(grants.get(&child).copied().unwrap_or("none"), held);
            grants.insert(child, v);
        }
    }
    for d in descendants_of(project, &node) {
        grants.shift_remove(&d);
    }
    if level == "none" {
        grants.shift_remove(&node);
    } else {
        grants.insert(node, level);
    }
    fn walk(project: &AccessProject, grants: &mut Levels, node: &str, inherited: Level) {
        if let Some(own) = grants.get(node).copied() {
            if rank(own) <= rank(inherited) {
                grants.shift_remove(node);
            }
        }
        let effective = max(inherited, grants.get(node).copied().unwrap_or("none"));
        for child in children_of(project, node) {
            walk(project, grants, &child, effective);
        }
    }
    walk(project, grants, &key("project", &project.id), "none");
}

/// `writeLevels`: one role's rows over one project, rewritten from its levels.
pub async fn write_levels<E: Exec + Sync>(exec: &E, ctx: &RequestContext, project: &AccessProject, role_id: &str, levels: &Levels) -> Result<(), AppError> {
    let pkey = key("project", &project.id);
    let mut subtree = vec![pkey.clone()];
    subtree.extend(descendants_of(project, &pkey));
    let ids = |kind: &str| -> Vec<String> { subtree.iter().filter_map(|k| k.strip_prefix(&format!("{kind}:")).map(str::to_string)).collect() };
    exec.execute_op(
        "DELETE FROM _basedb.permission
          WHERE role_id = $1::text::uuid
            AND (scope_project_id = ANY($2::text[]::uuid[]) OR scope_base_id = ANY($3::text[]::uuid[])
                 OR scope_table_id = ANY($4::text[]::uuid[]))",
        &[&role_id, &ids("project"), &ids("base"), &ids("table")],
        SqlOp::Delete,
    )
    .await?;
    for (scope, level) in levels {
        if !subtree.contains(scope) {
            continue;
        }
        let (kind, id) = scope.split_once(':').unwrap_or(("", ""));
        let (p, b, t) = (
            (kind == "project").then_some(id),
            (kind == "base").then_some(id),
            (kind == "table").then_some(id),
        );
        for action in level_actions(level) {
            exec.execute_op(
                "INSERT INTO _basedb.permission
                   (role_id, scope_kind, scope_project_id, scope_base_id, scope_table_id,
                    action, granted_by)
                 VALUES ($1::text::uuid, $2, $3::text::uuid, $4::text::uuid, $5::text::uuid, $6, $7::text::uuid)",
                &[&role_id, &kind, &p, &b, &t, action, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        }
    }
    Ok(())
}

pub async fn graph(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let c = &ctx;
    let graph = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        ensure_system_groups(&tx, &c.tenant_id, &c.actor.id).await?;
        build_graph(&tx, c).await
    })
    .await?;
    Ok(json_ok(json!({ "data": graph })))
}

struct Change {
    group: String,
    kind: String,
    id: Option<Value>,
    level: Level,
}

pub async fn apply(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let Some(raw) = fields(&body)?.get("changes").and_then(Value::as_array).cloned() else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("changes")));
    };
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let mut changes = Vec::new();
    for change in &raw {
        let level = change.get("level").and_then(Value::as_str).and_then(as_level);
        let Some(level) = level else { return Err(AppError::new("REQUEST_INVALID").with("field", json!("level"))) };
        let scope = change.get("scope");
        let kind = scope.and_then(|s| s.get("kind")).and_then(Value::as_str).filter(|k| ["project", "base", "table"].contains(k));
        let Some(kind) = kind else { return Err(AppError::new("REQUEST_INVALID").with("field", json!("scope"))) };
        changes.push(Change {
            group: change.get("group").and_then(Value::as_str).unwrap_or("").to_string(),
            kind: kind.to_string(),
            id: scope.and_then(|s| s.get("id")).cloned(),
            level,
        });
    }
    let (c, s, ch) = (&ctx, &session_id, &changes);
    let graph = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        require_elevated_session(&tx, c, s).await?;
        ensure_system_groups(&tx, &c.tenant_id, &c.actor.id).await?;
        let tree = load_tree(&tx, c).await?;
        let mut grants = load_level_grants(&tx, c, "group").await?;
        for change in ch {
            let group = load_group(&tx, c, &json!(change.group)).await?;
            if group.system == Some("admins") {
                return Err(AppError::new("GROUP_SYSTEM_IMMUTABLE"));
            }
            let found = change.id.as_ref().and_then(Value::as_str).and_then(|id| locate(&tree, &change.kind, id));
            let Some((project, path)) = found else {
                let mut e = AppError::new("RESOURCE_NOT_FOUND");
                if let Some(id) = &change.id {
                    e = e.with("scope", id.clone());
                }
                return Err(e);
            };
            let mine = grants.entry(group.id.clone()).or_default();
            apply_level(project, &path, change.level, mine);
            let mine = mine.clone();
            write_levels(&tx, c, project, &group.id, &mine).await?;
            let id = js_string(change.id.as_ref().unwrap_or(&Value::Null));
            audit(&tx, c, "permission.set", &change.kind, Some(&id), Some(&group.label), json!({ "group": group.id, "level": change.level })).await?;
        }
        build_graph(&tx, c).await
    })
    .await?;
    Ok(json_ok(json!({ "data": graph })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> AccessProject {
        let t = |id: &str| AccessTable { id: id.into(), name: id.into(), label: id.into() };
        AccessProject {
            id: "p".into(),
            label: "P".into(),
            bases: vec![
                AccessBase { id: "b1".into(), name: "b1".into(), label: "B1".into(), tables: vec![t("t1"), t("t2")] },
                AccessBase { id: "b2".into(), name: "b2".into(), label: "B2".into(), tables: vec![t("t3")] },
            ],
        }
    }

    #[test]
    fn levels_of_verbs() {
        let set = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<HashSet<_>>();
        assert_eq!(level_of(&set(&[])), "none");
        assert_eq!(level_of(&set(&["read", "create"])), "read");
        assert_eq!(level_of(&set(&["read", "create", "update", "delete"])), "edit");
        assert_eq!(level_of(&set(&["read", "create", "update", "delete", "manage_schema", "manage_tokens"])), "manage");
    }

    #[test]
    fn lowering_a_table_explodes_its_ancestors() {
        let p = project();
        let mut g = Levels::new();
        g.insert("project:p".into(), "edit");
        let (_, path) = locate(std::slice::from_ref(&p), "table", "t1").unwrap();
        apply_level(&p, &path, "read", &mut g);
        assert_eq!(g.get("project:p"), None);
        assert_eq!(g.get("base:b2"), Some(&"edit"));
        assert_eq!(g.get("table:t1"), Some(&"read"));
        assert_eq!(g.get("table:t2"), Some(&"edit"));
        let cells = cells_of(std::slice::from_ref(&p), &g);
        assert_eq!(cells["base:b1"]["level"], "granular");
        assert_eq!(cells["project:p"]["level"], "granular");
        assert_eq!(cells["base:b2"]["level"], "edit");
    }

    #[test]
    fn redundant_grants_are_dropped() {
        let p = project();
        let mut g = Levels::new();
        g.insert("table:t3".into(), "read");
        let (_, path) = locate(std::slice::from_ref(&p), "project", "p").unwrap();
        apply_level(&p, &path, "manage", &mut g);
        assert_eq!(g.len(), 1);
        assert_eq!(g.get("project:p"), Some(&"manage"));
        let (_, path) = locate(std::slice::from_ref(&p), "project", "p").unwrap();
        apply_level(&p, &path, "none", &mut g);
        assert!(g.is_empty());
    }
}
