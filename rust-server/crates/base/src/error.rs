//! Les erreurs métier et LEUR traduction HTTP, à l'identique de `errors/index.ts` et de
//! `app.onError` (chapitre 08 §6) :
//!
//! - non-incident : `{"code", "details", "request_id"}` — `details` toujours présent (`{}`) ;
//! - incident (`INTERNAL_ERROR`, `CATALOG_DRIFT`…, statut nul ou ≥ 500 hors 502/503) :
//!   `{"code":"INTERNAL_ERROR","request_id"}` — rien d'autre ne sort ;
//! - le statut vient du registre des codes (`basedb_contracts::error_codes`), jamais d'un choix
//!   local ; un code de statut nul répond 500.
//!
//! Le corps n'a pas de message : l'interface traduit le code (pas de texte côté serveur).
//!
//! Un gestionnaire rend `Result<_, AppError>`. La réponse d'une erreur porte l'erreur en
//! extension ([`PendingError`]) ; la couche [`crate::layers::request_id`], qui connaît
//! l'identifiant de la requête, écrit le corps — l'unique endroit où une erreur devient HTTP.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use basedb_contracts::{error_class, http_status_for, is_error_code, ErrorClass};
use serde_json::{json, Map, Value};
use std::fmt;

/// `SqlOperation` of errors/index.ts: what the statement did, for `23503`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SqlOp {
    #[default]
    Select,
    Insert,
    Update,
    Delete,
    Ddl,
}

/// `BasedbError`.
#[derive(Debug, Clone, PartialEq)]
pub struct AppError {
    pub code: &'static str,
    pub details: Map<String, Value>,
    /// The PostgreSQL SQLSTATE behind it, if any (retry decisions, schema reread).
    pub sqlstate: Option<String>,
    /// What caused it, for the server's log only — never sent.
    pub cause: Option<String>,
}

/// The error a response stands for, rendered by [`crate::layers::request_id`].
#[derive(Debug, Clone)]
pub struct PendingError(pub AppError);

pub type ApiResult<T = Response> = Result<T, AppError>;

fn intern(code: &str) -> &'static str {
    basedb_contracts::error_codes::entry(code).map(|e| e.code).unwrap_or("INTERNAL_ERROR")
}

impl AppError {
    /// `new BasedbError(code)`. An unknown code is an `INTERNAL_ERROR` with `unknownCode`
    /// (`businessError`), so a typo never becomes a silent 200.
    pub fn new(code: &str) -> Self {
        if !is_error_code(code) {
            let mut details = Map::new();
            details.insert("unknownCode".into(), json!(code));
            return AppError { code: "INTERNAL_ERROR", details, sqlstate: None, cause: None };
        }
        AppError { code: intern(code), details: Map::new(), sqlstate: None, cause: None }
    }

    /// One detail more: `AppError::new("RESOURCE_NOT_FOUND").with("tenant", json!(t))`.
    pub fn with(mut self, key: &str, value: Value) -> Self {
        self.details.insert(key.to_string(), value);
        self
    }

    /// The details, replaced by an object (`{…}`); anything but an object is ignored.
    pub fn details(mut self, details: Value) -> Self {
        if let Value::Object(m) = details {
            self.details = m;
        }
        self
    }

    pub fn caused_by(mut self, cause: impl fmt::Display) -> Self {
        self.cause = Some(cause.to_string());
        self
    }

    /// An incident with what went wrong kept for the log (`INTERNAL_ERROR`).
    pub fn internal(cause: impl fmt::Display) -> Self {
        AppError::new("INTERNAL_ERROR").caused_by(cause)
    }

    pub fn class(&self) -> ErrorClass {
        error_class(self.code)
    }

