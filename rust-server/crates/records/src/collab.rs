//! Comments, presence and the live signals — `collab/comments.ts`, `collab/presence.ts`,
//! `collab/signals.ts`, and the live hub of the kernel (`kernel.live`): one listening
//! connection on `basedb_live`, every signal handed to every open stream.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::{load_grants, load_target};
use basedb_base::rbac::require::require_on_table;
use basedb_base::rbac::rows::ROW_ALIAS;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_catalog::js::{js_collapse_spaces, js_length, js_slice};
use basedb_catalog::naming::{qualify, quote_identifier};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::sync::{Arc, LazyLock, OnceLock};
use tokio::sync::broadcast;

use crate::drain::{context_of, load_history_tables, wants_notification};
use crate::js::{is_uuid_ci, js_trim};
use crate::notifications::{emit_live, LIVE_CHANNEL};
use crate::pg::{col, refs, P};

pub const COMMENT_MAX_LENGTH: usize = 10_000;
pub const MENTIONS_MAX: usize = 20;
pub const PRESENCE_FRESH_SECONDS: i64 = 60;

static MENTION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)@\[([^\]\n]{1,100})\]\(user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)").unwrap()
});

/// `mentionsIn`: the people a text mentions, each once, in their order.
pub fn mentions_in(body: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for m in MENTION.captures_iter(body) {
        let id = m[2].to_lowercase();
        if !out.contains(&id) {
            out.push(id);
        }
    }
    out
}

/// `excerptOf`: a mention by its name, 200 UTF-16 units at most.
pub fn excerpt_of(body: &str) -> String {
    let named = MENTION.replace_all(body, |c: &regex::Captures| format!("@{}", &c[1]));
    let collapsed = js_collapse_spaces(&named);
    let plain = js_trim(&collapsed);
    if js_length(plain) <= 200 {
        plain.to_string()
    } else {
        format!("{}…", js_slice(plain, 199))
    }
}

/// `checkedBody`.
fn checked_body(body: Option<&Value>) -> Result<String, AppError> {
    let text = match body {
        Some(Value::String(s)) => js_trim(s).to_string(),
        _ => String::new(),
    };
    if text.is_empty() {
        return Err(AppError::new("REQUIRED_VALUE_MISSING").with("field", json!("body")));
    }
    if js_length(&text) > COMMENT_MAX_LENGTH {
        return Err(AppError::new("TEXT_TOO_LONG").with("field", json!("body")).with("maximum", json!(COMMENT_MAX_LENGTH)));
    }
    if mentions_in(&text).len() > MENTIONS_MAX {
        return Err(AppError::new("REQUEST_INVALID")
            .with("field", json!("body"))
            .with("reason", json!("trop_de_mentions"))
            .with("maximum", json!(MENTIONS_MAX)));
    }
    Ok(text)
}

#[derive(Clone)]
struct Located {
    relation: String,
    base_id: String,
    tenant_uuid: String,
    rows: String,
}

fn row_alias() -> String {
    quote_identifier(ROW_ALIAS).unwrap_or_else(|_| format!("\"{ROW_ALIAS}\""))
}

/// `locate`: the table's relation and owners, once reading it is established.
async fn locate<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<Located, AppError> {
    let grants = require_on_table(exec, ctx, Action::Read, table_id).await?;
    let target = load_target(exec, ctx, table_id).await?;
    let rows = match &target {
        None => "FALSE".to_string(),
        Some(t) => decide(ctx, &grants, Action::Read, t).row_predicate,
    };
    let tables = load_history_tables(exec, &[table_id.to_string()]).await?;
    let owner = exec
        .first(
            "SELECT b.id::text AS base_id, b.tenant_id::text
       FROM _basedb.table_def t JOIN _basedb.base b ON b.id = t.base_id
      WHERE t.id = $1",
            &refs(&[P::text(table_id)]),
        )
        .await?;
    let (Some(table), Some(owner)) = (tables.get(table_id), owner) else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
    };
    Ok(Located {
        relation: qualify(&table.schema, &table.table)?,
        base_id: owner.get(0),
        tenant_uuid: owner.get(1),
        rows,
    })
}

fn read_only() -> TxOptions {
    TxOptions { read_only: true, ..TxOptions::default() }
}

