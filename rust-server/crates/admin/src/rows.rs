//! `admin/rows.ts`: row rules, group by group (05 §16) — what the screen lists, and how many
//! rows one person ends up seeing.
//!
//! `PUT …/access/tables/{table}/rows` compiles the rule with the filter builder of the
//! domain `records` (registered through `rbac::rows::set_row_rule_compiler`; its compile
//! errors are the answer) and switches PostgreSQL's row security (`sql/row-security.ts`).

use crate::access::group_levels_on_table;
use crate::common::{administering, audit, fields, js_trim, require_elevated_session, strict_json};
use crate::fields::uuid_shaped;
use crate::groups::{ensure_system_groups, load_group, load_groups};
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::{load_grants, load_target};
use basedb_base::rbac::require::require_administration;
use basedb_base::rbac::rows::{compile_row_rule, ROW_ALIAS};
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_contracts::naming::{qualify, quote_identifier, quote_literal};
use serde_json::{json, Value};
use std::collections::HashMap;

/// `READ_TIME_KINDS` of `rbac/rows.ts`: no column for a rule to compare.
const READ_TIME_KINDS: [&str; 4] = ["lookup", "rollup", "count", "button"];

struct Table {
    id: String,
    json: Value,
    schema_name: String,
    name: String,
    /// id, name, label, kind.
    fields: Vec<(String, String, String, String)>,
    /// field id, value, label.
    options: Vec<(String, String, String)>,
}

async fn load_table<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<Table, AppError> {
    if !uuid_shaped(table_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let row = exec
        .first(
            "SELECT td.id::text, tn.name, td.label, b.id::text AS base_id, sn.name AS base_name,
                    b.label AS base_label, tsn.name AS schema_name
               FROM _basedb.table_def td
               JOIN _basedb.base b           ON b.id = td.base_id
               JOIN _basedb.tenant t         ON t.id = b.tenant_id
               JOIN _basedb.physical_name tn ON tn.id = td.name_id
               JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                            AND s.dropped_at IS NULL
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
               JOIN _basedb.db_schema ts     ON ts.id = td.schema_id
               JOIN _basedb.physical_name tsn ON tsn.id = ts.name_id
              WHERE td.id = $1::text::uuid AND t.ref = $2 AND td.is_live AND b.is_live",
            &[&table_id, &ctx.tenant_id],
        )
        .await?;
    let Some(t) = row else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("tableId", json!(table_id))) };
    let fields = exec
        .rows(
            "SELECT f.id::text, n.name, f.label, f.kind
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live
              ORDER BY f.position",
            &[&table_id],
        )
        .await?
        .iter()
        .map(|r| (r.get(0), r.get(1), r.get(2), r.get(3)))
        .collect();
    let options = exec
        .rows(
            "SELECT o.field_id::text, o.value, o.label
               FROM _basedb.select_option o
               JOIN _basedb.field f ON f.id = o.field_id
              WHERE f.table_id = $1::text::uuid AND o.deleted_at IS NULL
              ORDER BY o.position",
            &[&table_id],
        )
        .await?
        .iter()
        .map(|r| (r.get(0), r.get(1), r.get(2)))
        .collect();
    Ok(Table {
        id: t.get(0),
        name: t.get(1),
        schema_name: t.get(6),
        json: json!({
            "id": t.get::<_, String>(0),
            "name": t.get::<_, String>(1),
            "label": t.get::<_, String>(2),
            "base": { "id": t.get::<_, String>(3), "name": t.get::<_, String>(4), "label": t.get::<_, String>(5) },
        }),
        fields,
        options,
    })
}

async fn load_rules<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<HashMap<String, String>, AppError> {
    Ok(exec
        .rows("SELECT role_id::text, filter FROM _basedb.row_permission WHERE table_id = $1::text::uuid", &[&table_id])
        .await?
        .iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect())
}

/// `buildRowAccess`, serialized as app.ts's `serializeRowAccess`.
async fn build_row_access<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<Value, AppError> {
    let table = load_table(exec, ctx, table_id).await?;
    let levels = group_levels_on_table(exec, ctx, table_id).await?.unwrap_or_default();
    let rules = load_rules(exec, table_id).await?;
    let groups = load_groups(exec, ctx).await?;
    let fields: Vec<Value> = table
        .fields
        .iter()
        .filter(|f| !READ_TIME_KINDS.contains(&f.3.as_str()))
        .map(|f| {
            let own: Vec<Value> = table.options.iter().filter(|o| o.0 == f.0).map(|o| json!({ "value": o.1, "label": o.2 })).collect();
            let mut v = json!({ "name": f.1, "label": f.2, "kind": f.3 });
            if !own.is_empty() {
                v["options"] = json!(own);
            }
            v
        })
        .collect();
    let groups: Vec<Value> = groups
        .iter()
        .map(|g| {
            let mut v = g.json();
            v["level"] = json!(levels.get(&g.id).copied().unwrap_or("none"));
            v["rule"] = if g.system == Some("admins") { Value::Null } else { rules.get(&g.id).map(|r| json!(r)).unwrap_or(Value::Null) };
            v
        })
        .collect();
    Ok(json!({ "table": table.json, "fields": fields, "groups": groups }))
}

