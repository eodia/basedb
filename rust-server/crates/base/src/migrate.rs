//! Les migrations du catalogue `_basedb` — chapitre 02, « Amorçage », telles
//! `runtime/catalog-migrations.ts` et `@basedb/catalog-schema`.
//!
//! Chaque `NNNN_nom.sql` de `packages/catalog-schema/migrations` s'applique une fois, dans
//! l'ordre, dans sa transaction, et s'inscrit dans `_basedb.catalog_migration` avec la
//! somme SHA-256 de son texte (fins de ligne ramenées à LF). Avant tout, l'inscrit est
//! confronté au livré : somme différente → `CATALOG_CHECKSUM_MISMATCH`, version inconnue →
//! `CATALOG_VERSION_AHEAD`, trou ou registre absent → `CATALOG_DRIFT`.
//!
//! Le tout tient sur une connexion DÉDIÉE (`basedb:catalog`, `lock_timeout=3s`,
//! `statement_timeout=60s`) qui détient le verrou consultatif de session (1, 1) : deux
//! processus qui démarrent ensemble ne migrent jamais en même temps.
//!
//! Les migrations sont EMBARQUÉES dans le binaire (`build.rs`) : l'image n'a pas besoin du
//! dossier. `CATALOG_MIGRATIONS_DIR` en lit un autre (développement, tests). Ce qui suit la
//! migration (codes d'erreur, partitions des journaux, plans interrompus) : `basedb-server`.

use crate::db::pg_config;
use crate::error::AppError;
use crate::time::{hex, sha256};
use serde_json::json;
use std::path::Path;
use std::time::{Duration, Instant};
use tokio_postgres::{Client, NoTls};

/// The version of basedb this binary is (the workspace's `version`): what `app_release`
/// records, what `pnpm catalog seal` and the image's publication check against.
pub const APPLICATION_VERSION: &str = env!("CARGO_PKG_VERSION");

mod embedded {
    include!(concat!(env!("OUT_DIR"), "/embedded_migrations.rs"));
}
const LOCK_WAIT: Duration = Duration::from_secs(5 * 60);
const APPLY_TRIES: u32 = 3;
const ADOPTED_RELEASE: &str = "antérieure à 0.2.0";

/// One shipped migration (`CatalogMigration`).
#[derive(Debug, Clone)]
pub struct CatalogMigration {
    pub version: i32,
    pub name: String,
    pub sql: String,
    pub checksum: Vec<u8>,
}

/// `checksumOf`: SHA-256 of the text, CRLF brought to LF.
pub fn checksum_of(sql: &str) -> Vec<u8> {
    sha256(sql.replace("\r\n", "\n").as_bytes())
}

/// `catalogMigrations`: the directory's migrations, in order, numbered without a gap.
pub fn catalog_migrations(dir: &Path) -> Result<Vec<CatalogMigration>, String> {
    let files = std::fs::read_dir(dir)
        .map_err(|e| format!("Migrations de catalogue introuvables ({}) : {e}", dir.display()))?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".sql"))
        .map(|name| std::fs::read_to_string(dir.join(&name)).map(|sql| (name.clone(), sql)).map_err(|e| format!("{name} : {e}")))
        .collect::<Result<Vec<_>, _>>()?;
    ordered(files)
}

/// The migrations built into this binary.
pub fn embedded_migrations() -> Vec<CatalogMigration> {
    let files = embedded::EMBEDDED.iter().filter(|(n, _)| n.ends_with(".sql")).map(|(n, sql)| (n.to_string(), sql.to_string())).collect();
    ordered(files).expect("migrations embarquées")
}

/// The shipped migrations: a directory's (`CATALOG_MIGRATIONS_DIR`), else the embedded ones.
pub fn shipped_migrations(dir: Option<&Path>) -> Result<Vec<CatalogMigration>, String> {
    match dir {
        Some(dir) => catalog_migrations(dir),
        None => Ok(embedded_migrations()),
    }
}

fn ordered(mut files: Vec<(String, String)>) -> Result<Vec<CatalogMigration>, String> {
    files.sort_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
    let pattern = regex::Regex::new(r"^(\d{4})_[a-z0-9_]+\.sql$").unwrap();
    files
        .into_iter()
        .enumerate()
        .map(|(index, (name, sql))| {
            let Some(m) = pattern.captures(&name) else {
                return Err(format!("Migration de catalogue mal nommée : {name} (attendu NNNN_nom.sql)."));
            };
            let version: i32 = m[1].parse().unwrap();
            if version != index as i32 + 1 {
                return Err(format!("Migrations de catalogue non consécutives : {name} devrait porter le numéro {}.", index + 1));
            }
            Ok(CatalogMigration { version, checksum: checksum_of(&sql), name, sql })
        })
        .collect()
}

