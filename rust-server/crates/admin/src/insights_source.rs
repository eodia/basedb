//! `insights/embedded.ts` (`insightsSource`, `startInsightsSource`, `connectionOf`) and the
//! part of `sql/reader.ts` it needs (`ensureLoginRole`, `GRANTS_LOCK`): basedb's bases set as
//! a source of insights — where Trino reaches the database, and the service role that lists
//! their structure and reads nothing.

use crate::insights::{call, service_token};
use basedb_base::config::InsightsConfig;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::SqlOp;
use basedb_base::error::AppError;
use basedb_base::time::hmac_sha256;
use basedb_base::tx::{with_transaction, Actor, ActorKind, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_contracts::naming::quote::{quote_identifier, quote_literal};
use serde_json::{json, Value};
use std::time::Duration;

pub const SERVICE_ROLE: &str = "basedb_insights";
pub const INSIGHTS_CATALOG: &str = "basedb";
pub const GRANTS_LOCK: &str = "SELECT pg_advisory_xact_lock(hashtext('basedb.reader-grants'))";
const SYSTEM: &str = "00000000-0000-0000-0000-000000000000";
const LOGIN_ATTRIBUTES: &str = "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION";

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// `servicePasswordOf`: derived from the instance key, nothing to store.
pub fn service_password_of(instance_key: &str) -> String {
    hex(&hmac_sha256(instance_key.as_bytes(), &[b"basedb/insights-service/v1"]))
}

fn ident(name: &str) -> Result<String, AppError> {
    quote_identifier(name).map_err(|e| AppError::new("IDENTIFIER_INVALID").with("identifier", json!(e.0)))
}

/// `ensureLoginRole`: the LOGIN role exists with `password` — reset when asked, or when made.
/// Says whether it was made or reset. Run by the OWNER, under [`GRANTS_LOCK`].
pub async fn ensure_login_role<E: Exec + Sync>(exec: &E, role: &str, password: &str, reset_password: bool) -> Result<bool, AppError> {
    let known = exec.first("SELECT oid::text AS oid FROM pg_roles WHERE rolname = $1", &[&role]).await?;
    if known.is_none() {
        exec.query_op(&format!("CREATE ROLE {} {LOGIN_ATTRIBUTES} PASSWORD {}", ident(role)?, quote_literal(password)), &[], SqlOp::Ddl).await?;
        return Ok(true);
    }
    if reset_password {
        exec.query_op(&format!("ALTER ROLE {} WITH {LOGIN_ATTRIBUTES} PASSWORD {}", ident(role)?, quote_literal(password)), &[], SqlOp::Ddl).await?;
        return Ok(true);
    }
    Ok(false)
}

/// `connectionOf`: host, port, database and TLS of the address Trino reaches the database
/// at — `BASEDB_INSIGHTS_DATABASE_URL`, else `DATABASE_URL` without its credentials.
pub fn connection_of(database_url: Option<&str>, connection_string: &str) -> Result<Value, AppError> {
    let parse = |u: &str| url::Url::parse(u).map_err(|e| AppError::internal(format!("Invalid URL: {e}")));
    let own = parse(connection_string)?;
    let url = match database_url {
        None => own.clone(),
        Some(u) => parse(u)?,
    };
    let decode = |s: &str| percent_decode(s);
    let name_of = |u: &url::Url| decode(u.path().strip_prefix('/').unwrap_or(u.path()));
    let param = |key: &str| url.query_pairs().find(|(k, _)| k == key).map(|(_, v)| v.to_lowercase()).unwrap_or_default();
    let (sslmode, ssl) = (param("sslmode"), param("ssl"));
    let host = url.host_str().unwrap_or("");
    let host = host.strip_prefix('[').and_then(|h| h.strip_suffix(']')).unwrap_or(host);
    let database = [name_of(&url), name_of(&own), decode(own.username())].into_iter().find(|s| !s.is_empty()).unwrap_or_else(|| "postgres".into());
    let tls = ["require", "verify-ca", "verify-full"].contains(&sslmode.as_str()) || ssl == "true" || ssl == "1";
    Ok(json!({
        "host": host,
        "port": url.port().unwrap_or(5432),
        "database": database,
        "ssl": tls,
    }))
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let hexval = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hexval(bytes[i + 1]), hexval(bytes[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// `insightsSource`: the service role made to exist with `USAGE` on the schema of every base
/// of the instance and nothing else, and where and as whom Trino lists the structure.
pub async fn insights_source(st: &Shared, config: &InsightsConfig, request_id: &str) -> Result<Value, AppError> {
    let mut ctx = RequestContext::new(request_id, Actor { kind: ActorKind::System, id: SYSTEM.into(), token_id: None }, "", Surface::System);
    ctx.deadline = ctx.timestamp + chrono::Duration::seconds(60);
    let password = service_password_of(st.instance_key()?);
    let who = ident(SERVICE_ROLE)?;
    let (c, p, w) = (&ctx, &password, &who);
    let bases = with_transaction(&st.pools, PoolName::Ddl, c, TxOptions::default(), |tx| async move {
        tx.rows(GRANTS_LOCK, &[]).await?;
        if ensure_login_role(&tx, SERVICE_ROLE, p, true).await? {
            tx.query_op(
                &format!(
                    "DO $do$ BEGIN
           EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), {});
         END $do$;",
                    quote_literal(SERVICE_ROLE)
                ),
                &[],
                SqlOp::Ddl,
            )
            .await?;
        }
        let bases: Vec<(String, String)> = tx
            .rows(
                "SELECT sn.name AS schema, b.label, t.ref AS tenant
                   FROM _basedb.base b
                   JOIN _basedb.tenant t         ON t.id = b.tenant_id
                   JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                                AND s.dropped_at IS NULL
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                   JOIN pg_namespace n           ON n.nspname = sn.name
                  WHERE b.is_live AND b.deleted_at IS NULL
                  ORDER BY t.ref, b.label, sn.name",
                &[],
            )
            .await?
            .iter()
            .map(|r| (r.get(0), r.get(1)))
            .collect();
        let mut wanted: Vec<String> = Vec::new();
        for (schema, _) in &bases {
            if !wanted.contains(schema) {
                wanted.push(schema.clone());
            }
        }
        let held: Vec<String> = tx
            .rows(
                "SELECT DISTINCT n.nspname
                   FROM pg_namespace n
                   CROSS JOIN LATERAL aclexplode(n.nspacl) x
                  WHERE x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)",
                &[&SERVICE_ROLE],
            )
            .await?
            .iter()
            .map(|r| r.get::<_, String>(0))
            .collect();
        let mut statements = Vec::new();
        for schema in held.iter().filter(|s| !wanted.contains(s)) {
            statements.push(format!("REVOKE ALL ON SCHEMA {} FROM {w}", ident(schema)?));
        }
        for schema in wanted.iter().filter(|s| !held.contains(s)) {
            statements.push(format!("GRANT USAGE ON SCHEMA {} TO {w}", ident(schema)?));
        }
        let mut all = held.clone();
        for s in &wanted {
            if !all.contains(s) {
                all.push(s.clone());
            }
        }
        let relations = tx
            .rows(
                "SELECT DISTINCT format('%I.%I', n.nspname, c.relname) AS relation
                   FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = ANY($2::text[])
                    AND (EXISTS (SELECT 1 FROM aclexplode(c.relacl) x
                                  WHERE x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1))
                         OR EXISTS (SELECT 1 FROM pg_attribute a, aclexplode(a.attacl) x
                                     WHERE a.attrelid = c.oid AND a.attacl IS NOT NULL
                                       AND x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)))",
                &[&SERVICE_ROLE, &all],
            )
            .await?;
        for r in &relations {
            statements.push(format!("REVOKE ALL ON {} FROM {w}", r.get::<_, String>(0)));
        }
        for statement in &statements {
            tx.query_op(statement, &[], SqlOp::Ddl).await?;
        }
        Ok(bases)
    })
    .await?;
    let connection = connection_of(config.database_url.as_deref(), &st.cfg.database_url)?;
    let mut body = json!({
        "catalog": INSIGHTS_CATALOG,
        "name": "basedb",
        "description": "Les bases de basedb, lues avec les droits basedb de chacun.",
    });
    if let (Some(b), Some(c)) = (body.as_object_mut(), connection.as_object()) {
        b.extend(c.clone());
        b.insert("user".into(), json!(SERVICE_ROLE));
        b.insert("password".into(), json!(password));
        b.insert("schemas".into(), json!(bases.iter().map(|(schema, label)| json!({ "schema": schema, "label": label })).collect::<Vec<_>>()));
    }
    Ok(body)
}

