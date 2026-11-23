//! `auth/profile.ts`, `auth/oidc-providers.ts` (reading), the reset request of
//! `auth/operations.ts`: one's own account and the ways into it.

use crate::common::{audit, bounded, fields, js_trim, lenient_json, nfc, require_elevated_session, valid_email};
use crate::mail_texts;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Extension;
use basedb_base::auth::operations::{normalize_email, who_am_i, Authenticated};
use basedb_base::auth::routes::serialize_me;
use basedb_base::auth::{cookie_holder, open_context};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{empty, json_ok, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::mailer::MailMessage;
use basedb_base::time::{b64url, random_bytes, sha256};
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_contracts::is_locale;
use chrono::{DateTime, Utc};
use serde_json::{json, Value};

const NOTIFICATION_KINDS: [&str; 4] = ["mention", "reply", "assigned", "automation"];

/// app.ts's `accountHolder`: the session cookie's holder, as an actor.
pub(crate) async fn account_holder(st: &Shared, headers: &HeaderMap, rid: &RequestId) -> Result<(Authenticated, RequestContext), AppError> {
    let who = cookie_holder(st, headers).await?;
    let ctx = open_context(st, &who.user_id, &rid.0, Surface::Rest, None).await?;
    Ok((who, ctx))
}

fn refuse_token_actor(ctx: &RequestContext) -> Result<(), AppError> {
    if ctx.actor.kind != ActorKind::User {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    Ok(())
}

fn invalid(field: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field))
}

/// `checkKinds`: every entry known, kept in the canonical order.
fn check_kinds(value: &Value, field: &str) -> Result<Vec<String>, AppError> {
    let Some(items) = value.as_array() else { return Err(invalid(field)) };
    if items.iter().any(|k| !k.as_str().is_some_and(|k| NOTIFICATION_KINDS.contains(&k))) {
        return Err(invalid(field));
    }
    Ok(NOTIFICATION_KINDS.iter().filter(|k| items.iter().any(|i| i.as_str() == Some(**k))).map(|k| k.to_string()).collect())
}

async fn me_response(st: &Shared, who: &Authenticated) -> ApiResult {
    let me = who_am_i(&st.pools, who).await?;
    Ok(json_ok(json!({ "data": serialize_me(st, &me) })))
}

/// `PATCH /auth/me`.
pub async fn update_profile(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let (who, ctx) = account_holder(&st, &headers, &rid).await?;
    let body = fields(&body)?;
    refuse_token_actor(&ctx)?;
    let display_name = match body.get("display_name") {
        None => None,
        Some(v) => Some(crate::common::check_name(v.as_str())?),
    };
    let date_format = match body.get("date_format") {
        None => None,
        Some(v) => match v.as_str() {
            Some(f @ ("dmy" | "iso")) => Some(f.to_string()),
            _ => return Err(invalid("date_format")),
        },
    };
    let week_start = match body.get("week_start") {
        None => None,
        Some(v) => match v.as_f64() {
            Some(n) if n == 0.0 || n == 1.0 => Some(n as i16),
            _ => return Err(invalid("week_start")),
        },
    };
    let muted = match body.get("muted_notifications") {
        None => None,
        Some(v) => Some(check_kinds(v, "muted_notifications")?),
    };
    let mailed = match body.get("mailed_notifications") {
        None => None,
        Some(v) => Some(check_kinds(v, "mailed_notifications")?),
    };
    let locale_given = body.get("locale").is_some();
    let locale = match body.get("locale") {
        None | Some(Value::Null) => None,
        Some(v) => match v.as_str() {
            Some(l) if is_locale(l) => Some(l.to_string()),
            _ => return Err(invalid("locale")),
        },
    };
    if display_name.is_none() && date_format.is_none() && week_start.is_none() && muted.is_none() && mailed.is_none() && !locale_given {
        return Err(invalid("display_name, date_format, week_start, muted_notifications, mailed_notifications, locale"));
    }
    let c = &ctx;
    let (dn, df, ms, ml, lc) = (&display_name, &date_format, &muted, &mailed, &locale);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        tx.execute_op(
            "UPDATE _basedb.app_user u
                SET display_name = coalesce($3, u.display_name),
                    date_format = coalesce($4, u.date_format),
                    week_start = coalesce($5::smallint, u.week_start),
                    muted_notifications = coalesce($6::text[], u.muted_notifications),
                    locale = CASE WHEN $7 THEN $8::text ELSE u.locale END,
                    mailed_notifications = coalesce($9::text[], u.mailed_notifications),
                    updated_at = clock_timestamp(), updated_by = u.id
               FROM _basedb.tenant t
              WHERE u.id = $1::text::uuid AND t.id = u.tenant_id AND t.ref = $2",
            &[&c.actor.id, &c.tenant_id, dn, df, &week_start, ms, &locale_given, lc, ml],
            SqlOp::Update,
        )
        .await
    })
    .await?;
    me_response(&st, &who).await
}

