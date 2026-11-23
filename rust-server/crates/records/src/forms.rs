//! Shared forms and shared views — `forms/shares.ts`, `forms/shared-view.ts` and the kernel's
//! `openSharedView` / `openSharedCalendar` (chapter 15).
//!
//! The answers are written on the authority of the person who PUBLISHED the share, decided
//! again at every answer; the link is a bearer secret, kept hashed (to find it) and sealed
//! with the instance key (to show it again).

use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, FieldSet, Verdict};
use basedb_base::rbac::loader::{load_grants, load_target};
use basedb_base::rbac::require::require_on_table;
use basedb_base::time::{b64url, random_bytes};
use basedb_base::tx::{with_transaction, Actor, ActorKind, RequestContext, Surface, TxOptions};
use basedb_catalog::projection::{project_base, ProjectedField, ProjectedTable};
use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

use crate::js::js_trim;
use crate::list::{list_records, ListOptions};
use crate::pg::{col, refs, row_object, P};
use crate::quiz::{self, Condition, QuizQuestion};
use crate::values::DEFAULT_STILL_VALID;

const SEAL_PURPOSE: &str = "form-share";

const SHAREABLE_KINDS: [&str; 10] = ["short_text", "long_text", "url", "email", "number", "boolean", "date", "datetime", "select", "multi_select"];

fn omitted_reason(kind: &str) -> &'static str {
    match kind {
        "link" => "Relation : y répondre lirait une autre table.",
        "file" => "Document : le dépôt de fichiers n’est pas ouvert aux formulaires partagés.",
        "image" => "Image : le dépôt de fichiers n’est pas ouvert aux formulaires partagés.",
        _ => "Non posée.",
    }
}

const SHARE_SELECT: &str = "
  SELECT s.id, te.ref AS tenant_ref, s.view_id, s.table_id, t.base_id, s.access,
         s.token_sealed, s.is_active, s.closes_at, s.max_responses, s.response_count,
         s.last_response_at, s.published_by, u.display_name AS publisher_name,
         (u.disabled_at IS NULL AND u.deleted_at IS NULL) AS publisher_live,
         v.kind AS view_kind, v.label AS view_label, v.spec AS view_spec,
         v.description AS view_description, s.can_embed, t.color AS table_color,
         v.deleted_at IS NULL AS view_live, (t.is_live AND t.deleted_at IS NULL) AS table_live,
         coalesce((SELECT array_agg(r.role_id::text ORDER BY r.role_id)
                     FROM _basedb.form_share_role r WHERE r.share_id = s.id), '{}') AS group_ids
    FROM _basedb.form_share s
    JOIN _basedb.tenant te    ON te.id = s.tenant_id
    JOIN _basedb.view_def v   ON v.id = s.view_id
    JOIN _basedb.table_def t  ON t.id = s.table_id
    JOIN _basedb.app_user u   ON u.id = s.published_by";

type Row = Map<String, Value>;

fn text<'a>(row: &'a Row, key: &str) -> &'a str {
    row.get(key).and_then(Value::as_str).unwrap_or("")
}

fn flag(row: &Row, key: &str) -> bool {
    row.get(key).and_then(Value::as_bool).unwrap_or(false)
}

fn spec_of(row: &Row) -> Map<String, Value> {
    row.get("view_spec").and_then(Value::as_object).cloned().unwrap_or_default()
}

/// The token's hash, as a `bytea` parameter in text form.
fn hash_of(token: &str) -> P {
    let digest = Sha256::digest(token.as_bytes());
    P::text(format!("\\x{}", digest.iter().map(|b| format!("{b:02x}")).collect::<String>()))
}

/// A fresh link secret: 24 random bytes, base64url.
fn new_token() -> String {
    b64url(&random_bytes(24))
}

/// `isAnswered`: a form, a survey or a quiz is answered; every other view is read.
pub fn is_answered(kind: &str) -> bool {
    matches!(kind, "form" | "survey" | "quiz")
}

/// `authorityOf`: the publisher's context, on which the answers are written.
fn authority_of(row: &Row, request_id: &str) -> RequestContext {
    RequestContext::new(request_id, Actor::user(text(row, "published_by")), text(row, "tenant_ref"), Surface::Rest)
}

struct Authority {
    allowed: bool,
    writable: FieldSet,
}

/// `authorityOver`: may the publisher still do what the share does here?
async fn authority_over<E: Exec + Sync>(exec: &E, row: &Row, request_id: &str) -> Result<Authority, AppError> {
    let none = Authority { allowed: false, writable: FieldSet::new() };
    if !flag(row, "publisher_live") {
        return Ok(none);
    }
    let authority = authority_of(row, request_id);
    let Some(target) = load_target(exec, &authority, text(row, "table_id")).await? else { return Ok(none) };
    let action = if is_answered(text(row, "view_kind")) { Action::Create } else { Action::Read };
    let grants = load_grants(exec, &authority).await?;
    let d = decide(&authority, &grants, action, &target);
    Ok(Authority { allowed: d.verdict == Verdict::Allowed, writable: d.writable_fields })
}

fn state_of(row: &Row, allowed: bool, now: DateTime<Utc>) -> &'static str {
    if !flag(row, "is_active") {
        return "inactive";
    }
    if let Some(at) = row.get("closes_at").and_then(Value::as_str).and_then(|s| DateTime::parse_from_rfc3339(s).ok()) {
        if at.timestamp_millis() <= now.timestamp_millis() {
            return "closed";
        }
    }
    if let (Some(max), Some(count)) = (row.get("max_responses").and_then(Value::as_i64), row.get("response_count").and_then(Value::as_i64)) {
        if count >= max {
            return "full";
        }
    }
    if !allowed {
        return "authority";
    }
    "open"
}

fn to_share(row: &Row, instance_key: &str, state: &str) -> Value {
    let token = crate::sealing::unseal(instance_key, SEAL_PURPOSE, text(row, "token_sealed")).unwrap_or_default();
    json!({
        "id": row.get("id"),
        "view_id": row.get("view_id"),
        "access": row.get("access"),
        "active": row.get("is_active"),
        "token": token,
        "closes_at": row.get("closes_at"),
        "max_responses": row.get("max_responses"),
        "response_count": row.get("response_count"),
        "last_response_at": row.get("last_response_at"),
        "published_by": { "id": row.get("published_by"), "name": row.get("publisher_name") },
        "groups": row.get("group_ids"),
        "state": state,
        "can_embed": row.get("can_embed"),
        "view_kind": row.get("view_kind"),
    })
}

