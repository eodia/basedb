//! Descriptions of catalog objects (`catalog/description.ts`).

use basedb_base::error::AppError;
use serde_json::{json, Value};
use unicode_normalization::UnicodeNormalization;

/// Characters, not bytes — also what `COMMENT ON` accepts.
pub const DESCRIPTION_MAX_CHARS: usize = 1000;

/// `normalizeDescription`: what a caller sent, as the catalog stores it.
pub fn normalize_description(value: Option<&Value>, field: &str) -> Result<Option<String>, AppError> {
    let value = match value {
        None | Some(Value::Null) => return Ok(None),
        Some(Value::String(s)) => s,
        Some(_) => return Err(AppError::new("REQUEST_INVALID").with("field", json!(field))),
    };
    if value.contains('\0') {
        return Err(AppError::new("VALUE_INVALID").with("field", json!(field)));
    }
    let text: String = value.replace("\r\n", "\n").replace('\r', "\n").nfc().collect();
    let text = js_trim(&text);
    if text.is_empty() {
        return Ok(None);
    }
    if text.chars().count() > DESCRIPTION_MAX_CHARS {
        return Err(AppError::new("TEXT_TOO_LONG").with("field", json!(field)).with("maximum", json!(DESCRIPTION_MAX_CHARS)));
    }
    Ok(Some(text.to_string()))
}

/// `String.prototype.trim`: JS white space and line terminators.
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(crate::formula::js_space)
}

/// The description of the five system columns, which carry no catalog row.
pub fn system_column_description(name: &str) -> Option<&'static str> {
    Some(match name {
        "_id" => "Identifiant unique de la ligne (UUID v7), attribué par le serveur à l’insertion. C’est la valeur à fournir dans un champ lien pour désigner cette ligne.",
        "_created_at" => "Date et heure UTC de création de la ligne.",
        "_updated_at" => "Date et heure UTC de la dernière modification de la ligne.",
        "_created_by" => "Identifiant de l’utilisateur qui a créé la ligne.",
        "_updated_by" => "Identifiant de l’utilisateur qui a modifié la ligne en dernier.",
        _ => return None,
    })
}

/// `commentText`: the description, the label otherwise.
pub fn comment_text<'a>(label: &'a str, description: Option<&'a str>) -> &'a str {
    description.unwrap_or(label)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn n(v: Value) -> Result<Option<String>, AppError> {
        normalize_description(Some(&v), "description")
    }

    #[test]
    fn normalizes_and_refuses() {
        assert_eq!(normalize_description(None, "description").unwrap(), None);
        assert_eq!(n(Value::Null).unwrap(), None);
        assert_eq!(n(json!("   ")).unwrap(), None);
        assert_eq!(n(json!("  a\r\nb\rc  ")).unwrap(), Some("a\nb\nc".into()));
        assert_eq!(n(json!("e\u{301}")).unwrap(), Some("é".into()));
        assert_eq!(n(json!(12)).unwrap_err().code, "REQUEST_INVALID");
        assert_eq!(n(json!("a\0b")).unwrap_err().code, "VALUE_INVALID");
        let long = "é".repeat(1000);
        assert_eq!(n(json!(long)).unwrap(), Some(long.clone()));
        let e = n(json!(format!("{long}x"))).unwrap_err();
        assert_eq!(e.code, "TEXT_TOO_LONG");
        assert_eq!(e.details["maximum"], json!(1000));
        assert_eq!(normalize_description(Some(&json!(1)), "table_description").unwrap_err().details["field"], json!("table_description"));
    }

    #[test]
    fn comment_falls_back_to_the_label() {
        assert_eq!(comment_text("Clients", None), "Clients");
        assert_eq!(comment_text("Clients", Some("Ceux qui paient")), "Ceux qui paient");
        assert!(system_column_description("_id").unwrap().contains("UUID v7"));
        assert_eq!(system_column_description("nom"), None);
    }
}
