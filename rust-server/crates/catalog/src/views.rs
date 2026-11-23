//! Saved views — `_basedb.view_def`, chapter 02 and chapter 11 §1.4 (`catalog/views.ts`).
//!
//! A view is a presentation of one table. Its `spec` is validated when written
//! ([`normalize_view_spec`]) and cut down to what each reader sees when read
//! ([`project_view_spec`]).

use crate::description::{js_trim, normalize_description};
use crate::formula::js_space;
use crate::http::{collapse_spaces, js_len, label_key, nfc};
use basedb_base::db::{Exec, Pools, PoolName};
use basedb_base::error::SqlOp;
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{decide, Action, ActorGrants};
use basedb_base::rbac::loader::load_target;
use basedb_base::rbac::require::require_on_table;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use indexmap::IndexMap;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

pub const VIEW_KINDS: [&str; 10] = ["grid", "kanban", "calendar", "timeline", "gallery", "list", "form", "survey", "quiz", "map"];

const MAX_LABEL_CHARS: usize = 255;
const MAX_SPEC_BYTES: usize = 64 * 1024;
pub const MAX_CARD_TEMPLATE_CHARS: usize = 500;
const MAX_SORTS: usize = 3;
const MIN_WIDTH: f64 = 64.0;
const MAX_WIDTH: f64 = 640.0;
const MAX_PAGE: f64 = 500.0;
const MAX_OPTIONS: usize = 200;
const MAX_COLOR_RULES: usize = 20;
const MAX_MANUAL_ORDER: usize = 5000;
/// `BUDGETS.bytes` of `records/filter.ts`.
pub const FILTER_MAX_BYTES: usize = 4096;
const ROW_HEIGHTS: [&str; 4] = ["short", "medium", "tall", "extra"];
const COLOR_STYLES: [&str; 3] = ["both", "stripe", "background"];
const DATES: &[&str] = &["date", "datetime"];
const PLACES: &[&str] = &["short_text", "long_text", "formula", "lookup"];
const COORDINATES: &[&str] = &["number", "formula", "lookup", "rollup"];
const NOT_ASKABLE: [&str; 6] = ["formula", "autonumber", "lookup", "rollup", "count", "button"];
const SYSTEM_VIEW_COLUMNS: [(&str, &str); 4] = [("_created_at", "datetime"), ("_updated_at", "datetime"), ("_created_by", "user"), ("_updated_by", "user")];

/// `GROUPABLE` of `records/aggregate.ts`: kinds a grid can be grouped by.
pub const GROUPABLE: &[&str] = &["short_text", "select", "boolean", "link", "date", "number", "url", "formula", "email", "user"];
/// `OPERATORS` of `records/filter.ts`.
pub const OPERATORS: [&str; 15] = ["eq", "ne", "eq_ci", "contains", "starts_with", "ends_with", "in", "is_null", "gt", "gte", "lt", "lte", "between", "has_any", "has_all"];

// `@basedb/contracts` forms and quizzes.
const FORM_THEMES: [&str; 8] = ["clair", "doux", "aurore", "ocean", "foret", "nuit", "papier", "minimal"];
const FORM_FONTS: [&str; 5] = ["auto", "sans", "serif", "rounded", "mono"];
const FORM_ALIGNS: [&str; 2] = ["left", "center"];
const FORM_PREFILLS: [&str; 1] = ["today"];
const FORM_PREFILL_KINDS: [&str; 2] = ["date", "datetime"];
const FORM_CONDITION_OPS: [&str; 8] = ["answered", "empty", "is", "is_not", "includes", "excludes", "gte", "lte"];
const QUIZ_REVEALS: [&str; 3] = ["each", "end", "never"];
const QUIZ_KINDS: [&str; 8] = ["select", "multi_select", "boolean", "number", "date", "short_text", "email", "url"];
const QUIZ_TEXT_KINDS: [&str; 3] = ["short_text", "email", "url"];
const QUIZ_MAX_POINTS: f64 = 100.0;
const QUIZ_MAX_ACCEPTED: usize = 20;

/// `aggregatesFor` of `records/aggregate.ts`.
pub fn aggregates_for(kind: &str) -> &'static [&'static str] {
    match kind {
        "boolean" => &["checked", "filled", "empty"],
        "number" => &["filled", "empty", "unique", "sum", "avg", "min", "max"],
        "date" | "datetime" | "autonumber" => &["filled", "empty", "min", "max"],
        "long_text" | "multi_select" | "multi_link" | "lookup" | "file" | "image" => &["filled", "empty"],
        _ => &["filled", "empty", "unique"],
    }
}

/// The live fields of a table the reader sees: physical name → kind.
pub type Readable = IndexMap<String, String>;

fn refuse(reason: &str, detail: Option<&str>) -> AppError {
    let e = AppError::new("REQUEST_INVALID").with("field", json!("spec")).with("reason", json!(reason));
    match detail {
        Some(d) => e.with("detail", json!(d)),
        None => e,
    }
}

/// `Object.keys` order: integer-like keys first, ascending, then the others as inserted.
pub fn js_keys(map: &Map<String, Value>) -> Vec<&String> {
    let index = |k: &str| -> Option<u64> {
        if k == "0" {
            return Some(0);
        }
        if k.is_empty() || k.len() > 10 || k.starts_with('0') || !k.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        k.parse::<u64>().ok().filter(|n| *n < 4_294_967_295)
    };
    let mut ints: Vec<(u64, &String)> = map.keys().filter_map(|k| index(k).map(|n| (n, k))).collect();
    ints.sort_by_key(|(n, _)| *n);
    let mut out: Vec<&String> = ints.into_iter().map(|(_, k)| k).collect();
    out.extend(map.keys().filter(|k| index(k).is_none()));
    out
}

/// A JavaScript number as `JSON.stringify` writes it: an integral value without `.0`.
pub(crate) fn js_number(f: f64) -> Value {
    if f.fract() == 0.0 && f.abs() < 9_007_199_254_740_992.0 {
        json!(f as i64)
    } else {
        json!(f)
    }
}

/// `Number.isInteger(value)`, the value as a float.
fn js_integer(v: &Value) -> Option<f64> {
    v.as_f64().filter(|f| f.fract() == 0.0)
}

fn first_repeated<T: PartialEq>(items: &[T]) -> Option<&T> {
    items.iter().enumerate().find(|(i, x)| items[..*i].contains(x)).map(|(_, x)| x)
}

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("regex"))
}

fn template_variable() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"\{\{\s*([^{}]*?)\s*\}\}")
}

fn hex_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].bytes().all(|b| b.is_ascii_hexdigit())
}

fn is_uuid(s: &str) -> bool {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").is_match(s)
}

/// Reads a raw spec key by key, and refuses whatever is left over.
struct SpecReader<'a> {
    raw: &'a Map<String, Value>,
    fields: &'a Readable,
    seen: HashSet<String>,
}

type R<T> = Result<T, AppError>;

impl<'a> SpecReader<'a> {
    fn new(raw: &'a Map<String, Value>, fields: &'a Readable) -> Self {
        SpecReader { raw, fields, seen: HashSet::new() }
    }

