//! The catalog of base templates — `packages/core/src/templates/catalog.ts` (chapter 20 §3).
//!
//! Three sources, one format: the instance's (`_basedb.template`), the public site's
//! (`BASEDB_TEMPLATES_URL`) and the carried ones (`packages/templates/catalog`). Under one key
//! the instance's wins over the site's, which wins over the carried one. The official ones
//! are served in the reader's language, through the site's dictionaries, else the carried.

use crate::js::js_order;
use crate::targets::{check_target, TargetPolicy};
use crate::template_check::{check_template, summarize_template};
use crate::template_i18n::{localize_template, Dictionary};
use basedb_base::config::Config;
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::loader::load_grants;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_contracts::locales::{is_locale, SOURCE_LOCALE};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

type R<T> = Result<T, AppError>;

/// The public site's catalog, read when `BASEDB_TEMPLATES_URL` says nothing.
pub const DEFAULT_TEMPLATES_URL: &str = "https://eodia.github.io/basedb/modeles/catalogue.json";

const TTL_MS: u64 = 60 * 60_000;
const RETRY_MS: u64 = 5 * 60_000;
const TIMEOUT: Duration = Duration::from_millis(5000);
const MAX_BYTES: usize = 2 * 1024 * 1024;

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// `CatalogConfig`: where the site publishes (`None`: `off`), and where it may be reached.
pub struct CatalogConfig {
    pub url: Option<String>,
    pub targets: TargetPolicy,
}

impl CatalogConfig {
    pub fn from_config(cfg: &Config) -> Self {
        let url = match cfg.setting("BASEDB_TEMPLATES_URL") {
            None => Some(DEFAULT_TEMPLATES_URL.to_string()),
            Some(u) if u == "off" => None,
            Some(u) => Some(u),
        };
        CatalogConfig { url, targets: TargetPolicy::from_config(cfg) }
    }
}

// ── The carried templates ──────────────────────────────────────────────────────────────

/// Where `packages/templates` is: `BASEDB_TEMPLATES_DIR`, else beside the repository root.
fn templates_dir(cfg: &Config) -> PathBuf {
    if let Some(dir) = cfg.setting("BASEDB_TEMPLATES_DIR") {
        return PathBuf::from(dir);
    }
    let root = cfg.root.clone().unwrap_or_else(|| PathBuf::from("."));
    root.join("packages").join("templates")
}

fn read_json(path: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&text).ok().map(js_order)
}

static CARRIED: OnceLock<Vec<Value>> = OnceLock::new();

/// `bundled()`: every file of `catalog/`, in the order of their names, checked.
fn bundled(cfg: &Config) -> &'static [Value] {
    CARRIED.get_or_init(|| {
        let dir = templates_dir(cfg).join("catalog");
        let mut files: Vec<String> = std::fs::read_dir(&dir)
            .map(|d| d.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().into_owned()).filter(|f| f.ends_with(".json")).collect())
            .unwrap_or_default();
        files.sort();
        files.iter().filter_map(|f| check_template(&read_json(&dir.join(f)).unwrap_or(Value::Null)).ok()).collect()
    })
}

type Dictionaries = Map<String, Value>;

static CARRIED_WORDS: LazyLock<Mutex<HashMap<String, Dictionaries>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// `bundledDictionaries`: one language's, by template key; a file that does not parse is left out.
fn carried_dictionaries(cfg: &Config, locale: &str) -> Dictionaries {
    if let Some(found) = CARRIED_WORDS.lock().unwrap().get(locale) {
        return found.clone();
    }
    let mut out = Map::new();
    let well_formed = (2..=10).contains(&locale.len()) && locale.chars().all(|c| c.is_ascii_alphabetic() || c == '-');
    let dir = templates_dir(cfg).join("i18n").join(locale);
    if well_formed && dir.exists() {
        let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)
            .map(|d| d.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "json")).collect())
            .unwrap_or_default();
        files.sort();
        for file in files {
            if let (Some(stem), Some(v)) = (file.file_stem(), read_json(&file)) {
                out.insert(stem.to_string_lossy().into_owned(), v);
            }
        }
    }
    CARRIED_WORDS.lock().unwrap().insert(locale.to_string(), out.clone());
    out
}

