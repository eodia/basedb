//! The values of a SQL statement's rows as node-postgres hands them to the console: the text
//! parsers of `pg-types` 2.2 (`postgres-array`, `postgres-date`, `postgres-interval`,
//! `postgres-bytea`), with the one override of `runtime/pool.ts` — a `date` stays its text.
//! What JavaScript then does with them (`JSON.stringify`) is [`crate::js::JsFormatter`]'s.

use chrono::{Datelike, Duration, LocalResult, NaiveDate, NaiveDateTime, TimeZone};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::LazyLock;

/// The value of one cell, `text` as PostgreSQL wrote it, `oid` its type.
pub fn parse_value(oid: u32, text: &str) -> Value {
    match oid {
        21 | 23 | 26 => js_parse_int(text),
        20 => json!(text),
        700 | 701 => float(js_parse_float(text)),
        16 => json!(parse_bool(text)),
        1082 => json!(text),
        1114 | 1184 => parse_date(text),
        600 => parse_point(text),
        718 => parse_circle(text),
        1186 => parse_interval(text),
        17 => parse_bytea(text),
        114 | 3802 => parse_json(text),
        1000 => parse_array(text, &|e| json!(parse_bool(e))),
        1001 => parse_array(text, &parse_bytea),
        1005 | 1007 | 1028 => parse_array(text, &js_parse_int),
        1016 => parse_array(text, &|e| json!(crate::description::js_trim(e))),
        1017 => parse_array(text, &parse_point),
        1021 | 1022 | 1231 => parse_array(text, &|e| float(js_parse_float(e))),
        651 | 1014 | 1015 | 1008 | 1009 | 1040 | 1041 | 3907 | 2951 | 791 | 1183 | 1270 => parse_array(text, &|e| json!(e)),
        1115 | 1182 | 1185 => parse_array(text, &parse_date),
        1187 => parse_array(text, &parse_interval),
        199 | 3807 => parse_array(text, &parse_json),
        _ => json!(text),
    }
}

/// A number as JSON carries it: `NaN` and the infinities become `null`.
fn float(f: f64) -> Value {
    serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null)
}

fn parse_bool(text: &str) -> bool {
    matches!(text, "TRUE" | "t" | "true" | "y" | "yes" | "on" | "1")
}

/// `parseInt(text, 10)`.
pub fn js_parse_int(text: &str) -> Value {
    let s = crate::description::js_trim(text);
    let (negative, digits) = match s.as_bytes().first() {
        Some(b'-') => (true, &s[1..]),
        Some(b'+') => (false, &s[1..]),
        _ => (false, s),
    };
    let end = digits.bytes().take_while(u8::is_ascii_digit).count();
    if end == 0 {
        return Value::Null;
    }
    let n: f64 = digits[..end].parse().unwrap_or(f64::NAN);
    let n = if negative { -n } else { n };
    if n.fract() == 0.0 && n.abs() < 9_007_199_254_740_992.0 {
        json!(n as i64)
    } else {
        float(n)
    }
}

static FLOAT_PREFIX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[+-]?(Infinity|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)").unwrap());

/// `parseFloat(text)`: the longest numeric prefix, `NaN` without one.
pub fn js_parse_float(text: &str) -> f64 {
    let s = crate::description::js_trim(text);
    let Some(m) = FLOAT_PREFIX.find(s) else { return f64::NAN };
    let t = m.as_str();
    match t.trim_start_matches(['+', '-']) {
        "Infinity" => {
            if t.starts_with('-') {
                f64::NEG_INFINITY
            } else {
                f64::INFINITY
            }
        }
        _ => t.parse().unwrap_or(f64::NAN),
    }
}

/// `JSON.parse`: numbers are doubles, [`crate::js::JsFormatter`] prints them so; the keys in
/// a JavaScript object's order.
fn parse_json(text: &str) -> Value {
    serde_json::from_str::<Value>(text).map(crate::js::js_order).unwrap_or(Value::Null)
}

fn parse_point(text: &str) -> Value {
    if !text.starts_with('(') {
        return Value::Null;
    }
    let units: Vec<u16> = text.encode_utf16().collect();
    let inner = String::from_utf16_lossy(&units[1..units.len().saturating_sub(1).max(1)]);
    let mut parts = inner.split(',');
    let x = js_parse_float(parts.next().unwrap_or(""));
    let y = parts.next().map_or(f64::NAN, js_parse_float);
    json!({ "x": float(x), "y": float(y) })
}

