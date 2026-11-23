//! Base templates — the contracts' `checkTemplate` and `summarizeTemplate`
//! (`packages/contracts/src/templates.ts`), and the helpers the localizer and the builder
//! share with them (`labelKey`, `optionValue`, `citedLabels`, `translateFilter`,
//! `resolveTemplateDate`, `VIEW_FIELD_KEYS`).
//!
//! A checked template is a JSON object built in the key order Node builds it, so that the
//! answers and the stored `body` read the same. [`check_template`] is the strict mode;
//! [`check_template_repair`] the `repair` mode the AI draft (`basedb-ai`) reads a proposal with.

use crate::description::js_trim;
use crate::js::js_number_string;
use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, TimeZone, Utc};
use indexmap::IndexMap;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;
use unicode_normalization::UnicodeNormalization;

pub type Raw = Map<String, Value>;

pub const TEMPLATE_FORMAT: i64 = 2;
const L_BYTES: usize = 1_000_000;
const L_TABLES: usize = 30;
const L_FIELDS: usize = 100;
const L_OPTIONS: usize = 50;
const L_ROWS_PER_TABLE: usize = 200;
const L_ROWS: usize = 2000;
const L_VIEWS: usize = 20;
const L_AUTOMATIONS: usize = 20;
const L_ACTIONS: usize = 10;
const L_LABEL: usize = 80;
const L_SUMMARY: usize = 300;
const L_DESCRIPTION: usize = 2000;
const L_TEXT: usize = 10_000;
const L_PROMPT: usize = 8000;
const L_TAGS: usize = 8;

const FIELD_KINDS: [&str; 17] = [
    "short_text", "long_text", "number", "boolean", "date", "datetime", "select", "multi_select", "url", "email", "user", "autonumber", "formula", "lookup", "rollup",
    "count", "button",
];
const DISPLAY_KINDS: [&str; 7] = ["short_text", "long_text", "number", "date", "datetime", "email", "url"];
pub const COMPUTED_KINDS: [&str; 6] = ["autonumber", "formula", "lookup", "rollup", "count", "button"];
const AI_KINDS: [&str; 7] = ["short_text", "long_text", "url", "number", "select", "boolean", "date"];
const FORM_KINDS: [&str; 10] = ["short_text", "long_text", "url", "email", "number", "boolean", "date", "datetime", "select", "multi_select"];
const VIEW_KINDS: [&str; 7] = ["grid", "kanban", "calendar", "timeline", "gallery", "list", "form"];
const DATES: [&str; 2] = ["date", "datetime"];
const GROUPABLE: [&str; 10] = ["short_text", "select", "boolean", "link", "date", "number", "url", "formula", "email", "user"];
const NUMBER_FORMATS: [&str; 6] = ["decimal", "integer", "percent", "currency", "duration", "rating"];
const TEXT_FORMATS: [&str; 3] = ["plain", "phone", "barcode"];
const AGGREGATES: [&str; 5] = ["count", "sum", "avg", "min", "max"];
const PALETTE: [&str; 8] = ["#94a3b8", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

static KEY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-z0-9]+(-[a-z0-9]+)*$").unwrap());
static TABLE_KEY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-z0-9]+([_-][a-z0-9]+)*$").unwrap());
static ROW_KEY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_-]{1,64}$").unwrap());
static COLOR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^#[0-9a-fA-F]{6}$").unwrap());
static ICON: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-z0-9]+(-[a-z0-9]+)*$").unwrap());
static MARKS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{M}").unwrap());
static SPACES: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+").unwrap());
static NON_ALNUM: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^a-z0-9]+").unwrap());
static CITED: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{\s*([^{}]+?)\s*\}\}").unwrap());
static EMAIL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[^\s@]+@[^\s@]+$").unwrap());
static HTTP: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^https?://").unwrap());
static BUTTON_URL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(https://|mailto:)").unwrap());
static CURRENCY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[A-Z]{3}$").unwrap());
static REPAIR_NUMBER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^-?[0-9]+([.,][0-9]+)?$").unwrap());

/// A JavaScript number as JSON: an integral one without its `.0`.
fn number_value(f: f64) -> Value {
    if f.fract() == 0.0 && f.abs() < 9.007_199_254_740_992e15 {
        if f == 0.0 {
            return json!(0);
        }
        return json!(f as i64);
    }
    json!(f)
}
static AT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{2}:\d{2}$").unwrap());
static RELATIVE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(today|([+-])(\d{1,4})([dwmy]))(?:\s+(\d{1,2}):(\d{2}))?$").unwrap());
static ABSOLUTE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$").unwrap());

// ── Small JavaScript-shaped helpers ──────────────────────────────────────────────────

/// `string.length`: UTF-16 code units.
pub fn u16len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `string.slice(0, n)` in UTF-16 code units (a pair is never split).
pub fn u16slice(s: &str, n: usize) -> String {
    let mut count = 0;
    let mut out = String::new();
    for c in s.chars() {
        count += c.len_utf16();
        if count > n {
            break;
        }
        out.push(c);
    }
    out
}

/// `String(value)`; `None` is `undefined`.
pub fn js_string(v: Option<&Value>) -> String {
    match v {
        None => "undefined".into(),
        Some(Value::Null) => "null".into(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => js_number_string(n.as_f64().unwrap_or(0.0)),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(a)) => a.iter().map(|x| if x.is_null() { String::new() } else { js_string(Some(x)) }).collect::<Vec<_>>().join(","),
        Some(Value::Object(_)) => "[object Object]".into(),
    }
}

fn record(v: Option<&Value>) -> Option<&Raw> {
    v.and_then(Value::as_object)
}

fn has(list: &[&str], s: &str) -> bool {
    list.contains(&s)
}

/// `labelKey`: case, accents and runs of spaces do not count.
pub fn label_key(label: &str) -> String {
    let nfd: String = label.nfd().collect();
    let bare = MARKS.replace_all(&nfd, "").to_lowercase();
    js_trim(&SPACES.replace_all(&bare, " ")).to_string()
}

/// `optionValue`: the value a choice stores, derived from its label.
pub fn option_value(label: &str) -> String {
    let nfd: String = label.nfd().collect();
    let bare = MARKS.replace_all(&nfd, "").to_lowercase();
    let v = NON_ALNUM.replace_all(&bare, "_");
    let v: String = v.trim_matches('_').chars().take(60).collect();
    if v.is_empty() {
        "choix".into()
    } else {
        v
    }
}

/// The index just past a string literal opening at `start`, escapes included.
fn string_end(text: &[char], start: usize) -> usize {
    let mut j = start + 1;
    while j < text.len() {
        if text[j] == '\\' {
            j += 2;
            continue;
        }
        if text[j] == '"' {
            return j + 1;
        }
        j += 1;
    }
    text.len()
}

/// A `[label]` opening at `i`: the label (`]]` read as `]`) and the index of its `]`.
fn bracket(text: &[char], i: usize) -> (String, usize) {
    let mut j = i + 1;
    let mut label = String::new();
    while j < text.len() {
        if text[j] == ']' {
            if text.get(j + 1) == Some(&']') {
                label.push(']');
                j += 2;
                continue;
            }
            break;
        }
        label.push(text[j]);
        j += 1;
    }
    (label, j)
}

/// `citedLabels`: the labels an expression cites `[Libellé]`.
pub fn cited_labels(expression: &str) -> Vec<String> {
    let t: Vec<char> = expression.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < t.len() {
        if t[i] == '"' {
            i = string_end(&t, i);
            continue;
        }
        if t[i] == '[' {
            let (label, j) = bracket(&t, i);
            out.push(label);
            i = j + 1;
            continue;
        }
        i += 1;
    }
    out
}

/// `citedInText`: the `{{Libellé}}` of a message or a prompt, `{{_…}}` aside.
pub fn cited_in_text(text: &str) -> Vec<String> {
    CITED.captures_iter(text).map(|c| c[1].to_string()).filter(|l| !l.starts_with('_')).collect()
}

/// `{{Libellé}}` rewritten by `f` (`None` keeps the whole); `{{_…}}` kept.
pub fn replace_cited(text: &str, f: impl Fn(&str) -> Option<String>) -> String {
    CITED
        .replace_all(text, |c: &regex::Captures| {
            let label = &c[1];
            if label.starts_with('_') {
                return c[0].to_string();
            }
            f(label).unwrap_or_else(|| c[0].to_string())
        })
        .into_owned()
}

/// A field as `translateFilter` resolves it.
pub struct Resolved {
    pub name: String,
    pub options: Option<Vec<Value>>,
}

/// `\\(.)` → `$1`.
fn unescape(s: &str) -> String {
    let mut out = String::new();
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\\' {
            if let Some(n) = it.next() {
                if n == '\n' || n == '\r' || n == '\u{2028}' || n == '\u{2029}' {
                    out.push('\\');
                }
                out.push(n);
                continue;
            }
        }
        out.push(c);
    }
    out
}

/// `translateFilter`: `[Libellé]` → name, a choice compared by its label → its value.
pub fn translate_filter(filter: &str, resolve: impl Fn(&str) -> Option<Resolved>) -> (String, Vec<String>) {
    let t: Vec<char> = filter.chars().collect();
    let mut unknown = Vec::new();
    let mut out = String::new();
    let mut current: Option<Resolved> = None;
    let mut i = 0;
    while i < t.len() {
        let c = t[i];
        if c == '"' {
            let end = string_end(&t, i);
            let literal: String = t[i..end].iter().collect();
            let mut replaced = literal.clone();
            if let Some(Resolved { options: Some(options), .. }) = &current {
                let lit: Vec<char> = literal.chars().collect();
                let inner_raw: String = if lit.len() >= 2 { lit[1..lit.len() - 1].iter().collect() } else { String::new() };
                let inner = unescape(&inner_raw);
                if let Some(o) = find_option(Some(options), &inner) {
                    replaced = serde_json::to_string(&o["value"]).unwrap_or_default();
                }
            }
            out.push_str(&replaced);
            i = end;
            continue;
        }
        if c == '[' {
            let (label, j) = bracket(&t, i);
            let field = resolve(&label);
            match &field {
                None => {
                    unknown.push(label);
                    out.extend(t[i..(j + 1).min(t.len())].iter());
                }
                Some(f) => out.push_str(&f.name),
            }
            current = field;
            i = j + 1;
            continue;
        }
        if c.is_ascii_alphabetic() || c == '_' {
            let mut j = i;
            while j < t.len() && (t[j].is_ascii_alphabetic() || t[j] == '_') {
                j += 1;
            }
            let word: String = t[i..j].iter().collect();
            if word == "and" || word == "or" {
                current = None;
            }
            out.push_str(&word);
            i = j;
            continue;
        }
        out.push(c);
        i += 1;
    }
    (out, unknown)
}

