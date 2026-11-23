//! Le catalogue de basedb : bases, tables, champs, structure (DDL), méta, projets, modèles,
//! environnements, console SQL (`core/src/catalog`, `ddl`, `sql`, `environments`, `templates`).
//!
//! Convention (voir `rust-server/README.md`, « Conventions des domaines ») : [`router`] rend
//! les routes natives du domaine ; ce qui n'y est pas répond 404.

// `AppError` (the socle's) is large; every fallible function returns it, as in records.
#![allow(clippy::result_large_err)]

pub mod ai_hooks;
pub mod allocation;
pub mod buttons;
pub mod cache;
pub mod computed_fields;
pub mod deletion;
pub mod description;
pub mod documentation;
pub mod engine;
pub mod family;
pub mod field_config;
pub mod fields;
pub mod formula;
pub mod http;
pub mod insights_reader;
pub mod js;
pub mod labels;
pub mod lifecycle;
pub mod meta;
pub mod migrations;
pub mod naming;
pub mod openapi;
pub mod operations;
pub mod pg_values;
pub mod projection;
pub mod projects;
pub mod purge;
pub mod queries;
pub mod questions;
pub mod reader;
pub mod routes;
pub mod routes_engine;
pub mod routes_environments;
pub mod routes_fields;
pub mod env_rows;
pub mod environments;
pub mod select_options;
pub mod serve;
pub mod sql_console;
pub mod sql_views;
pub mod structure;
pub mod structure_history;
pub mod targets;
pub mod routes_templates;
pub mod template_apply;
pub mod template_catalog;
pub mod template_check;
pub mod template_i18n;
pub mod views;
pub mod wire;

use axum::routing::{delete, get, patch, post, put};
use routes_engine as eng;
use axum::Router;
use basedb_base::Shared;

