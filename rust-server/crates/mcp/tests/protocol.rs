//! The MCP entry point over the development database: refusals before any token, then one
//! session of an integration token (created, used, revoked).

use axum::body::{to_bytes, Body};
use axum::http::{HeaderMap, Method, Request, StatusCode};
use axum::Router;
use basedb_base::testing::{set_cookies, test_app, Caller, TestApp};
use serde_json::{json, Value};
use tower::ServiceExt;

async fn send(router: &Router, method: Method, headers: &[(&str, &str)], body: Option<&str>) -> (StatusCode, HeaderMap, Value) {
    let mut req = Request::builder().method(method).uri("/mcp").header("x-forwarded-for", "127.0.0.1");
    for (name, value) in headers {
        req = req.header(*name, *value);
    }
    let req = req.body(body.map_or_else(Body::empty, |b| Body::from(b.to_string()))).unwrap();
    let res = router.clone().oneshot(req).await.unwrap();
    let (parts, body) = res.into_parts();
    let bytes = to_bytes(body, usize::MAX).await.unwrap_or_default();
    (parts.status, parts.headers, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

const JSON: (&str, &str) = ("content-type", "application/json");

#[tokio::test]
async fn refuses_before_any_token() {
    let Some(app) = test_app(basedb_mcp::router).await else { return };
    let mcp = basedb_mcp::standalone(&app.st);
    let ping = r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#;

    let (status, _, body) = send(&mcp, Method::POST, &[JSON, ("origin", "https://exemple.org")], Some(ping)).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"]["data"]["code"], "AUTHENTICATION_REQUIRED");

    let (status, _, _) = send(&mcp, Method::POST, &[("content-type", "text/plain")], Some(ping)).await;
    assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);

    let (status, _, body) = send(&mcp, Method::POST, &[JSON], Some("{pas du json")).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], -32700);

    let (status, _, body) = send(&mcp, Method::POST, &[JSON], Some(&format!("[{ping}]"))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], -32600);

    let (status, _, body) = send(&mcp, Method::POST, &[JSON], Some(ping)).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["id"], 1);
    assert_eq!(body["error"]["data"]["code"], "TOKEN_INVALID");

    let (status, headers, _) = send(&mcp, Method::GET, &[], None).await;
    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(headers.get("allow").unwrap(), "POST, DELETE");

    let req = Request::builder().uri("/healthz").body(Body::empty()).unwrap();
    assert_eq!(mcp.clone().oneshot(req).await.unwrap().status(), StatusCode::OK);
}

/// Elevated (tokens are issued by an elevated session), with the bearer of `/api/v1`.
async fn elevated_admin(app: &TestApp) -> Caller {
    let password = "developpement-basedb";
    let mut who = app.login("admin@basedb.local", password).await;
    let (status, headers, bytes) = app.raw(Method::POST, "/auth/elevate", Some(&json!({ "password": password })), &who).await;
    assert_eq!(status, StatusCode::OK, "élévation : {}", String::from_utf8_lossy(&bytes));
    for (name, value) in set_cookies(&headers) {
        if name == basedb_base::auth::SESSION_COOKIE {
            who.session = Some(value);
        } else if name == basedb_base::auth::CSRF_COOKIE {
            who.csrf = Some(value);
        }
    }
    let (status, access) = app.post("/auth/session/access", &json!({}), &who).await;
    assert_eq!(status, StatusCode::OK, "jeton d'accès : {access}");
    who.bearer = access["data"]["token"].as_str().map(str::to_string);
    who
}

#[tokio::test]
async fn one_session_of_a_token() {
    // Tokens issued and revoked natively: the revocation empties the token cache.
    let Some(app) = test_app(|st| basedb_admin::router(st).merge(basedb_mcp::router(st))).await else { return };
    let mcp = basedb_mcp::standalone(&app.st);
    let admin = elevated_admin(&app).await;
    let tenant = admin.tenant.clone();
    let base = format!("b_{tenant}_demo_atelier_lumen");
    let label = json!({ "label": "test mcp protocole", "base": base, "access": "read", "surfaces": ["mcp"] });
    let (status, issued) = app.post(&format!("/api/v1/{tenant}/admin/tokens"), &label, &admin).await;
    assert!(status.is_success(), "jeton : {issued}");
    let token_id = issued["data"]["id"].as_str().unwrap().to_string();
    let bearer = format!("Bearer {}", issued["data"]["secret"].as_str().unwrap());
    let auth = ("authorization", bearer.as_str());

    let init = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}"#;
    let (status, headers, body) = send(&mcp, Method::POST, &[JSON, auth], Some(init)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["result"]["protocolVersion"], "2025-06-18");
    assert_eq!(body["result"]["serverInfo"]["name"], "basedb");
    let session = headers.get("mcp-session-id").unwrap().to_str().unwrap().to_string();
    let in_session = [JSON, auth, ("mcp-session-id", session.as_str()), ("mcp-protocol-version", "2025-06-18")];

    let list = r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#;
    let (status, _, body) = send(&mcp, Method::POST, &[JSON, auth], Some(list)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["data"]["code"], "SESSION_NOT_INITIALIZED");
    let (status, _, body) = send(&mcp, Method::POST, &[JSON, auth, ("mcp-session-id", "inconnue")], Some(list)).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["data"]["code"], "SESSION_NOT_INITIALIZED");

    let (status, _, body) = send(&mcp, Method::POST, &in_session, Some(list)).await;
    assert_eq!(status, StatusCode::OK);
    let tools = body["result"]["tools"].as_array().unwrap();
    assert_eq!(tools.len(), 21);
    assert!(tools.iter().any(|t| t["name"] == "whoami"));

    let whoami = r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"whoami"}}"#;
    let (status, _, body) = send(&mcp, Method::POST, &in_session, Some(whoami)).await;
    assert_eq!(status, StatusCode::OK);
    let payload: Value = serde_json::from_str(body["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(payload["budgets"]["rows_written_per_hour"], 500);
    assert_eq!(payload["budgets"]["concurrent_requests"], 4);

    // An unknown tool is a JSON-RPC error, answered with 200 (as the Node server).
    let unknown = r#"{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"inexistant"}}"#;
    let (status, _, body) = send(&mcp, Method::POST, &in_session, Some(unknown)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["error"]["code"], -32602);

    let (status, _, _) = send(&mcp, Method::DELETE, &in_session, None).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, _) = send(&mcp, Method::POST, &in_session, Some(list)).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, revoked) = app.delete(&format!("/api/v1/{tenant}/admin/tokens/{token_id}"), &admin).await;
    assert!(status.is_success(), "révocation : {revoked}");
    let (status, _, body) = send(&mcp, Method::POST, &[JSON, auth], Some(init)).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{body}");
    app.raw(Method::POST, "/auth/logout", None, &admin).await;
}
