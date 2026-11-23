//! What `Intl` writes in the twenty languages of a document: numbers, amounts, percents,
//! long dates and dates with a time. Read once from Node's ICU into `intl.json`, the very
//! algorithm below checked against ICU then.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::LazyLock;

#[derive(Deserialize)]
struct Pair {
    pos: String,
    neg: String,
}

#[derive(Deserialize)]
struct Locale {
    decimal: String,
    group: String,
    min_grouping: usize,
    number: Pair,
    percent: Pair,
    currency: Pair,
    symbols: HashMap<String, String>,
    currency_overrides: HashMap<String, Pair>,
    date: Vec<String>,
    datetime: Vec<String>,
    months: Vec<String>,
    month_pad: bool,
    day_pad: bool,
    hour_cycle: String,
    hour_pad: bool,
    day_periods: Vec<String>,
}

#[derive(Deserialize)]
struct Data {
    fraction_digits: HashMap<String, usize>,
    locales: HashMap<String, Locale>,
}

static DATA: LazyLock<Data> = LazyLock::new(|| serde_json::from_str(include_str!("intl.json")).expect("intl.json"));

fn locale(tag: &str) -> &'static Locale {
    DATA.locales.get(tag).unwrap_or_else(|| &DATA.locales["en"])
}

/// The shortest decimal that reads back as `n`, never in exponent form.
fn plain(n: f64) -> String {
    format!("{}", n.abs())
}

fn shift(s: &str, k: usize) -> String {
    let (i, f) = s.split_once('.').unwrap_or((s, ""));
    let mut f = f.to_string();
    while f.len() < k {
        f.push('0');
    }
    let joined = format!("{i}{}", &f[..k]);
    let trimmed = joined.trim_start_matches('0');
    let i = if trimmed.is_empty() { "0" } else { trimmed };
    let rest = &f[k..];
    if rest.is_empty() {
        i.to_string()
    } else {
        format!("{i}.{rest}")
    }
}

fn round(s: &str, min: usize, max: usize) -> (String, String) {
    let (i, f) = s.split_once('.').unwrap_or((s, ""));
    let (mut i, mut f) = (i.to_string(), f.to_string());
    if f.len() > max {
        let up = f.as_bytes()[max] >= b'5';
        f.truncate(max);
        if up {
            let mut digits: Vec<u8> = format!("{i}{f}").bytes().map(|b| b - b'0').collect();
            let mut k = digits.len() as isize - 1;
            while k >= 0 {
                if digits[k as usize] == 9 {
                    digits[k as usize] = 0;
                    k -= 1;
                } else {
                    digits[k as usize] += 1;
                    break;
                }
            }
            let mut all: String = digits.iter().map(|d| (b'0' + d) as char).collect();
            if k < 0 {
                all.insert(0, '1');
            }
            let cut = all.len() - f.len();
            i = all[..cut].to_string();
            f = all[cut..].to_string();
        }
    }
    let mut f = f.trim_end_matches('0').to_string();
    while f.len() < min {
        f.push('0');
    }
    (if i.is_empty() { "0".into() } else { i }, f)
}

fn body(l: &Locale, s: &str, min: usize, max: usize) -> String {
    let (i, f) = round(s, min, max);
    let int = if i.len() >= 3 + l.min_grouping {
        let mut groups = Vec::new();
        let mut rest = i.as_str();
        while rest.len() > 3 {
            groups.insert(0, &rest[rest.len() - 3..]);
            rest = &rest[..rest.len() - 3];
        }
        groups.insert(0, rest);
        groups.join(&l.group)
    } else {
        i
    };
    if f.is_empty() {
        int
    } else {
        format!("{int}{}{f}", l.decimal)
    }
}

fn apply(template: &str, number: &str) -> String {
    template.replacen('#', number, 1)
}

/// `new Intl.NumberFormat(locale, { maximumFractionDigits: max }).format(n)`.
pub fn decimal(tag: &str, n: f64, max: usize) -> String {
    let l = locale(tag);
    let b = body(l, &plain(n), 0, max);
    apply(if n.is_sign_negative() { &l.number.neg } else { &l.number.pos }, &b)
}

