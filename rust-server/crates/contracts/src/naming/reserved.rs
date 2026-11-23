//! `reserved.ts` — préfixes réservés (échappés par `x_`) et mots réservés de PostgreSQL (qui
//! passent par la boucle des suffixes).

use super::reserved_words_table::RESERVED_WORDS;
use super::slug::truncate_hard;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NameScope {
    Base,
    Table,
    Field,
}

fn reserved_prefixes(scope: NameScope) -> &'static [&'static str] {
    match scope {
        NameScope::Base => &["zz_"],
        NameScope::Table | NameScope::Field => &["pg_", "zz_", "_"],
    }
}

pub const ESCAPE_PREFIX: &str = "x_";

/// Every reserved word with its category (`R`, `T`, `C`).
pub fn reserved_words() -> &'static [(&'static str, char)] {
    RESERVED_WORDS
}

pub fn is_reserved_word(candidate: &str) -> bool {
    RESERVED_WORDS.iter().any(|(w, _)| *w == candidate)
}

pub fn escape_reserved_prefix(candidate: &str, scope: NameScope, max: usize) -> String {
    if !has_reserved_prefix(candidate, scope) {
        return candidate.to_string();
    }
    truncate_hard(&format!("{ESCAPE_PREFIX}{candidate}"), max)
}

pub fn has_reserved_prefix(candidate: &str, scope: NameScope) -> bool {
    reserved_prefixes(scope).iter().any(|p| candidate.starts_with(p))
}

pub fn is_reserved_for_scope(candidate: &str, scope: NameScope) -> bool {
    scope != NameScope::Base && is_reserved_word(candidate)
}

/// `applyNameRestrictions`: `(candidate, needsSuffixLoop)`.
pub fn apply_name_restrictions(candidate: &str, scope: NameScope, max: usize) -> (String, bool) {
    let escaped = escape_reserved_prefix(candidate, scope, max);
    let needs = is_reserved_for_scope(&escaped, scope);
    (escaped, needs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reserved_words_and_prefixes() {
        assert_eq!(reserved_words().len(), 156);
        assert!(is_reserved_word("select") && is_reserved_word("time"));
        assert!(!is_reserved_word("clients"));
        assert_eq!(apply_name_restrictions("zz_x", NameScope::Base, 53), ("x_zz_x".into(), false));
        assert_eq!(apply_name_restrictions("pg_x", NameScope::Base, 53), ("pg_x".into(), false));
        assert_eq!(apply_name_restrictions("user", NameScope::Field, 48), ("user".into(), true));
    }
}
