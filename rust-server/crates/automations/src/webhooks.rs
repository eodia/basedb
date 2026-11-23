//! Webhooks (`webhooks/manage.ts`, `dispatch.ts`, chapter 08 §10): administered like the
//! integration tokens — `manage_tokens` on the base, a session elevated minutes ago, the
//! secret shown once and kept sealed — and sent by a loop that rebuilds each body from
//! `change_event` when it sends, signed `t=<unix>,v1=<HMAC-SHA256>` as Node signs.

use crate::engine::js_host;
use basedb_admin::common::{administering, fields, nfc, require_elevated_session as require_elevated, strict_json};
use basedb_admin::sealing::{seal, unseal};
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError, SqlOp};
use basedb_base::idempotency::js_stringify;
use basedb_base::layers::RequestId;
use basedb_base::rbac::{decide, load_grants, load_target, require_on_base, Action, Verdict};
use basedb_base::time::{b64url, hex, hmac_sha256, iso, random_bytes};
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_catalog::projection::{resolve_base, resolve_table};
use basedb_catalog::targets::{check_target, TargetPolicy};
use basedb_records::drain::{load_history_tables, HistoryTable};
use basedb_records::js::number_string;
use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::time::Duration;

pub const WEBHOOK_EVENTS: [&str; 3] = ["create", "update", "delete"];
/// The purpose a signing secret is sealed under.
pub const WEBHOOK_SECRET_PURPOSE: &str = "webhook/signing";

// ── Administration (`manage.ts`) ────────────────────────────────────────────────────────

/// `refreshChangeFeed`: a table nobody listens to writes no event.
pub async fn refresh_change_feed<E: Exec + Sync>(exec: &E, base_id: &str) -> Result<(), AppError> {
    exec.execute_op(
        "INSERT INTO _basedb_local.change_feed_state (table_id, is_active, updated_at)
         SELECT t.id,
                EXISTS (SELECT 1 FROM _basedb.webhook_subscription s
                          JOIN _basedb.webhook w ON w.id = s.webhook_id
                         WHERE s.table_id = t.id AND w.is_active AND w.deleted_at IS NULL),
                clock_timestamp()
           FROM _basedb.table_def t
          WHERE t.base_id = $1::text::uuid
         ON CONFLICT (table_id) DO UPDATE
           SET is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at",
        &[&base_id],
        SqlOp::Insert,
    )
    .await
    .map(|_| ())
}

/// `assertFullMask` (A.19): every field, every row, every linked table — or refused.
async fn assert_full_mask<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_ids: &[String]) -> Result<(), AppError> {
    let grants = load_grants(exec, ctx).await?;
    let mut missing: Vec<String> = Vec::new();
    for table_id in table_ids {
        let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id));
        let Some(target) = load_target(exec, ctx, table_id).await? else { return Err(not_found()) };
        let read = decide(ctx, &grants, Action::Read, &target);
        if read.verdict != Verdict::Allowed {
            return Err(not_found());
        }
        for field in &target.field_ids {
            if !read.readable_fields.contains(field) {
                missing.push(field.clone());
            }
        }
        if read.row_predicate != "TRUE" {
            missing.push(format!("rows:{table_id}"));
        }
        let links = exec
            .rows(
                "SELECT l.target_table_id::text FROM _basedb.field_link_config l
                   JOIN _basedb.field f ON f.id = l.field_id
                  WHERE f.table_id = $1::text::uuid AND f.is_live",
                &[table_id],
            )
            .await?;
        for link in links {
            let linked: String = link.get(0);
            let visible = match load_target(exec, ctx, &linked).await? {
                None => false,
                Some(t) => decide(ctx, &grants, Action::Read, &t).verdict == Verdict::Allowed,
            };
            if !visible {
                missing.push(format!("table:{linked}"));
            }
        }
    }
    if !missing.is_empty() {
        return Err(AppError::new("WEBHOOK_MASK_INCOMPLETE").with("missing", json!(missing)));
    }
    Ok(())
}

