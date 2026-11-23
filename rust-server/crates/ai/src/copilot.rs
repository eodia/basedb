//! `ai/copilot.ts`: the copilot — a conversation about one base that answers and PROPOSES.
//! Nothing here writes; proposals are re-validated against the catalog and the rights.

use crate::attachments::{attach_to, Attachment};
use crate::fields::is_ai_kind;
use crate::js::{chars_len, chars_prefix, js_length, js_number_string, js_string, js_to_number, js_trim};
use crate::language::in_language;
use crate::prompts;
use crate::provider::{assert_quota, invoke, resolve_provider, InvokeOptions, ProviderConfig, Usage};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::AppError;
use basedb_base::idempotency::js_stringify;
use basedb_base::rbac::require::load_base_target;
use basedb_base::rbac::{decide, load_grants, load_target, Action, Verdict};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::Shared;
use basedb_catalog::js::js_order;
use basedb_catalog::sql_console::{run_console_sql, SqlRequest};
use basedb_records::{list_records, ListOptions};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::sync::LazyLock;
use unicode_normalization::UnicodeNormalization;

const MAX_MESSAGES: usize = 20;
const MAX_MESSAGE_CHARS: usize = 4_000;
const MAX_CONVERSATION_CHARS: usize = 16_000;
const MAX_READ_ROUNDS: usize = 3;
const MAX_READS_PER_ROUND: usize = 3;
const MAX_ROWS_READ: usize = 50;
const MAX_VALUE_CHARS: usize = 300;
const MAX_OBSERVATION_BYTES: usize = 6_000;
const MAX_ACTIONS: usize = 6;
const MAX_RECORDS: usize = 50;
const MAX_FIELDS: usize = 20;
const TURN_TIMEOUT_MS: u64 = 90_000;
const TURN_MAX_TOKENS: u32 = 8_000;

const CREATABLE: [&str; 11] = ["short_text", "long_text", "number", "boolean", "date", "datetime", "select", "multi_select", "link", "url", "email"];
const NOT_WRITABLE: [&str; 5] = ["formula", "autonumber", "file", "image", "system"];

/// What the route hands in (`CopilotRequest`).
pub struct CopilotRequest {
    pub base_id: String,
    pub table_id: Option<String>,
    pub filter: Option<String>,
    pub sort: Option<String>,
    pub messages: Vec<(String, String)>,
    pub read_data: bool,
    pub language: String,
    pub attachments: Vec<Attachment>,
}

static UUID: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap());
static MARKS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{M}").unwrap());

/// `fold`: accents off, lower case, spaces collapsed.
pub fn fold(text: &str) -> String {
    let stripped: String = text.nfd().collect();
    let lower = MARKS.replace_all(&stripped, "").to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut space = false;
    for c in lower.chars() {
        if crate::js::is_js_space(c) {
            space = true;
            continue;
        }
        if space && !out.is_empty() {
            out.push(' ');
        }
        space = false;
        out.push(c);
    }
    out
}

/// `cut`: past `max` code points, the first `max` and an ellipsis.
pub fn cut(text: &str, max: usize) -> String {
    if chars_len(text) > max {
        format!("{}…", chars_prefix(text, max))
    } else {
        text.to_string()
    }
}

/// `String(n)` of a JSON number.
fn number_text(n: &serde_json::Number) -> String {
    if n.is_i64() || n.is_u64() {
        n.to_string()
    } else {
        js_number_string(n.as_f64().unwrap_or(f64::NAN))
    }
}

/// `Number(v)` of JavaScript, for a value a model gave.
fn js_number_of(v: Option<&Value>) -> f64 {
    match v {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => f64::from(u8::from(*b)),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => js_to_number(s),
        Some(Value::Array(items)) => match items.as_slice() {
            [] => 0.0,
            [one] if !one.is_array() && !one.is_object() => js_number_of(Some(one)).max(f64::NEG_INFINITY),
            _ => f64::NAN,
        },
        Some(Value::Object(_)) => f64::NAN,
    }
}

/// `String(v)`, `undefined` and `null` spelled out.
fn js_string_of(v: Option<&Value>) -> String {
    match v {
        None => "undefined".into(),
        Some(Value::Null) => "null".into(),
        other => js_string(other),
    }
}

/// `typeof v === 'object' && v !== null ? v : {}` — an array stays an array.
fn object_or_empty(v: &Value) -> Value {
    if v.is_object() || v.is_array() {
        v.clone()
    } else {
        json!({})
    }
}

/// `Object.entries` of a value a model gave.
fn entries(v: &Value) -> Vec<(String, Value)> {
    match v {
        Value::Object(m) => match js_order(Value::Object(m.clone())) {
            Value::Object(m) => m.into_iter().collect(),
            _ => vec![],
        },
        Value::Array(items) => items.iter().enumerate().map(|(i, v)| (i.to_string(), v.clone())).collect(),
        Value::String(s) => s.chars().enumerate().map(|(i, c)| (i.to_string(), json!(c.to_string()))).collect(),
        _ => vec![],
    }
}

// ── The catalog, as the person sees it ─────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct CatalogField {
    pub id: String,
    pub name: String,
    pub label: String,
    pub kind: String,
    pub required: bool,
    pub writable: bool,
    pub options: Vec<(String, String)>,
    pub target: Option<String>,
}

#[derive(Clone, Debug)]
pub struct CatalogTable {
    pub id: String,
    pub name: String,
    pub label: String,
    pub can_create: bool,
    pub can_update: bool,
    pub fields: Vec<CatalogField>,
}

