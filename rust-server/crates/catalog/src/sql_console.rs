//! SQL on a base (`sql/run.ts`, `console.ts`, `reader.ts`, `cursor.ts`, `row-security.ts`):
//! the console of whoever manages the base's structure — the instance's `basedb_console`
//! LOGIN role, one schema granted —, and everyone else's read-only SQL as their own LOGIN
//! role `basedb_reader_<id>`, whose grants are the decider's verdict column by column and
//! whose rows are PostgreSQL policies of their predicates.
//!
//! The statements run on a connection of [`crate::wire`], opened for the call and closed
//! after it (Node keeps a pool per schema): the console must say what node-postgres says —
//! the type and value of every column, the tag of every statement.

use crate::js::{js_number, js_number_string};
use crate::naming::{qualify, quote_identifier, quote_literal};
use crate::pg_values::parse_value;
use crate::reader::{reader_reaches, BaseReach, Reach};
use crate::wire::{ConnectOptions, PgError, QueryResult, WireClient};
use basedb_base::db::{startup_options, Exec, PoolName, Pools};
use basedb_base::error::{translate_pg_like, AppError, PgErrorLike, SqlOp};
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Target, Verdict};
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::load_base_target;
use basedb_base::rbac::rows::policy_expression;
use basedb_base::time::{hex, hmac_sha256};
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, Mutex};
use std::time::Instant;

const CONSOLE_ROLE: &str = "basedb_console";
const CONSOLE_POLICY: &str = "basedb_console_all";
const READER_PREFIX: &str = "basedb_rows_";
pub const CONSOLE_DEFAULT_LIMIT: f64 = 500.0;
pub const CONSOLE_MAX_LIMIT: f64 = 5_000.0;
const STATEMENT_TIMEOUT: &str = "15000ms";
pub const GRANTS_LOCK: &str = "SELECT pg_advisory_xact_lock(hashtext('basedb.reader-grants'))";

/// `SqlConsoleRequest`.
#[derive(Debug, Clone)]
pub struct SqlRequest {
    pub base_id: String,
    pub sql: String,
    /// `limit`, as the body gave it — a number, maybe not a whole one.
    pub limit: Option<f64>,
    pub read_only: bool,
}

/// `SqlConsoleResult`.
#[derive(Debug, Clone)]
pub struct SqlResult {
    /// Name and type name (`format_type`) of each column.
    pub columns: Vec<(String, String)>,
    pub rows: Vec<Value>,
    pub row_count: i64,
    pub command: String,
    pub duration_ms: u128,
    pub truncated: bool,
    pub schema: String,
    pub mode: &'static str,
}

impl SqlResult {
    /// `serializeSqlResult` of `app.ts`.
    pub fn serialized(&self) -> Value {
        json!({
            "columns": self.columns.iter().map(|(name, data_type)| json!({ "name": name, "dataType": data_type })).collect::<Vec<_>>(),
            "rows": self.rows,
            "row_count": self.row_count,
            "command": self.command,
            "duration_ms": self.duration_ms as u64,
            "truncated": self.truncated,
            "schema": self.schema,
            "mode": self.mode,
        })
    }
}

/// What can go wrong while the statement runs: ours, or the server's.
enum Failure {
    App(AppError),
    Pg(PgError),
}

impl From<AppError> for Failure {
    fn from(e: AppError) -> Self {
        Failure::App(e)
    }
}

impl From<PgError> for Failure {
    fn from(e: PgError) -> Self {
        Failure::Pg(e)
    }
}

/// `asStatementError`: the server's own words for a statement it refused, the ordinary
/// translation for a failure without a SQLSTATE.
fn as_statement_error(failure: Failure) -> AppError {
    let pg = match failure {
        Failure::App(e) => return e,
        Failure::Pg(pg) => pg,
    };
    let code = pg.code.clone().filter(|c| c.len() == 5 && c.bytes().all(|b| b.is_ascii_digit() || b.is_ascii_uppercase()));
    let Some(code) = code else {
        return translate_pg_like(
            &PgErrorLike { code: pg.code.clone(), constraint: None, column: None, table: None, detail: pg.detail.clone(), message: Some(pg.message.clone()) },
            SqlOp::Select,
        );
    };
    let position = pg.position.as_deref().map(|p| match p.trim().parse::<f64>() {
        Ok(n) => js_number(n),
        Err(_) => Value::Null,
    });
    AppError::new("REQUEST_INVALID")
        .with("parameter", json!("sql"))
        .with("sqlstate", json!(code))
        .with("message", json!(pg.message))
        .with("detail", json!(pg.detail))
        .with("hint", json!(pg.hint))
        .with("position", position.unwrap_or(Value::Null))
}

/// `holdsConsole`.
pub fn holds_console(ctx: &RequestContext, grants: &ActorGrants, base: Option<&Target>) -> bool {
    base.is_some_and(|b| decide(ctx, grants, Action::ManageSchema, b).verdict == Verdict::Allowed)
}

/// `runSql`: the console for whoever manages the base's structure, the reader for the rest.
pub async fn run_sql(st: &Shared, ctx: &RequestContext, request: &SqlRequest) -> Result<SqlResult, AppError> {
    let base_id = request.base_id.as_str();
    let console = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        let base = load_base_target(&tx, ctx, base_id).await?;
        Ok(holds_console(ctx, &grants, base.as_ref()))
    })
    .await?;
    if console {
        run_console_sql(st, ctx, request).await
    } else {
        run_reader_sql(st, ctx, request).await
    }
}

