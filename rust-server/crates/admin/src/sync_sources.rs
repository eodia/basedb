//! `sync/sources.ts`: the sources of a synced table — a CSV file, an iCalendar feed, a view
//! shared by a basedb, a question of insights — fetched within bounds (https, a public host,
//! 10 seconds, 5 MB, 10 000 rows; insights: 100 000) and read as columns and keyed rows.

// `AppError` (crate base) is the error of every domain: its size is shared, not this module's.
#![allow(clippy::result_large_err)]

use crate::common::{js_len, js_slice, js_trim};
use crate::insights::{call, token_for, Person};
use basedb_base::config::InsightsConfig;
use basedb_base::error::AppError;
use basedb_catalog::targets::{check_target, TargetPolicy};
use basedb_records::js::{number_json, number_string};
use basedb_records::sync_rows::SourceRow;
use chrono::{LocalResult, NaiveDate, NaiveDateTime, NaiveTime, TimeZone};
use futures_util::StreamExt;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::LazyLock;
use std::time::Duration;

pub const MAX_BYTES: usize = 5 * 1024 * 1024;
pub const MAX_ROWS: usize = 10_000;
pub const MAX_INSIGHTS_ROWS: usize = 100_000;
const TIMEOUT: Duration = Duration::from_secs(10);
const KEY_NAMES: [&str; 5] = ["id", "uid", "key", "cle", "clé"];

#[derive(Clone, Debug, PartialEq)]
pub struct SourceColumn {
    pub key: String,
    pub label: String,
    pub kind: String,
}

impl SourceColumn {
    pub fn to_json(&self) -> Value {
        json!({ "key": self.key, "label": self.label, "kind": self.kind })
    }
}

pub struct SourceData {
    pub columns: Vec<SourceColumn>,
    pub rows: Vec<SourceRow>,
}

pub fn failed(reason: &str) -> AppError {
    AppError::new("SYNC_SOURCE_FAILED").with("reason", json!(reason))
}

/// `encodeURIComponent`.
pub fn encode_uri_component(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// `fetchText`: the body of an address, within the bounds; a refusal says why.
async fn fetch_text(url: &str, targets: &TargetPolicy, accept: &str) -> Result<String, AppError> {
    let checked = check_target(url, targets).await.map_err(|_| failed("adresse_refusee"))?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| AppError::internal(e.to_string()))?;
    let response = client
        .get(checked)
        .header("accept", accept)
        .header("user-agent", "basedb-sync/1")
        .send()
        .await
        .map_err(|_| failed("injoignable"))?;
    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(failed(&format!("http_{status}")));
    }
    let mut stream = response.bytes_stream();
    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        // The deadline cuts the body too: Node's read then throws a `TimeoutError` (500).
        let chunk = chunk.map_err(|e| AppError::internal(format!("lecture de la source : {e}")))?;
        body.extend_from_slice(&chunk);
        if body.len() > MAX_BYTES {
            return Err(failed("trop_volumineuse"));
        }
    }
    let text = String::from_utf8_lossy(&body).into_owned();
    Ok(text.strip_prefix('\u{feff}').map(str::to_string).unwrap_or(text))
}

// ── Dates as V8 reads them ────────────────────────────────────────────────────────────────

/// Days since 1970-01-01 of a day whose month and day may overflow (`Date.UTC`).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let total = y * 12 + (m - 1);
    let (y, m) = (total.div_euclid(12), total.rem_euclid(12) + 1);
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468 + d - 1
}

/// The instant of a wall clock read as UTC (`m` from 0), every part free to overflow.
fn civil_ms(y: i64, m: i64, d: i64, h: i64, mi: i64, s: i64) -> i64 {
    ((days_from_civil(y, m + 1, d) * 24 + h) * 60 + mi) * 60_000 + s * 1000
}

/// `Date.UTC(y, m, d, h, mi, s)` (`m` from 0): a year 0 to 99 is 1900 to 1999.
pub fn date_utc(y: i64, m: i64, d: i64, h: i64, mi: i64, s: i64) -> i64 {
    civil_ms(if (0..=99).contains(&y) { 1900 + y } else { y }, m, d, h, mi, s)
}

/// `new Date(ms).toISOString()`; `None` past its range (`RangeError`).
pub fn iso_of(ms: i64) -> Option<String> {
    if ms.abs() > 8_640_000_000_000_000 {
        return None;
    }
    let at = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms)?;
    Some(basedb_catalog::field_config::js_iso(at))
}

/// The local wall clock as an instant, as V8 reads it: a time the clocks skip is read with
/// the offset before the change.
fn local_ms(naive: NaiveDateTime) -> Option<i64> {
    match chrono::Local.from_local_datetime(&naive) {
        LocalResult::Single(t) => Some(t.timestamp_millis()),
        LocalResult::Ambiguous(a, _) => Some(a.timestamp_millis()),
        LocalResult::None => {
            let before = chrono::Local.from_local_datetime(&(naive - chrono::Duration::hours(1))).earliest()?;
            Some(before.timestamp_millis() + 3_600_000)
        }
    }
}

