//! Reading records — `records/list.ts`, chapter 05 §6.2, chapter 08 §4 and §6: every
//! expression of the emitted SQL references only named columns of the reader's mask.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{decide, Action, Decision, Verdict, SYSTEM_COLUMNS};
use basedb_base::rbac::loader::{load_fields, load_grants, load_target, LoadedField};
use basedb_base::rbac::rows::{row_where, with_me};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_contracts::naming::qualify;
use indexmap::{IndexMap, IndexSet};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

use crate::computed::{resolve_computed, ComputedSet, FieldInfo, COMPUTED_ALIAS};
use crate::cursor::{decode_cursor, encode_cursor, fingerprint_of, keyset_predicate, Binding};
use crate::display::{load_link_fields, resolve_displays};
use crate::expand::{parse_expand, LIMIT as EXPAND_LIMIT};
use crate::filter::{build_filter, build_sort, cast, qi, Column, Columns, SortTerm, Target};
use crate::js::{js_trim, number_string};
use crate::pg::{refs, row_object, P};
use crate::variables::{cited_names, has_variables, load_scope_extras, resolve_text, Scope, VariableColumn};

pub const DEFAULT_LIMIT: f64 = 50.0;
pub const MAX_LIMIT: f64 = 500.0;
pub const COUNT_CEILING: u64 = 100_000;
const ALIAS: &str = "t";

/// `ListOptions` (the route never passes `countCeiling`).
#[derive(Clone, Debug, Default)]
pub struct ListOptions {
    pub table_id: String,
    /// `Number(limit)` of the query string, NaN included.
    pub limit: Option<f64>,
    pub after: Option<String>,
    pub count_exact: bool,
    pub filter: Option<String>,
    pub sort: Option<String>,
    pub links_id: bool,
    pub expand: Option<String>,
    pub select: Option<Vec<String>>,
    pub variables_raw: bool,
}

pub struct ListResult {
    pub rows: Vec<Map<String, Value>>,
    pub columns: Vec<String>,
    pub sql: String,
    pub has_next_page: bool,
    pub next_cursor: Option<String>,
    pub total: Option<u64>,
    pub total_capped: bool,
    pub link_sql: Vec<String>,
    pub included: Map<String, Value>,
    pub file_columns: Vec<String>,
}

/// `Plan`: what reading a table may touch, decided once.
#[derive(Clone)]
pub struct Plan {
    pub schema_name: String,
    pub table_name: String,
    pub columns: Vec<String>,
    pub filterable: Columns,
    pub links: HashMap<String, Target>,
    pub decision: Decision,
    pub computed: ComputedSet,
    /// Every live field of the table (`loadFields`).
    pub fields: Vec<LoadedField>,
}

fn location_sql() -> &'static str {
    "SELECT sn.name AS schema_name, tn.name AS table_name, t.display_field_id::text
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
      WHERE t.id = $1::text::uuid"
}

fn column_of(f: &LoadedField) -> Column {
    Column { name: f.name.clone(), kind: f.kind.clone(), alias: None, element_kind: None, stored: Some(f.stored) }
}

/// `resolveFilterableLinks`.
async fn resolve_filterable_links<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<HashMap<String, Target>, AppError> {
    let fields = load_link_fields(exec, table_id).await?;
    let mut links = HashMap::new();
    if fields.is_empty() {
        return Ok(links);
    }
    let grants = load_grants(exec, ctx).await?;
    for field in &fields {
        let target = load_target(exec, ctx, &field.target_table_id).await?;
        let decision = target.as_ref().map(|t| decide(ctx, &grants, Action::Read, t));
        let readable = decision.as_ref().is_some_and(|d| d.verdict == Verdict::Allowed);
        let Some(loc) = exec.first(location_sql(), &[&field.target_table_id]).await? else { continue };
        let schema: String = loc.get(0);
        let table: String = loc.get(1);
        let display_field_id: Option<String> = loc.get(2);
        let mut columns = Columns::new();
        let mut display_column = None;
        if readable {
            for f in load_fields(exec, &field.target_table_id).await? {
                if !decision.as_ref().is_some_and(|d| d.readable_fields.contains(&f.id)) || !f.stored {
                    continue;
                }
                if Some(&f.id) == display_field_id.as_ref() {
                    display_column = Some(column_of(&f));
                }
                columns.insert(f.name.clone(), column_of(&f));
            }
        }
        links.insert(
            field.column.clone(),
            Target {
                relation: qualify(&schema, &table).map_err(|e| AppError::internal(e.0))?,
                columns,
                display_column,
                row_predicate: decision.map(|d| d.row_predicate).unwrap_or_else(|| "TRUE".into()),
                readable,
            },
        );
    }
    Ok(links)
}