    fn take(&mut self, key: &str) -> Option<&'a Value> {
        self.seen.insert(key.to_string());
        self.raw.get(key).filter(|v| !v.is_null())
    }

    fn text(&mut self, key: &str, max: usize) -> R<String> {
        let Some(value) = self.take(key) else { return Ok(String::new()) };
        let Some(s) = value.as_str().filter(|s| !s.contains('\0')) else { return Err(refuse("valeur_invalide", Some(key))) };
        let text = nfc(&s.replace("\r\n", "\n").replace('\r', "\n"));
        let text = js_trim(&text).to_string();
        if text.chars().count() > max {
            return Err(refuse("texte_trop_long", Some(key)));
        }
        Ok(text)
    }

    fn flag(&mut self, key: &str, fallback: bool) -> R<bool> {
        match self.take(key) {
            None => Ok(fallback),
            Some(Value::Bool(b)) => Ok(*b),
            Some(_) => Err(refuse("valeur_invalide", Some(key))),
        }
    }

    fn choice(&mut self, key: &str, values: &[&str], fallback: &str) -> R<String> {
        match self.take(key) {
            None => Ok(fallback.to_string()),
            Some(Value::String(s)) if values.contains(&s.as_str()) => Ok(s.clone()),
            Some(_) => Err(refuse("valeur_invalide", Some(key))),
        }
    }

    fn color(&mut self, key: &str) -> R<String> {
        match self.take(key) {
            None => Ok(String::new()),
            Some(Value::String(s)) if s.is_empty() => Ok(String::new()),
            Some(Value::String(s)) if hex_color(s) => Ok(s.to_lowercase()),
            Some(_) => Err(refuse("valeur_invalide", Some(key))),
        }
    }

    fn link(&mut self, key: &str) -> R<String> {
        static LINK: OnceLock<Regex> = OnceLock::new();
        match self.take(key) {
            None => Ok(String::new()),
            Some(Value::String(s)) if s.is_empty() => Ok(String::new()),
            Some(Value::String(s)) if js_len(s) <= 2000 && re(&LINK, r"(?i)^https?://\S+$").is_match(s) => Ok(s.clone()),
            Some(_) => Err(refuse("valeur_invalide", Some(key))),
        }
    }

    fn integer(&mut self, key: &str, min: f64, max: f64, fallback: i64) -> R<Value> {
        let Some(value) = self.take(key) else { return Ok(json!(fallback)) };
        match js_integer(value) {
            Some(n) if n >= min && n <= max => Ok(js_number(n)),
            _ => Err(refuse("valeur_invalide", Some(key))),
        }
    }

    fn field(&mut self, key: &str, kinds: Option<&[&str]>, required: bool) -> R<Option<String>> {
        let value = self.take(key);
        match value {
            None => {}
            Some(Value::String(s)) if s.is_empty() => {}
            Some(Value::String(s)) => return self.check(s, kinds).map(Some),
            Some(_) => return Err(refuse("valeur_invalide", Some(key))),
        }
        if required {
            return Err(refuse("champ_pivot_manquant", Some(key)));
        }
        Ok(None)
    }

    fn field_list(&mut self, key: &str) -> R<Vec<String>> {
        let Some(value) = self.take(key) else { return Ok(vec![]) };
        let Value::Array(items) = value else { return Err(refuse("valeur_invalide", Some(key))) };
        let mut names = Vec::with_capacity(items.len());
        for item in items {
            let Value::String(name) = item else { return Err(refuse("valeur_invalide", Some(key))) };
            names.push(self.check(name, None)?);
        }
        if let Some(r) = first_repeated(&names) {
            return Err(refuse("doublon", Some(r)));
        }
        Ok(names)
    }

    fn row_list(&mut self, key: &str) -> R<Vec<String>> {
        let Some(value) = self.take(key) else { return Ok(vec![]) };
        let items = match value {
            Value::Array(items) if items.len() <= MAX_MANUAL_ORDER => items,
            _ => return Err(refuse("valeur_invalide", Some(key))),
        };
        let mut ids = Vec::with_capacity(items.len());
        for v in items {
            match v {
                Value::String(s) if is_uuid(s) => ids.push(s.to_lowercase()),
                _ => return Err(refuse("valeur_invalide", Some(key))),
            }
        }
        if let Some(r) = first_repeated(&ids) {
            return Err(refuse("doublon", Some(r)));
        }
        Ok(ids)
    }

    fn value_list(&mut self, key: &str, max: usize) -> R<Vec<String>> {
        let Some(value) = self.take(key) else { return Ok(vec![]) };
        let items = match value {
            Value::Array(items) if items.len() <= max => items,
            _ => return Err(refuse("valeur_invalide", Some(key))),
        };
        let mut values = Vec::with_capacity(items.len());
        for v in items {
            match v {
                Value::String(s) if js_len(s) <= MAX_LABEL_CHARS => values.push(s.clone()),
                _ => return Err(refuse("valeur_invalide", Some(key))),
            }
        }
        if let Some(r) = first_repeated(&values) {
            return Err(refuse("doublon", Some(r)));
        }
        Ok(values)
    }

    fn template(&mut self, key: &str, max: usize) -> R<String> {
        let text = self.text(key, max)?;
        let mut out = String::with_capacity(text.len());
        let mut last = 0;
        for c in template_variable().captures_iter(&text) {
            let whole = c.get(0).expect("match");
            out.push_str(&text[last..whole.start()]);
            let name = self.check(&c[1], None)?;
            out.push_str("{{");
            out.push_str(&name);
            out.push_str("}}");
            last = whole.end();
        }
        out.push_str(&text[last..]);
        Ok(out)
    }

    fn check(&self, name: &str, kinds: Option<&[&str]>) -> R<String> {
        let Some(kind) = self.fields.get(name) else { return Err(refuse("champ_inconnu", Some(name))) };
        if let Some(kinds) = kinds {
            if !kinds.contains(&kind.as_str()) {
                return Err(refuse("type_de_champ_incompatible", Some(name)));
            }
        }
        Ok(name.to_string())
    }

    fn filter(&mut self) -> R<String> {
        let Some(value) = self.take("filter") else { return Ok(String::new()) };
        let Some(s) = value.as_str().filter(|s| !s.contains('\0')) else { return Err(refuse("valeur_invalide", Some("filter"))) };
        let text = js_trim(s);
        if text.len() > FILTER_MAX_BYTES {
            return Err(refuse("texte_trop_long", Some("filter")));
        }
        Ok(text.to_string())
    }

    fn sorts(&mut self) -> R<Vec<Value>> {
        let Some(value) = self.take("sorts") else { return Ok(vec![]) };
        let Value::Array(items) = value else { return Err(refuse("valeur_invalide", Some("sorts"))) };
        if items.len() > MAX_SORTS {
            return Err(refuse("trop_de_tris", None));
        }
        let mut terms: Vec<(String, String)> = Vec::new();
        for term in items {
            let (Value::Object(_) | Value::Array(_)) = term else { return Err(refuse("valeur_invalide", Some("sorts"))) };
            let Some(Value::String(field)) = term.get("field") else { return Err(refuse("valeur_invalide", Some("sorts"))) };
            let direction = match term.get("direction") {
                Some(Value::String(d)) if d == "asc" || d == "desc" => d.clone(),
                _ => return Err(refuse("valeur_invalide", Some("sorts"))),
            };
            terms.push((self.check(field, None)?, direction));
        }
        let names: Vec<&String> = terms.iter().map(|(f, _)| f).collect();
        if let Some(r) = first_repeated(&names) {
            return Err(refuse("doublon", Some(r)));
        }
        Ok(terms.into_iter().map(|(field, direction)| json!({ "field": field, "direction": direction })).collect())
    }

    fn widths(&mut self) -> R<Map<String, Value>> {
        let Some(value) = self.take("column_widths") else { return Ok(Map::new()) };
        let Value::Object(map) = value else { return Err(refuse("valeur_invalide", Some("column_widths"))) };
        let mut out = Map::new();
        for name in js_keys(map) {
            self.check(name, None)?;
            let Some(width) = map[name].as_f64() else { return Err(refuse("valeur_invalide", Some("column_widths"))) };
            // `Math.round`: halves go up.
            let rounded = (width + 0.5).floor();
            out.insert(name.clone(), js_number(MAX_WIDTH.min(MIN_WIDTH.max(rounded))));
        }
        Ok(out)
    }

    fn summaries(&mut self) -> R<Map<String, Value>> {
        let Some(value) = self.take("summaries") else { return Ok(Map::new()) };
        let Value::Object(map) = value else { return Err(refuse("valeur_invalide", Some("summaries"))) };
        let mut out = Map::new();
        for name in js_keys(map) {
            self.check(name, None)?;
            let kind = self.fields.get(name.as_str()).map(String::as_str).unwrap_or("");
            match &map[name] {
                Value::String(f) if aggregates_for(kind).contains(&f.as_str()) => {
                    out.insert(name.clone(), json!(f));
                }
                _ => return Err(refuse("valeur_invalide", Some("summaries"))),
            }
        }
        Ok(out)
    }

    fn color_rules(&mut self) -> R<Vec<Value>> {
        let Some(value) = self.take("color_rules") else { return Ok(vec![]) };
        let items = match value {
            Value::Array(items) if items.len() <= MAX_COLOR_RULES => items,
            _ => return Err(refuse("valeur_invalide", Some("color_rules"))),
        };
        let mut out = Vec::new();
        for rule in items {
            let (Value::Object(_) | Value::Array(_)) = rule else { return Err(refuse("valeur_invalide", Some("color_rules"))) };
            let filter = match rule.get("filter") {
                Some(Value::String(f)) if f.len() <= FILTER_MAX_BYTES => f,
                _ => return Err(refuse("valeur_invalide", Some("color_rules"))),
            };
            let color = match rule.get("color") {
                Some(Value::String(c)) if hex_color(c) => c,
                _ => return Err(refuse("valeur_invalide", Some("color_rules"))),
            };
            let style = match rule.get("style") {
                None | Some(Value::Null) => "both".to_string(),
                Some(Value::String(s)) if COLOR_STYLES.contains(&s.as_str()) => s.clone(),
                Some(_) => return Err(refuse("valeur_invalide", Some("color_rules"))),
            };
            out.push(json!({ "filter": js_trim(filter), "color": color.to_lowercase(), "style": style }));
        }
        Ok(out)
    }

    fn system_columns(&mut self) -> R<Vec<String>> {
        let names = self.field_list("system_columns")?;
        if let Some(other) = names.iter().find(|n| !SYSTEM_VIEW_COLUMNS.iter().any(|(s, _)| s == n)) {
            return Err(refuse("type_de_champ_incompatible", Some(other)));
        }
        Ok(names)
    }

    fn questions(&mut self, quiz: bool) -> R<Vec<Value>> {
        let value = self.take("fields");
        let Some(Value::Array(items)) = value else { return Err(refuse("valeur_invalide", Some("fields"))) };
        if items.is_empty() {
            return Err(refuse("formulaire_vide", None));
        }
        let mut earlier: HashSet<String> = HashSet::new();
        let mut questions: Vec<Value> = Vec::new();
        let mut names: Vec<String> = Vec::new();
        for entry in items {
            let empty = Map::new();
            let entry = match entry {
                Value::Object(m) => m,
                Value::Array(_) => &empty,
                _ => return Err(refuse("valeur_invalide", Some("fields"))),
            };
            let mut item = SpecReader::new(entry, self.fields);
            let field = item.field("field", None, true)?.unwrap_or_default();
            let kind = self.fields.get(&field).cloned().unwrap_or_default();
            if NOT_ASKABLE.contains(&kind.as_str()) || SYSTEM_VIEW_COLUMNS.iter().any(|(s, _)| *s == field) {
                return Err(refuse("type_de_champ_incompatible", Some(&field)));
            }
            let mut q = Map::new();
            q.insert("field".into(), json!(field));
            q.insert("required".into(), json!(item.flag("required", false)?));
            q.insert("label".into(), json!(item.text("label", MAX_LABEL_CHARS)?));
            q.insert("help".into(), json!(item.text("help", 1000)?));
            q.insert("placeholder".into(), json!(item.text("placeholder", MAX_LABEL_CHARS)?));
            q.insert("prefill".into(), item.prefill(&kind)?);
            q.insert("show_if".into(), item.condition(&earlier)?);
            if quiz {
                q.insert("correct".into(), item.correct(&kind)?);
                q.insert("points".into(), item.integer("points", 1.0, QUIZ_MAX_POINTS, 1)?);
            }
            item.finish()?;
            earlier.insert(field.clone());
            names.push(field);
            questions.push(Value::Object(q));
        }
        if let Some(r) = first_repeated(&names) {
            return Err(refuse("doublon", Some(r)));
        }
        Ok(questions)
    }

    fn correct(&mut self, kind: &str) -> R<Value> {
        let Some(value) = self.take("correct") else { return Ok(Value::Null) };
        if !QUIZ_KINDS.contains(&kind) {
            return Err(refuse("type_de_champ_incompatible", Some("correct")));
        }
        let tidied = match value {
            Value::Array(items) => Value::Array(
                items
                    .iter()
                    .map(|v| match v {
                        Value::String(s) => json!(js_trim(&nfc(s))),
                        Value::Number(n) => n.as_f64().map(js_number).unwrap_or_else(|| v.clone()),
                        other => other.clone(),
                    })
                    .collect(),
            ),
            Value::Number(n) => n.as_f64().map(js_number).unwrap_or_else(|| value.clone()),
            other => other.clone(),
        };
        if !quiz_answer_fits(kind, &tidied) {
            return Err(refuse("valeur_invalide", Some("correct")));
        }
        Ok(tidied)
    }

    fn percent(&mut self, key: &str) -> R<Value> {
        let Some(value) = self.take(key) else { return Ok(Value::Null) };
        match js_integer(value) {
            Some(n) if (1.0..=100.0).contains(&n) => Ok(js_number(n)),
            _ => Err(refuse("valeur_invalide", Some(key))),
        }
    }

    fn prefill(&mut self, kind: &str) -> R<Value> {
        let Some(value) = self.take("prefill") else { return Ok(Value::Null) };
        let Some(s) = value.as_str().filter(|s| FORM_PREFILLS.contains(s)) else { return Err(refuse("valeur_invalide", Some("prefill"))) };
        if !FORM_PREFILL_KINDS.contains(&kind) {
            return Err(refuse("type_de_champ_incompatible", Some("prefill")));
        }
        Ok(json!(s))
    }

    fn condition(&mut self, earlier: &HashSet<String>) -> R<Value> {
        let Some(value) = self.take("show_if") else { return Ok(Value::Null) };
        let Value::Object(raw) = value else { return Err(refuse("valeur_invalide", Some("show_if"))) };
        if let Some(extra) = js_keys(raw).into_iter().find(|k| !["field", "op", "value"].contains(&k.as_str())) {
            return Err(refuse("cle_inconnue", Some(&format!("show_if.{extra}"))));
        }
        let field = match raw.get("field") {
            Some(Value::String(f)) if earlier.contains(f) => f.clone(),
            _ => return Err(refuse("condition_invalide", Some("show_if"))),
        };
        let op = match raw.get("op") {
            Some(Value::String(o)) if FORM_CONDITION_OPS.contains(&o.as_str()) => o.clone(),
            _ => return Err(refuse("valeur_invalide", Some("show_if.op"))),
        };
        let given = raw.get("value").cloned().unwrap_or(Value::Null);
        let needs = op != "answered" && op != "empty";
        if needs {
            let ok = match &given {
                Value::Bool(_) | Value::Number(_) => true,
                Value::String(s) => !js_trim(s).is_empty() && s.chars().count() <= 255,
                _ => false,
            };
            if !ok || ((op == "gte" || op == "lte") && !given.is_number()) {
                return Err(refuse("valeur_invalide", Some("show_if.value")));
            }
        }
        let value = match given {
            Value::Number(n) if needs => n.as_f64().map(js_number).unwrap_or(Value::Number(n)),
            v if needs => v,
            _ => Value::Null,
        };
        Ok(json!({ "field": field, "op": op, "value": value }))
    }

    fn finish(&self) -> R<()> {
        if let Some(unknown) = js_keys(self.raw).into_iter().find(|k| !self.seen.contains(k.as_str())) {
            return Err(refuse("cle_inconnue", Some(unknown)));
        }
        Ok(())
    }
}

