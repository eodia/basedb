//! L'assemblage du serveur, tel `createApp` (app.ts) : les couches globales
//! ([`crate::layers`] : CORS → identifiant de requête et traduction des erreurs → démo), les
//! routes natives du socle (santé, registre des codes, `/auth/*`), celles des domaines, et pour
//! tout le reste la réponse de Hono à une route inconnue (`404 Not Found`, en texte). Le binaire
//! et le harnais de test montent le même routeur.

use crate::error::json_ok;
use crate::state::Shared;
use crate::{auth, layers};
use axum::http::{header, StatusCode};
use axum::middleware::{from_fn, from_fn_with_state};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use basedb_contracts::ERROR_CODES;
use serde_json::{json, Value};

/// `GET /healthz`: liveness, outside the catalog (chapter 08 §1.5).
pub async fn healthz() -> Response {
    json_ok(json!({ "status": "ok" }))
}

/// `GET /api/v1/codes`: the code registry, as the API publishes it.
pub async fn codes() -> Response {
    let codes: Vec<Value> = ERROR_CODES.iter().map(|e| json!({ "code": e.code, "condition": e.condition, "http_status": e.http_status })).collect();
    json_ok(json!({ "codes": codes }))
}

/// What Hono answers a path or a method no route serves: `404`, in plain text — never `405`.
pub async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, [(header::CONTENT_TYPE, "text/plain; charset=UTF-8")], "404 Not Found").into_response()
}

/// The socle's own routes: health, codes, development account, `/auth/*`.
pub fn socle_routes(st: &Shared) -> Router<Shared> {
    let mut r = Router::new().route("/healthz", get(healthz)).route("/api/v1/codes", get(codes));
    if let Some(email) = st.development_email.get().cloned() {
        r = r.route("/api/v1/dev/account", get(move || async move { json_ok(json!({ "email": email })) }));
    }
    r.merge(auth::routes::router(st))
}

/// The whole application: `api` holds the domains' routes (each crate's `router`).
pub fn build(st: Shared, api: Router<Shared>) -> Router {
    Router::new()
        .merge(socle_routes(&st))
        .merge(api)
        .fallback(not_found)
        .method_not_allowed_fallback(not_found)
        .layer(from_fn_with_state(st.clone(), layers::demo_guard))
        .layer(from_fn(layers::request_id))
        .layer(from_fn_with_state(st.clone(), layers::cors))
        .with_state(st)
}
