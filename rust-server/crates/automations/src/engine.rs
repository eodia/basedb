//! The run engine (`engine.ts`, chapter 17 §2): the schedules and dates due queued, the
//! queue taken in batches, each run down its flow on its owner's authority.
//!
//! Started by `basedb-server` unless `BASEDB_RUST_BACKGROUND=0`. Node's worker and this one
//! may share a database: a run is claimed by `UPDATE … WHERE id IN (… FOR UPDATE SKIP LOCKED)`,
//! a schedule queued under `FOR UPDATE SKIP LOCKED` with « none already waiting », a date
//! automation leased five minutes — the same statements as Node, so neither takes a job the
//! other holds.

use crate::defs::{
    arr, dates_due, has_body, id_of, iso, is_address, js_slice, js_string, js_trim, kind_of, load_automation, loose_uuid, measure_name, moment_of, next_run_of, now_ms, steps_of,
    Automation, MAX_ATTACHED_BYTES, MAX_CHAIN, TRIGGER_ROW, WEBHOOK_SECRET,
};
use crate::render::{holds, Field, Fields, Held, Row, Scope};
use crate::requests::{used_this_hour, RUNS_PER_HOUR};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::idempotency::js_stringify;
use basedb_base::rbac::{decide, load_grants, load_target, Action, Verdict};
use basedb_base::tx::{with_transaction, Actor, ActorKind, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_catalog::js::js_to_number;
use basedb_catalog::targets::{check_target, TargetPolicy};
use basedb_records::js::number_json;
use basedb_records::{list_records, ListOptions, ListResult};
use futures_util::FutureExt;
use indexmap::{IndexMap, IndexSet};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

const BATCH: i64 = 10;
const WEBHOOK_TIMEOUT_MS: u64 = 10_000;
/// What one run may take, loops included.
pub const RUN_BUDGET_MS: i64 = 120_000;
const ANSWER_BYTES: usize = 65_536;
const RETRY_MS: [u64; 3] = [2_000, 5_000, 10_000];
const DATE_SCAN_MS: i64 = 60_000;
const DATE_LEASE_MS: i64 = 5 * 60_000;
const DATE_CATCH_UP_MS: i64 = 7 * 86_400_000;
const DATE_ROWS: f64 = 500.0;
/// `DRAIN_INTERVAL_MS` of `index.ts`: a pass every two seconds, never two at once.
pub const INTERVAL: Duration = Duration::from_secs(2);

type Boxed<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("regex"))
}

fn unit_ms(unit: &str) -> f64 {
    match unit {
        "minutes" => 60_000.0,
        "hours" => 3_600_000.0,
        _ => 86_400_000.0,
    }
}

fn system_context() -> RequestContext {
    RequestContext::new(uuid::Uuid::new_v4().to_string(), Actor::system(), "", Surface::System)
}

fn str_of<'v>(v: &'v Value, key: &str) -> Option<&'v str> {
    v.get(key).and_then(Value::as_str)
}

fn reason(code: &'static str, reason: &str) -> AppError {
    AppError::new(code).with("reason", json!(reason))
}

// ── Queuing ─────────────────────────────────────────────────────────────────────────────

/// `queueDue`: the schedules due, one run each at most waiting, the next due date moved on.
pub async fn queue_due(st: &Shared) -> Result<usize, AppError> {
    let ctx = system_context();
    with_transaction(&st.pools, PoolName::Catalog, &ctx, TxOptions::default(), |tx| async move {
        let due = tx
            .rows(
                "SELECT id::text, trigger FROM _basedb.automation
                  WHERE trigger_kind = 'schedule' AND deleted_at IS NULL AND is_enabled
                    AND next_run_at <= pg_catalog.clock_timestamp()
                  FOR UPDATE SKIP LOCKED",
                &[],
            )
            .await?;
        for row in &due {
            let id: String = row.get(0);
            let trigger: Value = row.get::<_, Option<Value>>(1).unwrap_or(Value::Null);
            tx.execute_op(
                "INSERT INTO _basedb.automation_run (automation_id, trigger_kind)
                 SELECT $1::text::uuid, 'schedule'
                  WHERE NOT EXISTS (SELECT 1 FROM _basedb.automation_run
                                     WHERE automation_id = $1::text::uuid AND status IN ('queued', 'running'))",
                &[&id],
                SqlOp::Insert,
            )
            .await?;
            let next = iso(next_run_of(&trigger["schedule"], now_ms()));
            tx.execute_op("UPDATE _basedb.automation SET next_run_at = $2::text::timestamptz WHERE id = $1::text::uuid", &[&id, &next], SqlOp::Update).await?;
        }
        Ok(due.len())
    })
    .await
}

/// `queueDates`: each automation on a date, leased, looks for the rows come due.
pub async fn queue_dates(st: &Shared) -> Result<usize, AppError> {
    let conn = st.pools.get(PoolName::Catalog).await?;
    let lease = (DATE_LEASE_MS / 1000) as f64;
    let due = conn
        .query_op(
            "UPDATE _basedb.automation
                SET next_run_at = pg_catalog.clock_timestamp() + make_interval(secs => $1)
              WHERE id IN (SELECT id FROM _basedb.automation
                            WHERE trigger_kind = 'date_reached' AND deleted_at IS NULL AND is_enabled
                              AND next_run_at <= pg_catalog.clock_timestamp()
                            ORDER BY next_run_at LIMIT 20 FOR UPDATE SKIP LOCKED)
              RETURNING id::text, floor(extract(epoch FROM scanned_until) * 1000)::float8",
            &[&lease],
            SqlOp::Update,
        )
        .await?;
    drop(conn);
    for row in &due {
        let id: String = row.get(0);
        let scanned: Option<f64> = row.get(1);
        let to = now_ms();
        let scanned = scanned.map(|s| s as i64).unwrap_or(to);
        let from = scanned.max(to - DATE_CATCH_UP_MS);
        let _ = queue_dates_of(st, &id, from, to).await;
        let conn = st.pools.get(PoolName::Catalog).await?;
        conn.execute_op(
            "UPDATE _basedb.automation SET scanned_until = $2::text::timestamptz, next_run_at = $3::text::timestamptz WHERE id = $1::text::uuid",
            &[&id, &iso(to), &iso(to + DATE_SCAN_MS)],
            SqlOp::Update,
        )
        .await?;
    }
    Ok(due.len())
}

/// The owner of an automation: their tenant's ref, and whether they may still act.
async fn owner_of<E: Exec + Sync>(exec: &E, owner: &str) -> Result<Option<(String, bool)>, AppError> {
    let row = exec
        .first(
            "SELECT t.ref, (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS active
               FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE u.id = $1::text::uuid",
            &[&owner],
        )
        .await?;
    Ok(row.map(|r| (r.get(0), r.get(1))))
}

async fn queue_dates_of(st: &Shared, id: &str, from: i64, to: i64) -> Result<(), AppError> {
    if to <= from {
        return Ok(());
    }
    let conn = st.pools.get(PoolName::Catalog).await?;
    let Some(automation) = load_automation(&conn, id).await? else { return Ok(()) };
    let owner = owner_of(&conn, &automation.owner_id).await?;
    drop(conn);
    let (Some(table), false) = (automation.table.clone(), automation.date.is_null()) else { return Ok(()) };
    let Some((owner_ref, true)) = owner else { return Ok(()) };
    let date = automation.date.clone();
    let ctx = actor_of(&owner_ref, &automation);
    let base = basedb_catalog::projection::project_base(&st.pools, &ctx, &automation.base_id).await?;
    let field = str_of(&date, "field").unwrap_or("").to_string();
    let Some(kind) = base.tables.iter().find(|t| t.id == table).and_then(|t| t.fields.iter().find(|f| f.name == field)).map(|f| f.kind.clone()) else {
        return Ok(());
    };
    let offset = date["offsetDays"].as_f64().unwrap_or(0.0) as i64;
    let quoted = |text: &str| format!("\"{text}\"");
    let filter = if kind == "datetime" {
        let shift = offset * 86_400_000;
        format!("{field} gt {} and {field} lte {}", quoted(&iso(from - shift)), quoted(&iso(to - shift)))
    } else {
        let dates = dates_due(offset, str_of(&date, "at").unwrap_or("00:00"), str_of(&date, "timezone").unwrap_or("UTC"), from, to);
        if dates.is_empty() {
            return Ok(());
        }
        format!("{field} in [{}]", dates.iter().map(|d| quoted(d)).collect::<Vec<_>>().join(", "))
    };
    let key = st.instance_key().unwrap_or("").to_string();
    let page = list_records(&st.pools, &ctx, &key, &ListOptions { table_id: table, filter: Some(filter), limit: Some(DATE_ROWS), ..Default::default() }).await?;
    if page.rows.is_empty() {
        return Ok(());
    }
    let conn = st.pools.get(PoolName::Catalog).await?;
    let used = used_this_hour(&conn, id).await?;
    let room = (RUNS_PER_HOUR - used).max(0) as usize;
    let ids: Vec<String> = page.rows.iter().take(room).map(|r| js_string(r.get("_id").unwrap_or(&Value::Null))).collect();
    if !ids.is_empty() {
        conn.execute_op(
            "INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id)
             SELECT $1::text::uuid, 'date_reached', unnest($2::text[]::uuid[])",
            &[&id, &ids],
            SqlOp::Insert,
        )
        .await?;
    }
    if page.rows.len() > ids.len() {
        conn.execute_op(
            "INSERT INTO _basedb.automation_run
               (automation_id, trigger_kind, record_id, status, reason, finished_at)
             VALUES ($1::text::uuid, 'date_reached', NULL, 'skipped', 'debit', pg_catalog.clock_timestamp())",
            &[&id],
            SqlOp::Insert,
        )
        .await?;
    }
    Ok(())
}

