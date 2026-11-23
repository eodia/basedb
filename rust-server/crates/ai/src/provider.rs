//! The provider: configuration, quota, journal, transport, and the call itself
//! (`ai/draft.ts` — `resolveProvider`, `endpointFromEnv`, `assertQuota`, `log`, `invoke` — and
//! `apps/api/src/ai-transport.ts`).
//!
//! « Le noyau décide, l'adaptateur appelle » : the transport receives a system instruction, a
//! payload and a schema, and gives back text. Nothing else here knows what a base is.

use crate::sealing::unseal;
use basedb_base::db::{Exec, Pools};
use basedb_base::error::SqlOp;
use basedb_base::error::AppError;
use basedb_base::idempotency::js_stringify;
use basedb_base::tx::{ActorKind, RequestContext, Surface};
use basedb_base::AppState;
use indexmap::IndexMap;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// `TIMEOUT_MS`: a call's whole budget.
pub const TIMEOUT_MS: u64 = 20_000;
/// `MAX_PAYLOAD_BYTES`.
pub const MAX_PAYLOAD_BYTES: usize = 64 * 1024;

const PROVIDERS: [&str; 4] = ["openai", "anthropic", "mistral", "openai_compatible"];

fn vendor_key(provider: &str) -> Option<&'static str> {
    match provider {
        "openai" => Some("OPENAI_API_KEY"),
        "anthropic" => Some("ANTHROPIC_API_KEY"),
        "mistral" => Some("MISTRAL_API_KEY"),
        _ => None,
    }
}

fn vendor_base(provider: &str) -> Option<&'static str> {
    match provider {
        "openai" => Some("https://api.openai.com/v1"),
        "anthropic" => Some("https://api.anthropic.com/v1"),
        "mistral" => Some("https://api.mistral.ai/v1"),
        _ => None,
    }
}

/// `UsageKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Usage {
    StructureDraft,
    ExpressionDraft,
    FieldCompute,
    Copilot,
    TemplateDraft,
    Automation,
}

impl Usage {
    pub fn as_str(self) -> &'static str {
        match self {
            Usage::StructureDraft => "structure_draft",
            Usage::ExpressionDraft => "expression_draft",
            Usage::FieldCompute => "field_compute",
            Usage::Copilot => "copilot",
            Usage::TemplateDraft => "template_draft",
            Usage::Automation => "automation",
        }
    }
}

/// `ProviderConfig`.
#[derive(Debug, Clone, PartialEq)]
pub struct ProviderConfig {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub key_scope: String,
    pub base_url: Option<String>,
    pub headers: Option<IndexMap<String, String>>,
    pub verify_certificate: bool,
}

/// What the environment says, read as Node's `process.env` (empty counts as unset).
pub trait Env: Sync {
    fn var(&self, name: &str) -> Option<String>;
}

impl Env for basedb_base::config::Config {
    fn var(&self, name: &str) -> Option<String> {
        self.setting(name)
    }
}

impl Env for HashMap<String, String> {
    fn var(&self, name: &str) -> Option<String> {
        self.get(name).filter(|v| !v.is_empty()).cloned()
    }
}

fn not_configured(setting: &str) -> AppError {
    AppError::new("AI_NOT_CONFIGURED").with("setting", json!(setting))
}