/// `readSqlView`: the rows of a view, read as a statement of the caller.
pub async fn read_sql_view(st: &Shared, ctx: &RequestContext, base_id: &str, view: &str, limit: Option<f64>) -> Result<SqlResult, AppError> {
    let v = crate::sql_views::get_sql_view(&st.pools, ctx, base_id, view).await?;
    let name = v.get("name").and_then(Value::as_str).unwrap_or_default().to_string();
    if let Some(reason) = v.get("broken").filter(|b| !b.is_null()) {
        return Err(AppError::new("SQL_VIEW_BROKEN").with("view", json!(name)).with("reason", reason.clone()));
    }
    let id = v.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
    let id = id.as_str();
    let schema: Option<String> = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        Ok(tx
            .first(
                "SELECT sn.name FROM _basedb.sql_view v
                   JOIN _basedb.db_schema s      ON s.id = v.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                  WHERE v.id = $1::text::uuid",
                &[&id],
            )
            .await?
            .map(|r| r.get(0)))
    })
    .await?;
    let sql = format!("SELECT * FROM {}", qualify(&schema.unwrap_or_default(), &name)?);
    run_sql(st, ctx, &SqlRequest { base_id: base_id.to_string(), sql, limit, read_only: true }).await
}

#[allow(clippy::manual_clamp)] // `max`/`min` turn a NaN into a bound; `clamp` would keep it.
fn limit_of(request: &SqlRequest) -> f64 {
    request.limit.unwrap_or(CONSOLE_DEFAULT_LIMIT).max(1.0).min(CONSOLE_MAX_LIMIT)
}

fn empty_sql() -> AppError {
    AppError::new("REQUEST_INVALID").with("parameter", json!("sql")).with("detail", json!("vide"))
}

// ------------------------------------------------------------------------------------
// The console

/// `runConsoleSql`.
pub async fn run_console_sql(st: &Shared, ctx: &RequestContext, request: &SqlRequest) -> Result<SqlResult, AppError> {
    let sql = crate::description::js_trim(&request.sql).to_string();
    if sql.is_empty() {
        return Err(empty_sql());
    }
    let key = st.instance_key()?.to_string();
    let limit = limit_of(request);
    let base_id = request.base_id.as_str();

    let (schema, others) = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        let base = load_base_target(&tx, ctx, base_id).await?;
        if !holds_console(ctx, &grants, base.as_ref()) {
            return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
        }
        let target = tx
            .first(
                "SELECT n.name, b.label
                   FROM _basedb.base b
                   JOIN _basedb.db_schema s ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
                   JOIN _basedb.physical_name n ON n.id = s.name_id
                   JOIN _basedb.tenant t ON t.id = b.tenant_id
                  WHERE b.id = $1::text::uuid AND b.deleted_at IS NULL AND t.ref = $2",
                &[&base_id, &ctx.tenant_id],
            )
            .await?;
        let Some(target) = target else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id))) };
        let schema: String = target.get(0);
        let others: Vec<String> = tx
            .rows(
                "SELECT n.name
                   FROM _basedb.db_schema s
                   JOIN _basedb.physical_name n ON n.id = s.name_id
                   JOIN _basedb.base b ON b.id = s.base_id
                  WHERE s.dropped_at IS NULL AND n.name <> $1",
                &[&schema],
            )
            .await?
            .iter()
            .map(|r| r.get(0))
            .collect();
        Ok((schema, others))
    })
    .await?;

    let password = hex(&hmac_sha256(key.as_bytes(), &[b"basedb/console-role/v1"]));
    provision_console(&st.pools, &schema, &others, &password).await?;

    let options = ConnectOptions::of_url(
        &st.cfg.database_url,
        CONSOLE_ROLE,
        &password,
        startup_options(&[
            ("search_path", format!("{schema},public")),
            ("statement_timeout", STATEMENT_TIMEOUT.to_string()),
            ("idle_in_transaction_session_timeout", "30000ms".to_string()),
        ]),
        "basedb:console",
    )
    .map_err(|e| as_statement_error(e.into()))?;
    let started = Instant::now();
    let mut client: Option<WireClient> = None;
    let outcome = console_statement(&mut client, &options, ctx, &sql, limit, request.read_only, &schema, started).await;
    if let Some(mut c) = client {
        let _ = c.simple("ROLLBACK").await;
        let _ = c.simple("SELECT set_config('basedb.actor_kind', '', false), set_config('basedb.actor_id', '', false)").await;
        c.close().await;
    }
    finish(&st.pools, ctx, base_id, &sql, "console", outcome).await
}

#[allow(clippy::too_many_arguments)]
async fn console_statement(
    client: &mut Option<WireClient>,
    options: &ConnectOptions,
    ctx: &RequestContext,
    sql: &str,
    limit: f64,
    read_only: bool,
    schema: &str,
    started: Instant,
) -> Result<SqlResult, Failure> {
    let c = client.insert(WireClient::connect(options).await?);
    if current_user(c).await?.as_deref() != Some(CONSOLE_ROLE) {
        return Err(AppError::new("INTERNAL_ERROR").with("reason", json!("la console n’est pas sur son rôle restreint")).into());
    }
    c.extended(
        "SELECT set_config('basedb.actor_kind', 'user', false),
              set_config('basedb.actor_id', $1, false),
              set_config('basedb.surface', 'rest', false)",
        &[Some(ctx.actor.id.as_str())],
    )
    .await?;
    c.simple(if read_only { "BEGIN TRANSACTION READ ONLY" } else { "BEGIN" }).await?;
    let last = match read_capped(c, sql, limit).await? {
        Some(capped) => {
            if !read_only {
                c.simple("COMMIT").await?;
            }
            capped
        }
        None => {
            if !read_only {
                c.simple("ROLLBACK").await?;
            }
            let results = if read_only { vec![c.extended(sql, &[]).await?] } else { c.simple(sql).await? };
            match results.iter().rev().find(|r| !r.fields.is_empty()).or(results.last()) {
                Some(found) => found.clone(),
                None => return Err(AppError::new("INTERNAL_ERROR").with("reason", json!("aucun résultat")).into()),
            }
        }
    };
    shape(c, last, limit, started, schema, "console").await
}