// ── Running ─────────────────────────────────────────────────────────────────────────────

struct Claimed {
    id: String,
    automation_id: String,
    trigger_kind: String,
    record_id: Option<String>,
    payload: Option<Value>,
    depth: i64,
    state: Option<Value>,
}

/// `actorOf`: the owner's rights, the automation's own name in the history.
fn actor_of(tenant_ref: &str, automation: &Automation) -> RequestContext {
    let mut ctx = RequestContext::new(
        uuid::Uuid::new_v4().to_string(),
        Actor { kind: ActorKind::Automation, id: automation.owner_id.clone(), token_id: Some(automation.id.clone()) },
        tenant_ref,
        Surface::Rest,
    );
    ctx.deadline = ctx.timestamp + chrono::Duration::milliseconds(RUN_BUDGET_MS);
    ctx
}

/// Where a run stops before its end.
#[derive(Debug, Clone)]
enum Halt {
    Failed { code: String, step: String },
    Wait { at: i64, step: String },
}

enum Outcome {
    Done { status: &'static str, reason: Option<String>, error_code: Option<String>, steps: Vec<Value> },
    Waiting { resume_at: i64, state: Value, steps: Vec<Value> },
    Discarded,
}

fn done(status: &'static str, reason: &str) -> Outcome {
    Outcome::Done { status, reason: Some(reason.into()), error_code: None, steps: Vec::new() }
}

/// A PDF made by a « document » step, kept for the mails of the run.
#[derive(Clone)]
struct Made {
    name: String,
    bytes: Vec<u8>,
}

type Performed = (&'static str, Option<String>);

struct Run {
    st: Shared,
    run_id: String,
    ctx: RequestContext,
    automation: Automation,
    tables: HashMap<String, Fields>,
    scope: Scope,
    log: Vec<Map<String, Value>>,
    depth: i64,
    files: HashMap<String, Made>,
    instance_key: String,
}

fn rank(status: &str) -> u8 {
    match status {
        "skipped" => 0,
        "succeeded" => 1,
        _ => 2,
    }
}

fn elapsed(started: Instant) -> Value {
    json!(started.elapsed().as_millis() as u64)
}

fn entry(step: &Value, status: &str) -> Map<String, Value> {
    let mut m = Map::new();
    m.insert("step".into(), json!(id_of(step)));
    m.insert("kind".into(), json!(kind_of(step)));
    m.insert("status".into(), json!(status));
    m
}

/// `failure`: its code, and the reason the kernel gave.
fn failure(step: &Value, error: &AppError, started: Instant) -> Map<String, Value> {
    let mut m = entry(step, "failed");
    m.insert("error_code".into(), json!(error.code));
    if let Some(Value::String(r)) = error.details.get("reason") {
        if !r.is_empty() {
            m.insert("detail".into(), json!(r));
        }
    }
    m.insert("ms".into(), elapsed(started));
    m
}

fn is_container(kind: &str) -> bool {
    kind == "branch" || kind == "attempt"
}

fn row_id(row: &Option<Row>) -> Option<&Value> {
    row.as_ref().and_then(|r| r.get("_id"))
}

impl Run {
    fn pools(&self) -> &basedb_base::db::Pools {
        &self.st.pools
    }

    fn fields_of(&self, table: &str) -> Fields {
        self.tables.get(table).cloned().unwrap_or_default()
    }

    fn hold(&mut self, key: &str, table: &str, row: Option<Row>) {
        let fields = self.fields_of(table);
        self.scope.rows.insert(key.to_string(), Held { table: table.to_string(), fields, row });
    }

    async fn list(&self, table: &str, filter: Option<String>, sort: Option<String>, limit: f64) -> Result<ListResult, AppError> {
        let options = ListOptions { table_id: table.to_string(), filter, sort, limit: Some(limit), ..Default::default() };
        list_records(self.pools(), &self.ctx, &self.instance_key, &options).await
    }

    /// `readRow`: a row read again with the owner's rights, and a filter it must satisfy.
    async fn read_row(&self, table: &str, id: &Value, filter: &str) -> Result<Option<Row>, AppError> {
        let Some(id) = id.as_str().filter(|s| loose_uuid(s)) else { return Ok(None) };
        let filter = if filter.is_empty() { format!("_id eq \"{id}\"") } else { format!("_id eq \"{id}\" and ({filter})") };
        let page = self.list(table, Some(filter), None, 1.0).await?;
        Ok(page.rows.into_iter().next())
    }

    /// `deletedRow`: a deleted row as a run cites it, the fields the owner reads.
    fn deleted_row(&self, table: &str, before: Option<&Value>) -> Option<Row> {
        let raw = before?.as_object()?;
        let mut row = Map::new();
        row.insert("_id".into(), raw.get("_id").cloned().unwrap_or(Value::Null));
        for (name, field) in self.fields_of(table).iter() {
            let value = raw.get(name).cloned().unwrap_or(Value::Null);
            let v = match (&*field.kind, &value) {
                ("link", Value::String(id)) => json!({ "id": id, "display": null }),
                ("multi_link", Value::Array(ids)) => Value::Array(ids.iter().map(|id| json!({ "id": id, "display": null })).collect()),
                _ => value,
            };
            row.insert(name.clone(), v);
        }
        Some(row)
    }

    /// `logStep`: inside a loop, a step kept once — turns counted, the worst kept.
    fn log_step(&mut self, entry: Map<String, Value>, repeat: bool) {
        let index = if repeat { self.log.iter().position(|e| e.get("step") == entry.get("step")) } else { None };
        let kind = entry.get("kind").and_then(Value::as_str).unwrap_or("").to_string();
        let container = is_container(&kind);
        let path: Vec<Value> = match entry.get("path") {
            Some(Value::String(p)) => vec![json!(p)],
            _ => Vec::new(),
        };
        let Some(index) = index else {
            let mut e = entry;
            if repeat {
                e.insert("times".into(), json!(1));
                if container {
                    e.insert("taken".into(), Value::Array(path));
                }
            }
            self.log.push(e);
            return;
        };
        let before = self.log[index].clone();
        let status = |m: &Map<String, Value>| m.get("status").and_then(Value::as_str).unwrap_or("").to_string();
        let worse = rank(&status(&entry)) >= rank(&status(&before));
        let counted = (kind == "notify" || kind == "email") && status(&entry) == "succeeded" && status(&before) == "succeeded";
        let mut merged = if worse { entry.clone() } else { before.clone() };
        if counted {
            let n = |m: &Map<String, Value>| match m.get("detail") {
                None | Some(Value::Null) => 0.0,
                Some(Value::String(s)) => js_to_number(s),
                Some(v) => v.as_f64().unwrap_or(f64::NAN),
            };
            merged.insert("detail".into(), json!(crate::defs::js_number(n(&before) + n(&entry))));
        }
        let path_of = |m: &Map<String, Value>| m.get("path").filter(|p| !p.is_null()).cloned();
        if container && path_of(&entry).is_none() && path_of(&before).is_some() {
            merged.insert("path".into(), before["path"].clone());
            match before.get("detail") {
                Some(d) => {
                    merged.insert("detail".into(), d.clone());
                }
                None => {
                    merged.shift_remove("detail");
                }
            }
        }
        if container {
            let mut taken: IndexSet<String> = before.get("taken").map(arr).unwrap_or(&[]).iter().filter_map(|v| v.as_str().map(str::to_string)).collect();
            for p in &path {
                taken.insert(p.as_str().unwrap_or("").to_string());
            }
            merged.insert("taken".into(), json!(taken.into_iter().collect::<Vec<_>>()));
        }
        let ms = before.get("ms").and_then(Value::as_f64).unwrap_or(0.0) + entry.get("ms").and_then(Value::as_f64).unwrap_or(0.0);
        merged.insert("ms".into(), number_json(ms));
        let times = before.get("times").and_then(Value::as_f64).unwrap_or(1.0) + 1.0;
        merged.insert("times".into(), number_json(times));
        self.log[index] = merged;
    }

    /// `runSteps`: in order; the first failure stops the run, a wait too.
    fn run_steps<'a>(&'a mut self, steps: &'a [Value], repeat: bool) -> Boxed<'a, Option<Halt>> {
        Box::pin(async move {
            for step in steps {
                let started = Instant::now();
                match kind_of(step) {
                    "for_each" => {
                        if let Some(h) = self.run_loop(step).await {
                            return Some(h);
                        }
                        continue;
                    }
                    "attempt" => {
                        if let Some(h) = self.run_attempt(step, repeat).await {
                            return Some(h);
                        }
                        continue;
                    }
                    _ => {}
                }
                let outcome: Result<Option<Option<Halt>>, AppError> = async {
                    match kind_of(step) {
                        "branch" => {
                            let taken = self.path_of(arr(&step["paths"])).await?;
                            let mut e = entry(step, "succeeded");
                            e.insert("path".into(), taken.map(|p| p["id"].clone()).unwrap_or(Value::Null));
                            e.insert("detail".into(), taken.map(|p| p["label"].clone()).unwrap_or(json!("aucun_chemin")));
                            e.insert("ms".into(), elapsed(started));
                            self.log_step(e, repeat);
                            let Some(taken) = taken else { return Ok(Some(None)) };
                            Ok(Some(self.run_steps(arr(&taken["steps"]), repeat).await))
                        }
                        "wait" => {
                            let until = self.wait_until(step);
                            let now = now_ms();
                            let mut e = entry(step, "succeeded");
                            e.insert("detail".into(), json!(until.map(iso).unwrap_or_else(|| "aucune_date".into())));
                            e.insert("ms".into(), elapsed(started));
                            self.log_step(e, repeat);
                            match until {
                                Some(t) if t > now + 1000 => Ok(Some(Some(Halt::Wait { at: t, step: id_of(step).to_string() }))),
                                _ => Ok(None),
                            }
                        }
                        _ => {
                            let (status, detail) = self.perform(step).await?;
                            let mut e = entry(step, status);
                            if let Some(d) = detail {
                                e.insert("detail".into(), json!(d));
                            }
                            e.insert("ms".into(), elapsed(started));
                            self.log_step(e, repeat);
                            Ok(None)
                        }
                    }
                }
                .await;
                match outcome {
                    Ok(None) | Ok(Some(None)) => {}
                    Ok(Some(Some(h))) => return Some(h),
                    Err(e) => {
                        let failed = failure(step, &e, started);
                        self.log_step(failed, repeat);
                        return Some(Halt::Failed { code: e.code.to_string(), step: id_of(step).to_string() });
                    }
                }
            }
            None
        })
    }

    /// `waitUntil`: after a duration, or at the date a field holds.
    fn wait_until(&self, step: &Value) -> Option<i64> {
        if let Some(d) = step.get("duration").filter(|d| !d.is_null()) {
            let amount = d["amount"].as_f64().unwrap_or(f64::NAN);
            return Some((now_ms() as f64 + amount * unit_ms(d["unit"].as_str().unwrap_or(""))).trunc() as i64);
        }
        let until = step.get("until").filter(|u| !u.is_null())?;
        let held = self.scope.rows.get(str_of(until, "record").unwrap_or(""));
        let field = str_of(until, "field").unwrap_or("");
        let value = held.and_then(|h| h.row.as_ref()).and_then(|r| r.get(field)).cloned().unwrap_or(Value::Null);
        let kind = held.and_then(|h| h.fields.get(field)).map(|f| f.kind.clone()).unwrap_or_default();
        moment_of(&value, &kind, until["offsetDays"].as_f64().unwrap_or(0.0) as i64, str_of(until, "at").unwrap_or("00:00"), str_of(until, "timezone").unwrap_or("UTC"))
    }

    /// `runAttempt`: the first way; on a failure, the second.
    fn run_attempt<'a>(&'a mut self, step: &'a Value, repeat: bool) -> Boxed<'a, Option<Halt>> {
        Box::pin(async move {
            let started = Instant::now();
            let paths = arr(&step["paths"]);
            let (tried, fallback) = (&paths[0], &paths[1]);
            let at = if repeat {
                None
            } else {
                let mut e = entry(step, "succeeded");
                e.insert("ms".into(), json!(0));
                self.log.push(e);
                Some(self.log.len() - 1)
            };
            let halt = self.run_steps(arr(&tried["steps"]), repeat).await;
            let failed = match &halt {
                Some(Halt::Failed { code, step }) => Some((code.clone(), step.clone())),
                _ => None,
            };
            let (erreur, etape) = failed.clone().unwrap_or_default();
            self.scope.data.insert(id_of(step).to_string(), json!({ "erreur": erreur, "etape": etape }));
            let way = if failed.is_none() { tried } else { fallback };
            let mut e = entry(step, "succeeded");
            e.insert("path".into(), way["id"].clone());
            e.insert("detail".into(), way["label"].clone());
            e.insert("ms".into(), elapsed(started));
            match at {
                Some(i) => self.log[i] = e,
                None => self.log_step(e, repeat),
            }
            if halt.is_some() && failed.is_none() {
                return halt;
            }
            failed?;
            self.run_steps(arr(&fallback["steps"]), repeat).await
        })
    }

    /// `runLoop`: the rows its filter finds, its steps once for each.
    fn run_loop<'a>(&'a mut self, step: &'a Value) -> Boxed<'a, Option<Halt>> {
        Box::pin(async move {
            let started = Instant::now();
            let mut placeholder = entry(step, "succeeded");
            placeholder.insert("ms".into(), json!(0));
            self.log.push(placeholder);
            let at = self.log.len() - 1;
            let table = str_of(step, "table").unwrap_or("").to_string();
            let filter = str_of(step, "filter").unwrap_or("");
            let filter = if filter.is_empty() { None } else { Some(self.scope.render_filter(filter)) };
            let sort = str_of(step, "sort").map(str::to_string);
            let limit = step["limit"].as_f64().unwrap_or(f64::NAN);
            let page = match self.list(&table, filter, sort, limit).await {
                Ok(p) => p,
                Err(e) => {
                    self.log[at] = failure(step, &e, started);
                    return Some(Halt::Failed { code: e.code.to_string(), step: id_of(step).to_string() });
                }
            };
            let inner: Vec<String> = steps_of(arr(&step["steps"])).iter().map(|s| id_of(s).to_string()).collect();
            let forget = |run: &mut Run| {
                for id in &inner {
                    run.scope.rows.shift_remove(id);
                    run.scope.data.shift_remove(id);
                }
            };
            let (mut turns, mut failures) = (0u64, 0u64);
            let mut halt = None;
            let mut out_of_time = false;
            let on_error = str_of(step, "onError").unwrap_or("stop");
            for row in page.rows {
                if chrono::Utc::now() >= self.ctx.deadline {
                    out_of_time = true;
                    halt = Some(Halt::Failed { code: "DEADLINE_EXCEEDED".into(), step: id_of(step).to_string() });
                    break;
                }
                forget(self);
                self.hold(id_of(step), &table, Some(row));
                let turn = self.run_steps(arr(&step["steps"]), true).await;
                if matches!(turn, Some(Halt::Failed { .. })) && on_error == "continue" {
                    failures += 1;
                    continue;
                }
                if turn.is_some() {
                    halt = turn;
                    break;
                }
                turns += 1;
            }
            forget(self);
            self.scope.rows.shift_remove(id_of(step));
            self.scope.data.insert(id_of(step).to_string(), json!({ "nombre": turns, "echecs": failures }));
            let mut e = entry(step, if out_of_time { "failed" } else { "succeeded" });
            if out_of_time {
                e.insert("error_code".into(), json!("DEADLINE_EXCEEDED"));
            }
            e.insert("detail".into(), json!(if failures > 0 { format!("{turns}/{failures}") } else { turns.to_string() }));
            if page.has_next_page {
                e.insert("more".into(), json!(true));
            }
            e.insert("ms".into(), elapsed(started));
            self.log[at] = e;
            halt
        })
    }

    /// `pathOf`: the first path whose test holds.
    async fn path_of<'p>(&self, paths: &'p [Value]) -> Result<Option<&'p Value>, AppError> {
        for path in paths {
            let when = &path["when"];
            if when.is_null() {
                return Ok(Some(path));
            }
            if when.get("op").is_some() {
                let value = self.scope.render(str_of(when, "value").unwrap_or(""));
                let operand = self.scope.render(str_of(when, "operand").unwrap_or(""));
                if holds(&value, str_of(when, "op").unwrap_or(""), &operand) {
                    return Ok(Some(path));
                }
                continue;
            }
            let Some(held) = self.scope.rows.get(str_of(when, "record").unwrap_or("")) else { continue };
            let Some(id) = row_id(&held.row).cloned() else {
                if held.row.is_none() {
                    continue;
                }
                return Ok(None);
            };
            let condition = str_of(when, "condition").unwrap_or("");
            if condition.is_empty() {
                return Ok(Some(path));
            }
            let filter = self.scope.render_filter(condition);
            let table = held.table.clone();
            if self.read_row(&table, &id, &filter).await?.is_some() {
                return Ok(Some(path));
            }
        }
        Ok(None)
    }

