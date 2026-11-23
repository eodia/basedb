//! The routes of projects and saved queries (`app.ts`).

use crate::http::{fields, look_of_body, strict_json, text};
use crate::projection::{resolve_base, resolve_field, resolve_table};
use crate::js::{js_to_number, query_param};
use crate::{buttons, lifecycle, migrations, operations, projects, queries, questions, sql_views, structure_history, views};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::Extension;
use basedb_base::auth::{bearer_context, data_context};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError};
use basedb_base::{RequestId, Shared};
use serde_json::{json, Value};

pub async fn list_projects(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let list = projects::list_projects(&st.pools, &ctx).await?;
    Ok(json_ok(json!({ "data": list })))
}

pub async fn create_project(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let look = look_of_body(fields(&body)?)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let created = projects::create_project(&st.pools, &ctx, text(&body, "label").unwrap_or(""), body.get("description"), look.as_ref()).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": created })))
}

pub async fn update_project(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let look = look_of_body(fields(&body)?)?;
    if body.get("label").is_none() && body.get("description").is_none() && look.is_none() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label, description, color, icon, image")));
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let label = match body.get("label") {
        None => None,
        Some(Value::String(s)) => Some(s.as_str()),
        Some(_) => return Err(AppError::internal("label.trim is not a function")),
    };
    let result = projects::update_project(&st.pools, &ctx, &id, label, body.get("description"), look.as_ref()).await?;
    Ok(json_ok(json!({ "data": result })))
}

pub async fn delete_project(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    projects::delete_project(&st.pools, &ctx, &id).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

// ------------------------------------------------------------------------------------
// Saved queries — deprecated: every answer says so, refusals included.

fn deprecated(result: ApiResult, tenant: &str, prefix: &str, base: &str) -> Response {
    let mut res = result.unwrap_or_else(IntoResponse::into_response);
    res.headers_mut().insert("deprecation", HeaderValue::from_static("true"));
    if let Ok(v) = HeaderValue::from_str(&format!("</api/v1/{tenant}/{prefix}/bases/{base}/questions>; rel=\"successor-version\"")) {
        res.headers_mut().insert("link", v);
    }
    res
}

pub async fn list_queries(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> Response {
    let result = async {
        let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
        let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
        let list = queries::list_queries(&st.pools, &ctx, &base_id).await?;
        Ok(json_ok(json!({ "data": list.iter().map(queries::SavedQuery::to_json).collect::<Vec<_>>() })))
    }
    .await;
    deprecated(result, &tenant, "meta", &base)
}

pub async fn get_query(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, query)): Path<(String, String, String)>) -> Response {
    let result = async {
        let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
        let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
        let q = queries::get_query(&st.pools, &ctx, &base_id, &query).await?;
        Ok(json_ok(json!({ "data": q.to_json() })))
    }
    .await;
    deprecated(result, &tenant, "meta", &base)
}

pub async fn query_groups(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let groups = queries::list_query_groups(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": groups })))
}

pub async fn create_query(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> Response {
    let result = async {
        let body = strict_json(&bytes)?;
        let input = queries::QueryInput::of_body(fields(&body)?);
        let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
        let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
        let q = queries::create_query(&st.pools, &ctx, &base_id, &input).await?;
        Ok(json_response(StatusCode::CREATED, &json!({ "data": q.to_json() })))
    }
    .await;
    deprecated(result, &tenant, "admin", &base)
}

pub async fn update_query(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, query)): Path<(String, String, String)>, bytes: Bytes) -> Response {
    let result = async {
        let body = strict_json(&bytes)?;
        let input = queries::QueryInput::of_body(fields(&body)?);
        let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
        let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
        let q = queries::update_query(&st.pools, &ctx, &base_id, &query, &input).await?;
        Ok(json_ok(json!({ "data": q.to_json() })))
    }
    .await;
    deprecated(result, &tenant, "admin", &base)
}