/// The audit, once the connection is closed; the outcome, or the refusal.
async fn finish(pools: &Pools, ctx: &RequestContext, base_id: &str, sql: &str, mode: &str, outcome: Result<SqlResult, Failure>) -> Result<SqlResult, AppError> {
    match outcome {
        Ok(result) => {
            audit(pools, ctx, base_id, sql, Some(&result.command), Some(result.row_count), None, mode).await;
            Ok(result)
        }
        Err(failure) => {
            let refusal = as_statement_error(failure);
            audit(pools, ctx, base_id, sql, None, None, Some(refusal.code), mode).await;
            Err(refusal)
        }
    }
}

async fn current_user(c: &mut WireClient) -> Result<Option<String>, PgError> {
    let who = c.simple("SELECT current_user AS role").await?;
    Ok(who.last().and_then(|r| r.rows.first()).and_then(|row| row.first().cloned().flatten()))
}

/// `provision`: the role exists, holds the target schema and nothing else. On the owner's
/// connection, outside any transaction, before every call.
async fn provision_console(pools: &Pools, schema: &str, others: &[String], password: &str) -> Result<(), AppError> {
    let conn = pools.get(PoolName::Ddl).await?;
    let role = quote_identifier(CONSOLE_ROLE)?;
    let mut statements = vec![
        format!(
            "DO $do$\n       BEGIN\n         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {lit}) THEN\n           EXECUTE 'CREATE ROLE ' || quote_ident({lit});\n         END IF;\n       END\n       $do$;",
            lit = quote_literal(CONSOLE_ROLE)
        ),
        format!("ALTER ROLE {role}\n         WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS\n         PASSWORD {}", quote_literal(password)),
    ];
    for internal in ["_basedb", "_basedb_local"] {
        statements.push(format!("REVOKE ALL ON ALL TABLES IN SCHEMA {} FROM {role}", quote_identifier(internal)?));
        statements.push(format!("REVOKE ALL ON SCHEMA {} FROM {role}", quote_identifier(internal)?));
    }
    for other in others {
        statements.push(format!("REVOKE ALL ON SCHEMA {} FROM {role}", quote_identifier(other)?));
        statements.push(format!("REVOKE ALL ON ALL TABLES IN SCHEMA {} FROM {role}", quote_identifier(other)?));
    }
    let target = quote_identifier(schema)?;
    statements.push(format!("GRANT USAGE ON SCHEMA {target} TO {role}"));
    statements.push(format!("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {target}\n         TO {role}"));
    statements.push(format!("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA {target}\n         TO {role}"));
    for statement in statements {
        conn.execute_op(&statement, &[], SqlOp::Ddl).await?;
    }
    Ok(())
}

// ------------------------------------------------------------------------------------
// The cursor (`cursor.ts`)

const CURSOR_PREFIX: &str = "DECLARE basedb_rows NO SCROLL CURSOR FOR ";

/// `cursorable`: whether the text starts like a query, past comments and parentheses.
pub fn cursorable(sql: &str) -> bool {
    let mut rest = sql;
    loop {
        let trimmed = rest.trim_start_matches(|c: char| c == '(' || crate::formula::js_space(c));
        if trimmed.starts_with("--") {
            rest = match trimmed.find('\n') {
                Some(end) => &trimmed[end + 1..],
                None => "",
            };
        } else if trimmed.starts_with("/*") {
            rest = match trimmed.find("*/") {
                Some(end) => &trimmed[end + 2..],
                None => "",
            };
        } else {
            return ["select", "with", "values", "table"].iter().any(|word| {
                trimmed.len() >= word.len()
                    && trimmed.as_bytes()[..word.len()].eq_ignore_ascii_case(word.as_bytes())
                    && !trimmed.as_bytes().get(word.len()).is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'_')
            });
        }
    }
}

/// `shifted`: a position counted in the person's text, not in the `DECLARE` around it.
fn shifted(mut e: PgError) -> PgError {
    if let Some(at) = e.position.as_deref().and_then(|p| p.trim().parse::<f64>().ok()) {
        if at.is_finite() && at > CURSOR_PREFIX.len() as f64 {
            e.position = Some(js_number_string(at - CURSOR_PREFIX.len() as f64));
        }
    }
    e
}

/// `readCapped`: at most `limit` rows through a cursor, and how many there were; `None`
/// when PostgreSQL will not declare one over the text.
async fn read_capped(c: &mut WireClient, sql: &str, limit: f64) -> Result<Option<QueryResult>, PgError> {
    if !cursorable(sql) {
        return Ok(None);
    }
    c.simple("SAVEPOINT basedb_cursor").await?;
    if let Err(e) = c.extended(&format!("{CURSOR_PREFIX}{sql}"), &[]).await {
        if matches!(e.code.as_deref(), Some("42601") | Some("0A000")) {
            c.simple("ROLLBACK TO SAVEPOINT basedb_cursor").await?;
            return Ok(None);
        }
        return Err(shifted(e));
    }
    let page = async {
        let mut page = c.simple(&format!("FETCH FORWARD {} FROM basedb_rows", js_number_string(limit + 1.0))).await?.pop().unwrap_or_default();
        let mut total = page.rows.len() as i64;
        if page.rows.len() as f64 > limit {
            let rest = c.simple("MOVE FORWARD ALL IN basedb_rows").await?.pop().unwrap_or_default();
            total += rest.row_count.unwrap_or(0);
        }
        c.simple("CLOSE basedb_rows").await?;
        c.simple("RELEASE SAVEPOINT basedb_cursor").await?;
        page.row_count = Some(total);
        page.command = Some("SELECT".into());
        Ok::<_, PgError>(page)
    }
    .await
    .map_err(shifted)?;
    Ok(Some(page))
}

