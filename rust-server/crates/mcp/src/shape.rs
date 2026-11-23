//! Transport adaptations of the agent surface (`shape.ts`, chapter 09 §11.2 and §12.1):
//! controls removed, rich text flattened, long text cut — signalled row by row.

use basedb_automations::agent::records::AgentColumn;
use basedb_base::idempotency::js_stringify;
use basedb_records::js::js_trim;
use regex::Regex;
use serde_json::{Map, Value};
use std::sync::OnceLock;

/// §11.2: beyond this, a text value is cut, and the row says which fields were.
pub const TEXT_PREVIEW_CHARS: usize = 500;
/// §11.2: the size of one tool response, in characters.
pub const RESPONSE_BUDGET_CHARS: usize = 40_000;

/// `JSON.stringify(value).length`: UTF-16 units of the JavaScript serialization.
pub fn js_len(value: &Value) -> usize {
    js_stringify(value).encode_utf16().count()
}

/// `string.length`.
pub fn utf16_len(text: &str) -> usize {
    text.encode_utf16().count()
}

/// Control characters and the bidirectional overrides (§12.1); tab, line feed and carriage
/// return stay.
fn is_control(c: char) -> bool {
    matches!(c, '\u{0}'..='\u{8}' | '\u{b}' | '\u{c}' | '\u{e}'..='\u{1f}' | '\u{7f}'..='\u{9f}' | '\u{200e}' | '\u{200f}' | '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}')
}

pub fn strip_controls(text: &str) -> String {
    text.chars().filter(|c| !is_control(*c)).collect()
}

/// `sanitizeDeep`: every string of a result, controls removed — keys are ours.
pub fn sanitize_deep(value: &Value) -> Value {
    match value {
        Value::String(s) => Value::String(strip_controls(s)),
        Value::Array(items) => Value::Array(items.iter().map(sanitize_deep).collect()),
        Value::Object(map) => Value::Object(map.iter().map(|(k, v)| (k.clone(), sanitize_deep(v))).collect()),
        other => other.clone(),
    }
}

/// JavaScript's `\s`, as a character class body.
pub const JS_SPACE: &str = r"\t\n\x0B\x0C\r \x{a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}";

struct Patterns {
    scripts: Regex,
    br: Regex,
    block_ends: Regex,
    tags: Regex,
    entities: Regex,
    blank_lines: Regex,
}

fn patterns() -> &'static Patterns {
    static P: OnceLock<Patterns> = OnceLock::new();
    P.get_or_init(|| Patterns {
        // `<(script|style)[^>]*>[\s\S]*?<\/\1>`: no back-reference here, the two spelled out.
        // `/i` of JavaScript (no `u` flag) folds ASCII only: `(?i-u:…)`, never Unicode folding.
        scripts: Regex::new(r"<(?i-u:script)[^>]*>(?s:.)*?</(?i-u:script)>|<(?i-u:style)[^>]*>(?s:.)*?</(?i-u:style)>").unwrap(),
        br: Regex::new(&format!(r"<(?i-u:br)[{JS_SPACE}]*/?>")).unwrap(),
        block_ends: Regex::new(r"</(?i-u:p|div|li|h[1-6]|tr|blockquote|pre)>").unwrap(),
        tags: Regex::new(r"<[^>]*>").unwrap(),
        entities: Regex::new(r"&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);").unwrap(),
        blank_lines: Regex::new(r"\n{3,}").unwrap(),
    })
}

/// `flattenHtml`: rich text as plain text. `Err` where `String.fromCodePoint` throws (an
/// entity past U+10FFFF) — an incident in Node.
pub fn flatten_html(html: &str) -> Result<String, String> {
    let p = patterns();
    let text = p.scripts.replace_all(html, "");
    let text = p.br.replace_all(&text, "\n");
    let text = p.block_ends.replace_all(&text, "\n");
    let text = p.tags.replace_all(&text, "");
    let mut failed = None;
    let text = p.entities.replace_all(&text, |caps: &regex::Captures| {
        let (entity, name) = (&caps[0], &caps[1]);
        let code = if name.starts_with("#x") || name.starts_with("#X") {
            Some(u32::from_str_radix(&name[2..], 16).ok())
        } else {
            name.strip_prefix('#').map(|decimal| decimal.parse::<u32>().ok())
        };
        match code {
            Some(code) => match code.filter(|&c| c <= 0x10ffff) {
                // A surrogate is a code point JavaScript writes alone; a Rust string cannot hold
                // one: U+FFFD stands in.
                Some(c) => char::from_u32(c).map(String::from).unwrap_or_else(|| "\u{fffd}".into()),
                None => {
                    failed = Some(format!("Invalid code point {name}"));
                    String::new()
                }
            },
            None => match name.to_lowercase().as_str() {
                "amp" => "&".into(),
                "lt" => "<".into(),
                "gt" => ">".into(),
                "quot" => "\"".into(),
                "apos" => "'".into(),
                "nbsp" => "\u{a0}".into(),
                _ => entity.to_string(),
            },
        }
    });
    if let Some(e) = failed {
        return Err(e);
    }
    let text = p.blank_lines.replace_all(&text, "\n\n");
    Ok(js_trim(&text).to_string())
}