/// `resolveProvider`.
pub async fn resolve_provider<E: Exec + Sync>(exec: &E, ctx: &RequestContext, env: &dyn Env) -> Result<ProviderConfig, AppError> {
    let rows = exec
        .rows(
            "SELECT s.key, s.value, s.scope_kind
               FROM _basedb.setting s
               LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
              WHERE s.key IN ('ai.enabled', 'ai.provider', 'ai.model')
                AND (s.scope_kind = 'instance' OR t.ref = $1)
              ORDER BY s.scope_kind DESC",
            &[&ctx.tenant_id],
        )
        .await?;
    let mut settings: HashMap<String, Value> = HashMap::new();
    for row in rows {
        let key: String = row.get(0);
        let value: Option<Value> = row.get(1);
        settings.entry(key).or_insert(value.unwrap_or(Value::Null));
    }
    let env_provider = env.var("BASEDB_AI_PROVIDER");
    let from_env = env_provider.is_some();
    let enabled = match settings.get("ai.enabled") {
        Some(v) => v.as_bool() == Some(true),
        None => from_env,
    };
    if !enabled {
        return Err(AppError::new("AI_DISABLED").with("tenant", json!(ctx.tenant_id)));
    }
    let provider = match settings.get("ai.provider") {
        Some(v) => v.clone(),
        None => env_provider.clone().filter(|_| from_env).map(Value::String).unwrap_or(Value::Null),
    };
    let model = match settings.get("ai.model") {
        Some(v) => v.clone(),
        None if from_env => env.var("BASEDB_AI_MODEL").map(Value::String).unwrap_or(Value::Null),
        None => Value::Null,
    };
    let provider = match provider.as_str() {
        Some(p) if PROVIDERS.contains(&p) => p.to_string(),
        _ => return Err(not_configured("ai.provider / ai.model")),
    };
    let model = match model.as_str() {
        Some(m) if !m.is_empty() => m.to_string(),
        _ => return Err(not_configured("ai.provider / ai.model")),
    };

    let own = from_env && env_provider.as_deref() == Some(provider.as_str());
    let endpoint = if own { endpoint_from_env(env)? } else { Endpoint::default() };
    if provider == "openai_compatible" && endpoint.base_url.is_none() {
        return Err(not_configured("BASEDB_AI_BASE_URL"));
    }
    let config = |api_key: String, key_scope: &str| ProviderConfig {
        provider: provider.clone(),
        model: model.clone(),
        api_key,
        key_scope: key_scope.to_string(),
        base_url: endpoint.base_url.clone(),
        headers: endpoint.headers.clone(),
        verify_certificate: endpoint.verify_certificate,
    };

    let secret_key = format!("ai.{provider}.api_key");
    let secrets = exec
        .rows(
            "SELECT convert_from(s.value_encrypted, 'UTF8'), s.scope_kind, s.status
               FROM _basedb.secret s
               LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
              WHERE s.key = $1 AND (s.scope_kind = 'instance' OR t.ref = $2)
              ORDER BY s.scope_kind DESC",
            &[&secret_key, &ctx.tenant_id],
        )
        .await?;
    let secret = secrets.iter().find(|r| r.get::<_, String>(2) == "valid");
    let Some(secret) = secret else {
        let own_key = if own { env.var("BASEDB_AI_API_KEY") } else { None };
        let env_key = own_key.or_else(|| vendor_key(&provider).and_then(|v| env.var(v))).unwrap_or_default();
        if from_env && !env_key.is_empty() {
            return Ok(config(env_key, "instance"));
        }
        if provider == "openai_compatible" {
            return Ok(config(String::new(), "instance"));
        }
        return Err(AppError::new("AI_NOT_CONFIGURED").with("secret", json!(secret_key)));
    };
    let sealed: String = secret.get(0);
    let scope: String = secret.get(1);
    let instance_key = env.var("BASEDB_ENCRYPTION_KEY").unwrap_or_default();
    let api_key = if instance_key.is_empty() { None } else { unseal(&instance_key, "secret", &sealed) };
    match api_key {
        Some(k) => Ok(config(k, &scope)),
        None => Err(AppError::new("INTERNAL_ERROR").with("secret", json!(secret_key))),
    }
}

/// `endpointFromEnv`'s answer.
#[derive(Debug, Clone, PartialEq)]
pub struct Endpoint {
    pub base_url: Option<String>,
    pub headers: Option<IndexMap<String, String>>,
    pub verify_certificate: bool,
}

impl Default for Endpoint {
    fn default() -> Self {
        Endpoint { base_url: None, headers: None, verify_certificate: true }
    }
}

/// `verifiesProviderCertificate`.
pub fn verifies_provider_certificate(value: Option<&str>) -> Option<bool> {
    let text = crate::js::js_trim(value.unwrap_or("")).to_lowercase();
    if ["", "true", "1", "yes", "on"].contains(&text.as_str()) {
        return Some(true);
    }
    if ["false", "0", "no", "off"].contains(&text.as_str()) {
        return Some(false);
    }
    None
}

