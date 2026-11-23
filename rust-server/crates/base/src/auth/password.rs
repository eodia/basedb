//! Les mots de passe, tels `auth/password.ts` : argon2id (m = 64 Mio, t = 3, p = 1, 32
//! octets — les paramètres de `@node-rs/argon2`), un poivre dérivé de la clé d'instance
//! (`HMAC(clé, "basedb/pepper/password/v1")`), le mot de passe normalisé NFKC, et la
//! politique (`PASSWORD_POLICY_VIOLATION`).
//!
//! Le format stocké est `v1$<PHC>` : un hachage écrit par Node se vérifie ici, et
//! inversement. Le calcul (lourd) tourne hors du fil asynchrone.

use crate::error::AppError;
use crate::time::{b64, hmac_sha256};
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};
use serde_json::json;
use unicode_normalization::UnicodeNormalization;

const KEY_VERSION: &str = "v1";
pub const PASSWORD_MIN: usize = 8;
pub const PASSWORD_MAX: usize = 256;

const DENIED: [&str; 39] = [
    "motdepasse", "password", "passw0rd", "password1234", "azertyuiop", "qwertyuiop", "123456789012", "administrateur",
    "administrator", "jaimelesfrites", "basedbbasedb", "changemechangeme", "letmeinletmein", "welcomewelcome",
    "iloveyouiloveyou", "motdepasse123", "password123!", "azerty123456", "qwerty123456", "12345678", "123456789",
    "1234567890", "11111111", "00000000", "azertyui", "qwertyui", "azerty12", "qwerty12", "azerty123", "qwerty123",
    "password1", "motdepasse1", "changeme", "iloveyou", "jetaime1", "bonjour1", "soleil123", "abc12345", "basedb123",
];

fn argon2() -> Argon2<'static> {
    Argon2::new(Algorithm::Argon2id, Version::V0x13, Params::new(65_536, 3, 1, Some(32)).expect("argon2 parameters"))
}

/// `pepperOf`.
fn pepper_of(instance_key: &str) -> Vec<u8> {
    hmac_sha256(instance_key.as_bytes(), &[b"basedb/pepper/password/v1"])
}

/// `peppered`: what argon2 actually hashes.
pub fn peppered(instance_key: &str, password: &str) -> String {
    let normalized: String = password.nfkc().collect();
    b64(&hmac_sha256(&pepper_of(instance_key), &[normalized.as_bytes()]))
}

/// JavaScript's `String.length`: UTF-16 code units.
fn js_length(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `checkPasswordPolicy`.
pub fn check_password_policy(password: &str, email: &str, display_name: &str) -> Result<(), AppError> {
    let refuse = |reason: &str| Err(AppError::new("PASSWORD_POLICY_VIOLATION").with("reason", json!(reason)));
    let normalized: String = password.nfkc().collect();
    if js_length(&normalized) < PASSWORD_MIN {
        return refuse("trop_court");
    }
    if js_length(&normalized) > PASSWORD_MAX {
        return refuse("trop_long");
    }
    let folded = normalized.to_lowercase();
    if DENIED.contains(&folded.as_str()) {
        return refuse("trop_courant");
    }
    let local = email.split('@').next().unwrap_or("");
    for piece in [email, local, display_name] {
        if js_length(piece) >= 3 && folded.contains(&piece.to_lowercase()) {
            return refuse("ressemble_a_identite");
        }
    }
    Ok(())
}

fn hash_with_salt(input: &str, salt: &[u8]) -> Result<String, AppError> {
    let salt = SaltString::encode_b64(salt).map_err(AppError::internal)?;
    Ok(argon2().hash_password(input.as_bytes(), &salt).map_err(AppError::internal)?.to_string())
}

/// `hashPassword`: `v1$<PHC>`.
pub async fn hash_password(instance_key: &str, password: &str) -> Result<String, AppError> {
    let input = peppered(instance_key, password);
    tokio::task::spawn_blocking(move || {
        let salt = crate::time::random_bytes(16);
        hash_with_salt(&input, &salt).map(|d| format!("{KEY_VERSION}${d}"))
    })
    .await
    .map_err(AppError::internal)?
}

/// `verifyPassword`: the digest after the first `$`; anything unreadable is `false`.
pub async fn verify_password(instance_key: &str, stored: &str, password: &str) -> bool {
    let Some(at) = stored.find('$') else { return false };
    let digest = stored[at + 1..].to_string();
    let input = peppered(instance_key, password);
    tokio::task::spawn_blocking(move || match PasswordHash::new(&digest) {
        Ok(parsed) => argon2().verify_password(input.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    })
    .await
    .unwrap_or(false)
}

/// `dummyVerify`: the same cost as a real verification, for an account that does not exist.
pub async fn dummy_verify(instance_key: &str) {
    let input = peppered(instance_key, "compte-inexistant");
    let _ = tokio::task::spawn_blocking(move || hash_with_salt(&input, &[7u8; 16])).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "cle-de-test";

    #[tokio::test]
    async fn hashes_and_verifies_with_the_pepper() {
        let stored = hash_password(KEY, "Granit-Ocean-7-Plume").await.unwrap();
        assert!(stored.starts_with("v1$$argon2id$v=19$m=65536,t=3,p=1$"), "{stored}");
        assert!(verify_password(KEY, &stored, "Granit-Ocean-7-Plume").await);
        assert!(!verify_password(KEY, &stored, "granit-ocean-7-plume").await);
        // Another instance's key: the same password no longer opens it.
        assert!(!verify_password("autre-cle", &stored, "Granit-Ocean-7-Plume").await);
        assert!(!verify_password(KEY, "pas-de-separateur", "x").await);
        assert!(!verify_password(KEY, "v1$illisible", "x").await);
        dummy_verify(KEY).await;
    }

    #[tokio::test]
    async fn normalizes_nfkc() {
        // "ﬁ" (U+FB01) is "fi" once normalized: both spellings open the account.
        let stored = hash_password(KEY, "ﬁlament-Ocean-7").await.unwrap();
        assert!(verify_password(KEY, &stored, "filament-Ocean-7").await);
    }

    // password.test.ts — the policy.
    #[test]
    fn policy() {
        let reason = |p: &str| check_password_policy(p, "jeanne.dupont@exemple.fr", "Jeanne").err().map(|e| e.details["reason"].clone());
        assert_eq!(reason("court"), Some(json!("trop_court")));
        assert_eq!(reason(&"x".repeat(257)), Some(json!("trop_long")));
        assert_eq!(reason("Password1"), Some(json!("trop_courant")));
        assert_eq!(reason("AZERTYUIOP"), Some(json!("trop_courant")));
        assert_eq!(reason("jeanne.dupont-2024"), Some(json!("ressemble_a_identite")));
        assert_eq!(reason("moi-JEANNE-ici"), Some(json!("ressemble_a_identite")));
        assert_eq!(reason("Granit-Ocean-7-Plume"), None);
        // Length is counted in UTF-16 units, after NFKC, like JavaScript's.
        assert_eq!(reason("😀😀😀😀"), None);
        assert_eq!(check_password_policy("Granit-Ocean-7", "a@b.c", "Al"), Ok(()));
    }
}