pub async fn delete_query(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, query)): Path<(String, String, String)>) -> Response {
    let result = async {
        let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
        let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
        queries::delete_query(&st.pools, &ctx, &base_id, &query).await?;
        Ok(empty(StatusCode::NO_CONTENT))
    }
    .await;
    deprecated(result, &tenant, "admin", &base)
}


// ------------------------------------------------------------------------------------
// Saved views of a table.

pub async fn list_views(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table)): Path<(String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let list = views::list_views(&st.pools, &ctx, &t.table_id).await?;
    Ok(json_ok(json!({ "data": list.iter().map(views::SavedView::to_json).collect::<Vec<_>>() })))
}

fn view_input(body: &Value) -> views::ViewInput<'_> {
    views::ViewInput {
        label: body.get("label"),
        kind: body.get("kind"),
        description: body.get("description"),
        spec: body.get("spec"),
        personal: body.get("personal") == Some(&Value::Bool(true)),
        locked: body.get("locked"),
    }
}

pub async fn create_view(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let input = view_input(fields(&body)?);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let view = views::create_view(&st.pools, &ctx, &t.table_id, &input).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": view.to_json() })))
}

pub async fn reorder_views(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ids: Vec<String> = match fields(&body)?.get("views") {
        Some(Value::Array(items)) if items.iter().all(Value::is_string) => items.iter().filter_map(|v| v.as_str().map(String::from)).collect(),
        _ => return Err(AppError::new("REQUEST_INVALID").with("field", json!("views"))),
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let order = views::reorder_views(&st.pools, &ctx, &t.table_id, &ids).await?;
    Ok(json_ok(json!({ "data": { "views": order } })))
}

pub async fn update_view(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, view)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let input = view_input(fields(&body)?);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let v = views::update_view(&st.pools, &ctx, &t.table_id, &view, &input).await?;
    Ok(json_ok(json!({ "data": v.to_json() })))
}

pub async fn delete_view(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, view)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    views::delete_view(&st.pools, &ctx, &t.table_id, &view).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

// ------------------------------------------------------------------------------------
// Saved questions.

pub async fn list_questions(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let list = questions::list_questions(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": list.iter().map(questions::Question::to_json).collect::<Vec<_>>() })))
}

pub async fn get_question(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, id)): Path<(String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let q = questions::get_question(&st.pools, &ctx, &base_id, &id).await?;
    Ok(json_ok(json!({ "data": q.to_json() })))
}

pub async fn create_question(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let input = questions::QuestionInput::of_body(fields(&body)?);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let q = questions::create_question(&st.pools, &ctx, &base_id, input).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": q.to_json() })))
}

pub async fn update_question(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, id)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let input = questions::QuestionInput::of_body(fields(&body)?);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let q = questions::update_question(&st.pools, &ctx, &base_id, &id, input).await?;
    Ok(json_ok(json!({ "data": q.to_json() })))
}

pub async fn delete_question(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, id)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    questions::delete_question(&st.pools, &ctx, &base_id, &id).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

// ------------------------------------------------------------------------------------
// Toolbar buttons (`/data/:base/:table/buttons`; pressing one is relayed).

pub async fn list_buttons(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table)): Path<(String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let list = buttons::list_buttons(&st.pools, &ctx, &t.table_id).await?;
    Ok(json_ok(json!({ "data": list.iter().map(buttons::TableButton::to_json).collect::<Vec<_>>() })))
}

pub async fn create_button(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let b = buttons::create_button(&st.pools, &ctx, &t.table_id, &body).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": b.to_json() })))
}

pub async fn update_button(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, button)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let b = buttons::update_button(&st.pools, &ctx, &t.table_id, &button, &body).await?;
    Ok(json_ok(json!({ "data": b.to_json() })))
}

pub async fn delete_button(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base, table, button)): Path<(String, String, String, String)>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    buttons::delete_button(&st.pools, &ctx, &t.table_id, &button).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

// ------------------------------------------------------------------------------------
// What was deleted, the structure history, the migrations of a base.

pub async fn deleted_bases(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    Ok(json_ok(json!({ "data": lifecycle::list_deleted_bases(&st.pools, &ctx).await? })))
}