/// `GET /api/v1/{tenant}/admin/access/tables/{table}/rows`.
pub async fn row_access(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, table)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (c, t) = (&ctx, &table);
    let access = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        ensure_system_groups(&tx, &c.tenant_id, &c.actor.id).await?;
        build_row_access(&tx, c, t).await
    })
    .await?;
    Ok(json_ok(json!({ "data": access })))
}

const CONSOLE_ROLE: &str = "basedb_console";
const CONSOLE_POLICY: &str = "basedb_console_all";
const READER_PREFIX: &str = "basedb_rows_";

/// `enableRowSecurity`: row security on, the console keeping every row.
async fn enable_row_security<E: Exec + Sync>(exec: &E, relation: &str) -> Result<(), AppError> {
    let role = quote_literal(CONSOLE_ROLE);
    let sql = format!(
        "DO $do$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {role}) THEN
         EXECUTE 'CREATE ROLE ' || quote_ident({role}) || ' NOLOGIN';
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = {}::regclass
                                                 AND polname = {}) THEN
         EXECUTE 'CREATE POLICY {CONSOLE_POLICY} ON {} FOR ALL TO '
                 || quote_ident({role}) || ' USING (true) WITH CHECK (true)';
       END IF;
     END $do$;",
        quote_literal(relation),
        quote_literal(CONSOLE_POLICY),
        relation.replace('\'', "''"),
    );
    exec.execute_op(&sql, &[], SqlOp::Ddl).await?;
    exec.execute_op(&format!("ALTER TABLE {relation} ENABLE ROW LEVEL SECURITY"), &[], SqlOp::Ddl).await?;
    Ok(())
}

/// `disableRowSecurity`: row security off, the product's policies gone with it.
async fn disable_row_security<E: Exec + Sync>(exec: &E, relation: &str) -> Result<(), AppError> {
    let like = format!("{READER_PREFIX}%");
    let policies: Vec<String> = exec
        .rows(
            "SELECT polname::text FROM pg_policy
      WHERE polrelid = $1::text::regclass AND (polname = $2 OR polname LIKE $3)",
            &[&relation, &CONSOLE_POLICY, &like],
        )
        .await?
        .iter()
        .map(|r| r.get(0))
        .collect();
    for polname in policies {
        let quoted = quote_identifier(&polname).map_err(|e| AppError::new("IDENTIFIER_INVALID").with("identifier", json!(e.0)))?;
        exec.execute_op(&format!("DROP POLICY IF EXISTS {quoted} ON {relation}"), &[], SqlOp::Ddl).await?;
    }
    exec.execute_op(&format!("ALTER TABLE {relation} DISABLE ROW LEVEL SECURITY"), &[], SqlOp::Ddl).await?;
    Ok(())
}

