//! Where the bytes of `file` and `image` fields live — `files/storage.ts`: the local disk or an
//! S3-compatible bucket signed with AWS Signature Version 4, behind one contract.

use axum::body::Body;
use basedb_base::config::FileStorage;
use basedb_base::error::AppError;
use basedb_base::time::{hex, hmac_sha256, sha256};
use chrono::{DateTime, Utc};
use serde_json::json;
use std::path::{Path, PathBuf};

/// `KEY`: ours — `<base>/<uuid>` — and checked anyway before it becomes a path.
fn checked_key(key: &str) -> Result<&str, AppError> {
    let segment_ok = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-');
    if key.split('/').all(segment_ok) {
        Ok(key)
    } else {
        Err(AppError::new("INTERNAL_ERROR").with("reason", json!("clé de fichier invalide")))
    }
}

/// An unavailable storage is the operator's to fix, never the caller's: an incident.
fn unavailable(cause: impl std::fmt::Display) -> AppError {
    AppError::new("SERVICE_UNAVAILABLE").with("reason", json!("stockage de fichiers injoignable")).caused_by(cause.to_string())
}

fn not_found(key: &str) -> AppError {
    AppError::new("RESOURCE_NOT_FOUND").with("file", json!(key))
}

/// The storage of the instance (`createFileStorage`).
pub struct Storage<'a> {
    config: &'a FileStorage,
    http: &'a reqwest::Client,
}

impl<'a> Storage<'a> {
    pub fn new(config: &'a FileStorage, http: &'a reqwest::Client) -> Storage<'a> {
        Storage { config, http }
    }

    fn path_of(directory: &Path, key: &str) -> Result<PathBuf, AppError> {
        let key = checked_key(key)?;
        let mut path = directory.to_path_buf();
        for segment in key.split('/') {
            path.push(segment);
        }
        Ok(path)
    }

    /// `put`: written aside then renamed — a reader never sees half a file.
    pub async fn put(&self, key: &str, body: &[u8], kind: &str) -> Result<(), AppError> {
        match self.config {
            FileStorage::Local { directory } => {
                let path = Self::path_of(directory, key)?;
                let body = body.to_vec();
                tokio::task::spawn_blocking(move || -> std::io::Result<()> {
                    if let Some(parent) = path.parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    let mut partial = path.clone().into_os_string();
                    partial.push(".partial");
                    std::fs::write(&partial, &body)?;
                    std::fs::rename(&partial, &path)
                })
                .await
                .map_err(unavailable)?
                .map_err(unavailable)
            }
            FileStorage::S3 { .. } => {
                let response = self.send(reqwest::Method::PUT, key, Some(body.to_vec()), Some(kind)).await?;
                if !response.status().is_success() {
                    return Err(unavailable(failure(response).await));
                }
                Ok(())
            }
        }
    }

    /// `get`: the bytes under `key`, streamed from the store.
    pub async fn get(&self, key: &str) -> Result<Body, AppError> {
        match self.config {
            FileStorage::Local { directory } => {
                let path = Self::path_of(directory, key)?;
                match tokio::task::spawn_blocking(move || std::fs::read(path)).await.map_err(unavailable)? {
                    Ok(bytes) => Ok(Body::from(bytes)),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err(not_found(key)),
                    Err(e) => Err(unavailable(e)),
                }
            }
            FileStorage::S3 { .. } => {
                let response = self.send(reqwest::Method::GET, key, None, None).await?;
                if response.status() == reqwest::StatusCode::NOT_FOUND {
                    return Err(not_found(key));
                }
                if !response.status().is_success() {
                    return Err(unavailable(failure(response).await));
                }
                Ok(Body::from_stream(response.bytes_stream()))
            }
        }
    }

    /// `delete`: removing what is already gone is not an error.
    pub async fn delete(&self, key: &str) -> Result<(), AppError> {
        match self.config {
            FileStorage::Local { directory } => {
                let path = Self::path_of(directory, key)?;
                match tokio::task::spawn_blocking(move || std::fs::remove_file(path)).await.map_err(unavailable)? {
                    Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(unavailable(e)),
                    _ => Ok(()),
                }
            }
            FileStorage::S3 { .. } => {
                let response = self.send(reqwest::Method::DELETE, key, None, None).await?;
                if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
                    return Err(unavailable(failure(response).await));
                }
                Ok(())
            }
        }
    }

    async fn send(&self, method: reqwest::Method, key: &str, body: Option<Vec<u8>>, kind: Option<&str>) -> Result<reqwest::Response, AppError> {
        let FileStorage::S3 { endpoint, bucket, region, access_key_id, secret_access_key, force_path_style } = self.config else {
            return Err(AppError::internal("pas un stockage S3"));
        };
        let url = s3_url(endpoint, bucket, *force_path_style, checked_key(key)?)?;
        let payload_hash = hex(&sha256(body.as_deref().unwrap_or_default()));
        let extra: Vec<(String, String)> = kind.map(|k| vec![("content-type".to_string(), k.to_string())]).unwrap_or_default();
        let headers = sign_v4(&SignRequest {
            method: method.as_str(),
            url: &url,
            region,
            access_key_id,
            secret_access_key,
            payload_hash: &payload_hash,
            extra: &extra,
            now: Utc::now(),
        });
        let mut request = self.http.request(method, url.as_str());
        for (name, value) in headers {
            request = request.header(name, value);
        }
        if let Some(body) = body {
            request = request.body(body);
        }
        request.send().await.map_err(unavailable)
    }
}