/// A question as a shared link asks it.
#[derive(Debug, Clone)]
struct Question {
    name: String,
    label: String,
    help: Option<String>,
    kind: String,
    required: bool,
    placeholder: Option<String>,
    prefill: Option<&'static str>,
    default: Value,
    show_if: Option<Condition>,
    points: Option<i64>,
    format: Value,
    options: Option<Vec<Value>>,
}

impl Question {
    fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "label": self.label,
            "help": self.help,
            "kind": self.kind,
            "required": self.required,
            "options": self.options,
            "placeholder": self.placeholder,
            "prefill": self.prefill,
            "default": self.default,
            "show_if": self.show_if.as_ref().map(Condition::to_json),
            "points": self.points,
            "format": self.format,
        })
    }
}

fn spec_entries(spec: &Map<String, Value>) -> Result<Vec<Map<String, Value>>, AppError> {
    let Some(Value::Array(entries)) = spec.get("fields") else { return Ok(Vec::new()) };
    entries
        .iter()
        .map(|e| match e {
            Value::Null => Err(AppError::internal("Cannot read properties of null (reading 'field')")),
            Value::Object(o) => Ok(o.clone()),
            _ => Ok(Map::new()),
        })
        .collect()
}

fn non_blank(v: Option<&Value>) -> Option<String> {
    v.and_then(Value::as_str).filter(|s| !js_trim(s).is_empty()).map(str::to_string)
}

/// A quiz question's points: one unless its author says more.
fn points_of(raw: Option<&Value>) -> i64 {
    match raw.and_then(Value::as_f64) {
        Some(f) if raw.is_some_and(Value::is_number) && f.fract() == 0.0 && (1.0..=quiz::QUIZ_MAX_POINTS as f64).contains(&f) => f as i64,
        _ => 1,
    }
}

/// `questionsOf`: the questions a shared link asks — and, beside them, those it leaves out.
async fn questions_of<E: Exec + Sync>(exec: &E, table_id: &str, spec: &Map<String, Value>, writable: Option<&FieldSet>) -> Result<(Vec<Question>, Vec<Value>), AppError> {
    let sql = format!(
        "SELECT f.id::text, n.name, f.label, f.description, f.kind, f.is_required,
                coalesce(nc.display_format, tc.display_format) AS display_format,
                nc.rating_max, nc.currency_code,
                CASE WHEN fd.field_id IS NOT NULL AND {DEFAULT_STILL_VALID} THEN fd.kind END
                  AS default_kind,
                fd.value AS default_value
           FROM _basedb.field f
           JOIN _basedb.physical_name n ON n.id = f.name_id
           LEFT JOIN _basedb.field_number_config nc ON nc.field_id = f.id
           LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
           LEFT JOIN _basedb.field_default fd ON fd.field_id = f.id
          WHERE f.table_id = $1 AND f.is_live AND f.deleted_at IS NULL"
    );
    let params = [P::text(table_id)];
    let fields: Vec<Row> = exec.rows(&sql, &refs(&params)).await?.iter().map(row_object).collect();
    let options: Vec<Row> = exec
        .rows(
            "SELECT o.field_id::text, o.value, o.label, o.color, o.icon, o.image
               FROM _basedb.select_option o
               JOIN _basedb.field f ON f.id = o.field_id
              WHERE f.table_id = $1 AND o.deleted_at IS NULL
              ORDER BY o.position",
            &refs(&params),
        )
        .await?
        .iter()
        .map(row_object)
        .collect();
    let mut questions = Vec::new();
    let mut omitted = Vec::new();
    for entry in spec_entries(spec)? {
        let Some(field) = entry.get("field").and_then(Value::as_str).and_then(|name| fields.iter().rev().find(|f| text(f, "name") == name)) else { continue };
        let label = non_blank(entry.get("label")).unwrap_or_else(|| text(field, "label").to_string());
        let kind = text(field, "kind");
        if !SHAREABLE_KINDS.contains(&kind) {
            omitted.push(json!({ "field": label, "reason": omitted_reason(kind) }));
            continue;
        }
        let id = text(field, "id");
        if writable.is_some_and(|w| !w.contains(id)) {
            omitted.push(json!({ "field": label, "reason": "Non modifiable pour la personne qui a publié." }));
            continue;
        }
        let help = non_blank(entry.get("help")).or_else(|| non_blank(field.get("description")));
        let default = match field.get("default_kind").and_then(Value::as_str) {
            None | Some("me") => Value::Null,
            Some("value") => json!({ "kind": "value", "value": field.get("default_value").cloned().unwrap_or(Value::Null) }),
            Some(k) => json!({ "kind": k }),
        };
        let format = match field.get("display_format").and_then(Value::as_str) {
            None | Some("plain" | "decimal") => Value::Null,
            Some(display) => json!({ "display": display, "rating_max": field.get("rating_max"), "currency": field.get("currency_code") }),
        };
        questions.push(Question {
            name: text(field, "name").to_string(),
            label,
            help,
            kind: kind.to_string(),
            required: entry.get("required") == Some(&Value::Bool(true)) || flag(field, "is_required"),
            placeholder: non_blank(entry.get("placeholder")),
            prefill: (entry.get("prefill").and_then(Value::as_str) == Some("today") && quiz::FORM_PREFILL_KINDS.contains(&kind)).then_some("today"),
            default,
            show_if: Condition::of(entry.get("show_if")),
            points: quiz::quiz_answer_fits(kind, entry.get("correct")).then(|| points_of(entry.get("points"))),
            format,
            options: matches!(kind, "select" | "multi_select").then(|| {
                options
                    .iter()
                    .filter(|o| text(o, "field_id") == id)
                    .map(|o| json!({ "value": o.get("value"), "label": o.get("label"), "color": o.get("color"), "icon": o.get("icon"), "image": o.get("image") }))
                    .collect()
            }),
        });
    }
    Ok((questions, omitted))
}

/// `gradingOf`: the right answers, kept on this side.
fn grading_of(spec: &Map<String, Value>, questions: &[Question]) -> Vec<QuizQuestion> {
    let entries = match spec.get("fields") {
        Some(Value::Array(e)) => e.as_slice(),
        _ => &[],
    };
    questions
        .iter()
        .map(|q| {
            let correct = entries.iter().find(|e| e.get("field").and_then(Value::as_str) == Some(q.name.as_str())).and_then(|e| e.get("correct"));
            QuizQuestion {
                field: q.name.clone(),
                kind: q.kind.clone(),
                correct: if quiz::quiz_answer_fits(&q.kind, correct) { correct.cloned() } else { None },
                points: q.points.unwrap_or(1),
            }
        })
        .collect()
}

