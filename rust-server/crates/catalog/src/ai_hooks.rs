//! The `ai` crate's services the catalog calls — an AI field added (`addField` with `ai`),
//! set or removed by an environment's plan, built by a template with consent. The catalog
//! cannot depend on that crate: it installs them at start (`basedb_ai::router`). Without
//! them (a router mounted alone, in tests), the routes that would need them answer an incident.

use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::tx::{RequestContext, Tx};
use serde_json::Value;
use std::future::Future;
use std::pin::Pin;
use std::sync::OnceLock;

type Boxed<T> = Pin<Box<dyn Future<Output = Result<T, AppError>> + Send>>;

/// The field an AI configuration is written for, inside the transaction that adds it.
pub struct AiFieldTarget {
    pub field_id: String,
    pub kind: String,
    pub table_id: String,
    pub column: String,
}

/// The services. An `ai` input is always the normalized shape
/// `{ prompt, refresh: { mode, cron, timezone }, consent }`.
pub struct AiHooks {
    /// `aiInputOf` of `app.ts`: the body's `ai`, checked and normalized.
    pub input_of: fn(&Value) -> Result<Value, AppError>,
    /// `isAiKind`.
    pub is_ai_kind: fn(&str) -> bool,
    /// `insertAiConfig`, in the transaction that adds the field.
    pub insert: fn(Tx, RequestContext, AiFieldTarget, Value) -> Boxed<()>,
    /// `setAiField` (without a recomputation).
    pub set: fn(Pools, RequestContext, String, Value) -> Boxed<()>,
    /// `disableAiField`.
    pub disable: fn(Pools, RequestContext, String) -> Boxed<()>,
}

static HOOKS: OnceLock<AiHooks> = OnceLock::new();

/// Installs the `ai` crate's services; the first installation holds.
pub fn set_ai_hooks(hooks: AiHooks) {
    let _ = HOOKS.set(hooks);
}

pub fn ai_hooks() -> Option<&'static AiHooks> {
    HOOKS.get()
}

pub(crate) fn required() -> Result<&'static AiHooks, AppError> {
    ai_hooks().ok_or_else(|| AppError::internal("the ai crate is not installed"))
}

/// `AI_UNAVAILABLE` of `core/templates/apply.ts`: a template's AI field then degrades.
pub const AI_UNAVAILABLE: [&str; 3] = ["AI_DISABLED", "AI_NOT_CONFIGURED", "AI_CONSENT_REQUIRED"];
