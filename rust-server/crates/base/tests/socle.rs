//! The socle against the development database (docker compose, :55432). Each test returns
//! early, without failing, when the database is not reachable.

use axum::http::{Method, StatusCode};
use axum::Router;
use basedb_base::auth::{bearer_context, SESSION_COOKIE};
use basedb_base::db::{Exec, PoolName};
use basedb_base::testing::{set_cookies, test_app, Caller};
use basedb_base::tx::{with_transaction, TxOptions};
use basedb_base::{RequestId, Shared};
use serde_json::json;

const ADMIN: (&str, &str) = ("admin@basedb.local", "developpement-basedb");
const READER: (&str, &str) = ("lecteur@basedb.local", "Granit-Ocean-7-Plume");

fn none(_: &Shared) -> Router<Shared> {
    Router::new()
}

#[tokio::test]
async fn password_login_gives_a_session_then_an_access_token() {
    let Some(app) = test_app(none).await else { return };
    let admin = app.login(ADMIN.0, ADMIN.1).await;
    assert!(admin.session.is_some() && admin.csrf.is_some() && admin.bearer.is_some());

    let cookie_only = Caller { bearer: None, ..admin.clone() };
    let (status, me) = app.get("/auth/me", &cookie_only).await;
    assert_eq!(status, StatusCode::OK, "{me}");
    assert_eq!(me["data"]["email"], ADMIN.0);

    let bearer_only = Caller::with_bearer(admin.bearer.clone().unwrap());
    let (status, me) = app.get("/auth/me", &bearer_only).await;
    assert_eq!(status, StatusCode::OK, "{me}");
}

#[tokio::test]
async fn wrong_password_and_missing_csrf_are_refused() {
    let Some(app) = test_app(none).await else { return };
    let (status, body) = app.post("/auth/password/login", &json!({ "email": ADMIN.0, "password": "pas-le-bon" }), &Caller::nobody()).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{body}");
    assert_eq!(body["code"], "CREDENTIALS_INVALID", "{body}");
    assert!(body["request_id"].is_string(), "{body}");

    let reader = app.login(READER.0, READER.1).await;
    let no_csrf = Caller { csrf: None, bearer: None, ..reader.clone() };
    let (status, body) = app.post("/auth/session/access", &json!({}), &no_csrf).await;
    // Node treats a session without its CSRF header as no session at all.
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{body}");
    assert_eq!(body["code"], "AUTHENTICATION_REQUIRED");

    let (status, _) = app.get("/auth/me", &Caller::nobody()).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn logout_ends_the_session() {
    let Some(app) = test_app(none).await else { return };
    let reader = app.login(READER.0, READER.1).await;
    let cookie_only = Caller { bearer: None, ..reader.clone() };
    let (status, headers, _) = app.raw(Method::DELETE, "/auth/session", None, &cookie_only).await;
    assert!(status.is_success(), "{status}");
    assert!(set_cookies(&headers).iter().any(|(n, v)| n == SESSION_COOKIE && v.is_empty()));
    let (status, _) = app.get("/auth/me", &cookie_only).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_transaction_carries_the_caller_s_context() {
    let Some(app) = test_app(none).await else { return };
    let admin = app.login(ADMIN.0, ADMIN.1).await;
    let mut headers = axum::http::HeaderMap::new();
    headers.insert("authorization", format!("Bearer {}", admin.bearer.unwrap()).parse().unwrap());
    let ctx = bearer_context(&app.st, &headers, &RequestId("test-tx".into()), Some(&admin.tenant)).await.unwrap();
    let (kind, request): (String, String) = with_transaction(&app.st.pools, PoolName::Data, &ctx, TxOptions::default(), |tx| async move {
        let row = tx
            .first("SELECT current_setting('basedb.actor_kind'), current_setting('basedb.request_id')", &[])
            .await?
            .unwrap();
        Ok((row.get(0), row.get(1)))
    })
    .await
    .unwrap();
    assert_eq!(kind, "user");
    assert_eq!(request, "test-tx");
}