/// `new Date(text).getTime()` for what a source calls a date-time: `YYYY-MM-DDTHH:MM[:SS[.f]]`
/// then `Z`, `±HH:MM`, `±HHMM` or nothing (the local time). V8 lets the day run to 31 in any
/// month and rolls it over, takes `24:00` for the next midnight, keeps the milliseconds.
pub fn js_datetime_ms(text: &str) -> Option<i64> {
    static FORM: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?$").unwrap()
    });
    let c = FORM.captures(text)?;
    let num = |i: usize| -> i64 { c.get(i).map_or(0, |m| m.as_str().parse().unwrap_or(0)) };
    let (y, mo, d, h, mi, s) = (num(1), num(2), num(3), num(4), num(5), num(6));
    let ms: i64 = c.get(7).map_or(0, |m| format!("{:0<3}", &m.as_str()[..m.as_str().len().min(3)]).parse().unwrap_or(0));
    if !(1..=12).contains(&mo) || !(1..=31).contains(&d) || mi > 59 || s > 59 || h > 24 || (h == 24 && (mi, s, ms) != (0, 0, 0)) {
        return None;
    }
    let wall = civil_ms(y, mo - 1, d, h, mi, s) + ms;
    match c.get(8).map(|m| m.as_str()) {
        Some("Z") => Some(wall),
        Some(zone) => {
            let digits: String = zone[1..].chars().filter(char::is_ascii_digit).collect();
            let (oh, om): (i64, i64) = (digits[..2].parse().ok()?, digits[2..].parse().ok()?);
            if oh > 23 || om > 59 {
                return None;
            }
            let sign = if zone.starts_with('-') { -1 } else { 1 };
            Some(wall - sign * (oh * 60 + om) * 60_000)
        }
        None => {
            let days = wall.div_euclid(86_400_000);
            let date = NaiveDate::from_ymd_opt(1970, 1, 1)?.checked_add_signed(chrono::Duration::days(days))?;
            let rest = wall.rem_euclid(86_400_000);
            let time = NaiveTime::from_num_seconds_from_midnight_opt((rest / 1000) as u32, ((rest % 1000) * 1_000_000) as u32)?;
            local_ms(NaiveDateTime::new(date, time))
        }
    }
}

// ── Time zones as `Intl` knows them ───────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug)]
pub enum Zone {
    Named(chrono_tz::Tz),
    /// Minutes east of UTC.
    Fixed(i64),
}

/// `new Intl.DateTimeFormat('en', { timeZone })` does not throw: an IANA name, its case
/// ignored, or an offset `±HH[[:]MM]`.
pub fn intl_zone(name: &str) -> Option<Zone> {
    static OFFSET: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^([+-])([01]\d|2[0-3])(?::?([0-5]\d))?$").unwrap());
    if let Some(c) = OFFSET.captures(name) {
        let minutes: i64 = c[2].parse::<i64>().ok()? * 60 + c.get(3).map_or(0, |m| m.as_str().parse().unwrap_or(0));
        return Some(Zone::Fixed(if &c[1] == "-" { -minutes } else { minutes }));
    }
    chrono_tz::TZ_VARIANTS.iter().find(|tz| tz.name().eq_ignore_ascii_case(name) && tz.name() != "Factory").map(|tz| Zone::Named(*tz))
}

/// `offsetOf` of `automations/catalog.ts`, in milliseconds.
fn offset_of(instant: i64, zone: Zone) -> Option<i64> {
    match zone {
        Zone::Fixed(minutes) => Some(minutes * 60_000),
        Zone::Named(tz) => {
            use chrono::Offset;
            let at = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(instant)?;
            Some(tz.offset_from_utc_datetime(&at.naive_utc()).fix().local_minus_utc() as i64 * 1000)
        }
    }
}

/// `utcOf`: the instant a wall-clock time has in a zone (the offset guessed twice, for the
/// day the clocks change).
fn utc_of(y: i64, m: i64, d: i64, h: i64, mi: i64, zone: Zone) -> Option<i64> {
    let guess = date_utc(y, m, d, h, mi, 0);
    let first = guess - offset_of(guess, zone)?;
    Some(guess - offset_of(first, zone)?)
}

// ── CSV ───────────────────────────────────────────────────────────────────────────────────