/// `buildPlan`.
pub async fn build_plan<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<Plan, AppError> {
    let grants = load_grants(exec, ctx).await?;
    let Some(target) = load_target(exec, ctx, table_id).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
    };
    let decision = decide(ctx, &grants, Action::Read, &target);
    if decision.verdict != Verdict::Allowed {
        let code = if decision.verdict == Verdict::Invisible { "RESOURCE_NOT_FOUND" } else { "ADMIN_REQUIRED" };
        return Err(AppError::new(code).with("table", json!(table_id)));
    }
    let fields = load_fields(exec, table_id).await?;
    let loc = exec.first(location_sql(), &[&table_id]).await?.ok_or_else(|| AppError::internal("table sans emplacement"))?;
    let readable: Vec<&LoadedField> = fields.iter().filter(|f| decision.readable_fields.contains(&f.id)).collect();
    if readable.is_empty() {
        return Err(AppError::new("INTERNAL_ERROR").with("reason", json!("empty mask reached the SQL builder")).with("table", json!(table_id)));
    }
    let infos: IndexMap<String, FieldInfo> =
        fields.iter().map(|f| (f.id.clone(), FieldInfo { name: f.name.clone(), kind: f.kind.clone(), stored: f.stored })).collect();
    let computed = resolve_computed(exec, ctx, &grants, &decision, &infos).await?;
    let shown: Vec<&LoadedField> = readable.into_iter().filter(|f| f.stored || computed.by_name(&f.name).is_some()).collect();
    let mut columns: Vec<String> = SYSTEM_COLUMNS.iter().map(|s| s.to_string()).collect();
    columns.extend(shown.iter().map(|f| f.name.clone()));
    let filterable: Columns = shown
        .iter()
        .map(|f| {
            let column = match computed.by_name(&f.name) {
                None => column_of(f),
                Some(v) => Column {
                    name: f.name.clone(),
                    kind: v.kind.clone(),
                    alias: Some(COMPUTED_ALIAS.into()),
                    element_kind: v.element_kind.clone(),
                    stored: Some(false),
                },
            };
            (f.name.clone(), column)
        })
        .collect();
    Ok(Plan {
        schema_name: loc.get(0),
        table_name: loc.get(1),
        columns,
        filterable,
        links: resolve_filterable_links(exec, ctx, table_id).await?,
        decision,
        computed,
        fields,
    })
}

/// `selectColumns`.
fn select_columns(plan: &Plan, select: Option<&[String]>) -> Result<Vec<String>, AppError> {
    let Some(select) = select else { return Ok(plan.columns.clone()) };
    for name in select {
        if !plan.columns.contains(name) {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(name)));
        }
    }
    let wanted: HashSet<&str> = std::iter::once("_id").chain(select.iter().map(String::as_str)).collect();
    Ok(plan.columns.iter().filter(|c| wanted.contains(c.as_str())).cloned().collect())
}

pub struct Query {
    pub sql: String,
    pub params: Vec<Value>,
    pub count_sql: String,
    pub count_params: Vec<Value>,
    pub sort_terms: Vec<SortTerm>,
    pub fingerprint: String,
    pub sort_only: Vec<String>,
}

