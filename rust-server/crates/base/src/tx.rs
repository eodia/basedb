//! Le contexte d'une requête et les transactions, tels `tx/context.ts`.
//!
//! Toute écriture métier passe par [`with_transaction`] : `BEGIN ISOLATION LEVEL …`, puis
//! les réglages de transaction que lisent les déclencheurs d'audit et les politiques
//! (`basedb.actor_kind`, `basedb.actor_id`, `basedb.surface`, `basedb.request_id`,
//! `basedb.token_id`), le travail, `COMMIT` — ou `ROLLBACK`, et une nouvelle tentative sur
//! conflit de sérialisation ou interblocage (deux par défaut).
//!
//! Pas de `SET ROLE` : l'acteur n'est connu de PostgreSQL que par ces réglages, exactement
//! comme dans Node.

use crate::db::{Conn, Exec, PoolName, Pools};
use crate::error::AppError;
use chrono::{DateTime, Duration, Utc};
use std::future::Future;
use std::sync::Arc;
use unicode_normalization::UnicodeNormalization;

/// `ActorKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActorKind {
    User,
    Token,
    System,
    Form,
    Automation,
}

impl ActorKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ActorKind::User => "user",
            ActorKind::Token => "token",
            ActorKind::System => "system",
            ActorKind::Form => "form",
            ActorKind::Automation => "automation",
        }
    }
}

/// `Surface`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Surface {
    Ui,
    Rest,
    Mcp,
    System,
}

impl Surface {
    pub fn as_str(self) -> &'static str {
        match self {
            Surface::Ui => "ui",
            Surface::Rest => "rest",
            Surface::Mcp => "mcp",
            Surface::System => "system",
        }
    }
    pub fn parse(s: &str) -> Option<Surface> {
        match s {
            "ui" => Some(Surface::Ui),
            "rest" => Some(Surface::Rest),
            "mcp" => Some(Surface::Mcp),
            "system" => Some(Surface::System),
            _ => None,
        }
    }
}

/// `Actor`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Actor {
    pub kind: ActorKind,
    pub id: String,
    pub token_id: Option<String>,
}

impl Actor {
    pub fn user(id: impl Into<String>) -> Actor {
        Actor { kind: ActorKind::User, id: id.into(), token_id: None }
    }
    pub fn token(user_id: impl Into<String>, token_id: impl Into<String>) -> Actor {
        Actor { kind: ActorKind::Token, id: user_id.into(), token_id: Some(token_id.into()) }
    }
    pub fn system() -> Actor {
        Actor { kind: ActorKind::System, id: "system".into(), token_id: None }
    }
}

/// `RequestContext` (sealed: build it with [`RequestContext::new`]).
#[derive(Debug, Clone)]
pub struct RequestContext {
    pub request_id: String,
    pub actor: Actor,
    /// The tenant's **ref** (`t4z56fq`), as Node's `tenantId`.
    pub tenant_id: String,
    pub surface: Surface,
    pub timestamp: DateTime<Utc>,
    pub deadline: DateTime<Utc>,
    pub schema_version: Option<String>,
    pub idempotency_key: Option<String>,
    pub language: String,
    pub environment: Option<String>,
}

/// `normalizeEnvironment`: NFC, trimmed, 60 characters at most, `''` → none.
pub fn normalize_environment(value: Option<&str>) -> Option<String> {
    let text: String = value?.nfc().collect::<String>().trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text.chars().take(60).collect())
    }
}

/// Node's default request budget (`openContext`): 30 seconds.
pub const DEFAULT_DEADLINE_SECONDS: i64 = 30;

impl RequestContext {
    /// `sealContext` with Node's defaults: now, deadline +30 s, language `fr`.
    pub fn new(request_id: impl Into<String>, actor: Actor, tenant_ref: impl Into<String>, surface: Surface) -> RequestContext {
        let now = Utc::now();
        RequestContext {
            request_id: request_id.into(),
            actor,
            tenant_id: tenant_ref.into(),
            surface,
            timestamp: now,
            deadline: now + Duration::seconds(DEFAULT_DEADLINE_SECONDS),
            schema_version: None,
            idempotency_key: None,
            language: "fr".into(),
            environment: None,
        }
    }