/// `findOption`: by label, then by value.
pub fn find_option<'a>(options: Option<&'a Vec<Value>>, v: &str) -> Option<&'a Value> {
    let options = options?;
    let key = label_key(v);
    options
        .iter()
        .find(|o| o["label"].as_str().is_some_and(|l| label_key(l) == key))
        .or_else(|| options.iter().find(|o| o["value"].as_str() == Some(v)))
}

/// `date.toISOString()`.
pub fn iso(t: chrono::DateTime<Utc>) -> String {
    t.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// A local date-time as `new Date(y, m, d, h, mi)` reads it, overflow carried.
fn local_instant(day: NaiveDate, hours: i64, minutes: i64) -> Option<chrono::DateTime<Utc>> {
    let naive: NaiveDateTime = day.and_hms_opt(0, 0, 0)? + Duration::hours(hours) + Duration::minutes(minutes);
    let local = Local.from_local_datetime(&naive);
    let resolved = local.earliest().or_else(|| Local.from_local_datetime(&(naive + Duration::hours(1))).earliest())?;
    Some(resolved.with_timezone(&Utc))
}

/// `new Date(y, m, d)` with the overflow JavaScript carries (a 31 into a short month).
fn overflowing(year: i64, month0: i64, day: i64) -> Option<NaiveDate> {
    let y = year + month0.div_euclid(12);
    let m = month0.rem_euclid(12) as u32 + 1;
    let first = NaiveDate::from_ymd_opt(y as i32, m, 1)?;
    first.checked_add_signed(Duration::days(day - 1))
}

/// `resolveTemplateDate`: `2026-10-01`, or relative to `today`; `None` when neither.
pub fn resolve_template_date(value: &str, kind: &str, today: chrono::DateTime<Local>) -> Option<String> {
    let text = js_trim(value);
    if let Some(r) = RELATIVE.captures(text) {
        let mut d = today.date_naive();
        if let Some(sign) = r.get(2) {
            let n: i64 = r[3].parse::<i64>().ok()? * if sign.as_str() == "-" { -1 } else { 1 };
            d = match &r[4] {
                "d" => d.checked_add_signed(Duration::days(n))?,
                "w" => d.checked_add_signed(Duration::days(7 * n))?,
                "m" => overflowing(d.year() as i64, d.month0() as i64 + n, d.day() as i64)?,
                _ => overflowing(d.year() as i64 + n, d.month0() as i64, d.day() as i64)?,
            };
        }
        if kind == "date" {
            return Some(d.format("%Y-%m-%d").to_string());
        }
        let hours: i64 = r.get(5).map_or(Some(9), |h| h.as_str().parse().ok())?;
        let minutes: i64 = r.get(6).map_or(Some(0), |m| m.as_str().parse().ok())?;
        if hours > 23 || minutes > 59 {
            return None;
        }
        return local_instant(d, hours, minutes).map(iso);
    }
    let a = ABSOLUTE.captures(text)?;
    let (y, mo, da) = (&a[1], &a[2], &a[3]);
    let (yn, mon, dan): (i32, u32, u32) = (y.parse().ok()?, mo.parse().ok()?, da.parse().ok()?);
    let day = NaiveDate::from_ymd_opt(yn, mon, dan)?;
    if kind == "date" {
        return Some(format!("{y}-{mo}-{da}"));
    }
    let Some(h) = a.get(4) else {
        return local_instant(day, 9, 0).map(iso);
    };
    let (h, mi): (i64, i64) = (h.as_str().parse().ok()?, a[5].parse().ok()?);
    match a.get(8) {
        None => local_instant(day, h, mi).map(iso),
        Some(zone) => {
            if h > 24 || mi > 59 || (h == 24 && mi != 0) {
                return None;
            }
            let secs: i64 = a.get(6).map_or(Some(0), |s| s.as_str().parse().ok())?;
            if secs > 59 {
                return None;
            }
            let millis: i64 = a.get(7).map_or(0, |f| {
                let digits: String = f.as_str()[1..].chars().chain("000".chars()).take(3).collect();
                digits.parse().unwrap_or(0)
            });
            let offset_minutes: i64 = match zone.as_str() {
                "Z" => 0,
                z => {
                    let digits: String = z[1..].chars().filter(char::is_ascii_digit).collect();
                    let (oh, om): (i64, i64) = (digits[..2].parse().ok()?, digits[2..].parse().ok()?);
                    if oh > 23 || om > 59 {
                        return None;
                    }
                    (oh * 60 + om) * if z.starts_with('-') { -1 } else { 1 }
                }
            };
            let naive = day.and_hms_opt(0, 0, 0)? + Duration::hours(h) + Duration::minutes(mi - offset_minutes) + Duration::seconds(secs) + Duration::milliseconds(millis);
            Some(iso(Utc.from_utc_datetime(&naive)))
        }
    }
}

/// `VIEW_FIELD_KEYS`: the spec keys that cite ONE field, a LIST of fields, and the others.
pub fn view_field_keys(kind: &str) -> (&'static [&'static str], &'static [&'static str], &'static [&'static str]) {
    match kind {
        "grid" => (&["group_by", "color_field"], &["hidden", "pinned", "column_order"], &["filter", "sorts", "summaries", "row_height", "page_size", "color_rules", "color_style"]),
        "kanban" => (&["group_by", "title_field"], &["card_fields"], &["filter", "sorts", "group_order", "hide_empty"]),
        "calendar" => (&["date_field", "end_field", "color_field", "title_field"], &["card_fields"], &["filter", "sorts", "mode"]),
        "timeline" => (&["start_field", "end_field", "group_by", "color_field", "depends_on", "title_field"], &["card_fields"], &["filter", "sorts", "scale"]),
        "gallery" => (&["title_field", "color_field"], &["card_fields"], &["filter", "sorts", "card_size"]),
        "list" => (&["group_by", "title_field"], &["card_fields"], &["filter", "sorts"]),
        _ => (
            &[],
            &[],
            &[
                "title", "description", "fields", "submit_label", "success_message", "allow_another", "theme", "accent", "font", "align", "welcome_label", "show_progress",
                "show_numbers", "auto_advance", "celebrate", "end_link_label", "end_link_url",
            ],
        ),
    }
}

fn view_key_kinds(kind: &str) -> Vec<(&'static str, &'static [&'static str])> {
    const SELECT: &[&str] = &["select"];
    match kind {
        "grid" => vec![("group_by", &GROUPABLE), ("color_field", SELECT)],
        "kanban" => vec![("group_by", SELECT)],
        "calendar" => vec![("date_field", &DATES), ("end_field", &DATES), ("color_field", SELECT)],
        "timeline" => vec![("start_field", &DATES), ("end_field", &DATES), ("group_by", &["select", "link"]), ("color_field", SELECT), ("depends_on", &["link", "multi_link"])],
        "gallery" => vec![("color_field", SELECT)],
        "list" => vec![("group_by", &["select", "link", "user"])],
        _ => vec![],
    }
}

fn summaries_for(kind: &str) -> &'static [&'static str] {
    match kind {
        "boolean" => &["checked", "filled", "empty"],
        "number" => &["filled", "empty", "unique", "sum", "avg", "min", "max"],
        "date" | "datetime" | "autonumber" => &["filled", "empty", "min", "max"],
        "long_text" | "multi_select" | "multi_link" | "lookup" => &["filled", "empty"],
        _ => &["filled", "empty", "unique"],
    }
}

// ── The checker ──────────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct KLink {
    to: String,
    multiple: bool,
}

#[derive(Clone)]
struct KField {
    label: String,
    kind: String,
    options: Option<Vec<Value>>,
    ai: bool,
    link: Option<KLink>,
}

struct Known {
    label: String,
    fields: IndexMap<String, KField>,
}

struct Checker {
    issues: Vec<Value>,
    format: i64,
    /// A proposal of the AI: what does not hold is dropped and said, not refused.
    repair: bool,
}

impl Checker {
    fn say(&mut self, path: &str, message: &str) {
        if self.issues.len() < 200 {
            self.issues.push(json!({ "path": path, "message": message }));
        }
    }

    fn text(&mut self, raw: &Raw, key: &str, path: &str, max: usize, required: bool) -> Option<String> {
        let at = format!("{path}.{key}");
        let value = match raw.get(key) {
            None | Some(Value::Null) => None,
            Some(Value::String(s)) if s.is_empty() => None,
            Some(v) => Some(v),
        };
        let Some(value) = value else {
            if required {
                self.say(&at, "valeur obligatoire");
            }
            return None;
        };
        let owned = match value {
            Value::String(s) => s.clone(),
            Value::Number(n) if self.repair => n.as_f64().map(js_number_string).unwrap_or_else(|| n.to_string()),
            _ => {
                self.say(&at, "texte attendu");
                return None;
            }
        };
        let text = js_trim(&owned);
        if u16len(text) > max {
            if self.repair {
                self.say(&at, &format!("coupé à {max} caractères"));
                return Some(u16slice(text, max));
            }
            self.say(&at, &format!("{max} caractères au plus"));
            return None;
        }
        if text.is_empty() {
            if required {
                self.say(&at, "valeur obligatoire");
            }
            return None;
        }
        Some(text.to_string())
    }

