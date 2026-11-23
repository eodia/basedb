//! Questions run — chapter 18 §3 (`analytics/query.ts`, `analytics/sql.ts`, `analytics/time.ts`,
//! the relative dates of `@basedb/contracts` analytics): `POST /query/:base`.
//!
//! A builder question reads each table it names through ITS reader's plan, as a sub-query of
//! its own — readable columns, row predicate, fields computed at read time — and translates
//! its filters into the grammar of chapter 08 §4. A SQL question runs on the reader
//! (`basedb_catalog::sql_console::run_reader_sql`), its variables written in as literals.
//! The shape checks are the catalog's (`questions::checked_builder_query`, `check_sql_query`).

use basedb_base::db::{Exec, PoolName};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::SYSTEM_COLUMNS;
use basedb_base::rbac::rows::row_where;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::Shared;
use basedb_catalog::js::{js_length, js_to_number};
use basedb_catalog::naming::quote_literal;
use basedb_catalog::questions::{checked_builder_query, check_sql_query, invalid, TEMPORAL_EXTRACTIONS, TEMPORAL_UNITS};
use basedb_catalog::sql_console::{run_reader_sql, unique_key, SqlRequest};
use basedb_contracts::naming::qualify;
use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Timelike, Utc};
use indexmap::IndexMap;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Instant;

use crate::filter::{build_filter, qi, resolve_column, sortable_kind, Column, Columns};
use crate::js::{js_number, js_trim, number_json, number_string};
use crate::list::{build_plan, Plan};
use crate::pg::{col, refs, P};

type R<T> = Result<T, AppError>;

const ROWS: f64 = 2000.0;

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("motif"))
}

/// A JavaScript `RangeError` the kernel lets through: an incident.
fn range_error() -> AppError {
    AppError::internal("RangeError: Invalid time value")
}

// ── The reader's time (`analytics/time.ts`) ──────────────────────────────────

#[derive(Clone, Copy, Debug)]
enum Zone {
    Named(chrono_tz::Tz),
    /// `+0500`: minutes east of UTC.
    Fixed(i32),
}

/// `validTimeZone`: an IANA zone `Intl` knows (its case ignored, an offset admitted), `UTC`
/// when none is given. The name is kept as given: PostgreSQL reads it too.
fn valid_time_zone(value: Option<&str>) -> R<(String, Zone)> {
    let refuse = || AppError::new("REQUEST_INVALID").with("field", json!("timezone")).with("reason", json!("fuseau_inconnu"));
    let Some(value) = value.filter(|v| !v.is_empty()) else { return Ok(("UTC".into(), Zone::Named(chrono_tz::Tz::UTC))) };
    static NAME: OnceLock<Regex> = OnceLock::new();
    if js_length(value) > 64 || !re(&NAME, r"^[A-Za-z0-9_+\-/]+$").is_match(value) {
        return Err(refuse());
    }
    static OFFSET: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = re(&OFFSET, r"^([+-])([0-9]{2})([0-9]{2})?$").captures(value) {
        let hours: i32 = c[2].parse().unwrap_or(99);
        let minutes: i32 = c.get(3).map_or(0, |m| m.as_str().parse().unwrap_or(99));
        if hours > 23 || minutes > 59 {
            return Err(refuse());
        }
        let sign = if &c[1] == "-" { -1 } else { 1 };
        return Ok((value.to_string(), Zone::Fixed(sign * (hours * 60 + minutes))));
    }
    match chrono_tz::TZ_VARIANTS.iter().find(|tz| tz.name().eq_ignore_ascii_case(value) && tz.name() != "Factory") {
        Some(tz) => Ok((value.to_string(), Zone::Named(*tz))),
        None => Err(refuse()),
    }
}

/// `partsOf`: the wall clock of an instant in the zone.
fn parts_of(instant_ms: i64, zone: Zone) -> R<(i64, u32, u32, u32, u32, u32)> {
    let utc = Utc.timestamp_millis_opt(instant_ms).single().ok_or_else(range_error)?;
    let naive = match zone {
        Zone::Named(tz) => utc.with_timezone(&tz).naive_local(),
        Zone::Fixed(minutes) => utc.naive_utc() + chrono::Duration::minutes(minutes as i64),
    };
    Ok((naive.year() as i64, naive.month(), naive.day(), naive.hour(), naive.minute(), naive.second()))
}

/// `Date.UTC(y, m - 1, d, h, mi, s)`.
fn date_utc(y: i64, m: u32, d: u32, h: u32, mi: u32, s: u32) -> i64 {
    let days = utc_days(y, m as i64) + d as i64 - 1;
    ((days * 24 + h as i64) * 60 + mi as i64) * 60_000 + s as i64 * 1000
}

/// `Date.UTC(y, m - 1, 1)` in days: a year 0 to 99 is read as 1900 to 1999, as JavaScript does.
fn utc_days(y: i64, m: i64) -> i64 {
    days_from_civil(if (0..=99).contains(&y) { 1900 + y } else { y }, m, 1)
}

/// Days since 1970-01-01 of the first of a month (`month` may run past 12 or under 1).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let total = y * 12 + (m - 1);
    let (y, m) = (total.div_euclid(12), total.rem_euclid(12) + 1);
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `offsetAt`: minutes the zone is ahead of UTC at an instant.
fn offset_at(instant_ms: i64, zone: Zone) -> R<i64> {
    let (y, m, d, h, mi, s) = parts_of(instant_ms, zone)?;
    let as_utc = date_utc(y, m, d, h, mi, s);
    Ok(((as_utc - instant_ms.div_euclid(1000) * 1000) as f64 / 60_000.0).round() as i64)
}

/// `todayIn`.
fn today_in(zone: Zone, now: DateTime<Utc>) -> R<String> {
    let (y, m, d, ..) = parts_of(now.timestamp_millis(), zone)?;
    Ok(format!("{y}-{m:02}-{d:02}"))
}

/// `zonedMidnight`: the instant a day opens in the zone, ISO 8601 in UTC.
fn zoned_midnight(day: &str, zone: Zone) -> R<String> {
    let guess = js_day_ms(day).ok_or_else(range_error)?;
    let first = offset_at(guess, zone)?;
    let mut instant = guess - first * 60_000;
    let second = offset_at(instant, zone)?;
    if second != first {
        instant = guess - second * 60_000;
    }
    iso_of(instant)
}

/// `new Date(ms).toISOString()`.
fn iso_of(ms: i64) -> R<String> {
    if ms.abs() > 8_640_000_000_000_000 {
        return Err(range_error());
    }
    let days = ms.div_euclid(86_400_000);
    let rest = ms.rem_euclid(86_400_000);
    let day = js_day_of(days);
    Ok(format!(
        "{day}T{:02}:{:02}:{:02}.{:03}Z",
        rest / 3_600_000,
        rest / 60_000 % 60,
        rest / 1000 % 60,
        rest % 1000
    ))
}

// ── Relative dates (`@basedb/contracts` analytics) ──────────────────────────

/// `Date.parse(`${day}T00:00:00Z`)` for the days these functions make: `YYYY-MM-DD` (a day
/// up to 31 rolls over, as V8 reads it) or `±YYYYYY-MM-DD`.
fn js_day_ms(day: &str) -> Option<i64> {
    static DAY: OnceLock<Regex> = OnceLock::new();
    let c = re(&DAY, r"^([0-9]{4}|[+-][0-9]{6})-([0-9]{2})-([0-9]{2})$").captures(day)?;
    if &c[1] == "-000000" {
        return None;
    }
    let y: i64 = c[1].parse().ok()?;
    let m: i64 = c[2].parse().ok()?;
    let d: i64 = c[3].parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let ms = (days_from_civil(y, m, 1) + d - 1) * 86_400_000;
    (ms.abs() <= 8_640_000_000_000_000).then_some(ms)
}

/// `toDay`: `toISOString().slice(0, 10)` of a day count.
fn js_day_of(days: i64) -> String {
    let date = NaiveDate::from_ymd_opt(1970, 1, 1).expect("époque") + chrono::Duration::days(days);
    let y = date.year();
    let year = if (0..=9999).contains(&y) { format!("{y:04}") } else if y < 0 { format!("-{:06}", -y) } else { format!("+{y:06}") };
    let full = format!("{year}-{:02}-{:02}", date.month(), date.day());
    full.chars().take(10).collect()
}

fn days_of(day: &str) -> R<i64> {
    js_day_ms(day).map(|ms| ms / 86_400_000).ok_or_else(range_error)
}

/// `(y, month index, weekday)` of a day.
fn civil(day: &str) -> R<(i64, i64, i64)> {
    let days = days_of(day)?;
    let date = NaiveDate::from_ymd_opt(1970, 1, 1).expect("époque") + chrono::Duration::days(days);
    Ok((date.year() as i64, date.month0() as i64, date.weekday().num_days_from_sunday() as i64))
}

pub fn add_days(day: &str, days: i64) -> R<String> {
    Ok(js_day_of(days_of(day)? + days))
}

fn add_months(day: &str, months: i64) -> R<String> {
    let (y, m, _) = civil(day)?;
    Ok(js_day_of(utc_days(y, m + 1 + months)))
}