/// `quizOf`: when it reveals, its pass mark.
fn quiz_of(spec: &Map<String, Value>) -> (&'static str, Option<i64>) {
    let reveal = spec.get("reveal").and_then(Value::as_str).and_then(|r| quiz::QUIZ_REVEALS.iter().find(|x| **x == r)).copied().unwrap_or("each");
    let pass = spec.get("pass_percent").filter(|v| v.is_number()).and_then(Value::as_f64).filter(|f| f.fract() == 0.0 && (1.0..=100.0).contains(f)).map(|f| f as i64);
    (reveal, pass)
}

/// `designOf`.
fn design_of(spec: &Map<String, Value>, table_color: &Value) -> Value {
    let t = |key: &str| spec.get(key).and_then(Value::as_str).unwrap_or("").to_string();
    let flag = |key: &str| spec.get(key) != Some(&Value::Bool(false));
    let or = |key: &str, default: &str| Some(t(key)).filter(|s| !s.is_empty()).unwrap_or_else(|| default.to_string());
    let accent = t("accent");
    let end_url = t("end_link_url");
    json!({
        "theme": or("theme", "clair"),
        "accent": if accent.is_empty() { table_color.clone() } else { json!(accent) },
        "font": or("font", "auto"),
        "align": or("align", "left"),
        "welcome_label": t("welcome_label"),
        "show_progress": flag("show_progress"),
        "show_numbers": flag("show_numbers"),
        "auto_advance": flag("auto_advance"),
        "celebrate": flag("celebrate"),
        "end_link": if end_url.is_empty() { Value::Null } else { json!({ "label": t("end_link_label"), "url": end_url }) },
    })
}

/// `formView`: the view a share may carry — not a personal one.
async fn form_view<E: Exec + Sync>(exec: &E, table_id: &str, view_id: &str) -> Result<Row, AppError> {
    let params = [P::text(view_id), P::text(table_id)];
    let view = exec
        .first("SELECT kind, label, spec, owner_id::text FROM _basedb.view_def WHERE id::text = $1 AND table_id = $2 AND deleted_at IS NULL", &refs(&params))
        .await?
        .map(|r| row_object(&r));
    let Some(view) = view else { return Err(AppError::new("RESOURCE_NOT_FOUND").with("view", json!(view_id))) };
    if !view.get("owner_id").is_none_or(Value::is_null) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("view")).with("reason", json!("vue_personnelle")));
    }
    Ok(view)
}

async fn share_where<E: Exec + Sync>(exec: &E, clause: &str, param: P) -> Result<Option<Row>, AppError> {
    let params = [param];
    Ok(exec.first(&format!("{SHARE_SELECT} WHERE {clause}"), &refs(&params)).await?.map(|r| row_object(&r)))
}

async fn sharing_of<E: Exec + Sync>(exec: &E, ctx: &RequestContext, instance_key: &str, table_id: &str, view_id: &str) -> Result<Value, AppError> {
    let view = form_view(exec, table_id, view_id).await?;
    let params = [P::text(&ctx.tenant_id)];
    let groups: Vec<Value> = exec
        .rows(
            "SELECT r.id::text, r.label FROM _basedb.role r
               JOIN _basedb.tenant t ON t.id = r.tenant_id
              WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
              ORDER BY r.label",
            &refs(&params),
        )
        .await?
        .iter()
        .map(|r| Value::Object(row_object(r)))
        .collect();
    let row = share_where(exec, "s.view_id::text = $1", P::text(view_id)).await?;
    let answered = is_answered(text(&view, "kind"));
    let Some(row) = row else {
        let omitted = if answered { questions_of(exec, table_id, &spec_of_view(&view), None).await?.1 } else { Vec::new() };
        return Ok(json!({ "share": null, "groups": groups, "omitted": omitted }));
    };
    let authority = authority_over(exec, &row, &ctx.request_id).await?;
    let omitted = if answered { questions_of(exec, text(&row, "table_id"), &spec_of(&row), Some(&authority.writable)).await?.1 } else { Vec::new() };
    let share = to_share(&row, instance_key, state_of(&row, authority.allowed, ctx.timestamp));
    Ok(json!({ "share": share, "groups": groups, "omitted": omitted }))
}

fn spec_of_view(view: &Row) -> Map<String, Value> {
    view.get("spec").and_then(Value::as_object).cloned().unwrap_or_default()
}

/// `getFormSharing`: `manage_schema` on the table.
pub async fn get_sharing(pools: &Pools, ctx: &RequestContext, instance_key: &str, table_id: &str, view_id: &str) -> Result<Value, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        sharing_of(&tx, ctx, instance_key, table_id, view_id).await
    })
    .await
}

/// The body of `PUT …/share`, as the route reads it.
pub struct ShareSettings {
    pub access: Value,
    pub active: Value,
    pub closes_at: Value,
    pub max_responses: Value,
    pub groups: Value,
    pub can_embed: Value,
}

impl ShareSettings {
    /// `body.x ?? default`, as the route defaults them (`active` only when absent).
    pub fn of(body: &Value) -> ShareSettings {
        let get = |k: &str| body.get(k).cloned();
        let or_null = |k: &str, d: Value| match get(k) {
            None | Some(Value::Null) => d,
            Some(v) => v,
        };
        ShareSettings {
            access: get("access").unwrap_or(Value::Null),
            active: get("active").unwrap_or(Value::Bool(true)),
            closes_at: or_null("closes_at", Value::Null),
            max_responses: or_null("max_responses", Value::Null),
            groups: or_null("groups", json!([])),
            can_embed: or_null("can_embed", Value::Bool(false)),
        }
    }
}

struct Checked {
    access: String,
    active: bool,
    closes_at: Value,
    max_responses: Option<i64>,
    groups: Vec<String>,
    can_embed: bool,
}

fn invalid(field: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field))
}

/// `checkSettings`, in its order.
fn check_settings(raw: &ShareSettings) -> Result<Checked, AppError> {
    let access = match raw.access.as_str() {
        Some(a @ ("public" | "members")) => a.to_string(),
        _ => return Err(invalid("access")),
    };
    let Some(active) = raw.active.as_bool() else { return Err(invalid("active")) };
    if !raw.closes_at.is_null() && !crate::history::js_date_parses(&crate::drain::js_string(&raw.closes_at)) {
        return Err(invalid("closes_at"));
    }
    let max_responses = match &raw.max_responses {
        Value::Null => None,
        v => match v.as_f64() {
            Some(f) if v.is_number() && f.fract() == 0.0 && (1.0..=1_000_000.0).contains(&f) => Some(f as i64),
            _ => return Err(invalid("max_responses")),
        },
    };
    let groups = match &raw.groups {
        Value::Array(items) if items.iter().all(Value::is_string) => items.iter().filter_map(Value::as_str).map(str::to_string).collect::<Vec<_>>(),
        _ => return Err(invalid("groups")),
    };
    let can_embed = match &raw.can_embed {
        Value::Bool(b) => *b,
        _ => return Err(invalid("can_embed")),
    };
    let mut seen = HashSet::new();
    let groups = if access == "public" { Vec::new() } else { groups.into_iter().filter(|g| seen.insert(g.clone())).collect() };
    Ok(Checked { access, active, closes_at: raw.closes_at.clone(), max_responses, groups, can_embed })
}

