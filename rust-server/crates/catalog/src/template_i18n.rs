//! The official templates in the reader's language — `localizeTemplate` and `rewrite` of
//! `packages/contracts/src/template-i18n.ts`, and `formulaInEnglish` of `formula-words.ts`.
//!
//! A dictionary maps each French text to its translation; a label is translated once and
//! followed wherever it is cited. The result goes through `check_template` again: a
//! dictionary that breaks the template is refused, and the French one is served.

use crate::description::js_trim;
use crate::template_check::{check_template, label_key, view_field_keys};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::LazyLock;

static CITATION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{(\s*)([^{}]+?)(\s*)\}\}").unwrap());
static SPECIAL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\{\{\s*_[^{}]*\}\}$").unwrap());
static WORD: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[\p{L}_][\p{L}\p{N}_]*").unwrap());

/// `FORMULA_ENGLISH`.
fn english(word: &str) -> Option<&'static str> {
    Some(match word {
        "SI" => "IF",
        "SIVIDE" => "IFBLANK",
        "ESTVIDE" => "ISBLANK",
        "ARRONDI" => "ROUND",
        "PLAFOND" => "CEILING",
        "PLANCHER" => "FLOOR",
        "MAJUSCULE" => "UPPER",
        "MINUSCULE" => "LOWER",
        "SANSESPACES" => "TRIM",
        "GAUCHE" => "LEFT",
        "DROITE" => "RIGHT",
        "LONGUEUR" => "LEN",
        "TEXTE" => "TEXT",
        "NOMBRE" => "VALUE",
        "STXT" => "MID",
        "SUBSTITUE" => "SUBSTITUTE",
        "TROUVE" => "FIND",
        "CHERCHE" => "SEARCH",
        "CONTIENT" => "CONTAINS",
        "COMMENCEPAR" => "STARTSWITH",
        "FINITPAR" => "ENDSWITH",
        "NOMPROPRE" => "PROPER",
        "JOINDRE_TEXTE" => "TEXTJOIN",
        "REGEX_CORRESPOND" => "REGEXMATCH",
        "REGEX_EXTRAIRE" => "REGEXEXTRACT",
        "REGEX_REMPLACER" => "REGEXREPLACE",
        "ANNEE" => "YEAR",
        "MOIS" => "MONTH",
        "JOUR" => "DAY",
        "HEURE" => "HOUR",
        "SECONDE" => "SECOND",
        "JOURSEMAINE" => "WEEKDAY",
        "NO_SEMAINE_ISO" => "ISOWEEKNUM",
        "JOURS" => "DAYS",
        "AJOUTER_JOURS" => "ADD_DAYS",
        "AJOUTER_MOIS" => "ADD_MONTHS",
        "FIN_MOIS" => "EOMONTH",
        "AUJOURDHUI" => "TODAY",
        "MAINTENANT" => "NOW",
        "VRAI" => "TRUE",
        "FAUX" => "FALSE",
        "ET" => "AND",
        "OU" => "OR",
        "NON" => "NOT",
        _ => return None,
    })
}

/// `formulaInEnglish`: words renamed, `;` written `,`, citations and texts untouched.
pub fn formula_in_english(text: &str) -> String {
    let t: Vec<char> = text.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < t.len() {
        let c = t[i];
        if c == '"' || c == '[' {
            let close = if c == '"' { '"' } else { ']' };
            let mut j = i + 1;
            while j < t.len() {
                if t[j] == close {
                    if close == ']' && t.get(j + 1) == Some(&']') {
                        j += 2;
                        continue;
                    }
                    break;
                }
                j += 1;
            }
            out.extend(t[i..(j + 1).min(t.len())].iter());
            i = j + 1;
            continue;
        }
        let rest: String = t[i..].iter().collect();
        if let Some(m) = WORD.find(&rest) {
            let word = m.as_str();
            out.push_str(english(&word.to_uppercase()).unwrap_or(word));
            i += word.chars().count();
            continue;
        }
        out.push(if c == ';' { ',' } else { c });
        i += 1;
    }
    out
}

/// A template's texts in one language: the French text → its translation.
pub type Dictionary = Map<String, Value>;

struct Words<'a> {
    dictionary: &'a Dictionary,
    english: bool,
}

