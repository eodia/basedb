//! Writing rows — `records/create.ts`, `update.ts`, `update-many.ts`, `link-scope.ts`,
//! `sync/guard.ts`, and the staleness of AI cells (`ai/field.ts`).
//!
//! Two transactions as in Node: the plan in a read-only catalog transaction (grants,
//! masks, defaults, shaped values, link scopes), the statement in a data transaction.
//! History rows are written by the table's triggers.

use crate::pg::{col, refs, row_object, P};
use crate::values::{entries_of, get, is_file_kind, load_defaults, resolve_defaults, shape_values, shaped_fields, time_zone_of, Entries, FieldDefault, Shaped};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Verdict, SYSTEM_COLUMNS};
use basedb_base::rbac::loader::{load_fields, load_grants, load_target};
use basedb_base::rbac::rows::ROW_ALIAS;
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use basedb_contracts::naming::{qualify, quote_identifier};
use indexmap::IndexSet;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

pub const BATCH_MAX_OPERATIONS: usize = 1000;
const IN_SCOPE: &str = "basedb_in_scope";

fn q(name: &str) -> Result<String, AppError> {
    quote_identifier(name).map_err(|e| AppError::internal(e.0))
}

/// `withIndex`: the error of the `index`-th operation of a batch.
pub fn with_index(e: AppError, index: usize) -> AppError {
    e.with("index", json!(index))
}

/// `refuseSynced`.
pub(crate) async fn refuse_synced<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<(), AppError> {
    if ctx.actor.kind == ActorKind::System {
        return Ok(());
    }
    let params = [P::text(table_id)];
    let row = exec.first("SELECT EXISTS (SELECT 1 FROM _basedb.table_sync WHERE table_id = $1) AS yes", &refs(&params)).await?;
    if row.map(|r| col(&r, 0) == Value::Bool(true)).unwrap_or(false) {
        return Err(AppError::new("TABLE_SYNCED").with("table", json!(table_id)));
    }
    Ok(())
}

async fn relation_of<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<String, AppError> {
    let params = [P::text(table_id)];
    let row = exec
        .first(
            "SELECT sn.name AS schema_name, tn.name AS table_name
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1",
            &refs(&params),
        )
        .await?
        .ok_or_else(|| AppError::internal("Cannot read properties of undefined (reading 'schema_name')"))?;
    let schema = col(&row, 0);
    let table = col(&row, 1);
    qualify(schema.as_str().unwrap_or_default(), table.as_str().unwrap_or_default()).map_err(|e| AppError::internal(e.0))
}

// ── Link scope (`records/link-scope.ts`) ─────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct LinkCheck {
    relation: String,
    predicate: String,
    ids: Vec<String>,
}

fn ids_of(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::String(s) => out.push(s.clone()),
        Value::Array(items) => items.iter().for_each(|v| ids_of(v, out)),
        Value::Object(m) => {
            if let Some(Value::String(s)) = m.get("id") {
                out.push(s.clone());
            }
        }
        _ => {}
    }
}

fn ids_in(value: Option<&Value>) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(v) = value {
        ids_of(v, &mut out);
    }
    out
}

/// `linkScopeChecks`: the written links whose target the actor reads only in part.
async fn link_scope_checks<E: Exec + Sync>(exec: &E, ctx: &RequestContext, grants: &ActorGrants, links: &[(String, String)], values: &Entries) -> Result<Vec<LinkCheck>, AppError> {
    let written: Vec<&(String, String)> = links.iter().filter(|(name, _)| !ids_in(get(values, name)).is_empty()).collect();
    if written.is_empty() {
        return Ok(Vec::new());
    }
    let field_ids: Vec<Value> = written.iter().map(|(_, id)| json!(id)).collect();
    let params = [P::of(&Value::Array(field_ids))];
    let targets: Vec<Map<String, Value>> = exec
        .rows(
            "SELECT flc.field_id::text, flc.target_table_id::text, sn.name AS schema_name,
            tn.name AS table_name
       FROM _basedb.field_link_config flc
       JOIN _basedb.table_def t      ON t.id = flc.target_table_id
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE flc.field_id = ANY($1::uuid[])",
            &refs(&params),
        )
        .await?
        .iter()
        .map(row_object)
        .collect();
    let mut checks = Vec::new();
    for (name, field_id) in written {
        let s = |m: &Map<String, Value>, k: &str| m.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
        let Some(link) = targets.iter().find(|t| s(t, "field_id") == *field_id) else { continue };
        let Some(target) = load_target(exec, ctx, &s(link, "target_table_id")).await? else { continue };
        let decision = decide(ctx, grants, Action::Read, &target);
        if decision.verdict != Verdict::Allowed || decision.row_predicate == "TRUE" {
            continue;
        }
        let mut ids: Vec<String> = Vec::new();
        for id in ids_in(get(values, name)) {
            if !ids.contains(&id) {
                ids.push(id);
            }
        }
        checks.push(LinkCheck {
            relation: qualify(&s(link, "schema_name"), &s(link, "table_name")).map_err(|e| AppError::internal(e.0))?,
            predicate: decision.row_predicate.clone(),
            ids,
        });
    }
    Ok(checks)
}

