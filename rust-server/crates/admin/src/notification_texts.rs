//! `mail/notification-texts.ts`: what a notification mail says, in its recipient's language.
//! The texts are extracted from the TypeScript module into `notification_texts.json`; a
//! function of a count there is two templates, `…_one` for 1 and the other for the rest.

use serde_json::Value;
use std::sync::OnceLock;

fn all() -> &'static Value {
    static TEXTS: OnceLock<Value> = OnceLock::new();
    TEXTS.get_or_init(|| serde_json::from_str(include_str!("notification_texts.json")).expect("notification_texts.json"))
}

/// One pass over `template`: `{name}` replaced by its value; a value is never read again.
pub fn fill(template: &str, values: &[(&str, &str)]) -> String {
    let mut out = String::with_capacity(template.len());
    let mut rest = template;
    'scan: while let Some(open) = rest.find('{') {
        out.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        for (name, value) in values {
            if let Some(tail) = after.strip_prefix(name).and_then(|t| t.strip_prefix('}')) {
                out.push_str(value);
                rest = tail;
                continue 'scan;
            }
        }
        out.push('{');
        rest = after;
    }
    out.push_str(rest);
    out
}

/// `notificationMailTexts`: the recipient's language, French when they have none, English
/// for one the texts do not have.
pub struct Texts(&'static Value);

pub fn texts(locale: Option<&str>) -> Texts {
    let all = all();
    Texts(all.get(locale.unwrap_or("fr")).unwrap_or(&all["en"]))
}

impl Texts {
    fn text(&self, key: &str) -> &'static str {
        self.0[key].as_str().unwrap_or("")
    }
    pub fn sentence(&self, kind: &str, who: &str, label: &str) -> String {
        fill(self.0["sentence"][kind].as_str().unwrap_or(""), &[("who", who), ("label", label)])
    }
    pub fn someone(&self) -> &'static str {
        self.text("someone")
    }
    pub fn several(&self, count: usize) -> String {
        if count == 1 { self.text("several_one").to_string() } else { fill(self.text("several"), &[("count", &count.to_string())]) }
    }
    pub fn greeting(&self, name: &str) -> String {
        fill(self.text("greeting"), &[("name", name)])
    }
    pub fn open(&self) -> &'static str {
        self.text("open")
    }
    pub fn more(&self, count: usize) -> String {
        if count == 1 { self.text("more_one").to_string() } else { fill(self.text("more"), &[("count", &count.to_string())]) }
    }
    pub fn why(&self) -> &'static str {
        self.text("why")
    }
    pub fn settings(&self) -> &'static str {
        self.text("settings")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn says_it_in_the_recipients_language() {
        assert_eq!(texts(None).sentence("mention", "Anne", "Factures"), "Anne vous a mentionné dans Factures");
        assert_eq!(texts(Some("en")).several(3), "3 unread notifications in basedb");
        assert_eq!(texts(Some("fr")).more(1), "Et une autre, dans basedb.");
        assert_eq!(texts(Some("fr")).more(4), "Et 4 autres, dans basedb.");
        assert_eq!(texts(Some("xx")).greeting("Bob"), "Hello Bob,");
        assert_eq!(texts(Some("zh-CN")).greeting("李"), "李，您好，");
        for locale in basedb_contracts::locales::LOCALES {
            let t = texts(Some(locale));
            for kind in ["mention", "reply", "assigned", "automation"] {
                assert!(t.sentence(kind, "W", "L").contains('W'), "{locale} {kind}");
            }
            assert!(!t.why().is_empty() && !t.settings().is_empty() && !t.open().is_empty() && !t.someone().is_empty(), "{locale}");
        }
    }

    #[test]
    fn fills_in_one_pass() {
        assert_eq!(fill("{who} dans {label}", &[("who", "{label}"), ("label", "T")]), "{label} dans T");
        assert_eq!(fill("{x} {who", &[("who", "A")]), "{x} {who");
    }
}
