//! `@basedb/naming` — chapter 01: slugification, the two alphabets, quoting, reserved
//! words and prefixes, schema names, relegation and derived names. PURE: whatever touches
//! the database (the registry, the suffix loop) lives in [`crate::allocation`].

use basedb_base::error::AppError;
use chrono::{DateTime, Datelike, Utc};
use regex::Regex;
use serde_json::json;
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

// ------------------------------------------------------------------------------------
// The alphabets (§2.3)

/// PostgreSQL's `NAMEDATALEN` limit, in bytes.
pub const MAX_IDENTIFIER_BYTES: usize = 63;

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).unwrap())
}

/// `byteLength`: UTF-8 bytes.
pub fn byte_length(value: &str) -> usize {
    value.len()
}

/// Alphabet A — allocated names.
pub fn is_alphabet_a(name: &str) -> bool {
    static A: OnceLock<Regex> = OnceLock::new();
    re(&A, r"^[a-z][a-z0-9_]{0,62}$").is_match(name) && name.len() <= MAX_IDENTIFIER_BYTES
}

/// Alphabet B — emitted names: A, plus a leading `_`.
pub fn is_alphabet_b(name: &str) -> bool {
    static B: OnceLock<Regex> = OnceLock::new();
    re(&B, r"^_?[a-z][a-z0-9_]{0,62}$").is_match(name) && name.len() <= MAX_IDENTIFIER_BYTES
}

// ------------------------------------------------------------------------------------
// Budgets (§3.4)

pub const MAX_BASE_SLUG_BYTES: usize = 53;
pub const MAX_TABLE_NAME_BYTES: usize = 48;
pub const MAX_FIELD_NAME_BYTES: usize = 48;
pub const MAX_DERIVED_NAME_BYTES: usize = 63;

/// `SlugNature`: `champ` is normative data — it lands in a physical name.
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

/// `budgetForNature`.
pub fn budget_for_nature(nature: SlugNature) -> usize {
    match nature {
        SlugNature::Base => MAX_BASE_SLUG_BYTES,
        SlugNature::Table => MAX_TABLE_NAME_BYTES,
        SlugNature::Champ => MAX_FIELD_NAME_BYTES,
    }
}

// ------------------------------------------------------------------------------------
// Quoting (§10)

/// `quoteIdentifier`: systematic quoting, after re-validating alphabet B. Outside B, no
/// SQL is emitted: `IdentifierInvalidError`, which Node answers as a 500.
pub fn quote_identifier(identifier: &str) -> Result<String, AppError> {
    if !is_alphabet_b(identifier) {
        return Err(AppError::internal(format!("IDENTIFIER_INVALID: {}", json!(identifier))));
    }
    Ok(format!("\"{}\"", identifier.replace('"', "\"\"")))
}

/// `qualify`: `"schema"."object"`.
pub fn qualify(schema: &str, object: &str) -> Result<String, AppError> {
    Ok(format!("{}.{}", quote_identifier(schema)?, quote_identifier(object)?))
}

/// `qualifyColumn`: `"schema"."table"."column"`.
pub fn qualify_column(schema: &str, table: &str, column: &str) -> Result<String, AppError> {
    Ok(format!("{}.{}", qualify(schema, table)?, quote_identifier(column)?))
}

/// `quoteLiteral` (`ddl/emit.ts`).
pub fn quote_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

// ------------------------------------------------------------------------------------
// Slugification (§3)

/// `SLUG_VERSION`.
pub const SLUG_VERSION: i32 = 1;

fn transliteration(c: char) -> Option<&'static str> {
    Some(match c {
        'ß' => "ss",
        'æ' => "ae",
        'œ' => "oe",
        'ø' => "o",
        'þ' => "th",
        'ŋ' => "ng",
        'ƀ' => "b",
        'ı' => "i",
        'ł' => "l",
        'đ' => "d",
        'ð' => "d",
        'ħ' => "h",
        'ə' => "e",
        'ĸ' => "k",
        _ => return None,
    })
}

/// `truncateHard`: at most `max` bytes, then no trailing `_`. The input is ASCII.
pub fn truncate_hard(value: &str, max: usize) -> String {
    let cut: String = if value.len() <= max { value.to_string() } else { js_slice(value, max) };
    cut.trim_end_matches('_').to_string()
}


/// `SlugResult`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SlugResult {
    pub slug: String,
    pub fallback_applied: bool,
}

