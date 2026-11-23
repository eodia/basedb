//! Reading and writing records on the agent surface (`agent/records.ts`, chapter 09 §5 and
//! §6): every read through `list_records`, every write through `create_record` /
//! `update_record`, under the same mask. What this adds is the agent's grammar —
//! structured filters, closed bounds, the refusals of §6.2 — and ONE resolution of every
//! field name.

use super::view::{agent_view, display_field, link_target, resolve_agent_field, resolve_agent_table, AgentField, AgentTable, AgentView};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::idempotency::{claim_idempotency, complete_idempotency, params_hash, release_idempotency, Claim};
use basedb_base::rbac::Verdict;
use basedb_base::tx::RequestContext;
use basedb_records::filter::OPERATORS;
use basedb_records::js::{is_uuid_ci, js_trim, number_string};
use basedb_records::{list_records, ListOptions};
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use std::future::Future;

/// `AGENT_BOUNDS`.
pub mod bounds {
    pub const DEFAULT_LIMIT: f64 = 25.0;
    pub const MAX_LIMIT: f64 = 100.0;
    /// `select` absent: the first thirty readable fields, by position.
    pub const DEFAULT_SELECT: usize = 30;
    /// `include_count`: exact below, estimated above.
    pub const EXACT_COUNT_BELOW: u64 = 50_000;
    pub const LOOKUP_DEFAULT: f64 = 10.0;
    pub const LOOKUP_MAX: f64 = 25.0;
}

/// `AgentListRequest` (without `base` and `table` for `readRows`). `filter` keeps the
/// agent's predicates `{ op, value? }` as given.
#[derive(Debug, Clone, Default)]
pub struct AgentListRequest {
    pub base: String,
    pub table: String,
    pub select: Option<Vec<String>>,
    pub filter: Option<Map<String, Value>>,
    pub sort: Option<Vec<String>>,
    pub limit: Option<f64>,
    pub cursor: Option<String>,
    pub expand: Option<Vec<String>>,
    /// `<link field>.<target field>`: what an expansion carries beyond `_id` and display.
    pub expand_fields: Option<Vec<String>>,
    pub include_count: bool,
}

/// `AgentColumn`: what the adapter needs to shape a row for transport.
#[derive(Debug, Clone, PartialEq)]
pub struct AgentColumn {
    pub name: String,
    pub kind: String,
    pub rich: bool,
}

/// `AgentRows['table']`.
#[derive(Debug, Clone, PartialEq)]
pub struct AgentTableRef {
    pub id: String,
    pub name: String,
    pub base_id: String,
}

impl AgentTableRef {
    /// As Node serializes it: `{ id, name, baseId }`.
    pub fn to_json(&self) -> Value {
        json!({ "id": self.id, "name": self.name, "baseId": self.base_id })
    }
}

/// `AgentRows`.
#[derive(Debug, Clone)]
pub struct AgentRows {
    pub table: AgentTableRef,
    pub records: Vec<Map<String, Value>>,
    pub columns: Vec<AgentColumn>,
    pub has_more: bool,
    pub next_cursor: Option<String>,
    pub count: Option<i64>,
    pub count_is_estimate: Option<bool>,
    pub notices: Vec<Value>,
}

/// `AgentWriteResult`: the response, and the columns its `record` is read with.
#[derive(Debug, Clone)]
pub struct AgentWriteResult {
    pub table: AgentTableRef,
    pub response: Value,
    pub columns: Vec<AgentColumn>,
}

fn object_of(table: &AgentTable) -> Value {
    json!({ "kind": "table", "name": table.row.table_name })
}

fn table_ref(view: &AgentView, table: &AgentTable) -> AgentTableRef {
    AgentTableRef { id: table.row.id.clone(), name: table.row.table_name.clone(), base_id: view.base_of(table).map(|b| b.row.id.clone()).unwrap_or_else(|| table.row.base_id.clone()) }
}

