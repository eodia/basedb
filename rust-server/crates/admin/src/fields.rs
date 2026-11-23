//! `admin/fields.ts`: field rules, group by group, and what one person ends up with.

use crate::access::group_levels_on_table;
use crate::common::{administering, audit, fields, strict_json};
use crate::groups::{ensure_system_groups, load_group, load_groups, GroupSummary};
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::decide::{decide, Action, FieldSet, Verdict, SYSTEM_COLUMNS};
use basedb_base::rbac::loader::{load_grants, load_target};
use basedb_base::rbac::require::require_administration;
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use std::collections::HashMap;

/// `/^[0-9a-f-]{36}$/i`.
pub fn uuid_shaped(s: &str) -> bool {
    s.len() == 36 && s.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-')
}

struct Table {
    json: Value,
    fields: Vec<(String, String, String, String)>,
}

async fn load_table<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<Table, AppError> {
    if !uuid_shaped(table_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let row = exec
        .first(
            "SELECT td.id::text, tn.name, td.label, b.id::text AS base_id, sn.name AS base_name,
                    b.label AS base_label
               FROM _basedb.table_def td
               JOIN _basedb.base b           ON b.id = td.base_id
               JOIN _basedb.tenant t         ON t.id = b.tenant_id
               JOIN _basedb.physical_name tn ON tn.id = td.name_id
               JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                            AND s.dropped_at IS NULL
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE td.id = $1::text::uuid AND t.ref = $2 AND td.is_live AND b.is_live",
            &[&table_id, &ctx.tenant_id],
        )
        .await?;
    let Some(t) = row else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("tableId", json!(table_id))) };
    let json = json!({
        "id": t.get::<_, String>(0),
        "name": t.get::<_, String>(1),
        "label": t.get::<_, String>(2),
        "base": { "id": t.get::<_, String>(3), "name": t.get::<_, String>(4), "label": t.get::<_, String>(5) },
    });
    let rows = exec
        .rows(
            "SELECT f.id::text, n.name, f.label, f.kind
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live
              ORDER BY f.position",
            &[&table_id],
        )
        .await?;
    let fields = rows
        .iter()
        .map(|r| (r.get(0), r.get(1), r.get(2), r.get(3)))
        .filter(|f: &(String, String, String, String)| !SYSTEM_COLUMNS.contains(&f.1.as_str()))
        .collect();
    Ok(Table { json, fields })
}

/// Group → field → rule. The catalog's `read` is the screen's `read_only`.
async fn load_rules<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<HashMap<String, IndexMap<String, &'static str>>, AppError> {
    let rows = exec
        .rows(
            "SELECT fp.role_id::text, fp.field_id::text, fp.access
               FROM _basedb.field_permission fp
               JOIN _basedb.field f ON f.id = fp.field_id
              WHERE f.table_id = $1::text::uuid AND f.is_live AND fp.access IN ('hidden', 'read')",
            &[&table_id],
        )
        .await?;
    let mut out: HashMap<String, IndexMap<String, &'static str>> = HashMap::new();
    for r in &rows {
        let access: String = r.get(2);
        out.entry(r.get(0)).or_default().insert(r.get(1), if access == "hidden" { "hidden" } else { "read_only" });
    }
    Ok(out)
}

fn rules_json(rules: Option<&IndexMap<String, &'static str>>) -> Value {
    Value::Object(rules.map(|r| r.iter().map(|(k, v)| (k.clone(), json!(v))).collect::<Map<_, _>>()).unwrap_or_default())
}

