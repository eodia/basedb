//! Runs asked for from outside the worker: a test or a Button field (`requestRun`), a table's
//! button (`pressTableButton`), a call to an automation's own address (`receiveHook`).

use crate::defs::*;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::{require_on_base, require_on_table};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::Shared;
use basedb_records::{list_records, ListOptions};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

/// Runs an automation may start in an hour (`RUNS_PER_HOUR`).
pub const RUNS_PER_HOUR: i64 = 100;
/// The rows a table's button may start at once (`MAX_PRESSED_ROWS`).
pub const MAX_PRESSED_ROWS: i64 = RUNS_PER_HOUR;
/// What an incoming webhook may carry (`HOOK_BYTES`).
pub const HOOK_BYTES: usize = 65_536;

/// `usedThisHour`.
pub async fn used_this_hour<E: Exec + Sync>(exec: &E, automation_id: &str) -> Result<i64, AppError> {
    let row = exec
        .first(
            "SELECT count(*)::int AS n FROM _basedb.automation_run
              WHERE automation_id = $1::text::uuid AND queued_at > pg_catalog.clock_timestamp() - interval '1 hour'
                AND reason IS DISTINCT FROM 'debit'",
            &[&automation_id],
        )
        .await?;
    Ok(row.map(|r| r.get::<_, i32>(0) as i64).unwrap_or(0))
}

/// `requestRun`: a run for one row â€” a button clicked (reading the row is enough), or a
/// test from the screen (building the base is required).
pub async fn request_run(st: &Shared, ctx: &RequestContext, instance_key: &str, automation_id: &str, record_id: Option<&str>) -> Result<String, AppError> {
    let conn = st.pools.get(PoolName::Catalog).await?;
    let disabled = || AppError::new("AUTOMATION_DISABLED").with("automation", json!(automation_id));
    // `loadAutomation` on a malformed id: PostgreSQL's refusal, as Node's.
    let Some(automation) = load_automation(&conn, automation_id).await? else { return Err(disabled()) };
    let table = automation.table.clone();
    let by_button = automation.trigger_kind == "button";
    if !by_button {
        require_on_base(&conn, ctx, Action::ManageSchema, &automation.base_id).await?;
    }
    drop(conn);
    if !automation.enabled {
        return Err(AppError::new("AUTOMATION_DISABLED").with("automation", json!(automation.id)));
    }
    if let Some(table) = &table {
        let Some(record) = record_id.filter(|r| loose_uuid(r)) else {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("record")).with("reason", json!("ligne_requise")));
        };
        let page = list_records(
            &st.pools,
            ctx,
            instance_key,
            &ListOptions { table_id: table.clone(), filter: Some(format!("_id eq \"{}\"", record.to_lowercase())), limit: Some(1.0), ..Default::default() },
        )
        .await?;
        if page.rows.is_empty() {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record)));
        }
    }
    let conn = st.pools.get(PoolName::Catalog).await?;
    let record: Option<&str> = if table.is_none() { None } else { record_id };
    let row = conn
        .query_op(
            "INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id)
             VALUES ($1::text::uuid, $2, $3::text::uuid) RETURNING id::text",
            &[&automation.id, &if by_button { "button" } else { "test" }, &record],
            SqlOp::Insert,
        )
        .await?;
    Ok(row.first().map(|r| r.get(0)).unwrap_or_default())
}

/// `receiveHook`: an unknown secret and a switched-off automation read the same.
pub async fn receive_hook(st: &Shared, secret: &str, payload: &Value) -> Result<String, AppError> {
    let unknown = || AppError::new("RESOURCE_NOT_FOUND").with("reason", json!("adresse_inconnue"));
    let well_formed = (16..=64).contains(&secret.len()) && secret.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
    if !well_formed {
        return Err(unknown());
    }
    let hash = Sha256::digest(secret.as_bytes()).to_vec();
    let conn = st.pools.get(PoolName::Catalog).await?;
    let found = conn
        .first(
            "SELECT id::text FROM _basedb.automation
              WHERE hook_hash = $1 AND trigger_kind = 'webhook' AND deleted_at IS NULL AND is_enabled",
            &[&hash],
        )
        .await?;
    let Some(found) = found else { return Err(unknown()) };
    let id: String = found.get(0);
    if used_this_hour(&conn, &id).await? >= RUNS_PER_HOUR {
        return Err(AppError::new("RATE_LIMIT_EXCEEDED").with("reason", json!("debit")));
    }
    let payload = if payload.is_null() { json!({}) } else { payload.clone() };
    let row = conn
        .query_op(
            "INSERT INTO _basedb.automation_run (automation_id, trigger_kind, payload)
             VALUES ($1::text::uuid, 'webhook', $2::jsonb) RETURNING id::text",
            &[&id, &payload],
            SqlOp::Insert,
        )
        .await?;
    Ok(row.first().map(|r| r.get(0)).unwrap_or_default())
}

/// What a hook's body becomes (`app.ts`): blank â†’ `{}`, a form â†’ an object, JSON as sent,
/// any other text â†’ `{texte}`.
pub fn hook_payload(content_type: &str, text: &str) -> Value {
    if js_trim(text).is_empty() {
        return json!({});
    }
    if content_type.contains("application/x-www-form-urlencoded") {
        let mut m = serde_json::Map::new();
        for (k, v) in form_urlencoded::parse(text.as_bytes()) {
            m.insert(k.into_owned(), json!(v.into_owned()));
        }
        return Value::Object(m);
    }
    serde_json::from_str(text).unwrap_or_else(|_| json!({ "texte": text }))
}