pub struct Catalog {
    pub base_label: String,
    pub tables: Vec<CatalogTable>,
    pub can_manage_schema: bool,
    pub sql_allowed: bool,
    pub agents_hidden: bool,
    pub config: ProviderConfig,
}

/// `loadCatalog`: the tables the person reads, their visible columns and their rights.
pub async fn load_catalog(st: &Shared, ctx: &RequestContext, base_id: &str, read_data: bool) -> Result<Catalog, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        let base_id = base_id.to_string();
        async move {
            let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id));
            let grants = load_grants(&tx, &ctx).await?;
            let Some(base_target) = load_base_target(&tx, &ctx, &base_id).await? else { return Err(not_found()) };
            let base_label: String = tx
                .first("SELECT label FROM _basedb.base WHERE id = $1::text::uuid", &[&base_id])
                .await?
                .map(|r| r.get(0))
                .unwrap_or_default();
            let table_rows = tx
                .rows(
                    "SELECT t.id::text, n.name, t.label FROM _basedb.table_def t
                       JOIN _basedb.physical_name n ON n.id = t.name_id
                      WHERE t.base_id = $1::text::uuid AND t.is_live AND t.deleted_at IS NULL
                      ORDER BY t.position",
                    &[&base_id],
                )
                .await?;
            let field_rows = tx
                .rows(
                    "SELECT f.id::text, f.table_id::text, n.name, f.label, f.kind, f.is_required, f.expose_to_agents,
                            lc.target_table_id::text
                       FROM _basedb.field f
                       JOIN _basedb.physical_name n ON n.id = f.name_id
                       LEFT JOIN _basedb.field_link_config lc ON lc.field_id = f.id
                      WHERE f.base_id = $1::text::uuid AND f.is_live AND f.deleted_at IS NULL
                      ORDER BY f.position",
                    &[&base_id],
                )
                .await?;
            let option_rows = tx
                .rows(
                    "SELECT o.field_id::text, o.value, o.label FROM _basedb.select_option o
                       JOIN _basedb.field f ON f.id = o.field_id
                      WHERE f.base_id = $1::text::uuid AND o.deleted_at IS NULL
                      ORDER BY o.position",
                    &[&base_id],
                )
                .await?;
            let name_of = |id: &str| table_rows.iter().find(|t| t.get::<_, String>(0) == id).map(|t| t.get::<_, String>(1));
            let mut tables = vec![];
            for row in &table_rows {
                let id: String = row.get(0);
                let Some(target) = load_target(&tx, &ctx, &id).await? else { continue };
                let read = decide(&ctx, &grants, Action::Read, &target);
                if read.verdict != Verdict::Allowed {
                    continue;
                }
                let create = decide(&ctx, &grants, Action::Create, &target);
                let update = decide(&ctx, &grants, Action::Update, &target);
                let mut writable: HashSet<String> = HashSet::new();
                if create.verdict == Verdict::Allowed {
                    writable.extend(create.writable_fields.iter().cloned());
                }
                if update.verdict == Verdict::Allowed {
                    writable.extend(update.writable_fields.iter().cloned());
                }
                let fields = field_rows
                    .iter()
                    .filter(|f| f.get::<_, String>(1) == id && read.readable_fields.contains(&f.get::<_, String>(0)) && f.get::<_, bool>(6))
                    .map(|f| {
                        let fid: String = f.get(0);
                        let kind: String = f.get(4);
                        CatalogField {
                            writable: writable.contains(&fid) && !NOT_WRITABLE.contains(&kind.as_str()),
                            options: option_rows.iter().filter(|o| o.get::<_, String>(0) == fid).map(|o| (o.get(1), o.get(2))).collect(),
                            target: f.get::<_, Option<String>>(7).and_then(|t| name_of(&t)),
                            id: fid,
                            name: f.get(2),
                            label: f.get(3),
                            kind,
                            required: f.get(5),
                        }
                    })
                    .collect();
                tables.push(CatalogTable {
                    id,
                    name: row.get(1),
                    label: row.get(2),
                    can_create: create.verdict == Verdict::Allowed,
                    can_update: update.verdict == Verdict::Allowed,
                    fields,
                });
            }
            if tables.is_empty() {
                return Err(not_found());
            }
            let can_manage_schema = decide(&ctx, &grants, Action::ManageSchema, &base_target).verdict == Verdict::Allowed;
            let hidden = field_rows.iter().any(|f| !f.get::<_, bool>(6));
            let config = resolve_provider(&tx, &ctx, &st.cfg).await?;
            assert_quota(&tx, &ctx, &st.cfg, Usage::Copilot).await?;
            Ok(Catalog { base_label, tables, can_manage_schema, sql_allowed: read_data && can_manage_schema && !hidden, agents_hidden: hidden, config })
        }
    })
    .await
}

async fn quota_again(st: &Shared, ctx: &RequestContext) -> Result<(), AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        async move { assert_quota(&tx, &ctx, &st.cfg, Usage::Copilot).await }
    })
    .await
}

// ── One turn ──────────────────────────────────────────────────────────────────

