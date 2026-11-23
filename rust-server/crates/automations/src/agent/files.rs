//! `attach_file` (`agent/files.ts`, chapter 09 §6): a document or a picture put into a
//! `file` or `image` field of an existing row — the kernel's deposit, then the ordinary
//! write of the row. The bytes come with the call, or from an address fetched under the
//! webhooks' rule, checked again at every redirect.

use super::records::{agent_error, attach_outcome, read_back, require_write, write_result, AgentWriteResult};
use super::view::{agent_view, resolve_agent_field, resolve_agent_table};
use basedb_base::error::AppError;
use basedb_base::tx::RequestContext;
use basedb_base::Shared;
use basedb_catalog::targets::{check_target, TargetPolicy};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::time::Duration;
use url::Url;

/// `AgentAttachRequest`.
#[derive(Debug, Clone, Default)]
pub struct AgentAttachRequest {
    pub base: String,
    pub table: String,
    pub id: String,
    pub field: String,
    /// The name shown and offered for download; from the address when absent.
    pub name: Option<String>,
    /// What the caller says the file is — believed for a document, checked for an image.
    pub content_type: Option<String>,
    pub bytes: Option<Vec<u8>>,
    pub url: Option<String>,
    /// `append` (the default) or `replace`.
    pub mode: Option<String>,
}

/// `AgentAttachResult`: the write's result, and the deposited file without its `url`.
#[derive(Debug, Clone)]
pub struct AgentAttachResult {
    pub write: AgentWriteResult,
    pub file: Value,
}

const FETCH_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_REDIRECTS: usize = 3;