/// `requireRow`: a comment of a row one cannot read, or of a deleted row, does not exist.
async fn require_row(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str) -> Result<Located, AppError> {
    if !is_uuid_ci(record_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record_id)));
    }
    let located = with_transaction(pools, PoolName::Catalog, ctx, read_only(), |tx| async move { locate(&tx, ctx, table_id).await }).await?;
    let sql = format!(
        "SELECT 1 FROM {} AS {}
          WHERE \"_id\" = $1 AND ( /*predicat_lignes*/ {} )",
        located.relation,
        row_alias(),
        located.rows
    );
    let found = with_transaction(pools, PoolName::Data, ctx, read_only(), |tx| {
        let sql = sql.clone();
        async move { Ok(!tx.rows(&sql, &refs(&[P::text(record_id)])).await?.is_empty()) }
    })
    .await?;
    if !found {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record_id)));
    }
    Ok(located)
}

const COMMENT_COLUMNS: &str = "c.id::text, c.record_id::text, c.author_id::text,
       coalesce(nullif(u.display_name, ''), u.email) AS author_name, c.body,
       c.mentions::text[] AS mentions, c.created_at::text, c.edited_at::text";

/// `shaped` then `serializeComment`: the comment as the routes answer it.
fn shaped(row: &tokio_postgres::Row, ctx: &RequestContext, manages: bool) -> Value {
    let author = col(row, 2);
    let mine = author.as_str() == Some(ctx.actor.id.as_str());
    json!({
        "id": col(row, 0),
        "record_id": col(row, 1),
        "author": { "id": author, "name": col(row, 3) },
        "body": col(row, 4),
        "mentions": col(row, 5),
        "created_at": col(row, 6),
        "edited_at": col(row, 7),
        "can_edit": mine,
        "can_delete": mine || manages,
    })
}

async fn manages_table<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<bool, AppError> {
    let Some(target) = load_target(exec, ctx, table_id).await? else { return Ok(false) };
    Ok(decide(ctx, &load_grants(exec, ctx).await?, Action::ManageSchema, &target).verdict == Verdict::Allowed)
}

/// `listComments`: the comments of a row, oldest first.
pub async fn list_comments(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str) -> Result<Vec<Value>, AppError> {
    require_row(pools, ctx, table_id, record_id).await?;
    with_transaction(pools, PoolName::Catalog, ctx, read_only(), |tx| async move {
        let manages = manages_table(&tx, ctx, table_id).await?;
        let rows = tx
            .rows(
                &format!(
                    "SELECT {COMMENT_COLUMNS}
           FROM _basedb.record_comment c JOIN _basedb.app_user u ON u.id = c.author_id
          WHERE c.table_id = $1 AND c.record_id = $2
          ORDER BY c.created_at, c.id
          LIMIT 1000"
                ),
                &refs(&[P::text(table_id), P::text(record_id)]),
            )
            .await?;
        Ok(rows.iter().map(|r| shaped(r, ctx, manages)).collect())
    })
    .await
}

/// `checkMentions`: the mentioned people must be active members of the tenant.
async fn check_mentions<E: Exec + Sync>(exec: &E, ctx: &RequestContext, ids: &[String]) -> Result<(), AppError> {
    if ids.is_empty() {
        return Ok(());
    }
    let found = exec
        .rows(
            "SELECT u.id::text FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
      WHERE t.ref = $1 AND u.id = ANY($2::uuid[])
        AND u.deleted_at IS NULL AND u.disabled_at IS NULL",
            &refs(&[P::text(&ctx.tenant_id), P::of(&json!(ids))]),
        )
        .await?;
    let known: HashSet<String> = found.iter().map(|r| r.get::<_, String>(0)).collect();
    if let Some(unknown) = ids.iter().find(|id| !known.contains(*id)) {
        return Err(AppError::new("REQUEST_INVALID")
            .with("field", json!("body"))
            .with("reason", json!("mention_inconnue"))
            .with("detail", json!(unknown)));
    }
    Ok(())
}

