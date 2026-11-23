//! Les langues de basedb, tel `packages/contracts/src/locales.ts` : l'interface, ses messages,
//! les courriels. Le français est la source ; l'anglais, la langue d'un navigateur qui n'en
//! demande aucune des nôtres.

pub const LOCALES: [&str; 20] = [
    "fr", "en", "de", "es", "it", "pt-BR", "nl", "pl", "cs", "sv", "da", "nb", "fi", "ro", "hu", "tr", "uk", "ja", "zh-CN", "ko",
];

pub const SOURCE_LOCALE: &str = "fr";
pub const FALLBACK_LOCALE: &str = "en";

/// Each language by its own name — what a language picker lists.
pub const LOCALE_NAMES: [(&str, &str); 20] = [
    ("fr", "Français"),
    ("en", "English"),
    ("de", "Deutsch"),
    ("es", "Español"),
    ("it", "Italiano"),
    ("pt-BR", "Português (Brasil)"),
    ("nl", "Nederlands"),
    ("pl", "Polski"),
    ("cs", "Čeština"),
    ("sv", "Svenska"),
    ("da", "Dansk"),
    ("nb", "Norsk bokmål"),
    ("fi", "Suomi"),
    ("ro", "Română"),
    ("hu", "Magyar"),
    ("tr", "Türkçe"),
    ("uk", "Українська"),
    ("ja", "日本語"),
    ("zh-CN", "简体中文"),
    ("ko", "한국어"),
];

/// `isLocale`: exactly one of ours (case-sensitive, as in TypeScript).
pub fn is_locale(value: &str) -> bool {
    LOCALES.contains(&value)
}

/// `localeOfTag`: the exact tag first, then its language alone — `pt-PT` reads Brazilian
/// Portuguese, any Chinese simplified Chinese, Norwegian in any form bokmål.
pub fn locale_of_tag(tag: &str) -> Option<&'static str> {
    let clean = tag.trim().to_lowercase();
    if clean.is_empty() {
        return None;
    }
    if let Some(l) = LOCALES.iter().find(|l| l.to_lowercase() == clean) {
        return Some(l);
    }
    let language = clean.split(['-', '_']).next().unwrap_or("");
    match language {
        "pt" => Some("pt-BR"),
        "zh" => Some("zh-CN"),
        "no" | "nn" | "nb" => Some("nb"),
        _ => LOCALES.iter().find(|l| l.to_lowercase() == language).copied(),
    }
}

/// `matchLocale`: the first tag we speak, English otherwise.
pub fn match_locale<S: AsRef<str>>(tags: &[S]) -> &'static str {
    tags.iter().find_map(|t| locale_of_tag(t.as_ref())).unwrap_or(FALLBACK_LOCALE)
}

/// JavaScript's `Number(text)` for a q-value: `NaN` (here `None`) when not a number.
fn js_number(text: &str) -> Option<f64> {
    let t = text.trim();
    if t.is_empty() {
        return Some(0.0);
    }
    match t {
        "Infinity" | "+Infinity" => return Some(f64::INFINITY),
        "-Infinity" => return Some(f64::NEG_INFINITY),
        _ => {}
    }
    // Rust also reads `inf` and `nan`, JavaScript does not.
    if !t.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | 'e' | 'E' | '+' | '-')) {
        return None;
    }
    t.parse::<f64>().ok()
}

/// `acceptedLanguages`: the tags of an `Accept-Language` header, most wanted first.
pub fn accepted_languages(header: Option<&str>) -> Vec<String> {
    let Some(header) = header else { return Vec::new() };
    let mut entries: Vec<(String, f64, usize)> = header
        .split(',')
        .enumerate()
        .map(|(index, part)| {
            let mut pieces = part.trim().split(';');
            let tag = pieces.next().unwrap_or("").trim().to_string();
            let q = pieces.map(str::trim).find(|p| p.starts_with("q="));
            let weight = match q {
                None => 1.0,
                Some(q) => js_number(&q[2..]).filter(|w| w.is_finite()).unwrap_or(0.0),
            };
            (tag, weight, index)
        })
        .filter(|(tag, weight, _)| !tag.is_empty() && tag != "*" && *weight > 0.0)
        .collect();
    entries.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal).then(a.2.cmp(&b.2)));
    entries.into_iter().map(|e| e.0).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn twenty_locales_french_first() {
        assert_eq!(LOCALES.len(), 20);
        assert_eq!(LOCALES[0], SOURCE_LOCALE);
        for (l, (n, _)) in LOCALES.iter().zip(LOCALE_NAMES.iter()) {
            assert_eq!(l, n);
        }
        assert!(is_locale("pt-BR"));
        assert!(!is_locale("pt-br"));
        assert!(!is_locale("ar"));
    }

    #[test]
    fn tags_find_their_locale() {
        assert_eq!(locale_of_tag("de-CH"), Some("de"));
        assert_eq!(locale_of_tag("pt-PT"), Some("pt-BR"));
        assert_eq!(locale_of_tag("zh-TW"), Some("zh-CN"));
        assert_eq!(locale_of_tag("no"), Some("nb"));
        assert_eq!(locale_of_tag("nn-NO"), Some("nb"));
        assert_eq!(locale_of_tag("EN-us"), Some("en"));
        assert_eq!(locale_of_tag("zh-cn"), Some("zh-CN"));
        assert_eq!(locale_of_tag("ar"), None);
        assert_eq!(locale_of_tag("  "), None);
    }

    #[test]
    fn match_falls_back_to_english() {
        assert_eq!(match_locale(&["ar", "de-AT"]), "de");
        assert_eq!(match_locale(&["ar"]), "en");
        assert_eq!(match_locale::<&str>(&[]), "en");
    }

    #[test]
    fn accept_language_by_weight_then_order() {
        assert_eq!(accepted_languages(Some("fr-CH, fr;q=0.9, en;q=0.8, de;q=0.95, *;q=0.5")), vec!["fr-CH", "de", "fr", "en"]);
        assert_eq!(accepted_languages(Some("es;q=0, it;q=abc, nl")), vec!["nl"]);
        assert!(accepted_languages(None).is_empty());
        assert!(accepted_languages(Some("")).is_empty());
    }
}