/// `buildSelect`, `columns` being the selected projection.
pub fn build_select(plan: &Plan, columns: &[String], options: &ListOptions, limit: f64, instance_key: &str, actor_id: &str) -> Result<Query, AppError> {
    let alias = qi(ALIAS)?;
    let prefix = format!("{alias}.");
    let relation = qualify(&plan.schema_name, &plan.table_name).map_err(|e| AppError::internal(e.0))?;
    let mut params: Vec<Value> = Vec::new();
    let mut clauses = vec![format!("( /*predicat_lignes:{}*/ {} )", plan.table_name, row_where(&plan.decision.row_predicate, Some(ALIAS)))];
    if let Some(filter) = options.filter.as_deref().filter(|f| !js_trim(f).is_empty()) {
        let built = build_filter(&with_me(filter, actor_id), &plan.filterable, Some(ALIAS), params.len() + 1, &plan.links)?;
        params.extend(built.params);
        clauses.push(format!("( {} )", built.sql));
    }
    let sort = build_sort(options.sort.as_deref(), &plan.filterable, Some(ALIAS))?;
    let count_params = params.clone();
    let lateral = plan.computed.lateral_join(ALIAS)?;
    let count_sql = format!(
        "SELECT count(*) AS n\n  FROM (SELECT 1\n          FROM {relation} AS {alias}{lateral}\n         WHERE {}\n         LIMIT {}) AS bounded;",
        clauses.join("\n   AND "),
        COUNT_CEILING + 1
    );
    let fingerprint = fingerprint_of(options.sort.as_deref().unwrap_or(""), options.filter.as_deref().unwrap_or(""), columns);
    if let Some(after) = options.after.as_deref().filter(|a| !a.is_empty()) {
        let cursor = decode_cursor(instance_key, after, &Binding { actor_id, table_id: &options.table_id, fingerprint: &fingerprint })?;
        clauses.push(keyset_predicate(&sort.terms, &cursor.keys, &cursor.id, &format!("{alias}.\"_id\""), &mut params, &|t| cast(&t.kind).to_string()));
    }
    let sort_only: Vec<String> = sort.terms.iter().map(|t| t.name.clone()).filter(|n| !columns.contains(n)).collect();
    let projection = columns
        .iter()
        .chain(sort_only.iter())
        .map(|c| {
            Ok(if plan.computed.by_name(c).is_some() { format!("{}.{}", qi(COMPUTED_ALIAS)?, qi(c)?) } else { format!("{prefix}{}", qi(c)?) })
        })
        .collect::<Result<Vec<_>, AppError>>()?
        .join(", ");
    let sql = format!(
        "SELECT {projection}\n  FROM {relation} AS {alias}{lateral}\n WHERE {}\n ORDER BY {}\n LIMIT {};",
        clauses.join("\n   AND "),
        sort.sql,
        number_string(limit + 1.0)
    );
    Ok(Query { sql, params, count_sql, count_params, sort_terms: sort.terms, fingerprint, sort_only })
}

/// `Array.prototype.slice(0, end)`.
fn js_slice_end(len: usize, end: f64) -> usize {
    if end.is_nan() {
        return 0;
    }
    let end = end.trunc();
    if end < 0.0 {
        (len as f64 + end).max(0.0) as usize
    } else {
        end.min(len as f64) as usize
    }
}

async fn run(pools: &Pools, sql: &str, params: &[Value]) -> Result<Vec<Map<String, Value>>, AppError> {
    let conn = pools.get(PoolName::Data).await?;
    let ps: Vec<P> = params.iter().map(P::of).collect();
    Ok(conn.rows(sql, &refs(&ps)).await?.iter().map(row_object).collect())
}

