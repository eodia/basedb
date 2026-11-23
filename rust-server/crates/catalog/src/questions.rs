//! Saved questions — chapter 18 §1 (`catalog/questions.ts`, `catalog/question-checks.ts`,
//! and the shape checks of `analytics/query.ts` and `analytics/sql.ts`).
//!
//! Running a question (`POST /query/:base`) reads records through their read plans: it
//! belongs to the records crate and stays relayed until then.

use crate::http::{collapse_spaces, nfc};
use crate::js::{js_length, js_numbers, js_round, js_slice};
use crate::queries::{check_groups, write_groups};
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::{load_grants, load_target};
use basedb_base::rbac::require::{load_base_target, require_on_base};
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

type R<T> = Result<T, AppError>;

pub const QUESTION_AUDIENCES: [&str; 3] = ["personal", "base", "groups"];
pub const SYSTEM_COLUMNS: [&str; 5] = ["_id", "_created_at", "_updated_at", "_created_by", "_updated_by"];

// `@basedb/contracts` analytics.
pub const TEMPORAL_UNITS: [&str; 7] = ["minute", "hour", "day", "week", "month", "quarter", "year"];
pub const TEMPORAL_EXTRACTIONS: [&str; 6] = ["hour_of_day", "day_of_week", "day_of_month", "week_of_year", "month_of_year", "quarter_of_year"];
pub const AGGREGATION_FNS: [&str; 10] = ["count", "distinct", "sum", "avg", "median", "min", "max", "stddev", "cum_count", "cum_sum"];
pub const COLUMNLESS_FNS: [&str; 2] = ["count", "cum_count"];
pub const JOIN_KINDS: [&str; 4] = ["left", "inner", "right", "full"];
pub const FILTER_OPS: [&str; 23] = [
    "is", "is_not", "contains", "not_contains", "starts_with", "ends_with", "eq", "ne", "gt", "gte", "lt", "lte", "between", "date", "before", "after", "true", "false", "has_any",
    "has_all", "has_none", "empty", "not_empty",
];
pub const SQL_VARIABLE_TYPES: [&str; 4] = ["text", "number", "date", "filter"];
pub const SQL_FILTER_KINDS: [&str; 4] = ["date", "datetime", "number", "text"];
pub const VISUALIZATIONS: [&str; 15] = ["table", "scalar", "trend", "progress", "gauge", "bar", "row", "line", "area", "combo", "pie", "scatter", "funnel", "pivot", "map"];

/// `QUERY_LIMITS`.
pub mod limits {
    pub const JOINS: usize = 4;
    pub const FILTERS: usize = 24;
    pub const AGGREGATIONS: usize = 12;
    pub const BREAKOUTS: usize = 3;
    pub const FIELDS: usize = 80;
    pub const SORT: usize = 6;
    pub const ROWS: f64 = 2000.0;
    pub const SQL: usize = 100_000;
    pub const VARIABLES: usize = 20;
    pub const BYTES: usize = 200_000;
}

fn filter_op(op: &str) -> bool {
    !op.is_empty() && FILTER_OPS.contains(&op)
}

fn is_temporal_unit(v: &Value) -> bool {
    v.as_str().is_some_and(|u| TEMPORAL_UNITS.contains(&u) || TEMPORAL_EXTRACTIONS.contains(&u))
}

/// `invalid(field, reason, detail?)` — `detail` left out when `undefined`.
pub fn invalid(field: &str, reason: &str, detail: Option<&Value>) -> AppError {
    let e = AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!(reason));
    match detail {
        Some(d) => e.with("detail", d.clone()),
        None => e,
    }
}

/// `text(value, max)`: a string trimmed and cut, `''` otherwise.
pub fn text(value: Option<&Value>, max: usize) -> String {
    match value {
        Some(Value::String(s)) => js_slice(crate::description::js_trim(s), max).to_string(),
        _ => String::new(),
    }
}

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("regex"))
}
fn builder_name(s: &str) -> bool {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"^[_a-z][a-z0-9_]{0,62}$").is_match(s)
}
fn alias_name(s: &str) -> bool {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"^[a-z][a-z0-9_]{0,30}$").is_match(s)
}
fn sql_name(s: &str) -> bool {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"^[A-Za-z_][A-Za-z0-9_]{0,62}$").is_match(s)
}

fn non_blank(v: Option<&Value>) -> Option<&str> {
    v.and_then(Value::as_str).filter(|s| !crate::description::js_trim(s).is_empty())
}

fn list_of<'a>(value: Option<&'a Value>, at: &str, max: usize) -> R<&'a [Value]> {
    match value {
        None | Some(Value::Null) => Ok(&[]),
        Some(Value::Array(items)) if items.len() > max => Err(invalid(at, "trop_d_elements", Some(&json!(max)))),
        Some(Value::Array(items)) => Ok(items),
        Some(_) => Err(invalid(at, "liste_attendue", None)),
    }
}

/// A column a builder query cites: `{ join?, field }`.
#[derive(Debug, Clone, PartialEq)]
pub struct ColumnRef {
    pub join: Option<String>,
    pub field: String,
}

impl ColumnRef {
    fn to_json(&self) -> Value {
        match &self.join {
            Some(j) => json!({ "join": j, "field": self.field }),
            None => json!({ "field": self.field }),
        }
    }
    /// `columnName`.
    pub fn name(&self) -> String {
        match &self.join {
            Some(j) => format!("{j}.{}", self.field),
            None => self.field.clone(),
        }
    }
}

fn column_ref(value: Option<&Value>, at: &str) -> R<ColumnRef> {
    let Some(Value::Object(m)) = value else { return Err(invalid(at, "colonne_invalide", None)) };
    let field = match m.get("field") {
        Some(Value::String(f)) if builder_name(f) => f.clone(),
        _ => return Err(invalid(at, "colonne_invalide", None)),
    };
    match m.get("join") {
        None | Some(Value::Null) => Ok(ColumnRef { join: None, field }),
        Some(Value::String(j)) if j.is_empty() => Ok(ColumnRef { join: None, field }),
        Some(Value::String(j)) if alias_name(j) => Ok(ColumnRef { join: Some(j.clone()), field }),
        Some(_) => Err(invalid(&format!("{at}.join"), "jointure_invalide", None)),
    }
}

