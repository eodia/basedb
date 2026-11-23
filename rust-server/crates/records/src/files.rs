//! Signed file links — `files/operations.ts` (`fileLink`, `withFileLinks`): what a reader
//! downloads a file of a `file`/`image` column from. Same key as Node, same six-hour windows:
//! a link minted here opens on Node and the other way round.

use crate::storage::Storage;
use axum::http::HeaderValue;
use axum::response::Response;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action};
use basedb_base::rbac::loader::{load_fields, load_grants, load_target};
use basedb_base::time::{b64url, constant_eq, hex, hmac_sha256, sha256};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_catalog::js::encode_uri_component;
use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};

const LINK_WINDOW_MS: i64 = 6 * 60 * 60 * 1000;

/// `linkKey`: the instance key, separated by domain.
pub fn link_key(instance_key: &str) -> Vec<u8> {
    hmac_sha256(instance_key.as_bytes(), &[b"basedb/files/link/v1"])
}

fn expiry_of(now: DateTime<Utc>) -> i64 {
    ((now.timestamp_millis().div_euclid(LINK_WINDOW_MS) + 2) * LINK_WINDOW_MS) / 1000
}

/// `fileLink`.
pub fn file_link(key: &[u8], tenant: &str, id: &str, name: &str, now: DateTime<Utc>) -> String {
    let expires = expiry_of(now);
    let sig = b64url(&hmac_sha256(key, &[format!("{tenant}\n{id}\n{expires}").as_bytes()]));
    let sig: String = sig.chars().take(32).collect();
    format!("/api/v1/{}/files/{id}/{}?exp={expires}&sig={sig}", encode_uri_component(tenant), encode_uri_component(name))
}

/// `withFileLinks`: each file of the given columns gains its `url`.
pub fn with_file_links(key: &[u8], tenant: &str, now: DateTime<Utc>, rows: Vec<Map<String, Value>>, columns: &[String]) -> Vec<Map<String, Value>> {
    if columns.is_empty() {
        return rows;
    }
    rows.into_iter()
        .map(|mut row| {
            for column in columns {
                let Some(Value::Array(entries)) = row.get_mut(column) else { continue };
                for entry in entries.iter_mut() {
                    let Value::Object(file) = entry else { continue };
                    let Some(id) = file.get("id").and_then(Value::as_str).map(str::to_string) else { continue };
                    let name = match file.get("name") {
                        None | Some(Value::Null) => "fichier".to_string(),
                        Some(Value::String(s)) => s.clone(),
                        Some(other) => other.to_string(),
                    };
                    file.insert("url".into(), Value::String(file_link(key, tenant, &id, &name, now)));
                }
            }
            row
        })
        .collect()
}

/// `DEFAULT_MAX_FILE_BYTES`: the largest file accepted, unless the operator says otherwise.
pub const DEFAULT_MAX_FILE_BYTES: u64 = 25 * 1024 * 1024;

/// The picture types an `image` field takes, found from the bytes.
const IMAGE_TYPES: [&str; 5] = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

/// `sniffType`: the type of a few formats, read from their first bytes.
pub fn sniff_type(b: &[u8]) -> Option<&'static str> {
    if b.len() >= 8 && b[0] == 0x89 && &b[1..4] == b"PNG" {
        return Some("image/png");
    }
    if b.len() >= 3 && b[..3] == [0xff, 0xd8, 0xff] {
        return Some("image/jpeg");
    }
    if b.len() >= 6 && (&b[..6] == b"GIF87a" || &b[..6] == b"GIF89a") {
        return Some("image/gif");
    }
    if b.len() >= 12 && &b[..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if b.len() >= 12 && &b[4..8] == b"ftyp" && (&b[8..12] == b"avif" || &b[8..12] == b"avis") {
        return Some("image/avif");
    }
    if b.len() >= 5 && &b[..5] == b"%PDF-" {
        return Some("application/pdf");
    }
    None
}

fn is_mime(s: &str) -> bool {
    let part = |p: &str| !p.is_empty() && p.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b".+-".contains(&b));
    matches!(s.split_once('/'), Some((a, b)) if part(a) && part(b))
}

/// `cleanFileName`: no directory, no control character, 255 characters at most; `fichier`
/// for what is left empty.
pub fn clean_file_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or_default();
    let cleaned: String = base.chars().filter(|c| !matches!(*c as u32, 0..=0x1f | 0x7f)).collect();
    let bounded: String = crate::js::js_trim(&cleaned).chars().take(255).collect();
    if bounded.is_empty() || bounded == "." || bounded == ".." {
        "fichier".into()
    } else {
        bounded
    }
}

