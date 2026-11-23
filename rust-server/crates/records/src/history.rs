//! The history of rows — `history/read.ts`, `history/undo.ts`, `records/inverse-links.ts`:
//! reading revisions, undoing a modification, restoring a deletion, undoing a whole
//! transaction, the deletion journal and the rows that reference a row.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::idempotency::js_stringify;
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Decision, Verdict};
use basedb_base::rbac::loader::{load_grants, load_target, COMPUTED_KINDS};
use basedb_base::rbac::rows::{row_where, ROW_ALIAS};
use basedb_base::time::{b64url, b64url_decode, iso};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_catalog::naming::{qualify, quote_identifier};
use chrono::{DateTime, Local, Utc};
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

use crate::drain::{drain_history, js_string, load_history_tables, HistoryTable};
use crate::js::{is_uuid_shape, number_string};
use crate::pg::{col, refs, P};

pub const HISTORY_PAGE: f64 = 50.0;
pub const HISTORY_PAGE_MAX: f64 = 200.0;
pub const UNDO_WINDOW_HOURS: i64 = 24;
pub const UNDO_MAX_REVISIONS: usize = 1_000;
const INVERSE_BLOCKS: usize = 20;
const INVERSE_ROWS: usize = 50;
const INVERSE_COUNT_CAP: i64 = 500;

fn qi(name: &str) -> Result<String, AppError> {
    quote_identifier(name)
}

fn relation(schema: &str, table: &str) -> Result<String, AppError> {
    qualify(schema, table)
}

fn s(row: &tokio_postgres::Row, i: usize) -> Option<String> {
    col(row, i).as_str().map(str::to_string)
}

// ── JavaScript dates ─────────────────────────────────────────────────────────

/// `new Date(text)` of PostgreSQL's text of a `timestamptz` (`2026-11-19 14:43:02.395123+00`).
pub fn parse_pg_instant(text: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S%.f%#z").ok().map(|d| d.with_timezone(&Utc))
}

/// `new Date(text).toISOString()` of PostgreSQL's text — V8 keeps the milliseconds.
pub fn pg_instant_iso(text: &str) -> String {
    parse_pg_instant(text).map(iso).unwrap_or_else(|| text.to_string())
}

/// `String(date)`: `Date.prototype.toString` in the server's zone, ICU's French names
/// for Central Europe as Node prints them under `fr` (`heure normale d’Europe centrale`).
pub fn js_date_to_string(at: DateTime<Utc>) -> String {
    let local: DateTime<Local> = at.with_timezone(&Local);
    let offset = local.offset().local_minus_utc();
    let name = match offset {
        3600 => "heure normale d’Europe centrale".to_string(),
        7200 => "heure d’été d’Europe centrale".to_string(),
        0 => "temps universel coordonné".to_string(),
        o => {
            let sign = if o < 0 { '-' } else { '+' };
            format!("UTC{sign}{:02}:{:02}", o.abs() / 3600, o.abs() % 3600 / 60)
        }
    };
    format!("{} GMT{} ({name})", local.format("%a %b %d %Y %H:%M:%S"), local.format("%z"))
}

fn month_of(word: &str) -> Option<u32> {
    const MONTHS: [&str; 12] = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    let w = word.to_ascii_lowercase();
    if w.len() < 3 {
        return None;
    }
    MONTHS.iter().position(|m| w.starts_with(m)).map(|i| i as u32 + 1)
}

/// `!Number.isNaN(Date.parse(text))` — V8's ES5 ISO form first, then its legacy reader
/// (unknown words before the first number skipped, month names, `H:M[:S]`, a zone).
pub fn js_date_parses(text: &str) -> bool {
    static ISO: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        regex::Regex::new(r"^([+-]\d{6}|\d{4})(?:-(\d\d)(?:-(\d\d))?)?(?:T(\d\d):(\d\d)(?::(\d\d)(?:\.\d+)?)?(Z|[+-]\d\d:\d\d)?)?$").unwrap()
    });
    let text = text.trim();
    if let Some(c) = ISO.captures(text) {
        let n = |i: usize, d: u32| c.get(i).map(|m| m.as_str().parse::<u32>().unwrap_or(99)).unwrap_or(d);
        if (1..=12).contains(&n(2, 1)) && (1..=31).contains(&n(3, 1)) && n(4, 0) <= 24 && n(5, 0) <= 59 && n(6, 0) <= 59 {
            return true;
        }
    }
    legacy_date_parses(text)
}

fn legacy_date_parses(text: &str) -> bool {
    let mut numbers: Vec<u64> = Vec::new();
    let mut month: Option<u32> = None;
    let mut time: Vec<u64> = Vec::new();
    let mut read_number = false;
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    let mut depth = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '(' {
            depth += 1;
            i += 1;
            continue;
        }
        if c == ')' {
            depth -= 1;
            i += 1;
            continue;
        }
        if depth > 0 {
            i += 1;
            continue;
        }
        if c.is_ascii_digit() {
            let start = i;
            while i < chars.len() && chars[i].is_ascii_digit() {
                i += 1;
            }
            let value: u64 = chars[start..i].iter().collect::<String>().parse().unwrap_or(u64::MAX);
            read_number = true;
            let prev = if start > 0 { chars[start - 1] } else { ' ' };
            if (i < chars.len() && chars[i] == ':') || (prev == ':' && !time.is_empty()) {
                time.push(value);
            } else if (prev == '+' || prev == '-') && !time.is_empty() {
                // A zone offset after the time.
            } else if prev == '.' && !time.is_empty() {
                // Milliseconds.
            } else {
                numbers.push(value);
            }
            continue;
        }
        if c.is_alphabetic() {
            let start = i;
            while i < chars.len() && chars[i].is_alphabetic() {
                i += 1;
            }
            let word: String = chars[start..i].iter().collect();
            let lower = word.to_ascii_lowercase();
            let known = matches!(lower.as_str(), "am" | "pm" | "t" | "z" | "ut" | "utc" | "gmt" | "est" | "edt" | "cst" | "cdt" | "mst" | "mdt" | "pst" | "pdt")
                || (lower.len() >= 3 && ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].iter().any(|d| lower.starts_with(d)));
            if let Some(m) = month_of(&word) {
                month = Some(m);
            } else if !known && read_number {
                return false;
            }
            continue;
        }
        i += 1;
    }
    if !read_number || numbers.len() > 3 || time.len() > 3 {
        return false;
    }
    if time.first().is_some_and(|h| *h > 24) || time.get(1).is_some_and(|m| *m > 59) || time.get(2).is_some_and(|s| *s > 59) {
        return false;
    }
    let (m, d) = match (month, numbers.as_slice()) {
        (Some(m), [d, ..]) if *d <= 31 => (m as u64, *d),
        (Some(m), [y, d]) if *y > 31 => (m as u64, *d),
        (Some(_), _) => return false,
        (None, [y, m, d]) if *y > 31 => (*m, *d),
        (None, [m, d, _]) => (*m, *d),
        (None, [y, m]) if *y > 31 => (*m, 1),
        (None, [m, d]) => (*m, *d),
        (None, [y]) if *y > 31 => (1, 1),
        (None, [m]) => (*m, 1),
        (None, _) => return false,
    };
    (1..=12).contains(&m) && (1..=31).contains(&d)
}