impl Words<'_> {
    /// `lookup`: the translation, when it says something.
    fn tr(&self, text: &str) -> String {
        match self.dictionary.get(text) {
            Some(Value::String(t)) if !js_trim(t).is_empty() => t.clone(),
            _ => text.to_string(),
        }
    }

    /// `citations`: the `{{Libellé}}` of a text rewritten.
    fn citations(&self, text: &str) -> String {
        CITATION
            .replace_all(text, |c: &regex::Captures| {
                if c[2].starts_with('_') {
                    c[0].to_string()
                } else {
                    format!("{{{{{}{}{}}}}}", &c[1], self.tr(&c[2]), &c[3])
                }
            })
            .into_owned()
    }

    /// `expression`: its `[Libellé]` and its string literals rewritten.
    fn expression(&self, text: &str) -> String {
        let t: Vec<char> = text.chars().collect();
        let mut out = String::new();
        let mut i = 0;
        while i < t.len() {
            let c = t[i];
            if c == '"' {
                let mut j = i + 1;
                while j < t.len() && t[j] != '"' {
                    j += if t[j] == '\\' { 2 } else { 1 };
                }
                let end = (j + 1).min(t.len());
                let raw: String = if end > i + 1 { t[i + 1..end - 1].iter().collect() } else { String::new() };
                let inner = unescape(&raw);
                let translated = self.tr(&inner);
                if translated == inner {
                    out.extend(t[i..end].iter());
                } else {
                    out.push_str(&serde_json::to_string(&translated).unwrap_or_default());
                }
                i = end;
                continue;
            }
            if c == '[' {
                let mut j = i + 1;
                let mut label = String::new();
                while j < t.len() {
                    if t[j] == ']' {
                        if t.get(j + 1) == Some(&']') {
                            label.push(']');
                            j += 2;
                            continue;
                        }
                        break;
                    }
                    label.push(t[j]);
                    j += 1;
                }
                out.push('[');
                out.push_str(&self.tr(&label).replace(']', "]]"));
                out.push(']');
                i = j + 1;
                continue;
            }
            out.push(c);
            i += 1;
        }
        out
    }

    fn formula(&self, text: &str) -> String {
        let rewritten = self.expression(text);
        if self.english {
            formula_in_english(&rewritten)
        } else {
            rewritten
        }
    }
}

/// `.replace(/\\(.)/g, '$1')`.
fn unescape(s: &str) -> String {
    let mut out = String::new();
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\\' {
            if let Some(&n) = it.peek() {
                if !matches!(n, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
                    out.push(n);
                    it.next();
                    continue;
                }
            }
        }
        out.push(c);
    }
    out
}

fn str_of(v: &Value) -> &str {
    v.as_str().unwrap_or_default()
}

/// Copies `key` when the object has it.
fn keep(out: &mut Map<String, Value>, from: &Value, key: &str) {
    if let Some(v) = from.get(key) {
        out.insert(key.into(), v.clone());
    }
}

/// Translates `key` when the object has it.
fn optional(out: &mut Map<String, Value>, from: &Value, key: &str, w: &Words) {
    if let Some(v) = from.get(key).and_then(Value::as_str) {
        out.insert(key.into(), json!(w.tr(v)));
    }
}