/// `assertLinkScope`.
async fn assert_link_scope<E: Exec + Sync>(exec: &E, checks: &[LinkCheck]) -> Result<(), AppError> {
    for check in checks {
        let sql = format!(
            "SELECT count(*)::int AS n
         FROM {} AS \"{ROW_ALIAS}\"
        WHERE \"_id\" = ANY($1::uuid[])
          AND ( /*predicat_lignes*/ {} )",
            check.relation, check.predicate
        );
        let params = [P::of(&json!(check.ids))];
        let row = exec.first(&sql, &refs(&params)).await?;
        let n = row.map(|r| col(&r, 0).as_f64().unwrap_or(0.0)).unwrap_or(0.0);
        if n < check.ids.len() as f64 {
            return Err(AppError::new("LINK_TARGET_NOT_FOUND"));
        }
    }
    Ok(())
}

// ── Creating (`records/create.ts`) ────────────────────────────────────────────────

struct WriteContext {
    relation: String,
    readable: IndexSet<String>,
    writable: IndexSet<String>,
    actor_id: Option<String>,
    returning: String,
    shaped: HashMap<String, Shaped>,
    file_columns: Vec<String>,
    row_check: Option<String>,
    grants: ActorGrants,
    links: Vec<(String, String)>,
    raw_defaults: Vec<(String, FieldDefault)>,
    defaults: Vec<(String, Value)>,
}

struct Plan {
    sql: String,
    params: Vec<P>,
    links: Vec<LinkCheck>,
}

fn not_found_table(table_id: &str) -> AppError {
    AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id))
}

async fn load_write_context<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<WriteContext, AppError> {
    let grants = load_grants(exec, ctx).await?;
    let Some(target) = load_target(exec, ctx, table_id).await? else { return Err(not_found_table(table_id)) };
    let decision = decide(ctx, &grants, Action::Create, &target);
    match decision.verdict {
        Verdict::Invisible => return Err(not_found_table(table_id)),
        Verdict::Forbidden => return Err(AppError::new("ADMIN_REQUIRED").with("table", json!(table_id)).with("action", json!("create"))),
        Verdict::Allowed => {}
    }
    refuse_synced(exec, ctx, table_id).await?;

    let fields = load_fields(exec, table_id).await?;
    let raw_defaults = load_defaults(exec, table_id).await?;
    let timed = raw_defaults.iter().any(|(_, d)| d.kind == "today");
    let tz = if timed { time_zone_of(exec, Some(&ctx.actor.id)).await? } else { "UTC".into() };
    let defaults = resolve_defaults(&raw_defaults, Some(&ctx.actor.id), &tz, ctx.timestamp);
    let relation = relation_of(exec, table_id).await?;

    let readable: Vec<String> = fields.iter().filter(|f| decision.readable_fields.contains(&f.id) && f.stored).map(|f| f.name.clone()).collect();
    let mut returning = Vec::new();
    for c in SYSTEM_COLUMNS.iter().copied().chain(readable.iter().map(String::as_str)) {
        returning.push(q(c)?);
    }
    Ok(WriteContext {
        relation,
        writable: fields.iter().filter(|f| decision.writable_fields.contains(&f.id)).map(|f| f.name.clone()).collect(),
        readable: readable.into_iter().collect(),
        actor_id: Some(ctx.actor.id.clone()),
        returning: returning.join(", "),
        shaped: shaped_fields(&fields),
        file_columns: fields.iter().filter(|f| decision.readable_fields.contains(&f.id) && is_file_kind(&f.kind)).map(|f| f.name.clone()).collect(),
        row_check: if decision.row_predicate == "TRUE" { None } else { Some(decision.row_predicate.clone()) },
        grants,
        links: fields.iter().filter(|f| f.kind == "link" || f.kind == "multi_link").map(|f| (f.name.clone(), f.id.clone())).collect(),
        raw_defaults,
        defaults,
    })
}