/// `quizAnswerFits` of `@basedb/contracts`.
pub fn quiz_answer_fits(kind: &str, correct: &Value) -> bool {
    let is_text = |v: &Value| matches!(v, Value::String(s) if !js_trim(s).is_empty() && s.chars().count() <= 255);
    match kind {
        "select" => is_text(correct),
        "multi_select" => match correct {
            Value::Array(items) => !items.is_empty() && items.iter().all(is_text) && first_repeated(items).is_none(),
            _ => false,
        },
        "boolean" => correct.is_boolean(),
        "number" => correct.is_number(),
        "date" => {
            static DAY: OnceLock<Regex> = OnceLock::new();
            matches!(correct, Value::String(s) if re(&DAY, r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$").is_match(s))
        }
        _ => {
            QUIZ_TEXT_KINDS.contains(&kind)
                && matches!(correct, Value::Array(items) if !items.is_empty() && items.len() <= QUIZ_MAX_ACCEPTED && items.iter().all(is_text))
        }
    }
}

const DATA_KEYS: [&str; 2] = ["filter", "sorts"];
const CARD_KEYS: [&str; 3] = ["title_field", "card_fields", "color_field"];
const FORM_KEYS: [&str; 17] = [
    "title", "description", "fields", "submit_label", "success_message", "allow_another", "theme", "accent", "font", "align", "welcome_label", "show_progress",
    "show_numbers", "auto_advance", "celebrate", "end_link_label", "end_link_url",
];

/// The keys a spec may carry, per kind.
fn spec_keys(kind: &str) -> Vec<&'static str> {
    let mut keys: Vec<&'static str> = Vec::new();
    match kind {
        "grid" => {
            keys.extend(DATA_KEYS);
            keys.extend([
                "hidden", "pinned", "column_order", "column_widths", "page_size", "group_by", "summaries", "row_height", "color_field", "color_rules", "color_style",
                "system_columns",
            ]);
        }
        "kanban" => {
            keys.extend(DATA_KEYS);
            keys.extend(["group_by", "group_order", "title_field", "card_fields", "card_template", "cover_field", "hide_empty", "manual_order"]);
        }
        "calendar" => {
            keys.extend(DATA_KEYS);
            keys.extend(CARD_KEYS);
            keys.extend(["date_field", "end_field", "mode"]);
        }
        "timeline" => {
            keys.extend(DATA_KEYS);
            keys.extend(CARD_KEYS);
            keys.extend(["start_field", "end_field", "group_by", "scale", "depends_on"]);
        }
        "gallery" => {
            keys.extend(DATA_KEYS);
            keys.extend(CARD_KEYS);
            keys.extend(["cover_field", "cover_fit", "card_size", "manual_order"]);
        }
        "list" => {
            keys.extend(DATA_KEYS);
            keys.extend(["title_field", "card_fields", "group_by", "manual_order"]);
        }
        "form" | "survey" => keys.extend(FORM_KEYS),
        "quiz" => {
            keys.extend(FORM_KEYS);
            keys.extend(["score_field", "reveal", "pass_percent"]);
        }
        "map" => {
            keys.extend(DATA_KEYS);
            keys.extend(CARD_KEYS);
            keys.extend(["address_field", "latitude_field", "longitude_field"]);
        }
        _ => {}
    }
    keys
}

fn opt(v: Option<String>) -> Value {
    v.map(Value::String).unwrap_or(Value::Null)
}

fn form_spec(read: &mut SpecReader, questions: Vec<Value>) -> R<Map<String, Value>> {
    let mut m = Map::new();
    m.insert("title".into(), json!(read.text("title", MAX_LABEL_CHARS)?));
    m.insert("description".into(), json!(read.text("description", 4000)?));
    m.insert("fields".into(), Value::Array(questions));
    m.insert("submit_label".into(), json!(read.text("submit_label", 60)?));
    m.insert("success_message".into(), json!(read.text("success_message", 2000)?));
    m.insert("allow_another".into(), json!(read.flag("allow_another", true)?));
    m.insert("theme".into(), json!(read.choice("theme", &FORM_THEMES, "clair")?));
    m.insert("accent".into(), json!(read.color("accent")?));
    m.insert("font".into(), json!(read.choice("font", &FORM_FONTS, "auto")?));
    m.insert("align".into(), json!(read.choice("align", &FORM_ALIGNS, "left")?));
    m.insert("welcome_label".into(), json!(read.text("welcome_label", 60)?));
    m.insert("show_progress".into(), json!(read.flag("show_progress", true)?));
    m.insert("show_numbers".into(), json!(read.flag("show_numbers", true)?));
    m.insert("auto_advance".into(), json!(read.flag("auto_advance", true)?));
    m.insert("celebrate".into(), json!(read.flag("celebrate", true)?));
    m.insert("end_link_label".into(), json!(read.text("end_link_label", 60)?));
    m.insert("end_link_url".into(), json!(read.link("end_link_url")?));
    Ok(m)
}

/// `normalizeViewSpec`: what a caller sent, as the catalog stores it, for one kind of view.
pub fn normalize_view_spec(kind: &str, raw: Option<&Value>, fields: &Readable, self_links: &HashSet<String>) -> R<Map<String, Value>> {
    let empty = Map::new();
    let source = match raw {
        None | Some(Value::Null) => &empty,
        Some(Value::Object(m)) => m,
        Some(_) => return Err(refuse("spec_invalide", None)),
    };
    if serde_json::to_string(source).map(|s| s.len()).unwrap_or(0) > MAX_SPEC_BYTES {
        return Err(refuse("spec_trop_volumineux", None));
    }
    let allowed = spec_keys(kind);
    if let Some(unknown) = js_keys(source).into_iter().find(|k| !allowed.contains(&k.as_str())) {
        return Err(refuse("cle_inconnue", Some(unknown)));
    }
    let mut read = SpecReader::new(source, fields);
    let mut s = Map::new();
    macro_rules! put {
        ($k:expr, $v:expr) => {
            s.insert($k.into(), $v)
        };
    }
    match kind {
        "grid" => {
            put!("filter", json!(read.filter()?));
            put!("sorts", json!(read.sorts()?));
            put!("hidden", json!(read.field_list("hidden")?));
            put!("pinned", json!(read.field_list("pinned")?));
            put!("column_order", json!(read.field_list("column_order")?));
            put!("column_widths", Value::Object(read.widths()?));
            put!("page_size", read.integer("page_size", 1.0, MAX_PAGE, 100)?);
            put!("group_by", opt(read.field("group_by", Some(GROUPABLE), false)?));
            put!("summaries", Value::Object(read.summaries()?));
            put!("row_height", json!(read.choice("row_height", &ROW_HEIGHTS, "short")?));
            put!("color_field", opt(read.field("color_field", Some(&["select"]), false)?));
            put!("color_rules", json!(read.color_rules()?));
            put!("color_style", json!(read.choice("color_style", &COLOR_STYLES, "both")?));
            put!("system_columns", json!(read.system_columns()?));
        }
        "kanban" => {
            put!("filter", json!(read.filter()?));
            put!("sorts", json!(read.sorts()?));
            put!("group_by", opt(read.field("group_by", Some(&["select"]), true)?));
            put!("group_order", json!(read.value_list("group_order", MAX_OPTIONS)?));
            put!("title_field", opt(read.field("title_field", None, false)?));
            put!("card_fields", json!(read.field_list("card_fields")?));
            put!("card_template", json!(read.template("card_template", MAX_CARD_TEMPLATE_CHARS)?));
            put!("cover_field", opt(read.field("cover_field", Some(&["file", "image"]), false)?));
            put!("hide_empty", json!(read.flag("hide_empty", false)?));
            put!("manual_order", json!(read.row_list("manual_order")?));
        }
        "calendar" => {
            put!("filter", json!(read.filter()?));
            put!("sorts", json!(read.sorts()?));
            let date = read.field("date_field", Some(DATES), true)?;
            let end = read.field("end_field", Some(DATES), false)?;
            put!("date_field", opt(date.clone()));
            put!("end_field", opt(end.clone()));
            put!("title_field", opt(read.field("title_field", None, false)?));
            put!("card_fields", json!(read.field_list("card_fields")?));
            put!("color_field", opt(read.field("color_field", Some(&["select"]), false)?));
            put!("mode", json!(read.choice("mode", &["month", "week"], "month")?));
            if let Some(e) = end.filter(|e| Some(e) == date.as_ref()) {
                return Err(refuse("doublon", Some(&e)));
            }
        }
        "timeline" => {
            put!("filter", json!(read.filter()?));
            put!("sorts", json!(read.sorts()?));
            let start = read.field("start_field", Some(DATES), true)?;
            let end = read.field("end_field", Some(DATES), false)?;
            put!("start_field", opt(start.clone()));
            put!("end_field", opt(end.clone()));
            put!("group_by", opt(read.field("group_by", Some(&["select", "link"]), false)?));
            put!("title_field", opt(read.field("title_field", None, false)?));
            put!("card_fields", json!(read.field_list("card_fields")?));
            put!("color_field", opt(read.field("color_field", Some(&["select"]), false)?));
            put!("scale", json!(read.choice("scale", &["day", "week", "month"], "week")?));
            let depends = read.field("depends_on", Some(&["link", "multi_link"]), false)?;
            put!("depends_on", opt(depends.clone()));
            if let Some(e) = end.filter(|e| Some(e) == start.as_ref()) {
                return Err(refuse("doublon", Some(&e)));
            }
            if let Some(d) = depends.filter(|d| !self_links.contains(d)) {
                return Err(refuse("type_de_champ_incompatible", Some(&d)));
            }
        }
        "gallery" => {
            put!("filter", json!(read.filter()?));
            put!("sorts", json!(read.sorts()?));
            put!("title_field", opt(read.field("title_field", None, false)?));
            put!("card_fields", json!(read.field_list("card_fields")?));
            put!("color_field", opt(read.field("color_field", Some(&["select"]), false)?));
            put!("cover_field", opt(read.field("cover_field", Some(&["file", "image"]), false)?));
            put!("cover_fit", json!(read.choice("cover_fit", &["cover", "contain"], "cover")?));
            put!("card_size", json!(read.choice("card_size", &["small", "medium", "large"], "medium")?));
            put!("manual_order", json!(read.row_list("manual_order")?));
        }
        "map" => {
            put!("filter", json!(read.filter()?));
            put!("sorts", json!(read.sorts()?));
            put!("title_field", opt(read.field("title_field", None, false)?));
            put!("card_fields", json!(read.field_list("card_fields")?));
            put!("color_field", opt(read.field("color_field", Some(&["select"]), false)?));
            let address = read.field("address_field", Some(PLACES), false)?;
            let latitude = read.field("latitude_field", Some(COORDINATES), false)?;
            let longitude = read.field("longitude_field", Some(COORDINATES), false)?;
            put!("address_field", opt(address.clone()));
            put!("latitude_field", opt(latitude.clone()));
            put!("longitude_field", opt(longitude.clone()));
            if address.is_none() && (latitude.is_none() || longitude.is_none()) {
                return Err(refuse("champ_pivot_manquant", Some("address_field")));
            }
            if let Some(l) = latitude.filter(|l| Some(l) == longitude.as_ref()) {
                return Err(refuse("doublon", Some(&l)));
            }
        }
        "list" => {
            put!("filter", json!(read.filter()?));
            put!("sorts", json!(read.sorts()?));
            put!("title_field", opt(read.field("title_field", None, false)?));
            put!("card_fields", json!(read.field_list("card_fields")?));
            put!("group_by", opt(read.field("group_by", Some(&["select", "link", "user"]), false)?));
            put!("manual_order", json!(read.row_list("manual_order")?));
        }
        "quiz" => {
            let questions = read.questions(true)?;
            let asked: Vec<String> = questions.iter().filter_map(|q| q["field"].as_str().map(String::from)).collect();
            s = form_spec(&mut read, questions)?;
            let score = read.field("score_field", Some(&["number"]), false)?;
            s.insert("score_field".into(), opt(score.clone()));
            s.insert("reveal".into(), json!(read.choice("reveal", &QUIZ_REVEALS, "each")?));
            s.insert("pass_percent".into(), read.percent("pass_percent")?);
            if let Some(sc) = score.filter(|sc| asked.contains(sc)) {
                return Err(refuse("doublon", Some(&sc)));
            }
        }
        _ => {
            let questions = read.questions(false)?;
            s = form_spec(&mut read, questions)?;
        }
    }
    read.finish()?;
    Ok(s)
}

const SINGLE_FIELD_KEYS: [&str; 12] = [
    "group_by", "title_field", "cover_field", "date_field", "end_field", "start_field", "color_field", "depends_on", "score_field", "address_field", "latitude_field",
    "longitude_field",
];
const FIELD_LIST_KEYS: [&str; 5] = ["hidden", "pinned", "column_order", "card_fields", "system_columns"];
const PIVOT_KEYS: [&str; 6] = ["group_by", "date_field", "start_field", "address_field", "latitude_field", "longitude_field"];

fn is_word(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

fn is_ident_start(b: u8) -> bool {
    b.is_ascii_alphabetic() || b == b'_'
}

/// `citedFields`: the fields a filter cites — the first segment of every path that stands
/// before an operator, quoted values blanked first.
pub fn cited_fields(filter: &str) -> Vec<String> {
    static QUOTED: OnceLock<Regex> = OnceLock::new();
    let unquoted = re(&QUOTED, r#""(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'"#).replace_all(filter, "\"\"");
    let text = unquoted.as_ref();
    let b = text.as_bytes();
    let ident_end = |mut i: usize| {
        while i < b.len() && is_word(b[i]) {
            i += 1;
        }
        i
    };
    let mut cited = Vec::new();
    let mut p = 0;
    while p < b.len() {
        if !is_ident_start(b[p]) || (p > 0 && is_word(b[p - 1])) {
            p += 1;
            continue;
        }
        let name_end = ident_end(p);
        // The longest path first, `name.sub`, then `name` alone.
        let mut ends = Vec::new();
        if name_end + 1 < b.len() && b[name_end] == b'.' && is_ident_start(b[name_end + 1]) {
            ends.push(ident_end(name_end + 1));
        }
        ends.push(name_end);
        let mut matched = None;
        for end in ends {
            let rest = &text[end..];
            let spaces: usize = rest.chars().take_while(|c| js_space(*c)).map(char::len_utf8).sum();
            if spaces == 0 {
                continue;
            }
            let word: String = rest[spaces..].chars().take_while(|c| c.is_ascii_alphabetic() || *c == '_').collect();
            if word.is_empty() {
                continue;
            }
            matched = Some((end, word));
            break;
        }
        match matched {
            Some((end, operator)) => {
                if OPERATORS.contains(&operator.to_lowercase().as_str()) {
                    cited.push(text[p..name_end].to_string());
                }
                p = end;
            }
            None => p += 1,
        }
    }
    cited
}

/// `viewLoss`: what a view loses with one field gone.
pub fn view_loss(spec: &Map<String, Value>, name: &str) -> Option<&'static str> {
    let names = |key: &str| spec.get(key).and_then(Value::as_str) == Some(name);
    if PIVOT_KEYS.iter().any(|k| names(k)) {
        return Some("pivot");
    }
    if let Some(Value::String(f)) = spec.get("filter") {
        if cited_fields(f).iter().any(|c| c == name) {
            return Some("filter");
        }
    }
    if SINGLE_FIELD_KEYS.iter().any(|k| names(k)) {
        return Some("setting");
    }
    None
}

/// `projectViewSpec`: the spec as one reader may see it, and whether its filter hides it.
pub fn project_view_spec(spec: &Map<String, Value>, readable: &Readable) -> (Map<String, Value>, bool) {
    let sees = |v: &Value| matches!(v, Value::String(s) if readable.contains_key(s));
    let mut out = spec.clone();
    for key in SINGLE_FIELD_KEYS {
        if let Some(v) = out.get_mut(key) {
            if !sees(v) {
                *v = Value::Null;
            }
        }
    }
    for key in FIELD_LIST_KEYS {
        if let Some(Value::Array(items)) = out.get_mut(key) {
            items.retain(|v| sees(v));
        }
    }
    if let Some(Value::Array(items)) = out.get_mut("sorts") {
        items.retain(|t| t.get("field").is_some_and(&sees));
    }
    for key in ["column_widths", "summaries"] {
        if let Some(Value::Object(m)) = out.get_mut(key) {
            m.retain(|k, _| readable.contains_key(k));
        }
    }
    if let Some(Value::Array(items)) = out.get_mut("fields") {
        items.retain(|q| q.get("field").is_some_and(&sees));
        for q in items.iter_mut() {
            let hide = match q.get("show_if") {
                None | Some(Value::Null) => false,
                Some(c) => !c.get("field").is_some_and(&sees),
            };
            if hide {
                if let Some(m) = q.as_object_mut() {
                    m.insert("show_if".into(), Value::Null);
                }
            }
        }
    }
    if let Some(Value::Array(rules)) = out.get_mut("color_rules") {
        rules.retain(|r| matches!(r.get("filter"), Some(Value::String(f)) if cited_fields(f).iter().all(|n| readable.contains_key(n))));
    }
    if let Some(Value::String(t)) = out.get("card_template") {
        let replaced = template_variable()
            .replace_all(t, |c: &regex::Captures| if readable.contains_key(&c[1]) { c[0].to_string() } else { String::new() })
            .into_owned();
        out.insert("card_template".into(), json!(replaced));
    }
    let mut hidden = false;
    if let Some(Value::String(f)) = out.get("filter") {
        if !f.is_empty() {
            hidden = cited_fields(f).iter().any(|n| !readable.contains_key(n));
            if hidden {
                out.insert("filter".into(), json!(""));
            }
        }
    }
    (out, hidden)
}

/// `readableFields`: the fields of a table the actor reads, by physical name.
pub async fn readable_fields<E: Exec + Sync>(exec: &E, ctx: &RequestContext, grants: &ActorGrants, table_id: &str) -> R<Readable> {
    let Some(target) = load_target(exec, ctx, table_id).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
    };
    let decision = decide(ctx, grants, Action::Read, &target);
    let rows = exec
        .rows(
            "SELECT f.id::text, n.name, f.kind
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live AND f.deleted_at IS NULL
                AND f.definition_state = 'active'",
            &[&table_id],
        )
        .await?;
    let mut out: Readable = SYSTEM_VIEW_COLUMNS.iter().map(|(n, k)| (n.to_string(), k.to_string())).collect();
    for r in rows {
        let id: String = r.get(0);
        if decision.readable_fields.contains(&id) {
            out.insert(r.get(1), r.get(2));
        }
    }
    Ok(out)
}

/// A view as the API returns it — its spec already cut down to what the reader sees.
#[derive(Debug, Clone)]
pub struct SavedView {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub description: Option<String>,
    pub position: i32,
    pub spec: Map<String, Value>,
    pub filter_hidden: bool,
    pub personal: bool,
    pub locked: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl SavedView {
    /// `serializeView` of `app.ts`.
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "label": self.label,
            "kind": self.kind,
            "description": self.description,
            "position": self.position,
            "spec": self.spec,
            "filter_hidden": self.filter_hidden,
            "personal": self.personal,
            "locked": self.locked,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}

const VIEW_COLUMNS: &str = "id::text, label, kind, description, position, spec, owner_id::text, is_locked, created_at::text, updated_at::text";

fn to_view(r: &tokio_postgres::Row, readable: &Readable) -> SavedView {
    let spec = match r.get::<_, Option<Value>>(5) {
        Some(Value::Object(m)) => m,
        _ => Map::new(),
    };
    let (spec, filter_hidden) = project_view_spec(&spec, readable);
    SavedView {
        id: r.get(0),
        label: r.get(1),
        kind: r.get(2),
        description: r.get(3),
        position: r.get(4),
        spec,
        filter_hidden,
        personal: r.get::<_, Option<String>>(6).is_some(),
        locked: r.get(7),
        created_at: r.get(8),
        updated_at: r.get(9),
    }
}

fn normalize_label(value: Option<&Value>, table_id: &str) -> R<String> {
    let empty = || AppError::new("LABEL_EMPTY").with("table", json!(table_id));
    let Some(Value::String(s)) = value else { return Err(empty()) };
    let label = collapse_spaces(&nfc(s));
    if label.is_empty() {
        return Err(empty());
    }
    if label.chars().count() > MAX_LABEL_CHARS {
        return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(MAX_LABEL_CHARS)));
    }
    Ok(label)
}

