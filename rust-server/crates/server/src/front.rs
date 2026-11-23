//! What the router of the image (Caddy) did in front of the Node processes, now that
//! basedb-server answers alone on its port:
//!
//! - the visitor's address — `trusted_proxies static private_ranges`: a proxy of the private
//!   network (or this machine) keeps the `X-Forwarded-For` it sends, its own address added;
//!   anyone else's is replaced by its address. The rate limits count per visitor;
//! - compression — `encode gzip`: a response held whole (pages, scripts, JSON) is sent
//!   gzipped to a browser that takes it; a streamed one (events, exports) as it comes;
//! - insights under `/insights` (`BASEDB_INSIGHTS=1`), on this origin — its session cookie is
//!   first-party in basedb's frame. Under basedb's path too, taken with it or without:
//!
//!   ```text
//!   /insights/api/*  → its server, prefix taken off   BASEDB_INSIGHTS_HOST:4200
//!   /insights/mcp    → its server, prefix taken off   (Trino asks it directly, OPA)
//!   /insights/*      → its interface (its basePath)   BASEDB_INSIGHTS_HOST:3100
//!   ```

use std::io::Write;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{ConnectInfo, Request};
use axum::http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode};
use axum::response::Response;
use axum::Router;
use basedb_base::config::{insights_on, Config, INSIGHTS_DEFAULT_HOST, INSIGHTS_SERVER_PORT, INSIGHTS_WEB_PORT};
use http_body_util::BodyExt;
use tower::ServiceExt;

/// A proxy of the private network, or this machine: what it says of the visitor is kept.
pub fn trusted(ip: IpAddr) -> bool {
    match ip.to_canonical() {
        IpAddr::V4(v4) => v4.is_private() || v4.is_loopback(),
        IpAddr::V6(v6) => v6.is_loopback() || (v6.segments()[0] & 0xff00) == 0xfd00,
    }
}

/// `X-Forwarded-For`, `-Proto` and `-Host` as Caddy wrote them.
pub fn forwarded(peer: IpAddr, headers: &mut HeaderMap) {
    let ip = peer.to_canonical().to_string();
    let host = headers.get(header::HOST).cloned();
    let value = if trusted(peer) {
        let chain: Vec<&str> = headers.get_all("x-forwarded-for").iter().filter_map(|v| v.to_str().ok()).map(str::trim).filter(|v| !v.is_empty()).collect();
        if chain.is_empty() {
            ip
        } else {
            format!("{}, {ip}", chain.join(", "))
        }
    } else {
        headers.remove("x-forwarded-proto");
        headers.remove("x-forwarded-host");
        ip
    };
    if let Ok(v) = HeaderValue::from_str(&value) {
        headers.insert("x-forwarded-for", v);
    }
    if !headers.contains_key("x-forwarded-proto") {
        headers.insert("x-forwarded-proto", HeaderValue::from_static("http"));
    }
    if let (false, Some(host)) = (headers.contains_key("x-forwarded-host"), host) {
        headers.insert("x-forwarded-host", host);
    }
}

// ── Compression ────────────────────────────────────────────────────────────────────────

/// Below this, gzip's header costs more than it saves.
const MIN_GZIP: usize = 512;

fn accepts_gzip(headers: &HeaderMap) -> bool {
    headers.get_all(header::ACCEPT_ENCODING).iter().filter_map(|v| v.to_str().ok()).flat_map(|v| v.split(',')).any(|coding| {
        let mut parts = coding.split(';').map(str::trim);
        let name = parts.next().unwrap_or("");
        let refused = parts.any(|p| p.strip_prefix("q=").is_some_and(|q| q.trim().parse::<f32>().is_ok_and(|q| q == 0.0)));
        (name.eq_ignore_ascii_case("gzip") || name == "*") && !refused
    })
}

fn compressible(headers: &HeaderMap) -> bool {
    let Some(kind) = headers.get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok()) else { return false };
    let kind = kind.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    kind.starts_with("text/") && kind != "text/event-stream"
        || matches!(
            kind.as_str(),
            "application/json" | "application/problem+json" | "application/javascript" | "application/manifest+json" | "application/xml" | "image/svg+xml" | "application/wasm"
        )
}