fn header_name() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$").unwrap())
}

/// `endpointFromEnv`.
pub fn endpoint_from_env(env: &dyn Env) -> Result<Endpoint, AppError> {
    let mut out = Endpoint::default();
    if verifies_provider_certificate(env.var("BASEDB_AI_PROVIDER_SSL_VERIFY").as_deref()) == Some(false) {
        out.verify_certificate = false;
    }
    let base_url = crate::js::js_trim(&env.var("BASEDB_AI_BASE_URL").unwrap_or_default()).to_string();
    if !base_url.is_empty() {
        let scheme = url::Url::parse(&base_url).ok().map(|u| u.scheme().to_string());
        if !matches!(scheme.as_deref(), Some("https") | Some("http")) {
            return Err(not_configured("BASEDB_AI_BASE_URL").with("reason", json!("adresse_invalide")));
        }
        out.base_url = Some(base_url);
    }
    let raw = crate::js::js_trim(&env.var("BASEDB_AI_HEADERS").unwrap_or_default()).to_string();
    if !raw.is_empty() {
        let entries = header_entries(&raw);
        let bad = |entries: &Vec<(String, Value)>| {
            entries.iter().any(|(name, value)| {
                !header_name().is_match(name) || value.as_str().map(|v| v.contains(['\r', '\n', '\0'])).unwrap_or(true)
            })
        };
        match entries {
            Some(entries) if !bad(&entries) => {
                let mut headers = IndexMap::new();
                for (name, value) in entries {
                    headers.insert(name.to_lowercase(), value.as_str().unwrap_or_default().to_string());
                }
                out.headers = Some(headers);
            }
            _ => return Err(not_configured("BASEDB_AI_HEADERS").with("reason", json!("objet_json_attendu"))),
        }
    }
    Ok(out)
}

/// `headerEntries`.
pub fn header_entries(raw: &str) -> Option<Vec<(String, Value)>> {
    if let Ok(parsed) = serde_json::from_str::<Value>(raw) {
        return match parsed {
            Value::Object(map) => Some(map.into_iter().collect()),
            _ => None,
        };
    }
    if raw.starts_with('{') && raw.ends_with('}') {
        return loose_object(&raw[1..raw.len() - 1]).map(|e| e.into_iter().map(|(k, v)| (k, Value::String(v))).collect());
    }
    if raw.starts_with('[') {
        return None;
    }
    let mut entries = vec![];
    for line in raw.split('\n') {
        let line = line.strip_suffix('\r').unwrap_or(line);
        if crate::js::js_trim(line).is_empty() {
            continue;
        }
        let colon = line.find(':')?;
        if colon == 0 {
            return None;
        }
        entries.push((crate::js::js_trim(&line[..colon]).to_string(), Value::String(crate::js::js_trim(&line[colon + 1..]).to_string())));
    }
    if entries.is_empty() {
        None
    } else {
        Some(entries)
    }
}

/// `looseObject`: `'a': 'b', "c": d`.
fn loose_object(inner: &str) -> Option<Vec<(String, String)>> {
    let chars: Vec<char> = inner.chars().collect();
    let mut at = 0usize;
    let blank = |at: &mut usize| {
        while *at < chars.len() && crate::js::is_js_space(chars[*at]) {
            *at += 1;
        }
    };
    let token = |at: &mut usize, stop: char| -> Option<String> {
        blank(at);
        let quote = chars.get(*at).copied();
        if quote == Some('"') || quote == Some('\'') {
            let quote = quote.unwrap();
            let mut text = String::new();
            *at += 1;
            while *at < chars.len() && chars[*at] != quote {
                if chars[*at] == '\\' && *at + 1 < chars.len() {
                    *at += 1;
                }
                text.push(chars[*at]);
                *at += 1;
            }
            if *at >= chars.len() {
                return None;
            }
            *at += 1;
            return Some(text);
        }
        let start = *at;
        while *at < chars.len() && chars[*at] != stop {
            *at += 1;
        }
        let text: String = chars[start..*at].iter().collect();
        let text = crate::js::js_trim(&text).to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    };
    let mut entries = vec![];
    blank(&mut at);
    while at < chars.len() {
        let name = token(&mut at, ':');
        blank(&mut at);
        let name = name?;
        if chars.get(at) != Some(&':') {
            return None;
        }
        at += 1;
        let value = token(&mut at, ',');
        blank(&mut at);
        let value = value?;
        if at < chars.len() && chars[at] != ',' {
            return None;
        }
        at += 1;
        entries.push((name, value));
        blank(&mut at);
    }
    if entries.is_empty() {
        None
    } else {
        Some(entries)
    }
}

