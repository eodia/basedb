//! `ai/automation-copilot.ts`: the copilot of the automations (chapter 17 §6). The person
//! asks; the copilot answers and PROPOSES automations whole, checked as a save would check
//! them — nothing here writes. Built on the `ai` crate's copilot (catalog, reads, provider).

use crate::catalog::{check_automation_draft, list_automations, list_runs};
use crate::defs::{chars_slice, js_string, js_trim, wire_steps, TRIGGER_ROW};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Extension;
use basedb_ai::attachments::{attach_to, read_attachments, Attachment};
use basedb_ai::copilot::{load_catalog, run_read, trim_conversation, Catalog};
use basedb_ai::language::in_language;
use basedb_ai::provider::{assert_quota, invoke, InvokeOptions, Usage};
use basedb_base::auth::bearer_context;
use basedb_base::auth::routes::screen_language;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, ApiResult, AppError};
use basedb_base::idempotency::js_stringify;
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::{administers, require_on_base};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::{RequestId, Shared};
use basedb_catalog::http::{fields as body_fields, strict_json};
use basedb_catalog::js::js_order;
use basedb_catalog::projection::resolve_base;
use serde_json::{json, Map, Value};

const SYSTEM: &str = include_str!("../prompts/AUTOMATION_COPILOT_SYSTEM.txt");
const MAX_READ_ROUNDS: usize = 3;
const MAX_READS_PER_ROUND: usize = 3;
const MAX_ACTIONS: usize = 2;
const MAX_RUNS: usize = 10;
const MAX_PEOPLE: usize = 100;
const TURN_TIMEOUT_MS: u64 = 90_000;
const TURN_MAX_TOKENS: u32 = 8_000;

fn schema() -> &'static Value {
    static S: std::sync::OnceLock<Value> = std::sync::OnceLock::new();
    S.get_or_init(|| serde_json::from_str(include_str!("../prompts/AUTOMATION_COPILOT_SCHEMA.json")).expect("schéma"))
}

type Raw = Map<String, Value>;

/// What the route hands in (`AutomationCopilotRequest`).
pub struct AutomationCopilotRequest {
    pub base_id: String,
    pub automation_id: Option<String>,
    pub draft: Option<Raw>,
    pub messages: Vec<(String, String)>,
    pub read_data: bool,
    pub language: String,
    pub attachments: Vec<Attachment>,
}

fn record(v: Option<&Value>) -> Raw {
    match v {
        Some(Value::Object(m)) => m.clone(),
        _ => Map::new(),
    }
}

/// `String(x)`, `undefined` included.
fn str_of(v: Option<&Value>) -> String {
    v.map_or_else(|| "undefined".into(), js_string)
}

fn cut(text: &str, max: usize) -> String {
    if text.chars().count() > max {
        format!("{}…", chars_slice(text, max))
    } else {
        text.to_string()
    }
}

/// A text quoted in a line, unless it opens with its own quotes.
fn quoted(text: &str) -> String {
    let short = cut(js_trim(text), 60);
    if short.starts_with('«') {
        short
    } else {
        format!("« {short} »")
    }
}

/// `===` of two JSON values: objects and arrays are never the same.
fn strict_eq(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Object(_) | Value::Array(_), _) | (_, Value::Object(_) | Value::Array(_)) => false,
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        _ => a == b,
    }
}

/// `JSON.stringify(value, keys)`: the replacer list filters the keys of every object, at
/// every depth, and orders them.
fn stringify_keys(v: &Value, keys: &[String]) -> String {
    match v {
        Value::Object(m) => {
            let parts: Vec<String> = keys.iter().filter_map(|k| m.get(k).map(|x| format!("{}:{}", js_stringify(&Value::String(k.clone())), stringify_keys(x, keys)))).collect();
            format!("{{{}}}", parts.join(","))
        }
        Value::Array(items) => format!("[{}]", items.iter().map(|x| stringify_keys(x, keys)).collect::<Vec<_>>().join(",")),
        other => js_stringify(other),
    }
}

/// A refusal of the kernel, in the words the model and the person read.
fn reason_of(e: &AppError) -> String {
    let said: Vec<String> = ["reason", "field", "detail", "step"]
        .iter()
        .filter_map(|k| match e.details.get(*k) {
            Some(v @ (Value::String(_) | Value::Number(_))) => Some(js_string(v)),
            _ => None,
        })
        .collect();
    if said.is_empty() {
        e.code.to_string()
    } else {
        format!("{} ({})", e.code, said.join(" · "))
    }
}