/// The response gzipped when the request takes it and the body is held whole.
pub async fn compress(gzip: bool, method: &Method, response: Response) -> Response {
    use axum::body::HttpBody as _;
    let skip = !gzip
        || method == Method::HEAD
        || matches!(response.status(), StatusCode::NO_CONTENT | StatusCode::NOT_MODIFIED | StatusCode::PARTIAL_CONTENT)
        || response.status().is_informational()
        || response.headers().contains_key(header::CONTENT_ENCODING)
        || !compressible(response.headers());
    let whole = response.body().size_hint().exact().is_some_and(|n| n as usize >= MIN_GZIP);
    if skip || !whole {
        return response;
    }
    let (mut parts, body) = response.into_parts();
    let Ok(collected) = body.collect().await else {
        let mut failed = Response::new(Body::empty());
        *failed.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
        return failed;
    };
    let bytes = collected.to_bytes();
    let mut encoder = flate2::write::GzEncoder::new(Vec::with_capacity(bytes.len() / 3), flate2::Compression::new(5));
    if encoder.write_all(&bytes).is_err() {
        return Response::from_parts(parts, Body::from(bytes));
    }
    let Ok(gzipped) = encoder.finish() else { return Response::from_parts(parts, Body::from(bytes)) };
    let h = &mut parts.headers;
    h.insert(header::CONTENT_ENCODING, HeaderValue::from_static("gzip"));
    h.remove(header::CONTENT_LENGTH);
    h.remove(header::ACCEPT_RANGES);
    let vary = h.get(header::VARY).and_then(|v| v.to_str().ok()).map(str::to_string);
    match vary {
        Some(v) if v.split(',').any(|p| p.trim().eq_ignore_ascii_case("accept-encoding") || p.trim() == "*") => {}
        Some(v) => {
            if let Ok(v) = HeaderValue::from_str(&format!("{v}, Accept-Encoding")) {
                h.insert(header::VARY, v);
            }
        }
        None => {
            h.insert(header::VARY, HeaderValue::from_static("Accept-Encoding"));
        }
    }
    Response::from_parts(parts, Body::from(gzipped))
}

// ── insights under /insights ───────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Upstream {
    Server,
    Web,
}

/// insights beside basedb, relayed under `{base}/insights` (`BASEDB_INSIGHTS=1`).
pub struct Insights {
    client: reqwest::Client,
    host: String,
    /// basedb's path: `/basedb`, or empty.
    base: String,
    /// `{base}/insights`.
    at: String,
}

/// What a relay does not pass on, either way.
const HOP_BY_HOP: [&str; 8] = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"];

