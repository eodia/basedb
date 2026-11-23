//! Les enregistrements : lecture, écriture, filtres, lots, historique, fichiers, géo, formulaires,
//! collaboration, analyses, exports (`core/src/records`, `formula`, `history`, `files`, `geo`,
//! `forms`, `collab`, `analytics`).
//!
//! Tout est natif, sauf `…/documents` (crate `ai`) : voir `rust-server/NOTES.md`,
//! « Crate records ». Le routeur installe aussi le compilateur des règles de lignes.

// `AppError` (crate base) is the error of every domain: its size is shared, not this crate's.
#![allow(clippy::result_large_err)]

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Extension, Router};
use basedb_base::auth::{bearer_context, data_context};
use basedb_base::error::{json_ok, ApiResult, AppError};
use basedb_base::layers::RequestId;
use basedb_base::Shared;
use basedb_catalog::js::{js_to_number, query_param};
use basedb_catalog::projection::resolve_table;
use serde_json::{json, Map, Value};

pub mod aggregate;
pub mod analytics;
pub mod collab;
mod computed;
mod cursor;
mod display;
pub mod drain;
mod entities;
mod expand;
pub mod export;
mod files;
pub mod forms;
pub mod filter;
pub mod geo;
pub mod history;
pub mod html;
pub mod js;
pub mod list;
pub mod notifications;
mod pg;
pub mod quiz;
mod sealing;
pub mod storage;
pub mod sync_rows;
pub mod values;
mod variables;
pub mod write;

pub use list::{list_records, ListOptions, ListResult};
/// For the automations' « document » step, which deposits its PDF in a file field.
pub use files::{link_key, upload_file, DEFAULT_MAX_FILE_BYTES};

/// The records' loops, when this server runs the background (unless `BASEDB_RUST_BACKGROUND=0`, as
/// `basedb_admin::start_background`): the history drain, every 2 s and on `basedb_drain`.
pub fn start_background(st: &Shared) -> Vec<tokio::task::JoinHandle<()>> {
    if !st.cfg.background() {
        return Vec::new();
    }
    let listener = basedb_base::listener::Listener::new(&st.cfg.database_url, &[drain::DRAIN_CHANNEL]);
    let handle = drain::start_drain_loop(st.pools.clone(), Some(&listener));
    listener.start();
    vec![handle]
}

/// The domain's native routes; merged by `basedb-server` (`main.rs`). Registers the row-rule
/// compiler every crate's decider relies on.
pub fn router(_st: &Shared) -> Router<Shared> {
    basedb_base::rbac::rows::set_row_rule_compiler(filter::compile_row_rule);
    let data = "/api/v1/{tenant}/data";
    Router::new()
        .route(&format!("{data}/{{base}}/{{table}}"), get(list_route).post(create_route))
        .route(&format!("{data}/{{base}}/{{table}}/{{id}}"), get(get_route).post(batch_route).patch(update_route).delete(delete_route))
        .route(&format!("{data}/{{base}}/{{table}}/{{id}}/referenced_by"), get(referenced_by_route))
        .route(&format!("{data}/{{base}}/{{table}}/{{id}}/history"), get(record_history_route))
        .route("/api/v1/{tenant}/meta/bases/{base}/history", get(base_history_route))
        .route("/api/v1/{tenant}/history/undo", post(undo_route))
        .route("/api/v1/{tenant}/history/{revision}/revert", post(revert_route))
        .route("/api/v1/{tenant}/history/{revision}/restore", post(restore_route))
        .route(&format!("{data}/{{base}}/{{table}}/{{id}}/comments"), get(comments_route).post(add_comment_route))
        .route("/api/v1/{tenant}/comments/{comment}", axum::routing::patch(edit_comment_route).delete(delete_comment_route))
        .route("/api/v1/{tenant}/presence", post(presence_route))
        .route("/api/v1/{tenant}/presence/pointer", post(pointer_route))
        .route("/api/v1/{tenant}/events", get(events_route))
        .route("/api/v1/{tenant}/me/notifications", get(notifications_route))
        .route("/api/v1/{tenant}/me/notifications/read", post(mark_read_route))
        .route("/api/v1/{tenant}/files/{base}/{table}/{field}", post(upload_route))
        .route("/api/v1/{tenant}/files/{id}/{name}", get(download_route))
        .route("/api/v1/{tenant}/geo/geocode", post(geocode_route))
        .route("/api/v1/{tenant}/geo/search", get(geo_search_route))
        .route(SHARE_ROUTE, get(share_get_route).put(share_put_route).delete(share_delete_route))
        .route(&format!("{SHARE_ROUTE}/regenerate"), post(share_regenerate_route))
        .route("/api/v1/views/{token}", get(view_route))
        .route("/api/v1/views/{token}/rows", get(view_rows_route))
        .route("/api/v1/views/{token}/calendar.ics", get(calendar_route))
        .route("/api/v1/forms/{token}", get(form_route).post(answer_route))
        .route("/api/v1/forms/{token}/check", post(check_route))
        .route("/api/v1/{tenant}/query/{base}", post(query_route))
}

