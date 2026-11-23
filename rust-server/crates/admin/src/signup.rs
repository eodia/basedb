//! `auth/signup.ts` and `auth/bootstrap.ts`: one's own account, the first administrator,
//! the sign-up policy — and the invitation link's page, which precedes both.

use crate::common::{administering, audit, bounded, check_name, checked_email, fields, lenient_json, require_elevated_session, user_agent, with_cookies};
use crate::groups::ensure_system_groups;
use crate::sharing::{find_invitation, invitation_preview};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use axum::Extension;
use basedb_base::auth::operations::normalize_email;
use basedb_base::auth::password::{check_password_policy, hash_password};
use basedb_base::auth::session::{create_session, csrf_for};
use basedb_base::auth::{bearer_context, known_address, session_cookies};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::require::require_administration;
use basedb_base::time::sha256;
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use chrono::Utc;
use serde_json::{json, Value};

const KEY: &str = "auth.signup";

#[derive(Debug, Clone, PartialEq)]
pub struct Policy {
    pub open: bool,
    pub domains: Vec<String>,
}

impl Policy {
    pub fn json(&self) -> Value {
        json!({ "open": self.open, "domains": self.domains })
    }
}

/// `readPolicy`.
pub fn policy_of(value: Option<&Value>) -> Policy {
    let Some(value) = value else { return Policy { open: true, domains: vec![] } };
    Policy {
        open: value.get("open") != Some(&Value::Bool(false)),
        domains: value.get("domains").and_then(Value::as_array).map(|a| a.iter().filter_map(|d| d.as_str().map(str::to_string)).collect()).unwrap_or_default(),
    }
}

pub async fn read_policy<E: Exec + Sync>(exec: &E, tenant_ref: &str) -> Result<Policy, AppError> {
    let row = exec
        .first(
            "SELECT s.value FROM _basedb.setting s
               JOIN _basedb.tenant t ON t.id = s.tenant_id
              WHERE s.scope_kind = 'tenant' AND t.ref = $1 AND s.key = $2",
            &[&tenant_ref, &KEY],
        )
        .await?;
    let value: Option<Value> = row.map(|r| r.get(0));
    Ok(policy_of(value.as_ref()))
}

fn domain_label(s: &str) -> bool {
    let b = s.as_bytes();
    !b.is_empty()
        && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
        && b[0] != b'-'
        && b[b.len() - 1] != b'-'
}

/// `normalizeDomain`: `@Exemple.FR ` → `exemple.fr`.
pub fn normalize_domain(raw: &Value) -> Result<String, AppError> {
    let domain = match raw.as_str() {
        Some(s) => {
            let d = crate::common::js_trim(s).to_lowercase();
            d.strip_prefix('@').map(str::to_string).unwrap_or(d)
        }
        None => String::new(),
    };
    let labels: Vec<&str> = domain.split('.').collect();
    if labels.len() < 2 || !labels.iter().all(|l| domain_label(l)) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("domains")).with("value", raw.clone()));
    }
    Ok(domain)
}

pub async fn get_public_policy(State(st): State<Shared>) -> ApiResult {
    let conn = st.pools.catalog().await?;
    let policy = read_policy(&conn, st.cfg.auth_tenant()).await?;
    if !policy.open {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    Ok(json_ok(json!({ "data": policy.json() })))
}

pub async fn get_admin_policy(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let c = &ctx;
    let policy = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::read_only(), |tx| async move {
        require_administration(&tx, c).await?;
        read_policy(&tx, &c.tenant_id).await
    })
    .await?;
    Ok(json_ok(json!({ "data": policy.json() })))
}