/// `planRow`: the `INSERT` of one row.
fn plan_row(c: &WriteContext, values: &Entries, returning: &str) -> Result<(String, Vec<P>), AppError> {
    let mut columns: Vec<String> = Vec::new();
    let mut params: Vec<P> = Vec::new();
    for (name, value) in values {
        if !c.readable.contains(name) {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(name)));
        }
        if !c.writable.contains(name) {
            return Err(AppError::new("FIELD_NOT_WRITABLE").with("field", json!(name)));
        }
        columns.push(name.clone());
        params.push(P::of(value));
    }
    if columns.is_empty() {
        return Err(AppError::new("REQUIRED_VALUE_MISSING").with("reason", json!("no writable value supplied")));
    }
    for (name, value) in &c.defaults {
        if values.iter().any(|(k, _)| k == name) {
            continue;
        }
        columns.push(name.clone());
        params.push(P::of(value));
    }
    columns.push("_created_by".into());
    columns.push("_updated_by".into());
    params.push(P(c.actor_id.clone()));
    params.push(P(c.actor_id.clone()));

    let projection = columns.iter().map(|c| q(c)).collect::<Result<Vec<_>, _>>()?.join(", ");
    let placeholders = (1..=columns.len()).map(|i| format!("${i}")).collect::<Vec<_>>().join(", ");
    let sql = match &c.row_check {
        Some(check) => format!(
            "INSERT INTO {} AS {} ({projection})\nVALUES ({placeholders})\nRETURNING {returning},\n          ( /*predicat_lignes*/ {check} ) AS {};",
            c.relation,
            q(ROW_ALIAS)?,
            q(IN_SCOPE)?
        ),
        None => format!("INSERT INTO {} ({projection})\nVALUES ({placeholders})\nRETURNING {returning};", c.relation),
    };
    Ok((sql, params))
}

/// `inScope`: the row the check read, the check taken off it.
fn in_scope(row: &mut Map<String, Value>) -> Result<(), AppError> {
    let Some(holds) = row.shift_remove(IN_SCOPE) else { return Ok(()) };
    if holds != Value::Bool(true) {
        return Err(AppError::new("ROW_OUT_OF_SCOPE"));
    }
    Ok(())
}

/// `currentXact`.
pub(crate) async fn current_xact<E: Exec + Sync>(exec: &E) -> Result<String, AppError> {
    let row = exec.first("SELECT pg_catalog.pg_current_xact_id()::text AS xact", &[]).await?;
    Ok(row.and_then(|r| col(&r, 0).as_str().map(str::to_string)).unwrap_or_default())
}

/// A written row, as the statement returned it.
pub struct Written {
    pub row: Map<String, Value>,
    pub xact: String,
    pub file_columns: Vec<String>,
}

/// `createRecord`.
pub async fn create_record(pools: &Pools, ctx: &RequestContext, table_id: &str, values: Entries) -> Result<Written, AppError> {
    let (plan, file_columns) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let values = values.clone();
        async move {
            let c = load_write_context(&tx, ctx, table_id).await?;
            let values = shape_values(&tx, &c.shaped, &c.writable, values).await?;
            let (sql, params) = plan_row(&c, &values, &c.returning)?;
            let links = link_scope_checks(&tx, ctx, &c.grants, &c.links, &values).await?;
            Ok((Plan { sql, params, links }, c.file_columns))
        }
    })
    .await?;
    let plan = &plan;
    let (row, xact) = with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        assert_link_scope(&tx, &plan.links).await?;
        let rows = tx.query_op(&plan.sql, &refs(&plan.params), SqlOp::Insert).await?;
        let mut row = rows.first().map(row_object);
        if let Some(r) = row.as_mut() {
            in_scope(r)?;
        }
        Ok((row, current_xact(&tx).await?))
    })
    .await?;
    let row = row.ok_or_else(|| AppError::new("INTERNAL_ERROR").with("reason", json!("insert without RETURNING")))?;
    Ok(Written { row, xact, file_columns })
}