fn start_of_period(day: &str, period: &str, week_start: i64) -> R<String> {
    let (y, m, weekday) = civil(day)?;
    Ok(match period {
        "week" => add_days(day, -((weekday - week_start + 7) % 7))?,
        "month" => js_day_of(utc_days(y, m + 1)),
        "quarter" => js_day_of(utc_days(y, m - m % 3 + 1)),
        "year" => js_day_of(utc_days(y, 1)),
        _ => day.to_string(),
    })
}

fn shift(start: &str, period: &str, n: i64) -> R<String> {
    match period {
        "day" => add_days(start, n),
        "week" => add_days(start, 7 * n),
        "month" => add_months(start, n),
        "quarter" => add_months(start, 3 * n),
        _ => add_months(start, 12 * n),
    }
}

/// A span of days, bounds included; `None` for an open bound.
pub type DaySpan = (Option<String>, Option<String>);

/// `resolveDateExpression`.
pub fn resolve_date_expression(expression: &str, today: &str, week_start: i64) -> R<Option<DaySpan>> {
    let text = js_trim(expression).to_lowercase();
    let one = |d: String| Ok(Some((Some(d.clone()), Some(d))));
    match text.as_str() {
        "today" => return one(today.to_string()),
        "yesterday" => return one(add_days(today, -1)?),
        "tomorrow" => return one(add_days(today, 1)?),
        _ => {}
    }
    static THIS: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = re(&THIS, r"^this(day|week|month|quarter|year)$").captures(&text) {
        let start = start_of_period(today, &c[1], week_start)?;
        let end = add_days(&shift(&start, &c[1], 1)?, -1)?;
        return Ok(Some((Some(start), Some(end))));
    }
    static RELATIVE: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = re(&RELATIVE, r"^(past|last|next)([0-9]{0,4})(day|week|month|quarter|year)s?$").captures(&text) {
        let n: i64 = if c[2].is_empty() { 1 } else { c[2].parse().unwrap_or(0) };
        if n < 1 {
            return Ok(None);
        }
        let period = &c[3];
        let start = start_of_period(today, period, week_start)?;
        let span = match &c[1] {
            "past" => (shift(&start, period, -(n - 1))?, add_days(&shift(&start, period, 1)?, -1)?),
            "last" => (shift(&start, period, -n)?, add_days(&start, -1)?),
            _ => (shift(&start, period, 1)?, add_days(&shift(&start, period, n + 1)?, -1)?),
        };
        return Ok(Some((Some(span.0), Some(span.1))));
    }
    if text.contains('~') {
        let mut parts = text.split('~');
        let from = parts.next().unwrap_or("");
        let to = parts.next().unwrap_or("");
        let start = if from.is_empty() {
            None
        } else {
            match resolve_date_expression(from, today, week_start)? {
                Some((s, _)) => s,
                None => return Ok(None),
            }
        };
        let end = if to.is_empty() {
            None
        } else {
            match resolve_date_expression(to, today, week_start)? {
                Some((_, e)) => e,
                None => return Ok(None),
            }
        };
        if start.is_none() && end.is_none() {
            return Ok(None);
        }
        return Ok(Some((start, end)));
    }
    static DAY: OnceLock<Regex> = OnceLock::new();
    if re(&DAY, r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$").is_match(&text) {
        return Ok(js_day_ms(&text).map(|_| (Some(text.clone()), Some(text.clone()))));
    }
    static MONTH: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = re(&MONTH, r"^([0-9]{4})-([0-9]{2})$").captures(&text) {
        let start = format!("{}-{}-01", &c[1], &c[2]);
        let month: i64 = c[2].parse().unwrap_or(0);
        if !(1..=12).contains(&month) {
            return Ok(None);
        }
        let end = add_days(&add_months(&start, 1)?, -1)?;
        return Ok(Some((Some(start), Some(end))));
    }
    static QUARTER: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = re(&QUARTER, r"^([0-9]{4})-q([1-4])$").captures(&text) {
        let q: i64 = c[2].parse().unwrap_or(1);
        let start = format!("{}-{:02}-01", &c[1], (q - 1) * 3 + 1);
        let end = add_days(&add_months(&start, 3)?, -1)?;
        return Ok(Some((Some(start), Some(end))));
    }
    static YEAR: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = re(&YEAR, r"^([0-9]{4})$").captures(&text) {
        return Ok(Some((Some(format!("{}-01-01", &c[1])), Some(format!("{}-12-31", &c[1])))));
    }
    Ok(None)
}

#[derive(Clone)]
struct Clock {
    today: String,
    zone: Zone,
    week_start: i64,
}

fn is_temporal_unit(v: &str) -> bool {
    TEMPORAL_UNITS.contains(&v) || TEMPORAL_EXTRACTIONS.contains(&v)
}

// ── What is received ─────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq)]
struct ColRef {
    join: Option<String>,
    field: String,
}

impl ColRef {
    fn of(v: &Value) -> ColRef {
        ColRef {
            join: v.get("join").and_then(Value::as_str).filter(|j| !j.is_empty()).map(String::from),
            field: v.get("field").and_then(Value::as_str).unwrap_or_default().to_string(),
        }
    }
    /// `columnName`.
    fn name(&self) -> String {
        match &self.join {
            Some(j) => format!("{j}.{}", self.field),
            None => self.field.clone(),
        }
    }
    fn same(&self, other: &ColRef) -> bool {
        self.field == other.field && self.join == other.join
    }
}

enum FilterItem {
    Expression { expression: String, join: Option<String> },
    Column { column: ColRef, op: String, values: Vec<Value> },
}

struct Breakout {
    column: ColRef,
    unit: Option<String>,
    bin: Option<Value>,
}

/// One constraint of `checkConstraints`.
struct Constraint {
    variable: Option<String>,
    column: Option<ColRef>,
    kind: String,
    operator: Option<String>,
    value: Value,
}

fn is_record(v: &Value) -> bool {
    v.is_object()
}

/// `columnRef` of `analytics/query.ts`.
fn column_ref(value: Option<&Value>, at: &str) -> R<ColRef> {
    static NAME: OnceLock<Regex> = OnceLock::new();
    static ALIAS: OnceLock<Regex> = OnceLock::new();
    let Some(Value::Object(m)) = value else { return Err(invalid(at, "colonne_invalide", None)) };
    let field = match m.get("field") {
        Some(Value::String(f)) if re(&NAME, r"^[_a-z][a-z0-9_]{0,62}$").is_match(f) => f.clone(),
        _ => return Err(invalid(at, "colonne_invalide", None)),
    };
    match m.get("join") {
        None | Some(Value::Null) => Ok(ColRef { join: None, field }),
        Some(Value::String(j)) if j.is_empty() => Ok(ColRef { join: None, field }),
        Some(Value::String(j)) if re(&ALIAS, r"^[a-z][a-z0-9_]{0,30}$").is_match(j) => Ok(ColRef { join: Some(j.clone()), field }),
        Some(_) => Err(invalid(&format!("{at}.join"), "jointure_invalide", None)),
    }
}

/// `checkConstraints`.
fn check_constraints(raw: Option<&Value>) -> R<Vec<Constraint>> {
    let items = match raw {
        None | Some(Value::Null) => return Ok(Vec::new()),
        Some(Value::Array(items)) if items.len() > 64 => return Err(invalid("constraints", "trop_d_elements", Some(&json!(64)))),
        Some(Value::Array(items)) => items,
        Some(_) => return Err(invalid("constraints", "liste_attendue", None)),
    };
    let mut out = Vec::new();
    for (i, item) in items.iter().enumerate() {
        let at = format!("constraints[{i}]");
        let target = match item.get("target") {
            Some(t) if is_record(item) && is_record(t) => t,
            _ => return Err(invalid(&at, "filtre_invalide", None)),
        };
        let kind = match item.get("type") {
            Some(Value::String(t)) if ["date", "category", "text", "number", "temporal_unit"].contains(&t.as_str()) => t.clone(),
            other => return Err(invalid(&format!("{at}.type"), "type_inconnu", other)),
        };
        let (variable, column) = match target.get("variable") {
            Some(Value::String(v)) => (Some(v.clone()), None),
            _ => (None, Some(column_ref(target.get("column"), &format!("{at}.target.column"))?)),
        };
        let value = item.get("value").cloned().unwrap_or(Value::Null);
        let ok = match &value {
            Value::String(_) => true,
            Value::Array(values) => values.len() <= 200 && values.iter().all(|v| matches!(v, Value::String(_) | Value::Null | Value::Number(_))),
            _ => false,
        };
        if !ok {
            return Err(invalid(&format!("{at}.value"), "valeur_invalide", None));
        }
        let operator = item.get("operator").and_then(Value::as_str).filter(|o| ["eq", "between", "gte", "lte"].contains(o)).map(String::from);
        out.push(Constraint { variable, column, kind, operator, value });
    }
    Ok(out)
}

// ── What the reader may read ─────────────────────────────────────────────────

struct Scope {
    key: String,
    alias: String,
    table_id: String,
    table_label: String,
    plan: Plan,
    columns: Columns,
    labels: HashMap<String, String>,
    results: HashMap<String, String>,
}

