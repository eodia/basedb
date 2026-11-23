//! What a write's values become before they reach the SQL — `records/values.ts`
//! (`shapeValues`) and the defaults of `records/defaults.ts` a write applies.

use crate::js::{is_uuid_ci, js_trim};
use crate::pg::{col, P};
use basedb_base::db::Exec;
use basedb_base::error::AppError;
use basedb_base::rbac::loader::LoadedField;
use basedb_catalog::js::{js_length, js_order};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::LazyLock;

/// A write's values as `Object.entries` lists them.
pub type Entries = Vec<(String, Value)>;

/// `Object.entries(x)` of what a body carried: an object in JavaScript's key order, an
/// array or a string by index, anything else nothing.
pub fn entries_of(value: &Value) -> Entries {
    match value {
        Value::Object(_) => match js_order(value.clone()) {
            Value::Object(m) => m.into_iter().collect(),
            _ => Vec::new(),
        },
        Value::Array(items) => items.iter().enumerate().map(|(i, v)| (i.to_string(), v.clone())).collect(),
        Value::String(s) => s.encode_utf16().enumerate().map(|(i, u)| (i.to_string(), json!(String::from_utf16_lossy(&[u])))).collect(),
        _ => Vec::new(),
    }
}

pub fn get<'a>(entries: &'a Entries, name: &str) -> Option<&'a Value> {
    entries.iter().find(|(k, _)| k == name).map(|(_, v)| v)
}

#[derive(Debug, Clone)]
pub struct Shaped {
    pub id: String,
    pub kind: String,
    pub rich: bool,
}

pub fn is_file_kind(kind: &str) -> bool {
    kind == "file" || kind == "image"
}

/// `shapedFields`.
pub fn shaped_fields(fields: &[LoadedField]) -> HashMap<String, Shaped> {
    let mut out = HashMap::new();
    for f in fields {
        if f.kind == "long_text" && f.rich {
            out.insert(f.name.clone(), Shaped { id: f.id.clone(), kind: f.kind.clone(), rich: true });
            continue;
        }
        if matches!(f.kind.as_str(), "multi_select" | "multi_link" | "url" | "email" | "user") || is_file_kind(&f.kind) {
            out.insert(f.name.clone(), Shaped { id: f.id.clone(), kind: f.kind.clone(), rich: false });
        }
    }
    out
}

fn invalid(field: &str, reason: &str) -> AppError {
    AppError::new("VALUE_INVALID").with("field", json!(field)).with("reason", json!(reason))
}

/// `shapeValues`: each value of a shaped, writable field in its stored form.
pub async fn shape_values<E: Exec + Sync>(exec: &E, shaped: &HashMap<String, Shaped>, writable: &indexmap::IndexSet<String>, mut values: Entries) -> Result<Entries, AppError> {
    for (name, value) in values.iter_mut() {
        let Some(field) = shaped.get(name.as_str()) else { continue };
        if !writable.contains(name.as_str()) {
            continue;
        }
        let shaped = if field.rich {
            shape_rich_text(name, value)?
        } else {
            match field.kind.as_str() {
                "multi_select" => shape_choices(name, value)?.map(|v| json!(v)).unwrap_or(Value::Null),
                "multi_link" => shape_multi_link(name, value)?.map(|v| json!(v)).unwrap_or(Value::Null),
                "url" => shape_url(name, value)?.map(Value::String).unwrap_or(Value::Null),
                "email" => shape_email(name, value)?.map(Value::String).unwrap_or(Value::Null),
                "user" => shape_user(exec, name, &field.id, value).await?.map(Value::String).unwrap_or(Value::Null),
                _ => shape_files(exec, name, &field.id, value).await?.map(Value::String).unwrap_or(Value::Null),
            }
        };
        *value = shaped;
    }
    Ok(values)
}

fn shape_rich_text(name: &str, value: &Value) -> Result<Value, AppError> {
    match value {
        Value::Null => Ok(Value::Null),
        Value::String(s) => {
            let clean = crate::html::sanitize_rich_text(s);
            Ok(if clean.is_empty() { Value::Null } else { Value::String(clean) })
        }
        _ => Err(invalid(name, "texte_attendu")),
    }
}

fn items(value: &Value) -> Vec<&Value> {
    match value {
        Value::Array(a) => a.iter().collect(),
        v => vec![v],
    }
}