// ------------------------------------------------------------------------------------
// The result

static TYPE_NAMES: LazyLock<Mutex<HashMap<u32, String>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// `resolveTypes`: OID → type name, cached for the process.
async fn resolve_types(c: &mut WireClient, oids: &[u32]) -> Result<Vec<String>, PgError> {
    let missing: Vec<u32> = {
        let cache = TYPE_NAMES.lock().expect("type names");
        let mut seen = HashSet::new();
        oids.iter().copied().filter(|o| seen.insert(*o) && !cache.contains_key(o)).collect()
    };
    if !missing.is_empty() {
        let param = format!("{{{}}}", missing.iter().map(|o| format!("\"{o}\"")).collect::<Vec<_>>().join(","));
        let found = c.extended("SELECT oid::text AS oid, format_type(oid, NULL) AS name FROM pg_type WHERE oid = ANY($1::oid[])", &[Some(param.as_str())]).await?;
        let mut cache = TYPE_NAMES.lock().expect("type names");
        for row in found.rows {
            if let (Some(Some(oid)), Some(Some(name))) = (row.first(), row.get(1)) {
                if let Ok(oid) = oid.parse::<u32>() {
                    cache.insert(oid, name.clone());
                }
            }
        }
    }
    let cache = TYPE_NAMES.lock().expect("type names");
    Ok(oids.iter().map(|o| cache.get(o).cloned().unwrap_or_else(|| o.to_string())).collect())
}

/// The names an empty JavaScript object already answers `in` for.
const PROTOTYPE_NAMES: [&str; 12] = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
    "__proto__",
    "__defineGetter__",
    "__defineSetter__",
    "__lookupGetter__",
    "__lookupSetter__",
];

/// `uniqueKey`: two identical column names must not collapse into one key.
pub fn unique_key(row: &Map<String, Value>, name: &str, index: usize) -> String {
    if !row.contains_key(name) && !PROTOTYPE_NAMES.contains(&name) {
        return name.to_string();
    }
    format!("{name}__{index}")
}

async fn shape(c: &mut WireClient, last: QueryResult, limit: f64, started: Instant, schema: &str, mode: &'static str) -> Result<SqlResult, Failure> {
    let oids: Vec<u32> = last.fields.iter().map(|f| f.1).collect();
    let names = resolve_types(c, &oids).await?;
    let columns: Vec<(String, String)> = last.fields.iter().zip(names).map(|((name, _), t)| (name.clone(), t)).collect();
    let all = last.rows.len();
    let kept = all.min(limit.trunc() as usize);
    let rows = last.rows[..kept]
        .iter()
        .map(|values| {
            let mut row = Map::new();
            for (i, (name, oid)) in last.fields.iter().enumerate() {
                let key = unique_key(&row, name, i);
                let value = values.get(i).cloned().flatten().map_or(Value::Null, |text| parse_value(*oid, &text));
                row.insert(key, value);
            }
            crate::js::js_order(Value::Object(row))
        })
        .collect();
    Ok(SqlResult {
        columns,
        rows,
        row_count: last.row_count.unwrap_or(all as i64),
        command: last.command.clone().unwrap_or_else(|| "SELECT".into()),
        duration_ms: started.elapsed().as_millis(),
        truncated: all > kept,
        schema: schema.to_string(),
        mode,
    })
}

/// `audit`: who ran what, whatever came of it. A log that cannot be written loses the line.
#[allow(clippy::too_many_arguments)]
async fn audit(pools: &Pools, ctx: &RequestContext, base_id: &str, sql: &str, command: Option<&str>, row_count: Option<i64>, error_code: Option<&str>, mode: &str) {
    let Ok(conn) = pools.catalog().await else { return };
    let actor_kind = match ctx.actor.kind {
        ActorKind::Token => "token",
        ActorKind::System => "system",
        _ => "user",
    };
    let actor_user: Option<&str> = (ctx.actor.kind == ActorKind::User).then_some(ctx.actor.id.as_str());
    let surface = match ctx.surface {
        Surface::Mcp => "mcp",
        Surface::Rest => "rest",
        _ => "ui",
    };
    let units: Vec<u16> = sql.encode_utf16().take(20_000).collect();
    let sql = String::from_utf16_lossy(&units);
    let request_id: Option<&str> = (ctx.request_id.encode_utf16().count() == 36).then_some(ctx.request_id.as_str());
    let _ = conn
        .execute_op(
            "INSERT INTO _basedb.audit_log
               (tenant_id, base_id, actor_kind, actor_user_id, surface, action, object_kind,
                object_id, payload, request_id)
             SELECT t.id, $2::text::uuid, $3::text, $4::text::uuid, $5::text, 'sql.console', 'base', $2::text::uuid,
                    jsonb_build_object('sql', $6::text, 'command', $7::text,
                                       'row_count', $8::int8::int, 'error_code', $9::text,
                                       'mode', $11::text),
                    $10::text::uuid
               FROM _basedb.tenant t WHERE t.ref = $1",
            &[&ctx.tenant_id, &base_id, &actor_kind, &actor_user, &surface, &sql, &command, &row_count, &error_code, &request_id, &mode],
            SqlOp::Insert,
        )
        .await;
}