pub async fn set_admin_policy(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let (ctx, session_id) = administering(&st, &headers, &rid, &tenant).await?;
    let body = fields(&body)?;
    let (Some(open), Some(domains)) = (body.get("open").and_then(Value::as_bool), body.get("domains").and_then(Value::as_array)) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("policy")));
    };
    let mut unique: Vec<String> = Vec::new();
    for raw in domains {
        let d = normalize_domain(raw)?;
        if !unique.contains(&d) {
            unique.push(d);
        }
    }
    let policy = Policy { open, domains: unique };
    let (c, s, p) = (&ctx, &session_id, &policy);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_administration(&tx, c).await?;
        require_elevated_session(&tx, c, s).await?;
        tx.execute_op(
            "INSERT INTO _basedb.setting (scope_kind, tenant_id, key, value, updated_by)
             SELECT 'tenant', t.id, $2, $3::text::jsonb, $4::text::uuid FROM _basedb.tenant t WHERE t.ref = $1
             ON CONFLICT (scope_kind, tenant_id, key)
             DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                           updated_at = clock_timestamp()",
            &[&c.tenant_id, &KEY, &p.json().to_string(), &c.actor.id],
            SqlOp::Insert,
        )
        .await?;
        audit(&tx, c, "signup.policy", "tenant", None, Some(&c.tenant_id), p.json()).await
    })
    .await?;
    Ok(json_ok(json!({ "data": policy.json() })))
}

/// The fields `signUp` and `bootstrapAdministrator` both check, before any transaction.
struct Applicant {
    email: String,
    display_name: String,
    stored: String,
}

async fn applicant(st: &Shared, body: &Value) -> Result<Applicant, AppError> {
    let s = |k: &str| body.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let (email, name, password) = (s("email"), s("display_name"), s("password"));
    let email = checked_email(&email)?;
    let display_name = check_name(Some(&name))?;
    check_password_policy(&password, &email, &display_name)?;
    let stored = hash_password(st.instance_key()?, &password).await?;
    Ok(Applicant { email, display_name, stored })
}

/// Runs `work` between a bare `BEGIN` and `COMMIT` — the two roads to an account set no
/// actor on the transaction: none exists yet. A [`TxGuard`] rolls back a transaction whose
/// future is dropped mid-way, so the connection never returns to the pool inside it.
async fn bare_transaction<T, F, Fut>(st: &Shared, work: F) -> Result<T, AppError>
where
    F: FnOnce(std::sync::Arc<basedb_base::db::Conn>) -> Fut,
    Fut: std::future::Future<Output = (std::sync::Arc<basedb_base::db::Conn>, Result<T, AppError>)>,
{
    let conn = std::sync::Arc::new(st.pools.catalog().await?);
    conn.execute_op("BEGIN", &[], SqlOp::Select).await?;
    let mut guard = basedb_base::tx::TxGuard::new(conn.clone());
    let (conn, outcome) = work(conn).await;
    match outcome {
        Ok(v) => {
            conn.execute_op("COMMIT", &[], SqlOp::Select).await?;
            guard.disarm();
            Ok(v)
        }
        Err(e) => {
            if conn.client().batch_execute("ROLLBACK").await.is_ok() {
                guard.disarm();
            }
            Err(e)
        }
    }
}

struct Opened {
    token: String,
    csrf: String,
}

async fn open_session<E: Exec + Sync>(st: &Shared, exec: &E, user_id: &str, tenant_uuid: &str, ip: Option<&str>, agent: Option<&str>) -> Result<Opened, AppError> {
    let (token, _session, _absolute) = create_session(exec, user_id, tenant_uuid, ip, agent, Utc::now()).await?;
    let csrf = csrf_for(st.instance_key()?, &sha256(token.as_bytes()));
    Ok(Opened { token, csrf })
}

fn signed_in(opened: Opened, tenant_ref: &str) -> Response {
    let res = json_ok(json!({ "data": { "csrf": opened.csrf, "tenant": tenant_ref } }));
    with_cookies(res, session_cookies(&opened.token, &opened.csrf))
}

