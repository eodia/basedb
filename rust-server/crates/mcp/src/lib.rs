//! The MCP server (`apps/mcp`, chapter 09): the agents' entry point, at the same rank as
//! the REST API — the tools call the agent library of `basedb-automations` (and the
//! insights client of `basedb-admin`) in process, with the token of the request.
//!
//! Served by `basedb-server` itself, on `/mcp` of its own port (outside the API's layers:
//! no CORS, no demo guard, a request id of its own), and — when `BASEDB_MCP_PORT` is
//! set — on a listener of its own, as the Node process was (`/mcp`, `/healthz`).

#![allow(clippy::result_large_err)]

pub mod errors;
pub mod routes;
pub mod sessions;
pub mod shape;
pub mod tools;
pub mod validate;

use axum::extract::DefaultBodyLimit;
use axum::routing::get;
use axum::{Json, Router};
use basedb_ai as _; // in the plan's graph; no tool calls it today
use basedb_base::db::{default_settings, PoolName, Pools};
use basedb_base::Shared;
use serde_json::json;
use std::sync::{Mutex, OnceLock};

/// What the entry point holds in memory: its sessions, its quota, its pools.
#[derive(Default)]
pub struct McpState {
    pub sessions: Mutex<sessions::Sessions>,
    pub quota: Mutex<sessions::Quota>,
    pools: OnceLock<Option<Pools>>,
}

impl McpState {
    /// The agent surface's pools (`server.ts`): statements stop after 5 seconds, locks are
    /// waited for 1 second at most (§11.3) — the DDL pool keeps its settings.
    pub fn pools<'a>(&'a self, st: &'a Shared) -> &'a Pools {
        self.pools
            .get_or_init(|| {
                Pools::with_settings(&st.cfg.database_url, |name| {
                    let mut s = default_settings(name);
                    if name != PoolName::Ddl {
                        s.statement_timeout_ms = 5_000;
                        s.lock_timeout_ms = 1_000;
                    }
                    s
                })
                .ok()
            })
            .as_ref()
            .unwrap_or(&st.pools)
    }
}

/// `/mcp`, merged by `basedb-server` OUTSIDE `app::build` (its own headers, no CORS).
pub fn router(_st: &Shared) -> Router<Shared> {
    Router::new()
        .route("/mcp", get(routes::get_mcp).post(routes::post_mcp).delete(routes::delete_mcp))
        .layer(DefaultBodyLimit::disable())
}

/// The listener of its own (`BASEDB_MCP_PORT`): `/mcp` and `/healthz`, as `server.ts`.
pub fn standalone(st: &Shared) -> Router {
    router(st).route("/healthz", get(|| async { Json(json!({ "status": "ok" })) })).with_state(st.clone())
}