const SYSTEM_LABELS: [(&str, &str); 5] =
    [("_id", "Identifiant"), ("_created_at", "Créé le"), ("_updated_at", "Modifié le"), ("_created_by", "Créé par"), ("_updated_by", "Modifié par")];

async fn scopes_of(st: &Shared, ctx: &RequestContext, base_id: &str, entries: Vec<(String, String)>) -> R<IndexMap<String, Scope>> {
    let entries = &entries;
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let names: Vec<&str> = entries.iter().map(|(_, t)| t.as_str()).collect();
        let tables: Vec<(String, String, String)> = tx
            .rows(
                "SELECT t.id::text, tn.name, t.label
                   FROM _basedb.table_def t
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                  WHERE t.base_id = $1::text::uuid AND t.is_live
                    AND (t.id::text = ANY($2::text[]) OR tn.name = ANY($2::text[]))",
                &refs(&[P::text(base_id), P::of(&json!(names))]),
            )
            .await?
            .iter()
            .map(|r| (r.get(0), r.get(1), r.get(2)))
            .collect();
        let ids: Vec<&str> = tables.iter().map(|t| t.0.as_str()).collect();
        let fields: Vec<(String, String, String, Option<String>)> = tx
            .rows(
                "SELECT f.table_id::text, n.name, f.label, fc.result_kind
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n ON n.id = f.name_id
                   LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
                  WHERE f.table_id::text = ANY($1::text[]) AND f.is_live",
                &refs(&[P::of(&json!(ids))]),
            )
            .await?
            .iter()
            .map(|r| (r.get(0), r.get(1), r.get(2), r.get(3)))
            .collect();
        let mut scopes = IndexMap::new();
        for (index, (key, table)) in entries.iter().enumerate() {
            let Some(found) = tables.iter().find(|t| &t.0 == table || &t.1 == table) else {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table)));
            };
            let plan = build_plan(&tx, ctx, &found.0).await?;
            let columns: Columns = plan.filterable.iter().map(|(n, c)| (n.clone(), Column { alias: None, ..c.clone() })).collect();
            let own: Vec<&(String, String, String, Option<String>)> = fields.iter().filter(|f| f.0 == found.0).collect();
            let mut labels: HashMap<String, String> = SYSTEM_LABELS.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
            for f in &own {
                labels.insert(f.1.clone(), f.2.clone());
            }
            let results = own.iter().filter_map(|f| f.3.clone().map(|k| (f.1.clone(), k))).collect();
            scopes.insert(
                key.clone(),
                Scope {
                    key: key.clone(),
                    alias: if index == 0 { "s".into() } else { format!("j{index}") },
                    table_id: found.0.clone(),
                    table_label: found.2.clone(),
                    plan,
                    columns,
                    labels,
                    results,
                },
            );
        }
        Ok(scopes)
    })
    .await
}

/// `subQuery`: a table's readable columns and row predicate, nothing else.
fn sub_query(plan: &Plan) -> R<String> {
    let projection = plan
        .columns
        .iter()
        .map(|c| Ok(format!("{}.{}", qi(if plan.computed.by_name(c).is_some() { "v" } else { "t" })?, qi(c)?)))
        .collect::<R<Vec<_>>>()?
        .join(", ");
    let relation = qualify(&plan.schema_name, &plan.table_name).map_err(|e| AppError::internal(e.0))?;
    Ok(format!(
        "(SELECT {projection}\n     FROM {relation} AS \"t\"{}\n    WHERE ( /*predicat_lignes:{}*/ {} ))",
        plan.computed.lateral_join("t")?,
        plan.table_name,
        row_where(&plan.decision.row_predicate, Some("t"))
    ))
}

struct Resolved {
    key: String,
    column: Column,
    sql: String,
    kind: String,
    name: String,
}

const ARRAY_KINDS: [&str; 3] = ["multi_select", "multi_link", "lookup"];
const NUMERIC_KINDS: [&str; 4] = ["number", "rollup", "count", "autonumber"];
const DATE_KINDS: [&str; 2] = ["date", "datetime"];
const DOCUMENT_KINDS: [&str; 3] = ["file", "image", "button"];
const EMPTY_TEXT: [&str; 4] = ["short_text", "select", "url", "email"];

fn resolve(scopes: &IndexMap<String, Scope>, r: &ColRef) -> R<Resolved> {
    let scope = scopes.get(r.join.as_deref().unwrap_or(""));
    let column = scope.and_then(|s| resolve_column(&r.field, &s.columns));
    let (Some(scope), Some(column)) = (scope, column) else {
        return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(r.name())));
    };
    let kind = if r.field == "_id" {
        "id".to_string()
    } else if r.field == "_created_by" || r.field == "_updated_by" {
        "user".to_string()
    } else if column.kind == "formula" {
        scope.results.get(&column.name).cloned().unwrap_or_else(|| "formula".into())
    } else {
        column.kind.clone()
    };
    Ok(Resolved { key: scope.key.clone(), sql: format!("{}.{}", qi(&scope.alias)?, qi(&column.name)?), column, kind, name: r.name() })
}

fn label_of(scopes: &IndexMap<String, Scope>, r: &Resolved) -> String {
    let scope = &scopes[&r.key];
    let field = scope.labels.get(&r.column.name).cloned().unwrap_or_else(|| r.column.name.clone());
    if scope.key.is_empty() {
        field
    } else {
        format!("{} → {field}", scope.table_label)
    }
}

fn source_of(scopes: &IndexMap<String, Scope>, r: &Resolved) -> Value {
    let scope = &scopes[&r.key];
    let mut m = Map::new();
    m.insert("table".into(), json!(scope.table_id));
    m.insert("field".into(), json!(r.column.name));
    if !scope.key.is_empty() {
        m.insert("join".into(), json!(scope.key));
    }
    Value::Object(m)
}

// ── Filters, in the grammar of chapter 08 §4 ─────────────────────────────────

/// `String(value)` of a filter value.
fn js_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => number_string(n.as_f64().unwrap_or(f64::NAN)),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".into(),
        other => other.to_string(),
    }
}

/// `literal`: quoted, `"` and `\` escaped; a boolean bare.
fn literal(v: &Value) -> String {
    match v {
        Value::Bool(b) => b.to_string(),
        other => format!("\"{}\"", js_string(other).replace('\\', "\\\\").replace('"', "\\\"")),
    }
}

fn literal_str(s: &str) -> String {
    literal(&Value::String(s.to_string()))
}

fn list(values: &[Value]) -> String {
    format!("[{}]", values.iter().map(literal).collect::<Vec<_>>().join(", "))
}