/// `slugOf`: a slug of the label, for scripts and URLs; not unique, never a key.
pub fn slug_of(label: &str) -> String {
    static DIACRITIC: OnceLock<Regex> = OnceLock::new();
    static OTHER: OnceLock<Regex> = OnceLock::new();
    let decomposed: String = label.nfd().collect();
    let bare = re(&DIACRITIC, r"\p{Diacritic}").replace_all(&decomposed, "").to_lowercase();
    let slug = re(&OTHER, r"[^a-z0-9]+").replace_all(&bare, "_");
    let slug = slug.trim_matches('_');
    let cut: String = slug.chars().take(63).collect();
    let cut = cut.trim_end_matches('_');
    if cut.is_empty() {
        "vue".into()
    } else {
        cut.into()
    }
}

fn as_kind(value: Option<&Value>) -> R<String> {
    match value {
        Some(Value::String(k)) if VIEW_KINDS.contains(&k.as_str()) => Ok(k.clone()),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!("kind"))),
    }
}

async fn assert_label_free<E: Exec + Sync>(exec: &E, table_id: &str, label: &str, except: Option<&str>, owner: Option<&str>) -> R<()> {
    let clash = exec
        .rows(
            "SELECT id FROM _basedb.view_def
              WHERE table_id = $1::text::uuid AND label_key = $2 AND deleted_at IS NULL
                AND ($3::text::uuid IS NULL OR id <> $3::text::uuid)
                AND owner_id IS NOT DISTINCT FROM $4::text::uuid",
            &[&table_id, &label_key(label), &except, &owner],
        )
        .await?;
    if !clash.is_empty() {
        return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)));
    }
    Ok(())
}