/// `rowReaders`: among some people, those who read ONE row.
async fn row_readers(pools: &Pools, ctx: &RequestContext, located: &Located, table_id: &str, record_id: &str, users: &[String]) -> Result<HashSet<String>, AppError> {
    let mut readers = HashSet::new();
    if users.is_empty() {
        return Ok(readers);
    }
    let predicates: Vec<(String, String)> = with_transaction(pools, PoolName::Catalog, ctx, read_only(), |tx| async move {
        let mut out = Vec::new();
        for user in users {
            let reader = context_of(&ctx.tenant_id, user, &ctx.request_id);
            let Some(target) = load_target(&tx, &reader, table_id).await? else { continue };
            // A disabled account reads nothing.
            let Ok(grants) = load_grants(&tx, &reader).await else { continue };
            let decision = decide(&reader, &grants, Action::Read, &target);
            if decision.verdict == Verdict::Allowed {
                out.push((user.clone(), decision.row_predicate));
            }
        }
        Ok(out)
    })
    .await?;
    if predicates.is_empty() {
        return Ok(readers);
    }
    let mut columns = Vec::new();
    for (i, (_, rows)) in predicates.iter().enumerate() {
        columns.push(format!("( /*predicat_lignes*/ {rows} ) AS {}", quote_identifier(&format!("r{i}"))?));
    }
    let sql = format!(
        "SELECT {}
           FROM {} AS {}
          WHERE \"_id\" = $1",
        columns.join(", "),
        located.relation,
        row_alias()
    );
    let row = with_transaction(pools, PoolName::Data, ctx, read_only(), |tx| {
        let sql = sql.clone();
        async move { tx.first(&sql, &refs(&[P::text(record_id)])).await }
    })
    .await?;
    if let Some(row) = row {
        for (i, (user, _)) in predicates.iter().enumerate() {
            if col(&row, i) == Value::Bool(true) {
                readers.insert(user.clone());
            }
        }
    }
    Ok(readers)
}

/// `notify`: mentions first, then the earlier authors — each once, never the author, never
/// someone who cannot read the row. Returns the mentioned people left out for that.
#[allow(clippy::too_many_arguments)]
async fn notify<E: Exec + Sync>(
    exec: &E,
    ctx: &RequestContext,
    located: &Located,
    table_id: &str,
    record_id: &str,
    comment: (&str, &str),
    mentioned: &[String],
    reply_to: &[String],
    readers: &HashSet<String>,
) -> Result<Vec<String>, AppError> {
    let mut notices: Vec<(&str, &str)> = Vec::new();
    let mut unreachable = Vec::new();
    let mut seen: HashSet<&str> = HashSet::from([ctx.actor.id.as_str()]);
    let candidates = mentioned.iter().map(|u| (u.as_str(), "mention")).chain(reply_to.iter().map(|u| (u.as_str(), "reply")));
    for (user, kind) in candidates {
        if !seen.insert(user) {
            continue;
        }
        if readers.contains(user) {
            notices.push((user, kind));
        } else if kind == "mention" {
            unreachable.push(user.to_string());
        }
    }
    let excerpt = excerpt_of(comment.1);
    for (user, kind) in notices {
        if !wants_notification(exec, user, kind).await? {
            continue;
        }
        exec.execute_op(
            "INSERT INTO _basedb.notification
         (tenant_id, user_id, kind, actor_id, base_id, table_id, record_id, comment_id, excerpt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            &refs(&[
                P::text(&located.tenant_uuid),
                P::text(user),
                P::text(kind),
                P::text(&ctx.actor.id),
                P::text(&located.base_id),
                P::text(table_id),
                P::text(record_id),
                P::text(comment.0),
                P::text(&excerpt),
            ]),
            SqlOp::Insert,
        )
        .await?;
        emit_live(exec, &json!({ "kind": "notifications", "user": user })).await?;
    }
    Ok(unreachable)
}

async fn comment_row<E: Exec + Sync>(exec: &E, id: &str) -> Result<tokio_postgres::Row, AppError> {
    exec.first(
        &format!(
            "SELECT {COMMENT_COLUMNS}
         FROM _basedb.record_comment c JOIN _basedb.app_user u ON u.id = c.author_id
        WHERE c.id = $1"
        ),
        &refs(&[P::text(id)]),
    )
    .await?
    .ok_or_else(|| AppError::internal("Cannot read properties of undefined (reading 'author_id')"))
}

/// `addComment`: the comment, and the mentioned people who cannot read the row.
pub async fn add_comment(pools: &Pools, ctx: &RequestContext, table_id: &str, record_id: &str, body: Option<&Value>) -> Result<(Value, Vec<String>), AppError> {
    let body = checked_body(body)?;
    let mentioned = mentions_in(&body);
    let located = require_row(pools, ctx, table_id, record_id).await?;
    let earlier: Vec<String> = with_transaction(pools, PoolName::Catalog, ctx, read_only(), |tx| async move {
        let rows = tx
            .rows(
                "SELECT author_id::text FROM _basedb.record_comment
          WHERE table_id = $1 AND record_id = $2
          GROUP BY author_id ORDER BY min(created_at)",
                &refs(&[P::text(table_id), P::text(record_id)]),
            )
            .await?;
        Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
    })
    .await?;
    let mut concerned: Vec<String> = Vec::new();
    for user in mentioned.iter().chain(earlier.iter()) {
        if !concerned.contains(user) {
            concerned.push(user.clone());
        }
    }
    let readers = row_readers(pools, ctx, &located, table_id, record_id, &concerned).await?;
    let (located, body, mentioned, earlier, readers) = (&located, &body, &mentioned, &earlier, &readers);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        check_mentions(&tx, ctx, mentioned).await?;
        let inserted = tx
            .query_op(
                "INSERT INTO _basedb.record_comment
         (tenant_id, base_id, table_id, record_id, author_id, body, mentions)
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[])
       RETURNING id::text",
                &refs(&[
                    P::text(&located.tenant_uuid),
                    P::text(&located.base_id),
                    P::text(table_id),
                    P::text(record_id),
                    P::text(&ctx.actor.id),
                    P::text(body),
                    P::of(&json!(mentioned)),
                ]),
                SqlOp::Insert,
            )
            .await?;
        let id: String = inserted.first().map(|r| r.get(0)).unwrap_or_default();
        let unreachable = notify(&tx, ctx, located, table_id, record_id, (&id, body), mentioned, earlier, readers).await?;
        emit_live(&tx, &json!({ "kind": "comments", "base": located.base_id, "table": table_id, "record": record_id })).await?;
        let row = comment_row(&tx, &id).await?;
        let manages = manages_table(&tx, ctx, table_id).await?;
        Ok((shaped(&row, ctx, manages), unreachable))
    })
    .await
}