/// `slugify`, with the system's cryptographic draw for the fallback.
pub fn slugify(label: &str, max: usize, nature: SlugNature) -> SlugResult {
    slugify_with(label, max, nature, random_alphabet_chars)
}

/// `slugify` with an injected draw — the ten steps of §3.2, in this order.
pub fn slugify_with(label: &str, max: usize, nature: SlugNature, random: impl FnOnce(usize) -> String) -> SlugResult {
    static MARKS_AND_INVISIBLES: OnceLock<Regex> = OnceLock::new();
    static MARKS_ONLY: OnceLock<Regex> = OnceLock::new();
    static NOT_ALNUM: OnceLock<Regex> = OnceLock::new();
    static RUNS: OnceLock<Regex> = OnceLock::new();
    let s: String = label.nfkd().collect();
    let s = re(&MARKS_AND_INVISIBLES, r"\p{Mn}|\p{Me}|\p{Cc}|\p{Cf}").replace_all(&s, "").into_owned();
    let s = s.to_lowercase();
    let s = re(&MARKS_ONLY, r"\p{Mn}|\p{Me}|\p{Cf}").replace_all(&s, "").into_owned();
    let mut t = String::with_capacity(s.len());
    for c in s.chars() {
        match transliteration(c) {
            Some(x) => t.push_str(x),
            None => t.push(c),
        }
    }
    let s = re(&NOT_ALNUM, r"[^a-z0-9]").replace_all(&t, "_").into_owned();
    let s = re(&RUNS, r"_{2,}").replace_all(&s, "_").into_owned();
    let s = s.trim_matches('_').to_string();
    if s.is_empty() {
        return SlugResult { slug: format!("{}_{}", nature.as_str(), random(6)), fallback_applied: true };
    }
    let s = if s.starts_with(|c: char| c.is_ascii_digit()) { format!("n_{s}") } else { s };
    SlugResult { slug: truncate_hard(&s, max), fallback_applied: false }
}

// ------------------------------------------------------------------------------------
// Reserved names (§4)

/// `NameScope`.
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

/// `ESCAPE_PREFIX`.
pub const ESCAPE_PREFIX: &str = "x_";

/// `escapeReservedPrefix`.
pub fn escape_reserved_prefix(candidate: &str, scope: NameScope, max: usize) -> String {
    if !has_reserved_prefix(candidate, scope) {
        return candidate.to_string();
    }
    truncate_hard(&format!("{ESCAPE_PREFIX}{candidate}"), max)
}

/// `hasReservedPrefix`.
pub fn has_reserved_prefix(candidate: &str, scope: NameScope) -> bool {
    reserved_prefixes(scope).iter().any(|p| candidate.starts_with(p))
}

/// PostgreSQL 16's keywords of catcode R, T and C (`pg_get_keywords()`).
pub const RESERVED_WORDS: [&str; 156] = [
    "all", "analyse", "analyze", "and", "any", "array", "as", "asc", "asymmetric", "authorization",
    "between", "bigint", "binary", "bit", "boolean", "both", "case", "cast", "char", "character",
    "check", "coalesce", "collate", "collation", "column", "concurrently", "constraint", "create", "cross", "current_catalog",
    "current_date", "current_role", "current_schema", "current_time", "current_timestamp", "current_user", "dec", "decimal", "default", "deferrable",
    "desc", "distinct", "do", "else", "end", "except", "exists", "extract", "false", "fetch",
    "float", "for", "foreign", "freeze", "from", "full", "grant", "greatest", "group", "grouping",
    "having", "ilike", "in", "initially", "inner", "inout", "int", "integer", "intersect", "interval",
    "into", "is", "isnull", "join", "json_array", "json_arrayagg", "json_object", "json_objectagg", "lateral", "leading",
    "least", "left", "like", "limit", "localtime", "localtimestamp", "national", "natural", "nchar", "none",
    "normalize", "not", "notnull", "null", "nullif", "numeric", "offset", "on", "only", "or",
    "order", "out", "outer", "overlaps", "overlay", "placing", "position", "precision", "primary", "real",
    "references", "returning", "right", "row", "select", "session_user", "setof", "similar", "smallint", "some",
    "substring", "symmetric", "system_user", "table", "tablesample", "then", "time", "timestamp", "to", "trailing",
    "treat", "trim", "true", "union", "unique", "user", "using", "values", "varchar", "variadic",
    "verbose", "when", "where", "window", "with", "xmlattributes", "xmlconcat", "xmlelement", "xmlexists", "xmlforest",
    "xmlnamespaces", "xmlparse", "xmlpi", "xmlroot", "xmlserialize", "xmltable",
];

