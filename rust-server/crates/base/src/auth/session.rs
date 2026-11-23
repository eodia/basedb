//! Les sessions, telles `auth/session.ts` : le jeton de session (`bds_…`, seul son SHA-256
//! est stocké), le jeton CSRF dérivé de la session, le jeton d'accès (`bda_…`, signé HMAC
//! contre le `token_hash` COURANT de la session — une rotation invalide tous ceux émis), la
//! fenêtre d'inactivité, le plafond de dix sessions, la révocation et la rotation.
//!
//! Tout est compatible dans les deux sens avec Node : un cookie posé par l'un est cru par
//! l'autre, un jeton d'accès émis par l'un ouvre l'API de l'autre.

use crate::db::Exec;
use crate::error::{AppError, SqlOp};
use crate::time::{b64url, b64url_decode, constant_eq, hmac_sha256, iso, random_bytes, sha256};
use chrono::{DateTime, Duration, Utc};
use serde_json::json;

pub const SESSION_ABSOLUTE_MS: i64 = 30 * 24 * 60 * 60 * 1000;
pub const SESSION_INACTIVITY_MS: i64 = 12 * 60 * 60 * 1000;
pub const ACCESS_TOKEN_MS: i64 = 15 * 60 * 1000;
pub const TOUCH_THROTTLE_MS: i64 = 5 * 60 * 1000;
pub const SESSION_CAP: i64 = 10;
pub const ELEVATION_MS: i64 = 5 * 60 * 1000;
pub const SESSION_COOKIE: &str = "__Host-basedb_session";
pub const CSRF_COOKIE: &str = "__Host-basedb_csrf";
pub const CSRF_HEADER: &str = "x-basedb-csrf";
const SESSION_PREFIX: &str = "bds_";
const ACCESS_PREFIX: &str = "bda_";

/// `SessionSnapshot`.
#[derive(Debug, Clone)]
pub struct SessionSnapshot {
    pub session_id: String,
    pub user_id: String,
    pub tenant_ref: String,
    pub token_hash: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub absolute_expires_at: DateTime<Utc>,
    pub elevated_until: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub ip: Option<String>,
    pub user_agent: Option<String>,
    pub user_usable: bool,
}

/// `newSessionToken`.
pub fn new_session_token() -> (String, Vec<u8>) {
    let token = format!("{SESSION_PREFIX}{}", b64url(&random_bytes(32)));
    let hash = sha256(token.as_bytes());
    (token, hash)
}

/// `csrfFor`.
pub fn csrf_for(instance_key: &str, token_hash: &[u8]) -> String {
    b64url(&hmac_sha256(instance_key.as_bytes(), &[b"basedb/csrf/v1", token_hash]))
}

/// `csrfValid`.
pub fn csrf_valid(instance_key: &str, token_hash: &[u8], given: Option<&str>) -> bool {
    let Some(given) = given else { return false };
    constant_eq(csrf_for(instance_key, token_hash).as_bytes(), given.as_bytes())
}

