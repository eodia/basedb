//! Les droits — chapitre 05, tels `packages/core/src/rbac` : la décision pure
//! ([`decide`]), le chargement des instantanés ([`loader`]), l'exigence d'un droit
//! ([`require`]) et les règles de lignes ([`rows`]).

pub mod decide;
pub mod loader;
pub mod require;
pub mod rows;

pub use decide::{decide, Action, ActorGrants, Decision, Target, TargetKind, Verdict, SYSTEM_COLUMNS};
pub use loader::{load_field_names, load_fields, load_grants, load_target};
pub use require::{administers, require_action, require_administration, require_on_base, require_on_field, require_on_table, tenant_target};