/// `agentError`: a kernel refusal in the vocabulary of this surface, keeping only the
/// details that name what the bearer may see.
pub fn agent_error(error: AppError, table: Option<&AgentTable>, view: Option<&AgentView>) -> AppError {
    let d = error.details.clone();
    let readable = |name: Option<&Value>| -> Option<String> {
        let name = name?.as_str()?;
        table.filter(|t| t.fields.iter().any(|f| f.name == name)).map(|_| name.to_string())
    };
    let keep = |extra: Vec<(&str, Value)>| -> Map<String, Value> {
        let mut out = Map::new();
        if let Some(t) = table {
            out.insert("object".into(), object_of(t));
        }
        if let Some(param) = d.get("param").filter(|p| p.is_string()) {
            out.insert("param".into(), param.clone());
        }
        for (k, v) in extra {
            out.insert(k.into(), v);
        }
        out
    };
    let with = |code: &str, details: Map<String, Value>| {
        let mut e = AppError::new(code);
        e.details = details;
        e
    };
    match error.code {
        "FILTER_FIELD_UNKNOWN" | "SORT_FIELD_UNKNOWN" => with("FIELD_UNKNOWN", keep(vec![])),
        "EXPAND_UNAVAILABLE" => with("FIELD_NOT_EXPANDABLE", keep(vec![])),
        "FILTER_VALUE_INVALID" => with("VALUE_INVALID", keep(readable(d.get("field")).map(|f| vec![("field", json!(f))]).unwrap_or_default())),
        "CURSOR_STALE" => AppError::new("CURSOR_INVALID"),
        "REQUEST_INVALID" => with("PARAMETER_INVALID", keep(vec![])),
        "SERIALIZATION_CONFLICT" => AppError::new("CONCURRENCY_CONFLICT"),
        "ADMIN_REQUIRED" => with("PERMISSION_DENIED", keep(vec![])),
        "LINK_TARGET_NOT_FOUND" => {
            // Carried by the SOURCE field, and never naming the target.
            let constraint = d.get("constraint").and_then(Value::as_str);
            let link = view.and_then(|v| v.raw.links.iter().find(|l| l.fk_constraint.as_deref().is_some_and(|c| Some(c) == constraint)));
            let field = link.and_then(|l| table.and_then(|t| t.fields.iter().find(|f| f.id.as_deref() == Some(l.field_id.as_str()))));
            with("LINK_TARGET_NOT_FOUND", keep(field.map(|f| vec![("field", json!(f.name))]).unwrap_or_default()))
        }
        "DUPLICATE_VALUE" => {
            // Names the field, never the value in conflict.
            let constraint = d.get("constraint").and_then(Value::as_str);
            let field_id = view.and_then(|v| v.raw.unique.iter().find(|(_, name)| Some(name.as_str()) == constraint).map(|(id, _)| id.clone()));
            let field = field_id.and_then(|id| table.and_then(|t| t.fields.iter().find(|f| f.id.as_deref() == Some(id.as_str()))));
            with("DUPLICATE_VALUE", keep(field.map(|f| vec![("field", json!(f.name))]).unwrap_or_default()))
        }
        code => {
            let mut extra = vec![];
            if let Some(field) = readable(d.get("field")).or_else(|| readable(d.get("column"))) {
                extra.push(("field", json!(field)));
            }
            if let Some(v) = d.get("retry_after").filter(|v| v.is_number()) {
                extra.push(("retry_after", v.clone()));
            }
            if let Some(v) = d.get("maximum").filter(|v| v.is_number()) {
                extra.push(("maximum", v.clone()));
            }
            if let Some(v) = d.get("expected").filter(|v| v.is_string()) {
                extra.push(("expected", v.clone()));
            }
            let mut e = with(code, keep(extra));
            e.cause = error.cause.clone();
            e.sqlstate = error.sqlstate.clone();
            e
        }
    }
}