impl Insights {
    pub fn from_config(cfg: &Config) -> Option<Insights> {
        if !insights_on(cfg.setting("BASEDB_INSIGHTS").as_deref()) {
            return None;
        }
        let client = reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).build().ok()?;
        Some(Insights::new(client, &cfg.setting("BASEDB_INSIGHTS_HOST").unwrap_or_else(|| INSIGHTS_DEFAULT_HOST.into()), &cfg.base_path))
    }

    pub fn new(client: reqwest::Client, host: &str, base: &str) -> Insights {
        Insights { client, host: host.to_string(), base: base.to_string(), at: format!("{base}/insights") }
    }

    pub fn host(&self) -> &str {
        &self.host
    }

    pub fn at(&self) -> &str {
        &self.at
    }

    /// Where a path goes, and the path it is given there — `None`: not insights'.
    pub fn route(&self, path: &str) -> Option<(Upstream, String)> {
        let under = |prefix: &str, rest: &str| -> Option<String> {
            let p = format!("{prefix}{rest}");
            path.starts_with(&p).then(|| path[prefix.len()..].to_string())
        };
        // Its server's routes, taken with basedb's path or without (a gateway that strips it).
        for prefix in std::iter::once(self.at.as_str()).chain((!self.base.is_empty()).then_some("/insights")) {
            if let Some(rest) = under(prefix, "/api/").or_else(|| under(prefix, "/mcp")) {
                return Some((Upstream::Server, rest));
            }
        }
        if path == self.at || path.starts_with(&format!("{}/", self.at)) {
            return Some((Upstream::Web, path.to_string()));
        }
        // Its interface wants basedb's path: put back when a gateway took it off.
        if !self.base.is_empty() && (path == "/insights" || path.starts_with("/insights/")) {
            return Some((Upstream::Web, format!("{}{path}", self.base)));
        }
        None
    }

    /// A `Location` of its server, under the prefix it was taken off — once, even when its
    /// server wrote its path already (`INSIGHTS_BASE_PATH`).
    pub fn location(&self, location: &str) -> String {
        if !location.starts_with('/') {
            return location.to_string();
        }
        let prefixed = format!("{}{location}", self.at);
        let mut twice = vec![format!("{}/insights", self.at)];
        if !self.base.is_empty() {
            twice.push(format!("{}{}/insights", self.at, self.base));
        }
        for doubled in twice {
            if let Some(rest) = prefixed.strip_prefix(&doubled) {
                if rest.is_empty() || rest.starts_with(['/', '?', '#']) {
                    return format!("{}{rest}", self.at);
                }
            }
        }
        prefixed
    }

    pub async fn relay(&self, upstream: Upstream, path: String, req: Request) -> Response {
        let port = match upstream {
            Upstream::Server => INSIGHTS_SERVER_PORT,
            Upstream::Web => INSIGHTS_WEB_PORT,
        };
        let query = req.uri().query().map(|q| format!("?{q}")).unwrap_or_default();
        let url = format!("http://{}:{port}{path}{query}", self.host);
        let (parts, body) = req.into_parts();
        let mut builder = self.client.request(parts.method.clone(), &url);
        for (name, value) in &parts.headers {
            if !HOP_BY_HOP.contains(&name.as_str()) {
                builder = builder.header(name, value);
            }
        }
        let sent = builder.body(reqwest::Body::wrap_stream(body.into_data_stream())).send().await;
        let Ok(answer) = sent else {
            let mut failed = Response::new(Body::empty());
            *failed.status_mut() = StatusCode::BAD_GATEWAY;
            return failed;
        };
        let mut response = Response::builder().status(answer.status());
        let rewrite = upstream == Upstream::Server;
        for (name, value) in answer.headers() {
            if HOP_BY_HOP.contains(&name.as_str()) {
                continue;
            }
            let value = match (rewrite, name) {
                (true, n) if n == header::LOCATION => value.to_str().ok().and_then(|v| HeaderValue::from_str(&self.location(v)).ok()).unwrap_or_else(|| value.clone()),
                (true, n) if n == header::SET_COOKIE => value
                    .to_str()
                    .ok()
                    .and_then(|v| HeaderValue::from_str(&v.replace("Path=/api/", &format!("Path={}/api/", self.at))).ok())
                    .unwrap_or_else(|| value.clone()),
                _ => value.clone(),
            };
            response = response.header(HeaderName::from(name), value);
        }
        response.body(Body::from_stream(answer.bytes_stream())).unwrap_or_else(|_| {
            let mut failed = Response::new(Body::empty());
            *failed.status_mut() = StatusCode::BAD_GATEWAY;
            failed
        })
    }
}