/// The store's own words, for the log.
async fn failure(response: reqwest::Response) -> String {
    let status = response.status().as_u16();
    let text = response.text().await.unwrap_or_default();
    format!("S3 {status}: {}", text.chars().take(500).collect::<String>())
}

/// `urlOf`: path style (`https://host/bucket/key`) unless `forcePathStyle` is false.
fn s3_url(endpoint: &str, bucket: &str, force_path_style: bool, key: &str) -> Result<url::Url, AppError> {
    let mut url = url::Url::parse(endpoint).map_err(|e| AppError::internal(format!("BASEDB_S3_ENDPOINT : {e}")))?;
    if !force_path_style {
        let host = format!("{bucket}.{}", url.host_str().unwrap_or_default());
        url.set_host(Some(&host)).map_err(|e| AppError::internal(e.to_string()))?;
        url.set_path(&format!("/{key}"));
    } else {
        let path = format!("{}/{}/{key}", url.path().trim_end_matches('/'), basedb_catalog::js::encode_uri_component(bucket));
        url.set_path(&path);
    }
    Ok(url)
}

pub struct SignRequest<'a> {
    pub method: &'a str,
    pub url: &'a url::Url,
    pub region: &'a str,
    pub access_key_id: &'a str,
    pub secret_access_key: &'a str,
    pub payload_hash: &'a str,
    pub extra: &'a [(String, String)],
    pub now: DateTime<Utc>,
}