/// `parseCsv`: rows of a CSV text, RFC 4180, the separator guessed from the first line.
pub fn parse_csv(text: &str) -> Vec<Vec<String>> {
    let first_line = match text.find('\n') {
        Some(i) if i > 0 && text.as_bytes()[i - 1] == b'\r' => &text[..i - 1],
        Some(i) => &text[..i],
        None => text,
    };
    let mut separator = ',';
    let mut best = first_line.split(',').count();
    for s in [';', '\t'] {
        let n = first_line.split(s).count();
        if n > best {
            best = n;
            separator = s;
        }
    }
    let chars: Vec<char> = text.chars().collect();
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut row: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if quoted {
            if c == '"' {
                if chars.get(i + 1) == Some(&'"') {
                    field.push('"');
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                field.push(c);
            }
        } else if c == '"' && field.is_empty() {
            quoted = true;
        } else if c == separator {
            row.push(std::mem::take(&mut field));
        } else if c == '\n' || c == '\r' {
            if c == '\r' && chars.get(i + 1) == Some(&'\n') {
                i += 1;
            }
            row.push(std::mem::take(&mut field));
            if row.iter().any(|v| !v.is_empty()) {
                rows.push(std::mem::take(&mut row));
            } else {
                row.clear();
            }
        } else {
            field.push(c);
        }
        i += 1;
    }
    row.push(field);
    if row.iter().any(|v| !v.is_empty()) {
        rows.push(row);
    }
    rows
}

static NUMBER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^-?\d+(?:[.,]\d+)?$").unwrap());
static DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap());
static DATETIME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$").unwrap());

fn ascii_digits(re: &Regex, v: &str) -> bool {
    // JavaScript's `\d` is ASCII; the regex crate's is Unicode.
    re.is_match(v) && v.chars().all(|c| c.is_ascii() || !c.is_numeric())
}

fn kind_of(values: &[&str]) -> &'static str {
    let filled: Vec<&str> = values.iter().map(|v| js_trim(v)).filter(|v| !v.is_empty()).collect();
    if filled.is_empty() {
        return "short_text";
    }
    if filled.iter().all(|v| ascii_digits(&NUMBER, v)) {
        return "number";
    }
    if filled.iter().all(|v| ascii_digits(&DATE, v)) {
        return "date";
    }
    if filled.iter().all(|v| ascii_digits(&DATETIME, v)) {
        return "datetime";
    }
    if filled.iter().any(|v| js_len(v) > 255 || v.contains('\n')) {
        "long_text"
    } else {
        "short_text"
    }
}

fn cell_of(raw: &str, kind: &str) -> Result<Value, AppError> {
    let v = js_trim(raw);
    if v.is_empty() {
        return Ok(Value::Null);
    }
    Ok(match kind {
        "number" => number_json(v.replacen(',', ".", 1).parse::<f64>().unwrap_or(f64::NAN)),
        "datetime" => {
            let at = js_datetime_ms(&v.replacen(' ', "T", 1)).and_then(iso_of);
            Value::from(at.ok_or_else(|| AppError::internal("RangeError: Invalid time value"))?)
        }
        "long_text" => Value::from(raw),
        _ => Value::from(v),
    })
}

/// `uniqueLabels`: never empty, never twice (case ignored) — they become the table's fields.
pub fn unique_labels(labels: &[String]) -> Vec<String> {
    let mut seen: HashMap<String, usize> = HashMap::new();
    labels
        .iter()
        .enumerate()
        .map(|(index, raw)| {
            let trimmed = js_slice(js_trim(raw), 200);
            let base = if trimmed.is_empty() { format!("Colonne {}", index + 1) } else { trimmed.to_string() };
            let n = seen.entry(base.to_lowercase()).or_insert(0);
            *n += 1;
            if *n == 1 {
                base
            } else {
                format!("{base} ({n})")
            }
        })
        .collect()
}

/// `uniqueKeys`: a key seen twice keeps its first row, the next one is set apart (`#n`).
pub fn unique_keys(rows: Vec<SourceRow>) -> Vec<SourceRow> {
    let mut seen: HashMap<String, usize> = HashMap::new();
    rows.into_iter()
        .map(|row| {
            let n = seen.entry(row.key.clone()).or_insert(0);
            *n += 1;
            if *n == 1 {
                row
            } else {
                SourceRow { key: format!("{}#{n}", row.key), values: row.values }
            }
        })
        .collect()
}

pub fn read_csv(text: &str) -> Result<SourceData, AppError> {
    let mut all = parse_csv(text).into_iter();
    let Some(header) = all.next() else { return Err(failed("fichier_vide")) };
    let body: Vec<Vec<String>> = all.collect();
    if body.len() > MAX_ROWS {
        return Err(failed("trop_de_lignes"));
    }
    let labels = unique_labels(&header);
    let columns: Vec<SourceColumn> = labels
        .into_iter()
        .enumerate()
        .map(|(i, label)| {
            let values: Vec<&str> = body.iter().map(|r| r.get(i).map_or("", String::as_str)).collect();
            SourceColumn { key: format!("c{i}"), label, kind: kind_of(&values).into() }
        })
        .collect();
    let key_index = header.iter().position(|h| KEY_NAMES.contains(&js_trim(h).to_lowercase().as_str())).unwrap_or(0);
    let mut rows = Vec::with_capacity(body.len());
    for (index, r) in body.iter().enumerate() {
        let key = js_trim(r.get(key_index).map_or("", String::as_str));
        let mut values = Map::new();
        for (i, c) in columns.iter().enumerate() {
            values.insert(c.key.clone(), cell_of(r.get(i).map_or("", String::as_str), &c.kind)?);
        }
        rows.push(SourceRow { key: if key.is_empty() { format!("ligne-{}", index + 1) } else { key.to_string() }, values });
    }
    Ok(SourceData { columns, rows: unique_keys(rows) })
}

