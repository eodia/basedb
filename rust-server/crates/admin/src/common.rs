//! What every route of the administration shares: reading a body the way Hono does, the
//! `/auth` rate limit, the checks of names and addresses (`users.ts`, `groups.ts`), the
//! elevation demanded on the session itself (`auth/elevation.ts`), and French ordering.

use axum::http::{header, HeaderMap, HeaderValue};
use axum::response::{IntoResponse, Response};
use basedb_base::auth::session::load_session_by_id;
use basedb_base::auth::{address_of, bearer_who, context_for};
use basedb_base::db::Exec;
use basedb_base::error::AppError;
use basedb_base::layers::RequestId;
use basedb_base::time::now_ms;
use basedb_base::tx::{ActorKind, RequestContext};
use basedb_base::Shared;
use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};
use std::cmp::Ordering;
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

/// `c.req.json().catch(() => ({}))`: malformed → `{}`. A JSON `null` is kept: Node throws
/// only when it reads a field of it — see [`fields`].
pub fn lenient_json(bytes: &[u8]) -> Value {
    serde_json::from_slice::<Value>(bytes).unwrap_or_else(|_| Value::Object(Map::new()))
}

/// `c.req.json()` without a catch: malformed → 500 (`SyntaxError`).
pub fn strict_json(bytes: &[u8]) -> Result<Value, AppError> {
    serde_json::from_slice::<Value>(bytes).map_err(|e| AppError::internal(format!("corps JSON invalide : {e}")))
}

/// The body, at the moment Node reads its first field: `null.x` is a `TypeError` (500).
pub fn fields(body: &Value) -> Result<&Value, AppError> {
    if body.is_null() {
        return Err(AppError::internal("Cannot read properties of null"));
    }
    Ok(body)
}

pub fn text<'a>(body: &'a Value, key: &str) -> Option<&'a str> {
    body.get(key).and_then(Value::as_str)
}

/// `bounded`: one attempt counted for the address; past the bound, 429 and `retry-after`.
pub fn bounded(st: &Shared, headers: &HeaderMap) -> Result<String, Response> {
    let address = address_of(headers);
    let verdict = st.auth_limiter.check(&address, now_ms());
    if !verdict.allowed {
        let mut res = AppError::new("RATE_LIMIT_EXCEEDED").with("retry_after", json!(verdict.retry_after)).into_response();
        res.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(verdict.retry_after));
        return Err(res);
    }
    Ok(address)
}

pub fn with_cookies(mut res: Response, cookies: impl IntoIterator<Item = String>) -> Response {
    for c in cookies {
        if let Ok(v) = HeaderValue::from_str(&c) {
            res.headers_mut().append(header::SET_COOKIE, v);
        }
    }
    res
}

pub fn user_agent(headers: &HeaderMap) -> Option<&str> {
    headers.get(header::USER_AGENT).and_then(|v| v.to_str().ok())
}

pub fn header_text<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

/// JavaScript's `\s` (and what `trim()` removes).
pub fn js_space(c: char) -> bool {
    matches!(c, '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
}

pub fn js_trim(s: &str) -> &str {
    s.trim_matches(js_space)
}

/// `String.length`: UTF-16 code units.
pub fn js_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `s.slice(0, n)`, counted in UTF-16 code units (a pair cut in half is dropped).
pub fn js_slice(s: &str, n: usize) -> &str {
    let mut units = 0;
    for (i, c) in s.char_indices() {
        units += c.len_utf16();
        if units > n {
            return &s[..i];
        }
    }
    s
}

pub fn nfc(s: &str) -> String {
    s.nfc().collect()
}

/// `/^[^\s@]+@[^\s@]+$/.test(email) && email.length <= 254`.
pub fn valid_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else { return false };
    let part = |p: &str| !p.is_empty() && !p.chars().any(|c| c == '@' || js_space(c));
    part(local) && part(domain) && js_len(email) <= 254
}

/// The address of a request body: trimmed, or `REQUEST_INVALID {field: email}`.
pub fn checked_email(raw: &str) -> Result<String, AppError> {
    let email = js_trim(raw).to_string();
    if !valid_email(&email) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("email")));
    }
    Ok(email)
}

/// `checkName` (`admin/users.ts`).
pub fn check_name(value: Option<&str>) -> Result<String, AppError> {
    let name = value.map(|v| js_trim(&nfc(v)).to_string()).unwrap_or_default();
    if name.is_empty() {
        return Err(AppError::new("LABEL_EMPTY").with("field", json!("display_name")));
    }
    if name.chars().count() > 120 {
        return Err(AppError::new("LABEL_TOO_LONG").with("field", json!("display_name")).with("maximum", json!(120)));
    }
    Ok(name)
}

