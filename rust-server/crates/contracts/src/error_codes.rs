//! Le registre des codes d'erreur (A23), tel `packages/contracts/src/error-codes.ts`, et la
//! classe de chaque code, tel `classOf` de `packages/core/src/errors/index.ts`.
//!
//! Le statut HTTP vient d'ici et de nulle part ailleurs : c'est ce qui garantit qu'une
//! ressource invisible rend 404 sur toutes les routes, y compris celles ajoutées plus tard.

/// One code of the registry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ErrorCodeEntry {
    pub code: &'static str,
    pub condition: &'static str,
    /// `None`: the code never reaches HTTP (start-up refusals) — 500 if it ever does.
    pub http_status: Option<u16>,
    pub http_status_note: Option<&'static str>,
    pub chapter: &'static str,
    pub domain: &'static str,
}

/// Every code, in the registry's order.
pub static ERROR_CODES: &[ErrorCodeEntry] = crate::error_codes_table::ENTRIES;

pub fn entry(code: &str) -> Option<&'static ErrorCodeEntry> {
    ERROR_CODES.iter().find(|e| e.code == code)
}

pub fn is_error_code(code: &str) -> bool {
    entry(code).is_some()
}

/// `httpStatusFor`: the registry's status, `None` for an unknown code or one with no status.
pub fn http_status_for(code: &str) -> Option<u16> {
    entry(code).and_then(|e| e.http_status)
}

/// `ErrorClass` of the kernel: what kind of refusal a code is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorClass {
    Incident,
    Invisible,
    Forbidden,
    Conflict,
    Unavailable,
    Validation,
}

/// Codes that are never the caller's fault: they reveal a defect in the product.
pub const INCIDENTS: [&str; 7] = [
    "CATALOG_DRIFT",
    "PRIVILEGES_INSUFFICIENT",
    "FIELD_CONFIG_MISSING",
    "NAME_TOO_LONG",
    "NAME_TAKEN_OUTSIDE_REGISTRY",
    "CONNECTION_CONTRACT_BROKEN",
    "INTERNAL_ERROR",
];

/// `classOf`: an incident discloses only an identifier (`INTERNAL_ERROR` + `request_id`).
pub fn error_class(code: &str) -> ErrorClass {
    if INCIDENTS.contains(&code) {
        return ErrorClass::Incident;
    }
    match entry(code).and_then(|e| e.http_status) {
        Some(404) => ErrorClass::Invisible,
        Some(403) => ErrorClass::Forbidden,
        Some(409) => ErrorClass::Conflict,
        Some(502) | Some(503) => ErrorClass::Unavailable,
        None => ErrorClass::Incident,
        Some(s) if s >= 500 => ErrorClass::Incident,
        Some(_) => ErrorClass::Validation,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_has_every_code_once() {
        assert_eq!(ERROR_CODES.len(), 241);
        let mut seen = std::collections::HashSet::new();
        let shape = regex::Regex::new("^[A-Z][A-Z0-9_]*$").unwrap();
        for e in ERROR_CODES {
            assert!(seen.insert(e.code), "{} en double", e.code);
            assert!(shape.is_match(e.code));
        }
    }

    #[test]
    fn statuses_follow_the_registry() {
        assert_eq!(http_status_for("RESOURCE_NOT_FOUND"), Some(404));
        assert_eq!(http_status_for("ADMIN_REQUIRED"), Some(403));
        for code in ["TOKEN_INVALID", "TOKEN_EXPIRED", "TOKEN_REVOKED"] {
            assert_eq!(http_status_for(code), Some(401), "{code}");
        }
        assert_eq!(http_status_for("LOCK_UNAVAILABLE"), Some(503));
        assert_eq!(http_status_for("POSTGRES_VERSION_TOO_OLD"), None);
        assert_eq!(http_status_for("DB_ENCODING_NOT_UTF8"), None);
        assert_eq!(http_status_for("NOT_A_CODE"), None);
    }

    #[test]
    fn the_only_composite_status_is_identifier_invalid() {
        let composite: Vec<_> = ERROR_CODES.iter().filter(|e| e.http_status_note.is_some()).map(|e| e.code).collect();
        assert_eq!(composite, vec!["IDENTIFIER_INVALID"]);
        let e = entry("IDENTIFIER_INVALID").unwrap();
        assert_eq!(e.http_status, Some(422));
        assert_eq!(e.http_status_note, Some("422 ; 500 si construit par le noyau"));
    }

    #[test]
    fn classes_follow_the_kernel() {
        assert_eq!(error_class("RESOURCE_NOT_FOUND"), ErrorClass::Invisible);
        assert_eq!(error_class("ADMIN_REQUIRED"), ErrorClass::Forbidden);
        assert_eq!(error_class("CATALOG_DRIFT"), ErrorClass::Incident);
        assert_eq!(error_class("INTERNAL_ERROR"), ErrorClass::Incident);
        assert_eq!(error_class("LOCK_UNAVAILABLE"), ErrorClass::Unavailable);
        assert_eq!(error_class("CATALOG_CHECKSUM_MISMATCH"), ErrorClass::Incident);
        assert_eq!(error_class("CREDENTIALS_INVALID"), ErrorClass::Validation);
    }
}