fn quota_of(env: &dyn Env, name: &str, default: i64) -> i64 {
    let given = crate::js::js_to_number(&env.var(name).unwrap_or_default());
    if given.fract() == 0.0 && given > 0.0 && given.is_finite() {
        given as i64
    } else {
        default
    }
}

/// `assertQuota`: two hourly ceilings, the drafts' and the background work's.
pub async fn assert_quota<E: Exec + Sync>(exec: &E, ctx: &RequestContext, env: &dyn Env, usage: Usage) -> Result<(), AppError> {
    let fields = usage == Usage::FieldCompute;
    let limit = if fields { quota_of(env, "BASEDB_AI_FIELD_QUOTA", 300) } else { quota_of(env, "BASEDB_AI_QUOTA", 120) };
    let row = exec
        .first(
            "SELECT count(*) FROM _basedb.ai_call c
               JOIN _basedb.tenant t ON t.id = c.tenant_id
              WHERE t.ref = $1 AND c.occurred_at > clock_timestamp() - interval '1 hour'
                AND (c.usage_kind IN ('field_compute', 'automation')) = $2",
            &[&ctx.tenant_id, &fields],
        )
        .await?;
    let n: i64 = row.map(|r| r.get(0)).unwrap_or(0);
    if n >= limit {
        return Err(AppError::new("AI_QUOTA_EXCEEDED").with("limit", json!(limit)).with("window", json!("1h")));
    }
    Ok(())
}

/// One line of `_basedb.ai_call`.
pub struct LogEntry<'a> {
    pub usage: Usage,
    pub base_id: Option<&'a str>,
    pub config: &'a ProviderConfig,
    pub status: &'static str,
    pub code: Option<&'static str>,
    pub duration_ms: Option<i64>,
    pub tokens_in: Option<i64>,
    pub tokens_out: Option<i64>,
}

/// `log`: an unwritable journal is a gap, never a failed request.
pub async fn log(pools: &Pools, ctx: &RequestContext, entry: LogEntry<'_>) {
    let Ok(conn) = pools.catalog().await else { return };
    let actor = if ctx.actor.kind == ActorKind::User { Some(ctx.actor.id.clone()) } else { None };
    let surface = match ctx.surface {
        Surface::Rest => "rest",
        Surface::System => "system",
        _ => "ui",
    };
    let request_id = if ctx.request_id.len() == 36 { Some(ctx.request_id.clone()) } else { None };
    let int = |v: Option<i64>| v.map(|n| n.clamp(i32::MIN as i64, i32::MAX as i64) as i32);
    let _ = conn
        .execute_op(
            "INSERT INTO _basedb.ai_call
               (tenant_id, base_id, actor_user_id, surface, usage_kind, provider, model,
                key_scope, status, error_code, tokens_in, tokens_out, tokens_estimated,
                duration_ms, request_id)
             SELECT t.id, $2::text::uuid, $3::text::uuid, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::text,
                    $11::integer, $12::integer, $11::integer IS NULL, $13::integer, $14::text::uuid
               FROM _basedb.tenant t WHERE t.ref = $1",
            &[
                &ctx.tenant_id,
                &entry.base_id,
                &actor,
                &surface,
                &entry.usage.as_str(),
                &entry.config.provider,
                &entry.config.model,
                &entry.config.key_scope,
                &entry.status,
                &entry.code,
                &int(entry.tokens_in),
                &int(entry.tokens_out),
                &int(entry.duration_ms),
                &request_id,
            ],
            SqlOp::Insert,
        )
        .await;
}

// ── The transport ─────────────────────────────────────────────────────────────

