//! The routes of the migration engine: deletions, restore, resume, environments (`app.ts`).

use crate::http::{fields, strict_json};
use crate::projection::{resolve_base, resolve_field, resolve_table};
use crate::{deletion, engine, family, purge};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::error::{json_ok, json_response, ApiResult, AppError};
use basedb_base::{RequestId, Shared};
use serde_json::json;

pub async fn delete_base(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let m = deletion::delete_base(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": m.to_json() })))
}

pub async fn restore_base(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let m = deletion::restore_base(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": m.to_json() })))
}

pub async fn table_deletion(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    Ok(json_ok(json!({ "data": deletion::preview_table_deletion(&st.pools, &ctx, &t.table_id).await? })))
}

pub async fn delete_table(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let m = deletion::delete_table(&st.pools, &ctx, &t.table_id).await?;
    Ok(json_ok(json!({ "data": m.to_json() })))
}

pub async fn field_deletion(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    Ok(json_ok(json!({ "data": deletion::preview_field_deletion(&st.pools, &ctx, &f.field_id).await? })))
}

pub async fn delete_field(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    let m = deletion::delete_field(&st.pools, &ctx, &f.field_id).await?;
    Ok(json_ok(json!({ "data": m.to_json() })))
}

pub async fn resume_migration(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let m = engine::apply(&st.pools, &ctx, &id).await?;
    Ok(json_ok(json!({ "data": m.to_json() })))
}

// ------------------------------------------------------------------------------------
// Environments.

pub async fn list_environments(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    Ok(json_ok(json!({ "data": family::list_environments(&st.pools, &ctx, &base_id).await?.to_json() })))
}

pub async fn rename_environment(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, _base, env)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let Some(environment) = body.get("environment").and_then(|v| v.as_str()) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("environment")));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &env).await?;
    Ok(json_ok(json!({ "data": family::rename_environment(&st.pools, &ctx, &base_id, environment).await? })))
}

pub async fn delete_environment(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, _base, env)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &env).await?;
    family::assert_deletable_environment(&st.pools, &ctx, &base_id).await?;
    let m = deletion::delete_one_base(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": m.to_json() })))
}

// ------------------------------------------------------------------------------------
// The purge.

/// `purgeKind` of `app.ts`.
fn purge_kind(value: Option<&serde_json::Value>) -> Result<purge::Kind, AppError> {
    match value.and_then(|v| v.as_str()) {
        Some("base") => Ok(purge::Kind::Base),
        Some("table") => Ok(purge::Kind::Table),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!("kind"))),
    }
}

pub async fn purge_export(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let Some(id) = body.get("id").and_then(|v| v.as_str()) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("id")));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let kind = purge_kind(body.get("kind"))?;
    let dir = purge::export_dir(&st.cfg);
    let exported = purge::export_for_purge(&st.pools, &ctx, &dir, kind, id).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": exported })))
}

pub async fn purge(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let text = |k: &str| body.get(k).and_then(|v| v.as_str());
    let (Some(id), Some(export_id), Some(confirm)) = (text("id"), text("export"), text("confirm")) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("id, export, confirm")));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let kind = purge_kind(body.get("kind"))?;
    let early_justification = text("early_justification").filter(|j| !crate::description::js_trim(j).is_empty());
    let req = purge::PurgeRequest { kind, id, export_id, confirm, early_justification };
    let (purged_tables, residual_schema, migration) = purge::purge(&st.pools, &ctx, &req).await?;
    Ok(json_ok(json!({ "data": { "purged_tables": purged_tables, "residual_schema": residual_schema, "migration": migration.to_json() } })))
}
