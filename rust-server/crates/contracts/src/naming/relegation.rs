//! `relegation.ts` — une table, un champ ou une base supprimés gardent leurs données sous un
//! nom marqué `zz_supprime_AAAAMMJJ_`.

use super::tenant::TENANT_ID_LENGTH;
use chrono::{DateTime, Datelike, Utc};

pub const RELEGATION_PREFIX_BYTES: usize = 21;
pub const MAX_RELEGATED_NAME_BYTES: usize = 42;
pub const MAX_RELEGATED_BASE_SLUG_BYTES: usize = 32;
const MARKER: &str = "zz_supprime_";

pub fn relegation_date(at: DateTime<Utc>) -> String {
    format!("{:04}{:02}{:02}", at.year(), at.month(), at.day())
}

fn head(value: &str, max: usize) -> &str {
    let mut end = 0;
    for (i, c) in value.char_indices() {
        if i + c.len_utf8() > max {
            break;
        }
        end = i + c.len_utf8();
    }
    &value[..end]
}

pub fn relegated_name(name: &str, at: DateTime<Utc>) -> String {
    format!("{MARKER}{}_{}", relegation_date(at), head(name, MAX_RELEGATED_NAME_BYTES))
}

pub fn relegated_schema_name(tenant_id: &str, base_slug: &str, at: DateTime<Utc>) -> String {
    format!("b_{tenant_id}_{MARKER}{}_{}", relegation_date(at), head(base_slug, MAX_RELEGATED_BASE_SLUG_BYTES))
}

pub fn is_relegated_name(name: &str) -> bool {
    name.starts_with(MARKER)
}

pub fn is_relegated_schema_name(schema_name: &str) -> bool {
    schema_name.get(3 + TENANT_ID_LENGTH..).is_some_and(|rest| rest.starts_with(MARKER))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::naming::parse_schema_name;
    use chrono::TimeZone;

    #[test]
    fn relegation_names() {
        let at = Utc.with_ymd_and_hms(2026, 9, 18, 0, 0, 0).unwrap();
        assert_eq!(relegated_name("remise", at), "zz_supprime_20260918_remise");
        let name = relegated_schema_name("t4z56fq", "crm", at);
        assert_eq!(name, "b_t4z56fq_zz_supprime_20260918_crm");
        assert_eq!(parse_schema_name(&name).unwrap().tenant_id, "t4z56fq");
        assert!(is_relegated_schema_name(&name));
        assert!(is_relegated_name("zz_supprime_20260918_remise"));
        assert!(relegated_name(&"a".repeat(48), at).len() <= 63);
        assert!(relegated_schema_name("t4z56fq", &"b".repeat(53), at).len() <= 63);
    }
}
