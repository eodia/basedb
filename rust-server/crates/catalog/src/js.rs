//! What JavaScript does to a value that Rust has to do on purpose.

use serde_json::{Map, Value};

/// An array index as `Object.keys` sees one: `0`, or digits without a leading zero, below 2³²−1.
fn array_index(key: &str) -> Option<u64> {
    if key.is_empty() || key.len() > 10 || !key.bytes().all(|b| b.is_ascii_digit()) || (key.len() > 1 && key.starts_with('0')) {
        return None;
    }
    key.parse::<u64>().ok().filter(|n| *n < u32::MAX as u64)
}

/// The key order of a JS object: integer-like keys first, ascending, then the others in
/// insertion order — applied to every object of the tree, so that `JSON.stringify` and
/// `serde_json` write the same bytes.
pub fn js_order(value: Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.into_iter().map(js_order).collect()),
        Value::Object(map) => {
            let mut integers: Vec<(u64, String, Value)> = Vec::new();
            let mut others: Vec<(String, Value)> = Vec::new();
            for (k, v) in map {
                match array_index(&k) {
                    Some(n) => integers.push((n, k, js_order(v))),
                    None => others.push((k, js_order(v))),
                }
            }
            integers.sort_by_key(|(n, _, _)| *n);
            let mut out = Map::new();
            for (_, k, v) in integers {
                out.insert(k, v);
            }
            for (k, v) in others {
                out.insert(k, v);
            }
            Value::Object(out)
        }
        v => v,
    }
}

/// `string.length`: UTF-16 code units.
pub fn js_length(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `text.replace(/\s+/g, ' ')`.
pub fn js_collapse_spaces(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_space = false;
    for c in text.chars() {
        if crate::formula::js_space(c) {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(c);
            in_space = false;
        }
    }
    out
}

/// `string.trimEnd()`.
pub fn js_trim_end(s: &str) -> &str {
    s.trim_end_matches(crate::formula::js_space)
}

/// `encodeURIComponent`.
pub fn encode_uri_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// A number as `JSON.stringify` writes it: an integral value without `.0`.
pub fn js_number(f: f64) -> Value {
    if f.fract() == 0.0 && f.abs() < 9_007_199_254_740_992.0 {
        Value::from(f as i64)
    } else {
        serde_json::json!(f)
    }
}

/// `JSON.parse(JSON.stringify(value))` for the numbers of a tree: `2.0` becomes `2`.
pub fn js_numbers(value: Value) -> Value {
    match value {
        Value::Number(n) if n.is_f64() => n.as_f64().map(js_number).unwrap_or(Value::Number(n)),
        Value::Array(items) => Value::Array(items.into_iter().map(js_numbers).collect()),
        Value::Object(map) => Value::Object(map.into_iter().map(|(k, v)| (k, js_numbers(v))).collect()),
        v => v,
    }
}

/// `string.slice(0, max)` in UTF-16 code units, never splitting a character.
pub fn js_slice(s: &str, max: usize) -> &str {
    let mut units = 0;
    for (i, c) in s.char_indices() {
        units += c.len_utf16();
        if units > max {
            return &s[..i];
        }
    }
    s
}

/// `Math.round`: halves toward +∞.
pub fn js_round(f: f64) -> f64 {
    (f + 0.5).floor()
}
/// `Number(text)` of JavaScript: trimmed, `''` → 0, `0x…`/`0o…`/`0b…`, `Infinity`; else NaN.
pub fn js_to_number(text: &str) -> f64 {
    let s = crate::description::js_trim(text);
    if s.is_empty() {
        return 0.0;
    }
    for (prefix, radix) in [("0x", 16), ("0X", 16), ("0o", 8), ("0O", 8), ("0b", 2), ("0B", 2)] {
        if let Some(digits) = s.strip_prefix(prefix) {
            return if !digits.is_empty() && digits.chars().all(|c| c.is_digit(radix)) {
                digits.chars().fold(0.0, |acc, c| acc * radix as f64 + c.to_digit(radix).unwrap_or(0) as f64)
            } else {
                f64::NAN
            };
        }
    }
    match s.trim_start_matches(['+', '-']) {
        "Infinity" => return if s.starts_with('-') { f64::NEG_INFINITY } else { f64::INFINITY },
        u if !u.starts_with(|c: char| c.is_ascii_digit() || c == '.') => return f64::NAN,
        _ => {}
    }
    if s.matches(['+', '-']).count() > 1 && !s.contains(['e', 'E']) {
        return f64::NAN;
    }
    s.parse::<f64>().unwrap_or(f64::NAN)
}

/// `String(n)`: the shortest round-trip digits, laid out as JavaScript does (`1e+21`,
/// `100000000000000000000`, `1e-7`). Finite values only.
pub fn js_number_string(f: f64) -> String {
    if f == 0.0 {
        return "0".into();
    }
    let sign = if f < 0.0 { "-" } else { "" };
    let sci = format!("{:e}", f.abs());
    let (mantissa, exp) = sci.split_once('e').unwrap_or((&sci, "0"));
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let k = digits.len() as i64;
    let n = exp.parse::<i64>().unwrap_or(0) + 1;
    let body = if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        format!("{}.{}", &digits[..n as usize], &digits[n as usize..])
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let e = n - 1;
        let e = if e >= 0 { format!("+{e}") } else { e.to_string() };
        if k == 1 {
            format!("{digits}e{e}")
        } else {
            format!("{}.{}e{e}", &digits[..1], &digits[1..])
        }
    };
    format!("{sign}{body}")
}