    /// `httpStatus ?? 500`.
    pub fn status(&self) -> StatusCode {
        http_status_for(self.code).and_then(|s| StatusCode::from_u16(s).ok()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
    }

    /// `isRetryable`: a serialization failure or a deadlock.
    pub fn retryable(&self) -> bool {
        matches!(self.sqlstate.as_deref(), Some("40001" | "40P01"))
    }

    /// `requiresSchemaReread`: a table or a column gone under the statement.
    pub fn requires_schema_reread(&self) -> bool {
        matches!(self.sqlstate.as_deref(), Some("42P01" | "42703"))
    }

    /// The body `onError` sends.
    pub fn body(&self, request_id: &str) -> Value {
        if self.class() == ErrorClass::Incident {
            json!({ "code": "INTERNAL_ERROR", "request_id": request_id })
        } else {
            json!({ "code": self.code, "details": Value::Object(self.details.clone()), "request_id": request_id })
        }
    }

    /// The whole response, for a caller that knows the request id (the layers).
    pub fn respond(&self, request_id: &str) -> Response {
        if self.class() == ErrorClass::Incident {
            eprintln!(
                "[{request_id}] {}{}{}",
                self.code,
                if self.details.is_empty() { String::new() } else { format!(" {}", Value::Object(self.details.clone())) },
                self.cause.as_deref().map(|c| format!(" — {c}")).unwrap_or_default()
            );
        }
        json_response(self.status(), &self.body(request_id))
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.code)?;
        if !self.details.is_empty() {
            write!(f, " {}", Value::Object(self.details.clone()))?;
        }
        if let Some(c) = &self.cause {
            write!(f, " — {c}")?;
        }
        Ok(())
    }
}

impl std::error::Error for AppError {}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let mut res = Response::new(axum::body::Body::empty());
        *res.status_mut() = self.status();
        res.extensions_mut().insert(PendingError(self));
        res
    }
}

/// `application/json`, without charset — as Hono's `c.json`.
pub fn json_response(status: StatusCode, body: &Value) -> Response {
    let mut res = Response::new(axum::body::Body::from(serde_json::to_vec(body).unwrap_or_default()));
    *res.status_mut() = status;
    res.headers_mut().insert(axum::http::header::CONTENT_TYPE, axum::http::HeaderValue::from_static("application/json"));
    res
}

/// `c.json(body)` with 200.
pub fn json_ok(body: Value) -> Response {
    json_response(StatusCode::OK, &body)
}

/// `c.body(null, status)`.
pub fn empty(status: StatusCode) -> Response {
    let mut res = Response::new(axum::body::Body::empty());
    *res.status_mut() = status;
    res
}

/// What PostgreSQL said, field by field (`PgErrorLike`).
#[derive(Debug, Clone, Default)]
pub struct PgErrorLike {
    pub code: Option<String>,
    pub constraint: Option<String>,
    pub column: Option<String>,
    pub table: Option<String>,
    pub detail: Option<String>,
    pub message: Option<String>,
}

impl PgErrorLike {
    pub fn of(error: &tokio_postgres::Error) -> PgErrorLike {
        match error.as_db_error() {
            Some(db) => PgErrorLike {
                code: Some(db.code().code().to_string()),
                constraint: db.constraint().map(str::to_string),
                column: db.column().map(str::to_string),
                table: db.table().map(str::to_string),
                detail: db.detail().map(str::to_string),
                message: Some(db.message().to_string()),
            },
            // A connection-level failure carries no SQLSTATE: `SERVICE_UNAVAILABLE`.
            None => PgErrorLike { message: Some(error.to_string()), ..Default::default() },
        }
    }
}

fn is_uuid(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(i, c)| if matches!(i, 8 | 13 | 18 | 23) { *c == b'-' } else { c.is_ascii_hexdigit() })
}

fn constraint_details(e: &PgErrorLike) -> Map<String, Value> {
    let mut d = Map::new();
    if let Some(v) = &e.constraint {
        d.insert("constraint".into(), json!(v));
    }
    if let Some(v) = &e.column {
        d.insert("column".into(), json!(v));
    }
    if let Some(v) = &e.table {
        d.insert("table".into(), json!(v));
    }
    if let Some(v) = e.detail.as_deref().filter(|d| is_uuid(d)) {
        d.insert("id".into(), json!(v));
    }
    d
}