struct Join {
    alias: String,
    table: String,
    kind: String,
    left: ColumnRef,
    right: String,
    implicit: bool,
}

enum Filter {
    Expression { expression: String, join: Option<String> },
    Column { column: ColumnRef, op: String, values: Vec<Value> },
}

fn filter_of(value: &Value, at: &str) -> R<Filter> {
    let Value::Object(m) = value else { return Err(invalid(at, "filtre_invalide", None)) };
    if let Some(Value::String(e)) = m.get("expression") {
        let expression = crate::description::js_trim(e).to_string();
        if expression.is_empty() {
            return Err(invalid(at, "filtre_vide", None));
        }
        let join = m.get("join").and_then(Value::as_str).filter(|j| !j.is_empty()).map(String::from);
        return Ok(Filter::Expression { expression, join });
    }
    let op = match m.get("op") {
        Some(Value::String(op)) if filter_op(op) => op.clone(),
        other => return Err(invalid(&format!("{at}.op"), "operateur_inconnu", other)),
    };
    let mut values = Vec::new();
    for (i, v) in list_of(m.get("values"), &format!("{at}.values"), 200)?.iter().enumerate() {
        match v {
            Value::String(_) | Value::Bool(_) | Value::Number(_) => values.push(v.clone()),
            _ => return Err(invalid(&format!("{at}.values[{i}]"), "valeur_invalide", None)),
        }
    }
    Ok(Filter::Column { column: column_ref(m.get("column"), &format!("{at}.column"))?, op, values })
}

struct Aggregation {
    fn_: String,
    column: Option<ColumnRef>,
    label: Option<String>,
}

struct Breakout {
    column: ColumnRef,
    unit: Option<String>,
    bin: Option<Value>,
}

enum SortTarget {
    Ranked(String, Value),
    Column(ColumnRef),
}

/// `checkBuilderQuery`: a builder query's shape and bounds, as a JSON value, together with
/// the table keys it names so that `checked_query` can resolve them.
struct BuilderQuery {
    source: String,
    joins: Vec<Join>,
    filters: Vec<Filter>,
    aggregations: Vec<Aggregation>,
    breakouts: Vec<Breakout>,
    fields: Vec<ColumnRef>,
    sort: Vec<(SortTarget, bool)>,
    limit: Option<i64>,
}

impl BuilderQuery {
    fn to_json(&self) -> Value {
        let mut out = Map::new();
        out.insert("kind".into(), json!("builder"));
        out.insert("source".into(), json!(self.source));
        if !self.joins.is_empty() {
            out.insert(
                "joins".into(),
                Value::Array(
                    self.joins
                        .iter()
                        .map(|j| {
                            let mut m = Map::new();
                            m.insert("alias".into(), json!(j.alias));
                            m.insert("table".into(), json!(j.table));
                            m.insert("kind".into(), json!(j.kind));
                            m.insert("left".into(), j.left.to_json());
                            m.insert("right".into(), json!(j.right));
                            if j.implicit {
                                m.insert("implicit".into(), json!(true));
                            }
                            Value::Object(m)
                        })
                        .collect(),
                ),
            );
        }
        if !self.filters.is_empty() {
            out.insert(
                "filters".into(),
                Value::Array(
                    self.filters
                        .iter()
                        .map(|f| match f {
                            Filter::Expression { expression, join: Some(j) } => json!({ "expression": expression, "join": j }),
                            Filter::Expression { expression, join: None } => json!({ "expression": expression }),
                            Filter::Column { column, op, values } => json!({ "column": column.to_json(), "op": op, "values": values }),
                        })
                        .collect(),
                ),
            );
        }
        if !self.aggregations.is_empty() {
            out.insert(
                "aggregations".into(),
                Value::Array(
                    self.aggregations
                        .iter()
                        .map(|a| {
                            let mut m = Map::new();
                            m.insert("fn".into(), json!(a.fn_));
                            if let Some(c) = &a.column {
                                m.insert("column".into(), c.to_json());
                            }
                            if let Some(l) = &a.label {
                                m.insert("label".into(), json!(l));
                            }
                            Value::Object(m)
                        })
                        .collect(),
                ),
            );
        }
        if !self.breakouts.is_empty() {
            out.insert(
                "breakouts".into(),
                Value::Array(
                    self.breakouts
                        .iter()
                        .map(|b| {
                            let Value::Object(mut m) = b.column.to_json() else { unreachable!() };
                            if let Some(u) = &b.unit {
                                m.insert("unit".into(), json!(u));
                            }
                            if let Some(bin) = &b.bin {
                                m.insert("bin".into(), bin.clone());
                            }
                            Value::Object(m)
                        })
                        .collect(),
                ),
            );
        }
        if !self.fields.is_empty() {
            out.insert("fields".into(), Value::Array(self.fields.iter().map(ColumnRef::to_json).collect()));
        }
        if !self.sort.is_empty() {
            out.insert(
                "sort".into(),
                Value::Array(
                    self.sort
                        .iter()
                        .map(|(t, desc)| match t {
                            SortTarget::Ranked(kind, index) => json!({ "target": { "kind": kind, "index": index }, "desc": desc }),
                            SortTarget::Column(c) => json!({ "target": { "kind": "column", "column": c.to_json() }, "desc": desc }),
                        })
                        .collect(),
                ),
            );
        }
        if let Some(l) = self.limit {
            out.insert("limit".into(), json!(l));
        }
        js_numbers(Value::Object(out))
    }
}

/// `checkBuilderQuery`, for whoever runs a question (the records crate): the checked
/// query as JSON, in the shape `BuilderQuery` serializes.
pub fn checked_builder_query(raw: &Value, at: &str) -> R<Value> {
    check_builder_query(raw, at).map(|q| q.to_json())
}