/// `POST /api/v1/{tenant}/query/{base}`: a question, saved or given whole, run with the
/// caller's rights, narrowed by `constraints`.
async fn query_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = json_body(&bytes)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base).await?;
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'question')"));
    }
    let question = body.get("question").and_then(Value::as_str);
    let query = body.get("query").filter(|q| q.is_object() || q.is_array());
    if question.is_none() && query.is_none() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("query")));
    }
    let week_start = if body.get("week_start").and_then(Value::as_f64) == Some(0.0) { 0 } else { 1 };
    let result = analytics::run_question(
        &st,
        &ctx,
        &base_id,
        question,
        if question.is_some() { None } else { query },
        body.get("constraints"),
        body.get("timezone").and_then(Value::as_str),
        week_start,
    )
    .await?;
    Ok(json_ok(json!({ "data": result })))
}

fn links_id(uri: &Uri) -> bool {
    query_param(uri, "links").as_deref() == Some("id")
}

fn variables_raw(uri: &Uri) -> bool {
    query_param(uri, "variables").as_deref() == Some("raw")
}

/// `listRecords` behind the kernel's wrapper: the file columns carry signed links.
async fn list_linked(st: &Shared, ctx: &basedb_base::tx::RequestContext, key: &str, options: &ListOptions) -> Result<ListResult, AppError> {
    let mut result = list_records(&st.pools, ctx, key, options).await?;
    if !result.file_columns.is_empty() {
        let rows = std::mem::take(&mut result.rows);
        result.rows = files::with_file_links(&files::link_key(key), &ctx.tenant_id, ctx.timestamp, rows, &result.file_columns);
    }
    Ok(result)
}

/// `GET /api/v1/{tenant}/data/{base}/{table}`.
async fn list_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table)): Path<(String, String, String)>) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = key.to_string();
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let options = ListOptions {
        table_id: t.table_id.clone(),
        limit: query_param(&uri, "limit").map(|l| js_to_number(&l)),
        after: query_param(&uri, "after"),
        count_exact: query_param(&uri, "count").as_deref() == Some("exact"),
        filter: query_param(&uri, "filter"),
        sort: query_param(&uri, "sort"),
        links_id: links_id(&uri),
        expand: query_param(&uri, "expand"),
        select: None,
        variables_raw: variables_raw(&uri),
    };
    let r = list_linked(&st, &ctx, &key, &options).await?;
    let mut meta = Map::new();
    meta.insert("columns".into(), json!(r.columns));
    meta.insert("sql".into(), json!(r.sql));
    meta.insert("link_sql".into(), json!(r.link_sql));
    meta.insert("has_next_page".into(), json!(r.has_next_page));
    meta.insert("next_cursor".into(), json!(r.next_cursor));
    meta.insert("count".into(), json!(r.total));
    meta.insert("count_is_capped".into(), json!(r.total_capped));
    Ok(json_ok(json!({ "data": r.rows, "included": r.included, "meta": meta })).into_response())
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/{id}` — and the static routes declared before it.
async fn get_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>) -> Result<Response, AppError> {
    match id.as_str() {
        // The document templates are the `ai` crate's, on a static route of its own.
        "documents" => return Ok(basedb_base::app::not_found().await),
        "export" => return export_route(&st, &rid, &headers, &uri, &tenant, &base, &table).await,
        "deleted" => return deleted_route(&st, &rid, &headers, &uri, &tenant, &base, &table).await,
        "aggregate" => return aggregate_route(&st, &rid, &headers, &uri, &tenant, &base, &table).await,
        _ => {}
    }
    let key = st.instance_key()?;
    let key = key.to_string();
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    if !basedb_base::time::is_uuid(&id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(id)));
    }
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let options = ListOptions {
        table_id: t.table_id.clone(),
        limit: Some(1.0),
        filter: Some(format!("_id eq \"{}\"", id.to_lowercase())),
        links_id: links_id(&uri),
        expand: query_param(&uri, "expand"),
        variables_raw: variables_raw(&uri),
        ..Default::default()
    };
    let mut r = list_linked(&st, &ctx, &key, &options).await?;
    if r.rows.is_empty() {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(id)));
    }
    let row = r.rows.swap_remove(0);
    Ok(json_ok(json!({ "data": row, "included": r.included, "meta": { "sql": r.sql } })).into_response())
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/export` (`export-route.ts`): a whole table, or a
/// whole view, as a file streamed page after page.
async fn export_route(st: &Shared, rid: &RequestId, headers: &HeaderMap, uri: &Uri, tenant: &str, base: &str, table: &str) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = key.to_string();
    let ctx = data_context(st, headers, uri, rid, Some(tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, base, table).await?;
    let format = query_param(uri, "format").unwrap_or_default();
    if !export::FORMATS.contains(&format.as_str()) {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("format")));
    }
    let label = match query_param(uri, "headers").as_deref() {
        None | Some("name") => false,
        Some("label") => true,
        Some(_) => return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("headers"))),
    };
    let fields = query_param(uri, "fields").unwrap_or_default().split(',').map(|f| js::js_trim(f).to_string()).filter(|f| !f.is_empty()).collect();
    let options = export::ExportOptions { table_id: t.table_id.clone(), format, headers_label: label, filter: query_param(uri, "filter"), sort: query_param(uri, "sort"), fields };
    export::export_response(&st.pools, &ctx, &key, options, export::ceiling_of(st.cfg.setting("BASEDB_EXPORT_MAX_ROWS"))).await
}

