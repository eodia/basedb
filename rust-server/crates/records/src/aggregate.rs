//! Aggregates over a table — `records/aggregate.ts`: the summary bar of a grid and the
//! counts of its groups, over every row the filter keeps.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::rows::{row_where, with_me};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_contracts::naming::qualify;
use serde_json::{json, Map, Value};

use crate::drain::js_string;
use crate::filter::{build_filter, qi, resolve_column, Column};
use crate::js::{js_number, js_trim};
use crate::list::build_plan;
use crate::pg::{col, refs, P};

const MAX_AGGREGATES: usize = 64;
const MAX_GROUPS: usize = 500;
const GROUPABLE: [&str; 10] = ["short_text", "select", "boolean", "link", "date", "number", "url", "formula", "email", "user"];
const ARRAYS: [&str; 3] = ["multi_select", "multi_link", "lookup"];
const DOCUMENTS: [&str; 2] = ["file", "image"];
const TEXTUAL: [&str; 5] = ["short_text", "long_text", "select", "url", "email"];

/// `aggregatesFor`.
pub fn aggregates_for(kind: &str) -> &'static [&'static str] {
    match kind {
        "boolean" => &["checked", "filled", "empty"],
        "number" => &["filled", "empty", "unique", "sum", "avg", "min", "max"],
        "date" | "datetime" | "autonumber" => &["filled", "empty", "min", "max"],
        k if k == "long_text" || ARRAYS.contains(&k) || DOCUMENTS.contains(&k) => &["filled", "empty"],
        _ => &["filled", "empty", "unique"],
    }
}

fn filled_condition(column: &Column, sql: &str) -> String {
    let k = column.kind.as_str();
    if ARRAYS.contains(&k) {
        format!("cardinality({sql}) > 0")
    } else if DOCUMENTS.contains(&k) {
        format!("jsonb_array_length({sql}) > 0")
    } else if TEXTUAL.contains(&k) {
        format!("{sql} <> ''")
    } else {
        format!("{sql} IS NOT NULL")
    }
}

fn expression_of(column: &Column, f: &str, sql: &str) -> String {
    match f {
        "filled" => format!("count(*) FILTER (WHERE {})", filled_condition(column, sql)),
        "empty" => format!("count(*) FILTER (WHERE NOT coalesce({}, false))", filled_condition(column, sql)),
        "unique" => format!("count(DISTINCT {sql})"),
        "checked" => format!("count(*) FILTER (WHERE {sql})"),
        other => format!("{other}({sql})"),
    }
}

fn refuse(detail: String) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("aggregate")).with("reason", json!("agregat_invalide")).with("detail", json!(detail))
}

/// `field:fn` pairs as the route cuts `aggregates=` — `lastIndexOf(':') <= 0` refused.
pub fn parse_aggregates(text: Option<&str>) -> Result<Vec<(String, String)>, AppError> {
    let mut out = Vec::new();
    for pair in text.unwrap_or("").split(',') {
        let pair = js_trim(pair);
        if pair.is_empty() {
            continue;
        }
        match pair.rfind(':') {
            Some(cut) if cut > 0 => out.push((pair[..cut].to_string(), pair[cut + 1..].to_string())),
            _ => return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("aggregates"))),
        }
    }
    Ok(out)
}

/// `aggregateRecords`, shaped as the route answers (`data`).
pub async fn aggregate_records(pools: &Pools, ctx: &RequestContext, table_id: &str, filter: Option<&str>, aggregates: &[(String, String)], group_by: Option<&str>) -> Result<Value, AppError> {
    if aggregates.len() > MAX_AGGREGATES {
        return Err(refuse("trop_d_agregats".into()));
    }
    let plan = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move { build_plan(&tx, ctx, table_id).await }).await?;
    let alias = "t";
    let column = |name: &str| -> Result<String, AppError> {
        let a = plan.filterable.get(name).and_then(|c| c.alias.clone()).unwrap_or_else(|| alias.to_string());
        Ok(format!("{}.{}", qi(&a)?, qi(name)?))
    };
    let lateral = plan.computed.lateral_join(alias)?;
    let relation = qualify(&plan.schema_name, &plan.table_name).map_err(|e| AppError::internal(e.0))?;

    let mut selected: Vec<(String, String)> = Vec::new();
    for (field, f) in aggregates {
        let Some(known) = resolve_column(field, &plan.filterable) else {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(field)));
        };
        if !aggregates_for(&known.kind).contains(&f.as_str()) {
            return Err(refuse(format!("{field}:{f}")));
        }
        selected.push((format!("{field}:{f}"), expression_of(&known, f, &column(field)?)));
    }

    let mut group: Option<Column> = None;
    if let Some(g) = group_by.filter(|g| !g.is_empty()) {
        let Some(known) = resolve_column(g, &plan.filterable) else {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(g)));
        };
        if !GROUPABLE.contains(&known.kind.as_str()) {
            return Err(refuse(format!("group:{g}")));
        }
        group = Some(known);
    }

    let mut params: Vec<Value> = Vec::new();
    let mut clauses = vec![format!("( /*predicat_lignes:{}*/ {} )", plan.table_name, row_where(&plan.decision.row_predicate, Some(alias)))];
    if let Some(filter) = filter.filter(|f| !js_trim(f).is_empty()) {
        let built = build_filter(&with_me(filter, &ctx.actor.id), &plan.filterable, Some(alias), 1, &plan.links)?;
        params.extend(built.params);
        clauses.push(format!("( {} )", built.sql));
    }
    let where_ = clauses.join("\n   AND ");
    let mut projection = vec!["count(*) AS \"__total\"".to_string()];
    for (i, (_, sql)) in selected.iter().enumerate() {
        projection.push(format!("{sql} AS \"a{i}\""));
    }
    let totals_sql = format!("SELECT {}\n  FROM {relation} AS {}{lateral}\n WHERE {where_};", projection.join(", "), qi(alias)?);
    let group_sql = match &group {
        None => None,
        Some(g) => Some(format!(
            "SELECT {} AS value, count(*) AS n\n  FROM {relation} AS {}{lateral}\n WHERE {where_}\n GROUP BY 1\n ORDER BY 1 NULLS FIRST\n LIMIT {};",
            column(&g.name)?,
            qi(alias)?,
            MAX_GROUPS + 1
        )),
    };

    let conn = pools.get(PoolName::Data).await?;
    let ps: Vec<P> = params.iter().map(P::of).collect();
    let totals = conn.first(&totals_sql, &refs(&ps)).await?;
    let mut values = Map::new();
    for (i, (key, _)) in selected.iter().enumerate() {
        let raw = totals.as_ref().map(|r| col(r, i + 1)).unwrap_or(Value::Null);
        let v = if raw.is_null() {
            Value::Null
        } else if key.ends_with(":filled") || key.ends_with(":empty") || key.ends_with(":unique") || key.ends_with(":checked") {
            js_number(&raw)
        } else {
            Value::String(js_string(&raw))
        };
        values.insert(key.clone(), v);
    }
    let mut groups = Value::Null;
    let mut capped = false;
    if let Some(sql) = group_sql {
        let rows = conn.rows(&sql, &refs(&ps)).await?;
        capped = rows.len() > MAX_GROUPS;
        groups = Value::Array(rows.iter().take(MAX_GROUPS).map(|r| json!({ "value": col(r, 0), "count": js_number(&col(r, 1)) })).collect());
    }
    let total = totals.as_ref().map(|r| js_number(&col(r, 0))).unwrap_or(json!(0));
    Ok(json!({ "total": total, "values": values, "groups": groups, "groups_capped": capped }))
}