/// `checkLabel` (`admin/groups.ts`).
pub fn check_label(value: &str) -> Result<String, AppError> {
    let label = js_trim(&nfc(value)).to_string();
    if label.is_empty() {
        return Err(AppError::new("LABEL_EMPTY"));
    }
    if label.chars().count() > 120 {
        return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(120)));
    }
    Ok(label)
}

/// `labelKey`: NFC, lower case, spaces collapsed, trimmed.
pub fn label_key(label: &str) -> String {
    let lower = nfc(label).to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut in_space = false;
    for c in lower.chars() {
        if js_space(c) {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(c);
            in_space = false;
        }
    }
    js_trim(&out).to_string()
}

/// `requireElevatedSession`: a proof of the password made minutes ago, on THIS session.
pub async fn require_elevated_session<E: Exec + Sync>(exec: &E, ctx: &RequestContext, session_id: &str) -> Result<(), AppError> {
    if ctx.actor.kind != ActorKind::User {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let session = load_session_by_id(exec, session_id).await?;
    let now = Utc::now();
    match session {
        Some(s) if s.user_id == ctx.actor.id && s.revoked_at.is_none() && s.elevated_until.is_some_and(|u| u > now) => Ok(()),
        _ => Err(AppError::new("ELEVATION_REQUIRED")),
    }
}

/// app.ts's `administering`: the access token's holder, its context on the path's tenant,
/// and the session it came from — for the elevation the writes demand.
pub async fn administering(st: &Shared, headers: &HeaderMap, rid: &RequestId, tenant: &str) -> Result<(RequestContext, String), AppError> {
    let who = bearer_who(st, headers).await?;
    let ctx = context_for(st, &who.user_id, rid, Some(tenant), None).await?;
    Ok((ctx, who.session_id))
}

/// `writeAudit` with the fields the administration fills.
pub async fn audit<E: Exec + Sync>(exec: &E, ctx: &RequestContext, action: &str, kind: &str, id: Option<&str>, name: Option<&str>, payload: Value) -> Result<(), AppError> {
    let mut entry = basedb_base::audit::AuditEntry::new(action, kind);
    entry.object_id = id.map(str::to_string);
    entry.object_name = name.map(str::to_string);
    if let Value::Object(m) = payload {
        entry.payload = m;
    }
    basedb_base::audit::write_audit(exec, ctx, &entry).await
}

/// `new Date(x).toISOString()`.
pub fn iso(at: DateTime<Utc>) -> String {
    basedb_base::time::iso(at)
}

pub fn iso_opt(at: Option<DateTime<Utc>>) -> Value {
    at.map(|a| json!(iso(a))).unwrap_or(Value::Null)
}

/// What `String(value)` gives an identifier taken from a body as-is (`as string`).
pub fn js_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        Value::Array(a) => a.iter().map(|x| if x.is_null() { String::new() } else { js_string(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
        other => other.to_string(),
    }
}

fn collator() -> &'static icu_collator::CollatorBorrowed<'static> {
    static C: OnceLock<icu_collator::CollatorBorrowed<'static>> = OnceLock::new();
    C.get_or_init(|| icu_collator::Collator::try_new(Default::default(), Default::default()).expect("collation ICU"))
}

/// `a.localeCompare(b, 'fr')`: French has no tailoring of its own in CLDR, the root order.
pub fn fr_cmp(a: &str, b: &str) -> Ordering {
    collator().compare(a, b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_and_labels() {
        assert_eq!(check_name(Some("  Léa  ")).unwrap(), "Léa");
        assert_eq!(check_name(Some("e\u{301}")).unwrap(), "é");
        assert_eq!(check_name(None).unwrap_err().code, "LABEL_EMPTY");
        assert_eq!(check_name(Some(&"é".repeat(121))).unwrap_err().code, "LABEL_TOO_LONG");
        assert!(check_name(Some(&"é".repeat(120))).is_ok());
        assert_eq!(label_key("  Équipe \t  Support "), "équipe support");
    }

    #[test]
    fn addresses() {
        assert!(valid_email("a@b"));
        assert!(!valid_email("a@b@c"));
        assert!(!valid_email("a b@c"));
        assert!(!valid_email("@c"));
        assert!(!valid_email(&format!("{}@b.fr", "a".repeat(250))));
        assert_eq!(checked_email("  lea@exemple.fr ").unwrap(), "lea@exemple.fr");
    }

    #[test]
    fn french_order() {
        let mut v = vec!["Zoé", "émile", "Émile", "alice", "Bob"];
        v.sort_by(|a, b| fr_cmp(a, b));
        assert_eq!(v, ["alice", "Bob", "émile", "Émile", "Zoé"]);
    }
}
