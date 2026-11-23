//! `slug.ts` — un libellé devient un nom physique (chapitre 01 §3), en dix étapes.

use super::tenant::random_alphabet_chars;
use regex::Regex;
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

pub const SLUG_VERSION: u32 = 1;

pub const TRANSLITERATION: [(char, &str); 14] = [
    ('ß', "ss"),
    ('æ', "ae"),
    ('œ', "oe"),
    ('ø', "o"),
    ('þ', "th"),
    ('ŋ', "ng"),
    ('ƀ', "b"),
    ('ı', "i"),
    ('ł', "l"),
    ('đ', "d"),
    ('ð', "d"),
    ('ħ', "h"),
    ('ə', "e"),
    ('ĸ', "k"),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlugNature {
    Base,
    Table,
    Champ,
}

impl SlugNature {
    pub fn as_str(self) -> &'static str {
        match self {
            SlugNature::Base => "base",
            SlugNature::Table => "table",
            SlugNature::Champ => "champ",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SlugResult {
    pub slug: String,
    pub fallback_applied: bool,
}

fn marks_and_invisibles() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"\p{Mn}|\p{Me}|\p{Cc}|\p{Cf}").unwrap())
}

fn marks_only() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"\p{Mn}|\p{Me}|\p{Cf}").unwrap())
}

/// `truncateHard`: at most `max` (the input is ASCII once slugified), no trailing `_`.
pub fn truncate_hard(value: &str, max: usize) -> String {
    let cut: String = if value.len() <= max {
        value.to_string()
    } else {
        // JavaScript's `slice` counts UTF-16 units; on ASCII, bytes.
        let mut units = 0;
        value
            .chars()
            .take_while(|c| {
                units += c.len_utf16();
                units <= max
            })
            .collect()
    };
    cut.trim_end_matches('_').to_string()
}

/// `slugify` with the fallback drawing from the tenant alphabet.
pub fn slugify(label: &str, max: usize, nature: SlugNature) -> SlugResult {
    slugify_with(label, max, nature, random_alphabet_chars)
}

/// `slugify`, the fallback's randomness supplied (`randomChars`).
pub fn slugify_with(label: &str, max: usize, nature: SlugNature, random_chars: impl Fn(usize) -> String) -> SlugResult {
    let s: String = label.nfkd().collect();
    let s = marks_and_invisibles().replace_all(&s, "");
    let s = s.to_lowercase();
    let s = marks_only().replace_all(&s, "");
    let mut t = String::with_capacity(s.len());
    for c in s.chars() {
        match TRANSLITERATION.iter().find(|(k, _)| *k == c) {
            Some((_, v)) => t.push_str(v),
            None => t.push(c),
        }
    }
    let replaced: String = t.chars().map(|c| if c.is_ascii_lowercase() || c.is_ascii_digit() { c } else { '_' }).collect();
    let mut collapsed = String::with_capacity(replaced.len());
    for c in replaced.chars() {
        if c == '_' && collapsed.ends_with('_') {
            continue;
        }
        collapsed.push(c);
    }
    let mut s = collapsed.trim_matches('_').to_string();
    if s.is_empty() {
        return SlugResult { slug: format!("{}_{}", nature.as_str(), random_chars(6)), fallback_applied: true };
    }
    if s.starts_with(|c: char| c.is_ascii_digit()) {
        s = format!("n_{s}");
    }
    SlugResult { slug: truncate_hard(&s, max), fallback_applied: false }
}

#[cfg(test)]
mod tests {
    use super::super::*;
    use super::*;

    fn fixed(chars: &'static str) -> impl Fn(usize) -> String {
        move |n| chars[..n].to_string()
    }

    fn as_table(label: &str) -> SlugResult {
        slugify_with(label, MAX_TABLE_NAME_BYTES, SlugNature::Table, fixed("k3f9x2"))
    }