/// `copilotTurn`: up to four calls — three rounds of reads at most — then the proposals,
/// re-validated, and one correction when some were set aside.
pub async fn copilot(st: &Shared, ctx: &RequestContext, request: CopilotRequest) -> Result<Value, AppError> {
    let conversation = trim_conversation(&request.messages);
    if conversation.last().is_none_or(|(role, _)| role != "user") {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("messages")));
    }
    let catalog = load_catalog(st, ctx, &request.base_id, request.read_data).await?;
    let focus = request.table_id.as_ref().and_then(|id| catalog.tables.iter().find(|t| &t.id == id)).cloned();

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
                    if f.required {
                        m.insert("required".into(), json!(true));
                    }
                    if !f.writable {
                        m.insert("read_only".into(), json!(true));
                    }
                    if !f.options.is_empty() {
                        m.insert("options".into(), json!(f.options.iter().map(|o| &o.1).collect::<Vec<_>>()));
                    }
                    if let Some(target) = &f.target {
                        m.insert("target".into(), json!(target));
                    }
                    Value::Object(m)
                })
                .collect();
            json!({ "name": t.name, "label": t.label, "can_insert": t.can_create, "can_update": t.can_update, "fields": fields })
        })
        .collect();
    let base = json!({
        "intent": "copilot",
        "base_label": catalog.base_label,
        "can_manage_schema": catalog.can_manage_schema,
        "tables": tables,
        "focus": focus.as_ref().map(|f| json!({ "table": f.name, "filter": request.filter, "sort": request.sort })),
        "data_access": { "records": request.read_data, "sql": catalog.sql_allowed },
        "conversation": conversation.iter().map(|(role, content)| json!({ "role": role, "content": content })).collect::<Vec<_>>(),
    });
    let (payload, system, images) = attach_to(base, prompts::COPILOT_SYSTEM.to_string(), &request.attachments);
    let system = in_language(&system, Some(&request.language));
    let with = |extra: Vec<(&str, Value)>| {
        let mut p = payload.as_object().cloned().unwrap_or_default();
        for (k, v) in extra {
            p.insert(k.into(), v);
        }
        Value::Object(p)
    };
    let options = || InvokeOptions { timeout_ms: Some(TURN_TIMEOUT_MS), max_tokens: Some(TURN_MAX_TOKENS), images: images.clone() };
    let base_id: &str = &request.base_id;
    let call = |payload: Value| {
        let catalog = &catalog;
        let system = &system;
        let options = options();
        async move {
            invoke(st, ctx, &catalog.config, Usage::Copilot, Some(base_id), &payload, prompts::copilot_schema(), system, options)
                .await
                .map(|m| match js_order(Value::Object(m)) {
                    Value::Object(m) => m,
                    _ => Map::new(),
                })
        }
    };

    let mut observations: Vec<Value> = vec![];
    let mut reads: Vec<Value> = vec![];
    let mut answer: Map<String, Value> = Map::new();
    for round in 0..=MAX_READ_ROUNDS {
        if round > 0 {
            quota_again(st, ctx).await?;
        }
        answer = call(with(vec![("observations", json!(observations)), ("rounds_left", json!(MAX_READ_ROUNDS - round))])).await?;
        let asked: Vec<Value> = answer.get("reads").and_then(Value::as_array).map(|a| a.iter().take(MAX_READS_PER_ROUND).cloned().collect()).unwrap_or_default();
        if asked.is_empty() || round == MAX_READ_ROUNDS {
            break;
        }
        for raw in &asked {
            let read = object_or_empty(raw);
            let (summary, observation) = run_read(st, ctx, &request.base_id, &catalog, &read, request.read_data).await?;
            reads.push(summary);
            observations.push(observation);
        }
    }

    let mut dropped: Vec<String> = vec![];
    let mut actions = validate_actions(st, ctx, &catalog, focus.as_ref(), answer.get("actions"), &mut dropped).await?;
    if !dropped.is_empty() {
        quota_again(st, ctx).await?;
        let rejected = json!({ "previous_answer": Value::Object(answer.clone()), "reasons": dropped });
        let corrected = call(with(vec![("observations", json!(observations)), ("rounds_left", json!(0)), ("rejected", rejected)])).await.ok();
        if let Some(corrected) = corrected {
            let mut again = vec![];
            let fixed = validate_actions(st, ctx, &catalog, focus.as_ref(), corrected.get("actions"), &mut again).await?;
            if fixed.len() >= actions.len() {
                answer = corrected;
                actions = fixed;
                dropped = again;
            }
        }
    }
    let message = answer.get("message").and_then(Value::as_str).map(js_trim).unwrap_or("");
    let message = if message.is_empty() && actions.is_empty() { "Je n’ai rien à proposer." } else { message };
    Ok(json!({ "message": message, "actions": actions, "reads": reads, "dropped": dropped }))
}

