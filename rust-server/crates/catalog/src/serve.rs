//! Serving the catalog documents with their validator (`catalog/serve.ts`, and the `/meta`
//! routes of `app.ts`). The `304` is served WITHOUT building the document.

use crate::cache::{etag_for, DOCUMENT_CACHE, DOCUMENT_MAX_BYTES};
use crate::formula::{formula_dialect, FormulaDialect};
use crate::js::{js_length, js_order};
use crate::meta::{to_base_list, to_meta};
use crate::projection::{of_environment, project, reference_in, snapshot, VisibleBase};
use basedb_base::auth::data_context;
use basedb_base::auth::routes::screen_language;
use basedb_base::db::Pools;
use basedb_base::error::{empty, ApiResult, AppError};
use basedb_base::tx::RequestContext;
use basedb_base::{RequestId, Shared};
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode, Uri};
use axum::response::Response;
use axum::Extension;
use serde_json::{json, Value};
use std::sync::Arc;

pub const CACHE_CONTROL: &str = "private, max-age=0, must-revalidate";
pub const VARY: &str = "Authorization, Accept-Encoding, X-Basedb-Locale, Accept-Language, X-Basedb-Environment";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetaKind {
    Bases,
    Meta,
    OpenApi,
    Doc,
}

impl MetaKind {
    fn etag_kind(self) -> &'static str {
        match self {
            MetaKind::Bases | MetaKind::Meta => "meta",
            MetaKind::OpenApi => "openapi",
            MetaKind::Doc => "doc",
        }
    }
}

pub struct ServedMeta {
    pub etag: String,
    pub not_modified: bool,
    /// The serialized document; absent on a `304`.
    pub body: Option<Arc<String>>,
}

fn matches(if_none_match: &str, etag: &str) -> bool {
    if if_none_match.trim() == "*" {
        return true;
    }
    if_none_match.split(',').map(|c| c.trim()).map(|c| c.strip_prefix("W/").unwrap_or(c)).any(|c| c == etag)
}

/// `serveMeta`.
pub async fn serve_meta(pools: &Pools, ctx: &RequestContext, kind: MetaKind, reference: &str, if_none_match: Option<&str>, language: &str) -> Result<ServedMeta, AppError> {
    let s = snapshot(pools, ctx).await?;
    let dialect = formula_dialect(language);
    let place = match &ctx.environment {
        None => reference.to_string(),
        Some(e) => format!("{reference}@{e}"),
    };
    let keyed = match kind {
        MetaKind::Doc => format!("{place}|{language}"),
        MetaKind::Meta => format!("{place}|{}", if dialect == FormulaDialect::Fr { "fr" } else { "en" }),
        _ => place,
    };
    let etag = etag_for(ctx, &s.versions, &s.grants, kind.etag_kind(), &keyed);

    if if_none_match.is_some_and(|v| matches(v, &etag)) {
        return Ok(ServedMeta { etag, not_modified: true, body: None });
    }
    if let Some(cached) = DOCUMENT_CACHE.get(&etag, &s.versions) {
        return Ok(ServedMeta { etag, not_modified: false, body: Some(cached) });
    }

    let bases = of_environment(ctx, &s.raw.bases, project(ctx, &s.grants, &s.raw, dialect), |b| &b.id);
    let body: Value = if kind == MetaKind::Bases {
        to_base_list(&bases.iter().map(VisibleBase::of).collect::<Vec<_>>())
    } else {
        let r = reference_in(ctx, &s.raw.bases, reference)?;
        let Some(found) = bases.iter().find(|b| b.name == r || b.id == r) else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(reference)));
        };
        match kind {
            MetaKind::OpenApi => crate::openapi::to_openapi(found, &ctx.tenant_id),
            MetaKind::Doc => crate::documentation::to_documentation(found, &ctx.tenant_id, language),
            _ => to_meta(found),
        }
    };
    let serialized = serde_json::to_string(&js_order(body)).map_err(AppError::internal)?;
    if js_length(&serialized) > DOCUMENT_MAX_BYTES {
        return Err(AppError::new("REQUEST_INVALID")
            .with("parameter", json!("tables"))
            .with("hint", json!("Base trop volumineuse pour être décrite en une fois : précisez ?tables=<liste>."))
            .with("maximum_bytes", json!(DOCUMENT_MAX_BYTES)));
    }
    let serialized = Arc::new(serialized);
    DOCUMENT_CACHE.set(&etag, &s.versions, serialized.clone());
    Ok(ServedMeta { etag, not_modified: false, body: Some(serialized) })
}

fn json_bytes(body: String) -> Response {
    let mut res = Response::new(axum::body::Body::from(body));
    res.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    res
}

async fn respond(st: Shared, rid: RequestId, headers: HeaderMap, uri: Uri, tenant: String, kind: MetaKind, reference: String) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let if_none_match = headers.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok());
    let served = serve_meta(&st.pools, &ctx, kind, &reference, if_none_match, &screen_language(&headers)).await?;
    let mut res = match (&served.body, served.not_modified) {
        (Some(body), false) if kind == MetaKind::OpenApi => {
            if st.cfg.base_path.is_empty() {
                json_bytes(body.to_string())
            } else {
                let mut contract: Value = serde_json::from_str(body).map_err(AppError::internal)?;
                if let Some(Value::Array(servers)) = contract.get_mut("servers") {
                    for server in servers {
                        if let Some(url) = server.get("url").and_then(Value::as_str) {
                            server["url"] = json!(format!("{}{url}", st.cfg.base_path));
                        }
                    }
                }
                json_bytes(serde_json::to_string(&contract).map_err(AppError::internal)?)
            }
        }
        (Some(body), false) => json_bytes(format!("{{\"data\":{body}}}")),
        _ => empty(StatusCode::NOT_MODIFIED),
    };
    let h = res.headers_mut();
    h.insert(header::ETAG, HeaderValue::from_str(&served.etag).map_err(AppError::internal)?);
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_CONTROL));
    h.insert(header::VARY, HeaderValue::from_static(VARY));
    Ok(res)
}

pub async fn list_bases(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>) -> ApiResult {
    respond(st, rid, headers, uri, tenant, MetaKind::Bases, String::new()).await
}

pub async fn base_meta(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    respond(st, rid, headers, uri, tenant, MetaKind::Meta, base).await
}

pub async fn base_openapi(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    respond(st, rid, headers, uri, tenant, MetaKind::OpenApi, base).await
}

pub async fn base_doc(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    respond(st, rid, headers, uri, tenant, MetaKind::Doc, base).await
}