/// `c.req.json()`: a body that is not JSON is an incident, as in Node.
fn json_body(bytes: &Bytes) -> Result<Value, AppError> {
    serde_json::from_slice(bytes).map_err(|e| AppError::internal(format!("corps JSON invalide : {e}")))
}

/// `body.values ?? {}` — `body` null is Node's `TypeError`.
fn body_values(body: &Value) -> Result<values::Entries, AppError> {
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'values')"));
    }
    Ok(match body.get("values") {
        None | Some(Value::Null) => Vec::new(),
        Some(v) => values::entries_of(v),
    })
}

fn transaction_header(mut res: Response, xact: &str) -> Response {
    if let Ok(v) = axum::http::HeaderValue::from_str(xact) {
        res.headers_mut().insert("x-basedb-transaction", v);
    }
    res
}

/// The written row as the kernel hands it back: its files with their links.
fn linked_row(key: &str, ctx: &basedb_base::tx::RequestContext, w: write::Written) -> Value {
    let row = if w.file_columns.is_empty() {
        w.row
    } else {
        files::with_file_links(&files::link_key(key), &ctx.tenant_id, ctx.timestamp, vec![w.row], &w.file_columns).swap_remove(0)
    };
    Value::Object(row)
}

/// `POST /api/v1/{tenant}/data/{base}/{table}`.
async fn create_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = key.to_string();
    let body = json_body(&bytes)?;
    let values = body_values(&body)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let w = write::create_record(&st.pools, &ctx, &t.table_id, values).await?;
    let xact = w.xact.clone();
    let res = basedb_base::error::json_response(axum::http::StatusCode::CREATED, &json!({ "data": linked_row(&key, &ctx, w) }));
    Ok(transaction_header(res, &xact))
}

fn batch_invalid(index: usize, reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("operations")).with("index", json!(index)).with("reason", json!(reason))
}

/// `POST /api/v1/{tenant}/data/{base}/{table}/batch` — `create` or `update` operations,
/// one kind per batch, all or nothing. Any other `POST …/{id}` is no route: Hono's `404`.
async fn batch_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>, bytes: Bytes) -> Result<Response, AppError> {
    if id != "batch" {
        return Ok(basedb_base::app::not_found().await);
    }
    let body = json_body(&bytes)?;
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'operations')"));
    }
    let Some(Value::Array(operations)) = body.get("operations") else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("operations")));
    };
    if !matches!(body.get("atomic"), None | Some(Value::Bool(true))) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("atomic")).with("reason", json!("seul_atomique_est_pris_en_charge")));
    }
    let kind = operations.first().and_then(|o| o.get("op")).and_then(Value::as_str).map(str::to_string);
    let mut records: Vec<Value> = Vec::new();
    let mut updates: Vec<(String, Value)> = Vec::new();
    for (index, operation) in operations.iter().enumerate() {
        let field = |k: &str| operation.as_object().and_then(|m| m.get(k));
        let op = field("op").and_then(Value::as_str);
        if !matches!(op, Some("create" | "update")) {
            return Err(batch_invalid(index, "seuls_create_et_update_sont_pris_en_charge"));
        }
        if op.map(str::to_string) != kind {
            return Err(batch_invalid(index, "un_seul_genre_d_operation_par_lot"));
        }
        let Some(data @ Value::Object(_)) = field("data") else { return Err(batch_invalid(index, "data_attendu")) };
        if op == Some("create") {
            records.push(data.clone());
            continue;
        }
        let Some(record) = field("id").and_then(Value::as_str).filter(|s| !s.is_empty()) else { return Err(batch_invalid(index, "id_attendu")) };
        if field("if_match").is_some() {
            return Err(batch_invalid(index, "if_match_n_est_pas_pris_en_charge"));
        }
        updates.push((record.to_string(), data.clone()));
    }
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let (status, r) = if kind.as_deref() == Some("update") {
        ("updated", write::update_records(&st.pools, &ctx, &t.table_id, updates).await?)
    } else {
        ("created", write::create_records(&st.pools, &ctx, &t.table_id, records).await?)
    };
    let n = r.ids.len();
    let results: Vec<Value> = r.ids.iter().enumerate().map(|(index, id)| json!({ "index": index, "status": status, "id": id })).collect();
    let (created, updated) = if status == "updated" { (0, n) } else { (n, 0) };
    let res = json_ok(json!({
        "atomic": true,
        "results": results,
        "summary": { "created": created, "updated": updated, "deleted": 0, "failed": 0 },
    }));
    Ok(transaction_header(res, &r.xact))
}

/// `PATCH /api/v1/{tenant}/data/{base}/{table}/{id}`.
async fn update_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>, bytes: Bytes) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = key.to_string();
    let body = json_body(&bytes)?;
    let values = body_values(&body)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let w = write::update_record(&st.pools, &ctx, &t.table_id, &id, values).await?;
    let xact = w.xact.clone();
    Ok(transaction_header(json_ok(json!({ "data": linked_row(&key, &ctx, w) })), &xact))
}