/// Every step of a flow, the paths' included, in the order it is read.
fn flatten(steps: &[Value]) -> Vec<Raw> {
    let mut out = vec![];
    for item in steps {
        let s = record(Some(item));
        let paths = s.get("paths").and_then(Value::as_array).cloned();
        let inner = s.get("steps").and_then(Value::as_array).cloned();
        out.push(s);
        for p in paths.iter().flatten() {
            if let Some(Value::Array(st)) = p.get("steps") {
                out.extend(flatten(st));
            }
        }
        if let Some(inner) = inner {
            out.extend(flatten(&inner));
        }
    }
    out
}

/// A flow with each step rewritten — the paths' and the loops' included.
fn map_steps(steps: Option<&Value>, edit: &dyn Fn(Raw) -> Raw) -> Vec<Value> {
    let Some(Value::Array(items)) = steps else { return vec![] };
    items
        .iter()
        .map(|item| {
            let mut step = edit(record(Some(item)));
            if matches!(step.get("steps"), Some(Value::Array(_))) {
                let inner = map_steps(step.get("steps"), edit);
                step.insert("steps".into(), Value::Array(inner));
            }
            if let Some(Value::Array(paths)) = step.get("paths").cloned() {
                let mapped = paths
                    .iter()
                    .map(|p| {
                        let mut path = record(Some(p));
                        let inner = map_steps(path.get("steps"), edit);
                        path.insert("steps".into(), Value::Array(inner));
                        Value::Object(path)
                    })
                    .collect();
                step.insert("paths".into(), Value::Array(mapped));
            }
            Value::Object(step)
        })
        .collect()
}

fn step_label(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "update_record" => "Modifier une ligne",
        "create_record" => "Créer une ligne",
        "find_record" => "Chercher une ligne",
        "notify" => "Prévenir quelqu’un",
        "email" => "Envoyer un courriel",
        "webhook" => "Appeler un webhook",
        "slack" => "Envoyer sur Slack",
        "ai" => "Demander à l’IA",
        "branch" => "Condition",
        "for_each" => "Pour chaque ligne",
        "delete_record" => "Supprimer une ligne",
        "aggregate" => "Compter et additionner",
        "run_automation" => "Lancer une automatisation",
        "document" => "Générer un PDF",
        "wait" => "Attendre",
        "attempt" => "Essayer",
        _ => return None,
    })
}

fn trigger_label(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "record_created" => "une ligne est créée",
        "record_updated" => "une ligne est modifiée",
        "schedule" => "à heure fixe",
        "button" => "on clique sur un bouton",
        "record_deleted" => "une ligne est supprimée",
        "record_matches" => "une ligne entre dans un filtre",
        "date_reached" => "une date arrive",
        "webhook" => "un service appelle son adresse",
        _ => return None,
    })
}

struct Person {
    reference: String,
    id: String,
    name: String,
}

struct Channel {
    reference: String,
    id: String,
    label: String,
}

/// What a turn knows beside the model: the catalog, people and channels under references.
struct Turn<'a> {
    catalog: &'a Catalog,
    people: Vec<Person>,
    channels: Vec<Channel>,
}