/// `CatalogState`.
#[derive(Debug, Clone, PartialEq)]
pub struct CatalogState {
    pub applied: usize,
    pub shipped: usize,
    pub pending: Vec<String>,
}

#[derive(Debug, Clone)]
struct Recorded {
    version: i32,
    name: String,
    checksum: Vec<u8>,
}

async fn connect(database_url: &str) -> Result<Client, AppError> {
    let config = pg_config(database_url, "basedb:catalog", &[("lock_timeout", "3s".into()), ("statement_timeout", "60s".into())]).map_err(AppError::internal)?;
    let (client, connection) = config.connect(NoTls).await.map_err(|e| AppError::new("SERVICE_UNAVAILABLE").caused_by(e))?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    Ok(client)
}

fn pg(e: tokio_postgres::Error) -> AppError {
    AppError::internal(e)
}

async fn recorded(client: &Client) -> Result<Option<Vec<Recorded>>, AppError> {
    let state = client
        .query_one(
            "SELECT to_regnamespace('_basedb') IS NOT NULL AS catalog,
                    to_regclass('_basedb.catalog_migration') IS NOT NULL AS ledger",
            &[],
        )
        .await
        .map_err(pg)?;
    if !state.get::<_, bool>(0) {
        return Ok(None);
    }
    if !state.get::<_, bool>(1) {
        return Err(AppError::new("CATALOG_DRIFT").with("missing", json!("_basedb.catalog_migration")));
    }
    let rows = client.query("SELECT version, name, checksum FROM _basedb.catalog_migration ORDER BY version", &[]).await.map_err(pg)?;
    Ok(Some(rows.iter().map(|r| Recorded { version: r.get(0), name: r.get(1), checksum: r.get(2) }).collect()))
}

fn compare<'a>(rows: &[Recorded], shipped: &'a [CatalogMigration]) -> Result<&'a [CatalogMigration], AppError> {
    for (index, row) in rows.iter().enumerate() {
        let Some(migration) = usize::try_from(row.version - 1).ok().and_then(|i| shipped.get(i)) else {
            return Err(AppError::new("CATALOG_VERSION_AHEAD")
                .with("recorded", json!(row.version))
                .with("shipped", json!(shipped.len()))
                .with("name", json!(row.name)));
        };
        if row.version != index as i32 + 1 {
            return Err(AppError::new("CATALOG_DRIFT").with("missing_version", json!(index + 1)));
        }
        if row.checksum != migration.checksum {
            return Err(AppError::new("CATALOG_CHECKSUM_MISMATCH").with("version", json!(row.version)).with("name", json!(row.name)));
        }
    }
    Ok(&shipped[rows.len().min(shipped.len())..])
}

fn adopted(shipped: &[CatalogMigration]) -> Vec<Recorded> {
    shipped.first().map(|f| vec![Recorded { version: f.version, name: f.name.clone(), checksum: f.checksum.clone() }]).unwrap_or_default()
}

/// `inspectCatalog`: where the catalog stands, checked, nothing applied.
pub async fn inspect_catalog(database_url: &str, shipped: &[CatalogMigration]) -> Result<CatalogState, AppError> {
    let client = connect(database_url).await?;
    let rows = recorded(&client).await?;
    let effective = match rows {
        Some(r) if r.is_empty() => adopted(shipped),
        Some(r) => r,
        None => vec![],
    };
    let pending = compare(&effective, shipped)?;
    Ok(CatalogState { applied: effective.len(), shipped: shipped.len(), pending: pending.iter().map(|m| m.name.clone()).collect() })
}

/// `migrateCatalog`: brings the catalog to the shipped version; the names applied.
pub async fn migrate_catalog(database_url: &str, release: &str, shipped: &[CatalogMigration]) -> Result<Vec<String>, AppError> {
    migrate_catalog_waiting(database_url, release, shipped, LOCK_WAIT).await
}

