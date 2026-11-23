//! How a field reads and what a row created without it takes (`catalog/formats.ts`,
//! `records/defaults.ts#setFieldDefault`): catalog writes only, no migration.

use crate::js::{is_uuid_ci, js_number, js_to_number};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_field;
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use chrono::{Datelike, NaiveDate, NaiveDateTime, NaiveTime, TimeZone};
use regex::Regex;
use serde_json::{json, Value};
use std::sync::{LazyLock, OnceLock};

type R<T> = Result<T, AppError>;

// ------------------------------------------------------------------------------------
// Formats

pub const NUMBER_FORMATS: [&str; 6] = ["decimal", "integer", "percent", "currency", "duration", "rating"];
pub const TEXT_FORMATS: [&str; 4] = ["plain", "phone", "barcode", "address"];

/// `FieldFormat`.
#[derive(Debug, Clone, PartialEq)]
pub struct FieldFormat {
    pub display: String,
    pub currency: Option<String>,
    /// The number as the caller wrote it (`5`, `5.0` read as 5).
    pub rating_max: Option<i32>,
}

impl FieldFormat {
    /// `{display, currency, rating_max}`, as the API answers it.
    pub fn to_json(&self) -> Value {
        json!({ "display": self.display, "currency": self.currency, "rating_max": self.rating_max })
    }
}

fn refuse_format(reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("format")).with("reason", json!(reason))
}

/// `input.key ?? fallback`: absent and `null` both take the fallback.
fn given<'a>(input: &'a Value, key: &str) -> Option<&'a Value> {
    input.get(key).filter(|v| !v.is_null())
}

/// `normalizeFormat`: `input` is any JSON object (an array reads as one with no key).
pub fn normalize_format(kind: &str, input: &Value) -> R<FieldFormat> {
    if kind != "number" && kind != "short_text" {
        return Err(refuse_format("type_sans_format"));
    }
    let allowed: &[&str] = if kind == "number" { &NUMBER_FORMATS } else { &TEXT_FORMATS };
    let display = match given(input, "display") {
        None => if kind == "number" { "decimal" } else { "plain" }.to_string(),
        Some(Value::String(s)) if allowed.contains(&s.as_str()) => s.clone(),
        Some(_) => return Err(refuse_format("format_inconnu")),
    };
    let mut currency = None;
    if display == "currency" {
        let code = match given(input, "currency") {
            None => "EUR".to_string(),
            Some(Value::String(s)) => s.to_uppercase(),
            Some(_) => return Err(refuse_format("devise_invalide")),
        };
        if code.chars().count() != 3 || !code.chars().all(|c| c.is_ascii_uppercase()) {
            return Err(refuse_format("devise_invalide"));
        }
        currency = Some(code);
    }
    let mut rating_max = None;
    if display == "rating" {
        let max = match given(input, "rating_max") {
            None => 5.0,
            Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
            Some(_) => return Err(refuse_format("note_invalide")),
        };
        if max.fract() != 0.0 || !(1.0..=10.0).contains(&max) {
            return Err(refuse_format("note_invalide"));
        }
        rating_max = Some(max as i32);
    }
    Ok(FieldFormat { display, currency, rating_max })
}

/// `writeFormat`: into the satellite, then the field row touched so `catalog_version` moves.
pub async fn write_format<E: Exec + Sync>(exec: &E, field_id: &str, kind: &str, format: &FieldFormat) -> R<()> {
    if kind == "number" {
        exec.execute_op(
            "UPDATE _basedb.field_number_config
                SET display_format = $2, currency_code = $3, rating_max = $4::int4
              WHERE field_id = $1::text::uuid",
            &[&field_id, &format.display, &format.currency, &format.rating_max],
            SqlOp::Update,
        )
        .await?;
    } else {
        exec.execute_op(
            "UPDATE _basedb.field_text_config SET display_format = $2 WHERE field_id = $1::text::uuid",
            &[&field_id, &format.display],
            SqlOp::Update,
        )
        .await?;
    }
    exec.execute_op("UPDATE _basedb.field SET updated_at = clock_timestamp() WHERE id = $1::text::uuid", &[&field_id], SqlOp::Update).await?;
    Ok(())
}

