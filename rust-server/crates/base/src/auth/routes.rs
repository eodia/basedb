//! Les routes `/auth/*` natives (chapitre 13), telles app.ts — mêmes statuts, mêmes corps,
//! mêmes cookies, même limiteur par adresse.
//!
//! Les autres routes `/auth/*` sont servies par le crate `admin` : profil, adresse, identités,
//! fournisseurs OIDC, détachement d'identité, demande de réinitialisation, inscription,
//! invitation et amorçage, connexion OIDC (début, retour, rattachement).

use super::operations as ops;
use super::{address_of, bearer, cookie, cookie_holder, deleted_session_cookies, known_address, session_cookies, CSRF_HEADER, SESSION_COOKIE};
use crate::demo::{demo_account_for, is_demo_address};
use crate::error::{empty, json_ok, ApiResult, AppError};
use crate::layers::RequestId;
use crate::state::Shared;
use crate::time::{iso, now_ms};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use axum::routing::{delete, get, post};
use axum::{Extension, Router};
use basedb_contracts::{accepted_languages, is_locale, match_locale};
use serde_json::{json, Map, Value};

/// The routes.
pub fn router(st: &Shared) -> Router<Shared> {
    let mut r = Router::new()
        .route("/auth/password/login", post(login))
        .route("/auth/password/change", post(change_password))
        .route("/auth/session/access", post(access))
        .route("/auth/introspect", post(introspect))
        .route("/auth/session", delete(logout))
        .route("/auth/sessions", get(list_sessions).delete(revoke_all))
        .route("/auth/sessions/{id}", delete(revoke_one))
        .route("/auth/me", get(me))
        .route("/auth/elevate", post(elevate))
        .route("/auth/elevation", delete(drop_elevation))
        .route("/auth/password/reset", get(reset_available))
        .route("/auth/password/reset/confirm", post(reset_confirm));
    if st.cfg.demo.is_some() {
        r = r.route("/auth/demo", get(demo));
    }
    r
}

/// `c.req.json().catch(() => ({}))`, and what reading a field of it does: a body that is
/// JSON `null` makes Node's `body.x` throw (`TypeError` → 500).
fn lenient_json(bytes: &[u8]) -> Result<Value, AppError> {
    match serde_json::from_slice::<Value>(bytes) {
        Ok(Value::Null) => Err(AppError::internal("corps JSON null")),
        Ok(v) => Ok(v),
        Err(_) => Ok(Value::Object(Map::new())),
    }
}

/// `c.req.json()` without a catch: malformed → 500, as Node's `SyntaxError`.
fn strict_json(bytes: &[u8]) -> Result<Value, AppError> {
    serde_json::from_slice::<Value>(bytes).map_err(|e| AppError::internal(format!("corps JSON invalide : {e}")))
}

fn text<'a>(body: &'a Value, key: &str) -> Option<&'a str> {
    body.get(key).and_then(Value::as_str)
}

/// `bounded`: one attempt counted for the address; past the bound, 429 and `retry-after`.
fn bounded(st: &Shared, headers: &HeaderMap) -> Result<String, Response> {
    let address = address_of(headers);
    let verdict = st.auth_limiter.check(&address, now_ms());
    if !verdict.allowed {
        let mut res = axum::response::IntoResponse::into_response(AppError::new("RATE_LIMIT_EXCEEDED").with("retry_after", json!(verdict.retry_after)));
        res.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(verdict.retry_after));
        return Err(res);
    }
    Ok(address)
}

fn with_cookies(mut res: Response, cookies: [String; 2]) -> Response {
    for c in cookies {
        if let Ok(v) = HeaderValue::from_str(&c) {
            res.headers_mut().append(header::SET_COOKIE, v);
        }
    }
    res
}

fn user_agent(headers: &HeaderMap) -> Option<&str> {
    headers.get(header::USER_AGENT).and_then(|v| v.to_str().ok())
}

async fn login(State(st): State<Shared>, headers: HeaderMap, bytes: Bytes) -> Response {
    let address = match bounded(&st, &headers) {
        Ok(a) => a,
        Err(res) => return res,
    };
    let outcome: ApiResult = async {
        let body = lenient_json(&bytes)?;
        let (Some(email), Some(password)) = (text(&body, "email"), text(&body, "password")) else {
            st.auth_limiter.failed(&address);
            return Err(AppError::new("CREDENTIALS_INVALID"));
        };
        let password = match &st.cfg.demo {
            Some(demo) if is_demo_address(demo, email) => demo.password.as_str(),
            _ => password,
        };
        let session = match async { ops::login(&st.pools, st.instance_key()?, email, password, known_address(&address), user_agent(&headers)).await }.await {
            Ok(s) => s,
            Err(e) => {
                st.auth_limiter.failed(&address);
                return Err(e);
            }
        };
        st.auth_limiter.succeeded(&address);
        let res = json_ok(json!({ "data": { "csrf": session.csrf_token, "tenant": session.tenant_ref } }));
        Ok(with_cookies(res, session_cookies(&session.session_token, &session.csrf_token)))
    }
    .await;
    outcome.unwrap_or_else(axum::response::IntoResponse::into_response)
}