/// `PUT /api/v1/{tenant}/admin/access/tables/{table}/rows`: sets — or lifts, with `null` — one
/// group's rule on one table (`setRowRule`).
pub async fn set_row_rule(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, table)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let group = body.get("group").and_then(Value::as_str).map(str::to_string);
    let rule = body.get("rule");
    let rule_ok = matches!(rule, Some(Value::Null) | Some(Value::String(_)));
    let Some(group) = group.filter(|_| rule_ok) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("group, rule")));
    };
    let rule: Option<String> = rule.and_then(Value::as_str).map(js_trim).filter(|r| !r.is_empty()).map(str::to_string);
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let (c, s, t, g, r) = (&ctx, &session_id, &table, &group, &rule);
    let (access, relation, ruled) = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        require_elevated_session(&tx, c, s).await?;
        ensure_system_groups(&tx, &c.tenant_id, &c.actor.id).await?;
        let group = load_group(&tx, c, &json!(g)).await?;
        if group.system == Some("admins") {
            return Err(AppError::new("GROUP_SYSTEM_IMMUTABLE"));
        }
        let table = load_table(&tx, c, t).await?;
        match r {
            None => {
                tx.execute_op(
                    "DELETE FROM _basedb.row_permission WHERE role_id = $1::text::uuid AND table_id = $2::text::uuid",
                    &[&group.id, &table.id],
                    SqlOp::Delete,
                )
                .await?;
            }
            Some(rule) => {
                let levels = group_levels_on_table(&tx, c, &table.id).await?;
                let level = levels.and_then(|l| l.get(&group.id).copied()).unwrap_or("none");
                if level == "none" || level == "manage" {
                    return Err(AppError::new("PERMISSION_OUT_OF_SCOPE")
                        .with("group", json!(group.id))
                        .with("table", json!(table.id))
                        .with("level", json!(level)));
                }
                let rule_fields: Vec<(String, String)> = table.fields.iter().map(|f| (f.1.clone(), f.3.clone())).collect();
                compile_row_rule(rule, &rule_fields)?;
                tx.execute_op(
                    "INSERT INTO _basedb.row_permission (role_id, table_id, filter, created_by, updated_by)
         VALUES ($1::text::uuid, $2::text::uuid, $3, $4::text::uuid, $4::text::uuid)
         ON CONFLICT (role_id, table_id) DO UPDATE
            SET filter = EXCLUDED.filter, updated_by = EXCLUDED.updated_by,
                updated_at = clock_timestamp()",
                    &[&group.id, &table.id, rule, &c.actor.id],
                    SqlOp::Insert,
                )
                .await?;
            }
        }
        let label = table.json["label"].as_str().map(str::to_string);
        audit(&tx, c, "row_permission.set", "table", Some(&table.id), label.as_deref(), json!({ "group": group.id, "rule": r })).await?;
        let left: i32 = tx
            .first("SELECT count(*)::int AS n FROM _basedb.row_permission WHERE table_id = $1::text::uuid", &[&table.id])
            .await?
            .map(|row| row.get(0))
            .unwrap_or(0);
        let access = build_row_access(&tx, c, &table.id).await?;
        let relation = qualify(&table.schema_name, &table.name).map_err(|e| AppError::new("IDENTIFIER_INVALID").with("identifier", json!(e.0)))?;
        Ok((access, relation, left > 0))
    })
    .await?;
    let rel = &relation;
    with_transaction(&st.pools, PoolName::Ddl, c, TxOptions::default(), |tx| async move {
        if ruled {
            enable_row_security(&tx, rel).await
        } else {
            disable_row_security(&tx, rel).await
        }
    })
    .await?;
    Ok(json_ok(json!({ "data": access })))
}

/// `GET /api/v1/{tenant}/admin/access/tables/{table}/rows/effective`: how many rows of the
/// table one person sees — counted with the decider's own predicate — and through which of
/// their groups.
pub async fn effective_rows(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, table)): Path<(String, String)>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let user_id = q.get("user").cloned().unwrap_or_default();
    if !uuid_shaped(&user_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let (c, t, u) = (&ctx, &table, &user_id);
    let (user, relation, predicate, via) = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
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
        let mut predicate: Option<String> = None;
        match load_grants(&tx, &person).await {
            Ok(grants) => {
                if let Some(target) = load_target(&tx, &person, &table.id).await? {
                    let d = decide(&person, &grants, Action::Read, &target);
                    if d.verdict == Verdict::Allowed {
                        predicate = Some(d.row_predicate);
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
        let levels = group_levels_on_table(&tx, c, &table.id).await?.unwrap_or_default();
        let rules = load_rules(&tx, &table.id).await?;
        let via: Vec<Value> = member_of
            .iter()
            .filter_map(|id| groups.iter().find(|g| &g.id == id))
            .filter(|g| levels.get(&g.id).copied().unwrap_or("none") != "none")
            .map(|g| {
                let rule = if g.system == Some("admins") || levels.get(&g.id).copied() == Some("manage") { Value::Null } else { rules.get(&g.id).map(|r| json!(r)).unwrap_or(Value::Null) };
                json!({ "group": g.label, "rule": rule })
            })
            .collect();
        let relation = qualify(&table.schema_name, &table.name).map_err(|e| AppError::new("IDENTIFIER_INVALID").with("identifier", json!(e.0)))?;
        Ok((json!({ "id": uid, "display_name": name, "email": email }), relation, predicate, via))
    })
    .await?;
    let conn = st.pools.get(PoolName::Data).await?;
    let counts = conn
        .first(
            &format!(
                "SELECT count(*)::int AS total,
              count(*) FILTER (WHERE ( /*predicat_lignes*/ {} ))::int AS visible
         FROM {relation} AS \"{ROW_ALIAS}\"",
                predicate.as_deref().unwrap_or("FALSE")
            ),
            &[],
        )
        .await?;
    let (total, visible) = counts.map(|r| (r.get::<_, i32>(0), r.get::<_, i32>(1))).unwrap_or((0, 0));
    Ok(json_ok(json!({
        "data": { "user": user, "reads_table": predicate.is_some(), "total": total, "visible": visible, "via": via }
    })))
}
