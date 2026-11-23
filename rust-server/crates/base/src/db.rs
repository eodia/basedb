//! Les pools PostgreSQL, tels `runtime/pool.ts` : trois pools nommés (`catalog`, `data`,
//! `ddl`), chacun avec ses délais de garde passés AU DÉMARRAGE de la connexion (options de
//! démarrage), et le contrat de connexion (`search_path` vide, `TimeZone=UTC`, `DateStyle`,
//! `IntervalStyle`…), vérifié à la création de chaque connexion — `CONNECTION_CONTRACT_BROKEN`
//! sinon.
//!
//! Aucun `SET ROLE` : Node se connecte avec le rôle de `DATABASE_URL`, et la séparation des
//! acteurs passe par les réglages de transaction (`basedb.actor_*`, voir [`crate::tx`]).
//!
//! Exécuter : [`Exec`] sur une connexion ([`Conn`]) ou une transaction ([`crate::tx::Tx`]),
//! chaque erreur PostgreSQL traduite par `translatePgError` ([`crate::error::translate_pg`]).

use crate::error::{translate_pg, AppError, SqlOp};
use deadpool_postgres::{HookError, Manager, ManagerConfig, Pool, RecyclingMethod};
use std::time::Duration;
use tokio_postgres::types::ToSql;
use tokio_postgres::{NoTls, Row};

/// `PoolName`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PoolName {
    Catalog,
    Data,
    Ddl,
}

impl PoolName {
    pub const ALL: [PoolName; 3] = [PoolName::Catalog, PoolName::Data, PoolName::Ddl];
    pub fn as_str(self) -> &'static str {
        match self {
            PoolName::Catalog => "catalog",
            PoolName::Data => "data",
            PoolName::Ddl => "ddl",
        }
    }
}

/// `PoolSettings`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PoolSettings {
    pub max: usize,
    pub lock_timeout_ms: u64,
    pub statement_timeout_ms: u64,
    pub idle_in_transaction_timeout_ms: u64,
    /// `0`: wait as long as it takes (the DDL pool).
    pub acquire_timeout_ms: u64,
}

/// `DEFAULT_SETTINGS`.
pub fn default_settings(name: PoolName) -> PoolSettings {
    match name {
        PoolName::Catalog => PoolSettings { max: 10, lock_timeout_ms: 3_000, statement_timeout_ms: 15_000, idle_in_transaction_timeout_ms: 30_000, acquire_timeout_ms: 15_000 },
        PoolName::Data => PoolSettings { max: 20, lock_timeout_ms: 3_000, statement_timeout_ms: 30_000, idle_in_transaction_timeout_ms: 30_000, acquire_timeout_ms: 15_000 },
        PoolName::Ddl => PoolSettings { max: 2, lock_timeout_ms: 5_000, statement_timeout_ms: 600_000, idle_in_transaction_timeout_ms: 60_000, acquire_timeout_ms: 0 },
    }
}

/// `CONNECTION_CONTRACT`.
pub const CONNECTION_CONTRACT: [(&str, &str); 6] = [
    ("search_path", ""),
    ("TimeZone", "UTC"),
    ("DateStyle", "ISO, YMD"),
    ("IntervalStyle", "iso_8601"),
    ("client_encoding", "UTF8"),
    ("standard_conforming_strings", "on"),
];

/// `startupOptions(extra)`: `-c key=value …`, spaces escaped.
pub fn startup_options(extra: &[(&str, String)]) -> String {
    let mut pairs: Vec<(String, String)> = CONNECTION_CONTRACT.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    for (k, v) in extra {
        match pairs.iter_mut().find(|(key, _)| key == k) {
            Some(p) => p.1 = v.clone(),
            None => pairs.push((k.to_string(), v.clone())),
        }
    }
    pairs.iter().map(|(k, v)| format!("-c {k}={}", v.replace(' ', "\\ "))).collect::<Vec<_>>().join(" ")
}

/// A driver configuration with the contract, the timeouts and `application_name`.
pub fn pg_config(database_url: &str, application_name: &str, extra: &[(&str, String)]) -> Result<tokio_postgres::Config, String> {
    let mut pg: tokio_postgres::Config = database_url.parse().map_err(|e| format!("DATABASE_URL invalide : {e}"))?;
    pg.options(startup_options(extra));
    pg.application_name(application_name);
    pg.keepalives(true);
    pg.keepalives_idle(Duration::from_secs(30));
    Ok(pg)
}

/// A connection borrowed from a pool (autocommit).
pub type Conn = deadpool_postgres::Object;

/// `Pools`.
#[derive(Clone)]
pub struct Pools {
    pub catalog: Pool,
    pub data: Pool,
    pub ddl: Pool,
}

fn build_pool(database_url: &str, name: PoolName, s: PoolSettings) -> Result<Pool, String> {
    let pg = pg_config(
        database_url,
        &format!("basedb:{}", name.as_str()),
        &[
            ("lock_timeout", format!("{}ms", s.lock_timeout_ms)),
            ("statement_timeout", format!("{}ms", s.statement_timeout_ms)),
            ("idle_in_transaction_session_timeout", format!("{}ms", s.idle_in_transaction_timeout_ms)),
        ],
    )?;
    let manager = Manager::from_config(pg, NoTls, ManagerConfig { recycling_method: RecyclingMethod::Fast });
    let mut b = Pool::builder(manager).max_size(s.max).runtime(deadpool_postgres::Runtime::Tokio1);
    if s.acquire_timeout_ms > 0 {
        b = b.wait_timeout(Some(Duration::from_millis(s.acquire_timeout_ms))).create_timeout(Some(Duration::from_millis(s.acquire_timeout_ms)));
    }
    // The contract, checked once per connection, on its creation (Node: on first acquire).
    let pool_name = name.as_str();
    b = b.post_create(deadpool_postgres::Hook::async_fn(move |client: &mut deadpool_postgres::ClientWrapper, _| {
        Box::pin(async move {
            let row = client
                .query_one("SELECT current_setting('search_path') AS search_path, current_setting('TimeZone') AS timezone", &[])
                .await
                .map_err(HookError::Backend)?;
            let (search_path, timezone): (String, String) = (row.get(0), row.get(1));
            if !search_path.is_empty() || timezone != "UTC" {
                return Err(HookError::message(format!(
                    "CONNECTION_CONTRACT_BROKEN pool={pool_name} search_path={search_path:?} TimeZone={timezone:?}"
                )));
            }
            Ok(())
        })
    }));
    b.build().map_err(|e| e.to_string())
}