async fn change_password(State(st): State<Shared>, headers: HeaderMap, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let who = cookie_holder(&st, &headers).await?;
    if body.is_null() {
        return Err(AppError::internal("corps JSON null"));
    }
    let (Some(current), Some(next)) = (text(&body, "current"), text(&body, "next")) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("next")));
    };
    let fresh = ops::change_password(&st.pools, st.instance_key()?, &who.user_id, current, next).await?;
    Ok(with_cookies(empty(StatusCode::NO_CONTENT), session_cookies(&fresh.session_token, &fresh.csrf_token)))
}

async fn access(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    let key = st.instance_key()?;
    let csrf = headers.get(CSRF_HEADER).and_then(|v| v.to_str().ok());
    let (token, expires_at) = ops::issue_access_token(&st.pools, key, cookie(&headers, SESSION_COOKIE).as_deref(), csrf).await?;
    Ok(json_ok(json!({ "data": { "token": token, "expires_at": iso(expires_at) } })))
}

async fn introspect(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, bytes: Bytes) -> ApiResult {
    let caller = bearer(&headers);
    let content_type = headers.get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("");
    let token: Option<String> = if content_type.contains("application/json") {
        lenient_json(&bytes)?.get("token").and_then(Value::as_str).map(str::to_string)
    } else if content_type.starts_with("multipart/form-data") {
        multipart_field(content_type, &bytes, "token")
    } else if content_type.starts_with("application/x-www-form-urlencoded") {
        form_urlencoded::parse(&bytes).filter(|(k, _)| k == "token").last().map(|(_, v)| v.into_owned())
    } else {
        None
    };
    let address = address_of(&headers);
    let answer = super::introspect::introspect_token(
        &st.pools,
        &st.token_cache,
        st.instance_key()?,
        caller.as_deref(),
        token.as_deref(),
        Some(&rid.0),
        known_address(&address),
    )
    .await?;
    let mut res = json_ok(answer);
    res.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(res)
}

/// A text field of a `multipart/form-data` body, as Hono's `parseBody` reads it: the last
/// part of that name wins; a file part is no text.
pub fn multipart_field(content_type: &str, body: &[u8], name: &str) -> Option<String> {
    let boundary = content_type.split(';').map(str::trim).find_map(|p| p.strip_prefix("boundary="))?.trim_matches('"');
    if boundary.is_empty() {
        return None;
    }
    let delimiter = format!("--{boundary}");
    let text = String::from_utf8_lossy(body);
    let mut found = None;
    for part in text.split(delimiter.as_str()).skip(1) {
        if part.starts_with("--") {
            break;
        }
        let part = part.strip_prefix("\r\n").unwrap_or(part);
        let Some((head, value)) = part.split_once("\r\n\r\n") else { continue };
        let disposition = head.lines().find(|l| l.to_ascii_lowercase().starts_with("content-disposition:")).unwrap_or("");
        let params: Vec<(String, String)> = disposition
            .split(';')
            .skip(1)
            .filter_map(|p| p.trim().split_once('='))
            .map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().trim_matches('"').to_string()))
            .collect();
        let named = params.iter().any(|(k, v)| k == "name" && v == name);
        let file = params.iter().any(|(k, _)| k == "filename");
        if named {
            found = if file { None } else { Some(value.strip_suffix("\r\n").unwrap_or(value).to_string()) };
        }
    }
    found
}

async fn logout(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    ops::logout(&st.pools, cookie(&headers, SESSION_COOKIE).as_deref()).await?;
    Ok(with_cookies(empty(StatusCode::NO_CONTENT), deleted_session_cookies()))
}

async fn list_sessions(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    let who = cookie_holder(&st, &headers).await?;
    let sessions = ops::list_sessions(&st.pools, &who).await?;
    let data: Vec<Value> = sessions
        .iter()
        .map(|s| {
            json!({
                "id": s.id,
                "created_at": s.created_at,
                "last_seen_at": s.last_seen_at,
                "ip": s.ip,
                "user_agent": s.user_agent,
                "current": s.id == who.session_id,
            })
        })
        .collect();
    Ok(json_ok(json!({ "data": data })))
}

async fn revoke_all(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    let who = cookie_holder(&st, &headers).await?;
    ops::revoke(&st.pools, &who, None).await?;
    Ok(with_cookies(empty(StatusCode::NO_CONTENT), deleted_session_cookies()))
}