    fn list(&mut self, raw: &Raw, key: &str, path: &str, max: usize) -> Vec<Value> {
        match raw.get(key) {
            None | Some(Value::Null) => vec![],
            Some(Value::Array(a)) if a.len() > max => {
                self.say(&format!("{path}.{key}"), &format!("{max} éléments au plus"));
                if self.repair {
                    a[..max].to_vec()
                } else {
                    vec![]
                }
            }
            Some(Value::Array(a)) => a.clone(),
            Some(_) => {
                self.say(&format!("{path}.{key}"), "liste attendue");
                vec![]
            }
        }
    }
}

struct Table {
    key: String,
    head: Raw,
    fields: Vec<Raw>,
}

/// `checkTemplate` (strict): the template, or the issues that refuse it.
pub fn check_template(raw: &Value) -> Result<Value, Vec<Value>> {
    check(raw, false).map(|(t, _)| t)
}

/// `checkTemplate(raw, { repair: true })`: the template kept, with the issues said along
/// the way — or the issues when nothing could be kept.
pub fn check_template_repair(raw: &Value) -> Result<(Value, Vec<Value>), Vec<Value>> {
    check(raw, true)
}

fn unique_label(label: &str, taken: &mut HashSet<String>) -> String {
    let mut candidate = label.to_string();
    let mut n = 2;
    while taken.contains(&label_key(&candidate)) {
        candidate = format!("{label} {n}");
        n += 1;
    }
    taken.insert(label_key(&candidate));
    candidate
}

fn check(raw: &Value, repair: bool) -> Result<(Value, Vec<Value>), Vec<Value>> {
    let mut c = Checker { issues: vec![], format: TEMPLATE_FORMAT, repair };
    let Some(raw) = raw.as_object() else {
        c.say("", "un objet JSON est attendu");
        return Err(c.issues);
    };
    if u16len(&serde_json::to_string(raw).unwrap_or_default()) > L_BYTES {
        c.say("", "1 Mo au plus");
        return Err(c.issues);
    }
    let format = raw.get("format");
    let format_is = |n: f64| format.and_then(Value::as_f64) == Some(n);
    if format.is_some() && !format_is(1.0) && !format_is(TEMPLATE_FORMAT as f64) {
        c.say("format", &format!("format {} inconnu ; seuls les formats 1 et 2 existent", js_string(format)));
        return Err(c.issues);
    }
    if format_is(1.0) {
        c.format = 1;
    }

    let label = c.text(raw, "label", "", L_LABEL, true);
    let mut key = c.text(raw, "key", "", 64, !c.repair);
    if key.as_deref().is_some_and(|k| !KEY.is_match(k)) {
        if c.repair {
            key = None;
        } else {
            c.say("key", "minuscules, chiffres et tirets seulement");
        }
    }
    if key.is_none() {
        if let Some(l) = &label {
            let k: String = option_value(l).replace('_', "-").chars().take(64).collect();
            key = Some(if k.is_empty() { "modele".into() } else { k });
        }
    }
    let summary = c.text(raw, "summary", "", L_SUMMARY, false).unwrap_or_default();
    let description = c.text(raw, "description", "", L_DESCRIPTION, false);
    let category = c.text(raw, "category", "", L_LABEL, false);
    let mut icon = c.text(raw, "icon", "", 40, false);
    if icon.as_deref().is_some_and(|i| !ICON.is_match(i)) {
        c.say("icon", "nom d’icône invalide");
        icon = None;
    }
    let mut color = c.text(raw, "color", "", 7, false);
    if color.as_deref().is_some_and(|x| !COLOR.is_match(x)) {
        c.say("color", "couleur #rrggbb attendue");
        color = None;
    }
    let tags: Vec<Value> = c
        .list(raw, "tags", "", L_TAGS)
        .iter()
        .filter_map(|t| t.as_str().filter(|s| !js_trim(s).is_empty()).map(|s| json!(u16slice(js_trim(s), 30))))
        .collect();
    let empty = Raw::new();
    let raw_base = record(raw.get("base")).unwrap_or(&empty);
    let base_label = c.text(raw_base, "label", "base", L_LABEL, false).or_else(|| label.clone()).unwrap_or_default();
    let base_description = c.text(raw_base, "description", "base", L_DESCRIPTION, false);

    // ── Tables and their own fields ──
    let mut tables: Vec<Table> = vec![];
    let mut known: HashMap<String, Known> = HashMap::new();
    let mut table_labels: HashSet<String> = HashSet::new();
    let raw_tables = c.list(raw, "tables", "", L_TABLES);
    if raw_tables.is_empty() {
        c.say("tables", "au moins une table");
    }
    for (ti, rt) in raw_tables.iter().enumerate() {
        let path = format!("tables[{ti}]");
        let Some(rt) = rt.as_object() else {
            c.say(&path, "objet attendu");
            continue;
        };
        let t_label = c.text(rt, "label", &path, L_LABEL, true);
        let mut t_key = c.text(rt, "key", &path, 64, !c.repair);
        if t_key.is_none() {
            t_key = t_label.as_deref().map(option_value);
        }
        if t_key.as_deref().is_some_and(|k| !TABLE_KEY.is_match(k)) {
            c.say(&format!("{path}.key"), "minuscules, chiffres, tirets ou soulignés seulement");
            t_key = if c.repair { t_label.as_deref().map(option_value) } else { None };
        }
        let (Some(t_label), Some(t_key)) = (t_label, t_key) else { continue };
        if known.contains_key(&t_key) || table_labels.contains(&label_key(&t_label)) {
            c.say(&path, &format!("table « {t_label} » en double"));
            continue;
        }
        let mut fields: Vec<Raw> = vec![];
        let mut field_labels: HashSet<String> = HashSet::new();
        for (fi, rf) in c.list(rt, "fields", &path, L_FIELDS).iter().enumerate() {
            let at = format!("{path}.fields[{fi}]");
            let Some(field) = check_field(&mut c, rf, &at, fi == 0) else { continue };
            let lk = label_key(field["label"].as_str().unwrap_or_default());
            if field_labels.contains(&lk) {
                c.say(&at, &format!("champ « {} » en double", field["label"].as_str().unwrap_or_default()));
                continue;
            }
            field_labels.insert(lk);
            fields.push(field);
        }
        let Some(first) = fields.first() else {
            c.say(&format!("{path}.fields"), "au moins un champ");
            continue;
        };
        if !has(&DISPLAY_KINDS, first["kind"].as_str().unwrap_or_default()) || first.contains_key("ai") {
            c.say(&format!("{path}.fields[0]"), "le premier champ, colonne d’affichage, est un texte, un nombre, une date, un e-mail ou une adresse");
            if !c.repair {
                continue;
            }
            let mut name = Raw::new();
            name.insert("label".into(), json!(unique_label("Nom", &mut field_labels)));
            name.insert("kind".into(), json!("short_text"));
            fields.insert(0, name);
        }
        let t_icon = c.text(rt, "icon", &path, 40, false).filter(|i| ICON.is_match(i));
        let t_color = c.text(rt, "color", &path, 7, false).filter(|x| COLOR.is_match(x));
        let t_description = c.text(rt, "description", &path, L_DESCRIPTION, false);
        let mut head = Raw::new();
        head.insert("key".into(), json!(t_key));
        head.insert("label".into(), json!(t_label));
        if let Some(d) = t_description {
            head.insert("description".into(), json!(d));
        }
        if let Some(i) = t_icon {
            head.insert("icon".into(), json!(i));
        }
        if let Some(x) = t_color {
            head.insert("color".into(), json!(x));
        }
        table_labels.insert(label_key(&t_label));
        let kfields = fields
            .iter()
            .map(|f| {
                let l = f["label"].as_str().unwrap_or_default().to_string();
                (
                    label_key(&l),
                    KField { label: l, kind: f["kind"].as_str().unwrap_or_default().into(), options: f.get("options").and_then(Value::as_array).cloned(), ai: f.contains_key("ai"), link: None },
                )
            })
            .collect();
        known.insert(t_key.clone(), Known { label: t_label, fields: kfields });
        tables.push(Table { key: t_key, head, fields });
    }
    if tables.is_empty() {
        if c.issues.iter().all(|i| i["path"] != "tables") {
            c.say("tables", "aucune table valide");
        }
        return Err(c.issues);
    }

    // ── Relations ──
    let mut links: Vec<Raw> = vec![];
    for (li, rl) in c.list(raw, "links", "", 100).iter().enumerate() {
        let path = format!("links[{li}]");
        let Some(rl) = rl.as_object() else {
            c.say(&path, "objet attendu");
            continue;
        };
        let from = c.text(rl, "from", &path, 64, true);
        let to = c.text(rl, "to", &path, 64, true);
        let l_label = c.text(rl, "label", &path, L_LABEL, true);
        let (Some(from), Some(to), Some(l_label)) = (from, to, l_label) else { continue };
        if !known.contains_key(&from) || !known.contains_key(&to) {
            let missing = if known.contains_key(&from) { &to } else { &from };
            c.say(&path, &format!("table « {missing} » inconnue"));
            continue;
        }
        let source = &known[&from];
        if source.fields.contains_key(&label_key(&l_label)) {
            let msg = format!("« {l_label} » existe déjà dans « {} »", source.label);
            c.say(&path, &msg);
            continue;
        }
        let l_description = c.text(rl, "description", &path, L_DESCRIPTION, false);
        let multiple = rl.get("multiple") == Some(&Value::Bool(true));
        let mut link = Raw::new();
        link.insert("from".into(), json!(from));
        link.insert("label".into(), json!(l_label));
        link.insert("to".into(), json!(to));
        link.insert("multiple".into(), json!(multiple));
        if let Some(d) = l_description {
            link.insert("description".into(), json!(d));
        }
        links.push(link);
        known.get_mut(&from).unwrap().fields.insert(
            label_key(&l_label),
            KField { label: l_label, kind: if multiple { "multi_link" } else { "link" }.into(), options: None, ai: false, link: Some(KLink { to, multiple }) },
        );
    }

    // ── What the fields compute ──
    let mut automation_keys: HashSet<String> = HashSet::new();
    if let Some(Value::Array(list)) = raw.get("automations") {
        for ra in list {
            if let Some(k) = ra.as_object().and_then(|o| o.get("key")).and_then(Value::as_str) {
                automation_keys.insert(k.to_string());
            }
        }
    }
    for (ti, table) in tables.iter_mut().enumerate() {
        let mut declared: HashSet<String> = HashSet::new();
        let mut kept: Vec<Raw> = vec![];
        for (fi, field) in std::mem::take(&mut table.fields).into_iter().enumerate() {
            let path = format!("tables[{ti}].fields[{fi}]");
            let ok = check_computed(&mut c, &field, &path, &known[&table.key], &known, &links, &declared, &automation_keys, &table.key);
            let lk = label_key(field["label"].as_str().unwrap_or_default());
            if !ok && c.repair {
                if let Some(this) = known.get_mut(&table.key) {
                    this.fields.shift_remove(&lk);
                }
                continue;
            }
            declared.insert(lk);
            kept.push(field);
        }
        table.fields = kept;
    }

    // ── Sample rows ──
    let mut rows: Map<String, Value> = Map::new();
    let mut row_keys: HashMap<String, HashSet<String>> = HashMap::new();
    let mut total = 0usize;
    let raw_rows = match raw.get("rows") {
        None => Some(Raw::new()),
        Some(Value::Object(m)) => Some(m.clone()),
        Some(_) => None,
    };
    if raw_rows.is_none() {
        c.say("rows", "objet attendu : des lignes par clé de table");
    }
    for (t_key, list) in raw_rows.unwrap_or_default() {
        let Some(this) = known.get(&t_key) else {
            c.say(&format!("rows.{t_key}"), &format!("table « {t_key} » inconnue"));
            continue;
        };
        let Some(list) = list.as_array() else {
            c.say(&format!("rows.{t_key}"), "liste attendue");
            continue;
        };
        let mut keys: HashSet<String> = HashSet::new();
        let mut out: Vec<Value> = vec![];
        for (ri, rr) in list.iter().take(L_ROWS_PER_TABLE).enumerate() {
            if total >= L_ROWS {
                break;
            }
            if let Some(row) = check_row(&mut c, rr, &format!("rows.{t_key}[{ri}]"), this, &mut keys) {
                out.push(Value::Object(row));
                total += 1;
            }
        }
        if list.len() > L_ROWS_PER_TABLE {
            c.say(&format!("rows.{t_key}"), &format!("{L_ROWS_PER_TABLE} lignes au plus"));
        }
        rows.insert(t_key.clone(), Value::Array(out));
        row_keys.insert(t_key, keys);
    }
    let empty_keys = HashSet::new();
    for (t_key, list) in rows.iter_mut() {
        let this = &known[t_key];
        for (ri, row) in list.as_array_mut().unwrap().iter_mut().enumerate() {
            let row = row.as_object_mut().unwrap();
            let entries: Vec<(String, Value)> = row.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
            for (label, value) in entries {
                let Some(link) = this.fields.get(&label_key(&label)).and_then(|f| f.link.clone()) else { continue };
                let targets = row_keys.get(&link.to).unwrap_or(&empty_keys);
                let refs: Vec<String> = match &value {
                    Value::Array(a) => a.iter().map(|v| v.as_str().unwrap_or_default().to_string()).collect(),
                    v => vec![v.as_str().unwrap_or_default().to_string()],
                };
                let good: Vec<String> = refs.iter().filter(|r| targets.contains(&r.chars().skip(1).collect::<String>())).cloned().collect();
                if good.len() != refs.len() {
                    let bad: Vec<&str> = refs.iter().filter(|r| !good.contains(r)).map(String::as_str).collect();
                    c.say(&format!("rows.{t_key}[{ri}].{label}"), &format!("ligne {} inconnue dans « {} »", bad.join(", "), known[&link.to].label));
                }
                if good.is_empty() {
                    row.shift_remove(&label);
                } else if link.multiple {
                    row.insert(label, json!(good));
                } else {
                    row.insert(label, json!(good[0]));
                }
            }
        }
    }

    // ── Views, automations ──
    let mut views: Vec<Raw> = vec![];
    for (vi, rv) in c.list(raw, "views", "", L_VIEWS).iter().enumerate() {
        if let Some(view) = check_view(&mut c, rv, &format!("views[{vi}]"), &known, &views) {
            views.push(view);
        }
    }
    let mut automations: Vec<Raw> = vec![];
    for (ai, ra) in c.list(raw, "automations", "", L_AUTOMATIONS).iter().enumerate() {
        if let Some(a) = check_automation(&mut c, ra, &format!("automations[{ai}]"), &known) {
            automations.push(a);
        }
    }
    for table in &mut tables {
        let mut orphans: Vec<usize> = vec![];
        for (i, field) in table.fields.iter().enumerate() {
            let Some(auto) = field.get("button").and_then(|b| b.get("automation")).and_then(Value::as_str) else { continue };
            if !automations.iter().any(|a| a.get("key").and_then(Value::as_str) == Some(auto) && a["trigger"]["kind"] == "button") {
                c.say(&format!("tables.{}.{}", table.key, field["label"].as_str().unwrap_or_default()), "automatisation du bouton introuvable");
                orphans.push(i);
            }
        }
        if c.repair {
            for i in orphans.into_iter().rev() {
                table.fields.remove(i);
            }
        }
    }

    let (Some(label), Some(key)) = (label, key) else { return Err(c.issues) };
    if !c.repair && !c.issues.is_empty() {
        return Err(c.issues);
    }
    let rich = tables.iter().any(|t| t.fields.iter().any(|f| f.get("rich") == Some(&Value::Bool(true))));
    let mut t = Raw::new();
    t.insert("format".into(), json!(if rich { 2 } else { 1 }));
    t.insert("key".into(), json!(key));
    t.insert("label".into(), json!(label));
    t.insert("summary".into(), json!(summary));
    for (k, v) in [("description", description), ("category", category), ("icon", icon), ("color", color)] {
        if let Some(v) = v {
            t.insert(k.into(), json!(v));
        }
    }
    t.insert("tags".into(), Value::Array(tags));
    let mut base = Raw::new();
    base.insert("label".into(), json!(base_label));
    if let Some(d) = base_description {
        base.insert("description".into(), json!(d));
    }
    t.insert("base".into(), Value::Object(base));
    let tables: Vec<Value> = tables
        .into_iter()
        .map(|table| {
            let mut head = table.head;
            head.insert("fields".into(), Value::Array(table.fields.into_iter().map(Value::Object).collect()));
            Value::Object(head)
        })
        .collect();
    t.insert("tables".into(), Value::Array(tables));
    t.insert("links".into(), Value::Array(links.into_iter().map(Value::Object).collect()));
    t.insert("rows".into(), Value::Object(rows));
    t.insert("views".into(), Value::Array(views.into_iter().map(Value::Object).collect()));
    t.insert("automations".into(), Value::Array(automations.into_iter().map(Value::Object).collect()));
    Ok((Value::Object(t), c.issues))
}