// ── The site's ─────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct SiteState {
    url: String,
    templates: Vec<Value>,
    fetched_at: Option<u64>,
    next_at: u64,
    error: Option<String>,
}

static SITE: LazyLock<tokio::sync::Mutex<Option<SiteState>>> = LazyLock::new(|| tokio::sync::Mutex::new(None));

/// `readSite`: the site's catalog, read again once its hour is up — one reader at a time.
async fn read_site(config: &CatalogConfig) -> Option<SiteState> {
    let url = config.url.clone()?;
    let mut site = SITE.lock().await;
    if site.as_ref().is_none_or(|s| s.url != url) {
        *site = Some(SiteState { url: url.clone(), templates: vec![], fetched_at: None, next_at: 0, error: None });
    }
    let current = site.clone().unwrap();
    if now_ms() >= current.next_at {
        *site = Some(match fetch_catalog_list(&url, &config.targets).await {
            Ok(templates) => SiteState { url, templates, fetched_at: Some(now_ms()), next_at: now_ms() + TTL_MS, error: None },
            Err(error) => SiteState { next_at: now_ms() + RETRY_MS, error: Some(error), ..current },
        });
    }
    site.clone()
}

async fn fetch_catalog_list(url: &str, targets: &TargetPolicy) -> Result<Vec<Value>, String> {
    let text = fetch_catalog(url, targets).await?;
    let body: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let list = match body {
        Value::Array(list) => list,
        Value::Object(mut o) => match o.shift_remove("templates") {
            Some(Value::Array(list)) => list,
            _ => return Err("catalogue_illisible".into()),
        },
        _ => return Err("catalogue_illisible".into()),
    };
    Ok(list.into_iter().filter_map(|raw| check_template(&js_order(raw)).ok()).collect())
}

/// `fetchCatalog`: the address checked, no redirect followed, 5 s, 2 MiB at most.
async fn fetch_catalog(url: &str, targets: &TargetPolicy) -> Result<String, String> {
    let checked = check_target(url, targets).await.map_err(|_| "adresse_refusee".to_string())?;
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(TIMEOUT)
        .build()
        .map_err(|_| "injoignable".to_string())?;
    let mut response = client
        .get(checked)
        .header("accept", "application/json")
        .header("user-agent", "basedb-templates/1")
        .send()
        .await
        .map_err(|_| "injoignable".to_string())?;
    if !response.status().is_success() {
        return Err(format!("http_{}", response.status().as_u16()));
    }
    let mut body = Vec::new();
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                body.extend_from_slice(&chunk);
                if body.len() > MAX_BYTES {
                    return Err("trop_volumineux".into());
                }
            }
            Ok(None) => break,
            // Node's reader throws the stream's error as it is: `terminated`, most often.
            Err(_) => return Err("terminated".into()),
        }
    }
    Ok(String::from_utf8_lossy(&body).into_owned())
}

struct SiteWords {
    dictionaries: Dictionaries,
    next_at: u64,
}

static SITE_WORDS: LazyLock<tokio::sync::Mutex<HashMap<String, SiteWords>>> = LazyLock::new(|| tokio::sync::Mutex::new(HashMap::new()));

/// `dictionariesUrl`: beside the catalog, `…/i18n/<langue>.json`.
fn dictionaries_url(catalog_url: &str, locale: &str) -> Option<String> {
    let name = "catalogue.json";
    catalog_url.ends_with(&format!("/{name}")).then(|| format!("{}i18n/{locale}.json", &catalog_url[..catalog_url.len() - name.len()]))
}