    /// `valuesFor`: each value written in, by the field it goes to.
    fn values_for(&self, values: &Value, fields: &Fields) -> Vec<(String, Value)> {
        values.as_object().map(|m| m.iter().map(|(name, raw)| (name.clone(), self.scope.value_for(raw, fields.get(name)))).collect()).unwrap_or_default()
    }

    fn held_row(&self, key: &Value) -> Option<(Held, Row)> {
        let held = self.scope.rows.get(key.as_str()?)?;
        Some((held.clone(), held.row.clone()?))
    }

    fn perform<'a>(&'a mut self, step: &'a Value) -> Boxed<'a, Result<Performed, AppError>> {
        Box::pin(async move {
            let skipped = |d: &str| Ok(("skipped", Some(d.to_string())));
            let succeeded = |d: String| Ok(("succeeded", Some(d)));
            match kind_of(step) {
                "update_record" => {
                    let Some((held, row)) = self.held_row(&step["record"]) else { return skipped("aucune_ligne") };
                    let values = self.values_for(&step["values"], &held.fields);
                    let id = js_string(row.get("_id").unwrap_or(&Value::Null));
                    let keys: Vec<String> = values.iter().map(|(k, _)| k.clone()).collect();
                    basedb_records::write::update_record(self.pools(), &self.ctx, &held.table, &id, values).await?;
                    let fresh = self.read_row(&held.table, &json!(id), "").await?;
                    self.hold(str_of(step, "record").unwrap_or(""), &held.table, fresh.clone());
                    self.hold(id_of(step), &held.table, fresh);
                    succeeded(keys.join(", "))
                }
                "create_record" => {
                    let table = str_of(step, "table").unwrap_or("").to_string();
                    let values = self.values_for(&step["values"], &self.fields_of(&table));
                    let created = basedb_records::write::create_record(self.pools(), &self.ctx, &table, values).await?;
                    let id = match created.row.get("_id") {
                        None | Some(Value::Null) => String::new(),
                        Some(v) => js_string(v),
                    };
                    let fresh = self.read_row(&table, &json!(id), "").await?;
                    self.hold(id_of(step), &table, fresh);
                    succeeded(id)
                }
                "delete_record" => {
                    let Some((held, row)) = self.held_row(&step["record"]) else { return skipped("aucune_ligne") };
                    let id = js_string(row.get("_id").unwrap_or(&Value::Null));
                    basedb_records::write::delete_record(self.pools(), &self.ctx, &held.table, &id).await?;
                    succeeded(id)
                }
                "find_record" => {
                    let table = str_of(step, "table").unwrap_or("").to_string();
                    let filter = str_of(step, "filter").unwrap_or("");
                    let filter = if filter.is_empty() { None } else { Some(self.scope.render_filter(filter)) };
                    let page = self.list(&table, filter, str_of(step, "sort").map(str::to_string), 1.0).await?;
                    let row = page.rows.into_iter().next();
                    let detail = row.as_ref().map(|r| js_string(r.get("_id").unwrap_or(&Value::Null))).unwrap_or_else(|| "aucune".into());
                    self.hold(id_of(step), &table, row);
                    succeeded(detail)
                }
                "aggregate" => self.aggregate(step).await,
                "run_automation" => self.chain(step).await,
                "document" => self.document(step).await,
                "notify" => self.notify(step).await,
                "ai" => self.ai(step).await,
                "email" => self.mail(step).await,
                "slack" => {
                    let conn = self.st.pools.get(PoolName::Catalog).await?;
                    let url = basedb_admin::integrations::slack_url_of(&conn, &self.instance_key, &self.automation.base_id, str_of(step, "integration").unwrap_or("")).await?;
                    drop(conn);
                    let Some(url) = url else { return Err(reason("RESOURCE_NOT_FOUND", "connexion_supprimee")) };
                    let status = basedb_admin::integrations::post_to_slack(&url, &self.scope.render(str_of(step, "message").unwrap_or(""))).await?;
                    succeeded(status.to_string())
                }
                "webhook" => self.webhook(step).await,
                other => Err(AppError::internal(format!("étape inconnue : {other}"))),
            }
        })
    }