/// `Number(limit)` then `limitOf`: a JavaScript number — NaN included.
fn limit_of(limit: Option<f64>) -> f64 {
    let l = limit.unwrap_or(HISTORY_PAGE).trunc();
    if l.is_nan() {
        return f64::NAN;
    }
    l.clamp(1.0, HISTORY_PAGE_MAX)
}

/// The `LIMIT` parameter as node-postgres writes `limit + 1`.
fn limit_param(limit: f64) -> P {
    P::text(number_string(limit + 1.0))
}

fn encode_cursor(at: &str, id: &str) -> String {
    b64url(format!("{at}|{id}").as_bytes())
}

fn decode_cursor(cursor: Option<&str>) -> Result<Option<(String, String)>, AppError> {
    let Some(cursor) = cursor.filter(|c| !c.is_empty()) else { return Ok(None) };
    let text = b64url_decode_lenient(cursor);
    let mut parts = text.split('|');
    match (parts.next(), parts.next()) {
        (Some(at), Some(id)) if is_uuid_shape(id) => Ok(Some((at.to_string(), id.to_string()))),
        _ => Err(AppError::new("CURSOR_INVALID")),
    }
}

/// `Buffer.from(text, 'base64url').toString('utf8')`: junk characters skipped, lossy UTF-8.
fn b64url_decode_lenient(text: &str) -> String {
    let clean: String = text.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '+' || *c == '/').map(|c| match c {
        '+' => '-',
        '/' => '_',
        c => c,
    }).collect();
    let usable = if clean.len() % 4 == 1 { &clean[..clean.len() - 1] } else { &clean[..] };
    String::from_utf8_lossy(&b64url_decode(usable).unwrap_or_default()).into_owned()
}

// ── the deletion journal ─────────────────────────────────────────────────────

/// `listDeletions`, shaped as the route answers.
pub async fn list_deletions(pools: &Pools, ctx: &RequestContext, table_id: &str, since: &str, cursor: Option<&str>, limit: Option<f64>) -> Result<Value, AppError> {
    if !js_date_parses(since) {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("since")));
    }
    let _ = drain_history(pools).await;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        let target = load_target(&tx, ctx, table_id).await?;
        let read = target.map(|t| decide(ctx, &grants, Action::Read, &t));
        let Some(read) = read.filter(|r| r.verdict == Verdict::Allowed) else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
        };
        if read.row_predicate != "TRUE" {
            return Ok(json!({ "data": [], "meta": { "next_cursor": null } }));
        }
        let after = decode_cursor(cursor)?;
        let limit = limit_of(limit);
        let params = [
            P::text(table_id),
            P::text(since),
            P(after.as_ref().map(|a| a.0.clone())),
            P(after.as_ref().map(|a| a.1.clone())),
            limit_param(limit),
        ];
        let rows = tx
            .rows(
                "SELECT record_id::text, deleted_at::text, deleted_by::text, is_cascade
           FROM _basedb.record_deletion
          WHERE table_id = $1 AND deleted_at >= $2::timestamptz
            AND ($3::timestamptz IS NULL OR (deleted_at, record_id) > ($3::timestamptz, $4::uuid))
          ORDER BY deleted_at, record_id
          LIMIT $5",
                &refs(&params),
            )
            .await?;
        let more = (rows.len() as f64) > limit;
        let page = if more { &rows[..limit as usize] } else { &rows[..] };
        let data: Vec<Value> = page
            .iter()
            .map(|r| {
                json!({
                    "_id": col(r, 0),
                    "deleted_at": pg_instant_iso(&s(r, 1).unwrap_or_default()),
                    "deleted_by": col(r, 2),
                    "cause": if col(r, 3) == Value::Bool(true) { "cascade" } else { "direct" },
                })
            })
            .collect();
        let next = match page.last() {
            Some(last) if more => json!(encode_cursor(&s(last, 1).unwrap_or_default(), &s(last, 0).unwrap_or_default())),
            _ => Value::Null,
        };
        Ok(json!({ "data": data, "meta": { "next_cursor": next } }))
    })
    .await
}

// ── the rows referencing a row ───────────────────────────────────────────────

struct Incoming {
    table_label: String,
    table_name: String,
    schema_name: String,
    field_label: String,
    column: String,
    display_column: Option<String>,
    kind: String,
    row_predicate: String,
}

