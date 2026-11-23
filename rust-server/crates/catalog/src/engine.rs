//! The migration state machine (`ddl/migration.ts`): propose, approve, claim, apply step
//! by step, finish — or record the failure. A plan is a list of steps, each run in its
//! own `ddl` transaction; the step counter is written back on the catalog pool between
//! two of them, so `resume` picks a half-applied plan up where it stopped.

use crate::migrations::{read_migration, Migration};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{translate_pg, AppError, SqlOp};
use basedb_base::time::sha256;
use basedb_base::tx::{with_transaction, RequestContext, Surface, TxOptions};
use serde_json::{json, Map, Value};
use std::sync::{Arc, Mutex};

type R<T> = Result<T, AppError>;

/// `PLANNER_VERSION`.
const PLANNER_VERSION: i32 = 1;
/// `LEASE_MS`.
const LEASE_MS: i64 = 120_000;
/// `MAX_STEPS`.
pub const MAX_STEPS: usize = 64;

/// `MigrationStep`: what runs in ONE transaction.
#[derive(Debug, Clone)]
pub struct Step {
    pub label: String,
    pub statements: Vec<String>,
    pub lock: &'static str,
}

impl Step {
    pub fn new(label: impl Into<String>, statements: Vec<String>, lock: &'static str) -> Step {
        Step { label: label.into(), statements, lock }
    }

    fn to_json(&self) -> Value {
        json!({ "label": self.label, "statements": self.statements, "lock": self.lock })
    }
}

/// `ProposeRequest`.
pub struct Proposal {
    pub base_id: String,
    pub label: String,
    pub origin: &'static str,
    pub steps: Vec<Step>,
    pub catalog_diff: Value,
    pub affected_objects: Option<Value>,
}

/// The origin a surface gives a plan: `mcp`, `rest`, else `ui`.
pub fn origin_of(ctx: &RequestContext) -> &'static str {
    match ctx.surface {
        Surface::Mcp => "mcp",
        Surface::Rest => "rest",
        _ => "ui",
    }
}

/// `canonical`: keys sorted at every depth (JavaScript string order).
pub fn canonical(value: &Value) -> String {
    match value {
        Value::Array(items) => format!("[{}]", items.iter().map(canonical).collect::<Vec<_>>().join(",")),
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            format!(
                "{{{}}}",
                keys.into_iter().map(|k| format!("{}:{}", Value::String(k.clone()), canonical(&map[k]))).collect::<Vec<_>>().join(",")
            )
        }
        other => basedb_base::idempotency::js_stringify(other),
    }
}

fn checksum_of(steps: &Value) -> Vec<u8> {
    sha256(canonical(steps).as_bytes())
}

/// `assertStructureOpen`.
async fn assert_structure_open<E: Exec + Sync>(exec: &E, base_id: &str) -> R<()> {
    let row = exec.first("SELECT structure_state, is_live FROM _basedb.base WHERE id = $1::text::uuid", &[&base_id]).await?;
    let Some(row) = row else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)));
    };
    let state: String = row.get(0);
    if state == "frozen" {
        return Err(AppError::new("BASE_STRUCTURE_FROZEN").with("base", json!(base_id)));
    }
    Ok(())
}

/// `proposeMigration`: records the plan, touches nothing else. The id of the plan.
pub async fn propose(pools: &Pools, ctx: &RequestContext, p: &Proposal) -> R<String> {
    if p.steps.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("steps")).with("detail", json!("un plan vide ne se propose pas")));
    }
    if p.steps.len() > MAX_STEPS {
        return Err(AppError::new("MIGRATION_TOO_LARGE").with("steps", json!(p.steps.len())).with("maximum", json!(MAX_STEPS)));
    }
    let steps = Value::Array(p.steps.iter().map(Step::to_json).collect());
    let checksum = checksum_of(&steps);
    let affected = p.affected_objects.clone().unwrap_or_else(|| json!([]));
    let count = p.steps.len() as i32;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let (steps, checksum, affected) = (steps.clone(), checksum.clone(), affected.clone());
        async move {
            assert_structure_open(&tx, &p.base_id).await?;
            let row = tx
                .query_op(
                    "INSERT INTO _basedb.migration
                       (base_id, label, origin, status, planner_version, up_sql, down_sql, checksum,
                        catalog_diff, affected_objects, step_count, requested_by)
                     VALUES ($1::text::uuid, $2, $3, 'proposed', $4, $5::jsonb, NULL, $6,
                             $7::jsonb, $8::jsonb, $9, $10::text::uuid)
                     RETURNING id::text",
                    &[&p.base_id, &p.label, &p.origin, &PLANNER_VERSION, &steps, &checksum, &p.catalog_diff, &affected, &count, &ctx.actor.id],
                    SqlOp::Insert,
                )
                .await?;
            Ok(row[0].get::<_, String>(0))
        }
    })
    .await
}