async fn read_site_words(config: &CatalogConfig, locale: &str) -> Dictionaries {
    let Some(url) = config.url.as_deref().and_then(|u| dictionaries_url(u, locale)) else {
        return Map::new();
    };
    let mut words = SITE_WORDS.lock().await;
    let fresh = words.get(&url).is_some_and(|s| now_ms() < s.next_at);
    if !fresh {
        let previous = words.get(&url).map(|s| s.dictionaries.clone()).unwrap_or_default();
        let read = async {
            let text = fetch_catalog(&url, &config.targets).await.ok()?;
            match serde_json::from_str::<Value>(&text).ok()? {
                Value::Object(mut o) => match o.shift_remove("templates") {
                    Some(Value::Object(t)) => Some(t.into_iter().filter(|(_, d)| d.is_object()).map(|(k, d)| (k, js_order(d))).collect::<Map<_, _>>()),
                    _ => None,
                },
                _ => None,
            }
        };
        let state = match read.await {
            Some(dictionaries) => SiteWords { dictionaries, next_at: now_ms() + TTL_MS },
            None => SiteWords { dictionaries: previous, next_at: now_ms() + RETRY_MS },
        };
        words.insert(url.clone(), state);
    }
    words.get(&url).map(|s| s.dictionaries.clone()).unwrap_or_default()
}

/// `localized`: an official template in the reader's language — the French one when the
/// dictionary breaks it.
fn localized(template: &Value, locale: &str, dictionary: Option<&Value>) -> Value {
    let Some(Value::Object(dictionary)) = dictionary else {
        return template.clone();
    };
    let dictionary: &Dictionary = dictionary;
    localize_template(template, dictionary, locale != "fr").unwrap_or_else(|| template.clone())
}

// ── The instance's ─────────────────────────────────────────────────────────────────────

async fn instance_templates(pools: &Pools, ctx: &RequestContext) -> R<Vec<Value>> {
    let rows = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        tx.rows(
            "SELECT t.body
               FROM _basedb.template t
               JOIN _basedb.tenant n ON n.id = t.tenant_id
              WHERE n.ref = $1
              ORDER BY t.label",
            &[&ctx.tenant_id],
        )
        .await
    })
    .await?;
    Ok(rows.iter().filter_map(|r| check_template(&js_order(r.get::<_, Value>(0))).ok()).collect())
}

/// `TemplateSource`, and the entry it qualifies.
pub struct CatalogEntry {
    pub template: Value,
    pub source: &'static str,
}

struct Entries {
    entries: Vec<CatalogEntry>,
    site: Option<SiteState>,
}

async fn entries(pools: &Pools, ctx: &RequestContext, cfg: &Config, locale: Option<&str>) -> R<Entries> {
    let config = CatalogConfig::from_config(cfg);
    let language = locale.filter(|l| is_locale(l) && *l != SOURCE_LOCALE);
    let own = instance_templates(pools, ctx).await?;
    let read = read_site(&config).await;
    let words = match language {
        Some(l) => read_site_words(&config, l).await,
        None => Map::new(),
    };
    let carried_ones = language.map(|l| carried_dictionaries(cfg, l)).unwrap_or_default();
    let official = |t: &Value| -> Value {
        match language {
            None => t.clone(),
            Some(l) => {
                let key = t["key"].as_str().unwrap_or_default();
                let dictionary = words.get(key).filter(|d| !d.is_null()).or_else(|| carried_ones.get(key));
                localized(t, l, dictionary)
            }
        }
    };
    let mut out = Vec::new();
    let mut taken = HashSet::new();
    let mut add = |templates: Vec<Value>, source: &'static str| {
        for template in templates {
            let key = template["key"].as_str().unwrap_or_default().to_string();
            if taken.insert(key) {
                out.push(CatalogEntry { template, source });
            }
        }
    };
    add(own, "instance");
    // Localized only when not shadowed: the result is the same, and it is cheaper.
    let site_templates: Vec<Value> = read.as_ref().map(|s| s.templates.iter().map(&official).collect()).unwrap_or_default();
    add(site_templates, "site");
    add(bundled(cfg).iter().map(&official).collect(), "bundled");
    Ok(Entries { entries: out, site: read })
}

fn iso(ms: u64) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms as i64).map(|d| d.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()).unwrap_or_default()
}

fn with_source(template: &Value, source: &str) -> Value {
    let mut summary = summarize_template(template);
    summary.insert("source".into(), json!(source));
    Value::Object(summary)
}