/// `listInverseLinks`, shaped as the route answers.
pub async fn list_inverse_links(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str) -> Result<Value, AppError> {
    let plan = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id));
        let Some(target) = load_target(&tx, ctx, table_id).await? else { return Err(not_found()) };
        let grants = load_grants(&tx, ctx).await?;
        if decide(ctx, &grants, Action::Read, &target).verdict != Verdict::Allowed {
            return Err(not_found());
        }
        let params = [P::text(table_id)];
        let incoming = tx
            .rows(
                "SELECT t.id          AS table_id,
            t.label       AS table_label,
            tn.name       AS table_name,
            sn.name       AS schema_name,
            f.label       AS field_label,
            n.name        AS column,
            dn.name       AS display_column,
            f.kind
       FROM _basedb.field_link_config lc
       JOIN _basedb.field f           ON f.id = lc.field_id
       JOIN _basedb.physical_name n   ON n.id = f.name_id
       JOIN _basedb.table_def t       ON t.id = f.table_id
       JOIN _basedb.physical_name tn  ON tn.id = t.name_id
       JOIN _basedb.db_schema s       ON s.id = t.schema_id
       JOIN _basedb.physical_name sn  ON sn.id = s.name_id
       LEFT JOIN _basedb.field df     ON df.id = t.display_field_id
       LEFT JOIN _basedb.physical_name dn ON dn.id = df.name_id
      WHERE lc.target_table_id = $1
        AND lc.fk_dropped_at IS NULL
        AND f.is_live AND t.is_live
      ORDER BY t.label, f.position",
                &refs(&params),
            )
            .await?;
        let mut readable = Vec::new();
        for link in &incoming {
            let source_id = s(link, 0).unwrap_or_default();
            let Some(source) = load_target(&tx, ctx, &source_id).await? else { continue };
            let decision = decide(ctx, &grants, Action::Read, &source);
            if decision.verdict != Verdict::Allowed {
                continue;
            }
            let mut display = s(link, 6);
            if display.is_some() {
                let p = [P::text(&source_id)];
                let ids = tx.rows("SELECT display_field_id FROM _basedb.table_def WHERE id = $1", &refs(&p)).await?;
                let id = ids.first().and_then(|r| s(r, 0));
                if !id.is_none_or(|id| decision.readable_fields.contains(&id)) {
                    display = None;
                }
            }
            readable.push(Incoming {
                table_label: s(link, 1).unwrap_or_default(),
                table_name: s(link, 2).unwrap_or_default(),
                schema_name: s(link, 3).unwrap_or_default(),
                field_label: s(link, 4).unwrap_or_default(),
                column: s(link, 5).unwrap_or_default(),
                display_column: display,
                kind: s(link, 7).unwrap_or_default(),
                row_predicate: decision.row_predicate,
            });
        }
        Ok(readable)
    })
    .await?;

    let truncated = plan.len() > INVERSE_BLOCKS;
    let mut blocks = Vec::new();
    let mut sql = Vec::new();
    for link in plan.iter().take(INVERSE_BLOCKS) {
        let rel = relation(&link.schema_name, &link.table_name)?;
        let column = qi(&link.column)?;
        let cites = if link.kind == "multi_link" { format!("{column} @> ARRAY[$1::uuid]") } else { format!("{column} = $1::uuid") };
        let projection = match &link.display_column {
            None => "\"_id\", \"_updated_at\"".to_string(),
            Some(d) => format!("\"_id\", {} AS \"_display\", \"_updated_at\"", qi(d)?),
        };
        let rows_where = row_where(&link.row_predicate, Some(&rel));
        let rows_query = format!(
            "SELECT {projection}\n  FROM {rel}\n WHERE {cites}\n   AND ( /*predicat_lignes:{}*/ {rows_where} )\n ORDER BY \"_id\" DESC\n LIMIT {INVERSE_ROWS};",
            link.table_name
        );
        let count_query = format!(
            "SELECT count(*)::int AS n\n  FROM (SELECT 1\n          FROM {rel}\n         WHERE {cites}\n           AND ( /*predicat_lignes:{}*/ {rows_where} )\n         LIMIT {}) t;",
            link.table_name,
            INVERSE_COUNT_CAP + 1
        );
        let params = [P::text(record_id)];
        let rows = pools.get(PoolName::Data).await?.rows(&rows_query, &refs(&params)).await?;
        let counted = pools.get(PoolName::Data).await?.first(&count_query, &refs(&params)).await?;
        let n = counted.map(|r| r.get::<_, i32>(0) as i64).unwrap_or(0);
        let display_at = link.display_column.as_ref().map(|_| 1);
        let updated_at = if display_at.is_some() { 2 } else { 1 };
        let rows: Vec<Value> = rows
            .iter()
            .map(|r| {
                let updated = col(r, updated_at);
                let text = updated
                    .as_str()
                    .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
                    .map(|d| js_date_to_string(d.with_timezone(&Utc)))
                    .unwrap_or_else(|| js_string(&updated));
                json!({
                    "id": col(r, 0),
                    "display": display_at.map(|i| col(r, i)).unwrap_or(Value::Null),
                    "updatedAt": text,
                })
            })
            .collect();
        blocks.push(json!({
            "label": format!("{} · {}", link.table_label, link.field_label),
            "table": link.table_name,
            "field": link.column,
            "count": n.min(INVERSE_COUNT_CAP),
            "capped": n > INVERSE_COUNT_CAP,
            "rows": rows,
        }));
        sql.push(rows_query);
        sql.push(count_query);
    }
    Ok(json!({ "data": blocks, "meta": { "truncated": truncated, "sql": sql } }))
}

// ── reading revisions ────────────────────────────────────────────────────────

struct Visible {
    table: HistoryTable,
    read: Decision,
    update: Decision,
    create: Decision,
}

async fn visible_tables<E: Exec + Sync>(exec: &E, ctx: &RequestContext, grants: &ActorGrants, table_ids: &[String]) -> Result<IndexMap<String, Visible>, AppError> {
    let mut tables = load_history_tables(exec, table_ids).await?;
    let mut out = IndexMap::new();
    for id in table_ids {
        let target = load_target(exec, ctx, id).await?;
        let Some(table) = tables.remove(id) else { continue };
        let Some(target) = target else { continue };
        let read = decide(ctx, grants, Action::Read, &target);
        if read.verdict != Verdict::Allowed {
            continue;
        }
        out.insert(id.clone(), Visible { table, read, update: decide(ctx, grants, Action::Update, &target), create: decide(ctx, grants, Action::Create, &target) });
    }
    Ok(out)
}