/// `signV4`: the headers of a Signature Version 4 request with no query string — `host`
/// signed but not returned (the client sets it from the URL).
pub fn sign_v4(r: &SignRequest) -> Vec<(String, String)> {
    let amz_date = r.now.format("%Y%m%dT%H%M%SZ").to_string();
    let day = &amz_date[..8];
    let scope = format!("{day}/{}/s3/aws4_request", r.region);
    let host = match r.url.port() {
        Some(port) => format!("{}:{port}", r.url.host_str().unwrap_or_default()),
        None => r.url.host_str().unwrap_or_default().to_string(),
    };
    let mut headers: Vec<(String, String)> = vec![("host".into(), host), ("x-amz-content-sha256".into(), r.payload_hash.into()), ("x-amz-date".into(), amz_date.clone())];
    for (k, v) in r.extra {
        let k = k.to_lowercase();
        headers.retain(|(n, _)| *n != k);
        headers.push((k, v.clone()));
    }
    headers.sort_by(|a, b| a.0.cmp(&b.0));
    let canonical_headers: String = headers.iter().map(|(n, v)| format!("{n}:{}\n", crate::js::js_trim(v))).collect();
    let signed_headers = headers.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>().join(";");
    let canonical_request = [r.method, r.url.path(), "", &canonical_headers, &signed_headers, r.payload_hash].join("\n");
    let string_to_sign = ["AWS4-HMAC-SHA256", &amz_date, &scope, &hex(&sha256(canonical_request.as_bytes()))].join("\n");
    let mut key = hmac_sha256(format!("AWS4{}", r.secret_access_key).as_bytes(), &[day.as_bytes()]);
    for part in [r.region, "s3", "aws4_request"] {
        key = hmac_sha256(&key, &[part.as_bytes()]);
    }
    let signature = hex(&hmac_sha256(&key, &[string_to_sign.as_bytes()]));
    let mut sent: Vec<(String, String)> = headers.into_iter().filter(|(n, _)| n != "host").collect();
    sent.push(("authorization".into(), format!("AWS4-HMAC-SHA256 Credential={}/{scope}, SignedHeaders={signed_headers}, Signature={signature}", r.access_key_id)));
    sent
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signs_the_aws_reference_get_object() {
        // docs.aws.amazon.com — "Signature Calculations for the Authorization Header", "GET Object".
        let url = url::Url::parse("https://examplebucket.s3.amazonaws.com/test.txt").unwrap();
        let headers = sign_v4(&SignRequest {
            method: "GET",
            url: &url,
            region: "us-east-1",
            access_key_id: "AKIAIOSFODNN7EXAMPLE",
            secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            payload_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            extra: &[("range".into(), "bytes=0-9".into())],
            now: DateTime::parse_from_rfc3339("2013-05-24T00:00:00Z").unwrap().with_timezone(&Utc),
        });
        let get = |n: &str| headers.iter().find(|(k, _)| k == n).map(|(_, v)| v.as_str());
        assert_eq!(
            get("authorization"),
            Some("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41")
        );
        assert_eq!(get("x-amz-date"), Some("20130524T000000Z"));
        assert_eq!(get("host"), None);
    }

    #[test]
    fn urls_and_keys() {
        let key = "0a-1/ff-2";
        assert_eq!(s3_url("http://localhost:3900", "b", true, key).unwrap().as_str(), "http://localhost:3900/b/0a-1/ff-2");
        assert_eq!(s3_url("https://s3.fr-par.scw.cloud/x/", "b", true, key).unwrap().as_str(), "https://s3.fr-par.scw.cloud/x/b/0a-1/ff-2");
        assert_eq!(s3_url("https://s3.fr-par.scw.cloud", "b", false, key).unwrap().as_str(), "https://b.s3.fr-par.scw.cloud/0a-1/ff-2");
        assert!(checked_key("../x").is_err() && checked_key("a//b").is_err() && checked_key("").is_err());
    }

    #[tokio::test]
    async fn local_round_trip() {
        let directory = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!("storage-test-{}", uuid::Uuid::new_v4()));
        let config = FileStorage::Local { directory: directory.clone() };
        let http = reqwest::Client::new();
        let storage = Storage::new(&config, &http);
        storage.put("0a/0b", b"bonjour", "text/plain").await.unwrap();
        let body = axum::body::to_bytes(storage.get("0a/0b").await.unwrap(), usize::MAX).await.unwrap();
        assert_eq!(&body[..], b"bonjour");
        storage.delete("0a/0b").await.unwrap();
        storage.delete("0a/0b").await.unwrap();
        assert_eq!(storage.get("0a/0b").await.err().unwrap().code, "RESOURCE_NOT_FOUND");
        let _ = std::fs::remove_dir_all(directory);
    }
}
