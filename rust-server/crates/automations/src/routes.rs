//! The routes of the automations (`app.ts`, chapter 17).

use crate::catalog;
use crate::requests;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::Extension;
use basedb_admin::common::{lenient_json, strict_json};
use basedb_base::auth::{bearer_context, data_context};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError};
use basedb_base::layers::RequestId;
use basedb_base::rate_limit::RateLimiter;
use basedb_base::time::now_ms;
use basedb_base::Shared;
use basedb_catalog::projection::{resolve_base, resolve_table};
use serde_json::{json, Value};
use std::sync::OnceLock;

/// Ten clicks a minute per person (`clicks`).
fn clicks() -> &'static RateLimiter {
    static L: OnceLock<RateLimiter> = OnceLock::new();
    L.get_or_init(|| RateLimiter::new(10, 60_000))
}

/// A minute's calls to one automation's address (`hookCalls`).
fn hook_calls() -> &'static RateLimiter {
    static L: OnceLock<RateLimiter> = OnceLock::new();
    L.get_or_init(|| RateLimiter::new(60, 60_000))
}

/// Ten presses a minute per person (`buttonPresses`).
fn button_presses() -> &'static RateLimiter {
    static L: OnceLock<RateLimiter> = OnceLock::new();
    L.get_or_init(|| RateLimiter::new(10, 60_000))
}

fn limited(limiter: &RateLimiter, key: &str) -> Result<(), Response> {
    let verdict = limiter.check(key, now_ms());
    if verdict.allowed {
        return Ok(());
    }
    let mut res = AppError::new("RATE_LIMIT_EXCEEDED").with("retry_after", json!(verdict.retry_after)).into_response();
    res.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(verdict.retry_after));
    Err(res)
}

fn clicker(ctx: &basedb_base::tx::RequestContext) -> String {
    ctx.actor.token_id.clone().unwrap_or_else(|| ctx.actor.id.clone())
}

pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let list = catalog::list_automations(&st, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": list.iter().map(|a| a.to_json()).collect::<Vec<Value>>() })))
}

pub async fn create(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let a = catalog::create_automation(&st, &ctx, &base_id, &body).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": a.to_json() })))
}

pub async fn update(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, id)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let a = catalog::update_automation(&st, &ctx, &base_id, &id, &body).await?;
    Ok(json_ok(json!({ "data": a.to_json() })))
}

pub async fn delete(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, id)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    catalog::delete_automation(&st, &ctx, &base_id, &id).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

pub async fn runs(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, id)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let runs = catalog::list_runs(&st, &ctx, &base_id, &id).await?;
    Ok(json_ok(json!({ "data": runs })))
}

/// `POST /api/v1/{tenant}/automations/{id}/run`.
pub async fn run(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, id)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let key = st.instance_key()?;
    let key = key.to_string();
    let body = lenient_json(&bytes);
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    if let Err(res) = limited(clicks(), &clicker(&ctx)) {
        return Ok(res);
    }
    let record = body.get("record").and_then(Value::as_str);
    let run = requests::request_run(&st, &ctx, &key, &id, record).await?;
    Ok(json_response(StatusCode::ACCEPTED, &json!({ "data": { "run": run } })))
}

/// `POST /api/v1/hooks/{secret}`.
pub async fn hook(State(st): State<Shared>, headers: HeaderMap, Path(secret): Path<String>, bytes: Bytes) -> ApiResult {
    if bytes.len() > requests::HOOK_BYTES {
        return Err(AppError::new("BODY_TOO_LARGE").with("maximum", json!(requests::HOOK_BYTES)));
    }
    if let Err(res) = limited(hook_calls(), &secret) {
        return Ok(res);
    }
    let kind = headers.get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("");
    let text = String::from_utf8_lossy(&bytes);
    let payload = requests::hook_payload(kind, &text);
    let run = requests::receive_hook(&st, &secret, &payload).await?;
    Ok(json_response(StatusCode::ACCEPTED, &json!({ "data": { "run": run } })))
}

/// `POST /api/v1/{tenant}/data/{base}/{table}/buttons/{button}/press`.
pub async fn press(
    State(st): State<Shared>,
    Extension(rid): Extension<RequestId>,
    headers: HeaderMap,
    uri: Uri,
    Path((tenant, base, table, button)): Path<(String, String, String, String)>,
    bytes: Bytes,
) -> ApiResult {
    let key = st.instance_key()?;
    let key = key.to_string();
    let body = lenient_json(&bytes);
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    if let Err(res) = limited(button_presses(), &clicker(&ctx)) {
        return Ok(res);
    }
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let records = body.get("records").and_then(Value::as_array).map(|a| a.iter().filter_map(|r| r.as_str().map(str::to_string)).collect());
    let filter = body.get("filter").and_then(Value::as_str).map(str::to_string);
    let runs = requests::press_button(&st, &ctx, &key, &t.table_id, &button, records, filter).await?;
    Ok(json_response(StatusCode::ACCEPTED, &json!({ "data": { "runs": runs } })))
}