/// `summaries`, serialized as app.ts's `serializeWebhook`.
async fn summaries<E: Exec + Sync>(exec: &E, by_id: bool, key: &str) -> Result<Vec<Value>, AppError> {
    let sql = format!(
        "SELECT w.id::text, w.label, w.target_url, w.is_active, w.disabled_reason, w.created_at
           FROM _basedb.webhook w
          WHERE w.deleted_at IS NULL AND {} = $1::text::uuid
          ORDER BY w.created_at",
        if by_id { "w.id" } else { "w.base_id" }
    );
    let hooks = exec.rows(&sql, &[&key]).await?;
    if hooks.is_empty() {
        return Ok(Vec::new());
    }
    let ids: Vec<String> = hooks.iter().map(|h| h.get(0)).collect();
    let subs = exec
        .rows(
            "SELECT s.webhook_id::text, s.table_id::text, tn.name AS table_name, t.label AS table_label, s.event
               FROM _basedb.webhook_subscription s
               JOIN _basedb.table_def t      ON t.id = s.table_id
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
              WHERE s.webhook_id = ANY($1::text[]::uuid[])
              ORDER BY t.position, s.event",
            &[&ids],
        )
        .await?;
    let last = exec
        .rows(
            "SELECT DISTINCT ON (d.webhook_id) d.webhook_id::text, d.status,
                    coalesce(d.delivered_at, d.created_at) AS at, d.response_code::int
               FROM _basedb.webhook_delivery d
              WHERE d.webhook_id = ANY($1::text[]::uuid[])
              ORDER BY d.webhook_id, d.created_at DESC",
            &[&ids],
        )
        .await?;
    Ok(hooks
        .iter()
        .map(|h| {
            let id: String = h.get(0);
            let mut by_table: IndexMap<String, (String, String, Vec<String>)> = IndexMap::new();
            for s in subs.iter().filter(|s| s.get::<_, String>(0) == id) {
                let entry = by_table.entry(s.get(1)).or_insert_with(|| (s.get(2), s.get(3), Vec::new()));
                entry.2.push(s.get(4));
            }
            let l = last.iter().find(|l| l.get::<_, String>(0) == id);
            json!({
                "id": id,
                "label": h.get::<_, String>(1),
                "url": h.get::<_, String>(2),
                "active": h.get::<_, bool>(3),
                "disabled_reason": h.get::<_, Option<String>>(4),
                "created_at": iso(h.get(5)),
                "subscriptions": by_table.into_values().map(|(name, label, events)| json!({
                    "table": name,
                    "table_label": label,
                    "events": WEBHOOK_EVENTS.iter().filter(|e| events.iter().any(|x| x == *e)).collect::<Vec<_>>(),
                })).collect::<Vec<_>>(),
                "last_delivery": l.map(|l| json!({
                    "status": l.get::<_, String>(1),
                    "at": iso(l.get(2)),
                    "response_code": l.get::<_, Option<i32>>(3),
                })),
            })
        })
        .collect())
}

/// `loadWebhook`: one of the tenant's, not deleted.
async fn load_webhook<E: Exec + Sync>(exec: &E, ctx: &RequestContext, id: &str) -> Result<(String, String, String), AppError> {
    let row = exec
        .first(
            "SELECT w.id::text, w.base_id::text, w.label
               FROM _basedb.webhook w
               JOIN _basedb.base b   ON b.id = w.base_id
               JOIN _basedb.tenant t ON t.id = b.tenant_id
              WHERE w.id::text = $1 AND t.ref = $2 AND w.deleted_at IS NULL",
            &[&id, &ctx.tenant_id],
        )
        .await?;
    row.map(|r| (r.get(0), r.get(1), r.get(2))).ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("webhook", json!(id)))
}

async fn audit<E: Exec + Sync>(exec: &E, ctx: &RequestContext, action: &str, id: &str, name: &str, payload: Option<Value>) -> Result<(), AppError> {
    let mut entry = AuditEntry::new(action, "webhook");
    entry.object_id = Some(id.to_string());
    entry.object_name = Some(name.to_string());
    if let Some(Value::Object(m)) = payload {
        entry.payload = m;
    }
    write_audit(exec, ctx, &entry).await
}

async fn abandon_pending<E: Exec + Sync>(exec: &E, id: &str) -> Result<(), AppError> {
    exec.execute_op(
        "UPDATE _basedb.webhook_delivery SET status = 'abandoned'
          WHERE webhook_id = $1::text::uuid AND status IN ('pending', 'in_flight')",
        &[&id],
        SqlOp::Update,
    )
    .await
    .map(|_| ())
}

#[derive(serde::Deserialize)]
pub struct BaseQuery {
    base: Option<String>,
}

/// `GET /api/v1/{tenant}/admin/webhooks?base=`.
pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, Query(q): Query<BaseQuery>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, q.base.as_deref().unwrap_or("")).await?;
    let ctx = &ctx;
    let base_id = &base_id;
    let hooks = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageTokens, base_id).await?;
        summaries(&tx, false, base_id).await
    })
    .await?;
    Ok(json_ok(json!({ "data": hooks })))
}

