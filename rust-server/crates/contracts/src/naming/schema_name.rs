//! `schema-name.ts` — `b_<tenant>_<slug>`, relu par position et non en coupant sur `_`.

use super::tenant::{is_tenant_id, TENANT_ID_LENGTH};

pub const SCHEMA_PREFIX_BYTES: usize = 10;
const MARKER: &str = "b_";

pub fn compose_schema_name(tenant_id: &str, base_slug: &str) -> String {
    format!("{MARKER}{tenant_id}_{base_slug}")
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedSchemaName {
    pub tenant_id: String,
    pub base_slug: String,
}

pub fn parse_schema_name(schema_name: &str) -> Option<ParsedSchemaName> {
    if !schema_name.starts_with(MARKER) || !schema_name.is_ascii() {
        return None;
    }
    let tenant_id = schema_name.get(2..2 + TENANT_ID_LENGTH)?;
    if !is_tenant_id(tenant_id) {
        return None;
    }
    if schema_name.as_bytes().get(2 + TENANT_ID_LENGTH) != Some(&b'_') {
        return None;
    }
    let base_slug = &schema_name[3 + TENANT_ID_LENGTH..];
    if base_slug.is_empty() {
        return None;
    }
    Some(ParsedSchemaName { tenant_id: tenant_id.to_string(), base_slug: base_slug.to_string() })
}

pub fn schema_belongs_to_tenant(schema_name: &str, tenant_id: &str) -> bool {
    parse_schema_name(schema_name).is_some_and(|p| p.tenant_id == tenant_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn composes_and_reads_by_position() {
        let name = compose_schema_name("t4z56fq", "factures_2024");
        assert_eq!(name, "b_t4z56fq_factures_2024");
        assert_eq!(parse_schema_name(&name), Some(ParsedSchemaName { tenant_id: "t4z56fq".into(), base_slug: "factures_2024".into() }));
        assert_eq!(compose_schema_name("t9k2mnp", "crm"), "b_t9k2mnp_crm");
        for foreign in ["_basedb", "_basedb_local", "public", "pg_catalog", "b_xxx_crm"] {
            assert_eq!(parse_schema_name(foreign), None, "{foreign}");
        }
        assert!(schema_belongs_to_tenant("b_t4z56fq_crm", "t4z56fq"));
        assert!(!schema_belongs_to_tenant("b_t4z56fq_crm", "t9k2mnp"));
    }
}
