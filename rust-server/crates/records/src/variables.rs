//! Variables in a long text — `records/variables.ts`, chapter 04 §2.2: `{{nom_physique}}`
//! replaced by the row's value, as THIS reader sees it.

use basedb_base::db::Exec;
use basedb_base::error::AppError;
use chrono::{DateTime, Utc};
use regex::Regex;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use crate::pg::P;

static VARIABLE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{\s*([a-z0-9_]+)\s*\}\}").unwrap());
static JS_ISO: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[+-]?\d{4,6}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$").unwrap());

pub fn has_variables(text: &Value) -> bool {
    text.as_str().is_some_and(|t| VARIABLE.is_match(t))
}

#[derive(Clone, Debug)]
pub struct VariableColumn {
    pub name: String,
    pub kind: String,
    pub rich: bool,
}

pub struct Scope {
    pub readable: HashMap<String, VariableColumn>,
    pub known: HashSet<String>,
    pub labels: HashMap<String, HashMap<String, String>>,
    pub people: HashMap<String, String>,
    pub iso: bool,
    pub timezone: String,
}

fn day_text(value: &str, iso: bool) -> String {
    static DAY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})").unwrap());
    let Some(m) = DAY.captures(value) else { return value.to_string() };
    if iso {
        format!("{}-{}-{}", &m[1], &m[2], &m[3])
    } else {
        format!("{}/{}/{}", &m[3], &m[2], &m[1])
    }
}

fn instant_text(value: &str, iso: bool, timezone: &str) -> String {
    let Ok(at) = DateTime::parse_from_rfc3339(value).map(|d| d.with_timezone(&Utc)) else { return value.to_string() };
    let tz: chrono_tz::Tz = timezone.parse().unwrap_or(chrono_tz::UTC);
    let local = at.with_timezone(&tz);
    let day = if iso { local.format("%Y-%m-%d") } else { local.format("%d/%m/%Y") };
    format!("{day} {}", local.format("%H:%M"))
}

/// `String(value)` of JavaScript, for a JSON value.
fn js_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        Value::Array(a) => a.iter().map(|v| if v.is_null() { String::new() } else { js_string(v) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.as_f64().map(crate::js::number_string).unwrap_or_else(|| n.to_string()),
    }
}

/// `textOfValue`.
pub fn text_of_value(value: Option<&Value>, column: &VariableColumn, scope: &Scope) -> String {
    let value = match value {
        None | Some(Value::Null) => return String::new(),
        Some(Value::String(s)) if s.is_empty() => return String::new(),
        Some(v) => v,
    };
    let label = |v: &Value| {
        let key = js_string(v);
        scope.labels.get(&column.name).and_then(|l| l.get(&key)).cloned().unwrap_or(key)
    };
    let display = |v: &Value| match v {
        Value::Object(o) => match o.get("display") {
            None | Some(Value::Null) => String::new(),
            Some(d) => js_string(d),
        },
        other => js_string(other),
    };
    match column.kind.as_str() {
        "link" => display(value),
        "multi_link" => match value {
            Value::Array(a) => a.iter().map(display).filter(|t| !t.is_empty()).collect::<Vec<_>>().join(", "),
            _ => String::new(),
        },
        "select" => label(value),
        "multi_select" => match value {
            Value::Array(a) => a.iter().map(label).collect::<Vec<_>>().join(", "),
            other => label(other),
        },
        "user" => scope.people.get(&js_string(value)).cloned().unwrap_or_default(),
        "boolean" => if value == &Value::Bool(true) { "oui" } else { "non" }.into(),
        "date" => day_text(&js_string(value), scope.iso),
        "datetime" => instant_text(&js_string(value), scope.iso, &scope.timezone),
        "number" => {
            static ZEROS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\.\d*?)0+$").unwrap());
            let s = js_string(value);
            let s = ZEROS.replace(&s, "$1").into_owned();
            s.strip_suffix('.').map(str::to_string).unwrap_or(s)
        }
        "long_text" => {
            let raw = js_string(value);
            let text = if column.rich { rich_text_to_plain(&raw) } else { raw };
            crate::js::js_trim(&VARIABLE.replace_all(&text, "")).to_string()
        }
        "file" | "image" => match value {
            Value::Array(a) => a
                .iter()
                .map(|f| match f.get("name") {
                    None | Some(Value::Null) => String::new(),
                    Some(n) => js_string(n),
                })
                .collect::<Vec<_>>()
                .join(", "),
            _ => String::new(),
        },
        _ => match value {
            Value::Array(a) => {
                let plain = VariableColumn { kind: String::new(), ..column.clone() };
                a.iter().map(|v| text_of_value(Some(v), &plain, scope)).collect::<Vec<_>>().join(", ")
            }
            // Node holds a computed instant (or an element of a `date[]`) as a `Date`, which
            // reads as an instant; here it is already its `toISOString()`.
            Value::String(s) if matches!(column.kind.as_str(), "formula" | "rollup" | "lookup" | "") && JS_ISO.is_match(s) => {
                instant_text(s, scope.iso, &scope.timezone)
            }
            Value::Object(_) => basedb_base::idempotency::js_stringify(value),
            other => js_string(other),
        },
    }
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// `resolveText`.
pub fn resolve_text(text: &str, row: &serde_json::Map<String, Value>, scope: &Scope, html: bool) -> String {
    VARIABLE
        .replace_all(text, |c: &regex::Captures| {
            let name = &c[1];
            match scope.readable.get(name) {
                None => {
                    if scope.known.contains(name) {
                        String::new()
                    } else {
                        c[0].to_string()
                    }
                }
                Some(column) => {
                    let value = text_of_value(row.get(name), column, scope);
                    if html {
                        escape_html(&value)
                    } else {
                        value
                    }
                }
            }
        })
        .into_owned()
}