/// `POST /api/v1/{tenant}/admin/webhooks`.
pub async fn create(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = fields(&body)?;
    let (Some(base_ref), Some(subscriptions)) = (body.get("base").and_then(Value::as_str), body.get("subscriptions").and_then(Value::as_array)) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("base, subscriptions")));
    };
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, base_ref).await?;
    let mut subs: Vec<(String, Vec<Value>)> = Vec::new();
    for s in subscriptions {
        let (Some(table), Some(events)) = (s.get("table").and_then(Value::as_str), s.get("events").and_then(Value::as_array)) else {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("subscriptions")));
        };
        let resolved = resolve_table(&st.pools, &ctx, base_ref, table).await?;
        subs.push((resolved.table_id, events.clone()));
    }
    let label = body.get("label").and_then(Value::as_str).map(|l| basedb_admin::common::js_trim(&nfc(l)).to_string()).unwrap_or_default();
    if label.is_empty() {
        return Err(AppError::new("LABEL_EMPTY"));
    }
    if label.chars().count() > 200 {
        return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(200)));
    }
    if subs.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("subscriptions")));
    }
    for (_, events) in &subs {
        if events.is_empty() || events.iter().any(|e| !e.as_str().is_some_and(|e| WEBHOOK_EVENTS.contains(&e))) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("events")));
        }
    }
    let url = check_target(body.get("url").and_then(Value::as_str).unwrap_or(""), &TargetPolicy::from_config(&st.cfg)).await?;
    let instance_key = st.instance_key()?.to_string();
    let (ctx, session_id, base_id, label, subs, url, instance_key) = (&ctx, &session_id, &base_id, &label, &subs, &url, &instance_key);
    let created = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageTokens, base_id).await?;
        require_elevated(&tx, ctx, session_id).await?;
        let mut table_ids: Vec<String> = Vec::new();
        for (t, _) in subs {
            if !table_ids.contains(t) {
                table_ids.push(t.clone());
            }
        }
        let own = tx.rows("SELECT id::text FROM _basedb.table_def WHERE id = ANY($1::text[]::uuid[]) AND base_id = $2::text::uuid AND is_live", &[&table_ids, base_id]).await?;
        if own.len() != table_ids.len() {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!("subscriptions")));
        }
        assert_full_mask(&tx, ctx, &table_ids).await?;
        let tenant: Option<String> = tx.first("SELECT id::text FROM _basedb.tenant WHERE ref = $1", &[&ctx.tenant_id]).await?.map(|r| r.get(0));
        let suffix = hex(&random_bytes(4));
        let role = tx
            .query_op(
                "INSERT INTO _basedb.role (tenant_id, label, label_key, name, kind, created_by)
                 VALUES ($1::text::uuid, $2, lower($2), $3, 'token', $4::text::uuid) RETURNING id::text",
                &[&tenant, &format!("Webhook {label} {suffix}"), &format!("webhook_{suffix}"), &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let role: Option<String> = role.first().map(|r| r.get(0));
        tx.execute_op(
            "INSERT INTO _basedb.permission (role_id, scope_kind, scope_base_id, action, granted_by)
             VALUES ($1::text::uuid, 'base', $2::text::uuid, 'read', $3::text::uuid)",
            &[&role, base_id, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
        let secret = format!("whsec_{}", b64url(&random_bytes(32)));
        let sealed = seal(instance_key, WEBHOOK_SECRET_PURPOSE, &secret);
        let hook = tx
            .query_op(
                "INSERT INTO _basedb.webhook
                   (base_id, role_id, label, target_url, signing_secret_encrypted, signing_key_version, created_by, updated_by)
                 VALUES ($1::text::uuid, $2::text::uuid, $3, $4, convert_to($5, 'UTF8'), 1, $6::text::uuid, $6::text::uuid) RETURNING id::text",
                &[base_id, &role, label, &url.as_str(), &sealed, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let hook_id: String = hook.first().map(|r| r.get(0)).unwrap_or_default();
        for (table, events) in subs {
            let mut seen: Vec<&str> = Vec::new();
            for e in events.iter().filter_map(Value::as_str) {
                if seen.contains(&e) {
                    continue;
                }
                seen.push(e);
                tx.execute_op(
                    "INSERT INTO _basedb.webhook_subscription (webhook_id, table_id, event)
                     VALUES ($1::text::uuid, $2::text::uuid, $3) ON CONFLICT DO NOTHING",
                    &[&hook_id, table, &e],
                    SqlOp::Insert,
                )
                .await?;
            }
        }
        refresh_change_feed(&tx, base_id).await?;
        audit(&tx, ctx, "webhook.create", &hook_id, label, Some(json!({ "host": js_host(url), "tables": table_ids.len() }))).await?;
        let webhook = summaries(&tx, true, &hook_id).await?.into_iter().next().unwrap_or(Value::Null);
        Ok((webhook, secret))
    })
    .await?;
    let (mut webhook, secret) = created;
    if let Some(m) = webhook.as_object_mut() {
        m.insert("secret".into(), json!(secret));
    }
    Ok(json_response(StatusCode::CREATED, &json!({ "data": webhook })))
}

/// `PATCH /api/v1/{tenant}/admin/webhooks/{id}`: stopped, or started again with the mask checked.
pub async fn set_active(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let Some(active) = fields(&body)?.get("active").and_then(Value::as_bool) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("active")));
    };
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let (ctx, session_id, id) = (&ctx, &session_id, &id);
    let hook = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let (hook_id, base_id, label) = load_webhook(&tx, ctx, id).await?;
        require_on_base(&tx, ctx, Action::ManageTokens, &base_id).await?;
        require_elevated(&tx, ctx, session_id).await?;
        if active {
            let tables: Vec<String> = tx.rows("SELECT DISTINCT table_id::text FROM _basedb.webhook_subscription WHERE webhook_id = $1::text::uuid", &[&hook_id]).await?.iter().map(|r| r.get(0)).collect();
            assert_full_mask(&tx, ctx, &tables).await?;
        }
        tx.execute_op(
            "UPDATE _basedb.webhook
                SET is_active = $2, disabled_reason = CASE WHEN $2 THEN NULL ELSE 'manual' END,
                    updated_at = clock_timestamp(), updated_by = $3::text::uuid
              WHERE id = $1::text::uuid",
            &[&hook_id, &active, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        if !active {
            abandon_pending(&tx, &hook_id).await?;
        }
        refresh_change_feed(&tx, &base_id).await?;
        audit(&tx, ctx, if active { "webhook.activate" } else { "webhook.deactivate" }, &hook_id, &label, None).await?;
        Ok(summaries(&tx, true, &hook_id).await?.into_iter().next().unwrap_or(Value::Null))
    })
    .await?;
    Ok(json_ok(json!({ "data": hook })))
}