fn parse_circle(text: &str) -> Value {
    let chars: Vec<char> = text.chars().collect();
    if chars.first() != Some(&'<') && chars.get(1) != Some(&'(') {
        return Value::Null;
    }
    let mut point = String::from("(");
    let mut radius = String::new();
    let mut parsed = false;
    let end = chars.len().saturating_sub(1);
    for &c in chars.iter().take(end).skip(2) {
        if !parsed {
            point.push(c);
        }
        if c == ')' {
            parsed = true;
            continue;
        } else if !parsed {
            continue;
        }
        if c == ',' {
            continue;
        }
        radius.push(c);
    }
    let mut result = parse_point(&point);
    match result.as_object_mut() {
        Some(o) => {
            o.insert("radius".into(), float(js_parse_float(&radius)));
            result
        }
        // `null.radius = …`: the parser throws; the row has no value to give.
        None => Value::Null,
    }
}

/// `postgres-bytea`: `{"type":"Buffer","data":[…]}`, as a `Buffer` stringifies.
fn parse_bytea(text: &str) -> Value {
    let bytes: Vec<u8> = if let Some(hex) = text.strip_prefix("\\x") {
        let b = hex.as_bytes();
        let mut out = Vec::with_capacity(b.len() / 2);
        let mut i = 0;
        while i + 1 < b.len() {
            match (char::from(b[i]).to_digit(16), char::from(b[i + 1]).to_digit(16)) {
                (Some(h), Some(l)) => out.push((h * 16 + l) as u8),
                _ => break,
            }
            i += 2;
        }
        out
    } else {
        let chars: Vec<char> = text.chars().collect();
        let mut out = Vec::new();
        let mut i = 0;
        while i < chars.len() {
            if chars[i] != '\\' {
                out.push(chars[i] as u32 as u8);
                i += 1;
            } else if i + 3 < chars.len() && chars[i + 1..=i + 3].iter().all(|c| ('0'..='7').contains(c)) {
                let n = chars[i + 1..=i + 3].iter().fold(0u32, |acc, c| acc * 8 + c.to_digit(8).unwrap_or(0));
                out.push(n as u8);
                i += 4;
            } else {
                let mut backslashes = 1;
                while i + backslashes < chars.len() && chars[i + backslashes] == '\\' {
                    backslashes += 1;
                }
                out.resize(out.len() + backslashes / 2, b'\\');
                i += (backslashes / 2) * 2;
                if backslashes / 2 == 0 {
                    // A lone backslash before something else: the parser never moves on.
                    break;
                }
            }
        }
        out
    };
    json!({ "type": "Buffer", "data": bytes })
}

// ------------------------------------------------------------------------------------
// postgres-array

struct ArrayParser<'a> {
    source: &'a [char],
    transform: &'a dyn Fn(&str) -> Value,
    position: usize,
    entries: Vec<Value>,
    recorded: String,
    dimension: i64,
}

impl<'a> ArrayParser<'a> {
    fn next_character(&mut self) -> (Option<char>, bool) {
        let c = self.source.get(self.position).copied();
        self.position += 1;
        if c == Some('\\') {
            let v = self.source.get(self.position).copied();
            self.position += 1;
            return (v, true);
        }
        (c, false)
    }

    fn new_entry(&mut self, include_empty: bool) {
        if !self.recorded.is_empty() || include_empty {
            let entry = std::mem::take(&mut self.recorded);
            if entry == "NULL" && !include_empty {
                self.entries.push(Value::Null);
            } else {
                self.entries.push((self.transform)(&entry));
            }
        }
    }

    fn parse(&mut self, nested: bool) -> Value {
        if self.source.first() == Some(&'[') {
            while self.position < self.source.len() {
                if self.next_character().0 == Some('=') {
                    break;
                }
            }
        }
        let mut quote = false;
        while self.position < self.source.len() {
            let (c, escaped) = self.next_character();
            match c {
                Some('{') if !quote => {
                    self.dimension += 1;
                    if self.dimension > 1 {
                        let start = self.position - 1;
                        let mut inner = ArrayParser { source: &self.source[start..], transform: self.transform, position: 0, entries: Vec::new(), recorded: String::new(), dimension: 0 };
                        let value = inner.parse(true);
                        self.entries.push(value);
                        self.position = (self.position + inner.position).saturating_sub(2);
                    }
                }
                Some('}') if !quote => {
                    self.dimension -= 1;
                    if self.dimension == 0 {
                        self.new_entry(false);
                        if nested {
                            return Value::Array(std::mem::take(&mut self.entries));
                        }
                    }
                }
                Some('"') if !escaped => {
                    if quote {
                        self.new_entry(true);
                    }
                    quote = !quote;
                }
                Some(',') if !quote => self.new_entry(false),
                Some(c) => self.recorded.push(c),
                // `undefined` joined: an empty text.
                None => {}
            }
        }
        Value::Array(std::mem::take(&mut self.entries))
    }
}

