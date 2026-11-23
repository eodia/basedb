//! The AI fields' worker (`startAiWorker` of `core/src/ai/field.ts`), and the `ai_call`
//! journal's monthly partitions (the `ai_call` part of `ensureJournalPartitions`).
//!
//! Started by `basedb-server` unless `BASEDB_RUST_BACKGROUND=0` or `BASEDB_AI_WORKER=0` (a
//! second server sharing the database, where one worker is enough). Two workers may share it: a field is taken under the same lease (`field_ai_config.lease_until`,
//! five minutes) by one worker at a time, and an empty cell is written only while still empty.

use crate::fields::{compute_row, link_displays, load_field, read_rows, CellRow, FIRST};
use crate::provider::resolve_provider;
use crate::schedule::{check_timezone, next_run, parse_cron};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::tx::{with_transaction, Actor, ActorKind, RequestContext, Surface, TxOptions};
use basedb_base::{AppState, Shared};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Pause between two passes.
pub const INTERVAL: Duration = Duration::from_secs(10);
/// Calls one pass may make, all fields together.
pub const PER_PASS: usize = 20;
/// Calls one pass may make for one field.
pub const PER_FIELD: usize = 8;
/// How often the journal's coming months are made sure of.
pub const PARTITIONS_INTERVAL: Duration = Duration::from_secs(24 * 3600);