/// `DELETE /api/v1/{tenant}/admin/webhooks/{id}`: nothing more sent, the history kept.
pub async fn delete(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let (ctx, session_id, id) = (&ctx, &session_id, &id);
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let (hook_id, base_id, label) = load_webhook(&tx, ctx, id).await?;
        require_on_base(&tx, ctx, Action::ManageTokens, &base_id).await?;
        require_elevated(&tx, ctx, session_id).await?;
        tx.execute_op(
            "UPDATE _basedb.webhook
                SET is_active = false, disabled_reason = 'manual', deleted_at = clock_timestamp(),
                    deleted_by = $2::text::uuid, updated_at = clock_timestamp(), updated_by = $2::text::uuid
              WHERE id = $1::text::uuid",
            &[&hook_id, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        abandon_pending(&tx, &hook_id).await?;
        refresh_change_feed(&tx, &base_id).await?;
        audit(&tx, ctx, "webhook.delete", &hook_id, &label, None).await
    })
    .await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

/// `GET /api/v1/{tenant}/admin/webhooks/{id}/deliveries`: the last fifty, states only.
pub async fn deliveries(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (ctx, id) = (&ctx, &id);
    let list = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let (hook_id, base_id, _) = load_webhook(&tx, ctx, id).await?;
        require_on_base(&tx, ctx, Action::ManageTokens, &base_id).await?;
        let rows = tx
            .rows(
                "SELECT d.id::text, d.created_at, d.status, d.attempts, d.next_attempt_at,
                        d.delivered_at, d.response_code::int, d.error_code, t.label AS table_label,
                        e.record_id::text, e.op
                   FROM _basedb.webhook_delivery d
                   JOIN _basedb.change_event e ON e.id = d.event_id AND e.occurred_at = d.event_occurred_at
                   LEFT JOIN _basedb.table_def t ON t.id = e.table_id
                  WHERE d.webhook_id = $1::text::uuid
                  ORDER BY d.created_at DESC
                  LIMIT 50",
                &[&hook_id],
            )
            .await?;
        let opt = |v: Option<DateTime<Utc>>| v.map(|v| json!(iso(v))).unwrap_or(Value::Null);
        Ok(rows
            .iter()
            .map(|r| {
                json!({
                    "id": r.get::<_, String>(0),
                    "created_at": iso(r.get(1)),
                    "status": r.get::<_, String>(2),
                    "attempts": r.get::<_, i32>(3),
                    "next_attempt_at": opt(r.get(4)),
                    "delivered_at": opt(r.get(5)),
                    "response_code": r.get::<_, Option<i32>>(6),
                    "error_code": r.get::<_, Option<String>>(7),
                    "table_label": r.get::<_, Option<String>>(8),
                    "record_id": r.get::<_, String>(9),
                    "op": r.get::<_, String>(10),
                })
            })
            .collect::<Vec<_>>())
    })
    .await?;
    Ok(json_ok(json!({ "data": list })))
}