fn seal_audit_context(rid: &RequestId, user_id: &str, tenant_ref: &str) -> RequestContext {
    let mut ctx = RequestContext::new(rid.0.clone(), Actor::user(user_id), tenant_ref, Surface::Ui);
    ctx.deadline = ctx.timestamp;
    ctx
}

#[allow(clippy::too_many_arguments)]
async fn create_account<E: Exec + Sync>(st: &Shared, exec: &E, rid: &RequestId, tenant_ref: &str, a: &Applicant, invitation: Option<&str>, ip: Option<&str>, agent: Option<&str>) -> Result<Opened, AppError> {
    let Some(tenant) = exec.first("SELECT id::text FROM _basedb.tenant WHERE ref = $1 AND deleted_at IS NULL", &[&tenant_ref]).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    };
    let tenant_id: String = tenant.get(0);
    let invited = match invitation {
        Some(token) => find_invitation(exec, tenant_ref, token, false, None).await?.is_some(),
        None => false,
    };
    if !invited {
        let policy = read_policy(exec, tenant_ref).await?;
        if !policy.open {
            return Err(AppError::new("RESOURCE_NOT_FOUND"));
        }
        let domain = a.email.rsplit('@').next().unwrap_or("").to_lowercase();
        if !policy.domains.is_empty() && !policy.domains.contains(&domain) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("email")).with("reason", json!("domaine_refuse")).with("domains", json!(policy.domains)));
        }
    }
    let subject = normalize_email(&a.email);
    let taken = exec
        .rows(
            "SELECT u.id FROM _basedb.app_user u
              WHERE u.tenant_id = $1::text::uuid AND lower(u.email) = lower($2) AND u.deleted_at IS NULL
             UNION ALL
             SELECT i.user_id FROM _basedb.auth_identity i
              WHERE i.provider = 'password' AND i.subject = $3",
            &[&tenant_id, &a.email, &subject],
        )
        .await?;
    if !taken.is_empty() {
        return Err(AppError::new("EMAIL_TAKEN").with("field", json!("email")));
    }
    let rows = exec
        .query_op(
            "WITH fresh AS (SELECT _basedb_local.uuid_generate_v7() AS id)
             INSERT INTO _basedb.app_user (id, tenant_id, email, display_name, created_by, updated_by)
             SELECT fresh.id, $1::text::uuid, $2, $3, fresh.id, fresh.id FROM fresh
             RETURNING id::text",
            &[&tenant_id, &a.email, &a.display_name],
            SqlOp::Insert,
        )
        .await?;
    let user_id: String = rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("compte non créé"))?;
    exec.execute_op(
        "INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
         VALUES ($1::text::uuid, 'password', $2, $3)",
        &[&user_id, &subject, &a.stored],
        SqlOp::Insert,
    )
    .await?;
    ensure_system_groups(exec, tenant_ref, &user_id).await?;
    let ctx = seal_audit_context(rid, &user_id, tenant_ref);
    audit(exec, &ctx, "user.signup", "app_user", Some(&user_id), Some(&a.display_name), json!({ "invited": invited })).await?;
    open_session(st, exec, &user_id, &tenant_id, ip, agent).await
}

pub async fn sign_up(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, bytes: Bytes) -> Response {
    let address = match bounded(&st, &headers) {
        Ok(a) => a,
        Err(res) => return res,
    };
    let outcome: ApiResult = async {
        let body = lenient_json(&bytes);
        let body = fields(&body)?;
        let invitation = body.get("invitation").and_then(Value::as_str).map(str::to_string);
        let a = applicant(&st, body).await?;
        let tenant_ref = st.cfg.auth_tenant();
        let ip = known_address(&address).map(str::to_string);
        let agent = user_agent(&headers).map(str::to_string);
        let (s, r, t, ap) = (&st, &rid, &tenant_ref, &a);
        let opened = bare_transaction(&st, |conn| async move {
            let out = create_account(s, &*conn, r, t, ap, invitation.as_deref(), ip.as_deref(), agent.as_deref()).await;
            (conn, out)
        })
        .await?;
        Ok(signed_in(opened, tenant_ref))
    }
    .await;
    outcome.unwrap_or_else(IntoResponse::into_response)
}

