//! What an automation is (`automations/catalog.ts`): its constants, its schedules and time
//! zones, its steps as stored and as the API shows them, and reading one back.
//!
//! Steps stay JSON values in their stored form (camelCase keys: `userField`, `onError`…),
//! as Node keeps them: the API's order of keys is Node's — `jsonb`'s for what it shows as
//! read, its own for the kinds `wireSteps` rebuilds.

use basedb_base::db::Exec;
use basedb_base::error::AppError;
use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

pub const MAX_STEPS: usize = 40;
pub const MAX_DEPTH: usize = 3;
pub const MAX_PATHS: usize = 5;
pub const MAX_NOTIFIED: usize = 20;
pub const MAX_MAILED: usize = 50;
pub const MAX_CC: usize = 20;
pub const MAX_ATTACHMENTS: usize = 10;
pub const MAX_ATTACHED_BYTES: i64 = 15 * 1024 * 1024;
pub const MAX_MEASURES: usize = 5;
pub const MAX_WAIT_DAYS: f64 = 365.0;
pub const MAX_CHAIN: i64 = 3;
pub const MAX_RETRIES: f64 = 3.0;
pub const MAX_AI_OPTIONS: usize = 50;
pub const MAX_LOOP_ROWS: f64 = 200.0;
pub const DEFAULT_LOOP_ROWS: f64 = 50.0;
pub const MAX_HEADERS: usize = 20;
pub const MAX_BODY_CHARS: usize = 10_000;
/// `ai/prompt.ts`.
pub const MAX_PROMPT_CHARS: usize = 8000;
pub const MAX_VALUE_CHARS: usize = 4000;
pub const EMPTY_VALUE: &str = "(vide)";
/// `ai/answer.ts`.
pub const AI_KINDS: [&str; 7] = ["short_text", "long_text", "url", "number", "select", "boolean", "date"];

pub const TRIGGER_ROW: &str = "trigger";
pub const WEBHOOK_SECRET: &str = "automation/webhook-header";
pub const HOOK_SECRET: &str = "automation/hook";
pub const HTTP_METHODS: [&str; 5] = ["POST", "PUT", "PATCH", "GET", "DELETE"];
pub const BODY_FORMATS: [&str; 3] = ["json", "form", "text"];
pub const TRIGGERS: [&str; 8] = ["record_created", "record_updated", "schedule", "button", "record_deleted", "record_matches", "date_reached", "webhook"];
pub const VALUE_OPERATORS: [&str; 10] = ["eq", "ne", "contains", "not_contains", "gt", "gte", "lt", "lte", "empty", "not_empty"];
pub const FORBIDDEN_HEADERS: [&str; 11] = ["host", "content-length", "transfer-encoding", "connection", "keep-alive", "upgrade", "te", "trailer", "expect", "proxy-authorization", "proxy-connection"];
pub const FILE_KINDS: [&str; 2] = ["file", "image"];
pub const DATE_KINDS: [&str; 2] = ["date", "datetime"];
pub const NUMERIC_KINDS: [&str; 4] = ["number", "count", "rollup", "formula"];
pub const ORDERED_KINDS: [&str; 7] = ["number", "count", "rollup", "formula", "autonumber", "date", "datetime"];
pub const SYSTEM_SORTS: [&str; 3] = ["_id", "_created_at", "_updated_at"];

/// `hasBody`.
pub fn has_body(method: &str) -> bool {
    method != "GET" && method != "DELETE"
}

/// `MEASURE_NAMES`.
pub fn measure_name(f: &str) -> &'static str {
    match f {
        "sum" => "somme",
        "avg" => "moyenne",
        "min" => "min",
        _ => "max",
    }
}

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("regex"))
}

/// `CITATION` (global).
pub fn citation() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}")
}

/// `CITATION_AT`.
pub fn citation_at() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"^\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}")
}

pub fn uuid_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
}

/// The looser test of the engine: `/^[0-9a-f-]{36}$/i`.
pub fn loose_uuid(s: &str) -> bool {
    s.len() == 36 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

pub fn step_id_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"^[a-z][a-z0-9_]{0,31}$")
}

pub fn header_name_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,100}$")
}

pub fn time_of_day_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"^([01]\d|2[0-3]):[0-5]\d$")
}