struct Found {
    table_id: String,
    record_id: String,
    author_id: String,
    mentions: Vec<String>,
}

/// `loadComment`: the comment, in the caller's tenant; absent and foreign read the same.
async fn load_comment(pools: &Pools, ctx: &RequestContext, comment_id: &str) -> Result<Found, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, read_only(), |tx| async move {
        let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("comment", json!(comment_id));
        if !is_uuid_ci(comment_id) {
            return Err(not_found());
        }
        let row = tx
            .first(
                "SELECT c.table_id::text, c.record_id::text, c.author_id::text, c.mentions::text[] AS mentions
       FROM _basedb.record_comment c JOIN _basedb.tenant t ON t.id = c.tenant_id
      WHERE c.id = $1 AND t.ref = $2",
                &refs(&[P::text(comment_id), P::text(&ctx.tenant_id)]),
            )
            .await?
            .ok_or_else(not_found)?;
        let mentions = match col(&row, 3) {
            Value::Array(items) => items.into_iter().filter_map(|v| v.as_str().map(str::to_string)).collect(),
            _ => Vec::new(),
        };
        Ok(Found { table_id: row.get(0), record_id: row.get(1), author_id: row.get(2), mentions })
    })
    .await
}

fn author_only(comment_id: &str) -> AppError {
    AppError::new("ACTION_FORBIDDEN").with("comment", json!(comment_id)).with("reason", json!("auteur_seul"))
}

/// `editComment`: its author's alone; new mentions are notified.
pub async fn edit_comment(pools: &Pools, ctx: &RequestContext, comment_id: &str, body: Option<&Value>) -> Result<Value, AppError> {
    let body = checked_body(body)?;
    let mentioned = mentions_in(&body);
    let found = load_comment(pools, ctx, comment_id).await?;
    let located = require_row(pools, ctx, &found.table_id, &found.record_id).await?;
    if found.author_id != ctx.actor.id {
        return Err(author_only(comment_id));
    }
    let added: Vec<String> = mentioned.iter().filter(|id| !found.mentions.contains(id)).cloned().collect();
    let readers = row_readers(pools, ctx, &located, &found.table_id, &found.record_id, &added).await?;
    let (located, body, mentioned, added, readers, found) = (&located, &body, &mentioned, &added, &readers, &found);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        check_mentions(&tx, ctx, mentioned).await?;
        tx.execute_op(
            "UPDATE _basedb.record_comment
          SET body = $2, mentions = $3::uuid[], edited_at = pg_catalog.clock_timestamp()
        WHERE id = $1",
            &refs(&[P::text(comment_id), P::text(body), P::of(&json!(mentioned))]),
            SqlOp::Update,
        )
        .await?;
        notify(&tx, ctx, located, &found.table_id, &found.record_id, (comment_id, body), added, &[], readers).await?;
        emit_live(&tx, &json!({ "kind": "comments", "base": located.base_id, "table": found.table_id, "record": found.record_id })).await?;
        let row = comment_row(&tx, comment_id).await?;
        Ok(shaped(&row, ctx, manages_table(&tx, ctx, &found.table_id).await?))
    })
    .await
}