fn check_field(c: &mut Checker, rf: &Value, path: &str, first: bool) -> Option<Raw> {
    let Some(rf) = rf.as_object() else {
        c.say(path, "objet attendu");
        return None;
    };
    let label = c.text(rf, "label", path, L_LABEL, true)?;
    let kind = rf.get("kind");
    let kind_text = kind.and_then(Value::as_str);
    if matches!(kind_text, Some("link" | "multi_link")) {
        c.say(&format!("{path}.kind"), "une relation se déclare dans « links »");
        return None;
    }
    let mut kind_text = kind_text;
    if matches!(kind_text, Some("file" | "image")) {
        c.say(&format!("{path}.kind"), "un modèle ne porte pas de fichier");
        if !c.repair {
            return None;
        }
        kind_text = Some("url");
    }
    let mut kind = match kind_text.filter(|k| has(&FIELD_KINDS, k)) {
        Some(k) => k,
        None => {
            c.say(&format!("{path}.kind"), &format!("type « {} » inconnu", js_string(kind)));
            if !c.repair {
                return None;
            }
            "short_text"
        }
    };
    let mut field = Raw::new();
    field.insert("label".into(), json!(label));
    field.insert("kind".into(), json!(kind));
    if let Some(d) = c.text(rf, "description", path, L_DESCRIPTION, false) {
        field.insert("description".into(), json!(d));
    }
    if rf.get("required") == Some(&Value::Bool(true)) && !has(&COMPUTED_KINDS, kind) {
        field.insert("required".into(), json!(true));
    }

    if kind == "select" || kind == "multi_select" {
        let mut options: Vec<Value> = vec![];
        let mut seen: HashSet<String> = HashSet::new();
        let mut values: HashSet<String> = HashSet::new();
        for (oi, ro) in c.list(rf, "options", path, L_OPTIONS).iter().enumerate() {
            let option: Raw = match ro {
                Value::String(s) => {
                    let mut m = Raw::new();
                    m.insert("label".into(), json!(s));
                    m
                }
                Value::Object(m) => m.clone(),
                _ => continue,
            };
            let Some(o_label) = c.text(&option, "label", &format!("{path}.options[{oi}]"), L_LABEL, true) else { continue };
            if !seen.insert(label_key(&o_label)) {
                continue;
            }
            let mut value = option_value(&o_label);
            let mut n = 2;
            while values.contains(&value) {
                value = format!("{}_{n}", option_value(&o_label));
                n += 1;
            }
            values.insert(value.clone());
            let o_color = option.get("color").and_then(Value::as_str).filter(|x| COLOR.is_match(x)).map(str::to_string);
            let o_icon = option.get("icon").and_then(Value::as_str).filter(|x| ICON.is_match(x)).map(str::to_string);
            let color = o_color.unwrap_or_else(|| PALETTE[options.len() % PALETTE.len()].to_string());
            options.push(json!({ "label": o_label, "value": value, "color": color, "icon": o_icon }));
        }
        if options.is_empty() {
            c.say(&format!("{path}.options"), "au moins un choix");
            if !c.repair {
                return None;
            }
            kind = "short_text";
            field.insert("kind".into(), json!(kind));
        } else {
            field.insert("options".into(), Value::Array(options));
        }
    }

    if let Some(format) = record(rf.get("format")) {
        let display = format.get("display").and_then(Value::as_str);
        let allowed: Option<&[&str]> = match kind {
            "number" => Some(&NUMBER_FORMATS),
            "short_text" => Some(&TEXT_FORMATS),
            _ => None,
        };
        match (allowed, display) {
            (Some(allowed), Some(display)) if allowed.contains(&display) => {
                let mut f = Raw::new();
                f.insert("display".into(), json!(display));
                if display == "currency" {
                    let code = format.get("currency").and_then(Value::as_str).map_or_else(|| "EUR".to_string(), str::to_uppercase);
                    f.insert("currency".into(), json!(if CURRENCY.is_match(&code) { code } else { "EUR".into() }));
                }
                if display == "rating" {
                    let max = format.get("rating_max").and_then(Value::as_f64).filter(|m| m.fract() == 0.0 && (1.0..=10.0).contains(m));
                    f.insert("rating_max".into(), json!(max.map_or(5, |m| m as i64)));
                }
                field.insert("format".into(), Value::Object(f));
            }
            _ => c.say(&format!("{path}.format"), "format inconnu pour ce type"),
        }
    }

    if rf.get("rich") == Some(&Value::Bool(true)) {
        if kind != "long_text" {
            c.say(&format!("{path}.rich"), "seul un texte long peut être riche");
        } else if first {
            c.say(&format!("{path}.rich"), "la colonne d’affichage n’est pas un texte riche");
        } else if c.format == 1 {
            c.say(&format!("{path}.rich"), "un texte riche demande \"format\": 2");
        } else {
            field.insert("rich".into(), json!(true));
        }
    }

    if kind == "formula" {
        let formula = c.text(rf, "formula", path, 4000, true)?;
        field.insert("formula".into(), json!(formula));
    }
    if matches!(kind, "lookup" | "rollup" | "count") {
        let rr = record(rf.get("rollup"));
        let at = format!("{path}.rollup");
        let via = match rr {
            None => {
                c.say(&at, "la relation suivie est obligatoire");
                return None;
            }
            Some(rr) => c.text(rr, "via", &at, L_LABEL, true)?,
        };
        let rr = rr.unwrap();
        let mut rollup = Raw::new();
        rollup.insert("via".into(), json!(via));
        if let Some(t) = c.text(rr, "table", &at, 64, false) {
            rollup.insert("table".into(), json!(t));
        }
        let target = c.text(rr, "target", &at, L_LABEL, false);
        if let Some(t) = &target {
            rollup.insert("target".into(), json!(t));
        }
        if kind != "count" && target.is_none() {
            c.say(&format!("{at}.target"), "le champ lu est obligatoire");
            return None;
        }
        if kind == "rollup" {
            match rr.get("aggregate").and_then(Value::as_str).filter(|a| has(&AGGREGATES, a)) {
                Some(a) => {
                    rollup.insert("aggregate".into(), json!(a));
                }
                None => {
                    c.say(&format!("{at}.aggregate"), "agrégat attendu : count, sum, avg, min ou max");
                    if !c.repair {
                        return None;
                    }
                    rollup.insert("aggregate".into(), json!("sum"));
                }
            }
        }
        field.insert("rollup".into(), Value::Object(rollup));
    }

    if rf.get("ai").is_some_and(|a| !a.is_null()) {
        let ra = record(rf.get("ai"));
        let at = format!("{path}.ai");
        let prompt = ra.and_then(|ra| c.text(ra, "prompt", &at, L_PROMPT, true));
        if !has(&AI_KINDS, kind) {
            c.say(&at, "l’IA ne calcule pas ce type de champ");
        } else if field.contains_key("rich") {
            c.say(&at, "l’IA n’écrit pas de texte riche");
        } else if first {
            c.say(&at, "la colonne d’affichage n’est pas calculée par l’IA");
        } else if let (Some(ra), Some(prompt)) = (ra, prompt) {
            let refresh = match record(ra.get("refresh")) {
                Some(r) if r.get("cron").is_some_and(Value::is_string) => {
                    json!({ "cron": r["cron"], "timezone": r.get("timezone").and_then(Value::as_str).unwrap_or("Europe/Paris") })
                }
                _ => json!("if_empty"),
            };
            field.insert("ai".into(), json!({ "prompt": prompt, "refresh": refresh }));
        }
        if !field.contains_key("ai") && !c.repair {
            return None;
        }
    }

    if kind == "button" {
        let at = format!("{path}.button");
        let Some(rb) = record(rf.get("button")) else {
            c.say(&at, "le libellé et l’action du bouton sont obligatoires");
            return None;
        };
        let b_label = c.text(rb, "label", &at, 40, true)?;
        let url = c.text(rb, "url", &at, 2000, false);
        let automation = c.text(rb, "automation", &at, 64, false);
        if url.as_deref().is_some_and(|u| !BUTTON_URL.is_match(u)) {
            c.say(&format!("{at}.url"), "une adresse https: ou mailto: seulement");
            return None;
        }
        if url.is_none() == automation.is_none() {
            c.say(&at, "une adresse ou une automatisation, l’une ou l’autre");
            return None;
        }
        let mut button = Raw::new();
        button.insert("label".into(), json!(b_label));
        if let Some(x) = rb.get("color").and_then(Value::as_str).filter(|x| COLOR.is_match(x)) {
            button.insert("color".into(), json!(x));
        }
        if let Some(u) = url {
            button.insert("url".into(), json!(u));
        }
        if let Some(a) = automation {
            button.insert("automation".into(), json!(a));
        }
        field.insert("button".into(), Value::Object(button));
    }
    Some(field)
}

