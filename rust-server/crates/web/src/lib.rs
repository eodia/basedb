//! `basedb-web` — the interface without Node at run time. `apps/web` built as static files
//! (`pnpm --filter @basedb/web build:static`, `BASEDB_WEB_STATIC=1`): this crate serves them,
//! and does on each request what the server of Next did —
//!
//! - the base path: the build carries the marker `/__basedb_base_path__`, replaced in memory
//!   at start as `docker/image/start.mjs` replaced it on disk; pages are taken with the path
//!   or without, as the image's router took them;
//! - the layout's runtime script (`app/layout.tsx`): `window.__BASEDB_API__`, `__BASEDB_MCP__`,
//!   `__BASEDB_TILES__` and the reader's language with its messages (`window.__BASEDB_I18N__`),
//!   `<html lang>` and the translated description — written where the static shell left its
//!   markers (`lib/static-shell.ts`);
//! - `?lang=xx` (`src/proxy.ts`): the language remembered in a cookie, a 303 to the same page
//!   without the parameter;
//! - the frame rule of `/v/<jeton>` (`next.config.ts` `headers`);
//! - the dynamic routes: `/f/<jeton>`, `/v/<jeton>`, `/invitation/<jeton>` and every other path
//!   (`[...address]`) are served their route's shell, built once with `__shell__` for a token.
//!
//! The API wins: `/api`, `/auth`, `/healthz` and `/mcp` — with the base path or without, the
//! path taken off — go to the application router untouched, as do the other methods.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::extract::Request;
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode, Uri};
use axum::response::Response;
use axum::Router;
use basedb_contracts::{accepted_languages, is_locale, locale_of_tag, match_locale, SOURCE_LOCALE};
use bytes::Bytes;
use serde_json::{Map, Value};
use tower::ServiceExt;

/// What the build writes in place of the base path (`next.config.ts`).
pub const BASE_PATH_MARKER: &str = "/__basedb_base_path__";
/// The token a shell was built with (`lib/static-shell.ts`).
pub const SHELL_SEGMENT: &str = "__shell__";
/// The shell's `<html lang>`, filled with the reader's language.
pub const SHELL_LOCALE: &str = "__basedb_locale__";
/// The id of the shell's script, replaced with the runtime script.
pub const SHELL_RUNTIME: &str = "__basedb_runtime__";
/// The cookie of the chosen language (`lib/i18n.ts` `LOCALE_COOKIE`).
pub const LOCALE_COOKIE: &str = "basedb-locale";

/// The first segments of the API: never the interface's.
const API_PREFIXES: [&str; 4] = ["api", "auth", "healthz", "mcp"];
/// The routes with one token: a shell each.
const TOKEN_ROUTES: [&str; 3] = ["f", "v", "invitation"];
/// The files the marker is replaced in — `start.mjs` `placeInterface`.
const REWRITTEN: [&str; 8] = ["js", "json", "html", "rsc", "txt", "css", "meta", "body"];
/// The files `src/proxy.ts` let through: not pages, no `?lang`.
const NOT_PAGES: [&str; 3] = ["favicon.ico", "icon.svg", "apple-icon.png"];
const YEAR: i64 = 60 * 60 * 24 * 365;

/// What the layout handed the browser — read from the environment as `app/layout.tsx` read it.
#[derive(Clone, Debug, PartialEq)]
pub struct Runtime {
    pub api: String,
    pub mcp: String,
    pub tiles_url: String,
    pub tiles_attribution: String,
}

impl Runtime {
    /// `BASEDB_API`, `BASEDB_MCP`, `BASEDB_MAP_TILES`, `BASEDB_MAP_ATTRIBUTION` — an empty
    /// value counting as unset, as the layout's `||` does. The interface served here, the API
    /// and `/mcp` are at the same origin by default, under the base path (the old image's
    /// launcher did the same).
    pub fn from_settings(base_path: &str, setting: impl Fn(&str) -> Option<String>) -> Runtime {
        let get = |name: &str| setting(name).filter(|v| !v.trim().is_empty());
        Runtime {
            api: get("BASEDB_API").unwrap_or_else(|| format!("{base_path}/")),
            mcp: get("BASEDB_MCP").unwrap_or_else(|| format!("{base_path}/mcp")),
            tiles_url: get("BASEDB_MAP_TILES").unwrap_or_else(|| "https://tile.openstreetmap.org/{z}/{x}/{y}.png".into()),
            tiles_attribution: get("BASEDB_MAP_ATTRIBUTION")
                .unwrap_or_else(|| "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>".into()),
        }
    }

