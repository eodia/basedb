//! L'administration : comptes, groupes, droits, jetons, OIDC, inscription, profil, partages,
//! synchronisation, intégrations, insights, courriels (`core/src/admin`, routes `/auth/*` restantes).
//!
//! Convention (voir `rust-server/README.md`, « Conventions des domaines ») :
//! [`router`] rend les routes natives du domaine ; ce qui n'y est pas répond 404.

#![allow(clippy::result_large_err)]

pub mod access;
pub mod common;
pub mod fields;
pub mod groups;
pub mod insights;
pub mod insights_source;
pub mod integrations;
pub mod jobs;
pub mod mail_texts;
pub mod members;
pub mod notification_texts;
pub mod oidc;
pub mod outbox;
pub mod profile;
pub mod rows;
pub mod sealing;
pub mod sharing;
pub mod signup;
pub mod sync_sources;
pub mod synced;
pub mod tokens;
pub mod users;

use axum::routing::{delete, get, patch, post, put};
use axum::Router;
use basedb_base::Shared;
pub use jobs::start_background;
use basedb_catalog as _; // dependency kept for the domain's port (acyclic graph of the plan)

/// The domain's native routes; merged by `basedb-server` (`main.rs`).
pub fn router(_st: &Shared) -> Router<Shared> {
    let admin = "/api/v1/{tenant}/admin";
    Router::new()
        .route(&format!("{admin}/users"), get(users::list).post(users::create))
        .route(&format!("{admin}/users/{{id}}"), patch(users::update))
        .route(&format!("{admin}/users/{{id}}/password"), post(users::reset_password))
        .route(&format!("{admin}/users/{{id}}/groups"), put(users::set_groups))
        .route(&format!("{admin}/groups"), get(groups::list).post(groups::create))
        .route(&format!("{admin}/groups/{{id}}"), patch(groups::rename).delete(groups::remove))
        .route(&format!("{admin}/groups/{{id}}/members"), get(groups::members))
        .route(&format!("{admin}/groups/{{id}}/members/{{user}}"), put(groups::add_member).delete(groups::remove_member))
        .route(&format!("{admin}/access"), get(access::graph).post(access::apply))
        .route(&format!("{admin}/access/tables/{{table}}/fields"), get(fields::field_access))
        .route(&format!("{admin}/access/fields/{{field}}"), put(fields::set_field_rule))
        .route(&format!("{admin}/access/tables/{{table}}/mask"), get(fields::field_mask))
        .route(&format!("{admin}/access/tables/{{table}}/rows"), get(rows::row_access).put(rows::set_row_rule))
        .route(&format!("{admin}/access/tables/{{table}}/rows/effective"), get(rows::effective_rows))
        .route(&format!("{admin}/signup"), get(signup::get_admin_policy).put(signup::set_admin_policy))
        .route(&format!("{admin}/tokens"), get(tokens::list).post(tokens::create))
        .route(&format!("{admin}/tokens/{{id}}"), delete(tokens::revoke))
        .route("/api/v1/{tenant}/me/tokens", get(tokens::list_own))
        .route("/api/v1/{tenant}/meta/users", get(members::list))
        .route(&format!("{admin}/bases/{{base}}/integrations"), get(integrations::list).post(integrations::create))
        .route(&format!("{admin}/bases/{{base}}/integrations/{{id}}"), delete(integrations::remove))
        .route(&format!("{admin}/bases/{{base}}/integrations/{{id}}/test"), post(integrations::test))
        .route(&format!("{admin}/bases/{{base}}/synced-tables"), get(synced::list_route).post(synced::create_route))
        .route(&format!("{admin}/bases/{{base}}/synced-tables/preview"), post(synced::preview_route))
        .route(&format!("{admin}/bases/{{base}}/synced-tables/{{table}}"), patch(synced::update_route).delete(synced::stop_route))
        .route(&format!("{admin}/bases/{{base}}/synced-tables/{{table}}/run"), post(synced::run_route))
        .route("/api/v1/{tenant}/insights", get(insights::status))
        .route("/api/v1/{tenant}/insights/link", post(insights::link))
        .route("/api/v1/{tenant}/insights/search", get(insights::search))
        .route("/api/v1/{tenant}/sharing/{kind}/{id}", get(sharing::get_sharing))
        .route("/api/v1/{tenant}/sharing/{kind}/{id}/invitations", post(sharing::invite))
        .route("/api/v1/{tenant}/sharing/{kind}/{id}/people/{user}", put(sharing::set_person))
        .route("/api/v1/{tenant}/invitations/{id}", delete(sharing::revoke))
        .route("/api/v1/{tenant}/invitations/accept", post(sharing::accept))
        .route("/auth/me", patch(profile::update_profile))
        .route("/auth/me/email", put(profile::change_email))
        .route("/auth/identities", get(profile::identities))
        .route("/auth/oidc/providers", get(profile::oidc_providers))
        .route("/auth/oidc/{slug}/start", get(oidc::start))
        .route("/auth/oidc/{slug}/callback", get(oidc::callback))
        .route("/auth/oidc/{slug}/link", post(oidc::link).delete(profile::oidc_unlink))
        .route("/auth/password/reset/request", post(profile::reset_request))
        .route("/auth/signup", get(signup::get_public_policy).post(signup::sign_up))
        .route("/auth/invitation", post(signup::preview_invitation))
        .route("/auth/bootstrap", get(signup::get_bootstrap).post(signup::post_bootstrap))
}