impl Pools {
    pub fn new(database_url: &str) -> Result<Pools, String> {
        Ok(Pools {
            catalog: build_pool(database_url, PoolName::Catalog, default_settings(PoolName::Catalog))?,
            data: build_pool(database_url, PoolName::Data, default_settings(PoolName::Data))?,
            ddl: build_pool(database_url, PoolName::Ddl, default_settings(PoolName::Ddl))?,
        })
    }

    /// `startKernel({ poolSettings })`: pools of the same database under other bounds — the
    /// MCP surface's shorter statement and lock timeouts.
    pub fn with_settings(database_url: &str, settings: impl Fn(PoolName) -> PoolSettings) -> Result<Pools, String> {
        Ok(Pools {
            catalog: build_pool(database_url, PoolName::Catalog, settings(PoolName::Catalog))?,
            data: build_pool(database_url, PoolName::Data, settings(PoolName::Data))?,
            ddl: build_pool(database_url, PoolName::Ddl, settings(PoolName::Ddl))?,
        })
    }

    pub fn pool(&self, name: PoolName) -> &Pool {
        match name {
            PoolName::Catalog => &self.catalog,
            PoolName::Data => &self.data,
            PoolName::Ddl => &self.ddl,
        }
    }

    /// `acquire`: a connection, or the translated failure (`SERVICE_UNAVAILABLE`,
    /// `CONNECTION_CONTRACT_BROKEN`).
    pub async fn get(&self, name: PoolName) -> Result<Conn, AppError> {
        self.pool(name).get().await.map_err(|e| match e {
            deadpool_postgres::PoolError::Backend(pg) => translate_pg(&pg, SqlOp::Select),
            deadpool_postgres::PoolError::PostCreateHook(deadpool_postgres::HookError::Backend(pg)) => translate_pg(&pg, SqlOp::Select),
            deadpool_postgres::PoolError::PostCreateHook(deadpool_postgres::HookError::Message(m)) if m.starts_with("CONNECTION_CONTRACT_BROKEN") => {
                AppError::new("CONNECTION_CONTRACT_BROKEN").with("pool", serde_json::json!(name.as_str())).caused_by(m)
            }
            other => AppError::new("SERVICE_UNAVAILABLE").caused_by(other),
        })
    }

    /// `withConnection('catalog', …)`.
    pub async fn catalog(&self) -> Result<Conn, AppError> {
        self.get(PoolName::Catalog).await
    }
}

/// `Executor.query`, on anything that runs statements: rows, errors translated.
pub trait Exec {
    fn client(&self) -> &tokio_postgres::Client;

    /// `exec.query(sql, params, operation)`.
    fn query_op(&self, sql: &str, params: &[&(dyn ToSql + Sync)], op: SqlOp) -> impl std::future::Future<Output = Result<Vec<Row>, AppError>> + Send
    where
        Self: Sync,
    {
        async move { self.client().query(sql, params).await.map_err(|e| translate_pg(&e, op)) }
    }

    /// A `SELECT`.
    fn rows(&self, sql: &str, params: &[&(dyn ToSql + Sync)]) -> impl std::future::Future<Output = Result<Vec<Row>, AppError>> + Send
    where
        Self: Sync,
    {
        self.query_op(sql, params, SqlOp::Select)
    }

    /// The first row, if any.
    fn first(&self, sql: &str, params: &[&(dyn ToSql + Sync)]) -> impl std::future::Future<Output = Result<Option<Row>, AppError>> + Send
    where
        Self: Sync,
    {
        async move { Ok(self.rows(sql, params).await?.into_iter().next()) }
    }

    /// A statement whose rows do not matter; the number of rows it touched.
    fn execute_op(&self, sql: &str, params: &[&(dyn ToSql + Sync)], op: SqlOp) -> impl std::future::Future<Output = Result<u64, AppError>> + Send
    where
        Self: Sync,
    {
        async move { self.client().execute(sql, params).await.map_err(|e| translate_pg(&e, op)) }
    }
}

impl Exec for tokio_postgres::Client {
    fn client(&self) -> &tokio_postgres::Client {
        self
    }
}

impl Exec for Conn {
    fn client(&self) -> &tokio_postgres::Client {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_options_are_node_s() {
        assert_eq!(
            startup_options(&[("lock_timeout", "3000ms".into())]),
            "-c search_path= -c TimeZone=UTC -c DateStyle=ISO,\\ YMD -c IntervalStyle=iso_8601 -c client_encoding=UTF8 -c standard_conforming_strings=on -c lock_timeout=3000ms"
        );
        assert_eq!(default_settings(PoolName::Ddl).acquire_timeout_ms, 0);
        assert_eq!(default_settings(PoolName::Data).max, 20);
    }
}