    pub fn with_environment(mut self, environment: Option<&str>) -> Self {
        self.environment = normalize_environment(environment);
        self
    }

    pub fn with_language(mut self, language: impl Into<String>) -> Self {
        self.language = language.into();
        self
    }

    pub fn with_idempotency_key(mut self, key: Option<String>) -> Self {
        self.idempotency_key = key;
        self
    }

    /// `actorKey`.
    pub fn actor_key(&self) -> String {
        match &self.actor.token_id {
            None => self.actor.id.clone(),
            Some(t) => format!("{}:{t}", self.actor.id),
        }
    }

    /// `assertDeadline`.
    pub fn assert_deadline(&self, now: DateTime<Utc>) -> Result<(), AppError> {
        if now >= self.deadline {
            return Err(AppError::new("DEADLINE_EXCEEDED")
                .with("requestId", serde_json::json!(self.request_id))
                .with("deadline", serde_json::json!(crate::time::iso(self.deadline))));
        }
        Ok(())
    }
}

/// `IsolationLevel`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Isolation {
    #[default]
    ReadCommitted,
    RepeatableRead,
    Serializable,
}

/// `TransactionOptions`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TxOptions {
    pub isolation: Isolation,
    pub read_only: bool,
    pub retries: u32,
}

impl Default for TxOptions {
    fn default() -> Self {
        TxOptions { isolation: Isolation::ReadCommitted, read_only: false, retries: 2 }
    }
}

impl TxOptions {
    pub fn read_only() -> Self {
        TxOptions { read_only: true, ..Default::default() }
    }
}

/// `BEGIN ISOLATION LEVEL …[ READ ONLY]`.
pub fn begin_statement(o: &TxOptions) -> String {
    let level = match o.isolation {
        Isolation::ReadCommitted => "READ COMMITTED",
        Isolation::RepeatableRead => "REPEATABLE READ",
        Isolation::Serializable => "SERIALIZABLE",
    };
    format!("BEGIN ISOLATION LEVEL {level}{}", if o.read_only { " READ ONLY" } else { "" })
}

/// A transaction in progress: clone it freely inside the work, run statements through
/// [`Exec`]. The transaction ends when the work returns — never commit it yourself.
#[derive(Clone)]
pub struct Tx(Arc<Conn>);

impl Exec for Tx {
    fn client(&self) -> &tokio_postgres::Client {
        &self.0
    }
}

/// `setSessionContext`.
pub async fn set_session_context<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<(), AppError> {
    let token = ctx.actor.token_id.clone().unwrap_or_default();
    exec.rows(
        "SELECT set_config('basedb.actor_kind', $1, true),
            set_config('basedb.actor_id',   $2, true),
            set_config('basedb.surface',    $3, true),
            set_config('basedb.request_id', $4, true),
            set_config('basedb.token_id',   $5, true)",
        &[&ctx.actor.kind.as_str(), &ctx.actor.id, &ctx.surface.as_str(), &ctx.request_id, &token],
    )
    .await?;
    Ok(())
}

/// Keeps an open transaction from going back to the pool when its work is abandoned
/// mid-way — the request future dropped (client gone, timeout) or a panic. Without it the
/// connection returns to the pool still inside the transaction, and the next
/// `BEGIN ISOLATION LEVEL REPEATABLE READ` on it fails with « SET TRANSACTION ISOLATION
/// LEVEL must be called before any query » (25001). Armed after `BEGIN`, [`disarm`] once
/// the transaction is closed; dropped while armed, it sends `ROLLBACK` from a spawned
/// task that holds the connection, so it rejoins the pool only once clean. With no
/// runtime to spawn on, the connection is detached from the pool and closed instead.
///
/// [`disarm`]: TxGuard::disarm
pub struct TxGuard(Option<Arc<Conn>>);