/// `saveFormSharing`: whoever saves becomes the publisher.
pub async fn save_sharing(pools: &Pools, ctx: &RequestContext, instance_key: &str, table_id: &str, view_id: &str, settings: &ShareSettings) -> Result<Value, AppError> {
    let checked = check_settings(settings)?;
    let checked = &checked;
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let view = form_view(&tx, table_id, view_id).await?;
        let answered = is_answered(text(&view, "kind"));
        let closes_at = if answered { checked.closes_at.clone() } else { Value::Null };
        let max_responses = if answered { checked.max_responses } else { None };
        if !checked.groups.is_empty() {
            let params = [P::text(&ctx.tenant_id), P::of(&json!(checked.groups))];
            let known = tx
                .rows(
                    "SELECT r.id::text FROM _basedb.role r JOIN _basedb.tenant t ON t.id = r.tenant_id
                      WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
                        AND r.id::text = ANY($2::text[])",
                    &refs(&params),
                )
                .await?;
            if known.len() != checked.groups.len() {
                return Err(invalid("groups"));
            }
        }
        let params = [P::text(view_id)];
        let existing = tx.first("SELECT id::text FROM _basedb.form_share WHERE view_id::text = $1", &refs(&params)).await?.map(|r| col(&r, 0));
        let max = P(max_responses.map(|m| m.to_string()));
        let share_id = match &existing {
            None => {
                let token = new_token();
                let params = [
                    P::text(&ctx.tenant_id),
                    P::text(view_id),
                    P::text(table_id),
                    P::text(&checked.access),
                    hash_of(&token),
                    P::text(crate::sealing::seal(instance_key, SEAL_PURPOSE, &token)),
                    P::text(checked.active.to_string()),
                    P::of(&closes_at),
                    max,
                    P::text(&ctx.actor.id),
                    P::text(checked.can_embed.to_string()),
                ];
                let created = tx
                    .query_op(
                        "INSERT INTO _basedb.form_share
                           (tenant_id, view_id, table_id, access, token_hash, token_sealed, is_active,
                            closes_at, max_responses, published_by, created_by, can_embed)
                         SELECT t.id, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::timestamptz, $9, $10, $10, $11
                           FROM _basedb.tenant t WHERE t.ref = $1
                         RETURNING id::text",
                        &refs(&params),
                        SqlOp::Insert,
                    )
                    .await?;
                match created.first().map(|r| col(r, 0)) {
                    Some(Value::String(id)) => id,
                    _ => return Err(AppError::new("RESOURCE_NOT_FOUND")),
                }
            }
            Some(id) => {
                let id = id.as_str().unwrap_or("").to_string();
                let params = [P::text(&id), P::text(&checked.access), P::text(checked.active.to_string()), P::of(&closes_at), max, P::text(&ctx.actor.id), P::text(checked.can_embed.to_string())];
                tx.query_op(
                    "UPDATE _basedb.form_share
                        SET access = $2, is_active = $3, closes_at = $4::timestamptz, max_responses = $5,
                            published_by = $6, can_embed = $7, updated_at = clock_timestamp()
                      WHERE id = $1::uuid",
                    &refs(&params),
                    SqlOp::Update,
                )
                .await?;
                id
            }
        };
        let params = [P::text(&share_id)];
        tx.query_op("DELETE FROM _basedb.form_share_role WHERE share_id = $1::uuid", &refs(&params), SqlOp::Delete).await?;
        for role in &checked.groups {
            let params = [P::text(&share_id), P::text(role)];
            tx.query_op("INSERT INTO _basedb.form_share_role (share_id, role_id) VALUES ($1::uuid, $2::uuid)", &refs(&params), SqlOp::Insert).await?;
        }
        let mut entry = AuditEntry::new(if existing.is_none() { "form_share.create" } else { "form_share.update" }, "view");
        entry.object_id = Some(view_id.to_string());
        entry.object_name = Some(text(&view, "label").to_string());
        entry.table_id = Some(table_id.to_string());
        entry.payload = json!({
            "access": checked.access,
            "active": checked.active,
            "closes_at": closes_at,
            "max_responses": max_responses,
            "groups": checked.groups,
            "can_embed": checked.can_embed,
        })
        .as_object()
        .cloned()
        .unwrap_or_default();
        write_audit(&tx, ctx, &entry).await?;
        sharing_of(&tx, ctx, instance_key, table_id, view_id).await
    })
    .await
}

/// `regenerateFormShare`: a new link; the old one stops working at once.
pub async fn regenerate(pools: &Pools, ctx: &RequestContext, instance_key: &str, table_id: &str, view_id: &str) -> Result<Value, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let view = form_view(&tx, table_id, view_id).await?;
        let token = new_token();
        let params = [P::text(view_id), hash_of(&token), P::text(crate::sealing::seal(instance_key, SEAL_PURPOSE, &token)), P::text(&ctx.actor.id)];
        let updated = tx
            .query_op(
                "UPDATE _basedb.form_share
                    SET token_hash = $2, token_sealed = $3, published_by = $4,
                        updated_at = clock_timestamp()
                  WHERE view_id::text = $1
                  RETURNING id::text",
                &refs(&params),
                SqlOp::Update,
            )
            .await?;
        if updated.is_empty() {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("share", json!(view_id)));
        }
        let mut entry = AuditEntry::new("form_share.regenerate", "view");
        entry.object_id = Some(view_id.to_string());
        entry.object_name = Some(text(&view, "label").to_string());
        entry.table_id = Some(table_id.to_string());
        write_audit(&tx, ctx, &entry).await?;
        sharing_of(&tx, ctx, instance_key, table_id, view_id).await
    })
    .await
}

/// `deleteFormShare`: the link is forgotten, the answers stay.
pub async fn delete_share(pools: &Pools, ctx: &RequestContext, table_id: &str, view_id: &str) -> Result<(), AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let view = form_view(&tx, table_id, view_id).await?;
        let params = [P::text(view_id)];
        tx.query_op("DELETE FROM _basedb.form_share WHERE view_id::text = $1", &refs(&params), SqlOp::Delete).await?;
        let mut entry = AuditEntry::new("form_share.delete", "view");
        entry.object_id = Some(view_id.to_string());
        entry.object_name = Some(text(&view, "label").to_string());
        entry.table_id = Some(table_id.to_string());
        write_audit(&tx, ctx, &entry).await
    })
    .await
}