/// The domain's native routes; merged by `basedb-server` (`main.rs`).
pub fn router(_st: &Shared) -> Router<Shared> {
    let meta = "/api/v1/{tenant}/meta";
    let admin = "/api/v1/{tenant}/admin";
    let data = "/api/v1/{tenant}/data";
    Router::new()
        .route(&format!("{meta}/bases"), get(serve::list_bases))
        .route(&format!("{meta}/bases/{{base}}"), get(serve::base_meta))
        .route(&format!("{meta}/bases/{{base}}/openapi.json"), get(serve::base_openapi))
        .route(&format!("{meta}/bases/{{base}}/doc"), get(serve::base_doc))
        .route(&format!("{meta}/projects"), get(routes::list_projects))
        .route(&format!("{admin}/projects"), post(routes::create_project))
        .route(&format!("{admin}/projects/{{id}}"), patch(routes::update_project).delete(routes::delete_project))
        .route(&format!("{meta}/bases/{{base}}/queries"), get(routes::list_queries))
        .route(&format!("{meta}/bases/{{base}}/queries/{{query}}"), get(routes::get_query))
        .route(&format!("{admin}/bases/{{base}}/query-groups"), get(routes::query_groups))
        .route(&format!("{admin}/bases/{{base}}/queries"), post(routes::create_query))
        .route(&format!("{admin}/bases/{{base}}/queries/{{query}}"), patch(routes::update_query).delete(routes::delete_query))
        .route(&format!("{data}/{{base}}/{{table}}/buttons"), get(routes::list_buttons).post(routes::create_button))
        .route(&format!("{data}/{{base}}/{{table}}/buttons/{{button}}"), patch(routes::update_button).delete(routes::delete_button))
        .route(&format!("{admin}/bases/deleted"), get(routes::deleted_bases))
        .route(&format!("{admin}/bases/{{base}}/deleted-tables"), get(routes::deleted_tables))
        .route(&format!("{admin}/bases/{{base}}/structure-history"), get(routes::structure_history))
        .route(&format!("{admin}/bases/{{base}}/migrations"), get(routes::list_migrations))
        .route(&format!("{meta}/bases/{{base}}/sql-views"), get(routes::list_sql_views))
        .route(&format!("{meta}/bases/{{base}}/sql-views/{{view}}"), get(routes::get_sql_view))
        .route(&format!("{admin}/bases/{{base}}/sql-views"), post(routes::create_sql_view))
        .route(&format!("{admin}/bases/{{base}}/sql-views/order"), put(routes::reorder_sql_views))
        .route(&format!("{admin}/bases/{{base}}/sql-views/{{view}}"), patch(routes::update_sql_view).delete(routes::delete_sql_view))
        .route(&format!("{meta}/bases/{{base}}/questions"), get(routes::list_questions))
        .route(&format!("{meta}/bases/{{base}}/questions/{{id}}"), get(routes::get_question))
        .route(&format!("{admin}/bases/{{base}}/questions"), post(routes::create_question))
        .route(&format!("{admin}/bases/{{base}}/questions/{{id}}"), patch(routes::update_question).delete(routes::delete_question))
        .route(&format!("{meta}/bases/{{base}}/tables/{{table}}/views"), get(routes::list_views))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/views"), post(routes::create_view))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/views/order"), put(routes::reorder_views))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/views/{{view}}"), patch(routes::update_view).delete(routes::delete_view))
        .route(&format!("{meta}/templates"), get(routes_templates::list))
        .route(&format!("{meta}/templates/{{key}}"), get(routes_templates::get_one))
        .route(&format!("{admin}/templates"), post(routes_templates::import))
        .route(&format!("{admin}/templates/{{key}}"), delete(routes_templates::delete))
        .route(&format!("{admin}/bases"), post(routes::create_base))
        .route(&format!("{admin}/bases/{{base}}"), patch(routes::update_base).delete(eng::delete_base))
        .route(&format!("{admin}/bases/{{base}}/tables"), post(routes::create_table))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}"), patch(routes::update_table).delete(eng::delete_table))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/fields/order"), put(routes::reorder_fields))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/fields/{{field}}"), patch(routes::update_field).delete(eng::delete_field))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/fields"), post(routes_fields::add_field))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/links"), post(routes_fields::create_link))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/display"), post(routes_fields::set_display))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/fields/{{field}}/options"), put(routes_fields::set_options))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/fields/{{field}}/required"), post(routes_fields::set_required))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/fields/{{field}}/unique"), post(routes_fields::set_unique))
        .route(&format!("{admin}/bases/{{base}}/restore"), post(eng::restore_base))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/deletion"), get(eng::table_deletion))
        .route(&format!("{admin}/bases/{{base}}/tables/{{table}}/fields/{{field}}/deletion"), get(eng::field_deletion))
        .route(&format!("{admin}/migrations/{{id}}/resume"), post(eng::resume_migration))
        .route(&format!("{admin}/purge/exports"), post(eng::purge_export))
        .route(&format!("{admin}/purge"), post(eng::purge))
        .route(&format!("{admin}/bases/{{base}}/environments"), get(eng::list_environments).post(routes_environments::create_environment))
        .route(&format!("{admin}/bases/{{base}}/environments/compare"), get(routes_environments::compare))
        .route(&format!("{admin}/bases/{{base}}/environments/plan"), get(routes_environments::plan))
        .route(&format!("{admin}/bases/{{base}}/environments/apply"), post(routes_environments::apply))
        .route(&format!("{admin}/bases/{{base}}/environments/rows"), get(routes_environments::count_rows))
        .route(&format!("{admin}/bases/{{base}}/environments/rows/{{table}}"), get(routes_environments::compare_rows))
        .route(&format!("{admin}/bases/{{base}}/environments/rows/{{table}}/sync"), post(routes_environments::sync_rows))
        .route(&format!("{admin}/bases/{{base}}/environments/{{env}}"), patch(eng::rename_environment).delete(eng::delete_environment))
        .route("/api/v1/{tenant}/sql/{base}", post(sql_console::post_sql))
        .route("/api/v1/{tenant}/sql/{base}/views/{view}", get(sql_console::get_sql_view_rows))
        .route("/api/insights/reader", post(insights_reader::post_reader))
}