/// `startInsightsSource`: the source set in insights now (two seconds after the start), then
/// every `interval`. A failure is said once, then again only after a success.
pub fn start_insights_source(st: Shared, interval: Duration) -> Option<tokio::task::JoinHandle<()>> {
    let config = st.cfg.insights.clone()?;
    Some(tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let (mut failing, mut set) = (false, false);
        let mut ticker = tokio::time::interval(interval);
        loop {
            ticker.tick().await;
            let rid = uuid::Uuid::new_v4().to_string();
            let outcome = async {
                let body = insights_source(&st, &config, &rid).await?;
                call(&config, &service_token(&config), reqwest::Method::PUT, "/api/v1/host/source", Some(&body)).await
            }
            .await;
            match outcome {
                Ok(result) => {
                    if !set || result.get("changed") == Some(&Value::Bool(true)) || failing {
                        println!("[insights] source basedb posée dans insights.");
                    }
                    set = true;
                    failing = false;
                }
                Err(error) => {
                    if !failing {
                        let details = if error.details.is_empty() { error.cause.clone().unwrap_or_else(|| error.code.to_string()) } else { Value::Object(error.details.clone()).to_string() };
                        println!("[insights] source basedb non posée dans insights ({details}) : nouvel essai dans {} s.", interval.as_secs());
                    }
                    failing = true;
                }
            }
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reaches_the_database_without_its_credentials() {
        assert_eq!(
            connection_of(Some("postgresql://db.interne:6432/donnees?sslmode=require"), "postgres://basedb:secret@localhost/basedb").unwrap(),
            json!({ "host": "db.interne", "port": 6432, "database": "donnees", "ssl": true })
        );
        assert_eq!(connection_of(None, "postgres://basedb:secret@localhost/basedb").unwrap(), json!({ "host": "localhost", "port": 5432, "database": "basedb", "ssl": false }));
        assert_eq!(
            connection_of(Some("postgresql://db.interne"), "postgres://basedb:secret@localhost:5433/principale").unwrap(),
            json!({ "host": "db.interne", "port": 5432, "database": "principale", "ssl": false })
        );
        assert_eq!(connection_of(None, "postgres://postgres:basedb@localhost:55432/postgres").unwrap()["port"], 55432);
    }

    #[test]
    fn derives_the_service_password_from_the_instance_key() {
        let p = service_password_of("cle");
        assert_eq!(p.len(), 64);
        assert_eq!(p, service_password_of("cle"));
        assert_ne!(p, service_password_of("autre"));
    }
}
