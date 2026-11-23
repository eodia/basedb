//! The native AI and documents routes over the demo base, without a provider: schedule preview,
//! attachments, a record's fiche as PDF, and the refusals that come before any model call.
//! Read-only — the demo data stays as it is.

use axum::http::{Method, StatusCode};
use basedb_base::testing::test_app;
use serde_json::{json, Value};

const TENANT: &str = "t4z56fq";
const BASE: &str = "b_t4z56fq_demo_atelier_lumen";

#[tokio::test]
async fn ai_and_documents_answer_natively() {
    let Some(app) = test_app(|st| basedb_catalog::router(st).merge(basedb_records::router(st)).merge(basedb_ai::router(st))).await else { return };
    let admin = app.login("admin@basedb.local", "developpement-basedb").await;
    let ai = format!("/api/v1/{TENANT}/ai");
    let data = format!("/api/v1/{TENANT}/data/{BASE}/clients");

    // The schedule preview: five runs, in UTC, at the zone's 9 o'clock.
    let (status, body) = app.post(&format!("{ai}/schedule/preview"), &json!({ "cron": "0 9 * * 1", "timezone": "Europe/Paris" }), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let runs = body["data"]["runs"].as_array().unwrap();
    assert_eq!(runs.len(), 5);
    assert!(runs.iter().all(|r| r.as_str().unwrap().ends_with(":00:00.000Z")));
    let (status, body) = app.post(&format!("{ai}/schedule/preview"), &json!({ "cron": "* * * * *" }), &admin).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["details"]["reason"], "frequence_trop_haute");

    // An attachment is read from its bytes; the name only names it.
    let (status, body) = app.post(&format!("{ai}/attachments?name=%20notes.json%20"), &json!({ "a": 1 }), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["name"], "notes.json");
    assert_eq!(body["data"]["kind"], "text");
    assert_eq!(body["data"]["text"], "{\"a\":1}");

    // The copilot refuses a conversation without messages before calling anyone.
    let (status, body) = app.post(&format!("{ai}/bases/{BASE}/copilot"), &json!({ "messages": [] }), &admin).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(body["details"]["field"], "messages");

    // An ordinary field has no AI state.
    let (status, meta) = app.get(&format!("/api/v1/{TENANT}/meta/bases/{BASE}"), &admin).await;
    assert_eq!(status, StatusCode::OK);
    let clients = meta["data"]["tables"].as_array().unwrap().iter().find(|t| t["name"] == "clients").unwrap();
    let field = clients["fields"].as_array().unwrap().iter().find(|f| f["system"] == false && f["kind"] == "short_text").unwrap()["name"].as_str().unwrap().to_string();
    let status_path = format!("/api/v1/{TENANT}/admin/bases/{BASE}/tables/clients/fields/{field}/ai");
    let (status, body) = app.get(&status_path, &admin).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(body["details"]["reason"], "pas_un_champ_ia");

    // A record's fiche: a PDF whose text carries the row.
    let (status, rows) = app.get(&format!("{data}?limit=1"), &admin).await;
    assert_eq!(status, StatusCode::OK);
    let row = &rows["data"][0];
    let id = row["_id"].as_str().unwrap();
    let (status, headers, bytes) = app.raw(Method::GET, &format!("{data}/{id}/documents/fiche.pdf?download=1"), None, &admin).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "application/pdf");
    assert!(headers["content-disposition"].to_str().unwrap().starts_with("attachment;"));
    let read = basedb_ai::attachments::extract_attachment("fiche.pdf", &bytes).unwrap();
    assert_eq!(read.kind, "pdf");
    if let Some(Value::String(shown)) = row.get(&field) {
        let squeeze = |s: &str| s.split_whitespace().collect::<String>();
        assert!(squeeze(&read.text).contains(&squeeze(shown)), "le champ {field} figure dans la fiche");
    }
    let (status, body) = app.get(&format!("{data}/{id}/documents/00000000-0000-0000-0000-000000000000"), &admin).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    let (status, body) = app.get(&format!("{data}/documents"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body["data"].is_array());

    // A template is checked before it is stored.
    let templates = format!("/api/v1/{TENANT}/admin/bases/{BASE}/tables/clients/documents");
    let (status, body) = app.post(&templates, &json!({ "label": "X", "spec": { "blocks": [] } }), &admin).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(body["details"]["reason"], "aucun_bloc");

    // The reader neither sets an AI field nor writes a template.
    let lecteur = app.login("lecteur@basedb.local", "Granit-Ocean-7-Plume").await;
    let (status, _) = app.call(Method::PUT, &status_path, Some(&json!({ "prompt": "x", "refresh": { "mode": "if_empty" }, "consent": true })), &lecteur).await;
    assert!(status.is_client_error());
    let (status, _) = app.post(&templates, &json!({ "label": "X", "spec": { "blocks": [{ "kind": "fields", "fields": [field] }] } }), &lecteur).await;
    assert!(status.is_client_error());
}
