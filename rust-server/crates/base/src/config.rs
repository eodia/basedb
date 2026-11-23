//! La configuration, lue comme `apps/api/src/server.ts` lit la sienne : mêmes variables, mêmes
//! défauts, **une variable vide compte comme absente** (`setting()`). Les fichiers `.env` puis
//! `.env.local` de la racine du dépôt complètent l'environnement du processus, qui l'emporte.
//!
//! L'écoute : `PORT` (8787, comme l'API Node d'avant) et `BASEDB_HOST` (0.0.0.0). Les
//! migrations du catalogue sont embarquées dans le binaire ; `CATALOG_MIGRATIONS_DIR` en lit
//! d'autres depuis un dossier (développement, tests).
//!
//! Un domaine qui a besoin d'une variable non modélisée ici la lit par [`Config::setting`] : la
//! même règle (vide = absente), le même ordre (processus, puis `.env`).

use crate::demo::DemoConfig;
use basedb_contracts::locales::{is_locale, SOURCE_LOCALE};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// `BASEDB_SMTP_*`: the operator's relay (`mail/smtp.ts`).
#[derive(Debug, Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    /// `tls`, `starttls` or `none`.
    pub secure: String,
    pub user: Option<String>,
    pub password: Option<String>,
    pub helo: String,
    /// `BASEDB_MAIL_FROM`, as written (`basedb <no-reply@exemple.fr>`).
    pub from: String,
    pub from_address: String,
}

/// Where the files of `file` and `image` fields go (`files/environment.ts`).
#[derive(Debug, Clone)]
pub enum FileStorage {
    Local { directory: PathBuf },
    S3 { endpoint: String, bucket: String, region: String, access_key_id: String, secret_access_key: String, force_path_style: bool },
}

/// Where insights runs beside basedb when `BASEDB_INSIGHTS_HOST` does not say: the compose
/// service. Its server (API, MCP, Trino's OPA) and its interface listen on these ports.
pub const INSIGHTS_DEFAULT_HOST: &str = "insights";
pub const INSIGHTS_SERVER_PORT: u16 = 4200;
pub const INSIGHTS_WEB_PORT: u16 = 3100;

/// `BASEDB_INSIGHTS=1` (or true, yes, on): insights served under `/insights` by this server.
pub fn insights_on(value: Option<&str>) -> bool {
    value.is_some_and(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
}

/// `insightsFromEnvironment`.
#[derive(Debug, Clone)]
pub struct InsightsConfig {
    pub api_url: String,
    pub public_url: String,
    pub secret: String,
    pub database_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Config {
    vars: HashMap<String, String>,
    pub root: Option<PathBuf>,
    pub database_url: String,
    /// `BASEDB_ENCRYPTION_KEY`: the instance key (pepper, CSRF, access tokens…).
    pub encryption_key: Option<String>,
    pub host: String,
    pub port: u16,
    /// `CATALOG_MIGRATIONS_DIR`: `None` reads the migrations embedded at build time.
    pub migrations_dir: Option<PathBuf>,
    pub migrate: bool,
    pub bootstrap: bool,
    pub dev_login: bool,
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
    /// `BASEDB_TENANT`: the tenant the pre-session routes speak for (`t4z56fq`).
    pub tenant_ref: Option<String>,
    /// `BASEDB_ORIGINS`: `None` accepts any `http://localhost[:port]` (development).
    pub allowed_origins: Option<Vec<String>>,
    pub public_url: Option<String>,
    /// `/basedb`, or empty at the root.
    pub base_path: String,
    pub demo: Option<DemoConfig>,
    pub smtp: Option<SmtpConfig>,
    /// `BASEDB_DEV_MAIL=1` (without SMTP): mails printed, never sent.
    pub dev_mail: bool,
    /// `None` when `BASEDB_GEOCODER_URL=off`.
    pub geocoder_url: Option<String>,
    pub files: FileStorage,
    pub max_file_bytes: Option<u64>,
    pub insights: Option<InsightsConfig>,
}

/// `KEY=value` lines, as dotenv reads them.
pub fn parse_env(text: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((k, v)) = line.split_once('=') else { continue };
        let mut value = v.trim().to_string();
        let quoted = value.len() >= 2 && ((value.starts_with('"') && value.ends_with('"')) || (value.starts_with('\'') && value.ends_with('\'')));
        if quoted {
            value = value[1..value.len() - 1].to_string();
        } else if let Some(i) = value.find(" #") {
            value = value[..i].trim_end().to_string();
        }
        out.push((k.trim().to_string(), value));
    }
    out
}

/// The repository's root: the first parent holding `pnpm-workspace.yaml`.
pub fn repo_root(from: &Path) -> Option<PathBuf> {
    from.ancestors().find(|d| d.join("pnpm-workspace.yaml").is_file()).map(Path::to_path_buf)
}

/// `basePathOf`: `BASEDB_BASE_PATH`, else the path of `BASEDB_PUBLIC_URL`.
pub fn base_path_of(base_path: Option<&str>, public_url: Option<&str>) -> String {
    let raw = match base_path {
        Some(b) => b.to_string(),
        None => public_url.and_then(|u| url::Url::parse(u).ok()).map(|u| u.path().to_string()).unwrap_or_default(),
    };
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        String::new()
    } else if trimmed.starts_with('/') {
        trimmed.to_string()
    } else {
        format!("/{trimmed}")
    }
}