impl Turn<'_> {
    fn table_of(&self, value: &str) -> Option<&basedb_ai::copilot::CatalogTable> {
        self.catalog.tables.iter().find(|t| t.id == value || t.name == value)
    }

    fn name_of_table(&self, value: &Value) -> Value {
        match value {
            Value::String(s) => self.table_of(s).map_or_else(|| value.clone(), |t| json!(t.name)),
            other => other.clone(),
        }
    }

    fn label_of_table(&self, value: Option<&Value>) -> String {
        match value {
            Some(Value::String(s)) => self.table_of(s).map_or_else(|| s.clone(), |t| t.label.clone()),
            _ => String::new(),
        }
    }

    /// A flow as the model reads it: tables by name, people and channels by reference.
    fn for_model(&self, steps: Option<&Value>) -> Vec<Value> {
        map_steps(steps, &|mut out: Raw| {
            if let Some(t @ Value::String(_)) = out.get("table") {
                let named = self.name_of_table(t);
                out.insert("table".into(), named);
            }
            if let Some(Value::Array(users)) = out.get("users") {
                let refs: Vec<Value> = users.iter().filter_map(|u| self.people.iter().find(|p| u.as_str() == Some(p.id.as_str())).map(|p| json!(p.reference))).collect();
                out.insert("users".into(), Value::Array(refs));
            }
            if let Some(Value::String(i)) = out.get("integration") {
                if let Some(c) = self.channels.iter().find(|c| &c.id == i) {
                    out.insert("integration".into(), json!(c.reference));
                }
            }
            if let Some(Value::Array(headers)) = out.get("headers") {
                let headers: Vec<Value> = headers
                    .iter()
                    .map(|h| {
                        let mut header = record(Some(h));
                        if header.get("secret") == Some(&Value::Bool(true)) {
                            header.insert("value".into(), Value::Null);
                        }
                        Value::Object(header)
                    })
                    .collect();
                out.insert("headers".into(), Value::Array(headers));
            }
            out.shift_remove("consent");
            out
        })
    }

    /// A flow as the model wrote it, back to what a save takes.
    fn steps_from_model(&self, steps: Option<&Value>) -> Vec<Value> {
        map_steps(steps, &|mut out: Raw| {
            if let Some(Value::Array(users)) = out.get("users") {
                let ids: Vec<Value> = users.iter().map(|u| self.people.iter().find(|p| u.as_str() == Some(p.reference.as_str())).map_or_else(|| u.clone(), |p| json!(p.id))).collect();
                out.insert("users".into(), Value::Array(ids));
            }
            if let Some(Value::String(i)) = out.get("integration") {
                if let Some(c) = self.channels.iter().find(|c| &c.reference == i) {
                    out.insert("integration".into(), json!(c.id));
                }
            }
            // Checked here as if consented; the person consents in the editor, before saving.
            if out.get("kind") == Some(&json!("ai")) {
                out.insert("consent".into(), Value::Bool(true));
            }
            out
        })
    }

    /// What the model can correct from: the names it may use.
    fn hint_for(&self, e: &AppError) -> String {
        match e.details.get("reason").and_then(Value::as_str) {
            Some("table_inconnue") => format!(" ; tables : {}", self.catalog.tables.iter().map(|t| t.name.as_str()).collect::<Vec<_>>().join(", ")),
            Some("champ_inconnu" | "champ_personne_attendu") => cut(
                &format!(
                    " ; colonnes : {}",
                    self.catalog.tables.iter().map(|t| format!("{} ({})", t.name, t.fields.iter().map(|f| f.name.as_str()).collect::<Vec<_>>().join(", "))).collect::<Vec<_>>().join(" ; ")
                ),
                2000,
            ),
            Some("personne_inconnue" | "personne_a_prevenir") => {
                let refs = self.people.iter().map(|p| p.reference.as_str()).collect::<Vec<_>>().join(", ");
                format!(" ; personnes : {}", if refs.is_empty() { "aucune" } else { &refs })
            }
            Some("connexion_inconnue") => {
                let refs = self.channels.iter().map(|c| c.reference.as_str()).collect::<Vec<_>>().join(", ");
                format!(" ; canaux Slack : {}", if refs.is_empty() { "aucun" } else { &refs })
            }
            _ => String::new(),
        }
    }

    /// A step in a line: what it does, and on what.
    fn step_text(&self, s: &Raw) -> String {
        let kind = str_of(s.get("kind"));
        let label = step_label(&kind).map_or_else(|| kind.clone(), str::to_string);
        let row = |r: Option<&Value>| match r {
            None | Some(Value::Null) => String::new(),
            Some(Value::String(t)) if t == TRIGGER_ROW => String::new(),
            Some(v) => format!(" (ligne de {})", js_string(v)),
        };
        let text_or = |key: &str, fallback: &str| match s.get(key) {
            None | Some(Value::Null) => fallback.to_string(),
            Some(v) => js_string(v),
        };
        match s.get("kind").and_then(Value::as_str).unwrap_or("") {
            "create_record" | "find_record" | "for_each" => format!("{label} dans {}", self.label_of_table(s.get("table"))),
            "webhook" => format!("{label} : {} {}", text_or("method", "POST"), text_or("url", "")),
            "update_record" => format!("{label}{} : {}", row(s.get("record")), record(s.get("values")).keys().cloned().collect::<Vec<_>>().join(", ")),
            "notify" | "slack" => format!("{label} : {}", quoted(&text_or("message", ""))),
            "email" => format!("{label} : {}", quoted(&text_or("subject", ""))),
            "ai" => format!("{label} : {}", quoted(&text_or("prompt", ""))),
            "branch" | "attempt" => {
                let paths = s.get("paths").and_then(Value::as_array).cloned().unwrap_or_default();
                format!("{label} : {}", paths.iter().map(|p| text_or_of(&record(Some(p)), "label")).collect::<Vec<_>>().join(" / "))
            }
            _ => label,
        }
    }

    fn trigger_text(&self, t: &Raw) -> String {
        let kind = str_of(t.get("kind"));
        let label = trigger_label(&kind).map_or_else(|| kind.clone(), str::to_string);
        match t.get("table") {
            None | Some(Value::Null) => label,
            table => format!("{label} dans {}", self.label_of_table(table)),
        }
    }

    fn comparable(&self, s: &Raw) -> String {
        let mut keys: Vec<String> = s.keys().cloned().collect();
        keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        let mut o = s.clone();
        o.shift_remove("consent");
        if let Some(t @ Value::String(_)) = s.get("table") {
            o.insert("table".into(), self.name_of_table(t));
        }
        match s.get("paths") {
            Some(Value::Array(paths)) => {
                let paths = paths
                    .iter()
                    .map(|p| {
                        let mut p = record(Some(p));
                        p.shift_remove("steps");
                        Value::Object(p)
                    })
                    .collect();
                o.insert("paths".into(), Value::Array(paths));
            }
            _ => {
                o.shift_remove("paths");
            }
        }
        o.shift_remove("steps");
        stringify_keys(&Value::Object(o), &keys)
    }

    /// What a proposal changes of what is on screen — or builds, for a new one.
    fn changes_of(&self, before: Option<&Raw>, after: &Raw) -> Vec<String> {
        let mut lines = vec![];
        let after_trigger = record(after.get("trigger"));
        let after_steps = flatten(after.get("actions").and_then(Value::as_array).map_or(&[][..], Vec::as_slice));
        let after_condition = after.get("condition").and_then(Value::as_str);
        let Some(before) = before else {
            lines.push(format!("Quand {}", self.trigger_text(&after_trigger)));
            if let Some(c) = after_condition {
                lines.push(format!("Seulement si {c}"));
            }
            for s in &after_steps {
                lines.push(format!("{} · {}", str_of(s.get("id")), self.step_text(s)));
            }
            return lines;
        };
        let after_label = after.get("label").and_then(Value::as_str).unwrap_or("");
        let before_label = match before.get("label") {
            None | Some(Value::Null) => String::new(),
            Some(v) => js_string(v),
        };
        if before_label != after_label {
            lines.push(format!("Renommée « {after_label} »"));
        }
        let was = record(before.get("trigger"));
        let or = |v: Option<&Value>, fallback: Value| match v {
            None | Some(Value::Null) => fallback,
            Some(v) => v.clone(),
        };
        let same = was.get("kind").is_some_and(|k| strict_eq(k, after_trigger.get("kind").unwrap_or(&Value::Null)))
            && strict_eq(&self.name_of_table(&or(was.get("table"), Value::Null)), &self.name_of_table(after_trigger.get("table").unwrap_or(&Value::Null)))
            && js_stringify(&or(was.get("fields"), json!([]))) == js_stringify(after_trigger.get("fields").unwrap_or(&Value::Null))
            && js_stringify(&or(was.get("schedule"), Value::Null)) == js_stringify(after_trigger.get("schedule").unwrap_or(&Value::Null));
        if !same {
            lines.push(format!("Déclencheur : {}", self.trigger_text(&after_trigger)));
        }
        let condition = before.get("condition").and_then(Value::as_str).map(js_trim).unwrap_or("");
        if condition != after_condition.unwrap_or("") {
            lines.push(match after_condition {
                None => "Condition retirée".into(),
                Some(c) => format!("Seulement si {c}"),
            });
        }
        let after_enabled = after.get("enabled") == Some(&Value::Bool(true));
        if (before.get("enabled") != Some(&Value::Bool(false))) != after_enabled {
            lines.push(if after_enabled { "Activée".into() } else { "Désactivée".into() });
        }
        let mut before_steps: Map<String, Value> = Map::new();
        for s in flatten(before.get("actions").and_then(Value::as_array).map_or(&[][..], Vec::as_slice)) {
            before_steps.insert(str_of(s.get("id")), Value::Object(s));
        }
        for s in &after_steps {
            let id = str_of(s.get("id"));
            match before_steps.get(&id) {
                None => lines.push(format!("Ajoute {id} · {}", self.step_text(s))),
                Some(Value::Object(previous)) if self.comparable(previous) != self.comparable(s) => lines.push(format!("Modifie {id} · {}", self.step_text(s))),
                _ => {}
            }
        }
        let kept: Vec<String> = after_steps.iter().map(|s| str_of(s.get("id"))).collect();
        for (id, s) in &before_steps {
            if !kept.contains(id) {
                lines.push(format!("Retire {id} · {}", self.step_text(&record(Some(s)))));
            }
        }
        lines
    }
}

