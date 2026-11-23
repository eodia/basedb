//! `auth/oidc.ts` and `auth/oidc-providers.ts` (chapter 13 §3): signing in, and linking an
//! identity, through an OpenID Connect provider.
//!
//! Authorization code with PKCE `S256`, confidential client, `response_mode=query`,
//! mandatory nonce. The exchange state travels in a sealed cookie — no server storage. The
//! identity token is checked here: asymmetric signature against the provider's key set
//! (RS*, PS*, ES256, ES384 — ES512 is refused, `ring` has no P-521), issuer, audience,
//! `azp`, expiry and `nbf` with two minutes of tolerance, nonce in constant time.

use crate::common::{audit, bounded, js_trim, lenient_json, require_elevated_session, user_agent, with_cookies};
use crate::groups::ensure_system_groups;
use crate::profile::{preset, setting_text, valid_slug};
use crate::sealing::{seal, unseal};
use crate::signup::read_policy;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Extension;
use basedb_base::auth::session::{create_session, csrf_for, load_session_by_id, session_usable};
use basedb_base::auth::{cookie, known_address, session_cookies};
use basedb_base::config::Config;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::time::{b64url, b64url_decode, constant_eq, now_ms, random_bytes, sha256};
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_contracts::ErrorClass;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// §3.3 — the exchange cookie, and its life.
pub const OIDC_COOKIE: &str = "__Host-basedb_oidc";
const EXCHANGE_TTL_MS: i64 = 10 * 60 * 1000;
/// §3.4 point 3 — clock tolerance between us and the provider.
const CLOCK_TOLERANCE_S: f64 = 120.0;
/// §3.4 point 1 — asymmetric only.
const ALGORITHMS: [&str; 9] = ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"];
const HTTP_TIMEOUT: Duration = Duration::from_secs(10);
const DISCOVERY_TTL: Duration = Duration::from_secs(3600);
/// `createRemoteJWKSet`'s defaults: keys kept ten minutes, refetched on an unknown `kid` at
/// most every thirty seconds.
const KEYS_TTL: Duration = Duration::from_secs(600);
const KEYS_COOLDOWN: Duration = Duration::from_secs(30);
const DEFAULT_SCOPES: &str = "openid email profile";

// ------------------------------------------------------------------------------------
// Providers
// ------------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Provisioning {
    Off,
    Domains,
    Signup,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OidcProvider {
    pub slug: String,
    pub label: String,
    pub issuer: String,
    pub client_id: String,
    pub client_secret: String,
    pub scopes: String,
    pub provisioning: Provisioning,
    pub provisioning_domains: Vec<String>,
    pub trusted_domains: Vec<String>,
}

fn env_name(slug: &str, key: &str) -> String {
    format!("BASEDB_OIDC_{}_{key}", slug.to_uppercase().replace('-', "_"))
}

fn env_slugs(setting: &impl Fn(&str) -> Option<String>) -> Vec<String> {
    setting("BASEDB_OIDC_PROVIDERS").unwrap_or_default().split(',').map(|s| js_trim(s).to_lowercase()).filter(|s| !s.is_empty()).collect()
}

/// server.ts's `oidcProviders()`: the ones the environment declares, complete. A provider
/// declared there creates the account as the sign-up policy says, unless `_SIGNUP=off`.
pub fn env_providers(setting: impl Fn(&str) -> Option<String>) -> Vec<OidcProvider> {
    let domains = |v: Option<String>| -> Vec<String> {
        v.unwrap_or_default()
            .split(',')
            .map(|d| {
                let d = js_trim(d).to_lowercase();
                d.strip_prefix('@').map(str::to_string).unwrap_or(d)
            })
            .filter(|d| !d.is_empty())
            .collect()
    };
    let mut out = Vec::new();
    for slug in env_slugs(&setting) {
        if !valid_slug(&slug) {
            continue;
        }
        let name = |key: &str| env_name(&slug, key);
        let p = preset(&slug);
        let issuer = setting(&name("ISSUER")).or_else(|| p.as_ref().and_then(|p| p.issuer.map(str::to_string)));
        let (Some(issuer), Some(client_id), Some(client_secret)) = (issuer, setting(&name("CLIENT_ID")), setting(&name("CLIENT_SECRET"))) else {
            continue;
        };
        out.push(OidcProvider {
            label: setting(&name("LABEL")).or_else(|| p.map(|p| p.label.to_string())).unwrap_or_else(|| slug.clone()),
            issuer,
            client_id,
            client_secret,
            scopes: setting(&name("SCOPES")).unwrap_or_else(|| DEFAULT_SCOPES.to_string()),
            provisioning: if setting(&name("SIGNUP")).as_deref() == Some("off") { Provisioning::Off } else { Provisioning::Signup },
            provisioning_domains: Vec::new(),
            trusted_domains: domains(setting(&name("TRUSTED_DOMAINS"))),
            slug,
        });
    }
    out
}

/// What `server.ts` said at start about the environment's providers.
pub fn announce(cfg: &Config) {
    let setting = |n: &str| cfg.setting(n);
    for slug in env_slugs(&setting) {
        if !valid_slug(&slug) {
            eprintln!("BASEDB_OIDC_PROVIDERS : « {slug} » n’est pas un nom (lettres, chiffres, tirets).");
            continue;
        }
        let issuer = setting(&env_name(&slug, "ISSUER")).is_some() || preset(&slug).is_some_and(|p| p.issuer.is_some());
        let missing: Vec<String> = [("ISSUER", issuer), ("CLIENT_ID", setting(&env_name(&slug, "CLIENT_ID")).is_some()), ("CLIENT_SECRET", setting(&env_name(&slug, "CLIENT_SECRET")).is_some())]
            .iter()
            .filter(|(_, present)| !present)
            .map(|(k, _)| env_name(&slug, k))
            .collect();
        if !missing.is_empty() {
            eprintln!("Connexion « {slug} » ignorée : {} {}.", missing.join(", "), if missing.len() > 1 { "manquants" } else { "manquant" });
        }
    }
    let providers = env_providers(setting);
    if !providers.is_empty() {
        let back = match cfg.setting("BASEDB_PUBLIC_URL") {
            None => "<BASEDB_PUBLIC_URL>/auth/oidc/<nom>/callback — BASEDB_PUBLIC_URL n’est pas défini".to_string(),
            Some(u) => format!("{}/auth/oidc/<nom>/callback", u.strip_suffix('/').unwrap_or(&u)),
        };
        println!("Connexion : {}. Adresse de retour à déclarer chez chacun : {back}.", providers.iter().map(|p| p.label.as_str()).collect::<Vec<_>>().join(", "));
    }
}