/// `isAddress` (`mail/message.ts`).
pub fn is_address(text: &str) -> bool {
    static R: OnceLock<Regex> = OnceLock::new();
    js_len(text) <= 254 && re(&R, r#"^[^\s@<>()",;:\\\[\]]+@[^\s@<>()",;:\\\[\]]+\.[^\s@<>()",;:\\\[\]]+$"#).is_match(text)
}

// ── JavaScript string rules ─────────────────────────────────────────────────────────────

pub fn js_space(c: char) -> bool {
    c.is_whitespace() || c == '\u{feff}'
}

/// `String.prototype.trim`.
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(js_space)
}

/// `String.length`: UTF-16 code units.
pub fn js_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `.slice(0, n)` in UTF-16 code units (a character split in two is left out whole).
pub fn js_slice(s: &str, n: usize) -> String {
    let mut units = 0;
    let mut out = String::new();
    for c in s.chars() {
        units += c.len_utf16();
        if units > n {
            break;
        }
        out.push(c);
    }
    out
}

/// `[...s].slice(0, n).join('')`: code points.
pub fn chars_slice(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

/// `String(x)` of a JSON number, as JavaScript writes it.
pub fn js_number(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity".into() } else { "-Infinity".into() };
    }
    if n == n.trunc() && n.abs() < 1e21 {
        return format!("{}", n as i64);
    }
    let s = format!("{n}");
    s
}