fn text_or_of(r: &Raw, key: &str) -> String {
    match r.get(key) {
        None | Some(Value::Null) => String::new(),
        Some(v) => js_string(v),
    }
}

/// The people a step may name, as `listMembers` gives them.
async fn members(st: &Shared, ctx: &RequestContext) -> Result<Vec<(String, String, bool)>, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let everyone = administers(ctx, &load_grants(&tx, ctx).await?);
        let rows = tx
            .rows(
                "WITH reach AS (
                   SELECT m.user_id,
                          coalesce(p.scope_project_id, b.project_id, tb.project_id, ab.project_id)
                            AS project_id
                     FROM _basedb.permission p
                     JOIN _basedb.role_member m      ON m.role_id = p.role_id
                     LEFT JOIN _basedb.base b        ON b.id = p.scope_base_id
                     LEFT JOIN _basedb.table_def td  ON td.id = p.scope_table_id
                     LEFT JOIN _basedb.base tb       ON tb.id = td.base_id
                     LEFT JOIN _basedb.application a ON a.id = p.scope_application_id
                     LEFT JOIN _basedb.base ab       ON ab.id = a.base_id
                    WHERE p.scope_kind <> 'tenant'
                 )
                 SELECT u.id::text, u.display_name, u.disabled_at IS NOT NULL AS disabled
                   FROM _basedb.app_user u
                   JOIN _basedb.tenant t ON t.id = u.tenant_id
                  WHERE t.ref = $1 AND u.deleted_at IS NULL
                    AND (NOT u.is_system OR u.is_instance_admin)
                    AND ($3::boolean OR u.id = $2::text::uuid OR EXISTS (
                          SELECT 1 FROM reach theirs JOIN reach mine ON mine.project_id = theirs.project_id
                           WHERE theirs.user_id = u.id AND mine.user_id = $2::text::uuid))
                  ORDER BY u.display_name, u.email",
                &[&ctx.tenant_id, &ctx.actor.id, &everyone],
            )
            .await?;
        Ok(rows.iter().map(|r| (r.get(0), r.get(1), r.get(2))).collect())
    })
    .await
}