// ── Answering ────────────────────────────────────────────────────────────────

struct Admitted {
    row: Row,
    writable: FieldSet,
    respondent_name: Value,
}

/// `admit`: who may answer (or read) this share, and on whose authority.
async fn admit<E: Exec + Sync>(exec: &E, token: &str, respondent: Option<&RequestContext>, request_id: &str, now: DateTime<Utc>, answer: bool) -> Result<Admitted, AppError> {
    let row = share_where(exec, "s.token_hash = $1", hash_of(token)).await?;
    let Some(row) = row.filter(|r| flag(r, "view_live") && flag(r, "table_live") && is_answered(text(r, "view_kind")) == answer) else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("share", json!("inconnu")));
    };
    let authority = authority_over(exec, &row, request_id).await?;
    let state = state_of(&row, authority.allowed, now);
    if state != "open" {
        return Err(AppError::new(if answer { "FORM_CLOSED" } else { "VIEW_SHARE_CLOSED" }).with("reason", json!(state)));
    }
    let mut respondent_name = Value::Null;
    if text(&row, "access") == "members" {
        let Some(person) = respondent.filter(|r| r.actor.kind == ActorKind::User) else {
            return Err(AppError::new("AUTHENTICATION_REQUIRED").with("form", json!("membres")));
        };
        if person.tenant_id != text(&row, "tenant_ref") {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("form", json!("inconnu")));
        }
        let params = [P::text(&person.actor.id), P::of(row.get("group_ids").unwrap_or(&Value::Null))];
        let found = exec
            .first(
                "SELECT u.display_name,
                        (cardinality($2::text[]) = 0 OR EXISTS (
                           SELECT 1 FROM _basedb.role_member m
                            WHERE m.user_id = u.id AND m.role_id::text = ANY($2::text[]))) AS member
                   FROM _basedb.app_user u WHERE u.id = $1",
                &refs(&params),
            )
            .await?
            .map(|r| row_object(&r));
        let Some(found) = found else { return Err(AppError::new("AUTHENTICATION_REQUIRED")) };
        if !flag(&found, "member") {
            return Err(AppError::new(if answer { "FORM_RESTRICTED" } else { "VIEW_SHARE_RESTRICTED" }));
        }
        respondent_name = found.get("display_name").cloned().unwrap_or(Value::Null);
    }
    Ok(Admitted { row, writable: authority.writable, respondent_name })
}

/// `openSharedForm`: what the page shows. No right on the table is needed.
pub async fn open_form(pools: &Pools, token: &str, respondent: Option<&RequestContext>, request_id: &str) -> Result<Value, AppError> {
    let exec = pools.catalog().await?;
    let a = admit(&exec, token, respondent, request_id, Utc::now(), true).await?;
    let spec = spec_of(&a.row);
    let (questions, _) = questions_of(&exec, text(&a.row, "table_id"), &spec, Some(&a.writable)).await?;
    if questions.is_empty() {
        return Err(AppError::new("FORM_CLOSED").with("reason", json!("sans_question")));
    }
    let t = |key: &str| spec.get(key).and_then(Value::as_str).unwrap_or("").to_string();
    let kind = text(&a.row, "view_kind");
    let quiz = (kind == "quiz").then(|| {
        let (reveal, pass) = quiz_of(&spec);
        json!({ "reveal": reveal, "pass_percent": pass })
    });
    Ok(json!({
        "kind": if kind == "survey" || kind == "quiz" { kind } else { "form" },
        "title": if js_trim(&t("title")).is_empty() { text(&a.row, "view_label").to_string() } else { t("title") },
        "description": t("description"),
        "submit_label": t("submit_label"),
        "success_message": t("success_message"),
        "allow_another": spec.get("allow_another") != Some(&Value::Bool(false)),
        "access": a.row.get("access"),
        "respondent": a.respondent_name,
        "questions": questions.iter().map(Question::to_json).collect::<Vec<_>>(),
        "design": design_of(&spec, a.row.get("table_color").unwrap_or(&Value::Null)),
        "quiz": quiz,
    }))
}

/// `isEmpty` of the submission: what is not written.
fn is_blank(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::String(s) => js_trim(s).is_empty(),
        Value::Array(a) => a.is_empty(),
        _ => false,
    }
}