/// `shapeChoices`.
pub fn shape_choices(field: &str, value: &Value) -> Result<Option<Vec<String>>, AppError> {
    if value.is_null() || value.as_str() == Some("") {
        return Ok(None);
    }
    let mut seen: Vec<String> = Vec::new();
    for item in items(value) {
        let Some(s) = item.as_str().filter(|s| !s.contains('\0')) else { return Err(invalid(field, "liste_de_textes")) };
        let t = js_trim(s);
        if !t.is_empty() && !seen.iter().any(|x| x == t) {
            seen.push(t.to_string());
        }
    }
    Ok(if seen.is_empty() { None } else { Some(seen) })
}

/// `shapeMultiLink`.
pub fn shape_multi_link(field: &str, value: &Value) -> Result<Option<Vec<String>>, AppError> {
    if value.is_null() || value.as_str() == Some("") {
        return Ok(None);
    }
    let mut seen: Vec<String> = Vec::new();
    for item in items(value) {
        let id = match item {
            Value::String(s) => Some(s.as_str()),
            Value::Object(m) => m.get("id").and_then(Value::as_str),
            _ => None,
        };
        let Some(id) = id.filter(|s| is_uuid_ci(s)) else { return Err(invalid(field, "identifiant_de_ligne")) };
        let lower = id.to_ascii_lowercase();
        if !seen.contains(&lower) {
            seen.push(lower);
        }
    }
    Ok(if seen.is_empty() { None } else { Some(seen) })
}

const JS_WS: &str = r"\t\n\x0B\x0C\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF";
const MAX_URL_CHARS: usize = 2048;
const MAX_EMAIL_CHARS: usize = 254;
const MAX_FILES_PER_VALUE: usize = 20;

static SCHEME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(?i-u:https?://|mailto:)").unwrap());
static BARE_EMAIL: LazyLock<Regex> = LazyLock::new(|| Regex::new(&format!(r"^[^{JS_WS}@]+@[^{JS_WS}@]+\.[a-zA-Z]{{2,}}$")).unwrap());
static BARE_DOMAIN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"^[^{JS_WS}/@:]+\.[a-zA-Z]{{2,}}(:[0-9]+)?([/?#][^\n\r\u2028\u2029]*)?$")).unwrap());
static URL_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(&format!(r"^((?i-u:https?://)[^{JS_WS}]+|(?i-u:mailto:)[^{JS_WS}@]+@[^{JS_WS}]+)$")).unwrap());
static EMAIL_PATTERN: LazyLock<Regex> = LazyLock::new(|| Regex::new(&format!(r"^[^{JS_WS}@]+@[^{JS_WS}@]+\.[^{JS_WS}@]+$")).unwrap());
static MAILTO: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(?i-u:mailto:)").unwrap());

