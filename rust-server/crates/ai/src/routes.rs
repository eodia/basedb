//! The routes of the AI domain (`app.ts`), each reading its body as Hono does.

use crate::attachments::{extract_attachment, read_attachments, MAX_ATTACHMENT_BYTES};
use crate::fields::{ai_field_status, ai_input_of, disable_ai_field, request_ai_sweep, run_ai_cell, set_ai_field};
use crate::schedule::{check_schedule, next_runs};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode, Uri};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::auth::routes::screen_language;
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError};
use basedb_base::time::iso;
use basedb_base::{RequestId, Shared};
use basedb_catalog::http::{fields as body_fields, strict_json};
use basedb_catalog::js::query_param;
use basedb_catalog::projection::{resolve_base, resolve_field, resolve_table};
use serde_json::{json, Value};

fn request_invalid(field: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field))
}

/// `POST /api/v1/{tenant}/ai/bases/{base}/expression`.
pub async fn expression(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let (Some(table), Some(request)) = (body.get("table").and_then(Value::as_str), body.get("request").and_then(Value::as_str)) else {
        return Err(request_invalid("table, request"));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, table).await?;
    let draft = crate::drafts::draft_expression(&st, &ctx, &t.table_id, request, body.get("previous_error")).await?;
    Ok(json_ok(json!({ "data": draft })))
}

/// `POST /api/v1/{tenant}/ai/bases/{base}/structure`.
pub async fn structure(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let Some(request) = body.get("request").and_then(Value::as_str).filter(|r| !crate::js::js_trim(r).is_empty()) else {
        return Err(request_invalid("request"));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let draft = crate::drafts::draft_structure(&st, &ctx, &base_id, request, &screen_language(&headers)).await?;
    Ok(json_ok(json!({ "data": draft })))
}

/// `POST /api/v1/{tenant}/admin/templates/draft`.
pub async fn template_draft(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let (Some(project), Some(request)) = (body.get("project").and_then(Value::as_str), body.get("request").and_then(Value::as_str)) else {
        return Err(request_invalid("project, request"));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let draft = crate::template_draft::draft_template(&st, &ctx, project, request, body.get("previous")).await?;
    Ok(json_ok(json!({ "data": draft })))
}

/// `POST /api/v1/{tenant}/ai/attachments?name=`: the body IS the file, bounded first.
pub async fn attachment(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>, body: axum::body::Body) -> ApiResult {
    let too_large = || AppError::new("BODY_TOO_LARGE").with("maximum", json!(MAX_ATTACHMENT_BYTES));
    let declared = headers.get(axum::http::header::CONTENT_LENGTH).and_then(|v| v.to_str().ok()).and_then(|v| v.trim().parse::<u64>().ok());
    if declared.is_some_and(|l| l > MAX_ATTACHMENT_BYTES as u64) {
        return Err(too_large());
    }
    let bytes = axum::body::to_bytes(body, MAX_ATTACHMENT_BYTES).await.map_err(|_| too_large())?;
    bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let read = extract_attachment(&query_param(&uri, "name").unwrap_or_default(), &bytes)?;
    Ok(json_ok(json!({ "data": read.to_json() })))
}

/// Node's check of a conversation's messages.
pub fn messages_of(body: &Value) -> Result<Vec<(String, String)>, AppError> {
    let invalid = || request_invalid("messages");
    let Some(items) = body.get("messages").and_then(Value::as_array) else { return Err(invalid()) };
    items
        .iter()
        .map(|m| match (m.get("role").and_then(Value::as_str), m.get("content").and_then(Value::as_str)) {
            (Some(role @ ("user" | "assistant")), Some(content)) if m.is_object() => Ok((role.to_string(), content.to_string())),
            _ => Err(invalid()),
        })
        .collect()
}

/// `POST /api/v1/{tenant}/ai/bases/{base}/copilot`.
pub async fn copilot(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let messages = messages_of(body)?;
    for key in ["table", "filter", "sort"] {
        if body.get(key).is_some_and(|v| !v.is_null() && !v.is_string()) {
            return Err(request_invalid(key));
        }
    }
    if body.get("read_data").is_some_and(|v| !v.is_boolean()) {
        return Err(request_invalid("read_data"));
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let table = match body.get("table").and_then(Value::as_str) {
        Some(t) if !t.is_empty() => Some(resolve_table(&st.pools, &ctx, &base, t).await?.table_id),
        _ => None,
    };
    let text = |k: &str| body.get(k).and_then(Value::as_str).map(str::to_string);
    let request = crate::copilot::CopilotRequest {
        base_id,
        table_id: table,
        filter: text("filter"),
        sort: text("sort"),
        messages,
        read_data: body.get("read_data") == Some(&Value::Bool(true)),
        language: screen_language(&headers),
        attachments: read_attachments(body.get("attachments"))?,
    };
    let answer = crate::copilot::copilot(&st, &ctx, request).await?;
    Ok(json_ok(json!({ "data": answer })))
}

/// `GET|PUT|DELETE …/fields/{field}/ai`.
pub async fn field_status(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    Ok(json_ok(json!({ "data": ai_field_status(&st, &ctx, &f.field_id).await? })))
}

pub async fn set_field(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let input = ai_input_of(&body)?;
    if body.get("recompute").is_some_and(|v| !v.is_boolean()) {
        return Err(request_invalid("recompute"));
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    let status = set_ai_field(&st, &ctx, &f.field_id, &input, body.get("recompute") == Some(&Value::Bool(true))).await?;
    Ok(json_ok(json!({ "data": status })))
}

pub async fn disable_field(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    disable_ai_field(&st, &ctx, &f.field_id).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

/// `POST …/fields/{field}/ai/run` — a body that is not JSON reads as no record.
pub async fn run_field(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body: Value = serde_json::from_slice(&bytes).unwrap_or_else(|_| json!({}));
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'record')"));
    }
    let record = match body.get("record") {
        None => None,
        Some(Value::String(r)) => Some(r.clone()),
        Some(_) => return Err(request_invalid("record")),
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    match record {
        None => {
            request_ai_sweep(&st, &ctx, &f.field_id).await?;
            Ok(json_response(StatusCode::ACCEPTED, &json!({ "data": { "scheduled": true } })))
        }
        Some(record) => {
            let value = run_ai_cell(&st, &ctx, &f.field_id, &record).await?;
            Ok(json_ok(json!({ "data": { "record": record, "value": value } })))
        }
    }
}

/// `POST /api/v1/{tenant}/ai/schedule/preview` — nothing read, nothing written.
pub async fn schedule_preview(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let Some(cron) = body.get("cron").and_then(Value::as_str) else { return Err(request_invalid("cron")) };
    let timezone = match body.get("timezone") {
        None => "UTC",
        Some(Value::String(t)) => t.as_str(),
        Some(_) => return Err(request_invalid("timezone")),
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let timezone = crate::js::js_trim(timezone);
    let timezone = if timezone.is_empty() { "UTC" } else { timezone };
    let (parsed, tz) = check_schedule(cron, timezone, ctx.timestamp)?;
    let runs: Vec<String> = next_runs(&parsed, tz, ctx.timestamp, 5).into_iter().map(iso).collect();
    Ok(json_ok(json!({ "data": { "runs": runs } })))
}