/// A string literal of the filter grammar: two escapes, and only two.
fn literal(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn scalar_of(value: Option<&Value>, param: &str) -> Result<String, AppError> {
    match value {
        Some(Value::Bool(b)) => Ok(if *b { "true" } else { "false" }.into()),
        Some(Value::Number(n)) => Ok(literal(&number_string(n.as_f64().unwrap_or(f64::NAN)))),
        Some(Value::String(s)) => Ok(literal(s)),
        _ => Err(AppError::new("VALUE_INVALID").with("param", json!(param))),
    }
}

fn parameter_invalid(param: &str) -> AppError {
    AppError::new("PARAMETER_INVALID").with("param", json!(param))
}

/// `filterExpression`: the structured filter written in the grammar of chapter 08, field
/// names resolved first.
fn filter_expression(view: &AgentView, table: &AgentTable, filter: &Map<String, Value>) -> Result<String, AppError> {
    let mut parts = Vec::new();
    for (reference, predicate) in filter {
        let param = format!("filter.{reference}");
        let field = resolve_agent_field(table, reference, &param)?;
        let op = predicate.get("op").and_then(Value::as_str).filter(|op| OPERATORS.contains(op)).ok_or_else(|| parameter_invalid(&format!("{param}.op")))?;
        // A link whose target is unreadable filters on "set" and "not set" alone.
        if field.link.is_some() && link_target(view, field).is_none() && op != "is_null" {
            return Err(AppError::new("FILTER_OPERATOR_INVALID").with("param", json!(param)).with("object", object_of(table)));
        }
        let value = predicate.get("value");
        if op == "is_null" {
            parts.push(if value == Some(&json!(false)) { format!("not {} is_null", field.name) } else { format!("{} is_null", field.name) });
            continue;
        }
        if op == "in" || op == "between" {
            let values = value.and_then(Value::as_array).filter(|v| op != "between" || v.len() == 2).ok_or_else(|| parameter_invalid(&format!("{param}.value")))?;
            let items = values.iter().map(|v| scalar_of(Some(v), &param)).collect::<Result<Vec<_>, _>>()?;
            parts.push(format!("{} {op} [{}]", field.name, items.join(", ")));
            continue;
        }
        if let (true, Some(Value::Array(values))) = (op == "has_any" || op == "has_all", value) {
            if values.is_empty() {
                return Err(parameter_invalid(&format!("{param}.value")));
            }
            let items = values.iter().map(|v| scalar_of(Some(v), &param)).collect::<Result<Vec<_>, _>>()?;
            parts.push(format!("{} {op} [{}]", field.name, items.join(", ")));
            continue;
        }
        parts.push(format!("{} {op} {}", field.name, scalar_of(value, &param)?));
    }
    Ok(parts.join(" and "))
}

fn sort_expression(view: &AgentView, table: &AgentTable, sort: &[String]) -> Result<String, AppError> {
    let mut terms = Vec::new();
    for (index, term) in sort.iter().enumerate() {
        let descending = term.starts_with('-');
        let param = format!("sort[{index}]");
        let field = resolve_agent_field(table, if descending { &term[1..] } else { term }, &param)?;
        // The order of hidden identifiers is the order of their creation: not sortable.
        if field.link.is_some() && link_target(view, field).is_none() {
            return Err(AppError::new("SORT_UNAVAILABLE").with("param", json!(param)));
        }
        terms.push(format!("{}{}", if descending { "-" } else { "" }, field.name));
    }
    Ok(terms.join(","))
}

/// `estimate`: the table's size from the planner, for a count past the exact bound.
async fn estimate(pools: &Pools, table: &AgentTable) -> Result<Option<i64>, AppError> {
    if table.decisions.read.row_predicate != "TRUE" {
        return Ok(None);
    }
    let conn = pools.get(PoolName::Data).await?;
    let row = conn
        .first(
            "SELECT c.reltuples::bigint AS n
               FROM pg_catalog.pg_class c
               JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
              WHERE ns.nspname = $1 AND c.relname = $2",
            &[&table.row.schema_name, &table.row.table_name],
        )
        .await?;
    let n: i64 = row.map(|r| r.get(0)).unwrap_or(-1);
    Ok((n >= 0).then_some(n))
}

fn columns_of(table: &AgentTable, names: &[String]) -> Vec<AgentColumn> {
    names
        .iter()
        .map(|name| {
            let field = table.fields.iter().find(|f| &f.name == name);
            AgentColumn { name: name.clone(), kind: field.map_or("system".into(), |f| f.kind.clone()), rich: field.and_then(|f| f.row.as_ref()).is_some_and(|r| r.is_rich) }
        })
        .collect()
}

struct Expansion<'t> {
    target: &'t AgentTable,
    fields: Vec<String>,
}

