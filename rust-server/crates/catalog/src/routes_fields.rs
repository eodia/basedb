//! The routes of the field engine: a field added, a link, the options of a select, the
//! obligation, the uniqueness, the display column (`app.ts`).

use crate::computed_fields::{FormulaInput, RollupInput};
use crate::fields::{self, AddFieldRequest, CreateLinkRequest};
use crate::http::{fields as body_fields, strict_json, text};
use crate::projection::{resolve_field, resolve_table};
use crate::select_options::{is_choice_kind, options_unreadable, set_select_options};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::error::{json_ok, json_response, ApiResult, AppError};
use basedb_base::{RequestId, Shared};
use serde_json::{json, Value};

fn request_invalid(field: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field))
}

/// `typeof body.label === 'string' && body.label.trim() !== ''`.
fn non_blank_label(body: &Value) -> Option<&str> {
    text(body, "label").filter(|l| !crate::description::js_trim(l).is_empty())
}

/// `formulaOf`.
pub fn formula_of(raw: Option<&Value>) -> Result<Option<FormulaInput>, AppError> {
    let Some(raw) = raw else { return Ok(None) };
    let Some(expression) = raw.as_object().and_then(|o| o.get("expression")).and_then(Value::as_str) else {
        return Err(request_invalid("formula.expression"));
    };
    let timezone = raw.get("timezone");
    if timezone.is_some_and(|t| !t.is_null() && !t.is_string()) {
        return Err(request_invalid("formula.timezone"));
    }
    Ok(Some(FormulaInput { expression: expression.to_string(), timezone: timezone.and_then(Value::as_str).map(str::to_string) }))
}

/// `rollupOf`.
pub fn rollup_of(raw: Option<&Value>) -> Result<Option<RollupInput>, AppError> {
    let Some(raw) = raw else { return Ok(None) };
    let Some(via) = raw.as_object().and_then(|o| o.get("via")).and_then(Value::as_str) else {
        return Err(request_invalid("rollup.via"));
    };
    for key in ["via_table", "target", "aggregate"] {
        if raw.get(key).is_some_and(|v| !v.is_null() && !v.is_string()) {
            return Err(request_invalid(&format!("rollup.{key}")));
        }
    }
    let aggregate = raw.get("aggregate").and_then(Value::as_str);
    if aggregate.is_some_and(|a| !["count", "sum", "avg", "min", "max"].contains(&a)) {
        return Err(request_invalid("rollup.aggregate"));
    }
    let string = |k: &str| raw.get(k).and_then(Value::as_str).map(str::to_string);
    Ok(Some(RollupInput { via: via.to_string(), via_table: string("via_table"), target: string("target"), aggregate: aggregate.map(str::to_string) }))
}

/// `typeof v === 'object' && v !== null`: what a format must be (an array passes).
fn is_js_object(v: &Value) -> bool {
    v.is_object() || v.is_array()
}

/// A list Node reads with a `TypeError` (a `null` entry, a label neither text nor `null`).
fn unreadable_options(options: &[Value]) -> bool {
    options.iter().any(Value::is_null) || options_unreadable(options)
}

pub async fn add_field(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    // An AI field is the `ai` crate's, which `basedb-server` always installs.
    let hooks = crate::ai_hooks::ai_hooks();
    if body.get("ai").is_some() && hooks.is_none() {
        return Err(AppError::internal("champ IA : le crate ai n'est pas installé"));
    }
    let choice = body.get("kind").and_then(Value::as_str).is_some_and(is_choice_kind);
    // A list Node read with a `TypeError` (500): refused as invalid, after the caller is known.
    let malformed = choice && !matches!(body.get("options"), None | Some(Value::Null)) && !matches!(body.get("options"), Some(Value::Array(a)) if !unreadable_options(a));
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    if malformed {
        return Err(request_invalid("options"));
    }
    let body = body_fields(&body)?;
    if body.get("rich").is_some_and(|r| !r.is_boolean()) {
        return Err(request_invalid("rich"));
    }
    if body.get("format").is_some_and(|f| !is_js_object(f)) {
        return Err(request_invalid("format"));
    }
    let formula = formula_of(body.get("formula"))?;
    let rollup = rollup_of(body.get("rollup"))?;
    let label = non_blank_label(body).ok_or_else(|| AppError::new("LABEL_EMPTY"))?;
    let Some(kind) = text(body, "kind") else {
        return Err(request_invalid("kind"));
    };
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let ai = match (body.get("ai"), hooks) {
        (Some(raw), Some(hooks)) => Some((hooks.input_of)(raw)?),
        _ => None,
    };
    let request = AddFieldRequest {
        table_id: t.table_id,
        label: label.to_string(),
        kind: kind.to_string(),
        description: body.get("description").cloned(),
        options: body.get("options").and_then(Value::as_array).cloned(),
        format: body.get("format").cloned(),
        formula,
        rollup,
        button: body.get("button").cloned(),
        rich: body.get("rich") == Some(&Value::Bool(true)),
        technical_name: None,
        lineage_id: None,
        ai,
    };
    let added = fields::add_field(&st.pools, &ctx, &request).await?;
    Ok(json_response(
        StatusCode::CREATED,
        &json!({
            "data": { "id": added.field_id, "name": added.name, "label": added.label, "description": added.description, "kind": added.kind, "required": false },
            "meta": { "sql": added.sql },
        }),
    ))
}

