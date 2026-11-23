//! Le harnais de test des domaines : l'application complète ([`crate::app::build`]) montée sur
//! la vraie base de développement (docker compose, :55432), appelée sans réseau.
//!
//! ```ignore
//! #[tokio::test]
//! async fn lists_bases() {
//!     let Some(app) = basedb_base::testing::test_app(basedb_catalog::router).await else { return };
//!     let admin = app.login("admin@basedb.local", "developpement-basedb").await;
//!     let (status, body) = app.get(&format!("/api/v1/{}/meta/bases", admin.tenant), &admin).await;
//!     assert_eq!(status, 200);
//! }
//! ```
//!
//! `test_app` rend `None` (le test s'arrête sans échouer) quand la base ne répond pas.

use crate::config;
use crate::state::{AppState, Shared};
use axum::body::{to_bytes, Body};
use axum::http::{HeaderMap, Method, Request, StatusCode};
use axum::Router;
use serde_json::{json, Value};
use tower::ServiceExt;

pub struct TestApp {
    pub st: Shared,
    pub router: Router,
}

/// Who calls: a session (cookie + CSRF, for `/auth/*`), an access token (`/api/v1`), or nobody.
#[derive(Clone, Debug, Default)]
pub struct Caller {
    pub session: Option<String>,
    pub csrf: Option<String>,
    pub bearer: Option<String>,
    pub tenant: String,
}

impl Caller {
    pub fn nobody() -> Self {
        Self::default()
    }
    pub fn with_bearer(token: impl Into<String>) -> Self {
        Caller { bearer: Some(token.into()), ..Self::default() }
    }
}

/// The development stack's settings (`start-basedb.mjs`), under the process's and `.env`'s.
const DEVELOPMENT: [(&str, &str); 2] = [
    ("DATABASE_URL", "postgres://postgres:basedb@localhost:55432/postgres"),
    ("BASEDB_ENCRYPTION_KEY", "developpement-seulement-ne-pas-utiliser-en-production"),
];

/// The configuration of the tests: [`config::load`], completed by the development stack's.
pub fn test_config() -> Result<config::Config, String> {
    let root = std::env::current_dir().ok().and_then(|d| config::repo_root(&d));
    let mut vars: std::collections::HashMap<String, String> = DEVELOPMENT.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    if let Some(root) = &root {
        for name in [".env", ".env.local"] {
            if let Ok(text) = std::fs::read_to_string(root.join(name)) {
                vars.extend(config::parse_env(&text).into_iter().filter(|(_, v)| !v.trim().is_empty()));
            }
        }
    }
    vars.extend(std::env::vars().filter(|(_, v)| !v.trim().is_empty()));
    config::load_from(vars, root)
}

/// The application over a domain's router, or `None` when the database is not there.
pub async fn test_app(router: impl FnOnce(&Shared) -> Router<Shared>) -> Option<TestApp> {
    let cfg = match test_config() {
        Ok(cfg) => cfg,
        Err(e) => {
            eprintln!("configuration de test invalide ({e}) : test ignoré");
            return None;
        }
    };
    let st = AppState::new(cfg).ok()?;
    if tokio::time::timeout(std::time::Duration::from_secs(3), st.pools.catalog()).await.ok()?.is_err() {
        eprintln!("base de développement injoignable : test ignoré");
        return None;
    }
    let routes = router(&st);
    let router = crate::app::build(st.clone(), routes);
    Some(TestApp { st, router })
}

/// Splits `Set-Cookie` headers into `(name, value)`.
pub fn set_cookies(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .filter_map(|c| c.split(';').next()?.split_once('=').map(|(n, v)| (n.to_string(), v.to_string())))
        .collect()
}

impl TestApp {
    /// Any request; the body as JSON (`Value::Null` when it is not).
    pub async fn call(&self, method: Method, path: &str, body: Option<&Value>, who: &Caller) -> (StatusCode, Value) {
        let (status, _, bytes) = self.raw(method, path, body, who).await;
        (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
    }

    /// Any request: status, headers, body.
    pub async fn raw(&self, method: Method, path: &str, body: Option<&Value>, who: &Caller) -> (StatusCode, HeaderMap, bytes::Bytes) {
        let mut req = Request::builder().method(method).uri(path).header("x-forwarded-for", "127.0.0.1");
        if let Some(s) = &who.session {
            req = req.header("cookie", format!("{}={s}", crate::auth::SESSION_COOKIE));
        }
        if let Some(c) = &who.csrf {
            req = req.header(crate::auth::CSRF_HEADER, c);
        }
        if let Some(b) = &who.bearer {
            req = req.header("authorization", format!("Bearer {b}"));
        }
        let body = match body {
            Some(v) => {
                req = req.header("content-type", "application/json");
                Body::from(serde_json::to_vec(v).unwrap())
            }
            None => Body::empty(),
        };
        let res = self.router.clone().oneshot(req.body(body).unwrap()).await.unwrap();
        let (parts, body) = res.into_parts();
        let bytes = to_bytes(body, usize::MAX).await.unwrap_or_default();
        (parts.status, parts.headers, bytes)
    }

    pub async fn get(&self, path: &str, who: &Caller) -> (StatusCode, Value) {
        self.call(Method::GET, path, None, who).await
    }

    pub async fn post(&self, path: &str, body: &Value, who: &Caller) -> (StatusCode, Value) {
        self.call(Method::POST, path, Some(body), who).await
    }

    pub async fn delete(&self, path: &str, who: &Caller) -> (StatusCode, Value) {
        self.call(Method::DELETE, path, None, who).await
    }

    /// Signs in by password (the native route), then turns the session into an access
    /// token: the caller holds the session, its CSRF token, and a bearer for `/api/v1`.
    pub async fn login(&self, email: &str, password: &str) -> Caller {
        let (status, headers, bytes) = self.raw(Method::POST, "/auth/password/login", Some(&json!({ "email": email, "password": password })), &Caller::nobody()).await;
        assert_eq!(status, StatusCode::OK, "connexion de {email} : {}", String::from_utf8_lossy(&bytes));
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        let session = set_cookies(&headers).into_iter().find(|(n, _)| n == crate::auth::SESSION_COOKIE).map(|(_, v)| v);
        let mut who = Caller {
            session,
            csrf: body["data"]["csrf"].as_str().map(str::to_string),
            bearer: None,
            tenant: body["data"]["tenant"].as_str().unwrap_or_default().to_string(),
        };
        let (status, access) = self.post("/auth/session/access", &json!({}), &who).await;
        assert_eq!(status, StatusCode::OK, "jeton d'accès de {email} : {access}");
        who.bearer = access["data"]["token"].as_str().map(str::to_string);
        who
    }
}