/// `trimConversation`: the last twenty, each cut, the oldest dropped past the total.
pub fn trim_conversation(messages: &[(String, String)]) -> Vec<(String, String)> {
    let mut kept: Vec<(String, String)> = vec![];
    let mut total = 0;
    let start = messages.len().saturating_sub(MAX_MESSAGES);
    for (role, content) in messages[start..].iter().rev() {
        if role != "user" && role != "assistant" {
            continue;
        }
        let content = cut(js_trim(content), MAX_MESSAGE_CHARS);
        if content.is_empty() {
            continue;
        }
        total += js_length(&content);
        if total > MAX_CONVERSATION_CHARS && !kept.is_empty() {
            break;
        }
        kept.insert(0, (role.clone(), content));
    }
    kept
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/// `plain`: a link by its display, a file by its name, text cut.
pub fn plain(value: Option<&Value>) -> Value {
    match value {
        None | Some(Value::Null) => Value::Null,
        Some(v @ (Value::Number(_) | Value::Bool(_))) => v.clone(),
        Some(Value::Array(items)) => Value::Array(
            items
                .iter()
                .map(|v| match v {
                    Value::Object(o) if o.contains_key("name") => json!(js_string_of(o.get("name"))),
                    other => plain(Some(other)),
                })
                .collect(),
        ),
        Some(Value::Object(o)) => {
            if o.contains_key("display") {
                match o.get("display") {
                    Some(d) if !d.is_null() => d.clone(),
                    _ => o.get("id").filter(|v| !v.is_null()).cloned().unwrap_or(Value::Null),
                }
            } else {
                json!(cut(&js_stringify(&Value::Object(o.clone())), MAX_VALUE_CHARS))
            }
        }
        Some(Value::String(s)) => json!(cut(s, MAX_VALUE_CHARS)),
    }
}

/// `fit`: rows dropped from the end until the observation fits its share of the payload.
pub fn fit(result: Map<String, Value>) -> Value {
    let mut out = result;
    loop {
        let rows = out.get("rows").and_then(Value::as_array).map_or(0, Vec::len);
        if rows <= 1 || js_stringify(&Value::Object(out.clone())).len() <= MAX_OBSERVATION_BYTES {
            break;
        }
        if let Some(Value::Array(rows)) = out.get_mut("rows") {
            rows.pop();
        }
        out.insert("truncated".into(), json!(true));
    }
    Value::Object(out)
}

/// The message of an error a read met, as Node takes it from a `BasedbError`.
fn sql_error_text(e: &AppError) -> String {
    if e.code == "INTERNAL_ERROR" {
        return "échec".into();
    }
    match e.details.get("message").filter(|v| !v.is_null()).or_else(|| e.details.get("reason").filter(|v| !v.is_null())) {
        Some(v) => js_string(Some(v)),
        None => e.code.to_string(),
    }
}

/// `runRead`: one read the model asked for, under the person's rights — or refused.
pub async fn run_read(st: &Shared, ctx: &RequestContext, base_id: &str, catalog: &Catalog, read: &Value, consent: bool) -> Result<(Value, Value), AppError> {
    let refuse = |kind: &str, table: Value, text: &str, error: &str| {
        (json!({ "kind": kind, "table": table, "text": text, "rows": 0, "error": error }), json!({ "read": read, "error": error }))
    };
    let kind = read.get("kind");
    if !consent {
        let kind = if kind == Some(&json!("sql")) { "sql" } else { "records" };
        let table = read.get("table").filter(|t| t.is_string()).cloned().unwrap_or(Value::Null);
        let sql = read.get("sql").and_then(Value::as_str).unwrap_or("");
        return Ok(refuse(kind, table, sql, "lecture des données non autorisée dans cette conversation"));
    }

    if kind == Some(&json!("sql")) {
        static END: LazyLock<Regex> = LazyLock::new(|| Regex::new(r";\s*$").unwrap());
        let sql = read.get("sql").and_then(Value::as_str).map(|s| END.replace(js_trim(s), "").into_owned()).unwrap_or_default();
        if !catalog.sql_allowed {
            return Ok(refuse("sql", Value::Null, &sql, "lecture SQL non autorisée dans cette conversation"));
        }
        if sql.is_empty() {
            return Ok(refuse("sql", Value::Null, &sql, "requête vide"));
        }
        let request = SqlRequest { base_id: base_id.to_string(), sql: sql.clone(), limit: Some(50.0), read_only: true };
        return Ok(match run_console_sql(st, ctx, &request).await {
            Ok(result) => {
                let columns: Vec<Value> = result.columns.iter().map(|(name, _)| json!(name)).collect();
                let rows: Vec<Value> = result
                    .rows
                    .iter()
                    .take(MAX_ROWS_READ)
                    .map(|r| match js_order(r.clone()) {
                        Value::Object(m) => Value::Array(m.values().map(|v| plain(Some(v))).collect()),
                        _ => json!([]),
                    })
                    .collect();
                let truncated = result.truncated || result.rows.len() > rows.len();
                let count = rows.len();
                let mut r = Map::new();
                r.insert("columns".into(), json!(columns));
                r.insert("rows".into(), json!(rows));
                r.insert("truncated".into(), json!(truncated));
                (
                    json!({ "kind": "sql", "table": null, "text": sql, "rows": count, "error": null }),
                    json!({ "read": { "kind": "sql", "sql": sql }, "result": fit(r) }),
                )
            }
            Err(e) => refuse("sql", Value::Null, &sql, &sql_error_text(&e)),
        });
    }

    let table_name = read.get("table").and_then(Value::as_str).unwrap_or("").to_string();
    let table = find_table(catalog, read.get("table"), None);
    let filter = match read.get("filter").and_then(Value::as_str) {
        Some(f) if !js_trim(f).is_empty() => Some(choices_as_values(f, table.map(|t| t.fields.as_slice()).unwrap_or(&[]))?),
        _ => None,
    };
    let text = [Some(table_name.as_str()), filter.as_deref()].into_iter().flatten().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" · ");
    if kind != Some(&json!("records")) {
        return Ok(refuse("records", json!(table_name), &text, "type de lecture inconnu"));
    }
    let Some(table) = table else {
        return Ok(refuse("records", json!(table_name), &text, "table inconnue"));
    };
    let exposed: Vec<&str> = table.fields.iter().map(|f| f.name.as_str()).collect();
    let wanted: Vec<String> = read
        .get("fields")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_str).filter(|f| exposed.contains(f)).map(str::to_string).collect())
        .unwrap_or_default();
    let select = if wanted.is_empty() { exposed.iter().map(|s| s.to_string()).collect() } else { wanted };
    let n = js_number_of(read.get("limit"));
    let n = if n.is_nan() || n == 0.0 { 20.0 } else { n };
    let limit = n.max(1.0).min(MAX_ROWS_READ as f64);
    let options = ListOptions {
        table_id: table.id.clone(),
        filter: filter.clone(),
        sort: read.get("sort").and_then(Value::as_str).filter(|s| !js_trim(s).is_empty()).map(str::to_string),
        limit: Some(limit),
        select: Some(select.clone()),
        count_exact: read.get("count") == Some(&Value::Bool(true)),
        ..ListOptions::default()
    };
    let listed = match st.instance_key() {
        Ok(key) => list_records(&st.pools, ctx, key, &options).await,
        Err(e) => Err(e),
    };
    Ok(match listed {
        Ok(result) => {
            let mut columns = vec!["_id".to_string()];
            columns.extend(select);
            let rows: Vec<Value> = result.rows.iter().map(|r| Value::Array(columns.iter().map(|c| plain(r.get(c))).collect())).collect();
            let count = rows.len();
            let mut r = Map::new();
            r.insert("columns".into(), json!(columns));
            r.insert("rows".into(), json!(rows));
            if let Some(total) = result.total {
                r.insert("total".into(), json!(total));
                r.insert("total_capped".into(), json!(result.total_capped));
            }
            r.insert("truncated".into(), json!(result.has_next_page));
            (
                json!({ "kind": "records", "table": table.name, "text": text, "rows": count, "error": null }),
                json!({ "read": { "kind": "records", "table": table.name, "filter": filter }, "result": fit(r) }),
            )
        }
        Err(e) => {
            let error = if e.code == "INTERNAL_ERROR" { "échec de lecture".to_string() } else { e.code.to_string() };
            refuse("records", json!(table.name), &text, &error)
        }
    })
}