pub async fn preview_invitation(State(st): State<Shared>, headers: HeaderMap, bytes: Bytes) -> Response {
    if let Err(res) = bounded(&st, &headers) {
        return res;
    }
    let outcome: ApiResult = async {
        let body = lenient_json(&bytes);
        let token = fields(&body)?.get("token").and_then(Value::as_str).unwrap_or("").to_string();
        let conn = st.pools.catalog().await?;
        let preview = invitation_preview(&conn, st.cfg.auth_tenant(), &token).await?;
        Ok(json_ok(json!({ "data": preview })))
    }
    .await;
    outcome.unwrap_or_else(IntoResponse::into_response)
}

/// `bootstrapOpen`: no instance administrator yet — the first visit will create one.
pub async fn bootstrap_is_open(st: &Shared) -> Result<bool, AppError> {
    bootstrap_open(&st.pools.catalog().await?).await
}

/// What `bootstrapInstance` found or created.
pub struct Bootstrapped {
    pub user_id: String,
    pub email: String,
    pub already_done: bool,
}

/// `bootstrapInstance` (`BASEDB_BOOTSTRAP=1`): the tenant's first administrator, or the instance
/// created for `email` — `RESOURCE_NOT_FOUND` when there is none and no address to create it.
pub async fn bootstrap_instance(st: &Shared, tenant_ref: &str, email: Option<&str>) -> Result<Bootstrapped, AppError> {
    let conn = st.pools.catalog().await?;
    let found = conn
        .first(
            "SELECT u.id::text, u.email
               FROM _basedb.tenant t
               JOIN _basedb.app_user u ON u.tenant_id = t.id AND u.is_instance_admin
              WHERE t.ref = $1
              ORDER BY u.created_at
              LIMIT 1",
            &[&tenant_ref],
        )
        .await?;
    drop(conn);
    if let Some(r) = found {
        return Ok(Bootstrapped { user_id: r.get(0), email: r.get(1), already_done: true });
    }
    let Some(email) = email else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("tenant", json!(tenant_ref)));
    };
    let user_id = bare_transaction(st, |conn| async move {
        let out = create_instance(&*conn, tenant_ref, email, "Administration").await.map(|(_, user)| user);
        (conn, out)
    })
    .await?;
    Ok(Bootstrapped { user_id, email: email.to_string(), already_done: false })
}

async fn bootstrap_open<E: Exec + Sync>(exec: &E) -> Result<bool, AppError> {
    let row = exec.first("SELECT NOT EXISTS (SELECT 1 FROM _basedb.app_user WHERE is_instance_admin) AS open", &[]).await?;
    Ok(row.is_some_and(|r| r.get::<_, bool>(0)))
}