/// `deleteComment`: its author, or whoever builds the base.
pub async fn delete_comment(pools: &Pools, ctx: &RequestContext, comment_id: &str) -> Result<(), AppError> {
    let found = load_comment(pools, ctx, comment_id).await?;
    let located = require_row(pools, ctx, &found.table_id, &found.record_id).await?;
    let (found, located) = (&found, &located);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        if found.author_id != ctx.actor.id && !manages_table(&tx, ctx, &found.table_id).await? {
            return Err(author_only(comment_id));
        }
        tx.execute_op("DELETE FROM _basedb.record_comment WHERE id = $1", &refs(&[P::text(comment_id)]), SqlOp::Delete).await?;
        emit_live(&tx, &json!({ "kind": "comments", "base": located.base_id, "table": found.table_id, "record": found.record_id })).await?;
        Ok(())
    })
    .await
}

// ── Presence (`collab/presence.ts`) ──────────────────────────────────────────────

fn session_invalid() -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("session")).with("reason", json!("format"))
}

/// `enterPresence`: places a stream's session on a table — and a row of it.
pub async fn enter_presence(pools: &Pools, ctx: &RequestContext, session: &str, table_id: &str, record_id: Option<&str>) -> Result<(), AppError> {
    if !is_uuid_ci(session) {
        return Err(session_invalid());
    }
    let record = record_id.filter(|r| is_uuid_ci(r)).map(P::text).unwrap_or(P(None));
    let record = &record;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::Read, table_id).await?;
        let previous = tx
            .first(
                "SELECT table_id::text, user_id::text FROM _basedb.presence WHERE session_id = $1",
                &refs(&[P::text(session)]),
            )
            .await?;
        let previous: Option<(String, String)> = previous.map(|r| (r.get(0), r.get(1)));
        // A session is its owner's: another's identifier moves nothing.
        if let Some((_, user)) = &previous {
            if *user != ctx.actor.id {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("session", json!(session)));
            }
        }
        tx.execute_op(
            "INSERT INTO _basedb.presence (session_id, tenant_id, user_id, base_id, table_id, record_id)
       SELECT $1, b.tenant_id, $2, b.id, t.id, $4
         FROM _basedb.table_def t JOIN _basedb.base b ON b.id = t.base_id
        WHERE t.id = $3
       ON CONFLICT (session_id) DO UPDATE
          SET base_id = EXCLUDED.base_id, table_id = EXCLUDED.table_id,
              record_id = EXCLUDED.record_id, seen_at = pg_catalog.clock_timestamp()",
            &refs(&[P::text(session), P::text(&ctx.actor.id), P::text(table_id), record.clone()]),
            SqlOp::Insert,
        )
        .await?;
        if let Some((table, _)) = &previous {
            if table != table_id {
                emit_live(&tx, &json!({ "kind": "presence", "table": table })).await?;
            }
        }
        emit_live(&tx, &json!({ "kind": "presence", "table": table_id })).await?;
        Ok(())
    })
    .await
}

fn is_number(v: Option<&Value>) -> Option<f64> {
    v.and_then(Value::as_f64)
}

/// `pointerAt`: a pointer's place as the browser sent it, or `null` when it makes no sense.
pub fn pointer_at(raw: Option<&Value>) -> Value {
    static FIELD: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^_?[a-z][a-z0-9_]{0,62}$").unwrap());
    let Some(Value::Object(m)) = raw else { return Value::Null };
    let Some(record) = m.get("record").and_then(Value::as_str).filter(|r| is_uuid_ci(r)) else { return Value::Null };
    let Some(field) = m.get("field").and_then(Value::as_str).filter(|f| FIELD.is_match(f)) else { return Value::Null };
    let (Some(x), Some(y)) = (is_number(m.get("x")), is_number(m.get("y"))) else { return Value::Null };
    let unit = |v: f64| crate::js::number_json(js_round(v.clamp(0.0, 1.0) * 1000.0) / 1000.0);
    json!({ "record": record, "field": field, "x": unit(x), "y": unit(y) })
}