// ── Proposals, re-validated ───────────────────────────────────────────────────

/// `findTable`: by physical name, by name in any case, by label; none named is the focus.
fn find_table<'a>(catalog: &'a Catalog, reference: Option<&Value>, focus: Option<&'a CatalogTable>) -> Option<&'a CatalogTable> {
    let text = match reference {
        None | Some(Value::Null) => return focus,
        Some(Value::String(s)) if s.is_empty() => return focus,
        Some(Value::String(s)) => s,
        Some(_) => return None,
    };
    let unquote = |s: &str| -> String {
        let s = s.strip_prefix('"').unwrap_or(s);
        s.strip_suffix('"').unwrap_or(s).to_string()
    };
    let text = unquote(js_trim(text));
    let last = unquote(text.split('.').next_back().unwrap_or(&text));
    catalog
        .tables
        .iter()
        .find(|t| t.name == last)
        .or_else(|| catalog.tables.iter().find(|t| t.name.to_lowercase() == last.to_lowercase()))
        .or_else(|| catalog.tables.iter().find(|t| fold(&t.label) == fold(&text)))
}

static LITERAL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#""((?:[^"\\]|\\[^\n\r\u{2028}\u{2029}])*)""#).unwrap());
static EQ_CI: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?-u:\b)eq_ci(?-u:\b)").unwrap());

/// `choicesAsValues`: the strings compared to a list column, written as it stores them.
/// `Err` where Node's `JSON.parse` of a literal throws.
pub fn choices_as_values(filter: &str, fields: &[CatalogField]) -> Result<String, AppError> {
    let mut out = filter.to_string();
    for field in fields {
        if (field.kind != "select" && field.kind != "multi_select") || field.options.is_empty() {
            continue;
        }
        let stored = |text: String| -> String {
            if field.options.iter().any(|o| o.0 == text) {
                return text;
            }
            field.options.iter().find(|o| fold(&o.1) == fold(&text)).map(|o| o.0.clone()).unwrap_or(text)
        };
        let clause = Regex::new(&format!(
            r#"((?-u:\b){}\s+(?:eq|ne|eq_ci|in|has_any|has_all)\s*)(\[[^\]]*\]|"(?:[^"\\]|\\[^\n\r\u{{2028}}\u{{2029}}])*")"#,
            regex::escape(&field.name)
        ))
        .map_err(AppError::internal)?;
        let mut failed = None;
        let replaced = clause.replace_all(&out, |c: &regex::Captures| {
            let head = &c[1];
            let fixed = LITERAL.replace_all(&c[2], |l: &regex::Captures| match serde_json::from_str::<String>(&format!("\"{}\"", &l[1])) {
                Ok(text) => serde_json::to_string(&stored(text)).unwrap_or_default(),
                Err(e) => {
                    failed = Some(e.to_string());
                    l[0].to_string()
                }
            });
            format!("{}{}", EQ_CI.replace(head, "eq"), fixed)
        });
        out = replaced.into_owned();
        if let Some(e) = failed {
            return Err(AppError::internal(e));
        }
    }
    Ok(out)
}

/// `named`: how a reference reads in a refusal.
fn named(reference: Option<&Value>) -> String {
    match reference.and_then(Value::as_str).map(js_trim) {
        Some(t) if !t.is_empty() => format!(" (« {} »)", cut(t, 60)),
        _ => String::new(),
    }
}

/// `validateActions`: each proposal checked; what does not fit is dropped and said.
async fn validate_actions(
    st: &Shared,
    ctx: &RequestContext,
    catalog: &Catalog,
    focus: Option<&CatalogTable>,
    raw: Option<&Value>,
    dropped: &mut Vec<String>,
) -> Result<Vec<Value>, AppError> {
    let list: Vec<Value> = raw.and_then(Value::as_array).map(|a| a.iter().take(MAX_ACTIONS).cloned().collect()).unwrap_or_default();
    let mut actions = vec![];
    let mut proposed: Vec<(String, Vec<Value>)> = vec![];
    for item in &list {
        let a = object_or_empty(item);
        let table = find_table(catalog, a.get("table"), focus);
        match validate_one(st, ctx, catalog, &a, table, &mut proposed).await {
            Ok(action) => actions.push(action),
            Err(reason) => dropped.push(reason),
        }
    }
    Ok(actions)
}