/// `readRows`: a read through the kernel's one list operation, in the agent's grammar.
pub async fn read_rows(pools: &Pools, ctx: &RequestContext, instance_key: &str, view: &AgentView, table: &AgentTable, request: &AgentListRequest) -> Result<AgentRows, AppError> {
    let mut notices = Vec::new();
    let business: Vec<&AgentField> = table.fields.iter().filter(|f| !f.system).collect();
    let mut selected: Vec<String> = vec!["_id".into()];
    match &request.select {
        None => selected.extend(business.iter().take(bounds::DEFAULT_SELECT).map(|f| f.name.clone())),
        Some(select) => {
            for (i, reference) in select.iter().enumerate() {
                selected.push(resolve_agent_field(table, reference, &format!("select[{i}]"))?.name.clone());
            }
        }
    }
    if request.select.is_none() && business.len() > bounds::DEFAULT_SELECT {
        notices.push(super::describe::notice("select_defaulted", &format!("Seuls les {} premiers champs sont rendus ; nommez les autres dans select.", bounds::DEFAULT_SELECT), None));
    }

    let mut expansions: IndexMap<String, Expansion> = IndexMap::new();
    for (i, reference) in request.expand.iter().flatten().enumerate() {
        let param = format!("expand[{i}]");
        let field = resolve_agent_field(table, reference, &param)?;
        let target = link_target(view, field).map(|(_, t)| t).filter(|t| field.link.is_some() && display_field(t).is_some());
        let Some(target) = target else {
            return Err(AppError::new("FIELD_NOT_EXPANDABLE").with("param", json!(param)).with("object", object_of(table)));
        };
        expansions.insert(field.name.clone(), Expansion { target, fields: vec![] });
        if !selected.contains(&field.name) {
            selected.push(field.name.clone());
        }
    }
    for (i, path) in request.expand_fields.iter().flatten().enumerate() {
        let param = format!("expand_fields[{i}]");
        let mut pieces = path.split('.');
        let link_name = pieces.next().unwrap_or_default();
        let field_name = pieces.next();
        let rest = pieces.next().is_some();
        let key = if expansions.contains_key(link_name) {
            link_name.to_string()
        } else {
            table.fields.iter().find(|f| f.id.as_deref() == Some(link_name)).map(|f| f.name.clone()).unwrap_or_default()
        };
        let (Some(expansion), Some(field_name), false) = (expansions.get_mut(&key), field_name, rest) else {
            return Err(parameter_invalid(&param));
        };
        // The target's fields obey the TARGET's mask, whatever the source's.
        let target_field = resolve_agent_field(expansion.target, field_name, &param)?;
        expansion.fields.push(target_field.name.clone());
    }
    let expand = expansions.iter().map(|(name, e)| format!("{name}({})", e.fields.join(","))).collect::<Vec<_>>().join(",");

    let mut limit = request.limit.unwrap_or(bounds::DEFAULT_LIMIT);
    if limit > bounds::MAX_LIMIT {
        notices.push(super::describe::notice("limit_clipped", &format!("La limite est ramenée à {} lignes ; poursuivez avec next_cursor.", bounds::MAX_LIMIT), None));
        limit = bounds::MAX_LIMIT;
    }

    let filter = request.filter.as_ref().map(|f| filter_expression(view, table, f)).transpose()?;
    let sort = match &request.sort {
        Some(sort) if !sort.is_empty() => Some(sort_expression(view, table, sort)?),
        _ => None,
    };

    let options = ListOptions {
        table_id: table.row.id.clone(),
        limit: Some(limit),
        after: request.cursor.clone(),
        count_exact: request.include_count,
        filter: filter.clone(),
        sort,
        expand: (!expand.is_empty()).then_some(expand),
        select: Some(selected.iter().filter(|c| *c != "_id").cloned().collect()),
        ..Default::default()
    };
    let result = list_records(pools, ctx, instance_key, &options).await.map_err(|e| agent_error(e, Some(table), Some(view)))?;

    // The expansion is nested in the link value it expands.
    let records: Vec<Map<String, Value>> = result
        .rows
        .iter()
        .map(|row| {
            let mut out = Map::new();
            for column in &selected {
                out.insert(column.clone(), row.get(column).cloned().unwrap_or(Value::Null));
            }
            for (name, expansion) in &expansions {
                let Some(Value::Object(value)) = out.get(name).cloned() else { continue };
                let Some(id) = value.get("id").and_then(Value::as_str) else { continue };
                let Some(target) = result.included.get(&expansion.target.row.table_name).and_then(|t| t.get(id)) else { continue };
                let mut expanded = value.clone();
                let fields: Map<String, Value> = expansion.fields.iter().map(|f| (f.clone(), target.get(f).cloned().unwrap_or(Value::Null))).collect();
                expanded.insert("fields".into(), Value::Object(fields));
                out.insert(name.clone(), Value::Object(expanded));
            }
            out
        })
        .collect();

    let (mut count, mut count_is_estimate) = (None, None);
    if let (true, Some(total)) = (request.include_count, result.total) {
        // The kernel counts up to its own ceiling; the agent's is lower.
        let capped = total > bounds::EXACT_COUNT_BELOW;
        let mut n = total.min(bounds::EXACT_COUNT_BELOW) as i64;
        if capped {
            let estimated = if filter.is_none() { estimate(pools, table).await? } else { None };
            if let Some(e) = estimated.filter(|e| *e > n) {
                n = e;
            }
            notices.push(super::describe::notice("count_estimated", &format!("Au-delà de {} lignes, le compte est une estimation.", bounds::EXACT_COUNT_BELOW), None));
        }
        count = Some(n);
        count_is_estimate = Some(capped);
    }
    Ok(AgentRows {
        table: table_ref(view, table),
        records,
        columns: columns_of(table, &selected),
        has_more: result.has_next_page,
        next_cursor: result.next_cursor,
        count,
        count_is_estimate,
        notices,
    })
}

/// `list_records` — §5.1.
pub async fn agent_list_records(pools: &Pools, ctx: &RequestContext, instance_key: &str, request: &AgentListRequest) -> Result<AgentRows, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (_, table) = resolve_agent_table(&view, &request.base, &request.table)?;
    read_rows(pools, ctx, instance_key, &view, table, request).await
}

fn business_names(table: &AgentTable) -> Vec<String> {
    table.fields.iter().filter(|f| !f.system).map(|f| f.name.clone()).collect()
}

fn by_id(id: &str) -> Map<String, Value> {
    let mut filter = Map::new();
    filter.insert("_id".into(), json!({ "op": "eq", "value": id }));
    filter
}

