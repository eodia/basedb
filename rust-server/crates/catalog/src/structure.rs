//! A transaction on the owner's connection (the `ddl` pool) — `inStructure` of
//! `catalog/sql-views.ts`, and the frame every structure step runs in. Unlike
//! [`basedb_base::tx::with_transaction`], it sets no `basedb.*` session settings: what it
//! writes names its author explicitly.

use basedb_base::db::{Conn, Exec, PoolName, Pools};
use basedb_base::error::{translate_pg, AppError, SqlOp};
use basedb_base::tx::TxGuard;
use std::future::Future;
use std::sync::Arc;

/// The connection of a structure transaction. Clone it freely inside the work.
#[derive(Clone)]
pub struct StructureTx(Arc<Conn>);

impl Exec for StructureTx {
    fn client(&self) -> &tokio_postgres::Client {
        &self.0
    }
}

impl StructureTx {
    /// A statement through the EXTENDED protocol, which refuses a second statement: the
    /// text written by a person and run by the owner stays one statement. The raw error,
    /// for the caller to word.
    pub async fn single(&self, sql: &str) -> Result<(), tokio_postgres::Error> {
        self.0.execute(sql, &[]).await.map(|_| ())
    }

    /// A statement without parameters, as `exec.query(sql)` sends it (simple protocol).
    pub async fn simple(&self, sql: &str) -> Result<(), AppError> {
        self.0.batch_execute(sql).await.map_err(|e| translate_pg(&e, SqlOp::Ddl))
    }
}

/// `inStructure`: `BEGIN`, the work, `COMMIT` — `ROLLBACK` on any failure.
pub async fn in_structure<T, F, Fut>(pools: &Pools, work: F) -> Result<T, AppError>
where
    F: FnOnce(StructureTx) -> Fut,
    Fut: Future<Output = Result<T, AppError>>,
{
    let conn = pools.get(PoolName::Ddl).await?;
    let tx = StructureTx(Arc::new(conn));
    let mut guard = TxGuard::new(tx.0.clone());
    let outcome = async {
        tx.0.batch_execute("BEGIN").await.map_err(|e| translate_pg(&e, SqlOp::Select))?;
        let result = work(tx.clone()).await?;
        tx.0.batch_execute("COMMIT").await.map_err(|e| translate_pg(&e, SqlOp::Select))?;
        Ok(result)
    }
    .await;
    if outcome.is_err() {
        let _ = tx.0.batch_execute("ROLLBACK").await;
    }
    guard.disarm();
    outcome
}
