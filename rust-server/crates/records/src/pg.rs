//! Rows as node-postgres hands them to Node — and parameters as it sends them.
//!
//! `pg` reads every column in TEXT and parses a handful of types (`pg-types`, with the
//! date left as text by `runtime/pool.ts`); tokio-postgres reads in binary. [`Js`] decodes
//! the binary form into the JSON value Node would have written: `int8` and `numeric` as
//! exact strings, `numeric[]` as floats (`parseFloatArray`), instants as
//! `toISOString()` (milliseconds, truncated), `bytea` as a serialised `Buffer`.
//!
//! [`P`] is the other way: a parameter sent in TEXT format, as `prepareValue` writes it,
//! so that PostgreSQL casts it exactly as it casts Node's.

use bytes::BytesMut;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use postgres_types::{Format, IsNull, Kind, ToSql, Type};
use serde_json::{Map, Value};
use std::error::Error;
use tokio_postgres::types::FromSql;
use tokio_postgres::Row;

type BoxErr = Box<dyn Error + Sync + Send>;

/// A column decoded as node-postgres would.
pub struct Js(pub Value);

impl<'a> FromSql<'a> for Js {
    fn from_sql(ty: &Type, raw: &'a [u8]) -> Result<Self, BoxErr> {
        Ok(Js(decode(ty, raw, false)?))
    }
    fn from_sql_null(_: &Type) -> Result<Self, BoxErr> {
        Ok(Js(Value::Null))
    }
    fn accepts(_: &Type) -> bool {
        true
    }
}

/// Column `i` of a row, as Node reads it.
pub fn col(row: &Row, i: usize) -> Value {
    row.try_get::<_, Js>(i).map(|j| j.0).unwrap_or(Value::Null)
}

/// A whole row, as Node's `rows[n]`: an object in column order (a repeated name keeps its
/// first place and its last value).
pub fn row_object(row: &Row) -> Map<String, Value> {
    let mut out = Map::new();
    for (i, c) in row.columns().iter().enumerate() {
        out.insert(c.name().to_string(), col(row, i));
    }
    out
}

fn be_i16(b: &[u8], at: usize) -> Result<i16, BoxErr> {
    b.get(at..at + 2).map(|s| i16::from_be_bytes([s[0], s[1]])).ok_or_else(|| "short".into())
}
fn be_i32(b: &[u8], at: usize) -> Result<i32, BoxErr> {
    b.get(at..at + 4).map(|s| i32::from_be_bytes([s[0], s[1], s[2], s[3]])).ok_or_else(|| "short".into())
}
fn be_i64(b: &[u8]) -> Result<i64, BoxErr> {
    let s: [u8; 8] = b.get(..8).ok_or("short")?.try_into()?;
    Ok(i64::from_be_bytes(s))
}

/// `numeric_out`: the exact text of a binary `numeric`.
pub fn numeric_text(raw: &[u8]) -> Result<String, BoxErr> {
    let ndigits = be_i16(raw, 0)? as i64;
    let weight = be_i16(raw, 2)? as i64;
    let sign = be_i16(raw, 4)? as u16;
    let dscale = be_i16(raw, 6)? as i64;
    match sign {
        0xC000 => return Ok("NaN".into()),
        0xD000 => return Ok("Infinity".into()),
        0xF000 => return Ok("-Infinity".into()),
        _ => {}
    }
    let mut digits = Vec::with_capacity(ndigits as usize);
    for i in 0..ndigits {
        digits.push(be_i16(raw, 8 + 2 * i as usize)? as i64);
    }
    let digit = |d: i64| if d >= 0 && d < ndigits { digits[d as usize] } else { 0 };
    let mut out = String::new();
    if sign == 0x4000 {
        out.push('-');
    }
    if weight < 0 {
        out.push('0');
    } else {
        for d in 0..=weight {
            if d == 0 {
                out.push_str(&digit(d).to_string());
            } else {
                out.push_str(&format!("{:04}", digit(d)));
            }
        }
    }
    if dscale > 0 {
        out.push('.');
        let mut frac = String::new();
        let mut d = weight + 1;
        while (frac.len() as i64) < dscale {
            frac.push_str(&format!("{:04}", digit(d)));
            d += 1;
        }
        frac.truncate(dscale as usize);
        out.push_str(&frac);
    }
    Ok(out)
}