// ── Sending (`dispatch.ts`) ─────────────────────────────────────────────────────────────

const DISPATCH_BATCH: i64 = 50;
const BACKOFF_SECONDS: [f64; 8] = [10.0, 30.0, 120.0, 600.0, 3_600.0, 21_600.0, 86_400.0, 86_400.0];
const FAILURES_BEFORE_DISABLE: i64 = 50;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// `signature`: `t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>." + body)>`.
pub fn signature(secret: &str, timestamp: i64, body: &str) -> String {
    let v1 = hex(&hmac_sha256(secret.as_bytes(), &[timestamp.to_string().as_bytes(), b".", body.as_bytes()]));
    format!("t={timestamp},v1={v1}")
}

struct Due {
    id: String,
    webhook_id: String,
    event_id: String,
    event_occurred_at: String,
    attempts: i32,
}

/// `takeDue`: what may go now, strictly in order per row; leased two minutes.
async fn take_due(st: &Shared) -> Result<Vec<Due>, AppError> {
    let ctx = RequestContext::new(uuid::Uuid::new_v4().to_string(), Actor::system(), "", Surface::System);
    with_transaction(&st.pools, PoolName::Catalog, &ctx, TxOptions::default(), |tx| async move {
        tx.execute_op(
            "UPDATE _basedb.webhook_delivery SET status = 'pending'
              WHERE status = 'in_flight' AND next_attempt_at < clock_timestamp()",
            &[],
            SqlOp::Update,
        )
        .await?;
        let candidates: Vec<String> = tx
            .rows(
                "SELECT DISTINCT ON (d.partition_key) d.id::text
                   FROM _basedb.webhook_delivery d
                  WHERE d.status = 'pending'
                    AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= clock_timestamp())
                    AND NOT EXISTS (
                          SELECT 1 FROM _basedb.webhook_delivery p
                           WHERE p.partition_key = d.partition_key
                             AND p.status IN ('pending', 'in_flight')
                             AND (p.created_at, p.id) < (d.created_at, d.id))
                  ORDER BY d.partition_key, d.created_at, d.id
                  LIMIT $1",
                &[&DISPATCH_BATCH],
            )
            .await?
            .iter()
            .map(|r| r.get(0))
            .collect();
        if candidates.is_empty() {
            return Ok(Vec::new());
        }
        let locked: Vec<Due> = tx
            .rows(
                "SELECT id::text, webhook_id::text, event_id::text, event_occurred_at::text, attempts
                   FROM _basedb.webhook_delivery
                  WHERE id = ANY($1::text[]::uuid[]) AND status = 'pending'
                  ORDER BY created_at, id
                  FOR UPDATE SKIP LOCKED",
                &[&candidates],
            )
            .await?
            .iter()
            .map(|r| Due { id: r.get(0), webhook_id: r.get(1), event_id: r.get(2), event_occurred_at: r.get(3), attempts: r.get(4) })
            .collect();
        if !locked.is_empty() {
            let ids: Vec<String> = locked.iter().map(|d| d.id.clone()).collect();
            tx.execute_op(
                "UPDATE _basedb.webhook_delivery
                    SET status = 'in_flight', attempts = attempts + 1,
                        next_attempt_at = clock_timestamp() + interval '2 minutes'
                  WHERE id = ANY($1::text[]::uuid[])",
                &[&ids],
                SqlOp::Update,
            )
            .await?;
        }
        Ok(locked)
    })
    .await
}

struct EventRow {
    id: String,
    occurred_at: DateTime<Utc>,
    base_id: String,
    table_id: String,
    record_id: String,
    op: String,
    is_cascade: bool,
    actor_kind: String,
    before: Option<Map<String, Value>>,
    after: Option<Map<String, Value>>,
}

/// `presentRow`: numbers as decimal strings, links named as they are now.
fn present_row(row: &Option<Map<String, Value>>, table: Option<&HistoryTable>, displays: &HashMap<String, Option<String>>) -> Value {
    let Some(row) = row else { return Value::Null };
    let mut out = row.clone();
    for field in table.map(|t| t.fields.as_slice()).unwrap_or(&[]) {
        let Some(value) = out.get(&field.column).cloned() else { continue };
        if field.kind == "number" && value.is_number() {
            out.insert(field.column.clone(), json!(number_string(value.as_f64().unwrap_or(f64::NAN))));
        } else if let Some(target) = &field.target {
            let v = match &value {
                Value::String(id) => json!({ "id": id, "display": displays.get(&format!("{}:{id}", target.table_id)).cloned().flatten() }),
                _ => Value::Null,
            };
            out.insert(field.column.clone(), v);
        }
    }
    Value::Object(out)
}