    /// The script's first statements: JSON, `<` escaped, so that no value closes the tag.
    fn script(&self) -> String {
        let tiles = serde_json::json!({ "url": self.tiles_url, "attribution": self.tiles_attribution });
        format!(
            "window.__BASEDB_API__={};window.__BASEDB_MCP__={};window.__BASEDB_TILES__={};",
            script_json(&Value::from(self.api.as_str())),
            script_json(&Value::from(self.mcp.as_str())),
            script_json(&tiles)
        )
    }
}

/// A shell page cut where the server writes: `{before}<html lang="…"{between}<meta…><script…>{after}`.
struct Page {
    before: String,
    between: String,
    after: String,
    /// The French description the shell carried, translated per request.
    description: String,
}

enum Content {
    Bytes(Bytes),
    Page(Page),
}

/// A language's messages, and their JSON as the script writes them.
struct Catalog {
    messages: Map<String, Value>,
    json: String,
}

/// The exported interface, in memory: a few megabytes, its marker replaced.
pub struct Site {
    dir: PathBuf,
    base: String,
    script: String,
    files: HashMap<String, Content>,
    catalogs: Mutex<HashMap<&'static str, Arc<Catalog>>>,
}

impl Site {
    /// The export in `dir` (`apps/web/out-static`), served under `base` (`""` or `/basedb`).
    pub fn load(dir: &Path, base: &str, runtime: &Runtime) -> Result<Site, String> {
        if !dir.join("index.html").is_file() {
            return Err(format!(
                "BASEDB_WEB_DIR : {} ne contient pas l'interface (index.html) — construisez-la avec `pnpm --filter @basedb/web build:static`.",
                dir.display()
            ));
        }
        let mut entries = Vec::new();
        walk(dir, dir, &mut entries).map_err(|e| format!("BASEDB_WEB_DIR : lecture de {} impossible : {e}", dir.display()))?;
        Ok(Site::from_entries(dir.to_path_buf(), base, runtime, entries))
    }

    fn from_entries(dir: PathBuf, base: &str, runtime: &Runtime, entries: Vec<(String, Vec<u8>)>) -> Site {
        let files = entries
            .into_iter()
            .filter(|(name, _)| name != "_basedb" && !name.starts_with("_basedb/"))
            .map(|(name, bytes)| {
                let content = if REWRITTEN.contains(&extension(&name)) {
                    match String::from_utf8(bytes) {
                        Ok(text) => {
                            let text = with_path(&text, base);
                            match (extension(&name) == "html").then(|| Page::parse(&text)).flatten() {
                                Some(page) => Content::Page(page),
                                None => Content::Bytes(Bytes::from(text)),
                            }
                        }
                        Err(e) => Content::Bytes(Bytes::from(e.into_bytes())),
                    }
                } else {
                    Content::Bytes(Bytes::from(bytes))
                };
                (name, content)
            })
            .collect();
        Site { dir, base: base.to_string(), script: runtime.script(), files, catalogs: Mutex::new(HashMap::new()) }
    }

