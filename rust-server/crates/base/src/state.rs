//! L'état partagé du serveur : configuration, pools PostgreSQL, limiteur de `/auth/*`, mémoire
//! des jetons d'intégration, client HTTPS sortant, courrier, et un
//! emplacement par crate de domaine ([`AppState::ext`]) pour qu'un domaine garde son état
//! sans modifier le socle.

use crate::auth::tokens::TokenCache;
use crate::config::Config;
use crate::db::Pools;
use crate::error::AppError;
use crate::mailer::Mailer;
use crate::rate_limit::{RateLimiter, ATTEMPTS, WINDOW_MS};
use serde_json::json;
use std::any::{Any, TypeId};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

pub struct AppState {
    pub cfg: Config,
    pub pools: Pools,
    /// One bucket for the whole of `/auth/*`, keyed by address (`RateLimiter` of app.ts).
    pub auth_limiter: RateLimiter,
    /// Believed integration tokens, 5 s (`verifyApiToken`).
    pub token_cache: TokenCache,
    /// HTTPS client (rustls, roots of the system store).
    pub https: reqwest::Client,
    pub mailer: Mailer,
    /// The bootstrapped administrator's address, published in development
    /// (`/api/v1/dev/account`). Set, before the routes are built, only by a start that has
    /// just created the instance with `BASEDB_DEV_LOGIN=1`.
    pub development_email: OnceLock<String>,
    ext: Mutex<HashMap<TypeId, Arc<dyn Any + Send + Sync>>>,
}

pub type Shared = Arc<AppState>;

pub fn https_client() -> reqwest::Client {
    reqwest::Client::builder().user_agent("basedb").connect_timeout(Duration::from_secs(15)).build().expect("client HTTPS")
}

impl AppState {
    pub fn new(cfg: Config) -> Result<Shared, String> {
        let pools = Pools::new(&cfg.database_url)?;
        let mailer = Mailer::from_config(cfg.smtp.as_ref(), cfg.dev_mail)?;
        Ok(Arc::new(AppState {
            pools,
            auth_limiter: RateLimiter::new(ATTEMPTS, WINDOW_MS),
            token_cache: TokenCache::default(),
            https: https_client(),
            mailer,
            development_email: OnceLock::new(),
            ext: Mutex::new(HashMap::new()),
            cfg,
        }))
    }

    /// `instanceKey()`: `BASEDB_ENCRYPTION_KEY`, without which no secret is derived.
    pub fn instance_key(&self) -> Result<&str, AppError> {
        self.cfg
            .encryption_key
            .as_deref()
            .ok_or_else(|| AppError::new("INTERNAL_ERROR").with("reason", json!("BASEDB_ENCRYPTION_KEY absente")))
    }

    /// `kernel.mail.available`.
    pub fn mail_available(&self) -> bool {
        self.mailer.available()
    }

    /// `kernel.geocoding.available`.
    pub fn geocoding_available(&self) -> bool {
        self.cfg.geocoder_url.is_some()
    }

    /// The state a crate keeps for itself, made on first use: `st.ext::<MyState>()`.
    pub fn ext<T: Default + Send + Sync + 'static>(&self) -> Arc<T> {
        let mut map = self.ext.lock().unwrap();
        let entry = map.entry(TypeId::of::<T>()).or_insert_with(|| Arc::new(T::default()) as Arc<dyn Any + Send + Sync>);
        entry.clone().downcast::<T>().expect("ext")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Default)]
    struct Counter(Mutex<u32>);

    #[tokio::test]
    async fn keeps_one_ext_per_type() {
        let st = AppState::new(Config::for_tests()).unwrap();
        *st.ext::<Counter>().0.lock().unwrap() += 1;
        *st.ext::<Counter>().0.lock().unwrap() += 1;
        assert_eq!(*st.ext::<Counter>().0.lock().unwrap(), 2);
        assert_eq!(st.instance_key().unwrap_err().details["reason"], json!("BASEDB_ENCRYPTION_KEY absente"));
    }
}