fn lowered_list(v: Option<&Value>) -> Vec<String> {
    v.and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).map(str::to_lowercase).collect()).unwrap_or_default()
}

/// `loadProviders`: the environment's, then the catalog's, narrowed by the tenant.
pub async fn load_providers<E: Exec + Sync>(exec: &E, st: &Shared, tenant_ref: &str) -> Result<Vec<OidcProvider>, AppError> {
    let configured = env_providers(|n| st.cfg.setting(n));
    let rows = exec
        .rows(
            "SELECT s.key, s.value, s.scope_kind
               FROM _basedb.setting s
               LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
              WHERE s.key LIKE $1
                AND (s.scope_kind = 'instance' OR t.ref = $2)",
            &[&"auth.oidc.%", &tenant_ref],
        )
        .await?;
    let mut declared: indexmap::IndexMap<String, Map<String, Value>> = indexmap::IndexMap::new();
    let mut accepted: Option<Vec<Value>> = None;
    for r in &rows {
        let key: String = r.get(0);
        let value: Value = r.get(1);
        let scope: String = r.get(2);
        if key == "auth.oidc.accepted" && scope == "tenant" {
            accepted = value.as_array().cloned();
            continue;
        }
        let rest = &key["auth.oidc.".len()..];
        let Some((slug, property)) = rest.split_once('.') else { continue };
        declared.entry(slug.to_string()).or_default().insert(property.to_string(), value);
    }
    let secrets = exec
        .rows(
            "SELECT key, value_encrypted FROM _basedb.secret
              WHERE scope_kind = 'instance' AND key LIKE $1 AND status = 'valid'",
            &[&"auth.oidc.%.client_secret"],
        )
        .await?;
    let mut secret_of: HashMap<String, Vec<u8>> = HashMap::new();
    for s in &secrets {
        let key: String = s.get(0);
        secret_of.insert(key["auth.oidc.".len()..].replacen(".client_secret", "", 1), s.get(1));
    }
    let is_accepted = |slug: &str| accepted.as_ref().is_none_or(|a| a.iter().any(|v| v.as_str() == Some(slug)));
    let mut providers: Vec<OidcProvider> = configured.iter().filter(|p| is_accepted(&p.slug)).cloned().collect();
    let key = st.instance_key()?;
    for (slug, entry) in &declared {
        if !is_accepted(slug) || configured.iter().any(|p| &p.slug == slug) {
            continue;
        }
        let (Some(issuer), Some(client_id), Some(sealed)) = (setting_text(entry.get("issuer")), setting_text(entry.get("client_id")), secret_of.get(slug)) else {
            continue;
        };
        let Some(client_secret) = unseal(key, "oidc-client-secret", &String::from_utf8_lossy(sealed)) else { continue };
        let p = preset(slug).or_else(|| preset(&setting_text(entry.get("preset")).unwrap_or_default()));
        providers.push(OidcProvider {
            slug: slug.clone(),
            label: setting_text(entry.get("label")).or_else(|| p.map(|p| p.label.to_string())).unwrap_or_else(|| slug.clone()),
            issuer,
            client_id,
            client_secret,
            scopes: setting_text(entry.get("scopes")).unwrap_or_else(|| DEFAULT_SCOPES.to_string()),
            // Anything that is not exactly `domains` is `off`: a misspelt setting closes the door.
            provisioning: if setting_text(entry.get("provisioning")).as_deref() == Some("domains") { Provisioning::Domains } else { Provisioning::Off },
            provisioning_domains: lowered_list(entry.get("provisioning_domains")),
            trusted_domains: lowered_list(entry.get("trusted_domains")),
        });
    }
    providers.sort_by(|a, b| crate::common::fr_cmp(&a.slug, &b.slug));
    Ok(providers)
}

/// `requireProvider`: undeclared, or not accepted by this tenant — one answer.
pub async fn require_provider(st: &Shared, tenant_ref: &str, slug: &str) -> Result<OidcProvider, AppError> {
    let exec = st.pools.catalog().await?;
    load_providers(&exec, st, tenant_ref)
        .await?
        .into_iter()
        .find(|p| p.slug == slug)
        .ok_or_else(|| AppError::new("OIDC_PROVIDER_UNKNOWN").with("slug", json!(slug)))
}

// ------------------------------------------------------------------------------------
// Discovery and keys, cached per process
// ------------------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct Discovery {
    pub issuer: Option<String>,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub jwks_uri: String,
    pub token_endpoint_auth_methods_supported: Option<Vec<String>>,
}

struct Cached {
    document: Discovery,
    fetched: Instant,
    keys: Vec<Value>,
    keys_fetched: Option<Instant>,
}

fn cache() -> &'static Mutex<HashMap<String, Cached>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Cached>>> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

async fn discover(http: &reqwest::Client, issuer: &str) -> Result<Discovery, AppError> {
    let kept = cache().lock().unwrap().get(issuer).filter(|c| c.fetched.elapsed() < DISCOVERY_TTL).map(|c| c.document.clone());
    if let Some(document) = kept {
        return Ok(document);
    }
    let url = if issuer.ends_with("/.well-known/openid-configuration") {
        issuer.to_string()
    } else {
        format!("{}/.well-known/openid-configuration", issuer.strip_suffix('/').unwrap_or(issuer))
    };
    // A provider that cannot be reached is an incident: the person did nothing wrong.
    let unreachable = || AppError::new("INTERNAL_ERROR").with("issuer", json!(issuer));
    let response = http.get(&url).timeout(HTTP_TIMEOUT).send().await.map_err(|_| unreachable())?;
    if !response.status().is_success() {
        return Err(unreachable());
    }
    let document: Discovery = response.json().await.map_err(|_| unreachable())?;
    cache().lock().unwrap().insert(issuer.to_string(), Cached { document: document.clone(), fetched: Instant::now(), keys: Vec::new(), keys_fetched: None });
    Ok(document)
}

