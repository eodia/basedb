//! The document routes of `app.ts`: a row as a PDF, a definition seen before it is saved,
//! the templates of a table read and built.

use super::render::{render_document, DocumentRequest};
use super::templates::{create_template, delete_template, list_templates, update_template};
use axum::body::{Body, Bytes};
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode, Uri};
use axum::response::Response;
use axum::Extension;
use basedb_base::auth::{bearer_context, data_context};
use basedb_base::error::{empty, json_ok, json_response, ApiResult};
use basedb_base::{RequestId, Shared};
use basedb_catalog::http::{fields as body_fields, strict_json};
use basedb_catalog::js::{encode_uri_component, query_param};
use basedb_catalog::projection::resolve_table;
use serde_json::{json, Value};

/// `disposition` of `app.ts` (RFC 6266): `filename*` as typed, `filename` an ASCII stand-in.
pub fn disposition(kind: &str, name: &str) -> String {
    let ascii: String = name
        .encode_utf16()
        .map(|u| match u {
            0x22 | 0x5c => '_',
            0x20..=0x7e => u as u8 as char,
            _ => '_',
        })
        .collect();
    let encoded = encode_uri_component(name).replace('\'', "%27").replace('(', "%28").replace(')', "%29").replace('*', "%2A");
    format!("{kind}; filename=\"{ascii}\"; filename*=UTF-8''{encoded}")
}

fn pdf(bytes: Vec<u8>, disposition: String) -> Response {
    let length = bytes.len();
    let mut response = Response::new(Body::from(bytes));
    let h = response.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/pdf"));
    h.insert(header::CONTENT_LENGTH, HeaderValue::from(length));
    if let Ok(v) = HeaderValue::from_str(&disposition) {
        h.insert(header::CONTENT_DISPOSITION, v);
    }
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("private, no-store"));
    h.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    response
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/documents`: the templates' names to whoever
/// reads the table, their definitions too to whoever builds it.
pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table)): Path<(String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let templates = list_templates(&st, &ctx, &t.table_id).await?;
    Ok(json_ok(json!({ "data": templates.iter().map(|t| t.to_json()).collect::<Vec<_>>() })))
}

#[allow(clippy::too_many_arguments)]
async fn document_of(st: &Shared, rid: &RequestId, headers: &HeaderMap, uri: &Uri, tenant: &str, base: &str, table: &str, id: &str, template: &str) -> ApiResult {
    let ctx = data_context(st, headers, uri, rid, Some(tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, base, table).await?;
    let template = template.strip_suffix(".pdf").unwrap_or(template);
    let request = DocumentRequest {
        table_id: t.table_id,
        record_id: id.to_string(),
        template_id: (template != "fiche").then(|| template.to_string()),
        draft: None,
    };
    let document = render_document(st, &ctx, &request).await?;
    let kind = if query_param(uri, "download").as_deref() == Some("1") { "attachment" } else { "inline" };
    Ok(pdf(document.bytes, disposition(kind, &document.filename)))
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/{id}/documents/{template}`: with a template, or
/// `fiche` — every field the caller reads.
pub async fn document(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id, template)): Path<(String, String, String, String, String)>) -> ApiResult {
    document_of(&st, &rid, &headers, &uri, &tenant, &base, &table, &id, &template).await
}

/// `GET …/{id}/documents/preview`: Node reads `preview` as a template's identifier.
pub async fn preview_get(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>) -> ApiResult {
    document_of(&st, &rid, &headers, &uri, &tenant, &base, &table, &id, "preview").await
}

/// `POST …/{id}/documents/preview`: a definition not saved yet, set on a row.
pub async fn preview(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let request = DocumentRequest {
        table_id: t.table_id,
        record_id: id,
        template_id: None,
        draft: Some((body.get("label").cloned(), body.get("spec").cloned())),
    };
    let document = render_document(&st, &ctx, &request).await?;
    Ok(pdf(document.bytes, disposition("inline", &document.filename)))
}

/// `POST /api/v1/{tenant}/admin/bases/{base}/tables/{table}/documents`: 201.
pub async fn create(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let created = create_template(&st, &ctx, &t.table_id, body.get("label").cloned(), body.get("spec").cloned()).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": created.to_json() })))
}

/// `PATCH …/documents/{id}`: what is given is changed.
pub async fn update(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, id)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let label: Option<Value> = body.get("label").cloned();
    let updated = update_template(&st, &ctx, &t.table_id, &id, label, body.get("spec").cloned()).await?;
    Ok(json_ok(json!({ "data": updated.to_json() })))
}

/// `DELETE …/documents/{id}`: 204.
pub async fn delete(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, id)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    delete_template(&st, &ctx, &t.table_id, &id).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

#[cfg(test)]
mod tests {
    #[test]
    fn disposition_as_node() {
        assert_eq!(super::disposition("inline", "Fiche — l'été (1).pdf"), "inline; filename=\"Fiche _ l'_t_ (1).pdf\"; filename*=UTF-8''Fiche%20%E2%80%94%20l%27%C3%A9t%C3%A9%20%281%29.pdf");
    }
}