// ------------------------------------------------------------------------------------
// The reader (`reader.ts`, `row-security.ts`)

/// `roleOf`.
pub fn role_of(user_id: &str) -> String {
    format!("basedb_reader_{}", user_id.replace('-', ""))
}

/// `passwordOf`.
pub fn password_of(instance_key: &str, user_id: &str) -> String {
    hex(&hmac_sha256(instance_key.as_bytes(), &[format!("basedb/reader-role/v1/{user_id}").as_bytes()]))
}

/// Schema → table → the columns it really has, in their order.
pub type PhysicalColumns = HashMap<String, IndexMap<String, Vec<String>>>;

/// `shadowsOf`: the tables with a column withheld, and their readable columns.
fn shadows_of(reach: &Reach, physical: &PhysicalColumns) -> Vec<(String, Vec<String>)> {
    let tables = physical.get(&reach.schema);
    let mut out = Vec::new();
    for (table, readable) in &reach.tables {
        let all = tables.and_then(|t| t.get(table)).map(Vec::as_slice).unwrap_or(&[]);
        let columns: Vec<String> = all.iter().filter(|c| readable.contains(*c)).cloned().collect();
        if columns.len() < all.len() {
            out.push((table.clone(), columns));
        }
    }
    out
}

const LOGIN_ATTRIBUTES: &str = "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION";

/// `ensureLoginRole`: whether the role was made or its password reset.
pub async fn ensure_login_role<E: Exec + Sync>(exec: &E, role: &str, password: &str, reset_password: bool) -> Result<bool, AppError> {
    let known = exec.first("SELECT oid::text AS oid FROM pg_roles WHERE rolname = $1", &[&role]).await?;
    if known.is_none() {
        exec.execute_op(&format!("CREATE ROLE {} {LOGIN_ATTRIBUTES} PASSWORD {}", quote_identifier(role)?, quote_literal(password)), &[], SqlOp::Ddl).await?;
        return Ok(true);
    }
    if reset_password {
        exec.execute_op(&format!("ALTER ROLE {} WITH {LOGIN_ATTRIBUTES} PASSWORD {}", quote_identifier(role)?, quote_literal(password)), &[], SqlOp::Ddl).await?;
        return Ok(true);
    }
    Ok(false)
}

/// `provisionReader`: the person's role brought in line with their reach over every base
/// they read, under the grants' lock; the columns their tables really have.
pub async fn provision_reader(pools: &Pools, ctx: &RequestContext, role: &str, password: &str, reaches: &[BaseReach], reset_password: bool) -> Result<PhysicalColumns, AppError> {
    with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        tx.execute_op(GRANTS_LOCK, &[], SqlOp::Select).await?;
        if ensure_login_role(&tx, role, password, reset_password).await? {
            tx.execute_op(
                &format!(
                    "DO $do$ BEGIN\n           EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', current_database(), {});\n         END $do$;",
                    quote_literal(role)
                ),
                &[],
                SqlOp::Ddl,
            )
            .await?;
        }
        let mut schemas: Vec<String> = Vec::new();
        let mut tables: Vec<String> = Vec::new();
        for r in reaches {
            for t in r.reach.tables.keys() {
                schemas.push(r.reach.schema.clone());
                tables.push(t.clone());
            }
        }
        let rows = tx
            .rows(
                "SELECT n.nspname::text, c.relname::text, a.attname::text
                   FROM unnest($1::text[], $2::text[]) AS wanted(nspname, relname)
                   JOIN pg_namespace n ON n.nspname = wanted.nspname
                   JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = wanted.relname
                                  AND c.relkind IN ('r', 'p')
                   JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
                  ORDER BY n.nspname, c.relname, a.attnum",
                &[&schemas, &tables],
            )
            .await?;
        let mut physical: PhysicalColumns = HashMap::new();
        for row in &rows {
            physical.entry(row.get(0)).or_default().entry(row.get(1)).or_default().push(row.get(2));
        }
        for statement in grants_to_write(&tx, role, reaches, &physical).await? {
            tx.execute_op(&statement, &[], SqlOp::Ddl).await?;
        }
        for r in reaches {
            for statement in reader_policies(&tx, role, &r.reach.schema, &r.reach.rows).await? {
                tx.execute_op(&statement, &[], SqlOp::Ddl).await?;
            }
        }
        Ok(physical)
    })
    .await
}

