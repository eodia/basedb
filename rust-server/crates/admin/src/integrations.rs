//! `integrations/slack.ts`: a base's connections to Slack channels, by incoming webhook.

use crate::common::{fields, js_slice, js_trim, strict_json};
use crate::sealing::{seal, unseal};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_base;
use basedb_base::tx::{with_transaction, TxOptions};
use basedb_base::Shared;
use serde_json::{json, Value};
use std::time::Duration;

const PURPOSE: &str = "integration/slack";

/// `checkedSlackUrl`: an incoming webhook of Slack, or a refusal. `any_host` (the relaxed
/// webhook policy of development) takes any http(s) address.
pub fn checked_slack_url(raw: &Value, any_host: bool) -> Result<String, AppError> {
    let text = raw.as_str().map(js_trim).unwrap_or("");
    let url = url::Url::parse(text).ok();
    if let Some(u) = url.as_ref() {
        if any_host && (u.scheme() == "http" || u.scheme() == "https") {
            return Ok(u.to_string());
        }
    }
    let ok = url.as_ref().is_some_and(|u| {
        u.scheme() == "https"
            && u.host_str() == Some("hooks.slack.com")
            && u.username().is_empty()
            && u.password().is_none()
            && ["/services/", "/workflows/", "/triggers/"].iter().any(|p| u.path().starts_with(p))
    });
    match url {
        Some(u) if ok => Ok(u.to_string()),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!("url")).with("reason", json!("webhook_slack_attendu"))),
    }
}

/// `…/` and the last four characters of the address.
pub fn hint_of(url: &str) -> String {
    let bare = url.trim_end_matches('/');
    let tail: Vec<u16> = bare.encode_utf16().collect();
    let start = tail.len().saturating_sub(4);
    format!("…/{}", String::from_utf16_lossy(&tail[start..]))
}

/// `postToSlack`: any answer but 2xx is a failure said by its status.
pub async fn post_to_slack(url: &str, text: &str) -> Result<u16, AppError> {
    let client = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(10)).build().map_err(|e| AppError::internal(e.to_string()))?;
    let sent = client.post(url).header("content-type", "application/json").header("user-agent", "basedb/1").body(json!({ "text": text }).to_string()).send().await;
    let status = match sent {
        Ok(r) => r.status().as_u16(),
        Err(_) => return Err(AppError::new("AUTOMATION_WEBHOOK_FAILED").with("reason", json!("injoignable"))),
    };
    if !(200..300).contains(&status) {
        return Err(AppError::new("AUTOMATION_WEBHOOK_FAILED").with("reason", json!(format!("http_{status}"))));
    }
    Ok(status)
}

/// `slackUrlOf`: the address of a connection of a base, opened for sending.
pub async fn slack_url_of<E: Exec + Sync>(exec: &E, instance_key: &str, base_id: &str, id: &str) -> Result<Option<String>, AppError> {
    let row = exec
        .first(
            "SELECT url_sealed FROM _basedb.integration
              WHERE id::text = $1 AND base_id = $2::text::uuid AND kind = 'slack' AND deleted_at IS NULL",
            &[&id, &base_id],
        )
        .await?;
    Ok(row.and_then(|r| unseal(instance_key, PURPOSE, r.get::<_, &str>(0))))
}

fn any_host(st: &Shared) -> bool {
    st.cfg.setting("BASEDB_WEBHOOK_DEV").as_deref() == Some("1")
}

pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base).await?;
    let (c, b) = (&ctx, &base_id);
    let list = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, c, Action::ManageSchema, b).await?;
        let rows = tx
            .rows(
                "SELECT id::text, label, url_hint, created_at::text FROM _basedb.integration
                  WHERE base_id = $1::text::uuid AND deleted_at IS NULL ORDER BY created_at",
                &[b],
            )
            .await?;
        Ok(rows
            .iter()
            .map(|r| json!({ "id": r.get::<_, String>(0), "kind": "slack", "label": r.get::<_, String>(1), "hint": r.get::<_, String>(2), "created_at": r.get::<_, String>(3) }))
            .collect::<Vec<Value>>())
    })
    .await?;
    Ok(json_ok(json!({ "data": list })))
}