/// The refusals that say "not now" for the whole field, rather than "not this row".
const FIELD_STOPPERS: [&str; 6] = ["AI_DISABLED", "AI_NOT_CONFIGURED", "AI_QUOTA_EXCEEDED", "AI_PROVIDER_UNAVAILABLE", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR"];

/// Whether this server runs the AI worker.
pub fn enabled(st: &AppState) -> bool {
    st.cfg.background() && st.cfg.setting("BASEDB_AI_WORKER").as_deref() != Some("0")
}

/// Starts the worker's loop and the partitions' (empty when disabled).
pub fn start_background(st: &Shared) -> Vec<tokio::task::JoinHandle<()>> {
    if !enabled(st) {
        return Vec::new();
    }
    let partitions = st.clone();
    let journal = tokio::spawn(async move {
        let mut ticker = tokio::time::interval(PARTITIONS_INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            ticker.tick().await;
            if let Err(e) = ensure_ai_call_partitions(&partitions, Utc::now()).await {
                eprintln!("Partitions de ai_call : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    });
    let st = st.clone();
    let worker = tokio::spawn(async move {
        let worker = Worker::new(PER_PASS, PER_FIELD);
        // As `setTimeout` after each pass: the first one interval after the start.
        loop {
            tokio::time::sleep(INTERVAL).await;
            if let Err(e) = worker.pass(&st).await {
                eprintln!("Champs IA : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    });
    println!("Champs IA : calcul en tâche de fond lancé.");
    vec![journal, worker]
}

/// The monthly partitions of `_basedb.ai_call`, this month and the next two (UTC months).
pub async fn ensure_ai_call_partitions(st: &AppState, now: chrono::DateTime<Utc>) -> Result<(), AppError> {
    basedb_base::migrate::ensure_journal_partitions(st, &["ai_call"], now).await
}

/// `systemContext`: the kernel acting for itself, inside one tenant.
fn system_context(tenant_ref: &str) -> RequestContext {
    let actor = Actor { kind: ActorKind::System, id: FIRST.into(), token_id: None };
    let mut ctx = RequestContext::new(uuid::Uuid::new_v4().to_string(), actor, tenant_ref, Surface::System);
    ctx.deadline = ctx.timestamp + chrono::Duration::minutes(10);
    ctx
}

#[derive(Default)]
struct Memory {
    /// Where the empty pass of each field resumes.
    empty_cursor: HashMap<String, String>,
    /// Rows that failed, by `field:row`: when to try again, and how many failures.
    backoff: HashMap<String, (Instant, u32)>,
    /// Fields paused after a refusal that concerns all their rows.
    paused: HashMap<String, Instant>,
}

/// One worker's memory, as Node keeps it in its closure: lost at a restart, as Node's.
pub struct Worker {
    per_pass: usize,
    per_field: usize,
    memory: Mutex<Memory>,
}

fn backoff_delay(failures: u32) -> Duration {
    let ms = 2f64.powi(failures as i32) * 60_000.0;
    Duration::from_millis(ms.min(6.0 * 3_600_000.0) as u64)
}

impl Worker {
    pub fn new(per_pass: usize, per_field: usize) -> Worker {
        Worker { per_pass, per_field, memory: Mutex::new(Memory::default()) }
    }

    fn pause(&self, field_id: &str, minutes: u64) {
        self.memory.lock().unwrap().paused.insert(field_id.to_string(), Instant::now() + Duration::from_secs(minutes * 60));
    }

    /// One pass; the calls made.
    pub async fn pass(&self, st: &AppState) -> Result<usize, AppError> {
        let conn = st.pools.catalog().await?;
        let due = conn
            .rows(
                "SELECT c.field_id::text, te.ref AS tenant_ref
                   FROM _basedb.field_ai_config c
                   JOIN _basedb.field f      ON f.id = c.field_id AND f.is_live
                   JOIN _basedb.table_def t  ON t.id = f.table_id AND t.is_live
                   JOIN _basedb.base b       ON b.id = t.base_id AND b.is_live
                   JOIN _basedb.tenant te    ON te.id = b.tenant_id
                  WHERE c.lease_until IS NULL OR c.lease_until < clock_timestamp()
                  ORDER BY c.last_run_at NULLS FIRST",
                &[],
            )
            .await?;
        drop(conn);
        let mut budget = self.per_pass as i64;
        for row in due {
            if budget <= 0 {
                break;
            }
            let field_id: String = row.get(0);
            let tenant_ref: String = row.get(1);
            let paused = self.memory.lock().unwrap().paused.get(&field_id).is_some_and(|until| *until > Instant::now());
            if paused {
                continue;
            }
            // The lease: five minutes, long enough for a pass, short enough that a process
            // that died holding it does not hold the field for long.
            let conn = st.pools.catalog().await?;
            let claimed = conn
                .execute_op(
                    "UPDATE _basedb.field_ai_config SET lease_until = clock_timestamp() + interval '5 minutes'
                      WHERE field_id = $1::text::uuid AND (lease_until IS NULL OR lease_until < clock_timestamp())",
                    &[&field_id],
                    SqlOp::Update,
                )
                .await?;
            drop(conn);
            if claimed == 0 {
                continue;
            }
            match self.process_field(st, &field_id, &tenant_ref, budget as usize).await {
                Ok(calls) => budget -= calls as i64,
                Err(e) => {
                    eprintln!("Champs IA : {} {}", e.code, e.cause.clone().unwrap_or_default());
                    self.pause(&field_id, 5);
                }
            }
            if let Ok(conn) = st.pools.catalog().await {
                let _ = conn.execute_op("UPDATE _basedb.field_ai_config SET lease_until = NULL WHERE field_id = $1::text::uuid", &[&field_id], SqlOp::Update).await;
            }
        }
        Ok((self.per_pass as i64 - budget) as usize)
    }

    /// `processField`: the calls made for one field.
    async fn process_field(&self, st: &AppState, field_id: &str, tenant_ref: &str, budget: usize) -> Result<usize, AppError> {
        let ctx = system_context(tenant_ref);
        let now = ctx.timestamp;
        let field = with_transaction(&st.pools, PoolName::Catalog, &ctx, TxOptions::read_only(), |tx| {
            let field_id = field_id.to_string();
            async move { load_field(&tx, &field_id).await }
        })
        .await?;
        let Some(field) = field else { return Ok(0) };

        let mut sweep_after = field.sweep_after.clone();
        if field.mode == "schedule" && sweep_after.is_none() && field.next_sweep_at.is_none_or(|at| at <= now) {
            if let (Some(cron), Some(timezone)) = (&field.cron, &field.timezone) {
                let next = next_run(&parse_cron(cron)?, check_timezone(timezone)?, now);
                sweep_after = Some(FIRST.to_string());
                let conn = st.pools.catalog().await?;
                conn.execute_op(
                    "UPDATE _basedb.field_ai_config SET sweep_after = $2::text::uuid, next_sweep_at = $3 WHERE field_id = $1::text::uuid",
                    &[&field_id, &FIRST, &next],
                    SqlOp::Update,
                )
                .await?;
            }
        }

        let config = with_transaction(&st.pools, PoolName::Catalog, &ctx, TxOptions::read_only(), |tx| {
            let ctx = ctx.clone();
            async move { resolve_provider(&tx, &ctx, &st.cfg).await }
        })
        .await?;

        let limit = self.per_field.min(budget);
        let mut run = Run { calls: 0, computed: 0, last_error: None };
        let outcome: Result<(), AppError> = async {
            // 1. Empty cells, whatever the mode: a new row is filled at the next pass.
            let after = self.memory.lock().unwrap().empty_cursor.get(field_id).cloned().unwrap_or_else(|| FIRST.to_string());
            let empty = read_rows(st, &field, true, &after, limit as i64).await?;
            let ready: Vec<&CellRow> = {
                let memory = self.memory.lock().unwrap();
                let now = Instant::now();
                empty.iter().filter(|r| memory.backoff.get(&format!("{field_id}:{}", r.id)).is_none_or(|(until, _)| *until <= now)).collect()
            };
            let displays = link_displays(st, &field, &ready).await?;
            for row in &ready {
                if run.calls >= limit {
                    break;
                }
                self.attempt(st, &ctx, &config, &field, field_id, row, &displays, true, &mut run).await?;
            }
            // Past the end — or nothing left — the next pass starts from the top again.
            let cursor = if empty.len() < limit { FIRST.to_string() } else { empty.last().map(|r| r.id.clone()).unwrap_or_else(|| FIRST.to_string()) };
            self.memory.lock().unwrap().empty_cursor.insert(field_id.to_string(), cursor);

            // 2. A recomputation in progress, with what the budget leaves.
            if let Some(after) = &sweep_after {
                if run.calls < limit {
                    let wanted = limit - run.calls;
                    let rows = read_rows(st, &field, false, after, wanted as i64).await?;
                    let all: Vec<&CellRow> = rows.iter().collect();
                    let displays = link_displays(st, &field, &all).await?;
                    let mut reached = after.clone();
                    for row in &rows {
                        self.attempt(st, &ctx, &config, &field, field_id, row, &displays, false, &mut run).await?;
                        reached = row.id.clone();
                    }
                    let next: Option<String> = if rows.len() < wanted { None } else { Some(reached) };
                    let conn = st.pools.catalog().await?;
                    conn.execute_op("UPDATE _basedb.field_ai_config SET sweep_after = $2::text::uuid WHERE field_id = $1::text::uuid", &[&field_id, &next], SqlOp::Update)
                        .await?;
                }
            }
            Ok(())
        }
        .await;
        if let Err(e) = outcome {
            // A quota: the field waits ten minutes; anything else, five.
            self.pause(field_id, if e.code == "AI_QUOTA_EXCEEDED" { 10 } else { 5 });
            run.last_error = Some(e.code.to_string());
        }

        let computed = run.computed as i32;
        let conn = st.pools.catalog().await?;
        conn.execute_op(
            "UPDATE _basedb.field_ai_config
                SET last_run_at = clock_timestamp(),
                    computed_count = computed_count + $2::integer,
                    last_error = CASE WHEN $3::text IS NULL THEN
                                   CASE WHEN $2::integer > 0 THEN NULL ELSE last_error END
                                 ELSE $3::text END,
                    last_error_at = CASE WHEN $3::text IS NULL THEN
                                      CASE WHEN $2::integer > 0 THEN NULL ELSE last_error_at END
                                    ELSE clock_timestamp() END
              WHERE field_id = $1::text::uuid",
            &[&field_id, &computed, &run.last_error],
            SqlOp::Update,
        )
        .await?;
        Ok(run.calls)
    }

    /// `attempt`: one row; a refusal for the whole field is returned, a row's failure delays that row.
    #[allow(clippy::too_many_arguments)]
    async fn attempt(
        &self,
        st: &AppState,
        ctx: &RequestContext,
        config: &crate::provider::ProviderConfig,
        field: &crate::fields::LoadedField,
        field_id: &str,
        row: &CellRow,
        displays: &HashMap<String, HashMap<String, String>>,
        fill: bool,
        run: &mut Run,
    ) -> Result<(), AppError> {
        run.calls += 1;
        let key = format!("{field_id}:{}", row.id);
        match compute_row(st, ctx, config, field, row, displays, fill).await {
            Ok(_) => {
                run.computed += 1;
                self.memory.lock().unwrap().backoff.remove(&key);
                Ok(())
            }
            Err(e) => {
                run.last_error = Some(e.code.to_string());
                if FIELD_STOPPERS.contains(&e.code) {
                    return Err(e);
                }
                let mut memory = self.memory.lock().unwrap();
                let failures = memory.backoff.get(&key).map(|b| b.1).unwrap_or(0) + 1;
                memory.backoff.insert(key, (Instant::now() + backoff_delay(failures), failures));
                Ok(())
            }
        }
    }
}

struct Run {
    calls: usize,
    computed: usize,
    last_error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn partitions_cover_this_month_and_the_next_two() {
        let at = Utc.with_ymd_and_hms(2025, 11, 30, 23, 59, 0).unwrap();
        let sql = basedb_base::migrate::partition_statements("ai_call", at);
        assert_eq!(sql.len(), 3);
        assert!(sql[0].contains("_basedb.ai_call_2025_11") && sql[0].contains("FROM ('2025-11-01T00:00:00.000Z') TO ('2025-12-01T00:00:00.000Z')"));
        assert!(sql[2].contains("_basedb.ai_call_2026_01") && sql[2].contains("TO ('2026-02-01T00:00:00.000Z')"));
    }

    #[test]
    fn backoff_doubles_up_to_six_hours() {
        assert_eq!(backoff_delay(1), Duration::from_secs(120));
        assert_eq!(backoff_delay(3), Duration::from_secs(480));
        assert_eq!(backoff_delay(9), Duration::from_secs(6 * 3600));
    }
}
