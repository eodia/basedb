//! Les jetons d'intégration (`bdb_<préfixe>_<secret>`), tels `verifyApiToken` de
//! `auth/tokens.ts` : crus pour UNE surface, ou refusés avec le code qui dit pourquoi —
//! inconnu ou hors surface → `TOKEN_INVALID`, révoqué → `TOKEN_REVOKED`, expiré →
//! `TOKEN_EXPIRED`, suspendu → `TOKEN_SUSPENDED`, créateur désactivé → `TOKEN_INVALID`.
//!
//! Un jeton cru l'est cinq secondes au plus (cache par processus : une révocation faite par
//! Node est vue ici au bout de ces cinq secondes). Chaque refus d'un jeton CONNU est un
//! événement de sécurité. `last_used_at` s'écrit au plus toutes les cinq minutes, hors
//! du travail de la requête.

use crate::audit::{write_security, SecurityEntry};
use crate::db::{Exec, Pools};
use crate::error::{AppError, SqlOp};
use crate::time::{constant_eq, hex, now_ms, sha256};
use crate::tx::Surface;
use chrono::{DateTime, Utc};
use regex::Regex;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

pub const TOKEN_CACHE_MS: i64 = 5_000;
const USAGE_THROTTLE_MS: i64 = 5 * 60_000;
/// What every integration token starts with.
pub const INTEGRATION_TOKEN_PREFIX: &str = "bdb_";

pub fn token_pattern() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^bdb_([a-z0-9]{8})_([0-9A-Za-z]{43})$").unwrap())
}

/// `VerifiedToken`.
#[derive(Debug, Clone, PartialEq)]
pub struct VerifiedToken {
    pub token_id: String,
    pub user_id: String,
    pub tenant_ref: String,
    pub base_id: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// The process's memory of believed tokens and of `last_used_at` writes.
#[derive(Default)]
pub struct TokenCache {
    verified: Mutex<HashMap<String, (VerifiedToken, i64)>>,
    touched: Mutex<HashMap<String, i64>>,
}

impl TokenCache {
    /// `forgetVerifiedTokens`: after a revocation made here.
    pub fn forget(&self) {
        self.verified.lock().unwrap().clear();
        self.touched.lock().unwrap().clear();
    }
}

/// `verifyApiToken`.
pub async fn verify_api_token(
    pools: &Pools,
    cache: &TokenCache,
    secret: Option<&str>,
    surface: Surface,
    request_id: Option<&str>,
    ip: Option<&str>,
) -> Result<VerifiedToken, AppError> {
    let Some(secret) = secret.filter(|s| token_pattern().is_match(s)) else { return Err(AppError::new("TOKEN_INVALID")) };
    let now = now_ms();
    let hash = sha256(secret.as_bytes());
    let key = format!("{}|{}", surface.as_str(), hex(&hash));
    {
        let mut verified = cache.verified.lock().unwrap();
        if let Some((token, at)) = verified.get(&key) {
            if now - at < TOKEN_CACHE_MS && token.expires_at.is_none_or(|e| e.timestamp_millis() > now) {
                return Ok(token.clone());
            }
        }
        verified.remove(&key);
    }

    let exec = pools.catalog().await?;
    let row = exec
        .first(
            "SELECT tk.id::text, tk.created_by::text, tk.base_id::text, tk.allowed_surfaces, tk.expires_at,
                    tk.revoked_at, tk.suspended_at, tk.token_hash, t.ref AS tenant_ref,
                    (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS creator_usable
               FROM _basedb.api_token tk
               JOIN _basedb.tenant t   ON t.id = tk.tenant_id
               JOIN _basedb.app_user u ON u.id = tk.created_by
              WHERE tk.token_hash = $1",
            &[&hash],
        )
        .await?;

    let refuse = |code: &'static str, token_id: Option<String>| {
        let exec = &exec;
        async move {
            if let Some(id) = token_id {
                let route = format!("/{}", surface.as_str());
                let _ = write_security(exec, &SecurityEntry { token_id: Some(&id), route: &route, error_code: code, request_id, ip, ..Default::default() }).await;
            }
            Err::<VerifiedToken, AppError>(AppError::new(code))
        }
    };

    let Some(r) = row else { return refuse("TOKEN_INVALID", None).await };
    let id: String = r.get(0);
    let stored: Vec<u8> = r.get(7);
    if !constant_eq(&stored, &hash) {
        return refuse("TOKEN_INVALID", Some(id)).await;
    }
    let surfaces: Vec<String> = r.get(3);
    if !surfaces.iter().any(|s| s == surface.as_str()) {
        return refuse("TOKEN_INVALID", Some(id)).await;
    }
    if r.get::<_, Option<DateTime<Utc>>>(5).is_some() {
        return refuse("TOKEN_REVOKED", Some(id)).await;
    }
    let expires_at: Option<DateTime<Utc>> = r.get(4);
    if expires_at.is_some_and(|e| e.timestamp_millis() <= now) {
        return refuse("TOKEN_EXPIRED", Some(id)).await;
    }
    if r.get::<_, Option<DateTime<Utc>>>(6).is_some() {
        return refuse("TOKEN_SUSPENDED", Some(id)).await;
    }
    if !r.get::<_, bool>(9) {
        return refuse("TOKEN_INVALID", Some(id)).await;
    }

    let token = VerifiedToken { token_id: id.clone(), user_id: r.get(1), tenant_ref: r.get(8), base_id: r.get(2), expires_at };
    cache.verified.lock().unwrap().insert(key, (token.clone(), now));

    let due = {
        let mut touched = cache.touched.lock().unwrap();
        let last = touched.get(&id).copied().unwrap_or(0);
        let due = now - last >= USAGE_THROTTLE_MS;
        if due {
            touched.insert(id.clone(), now);
        }
        due
    };
    if due {
        let pools = pools.clone();
        tokio::spawn(async move {
            if let Ok(c) = pools.catalog().await {
                let _ = c.execute_op("UPDATE _basedb.api_token SET last_used_at = clock_timestamp() WHERE id = $1::text::uuid", &[&id], SqlOp::Update).await;
            }
        });
    }
    Ok(token)
}