fn check_builder_query(raw: &Value, at: &str) -> R<BuilderQuery> {
    let Value::Object(raw) = raw else { return Err(invalid(at, "requete_invalide", None)) };
    if js_length(&Value::Object(raw.clone()).to_string()) > limits::BYTES {
        return Err(invalid(at, "requete_trop_longue", None));
    }
    let source = match raw.get("source") {
        Some(Value::String(s)) if !s.is_empty() => s.clone(),
        _ => return Err(invalid(&format!("{at}.source"), "table_requise", None)),
    };

    let mut aliases: Vec<String> = Vec::new();
    let mut joins = Vec::new();
    for (i, item) in list_of(raw.get("joins"), &format!("{at}.joins"), limits::JOINS)?.iter().enumerate() {
        let w = format!("{at}.joins[{i}]");
        let Value::Object(item) = item else { return Err(invalid(&w, "jointure_invalide", None)) };
        let alias = match item.get("alias") {
            Some(Value::String(a)) if alias_name(a) && !aliases.contains(a) => a.clone(),
            other => return Err(invalid(&format!("{w}.alias"), "alias_invalide", other)),
        };
        aliases.push(alias.clone());
        let table = match item.get("table") {
            Some(Value::String(t)) if !t.is_empty() => t.clone(),
            _ => return Err(invalid(&format!("{w}.table"), "table_requise", None)),
        };
        let kind = item.get("kind").and_then(Value::as_str).filter(|k| JOIN_KINDS.contains(k)).unwrap_or("left").to_string();
        let right = match item.get("right") {
            Some(Value::String(r)) if builder_name(r) => r.clone(),
            _ => return Err(invalid(&format!("{w}.right"), "colonne_invalide", None)),
        };
        let left = column_ref(item.get("left"), &format!("{w}.left"))?;
        joins.push(Join { alias, table, kind, left, right, implicit: item.get("implicit") == Some(&Value::Bool(true)) });
    }

    let mut filters = Vec::new();
    for (i, f) in list_of(raw.get("filters"), &format!("{at}.filters"), limits::FILTERS)?.iter().enumerate() {
        filters.push(filter_of(f, &format!("{at}.filters[{i}]"))?);
    }

    let mut aggregations = Vec::new();
    for (i, item) in list_of(raw.get("aggregations"), &format!("{at}.aggregations"), limits::AGGREGATIONS)?.iter().enumerate() {
        let w = format!("{at}.aggregations[{i}]");
        let fn_ = match item {
            Value::Object(m) => match m.get("fn") {
                Some(Value::String(f)) if AGGREGATION_FNS.contains(&f.as_str()) => f.clone(),
                other => return Err(invalid(&w, "agregat_invalide", other)),
            },
            _ => return Err(invalid(&w, "agregat_invalide", None)),
        };
        let label = non_blank(item.get("label")).map(|l| js_slice(crate::description::js_trim(l), 120).to_string());
        let column = if COLUMNLESS_FNS.contains(&fn_.as_str()) { None } else { Some(column_ref(item.get("column"), &format!("{w}.column"))?) };
        aggregations.push(Aggregation { fn_, column, label });
    }

    let mut breakouts = Vec::new();
    for (i, item) in list_of(raw.get("breakouts"), &format!("{at}.breakouts"), limits::BREAKOUTS)?.iter().enumerate() {
        let w = format!("{at}.breakouts[{i}]");
        let column = column_ref(Some(item), &w)?;
        let unit = item.get("unit");
        if !matches!(unit, None | Some(Value::Null)) && !unit.is_some_and(is_temporal_unit) {
            return Err(invalid(&format!("{w}.unit"), "unite_inconnue", unit));
        }
        let bin = match item.get("bin") {
            Some(Value::String(s)) if s == "auto" => Some(json!("auto")),
            Some(Value::Number(n)) => {
                if n.as_f64().is_some_and(|f| f > 0.0) {
                    Some(Value::Number(n.clone()))
                } else {
                    return Err(invalid(&format!("{w}.bin"), "pas_invalide", None));
                }
            }
            _ => None,
        };
        breakouts.push(Breakout { column, unit: unit.filter(|u| is_temporal_unit(u)).and_then(Value::as_str).map(String::from), bin });
    }

    let mut fields = Vec::new();
    for (i, f) in list_of(raw.get("fields"), &format!("{at}.fields"), limits::FIELDS)?.iter().enumerate() {
        fields.push(column_ref(Some(f), &format!("{at}.fields[{i}]"))?);
    }

    let mut sort = Vec::new();
    for (i, item) in list_of(raw.get("sort"), &format!("{at}.sort"), limits::SORT)?.iter().enumerate() {
        let w = format!("{at}.sort[{i}]");
        let target = match item {
            Value::Object(m) => match m.get("target") {
                Some(Value::Object(t)) => t,
                _ => return Err(invalid(&w, "tri_invalide", None)),
            },
            _ => return Err(invalid(&w, "tri_invalide", None)),
        };
        let desc = item.get("desc") == Some(&Value::Bool(true));
        match target.get("kind").and_then(Value::as_str) {
            Some(kind @ ("aggregation" | "breakout")) => {
                let count = if kind == "aggregation" { aggregations.len() } else { breakouts.len() };
                let index = target.get("index");
                let ok = index.and_then(Value::as_f64).is_some_and(|f| f.fract() == 0.0 && f >= 0.0 && f < count as f64);
                if !ok {
                    return Err(invalid(&format!("{w}.target.index"), "rang_invalide", index));
                }
                sort.push((SortTarget::Ranked(kind.to_string(), index.cloned().unwrap_or(Value::Null)), desc));
            }
            Some("column") => sort.push((SortTarget::Column(column_ref(target.get("column"), &format!("{w}.target.column"))?), desc)),
            _ => return Err(invalid(&format!("{w}.target"), "tri_invalide", None)),
        }
    }

    let limit = raw.get("limit").and_then(Value::as_f64).map(|f| js_round(f).clamp(1.0, limits::ROWS) as i64);

    let mut declared: HashSet<&str> = HashSet::new();
    for (i, j) in joins.iter().enumerate() {
        if let Some(l) = &j.left.join {
            if !declared.contains(l.as_str()) {
                return Err(invalid(&format!("{at}.joins[{i}].left.join"), "jointure_inconnue", Some(&json!(l))));
            }
        }
        declared.insert(&j.alias);
    }
    let known = |r: &ColumnRef, w: String| -> R<()> {
        match &r.join {
            Some(j) if !aliases.contains(j) => Err(invalid(&w, "jointure_inconnue", Some(&json!(j)))),
            _ => Ok(()),
        }
    };
    for (i, f) in filters.iter().enumerate() {
        match f {
            Filter::Column { column, .. } => known(column, format!("{at}.filters[{i}]"))?,
            Filter::Expression { join: Some(j), .. } if !aliases.contains(j) => {
                return Err(invalid(&format!("{at}.filters[{i}].join"), "jointure_inconnue", Some(&json!(j))));
            }
            _ => {}
        }
    }
    for (i, a) in aggregations.iter().enumerate() {
        if let Some(c) = &a.column {
            known(c, format!("{at}.aggregations[{i}]"))?;
        }
    }
    for (i, b) in breakouts.iter().enumerate() {
        known(&b.column, format!("{at}.breakouts[{i}]"))?;
    }
    for (i, f) in fields.iter().enumerate() {
        known(f, format!("{at}.fields[{i}]"))?;
    }
    Ok(BuilderQuery { source, joins, filters, aggregations, breakouts, fields, sort, limit })
}