/// `isReservedWord`.
pub fn is_reserved_word(candidate: &str) -> bool {
    RESERVED_WORDS.contains(&candidate)
}

/// `isReservedForScope`: never for a base slug.
pub fn is_reserved_for_scope(candidate: &str, scope: NameScope) -> bool {
    scope != NameScope::Base && is_reserved_word(candidate)
}

/// `applyNameRestrictions`: the escaped candidate, and whether the suffix loop is needed.
pub fn apply_name_restrictions(candidate: &str, scope: NameScope, max: usize) -> (String, bool) {
    let escaped = escape_reserved_prefix(candidate, scope, max);
    let reserved = is_reserved_for_scope(&escaped, scope);
    (escaped, reserved)
}

// ------------------------------------------------------------------------------------
// Tenants and schema names (§5, §7)

/// Base 36 minus `0`, `o`, `1`, `l`: 32 characters.
pub const TENANT_ALPHABET: &str = "23456789abcdefghijkmnpqrstuvwxyz";
pub const TENANT_ID_LENGTH: usize = 7;

/// `randomAlphabetChars`: the system's cryptographic generator, 5 low bits per byte.
pub fn random_alphabet_chars(count: usize) -> String {
    let mut bytes = vec![0u8; count];
    getrandom::getrandom(&mut bytes).expect("random source");
    bytes.iter().map(|b| TENANT_ALPHABET.as_bytes()[(b & 0b11111) as usize] as char).collect()
}

/// `isTenantId`.
pub fn is_tenant_id(value: &str) -> bool {
    static T: OnceLock<Regex> = OnceLock::new();
    re(&T, r"^t[23456789abcdefghijkmnpqrstuvwxyz]{6}$").is_match(value)
}

/// `composeSchemaName`: `b_<tenantId>_<base>`.
pub fn compose_schema_name(tenant_id: &str, base_slug: &str) -> String {
    format!("b_{tenant_id}_{base_slug}")
}

/// `parseSchemaName`: by position — `(tenantId, baseSlug)`.
pub fn parse_schema_name(schema_name: &str) -> Option<(String, String)> {
    let rest = schema_name.strip_prefix("b_")?;
    let tenant = rest.get(..TENANT_ID_LENGTH)?;
    if !is_tenant_id(tenant) || rest.as_bytes().get(TENANT_ID_LENGTH) != Some(&b'_') {
        return None;
    }
    let slug = &rest[TENANT_ID_LENGTH + 1..];
    (!slug.is_empty()).then(|| (tenant.to_string(), slug.to_string()))
}

// ------------------------------------------------------------------------------------
// Relegation (§9.5)

pub const MAX_RELEGATED_NAME_BYTES: usize = 42;
pub const MAX_RELEGATED_BASE_SLUG_BYTES: usize = 32;
const RELEGATION_MARKER: &str = "zz_supprime_";

/// `relegationDate`: `YYYYMMDD`, UTC.
pub fn relegation_date(at: DateTime<Utc>) -> String {
    format!("{:04}{:02}{:02}", at.year(), at.month(), at.day())
}

fn js_slice(s: &str, n: usize) -> String {
    String::from_utf16_lossy(&s.encode_utf16().take(n).collect::<Vec<_>>())
}

/// `relegatedName`: `zz_supprime_<YYYYMMDD>_<name>`.
pub fn relegated_name(name: &str, at: DateTime<Utc>) -> String {
    format!("{RELEGATION_MARKER}{}_{}", relegation_date(at), js_slice(name, MAX_RELEGATED_NAME_BYTES))
}

/// `relegatedSchemaName`: `b_<tenantId>_zz_supprime_<YYYYMMDD>_<base slug>`.
pub fn relegated_schema_name(tenant_id: &str, base_slug: &str, at: DateTime<Utc>) -> String {
    format!("b_{tenant_id}_{RELEGATION_MARKER}{}_{}", relegation_date(at), js_slice(base_slug, MAX_RELEGATED_BASE_SLUG_BYTES))
}

/// `isRelegatedName`.
pub fn is_relegated_name(name: &str) -> bool {
    name.starts_with(RELEGATION_MARKER)
}

/// `isRelegatedSchemaName`.
pub fn is_relegated_schema_name(schema_name: &str) -> bool {
    schema_name.get(3 + TENANT_ID_LENGTH..).is_some_and(|s| s.starts_with(RELEGATION_MARKER))
}