/// `Date.prototype.toISOString()` of a PostgreSQL instant (µs since 2000-01-01).
fn instant(raw: &[u8]) -> Result<Value, BoxErr> {
    let micros = be_i64(raw)?;
    if micros == i64::MAX {
        return Ok(Value::from("infinity"));
    }
    if micros == i64::MIN {
        return Ok(Value::from("-infinity"));
    }
    let epoch = DateTime::<Utc>::from_timestamp(946_684_800, 0).ok_or("epoch")?;
    let at = epoch + Duration::milliseconds(micros.div_euclid(1000));
    Ok(Value::from(basedb_base::time::iso(at)))
}

/// `date_out` with `DateStyle = ISO`: `0044-03-15 BC` before year one.
fn ymd_text(d: NaiveDate) -> String {
    use chrono::Datelike;
    let (year, era) = if d.year() <= 0 { (1 - d.year(), " BC") } else { (d.year(), "") };
    format!("{year:04}-{:02}-{:02}{era}", d.month(), d.day())
}

fn date_text(raw: &[u8]) -> Result<String, BoxErr> {
    let days = be_i32(raw, 0)?;
    if days == i32::MAX {
        return Ok("infinity".into());
    }
    if days == i32::MIN {
        return Ok("-infinity".into());
    }
    let base = NaiveDate::from_ymd_opt(2000, 1, 1).ok_or("date")?;
    Ok(ymd_text(base + Duration::days(days as i64)))
}

/// `timestamp_out` with `DateStyle = ISO`: what `pg` hands `postgres-date` for a
/// `timestamp` without time zone.
fn timestamp_text(raw: &[u8]) -> Result<String, BoxErr> {
    let micros = be_i64(raw)?;
    if micros == i64::MAX {
        return Ok("infinity".into());
    }
    if micros == i64::MIN {
        return Ok("-infinity".into());
    }
    let epoch = NaiveDate::from_ymd_opt(2000, 1, 1).ok_or("date")?.and_hms_opt(0, 0, 0).ok_or("date")?;
    let at = epoch + Duration::microseconds(micros);
    let (date, time) = (at.date(), at.time());
    use chrono::Timelike;
    let mut text = ymd_text(date);
    let era = text.ends_with(" BC");
    if era {
        text.truncate(text.len() - 3);
    }
    text.push_str(&format!(" {:02}:{:02}:{:02}", time.hour(), time.minute(), time.second()));
    let frac = time.nanosecond() / 1000;
    if frac != 0 {
        text.push_str(format!(".{frac:06}").trim_end_matches('0'));
    }
    if era {
        text.push_str(" BC");
    }
    Ok(text)
}

/// A float as `parseFloat` gives it, then `JSON.stringify` writes it.
fn float_value(f: f64) -> Value {
    if f.is_finite() {
        basedb_catalog::js::js_number(f)
    } else {
        Value::Null
    }
}

/// JSON as `JSON.parse` gives it: integral numbers without `.0`, keys in JS order.
pub fn parse_json(text: &str) -> Result<Value, BoxErr> {
    let v: Value = serde_json::from_str(text)?;
    Ok(basedb_catalog::js::js_order(basedb_catalog::js::js_numbers(v)))
}