/// A `serde_json` formatter that writes numbers as `JSON.stringify` does: every number a
/// double, integers past 2⁵³ rounded, `1e+21` rather than `1e21`.
pub struct JsFormatter;

impl serde_json::ser::Formatter for JsFormatter {
    fn write_f64<W: ?Sized + std::io::Write>(&mut self, writer: &mut W, value: f64) -> std::io::Result<()> {
        if value.is_finite() {
            writer.write_all(js_number_string(value).as_bytes())
        } else {
            writer.write_all(b"null")
        }
    }
    fn write_f32<W: ?Sized + std::io::Write>(&mut self, writer: &mut W, value: f32) -> std::io::Result<()> {
        self.write_f64(writer, value as f64)
    }
    fn write_i64<W: ?Sized + std::io::Write>(&mut self, writer: &mut W, value: i64) -> std::io::Result<()> {
        self.write_f64(writer, value as f64)
    }
    fn write_u64<W: ?Sized + std::io::Write>(&mut self, writer: &mut W, value: u64) -> std::io::Result<()> {
        self.write_f64(writer, value as f64)
    }
}

/// `c.json(body, status)` for a body holding numbers JavaScript would have printed its way.
pub fn js_json_response(status: axum::http::StatusCode, body: &Value) -> axum::response::Response {
    let mut bytes = Vec::new();
    let mut ser = serde_json::Serializer::with_formatter(&mut bytes, JsFormatter);
    let _ = serde::Serialize::serialize(body, &mut ser);
    let mut res = axum::response::Response::new(axum::body::Body::from(bytes));
    *res.status_mut() = status;
    res.headers_mut().insert(axum::http::header::CONTENT_TYPE, axum::http::HeaderValue::from_static("application/json"));
    res
}

/// `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
pub fn is_uuid_ci(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36 && b.iter().enumerate().all(|(i, c)| if matches!(i, 8 | 13 | 18 | 23) { *c == b'-' } else { c.is_ascii_hexdigit() })
}

/// `c.req.query(name)` of Hono: the first value, decoded.
pub fn query_param(uri: &axum::http::Uri, name: &str) -> Option<String> {
    form_urlencoded::parse(uri.query().unwrap_or("").as_bytes()).find(|(k, _)| k == name).map(|(_, v)| v.into_owned())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn integer_keys_come_first() {
        let v = js_order(json!({ "204": 1, "409": 2, "a": 3, "401": 4, "01": 5, "4294967295": 6, "0": 7 }));
        let keys: Vec<&String> = v.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["0", "204", "401", "409", "a", "01", "4294967295"]);
        assert_eq!(js_length("é😀"), 3);
    }
}
