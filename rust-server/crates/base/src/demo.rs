//! La démo publique, telle `apps/api/src/demo.ts` : le compte proposé selon la langue de
//! l'écran, les adresses de la démo, et ce qu'un visiteur peut changer — lire et modifier ce
//! qui existe passent ; créer, supprimer, l'IA et ce qui sort de l'instance sont refusés.
//!
//! Le garde-fou ([`crate::layers::demo_guard`]) s'applique à TOUTE requête, avant son routeur.

use basedb_contracts::FALLBACK_LOCALE;
use regex::Regex;
use serde_json::{json, Value};
use std::sync::OnceLock;

use crate::error::AppError;

/// `DemoConfig`: `(locale, email)` accounts, one password for all.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DemoConfig {
    pub accounts: Vec<(String, String)>,
    pub password: String,
}

/// `demoAccountFor`: the account of the screen's language, else English, else the first.
pub fn demo_account_for(demo: &DemoConfig, language: &str) -> Value {
    let account = demo
        .accounts
        .iter()
        .find(|(l, _)| l == language)
        .or_else(|| demo.accounts.iter().find(|(l, _)| l == FALLBACK_LOCALE))
        .or_else(|| demo.accounts.first());
    let (locale, email) = account.cloned().unwrap_or_default();
    json!({
        "email": email,
        "password": demo.password,
        "locale": locale,
        "accounts": demo.accounts.iter().map(|(l, e)| json!({ "locale": l, "email": e })).collect::<Vec<_>>(),
    })
}

/// `isDemoAddress`.
pub fn is_demo_address(demo: &DemoConfig, email: &str) -> bool {
    let wanted = email.trim().to_lowercase();
    demo.accounts.iter().any(|(_, e)| e.to_lowercase() == wanted)
}

const T: &str = "/api/v1/[^/]+";
const S: &str = "[^/]+";

struct Rules {
    allowed: Vec<(&'static str, Regex)>,
    batch: Regex,
    ai: Vec<Regex>,
}

fn rules() -> &'static Rules {
    static RULES: OnceLock<Rules> = OnceLock::new();
    RULES.get_or_init(|| {
        let allowed: Vec<(&str, String)> = vec![
            ("POST", "/auth/password/login".into()),
            ("POST", "/auth/session/access".into()),
            ("DELETE", "/auth/session".into()),
            ("POST", "/auth/elevate".into()),
            ("DELETE", "/auth/elevation".into()),
            ("PATCH", format!("{T}/data/{S}/{S}/{S}")),
            ("POST", format!("{T}/history/undo")),
            ("POST", format!("{T}/history/{S}/revert")),
            ("POST", format!("{T}/query/{S}")),
            ("POST", format!("{T}/sql/{S}")),
            ("POST", format!("/api/v1/forms/{S}/check")),
            ("POST", format!("{T}/ai/schedule/preview")),
            ("POST", format!("{T}/presence")),
            ("POST", format!("{T}/presence/pointer")),
            ("POST", format!("{T}/me/notifications/read")),
            ("PATCH", format!("{T}/admin/projects/{S}")),
            ("PATCH", format!("{T}/admin/bases/{S}")),
            ("PATCH", format!("{T}/admin/bases/{S}/tables/{S}")),
            ("POST", format!("{T}/admin/bases/{S}/tables/{S}/display")),
            ("PATCH", format!("{T}/admin/bases/{S}/tables/{S}/fields/{S}")),
            ("PUT", format!("{T}/admin/bases/{S}/tables/{S}/fields/order")),
            ("PUT", format!("{T}/admin/bases/{S}/tables/{S}/fields/{S}/options")),
            ("PATCH", format!("{T}/admin/bases/{S}/tables/{S}/views/{S}")),
            ("PUT", format!("{T}/admin/bases/{S}/tables/{S}/views/order")),
            ("PUT", format!("{T}/admin/bases/{S}/sql-views/order")),
            ("PATCH", format!("{T}/admin/bases/{S}/questions/{S}")),
            ("PATCH", format!("{T}/admin/bases/{S}/queries/{S}")),
        ];
        Rules {
            allowed: allowed.into_iter().map(|(m, p)| (m, Regex::new(&format!("^{p}$")).unwrap())).collect(),
            batch: Regex::new(&format!("^{T}/data/{S}/{S}/batch$")).unwrap(),
            ai: vec![
                Regex::new(&format!("^{T}/ai/")).unwrap(),
                Regex::new(&format!("^{T}/admin/templates/draft$")).unwrap(),
                Regex::new(&format!("^{T}/admin/bases/{S}/tables/{S}/fields/{S}/ai/run$")).unwrap(),
            ],
        }
    })
}