    /// How many files are served.
    pub fn len(&self) -> usize {
        self.files.len()
    }

    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }

    /// A request: the API's to the application, the interface's here.
    pub async fn dispatch(&self, req: Request, app: Router) -> Response {
        let path = req.uri().path().to_string();
        let (rel, under_base) = self.relative(&path);
        if is_api(rel) || !matches!(*req.method(), Method::GET | Method::HEAD) {
            let req = if under_base { with_uri_path(req, rel) } else { req };
            return app.oneshot(req).await.unwrap_or_else(|never| match never {});
        }
        let rel = rel.to_string();
        let head = req.method() == Method::HEAD;
        let mut response = self.serve(&path, &rel, req.uri().query().unwrap_or(""), req.headers());
        if head {
            *response.body_mut() = Body::empty();
        }
        response
    }

    /// The path without the base path, and whether it had it.
    fn relative<'a>(&self, path: &'a str) -> (&'a str, bool) {
        if self.base.is_empty() {
            return (path, false);
        }
        match path.strip_prefix(self.base.as_str()) {
            Some("") => ("/", true),
            Some(rest) if rest.starts_with('/') => (rest, true),
            _ => (path, false),
        }
    }

    fn serve(&self, path: &str, rel: &str, query: &str, headers: &HeaderMap) -> Response {
        // Next's own rule: no trailing slash — `/basedb/` → `/basedb`.
        if path.len() > 1 && path.ends_with('/') {
            let bare = path.trim_end_matches('/');
            let to = if bare.is_empty() { "/" } else { bare };
            return redirect(StatusCode::PERMANENT_REDIRECT, &with_query(to, query));
        }
        let decoded = percent_decode(rel.trim_start_matches('/'));
        let segments: Vec<&str> = if decoded.is_empty() { Vec::new() } else { decoded.split('/').collect() };
        if segments.iter().any(|s| s.is_empty() || *s == "." || *s == ".." || s.contains('\\')) || decoded.starts_with("_basedb/") || decoded == "_basedb" {
            return self.not_found(headers);
        }
        let page = !decoded.starts_with("_next/") && !NOT_PAGES.contains(&decoded.as_str());
        if page {
            if let Some(response) = lang_redirect(path, query) {
                return response;
            }
        }
        let key = if segments.is_empty() {
            Some("index.html".to_string())
        } else if self.files.contains_key(decoded.as_str()) {
            Some(decoded.clone())
        } else if decoded.starts_with("_next/") {
            None
        } else {
            shell_of(&segments).filter(|k| self.files.contains_key(k.as_str()))
        };
        let Some(key) = key else { return self.not_found(headers) };
        let mut response = self.file(&key, StatusCode::OK, headers);
        if segments.len() == 2 && segments[0] == "v" && !embedded(query) {
            response.headers_mut().insert("content-security-policy", HeaderValue::from_static("frame-ancestors 'none'"));
        }
        response
    }

    fn not_found(&self, headers: &HeaderMap) -> Response {
        if self.files.contains_key("404.html") {
            return self.file("404.html", StatusCode::NOT_FOUND, headers);
        }
        let mut response = Response::new(Body::from("Not Found"));
        *response.status_mut() = StatusCode::NOT_FOUND;
        response
    }

    fn file(&self, key: &str, status: StatusCode, headers: &HeaderMap) -> Response {
        let body = match &self.files[key] {
            Content::Bytes(bytes) => Body::from(bytes.clone()),
            Content::Page(page) => Body::from(self.render(page, request_locale(headers))),
        };
        let mut response = Response::new(body);
        *response.status_mut() = status;
        let h = response.headers_mut();
        h.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type(key)));
        let cache = if key.starts_with("_next/static/") {
            "public, max-age=31536000, immutable"
        } else if matches!(extension(key), "html" | "txt") {
            "no-store"
        } else {
            "public, max-age=0"
        };
        h.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
        response
    }

    /// The shell, filled in for the reader — what the layout writes on Next's server.
    fn render(&self, page: &Page, locale: &'static str) -> String {
        let catalog = self.catalog(locale);
        let description = translate(&catalog.messages, &page.description);
        let mut out = String::with_capacity(page.before.len() + page.between.len() + page.after.len() + catalog.json.len() + self.script.len() + 256);
        out.push_str(&page.before);
        out.push_str("<html lang=\"");
        out.push_str(locale);
        out.push('"');
        out.push_str(&page.between);
        out.push_str("<meta name=\"description\" content=\"");
        out.push_str(&escape_html(&description));
        out.push_str("\"/><script>");
        out.push_str(&self.script);
        out.push_str("window.__BASEDB_I18N__={\"locale\":");
        out.push_str(&script_json(&Value::from(locale)));
        out.push_str(",\"messages\":");
        out.push_str(&catalog.json);
        out.push_str("}</script>");
        out.push_str(&page.after);
        out
    }

    /// A language's messages, read once: French is the source, its sentences the keys.
    fn catalog(&self, locale: &'static str) -> Arc<Catalog> {
        let mut catalogs = self.catalogs.lock().unwrap_or_else(|p| p.into_inner());
        catalogs
            .entry(locale)
            .or_insert_with(|| {
                let messages = if locale == SOURCE_LOCALE {
                    Map::new()
                } else {
                    let file = self.dir.join("_basedb").join("locales").join(format!("{locale}.json"));
                    match std::fs::read(&file).map_err(|e| e.to_string()).and_then(|b| serde_json::from_slice::<Map<String, Value>>(&b).map_err(|e| e.to_string())) {
                        Ok(messages) => messages,
                        Err(e) => {
                            eprintln!("basedb-web : messages {locale} illisibles ({}) : {e} — l'interface s'affiche en français.", file.display());
                            Map::new()
                        }
                    }
                };
                let json = script_json(&Value::Object(messages.clone()));
                Arc::new(Catalog { messages, json })
            })
            .clone()
    }
}