/// A header value as Node reads it: bytes as Latin-1.
pub fn latin1(value: &axum::http::HeaderValue) -> String {
    value.as_bytes().iter().map(|b| *b as char).collect()
}

/// `uploadFile`: deposits a file for a field the caller may write — on a new row or an
/// existing one. The deposit alone changes no row.
#[allow(clippy::too_many_arguments)]
pub async fn upload_file(
    st: &basedb_base::Shared,
    ctx: &RequestContext,
    key: &[u8],
    table_id: &str,
    field: &str,
    name: &str,
    declared: Option<&str>,
    bytes: &[u8],
    max_bytes: u64,
) -> Result<Value, AppError> {
    if bytes.len() as u64 > max_bytes {
        return Err(AppError::new("BODY_TOO_LARGE").with("size", json!(bytes.len())).with("maximum", json!(max_bytes)));
    }
    let (field_id, kind, base_id) = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        let Some(table) = load_target(&tx, ctx, table_id).await? else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
        };
        let fields = load_fields(&tx, table_id).await?;
        let found = fields.into_iter().find(|f| f.name == field);
        let creating = decide(ctx, &grants, Action::Create, &table);
        let updating = decide(ctx, &grants, Action::Update, &table);
        let Some(found) = found.filter(|f| creating.readable_fields.contains(&f.id) || updating.readable_fields.contains(&f.id)) else {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(field)));
        };
        if !creating.writable_fields.contains(&found.id) && !updating.writable_fields.contains(&found.id) {
            return Err(AppError::new("FIELD_NOT_WRITABLE").with("field", json!(field)));
        }
        if found.kind != "file" && found.kind != "image" {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!("pas_un_champ_fichier")));
        }
        let row = tx.first("SELECT base_id::text FROM _basedb.table_def WHERE id = $1::text::uuid", &[&table_id]).await?;
        let base_id: String = row.map(|r| r.get(0)).ok_or_else(|| AppError::internal("Cannot read properties of undefined (reading 'base_id')"))?;
        Ok((found.id, found.kind, base_id))
    })
    .await?;

    let sniffed = sniff_type(bytes);
    let declared = declared.unwrap_or_default().split(';').next().unwrap_or_default();
    let declared = crate::js::js_trim(declared).to_lowercase();
    let kind_of_file = if kind == "image" {
        match sniffed.filter(|t| IMAGE_TYPES.contains(t)) {
            Some(t) => t.to_string(),
            None => return Err(AppError::new("CONTENT_TYPE_INVALID").with("field", json!(field)).with("accepted", json!(IMAGE_TYPES))),
        }
    } else {
        sniffed.map(str::to_string).unwrap_or_else(|| if is_mime(&declared) { declared.clone() } else { "application/octet-stream".into() })
    };

    let name = clean_file_name(name);
    let sha = hex(&sha256(bytes));
    let storage_key = format!("{base_id}/{}", uuid::Uuid::new_v4());
    let storage = Storage::new(&st.cfg.files, &st.https);
    storage.put(&storage_key, bytes, &kind_of_file).await?;

    let size = bytes.len() as i64;
    let inserted = async {
        let conn = st.pools.catalog().await?;
        conn.query_op(
            "INSERT INTO _basedb.stored_file (base_id, field_id, storage_key, name, mime_type, size_bytes, sha256, created_by)
             VALUES ($1::text::uuid, $2::text::uuid, $3, $4, $5, $6, $7, $8::text::uuid) RETURNING id::text",
            &[&base_id, &field_id, &storage_key, &name, &kind_of_file, &size, &sha, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await
    }
    .await;
    let id: String = match inserted {
        Ok(rows) => rows.first().map(|r| r.get(0)).unwrap_or_default(),
        Err(e) => {
            let _ = storage.delete(&storage_key).await;
            return Err(e);
        }
    };
    let url = file_link(key, &ctx.tenant_id, &id, &name, ctx.timestamp);
    Ok(json!({ "id": id, "name": name, "type": kind_of_file, "size": size, "url": url }))
}

/// `disposition` (app.ts): an ASCII fallback name and the exact one, RFC 5987.
pub fn disposition(kind: &str, name: &str) -> String {
    let ascii: String = name
        .encode_utf16()
        .map(|u| match u {
            0x22 | 0x5c => '_',
            0x20..=0x7e => u as u8 as char,
            _ => '_',
        })
        .collect();
    let encoded = encode_uri_component(name).replace('\'', "%27").replace('(', "%28").replace(')', "%29").replace('*', "%2A");
    format!("{kind}; filename=\"{ascii}\"; filename*=UTF-8''{encoded}")
}

/// `openFile` and the download route's answer: a link that is forged, altered, expired or
/// names a file that is gone gets the same answer — not found.
pub async fn open_file(st: &basedb_base::Shared, key: &[u8], tenant: &str, id: &str, expires: Option<&str>, signature: Option<&str>, download: bool) -> Result<Response, AppError> {
    let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("file", json!(id));
    let now_ms = basedb_base::time::now_ms();
    let exp = expires.map(basedb_catalog::js::js_to_number).unwrap_or(f64::NAN);
    if !exp.is_finite() || exp.fract() != 0.0 || exp * 1000.0 < now_ms as f64 {
        return Err(not_found());
    }
    if id.len() != 36 || !id.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-') {
        return Err(not_found());
    }
    let expected = b64url(&hmac_sha256(key, &[format!("{tenant}\n{id}\n{}", basedb_catalog::js::js_number_string(exp)).as_bytes()]));
    let expected: String = expected.chars().take(32).collect();
    let given = signature.unwrap_or_default();
    if given.len() != expected.len() || !constant_eq(given.as_bytes(), expected.as_bytes()) {
        return Err(not_found());
    }
    let conn = st.pools.catalog().await?;
    let row = conn
        .first("SELECT storage_key, name, mime_type, size_bytes, sha256 FROM _basedb.stored_file WHERE id = $1::text::uuid", &[&id])
        .await?
        .ok_or_else(not_found)?;
    drop(conn);
    let (storage_key, name, mime, size, sha): (String, String, String, i64, String) = (row.get(0), row.get(1), row.get(2), row.get(3), row.get(4));
    let max_age = ((exp - now_ms as f64 / 1000.0).floor()).max(0.0) as i64;
    let body = Storage::new(&st.cfg.files, &st.https).get(&storage_key).await?;
    let inline = (IMAGE_TYPES.contains(&mime.as_str()) || mime == "application/pdf") && !download;
    let mut res = Response::new(body);
    let h = res.headers_mut();
    let mut set = |n: &'static str, v: String| {
        if let Ok(v) = HeaderValue::from_str(&v) {
            h.insert(n, v);
        }
    };
    set("content-type", mime.clone());
    set("content-length", size.to_string());
    set("content-disposition", disposition(if inline { "inline" } else { "attachment" }, &name));
    set("cache-control", format!("private, max-age={max_age}, immutable"));
    set("etag", format!("\"{sha}\""));
    set("x-content-type-options", "nosniff".into());
    if mime != "application/pdf" {
        set("content-security-policy", "default-src 'none'; img-src 'self'; sandbox".into());
    }
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_names_and_dispositions() {
        assert_eq!(sniff_type(b"\x89PNG\r\n\x1a\n"), Some("image/png"));
        assert_eq!(sniff_type(b"\x89PNG"), None);
        assert_eq!(sniff_type(b"\xff\xd8\xff"), Some("image/jpeg"));
        assert_eq!(sniff_type(b"GIF89a"), Some("image/gif"));
        assert_eq!(sniff_type(b"RIFF\0\0\0\0WEBP"), Some("image/webp"));
        assert_eq!(sniff_type(b"\0\0\0\x1cftypavis"), Some("image/avif"));
        assert_eq!(sniff_type(b"%PDF-1.7"), Some("application/pdf"));
        assert_eq!(sniff_type(b"<svg/>"), None);
        assert_eq!(clean_file_name("C:\\a\\b/ rapport\u{1}.pdf "), "rapport.pdf");
        assert_eq!(clean_file_name(".."), "fichier");
        assert_eq!(clean_file_name("a/"), "fichier");
        assert_eq!(clean_file_name(&"é".repeat(300)).chars().count(), 255);
        assert!(is_mime("text/plain") && is_mime("application/vnd.ms-excel") && !is_mime("text") && !is_mime("Text/plain") && !is_mime("a/b/c"));
        assert_eq!(disposition("inline", "l'été \"x\" 😀(1)*.png"), "inline; filename=\"l'_t_ _x_ __(1)*.png\"; filename*=UTF-8''l%27%C3%A9t%C3%A9%20%22x%22%20%F0%9F%98%80%281%29%2A.png");
    }

    #[test]
    fn links_last_until_the_next_window_ends() {
        let now = DateTime::from_timestamp_millis(LINK_WINDOW_MS * 10 + 5).unwrap();
        let link = file_link(&link_key("k"), "t4z56fq", "f1", "a b.pdf", now);
        assert!(link.starts_with(&format!("/api/v1/t4z56fq/files/f1/a%20b.pdf?exp={}&sig=", LINK_WINDOW_MS * 12 / 1000)));
        assert_eq!(link.split("sig=").nth(1).unwrap().len(), 32);
    }
}
