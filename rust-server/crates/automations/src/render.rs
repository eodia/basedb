//! What a run's texts cite, written in (`textOf`, `jsonOf`, `resolve`, `render…`,
//! `valueFor` of `engine.ts`, chapter 17 §1.6).

use crate::defs::{citation, citation_at, compose_json, form_pairs, js_string, js_trim, chars_slice, EMPTY_VALUE, MAX_VALUE_CHARS, TRIGGER_ROW};
use basedb_base::error::AppError;
use basedb_base::idempotency::js_stringify;
use basedb_catalog::js::js_to_number;
use basedb_records::js::number_json;
use indexmap::IndexMap;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use unicode_normalization::UnicodeNormalization;

pub type Row = Map<String, Value>;

/// What a citation needs of a field: its kind, its choices (value, label).
#[derive(Debug, Clone)]
pub struct Field {
    pub kind: String,
    pub options: Vec<(String, String)>,
}

pub type Fields = Arc<IndexMap<String, Field>>;

/// `Held`: a row a step acts on or a text cites.
#[derive(Debug, Clone)]
pub struct Held {
    pub table: String,
    pub fields: Fields,
    pub row: Option<Row>,
}

/// `Citable`: the rows held, what steps gave, the people's names, the moment.
#[derive(Debug, Default)]
pub struct Scope {
    pub rows: IndexMap<String, Held>,
    pub data: Map<String, Value>,
    pub people: HashMap<String, String>,
    pub now: String,
}

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("regex"))
}

/// The kinds whose column is a `numeric`, read back with all its decimals.
const DECIMAL_KINDS: [&str; 3] = ["number", "rollup", "formula"];
/// The kinds a row gives as a text of digits, that a JSON body carries as a number.
const NUMERIC_KINDS: [&str; 3] = ["number", "autonumber", "count"];
/// The kinds a citation reaches as text.
const TEXT_KINDS: [&str; 5] = ["short_text", "long_text", "email", "url", "phone"];

fn label_of<'a>(field: &'a Field, value: &Value) -> Option<&'a str> {
    let v = value.as_str()?;
    field.options.iter().find(|(o, _)| o == v).map(|(_, l)| l.as_str())
}

fn display_of(value: &Value) -> String {
    match value.get("display") {
        None | Some(Value::Null) => String::new(),
        Some(d) => js_string(d),
    }
}

/// `textOf`: a value as a message reads it.
pub fn text_of(value: &Value, field: Option<&Field>, people: &HashMap<String, String>) -> String {
    if value.is_null() {
        return String::new();
    }
    let kind = field.map(|f| f.kind.as_str());
    if kind == Some("link") {
        return if value.is_object() { display_of(value) } else { String::new() };
    }
    if kind == Some("multi_link") {
        if let Some(a) = value.as_array() {
            return a.iter().map(|v| if v.is_object() { display_of(v) } else { String::new() }).collect::<Vec<_>>().join(", ");
        }
    }
    if let (Some("select"), Some(f)) = (kind, field) {
        return label_of(f, value).map(str::to_string).unwrap_or_else(|| js_string(value));
    }
    if let (Some("multi_select"), Some(f), Some(a)) = (kind, field, value.as_array()) {
        return a.iter().map(|v| label_of(f, v).map(str::to_string).unwrap_or_else(|| js_string(v))).collect::<Vec<_>>().join(", ");
    }
    if kind == Some("user") {
        if let Some(s) = value.as_str() {
            return people.get(s).cloned().unwrap_or_default();
        }
    }
    match value {
        Value::Bool(b) => (if *b { "oui" } else { "non" }).into(),
        Value::Array(a) => a.iter().map(|v| if v.is_object() || v.is_array() || v.is_null() { js_stringify(v) } else { js_string(v) }).collect::<Vec<_>>().join(", "),
        Value::Object(_) => js_stringify(value),
        Value::String(s) if kind.is_some_and(|k| DECIMAL_KINDS.contains(&k)) => {
            static DEC: OnceLock<Regex> = OnceLock::new();
            static TAIL: OnceLock<Regex> = OnceLock::new();
            if re(&DEC, r"^-?\d+\.\d+$").is_match(s) {
                re(&TAIL, r"\.?0+$").replace(s, "").into_owned()
            } else {
                s.clone()
            }
        }
        _ => js_string(value),
    }
}