/// `get_record` — §5.2. A row that does not exist and one not visible answer alike.
#[allow(clippy::too_many_arguments)]
pub async fn agent_get_record(
    pools: &Pools,
    ctx: &RequestContext,
    instance_key: &str,
    base: &str,
    table: &str,
    id: &str,
    select: Option<Vec<String>>,
    expand: Option<Vec<String>>,
    expand_fields: Option<Vec<String>>,
) -> Result<AgentRows, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (_, table) = resolve_agent_table(&view, base, table)?;
    if !is_uuid_ci(id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let request = AgentListRequest {
        select: Some(select.unwrap_or_else(|| business_names(table))),
        expand,
        expand_fields,
        filter: Some(by_id(id)),
        limit: Some(1.0),
        ..Default::default()
    };
    let rows = read_rows(pools, ctx, instance_key, &view, table, &request).await?;
    if rows.records.is_empty() {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    Ok(AgentRows { has_more: false, next_cursor: None, ..rows })
}

/// `lookup_records` — §5.3: a display value resolved into candidate `_id`s, by exact
/// match on the comparison key; a LIST even of one.
pub async fn agent_lookup_records(pools: &Pools, ctx: &RequestContext, instance_key: &str, base: &str, table: &str, value: &Value, limit: Option<f64>) -> Result<Value, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (_, table) = resolve_agent_table(&view, base, table)?;
    let Some(display) = display_field(table) else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("hint", json!("describe_table")));
    };
    let limit = limit.unwrap_or(bounds::LOOKUP_DEFAULT).min(bounds::LOOKUP_MAX);
    let op = if display.kind == "short_text" { "eq_ci" } else { "eq" };
    let mut filter = Map::new();
    filter.insert(display.name.clone(), json!({ "op": op, "value": value }));
    let request = AgentListRequest { select: Some(vec![display.name.clone()]), filter: Some(filter), limit: Some(limit), ..Default::default() };
    let rows = read_rows(pools, ctx, instance_key, &view, table, &request).await?;
    let candidates: Vec<Value> = rows.records.iter().map(|r| json!({ "_id": r.get("_id"), "display": r.get(&display.name).cloned().unwrap_or(Value::Null) })).collect();
    Ok(json!({
        "table": rows.table.to_json(),
        "candidates": candidates,
        "has_more": rows.has_more,
        "returned": rows.records.len(),
        "provenance": "user_data",
    }))
}

// ── Writes ────────────────────────────────────────────────────────────────────

/// `EXPECTED`: the functional type named in a `VALUE_INVALID`.
fn expected(kind: &str) -> String {
    match kind {
        "short_text" | "long_text" => "texte",
        "number" => "nombre",
        "boolean" => "booléen",
        "date" => "date AAAA-MM-JJ",
        "datetime" => "date-heure ISO 8601 avec fuseau",
        "select" => "une des valeurs de la liste",
        "multi_select" => "liste de valeurs de la liste",
        "link" => "identifiant _id de la ligne cible",
        "url" => "adresse https://… ou mailto:…",
        other => other,
    }
    .to_string()
}

fn digits(s: &str, at: usize, n: usize) -> Option<u32> {
    let part = s.get(at..at + n)?;
    part.bytes().all(|b| b.is_ascii_digit()).then(|| part.parse().ok()).flatten()
}

/// `DATE.test(v) && !isNaN(Date.parse(v))`: V8 takes any day up to 31.
pub fn valid_date(s: &str) -> bool {
    s.len() == 10
        && digits(s, 0, 4).is_some()
        && &s[4..5] == "-"
        && &s[7..8] == "-"
        && digits(s, 5, 2).is_some_and(|m| (1..=12).contains(&m))
        && digits(s, 8, 2).is_some_and(|d| (1..=31).contains(&d))
}

/// `DATETIME.test(v) && !isNaN(Date.parse(v))`: a zone required; `24:00` alone at 24.
pub fn valid_datetime(s: &str) -> bool {
    if s.len() < 17 || !s.is_char_boundary(10) || !valid_date(&s[..10]) || &s[10..11] != "T" || &s[13..14] != ":" {
        return false;
    }
    let (Some(hour), Some(minute)) = (digits(s, 11, 2), digits(s, 14, 2)) else { return false };
    let mut rest = &s[16..];
    let mut second = 0;
    let mut fraction_zero = true;
    if let Some(after) = rest.strip_prefix(':') {
        let Some(sec) = digits(after, 0, 2) else { return false };
        second = sec;
        rest = &after[2..];
        if let Some(after) = rest.strip_prefix('.') {
            let n = after.bytes().take_while(u8::is_ascii_digit).count();
            if !(1..=6).contains(&n) {
                return false;
            }
            fraction_zero = after[..n].bytes().all(|b| b == b'0');
            rest = &after[n..];
        }
    }
    let zone_ok = match rest {
        "Z" => true,
        z if z.len() == 6 && (z.starts_with('+') || z.starts_with('-')) && &z[3..4] == ":" => {
            digits(z, 1, 2).is_some_and(|h| h <= 23) && digits(z, 4, 2).is_some_and(|m| m <= 59)
        }
        _ => false,
    };
    zone_ok && minute <= 59 && second <= 59 && (hour <= 23 || (hour == 24 && minute == 0 && second == 0 && fraction_zero))
}

