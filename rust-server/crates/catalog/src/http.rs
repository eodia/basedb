//! What every write route of the catalog shares: reading a body the way Hono does
//! (`c.req.json()`), the look of a body (`lookOf` of `app.ts`, `catalog/look.ts`), and the
//! small JavaScript string rules the catalog checks names with.

use crate::description::js_trim;
use crate::formula::js_space;
use basedb_base::error::AppError;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

/// `c.req.json()` without a catch: malformed or empty → 500 (`SyntaxError`).
pub fn strict_json(bytes: &[u8]) -> Result<Value, AppError> {
    serde_json::from_slice::<Value>(bytes).map_err(|e| AppError::internal(format!("corps JSON invalide : {e}")))
}

/// The body, at the moment Node reads its first field: `null.x` is a `TypeError` (500).
pub fn fields(body: &Value) -> Result<&Value, AppError> {
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null"));
    }
    Ok(body)
}

/// `body.key`, `undefined` when absent. Reading a field of a primitive answers `undefined`.
pub fn field<'a>(body: &'a Value, key: &str) -> Option<&'a Value> {
    body.get(key)
}

/// `typeof body.key === 'string' ? body.key : undefined`.
pub fn text<'a>(body: &'a Value, key: &str) -> Option<&'a str> {
    body.get(key).and_then(Value::as_str)
}

/// `String.length`: UTF-16 code units.
pub fn js_len(s: &str) -> usize {
    s.encode_utf16().count()
}

pub fn nfc(s: &str) -> String {
    s.nfc().collect()
}

/// `labelKey`: NFC, lower case, white space collapsed, trimmed.
pub fn label_key(label: &str) -> String {
    let lower = nfc(label).to_lowercase();
    collapse_spaces(&lower)
}

/// `.replace(/\s+/g, ' ').trim()`.
pub fn collapse_spaces(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_space = false;
    for c in s.chars() {
        if js_space(c) {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(c);
            in_space = false;
        }
    }
    js_trim(&out).to_string()
}

// ------------------------------------------------------------------------------------
// The look

/// `Look`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Look {
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
}

impl Look {
    pub fn insert_into(&self, out: &mut Map<String, Value>) {
        out.insert("color".into(), json!(self.color));
        out.insert("icon".into(), json!(self.icon));
        out.insert("image".into(), json!(self.image));
    }
}

/// `LookInput`: per key, absent (`None`), `null` (`Some(None)`) or a text.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct LookInput {
    pub color: Option<Option<String>>,
    pub icon: Option<Option<String>>,
    pub image: Option<Option<String>>,
}

impl LookInput {
    /// `touchesLook`.
    pub fn touches(&self) -> bool {
        self.color.is_some() || self.icon.is_some() || self.image.is_some()
    }
}

/// The longest picture, as the URL that carries it.
pub const MAX_IMAGE_CHARS: usize = 16_384;

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).unwrap())
}

fn present(raw: &Option<Option<String>>) -> Option<String> {
    let text = match raw {
        Some(Some(s)) => js_trim(s),
        _ => "",
    };
    (!text.is_empty()).then(|| text.to_string())
}

/// `normalizeLook`: `fail` builds the refusal from the reason.
pub fn normalize_look(raw: &LookInput, fail: impl Fn(&str) -> AppError) -> Result<Look, AppError> {
    static ICON: OnceLock<Regex> = OnceLock::new();
    static DATA_IMAGE: OnceLock<Regex> = OnceLock::new();
    static COLOR: OnceLock<Regex> = OnceLock::new();
    let icon = present(&raw.icon);
    if let Some(i) = &icon {
        if !re(&ICON, r"^[a-z0-9]+(-[a-z0-9]+)*$").is_match(i) || js_len(i) > 64 {
            return Err(fail("icone_invalide"));
        }
    }
    let image = present(&raw.image);
    if let Some(i) = &image {
        let data = re(&DATA_IMAGE, r"(?i)^data:image/(png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$").is_match(i);
        let https = i.get(..8).is_some_and(|h| h.eq_ignore_ascii_case("https://")) && i.len() > 8 && !i[8..].chars().any(js_space);
        if !data && !https {
            return Err(fail("image_invalide"));
        }
        if js_len(i) > MAX_IMAGE_CHARS {
            return Err(fail("image_trop_grande"));
        }
    }
    if icon.is_some() && image.is_some() {
        return Err(fail("icone_et_image"));
    }
    let color = match present(&raw.color) {
        None => None,
        Some(text) => {
            if !re(&COLOR, r"(?i)^#([0-9a-f]{3}|[0-9a-f]{6})$").is_match(&text) {
                return Err(fail("couleur_invalide"));
            }
            let hex = text[1..].to_lowercase();
            Some(if hex.len() == 3 { format!("#{}", hex.chars().flat_map(|c| [c, c]).collect::<String>()) } else { format!("#{hex}") })
        }
    };
    Ok(Look { color, icon, image })
}

