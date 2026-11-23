//! The template routes (chapter 20): the gallery, one template, import, delete, and a base
//! built from a template (`POST admin/bases` with `template`). The AI draft
//! (`POST admin/templates/draft`) is `basedb-ai`'s.

use crate::http::strict_json;
use crate::template_apply::{apply_template, needs_missing_crate, Applied, ApplyRequest};
use crate::template_catalog::{delete_template, get_template, import_template, invalid_template, list_templates};
use crate::template_check::check_template;
use axum::body::{Body, Bytes};
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::auth::routes::screen_language;
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError};
use basedb_base::tx::RequestContext;
use basedb_base::{RequestId, Shared};
use serde_json::{json, Map, Value};

pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let language = screen_language(&headers);
    Ok(json_ok(list_templates(&st.pools, &ctx, &st.cfg, Some(&language)).await?))
}

pub async fn get_one(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, key)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let language = screen_language(&headers);
    let entry = get_template(&st.pools, &ctx, &st.cfg, &key, Some(&language)).await?;
    Ok(json_ok(json!({ "data": entry.template, "meta": { "source": entry.source } })))
}

pub async fn import(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let imported = import_template(&st.pools, &ctx, &body).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": imported })))
}

pub async fn delete(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, key)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    delete_template(&st.pools, &ctx, &key).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

/// `templateOf` of `core/templates/apply.ts`: a key of the catalogue, or a template itself.
async fn template_of(st: &Shared, ctx: &RequestContext, given: &Value, locale: Option<&str>) -> Result<Value, AppError> {
    match given {
        Value::String(key) => Ok(get_template(&st.pools, ctx, &st.cfg, key, locale).await?.template),
        Value::Object(_) | Value::Array(_) => check_template(&crate::js::js_order(given.clone())).map_err(invalid_template),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!("template"))),
    }
}

fn answer(applied: &Applied) -> Value {
    json!({
        "data": { "id": applied.base_id, "name": applied.name, "label": applied.label },
        "meta": { "template": {
            "ai_degraded": applied.report.ai_degraded,
            "sampled": applied.report.sampled,
            "not_required": applied.report.not_required,
        } },
    })
}

fn line(value: &Value) -> Bytes {
    let mut text = serde_json::to_string(value).unwrap_or_default();
    text.push('\n');
    Bytes::from(text)
}

/// `baseFromTemplate` of `app.ts`: the whole base, or none; each step as a line of
/// `application/x-ndjson` for the client that asks for it.
pub async fn base_from_template(st: Shared, rid: RequestId, headers: HeaderMap, tenant: String, body: &Map<String, Value>) -> ApiResult {
    for key in ["rows", "ai_consent"] {
        if body.get(key).is_some_and(|v| !v.is_boolean()) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!(key)));
        }
    }
    for key in ["label", "language", "project"] {
        if body.get(key).is_some_and(|v| !v.is_null() && !v.is_string()) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!(key)));
        }
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let string = |k: &str| body.get(k).and_then(Value::as_str).map(str::to_string);
    let request = ApplyRequest {
        label: string("label"),
        description: body.get("description").map(|d| if d.is_string() { d.clone() } else { Value::Null }),
        project: string("project").filter(|p| !p.is_empty()),
        rows: body.get("rows") != Some(&Value::Bool(false)),
        ai_consent: body.get("ai_consent") == Some(&Value::Bool(true)),
    };
    let ai_consent = body.get("ai_consent") == Some(&Value::Bool(true));
    let locale = string("language");
    let given = body.get("template").cloned().unwrap_or(Value::Null);
    let ndjson = headers.get(header::ACCEPT).and_then(|v| v.to_str().ok()).unwrap_or_default().contains("application/x-ndjson");

    if !ndjson {
        let template = template_of(&st, &ctx, &given, locale.as_deref()).await?;
        if needs_missing_crate(&template, ai_consent) {
            return Err(AppError::internal("modèle : un crate de domaine manque (automatisations ou IA)"));
        }
        let applied = apply_template(&st.pools, &ctx, &template, &request, &|_| {}).await?;
        return Ok(json_response(StatusCode::CREATED, &answer(&applied)));
    }

    // The template is resolved before the status line: one that cannot be built is refused whole.
    let resolved = template_of(&st, &ctx, &given, locale.as_deref()).await;
    if let Ok(template) = &resolved {
        if needs_missing_crate(template, ai_consent) {
            return Err(AppError::internal("modèle : un crate de domaine manque (automatisations ou IA)"));
        }
    }
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Bytes>();
    let request_id = rid.0.clone();
    tokio::spawn(async move {
        let outcome = match resolved {
            Err(e) => Err(e),
            Ok(template) => {
                let steps = tx.clone();
                apply_template(&st.pools, &ctx, &template, &request, &move |s: &Value| {
                    let _ = steps.send(line(&json!({ "step": s })));
                })
                .await
            }
        };
        let last = match outcome {
            Ok(applied) => answer(&applied),
            Err(error) => {
                if error.class() == basedb_contracts::ErrorClass::Incident {
                    eprintln!("[{request_id}] {} {}", error.code, error.cause.as_deref().unwrap_or_default());
                }
                json!({ "error": error.body(&request_id) })
            }
        };
        let _ = tx.send(line(&last));
    });
    let stream = futures_util::stream::unfold(rx, |mut rx| async move { rx.recv().await.map(|b| (Ok::<_, std::convert::Infallible>(b), rx)) });
    let mut res = Response::new(Body::from_stream(stream));
    res.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("application/x-ndjson; charset=utf-8"));
    Ok(res)
}
