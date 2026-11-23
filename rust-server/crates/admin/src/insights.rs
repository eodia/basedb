//! `insights/client.ts`, and the routes of `app.ts` that call insights as the person: its
//! status, the address that signs them in there, and the search of what they may read.
//!
//! `POST /api/insights/reader` (`insights/embedded.ts`) is the catalog's
//! (`basedb_catalog::insights_reader`): it provisions the person's reader role over every
//! base they read (`sql/reader.ts`, shadow views and grants).

use crate::common::{fields, js_slice, lenient_json};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, Uri};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::config::InsightsConfig;
use basedb_base::error::{json_ok, ApiResult, AppError};
use basedb_base::layers::RequestId;
use basedb_base::time::{b64url, hmac_sha256};
use basedb_base::Shared;
use basedb_contracts::locales::is_locale;
use serde_json::{json, Map, Value};
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(120);
pub const HOST_ISSUER: &str = "basedb";

pub struct Person {
    pub id: String,
    pub email: String,
    pub name: String,
}

/// `requireInsights`.
pub fn require_insights(st: &Shared) -> Result<&InsightsConfig, AppError> {
    st.cfg.insights.as_ref().ok_or_else(|| AppError::new("INSIGHTS_UNAVAILABLE").with("reason", json!("non_configure")))
}

/// `personOf`: the person behind an actor — a user, or a token's owner.
pub async fn person_of(st: &Shared, user_id: &str) -> Result<Person, AppError> {
    let conn = st.pools.catalog().await?;
    let row = basedb_base::db::Exec::first(&conn, "SELECT email, display_name FROM _basedb.app_user WHERE id = $1::text::uuid", &[&user_id]).await?;
    let row = row.ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("user", json!(user_id)))?;
    let email: String = row.get(0);
    let name: Option<String> = row.get(1);
    Ok(Person { id: user_id.to_string(), name: name.unwrap_or_else(|| email.clone()), email })
}

/// An HS256 JWT signed with the shared secret (`SignJWT` of jose).
pub fn sign_jwt(secret: &str, claims: &Value) -> String {
    let header = b64url(br#"{"alg":"HS256","typ":"JWT"}"#);
    let payload = b64url(claims.to_string().as_bytes());
    let signature = hmac_sha256(secret.as_bytes(), &[header.as_bytes(), b".", payload.as_bytes()]);
    format!("{header}.{payload}.{}", b64url(&signature))
}

fn now_seconds() -> i64 {
    chrono::Utc::now().timestamp()
}

/// `tokenFor`: a JWT naming the person, for insights — a minute for a link, five for a call.
pub fn token_for(config: &InsightsConfig, person: &Person, seconds: i64) -> String {
    let iat = now_seconds();
    sign_jwt(
        &config.secret,
        &json!({ "email": person.email, "name": person.name, "iss": HOST_ISSUER, "aud": "insights", "sub": person.id, "iat": iat, "exp": iat + seconds }),
    )
}

/// `insightsServiceCall`'s token: basedb itself, `scope=source`, a minute.
pub fn service_token(config: &InsightsConfig) -> String {
    let iat = now_seconds();
    sign_jwt(&config.secret, &json!({ "scope": "source", "iss": HOST_ISSUER, "aud": "insights", "sub": "service", "iat": iat, "exp": iat + 60 }))
}

#[derive(Default)]
pub struct EmbeddedLink {
    pub embedded: bool,
    pub theme: Option<String>,
    pub lang: Option<String>,
}

fn lang_shaped(lang: &str) -> bool {
    static RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| regex::Regex::new(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$").unwrap()).is_match(lang)
}

/// `insightsLink`: the address that signs the person in to insights, then shows `next`.
pub fn insights_link(config: &InsightsConfig, person: &Person, next: &str, options: &EmbeddedLink) -> Result<String, AppError> {
    let path = if next.starts_with('/') && !next.starts_with("//") { next } else { "/" };
    let token = token_for(config, person, 60);
    let base = config.public_url.strip_suffix('/').unwrap_or(&config.public_url);
    let mut url = url::Url::parse(&format!("{base}/api/auth/host")).map_err(|e| AppError::internal(format!("Invalid URL: {e}")))?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair("token", &token);
        q.append_pair("next", path);
        if options.embedded {
            q.append_pair("embedded", "1");
        }
        if let Some(theme) = &options.theme {
            q.append_pair("theme", theme);
        }
        if let Some(lang) = options.lang.as_deref().filter(|l| lang_shaped(l)) {
            q.append_pair("lang", lang);
        }
    }
    Ok(url.to_string())
}

/// `call`: insights' API, with a token. An answer that is not 2xx is an error: the status,
/// and insights' own message, said back.
pub async fn call(config: &InsightsConfig, token: &str, method: reqwest::Method, path: &str, body: Option<&Value>) -> Result<Value, AppError> {
    let base = config.api_url.strip_suffix('/').unwrap_or(&config.api_url);
    let url = url::Url::parse(&format!("{base}{path}")).map_err(|e| AppError::internal(format!("Invalid URL: {e}")))?;
    let client = reqwest::Client::builder().timeout(TIMEOUT).build().map_err(|e| AppError::internal(e.to_string()))?;
    let mut request = client
        .request(method, url)
        .header("authorization", format!("Bearer {token}"))
        .header("accept", "application/json")
        .header("user-agent", "basedb/insights");
    if let Some(body) = body {
        request = request.header("content-type", "application/json").body(body.to_string());
    }
    let unreachable = || AppError::new("INSIGHTS_UNAVAILABLE").with("reason", json!("injoignable"));
    let response = request.send().await.map_err(|_| unreachable())?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|_| unreachable())?;
    let parsed = if text.is_empty() { Value::Null } else { serde_json::from_str::<Value>(&text).unwrap_or(Value::Null) };
    if !(200..300).contains(&status) {
        let mut error = AppError::new(if status == 404 { "RESOURCE_NOT_FOUND" } else { "INSIGHTS_REFUSED" }).with("status", json!(status));
        if let Some(e) = parsed.get("error").filter(|e| !e.is_null()) {
            if let Some(code) = e.get("code") {
                error = error.with("code", code.clone());
            }
            match e.get("message") {
                None => {}
                Some(Value::String(m)) => error = error.with("message", json!(js_slice(m, 500))),
                Some(_) => return Err(AppError::internal("error.message.slice is not a function")),
            }
        }
        return Err(error);
    }
    Ok(parsed)
}