/// Every request through the front: the visitor's address, insights' routes, then `app`,
/// and the answer compressed.
pub fn wrap(app: Router, insights: Option<Arc<Insights>>) -> Router {
    Router::new().fallback(move |req: Request| {
        let (app, insights) = (app.clone(), insights.clone());
        async move {
            let mut req = req;
            if let Some(ConnectInfo(peer)) = req.extensions().get::<ConnectInfo<SocketAddr>>().copied() {
                forwarded(peer.ip(), req.headers_mut());
            }
            let gzip = accepts_gzip(req.headers());
            let method = req.method().clone();
            let routed = insights.as_ref().and_then(|i| i.route(req.uri().path()).map(|r| (i.clone(), r)));
            let response = match routed {
                Some((insights, (upstream, path))) => insights.relay(upstream, path, req).await,
                None => app.oneshot(req).await.unwrap_or_else(|never| match never {}),
            };
            compress(gzip, &method, response).await
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.append(HeaderName::from_bytes(k.as_bytes()).unwrap(), HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn a_trusted_proxy_keeps_the_visitor_anyone_else_is_the_visitor() {
        let mut h = headers(&[("x-forwarded-for", "203.0.113.9"), ("host", "basedb.fr")]);
        forwarded("172.18.0.5".parse().unwrap(), &mut h);
        assert_eq!(h["x-forwarded-for"], "203.0.113.9, 172.18.0.5");
        assert_eq!((h["x-forwarded-proto"].to_str().unwrap(), h["x-forwarded-host"].to_str().unwrap()), ("http", "basedb.fr"));
        let mut h = headers(&[("x-forwarded-for", "1.2.3.4"), ("x-forwarded-proto", "https")]);
        forwarded("198.51.100.7".parse().unwrap(), &mut h);
        assert_eq!((h["x-forwarded-for"].to_str().unwrap(), h["x-forwarded-proto"].to_str().unwrap()), ("198.51.100.7", "http"));
        let mut h = HeaderMap::new();
        forwarded("::ffff:127.0.0.1".parse().unwrap(), &mut h);
        assert_eq!(h["x-forwarded-for"], "127.0.0.1");
        assert!(trusted("fd12::1".parse().unwrap()) && !trusted("2001:db8::1".parse().unwrap()));
    }

    #[tokio::test]
    async fn whole_answers_are_gzipped_streams_are_not() {
        let json = |len: usize| {
            let mut r = Response::new(Body::from(format!("[{}]", "1,".repeat(len) + "1")));
            r.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
            r
        };
        let gzipped = compress(true, &Method::GET, json(2000)).await;
        assert_eq!(gzipped.headers()[header::CONTENT_ENCODING], "gzip");
        assert_eq!(gzipped.headers()[header::VARY], "Accept-Encoding");
        let bytes = gzipped.into_body().collect().await.unwrap().to_bytes();
        let mut text = String::new();
        std::io::Read::read_to_string(&mut flate2::read::GzDecoder::new(&bytes[..]), &mut text).unwrap();
        assert!(text.starts_with("[1,1,") && text.len() == 4003);
        assert!(!compress(false, &Method::GET, json(2000)).await.headers().contains_key(header::CONTENT_ENCODING));
        assert!(!compress(true, &Method::GET, json(10)).await.headers().contains_key(header::CONTENT_ENCODING));
        let mut stream = Response::new(Body::from_stream(futures_util::stream::iter([Ok::<_, std::io::Error>(bytes::Bytes::from("data: x\n\n".repeat(200)))])));
        stream.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("text/event-stream"));
        assert!(!compress(true, &Method::GET, stream).await.headers().contains_key(header::CONTENT_ENCODING));
        assert!(accepts_gzip(&headers(&[("accept-encoding", "br, gzip;q=0.8")])));
        assert!(!accepts_gzip(&headers(&[("accept-encoding", "gzip;q=0, deflate")])));
    }

    #[test]
    fn insights_routes_with_basedb_path_or_without() {
        let client = reqwest::Client::new();
        let root = Insights::new(client.clone(), "insights", "");
        assert_eq!(root.route("/insights/api/health"), Some((Upstream::Server, "/api/health".into())));
        assert_eq!(root.route("/insights/mcp"), Some((Upstream::Server, "/mcp".into())));
        assert_eq!(root.route("/insights"), Some((Upstream::Web, "/insights".into())));
        assert_eq!(root.route("/insights/q/1"), Some((Upstream::Web, "/insights/q/1".into())));
        assert_eq!(root.route("/insightsx"), None);
        assert_eq!(root.route("/api/v1/x"), None);
        let under = Insights::new(client, "127.0.0.1", "/basedb");
        assert_eq!(under.route("/basedb/insights/api/x"), Some((Upstream::Server, "/api/x".into())));
        assert_eq!(under.route("/insights/api/x"), Some((Upstream::Server, "/api/x".into())));
        assert_eq!(under.route("/insights/q"), Some((Upstream::Web, "/basedb/insights/q".into())));
        assert_eq!(under.route("/basedb/insights"), Some((Upstream::Web, "/basedb/insights".into())));
        assert_eq!(under.route("/basedb/x"), None);
        assert_eq!(root.location("/dashboards/1"), "/insights/dashboards/1");
        assert_eq!(root.location("/insights/dashboards/1"), "/insights/dashboards/1");
        assert_eq!(root.location("https://idp.fr/authorize"), "https://idp.fr/authorize");
        assert_eq!(under.location("/basedb/insights?x=1"), "/basedb/insights?x=1");
        assert_eq!(under.location("/"), "/basedb/insights/");
    }
}