async fn validate_one(st: &Shared, ctx: &RequestContext, catalog: &Catalog, a: &Value, table: Option<&CatalogTable>, proposed: &mut Vec<(String, Vec<Value>)>) -> Result<Value, String> {
    let schema_denied = || "modifier la structure n’est pas permis".to_string();
    match a.get("type").and_then(Value::as_str) {
        Some("filter") => {
            let Some(table) = table else { return Err(format!("filtre sur une table inconnue{}", named(a.get("table")))) };
            let filter = match a.get("filter").and_then(Value::as_str) {
                Some(f) => choices_as_values(js_trim(f), &table.fields).map_err(|e| e.cause.unwrap_or_else(|| "proposition écartée".into()))?,
                None => String::new(),
            };
            let sort = a.get("sort").and_then(Value::as_str).map(js_trim).filter(|s| !s.is_empty()).map(str::to_string);
            let options = ListOptions {
                table_id: table.id.clone(),
                filter: (!filter.is_empty()).then(|| filter.clone()),
                sort: sort.clone(),
                limit: Some(1.0),
                links_id: true,
                ..ListOptions::default()
            };
            let listed = match st.instance_key() {
                Ok(key) => list_records(&st.pools, ctx, key, &options).await.map(|_| ()),
                Err(e) => Err(e),
            };
            if let Err(e) = listed {
                let code = if e.code == "INTERNAL_ERROR" { "invalide" } else { e.code };
                return Err(format!("filtre refusé ({code})"));
            }
            Ok(json!({ "type": "filter", "table": table.name, "filter": filter, "sort": sort }))
        }
        Some("sql") => {
            static READS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(select|with)(?-u:\b)").unwrap());
            let sql = a.get("sql").and_then(Value::as_str).map(js_trim).unwrap_or("");
            if !READS.is_match(sql) {
                return Err("requête SQL qui écrit — les lignes se proposent par insert_records".into());
            }
            if !catalog.can_manage_schema {
                return Err("console SQL non accessible".into());
            }
            Ok(json!({ "type": "sql", "sql": sql }))
        }
        Some("add_fields") => {
            let Some(table) = table else { return Err(format!("colonnes pour une table inconnue{}", named(a.get("table")))) };
            if !catalog.can_manage_schema {
                return Err(schema_denied());
            }
            let labels: Vec<String> = table.fields.iter().map(|f| f.label.clone()).collect();
            let fields = clean_fields(a.get("fields"), catalog, &[], &labels);
            if fields.is_empty() {
                return Err("aucune colonne valable".into());
            }
            Ok(json!({ "type": "add_fields", "table": table.name, "fields": fields }))
        }
        Some("create_table") => {
            if !catalog.can_manage_schema {
                return Err(schema_denied());
            }
            let label = a.get("label").and_then(Value::as_str).map(|l| cut(js_trim(l), 200)).unwrap_or_default();
            if label.is_empty() {
                return Err("table sans libellé".into());
            }
            if catalog.tables.iter().any(|t| fold(&t.label) == fold(&label)) {
                return Err(format!("la table « {label} » existe déjà"));
            }
            let keys: Vec<String> = proposed.iter().map(|(k, _)| k.clone()).collect();
            let fields = clean_fields(a.get("fields"), catalog, &keys, &[]);
            let key = fold(&label);
            match proposed.iter_mut().find(|(k, _)| *k == key) {
                Some(entry) => entry.1 = fields.clone(),
                None => proposed.push((key, fields.clone())),
            }
            let description = a.get("description").and_then(Value::as_str).filter(|d| !js_trim(d).is_empty()).map(|d| cut(js_trim(d), 1000));
            Ok(json!({ "type": "create_table", "label": label, "description": description, "fields": fields }))
        }
        Some("insert_records") => {
            let pending = match table {
                Some(_) => None,
                None => {
                    let key = fold(&js_string(a.get("table")));
                    proposed.iter().find(|(k, _)| *k == key).map(|(_, f)| f.clone())
                }
            };
            if table.is_none() && pending.is_none() {
                return Err(format!("lignes pour une table inconnue{}", named(a.get("table"))));
            }
            let given = a.get("records").and_then(Value::as_array).or_else(|| a.get("rows").and_then(Value::as_array)).cloned().unwrap_or_default();
            let records: Vec<Value> = given
                .iter()
                .take(MAX_RECORDS)
                .map(|r| match table {
                    Some(t) => clean_values(r, t),
                    None => clean_pending_values(r, pending.as_deref().unwrap_or(&[])),
                })
                .filter(|r| !r.is_empty())
                .map(Value::Object)
                .collect();
            if records.is_empty() {
                return Err("aucune ligne valable".into());
            }
            if table.is_some_and(|t| !t.can_create) {
                return Err("ajouter des lignes n’est pas permis".into());
            }
            let name = table.map(|t| t.name.clone()).unwrap_or_else(|| js_string_of(a.get("table")));
            Ok(json!({ "type": "insert_records", "table": name, "pending": table.is_none(), "records": records }))
        }
        Some("update_records") => {
            let Some(table) = table else { return Err(format!("modifications pour une table inconnue{}", named(a.get("table")))) };
            if !table.can_update {
                return Err("modifier des lignes n’est pas permis".into());
            }
            let updates: Vec<Value> = a
                .get("updates")
                .and_then(Value::as_array)
                .map(|u| u.iter().take(MAX_RECORDS).collect::<Vec<_>>())
                .unwrap_or_default()
                .into_iter()
                .filter_map(|u| {
                    let id = u.as_object()?.get("id")?.as_str().filter(|id| UUID.is_match(id))?;
                    let values = clean_values(u.get("values").unwrap_or(&Value::Null), table);
                    (!values.is_empty()).then(|| json!({ "id": id, "values": values }))
                })
                .collect();
            if updates.is_empty() {
                return Err("aucune modification valable".into());
            }
            Ok(json!({ "type": "update_records", "table": table.name, "updates": updates }))
        }
        _ => Err(format!("proposition d’un type inconnu ({})", js_string_of(a.get("type")))),
    }
}