/// `linkDisplays`: the names of the rows a batch's links point to.
async fn link_displays<E: Exec + Sync>(exec: &E, events: &[EventRow], tables: &HashMap<String, HistoryTable>) -> Result<HashMap<String, Option<String>>, AppError> {
    let mut wanted: IndexMap<String, (String, String, String, Vec<String>)> = IndexMap::new();
    for e in events {
        for field in tables.get(&e.table_id).map(|t| t.fields.as_slice()).unwrap_or(&[]) {
            let Some(target) = &field.target else { continue };
            let Some(column) = &target.display_column else { continue };
            let entry = wanted.entry(target.table_id.clone()).or_insert_with(|| (target.schema.clone(), target.table.clone(), column.clone(), Vec::new()));
            for row in [&e.before, &e.after].into_iter().flatten() {
                if let Some(Value::String(v)) = row.get(&field.column) {
                    if !entry.3.contains(v) {
                        entry.3.push(v.clone());
                    }
                }
            }
        }
    }
    let mut out = HashMap::new();
    for (table_id, (schema, table, column, ids)) in wanted {
        if ids.is_empty() {
            continue;
        }
        let sql = format!(
            "SELECT \"_id\"::text AS id, {}::text AS display FROM {} WHERE \"_id\" = ANY($1::text[]::uuid[])",
            basedb_catalog::naming::quote_identifier(&column)?,
            basedb_catalog::naming::qualify(&schema, &table)?
        );
        for r in exec.rows(&sql, &[&ids]).await? {
            out.insert(format!("{table_id}:{}", r.get::<_, String>(0)), r.get::<_, Option<String>>(1));
        }
    }
    Ok(out)
}

fn type_of(op: &str) -> &str {
    match op {
        "insert" => "record.created",
        "update" => "record.updated",
        "delete" => "record.deleted",
        other => other,
    }
}

/// `payloadOf`: the events of a batch, as the consumer reads them.
async fn payload_of<E: Exec + Sync>(exec: &E, due: &[Due]) -> Result<Vec<Value>, AppError> {
    let ids: Vec<String> = due.iter().map(|d| d.event_id.clone()).collect();
    let ats: Vec<String> = due.iter().map(|d| d.event_occurred_at.clone()).collect();
    let events: Vec<EventRow> = exec
        .rows(
            "SELECT id::text, occurred_at, base_id::text, table_id::text, record_id::text, op,
                    is_cascade, actor_kind, before, after
               FROM _basedb.change_event
              WHERE (id, occurred_at) IN (SELECT * FROM unnest($1::text[]::uuid[], $2::text[]::timestamptz[]))
              ORDER BY occurred_at, id",
            &[&ids, &ats],
        )
        .await?
        .iter()
        .map(|r| {
            let obj = |v: Option<Value>| match v {
                Some(Value::Object(m)) => Some(m),
                _ => None,
            };
            EventRow {
                id: r.get(0),
                occurred_at: r.get(1),
                base_id: r.get(2),
                table_id: r.get(3),
                record_id: r.get(4),
                op: r.get(5),
                is_cascade: r.get(6),
                actor_kind: r.get(7),
                before: obj(r.get(8)),
                after: obj(r.get(9)),
            }
        })
        .collect();
    let mut table_ids: Vec<String> = Vec::new();
    let mut base_ids: Vec<String> = Vec::new();
    for e in &events {
        if !table_ids.contains(&e.table_id) {
            table_ids.push(e.table_id.clone());
        }
        if !base_ids.contains(&e.base_id) {
            base_ids.push(e.base_id.clone());
        }
    }
    let tables = load_history_tables(exec, &table_ids).await?;
    let names: HashMap<String, (String, String)> = exec
        .rows(
            "SELECT b.id::text, t.ref AS tenant, sn.name AS base
               FROM _basedb.base b
               JOIN _basedb.tenant t         ON t.id = b.tenant_id
               JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE b.id = ANY($1::text[]::uuid[])",
            &[&base_ids],
        )
        .await?
        .iter()
        .map(|r| (r.get(0), (r.get(1), r.get(2))))
        .collect();
    let displays = link_displays(exec, &events, &tables).await?;
    Ok(events
        .iter()
        .map(|e| {
            let table = tables.get(&e.table_id);
            let base = names.get(&e.base_id);
            let changed: Vec<String> = match (&e.before, &e.after, e.op.as_str()) {
                (Some(b), Some(a), "update") => table
                    .map(|t| t.fields.as_slice())
                    .unwrap_or(&[])
                    .iter()
                    .filter(|f| js_stringify(b.get(&f.column).unwrap_or(&Value::Null)) != js_stringify(a.get(&f.column).unwrap_or(&Value::Null)))
                    .map(|f| f.column.clone())
                    .collect(),
                _ => Vec::new(),
            };
            json!({
                "id": e.id,
                "type": type_of(&e.op),
                "occurred_at": iso(e.occurred_at),
                "tenant": base.map(|b| b.0.clone()),
                "base": base.map(|b| b.1.clone()),
                "table": table.map(|t| t.table.clone()),
                "record_id": e.record_id,
                "actor": { "kind": e.actor_kind },
                "cause": { "kind": if e.is_cascade { "cascade" } else { "direct" } },
                "before": present_row(&e.before, table, &displays),
                "after": present_row(&e.after, table, &displays),
                "changed": changed,
            })
        })
        .collect())
}

