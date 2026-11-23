//! The history drain — `history/drain.ts`, with what it reads of the catalog
//! (`history/catalog.ts`), the runs it queues (`queueTriggered`) and the webhook deliveries
//! it schedules (`scheduleDeliveries`): the buffers of `_basedb_local` moved to the journals
//! of `_basedb`, one batch per transaction, under the advisory lock of class `drain` — Node
//! and Rust may both drain the same database, they take turns.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::idempotency::js_stringify;
use basedb_base::tx::TxGuard;
use basedb_catalog::naming::{qualify, quote_identifier};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::notifications::{can_read_table, emit_live};
use crate::pg::{col, refs, P};

pub const DRAIN_BATCH: usize = 500;
const DRAIN_LOCK_CLASS: i32 = 5;
pub const LIVE_MAX_IDS: usize = 100;
pub const RUNS_PER_HOUR: i64 = 100;
pub const DRAIN_CHANNEL: &str = "basedb_drain";
/// At most this many characters of a display value (§4.2).
pub const DISPLAY_MAX: usize = 200;

// ── history/catalog.ts ───────────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct HistoryTarget {
    pub table_id: String,
    pub schema: String,
    pub table: String,
    pub display_column: Option<String>,
}

#[derive(Clone, Debug)]
pub struct HistoryField {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub column: String,
    pub is_live: bool,
    pub target: Option<HistoryTarget>,
    pub options: Option<HashMap<String, String>>,
}

#[derive(Clone, Debug)]
pub struct HistoryTable {
    pub id: String,
    pub base_id: String,
    pub label: String,
    pub schema: String,
    pub table: String,
    pub is_live: bool,
    pub display_column: Option<String>,
    pub fields: Vec<HistoryField>,
}

fn text(row: &tokio_postgres::Row, i: usize) -> Option<String> {
    row.try_get::<_, Option<String>>(i).ok().flatten()
}

const TABLES_SQL: &str = "SELECT t.id::text, t.base_id::text, t.label, sn.name AS schema_name, tn.name AS table_name,
            t.is_live, dn.name AS display_column
       FROM _basedb.table_def t
       JOIN _basedb.physical_name tn ON tn.id = t.name_id
       JOIN _basedb.db_schema s      ON s.id = t.schema_id
       JOIN _basedb.physical_name sn ON sn.id = s.name_id
       LEFT JOIN _basedb.field df         ON df.id = t.display_field_id
       LEFT JOIN _basedb.physical_name dn ON dn.id = df.name_id
      WHERE t.id = ANY($1::uuid[])";

/// `loadHistoryTables`: the tables named, every field — live or deleted — whose column is known.
pub async fn load_history_tables<E: Exec + Sync>(exec: &E, table_ids: &[String]) -> Result<HashMap<String, HistoryTable>, AppError> {
    let mut out = HashMap::new();
    if table_ids.is_empty() {
        return Ok(out);
    }
    let ids = P::of(&json!(table_ids));
    let tables = exec.rows(TABLES_SQL, &refs(std::slice::from_ref(&ids))).await?;
    let fields = exec
        .rows(
            "SELECT f.id::text, f.table_id::text, f.kind, f.label, fn.name AS column_name, f.is_live,
            l.target_table_id::text
       FROM _basedb.field f
       JOIN _basedb.physical_name fn ON fn.id = f.name_id
       LEFT JOIN _basedb.field_link_config l ON l.field_id = f.id
      WHERE f.table_id = ANY($1::uuid[]) AND NOT f.is_purged
      ORDER BY f.position",
            &refs(std::slice::from_ref(&ids)),
        )
        .await?;
    let mut target_ids: Vec<String> = Vec::new();
    for f in &fields {
        if let Some(t) = text(f, 6) {
            if !target_ids.contains(&t) {
                target_ids.push(t);
            }
        }
    }
    let mut targets: HashMap<String, HistoryTarget> = HashMap::new();
    if !target_ids.is_empty() {
        for r in exec.rows(TABLES_SQL, &refs(&[P::of(&json!(target_ids))])).await? {
            let id: String = r.get(0);
            targets.insert(id.clone(), HistoryTarget { table_id: id, schema: r.get(3), table: r.get(4), display_column: text(&r, 6) });
        }
    }
    let choice: Vec<String> = fields.iter().filter(|f| matches!(f.get::<_, String>(2).as_str(), "select" | "multi_select")).map(|f| f.get(0)).collect();
    let mut options: HashMap<String, HashMap<String, String>> = HashMap::new();
    if !choice.is_empty() {
        for r in exec.rows("SELECT field_id::text, value, label FROM _basedb.select_option WHERE field_id = ANY($1::uuid[])", &refs(&[P::of(&json!(choice))])).await? {
            options.entry(r.get(0)).or_default().insert(r.get(1), r.get(2));
        }
    }
    for t in &tables {
        let id: String = t.get(0);
        let list = fields
            .iter()
            .filter(|f| f.get::<_, String>(1) == id)
            .map(|f| {
                let fid: String = f.get(0);
                HistoryField {
                    target: text(f, 6).and_then(|tid| targets.get(&tid).cloned()),
                    options: options.get(&fid).cloned(),
                    id: fid,
                    kind: f.get(2),
                    label: f.get(3),
                    column: f.get(4),
                    is_live: f.get(5),
                }
            })
            .collect();
        out.insert(
            id.clone(),
            HistoryTable { id, base_id: t.get(1), label: t.get(2), schema: t.get(3), table: t.get(4), is_live: t.get(5), display_column: text(t, 6), fields: list },
        );
    }
    Ok(out)
}