/// `checkSqlQuery`.
pub fn check_sql_query(raw: &Value, at: &str) -> R<Value> {
    if !matches!(raw, Value::Object(_) | Value::Array(_)) {
        return Err(invalid(at, "requete_invalide", None));
    }
    let sql = match raw.get("sql") {
        Some(Value::String(s)) if !crate::description::js_trim(s).is_empty() => s.clone(),
        _ => return Err(invalid(&format!("{at}.sql"), "sql_requis", None)),
    };
    if js_length(&sql) > limits::SQL {
        return Err(invalid(&format!("{at}.sql"), "sql_trop_long", None));
    }
    let raws: &[Value] = match raw.get("variables") {
        None | Some(Value::Null) => &[],
        Some(Value::Array(items)) if items.len() <= limits::VARIABLES => items,
        _ => return Err(invalid(&format!("{at}.variables"), "liste_attendue", None)),
    };
    let mut names: Vec<String> = Vec::new();
    let mut variables = Vec::new();
    for (i, v) in raws.iter().enumerate() {
        let w = format!("{at}.variables[{i}]");
        let name = match v.get("name") {
            Some(Value::String(n)) if sql_name(n) && !names.contains(n) => n.clone(),
            other => return Err(invalid(&format!("{w}.name"), "nom_invalide", other)),
        };
        names.push(name.clone());
        let ty = v.get("type").and_then(Value::as_str).filter(|t| SQL_VARIABLE_TYPES.contains(t)).unwrap_or("text");
        let label = non_blank(v.get("label")).map(|l| js_slice(crate::description::js_trim(l), 120).to_string()).unwrap_or_else(|| name.clone());
        let mut out = Map::new();
        out.insert("name".into(), json!(name));
        out.insert("label".into(), json!(label));
        out.insert("type".into(), json!(ty));
        if v.get("required") == Some(&Value::Bool(true)) {
            out.insert("required".into(), json!(true));
        }
        if let Some(d @ (Value::String(_) | Value::Array(_))) = v.get("default") {
            out.insert("default".into(), d.clone());
        }
        if ty == "filter" {
            let column = match v.get("column") {
                Some(Value::String(c)) if !crate::description::js_trim(c).is_empty() && js_length(c) <= 500 => crate::description::js_trim(c).to_string(),
                _ => return Err(invalid(&format!("{w}.column"), "colonne_requise", None)),
            };
            out.insert("column".into(), json!(column));
            let kind = v.get("column_kind").and_then(Value::as_str).filter(|k| SQL_FILTER_KINDS.contains(k)).unwrap_or("text");
            out.insert("column_kind".into(), json!(kind));
        }
        variables.push(Value::Object(out));
    }
    let mut out = Map::new();
    out.insert("kind".into(), json!("sql"));
    out.insert("sql".into(), json!(sql));
    if !variables.is_empty() {
        out.insert("variables".into(), Value::Array(variables));
    }
    Ok(js_numbers(Value::Object(out)))
}

/// A live table of a base: its key, its name, its fields' names.
#[derive(Debug, Clone)]
pub struct TableNames {
    pub id: String,
    pub name: String,
    pub fields: HashSet<String>,
}

/// `tablesOf`, in the order the rows came.
pub async fn tables_of<E: Exec + Sync>(exec: &E, base_id: &str) -> R<Vec<TableNames>> {
    let rows = exec
        .rows(
            "SELECT t.id::text, tn.name, fn.name AS field
               FROM _basedb.table_def t
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               LEFT JOIN _basedb.field f ON f.table_id = t.id AND f.is_live
               LEFT JOIN _basedb.physical_name fn ON fn.id = f.name_id
              WHERE t.base_id = $1::text::uuid AND t.is_live",
            &[&base_id],
        )
        .await?;
    let mut out: Vec<TableNames> = Vec::new();
    for r in rows {
        let id: String = r.get(0);
        let field: Option<String> = r.get(2);
        let at = match out.iter().position(|t| t.id == id) {
            Some(i) => i,
            None => {
                out.push(TableNames { id, name: r.get(1), fields: SYSTEM_COLUMNS.iter().map(|s| s.to_string()).collect() });
                out.len() - 1
            }
        };
        if let Some(f) = field {
            out[at].fields.insert(f);
        }
    }
    Ok(out)
}