/// The Slack channels of the base, as `listIntegrations` gives them.
async fn integrations(st: &Shared, ctx: &RequestContext, base_id: &str) -> Result<Vec<(String, String)>, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        let rows = tx.rows("SELECT id::text, label FROM _basedb.integration WHERE base_id = $1::text::uuid AND deleted_at IS NULL ORDER BY created_at", &[&base_id]).await?;
        Ok(rows.iter().map(|r| (r.get(0), r.get(1))).collect())
    })
    .await
}

/// A run as the model reads it: what happened, step by step — never a value.
fn run_for_model(run: &Value) -> Value {
    let mut out = Map::new();
    out.insert("at".into(), run.get("queued_at").cloned().unwrap_or(Value::Null));
    out.insert("trigger".into(), run.get("trigger").cloned().unwrap_or(Value::Null));
    out.insert("status".into(), run.get("status").cloned().unwrap_or(Value::Null));
    for (from, to) in [("reason", "reason"), ("error_code", "error_code")] {
        if let Some(v) = run.get(from).filter(|v| !v.is_null()) {
            out.insert(to.into(), v.clone());
        }
    }
    let steps: Vec<Value> = run
        .get("steps")
        .and_then(Value::as_array)
        .map(|steps| {
            steps
                .iter()
                .map(|s| {
                    let mut o = Map::new();
                    let either = |a: &str, b: &str| s.get(a).filter(|v| !v.is_null()).or_else(|| s.get(b)).cloned();
                    if let Some(v) = either("step", "action") {
                        o.insert("step".into(), v);
                    }
                    if let Some(v) = either("kind", "action") {
                        o.insert("kind".into(), v);
                    }
                    if let Some(v) = s.get("status") {
                        o.insert("status".into(), v.clone());
                    }
                    if let Some(v) = s.get("path") {
                        o.insert("path".into(), v.clone());
                    }
                    if let Some(v @ Value::String(_)) = s.get("error_code") {
                        o.insert("error_code".into(), v.clone());
                    }
                    if s.get("status") != Some(&json!("succeeded")) {
                        if let Some(v @ Value::String(_)) = s.get("detail") {
                            o.insert("detail".into(), v.clone());
                        }
                    }
                    Value::Object(o)
                })
                .collect()
        })
        .unwrap_or_default();
    out.insert("steps".into(), Value::Array(steps));
    Value::Object(out)
}

async fn quota(st: &Shared, ctx: &RequestContext) -> Result<(), AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move { assert_quota(&tx, ctx, &st.cfg, Usage::Copilot).await }).await
}