/// `PUT /auth/me/email`.
pub async fn change_email(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, bytes: Bytes) -> ApiResult {
    let body = lenient_json(&bytes);
    let (who, ctx) = account_holder(&st, &headers, &rid).await?;
    let raw = fields(&body)?.get("email").cloned();
    refuse_token_actor(&ctx)?;
    let email = raw.as_ref().and_then(Value::as_str).map(|e| js_trim(&nfc(e)).to_string()).unwrap_or_default();
    if !valid_email(&email) {
        return Err(invalid("email"));
    }
    let (c, e, s) = (&ctx, &email, &who.session_id);
    let previous = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        let user = tx
            .first(
                "SELECT u.email, u.display_name, u.tenant_id::text, u.locale,
                        EXISTS (SELECT 1 FROM _basedb.auth_identity i
                                 WHERE i.user_id = u.id AND i.provider = 'password') AS has_password
                   FROM _basedb.app_user u
                   JOIN _basedb.tenant t ON t.id = u.tenant_id
                  WHERE u.id = $1::text::uuid AND t.ref = $2",
                &[&c.actor.id, &c.tenant_id],
            )
            .await?;
        let Some(user) = user else { return Err(AppError::new("AUTHENTICATION_REQUIRED")) };
        let (address, display_name, tenant_id, locale, has_password): (String, String, String, Option<String>, bool) = (user.get(0), user.get(1), user.get(2), user.get(3), user.get(4));
        if !has_password {
            return Err(AppError::new("ACTION_FORBIDDEN").with("reason", json!("adresse_du_fournisseur")));
        }
        require_elevated_session(&tx, c, s).await?;
        if &address == e {
            return Ok(None);
        }
        let taken = tx
            .rows(
                "SELECT u.id FROM _basedb.app_user u
                  WHERE u.tenant_id = $1::text::uuid AND lower(u.email) = lower($2)
                    AND u.deleted_at IS NULL AND u.id <> $4::text::uuid
                 UNION ALL
                 SELECT i.user_id FROM _basedb.auth_identity i
                  WHERE i.provider = 'password' AND i.subject = $3 AND i.user_id <> $4::text::uuid",
                &[&tenant_id, e, &normalize_email(e), &c.actor.id],
            )
            .await?;
        if !taken.is_empty() {
            return Err(AppError::new("EMAIL_TAKEN").with("field", json!("email")));
        }
        tx.execute_op(
            "UPDATE _basedb.app_user
                SET email = $2, updated_at = clock_timestamp(), updated_by = $1::text::uuid
              WHERE id = $1::text::uuid",
            &[&c.actor.id, e],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op(
            "UPDATE _basedb.auth_identity SET subject = $2
              WHERE user_id = $1::text::uuid AND provider = 'password'",
            &[&c.actor.id, &normalize_email(e)],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op(
            "UPDATE _basedb.confirmation_challenge SET consumed_at = clock_timestamp()
              WHERE actor_user_id = $1::text::uuid AND operation = 'password.reset' AND consumed_at IS NULL",
            &[&c.actor.id],
            SqlOp::Update,
        )
        .await?;
        audit(&tx, c, "user.email_change", "app_user", Some(&c.actor.id), Some(&display_name), json!({ "previous": address, "next": e })).await?;
        Ok(Some((address, locale)))
    })
    .await?;
    if let Some((address, locale)) = previous {
        if normalize_email(&address) != normalize_email(&email) && st.mailer.available() {
            let accept = headers.get("accept-language").and_then(|v| v.to_str().ok());
            let l = mail_texts::mail_locale(locale.as_deref(), accept);
            let message = MailMessage {
                to: address,
                subject: mail_texts::email_changed_subject(&l),
                body: mail_texts::email_changed(&l, &email),
                ..Default::default()
            };
            let _ = st.mailer.send(&message).await;
        }
    }
    me_response(&st, &who).await
}