/// An image joined to the user's message.
#[derive(Debug, Clone, PartialEq)]
pub struct AiImage {
    pub media_type: String,
    pub data: String,
}

/// What the transport is handed.
pub struct TransportRequest<'a> {
    pub config: &'a ProviderConfig,
    pub system: &'a str,
    pub payload: &'a Value,
    pub schema: &'a Value,
    pub timeout_ms: i64,
    pub max_tokens: Option<u32>,
    pub images: &'a [AiImage],
}

/// The model's answer.
#[derive(Debug, Clone, PartialEq)]
pub struct TransportAnswer {
    pub text: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

/// The circuit breaker of §2.4, keyed by the address called.
#[derive(Default)]
pub struct Breaker(Mutex<HashMap<String, (u32, Option<Instant>)>>);

const BREAKER_THRESHOLD: u32 = 5;
const BREAKER: Duration = Duration::from_secs(300);

/// The client of a call whose certificate the operator said not to check.
#[derive(Default)]
pub struct Unchecked(OnceLock<reqwest::Client>);

/// `under(base, operation)`: appended to the path, before the query string.
pub fn under(base: &str, operation: &str) -> Result<String, AppError> {
    let mut url = url::Url::parse(base).map_err(|_| not_configured("BASEDB_AI_BASE_URL"))?;
    let path = format!("{}{operation}", url.path().trim_end_matches('/'));
    url.set_path(&path);
    Ok(url.to_string())
}

/// `instruction`: the system text and the schema, as the model reads them.
pub fn instruction(system: &str, schema: &Value) -> String {
    format!("{system}\n\nSCHÉMA DE LA RÉPONSE :\n{}", serde_json::to_string_pretty(schema).unwrap_or_default())
}

/// `attemptFor`: the address, the headers and the body of a call.
pub fn attempt_for(request: &TransportRequest<'_>) -> Result<(String, IndexMap<String, String>, Value), AppError> {
    let c = request.config;
    let system = instruction(request.system, request.schema);
    let user = js_stringify(request.payload);
    let base = c.base_url.clone().or_else(|| vendor_base(&c.provider).map(str::to_string)).ok_or_else(|| not_configured("BASEDB_AI_BASE_URL"))?;
    let headers_of = |own: Vec<(&str, String)>| {
        let mut h: IndexMap<String, String> = own.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
        if let Some(extra) = &c.headers {
            for (k, v) in extra {
                h.insert(k.clone(), v.clone());
            }
        }
        h.insert("content-type".into(), "application/json".into());
        h
    };
    let bearer = || if c.api_key.is_empty() { vec![] } else { vec![("authorization", format!("Bearer {}", c.api_key))] };
    let user_content = |nested: bool| -> Value {
        if request.images.is_empty() {
            return Value::String(user.clone());
        }
        let mut parts = vec![json!({ "type": "text", "text": user })];
        for image in request.images {
            let url = format!("data:{};base64,{}", image.media_type, image.data);
            parts.push(json!({ "type": "image_url", "image_url": if nested { json!({ "url": url }) } else { json!(url) } }));
        }
        Value::Array(parts)
    };
    Ok(match c.provider.as_str() {
        "anthropic" => {
            let content = if request.images.is_empty() {
                Value::String(user.clone())
            } else {
                let mut parts: Vec<Value> = request
                    .images
                    .iter()
                    .map(|i| json!({ "type": "image", "source": { "type": "base64", "media_type": i.media_type, "data": i.data } }))
                    .collect();
                parts.push(json!({ "type": "text", "text": user }));
                Value::Array(parts)
            };
            (
                under(&base, "/messages")?,
                headers_of(vec![("x-api-key", c.api_key.clone()), ("anthropic-version", "2023-06-01".into())]),
                json!({
                    "model": c.model,
                    "max_tokens": request.max_tokens.unwrap_or(2048),
                    "system": system,
                    "messages": [{ "role": "user", "content": content }],
                }),
            )
        }
        "mistral" => {
            let mut body = Map::new();
            body.insert("model".into(), json!(c.model));
            if let Some(m) = request.max_tokens {
                body.insert("max_tokens".into(), json!(m));
            }
            body.insert("response_format".into(), json!({ "type": "json_object" }));
            body.insert("messages".into(), json!([{ "role": "system", "content": system }, { "role": "user", "content": user_content(false) }]));
            (under(&base, "/chat/completions")?, headers_of(bearer()), Value::Object(body))
        }
        _ => (
            under(&base, "/chat/completions")?,
            headers_of(bearer()),
            json!({
                "model": c.model,
                "response_format": { "type": "json_object" },
                "messages": [{ "role": "system", "content": system }, { "role": "user", "content": user_content(true) }],
            }),
        ),
    })
}

fn extract(provider: &str, response: &Value) -> TransportAnswer {
    let int = |v: Option<&Value>| v.and_then(Value::as_f64).map(|f| f as i64);
    if provider == "anthropic" {
        let text = response
            .get("content")
            .and_then(Value::as_array)
            .map(|parts| {
                parts
                    .iter()
                    .filter(|p| p.get("type").and_then(Value::as_str) == Some("text"))
                    .map(|p| p.get("text").and_then(Value::as_str).unwrap_or(""))
                    .collect::<String>()
            })
            .unwrap_or_default();
        let usage = response.get("usage");
        return TransportAnswer { text, input_tokens: int(usage.and_then(|u| u.get("input_tokens"))), output_tokens: int(usage.and_then(|u| u.get("output_tokens"))) };
    }
    let text = response.pointer("/choices/0/message/content").and_then(Value::as_str).unwrap_or("").to_string();
    let usage = response.get("usage");
    TransportAnswer { text, input_tokens: int(usage.and_then(|u| u.get("prompt_tokens"))), output_tokens: int(usage.and_then(|u| u.get("completion_tokens"))) }
}

fn unavailable(provider: &str) -> AppError {
    AppError::new("AI_PROVIDER_UNAVAILABLE").with("provider", json!(provider))
}

/// `providerTransport`: once, with one immediate retry on `429`, `5xx` and network errors.
pub async fn transport(st: &AppState, request: &TransportRequest<'_>) -> Result<TransportAnswer, AppError> {
    // The demo's AI calls no provider (`demoTransport`), the work in the background included.
    if st.cfg.demo.is_some() {
        return Err(AppError::new("AI_DISABLED").with("reason", json!("demo")));
    }
    let (url, headers, body) = attempt_for(request)?;
    let provider = request.config.provider.as_str();
    let breaker = st.ext::<Breaker>();
    {
        let map = breaker.0.lock().unwrap();
        if let Some((_, Some(until))) = map.get(&url) {
            let now = Instant::now();
            if *until > now {
                let left = (*until - now).as_millis() as f64 / 1000.0;
                return Err(unavailable(provider).with("retry_after", json!(left.ceil() as i64)));
            }
        }
    }
    let client = if request.config.verify_certificate {
        st.https.clone()
    } else {
        st.ext::<Unchecked>()
            .0
            .get_or_init(|| reqwest::Client::builder().danger_accept_invalid_certs(true).build().unwrap_or_default())
            .clone()
    };
    let deadline = Instant::now() + Duration::from_millis(request.timeout_ms.max(1_000) as u64);
    let text = js_stringify(&body);
    let mut last_status: Option<u16> = None;
    for _ in 0..2 {
        let now = Instant::now();
        if now >= deadline {
            break;
        }
        let mut call = client.post(&url).timeout(deadline - now).body(text.clone());
        for (k, v) in &headers {
            call = call.header(k.as_str(), v.as_str());
        }
        match call.send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                if response.status().is_success() {
                    match response.json::<Value>().await {
                        Ok(body) => {
                            breaker.0.lock().unwrap().remove(&url);
                            return Ok(extract(provider, &body));
                        }
                        Err(_) => continue,
                    }
                }
                last_status = Some(status);
                if status == 401 || status == 403 || (status != 429 && status < 500) {
                    break;
                }
                let retry_after = response.headers().get("retry-after").and_then(|v| v.to_str().ok()).map(crate::js::js_to_number).unwrap_or(0.0);
                let wait = if retry_after.is_finite() { retry_after * 1000.0 } else { 0.0 };
                if wait > 0.0 && Instant::now() + Duration::from_millis(wait as u64) < deadline {
                    tokio::time::sleep(Duration::from_millis(wait as u64)).await;
                }
            }
            Err(_) => continue,
        }
    }
    {
        let mut map = breaker.0.lock().unwrap();
        let failures = map.get(&url).map(|s| s.0).unwrap_or(0) + 1;
        map.insert(url, (failures, if failures >= BREAKER_THRESHOLD { Some(Instant::now() + BREAKER) } else { None }));
    }
    Err(unavailable(provider).with("status", json!(last_status)))
}

