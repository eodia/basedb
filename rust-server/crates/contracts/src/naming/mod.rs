//! Le nommage physique, port de `packages/naming` (chapitre 01) : alphabets A et B, budgets en
//! octets, slug, préfixes et mots réservés, noms dérivés, citation, tenant, noms de schéma,
//! relégation. Tout est pur ; l'aléa du repli du slug passe par un paramètre pour les tests.

pub mod derived;
pub mod quote;
pub mod relegation;
pub mod reserved;
mod reserved_words_table;
pub mod schema_name;
pub mod slug;
pub mod tenant;

pub use derived::*;
pub use quote::*;
pub use relegation::*;
pub use reserved::*;
pub use schema_name::*;
pub use slug::*;
pub use tenant::*;

use regex::Regex;
use std::sync::OnceLock;

pub const MAX_IDENTIFIER_BYTES: usize = 63;

fn alphabet_a() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^[a-z][a-z0-9_]{0,62}$").unwrap())
}

fn alphabet_b() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^_?[a-z][a-z0-9_]{0,62}$").unwrap())
}

/// UTF-8 bytes — what PostgreSQL's 63 counts.
pub fn byte_length(value: &str) -> usize {
    value.len()
}

pub fn is_alphabet_a(name: &str) -> bool {
    alphabet_a().is_match(name) && name.len() <= MAX_IDENTIFIER_BYTES
}

pub fn is_alphabet_b(name: &str) -> bool {
    alphabet_b().is_match(name) && name.len() <= MAX_IDENTIFIER_BYTES
}

pub const LEADING_UNDERSCORE_ALLOWLIST: [&str; 7] = ["_basedb", "_basedb_local", "_id", "_created_at", "_updated_at", "_created_by", "_updated_by"];

pub const SYSTEM_COLUMNS: [&str; 5] = ["_id", "_created_at", "_updated_at", "_created_by", "_updated_by"];

pub const MAX_BASE_SLUG_BYTES: usize = 53;
pub const MAX_TABLE_NAME_BYTES: usize = 48;
pub const MAX_FIELD_NAME_BYTES: usize = 48;
pub const MAX_DERIVED_NAME_BYTES: usize = 63;

/// `budgetForNature`.
pub fn budget_for_nature(nature: SlugNature) -> usize {
    match nature {
        SlugNature::Base => MAX_BASE_SLUG_BYTES,
        SlugNature::Table => MAX_TABLE_NAME_BYTES,
        SlugNature::Champ => MAX_FIELD_NAME_BYTES,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn b_is_a_strict_superset_of_a() {
        for reserved in ["_id", "_basedb", "_basedb_local", "_created_at"] {
            assert!(is_alphabet_b(reserved));
            assert!(!is_alphabet_a(reserved));
        }
        let too_long = format!("a{}", "b".repeat(63));
        assert!(!is_alphabet_a(&too_long));
        assert!(!is_alphabet_b(&too_long));
        assert!(!is_alphabet_b(&format!("_{}", "b".repeat(63))));
    }

    #[test]
    fn a_63_byte_schema_name_is_emittable() {
        let slug = "liste_des_contrats_de_prevoyance_collective_souscrits";
        let schema = compose_schema_name("t4z56fq", slug);
        assert_eq!(byte_length(slug), 53);
        assert_eq!(byte_length(&schema), 63);
        assert!(is_alphabet_a(slug));
        assert!(is_alphabet_b(&schema));
        assert!(quote_identifier(&schema).is_ok());
    }
}