pub async fn get_bootstrap(State(st): State<Shared>) -> ApiResult {
    let conn = st.pools.catalog().await?;
    if !bootstrap_open(&conn).await? {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    Ok(json_ok(json!({ "data": { "open": true } })))
}

/// `createInstance`: the tenant, its first administrator, the system groups, a project.
async fn create_instance<E: Exec + Sync>(exec: &E, tenant_ref: &str, email: &str, display_name: &str) -> Result<(String, String), AppError> {
    let rows = exec
        .query_op(
            "INSERT INTO _basedb.tenant (ref, label, is_system, created_by)
             VALUES ($1, $2, true, _basedb_local.uuid_generate_v7())
             RETURNING id::text, created_by::text",
            &[&tenant_ref, &tenant_ref],
            SqlOp::Insert,
        )
        .await?;
    let row = rows.first().ok_or_else(|| AppError::internal("tenant non créé"))?;
    let (tenant_id, user_id): (String, String) = (row.get(0), row.get(1));
    exec.execute_op(
        "INSERT INTO _basedb.app_user
           (id, tenant_id, email, display_name, is_system, is_instance_admin, created_by, updated_by)
         VALUES ($1::text::uuid, $2::text::uuid, $3, $4, true, true, $1::text::uuid, $1::text::uuid)",
        &[&user_id, &tenant_id, &email, &display_name],
        SqlOp::Insert,
    )
    .await?;
    ensure_system_groups(exec, tenant_ref, &user_id).await?;
    exec.execute_op(
        "INSERT INTO _basedb.project (tenant_id, label, label_key, created_by, updated_by)
         VALUES ($1::text::uuid, 'Projet principal', 'projet principal', $2::text::uuid, $2::text::uuid)",
        &[&tenant_id, &user_id],
        SqlOp::Insert,
    )
    .await?;
    Ok((tenant_id, user_id))
}

async fn create_administrator<E: Exec + Sync>(st: &Shared, exec: &E, rid: &RequestId, tenant_ref: &str, a: &Applicant, ip: Option<&str>, agent: Option<&str>) -> Result<Opened, AppError> {
    exec.rows("SELECT pg_advisory_xact_lock(hashtext('basedb.bootstrap'))", &[]).await?;
    if !bootstrap_open(exec).await? {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let (tenant_id, user_id) = create_instance(exec, tenant_ref, &a.email, &a.display_name).await?;
    exec.execute_op(
        "INSERT INTO _basedb.auth_identity (user_id, provider, subject, password_hash)
         VALUES ($1::text::uuid, 'password', $2, $3)",
        &[&user_id, &normalize_email(&a.email), &a.stored],
        SqlOp::Insert,
    )
    .await?;
    let ctx = seal_audit_context(rid, &user_id, tenant_ref);
    audit(exec, &ctx, "bootstrap.consumed", "app_user", Some(&user_id), Some(&a.display_name), json!({})).await?;
    open_session(st, exec, &user_id, &tenant_id, ip, agent).await
}

pub async fn post_bootstrap(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, bytes: Bytes) -> Response {
    let address = match bounded(&st, &headers) {
        Ok(a) => a,
        Err(res) => return res,
    };
    let outcome: ApiResult = async {
        let body = lenient_json(&bytes);
        let a = applicant(&st, fields(&body)?).await?;
        let tenant_ref = st.cfg.auth_tenant();
        let ip = known_address(&address).map(str::to_string);
        let agent = user_agent(&headers).map(str::to_string);
        let (s, r, t, ap) = (&st, &rid, &tenant_ref, &a);
        let opened = bare_transaction(&st, |conn| async move {
            let out = create_administrator(s, &*conn, r, t, ap, ip.as_deref(), agent.as_deref()).await;
            (conn, out)
        })
        .await?;
        Ok(signed_in(opened, tenant_ref))
    }
    .await;
    outcome.unwrap_or_else(IntoResponse::into_response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domains_are_normalized_or_refused() {
        assert_eq!(normalize_domain(&json!(" @Exemple.FR ")).unwrap(), "exemple.fr");
        assert_eq!(normalize_domain(&json!("a-b.c0.org")).unwrap(), "a-b.c0.org");
        for bad in [json!("exemple"), json!("-a.fr"), json!("a-.fr"), json!("a..fr"), json!(3), json!("é.fr")] {
            let e = normalize_domain(&bad).unwrap_err();
            assert_eq!(e.code, "REQUEST_INVALID");
        }
    }

    #[test]
    fn policy_defaults_open() {
        assert_eq!(policy_of(None), Policy { open: true, domains: vec![] });
        assert_eq!(policy_of(Some(&json!({ "open": 0, "domains": ["a.fr", 2] }))), Policy { open: true, domains: vec!["a.fr".into()] });
        assert!(!policy_of(Some(&json!({ "open": false }))).open);
    }
}