/// `createRecordFor`: a row written for someone else's authority — a form's answer. The
/// authority's masks narrowed to `fields`; the writer's identity in the data transaction.
pub async fn create_record_for(pools: &Pools, authority: &RequestContext, writer: &RequestContext, table_id: &str, values: Entries, fields: &HashSet<String>) -> Result<String, AppError> {
    let plan = with_transaction(pools, PoolName::Catalog, authority, TxOptions::read_only(), |tx| {
        let values = values.clone();
        async move {
            let mut c = load_write_context(&tx, authority, table_id).await?;
            let respondent = (writer.actor.kind == ActorKind::User).then(|| writer.actor.id.clone());
            c.readable.retain(|n| fields.contains(n));
            c.writable.retain(|n| fields.contains(n));
            let tz = time_zone_of(&tx, Some(respondent.as_deref().unwrap_or(&authority.actor.id))).await?;
            c.defaults = resolve_defaults(&c.raw_defaults, respondent.as_deref(), &tz, writer.timestamp);
            c.actor_id = respondent;
            c.row_check = None;
            let values = shape_values(&tx, &c.shaped, &c.writable, values).await?;
            let (sql, params) = plan_row(&c, &values, "\"_id\"")?;
            let links = link_scope_checks(&tx, authority, &c.grants, &c.links, &values).await?;
            Ok(Plan { sql, params, links })
        }
    })
    .await?;
    let plan = &plan;
    let id = with_transaction(pools, PoolName::Data, writer, TxOptions::default(), |tx| async move {
        assert_link_scope(&tx, &plan.links).await?;
        let rows = tx.query_op(&plan.sql, &refs(&plan.params), SqlOp::Insert).await?;
        Ok(rows.first().map(|r| col(r, 0)))
    })
    .await?;
    match id {
        Some(Value::String(s)) => Ok(s),
        _ => Err(AppError::new("INTERNAL_ERROR").with("reason", json!("insert without RETURNING"))),
    }
}

/// What a batch did: the ids in request order, and its transaction.
pub struct BatchResult {
    pub ids: Vec<String>,
    pub xact: String,
}

fn batch_bounds(n: usize) -> Result<(), AppError> {
    if n == 0 {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("operations")).with("reason", json!("lot_vide")));
    }
    if n > BATCH_MAX_OPERATIONS {
        return Err(AppError::new("BATCH_TOO_LARGE").with("operations", json!(n)).with("maximum", json!(BATCH_MAX_OPERATIONS)));
    }
    Ok(())
}

/// `createRecords`: all or nothing, one data transaction.
pub async fn create_records(pools: &Pools, ctx: &RequestContext, table_id: &str, records: Vec<Value>) -> Result<BatchResult, AppError> {
    batch_bounds(records.len())?;
    let records = &records;
    let plans = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let c = load_write_context(&tx, ctx, table_id).await?;
        let returning = q("_id")?;
        let mut planned = Vec::new();
        for (index, raw) in records.iter().enumerate() {
            let one = async {
                let values = shape_values(&tx, &c.shaped, &c.writable, entries_of(raw)).await?;
                let (sql, params) = plan_row(&c, &values, &returning)?;
                let links = link_scope_checks(&tx, ctx, &c.grants, &c.links, &values).await?;
                Ok::<_, AppError>(Plan { sql, params, links })
            };
            planned.push(one.await.map_err(|e| with_index(e, index))?);
        }
        Ok(planned)
    })
    .await?;
    let plans = &plans;
    let (ids, xact) = with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let mut created = Vec::new();
        for (index, plan) in plans.iter().enumerate() {
            let one = async {
                assert_link_scope(&tx, &plan.links).await?;
                let rows = tx.query_op(&plan.sql, &refs(&plan.params), SqlOp::Insert).await?;
                let Some(mut row) = rows.first().map(row_object) else {
                    return Err(AppError::internal("Cannot read properties of undefined (reading '_id')"));
                };
                in_scope(&mut row)?;
                Ok(row.get("_id").and_then(Value::as_str).unwrap_or_default().to_string())
            };
            created.push(one.await.map_err(|e| with_index(e, index))?);
        }
        Ok((created, current_xact(&tx).await?))
    })
    .await?;
    Ok(BatchResult { ids, xact })
}

// ── Updating and deleting (`records/update.ts`, `update-many.ts`) ─────────────────