/// `buildFieldAccess`, serialized as app.ts's `serializeFieldAccess`.
async fn build_field_access<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<Value, AppError> {
    let table = load_table(exec, ctx, table_id).await?;
    let levels = group_levels_on_table(exec, ctx, table_id).await?.unwrap_or_default();
    let rules = load_rules(exec, table_id).await?;
    let groups = load_groups(exec, ctx).await?;
    let groups: Vec<Value> = groups
        .iter()
        .map(|g: &GroupSummary| {
            let mut v = g.json();
            v["level"] = json!(levels.get(&g.id).copied().unwrap_or("none"));
            v["rules"] = if g.system == Some("admins") { json!({}) } else { rules_json(rules.get(&g.id)) };
            v
        })
        .collect();
    Ok(json!({
        "table": table.json,
        "fields": table.fields.iter().map(|f| json!({ "id": f.0, "name": f.1, "label": f.2, "kind": f.3 })).collect::<Vec<_>>(),
        "groups": groups,
    }))
}

pub async fn field_access(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, table)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (c, t) = (&ctx, &table);
    let access = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        ensure_system_groups(&tx, &c.tenant_id, &c.actor.id).await?;
        build_field_access(&tx, c, t).await
    })
    .await?;
    Ok(json_ok(json!({ "data": access })))
}

pub async fn set_field_rule(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, field)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let group = body.get("group");
    let rule = body.get("rule");
    let Some(group) = group.filter(|g| g.is_string()).cloned() else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("group, rule")));
    };
    // `body.rule !== null && typeof body.rule !== 'string'`: an absent rule is refused too.
    let rule: Option<String> = match rule {
        Some(Value::Null) => None,
        Some(Value::String(s)) => Some(s.clone()),
        _ => return Err(AppError::new("REQUEST_INVALID").with("field", json!("group, rule"))),
    };
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    if rule.as_deref().is_some_and(|r| r != "hidden" && r != "read_only") {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("rule")));
    }
    if !uuid_shaped(&field) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let (c, s, g, f, r) = (&ctx, &session_id, &group, &field, &rule);
    let access = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        crate::groups::administer(&tx, c, s).await?;
        let group = load_group(&tx, c, g).await?;
        if group.system == Some("admins") {
            return Err(AppError::new("GROUP_SYSTEM_IMMUTABLE"));
        }
        let row = tx
            .first(
                "SELECT f.table_id::text, f.label, n.name
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n ON n.id = f.name_id
                   JOIN _basedb.table_def td    ON td.id = f.table_id
                   JOIN _basedb.base b          ON b.id = td.base_id
                   JOIN _basedb.tenant t        ON t.id = b.tenant_id
                  WHERE f.id = $1::text::uuid AND t.ref = $2 AND f.is_live AND td.is_live",
                &[f, &c.tenant_id],
            )
            .await?;
        let Some((table_id, label, _)) = row.map(|r| (r.get::<_, String>(0), r.get::<_, String>(1), r.get::<_, String>(2))).filter(|x| !SYSTEM_COLUMNS.contains(&x.2.as_str())) else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("fieldId", json!(f)));
        };
        let levels = group_levels_on_table(&tx, c, &table_id).await?;
        if r.is_some() && levels.as_ref().and_then(|l| l.get(&group.id)).copied().unwrap_or("none") == "none" {
            return Err(AppError::new("PERMISSION_OUT_OF_SCOPE").with("group", json!(group.id)).with("field", json!(f)));
        }
        match r.as_deref() {
            None => {
                tx.execute_op("DELETE FROM _basedb.field_permission WHERE role_id = $1::text::uuid AND field_id = $2::text::uuid", &[&group.id, f], SqlOp::Delete).await?;
            }
            Some(rule) => {
                let access = if rule == "hidden" { "hidden" } else { "read" };
                tx.execute_op(
                    "INSERT INTO _basedb.field_permission (role_id, field_id, access)
                     VALUES ($1::text::uuid, $2::text::uuid, $3)
                     ON CONFLICT (role_id, field_id) DO UPDATE SET access = EXCLUDED.access",
                    &[&group.id, f, &access],
                    SqlOp::Insert,
                )
                .await?;
            }
        }
        audit(&tx, c, "field_permission.set", "field", Some(f), Some(&label), json!({ "group": group.id, "rule": r })).await?;
        build_field_access(&tx, c, &table_id).await
    })
    .await?;
    Ok(json_ok(json!({ "data": access })))
}