/// `approveMigration`.
pub async fn approve(pools: &Pools, ctx: &RequestContext, migration_id: &str) -> R<()> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let changed = tx
            .query_op(
                "UPDATE _basedb.migration
                    SET status = 'approved', approved_by = $2::text::uuid, approved_at = clock_timestamp()
                  WHERE id = $1::text::uuid AND status = 'proposed'
                  RETURNING id",
                &[&migration_id, &ctx.actor.id],
                SqlOp::Update,
            )
            .await?;
        if changed.is_empty() {
            return Err(AppError::new("MIGRATION_STALE").with("migration", json!(migration_id)));
        }
        Ok(())
    })
    .await
}

struct Claimed {
    base_id: String,
    steps: Vec<(String, Vec<String>)>,
    start_at: usize,
}

fn executor_id(ctx: &RequestContext) -> String {
    format!("{}@{}", std::process::id(), ctx.request_id.chars().take(8).collect::<String>())
}

async fn claim(pools: &Pools, ctx: &RequestContext, migration_id: &str) -> R<Claimed> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let found = tx
            .first(
                "SELECT base_id::text, status, up_sql, checksum, step, lease_until
                   FROM _basedb.migration WHERE id = $1::text::uuid FOR UPDATE",
                &[&migration_id],
            )
            .await?;
        let Some(found) = found else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("migration", json!(migration_id)));
        };
        let base_id: String = found.get(0);
        let status: String = found.get(1);
        let up_sql: Value = found.get(2);
        let checksum: Vec<u8> = found.get(3);
        let step: Option<i32> = found.get(4);
        let lease: Option<chrono::DateTime<chrono::Utc>> = found.get(5);
        if status == "applied" {
            return Err(AppError::new("MIGRATION_STALE").with("reason", json!("déjà appliquée")));
        }
        if status == "applying" {
            if lease.is_some_and(|l| l.timestamp_millis() > ctx.timestamp.timestamp_millis()) {
                return Err(AppError::new("MIGRATION_IN_PROGRESS").with("migration", json!(migration_id)));
            }
        } else if status != "approved" && status != "interrupted" {
            return Err(AppError::new("MIGRATION_STALE").with("status", json!(status)));
        }
        if checksum_of(&up_sql) != checksum {
            return Err(AppError::new("MIGRATION_TAMPERED").with("migration", json!(migration_id)));
        }
        let lease_ms = LEASE_MS.to_string();
        tx.execute_op(
            "UPDATE _basedb.migration
                SET status = 'applying',
                    sequence = COALESCE(sequence,
                                 (SELECT COALESCE(MAX(m.sequence), 0) + 1
                                    FROM _basedb.migration m WHERE m.base_id = $2::text::uuid)),
                    executor_id = $3,
                    lease_until = clock_timestamp() + ($4 || ' milliseconds')::interval,
                    attempts = attempts + 1,
                    started_at = COALESCE(started_at, clock_timestamp())
              WHERE id = $1::text::uuid",
            &[&migration_id, &base_id, &executor_id(ctx), &lease_ms],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op(
            "UPDATE _basedb.base SET current_migration_id = $2::text::uuid WHERE id = $1::text::uuid",
            &[&base_id, &migration_id],
            SqlOp::Update,
        )
        .await?;
        let steps = up_sql
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|s| {
                        let label = s.get("label").and_then(Value::as_str).unwrap_or_default().to_string();
                        let statements = s
                            .get("statements")
                            .and_then(Value::as_array)
                            .map(|l| l.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                            .unwrap_or_default();
                        (label, statements)
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(Claimed { base_id, steps, start_at: step.unwrap_or(0).max(0) as usize })
    })
    .await
}

/// What PostgreSQL said when a step failed: kept in the catalog row, never published.
#[derive(Default, Clone)]
struct PgDiagnostics {
    sqlstate: Option<String>,
    message: Option<String>,
    detail: Option<String>,
    hint: Option<String>,
    constraint: Option<String>,
}

fn diagnostics_of(e: &tokio_postgres::Error) -> PgDiagnostics {
    match e.as_db_error() {
        Some(db) => PgDiagnostics {
            sqlstate: Some(db.code().code().to_string()),
            message: Some(db.message().to_string()),
            detail: db.detail().map(str::to_string),
            hint: db.hint().map(str::to_string),
            constraint: db.constraint().map(str::to_string),
        },
        None => PgDiagnostics { message: Some(e.to_string()), ..Default::default() },
    }
}