struct RowContext {
    relation: String,
    readable: Vec<String>,
    writable: IndexSet<String>,
    readable_names: IndexSet<String>,
    shaped: HashMap<String, Shaped>,
    file_columns: Vec<String>,
    rows: String,
    grants: ActorGrants,
    links: Vec<(String, String)>,
}

/// `prepare`.
async fn prepare<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str, action: Action) -> Result<RowContext, AppError> {
    let grants = load_grants(exec, ctx).await?;
    let Some(target) = load_target(exec, ctx, table_id).await? else { return Err(not_found_table(table_id)) };
    let decision = decide(ctx, &grants, action, &target);
    match decision.verdict {
        Verdict::Invisible => return Err(not_found_table(table_id)),
        Verdict::Forbidden => return Err(AppError::new("ADMIN_REQUIRED").with("table", json!(table_id)).with("action", json!(action.as_str()))),
        Verdict::Allowed => {}
    }
    refuse_synced(exec, ctx, table_id).await?;
    let fields = load_fields(exec, table_id).await?;
    let relation = relation_of(exec, table_id).await?;
    let readable_all: Vec<&basedb_base::rbac::loader::LoadedField> = fields.iter().filter(|f| decision.readable_fields.contains(&f.id)).collect();
    Ok(RowContext {
        relation,
        readable: readable_all
            .iter()
            .filter(|f| fields.iter().find(|g| g.name == f.name).map(|g| g.stored).unwrap_or(true))
            .map(|f| f.name.clone())
            .collect(),
        writable: fields.iter().filter(|f| decision.writable_fields.contains(&f.id)).map(|f| f.name.clone()).collect(),
        readable_names: readable_all.iter().map(|f| f.name.clone()).collect(),
        shaped: shaped_fields(&fields),
        file_columns: fields.iter().filter(|f| decision.readable_fields.contains(&f.id) && is_file_kind(&f.kind)).map(|f| f.name.clone()).collect(),
        rows: decision.row_predicate.clone(),
        grants,
        links: fields.iter().filter(|f| f.kind == "link" || f.kind == "multi_link").map(|f| (f.name.clone(), f.id.clone())).collect(),
    })
}

/// An AI column and the columns its prompt cites (`loadAiDependents`).
struct AiDependent {
    column: String,
    cited: Vec<String>,
}

static REFERENCE: LazyLock<Regex> = LazyLock::new(|| {
    let ws = r"[\t\n\x0B\x0C\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]";
    Regex::new(&format!(r"\{{\{{{ws}*([^{{}}]+?){ws}*\}}\}}")).unwrap()
});

/// `citedNames`.
fn cited_names(prompt: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for m in REFERENCE.captures_iter(prompt) {
        let name = m[1].to_string();
        if !out.contains(&name) {
            out.push(name);
        }
    }
    out
}

async fn load_ai_dependents<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<Vec<AiDependent>, AppError> {
    let params = [P::text(table_id)];
    let rows = exec
        .rows(
            "SELECT n.name AS column, c.prompt
       FROM _basedb.field_ai_config c
       JOIN _basedb.field f         ON f.id = c.field_id
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live",
            &refs(&params),
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| AiDependent { column: col(r, 0).as_str().unwrap_or_default().to_string(), cited: cited_names(col(r, 1).as_str().unwrap_or_default()) })
        .collect())
}

/// `staleAiAssignments`.
fn stale_ai_assignments(dependents: &[AiDependent], placeholders: &[(String, String)]) -> Result<Vec<String>, AppError> {
    let mut out = Vec::new();
    for ai in dependents {
        let mut changed = Vec::new();
        for name in &ai.cited {
            if let Some((_, p)) = placeholders.iter().find(|(n, _)| n == name) {
                changed.push(format!("{} IS DISTINCT FROM {p}", q(name)?));
            }
        }
        if changed.is_empty() {
            continue;
        }
        let column = q(&ai.column)?;
        out.push(format!("{column} = CASE WHEN {} THEN NULL ELSE {column} END", changed.join(" OR ")));
    }
    Ok(out)
}