/// `lookOf` of `app.ts`: the three keys of a body, `None` when none is given; a value
/// neither text nor `null` is `REQUEST_INVALID {field}`.
pub fn look_of_body(body: &Value) -> Result<Option<LookInput>, AppError> {
    let keys = ["color", "icon", "image"];
    if keys.iter().all(|k| body.get(*k).is_none()) {
        return Ok(None);
    }
    let mut out = LookInput::default();
    for key in keys {
        let v = match body.get(key) {
            None => continue,
            Some(Value::Null) => Some(None),
            Some(Value::String(s)) => Some(Some(s.clone())),
            Some(_) => return Err(AppError::new("REQUEST_INVALID").with("field", json!(key))),
        };
        match key {
            "color" => out.color = v,
            "icon" => out.icon = v,
            _ => out.image = v,
        }
    }
    Ok(Some(out))
}

/// The `lookOf` of the catalog services: `None` when the request says nothing of it, the
/// refusal named `{field: 'look', reason}`.
pub fn checked_look(raw: Option<&LookInput>) -> Result<Option<Look>, AppError> {
    match raw {
        Some(raw) if raw.touches() => normalize_look(raw, |reason| AppError::new("REQUEST_INVALID").with("field", json!("look")).with("reason", json!(reason))).map(Some),
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn look(color: Option<&str>, icon: Option<&str>, image: Option<&str>) -> Result<Look, String> {
        let raw = LookInput {
            color: color.map(|c| Some(c.to_string())),
            icon: icon.map(|c| Some(c.to_string())),
            image: image.map(|c| Some(c.to_string())),
        };
        normalize_look(&raw, |r| AppError::new("REQUEST_INVALID").with("reason", json!(r))).map_err(|e| e.details["reason"].as_str().unwrap().to_string())
    }

    #[test]
    fn normalizes_a_look() {
        assert_eq!(look(Some("#ABC"), None, None).unwrap().color.as_deref(), Some("#aabbcc"));
        assert_eq!(look(Some(" #A0b1C2 "), None, None).unwrap().color.as_deref(), Some("#a0b1c2"));
        assert_eq!(look(Some("  "), Some(""), None).unwrap(), Look::default());
        assert_eq!(look(Some("red"), None, None).unwrap_err(), "couleur_invalide");
        assert_eq!(look(None, Some("star-half"), None).unwrap().icon.as_deref(), Some("star-half"));
        assert_eq!(look(None, Some("Star"), None).unwrap_err(), "icone_invalide");
        assert_eq!(look(None, Some(&"a".repeat(65)), None).unwrap_err(), "icone_invalide");
        assert_eq!(look(None, None, Some("http://x")).unwrap_err(), "image_invalide");
        assert_eq!(look(None, None, Some("https://a b")).unwrap_err(), "image_invalide");
        assert!(look(None, None, Some("HTTPS://x.fr/a.png")).is_ok());
        assert!(look(None, None, Some("data:image/PNG;base64,QUJD==")).is_ok());
        assert_eq!(look(None, None, Some(&format!("https://{}", "a".repeat(16_400)))).unwrap_err(), "image_trop_grande");
        assert_eq!(look(None, Some("star"), Some("https://x")).unwrap_err(), "icone_et_image");
    }

    #[test]
    fn reads_the_look_of_a_body() {
        assert_eq!(look_of_body(&json!({"label": "x"})).unwrap(), None);
        let l = look_of_body(&json!({"color": null, "icon": "a"})).unwrap().unwrap();
        assert_eq!(l.color, Some(None));
        assert_eq!(l.icon, Some(Some("a".into())));
        assert_eq!(l.image, None);
        assert_eq!(look_of_body(&json!({"image": 3})).unwrap_err().details["field"], json!("image"));
    }

    #[test]
    fn keys_labels() {
        assert_eq!(label_key("  Mes\t\nRelances  "), "mes relances");
        assert_eq!(label_key("E\u{301}tat"), "état");
    }
}