/// `checkedQuery`: a query checked against the base as it is built.
pub fn checked_query(raw: Option<&Value>, tables: &[TableNames], at: &str) -> R<Value> {
    let raw = raw.unwrap_or(&Value::Null);
    if raw.get("kind").and_then(Value::as_str) == Some("sql") && raw.is_object() {
        return check_sql_query(raw, at);
    }
    let mut query = check_builder_query(raw, at)?;
    let table = |id: &str, w: String| -> R<&TableNames> {
        tables.iter().find(|t| t.id == id).or_else(|| tables.iter().find(|t| t.name == id)).ok_or_else(|| invalid(&w, "table_inconnue", Some(&json!(id))))
    };
    let source = table(&query.source, format!("{at}.source"))?;
    let mut by_alias: HashMap<String, &TableNames> = HashMap::new();
    by_alias.insert(String::new(), source);
    let mut join_ids = Vec::new();
    for (i, j) in query.joins.iter().enumerate() {
        let joined = table(&j.table, format!("{at}.joins[{i}].table"))?;
        by_alias.insert(j.alias.clone(), joined);
        join_ids.push(joined.id.clone());
    }
    let field = |r: &ColumnRef, w: String| -> R<()> {
        match by_alias.get(r.join.as_deref().unwrap_or("")) {
            Some(scope) if scope.fields.contains(&r.field) => Ok(()),
            _ => Err(invalid(&w, "champ_inconnu", Some(&json!(r.name())))),
        }
    };
    for (i, j) in query.joins.iter().enumerate() {
        field(&j.left, format!("{at}.joins[{i}].left"))?;
        field(&ColumnRef { join: Some(j.alias.clone()), field: j.right.clone() }, format!("{at}.joins[{i}].right"))?;
    }
    for (i, f) in query.filters.iter().enumerate() {
        if let Filter::Column { column, .. } = f {
            field(column, format!("{at}.filters[{i}]"))?;
        }
    }
    for (i, a) in query.aggregations.iter().enumerate() {
        if let Some(c) = &a.column {
            field(c, format!("{at}.aggregations[{i}]"))?;
        }
    }
    for (i, b) in query.breakouts.iter().enumerate() {
        field(&b.column, format!("{at}.breakouts[{i}]"))?;
    }
    for (i, f) in query.fields.iter().enumerate() {
        field(f, format!("{at}.fields[{i}]"))?;
    }
    query.source = source.id.clone();
    for (j, id) in query.joins.iter_mut().zip(join_ids) {
        j.table = id;
    }
    Ok(query.to_json())
}

/// `checkedVisualization`.
pub fn checked_visualization(raw: &Value, at: &str) -> R<Value> {
    let Value::Object(v) = raw else { return Err(invalid(at, "visualisation_invalide", None)) };
    let ty = match v.get("type") {
        Some(Value::String(t)) if VISUALIZATIONS.contains(&t.as_str()) => t.clone(),
        other => return Err(invalid(&format!("{at}.type"), "visualisation_inconnue", other)),
    };
    let settings = match v.get("settings") {
        None | Some(Value::Null) => Map::new(),
        Some(Value::Object(m)) => m.clone(),
        Some(_) => return Err(invalid(&format!("{at}.settings"), "reglages_invalides", None)),
    };
    let plain = js_numbers(Value::Object(settings));
    if js_length(&plain.to_string()) > 20_000 {
        return Err(invalid(&format!("{at}.settings"), "reglages_trop_longs", None));
    }
    let mut out = Map::new();
    out.insert("type".into(), json!(ty));
    if plain.as_object().is_some_and(|m| !m.is_empty()) {
        out.insert("settings".into(), plain);
    }
    Ok(Value::Object(out))
}

const SELECT: &str = "
  SELECT q.id::text, q.label, q.description, q.kind, q.query, q.visualization, q.position,
         q.audience, q.created_by::text AS owner_id, o.display_name AS owner_name,
         q.updated_at::text, q.updated_by::text, u.display_name AS updater,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id::text, 'label', r.label)
                                    ORDER BY r.label)
                     FROM _basedb.question_role qr
                     JOIN _basedb.role r ON r.id = qr.role_id AND r.deleted_at IS NULL
                    WHERE qr.question_id = q.id), '[]'::jsonb) AS groups
    FROM _basedb.question q
    LEFT JOIN _basedb.app_user o ON o.id = q.created_by
    LEFT JOIN _basedb.app_user u ON u.id = q.updated_by";

const VISIBLE: &str = "
  (q.created_by::text = $2
   OR q.audience = 'base'
   OR (q.audience = 'groups'
       AND ($3::boolean OR EXISTS (
             SELECT 1 FROM _basedb.question_role qr
               JOIN _basedb.role_member m ON m.role_id = qr.role_id
              WHERE qr.question_id = q.id AND m.user_id::text = $2))))";

/// A saved question, as `serializeQuestion` writes it.
#[derive(Debug, Clone)]
pub struct Question {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub kind: String,
    pub query: Value,
    pub visualization: Value,
    pub position: i32,
    pub audience: String,
    pub groups: Value,
    pub owner: (String, String),
    pub mine: bool,
    pub editable: bool,
    pub updated_at: String,
    pub updated_by: (String, String),
}

impl Question {
    fn of(r: &tokio_postgres::Row, ctx: &RequestContext, manages: bool) -> Question {
        let owner_id: String = r.get(8);
        let audience: String = r.get(7);
        let mine = owner_id == ctx.actor.id;
        let visualization: Value = r.get(5);
        Question {
            id: r.get(0),
            label: r.get(1),
            description: r.get(2),
            kind: r.get(3),
            query: r.get(4),
            visualization: if visualization.get("type").is_some() { visualization } else { json!({ "type": "table" }) },
            position: r.get(6),
            groups: if audience == "groups" { r.get(13) } else { json!([]) },
            editable: ctx.actor.kind == ActorKind::User && if audience == "personal" { mine } else { manages },
            audience,
            owner: (owner_id, r.get::<_, Option<String>>(9).unwrap_or_default()),
            mine,
            updated_at: r.get(10),
            updated_by: (r.get(11), r.get::<_, Option<String>>(12).unwrap_or_default()),
        }
    }