/// `parseAddress` of `mail/transport.ts`: the address of `basedb <no-reply@exemple.fr>`.
pub fn parse_address(text: &str) -> Option<(String, Option<String>)> {
    let trimmed = text.trim();
    let (name, address) = match (trimmed.rfind('<'), trimmed.ends_with('>')) {
        (Some(i), true) if !trimmed[i + 1..trimmed.len() - 1].contains(['<', '>']) => (trimmed[..i].trim().trim_matches('"').to_string(), trimmed[i + 1..trimmed.len() - 1].trim().to_string()),
        _ => (String::new(), trimmed.to_string()),
    };
    let ok = regex::Regex::new(r"^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$").unwrap().is_match(&address);
    ok.then(|| (address, (!name.is_empty()).then_some(name)))
}

/// The configuration of this process: environment, then `.env` and `.env.local` at the root.
pub fn load() -> Result<Config, String> {
    let root = std::env::current_dir().ok().and_then(|d| repo_root(&d));
    let mut vars: HashMap<String, String> = HashMap::new();
    if let Some(root) = &root {
        for name in [".env", ".env.local"] {
            if let Ok(text) = std::fs::read_to_string(root.join(name)) {
                vars.extend(parse_env(&text));
            }
        }
    }
    vars.extend(std::env::vars());
    load_from(vars, root)
}