/// `DELETE /api/v1/{tenant}/data/{base}/{table}/{id}`: 204.
async fn delete_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>) -> Result<Response, AppError> {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let (_, xact) = write::delete_record(&st.pools, &ctx, &t.table_id, &id).await?;
    Ok(transaction_header(basedb_base::error::empty(axum::http::StatusCode::NO_CONTENT), &xact))
}

/// `GET /api/v1/{tenant}/me/notifications`.
async fn notifications_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let unread = query_param(&uri, "unread").as_deref() == Some("true");
    let after = query_param(&uri, "after");
    let page = notifications::list_notifications(&st.pools, &ctx, unread, after.as_deref()).await?;
    Ok(json_ok(page))
}

/// `POST /api/v1/{tenant}/me/notifications/read`.
async fn mark_read_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body: Value = serde_json::from_slice(&bytes).map_err(|e| AppError::internal(format!("corps JSON invalide : {e}")))?;
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null"));
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let ids: Vec<String> = match body.get("ids") {
        Some(Value::Array(a)) => a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect(),
        _ => Vec::new(),
    };
    let all = body.get("all") == Some(&Value::Bool(true));
    let marked = notifications::mark_read(&st.pools, &ctx, &ids, all).await?;
    Ok(json_ok(json!({ "data": { "marked": marked } })))
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/deleted`.
async fn deleted_route(st: &Shared, rid: &RequestId, headers: &HeaderMap, uri: &Uri, tenant: &str, base: &str, table: &str) -> Result<Response, AppError> {
    let ctx = data_context(st, headers, uri, rid, Some(tenant)).await?;
    let Some(since) = query_param(uri, "since").filter(|s| !s.is_empty()) else {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("since")));
    };
    let t = resolve_table(&st.pools, &ctx, base, table).await?;
    let cursor = query_param(uri, "cursor").filter(|c| !c.is_empty());
    let limit = query_param(uri, "limit").map(|l| js_to_number(&l));
    let page = history::list_deletions(&st.pools, &ctx, &t.table_id, &since, cursor.as_deref(), limit).await?;
    Ok(json_ok(page).into_response())
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/aggregate`.
async fn aggregate_route(st: &Shared, rid: &RequestId, headers: &HeaderMap, uri: &Uri, tenant: &str, base: &str, table: &str) -> Result<Response, AppError> {
    let ctx = data_context(st, headers, uri, rid, Some(tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, base, table).await?;
    let aggregates = aggregate::parse_aggregates(query_param(uri, "aggregates").as_deref())?;
    let group = query_param(uri, "group").filter(|g| !g.is_empty());
    let data = aggregate::aggregate_records(&st.pools, &ctx, &t.table_id, query_param(uri, "filter").as_deref(), &aggregates, group.as_deref()).await?;
    Ok(json_ok(json!({ "data": data })).into_response())
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/{id}/referenced_by`.
async fn referenced_by_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    Ok(json_ok(history::list_inverse_links(&st.pools, &ctx, &t.table_id, &id).await?))
}

/// `pageParameters`: `cursor || undefined`, `Number(limit)`.
fn page_parameters(uri: &Uri) -> (Option<String>, Option<f64>) {
    (query_param(uri, "cursor").filter(|c| !c.is_empty()), query_param(uri, "limit").map(|l| js_to_number(&l)))
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/{id}/history`.
async fn record_history_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let (cursor, limit) = page_parameters(&uri);
    Ok(json_ok(history::record_history(&st.pools, &ctx, &t.table_id, &id, cursor.as_deref(), limit).await?))
}

/// `GET /api/v1/{tenant}/meta/bases/{base}/history?table=`.
async fn base_history_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base).await?;
    let table_id = match query_param(&uri, "table").filter(|t| !t.is_empty()) {
        None => None,
        Some(t) => Some(resolve_table(&st.pools, &ctx, &base, &t).await?.table_id),
    };
    let (cursor, limit) = page_parameters(&uri);
    Ok(json_ok(history::base_history(&st.pools, &ctx, &base_id, table_id.as_deref(), cursor.as_deref(), limit).await?))
}

/// `POST /api/v1/{tenant}/history/{revision}/revert`.
async fn revert_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, revision)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (table_id, record_id) = history::revert_revision(&st.pools, &ctx, &revision).await?;
    Ok(json_ok(json!({ "data": { "table_id": table_id, "record_id": record_id } })))
}

/// `POST /api/v1/{tenant}/history/{revision}/restore`: 201.
async fn restore_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, revision)): Path<(String, String)>) -> Result<Response, AppError> {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (table_id, record_id) = history::restore_record(&st.pools, &ctx, &revision).await?;
    Ok(basedb_base::error::json_response(axum::http::StatusCode::CREATED, &json!({ "data": { "table_id": table_id, "record_id": record_id } })))
}

/// `POST /api/v1/{tenant}/history/undo` — a body that is not JSON reads as `{}`.
async fn undo_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>, bytes: Bytes) -> Result<Response, AppError> {
    let body: Value = serde_json::from_slice(&bytes).unwrap_or_else(|_| json!({}));
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'transaction')"));
    }
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let transaction = history::transaction_of(&body);
    let (xact, revisions, tables) = history::undo_transaction(&st.pools, &ctx, &transaction).await?;
    let res = json_ok(json!({ "data": { "transaction": xact, "revisions": revisions, "tables": tables } }));
    Ok(transaction_header(res, &xact))
}

