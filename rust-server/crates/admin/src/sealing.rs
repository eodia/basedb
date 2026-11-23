//! `auth/sealing.ts`: AES-256-GCM under a key derived per purpose from the instance key,
//! `v1.<iv>.<tag>.<ciphertext>` in base64url.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use basedb_base::time::{b64url, b64url_decode, hmac_sha256, random_bytes};

fn key_for(instance_key: &str, purpose: &str) -> Vec<u8> {
    hmac_sha256(instance_key.as_bytes(), &[format!("basedb/seal/{purpose}/v1").as_bytes()])
}

pub fn seal(instance_key: &str, purpose: &str, plaintext: &str) -> String {
    let key = key_for(instance_key, purpose);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let iv = random_bytes(12);
    let mut sealed = cipher.encrypt(Nonce::from_slice(&iv), Payload { msg: plaintext.as_bytes(), aad: &[] }).expect("AES-GCM");
    let tag = sealed.split_off(sealed.len() - 16);
    format!("v1.{}.{}.{}", b64url(&iv), b64url(&tag), b64url(&sealed))
}

/// `None` for anything that does not open: wrong tag, other purpose, truncated value.
pub fn unseal(instance_key: &str, purpose: &str, sealed: &str) -> Option<String> {
    let parts: Vec<&str> = sealed.split('.').collect();
    if parts.len() != 4 || parts[0] != "v1" {
        return None;
    }
    let iv = b64url_decode(parts[1])?;
    let tag = b64url_decode(parts[2])?;
    let mut body = b64url_decode(parts[3])?;
    // Node accepts other IV lengths; the product only ever writes 12 bytes.
    if iv.len() != 12 || tag.len() != 16 {
        return None;
    }
    let key = key_for(instance_key, purpose);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    body.extend_from_slice(&tag);
    let plain = cipher.decrypt(Nonce::from_slice(&iv), Payload { msg: &body, aad: &[] }).ok()?;
    String::from_utf8(plain).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seals_and_opens_per_purpose() {
        let sealed = seal("clé", "invitation", "secret à garder");
        assert!(sealed.starts_with("v1."));
        assert_eq!(unseal("clé", "invitation", &sealed).as_deref(), Some("secret à garder"));
        assert_eq!(unseal("clé", "oidc-client-secret", &sealed), None);
        assert_eq!(unseal("autre", "invitation", &sealed), None);
        assert_eq!(unseal("clé", "invitation", "v2.a.b.c"), None);
        assert_eq!(unseal("clé", "invitation", &sealed[..sealed.len() - 2]), None);
    }

    /// A value sealed by Node (`seal('k', 'p', 'bonjour')`) opens here.
    #[test]
    fn opens_what_node_sealed() {
        assert_eq!(unseal("k", "p", "v1.5bIH-19Zu9q1oaBo.mxhgzo2VUQs8Mvo3iXe9Mg.9jy_G0Yp1Q").as_deref(), Some("bonjour"));
    }
}
