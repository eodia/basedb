//! Les couches globales, dans l'ordre de `createApp` (app.ts) : CORS → identifiant de requête
//! (et l'UNIQUE traduction erreur → HTTP) → garde-fou de la démo → routes.

use crate::demo::{demo_allows_batch, demo_refusal};
use crate::error::PendingError;
use crate::state::Shared;
use axum::body::{to_bytes, Body};
use axum::extract::{Request, State};
use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use regex::Regex;
use std::sync::OnceLock;

/// The request's identifier, in the request's extensions: `Extension<RequestId>` in a handler.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RequestId(pub String);

const ALLOW_METHODS: &str = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOW_HEADERS: &str = "content-type,x-request-id,authorization,x-basedb-csrf,x-basedb-locale,x-basedb-environment";
const EXPOSE_HEADERS: &str = "x-request-id,x-basedb-transaction,content-disposition";

/// The origin answered, if any: `BASEDB_ORIGINS` when set, else any `http://localhost[:port]`.
pub fn allowed_origin(origins: Option<&[String]>, origin: &str) -> Option<String> {
    static LOCALHOST: OnceLock<Regex> = OnceLock::new();
    let ok = match origins {
        Some(list) => list.iter().any(|o| o == origin),
        None => LOCALHOST.get_or_init(|| Regex::new(r"^http://localhost(:\d+)?$").unwrap()).is_match(origin),
    };
    ok.then(|| origin.to_string())
}

fn set(res: &mut Response, name: &'static str, value: &str) {
    if let Ok(v) = HeaderValue::from_str(value) {
        res.headers_mut().insert(name, v);
    }
}

/// Hono's `cors()` with app.ts's options. A preflight never reaches the routes (nor gets
/// an `x-request-id`).
pub async fn cors(State(st): State<Shared>, req: Request, next: Next) -> Response {
    let origin = req.headers().get(header::ORIGIN).and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
    let allow = allowed_origin(st.cfg.allowed_origins.as_deref(), &origin);
    if req.method() == Method::OPTIONS {
        let mut res = Response::new(Body::empty());
        *res.status_mut() = StatusCode::NO_CONTENT;
        if let Some(o) = &allow {
            set(&mut res, "access-control-allow-origin", o);
        }
        set(&mut res, "access-control-allow-credentials", "true");
        set(&mut res, "access-control-expose-headers", EXPOSE_HEADERS);
        set(&mut res, "access-control-allow-methods", ALLOW_METHODS);
        set(&mut res, "access-control-allow-headers", ALLOW_HEADERS);
        set(&mut res, "vary", "Origin, Access-Control-Request-Headers");
        return res;
    }
    let mut res = next.run(req).await;
    if let Some(o) = &allow {
        set(&mut res, "access-control-allow-origin", o);
    }
    set(&mut res, "access-control-allow-credentials", "true");
    set(&mut res, "access-control-expose-headers", EXPOSE_HEADERS);
    let vary = match res.headers().get(header::VARY).and_then(|v| v.to_str().ok()) {
        Some(v) if !v.is_empty() => format!("{v}, Origin"),
        _ => "Origin".to_string(),
    };
    set(&mut res, "vary", &vary);
    res
}

/// `x-request-id` (sent, else a v4 UUID) on the request and on
/// the response; and the response of an error ([`PendingError`]) rendered here, with
/// whatever headers its handler set (`retry-after`, cookies).
pub async fn request_id(req: Request, next: Next) -> Response {
    let mut req = req;
    let id = match req.headers().get("x-request-id").and_then(|v| v.to_str().ok()) {
        Some(v) => v.to_string(),
        None => uuid::Uuid::new_v4().to_string(),
    };
    req.extensions_mut().insert(RequestId(id.clone()));
    if let Ok(v) = HeaderValue::from_str(&id) {
        req.headers_mut().insert("x-request-id", v);
    }
    let res = next.run(req).await;
    let mut res = match res.extensions().get::<PendingError>().cloned() {
        Some(PendingError(error)) => {
            let mut rendered = error.respond(&id);
            for (name, value) in res.headers() {
                if name != header::CONTENT_TYPE && name != header::CONTENT_LENGTH {
                    rendered.headers_mut().append(name.clone(), value.clone());
                }
            }
            rendered
        }
        None => res,
    };
    set(&mut res, "x-request-id", &id);
    res
}

/// The largest body read whole by a layer, or by a route that lifts axum's default limit.
pub const MAX_BODY: usize = 128 * 1024 * 1024;

/// The public demo (`BASEDB_DEMO=1`): reading and editing what exists pass, nothing else —
/// a batch of updates included (its body read once and kept for the route).
pub async fn demo_guard(State(st): State<Shared>, req: Request, next: Next) -> Response {
    if st.cfg.demo.is_none() {
        return next.run(req).await;
    }
    let (method, path) = (req.method().as_str().to_string(), req.uri().path().to_string());
    let Some(refusal) = demo_refusal(&method, &path) else { return next.run(req).await };
    if method == "POST" && path.ends_with("/batch") {
        let (parts, body) = req.into_parts();
        let bytes = to_bytes(body, MAX_BODY).await.unwrap_or_default();
        let operations = serde_json::from_slice::<serde_json::Value>(&bytes).ok().and_then(|v| v.get("operations").cloned()).unwrap_or_default();
        if demo_allows_batch(&method, &path, &operations) {
            return next.run(Request::from_parts(parts, Body::from(bytes))).await;
        }
        return refusal.into_response();
    }
    refusal.into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origins_follow_app_ts() {
        assert_eq!(allowed_origin(None, "http://localhost:3200").as_deref(), Some("http://localhost:3200"));
        assert_eq!(allowed_origin(None, "http://localhost").as_deref(), Some("http://localhost"));
        assert_eq!(allowed_origin(None, "https://localhost:3200"), None);
        assert_eq!(allowed_origin(None, "http://127.0.0.1:3200"), None);
        let list = vec!["https://basedb.exemple.fr".to_string()];
        assert_eq!(allowed_origin(Some(&list), "http://localhost:3200"), None);
        assert!(allowed_origin(Some(&list), "https://basedb.exemple.fr").is_some());
    }
}