/// `submitSharedForm`: ONE row, written on the publisher's authority, as the person who
/// answered — or as the form, when it is public. A place among `max_responses` is taken
/// before the row is written, and given back if it is refused.
pub async fn submit_form(pools: &Pools, token: &str, respondent: Option<&RequestContext>, request_id: &str, values: &Value) -> Result<Value, AppError> {
    let Value::Object(given) = values else { return Err(invalid("values")) };
    let now = Utc::now();
    let (a, questions, score_field) = {
        let exec = pools.catalog().await?;
        let a = admit(&exec, token, respondent, request_id, now, true).await?;
        let spec = spec_of(&a.row);
        let (questions, _) = questions_of(&exec, text(&a.row, "table_id"), &spec, Some(&a.writable)).await?;
        let score_field = if text(&a.row, "view_kind") == "quiz" { score_field_of(&exec, &a.row, &a.writable).await? } else { None };
        (a, questions, score_field)
    };
    let row = &a.row;
    let spec = spec_of(row);
    let asked: HashSet<&str> = questions.iter().map(|q| q.name.as_str()).collect();
    let keys = basedb_catalog::js::js_order(values.clone());
    if let Some(unknown) = keys.as_object().and_then(|o| o.keys().find(|k| !asked.contains(k.as_str())).cloned()) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!(unknown)).with("reason", json!("question_inconnue")));
    }
    let shown: HashSet<String> = quiz::visible_questions(&questions.iter().map(|q| (q.name.clone(), q.show_if.clone())).collect::<Vec<_>>(), given).into_iter().collect();
    if let Some(lacking) = questions.iter().find(|q| shown.contains(&q.name) && q.required && quiz::is_empty_answer(given.get(&q.name))) {
        return Err(AppError::new("REQUIRED_VALUE_MISSING").with("field", json!(lacking.name)));
    }
    let mut kept: Map<String, Value> = Map::new();
    if let Value::Object(ordered) = &keys {
        for (name, value) in ordered {
            if shown.contains(name) && !is_blank(value) {
                kept.insert(name.clone(), value.clone());
            }
        }
    }
    if kept.is_empty() {
        return Err(AppError::new("REQUIRED_VALUE_MISSING").with("reason", json!("reponse_vide")));
    }
    let graded = (text(row, "view_kind") == "quiz").then(|| quiz::score_quiz(&grading_of(&spec, &questions), &kept, &shown));
    let mut written: HashSet<String> = asked.iter().map(|s| s.to_string()).collect();
    if let (Some((score, _, _)), Some(field)) = (&graded, &score_field) {
        kept.insert(field.clone(), json!(score));
        written.insert(field.clone());
    }

    let authority = authority_of(row, request_id);
    let writer = match respondent {
        Some(r) if text(row, "access") == "members" => r.clone(),
        _ => {
            let mut ctx = RequestContext::new(request_id, Actor { kind: ActorKind::Form, id: text(row, "published_by").to_string(), token_id: Some(text(row, "id").to_string()) }, text(row, "tenant_ref"), Surface::Rest);
            ctx.timestamp = now;
            ctx
        }
    };
    let share_id = text(row, "id").to_string();
    let share_id = &share_id;
    let taken = with_transaction(pools, PoolName::Catalog, &authority, TxOptions::default(), |tx| async move {
        let params = [P::text(share_id)];
        tx.query_op(
            "UPDATE _basedb.form_share
                SET response_count = response_count + 1, last_response_at = clock_timestamp()
              WHERE id = $1::uuid AND (max_responses IS NULL OR response_count < max_responses)
              RETURNING id::text",
            &refs(&params),
            SqlOp::Update,
        )
        .await
    })
    .await?;
    if taken.is_empty() {
        return Err(AppError::new("FORM_CLOSED").with("reason", json!("full")));
    }
    let entries: Vec<(String, Value)> = kept.into_iter().collect();
    if let Err(e) = crate::write::create_record_for(pools, &authority, &writer, text(row, "table_id"), entries, &written).await {
        let _ = with_transaction(pools, PoolName::Catalog, &authority, TxOptions::default(), |tx| async move {
            let params = [P::text(share_id)];
            tx.query_op("UPDATE _basedb.form_share SET response_count = greatest(response_count - 1, 0) WHERE id = $1::uuid", &refs(&params), SqlOp::Update).await
        })
        .await;
        return Err(e);
    }
    let quiz = graded.map(|(score, max, marks)| {
        let (reveal, pass) = quiz_of(&spec);
        let grading = grading_of(&spec, &questions);
        let marks: Vec<Value> = if reveal == "never" {
            Vec::new()
        } else {
            marks
                .iter()
                .filter_map(|m| {
                    let correct = grading.iter().find(|g| g.field == m.field)?.correct.clone()?;
                    Some(json!({ "field": m.field, "right": m.right, "points": m.points, "of": m.of, "correct": correct }))
                })
                .collect()
        };
        json!({ "score": score, "max": max, "passed": quiz::quiz_passed(score, max, pass), "marks": marks })
    });
    Ok(json!({ "received": true, "quiz": quiz }))
}

/// `scoreFieldOf`: a live number the publisher may write — else none.
async fn score_field_of<E: Exec + Sync>(exec: &E, row: &Row, writable: &FieldSet) -> Result<Option<String>, AppError> {
    let spec = spec_of(row);
    let Some(name) = spec.get("score_field").and_then(Value::as_str).filter(|s| !s.is_empty()) else { return Ok(None) };
    let params = [P::text(text(row, "table_id")), P::text(name)];
    let field = exec
        .first(
            "SELECT f.id::text
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1 AND n.name = $2 AND f.kind = 'number'
                AND f.is_live AND f.deleted_at IS NULL",
            &refs(&params),
        )
        .await?
        .map(|r| col(&r, 0));
    Ok(field.and_then(|f| f.as_str().map(str::to_string)).filter(|id| writable.contains(id)).map(|_| name.to_string()))
}

/// `checkSharedAnswer`: one answer of a quiz that shows its right answers as it goes.
pub async fn check_answer(pools: &Pools, token: &str, respondent: Option<&RequestContext>, request_id: &str, field: &str, value: &Value) -> Result<Value, AppError> {
    let exec = pools.catalog().await?;
    let a = admit(&exec, token, respondent, request_id, Utc::now(), true).await?;
    let spec = spec_of(&a.row);
    if text(&a.row, "view_kind") != "quiz" || quiz_of(&spec).0 != "each" {
        return Err(AppError::new("REQUEST_INVALID").with("reason", json!("correction_a_la_fin")));
    }
    let (questions, _) = questions_of(&exec, text(&a.row, "table_id"), &spec, Some(&a.writable)).await?;
    let grading = grading_of(&spec, &questions);
    let Some((q, correct)) = grading.iter().find(|q| q.field == field).and_then(|q| q.correct.as_ref().map(|c| (q, c))) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!("question_non_notee")));
    };
    let right = quiz::is_right_answer(&q.kind, correct, Some(value));
    Ok(json!({ "right": right, "points": if right { q.points } else { 0 }, "correct": correct }))
}

// ── Shared views ─────────────────────────────────────────────────────────────

/// `admitSharedView`.
struct AdmittedView {
    authority: RequestContext,
    row: Row,
    reader: Value,
}

async fn admit_view(pools: &Pools, token: &str, reader: Option<&RequestContext>, request_id: &str) -> Result<AdmittedView, AppError> {
    let exec = pools.catalog().await?;
    let a = admit(&exec, token, reader, request_id, Utc::now(), false).await?;
    Ok(AdmittedView { authority: authority_of(&a.row, request_id), row: a.row, reader: a.respondent_name })
}

const SHOWN_KEYS: [(&str, &[&str]); 5] = [
    ("kanban", &["title_field", "group_by", "cover_field"]),
    ("calendar", &["title_field", "date_field", "end_field", "color_field"]),
    ("timeline", &["title_field", "start_field", "end_field", "group_by", "color_field", "depends_on"]),
    ("gallery", &["title_field", "cover_field", "color_field"]),
    ("list", &["title_field", "group_by"]),
];

const PAGE_KEYS: [&str; 17] = [
    "title_field", "card_fields", "cover_field", "cover_fit", "card_size", "group_by", "group_order", "date_field", "end_field", "start_field", "color_field", "depends_on", "mode", "scale",
    "column_widths", "row_height", "manual_order",
];

fn names(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items.iter().filter_map(Value::as_str).map(str::to_string).collect(),
        _ => Vec::new(),
    }
}