/// `rewrite`: the template through `words`, as a raw template the validator reads back.
fn rewrite(t: &Value, w: &Words) -> Value {
    let empty = vec![];
    let arr = |v: &Value| -> Vec<Value> { v.as_array().unwrap_or(&empty).clone() };
    let mut kinds: HashMap<String, HashMap<String, String>> = HashMap::new();
    for table in arr(&t["tables"]) {
        let mut own = HashMap::new();
        for field in arr(&table["fields"]) {
            own.insert(label_key(str_of(&field["label"])), str_of(&field["kind"]).to_string());
        }
        kinds.insert(str_of(&table["key"]).to_string(), own);
    }
    for link in arr(&t["links"]) {
        if let Some(own) = kinds.get_mut(str_of(&link["from"])) {
            own.insert(label_key(str_of(&link["label"])), "link".into());
        }
    }

    let tables: Vec<Value> = arr(&t["tables"])
        .iter()
        .map(|table| {
            let mut out = Map::new();
            out.insert("key".into(), table["key"].clone());
            out.insert("label".into(), json!(w.tr(str_of(&table["label"]))));
            optional(&mut out, table, "description", w);
            keep(&mut out, table, "icon");
            keep(&mut out, table, "color");
            let fields: Vec<Value> = arr(&table["fields"])
                .iter()
                .map(|field| {
                    let mut f = Map::new();
                    f.insert("label".into(), json!(w.tr(str_of(&field["label"]))));
                    f.insert("kind".into(), field["kind"].clone());
                    optional(&mut f, field, "description", w);
                    if field.get("required") == Some(&Value::Bool(true)) {
                        f.insert("required".into(), json!(true));
                    }
                    if let Some(options) = field.get("options").and_then(Value::as_array) {
                        let list: Vec<Value> = options
                            .iter()
                            .map(|o| {
                                let mut m = Map::new();
                                m.insert("label".into(), json!(w.tr(str_of(&o["label"]))));
                                if !o["color"].is_null() {
                                    m.insert("color".into(), o["color"].clone());
                                }
                                if !o["icon"].is_null() {
                                    m.insert("icon".into(), o["icon"].clone());
                                }
                                Value::Object(m)
                            })
                            .collect();
                        f.insert("options".into(), Value::Array(list));
                    }
                    keep(&mut f, field, "format");
                    if field.get("rich") == Some(&Value::Bool(true)) {
                        f.insert("rich".into(), json!(true));
                    }
                    if let Some(formula) = field.get("formula").and_then(Value::as_str) {
                        f.insert("formula".into(), json!(w.formula(formula)));
                    }
                    if let Some(rollup) = field.get("rollup").and_then(Value::as_object) {
                        let mut r = rollup.clone();
                        r.insert("via".into(), json!(w.tr(str_of(&rollup["via"]))));
                        if let Some(target) = rollup.get("target").and_then(Value::as_str) {
                            r.insert("target".into(), json!(w.tr(target)));
                        }
                        f.insert("rollup".into(), Value::Object(r));
                    }
                    if let Some(ai) = field.get("ai") {
                        f.insert("ai".into(), json!({ "prompt": w.citations(&w.tr(str_of(&ai["prompt"]))), "refresh": ai["refresh"] }));
                    }
                    if let Some(button) = field.get("button") {
                        let mut b = Map::new();
                        b.insert("label".into(), json!(w.tr(str_of(&button["label"]))));
                        keep(&mut b, button, "color");
                        if let Some(url) = button.get("url").and_then(Value::as_str) {
                            b.insert("url".into(), json!(w.citations(&w.tr(url))));
                        }
                        keep(&mut b, button, "automation");
                        f.insert("button".into(), Value::Object(b));
                    }
                    Value::Object(f)
                })
                .collect();
            out.insert("fields".into(), Value::Array(fields));
            Value::Object(out)
        })
        .collect();

    let links: Vec<Value> = arr(&t["links"])
        .iter()
        .map(|link| {
            let mut out = Map::new();
            out.insert("from".into(), link["from"].clone());
            out.insert("label".into(), json!(w.tr(str_of(&link["label"]))));
            out.insert("to".into(), link["to"].clone());
            out.insert("multiple".into(), link["multiple"].clone());
            optional(&mut out, link, "description", w);
            Value::Object(out)
        })
        .collect();

    let mut rows = Map::new();
    let no_kinds = HashMap::new();
    for (table_key, list) in t["rows"].as_object().cloned().unwrap_or_default() {
        let own = kinds.get(&table_key).unwrap_or(&no_kinds);
        let out: Vec<Value> = arr(&list)
            .iter()
            .map(|row| {
                let mut out = Map::new();
                for (label, value) in row.as_object().cloned().unwrap_or_default() {
                    if label == "$key" {
                        out.insert("$key".into(), value);
                        continue;
                    }
                    let kind = own.get(&label_key(&label)).map(String::as_str);
                    let sample = match &value {
                        Value::String(s) => match kind {
                            Some("select") => json!(w.tr(s)),
                            Some("short_text" | "long_text" | "email" | "url") => json!(w.tr(s)),
                            _ => value.clone(),
                        },
                        Value::Array(list) if kind == Some("multi_select") => Value::Array(list.iter().map(|v| json!(w.tr(str_of(v)))).collect()),
                        _ => value.clone(),
                    };
                    out.insert(w.tr(&label), sample);
                }
                Value::Object(out)
            })
            .collect();
        rows.insert(table_key, Value::Array(out));
    }

    let views: Vec<Value> = arr(&t["views"])
        .iter()
        .map(|view| {
            let kind = str_of(&view["kind"]);
            let (one, many, _) = view_field_keys(kind);
            let mut spec = Map::new();
            for (key, value) in view["spec"].as_object().cloned().unwrap_or_default() {
                let k = key.as_str();
                let rewritten = if one.contains(&k) && value.is_string() {
                    json!(w.tr(str_of(&value)))
                } else if (many.contains(&k) || k == "group_order") && value.is_array() {
                    Value::Array(arr(&value).iter().map(|v| if let Some(s) = v.as_str() { json!(w.tr(s)) } else { v.clone() }).collect())
                } else if k == "filter" && value.is_string() {
                    json!(w.expression(str_of(&value)))
                } else if k == "sorts" && value.is_array() {
                    Value::Array(
                        arr(&value)
                            .iter()
                            .map(|s| {
                                let mut m = s.as_object().cloned().unwrap_or_default();
                                m.insert("field".into(), json!(w.tr(str_of(&s["field"]))));
                                Value::Object(m)
                            })
                            .collect(),
                    )
                } else if k == "summaries" && value.is_object() {
                    Value::Object(value.as_object().unwrap().iter().map(|(l, f)| (w.tr(l), f.clone())).collect())
                } else if k == "color_rules" && value.is_array() {
                    Value::Array(
                        arr(&value)
                            .iter()
                            .map(|r| {
                                let mut m = r.as_object().cloned().unwrap_or_default();
                                m.insert("filter".into(), json!(w.expression(str_of(&r["filter"]))));
                                Value::Object(m)
                            })
                            .collect(),
                    )
                } else if ["title", "description", "submit_label", "success_message", "welcome_label", "end_link_label"].contains(&k) && value.is_string() {
                    json!(w.tr(str_of(&value)))
                } else if k == "fields" && kind == "form" && value.is_array() {
                    Value::Array(
                        arr(&value)
                            .iter()
                            .map(|q| {
                                let mut m = Map::new();
                                m.insert("field".into(), json!(w.tr(str_of(&q["field"]))));
                                keep(&mut m, q, "required");
                                for t in ["label", "help", "placeholder"] {
                                    if let Some(s) = q.get(t) {
                                        m.insert(t.into(), json!(w.tr(str_of(s))));
                                    }
                                }
                                keep(&mut m, q, "prefill");
                                if let Some(show) = q.get("show_if").and_then(Value::as_object) {
                                    let mut s = show.clone();
                                    s.insert("field".into(), json!(w.tr(str_of(&show["field"]))));
                                    if let Some(Value::String(v)) = show.get("value") {
                                        s.insert("value".into(), json!(w.tr(v)));
                                    }
                                    m.insert("show_if".into(), Value::Object(s));
                                }
                                Value::Object(m)
                            })
                            .collect(),
                    )
                } else {
                    value.clone()
                };
                spec.insert(key, rewritten);
            }
            let mut out = Map::new();
            out.insert("table".into(), view["table"].clone());
            out.insert("label".into(), json!(w.tr(str_of(&view["label"]))));
            out.insert("kind".into(), view["kind"].clone());
            optional(&mut out, view, "description", w);
            out.insert("spec".into(), Value::Object(spec));
            Value::Object(out)
        })
        .collect();

    let values = |table_key: Option<&str>, given: &Value| -> Value {
        let mut out = Map::new();
        for (label, value) in given.as_object().cloned().unwrap_or_default() {
            let kind = table_key.and_then(|k| kinds.get(k)).and_then(|own| own.get(&label_key(&label))).map(String::as_str);
            let written = match &value {
                Value::String(s) if matches!(kind, Some("select" | "multi_select")) => json!(w.tr(s)),
                Value::String(s) if SPECIAL.is_match(js_trim(s)) => value.clone(),
                Value::String(s) => json!(w.citations(&w.tr(s))),
                _ => value.clone(),
            };
            out.insert(w.tr(&label), written);
        }
        Value::Object(out)
    };
    let automations: Vec<Value> = arr(&t["automations"])
        .iter()
        .map(|a| {
            let mut out = Map::new();
            keep(&mut out, a, "key");
            out.insert("label".into(), json!(w.tr(str_of(&a["label"]))));
            optional(&mut out, a, "description", w);
            out.insert("enabled".into(), a["enabled"].clone());
            let mut trigger = a["trigger"].as_object().cloned().unwrap_or_default();
            trigger.insert("fields".into(), Value::Array(arr(&a["trigger"]["fields"]).iter().map(|f| json!(w.tr(str_of(f)))).collect()));
            out.insert("trigger".into(), Value::Object(trigger));
            out.insert("condition".into(), json!(w.expression(str_of(&a["condition"]))));
            let actions: Vec<Value> = arr(&a["actions"])
                .iter()
                .map(|x| match str_of(&x["kind"]) {
                    "update_record" => json!({ "kind": "update_record", "values": values(a["trigger"]["table"].as_str(), &x["values"]) }),
                    "create_record" => json!({ "kind": "create_record", "table": x["table"], "values": values(x["table"].as_str(), &x["values"]) }),
                    _ => {
                        let message = str_of(&x["message"]);
                        json!({
                            "kind": "notify",
                            "users": x["users"],
                            "user_field": if x["user_field"].is_null() { Value::Null } else { json!(w.tr(str_of(&x["user_field"]))) },
                            "message": if message.is_empty() { String::new() } else { w.citations(&w.tr(message)) },
                        })
                    }
                })
                .collect();
            out.insert("actions".into(), Value::Array(actions));
            Value::Object(out)
        })
        .collect();

    let mut out = Map::new();
    out.insert("format".into(), t["format"].clone());
    out.insert("key".into(), t["key"].clone());
    out.insert("label".into(), json!(w.tr(str_of(&t["label"]))));
    let summary = str_of(&t["summary"]);
    out.insert("summary".into(), json!(if summary.is_empty() { String::new() } else { w.tr(summary) }));
    optional(&mut out, t, "description", w);
    optional(&mut out, t, "category", w);
    keep(&mut out, t, "icon");
    keep(&mut out, t, "color");
    out.insert("tags".into(), Value::Array(arr(&t["tags"]).iter().map(|x| json!(w.tr(str_of(x)))).collect()));
    let mut base = Map::new();
    base.insert("label".into(), json!(w.tr(str_of(&t["base"]["label"]))));
    optional(&mut base, &t["base"], "description", w);
    out.insert("base".into(), Value::Object(base));
    out.insert("tables".into(), Value::Array(tables));
    out.insert("links".into(), Value::Array(links));
    out.insert("rows".into(), Value::Object(rows));
    out.insert("views".into(), Value::Array(views));
    out.insert("automations".into(), Value::Array(automations));
    Value::Object(out)
}

