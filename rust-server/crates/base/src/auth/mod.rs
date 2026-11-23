//! L'authentification : mots de passe, sessions, jetons d'accès et d'intégration,
//! introspection — et ce qu'une route fait d'un appel HTTP pour savoir QUI appelle.
//!
//! Les deux lettres de créance (app.ts) :
//!
//! - `/auth/*` : le cookie de session `__Host-basedb_session`, et lui seul ([`cookie_holder`]) ;
//! - `/api/v1/*` : un jeton d'accès dans `Authorization: Bearer` ([`bearer_context`]), jamais
//!   le cookie ; les routes de DONNÉES acceptent aussi un jeton d'intégration `bdb_…`
//!   ([`data_context`]).
//!
//! Un contexte ouvert vérifie le tenant du chemin : un acteur porté sur un autre tenant reçoit
//! `RESOURCE_NOT_FOUND {tenant}` (404, jamais 403).

pub mod introspect;
pub mod operations;
pub mod password;
pub mod routes;
pub mod session;
pub mod tokens;

use crate::db::Exec;
use crate::error::AppError;
use crate::layers::RequestId;
use crate::state::AppState;
use crate::tx::{Actor, RequestContext, Surface};
use axum::http::{HeaderMap, Uri};
pub use operations::Authenticated;
use serde_json::json;
pub use session::{CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE};

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = text.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Hono's `getCookie(c, name)`: the first valid pair of that name, unquoted, URI-decoded.
pub fn cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = header(headers, "cookie")?;
    if !raw.contains(name) {
        return None;
    }
    for pair in raw.trim().split(';') {
        let pair = pair.trim();
        let Some(eq) = pair.find('=') else { continue };
        if pair[..eq].trim() != name {
            continue;
        }
        let mut value = pair[eq + 1..].trim();
        if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
            value = &value[1..value.len() - 1];
        }
        let valid = value.bytes().all(|b| b == b' ' || b == b'!' || (b'#'..=b':').contains(&b) || (b'<'..=b'[').contains(&b) || (b']'..=b'~').contains(&b));
        if valid {
            return Some(if value.contains('%') { percent_decode(value).unwrap_or_else(|| value.to_string()) } else { value.to_string() });
        }
    }
    None
}

/// `Authorization: Bearer …` → the token (`slice(7).trim()`), whatever the scheme's case.
pub fn bearer(headers: &HeaderMap) -> Option<String> {
    let h = header(headers, "authorization")?;
    h.to_lowercase().starts_with("bearer ").then(|| h[7..].trim().to_string())
}

/// `addressOf`: the first `x-forwarded-for`, else `x-real-ip`, else `inconnue`.
pub fn address_of(headers: &HeaderMap) -> String {
    if let Some(f) = header(headers, "x-forwarded-for") {
        return f.split(',').next().unwrap_or("").trim().to_string();
    }
    header(headers, "x-real-ip").map(str::to_string).unwrap_or_else(|| "inconnue".into())
}

/// The address as the operations record it: `inconnue` → none.
pub fn known_address(address: &str) -> Option<&str> {
    (address != "inconnue").then_some(address)
}

/// `askedEnvironment`: `X-Basedb-Environment`, else `?environment=`.
pub fn asked_environment(headers: &HeaderMap, uri: &Uri) -> Option<String> {
    if let Some(h) = header(headers, "x-basedb-environment") {
        return Some(h.to_string());
    }
    uri.query().and_then(|q| form_urlencoded::parse(q.as_bytes()).find(|(k, _)| k == "environment").map(|(_, v)| v.into_owned()))
}

/// `Set-Cookie` of the session pair (`plantSession`): 30 days, `__Host-`, `Strict`.
pub fn session_cookies(session_token: &str, csrf_token: &str) -> [String; 2] {
    let max_age = session::SESSION_ABSOLUTE_MS / 1000;
    let enc = |v: &str| form_urlencoded::byte_serialize(v.as_bytes()).collect::<String>().replace('+', "%20");
    [
        format!("{SESSION_COOKIE}={}; Max-Age={max_age}; Path=/; HttpOnly; Secure; SameSite=Strict", enc(session_token)),
        format!("{CSRF_COOKIE}={}; Max-Age={max_age}; Path=/; Secure; SameSite=Strict", enc(csrf_token)),
    ]
}

/// `deleteCookie(c, name, { path: '/', secure: true })` for both.
pub fn deleted_session_cookies() -> [String; 2] {
    [format!("{SESSION_COOKIE}=; Max-Age=0; Path=/; Secure"), format!("{CSRF_COOKIE}=; Max-Age=0; Path=/; Secure")]
}

/// `cookieHolder`: the session cookie's holder (401 otherwise).
pub async fn cookie_holder(st: &AppState, headers: &HeaderMap) -> Result<Authenticated, AppError> {
    operations::authenticate_cookie(&st.pools, cookie(headers, SESSION_COOKIE).as_deref()).await
}

