//! Migration plans as they are read back (`ddl/migration.ts`: `Migration`, `toMigration`,
//! `listMigrations`) and published (`serializeMigration` of `app.ts`).

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::time::iso;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};

type R<T> = Result<T, AppError>;

#[derive(Debug, Clone)]
pub struct Migration {
    pub id: String,
    pub base_id: String,
    pub sequence: Option<i64>,
    pub label: String,
    pub origin: String,
    pub status: String,
    pub step: Option<i32>,
    pub step_count: Option<i32>,
    pub step_label: Option<String>,
    pub error_code: Option<String>,
    pub failed_statement: Option<String>,
    pub requested_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<i32>,
}

impl Migration {
    /// `serializeMigration`: `failed_statement` is ours and published, `pg_message` never.
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "sequence": self.sequence,
            "label": self.label,
            "origin": self.origin,
            "status": self.status,
            "step": self.step,
            "step_count": self.step_count,
            "step_label": self.step_label,
            "error_code": self.error_code,
            "failed_statement": self.failed_statement,
            "requested_at": iso(self.requested_at),
            "finished_at": self.finished_at.map(iso),
            "duration_ms": self.duration_ms,
        })
    }
}

pub const SELECT_MIGRATION: &str = "SELECT id::text, base_id::text, sequence, label, origin, status, step, step_count,
         up_sql, error_code, failed_statement, requested_at, finished_at, duration_ms
    FROM _basedb.migration";

/// `toMigration`: the current step's label, from the plan.
pub fn to_migration(r: &tokio_postgres::Row) -> Migration {
    let step: Option<i32> = r.get(6);
    let up_sql: Value = r.get(8);
    let step_label = step.and_then(|s| usize::try_from(s).ok()).and_then(|s| up_sql.get(s)).and_then(|s| s.get("label")).and_then(Value::as_str).map(String::from);
    Migration {
        id: r.get(0),
        base_id: r.get(1),
        sequence: r.get(2),
        label: r.get(3),
        origin: r.get(4),
        status: r.get(5),
        step,
        step_count: r.get(7),
        step_label,
        error_code: r.get(9),
        failed_statement: r.get(10),
        requested_at: r.get(11),
        finished_at: r.get(12),
        duration_ms: r.get(13),
    }
}

/// `read`: one plan.
pub async fn read_migration<E: Exec + Sync>(exec: &E, migration_id: &str) -> R<Migration> {
    exec.first(&format!("{SELECT_MIGRATION} WHERE id = $1::text::uuid"), &[&migration_id])
        .await?
        .as_ref()
        .map(to_migration)
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("migration", json!(migration_id)))
}

/// `listMigrations`: the fifty latest plans of a base. No check of its own: whoever
/// resolved the base reads them.
pub async fn list_migrations(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Vec<Migration>> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let rows = tx.rows(&format!("{SELECT_MIGRATION} WHERE base_id = $1::text::uuid ORDER BY requested_at DESC LIMIT 50"), &[&base_id]).await?;
        Ok(rows.iter().map(to_migration).collect())
    })
    .await
}
