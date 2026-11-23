//! L'IA : copilotes, champs IA, fournisseurs, pièces jointes, documents PDF
//! (`core/src/ai`, `documents`).
//!
//! Convention (voir `rust-server/README.md`, « Conventions des domaines ») :
//! [`router`] rend les routes natives du domaine.
#![allow(clippy::result_large_err)]

pub mod attachments;
pub mod catalog_hooks;
pub mod copilot;
pub mod documents;
pub mod drafts;
pub mod fields;
pub mod js;
pub mod language;
pub mod pdf;
pub mod prompts;
pub mod provider;
pub mod routes;
pub mod schedule;
mod sealing;
pub mod template_draft;
pub mod worker;

pub use worker::start_background;

use axum::extract::DefaultBodyLimit;
use axum::routing::{get, patch, post};
use axum::Router;
use basedb_base::Shared;

/// A method not declared on a path this crate serves: Hono's `404`, as for any unknown route.
async fn unknown_method() -> axum::response::Response {
    basedb_base::app::not_found().await
}

/// A template carries its pictures: its body is read whole, as large as it is.
fn big() -> DefaultBodyLimit {
    DefaultBodyLimit::max(basedb_base::layers::MAX_BODY)
}

/// The domain's native routes; merged by `basedb-server` (`main.rs`). Hands the catalog its
/// AI services on the way (`catalog_hooks`).
pub fn router(st: &Shared) -> Router<Shared> {
    catalog_hooks::install(&st.cfg);
    let ai = "/api/v1/{tenant}/ai";
    let admin = "/api/v1/{tenant}/admin";
    let data = "/api/v1/{tenant}/data/{base}/{table}";
    let field = format!("{admin}/bases/{{base}}/tables/{{table}}/fields/{{field}}/ai");
    let templates = format!("{admin}/bases/{{base}}/tables/{{table}}/documents");
    use documents::routes as d;
    Router::new()
        .route(&format!("{ai}/bases/{{base}}/expression"), post(routes::expression))
        .route(&format!("{ai}/bases/{{base}}/structure"), post(routes::structure))
        .route(&format!("{ai}/bases/{{base}}/copilot"), post(routes::copilot))
        .route(&format!("{ai}/attachments"), post(routes::attachment).layer(DefaultBodyLimit::disable()))
        .route(&format!("{ai}/schedule/preview"), post(routes::schedule_preview))
        .route(&field, get(routes::field_status).put(routes::set_field).delete(routes::disable_field))
        .route(&format!("{field}/run"), post(routes::run_field))
        .route(&format!("{admin}/templates/draft"), post(routes::template_draft))
        .route(&format!("{data}/documents"), get(d::list).fallback(unknown_method))
        .route(&format!("{data}/{{id}}/documents/{{template}}"), get(d::document).fallback(unknown_method))
        .route(&format!("{data}/{{id}}/documents/preview"), post(d::preview).get(d::preview_get).fallback(unknown_method).layer(big()))
        .route(&templates, post(d::create).fallback(unknown_method).layer(big()))
        .route(&format!("{templates}/{{id}}"), patch(d::update).delete(d::delete).fallback(unknown_method).layer(big()))
}