/// `shapeUrl`.
pub fn shape_url(field: &str, value: &Value) -> Result<Option<String>, AppError> {
    let text = match value {
        Value::Null => return Ok(None),
        Value::String(s) => js_trim(s),
        _ => return Err(invalid(field, "adresse_url")),
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
    if js_length(&with_scheme) > MAX_URL_CHARS || !URL_PATTERN.is_match(&with_scheme) {
        return Err(invalid(field, "adresse_url"));
    }
    Ok(Some(with_scheme))
}

/// `shapeEmail`.
pub fn shape_email(field: &str, value: &Value) -> Result<Option<String>, AppError> {
    let text = match value {
        Value::Null => return Ok(None),
        Value::String(s) => MAILTO.replace(js_trim(s), "").into_owned(),
        _ => return Err(invalid(field, "adresse_email")),
    };
    if text.is_empty() {
        return Ok(None);
    }
    if js_length(&text) > MAX_EMAIL_CHARS || !EMAIL_PATTERN.is_match(&text) {
        return Err(invalid(field, "adresse_email"));
    }
    Ok(Some(text))
}

/// `shapeUser`.
pub async fn shape_user<E: Exec + Sync>(exec: &E, name: &str, field_id: &str, value: &Value) -> Result<Option<String>, AppError> {
    if value.is_null() || value.as_str() == Some("") {
        return Ok(None);
    }
    let id = match value {
        Value::String(s) => Some(s.as_str()),
        Value::Object(m) => m.get("id").and_then(Value::as_str),
        _ => None,
    };
    let Some(id) = id.filter(|s| is_uuid_ci(s)) else { return Err(invalid(name, "personne_inconnue")) };
    let params = [P::text(id), P::text(field_id)];
    let rows = exec
        .rows(
            "SELECT u.id::text
       FROM _basedb.app_user u
       JOIN _basedb.field f ON f.id = $2
       JOIN _basedb.base b  ON b.id = f.base_id
      WHERE u.id = $1::uuid AND u.tenant_id = b.tenant_id
        AND u.deleted_at IS NULL AND (NOT u.is_system OR u.is_instance_admin)",
            &crate::pg::refs(&params),
        )
        .await?;
    match rows.first() {
        None => Err(invalid(name, "personne_inconnue")),
        Some(r) => Ok(col(r, 0).as_str().map(str::to_string)),
    }
}

async fn shape_files<E: Exec + Sync>(exec: &E, name: &str, field_id: &str, value: &Value) -> Result<Option<String>, AppError> {
    if value.is_null() {
        return Ok(None);
    }
    let mut ids: Vec<String> = Vec::new();
    for item in items(value) {
        let id = match item {
            Value::String(s) => Some(s.as_str()),
            Value::Object(m) => m.get("id").and_then(Value::as_str),
            _ => None,
        };
        let Some(id) = id.filter(|s| is_uuid_ci(s)) else { return Err(invalid(name, "reference_de_fichier")) };
        let lower = id.to_ascii_lowercase();
        if !ids.contains(&lower) {
            ids.push(lower);
        }
    }
    if ids.is_empty() {
        return Ok(None);
    }
    if ids.len() > MAX_FILES_PER_VALUE {
        return Err(AppError::new("VALUE_OUT_OF_RANGE")
            .with("field", json!(name))
            .with("reason", json!("trop_de_fichiers"))
            .with("maximum", json!(MAX_FILES_PER_VALUE)));
    }
    let params = [P::text(field_id), P::of(&json!(ids))];
    let rows = exec
        .rows(
            "SELECT id, name, mime_type, size_bytes
       FROM _basedb.stored_file
      WHERE field_id = $1 AND id = ANY($2::uuid[])",
            &crate::pg::refs(&params),
        )
        .await?;
    let found: HashMap<String, serde_json::Map<String, Value>> = rows
        .iter()
        .map(crate::pg::row_object)
        .map(|r| (r.get("id").and_then(Value::as_str).unwrap_or_default().to_string(), r))
        .collect();
    let mut files = Vec::new();
    for id in &ids {
        let Some(row) = found.get(id) else { return Err(invalid(name, "fichier_inconnu")) };
        let size = match row.get("size_bytes") {
            Some(Value::String(s)) => basedb_catalog::js::js_to_number(s),
            Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
            _ => f64::NAN,
        };
        files.push(json!({
            "id": row.get("id").cloned().unwrap_or(Value::Null),
            "name": row.get("name").cloned().unwrap_or(Value::Null),
            "type": row.get("mime_type").cloned().unwrap_or(Value::Null),
            "size": basedb_catalog::js::js_number(size),
        }));
    }
    Ok(Some(basedb_base::idempotency::js_stringify(&Value::Array(files))))
}

// ── Defaults (`records/defaults.ts`) ──────────────────────────────────────────────

pub const DEFAULT_STILL_VALID: &str = "(fd.kind <> 'value' OR f.kind NOT IN ('select', 'multi_select')
   OR NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements_text(CASE jsonb_typeof(fd.value)
                                        WHEN 'array' THEN fd.value
                                        ELSE jsonb_build_array(fd.value) END) AS v(value)
      WHERE NOT EXISTS (SELECT 1 FROM _basedb.select_option o
                         WHERE o.field_id = f.id AND o.deleted_at IS NULL
                           AND o.value = v.value)))
  AND NOT EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id)";

/// A field's default: `value` carries the stored value.
#[derive(Debug, Clone)]
pub struct FieldDefault {
    pub kind: String,
    pub value: Value,
}

/// `loadDefaults`, in the order PostgreSQL returns them.
pub async fn load_defaults<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<Vec<(String, FieldDefault)>, AppError> {
    let sql = format!(
        "SELECT n.name, fd.kind, fd.value
       FROM _basedb.field_default fd
       JOIN _basedb.field f         ON f.id = fd.field_id
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL
        AND {DEFAULT_STILL_VALID}"
    );
    let params = [P::text(table_id)];
    let rows = exec.rows(&sql, &crate::pg::refs(&params)).await?;
    let mut out: Vec<(String, FieldDefault)> = Vec::new();
    for r in &rows {
        let name = col(r, 0).as_str().unwrap_or_default().to_string();
        let kind = col(r, 1).as_str().unwrap_or_default().to_string();
        let value = if kind == "value" { col(r, 2) } else { Value::Null };
        let d = FieldDefault { kind, value };
        match out.iter_mut().find(|(n, _)| *n == name) {
            Some(slot) => slot.1 = d,
            None => out.push((name, d)),
        }
    }
    Ok(out)
}