/// `shownFields`: the fields a view shows, in its order, among those the publisher reads.
fn shown_fields(kind: &str, spec: &Map<String, Value>, table: &ProjectedTable) -> Vec<ProjectedField> {
    let business: Vec<&ProjectedField> = table.fields.iter().filter(|f| !f.system).collect();
    let by_name = |n: &str| business.iter().find(|f| f.name == n).copied();
    if kind == "grid" {
        let hidden: HashSet<String> = names(spec.get("hidden")).into_iter().collect();
        let order = names(spec.get("column_order"));
        let ordered = order.iter().filter_map(|n| by_name(n)).chain(business.iter().copied().filter(|f| !order.contains(&f.name)));
        return ordered.filter(|f| !hidden.contains(&f.name)).cloned().collect();
    }
    let keys = SHOWN_KEYS.iter().find(|(k, _)| *k == kind).map(|(_, keys)| *keys).unwrap_or(&[]);
    let mut wanted: Vec<Option<String>> = keys.iter().map(|k| spec.get(*k).and_then(Value::as_str).map(str::to_string)).collect();
    wanted.extend(names(spec.get("card_fields")).into_iter().map(Some));
    if !spec.get("title_field").is_some_and(Value::is_string) {
        if let Some(display) = &table.display_field {
            wanted.insert(0, Some(display.clone()));
        }
    }
    let mut out: Vec<ProjectedField> = Vec::new();
    for name in wanted.into_iter().flatten() {
        if let Some(f) = by_name(&name) {
            if !out.iter().any(|o| o.name == f.name) {
                out.push(f.clone());
            }
        }
    }
    out
}

/// `sharedField`.
fn shared_field(f: &ProjectedField) -> Value {
    let mut out = Map::new();
    out.insert("name".into(), json!(f.name));
    out.insert("label".into(), json!(f.label));
    out.insert("kind".into(), json!(f.kind));
    if let Some(options) = &f.options {
        out.insert("options".into(), Value::Array(options.iter().map(|o| o.to_json()).collect()));
    }
    if let Some(format) = &f.format {
        out.insert("format".into(), json!({ "display": format.display, "currency": format.currency, "rating_max": format.rating_max }));
    }
    if let Some(c) = &f.computed {
        out.insert("computed".into(), json!({ "result_kind": c.result_kind, "multiple": c.multiple }));
    }
    Value::Object(out)
}

/// `pageSpec`: presentation keys naming only fields it shows.
fn page_spec(spec: &Map<String, Value>, shown: &HashSet<String>, sorted: bool) -> Value {
    let mut out = Map::new();
    for key in PAGE_KEYS {
        let Some(value) = spec.get(key) else { continue };
        if sorted && key == "manual_order" {
            continue;
        }
        let v = if key.ends_with("_field") || key == "group_by" || key == "depends_on" {
            match value.as_str() {
                Some(s) if shown.contains(s) => json!(s),
                _ => Value::Null,
            }
        } else if key == "card_fields" {
            json!(names(Some(value)).into_iter().filter(|n| shown.contains(n)).collect::<Vec<_>>())
        } else {
            value.clone()
        };
        out.insert(key.into(), v);
    }
    Value::Object(out)
}

fn holds_people(f: &ProjectedField) -> bool {
    f.kind == "user" || f.computed.as_ref().is_some_and(|c| c.result_kind == "user")
}

fn people_in(rows: &[Row], fields: &[ProjectedField]) -> Vec<String> {
    let mut ids: Vec<String> = Vec::new();
    for f in fields.iter().filter(|f| holds_people(f)) {
        for row in rows {
            let values = match row.get(&f.name) {
                Some(Value::Array(a)) => a.clone(),
                Some(v) => vec![v.clone()],
                None => vec![Value::Null],
            };
            for id in values {
                if let Some(id) = id.as_str().filter(|s| !s.is_empty()) {
                    if !ids.iter().any(|x| x == id) {
                        ids.push(id.to_string());
                    }
                }
            }
        }
    }
    ids
}

/// `sharedRow`: the shown fields, a relation by its display alone, a person by their name.
fn shared_row(row: &Row, fields: &[ProjectedField], people: &std::collections::HashMap<String, Value>) -> Value {
    let mut out = Map::new();
    if let Some(id) = row.get("_id") {
        out.insert("_id".into(), id.clone());
    }
    let person = |id: &Value| match id.as_str().filter(|s| !s.is_empty()) {
        Some(id) => json!({ "display": people.get(id).cloned().unwrap_or(Value::Null) }),
        None => Value::Null,
    };
    let display = |v: &Value| json!({ "display": v.get("display").filter(|d| !d.is_null()).cloned().unwrap_or(Value::Null) });
    for f in fields {
        let value = row.get(&f.name);
        let v = if holds_people(f) {
            match value {
                Some(Value::Array(a)) => Value::Array(a.iter().map(person).collect()),
                Some(v) => person(v),
                None => Value::Null,
            }
        } else if f.kind == "link" {
            match value {
                None | Some(Value::Null) => Value::Null,
                Some(v) => display(v),
            }
        } else if f.kind == "multi_link" {
            match value {
                Some(Value::Array(a)) => Value::Array(a.iter().map(display).collect()),
                _ => Value::Null,
            }
        } else {
            match value {
                Some(v) => v.clone(),
                None => continue,
            }
        };
        out.insert(f.name.clone(), v);
    }
    Value::Object(out)
}

/// `sortOf`: the view's sort, cut to what the publisher reads.
fn sort_of(spec: &Map<String, Value>, readable: &HashSet<String>) -> String {
    let Some(Value::Array(sorts)) = spec.get("sorts") else { return String::new() };
    sorts
        .iter()
        .filter_map(|t| {
            let field = t.get("field")?.as_str()?;
            readable.contains(field).then(|| if t.get("direction").and_then(Value::as_str) == Some("desc") { format!("-{field}") } else { field.to_string() })
        })
        .collect::<Vec<_>>()
        .join(",")
}

/// `filterRefused`: a filter naming a field the publisher cannot read closes the page.
fn filter_refused(e: AppError) -> AppError {
    if e.code == "FILTER_FIELD_UNKNOWN" {
        AppError::new("VIEW_SHARE_CLOSED").with("reason", json!("filtre"))
    } else {
        e
    }
}

async fn view_table(pools: &Pools, view: &AdmittedView) -> Result<ProjectedTable, AppError> {
    let base = project_base(pools, &view.authority, text(&view.row, "base_id")).await?;
    let table_id = text(&view.row, "table_id");
    base.tables.into_iter().find(|t| t.id == table_id).ok_or_else(|| AppError::new("VIEW_SHARE_CLOSED").with("reason", json!("authority")))
}

