//! Le temps et la petite cryptographie partagés : dates au format de JavaScript
//! (`toISOString`), base64url sans remplissage, SHA-256, HMAC-SHA256, comparaison en temps
//! constant, octets aléatoires.

use base64::Engine;
use chrono::{DateTime, SecondsFormat, TimeZone, Utc};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

/// `Date.prototype.toISOString`: milliseconds, `Z`.
pub fn iso(at: DateTime<Utc>) -> String {
    at.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// `Date.now()`.
pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// `new Date(ms)`.
pub fn from_ms(ms: i64) -> DateTime<Utc> {
    Utc.timestamp_millis_opt(ms).single().unwrap_or_default()
}

/// `Buffer.toString('base64url')`.
pub fn b64url(bytes: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// `Buffer.from(text, 'base64url')` — lenient like Node: padding accepted, junk → `None`.
pub fn b64url_decode(text: &str) -> Option<Vec<u8>> {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(text.trim_end_matches('=')).ok()
}

pub fn b64(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

pub fn sha256(bytes: &[u8]) -> Vec<u8> {
    Sha256::digest(bytes).to_vec()
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn hmac_sha256(key: &[u8], parts: &[&[u8]]) -> Vec<u8> {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(key).expect("HMAC accepts any key");
    for p in parts {
        mac.update(p);
    }
    mac.finalize().into_bytes().to_vec()
}

/// `timingSafeEqual` after a length check.
pub fn constant_eq(a: &[u8], b: &[u8]) -> bool {
    use subtle::ConstantTimeEq;
    a.len() == b.len() && bool::from(a.ct_eq(b))
}

/// `randomBytes(n)`.
pub fn random_bytes(n: usize) -> Vec<u8> {
    let mut out = vec![0u8; n];
    getrandom::getrandom(&mut out).expect("system randomness");
    out
}

/// `^[0-9a-f]{8}-…$`, any case.
pub fn is_uuid(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36 && b.iter().enumerate().all(|(i, c)| if matches!(i, 8 | 13 | 18 | 23) { *c == b'-' } else { c.is_ascii_hexdigit() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_and_encodings_are_javascript_s() {
        assert_eq!(iso(from_ms(1_700_000_000_123)), "2023-11-14T22:13:20.123Z");
        assert_eq!(iso(from_ms(0)), "1970-01-01T00:00:00.000Z");
        assert_eq!(b64url(&[0xfb, 0xff]), "-_8");
        assert_eq!(b64url_decode("-_8").unwrap(), vec![0xfb, 0xff]);
        assert_eq!(hex(&sha256(b"abc"))[..8].to_string(), "ba7816bf");
        assert!(constant_eq(b"ab", b"ab") && !constant_eq(b"ab", b"abc"));
        assert!(is_uuid("0190A0B2-0000-7000-8000-000000000001") && !is_uuid("x"));
    }
}