/// `POST /api/v1/{tenant}/files/{base}/{table}/{field}?name=`: the body IS the file, bounded
/// before anything else (`bodyLimit`), its type in `Content-Type`.
async fn upload_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, field)): Path<(String, String, String, String)>, body: axum::body::Body) -> Result<Response, AppError> {
    let max = st.cfg.max_file_bytes.unwrap_or(files::DEFAULT_MAX_FILE_BYTES);
    let too_large = || AppError::new("BODY_TOO_LARGE").with("maximum", json!(max));
    let declared_length = headers.get(axum::http::header::CONTENT_LENGTH).and_then(|v| v.to_str().ok()).and_then(|v| v.trim().parse::<u64>().ok());
    if declared_length.is_some_and(|l| l > max) {
        return Err(too_large());
    }
    let bytes = axum::body::to_bytes(body, max as usize).await.map_err(|_| too_large())?;
    let key = st.instance_key()?;
    let key = files::link_key(key);
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let declared = headers.get(axum::http::header::CONTENT_TYPE).map(files::latin1);
    let name = query_param(&uri, "name").unwrap_or_default();
    let file = files::upload_file(&st, &ctx, &key, &t.table_id, &field, &name, declared.as_deref(), &bytes, max).await?;
    Ok(basedb_base::error::json_response(axum::http::StatusCode::CREATED, &json!({ "data": file })))
}

/// `GET /api/v1/{tenant}/files/{id}/{name}?exp=&sig=`: the signed link is the credential.
async fn download_route(State(st): State<Shared>, uri: Uri, Path((tenant, id, _name)): Path<(String, String, String)>) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = files::link_key(key);
    let download = query_param(&uri, "download").as_deref() == Some("1");
    files::open_file(&st, &key, &tenant, &id, query_param(&uri, "exp").as_deref(), query_param(&uri, "sig").as_deref(), download).await
}

fn locale(headers: &HeaderMap) -> String {
    headers.get("x-basedb-locale").map(files::latin1).unwrap_or_else(|| "fr".into())
}

/// `POST /api/v1/{tenant}/geo/geocode` — `addresses` checked before the caller is known.
async fn geocode_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = json_body(&bytes)?;
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'addresses')"));
    }
    let Some(Value::Array(addresses)) = body.get("addresses") else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("addresses")));
    };
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    Ok(json_ok(json!({ "data": geo::geocode(&st, &ctx, addresses, &locale(&headers)).await? })))
}

/// `GET /api/v1/{tenant}/geo/search?q=`.
async fn geo_search_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>) -> ApiResult {
    let _ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let places = geo::search(&st, &query_param(&uri, "q").unwrap_or_default(), &locale(&headers)).await?;
    Ok(json_ok(json!({ "data": places })))
}

// ?? Shared forms and views (chapter 15) ??????????????????????????????????????

const SHARE_ROUTE: &str = "/api/v1/{tenant}/admin/bases/{base}/tables/{table}/views/{view}/share";

type ShareParams = Path<(String, String, String, String)>;

/// `GET ?/views/{view}/share`.
async fn share_get_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, view)): ShareParams) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = key.to_string();
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    Ok(json_ok(json!({ "data": forms::get_sharing(&st.pools, &ctx, &key, &t.table_id, &view).await? })).into_response())
}

/// `PUT ?/views/{view}/share`: the body read before the caller is known.
async fn share_put_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, view)): ShareParams, bytes: Bytes) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = key.to_string();
    let body = json_body(&bytes)?;
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'access')"));
    }
    let settings = forms::ShareSettings::of(&body);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    Ok(json_ok(json!({ "data": forms::save_sharing(&st.pools, &ctx, &key, &t.table_id, &view, &settings).await? })).into_response())
}

/// `POST ?/views/{view}/share/regenerate`.
async fn share_regenerate_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, view)): ShareParams) -> Result<Response, AppError> {
    let key = st.instance_key()?;
    let key = key.to_string();
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    Ok(json_ok(json!({ "data": forms::regenerate(&st.pools, &ctx, &key, &t.table_id, &view).await? })).into_response())
}

/// `DELETE ?/views/{view}/share`.
async fn share_delete_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, view)): ShareParams) -> Result<Response, AppError> {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    forms::delete_share(&st.pools, &ctx, &t.table_id, &view).await?;
    Ok(axum::http::StatusCode::NO_CONTENT.into_response())
}

/// Answers to shared forms, per address: a public form is an open door.
static ANSWERS: std::sync::LazyLock<basedb_base::rate_limit::RateLimiter> = std::sync::LazyLock::new(|| basedb_base::rate_limit::RateLimiter::new(20, 60_000));
/// Grades of a quiz answer by answer.
static CHECKS: std::sync::LazyLock<basedb_base::rate_limit::RateLimiter> = std::sync::LazyLock::new(|| basedb_base::rate_limit::RateLimiter::new(240, 60_000));
/// Reads of shared views, per address and link.
static VIEW_READS: std::sync::LazyLock<basedb_base::rate_limit::RateLimiter> = std::sync::LazyLock::new(|| basedb_base::rate_limit::RateLimiter::new(120, 60_000));