    /// `serializeQuestion` of `app.ts`.
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "label": self.label,
            "description": self.description,
            "kind": self.kind,
            "query": self.query,
            "visualization": self.visualization,
            "position": self.position,
            "audience": self.audience,
            "groups": self.groups,
            "owner": { "id": self.owner.0, "name": self.owner.1 },
            "mine": self.mine,
            "editable": self.editable,
            "updated_at": self.updated_at,
            "updated_by": { "id": self.updated_by.0, "name": self.updated_by.1 },
        })
    }
}

/// `QuestionInput`: each key as the body gave it, `group_ids` as `groupIds`.
#[derive(Debug, Clone, Copy, Default)]
pub struct QuestionInput<'a> {
    pub label: Option<&'a Value>,
    pub description: Option<&'a Value>,
    pub query: Option<&'a Value>,
    pub visualization: Option<&'a Value>,
    pub position: Option<&'a Value>,
    pub audience: Option<&'a Value>,
    pub group_ids: Option<&'a Value>,
}

impl<'a> QuestionInput<'a> {
    pub fn of_body(body: &'a Value) -> QuestionInput<'a> {
        QuestionInput {
            label: body.get("label"),
            description: body.get("description"),
            query: body.get("query"),
            visualization: body.get("visualization"),
            position: body.get("position"),
            audience: body.get("audience"),
            group_ids: body.get("group_ids"),
        }
    }
}

/// `canReadTable`.
pub async fn can_read_table<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> R<bool> {
    let Some(target) = load_target(exec, ctx, table_id).await? else { return Ok(false) };
    let grants = load_grants(exec, ctx).await?;
    Ok(decide(ctx, &grants, Action::Read, &target).verdict == Verdict::Allowed)
}

/// `requireSeesBase`: the caller reads one of its tables, or builds it.
pub async fn require_sees_base<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<()> {
    let tables = exec.rows("SELECT id::text FROM _basedb.table_def WHERE base_id = $1::text::uuid AND is_live", &[&base_id]).await?;
    for t in tables {
        if can_read_table(exec, ctx, &t.get::<_, String>(0)).await? {
            return Ok(());
        }
    }
    require_on_base(exec, ctx, Action::ManageSchema, base_id).await?;
    Ok(())
}

async fn access<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<bool> {
    require_sees_base(exec, ctx, base_id).await?;
    if ctx.actor.kind != ActorKind::User {
        return Ok(false);
    }
    let Some(target) = load_base_target(exec, ctx, base_id).await? else { return Ok(false) };
    let grants = load_grants(exec, ctx).await?;
    Ok(decide(ctx, &grants, Action::ManageSchema, &target).verdict == Verdict::Allowed)
}

fn require_person(ctx: &RequestContext, base_id: &str) -> R<()> {
    if ctx.actor.kind != ActorKind::User {
        return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
    }
    Ok(())
}

fn admin_required(key: &str, id: &str) -> AppError {
    AppError::new("ADMIN_REQUIRED").with(key, json!(id))
}

/// `listQuestions`.
pub async fn list_questions(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Vec<Question>> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let manages = access(&tx, ctx, base_id).await?;
        let rows = tx
            .rows(
                &format!("{SELECT}\n WHERE q.base_id = $1::text::uuid AND q.deleted_at IS NULL AND {VISIBLE}\n ORDER BY q.position, q.created_at"),
                &[&base_id, &ctx.actor.id, &manages],
            )
            .await?;
        Ok(rows.iter().map(|r| Question::of(r, ctx, manages)).collect())
    })
    .await
}

/// `getQuestion`.
pub async fn get_question(pools: &Pools, ctx: &RequestContext, base_id: &str, id: &str) -> R<Question> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let manages = access(&tx, ctx, base_id).await?;
        visible_row(&tx, ctx, base_id, id, manages).await
    })
    .await
}

/// `createQuestion`.
pub async fn create_question(pools: &Pools, ctx: &RequestContext, base_id: &str, input: QuestionInput<'_>) -> R<Question> {
    require_person(ctx, base_id)?;
    let label = check_label(input.label)?;
    let audience = match input.audience {
        None | Some(Value::Null) => "personal".to_string(),
        Some(v) => check_audience(v)?,
    };
    let (label, audience) = (&label, &audience);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let manages = access(&tx, ctx, base_id).await?;
        if audience != "personal" && !manages {
            return Err(admin_required("base", base_id));
        }
        let group_ids = if audience == "groups" { check_groups(&tx, ctx, input.group_ids.and_then(Value::as_array).map(Vec::as_slice)).await? } else { vec![] };
        let query = checked_query(input.query, &tables_of(&tx, base_id).await?, "query")?;
        let visualization = match input.visualization {
            None => json!({ "type": "table" }),
            Some(v) => checked_visualization(v, "visualization")?,
        };
        let description = Some(text(input.description, 2000)).filter(|d| !d.is_empty());
        let kind = query["kind"].as_str().unwrap_or("builder").to_string();
        let row = tx
            .query_op(
                "INSERT INTO _basedb.question
                   (base_id, label, description, kind, query, visualization, position, audience,
                    created_by, updated_by)
                 SELECT $1::text::uuid, $2::text, $3::text, $4::text, $5::text::jsonb, $6::text::jsonb,
                        coalesce(max(position), 0) + 1, $7::text, $8::text::uuid, $8::text::uuid
                   FROM _basedb.question WHERE base_id = $1::text::uuid AND deleted_at IS NULL
                 RETURNING id::text",
                &[&base_id, label, &description, &kind, &query.to_string(), &visualization.to_string(), audience, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let id: String = row[0].get(0);
        write_groups(&tx, &id, &group_ids).await?;
        let mut payload = Map::new();
        payload.insert("audience".into(), json!(audience));
        payload.insert("groups".into(), json!(group_ids));
        payload.insert("query".into(), query);
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(id.clone()), object_name: Some(label.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("question.create", "question") },
        )
        .await?;
        visible_row(&tx, ctx, base_id, &id, manages).await
    })
    .await
}