// ── The call ──────────────────────────────────────────────────────────────────

/// `invoke`'s options.
#[derive(Default)]
pub struct InvokeOptions {
    pub timeout_ms: Option<u64>,
    pub max_tokens: Option<u32>,
    pub images: Vec<AiImage>,
}

/// `invoke`: runs the call, validates, logs whatever the outcome; one retry on an answer
/// that is not the schema's.
#[allow(clippy::too_many_arguments)]
pub async fn invoke(
    st: &AppState,
    ctx: &RequestContext,
    config: &ProviderConfig,
    usage: Usage,
    base_id: Option<&str>,
    payload: &Value,
    schema: &Value,
    system: &str,
    options: InvokeOptions,
) -> Result<Map<String, Value>, AppError> {
    let entry = |status: &'static str, code: Option<&'static str>| LogEntry { usage, base_id, config, status, code, duration_ms: None, tokens_in: None, tokens_out: None };
    let budget = options.timeout_ms.unwrap_or(TIMEOUT_MS) as i64;
    if js_stringify(payload).len() > MAX_PAYLOAD_BYTES {
        log(&st.pools, ctx, entry("refused", Some("AI_PAYLOAD_TOO_LARGE"))).await;
        return Err(AppError::new("AI_PAYLOAD_TOO_LARGE").with("maximum", json!(MAX_PAYLOAD_BYTES)));
    }
    let started = Instant::now();
    let elapsed = |s: Instant| s.elapsed().as_millis() as i64;
    for _ in 0..2 {
        let request = TransportRequest {
            config,
            system,
            payload,
            schema,
            timeout_ms: budget - elapsed(started),
            max_tokens: options.max_tokens,
            images: &options.images,
        };
        let answer = match transport(st, &request).await {
            Ok(a) => a,
            Err(e) => {
                log(&st.pools, ctx, LogEntry { duration_ms: Some(elapsed(started)), ..entry("failed", Some("AI_PROVIDER_UNAVAILABLE")) }).await;
                return Err(e);
            }
        };
        if let Some(parsed) = parse_json(&answer.text) {
            if validate(&parsed, schema) {
                log(
                    &st.pools,
                    ctx,
                    LogEntry { duration_ms: Some(elapsed(started)), tokens_in: answer.input_tokens, tokens_out: answer.output_tokens, ..entry("accepted", None) },
                )
                .await;
                return Ok(match parsed {
                    Value::Object(m) => m,
                    // An array is an object to JavaScript: its keys are its indices.
                    Value::Array(items) => items.into_iter().enumerate().map(|(i, v)| (i.to_string(), v)).collect(),
                    _ => Map::new(),
                });
            }
        }
    }
    log(&st.pools, ctx, LogEntry { duration_ms: Some(elapsed(started)), ..entry("unusable", Some("AI_RESPONSE_UNUSABLE")) }).await;
    Err(AppError::new("AI_RESPONSE_UNUSABLE").with("reason", json!("réponse non conforme au schéma attendu")))
}