/// `filterExpression`.
fn filter_expression(name: &str, kind: &str, op: &str, values: &[Value], clock: &Clock) -> R<String> {
    let first = values.first();
    let need = |n: usize| -> R<()> {
        if values.len() < n || values.iter().any(|v| v.is_null() || v.as_str() == Some("")) {
            return Err(invalid("filters", "valeur_requise", Some(&json!({ "field": name, "op": op }))));
        }
        Ok(())
    };
    let array = ARRAY_KINDS.contains(&kind);
    let empty = if EMPTY_TEXT.contains(&kind) { format!("({name} is_null or {name} eq \"\")") } else { format!("{name} is_null") };
    let at = |day: &str| -> R<String> {
        if kind == "datetime" {
            zoned_midnight(day, clock.zone)
        } else {
            Ok(day.to_string())
        }
    };
    let day = |value: Option<&Value>| -> R<String> {
        let text = value.map(js_string).unwrap_or_default();
        match resolve_date_expression(&text, &clock.today, clock.week_start)? {
            Some((start, end)) => Ok(start.or(end).unwrap_or_default()),
            None => {
                let mut detail = Map::new();
                detail.insert("field".into(), json!(name));
                if let Some(v) = value {
                    detail.insert("value".into(), v.clone());
                }
                Err(invalid("filters", "date_invalide", Some(&Value::Object(detail))))
            }
        }
    };
    let first_value = || first.cloned().unwrap_or(Value::Null);
    Ok(match op {
        "empty" => empty,
        "not_empty" => format!("not {empty}"),
        "true" => format!("{name} eq true"),
        "false" => format!("{name} eq false"),
        "is" | "has_any" => {
            need(1)?;
            if array || op == "has_any" {
                format!("{name} has_any {}", list(values))
            } else if values.len() == 1 {
                format!("{name} eq {}", literal(&first_value()))
            } else {
                format!("{name} in {}", list(values))
            }
        }
        "is_not" | "has_none" => {
            need(1)?;
            if array || op == "has_none" {
                format!("(not {name} has_any {} or {name} is_null)", list(values))
            } else {
                format!("(not {name} in {} or {name} is_null)", list(values))
            }
        }
        "has_all" => {
            need(1)?;
            format!("{name} has_all {}", list(values))
        }
        "contains" | "starts_with" | "ends_with" => {
            need(1)?;
            format!("{name} {op} {}", literal_str(&js_string(&first_value())))
        }
        "not_contains" => {
            need(1)?;
            format!("(not {name} contains {} or {name} is_null)", literal_str(&js_string(&first_value())))
        }
        "eq" | "gt" | "gte" | "lt" | "lte" => {
            need(1)?;
            format!("{name} {op} {}", literal(&first_value()))
        }
        "ne" => {
            need(1)?;
            format!("({name} ne {} or {name} is_null)", literal(&first_value()))
        }
        "between" => {
            need(2)?;
            if DATE_KINDS.contains(&kind) {
                let start = day(values.first())?;
                let end = day(values.get(1))?;
                if kind == "date" {
                    format!("{name} between {}", list(&[json!(start), json!(end)]))
                } else {
                    format!("({name} gte {} and {name} lt {})", literal_str(&at(&start)?), literal_str(&at(&add_days(&end, 1)?)?))
                }
            } else {
                format!("{name} between {}", list(&values[..2]))
            }
        }
        "before" => {
            need(1)?;
            format!("{name} lt {}", literal_str(&at(&day(first)?)?))
        }
        "after" => {
            need(1)?;
            let span = resolve_date_expression(&js_string(&first_value()), &clock.today, clock.week_start)?;
            let Some(last) = span.and_then(|(s, e)| e.or(s)) else {
                return Err(invalid("filters", "date_invalide", Some(&json!({ "field": name }))));
            };
            if kind == "date" {
                format!("{name} gt {}", literal_str(&last))
            } else {
                format!("{name} gte {}", literal_str(&at(&add_days(&last, 1)?)?))
            }
        }
        "date" => {
            need(1)?;
            let Some((start, end)) = resolve_date_expression(&js_string(&first_value()), &clock.today, clock.week_start)? else {
                return Err(invalid("filters", "date_invalide", Some(&json!({ "field": name, "value": first_value() }))));
            };
            let mut parts = Vec::new();
            if kind == "date" {
                if let (Some(s), Some(e)) = (&start, &end) {
                    return Ok(format!("{name} between {}", list(&[json!(s), json!(e)])));
                }
                if let Some(s) = &start {
                    parts.push(format!("{name} gte {}", literal_str(s)));
                }
                if let Some(e) = &end {
                    parts.push(format!("{name} lte {}", literal_str(e)));
                }
            } else {
                if let Some(s) = &start {
                    parts.push(format!("{name} gte {}", literal_str(&at(s)?)));
                }
                if let Some(e) = &end {
                    parts.push(format!("{name} lt {}", literal_str(&at(&add_days(e, 1)?)?)));
                }
            }
            if parts.len() == 1 {
                parts.remove(0)
            } else {
                format!("({})", parts.join(" and "))
            }
        }
        _ => return Err(AppError::internal(format!("opérateur {op}"))),
    })
}

/// `constraintFilter`: a constraint on a column as one filter of the builder.
fn constraint_filter(c: &Constraint, column: &ColRef, kind: &str) -> Option<FilterItem> {
    let all: Vec<Value> = match &c.value {
        Value::Array(v) => v.clone(),
        other => vec![other.clone()],
    };
    let values: Vec<Value> = all.iter().filter(|v| !v.is_null() && v.as_str() != Some("")).cloned().collect();
    if values.is_empty() {
        return None;
    }
    let item = |op: &str, values: Vec<Value>| Some(FilterItem::Column { column: column.clone(), op: op.into(), values });
    let strings = || values.iter().map(|v| json!(js_string(v))).collect::<Vec<_>>();
    match c.kind.as_str() {
        "date" => item("date", vec![json!(js_string(&values[0]))]),
        "text" => {
            if kind == "select" || kind == "multi_select" {
                item("is", strings())
            } else {
                item("contains", vec![json!(js_string(&values[0]))])
            }
        }
        "category" => {
            if kind == "boolean" {
                let flags: std::collections::HashSet<String> = values.iter().map(js_string).collect();
                if flags.len() != 1 {
                    return None;
                }
                return item(if flags.contains("true") { "true" } else { "false" }, Vec::new());
            }
            if NUMERIC_KINDS.contains(&kind) {
                item("is", values.iter().map(number_or_nan).collect())
            } else {
                item("is", strings())
            }
        }
        "number" => {
            let low = all.first().filter(|v| v.is_number()).cloned();
            let high = all.get(1).filter(|v| v.is_number()).cloned();
            match c.operator.as_deref().unwrap_or("eq") {
                "eq" => low.and_then(|l| item("eq", vec![l])),
                "gte" => low.and_then(|l| item("gte", vec![l])),
                "lte" => high.or(low).and_then(|b| item("lte", vec![b])),
                _ => match (low, high) {
                    (Some(l), Some(h)) => item("between", vec![l, h]),
                    (Some(l), None) => item("gte", vec![l]),
                    (None, h) => h.and_then(|h| item("lte", vec![h])),
                },
            }
        }
        _ => None,
    }
}

/// `Number(v)` kept as a JSON value: NaN as the string the grammar will quote.
fn number_or_nan(v: &Value) -> Value {
    let f = match v {
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        other => js_to_number(&js_string(other)),
    };
    if f.is_finite() {
        number_json(f)
    } else {
        json!(number_string(f))
    }
}

// ── Running a builder question ───────────────────────────────────────────────

const AGGREGATION_LABELS: [(&str, &str); 10] = [
    ("count", "Nombre de lignes"),
    ("cum_count", "Nombre cumulé de lignes"),
    ("distinct", "Valeurs distinctes de"),
    ("sum", "Somme de"),
    ("cum_sum", "Somme cumulée de"),
    ("avg", "Moyenne de"),
    ("median", "Médiane de"),
    ("min", "Minimum de"),
    ("max", "Maximum de"),
    ("stddev", "Écart type de"),
];

const UNIT_LABELS: [(&str, &str); 13] = [
    ("minute", "minute"),
    ("hour", "heure"),
    ("day", "jour"),
    ("week", "semaine"),
    ("month", "mois"),
    ("quarter", "trimestre"),
    ("year", "année"),
    ("hour_of_day", "heure du jour"),
    ("day_of_week", "jour de la semaine"),
    ("day_of_month", "jour du mois"),
    ("week_of_year", "semaine de l’année"),
    ("month_of_year", "mois de l’année"),
    ("quarter_of_year", "trimestre de l’année"),
];