/// `grantsToWrite`: the `GRANT`s and `REVOKE`s that make the role's privileges its reach.
async fn grants_to_write<E: Exec + Sync>(exec: &E, role: &str, reaches: &[BaseReach], columns_of: &PhysicalColumns) -> Result<Vec<String>, AppError> {
    let who = quote_identifier(role)?;
    let mut statements = Vec::new();
    let mut by_schema: IndexMap<&str, &Reach> = IndexMap::new();
    for r in reaches {
        by_schema.insert(r.reach.schema.as_str(), &r.reach);
    }

    let held: IndexMap<String, ()> = exec
        .rows(
            "SELECT DISTINCT n.nspname::text
               FROM pg_namespace n
               CROSS JOIN LATERAL aclexplode(n.nspacl) x
              WHERE x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)",
            &[&role],
        )
        .await?
        .iter()
        .map(|r| (r.get::<_, String>(0), ()))
        .collect();
    for nspname in held.keys() {
        if !by_schema.contains_key(nspname.as_str()) {
            statements.push(format!("REVOKE ALL ON SCHEMA {} FROM {who}", quote_identifier(nspname)?));
        }
    }
    for schema in by_schema.keys() {
        if !held.contains_key(*schema) {
            statements.push(format!("GRANT USAGE ON SCHEMA {} TO {who}", quote_identifier(schema)?));
        }
    }

    let mut looked: IndexMap<String, ()> = held.clone();
    for schema in by_schema.keys() {
        looked.entry(schema.to_string()).or_insert(());
    }
    let looked: Vec<String> = looked.into_keys().collect();
    let privileges = exec
        .rows(
            "SELECT n.nspname::text, c.relname::text, NULL::text AS attname, x.privilege_type::text AS privilege
               FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               CROSS JOIN LATERAL aclexplode(c.relacl) x
              WHERE n.nspname = ANY($2::text[]) AND x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)
             UNION ALL
             SELECT n.nspname::text, c.relname::text, a.attname::text, x.privilege_type::text
               FROM pg_attribute a
               JOIN pg_class c ON c.oid = a.attrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
               CROSS JOIN LATERAL aclexplode(a.attacl) x
              WHERE n.nspname = ANY($2::text[]) AND x.grantee = (SELECT oid FROM pg_roles WHERE rolname = $1)
                AND a.attnum > 0 AND NOT a.attisdropped",
            &[&role, &looked],
        )
        .await?;

    let wanted_schemas: Vec<String> = by_schema.keys().map(|s| s.to_string()).collect();
    let view_rows = exec
        .rows(
            "SELECT sn.name::text AS nspname, c.relname::text
               FROM _basedb.sql_view v
               JOIN _basedb.physical_name vn ON vn.id = v.name_id
               JOIN _basedb.db_schema s ON s.id = v.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
               JOIN pg_namespace n ON n.nspname = sn.name
               JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = vn.name AND c.relkind = 'v'
              WHERE sn.name = ANY($1::text[]) AND v.broken_reason IS NULL",
            &[&wanted_schemas],
        )
        .await?;
    let mut views: IndexMap<(String, String), ()> = IndexMap::new();
    for v in &view_rows {
        views.insert((v.get(0), v.get(1)), ());
    }

    let mut revoke_whole: IndexMap<(String, String), ()> = IndexMap::new();
    let mut granted_columns: HashMap<(String, String), HashSet<String>> = HashMap::new();
    let mut granted_views: HashSet<(String, String)> = HashSet::new();
    for row in &privileges {
        let nspname: String = row.get(0);
        let relname: String = row.get(1);
        let attname: Option<String> = row.get(2);
        let privilege: String = row.get(3);
        let id = (nspname.clone(), relname.clone());
        let readable = by_schema.get(nspname.as_str()).and_then(|r| r.tables.get(&relname));
        let Some(attname) = attname else {
            if views.contains_key(&id) && privilege == "SELECT" {
                granted_views.insert(id);
            } else {
                revoke_whole.insert(id, ());
            }
            continue;
        };
        let Some(readable) = readable else {
            revoke_whole.insert(id, ());
            continue;
        };
        if privilege == "SELECT" && readable.contains(&attname) {
            granted_columns.entry(id).or_default().insert(attname);
        } else {
            statements.push(format!("REVOKE {privilege} ({}) ON {} FROM {who}", quote_identifier(&attname)?, qualify(&nspname, &relname)?));
        }
    }
    for (schema, relation) in revoke_whole.keys() {
        statements.push(format!("REVOKE ALL ON {} FROM {who}", qualify(schema, relation)?));
        let id = (schema.clone(), relation.clone());
        granted_columns.remove(&id);
        granted_views.remove(&id);
    }

    let none = HashSet::new();
    for r in reaches {
        let reach = &r.reach;
        for (table, readable) in &reach.tables {
            let granted = granted_columns.get(&(reach.schema.clone(), table.clone())).unwrap_or(&none);
            let all = columns_of.get(&reach.schema).and_then(|t| t.get(table)).map(Vec::as_slice).unwrap_or(&[]);
            let missing: Vec<&String> = all.iter().filter(|c| readable.contains(*c) && !granted.contains(*c)).collect();
            if !missing.is_empty() {
                let list = missing.iter().map(|c| quote_identifier(c)).collect::<Result<Vec<_>, _>>()?.join(", ");
                statements.push(format!("GRANT SELECT ({list}) ON {} TO {who}", qualify(&reach.schema, table)?));
            }
        }
    }
    for (schema, relation) in views.keys() {
        if !granted_views.contains(&(schema.clone(), relation.clone())) {
            statements.push(format!("GRANT SELECT ON {} TO {who}", qualify(schema, relation)?));
        }
    }
    Ok(statements)
}

/// `enableRowSecurity`: row security on, the console keeping every row.
pub async fn enable_row_security<E: Exec + Sync>(exec: &E, relation: &str) -> Result<(), AppError> {
    let console = quote_literal(CONSOLE_ROLE);
    exec.execute_op(
        &format!(
            "DO $do$ BEGIN\n       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {console}) THEN\n         EXECUTE 'CREATE ROLE ' || quote_ident({console}) || ' NOLOGIN';\n       END IF;\n       IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = {}::regclass\n                                                 AND polname = {}) THEN\n         EXECUTE 'CREATE POLICY {CONSOLE_POLICY} ON {} FOR ALL TO '\n                 || quote_ident({console}) || ' USING (true) WITH CHECK (true)';\n       END IF;\n     END $do$;",
            quote_literal(relation),
            quote_literal(CONSOLE_POLICY),
            relation.replace('\'', "''"),
        ),
        &[],
        SqlOp::Ddl,
    )
    .await?;
    exec.execute_op(&format!("ALTER TABLE {relation} ENABLE ROW LEVEL SECURITY"), &[], SqlOp::Ddl).await?;
    Ok(())
}