/// One attempt counted for `address:token`; past the bound, 429 and `retry-after`.
fn limited(limiter: &basedb_base::rate_limit::RateLimiter, headers: &HeaderMap, token: &str) -> Option<Response> {
    let key = format!("{}:{token}", basedb_base::auth::address_of(headers));
    let verdict = limiter.check(&key, basedb_base::time::now_ms());
    if verdict.allowed {
        return None;
    }
    let mut res = AppError::new("RATE_LIMIT_EXCEEDED").with("retry_after", json!(verdict.retry_after)).into_response();
    res.headers_mut().insert(axum::http::header::RETRY_AFTER, axum::http::HeaderValue::from(verdict.retry_after));
    Some(res)
}

/// `respondentOf`: the signed-in person when a valid access token comes, nobody otherwise.
async fn respondent_of(st: &Shared, headers: &HeaderMap, rid: &RequestId) -> Option<basedb_base::tx::RequestContext> {
    if !headers.contains_key(axum::http::header::AUTHORIZATION) {
        return None;
    }
    bearer_context(st, headers, rid, None).await.ok()
}

async fn read_shared_view(st: &Shared, rid: &RequestId, headers: &HeaderMap, token: &str, after: Option<String>) -> Result<Response, AppError> {
    if let Some(res) = limited(&VIEW_READS, headers, token) {
        return Ok(res);
    }
    let key = st.instance_key()?;
    let key = key.to_string();
    let reader = respondent_of(st, headers, rid).await;
    let after = after.filter(|a| !a.is_empty());
    Ok(json_ok(forms::open_view(&st.pools, &key, token, reader.as_ref(), &rid.0, after).await?).into_response())
}

/// `GET /api/v1/views/{token}`: a shared data view, read on the publisher's authority.
async fn view_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(token): Path<String>) -> Result<Response, AppError> {
    read_shared_view(&st, &rid, &headers, &token, None).await
}

/// `GET /api/v1/views/{token}/rows?after=`.
async fn view_rows_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(token): Path<String>) -> Result<Response, AppError> {
    read_shared_view(&st, &rid, &headers, &token, query_param(&uri, "after")).await
}

/// `GET /api/v1/views/{token}/calendar.ics`: the iCalendar feed of a calendar or a timeline.
async fn calendar_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(token): Path<String>) -> Result<Response, AppError> {
    if let Some(res) = limited(&VIEW_READS, &headers, &token) {
        return Ok(res);
    }
    let key = st.instance_key()?;
    let key = key.to_string();
    let host: String = headers.get(axum::http::header::HOST).map(files::latin1).unwrap_or_else(|| "basedb".into()).chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | ':' | '-')).collect();
    let ics = forms::open_calendar(&st.pools, &key, &token, &rid.0, &host).await?;
    let mut res = (axum::http::StatusCode::OK, ics).into_response();
    let h = res.headers_mut();
    h.insert(axum::http::header::CONTENT_TYPE, axum::http::HeaderValue::from_static("text/calendar; charset=utf-8"));
    h.insert(axum::http::header::CACHE_CONTROL, axum::http::HeaderValue::from_static("no-cache"));
    Ok(res)
}

/// `GET /api/v1/forms/{token}`: what the page shows.
async fn form_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(token): Path<String>) -> ApiResult {
    let respondent = respondent_of(&st, &headers, &rid).await;
    Ok(json_ok(json!({ "data": forms::open_form(&st.pools, &token, respondent.as_ref(), &rid.0).await? })))
}

/// `POST /api/v1/forms/{token}`: one answer.
async fn answer_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(token): Path<String>, bytes: Bytes) -> Result<Response, AppError> {
    if let Some(res) = limited(&ANSWERS, &headers, &token) {
        return Ok(res);
    }
    let body = json_body(&bytes)?;
    let respondent = respondent_of(&st, &headers, &rid).await;
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'values')"));
    }
    let values = match body.get("values") {
        None | Some(Value::Null) => json!({}),
        Some(v) => v.clone(),
    };
    let result = forms::submit_form(&st.pools, &token, respondent.as_ref(), &rid.0, &values).await?;
    Ok(basedb_base::error::json_response(axum::http::StatusCode::CREATED, &json!({ "data": result })))
}

/// `POST /api/v1/forms/{token}/check`: one answer of a quiz graded as it goes.
async fn check_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(token): Path<String>, bytes: Bytes) -> Result<Response, AppError> {
    if let Some(res) = limited(&CHECKS, &headers, &token) {
        return Ok(res);
    }
    let body = json_body(&bytes)?;
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'field')"));
    }
    let Some(field) = body.get("field").and_then(Value::as_str) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("field")));
    };
    let respondent = respondent_of(&st, &headers, &rid).await;
    let value = body.get("value").cloned().unwrap_or(Value::Null);
    Ok(json_ok(json!({ "data": forms::check_answer(&st.pools, &token, respondent.as_ref(), &rid.0, field, &value).await? })).into_response())
}

// ── Collaboration: comments, presence, the live stream (chapter 16) ─────────────

fn null_body(name: &str) -> AppError {
    AppError::internal(format!("Cannot read properties of null (reading '{name}')"))
}

/// `String(v ?? '')`.
fn string_or_empty(v: Option<&Value>) -> String {
    match v {
        None | Some(Value::Null) => String::new(),
        Some(v) => geo::string_of(v),
    }
}

