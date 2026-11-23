//! The caller's notifications — `collab/notifications.ts`: `GET /me/notifications`,
//! `POST /me/notifications/read`.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::{load_grants, load_target};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::pg::P;

pub const LIVE_CHANNEL: &str = "basedb_live";

/// `emitLive`: a signal on the live channel, dropped when the queue is half full.
pub async fn emit_live<E: Exec + Sync>(exec: &E, signal: &Value) -> Result<(), AppError> {
    exec.rows(
        "SELECT pg_catalog.pg_notify($1, $2)
      WHERE pg_catalog.pg_notification_queue_usage() < 0.5",
        &[&LIVE_CHANNEL, &basedb_base::idempotency::js_stringify(signal)],
    )
    .await?;
    Ok(())
}

/// `canReadTable`.
pub async fn can_read_table<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str) -> Result<bool, AppError> {
    let Some(target) = load_target(exec, ctx, table_id).await? else { return Ok(false) };
    let grants = load_grants(exec, ctx).await?;
    Ok(decide(ctx, &grants, Action::Read, &target).verdict == Verdict::Allowed)
}

/// `!Number.isNaN(Date.parse(at))` for what a cursor holds: ISO instants, and PostgreSQL's
/// text form of a `timestamptz` (`2026-01-02 03:04:05.678+00`) — the form the route itself
/// hands out. V8 reads still other forms (`Jan 2 2026`…); those are refused here.
fn cursor_date_parses(at: &str) -> bool {
    static PG: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}(:?\d{2})?)?$").unwrap());
    crate::filter::date_parses(at) || PG.is_match(at)
}

/// `listNotifications`, shaped as the route answers.
pub async fn list_notifications(pools: &Pools, ctx: &RequestContext, unread: bool, after: Option<&str>) -> Result<Value, AppError> {
    let limit: i64 = 30;
    let mut before: Option<(String, String)> = None;
    if let Some(after) = after.filter(|a| !a.is_empty()) {
        let mut parts = after.split('|');
        let (at, id) = (parts.next(), parts.next());
        match (at, id) {
            (Some(at), Some(id)) if cursor_date_parses(at) => before = Some((at.to_string(), id.to_string())),
            _ => return Err(AppError::new("CURSOR_INVALID").with("cursor", json!(after))),
        }
    }
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let before = before.clone();
        async move {
            let mut params = vec![P::text(&ctx.actor.id), P::text(&ctx.tenant_id)];
            let mut clauses = vec!["n.user_id = $1".to_string(), "t.ref = $2".to_string()];
            if unread {
                clauses.push("n.read_at IS NULL".into());
            }
            if let Some((at, id)) = &before {
                params.push(P::text(at));
                params.push(P::text(id));
                clauses.push(format!("(n.created_at, n.id) < (${}::timestamptz, ${}::uuid)", params.len() - 1, params.len()));
            }
            params.push(P::text((limit + 1).to_string()));
            let sql = format!(
                "SELECT n.id::text, n.kind, n.actor_id::text,
                coalesce(nullif(a.display_name, ''), a.email) AS actor_name,
                sn.name AS base_name, b.label AS base_label,
                n.table_id::text, tn.name AS table_name, td.label AS table_label,
                n.record_id::text, n.comment_id::text, n.excerpt,
                n.created_at::text, n.read_at::text
           FROM _basedb.notification n
           JOIN _basedb.tenant t ON t.id = n.tenant_id
           JOIN _basedb.base b ON b.id = n.base_id
           JOIN _basedb.table_def td ON td.id = n.table_id
           JOIN _basedb.physical_name tn ON tn.id = td.name_id
           JOIN _basedb.db_schema s ON s.id = td.schema_id
           JOIN _basedb.physical_name sn ON sn.id = s.name_id
           LEFT JOIN _basedb.app_user a ON a.id = n.actor_id
          WHERE {}
          ORDER BY n.created_at DESC, n.id DESC
          LIMIT ${}",
                clauses.join(" AND "),
                params.len()
            );
            let rows = tx.rows(&sql, &crate::pg::refs(&params)).await?;
            let page = &rows[..rows.len().min(limit as usize)];
            let mut readable: HashMap<String, bool> = HashMap::new();
            for r in page {
                let table_id: String = r.get(6);
                if let std::collections::hash_map::Entry::Vacant(slot) = readable.entry(table_id) {
                    let ok = can_read_table(&tx, ctx, slot.key()).await?;
                    slot.insert(ok);
                }
            }
            let count = tx
                .first(
                    "SELECT count(*)::int AS n FROM _basedb.notification n
           JOIN _basedb.tenant t ON t.id = n.tenant_id
          WHERE n.user_id = $1::text::uuid AND t.ref = $2 AND n.read_at IS NULL",
                    &[&ctx.actor.id, &ctx.tenant_id],
                )
                .await?;
            let unread: i32 = count.map(|r| r.get(0)).unwrap_or(0);
            let data: Vec<Value> = page
                .iter()
                .map(|r| {
                    let actor_id: Option<String> = r.get(2);
                    let actor_name: Option<String> = r.get(3);
                    let table_id: String = r.get(6);
                    json!({
                        "id": r.get::<_, String>(0),
                        "kind": r.get::<_, String>(1),
                        "actor": actor_id.map(|id| json!({ "id": id, "name": actor_name.unwrap_or_default() })),
                        "base": { "name": r.get::<_, String>(4), "label": r.get::<_, String>(5) },
                        "table": { "name": r.get::<_, String>(7), "label": r.get::<_, String>(8) },
                        "record_id": r.get::<_, String>(9),
                        "comment_id": r.get::<_, Option<String>>(10),
                        "excerpt": r.get::<_, String>(11),
                        "created_at": r.get::<_, String>(12),
                        "read_at": r.get::<_, Option<String>>(13),
                        "readable": readable.get(&table_id) == Some(&true),
                    })
                })
                .collect();
            let next_cursor = match page.last() {
                Some(last) if rows.len() > limit as usize => Some(format!("{}|{}", last.get::<_, String>(12), last.get::<_, String>(0))),
                _ => None,
            };
            Ok(json!({ "data": data, "meta": { "unread": unread, "next_cursor": next_cursor } }))
        }
    })
    .await
}