async fn key_set(http: &reqwest::Client, issuer: &str, document: &Discovery, refresh: bool) -> Result<Vec<Value>, AppError> {
    let invalid = || AppError::new("OIDC_TOKEN_INVALID");
    let kept = {
        let cached = cache().lock().unwrap();
        cached.get(issuer).and_then(|c| {
            let at = c.keys_fetched?;
            (at.elapsed() < KEYS_TTL && (!refresh || at.elapsed() < KEYS_COOLDOWN)).then(|| c.keys.clone())
        })
    };
    if let Some(keys) = kept {
        return Ok(keys);
    }
    let response = http.get(&document.jwks_uri).timeout(HTTP_TIMEOUT).send().await.map_err(|_| invalid())?;
    if !response.status().is_success() {
        return Err(invalid());
    }
    let set: Value = response.json().await.map_err(|_| invalid())?;
    let keys = set["keys"].as_array().cloned().ok_or_else(invalid)?;
    if let Some(c) = cache().lock().unwrap().get_mut(issuer) {
        c.keys = keys.clone();
        c.keys_fetched = Some(Instant::now());
    }
    Ok(keys)
}

// ------------------------------------------------------------------------------------
// The identity token
// ------------------------------------------------------------------------------------

/// Whether `jwk` is a key `alg` may use (`kty`, `crv`, `alg`, `use`), as jose selects them.
fn usable_for(jwk: &Value, alg: &str) -> bool {
    let kty = jwk["kty"].as_str().unwrap_or("");
    let family = match alg {
        a if a.starts_with("RS") || a.starts_with("PS") => kty == "RSA",
        "ES256" => kty == "EC" && jwk["crv"] == "P-256",
        "ES384" => kty == "EC" && jwk["crv"] == "P-384",
        "ES512" => kty == "EC" && jwk["crv"] == "P-521",
        _ => false,
    };
    family && jwk.get("alg").and_then(Value::as_str).is_none_or(|a| a == alg) && jwk.get("use").and_then(Value::as_str).is_none_or(|u| u == "sig")
}

/// The signature of `message`, checked with one key.
pub fn signature_valid(alg: &str, jwk: &Value, message: &[u8], signature: &[u8]) -> bool {
    use ring::signature as s;
    let part = |k: &str| jwk[k].as_str().and_then(b64url_decode);
    let rsa: Option<&'static s::RsaParameters> = match alg {
        "RS256" => Some(&s::RSA_PKCS1_2048_8192_SHA256),
        "RS384" => Some(&s::RSA_PKCS1_2048_8192_SHA384),
        "RS512" => Some(&s::RSA_PKCS1_2048_8192_SHA512),
        "PS256" => Some(&s::RSA_PSS_2048_8192_SHA256),
        "PS384" => Some(&s::RSA_PSS_2048_8192_SHA384),
        "PS512" => Some(&s::RSA_PSS_2048_8192_SHA512),
        _ => None,
    };
    if let Some(params) = rsa {
        let (Some(n), Some(e)) = (part("n"), part("e")) else { return false };
        return s::RsaPublicKeyComponents { n: &n, e: &e }.verify(params, message, signature).is_ok();
    }
    let ec: &'static s::EcdsaVerificationAlgorithm = match alg {
        "ES256" => &s::ECDSA_P256_SHA256_FIXED,
        "ES384" => &s::ECDSA_P384_SHA384_FIXED,
        _ => return false,
    };
    let (Some(x), Some(y)) = (part("x"), part("y")) else { return false };
    let mut point = vec![4u8];
    point.extend_from_slice(&x);
    point.extend_from_slice(&y);
    s::UnparsedPublicKey::new(ec, point).verify(message, signature).is_ok()
}

/// The claims `jwtVerify` checks: issuer, audience, `exp` and `nbf` with the tolerance, `iat`
/// a number when present.
pub fn claims_valid(claims: &Map<String, Value>, issuer: Option<&str>, audience: &str, now_s: f64) -> bool {
    if let Some(issuer) = issuer {
        if claims.get("iss").and_then(Value::as_str) != Some(issuer) {
            return false;
        }
    }
    let audienced = match claims.get("aud") {
        Some(Value::String(a)) => a == audience,
        Some(Value::Array(a)) => a.iter().any(|v| v.as_str() == Some(audience)),
        _ => false,
    };
    if !audienced {
        return false;
    }
    let number = |k: &str| -> Result<Option<f64>, ()> {
        match claims.get(k) {
            None => Ok(None),
            Some(v) => v.as_f64().map(Some).ok_or(()),
        }
    };
    let (Ok(exp), Ok(nbf), Ok(_iat)) = (number("exp"), number("nbf"), number("iat")) else { return false };
    if exp.is_some_and(|exp| exp <= now_s - CLOCK_TOLERANCE_S) {
        return false;
    }
    !nbf.is_some_and(|nbf| nbf > now_s + CLOCK_TOLERANCE_S)
}

async fn verify_id_token(http: &reqwest::Client, provider: &OidcProvider, document: &Discovery, token: &str, now_s: f64) -> Result<Map<String, Value>, AppError> {
    let invalid = || AppError::new("OIDC_TOKEN_INVALID");
    let parts: Vec<&str> = token.split('.').collect();
    let [head, body, sig] = parts.as_slice() else { return Err(invalid()) };
    let header: Value = b64url_decode(head).and_then(|h| serde_json::from_slice(&h).ok()).ok_or_else(invalid)?;
    let alg = header["alg"].as_str().filter(|a| ALGORITHMS.contains(a)).ok_or_else(invalid)?;
    let signature = b64url_decode(sig).ok_or_else(invalid)?;
    let message = format!("{head}.{body}");
    let kid = header.get("kid").and_then(Value::as_str);
    let candidates = |keys: &[Value]| -> Vec<Value> { keys.iter().filter(|k| usable_for(k, alg) && kid.is_none_or(|kid| k["kid"].as_str() == Some(kid))).cloned().collect() };
    let mut found = candidates(&key_set(http, &provider.issuer, document, false).await?);
    if found.is_empty() {
        found = candidates(&key_set(http, &provider.issuer, document, true).await?);
    }
    if !found.iter().any(|k| signature_valid(alg, k, message.as_bytes(), &signature)) {
        return Err(invalid());
    }
    let claims: Map<String, Value> = b64url_decode(body).and_then(|b| serde_json::from_slice(&b).ok()).ok_or_else(invalid)?;
    if !claims_valid(&claims, document.issuer.as_deref(), &provider.client_id, now_s) {
        return Err(invalid());
    }
    Ok(claims)
}