/// `listViews`: the views of a table, in the order of its selector. `read` on the table.
pub async fn list_views(pools: &Pools, ctx: &RequestContext, table_id: &str) -> R<Vec<SavedView>> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = require_on_table(&tx, ctx, Action::Read, table_id).await?;
        let readable = readable_fields(&tx, ctx, &grants, table_id).await?;
        let rows = tx
            .rows(
                &format!(
                    "SELECT {VIEW_COLUMNS} FROM _basedb.view_def
                      WHERE table_id = $1::text::uuid AND deleted_at IS NULL
                        AND (owner_id IS NULL OR owner_id = $2::text::uuid)
                      ORDER BY owner_id IS NOT NULL, position, created_at"
                ),
                &[&table_id, &ctx.actor.id],
            )
            .await?;
        Ok(rows.iter().map(|r| to_view(r, &readable)).collect())
    })
    .await
}

/// What `createView` is asked.
pub struct ViewInput<'a> {
    pub label: Option<&'a Value>,
    pub kind: Option<&'a Value>,
    pub description: Option<&'a Value>,
    pub spec: Option<&'a Value>,
    pub personal: bool,
    pub locked: Option<&'a Value>,
}

/// `createView`: a view, placed last. `manage_schema`, or `read` for a personal one.
pub async fn create_view(pools: &Pools, ctx: &RequestContext, table_id: &str, input: &ViewInput<'_>) -> R<SavedView> {
    let label = normalize_label(input.label, table_id)?;
    let kind = as_kind(input.kind)?;
    let description = normalize_description(input.description, "description")?;
    let personal = input.personal;
    let (label, kind, description) = (&label, &kind, &description);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let action = if personal { Action::Read } else { Action::ManageSchema };
        let grants = require_on_table(&tx, ctx, action, table_id).await?;
        let readable = readable_fields(&tx, ctx, &grants, table_id).await?;
        let links = self_links_of(&tx, table_id).await?;
        let spec = normalize_view_spec(kind, input.spec, &readable, &links)?;
        let owner = personal.then(|| ctx.actor.id.clone());
        assert_label_free(&tx, table_id, label, None, owner.as_deref()).await?;
        let rows = tx
            .query_op(
                &format!(
                    "INSERT INTO _basedb.view_def
                       (table_id, label, label_key, name, description, kind, spec, position,
                        created_by, updated_by, owner_id)
                     VALUES ($1::text::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text::jsonb,
                             (SELECT coalesce(max(position), 0) + 1 FROM _basedb.view_def
                               WHERE table_id = $1::text::uuid AND deleted_at IS NULL),
                             $8::text::uuid, $8::text::uuid, $9::text::uuid)
                     RETURNING {VIEW_COLUMNS}"
                ),
                &[&table_id, label, &label_key(label), &slug_of(label), description, kind, &Value::Object(spec).to_string(), &ctx.actor.id, &owner],
                SqlOp::Insert,
            )
            .await?;
        Ok(to_view(&rows[0], &readable))
    })
    .await
}