/// `markNotificationsRead`: how many changed.
pub async fn mark_read(pools: &Pools, ctx: &RequestContext, ids: &[String], all: bool) -> Result<usize, AppError> {
    let ids: Vec<&String> = ids.iter().filter(|id| crate::js::is_uuid_shape(id)).collect();
    if !all && ids.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("ids")).with("reason", json!("rien_a_marquer")));
    }
    let ids = P::of(&json!(ids));
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let ids = ids.clone();
        async move {
            let rows = tx
                .query_op(
                    "UPDATE _basedb.notification n SET read_at = pg_catalog.clock_timestamp()
         FROM _basedb.tenant t
        WHERE t.id = n.tenant_id AND t.ref = $2 AND n.user_id = $1::text::uuid AND n.read_at IS NULL
          AND ($3::boolean OR n.id = ANY($4::uuid[]))
        RETURNING n.id::text",
                    &[&ctx.actor.id, &ctx.tenant_id, &all, &ids],
                    SqlOp::Update,
                )
                .await?;
            if !rows.is_empty() {
                emit_live(&tx, &json!({ "kind": "notifications", "user": ctx.actor.id })).await?;
            }
            Ok(rows.len())
        }
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::cursor_date_parses;

    #[test]
    fn cursor_dates_accept_the_postgres_text_form() {
        assert!(cursor_date_parses("2026-11-21 01:29:57.482+00"));
        assert!(cursor_date_parses("2030-01-01 00:00:00+00"));
        assert!(cursor_date_parses("2026-01-02T03:04:05Z"));
        assert!(!cursor_date_parses("pas une date"));
        assert!(!cursor_date_parses(""));
    }
}