/// The configuration from a given set of variables — the tests give theirs.
pub fn load_from(vars: HashMap<String, String>, root: Option<PathBuf>) -> Result<Config, String> {
    let vars = with_secret_files(vars)?;
    let setting = |k: &str| vars.get(k).filter(|v| !v.trim().is_empty()).cloned();
    let flag = |k: &str| setting(k).as_deref() == Some("1");

    let database_url = setting("DATABASE_URL").ok_or("DATABASE_URL is required.")?;
    let port = match setting("PORT") {
        Some(p) => p.trim().parse::<u16>().map_err(|_| format!("PORT n'est pas un port : {p}"))?,
        None => 8787,
    };
    let migrations_dir = setting("CATALOG_MIGRATIONS_DIR").map(PathBuf::from);

    let public_url = setting("BASEDB_PUBLIC_URL");
    let base_path = base_path_of(setting("BASEDB_BASE_PATH").as_deref(), public_url.as_deref());

    let smtp = match setting("BASEDB_SMTP_HOST") {
        None => None,
        Some(host) => {
            let from = setting("BASEDB_MAIL_FROM").unwrap_or_default();
            let (from_address, _) =
                parse_address(&from).ok_or("BASEDB_SMTP_HOST is set, but BASEDB_MAIL_FROM is not an address (basedb <no-reply@exemple.fr>).")?;
            let port_text = setting("BASEDB_SMTP_PORT").unwrap_or_else(|| "587".into());
            let port: u16 = port_text.parse().ok().filter(|p| *p >= 1).ok_or("BASEDB_SMTP_PORT is not a port.")?;
            let secure = setting("BASEDB_SMTP_SECURE").unwrap_or_else(|| if port == 465 { "tls".into() } else { "starttls".into() });
            if !matches!(secure.as_str(), "tls" | "starttls" | "none") {
                return Err("BASEDB_SMTP_SECURE is tls, starttls or none.".into());
            }
            let helo = setting("BASEDB_SMTP_HELO").unwrap_or_else(|| from_address[from_address.find('@').map(|i| i + 1).unwrap_or(0)..].to_string());
            Some(SmtpConfig { host, port, secure, user: setting("BASEDB_SMTP_USER"), password: setting("BASEDB_SMTP_PASSWORD"), helo, from, from_address })
        }
    };

    let geocoder_url = match setting("BASEDB_GEOCODER_URL") {
        Some(v) if v == "off" => None,
        Some(v) => Some(v),
        None => Some("https://nominatim.openstreetmap.org".into()),
    };

    let files = match setting("BASEDB_S3_BUCKET") {
        Some(bucket) => {
            let missing: Vec<&str> =
                ["BASEDB_S3_ENDPOINT", "BASEDB_S3_ACCESS_KEY_ID", "BASEDB_S3_SECRET_ACCESS_KEY"].into_iter().filter(|n| setting(n).is_none()).collect();
            if !missing.is_empty() {
                return Err(format!("BASEDB_S3_BUCKET is set, but {} {} not.", missing.join(", "), if missing.len() > 1 { "are" } else { "is" }));
            }
            FileStorage::S3 {
                endpoint: setting("BASEDB_S3_ENDPOINT").unwrap(),
                bucket,
                region: setting("BASEDB_S3_REGION").unwrap_or_else(|| "us-east-1".into()),
                access_key_id: setting("BASEDB_S3_ACCESS_KEY_ID").unwrap(),
                secret_access_key: setting("BASEDB_S3_SECRET_ACCESS_KEY").unwrap(),
                force_path_style: setting("BASEDB_S3_FORCE_PATH_STYLE").as_deref() != Some("0"),
            }
        }
        None => FileStorage::Local {
            directory: setting("BASEDB_FILES_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| root.clone().unwrap_or_else(|| PathBuf::from(".")).join(".basedb").join("files")),
        },
    };
    let max_file_bytes = setting("BASEDB_FILES_MAX_MB").and_then(|v| v.trim().parse::<f64>().ok()).filter(|mb| mb.is_finite() && *mb > 0.0).map(|mb| (mb * 1024.0 * 1024.0) as u64);

    let insights = {
        let (mut api, mut public, secret) = (setting("BASEDB_INSIGHTS_URL"), setting("BASEDB_INSIGHTS_PUBLIC_URL"), setting("BASEDB_INSIGHTS_SECRET"));
        // insights served under `/insights` on this address (`BASEDB_INSIGHTS=1`): its two
        // addresses follow from where it runs, its secret is the one thing to give.
        if insights_on(setting("BASEDB_INSIGHTS").as_deref()) {
            let host = setting("BASEDB_INSIGHTS_HOST").unwrap_or_else(|| INSIGHTS_DEFAULT_HOST.into());
            api.get_or_insert_with(|| format!("http://{host}:{INSIGHTS_SERVER_PORT}"));
            public.get_or_insert_with(|| {
                let origin = public_url.as_deref().and_then(|u| url::Url::parse(u).ok()).map(|u| u.origin().ascii_serialization()).filter(|o| o != "null");
                let origin = origin.unwrap_or_else(|| format!("http://localhost:{}", setting("BASEDB_PORT").or_else(|| setting("PORT")).unwrap_or_else(|| "3000".into())));
                format!("{origin}{base_path}/insights")
            });
            if secret.is_none() {
                return Err("BASEDB_INSIGHTS=1 : set BASEDB_INSIGHTS_SECRET, the HOST_SSO_SECRET of insights as well (openssl rand -base64 32).".into());
            }
        }
        match (api, public, secret) {
            (None, None, None) => None,
            (Some(api), Some(public), Some(secret)) => {
                if secret.chars().count() < 32 {
                    return Err("BASEDB_INSIGHTS_SECRET : 32 characters or more.".into());
                }
                for (name, url) in [("BASEDB_INSIGHTS_URL", &api), ("BASEDB_INSIGHTS_PUBLIC_URL", &public)] {
                    if !(url.starts_with("http://") || url.starts_with("https://")) {
                        return Err(format!("{name} : an http(s) address."));
                    }
                }
                Some(InsightsConfig {
                    api_url: api.strip_suffix('/').unwrap_or(&api).to_string(),
                    public_url: public.strip_suffix('/').unwrap_or(&public).to_string(),
                    secret,
                    database_url: setting("BASEDB_INSIGHTS_DATABASE_URL"),
                })
            }
            _ => return Err("BASEDB_INSIGHTS_URL, BASEDB_INSIGHTS_PUBLIC_URL and BASEDB_INSIGHTS_SECRET go together.".into()),
        }
    };

    let demo = if flag("BASEDB_DEMO") {
        let listed: Vec<String> = setting("BASEDB_DEMO_ACCOUNTS").unwrap_or_default().split(',').map(|e| e.trim().to_string()).filter(|e| !e.is_empty()).collect();
        if !listed.is_empty() {
            let mut accounts = Vec::new();
            for entry in &listed {
                let mut parts = entry.split('=').map(str::trim);
                let (locale, email) = (parts.next().unwrap_or(""), parts.next());
                match email {
                    Some(email) if is_locale(locale) && email.contains('@') => accounts.push((locale.to_string(), email.to_string())),
                    _ => return Err(format!("BASEDB_DEMO_ACCOUNTS : « {entry} » n’est pas une langue et une adresse (fr=demo@demo.com).")),
                }
            }
            let password = setting("BASEDB_DEMO_PASSWORD").ok_or("BASEDB_DEMO_ACCOUNTS demande BASEDB_DEMO_PASSWORD, le mot de passe des comptes de la démo.")?;
            Some(DemoConfig { accounts, password })
        } else {
            match (setting("BASEDB_ADMIN_EMAIL"), setting("BASEDB_ADMIN_PASSWORD")) {
                (Some(email), Some(password)) => Some(DemoConfig { accounts: vec![(SOURCE_LOCALE.to_string(), email)], password }),
                _ => return Err("BASEDB_DEMO=1 : sans BASEDB_DEMO_ACCOUNTS, le compte de la démo est l’administrateur que nomment BASEDB_ADMIN_EMAIL et BASEDB_ADMIN_PASSWORD, qui manquent.".into()),
            }
        }
    } else {
        None
    };

    Ok(Config {
        database_url,
        encryption_key: setting("BASEDB_ENCRYPTION_KEY"),
        host: setting("BASEDB_HOST").unwrap_or_else(|| "0.0.0.0".into()),
        port,
        migrations_dir,
        migrate: flag("BASEDB_MIGRATE"),
        bootstrap: flag("BASEDB_BOOTSTRAP"),
        dev_login: flag("BASEDB_DEV_LOGIN"),
        admin_email: setting("BASEDB_ADMIN_EMAIL"),
        admin_password: setting("BASEDB_ADMIN_PASSWORD"),
        tenant_ref: setting("BASEDB_TENANT"),
        allowed_origins: setting("BASEDB_ORIGINS").map(|raw| raw.split(',').map(|o| o.trim().to_string()).filter(|o| !o.is_empty()).collect()),
        public_url,
        base_path,
        demo,
        dev_mail: smtp.is_none() && flag("BASEDB_DEV_MAIL"),
        smtp,
        geocoder_url,
        files,
        max_file_bytes,
        insights,
        root,
        vars,
    })
}

/// `NAME_FILE`, a secret mounted as a file (the compose file's `secrets` volume, Docker or
/// Kubernetes secrets), stands for `NAME` when `NAME` is unset — for `DATABASE_URL`, every
/// `BASEDB_*` and the providers' `*_API_KEY`. Its final line break is not part of it.
fn with_secret_files(mut vars: HashMap<String, String>) -> Result<HashMap<String, String>, String> {
    let set = |vars: &HashMap<String, String>, name: &str| vars.get(name).is_some_and(|v| !v.trim().is_empty());
    let files: Vec<(String, String)> = vars
        .iter()
        .filter_map(|(key, path)| Some((key.strip_suffix("_FILE")?.to_string(), path.trim().to_string())))
        .filter(|(name, path)| !path.is_empty() && (name == "DATABASE_URL" || name.starts_with("BASEDB_") || name.ends_with("_API_KEY")))
        .filter(|(name, _)| !set(&vars, name))
        .collect();
    for (name, path) in files {
        let text = std::fs::read_to_string(&path).map_err(|e| format!("{name}_FILE : {path} ne se lit pas ({e})."))?;
        vars.insert(name, text.trim_end_matches(['\r', '\n']).to_string());
    }
    Ok(vars)
}

impl Config {
    /// `setting(name)`: a variable, empty counting as unset.
    pub fn setting(&self, name: &str) -> Option<String> {
        self.vars.get(name).filter(|v| !v.trim().is_empty()).cloned()
    }

    /// Whether this process runs the background work (drain, automations, mails, AI cells…):
    /// yes unless `BASEDB_RUST_BACKGROUND=0` — a second server sharing the database.
    pub fn background(&self) -> bool {
        self.setting("BASEDB_RUST_BACKGROUND").as_deref() != Some("0")
    }

    /// The tenant the pre-session routes speak for.
    pub fn auth_tenant(&self) -> &str {
        self.tenant_ref.as_deref().unwrap_or("t4z56fq")
    }

    /// Whether a mail can leave at all (`kernel.mail.available`).
    pub fn mail_available(&self) -> bool {
        self.smtp.is_some() || self.dev_mail
    }

    /// A configuration for unit tests: a database URL and nothing else.
    pub fn for_tests() -> Config {
        let vars = HashMap::from([("DATABASE_URL".to_string(), "postgres://postgres:basedb@localhost:55432/postgres".to_string())]);
        load_from(vars, None).expect("configuration de test")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(pairs: &[(&str, &str)]) -> Result<Config, String> {
        let mut vars: HashMap<String, String> = pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        vars.entry("DATABASE_URL".into()).or_insert_with(|| "postgres://x@localhost/db".into());
        load_from(vars, Some(PathBuf::from("/repo")))
    }

    #[test]
    fn defaults_follow_server_ts() {
        let c = cfg(&[]).unwrap();
        assert_eq!((c.port, c.host.as_str()), (8787, "0.0.0.0"));
        let c2 = cfg(&[("PORT", "3000"), ("BASEDB_HOST", "127.0.0.1")]).unwrap();
        assert_eq!((c2.port, c2.host.as_str()), (3000, "127.0.0.1"));
        assert!(cfg(&[("PORT", "x")]).is_err());
        assert_eq!(c.allowed_origins, None);
        assert_eq!(c.auth_tenant(), "t4z56fq");
        assert_eq!(c.geocoder_url.as_deref(), Some("https://nominatim.openstreetmap.org"));
        assert!(!c.mail_available() && c.demo.is_none());
        assert_eq!(c.migrations_dir, None);
        assert!(cfg(&[("DATABASE_URL", " ")]).is_err());
    }

    #[test]
    fn insights_beside_follows_from_its_host() {
        let secret = "s".repeat(32);
        let c = cfg(&[("BASEDB_INSIGHTS", "1"), ("BASEDB_INSIGHTS_SECRET", &secret), ("PORT", "3000")]).unwrap();
        let i = c.insights.unwrap();
        assert_eq!((i.api_url.as_str(), i.public_url.as_str()), ("http://insights:4200", "http://localhost:3000/insights"));
        let c = cfg(&[("BASEDB_INSIGHTS", "on"), ("BASEDB_INSIGHTS_SECRET", &secret), ("BASEDB_INSIGHTS_HOST", "127.0.0.1"), ("BASEDB_PUBLIC_URL", "https://gw.fr/basedb/")]).unwrap();
        let i = c.insights.unwrap();
        assert_eq!((i.api_url.as_str(), i.public_url.as_str()), ("http://127.0.0.1:4200", "https://gw.fr/basedb/insights"));
        assert!(cfg(&[("BASEDB_INSIGHTS", "1")]).unwrap_err().contains("BASEDB_INSIGHTS_SECRET"));
        assert!(cfg(&[("BASEDB_INSIGHTS", "0")]).unwrap().insights.is_none());
    }

    #[test]
    fn empty_counts_as_unset() {
        let c = cfg(&[("BASEDB_ORIGINS", ""), ("BASEDB_TENANT", "  "), ("BASEDB_GEOCODER_URL", "off")]).unwrap();
        assert_eq!(c.allowed_origins, None);
        assert_eq!(c.auth_tenant(), "t4z56fq");
        assert_eq!(c.geocoder_url, None);
        let c = cfg(&[("BASEDB_ORIGINS", "https://a.fr, ,https://b.fr")]).unwrap();
        assert_eq!(c.allowed_origins, Some(vec!["https://a.fr".into(), "https://b.fr".into()]));
    }

    #[test]
    fn smtp_and_demo() {
        assert!(cfg(&[("BASEDB_SMTP_HOST", "smtp.x.fr")]).is_err());
        let c = cfg(&[("BASEDB_SMTP_HOST", "smtp.x.fr"), ("BASEDB_MAIL_FROM", "basedb <no-reply@exemple.fr>"), ("BASEDB_SMTP_PORT", "465")]).unwrap();
        let s = c.smtp.unwrap();
        assert_eq!((s.secure.as_str(), s.helo.as_str(), s.from_address.as_str()), ("tls", "exemple.fr", "no-reply@exemple.fr"));
        assert!(cfg(&[("BASEDB_DEMO", "1")]).is_err());
        let c = cfg(&[("BASEDB_DEMO", "1"), ("BASEDB_DEMO_ACCOUNTS", "fr=demo@demo.com,en=demo-en@demo.com"), ("BASEDB_DEMO_PASSWORD", "p")]).unwrap();
        assert_eq!(c.demo.unwrap().accounts.len(), 2);
        assert!(cfg(&[("BASEDB_DEMO", "1"), ("BASEDB_DEMO_ACCOUNTS", "xx=demo@demo.com"), ("BASEDB_DEMO_PASSWORD", "p")]).is_err());
    }

    #[test]
    fn base_path_and_env_files() {
        assert_eq!(base_path_of(None, Some("https://gw.fr/basedb/")), "/basedb");
        assert_eq!(base_path_of(Some("basedb/"), None), "/basedb");
        assert_eq!(base_path_of(Some("/"), None), "");
        assert_eq!(parse_env("# c\nA=1\nexport B=\"x y\"\nC=v # note\n"), vec![("A".into(), "1".into()), ("B".into(), "x y".into()), ("C".into(), "v".into())]);
        assert_eq!(parse_address("no-reply@exemple.fr"), Some(("no-reply@exemple.fr".into(), None)));
        assert_eq!(parse_address("pas une adresse"), None);
    }

    #[test]
    fn secrets_as_files() {
        let path = std::env::temp_dir().join(format!("basedb-secret-{}", std::process::id()));
        std::fs::write(&path, "cle-du-fichier\n").unwrap();
        let file = path.to_string_lossy().into_owned();
        assert_eq!(cfg(&[("BASEDB_ENCRYPTION_KEY_FILE", &file)]).unwrap().encryption_key.as_deref(), Some("cle-du-fichier"));
        let c = cfg(&[("BASEDB_ENCRYPTION_KEY", "cle-de-env"), ("BASEDB_ENCRYPTION_KEY_FILE", &file), ("SSL_CERT_FILE", "/absent")]).unwrap();
        assert_eq!(c.encryption_key.as_deref(), Some("cle-de-env"));
        assert!(cfg(&[("BASEDB_SMTP_PASSWORD_FILE", "/absent/secret")]).unwrap_err().contains("BASEDB_SMTP_PASSWORD_FILE"));
        std::fs::remove_file(path).unwrap();
    }
}