/// `automationCopilotTurn`.
pub async fn automation_copilot(st: &Shared, ctx: &RequestContext, request: AutomationCopilotRequest) -> Result<Value, AppError> {
    let conversation = trim_conversation(&request.messages);
    if conversation.last().is_none_or(|(role, _)| role != "user") {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("messages")));
    }
    let base_id = request.base_id.as_str();
    // The automations are built by whoever builds the base (chapter 17 §1).
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move { require_on_base(&tx, ctx, Action::ManageSchema, base_id).await }).await?;
    let consent = request.read_data;
    let catalog = load_catalog(st, ctx, base_id, consent).await?;
    let automations = list_automations(st, ctx, base_id).await?;
    let saved = request.automation_id.as_ref().and_then(|id| automations.iter().find(|a| &a.id == id));
    let runs: Vec<Value> = match saved {
        None => vec![],
        Some(a) => list_runs(st, ctx, base_id, &a.id).await?.into_iter().take(MAX_RUNS).collect(),
    };
    // People and channels under references of the call: no identifier leaves (chapter 12 §5.1).
    let people: Vec<Person> = members(st, ctx)
        .await?
        .into_iter()
        .filter(|m| !m.2)
        .take(MAX_PEOPLE)
        .enumerate()
        .map(|(i, (id, name, _))| {
            let name = js_trim(&name).to_string();
            Person { reference: format!("p{}", i + 1), id, name: if name.is_empty() { format!("Personne {}", i + 1) } else { name } }
        })
        .collect();
    let channels: Vec<Channel> = integrations(st, ctx, base_id).await?.into_iter().enumerate().map(|(i, (id, label))| Channel { reference: format!("s{}", i + 1), id, label }).collect();
    let turn = Turn { catalog: &catalog, people, channels };

    // The automation on screen: the editor's draft, or the saved one.
    let on_screen: Option<Raw> = match (&request.draft, saved) {
        (Some(d), _) => Some(d.clone()),
        (None, None) => None,
        (None, Some(a)) => {
            let mut m = Map::new();
            m.insert("label".into(), json!(a.label));
            m.insert("description".into(), json!(a.description));
            m.insert("enabled".into(), json!(a.enabled));
            m.insert("trigger".into(), json!({ "kind": a.trigger_kind, "table": a.table, "fields": a.fields, "schedule": a.schedule, "date": a.date }));
            m.insert("condition".into(), json!(a.condition));
            m.insert("actions".into(), Value::Array(wire_steps(&a.actions)));
            Some(m)
        }
    };

    let tables: Vec<Value> = catalog
        .tables
        .iter()
        .map(|t| {
            let fields: Vec<Value> = t
                .fields
                .iter()
                .map(|f| {
                    let mut m = Map::new();
                    m.insert("name".into(), json!(f.name));
                    m.insert("label".into(), json!(f.label));
                    m.insert("kind".into(), json!(f.kind));
                    if !f.writable {
                        m.insert("writable".into(), json!(false));
                    }
                    if !f.options.is_empty() {
                        m.insert("options".into(), Value::Array(f.options.iter().map(|(value, label)| json!({ "value": value, "label": label })).collect()));
                    }
                    if let Some(target) = &f.target {
                        m.insert("target".into(), json!(target));
                    }
                    Value::Object(m)
                })
                .collect();
            json!({ "name": t.name, "label": t.label, "fields": fields })
        })
        .collect();
    let listed: Vec<Value> = automations
        .iter()
        .map(|a| json!({ "id": a.id, "label": a.label, "enabled": a.enabled, "trigger": a.trigger_kind, "table": a.table.as_ref().map(|t| turn.name_of_table(&json!(t))) }))
        .collect();
    let automation = match &on_screen {
        None => Value::Null,
        Some(screen) => {
            let mut trigger = record(screen.get("trigger"));
            match trigger.get("table") {
                None | Some(Value::Null) => {}
                Some(t) => {
                    let named = turn.name_of_table(t);
                    trigger.insert("table".into(), named);
                }
            }
            let or_null = |k: &str| screen.get(k).filter(|v| !v.is_null()).cloned().unwrap_or(Value::Null);
            json!({
                "id": saved.map(|a| a.id.clone()),
                "saved": saved.is_some(),
                "label": screen.get("label").filter(|v| !v.is_null()).cloned().unwrap_or(json!("")),
                "description": or_null("description"),
                "enabled": screen.get("enabled") != Some(&Value::Bool(false)),
                "trigger": trigger,
                "condition": or_null("condition"),
                "steps": turn.for_model(screen.get("actions")),
            })
        }
    };
    let payload = json!({
        "intent": "automation_copilot",
        "base_label": catalog.base_label,
        "tables": tables,
        "automations": listed,
        "automation": automation,
        "runs": runs.iter().map(run_for_model).collect::<Vec<_>>(),
        "people": turn.people.iter().map(|p| json!({ "ref": p.reference, "name": p.name })).collect::<Vec<_>>(),
        "slack_channels": turn.channels.iter().map(|c| json!({ "ref": c.reference, "label": c.label })).collect::<Vec<_>>(),
        "mail": st.mail_available(),
        "data_access": { "records": consent, "sql": catalog.sql_allowed },
        "conversation": conversation.iter().map(|(role, content)| json!({ "role": role, "content": content })).collect::<Vec<_>>(),
    });
    let (payload, system, images) = attach_to(payload, SYSTEM.to_string(), &request.attachments);
    let system = in_language(&system, Some(&request.language));
    let ask = |extra: Vec<(&str, Value)>| {
        let mut p = payload.as_object().cloned().unwrap_or_default();
        for (k, v) in extra {
            p.insert(k.into(), v);
        }
        let (catalog, system, images) = (&catalog, &system, images.clone());
        async move {
            quota(st, ctx).await?;
            let options = InvokeOptions { timeout_ms: Some(TURN_TIMEOUT_MS), max_tokens: Some(TURN_MAX_TOKENS), images };
            invoke(st, ctx, &catalog.config, Usage::Copilot, Some(base_id), &Value::Object(p), schema(), system, options).await.map(|m| match js_order(Value::Object(m)) {
                Value::Object(m) => m,
                _ => Map::new(),
            })
        }
    };

    let mut observations: Vec<Value> = vec![];
    let mut reads: Vec<Value> = vec![];
    let mut answer: Raw = Map::new();
    for round in 0..=MAX_READ_ROUNDS {
        answer = ask(vec![("observations", json!(observations)), ("rounds_left", json!(MAX_READ_ROUNDS - round))]).await?;
        let asked: Vec<Value> = answer.get("reads").and_then(Value::as_array).map(|a| a.iter().take(MAX_READS_PER_ROUND).cloned().collect()).unwrap_or_default();
        if asked.is_empty() || round == MAX_READ_ROUNDS {
            break;
        }
        for raw in &asked {
            let read = Value::Object(record(Some(raw)));
            let (summary, observation) = run_read(st, ctx, base_id, &catalog, &read, consent).await?;
            reads.push(summary);
            observations.push(observation);
        }
    }

    let mut dropped: Vec<String> = vec![];
    let mut actions = validate(st, ctx, base_id, &turn, on_screen.as_ref(), answer.get("actions"), &mut dropped).await;
    // Proposals set aside: the model is told why, once, and answers again.
    if !dropped.is_empty() {
        let rejected = json!({ "previous_answer": Value::Object(answer.clone()), "reasons": dropped });
        if let Ok(corrected) = ask(vec![("observations", json!(observations)), ("rounds_left", json!(0)), ("rejected", rejected)]).await {
            let mut again = vec![];
            let fixed = validate(st, ctx, base_id, &turn, on_screen.as_ref(), corrected.get("actions"), &mut again).await;
            if fixed.len() >= actions.len() && again.len() <= dropped.len() {
                answer = corrected;
                actions = fixed;
                dropped = again;
            }
        }
    }
    let message = answer.get("message").and_then(Value::as_str).map(js_trim).unwrap_or("");
    let message = if actions.is_empty() && !dropped.is_empty() {
        "Je n’ai pas pu préparer de proposition qui tienne : voyez ce qui a été écarté, et reformulez au besoin."
    } else if message.is_empty() && actions.is_empty() {
        "Je n’ai rien à proposer."
    } else {
        message
    };
    Ok(json!({ "message": message, "actions": actions, "reads": reads, "dropped": dropped }))
}

