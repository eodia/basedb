//! What `server.ts` and `kernel.migrateCatalog` did around the routes: the error-code
//! registry, the journals' partitions, the stale migration leases, the first administrator
//! (`BASEDB_BOOTSTRAP=1`), the container's health probe and the stop signals.

use basedb_base::db::Exec;
use basedb_base::error::{AppError, SqlOp};
use basedb_base::{migrate, AppState, Shared};
use std::time::Duration;

/// `levelOf`: the class of a code, by its HTTP status.
pub fn level_of(status: Option<u16>) -> &'static str {
    match status {
        None => "incident",
        Some(401 | 403) => "permission",
        Some(409 | 412 | 423 | 428) => "conflict",
        Some(s) if s >= 500 => "incident",
        Some(_) => "validation",
    }
}

/// `seedErrorCodes`: the registry projected into `_basedb.error_code` — `migration.error_code`
/// references it. Codes are added, never renamed: the upsert only grows the table.
pub async fn seed_error_codes(st: &AppState) -> Result<(), AppError> {
    let conn = st.pools.catalog().await?;
    for entry in basedb_contracts::ERROR_CODES {
        let status = entry.http_status.map(|s| s as i16);
        conn.execute_op(
            "INSERT INTO _basedb.error_code (code, origin, level, http_status, description)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (code) DO UPDATE
               SET origin = EXCLUDED.origin, level = EXCLUDED.level,
                   http_status = EXCLUDED.http_status, description = EXCLUDED.description",
            &[&entry.code, &entry.chapter, &level_of(entry.http_status), &status, &entry.condition],
            SqlOp::Insert,
        )
        .await?;
    }
    Ok(())
}

/// `reclaimStaleMigrations`: a plan whose lease expired while a process was down becomes
/// `interrupted` — never replayed on its own (chapter 06 §1.3).
pub async fn reclaim_stale_migrations(st: &AppState) -> Result<usize, AppError> {
    let conn = st.pools.catalog().await?;
    let rows = conn
        .query_op(
            "UPDATE _basedb.migration
                SET status = 'interrupted', executor_id = NULL, lease_until = NULL
              WHERE status = 'applying' AND lease_until < clock_timestamp()
              RETURNING id",
            &[],
            SqlOp::Update,
        )
        .await?;
    Ok(rows.len())
}

const JOURNALS: [&str; 3] = ["ai_call", "audit_log", "security_log"];

/// What follows a migration, idempotent, at every start with `BASEDB_MIGRATE=1`.
pub async fn after_migration(st: &AppState) -> Result<(), AppError> {
    seed_error_codes(st).await?;
    migrate::ensure_journal_partitions(st, &JOURNALS, chrono::Utc::now()).await?;
    reclaim_stale_migrations(st).await?;
    Ok(())
}

/// The audit and security journals' coming months, once a day — a process that runs past the
/// end of the third month would otherwise write into a month without a partition. The AI
/// worker keeps `ai_call`'s.
pub fn start_partitions(st: &Shared) -> Option<tokio::task::JoinHandle<()>> {
    if !st.cfg.background() {
        return None;
    }
    let st = st.clone();
    Some(tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(24 * 3600));
        tick.tick().await;
        loop {
            tick.tick().await;
            if let Err(e) = migrate::ensure_journal_partitions(&st, &JOURNALS[1..], chrono::Utc::now()).await {
                eprintln!("Partitions des journaux : {}", e.code);
            }
        }
    }))
}