/// `String(value)`.
pub fn js_string(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => match (n.as_i64(), n.as_f64()) {
            (Some(i), _) => i.to_string(),
            (_, Some(f)) => crate::js::number_string(f),
            _ => n.to_string(),
        },
        Value::String(s) => s.clone(),
        Value::Array(items) => items.iter().map(|i| if i.is_null() { String::new() } else { js_string(i) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `displayText`: a value as a list shows it — lists joined, long values cut.
pub fn display_text(value: Option<&Value>) -> Option<String> {
    let value = value?;
    let text = match value {
        Value::Null => return None,
        Value::Array(items) => items
            .iter()
            .map(|v| match v {
                Value::Object(m) if m.contains_key("name") => js_string(&m["name"]),
                other => js_string(other),
            })
            .collect::<Vec<_>>()
            .join(", "),
        Value::Object(_) => js_stringify(value),
        other => js_string(other),
    };
    let n = text.chars().count();
    Some(if n > DISPLAY_MAX { format!("{}…", text.chars().take(DISPLAY_MAX - 1).collect::<String>()) } else { text })
}

// ── history/drain.ts ─────────────────────────────────────────────────────────

struct BufferRow {
    id: String,
    occurred_at: String,
    xact_id: String,
    base_id: String,
    table_id: String,
    record_id: String,
    op: String,
    is_cascade: bool,
    actor_kind: String,
    actor_user_id: Option<String>,
    actor_token_id: Option<String>,
    sql_identity: Option<String>,
    bulk_id: Option<String>,
    format_version: Value,
    before: Option<Map<String, Value>>,
    after: Option<Map<String, Value>>,
}

impl BufferRow {
    fn before_of(&self, column: &str) -> Option<&Value> {
        self.before.as_ref().and_then(|m| m.get(column))
    }
    fn after_of(&self, column: &str) -> Option<&Value> {
        self.after.as_ref().and_then(|m| m.get(column))
    }
    /// `(row.after ?? row.before)` / `(row.before ?? row.after)`.
    fn either(&self, after_first: bool) -> Option<&Map<String, Value>> {
        if after_first {
            self.after.as_ref().or(self.before.as_ref())
        } else {
            self.before.as_ref().or(self.after.as_ref())
        }
    }
}

/// One detail line: `None` is `undefined` (not concerned), `Some(Null)` was empty.
struct Detail {
    field: usize,
    before: Option<Value>,
    after: Option<Value>,
}

fn same(a: Option<&Value>, b: Option<&Value>) -> bool {
    let null = Value::Null;
    js_stringify(a.unwrap_or(&null)) == js_stringify(b.unwrap_or(&null))
}

fn details_of(row: &BufferRow, table: &HistoryTable) -> Vec<Detail> {
    let mut out = Vec::new();
    for (i, field) in table.fields.iter().enumerate() {
        let before = row.before_of(&field.column);
        let after = row.after_of(&field.column);
        if before.is_none() && after.is_none() {
            continue;
        }
        match row.op.as_str() {
            "insert" => {
                let Some(after) = after.filter(|a| !a.is_null()) else { continue };
                out.push(Detail { field: i, before: None, after: Some(after.clone()) });
            }
            "update" => {
                if !field.is_live || same(before, after) {
                    continue;
                }
                out.push(Detail { field: i, before: before.cloned(), after: after.cloned() });
            }
            _ => out.push(Detail { field: i, before: Some(before.cloned().unwrap_or(Value::Null)), after: None }),
        }
    }
    out
}

fn choice_display(field: &HistoryField, value: &Value) -> Option<String> {
    if value.is_null() {
        return None;
    }
    let label_of = |v: &Value| {
        let key = js_string(v);
        Value::String(field.options.as_ref().and_then(|o| o.get(&key).cloned()).unwrap_or(key))
    };
    let shown = match value {
        Value::Array(items) => Value::Array(items.iter().map(label_of).collect()),
        other => label_of(other),
    };
    display_text(Some(&shown))
}

async fn resolve_link_displays<E: Exec + Sync>(exec: &E, rows: &[BufferRow], tables: &HashMap<String, HistoryTable>, details: &HashMap<String, Vec<Detail>>) -> Result<HashMap<String, String>, AppError> {
    let mut order: Vec<String> = Vec::new();
    let mut wanted: HashMap<String, (HistoryTarget, Vec<String>)> = HashMap::new();
    for row in rows {
        let (Some(list), Some(table)) = (details.get(&row.id), tables.get(&row.table_id)) else { continue };
        for d in list {
            let Some(target) = &table.fields[d.field].target else { continue };
            if target.display_column.is_none() {
                continue;
            }
            let entry = wanted.entry(target.table_id.clone()).or_insert_with(|| {
                order.push(target.table_id.clone());
                (target.clone(), Vec::new())
            });
            for v in [&d.before, &d.after].into_iter().flatten() {
                let items: Vec<&Value> = match v {
                    Value::Array(a) => a.iter().collect(),
                    other => vec![other],
                };
                for id in items {
                    if let Value::String(s) = id {
                        if !entry.1.contains(s) {
                            entry.1.push(s.clone());
                        }
                    }
                }
            }
        }
    }
    let mut found: HashMap<String, String> = HashMap::new();
    let key = |t: &str, id: &str| format!("{t}:{id}");
    for table_id in order {
        let (target, ids) = &wanted[&table_id];
        let Some(display_column) = &target.display_column else { continue };
        if ids.is_empty() {
            continue;
        }
        exec.rows("SAVEPOINT link_display", &[]).await?;
        let current = async {
            let sql = format!(
                "SELECT \"_id\"::text AS id, {}::text AS display
           FROM {} WHERE \"_id\" = ANY($1::uuid[])",
                quote_identifier(display_column)?,
                qualify(&target.schema, &target.table)?
            );
            exec.rows(&sql, &refs(&[P::of(&json!(ids))])).await
        }
        .await;
        match current {
            Ok(rows) => {
                for r in rows {
                    if let Some(d) = text(&r, 1) {
                        found.insert(key(&table_id, &r.get::<_, String>(0)), d);
                    }
                }
                exec.rows("RELEASE SAVEPOINT link_display", &[]).await?;
            }
            Err(_) => {
                exec.rows("ROLLBACK TO SAVEPOINT link_display", &[]).await?;
            }
        }
        let missing: Vec<String> = ids.iter().filter(|id| !found.contains_key(&key(&table_id, id))).cloned().collect();
        for row in rows {
            if row.table_id != table_id || !missing.contains(&row.record_id) {
                continue;
            }
            if let Some(t) = display_text(row.either(false).and_then(|m| m.get(display_column))) {
                found.insert(key(&table_id, &row.record_id), t);
            }
        }
        let still: Vec<String> = missing.into_iter().filter(|id| !found.contains_key(&key(&table_id, id))).collect();
        if !still.is_empty() {
            let journal = exec
                .rows(
                    "SELECT DISTINCT ON (record_id) record_id::text, record_display
           FROM _basedb.record_revision
          WHERE table_id = $1 AND record_id = ANY($2::uuid[]) AND record_display IS NOT NULL
          ORDER BY record_id, occurred_at DESC",
                    &refs(&[P::text(&table_id), P::of(&json!(still))]),
                )
                .await?;
            for r in journal {
                found.insert(key(&table_id, &r.get::<_, String>(0)), r.get(1));
            }
        }
    }
    Ok(found)
}

/// `wantsNotification`.
pub async fn wants_notification<E: Exec + Sync>(exec: &E, user: &str, kind: &str) -> Result<bool, AppError> {
    Ok(!exec
        .rows("SELECT id FROM _basedb.app_user
       WHERE id = $1 AND NOT ($2 = ANY (muted_notifications))", &refs(&[P::text(user), P::text(kind)]))
        .await?
        .is_empty())
}

/// `contextOf`: someone who is not the caller, to decide what THEY may read.
pub fn context_of(tenant_ref: &str, user: &str, request_id: &str) -> basedb_base::tx::RequestContext {
    basedb_base::tx::RequestContext::new(request_id, basedb_base::tx::Actor::user(user), tenant_ref, basedb_base::tx::Surface::Ui)
}

struct Assigned<'a> {
    row: &'a BufferRow,
    user: String,
    display: Option<String>,
}

async fn notify_assigned<E: Exec + Sync>(exec: &E, assigned: &[Assigned<'_>]) -> Result<(), AppError> {
    if assigned.is_empty() {
        return Ok(());
    }
    let mut bases: Vec<String> = Vec::new();
    for a in assigned {
        if !bases.contains(&a.row.base_id) {
            bases.push(a.row.base_id.clone());
        }
    }
    let owners = exec
        .rows(
            "SELECT b.id::text, b.tenant_id::text, t.ref
       FROM _basedb.base b JOIN _basedb.tenant t ON t.id = b.tenant_id
      WHERE b.id = ANY($1::uuid[])",
            &refs(&[P::of(&json!(bases))]),
        )
        .await?;
    let by_base: HashMap<String, (String, String)> = owners.iter().map(|o| (o.get(0), (o.get(1), o.get(2)))).collect();
    for a in assigned {
        let Some((tenant_id, tenant_ref)) = by_base.get(&a.row.base_id) else { continue };
        if !crate::js::is_uuid_shape(&a.user) {
            continue;
        }
        let member = exec
            .first(
                "SELECT id::text FROM _basedb.app_user
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND disabled_at IS NULL",
                &refs(&[P::text(&a.user), P::text(tenant_id)]),
            )
            .await?;
        if member.is_none() || !wants_notification(exec, &a.user, "assigned").await? {
            continue;
        }
        if !can_read_table(exec, &context_of(tenant_ref, &a.user, &a.row.id), &a.row.table_id).await? {
            continue;
        }
        let units: Vec<u16> = a.display.clone().unwrap_or_default().encode_utf16().take(200).collect();
        let excerpt = String::from_utf16_lossy(&units);
        exec.query_op(
            "INSERT INTO _basedb.notification
         (tenant_id, user_id, kind, actor_id, base_id, table_id, record_id, excerpt)
       VALUES ($1, $2, 'assigned', $3, $4, $5, $6, $7)",
            &refs(&[
                P::text(tenant_id),
                P::text(&a.user),
                P(a.row.actor_user_id.clone()),
                P::text(&a.row.base_id),
                P::text(&a.row.table_id),
                P::text(&a.row.record_id),
                P::text(excerpt),
            ]),
            SqlOp::Insert,
        )
        .await?;
        emit_live(exec, &json!({ "kind": "notifications", "user": a.user })).await?;
    }
    Ok(())
}

/// `Trigger` of `automations/engine.ts`.
pub struct Trigger {
    pub table_id: String,
    pub record_id: String,
    pub op: String,
    pub actor_kind: String,
    pub changed: Vec<String>,
    pub before: Option<Option<Map<String, Value>>>,
}

fn triggers(kind: &str, fields: &[String], t: &Trigger) -> bool {
    match kind {
        "record_created" => t.op == "insert",
        "record_updated" => t.op == "update" && (fields.is_empty() || t.changed.iter().any(|c| fields.contains(c))),
        "record_deleted" => t.op == "delete",
        "record_matches" => t.op == "insert" || t.op == "update",
        _ => false,
    }
}

/// `queueTriggered`: the runs a drained batch triggers, in the drain's transaction.
pub async fn queue_triggered<E: Exec + Sync>(exec: &E, batch: &[Trigger]) -> Result<(), AppError> {
    let eligible: Vec<&Trigger> = batch.iter().filter(|t| t.actor_kind != "automation").collect();
    if eligible.is_empty() {
        return Ok(());
    }
    let mut tables: Vec<String> = Vec::new();
    for t in &eligible {
        if !tables.contains(&t.table_id) {
            tables.push(t.table_id.clone());
        }
    }
    let automations = exec
        .rows(
            "SELECT id::text, table_id::text, trigger_kind,
            ARRAY(SELECT jsonb_array_elements_text(coalesce(trigger->'fields', '[]'::jsonb))) AS fields
       FROM _basedb.automation
      WHERE table_id = ANY($1::uuid[]) AND deleted_at IS NULL AND is_enabled
        AND trigger_kind IN ('record_created', 'record_updated', 'record_deleted', 'record_matches')",
            &refs(&[P::of(&json!(tables))]),
        )
        .await?;
    for a in automations {
        let (id, table_id, kind): (String, String, String) = (a.get(0), a.get(1), a.get(2));
        let fields: Vec<String> = a.try_get::<_, Option<Vec<String>>>(3).ok().flatten().unwrap_or_default();
        let hits: Vec<&&Trigger> = eligible.iter().filter(|t| t.table_id == table_id && triggers(&kind, &fields, t)).collect();
        if hits.is_empty() {
            continue;
        }
        let mut room = hits.len();
        if kind != "record_matches" {
            let used: i32 = exec
                .first(
                    "SELECT count(*)::int AS n FROM _basedb.automation_run
          WHERE automation_id = $1 AND queued_at > pg_catalog.clock_timestamp() - interval '1 hour'
            AND reason IS DISTINCT FROM 'debit'",
                    &refs(&[P::text(&id)]),
                )
                .await?
                .map(|r| r.get(0))
                .unwrap_or(0);
            room = (RUNS_PER_HOUR - used as i64).max(0) as usize;
        }
        let queued = &hits[..room.min(hits.len())];
        if !queued.is_empty() {
            let payload: Vec<Value> = queued
                .iter()
                .map(|t| {
                    let payload = if kind == "record_deleted" {
                        let mut m = t.before.clone().flatten().unwrap_or_default();
                        m.insert("_id".into(), Value::String(t.record_id.clone()));
                        Value::Object(m)
                    } else {
                        Value::Null
                    };
                    json!({ "id": t.record_id, "payload": payload })
                })
                .collect();
            exec.query_op(
                "INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id, payload)
         SELECT $1, $2, x.id, x.payload
           FROM jsonb_to_recordset($3::jsonb) AS x(id uuid, payload jsonb)",
                &refs(&[P::text(&id), P::text(&kind), P::text(js_stringify(&Value::Array(payload)))]),
                SqlOp::Insert,
            )
            .await?;
        }
        if hits.len() > queued.len() {
            exec.query_op(
                "INSERT INTO _basedb.automation_run
           (automation_id, trigger_kind, record_id, status, reason, finished_at)
         VALUES ($1, $2, NULL, 'skipped', 'debit', pg_catalog.clock_timestamp())",
                &refs(&[P::text(&id), P::text(&kind)]),
                SqlOp::Insert,
            )
            .await?;
        }
    }
    Ok(())
}

/// `scheduleDeliveries`: one delivery per (event, active subscription).
pub async fn schedule_deliveries<E: Exec + Sync>(exec: &E, events: &[[String; 6]]) -> Result<(), AppError> {
    if events.is_empty() {
        return Ok(());
    }
    let column = |i: usize| P::of(&Value::Array(events.iter().map(|e| Value::String(e[i].clone())).collect()));
    exec.query_op(
        "INSERT INTO _basedb.webhook_delivery
       (webhook_id, subscription_id, base_id, event_id, event_occurred_at, role_id,
        partition_key, status)
     SELECT w.id, s.id, e.base_id, e.id, e.occurred_at, w.role_id,
            w.id::text || ':' || e.table_id::text || ':' || e.record_id::text, 'pending'
       FROM unnest($1::uuid[], $2::timestamptz[], $3::uuid[], $4::uuid[], $5::uuid[], $6::text[])
              AS e(id, occurred_at, base_id, table_id, record_id, op)
       JOIN _basedb.webhook_subscription s
         ON s.table_id = e.table_id
        AND s.event = CASE e.op WHEN 'insert' THEN 'create' WHEN 'update' THEN 'update' ELSE 'delete' END
       JOIN _basedb.webhook w ON w.id = s.webhook_id AND w.is_active AND w.deleted_at IS NULL",
        &refs(&[column(0), column(1), column(2), column(3), column(4), column(5)]),
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}

fn object_of(v: Value) -> Option<Map<String, Value>> {
    match v {
        Value::Object(m) => Some(m),
        _ => None,
    }
}

/// Per touched table: its base, record ids, operations and actors.
type Touched = (String, Vec<String>, Vec<String>, Vec<Option<String>>);

async fn drain_batch<E: Exec + Sync>(exec: &E) -> Result<usize, AppError> {
    let locked = exec.first("SELECT pg_try_advisory_xact_lock($1, 0) AS ok", &refs(&[P::text(DRAIN_LOCK_CLASS.to_string())])).await?;
    if locked.map(|r| r.get::<_, bool>(0)) != Some(true) {
        return Ok(0);
    }
    let raw = exec
        .rows(
            "SELECT id::text, occurred_at::text, xact_id::text, base_id::text, table_id::text,
            record_id::text, op, is_cascade, actor_kind, actor_user_id::text,
            actor_token_id::text, sql_identity, bulk_id::text, format_version, before, after
       FROM _basedb_local.revision_buffer
      WHERE drained_at IS NULL
      ORDER BY occurred_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED",
            &refs(&[P::text(DRAIN_BATCH.to_string())]),
        )
        .await?;
    let rows: Vec<BufferRow> = raw
        .iter()
        .map(|r| BufferRow {
            id: r.get(0),
            occurred_at: r.get(1),
            xact_id: r.get(2),
            base_id: r.get(3),
            table_id: r.get(4),
            record_id: r.get(5),
            op: r.get(6),
            is_cascade: r.get(7),
            actor_kind: r.get(8),
            actor_user_id: text(r, 9),
            actor_token_id: text(r, 10),
            sql_identity: text(r, 11),
            bulk_id: text(r, 12),
            format_version: col(r, 13),
            before: object_of(col(r, 14)),
            after: object_of(col(r, 15)),
        })
        .collect();

    if !rows.is_empty() {
        let mut ids: Vec<String> = Vec::new();
        for r in &rows {
            if !ids.contains(&r.table_id) {
                ids.push(r.table_id.clone());
            }
        }
        let tables = load_history_tables(exec, &ids).await?;
        let mut details: HashMap<String, Vec<Detail>> = HashMap::new();
        for row in &rows {
            details.insert(row.id.clone(), tables.get(&row.table_id).map(|t| details_of(row, t)).unwrap_or_default());
        }
        let links = resolve_link_displays(exec, &rows, &tables, &details).await?;
        let mut touched_order: Vec<String> = Vec::new();
        let mut touched: HashMap<String, Touched> = HashMap::new();
        let mut assigned: Vec<Assigned> = Vec::new();
        let mut trigger_list: Vec<Trigger> = Vec::new();

        for row in &rows {
            let table = tables.get(&row.table_id);
            let empty = Vec::new();
            let list = details.get(&row.id).unwrap_or(&empty);
            if row.op == "update" && list.is_empty() {
                continue;
            }
            let record_display = table
                .and_then(|t| t.display_column.as_ref())
                .and_then(|c| display_text(row.either(true).and_then(|m| m.get(c))));
            let batch = touched.entry(row.table_id.clone()).or_insert_with(|| {
                touched_order.push(row.table_id.clone());
                (row.base_id.clone(), Vec::new(), Vec::new(), Vec::new())
            });
            if !batch.1.contains(&row.record_id) {
                batch.1.push(row.record_id.clone());
            }
            if !batch.2.contains(&row.op) {
                batch.2.push(row.op.clone());
            }
            if !batch.3.contains(&row.actor_user_id) {
                batch.3.push(row.actor_user_id.clone());
            }
            let fields = table.map(|t| &t.fields[..]).unwrap_or(&[]);
            trigger_list.push(Trigger {
                table_id: row.table_id.clone(),
                record_id: row.record_id.clone(),
                op: row.op.clone(),
                actor_kind: row.actor_kind.clone(),
                changed: list.iter().map(|d| fields[d.field].column.clone()).collect(),
                before: if row.op == "delete" { Some(row.before.clone()) } else { None },
            });
            if row.op != "delete" {
                for d in list {
                    if fields[d.field].kind != "user" {
                        continue;
                    }
                    let Some(Value::String(after)) = &d.after else { continue };
                    if after.is_empty() || d.before.as_ref() == d.after.as_ref() || Some(after) == row.actor_user_id.as_ref() {
                        continue;
                    }
                    assigned.push(Assigned { row, user: after.clone(), display: record_display.clone() });
                }
            }

            exec.query_op(
                "INSERT INTO _basedb.record_revision
           (id, occurred_at, xact_id, base_id, table_id, record_id, op, is_cascade, bulk_id,
            record_display, actor_kind, actor_user_id, actor_token_id, sql_identity,
            format_version)
         VALUES ($1, $2::timestamptz, $3::xid8, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15)
         ON CONFLICT (id, occurred_at) DO NOTHING",
                &refs(&[
                    P::text(&row.id),
                    P::text(&row.occurred_at),
                    P::text(&row.xact_id),
                    P::text(&row.base_id),
                    P::text(&row.table_id),
                    P::text(&row.record_id),
                    P::text(&row.op),
                    P::text(row.is_cascade.to_string()),
                    P(row.bulk_id.clone()),
                    P(record_display.clone()),
                    P::text(&row.actor_kind),
                    P(row.actor_user_id.clone()),
                    P(row.actor_token_id.clone()),
                    P(row.sql_identity.clone()),
                    P::of(&row.format_version),
                ]),
                SqlOp::Insert,
            )
            .await?;

            for d in list {
                let field = &fields[d.field];
                let display = |value: &Option<Value>| -> Option<String> {
                    let value = value.as_ref().filter(|v| !v.is_null())?;
                    if let Some(target) = &field.target {
                        if let Value::String(s) = value {
                            return links.get(&format!("{}:{s}", target.table_id)).cloned();
                        }
                        if let Value::Array(items) = value {
                            return Some(
                                items
                                    .iter()
                                    .map(|id| links.get(&format!("{}:{}", target.table_id, js_string(id))).cloned().unwrap_or_else(|| "ligne non conservée".into()))
                                    .collect::<Vec<_>>()
                                    .join(", "),
                            );
                        }
                    }
                    match field.kind.as_str() {
                        "select" | "multi_select" => choice_display(field, value),
                        "file" | "image" => display_text(Some(value)),
                        _ => None,
                    }
                };
                exec.query_op(
                    "INSERT INTO _basedb.record_revision_field
             (revision_id, occurred_at, base_id, field_id, field_kind, before_value,
              after_value, before_display, after_display)
           VALUES ($1, $2::timestamptz, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
           ON CONFLICT (revision_id, occurred_at, field_id) DO NOTHING",
                    &refs(&[
                        P::text(&row.id),
                        P::text(&row.occurred_at),
                        P::text(&row.base_id),
                        P::text(&field.id),
                        P::text(&field.kind),
                        P(d.before.as_ref().map(js_stringify)),
                        P(d.after.as_ref().map(js_stringify)),
                        P(display(&d.before)),
                        P(display(&d.after)),
                    ]),
                    SqlOp::Insert,
                )
                .await?;
            }

            if row.op == "delete" {
                exec.query_op(
                    "INSERT INTO _basedb.record_deletion
             (base_id, table_id, record_id, deleted_at, deleted_by, actor_kind, is_cascade,
              revision_id)
           VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8)
           ON CONFLICT (table_id, deleted_at, record_id) DO NOTHING",
                    &refs(&[
                        P::text(&row.base_id),
                        P::text(&row.table_id),
                        P::text(&row.record_id),
                        P::text(&row.occurred_at),
                        P(row.actor_user_id.clone()),
                        P::text(&row.actor_kind),
                        P::text(row.is_cascade.to_string()),
                        P::text(&row.id),
                    ]),
                    SqlOp::Insert,
                )
                .await?;
            }
        }

        let all: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
        exec.rows("DELETE FROM _basedb_local.revision_buffer WHERE id = ANY($1::uuid[])", &refs(&[P::of(&json!(all))])).await?;

        notify_assigned(exec, &assigned).await?;
        queue_triggered(exec, &trigger_list).await?;
        for table in touched_order {
            let (base, ids, ops, actors) = &touched[&table];
            let actor = if actors.len() == 1 { actors[0].clone() } else { None };
            emit_live(
                exec,
                &json!({
                    "kind": "records",
                    "base": base,
                    "table": table,
                    "ids": if ids.len() > LIVE_MAX_IDS { Value::Null } else { json!(ids) },
                    "ops": ops,
                    "actor": actor,
                }),
            )
            .await?;
        }
    }

    let events = exec
        .query_op(
            "WITH moved AS (
       DELETE FROM _basedb_local.change_event_buffer
        WHERE id IN (SELECT id FROM _basedb_local.change_event_buffer
                      WHERE drained_at IS NULL
                      ORDER BY occurred_at, id
                      LIMIT $1
                      FOR UPDATE SKIP LOCKED)
       RETURNING *)
     INSERT INTO _basedb.change_event
       (id, occurred_at, base_id, table_id, record_id, op, is_cascade, xact_id, actor_kind,
        actor_user_id, actor_token_id, format_version, before, after)
     SELECT id, occurred_at, base_id, table_id, record_id, op, is_cascade, xact_id,
            actor_kind, actor_user_id, actor_token_id, format_version, before, after
       FROM moved
     ON CONFLICT (id, occurred_at) DO NOTHING
     RETURNING id::text, occurred_at::text, base_id::text, table_id::text, record_id::text, op",
            &refs(&[P::text(DRAIN_BATCH.to_string())]),
            SqlOp::Select,
        )
        .await?;
    let events: Vec<[String; 6]> = events.iter().map(|r| [r.get(0), r.get(1), r.get(2), r.get(3), r.get(4), r.get(5)]).collect();
    schedule_deliveries(exec, &events).await?;
    Ok(rows.len() + events.len())
}

/// `drainHistory`: batches until the buffers are empty or the lock is taken elsewhere.
pub async fn drain_history(pools: &Pools) -> Result<usize, AppError> {
    let mut total = 0;
    loop {
        let conn = Arc::new(pools.get(PoolName::Catalog).await?);
        let mut guard = TxGuard::new(conn.clone());
        let outcome = async {
            conn.rows("BEGIN", &[]).await?;
            let moved = drain_batch(&*conn).await?;
            conn.rows("COMMIT", &[]).await?;
            Ok::<usize, AppError>(moved)
        }
        .await;
        let moved = match outcome {
            Ok(m) => m,
            Err(e) => {
                let _ = conn.client().batch_execute("ROLLBACK").await;
                guard.disarm();
                return Err(e);
            }
        };
        guard.disarm();
        total += moved;
        if moved < DRAIN_BATCH {
            return Ok(total);
        }
    }
}

/// The drain as Node's `startDrainLoop` runs it — every 2 s, and 50 ms after a
/// `basedb_drain` wake-up — when this server runs the background (unless `BASEDB_RUST_BACKGROUND=0`).
pub fn start_drain_loop(pools: Pools, wake: Option<&basedb_base::listener::Listener>) -> tokio::task::JoinHandle<()> {
    let notify = Arc::new(tokio::sync::Notify::new());
    if let Some(listener) = wake {
        let n = notify.clone();
        listener.on(DRAIN_CHANNEL, move |_| n.notify_one());
    }
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(std::time::Duration::from_millis(2_000));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tokio::select! {
                _ = ticker.tick() => {}
                _ = notify.notified() => tokio::time::sleep(std::time::Duration::from_millis(50)).await,
            }
            if let Err(e) = drain_history(&pools).await {
                eprintln!("drain de l’historique : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_text_is_node_s() {
        assert_eq!(display_text(Some(&json!(null))), None);
        assert_eq!(display_text(Some(&json!(["a", 1.5, null, { "name": "x" }, { "id": 1 }]))).unwrap(), "a, 1.5, null, x, [object Object]");
        assert_eq!(display_text(Some(&json!({ "b": 1 }))).unwrap(), "{\"b\":1}");
        let long = "é".repeat(250);
        let cut = display_text(Some(&json!(long))).unwrap();
        assert_eq!(cut.chars().count(), 200);
        assert!(cut.ends_with('…'));
        assert_eq!(js_string(&json!([1, [2, null], "a"])), "1,2,,a");
    }
}