/// `localizeTemplate`: the template in the language of `dictionary`, checked — `None`
/// when the dictionary breaks it. `english`: its formulas in English (a screen not French).
pub fn localize_template(template: &Value, dictionary: &Dictionary, english: bool) -> Option<Value> {
    check_template(&rewrite(template, &Words { dictionary, english })).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::template_check::check_template;

    #[test]
    fn formulas_read_in_english() {
        assert_eq!(formula_in_english(r#"SI([Prix]>0; ARRONDI([Prix];2); "SI")"#), r#"IF([Prix]>0, ROUND([Prix],2), "SI")"#);
        assert_eq!(formula_in_english("aujourdhui() + [a]]b]"), "TODAY() + [a]]b]");
    }

    #[test]
    fn localizes_labels_and_citations() {
        let t = check_template(&json!({
            "key": "essai", "label": "Essai", "summary": "",
            "tables": [{ "key": "clients", "label": "Clients", "fields": [
                { "label": "Nom", "kind": "short_text" },
                { "label": "Statut", "kind": "select", "options": ["Actif"] },
                { "label": "Calcul", "kind": "formula", "formula": "SI([Nom] = \"x\"; 1; 2)" }
            ]}],
            "rows": { "clients": [{ "Nom": "Alpha", "Statut": "Actif" }] },
            "views": [{ "table": "clients", "label": "Liste", "kind": "grid", "spec": { "filter": "[Statut] = \"Actif\"" } }]
        }))
        .unwrap();
        let dict: Dictionary = serde_json::from_value(json!({ "Nom": "Name", "Statut": "Status", "Actif": "Active", "Clients": "Customers" })).unwrap();
        let l = localize_template(&t, &dict, true).unwrap();
        assert_eq!(l["tables"][0]["label"], "Customers");
        assert_eq!(l["tables"][0]["fields"][2]["formula"], "IF([Name] = \"x\", 1, 2)");
        assert_eq!(l["rows"]["clients"][0], json!({ "Name": "Alpha", "Status": "Active" }));
        assert_eq!(l["views"][0]["spec"]["filter"], "[Status] = \"Active\"");
        let broken: Dictionary = serde_json::from_value(json!({ "Statut": "Nom" })).unwrap();
        assert!(localize_template(&t, &broken, false).is_none());
    }
}