/// `cleanFields`: the columns a proposal names, kept when they could be created.
fn clean_fields(raw: Option<&Value>, catalog: &Catalog, proposed_tables: &[String], existing_labels: &[String]) -> Vec<Value> {
    let mut taken: HashSet<String> = existing_labels.iter().map(|l| fold(l)).collect();
    let mut out = vec![];
    let items: Vec<Value> = raw.and_then(Value::as_array).map(|a| a.iter().take(MAX_FIELDS).cloned().collect()).unwrap_or_default();
    for item in &items {
        let f = object_or_empty(item);
        let label = f.get("label").and_then(Value::as_str).map(|l| cut(js_trim(l), 200)).unwrap_or_default();
        let kind = f.get("kind").and_then(Value::as_str).unwrap_or("");
        if label.is_empty() || !CREATABLE.contains(&kind) || taken.contains(&fold(&label)) {
            continue;
        }
        let all: Vec<String> = f
            .get("options")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .map(|o| match o {
                        Value::String(s) => s.clone(),
                        Value::Object(m) => js_string(m.get("label")),
                        Value::Array(_) => String::new(),
                        _ => String::new(),
                    })
                    .map(|o| cut(js_trim(&o), 200))
                    .collect()
            })
            .unwrap_or_default();
        let options: Vec<String> = all
            .iter()
            .enumerate()
            .filter(|(i, o)| !o.is_empty() && all.iter().position(|x| fold(x) == fold(o)) == Some(*i))
            .map(|(_, o)| o.clone())
            .take(50)
            .collect();
        if (kind == "select" || kind == "multi_select") && options.is_empty() {
            continue;
        }
        let mut target = Value::Null;
        if kind == "link" {
            let wanted = f.get("target").and_then(Value::as_str).unwrap_or("");
            if let Some(existing) = catalog.tables.iter().find(|t| t.name == wanted || fold(&t.label) == fold(wanted)) {
                target = json!(existing.name);
            } else if proposed_tables.contains(&fold(wanted)) {
                target = json!(wanted);
            } else {
                continue;
            }
        }
        let prompt = f.get("prompt").and_then(Value::as_str).filter(|p| !js_trim(p).is_empty()).map(|p| cut(js_trim(p), 8000));
        let prompt = prompt.filter(|_| is_ai_kind(kind));
        taken.insert(fold(&label));
        let description = f.get("description").and_then(Value::as_str).filter(|d| !js_trim(d).is_empty()).map(|d| cut(js_trim(d), 1000));
        out.push(json!({ "label": label, "kind": kind, "description": description, "options": options, "target": target, "prompt": prompt }));
    }
    out
}

/// `coerce`: a value made to fit its column, `None` when it cannot be.
fn coerce(value: &Value, field: &CatalogField) -> Option<Value> {
    static NUMBER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^-?[0-9]+(\.[0-9]+)?$").unwrap());
    static DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$").unwrap());
    if value.is_null() {
        return Some(Value::Null);
    }
    match field.kind.as_str() {
        "short_text" | "long_text" => {
            let text = match value {
                Value::String(s) => s.clone(),
                Value::Number(n) => number_text(n),
                _ => return None,
            };
            Some(json!(cut(&text, if field.kind == "short_text" { 500 } else { 10_000 })))
        }
        "number" => {
            let text = match value {
                Value::Number(n) => number_text(n),
                Value::String(s) => js_trim(s).replacen(',', ".", 1),
                _ => String::new(),
            };
            NUMBER.is_match(&text).then(|| json!(text))
        }
        "boolean" => match value {
            Value::Bool(b) => Some(json!(b)),
            Value::String(s) if s == "oui" || s == "true" => Some(json!(true)),
            Value::String(s) if s == "non" || s == "false" => Some(json!(false)),
            _ => None,
        },
        "date" => value.as_str().filter(|s| DATE.is_match(s)).map(|s| json!(s)),
        "url" => basedb_records::values::shape_url(&field.name, value).ok().flatten().map(|s| json!(s)),
        "email" => basedb_records::values::shape_email(&field.name, value).ok().flatten().map(|s| json!(s)),
        "datetime" => value.as_str().filter(|s| basedb_records::history::js_date_parses(s)).map(|s| json!(s)),
        "select" => value.as_str().and_then(|s| option_of(s, field)).map(|s| json!(s)),
        "multi_select" => {
            let list: Vec<&Value> = match value {
                Value::Array(items) => items.iter().collect(),
                other => vec![other],
            };
            let mut kept: Vec<String> = vec![];
            for v in list {
                if let Some(found) = v.as_str().and_then(|s| option_of(s, field)) {
                    if !kept.contains(&found) {
                        kept.push(found);
                    }
                }
            }
            (!kept.is_empty()).then(|| json!(kept))
        }
        "link" => match value {
            Value::String(s) if UUID.is_match(s) => Some(json!({ "id": s })),
            Value::String(s) if !js_trim(s).is_empty() => Some(json!({ "display": cut(js_trim(s), 500) })),
            Value::Object(o) => {
                if let Some(id) = o.get("id").and_then(Value::as_str).filter(|id| UUID.is_match(id)) {
                    Some(json!({ "id": id }))
                } else {
                    o.get("display").and_then(Value::as_str).map(|d| json!({ "display": d }))
                }
            }
            _ => None,
        },
        _ => None,
    }
}

