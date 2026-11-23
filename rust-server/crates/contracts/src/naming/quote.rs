//! `quote.ts` — la citation systématique des identifiants : jamais de SQL pour un nom hors de
//! l'alphabet B (`IDENTIFIER_INVALID`).

use super::is_alphabet_b;

/// `IdentifierInvalidError`: the refused identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IdentifierInvalid(pub String);

impl IdentifierInvalid {
    pub const CODE: &'static str = "IDENTIFIER_INVALID";
}

impl std::fmt::Display for IdentifierInvalid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "IDENTIFIER_INVALID: {}", serde_json::Value::String(self.0.clone()))
    }
}

impl std::error::Error for IdentifierInvalid {}

pub fn quote_identifier(identifier: &str) -> Result<String, IdentifierInvalid> {
    if !is_alphabet_b(identifier) {
        return Err(IdentifierInvalid(identifier.to_string()));
    }
    Ok(format!("\"{}\"", identifier.replace('"', "\"\"")))
}

pub fn qualify(schema: &str, object: &str) -> Result<String, IdentifierInvalid> {
    Ok(format!("{}.{}", quote_identifier(schema)?, quote_identifier(object)?))
}

pub fn qualify_column(schema: &str, table: &str, column: &str) -> Result<String, IdentifierInvalid> {
    Ok(format!("{}.{}", qualify(schema, table)?, quote_identifier(column)?))
}

/// A SQL string literal (`quoteLiteral` of the kernel): quotes doubled, standard strings.
pub fn quote_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_and_qualifies() {
        assert_eq!(quote_identifier("factures").unwrap(), "\"factures\"");
        assert_eq!(quote_identifier("_id").unwrap(), "\"_id\"");
        assert_eq!(qualify("b_t4z56fq_crm", "factures").unwrap(), "\"b_t4z56fq_crm\".\"factures\"");
        assert_eq!(qualify("_basedb_local", "uuid_generate_v7").unwrap(), "\"_basedb_local\".\"uuid_generate_v7\"");
        assert_eq!(qualify_column("s_x", "t", "c").unwrap(), "\"s_x\".\"t\".\"c\"");
        assert_eq!(quote_literal("l'eau"), "'l''eau'");
    }

    #[test]
    fn refuses_outside_alphabet_b() {
        for invalid in ["Factures", "fac tures", "fac\"tures", "", &"a".repeat(64), "2024"] {
            assert_eq!(quote_identifier(invalid), Err(IdentifierInvalid(invalid.to_string())));
        }
    }
}