/// `planUpdate`.
async fn plan_update<E: Exec + Sync>(exec: &E, ctx: &RequestContext, c: &RowContext, dependents: &[AiDependent], record_id: &str, values: Entries, returning: &str) -> Result<Plan, AppError> {
    let mut assignments = Vec::new();
    let mut params: Vec<P> = Vec::new();
    let mut placeholders: Vec<(String, String)> = Vec::new();
    let values = shape_values(exec, &c.shaped, &c.writable, values).await?;
    for (name, value) in &values {
        if !c.readable_names.contains(name) {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(name)));
        }
        if !c.writable.contains(name) {
            return Err(AppError::new("FIELD_NOT_WRITABLE").with("field", json!(name)));
        }
        params.push(P::of(value));
        placeholders.push((name.clone(), format!("${}", params.len())));
        assignments.push(format!("{} = ${}", q(name)?, params.len()));
    }
    if assignments.is_empty() {
        return Err(AppError::new("REQUIRED_VALUE_MISSING").with("reason", json!("no writable value supplied")));
    }
    assignments.extend(stale_ai_assignments(dependents, &placeholders)?);
    params.push(P::text(ctx.actor.id.clone()));
    assignments.push(format!("\"_updated_by\" = ${}", params.len()));
    assignments.push("\"_updated_at\" = pg_catalog.clock_timestamp()".into());
    params.push(P::text(record_id));
    let links = link_scope_checks(exec, ctx, &c.grants, &c.links, &values).await?;
    Ok(Plan {
        sql: format!(
            "UPDATE {} AS {}\n   SET {}\n WHERE \"_id\" = ${}\n   AND ( /*predicat_lignes*/ {} )\nRETURNING {returning};",
            c.relation,
            q(ROW_ALIAS)?,
            assignments.join(",\n       "),
            params.len(),
            c.rows
        ),
        params,
        links,
    })
}

/// `updateRecord`.
pub async fn update_record(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str, values: Entries) -> Result<Written, AppError> {
    let (plan, file_columns) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let values = values.clone();
        async move {
            let c = prepare(&tx, ctx, table_id, Action::Update).await?;
            let dependents = load_ai_dependents(&tx, table_id).await?;
            let returning = SYSTEM_COLUMNS.iter().copied().chain(c.readable.iter().map(String::as_str)).map(q).collect::<Result<Vec<_>, _>>()?.join(", ");
            let plan = plan_update(&tx, ctx, &c, &dependents, record_id, values, &returning).await?;
            Ok((plan, c.file_columns))
        }
    })
    .await?;
    let plan = &plan;
    let (row, xact) = with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        assert_link_scope(&tx, &plan.links).await?;
        let rows = tx.query_op(&plan.sql, &refs(&plan.params), SqlOp::Update).await?;
        Ok((rows.first().map(row_object), current_xact(&tx).await?))
    })
    .await?;
    let row = row.ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record_id)))?;
    Ok(Written { row, xact, file_columns })
}

/// `updateRecords`: all or nothing, rows locked in id order.
pub async fn update_records(pools: &Pools, ctx: &RequestContext, table_id: &str, updates: Vec<(String, Value)>) -> Result<BatchResult, AppError> {
    batch_bounds(updates.len())?;
    let mut seen = HashSet::new();
    for (index, (id, _)) in updates.iter().enumerate() {
        if !seen.insert(id.to_lowercase()) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("operations")).with("index", json!(index)).with("reason", json!("ligne_en_double")));
        }
    }
    let updates = &updates;
    let plans = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let c = prepare(&tx, ctx, table_id, Action::Update).await?;
        let dependents = load_ai_dependents(&tx, table_id).await?;
        let returning = q("_id")?;
        let mut planned = Vec::new();
        for (index, (id, data)) in updates.iter().enumerate() {
            let one = async {
                if !crate::js::is_uuid_ci(id) {
                    return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(id)));
                }
                plan_update(&tx, ctx, &c, &dependents, &id.to_lowercase(), entries_of(data), &returning).await
            };
            planned.push(one.await.map_err(|e| with_index(e, index))?);
        }
        Ok(planned)
    })
    .await?;
    let plans = &plans;
    let (ids, xact) = with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let mut order: Vec<usize> = (0..updates.len()).collect();
        order.sort_by_key(|i| updates[*i].0.to_lowercase());
        let mut changed = vec![String::new(); updates.len()];
        for index in order {
            let plan = &plans[index];
            let one = async {
                assert_link_scope(&tx, &plan.links).await?;
                let rows = tx.query_op(&plan.sql, &refs(&plan.params), SqlOp::Update).await?;
                match rows.first() {
                    None => Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(updates[index].0))),
                    Some(r) => Ok(col(r, 0).as_str().unwrap_or_default().to_string()),
                }
            };
            changed[index] = one.await.map_err(|e| with_index(e, index))?;
        }
        Ok((changed, current_xact(&tx).await?))
    })
    .await?;
    Ok(BatchResult { ids, xact })
}