#[allow(clippy::too_many_arguments)]
fn check_computed(
    c: &mut Checker,
    field: &Raw,
    path: &str,
    this: &Known,
    known: &HashMap<String, Known>,
    links: &[Raw],
    declared: &HashSet<String>,
    automations: &HashSet<String>,
    table_key: &str,
) -> bool {
    let lookup = |label: &str| this.fields.get(&label_key(label));
    if let Some(formula) = field.get("formula").and_then(Value::as_str) {
        for cited in cited_labels(formula) {
            let Some(target) = lookup(&cited) else {
                c.say(&format!("{path}.formula"), &format!("champ « {cited} » inconnu"));
                return false;
            };
            if has(&COMPUTED_KINDS, &target.kind) && !declared.contains(&label_key(&cited)) {
                c.say(&format!("{path}.formula"), &format!("« {cited} » est calculé : déclarez-le avant cette formule"));
                return false;
            }
        }
    }
    if let Some(rollup) = field.get("rollup").and_then(Value::as_object) {
        let via = rollup["via"].as_str().unwrap_or_default();
        let target = rollup.get("target").and_then(Value::as_str);
        let reached: Option<&Known> = match rollup.get("table").and_then(Value::as_str) {
            None => {
                let Some(link) = lookup(via).and_then(|f| f.link.as_ref()) else {
                    c.say(&format!("{path}.rollup.via"), &format!("« {via} » n’est pas une relation de cette table"));
                    return false;
                };
                known.get(&link.to)
            }
            Some(table) => {
                let found = links.iter().any(|l| l["from"] == table && label_key(l["label"].as_str().unwrap_or_default()) == label_key(via) && l["to"] == table_key);
                if !found {
                    c.say(&format!("{path}.rollup.via"), &format!("aucune relation « {via} » de « {table} » vers cette table"));
                    return false;
                }
                known.get(table)
            }
        };
        if let Some(target) = target {
            if reached.and_then(|r| r.fields.get(&label_key(target))).is_none() {
                let name = reached.map_or_else(|| "undefined".to_string(), |r| r.label.clone());
                c.say(&format!("{path}.rollup.target"), &format!("champ « {target} » inconnu dans « {name} »"));
                return false;
            }
        }
    }
    if let Some(prompt) = field.get("ai").and_then(|a| a.get("prompt")).and_then(Value::as_str) {
        let own = label_key(field["label"].as_str().unwrap_or_default());
        for cited in cited_in_text(prompt) {
            if lookup(&cited).is_none() || label_key(&cited) == own {
                c.say(&format!("{path}.ai.prompt"), &format!("champ « {cited} » inconnu"));
                return false;
            }
        }
    }
    if let Some(button) = field.get("button").and_then(Value::as_object) {
        if let Some(url) = button.get("url").and_then(Value::as_str) {
            for cited in cited_in_text(url) {
                if lookup(&cited).is_none() {
                    c.say(&format!("{path}.button.url"), &format!("champ « {cited} » inconnu"));
                    return false;
                }
            }
        }
        if let Some(a) = button.get("automation").and_then(Value::as_str) {
            if !automations.contains(a) {
                c.say(&format!("{path}.button.automation"), &format!("automatisation « {a} » inconnue"));
                return false;
            }
        }
    }
    true
}

fn check_row(c: &mut Checker, rr: &Value, path: &str, this: &Known, keys: &mut HashSet<String>) -> Option<Raw> {
    let Some(rr) = rr.as_object() else {
        c.say(path, "objet attendu");
        return None;
    };
    let mut row = Raw::new();
    for (label, value) in rr {
        if label == "$key" {
            match value.as_str() {
                Some(k) if ROW_KEY.is_match(k) && !keys.contains(k) => {
                    keys.insert(k.to_string());
                    row.insert("$key".into(), json!(k));
                }
                _ => c.say(&format!("{path}.$key"), "clé de ligne invalide ou en double"),
            }
            continue;
        }
        if value.is_null() || value.as_str() == Some("") {
            continue;
        }
        let at = format!("{path}.{label}");
        let Some(field) = this.fields.get(&label_key(label)) else {
            c.say(&at, &format!("champ inconnu dans « {} »", this.label));
            continue;
        };
        if has(&COMPUTED_KINDS, &field.kind) {
            c.say(&at, "champ calculé : il ne reçoit pas de valeur");
            continue;
        }
        if let Some(checked) = check_value(c, value, field, &at) {
            row.insert(field.label.clone(), checked);
        }
    }
    if row.keys().all(|k| k == "$key") {
        c.say(path, "ligne vide");
        return None;
    }
    Some(row)
}