pub async fn create(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base).await?;
    let body = fields(&body)?;
    let url = checked_slack_url(body.get("url").unwrap_or(&Value::Null), any_host(&st))?;
    let label = body.get("label").and_then(Value::as_str).map(|l| js_slice(js_trim(l), 255).to_string()).unwrap_or_default();
    if label.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label")).with("reason", json!("libelle_invalide")));
    }
    let hint = hint_of(&url);
    let sealed = seal(st.instance_key()?, PURPOSE, &url);
    let (c, b, l, h, s) = (&ctx, &base_id, &label, &hint, &sealed);
    let created = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_on_base(&tx, c, Action::ManageSchema, b).await?;
        let rows = tx
            .query_op(
                "INSERT INTO _basedb.integration (tenant_id, base_id, kind, label, url_sealed, url_hint, created_by)
                 SELECT b.tenant_id, b.id, 'slack', $2, $3, $4, $5::text::uuid FROM _basedb.base b WHERE b.id = $1::text::uuid
                 RETURNING id::text, created_at::text",
                &[b, l, s, h, &c.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let row = rows.first().ok_or_else(|| AppError::internal("intégration non créée"))?;
        Ok(json!({ "id": row.get::<_, String>(0), "kind": "slack", "label": l, "hint": h, "created_at": row.get::<_, String>(1) }))
    })
    .await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": created })))
}

pub async fn remove(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, id)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base).await?;
    let (c, b, i) = (&ctx, &base_id, &id);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_on_base(&tx, c, Action::ManageSchema, b).await?;
        let rows = tx
            .query_op(
                "UPDATE _basedb.integration SET deleted_at = pg_catalog.clock_timestamp()
                  WHERE id::text = $1 AND base_id = $2::text::uuid AND deleted_at IS NULL RETURNING id",
                &[i, b],
                SqlOp::Update,
            )
            .await?;
        if rows.is_empty() {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("integration", json!(i)));
        }
        Ok(())
    })
    .await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

pub async fn test(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, id)): Path<(String, String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = basedb_catalog::projection::resolve_base(&st.pools, &ctx, &base).await?;
    let key = st.instance_key()?.to_string();
    let (c, b, i, k) = (&ctx, &base_id, &id, &key);
    let (url, label) = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, c, Action::ManageSchema, b).await?;
        let row = tx
            .first("SELECT label FROM _basedb.integration WHERE id::text = $1 AND base_id = $2::text::uuid AND deleted_at IS NULL", &[i, b])
            .await?;
        let opened = slack_url_of(&tx, k, b, i).await?;
        match (row, opened) {
            (Some(r), Some(url)) => Ok((url, r.get::<_, String>(0))),
            _ => Err(AppError::new("RESOURCE_NOT_FOUND").with("integration", json!(i))),
        }
    })
    .await?;
    let status = post_to_slack(&url, &format!("Message d’essai de basedb : la connexion « {label} » fonctionne.")).await?;
    Ok(json_ok(json!({ "data": { "status": status } })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_only_slack_webhooks() {
        let ok = checked_slack_url(&json!("  https://hooks.slack.com/services/T000/B000/XXXX "), false).unwrap();
        assert_eq!(ok, "https://hooks.slack.com/services/T000/B000/XXXX");
        for bad in [json!("http://hooks.slack.com/services/x"), json!("https://evil.com/services/x"), json!("https://u:p@hooks.slack.com/services/x"), json!("https://hooks.slack.com/api/x"), json!(3), json!("pas une adresse")] {
            assert_eq!(checked_slack_url(&bad, false).unwrap_err().code, "REQUEST_INVALID", "{bad}");
        }
        assert_eq!(checked_slack_url(&json!("http://localhost:9000/x"), true).unwrap(), "http://localhost:9000/x");
        assert!(checked_slack_url(&json!("ftp://localhost/x"), true).is_err());
    }

    #[test]
    fn hints_the_end_of_the_address() {
        assert_eq!(hint_of("https://hooks.slack.com/services/T000/B000/XXXX/"), "…/XXXX");
        assert_eq!(hint_of("https://a.b/c"), "…/.b/c");
    }
}