/// `translatePgError`.
pub fn translate_pg_like(error: &PgErrorLike, operation: SqlOp) -> AppError {
    let cause = error.message.clone();
    let Some(sqlstate) = error.code.as_deref() else {
        return AppError { cause, ..AppError::new("SERVICE_UNAVAILABLE") };
    };
    let with = |code: &str, details: Map<String, Value>| AppError {
        code: intern(code),
        details,
        sqlstate: Some(sqlstate.to_string()),
        cause: cause.clone(),
    };
    if sqlstate == "23503" {
        let code = if operation == SqlOp::Delete { "ROW_REFERENCED" } else { "LINK_TARGET_NOT_FOUND" };
        return with(code, constraint_details(error));
    }
    if sqlstate == "25P02" {
        let mut d = Map::new();
        d.insert("sqlstate".into(), json!(sqlstate));
        d.insert("note".into(), json!("statement issued inside an aborted transaction"));
        return with("INTERNAL_ERROR", d);
    }
    if sqlstate == "P0001" {
        let raised = error.message.as_deref().and_then(|m| {
            let head: String = m.chars().take_while(|c| c.is_ascii_uppercase() || *c == '_').collect();
            (!head.is_empty() && m[head.len()..].starts_with(':')).then_some(head)
        });
        if let Some(r) = raised.filter(|r| matches!(r.as_str(), "TRUNCATE_FORBIDDEN" | "BULK_OPERATION_REFUSED" | "HISTORY_IMMUTABLE")) {
            return with(&r, Map::new());
        }
    }
    let code = match sqlstate {
        "23505" => "DUPLICATE_VALUE",
        "23514" => "VALUE_OUT_OF_CONSTRAINT",
        "23502" => "REQUIRED_VALUE_MISSING",
        "22001" | "54000" => "VALUE_TOO_LONG",
        "22003" => "VALUE_OUT_OF_RANGE",
        "22P02" => "VALUE_INVALID",
        "40001" | "40P01" => "SERIALIZATION_CONFLICT",
        "55P03" => "LOCK_UNAVAILABLE",
        "57014" => "DEADLINE_EXCEEDED",
        "53300" | "53200" | "57P01" | "57P02" | "57P03" | "25P03" | "08000" | "08003" | "08006" => "SERVICE_UNAVAILABLE",
        "42501" => "PRIVILEGES_INSUFFICIENT",
        _ => {
            let mut d = Map::new();
            d.insert("sqlstate".into(), json!(sqlstate));
            return with("INTERNAL_ERROR", d);
        }
    };
    with(code, constraint_details(error))
}

/// `translatePgError` of a driver error.
pub fn translate_pg(error: &tokio_postgres::Error, operation: SqlOp) -> AppError {
    translate_pg_like(&PgErrorLike::of(error), operation)
}

impl From<tokio_postgres::Error> for AppError {
    fn from(e: tokio_postgres::Error) -> Self {
        translate_pg(&e, SqlOp::Select)
    }
}