/// `listTemplates`: `{data, meta: {site}}` of the gallery.
pub async fn list_templates(pools: &Pools, ctx: &RequestContext, cfg: &Config, locale: Option<&str>) -> R<Value> {
    let found = entries(pools, ctx, cfg, locale).await?;
    let data: Vec<Value> = found.entries.iter().map(|e| with_source(&e.template, e.source)).collect();
    let site = match found.site {
        None => Value::Null,
        Some(s) => json!({ "url": s.url, "fetched_at": s.fetched_at.map(iso), "error": s.error }),
    };
    Ok(json!({ "data": data, "meta": { "site": site } }))
}

/// `getTemplate`.
pub async fn get_template(pools: &Pools, ctx: &RequestContext, cfg: &Config, key: &str, locale: Option<&str>) -> R<CatalogEntry> {
    entries(pools, ctx, cfg, locale)
        .await?
        .entries
        .into_iter()
        .find(|e| e.template["key"] == key)
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("template", json!(key)))
}

async fn require_instance_admin(pools: &Pools, ctx: &RequestContext) -> R<()> {
    let grants = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move { load_grants(&tx, ctx).await }).await?;
    if !grants.is_instance_admin {
        return Err(AppError::new("ADMIN_REQUIRED").with("action", json!("templates")));
    }
    Ok(())
}

/// `invalidTemplate`: `TEMPLATE_INVALID` with the first 50 issues.
pub fn invalid_template(issues: Vec<Value>) -> AppError {
    AppError::new("TEMPLATE_INVALID").with("issues", Value::Array(issues.into_iter().take(50).collect()))
}

/// `importTemplate`: into the instance, or over the one of the same key.
pub async fn import_template(pools: &Pools, ctx: &RequestContext, raw: &Value) -> R<Value> {
    require_instance_admin(pools, ctx).await?;
    let template = check_template(&js_order(raw.clone())).map_err(invalid_template)?;
    let t = &template;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let tenant = tx
            .first("SELECT id::text FROM _basedb.tenant WHERE ref = $1 AND deleted_at IS NULL", &[&ctx.tenant_id])
            .await?
            .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("tenant", json!(ctx.tenant_id)))?;
        let tenant_id: String = tenant.get(0);
        let key = t["key"].as_str().unwrap_or_default();
        let label = t["label"].as_str().unwrap_or_default();
        let body = serde_json::to_string(t).unwrap_or_default();
        tx.execute_op(
            "INSERT INTO _basedb.template (tenant_id, key, label, body, created_by, updated_by)
             VALUES ($1::text::uuid, $2, $3, $4::text::jsonb, $5::text::uuid, $5::text::uuid)
             ON CONFLICT (tenant_id, key) DO UPDATE
               SET label = EXCLUDED.label, body = EXCLUDED.body,
                   updated_at = clock_timestamp(), updated_by = EXCLUDED.updated_by",
            &[&tenant_id, &key, &label, &body, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
        Ok(())
    })
    .await?;
    Ok(with_source(&template, "instance"))
}

/// `deleteTemplate`.
pub async fn delete_template(pools: &Pools, ctx: &RequestContext, key: &str) -> R<()> {
    require_instance_admin(pools, ctx).await?;
    let removed = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        tx.query_op(
            "DELETE FROM _basedb.template t
               USING _basedb.tenant n
              WHERE n.id = t.tenant_id AND n.ref = $1 AND t.key = $2
              RETURNING t.id",
            &[&ctx.tenant_id, &key],
            SqlOp::Delete,
        )
        .await
    })
    .await?;
    if removed.is_empty() {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("template", json!(key)));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dictionaries_sit_beside_the_catalog() {
        assert_eq!(dictionaries_url("https://x.fr/modeles/catalogue.json", "en").as_deref(), Some("https://x.fr/modeles/i18n/en.json"));
        assert_eq!(dictionaries_url("https://x.fr/modeles/mine.json", "en"), None);
        assert_eq!(iso(0), "1970-01-01T00:00:00.000Z");
    }
}