/// `listRecords` without the variables pass.
async fn list_raw(pools: &Pools, ctx: &RequestContext, instance_key: &str, options: &ListOptions) -> Result<(ListResult, Plan, Vec<String>), AppError> {
    let expand = parse_expand(options.expand.as_deref())?;
    let ceiling = if expand.is_empty() { MAX_LIMIT } else { EXPAND_LIMIT as f64 };
    let wanted = options.limit.unwrap_or(DEFAULT_LIMIT);
    let limit = if wanted.is_nan() { f64::NAN } else { wanted.min(ceiling) };

    let table_id = options.table_id.clone();
    let plan = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let table_id = table_id.clone();
        async move { build_plan(&tx, ctx, &table_id).await }
    })
    .await?;
    let columns = select_columns(&plan, options.select.as_deref())?;
    let actor = ctx.actor_key();
    let query = build_select(&plan, &columns, options, limit, instance_key, &actor)?;

    let raw = run(pools, &query.sql, &query.params).await?;
    let has_next_page = (raw.len() as f64) > limit;
    let mut fetched = raw;
    fetched.truncate(js_slice_end(fetched.len(), limit));

    let next_cursor = match fetched.last() {
        Some(last) if has_next_page => {
            let keys: Vec<Value> = query.sort_terms.iter().map(|t| last.get(&t.name).cloned().unwrap_or(Value::Null)).collect();
            let id = match last.get("_id") {
                Some(Value::String(s)) => s.clone(),
                other => other.map(|v| v.to_string()).unwrap_or_else(|| "undefined".into()),
            };
            Some(encode_cursor(instance_key, &keys, &id, &Binding { actor_id: &actor, table_id: &options.table_id, fingerprint: &query.fingerprint }))
        }
        _ => None,
    };

    let page: Vec<Map<String, Value>> = if query.sort_only.is_empty() {
        fetched
    } else {
        fetched
            .into_iter()
            .map(|mut row| {
                for c in &query.sort_only {
                    row.shift_remove(c);
                }
                row
            })
            .collect()
    };

    let (total, total_capped) = if options.count_exact {
        let rows = run(pools, &query.count_sql, &query.count_params).await?;
        let n = rows.first().and_then(|r| r.get("n")).and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        (Some(n.min(COUNT_CEILING)), n > COUNT_CEILING)
    } else {
        (None, false)
    };

    if options.links_id && !expand.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("expand")).with("detail", json!("incompatible with links=id")));
    }

    let (rows, link_sql, included) = if options.links_id {
        (page, vec![], Map::new())
    } else {
        let readable: IndexSet<String> = plan.columns.iter().cloned().collect();
        let r = resolve_displays(pools, ctx, &options.table_id, page, &expand, &readable).await?;
        (r.rows, r.sql, r.included)
    };

    let file_columns = columns.iter().filter(|c| plan.filterable.get(*c).is_some_and(|col| matches!(col.kind.as_str(), "file" | "image"))).cloned().collect();
    Ok((
        ListResult {
            rows,
            columns: columns.clone(),
            sql: query.sql,
            has_next_page,
            next_cursor,
            total,
            total_capped,
            link_sql,
            included,
            file_columns,
        },
        plan,
        columns,
    ))
}

/// `listRecords`.
pub async fn list_records(pools: &Pools, ctx: &RequestContext, instance_key: &str, options: &ListOptions) -> Result<ListResult, AppError> {
    let (mut result, plan, columns) = list_raw(pools, ctx, instance_key, options).await?;
    if !options.variables_raw {
        result.rows = resolve_page_variables(pools, ctx, instance_key, &options.table_id, &plan, &columns, result.rows).await?;
    }
    Ok(result)
}