    async fn aggregate(&mut self, step: &Value) -> Result<Performed, AppError> {
        let table = str_of(step, "table").unwrap_or("");
        let filter = str_of(step, "filter").unwrap_or("");
        let filter = if filter.is_empty() { None } else { Some(self.scope.render_filter(filter)) };
        let measures: Vec<(String, String)> = arr(&step["measures"]).iter().map(|m| (str_of(m, "field").unwrap_or("").to_string(), str_of(m, "fn").unwrap_or("").to_string())).collect();
        let result = basedb_records::aggregate::aggregate_records(self.pools(), &self.ctx, table, filter.as_deref(), &measures, None).await?;
        static DECIMAL: OnceLock<Regex> = OnceLock::new();
        let decimal = re(&DECIMAL, r"^-?\d+(\.\d+)?$");
        let mut out = Map::new();
        out.insert("nombre".into(), result["total"].clone());
        for (field, f) in &measures {
            let raw = result["values"].get(format!("{field}:{f}")).cloned().unwrap_or(Value::Null);
            let n = match &raw {
                Value::String(s) if decimal.is_match(s) => {
                    let n = js_to_number(s);
                    if n.is_finite() {
                        number_json(n)
                    } else {
                        raw.clone()
                    }
                }
                _ => raw.clone(),
            };
            let name = measure_name(f);
            let entry = out.entry(name.to_string()).or_insert_with(|| json!({}));
            if !entry.is_object() {
                *entry = json!({});
            }
            entry.as_object_mut().expect("object").insert(field.clone(), n);
        }
        self.scope.data.insert(id_of(step).to_string(), Value::Object(out));
        Ok(("succeeded", Some(js_string(&result["total"]))))
    }

    /// « Lancer une automatisation »: another one queued, the chain bounded.
    async fn chain(&mut self, step: &Value) -> Result<Performed, AppError> {
        if self.depth + 1 >= MAX_CHAIN {
            return Err(reason("REQUEST_INVALID", "chaine_trop_longue").with("maximum", json!(MAX_CHAIN)));
        }
        let conn = self.st.pools.get(PoolName::Catalog).await?;
        let target = load_automation(&conn, str_of(step, "automation").unwrap_or("")).await?;
        let Some(target) = target.filter(|t| t.base_id == self.automation.base_id) else {
            return Err(reason("RESOURCE_NOT_FOUND", "automation_inconnue"));
        };
        if !target.enabled {
            return Err(AppError::new("AUTOMATION_DISABLED").with("automation", json!(target.id)));
        }
        let held = step.get("record").and_then(Value::as_str).and_then(|k| self.scope.rows.get(k));
        let record_id = held.and_then(|h| row_id(&h.row)).filter(|v| !v.is_null()).cloned();
        if let Some(table) = &target.table {
            let (Some(held), Some(_)) = (held, &record_id) else { return Ok(("skipped", Some("aucune_ligne".into()))) };
            if &held.table != table {
                return Err(reason("REQUEST_INVALID", "table_differente"));
            }
        }
        if used_this_hour(&conn, &target.id).await? >= RUNS_PER_HOUR {
            return Err(reason("RATE_LIMIT_EXCEEDED", "debit"));
        }
        let record: Option<String> = if target.table.is_none() { None } else { record_id.map(|v| js_string(&v)) };
        let depth = (self.depth + 1) as i32;
        let row = conn
            .query_op(
                "INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id, depth)
                 VALUES ($1::text::uuid, 'automation', $2::text::uuid, $3::int) RETURNING id::text",
                &[&target.id, &record, &depth],
                SqlOp::Insert,
            )
            .await?;
        Ok(("succeeded", row.first().map(|r| r.get::<_, String>(0))))
    }