fn parse_array(text: &str, transform: &dyn Fn(&str) -> Value) -> Value {
    let chars: Vec<char> = text.chars().collect();
    let mut parser = ArrayParser { source: &chars, transform, position: 0, entries: Vec::new(), recorded: String::new(), dimension: 0 };
    parser.parse(false)
}

// ------------------------------------------------------------------------------------
// postgres-date

static DATE_TIME: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$").unwrap());
static DATE_ONLY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{1,})-(\d{2})-(\d{2})( BC)?$").unwrap());
static TIME_ZONE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?").unwrap());

/// The greatest time a JavaScript `Date` holds, in milliseconds either side of 1970.
const MAX_TIME_MS: i64 = 8_640_000_000_000_000;

fn int(s: &str) -> i64 {
    s.parse().unwrap_or(0)
}

/// `postgres-date`, then `toJSON`: an ISO instant, `null` for an infinity or a date
/// JavaScript cannot hold.
pub fn parse_date(text: &str) -> Value {
    if text == "infinity" || text == "-infinity" {
        return Value::Null;
    }
    let Some(m) = DATE_TIME.captures(text) else {
        let Some(d) = DATE_ONLY.captures(text) else { return Value::Null };
        let mut year = int(&d[1]);
        if d.get(4).is_some() {
            year = -(year - 1);
        }
        return iso(local_ms(year, int(&d[2]) - 1, int(&d[3]), 0, 0, 0, 0));
    };
    let mut year = int(&m[1]);
    if m.get(8).is_some() {
        year = -(year - 1);
    }
    let month = int(&m[2]) - 1;
    let day = int(&m[3]);
    let (hour, minute, second) = (int(&m[4]), int(&m[5]), int(&m[6]));
    let ms = m.get(7).map_or(0, |f| (1000.0 * js_parse_float(f.as_str())).trunc() as i64);
    match time_zone_offset(text) {
        Some(Some(offset)) => iso(utc_ms(year, month, day, hour, minute, second, ms).map(|t| t - offset)),
        Some(None) => Value::Null,
        None => iso(local_ms(year, month, day, hour, minute, second, ms)),
    }
}

/// `timeZoneOffset`, in milliseconds; `None` for a local time, `Some(None)` for `NaN`.
fn time_zone_offset(text: &str) -> Option<Option<i64>> {
    if text.ends_with("+00") {
        return Some(Some(0));
    }
    let part = text.split(' ').nth(1)?;
    let zone = TIME_ZONE.captures(part)?;
    if &zone[1] == "Z" {
        return Some(Some(0));
    }
    let sign = if &zone[1] == "-" { -1 } else { 1 };
    let Some(hours) = zone.get(2) else { return Some(None) };
    let seconds = int(hours.as_str()) * 3600 + zone.get(3).map_or(0, |m| int(m.as_str())) * 60 + zone.get(4).map_or(0, |m| int(m.as_str()));
    Some(Some(seconds * sign * 1000))
}

fn naive(year: i64, month: i64, day: i64, hour: i64, minute: i64, second: i64, ms: i64) -> Option<NaiveDateTime> {
    let y = year + month.div_euclid(12);
    let mo = month.rem_euclid(12);
    let first = NaiveDate::from_ymd_opt(i32::try_from(y).ok()?, (mo + 1) as u32, 1)?;
    let date = first.checked_add_signed(Duration::days(day - 1))?;
    date.and_hms_opt(0, 0, 0)?.checked_add_signed(Duration::milliseconds(((hour * 60 + minute) * 60 + second) * 1000 + ms))
}

fn utc_ms(year: i64, month: i64, day: i64, hour: i64, minute: i64, second: i64, ms: i64) -> Option<i64> {
    Some(naive(year, month, day, hour, minute, second, ms)?.and_utc().timestamp_millis())
}

/// `new Date(y, m, d, h, mi, s, ms)`: local time — the earlier instant of an hour that
/// repeats, the hour after a gap.
fn local_ms(year: i64, month: i64, day: i64, hour: i64, minute: i64, second: i64, ms: i64) -> Option<i64> {
    let n = naive(year, month, day, hour, minute, second, ms)?;
    let at = match chrono::Local.from_local_datetime(&n) {
        LocalResult::Single(t) => t,
        LocalResult::Ambiguous(a, _) => a,
        LocalResult::None => match chrono::Local.from_local_datetime(&(n + Duration::hours(1))) {
            LocalResult::Single(t) | LocalResult::Ambiguous(t, _) => t,
            LocalResult::None => return None,
        },
    };
    Some(at.timestamp_millis())
}