const TEXTUAL: [&str; 3] = ["short_text", "long_text", "formula"];

/// `shapeRow`: rich text flattened, long text cut at 500 characters — except the fields in
/// `full` —, and what was touched listed under `_truncated_fields` / `_flattened_fields`.
pub fn shape_row(row: &Map<String, Value>, columns: &[AgentColumn], full: &[String]) -> Result<Map<String, Value>, String> {
    let mut out = row.clone();
    let mut truncated = Vec::new();
    let mut flattened = Vec::new();
    for column in columns {
        let Some(Value::String(original)) = out.get(&column.name) else { continue };
        let mut value = original.clone();
        if column.rich {
            value = flatten_html(&value)?;
            flattened.push(column.name.clone());
        }
        if TEXTUAL.contains(&column.kind.as_str()) && !full.contains(&column.name) && value.chars().count() > TEXT_PREVIEW_CHARS {
            value = value.chars().take(TEXT_PREVIEW_CHARS).collect();
            truncated.push(column.name.clone());
        }
        out.insert(column.name.clone(), Value::String(value));
    }
    if !truncated.is_empty() {
        out.insert("_truncated_fields".into(), Value::from(truncated));
    }
    if !flattened.is_empty() {
        out.insert("_flattened_fields".into(), Value::from(flattened));
    }
    Ok(out)
}

/// `rowsWithinBudget`: how many WHOLE rows fit the response budget, envelope counted.
pub fn rows_within_budget(envelope: &Map<String, Value>, rows: &[Map<String, Value>], budget: usize) -> usize {
    let mut with_records = envelope.clone();
    with_records.insert("records".into(), Value::Array(Vec::new()));
    let mut used = js_len(&Value::Object(with_records));
    for (i, row) in rows.iter().enumerate() {
        used += js_len(&Value::Object(row.clone())) + 1;
        if used > budget {
            return i;
        }
    }
    rows.len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn html_flattens_like_shape_ts() {
        let html = "<p>Un&nbsp;<b>gras</b> &amp; &#x41;&#66;&unknown;</p><script>alert(1)</SCRIPT><br/>x\n\n\n\ny ";
        assert_eq!(flatten_html(html).unwrap(), "Un\u{a0}gras & AB&unknown;\n\nx\n\ny");
        assert!(flatten_html("&#x110000;").is_err());
        assert_eq!(flatten_html("&nbsp;a&NBSP;").unwrap(), "a");
    }

    #[test]
    fn rows_are_cut_and_flagged() {
        let columns = vec![
            AgentColumn { name: "t".into(), kind: "long_text".into(), rich: false },
            AgentColumn { name: "r".into(), kind: "long_text".into(), rich: true },
        ];
        let row = json!({ "_id": "x", "t": "é".repeat(501), "r": "<p>a</p>" }).as_object().unwrap().clone();
        let shaped = shape_row(&row, &columns, &[]).unwrap();
        assert_eq!(shaped["t"].as_str().unwrap().chars().count(), 500);
        assert_eq!(shaped["_truncated_fields"], json!(["t"]));
        assert_eq!(shaped["_flattened_fields"], json!(["r"]));
        assert!(shape_row(&row, &columns, &["t".into()]).unwrap().get("_truncated_fields").is_none());
        assert_eq!(strip_controls("a\u{0}b\u{202e}c\td"), "abc\td");
    }

    #[test]
    fn budget_counts_whole_rows() {
        let envelope = json!({ "a": 1 }).as_object().unwrap().clone();
        let rows = vec![json!({ "x": "y" }).as_object().unwrap().clone(); 3];
        // {"a":1,"records":[]} = 20, each row 9 + 1.
        assert_eq!(rows_within_budget(&envelope, &rows, 40), 2);
        assert_eq!(rows_within_budget(&envelope, &rows, 50), 3);
    }
}