/// `optionOf`: a choice named by its value or by its label.
fn option_of(text: &str, field: &CatalogField) -> Option<String> {
    field.options.iter().find(|o| o.0 == text).or_else(|| field.options.iter().find(|o| fold(&o.1) == fold(text))).map(|o| o.0.clone())
}

/// `cleanValues`: keys by name or label, writable columns only, values coerced.
fn clean_values(raw: &Value, table: &CatalogTable) -> Map<String, Value> {
    let mut out = Map::new();
    for (key, value) in entries(raw) {
        let field = table.fields.iter().find(|f| f.name == key).or_else(|| table.fields.iter().find(|f| fold(&f.label) == fold(&key)));
        let Some(field) = field.filter(|f| f.writable) else { continue };
        if let Some(coerced) = coerce(&value, field) {
            out.insert(field.name.clone(), coerced);
        }
    }
    out
}

/// `cleanPendingValues`: rows for a table proposed alongside, keyed by label.
fn clean_pending_values(raw: &Value, fields: &[Value]) -> Map<String, Value> {
    let mut out = Map::new();
    for (key, value) in entries(raw) {
        let Some(field) = fields.iter().find(|f| fold(f["label"].as_str().unwrap_or("")) == fold(&key)) else { continue };
        if !field["prompt"].is_null() {
            continue;
        }
        let label = field["label"].as_str().unwrap_or("").to_string();
        let options = field["options"].as_array().map(|o| o.iter().filter_map(Value::as_str).map(|o| (o.to_string(), o.to_string())).collect()).unwrap_or_default();
        let catalog_field = CatalogField {
            id: String::new(),
            name: label.clone(),
            label: label.clone(),
            kind: field["kind"].as_str().unwrap_or("").to_string(),
            required: false,
            writable: true,
            options,
            target: field["target"].as_str().map(str::to_string),
        };
        if let Some(coerced) = coerce(&value, &catalog_field) {
            out.insert(label, coerced);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field(name: &str, kind: &str, options: &[(&str, &str)]) -> CatalogField {
        CatalogField {
            id: String::new(),
            name: name.into(),
            label: name.into(),
            kind: kind.into(),
            required: false,
            writable: true,
            options: options.iter().map(|(v, l)| (v.to_string(), l.to_string())).collect(),
            target: None,
        }
    }

    #[test]
    fn folds_like_node() {
        assert_eq!(fold("  Élève   Été "), "eleve ete");
        assert_eq!(cut("abcdef", 3), "abc…");
        assert_eq!(cut("abc", 3), "abc");
    }

    #[test]
    fn choices_become_values() {
        let fields = [field("statut", "select", &[("actif", "Actif"), ("prospect", "Prospect")])];
        assert_eq!(choices_as_values(r#"statut eq_ci "Actif" and ville eq "Lyon""#, &fields).unwrap(), r#"statut eq "actif" and ville eq "Lyon""#);
        assert_eq!(choices_as_values(r#"statut in ["Prospect", "actif"]"#, &fields).unwrap(), r#"statut in ["prospect", "actif"]"#);
        assert_eq!(choices_as_values(r#"xstatut eq "Actif""#, &fields).unwrap(), r#"xstatut eq "Actif""#);
    }

    #[test]
    fn conversation_keeps_the_latest() {
        let long = "x".repeat(4_100);
        let messages: Vec<(String, String)> = (0..25).map(|i| (if i % 2 == 0 { "user" } else { "assistant" }.to_string(), if i == 24 { "q".into() } else { long.clone() })).collect();
        let kept = trim_conversation(&messages);
        assert_eq!(kept.last().unwrap().1, "q");
        assert_eq!(kept.len(), 4);
        assert!(kept[0].1.ends_with('…'));
    }

    #[test]
    fn values_coerce_like_node() {
        let n = field("n", "number", &[]);
        assert_eq!(coerce(&json!(" 3,5 "), &n), Some(json!("3.5")));
        assert_eq!(coerce(&json!(2.5), &n), Some(json!("2.5")));
        assert_eq!(coerce(&json!("abc"), &n), None);
        let b = field("b", "boolean", &[]);
        assert_eq!(coerce(&json!("oui"), &b), Some(json!(true)));
        let m = field("m", "multi_select", &[("a", "Alpha"), ("b", "Beta")]);
        assert_eq!(coerce(&json!(["alpha", "b", "a", "z"]), &m), Some(json!(["a", "b"])));
        let l = field("l", "link", &[]);
        assert_eq!(coerce(&json!("  Dupont "), &l), Some(json!({ "display": "Dupont" })));
        assert_eq!(coerce(&Value::Null, &l), Some(Value::Null));
    }

    #[test]
    fn plain_reads_like_node() {
        assert_eq!(plain(Some(&json!({ "id": "x", "display": null }))), json!("x"));
        assert_eq!(plain(Some(&json!([{ "name": "a.pdf" }, "b"]))), json!(["a.pdf", "b"]));
        assert_eq!(plain(None), Value::Null);
    }

    #[test]
    fn fit_drops_rows() {
        let rows: Vec<Value> = (0..200).map(|i| json!([i, "x".repeat(50)])).collect();
        let mut m = Map::new();
        m.insert("columns".into(), json!(["a", "b"]));
        m.insert("rows".into(), json!(rows));
        m.insert("truncated".into(), json!(false));
        let out = fit(m);
        assert!(js_stringify(&out).len() <= MAX_OBSERVATION_BYTES);
        assert_eq!(out["truncated"], json!(true));
    }
}