// ── iCalendar (`integrations/ical.ts`) ────────────────────────────────────────────────────

pub struct ParsedEvent {
    pub uid: String,
    pub summary: String,
    pub description: String,
    pub location: String,
    pub start: Option<String>,
    pub end: Option<String>,
}

fn unescape_text(value: &str) -> String {
    let mut out = String::new();
    let mut chars = value.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.peek() {
                Some('n') | Some('N') => {
                    chars.next();
                    out.push('\n');
                    continue;
                }
                Some(&e @ ('\\' | ';' | ',')) => {
                    chars.next();
                    out.push(e);
                    continue;
                }
                _ => {}
            }
        }
        out.push(c);
    }
    out
}

/// `instantOf`: a date or a date-time of the format, with its parameters, as an ISO instant.
fn instant_of(value: &str, params: &HashMap<String, String>) -> Result<Option<String>, AppError> {
    static DAY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})(\d{2})(\d{2})$").unwrap());
    static TIME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$").unwrap());
    if !value.is_ascii() {
        return Ok(None);
    }
    if let Some(c) = DAY.captures(value) {
        return Ok(Some(format!("{}-{}-{}T00:00:00.000Z", &c[1], &c[2], &c[3])));
    }
    let Some(c) = TIME.captures(value) else { return Ok(None) };
    let n = |i: usize| -> i64 { c[i].parse().unwrap_or(0) };
    let (y, mo, d, h, mi, s) = (n(1), n(2) - 1, n(3), n(4), n(5), n(6));
    let plain = || date_utc(y, mo, d, h, mi, s);
    let ms = match params.get("TZID") {
        Some(zone) if &c[7] != "Z" => match intl_zone(zone).and_then(|z| utc_of(y, mo, d, h, mi, z)) {
            Some(at) => at + s * 1000,
            None => plain(),
        },
        _ => plain(),
    };
    iso_of(ms).map(Some).ok_or_else(|| AppError::internal("RangeError: Invalid time value"))
}

/// `parseIcs`: the events of an agenda — anything else in it is ignored.
pub fn parse_ics(text: &str) -> Result<Vec<ParsedEvent>, AppError> {
    static FOLD: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\r?\n[ \t]").unwrap());
    static LINE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\r?\n").unwrap());
    let unfolded = FOLD.replace_all(text, "");
    let mut events = Vec::new();
    type Props = HashMap<String, (String, HashMap<String, String>)>;
    let mut current: Option<Props> = None;
    for line in LINE.split(&unfolded) {
        if line == "BEGIN:VEVENT" {
            current = Some(HashMap::new());
            continue;
        }
        if line == "END:VEVENT" {
            if let Some(props) = current.take() {
                let text_of = |k: &str| unescape_text(props.get(k).map_or("", |p| p.0.as_str()));
                let moment = |k: &str| -> Result<Option<String>, AppError> {
                    match props.get(k) {
                        None => Ok(None),
                        Some((v, params)) => instant_of(v, params),
                    }
                };
                events.push(ParsedEvent {
                    uid: text_of("UID"),
                    summary: text_of("SUMMARY"),
                    description: text_of("DESCRIPTION"),
                    location: text_of("LOCATION"),
                    start: moment("DTSTART")?,
                    end: moment("DTEND")?,
                });
            }
            continue;
        }
        let Some(props) = current.as_mut() else { continue };
        let Some(colon) = line.find(':') else { continue };
        let mut parts = line[..colon].split(';');
        let name = parts.next().unwrap_or("");
        let mut params = HashMap::new();
        for p in parts {
            if let Some(eq) = p.find('=').filter(|&e| e > 0) {
                let mut v = &p[eq + 1..];
                v = v.strip_prefix('"').unwrap_or(v);
                v = v.strip_suffix('"').unwrap_or(v);
                params.insert(p[..eq].to_uppercase(), v.to_string());
            }
        }
        props.insert(name.to_uppercase(), (line[colon + 1..].to_string(), params));
    }
    for e in &mut events {
        if e.uid.is_empty() {
            e.uid = format!("{}|{}", e.start.as_deref().unwrap_or(""), e.summary);
        }
    }
    Ok(events)
}