pub async fn create_link(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    // A `required` or an `on_delete` Node carried into SQL as given (an incident there):
    // refused as invalid, after the caller is known.
    let malformed = if body.get("required").is_some_and(|r| !r.is_null() && !r.is_boolean()) {
        Some("required")
    } else if body.get("on_delete").is_some_and(|o| !o.is_null() && !matches!(o.as_str(), Some("restrict" | "set_null" | "cascade"))) {
        Some("on_delete")
    } else {
        None
    };
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    if let Some(field) = malformed {
        return Err(request_invalid(field));
    }
    let body = body_fields(&body)?;
    let label = non_blank_label(body).ok_or_else(|| AppError::new("LABEL_EMPTY"))?;
    if body.get("multiple").is_some_and(|m| !m.is_boolean()) {
        return Err(request_invalid("multiple"));
    }
    let Some(target) = text(body, "target").filter(|t| !t.is_empty()) else {
        return Err(request_invalid("target"));
    };
    let source = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let target = resolve_table(&st.pools, &ctx, &base, target).await?;
    let request = CreateLinkRequest {
        table_id: source.table_id,
        target_table_id: target.table_id,
        label: label.to_string(),
        description: body.get("description").cloned(),
        required: body.get("required").and_then(Value::as_bool),
        on_delete: text(body, "on_delete").map(str::to_string),
        multiple: body.get("multiple") == Some(&Value::Bool(true)),
        technical_name: None,
        lineage_id: None,
    };
    let link = fields::create_link_field(&st.pools, &ctx, &request).await?;
    Ok(json_response(
        StatusCode::CREATED,
        &json!({
            "data": {
                "id": link.field_id, "label": link.label, "name": link.name, "description": link.description,
                "kind": link.kind, "target": link.target_table_name, "constraint": link.constraint_name,
                "index": link.index_name, "on_delete": link.on_delete,
            },
            "meta": { "sql": link.sql },
        }),
    ))
}

pub async fn set_options(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let Some(options) = body.get("options").and_then(Value::as_array) else {
        return Err(request_invalid("options"));
    };
    let malformed = unreadable_options(options);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    if malformed {
        return Err(request_invalid("options"));
    }
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    let result = set_select_options(&st.pools, &ctx, &f.field_id, options).await?;
    let options: Vec<Value> = result.options.iter().map(|o| o.to_json()).collect();
    Ok(json_ok(json!({ "data": { "options": options, "added": result.added, "removed": result.removed }, "meta": { "sql": result.sql } })))
}

pub async fn set_required(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    let required = body_fields(&body)?.get("required") != Some(&Value::Bool(false));
    let (required, sql) = fields::set_field_required(&st.pools, &ctx, &f.field_id, required).await?;
    Ok(json_ok(json!({ "data": { "required": required }, "meta": { "sql": sql } })))
}

pub async fn set_unique(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table, field)): Path<(String, String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let f = resolve_field(&st.pools, &ctx, &base, &table, &field).await?;
    let unique = body_fields(&body)?.get("unique") != Some(&Value::Bool(false));
    let (unique, sql) = fields::set_field_unique(&st.pools, &ctx, &f.field_id, unique).await?;
    Ok(json_ok(json!({ "data": { "unique": unique }, "meta": { "sql": sql } })))
}

pub async fn set_display(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let malformed = body.get("field").is_some_and(|f| !f.is_null() && !f.is_string());
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    if malformed {
        return Err(request_invalid("field"));
    }
    let t = resolve_table(&st.pools, &ctx, &base, &table).await?;
    let field = match text(body_fields(&body)?, "field") {
        Some(name) => Some(resolve_field(&st.pools, &ctx, &base, &table, name).await?.field_id),
        None => None,
    };
    let (field, name) = fields::set_display_column(&st.pools, &ctx, &t.table_id, field.as_deref()).await?;
    Ok(json_ok(json!({ "data": { "field": field, "name": name } })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_and_formulas_read_as_node_s() {
        assert_eq!(formula_of(Some(&json!({ "expression": "1", "timezone": null }))).unwrap().unwrap().timezone, None);
        assert_eq!(formula_of(Some(&json!("1"))).unwrap_err().details["field"], json!("formula.expression"));
        assert_eq!(formula_of(Some(&json!({ "expression": "1", "timezone": 3 }))).unwrap_err().details["field"], json!("formula.timezone"));
        assert_eq!(rollup_of(Some(&json!({ "via": "a", "target": 1 }))).unwrap_err().details["field"], json!("rollup.target"));
        assert_eq!(rollup_of(Some(&json!({ "via": "a", "aggregate": "median" }))).unwrap_err().details["field"], json!("rollup.aggregate"));
        let r = rollup_of(Some(&json!({ "via": "a", "via_table": null, "aggregate": "sum" }))).unwrap().unwrap();
        assert_eq!((r.via_table, r.aggregate.as_deref()), (None, Some("sum")));
        assert!(is_js_object(&json!([])) && !is_js_object(&json!("x")));
        assert!(unreadable_options(&[json!(null)]));
    }
}