/// `bearerWho`: the access token's holder (401 otherwise).
pub async fn bearer_who(st: &AppState, headers: &HeaderMap) -> Result<Authenticated, AppError> {
    let token = bearer(headers);
    operations::authenticate_access_token(&st.pools, st.instance_key()?, token.as_deref()).await
}

/// `kernel.openContext`: a person, active, as an actor (401 otherwise).
pub async fn open_context(st: &AppState, user_id: &str, request_id: &str, surface: Surface, environment: Option<&str>) -> Result<RequestContext, AppError> {
    let exec = st.pools.catalog().await?;
    let row = exec
        .first(
            "SELECT u.id::text, t.ref AS tenant_ref
               FROM _basedb.app_user u
               JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE u.id = $1::text::uuid AND u.disabled_at IS NULL AND u.deleted_at IS NULL",
            &[&user_id],
        )
        .await?;
    let Some(row) = row else { return Err(AppError::new("AUTHENTICATION_REQUIRED")) };
    Ok(RequestContext::new(request_id, Actor::user(row.get::<_, String>(0)), row.get::<_, String>(1), surface).with_environment(environment))
}

fn check_tenant(ctx: RequestContext, tenant_ref: Option<&str>) -> Result<RequestContext, AppError> {
    match tenant_ref {
        Some(t) if t != ctx.tenant_id => Err(AppError::new("RESOURCE_NOT_FOUND").with("tenant", json!(t))),
        _ => Ok(ctx),
    }
}

/// `contextFor`: [`open_context`] on the `rest` surface, then the path's tenant checked.
pub async fn context_for(st: &AppState, user_id: &str, request_id: &RequestId, tenant_ref: Option<&str>, environment: Option<&str>) -> Result<RequestContext, AppError> {
    let ctx = open_context(st, user_id, &request_id.0, Surface::Rest, environment).await?;
    check_tenant(ctx, tenant_ref)
}

/// `contextFor(c, await bearer(c))`: the credential of `/api/v1` — a person's access token.
pub async fn bearer_context(st: &AppState, headers: &HeaderMap, request_id: &RequestId, tenant_ref: Option<&str>) -> Result<RequestContext, AppError> {
    let who = bearer_who(st, headers).await?;
    context_for(st, &who.user_id, request_id, tenant_ref, None).await
}

/// `dataContext`: the credential of the DATA routes — a person's access token, or an
/// integration token (`bdb_…`) issued for the `rest` surface, its own actor.
pub async fn data_context(st: &AppState, headers: &HeaderMap, uri: &Uri, request_id: &RequestId, tenant_ref: Option<&str>) -> Result<RequestContext, AppError> {
    let environment = asked_environment(headers, uri);
    let secret = bearer(headers);
    match secret.filter(|s| s.starts_with(tokens::INTEGRATION_TOKEN_PREFIX)) {
        None => {
            let who = bearer_who(st, headers).await?;
            context_for(st, &who.user_id, request_id, tenant_ref, environment.as_deref()).await
        }
        Some(secret) => {
            let ctx = open_token_context(st, &secret, Surface::Rest, &request_id.0, None, environment.as_deref()).await?;
            check_tenant(ctx, tenant_ref)
        }
    }
}

/// `kernel.openTokenContext`: an integration token as its own actor.
pub async fn open_token_context(st: &AppState, secret: &str, surface: Surface, request_id: &str, ip: Option<&str>, environment: Option<&str>) -> Result<RequestContext, AppError> {
    let token = tokens::verify_api_token(&st.pools, &st.token_cache, Some(secret), surface, Some(request_id), ip).await?;
    Ok(RequestContext::new(request_id, Actor::token(token.user_id, token.token_id), token.tenant_ref, surface).with_environment(environment))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(*k, HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn cookies_parse_like_hono() {
        let h = headers(&[("cookie", "a=1; __Host-basedb_session=\"abc%2Bd\"; __Host-basedb_csrf=x")]);
        assert_eq!(cookie(&h, SESSION_COOKIE).as_deref(), Some("abc+d"));
        assert_eq!(cookie(&h, CSRF_COOKIE).as_deref(), Some("x"));
        assert_eq!(cookie(&h, "absent"), None);
    }

    #[test]
    fn bearer_and_address() {
        assert_eq!(bearer(&headers(&[("authorization", "BEARER  abc ")])).as_deref(), Some("abc"));
        assert_eq!(bearer(&headers(&[("authorization", "Basic abc")])), None);
        assert_eq!(address_of(&headers(&[("x-forwarded-for", " 1.2.3.4 , 5.6.7.8")])), "1.2.3.4");
        assert_eq!(address_of(&headers(&[("x-real-ip", "9.9.9.9")])), "9.9.9.9");
        assert_eq!(address_of(&HeaderMap::new()), "inconnue");
    }

    #[test]
    fn cookies_are_planted_like_hono() {
        let [s, c] = session_cookies("tok", "csrf");
        assert_eq!(s, "__Host-basedb_session=tok; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Strict");
        assert_eq!(c, "__Host-basedb_csrf=csrf; Max-Age=2592000; Path=/; Secure; SameSite=Strict");
    }
}