fn refuse_rows(reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("reason", json!(reason))
}

/// `selectionFilter`: the ticked rows as a filter, so that the list drops what the person
/// cannot read.
fn selection_filter(records: Option<&[String]>) -> Result<String, AppError> {
    let mut ids: Vec<&String> = Vec::new();
    for r in records.unwrap_or(&[]) {
        if !ids.contains(&r) {
            ids.push(r);
        }
    }
    if ids.is_empty() {
        return Err(refuse_rows("aucune_ligne"));
    }
    if ids.len() as i64 > MAX_PRESSED_ROWS {
        return Err(refuse_rows("trop_de_lignes").with("maximum", json!(MAX_PRESSED_ROWS)));
    }
    if !ids.iter().all(|id| uuid_re().is_match(id)) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("records")).with("reason", json!("identifiant_invalide")));
    }
    Ok(format!("_id in [{}]", ids.iter().map(|id| format!("\"{}\"", id.to_lowercase())).collect::<Vec<_>>().join(", ")))
}

/// `pressTableButton`: every row the button acts on, or none â€” asked for in one call.
pub async fn press_button(st: &Shared, ctx: &RequestContext, instance_key: &str, table_id: &str, button_id: &str, records: Option<Vec<String>>, filter: Option<String>) -> Result<i64, AppError> {
    let (t, b) = (table_id, button_id);
    let (button, enabled) = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_table(&tx, ctx, Action::Read, t).await?;
        let found = basedb_catalog::buttons::read_one(&tx, b, Some(t)).await?;
        let enabled = match &found.automation {
            None => false,
            Some((id, _)) => tx
                .first("SELECT is_enabled AS enabled FROM _basedb.automation WHERE id = $1::text::uuid AND deleted_at IS NULL", &[id])
                .await?
                .is_some_and(|r| r.get::<_, bool>(0)),
        };
        Ok((found, enabled))
    })
    .await?;
    let automation = match (&button.action[..], &button.automation) {
        ("automation", Some((id, _))) => id.clone(),
        _ => return Err(refuse_rows("bouton_sans_automatisation")),
    };
    if !enabled {
        return Err(AppError::new("AUTOMATION_DISABLED").with("automation", json!(automation)));
    }
    let rows: Vec<Option<String>> = if button.target == "none" {
        vec![None]
    } else {
        let filter = if button.target == "selection" { selection_filter(records.as_deref())? } else { js_trim(filter.as_deref().unwrap_or("")).to_string() };
        let page = list_records(
            &st.pools,
            ctx,
            instance_key,
            &ListOptions {
                table_id: table_id.to_string(),
                filter: (!filter.is_empty()).then_some(filter),
                limit: Some((MAX_PRESSED_ROWS + 1) as f64),
                select: Some(vec!["_id".into()]),
                ..Default::default()
            },
        )
        .await?;
        if page.rows.len() as i64 > MAX_PRESSED_ROWS || page.has_next_page {
            return Err(refuse_rows("trop_de_lignes").with("maximum", json!(MAX_PRESSED_ROWS)));
        }
        let ids: Vec<Option<String>> = page.rows.iter().map(|r| Some(js_string(r.get("_id").unwrap_or(&Value::Null)))).collect();
        if ids.is_empty() {
            return Err(refuse_rows("aucune_ligne"));
        }
        ids
    };
    let conn = st.pools.get(PoolName::Catalog).await?;
    let left = RUNS_PER_HOUR - used_this_hour(&conn, &automation).await?;
    if rows.len() as i64 > left {
        return Err(AppError::new("RATE_LIMIT_EXCEEDED").with("reason", json!("debit")).with("remaining", json!(left.max(0))));
    }
    conn.execute_op(
        "INSERT INTO _basedb.automation_run (automation_id, trigger_kind, record_id)
         SELECT $1::text::uuid, 'button', r::uuid FROM unnest($2::text[]) AS r",
        &[&automation, &rows],
        SqlOp::Insert,
    )
    .await?;
    Ok(rows.len() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hook_payloads() {
        assert_eq!(hook_payload("application/json", "  "), json!({}));
        assert_eq!(hook_payload("application/x-www-form-urlencoded; charset=utf-8", "a=1&b=x+y&a=2"), json!({ "a": "2", "b": "x y" }));
        assert_eq!(hook_payload("", "[1,2]"), json!([1, 2]));
        assert_eq!(hook_payload("text/plain", "bonjour"), json!({ "texte": "bonjour" }));
    }

    #[test]
    fn selections() {
        assert_eq!(selection_filter(None).unwrap_err().details["reason"], json!("aucune_ligne"));
        let id = "0F8D3E3A-1B2C-4D5E-8F90-123456789ABC".to_string();
        assert_eq!(selection_filter(Some(&[id.clone(), id])).unwrap(), "_id in [\"0f8d3e3a-1b2c-4d5e-8f90-123456789abc\"]");
        assert_eq!(selection_filter(Some(&["x".into()])).unwrap_err().details["field"], json!("records"));
    }
}