/// `setFieldFormat`.
pub async fn set_field_format(pools: &Pools, ctx: &RequestContext, field_id: &str, input: &Value) -> R<FieldFormat> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_field(&tx, ctx, Action::ManageSchema, field_id).await?;
        let row = tx.first("SELECT kind FROM _basedb.field WHERE id = $1::text::uuid AND is_live", &[&field_id]).await?;
        let Some(row) = row else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
        };
        let kind: String = row.get(0);
        let format = normalize_format(&kind, input)?;
        write_format(&tx, field_id, &kind, &format).await?;
        Ok(format)
    })
    .await
}

// ------------------------------------------------------------------------------------
// Defaults

/// What sanitizes a rich text — `records/rich-text.ts`, which the records crate owns: the
/// server hands it over at start ([`set_rich_text_sanitizer`]).
static RICH_TEXT: OnceLock<fn(&str) -> String> = OnceLock::new();

/// Installs the rich-text sanitizer a default of a rich long text goes through.
pub fn set_rich_text_sanitizer(sanitize: fn(&str) -> String) {
    let _ = RICH_TEXT.set(sanitize);
}

fn sanitize_rich_text(html: &str) -> R<String> {
    RICH_TEXT.get().map(|f| f(html)).ok_or_else(|| AppError::internal("rich text sanitizer not installed"))
}

/// `DEFAULTS_BY_KIND`.
fn defaults_of(kind: &str) -> Option<&'static [&'static str]> {
    Some(match kind {
        "short_text" | "long_text" | "number" | "boolean" | "select" | "multi_select" | "url" | "email" => &["value"],
        "date" => &["value", "today"],
        "datetime" => &["value", "now"],
        "user" => &["value", "me"],
        _ => return None,
    })
}

fn refuse_default(reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("default")).with("reason", json!(reason))
}

fn value_invalid(field: &str, reason: &str) -> AppError {
    AppError::new("VALUE_INVALID").with("field", json!(field)).with("reason", json!(reason))
}

struct DefaultedField<'a> {
    id: &'a str,
    name: &'a str,
    kind: &'a str,
    rich: bool,
    max_length: Option<i64>,
}

static DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})$").unwrap());
pub(crate) static URL_PATTERN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(https?://[^\s]+|mailto:[^\s@]+@[^\s]+)$").unwrap());
static EMAIL_PATTERN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").unwrap());
static BARE_EMAIL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^[^\s@]+@[^\s@]+\.[a-z]{2,}$").unwrap());
static BARE_DOMAIN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^[^\s/@:]+\.[a-z]{2,}(:\d+)?([/?#][^\n\r\u2028\u2029]*)?$").unwrap());
static SCHEME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(https?://|mailto:)").unwrap());
static MAILTO: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^mailto:").unwrap());

/// `shapeChoices`.
pub fn shape_choices(field: &str, value: &Value) -> R<Option<Vec<String>>> {
    match value {
        Value::Null => return Ok(None),
        Value::String(s) if s.is_empty() => return Ok(None),
        _ => {}
    }
    let items: Vec<&Value> = match value {
        Value::Array(a) => a.iter().collect(),
        v => vec![v],
    };
    let mut seen: indexmap::IndexSet<String> = indexmap::IndexSet::new();
    for item in items {
        let Some(s) = item.as_str().filter(|s| !s.contains('\0')) else {
            return Err(value_invalid(field, "liste_de_textes"));
        };
        let trimmed = crate::description::js_trim(s);
        if !trimmed.is_empty() {
            seen.insert(trimmed.to_string());
        }
    }
    Ok((!seen.is_empty()).then(|| seen.into_iter().collect()))
}

/// `shapeUrl`.
pub fn shape_url(field: &str, value: &Value) -> R<Option<String>> {
    let text = match value {
        Value::Null => return Ok(None),
        Value::String(s) => crate::description::js_trim(s),
        _ => return Err(value_invalid(field, "adresse_url")),
    };
    if text.is_empty() {
        return Ok(None);
    }
    let with_scheme = if SCHEME.is_match(text) {
        text.to_string()
    } else if BARE_EMAIL.is_match(text) {
        format!("mailto:{text}")
    } else if BARE_DOMAIN.is_match(text) {
        format!("https://{text}")
    } else {
        text.to_string()
    };
    if crate::js::js_length(&with_scheme) > crate::operations::MAX_URL_CHARS || !URL_PATTERN.is_match(&with_scheme) {
        return Err(value_invalid(field, "adresse_url"));
    }
    Ok(Some(with_scheme))
}

/// `shapeEmail`.
pub fn shape_email(field: &str, value: &Value) -> R<Option<String>> {
    let text = match value {
        Value::Null => return Ok(None),
        Value::String(s) => MAILTO.replace(crate::description::js_trim(s), "").into_owned(),
        _ => return Err(value_invalid(field, "adresse_email")),
    };
    if text.is_empty() {
        return Ok(None);
    }
    if crate::js::js_length(&text) > crate::operations::MAX_EMAIL_CHARS || !EMAIL_PATTERN.is_match(&text) {
        return Err(value_invalid(field, "adresse_email"));
    }
    Ok(Some(text))
}

/// `shapeUser`: a person of the table's tenant, not deleted.
async fn shape_user<E: Exec + Sync>(exec: &E, name: &str, field_id: &str, value: &Value) -> R<Option<String>> {
    let id = match value {
        Value::Null => return Ok(None),
        Value::String(s) if s.is_empty() => return Ok(None),
        Value::String(s) => Some(s.as_str()),
        Value::Object(o) => o.get("id").and_then(Value::as_str),
        _ => None,
    };
    let Some(id) = id.filter(|id| is_uuid_ci(id)) else {
        return Err(value_invalid(name, "personne_inconnue"));
    };
    let row = exec
        .first(
            "SELECT u.id::text
               FROM _basedb.app_user u
               JOIN _basedb.field f ON f.id = $2::text::uuid
               JOIN _basedb.base b  ON b.id = f.base_id
              WHERE u.id = $1::text::uuid AND u.tenant_id = b.tenant_id
                AND u.deleted_at IS NULL AND (NOT u.is_system OR u.is_instance_admin)",
            &[&id, &field_id],
        )
        .await?;
    match row {
        Some(r) => Ok(Some(r.get(0))),
        None => Err(value_invalid(name, "personne_inconnue")),
    }
}

/// `Date.UTC(y, m - 1, d)` read back as `YYYY-MM-DD` is the text itself.
fn is_calendar_date(text: &str) -> bool {
    let Some(c) = DATE.captures(text) else { return false };
    let (y, m, d): (i32, u32, u32) = (c[1].parse().unwrap_or(0), c[2].parse().unwrap_or(0), c[3].parse().unwrap_or(0));
    // `Date.UTC` reads a year below 100 as 19xx: the text never comes back.
    y >= 100 && NaiveDate::from_ymd_opt(y, m, d).is_some()
}

/// `Date.parse` for its ISO forms — the date alone (UTC), the date and time with or
/// without a zone (none: the local zone, like Node's). `None` for anything else.
pub fn js_date_parse(text: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    static ISO: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"^([+-]\d{6}|\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$").unwrap()
    });
    let c = ISO.captures(text)?;
    let year: i32 = c[1].parse().ok()?;
    let month: u32 = c.get(2).map_or(Some(1), |m| m.as_str().parse().ok())?;
    let day: u32 = c.get(3).map_or(Some(1), |m| m.as_str().parse().ok())?;
    let date = NaiveDate::from_ymd_opt(year, month, day)?;
    let Some(hour) = c.get(4) else {
        return Some(chrono::Utc.from_utc_datetime(&date.and_hms_opt(0, 0, 0)?));
    };
    let hour: u32 = hour.as_str().parse().ok()?;
    let minute: u32 = c[5].parse().ok()?;
    let second: u32 = c.get(6).map_or(Some(0), |m| m.as_str().parse().ok())?;
    let millis: u32 = c.get(7).map_or(Some(0), |m| format!("{:0<3}", &m.as_str()[..m.as_str().len().min(3)]).parse().ok())?;
    let (time, extra_day) = if hour == 24 && minute == 0 && second == 0 && millis == 0 {
        (NaiveTime::from_hms_opt(0, 0, 0)?, true)
    } else {
        (NaiveTime::from_hms_milli_opt(hour, minute, second, millis)?, false)
    };
    let mut local = NaiveDateTime::new(date, time);
    if extra_day {
        local += chrono::Duration::days(1);
    }
    match c.get(8).map(|m| m.as_str()) {
        Some("Z") => Some(chrono::Utc.from_utc_datetime(&local)),
        Some(offset) => {
            let sign = if offset.starts_with('-') { -1 } else { 1 };
            let h: i64 = offset[1..3].parse().ok()?;
            let m: i64 = offset[4..6].parse().ok()?;
            Some(chrono::Utc.from_utc_datetime(&(local - chrono::Duration::minutes(sign * (h * 60 + m)))))
        }
        None => chrono::Local.from_local_datetime(&local).earliest().map(|d| d.with_timezone(&chrono::Utc)),
    }
}

/// `Date.prototype.toISOString`.
pub fn js_iso(at: chrono::DateTime<chrono::Utc>) -> String {
    if (0..=9999).contains(&at.year()) {
        at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
    } else {
        let sign = if at.year() < 0 { '-' } else { '+' };
        format!("{sign}{:06}{}", at.year().abs(), at.format("-%m-%dT%H:%M:%S%.3fZ"))
    }
}

/// `columnForm`: the value as a write would store it.
async fn column_form<E: Exec + Sync>(exec: &E, field: &DefaultedField<'_>, value: &Value) -> R<Value> {
    let wrong = || value_invalid(field.name, "valeur_par_defaut");
    match field.kind {
        "short_text" | "long_text" => {
            let Some(s) = value.as_str().filter(|s| !s.contains('\0')) else { return Err(wrong()) };
            let text = if field.rich { sanitize_rich_text(s)? } else { s.to_string() };
            if crate::description::js_trim(&text).is_empty() {
                return Err(wrong());
            }
            if let Some(max) = field.max_length {
                if text.chars().count() as i64 > max {
                    return Err(AppError::new("VALUE_OUT_OF_RANGE").with("field", json!(field.name)).with("reason", json!("trop_long")).with("maximum", json!(max)));
                }
            }
            Ok(json!(text))
        }
        "number" => {
            let n = match value {
                Value::String(s) if !crate::description::js_trim(s).is_empty() => js_to_number(s),
                Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
                _ => return Err(wrong()),
            };
            if n.is_finite() {
                Ok(js_number(n))
            } else {
                Err(wrong())
            }
        }
        "boolean" => value.as_bool().map(Value::Bool).ok_or_else(wrong),
        "date" => match value.as_str() {
            Some(s) if is_calendar_date(s) => Ok(json!(s)),
            _ => Err(wrong()),
        },
        "datetime" => value.as_str().and_then(js_date_parse).map(|t| json!(js_iso(t))).ok_or_else(wrong),
        "select" | "multi_select" => {
            let choices = if field.kind == "select" {
                match value.as_str() {
                    Some(s) => Some(vec![s.to_string()]),
                    None => return Err(wrong()),
                }
            } else {
                shape_choices(field.name, value)?
            };
            let Some(choices) = choices.filter(|c| !c.is_empty()) else { return Err(wrong()) };
            let live = exec
                .rows(
                    "SELECT value FROM _basedb.select_option
                      WHERE field_id = $1::text::uuid AND deleted_at IS NULL AND value = ANY($2::text[])",
                    &[&field.id, &choices],
                )
                .await?;
            let distinct: std::collections::HashSet<&String> = choices.iter().collect();
            if live.len() != distinct.len() {
                return Err(value_invalid(field.name, "choix_inconnu"));
            }
            Ok(if field.kind == "select" { json!(choices[0]) } else { json!(choices) })
        }
        "url" => shape_url(field.name, value)?.map(Value::String).ok_or_else(wrong),
        "email" => shape_email(field.name, value)?.map(Value::String).ok_or_else(wrong),
        "user" => shape_user(exec, field.name, field.id, value).await?.map(Value::String).ok_or_else(wrong),
        _ => Err(wrong()),
    }
}

/// `normalizeDefault`: `{kind}` or `{kind: 'value', value}`.
async fn normalize_default<E: Exec + Sync>(exec: &E, field: &DefaultedField<'_>, input: &Value) -> R<Value> {
    let Some(accepted) = defaults_of(field.kind) else {
        return Err(refuse_default("type_sans_valeur_par_defaut"));
    };
    let Value::Object(o) = input else {
        return Err(refuse_default("objet_attendu"));
    };
    let kind = match o.get("kind") {
        Some(Value::String(k)) if accepted.contains(&k.as_str()) => k.as_str(),
        _ => return Err(refuse_default("genre_inconnu")),
    };
    if kind != "value" {
        return Ok(json!({ "kind": kind }));
    }
    let value = match o.get("value") {
        None | Some(Value::Null) => return Err(refuse_default("valeur_vide")),
        Some(Value::String(s)) if s.is_empty() => return Err(refuse_default("valeur_vide")),
        Some(v) => v,
    };
    Ok(json!({ "kind": "value", "value": column_form(exec, field, value).await? }))
}

/// `setFieldDefault`: sets, or removes (`null`), a field's default; the default written.
pub async fn set_field_default(pools: &Pools, ctx: &RequestContext, field_id: &str, input: &Value) -> R<Value> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_field(&tx, ctx, Action::ManageSchema, field_id).await?;
        let row = tx
            .first(
                "SELECT f.kind, n.name, coalesce(tc.is_rich, false) AS is_rich, tc.max_length::int8,
                        EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n ON n.id = f.name_id
                   LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
                  WHERE f.id = $1::text::uuid AND f.is_live",
                &[&field_id],
            )
            .await?;
        let Some(row) = row else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
        };
        if input.is_null() {
            tx.execute_op("DELETE FROM _basedb.field_default WHERE field_id = $1::text::uuid", &[&field_id], SqlOp::Delete).await?;
            return Ok(Value::Null);
        }
        let (kind, name, rich, max_length, has_ai): (String, String, bool, Option<i64>, bool) = (row.get(0), row.get(1), row.get(2), row.get(3), row.get(4));
        if has_ai {
            return Err(refuse_default("champ_calcule"));
        }
        let field = DefaultedField { id: field_id, name: &name, kind: &kind, rich, max_length };
        let normalized = normalize_default(&tx, &field, input).await?;
        let stored: Option<String> = normalized.get("value").map(Value::to_string);
        let by: Option<&str> = (ctx.actor.kind == ActorKind::User).then_some(ctx.actor.id.as_str());
        tx.execute_op(
            "INSERT INTO _basedb.field_default (field_id, kind, value, updated_by)
             VALUES ($1::text::uuid, $2, $3::text::jsonb, $4::text::uuid)
             ON CONFLICT (field_id) DO UPDATE
                SET kind = EXCLUDED.kind, value = EXCLUDED.value,
                    updated_by = EXCLUDED.updated_by, updated_at = clock_timestamp()",
            &[&field_id, &normalized["kind"].as_str(), &stored, &by],
            SqlOp::Insert,
        )
        .await?;
        Ok(normalized)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_are_node_s() {
        let f = normalize_format("number", &json!({ "display": "currency", "currency": "usd" })).unwrap();
        assert_eq!(f.to_json(), json!({ "display": "currency", "currency": "USD", "rating_max": null }));
        assert_eq!(normalize_format("number", &json!({ "display": "rating" })).unwrap().rating_max, Some(5));
        assert_eq!(normalize_format("short_text", &json!([])).unwrap().display, "plain");
        let reason = |k: &str, v: Value| normalize_format(k, &v).unwrap_err().details["reason"].clone();
        assert_eq!(reason("date", json!({})), json!("type_sans_format"));
        assert_eq!(reason("number", json!({ "display": "phone" })), json!("format_inconnu"));
        assert_eq!(reason("number", json!({ "display": "currency", "currency": "EURO" })), json!("devise_invalide"));
        assert_eq!(reason("number", json!({ "display": "rating", "rating_max": 11 })), json!("note_invalide"));
        assert_eq!(reason("number", json!({ "display": "rating", "rating_max": 2.5 })), json!("note_invalide"));
    }

    #[test]
    fn dates_parse_as_javascript_does() {
        assert!(is_calendar_date("2024-02-29"));
        assert!(!is_calendar_date("2023-02-29"));
        assert!(!is_calendar_date("0050-01-01"));
        assert_eq!(js_date_parse("2024-03-01T10:00:00Z").map(js_iso).as_deref(), Some("2024-03-01T10:00:00.000Z"));
        assert_eq!(js_date_parse("2024-03-01T10:00:00.5+02:00").map(js_iso).as_deref(), Some("2024-03-01T08:00:00.500Z"));
        assert_eq!(js_date_parse("2024-03-01").map(js_iso).as_deref(), Some("2024-03-01T00:00:00.000Z"));
        assert!(js_date_parse("demain").is_none());
    }

    #[test]
    fn addresses_are_shaped() {
        assert_eq!(shape_url("u", &json!(" exemple.fr/tarifs ")).unwrap().as_deref(), Some("https://exemple.fr/tarifs"));
        assert_eq!(shape_url("u", &json!("a@b.fr")).unwrap().as_deref(), Some("mailto:a@b.fr"));
        assert!(shape_url("u", &json!("pas une adresse")).is_err());
        assert_eq!(shape_email("e", &json!("MAILTO:a@b.fr")).unwrap().as_deref(), Some("a@b.fr"));
        assert_eq!(shape_choices("c", &json!([" a", "a", "b", ""])).unwrap(), Some(vec!["a".to_string(), "b".to_string()]));
    }
}