struct Header {
    id: String,
    occurred_at: String,
    table_id: String,
    record_id: String,
    op: String,
    row: tokio_postgres::Row,
}

async fn page_of<E: Exec + Sync>(exec: &E, visible: &IndexMap<String, Visible>, where_sql: &str, mut params: Vec<P>, cursor: Option<&str>, limit: f64) -> Result<Value, AppError> {
    let after = decode_cursor(cursor)?;
    let mut bound = String::new();
    if let Some((at, id)) = after {
        params.push(P::text(at));
        params.push(P::text(id));
        let (a, b) = (params.len() - 1, params.len());
        bound = format!("AND r.occurred_at <= ${a}::timestamptz\n             AND (r.occurred_at, r.id) < (${a}::timestamptz, ${b}::uuid)");
    }
    params.push(limit_param(limit));
    let sql = format!(
        "SELECT r.id::text, r.occurred_at::text, r.table_id::text, r.record_id::text, r.op,
            r.is_cascade, r.record_display, r.actor_kind, r.actor_user_id::text,
            r.actor_token_id::text, r.sql_identity,
            u.display_name AS user_name, coalesce(tk.label, fv.label, au.label) AS token_label
       FROM _basedb.record_revision r
       LEFT JOIN _basedb.app_user u   ON u.id = r.actor_user_id
       LEFT JOIN _basedb.api_token tk ON tk.id = r.actor_token_id
       LEFT JOIN _basedb.form_share fs ON fs.id = r.actor_token_id AND r.actor_kind = 'form'
       LEFT JOIN _basedb.view_def fv   ON fv.id = fs.view_id
       LEFT JOIN _basedb.automation au ON au.id = r.actor_token_id AND r.actor_kind = 'automation'
      WHERE {where_sql} {bound}
      ORDER BY r.occurred_at DESC, r.id DESC
      LIMIT ${}",
        params.len()
    );
    let rows = exec.rows(&sql, &refs(&params)).await?;
    let more = (rows.len() as f64) > limit;
    let take = if more { limit as usize } else { rows.len() };
    let page: Vec<Header> = rows
        .into_iter()
        .take(take)
        .map(|row| Header {
            id: s(&row, 0).unwrap_or_default(),
            occurred_at: s(&row, 1).unwrap_or_default(),
            table_id: s(&row, 2).unwrap_or_default(),
            record_id: s(&row, 3).unwrap_or_default(),
            op: s(&row, 4).unwrap_or_default(),
            row,
        })
        .collect();

    let mut by_revision: HashMap<String, Vec<tokio_postgres::Row>> = HashMap::new();
    if !page.is_empty() {
        let ids: Vec<Value> = page.iter().map(|h| json!(h.id)).collect();
        let ats: Vec<Value> = page.iter().map(|h| json!(h.occurred_at)).collect();
        let p = [P::of(&Value::Array(ids)), P::of(&Value::Array(ats))];
        for d in exec
            .rows(
                "SELECT revision_id::text, field_id::text, field_kind, before_value, after_value,
                  before_display, after_display,
                  before_value IS NOT NULL AS has_before, after_value IS NOT NULL AS has_after
             FROM _basedb.record_revision_field
            WHERE (revision_id, occurred_at) IN
                  (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))",
                &refs(&p),
            )
            .await?
        {
            by_revision.entry(s(&d, 0).unwrap_or_default()).or_default().push(d);
        }
    }

    let mut seen: HashMap<&str, HashSet<String>> = HashMap::new();
    for (table_id, v) in visible {
        if v.read.row_predicate == "TRUE" {
            continue;
        }
        let mut ids: Vec<String> = Vec::new();
        for h in page.iter().filter(|h| &h.table_id == table_id) {
            if !ids.contains(&h.record_id) {
                ids.push(h.record_id.clone());
            }
        }
        let mut found = HashSet::new();
        if !ids.is_empty() && v.table.is_live {
            let sql = format!(
                "SELECT \"_id\"::text AS id FROM {} AS {}\n              WHERE \"_id\" = ANY($1::uuid[]) AND ( /*predicat_lignes*/ {} )",
                relation(&v.table.schema, &v.table.table)?,
                qi(ROW_ALIAS)?,
                v.read.row_predicate
            );
            for r in exec.rows(&sql, &refs(&[P::of(&json!(ids))])).await? {
                found.insert(s(&r, 0).unwrap_or_default());
            }
        }
        seen.insert(table_id, found);
    }

    let mut present: HashSet<String> = HashSet::new();
    for (table_id, v) in visible {
        let deleted: Vec<&str> = page.iter().filter(|h| &h.table_id == table_id && h.op == "delete").map(|h| h.record_id.as_str()).collect();
        if deleted.is_empty() || !v.table.is_live {
            continue;
        }
        let sql = format!("SELECT \"_id\"::text AS id FROM {}\n        WHERE \"_id\" = ANY($1::uuid[])", relation(&v.table.schema, &v.table.table)?);
        for r in exec.rows(&sql, &refs(&[P::of(&json!(deleted))])).await? {
            present.insert(format!("{table_id}:{}", s(&r, 0).unwrap_or_default()));
        }
    }

    let mut revisions = Vec::new();
    for h in &page {
        let Some(v) = visible.get(&h.table_id) else { continue };
        if let Some(reached) = seen.get(h.table_id.as_str()) {
            if !reached.contains(&h.record_id) {
                continue;
            }
        }
        let index_of = |id: &str| v.table.fields.iter().position(|f| f.id == id).map(|i| i as i64).unwrap_or(-1);
        let mut changes: Vec<(i64, String, Value)> = by_revision
            .get(&h.id)
            .map(|ds| ds.as_slice())
            .unwrap_or(&[])
            .iter()
            .filter(|d| v.read.readable_fields.contains(&s(d, 1).unwrap_or_default()))
            .map(|d| {
                let field_id = s(d, 1).unwrap_or_default();
                let field = v.table.fields.iter().find(|f| f.id == field_id);
                let mut c = Map::new();
                c.insert("field_id".into(), json!(field_id));
                c.insert("label".into(), json!(field.map(|f| f.label.clone()).unwrap_or_else(|| field_id.clone())));
                c.insert("kind".into(), col(d, 2));
                c.insert("name".into(), match field {
                    Some(f) if f.is_live => json!(f.column),
                    _ => Value::Null,
                });
                if col(d, 7) == Value::Bool(true) {
                    c.insert("before".into(), col(d, 3));
                }
                if col(d, 8) == Value::Bool(true) {
                    c.insert("after".into(), col(d, 4));
                }
                c.insert("before_display".into(), col(d, 5));
                c.insert("after_display".into(), col(d, 6));
                (index_of(&field_id), field_id, Value::Object(c))
            })
            .collect();
        changes.sort_by_key(|c| c.0);
        if h.op == "update" && changes.is_empty() {
            continue;
        }
        let mut actions = Vec::new();
        if h.op == "update"
            && v.table.is_live
            && v.update.verdict == Verdict::Allowed
            && changes.iter().all(|(_, id, c)| !c["name"].is_null() && v.update.writable_fields.contains(id))
        {
            actions.push("revert");
        }
        if h.op == "delete" && v.table.is_live && v.create.verdict == Verdict::Allowed && !present.contains(&format!("{}:{}", h.table_id, h.record_id)) {
            actions.push("restore");
        }
        let r = &h.row;
        revisions.push(json!({
            "id": h.id,
            "occurred_at": pg_instant_iso(&h.occurred_at),
            "op": h.op,
            "cascade": col(r, 5),
            "table": { "id": v.table.id, "name": v.table.table, "label": v.table.label },
            "record_id": h.record_id,
            "record_display": col(r, 6),
            "actor": {
                "kind": col(r, 7),
                "user_id": col(r, 8),
                "name": col(r, 11),
                "token_id": col(r, 9),
                "token_label": col(r, 12),
                "sql_identity": col(r, 10),
            },
            "changes": changes.into_iter().map(|c| c.2).collect::<Vec<_>>(),
            "actions": actions,
        }));
    }
    let next = match page.last() {
        Some(last) if more => json!(encode_cursor(&last.occurred_at, &last.id)),
        _ => Value::Null,
    };
    Ok(json!({ "data": revisions, "meta": { "next_cursor": next } }))
}