/// `GET /api/v1/{tenant}/insights`.
pub async fn status(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let data = match &st.cfg.insights {
        None => json!({ "configured": false, "public_url": null }),
        Some(i) => json!({ "configured": true, "public_url": i.public_url }),
    };
    Ok(json_ok(json!({ "data": data })))
}

/// `POST /api/v1/{tenant}/insights/link`.
pub async fn link(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let body = fields(&body)?;
    let next = body.get("next").and_then(Value::as_str).unwrap_or("/").to_string();
    let options = EmbeddedLink {
        embedded: body.get("embedded") == Some(&Value::Bool(true)),
        theme: body.get("theme").and_then(Value::as_str).filter(|t| *t == "dark" || *t == "light").map(str::to_string),
        lang: body.get("lang").and_then(Value::as_str).filter(|l| is_locale(l)).map(str::to_string),
    };
    let config = require_insights(&st)?;
    let person = person_of(&st, &ctx.actor.id).await?;
    let url = insights_link(config, &person, &next, &options)?;
    Ok(json_ok(json!({ "data": { "url": url } })))
}

/// The first value of a query parameter, as Hono's `c.req.query(name)` gives it.
fn query_param(uri: &Uri, name: &str) -> Option<String> {
    form_urlencoded::parse(uri.query().unwrap_or("").as_bytes()).find(|(k, _)| k == name).map(|(_, v)| v.into_owned())
}

/// `GET /api/v1/{tenant}/insights/search`.
pub async fn search(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let q = query_param(&uri, "q").unwrap_or_default();
    let query = {
        let mut query = form_urlencoded::Serializer::new(String::new());
        query.append_pair("q", js_slice(&q, 200));
        if let Some(kind) = query_param(&uri, "kind").filter(|k| matches!(k.as_str(), "question" | "dashboard" | "model" | "metric")) {
            query.append_pair("kind", &kind);
        }
        query.finish()
    };
    let config = require_insights(&st)?;
    let person = person_of(&st, &ctx.actor.id).await?;
    let found = call(config, &token_for(config, &person, 300), reqwest::Method::GET, &format!("/api/v1/search?{query}"), None).await?;
    if found.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'items')"));
    }
    let items = match found.get("items") {
        None | Some(Value::Null) => Vec::new(),
        Some(Value::Array(items)) => items.clone(),
        Some(_) => return Err(AppError::internal("found.items.map is not a function")),
    };
    let mut data = Vec::with_capacity(items.len());
    for item in &items {
        if item.is_null() {
            return Err(AppError::internal("Cannot read properties of null (reading 'id')"));
        }
        let mut out = Map::new();
        for key in ["id", "kind", "name"] {
            if let Some(v) = item.get(key) {
                out.insert(key.into(), v.clone());
            }
        }
        out.insert("description".into(), item.get("description").cloned().unwrap_or(Value::Null));
        data.push(Value::Object(out));
    }
    Ok(json_ok(json!({ "data": data })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> InsightsConfig {
        InsightsConfig { api_url: "http://localhost:4100/".into(), public_url: "https://basedb.exemple.fr/insights/".into(), secret: "s".repeat(32), database_url: None }
    }

    fn person() -> Person {
        Person { id: "u1".into(), email: "a@b.fr".into(), name: "Anne".into() }
    }

    #[test]
    fn signs_a_jwt_insights_verifies() {
        let token = token_for(&config(), &person(), 60);
        let parts: Vec<&str> = token.split('.').collect();
        assert_eq!(parts.len(), 3);
        let expected = b64url(&hmac_sha256("s".repeat(32).as_bytes(), &[parts[0].as_bytes(), b".", parts[1].as_bytes()]));
        assert_eq!(parts[2], expected);
        let claims: Value = serde_json::from_slice(&basedb_base::time::b64url_decode(parts[1]).unwrap()).unwrap();
        assert_eq!(claims["iss"], "basedb");
        assert_eq!(claims["aud"], "insights");
        assert_eq!(claims["sub"], "u1");
        assert_eq!(claims["exp"].as_i64().unwrap() - claims["iat"].as_i64().unwrap(), 60);
    }

    #[test]
    fn links_under_the_public_path() {
        let opts = EmbeddedLink { embedded: true, theme: Some("dark".into()), lang: Some("pt-BR".into()) };
        let url = insights_link(&config(), &person(), "/dashboard/3?x=1", &opts).unwrap();
        assert!(url.starts_with("https://basedb.exemple.fr/insights/api/auth/host?token="), "{url}");
        assert!(url.ends_with("&next=%2Fdashboard%2F3%3Fx%3D1&embedded=1&theme=dark&lang=pt-BR"), "{url}");
        let url = insights_link(&config(), &person(), "//evil.com", &EmbeddedLink::default()).unwrap();
        assert!(url.ends_with("&next=%2F"), "{url}");
        let opts = EmbeddedLink { lang: Some("PT".into()), ..Default::default() };
        assert!(!insights_link(&config(), &person(), "/", &opts).unwrap().contains("lang="));
    }
}