struct Sent {
    delivered: bool,
    retryable: bool,
    response_code: Option<i32>,
    error_code: Option<&'static str>,
    retry_after: Option<String>,
}

fn failed(retryable: bool, code: &'static str) -> Sent {
    Sent { delivered: false, retryable, response_code: None, error_code: Some(code), retry_after: None }
}

/// `nextAttempt`: the §10.7 ladder, ±20 %, never sooner than `Retry-After`.
fn next_attempt(attempts: i32, retry_after: Option<&str>) -> String {
    let index = ((attempts - 1).max(0) as usize).min(BACKOFF_SECONDS.len() - 1);
    let base = BACKOFF_SECONDS[index];
    let bytes = random_bytes(4);
    let draw = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) % 401;
    let mut seconds = base * (1.0 + (draw as f64 - 200.0) / 1000.0);
    let asked = retry_after.map(basedb_catalog::js::js_to_number).unwrap_or(f64::NAN);
    if asked.is_finite() && asked > seconds {
        seconds = asked;
    }
    iso(Utc::now() + chrono::Duration::milliseconds((seconds * 1000.0) as i64))
}

fn client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(|| reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).no_proxy().build().expect("client"))
}

/// `send`: one call, no redirect followed, the answer's body ignored.
async fn send(url: &str, body: String, headers: &[(&str, String)]) -> Sent {
    let mut request = client().post(url).timeout(REQUEST_TIMEOUT).header("content-type", "application/json").header("user-agent", "basedb-webhook/1");
    for (name, value) in headers {
        request = request.header(*name, value);
    }
    match request.body(body).send().await {
        Err(_) => failed(true, "WEBHOOK_TEMPORARY_FAILURE"),
        Ok(response) => {
            let code = response.status().as_u16() as i32;
            if (200..300).contains(&code) {
                return Sent { delivered: true, retryable: false, response_code: Some(code), error_code: None, retry_after: None };
            }
            let retryable = code >= 500 || code == 408 || code == 429;
            let retry_after = response.headers().get("retry-after").and_then(|v| v.to_str().ok()).map(str::to_string);
            Sent {
                delivered: false,
                retryable,
                response_code: Some(code),
                error_code: Some(if retryable { "WEBHOOK_TEMPORARY_FAILURE" } else { "WEBHOOK_PERMANENT_FAILURE" }),
                retry_after,
            }
        }
    }
}