/// Whether `(method, path)` is the batch route that may pass with updates only.
pub fn is_batch_route(method: &str, path: &str) -> bool {
    method == "POST" && rules().batch.is_match(path)
}

/// `demoAllowsBatch`: a non-empty list of `{op: 'update'}` on the batch route.
pub fn demo_allows_batch(method: &str, path: &str, operations: &Value) -> bool {
    is_batch_route(method, path)
        && operations.as_array().is_some_and(|ops| !ops.is_empty() && ops.iter().all(|o| o.get("op").and_then(Value::as_str) == Some("update")))
}

/// `demoRefusal`: what the demo answers a write it does not let through.
pub fn demo_refusal(method: &str, path: &str) -> Option<AppError> {
    if matches!(method, "GET" | "HEAD" | "OPTIONS") {
        return None;
    }
    let r = rules();
    if r.allowed.iter().any(|(m, p)| *m == method && p.is_match(path)) {
        return None;
    }
    if method == "POST" && r.ai.iter().any(|p| p.is_match(path)) {
        return Some(AppError::new("AI_DISABLED").with("reason", json!("demo")));
    }
    Some(AppError::new("ACTION_FORBIDDEN").with("reason", json!("demo")))
}

#[cfg(test)]
mod tests {
    use super::*;

    const T: &str = "/api/v1/t4z56fq";