fn decode(ty: &Type, raw: &[u8], element: bool) -> Result<Value, BoxErr> {
    if let Kind::Domain(inner) = ty.kind() {
        return decode(inner, raw, element);
    }
    if let Kind::Array(inner) = ty.kind() {
        return decode_array(inner, raw);
    }
    Ok(match *ty {
        Type::BOOL => Value::Bool(raw.first().copied().unwrap_or(0) != 0),
        Type::INT2 => Value::from(be_i16(raw, 0)?),
        Type::INT4 => Value::from(be_i32(raw, 0)?),
        Type::OID => Value::from(be_i32(raw, 0)? as u32),
        Type::INT8 => Value::from(be_i64(raw)?.to_string()),
        Type::FLOAT4 => float_value(f32::from_be_bytes(raw.get(..4).ok_or("short")?.try_into()?) as f64),
        Type::FLOAT8 => float_value(f64::from_be_bytes(raw.get(..8).ok_or("short")?.try_into()?)),
        Type::NUMERIC => {
            let text = numeric_text(raw)?;
            if element {
                float_value(text.parse::<f64>().unwrap_or(f64::NAN))
            } else {
                Value::from(text)
            }
        }
        // `runtime/pool.ts` leaves the date as text, but not the elements of a `date[]`:
        // those go through `postgres-date`, a local midnight. A `timestamp` without time
        // zone is a local time too; an infinity is `±Infinity`, which `JSON` writes `null`.
        Type::DATE if element => basedb_catalog::pg_values::parse_date(&date_text(raw)?),
        Type::DATE => Value::from(date_text(raw)?),
        Type::TIMESTAMP => basedb_catalog::pg_values::parse_date(&timestamp_text(raw)?),
        Type::TIMESTAMPTZ => match instant(raw)? {
            Value::String(s) if s.ends_with("infinity") => Value::Null,
            v => v,
        },
        // Every connection reads intervals in the ISO style, which `postgres-interval` does not.
        Type::INTERVAL => Value::Object(Map::new()),
        Type::TIME => {
            let us = be_i64(raw)?;
            let (s, frac) = (us / 1_000_000, us % 1_000_000);
            let mut t = format!("{:02}:{:02}:{:02}", s / 3600, (s / 60) % 60, s % 60);
            if frac != 0 {
                t.push_str(format!(".{frac:06}").trim_end_matches('0'));
            }
            Value::from(t)
        }
        Type::UUID => Value::from(uuid::Uuid::from_slice(raw)?.hyphenated().to_string()),
        Type::JSON => parse_json(std::str::from_utf8(raw)?)?,
        Type::JSONB => parse_json(std::str::from_utf8(raw.get(1..).unwrap_or_default())?)?,
        Type::BYTEA => {
            let mut m = Map::new();
            m.insert("type".into(), Value::from("Buffer"));
            m.insert("data".into(), Value::Array(raw.iter().map(|b| Value::from(*b)).collect()));
            Value::Object(m)
        }
        // text, varchar, name, bpchar, enums, and whatever else travels as its text.
        _ => Value::from(String::from_utf8_lossy(raw).into_owned()),
    })
}

fn decode_array(inner: &Type, raw: &[u8]) -> Result<Value, BoxErr> {
    use fallible_iterator::FallibleIterator;
    let array = postgres_protocol::types::array_from_sql(raw)?;
    let dims: Vec<i32> = array.dimensions().map(|d| Ok(d.len)).collect()?;
    let mut flat: Vec<Value> = Vec::new();
    let mut values = array.values();
    while let Some(v) = values.next()? {
        flat.push(match v {
            None => Value::Null,
            Some(bytes) => decode(inner, bytes, true)?,
        });
    }
    if dims.is_empty() {
        return Ok(Value::Array(vec![]));
    }
    fn nest(flat: &mut std::vec::IntoIter<Value>, dims: &[i32]) -> Value {
        if dims.len() == 1 {
            Value::Array(flat.take(dims[0].max(0) as usize).collect())
        } else {
            Value::Array((0..dims[0].max(0)).map(|_| nest(flat, &dims[1..])).collect())
        }
    }
    Ok(nest(&mut flat.into_iter(), &dims))
}

/// A parameter in TEXT format, as node-postgres's `prepareValue` writes it.
#[derive(Debug, Clone)]
pub struct P(pub Option<String>);

impl P {
    /// `prepareValue` of a JSON value: `null` → NULL, a number → `String(n)`, an array →
    /// `{"a","b"}`, an object → its JSON.
    pub fn of(v: &Value) -> P {
        match v {
            Value::Null => P(None),
            Value::Bool(b) => P(Some(b.to_string())),
            Value::Number(n) => P(Some(match n.as_f64() {
                Some(f) if (!n.is_i64() && !n.is_u64()) || f.abs() > 9_007_199_254_740_992.0 => crate::js::number_string(f),
                _ => n.to_string(),
            })),
            Value::String(s) => P(Some(s.clone())),
            Value::Array(items) => P(Some(array_string(items))),
            Value::Object(_) => P(Some(basedb_base::idempotency::js_stringify(v))),
        }
    }
    pub fn text(s: impl Into<String>) -> P {
        P(Some(s.into()))
    }
}