/// `recordHistory`, shaped as the route answers.
pub async fn record_history(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str, cursor: Option<&str>, limit: Option<f64>) -> Result<Value, AppError> {
    if !is_uuid_shape(record_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record_id)));
    }
    let _ = drain_history(pools).await;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        let visible = visible_tables(&tx, ctx, &grants, &[table_id.to_string()]).await?;
        if !visible.contains_key(table_id) {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
        }
        page_of(&tx, &visible, "r.table_id = $1 AND r.record_id = $2", vec![P::text(table_id), P::text(record_id)], cursor, limit_of(limit)).await
    })
    .await
}

/// `baseHistory`, shaped as the route answers.
pub async fn base_history(pools: &Pools, ctx: &RequestContext, base_id: &str, table_id: Option<&str>, cursor: Option<&str>, limit: Option<f64>) -> Result<Value, AppError> {
    let _ = drain_history(pools).await;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        let params = [P::text(base_id), P(table_id.map(str::to_string))];
        let ids: Vec<String> = tx
            .rows("SELECT id::text FROM _basedb.table_def\n          WHERE base_id = $1 AND is_live AND ($2::uuid IS NULL OR id = $2::uuid)", &refs(&params))
            .await?
            .iter()
            .filter_map(|r| s(r, 0))
            .collect();
        let visible = visible_tables(&tx, ctx, &grants, &ids).await?;
        if visible.is_empty() {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)));
        }
        let keys: Vec<Value> = visible.keys().map(|k| json!(k)).collect();
        page_of(&tx, &visible, "r.base_id = $1 AND r.table_id = ANY($2::uuid[])", vec![P::text(base_id), P::of(&Value::Array(keys))], cursor, limit_of(limit)).await
    })
    .await
}

// ── undoing ──────────────────────────────────────────────────────────────────

pub struct Loaded {
    id: String,
    table_id: String,
    record_id: String,
    op: String,
    /// `(field_id, before, after, has_before)`.
    fields: Vec<(String, Value, Value, bool)>,
}

/// `loadRevision`.
async fn load_revision<E: Exec + Sync>(exec: &E, revision_id: &str) -> Result<Option<Loaded>, AppError> {
    if !is_uuid_shape(revision_id) {
        return Ok(None);
    }
    let p = [P::text(revision_id)];
    let Some(h) = exec
        .first("SELECT id::text, occurred_at::text, table_id::text, record_id::text, op,\n            actor_user_id::text\n       FROM _basedb.record_revision WHERE id = $1", &refs(&p))
        .await?
    else {
        return Ok(None);
    };
    let p = [P::text(revision_id), P(s(&h, 1))];
    let fields = exec
        .rows(
            "SELECT field_id::text, before_value, after_value, before_value IS NOT NULL AS has_before\n       FROM _basedb.record_revision_field\n      WHERE revision_id = $1 AND occurred_at = $2::timestamptz",
            &refs(&p),
        )
        .await?
        .iter()
        .map(|r| (s(r, 0).unwrap_or_default(), col(r, 1), col(r, 2), col(r, 3) == Value::Bool(true)))
        .collect();
    Ok(Some(Loaded { id: s(&h, 0).unwrap_or_default(), table_id: s(&h, 2).unwrap_or_default(), record_id: s(&h, 3).unwrap_or_default(), op: s(&h, 4).unwrap_or_default(), fields }))
}

fn not_found_revision(id: &str) -> AppError {
    AppError::new("RESOURCE_NOT_FOUND").with("revision", json!(id))
}