/// `BASEDB_BOOTSTRAP=1`, as `server.ts`: the first administrator, its password given (and
/// reapplied at every start) or generated and printed once. Returns the address the
/// development login publishes — only by the start that has just created the instance.
pub async fn bootstrap(st: &Shared) -> Result<Option<String>, String> {
    if !st.cfg.bootstrap {
        return Ok(None);
    }
    let tenant_ref = st.cfg.auth_tenant().to_string();
    let email = st.cfg.admin_email.clone();
    let given = st.cfg.admin_password.clone();
    let refusal = |e: AppError| format!("Amorçage impossible : {} {:?}", e.code, e.details);
    if email.is_none() && basedb_admin::signup::bootstrap_is_open(st).await.map_err(refusal)? {
        println!("Aucun administrateur : la première personne qui ouvre l’interface le crée. Ouvrez-la avant de publier l’instance sur un domaine.");
        return Ok(None);
    }
    if email.is_none() && given.is_none() {
        return Ok(None);
    }
    let found = match basedb_admin::signup::bootstrap_instance(st, &tenant_ref, email.as_deref()).await {
        Ok(found) => found,
        Err(e) if email.is_some() => return Err(refusal(e)),
        Err(_) => {
            eprintln!("BASEDB_ADMIN_PASSWORD ignoré : aucun administrateur dans le tenant {tenant_ref}.");
            return Ok(None);
        }
    };
    let password = given.clone().unwrap_or_else(|| format!("basedb-{}", basedb_base::time::b64url(&basedb_base::time::random_bytes(9))));
    if !found.already_done || given.is_some() {
        let key = st.instance_key().map_err(refusal)?;
        basedb_base::auth::operations::set_password(&st.pools, key, &found.user_id, &password).await.map_err(refusal)?;
    }
    println!("{} — {}", if found.already_done { "Bootstrap already done" } else { "Bootstrapped" }, found.email);
    if given.is_none() && !found.already_done {
        println!("Mot de passe administrateur (affiché une seule fois) : {password}");
    }
    Ok((!found.already_done && st.cfg.dev_login).then_some(found.email))
}

/// `basedb-server healthcheck`: the container's probe, without curl nor Node — `GET /healthz`
/// on this machine's port (`PORT`, 8787 by default), 200 or exit 1.
pub fn healthcheck() -> ! {
    use std::io::{Read, Write};
    let port = std::env::var("PORT").ok().and_then(|p| p.trim().parse::<u16>().ok()).unwrap_or(8787);
    let probe = || -> std::io::Result<bool> {
        let address = std::net::SocketAddr::from(([127, 0, 0, 1], port));
        let mut tcp = std::net::TcpStream::connect_timeout(&address, Duration::from_secs(3))?;
        tcp.set_read_timeout(Some(Duration::from_secs(3)))?;
        tcp.write_all(format!("GET /healthz HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").as_bytes())?;
        let mut head = [0u8; 12];
        tcp.read_exact(&mut head)?;
        Ok(head.starts_with(b"HTTP/1.1 200") || head.starts_with(b"HTTP/1.0 200"))
    };
    match probe() {
        Ok(true) => std::process::exit(0),
        _ => std::process::exit(1),
    }
}

/// `basedb-server create-database <url> <admin-url>`: the database of `url` created through
/// `admin-url` when missing (needs the CREATEDB right) — insights' catalog beside basedb's, in
/// the image that carries both (docker/image/start.mjs). Waits a minute for the server.
pub async fn create_database(url: &str, admin: &str) -> Result<bool, String> {
    use tokio_postgres::error::SqlState;
    let target: tokio_postgres::Config = url.parse().map_err(|e| format!("{url} : {e}"))?;
    let name = target.get_dbname().ok_or("l'adresse ne nomme pas de base")?.to_string();
    let until = std::time::Instant::now() + Duration::from_secs(60);
    loop {
        match target.connect(tokio_postgres::NoTls).await {
            Ok(_) => return Ok(false),
            Err(e) if e.code() == Some(&SqlState::INVALID_CATALOG_NAME) => break,
            Err(e) if std::time::Instant::now() > until => return Err(e.to_string()),
            Err(_) => tokio::time::sleep(Duration::from_secs(1)).await,
        }
    }
    let (client, connection) = tokio_postgres::connect(admin, tokio_postgres::NoTls).await.map_err(|e| e.to_string())?;
    tokio::spawn(connection);
    match client.batch_execute(&format!("CREATE DATABASE \"{}\"", name.replace('"', "\"\""))).await {
        Ok(()) => Ok(true),
        // Created meanwhile, by another container starting.
        Err(e) if e.code() == Some(&SqlState::DUPLICATE_DATABASE) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Ctrl+C, or `SIGTERM` (what `docker stop` sends): the server stops taking connections and
/// lets the ones in flight finish.
pub async fn stop_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let term = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut s) => {
                s.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = term => {},
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_follow_the_status() {
        assert_eq!(level_of(None), "incident");
        assert_eq!(level_of(Some(403)), "permission");
        assert_eq!(level_of(Some(428)), "conflict");
        assert_eq!(level_of(Some(503)), "incident");
        assert_eq!(level_of(Some(422)), "validation");
    }
}