fn check_value(c: &mut Checker, value: &Value, field: &KField, path: &str) -> Option<Value> {
    let repaired_text = match value {
        Value::Number(n) if c.repair => Some(Value::String(n.as_f64().map(js_number_string).unwrap_or_else(|| n.to_string()))),
        Value::Bool(b) if c.repair => Some(Value::String(b.to_string())),
        _ => None,
    };
    let repair = c.repair;
    let mut bad = |m: &str| {
        c.say(path, m);
        None
    };
    match field.kind.as_str() {
        "short_text" | "long_text" | "url" | "email" => {
            let value = repaired_text.as_ref().unwrap_or(value);
            let Some(v) = value.as_str() else { return bad("texte attendu") };
            if u16len(v) > L_TEXT {
                return bad(&format!("{L_TEXT} caractères au plus"));
            }
            if field.kind == "email" && !EMAIL.is_match(v) {
                return bad("adresse e-mail invalide");
            }
            if field.kind == "url" && !HTTP.is_match(v) {
                return bad("adresse http(s) attendue");
            }
            Some(value.clone())
        }
        "number" => {
            if let Some(s) = value.as_str().filter(|_| repair) {
                let t = js_trim(s);
                if REPAIR_NUMBER.is_match(t) {
                    if let Ok(f) = t.replace(',', ".").parse::<f64>() {
                        return Some(number_value(f));
                    }
                }
            }
            match value.as_f64() {
                Some(f) if f.is_finite() => Some(value.clone()),
                _ => bad("nombre attendu"),
            }
        }
        "boolean" => {
            if value.is_boolean() {
                return Some(value.clone());
            }
            if let Some(s) = value.as_str().filter(|_| repair) {
                let folded = label_key(s);
                if ["true", "oui", "vrai", "yes"].contains(&folded.as_str()) {
                    return Some(json!(true));
                }
                if ["false", "non", "faux", "no"].contains(&folded.as_str()) {
                    return Some(json!(false));
                }
            }
            bad("vrai ou faux attendu")
        }
        "date" | "datetime" => match value.as_str() {
            Some(s) if resolve_template_date(s, &field.kind, Local::now()).is_some() => Some(value.clone()),
            _ => bad("date attendue : 2026-10-01, today, +3d, -2w…"),
        },
        "select" => {
            let v = match value {
                Value::Array(a) if repair => a.first(),
                v => Some(v),
            };
            match v.and_then(Value::as_str).and_then(|s| find_option(field.options.as_ref(), s)) {
                Some(o) => Some(o["label"].clone()),
                None => bad(&format!("choix « {} » inconnu", js_string(v))),
            }
        }
        "multi_select" => {
            let single;
            let list = match value {
                Value::Array(a) => a,
                Value::String(_) if repair => {
                    single = vec![value.clone()];
                    &single
                }
                _ => return bad("liste de choix attendue"),
            };
            let mut labels: Vec<Value> = vec![];
            for v in list {
                match v.as_str().and_then(|s| find_option(field.options.as_ref(), s)) {
                    None => c.say(path, &format!("choix « {} » inconnu", js_string(Some(v)))),
                    Some(o) => {
                        if !labels.contains(&o["label"]) {
                            labels.push(o["label"].clone());
                        }
                    }
                }
            }
            if labels.is_empty() {
                None
            } else {
                Some(Value::Array(labels))
            }
        }
        "user" => {
            if value.as_str() == Some("$moi") {
                Some(json!("$moi"))
            } else {
                bad("« $moi » seulement : un modèle ne connaît personne")
            }
        }
        "link" | "multi_link" => {
            let list: Vec<Value> = match value {
                Value::Array(a) => a.clone(),
                v => vec![v.clone()],
            };
            if !list.iter().all(|v| v.as_str().is_some_and(|s| s.starts_with('@'))) {
                return bad("« @clé » d’une ligne attendue");
            }
            if field.kind == "link" && list.len() > 1 && !repair {
                return bad("une seule ligne pour cette relation");
            }
            if field.kind == "link" {
                list.into_iter().next()
            } else {
                Some(Value::Array(list))
            }
        }
        _ => bad("ce champ ne reçoit pas de valeur"),
    }
}

fn check_filter(c: &mut Checker, filter: &str, path: &str, this: &Known) -> bool {
    let unknown: Vec<String> = cited_labels(filter).into_iter().filter(|l| !this.fields.contains_key(&label_key(l))).collect();
    if unknown.is_empty() {
        return true;
    }
    let s = if unknown.len() > 1 { "s" } else { "" };
    let list = unknown.iter().map(|u| format!("« {u} »")).collect::<Vec<_>>().join(", ");
    c.say(path, &format!("champ{s} {list} inconnu{s}"));
    false
}