/// `decodeURIComponent`: `None` where JavaScript throws (a malformed escape, bytes that
/// are not UTF-8).
pub fn decode_uri_component(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = text.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok().filter(|_| hex.bytes().all(|b| b.is_ascii_hexdigit()))?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// `nameFromUrl`: the last segment of an address's path, empty when there is none.
fn name_from_url(url: &Url) -> String {
    let last = url.path().split('/').rfind(|s| !s.is_empty()).unwrap_or("");
    decode_uri_component(last).unwrap_or_else(|| last.to_string())
}

/// `nameFromDisposition`: `filename*=UTF-8''…` first, then `filename="…"`.
fn name_from_disposition(header: Option<&str>) -> String {
    let Some(header) = header else { return String::new() };
    static STAR: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    static PLAIN: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let star = STAR.get_or_init(|| regex::Regex::new(r"(?i)filename\*\s*=\s*[^']*''([^;]+)").expect("regex"));
    if let Some(found) = star.captures(header).and_then(|c| c.get(1)) {
        if let Some(name) = decode_uri_component(basedb_records::js::js_trim(found.as_str())) {
            return name;
        }
    }
    let plain = PLAIN.get_or_init(|| regex::Regex::new(r#"(?i)filename\s*=\s*"?([^";]+)"?"#).expect("regex"));
    plain.captures(header).and_then(|c| c.get(1)).map(|m| basedb_records::js::js_trim(m.as_str()).to_string()).unwrap_or_default()
}

fn refused(reason: &str) -> AppError {
    AppError::new("PARAMETER_INVALID").with("param", json!("url")).with("reason", json!(reason))
}

struct Fetched {
    bytes: Vec<u8>,
    kind: Option<String>,
    name: String,
}

/// `fetchFile`: an address the agent named, under the webhooks' rule.
async fn fetch_file(raw: &str, policy: &TargetPolicy, max_bytes: u64) -> Result<Fetched, AppError> {
    let mut url = check_target(raw, policy).await.map_err(|_| refused("cible_refusee"))?;
    let client = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).no_proxy().timeout(FETCH_TIMEOUT).build().map_err(AppError::internal)?;
    let mut hop = 0;
    loop {
        let response = client.get(url.clone()).send().await.map_err(|_| refused("injoignable"))?;
        let status = response.status().as_u16();
        if (300..400).contains(&status) {
            let next = response.headers().get("location").and_then(|v| v.to_str().ok()).map(str::to_string);
            let Some(next) = next.filter(|_| hop < MAX_REDIRECTS) else { return Err(refused("trop_de_redirections")) };
            // Each hop is checked again: a public address may redirect inside.
            let joined = url.join(&next).map_err(|_| refused("cible_refusee"))?;
            url = check_target(joined.as_str(), policy).await.map_err(|_| refused("cible_refusee"))?;
            hop += 1;
            continue;
        }
        if !(200..300).contains(&status) {
            return Err(refused(&format!("http_{status}")));
        }
        let header = |name: &str| response.headers().get(name).and_then(|v| v.to_str().ok()).map(str::to_string);
        let announced: f64 = header("content-length").map(|v| v.trim().parse().unwrap_or(f64::NAN)).unwrap_or(0.0);
        if announced > max_bytes as f64 {
            return Err(AppError::new("BODY_TOO_LARGE").with("size", json!(announced as u64)).with("maximum", json!(max_bytes)));
        }
        let kind = header("content-type");
        let disposition = header("content-disposition");
        // Read under the bound, whatever the length announced: a server may lie.
        let mut bytes = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(AppError::internal)?;
            if (bytes.len() + chunk.len()) as u64 > max_bytes {
                return Err(AppError::new("BODY_TOO_LARGE").with("maximum", json!(max_bytes)));
            }
            bytes.extend_from_slice(&chunk);
        }
        let name = match name_from_disposition(disposition.as_deref()) {
            n if n.is_empty() => name_from_url(&url),
            n => n,
        };
        return Ok(Fetched { bytes, kind, name });
    }
}

/// `agentAttachFile`.
pub async fn agent_attach_file(st: &Shared, ctx: &RequestContext, request: &AgentAttachRequest) -> Result<AgentAttachResult, AppError> {
    let pools = &st.pools;
    let instance_key = st.instance_key()?;
    let view = agent_view(pools, ctx).await?;
    let (_, table) = resolve_agent_table(&view, &request.base, &request.table)?;
    require_write(table, "update")?;
    let field = resolve_agent_field(table, &request.field, "field")?;
    let object = json!({ "kind": "table", "name": table.row.table_name });
    if !basedb_records::values::is_file_kind(&field.kind) {
        return Err(AppError::new("PARAMETER_INVALID").with("param", json!("field")).with("reason", json!("pas_un_champ_fichier")).with("object", object));
    }
    // Writable by the rights: this surface's own refusal of files is what this tool lifts.
    if !field.granted_write {
        return Err(AppError::new("FIELD_NOT_WRITABLE").with("param", json!("field")).with("field", json!(field.name)).with("object", object));
    }

    // The row first: a file deposited for a row that does not exist would be for nothing.
    let Some(before) = read_back(pools, ctx, instance_key, &view, table, &request.id).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    };
    let held: Vec<Value> = match before.get(&field.name) {
        Some(Value::Array(files)) => files.iter().filter_map(|f| f.get("id").filter(|id| id.is_string()).cloned()).collect(),
        _ => vec![],
    };

    let max_bytes = st.cfg.max_file_bytes.unwrap_or(basedb_records::DEFAULT_MAX_FILE_BYTES);
    let source = match &request.url {
        Some(url) => fetch_file(url, &TargetPolicy::from_config(&st.cfg), max_bytes).await?,
        None => Fetched { bytes: request.bytes.clone().unwrap_or_default(), kind: None, name: String::new() },
    };
    if source.bytes.is_empty() {
        return Err(AppError::new("PARAMETER_INVALID").with("param", json!("content")).with("reason", json!("vide")));
    }

    let name = request.name.clone().unwrap_or(source.name);
    let declared = request.content_type.clone().or(source.kind);
    let key = basedb_records::link_key(instance_key);
    let deposited = basedb_records::upload_file(st, ctx, &key, &table.row.id, &field.name, &name, declared.as_deref(), &source.bytes, max_bytes)
        .await
        .map_err(|e| agent_error(e, Some(table), Some(&view)))?;

    let id_value = deposited.get("id").cloned().unwrap_or(Value::Null);
    let value = if request.mode.as_deref() == Some("replace") {
        vec![id_value]
    } else {
        let mut all = held;
        all.push(id_value);
        all
    };
    basedb_records::write::update_record(pools, ctx, &table.row.id, &request.id, vec![(field.name.clone(), Value::Array(value))])
        .await
        .map_err(|e| agent_error(e, Some(table), Some(&view)))?;

    let record = read_back(pools, ctx, instance_key, &view, table, &request.id).await?;
    let mut file = deposited;
    if let Some(map) = file.as_object_mut() {
        map.shift_remove("url");
    }
    let response = attach_outcome(&request.id.to_lowercase(), file.clone(), record);
    Ok(AgentAttachResult { write: write_result(&view, table, response), file })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_come_from_the_disposition_then_the_address() {
        assert_eq!(name_from_disposition(Some("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf; filename=\"x.pdf\"")), "résumé.pdf");
        assert_eq!(name_from_disposition(Some("attachment; filename*=UTF-8''bad%E9.pdf; filename=\"x.pdf\"")), "x.pdf");
        assert_eq!(name_from_disposition(Some("inline; FILENAME = plan.png")), "plan.png");
        assert_eq!(name_from_disposition(None), "");
        assert_eq!(name_from_url(&Url::parse("https://h.example/a/b%20c.txt/").unwrap()), "b c.txt");
        assert_eq!(name_from_url(&Url::parse("https://h.example/a/%E9").unwrap()), "%E9");
        assert_eq!(name_from_url(&Url::parse("https://h.example/").unwrap()), "");
    }
}