/// `updateQuestion`.
pub async fn update_question(pools: &Pools, ctx: &RequestContext, base_id: &str, id: &str, input: QuestionInput<'_>) -> R<Question> {
    require_person(ctx, base_id)?;
    let label = match input.label {
        None => None,
        Some(v) => Some(check_label(Some(v))?),
    };
    let audience = match input.audience {
        None => None,
        Some(v) => Some(check_audience(v)?),
    };
    let (label, audience) = (&label, &audience);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let manages = access(&tx, ctx, base_id).await?;
        let current = visible_row(&tx, ctx, base_id, id, manages).await?;
        if !current.editable {
            return Err(admin_required("question", id));
        }
        let next_audience = audience.clone().unwrap_or_else(|| current.audience.clone());
        if next_audience != current.audience && !manages {
            return Err(admin_required("base", base_id));
        }
        let description = match input.description {
            None => current.description.clone(),
            Some(d) => Some(text(Some(d), 2000)).filter(|d| !d.is_empty()),
        };
        let query = match input.query {
            None => current.query.clone(),
            Some(q) => checked_query(Some(q), &tables_of(&tx, base_id).await?, "query")?,
        };
        let visualization = match input.visualization {
            None => current.visualization.clone(),
            Some(v) => checked_visualization(v, "visualization")?,
        };
        let position: i64 = match input.position.and_then(Value::as_f64) {
            Some(p) => js_round(p) as i64,
            None => current.position as i64,
        };
        let group_ids = if next_audience != "groups" {
            Some(vec![])
        } else if input.group_ids.is_some() || current.audience != "groups" {
            Some(check_groups(&tx, ctx, input.group_ids.and_then(Value::as_array).map(Vec::as_slice)).await?)
        } else {
            None
        };
        let next_label = label.clone().unwrap_or_else(|| current.label.clone());
        let kind = query["kind"].as_str().unwrap_or("builder").to_string();
        tx.execute_op(
            "UPDATE _basedb.question
                SET label = $2::text, description = $3::text, kind = $4::text, query = $5::text::jsonb,
                    visualization = $6::text::jsonb, position = $7::bigint, audience = $8::text, updated_by = $9::text::uuid,
                    updated_at = pg_catalog.clock_timestamp()
              WHERE id = $1::text::uuid",
            &[&current.id, &next_label, &description, &kind, &query.to_string(), &visualization.to_string(), &position, &next_audience, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        if let Some(ids) = &group_ids {
            tx.execute_op("DELETE FROM _basedb.question_role WHERE question_id = $1::text::uuid", &[&current.id], SqlOp::Delete).await?;
            write_groups(&tx, &current.id, ids).await?;
        }
        let mut payload = Map::new();
        payload.insert("audience".into(), json!(next_audience));
        if let Some(ids) = &group_ids {
            payload.insert("groups".into(), json!(ids));
        }
        if input.query.is_some() {
            payload.insert("query".into(), query);
        }
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(current.id.clone()), object_name: Some(next_label), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("question.update", "question") },
        )
        .await?;
        visible_row(&tx, ctx, base_id, id, manages).await
    })
    .await
}

/// `deleteQuestion`.
pub async fn delete_question(pools: &Pools, ctx: &RequestContext, base_id: &str, id: &str) -> R<()> {
    require_person(ctx, base_id)?;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let manages = access(&tx, ctx, base_id).await?;
        let current = visible_row(&tx, ctx, base_id, id, manages).await?;
        if !current.editable {
            return Err(admin_required("question", id));
        }
        tx.execute_op("UPDATE _basedb.question SET deleted_at = pg_catalog.clock_timestamp() WHERE id = $1::text::uuid", &[&current.id], SqlOp::Update).await?;
        let mut payload = Map::new();
        payload.insert("audience".into(), json!(current.audience));
        payload.insert("query".into(), current.query.clone());
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(current.id.clone()), object_name: Some(current.label.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("question.delete", "question") },
        )
        .await
    })
    .await
}

async fn visible_row<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str, id: &str, manages: bool) -> R<Question> {
    let row = exec
        .first(
            &format!("{SELECT}\n WHERE q.id::text = $4 AND q.base_id = $1::text::uuid AND q.deleted_at IS NULL AND {VISIBLE}"),
            &[&base_id, &ctx.actor.id, &manages, &id],
        )
        .await?;
    match row {
        Some(r) => Ok(Question::of(&r, ctx, manages)),
        None => Err(AppError::new("RESOURCE_NOT_FOUND").with("question", json!(id))),
    }
}

fn check_label(value: Option<&Value>) -> R<String> {
    let label = match value {
        Some(Value::String(s)) => collapse_spaces(&nfc(s)),
        _ => String::new(),
    };
    if label.is_empty() {
        return Err(invalid("label", "libelle_invalide", None));
    }
    if label.chars().count() > 255 {
        return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(255)));
    }
    Ok(label)
}