const SNAPSHOT_COLUMNS: &str = "SELECT s.id::text, s.user_id::text, t.ref AS tenant_ref, s.token_hash, s.created_at,
              s.last_seen_at, s.absolute_expires_at, s.elevated_until, s.revoked_at,
              host(s.ip) AS ip, s.user_agent,
              (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS user_usable
         FROM _basedb.session s
         JOIN _basedb.app_user u ON u.id = s.user_id
         JOIN _basedb.tenant t   ON t.id = s.tenant_id";

fn snapshot_of(r: &tokio_postgres::Row) -> SessionSnapshot {
    SessionSnapshot {
        session_id: r.get(0),
        user_id: r.get(1),
        tenant_ref: r.get(2),
        token_hash: r.get(3),
        created_at: r.get(4),
        last_seen_at: r.get(5),
        absolute_expires_at: r.get(6),
        elevated_until: r.get(7),
        revoked_at: r.get(8),
        ip: r.get(9),
        user_agent: r.get(10),
        user_usable: r.get(11),
    }
}

/// `loadSessionByToken`: `None` for anything that is not a session token.
pub async fn load_session_by_token<E: Exec + Sync>(exec: &E, token: &str) -> Result<Option<SessionSnapshot>, AppError> {
    if !token.starts_with(SESSION_PREFIX) {
        return Ok(None);
    }
    let hash = sha256(token.as_bytes());
    Ok(exec.first(&format!("{SNAPSHOT_COLUMNS} WHERE s.token_hash = $1"), &[&hash]).await?.as_ref().map(snapshot_of))
}

/// `loadSessionById`.
pub async fn load_session_by_id<E: Exec + Sync>(exec: &E, session_id: &str) -> Result<Option<SessionSnapshot>, AppError> {
    Ok(exec.first(&format!("{SNAPSHOT_COLUMNS} WHERE s.id = $1::text::uuid"), &[&session_id]).await?.as_ref().map(snapshot_of))
}

/// `createSession`: a fresh token, then the cap of ten enforced.
pub async fn create_session<E: Exec + Sync>(
    exec: &E,
    user_id: &str,
    tenant_id: &str,
    ip: Option<&str>,
    user_agent: Option<&str>,
    now: DateTime<Utc>,
) -> Result<(String, String, DateTime<Utc>), AppError> {
    let (token, hash) = new_session_token();
    let absolute = now + Duration::milliseconds(SESSION_ABSOLUTE_MS);
    let agent: Option<String> = user_agent.map(|a| String::from_utf16_lossy(&a.encode_utf16().take(200).collect::<Vec<_>>()));
    let row = exec
        .query_op(
            "INSERT INTO _basedb.session
               (user_id, tenant_id, token_hash, absolute_expires_at, ip, user_agent)
             VALUES ($1::text::uuid, $2::text::uuid, $3, $4, $5::text::inet, $6)
             RETURNING id::text",
            &[&user_id, &tenant_id, &hash, &absolute, &ip, &agent],
            SqlOp::Insert,
        )
        .await?;
    let session_id: String = row.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("session sans identifiant"))?;
    exec.execute_op(
        "UPDATE _basedb.session
            SET revoked_at = clock_timestamp(), revoked_reason = 'session_cap'
          WHERE id IN (SELECT id FROM _basedb.session
                        WHERE user_id = $1::text::uuid AND revoked_at IS NULL
                        ORDER BY created_at DESC OFFSET $2)",
        &[&user_id, &SESSION_CAP],
        SqlOp::Update,
    )
    .await?;
    Ok((token, session_id, absolute))
}

/// `sessionUsable`.
pub fn session_usable(s: &SessionSnapshot, now: DateTime<Utc>) -> bool {
    s.revoked_at.is_none()
        && s.user_usable
        && s.absolute_expires_at > now
        && (now - s.last_seen_at).num_milliseconds() < SESSION_INACTIVITY_MS
}

fn sign_access(instance_key: &str, payload: &str, token_hash: &[u8]) -> String {
    b64url(&hmac_sha256(instance_key.as_bytes(), &[payload.as_bytes(), token_hash]))
}

/// `mintAccessToken`.
pub fn mint_access_token(instance_key: &str, s: &SessionSnapshot, now: DateTime<Utc>) -> (String, DateTime<Utc>) {
    let expires_at = now + Duration::milliseconds(ACCESS_TOKEN_MS);
    let payload = format!("{}.{}", s.session_id, expires_at.timestamp_millis());
    let signature = sign_access(instance_key, &payload, &s.token_hash);
    (format!("{ACCESS_PREFIX}{}", b64url(format!("{payload}.{signature}").as_bytes())), expires_at)
}

/// `AccessClaim`.
#[derive(Debug, Clone, PartialEq)]
pub struct AccessClaim {
    pub session_id: String,
    pub expires_at_ms: f64,
    pub signature: String,
    pub payload: String,
}