/// `dispatchWebhooks`: one pass — what is due, sent grouped by webhook, the outcome kept.
pub async fn dispatch_webhooks(st: &Shared) -> Result<usize, AppError> {
    let due = take_due(st).await?;
    if due.is_empty() {
        return Ok(0);
    }
    let instance_key = st.instance_key().unwrap_or("").to_string();
    let policy = TargetPolicy::from_config(&st.cfg);
    let conn = st.pools.get(PoolName::Catalog).await?;
    let mut by_hook: IndexMap<String, Vec<&Due>> = IndexMap::new();
    for d in &due {
        by_hook.entry(d.webhook_id.clone()).or_default().push(d);
    }
    for (webhook_id, deliveries) in by_hook {
        let hook = conn
            .first(
                "SELECT target_url, convert_from(signing_secret_encrypted, 'UTF8') AS secret, is_active,
                        deleted_at IS NOT NULL AS deleted
                   FROM _basedb.webhook WHERE id = $1::text::uuid",
                &[&webhook_id],
            )
            .await?;
        let ids: Vec<String> = deliveries.iter().map(|d| d.id.clone()).collect();
        let Some(hook) = hook.filter(|h| h.get::<_, bool>(2) && !h.get::<_, bool>(3)) else {
            conn.execute_op("UPDATE _basedb.webhook_delivery SET status = 'abandoned' WHERE id = ANY($1::text[]::uuid[])", &[&ids], SqlOp::Update).await?;
            continue;
        };
        let target_url: String = hook.get(0);
        let sent = match unseal(&instance_key, WEBHOOK_SECRET_PURPOSE, &hook.get::<_, String>(1)) {
            None => failed(false, "WEBHOOK_PERMANENT_FAILURE"),
            Some(secret) => {
                let owned: Vec<Due> = deliveries.iter().map(|d| Due { id: d.id.clone(), webhook_id: d.webhook_id.clone(), event_id: d.event_id.clone(), event_occurred_at: d.event_occurred_at.clone(), attempts: d.attempts }).collect();
                let prepared = async {
                    check_target(&target_url, &policy).await?;
                    let events = payload_of(&conn, &owned).await?;
                    Ok::<String, AppError>(js_stringify(&json!({ "events": events })))
                }
                .await;
                match prepared {
                    // Every failure here is a `BasedbError` in Node (the address refused, or
                    // a query): not retried.
                    Err(_) => failed(false, "WEBHOOK_TARGET_REJECTED"),
                    Ok(body) => {
                        let timestamp = Utc::now().timestamp();
                        let headers = [
                            ("x-basedb-signature", signature(&secret, timestamp, &body)),
                            ("x-basedb-delivery-id", deliveries.first().map(|d| d.id.clone()).unwrap_or_default()),
                            ("x-basedb-webhook-id", webhook_id.clone()),
                        ];
                        send(&target_url, body, &headers).await
                    }
                }
            }
        };
        for d in &deliveries {
            let exhausted = (d.attempts + 1) as usize >= BACKOFF_SECONDS.len();
            let status = if sent.delivered {
                "delivered"
            } else if sent.retryable && !exhausted {
                "pending"
            } else {
                "failed"
            };
            let next: Option<String> = (status == "pending").then(|| next_attempt(d.attempts + 1, sent.retry_after.as_deref()));
            conn.execute_op(
                "UPDATE _basedb.webhook_delivery
                    SET status = $2, response_code = $3::int::smallint, error_code = $4,
                        delivered_at = CASE WHEN $2 = 'delivered' THEN clock_timestamp() END,
                        next_attempt_at = $5::text::timestamptz
                  WHERE id = $1::text::uuid",
                &[&d.id, &status, &sent.response_code, &sent.error_code, &next],
                SqlOp::Update,
            )
            .await?;
        }
        if !sent.delivered {
            let failures: i64 = conn
                .first(
                    "SELECT count(*)::int8 FROM (
                       SELECT status FROM _basedb.webhook_delivery
                        WHERE webhook_id = $1::text::uuid AND status IN ('delivered', 'failed')
                        ORDER BY created_at DESC LIMIT $2) last
                      WHERE status = 'failed'",
                    &[&webhook_id, &FAILURES_BEFORE_DISABLE],
                )
                .await?
                .map(|r| r.get(0))
                .unwrap_or(0);
            if failures >= FAILURES_BEFORE_DISABLE {
                conn.execute_op(
                    "UPDATE _basedb.webhook SET is_active = false, disabled_reason = 'failures', updated_at = clock_timestamp()
                      WHERE id = $1::text::uuid",
                    &[&webhook_id],
                    SqlOp::Update,
                )
                .await?;
            }
        }
    }
    Ok(due.len())
}

/// The sender: a pass every two seconds, never two at once.
pub fn start_dispatch(st: Shared) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(crate::engine::INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            ticker.tick().await;
            if let Err(e) = dispatch_webhooks(&st).await {
                eprintln!("envoi des webhooks : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signs_as_node() {
        // createHmac('sha256', 'whsec_test').update('1700000000.{"events":[]}').digest('hex')
        assert_eq!(signature("whsec_test", 1_700_000_000, r#"{"events":[]}"#), "t=1700000000,v1=4f6f9b7a41398ad124e52a1320534f978e522923f3f2b2724e31d7a9dbf78a7f");
    }

    #[test]
    fn backs_off_on_the_ladder() {
        for _ in 0..50 {
            let at = DateTime::parse_from_rfc3339(&next_attempt(1, None)).unwrap();
            let s = (at.with_timezone(&Utc) - Utc::now()).num_milliseconds() as f64 / 1000.0;
            assert!((7.9..=12.1).contains(&s), "{s}");
        }
        let at = DateTime::parse_from_rfc3339(&next_attempt(1, Some("100"))).unwrap();
        assert!((at.with_timezone(&Utc) - Utc::now()).num_seconds() >= 98);
    }
}