fn decimal(s: &str) -> bool {
    let body = s.strip_prefix('-').unwrap_or(s);
    let (int, frac) = match body.split_once('.') {
        Some((i, f)) => (i, Some(f)),
        None => (body, None),
    };
    !int.is_empty() && int.bytes().all(|b| b.is_ascii_digit()) && frac.is_none_or(|f| !f.is_empty() && f.bytes().all(|b| b.is_ascii_digit()))
}

/// `coerce`: a value checked against its field's kind BEFORE anything is sent.
fn coerce(view: &AgentView, table: &AgentTable, field: &AgentField, value: &Value) -> Result<Value, AppError> {
    if value.is_null() {
        return Ok(Value::Null);
    }
    let param = format!("values.{}", field.name);
    let invalid = || AppError::new("VALUE_INVALID").with("param", json!(param)).with("field", json!(field.name)).with("expected", json!(expected(&field.kind))).with("object", object_of(table));
    let options = field.id.as_ref().and_then(|id| view.raw.options.get(id));
    let is_option = |v: &Value| v.as_str().is_some_and(|v| options.is_some_and(|o| o.iter().any(|o| o.value == v)));
    match field.kind.as_str() {
        "short_text" | "long_text" => {
            let Some(text) = value.as_str().filter(|t| !t.contains('\u{0}')) else { return Err(invalid()) };
            if let Some(max) = field.row.as_ref().and_then(|r| r.max_length) {
                if text.chars().count() as i64 > max {
                    return Err(AppError::new("VALUE_TOO_LONG").with("param", json!(param)).with("field", json!(field.name)).with("maximum", json!(max)));
                }
            }
            Ok(value.clone())
        }
        "number" => match value {
            Value::Number(n) if n.as_f64().is_some_and(f64::is_finite) => Ok(json!(number_string(n.as_f64().unwrap_or_default()))),
            Value::String(s) if decimal(js_trim(s)) => Ok(json!(js_trim(s))),
            _ => Err(invalid()),
        },
        "boolean" => value.is_boolean().then(|| value.clone()).ok_or_else(invalid),
        "date" => value.as_str().filter(|s| valid_date(s)).map(|_| value.clone()).ok_or_else(invalid),
        "datetime" => value.as_str().filter(|s| valid_datetime(s)).map(|_| value.clone()).ok_or_else(invalid),
        "select" => is_option(value).then(|| value.clone()).ok_or_else(invalid),
        "multi_select" => {
            let items = match value {
                Value::Array(items) => items.clone(),
                other => vec![other.clone()],
            };
            items.iter().all(is_option).then_some(Value::Array(items)).ok_or_else(invalid)
        }
        "url" => basedb_records::values::shape_url(&field.name, value).map(|v| json!(v)).map_err(|_| invalid()),
        "email" => basedb_records::values::shape_email(&field.name, value).map(|v| json!(v)).map_err(|_| invalid()),
        "link" => {
            let Some(id) = value.as_str().filter(|s| is_uuid_ci(s)) else { return Err(invalid()) };
            // An unreadable target answers as a missing one, WITHOUT asking the database.
            if link_target(view, field).is_none() {
                return Err(AppError::new("LINK_TARGET_NOT_FOUND").with("param", json!(param)).with("field", json!(field.name)).with("object", object_of(table)));
            }
            Ok(json!(id.to_lowercase()))
        }
        _ => Err(invalid()),
    }
}

/// `writableValues`: each value resolved, checked for writability, and coerced.
fn writable_values(view: &AgentView, table: &AgentTable, values: &Map<String, Value>) -> Result<Map<String, Value>, AppError> {
    let mut out = Map::new();
    for (reference, value) in values {
        let param = format!("values.{reference}");
        let field = resolve_agent_field(table, reference, &param)?;
        if !field.writable {
            let mut e = AppError::new("FIELD_NOT_WRITABLE").with("param", json!(param)).with("field", json!(field.name)).with("object", object_of(table));
            if field.row.as_ref().is_some_and(|r| r.is_rich) {
                e = e.with("hint", json!("rich_text"));
            }
            return Err(e);
        }
        out.insert(field.name.clone(), coerce(view, table, field, value)?);
    }
    if out.is_empty() {
        return Err(parameter_invalid("values"));
    }
    Ok(out)
}

