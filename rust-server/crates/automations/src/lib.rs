//! Les automatisations, webhooks, agent et propositions (`core/src/automations`, `webhooks`,
//! `agent`, `proposals`) : leurs routes ([`router`]) et leurs travaux de fond
//! ([`start_background`], sauf `BASEDB_RUST_BACKGROUND=0`). Voir `NOTES.md`,
//! « Crate automations ».
#![allow(clippy::result_large_err)]

pub mod agent;
pub mod catalog;
pub mod copilot;
pub mod defs;
mod engine;
pub mod proposals;
mod render;
pub mod requests;
mod routes;
pub mod validate;
pub mod webhooks;

use axum::routing::{get, patch, post};
use axum::Router;
use basedb_base::Shared;

pub use engine::run_automations;

/// The background jobs of the domain, unless `BASEDB_RUST_BACKGROUND=0`: the run engine
/// and the webhooks' sender.
pub fn start_background(st: &Shared) -> Vec<tokio::task::JoinHandle<()>> {
    if !st.cfg.background() {
        return Vec::new();
    }
    vec![engine::start_worker(st.clone()), webhooks::start_dispatch(st.clone())]
}

/// The domain's native routes; merged by `basedb-server` (`main.rs`).
pub fn router(st: &Shared) -> Router<Shared> {
    let creator_state = st.clone();
    basedb_catalog::template_apply::set_template_automation_creator(Box::new(move |ctx, base_id, input| {
        let st = creator_state.clone();
        Box::pin(async move { catalog::create_automation(&st, &ctx, &base_id, &input).await.map(|a| a.id) })
    }));
    let admin = "/api/v1/{tenant}/admin/bases/{base}/automations";
    let hooks = "/api/v1/{tenant}/admin/webhooks";
    Router::new()
        .route(admin, get(routes::list).post(routes::create))
        .route(&format!("{admin}/{{id}}"), patch(routes::update).delete(routes::delete))
        .route(&format!("{admin}/{{id}}/runs"), get(routes::runs))
        .route("/api/v1/{tenant}/automations/{id}/run", post(routes::run))
        .route("/api/v1/hooks/{secret}", post(routes::hook))
        .route("/api/v1/{tenant}/data/{base}/{table}/buttons/{button}/press", post(routes::press))
        .route(hooks, get(webhooks::list).post(webhooks::create))
        .route(&format!("{hooks}/{{id}}"), patch(webhooks::set_active).delete(webhooks::delete))
        .route(&format!("{hooks}/{{id}}/deliveries"), get(webhooks::deliveries))
        .route("/api/v1/{tenant}/admin/proposals", get(proposals::list))
        .route("/api/v1/{tenant}/admin/proposals/{id}/approve", post(proposals::approve))
        .route("/api/v1/{tenant}/admin/proposals/{id}/reject", post(proposals::reject))
        .route("/api/v1/{tenant}/ai/bases/{base}/automation-copilot", post(copilot::route))
}