pub fn read_ics(text: &str) -> Result<SourceData, AppError> {
    if !text.contains("BEGIN:VCALENDAR") {
        return Err(failed("agenda_illisible"));
    }
    let events = parse_ics(text)?;
    if events.len() > MAX_ROWS {
        return Err(failed("trop_de_lignes"));
    }
    let or_null = |s: &str| if s.is_empty() { Value::Null } else { Value::from(s) };
    let rows = events
        .into_iter()
        .map(|e| {
            let mut values = Map::new();
            values.insert("summary".into(), or_null(js_slice(&e.summary, 255)));
            values.insert("start".into(), e.start.map_or(Value::Null, Value::from));
            values.insert("end".into(), e.end.map_or(Value::Null, Value::from));
            values.insert("location".into(), or_null(js_slice(&e.location, 255)));
            values.insert("description".into(), or_null(&e.description));
            SourceRow { key: e.uid, values }
        })
        .collect();
    let column = |key: &str, label: &str, kind: &str| SourceColumn { key: key.into(), label: label.into(), kind: kind.into() };
    let columns = vec![
        column("summary", "Titre", "short_text"),
        column("start", "Début", "datetime"),
        column("end", "Fin", "datetime"),
        column("location", "Lieu", "short_text"),
        column("description", "Description", "long_text"),
    ];
    Ok(SourceData { columns, rows: unique_keys(rows) })
}

// ── A view shared by a basedb ─────────────────────────────────────────────────────────────

fn shared_kind(kind: &str) -> &'static str {
    match kind {
        "number" | "rollup" | "count" | "autonumber" => "number",
        "date" => "date",
        "datetime" => "datetime",
        "long_text" => "long_text",
        _ => "short_text",
    }
}

/// `String(value)` of a JSON value.
fn js_string(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.as_f64().map(number_string).unwrap_or_else(|| n.to_string()),
        Value::Array(a) => a.iter().map(|x| if x.is_null() { String::new() } else { js_string(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `Number(value)`; `None` for `NaN`.
fn js_number(v: &Value) -> Option<f64> {
    match v {
        Value::Null => Some(0.0),
        Value::Bool(b) => Some(f64::from(u8::from(*b))),
        Value::Number(n) => n.as_f64(),
        Value::Object(_) => None,
        Value::Array(a) if a.len() > 1 => None,
        other => {
            let text = js_string(other);
            let t = js_trim(&text);
            if t.is_empty() {
                return Some(0.0);
            }
            let lower = t.to_ascii_lowercase();
            for (prefix, radix) in [("0x", 16), ("0o", 8), ("0b", 2)] {
                if let Some(digits) = lower.strip_prefix(prefix) {
                    return u64::from_str_radix(digits, radix).ok().map(|n| n as f64);
                }
            }
            match t {
                "Infinity" | "+Infinity" => Some(f64::INFINITY),
                "-Infinity" => Some(f64::NEG_INFINITY),
                _ if t.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | 'e' | 'E' | '+' | '-')) => t.parse().ok(),
                _ => None,
            }
        }
    }
}

fn shared_text(value: &Value, options: Option<&Vec<Value>>) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(s) if s.is_empty() => None,
        Value::Array(a) => {
            let parts: Vec<String> = a.iter().filter_map(|v| shared_text(v, options)).collect();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join(", "))
            }
        }
        Value::Object(o) => Some(match o.get("display") {
            Some(d) => if d.is_null() { String::new() } else { js_string(d) },
            None => o.get("name").filter(|n| !n.is_null()).map(js_string).unwrap_or_default(),
        }),
        Value::Bool(b) => Some(if *b { "Oui" } else { "Non" }.into()),
        _ => {
            let option = options.and_then(|o| o.iter().find(|o| o.get("value") == Some(value)));
            match option.and_then(|o| o.get("label")).filter(|l| !l.is_null()) {
                Some(label) => Some(js_string(label)),
                None => Some(js_string(value)),
            }
        }
    }
}

/// `sharedViewApi`: the API address of a shared view, from its page link or its API link.
pub fn shared_view_api(url: &str) -> Result<String, AppError> {
    static PAGE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^/v/([A-Za-z0-9_-]{16,})/?$").unwrap());
    static API: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^/api/v1/views/[A-Za-z0-9_-]{16,}/?$").unwrap());
    let parsed = url::Url::parse(url).map_err(|_| AppError::internal("TypeError: Invalid URL"))?;
    let origin = parsed.origin().ascii_serialization();
    let path = parsed.path();
    if let Some(c) = PAGE.captures(path) {
        return Ok(format!("{origin}/api/v1/views/{}", &c[1]));
    }
    if API.is_match(path) {
        return Ok(format!("{origin}{}", path.strip_suffix('/').unwrap_or(path)));
    }
    Err(failed("lien_de_vue_attendu"))
}

fn type_error(what: &str) -> AppError {
    AppError::internal(format!("TypeError: {what}"))
}

