//! `templates/draft.ts`: a whole base template proposed by the AI from a sentence, read by
//! the templates' checker in repair mode — what does not hold is dropped and said.
//!
//! The payload carries the sentence, the previous proposal when the person refines it, and
//! today's date: no label, no value of any base.

use crate::prompts;
use crate::provider::{assert_quota, invoke, resolve_provider, InvokeOptions, Usage};
use basedb_base::db::PoolName;
use basedb_base::error::AppError;
use basedb_base::idempotency::js_stringify;
use basedb_base::rbac::require::{load_project_target, require_action};
use basedb_base::rbac::Action;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::AppState;
use basedb_catalog::template_check::{check_template_repair, u16len, u16slice};
use serde_json::{json, Map, Value};

const MAX_REQUEST_CHARS: usize = 2000;
/// Past this, the previous proposal travels without its rows: the payload has a ceiling.
const PREVIOUS_MAX_BYTES: usize = 40 * 1024;

/// `draftTemplate`.
pub async fn draft_template(st: &AppState, ctx: &RequestContext, project_id: &str, request: &str, previous: Option<&Value>) -> Result<Value, AppError> {
    let sentence = crate::js::js_trim(request);
    if sentence.is_empty() || u16len(sentence) > MAX_REQUEST_CHARS {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("request")).with("reason", json!(if sentence.is_empty() { "vide" } else { "trop_long" })));
    }

    let config = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        let project_id = project_id.to_string();
        async move {
            let project = load_project_target(&tx, &ctx, &project_id).await?;
            let mut details = Map::new();
            details.insert("project".into(), json!(project_id));
            require_action(&tx, &ctx, Action::ManageSchema, project, details).await?;
            let config = resolve_provider(&tx, &ctx, &st.cfg).await?;
            assert_quota(&tx, &ctx, &st.cfg, Usage::TemplateDraft).await?;
            Ok(config)
        }
    })
    .await?;

    let mut payload = Map::new();
    payload.insert("intent".into(), json!("template_draft"));
    payload.insert("request".into(), json!(sentence));
    payload.insert("today".into(), json!(chrono::Utc::now().format("%Y-%m-%d").to_string()));
    if let Some(previous) = previous.filter(|p| !p.is_null()) {
        if let Ok((template, _)) = check_template_repair(previous) {
            let whole = js_stringify(&template);
            payload.insert(
                "previous".into(),
                if whole.len() <= PREVIOUS_MAX_BYTES {
                    template
                } else {
                    let mut light = template.as_object().cloned().unwrap_or_default();
                    light.insert("rows".into(), json!({}));
                    light.insert("note".into(), json!("lignes omises : propose-les à nouveau"));
                    Value::Object(light)
                },
            );
        }
    }

    let answer = invoke(
        st,
        ctx,
        &config,
        Usage::TemplateDraft,
        None,
        &Value::Object(payload),
        prompts::template_draft_schema(),
        prompts::TEMPLATE_SYSTEM,
        InvokeOptions { timeout_ms: Some(90_000), max_tokens: Some(12_000), ..Default::default() },
    )
    .await?;

    let proposal = answer.get("template").cloned().unwrap_or(Value::Null);
    let (template, issues) = match check_template_repair(&proposal) {
        Ok(checked) => checked,
        Err(issues) => {
            return Err(AppError::new("AI_RESPONSE_UNUSABLE")
                .with("reason", json!("modèle inutilisable"))
                .with("issues", Value::Array(issues.into_iter().take(10).collect())));
        }
    };
    let explanation = answer.get("explanation").and_then(Value::as_str).map(|e| u16slice(e, 2000)).unwrap_or_default();
    Ok(json!({ "template": template, "explanation": explanation, "issues": issues }))
}