impl From<deadpool_postgres::PoolError> for AppError {
    fn from(e: deadpool_postgres::PoolError) -> Self {
        match e {
            deadpool_postgres::PoolError::Backend(pg) => translate_pg(&pg, SqlOp::Select),
            other => AppError::new("SERVICE_UNAVAILABLE").caused_by(other),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pg(code: &str) -> PgErrorLike {
        PgErrorLike { code: Some(code.into()), ..Default::default() }
    }

    #[test]
    fn statuses_come_from_the_registry() {
        assert_eq!(AppError::new("RESOURCE_NOT_FOUND").status(), StatusCode::NOT_FOUND);
        assert_eq!(AppError::new("AUTHENTICATION_REQUIRED").status(), StatusCode::UNAUTHORIZED);
        assert_eq!(AppError::new("INTERNAL_ERROR").status(), StatusCode::INTERNAL_SERVER_ERROR);
        let unknown = AppError::new("NOT_A_CODE");
        assert_eq!((unknown.code, unknown.details["unknownCode"].as_str()), ("INTERNAL_ERROR", Some("NOT_A_CODE")));
    }

    #[test]
    fn incidents_disclose_only_an_identifier() {
        let e = AppError::new("CATALOG_DRIFT").with("missing", json!("x"));
        assert_eq!(e.body("r"), json!({ "code": "INTERNAL_ERROR", "request_id": "r" }));
        let e = AppError::new("RESOURCE_NOT_FOUND");
        assert_eq!(e.body("r"), json!({ "code": "RESOURCE_NOT_FOUND", "details": {}, "request_id": "r" }));
    }

    // errors.test.ts — translatePgError.
    #[test]
    fn translates_sqlstates() {
        let fk = PgErrorLike { code: Some("23503".into()), constraint: Some("fk_x".into()), ..Default::default() };
        assert_eq!(translate_pg_like(&fk, SqlOp::Delete).code, "ROW_REFERENCED");
        assert_eq!(translate_pg_like(&fk, SqlOp::Insert).code, "LINK_TARGET_NOT_FOUND");
        assert_eq!(translate_pg_like(&fk, SqlOp::Insert).details["constraint"], json!("fk_x"));
        assert_eq!(translate_pg_like(&pg("23505"), SqlOp::Insert).code, "DUPLICATE_VALUE");
        assert_eq!(translate_pg_like(&pg("40001"), SqlOp::Update).code, "SERIALIZATION_CONFLICT");
        assert!(translate_pg_like(&pg("40P01"), SqlOp::Update).retryable());
        assert_eq!(translate_pg_like(&pg("57P01"), SqlOp::Select).code, "SERVICE_UNAVAILABLE");
        assert_eq!(translate_pg_like(&pg("42501"), SqlOp::Select).class(), ErrorClass::Incident);
        let other = translate_pg_like(&pg("XX000"), SqlOp::Select);
        assert_eq!((other.code, other.details["sqlstate"].as_str()), ("INTERNAL_ERROR", Some("XX000")));
        assert_eq!(translate_pg_like(&PgErrorLike::default(), SqlOp::Select).code, "SERVICE_UNAVAILABLE");
        assert_eq!(translate_pg_like(&pg("25P02"), SqlOp::Select).details["note"], json!("statement issued inside an aborted transaction"));
        assert!(translate_pg_like(&pg("42703"), SqlOp::Select).requires_schema_reread());
    }

    #[test]
    fn functions_raise_by_name() {
        let raised = PgErrorLike { code: Some("P0001".into()), message: Some("HISTORY_IMMUTABLE: non".into()), ..Default::default() };
        assert_eq!(translate_pg_like(&raised, SqlOp::Update).code, "HISTORY_IMMUTABLE");
        let other = PgErrorLike { code: Some("P0001".into()), message: Some("AUTRE: non".into()), ..Default::default() };
        assert_eq!(translate_pg_like(&other, SqlOp::Update).code, "INTERNAL_ERROR");
    }

    #[test]
    fn uuid_detail_becomes_id() {
        let e = PgErrorLike { code: Some("23505".into()), detail: Some("0190a0b2-0000-7000-8000-000000000001".into()), ..Default::default() };
        assert_eq!(translate_pg_like(&e, SqlOp::Insert).details["id"], json!("0190a0b2-0000-7000-8000-000000000001"));
        let e = PgErrorLike { code: Some("23505".into()), detail: Some("Key (x)=(1) already exists.".into()), ..Default::default() };
        assert!(!translate_pg_like(&e, SqlOp::Insert).details.contains_key("id"));
    }
}