fn lookup(table: &[(&str, &'static str)], key: &str) -> &'static str {
    table.iter().find(|(k, _)| *k == key).map_or("", |(_, v)| v)
}

/// `niceWidth`: 1, 2, 2.5, 5 times a power of ten, for about `bins` bins.
pub fn nice_width(min: f64, max: f64, bins: f64) -> f64 {
    let span = max - min;
    if !span.is_finite() || span <= 0.0 {
        return 1.0;
    }
    let raw = span / bins;
    let power = 10f64.powf(raw.log10().floor());
    let step = [1.0, 2.0, 2.5, 5.0, 10.0].into_iter().find(|s| s * power >= raw).unwrap_or(10.0);
    step * power
}

/// `familyOf`: what two joined columns must share.
fn family_of(kind: &str, column: &Column) -> String {
    let element = if ARRAY_KINDS.contains(&column.kind.as_str()) {
        match column.kind.as_str() {
            "multi_select" => "select".to_string(),
            "multi_link" => "link".to_string(),
            _ => column.element_kind.clone().unwrap_or_else(|| "short_text".into()),
        }
    } else {
        kind.to_string()
    };
    if ["id", "link", "user"].contains(&element.as_str()) {
        return "uuid".into();
    }
    if ["short_text", "long_text", "select", "email", "url"].contains(&element.as_str()) {
        return "text".into();
    }
    if NUMERIC_KINDS.contains(&element.as_str()) {
        return "number".into();
    }
    element
}

/// `aggregateSql`.
fn aggregate_sql(fn_: &str, target: Option<&Resolved>, index: usize) -> R<String> {
    let at = format!("query.aggregations[{index}]");
    if fn_ == "count" || fn_ == "cum_count" {
        return Ok("count(*)".into());
    }
    let Some(target) = target else { return Err(invalid(&at, "colonne_requise", None)) };
    let impossible = || invalid(&at, "agregat_impossible", Some(&json!(target.name)));
    let k = target.column.kind.as_str();
    if DOCUMENT_KINDS.contains(&k) {
        return Err(impossible());
    }
    if fn_ == "distinct" {
        if k == "long_text" {
            return Err(impossible());
        }
        return Ok(format!("count(DISTINCT {})", target.sql));
    }
    if ARRAY_KINDS.contains(&k) {
        return Err(impossible());
    }
    let numeric = NUMERIC_KINDS.contains(&target.kind.as_str());
    if (fn_ == "min" || fn_ == "max") && (numeric || DATE_KINDS.contains(&target.kind.as_str())) {
        return Ok(format!("{fn_}({})", target.sql));
    }
    if !numeric {
        return Err(impossible());
    }
    Ok(match fn_ {
        "sum" | "cum_sum" => format!("sum({})", target.sql),
        "avg" => format!("avg({})", target.sql),
        "median" => format!("percentile_cont(0.5) WITHIN GROUP (ORDER BY {})", target.sql),
        "stddev" => format!("stddev_samp({})", target.sql),
        other => format!("{other}({})", target.sql),
    })
}

struct Dimension {
    sql: String,
    weekday: bool,
    column: Map<String, Value>,
}

struct Metric {
    sql: String,
    cumulative: bool,
    column: Map<String, Value>,
}

/// The rows of one statement on the data pool, outside a transaction, as the kernel reads them.
async fn run(st: &Shared, sql: &str, params: &[Value]) -> R<Vec<Vec<Value>>> {
    let conn = st.pools.get(PoolName::Data).await?;
    let ps: Vec<P> = params.iter().map(P::of).collect();
    Ok(conn.rows(sql, &refs(&ps)).await?.iter().map(|row| (0..row.len()).map(|i| col(row, i)).collect()).collect())
}

/// `readValue`: values PostgreSQL hands back as text, as the screen reads them.
fn read_value(raw: Value, kind: &str) -> Value {
    match raw {
        Value::String(s) if NUMERIC_KINDS.contains(&kind) => {
            let n = js_number(&Value::String(s.clone()));
            if n.is_null() {
                Value::String(s)
            } else {
                n
            }
        }
        other => other,
    }
}

async fn run_builder(st: &Shared, ctx: &RequestContext, base_id: &str, query: &Value, constraints: &[Constraint], time_zone: Option<&str>, week_start: i64) -> R<Value> {
    let started = Instant::now();
    let (zone_name, zone) = valid_time_zone(time_zone)?;
    let clock = Clock { today: today_in(zone, ctx.timestamp)?, zone, week_start };

    let list_of = |key: &str| query.get(key).and_then(Value::as_array).cloned().unwrap_or_default();
    let joins = list_of("joins");
    let mut entries = vec![(String::new(), query.get("source").and_then(Value::as_str).unwrap_or_default().to_string())];
    for j in &joins {
        entries.push((js_string(&j["alias"]), js_string(&j["table"])));
    }
    let scopes = scopes_of(st, ctx, base_id, entries).await?;

    let mut breakouts: Vec<Breakout> = list_of("breakouts")
        .iter()
        .map(|b| Breakout { column: ColRef::of(b), unit: b.get("unit").and_then(Value::as_str).map(String::from), bin: b.get("bin").cloned() })
        .collect();
    let mut filters: Vec<FilterItem> = list_of("filters")
        .iter()
        .map(|f| match f.get("expression").and_then(Value::as_str) {
            Some(e) => FilterItem::Expression { expression: e.to_string(), join: f.get("join").and_then(Value::as_str).map(String::from) },
            None => FilterItem::Column {
                column: ColRef::of(&f["column"]),
                op: js_string(&f["op"]),
                values: f.get("values").and_then(Value::as_array).cloned().unwrap_or_default(),
            },
        })
        .collect();
    for c in constraints {
        let Some(target) = &c.column else { continue };
        if c.kind == "temporal_unit" {
            let unit = match &c.value {
                Value::Array(v) => v.first().cloned().unwrap_or(Value::Null),
                other => other.clone(),
            };
            let Some(unit) = unit.as_str().filter(|u| is_temporal_unit(u)) else { continue };
            for b in breakouts.iter_mut().filter(|b| b.column.same(target)) {
                b.unit = Some(unit.to_string());
            }
            continue;
        }
        let resolved = resolve(&scopes, target)?;
        if let Some(f) = constraint_filter(c, target, &resolved.kind) {
            filters.push(f);
        }
    }

    let mut params: Vec<Value> = Vec::new();
    let source = &scopes[""];
    let mut from = vec![format!("{} AS \"s\"", sub_query(&source.plan)?)];
    for j in &joins {
        let alias = js_string(&j["alias"]);
        let scope = &scopes[&alias];
        let left = resolve(&scopes, &ColRef::of(&j["left"]))?;
        let right = resolve(&scopes, &ColRef { join: Some(alias.clone()), field: js_string(&j["right"]) })?;
        if family_of(&left.kind, &left.column) != family_of(&right.kind, &right.column) {
            return Err(invalid("query.joins", "jointure_incompatible", Some(&json!({ "left": left.name, "right": right.name }))));
        }
        let on = if ARRAY_KINDS.contains(&left.column.kind.as_str()) {
            format!("{} = ANY({})", right.sql, left.sql)
        } else if ARRAY_KINDS.contains(&right.column.kind.as_str()) {
            format!("{} = ANY({})", left.sql, right.sql)
        } else {
            format!("{} = {}", left.sql, right.sql)
        };
        let keyword = match j["kind"].as_str() {
            Some("inner") => "JOIN",
            Some("right") => "RIGHT JOIN",
            Some("full") => "FULL JOIN",
            _ => "LEFT JOIN",
        };
        from.push(format!("{keyword} {} AS {}\n    ON {on}", sub_query(&scope.plan)?, qi(&scope.alias)?));
    }

    let mut wheres = Vec::new();
    for f in &filters {
        let (scope, expression) = match f {
            FilterItem::Expression { expression, join } => (&scopes[join.as_deref().unwrap_or("")], expression.clone()),
            FilterItem::Column { column, op, values } => {
                let r = resolve(&scopes, column)?;
                (&scopes[&r.key], filter_expression(&r.column.name, &r.kind, op, values, &clock)?)
            }
        };
        let built = build_filter(&expression, &scope.columns, Some(&scope.alias), params.len() + 1, &scope.plan.links)?;
        params.extend(built.params);
        wheres.push(format!("( {} )", built.sql));
    }
    let from_sql = from.join("\n  ");
    let where_sql = if wheres.is_empty() { String::new() } else { format!("\n WHERE {}", wheres.join("\n   AND ")) };
    let where_params = params.clone();

    let aggregations = list_of("aggregations");
    let grouped = !aggregations.is_empty() || !breakouts.is_empty();
    let limit = query.get("limit").and_then(Value::as_f64).unwrap_or(ROWS).min(ROWS);
    let sort = list_of("sort");

    let sql;
    let mut columns: Vec<Map<String, Value>>;
    let mut record = None;
    if grouped {
        let mut taken: HashMap<String, usize> = HashMap::new();
        let mut unique = |name: String| {
            let n = taken.entry(name.clone()).or_insert(0);
            *n += 1;
            if *n == 1 {
                name
            } else {
                format!("{name}#{n}")
            }
        };
        let breakout_names: Vec<String> = breakouts.iter().map(|b| unique(b.column.name())).collect();
        let aggregation_names: Vec<String> = aggregations
            .iter()
            .map(|a| {
                let f = js_string(&a["fn"]);
                match a.get("column") {
                    Some(c) if f != "count" && f != "cum_count" => unique(format!("{f}:{}", ColRef::of(c).name())),
                    _ => unique(f),
                }
            })
            .collect();

        let mut laterals = Vec::new();
        let mut dimensions: Vec<Dimension> = Vec::new();
        for (i, b) in breakouts.iter().enumerate() {
            let r = resolve(&scopes, &b.column)?;
            if DOCUMENT_KINDS.contains(&r.column.kind.as_str()) {
                return Err(invalid(&format!("query.breakouts[{i}]"), "regroupement_impossible", Some(&json!(r.name))));
            }
            let mut expr = r.sql.clone();
            let mut kind = r.kind.clone();
            let mut unit = None;
            let mut bin = None;
            if ARRAY_KINDS.contains(&r.column.kind.as_str()) {
                let alias = format!("u{}", i + 1);
                laterals.push(format!("LEFT JOIN LATERAL unnest({}) AS {}(\"value\") ON TRUE", r.sql, qi(&alias)?));
                expr = format!("{}.\"value\"", qi(&alias)?);
                kind = match r.column.kind.as_str() {
                    "multi_select" => "select".into(),
                    "multi_link" => "link".into(),
                    _ => r.column.element_kind.clone().unwrap_or_else(|| "short_text".into()),
                };
            } else if DATE_KINDS.contains(&r.kind.as_str()) {
                let u = b.unit.clone().unwrap_or_else(|| "day".into());
                let local = if r.kind == "datetime" {
                    params.push(json!(zone_name));
                    format!("({} AT TIME ZONE ${}::text)", r.sql, params.len())
                } else {
                    format!("{}::timestamp", r.sql)
                };
                if TEMPORAL_UNITS.contains(&u.as_str()) {
                    let cut = if u == "week" && clock.week_start == 0 {
                        format!("(date_trunc('week', {local} + interval '1 day') - interval '1 day')")
                    } else {
                        format!("date_trunc('{u}', {local})")
                    };
                    let fine = u == "minute" || u == "hour";
                    expr = format!("to_char({cut}, '{}')", if fine { "YYYY-MM-DD\"T\"HH24:MI" } else { "YYYY-MM-DD" });
                    kind = if fine { "datetime".into() } else { "date".into() };
                } else {
                    let part = match u.as_str() {
                        "hour_of_day" => "hour",
                        "day_of_week" => "isodow",
                        "day_of_month" => "day",
                        "week_of_year" => "week",
                        "month_of_year" => "month",
                        _ => "quarter",
                    };
                    expr = format!("extract({part} from {local})::int");
                    kind = "number".into();
                }
                unit = Some(u);
            } else if NUMERIC_KINDS.contains(&r.kind.as_str()) && b.bin.is_some() {
                let width = match &b.bin {
                    Some(Value::String(_)) => {
                        let bounds = run(st, &format!("SELECT min({0}) AS \"low\", max({0}) AS \"high\"\n  FROM {from_sql}{where_sql};", r.sql), &where_params).await?;
                        let n = |v: Option<&Value>| match v {
                            None | Some(Value::Null) => 0.0,
                            Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
                            Some(other) => js_to_number(&js_string(other)),
                        };
                        let row = bounds.first();
                        nice_width(n(row.and_then(|r| r.first())), n(row.and_then(|r| r.get(1))), 10.0)
                    }
                    Some(v) => v.as_f64().unwrap_or(1.0),
                    None => 1.0,
                };
                params.push(number_json(width));
                let a = params.len();
                params.push(number_json(width));
                expr = format!("(floor({} / ${a}::numeric) * ${}::numeric)", r.sql, a + 1);
                kind = "number".into();
                bin = Some(width);
            }
            let label = match &unit {
                None => label_of(&scopes, &r),
                Some(u) => format!("{} : {}", label_of(&scopes, &r), lookup(&UNIT_LABELS, u)),
            };
            let mut column = Map::new();
            column.insert("name".into(), json!(breakout_names[i]));
            column.insert("label".into(), json!(label));
            column.insert("role".into(), json!("dimension"));
            column.insert("type".into(), json!(kind));
            if let Some(u) = &unit {
                column.insert("unit".into(), json!(u));
            }
            if let Some(w) = bin {
                column.insert("bin".into(), number_json(w));
            }
            column.insert("source".into(), source_of(&scopes, &r));
            dimensions.push(Dimension { sql: expr, weekday: unit.as_deref() == Some("day_of_week") && clock.week_start == 0, column });
        }

        let mut metrics: Vec<Metric> = Vec::new();
        for (i, a) in aggregations.iter().enumerate() {
            let f = js_string(&a["fn"]);
            let target = match a.get("column") {
                Some(c) => Some(resolve(&scopes, &ColRef::of(c))?),
                None => None,
            };
            let expression = aggregate_sql(&f, target.as_ref(), i)?;
            let label = match (a.get("label").and_then(Value::as_str), &target) {
                (Some(l), _) => l.to_string(),
                (None, None) => lookup(&AGGREGATION_LABELS, &f).to_string(),
                (None, Some(t)) => format!("{} {}", lookup(&AGGREGATION_LABELS, &f), label_of(&scopes, t)),
            };
            let kind = match &target {
                Some(t) if (f == "min" || f == "max") && DATE_KINDS.contains(&t.kind.as_str()) => t.kind.clone(),
                _ => "number".into(),
            };
            let mut column = Map::new();
            column.insert("name".into(), json!(aggregation_names[i]));
            column.insert("label".into(), json!(label));
            column.insert("role".into(), json!("metric"));
            column.insert("type".into(), json!(kind));
            if let Some(t) = &target {
                column.insert("source".into(), source_of(&scopes, t));
            }
            metrics.push(Metric { sql: expression, cumulative: f == "cum_count" || f == "cum_sum", column });
        }

        let inner = dimensions
            .iter()
            .enumerate()
            .map(|(i, d)| format!("{} AS \"d{i}\"", d.sql))
            .chain(metrics.iter().enumerate().map(|(i, m)| format!("{} AS \"m{i}\"", m.sql)))
            .collect::<Vec<_>>()
            .join(",\n       ");
        let group_by = if dimensions.is_empty() {
            String::new()
        } else {
            format!("\n GROUP BY {}", (1..=dimensions.len()).map(|i| i.to_string()).collect::<Vec<_>>().join(", "))
        };
        let partition: Vec<String> = (1..dimensions.len()).map(|i| format!("\"q\".\"d{i}\"")).collect();
        let outer = (0..dimensions.len())
            .map(|i| format!("\"q\".\"d{i}\""))
            .chain(metrics.iter().enumerate().map(|(i, m)| {
                if m.cumulative && !dimensions.is_empty() {
                    let p = if partition.is_empty() { String::new() } else { format!("PARTITION BY {} ", partition.join(", ")) };
                    format!("sum(\"q\".\"m{i}\") OVER ({p}ORDER BY \"q\".\"d0\" ROWS UNBOUNDED PRECEDING) AS \"m{i}\"")
                } else {
                    format!("\"q\".\"m{i}\"")
                }
            }))
            .collect::<Vec<_>>()
            .join(", ");
        let dimension_order = |i: usize, desc: bool| {
            let weekday = dimensions.get(i).is_some_and(|d| d.weekday);
            format!("{}{}", if weekday { format!("(\"q\".\"d{i}\" % 7)") } else { format!("\"q\".\"d{i}\"") }, if desc { " DESC" } else { "" })
        };
        let mut order = Vec::new();
        for term in &sort {
            let desc = term.get("desc") == Some(&Value::Bool(true));
            let target = &term["target"];
            let index = target.get("index").and_then(Value::as_f64).unwrap_or(0.0) as usize;
            match target["kind"].as_str() {
                Some("aggregation") => order.push(format!("\"q\".\"m{index}\"{}", if desc { " DESC" } else { "" })),
                Some("breakout") => order.push(dimension_order(index, desc)),
                _ => {
                    let column = ColRef::of(&target["column"]);
                    let Some(at) = breakouts.iter().position(|b| b.column.same(&column)) else {
                        return Err(invalid("query.sort", "tri_hors_groupes", Some(&json!(column.name()))));
                    };
                    order.push(dimension_order(at, desc));
                }
            }
        }
        if order.is_empty() {
            order.extend((0..dimensions.len()).map(|i| dimension_order(i, false)));
        }
        sql = format!(
            "SELECT {outer}\n  FROM (SELECT {inner}\n  FROM {from_sql}{}{where_sql}{group_by}) AS \"q\"{}\n LIMIT {};",
            if laterals.is_empty() { String::new() } else { format!("\n  {}", laterals.join("\n  ")) },
            if order.is_empty() { String::new() } else { format!("\n ORDER BY {}", order.join(", ")) },
            number_string(limit + 1.0)
        );
        columns = dimensions.into_iter().map(|d| d.column).chain(metrics.into_iter().map(|m| m.column)).collect();
    } else {
        let fields = list_of("fields");
        let refs_: Vec<ColRef> = if !fields.is_empty() {
            fields.iter().map(ColRef::of).collect()
        } else {
            scopes
                .values()
                .flat_map(|scope| {
                    scope.plan.columns.iter().filter(|c| !SYSTEM_COLUMNS.contains(&c.as_str())).map(|field| ColRef {
                        join: if scope.key.is_empty() { None } else { Some(scope.key.clone()) },
                        field: field.clone(),
                    })
                })
                .collect()
        };
        let mut selected = Vec::new();
        for r in &refs_ {
            selected.push(resolve(&scopes, r)?);
        }
        selected.push(resolve(&scopes, &ColRef { join: None, field: "_id".into() })?);
        let mut order = Vec::new();
        for term in &sort {
            let target = &term["target"];
            if target["kind"].as_str() != Some("column") {
                return Err(invalid("query.sort", "tri_sans_groupes", None));
            }
            let r = resolve(&scopes, &ColRef::of(&target["column"]))?;
            if !sortable_kind(&r.column.kind) {
                return Err(invalid("query.sort", "tri_impossible", Some(&json!(r.name))));
            }
            order.push(format!("{}{}", r.sql, if term.get("desc") == Some(&Value::Bool(true)) { " DESC" } else { "" }));
        }
        let id_sql = selected.last().map(|r| r.sql.clone()).unwrap_or_default();
        order.push(id_sql);
        sql = format!(
            "SELECT {}\n  FROM {from_sql}{where_sql}\n ORDER BY {}\n LIMIT {};",
            selected.iter().enumerate().map(|(i, r)| format!("{} AS \"c{i}\"", r.sql)).collect::<Vec<_>>().join(", "),
            order.join(", "),
            number_string(limit + 1.0)
        );
        let last = selected.len() - 1;
        columns = selected
            .iter()
            .enumerate()
            .map(|(i, r)| {
                let mut m = Map::new();
                m.insert("name".into(), json!(if i == last { "_row".to_string() } else { r.name.clone() }));
                m.insert("label".into(), json!(label_of(&scopes, r)));
                m.insert("role".into(), json!("field"));
                m.insert("type".into(), json!(r.kind));
                m.insert("source".into(), source_of(&scopes, r));
                if i == last {
                    m.insert("hidden".into(), json!(true));
                }
                m
            })
            .collect();
        record = Some(json!({ "table": source.table_id, "column": last }));
    }

    let raw = run(st, &sql, &params).await?;
    let truncated = raw.len() as f64 > limit;
    let rows: Vec<Vec<Value>> = raw
        .into_iter()
        .take(limit.max(0.0) as usize)
        .map(|row| {
            row.into_iter()
                .zip(columns.iter())
                .map(|(value, column)| {
                    let kind = column["type"].as_str().unwrap_or_default();
                    if column["role"] == "metric" && kind == "number" {
                        if let Value::String(_) = value {
                            return js_number(&value);
                        }
                    }
                    read_value(value, kind)
                })
                .collect()
        })
        .collect();

    with_link_labels(st, &scopes, &mut columns, &rows).await?;
    let mut out = Map::new();
    out.insert("columns".into(), Value::Array(columns.into_iter().map(Value::Object).collect()));
    out.insert("rows".into(), json!(rows));
    out.insert("truncated".into(), json!(truncated));
    out.insert("duration_ms".into(), json!(started.elapsed().as_millis() as u64));
    if let Some(r) = record {
        out.insert("record".into(), r);
    }
    Ok(Value::Object(out))
}

/// `withLinkLabels`: what a link column's identifiers read as, if the reader reads them.
async fn with_link_labels(st: &Shared, scopes: &IndexMap<String, Scope>, columns: &mut [Map<String, Value>], rows: &[Vec<Value>]) -> R<()> {
    for (index, column) in columns.iter_mut().enumerate() {
        let kind = column["type"].as_str().unwrap_or_default();
        if kind != "link" && kind != "multi_link" {
            continue;
        }
        let Some(source) = column.get("source") else { continue };
        let Some(scope) = scopes.get(source.get("join").and_then(Value::as_str).unwrap_or("")) else { continue };
        let Some(target) = scope.plan.links.get(source["field"].as_str().unwrap_or_default()) else { continue };
        let Some(display) = target.display_column.as_ref().filter(|_| target.readable) else { continue };
        let mut ids: Vec<String> = Vec::new();
        for row in rows {
            let value = &row[index];
            let items: Vec<&Value> = match value {
                Value::Array(v) => v.iter().collect(),
                other => vec![other],
            };
            for id in items.into_iter().filter_map(Value::as_str) {
                if !ids.iter().any(|i| i == id) {
                    ids.push(id.to_string());
                }
            }
        }
        if ids.is_empty() {
            continue;
        }
        let field = source["field"].as_str().unwrap_or_default().to_string();
        let sql = format!(
            "SELECT \"l\".\"_id\"::text AS id, \"l\".{}::text AS label\n           FROM {} AS \"l\"\n          WHERE \"l\".\"_id\" = ANY($1::uuid[])\n            AND ( /*predicat_lignes:{field}*/ {} )",
            qi(&display.name)?,
            target.relation,
            row_where(&target.row_predicate, Some("l"))
        );
        let found = run(st, &sql, &[json!(ids)]).await?;
        let mut labels = Map::new();
        for r in found {
            if let (Some(Value::String(id)), Some(Value::String(label))) = (r.first(), r.get(1)) {
                labels.insert(id.clone(), json!(label));
            }
        }
        column.insert("labels".into(), Value::Object(labels));
    }
    Ok(())
}

// ── SQL questions (`analytics/sql.ts`) ───────────────────────────────────────

struct Given {
    value: Value,
    /// The constraint's type; `None` for a default.
    kind: Option<String>,
    operator: Option<String>,
}

fn present(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::String(s) => !js_trim(s).is_empty(),
        Value::Array(v) => v.iter().any(|x| !x.is_null() && x.as_str() != Some("")),
        _ => true,
    }
}

fn scalars(value: &Value) -> Vec<Value> {
    let all = match value {
        Value::Array(v) => v.clone(),
        other => vec![other.clone()],
    };
    all.into_iter().filter(|v| !v.is_null() && v.as_str() != Some("")).collect()
}

/// `String(x)` as a JavaScript object prints.
fn sql_string(v: &Value) -> String {
    match v {
        Value::Object(_) => "[object Object]".into(),
        Value::Array(items) => items.iter().map(|i| if i.is_null() { String::new() } else { sql_string(i) }).collect::<Vec<_>>().join(","),
        other => js_string(other),
    }
}

fn number_literal(value: Option<&Value>, name: &str) -> R<String> {
    let n = match value {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(v) => js_to_number(&sql_string(v).replacen(',', ".", 1)),
        None => f64::NAN,
    };
    if !n.is_finite() {
        return Err(invalid("variables", "nombre_invalide", Some(&json!(name))));
    }
    Ok(number_string(n))
}

fn span(value: &Value, clock: &Clock, name: &str) -> R<DaySpan> {
    let text = scalars(value).first().map(sql_string).unwrap_or_default();
    resolve_date_expression(&text, &clock.today, clock.week_start)?.ok_or_else(|| invalid("variables", "date_invalide", Some(&json!(name))))
}

fn condition(variable: &Value, given: &Given, clock: &Clock, name: &str) -> R<String> {
    let column = format!("({})", variable["column"].as_str().unwrap_or_default());
    let kind = variable.get("column_kind").and_then(Value::as_str).unwrap_or("text");
    if kind == "date" || kind == "datetime" {
        let (start, end) = span(&given.value, clock, name)?;
        let mut parts = Vec::new();
        if kind == "date" {
            if let Some(s) = start {
                parts.push(format!("{column} >= {}", quote_literal(&s)));
            }
            if let Some(e) = end {
                parts.push(format!("{column} <= {}", quote_literal(&e)));
            }
        } else {
            if let Some(s) = start {
                parts.push(format!("{column} >= {}", quote_literal(&zoned_midnight(&s, clock.zone)?)));
            }
            if let Some(e) = end {
                parts.push(format!("{column} < {}", quote_literal(&zoned_midnight(&add_days(&e, 1)?, clock.zone)?)));
            }
        }
        return Ok(format!("({})", parts.join(" AND ")));
    }
    if kind == "number" {
        let bounds = match &given.value {
            Value::Array(v) => v.clone(),
            other => vec![other.clone()],
        };
        let bound = |i: usize| bounds.get(i).filter(|v| !v.is_null() && v.as_str() != Some("")).cloned();
        let (low, high) = (bound(0), bound(1));
        let op = given.operator.clone().unwrap_or_else(|| if high.is_none() { "eq".into() } else { "between".into() });
        let lit = |v: Option<&Value>| number_literal(Some(v.unwrap_or(&Value::Null)), name);
        if op == "between" {
            if let (Some(l), Some(h)) = (&low, &high) {
                return Ok(format!("({column} BETWEEN {} AND {})", lit(Some(l))?, lit(Some(h))?));
            }
        }
        if op == "lte" || (op == "between" && low.is_none() && high.is_some()) {
            return Ok(format!("({column} <= {})", lit(high.as_ref().or(low.as_ref()))?));
        }
        if op == "gte" || op == "between" {
            return Ok(format!("({column} >= {})", lit(low.as_ref())?));
        }
        return Ok(format!("({column} = {})", lit(low.as_ref())?));
    }
    let values: Vec<String> = scalars(&given.value).iter().map(sql_string).collect();
    if given.kind.as_deref() == Some("text") {
        let first = values.first().cloned().unwrap_or_default();
        let mut escaped = String::new();
        for ch in first.chars() {
            if matches!(ch, '\\' | '%' | '_') {
                escaped.push('\\');
            }
            escaped.push(ch);
        }
        return Ok(format!("({column}::text ILIKE {} ESCAPE '\\')", quote_literal(&format!("%{escaped}%"))));
    }
    Ok(format!("({column}::text IN ({}))", values.iter().map(|v| quote_literal(v)).collect::<Vec<_>>().join(", ")))
}

fn sql_literal(variable: &Value, given: &Given, clock: &Clock, name: &str) -> R<String> {
    match variable["type"].as_str().unwrap_or("text") {
        "filter" => condition(variable, given, clock, name),
        "number" => number_literal(scalars(&given.value).first(), name),
        "date" => {
            let (start, end) = span(&given.value, clock, name)?;
            Ok(quote_literal(&start.or(end).unwrap_or_default()))
        }
        _ => Ok(scalars(&given.value).iter().map(|v| quote_literal(&sql_string(v))).collect::<Vec<_>>().join(", ")),
    }
}

fn variable_names(sql: &str) -> Vec<String> {
    static VARIABLE: OnceLock<Regex> = OnceLock::new();
    let mut names: Vec<String> = Vec::new();
    for c in re(&VARIABLE, r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}").captures_iter(sql) {
        if !names.iter().any(|n| n == &c[1]) {
            names.push(c[1].to_string());
        }
    }
    names
}

/// `renderSql`: the statement with its variables written in.
fn render_sql(query: &Value, values: &HashMap<String, Given>, clock: &Clock) -> R<String> {
    let text = query["sql"].as_str().unwrap_or_default();
    let mut variables: IndexMap<String, Value> = IndexMap::new();
    for v in query.get("variables").and_then(Value::as_array).into_iter().flatten() {
        variables.insert(js_string(&v["name"]), v.clone());
    }
    for name in variable_names(text) {
        variables.entry(name.clone()).or_insert_with(|| json!({ "name": name, "label": name, "type": "text" }));
    }
    let given = |name: &str| -> Option<Given> {
        if let Some(g) = values.get(name).filter(|g| present(&g.value)) {
            return Some(Given { value: g.value.clone(), kind: g.kind.clone(), operator: g.operator.clone() });
        }
        let fallback = variables.get(name).and_then(|v| v.get("default")).filter(|d| present(d))?;
        Some(Given { value: fallback.clone(), kind: None, operator: None })
    };
    static OPTIONAL: OnceLock<Regex> = OnceLock::new();
    let optional = re(&OPTIONAL, r"\[\[([\s\S]*?)\]\]").replace_all(text, |c: &regex::Captures| {
        if variable_names(&c[1]).iter().all(|n| given(n).is_some()) {
            c[1].to_string()
        } else {
            String::new()
        }
    });
    static VARIABLE: OnceLock<Regex> = OnceLock::new();
    let mut out = String::new();
    let mut last = 0;
    for c in re(&VARIABLE, r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}").captures_iter(&optional) {
        let whole = c.get(0).expect("motif");
        out.push_str(&optional[last..whole.start()]);
        last = whole.end();
        let name = &c[1];
        let variable = variables.get(name).cloned().unwrap_or(Value::Null);
        match given(name) {
            None => {
                if variable.get("required") == Some(&Value::Bool(true)) {
                    return Err(invalid("variables", "variable_requise", Some(&json!(name))));
                }
                out.push_str(if variable["type"] == "filter" { "TRUE" } else { "NULL" });
            }
            Some(g) => out.push_str(&sql_literal(&variable, &g, clock, name)?),
        }
    }
    out.push_str(&optional[last..]);
    Ok(out)
}