async fn revoke_one(State(st): State<Shared>, Path(id): Path<String>, headers: HeaderMap) -> ApiResult {
    let who = cookie_holder(&st, &headers).await?;
    ops::revoke(&st.pools, &who, Some(&id)).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

/// `serializeMe`.
pub fn serialize_me(st: &Shared, me: &ops::Me) -> Value {
    json!({
        "id": me.id,
        "email": me.email,
        "display_name": me.display_name,
        "tenant": me.tenant_ref,
        "is_instance_admin": me.is_instance_admin,
        "is_admin": me.is_admin,
        "must_change_password": me.must_change_password,
        "elevated_until": me.elevated_until,
        "has_password": me.has_password,
        "date_format": me.date_format,
        "week_start": me.week_start,
        "muted_notifications": me.muted_notifications,
        "mailed_notifications": me.mailed_notifications,
        "mail_available": st.mail_available(),
        "geocoding_available": st.geocoding_available(),
        "locale": me.locale,
    })
}

async fn me(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    let who = match bearer(&headers) {
        Some(token) => ops::authenticate_access_token(&st.pools, st.instance_key()?, Some(&token)).await?,
        None => cookie_holder(&st, &headers).await?,
    };
    let me = ops::who_am_i(&st.pools, &who).await?;
    Ok(json_ok(json!({ "data": serialize_me(&st, &me) })))
}

async fn elevate(State(st): State<Shared>, headers: HeaderMap, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes)?;
    let Some(password) = text(&body, "password") else { return Err(AppError::new("CREDENTIALS_INVALID")) };
    let session = cookie(&headers, SESSION_COOKIE);
    let password = match &st.cfg.demo {
        Some(demo) => {
            let who = cookie_holder(&st, &headers).await?;
            let me = ops::who_am_i(&st.pools, &who).await?;
            if is_demo_address(demo, &me.email) {
                demo.password.as_str()
            } else {
                password
            }
        }
        None => password,
    };
    let (fresh, until) = ops::elevate(&st.pools, st.instance_key()?, session.as_deref(), password).await?;
    let res = json_ok(json!({ "data": { "elevated_until": iso(until) } }));
    Ok(with_cookies(res, session_cookies(&fresh.session_token, &fresh.csrf_token)))
}

async fn drop_elevation(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    ops::drop_elevation(&st.pools, cookie(&headers, SESSION_COOKIE).as_deref()).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

async fn reset_available(State(st): State<Shared>) -> ApiResult {
    if !st.mail_available() {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    Ok(json_ok(json!({ "data": { "available": true } })))
}

async fn reset_confirm(State(st): State<Shared>, headers: HeaderMap, bytes: Bytes) -> Response {
    if let Err(res) = bounded(&st, &headers) {
        return res;
    }
    let outcome: ApiResult = async {
        let body = lenient_json(&bytes)?;
        let (Some(secret), Some(password)) = (text(&body, "secret"), text(&body, "password")) else {
            return Err(AppError::new("RESET_TOKEN_INVALID"));
        };
        ops::confirm_password_reset(&st.pools, st.instance_key()?, secret, password).await?;
        Ok(empty(StatusCode::NO_CONTENT))
    }
    .await;
    outcome.unwrap_or_else(axum::response::IntoResponse::into_response)
}

/// `screenLanguage`: `x-basedb-locale` when it is one, else `Accept-Language`.
pub fn screen_language(headers: &HeaderMap) -> String {
    let get = |n: &str| headers.get(n).and_then(|v| v.to_str().ok());
    match get("x-basedb-locale") {
        Some(l) if is_locale(l) => l.to_string(),
        _ => match_locale(&accepted_languages(get("accept-language"))).to_string(),
    }
}

async fn demo(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    let Some(demo) = &st.cfg.demo else { return Err(AppError::new("RESOURCE_NOT_FOUND")) };
    Ok(json_ok(json!({ "data": demo_account_for(demo, &screen_language(&headers)) })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multipart_token_is_read_like_hono() {
        let body = "--XyZ\r\nContent-Disposition: form-data; name=\"other\"\r\n\r\nx\r\n--XyZ\r\nContent-Disposition: form-data; name=\"token\"\r\n\r\nbdb_abc\r\n--XyZ--\r\n";
        assert_eq!(multipart_field("multipart/form-data; boundary=XyZ", body.as_bytes(), "token").as_deref(), Some("bdb_abc"));
        assert_eq!(multipart_field("multipart/form-data; boundary=\"XyZ\"", body.as_bytes(), "absent"), None);
        let file = "--b\r\nContent-Disposition: form-data; name=\"token\"; filename=\"t.txt\"\r\nContent-Type: text/plain\r\n\r\nbdb_abc\r\n--b--";
        assert_eq!(multipart_field("multipart/form-data; boundary=b", file.as_bytes(), "token"), None);
    }
}