struct Current {
    kind: String,
    owner_id: Option<String>,
    is_locked: bool,
}

async fn current_view<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str, view_id: &str) -> R<Current> {
    let row = exec
        .first(
            "SELECT kind, owner_id::text, is_locked FROM _basedb.view_def
              WHERE id::text = $1 AND table_id = $2::text::uuid AND deleted_at IS NULL",
            &[&view_id, &table_id],
        )
        .await?;
    match row {
        Some(r) => {
            let c = Current { kind: r.get(0), owner_id: r.get(1), is_locked: r.get(2) };
            if c.owner_id.as_ref().is_some_and(|o| *o != ctx.actor.id) {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("view", json!(view_id)));
            }
            Ok(c)
        }
        None => Err(AppError::new("RESOURCE_NOT_FOUND").with("view", json!(view_id))),
    }
}

/// `updateView`: label, description, spec (replaced whole) and/or lock.
pub async fn update_view(pools: &Pools, ctx: &RequestContext, table_id: &str, view_id: &str, input: &ViewInput<'_>) -> R<SavedView> {
    let label = match input.label {
        None => None,
        Some(v) => Some(normalize_label(Some(v), table_id)?),
    };
    let sets_description = input.description.is_some();
    let description = if sets_description { normalize_description(input.description, "description")? } else { None };
    let locked = match input.locked {
        None => None,
        Some(Value::Bool(b)) => Some(*b),
        Some(_) => return Err(AppError::new("REQUEST_INVALID").with("field", json!("locked"))),
    };
    let changes = label.is_some() || sets_description || input.spec.is_some();
    if !changes && locked.is_none() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("body")));
    }
    let (label, description) = (&label, &description);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let current = current_view(&tx, ctx, table_id, view_id).await?;
        if current.owner_id.is_some() && locked.is_some() {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("locked")).with("reason", json!("vue_personnelle")));
        }
        let action = if current.owner_id.is_none() { Action::ManageSchema } else { Action::Read };
        let grants = require_on_table(&tx, ctx, action, table_id).await?;
        if current.is_locked && changes && locked != Some(false) {
            return Err(AppError::new("VIEW_LOCKED").with("view", json!(view_id)));
        }
        let readable = readable_fields(&tx, ctx, &grants, table_id).await?;
        let spec = match input.spec {
            None => None,
            Some(raw) => {
                let links = self_links_of(&tx, table_id).await?;
                Some(Value::Object(normalize_view_spec(&current.kind, Some(raw), &readable, &links)?).to_string())
            }
        };
        if let Some(l) = label {
            assert_label_free(&tx, table_id, l, Some(view_id), current.owner_id.as_deref()).await?;
        }
        let rows = tx
            .query_op(
                &format!(
                    "UPDATE _basedb.view_def
                        SET label = coalesce($2::text, label),
                            label_key = coalesce($3::text, label_key),
                            name = coalesce($4::text, name),
                            description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
                            spec = coalesce($7::text::jsonb, spec),
                            is_locked = coalesce($9::boolean, is_locked),
                            updated_at = clock_timestamp(), updated_by = $8::text::uuid
                      WHERE id = $1::text::uuid
                      RETURNING {VIEW_COLUMNS}"
                ),
                &[
                    &view_id,
                    label,
                    &label.as_deref().map(label_key),
                    &label.as_deref().map(slug_of),
                    &sets_description,
                    description,
                    &spec,
                    &ctx.actor.id,
                    &locked,
                ],
                SqlOp::Update,
            )
            .await?;
        Ok(to_view(&rows[0], &readable))
    })
    .await
}