/// JavaScript's `Number(text)` for the cases a token can carry.
fn js_number(text: &str) -> f64 {
    let t = text.trim();
    if t.is_empty() {
        return 0.0;
    }
    if let Some(hex) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) {
        return i64::from_str_radix(hex, 16).map(|v| v as f64).unwrap_or(f64::NAN);
    }
    if t.chars().any(|c| c.is_ascii_alphabetic() && c != 'e' && c != 'E') {
        return if t == "Infinity" || t == "+Infinity" || t == "-Infinity" { f64::INFINITY } else { f64::NAN };
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

fn is_session_id(s: &str) -> bool {
    crate::time::is_uuid(s) && s.as_bytes()[14].is_ascii_hexdigit()
}

/// `decodeAccessToken`: what the token claims, nothing checked yet.
pub fn decode_access_token(token: &str) -> Option<AccessClaim> {
    let rest = token.strip_prefix(ACCESS_PREFIX)?;
    let bytes = b64url_decode(rest)?;
    let decoded = String::from_utf8_lossy(&bytes);
    let parts: Vec<&str> = decoded.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let (session_id, expires, signature) = (parts[0], parts[1], parts[2]);
    if !is_session_id(session_id) {
        return None;
    }
    let at = js_number(expires);
    if !at.is_finite() {
        return None;
    }
    Some(AccessClaim { session_id: session_id.into(), expires_at_ms: at, signature: signature.into(), payload: format!("{session_id}.{expires}") })
}

/// `accessTokenValid`.
pub fn access_token_valid(instance_key: &str, claim: &AccessClaim, s: &SessionSnapshot, now: DateTime<Utc>) -> bool {
    if claim.expires_at_ms <= now.timestamp_millis() as f64 {
        return false;
    }
    constant_eq(sign_access(instance_key, &claim.payload, &s.token_hash).as_bytes(), claim.signature.as_bytes())
}

/// `touchSession`: `last_seen_at`, at most once every five minutes.
pub async fn touch_session<E: Exec + Sync>(exec: &E, s: &SessionSnapshot, now: DateTime<Utc>) -> Result<(), AppError> {
    if (now - s.last_seen_at).num_milliseconds() < TOUCH_THROTTLE_MS {
        return Ok(());
    }
    exec.execute_op(
        "UPDATE _basedb.session SET last_seen_at = $2 WHERE id = $1::text::uuid AND revoked_at IS NULL",
        &[&s.session_id, &now],
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

/// What `revokeSessions` closes.
#[derive(Debug, Clone)]
pub enum RevokeScope<'a> {
    One { session_id: &'a str, user_id: &'a str },
    All { user_id: &'a str },
}

/// `revokeSessions`: how many were closed. The trigger on `session` bumps the tenant's
/// `authz_version` in the same statement.
pub async fn revoke_sessions<E: Exec + Sync>(exec: &E, scope: RevokeScope<'_>, reason: &str) -> Result<usize, AppError> {
    let rows = match scope {
        RevokeScope::One { session_id, user_id } => {
            exec.query_op(
                "UPDATE _basedb.session SET revoked_at = clock_timestamp(), revoked_reason = $3
                  WHERE id = $1::text::uuid AND user_id = $2::text::uuid AND revoked_at IS NULL RETURNING id",
                &[&session_id, &user_id, &reason],
                SqlOp::Update,
            )
            .await?
        }
        RevokeScope::All { user_id } => {
            exec.query_op(
                "UPDATE _basedb.session SET revoked_at = clock_timestamp(), revoked_reason = $2
                  WHERE user_id = $1::text::uuid AND revoked_at IS NULL RETURNING id",
                &[&user_id, &reason],
                SqlOp::Update,
            )
            .await?
        }
    };
    Ok(rows.len())
}

/// `rotateSession`: the old one revoked with `reason`, a new one carrying its address.
pub async fn rotate_session<E: Exec + Sync>(exec: &E, s: &SessionSnapshot, reason: &str, now: DateTime<Utc>) -> Result<(String, String), AppError> {
    revoke_sessions(exec, RevokeScope::One { session_id: &s.session_id, user_id: &s.user_id }, reason).await?;
    let tenant = exec
        .first("SELECT id::text FROM _basedb.tenant WHERE ref = $1", &[&s.tenant_ref])
        .await?
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("tenant", json!(s.tenant_ref)))?;
    let tenant_id: String = tenant.get(0);
    let (token, id, _) = create_session(exec, &s.user_id, &tenant_id, s.ip.as_deref(), s.user_agent.as_deref(), now).await?;
    Ok((token, id))
}

/// `setElevation`.
pub async fn set_elevation<E: Exec + Sync>(exec: &E, session_id: &str, until: Option<DateTime<Utc>>) -> Result<(), AppError> {
    exec.execute_op("UPDATE _basedb.session SET elevated_until = $2 WHERE id = $1::text::uuid", &[&session_id, &until], SqlOp::Update)
        .await?;
    Ok(())
}

/// One live session, as `listLiveSessions` returns it.
#[derive(Debug, Clone)]
pub struct LiveSession {
    pub id: String,
    pub created_at: String,
    pub last_seen_at: String,
    pub ip: Option<String>,
    pub user_agent: Option<String>,
}

/// `listLiveSessions`.
pub async fn list_live_sessions<E: Exec + Sync>(exec: &E, user_id: &str) -> Result<Vec<LiveSession>, AppError> {
    let rows = exec
        .rows(
            "SELECT id::text, created_at, last_seen_at, host(ip) AS ip, user_agent
               FROM _basedb.session
              WHERE user_id = $1::text::uuid AND revoked_at IS NULL AND absolute_expires_at > clock_timestamp()
              ORDER BY last_seen_at DESC",
            &[&user_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| LiveSession {
            id: r.get(0),
            created_at: iso(r.get(1)),
            last_seen_at: iso(r.get(2)),
            ip: r.get(3),
            user_agent: r.get(4),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot() -> SessionSnapshot {
        let now = Utc::now();
        SessionSnapshot {
            session_id: "0190a0b2-0000-7000-8000-000000000001".into(),
            user_id: "u".into(),
            tenant_ref: "t4z56fq".into(),
            token_hash: sha256(b"bds_x"),
            created_at: now,
            last_seen_at: now,
            absolute_expires_at: now + Duration::days(30),
            elevated_until: None,
            revoked_at: None,
            ip: None,
            user_agent: None,
            user_usable: true,
        }
    }

    #[test]
    fn access_tokens_round_trip_and_bind_to_the_session() {
        let s = snapshot();
        let now = Utc::now();
        let (token, expires) = mint_access_token("k", &s, now);
        assert!(token.starts_with("bda_"));
        let claim = decode_access_token(&token).unwrap();
        assert_eq!(claim.session_id, s.session_id);
        assert_eq!(claim.expires_at_ms, expires.timestamp_millis() as f64);
        assert!(access_token_valid("k", &claim, &s, now));
        assert!(!access_token_valid("autre", &claim, &s, now));
        assert!(!access_token_valid("k", &claim, &s, expires));
        let rotated = SessionSnapshot { token_hash: sha256(b"bds_y"), ..s };
        assert!(!access_token_valid("k", &claim, &rotated, now));
    }

    #[test]
    fn decoding_refuses_what_is_not_a_claim() {
        assert_eq!(decode_access_token("bds_x"), None);
        assert_eq!(decode_access_token(&format!("bda_{}", b64url(b"a.b.c"))), None);
        assert_eq!(decode_access_token(&format!("bda_{}", b64url(b"0190a0b2-0000-7000-8000-000000000001.x.c"))), None);
        assert!(decode_access_token(&format!("bda_{}", b64url(b"0190A0B2-0000-7000-8000-000000000001.12.c"))).is_some());
        assert_eq!(js_number(""), 0.0);
        assert!(js_number("Infinity").is_infinite());
    }

    #[test]
    fn csrf_is_derived_from_the_session() {
        let h = sha256(b"bds_x");
        let csrf = csrf_for("k", &h);
        assert!(csrf_valid("k", &h, Some(&csrf)));
        assert!(!csrf_valid("k", &h, None));
        assert!(!csrf_valid("k", &sha256(b"bds_y"), Some(&csrf)));
        let (token, hash) = new_session_token();
        assert!(token.starts_with("bds_") && token.len() == 47 && hash == sha256(token.as_bytes()));
    }

    #[test]
    fn usable_sessions() {
        let now = Utc::now();
        let s = snapshot();
        assert!(session_usable(&s, now));
        assert!(!session_usable(&SessionSnapshot { revoked_at: Some(now), ..s.clone() }, now));
        assert!(!session_usable(&SessionSnapshot { user_usable: false, ..s.clone() }, now));
        assert!(!session_usable(&SessionSnapshot { last_seen_at: now - Duration::hours(12), ..s.clone() }, now));
        assert!(!session_usable(&SessionSnapshot { absolute_expires_at: now, ..s }, now));
    }
}
