//! Where the server may reach out — `checkTarget` of `packages/core/src/webhooks/target.ts`
//! (chapter 08 §10.8), with the policy `webhookTargetsFromEnvironment` reads.
//!
//! By allowing, not by forbidding: only a publicly routable unicast address passes, every
//! address of the DNS answer is checked, and `::ffff:a.b.c.d` is unwrapped first.
//! `BASEDB_WEBHOOK_DEV=1` lets plain HTTP and private addresses through; `BASEDB_WEBHOOK_ALLOW`
//! names the operator's own servers — names, `*.` domains, addresses and ranges.

use basedb_base::config::Config;
use basedb_base::error::AppError;
use regex::Regex;
use serde_json::json;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::LazyLock;
use url::Url;

/// `TargetPolicy`.
#[derive(Debug, Clone, Default)]
pub struct TargetPolicy {
    pub allow_http: bool,
    pub allow_private: bool,
    pub trusted: Vec<String>,
}

impl TargetPolicy {
    /// `webhookTargetsFromEnvironment`; an unreadable `BASEDB_WEBHOOK_ALLOW` trusts nothing
    /// (Node refuses to start on it).
    pub fn from_config(cfg: &Config) -> Self {
        let dev = cfg.setting("BASEDB_WEBHOOK_DEV").as_deref() == Some("1");
        let trusted = parse_trusted(&cfg.setting("BASEDB_WEBHOOK_ALLOW").unwrap_or_default()).unwrap_or_default();
        TargetPolicy { allow_http: dev, allow_private: dev, trusted }
    }
}

static NAME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$").unwrap());
static SEPARATORS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[\s,]+").unwrap());

fn is_name(s: &str) -> bool {
    (1..=253).contains(&s.chars().count()) && NAME.is_match(s)
}

/// `parseTrusted`.
pub fn parse_trusted(raw: &str) -> Result<Vec<String>, String> {
    let entries: Vec<String> = SEPARATORS.split(raw).map(|e| e.trim().to_lowercase()).filter(|e| !e.is_empty()).collect();
    for entry in &entries {
        if trust_of(std::slice::from_ref(entry)).is_none() {
            return Err(format!("entrée invalide : « {entry} »"));
        }
    }
    Ok(entries)
}

#[derive(Default)]
struct Trust {
    names: Vec<String>,
    suffixes: Vec<String>,
    ranges: Vec<(IpAddr, u8)>,
}

fn trust_of(entries: &[String]) -> Option<Trust> {
    let mut trust = Trust::default();
    for entry in entries {
        let parts: Vec<&str> = entry.split('/').collect();
        let ip = parts[0].parse::<IpAddr>().ok();
        if let (Some(ip), true) = (ip, parts.len() <= 2) {
            let max = if ip.is_ipv6() { 128 } else { 32 };
            let prefix = match parts.get(1) {
                None => max,
                Some(bits) => {
                    let n = crate::js::js_to_number(bits);
                    if n.fract() != 0.0 || !n.is_finite() || n < 0.0 || n > max as f64 {
                        return None;
                    }
                    n as u8
                }
            };
            trust.ranges.push((ip, prefix));
        } else if entry.starts_with("*.") && is_name(&entry[2..]) {
            trust.suffixes.push(entry[1..].to_string());
        } else if is_name(entry) {
            trust.names.push(entry.clone());
        } else {
            return None;
        }
    }
    Some(trust)
}

fn in_subnet(addr: IpAddr, net: IpAddr, prefix: u8) -> bool {
    match (addr, net) {
        (IpAddr::V4(a), IpAddr::V4(n)) => {
            let mask = if prefix == 0 { 0 } else { u32::MAX << (32 - prefix as u32) };
            u32::from(a) & mask == u32::from(n) & mask
        }
        (IpAddr::V6(a), IpAddr::V6(n)) => {
            let mask = if prefix == 0 { 0 } else { u128::MAX << (128 - prefix as u32) };
            u128::from(a) & mask == u128::from(n) & mask
        }
        _ => false,
    }
}

const RESERVED_V4: [(Ipv4Addr, u8); 15] = [
    (Ipv4Addr::new(0, 0, 0, 0), 8),
    (Ipv4Addr::new(10, 0, 0, 0), 8),
    (Ipv4Addr::new(100, 64, 0, 0), 10),
    (Ipv4Addr::new(127, 0, 0, 0), 8),
    (Ipv4Addr::new(169, 254, 0, 0), 16),
    (Ipv4Addr::new(172, 16, 0, 0), 12),
    (Ipv4Addr::new(192, 0, 0, 0), 24),
    (Ipv4Addr::new(192, 0, 2, 0), 24),
    (Ipv4Addr::new(192, 88, 99, 0), 24),
    (Ipv4Addr::new(192, 168, 0, 0), 16),
    (Ipv4Addr::new(198, 18, 0, 0), 15),
    (Ipv4Addr::new(198, 51, 100, 0), 24),
    (Ipv4Addr::new(203, 0, 113, 0), 24),
    (Ipv4Addr::new(224, 0, 0, 0), 4),
    (Ipv4Addr::new(240, 0, 0, 0), 4),
];