fn array_string(items: &[Value]) -> String {
    let mut out = String::from("{");
    for (i, v) in items.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        match v {
            Value::Null => out.push_str("NULL"),
            Value::Array(inner) => out.push_str(&array_string(inner)),
            other => {
                let text = P::of(other).0.unwrap_or_default();
                out.push('"');
                out.push_str(&text.replace('\\', "\\\\").replace('"', "\\\""));
                out.push('"');
            }
        }
    }
    out.push('}');
    out
}

impl ToSql for P {
    fn to_sql(&self, _: &Type, out: &mut BytesMut) -> Result<IsNull, BoxErr> {
        match &self.0 {
            None => Ok(IsNull::Yes),
            Some(s) => {
                out.extend_from_slice(s.as_bytes());
                Ok(IsNull::No)
            }
        }
    }
    fn accepts(_: &Type) -> bool {
        true
    }
    fn encode_format(&self, _: &Type) -> Format {
        Format::Text
    }
    postgres_types::to_sql_checked!();
}

/// The parameters as the `&[&dyn ToSql]` tokio-postgres asks for.
pub fn refs(params: &[P]) -> Vec<&(dyn ToSql + Sync)> {
    params.iter().map(|p| p as &(dyn ToSql + Sync)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn numeric(ndigits: i16, weight: i16, sign: u16, dscale: i16, digits: &[i16]) -> Vec<u8> {
        let mut v = Vec::new();
        for x in [ndigits, weight, sign as i16, dscale] {
            v.extend_from_slice(&x.to_be_bytes());
        }
        for d in digits {
            v.extend_from_slice(&d.to_be_bytes());
        }
        v
    }

    #[test]
    fn numerics_keep_their_scale() {
        assert_eq!(numeric_text(&numeric(2, 0, 0, 2, &[12, 3400])).unwrap(), "12.34");
        assert_eq!(numeric_text(&numeric(1, 1, 0x4000, 0, &[5])).unwrap(), "-50000");
        assert_eq!(numeric_text(&numeric(1, -1, 0, 6, &[50])).unwrap(), "0.005000");
        assert_eq!(numeric_text(&numeric(0, 0, 0, 10, &[])).unwrap(), "0.0000000000");
        assert_eq!(numeric_text(&numeric(2, 1, 0, 1, &[1, 2])).unwrap(), "10002.0");
    }

    #[test]
    fn parameters_as_prepare_value() {
        assert_eq!(P::of(&serde_json::json!(["a\"b", 1.5, null, "c\\"])).0.unwrap(), r#"{"a\"b","1.5",NULL,"c\\"}"#);
        assert_eq!(P::of(&serde_json::json!(3)).0.unwrap(), "3");
        assert_eq!(P::of(&serde_json::json!(true)).0.unwrap(), "true");
    }

    #[test]
    fn timestamps_and_dates_as_postgres_writes_them() {
        let micros = |m: i64| m.to_be_bytes();
        // 2026-03-01 10:30:00.1234 is 825 676 200.1234 s after 2000-01-01.
        assert_eq!(timestamp_text(&micros(825_676_200_123_400)).unwrap(), "2026-03-01 10:30:00.1234");
        assert_eq!(timestamp_text(&micros(0)).unwrap(), "2000-01-01 00:00:00");
        assert_eq!(timestamp_text(&micros(i64::MAX)).unwrap(), "infinity");
        let days = |d: i32| d.to_be_bytes();
        assert_eq!(date_text(&days(-730_485)).unwrap(), "0001-01-01 BC");
        assert_eq!(date_text(&days(0)).unwrap(), "2000-01-01");
        assert_eq!(decode(&Type::INTERVAL, &[0; 16], false).unwrap(), serde_json::json!({}));
        assert_eq!(decode(&Type::TIMESTAMPTZ, &micros(i64::MIN), false).unwrap(), Value::Null);
    }
}
