//! The native read path over the demo base: lists, filters, column masks, errors, notifications.
//! Read-only — the demo data stays as it is.

use axum::http::StatusCode;
use basedb_base::testing::test_app;

const TENANT: &str = "t4z56fq";
const BASE: &str = "b_t4z56fq_demo_atelier_lumen";

#[tokio::test]
async fn records_are_read_filtered_and_masked() {
    let Some(app) = test_app(basedb_records::router).await else { return };
    let admin = app.login("admin@basedb.local", "developpement-basedb").await;
    let data = format!("/api/v1/{TENANT}/data/{BASE}");

    let (status, body) = app.get(&format!("{data}/clients?count=exact"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let full = body["data"].as_array().unwrap().clone();
    assert_eq!(body["meta"]["count"].as_i64(), Some(full.len() as i64));

    let (status, body) = app.get(&format!("{data}/clients?limit=2"), &admin).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
    assert!(body["meta"]["next_cursor"].is_string());
    assert!(body["meta"]["count"].is_null());

    let (status, body) = app.get(&format!("{data}/clients?filter=inconnu%20eq%201"), &admin).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    let (status, body) = app.get(&format!("{data}/clients/pas-un-uuid"), &admin).await;
    assert!(status.is_client_error(), "{body}");

    let (status, body) = app.get(&format!("/api/v1/{TENANT}/me/notifications?after=x"), &admin).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "CURSOR_INVALID");
    let (status, body) = app.get(&format!("/api/v1/{TENANT}/me/notifications"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body["meta"]["unread"].is_number());

    // The reader sees clients through a column mask, and nothing of the other tables.
    let lecteur = app.login("lecteur@basedb.local", "Granit-Ocean-7-Plume").await;
    let (status, body) = app.get(&format!("{data}/clients"), &lecteur).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let seen = body["data"][0].as_object().unwrap().len();
    assert!(seen < full[0].as_object().unwrap().len(), "le masque de colonnes s'applique");
    let (status, _) = app.get(&format!("{data}/factures"), &lecteur).await;
    assert!(status.is_client_error());
}
