//! `?expand=` — `records/expand.ts`, chapter 08 §5.1.

use basedb_base::error::AppError;
use indexmap::IndexMap;
use regex::Regex;
use serde_json::json;
use std::sync::LazyLock;

use crate::js::js_trim;

pub const FIELDS: usize = 5;
pub const TARGETS: usize = 8;
pub const LIMIT: usize = 100;
pub const IDS_PER_TARGET: usize = 500;

/// Link column → projection (`None`: every readable field).
pub type ExpandRequest = IndexMap<String, Option<Vec<String>>>;

static ENTRY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^([_a-zA-Z][a-zA-Z0-9_]*)(?:\(([^)]*)\))?$").unwrap());

/// `parseExpand`.
pub fn parse_expand(expression: Option<&str>) -> Result<ExpandRequest, AppError> {
    let mut request = ExpandRequest::new();
    let Some(expression) = expression.filter(|e| !js_trim(e).is_empty()) else { return Ok(request) };
    let mut entries = Vec::new();
    let mut depth = 0i64;
    let mut current = String::new();
    for c in expression.chars() {
        if c == '(' {
            depth += 1;
        }
        if c == ')' {
            depth -= 1;
        }
        if c == ',' && depth == 0 {
            entries.push(std::mem::take(&mut current));
            continue;
        }
        current.push(c);
    }
    entries.push(current);
    for raw in entries {
        let entry = js_trim(&raw);
        if entry.is_empty() {
            continue;
        }
        let Some(m) = ENTRY.captures(entry) else {
            if entry.contains('.') {
                return Err(AppError::new("EXPAND_TOO_DEEP").with("path", json!(entry)));
            }
            return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("expand")).with("detail", json!(entry)));
        };
        let column = m.get(1).map(|c| c.as_str().to_string()).unwrap_or_default();
        let fields = m.get(2).map(|p| p.as_str().split(',').map(|f| js_trim(f).to_string()).filter(|f| !f.is_empty()).collect());
        request.insert(column, fields);
        if request.len() > FIELDS {
            return Err(AppError::new("EXPAND_TOO_WIDE").with("bound", json!("expanded fields")).with("maximum", json!(FIELDS)).with("links", json!("id")));
        }
    }
    Ok(request)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entries_split_outside_parentheses() {
        let r = parse_expand(Some("a(x, y),b,a()")).unwrap();
        assert_eq!(r.keys().collect::<Vec<_>>(), ["a", "b"]);
        assert_eq!(r["a"], Some(vec![]));
        assert_eq!(r["b"], None);
        assert_eq!(parse_expand(Some("a.b")).err().unwrap().code, "EXPAND_TOO_DEEP");
        assert_eq!(parse_expand(Some("a-b")).err().unwrap().code, "REQUEST_INVALID");
        assert_eq!(parse_expand(Some("a,b,c,d,e,f")).err().unwrap().code, "EXPAND_TOO_WIDE");
    }
}
