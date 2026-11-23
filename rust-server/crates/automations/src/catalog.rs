//! Saving and reading automations (`listAutomations`, `createAutomation`, …, `catalog.ts`).

use crate::defs::*;
use crate::validate::{checked_definition, invalid, Definition};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_base;
use basedb_base::time::{b64url, random_bytes};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::Shared;
use basedb_catalog::targets::TargetPolicy;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn key(st: &Shared) -> Option<String> {
    st.instance_key().ok().map(str::to_string)
}

/// `requireAutomation`: absent and foreign read the same.
pub async fn require_automation<E: Exec + Sync>(exec: &E, base_id: &str, id: &str) -> Result<Automation, AppError> {
    match load_automation(exec, id).await? {
        Some(a) if a.base_id == base_id => Ok(a),
        _ => Err(AppError::new("RESOURCE_NOT_FOUND").with("automation", json!(id))),
    }
}

pub async fn list_automations(st: &Shared, ctx: &RequestContext, base_id: &str) -> Result<Vec<Automation>, AppError> {
    let k = key(st);
    let (k, b) = (&k, base_id);
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, b).await?;
        let rows = tx.rows(&format!("SELECT {COLUMNS} {FROM} WHERE a.base_id = $1::text::uuid AND a.deleted_at IS NULL ORDER BY a.created_at"), &[&b]).await?;
        Ok(rows.iter().map(|r| shaped(r).reveal(k.as_deref())).collect())
    })
    .await
}

/// `checkAutomationDraft`: checked as a save would, nothing written nor sealed — what the
/// copilot proposes goes through here. An AI step is checked with the `ai` crate's hook.
pub async fn check_automation_draft(st: &Shared, ctx: &RequestContext, base_id: &str, input: &Value) -> Result<Definition, AppError> {
    let targets = TargetPolicy::from_config(&st.cfg);
    let (t, b) = (&targets, base_id);
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, b).await?;
        checked_definition(&tx, ctx, b, input, None, t, None, &st.cfg).await
    })
    .await
}

/// `newHook`: a new secret address, sealed and hashed.
fn new_hook(st: &Shared) -> Result<(String, Vec<u8>), AppError> {
    let Some(k) = key(st) else { return Err(invalid("trigger", "secret_impossible", None)) };
    let secret = b64url(&random_bytes(24));
    let sealed = basedb_admin::sealing::seal(&k, HOOK_SECRET, &secret);
    Ok((sealed, Sha256::digest(secret.as_bytes()).to_vec()))
}

/// `storedTrigger`.
fn stored_trigger(d: &Definition) -> Value {
    json!({ "fields": d.fields, "schedule": d.schedule, "date": d.date })
}

/// `nextDueOf`.
fn next_due_of(d: &Definition, now_ms: i64) -> Option<String> {
    if !d.schedule.is_null() {
        return Some(iso(next_run_of(&d.schedule, now_ms)));
    }
    (d.kind == "date_reached").then(|| iso(now_ms))
}

pub async fn create_automation(st: &Shared, ctx: &RequestContext, base_id: &str, input: &Value) -> Result<Automation, AppError> {
    let targets = TargetPolicy::from_config(&st.cfg);
    let k = key(st);
    let (t, b, k) = (&targets, base_id, &k);
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, b).await?;
        let d = checked_definition(&tx, ctx, b, input, None, t, k.clone(), &st.cfg).await?;
        let hook = if d.kind == "webhook" { Some(new_hook(st)?) } else { None };
        let now = ctx.timestamp.timestamp_millis();
        let next = next_due_of(&d, now);
        let scanned = (d.kind == "date_reached").then(|| iso(now));
        let actions = Value::Array(d.actions.clone());
        let trigger = stored_trigger(&d);
        let (sealed, hash) = match &hook {
            Some((s, h)) => (Some(s.clone()), Some(h.clone())),
            None => (None, None),
        };
        let row = tx
            .query_op(
                "INSERT INTO _basedb.automation
                   (tenant_id, base_id, label, description, is_enabled, trigger_kind, table_id, trigger,
                    condition, actions, owner_id, next_run_at, created_by, hook_sealed, hook_hash,
                    scanned_until)
                 SELECT b.tenant_id, b.id, $2, $3, $4, $5, $6::text::uuid, $7::jsonb, $8, $9::jsonb, $10::text::uuid,
                        $11::text::timestamptz, $10::text::uuid, $12, $13, $14::text::timestamptz
                   FROM _basedb.base b WHERE b.id = $1::text::uuid
                 RETURNING id::text",
                &[&b, &d.label, &d.description, &d.enabled, &d.kind, &d.table, &trigger, &d.condition, &actions, &ctx.actor.id, &next, &sealed, &hash, &scanned],
                SqlOp::Insert,
            )
            .await?;
        let id: String = row.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("automation not inserted"))?;
        let created = load_automation(&tx, &id).await?.ok_or_else(|| AppError::internal("automation not found"))?;
        Ok(created.reveal(k.as_deref()))
    })
    .await
}