    fn refused(method: &str, path: &str) -> Option<&'static str> {
        demo_refusal(method, path).map(|e| e.code)
    }

    #[test]
    fn lets_every_read_through_and_the_session() {
        assert_eq!(refused("GET", &format!("{T}/data/ventes/clients")), None);
        assert_eq!(refused("GET", &format!("{T}/admin/users")), None);
        assert_eq!(refused("OPTIONS", &format!("{T}/admin/bases")), None);
        for p in ["/auth/password/login", "/auth/session/access", "/auth/elevate"] {
            assert_eq!(refused("POST", p), None);
        }
        assert_eq!(refused("DELETE", "/auth/session"), None);
    }

    #[test]
    fn lets_rows_and_structure_be_edited() {
        assert_eq!(refused("PATCH", &format!("{T}/data/ventes/clients/0190a0b2")), None);
        assert_eq!(refused("POST", &format!("{T}/history/undo")), None);
        assert_eq!(refused("POST", &format!("{T}/history/42/revert")), None);
        assert_eq!(refused("PATCH", &format!("{T}/admin/bases/ventes/tables/clients/fields/statut")), None);
        assert_eq!(refused("PUT", &format!("{T}/admin/bases/ventes/tables/clients/fields/order")), None);
        assert_eq!(refused("PATCH", &format!("{T}/admin/bases/ventes/tables/clients/views/0190")), None);
        assert_eq!(refused("PUT", &format!("{T}/admin/bases/ventes/tables/clients/views/order")), None);
    }

    #[test]
    fn refuses_every_creation() {
        for p in [
            format!("{T}/admin/projects"),
            format!("{T}/admin/bases"),
            format!("{T}/admin/bases/ventes/tables"),
            format!("{T}/admin/bases/ventes/tables/clients/fields"),
            format!("{T}/admin/bases/ventes/tables/clients/views"),
            format!("{T}/data/ventes/clients"),
            format!("{T}/data/ventes/clients/batch"),
            format!("{T}/data/ventes/clients/0190/comments"),
            format!("{T}/files/ventes/clients/photo"),
            format!("{T}/admin/users"),
            format!("{T}/admin/tokens"),
            format!("{T}/sharing/base/0190/invitations"),
            "/auth/signup".into(),
            "/api/v1/forms/abc".into(),
        ] {
            let e = demo_refusal("POST", &p).unwrap();
            assert_eq!((p.as_str(), e.code), (p.as_str(), "ACTION_FORBIDDEN"));
            assert_eq!(e.details["reason"], json!("demo"));
        }
    }

    #[test]
    fn batch_only_when_it_changes_rows() {
        let batch = format!("{T}/data/ventes/clients/batch");
        let update = json!({ "op": "update", "id": "0190", "data": { "nom": "x" } });
        assert!(demo_allows_batch("POST", &batch, &json!([update, update])));
        assert!(!demo_allows_batch("POST", &batch, &json!([update, { "op": "create", "data": {} }])));
        assert!(!demo_allows_batch("POST", &batch, &json!([{ "op": "create", "data": {} }])));
        assert!(!demo_allows_batch("POST", &batch, &json!([])));
        assert!(!demo_allows_batch("POST", &batch, &json!("update")));
        assert!(!demo_allows_batch("POST", &batch, &json!([null])));
        assert!(!demo_allows_batch("POST", &format!("{T}/data/ventes/clients"), &json!([update])));
        assert!(!demo_allows_batch("PUT", &batch, &json!([update])));
    }

    #[test]
    fn refuses_deletions_settings_and_what_reaches_beyond() {
        assert_eq!(refused("DELETE", &format!("{T}/admin/bases/ventes")), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("DELETE", &format!("{T}/data/ventes/clients/0190")), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("DELETE", "/auth/sessions"), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("POST", "/auth/password/change"), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("PATCH", "/auth/me"), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("PUT", "/auth/me/email"), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("PATCH", &format!("{T}/admin/bases/ventes/automations/0190")), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("PUT", &format!("{T}/admin/bases/ventes/tables/clients/views/0190/share")), Some("ACTION_FORBIDDEN"));
        assert_eq!(refused("PATCH", &format!("{T}/admin/webhooks/0190")), Some("ACTION_FORBIDDEN"));
    }

    #[test]
    fn ai_routes_get_the_ai_refusal() {
        let e = demo_refusal("POST", &format!("{T}/ai/bases/ventes/copilot")).unwrap();
        assert_eq!((e.code, &e.details["reason"]), ("AI_DISABLED", &json!("demo")));
        assert_eq!(refused("POST", &format!("{T}/admin/templates/draft")), Some("AI_DISABLED"));
        assert_eq!(refused("POST", &format!("{T}/admin/bases/ventes/tables/avis/fields/sentiment/ai/run")), Some("AI_DISABLED"));
        assert_eq!(refused("POST", &format!("{T}/ai/schedule/preview")), None);
    }

    fn demo() -> DemoConfig {
        DemoConfig {
            accounts: vec![
                ("fr".into(), "demo@demo.com".into()),
                ("en".into(), "demo-en@demo.com".into()),
                ("de".into(), "demo-de@demo.com".into()),
            ],
            password: "essayez-basedb".into(),
        }
    }

    #[test]
    fn account_for_the_screen_s_language() {
        assert_eq!(
            demo_account_for(&demo(), "de"),
            json!({
                "email": "demo-de@demo.com", "password": "essayez-basedb", "locale": "de",
                "accounts": [
                    { "locale": "fr", "email": "demo@demo.com" },
                    { "locale": "en", "email": "demo-en@demo.com" },
                    { "locale": "de", "email": "demo-de@demo.com" },
                ],
            })
        );
        assert_eq!(demo_account_for(&demo(), "ja")["email"], json!("demo-en@demo.com"));
        let single = DemoConfig { accounts: vec![("fr".into(), "demo@demo.com".into())], password: "x".into() };
        assert_eq!(demo_account_for(&single, "ja")["email"], json!("demo@demo.com"));
    }

    #[test]
    fn knows_its_addresses() {
        assert!(is_demo_address(&demo(), " Demo-EN@demo.com "));
        assert!(!is_demo_address(&demo(), "admin@demo.com"));
    }
}