fn null_if_absent(v: Option<&Value>) -> &Value {
    v.unwrap_or(&Value::Null)
}

async fn current_row<E: Exec + Sync>(exec: &E, rel: &str, predicate: &str, record_id: &str) -> Result<Option<Map<String, Value>>, AppError> {
    let sql = format!(
        "SELECT pg_catalog.to_jsonb(_t) AS row FROM {rel} _t\n      WHERE \"_id\" = $1 AND ( /*predicat_lignes*/ {} )\n        FOR UPDATE",
        row_where(predicate, Some("_t"))
    );
    let p = [P::text(record_id)];
    Ok(exec.first(&sql, &refs(&p)).await?.and_then(|r| match col(&r, 0) {
        Value::Object(m) => Some(m),
        _ => None,
    }))
}

/// `revertIn`.
async fn revert_in<E: Exec + Sync>(exec: &E, ctx: &RequestContext, revision: &Loaded) -> Result<(String, String), AppError> {
    crate::write::refuse_synced(exec, ctx, &revision.table_id).await?;
    let grants = load_grants(exec, ctx).await?;
    let target = load_target(exec, ctx, &revision.table_id).await?;
    let Some(target) = target else { return Err(not_found_revision(&revision.id)) };
    let read = decide(ctx, &grants, Action::Read, &target);
    if read.verdict != Verdict::Allowed {
        return Err(not_found_revision(&revision.id));
    }
    if revision.op != "update" {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("revision")).with("reason", json!("seule_une_modification_s_annule")));
    }
    let update = decide(ctx, &grants, Action::Update, &target);
    if update.verdict != Verdict::Allowed {
        return Err(AppError::new("ADMIN_REQUIRED").with("table", json!(revision.table_id)).with("action", json!("update")));
    }
    let Some(table) = load_history_tables(exec, std::slice::from_ref(&revision.table_id)).await?.remove(&revision.table_id) else {
        return Err(not_found_revision(&revision.id));
    };
    let p = [P::text(&revision.table_id)];
    let ai: HashSet<String> = exec
        .first(
            "SELECT coalesce(array_agg(c.field_id::text), '{}') AS ids\n       FROM _basedb.field_ai_config c\n       JOIN _basedb.field f ON f.id = c.field_id\n      WHERE f.table_id = $1",
            &refs(&p),
        )
        .await?
        .map(|r| col(&r, 0))
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|v| v.as_str().map(str::to_string))
        .collect();
    let field = |id: &str| table.fields.iter().find(|f| f.id == id);
    let changes: Vec<&(String, Value, Value, bool)> = revision
        .fields
        .iter()
        .filter(|f| read.readable_fields.contains(&f.0) && !COMPUTED_KINDS.contains(&field(&f.0).map(|x| x.kind.as_str()).unwrap_or("")))
        .collect();
    for change in &changes {
        let writable = update.writable_fields.contains(&change.0) || ai.contains(&change.0);
        if !field(&change.0).is_some_and(|f| f.is_live) || !writable {
            return Err(AppError::new("FIELD_NOT_WRITABLE").with("field", json!(change.0)));
        }
    }
    if changes.is_empty() {
        return Err(not_found_revision(&revision.id));
    }
    let rel = relation(&table.schema, &table.table)?;
    let Some(current) = current_row(exec, &rel, &read.row_predicate, &revision.record_id).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(revision.record_id)));
    };
    let mut stale = Vec::new();
    let mut values = Map::new();
    for change in &changes {
        let Some(f) = field(&change.0) else { continue };
        if js_stringify(null_if_absent(current.get(&f.column))) != js_stringify(&change.2) {
            stale.push(f.column.clone());
        }
        values.insert(f.column.clone(), change.1.clone());
    }
    if !stale.is_empty() {
        return Err(AppError::new("REVISION_SUPERSEDED").with("fields", json!(stale)));
    }
    let assignments = values.keys().map(|c| Ok(format!("{} = r.{}", qi(c)?, qi(c)?))).collect::<Result<Vec<_>, AppError>>()?.join(", ");
    let sql = format!("UPDATE {rel} AS t SET {assignments}\n       FROM pg_catalog.jsonb_populate_record(NULL::{rel}, $1::jsonb) r\n      WHERE t.\"_id\" = $2");
    let p = [P::text(js_stringify(&Value::Object(values))), P::text(&revision.record_id)];
    exec.query_op(&sql, &refs(&p), SqlOp::Update).await?;
    Ok((revision.table_id.clone(), revision.record_id.clone()))
}