/// `stopRuns`.
async fn stop_runs<E: Exec + Sync>(exec: &E, id: &str, reason: &str) -> Result<(), AppError> {
    exec.execute_op(
        "UPDATE _basedb.automation_run SET status = 'skipped', reason = $2, resume_at = NULL,
                finished_at = pg_catalog.clock_timestamp()
          WHERE automation_id = $1::text::uuid AND status IN ('queued', 'waiting')",
        &[&id, &reason],
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

pub async fn update_automation(st: &Shared, ctx: &RequestContext, base_id: &str, id: &str, input: &Value) -> Result<Automation, AppError> {
    let targets = TargetPolicy::from_config(&st.cfg);
    let k = key(st);
    let (t, b, k) = (&targets, base_id, &k);
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, b).await?;
        let current = require_automation(&tx, b, id).await?;
        let d = checked_definition(&tx, ctx, b, input, Some(&current), t, k.clone(), &st.cfg).await?;
        // None: no address; Some(None): kept; Some(Some(new)).
        let hook = if d.kind != "webhook" {
            None
        } else if current.hook_sealed.is_none() || input.get("regenerate_hook") == Some(&json!(true)) {
            Some(Some(new_hook(st)?))
        } else {
            Some(None)
        };
        // `JSON.stringify` of both: the stored one in `jsonb`'s order of keys, the new one in
        // the order Node builds it — never equal for a date (a quirk kept: a save always
        // searches from now on).
        let same_dates = current.trigger_kind == "date_reached"
            && d.kind == "date_reached"
            && current.table == d.table
            && serde_json::to_string(&current.date).ok() == serde_json::to_string(&d.date).ok()
            && (current.enabled || !d.enabled);
        let now = ctx.timestamp.timestamp_millis();
        let next = next_due_of(&d, now);
        let scanned = (d.kind == "date_reached").then(|| iso(now));
        let kept = matches!(hook, Some(None));
        let (sealed, hash) = match &hook {
            Some(Some((s, h))) => (Some(s.clone()), Some(h.clone())),
            _ => (None, None),
        };
        let actions = Value::Array(d.actions.clone());
        let trigger = stored_trigger(&d);
        tx.execute_op(
            "UPDATE _basedb.automation
                SET label = $2, description = $3, is_enabled = $4, trigger_kind = $5, table_id = $6::text::uuid,
                    trigger = $7::jsonb, condition = $8, actions = $9::jsonb, owner_id = $10::text::uuid,
                    next_run_at = CASE WHEN $14 THEN next_run_at ELSE $11::text::timestamptz END,
                    hook_sealed = CASE WHEN $12 THEN hook_sealed ELSE $13 END,
                    hook_hash = CASE WHEN $12 THEN hook_hash ELSE $15::bytea END,
                    scanned_until = CASE WHEN $14 THEN scanned_until ELSE $16::text::timestamptz END,
                    updated_at = pg_catalog.clock_timestamp()
              WHERE id = $1::text::uuid",
            &[&id, &d.label, &d.description, &d.enabled, &d.kind, &d.table, &trigger, &d.condition, &actions, &ctx.actor.id, &next, &kept, &sealed, &same_dates, &hash, &scanned],
            SqlOp::Update,
        )
        .await?;
        if current.trigger_kind == "record_matches" && (d.kind != "record_matches" || current.condition != d.condition || current.table != d.table) {
            tx.execute_op("DELETE FROM _basedb.automation_match WHERE automation_id = $1::text::uuid", &[&id], SqlOp::Delete).await?;
        }
        if !d.enabled {
            stop_runs(&tx, id, "desactivee").await?;
        }
        let updated = load_automation(&tx, id).await?.ok_or_else(|| AppError::internal("automation not found"))?;
        Ok(updated.reveal(k.as_deref()))
    })
    .await
}

pub async fn delete_automation(st: &Shared, ctx: &RequestContext, base_id: &str, id: &str) -> Result<(), AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        require_automation(&tx, base_id, id).await?;
        tx.execute_op("UPDATE _basedb.automation SET deleted_at = pg_catalog.clock_timestamp() WHERE id = $1::text::uuid", &[&id], SqlOp::Update).await?;
        stop_runs(&tx, id, "supprimee").await
    })
    .await
}

/// `listAutomationRuns`, as `serializeRun` shows them.
pub async fn list_runs(st: &Shared, ctx: &RequestContext, base_id: &str, id: &str) -> Result<Vec<Value>, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        require_automation(&tx, base_id, id).await?;
        let rows = tx
            .rows(
                "SELECT id::text, trigger_kind, record_id::text, status, resume_at, reason,
                        error_code, steps, queued_at::text, started_at::text, finished_at::text
                   FROM _basedb.automation_run WHERE automation_id = $1::text::uuid
                  ORDER BY queued_at DESC LIMIT 50",
                &[&id],
            )
            .await?;
        Ok(rows
            .iter()
            .map(|r| {
                let resume: Option<chrono::DateTime<chrono::Utc>> = r.get(4);
                json!({
                    "id": r.get::<_, String>(0),
                    "trigger": r.get::<_, String>(1),
                    "record_id": r.get::<_, Option<String>>(2),
                    "status": r.get::<_, String>(3),
                    "resume_at": resume.map(|t| iso(t.timestamp_millis())),
                    "reason": r.get::<_, Option<String>>(5),
                    "error_code": r.get::<_, Option<String>>(6),
                    "steps": r.get::<_, Option<Value>>(7).unwrap_or(Value::Null),
                    "queued_at": r.get::<_, String>(8),
                    "started_at": r.get::<_, Option<String>>(9),
                    "finished_at": r.get::<_, Option<String>>(10),
                })
            })
            .collect())
    })
    .await
}