/// `applyMigration`: runs a plan to completion, from where it stopped.
pub async fn apply(pools: &Pools, ctx: &RequestContext, migration_id: &str) -> R<Migration> {
    let plan = claim(pools, ctx, migration_id).await?;
    let started = std::time::Instant::now();
    for (index, (_, statements)) in plan.steps.iter().enumerate().skip(plan.start_at) {
        let seen: Arc<Mutex<Option<PgDiagnostics>>> = Arc::new(Mutex::new(None));
        let outcome = with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| {
            let seen = seen.clone();
            async move {
                tx.rows("SELECT set_config('basedb.migration_id', $1, true)", &[&migration_id]).await?;
                for statement in statements {
                    if let Err(e) = tx.client().batch_execute(statement).await {
                        *seen.lock().unwrap() = Some(diagnostics_of(&e));
                        return Err(translate_pg(&e, SqlOp::Ddl));
                    }
                }
                Ok(())
            }
        })
        .await;
        if let Err(error) = outcome {
            let pg = seen.lock().unwrap().clone();
            record_failure(pools, ctx, migration_id, index, statements, &error, pg).await;
            return Err(error);
        }
        let lease_ms = LEASE_MS.to_string();
        let next = (index + 1) as i32;
        with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
            let lease_ms = lease_ms.clone();
            async move {
                tx.execute_op(
                    "UPDATE _basedb.migration
                        SET step = $2, lease_until = clock_timestamp() + ($3 || ' milliseconds')::interval
                      WHERE id = $1::text::uuid",
                    &[&migration_id, &next, &lease_ms],
                    SqlOp::Update,
                )
                .await
            }
        })
        .await?;
    }
    finish(pools, ctx, migration_id, &plan.base_id, started.elapsed().as_millis() as i32).await
}

async fn finish(pools: &Pools, ctx: &RequestContext, migration_id: &str, base_id: &str, duration_ms: i32) -> R<Migration> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        tx.execute_op(
            "UPDATE _basedb.migration
                SET status = 'applied', applied_by = $2::text::uuid, applied_at = clock_timestamp(),
                    finished_at = clock_timestamp(), duration_ms = $3,
                    executor_id = NULL, lease_until = NULL
              WHERE id = $1::text::uuid",
            &[&migration_id, &ctx.actor.id, &duration_ms],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op(
            "UPDATE _basedb.base
                SET catalog_version = catalog_version + 1,
                    current_migration_id = NULL,
                    updated_at = clock_timestamp(), updated_by = $2::text::uuid
              WHERE id = $1::text::uuid",
            &[&base_id, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        tx.rows("SELECT pg_notify('basedb_catalog', $1)", &[&base_id]).await?;
        read_migration(&tx, migration_id).await
    })
    .await
}

/// `recordFailure`: best effort — the caller's error is the one that matters.
async fn record_failure(pools: &Pools, ctx: &RequestContext, migration_id: &str, index: usize, statements: &[String], error: &AppError, pg: Option<PgDiagnostics>) {
    let pg = pg.unwrap_or_else(|| PgDiagnostics { message: Some(error.code.to_string()), ..Default::default() });
    let sqlstate = pg.sqlstate.filter(|s| s.len() == 5 && s.bytes().all(|b| b.is_ascii_digit() || b.is_ascii_uppercase()));
    let n = index as i32;
    let failed = statements.join("\n");
    let code = error.code;
    let _ = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let (sqlstate, message, detail, hint, constraint) = (sqlstate.clone(), pg.message.clone(), pg.detail.clone(), pg.hint.clone(), pg.constraint.clone());
        let failed = failed.clone();
        async move {
            tx.execute_op(
                "UPDATE _basedb.migration
                    SET status = 'failed', finished_at = clock_timestamp(),
                        executor_id = NULL, lease_until = NULL,
                        error_code = $2, pg_sqlstate = $3, pg_message = $4, pg_detail = $5,
                        pg_hint = $6, pg_constraint_name = $7,
                        failed_statement_n = $8, failed_statement = $9
                  WHERE id = $1::text::uuid",
                &[&migration_id, &code, &sqlstate, &message, &detail, &hint, &constraint, &n, &failed],
                SqlOp::Update,
            )
            .await
        }
    })
    .await;
}

/// `runMigration`: propose, approve, apply — the path the UI takes for its own acts.
pub async fn run(pools: &Pools, ctx: &RequestContext, p: &Proposal) -> R<Migration> {
    let id = propose(pools, ctx, p).await?;
    approve(pools, ctx, &id).await?;
    apply(pools, ctx, &id).await
}

/// A catalog diff from pairs, in order.
pub fn diff(pairs: &[(&str, Value)]) -> Value {
    let mut m = Map::new();
    for (k, v) in pairs {
        m.insert((*k).to_string(), v.clone());
    }
    Value::Object(m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_sorts_keys_at_every_depth() {
        let v = json!([{ "statements": ["a"], "lock": "short", "label": "x" }]);
        assert_eq!(canonical(&v), r#"[{"label":"x","lock":"short","statements":["a"]}]"#);
        assert_eq!(canonical(&json!({ "b": 1.0, "a": null })), r#"{"a":null,"b":1}"#);
    }
}