/// `Date.prototype.toJSON`.
fn iso(ms: Option<i64>) -> Value {
    let Some(ms) = ms.filter(|t| t.abs() <= MAX_TIME_MS) else { return Value::Null };
    let Some(t) = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms) else { return Value::Null };
    let year = t.year();
    let y = if (0..=9999).contains(&year) {
        format!("{year:04}")
    } else if year < 0 {
        format!("-{:06}", -year)
    } else {
        format!("+{year:06}")
    };
    json!(format!("{y}-{}", t.format("%m-%dT%H:%M:%S%.3fZ")))
}

// ------------------------------------------------------------------------------------
// postgres-interval

static INTERVAL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(([+-]?\d+)\s+years?)?\s*(([+-]?\d+)\s+mons?)?\s*(([+-]?\d+)\s+days?)?\s*(([+-])?([\d]*):(\d\d):(\d\d)\.?(\d{1,6})?)?").unwrap()
});

/// `postgres-interval`: an object of the parts it reads. The ISO style every connection of
/// the product uses (`P1D`) is not one it reads: `{}`.
pub fn parse_interval(text: &str) -> Value {
    let mut out = Map::new();
    if text.is_empty() {
        return Value::Object(out);
    }
    let Some(m) = INTERVAL.captures(text) else { return Value::Object(out) };
    let negative = m.get(8).is_some_and(|s| s.as_str() == "-");
    for (property, position) in [("years", 2), ("months", 4), ("days", 6), ("hours", 9), ("minutes", 10), ("seconds", 11), ("milliseconds", 12)] {
        let Some(value) = m.get(position).map(|v| v.as_str()).filter(|v| !v.is_empty()) else { continue };
        let mut n = if property == "milliseconds" {
            let micro = format!("{value}{}", &"000000"[value.len().min(6)..]);
            int(&micro) as f64 / 1000.0
        } else {
            match js_parse_int(value) {
                Value::Number(n) => n.as_f64().unwrap_or(0.0),
                _ => f64::NAN,
            }
        };
        if n == 0.0 || n.is_nan() {
            continue;
        }
        if negative && matches!(property, "hours" | "minutes" | "seconds" | "milliseconds") {
            n = -n;
        }
        out.insert(property.into(), crate::js::js_number(n));
    }
    Value::Object(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scalars_parse_as_pg_types() {
        assert_eq!(parse_value(23, "42"), json!(42));
        assert_eq!(parse_value(20, "9007199254740993"), json!("9007199254740993"));
        assert_eq!(parse_value(701, "NaN"), Value::Null);
        assert_eq!(parse_value(16, "t"), json!(true));
        assert_eq!(parse_value(1082, "2024-06-01"), json!("2024-06-01"));
        assert_eq!(parse_value(1184, "2024-06-01 10:34:56.789123+00"), json!("2024-06-01T10:34:56.789Z"));
        assert_eq!(parse_value(1184, "2024-06-01 10:34:56+05:30"), json!("2024-06-01T05:04:56.000Z"));
        assert_eq!(parse_value(1184, "0001-01-01 00:00:00+00 BC"), json!("0000-01-01T00:00:00.000Z"));
        assert_eq!(parse_value(1184, "infinity"), Value::Null);
        assert_eq!(parse_value(17, "\\xdeadbeef"), json!({ "type": "Buffer", "data": [222, 173, 190, 239] }));
        assert_eq!(parse_value(600, "(1,2.5)"), json!({ "x": 1.0, "y": 2.5 }));
        assert_eq!(parse_value(718, "<(1,2),3>"), json!({ "x": 1.0, "y": 2.0, "radius": 3.0 }));
        assert_eq!(parse_value(1186, "P1DT2H"), json!({}));
        assert_eq!(parse_value(1186, "1 year 2 mons -3 days -04:05:06.5"), json!({ "years": 1, "months": 2, "days": -3, "hours": -4, "minutes": -5, "seconds": -6, "milliseconds": -500 }));
    }

    #[test]
    fn arrays_parse_as_postgres_array() {
        assert_eq!(parse_value(1009, r#"{a,NULL,"b c","NULL","q\"r"}"#), json!(["a", null, "b c", "NULL", "q\"r"]));
        assert_eq!(parse_value(1007, "{{1,2},{3,4}}"), json!([[1, 2], [3, 4]]));
        assert_eq!(parse_value(1007, "[0:1]={5,6}"), json!([5, 6]));
        assert_eq!(parse_value(1007, "{}"), json!([]));
        assert_eq!(parse_value(1016, "{3,NULL}"), json!(["3", null]));
        assert_eq!(parse_value(3807, r#"{"{\"a\": 1}"}"#), json!([{ "a": 1 }]));
    }

    #[test]
    fn json_keeps_javascript_s_key_order() {
        let v = parse_value(3802, r#"{"b": 1, "a": [1, 2.0], "1": null}"#);
        assert_eq!(serde_json::to_string(&v).unwrap(), r#"{"1":null,"b":1,"a":[1,2.0]}"#);
    }
}