    /// `documentFor`: a PDF rendered for a row with the owner's rights, and its name.
    async fn document_for(&self, step: &Value) -> Result<(Held, Row, Made), AppError> {
        let Some((held, row)) = self.held_row(&step["record"]) else { return Err(reason("RESOURCE_NOT_FOUND", "aucune_ligne")) };
        let request = basedb_ai::documents::render::DocumentRequest {
            table_id: held.table.clone(),
            record_id: js_string(row.get("_id").unwrap_or(&Value::Null)),
            template_id: str_of(step, "template").map(str::to_string),
            draft: None,
        };
        let rendered = basedb_ai::documents::render::render_document(&self.st, &self.ctx, &request).await?;
        static UNSAFE: OnceLock<Regex> = OnceLock::new();
        static SPACES: OnceLock<Regex> = OnceLock::new();
        static PDF: OnceLock<Regex> = OnceLock::new();
        let named = self.scope.render(str_of(step, "name").unwrap_or(""));
        let named = re(&UNSAFE, r#"[\\/:*?"<>|\r\n]+"#).replace_all(&named, " ");
        let named = re(&SPACES, r"\s+").replace_all(&named, " ");
        let named = js_trim(&named).to_string();
        let name = if named.is_empty() {
            rendered.filename.clone()
        } else if re(&PDF, r"(?i)\.pdf$").is_match(&named) {
            named
        } else {
            format!("{named}.pdf")
        };
        Ok((held, row, Made { name: js_slice(&name, 200), bytes: rendered.bytes }))
    }

    async fn document(&mut self, step: &Value) -> Result<Performed, AppError> {
        let (held, row, made) = self.document_for(step).await?;
        let id = id_of(step).to_string();
        self.files.insert(id.clone(), made.clone());
        self.scope.data.insert(id, json!({ "nom": made.name }));
        let Some(field) = str_of(step, "field") else { return Ok(("succeeded", Some(made.name))) };
        let max = self.st.cfg.max_file_bytes.unwrap_or(basedb_records::DEFAULT_MAX_FILE_BYTES);
        let key = basedb_records::link_key(&self.instance_key);
        let uploaded = basedb_records::upload_file(&self.st, &self.ctx, &key, &held.table, field, &made.name, Some("application/pdf"), &made.bytes, max).await?;
        let mut list: Vec<Value> = row.get(field).and_then(Value::as_array).cloned().unwrap_or_default();
        list.push(uploaded.get("id").cloned().unwrap_or(Value::Null));
        let id = js_string(row.get("_id").unwrap_or(&Value::Null));
        basedb_records::write::update_record(self.pools(), &self.ctx, &held.table, &id, vec![(field.to_string(), Value::Array(list))]).await?;
        let fresh = self.read_row(&held.table, &json!(id), "").await?;
        self.hold(str_of(step, "record").unwrap_or(""), &held.table, fresh);
        Ok(("succeeded", Some(made.name)))
    }

    async fn notify(&mut self, step: &Value) -> Result<Performed, AppError> {
        let Some((held, row)) = self.held_row(&step["record"]) else { return Ok(("skipped", Some("aucune_ligne".into()))) };
        let mut recipients: IndexSet<String> = arr(&step["users"]).iter().filter_map(|u| u.as_str().map(str::to_string)).collect();
        if let Some(field) = str_of(step, "userField") {
            if let Some(Value::String(person)) = row.get(field) {
                if !person.is_empty() {
                    recipients.insert(person.clone());
                }
            }
        }
        let message = js_slice(&self.scope.render(str_of(step, "message").unwrap_or("")), 200);
        let record = js_string(row.get("_id").unwrap_or(&Value::Null));
        let (ctx, owner, base) = (&self.ctx, &self.automation.owner_id, &self.automation.base_id);
        let recipients = &recipients;
        let (table, message, record) = (&held.table, &message, &record);
        let notified = with_transaction(&self.st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
            let mut count = 0u64;
            for user in recipients {
                let reader = basedb_records::drain::context_of(&ctx.tenant_id, user, &ctx.request_id);
                if !basedb_records::notifications::can_read_table(&tx, &reader, table).await? {
                    continue;
                }
                if !basedb_records::drain::wants_notification(&tx, user, "automation").await? {
                    continue;
                }
                tx.execute_op(
                    "INSERT INTO _basedb.notification
                       (tenant_id, user_id, kind, actor_id, base_id, table_id, record_id, excerpt)
                     SELECT b.tenant_id, $1::text::uuid, 'automation', $2::text::uuid, b.id, $3::text::uuid, $4::text::uuid, $5
                       FROM _basedb.base b WHERE b.id = $6::text::uuid",
                    &[user, owner, table, record, message, base],
                    SqlOp::Insert,
                )
                .await?;
                basedb_records::notifications::emit_live(&tx, &json!({ "kind": "notifications", "user": user })).await?;
                count += 1;
            }
            Ok(count)
        })
        .await?;
        Ok(("succeeded", Some(notified.to_string())))
    }