pub async fn read_shared_view(url: &str, targets: &TargetPolicy) -> Result<SourceData, AppError> {
    let api = shared_view_api(url)?;
    let mut pages: Vec<Value> = Vec::new();
    let mut total = 0usize;
    let mut next: Option<String> = None;
    loop {
        let address = match &next {
            None => api.clone(),
            Some(n) => format!("{api}/rows?after={}", encode_uri_component(n)),
        };
        let text = fetch_text(&address, targets, "application/json").await?;
        let body: Value = serde_json::from_str(&text).map_err(|e| AppError::internal(format!("SyntaxError: {e}")))?;
        let Some(data) = body.get("data").cloned() else { return Err(failed("vue_illisible")) };
        let meta_next = body.get("meta").and_then(|m| m.get("next_cursor")).filter(|v| !v.is_null());
        let data_next = || data.get("next_cursor").filter(|v| !v.is_null());
        if data.is_null() && meta_next.is_none() {
            return Err(type_error("Cannot read properties of null (reading 'next_cursor')"));
        }
        next = meta_next.or_else(data_next).map(js_string);
        total += match data.get("rows") {
            Some(Value::Array(a)) => a.len(),
            Some(Value::String(s)) => js_len(s),
            _ => return Err(type_error("Cannot read properties of undefined (reading 'length')")),
        };
        pages.push(data);
        if total > MAX_ROWS {
            return Err(failed("trop_de_lignes"));
        }
        if next.is_none() {
            break;
        }
    }
    let fields: Vec<Value> = pages[0].get("fields").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut raw_labels = Vec::with_capacity(fields.len());
    for f in &fields {
        match f.get("label") {
            Some(Value::String(s)) => raw_labels.push(s.clone()),
            _ => return Err(type_error("raw.trim is not a function")),
        }
    }
    let labels = unique_labels(&raw_labels);
    let columns: Vec<SourceColumn> = fields
        .iter()
        .zip(labels)
        .map(|(f, label)| {
            let computed = f.get("computed").filter(|c| !c.is_null());
            let kind = if computed.and_then(|c| c.get("multiple")) == Some(&Value::Bool(true)) {
                "short_text"
            } else {
                let kind = computed.and_then(|c| c.get("result_kind")).filter(|k| !k.is_null()).or_else(|| f.get("kind"));
                shared_kind(kind.and_then(Value::as_str).unwrap_or(""))
            };
            SourceColumn { key: f.get("name").map(js_string).unwrap_or_else(|| "undefined".into()), label, kind: kind.into() }
        })
        .collect();
    let mut rows = Vec::new();
    for page in &pages {
        let Some(Value::Array(page_rows)) = page.get("rows") else { continue };
        for row in page_rows {
            let key = match row.get("_id") {
                None | Some(Value::Null) => String::new(),
                Some(v) => js_string(v),
            };
            let mut values = Map::new();
            for (i, c) in columns.iter().enumerate() {
                let raw = row.get(&c.key);
                let value = match c.kind.as_str() {
                    "number" => match raw {
                        Some(Value::Number(n)) => Value::Number(n.clone()),
                        None | Some(Value::Null) => Value::Null,
                        Some(Value::String(s)) if s.is_empty() => Value::Null,
                        Some(v) => js_number(v).map_or(Value::Null, number_json),
                    },
                    "date" | "datetime" => raw.filter(|v| v.is_string()).cloned().unwrap_or(Value::Null),
                    _ => {
                        let options = fields.get(i).and_then(|f| f.get("options")).and_then(Value::as_array);
                        raw.and_then(|v| shared_text(v, options)).map_or(Value::Null, Value::from)
                    }
                };
                values.insert(c.key.clone(), value);
            }
            if !key.is_empty() {
                rows.push(SourceRow { key, values });
            }
        }
    }
    Ok(SourceData { columns, rows: unique_keys(rows) })
}

// ── A question of insights ────────────────────────────────────────────────────────────────

pub struct InsightsSource<'a> {
    pub config: &'a InsightsConfig,
    pub person: Person,
    pub question: String,
    pub parameters: Option<Value>,
}

fn insights_kind(kind: &str, values: &[&Value]) -> &'static str {
    match kind {
        "number" => "number",
        "date" => "date",
        "datetime" | "timestamp" => "datetime",
        _ if values.iter().any(|v| v.as_str().is_some_and(|s| js_len(s) > 255 || s.contains('\n'))) => "long_text",
        _ => "short_text",
    }
}

fn insights_cell(value: Option<&Value>, kind: &str) -> Value {
    let value = match value {
        None | Some(Value::Null) => return Value::Null,
        Some(Value::String(s)) if s.is_empty() => return Value::Null,
        Some(v) => v,
    };
    match kind {
        "number" => js_number(value).filter(|n| n.is_finite()).map_or(Value::Null, number_json),
        "date" => Value::from(js_slice(&js_string(value), 10)),
        "datetime" => js_datetime_ms(&js_string(value).replacen(' ', "T", 1)).and_then(iso_of).map_or(Value::Null, Value::from),
        _ => {
            if let Value::Bool(b) = value {
                return Value::from(if *b { "Oui" } else { "Non" });
            }
            let text = if value.is_object() || value.is_array() { value.to_string() } else { js_string(value) };
            Value::from(if kind == "short_text" { js_slice(&text, 255).to_string() } else { text })
        }
    }
}