pub async fn deleted_tables(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    Ok(json_ok(json!({ "data": lifecycle::list_deleted_tables(&st.pools, &ctx, &base_id).await? })))
}

pub async fn structure_history(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let limit = js_to_number(&query_param(&uri, "limit").unwrap_or_else(|| "50".into()));
    let before = query_param(&uri, "before").filter(|b| !b.is_empty());
    let page = structure_history::structure_history(&st.pools, &ctx, &base_id, before.as_deref(), if limit.is_finite() { limit } else { 50.0 }).await?;
    Ok(json_ok(json!({ "data": page })))
}

pub async fn list_migrations(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let list = migrations::list_migrations(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": list.iter().map(migrations::Migration::to_json).collect::<Vec<_>>() })))
}
// ------------------------------------------------------------------------------------
// SQL views (reading their rows, `/sql/:base/views/:view`, is relayed with the console).

pub async fn list_sql_views(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let list = sql_views::list_sql_views(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": list })))
}

pub async fn get_sql_view(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, view)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let v = sql_views::get_sql_view(&st.pools, &ctx, &base_id, &view).await?;
    Ok(json_ok(json!({ "data": v })))
}

pub async fn create_sql_view(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let input = sql_views::SqlViewInput::of_body(fields(&body)?)?;
    let v = sql_views::create_sql_view(&st.pools, &ctx, &base_id, &input).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": v })))
}

pub async fn reorder_sql_views(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let order: Vec<String> = match fields(&body)?.get("order") {
        Some(Value::Array(items)) if items.iter().all(Value::is_string) => items.iter().filter_map(|v| v.as_str().map(String::from)).collect(),
        _ => return Err(AppError::new("REQUEST_INVALID").with("field", json!("order"))),
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    sql_views::reorder_sql_views(&st.pools, &ctx, &base_id, &order).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

pub async fn update_sql_view(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, view)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let input = sql_views::SqlViewInput::of_body(fields(&body)?)?;
    let v = sql_views::update_sql_view(&st.pools, &ctx, &base_id, &view, &input).await?;
    Ok(json_ok(json!({ "data": v })))
}

pub async fn delete_sql_view(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, view)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    sql_views::delete_sql_view(&st.pools, &ctx, &base_id, &view).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

// ------------------------------------------------------------------------------------
// Structure without a migration plan: bases and tables created, labels, descriptions,
// looks and the order of the fields.

fn label_empty() -> AppError {
    AppError::new("LABEL_EMPTY")
}

/// `typeof body.label === 'string' && body.label.trim() !== ''`.
fn non_blank_label(body: &Value) -> Option<&str> {
    text(body, "label").filter(|l| !crate::description::js_trim(l).is_empty())
}

pub async fn create_base(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    if let (Some(_), Some(object)) = (body.get("template"), body.as_object()) {
        return crate::routes_templates::base_from_template(st, rid, headers, tenant, object).await;
    }
    let label = non_blank_label(body).ok_or_else(label_empty)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let project = text(body, "project").filter(|p| !p.is_empty());
    let base = operations::create_base(&st.pools, &ctx, label, body.get("description"), project).await?;
    Ok(json_response(
        StatusCode::CREATED,
        &json!({ "data": { "id": base.base_id, "name": base.schema_name, "description": base.description, "project": base.project_id } }),
    ))
}

pub async fn update_base(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let look = look_of_body(fields(&body)?)?;
    if body.get("label").is_none() && body.get("description").is_none() && look.is_none() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label, description, color, icon, image")));
    }
    if body.get("label").is_some() && non_blank_label(&body).is_none() {
        return Err(label_empty());
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, base_name) = resolve_base(&st.pools, &ctx, &base).await?;
    let r = operations::update_base(&st.pools, &ctx, &base_id, text(&body, "label"), body.get("description"), look.as_ref()).await?;
    Ok(json_ok(json!({ "data": {
        "id": base_id, "name": base_name, "label": r["label"], "description": r["description"],
        "color": r["color"], "icon": r["icon"], "image": r["image"],
    } })))
}

/// `look?.color ?? null`: the body's text, as given.
fn raw_look(v: Option<&Option<String>>) -> Value {
    json!(v.and_then(|o| o.clone()))
}

pub async fn create_table(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let label = non_blank_label(body).ok_or_else(label_empty)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let look = look_of_body(body)?;
    let t = operations::create_table(&st.pools, &ctx, &base_id, label, body.get("description"), body.get("fields"), look.as_ref()).await?;
    let fields: Vec<Value> = t
        .fields
        .iter()
        .map(|f| json!({ "id": f.field_id, "label": f.label, "name": f.name, "kind": f.kind, "description": f.description }))
        .collect();
    Ok(json_response(
        StatusCode::CREATED,
        &json!({ "data": {
            "id": t.table_id, "name": t.table_name, "base": t.schema_name, "sql": t.qualified_name,
            "description": t.description,
            "color": raw_look(look.as_ref().and_then(|l| l.color.as_ref())),
            "icon": raw_look(look.as_ref().and_then(|l| l.icon.as_ref())),
            "fields": fields,
        } }),
    ))
}

pub async fn update_table(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let look = look_of_body(fields(&body)?)?;
    if body.get("label").is_none() && body.get("description").is_none() && look.is_none() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label, description, color, icon, image")));
    }
    if body.get("label").is_some_and(|l| !l.is_string()) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label")));
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let mut data = serde_json::Map::new();
    data.insert("name".into(), json!(t.table_name));
    if body.get("label").is_some() || look.is_some() {
        data.extend(operations::update_table(&st.pools, &ctx, &t.table_id, text(&body, "label"), look.as_ref()).await?);
    }
    if let Some(d) = body.get("description") {
        let written = operations::set_table_description(&st.pools, &ctx, &t.table_id, Some(d)).await?;
        data.insert("description".into(), json!(written));
    }
    Ok(json_ok(json!({ "data": data })))
}