/// The proposals of an answer, each checked as a save would check it; the others set aside
/// with their reason.
async fn validate(st: &Shared, ctx: &RequestContext, base_id: &str, turn: &Turn<'_>, on_screen: Option<&Raw>, raw: Option<&Value>, dropped: &mut Vec<String>) -> Vec<Value> {
    let mut actions = vec![];
    let items = raw.and_then(Value::as_array).cloned().unwrap_or_default();
    for item in items.iter().take(MAX_ACTIONS) {
        match proposal(st, ctx, base_id, turn, on_screen, &record(Some(item))).await {
            Ok(action) => actions.push(action),
            Err(reason) => dropped.push(reason),
        }
    }
    actions
}

async fn proposal(st: &Shared, ctx: &RequestContext, base_id: &str, turn: &Turn<'_>, on_screen: Option<&Raw>, a: &Raw) -> Result<Value, String> {
    if a.get("type") != Some(&json!("automation")) {
        return Err(format!("proposition d’un type inconnu ({})", str_of(a.get("type"))));
    }
    let current = on_screen.is_some() && a.get("target") != Some(&json!("new"));
    let base = if current { on_screen } else { None };
    let given = |key: &str, fallback: Option<Value>| a.get(key).cloned().or(fallback);
    let base_or = |key: &str, fallback: Value| base.and_then(|b| b.get(key)).filter(|v| !v.is_null()).cloned().unwrap_or(fallback);
    let mut input = Map::new();
    input.insert("label".into(), given("label", Some(base_or("label", json!("Nouvelle automatisation")))).unwrap_or(Value::Null));
    input.insert("description".into(), given("description", Some(base_or("description", Value::Null))).unwrap_or(Value::Null));
    let enabled = base.is_none_or(|b| b.get("enabled") != Some(&Value::Bool(false)));
    input.insert("enabled".into(), given("enabled", Some(json!(enabled))).unwrap_or(Value::Null));
    if let Some(trigger) = given("trigger", base.and_then(|b| b.get("trigger")).cloned()) {
        input.insert("trigger".into(), trigger);
    }
    input.insert("condition".into(), given("condition", Some(base_or("condition", Value::Null))).unwrap_or(Value::Null));
    let steps = match a.get("steps") {
        Some(v) => Some(v.clone()),
        None => a.get("actions").filter(|v| !v.is_null()).cloned().or_else(|| base.and_then(|b| b.get("actions")).cloned()),
    };
    input.insert("actions".into(), Value::Array(turn.steps_from_model(steps.as_ref())));
    let checked = check_automation_draft(st, ctx, base_id, &Value::Object(input)).await.map_err(|e| format!("automatisation refusée : {}{}", reason_of(&e), turn.hint_for(&e)))?;
    // The consent of its AI steps is the person's: given in the editor, not here.
    let wired = Value::Array(wire_steps(&checked.actions));
    let actions = map_steps(Some(&wired), &|mut s: Raw| {
        if s.get("kind") == Some(&json!("ai")) {
            s.insert("consent".into(), Value::Bool(false));
        }
        s
    });
    let mut definition = Map::new();
    definition.insert("label".into(), json!(checked.label));
    definition.insert("description".into(), json!(checked.description));
    definition.insert("enabled".into(), json!(checked.enabled));
    definition.insert("trigger".into(), json!({ "kind": checked.kind, "table": checked.table, "fields": checked.fields, "schedule": checked.schedule, "date": checked.date }));
    definition.insert("condition".into(), json!(checked.condition));
    definition.insert("actions".into(), Value::Array(actions.clone()));
    let changes = turn.changes_of(base, &definition);
    if current && changes.is_empty() {
        return Err("aucune modification".into());
    }
    let ai_steps = flatten(&actions).iter().filter(|s| s.get("kind") == Some(&json!("ai"))).count();
    Ok(json!({ "type": "automation", "target": if current { "current" } else { "new" }, "definition": definition, "changes": changes, "aiSteps": ai_steps }))
}