fn check_view(c: &mut Checker, rv: &Value, path: &str, known: &HashMap<String, Known>, views: &[Raw]) -> Option<Raw> {
    let Some(rv) = rv.as_object() else {
        c.say(path, "objet attendu");
        return None;
    };
    let table_key = c.text(rv, "table", path, 64, true);
    let label = c.text(rv, "label", path, L_LABEL, true);
    let (table_key, label) = (table_key?, label?);
    let Some(this) = known.get(&table_key) else {
        c.say(&format!("{path}.table"), &format!("table « {table_key} » inconnue"));
        return None;
    };
    let Some(kind) = rv.get("kind").and_then(Value::as_str).filter(|k| has(&VIEW_KINDS, k)) else {
        c.say(&format!("{path}.kind"), &format!("sorte de vue « {} » inconnue", js_string(rv.get("kind"))));
        return None;
    };
    if views.iter().any(|v| v["table"] == table_key.as_str() && label_key(v["label"].as_str().unwrap_or_default()) == label_key(&label)) {
        c.say(path, &format!("vue « {label} » en double"));
        return None;
    }
    let (one, many, other) = view_field_keys(kind);
    let empty = Raw::new();
    let raw_spec = record(rv.get("spec")).unwrap_or(&empty);
    let mut spec = Raw::new();
    let mut broken = false;
    let field = |c: &mut Checker, label: Option<&Value>, at: &str, broken: &mut bool| -> Option<KField> {
        let Some(label) = label.and_then(Value::as_str) else {
            c.say(at, "libellé de champ attendu");
            *broken = true;
            return None;
        };
        match this.fields.get(&label_key(label)) {
            None => {
                c.say(at, &format!("champ « {label} » inconnu"));
                *broken = true;
                None
            }
            Some(f) => Some(f.clone()),
        }
    };
    for (key, value) in raw_spec {
        let at = format!("{path}.spec.{key}");
        if value.is_null() {
            continue;
        }
        if one.contains(&key.as_str()) {
            if let Some(f) = field(c, Some(value), &at, &mut broken) {
                spec.insert(key.clone(), json!(f.label));
            }
        } else if many.contains(&key.as_str()) {
            let Some(list) = value.as_array() else {
                c.say(&at, "liste de libellés attendue");
                broken = true;
                continue;
            };
            let labels: Vec<Value> = list.iter().enumerate().filter_map(|(i, v)| field(c, Some(v), &format!("{at}[{i}]"), &mut broken).map(|f| json!(f.label))).collect();
            spec.insert(key.clone(), Value::Array(labels));
        } else if other.contains(&key.as_str()) {
            spec.insert(key.clone(), value.clone());
        } else {
            c.say(&at, "clé inconnue pour cette sorte de vue");
            broken = true;
        }
    }
    if let Some(filter) = spec.get("filter").and_then(Value::as_str).map(str::to_string) {
        if !check_filter(c, &filter, &format!("{path}.spec.filter"), this) {
            broken = true;
            spec.shift_remove("filter");
        }
    }
    if let Some(sorts) = spec.get("sorts").cloned() {
        let list = sorts.as_array().cloned().unwrap_or_default();
        let out: Vec<Value> = list
            .iter()
            .enumerate()
            .filter_map(|(i, s)| {
                let o = s.as_object()?;
                let f = field(c, o.get("field"), &format!("{path}.spec.sorts[{i}]"), &mut broken)?;
                Some(json!({ "field": f.label, "direction": if o.get("direction").and_then(Value::as_str) == Some("desc") { "desc" } else { "asc" } }))
            })
            .collect();
        spec.insert("sorts".into(), Value::Array(out));
    }
    if let Some(summaries) = spec.get("summaries").cloned() {
        let mut out = Raw::new();
        for (label, f) in summaries.as_object().cloned().unwrap_or_default() {
            let Some(found) = field(c, Some(&json!(label)), &format!("{path}.spec.summaries"), &mut broken) else { continue };
            let Some(f) = f.as_str() else { continue };
            if !summaries_for(&found.kind).contains(&f) {
                c.say(&format!("{path}.spec.summaries"), &format!("« {} » ne se résume pas par « {f} »", found.label));
                broken = true;
                continue;
            }
            out.insert(found.label.clone(), json!(f));
        }
        spec.insert("summaries".into(), Value::Object(out));
    }
    for (key, kinds) in view_key_kinds(kind) {
        let Some(value) = spec.get(key).and_then(Value::as_str) else { continue };
        let Some(found) = this.fields.get(&label_key(value)) else { continue };
        let self_link = key != "depends_on" || found.link.as_ref().is_some_and(|l| l.to == table_key);
        if !kinds.contains(&found.kind.as_str()) || !self_link {
            let message = if key == "depends_on" && kinds.contains(&found.kind.as_str()) {
                format!("« {} » n’est pas une relation de la table à elle-même", found.label)
            } else {
                format!("« {} » n’a pas le type qu’attend la vue", found.label)
            };
            c.say(&format!("{path}.spec.{key}"), &message);
            broken = true;
            spec.shift_remove(key);
        }
    }
    if let Some(end) = spec.get("end_field") {
        if Some(end) == spec.get("start_field").or_else(|| spec.get("date_field")) {
            c.say(&format!("{path}.spec.end_field"), "la fin et le début sont le même champ");
            broken = true;
            spec.shift_remove("end_field");
        }
    }
    if let Some(rules) = spec.get("color_rules").cloned() {
        let list = rules.as_array().cloned().unwrap_or_default();
        let kept: Vec<Value> = list
            .into_iter()
            .enumerate()
            .filter(|(i, r)| {
                let Some(o) = r.as_object() else { return false };
                let (Some(f), true) = (o.get("filter").and_then(Value::as_str), o.get("color").is_some_and(Value::is_string)) else { return false };
                check_filter(c, f, &format!("{path}.spec.color_rules[{i}]"), this)
            })
            .map(|(_, r)| r)
            .collect();
        spec.insert("color_rules".into(), Value::Array(kept));
    }
    if let Some(order) = spec.get("group_order").cloned() {
        let group = spec.get("group_by").and_then(Value::as_str).and_then(|g| this.fields.get(&label_key(g)));
        let out: Vec<Value> = order
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter_map(|v| v.as_str().and_then(|s| find_option(group.and_then(|g| g.options.as_ref()), s)).map(|o| o["label"].clone()))
            .collect();
        spec.insert("group_order".into(), Value::Array(out));
    }
    if kind == "form" {
        let questions = raw_spec.get("fields").and_then(Value::as_array).cloned().unwrap_or_default();
        let mut out: Vec<Value> = vec![];
        for (i, q) in questions.iter().enumerate() {
            let entry: Raw = match q {
                Value::String(_) => {
                    let mut m = Raw::new();
                    m.insert("field".into(), q.clone());
                    m
                }
                Value::Object(m) => m.clone(),
                _ => continue,
            };
            let at = format!("{path}.spec.fields[{i}]");
            let Some(found) = field(c, entry.get("field"), &at, &mut broken) else { continue };
            if !has(&FORM_KINDS, &found.kind) || found.ai {
                c.say(&at, &format!("« {} » ne se pose pas dans un formulaire", found.label));
                broken = true;
                continue;
            }
            let condition = record(entry.get("show_if"));
            let read = condition.and_then(|cond| field(c, cond.get("field"), &format!("{at}.show_if.field"), &mut broken));
            let show_if = match (condition, read) {
                (Some(cond), Some(read)) if cond.get("op").is_some_and(Value::is_string) => {
                    let value = match cond.get("value") {
                        Some(Value::String(s)) if read.kind == "select" || read.kind == "multi_select" => {
                            find_option(read.options.as_ref(), s).map_or_else(|| json!(s), |o| o["label"].clone())
                        }
                        Some(v) => v.clone(),
                        None => Value::Null,
                    };
                    Some(json!({ "field": read.label, "op": cond["op"], "value": value }))
                }
                _ => None,
            };
            let mut question = Raw::new();
            question.insert("field".into(), json!(found.label));
            question.insert("required".into(), json!(entry.get("required") == Some(&Value::Bool(true))));
            for k in ["label", "help", "placeholder"] {
                if let Some(s) = entry.get(k).filter(|v| v.is_string()) {
                    question.insert(k.into(), s.clone());
                }
            }
            if entry.get("prefill").and_then(Value::as_str) == Some("today") && (found.kind == "date" || found.kind == "datetime") {
                question.insert("prefill".into(), json!("today"));
            }
            if let Some(s) = show_if {
                question.insert("show_if".into(), s);
            }
            out.push(Value::Object(question));
        }
        let none = out.is_empty();
        spec.insert("fields".into(), Value::Array(out));
        if none {
            c.say(&format!("{path}.spec.fields"), "un formulaire pose au moins une question");
            return None;
        }
    }
    if kind == "kanban" && !spec.contains_key("group_by") {
        let Some(choice) = this.fields.values().find(|f| f.kind == "select") else {
            c.say(&format!("{path}.spec.group_by"), "un kanban se groupe par une liste de choix");
            return None;
        };
        spec.insert("group_by".into(), json!(choice.label));
    }
    if kind == "calendar" && !spec.contains_key("date_field") {
        let Some(date) = this.fields.values().find(|f| has(&DATES, &f.kind)) else {
            c.say(&format!("{path}.spec.date_field"), "un calendrier demande une date");
            return None;
        };
        spec.insert("date_field".into(), json!(date.label));
    }
    if kind == "timeline" && !spec.contains_key("start_field") {
        let dates: Vec<&KField> = this.fields.values().filter(|f| has(&DATES, &f.kind)).collect();
        let Some(first) = dates.first() else {
            c.say(&format!("{path}.spec.start_field"), "une chronologie demande une date de début");
            return None;
        };
        spec.insert("start_field".into(), json!(first.label));
        if !spec.contains_key("end_field") {
            if let Some(second) = dates.get(1) {
                spec.insert("end_field".into(), json!(second.label));
            }
        }
    }
    if broken && !c.repair {
        return None;
    }
    let description = c.text(rv, "description", path, L_DESCRIPTION, false);
    let mut view = Raw::new();
    view.insert("table".into(), json!(table_key));
    view.insert("label".into(), json!(label));
    view.insert("kind".into(), json!(kind));
    if let Some(d) = description {
        view.insert("description".into(), json!(d));
    }
    view.insert("spec".into(), Value::Object(spec));
    Some(view)
}

fn check_automation(c: &mut Checker, ra: &Value, path: &str, known: &HashMap<String, Known>) -> Option<Raw> {
    let Some(ra) = ra.as_object() else {
        c.say(path, "objet attendu");
        return None;
    };
    let label = c.text(ra, "label", path, L_LABEL, true)?;
    let Some(rt) = record(ra.get("trigger")) else {
        c.say(&format!("{path}.trigger"), "déclencheur obligatoire");
        return None;
    };
    let Some(kind) = rt.get("kind").and_then(Value::as_str).filter(|k| matches!(*k, "record_created" | "record_updated" | "schedule" | "button")) else {
        c.say(&format!("{path}.trigger.kind"), &format!("déclencheur « {} » inconnu", js_string(rt.get("kind"))));
        return None;
    };
    let table_key = if kind == "schedule" { None } else { c.text(rt, "table", &format!("{path}.trigger"), 64, true) };
    let this = table_key.as_ref().and_then(|k| known.get(k));
    if kind != "schedule" && this.is_none() {
        if let Some(k) = &table_key {
            c.say(&format!("{path}.trigger.table"), &format!("table « {k} » inconnue"));
        }
        return None;
    }
    let field_of = |c: &mut Checker, table: Option<&Known>, label: Option<&Value>, at: &str| -> Option<KField> {
        let found = label.and_then(Value::as_str).and_then(|l| table.and_then(|t| t.fields.get(&label_key(l)))).cloned();
        if found.is_none() {
            c.say(at, &format!("champ « {} » inconnu", js_string(label)));
        }
        found
    };
    let fields: Vec<Value> = if kind == "record_updated" {
        rt.get("fields")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
            .iter()
            .enumerate()
            .filter_map(|(i, f)| field_of(c, this, Some(f), &format!("{path}.trigger.fields[{i}]")).map(|f| json!(f.label)))
            .collect()
    } else {
        vec![]
    };
    let schedule = if kind == "schedule" {
        let empty = Raw::new();
        let rs = record(rt.get("schedule")).unwrap_or(&empty);
        let every = rs.get("every").and_then(Value::as_str).filter(|e| matches!(*e, "hour" | "week")).unwrap_or("day");
        let at = rs.get("at").and_then(Value::as_str).filter(|a| AT.is_match(a)).unwrap_or("09:00");
        let weekday = rs.get("weekday").and_then(Value::as_f64).filter(|w| w.fract() == 0.0 && (0.0..=6.0).contains(w)).map_or(1, |w| w as i64);
        let timezone = rs.get("timezone").and_then(Value::as_str).unwrap_or("Europe/Paris");
        json!({ "every": every, "at": at, "weekday": weekday, "timezone": timezone })
    } else {
        Value::Null
    };
    let condition = if kind == "schedule" { String::new() } else { c.text(ra, "condition", path, 2000, false).unwrap_or_default() };
    if !condition.is_empty() {
        if let Some(this) = this {
            if !check_filter(c, &condition, &format!("{path}.condition"), this) {
                return None;
            }
        }
    }

    let values_of = |c: &mut Checker, raw: Option<&Value>, table: Option<&Known>, at: &str| -> Raw {
        let mut out = Raw::new();
        for (label, value) in record(raw).cloned().unwrap_or_default() {
            let where_ = format!("{at}.{label}");
            let Some(found) = field_of(c, table, Some(&json!(label)), &where_) else { continue };
            if has(&COMPUTED_KINDS, &found.kind) || found.ai {
                c.say(&where_, "champ calculé : il ne reçoit pas de valeur");
                continue;
            }
            if !(value.is_string() || value.is_number() || value.is_boolean()) {
                continue;
            }
            if let Some(s) = value.as_str() {
                let unknown: Vec<String> = cited_in_text(s).into_iter().filter(|l| this.and_then(|t| t.fields.get(&label_key(l))).is_none()).collect();
                if let Some(u) = unknown.first() {
                    c.say(&where_, &format!("champ « {u} » inconnu"));
                    continue;
                }
            }
            let written = match (value.as_str(), &found.options) {
                (Some(s), Some(options)) => find_option(Some(options), s).map_or_else(|| value.clone(), |o| o["label"].clone()),
                _ => value.clone(),
            };
            out.insert(found.label.clone(), written);
        }
        out
    };
    let mut actions: Vec<Value> = vec![];
    for (xi, rx) in c.list(ra, "actions", path, L_ACTIONS).iter().enumerate() {
        let at = format!("{path}.actions[{xi}]");
        let Some(rx) = rx.as_object() else { continue };
        match rx.get("kind").and_then(Value::as_str) {
            Some("webhook" | "slack" | "email") => c.say(&at, "un modèle n’appelle pas l’extérieur : action retirée"),
            Some("update_record") => {
                if kind == "schedule" {
                    c.say(&at, "une automatisation à heure fixe n’a pas de ligne à modifier");
                    continue;
                }
                let values = values_of(c, rx.get("values"), this, &format!("{at}.values"));
                if !values.is_empty() {
                    actions.push(json!({ "kind": "update_record", "values": values }));
                }
            }
            Some("create_record") => {
                let target = rx.get("table").and_then(Value::as_str).and_then(|t| known.get(t));
                let Some(target) = target else {
                    c.say(&format!("{at}.table"), &format!("table « {} » inconnue", js_string(rx.get("table"))));
                    continue;
                };
                let values = values_of(c, rx.get("values"), Some(target), &format!("{at}.values"));
                actions.push(json!({ "kind": "create_record", "table": rx["table"], "values": values }));
            }
            Some("notify") => {
                let users: Vec<Value> = rx.get("users").and_then(Value::as_array).cloned().unwrap_or_default().into_iter().filter(|u| u == "$moi").collect();
                let user_field = match rx.get("user_field") {
                    None | Some(Value::Null) => None,
                    Some(f) => Some(field_of(c, this, Some(f), &format!("{at}.user_field"))),
                };
                if let Some(f) = &user_field {
                    if f.as_ref().is_none_or(|f| f.kind != "user") {
                        c.say(&format!("{at}.user_field"), "un champ personne est attendu");
                        continue;
                    }
                }
                let message = rx.get("message").and_then(Value::as_str).map(|m| u16slice(m, 2000)).unwrap_or_default();
                if users.is_empty() && user_field.is_none() {
                    c.say(&at, "personne à prévenir : « $moi » ou un champ personne");
                    continue;
                }
                let uf = user_field.flatten().map(|f| json!(f.label)).unwrap_or(Value::Null);
                actions.push(json!({ "kind": "notify", "users": users, "user_field": uf, "message": message }));
            }
            _ => c.say(&format!("{at}.kind"), &format!("action « {} » inconnue", js_string(rx.get("kind")))),
        }
    }
    if actions.is_empty() {
        c.say(&format!("{path}.actions"), "au moins une action");
        return None;
    }
    let key = ra.get("key").and_then(Value::as_str).filter(|k| KEY.is_match(k));
    let description = c.text(ra, "description", path, L_DESCRIPTION, false);
    let mut a = Raw::new();
    if let Some(k) = key {
        a.insert("key".into(), json!(k));
    }
    a.insert("label".into(), json!(label));
    if let Some(d) = description {
        a.insert("description".into(), json!(d));
    }
    a.insert("enabled".into(), json!(ra.get("enabled") != Some(&Value::Bool(false))));
    a.insert("trigger".into(), json!({ "kind": kind, "table": table_key, "fields": fields, "schedule": schedule }));
    a.insert("condition".into(), json!(condition));
    a.insert("actions".into(), Value::Array(actions));
    Some(a)
}

