//! `basedb-contracts` — le vocabulaire partagé du serveur, port de `packages/contracts` et de
//! `packages/naming` :
//!
//! - [`error_codes`] : le registre des codes d'erreur (A23, généré), leur statut HTTP et leur
//!   classe (`incident`, `invisible`, `forbidden`…) ;
//! - [`locales`] : les vingt langues, `Accept-Language`, `matchLocale` ;
//! - [`naming`] : alphabets, budgets, slug, noms dérivés, citation des identifiants, tenant,
//!   noms de schéma, relégation ;
//! - [`ErrorBody`] : le corps d'erreur de l'API (chapitre 08 §6).
//!
//! Sans dépendance à axum ni à PostgreSQL : tout crate peut s'en servir.

pub mod error_codes;
mod error_codes_table;
pub mod locales;
pub mod naming;

pub use error_codes::{error_class, http_status_for, is_error_code, ErrorClass, ErrorCodeEntry, ERROR_CODES};
pub use locales::{accepted_languages, is_locale, locale_of_tag, match_locale, FALLBACK_LOCALE, LOCALES, LOCALE_NAMES, SOURCE_LOCALE};

use serde::Serialize;
use serde_json::{Map, Value};

/// The error body of the API (chapter 08 §6): `{code, details?, request_id}` — never a message.
/// An incident carries no `details` at all.
#[derive(Debug, Clone, Serialize)]
pub struct ErrorBody {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Map<String, Value>>,
    pub request_id: String,
}
