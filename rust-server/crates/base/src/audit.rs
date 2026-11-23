//! Le journal d'audit et le journal de sécurité, tels `audit/journal.ts`.
//!
//! [`write_audit`] s'écrit DANS la transaction de l'opération qu'il décrit (passer le `Tx`) :
//! une opération annulée ne laisse pas de trace, une trace ne survit pas à son opération.
//! [`write_security`] consigne un refus (jeton inconnu, révoqué…) ; un refus anonyme sans
//! adresse n'apprend rien et n'est pas écrit.

use crate::db::Exec;
use crate::error::{AppError, SqlOp};
use crate::time::is_uuid;
use crate::tx::{ActorKind, RequestContext};
use serde_json::{Map, Value};

/// `AuditEntry`.
#[derive(Debug, Clone, Default)]
pub struct AuditEntry {
    pub action: String,
    pub object_kind: String,
    pub object_id: Option<String>,
    pub object_name: Option<String>,
    pub base_id: Option<String>,
    pub table_id: Option<String>,
    pub payload: Map<String, Value>,
}

impl AuditEntry {
    pub fn new(action: &str, object_kind: &str) -> AuditEntry {
        AuditEntry { action: action.into(), object_kind: object_kind.into(), ..Default::default() }
    }
}

/// `writeAudit`.
pub async fn write_audit<E: Exec + Sync>(exec: &E, ctx: &RequestContext, entry: &AuditEntry) -> Result<(), AppError> {
    let token = if ctx.actor.kind == ActorKind::Token { ctx.actor.token_id.clone() } else { None };
    let request_id = is_uuid(&ctx.request_id).then(|| ctx.request_id.clone());
    let payload = Value::Object(entry.payload.clone()).to_string();
    exec.execute_op(
        "INSERT INTO _basedb.audit_log
           (tenant_id, base_id, table_id, actor_kind, actor_user_id, actor_token_id, surface,
            action, object_kind, object_id, object_name, payload, request_id)
         SELECT t.id, $2::text::uuid, $3::text::uuid, $4, $5::text::uuid, $6::text::uuid, $7, $8, $9, $10::text::uuid, $11, $12::text::jsonb, $13::text::uuid
           FROM _basedb.tenant t
          WHERE t.ref = $1",
        &[
            &ctx.tenant_id,
            &entry.base_id,
            &entry.table_id,
            &ctx.actor.kind.as_str(),
            &ctx.actor.id,
            &token,
            &ctx.surface.as_str(),
            &entry.action,
            &entry.object_kind,
            &entry.object_id,
            &entry.object_name,
            &payload,
            &request_id,
        ],
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}

/// A security event (`writeSecurity`'s entry).
#[derive(Debug, Clone, Default)]
pub struct SecurityEntry<'a> {
    pub token_id: Option<&'a str>,
    pub user_id: Option<&'a str>,
    pub route: &'a str,
    pub error_code: &'a str,
    pub request_id: Option<&'a str>,
    pub ip: Option<&'a str>,
}

/// `writeSecurity`.
pub async fn write_security<E: Exec + Sync>(exec: &E, e: &SecurityEntry<'_>) -> Result<(), AppError> {
    let token = e.token_id.filter(|t| !t.is_empty());
    let user = e.user_id.filter(|u| !u.is_empty());
    let ip = e.ip.filter(|i| !i.is_empty());
    let kind = if token.is_some() { "token" } else if user.is_some() { "user" } else { "anonymous" };
    if kind == "anonymous" && ip.is_none() {
        return Ok(());
    }
    let route = e.route.split('?').next().unwrap_or("");
    let request_id = e.request_id.filter(|r| r.len() == 36 && r.chars().all(|c| c.is_ascii_hexdigit() || c == '-'));
    exec.execute_op(
        "INSERT INTO _basedb.security_log
           (actor_kind, actor_user_id, actor_token_id, ip, route, error_code, request_id)
         VALUES ($1, $2::text::uuid, $3::text::uuid, $4::text::inet, $5, $6, $7::text::uuid)",
        &[
            &kind,
            &if kind == "user" { user } else { None },
            &if kind == "token" { token } else { None },
            &ip,
            &route,
            &e.error_code,
            &request_id,
        ],
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}