/// `restoreIn`.
async fn restore_in<E: Exec + Sync>(exec: &E, ctx: &RequestContext, revision: &Loaded) -> Result<(String, String), AppError> {
    crate::write::refuse_synced(exec, ctx, &revision.table_id).await?;
    let grants = load_grants(exec, ctx).await?;
    let target = load_target(exec, ctx, &revision.table_id).await?;
    let Some(target) = target.filter(|t| decide(ctx, &grants, Action::Read, t).verdict == Verdict::Allowed) else {
        return Err(not_found_revision(&revision.id));
    };
    if revision.op != "delete" {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("revision")).with("reason", json!("seule_une_suppression_se_restaure")));
    }
    let create = decide(ctx, &grants, Action::Create, &target);
    if create.verdict != Verdict::Allowed {
        return Err(AppError::new("ADMIN_REQUIRED").with("table", json!(revision.table_id)).with("action", json!("create")));
    }
    let Some(table) = load_history_tables(exec, std::slice::from_ref(&revision.table_id)).await?.remove(&revision.table_id).filter(|t| t.is_live) else {
        return Err(not_found_revision(&revision.id));
    };
    let rel = relation(&table.schema, &table.table)?;
    let p = [P::text(&revision.record_id)];
    if exec.first(&format!("SELECT \"_id\"::text AS id FROM {rel} WHERE \"_id\" = $1"), &refs(&p)).await?.is_some() {
        return Err(AppError::new("RESTORE_RECORD_PRESENT").with("record", json!(revision.record_id)));
    }
    let p = [P::text(&revision.table_id), P::text(&revision.record_id)];
    let created = exec
        .first(
            "SELECT occurred_at::text, actor_user_id::text FROM _basedb.record_revision\n      WHERE table_id = $1 AND record_id = $2 AND op = 'insert'\n      ORDER BY occurred_at LIMIT 1",
            &refs(&p),
        )
        .await?;
    let mut values = Map::new();
    values.insert("_id".into(), json!(revision.record_id));
    values.insert("_created_at".into(), created.as_ref().map(|r| col(r, 0)).unwrap_or(Value::Null));
    values.insert("_created_by".into(), created.as_ref().map(|r| col(r, 1)).unwrap_or(Value::Null));
    for (field_id, before, _, has_before) in &revision.fields {
        let Some(f) = table.fields.iter().find(|f| &f.id == field_id) else { continue };
        if !f.is_live || !has_before {
            continue;
        }
        values.insert(f.column.clone(), before.clone());
    }
    let columns: Vec<&String> = values.iter().filter(|(c, v)| !v.is_null() || !c.starts_with("_created")).map(|(c, _)| c).collect();
    let names = columns.iter().map(|c| qi(c)).collect::<Result<Vec<_>, AppError>>()?;
    let sql = format!(
        "INSERT INTO {rel} ({})\n       SELECT {}\n         FROM pg_catalog.jsonb_populate_record(NULL::{rel}, $1::jsonb) r",
        names.join(", "),
        names.iter().map(|n| format!("r.{n}")).collect::<Vec<_>>().join(", ")
    );
    let p = [P::text(js_stringify(&Value::Object(values.clone())))];
    if let Err(e) = exec.query_op(&sql, &refs(&p), SqlOp::Insert).await {
        if e.code == "LINK_TARGET_NOT_FOUND" {
            return Err(AppError::new("RESTORE_TARGET_MISSING").with("record", json!(revision.record_id)));
        }
        return Err(e);
    }
    if create.row_predicate != "TRUE" {
        let sql = format!("SELECT ( /*predicat_lignes*/ {} ) AS holds\n         FROM {rel} AS {} WHERE \"_id\" = $1", create.row_predicate, qi(ROW_ALIAS)?);
        let p = [P::text(&revision.record_id)];
        let holds = exec.first(&sql, &refs(&p)).await?.map(|r| col(&r, 0) == Value::Bool(true)).unwrap_or(false);
        if !holds {
            return Err(AppError::new("ROW_OUT_OF_SCOPE"));
        }
    }
    Ok((revision.table_id.clone(), revision.record_id.clone()))
}

/// `deleteCreatedIn`.
async fn delete_created_in<E: Exec + Sync>(exec: &E, ctx: &RequestContext, revision: &Loaded) -> Result<(), AppError> {
    crate::write::refuse_synced(exec, ctx, &revision.table_id).await?;
    let grants = load_grants(exec, ctx).await?;
    let target = load_target(exec, ctx, &revision.table_id).await?;
    let Some(target) = target.filter(|t| decide(ctx, &grants, Action::Read, t).verdict == Verdict::Allowed) else {
        return Err(not_found_revision(&revision.id));
    };
    let remove = decide(ctx, &grants, Action::Delete, &target);
    if remove.verdict != Verdict::Allowed {
        return Err(AppError::new("ADMIN_REQUIRED").with("table", json!(revision.table_id)).with("action", json!("delete")));
    }
    let Some(table) = load_history_tables(exec, std::slice::from_ref(&revision.table_id)).await?.remove(&revision.table_id).filter(|t| t.is_live) else {
        return Err(not_found_revision(&revision.id));
    };
    let rel = relation(&table.schema, &table.table)?;
    let Some(current) = current_row(exec, &rel, &remove.row_predicate, &revision.record_id).await? else { return Ok(()) };
    let ids: Vec<Value> = table.fields.iter().map(|f| json!(f.id)).collect();
    let ai: HashSet<String> = exec
        .rows("SELECT field_id::text FROM _basedb.field_ai_config WHERE field_id = ANY($1::uuid[])", &refs(&[P::of(&Value::Array(ids))]))
        .await?
        .iter()
        .filter_map(|r| s(r, 0))
        .collect();
    let created: HashMap<&str, &Value> = revision.fields.iter().map(|f| (f.0.as_str(), &f.2)).collect();
    let stale: Vec<&String> = table
        .fields
        .iter()
        .filter(|f| f.is_live && !ai.contains(&f.id))
        .filter(|f| js_stringify(null_if_absent(current.get(&f.column))) != js_stringify(created.get(f.id.as_str()).copied().unwrap_or(&Value::Null)))
        .map(|f| &f.column)
        .collect();
    if !stale.is_empty() {
        return Err(AppError::new("REVISION_SUPERSEDED").with("fields", json!(stale)));
    }
    let p = [P::text(&revision.record_id)];
    exec.query_op(&format!("DELETE FROM {rel} WHERE \"_id\" = $1"), &refs(&p), SqlOp::Delete).await?;
    Ok(())
}

/// `revertRevision`.
pub async fn revert_revision(pools: &Pools, ctx: &RequestContext, revision_id: &str) -> Result<(String, String), AppError> {
    let _ = drain_history(pools).await;
    with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let Some(revision) = load_revision(&tx, revision_id).await? else { return Err(not_found_revision(revision_id)) };
        revert_in(&tx, ctx, &revision).await
    })
    .await
}

/// `restoreRecord`.
pub async fn restore_record(pools: &Pools, ctx: &RequestContext, revision_id: &str) -> Result<(String, String), AppError> {
    let _ = drain_history(pools).await;
    with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let Some(revision) = load_revision(&tx, revision_id).await? else { return Err(not_found_revision(revision_id)) };
        restore_in(&tx, ctx, &revision).await
    })
    .await
}