    #[test]
    fn end_to_end_examples_of_chapter_01() {
        let cases = [
            ("Clients", "clients"),
            ("Résumé", "resume"),
            ("Resume", "resume"),
            ("Straße", "strasse"),
            ("ﬁche produit", "fiche_produit"),
            ("İstanbul", "istanbul"),
            ("Chiffre d’affaires (€)", "chiffre_d_affaires"),
            ("🚀 Lancement 2026", "lancement_2026"),
            ("2024 ventes", "n_2024_ventes"),
            ("½ journée", "n_1_2_journee"),
            ("Mon.Site.com", "mon_site_com"),
            ("_id", "id"),
            (
                "Liste des contrats de prévoyance collective souscrits par les entreprises de plus de cinquante salariés en 2024",
                "liste_des_contrats_de_prevoyance_collective_sous",
            ),
        ];
        for (label, expected) in cases {
            assert_eq!(as_table(label).slug, expected, "{label}");
        }
    }

    #[test]
    fn reserved_prefixes_are_escaped() {
        let slug = as_table("zz_archive").slug;
        assert_eq!(apply_name_restrictions(&slug, NameScope::Table, MAX_TABLE_NAME_BYTES).0, "x_zz_archive");
        let slug = as_table("PG monitoring").slug;
        assert_eq!(apply_name_restrictions(&slug, NameScope::Table, MAX_TABLE_NAME_BYTES).0, "x_pg_monitoring");
    }

    #[test]
    fn fallback_when_nothing_is_kept() {
        let r = as_table("Клиенты");
        assert!(r.fallback_applied);
        assert_eq!(r.slug, "table_k3f9x2");
        let r = slugify_with("...", MAX_TABLE_NAME_BYTES, SlugNature::Table, fixed("m7d2qs"));
        assert_eq!((r.slug.as_str(), r.fallback_applied), ("table_m7d2qs", true));
        let r = slugify("...", MAX_BASE_SLUG_BYTES, SlugNature::Base);
        assert!(r.fallback_applied && r.slug.starts_with("base_") && is_alphabet_a(&r.slug));
    }

    #[test]
    fn reserved_words_go_through_the_suffix_loop() {
        assert!(is_reserved_for_scope(&as_table("select").slug, NameScope::Table));
        assert!(is_reserved_for_scope(&as_table("Time").slug, NameScope::Table));
        assert!(!is_reserved_for_scope("select", NameScope::Base));
    }

    #[test]
    fn locale_independent_lowercasing() {
        assert_eq!(as_table("Istanbul").slug, "istanbul");
        assert_eq!(as_table("İstanbul").slug, "istanbul");
        assert_eq!(as_table("IIII").slug, "iiii");
        assert_eq!(as_table("ıstanbul").slug, "istanbul");
    }

    #[test]
    fn invisibles_are_removed_never_replaced() {
        for c in ['\u{00AD}', '\u{200B}', '\u{200C}', '\u{200D}', '\u{200E}', '\u{FE00}', '\u{FE0F}'] {
            assert_eq!(as_table(&format!("cli{c}ents")).slug, "clients", "U+{:04X}", c as u32);
        }
    }

    #[test]
    fn properties_over_many_strings() {
        // A deterministic sweep standing in for fast-check: every code point class mixed.
        let samples = ["", "a", "É", "ß", "_", "-", " ", "9", "Ω", "ﬁ", "\u{301}", "日", "🚀", "ı", "Ǆ", "ǅ", "ⅷ", "²", "x"];
        let mut seed: u64 = 42;
        for _ in 0..3000 {
            let mut label = String::new();
            for _ in 0..(seed % 70 + 1) {
                seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                label.push_str(samples[(seed >> 33) as usize % samples.len()]);
            }
            for nature in [SlugNature::Base, SlugNature::Table, SlugNature::Champ] {
                let max = budget_for_nature(nature);
                let once = slugify_with(&label, max, nature, fixed("aaaaaa"));
                assert!(is_alphabet_a(&once.slug), "{label:?} → {}", once.slug);
                assert!(once.slug.len() <= max);
                assert!(!once.slug.starts_with('_') && !once.slug.ends_with('_') && !once.slug.contains("__"));
                if !once.fallback_applied {
                    assert_eq!(slugify_with(&once.slug, max, nature, fixed("aaaaaa")).slug, once.slug);
                    let nfc: String = unicode_normalization::UnicodeNormalization::nfc(label.as_str()).collect();
                    let nfd: String = unicode_normalization::UnicodeNormalization::nfd(label.as_str()).collect();
                    assert_eq!(slugify_with(&nfc, max, nature, fixed("aaaaaa")), slugify_with(&nfd, max, nature, fixed("aaaaaa")));
                }
            }
        }
    }
}
