//! The domain's background tasks (`startBackground` of the former Node kernel, its admin
//! part): the mail queue every five seconds, its purge and the collaboration's (notifications
//! past their retention, stale presence) every ten minutes, basedb's source in insights and
//! the synced tables due every minute.
//!
//! Started by `basedb-server` unless `BASEDB_RUST_BACKGROUND=0`. Two servers on the same
//! database harm nothing — a mail is taken under a lease (`FOR UPDATE SKIP LOCKED`), the purges
//! and the source are idempotent, the grants made under the same advisory lock
//! (`basedb.reader-grants`) — but a person's notifications due at the same moment could then
//! leave as two mails instead of one.

use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::Shared;
use std::time::Duration;

pub const MAIL_INTERVAL: Duration = Duration::from_secs(5);
pub const PURGE_INTERVAL: Duration = Duration::from_secs(600);
pub const INSIGHTS_INTERVAL: Duration = Duration::from_secs(60);
pub const SYNC_INTERVAL: Duration = Duration::from_secs(60);

/// Notifications are kept three months (`NOTIFICATION_RETENTION_DAYS`).
pub const NOTIFICATION_RETENTION_DAYS: f64 = 90.0;

/// Whether this server runs the background tasks (unless `BASEDB_RUST_BACKGROUND=0`).
pub fn enabled(st: &Shared) -> bool {
    st.cfg.background()
}

/// `purgeCollaboration`: notifications past their retention, presence nobody refreshed.
pub async fn purge_collaboration(st: &Shared) -> Result<(), AppError> {
    let exec = st.pools.get(PoolName::Catalog).await?;
    exec.query_op(
        "DELETE FROM _basedb.notification
          WHERE created_at < pg_catalog.clock_timestamp() - make_interval(days => $1)",
        &[&NOTIFICATION_RETENTION_DAYS],
        SqlOp::Delete,
    )
    .await?;
    exec.query_op("DELETE FROM _basedb.presence WHERE seen_at < pg_catalog.clock_timestamp() - interval '5 minutes'", &[], SqlOp::Delete).await?;
    Ok(())
}

/// Starts the loops; returns their handles (empty when disabled).
pub fn start_background(st: &Shared) -> Vec<tokio::task::JoinHandle<()>> {
    if !enabled(st) {
        return Vec::new();
    }
    let mut handles = Vec::new();
    let mail = st.clone();
    handles.push(tokio::spawn(async move {
        let mut ticker = tokio::time::interval(MAIL_INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            ticker.tick().await;
            if let Err(e) = crate::outbox::deliver_mails(&mail).await {
                eprintln!("envoi des courriels : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    }));
    let purge = st.clone();
    handles.push(tokio::spawn(async move {
        let mut ticker = tokio::time::interval(PURGE_INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            ticker.tick().await;
            if let Err(e) = purge_collaboration(&purge).await {
                eprintln!("purge : {} {}", e.code, e.cause.unwrap_or_default());
            }
            if let Err(e) = crate::outbox::purge_mails(&purge).await {
                eprintln!("purge des courriels : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    }));
    if let Some(h) = crate::insights_source::start_insights_source(st.clone(), INSIGHTS_INTERVAL) {
        handles.push(h);
    }
    // The synced tables due, every minute (chapter 19 §3.3); one pass at a time.
    let sync = st.clone();
    handles.push(tokio::spawn(async move {
        let mut ticker = tokio::time::interval(SYNC_INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            ticker.tick().await;
            if let Err(e) = crate::synced::sync_due(&sync).await {
                eprintln!("synchronisation : {} {}", e.code, e.cause.unwrap_or_default());
            }
        }
    }));
    println!("Tâches de fond de l'administration lancées (courriels, purge, source insights, tables synchronisées).");
    handles
}