/// `openSharedView`: its shown fields and a page of its rows, on the publisher's authority.
pub async fn open_view(pools: &Pools, instance_key: &str, token: &str, reader: Option<&RequestContext>, request_id: &str, after: Option<String>) -> Result<Value, AppError> {
    let view = admit_view(pools, token, reader, request_id).await?;
    let table = view_table(pools, &view).await?;
    let kind = text(&view.row, "view_kind");
    let spec = spec_of(&view.row);
    let shown = shown_fields(kind, &spec, &table);
    let readable: HashSet<String> = table.fields.iter().map(|f| f.name.clone()).collect();
    let sort = sort_of(&spec, &readable);
    let options = ListOptions {
        table_id: text(&view.row, "table_id").to_string(),
        filter: spec.get("filter").and_then(Value::as_str).map(str::to_string),
        sort: (!sort.is_empty()).then(|| sort.clone()),
        select: Some(shown.iter().map(|f| f.name.clone()).collect()),
        limit: Some(if kind == "grid" { 100.0 } else { 250.0 }),
        after,
        ..Default::default()
    };
    let page = list_records(pools, &view.authority, instance_key, &options).await.map_err(filter_refused)?;
    let rows = if page.file_columns.is_empty() {
        page.rows
    } else {
        crate::files::with_file_links(&crate::files::link_key(instance_key), &view.authority.tenant_id, view.authority.timestamp, page.rows, &page.file_columns)
    };
    let ids = people_in(&rows, &shown);
    let mut people = std::collections::HashMap::new();
    if !ids.is_empty() {
        let exec = pools.catalog().await?;
        let params = [P::text(&view.authority.tenant_id), P::of(&json!(ids))];
        for r in exec
            .rows(
                "SELECT u.id::text, NULLIF(u.display_name, '') AS display_name
                   FROM _basedb.app_user u
                   JOIN _basedb.tenant t ON t.id = u.tenant_id
                  WHERE t.ref = $1 AND u.id = ANY($2::uuid[])",
                &refs(&params),
            )
            .await?
        {
            let o = row_object(&r);
            people.insert(text(&o, "id").to_string(), o.get("display_name").cloned().unwrap_or(Value::Null));
        }
    }
    let shown_names: HashSet<String> = shown.iter().map(|f| f.name.clone()).collect();
    Ok(json!({
        "data": {
            "kind": kind,
            "title": view.row.get("view_label"),
            "description": view.row.get("view_description"),
            "access": view.row.get("access"),
            "reader": view.reader,
            "can_embed": view.row.get("can_embed"),
            "fields": shown.iter().map(shared_field).collect::<Vec<_>>(),
            "spec": page_spec(&spec, &shown_names, !sort.is_empty()),
            "rows": rows.iter().map(|r| shared_row(r, &shown, &people)).collect::<Vec<_>>(),
        },
        "meta": { "next_cursor": page.next_cursor },
    }))
}

/// `openSharedCalendar`: the iCalendar feed of a shared calendar or timeline.
pub async fn open_calendar(pools: &Pools, instance_key: &str, token: &str, request_id: &str, host: &str) -> Result<String, AppError> {
    let view = admit_view(pools, token, None, request_id).await.map_err(|e| {
        if e.code == "AUTHENTICATION_REQUIRED" {
            AppError::new("VIEW_SHARE_RESTRICTED").with("reason", json!("flux_public_seulement"))
        } else {
            e
        }
    })?;
    let kind = text(&view.row, "view_kind").to_string();
    if kind != "calendar" && kind != "timeline" {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("view", json!("calendrier")));
    }
    let table = view_table(pools, &view).await?;
    let spec = spec_of(&view.row);
    let shown = shown_fields(&kind, &spec, &table);
    let mut rows: Vec<Row> = Vec::new();
    let mut after: Option<String> = None;
    loop {
        let options = ListOptions {
            table_id: text(&view.row, "table_id").to_string(),
            filter: spec.get("filter").and_then(Value::as_str).map(str::to_string),
            select: Some(shown.iter().map(|f| f.name.clone()).collect()),
            limit: Some(250.0),
            after: after.take(),
            ..Default::default()
        };
        let page = list_records(pools, &view.authority, instance_key, &options).await.map_err(filter_refused)?;
        rows.extend(page.rows);
        after = page.next_cursor;
        if after.is_none() || rows.len() >= quiz::CALENDAR_MAX_EVENTS {
            break;
        }
    }
    let events = quiz::calendar_events(&kind, &spec, &shown, &rows, host);
    Ok(quiz::ics_calendar(text(&view.row, "view_label"), &events, Utc::now()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(v: Value) -> Result<Checked, AppError> {
        check_settings(&ShareSettings::of(&v))
    }

    #[test]
    fn settings_are_checked_in_nodes_order() {
        let code = |v: Value| settings(v).err().map(|e| e.details.get("field").cloned().unwrap_or(Value::Null));
        assert_eq!(code(json!({})), Some(json!("access")));
        assert_eq!(code(json!({ "access": "public", "active": null })), Some(json!("active")));
        assert_eq!(code(json!({ "access": "public", "closes_at": "bientôt" })), Some(json!("closes_at")));
        assert_eq!(code(json!({ "access": "public", "max_responses": 1.5 })), Some(json!("max_responses")));
        assert_eq!(code(json!({ "access": "public", "groups": [1] })), Some(json!("groups")));
        assert_eq!(code(json!({ "access": "public", "can_embed": "oui" })), Some(json!("can_embed")));
        let ok = settings(json!({ "access": "members", "max_responses": 3.0, "groups": ["a", "b", "a"] })).unwrap();
        assert_eq!((ok.active, ok.max_responses, ok.groups.len()), (true, Some(3), 2));
        assert!(settings(json!({ "access": "public", "groups": ["a"] })).unwrap().groups.is_empty());
    }

    #[test]
    fn page_spec_keeps_presentation_only() {
        let spec = json!({ "filter": "x", "title_field": "a", "card_fields": ["a", "z"], "group_by": "z", "manual_order": [1], "mode": null });
        let shown: HashSet<String> = ["a".to_string()].into_iter().collect();
        assert_eq!(page_spec(spec.as_object().unwrap(), &shown, true), json!({ "title_field": "a", "card_fields": ["a"], "group_by": null, "mode": null }));
    }

    #[test]
    fn sorts_are_cut_to_what_is_read() {
        let spec = json!({ "sorts": [{ "field": "a", "direction": "desc" }, { "field": "b" }, { "field": "c" }] });
        let readable: HashSet<String> = ["a".to_string(), "c".to_string()].into_iter().collect();
        assert_eq!(sort_of(spec.as_object().unwrap(), &readable), "-a,c");
    }
}
