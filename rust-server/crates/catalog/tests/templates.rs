//! The template routes, against the development database: the gallery, an import and its
//! removal, and the refusals of `POST admin/bases` with `template`.

use axum::http::StatusCode;
use basedb_base::testing::test_app;
use serde_json::json;

const TENANT: &str = "t4z56fq";

#[tokio::test]
async fn templates_gallery_import_and_refusals() {
    let Some(app) = test_app(basedb_catalog::router).await else { return };
    let admin = app.login("admin@basedb.local", "developpement-basedb").await;

    let (status, body) = app.get(&format!("/api/v1/{TENANT}/meta/templates"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let keys: Vec<&str> = body["data"].as_array().unwrap().iter().filter_map(|t| t["key"].as_str()).collect();
    assert!(keys.contains(&"inventaire"), "{keys:?}");
    assert!(body["meta"].get("site").is_some());

    let (status, body) = app.get(&format!("/api/v1/{TENANT}/meta/templates/inventaire"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["meta"]["source"], "bundled");

    let key = format!("test-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let template = json!({
        "format": 1, "key": key, "label": "Essai", "base": { "label": "Essai" },
        "tables": [{ "key": "t", "label": "Choses", "fields": [{ "label": "Nom", "kind": "short_text" }] }],
    });
    let (status, body) = app.post(&format!("/api/v1/{TENANT}/admin/templates"), &template, &admin).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["data"]["source"], "instance");
    assert_eq!(body["data"]["counts"]["fields"], 1);
    let (status, body) = app.get(&format!("/api/v1/{TENANT}/meta/templates/{key}"), &admin).await;
    assert_eq!((status, &body["meta"]["source"]), (StatusCode::OK, &json!("instance")), "{body}");
    assert_eq!(app.delete(&format!("/api/v1/{TENANT}/admin/templates/{key}"), &admin).await.0, StatusCode::NO_CONTENT);
    let (status, body) = app.delete(&format!("/api/v1/{TENANT}/admin/templates/{key}"), &admin).await;
    assert_eq!((status, &body["code"]), (StatusCode::NOT_FOUND, &json!("RESOURCE_NOT_FOUND")));

    let bases = format!("/api/v1/{TENANT}/admin/bases");
    let (status, body) = app.post(&bases, &json!({ "template": null }), &admin).await;
    assert_eq!((status, &body["details"]["field"]), (StatusCode::BAD_REQUEST, &json!("template")));
    let (status, body) = app.post(&bases, &json!({ "template": "inventaire", "rows": "oui" }), &admin).await;
    assert_eq!((status, &body["details"]["field"]), (StatusCode::BAD_REQUEST, &json!("rows")));
    let (status, body) = app.post(&bases, &json!({ "template": {} }), &admin).await;
    assert_eq!((status, &body["code"]), (StatusCode::UNPROCESSABLE_ENTITY, &json!("TEMPLATE_INVALID")));
    let (status, body) = app.post(&bases, &json!({ "template": "inconnu" }), &admin).await;
    assert_eq!((status, &body["code"]), (StatusCode::NOT_FOUND, &json!("RESOURCE_NOT_FOUND")));

}