/// `todayIn`: the date at `at` in a zone (`en-CA` parts); an unknown zone reads UTC.
pub fn today_in(time_zone: &str, at: DateTime<Utc>) -> String {
    let tz = time_zone.parse::<chrono_tz::Tz>().ok();
    match tz {
        Some(tz) => at.with_timezone(&tz).format("%Y-%m-%d").to_string(),
        None => at.format("%Y-%m-%d").to_string(),
    }
}

/// `resolveDefaults`.
pub fn resolve_defaults(defaults: &[(String, FieldDefault)], actor_id: Option<&str>, time_zone: &str, at: DateTime<Utc>) -> Vec<(String, Value)> {
    let mut out = Vec::new();
    for (name, d) in defaults {
        match d.kind.as_str() {
            "value" => out.push((name.clone(), d.value.clone())),
            "today" => out.push((name.clone(), json!(today_in(time_zone, at)))),
            "now" => out.push((name.clone(), json!(basedb_base::time::iso(at)))),
            _ => {
                if let Some(a) = actor_id {
                    out.push((name.clone(), json!(a)));
                }
            }
        }
    }
    out
}

/// `timeZoneOf`.
pub async fn time_zone_of<E: Exec + Sync>(exec: &E, user_id: Option<&str>) -> Result<String, AppError> {
    let Some(user) = user_id else { return Ok("UTC".into()) };
    let params = [P::text(user)];
    let row = exec.first("SELECT timezone FROM _basedb.app_user WHERE id = $1", &crate::pg::refs(&params)).await?;
    Ok(row.and_then(|r| col(&r, 0).as_str().map(str::to_string)).unwrap_or_else(|| "UTC".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urls_and_emails_shape_as_node() {
        let u = |s: &str| shape_url("f", &json!(s)).ok().flatten();
        assert_eq!(u("  example.com/a b"), None);
        assert_eq!(u("example.com"), Some("https://example.com".into()));
        assert_eq!(u("Example.COM:8080/x?y"), Some("https://Example.COM:8080/x?y".into()));
        assert_eq!(u("a@b.fr"), Some("mailto:a@b.fr".into()));
        assert_eq!(u("HTTP://x"), Some("HTTP://x".into()));
        assert_eq!(u("ftp://x"), None);
        assert_eq!(u("   "), None);
        assert!(shape_url("f", &json!("ftp://x")).is_err());
        assert!(shape_url("f", &json!(3)).is_err());
        let e = |s: &str| shape_email("f", &json!(s)).ok().flatten();
        assert_eq!(e(" MAILTO:a@b.c "), Some("a@b.c".into()));
        assert!(shape_email("f", &json!("a b@c.d")).is_err());
        assert_eq!(e("mailto:"), None);
    }

    #[test]
    fn choices_and_links_shape_as_node() {
        assert_eq!(shape_choices("f", &json!([" a ", "b", "a", ""])).unwrap(), Some(vec!["a".into(), "b".into()]));
        assert_eq!(shape_choices("f", &json!("x")).unwrap(), Some(vec!["x".into()]));
        assert_eq!(shape_choices("f", &json!(["  "])).unwrap(), None);
        assert!(shape_choices("f", &json!([1])).is_err());
        let id = "0190A0B2-0000-7000-8000-000000000001";
        assert_eq!(shape_multi_link("f", &json!([id, { "id": id.to_lowercase() }])).unwrap(), Some(vec![id.to_lowercase()]));
        assert!(shape_multi_link("f", &json!(["nope"])).is_err());
    }

    #[test]
    fn entries_follow_object_entries() {
        let e = entries_of(&json!({ "b": 1, "2": 2, "a": 3, "1": 4 }));
        let keys: Vec<&str> = e.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(keys, ["1", "2", "b", "a"]);
        assert_eq!(entries_of(&json!("ab")).len(), 2);
        assert!(entries_of(&json!(false)).is_empty());
    }

    #[test]
    fn today_reads_the_zone() {
        let at: DateTime<Utc> = "2024-03-01T23:30:00Z".parse().unwrap();
        assert_eq!(today_in("Europe/Paris", at), "2024-03-02");
        assert_eq!(today_in("Nowhere/Land", at), "2024-03-01");
    }
}
