//! What JavaScript does to a value that Rust has to do on purpose — the records' share.

/// `String(n)` / `Number.prototype.toString()`: the shortest digits, JavaScript's layout.
pub fn number_string(f: f64) -> String {
    if f.is_nan() {
        return "NaN".into();
    }
    if f.is_infinite() {
        return if f > 0.0 { "Infinity".into() } else { "-Infinity".into() };
    }
    if f == 0.0 {
        return "0".into();
    }
    let sign = if f < 0.0 { "-" } else { "" };
    // `{:e}` gives the shortest round-trip digits: `1.5e0`, `1e21`, `1.234e-7`.
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

/// `Number(v)` of a decoded column (`int8`/`numeric` arrive as text), as JSON — an
/// integral value prints without a fraction, like `JSON.stringify`; NaN → `null`.
pub fn js_number(v: &serde_json::Value) -> serde_json::Value {
    let f = match v {
        serde_json::Value::Number(n) => return serde_json::Value::Number(n.clone()),
        serde_json::Value::String(s) => {
            let t = js_trim(s);
            if t.is_empty() { 0.0 } else { t.parse::<f64>().unwrap_or(f64::NAN) }
        }
        serde_json::Value::Bool(b) => f64::from(u8::from(*b)),
        serde_json::Value::Null => 0.0,
        _ => f64::NAN,
    };
    number_json(f)
}

/// A float as `JSON.stringify` writes it.
pub fn number_json(f: f64) -> serde_json::Value {
    if !f.is_finite() {
        return serde_json::Value::Null;
    }
    if f.fract() == 0.0 && f.abs() < 9.007_199_254_740_992e15 {
        return serde_json::Value::from(f as i64);
    }
    serde_json::Number::from_f64(f).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null)
}

/// JavaScript's `\s`.
pub fn js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}'
    )
}

/// `string.trim()`.
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(js_space)
}

/// `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
pub fn is_uuid_ci(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(i, c)| if matches!(i, 8 | 13 | 18 | 23) { *c == b'-' } else { c.is_ascii_hexdigit() })
}

/// `/^[0-9a-f-]{36}$/i`.
pub fn is_uuid_shape(s: &str) -> bool {
    s.len() == 36 && s.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_print_as_javascript() {
        assert_eq!(number_string(1.5), "1.5");
        assert_eq!(number_string(-0.0), "0");
        assert_eq!(number_string(100.0), "100");
        assert_eq!(number_string(1e21), "1e+21");
        assert_eq!(number_string(1e20), "100000000000000000000");
        assert_eq!(number_string(1e-7), "1e-7");
        assert_eq!(number_string(0.000001), "0.000001");
        assert_eq!(number_string(1.25e-7), "1.25e-7");
        assert_eq!(number_string(123.456), "123.456");
        assert_eq!(number_string(0.1 + 0.2), "0.30000000000000004");
    }
}
