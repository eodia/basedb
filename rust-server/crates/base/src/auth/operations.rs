//! Les opérations d'authentification, telles `auth/operations.ts` : connexion par mot de
//! passe (verrouillage exact par ligne, hachage factice pour un compte inconnu), cookie,
//! jeton d'accès, déconnexion, changement et réinitialisation de mot de passe, identité,
//! révocation, élévation.
//!
//! Chaque opération tient sur une connexion `catalog` en mode autocommit, comme
//! `pools.withConnection('catalog', …)` dans Node.

use super::password::{check_password_policy, dummy_verify, hash_password, verify_password};
use super::session::*;
use crate::db::{Exec, Pools};
use crate::error::{AppError, SqlOp};
use crate::time::{iso, sha256};
use chrono::{DateTime, Duration, Utc};
use serde_json::json;
use unicode_normalization::UnicodeNormalization;

const LOCKOUT_MINUTES: [i32; 5] = [15, 30, 60, 240, 1440];
const LOCKOUT_EVERY: i32 = 10;

/// `normalizeEmail`.
pub fn normalize_email(email: &str) -> String {
    email.nfkc().collect::<String>().trim().to_lowercase()
}

/// Every authentication failure, whatever its cause.
fn refuse<T>() -> Result<T, AppError> {
    Err(AppError::new("CREDENTIALS_INVALID"))
}

fn auth_required<T>() -> Result<T, AppError> {
    Err(AppError::new("AUTHENTICATION_REQUIRED"))
}

#[derive(Debug, Clone)]
struct PasswordIdentity {
    identity_id: String,
    user_id: String,
    tenant_id: String,
    tenant_ref: String,
    password_hash: String,
    failed_attempts: i32,
    locked_until: Option<DateTime<Utc>>,
    usable: bool,
}