/// `GET /api/v1/{tenant}/data/{base}/{table}/{id}/comments`.
async fn comments_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    Ok(json_ok(json!({ "data": collab::list_comments(&st.pools, &ctx, &t.table_id, &id).await? })))
}

/// `POST /api/v1/{tenant}/data/{base}/{table}/{id}/comments`: 201.
async fn add_comment_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, id)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = json_body(&bytes)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    if body.is_null() {
        return Err(null_body("body"));
    }
    let (comment, unreachable) = collab::add_comment(&st.pools, &ctx, &t.table_id, &id, body.get("body")).await?;
    Ok(basedb_base::error::json_response(axum::http::StatusCode::CREATED, &json!({ "data": comment, "meta": { "unreachable": unreachable } })))
}

/// `PATCH /api/v1/{tenant}/comments/{comment}`.
async fn edit_comment_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, comment)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = json_body(&bytes)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    if body.is_null() {
        return Err(null_body("body"));
    }
    Ok(json_ok(json!({ "data": collab::edit_comment(&st.pools, &ctx, &comment, body.get("body")).await? })))
}

/// `DELETE /api/v1/{tenant}/comments/{comment}`: 204.
async fn delete_comment_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, comment)): Path<(String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    collab::delete_comment(&st.pools, &ctx, &comment).await?;
    Ok(basedb_base::error::empty(axum::http::StatusCode::NO_CONTENT))
}

/// `POST /api/v1/{tenant}/presence`: moves an open stream's presence (§3.3).
async fn presence_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = json_body(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    if body.is_null() {
        return Err(null_body("base"));
    }
    let t = resolve_table(&st.pools, &ctx, &string_or_empty(body.get("base")), &string_or_empty(body.get("table"))).await?;
    let session = string_or_empty(body.get("session"));
    collab::enter_presence(&st.pools, &ctx, &session, &t.table_id, body.get("record").and_then(Value::as_str)).await?;
    Ok(basedb_base::error::empty(axum::http::StatusCode::NO_CONTENT))
}

/// When each stream last moved its pointer: one every 40 ms at most.
static POINTER_SEEN: std::sync::LazyLock<std::sync::Mutex<std::collections::HashMap<String, std::time::Instant>>> =
    std::sync::LazyLock::new(Default::default);

/// `POST /api/v1/{tenant}/presence/pointer` (§3.4): the throttle runs before the caller is known.
async fn pointer_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = json_body(&bytes)?;
    if body.is_null() {
        return Err(null_body("session"));
    }
    let session = string_or_empty(body.get("session"));
    {
        let now = std::time::Instant::now();
        let mut seen = POINTER_SEEN.lock().unwrap();
        if seen.get(&session).is_some_and(|at| now.duration_since(*at) < std::time::Duration::from_millis(40)) {
            return Ok(basedb_base::error::empty(axum::http::StatusCode::NO_CONTENT));
        }
        seen.insert(session.clone(), now);
        if seen.len() > 10_000 {
            seen.clear();
        }
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &string_or_empty(body.get("base")), &string_or_empty(body.get("table"))).await?;
    let at = body.get("at").filter(|a| !a.is_null() && (a.is_object() || a.is_array()));
    collab::move_pointer(&st.pools, &ctx, &session, &t.table_id, at).await?;
    Ok(basedb_base::error::empty(axum::http::StatusCode::NO_CONTENT))
}

/// Open live streams per holder — ten at most (§3.2).
static STREAMS: std::sync::LazyLock<std::sync::Mutex<std::collections::HashMap<String, usize>>> = std::sync::LazyLock::new(Default::default);
const STREAMS_PER_ACTOR: usize = 10;
const STREAM_LIFETIME: std::time::Duration = std::time::Duration::from_secs(30 * 60);
const STREAM_PING: std::time::Duration = std::time::Duration::from_secs(20);

/// One open stream counted for its holder, until dropped.
struct StreamSlot(String);

impl Drop for StreamSlot {
    fn drop(&mut self) {
        let mut streams = STREAMS.lock().unwrap();
        let open = streams.get(&self.0).copied().unwrap_or(1);
        streams.insert(self.0.clone(), open.saturating_sub(1));
    }
}

/// The keys of a signal an event carries — absent ones dropped, as `JSON.stringify` drops `undefined`.
fn pick(signal: &Map<String, Value>, keys: &[&str]) -> Value {
    Value::Object(keys.iter().filter_map(|k| signal.get(*k).map(|v| (k.to_string(), v.clone()))).collect())
}

/// `writeSSE({ event, data: JSON.stringify(data) })` of Hono.
fn sse_frame(event: &str, data: &Value) -> Bytes {
    let text = basedb_base::idempotency::js_stringify(data);
    let lines: Vec<String> = text.split('\n').map(|l| format!("data: {l}")).collect();
    Bytes::from(format!("event: {event}\n{}\n\n", lines.join("\n")))
}