/// `requireWrite`: `PERMISSION_DENIED` when the bearer can read but not do;
/// `TOKEN_READ_ONLY` when the token is why.
pub fn require_write(table: &AgentTable, action: &str) -> Result<(), AppError> {
    let decision = match action {
        "create" => &table.decisions.create,
        "update" => &table.decisions.update,
        _ => &table.decisions.delete,
    };
    if decision.verdict == Verdict::Allowed {
        return Ok(());
    }
    let object = object_of(table);
    if decision.reason == "TOKEN_ACTION_NOT_GRANTED" {
        if action == "delete" && table.decisions.update.verdict == Verdict::Allowed {
            return Err(AppError::new("PERMISSION_DENIED").with("object", object).with("action", json!(action)).with("hint", json!("token_delete")));
        }
        return Err(AppError::new("TOKEN_READ_ONLY").with("object", object));
    }
    Err(AppError::new("PERMISSION_DENIED").with("object", object).with("action", json!(action)))
}

/// `idempotent`: a write under the idempotency claim of §6.3, when a key was supplied.
async fn idempotent<F, Fut>(pools: &Pools, ctx: &RequestContext, key: Option<&str>, tool: &str, params: &Value, work: F) -> Result<Value, AppError>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<Value, AppError>>,
{
    let Some(key) = key else { return work().await };
    if let Claim::Replay(response) = claim_idempotency(pools, ctx, key, tool, &params_hash(params)).await? {
        return Ok(response);
    }
    let response = match work().await {
        Ok(r) => r,
        Err(e) => {
            // Nothing was written: the key is freed for the corrected call.
            let _ = release_idempotency(pools, ctx, key).await;
            return Err(e);
        }
    };
    complete_idempotency(pools, ctx, key, &response).await?;
    Ok(response)
}

/// `readBack`: what was just written, under the READ mask, as `get_record` would.
pub async fn read_back(pools: &Pools, ctx: &RequestContext, instance_key: &str, view: &AgentView, table: &AgentTable, id: &str) -> Result<Option<Map<String, Value>>, AppError> {
    let request = AgentListRequest { select: Some(business_names(table)), filter: Some(by_id(id)), limit: Some(1.0), ..Default::default() };
    Ok(read_rows(pools, ctx, instance_key, view, table, &request).await?.records.into_iter().next())
}

/// `writeResult`.
pub fn write_result(view: &AgentView, table: &AgentTable, response: Value) -> AgentWriteResult {
    let mut names = vec!["_id".to_string()];
    names.extend(business_names(table));
    AgentWriteResult { table: table_ref(view, table), response, columns: columns_of(table, &names) }
}

fn outcome(id: &str, flags: &[(&str, bool)], record: Option<Map<String, Value>>, extra: Option<(&str, Value)>) -> Value {
    let mut out = Map::new();
    out.insert("_id".into(), json!(id));
    for (k, v) in flags {
        out.insert((*k).into(), json!(v));
    }
    if let Some((k, v)) = extra {
        out.insert(k.into(), v);
    }
    if let Some(record) = record {
        out.insert("record".into(), Value::Object(record));
    }
    out.insert("provenance".into(), json!("user_data"));
    Value::Object(out)
}

/// `create_record` — §6.1. `_id` is not a parameter: the kernel assigns it.
pub async fn agent_create_record(pools: &Pools, ctx: &RequestContext, instance_key: &str, base: &str, table: &str, values: &Map<String, Value>, idempotency_key: Option<&str>) -> Result<AgentWriteResult, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (agent_base, table) = resolve_agent_table(&view, base, table)?;
    require_write(table, "create")?;
    let values = writable_values(&view, table, values)?;
    let params = json!({ "base": agent_base.row.id, "table": table.row.id, "values": values });
    let view_ref = &view;
    let response = idempotent(pools, ctx, idempotency_key, "mcp.create_record", &params, || async move {
        let entries: Vec<(String, Value)> = values.into_iter().collect();
        let created = basedb_records::write::create_record(pools, ctx, &table.row.id, entries).await.map_err(|e| agent_error(e, Some(table), Some(view_ref)))?;
        let id = match created.row.get("_id") {
            Some(Value::String(s)) => s.clone(),
            Some(other) => other.to_string(),
            None => "undefined".into(),
        };
        let record = read_back(pools, ctx, instance_key, view_ref, table, &id).await?;
        Ok(outcome(&id, &[("created", true)], record, None))
    })
    .await?;
    Ok(write_result(&view, table, response))
}