const RESERVED_V6: [(Ipv6Addr, u8); 11] = [
    (Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0), 128),
    (Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 1), 128),
    (Ipv6Addr::new(0x64, 0xff9b, 0, 0, 0, 0, 0, 0), 96),
    (Ipv6Addr::new(0x64, 0xff9b, 1, 0, 0, 0, 0, 0), 48),
    (Ipv6Addr::new(0x100, 0, 0, 0, 0, 0, 0, 0), 64),
    (Ipv6Addr::new(0x2001, 0, 0, 0, 0, 0, 0, 0), 23),
    (Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 0), 32),
    (Ipv6Addr::new(0x2002, 0, 0, 0, 0, 0, 0, 0), 16),
    (Ipv6Addr::new(0xfc00, 0, 0, 0, 0, 0, 0, 0), 7),
    (Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 0), 10),
    (Ipv6Addr::new(0xff00, 0, 0, 0, 0, 0, 0, 0), 8),
];

/// `unwrap`: `::ffff:a.b.c.d` is `a.b.c.d`.
fn unwrap_mapped(addr: IpAddr) -> IpAddr {
    match addr {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(addr),
        v4 => v4,
    }
}

/// `isPublicAddress`.
pub fn is_public_address(addr: IpAddr) -> bool {
    match unwrap_mapped(addr) {
        a @ IpAddr::V4(_) => !RESERVED_V4.iter().any(|(n, p)| in_subnet(a, IpAddr::V4(*n), *p)),
        a @ IpAddr::V6(_) => !RESERVED_V6.iter().any(|(n, p)| in_subnet(a, IpAddr::V6(*n), *p)),
    }
}

fn trusted_address(trust: &Trust, addr: IpAddr) -> bool {
    let a = unwrap_mapped(addr);
    trust.ranges.iter().any(|(n, p)| in_subnet(a, *n, *p))
}

fn rejected() -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("url")).with("reason", json!("cible_refusee"))
}

fn https_required() -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("url")).with("reason", json!("https_requis"))
}

/// `checkTarget`: the URL as it may be reached, its shape checked and its host resolved.
pub async fn check_target(raw: &str, policy: &TargetPolicy) -> Result<Url, AppError> {
    let url = Url::parse(raw).map_err(|_| AppError::new("REQUEST_INVALID").with("field", json!("url")))?;
    let scheme = url.scheme();
    if scheme != "https" && scheme != "http" {
        return Err(https_required());
    }
    let plain_http = scheme == "http" && !policy.allow_http;
    if !url.username().is_empty() || url.password().is_some_and(|p| !p.is_empty()) {
        return Err(rejected());
    }
    if policy.allow_private {
        if plain_http {
            return Err(https_required());
        }
        return Ok(url);
    }
    let host = url.host_str().unwrap_or_default().trim_start_matches('[').trim_end_matches(']').to_lowercase();
    let trust = if policy.trusted.is_empty() { None } else { Some(trust_of(&policy.trusted).unwrap_or_default()) };
    if let Some(t) = &trust {
        if t.names.contains(&host) || t.suffixes.iter().any(|s| host.ends_with(s.as_str())) {
            return Ok(url);
        }
    }
    let other_port = url.port().is_some();
    let ranges = trust.as_ref().is_some_and(|t| !t.ranges.is_empty());
    if !ranges {
        if plain_http {
            return Err(https_required());
        }
        if other_port {
            return Err(rejected());
        }
    }
    let addresses: Vec<IpAddr> = match host.parse::<IpAddr>() {
        Ok(ip) => vec![ip],
        Err(_) => {
            let port = url.port_or_known_default().unwrap_or(443);
            tokio::net::lookup_host((host.as_str(), port)).await.map_err(|_| rejected())?.map(|a| a.ip()).collect()
        }
    };
    if addresses.is_empty() {
        return Err(rejected());
    }
    if let Some(t) = &trust {
        if addresses.iter().all(|a| trusted_address(t, *a)) {
            return Ok(url);
        }
    }
    if plain_http {
        return Err(https_required());
    }
    if other_port || !addresses.iter().all(|a| is_public_address(*a)) {
        return Err(rejected());
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_and_reserved() {
        assert!(is_public_address("8.8.8.8".parse().unwrap()));
        assert!(!is_public_address("10.1.2.3".parse().unwrap()));
        assert!(!is_public_address("::ffff:127.0.0.1".parse().unwrap()));
        assert!(!is_public_address("fe80::1".parse().unwrap()));
        assert!(is_public_address("2606:4700::1111".parse().unwrap()));
    }

    #[tokio::test]
    async fn checks_targets() {
        let strict = TargetPolicy::default();
        assert!(check_target("http://8.8.8.8/x", &strict).await.is_err());
        assert!(check_target("https://u:p@8.8.8.8/x", &strict).await.is_err());
        assert!(check_target("https://127.0.0.1/x", &strict).await.is_err());
        assert!(check_target("https://8.8.8.8:8443/x", &strict).await.is_err());
        assert!(check_target("https://8.8.8.8/x", &strict).await.is_ok());
        let own = TargetPolicy { trusted: parse_trusted("10.0.0.0/8, *.intra.fr").unwrap(), ..Default::default() };
        assert!(check_target("http://10.1.1.1:8080/x", &own).await.is_ok());
        assert!(check_target("http://a.intra.fr:81/", &own).await.is_ok());
        assert!(parse_trusted("10.0.0.0/33").is_err());
    }
}
