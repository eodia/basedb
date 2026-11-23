//! The native automation routes over the demo base: validation, rights, CRUD, runs,
//! webhooks and proposals. What is created is deleted at the end.

use axum::http::{Method, StatusCode};
use basedb_base::testing::test_app;
use serde_json::json;

const TENANT: &str = "t4z56fq";
const BASE: &str = "b_t4z56fq_demo_atelier_lumen";

#[tokio::test]
async fn automations_are_checked_saved_and_guarded() {
    let Some(app) = test_app(|st| basedb_records::router(st).merge(basedb_automations::router(st))).await else { return };
    let admin = app.login("admin@basedb.local", "developpement-basedb").await;
    let lecteur = app.login("lecteur@basedb.local", "Granit-Ocean-7-Plume").await;
    let path = format!("/api/v1/{TENANT}/admin/bases/{BASE}/automations");

    let (status, body) = app.get(&path, &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body["data"].is_array());
    let (status, _) = app.get(&path, &lecteur).await;
    assert!(status.is_client_error());

    // A definition naming what does not exist is refused when saved.
    let (status, body) = app
        .post(&path, &json!({ "label": "Cassée", "trigger": { "kind": "record_created", "table": "clients" }, "actions": [{ "kind": "update_record", "values": { "absent": 1 } }] }), &admin)
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(body["details"]["reason"], "champ_inconnu");
    assert_eq!(body["details"]["detail"], "absent");

    let draft = json!({
        "label": "Test Rust — désactivée",
        "enabled": false,
        "trigger": { "kind": "record_updated", "table": "clients", "fields": ["statut"] },
        "condition": "statut eq \"actif\"",
        "actions": [{ "kind": "update_record", "values": { "ville": "{{ville}}" } }],
    });
    let (status, _) = app.post(&path, &draft, &lecteur).await;
    assert!(status.is_client_error());
    let (status, body) = app.post(&path, &draft, &admin).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    let id = body["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(body["data"]["enabled"], false);
    assert_eq!(body["data"]["trigger"]["fields"], json!(["statut"]));

    let (status, body) = app.call(Method::PATCH, &format!("{path}/{id}"), Some(&json!({ "label": "Test Rust — renommée" })), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["label"], "Test Rust — renommée");
    let (status, body) = app.get(&format!("{path}/{id}/runs"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"], json!([]));

    let (status, _) = app.delete(&format!("{path}/{id}"), &admin).await;
    assert!(status.is_success());

    let hooks = format!("/api/v1/{TENANT}/admin/webhooks");
    let (status, body) = app.get(&format!("{hooks}?base={BASE}"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = app.get(&hooks, &admin).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    let (status, body) = app.post(&hooks, &json!({ "url": "http://127.0.0.1:9/x", "events": ["record.created"] }), &admin).await;
    assert!(status.is_client_error(), "une adresse locale est refusée : {body}");

    let (status, body) = app.get(&format!("/api/v1/{TENANT}/admin/proposals?base={BASE}"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, _) = app.post(&format!("/api/v1/{TENANT}/admin/proposals/pas-un-uuid/approve"), &json!({}), &admin).await;
    assert!(status.is_client_error());
}