// ------------------------------------------------------------------------------------
// Derived names (§9)

/// `Segment`.
#[derive(Debug, Clone, Copy)]
pub enum Segment<'a> {
    Fixed(&'a str),
    Variable(&'a str),
}

pub const MAX_UNIQUE_COLUMNS_NAMED: usize = 3;

/// `distributeBudget`: water-filling, the remainder to the first components.
pub fn distribute_budget(lengths: &[usize], budget: usize) -> Vec<usize> {
    let n = lengths.len();
    let mut allocated = vec![0usize; n];
    let mut settled = vec![false; n];
    let mut remaining = budget as i64;
    let mut free = n as i64;
    while free > 0 {
        let part = remaining.div_euclid(free);
        let mut settled_this_round = false;
        for i in 0..n {
            if settled[i] {
                continue;
            }
            if (lengths[i] as i64) <= part {
                allocated[i] = lengths[i];
                settled[i] = true;
                remaining -= lengths[i] as i64;
                free -= 1;
                settled_this_round = true;
            }
        }
        if settled_this_round {
            continue;
        }
        let mut rest = remaining - part * free;
        for i in 0..n {
            if settled[i] {
                continue;
            }
            allocated[i] = (part + if rest > 0 { 1 } else { 0 }).max(0) as usize;
            if rest > 0 {
                rest -= 1;
            }
        }
        break;
    }
    allocated
}

fn trim_component(value: &str, max: usize) -> String {
    js_slice(value, max).trim_end_matches('_').to_string()
}

/// `assembleDerivedName`.
pub fn assemble_derived_name(segments: &[Segment]) -> String {
    let fixed: usize = segments.iter().map(|s| if let Segment::Fixed(f) = s { f.len() } else { 0 }).sum();
    let variables: Vec<&str> = segments.iter().filter_map(|s| if let Segment::Variable(v) = s { Some(*v) } else { None }).collect();
    let variable: usize = variables.iter().map(|v| v.len()).sum();
    if fixed + variable <= MAX_DERIVED_NAME_BYTES {
        return segments.iter().map(|s| match s {
            Segment::Fixed(f) | Segment::Variable(f) => *f,
        }).collect();
    }
    let allocation = distribute_budget(&variables.iter().map(|v| v.len()).collect::<Vec<_>>(), MAX_DERIVED_NAME_BYTES.saturating_sub(fixed));
    let mut index = 0;
    segments
        .iter()
        .map(|s| match s {
            Segment::Fixed(f) => f.to_string(),
            Segment::Variable(v) => {
                let out = trim_component(v, allocation[index]);
                index += 1;
                out
            }
        })
        .collect()
}

use Segment::{Fixed, Variable};

/// `pk_<table>`.
pub fn primary_key_name(table: &str) -> String {
    assemble_derived_name(&[Fixed("pk_"), Variable(table)])
}

/// `fk_<table>__<column>`.
pub fn foreign_key_name(table: &str, column: &str) -> String {
    assemble_derived_name(&[Fixed("fk_"), Variable(table), Fixed("__"), Variable(column)])
}

/// `ix_<table>__<column>[__<column>…]`.
pub fn index_name(table: &str, columns: &[&str]) -> String {
    let mut segments = vec![Fixed("ix_"), Variable(table)];
    for c in columns {
        segments.push(Fixed("__"));
        segments.push(Variable(c));
    }
    assemble_derived_name(&segments)
}

/// `uq_<table>__<c1>[__<c2>__<c3>][__etc]`.
pub fn unique_constraint_name(table: &str, columns: &[&str]) -> String {
    let mut segments = vec![Fixed("uq_"), Variable(table)];
    for c in columns.iter().take(MAX_UNIQUE_COLUMNS_NAMED) {
        segments.push(Fixed("__"));
        segments.push(Variable(c));
    }
    if columns.len() > MAX_UNIQUE_COLUMNS_NAMED {
        segments.push(Fixed("__etc"));
    }
    assemble_derived_name(&segments)
}

/// `ck_<table>__<column>__<rule>`.
pub fn check_constraint_name(table: &str, column: &str, rule: &str) -> String {
    let rule = format!("__{rule}");
    assemble_derived_name(&[Fixed("ck_"), Variable(table), Fixed("__"), Variable(column), Fixed(&rule)])
}

/// `tg_<table>__<role>`.
pub fn trigger_name(table: &str, role: &str) -> String {
    let role = format!("__{role}");
    assemble_derived_name(&[Fixed("tg_"), Variable(table), Fixed(&role)])
}

/// `<table>__<column>_seq`.
pub fn sequence_name(table: &str, column: &str) -> String {
    assemble_derived_name(&[Variable(table), Fixed("__"), Variable(column), Fixed("_seq")])
}

/// `<target_table>_id`.
pub fn link_column_name(target_table: &str) -> String {
    assemble_derived_name(&[Variable(target_table), Fixed("_id")])
}

/// `<field slug>_id`.
pub fn link_column_name_from_label(field_slug: &str) -> String {
    assemble_derived_name(&[Variable(field_slug), Fixed("_id")])
}

/// `<target_table>_ids`.
pub fn multi_link_column_name(target_table: &str) -> String {
    assemble_derived_name(&[Variable(target_table), Fixed("_ids")])
}

/// `<field slug>_ids`.
pub fn multi_link_column_name_from_label(field_slug: &str) -> String {
    assemble_derived_name(&[Variable(field_slug), Fixed("_ids")])
}

/// `tg_<table>__ml_<column>`.
pub fn multi_link_trigger_name(table: &str, column: &str) -> String {
    assemble_derived_name(&[Fixed("tg_"), Variable(table), Fixed("__ml_"), Variable(column)])
}

/// `tg_<target>__mlt_<source>_<column>`.
pub fn multi_link_target_trigger_name(target: &str, source: &str, column: &str) -> String {
    assemble_derived_name(&[Fixed("tg_"), Variable(target), Fixed("__mlt_"), Variable(source), Fixed("_"), Variable(column)])
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn as_table(label: &str) -> SlugResult {
        slugify_with(label, MAX_TABLE_NAME_BYTES, SlugNature::Table, |n| "k3f9x2"[..n].to_string())
    }

    #[test]
    fn end_to_end_examples() {
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
            ("Liste des contrats de prévoyance collective souscrits par les entreprises de plus de cinquante salariés en 2024", "liste_des_contrats_de_prevoyance_collective_sous"),
            ("Istanbul", "istanbul"),
            ("IIII", "iiii"),
            ("ıstanbul", "istanbul"),
        ];
        for (label, expected) in cases {
            assert_eq!(as_table(label).slug, expected, "{label}");
        }
        assert_eq!(apply_name_restrictions(&as_table("zz_archive").slug, NameScope::Table, MAX_TABLE_NAME_BYTES).0, "x_zz_archive");
        assert_eq!(apply_name_restrictions(&as_table("PG monitoring").slug, NameScope::Table, MAX_TABLE_NAME_BYTES).0, "x_pg_monitoring");
        assert_eq!(as_table("Клиенты"), SlugResult { slug: "table_k3f9x2".into(), fallback_applied: true });
        assert_eq!(as_table("...").slug, "table_k3f9x2");
        assert!(is_reserved_for_scope(&as_table("select").slug, NameScope::Table));
        assert!(is_reserved_for_scope(&as_table("Time").slug, NameScope::Table));
        assert!(!is_reserved_for_scope("select", NameScope::Base));
    }

    #[test]
    fn invisible_characters_vanish() {
        for c in ['\u{AD}', '\u{200B}', '\u{200C}', '\u{200D}', '\u{200E}', '\u{FE00}', '\u{FE0F}'] {
            assert_eq!(as_table(&format!("cli{c}ents")).slug, "clients");
        }
    }

    #[test]
    fn slugs_hold_their_properties() {
        let samples = ["Ça va ? Ünïcödé — 東京 ½ ﬃ", "___a__b___", "9", "ŉ ǆ ẞ", "\u{0}x\u{7f}y", "a".repeat(300).as_str(), "e\u{301}e\u{301}"].map(String::from);
        for label in samples {
            for nature in [SlugNature::Base, SlugNature::Table, SlugNature::Champ] {
                let max = budget_for_nature(nature);
                let once = slugify(&label, max, nature);
                assert!(is_alphabet_a(&once.slug), "{label} → {}", once.slug);
                assert!(once.slug.len() <= max);
                assert!(!once.slug.starts_with('_') && !once.slug.ends_with('_') && !once.slug.contains("__"));
                if !once.fallback_applied {
                    assert_eq!(slugify(&once.slug, max, nature).slug, once.slug);
                    let nfd: String = label.nfd().collect();
                    let nfc: String = label.nfc().collect();
                    assert_eq!(slugify(&nfd, max, nature).slug, slugify(&nfc, max, nature).slug);
                }
            }
        }
    }

    #[test]
    fn derived_names() {
        assert_eq!(primary_key_name("factures"), "pk_factures");
        assert_eq!(foreign_key_name("factures", "clients_id"), "fk_factures__clients_id");
        assert_eq!(index_name("factures", &["clients_id"]), "ix_factures__clients_id");
        assert_eq!(link_column_name("clients"), "clients_id");
        assert_eq!(link_column_name_from_label("client_livre"), "client_livre_id");
        assert_eq!(check_constraint_name("factures", "montant", "range"), "ck_factures__montant__range");
        assert_eq!(trigger_name("factures", "system"), "tg_factures__system");
        assert_eq!(sequence_name("factures", "numero"), "factures__numero_seq");
        assert_eq!(unique_constraint_name("factures", &["numero", "annee"]), "uq_factures__numero__annee");
        assert_eq!(unique_constraint_name("t", &["a", "b", "c", "d"]), "uq_t__a__b__c__etc");
        let name = foreign_key_name("liste_des_contrats_de_prevoyance_collective_sous", "client_livre_id");
        assert_eq!(name, "fk_liste_des_contrats_de_prevoyance_collective__client_livre_id");
        assert_eq!(name.len(), 63);
        assert_eq!(distribute_budget(&[48, 15], 58), vec![43, 15]);
        assert_eq!(distribute_budget(&[50, 50, 50], 7), vec![3, 2, 2]);
        let long = "a_b".repeat(16);
        for n in [primary_key_name(&long), foreign_key_name(&long, &long), index_name(&long, &[&long, &long]), unique_constraint_name(&long, &[&long, &long]), check_constraint_name(&long, &long, "range"), trigger_name(&long, "capture_upd"), sequence_name(&long, &long), link_column_name(&long), multi_link_target_trigger_name(&long, &long, &long)] {
            assert!(n.len() <= MAX_DERIVED_NAME_BYTES, "{n}");
        }
    }

    #[test]
    fn schema_names_and_relegation() {
        assert_eq!(compose_schema_name("t4z56fq", "factures_2024"), "b_t4z56fq_factures_2024");
        assert_eq!(parse_schema_name("b_t4z56fq_factures_2024"), Some(("t4z56fq".into(), "factures_2024".into())));
        for foreign in ["_basedb", "_basedb_local", "public", "pg_catalog", "b_xxx_crm"] {
            assert_eq!(parse_schema_name(foreign), None);
        }
        let at = Utc.with_ymd_and_hms(2026, 9, 18, 0, 0, 0).unwrap();
        assert_eq!(relegated_name("remise", at), "zz_supprime_20260918_remise");
        let name = relegated_schema_name("t4z56fq", "crm", at);
        assert_eq!(name, "b_t4z56fq_zz_supprime_20260918_crm");
        assert!(is_relegated_schema_name(&name));
        assert!(relegated_name(&"a".repeat(48), at).len() <= 63);
        assert!(relegated_schema_name("t4z56fq", &"b".repeat(53), at).len() <= 63);
        assert!(is_tenant_id("t4z56fq") && !is_tenant_id("t4z56fo") && !is_tenant_id("x4z56fq") && !is_tenant_id("t4z56f"));
        assert_eq!(random_alphabet_chars(6).len(), 6);
    }

    #[test]
    fn quoting() {
        assert_eq!(quote_identifier("factures").unwrap(), "\"factures\"");
        assert_eq!(quote_identifier("_id").unwrap(), "\"_id\"");
        assert_eq!(qualify("b_t4z56fq_crm", "factures").unwrap(), "\"b_t4z56fq_crm\".\"factures\"");
        for invalid in ["Factures", "fac tures", "fac\"tures", "", &"a".repeat(64), "2024"] {
            assert!(quote_identifier(invalid).is_err());
        }
        let schema = compose_schema_name("t4z56fq", "liste_des_contrats_de_prevoyance_collective_souscrits");
        assert_eq!(schema.len(), 63);
        assert!(is_alphabet_b(&schema));
        for reserved in ["_id", "_basedb", "_basedb_local", "_created_at"] {
            assert!(is_alphabet_b(reserved) && !is_alphabet_a(reserved));
        }
        assert!(!is_alphabet_b(&format!("_{}", "b".repeat(63))));
        assert_eq!(quote_literal("l'eau"), "'l''eau'");
    }
}