    async fn ai(&mut self, step: &Value) -> Result<Performed, AppError> {
        use basedb_ai::fields::{expected_format, parse_answer, AiOption, MAX_AI_VALUE_CHARS};
        use basedb_ai::provider::{assert_quota, invoke, resolve_provider, InvokeOptions, Usage};
        let st = &self.st;
        let ctx = &self.ctx;
        let config = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
            let found = resolve_provider(&tx, ctx, &st.cfg).await?;
            assert_quota(&tx, ctx, &st.cfg, Usage::FieldCompute).await?;
            Ok(found)
        })
        .await?;
        let kind = str_of(step, "answer").unwrap_or("");
        let options: Vec<AiOption> = arr(&step["options"]).iter().filter_map(Value::as_str).map(|l| AiOption { value: l.to_string(), label: l.to_string() }).collect();
        let mut payload = Map::new();
        payload.insert("intent".into(), json!("automation_step"));
        payload.insert("automation_label".into(), json!(self.automation.label));
        payload.insert("instruction".into(), json!(self.scope.render_prompt(str_of(step, "prompt").unwrap_or(""))));
        if let Some(format) = expected_format(kind, &options) {
            payload.insert("expected_format".into(), json!(format));
        }
        let answer = invoke(st, ctx, &config, Usage::Automation, Some(&self.automation.base_id), &Value::Object(payload), basedb_ai::prompts::field_schema(), basedb_ai::prompts::STEP_SYSTEM, InvokeOptions::default()).await?;
        let value = answer.get("value").and_then(Value::as_str).map(js_trim).unwrap_or("");
        let text: String = value.chars().take(MAX_AI_VALUE_CHARS).collect();
        let Some(read) = parse_answer(kind, &text, &options) else {
            return Err(reason("AI_RESPONSE_UNUSABLE", "type_attendu").with("kind", json!(kind)));
        };
        let answer = if kind == "number" {
            match &read {
                Value::String(s) => number_json(js_to_number(s)),
                v => v.clone(),
            }
        } else {
            read
        };
        self.scope.data.insert(id_of(step).to_string(), json!({ "reponse": answer }));
        Ok(("succeeded", Some(text.chars().count().to_string())))
    }

    /// `attachmentsOf`: the files an e-mail step attaches, left in the storage.
    async fn attachments_of(&self, step: &Value) -> Result<Vec<Value>, AppError> {
        let list = arr(&step["attachments"]);
        if list.is_empty() {
            return Ok(Vec::new());
        }
        let storage = basedb_records::storage::Storage::new(&self.st.cfg.files, &self.st.https);
        let mut out: Vec<(String, String, String, i64, bool)> = Vec::new();
        for attachment in list {
            if let Some(source) = str_of(attachment, "step") {
                let made = match self.files.get(source) {
                    Some(m) => m.clone(),
                    None => {
                        let found = steps_of(&self.automation.actions).into_iter().find(|s| id_of(s) == source).cloned();
                        let Some(found) = found.filter(|s| kind_of(s) == "document") else {
                            return Err(reason("RESOURCE_NOT_FOUND", "document_perdu"));
                        };
                        self.document_for(&found).await?.2
                    }
                };
                let key = format!("{}/{}", self.automation.base_id, uuid::Uuid::new_v4());
                storage.put(&key, &made.bytes, "application/pdf").await?;
                out.push((key, made.name, "application/pdf".into(), made.bytes.len() as i64, true));
                continue;
            }
            let field = str_of(attachment, "field").unwrap_or("");
            let Some(held) = self.scope.rows.get(str_of(attachment, "record").unwrap_or("")) else { continue };
            let value = held.row.as_ref().and_then(|r| r.get(field));
            let Some(Value::Array(values)) = value.filter(|_| held.fields.contains_key(field)) else { continue };
            let ids: Vec<String> = values
                .iter()
                .filter_map(|v| match v {
                    Value::String(s) => Some(s.clone()),
                    other => other.get("id").and_then(Value::as_str).map(str::to_string),
                })
                .collect();
            if ids.is_empty() {
                continue;
            }
            let conn = self.st.pools.get(PoolName::Catalog).await?;
            let stored = conn
                .rows(
                    "SELECT storage_key, name, mime_type, size_bytes::text FROM _basedb.stored_file
                      WHERE id = ANY($1::text[]::uuid[]) AND base_id = $2::text::uuid",
                    &[&ids, &self.automation.base_id],
                )
                .await?;
            for f in stored {
                let size: String = f.get(3);
                out.push((f.get(0), f.get(1), f.get(2), size.parse::<i64>().unwrap_or(0), false));
            }
        }
        let total: i64 = out.iter().map(|a| a.3).sum();
        if total > MAX_ATTACHED_BYTES {
            for a in out.iter().filter(|a| a.4) {
                let _ = storage.delete(&a.0).await;
            }
            return Err(reason("BODY_TOO_LARGE", "pieces_jointes_trop_lourdes").with("size", json!(total)).with("maximum", json!(MAX_ATTACHED_BYTES)));
        }
        Ok(out.into_iter().map(|(key, name, kind, size, owned)| json!({ "key": key, "name": name, "type": kind, "size": size, "owned": owned })).collect())
    }

    /// `mail`: queued, not sent — the mail loop hands it to the relay.
    async fn mail(&mut self, step: &Value) -> Result<Performed, AppError> {
        if !self.st.mail_available() {
            return Err(reason("MAIL_NOT_CONFIGURED", "transport_absent"));
        }
        let held = step.get("record").and_then(Value::as_str).and_then(|k| self.scope.rows.get(k)).cloned();
        let row = held.as_ref().and_then(|h| h.row.clone());
        let mut people: IndexSet<String> = arr(&step["users"]).iter().filter_map(|u| u.as_str().map(str::to_string)).collect();
        if let (Some(field), Some(row)) = (str_of(step, "userField"), &row) {
            if let Some(Value::String(person)) = row.get(field) {
                if !person.is_empty() {
                    people.insert(person.clone());
                }
            }
        }
        let mut recipients: IndexMap<String, (String, Option<String>)> = IndexMap::new();
        let add = |recipients: &mut IndexMap<String, (String, Option<String>)>, address: &str, user: Option<String>| {
            let key = address.to_lowercase();
            if !recipients.contains_key(&key) || user.is_some() {
                recipients.insert(key, (address.to_string(), user));
            }
        };
        for address in arr(&step["addresses"]).iter().filter_map(Value::as_str) {
            add(&mut recipients, address, None);
        }
        if let (Some(field), Some(row)) = (str_of(step, "emailField"), &row) {
            if let Some(Value::String(written)) = row.get(field) {
                let written = js_trim(written);
                if is_address(written) {
                    add(&mut recipients, written, None);
                }
            }
        }
        static SPACES: OnceLock<Regex> = OnceLock::new();
        let subject = self.scope.render(str_of(step, "subject").unwrap_or(""));
        let subject = js_slice(js_trim(&re(&SPACES, r"\s+").replace_all(&subject, " ")), 300);
        let subject = if subject.is_empty() { self.automation.label.clone() } else { subject };
        let message = str_of(step, "message").unwrap_or("");
        let html = if str_of(step, "format") == Some("html") { Some(js_slice(&self.scope.render_html(message), 200_000)) } else { None };
        let body = js_slice(&match &html {
            None => self.scope.render(message),
            Some(h) => basedb_records::html::rich_text_to_plain(h),
        }, 20_000);
        let answer_to = str_of(step, "replyTo").map(|r| js_trim(&self.scope.render(r)).to_string());
        if let Some(a) = &answer_to {
            if !a.is_empty() && !is_address(a) {
                return Err(reason("REQUEST_INVALID", "reponse_a_invalide"));
            }
        }
        let conn = self.st.pools.get(PoolName::Catalog).await?;
        let owner: Option<String> = conn.first("SELECT email FROM _basedb.app_user WHERE id = $1::text::uuid", &[&self.automation.owner_id]).await?.map(|r| r.get(0));
        if !people.is_empty() {
            let ids: Vec<String> = people.iter().cloned().collect();
            let found = conn
                .rows(
                    "SELECT id::text, email FROM _basedb.app_user
                      WHERE id = ANY($1::text[]::uuid[]) AND disabled_at IS NULL AND deleted_at IS NULL",
                    &[&ids],
                )
                .await?;
            for person in found {
                let (id, email): (String, String) = (person.get(0), person.get(1));
                if let Some(h) = &held {
                    let reader = basedb_records::drain::context_of(&self.ctx.tenant_id, &id, &self.ctx.request_id);
                    if !basedb_records::notifications::can_read_table(&conn, &reader, &h.table).await? {
                        continue;
                    }
                }
                add(&mut recipients, &email, Some(id));
            }
        }
        drop(conn);
        let list: Vec<(String, Option<String>)> = recipients.into_values().collect();
        if list.is_empty() {
            return Ok(("skipped", Some("aucun_destinataire".into())));
        }
        let attached = self.attachments_of(step).await?;
        let reply_to = match &answer_to {
            Some(a) if !a.is_empty() => Some(a.clone()),
            _ => owner,
        };
        type Mail<'m> = (&'m (String, Option<String>), Vec<String>);
        let mails: Vec<Mail> = if str_of(step, "mode") == Some("together") {
            vec![(&list[0], list[1..].iter().map(|r| r.0.clone()).collect())]
        } else {
            list.iter().map(|r| (r, Vec::new())).collect()
        };
        let cc: Vec<String> = arr(&step["cc"]).iter().filter_map(|c| c.as_str().map(str::to_string)).collect();
        let cc = if cc.is_empty() { None } else { Some(cc) };
        let (automation, run_id, base) = (&self.automation.id, &self.run_id, &self.automation.base_id);
        let (mails, reply_to, subject, body, html, cc, attached) = (&mails, &reply_to, &subject, &body, &html, &cc, &attached);
        with_transaction(&self.st.pools, PoolName::Catalog, &self.ctx, TxOptions::default(), |tx| async move {
            for (index, (first, also)) in mails.iter().enumerate() {
                let also: Option<Vec<String>> = if also.is_empty() { None } else { Some(also.clone()) };
                let files: Option<String> = if attached.is_empty() {
                    None
                } else {
                    let list: Vec<Value> = attached
                        .iter()
                        .map(|a| {
                            let mut a = a.clone();
                            let owned = a["owned"].as_bool().unwrap_or(false) && index == 0;
                            a["owned"] = json!(owned);
                            a
                        })
                        .collect();
                    Some(js_stringify(&Value::Array(list)))
                };
                tx.execute_op(
                    "INSERT INTO _basedb.mail_outbox
                       (tenant_id, origin, automation_id, run_id, user_id, recipient, reply_to,
                        subject, body_text, body_html, also_to, cc, attachments)
                     SELECT b.tenant_id, 'automation', $1::text::uuid, $2::text::uuid, $3::text::uuid, $4, $5, $6, $7, $8,
                            $9::text[], $10::text[], $11::text::jsonb
                       FROM _basedb.base b WHERE b.id = $12::text::uuid",
                    &[automation, run_id, &first.1, &first.0, reply_to, subject, body, html, &also, cc, &files, base],
                    SqlOp::Insert,
                )
                .await?;
            }
            Ok(())
        })
        .await?;
        Ok(("succeeded", Some(list.len().to_string())))
    }

    /// `openSecret`: a secret header, opened for the host it was given for.
    fn open_secret(&self, sealed: &str, url: &url::Url) -> Result<String, AppError> {
        let opened = basedb_admin::sealing::unseal(&self.instance_key, WEBHOOK_SECRET, sealed);
        let secret: Option<Value> = opened.and_then(|o| serde_json::from_str(&o).ok());
        let unreadable = || reason("AUTOMATION_WEBHOOK_FAILED", "secret_illisible");
        let Some(secret) = secret.filter(|s| !s.is_null()) else { return Err(unreadable()) };
        if secret.get("base").and_then(Value::as_str) != Some(self.automation.base_id.as_str()) {
            return Err(unreadable());
        }
        let Some(value) = secret.get("value").and_then(Value::as_str) else { return Err(unreadable()) };
        if secret.get("host").and_then(Value::as_str) != Some(js_host(url).as_str()) {
            return Err(reason("AUTOMATION_WEBHOOK_FAILED", "secret_autre_hote"));
        }
        Ok(value.to_string())
    }

    /// `bodyOf`: its own body composed, or the automation's JSON.
    fn body_of(&self, step: &Value) -> Result<(String, &'static str), AppError> {
        let Some(body) = step.get("body").and_then(Value::as_str) else {
            let held = step.get("record").and_then(Value::as_str).and_then(|k| self.scope.rows.get(k));
            let mut steps = Map::new();
            for (k, h) in &self.scope.rows {
                if k != TRIGGER_ROW {
                    steps.insert(k.clone(), h.row.clone().map(Value::Object).unwrap_or(Value::Null));
                }
            }
            for (k, v) in &self.scope.data {
                steps.insert(k.clone(), v.clone());
            }
            let text = js_stringify(&json!({
                "automation": { "id": self.automation.id, "label": self.automation.label },
                "trigger": self.automation.trigger_kind,
                "record": held.and_then(|h| h.row.clone()).map(Value::Object).unwrap_or(Value::Null),
                "steps": steps,
                "at": iso(now_ms()),
            }));
            return Ok((text, "application/json"));
        };
        match str_of(step, "format").unwrap_or("json") {
            "form" => Ok((self.scope.render_form(body), "application/x-www-form-urlencoded")),
            "text" => Ok((self.scope.render(body), "text/plain; charset=utf-8")),
            _ => {
                let text = self.scope.render_json(body);
                if serde_json::from_str::<Value>(&text).is_err() {
                    return Err(reason("AUTOMATION_WEBHOOK_FAILED", "corps_json_invalide"));
                }
                Ok((text, "application/json"))
            }
        }
    }

    /// `webhook`: the address checked again, tried again on a network error, 429 or 5xx.
    async fn webhook(&mut self, step: &Value) -> Result<Performed, AppError> {
        let policy = TargetPolicy::from_config(&self.st.cfg);
        let url = check_target(&self.scope.render_url(str_of(step, "url").unwrap_or(""))?, &policy).await?;
        let method = str_of(step, "method").unwrap_or("POST").to_string();
        let mut headers: IndexMap<String, String> = IndexMap::new();
        headers.insert("user-agent".into(), "basedb-automation/1".into());
        headers.insert("x-basedb-automation".into(), self.automation.id.clone());
        let mut body: Option<String> = None;
        if has_body(&method) {
            let (text, kind) = self.body_of(step)?;
            body = Some(text);
            headers.insert("content-type".into(), kind.into());
        }
        static BREAKS: OnceLock<Regex> = OnceLock::new();
        for header in arr(&step["headers"]) {
            let name = str_of(header, "name").unwrap_or("").to_lowercase();
            let value = match str_of(header, "sealed") {
                Some(sealed) => self.open_secret(sealed, &url)?,
                None => re(&BREAKS, r"[\r\n]+").replace_all(&self.scope.render(str_of(header, "value").unwrap_or("")), " ").into_owned(),
            };
            headers.insert(name, value);
        }
        let retries = step["retries"].as_f64().unwrap_or(0.0);
        let mut attempt = 0usize;
        loop {
            let response = send(&method, &url, &headers, body.as_deref()).await;
            let status = response.as_ref().map(|r| r.status().as_u16()).unwrap_or(0);
            let again = response.is_none() || status == 429 || status >= 500;
            let wait = RETRY_MS.get(attempt).copied().unwrap_or(RETRY_MS[RETRY_MS.len() - 1]);
            let within = chrono::Utc::now() + chrono::Duration::milliseconds((wait + WEBHOOK_TIMEOUT_MS) as i64) < self.ctx.deadline;
            if again && (attempt as f64) < retries && within {
                drop(response);
                tokio::time::sleep(Duration::from_millis(wait)).await;
                attempt += 1;
                continue;
            }
            let Some(response) = response else { return Err(reason("AUTOMATION_WEBHOOK_FAILED", "injoignable")) };
            if !(200..300).contains(&status) {
                return Err(reason("AUTOMATION_WEBHOOK_FAILED", &format!("http_{status}")));
            }
            let answer = answer_of(response).await;
            self.scope.data.insert(id_of(step).to_string(), json!({ "statut": status, "reponse": answer }));
            return Ok(("succeeded", Some(status.to_string())));
        }
    }
}