/// `Math.round`: halves toward +∞.
fn js_round(f: f64) -> f64 {
    (f + 0.5).floor()
}

/// `movePointer`: a signal to those who look at the same table; nothing written.
pub async fn move_pointer(pools: &Pools, ctx: &RequestContext, session: &str, table_id: &str, at: Option<&Value>) -> Result<(), AppError> {
    if !is_uuid_ci(session) {
        return Err(session_invalid());
    }
    let at = pointer_at(at);
    let conn = pools.catalog().await?;
    let owner = conn
        .first(
            "SELECT nullif(u.display_name, '') AS name
         FROM _basedb.presence p JOIN _basedb.app_user u ON u.id = p.user_id
        WHERE p.session_id = $1 AND p.user_id = $2 AND p.table_id = $3",
            &refs(&[P::text(session), P::text(&ctx.actor.id), P::text(table_id)]),
        )
        .await?
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("session", json!(session)))?;
    let name = col(&owner, 0).as_str().unwrap_or("Utilisateur").to_string();
    emit_live(
        &conn,
        &json!({ "kind": "pointer", "table": table_id, "session": session, "user": ctx.actor.id, "name": name, "at": at }),
    )
    .await
}

/// `refreshPresence`.
pub async fn refresh_presence(pools: &Pools, sessions: &[String]) -> Result<(), AppError> {
    if sessions.is_empty() {
        return Ok(());
    }
    let conn = pools.catalog().await?;
    conn.execute_op(
        "UPDATE _basedb.presence SET seen_at = pg_catalog.clock_timestamp()
        WHERE session_id = ANY($1::uuid[])",
        &refs(&[P::of(&json!(sessions))]),
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

/// `leavePresence`: the session leaves, and those who watched the table are told.
pub async fn leave_presence(pools: &Pools, session: &str) -> Result<(), AppError> {
    if !is_uuid_ci(session) {
        return Ok(());
    }
    let conn = pools.catalog().await?;
    let gone = conn
        .query_op("DELETE FROM _basedb.presence WHERE session_id = $1 RETURNING table_id::text", &refs(&[P::text(session)]), SqlOp::Delete)
        .await?;
    if let Some(row) = gone.first() {
        let table: String = row.get(0);
        emit_live(&conn, &json!({ "kind": "presence", "table": table })).await?;
    }
    Ok(())
}

/// `viewersOf`: each person once, with the row they opened last.
pub async fn viewers_of(pools: &Pools, table_id: &str) -> Result<Vec<Value>, AppError> {
    let conn = pools.catalog().await?;
    let rows = conn
        .rows(
            "SELECT DISTINCT ON (p.user_id) p.user_id::text, nullif(u.display_name, '') AS name,
              p.record_id::text
         FROM _basedb.presence p JOIN _basedb.app_user u ON u.id = p.user_id
        WHERE p.table_id = $1
          AND p.seen_at > pg_catalog.clock_timestamp() - make_interval(secs => $2)
        ORDER BY p.user_id, (p.record_id IS NULL), p.seen_at DESC",
            &refs(&[P::text(table_id), P::text(PRESENCE_FRESH_SECONDS.to_string())]),
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let name = col(r, 1);
            json!({ "user": col(r, 0), "name": if name.is_null() { json!("Utilisateur") } else { name }, "record": col(r, 2) })
        })
        .collect())
}

/// `readableFieldNames`: the columns a person reads in a table, by physical name.
pub async fn readable_field_names(pools: &Pools, ctx: &RequestContext, table_id: &str) -> Result<HashSet<String>, AppError> {
    let conn = pools.catalog().await?;
    let Some(target) = load_target(&conn, ctx, table_id).await? else { return Ok(HashSet::new()) };
    let decision = decide(ctx, &load_grants(&conn, ctx).await?, Action::Read, &target);
    if decision.verdict != Verdict::Allowed {
        return Ok(HashSet::new());
    }
    let fields = conn
        .rows(
            "SELECT f.id::text, n.name
       FROM _basedb.field f
       JOIN _basedb.physical_name n ON n.id = f.name_id
      WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL",
            &refs(&[P::text(table_id)]),
        )
        .await?;
    Ok(fields
        .iter()
        .filter(|r| decision.readable_fields.contains(&r.get::<_, String>(0)))
        .map(|r| r.get::<_, String>(1))
        .collect())
}