/// `String(value)` of a JSON value.
pub fn js_string(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.as_f64().map(js_number).unwrap_or_else(|| n.to_string()),
        Value::String(s) => s.clone(),
        Value::Array(a) => a.iter().map(|x| if x.is_null() { String::new() } else { js_string(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `Number.isInteger(x)` of a JSON value, with its value.
pub fn integer_of(v: &Value) -> Option<f64> {
    let n = v.as_f64()?;
    (n.is_finite() && n == n.trunc()).then_some(n)
}

// ── Composing ───────────────────────────────────────────────────────────────────────────

/// `composeJson`: each citation replaced by what `cite` gives, told whether it stands
/// inside a string.
pub fn compose_json(template: &str, mut cite: impl FnMut(&str, bool) -> String) -> String {
    let mut out = String::new();
    let mut quoted = false;
    let mut i = 0;
    let bytes = template.as_bytes();
    while i < template.len() {
        let c = template[i..].chars().next().unwrap_or('\0');
        if c == '{' {
            if let Some(m) = citation_at().captures(&template[i..]) {
                out.push_str(&cite(m.get(1).map(|g| g.as_str()).unwrap_or(""), quoted));
                i += m.get(0).map(|g| g.end()).unwrap_or(1);
                continue;
            }
        }
        if quoted && c == '\\' {
            out.push('\\');
            i += 1;
            if i < bytes.len() {
                let next = template[i..].chars().next().unwrap_or('\0');
                out.push(next);
                i += next.len_utf8();
            }
            continue;
        }
        if c == '"' {
            quoted = !quoted;
        }
        out.push(c);
        i += c.len_utf8();
    }
    out
}

/// `formPairs`.
pub fn form_pairs(template: &str) -> Vec<(String, String)> {
    split_form(template)
        .into_iter()
        .map(|p| js_trim(p).to_string())
        .filter(|p| !p.is_empty())
        .map(|p| match p.find('=') {
            None => (p, String::new()),
            Some(at) => (js_trim(&p[..at]).to_string(), js_trim(&p[at + 1..]).to_string()),
        })
        .collect()
}

/// `split(/\r?\n|&/)`.
pub fn split_form(template: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let b = template.as_bytes();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'&' || b[i] == b'\n' {
            let end = if b[i] == b'\n' && i > start && b[i - 1] == b'\r' { i - 1 } else { i };
            out.push(&template[start..end]);
            start = i + 1;
        }
        i += 1;
    }
    out.push(&template[start..]);
    out
}

// ── Time zones ──────────────────────────────────────────────────────────────────────────

/// `new Intl.DateTimeFormat('fr', { timeZone })` does not throw.
pub fn zone_of(name: &str) -> Option<chrono_tz::Tz> {
    if let Ok(tz) = name.parse::<chrono_tz::Tz>() {
        return Some(tz);
    }
    chrono_tz::Tz::from_str_insensitive(name).ok()
}

/// `offsetOf`: local − UTC at an instant, in milliseconds.
pub fn offset_of(instant_ms: i64, timezone: &str) -> i64 {
    let Some(tz) = zone_of(timezone) else { return 0 };
    let Some(at) = Utc.timestamp_millis_opt(instant_ms).single() else { return 0 };
    use chrono::Offset;
    tz.offset_from_utc_datetime(&at.naive_utc()).fix().local_minus_utc() as i64 * 1000
}

/// `Date.UTC(y, m, d, h, min)`, months, days and hours overflowing as JavaScript's do.
pub fn date_utc(y: i64, m: i64, d: i64, h: i64, min: i64) -> i64 {
    let year = y + m.div_euclid(12);
    let month = m.rem_euclid(12) as u32 + 1;
    let Some(first) = NaiveDate::from_ymd_opt(year as i32, month, 1) else { return 0 };
    let base = first.and_hms_opt(0, 0, 0).map(|t| t.and_utc().timestamp_millis()).unwrap_or(0);
    base + (d - 1) * 86_400_000 + h * 3_600_000 + min * 60_000
}

/// `zoned` / `utcOf`: the instant a wall-clock time has in a time zone.
pub fn utc_of(y: i64, m: i64, d: i64, h: i64, min: i64, timezone: &str) -> i64 {
    let guess = date_utc(y, m, d, h, min);
    let first = guess - offset_of(guess, timezone);
    guess - offset_of(first, timezone)
}

fn parts(ms: i64) -> DateTime<Utc> {
    Utc.timestamp_millis_opt(ms).single().unwrap_or_default()
}

fn hh_mm(at: &str) -> (i64, i64) {
    let mut it = at.split(':').map(|x| x.parse::<i64>().unwrap_or(0));
    (it.next().unwrap_or(0), it.next().unwrap_or(0))
}

/// `nextRunOf(schedule, after)`: the first run strictly after `after`.
pub fn next_run_of(schedule: &Value, after_ms: i64) -> i64 {
    let at = schedule["at"].as_str().unwrap_or("09:00");
    let timezone = schedule["timezone"].as_str().unwrap_or("Europe/Paris");
    let every = schedule["every"].as_str().unwrap_or("");
    let (hh, mm) = hh_mm(at);
    let local = parts(after_ms + offset_of(after_ms, timezone));
    let (y, m, d) = (local.year() as i64, local.month0() as i64, local.day() as i64);
    if every == "hour" {
        for i in 0..=25 {
            let t = utc_of(y, m, d, local.hour() as i64 + i, mm, timezone);
            if t > after_ms {
                return t;
            }
        }
    }
    let weekday = schedule["weekday"].as_f64().unwrap_or(1.0);
    for i in 0..=8 {
        let t = utc_of(y, m, d + i, hh, mm, timezone);
        if t <= after_ms {
            continue;
        }
        if every == "week" {
            let day = parts(date_utc(y, m, d + i, 0, 0)).weekday().num_days_from_sunday();
            let wd = if day == 0 { 7 } else { day };
            if wd as f64 != weekday {
                continue;
            }
        }
        return t;
    }
    after_ms + 3_600_000
}

/// `momentOf`: the instant a date or date-and-time value comes due.
pub fn moment_of(value: &Value, kind: &str, offset_days: i64, at: &str, timezone: &str) -> Option<i64> {
    let text = value.as_str().filter(|s| !s.is_empty())?;
    if kind == "datetime" {
        let t = basedb_records_parse_date(text)?;
        return Some(t + offset_days * 86_400_000);
    }
    static R: OnceLock<Regex> = OnceLock::new();
    let m = re(&R, r"^(\d{4})-(\d{2})-(\d{2})").captures(text)?;
    let n = |i: usize| m.get(i).and_then(|g| g.as_str().parse::<i64>().ok()).unwrap_or(0);
    let (hh, mm) = hh_mm(at);
    Some(utc_of(n(1), n(2) - 1, n(3) + offset_days, hh, mm, timezone))
}

/// `Date.parse` of what PostgreSQL gives for a `timestamptz` read as JSON, or ISO text.
pub fn basedb_records_parse_date(text: &str) -> Option<i64> {
    if let Ok(t) = DateTime::parse_from_rfc3339(text) {
        return Some(t.timestamp_millis());
    }
    let normalized = text.replacen(' ', "T", 1);
    if let Ok(t) = DateTime::parse_from_rfc3339(&normalized) {
        return Some(t.timestamp_millis());
    }
    for f in ["%Y-%m-%dT%H:%M:%S%.f%#z", "%Y-%m-%dT%H:%M:%S%#z", "%Y-%m-%dT%H:%M%#z"] {
        if let Ok(t) = DateTime::parse_from_str(&normalized, f) {
            return Some(t.timestamp_millis());
        }
    }
    if let Ok(d) = NaiveDate::parse_from_str(text, "%Y-%m-%d") {
        return d.and_hms_opt(0, 0, 0).map(|t| t.and_utc().timestamp_millis());
    }
    for f in ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"] {
        if let Ok(t) = chrono::NaiveDateTime::parse_from_str(&normalized, f) {
            // A local time without zone: JavaScript reads it in the process's zone; the
            // server runs in UTC.
            return Some(t.and_utc().timestamp_millis());
        }
    }
    None
}

/// `datesDue`: the local dates whose moment falls in `(from, to]`.
pub fn dates_due(offset_days: i64, at: &str, timezone: &str, from: i64, to: i64) -> Vec<String> {
    let day = 86_400_000;
    let mut out: Vec<String> = Vec::new();
    let mut t = from - (offset_days + 2) * day;
    while t <= to - (offset_days - 2) * day {
        let iso = parts(t).format("%Y-%m-%d").to_string();
        if let Some(moment) = moment_of(&json!(iso), "date", offset_days, at, timezone) {
            if moment > from && moment <= to && !out.contains(&iso) {
                out.push(iso);
            }
        }
        t += day;
    }
    out
}

/// `toISOString()`.
pub fn iso(ms: i64) -> String {
    parts(ms).format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

pub fn add_ms(t: DateTime<Utc>, ms: i64) -> DateTime<Utc> {
    t + Duration::milliseconds(ms)
}

// ── Steps ───────────────────────────────────────────────────────────────────────────────

pub fn kind_of(step: &Value) -> &str {
    step["kind"].as_str().unwrap_or("")
}

pub fn id_of(step: &Value) -> &str {
    step["id"].as_str().unwrap_or("")
}

pub fn arr(v: &Value) -> &[Value] {
    v.as_array().map(Vec::as_slice).unwrap_or(&[])
}

/// `stepsOf`: every step of a flow, depth first.
pub fn steps_of(steps: &[Value]) -> Vec<&Value> {
    let mut out = Vec::new();
    for s in steps {
        out.push(s);
        let k = kind_of(s);
        if k == "branch" || k == "attempt" {
            for p in arr(&s["paths"]) {
                out.extend(steps_of(arr(&p["steps"])));
            }
        }
        if k == "for_each" {
            out.extend(steps_of(arr(&s["steps"])));
        }
    }
    out
}

/// Whether a flow, as given to the API, holds a step of one of `kinds` anywhere.
pub fn holds_kind(raw: &Value, kinds: &[&str]) -> bool {
    arr(raw).iter().any(|s| {
        s["kind"].as_str().is_some_and(|k| kinds.contains(&k)) || holds_kind(&s["steps"], kinds) || arr(&s["paths"]).iter().any(|p| holds_kind(&p["steps"], kinds))
    })
}

fn obj(v: &Value) -> Map<String, Value> {
    v.as_object().cloned().unwrap_or_default()
}

fn or_default(m: &mut Map<String, Value>, key: &str, default: Value) {
    let v = m.get(key).filter(|v| !v.is_null()).cloned().unwrap_or(default);
    m.insert(key.into(), v);
}

/// `storedSteps`'s `within`.
fn within(s: &Value) -> Value {
    let mut m = obj(s);
    match kind_of(s) {
        "webhook" => {
            or_default(&mut m, "method", json!("POST"));
            or_default(&mut m, "headers", json!([]));
            or_default(&mut m, "body", Value::Null);
            or_default(&mut m, "format", json!("json"));
            or_default(&mut m, "retries", json!(0));
        }
        "email" => {
            or_default(&mut m, "mode", json!("each"));
            or_default(&mut m, "cc", json!([]));
            or_default(&mut m, "replyTo", Value::Null);
            or_default(&mut m, "format", json!("text"));
            or_default(&mut m, "attachments", json!([]));
        }
        "for_each" => or_default(&mut m, "onError", json!("stop")),
        _ => {}
    }
    if let Some(steps) = s["steps"].as_array() {
        m.insert("steps".into(), Value::Array(steps.iter().map(within).collect()));
    }
    if let Some(paths) = s["paths"].as_array() {
        let paths = paths
            .iter()
            .map(|p| {
                let mut pm = obj(p);
                pm.insert("steps".into(), Value::Array(arr(&p["steps"]).iter().map(within).collect()));
                Value::Object(pm)
            })
            .collect();
        m.insert("paths".into(), Value::Array(paths));
    }
    Value::Object(m)
}

/// `storedSteps`: steps as stored, those saved before flows given their defaults.
pub fn stored_steps(raw: &Value, has_row: bool) -> Vec<Value> {
    let Some(list) = raw.as_array() else { return Vec::new() };
    list.iter()
        .enumerate()
        .map(|(index, item)| {
            let s = within(item);
            let mut m = obj(&s);
            let id = s["id"].as_str().map(str::to_string).unwrap_or_else(|| format!("e{}", index + 1));
            m.insert("id".into(), json!(id));
            match kind_of(&s) {
                "update_record" => {
                    let record = s.get("record").filter(|v| !v.is_null()).cloned().unwrap_or(json!(TRIGGER_ROW));
                    m.insert("record".into(), record);
                }
                "notify" | "webhook" => {
                    let record = match s.get("record") {
                        None => {
                            if has_row {
                                json!(TRIGGER_ROW)
                            } else {
                                Value::Null
                            }
                        }
                        Some(v) => v.clone(),
                    };
                    m.insert("record".into(), record);
                }
                _ => {}
            }
            Value::Object(m)
        })
        .collect()
}

fn put(m: &mut Map<String, Value>, key: &str, v: Option<&Value>) {
    if let Some(v) = v {
        m.insert(key.into(), v.clone());
    }
}

/// `wireSteps`: steps as the API shows them.
pub fn wire_steps(steps: &[Value]) -> Vec<Value> {
    steps
        .iter()
        .map(|s| {
            let mut m = Map::new();
            let g = |k: &str| s.get(k);
            match kind_of(s) {
                "webhook" => {
                    put(&mut m, "id", g("id"));
                    put(&mut m, "kind", g("kind"));
                    put(&mut m, "record", g("record"));
                    put(&mut m, "url", g("url"));
                    put(&mut m, "method", g("method"));
                    let headers: Vec<Value> = arr(&s["headers"])
                        .iter()
                        .map(|h| {
                            if h.get("sealed").is_some() {
                                let mut x = Map::new();
                                put(&mut x, "name", h.get("name"));
                                x.insert("value".into(), Value::Null);
                                x.insert("secret".into(), json!(true));
                                put(&mut x, "host", h.get("host"));
                                Value::Object(x)
                            } else {
                                let mut x = Map::new();
                                put(&mut x, "name", h.get("name"));
                                put(&mut x, "value", h.get("value"));
                                x.insert("secret".into(), json!(false));
                                Value::Object(x)
                            }
                        })
                        .collect();
                    m.insert("headers".into(), Value::Array(headers));
                    put(&mut m, "body", g("body"));
                    put(&mut m, "format", g("format"));
                    put(&mut m, "retries", g("retries"));
                }
                "for_each" => {
                    for k in ["id", "kind", "table", "filter", "sort", "limit"] {
                        put(&mut m, k, g(k));
                    }
                    put(&mut m, "on_error", g("onError"));
                    m.insert("steps".into(), Value::Array(wire_steps(arr(&s["steps"]))));
                }
                "wait" => {
                    for k in ["id", "kind", "duration"] {
                        put(&mut m, k, g(k));
                    }
                    let until = match s.get("until") {
                        None => None,
                        Some(Value::Null) => Some(Value::Null),
                        Some(u) => {
                            let mut x = Map::new();
                            put(&mut x, "record", u.get("record"));
                            put(&mut x, "field", u.get("field"));
                            put(&mut x, "offset_days", u.get("offsetDays"));
                            put(&mut x, "at", u.get("at"));
                            put(&mut x, "timezone", u.get("timezone"));
                            Some(Value::Object(x))
                        }
                    };
                    put(&mut m, "until", until.as_ref());
                }
                "notify" => {
                    for k in ["id", "kind", "record", "users"] {
                        put(&mut m, k, g(k));
                    }
                    put(&mut m, "user_field", g("userField"));
                    put(&mut m, "message", g("message"));
                }
                "email" => {
                    for k in ["id", "kind", "record", "users"] {
                        put(&mut m, k, g(k));
                    }
                    put(&mut m, "user_field", g("userField"));
                    put(&mut m, "email_field", g("emailField"));
                    for k in ["addresses", "subject", "message", "mode", "cc"] {
                        put(&mut m, k, g(k));
                    }
                    put(&mut m, "reply_to", g("replyTo"));
                    put(&mut m, "format", g("format"));
                    put(&mut m, "attachments", g("attachments"));
                }
                "branch" | "attempt" => {
                    put(&mut m, "id", g("id"));
                    put(&mut m, "kind", g("kind"));
                    let paths: Vec<Value> = arr(&s["paths"])
                        .iter()
                        .map(|p| {
                            let mut x = Map::new();
                            put(&mut x, "id", p.get("id"));
                            put(&mut x, "label", p.get("label"));
                            put(&mut x, "when", p.get("when"));
                            x.insert("steps".into(), Value::Array(wire_steps(arr(&p["steps"]))));
                            Value::Object(x)
                        })
                        .collect();
                    m.insert("paths".into(), Value::Array(paths));
                }
                _ => return s.clone(),
            }
            Value::Object(m)
        })
        .collect()
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────

/// `Automation`.
#[derive(Debug, Clone)]
pub struct Automation {
    pub id: String,
    pub base_id: String,
    pub label: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub trigger_kind: String,
    pub table: Option<String>,
    pub fields: Value,
    pub schedule: Value,
    /// Stored form: `{field, offsetDays, at, timezone}` or null.
    pub date: Value,
    pub condition: Option<String>,
    pub actions: Vec<Value>,
    pub owner_id: String,
    pub owner_name: String,
    pub next_run_at: Option<String>,
    pub last_run: Option<(String, String)>,
    pub created_at: String,
    pub updated_at: String,
    pub hook_sealed: Option<String>,
    pub hook_path: Option<String>,
}

impl Automation {
    /// `wireTrigger`.
    pub fn wire_trigger(&self) -> Value {
        let date = if self.date.is_null() {
            Value::Null
        } else {
            let mut x = Map::new();
            x.insert("field".into(), self.date.get("field").cloned().unwrap_or(Value::Null));
            put(&mut x, "offset_days", self.date.get("offsetDays"));
            put(&mut x, "at", self.date.get("at"));
            put(&mut x, "timezone", self.date.get("timezone"));
            Value::Object(x)
        };
        json!({ "kind": self.trigger_kind, "table": self.table, "fields": self.fields, "schedule": self.schedule, "date": date })
    }

    /// `serializeAutomation` of `app.ts`.
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "label": self.label,
            "description": self.description,
            "enabled": self.enabled,
            "trigger": self.wire_trigger(),
            "condition": self.condition,
            "actions": wire_steps(&self.actions),
            "hook": self.hook_path.as_ref().map(|p| json!({ "path": p })),
            "owner": { "id": self.owner_id, "name": self.owner_name },
            "next_run_at": self.next_run_at,
            "last_run": self.last_run.as_ref().map(|(s, a)| json!({ "status": s, "at": a })),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }

    /// `revealHook`.
    pub fn reveal(mut self, instance_key: Option<&str>) -> Self {
        if let (Some(sealed), Some(key)) = (&self.hook_sealed, instance_key) {
            if let Some(secret) = basedb_admin::sealing::unseal(key, HOOK_SECRET, sealed) {
                self.hook_path = Some(format!("/api/v1/hooks/{secret}"));
            }
        }
        self
    }
}

pub const COLUMNS: &str = "a.id::text, a.base_id::text, a.label, a.description, a.is_enabled, a.trigger_kind,
       a.table_id::text, a.trigger, a.condition, a.actions, a.owner_id::text,
       coalesce(nullif(u.display_name, ''), u.email) AS owner_name, a.next_run_at::text,
       last.status AS last_status, last.at AS last_at, a.created_at::text, a.updated_at::text,
       a.hook_sealed";
pub const FROM: &str = "FROM _basedb.automation a
       JOIN _basedb.app_user u ON u.id = a.owner_id
       LEFT JOIN LATERAL (
         SELECT r.status, coalesce(r.finished_at, r.queued_at)::text AS at
           FROM _basedb.automation_run r WHERE r.automation_id = a.id
          ORDER BY r.queued_at DESC LIMIT 1) last ON true";

/// `shaped`.
pub fn shaped(row: &tokio_postgres::Row) -> Automation {
    let trigger: Value = row.get::<_, Option<Value>>(7).unwrap_or(Value::Null);
    let table: Option<String> = row.get(6);
    let nn = |k: &str| trigger.get(k).filter(|v| !v.is_null()).cloned();
    let last_status: Option<String> = row.get(13);
    let last_at: Option<String> = row.get(14);
    Automation {
        id: row.get(0),
        base_id: row.get(1),
        label: row.get(2),
        description: row.get(3),
        enabled: row.get(4),
        trigger_kind: row.get(5),
        fields: nn("fields").unwrap_or(json!([])),
        schedule: nn("schedule").unwrap_or(Value::Null),
        date: nn("date").unwrap_or(Value::Null),
        condition: row.get(8),
        actions: stored_steps(&row.get::<_, Option<Value>>(9).unwrap_or(Value::Null), table.is_some()),
        table,
        owner_id: row.get(10),
        owner_name: row.get::<_, Option<String>>(11).unwrap_or_default(),
        next_run_at: row.get(12),
        last_run: last_status.map(|s| (s, last_at.unwrap_or_default())),
        created_at: row.get(15),
        updated_at: row.get(16),
        hook_sealed: row.get(17),
        hook_path: None,
    }
}

/// `loadAutomation`: by key, deleted ones absent.
pub async fn load_automation<E: Exec + Sync>(exec: &E, id: &str) -> Result<Option<Automation>, AppError> {
    if !uuid_re().is_match(id) {
        return Ok(None);
    }
    let row = exec.first(&format!("SELECT {COLUMNS} {FROM} WHERE a.id = $1::text::uuid AND a.deleted_at IS NULL"), &[&id]).await?;
    Ok(row.as_ref().map(shaped))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schedules_follow_the_clock() {
        let after = DateTime::parse_from_rfc3339("2025-03-29T10:00:00Z").unwrap().timestamp_millis();
        let day = json!({ "every": "day", "at": "09:00", "timezone": "Europe/Paris", "weekday": 1 });
        assert_eq!(iso(next_run_of(&day, after)), "2025-03-30T07:00:00.000Z");
        let week = json!({ "every": "week", "at": "09:00", "timezone": "Europe/Paris", "weekday": 1 });
        assert_eq!(iso(next_run_of(&week, after)), "2025-03-31T07:00:00.000Z");
        let hour = json!({ "every": "hour", "at": "09:15", "timezone": "Europe/Paris", "weekday": 1 });
        assert_eq!(iso(next_run_of(&hour, after)), "2025-03-29T10:15:00.000Z");
        assert_eq!(date_utc(2025, 0, 32, 25, 0), date_utc(2025, 1, 2, 1, 0));
    }

    #[test]
    fn dates_come_due_in_their_zone() {
        let from = DateTime::parse_from_rfc3339("2025-06-01T06:00:00Z").unwrap().timestamp_millis();
        let to = from + 3_600_000;
        assert_eq!(dates_due(0, "08:30", "Europe/Paris", from, to), vec!["2025-06-01"]);
        assert_eq!(dates_due(-1, "08:30", "Europe/Paris", from, to), vec!["2025-06-02"]);
        assert!(dates_due(0, "12:00", "Europe/Paris", from, to).is_empty());
    }

    #[test]
    fn json_and_forms_compose() {
        let out = compose_json(r#"{"a": "{{x}} \"{{y}}\"", "b": {{z}}}"#, |p, q| if q { format!("<{p}>") } else { "0".into() });
        assert_eq!(out, r#"{"a": "<x> \"<y>\"", "b": 0}"#);
        assert_eq!(form_pairs("a=1&b = 2\r\nc\n\n"), vec![("a".into(), "1".into()), ("b".into(), "2".into()), ("c".into(), String::new())]);
    }

    #[test]
    fn old_steps_get_their_defaults() {
        let steps = stored_steps(&json!([{ "kind": "webhook", "url": "https://x.fr" }, { "kind": "update_record", "values": {} }]), true);
        assert_eq!(steps[0]["record"], json!("trigger"));
        assert_eq!(steps[0]["method"], json!("POST"));
        assert_eq!(steps[1]["id"], json!("e2"));
        let wired = wire_steps(&[json!({ "id": "e1", "kind": "webhook", "headers": [{ "name": "X", "sealed": "s", "host": "h" }] })]);
        assert_eq!(wired[0]["headers"][0], json!({ "name": "X", "value": null, "secret": true, "host": "h" }));
    }
}