/// `readInsights`: the saved question run afresh as the person, every row of it.
pub async fn read_insights(source: &InsightsSource<'_>) -> Result<SourceData, AppError> {
    let body = match &source.parameters {
        None => json!({}),
        Some(p) => json!({ "parameters": p }),
    };
    let token = token_for(source.config, &source.person, 300);
    let path = format!("/api/v1/questions/{}/dataset", encode_uri_component(&source.question));
    let data = call(source.config, &token, reqwest::Method::POST, &path, Some(&body)).await.map_err(|e| if e.code == "RESOURCE_NOT_FOUND" { failed("question_introuvable") } else { e })?;
    let rows: Vec<Value> = match data.get("rows") {
        Some(Value::Array(a)) => a.clone(),
        _ => return Err(type_error("Cannot read properties of undefined (reading 'length')")),
    };
    let truthy = |v: Option<&Value>| match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    };
    if truthy(data.get("truncated")) || rows.len() > MAX_INSIGHTS_ROWS {
        return Err(failed("trop_de_lignes"));
    }
    let columns_raw: Vec<Value> = data.get("columns").and_then(Value::as_array).cloned().ok_or_else(|| type_error("data.columns.map is not a function"))?;
    let text_or = |c: &Value, k: &str| c.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let labels = unique_labels(&columns_raw.iter().map(|c| {
        let label = text_or(c, "label");
        if label.is_empty() { text_or(c, "name") } else { label }
    }).collect::<Vec<_>>());
    let columns: Vec<SourceColumn> = columns_raw
        .iter()
        .zip(labels)
        .enumerate()
        .map(|(i, (c, label))| {
            let values: Vec<&Value> = rows.iter().map(|r| r.get(i).unwrap_or(&Value::Null)).collect();
            SourceColumn { key: text_or(c, "name"), label, kind: insights_kind(&text_or(c, "type"), &values).into() }
        })
        .collect();
    let key_index = columns_raw.iter().position(|c| KEY_NAMES.contains(&text_or(c, "name").to_lowercase().as_str()));
    let rows = rows
        .iter()
        .enumerate()
        .map(|(index, r)| {
            let key = match key_index.and_then(|k| r.get(k)) {
                None | Some(Value::Null) => String::new(),
                Some(v) => js_string(v),
            };
            let values = columns.iter().enumerate().map(|(i, c)| (c.key.clone(), insights_cell(r.get(i), &c.kind))).collect();
            SourceRow { key: if key.is_empty() { format!("ligne-{}", index + 1) } else { key }, values }
        })
        .collect();
    Ok(SourceData { columns, rows: unique_keys(rows) })
}