/// `citedNames`, in order of first citation.
pub fn cited_names<'a>(texts: impl Iterator<Item = &'a str>) -> indexmap::IndexSet<String> {
    let mut names = indexmap::IndexSet::new();
    for text in texts {
        for c in VARIABLE.captures_iter(text) {
            names.insert(c[1].to_string());
        }
    }
    names
}

pub use crate::html::rich_text_to_plain;

/// `loadScopeExtras`.
pub async fn load_scope_extras<E: Exec + Sync>(
    exec: &E,
    table_id: &str,
    actor_id: &str,
    choice_fields: &[String],
    people: &[String],
) -> Result<(HashMap<String, HashMap<String, String>>, HashMap<String, String>, bool, String), AppError> {
    let mut labels: HashMap<String, HashMap<String, String>> = HashMap::new();
    if !choice_fields.is_empty() {
        let rows = exec
            .rows(
                "SELECT n.name AS field, o.value, o.label
                   FROM _basedb.select_option o
                   JOIN _basedb.field f ON f.id = o.field_id
                   JOIN _basedb.physical_name n ON n.id = f.name_id
                  WHERE f.table_id = $1::text::uuid AND f.is_live AND o.deleted_at IS NULL AND n.name = ANY($2::text[])",
                &[&table_id, &P::of(&serde_json::json!(choice_fields))],
            )
            .await?;
        for r in rows {
            labels.entry(r.get(0)).or_default().insert(r.get(1), r.get(2));
        }
    }
    let mut names = HashMap::new();
    let ids: Vec<&String> = people.iter().filter(|id| crate::js::is_uuid_shape(id)).collect();
    if !ids.is_empty() {
        let rows = exec
            .rows(
                "SELECT id::text, coalesce(nullif(display_name, ''), email) AS name
                   FROM _basedb.app_user WHERE id = ANY($1::uuid[])",
                &[&P::of(&serde_json::json!(ids))],
            )
            .await?;
        for r in rows {
            names.insert(r.get(0), r.get(1));
        }
    }
    let reader = exec
        .first("SELECT date_format, timezone FROM _basedb.app_user WHERE id = $1::text::uuid", &[&actor_id])
        .await?;
    let (iso, timezone) = match reader {
        Some(r) => (r.get::<_, Option<String>>(0).as_deref() == Some("iso"), r.get::<_, Option<String>>(1).unwrap_or_else(|| "Europe/Paris".into())),
        None => (false, "Europe/Paris".into()),
    };
    Ok((labels, names, iso, timezone))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scope() -> Scope {
        Scope { readable: HashMap::new(), known: HashSet::new(), labels: HashMap::new(), people: HashMap::new(), iso: false, timezone: "Europe/Paris".into() }
    }

    #[test]
    fn values_read_as_a_sentence() {
        let s = scope();
        let col = |kind: &str| VariableColumn { name: "c".into(), kind: kind.into(), rich: false };
        assert_eq!(text_of_value(Some(&Value::String("12.500".into())), &col("number"), &s), "12.5");
        assert_eq!(text_of_value(Some(&Value::String("12.000".into())), &col("number"), &s), "12");
        assert_eq!(text_of_value(Some(&Value::String("2024-03-05".into())), &col("date"), &s), "05/03/2024");
        assert_eq!(text_of_value(Some(&Value::String("2024-03-05T23:30:00.000Z".into())), &col("datetime"), &s), "06/03/2024 00:30");
        assert_eq!(text_of_value(Some(&Value::Bool(false)), &col("boolean"), &s), "non");
        assert_eq!(text_of_value(Some(&serde_json::json!({"id": "x", "display": "Lumen"})), &col("link"), &s), "Lumen");
        // A computed instant, and the elements of a looked-up `date[]`, read as instants.
        assert_eq!(text_of_value(Some(&Value::String("2024-03-05T23:30:00.000Z".into())), &col("formula"), &s), "06/03/2024 00:30");
        assert_eq!(text_of_value(Some(&serde_json::json!(["2020-01-14T23:00:00.000Z"])), &col("lookup"), &s), "15/01/2020 00:00");
        assert_eq!(text_of_value(Some(&Value::String("2024-03-05T23:30:00.000Z".into())), &col("short_text"), &s), "2024-03-05T23:30:00.000Z");
    }

    #[test]
    fn citations_resolve_or_vanish() {
        let mut s = scope();
        s.readable.insert("nom".into(), VariableColumn { name: "nom".into(), kind: "short_text".into(), rich: false });
        s.known.insert("secret".into());
        let mut row = serde_json::Map::new();
        row.insert("nom".into(), Value::String("<A&B>".into()));
        assert_eq!(resolve_text("{{ nom }}/{{secret}}/{{autre}}", &row, &s, false), "<A&B>//{{autre}}");
        assert_eq!(resolve_text("{{nom}}", &row, &s, true), "&lt;A&amp;B&gt;");
        assert_eq!(rich_text_to_plain("<p>Un &amp; deux</p><p>trois</p>"), "Un & deux\ntrois");
    }
}