/// `readerPolicies`: the statements that give the role its predicate on each table.
async fn reader_policies<E: Exec + Sync>(exec: &E, role: &str, schema: &str, rows: &IndexMap<String, String>) -> Result<Vec<String>, AppError> {
    if rows.is_empty() {
        return Ok(Vec::new());
    }
    let tables: Vec<String> = rows.keys().cloned().collect();
    let pattern = format!("{READER_PREFIX}%");
    let state = exec
        .rows(
            "SELECT c.relname::text, c.relrowsecurity AS rls, p.polname::text
               FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               LEFT JOIN pg_policy p ON p.polrelid = c.oid AND p.polname LIKE $4
                                    AND (SELECT oid FROM pg_roles WHERE rolname = $1) = ANY(p.polroles)
              WHERE n.nspname = $2 AND c.relname = ANY($3::text[]) AND c.relkind IN ('r', 'p')",
            &[&role, &schema, &tables, &pattern],
        )
        .await?;
    let state: Vec<(String, bool, Option<String>)> = state.iter().map(|r| (r.get(0), r.get(1), r.get(2))).collect();
    let who = role.strip_prefix("basedb_reader_").unwrap_or(role);
    let mut statements = Vec::new();
    for (table, predicate) in rows {
        let relation = qualify(schema, table)?;
        let here: Vec<&(String, bool, Option<String>)> = state.iter().filter(|s| &s.0 == table).collect();
        let rls = here.first().is_some_and(|s| s.1);
        if !rls && predicate == "TRUE" {
            continue;
        }
        if !rls {
            enable_row_security(exec, &relation).await?;
        }
        let digest = hex(&Sha256::digest(predicate.as_bytes()));
        let wanted = format!("{READER_PREFIX}{who}_{}", &digest[..8]);
        let held: Vec<&String> = here.iter().filter_map(|s| s.2.as_ref()).collect();
        if held.iter().any(|p| **p == wanted) {
            continue;
        }
        for old in held {
            statements.push(format!("DROP POLICY IF EXISTS {} ON {relation}", quote_identifier(old)?));
        }
        statements.push(format!(
            "CREATE POLICY {} ON {relation} FOR SELECT TO {}\n         USING ({})",
            quote_identifier(&wanted)?,
            quote_identifier(role)?,
            policy_expression(predicate)
        ));
    }
    Ok(statements)
}

/// `runReaderSql`.
pub async fn run_reader_sql(st: &Shared, ctx: &RequestContext, request: &SqlRequest) -> Result<SqlResult, AppError> {
    let sql = crate::description::js_trim(&request.sql).to_string();
    if sql.is_empty() {
        return Err(empty_sql());
    }
    let base_id = request.base_id.as_str();
    if ctx.actor.kind != ActorKind::User {
        return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
    }
    let key = st.instance_key()?.to_string();
    let limit = limit_of(request);
    let reaches = reader_reaches(&st.pools, ctx).await?;
    let Some(reach) = reaches.iter().find(|r| r.base_id == base_id) else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)));
    };
    let role = role_of(&ctx.actor.id);
    let password = password_of(&key, &ctx.actor.id);
    let physical = provision_reader(&st.pools, ctx, &role, &password, &reaches, false).await?;
    let shadows = shadows_of(&reach.reach, &physical);

    let options = ConnectOptions::of_url(
        &st.cfg.database_url,
        &role,
        &password,
        startup_options(&[
            ("search_path", reach.reach.schema.clone()),
            ("statement_timeout", STATEMENT_TIMEOUT.to_string()),
            ("idle_in_transaction_session_timeout", "30000ms".to_string()),
        ]),
        "basedb:reader",
    )
    .map_err(|e| as_statement_error(e.into()))?;
    let started = Instant::now();
    let mut client: Option<WireClient> = None;
    let run = ReaderRun { st, ctx, role: &role, password: &password, reaches: &reaches, reach, options: &options };
    let outcome = run.statement(&mut client, shadows, &sql, limit, started).await;
    if let Some(mut c) = client {
        let _ = c.simple("ROLLBACK").await;
        let _ = c.simple("DISCARD ALL").await;
        c.close().await;
    }
    finish(&st.pools, ctx, base_id, &sql, "reader", outcome).await
}

struct ReaderRun<'a> {
    st: &'a Shared,
    ctx: &'a RequestContext,
    role: &'a str,
    password: &'a str,
    reaches: &'a [BaseReach],
    reach: &'a BaseReach,
    options: &'a ConnectOptions,
}