// ── The live hub (`kernel.live`) ─────────────────────────────────────────────────

pub struct LiveHub {
    listener: basedb_base::listener::Listener,
    signals: broadcast::Sender<Arc<Map<String, Value>>>,
}

static HUB: OnceLock<LiveHub> = OnceLock::new();

/// `parseLive`: a signal off the channel; anything else — a foreign payload — is ignored.
pub fn parse_live(payload: &str) -> Option<Map<String, Value>> {
    match serde_json::from_str::<Value>(payload) {
        Ok(Value::Object(m)) if m.get("kind").is_some_and(Value::is_string) => Some(m),
        _ => None,
    }
}

impl LiveHub {
    fn get(database_url: &str) -> &'static LiveHub {
        HUB.get_or_init(|| {
            let listener = basedb_base::listener::Listener::new(database_url, &[LIVE_CHANNEL]);
            let (signals, _) = broadcast::channel(4096);
            let sender = signals.clone();
            listener.on(LIVE_CHANNEL, move |payload| {
                if let Some(signal) = parse_live(payload) {
                    let _ = sender.send(Arc::new(signal));
                }
            });
            LiveHub { listener, signals }
        })
    }

    /// `live.start()`, then `live.subscribe`: listening once the connection is up — waited
    /// for a few seconds, as Node awaits its first connection attempt.
    pub async fn subscribe(database_url: &str) -> broadcast::Receiver<Arc<Map<String, Value>>> {
        let hub = LiveHub::get(database_url);
        let receiver = hub.signals.subscribe();
        hub.listener.start();
        for _ in 0..100 {
            if hub.listener.ready() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        receiver
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mentions_are_read_in_the_text_once_each() {
        let a = "0190a1f4-0000-7000-8000-00000000000A";
        let body = format!("@[Ana](user:{a}) et @[Ana bis](USER:{}) puis @[]({a})", a.to_lowercase());
        assert_eq!(mentions_in(&body), vec![a.to_lowercase()]);
        assert_eq!(excerpt_of(&format!("  Bonjour\n\n @[Ana](user:{a})  ")), "Bonjour @Ana");
        let long = "é".repeat(250);
        let e = excerpt_of(&long);
        assert_eq!(js_length(&e), 200);
        assert!(e.ends_with('…'));
    }

    #[test]
    fn a_body_is_checked_as_node_does() {
        assert_eq!(checked_body(Some(&json!("  x "))).unwrap(), "x");
        assert_eq!(checked_body(Some(&json!(5))).unwrap_err().code, "REQUIRED_VALUE_MISSING");
        assert_eq!(checked_body(Some(&json!("\u{feff} "))).unwrap_err().code, "REQUIRED_VALUE_MISSING");
        assert_eq!(checked_body(Some(&json!("a".repeat(10_001)))).unwrap_err().code, "TEXT_TOO_LONG");
        let many: String = (0..21).map(|i| format!("@[n](user:00000000-0000-4000-8000-{i:012}) ")).collect();
        assert_eq!(checked_body(Some(&json!(many))).unwrap_err().code, "REQUEST_INVALID");
    }

    #[test]
    fn a_pointer_is_kept_only_when_it_makes_sense() {
        let r = "00000000-0000-4000-8000-000000000001";
        assert_eq!(pointer_at(Some(&json!({ "record": r, "field": "nom", "x": 1.5, "y": 0.12345 }))), json!({ "record": r, "field": "nom", "x": 1, "y": 0.123 }));
        assert_eq!(pointer_at(Some(&json!({ "record": r, "field": "Nom", "x": 0, "y": 0 }))), Value::Null);
        assert_eq!(pointer_at(Some(&json!({ "record": r, "field": "nom", "x": "0", "y": 0 }))), Value::Null);
        assert_eq!(pointer_at(Some(&json!([]))), Value::Null);
        assert_eq!(pointer_at(Some(&json!({ "record": r, "field": "nom", "x": -0.0005, "y": 0.0005 }))), json!({ "record": r, "field": "nom", "x": 0, "y": 0.001 }));
    }
}