impl Page {
    /// The shell cut at its two markers; `None` for a page without them.
    fn parse(text: &str) -> Option<Page> {
        let lang = format!("<html lang=\"{SHELL_LOCALE}\"");
        let open = format!("<script id=\"{SHELL_RUNTIME}\" type=\"application/json\">");
        let at = text.find(&lang)?;
        let start = text[at..].find(&open)? + at;
        let end = text[start + open.len()..].find("</script>")? + start + open.len();
        let fill: Value = serde_json::from_str(&text[start + open.len()..end]).ok()?;
        Some(Page {
            before: text[..at].to_string(),
            between: text[at + lang.len()..start].to_string(),
            after: text[end + "</script>".len()..].to_string(),
            description: fill.get("description").and_then(Value::as_str).unwrap_or_default().to_string(),
        })
    }
}

/// Every request to `site`, the API's handed to `app` — the application router, built as before.
pub fn wrap(app: Router, site: Arc<Site>) -> Router {
    Router::new().fallback(move |req: Request| {
        let (app, site) = (app.clone(), site.clone());
        async move { site.dispatch(req, app).await }
    })
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<(String, Vec<u8>)>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            if dir == root && entry.file_name() == "_basedb" {
                continue;
            }
            walk(root, &path, out)?;
        } else {
            let name = path.strip_prefix(root).unwrap_or(&path).components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
            out.push((name, std::fs::read(&path)?));
        }
    }
    Ok(())
}

/// `withPath` of `start.mjs`: the marker, escaped (`\\/` in a string of a regular expression)
/// then plain, becomes the base path — with its slash, so that at the root it goes with it.
fn with_path(text: &str, base: &str) -> String {
    let mut out = text.to_string();
    for slash in ["\\\\/", "/"] {
        let marker = format!("{slash}{}", &BASE_PATH_MARKER[1..]);
        if out.contains(&marker) {
            out = out.replace(&marker, &base.split('/').collect::<Vec<_>>().join(slash));
        }
    }
    out
}

fn is_api(rel: &str) -> bool {
    let first = rel.trim_start_matches('/').split('/').next().unwrap_or("");
    API_PREFIXES.contains(&first)
}

/// The request with another path, its query kept: the API knows nothing of the base path.
fn with_uri_path(mut req: Request, path: &str) -> Request {
    let target = with_query(path, req.uri().query().unwrap_or(""));
    if let Ok(uri) = target.parse::<Uri>() {
        *req.uri_mut() = uri;
    }
    req
}

fn with_query(path: &str, query: &str) -> String {
    if query.is_empty() {
        path.to_string()
    } else {
        format!("{path}?{query}")
    }
}

/// The shell of a path that is no file: its token route's, else `[...address]`'s. The page,
/// its RSC payload (`.txt`) and its segments (`/__next.…`), which the client router asks for.
fn shell_of(segments: &[&str]) -> Option<String> {
    let last = segments.last()?;
    if segments.len() >= 2 && TOKEN_ROUTES.contains(&segments[0]) {
        let kind = segments[0];
        match segments.len() {
            2 if last.ends_with(".txt") => return Some(format!("{kind}/{SHELL_SEGMENT}.txt")),
            2 => return Some(format!("{kind}/{SHELL_SEGMENT}.html")),
            _ if segments[2].starts_with("__next.") => return Some(format!("{kind}/{SHELL_SEGMENT}/{}", segments[2..].join("/"))),
            _ => {}
        }
    }
    if let Some(i) = segments.iter().position(|s| s.starts_with("__next.")) {
        return Some(format!("{SHELL_SEGMENT}/{}", segments[i..].join("/")));
    }
    Some(if last.ends_with(".txt") { format!("{SHELL_SEGMENT}.txt") } else { format!("{SHELL_SEGMENT}.html") })
}

/// `?embed=1` — the last value, as Next's `missing` rule reads it.
fn embedded(query: &str) -> bool {
    form_urlencoded::parse(query.as_bytes()).filter(|(k, _)| k == "embed").last().is_some_and(|(_, v)| v == "1")
}