/// `POST /api/v1/{tenant}/ai/bases/{base}/automation-copilot`.
pub async fn route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let body = body_fields(&body)?;
    let invalid = |field: &str| AppError::new("REQUEST_INVALID").with("field", json!(field));
    let messages = basedb_ai::routes::messages_of(body)?;
    if body.get("automation").is_some_and(|v| !v.is_null() && !v.is_string()) {
        return Err(invalid("automation"));
    }
    if body.get("draft").is_some_and(|v| !v.is_null() && !v.is_object()) {
        return Err(invalid("draft"));
    }
    if body.get("read_data").is_some_and(|v| !v.is_boolean()) {
        return Err(invalid("read_data"));
    }
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, &base).await?;
    let request = AutomationCopilotRequest {
        base_id,
        automation_id: body.get("automation").and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string),
        draft: body.get("draft").and_then(Value::as_object).cloned(),
        messages,
        read_data: body.get("read_data") == Some(&Value::Bool(true)),
        language: screen_language(&headers),
        attachments: read_attachments(body.get("attachments"))?,
    };
    let answer = automation_copilot(&st, &ctx, request).await?;
    Ok(json_ok(json!({ "data": answer })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replacer_keys_filter_every_depth() {
        let v = json!({ "kind": "update_record", "id": "e1", "values": { "statut": "fait", "id": 3 } });
        let keys = vec!["id".to_string(), "kind".to_string(), "values".to_string()];
        assert_eq!(stringify_keys(&v, &keys), r#"{"id":"e1","kind":"update_record","values":{"id":3}}"#);
    }

    #[test]
    fn flattens_paths_before_loops() {
        let steps = json!([{ "id": "e1", "kind": "branch", "paths": [{ "steps": [{ "id": "e2" }] }], "steps": [{ "id": "e3" }] }]);
        let ids: Vec<String> = flatten(steps.as_array().unwrap()).iter().map(|s| str_of(s.get("id"))).collect();
        assert_eq!(ids, ["e1", "e2", "e3"]);
    }

    #[test]
    fn quotes_and_cuts() {
        assert_eq!(quoted("  bonjour "), "« bonjour »");
        assert_eq!(quoted("« déjà »"), "« déjà »");
        assert_eq!(quoted(&"x".repeat(61)), format!("« {}… »", "x".repeat(60)));
    }

    #[test]
    fn reasons_read_as_node() {
        let e = AppError::new("REQUEST_INVALID").with("field", json!("actions")).with("reason", json!("table_inconnue"));
        assert_eq!(reason_of(&e), "REQUEST_INVALID (table_inconnue · actions)");
        assert_eq!(reason_of(&AppError::new("PERMISSION_DENIED")), "PERMISSION_DENIED");
    }
}