/// `new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(n / 100)`.
pub fn percent(tag: &str, n: f64) -> String {
    let l = locale(tag);
    let v = n / 100.0;
    let b = body(l, &shift(&plain(v), 2), 0, 2);
    apply(if v.is_sign_negative() { &l.percent.neg } else { &l.percent.pos }, &b)
}

/// `new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)` — `None` where
/// Intl throws (a code that is not three letters).
pub fn currency(tag: &str, n: f64, code: &str) -> Option<String> {
    if code.len() != 3 || !code.bytes().all(|b| b.is_ascii_alphabetic()) {
        return None;
    }
    let code = code.to_ascii_uppercase();
    let l = locale(tag);
    let digits = DATA.fraction_digits.get(&code).copied().unwrap_or(2);
    let b = body(l, &plain(n), digits, digits);
    if let Some(o) = l.currency_overrides.get(&code) {
        return Some(apply(if n.is_sign_negative() { &o.neg } else { &o.pos }, &b));
    }
    let sym = l.symbols.get(&code).cloned().unwrap_or_else(|| code.clone());
    let t = if n.is_sign_negative() { &l.currency.neg } else { &l.currency.pos };
    let at = t.find('¤');
    let num = t.find('#');
    let mut s = sym.clone();
    if let (Some(at), Some(num)) = (at, num) {
        if at + '¤'.len_utf8() == num && sym.chars().last().is_some_and(char::is_alphabetic) {
            s = format!("{sym}\u{a0}");
        } else if num + 1 == at && sym.chars().next().is_some_and(char::is_alphabetic) {
            s = format!("\u{a0}{sym}");
        }
    }
    Some(apply(&t.replacen('¤', &s, 1), &b))
}

fn pad2(n: u32) -> String {
    format!("{n:02}")
}

fn date_text(l: &Locale, tokens: &[String], y: i32, mo: u32, d: u32, h: u32, mi: u32) -> String {
    tokens
        .iter()
        .map(|t| match t.as_str() {
            "{year}" => y.to_string(),
            "{month}" => l.months[(mo - 1) as usize].clone(),
            "{month_num}" => {
                if l.month_pad {
                    pad2(mo)
                } else {
                    mo.to_string()
                }
            }
            "{day}" => {
                if l.day_pad {
                    pad2(d)
                } else {
                    d.to_string()
                }
            }
            "{hour}" => {
                let v = match l.hour_cycle.as_str() {
                    "h12" if h.is_multiple_of(12) => 12,
                    "h12" | "h11" => h % 12,
                    "h24" if h == 0 => 24,
                    _ => h,
                };
                if l.hour_pad {
                    pad2(v)
                } else {
                    v.to_string()
                }
            }
            "{minute}" => pad2(mi),
            "{period}" => l.day_periods[if h < 12 { 0 } else { 1 }].clone(),
            other => other.to_string(),
        })
        .collect()
}

/// `dateStyle: 'long'`.
pub fn long_date(tag: &str, y: i32, mo: u32, d: u32) -> String {
    let l = locale(tag);
    date_text(l, &l.date, y, mo, d, 0, 0)
}

/// `dateStyle: 'long', timeStyle: 'short'`, the wall time already in the reader's zone.
pub fn long_datetime(tag: &str, y: i32, mo: u32, d: u32, h: u32, mi: u32) -> String {
    let l = locale(tag);
    date_text(l, &l.datetime, y, mo, d, h, mi)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_as_icu() {
        assert_eq!(decimal("en", 1234567.891, 10), "1,234,567.891");
        assert_eq!(decimal("fr", 1234.5, 0), "1\u{202f}235");
        assert_eq!(decimal("es", 1234.0, 10), "1234");
        assert_eq!(decimal("en", 0.1 + 0.2, 10), "0.3");
        assert_eq!(percent("en", 12.345), "12.35%");
        assert_eq!(currency("fr", 1234.5, "EUR").unwrap(), "1\u{202f}234,50\u{a0}€");
        assert_eq!(currency("en", -1234.5, "usd").unwrap(), "-$1,234.50");
        assert_eq!(currency("en", 3.0, "JPY").unwrap(), "¥3");
        assert!(currency("en", 3.0, "EURO").is_none());
        assert_eq!(long_date("fr", 2024, 3, 5), "5 mars 2024");
        assert_eq!(long_datetime("en", 2024, 3, 5, 15, 4), "March 5, 2024 at 3:04 PM");
    }
}