/// `src/proxy.ts`: `?lang=xx` remembered in the cookie when it names one of our languages, and
/// the same page again without it. The path is the one asked for, base path included.
fn lang_redirect(path: &str, query: &str) -> Option<Response> {
    let pairs: Vec<(String, String)> = form_urlencoded::parse(query.as_bytes()).into_owned().collect();
    let asked = pairs.iter().find(|(k, _)| k == "lang")?.1.clone();
    let rest = form_urlencoded::Serializer::new(String::new()).extend_pairs(pairs.iter().filter(|(k, _)| k != "lang")).finish();
    let mut response = redirect(StatusCode::SEE_OTHER, &with_query(path, &rest));
    if let Some(chosen) = locale_of_tag(&asked) {
        let expires = (chrono::Utc::now() + chrono::Duration::seconds(YEAR)).format("%a, %d %b %Y %H:%M:%S GMT");
        let cookie = format!("{LOCALE_COOKIE}={chosen}; Path=/; Expires={expires}; Max-Age={YEAR}; SameSite=lax");
        if let Ok(value) = HeaderValue::from_str(&cookie) {
            response.headers_mut().insert(header::SET_COOKIE, value);
        }
    }
    Some(response)
}

/// A redirect within this origin — never `//elsewhere`.
fn redirect(status: StatusCode, to: &str) -> Response {
    let to = format!("/{}", to.trim_start_matches(['/', '\\']));
    let mut response = Response::new(Body::empty());
    *response.status_mut() = status;
    if let Ok(value) = HeaderValue::from_str(&to) {
        response.headers_mut().insert(header::LOCATION, value);
    }
    response
}

/// `requestLocale` of `lib/i18n-server.ts`: the chosen language, else the browser's.
fn request_locale(headers: &HeaderMap) -> &'static str {
    let chosen = headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| name.trim() == LOCALE_COOKIE)
        .map(|(_, value)| percent_decode(value.trim()));
    if let Some(chosen) = chosen.filter(|c| is_locale(c)) {
        if let Some(locale) = basedb_contracts::LOCALES.iter().find(|l| **l == chosen) {
            return locale;
        }
    }
    match_locale(&accepted_languages(headers.get(header::ACCEPT_LANGUAGE).and_then(|v| v.to_str().ok())))
}

/// `translate` of `lib/i18n-server.ts`.
fn translate(messages: &Map<String, Value>, french: &str) -> String {
    match messages.get(french) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Object(o)) => o.get("other").and_then(Value::as_str).unwrap_or(french).to_string(),
        _ => french.to_string(),
    }
}

/// JSON for a `<script>`: `<` escaped, so that no value — `</script>` typed as a label — closes it.
fn script_json(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_default().replace('<', "\\u003c")
}

fn escape_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#x27;"),
            c => out.push(c),
        }
    }
    out
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let hex = |b: u8| (b as char).to_digit(16);
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn extension(name: &str) -> &str {
    let file = name.rsplit('/').next().unwrap_or(name);
    file.rsplit_once('.').map(|(_, e)| e).unwrap_or("")
}