pub async fn field_mask(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, table)): Path<(String, String)>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let user_id = q.get("user").cloned().unwrap_or_default();
    if !uuid_shaped(&user_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let (c, t, u) = (&ctx, &table, &user_id);
    let mask = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        let user = tx
            .first(
                "SELECT u.id::text, u.display_name, u.email
                   FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
                  WHERE u.id = $1::text::uuid AND t.ref = $2 AND u.deleted_at IS NULL AND NOT u.is_system",
                &[u, &c.tenant_id],
            )
            .await?;
        let Some(user) = user else { return Err(AppError::new("RESOURCE_NOT_FOUND")) };
        let (uid, name, email): (String, String, String) = (user.get(0), user.get(1), user.get(2));
        let table = load_table(&tx, c, t).await?;

        let person = RequestContext::new(c.request_id.clone(), Actor::user(uid.clone()), c.tenant_id.clone(), Surface::Ui);
        let (mut readable, mut writable) = (FieldSet::new(), FieldSet::new());
        let mut reads_table = false;
        match load_grants(&tx, &person).await {
            Ok(grants) => {
                if let Some(target) = load_target(&tx, &person, t).await? {
                    let d = decide(&person, &grants, Action::Read, &target);
                    if d.verdict == Verdict::Allowed {
                        reads_table = true;
                        readable = d.readable_fields;
                        writable = d.writable_fields;
                    }
                }
            }
            Err(e) if e.code == "AUTHENTICATION_REQUIRED" => {}
            Err(e) => return Err(e),
        }

        let member_of: Vec<String> = tx
            .rows(
                "SELECT m.role_id::text FROM _basedb.role_member m
                   JOIN _basedb.role r ON r.id = m.role_id AND r.kind = 'group' AND r.deleted_at IS NULL
                  WHERE m.user_id = $1::text::uuid",
                &[&uid],
            )
            .await?
            .iter()
            .map(|r| r.get(0))
            .collect();
        let groups = load_groups(&tx, c).await?;
        let levels = group_levels_on_table(&tx, c, t).await?.unwrap_or_default();
        let rules = load_rules(&tx, t).await?;
        let empty = IndexMap::new();
        let mine: Vec<(String, bool, &IndexMap<String, &'static str>)> = member_of
            .iter()
            .filter_map(|id| groups.iter().find(|g| &g.id == id))
            .map(|g| {
                let reads = levels.get(&g.id).copied().unwrap_or("none") != "none";
                let r = if g.system == Some("admins") { &empty } else { rules.get(&g.id).unwrap_or(&empty) };
                (g.label.clone(), reads, r)
            })
            .collect();
        let fields: Vec<Value> = table
            .fields
            .iter()
            .map(|f| {
                let level = if writable.contains(&f.0) { "write" } else if readable.contains(&f.0) { "read" } else { "hidden" };
                let via: Vec<&String> = if reads_table { mine.iter().filter(|g| g.1 && g.2.get(&f.0) != Some(&"hidden")).map(|g| &g.0).collect() } else { vec![] };
                let restricted: Vec<Value> = mine.iter().filter(|g| g.1 && g.2.contains_key(&f.0)).map(|g| json!({ "group": g.0, "rule": g.2[&f.0] })).collect();
                json!({ "id": f.0, "level": level, "readable_via": via, "restricted_by": restricted })
            })
            .collect();
        Ok(json!({
            "user": { "id": uid, "display_name": name, "email": email },
            "reads_table": reads_table,
            "fields": fields,
        }))
    })
    .await?;
    Ok(json_ok(json!({ "data": mask })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_shape_is_nodes_regex() {
        assert!(uuid_shaped("0190f3a2-0000-7000-8000-00000000ABCD"));
        assert!(uuid_shaped(&"-".repeat(36)));
        assert!(!uuid_shaped("0190f3a2"));
        assert!(!uuid_shaped("0190f3a2-0000-7000-8000-00000000abcg"));
    }
}
