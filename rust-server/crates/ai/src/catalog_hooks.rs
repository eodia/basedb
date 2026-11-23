//! The services the catalog calls for an AI field (`basedb_catalog::ai_hooks`): a field
//! added with `ai`, a plan's `set_ai` and `remove_ai`, a template built with consent.

use crate::fields::{ai_input_of, insert_ai_config, is_ai_kind, remove_ai_field, write_ai_field, AiInput};
use basedb_base::config::Config;
use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::tx::{RequestContext, Tx};
use basedb_catalog::ai_hooks::{set_ai_hooks, AiFieldTarget, AiHooks};
use serde_json::{json, Value};
use std::future::Future;
use std::pin::Pin;
use std::sync::OnceLock;

type Boxed<T> = Pin<Box<dyn Future<Output = Result<T, AppError>> + Send>>;

static CONFIG: OnceLock<Config> = OnceLock::new();

fn env() -> &'static Config {
    CONFIG.get().expect("ai hooks installed")
}

/// Hands the catalog its AI services; `router` calls it once.
pub fn install(cfg: &Config) {
    if CONFIG.set(cfg.clone()).is_ok() {
        set_ai_hooks(AiHooks { input_of, is_ai_kind, insert, set, disable });
    }
}

fn normalized(input: &AiInput) -> Value {
    json!({
        "prompt": input.prompt,
        "refresh": { "mode": input.mode, "cron": input.cron, "timezone": input.timezone },
        "consent": input.consent,
    })
}

fn input_of(raw: &Value) -> Result<Value, AppError> {
    ai_input_of(raw).map(|i| normalized(&i))
}

fn insert(tx: Tx, ctx: RequestContext, target: AiFieldTarget, ai: Value) -> Boxed<()> {
    Box::pin(async move {
        let input = ai_input_of(&ai)?;
        insert_ai_config(&tx, &ctx, env(), &target.field_id, &target.kind, &target.table_id, &target.column, &input).await
    })
}

fn set(pools: Pools, ctx: RequestContext, field_id: String, ai: Value) -> Boxed<()> {
    Box::pin(async move {
        let input = ai_input_of(&ai)?;
        write_ai_field(&pools, env(), &ctx, &field_id, &input, false).await
    })
}

fn disable(pools: Pools, ctx: RequestContext, field_id: String) -> Boxed<()> {
    Box::pin(async move { remove_ai_field(&pools, &ctx, &field_id).await })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_as_core_reads_it() {
        let raw = json!({ "prompt": "Résume {{notes}}", "refresh": { "mode": "if_empty" }, "consent": true });
        let once = input_of(&raw).unwrap();
        assert_eq!(once, json!({ "prompt": "Résume {{notes}}", "refresh": { "mode": "if_empty", "cron": null, "timezone": null }, "consent": true }));
        assert_eq!(input_of(&once).unwrap(), once);
    }
}