/// `url.host` of JavaScript: the name, and the port when it is not the scheme's.
pub(crate) fn js_host(url: &url::Url) -> String {
    let host = url.host_str().unwrap_or("").to_lowercase();
    match url.port() {
        Some(p) => format!("{host}:{p}"),
        None => host,
    }
}

fn webhook_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).no_proxy().build().expect("client"))
}

/// One try; `None`: the network failed (or a header no request may carry).
async fn send(method: &str, url: &url::Url, headers: &IndexMap<String, String>, body: Option<&str>) -> Option<reqwest::Response> {
    let method = reqwest::Method::from_bytes(method.as_bytes()).ok()?;
    let mut map = reqwest::header::HeaderMap::new();
    for (name, value) in headers {
        let name = reqwest::header::HeaderName::from_bytes(name.as_bytes()).ok()?;
        let value = reqwest::header::HeaderValue::from_str(value).ok()?;
        map.insert(name, value);
    }
    let mut request = webhook_client().request(method, url.clone()).headers(map).timeout(Duration::from_millis(WEBHOOK_TIMEOUT_MS));
    if let Some(b) = body {
        request = request.body(b.to_string());
    }
    request.send().await.ok()
}

/// `answerOf`: read up to 64 KiB, JSON when it is, text otherwise; `null` when unreadable.
async fn answer_of(response: reqwest::Response) -> Value {
    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut bytes: Vec<u8> = Vec::new();
    while bytes.len() < ANSWER_BYTES {
        match stream.next().await {
            None => break,
            Some(Ok(chunk)) => bytes.extend_from_slice(&chunk),
            Some(Err(_)) => return Value::Null,
        }
    }
    bytes.truncate(ANSWER_BYTES);
    let text = String::from_utf8_lossy(&bytes);
    let text = text.strip_prefix('\u{FEFF}').unwrap_or(&text);
    serde_json::from_str(text).unwrap_or_else(|_| json!(text))
}

fn fields_of_base(base: &basedb_catalog::projection::ProjectedBase) -> HashMap<String, Fields> {
    base.tables
        .iter()
        .map(|t| {
            let fields: IndexMap<String, Field> = t
                .fields
                .iter()
                .map(|f| {
                    let options = f.options.as_ref().map(|o| o.iter().map(|o| (o.value.clone(), o.label.clone())).collect()).unwrap_or_default();
                    (f.name.clone(), Field { kind: f.kind.clone(), options })
                })
                .collect();
            (t.id.clone(), Arc::new(fields))
        })
        .collect()
}

/// `runOne`.
async fn run_one(st: &Shared, claimed: &Claimed) -> Result<Outcome, AppError> {
    let conn = st.pools.get(PoolName::Catalog).await?;
    let Some(automation) = load_automation(&conn, &claimed.automation_id).await? else { return Ok(done("skipped", "supprimee")) };
    let owner = owner_of(&conn, &automation.owner_id).await?;
    drop(conn);
    if !automation.enabled {
        return Ok(done("skipped", "desactivee"));
    }
    let Some((owner_ref, true)) = owner else { return Ok(done("skipped", "proprietaire_inactif")) };
    let ctx = actor_of(&owner_ref, &automation);
    let base = basedb_catalog::projection::project_base(&st.pools, &ctx, &automation.base_id).await?;
    let conn = st.pools.get(PoolName::Catalog).await?;
    let people: HashMap<String, String> = conn
        .rows(
            "SELECT u.id::text, coalesce(nullif(u.display_name, ''), u.email) AS name
               FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id WHERE t.ref = $1",
            &[&owner_ref],
        )
        .await?
        .iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect();
    drop(conn);
    let mut run = Run {
        st: st.clone(),
        run_id: claimed.id.clone(),
        ctx,
        tables: fields_of_base(&base),
        scope: Scope { rows: IndexMap::new(), data: Map::new(), people, now: iso(now_ms()) },
        log: Vec::new(),
        depth: claimed.depth,
        files: HashMap::new(),
        instance_key: st.instance_key().unwrap_or("").to_string(),
        automation,
    };
    if let Some(state) = &claimed.state {
        return go_on(&mut run, claimed, state).await;
    }
    let table = run.automation.table.clone();
    if claimed.trigger_kind == "webhook" {
        let payload = claimed.payload.clone().filter(|p| !p.is_null()).unwrap_or(json!({}));
        run.scope.data.insert(TRIGGER_ROW.into(), payload);
    } else if let (Some(table), "record_deleted") = (&table, claimed.trigger_kind.as_str()) {
        let conn = st.pools.get(PoolName::Catalog).await?;
        let visible = match load_target(&conn, &run.ctx, table).await? {
            None => None,
            Some(target) => {
                let grants = load_grants(&conn, &run.ctx).await?;
                let read = decide(&run.ctx, &grants, Action::Read, &target);
                (read.verdict == Verdict::Allowed).then(|| read.row_predicate == "TRUE")
            }
        };
        drop(conn);
        match visible {
            None => return Ok(done("skipped", "ligne_introuvable")),
            Some(false) => return Ok(done("skipped", "regle_de_lignes")),
            Some(true) => {}
        }
        let Some(row) = run.deleted_row(table, claimed.payload.as_ref()) else { return Ok(done("skipped", "ligne_introuvable")) };
        run.hold(TRIGGER_ROW, table, Some(row));
    } else if let (Some(table), Some(record)) = (&table, &claimed.record_id) {
        let condition = run.automation.condition.clone().map(|c| run.scope.render_filter(&c)).unwrap_or_default();
        let row = run.read_row(table, &json!(record), &condition).await?;
        if claimed.trigger_kind == "record_matches" {
            let conn = st.pools.get(PoolName::Catalog).await?;
            if !matched(&conn, &run.automation.id, record, row.is_some()).await? {
                return Ok(Outcome::Discarded);
            }
            if used_this_hour(&conn, &run.automation.id).await? > RUNS_PER_HOUR {
                return Ok(done("skipped", "debit"));
            }
        }
        let Some(row) = row else {
            return Ok(done("skipped", if run.automation.condition.is_none() { "ligne_introuvable" } else { "condition_fausse" }));
        };
        run.hold(TRIGGER_ROW, table, Some(row));
    }
    let actions = run.automation.actions.clone();
    let halt = run.run_steps(&actions, false).await;
    Ok(outcome_of(&run, halt, &actions))
}

/// `matched`: whether a row enters the filter now — in it, and not before.
async fn matched<E: Exec + Sync>(exec: &E, automation: &str, record: &str, inside: bool) -> Result<bool, AppError> {
    if !inside {
        exec.execute_op("DELETE FROM _basedb.automation_match WHERE automation_id = $1::text::uuid AND record_id = $2::text::uuid", &[&automation, &record], SqlOp::Delete).await?;
        return Ok(false);
    }
    let rows = exec
        .query_op(
            "INSERT INTO _basedb.automation_match (automation_id, record_id) VALUES ($1::text::uuid, $2::text::uuid)
             ON CONFLICT DO NOTHING RETURNING record_id",
            &[&automation, &record],
            SqlOp::Insert,
        )
        .await?;
    Ok(!rows.is_empty())
}

/// `outcomeOf`: how a run ends — or waits, and what it keeps to go on.
fn outcome_of(run: &Run, halt: Option<Halt>, actions: &[Value]) -> Outcome {
    let steps: Vec<Value> = run.log.iter().cloned().map(Value::Object).collect();
    match halt {
        None => Outcome::Done { status: "succeeded", reason: None, error_code: None, steps },
        Some(Halt::Failed { code, .. }) => Outcome::Done { status: "failed", reason: None, error_code: Some(code), steps },
        Some(Halt::Wait { at, step }) => {
            let mut rows = Map::new();
            for (key, held) in &run.scope.rows {
                let id = row_id(&held.row).and_then(Value::as_str).map(|s| json!(s)).unwrap_or(Value::Null);
                rows.insert(key.clone(), json!({ "table": held.table, "id": id }));
            }
            let state = json!({ "actions": actions, "after": step, "rows": rows, "data": run.scope.data, "log": steps });
            Outcome::Waiting { resume_at: at, state, steps }
        }
    }
}

