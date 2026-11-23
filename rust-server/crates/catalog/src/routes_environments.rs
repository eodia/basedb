//! The routes of the environments (`app.ts`, chapter 14): adding one, comparing them,
//! the structure plan and its application, and the synchronization of rows.

use crate::environments::{apply_planned, compare_environments, load_plan, needs_ai_crate, plan_structure, source_has_ai};
use crate::http::{fields, strict_json};
use crate::js::query_param;
use crate::projection::resolve_base;
use crate::{env_rows, family};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode, Uri};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::error::{json_ok, json_response, ApiResult, AppError};
use basedb_base::tx::RequestContext;
use basedb_base::{RequestId, Shared};
use serde_json::{json, Value};

/// `environmentOf`: the base an environment parameter names — a body key or a query parameter.
async fn environment_of(st: &Shared, ctx: &RequestContext, name: Option<&Value>, field: &str) -> Result<String, AppError> {
    match name.and_then(Value::as_str) {
        Some(name) if !name.is_empty() => Ok(resolve_base(&st.pools, ctx, name).await?.0),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!(field))),
    }
}

fn query_value(uri: &Uri, name: &str) -> Option<Value> {
    query_param(uri, name).map(Value::String)
}

pub async fn create_environment(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let Some(environment) = body.get("environment").and_then(Value::as_str) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("environment")));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let source = match body.get("source") {
        None => None,
        Some(v) => Some(environment_of(&st, &ctx, Some(v), "source").await?),
    };
    let consent = body.get("consent") == Some(&Value::Bool(true));
    // Carrying an AI field with consent is the AI crate's, which `basedb-server` always installs.
    if consent && crate::ai_hooks::ai_hooks().is_none() && source_has_ai(&st.pools, &ctx, &base_id, source.as_deref()).await? {
        return Err(AppError::internal("environnement : le crate ai n'est pas installé"));
    }
    let (created, source_id) = family::create_environment_base(&st.pools, &ctx, &base_id, environment, source.as_deref()).await?;
    let planned = load_plan(&st.pools, &ctx, &source_id, &created.id).await?;
    let report = apply_planned(&st.pools, &ctx, planned, None, consent, true).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": { "environment": created.to_json(), "report": report } })))
}

pub async fn compare(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    Ok(json_ok(json!({ "data": compare_environments(&st.pools, &ctx, &base_id).await? })))
}

pub async fn plan(State(st): State<Shared>, Extension(rid): Extension<RequestId>, uri: Uri, headers: HeaderMap, Path((tenant, _base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let source = environment_of(&st, &ctx, query_value(&uri, "source").as_ref(), "source").await?;
    let target = environment_of(&st, &ctx, query_value(&uri, "target").as_ref(), "target").await?;
    Ok(json_ok(json!({ "data": plan_structure(&st.pools, &ctx, &source, &target).await? })))
}

pub async fn apply(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, _base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let steps = match body.get("steps") {
        Some(Value::Array(items)) if items.iter().all(Value::is_string) => items.iter().filter_map(|s| s.as_str().map(str::to_string)).collect::<Vec<_>>(),
        _ => return Err(AppError::new("REQUEST_INVALID").with("field", json!("steps"))),
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let source = environment_of(&st, &ctx, body.get("source"), "source").await?;
    let target = environment_of(&st, &ctx, body.get("target"), "target").await?;
    let consent = body.get("consent") == Some(&Value::Bool(true));
    let planned = load_plan(&st.pools, &ctx, &source, &target).await?;
    if needs_ai_crate(&planned, Some(&steps), consent) {
        return Err(AppError::internal("environnement : le crate ai n'est pas installé"));
    }
    Ok(json_ok(json!({ "data": apply_planned(&st.pools, &ctx, planned, Some(&steps), consent, false).await? })))
}

pub async fn count_rows(State(st): State<Shared>, Extension(rid): Extension<RequestId>, uri: Uri, headers: HeaderMap, Path((tenant, _base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let source = environment_of(&st, &ctx, query_value(&uri, "source").as_ref(), "source").await?;
    let target = environment_of(&st, &ctx, query_value(&uri, "target").as_ref(), "target").await?;
    Ok(json_ok(json!({ "data": env_rows::count_rows(&st.pools, &ctx, &source, &target).await? })))
}

pub async fn compare_rows(State(st): State<Shared>, Extension(rid): Extension<RequestId>, uri: Uri, headers: HeaderMap, Path((tenant, _base, table)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let source = environment_of(&st, &ctx, query_value(&uri, "source").as_ref(), "source").await?;
    let target = environment_of(&st, &ctx, query_value(&uri, "target").as_ref(), "target").await?;
    Ok(json_ok(json!({ "data": env_rows::compare_rows(&st.pools, &ctx, &source, &target, &table).await? })))
}

pub async fn sync_rows(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, _base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let source = environment_of(&st, &ctx, body.get("source"), "source").await?;
    let target = environment_of(&st, &ctx, body.get("target"), "target").await?;
    let flag = |k: &str| body.get(k) == Some(&Value::Bool(true));
    let result = env_rows::sync_rows(&st.pools, &ctx, &source, &target, &table, flag("insert"), flag("update"), flag("delete")).await?;
    Ok(json_ok(json!({ "data": result })))
}
