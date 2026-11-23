//! `basedb-base` — le socle du serveur Rust de basedb.
//!
//! Tout ce dont un crate de domaine a besoin, et rien de métier. La colonne « équivalent Node »
//! désigne le code TypeScript d'avant la bascule (`packages/core`, `apps/api`), dans l'historique
//! git :
//!
//! | module | rôle | équivalent Node |
//! |---|---|---|
//! | [`config`] | variables d'environnement, `.env` | `server.ts`, `files/environment.ts` |
//! | [`db`] | pools `catalog`/`data`/`ddl`, contrat de connexion, [`db::Exec`] | `runtime/pool.ts` |
//! | [`tx`] | contexte de requête, [`tx::with_transaction`] | `tx/` |
//! | [`error`] | [`error::AppError`], traduction SQLSTATE, corps HTTP | `errors/`, `app.onError` |
//! | [`layers`] | CORS, `x-request-id`, démo | `createApp` |
//! | [`auth`] | mots de passe, sessions, jetons, `/auth/*` | `auth/`, app.ts |
//! | [`rbac`] | décision, chargement, `require*` | `rbac/` |
//! | [`audit`], [`idempotency`] | journal d'audit, clés d'idempotence | `audit/`, `agent/idempotency.ts` |
//! | [`migrate`] | migrations du catalogue | `runtime/catalog-migrations.ts` |
//! | [`mailer`], [`listener`] | SMTP, LISTEN/NOTIFY | `mail/`, `runtime/listener.ts` |
//! | [`testing`] | application de test sur la base de développement | — |

#![allow(clippy::result_large_err)]

pub mod app;
pub mod audit;
pub mod auth;
pub mod config;
pub mod db;
pub mod demo;
pub mod error;
pub mod idempotency;
pub mod layers;
pub mod listener;
pub mod mailer;
pub mod migrate;
pub mod rate_limit;
pub mod rbac;
pub mod state;
pub mod testing;
pub mod time;
pub mod tx;

pub use error::{ApiResult, AppError};
pub use layers::RequestId;
pub use state::{AppState, Shared};