// ------------------------------------------------------------------------------------
// OIDC providers, as the interface lists them (the exchange is `oidc.rs`)
// ------------------------------------------------------------------------------------

pub struct Preset {
    pub label: &'static str,
    pub issuer: Option<&'static str>,
}

pub fn preset(slug: &str) -> Option<Preset> {
    Some(match slug {
        "google" => Preset { label: "Google", issuer: Some("https://accounts.google.com") },
        "microsoft" => Preset { label: "Microsoft", issuer: None },
        "entra" => Preset { label: "Microsoft Entra ID", issuer: None },
        "gitlab" => Preset { label: "GitLab", issuer: Some("https://gitlab.com") },
        "keycloak" => Preset { label: "Keycloak", issuer: None },
        _ => return None,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct Provider {
    pub slug: String,
    pub label: String,
}

pub(crate) fn valid_slug(slug: &str) -> bool {
    !slug.is_empty() && slug.split('-').all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()))
}

/// server.ts's `oidcProviders()`: the ones the environment declares, complete.
pub fn env_providers(setting: impl Fn(&str) -> Option<String>) -> Vec<Provider> {
    crate::oidc::env_providers(setting).into_iter().map(|p| Provider { slug: p.slug, label: p.label }).collect()
}

pub(crate) fn setting_text(v: Option<&Value>) -> Option<String> {
    v.and_then(Value::as_str).map(js_trim).filter(|s| !s.is_empty()).map(str::to_string)
}

/// `loadProviders`: the environment's, then the catalog's, narrowed by the tenant — the slug
/// and the label, and nothing else.
pub async fn load_providers<E: Exec + Sync>(exec: &E, st: &Shared, tenant_ref: &str) -> Result<Vec<Provider>, AppError> {
    Ok(crate::oidc::load_providers(exec, st, tenant_ref).await?.into_iter().map(|p| Provider { slug: p.slug, label: p.label }).collect())
}

/// `GET /auth/oidc/providers`.
pub async fn oidc_providers(State(st): State<Shared>) -> ApiResult {
    let exec = st.pools.catalog().await?;
    let providers = load_providers(&exec, &st, st.cfg.auth_tenant()).await?;
    Ok(json_ok(json!({ "data": providers.iter().map(|p| json!({ "slug": p.slug, "label": p.label })).collect::<Vec<_>>() })))
}

/// `GET /auth/identities`.
pub async fn identities(State(st): State<Shared>, headers: HeaderMap) -> ApiResult {
    let who = cookie_holder(&st, &headers).await?;
    let exec = st.pools.catalog().await?;
    let rows = exec
        .rows(
            "SELECT provider, created_at, last_used_at FROM _basedb.auth_identity
              WHERE user_id = $1::text::uuid ORDER BY created_at",
            &[&who.user_id],
        )
        .await?;
    let providers = load_providers(&exec, &st, &who.tenant_ref).await?;
    let identities: Vec<(String, String, Value)> = rows
        .iter()
        .map(|r| {
            let p: String = r.get(0);
            let provider = if p == "password" { p } else { p.strip_prefix("oidc:").map(str::to_string).unwrap_or(p) };
            let created: DateTime<Utc> = r.get(1);
            let used: Option<DateTime<Utc>> = r.get(2);
            (provider, crate::common::iso(created), crate::common::iso_opt(used))
        })
        .collect();
    // `new Map(...)`: the last identity of a provider wins.
    let linked = |slug: &str| identities.iter().rev().find(|i| i.0 == slug);
    let mut shown: Vec<Provider> = providers.clone();
    for i in &identities {
        if i.0 != "password" && !providers.iter().any(|p| p.slug == i.0) {
            shown.push(Provider { slug: i.0.clone(), label: i.0.clone() });
        }
    }
    Ok(json_ok(json!({
        "data": {
            "password": linked("password").is_some(),
            "providers": shown.iter().map(|p| {
                let l = linked(&p.slug);
                json!({
                    "slug": p.slug,
                    "label": p.label,
                    "linked_at": l.map(|l| json!(l.1)).unwrap_or(Value::Null),
                    "last_used_at": l.map(|l| l.2.clone()).unwrap_or(Value::Null),
                })
            }).collect::<Vec<_>>(),
        }
    })))
}

// ------------------------------------------------------------------------------------
// Password reset request
// ------------------------------------------------------------------------------------

const RESET_TTL_MS: i64 = 30 * 60 * 1000;

async fn request_password_reset(st: &Shared, email: &str, accept_language: Option<&str>) -> Result<(), AppError> {
    let email = normalize_email(email);
    let exec = st.pools.catalog().await?;
    let identity = exec
        .first(
            "SELECT i.user_id::text, u.email, i.password_hash,
                    (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS usable
               FROM _basedb.auth_identity i
               JOIN _basedb.app_user u ON u.id = i.user_id
               JOIN _basedb.tenant t   ON t.id = u.tenant_id
              WHERE i.provider = 'password' AND i.subject = $1",
            &[&email],
        )
        .await?;
    let Some(identity) = identity else { return Ok(()) };
    let (user_id, address, hash, usable): (String, String, Option<String>, bool) = (identity.get(0), identity.get(1), identity.get(2), identity.get(3));
    if hash.is_none() || !usable {
        return Ok(());
    }
    exec.execute_op(
        "UPDATE _basedb.confirmation_challenge
            SET consumed_at = clock_timestamp()
          WHERE actor_user_id = $1::text::uuid AND operation = 'password.reset' AND consumed_at IS NULL",
        &[&user_id],
        SqlOp::Update,
    )
    .await?;
    let value = b64url(&random_bytes(32));
    let expires = Utc::now() + chrono::Duration::milliseconds(RESET_TTL_MS);
    exec.execute_op(
        "INSERT INTO _basedb.confirmation_challenge
           (actor_user_id, operation, target_kind, target_id, challenge_hash, expires_at)
         VALUES ($1::text::uuid, 'password.reset', 'app_user', $1::text::uuid, $2, $3)",
        &[&user_id, &sha256(value.as_bytes()).to_vec(), &expires],
        SqlOp::Insert,
    )
    .await?;
    let locale: Option<String> = exec.first("SELECT locale FROM _basedb.app_user WHERE id = $1::text::uuid", &[&user_id]).await?.and_then(|r| r.get(0));
    if !st.mailer.available() {
        return Ok(());
    }
    let l = mail_texts::mail_locale(locale.as_deref(), accept_language);
    let root = st.cfg.public_url.as_deref().map(|u| u.trim_end_matches('/').to_string());
    let body = match root {
        None => mail_texts::reset_with_code(&l, &value),
        Some(root) => {
            let encoded: String = form_urlencoded::byte_serialize(value.as_bytes()).collect();
            mail_texts::reset_with_link(&l, &format!("{root}/?reinitialisation={encoded}"))
        }
    };
    let message = MailMessage { to: address, subject: mail_texts::reset_subject(&l), body, automatic: true, ..Default::default() };
    let _ = st.mailer.send(&message).await;
    Ok(())
}

/// `POST /auth/password/reset/request`: `202` always.
pub async fn reset_request(State(st): State<Shared>, headers: HeaderMap, bytes: Bytes) -> Response {
    if let Err(res) = bounded(&st, &headers) {
        return res;
    }
    let outcome: ApiResult = async {
        let body = lenient_json(&bytes);
        if let Some(email) = fields(&body)?.get("email").and_then(Value::as_str) {
            let accept = headers.get("accept-language").and_then(|v| v.to_str().ok());
            request_password_reset(&st, email, accept).await?;
        }
        Ok(empty(StatusCode::ACCEPTED))
    }
    .await;
    outcome.unwrap_or_else(IntoResponse::into_response)
}

/// `DELETE /auth/oidc/{slug}/link`: an elevated session lets go of one provider — never of
/// the last way in.
pub async fn oidc_unlink(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, axum::extract::Path(slug): axum::extract::Path<String>) -> ApiResult {
    let (who, ctx) = account_holder(&st, &headers, &rid).await?;
    let (c, s, slug) = (&ctx, &who.session_id, &slug);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::default(), |tx| async move {
        require_elevated_session(&tx, c, s).await?;
        let remaining = tx
            .first("SELECT count(*)::int AS n FROM _basedb.auth_identity WHERE user_id = $1::text::uuid", &[&c.actor.id])
            .await?
            .map(|r| r.get::<_, i32>(0))
            .unwrap_or(0);
        if remaining <= 1 {
            return Err(AppError::new("REQUEST_INVALID").with("reason", json!("derniere_identite")));
        }
        tx.execute_op(
            "DELETE FROM _basedb.auth_identity WHERE user_id = $1::text::uuid AND provider = $2",
            &[&c.actor.id, &format!("oidc:{slug}")],
            SqlOp::Delete,
        )
        .await?;
        audit(&tx, c, "user.identity_unlink", "app_user", Some(&c.actor.id), None, json!({ "provider": slug })).await
    })
    .await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn kinds_keep_the_canonical_order() {
        assert_eq!(check_kinds(&json!(["automation", "mention"]), "f").unwrap(), vec!["mention", "automation"]);
        assert!(check_kinds(&json!(["bruit"]), "f").is_err());
        assert!(check_kinds(&json!("mention"), "f").is_err());
        assert!(check_kinds(&json!([]), "f").unwrap().is_empty());
    }

    #[test]
    fn environment_providers() {
        let env: HashMap<&str, &str> = [
            ("BASEDB_OIDC_PROVIDERS", " Google, bad_slug, mon-sso, keycloak "),
            ("BASEDB_OIDC_GOOGLE_CLIENT_ID", "id"),
            ("BASEDB_OIDC_GOOGLE_CLIENT_SECRET", "s"),
            ("BASEDB_OIDC_MON_SSO_ISSUER", "https://sso"),
            ("BASEDB_OIDC_MON_SSO_CLIENT_ID", "id"),
            ("BASEDB_OIDC_MON_SSO_CLIENT_SECRET", "s"),
            ("BASEDB_OIDC_MON_SSO_LABEL", "Maison"),
            ("BASEDB_OIDC_KEYCLOAK_CLIENT_ID", "id"),
            ("BASEDB_OIDC_KEYCLOAK_CLIENT_SECRET", "s"),
        ]
        .into_iter()
        .collect();
        let got = env_providers(|n| env.get(n).map(|v| v.to_string()));
        assert_eq!(got, vec![Provider { slug: "google".into(), label: "Google".into() }, Provider { slug: "mon-sso".into(), label: "Maison".into() }]);
    }
}