/// `jsonOf`: a value as a JSON body carries it outside a string.
pub fn json_of(value: &Value, field: Option<&Field>, people: &HashMap<String, String>) -> Value {
    match value {
        Value::Null => return Value::Null,
        Value::Number(_) | Value::Bool(_) => return value.clone(),
        _ => {}
    }
    let Some(field) = field else { return value.clone() };
    if let Value::String(s) = value {
        if NUMERIC_KINDS.contains(&field.kind.as_str()) {
            let n = js_to_number(s);
            return if n.is_finite() { number_json(n) } else { value.clone() };
        }
    }
    if field.kind == "multi_link" || field.kind == "multi_select" {
        let single = Field { kind: if field.kind == "multi_link" { "link".into() } else { "select".into() }, options: field.options.clone() };
        let list = match value {
            Value::Array(a) => a.clone(),
            v => vec![v.clone()],
        };
        return Value::Array(list.iter().map(|v| json!(text_of(v, Some(&single), people))).collect());
    }
    if (value.is_object() || value.is_array()) && !["link", "select", "user"].contains(&field.kind.as_str()) {
        return value.clone();
    }
    json!(text_of(value, Some(field), people))
}

/// What a citation found: the value, and the field it was read by.
pub struct Found<'a> {
    pub value: Value,
    pub field: Option<&'a Field>,
}

fn from_row<'a>(held: Option<&'a Held>, name: &str) -> Found<'a> {
    let Some(row) = held.and_then(|h| h.row.as_ref()) else { return Found { value: Value::Null, field: None } };
    let held = held.expect("held");
    if name == "_id" {
        return Found { value: row.get("_id").cloned().unwrap_or(Value::Null), field: None };
    }
    Found { value: row.get(name).cloned().unwrap_or(Value::Null), field: held.fields.get(name) }
}

/// `dig`: a path into a value; arrays by their index, as JavaScript reads them.
pub fn dig(value: &Value, path: &[&str]) -> Value {
    let mut v = value;
    for (index, key) in path.iter().enumerate() {
        match v {
            Value::Object(m) => match m.get(*key) {
                Some(x) => v = x,
                None => return Value::Null,
            },
            Value::Array(a) => {
                if *key == "length" {
                    // A number has nothing further to read.
                    return if index + 1 == path.len() { json!(a.len()) } else { Value::Null };
                }
                let canonical = key.parse::<usize>().ok().filter(|i| i.to_string() == *key);
                match canonical.and_then(|i| a.get(i)) {
                    Some(x) => v = x,
                    None => return Value::Null,
                }
            }
            _ => return Value::Null,
        }
    }
    v.clone()
}