/// `sqlColumnType`.
fn sql_column_type(data_type: &str) -> &'static str {
    static NUMERIC: OnceLock<Regex> = OnceLock::new();
    if re(&NUMERIC, r"^(smallint|integer|bigint|numeric|real|double precision|money|int\d|float\d|decimal)").is_match(data_type) {
        "number"
    } else if data_type == "date" {
        "date"
    } else if data_type.starts_with("timestamp") {
        "datetime"
    } else if data_type == "boolean" {
        "boolean"
    } else if data_type == "json" || data_type == "jsonb" {
        "json"
    } else {
        "text"
    }
}

async fn run_sql_question(st: &Shared, ctx: &RequestContext, base_id: &str, query: &Value, constraints: &[Constraint], time_zone: Option<&str>, week_start: i64) -> R<Value> {
    let (_, zone) = valid_time_zone(time_zone)?;
    let clock = Clock { today: today_in(zone, ctx.timestamp)?, zone, week_start };
    let mut values: HashMap<String, Given> = HashMap::new();
    for c in constraints {
        let Some(v) = &c.variable else { continue };
        if values.contains_key(v) {
            continue;
        }
        values.insert(v.clone(), Given { value: c.value.clone(), kind: Some(c.kind.clone()), operator: c.operator.clone() });
    }
    let sql = render_sql(query, &values, &clock)?;
    let result = run_reader_sql(st, ctx, &SqlRequest { base_id: base_id.to_string(), sql, limit: Some(ROWS), read_only: true }).await?;
    let mut probe = Map::new();
    let keys: Vec<String> = result
        .columns
        .iter()
        .enumerate()
        .map(|(i, (name, _))| {
            let key = unique_key(&probe, name, i);
            probe.insert(key.clone(), Value::Bool(true));
            key
        })
        .collect();
    let columns: Vec<(String, &'static str)> = result.columns.iter().map(|(name, data_type)| (name.clone(), sql_column_type(data_type))).collect();
    let rows: Vec<Vec<Value>> = result
        .rows
        .iter()
        .map(|row| {
            columns
                .iter()
                .enumerate()
                .map(|(i, (_, kind))| match row.get(&keys[i]) {
                    None | Some(Value::Null) => Value::Null,
                    Some(Value::String(s)) if *kind == "number" => {
                        let n = js_number(&json!(s));
                        if n.is_null() {
                            json!(s)
                        } else {
                            n
                        }
                    }
                    Some(v) => v.clone(),
                })
                .collect()
        })
        .collect();
    Ok(json!({
        "columns": columns.iter().map(|(name, kind)| json!({ "name": name, "label": name, "role": if *kind == "number" { "metric" } else { "dimension" }, "type": kind })).collect::<Vec<_>>(),
        "rows": rows,
        "truncated": result.truncated,
        "duration_ms": result.duration_ms as u64,
    }))
}

/// `runQuestion`: a saved question by `question`, or one given whole in `query`.
#[allow(clippy::too_many_arguments)]
pub async fn run_question(
    st: &Shared,
    ctx: &RequestContext,
    base_id: &str,
    question: Option<&str>,
    query: Option<&Value>,
    constraints: Option<&Value>,
    time_zone: Option<&str>,
    week_start: i64,
) -> R<Value> {
    let query = match question {
        Some(id) => basedb_catalog::questions::get_question(&st.pools, ctx, base_id, id).await?.query,
        None => query.cloned().unwrap_or(Value::Null),
    };
    let kind = if query.is_object() || query.is_array() { query.get("kind").cloned() } else { None };
    let constraints = check_constraints(constraints)?;
    if kind.as_ref().and_then(Value::as_str) == Some("sql") {
        let checked = check_sql_query(&query, "query")?;
        return run_sql_question(st, ctx, base_id, &checked, &constraints, time_zone, week_start).await;
    }
    let checked = checked_builder_query(&query, "query")?;
    run_builder(st, ctx, base_id, &checked, &constraints, time_zone, week_start).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn span(e: &str) -> Option<(String, String)> {
        resolve_date_expression(e, "2026-05-14", 1).unwrap().map(|(s, e)| (s.unwrap_or_default(), e.unwrap_or_default()))
    }

    #[test]
    fn relative_dates_read_as_the_contracts_do() {
        assert_eq!(span("today"), Some(("2026-05-14".into(), "2026-05-14".into())));
        assert_eq!(span(" ThisWeek "), Some(("2026-05-11".into(), "2026-05-17".into())));
        assert_eq!(span("past7days"), Some(("2026-05-08".into(), "2026-05-14".into())));
        assert_eq!(span("lastmonth"), Some(("2026-04-01".into(), "2026-04-30".into())));
        assert_eq!(span("next2quarters"), Some(("2026-07-01".into(), "2026-12-31".into())));
        assert_eq!(span("2026-q1"), Some(("2026-01-01".into(), "2026-03-31".into())));
        assert_eq!(span("2026-02"), Some(("2026-02-01".into(), "2026-02-28".into())));
        assert_eq!(span("2026-13"), None);
        assert_eq!(span("past0days"), None);
        assert_eq!(span("2026-01-01~"), Some(("2026-01-01".into(), String::new())));
        assert_eq!(span("~"), None);
        assert_eq!(span("2026-13-45~"), None);
        // V8 rolls a day up to 31 over: the text stays, the arithmetic moves on.
        assert_eq!(span("2026-02-30"), Some(("2026-02-30".into(), "2026-02-30".into())));
        assert_eq!(add_days("2026-02-30", 1).unwrap(), "2026-03-03");
        assert_eq!(span("2026-02-32"), None);
        assert_eq!(resolve_date_expression("thisweek", "2026-05-14", 0).unwrap().unwrap().0.unwrap(), "2026-05-10");
    }

    #[test]
    fn midnight_is_the_zones() {
        let paris = valid_time_zone(Some("europe/paris")).unwrap().1;
        assert_eq!(zoned_midnight("2026-03-29", paris).unwrap(), "2026-03-28T23:00:00.000Z");
        assert_eq!(zoned_midnight("2026-03-30", paris).unwrap(), "2026-03-29T22:00:00.000Z");
        assert_eq!(zoned_midnight("2026-01-01", valid_time_zone(Some("+0530")).unwrap().1).unwrap(), "2025-12-31T18:30:00.000Z");
        assert!(valid_time_zone(Some("Mars/Olympus")).is_err());
        assert!(valid_time_zone(Some("UTC+1")).is_err());
        assert_eq!(valid_time_zone(None).unwrap().0, "UTC");
    }

    #[test]
    fn widths_are_round() {
        assert_eq!(nice_width(0.0, 100.0, 10.0), 10.0);
        assert_eq!(nice_width(0.0, 23.0, 10.0), 2.5);
        assert_eq!(nice_width(3.0, 3.0, 10.0), 1.0);
        assert_eq!(nice_width(0.0, 0.7, 10.0), 0.1);
    }

    #[test]
    fn variables_are_written_in() {
        let clock = Clock { today: "2026-05-14".into(), zone: Zone::Named(chrono_tz::Tz::UTC), week_start: 1 };
        let query = json!({ "sql": "SELECT 1 WHERE [[x = {{ n }} AND]] {{f}} AND y IN ({{t}})", "variables": [
            { "name": "n", "label": "n", "type": "number" },
            { "name": "f", "label": "f", "type": "filter", "column": "jour", "column_kind": "date" },
        ] });
        let mut values = HashMap::new();
        values.insert("f".to_string(), Given { value: json!("2026-03"), kind: Some("date".into()), operator: None });
        values.insert("t".to_string(), Given { value: json!(["a'b", "c"]), kind: Some("category".into()), operator: None });
        assert_eq!(render_sql(&query, &values, &clock).unwrap(), "SELECT 1 WHERE  ((jour) >= '2026-03-01' AND (jour) <= '2026-03-31') AND y IN ('a''b', 'c')");
    }
}