fn check_audience(value: &Value) -> R<String> {
    match value.as_str() {
        Some(a) if QUESTION_AUDIENCES.contains(&a) => Ok(a.to_string()),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!("audience"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tables() -> Vec<TableNames> {
        let t = |id: &str, name: &str, fields: &[&str]| TableNames {
            id: id.into(),
            name: name.into(),
            fields: SYSTEM_COLUMNS.iter().chain(fields.iter()).map(|s| s.to_string()).collect(),
        };
        vec![t("t1", "commandes", &["montant", "client", "date"]), t("t2", "clients", &["nom"])]
    }

    fn reason(e: AppError) -> (Value, Value) {
        (e.details["field"].clone(), e.details["reason"].clone())
    }

    #[test]
    fn a_builder_query_is_resolved_against_the_base() {
        let q = checked_query(
            Some(&json!({
                "source": "commandes",
                "joins": [{ "alias": "c", "table": "clients", "kind": "bizarre", "left": { "field": "client" }, "right": "_id", "implicit": true }],
                "filters": [{ "column": { "join": "c", "field": "nom" }, "op": "is", "values": ["A", 2.0, true] }, { "expression": "  montant > 3 " }],
                "aggregations": [{ "fn": "sum", "column": { "field": "montant" }, "label": "  Total " }, { "fn": "count", "column": "ignored" }],
                "breakouts": [{ "field": "date", "unit": "month" }, { "field": "montant", "bin": 10.0 }],
                "sort": [{ "target": { "kind": "aggregation", "index": 1.0 }, "desc": true }],
                "limit": 5000.4
            })),
            &tables(),
            "query",
        )
        .unwrap();
        assert_eq!(q["source"], json!("t1"));
        assert_eq!(q["joins"][0], json!({ "alias": "c", "table": "t2", "kind": "left", "left": { "field": "client" }, "right": "_id", "implicit": true }));
        assert_eq!(q["filters"][0]["values"], json!(["A", 2, true]));
        assert_eq!(q["filters"][1], json!({ "expression": "montant > 3" }));
        assert_eq!(q["aggregations"], json!([{ "fn": "sum", "column": { "field": "montant" }, "label": "Total" }, { "fn": "count" }]));
        assert_eq!(q["breakouts"][1], json!({ "field": "montant", "bin": 10 }));
        assert_eq!(q["sort"][0]["target"]["index"], json!(1));
        assert_eq!(q["limit"], json!(2000));
    }

    #[test]
    fn a_builder_query_is_refused_where_it_goes_wrong() {
        let t = tables();
        let check = |q: Value| reason(checked_query(Some(&q), &t, "query").unwrap_err());
        assert_eq!(check(json!(3)), (json!("query"), json!("requete_invalide")));
        assert_eq!(check(json!({})), (json!("query.source"), json!("table_requise")));
        assert_eq!(check(json!({ "source": "x" })), (json!("query.source"), json!("table_inconnue")));
        assert_eq!(check(json!({ "source": "t1", "fields": [{ "field": "nope" }] })), (json!("query.fields[0]"), json!("champ_inconnu")));
        assert_eq!(check(json!({ "source": "t1", "fields": [{ "field": "Nope" }] })), (json!("query.fields[0]"), json!("colonne_invalide")));
        assert_eq!(check(json!({ "source": "t1", "fields": [{ "join": "z", "field": "nom" }] })), (json!("query.fields[0]"), json!("jointure_inconnue")));
        assert_eq!(check(json!({ "source": "t1", "filters": [{ "op": "like" }] })), (json!("query.filters[0].op"), json!("operateur_inconnu")));
        assert_eq!(check(json!({ "source": "t1", "filters": "x" })), (json!("query.filters"), json!("liste_attendue")));
        assert_eq!(check(json!({ "source": "t1", "breakouts": [{ "field": "date", "unit": "decade" }] })), (json!("query.breakouts[0].unit"), json!("unite_inconnue")));
        assert_eq!(check(json!({ "source": "t1", "sort": [{ "target": { "kind": "breakout", "index": 0 } }] })), (json!("query.sort[0].target.index"), json!("rang_invalide")));
        assert_eq!(check(json!({ "source": "t1", "joins": [{ "alias": "a" }, { "alias": "a" }] })), (json!("query.joins[0].table"), json!("table_requise")));
        let e = checked_query(Some(&json!({ "source": "t1", "joins": [1, 2, 3, 4, 5] })), &t, "query").unwrap_err();
        assert_eq!(e.details["detail"], json!(4));
    }

    #[test]
    fn a_sql_query_keeps_its_text_and_checks_its_variables() {
        let q = checked_query(
            Some(&json!({ "kind": "sql", "sql": " select 1 ", "variables": [{ "name": "d", "type": "filter", "column": " c.date ", "label": " " }, { "name": "n", "type": "bizarre", "default": 3 }] })),
            &tables(),
            "query",
        )
        .unwrap();
        assert_eq!(
            q,
            json!({ "kind": "sql", "sql": " select 1 ", "variables": [
                { "name": "d", "label": "d", "type": "filter", "column": "c.date", "column_kind": "text" },
                { "name": "n", "label": "n", "type": "text" }
            ] })
        );
        let e = checked_query(Some(&json!({ "kind": "sql", "sql": "x", "variables": [{ "name": "a" }, { "name": "a" }] })), &tables(), "q").unwrap_err();
        assert_eq!(reason(e), (json!("q.variables[1].name"), json!("nom_invalide")));
        let e = checked_query(Some(&json!({ "kind": "sql", "sql": "  " })), &tables(), "q").unwrap_err();
        assert_eq!(reason(e), (json!("q.sql"), json!("sql_requis")));
    }

    #[test]
    fn a_visualization_is_a_known_type_with_plain_settings() {
        assert_eq!(checked_visualization(&json!({ "type": "bar", "settings": { "a": 1.0 } }), "v").unwrap(), json!({ "type": "bar", "settings": { "a": 1 } }));
        assert_eq!(checked_visualization(&json!({ "type": "pie", "settings": null }), "v").unwrap(), json!({ "type": "pie" }));
        assert_eq!(reason(checked_visualization(&json!({ "type": "x" }), "v").unwrap_err()), (json!("v.type"), json!("visualisation_inconnue")));
        assert!(checked_visualization(&json!({}), "v").unwrap_err().details.get("detail").is_none());
        assert_eq!(reason(checked_visualization(&json!({ "type": "bar", "settings": [] }), "v").unwrap_err()), (json!("v.settings"), json!("reglages_invalides")));
        assert_eq!(reason(checked_visualization(&json!([]), "v").unwrap_err()), (json!("v"), json!("visualisation_invalide")));
    }

    #[test]
    fn labels_and_audiences() {
        assert_eq!(check_label(Some(&json!("  Ventes \n par  mois "))).unwrap(), "Ventes par mois");
        assert_eq!(reason(check_label(Some(&json!(" "))).unwrap_err()), (json!("label"), json!("libelle_invalide")));
        assert_eq!(check_label(Some(&json!("é".repeat(256)))).unwrap_err().code, "LABEL_TOO_LONG");
        assert!(check_audience(&json!("base")).is_ok());
        assert!(check_audience(&Value::Null).is_err());
        assert_eq!(text(Some(&json!("  abc ")), 2), "ab");
    }
}