// ------------------------------------------------------------------------------------
// The exchange
// ------------------------------------------------------------------------------------

/// The state of one exchange, as the sealed cookie carries it.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Exchange {
    slug: String,
    state: String,
    nonce: String,
    verifier: String,
    redirect_uri: String,
    return_to: String,
    expires_at: i64,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    link_session: Option<String>,
}

/// Keeps a return target to a path of this application — never `//elsewhere`.
pub fn safe_return(candidate: Option<&str>) -> String {
    match candidate {
        Some(c) if c.starts_with('/') && !c.starts_with("//") => c.to_string(),
        _ => "/".into(),
    }
}

/// `startOidc`: the provider's authorization address, and the sealed exchange cookie.
pub async fn start_exchange(http: &reqwest::Client, instance_key: &str, provider: &OidcProvider, redirect_uri: &str, return_to: Option<&str>, link_session: Option<&str>) -> Result<(String, String), AppError> {
    let document = discover(http, &provider.issuer).await?;
    let verifier = b64url(&random_bytes(32));
    let exchange = Exchange {
        slug: provider.slug.clone(),
        state: b64url(&random_bytes(32)),
        nonce: b64url(&random_bytes(32)),
        verifier: verifier.clone(),
        redirect_uri: redirect_uri.to_string(),
        return_to: safe_return(return_to),
        expires_at: now_ms() + EXCHANGE_TTL_MS,
        link_session: link_session.map(str::to_string),
    };
    let query = form_urlencoded::Serializer::new(String::new())
        .append_pair("response_type", "code")
        .append_pair("response_mode", "query")
        .append_pair("client_id", &provider.client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("scope", &provider.scopes)
        .append_pair("state", &exchange.state)
        .append_pair("nonce", &exchange.nonce)
        .append_pair("code_challenge", &b64url(&sha256(verifier.as_bytes())))
        .append_pair("code_challenge_method", "S256")
        .finish();
    let sealed = seal(instance_key, "oidc-exchange", &serde_json::to_string(&exchange).map_err(AppError::internal)?);
    Ok((format!("{}?{query}", document.authorization_endpoint), sealed))
}

/// The identity a provider asserted, once every check of §3.4 has passed.
#[derive(Debug, Clone, PartialEq)]
pub struct Asserted {
    pub subject: String,
    pub email: String,
    pub display_name: String,
    pub return_to: String,
    pub link_session: Option<String>,
}

/// `encodeURIComponent`.
pub fn encode_uri_component(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Trades the code for an identity token — the provider's access token is neither kept nor used.
async fn exchange_code(http: &reqwest::Client, document: &Discovery, provider: &OidcProvider, exchange: &Exchange, code: &str) -> Result<String, AppError> {
    let invalid = || AppError::new("OIDC_TOKEN_INVALID");
    let basic = document.token_endpoint_auth_methods_supported.as_ref().is_none_or(|m| m.iter().any(|m| m == "client_secret_basic"));
    // The serializer is not Send: the body is finished before any await.
    let body = {
        let mut form = form_urlencoded::Serializer::new(String::new());
        form.append_pair("grant_type", "authorization_code")
            .append_pair("code", code)
            .append_pair("redirect_uri", &exchange.redirect_uri)
            .append_pair("code_verifier", &exchange.verifier)
            .append_pair("client_id", &provider.client_id);
        if !basic {
            form.append_pair("client_secret", &provider.client_secret);
        }
        form.finish()
    };
    let mut request = http.post(&document.token_endpoint).timeout(HTTP_TIMEOUT).header(header::CONTENT_TYPE, "application/x-www-form-urlencoded");
    if basic {
        let credentials = format!("{}:{}", encode_uri_component(&provider.client_id), encode_uri_component(&provider.client_secret));
        request = request.header(header::AUTHORIZATION, format!("Basic {}", basedb_base::time::b64(credentials.as_bytes())));
    }
    let response = request.body(body).send().await.map_err(|_| invalid())?;
    if !response.status().is_success() {
        return Err(invalid());
    }
    let payload: Value = response.json().await.map_err(|_| invalid())?;
    payload["id_token"].as_str().map(str::to_string).ok_or_else(invalid)
}

/// The address, and the condition on which it is believed — §3.4 point 5. `userinfo` only
/// when the identity token carries none.
async fn address_of(http: &reqwest::Client, document: &Discovery, provider: &OidcProvider, claims: &Map<String, Value>, id_token: &str) -> Result<String, AppError> {
    let mut email = claims.get("email").and_then(Value::as_str).map(|e| js_trim(e).to_lowercase()).unwrap_or_default();
    let mut verified = claims.get("email_verified") == Some(&Value::Bool(true));
    if email.is_empty() {
        let issuer = document.issuer.as_deref().unwrap_or(&provider.issuer);
        let endpoint = format!("{}/userinfo", issuer.strip_suffix('/').unwrap_or(issuer));
        if let Ok(response) = http.get(&endpoint).timeout(HTTP_TIMEOUT).bearer_auth(id_token).send().await {
            if response.status().is_success() {
                let info: Value = response.json().await.unwrap_or_else(|_| json!({}));
                if let Some(e) = info["email"].as_str() {
                    email = js_trim(e).to_lowercase();
                }
                verified = verified || info["email_verified"] == Value::Bool(true);
            }
        }
    }
    if email.is_empty() {
        return Err(AppError::new("OIDC_TOKEN_INVALID"));
    }
    let domain = &email[email.rfind('@').map_or(0, |i| i + 1)..];
    if !verified && !provider.trusted_domains.iter().any(|d| d == domain) {
        return Err(AppError::new("OIDC_TOKEN_INVALID"));
    }
    Ok(email)
}

/// `completeOidc`: every refusal is `OIDC_STATE_INVALID` or `OIDC_TOKEN_INVALID`, without detail.
pub async fn complete_exchange(http: &reqwest::Client, instance_key: &str, provider: &OidcProvider, code: Option<&str>, state: Option<&str>, sealed: Option<&str>, now: i64) -> Result<Asserted, AppError> {
    let raw = sealed.and_then(|c| unseal(instance_key, "oidc-exchange", c));
    let (Some(raw), Some(code), Some(state)) = (raw, code, state) else {
        return Err(AppError::new("OIDC_STATE_INVALID"));
    };
    let exchange: Exchange = serde_json::from_str(&raw).map_err(AppError::internal)?;
    if exchange.expires_at <= now || exchange.slug != provider.slug || !constant_eq(exchange.state.as_bytes(), state.as_bytes()) {
        return Err(AppError::new("OIDC_STATE_INVALID"));
    }
    let document = discover(http, &provider.issuer).await?;
    let id_token = exchange_code(http, &document, provider, &exchange, code).await?;
    let claims = verify_id_token(http, provider, &document, &id_token, now as f64 / 1000.0).await?;
    let invalid = || AppError::new("OIDC_TOKEN_INVALID");
    // `azp`, when present, must be us: a token minted for another client is no login here.
    if claims.get("azp").and_then(Value::as_str).is_some_and(|azp| azp != provider.client_id) {
        return Err(invalid());
    }
    match claims.get("nonce").and_then(Value::as_str) {
        Some(nonce) if constant_eq(nonce.as_bytes(), exchange.nonce.as_bytes()) => {}
        _ => return Err(invalid()),
    }
    let subject = claims.get("sub").and_then(Value::as_str).map(js_trim).unwrap_or("").to_string();
    if subject.is_empty() {
        return Err(invalid());
    }
    let email = address_of(http, &document, provider, &claims, &id_token).await?;
    let display_name = claims.get("name").and_then(Value::as_str).map(js_trim).filter(|n| !n.is_empty()).map(str::to_string).unwrap_or_else(|| email.clone());
    Ok(Asserted { subject, email, display_name, return_to: exchange.return_to, link_session: exchange.link_session })
}

// ------------------------------------------------------------------------------------
// Identities
// ------------------------------------------------------------------------------------

/// `resolveIdentity` (§3.5): attachment by `sub`, never by address; provisioning decides
/// for a stranger, and is off by default.
pub async fn resolve_identity<E: Exec + Sync>(exec: &E, provider: &OidcProvider, tenant_ref: &str, asserted: &Asserted) -> Result<(String, String, bool), AppError> {
    let Some(tenant) = exec.first("SELECT id::text, created_by::text FROM _basedb.tenant WHERE ref = $1", &[&tenant_ref]).await? else {
        return Err(AppError::new("OIDC_PROVIDER_UNKNOWN"));
    };
    let (tenant_id, created_by): (String, String) = (tenant.get(0), tenant.get(1));
    let issuer = format!("oidc:{}", provider.slug);
    let linked = exec
        .first(
            "SELECT i.user_id::text
               FROM _basedb.auth_identity i
               JOIN _basedb.app_user u ON u.id = i.user_id
              WHERE i.provider = $1 AND i.subject = $2
                AND u.tenant_id = $3::text::uuid AND u.disabled_at IS NULL AND u.deleted_at IS NULL",
            &[&issuer, &asserted.subject, &tenant_id],
        )
        .await?;
    if let Some(row) = linked {
        let user_id: String = row.get(0);
        exec.execute_op("UPDATE _basedb.auth_identity SET last_used_at = clock_timestamp() WHERE provider = $1 AND subject = $2", &[&issuer, &asserted.subject], SqlOp::Update).await?;
        // The address follows the provider, but only into a place that is free.
        exec.execute_op(
            "UPDATE _basedb.app_user u
                SET email = $2
              WHERE u.id = $1::text::uuid AND lower(u.email) <> $2
                AND NOT EXISTS (
                  SELECT 1 FROM _basedb.app_user o
                   WHERE o.tenant_id = u.tenant_id AND lower(o.email) = $2 AND o.id <> u.id)",
            &[&user_id, &asserted.email],
            SqlOp::Update,
        )
        .await?;
        return Ok((user_id, tenant_id, false));
    }
    let by_address = exec
        .rows(
            "SELECT id FROM _basedb.app_user
              WHERE tenant_id = $1::text::uuid AND lower(email) = $2
                AND disabled_at IS NULL AND deleted_at IS NULL",
            &[&tenant_id, &asserted.email],
        )
        .await?;
    if !by_address.is_empty() {
        return Err(AppError::new("OIDC_ACCOUNT_LINK_REQUIRED").with("slug", json!(provider.slug)));
    }
    let domain = asserted.email[asserted.email.rfind('@').map_or(0, |i| i + 1)..].to_lowercase();
    let admitted = match provider.provisioning {
        Provisioning::Off => false,
        Provisioning::Domains => provider.provisioning_domains.contains(&domain),
        Provisioning::Signup => {
            let policy = read_policy(exec, tenant_ref).await?;
            policy.open && (policy.domains.is_empty() || policy.domains.contains(&domain))
        }
    };
    if !admitted {
        return Err(AppError::new("PROVISIONING_REFUSED").with("slug", json!(provider.slug)));
    }
    let created = exec
        .query_op(
            "INSERT INTO _basedb.app_user (tenant_id, email, display_name, created_by, updated_by)
             VALUES ($1::text::uuid, $2, $3, $4::text::uuid, $4::text::uuid) RETURNING id::text",
            &[&tenant_id, &asserted.email, &asserted.display_name, &created_by],
            SqlOp::Insert,
        )
        .await?;
    let user_id: String = created.first().ok_or_else(|| AppError::internal("compte non créé"))?.get(0);
    exec.execute_op("INSERT INTO _basedb.auth_identity (user_id, provider, subject) VALUES ($1::text::uuid, $2, $3)", &[&user_id, &issuer, &asserted.subject], SqlOp::Insert).await?;
    // Created with no right; as a sign-up, it belongs to « Tous les utilisateurs ».
    if provider.provisioning == Provisioning::Signup {
        ensure_system_groups(exec, tenant_ref, &user_id).await?;
    }
    Ok((user_id, tenant_id, true))
}

/// `linkIdentity`: the identity already opens another account, or this account already has
/// one at the provider — both said; the same identity again changes nothing.
pub async fn link_identity<E: Exec + Sync>(exec: &E, provider: &OidcProvider, user_id: &str, subject: &str) -> Result<(), AppError> {
    let issuer = format!("oidc:{}", provider.slug);
    let held = exec
        .rows("SELECT user_id::text, subject FROM _basedb.auth_identity WHERE provider = $1 AND (subject = $2 OR user_id = $3::text::uuid)", &[&issuer, &subject, &user_id])
        .await?;
    let held: Vec<(String, String)> = held.iter().map(|r| (r.get(0), r.get(1))).collect();
    if held.iter().any(|(u, s)| s == subject && u != user_id) {
        return Err(AppError::new("REQUEST_INVALID").with("reason", json!("identite_deja_liee")));
    }
    if held.iter().any(|(u, s)| u == user_id && s != subject) {
        return Err(AppError::new("REQUEST_INVALID").with("reason", json!("fournisseur_deja_lie")));
    }
    if !held.is_empty() {
        return Ok(());
    }
    exec.execute_op(
        "INSERT INTO _basedb.auth_identity (user_id, provider, subject, last_used_at) VALUES ($1::text::uuid, $2, $3, clock_timestamp())",
        &[&user_id, &issuer, &subject],
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}

// ------------------------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------------------------

/// Where the provider sends the browser back: `BASEDB_PUBLIC_URL`, else this request's origin
/// under the base path.
fn redirect_uri(st: &Shared, headers: &HeaderMap, slug: &str) -> String {
    let base = match &st.cfg.public_url {
        Some(url) => url.clone(),
        None => format!("http://{}{}", headers.get(header::HOST).and_then(|h| h.to_str().ok()).unwrap_or("localhost"), st.cfg.base_path),
    };
    format!("{}/auth/oidc/{slug}/callback", base.strip_suffix('/').unwrap_or(&base))
}

/// `SameSite=Lax`, because the return is a top-level GET that `Strict` would strip.
fn exchange_cookie(sealed: &str) -> String {
    format!("{OIDC_COOKIE}={}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax", encode_uri_component(sealed))
}

fn deleted_exchange_cookie() -> String {
    format!("{OIDC_COOKIE}=; Max-Age=0; Path=/; Secure")
}

fn redirect(location: &str) -> Response {
    let mut res = StatusCode::FOUND.into_response();
    if let Ok(v) = HeaderValue::from_str(location) {
        res.headers_mut().insert(header::LOCATION, v);
    }
    res
}

/// `GET /auth/oidc/{slug}/start`.
pub async fn start(State(st): State<Shared>, Path(slug): Path<String>, Query(q): Query<HashMap<String, String>>, headers: HeaderMap) -> ApiResult {
    let key = st.instance_key()?;
    let provider = require_provider(&st, st.cfg.auth_tenant(), &slug).await?;
    let return_to = q.get("return_to").cloned().unwrap_or_else(|| format!("{}/", st.cfg.base_path));
    let (url, sealed) = start_exchange(&st.https, key, &provider, &redirect_uri(&st, &headers, &slug), Some(&return_to), None).await?;
    Ok(with_cookies(redirect(&url), [exchange_cookie(&sealed)]))
}

enum Completed {
    Session { token: String, csrf: String, return_to: String },
    Linked { return_to: String },
}

async fn complete(st: &Shared, rid: &RequestId, slug: &str, q: &HashMap<String, String>, headers: &HeaderMap, address: &str) -> Result<Completed, AppError> {
    let key = st.instance_key()?;
    let tenant_ref = st.cfg.auth_tenant();
    let provider = require_provider(st, tenant_ref, slug).await?;
    let sealed = cookie(headers, OIDC_COOKIE);
    let asserted = complete_exchange(&st.https, key, &provider, q.get("code").map(String::as_str), q.get("state").map(String::as_str), sealed.as_deref(), now_ms()).await?;
    if let Some(link) = &asserted.link_session {
        let snapshot = load_session_by_id(&st.pools.catalog().await?, link).await?;
        // The session that opened the exchange, still open and in this tenant.
        let Some(s) = snapshot.filter(|s| session_usable(s, Utc::now()) && s.tenant_ref == tenant_ref) else {
            return Err(AppError::new("AUTHENTICATION_REQUIRED"));
        };
        let ctx = RequestContext::new(rid.0.clone(), Actor::user(s.user_id.clone()), s.tenant_ref.clone(), Surface::Rest);
        let (c, p, user, subject) = (&ctx, &provider, &s.user_id, &asserted.subject);
        with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
            link_identity(&tx, p, user, subject).await?;
            audit(&tx, c, "user.identity_link", "app_user", Some(user), None, json!({ "provider": p.slug })).await
        })
        .await?;
        return Ok(Completed::Linked { return_to: asserted.return_to });
    }
    let exec = st.pools.catalog().await?;
    let (user_id, tenant_id, _provisioned) = resolve_identity(&exec, &provider, tenant_ref, &asserted).await?;
    let (token, _session, _absolute) = create_session(&exec, &user_id, &tenant_id, known_address(address), user_agent(headers), Utc::now()).await?;
    let csrf = csrf_for(key, &sha256(token.as_bytes()));
    Ok(Completed::Session { token, csrf, return_to: asserted.return_to })
}

/// `GET /auth/oidc/{slug}/callback`: a refusal goes back to the interface as
/// `?connexion=CODE[&raison=…]`; an incident is answered as one.
pub async fn callback(State(st): State<Shared>, Extension(rid): Extension<RequestId>, Path(slug): Path<String>, Query(q): Query<HashMap<String, String>>, headers: HeaderMap) -> Response {
    let address = match bounded(&st, &headers) {
        Ok(a) => a,
        Err(res) => return res,
    };
    match complete(&st, &rid, &slug, &q, &headers, &address).await {
        Ok(Completed::Session { token, csrf, return_to }) => {
            let [session, csrf] = session_cookies(&token, &csrf);
            with_cookies(redirect(&return_to), [deleted_exchange_cookie(), session, csrf])
        }
        Ok(Completed::Linked { return_to }) => with_cookies(redirect(&return_to), [deleted_exchange_cookie()]),
        Err(e) if e.class() == ErrorClass::Incident => e.into_response(),
        Err(e) => {
            let suffix = e.details.get("reason").and_then(Value::as_str).map(|r| format!("&raison={}", encode_uri_component(r))).unwrap_or_default();
            let location = format!("{}/?connexion={}{suffix}", st.cfg.base_path, encode_uri_component(e.code));
            with_cookies(redirect(&location), [deleted_exchange_cookie()])
        }
    }
}

/// `POST /auth/oidc/{slug}/link`: from a session already open AND elevated; the provider's
/// return completes the link on `/callback`, which opens no session.
pub async fn link(State(st): State<Shared>, Extension(rid): Extension<RequestId>, Path(slug): Path<String>, headers: HeaderMap, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let (who, ctx) = crate::profile::account_holder(&st, &headers, &rid).await?;
    let key = st.instance_key()?;
    let provider = require_provider(&st, &ctx.tenant_id, &slug).await?;
    require_elevated_session(&st.pools.catalog().await?, &ctx, &who.session_id).await?;
    let return_to = body.get("return_to").and_then(Value::as_str);
    let (url, sealed) = start_exchange(&st.https, key, &provider, &redirect_uri(&st, &headers, &slug), return_to, Some(&who.session_id)).await?;
    Ok(with_cookies(json_ok(json!({ "data": { "url": url } })), [exchange_cookie(&sealed)]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::rand::SystemRandom;
    use ring::signature::{EcdsaKeyPair, KeyPair, ECDSA_P256_SHA256_FIXED_SIGNING};

    fn provider(issuer: &str) -> OidcProvider {
        OidcProvider {
            slug: "maison".into(),
            label: "Maison".into(),
            issuer: issuer.into(),
            client_id: "basedb".into(),
            client_secret: "s3cret".into(),
            scopes: DEFAULT_SCOPES.into(),
            provisioning: Provisioning::Off,
            provisioning_domains: vec![],
            trusted_domains: vec!["confiance.fr".into()],
        }
    }

    #[test]
    fn environment_providers() {
        let env: HashMap<&str, &str> = HashMap::from([
            ("BASEDB_OIDC_PROVIDERS", "google, mon-sso"),
            ("BASEDB_OIDC_GOOGLE_CLIENT_ID", "id"),
            ("BASEDB_OIDC_GOOGLE_CLIENT_SECRET", "s"),
            ("BASEDB_OIDC_GOOGLE_SIGNUP", "off"),
            ("BASEDB_OIDC_MON_SSO_ISSUER", "https://sso"),
            ("BASEDB_OIDC_MON_SSO_CLIENT_ID", "id"),
            ("BASEDB_OIDC_MON_SSO_CLIENT_SECRET", "s"),
            ("BASEDB_OIDC_MON_SSO_TRUSTED_DOMAINS", " @Maison.FR, ,x.org"),
        ]);
        let got = env_providers(|n| env.get(n).map(|v| v.to_string()));
        assert_eq!(got[0].issuer, "https://accounts.google.com");
        assert_eq!(got[0].provisioning, Provisioning::Off);
        assert_eq!(got[1].provisioning, Provisioning::Signup);
        assert_eq!(got[1].trusted_domains, vec!["maison.fr", "x.org"]);
        assert_eq!(got[1].scopes, "openid email profile");
    }

    #[test]
    fn returns_stay_here_and_components_are_encoded() {
        assert_eq!(safe_return(Some("/bases?x=1")), "/bases?x=1");
        assert_eq!(safe_return(Some("//evil.example")), "/");
        assert_eq!(safe_return(Some("https://evil.example")), "/");
        assert_eq!(safe_return(None), "/");
        assert_eq!(encode_uri_component("a b@c/d~'"), "a%20b%40c%2Fd~'");
        assert_eq!(encode_uri_component("é"), "%C3%A9");
    }

    #[test]
    fn claims_are_checked_like_jose() {
        let c = |v: Value| v.as_object().unwrap().clone();
        let ok = c(json!({ "iss": "https://i", "aud": "basedb", "exp": 1000.0, "nbf": 900 }));
        assert!(claims_valid(&ok, Some("https://i"), "basedb", 1000.0 + 119.0));
        assert!(!claims_valid(&ok, Some("https://i"), "basedb", 1000.0 + 120.0));
        assert!(!claims_valid(&ok, Some("https://autre"), "basedb", 950.0));
        assert!(!claims_valid(&ok, Some("https://i"), "autre", 950.0));
        assert!(!claims_valid(&ok, Some("https://i"), "basedb", 900.0 - 121.0));
        assert!(claims_valid(&c(json!({ "iss": "https://i", "aud": ["x", "basedb"] })), Some("https://i"), "basedb", 0.0));
        assert!(!claims_valid(&c(json!({ "iss": "https://i" })), Some("https://i"), "basedb", 0.0));
        assert!(!claims_valid(&c(json!({ "aud": "basedb", "exp": "demain" })), None, "basedb", 0.0));
    }

    struct Signer {
        pair: EcdsaKeyPair,
        rng: SystemRandom,
    }

    impl Signer {
        fn new() -> Signer {
            let rng = SystemRandom::new();
            let pkcs8 = EcdsaKeyPair::generate_pkcs8(&ECDSA_P256_SHA256_FIXED_SIGNING, &rng).unwrap();
            Signer { pair: EcdsaKeyPair::from_pkcs8(&ECDSA_P256_SHA256_FIXED_SIGNING, pkcs8.as_ref(), &rng).unwrap(), rng }
        }
        fn jwk(&self) -> Value {
            let p = self.pair.public_key().as_ref();
            json!({ "kty": "EC", "crv": "P-256", "kid": "k1", "use": "sig", "x": b64url(&p[1..33]), "y": b64url(&p[33..65]) })
        }
        fn token(&self, claims: Value) -> String {
            let head = b64url(br#"{"alg":"ES256","kid":"k1","typ":"JWT"}"#);
            let body = b64url(claims.to_string().as_bytes());
            let sig = self.pair.sign(&self.rng, format!("{head}.{body}").as_bytes()).unwrap();
            format!("{head}.{body}.{}", b64url(sig.as_ref()))
        }
    }

    /// The whole exchange against a provider served on this machine: discovery, PKCE, the
    /// token endpoint with basic authentication, the key set, the identity token's checks.
    #[tokio::test]
    async fn an_exchange_completes_against_a_provider() {
        use axum::routing::{get, post};
        use std::sync::Arc;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let issuer = format!("http://{}", listener.local_addr().unwrap());
        let signer = Arc::new(Signer::new());
        let seen: Arc<Mutex<Option<(String, String)>>> = Arc::new(Mutex::new(None));
        let nonce: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
        let (iss, iss2, sg, sg2, sn, nc) = (issuer.clone(), issuer.clone(), signer.clone(), signer.clone(), seen.clone(), nonce.clone());
        let app = axum::Router::new()
            .route(
                "/.well-known/openid-configuration",
                get(move || {
                    let iss = iss.clone();
                    async move { axum::Json(json!({ "issuer": iss, "authorization_endpoint": format!("{iss}/authorize"), "token_endpoint": format!("{iss}/token"), "jwks_uri": format!("{iss}/jwks") })) }
                }),
            )
            .route("/jwks", get(move || { let k = sg.jwk(); async move { axum::Json(json!({ "keys": [k] })) } }))
            .route(
                "/token",
                post(move |headers: HeaderMap, body: String| {
                    let (iss, sg, sn, nc) = (iss2.clone(), sg2.clone(), sn.clone(), nc.clone());
                    async move {
                        let auth = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
                        *sn.lock().unwrap() = Some((auth, body));
                        let nonce = nc.lock().unwrap().clone();
                        let token = sg.token(json!({ "iss": iss, "aud": "basedb", "sub": " abc ", "nonce": nonce, "email": "Ada@Confiance.fr", "exp": Utc::now().timestamp() + 60, "name": "Ada" }));
                        axum::Json(json!({ "id_token": token, "access_token": "x" }))
                    }
                }),
            );
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let http = reqwest::Client::builder().no_proxy().build().unwrap();
        let key = "cle-de-test-ne-pas-utiliser-ailleurs-0123456789";
        let p = provider(&issuer);
        let (url, sealed) = start_exchange(&http, key, &p, "http://ici/auth/oidc/maison/callback", Some("/bases"), None).await.unwrap();
        assert!(url.starts_with(&format!("{issuer}/authorize?response_type=code&response_mode=query&client_id=basedb&redirect_uri=http%3A%2F%2Fici%2F")));
        assert!(url.contains("scope=openid+email+profile") && url.contains("code_challenge_method=S256"));
        let query: HashMap<String, String> = url::Url::parse(&url).unwrap().query_pairs().into_owned().collect();
        *nonce.lock().unwrap() = query["nonce"].clone();

        let wrong = complete_exchange(&http, key, &p, Some("code"), Some("autre"), Some(&sealed), now_ms()).await.unwrap_err();
        assert_eq!(wrong.code, "OIDC_STATE_INVALID");
        let asserted = complete_exchange(&http, key, &p, Some("le-code"), Some(&query["state"]), Some(&sealed), now_ms()).await.unwrap();
        assert_eq!(asserted, Asserted { subject: "abc".into(), email: "ada@confiance.fr".into(), display_name: "Ada".into(), return_to: "/bases".into(), link_session: None });
        let (auth, body) = seen.lock().unwrap().clone().unwrap();
        assert_eq!(auth, format!("Basic {}", basedb_base::time::b64(b"basedb:s3cret")));
        let form: HashMap<String, String> = form_urlencoded::parse(body.as_bytes()).into_owned().collect();
        assert_eq!(form["code"], "le-code");
        assert_eq!(b64url(&sha256(form["code_verifier"].as_bytes())), query["code_challenge"]);

        // Another provider's nonce, an unverified address outside the trusted domains: refused.
        *nonce.lock().unwrap() = "pas-le-bon".into();
        let e = complete_exchange(&http, key, &p, Some("c"), Some(&query["state"]), Some(&sealed), now_ms()).await.unwrap_err();
        assert_eq!(e.code, "OIDC_TOKEN_INVALID");
        *nonce.lock().unwrap() = query["nonce"].clone();
        let strict = OidcProvider { trusted_domains: vec![], ..p.clone() };
        let e = complete_exchange(&http, key, &strict, Some("c"), Some(&query["state"]), Some(&sealed), now_ms()).await.unwrap_err();
        assert_eq!(e.code, "OIDC_TOKEN_INVALID");
        let late = complete_exchange(&http, key, &p, Some("c"), Some(&query["state"]), Some(&sealed), now_ms() + EXCHANGE_TTL_MS).await.unwrap_err();
        assert_eq!(late.code, "OIDC_STATE_INVALID");
    }

    #[test]
    fn a_forged_signature_is_refused() {
        let signer = Signer::new();
        let other = Signer::new();
        let token = other.token(json!({ "sub": "x" }));
        let parts: Vec<&str> = token.split('.').collect();
        let sig = b64url_decode(parts[2]).unwrap();
        let message = format!("{}.{}", parts[0], parts[1]);
        assert!(signature_valid("ES256", &other.jwk(), message.as_bytes(), &sig));
        assert!(!signature_valid("ES256", &signer.jwk(), message.as_bytes(), &sig));
        assert!(!signature_valid("ES512", &other.jwk(), message.as_bytes(), &sig));
        assert!(!usable_for(&signer.jwk(), "RS256"));
    }
}