/// [`migrate_catalog`], giving up with `LOCK_UNAVAILABLE` after `lock_wait` behind another process.
pub async fn migrate_catalog_waiting(database_url: &str, release: &str, shipped: &[CatalogMigration], lock_wait: Duration) -> Result<Vec<String>, AppError> {
    let client = connect(database_url).await?;
    let deadline = Instant::now() + lock_wait;
    let mut waiting = false;
    loop {
        let taken: bool = client.query_one("SELECT pg_try_advisory_lock(1, 1) AS taken", &[]).await.map_err(pg)?.get(0);
        if taken {
            break;
        }
        if Instant::now() >= deadline {
            return Err(AppError::new("LOCK_UNAVAILABLE").with("lock", json!("catalog_migration")));
        }
        if !waiting {
            println!("Catalogue : un autre processus le met à jour, attente…");
            waiting = true;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    let result = apply(&client, release, shipped).await;
    let _ = client.query("SELECT pg_advisory_unlock(1, 1)", &[]).await;
    result
}

async fn apply(client: &Client, release: &str, shipped: &[CatalogMigration]) -> Result<Vec<String>, AppError> {
    const RECORD: &str = "INSERT INTO _basedb.catalog_migration (version, name, checksum, app_release, duration_ms) VALUES ($1, $2, $3, $4, $5)";
    let rows = recorded(client).await?;
    if rows.as_ref().is_some_and(|r| r.is_empty()) {
        if let Some(first) = adopted(shipped).first() {
            client.execute(RECORD, &[&first.version, &first.name, &first.checksum, &ADOPTED_RELEASE, &0i32]).await.map_err(pg)?;
        }
    }
    let rows = if rows.is_none() { vec![] } else { recorded(client).await?.unwrap_or_default() };
    let pending = compare(&rows, shipped)?;
    let mut applied = Vec::new();
    for migration in pending {
        let started = Instant::now();
        let mut attempt = 1;
        loop {
            let outcome = async {
                client.batch_execute("BEGIN").await?;
                client.batch_execute(&migration.sql).await?;
                let ms = started.elapsed().as_millis() as i32;
                client.execute(RECORD, &[&migration.version, &migration.name, &migration.checksum, &release, &ms]).await?;
                client.batch_execute("COMMIT").await
            }
            .await;
            match outcome {
                Ok(()) => break,
                Err(e) => {
                    let _ = client.batch_execute("ROLLBACK").await;
                    let lock_timed_out = e.code().is_some_and(|c| c.code() == "55P03");
                    if lock_timed_out && attempt < APPLY_TRIES {
                        tokio::time::sleep(Duration::from_secs(attempt as u64)).await;
                        attempt += 1;
                        continue;
                    }
                    let message = e.as_db_error().map(|d| d.message().to_string()).unwrap_or_else(|| e.to_string());
                    return Err(AppError::internal(format!("Migration de catalogue {} : {message}", migration.name)));
                }
            }
        }
        println!("Catalogue : {} appliquée ({} ms).", migration.name, started.elapsed().as_millis());
        applied.push(migration.name.clone());
    }
    Ok(applied)
}

/// The monthly partitions of a journal (`ai_call`, `audit_log`, `security_log`, declared
/// `PARTITION BY RANGE (occurred_at)` and shipped with none): this month and the next two, UTC.
pub fn partition_statements(journal: &str, now: chrono::DateTime<chrono::Utc>) -> Vec<String> {
    use chrono::{Datelike, TimeZone};
    let month = |offset: i32| {
        let index = now.year() * 12 + now.month0() as i32 + offset;
        chrono::Utc.with_ymd_and_hms(index.div_euclid(12), index.rem_euclid(12) as u32 + 1, 1, 0, 0, 0).unwrap()
    };
    (0..=2)
        .map(|offset| {
            let (from, to) = (month(offset), month(offset + 1));
            format!(
                "CREATE TABLE IF NOT EXISTS _basedb.{journal}_{}
               PARTITION OF _basedb.{journal}
               FOR VALUES FROM ('{}') TO ('{}')",
                from.format("%Y_%m"),
                from.format("%Y-%m-%dT%H:%M:%S%.3fZ"),
                to.format("%Y-%m-%dT%H:%M:%S%.3fZ")
            )
        })
        .collect()
}

/// `ensureJournalPartitions`: the journals' coming months, on the `ddl` pool.
pub async fn ensure_journal_partitions(st: &crate::AppState, journals: &[&str], now: chrono::DateTime<chrono::Utc>) -> Result<(), AppError> {
    use crate::db::{Exec, PoolName};
    let conn = st.pools.get(PoolName::Ddl).await?;
    for journal in journals {
        for sql in partition_statements(journal, now) {
            conn.execute_op(&sql, &[], crate::error::SqlOp::Ddl).await?;
        }
    }
    Ok(())
}

/// `catalogRefusal` of `server.ts`: why the start stops.
pub fn refusal(e: &AppError) -> String {
    let d = |k: &str| e.details.get(k).map(|v| match v {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string(),
    }).unwrap_or_else(|| "undefined".into());
    match e.code {
        "CATALOG_VERSION_AHEAD" => format!("Cette base a été mise à jour par une version plus récente de basedb (catalogue en version {}, ce code s’arrête à la {}) : démarrez une version au moins aussi récente. Le retour arrière d’un catalogue n’existe pas — restaurez la sauvegarde d’avant la mise à jour pour revenir en arrière.", d("recorded"), d("shipped")),
        "CATALOG_CHECKSUM_MISMATCH" => format!("La migration de catalogue {} enregistrée dans cette base n’est pas celle de ce code : la base ou le code a été modifié. Arrêt, pour ne rien écrire dans un catalogue dont l’histoire est inconnue.", d("name")),
        "CATALOG_DRIFT" => format!("Le schéma _basedb de cette base n’est pas un catalogue basedb reconnu ({}).", serde_json::Value::Object(e.details.clone())),
        "LOCK_UNAVAILABLE" => "Un autre processus met le catalogue à jour depuis plus de cinq minutes : vérifiez-le (pg_locks, verrou consultatif 1, 1), puis redémarrez.".into(),
        _ => format!("Mise à jour du catalogue impossible : {}", e.cause.clone().unwrap_or_else(|| e.code.to_string())),
    }
}

/// A sealed (published) migration of `migrations/sealed.json`.
#[derive(Debug, Clone, PartialEq)]
pub struct Sealed {
    pub version: i32,
    pub name: String,
    pub sha256: String,
    /// The basedb version that published it.
    pub release: String,
}

fn parse_sealed(text: &str) -> Result<Vec<Sealed>, String> {
    let v: serde_json::Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
    Ok(v.as_array()
        .map(|a| {
            a.iter()
                .map(|m| Sealed {
                    version: m["version"].as_i64().unwrap_or(0) as i32,
                    name: m["name"].as_str().unwrap_or("").to_string(),
                    sha256: m["sha256"].as_str().unwrap_or("").to_string(),
                    release: m["release"].as_str().unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default())
}

/// The sealed migrations: a directory's `sealed.json`, else the embedded one.
pub fn sealed(dir: Option<&Path>) -> Result<Vec<Sealed>, String> {
    match dir {
        Some(dir) => parse_sealed(&std::fs::read_to_string(dir.join("sealed.json")).map_err(|e| e.to_string())?),
        None => parse_sealed(embedded::EMBEDDED.iter().find(|(n, _)| *n == "sealed.json").map(|(_, t)| *t).unwrap_or("[]")),
    }
}

/// True when every sealed migration still has its published text.
pub fn check_sealed(dir: Option<&Path>, shipped: &[CatalogMigration]) -> Result<(), String> {
    for Sealed { version, name, sha256: sum, .. } in sealed(dir)? {
        let Some(m) = shipped.iter().find(|m| m.version == version) else { return Err(format!("{name} scellée mais absente")) };
        if hex(&m.checksum) != sum {
            return Err(format!("{name} scellée a changé"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn repo() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("..").join("..")
    }

    #[test]
    fn shipped_migrations_load_and_match_their_seals() {
        let dir = repo().join("packages").join("catalog-schema").join("migrations");
        let shipped = catalog_migrations(&dir).unwrap();
        assert!(shipped.len() >= 24);
        assert_eq!(shipped[0].name, "0001_catalogue.sql");
        check_sealed(Some(&dir), &shipped).unwrap();
        assert_eq!(checksum_of("a\r\nb"), checksum_of("a\nb"));
        let embedded = embedded_migrations();
        assert_eq!(embedded.iter().map(|m| (&m.name, &m.checksum)).collect::<Vec<_>>(), shipped.iter().map(|m| (&m.name, &m.checksum)).collect::<Vec<_>>());
        assert_eq!(sealed(None).unwrap(), sealed(Some(&dir)).unwrap());
        check_sealed(None, &embedded).unwrap();
    }

    #[test]
    fn application_version_is_at_least_the_last_seal() {
        let parse = |v: &str| v.split('.').map(|p| p.parse::<u32>().unwrap_or(0)).collect::<Vec<_>>();
        let last = sealed(None).unwrap().last().map(|s| s.release.clone()).unwrap();
        assert!(parse(APPLICATION_VERSION) >= parse(&last), "{APPLICATION_VERSION} < {last}");
    }

    fn rec(version: i32, sum: &[u8]) -> Recorded {
        Recorded { version, name: format!("{version:04}_x.sql"), checksum: sum.to_vec() }
    }

    #[test]
    fn compare_refuses_like_node() {
        let shipped: Vec<CatalogMigration> = (1..=3).map(|v| CatalogMigration { version: v, name: format!("{v:04}_x.sql"), sql: String::new(), checksum: vec![v as u8] }).collect();
        assert_eq!(compare(&[rec(1, &[1])], &shipped).unwrap().len(), 2);
        assert_eq!(compare(&[rec(1, &[9])], &shipped).unwrap_err().code, "CATALOG_CHECKSUM_MISMATCH");
        assert_eq!(compare(&[rec(4, &[4])], &shipped).unwrap_err().code, "CATALOG_VERSION_AHEAD");
        assert_eq!(compare(&[rec(2, &[2])], &shipped).unwrap_err().code, "CATALOG_DRIFT");
    }
}