impl ReaderRun<'_> {
    async fn statement(&self, client: &mut Option<WireClient>, mut shadows: Vec<(String, Vec<String>)>, sql: &str, limit: f64, started: Instant) -> Result<SqlResult, Failure> {
        let connected = match WireClient::connect(self.options).await {
            Ok(c) => c,
            // The instance key changed since the role was made: its password follows it.
            Err(e) if e.code.as_deref() == Some("28P01") => {
                let physical = provision_reader(&self.st.pools, self.ctx, self.role, self.password, self.reaches, true).await?;
                shadows = shadows_of(&self.reach.reach, &physical);
                WireClient::connect(self.options).await?
            }
            Err(e) => return Err(e.into()),
        };
        let c = client.insert(connected);
        if current_user(c).await?.as_deref() != Some(self.role) {
            return Err(AppError::new("INTERNAL_ERROR").with("reason", json!("la lecture SQL n’est pas sur le rôle de la personne")).into());
        }
        c.simple("BEGIN").await?;
        if !shadows.is_empty() {
            let schema = &self.reach.reach.schema;
            let mut lines = Vec::new();
            for (table, columns) in &shadows {
                let list = columns.iter().map(|c| quote_identifier(c)).collect::<Result<Vec<_>, _>>()?.join(", ");
                lines.push(format!("CREATE TEMPORARY VIEW {} AS SELECT {list} FROM {};", quote_identifier(table)?, qualify(schema, table)?));
            }
            c.simple(&lines.join("\n")).await?;
        }
        c.simple("SET TRANSACTION READ ONLY").await?;
        let result = match read_capped(c, sql, limit).await? {
            Some(capped) => capped,
            None => c.extended(sql, &[]).await?,
        };
        shape(c, result, limit, started, &self.reach.reach.schema, "reader").await
    }
}

// ------------------------------------------------------------------------------------
// Routes

/// `POST /api/v1/:tenant/sql/:base`.
pub async fn post_sql(
    axum::extract::State(st): axum::extract::State<Shared>,
    axum::Extension(rid): axum::Extension<basedb_base::RequestId>,
    headers: axum::http::HeaderMap,
    axum::extract::Path((tenant, base)): axum::extract::Path<(String, String)>,
    bytes: axum::body::Bytes,
) -> basedb_base::error::ApiResult {
    let body = crate::http::strict_json(&bytes)?;
    let body = crate::http::fields(&body)?;
    let Some(sql) = body.get("sql").and_then(Value::as_str) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("sql")));
    };
    let ctx = basedb_base::auth::bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = crate::projection::resolve_base(&st.pools, &ctx, &base).await?;
    let request = SqlRequest {
        base_id,
        sql: sql.to_string(),
        limit: body.get("limit").and_then(Value::as_f64),
        read_only: body.get("read_only") == Some(&Value::Bool(true)) || st.cfg.demo.is_some(),
    };
    let result = run_sql(&st, &ctx, &request).await?;
    Ok(crate::js::js_json_response(axum::http::StatusCode::OK, &json!({ "data": result.serialized() })))
}

/// `GET /api/v1/:tenant/sql/:base/views/:view`.
pub async fn get_sql_view_rows(
    axum::extract::State(st): axum::extract::State<Shared>,
    axum::Extension(rid): axum::Extension<basedb_base::RequestId>,
    headers: axum::http::HeaderMap,
    uri: axum::http::Uri,
    axum::extract::Path((tenant, base, view)): axum::extract::Path<(String, String, String)>,
) -> basedb_base::error::ApiResult {
    let ctx = basedb_base::auth::bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = crate::projection::resolve_base(&st.pools, &ctx, &base).await?;
    let limit = crate::js::query_param(&uri, "limit").and_then(|l| crate::pg_values::js_parse_int(&l).as_f64());
    let result = read_sql_view(&st, &ctx, &base_id, &view, limit).await?;
    Ok(crate::js::js_json_response(axum::http::StatusCode::OK, &json!({ "data": result.serialized() })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursorable_reads_past_comments_and_parentheses() {
        assert!(cursorable("SELECT 1"));
        assert!(cursorable("  ((select 1))"));
        assert!(cursorable("-- note\n/* bloc */ WITH x AS (SELECT 1) SELECT * FROM x"));
        assert!(cursorable("values (1)"));
        assert!(!cursorable("selection"));
        assert!(!cursorable("UPDATE t SET a = 1"));
        assert!(!cursorable("-- rien"));
        assert!(!cursorable("/* pas fermé SELECT 1"));
    }

    #[test]
    fn positions_count_in_the_person_s_text() {
        let e = PgError { code: Some("42703".into()), position: Some("49".into()), ..PgError::default() };
        assert_eq!(shifted(e).position.as_deref(), Some("8"));
        let e = PgError { code: Some("42703".into()), position: Some("12".into()), ..PgError::default() };
        assert_eq!(shifted(e).position.as_deref(), Some("12"));
    }

    #[test]
    fn duplicate_and_prototype_names_get_their_index() {
        let mut row = Map::new();
        assert_eq!(unique_key(&row, "a", 0), "a");
        row.insert("a".into(), json!(1));
        assert_eq!(unique_key(&row, "a", 1), "a__1");
        assert_eq!(unique_key(&row, "constructor", 2), "constructor__2");
    }

    #[test]
    fn statement_errors_carry_the_server_s_words() {
        let e = as_statement_error(Failure::Pg(PgError { code: Some("42P01".into()), message: "relation « x » does not exist".into(), position: Some("15".into()), ..PgError::default() }));
        assert_eq!(e.code, "REQUEST_INVALID");
        assert_eq!(e.details.get("position"), Some(&json!(15)));
        assert_eq!(e.details.get("hint"), Some(&Value::Null));
        let e = as_statement_error(Failure::Pg(PgError { message: "Connection terminated".into(), ..PgError::default() }));
        assert_eq!(e.code, "SERVICE_UNAVAILABLE");
    }

    #[test]
    fn reader_roles_follow_the_person() {
        assert_eq!(role_of("01a1f9f6-4ac8-7dee-8257-3cd389d71c47"), "basedb_reader_01a1f9f64ac87dee82573cd389d71c47");
    }
}
