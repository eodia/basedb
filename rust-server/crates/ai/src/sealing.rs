//! `auth/sealing.ts`, opening only: a provider key sealed under `BASEDB_ENCRYPTION_KEY`
//! (`v1.<iv>.<tag>.<ciphertext>` in base64url, AES-256-GCM, key derived per purpose).

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use basedb_base::time::{b64url_decode, hmac_sha256};

/// `None` for anything that does not open.
pub fn unseal(instance_key: &str, purpose: &str, sealed: &str) -> Option<String> {
    let parts: Vec<&str> = sealed.split('.').collect();
    if parts.len() != 4 || parts[0] != "v1" {
        return None;
    }
    let iv = b64url_decode(parts[1])?;
    let tag = b64url_decode(parts[2])?;
    let mut body = b64url_decode(parts[3])?;
    if iv.len() != 12 || tag.len() != 16 {
        return None;
    }
    let key = hmac_sha256(instance_key.as_bytes(), &[format!("basedb/seal/{purpose}/v1").as_bytes()]);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    body.extend_from_slice(&tag);
    let plain = cipher.decrypt(Nonce::from_slice(&iv), Payload { msg: &body, aad: &[] }).ok()?;
    String::from_utf8(plain).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_what_node_sealed() {
        assert_eq!(unseal("k", "p", "v1.5bIH-19Zu9q1oaBo.mxhgzo2VUQs8Mvo3iXe9Mg.9jy_G0Yp1Q").as_deref(), Some("bonjour"));
        assert_eq!(unseal("k", "autre", "v1.5bIH-19Zu9q1oaBo.mxhgzo2VUQs8Mvo3iXe9Mg.9jy_G0Yp1Q"), None);
    }
}