/// `readSource`: a source, fetched and read.
pub async fn read_source(kind: &str, url: &str, targets: &TargetPolicy, insights: Option<InsightsSource<'_>>) -> Result<SourceData, AppError> {
    match kind {
        "csv" => read_csv(&fetch_text(url, targets, "text/csv, text/plain;q=0.8, */*;q=0.1").await?),
        "ics" => read_ics(&fetch_text(url, targets, "text/calendar, */*;q=0.1").await?),
        "basedb" => read_shared_view(url, targets).await,
        "insights" => match insights {
            None => Err(failed("insights_non_configure")),
            Some(source) => read_insights(&source).await,
        },
        other => Err(AppError::internal(format!("source inconnue : {other}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys(rows: &[SourceRow]) -> Vec<&str> {
        rows.iter().map(|r| r.key.as_str()).collect()
    }

    #[test]
    fn csv_reads_like_rfc_4180_with_its_separator_guessed() {
        assert_eq!(parse_csv("a;b,c;d\r\n1;\"x;\"\"y\"\"\"\n\n;\n2;z"), vec![vec!["a", "b,c", "d"], vec!["1", "x;\"y\""], vec!["2", "z"]]);
        assert_eq!(parse_csv("a\tb\n1\t2")[1], vec!["1", "2"]);
        // A tie keeps the comma.
        assert_eq!(parse_csv("a,b;c\n1,2;3")[1], vec!["1", "2;3"]);
        assert_eq!(parse_csv("x\"y\",z"), vec![vec!["x\"y\"", "z"]]);
    }

    #[test]
    fn csv_columns_are_typed_and_rows_keyed() {
        let data = read_csv("Nom,ID,n,d,t,Nom\nA, k1 ,\"1,5\",2024-01-02,2024-01-02 10:00Z,\nB,k1,-3,,2024-01-02T10:00:00.5+0200,x\nC,,7,2024-02-30,,\n").unwrap();
        let kinds: Vec<&str> = data.columns.iter().map(|c| c.kind.as_str()).collect();
        assert_eq!(kinds, ["short_text", "short_text", "number", "date", "datetime", "short_text"]);
        assert_eq!(data.columns[5].label, "Nom (2)");
        assert_eq!(keys(&data.rows), ["k1", "k1#2", "ligne-3"]);
        assert_eq!(data.rows[0].values["c2"], json!(1.5));
        assert_eq!(data.rows[1].values["c2"], json!(-3));
        assert_eq!(data.rows[0].values["c4"], json!("2024-01-02T10:00:00.000Z"));
        assert_eq!(data.rows[1].values["c4"], json!("2024-01-02T08:00:00.500Z"));
        assert_eq!(data.rows[2].values["c3"], json!("2024-02-30"));
        assert_eq!(data.rows[2].values["c5"], Value::Null);
        assert!(read_csv("").is_err());
        assert_eq!(read_csv("a\n2024-01-02T25:00Z").map(|_| ()).unwrap_err().code, "INTERNAL_ERROR");
        assert_eq!(unique_labels(&[" ".into(), "a".into(), "A".into()]), ["Colonne 1", "a", "A (2)"]);
    }

    #[test]
    fn dates_are_read_as_v8_reads_them() {
        let iso = |t: &str| js_datetime_ms(t).and_then(iso_of);
        assert_eq!(iso("2024-02-30T10:00Z").as_deref(), Some("2024-03-01T10:00:00.000Z"));
        assert_eq!(iso("2024-01-02T24:00+0100").as_deref(), Some("2024-01-02T23:00:00.000Z"));
        assert_eq!(iso("2024-01-02T10:00-09:30").as_deref(), Some("2024-01-02T19:30:00.000Z"));
        assert_eq!(iso("2024-01-02T10:00:00.123456789012Z").as_deref(), Some("2024-01-02T10:00:00.123Z"));
        assert_eq!(iso("0050-01-02T10:00Z").as_deref(), Some("0050-01-02T10:00:00.000Z"));
        for bad in ["2024-02-32T10:00Z", "2024-13-01T10:00Z", "2024-01-02T24:01Z", "2024-01-02T10:00+2400", "2024-01-02T10:00+0260"] {
            assert_eq!(iso(bad), None, "{bad}");
        }
        assert_eq!(iso_of(date_utc(50, 0, 1, 0, 0, 0)).as_deref(), Some("1950-01-01T00:00:00.000Z"));
    }

    #[test]
    fn time_zones_are_those_intl_knows() {
        for ok in ["UTC", "utc", "europe/paris", "+01", "+0100", "-14:00", "+23:59", "Etc/GMT+1", "EST5EDT"] {
            assert!(intl_zone(ok).is_some(), "{ok}");
        }
        for bad in ["GMT+1", "Factory", "", "+24:00", "01:00", "+1:00", " Europe/Paris", "UTC+1"] {
            assert!(intl_zone(bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn agendas_are_read_with_their_zones() {
        let text = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\\,1\r\nSUMMARY:R\u{e9}union\\n\r\n  longue\r\nDTSTART;TZID=\"Europe/Paris\":20240702T100000\r\nDTEND;VALUE=DATE:20240703\r\nLOCATION:Salle\\; B\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Sans\r\nDTSTART;TZID=Nulle/Part:20240102T100000\r\nDTEND:20240102T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        let data = read_ics(text).unwrap();
        assert_eq!(keys(&data.rows), ["a,1", "2024-01-02T10:00:00.000Z|Sans"]);
        let first = &data.rows[0].values;
        assert_eq!(first["summary"], json!("Réunion\n longue"));
        assert_eq!(first["start"], json!("2024-07-02T08:00:00.000Z"));
        assert_eq!(first["end"], json!("2024-07-03T00:00:00.000Z"));
        assert_eq!(first["location"], json!("Salle; B"));
        assert_eq!(first["description"], Value::Null);
        assert_eq!(data.rows[1].values["end"], json!("2024-01-02T11:00:00.000Z"));
        assert!(read_ics("BEGIN:VEVENT").is_err());
    }

    #[test]
    fn shared_views_are_reached_by_their_api() {
        assert_eq!(shared_view_api("https://h.example/v/abcdefghijklmnop/").unwrap(), "https://h.example/api/v1/views/abcdefghijklmnop");
        assert_eq!(shared_view_api("http://h:81/api/v1/views/abcdefghijklmnopq/?x=1").unwrap(), "http://h:81/api/v1/views/abcdefghijklmnopq");
        assert_eq!(shared_view_api("https://h/v/short").unwrap_err().details["reason"], json!("lien_de_vue_attendu"));
        let options = vec![json!({ "value": "a", "label": "Alpha" })];
        assert_eq!(shared_text(&json!(["a", null, { "display": "D" }, true]), Some(&options)).as_deref(), Some("Alpha, D, Oui"));
        assert_eq!(shared_text(&json!([]), None), None);
        assert_eq!(shared_text(&json!({ "name": null }), None).as_deref(), Some(""));
        assert_eq!(insights_cell(Some(&json!({ "a": 1 })), "short_text"), json!("{\"a\":1}"));
        assert_eq!(insights_cell(Some(&json!("x")), "number"), Value::Null);
        assert_eq!(insights_cell(Some(&json!("2024-01-02 10:00:00Z")), "datetime"), json!("2024-01-02T10:00:00.000Z"));
        assert_eq!(encode_uri_component("a b/é~"), "a%20b%2F%C3%A9~");
    }
}