async fn load_password_identity<E: Exec + Sync>(exec: &E, email: &str) -> Result<Option<PasswordIdentity>, AppError> {
    let row = exec
        .first(
            "SELECT i.id::text, i.user_id::text, u.tenant_id::text, t.ref AS tenant_ref,
                    u.email, u.display_name, i.password_hash,
                    i.failed_attempts::int, i.locked_until,
                    (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS usable
               FROM _basedb.auth_identity i
               JOIN _basedb.app_user u ON u.id = i.user_id
               JOIN _basedb.tenant t   ON t.id = u.tenant_id
              WHERE i.provider = 'password' AND i.subject = $1",
            &[&email],
        )
        .await?;
    let Some(r) = row else { return Ok(None) };
    let Some(password_hash) = r.get::<_, Option<String>>(6) else { return Ok(None) };
    Ok(Some(PasswordIdentity {
        identity_id: r.get(0),
        user_id: r.get(1),
        tenant_id: r.get(2),
        tenant_ref: r.get(3),
        password_hash,
        failed_attempts: r.get(7),
        locked_until: r.get(8),
        usable: r.get(9),
    }))
}

/// `recordFailure`: every ten failures, the lock moves to its next duration.
async fn record_failure<E: Exec + Sync>(exec: &E, identity: &PasswordIdentity) -> Result<(), AppError> {
    let attempts = identity.failed_attempts + 1;
    let step = attempts / LOCKOUT_EVERY - 1;
    let locks = attempts % LOCKOUT_EVERY == 0 && step >= 0;
    let minutes = if step < 0 { LOCKOUT_MINUTES[0] } else { LOCKOUT_MINUTES[(step as usize).min(LOCKOUT_MINUTES.len() - 1)] };
    exec.execute_op(
        "UPDATE _basedb.auth_identity
            SET failed_attempts = $2,
                locked_until = CASE WHEN $3::boolean
                                    THEN clock_timestamp() + make_interval(mins => $4::int)
                                    ELSE locked_until END
          WHERE id = $1::text::uuid",
        &[&identity.identity_id, &(attempts as i16), &locks, &minutes],
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

/// `LoginResult`.
#[derive(Debug, Clone)]
pub struct LoginResult {
    pub session_token: String,
    pub csrf_token: String,
    pub session_id: String,
    pub absolute_expires_at: DateTime<Utc>,
    pub user_id: String,
    pub tenant_ref: String,
}

/// `login`.
pub async fn login(pools: &Pools, instance_key: &str, email: &str, password: &str, ip: Option<&str>, user_agent: Option<&str>) -> Result<LoginResult, AppError> {
    let now = Utc::now();
    let email = normalize_email(email);
    let exec = pools.catalog().await?;
    let Some(identity) = load_password_identity(&exec, &email).await? else {
        dummy_verify(instance_key).await;
        return refuse();
    };
    if identity.locked_until.is_some_and(|l| l > now) {
        dummy_verify(instance_key).await;
        return refuse();
    }
    let ok = verify_password(instance_key, &identity.password_hash, password).await;
    if !ok || !identity.usable {
        record_failure(&exec, &identity).await?;
        return refuse();
    }
    exec.execute_op(
        "UPDATE _basedb.auth_identity
            SET failed_attempts = 0, locked_until = NULL, last_used_at = clock_timestamp()
          WHERE id = $1::text::uuid",
        &[&identity.identity_id],
        SqlOp::Update,
    )
    .await?;
    let (token, session_id, absolute) = create_session(&exec, &identity.user_id, &identity.tenant_id, ip, user_agent, now).await?;
    Ok(LoginResult {
        csrf_token: csrf_for(instance_key, &sha256(token.as_bytes())),
        session_token: token,
        session_id,
        absolute_expires_at: absolute,
        user_id: identity.user_id,
        tenant_ref: identity.tenant_ref,
    })
}

/// `Authenticated`: a credential, once believed.
#[derive(Debug, Clone, PartialEq)]
pub struct Authenticated {
    pub user_id: String,
    pub tenant_ref: String,
    pub session_id: String,
    pub elevated_until: Option<DateTime<Utc>>,
}

fn as_authenticated(s: &SessionSnapshot) -> Authenticated {
    Authenticated { user_id: s.user_id.clone(), tenant_ref: s.tenant_ref.clone(), session_id: s.session_id.clone(), elevated_until: s.elevated_until }
}

/// `authenticateCookie`: absent, malformed, unknown, expired, revoked — one refusal (401).
pub async fn authenticate_cookie(pools: &Pools, token: Option<&str>) -> Result<Authenticated, AppError> {
    let now = Utc::now();
    let Some(token) = token.filter(|t| !t.is_empty()) else { return auth_required() };
    let exec = pools.catalog().await?;
    let Some(s) = load_session_by_token(&exec, token).await?.filter(|s| session_usable(s, now)) else { return auth_required() };
    touch_session(&exec, &s, now).await?;
    Ok(as_authenticated(&s))
}

/// `authenticateAccessToken`: the session re-read at every request.
pub async fn authenticate_access_token(pools: &Pools, instance_key: &str, token: Option<&str>) -> Result<Authenticated, AppError> {
    let now = Utc::now();
    let Some(claim) = token.and_then(decode_access_token) else { return auth_required() };
    let exec = pools.catalog().await?;
    let Some(s) = load_session_by_id(&exec, &claim.session_id).await?.filter(|s| session_usable(s, now)) else { return auth_required() };
    if !access_token_valid(instance_key, &claim, &s, now) {
        return auth_required();
    }
    touch_session(&exec, &s, now).await?;
    Ok(as_authenticated(&s))
}

/// `issueAccessToken`: the cookie AND the CSRF header, for an access token. Writes nothing.
pub async fn issue_access_token(pools: &Pools, instance_key: &str, session_token: Option<&str>, csrf: Option<&str>) -> Result<(String, DateTime<Utc>), AppError> {
    let now = Utc::now();
    let Some(session_token) = session_token else { return auth_required() };
    let exec = pools.catalog().await?;
    let Some(s) = load_session_by_token(&exec, session_token).await?.filter(|s| session_usable(s, now)) else { return auth_required() };
    if !csrf_valid(instance_key, &s.token_hash, csrf) {
        return auth_required();
    }
    Ok(mint_access_token(instance_key, &s, now))
}

/// `logout`: closes the current session, if any.
pub async fn logout(pools: &Pools, session_token: Option<&str>) -> Result<(), AppError> {
    let Some(token) = session_token else { return Ok(()) };
    let exec = pools.catalog().await?;
    if let Some(s) = load_session_by_token(&exec, token).await? {
        revoke_sessions(&exec, RevokeScope::One { session_id: &s.session_id, user_id: &s.user_id }, "logout").await?;
    }
    Ok(())
}

/// `setPassword`: no proof of the previous one — bootstrap, administration, reset.
pub async fn set_password(pools: &Pools, instance_key: &str, user_id: &str, password: &str) -> Result<(), AppError> {
    let exec = pools.catalog().await?;
    let Some(user) = exec.first("SELECT email, display_name FROM _basedb.app_user WHERE id = $1::text::uuid", &[&user_id]).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    };
    let (email, display_name): (String, String) = (user.get(0), user.get(1));
    check_password_policy(password, &email, &display_name)?;
    let stored = hash_password(instance_key, password).await?;
    exec.execute_op(
        "INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
         VALUES ($1::text::uuid, 'password', $2, $3)
         ON CONFLICT (provider, subject)
         DO UPDATE SET password_hash = EXCLUDED.password_hash,
                       failed_attempts = 0,
                       locked_until = NULL",
        &[&user_id, &normalize_email(&email), &stored],
        SqlOp::Insert,
    )
    .await?;
    exec.execute_op("UPDATE _basedb.app_user SET must_change_password = false WHERE id = $1::text::uuid", &[&user_id], SqlOp::Update).await?;
    revoke_sessions(&exec, RevokeScope::All { user_id }, "password_changed").await?;
    Ok(())
}

/// `IssuedSession`.
#[derive(Debug, Clone)]
pub struct IssuedSession {
    pub session_token: String,
    pub csrf_token: String,
    pub session_id: String,
}

fn issued(instance_key: &str, token: String, session_id: String) -> IssuedSession {
    IssuedSession { csrf_token: csrf_for(instance_key, &sha256(token.as_bytes())), session_token: token, session_id }
}

/// `changePassword`: every session closed, this one included, and a fresh one issued.
pub async fn change_password(pools: &Pools, instance_key: &str, user_id: &str, current: &str, next: &str) -> Result<IssuedSession, AppError> {
    let now = Utc::now();
    let identity = {
        let exec = pools.catalog().await?;
        let Some(row) = exec.first("SELECT email FROM _basedb.app_user WHERE id = $1::text::uuid", &[&user_id]).await? else {
            return auth_required();
        };
        load_password_identity(&exec, &normalize_email(&row.get::<_, String>(0))).await?
    };
    let Some(identity) = identity else { return refuse() };
    if !verify_password(instance_key, &identity.password_hash, current).await {
        return refuse();
    }
    set_password(pools, instance_key, user_id, next).await?;
    let exec = pools.catalog().await?;
    let (token, session_id, _) = create_session(&exec, &identity.user_id, &identity.tenant_id, None, None, now).await?;
    Ok(issued(instance_key, token, session_id))
}

/// What `whoAmI` answers.
#[derive(Debug, Clone)]
pub struct Me {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub tenant_ref: String,
    pub is_instance_admin: bool,
    pub is_admin: bool,
    pub must_change_password: bool,
    pub elevated_until: Option<String>,
    pub has_password: bool,
    pub date_format: String,
    pub week_start: i32,
    pub muted_notifications: Vec<String>,
    pub mailed_notifications: Vec<String>,
    pub locale: Option<String>,
}

/// `whoAmI`.
pub async fn who_am_i(pools: &Pools, who: &Authenticated) -> Result<Me, AppError> {
    let exec = pools.catalog().await?;
    let Some(u) = exec
        .first(
            "SELECT u.email, u.display_name, u.is_instance_admin, u.must_change_password,
                    EXISTS (SELECT 1 FROM _basedb.role_member m
                              JOIN _basedb.role r ON r.id = m.role_id
                             WHERE m.user_id = u.id AND r.name = 'tenant_admin'
                               AND r.is_system AND r.deleted_at IS NULL) AS in_admins,
                    EXISTS (SELECT 1 FROM _basedb.auth_identity i
                             WHERE i.user_id = u.id AND i.provider = 'password') AS has_password,
                    u.date_format, u.week_start::int, u.muted_notifications, u.mailed_notifications,
                    u.locale
               FROM _basedb.app_user u WHERE u.id = $1::text::uuid",
            &[&who.user_id],
        )
        .await?
    else {
        return auth_required();
    };
    let is_instance_admin: bool = u.get(2);
    let in_admins: bool = u.get(4);
    let week_start: i32 = u.get(7);
    Ok(Me {
        id: who.user_id.clone(),
        email: u.get(0),
        display_name: u.get(1),
        tenant_ref: who.tenant_ref.clone(),
        is_instance_admin,
        is_admin: is_instance_admin || in_admins,
        must_change_password: u.get(3),
        elevated_until: who.elevated_until.map(iso),
        has_password: u.get(5),
        date_format: u.get(6),
        week_start: if week_start == 0 { 0 } else { 1 },
        muted_notifications: u.get(8),
        mailed_notifications: u.get(9),
        locale: u.get(10),
    })
}

/// `revoke`: one session of its owner (a stranger's answers as unknown), or all of them.
pub async fn revoke(pools: &Pools, who: &Authenticated, session_id: Option<&str>) -> Result<(), AppError> {
    let exec = pools.catalog().await?;
    match session_id {
        Some(id) => {
            let n = revoke_sessions(&exec, RevokeScope::One { session_id: id, user_id: &who.user_id }, "revoked_by_owner").await?;
            if n == 0 {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("session", json!(id)));
            }
        }
        None => {
            revoke_sessions(&exec, RevokeScope::All { user_id: &who.user_id }, "revoked_all").await?;
        }
    }
    Ok(())
}

/// `listLiveSessions`.
pub async fn list_sessions(pools: &Pools, who: &Authenticated) -> Result<Vec<LiveSession>, AppError> {
    let exec = pools.catalog().await?;
    list_live_sessions(&exec, &who.user_id).await
}

/// `elevate`: five minutes, proved by the password; the session token rotates.
pub async fn elevate(pools: &Pools, instance_key: &str, session_token: Option<&str>, password: &str) -> Result<(IssuedSession, DateTime<Utc>), AppError> {
    let now = Utc::now();
    let Some(session_token) = session_token else { return auth_required() };
    let exec = pools.catalog().await?;
    let Some(s) = load_session_by_token(&exec, session_token).await?.filter(|s| session_usable(s, now)) else { return auth_required() };
    let user = exec.first("SELECT email FROM _basedb.app_user WHERE id = $1::text::uuid", &[&s.user_id]).await?;
    let identity = match user {
        None => None,
        Some(u) => load_password_identity(&exec, &normalize_email(&u.get::<_, String>(0))).await?,
    };
    let Some(identity) = identity else {
        dummy_verify(instance_key).await;
        return refuse();
    };
    if !verify_password(instance_key, &identity.password_hash, password).await {
        record_failure(&exec, &identity).await?;
        return refuse();
    }
    let (token, session_id) = rotate_session(&exec, &s, "elevated", now).await?;
    let until = now + Duration::milliseconds(ELEVATION_MS);
    set_elevation(&exec, &session_id, Some(until)).await?;
    Ok((issued(instance_key, token, session_id), until))
}

/// `dropElevation`.
pub async fn drop_elevation(pools: &Pools, session_token: Option<&str>) -> Result<(), AppError> {
    let now = Utc::now();
    let Some(session_token) = session_token else { return auth_required() };
    let exec = pools.catalog().await?;
    let Some(s) = load_session_by_token(&exec, session_token).await?.filter(|s| session_usable(s, now)) else { return auth_required() };
    set_elevation(&exec, &s.session_id, None).await
}

/// `confirmPasswordReset`: the challenge consumed in the statement that finds it.
pub async fn confirm_password_reset(pools: &Pools, instance_key: &str, secret: &str, password: &str) -> Result<(), AppError> {
    let now = Utc::now();
    let user_id: Option<String> = {
        let exec = pools.catalog().await?;
        exec.query_op(
            "UPDATE _basedb.confirmation_challenge
                SET consumed_at = clock_timestamp()
              WHERE challenge_hash = $1
                AND operation = 'password.reset'
                AND consumed_at IS NULL
                AND expires_at > $2
              RETURNING id, actor_user_id::text",
            &[&sha256(secret.as_bytes()), &now],
            SqlOp::Update,
        )
        .await?
        .first()
        .and_then(|r| r.get::<_, Option<String>>(1))
    };
    let Some(user_id) = user_id else { return Err(AppError::new("RESET_TOKEN_INVALID")) };
    set_password(pools, instance_key, &user_id, password).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emails_are_normalized() {
        assert_eq!(normalize_email("  Admin@BaseDB.Local "), "admin@basedb.local");
        assert_eq!(normalize_email("ｊｅａｎ@exemple.fr"), "jean@exemple.fr");
    }
}