/// `deleteView`: logically, like every catalog object.
pub async fn delete_view(pools: &Pools, ctx: &RequestContext, table_id: &str, view_id: &str) -> R<()> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let current = current_view(&tx, ctx, table_id, view_id).await?;
        let action = if current.owner_id.is_none() { Action::ManageSchema } else { Action::Read };
        require_on_table(&tx, ctx, action, table_id).await?;
        if current.is_locked {
            return Err(AppError::new("VIEW_LOCKED").with("view", json!(view_id)));
        }
        let rows = tx
            .query_op(
                "UPDATE _basedb.view_def
                    SET deleted_at = clock_timestamp(), deleted_by = $3::text::uuid
                  WHERE id::text = $1 AND table_id = $2::text::uuid AND deleted_at IS NULL
                  RETURNING id::text",
                &[&view_id, &table_id, &ctx.actor.id],
                SqlOp::Update,
            )
            .await?;
        if rows.is_empty() {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("view", json!(view_id)));
        }
        Ok(())
    })
    .await
}

/// `reorderViews`: the shared order, as the list of identifiers; views it does not name
/// keep their relative order after the others.
pub async fn reorder_views(pools: &Pools, ctx: &RequestContext, table_id: &str, ids: &[String]) -> R<Vec<String>> {
    if let Some(r) = first_repeated(ids) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("views")).with("reason", json!("doublon")).with("detail", json!(r)));
    }
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let views: Vec<(String, i32)> = tx
            .rows(
                "SELECT id::text, position FROM _basedb.view_def
                  WHERE table_id = $1::text::uuid AND deleted_at IS NULL AND owner_id IS NULL
                  ORDER BY position, created_at",
                &[&table_id],
            )
            .await?
            .iter()
            .map(|r| (r.get(0), r.get(1)))
            .collect();
        if let Some(unknown) = ids.iter().find(|id| !views.iter().any(|(v, _)| v == *id)) {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("view", json!(unknown)));
        }
        let mut order: Vec<String> = ids.to_vec();
        order.extend(views.iter().filter(|(v, _)| !ids.contains(v)).map(|(v, _)| v.clone()));
        for (index, id) in order.iter().enumerate() {
            let position = index as i32 + 1;
            if views.iter().any(|(v, p)| v == id && *p == position) {
                continue;
            }
            tx.execute_op(
                "UPDATE _basedb.view_def
                    SET position = $2, updated_at = clock_timestamp(), updated_by = $3::text::uuid
                  WHERE id = $1::text::uuid",
                &[id, &position, &ctx.actor.id],
                SqlOp::Update,
            )
            .await?;
        }
        Ok(order)
    })
    .await
}