pub async fn update_field(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let given = |k: &str| body.get(k).is_some();
    if !["label", "description", "format", "formula", "default"].iter().any(|k| given(k)) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label, description, format, formula, default")));
    }
    let formula = crate::routes_fields::formula_of(body.get("formula"))?;
    if body.get("format").is_some_and(|f| !(f.is_object() || f.is_array())) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("format")));
    }
    if body.get("label").is_some_and(|l| !l.is_string()) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label")));
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    let mut data = serde_json::Map::new();
    data.insert("name".into(), json!(f.name));
    if let Some(label) = text(body, "label") {
        data.insert("label".into(), json!(operations::set_field_label(&st.pools, &ctx, &f.field_id, label).await?));
    }
    if let Some(d) = body.get("description") {
        data.insert("description".into(), json!(operations::set_field_description(&st.pools, &ctx, &f.field_id, Some(d)).await?));
    }
    if let Some(format) = body.get("format") {
        data.insert("format".into(), crate::field_config::set_field_format(&st.pools, &ctx, &f.field_id, format).await?.to_json());
    }
    if let Some(default) = body.get("default") {
        data.insert("default".into(), crate::field_config::set_field_default(&st.pools, &ctx, &f.field_id, default).await?);
    }
    let mut sql: Vec<String> = Vec::new();
    if let Some(formula) = &formula {
        let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
        let (stored, written) = crate::computed_fields::set_formula(&st.pools, &ctx, &t.table_id, &f.name, formula).await?;
        data.insert("formula".into(), json!({ "stored": stored }));
        sql = written;
    }
    Ok(json_ok(json!({ "data": data, "meta": { "sql": sql } })))
}

pub async fn reorder_fields(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let names: Option<Vec<String>> = match fields(&body)?.get("fields") {
        Some(Value::Array(a)) => a.iter().map(|v| v.as_str().map(str::to_string)).collect(),
        _ => None,
    };
    let Some(names) = names else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("fields")));
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let order = operations::reorder_fields(&st.pools, &ctx, &t.table_id, &names).await?;
    Ok(json_ok(json!({ "data": { "fields": order } })))
}