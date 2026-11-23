//! `auth/mail-texts.ts`: the account mails in the twenty languages. The texts are Node's own,
//! extracted once to `mail_texts.json` (placeholders `{email}`, `{link}`, `{code}`).

use basedb_contracts::{accepted_languages, is_locale, match_locale};
use serde_json::Value;
use std::sync::OnceLock;

fn table() -> &'static Value {
    static T: OnceLock<Value> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str(include_str!("mail_texts.json")).expect("mail_texts.json"))
}

/// `mailLocale`: the account's language, else the request's, else English.
pub fn mail_locale(chosen: Option<&str>, accept_language: Option<&str>) -> String {
    match chosen {
        Some(c) if is_locale(c) => c.to_string(),
        _ => match_locale(&accepted_languages(accept_language)).to_string(),
    }
}

fn text(locale: &str, key: &str) -> String {
    let t = table();
    t.get(locale).or_else(|| t.get("en")).and_then(|l| l.get(key)).and_then(Value::as_str).unwrap_or_default().to_string()
}

pub fn reset_subject(locale: &str) -> String {
    text(locale, "resetSubject")
}
pub fn email_changed_subject(locale: &str) -> String {
    text(locale, "emailChangedSubject")
}
pub fn email_changed(locale: &str, email: &str) -> String {
    text(locale, "emailChanged").replace("{email}", email)
}
pub fn reset_with_link(locale: &str, link: &str) -> String {
    text(locale, "withLink").replace("{link}", link)
}
pub fn reset_with_code(locale: &str, code: &str) -> String {
    text(locale, "withCode").replace("{code}", code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_language_is_there() {
        for l in ["fr", "en", "de", "es", "it", "pt-BR", "nl", "pl", "cs", "sv", "da", "nb", "fi", "ro", "hu", "tr", "uk", "ja", "zh-CN", "ko"] {
            assert!(!reset_subject(l).is_empty(), "{l}");
            assert!(reset_with_link(l, "https://x/?r=1").contains("https://x/?r=1"), "{l}");
            assert!(reset_with_code(l, "CODE42").contains("CODE42"), "{l}");
            assert!(email_changed(l, "a@b.c").contains("a@b.c"), "{l}");
        }
    }

    #[test]
    fn language_choice() {
        assert_eq!(mail_locale(Some("de"), Some("fr")), "de");
        assert_eq!(mail_locale(None, Some("fr-FR,fr;q=0.9")), "fr");
        assert_eq!(mail_locale(Some("xx"), None), "en");
    }
}