/// `selfLinksOf`: the relations of a table to itself, by physical name.
async fn self_links_of<E: Exec + Sync>(exec: &E, table_id: &str) -> R<HashSet<String>> {
    let rows = exec
        .rows(
            "SELECT n.name
               FROM _basedb.field f
               JOIN _basedb.physical_name n      ON n.id = f.name_id
               JOIN _basedb.field_link_config lc ON lc.field_id = f.id
              WHERE f.table_id = $1::text::uuid AND f.is_live AND lc.target_table_id = $1::text::uuid
                AND lc.fk_dropped_at IS NULL",
            &[&table_id],
        )
        .await?;
    Ok(rows.iter().map(|r| r.get(0)).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fields() -> Readable {
        [
            ("titre", "short_text"),
            ("statut", "select"),
            ("debut", "date"),
            ("fin", "date"),
            ("montant", "number"),
            ("piece", "file"),
            ("parent", "link"),
            ("_created_at", "datetime"),
            ("_created_by", "user"),
            ("calcul", "formula"),
            ("tags", "multi_select"),
        ]
        .iter()
        .map(|(a, b)| (a.to_string(), b.to_string()))
        .collect()
    }

    fn spec(kind: &str, raw: Value) -> R<Map<String, Value>> {
        normalize_view_spec(kind, Some(&raw), &fields(), &HashSet::from(["parent".to_string()]))
    }

    fn reason(e: AppError) -> (String, Option<String>) {
        (e.details["reason"].as_str().unwrap().to_string(), e.details.get("detail").and_then(Value::as_str).map(String::from))
    }

    #[test]
    fn grid_defaults_and_bounds() {
        let s = spec("grid", json!({})).unwrap();
        assert_eq!(s["page_size"], json!(100));
        assert_eq!(s["row_height"], json!("short"));
        assert_eq!(s["color_style"], json!("both"));
        let s = spec("grid", json!({ "column_widths": { "titre": 10, "montant": 700.4, "debut": 100.5 }, "page_size": 50.0 })).unwrap();
        assert_eq!(s["column_widths"], json!({ "titre": 64, "montant": 640, "debut": 101 }));
        assert_eq!(s["page_size"].to_string(), "50");
        assert_eq!(reason(spec("grid", json!({ "page_size": 501 })).unwrap_err()), ("valeur_invalide".into(), Some("page_size".into())));
        assert_eq!(reason(spec("grid", json!({ "date": 1 })).unwrap_err()), ("cle_inconnue".into(), Some("date".into())));
        assert_eq!(reason(spec("grid", json!({ "hidden": ["titre", "titre"] })).unwrap_err()), ("doublon".into(), Some("titre".into())));
        assert_eq!(reason(spec("grid", json!({ "system_columns": ["titre"] })).unwrap_err()).0, "type_de_champ_incompatible");
        assert_eq!(reason(spec("grid", json!({ "summaries": { "titre": "sum" } })).unwrap_err()).0, "valeur_invalide");
        assert!(spec("grid", json!({ "summaries": { "montant": "sum" } })).is_ok());
        assert_eq!(reason(spec("grid", json!({ "sorts": [1, 2, 3, 4] })).unwrap_err()), ("trop_de_tris".into(), None));
        assert_eq!(reason(normalize_view_spec("grid", Some(&json!([])), &fields(), &HashSet::new()).unwrap_err()).0, "spec_invalide");
    }

    #[test]
    fn pivots_and_kinds() {
        assert_eq!(reason(spec("kanban", json!({})).unwrap_err()), ("champ_pivot_manquant".into(), Some("group_by".into())));
        assert_eq!(reason(spec("kanban", json!({ "group_by": "debut" })).unwrap_err()), ("type_de_champ_incompatible".into(), Some("debut".into())));
        assert_eq!(reason(spec("kanban", json!({ "group_by": "inconnu" })).unwrap_err()), ("champ_inconnu".into(), Some("inconnu".into())));
        assert_eq!(reason(spec("calendar", json!({ "date_field": "debut", "end_field": "debut" })).unwrap_err()).0, "doublon");
        assert!(spec("timeline", json!({ "start_field": "debut", "depends_on": "parent" })).is_ok());
        assert_eq!(reason(spec("map", json!({ "latitude_field": "montant" })).unwrap_err()), ("champ_pivot_manquant".into(), Some("address_field".into())));
        let s = spec("kanban", json!({ "group_by": "statut", "card_template": "Le {{ titre }} !" })).unwrap();
        assert_eq!(s["card_template"], json!("Le {{titre}} !"));
        assert_eq!(reason(spec("kanban", json!({ "group_by": "statut", "manual_order": ["x"] })).unwrap_err()).0, "valeur_invalide");
    }

    #[test]
    fn forms_and_quizzes() {
        assert_eq!(reason(spec("form", json!({ "fields": [] })).unwrap_err()), ("formulaire_vide".into(), None));
        assert_eq!(reason(spec("form", json!({ "fields": [{ "field": "calcul" }] })).unwrap_err()).0, "type_de_champ_incompatible");
        let s = spec("form", json!({ "fields": [{ "field": "titre" }, { "field": "statut", "show_if": { "field": "titre", "op": "answered" } }] })).unwrap();
        assert_eq!(s["fields"][1]["show_if"], json!({ "field": "titre", "op": "answered", "value": null }));
        assert_eq!(reason(spec("form", json!({ "fields": [{ "field": "statut", "show_if": { "field": "titre", "op": "answered" } }] })).unwrap_err()).0, "condition_invalide");
        assert_eq!(reason(spec("form", json!({ "fields": [{ "field": "titre", "x": 1 }] })).unwrap_err()), ("cle_inconnue".into(), Some("x".into())));
        let s = spec("quiz", json!({ "fields": [{ "field": "tags", "correct": [" a ", "b"], "points": 2.0 }] })).unwrap();
        assert_eq!(s["fields"][0]["correct"], json!(["a", "b"]));
        assert_eq!(s["fields"][0]["points"].to_string(), "2");
        assert_eq!(reason(spec("quiz", json!({ "fields": [{ "field": "montant" }], "score_field": "montant" })).unwrap_err()).0, "doublon");
    }

    #[test]
    fn cites_fields_before_operators() {
        assert_eq!(cited_fields("statut eq \"titre eq x\" and not debut is_null"), vec!["statut", "debut"]);
        assert_eq!(cited_fields("parent.nom contains 'a'"), vec!["parent"]);
        assert_eq!(cited_fields("a.b.c eq 1"), vec!["b"]);
        assert!(cited_fields("titre").is_empty());
    }

    #[test]
    fn projects_for_a_reader() {
        let mut readable = fields();
        readable.shift_remove("statut");
        let raw = json!({ "group_by": "statut", "card_fields": ["titre", "statut"], "filter": "statut eq 'a'", "card_template": "{{statut}} - {{titre}}", "color_rules": [{ "filter": "statut eq 'x'" }] });
        let (s, hidden) = project_view_spec(raw.as_object().unwrap(), &readable);
        assert!(hidden);
        assert_eq!(s["group_by"], Value::Null);
        assert_eq!(s["card_fields"], json!(["titre"]));
        assert_eq!(s["filter"], json!(""));
        assert_eq!(s["card_template"], json!(" - {{titre}}"));
        assert_eq!(s["color_rules"], json!([]));
        assert_eq!(view_loss(raw.as_object().unwrap(), "statut"), Some("pivot"));
    }

    #[test]
    fn slugs_and_keys() {
        assert_eq!(slug_of("Été à Paris !"), "ete_a_paris");
        assert_eq!(slug_of("!!!"), "vue");
        let m = json!({ "b": 1, "10": 2, "a": 3, "2": 4 });
        let keys: Vec<&str> = js_keys(m.as_object().unwrap()).into_iter().map(String::as_str).collect();
        assert_eq!(keys, vec!["2", "10", "b", "a"]);
    }
}
