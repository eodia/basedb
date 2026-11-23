//! `tenant.ts` — l'identifiant de tenant : `t` + six caractères d'un alphabet sans 0, o, 1, l.

use regex::Regex;
use std::sync::OnceLock;

pub const TENANT_ALPHABET: &str = "23456789abcdefghijkmnpqrstuvwxyz";
pub const TENANT_ID_LENGTH: usize = 7;
pub const TENANT_ID_MAX_ATTEMPTS: usize = 10;

pub const TENANT_ID_DENYLIST: [&str; 12] = [
    "tsystem", "ttenant", "tadmins", "tmaster", "tbasedb", "tserver", "tsecret", "tsupers", "tstatus", "tmerdes", "tputain", "tbatard",
];

fn pattern() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^t[23456789abcdefghijkmnpqrstuvwxyz]{6}$").unwrap())
}

/// `randomAlphabetChars`: `count` characters drawn uniformly (32 symbols, 5 bits per byte).
pub fn random_alphabet_chars(count: usize) -> String {
    let mut bytes = vec![0u8; count];
    getrandom::getrandom(&mut bytes).expect("aléa du système");
    let alphabet = TENANT_ALPHABET.as_bytes();
    bytes.iter().map(|b| alphabet[(b & 0b11111) as usize] as char).collect()
}

pub fn is_tenant_id(value: &str) -> bool {
    pattern().is_match(value)
}

pub fn propose_tenant_id(random_chars: impl Fn(usize) -> String) -> String {
    format!("t{}", random_chars(6))
}

/// `proposeAllowedTenantId`: `None` when ten draws all hit the deny list (`TENANT_ID_EXHAUSTED`).
pub fn propose_allowed_tenant_id(random_chars: impl Fn(usize) -> String) -> Option<String> {
    (0..TENANT_ID_MAX_ATTEMPTS).map(|_| propose_tenant_id(&random_chars)).find(|c| !TENANT_ID_DENYLIST.contains(&c.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alphabet_of_32_without_ambiguous_characters() {
        assert_eq!(TENANT_ALPHABET.len(), 32);
        let set: std::collections::HashSet<char> = TENANT_ALPHABET.chars().collect();
        assert_eq!(set.len(), 32);
        for excluded in ['0', 'o', '1', 'l'] {
            assert!(!TENANT_ALPHABET.contains(excluded));
        }
    }

    #[test]
    fn denylist_entries_are_producible() {
        for e in TENANT_ID_DENYLIST {
            assert!(is_tenant_id(e), "{e}");
        }
    }

    #[test]
    fn recognizes_the_shape() {
        assert!(is_tenant_id("t4z56fq"));
        assert!(is_tenant_id("t9k2mnp"));
        for bad in ["t4z56f", "x4z56fq", "t4z56fo", "t4z56f1"] {
            assert!(!is_tenant_id(bad), "{bad}");
        }
        assert!(is_tenant_id(&propose_tenant_id(random_alphabet_chars)));
        assert_eq!(propose_allowed_tenant_id(|_| "system".into()), None);
    }
}