impl Scope {
    /// `resolve`: `champ` of the triggering row, `_maintenant`, or a step and a path.
    pub fn resolve(&self, path: &str) -> Found<'_> {
        let parts: Vec<&str> = path.split('.').collect();
        let (head, rest) = (parts[0], &parts[1..]);
        if rest.is_empty() {
            if head == "_maintenant" {
                return Found { value: json!(self.now), field: None };
            }
            return from_row(self.rows.get(TRIGGER_ROW), head);
        }
        if let Some(held) = self.rows.get(head) {
            let found = from_row(Some(held), rest[0]);
            return if rest.len() == 1 { found } else { Found { value: dig(&found.value, &rest[1..]), field: None } };
        }
        Found { value: self.data.get(head).map(|d| dig(d, rest)).unwrap_or(Value::Null), field: None }
    }

    fn text(&self, path: &str) -> String {
        let f = self.resolve(path);
        text_of(&f.value, f.field, &self.people)
    }

    /// `render`.
    pub fn render(&self, template: &str) -> String {
        citation().replace_all(template, |c: &regex::Captures| self.text(&c[1])).into_owned()
    }

    /// `renderPrompt`: an empty value reads `(vide)`, a long one is cut.
    pub fn render_prompt(&self, template: &str) -> String {
        citation()
            .replace_all(template, |c: &regex::Captures| {
                let t = self.text(&c[1]);
                if t.is_empty() {
                    EMPTY_VALUE.to_string()
                } else {
                    chars_slice(&t, MAX_VALUE_CHARS)
                }
            })
            .into_owned()
    }

    /// `renderFilter`: a cited text always lands inside a string, its quotes escaped.
    pub fn render_filter(&self, template: &str) -> String {
        let mut out = String::new();
        let mut quoted = false;
        let mut i = 0;
        while i < template.len() {
            let rest = &template[i..];
            let c = rest.chars().next().expect("char");
            if c == '{' {
                if let Some(m) = citation_at().captures(rest) {
                    let value = scalar_of(&self.resolve(&m[1]).value);
                    let text = quote(&if value.is_null() { String::new() } else { js_string(&value) });
                    if quoted || value.is_number() || value.is_boolean() {
                        out.push_str(&text);
                    } else {
                        out.push('"');
                        out.push_str(&text);
                        out.push('"');
                    }
                    i += m[0].len();
                    continue;
                }
            }
            if quoted && c == '\\' {
                let next = rest[1..].chars().next().map(char::len_utf8).unwrap_or(0);
                out.push_str(&rest[..1 + next]);
                i += 1 + next;
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

    /// `renderJson`: inside a string, the text escaped; outside, a JSON value.
    pub fn render_json(&self, template: &str) -> String {
        compose_json(template, |path, quoted| {
            let f = self.resolve(path);
            if quoted {
                let s = js_stringify(&json!(text_of(&f.value, f.field, &self.people)));
                s[1..s.len() - 1].to_string()
            } else {
                js_stringify(&json_of(&f.value, f.field, &self.people))
            }
        })
    }

    /// `renderForm`: each `clé=valeur` rendered, then encoded as a web form sends it.
    pub fn render_form(&self, template: &str) -> String {
        let mut form = form_urlencoded::Serializer::new(String::new());
        for (key, value) in form_pairs(template) {
            form.append_pair(js_trim(&self.render(&key)), &self.render(&value));
        }
        form.finish()
    }

    /// `renderUrl`: each value encoded; a segment `.` or `..` fails the step.
    pub fn render_url(&self, template: &str) -> Result<String, AppError> {
        let url = citation().replace_all(template, |c: &regex::Captures| encode_uri_component(&self.text(&c[1]))).into_owned();
        static ORIGIN: OnceLock<Regex> = OnceLock::new();
        static SPLIT: OnceLock<Regex> = OnceLock::new();
        static DOTS: OnceLock<Regex> = OnceLock::new();
        let path = re(&ORIGIN, r"(?i)^[a-z][a-z0-9+.-]*://[^/?#]*").replace(&url, "").into_owned();
        let path = re(&SPLIT, r"[?#]").split(&path).next().unwrap_or("").to_string();
        if path.split('/').any(|s| re(&DOTS, r"(?i)^(\.|%2e){1,2}$").is_match(s)) {
            return Err(AppError::new("AUTOMATION_WEBHOOK_FAILED").with("reason", json!("adresse_invalide")));
        }
        Ok(url)
    }

    /// `renderHtml`: each value escaped — it adds words, never tags.
    pub fn render_html(&self, template: &str) -> String {
        citation().replace_all(template, |c: &regex::Captures| escape_html(&self.text(&c[1]))).into_owned()
    }

    /// `valueFor`: a value to write.
    pub fn value_for(&self, raw: &Value, field: Option<&Field>) -> Value {
        let Value::String(raw) = raw else { return raw.clone() };
        static ALONE: OnceLock<Regex> = OnceLock::new();
        let alone = re(&ALONE, r"^\s*\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}\s*$");
        if let (Some(m), Some(f)) = (alone.captures(raw), field) {
            if !TEXT_KINDS.contains(&f.kind.as_str()) {
                return stored_of(&self.resolve(&m[1]).value, f);
            }
        }
        let text = self.render(raw);
        let Some(field) = field else { return json!(text) };
        if text.is_empty() {
            return Value::Null;
        }
        match field.kind.as_str() {
            "number" => {
                let n = js_to_number(&text.replacen(',', ".", 1));
                if n.is_finite() {
                    number_json(n)
                } else {
                    json!(text)
                }
            }
            "boolean" => json!(text == "true" || text == "oui" || text == "1"),
            "select" => stored_of(&json!(text), field),
            _ => json!(text),
        }
    }
}

fn escape_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

/// `scalarOf`: a value as a filter compares it.
fn scalar_of(value: &Value) -> Value {
    match value {
        Value::Array(a) => a.first().map(scalar_of).unwrap_or(Value::Null),
        Value::Object(m) => match m.get("id") {
            Some(id) if !id.is_null() => id.clone(),
            _ => json!(js_stringify(value)),
        },
        v => v.clone(),
    }
}

fn quote(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        if c == '\\' || c == '"' {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

/// `encodeURIComponent`.
pub fn encode_uri_component(text: &str) -> String {
    let mut out = String::new();
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// `folded`: without accents, without case.
pub fn folded(text: &str) -> String {
    static MARKS: OnceLock<Regex> = OnceLock::new();
    let nfd: String = text.nfd().collect();
    let bare = re(&MARKS, r"\p{M}").replace_all(&nfd, "").to_lowercase();
    js_trim(&bare).to_string()
}

/// `storedOf`: a value as a field stores it — a relation by its row, a choice by its key.
pub fn stored_of(value: &Value, field: &Field) -> Value {
    let choice = |v: &Value| -> Value {
        match v.as_str() {
            Some(s) => field.options.iter().find(|(o, l)| o == s || folded(l) == folded(s)).map(|(o, _)| json!(o)).unwrap_or_else(|| v.clone()),
            None => v.clone(),
        }
    };
    let id_of = |v: &Value| -> Value {
        match v {
            Value::Object(m) if m.contains_key("id") => m["id"].clone(),
            _ if field.kind == "select" || field.kind == "multi_select" => choice(v),
            _ => v.clone(),
        }
    };
    if value.is_null() {
        return Value::Null;
    }
    if field.kind == "multi_link" || field.kind == "multi_select" {
        let list = match value {
            Value::Array(a) => a.clone(),
            v => vec![v.clone()],
        };
        return Value::Array(list.iter().map(id_of).filter(|v| !v.is_null() && v.as_str() != Some("")).collect());
    }
    if let Value::Array(a) = value {
        return a.first().map(id_of).unwrap_or(Value::Null);
    }
    id_of(value)
}

/// `numberOf`: a number when the text reads as one, a comma for the point included.
fn number_of(text: &str) -> Option<f64> {
    static NUM: OnceLock<Regex> = OnceLock::new();
    let t = js_trim(text).replacen(',', ".", 1);
    if t.is_empty() || !re(&NUM, r"^-?\d+(\.\d+)?$").is_match(&t) {
        return None;
    }
    t.parse::<f64>().ok()
}

/// JavaScript's `<` on two strings: UTF-16 code units in order.
fn js_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}

/// `holds`: whether a value test holds.
pub fn holds(value: &str, op: &str, operand: &str) -> bool {
    if op == "empty" {
        return js_trim(value).is_empty();
    }
    if op == "not_empty" {
        return !js_trim(value).is_empty();
    }
    let (fa, fb) = (folded(value), folded(operand));
    let compared: i32 = match (number_of(value), number_of(operand)) {
        (Some(a), Some(b)) => {
            let d = a - b;
            if d > 0.0 {
                1
            } else if d < 0.0 {
                -1
            } else {
                0
            }
        }
        _ => match js_cmp(&fa, &fb) {
            std::cmp::Ordering::Less => -1,
            std::cmp::Ordering::Greater => 1,
            std::cmp::Ordering::Equal => 0,
        },
    };
    match op {
        "eq" => compared == 0,
        "ne" => compared != 0,
        "contains" => fa.contains(&fb),
        "not_contains" => !fa.contains(&fb),
        "gt" => compared > 0,
        "gte" => compared >= 0,
        "lt" => compared < 0,
        "lte" => compared <= 0,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scope() -> Scope {
        let mut fields = IndexMap::new();
        fields.insert("statut".to_string(), Field { kind: "select".into(), options: vec![("a_faire".into(), "À faire".into())] });
        fields.insert("montant".to_string(), Field { kind: "number".into(), options: vec![] });
        fields.insert("client".to_string(), Field { kind: "link".into(), options: vec![] });
        fields.insert("nom".to_string(), Field { kind: "short_text".into(), options: vec![] });
        let row = json!({ "_id": "11111111-1111-1111-1111-111111111111", "statut": "a_faire", "montant": "1840.5000000000", "client": { "id": "c1", "display": "Acme" }, "nom": "Dé \"x\"" });
        let mut s = Scope { now: "2025-01-01T00:00:00.000Z".into(), ..Default::default() };
        s.rows.insert(TRIGGER_ROW.into(), Held { table: "t".into(), fields: Arc::new(fields), row: row.as_object().cloned() });
        s.data.insert("e2".into(), json!({ "statut": 200, "reponse": { "items": [{ "n": 7 }] } }));
        s
    }

    #[test]
    fn citations_read_as_people_do() {
        let s = scope();
        assert_eq!(s.render("{{statut}} {{montant}} {{client}} {{e2.reponse.items.0.n}} {{_maintenant}}"), "À faire 1840.5 Acme 7 2025-01-01T00:00:00.000Z");
        assert_eq!(s.render_prompt("[{{absent}}]"), "[(vide)]");
        assert_eq!(s.render_filter("nom eq {{nom}} and montant gt {{e2.statut}} and x eq \"{{nom}}\""), "nom eq \"Dé \\\"x\\\"\" and montant gt 200 and x eq \"Dé \\\"x\\\"\"");
        assert_eq!(s.render_json("{\"m\": {{montant}}, \"s\": \"{{nom}}\", \"c\": {{client}}}"), "{\"m\": 1840.5, \"s\": \"Dé \\\"x\\\"\", \"c\": \"Acme\"}");
        assert_eq!(s.render_form("a={{nom}}&b=1 2"), "a=D%C3%A9+%22x%22&b=1+2");
        assert_eq!(s.render_url("https://h.test/x/{{nom}}").unwrap(), "https://h.test/x/D%C3%A9%20%22x%22");
        assert!(s.render_url("https://h.test/{{e2.reponse.items.0.dots}}..").is_err());
        assert_eq!(s.render_html("<b>{{nom}}</b>"), "<b>Dé &quot;x&quot;</b>");
    }

    #[test]
    fn values_are_stored_by_key() {
        let s = scope();
        let statut = Field { kind: "select".into(), options: vec![("a_faire".into(), "À faire".into())] };
        assert_eq!(s.value_for(&json!("a faire"), Some(&statut)), json!("a_faire"));
        assert_eq!(s.value_for(&json!("{{client}}"), Some(&Field { kind: "link".into(), options: vec![] })), json!("c1"));
        assert_eq!(s.value_for(&json!("12,5"), Some(&Field { kind: "number".into(), options: vec![] })), json!(12.5));
        assert_eq!(s.value_for(&json!(""), Some(&Field { kind: "number".into(), options: vec![] })), Value::Null);
        assert!(holds("Éte", "eq", "ete"));
        assert!(holds("10", "gt", "9,5"));
        assert!(holds("b", "gt", "a"));
    }
}