fn content_type(name: &str) -> &'static str {
    match extension(name) {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        // The RSC payloads: Next's client reads `text/plain` as one in a static export.
        "txt" => "text/plain; charset=utf-8",
        "md" => "text/markdown; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "wasm" => "application/wasm",
        "webmanifest" => "application/manifest+json",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::routing::get;

    const SHELL: &str = concat!(
        "<!DOCTYPE html><html lang=\"__basedb_locale__\"><head><meta charSet=\"utf-8\"/>",
        "<script src=\"/__basedb_base_path__/_next/static/chunks/a.js\" async=\"\"></script><title>basedb</title>",
        "<script id=\"__basedb_runtime__\" type=\"application/json\">{\"description\":\"Des tables PostgreSQL que l’on peut lire en SQL\"}</script>",
        "</head><body><script>self.__next_f.push([1,\"4:\\\"/__basedb_base_path__/_next/static/chunks/a.js\\\"\"])</script></body></html>"
    );

    fn runtime() -> Runtime {
        Runtime::from_settings("", |k| match k {
            "BASEDB_API" => Some("/basedb/".into()),
            "BASEDB_MAP_ATTRIBUTION" => Some("</script><b>x</b>".into()),
            _ => None,
        })
    }

    fn site(base: &str) -> Site {
        let page = |marker: &str| SHELL.replace("<title>", &format!("<title>{marker}"));
        let entries = vec![
            ("index.html".to_string(), page("index").into_bytes()),
            ("__shell__.html".to_string(), page("address").into_bytes()),
            ("__shell__.txt".to_string(), b"address-rsc".to_vec()),
            ("__shell__/__next._tree.txt".to_string(), b"address-tree".to_vec()),
            ("__shell__/__next.$c$address/__PAGE__.txt".to_string(), b"address-page".to_vec()),
            ("v/__shell__.html".to_string(), page("view").into_bytes()),
            ("v/__shell__.txt".to_string(), b"view-rsc".to_vec()),
            ("v/__shell__/__next.v/$d$token/__PAGE__.txt".to_string(), b"view-page".to_vec()),
            ("f/__shell__.html".to_string(), page("form").into_bytes()),
            ("invitation/__shell__.html".to_string(), page("invitation").into_bytes()),
            ("404.html".to_string(), page("missing").into_bytes()),
            ("_next/static/chunks/a.js".to_string(), b"var r=\"\\\\/__basedb_base_path__\\\\/x\";fetch(\"/__basedb_base_path__/y\")".to_vec()),
            ("favicon.ico".to_string(), vec![0, 1, 2]),
            ("geo/world.json".to_string(), b"{}".to_vec()),
        ];
        let s = Site::from_entries(PathBuf::from("."), base, &runtime(), entries);
        let en: Map<String, Value> = serde_json::from_str(r#"{"Des tables PostgreSQL que l’on peut lire en SQL":"PostgreSQL tables <you> can read in SQL","{count} ligne":{"one":"{count} row","other":"{count} rows"}}"#).unwrap();
        let json = script_json(&Value::Object(en.clone()));
        s.catalogs.lock().unwrap().insert("en", Arc::new(Catalog { messages: en, json }));
        s
    }

    fn app(base: &str) -> Router {
        let api = Router::new()
            .route("/api/v1/thing", get(|req: Request| async move { format!("api {}", req.uri()) }))
            .route("/healthz", get(|| async { "ok" }))
            .fallback(|req: Request| async move { (StatusCode::IM_A_TEAPOT, format!("fallback {} {}", req.method(), req.uri())) });
        wrap(api, Arc::new(site(base)))
    }

    async fn call(router: &Router, method: Method, uri: &str, headers: &[(&str, &str)]) -> (StatusCode, HeaderMap, String) {
        let mut req = Request::builder().method(method).uri(uri);
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        let res = router.clone().oneshot(req.body(Body::empty()).unwrap()).await.unwrap();
        let status = res.status();
        let headers = res.headers().clone();
        let body = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        (status, headers, String::from_utf8_lossy(&body).into_owned())
    }

    async fn get_(router: &Router, uri: &str) -> (StatusCode, HeaderMap, String) {
        call(router, Method::GET, uri, &[]).await
    }

    #[tokio::test]
    async fn the_api_wins() {
        let r = app("");
        assert_eq!(get_(&r, "/api/v1/thing?x=1").await.2, "api /api/v1/thing?x=1");
        assert_eq!(get_(&r, "/healthz").await.2, "ok");
        // An API path the application does not serve: its own fallback (the 404), not a shell.
        let (status, _, body) = get_(&r, "/auth/me").await;
        assert_eq!((status, body.as_str()), (StatusCode::IM_A_TEAPOT, "fallback GET /auth/me"));
        assert_eq!(get_(&r, "/mcp").await.0, StatusCode::IM_A_TEAPOT);
        // Other methods are never the interface's.
        assert_eq!(call(&r, Method::POST, "/bases/x", &[]).await.2, "fallback POST /bases/x");
        // A path that only starts like one is a page.
        assert!(get_(&r, "/apis").await.2.contains("<title>address"));
    }

    #[tokio::test]
    async fn the_api_under_the_base_path_loses_it() {
        let r = app("/basedb");
        assert_eq!(get_(&r, "/basedb/api/v1/thing?x=1").await.2, "api /api/v1/thing?x=1");
        assert_eq!(get_(&r, "/api/v1/thing").await.2, "api /api/v1/thing");
        assert_eq!(get_(&r, "/basedb/healthz").await.2, "ok");
    }

    #[tokio::test]
    async fn each_route_has_its_shell() {
        let r = app("");
        assert!(get_(&r, "/").await.2.contains("<title>index"));
        assert!(get_(&r, "/bases/demo/tables/clients").await.2.contains("<title>address"));
        assert!(get_(&r, "/v/abc").await.2.contains("<title>view"));
        assert!(get_(&r, "/f/abc").await.2.contains("<title>form"));
        assert!(get_(&r, "/invitation/abc%2Bdef").await.2.contains("<title>invitation"));
        // Two tokens deep is no view: `[...address]`'s.
        assert!(get_(&r, "/v/abc/def").await.2.contains("<title>address"));
        assert!(get_(&r, "/v").await.2.contains("<title>address"));
        // The client router's payloads, for a token or an address it was not built with.
        assert_eq!(get_(&r, "/bases/demo.txt?_rsc=1").await.2, "address-rsc");
        assert_eq!(get_(&r, "/bases/demo/__next._tree.txt").await.2, "address-tree");
        assert_eq!(get_(&r, "/bases/demo/__next.%24c%24address/__PAGE__.txt").await.2, "address-page");
        assert_eq!(get_(&r, "/v/abc.txt").await.2, "view-rsc");
        assert_eq!(get_(&r, "/v/abc/__next.v/$d$token/__PAGE__.txt").await.2, "view-page");
    }

    #[tokio::test]
    async fn files_and_their_headers() {
        let r = app("");
        let (status, h, body) = get_(&r, "/_next/static/chunks/a.js").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(h["cache-control"], "public, max-age=31536000, immutable");
        assert_eq!(h["content-type"], "application/javascript; charset=utf-8");
        assert_eq!(body, "var r=\"\\\\/x\";fetch(\"/y\")");
        let (_, h, _) = get_(&r, "/bases/x").await;
        assert_eq!((h["cache-control"].to_str().unwrap(), h["content-type"].to_str().unwrap()), ("no-store", "text/html; charset=utf-8"));
        assert_eq!(get_(&r, "/favicon.ico").await.1["content-type"], "image/x-icon");
        assert_eq!(get_(&r, "/geo/world.json").await.1["cache-control"], "public, max-age=0");
        let (status, h, body) = call(&r, Method::HEAD, "/bases/x", &[]).await;
        assert_eq!((status, h["content-type"].to_str().unwrap(), body.as_str()), (StatusCode::OK, "text/html; charset=utf-8", ""));
    }

    #[tokio::test]
    async fn missing_files_are_404() {
        let r = app("");
        for uri in ["/_next/static/chunks/nope.js", "/_basedb/locales/en.json", "/a/../b"] {
            let (status, h, body) = get_(&r, uri).await;
            assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
            assert_eq!(h["cache-control"], "no-store");
            assert!(body.contains("<title>missing"), "{uri}");
        }
    }

    #[tokio::test]
    async fn the_base_path_is_written_and_taken_both_ways() {
        let r = app("/basedb");
        let (_, _, body) = get_(&r, "/basedb/_next/static/chunks/a.js").await;
        assert_eq!(body, "var r=\"\\\\/basedb\\\\/x\";fetch(\"/basedb/y\")");
        let page = get_(&r, "/basedb").await.2;
        assert!(page.contains("<title>index") && page.contains("src=\"/basedb/_next/static/chunks/a.js\""));
        assert!(page.contains("4:\\\"/basedb/_next/static/chunks/a.js\\\""));
        assert!(get_(&r, "/bases/x").await.2.contains("<title>address"));
        assert!(get_(&r, "/basedb/v/x").await.2.contains("<title>view"));
        let (status, h, _) = get_(&r, "/basedb/?a=1").await;
        assert_eq!((status, h["location"].to_str().unwrap()), (StatusCode::PERMANENT_REDIRECT, "/basedb?a=1"));
        assert_eq!(get_(&r, "/basedb/bases/x/").await.1["location"], "/basedb/bases/x");
    }

    #[tokio::test]
    async fn the_page_is_filled_for_its_reader() {
        let r = app("");
        let page = call(&r, Method::GET, "/", &[("accept-language", "en-GB,fr;q=0.5")]).await.2;
        assert!(page.starts_with("<!DOCTYPE html><html lang=\"en\"><head>"), "{page}");
        assert!(!page.contains(SHELL_RUNTIME) && !page.contains(SHELL_LOCALE));
        assert!(page.contains("basedb</title><meta name=\"description\" content=\"PostgreSQL tables &lt;you&gt; can read in SQL\"/><script>window.__BASEDB_API__=\"/basedb/\";window.__BASEDB_MCP__=\"/mcp\";"));
        assert!(page.contains("window.__BASEDB_TILES__={\"url\":\"https://tile.openstreetmap.org/{z}/{x}/{y}.png\",\"attribution\":\"\\u003c/script>\\u003cb>x\\u003c/b>\"};"));
        assert!(page.contains("window.__BASEDB_I18N__={\"locale\":\"en\",\"messages\":{\"Des tables PostgreSQL que l’on peut lire en SQL\":\"PostgreSQL tables \\u003cyou> can read in SQL\","));
        assert!(page.contains("}}</script></head><body>"));
        // The cookie wins over the browser; French is the source, its messages none.
        let page = call(&r, Method::GET, "/bases/x", &[("accept-language", "en"), ("cookie", "a=b; basedb-locale=fr")]).await.2;
        assert!(page.contains("<html lang=\"fr\"") && page.contains("content=\"Des tables PostgreSQL que l’on peut lire en SQL\""));
        assert!(page.contains("window.__BASEDB_I18N__={\"locale\":\"fr\",\"messages\":{}}</script>"));
        // A cookie that names none of ours is ignored; a browser that speaks none reads English.
        let page = call(&r, Method::GET, "/", &[("accept-language", "xx"), ("cookie", "basedb-locale=klingon")]).await.2;
        assert!(page.contains("<html lang=\"en\""));
    }

    #[tokio::test]
    async fn lang_is_remembered_and_taken_off() {
        let r = app("/basedb");
        let (status, h, _) = get_(&r, "/basedb/bases/x?a=1&lang=de-AT&b=c+d").await;
        assert_eq!(status, StatusCode::SEE_OTHER);
        assert_eq!(h["location"], "/basedb/bases/x?a=1&b=c+d");
        let cookie = h["set-cookie"].to_str().unwrap();
        assert!(cookie.starts_with("basedb-locale=de; Path=/; Expires=") && cookie.ends_with(" GMT; Max-Age=31536000; SameSite=lax"), "{cookie}");
        // A tag we do not speak: the parameter still goes, no cookie.
        let (status, h, _) = get_(&r, "/?lang=xx").await;
        assert_eq!((status, h["location"].to_str().unwrap(), h.get("set-cookie")), (StatusCode::SEE_OTHER, "/", None));
        // Never elsewhere; never on the scripts.
        assert_eq!(get_(&r, "//evil.example/?lang=en").await.1["location"], "/evil.example?lang=en");
        assert!(get_(&r, "//evil.example/x?lang=en").await.1.get("location").is_none_or(|l| !l.to_str().unwrap().starts_with("//")));
        assert_eq!(get_(&r, "/basedb/_next/static/chunks/a.js?lang=en").await.0, StatusCode::OK);
        assert_eq!(get_(&r, "/favicon.ico?lang=en").await.0, StatusCode::OK);
    }

    #[tokio::test]
    async fn a_view_is_framed_only_embedded() {
        let r = app("");
        let csp = |h: &HeaderMap| h.get("content-security-policy").map(|v| v.to_str().unwrap().to_string());
        assert_eq!(csp(&get_(&r, "/v/abc").await.1).as_deref(), Some("frame-ancestors 'none'"));
        assert_eq!(csp(&get_(&r, "/v/abc?embed=1").await.1), None);
        assert_eq!(csp(&get_(&r, "/v/abc?embed=0").await.1).as_deref(), Some("frame-ancestors 'none'"));
        assert_eq!(csp(&get_(&r, "/v/abc?embed=1&embed=2").await.1).as_deref(), Some("frame-ancestors 'none'"));
        assert_eq!(csp(&get_(&r, "/f/abc").await.1), None);
        assert_eq!(csp(&get_(&r, "/v/abc/def").await.1), None);
    }

    #[test]
    fn runtime_defaults_follow_the_layout() {
        let r = Runtime::from_settings("/basedb", |k| (k == "BASEDB_MCP").then(|| " ".to_string()));
        assert_eq!((r.api.as_str(), r.mcp.as_str()), ("/basedb/", "/basedb/mcp"));
        let r = Runtime::from_settings("", |k| (k == "BASEDB_API").then(|| "https://api.example/".to_string()));
        assert_eq!((r.api.as_str(), r.mcp.as_str()), ("https://api.example/", "/mcp"));
        assert_eq!(r.tiles_attribution, "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>");
    }

    #[test]
    fn translation_takes_plurals_other() {
        let m: Map<String, Value> = serde_json::from_str(r#"{"a":"A","b":{"one":"B1","other":"Bn"}}"#).unwrap();
        assert_eq!((translate(&m, "a"), translate(&m, "b"), translate(&m, "c")), ("A".into(), "Bn".into(), "c".into()));
        assert_eq!(percent_decode("%24c%24address%2"), "$c$address%2");
    }
}