enum Resumed {
    Absent,
    Ran(Option<Halt>),
}

/// `resumeFrom`: the steps after `target`, wherever it stands.
fn resume_from<'a>(run: &'a mut Run, steps: &'a [Value], target: &'a str) -> Boxed<'a, Resumed> {
    Box::pin(async move {
        for (index, step) in steps.iter().enumerate() {
            if id_of(step) == target {
                return Resumed::Ran(run.run_steps(&steps[index + 1..], false).await);
            }
            if !is_container(kind_of(step)) {
                continue;
            }
            for path in arr(&step["paths"]) {
                if !steps_of(arr(&path["steps"])).iter().any(|s| id_of(s) == target) {
                    continue;
                }
                if let Resumed::Ran(Some(h)) = resume_from(run, arr(&path["steps"]), target).await {
                    return Resumed::Ran(Some(h));
                }
                return Resumed::Ran(run.run_steps(&steps[index + 1..], false).await);
            }
        }
        Resumed::Absent
    })
}

/// `goOn`: a run that waited goes on, what it held read again.
async fn go_on(run: &mut Run, claimed: &Claimed, kept: &Value) -> Result<Outcome, AppError> {
    if let Some(data) = kept["data"].as_object() {
        for (k, v) in data {
            run.scope.data.insert(k.clone(), v.clone());
        }
    }
    run.log.extend(arr(&kept["log"]).iter().filter_map(|e| e.as_object().cloned()));
    if let Some(rows) = kept["rows"].as_object() {
        for (key, held) in rows {
            let table = str_of(held, "table").unwrap_or("").to_string();
            if key == TRIGGER_ROW && claimed.trigger_kind == "record_deleted" {
                let row = run.deleted_row(&table, claimed.payload.as_ref());
                run.hold(key, &table, row);
                continue;
            }
            let row = match held.get("id") {
                None | Some(Value::Null) => None,
                Some(id) => run.read_row(&table, id, "").await?,
            };
            run.hold(key, &table, row);
        }
    }
    let actions: Vec<Value> = arr(&kept["actions"]).to_vec();
    let after = str_of(kept, "after").unwrap_or("").to_string();
    let halt = match resume_from(run, &actions, &after).await {
        Resumed::Absent => None,
        Resumed::Ran(h) => h,
    };
    Ok(outcome_of(run, halt, &actions))
}

/// `runAutomations`: one pass — the schedules and dates due, then a batch of the queue.
pub async fn run_automations(st: &Shared) -> Result<usize, AppError> {
    queue_due(st).await?;
    queue_dates(st).await?;
    let conn = st.pools.get(PoolName::Catalog).await?;
    let claimed: Vec<Claimed> = conn
        .query_op(
            "UPDATE _basedb.automation_run
                SET status = 'running', resume_at = NULL,
                    started_at = coalesce(started_at, pg_catalog.clock_timestamp())
              WHERE id IN (SELECT id FROM _basedb.automation_run
                            WHERE status = 'queued'
                               OR (status = 'waiting' AND resume_at <= pg_catalog.clock_timestamp())
                            ORDER BY coalesce(resume_at, queued_at) LIMIT $1 FOR UPDATE SKIP LOCKED)
              RETURNING id::text, automation_id::text, trigger_kind, record_id::text, payload, depth::int, state",
            &[&BATCH],
            SqlOp::Update,
        )
        .await?
        .iter()
        .map(|r| Claimed {
            id: r.get(0),
            automation_id: r.get(1),
            trigger_kind: r.get(2),
            record_id: r.get(3),
            payload: r.get(4),
            depth: r.get::<_, i32>(5) as i64,
            state: r.get::<_, Option<Value>>(6).filter(|s| !s.is_null()),
        })
        .collect();
    drop(conn);
    for run in &claimed {
        let outcome = match std::panic::AssertUnwindSafe(run_one(st, run)).catch_unwind().await {
            Ok(Ok(o)) => o,
            Ok(Err(e)) => Outcome::Done { status: "failed", reason: None, error_code: Some(e.code.to_string()), steps: Vec::new() },
            Err(_) => Outcome::Done { status: "failed", reason: None, error_code: Some("INTERNAL_ERROR".into()), steps: Vec::new() },
        };
        let conn = st.pools.get(PoolName::Catalog).await?;
        match outcome {
            Outcome::Discarded => {
                conn.execute_op("DELETE FROM _basedb.automation_run WHERE id = $1::text::uuid", &[&run.id], SqlOp::Delete).await?;
            }
            Outcome::Waiting { resume_at, state, steps } => {
                conn.execute_op(
                    "UPDATE _basedb.automation_run
                        SET status = 'waiting', resume_at = $2::text::timestamptz, state = $3::text::jsonb, steps = $4::text::jsonb
                      WHERE id = $1::text::uuid",
                    &[&run.id, &iso(resume_at), &js_stringify(&state), &js_stringify(&Value::Array(steps))],
                    SqlOp::Update,
                )
                .await?;
            }
            Outcome::Done { status, reason, error_code, steps } => {
                conn.execute_op(
                    "UPDATE _basedb.automation_run
                        SET status = $2, reason = $3, error_code = $4, steps = $5::text::jsonb, state = NULL,
                            finished_at = pg_catalog.clock_timestamp()
                      WHERE id = $1::text::uuid",
                    &[&run.id, &status, &reason, &error_code, &js_stringify(&Value::Array(steps))],
                    SqlOp::Update,
                )
                .await?;
            }
        }
    }
    Ok(claimed.len())
}

/// The worker: a pass every two seconds, never two at once.
pub fn start_worker(st: Shared) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            ticker.tick().await;
            if let Err(e) = run_automations(&st).await {
                eprintln!("automatisations : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bare() -> Run {
        let cfg = basedb_base::testing::test_config().expect("config");
        let st = basedb_base::AppState::new(cfg).expect("state");
        let automation = Automation {
            id: "a".into(),
            base_id: "b".into(),
            label: "L".into(),
            description: None,
            enabled: true,
            trigger_kind: "schedule".into(),
            table: None,
            fields: json!([]),
            schedule: Value::Null,
            date: Value::Null,
            condition: None,
            actions: Vec::new(),
            owner_id: "o".into(),
            owner_name: String::new(),
            next_run_at: None,
            last_run: None,
            created_at: String::new(),
            updated_at: String::new(),
            hook_sealed: None,
            hook_path: None,
        };
        Run {
            st,
            run_id: "r".into(),
            ctx: actor_of("t", &automation),
            automation,
            tables: HashMap::new(),
            scope: Scope::default(),
            log: Vec::new(),
            depth: 0,
            files: HashMap::new(),
            instance_key: String::new(),
        }
    }

    fn step(id: &str, kind: &str, status: &str, extra: Value) -> Map<String, Value> {
        let mut m = json!({ "step": id, "kind": kind, "status": status, "ms": 2 }).as_object().unwrap().clone();
        for (k, v) in extra.as_object().unwrap() {
            m.insert(k.clone(), v.clone());
        }
        m
    }

    #[tokio::test]
    async fn turns_of_a_loop_are_kept_once() {
        let mut run = bare();
        run.log_step(step("e2", "notify", "succeeded", json!({ "detail": "2" })), true);
        run.log_step(step("e2", "notify", "succeeded", json!({ "detail": "3" })), true);
        assert_eq!(Value::Object(run.log[0].clone()), json!({ "step": "e2", "kind": "notify", "status": "succeeded", "detail": "5", "ms": 4, "times": 2 }));
        run.log_step(step("e3", "branch", "succeeded", json!({ "path": "p1", "detail": "A" })), true);
        run.log_step(step("e3", "branch", "succeeded", json!({ "path": null, "detail": "aucun_chemin" })), true);
        run.log_step(step("e3", "branch", "succeeded", json!({ "path": "p2", "detail": "B" })), true);
        let e3 = Value::Object(run.log[1].clone());
        assert_eq!(e3["path"], json!("p2"));
        assert_eq!(e3["taken"], json!(["p1", "p2"]));
        assert_eq!(e3["times"], json!(3));
        run.log_step(step("e2", "notify", "failed", json!({ "error_code": "X" })), true);
        assert_eq!(run.log[0]["status"], json!("failed"));
        assert_eq!(run.log[0]["times"], json!(3));
    }

    #[test]
    fn hosts_read_as_javascript_does() {
        assert_eq!(js_host(&url::Url::parse("https://Example.org/x").unwrap()), "example.org");
        assert_eq!(js_host(&url::Url::parse("http://localhost:8080/x").unwrap()), "localhost:8080");
        assert_eq!(js_host(&url::Url::parse("https://example.org:443/x").unwrap()), "example.org");
    }
}