/// `GET /api/v1/{tenant}/events` — the live stream (chapter 16 §3.2): signals, never values.
async fn events_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>) -> Result<Response, AppError> {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let program = ctx.actor.kind == basedb_base::tx::ActorKind::Token;
    let mut table_id: Option<String> = None;
    if let (Some(base_ref), Some(table_ref)) = (query_param(&uri, "base"), query_param(&uri, "table")) {
        if !base_ref.is_empty() && !table_ref.is_empty() {
            let table = resolve_table(&st.pools, &ctx, &base_ref, &table_ref).await?;
            let readable = {
                let conn = st.pools.catalog().await?;
                notifications::can_read_table(&conn, &ctx, &table.table_id).await?
            };
            if !readable {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_ref)));
            }
            table_id = Some(table.table_id.clone());
        }
    }
    let actor = ctx.actor.id.clone();
    // A token counts its own streams, not its creator's.
    let holder = match (&ctx.actor.kind, &ctx.actor.token_id) {
        (basedb_base::tx::ActorKind::Token, Some(token)) => format!("token:{token}"),
        _ => actor.clone(),
    };
    let slot = {
        let mut streams = STREAMS.lock().unwrap();
        let open = streams.get(&holder).copied().unwrap_or(0);
        if open >= STREAMS_PER_ACTOR {
            return Err(AppError::new("RATE_LIMIT_EXCEEDED").with("streams", json!(STREAMS_PER_ACTOR)));
        }
        streams.insert(holder.clone(), open + 1);
        StreamSlot(holder)
    };
    let mut signals = collab::LiveHub::subscribe(&st.cfg.database_url).await;
    let session = uuid::Uuid::new_v4().to_string();
    let record = query_param(&uri, "record");
    // What this reader sees of the table: another's pointer over a hidden column names none.
    let readable = match &table_id {
        None => std::collections::HashSet::new(),
        Some(t) => collab::readable_field_names(&st.pools, &ctx, t).await?,
    };
    let secret = headers.get("authorization").and_then(|v| v.to_str().ok()).map(|v| v.get(7..).unwrap_or("").trim().to_string()).unwrap_or_default();
    let (out, frames) = tokio::sync::mpsc::unbounded_channel::<Bytes>();
    tokio::spawn(async move {
        let _slot = slot;
        let send = |event: &str, data: Value| {
            let _ = out.send(sse_frame(event, &data));
        };
        send("ready", json!({ "session": session }));
        let present = table_id.is_some() && !program;
        if let (true, Some(t)) = (present, &table_id) {
            let _ = collab::enter_presence(&st.pools, &ctx, &session, t, record.as_deref()).await;
        }
        let end = tokio::time::sleep(STREAM_LIFETIME);
        tokio::pin!(end);
        let mut ping = tokio::time::interval_at(tokio::time::Instant::now() + STREAM_PING, STREAM_PING);
        loop {
            tokio::select! {
                _ = &mut end => break,
                _ = out.closed() => break,
                _ = ping.tick() => {
                    send("ping", json!({}));
                    if present {
                        let _ = collab::refresh_presence(&st.pools, std::slice::from_ref(&session)).await;
                    }
                    if program && basedb_base::auth::open_token_context(&st, &secret, basedb_base::tx::Surface::Rest, &rid.0, None, None).await.is_err() {
                        break;
                    }
                }
                signal = signals.recv() => {
                    let signal = match signal {
                        Ok(s) => s,
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(_) => break,
                    };
                    let kind = signal.get("kind").and_then(Value::as_str).unwrap_or("");
                    if kind == "notifications" {
                        if !program && signal.get("user").and_then(Value::as_str) == Some(actor.as_str()) {
                            send("notifications", json!({}));
                        }
                        continue;
                    }
                    let Some(t) = &table_id else { continue };
                    if signal.get("table").and_then(Value::as_str) != Some(t.as_str()) {
                        continue;
                    }
                    match kind {
                        "records" => send("records", pick(&signal, &["table", "ids", "ops", "actor"])),
                        "comments" => send("comments", pick(&signal, &["table", "record"])),
                        "pointer" => {
                            if signal.get("session").and_then(Value::as_str) == Some(session.as_str()) {
                                continue;
                            }
                            let at = match signal.get("at") {
                                Some(at @ Value::Object(m)) if m.get("field").and_then(Value::as_str).is_some_and(|f| readable.contains(f)) => at.clone(),
                                _ => Value::Null,
                            };
                            let mut data = pick(&signal, &["session", "user", "name"]);
                            data.as_object_mut().unwrap().insert("at".into(), at);
                            send("pointer", data);
                        }
                        "presence" => {
                            if let Ok(viewers) = collab::viewers_of(&st.pools, t).await {
                                send("presence", json!({ "table": t, "viewers": viewers }));
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        drop(signals);
        drop(_slot);
        if present {
            let _ = collab::leave_presence(&st.pools, &session).await;
        }
    });
    let stream = futures_util::stream::unfold(frames, |mut frames| async move { frames.recv().await.map(|b| (Ok::<_, std::convert::Infallible>(b), frames)) });
    let mut res = Response::new(axum::body::Body::from_stream(stream));
    let h = res.headers_mut();
    h.insert("content-type", axum::http::HeaderValue::from_static("text/event-stream"));
    h.insert("cache-control", axum::http::HeaderValue::from_static("no-cache"));
    h.insert("connection", axum::http::HeaderValue::from_static("keep-alive"));
    Ok(res)
}
