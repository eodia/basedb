//! The pictures of a document — `documents/images.ts`, chapter 21 §1.3: PNG and JPEG only,
//! sent with the template as a `data:` address, or an `image` field of the row.

use base64::Engine;
use basedb_base::db::{Exec, PoolName};
use basedb_base::AppState;
use serde_json::Value;
use std::sync::LazyLock;

pub const MAX_IMAGE_BYTES: usize = 300 * 1024;
pub const MAX_FIELD_IMAGE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImageType {
    Png,
    Jpeg,
}

#[derive(Clone, Copy, Debug)]
pub struct ImageFacts {
    pub kind: ImageType,
    pub width: u32,
    pub height: u32,
}

impl ImageFacts {
    pub fn mime(&self) -> &'static str {
        match self.kind {
            ImageType::Png => "image/png",
            ImageType::Jpeg => "image/jpeg",
        }
    }
}

const SOF: [u8; 13] = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];

/// `imageFacts`: what a PNG or a JPEG says of itself.
pub fn image_facts(bytes: &[u8]) -> Option<ImageFacts> {
    let at = |i: usize| *bytes.get(i).unwrap_or(&0) as u32;
    let u16_ = |i: usize| (at(i) << 8) | at(i + 1);
    let u32_ = |i: usize| u16_(i) * 0x10000 + u16_(i + 2);
    let sane = |w: u32, h: u32| w > 0 && h > 0 && w <= 20_000 && h <= 20_000;
    const PNG: [u8; 8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if bytes.len() >= 24 && bytes[..8] == PNG {
        let (width, height) = (u32_(16), u32_(20));
        return (&bytes[12..16] == b"IHDR" && sane(width, height)).then_some(ImageFacts { kind: ImageType::Png, width, height });
    }
    if bytes.len() >= 4 && bytes[0] == 0xff && bytes[1] == 0xd8 {
        let mut i = 2usize;
        while i + 9 < bytes.len() {
            if bytes[i] != 0xff {
                return None;
            }
            let marker = bytes[i + 1];
            if marker == 0xff {
                i += 1;
                continue;
            }
            if marker == 0xd8 || (0xd0..=0xd7).contains(&marker) || marker == 0x01 {
                i += 2;
                continue;
            }
            if SOF.contains(&marker) {
                let (height, width) = (u16_(i + 5), u16_(i + 7));
                return sane(width, height).then_some(ImageFacts { kind: ImageType::Jpeg, width, height });
            }
            if marker == 0xd9 || marker == 0xda {
                return None;
            }
            i += 2 + u16_(i + 2) as usize;
        }
    }
    None
}

pub enum Decoded {
    Invalid,
    TooLarge,
    Image(Vec<u8>, ImageFacts),
}

static DATA_URL: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"^data:(image/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$").unwrap());

/// `Buffer.from(text, 'base64')` on an alphabet-clean text: lenient on the length.
pub fn node_base64(text: &str) -> Vec<u8> {
    let clean = text.trim_end_matches('=');
    let mut out = Vec::with_capacity(clean.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0u32);
    for b in clean.bytes() {
        let v = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            _ => break,
        } as u32;
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    out
}

/// `decodeImage`.
pub fn decode_image(text: Option<&Value>) -> Decoded {
    let Some(text) = text.and_then(Value::as_str) else { return Decoded::Invalid };
    if crate::js::js_length(text) > (MAX_IMAGE_BYTES * 4).div_ceil(3) + 64 {
        return Decoded::TooLarge;
    }
    let compact: String = text.chars().filter(|c| !crate::js::is_js_space(*c)).collect();
    let Some(m) = DATA_URL.captures(&compact) else { return Decoded::Invalid };
    let bytes = node_base64(&m[2]);
    if bytes.len() > MAX_IMAGE_BYTES {
        return Decoded::TooLarge;
    }
    match image_facts(&bytes) {
        Some(facts) => Decoded::Image(bytes, facts),
        None => Decoded::Invalid,
    }
}

/// `dataUrlOf`.
pub fn data_url_of(bytes: &[u8], facts: &ImageFacts) -> String {
    format!("data:{};base64,{}", facts.mime(), base64::engine::general_purpose::STANDARD.encode(bytes))
}

static FILE_ID: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"(?i)^[0-9a-f-]{36}$").unwrap());

/// `fieldImage`: the first PNG or JPEG of an image field's value — `None` when there is none
/// or when the file is not what the field says it holds.
pub async fn field_image(st: &AppState, table_id: &str, field: &str, value: Option<&Value>) -> Option<Vec<u8>> {
    let entries = value?.as_array()?;
    let first = entries
        .iter()
        .filter(|v| v.get("id").and_then(Value::as_str).is_some_and(|id| FILE_ID.is_match(id)))
        .find(|e| matches!(e.get("type").and_then(Value::as_str), Some("image/png" | "image/jpeg")))?;
    let id = first.get("id").and_then(Value::as_str)?.to_string();
    let conn = st.pools.get(PoolName::Catalog).await.ok()?;
    let row = conn
        .first(
            "SELECT sf.storage_key, sf.mime_type, sf.size_bytes::text
               FROM _basedb.stored_file sf
               JOIN _basedb.field f ON f.id = sf.field_id
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE sf.id = $1::text::uuid AND f.table_id = $2::text::uuid AND n.name = $3",
            &[&id, &table_id, &field],
        )
        .await
        .ok()??;
    drop(conn);
    let (key, mime, size): (String, String, String) = (row.get(0), row.get(1), row.get(2));
    if (mime != "image/png" && mime != "image/jpeg") || size.parse::<f64>().unwrap_or(f64::NAN) > MAX_FIELD_IMAGE_BYTES as f64 {
        return None;
    }
    let body = basedb_records::storage::Storage::new(&st.cfg.files, &st.https).get(&key).await.ok()?;
    let bytes = axum::body::to_bytes(body, MAX_FIELD_IMAGE_BYTES).await.ok()?;
    image_facts(&bytes).map(|_| bytes.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_like_buffer() {
        assert_eq!(node_base64("QUJD"), b"ABC");
        assert_eq!(node_base64("QUI"), b"AB");
        assert_eq!(node_base64("QUI="), b"AB");
        let mut png = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&[0, 0, 0, 2, 0, 0, 0, 3]);
        let f = image_facts(&png).unwrap();
        assert_eq!((f.width, f.height, f.mime()), (2, 3, "image/png"));
        assert!(image_facts(b"GIF89a....................").is_none());
    }
}