/// `refuseCascade`: a token does not delete what would take other rows with it.
async fn refuse_cascade<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<(), AppError> {
    let params = [P::text(table_id)];
    let row = exec
        .first(
            "SELECT EXISTS (SELECT 1 FROM _basedb.field_link_config
                     WHERE target_table_id = $1 AND on_delete = 'cascade'
                       AND fk_dropped_at IS NULL) AS cascades",
            &refs(&params),
        )
        .await?;
    if row.map(|r| col(&r, 0) == Value::Bool(true)).unwrap_or(false) {
        return Err(AppError::new("TOKEN_CASCADE_FORBIDDEN"));
    }
    Ok(())
}

/// `deleteRecord`: the deleted id and the transaction.
pub async fn delete_record(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str) -> Result<(String, String), AppError> {
    let sql = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let c = prepare(&tx, ctx, table_id, Action::Delete).await?;
        if ctx.actor.kind == ActorKind::Token {
            refuse_cascade(&tx, table_id).await?;
        }
        Ok(format!("DELETE FROM {} AS {}\n WHERE \"_id\" = $1 AND ( /*predicat_lignes*/ {} )\nRETURNING \"_id\";", c.relation, q(ROW_ALIAS)?, c.rows))
    })
    .await?;
    let sql = &sql;
    let (row, xact) = with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let params = [P::text(record_id)];
        let rows = tx.query_op(sql, &refs(&params), SqlOp::Delete).await?;
        Ok((rows.first().map(|r| col(r, 0)), current_xact(&tx).await?))
    })
    .await?;
    match row {
        Some(Value::String(id)) => Ok((id, xact)),
        _ => Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record_id))),
    }
}

/// `deleteRows` of `sync/tables.ts`: some rows (by id, by thousands), or all the table's
/// the writer may delete. How many went.
pub async fn delete_rows(pools: &Pools, ctx: &RequestContext, table_id: &str, ids: Option<&[String]>) -> Result<i64, AppError> {
    if ids.is_some_and(|ids| ids.is_empty()) {
        return Ok(0);
    }
    let (relation, rows) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let c = prepare(&tx, ctx, table_id, Action::Delete).await?;
        Ok((c.relation, c.rows))
    })
    .await?;
    let alias = q(ROW_ALIAS)?;
    let (relation, rows, alias) = (&relation, &rows, &alias);
    with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let count = |r: Option<&tokio_postgres::Row>| r.and_then(|r| col(r, 0).as_i64()).unwrap_or(0);
        let Some(ids) = ids else {
            let sql = format!("WITH d AS (DELETE FROM {relation} AS {alias} WHERE ( {rows} ) RETURNING 1)\n         SELECT count(*)::int AS n FROM d");
            let found = tx.query_op(&sql, &[], SqlOp::Delete).await?;
            return Ok(count(found.first()));
        };
        let sql = format!(
            "WITH d AS (DELETE FROM {relation} AS {alias}\n                     WHERE \"_id\" = ANY($1::uuid[]) AND ( {rows} ) RETURNING 1)\n         SELECT count(*)::int AS n FROM d"
        );
        let mut n = 0;
        for chunk in ids.chunks(1000) {
            let params = [P::of(&json!(chunk))];
            let found = tx.query_op(&sql, &refs(&params), SqlOp::Delete).await?;
            n += count(found.first());
        }
        Ok(n)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cited_names_read_the_prompt() {
        assert_eq!(cited_names("Résume {{ nom }} et {{prix}} puis {{nom}}"), vec!["nom", "prix"]);
        assert!(cited_names("{{}}").is_empty());
    }

    #[test]
    fn stale_ai_cells_are_emptied() {
        let deps = vec![AiDependent { column: "resume".into(), cited: vec!["nom".into(), "prix".into()] }];
        let a = stale_ai_assignments(&deps, &[("prix".into(), "$2".into())]).unwrap();
        assert_eq!(a, vec!["\"resume\" = CASE WHEN \"prix\" IS DISTINCT FROM $2 THEN NULL ELSE \"resume\" END"]);
        assert!(stale_ai_assignments(&deps, &[("autre".into(), "$1".into())]).unwrap().is_empty());
    }
}