/// `restoreDeletedRecord`: a row back by its own identifier — its last deletion.
pub async fn restore_deleted_record(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str) -> Result<(String, String), AppError> {
    let _ = drain_history(pools).await;
    with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let p = [P::text(table_id), P::text(record_id)];
        let last = tx
            .first("SELECT id::text FROM _basedb.record_revision\n        WHERE table_id = $1 AND record_id = $2 AND op = 'delete'\n        ORDER BY occurred_at DESC LIMIT 1", &refs(&p))
            .await?;
        let revision = match last.and_then(|r| s(&r, 0)) {
            Some(id) => load_revision(&tx, &id).await?,
            None => None,
        };
        let Some(revision) = revision else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record_id))) };
        restore_in(&tx, ctx, &revision).await
    })
    .await
}

async fn revisions_of(pools: &Pools, ctx: &RequestContext, transaction: &str) -> Result<(Vec<String>, bool), AppError> {
    let conn = pools.get(PoolName::Catalog).await?;
    let p = [P::text(transaction), P::text(&ctx.actor.id), P::text(UNDO_WINDOW_HOURS.to_string()), P::text((UNDO_MAX_REVISIONS + 1).to_string())];
    let ids = conn
        .rows(
            "SELECT id::text FROM _basedb.record_revision
        WHERE xact_id = $1::xid8 AND actor_user_id = $2
          AND occurred_at > pg_catalog.clock_timestamp() - make_interval(hours => $3)
        ORDER BY occurred_at, id
        LIMIT $4",
            &refs(&p),
        )
        .await?
        .iter()
        .filter_map(|r| s(r, 0))
        .collect();
    let p = [P::text(transaction)];
    let pending = conn
        .first("SELECT count(*)::int AS n FROM _basedb_local.revision_buffer\n        WHERE xact_id = $1::xid8 AND drained_at IS NULL", &refs(&p))
        .await?
        .map(|r| r.get::<_, i32>(0) > 0)
        .unwrap_or(false);
    Ok((ids, pending))
}

/// `undoTransaction`: `(transaction, revisions, tables)`.
pub async fn undo_transaction(pools: &Pools, ctx: &RequestContext, transaction: &str) -> Result<(String, usize, Vec<String>), AppError> {
    let valid = !transaction.is_empty() && transaction.len() <= 20 && transaction.bytes().all(|b| b.is_ascii_digit());
    if !valid {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("transaction", json!(transaction)));
    }
    let mut found = (Vec::new(), false);
    for _ in 0..8 {
        let _ = drain_history(pools).await;
        found = revisions_of(pools, ctx, transaction).await?;
        if !found.1 {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    }
    let ids = found.0;
    if ids.is_empty() {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("transaction", json!(transaction)));
    }
    if ids.len() > UNDO_MAX_REVISIONS {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("transaction")).with("reason", json!("trop_de_revisions")).with("maximum", json!(UNDO_MAX_REVISIONS)));
    }
    let ids = &ids;
    with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let mut revisions = Vec::new();
        for id in ids {
            if let Some(r) = load_revision(&tx, id).await? {
                revisions.push(r);
            }
        }
        for r in revisions.iter().filter(|r| r.op == "delete") {
            restore_in(&tx, ctx, r).await?;
        }
        for r in revisions.iter().filter(|r| r.op == "update").rev() {
            revert_in(&tx, ctx, r).await?;
        }
        for r in revisions.iter().filter(|r| r.op == "insert").rev() {
            delete_created_in(&tx, ctx, r).await?;
        }
        let mut tables: Vec<String> = Vec::new();
        for r in &revisions {
            if !tables.contains(&r.table_id) {
                tables.push(r.table_id.clone());
            }
        }
        Ok((crate::write::current_xact(&tx).await?, revisions.len(), tables))
    })
    .await
}

/// `String(body.transaction ?? '')`.
pub fn transaction_of(body: &Value) -> String {
    match body.get("transaction") {
        None | Some(Value::Null) => String::new(),
        Some(v) => js_string(v),
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_read_as_v8_reads_them() {
        assert!(js_date_parses("2020-01-01"));
        assert!(js_date_parses("2020-01-01T10:00:00.000Z"));
        assert!(js_date_parses("2020-01-01 10:00"));
        assert!(js_date_parses("hello 2020"));
        assert!(js_date_parses("1"));
        assert!(js_date_parses("32"));
        assert!(js_date_parses("2020 5"));
        assert!(!js_date_parses("13"));
        assert!(!js_date_parses("5 2020"));
        assert!(!js_date_parses("hello 13"));
        assert!(js_date_parses("Nov 19 2026"));
        assert!(!js_date_parses("2020-13-45"));
        assert!(!js_date_parses("pas-une-date"));
        assert!(!js_date_parses(""));
        assert_eq!(pg_instant_iso("2026-11-19 14:43:02.395999+01"), "2026-11-19T13:43:02.395Z");
        assert_eq!(pg_instant_iso("2026-11-19 14:43:02+00"), "2026-11-19T14:43:02.000Z");
    }

    #[test]
    fn cursors_round_trip_and_refuse_junk() {
        let c = encode_cursor("2026-11-19 14:43:02.395+00", "01a1f442-d27b-7345-8637-ff769fcc77d8");
        assert_eq!(decode_cursor(Some(&c)).unwrap().unwrap().1, "01a1f442-d27b-7345-8637-ff769fcc77d8");
        assert_eq!(decode_cursor(Some("zz")).unwrap_err().code, "CURSOR_INVALID");
        assert!(decode_cursor(Some("")).unwrap().is_none());
    }

    #[test]
    fn limits_are_javascript_numbers() {
        assert_eq!(limit_of(None), 50.0);
        assert_eq!(limit_of(Some(1000.0)), 200.0);
        assert_eq!(limit_of(Some(0.5)), 1.0);
        assert!(limit_of(Some(f64::NAN)).is_nan());
        assert_eq!(limit_param(f64::NAN).0.as_deref(), Some("NaN"));
        assert_eq!(transaction_of(&json!({ "transaction": 42 })), "42");
        assert_eq!(transaction_of(&json!({})), "");
    }
}