impl TxGuard {
    pub fn new(conn: Arc<Conn>) -> TxGuard {
        TxGuard(Some(conn))
    }

    /// The transaction ended (`COMMIT` or `ROLLBACK` sent): nothing to undo.
    pub fn disarm(&mut self) {
        self.0 = None;
    }
}

impl Drop for TxGuard {
    fn drop(&mut self) {
        let Some(conn) = self.0.take() else { return };
        match tokio::runtime::Handle::try_current() {
            Ok(handle) => {
                handle.spawn(async move {
                    if conn.batch_execute("ROLLBACK").await.is_err() {
                        if let Ok(object) = Arc::try_unwrap(conn) {
                            let _ = deadpool_postgres::Object::take(object);
                        }
                    }
                });
            }
            Err(_) => {
                if let Ok(object) = Arc::try_unwrap(conn) {
                    let _ = deadpool_postgres::Object::take(object);
                }
            }
        }
    }
}

/// `withTransaction(pools, pool, ctx, work, options)`.
///
/// ```ignore
/// let id: String = with_transaction(&st.pools, PoolName::Data, &ctx, TxOptions::default(), |tx| async move {
///     let row = tx.first("INSERT … RETURNING id::text", &[]).await?.unwrap();
///     Ok(row.get(0))
/// }).await?;
/// ```
pub async fn with_transaction<T, F, Fut>(pools: &Pools, pool: PoolName, ctx: &RequestContext, options: TxOptions, mut work: F) -> Result<T, AppError>
where
    F: FnMut(Tx) -> Fut,
    Fut: Future<Output = Result<T, AppError>>,
{
    let attempts = options.retries + 1;
    let mut attempt = 0;
    loop {
        attempt += 1;
        let conn = pools.get(pool).await?;
        let tx = Tx(Arc::new(conn));
        let mut guard = TxGuard::new(tx.0.clone());
        let outcome: Result<T, AppError> = async {
            tx.execute_op(&begin_statement(&options), &[], crate::error::SqlOp::Select).await?;
            set_session_context(&tx, ctx).await?;
            let result = work(tx.clone()).await?;
            tx.execute_op("COMMIT", &[], crate::error::SqlOp::Select).await?;
            Ok(result)
        }
        .await;
        match outcome {
            Ok(v) => {
                guard.disarm();
                return Ok(v);
            }
            Err(e) => {
                let _ = tx.client().batch_execute("ROLLBACK").await;
                guard.disarm();
                if !e.retryable() || attempt >= attempts {
                    return Err(e);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn environment_is_normalized() {
        assert_eq!(normalize_environment(Some("  ")), None);
        assert_eq!(normalize_environment(None), None);
        assert_eq!(normalize_environment(Some(" prod ")).as_deref(), Some("prod"));
        assert_eq!(normalize_environment(Some(&"é".repeat(70))).map(|s| s.chars().count()), Some(60));
        assert_eq!(normalize_environment(Some("e\u{301}")).as_deref(), Some("é"));
    }

    #[test]
    fn begin_is_node_s() {
        assert_eq!(begin_statement(&TxOptions::default()), "BEGIN ISOLATION LEVEL READ COMMITTED");
        assert_eq!(
            begin_statement(&TxOptions { isolation: Isolation::Serializable, read_only: true, retries: 0 }),
            "BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY"
        );
    }

    #[test]
    fn actor_key_includes_the_token() {
        let ctx = RequestContext::new("r", Actor::token("u", "t"), "t4z56fq", Surface::Rest);
        assert_eq!(ctx.actor_key(), "u:t");
        assert!(ctx.assert_deadline(ctx.deadline).is_err());
        assert!(ctx.assert_deadline(ctx.timestamp).is_ok());
    }
}
