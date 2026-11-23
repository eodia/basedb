//! The AI fields' worker over a scratch base, against a model served here: an empty cell is
//! filled, an unusable answer and a row with nothing to read are passed over (then held back),
//! a cell already filled is left alone. The scratch base is deleted at the end.

use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use basedb_base::testing::test_app;
use serde_json::{json, Value};

const TENANT: &str = "t4z56fq";

/// The model: `{"value":"7"}`, or a value no number reads when the cell's notes ask for it.
async fn model(Json(body): Json<Value>) -> Json<Value> {
    let user = body["messages"].as_array().and_then(|m| m.iter().find(|m| m["role"] == "user")).and_then(|m| m["content"].as_str()).unwrap_or("").to_string();
    let value = if user.contains("[mock:bad]") { "pas un nombre" } else { "7" };
    Json(json!({
        "choices": [{ "index": 0, "finish_reason": "stop", "message": { "role": "assistant", "content": json!({ "value": value }).to_string() } }],
        "usage": { "prompt_tokens": 10, "completion_tokens": 2 },
    }))
}

#[tokio::test]
async fn the_worker_fills_empty_cells() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move { axum::serve(listener, Router::new().route("/v1/chat/completions", post(model))).await.unwrap() });
    std::env::set_var("BASEDB_AI_PROVIDER", "openai_compatible");
    std::env::set_var("BASEDB_AI_MODEL", "mock");
    std::env::set_var("BASEDB_AI_BASE_URL", format!("http://127.0.0.1:{port}/v1"));
    std::env::set_var("BASEDB_AI_FIELD_QUOTA", "100000");

    let Some(app) = test_app(|st| basedb_catalog::router(st).merge(basedb_records::router(st)).merge(basedb_ai::router(st))).await else { return };
    let admin = app.login("admin@basedb.local", "developpement-basedb").await;
    let label = format!("IA worker {}", uuid::Uuid::new_v4().simple());
    let (status, base) = app.post(&format!("/api/v1/{TENANT}/admin/bases"), &json!({ "label": label }), &admin).await;
    assert_eq!(status, StatusCode::CREATED, "{base}");
    let sb = base["data"]["name"].as_str().unwrap().to_string();

    let outcome = async {
        let fields = json!([{ "label": "Nom", "kind": "short_text" }, { "label": "Notes", "kind": "long_text" }, { "label": "Score", "kind": "number" }]);
        let (status, table) = app.post(&format!("/api/v1/{TENANT}/admin/bases/{sb}/tables"), &json!({ "label": "Fiches", "fields": fields }), &admin).await;
        assert!(status.is_success(), "{table}");
        let tc = table["data"]["name"].as_str().unwrap().to_string();
        let data = format!("/api/v1/{TENANT}/data/{sb}/{tc}");
        for values in [json!({ "nom": "A", "notes": "bien" }), json!({ "nom": "B", "notes": "[mock:bad] mal" }), json!({ "nom": "C" }), json!({ "nom": "D", "notes": "x", "score": 3 })] {
            let (status, body) = app.post(&data, &json!({ "values": values }), &admin).await;
            assert!(status.is_success(), "{body}");
        }
        let ai = format!("/api/v1/{TENANT}/admin/bases/{sb}/tables/{tc}/fields/score/ai");
        let (status, body) = app.call(axum::http::Method::PUT, &ai, Some(&json!({ "prompt": "Note {{Notes}}", "refresh": { "mode": "if_empty" }, "consent": true })), &admin).await;
        assert_eq!(status, StatusCode::OK, "{body}");

        let worker = basedb_ai::worker::Worker::new(20, 8);
        // Another worker (Node's) may hold the field's lease for an instant: a pass then skips it.
        let mut state = Value::Null;
        for _ in 0..5 {
            worker.pass(&app.st).await.unwrap();
            state = app.get(&ai, &admin).await.1;
            if !state["data"]["last_run_at"].is_null() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }
        assert_eq!(state["data"]["computed_count"], 1, "{state}");
        assert_eq!(state["data"]["last_error"], "AI_RESPONSE_UNUSABLE");
        let (_, rows) = app.get(&format!("{data}?sort=nom"), &admin).await;
        let scores: Vec<Value> = rows["data"].as_array().unwrap().iter().map(|r| r["score"].clone()).collect();
        assert_eq!(scores, [json!("7.0000000000"), Value::Null, Value::Null, json!("3.0000000000")], "{rows}");
        // Written by the kernel acting for itself.
        assert_eq!(rows["data"][0]["_updated_by"], "00000000-0000-0000-0000-000000000000");

        // The rows that failed wait: the next pass calls nobody for this field.
        let before = state["data"]["last_run_at"].clone();
        worker.pass(&app.st).await.unwrap();
        let (_, again) = app.get(&ai, &admin).await;
        assert_eq!(again["data"]["computed_count"], 1);
        assert_eq!(again["data"]["last_error"], "AI_RESPONSE_UNUSABLE");
        assert_ne!(again["data"]["last_run_at"], before);
    };
    let outcome = futures_util::FutureExt::catch_unwind(std::panic::AssertUnwindSafe(outcome)).await;
    let (status, body) = app.delete(&format!("/api/v1/{TENANT}/admin/bases/{sb}"), &admin).await;
    assert!(status.is_success(), "{body}");
    if let Err(panic) = outcome {
        std::panic::resume_unwind(panic);
    }
}