/// `update_record` — §6.2. Only the named fields are written.
#[allow(clippy::too_many_arguments)]
pub async fn agent_update_record(pools: &Pools, ctx: &RequestContext, instance_key: &str, base: &str, table: &str, id: &str, values: &Map<String, Value>, idempotency_key: Option<&str>) -> Result<AgentWriteResult, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (agent_base, table) = resolve_agent_table(&view, base, table)?;
    require_write(table, "update")?;
    if !is_uuid_ci(id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let values = writable_values(&view, table, values)?;
    let lower = id.to_lowercase();
    let params = json!({ "base": agent_base.row.id, "table": table.row.id, "id": lower, "values": values });
    let view_ref = &view;
    let response = idempotent(pools, ctx, idempotency_key, "mcp.update_record", &params, || async move {
        let entries: Vec<(String, Value)> = values.into_iter().collect();
        basedb_records::write::update_record(pools, ctx, &table.row.id, id, entries).await.map_err(|e| agent_error(e, Some(table), Some(view_ref)))?;
        let record = read_back(pools, ctx, instance_key, view_ref, table, id).await?;
        Ok(outcome(&lower, &[("updated", true)], record, None))
    })
    .await?;
    Ok(write_result(&view, table, response))
}

/// `delete_record` — for a token created to delete. The row is read first and handed
/// back; `restore_record` brings it back.
pub async fn agent_delete_record(pools: &Pools, ctx: &RequestContext, instance_key: &str, base: &str, table: &str, id: &str, idempotency_key: Option<&str>) -> Result<AgentWriteResult, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (agent_base, table) = resolve_agent_table(&view, base, table)?;
    require_write(table, "delete")?;
    if !is_uuid_ci(id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let id = id.to_lowercase();
    let params = json!({ "base": agent_base.row.id, "table": table.row.id, "id": id });
    let (view_ref, id_ref) = (&view, &id);
    let response = idempotent(pools, ctx, idempotency_key, "mcp.delete_record", &params, || async move {
        let record = read_back(pools, ctx, instance_key, view_ref, table, id_ref).await?;
        basedb_records::write::delete_record(pools, ctx, &table.row.id, id_ref).await.map_err(|e| agent_error(e, Some(table), Some(view_ref)))?;
        Ok(outcome(id_ref, &[("deleted", true), ("restorable", true)], record, None))
    })
    .await?;
    Ok(write_result(&view, table, response))
}

/// `restore_record` — a deleted row back under its own `_id`; a restoration is a creation.
pub async fn agent_restore_record(pools: &Pools, ctx: &RequestContext, instance_key: &str, base: &str, table: &str, id: &str, idempotency_key: Option<&str>) -> Result<AgentWriteResult, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (agent_base, table) = resolve_agent_table(&view, base, table)?;
    require_write(table, "create")?;
    if !is_uuid_ci(id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let id = id.to_lowercase();
    let params = json!({ "base": agent_base.row.id, "table": table.row.id, "id": id });
    let (view_ref, id_ref) = (&view, &id);
    let response = idempotent(pools, ctx, idempotency_key, "mcp.restore_record", &params, || async move {
        basedb_records::history::restore_deleted_record(pools, ctx, &table.row.id, id_ref).await.map_err(|e| agent_error(e, Some(table), Some(view_ref)))?;
        let record = read_back(pools, ctx, instance_key, view_ref, table, id_ref).await?;
        Ok(outcome(id_ref, &[("restored", true)], record, None))
    })
    .await?;
    Ok(write_result(&view, table, response))
}

/// The response of `attach_file`, for `files.rs`.
pub(crate) fn attach_outcome(id: &str, file: Value, record: Option<Map<String, Value>>) -> Value {
    outcome(id, &[("updated", true)], record, Some(("file", file)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_are_v8_s() {
        for (s, ok) in [("2019-02-31", true), ("2019-02-32", false), ("2019-13-01", false), ("2019-00-10", false), ("2019-01-00", false), ("0000-01-01", true), ("2019-1-01", false)] {
            assert_eq!(valid_date(s), ok, "{s}");
        }
        for (s, ok) in [
            ("2024-01-01T24:00Z", true),
            ("2024-01-01T24:01Z", false),
            ("2024-01-01T23:60Z", false),
            ("2024-01-01T10:00:60Z", false),
            ("2024-01-01T10:00+24:00", false),
            ("2024-01-01T10:00+23:59", true),
            ("2024-01-01T10:00+23:60", false),
            ("2024-01-01T10:00:00.123456Z", true),
            ("2024-01-01T10:00:00.1234567Z", false),
            ("2024-01-01T10:00", false),
        ] {
            assert_eq!(valid_datetime(s), ok, "{s}");
        }
    }

    #[test]
    fn literals_escape_two_characters() {
        assert_eq!(literal(r#"a"b\c"#), r#""a\"b\\c""#);
        assert_eq!(scalar_of(Some(&json!(1.5)), "p").unwrap(), "\"1.5\"");
        assert_eq!(scalar_of(Some(&json!(true)), "p").unwrap(), "true");
        assert_eq!(scalar_of(None, "p").unwrap_err().code, "VALUE_INVALID");
        assert!(decimal("-12.50") && !decimal("1.") && !decimal(".5") && !decimal("1e3"));
    }
}