/// `parseJson`: the first fenced block, then the whole text; from the first `{` to the last `}`.
pub fn parse_json(text: &str) -> Option<Value> {
    static FENCE: OnceLock<Regex> = OnceLock::new();
    let fence = FENCE.get_or_init(|| Regex::new(r"```(?:json)?\s*([\s\S]*?)```").unwrap());
    let fenced = fence.captures(text).and_then(|c| c.get(1)).map(|m| m.as_str());
    for candidate in [fenced, Some(text)].into_iter().flatten() {
        let (Some(start), Some(end)) = (candidate.find('{'), candidate.rfind('}')) else { continue };
        if end <= start {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<Value>(&candidate[start..=end]) {
            if value.is_object() || value.is_array() {
                return Some(value);
            }
        }
    }
    None
}

/// `validate`: the hand-written walker over the fixed schemas.
pub fn validate(value: &Value, schema: &Value) -> bool {
    match schema.get("type").and_then(Value::as_str) {
        Some("object") => {
            let Value::Object(record) = value else { return false };
            if let Some(required) = schema.get("required").and_then(Value::as_array) {
                if required.iter().filter_map(Value::as_str).any(|k| !record.contains_key(k)) {
                    return false;
                }
            }
            if let Some(Value::Object(properties)) = schema.get("properties") {
                for (key, sub) in properties {
                    let Some(v) = record.get(key) else { continue };
                    if v.is_null() && sub.get("nullable") == Some(&Value::Bool(true)) {
                        continue;
                    }
                    if !validate(v, sub) {
                        return false;
                    }
                }
            }
            true
        }
        Some("array") => {
            let Value::Array(items) = value else { return false };
            match schema.get("items") {
                Some(sub) => items.iter().all(|i| validate(i, sub)),
                None => true,
            }
        }
        Some("string") => value.is_string(),
        Some("boolean") => value.is_boolean(),
        Some("number") => value.is_number(),
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_json_out_of_prose_and_fences() {
        assert_eq!(parse_json("Voici :\n```json\n{\"a\":1}\n```"), Some(json!({"a":1})));
        assert_eq!(parse_json("bla {\"a\": [1]} fin"), Some(json!({"a":[1]})));
        assert_eq!(parse_json("```\nrien\n``` {\"b\":2}"), Some(json!({"b":2})));
        assert_eq!(parse_json("pas de json"), None);
    }

    #[test]
    fn validates_like_the_walker() {
        let schema = json!({"type":"object","required":["a"],"properties":{"a":{"type":"string"},"b":{"type":"string","nullable":true},"c":{"type":"array","items":{"type":"number"}}}});
        assert!(validate(&json!({"a":"x","b":null,"c":[1,2]}), &schema));
        assert!(!validate(&json!({"b":"x"}), &schema));
        assert!(!validate(&json!({"a":"x","c":["1"]}), &schema));
        assert!(!validate(&json!([1]), &schema));
    }

    #[test]
    fn reads_headers_as_operators_leave_them() {
        assert_eq!(header_entries(r#"{"api-key":"k"}"#), Some(vec![("api-key".into(), json!("k"))]));
        assert_eq!(header_entries("{'api-key': 'k', b: c}"), Some(vec![("api-key".into(), json!("k")), ("b".into(), json!("c"))]));
        assert_eq!(header_entries("A: 1\r\nB: 2"), Some(vec![("A".into(), json!("1")), ("B".into(), json!("2"))]));
        assert_eq!(header_entries("[1]"), None);
        assert_eq!(header_entries("pas un en-tête"), None);
    }

    #[test]
    fn endpoint_from_the_environment() {
        let env: HashMap<String, String> = [("BASEDB_AI_BASE_URL", "ftp://x"), ("BASEDB_AI_HEADERS", "")].iter().map(|(a, b)| (a.to_string(), b.to_string())).collect();
        assert_eq!(endpoint_from_env(&env).unwrap_err().code, "AI_NOT_CONFIGURED");
        let env: HashMap<String, String> =
            [("BASEDB_AI_BASE_URL", " http://h/v1?api-version=1 "), ("BASEDB_AI_HEADERS", "{\"Api-Key\":\"k\"}"), ("BASEDB_AI_PROVIDER_SSL_VERIFY", "off")]
                .iter()
                .map(|(a, b)| (a.to_string(), b.to_string()))
                .collect();
        let e = endpoint_from_env(&env).unwrap();
        assert_eq!(e.base_url.as_deref(), Some("http://h/v1?api-version=1"));
        assert_eq!(e.headers.unwrap().get("api-key").map(String::as_str), Some("k"));
        assert!(!e.verify_certificate);
        assert_eq!(under("http://h/v1/?api-version=1", "/chat/completions").unwrap(), "http://h/v1/chat/completions?api-version=1");
    }
}