/// `summarizeTemplate`: a template as a gallery card shows it.
pub fn summarize_template(t: &Value) -> Map<String, Value> {
    let tables = t["tables"].as_array().cloned().unwrap_or_default();
    let fields: usize = tables.iter().map(|x| x["fields"].as_array().map_or(0, Vec::len)).sum::<usize>() + t["links"].as_array().map_or(0, Vec::len);
    let rows: usize = t["rows"].as_object().map_or(0, |r| r.values().map(|l| l.as_array().map_or(0, Vec::len)).sum());
    let ai: usize = tables.iter().map(|x| x["fields"].as_array().map_or(0, |f| f.iter().filter(|f| f.get("ai").is_some()).count())).sum();
    let opt = |k: &str| t.get(k).cloned().unwrap_or(Value::Null);
    let mut s = Map::new();
    s.insert("key".into(), t["key"].clone());
    s.insert("label".into(), t["label"].clone());
    s.insert("summary".into(), t["summary"].clone());
    s.insert("category".into(), opt("category"));
    s.insert("icon".into(), opt("icon"));
    s.insert("color".into(), opt("color"));
    s.insert("tags".into(), t["tags"].clone());
    s.insert(
        "counts".into(),
        json!({
            "tables": tables.len(), "fields": fields, "rows": rows,
            "views": t["views"].as_array().map_or(0, Vec::len),
            "automations": t["automations"].as_array().map_or(0, Vec::len),
            "ai_fields": ai,
        }),
    );
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal() -> Value {
        json!({
            "key": "essai", "label": "Essai", "summary": "Un essai",
            "tables": [{ "key": "clients", "label": "Clients", "fields": [
                { "label": "Nom", "kind": "short_text" },
                { "label": "Statut", "kind": "select", "options": ["Actif", "Ancien"] },
                { "label": "Total", "kind": "formula", "formula": "[Nom]" }
            ]}],
            "rows": { "clients": [{ "$key": "a", "Nom": "Alpha", "statut": "actif" }] },
            "views": [{ "table": "clients", "label": "Tableau", "kind": "kanban", "spec": {} }]
        })
    }

    #[test]
    fn checks_and_canonicalizes() {
        let t = check_template(&minimal()).unwrap();
        assert_eq!(t["format"], 1);
        let opts = &t["tables"][0]["fields"][1]["options"];
        assert_eq!(opts[0], json!({ "label": "Actif", "value": "actif", "color": "#94a3b8", "icon": null }));
        assert_eq!(t["rows"]["clients"][0], json!({ "$key": "a", "Nom": "Alpha", "Statut": "Actif" }));
        assert_eq!(t["views"][0]["spec"]["group_by"], "Statut");
        let s = summarize_template(&t);
        assert_eq!(s["counts"]["fields"], 3);
    }

    #[test]
    fn refuses_with_paths() {
        let issues = check_template(&json!({ "label": "x", "tables": [] })).unwrap_err();
        assert_eq!(issues[0], json!({ "path": ".key", "message": "valeur obligatoire" }));
        assert_eq!(issues[1]["path"], "tables");
        assert_eq!(check_template(&json!([])).unwrap_err()[0]["message"], "un objet JSON est attendu");
        assert_eq!(check_template(&json!({ "format": 3 })).unwrap_err()[0]["message"], "format 3 inconnu ; seuls les formats 1 et 2 existent");
    }

    #[test]
    fn helpers_read_like_javascript() {
        assert_eq!(label_key("  Écran   Été "), "ecran ete");
        assert_eq!(option_value("À faire !"), "a_faire");
        assert_eq!(option_value("!!"), "choix");
        assert_eq!(cited_labels(r#"[A]] b] & "[no]" & [C]"#), vec!["A] b".to_string(), "C".to_string()]);
        let (f, unknown) = translate_filter(r#"[Statut] = "Actif" and [X] = "Actif""#, |l| {
            (l == "Statut").then(|| Resolved { name: "statut".into(), options: Some(vec![json!({ "label": "Actif", "value": "actif" })]) })
        });
        assert_eq!(f, r#"statut = "actif" and [X] = "Actif""#);
        assert_eq!(unknown, vec!["X".to_string()]);
        let today = Local.with_ymd_and_hms(2026, 1, 31, 12, 0, 0).unwrap();
        assert_eq!(resolve_template_date("+1m", "date", today).unwrap(), "2026-03-03");
        assert_eq!(resolve_template_date("2026-02-30", "date", today), None);
        assert_eq!(resolve_template_date("2026-10-01T10:00Z", "datetime", today).unwrap(), "2026-10-01T10:00:00.000Z");
        assert_eq!(resolve_template_date("today 24:00", "datetime", today), None);
    }

    #[test]
    fn repair_keeps_what_holds() {
        let raw = json!({
            "key": "Pas Une Clé", "label": "Atelier",
            "tables": [{ "label": "Pièces", "fields": [
                { "label": "Statut", "kind": "select", "options": ["Neuve"] },
                { "label": "Photo", "kind": "image" },
                { "label": "Qté", "kind": "number" },
                { "label": "Vide", "kind": "select" },
                { "label": "Total", "kind": "rollup", "rollup": { "via": "Rien", "target": "Qté", "aggregate": "x" } }
            ]}],
            "rows": { "pieces": [{ "Statut": ["neuve"], "Qté": "3,5", "Vide": 12 }] }
        });
        assert!(check_template(&raw).is_err());
        let (t, issues) = check_template_repair(&raw).unwrap();
        // What Node's checkTemplate(raw, { repair: true }) answers.
        let node: Value = serde_json::from_str(r##"{"template":{"format":1,"key":"atelier","label":"Atelier","summary":"","tags":[],"base":{"label":"Atelier"},"tables":[{"key":"pieces","label":"Pièces","fields":[{"label":"Nom","kind":"short_text"},{"label":"Statut","kind":"select","options":[{"label":"Neuve","value":"neuve","color":"#94a3b8","icon":null}]},{"label":"Photo","kind":"url"},{"label":"Qté","kind":"number"},{"label":"Vide","kind":"short_text"}]}],"links":[],"rows":{"pieces":[{"Statut":"Neuve","Qté":3.5,"Vide":"12"}]},"views":[],"automations":[]},"issues":[{"path":"tables[0].fields[1].kind","message":"un modèle ne porte pas de fichier"},{"path":"tables[0].fields[3].options","message":"au moins un choix"},{"path":"tables[0].fields[4].rollup.aggregate","message":"agrégat attendu : count, sum, avg, min ou max"},{"path":"tables[0].fields[0]","message":"le premier champ, colonne d’affichage, est un texte, un nombre, une date, un e-mail ou une adresse"},{"path":"tables[0].fields[5].rollup.via","message":"« Rien » n’est pas une relation de cette table"}]}"##).unwrap();
        assert_eq!(serde_json::to_string(&json!({ "template": t, "issues": issues })).unwrap(), serde_json::to_string(&node).unwrap());
    }
}