/// `resolvePageVariables`.
async fn resolve_page_variables(
    pools: &Pools,
    ctx: &RequestContext,
    instance_key: &str,
    table_id: &str,
    plan: &Plan,
    columns: &[String],
    rows: Vec<Map<String, Value>>,
) -> Result<Vec<Map<String, Value>>, AppError> {
    let texts: Vec<&String> = columns.iter().filter(|c| plan.filterable.get(*c).is_some_and(|col| col.kind == "long_text")).collect();
    if texts.is_empty() {
        return Ok(rows);
    }
    let cites = |row: &Map<String, Value>| texts.iter().any(|c| row.get(*c).is_some_and(has_variables));
    let citing: Vec<&Map<String, Value>> = rows.iter().filter(|r| cites(r)).collect();
    if citing.is_empty() {
        return Ok(rows);
    }
    let cited = cited_names(citing.iter().flat_map(|row| texts.iter().filter_map(|c| row.get(*c).filter(|v| has_variables(v)).and_then(Value::as_str))));

    let by_name: HashMap<&str, &LoadedField> = plan.fields.iter().map(|f| (f.name.as_str(), f)).collect();
    let mut readable: IndexMap<String, VariableColumn> = IndexMap::new();
    for name in &cited {
        if let Some(column) = plan.filterable.get(name) {
            readable.insert(name.clone(), VariableColumn { name: name.clone(), kind: column.kind.clone(), rich: by_name.get(name.as_str()).is_some_and(|f| f.rich) });
        }
    }

    let missing: Vec<String> = readable.keys().filter(|n| !columns.contains(n)).cloned().collect();
    let mut extra: HashMap<String, Map<String, Value>> = HashMap::new();
    if !missing.is_empty() {
        let ids: Vec<String> = citing.iter().map(|r| serde_json::to_string(&id_text(r)).unwrap_or_default()).collect();
        let options = ListOptions {
            table_id: table_id.to_string(),
            filter: Some(format!("_id in [{}]", ids.join(", "))),
            select: Some(missing),
            limit: Some(ids.len() as f64),
            variables_raw: true,
            ..Default::default()
        };
        let (page, _, _) = Box::pin(list_raw(pools, ctx, instance_key, &options)).await?;
        for row in page.rows {
            extra.insert(id_text(&row), row);
        }
    }
    let full = |row: &Map<String, Value>| -> Map<String, Value> {
        match extra.get(&id_text(row)) {
            None => row.clone(),
            Some(more) => {
                let mut merged = more.clone();
                for (k, v) in row {
                    merged.insert(k.clone(), v.clone());
                }
                merged
            }
        }
    };

    let mut people: IndexSet<String> = IndexSet::new();
    for row in &citing {
        let values = full(row);
        for column in readable.values() {
            if column.kind == "user" {
                if let Some(Value::String(s)) = values.get(&column.name) {
                    people.insert(s.clone());
                }
            }
        }
    }
    let choice_fields: Vec<String> = readable.values().filter(|c| c.kind == "select" || c.kind == "multi_select").map(|c| c.name.clone()).collect();
    let people: Vec<String> = people.into_iter().collect();
    let table = table_id.to_string();
    let actor_id = ctx.actor.id.clone();
    let (labels, names, iso, timezone) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let (table, actor_id, choice_fields, people) = (table.clone(), actor_id.clone(), choice_fields.clone(), people.clone());
        async move { load_scope_extras(&tx, &table, &actor_id, &choice_fields, &people).await }
    })
    .await?;
    let scope = Scope {
        readable: readable.into_iter().collect(),
        known: plan.fields.iter().map(|f| f.name.clone()).collect(),
        labels,
        people: names,
        iso,
        timezone,
    };

    Ok(rows
        .into_iter()
        .map(|row| {
            if !cites(&row) {
                return row;
            }
            let values = full(&row);
            let mut copy = row.clone();
            for c in &texts {
                if let Some(Value::String(text)) = row.get(*c).filter(|v| has_variables(v)) {
                    let html = by_name.get(c.as_str()).is_some_and(|f| f.rich);
                    copy.insert((*c).clone(), Value::String(resolve_text(text, &values, &scope, html)));
                }
            }
            copy
        })
        .collect())
}

/// `String(row._id)`.
fn id_text(row: &Map<String, Value>) -> String {
    match row.get("_id") {
        Some(Value::String(s)) => s.clone(),
        Some(other) => other.to_string(),
        None => "undefined".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pages_slice_as_javascript() {
        assert_eq!(js_slice_end(5, f64::NAN), 0);
        assert_eq!(js_slice_end(5, 2.5), 2);
        assert_eq!(js_slice_end(5, -1.0), 4);
        assert_eq!(js_slice_end(0, -1.0), 0);
        assert_eq!(js_slice_end(3, 50.0), 3);
    }
}
