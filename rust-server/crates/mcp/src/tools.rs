//! The tool catalog (`tools.ts`, chapter 09 §2) — the declarations come verbatim from
//! `catalog.json`, written once from Node's server and now the source; the behaviour of each tool is here, over
//! the agent library of `basedb-automations` and the insights client of `basedb-admin`.

use crate::errors::{parameter_invalid, spread};
use crate::shape::{js_len, rows_within_budget, sanitize_deep, shape_row, utf16_len, JS_SPACE, RESPONSE_BUDGET_CHARS};
use crate::validate::{Checker, NAME};
use basedb_admin::insights as insights_api;
use basedb_automations::agent::describe;
use basedb_automations::agent::files::{agent_attach_file, AgentAttachRequest};
use basedb_automations::agent::records::{self as agent_records, AgentColumn, AgentListRequest, AgentRows, AgentWriteResult};
use basedb_automations::proposals::{self, Proposal};
use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::idempotency::js_stringify;
use basedb_base::tx::RequestContext;
use basedb_base::Shared;
use basedb_catalog::views::js_keys;
use basedb_records::js::{is_uuid_ci, js_trim, number_json, number_string};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

/// The longest `content_base64` a call may carry: a message, less room for the envelope.
pub const MAX_FILE_IN_MESSAGE: usize = 16 * 1024 * 1024 - 64 * 1024;
const SELECT: usize = 100;
const SORT: usize = 3;
const FULL_FIELDS: usize = 3;
const EXPAND: usize = 5;
const EXPAND_FIELDS: usize = 25;
const IDEMPOTENCY_KEY: usize = 64;
const LOOKUP_VALUE: usize = 1024;
const CURSOR: usize = 4096;

const PLAIN_KINDS: [&str; 8] = ["short_text", "long_text", "number", "boolean", "date", "datetime", "url", "email"];
const FIELD_KINDS: [&str; 11] = ["short_text", "long_text", "number", "boolean", "date", "datetime", "url", "email", "select", "multi_select", "link"];

// ── The catalog ────────────────────────────────────────────────────────────────

pub struct ToolDecl {
    pub name: String,
    /// The audit object of a call that failed before resolving one.
    pub object_kind: String,
    pub takes_environment: bool,
}

pub struct Catalog {
    pub tools: Vec<ToolDecl>,
    /// `declaredTools()`: what `tools/list` answers.
    pub declared: Vec<Value>,
    pub reserved: Vec<String>,
}

impl Catalog {
    pub fn tool(&self, name: &str) -> Option<&ToolDecl> {
        self.tools.iter().find(|t| t.name == name)
    }

    pub fn is_reserved(&self, name: &str) -> bool {
        self.reserved.iter().any(|r| r == name)
    }
}

/// The static catalog — never derived from user data (§2.1).
pub fn catalog() -> &'static Catalog {
    static CATALOG: OnceLock<Catalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        let file: Value = serde_json::from_str(include_str!("catalog.json")).expect("catalog.json");
        let environment = file["environment"].clone();
        let mut tools = Vec::new();
        let mut declared = Vec::new();
        for t in file["tools"].as_array().expect("tools") {
            let name = t["name"].as_str().expect("name").to_string();
            let mut schema = t["inputSchema"].clone();
            // `takesEnvironment`: every tool that names a base, and `list_bases`.
            let takes_environment = name == "list_bases" || schema.get("properties").and_then(|p| p.get("base")).is_some();
            if takes_environment {
                if let Some(Value::Object(properties)) = schema.get_mut("properties") {
                    properties.insert("environment".into(), environment.clone());
                }
            }
            declared.push(json!({
                "name": name,
                "title": t["title"],
                "description": t["description"],
                "inputSchema": schema,
                "annotations": t["annotations"],
            }));
            tools.push(ToolDecl { name, object_kind: t["objectKind"].as_str().expect("objectKind").to_string(), takes_environment });
        }
        let reserved = file["reserved"].as_array().expect("reserved").iter().filter_map(|r| r.as_str().map(String::from)).collect();
        Catalog { tools, declared, reserved }
    })
}

/// A tool result, success: the JSON as text, and as structured content when spoken.
pub fn tool_result(payload: &Map<String, Value>, structured: bool) -> Value {
    let clean = sanitize_deep(&Value::Object(payload.clone()));
    let mut out = Map::new();
    out.insert("content".into(), json!([{ "type": "text", "text": js_stringify(&clean) }]));
    if structured {
        out.insert("structuredContent".into(), clean);
    }
    Value::Object(out)
}

/// A tool result in error (§14.1): `isError`, and the stable JSON payload as text.
pub fn tool_error(payload: &Map<String, Value>) -> Value {
    let clean = sanitize_deep(&Value::Object(payload.clone()));
    json!({ "content": [{ "type": "text", "text": js_stringify(&clean) }], "isError": true })
}

// ── Running a tool ─────────────────────────────────────────────────────────────

pub struct ToolCx<'a> {
    pub st: &'a Shared,
    /// The MCP surface's pools (shorter timeouts).
    pub pools: &'a Pools,
    pub ctx: &'a RequestContext,
    /// Adapter-side bounds, published by `whoami` alongside the kernel's.
    pub budgets: &'a Value,
}

/// What the audit line of a call records about its object.
#[derive(Debug, Default, Clone)]
pub struct Facts {
    pub object_kind: String,
    pub object_id: Option<String>,
    pub object_name: Option<String>,
    pub base_id: Option<String>,
    pub table_id: Option<String>,
    pub returned: Option<u64>,
    pub truncated: Option<bool>,
}

impl Facts {
    pub fn kind(kind: &str) -> Facts {
        Facts { object_kind: kind.into(), ..Facts::default() }
    }
}

pub struct Outcome {
    pub payload: Map<String, Value>,
    pub audit: Facts,
}

pub async fn run(name: &str, cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    match name {
        "whoami" => whoami(cx, args).await,
        "list_bases" => list_bases(cx, args).await,
        "describe_base" => describe_base(cx, args).await,
        "describe_table" => describe_table(cx, args).await,
        "list_records" => list_records(cx, args).await,
        "get_record" => get_record(cx, args).await,
        "lookup_records" => lookup_records(cx, args).await,
        "create_record" => create_record(cx, args).await,
        "update_record" => update_record(cx, args).await,
        "delete_record" => delete_or_restore(cx, args, false).await,
        "restore_record" => delete_or_restore(cx, args, true).await,
        "attach_file" => attach_file(cx, args).await,
        "propose_create_table" => propose_create_table(cx, args).await,
        "propose_add_field" => propose_add_field(cx, args).await,
        "propose_update_look" => propose_update_look(cx, args).await,
        "get_proposal" => get_proposal(cx, args).await,
        "insights_describe_sources" => insights_describe_sources(cx, args).await,
        "insights_search" => insights_search(cx, args).await,
        "insights_run_question" => insights_run_question(cx, args).await,
        "insights_create_dashboard" => insights_create_dashboard(cx, args).await,
        "insights_add_question" => insights_add_question(cx, args).await,
        _ => Err(AppError::internal(format!("outil sans implémentation : {name}"))),
    }
}

fn into_map(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(m) => m,
        _ => Map::new(),
    }
}

fn text_at(value: &Value, path: &[&str]) -> Option<String> {
    path.iter().try_fold(value, |v, k| v.get(*k)).and_then(Value::as_str).map(String::from)
}

fn shape_error(e: String) -> AppError {
    AppError::internal(e)
}

/// `[...new Set(items)]`.
fn unique(items: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for item in items {
        if !out.contains(&item) {
            out.push(item);
        }
    }
    out
}

/// `String(x ?? '')`.
fn js_string(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => number_string(n.as_f64().unwrap_or(f64::NAN)),
        Some(Value::Array(items)) => items.iter().map(|i| js_string(Some(i))).collect::<Vec<_>>().join(","),
        Some(Value::Object(_)) => "[object Object]".into(),
    }
}

/// `${x}` in a template literal.
fn js_template(value: Option<&Value>) -> String {
    match value {
        None => "undefined".into(),
        Some(Value::Null) => "null".into(),
        other => js_string(other),
    }
}

// ── Reads ──────────────────────────────────────────────────────────────────────

async fn whoami(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    Checker::new(args).only(&[]).done()?;
    let payload = describe::agent_who_am_i(cx.pools, cx.ctx, cx.budgets).await?;
    Ok(Outcome { payload: into_map(payload), audit: Facts { object_id: cx.ctx.actor.token_id.clone(), ..Facts::kind("token") } })
}

async fn list_bases(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    Checker::new(args).only(&[]).done()?;
    let payload = describe::agent_list_bases(cx.pools, cx.ctx).await?;
    let returned = payload["bases"].as_array().map_or(0, Vec::len) as u64;
    Ok(Outcome { payload: into_map(payload), audit: Facts { returned: Some(returned), ..Facts::kind("tenant") } })
}

async fn describe_base(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base"]);
    let base = c.name("base");
    c.done()?;
    let payload = describe::agent_describe_base(cx.pools, cx.ctx, &base.unwrap_or_default()).await?;
    let id = text_at(&payload, &["base", "id"]);
    let audit = Facts { object_id: id.clone(), object_name: text_at(&payload, &["base", "name"]), base_id: id, ..Facts::kind("base") };
    Ok(Outcome { payload: into_map(payload), audit })
}

async fn describe_table(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table"]);
    let base = c.name("base");
    let table = c.name("table");
    c.done()?;
    let payload = describe::agent_describe_table(cx.pools, cx.ctx, &base.unwrap_or_default(), &table.unwrap_or_default()).await?;
    let id = text_at(&payload, &["table", "id"]);
    let audit = Facts {
        object_id: id.clone(),
        object_name: text_at(&payload, &["table", "name"]),
        base_id: text_at(&payload, &["base", "id"]),
        table_id: id,
        ..Facts::kind("table")
    };
    Ok(Outcome { payload: into_map(payload), audit })
}

fn shape_rows(rows: &AgentRows) -> Result<Vec<Map<String, Value>>, AppError> {
    rows.records.iter().map(|r| shape_row(r, &rows.columns, &[]).map_err(shape_error)).collect()
}

fn table_ref(rows_table: &agent_records::AgentTableRef) -> Value {
    json!({ "name": rows_table.name, "id": rows_table.id })
}

async fn list_records(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "select", "filter", "sort", "limit", "cursor", "expand", "expand_fields", "include_count"]);
    let request = AgentListRequest {
        base: c.name("base").unwrap_or_default(),
        table: c.name("table").unwrap_or_default(),
        select: c.names("select", SELECT),
        filter: c.filter("filter"),
        sort: c.names("sort", SORT),
        limit: c.integer("limit", 1.0, 1_000_000.0),
        cursor: c.string("cursor", CURSOR, false),
        expand: c.names("expand", EXPAND),
        expand_fields: c.names("expand_fields", EXPAND_FIELDS),
        include_count: c.boolean("include_count").unwrap_or(false),
    };
    c.done()?;
    let instance_key = cx.st.instance_key()?;
    let rows = agent_records::agent_list_records(cx.pools, cx.ctx, instance_key, &request).await?;

    // `pageOf`: shaped for transport and held to the budget by WHOLE rows; when rows must
    // be dropped, the page is read again with the smaller bound, so `next_cursor` resumes
    // right after the last row returned.
    let mut shaped = shape_rows(&rows)?;
    let mut envelope = Map::new();
    envelope.insert("table".into(), table_ref(&rows.table));
    envelope.insert("has_more".into(), json!(rows.has_more));
    envelope.insert("next_cursor".into(), json!(rows.next_cursor));
    envelope.insert("returned".into(), json!(shaped.len()));
    envelope.insert("truncated".into(), json!(false));
    if let Some(count) = rows.count {
        envelope.insert("count".into(), json!(count));
        envelope.insert("count_is_estimate".into(), json!(rows.count_is_estimate == Some(true)));
    }
    envelope.insert("provenance".into(), json!("user_data"));
    envelope.insert("notices".into(), Value::Array(rows.notices.clone()));

    let fit = rows_within_budget(&envelope, &shaped, RESPONSE_BUDGET_CHARS);
    let mut truncated = false;
    let (mut has_more, mut next_cursor) = (rows.has_more, rows.next_cursor.clone());
    if fit < shaped.len() {
        truncated = true;
        let again = AgentListRequest { limit: Some(fit.max(1) as f64), include_count: false, ..request };
        let page = agent_records::agent_list_records(cx.pools, cx.ctx, instance_key, &again).await?;
        shaped = shape_rows(&page)?;
        (has_more, next_cursor) = (page.has_more, page.next_cursor);
        if let Some(Value::Array(notices)) = envelope.get_mut("notices") {
            notices.push(json!({
                "kind": "response_truncated",
                "message": format!("La réponse est bornée à {RESPONSE_BUDGET_CHARS} caractères : poursuivez avec next_cursor, ou réduisez select."),
            }));
        }
    }
    let returned = shaped.len() as u64;
    envelope.insert("has_more".into(), json!(truncated || has_more));
    envelope.insert("next_cursor".into(), json!(next_cursor));
    envelope.insert("returned".into(), json!(returned));
    envelope.insert("truncated".into(), json!(truncated));
    envelope.insert("records".into(), Value::Array(shaped.into_iter().map(Value::Object).collect()));
    let audit = Facts {
        object_id: Some(rows.table.id.clone()),
        object_name: Some(rows.table.name.clone()),
        base_id: Some(rows.table.base_id.clone()),
        table_id: Some(rows.table.id.clone()),
        returned: Some(returned),
        truncated: Some(truncated),
        ..Facts::kind("table")
    };
    Ok(Outcome { payload: envelope, audit })
}

/// `fullRow`: one row whose named fields come whole — within the budget: past it they are
/// cut too, and said to be (§5.2).
fn full_row(row: &Map<String, Value>, columns: &[AgentColumn], full: &[String]) -> Result<Map<String, Value>, AppError> {
    let mut shaped = shape_row(row, columns, full).map_err(shape_error)?;
    let size = js_len(&Value::Object(shaped.clone()));
    if size <= RESPONSE_BUDGET_CHARS || full.is_empty() {
        return Ok(shaped);
    }
    let over = size - RESPONSE_BUDGET_CHARS + 1_000;
    let per_field = over.div_ceil(full.len());
    let mut cut = Vec::new();
    for name in full {
        let Some(Value::String(value)) = shaped.get(name) else { continue };
        let chars = value.chars().count();
        let keep = chars.saturating_sub(per_field);
        if keep < chars {
            let kept: String = value.chars().take(keep).collect();
            shaped.insert(name.clone(), Value::String(kept));
            cut.push(name.clone());
        }
    }
    if !cut.is_empty() {
        let already: Vec<String> = match shaped.get("_truncated_fields") {
            Some(Value::Array(items)) => items.iter().filter_map(|i| i.as_str().map(String::from)).collect(),
            _ => Vec::new(),
        };
        shaped.insert("_truncated_fields".into(), json!(unique(already.into_iter().chain(cut))));
    }
    Ok(shaped)
}

async fn get_record(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "_id", "select", "expand", "expand_fields", "full_fields"]);
    let base = c.name("base").unwrap_or_default();
    let table = c.name("table").unwrap_or_default();
    let id = c.uuid("_id").unwrap_or_default();
    let select = c.names("select", SELECT);
    let expand = c.names("expand", EXPAND);
    let expand_fields = c.names("expand_fields", EXPAND_FIELDS);
    let full = c.names("full_fields", FULL_FIELDS).unwrap_or_default();
    c.done()?;
    let instance_key = cx.st.instance_key()?;
    // A field asked whole is a field asked: resolved like `select`.
    let select = select.map(|s| unique(s.into_iter().chain(full.iter().cloned())));
    let rows = agent_records::agent_get_record(cx.pools, cx.ctx, instance_key, &base, &table, &id, select, expand, expand_fields).await?;
    for (i, name) in full.iter().enumerate() {
        if !rows.columns.iter().any(|col| &col.name == name) {
            return Err(AppError::new("FIELD_UNKNOWN")
                .with("param", json!(format!("full_fields[{i}]")))
                .with("object", json!({ "kind": "table", "name": rows.table.name })));
        }
    }
    let full = unique(full);
    let record = full_row(&rows.records.first().cloned().unwrap_or_default(), &rows.columns, &full)?;
    let mut payload = Map::new();
    payload.insert("table".into(), table_ref(&rows.table));
    payload.insert("record".into(), Value::Object(record));
    payload.insert("provenance".into(), json!("user_data"));
    payload.insert("notices".into(), Value::Array(rows.notices.clone()));
    let audit = Facts {
        object_id: Some(id.to_lowercase()),
        object_name: Some(rows.table.name.clone()),
        base_id: Some(rows.table.base_id.clone()),
        table_id: Some(rows.table.id.clone()),
        returned: Some(1),
        ..Facts::kind("record")
    };
    Ok(Outcome { payload, audit })
}

async fn lookup_records(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "value", "limit"]);
    let base = c.name("base").unwrap_or_default();
    let table = c.name("table").unwrap_or_default();
    let value = c.string("value", LOOKUP_VALUE, true).unwrap_or_default();
    let limit = c.integer("limit", 1.0, 25.0);
    c.done()?;
    let instance_key = cx.st.instance_key()?;
    let payload = agent_records::agent_lookup_records(cx.pools, cx.ctx, instance_key, &base, &table, &json!(value), limit).await?;
    let resolved = payload.get("table").cloned().unwrap_or(Value::Null);
    let mut out = Map::new();
    out.insert("table".into(), json!({ "name": resolved.get("name"), "id": resolved.get("id") }));
    for (k, v) in into_map(payload.clone()) {
        if k != "table" {
            out.insert(k, v);
        }
    }
    let id = text_at(&resolved, &["id"]);
    let audit = Facts {
        object_id: id.clone(),
        object_name: text_at(&resolved, &["name"]),
        base_id: text_at(&resolved, &["baseId"]),
        table_id: id,
        returned: payload.get("returned").and_then(Value::as_u64),
        ..Facts::kind("table")
    };
    Ok(Outcome { payload: out, audit })
}

// ── Writes ─────────────────────────────────────────────────────────────────────

fn write_outcome(result: AgentWriteResult) -> Result<Outcome, AppError> {
    let mut response = into_map(result.response);
    if let Some(Value::Object(record)) = response.get("record") {
        let shaped = shape_row(record, &result.columns, &[]).map_err(shape_error)?;
        response.insert("record".into(), Value::Object(shaped));
    }
    let audit = Facts {
        object_id: response.get("_id").and_then(Value::as_str).map(String::from),
        object_name: Some(result.table.name.clone()),
        base_id: Some(result.table.base_id.clone()),
        table_id: Some(result.table.id.clone()),
        returned: Some(1),
        ..Facts::kind("record")
    };
    Ok(Outcome { payload: response, audit })
}

async fn create_record(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "values", "idempotency_key"]);
    let base = c.name("base").unwrap_or_default();
    let table = c.name("table").unwrap_or_default();
    let values = c.values("values").unwrap_or_default();
    let key = c.string("idempotency_key", IDEMPOTENCY_KEY, false);
    c.done()?;
    let instance_key = cx.st.instance_key()?;
    write_outcome(agent_records::agent_create_record(cx.pools, cx.ctx, instance_key, &base, &table, &values, key.as_deref()).await?)
}

async fn update_record(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "_id", "values", "idempotency_key"]);
    let base = c.name("base").unwrap_or_default();
    let table = c.name("table").unwrap_or_default();
    let id = c.uuid("_id").unwrap_or_default();
    let values = c.values("values").unwrap_or_default();
    let key = c.string("idempotency_key", IDEMPOTENCY_KEY, false);
    c.done()?;
    let instance_key = cx.st.instance_key()?;
    write_outcome(agent_records::agent_update_record(cx.pools, cx.ctx, instance_key, &base, &table, &id, &values, key.as_deref()).await?)
}

async fn delete_or_restore(cx: &ToolCx<'_>, args: &Map<String, Value>, restore: bool) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "_id", "idempotency_key"]);
    let base = c.name("base").unwrap_or_default();
    let table = c.name("table").unwrap_or_default();
    let id = c.uuid("_id").unwrap_or_default();
    let key = c.string("idempotency_key", IDEMPOTENCY_KEY, false);
    c.done()?;
    let instance_key = cx.st.instance_key()?;
    let result = if restore {
        agent_records::agent_restore_record(cx.pools, cx.ctx, instance_key, &base, &table, &id, key.as_deref()).await?
    } else {
        agent_records::agent_delete_record(cx.pools, cx.ctx, instance_key, &base, &table, &id, key.as_deref()).await?
    };
    write_outcome(result)
}

fn data_prefix() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^data:[^,]*;base64,").unwrap())
}

/// `BASE64`: optionally behind a `data:` prefix, line breaks allowed.
fn base64_shaped(text: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(&format!(r"^[A-Za-z0-9+/{JS_SPACE}]*={{0,2}}[{JS_SPACE}]*$")).unwrap()).is_match(text)
}

/// `Buffer.from(text, 'base64')`: whitespace skipped, `-`/`_` taken for `+`/`/`, decoding
/// stops at the first `=`, a dangling sextet is dropped.
pub fn node_base64(text: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in text.chars() {
        let v = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '+' | '-' => 62,
            '/' | '_' => 63,
            '=' => break,
            _ => continue,
        };
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    out
}

async fn attach_file(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "_id", "field", "name", "content_base64", "url", "content_type", "mode"]);
    let base = c.name("base").unwrap_or_default();
    let table = c.name("table").unwrap_or_default();
    let id = c.uuid("_id").unwrap_or_default();
    let field = c.name("field").unwrap_or_default();
    let name = c.string("name", 255, false);
    let content_type = c.string("content_type", 255, false);
    let url = c.string("url", 2048, false);
    let raw = c.string("content_base64", MAX_FILE_IN_MESSAGE, false);
    let mode = c.string("mode", 16, false);
    // One source, and only one: the bytes, or where to fetch them.
    c.entry("content_base64", raw.is_none() != url.is_none());
    let encoded = raw.map(|r| data_prefix().replace(&r, "").into_owned());
    c.entry("content_base64", encoded.as_deref().is_none_or(base64_shaped));
    c.entry("mode", matches!(mode.as_deref(), None | Some("append" | "replace")));
    c.done()?;
    let request = AgentAttachRequest {
        base,
        table,
        id,
        field,
        name,
        content_type,
        bytes: encoded.as_deref().map(node_base64),
        url,
        mode: Some(if mode.as_deref() == Some("replace") { "replace" } else { "append" }.into()),
    };
    let result = agent_attach_file(cx.st, cx.ctx, &request).await?;
    write_outcome(result.write)
}

// ── Proposals (§7) ─────────────────────────────────────────────────────────────

/// The proposal as the agent reads it (§7.3).
fn proposal_outcome(p: Proposal) -> Outcome {
    let mut payload = Map::new();
    payload.insert("proposal_id".into(), json!(p.id));
    payload.insert("status".into(), json!(p.status));
    payload.insert("base".into(), json!({ "name": p.base.get("name"), "id": p.base.get("id") }));
    payload.insert("expires_at".into(), json!(p.expires_at));
    payload.insert("approval".into(), json!({ "where": "la file « Propositions » de la base, dans l’application basedb", "url": null }));
    payload.insert("summary_template".into(), json!(p.summary_template));
    payload.insert("summary_params".into(), p.summary_params.clone());
    payload.insert("affected_objects".into(), p.affected_objects.clone());
    payload.insert("up_sql".into(), p.up_sql.clone());
    payload.insert("down_sql".into(), p.down_sql.clone());
    if !p.decided_at.is_null() {
        payload.insert("decided_at".into(), p.decided_at.clone());
    }
    let base_id = text_at(&p.base, &["id"]);
    Outcome {
        payload,
        audit: Facts { object_id: Some(p.id.clone()), object_name: Some(p.summary_template.clone()), base_id, ..Facts::kind("migration") },
    }
}

/// `lookArgs`: the `color` and `icon` of an object of the arguments — their JSON types only.
fn look_args(c: &mut Checker, object: &Map<String, Value>, path: &str) -> Option<Map<String, Value>> {
    let mut out = Map::new();
    for key in ["color", "icon"] {
        let Some(value) = object.get(key) else { continue };
        c.entry(format!("{path}{key}"), matches!(value, Value::Null) || matches!(value, Value::String(s) if utf16_len(s) <= 64));
        out.insert(key.into(), if value.is_string() { value.clone() } else { Value::Null });
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

/// `initialFields`: a field of `propose_create_table`, checked entry by entry.
fn initial_fields(c: &mut Checker, raw: Option<Vec<Map<String, Value>>>) -> Vec<Value> {
    raw.unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(i, f)| {
            let label = f.get("label").and_then(Value::as_str).unwrap_or("").to_string();
            let kind = f.get("kind").and_then(Value::as_str).unwrap_or("").to_string();
            c.entry(format!("fields[{i}].label"), !js_trim(&label).is_empty() && utf16_len(&label) <= 255);
            c.entry(format!("fields[{i}].kind"), PLAIN_KINDS.contains(&kind.as_str()));
            let description = f.get("description");
            c.entry(
                format!("fields[{i}].description"),
                matches!(description, None | Some(Value::Null)) || matches!(description, Some(Value::String(s)) if utf16_len(s) <= 1000),
            );
            c.entry(format!("fields[{i}].required"), matches!(f.get("required"), None | Some(Value::Bool(_))));
            json!({
                "label": label,
                "kind": kind,
                "description": description.filter(|d| d.is_string()).cloned().unwrap_or(Value::Null),
                "required": f.get("required") == Some(&Value::Bool(true)),
            })
        })
        .collect()
}

async fn propose_create_table(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "label", "description", "fields", "color", "icon"]);
    let base = c.name("base");
    let label = c.string("label", 255, true);
    let description = c.string("description", 1000, false);
    let raw = c.objects("fields", 50, true);
    let fields = initial_fields(&mut c, raw);
    let look = look_args(&mut c, args, "");
    c.done()?;
    let mut request = Map::new();
    request.insert("base".into(), json!(base));
    request.insert("label".into(), json!(label));
    if let Some(d) = description {
        request.insert("description".into(), json!(d));
    }
    request.insert("fields".into(), Value::Array(fields));
    if let Some(look) = look {
        request.insert("look".into(), Value::Object(look));
    }
    Ok(proposal_outcome(proposals::agent_propose_create_table(cx.pools, cx.ctx, &Value::Object(request)).await?))
}

async fn propose_add_field(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "label", "kind", "description", "options", "target", "on_delete"]);
    let base = c.name("base");
    let table = c.name("table");
    let label = c.string("label", 255, true);
    let kind = c.string("kind", 32, true);
    c.entry("kind", FIELD_KINDS.contains(&kind.as_deref().unwrap_or("")));
    let description = c.string("description", 1000, false);
    let raw_options = c.objects("options", 200, false);
    let options: Vec<Value> = raw_options
        .as_deref()
        .unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(i, o)| {
            c.entry(format!("options[{i}].value"), matches!(o.get("value"), Some(Value::String(s)) if !s.is_empty() && utf16_len(s) <= 200));
            c.entry(format!("options[{i}].label"), o.get("label").is_none() || matches!(o.get("label"), Some(Value::String(s)) if utf16_len(s) <= 200));
            let look = look_args(&mut c, o, &format!("options[{i}]."));
            let mut option = Map::new();
            option.insert("value".into(), json!(js_string(o.get("value"))));
            if let Some(Value::String(l)) = o.get("label") {
                option.insert("label".into(), json!(l));
            }
            option.extend(look.unwrap_or_default());
            Value::Object(option)
        })
        .collect();
    let target = c.name_opt("target", false);
    let on_delete = c.string("on_delete", 16, false);
    // `cascade` is not a value this surface knows: refused by name, whoever asks (§8.4).
    if on_delete.as_deref() == Some("cascade") {
        return Err(AppError::new("MCP_CASCADE_FORBIDDEN"));
    }
    c.entry("on_delete", matches!(on_delete.as_deref(), None | Some("restrict" | "set_null")));
    c.done()?;
    let mut request = Map::new();
    request.insert("base".into(), json!(base));
    request.insert("table".into(), json!(table));
    request.insert("label".into(), json!(label));
    request.insert("kind".into(), json!(kind));
    if let Some(d) = description {
        request.insert("description".into(), json!(d));
    }
    if raw_options.is_some() {
        request.insert("options".into(), Value::Array(options));
    }
    if let Some(t) = target {
        request.insert("target".into(), json!(t));
    }
    if let Some(d) = on_delete {
        request.insert("onDelete".into(), json!(d));
    }
    Ok(proposal_outcome(proposals::agent_propose_add_field(cx.pools, cx.ctx, &Value::Object(request)).await?))
}

async fn propose_update_look(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["base", "table", "color", "icon", "fields"]);
    let base = c.name("base");
    let table = c.name("table");
    let look = look_args(&mut c, args, "");
    let raw_fields = c.objects("fields", 50, false).unwrap_or_default();
    let mut fields = Vec::new();
    for (i, f) in raw_fields.iter().enumerate() {
        c.entry(format!("fields[{i}].field"), matches!(f.get("field"), Some(Value::String(s)) if utf16_len(s) <= NAME));
        let raw: &[Value] = match f.get("options") {
            Some(Value::Array(items)) => items,
            _ => &[],
        };
        c.entry(format!("fields[{i}].options"), !raw.is_empty() && raw.len() <= 200);
        let empty = Map::new();
        let options: Vec<Value> = raw
            .iter()
            .enumerate()
            .map(|(j, o)| {
                let option = o.as_object().unwrap_or(&empty);
                c.entry(format!("fields[{i}].options[{j}].value"), matches!(option.get("value"), Some(Value::String(s)) if utf16_len(s) <= 200));
                let mut out = Map::new();
                out.insert("value".into(), json!(js_string(option.get("value"))));
                out.extend(look_args(&mut c, option, &format!("fields[{i}].options[{j}].")).unwrap_or_default());
                Value::Object(out)
            })
            .collect();
        fields.push(json!({ "field": js_string(f.get("field")), "options": options }));
    }
    c.done()?;
    let mut request = Map::new();
    request.insert("base".into(), json!(base));
    request.insert("table".into(), json!(table));
    if let Some(look) = look {
        request.insert("look".into(), Value::Object(look));
    }
    request.insert("fields".into(), Value::Array(fields));
    Ok(proposal_outcome(proposals::agent_propose_update_look(cx.pools, cx.ctx, &Value::Object(request)).await?))
}

async fn get_proposal(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["proposal_id"]);
    let id = c.uuid("proposal_id").unwrap_or_default();
    c.done()?;
    Ok(proposal_outcome(proposals::agent_get_proposal(cx.pools, cx.ctx, &id).await?))
}

// ── insights ───────────────────────────────────────────────────────────────────

/// `JSON.stringify` writes an integral number without a fraction; `call` sends
/// `Value::to_string`, so the body is made of such numbers first.
fn js_numbers(value: &Value) -> Value {
    match value {
        Value::Number(n) if n.is_f64() => number_json(n.as_f64().unwrap_or(f64::NAN)),
        Value::Array(items) => Value::Array(items.iter().map(js_numbers).collect()),
        Value::Object(map) => Value::Object(map.iter().map(|(k, v)| (k.clone(), js_numbers(v))).collect()),
        other => other.clone(),
    }
}

/// `kernel.insightsRequest`: insights' API, in the name of the token's owner (5 minutes).
async fn insights_request(cx: &ToolCx<'_>, method: reqwest::Method, path: &str, body: Option<Value>) -> Result<Value, AppError> {
    let config = insights_api::require_insights(cx.st)?;
    let person = insights_api::person_of(cx.st, &cx.ctx.actor.id).await?;
    let token = insights_api::token_for(config, &person, 300);
    insights_api::call(config, &token, method, path, body.map(|b| js_numbers(&b)).as_ref()).await
}

/// `insightsUrl`: where a person opens it, `null` when insights is not configured.
fn insights_url(cx: &ToolCx<'_>, path: &str) -> Value {
    match &cx.st.cfg.insights {
        Some(config) => json!(format!("{}{path}", config.public_url)),
        None => Value::Null,
    }
}

/// A write of insights — refused to a token that may create nothing in basedb.
async fn insights_writer(cx: &ToolCx<'_>) -> Result<(), AppError> {
    let me = describe::agent_who_am_i(cx.pools, cx.ctx, cx.budgets).await?;
    if !truthy(me.get("access").and_then(|a| a.get("create"))) {
        return Err(AppError::new("PERMISSION_DENIED").with("reason", json!("jeton_sans_creation")));
    }
    Ok(())
}

fn truthy(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

fn insights_audit(kind: &str, id: Option<&Value>, name: Option<&Value>, returned: Option<u64>) -> Facts {
    Facts {
        object_id: id.and_then(Value::as_str).filter(|s| is_uuid_ci(s)).map(String::from),
        object_name: name.and_then(Value::as_str).map(|s| String::from_utf16_lossy(&s.encode_utf16().take(200).collect::<Vec<u16>>())),
        returned,
        ..Facts::kind(kind)
    }
}

/// Where JavaScript would throw a `TypeError` reading a malformed answer of insights.
fn malformed(what: &str) -> AppError {
    AppError::internal(format!("réponse d’insights inattendue : {what}"))
}

fn copy_keys(from: &Value, keys: &[&str]) -> Map<String, Value> {
    keys.iter().filter_map(|k| from.get(*k).map(|v| (k.to_string(), v.clone()))).collect()
}

fn check_question(c: &mut Checker, path: &str, q: &Map<String, Value>) {
    let at = |key: &str| if path.is_empty() { key.to_string() } else { format!("{path}.{key}") };
    c.entry(at("name"), matches!(q.get("name"), Some(Value::String(s)) if !js_trim(s).is_empty() && utf16_len(s) <= 200));
    c.entry(at("description"), q.get("description").is_none() || matches!(q.get("description"), Some(Value::String(s)) if utf16_len(s) <= 5000));
    let query_ok = match q.get("query") {
        Some(query @ Value::Object(m)) => matches!(m.get("kind").and_then(Value::as_str), Some("builder" | "sql")) && js_len(query) <= 60_000,
        _ => false,
    };
    c.entry(at("query"), query_ok);
    c.entry(at("visualization"), matches!(q.get("visualization"), Some(Value::Object(v)) if v.get("type").is_some_and(Value::is_string)));
    for key in js_keys(q) {
        c.entry(at(key), ["name", "description", "query", "visualization"].contains(&key.as_str()));
    }
}

async fn insights_describe_sources(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["search"]);
    let search = c.string("search", 200, false).map(|s| js_trim(&s).to_lowercase());
    c.done()?;
    let tree = insights_request(cx, reqwest::Method::GET, "/api/v1/schema-tree", None).await?;
    let datasources = tree.get("datasources").and_then(Value::as_array).ok_or_else(|| malformed("datasources"))?;
    let lower = |v: Option<&Value>| -> Result<String, AppError> {
        match v {
            Some(Value::String(s)) => Ok(s.to_lowercase()),
            _ => Err(malformed("nom")),
        }
    };
    let or_empty = |v: Option<&Value>| match v {
        None | Some(Value::Null) => Some(Value::String(String::new())),
        other => other.cloned(),
    };
    let mut sources = Vec::new();
    for d in datasources {
        let tables = d.get("tables").and_then(Value::as_array).ok_or_else(|| malformed("tables"))?;
        let mut kept = Vec::new();
        for t in tables {
            let columns = t.get("columns").and_then(Value::as_array).ok_or_else(|| malformed("columns"))?;
            let matches = match search.as_deref() {
                None | Some("") => true,
                Some(search) => {
                    let mut texts = vec![lower(t.get("name"))?, lower(or_empty(t.get("label")).as_ref())?];
                    for col in columns {
                        texts.push(lower(col.get("name"))?);
                        texts.push(lower(or_empty(col.get("label")).as_ref())?);
                    }
                    texts.iter().any(|s| s.contains(search))
                }
            };
            if !matches {
                continue;
            }
            let mut table = copy_keys(t, &["id"]);
            table.insert(
                "sql_name".into(),
                json!(format!("{}.{}.{}", js_template(d.get("catalog")), js_template(t.get("schema")), js_template(t.get("name")))),
            );
            table.extend(copy_keys(t, &["label"]));
            table.insert("columns".into(), Value::Array(columns.iter().map(|col| Value::Object(copy_keys(col, &["name", "type", "label"]))).collect()));
            kept.push(Value::Object(table));
        }
        if kept.is_empty() {
            continue;
        }
        let mut source = copy_keys(d, &["id", "name", "engine", "catalog"]);
        source.insert("tables".into(), Value::Array(kept));
        sources.push(source);
    }
    // Within the response budget: tables whole, as many as fit; the rest, named.
    let (mut used, mut truncated, mut count) = (0usize, false, 0u64);
    let shown: Vec<Value> = sources
        .into_iter()
        .map(|mut d| {
            if let Some(Value::Array(tables)) = d.get_mut("tables") {
                for t in tables.iter_mut() {
                    count += 1;
                    let size = js_len(t);
                    if used + size > RESPONSE_BUDGET_CHARS - 2_000 {
                        truncated = true;
                        let mut named = copy_keys(t, &["id", "sql_name", "label"]);
                        named.insert("columns".into(), json!("omises"));
                        *t = Value::Object(named);
                    } else {
                        used += size;
                    }
                }
            }
            Value::Object(d)
        })
        .collect();
    let mut payload = Map::new();
    payload.insert("datasources".into(), Value::Array(shown));
    payload.insert("truncated".into(), json!(truncated));
    if truncated {
        payload.insert("hint".into(), json!("Précisez « search » pour obtenir les colonnes des tables omises."));
    }
    payload.insert("provenance".into(), json!("user_data"));
    Ok(Outcome { payload, audit: Facts { returned: Some(count), truncated: Some(truncated), ..Facts::kind("insights_source") } })
}

async fn insights_search(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["q", "kind"]);
    let q = c.string("q", 200, false).unwrap_or_default();
    let kind = c.string("kind", 20, false);
    c.entry("kind", kind.as_deref().is_none_or(|k| ["question", "dashboard", "model", "metric"].contains(&k)));
    c.done()?;
    let query = {
        let mut query = form_urlencoded::Serializer::new(String::new());
        query.append_pair("q", &q);
        if let Some(kind) = &kind {
            query.append_pair("kind", kind);
        }
        query.finish()
    };
    let found = insights_request(cx, reqwest::Method::GET, &format!("/api/v1/search?{query}"), None).await?;
    if found.is_null() {
        return Err(malformed("search"));
    }
    let items: Vec<Value> = match found.get("items") {
        None | Some(Value::Null) => Vec::new(),
        Some(Value::Array(items)) => items
            .iter()
            .take(100)
            .map(|i| {
                let mut item = copy_keys(i, &["id", "kind", "name"]);
                item.insert("description".into(), i.get("description").filter(|d| !d.is_null()).cloned().unwrap_or(Value::Null));
                let id = js_template(i.get("id"));
                let path = if i.get("kind").and_then(Value::as_str) == Some("dashboard") { format!("/dashboard/{id}") } else { format!("/question/{id}") };
                item.insert("url".into(), insights_url(cx, &path));
                Value::Object(item)
            })
            .collect(),
        Some(_) => return Err(malformed("items")),
    };
    let returned = items.len() as u64;
    let mut payload = Map::new();
    payload.insert("items".into(), Value::Array(items));
    payload.insert("provenance".into(), json!("user_data"));
    Ok(Outcome { payload, audit: Facts { returned: Some(returned), ..Facts::kind("insights_item") } })
}

/// `encodeURIComponent`.
fn encode_uri_component(text: &str) -> String {
    let mut out = String::new();
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// `row[i] ?? null` as JavaScript reads it: an array's element, a string's UTF-16 unit, an
/// object's `"i"` key; anything else is `undefined`.
fn js_index(row: &Value, i: usize) -> Value {
    let found = match row {
        Value::Array(items) => items.get(i).cloned(),
        Value::String(s) => s.encode_utf16().nth(i).map(|unit| Value::String(String::from_utf16_lossy(&[unit]))),
        Value::Object(map) => map.get(&i.to_string()).cloned(),
        _ => None,
    };
    found.filter(|v| !v.is_null()).unwrap_or(Value::Null)
}

async fn insights_run_question(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["question", "parameters", "limit"]);
    let id = c.string("question", 64, true).unwrap_or_default();
    let limit = c.integer("limit", 1.0, 500.0).unwrap_or(100.0) as usize;
    let parameters = if args.contains_key("parameters") { c.values("parameters") } else { None };
    c.done()?;
    let body = match parameters {
        None => json!({}),
        Some(p) => json!({ "parameters": p }),
    };
    let result = insights_request(cx, reqwest::Method::POST, &format!("/api/v1/questions/{}/run", encode_uri_component(&id)), Some(body)).await?;
    if result.is_null() {
        return Err(malformed("run"));
    }
    let columns: Vec<Map<String, Value>> = match result.get("columns") {
        None | Some(Value::Null) => Vec::new(),
        Some(Value::Array(cols)) => cols
            .iter()
            .map(|col| {
                let mut m = copy_keys(col, &["name"]);
                let label = col.get("label").filter(|l| !l.is_null()).or_else(|| col.get("name"));
                if let Some(label) = label {
                    m.insert("label".into(), label.clone());
                }
                m.insert("type".into(), col.get("type").filter(|t| !t.is_null()).cloned().unwrap_or(Value::Null));
                m
            })
            .collect(),
        Some(_) => return Err(malformed("columns")),
    };
    let rows: &[Value] = match result.get("rows") {
        None | Some(Value::Null) => &[],
        Some(Value::Array(rows)) => rows,
        Some(_) => return Err(malformed("rows")),
    };
    let mut all = Vec::new();
    for row in rows.iter().take(limit) {
        if row.is_null() {
            return Err(malformed("row"));
        }
        let mut record = Map::new();
        for (i, col) in columns.iter().enumerate() {
            let value = js_index(row, i);
            record.insert(js_template(col.get("name")), value);
        }
        all.push(record);
    }
    let mut envelope = Map::new();
    envelope.insert("question".into(), json!(id));
    envelope.insert("columns".into(), Value::Array(columns.into_iter().map(Value::Object).collect()));
    envelope.insert("provenance".into(), json!("user_data"));
    let fit = rows_within_budget(&envelope, &all, RESPONSE_BUDGET_CHARS);
    let total = rows.len();
    let mut payload = envelope;
    payload.insert("records".into(), Value::Array(all.into_iter().take(fit).map(Value::Object).collect()));
    payload.insert("total_rows".into(), json!(total));
    payload.insert("truncated".into(), json!(fit < total));
    Ok(Outcome { payload, audit: insights_audit("insights_question", Some(&json!(id)), None, Some(fit as u64)) })
}

async fn insights_create_dashboard(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["name", "description", "questions"]);
    let name = c.string("name", 200, true);
    let description = c.string("description", 5000, false);
    let questions = c.objects("questions", 24, true).unwrap_or_default();
    for (i, q) in questions.iter().enumerate() {
        check_question(&mut c, &format!("questions[{i}]"), q);
    }
    c.done()?;
    insights_writer(cx).await?;
    let mut body = Map::new();
    body.insert("name".into(), json!(name));
    if let Some(d) = description {
        body.insert("description".into(), json!(d));
    }
    let dashboard = insights_request(cx, reqwest::Method::POST, "/api/v1/dashboards", Some(Value::Object(body))).await?;
    if dashboard.is_null() {
        return Err(malformed("dashboard"));
    }
    let dashboard_id = dashboard.get("id").cloned();
    let mut created = Vec::new();
    let mut failed = Vec::new();
    for (index, q) in questions.iter().enumerate() {
        let mut body = q.clone();
        match &dashboard_id {
            Some(id) => {
                body.insert("dashboard".into(), id.clone());
            }
            None => {
                body.remove("dashboard");
            }
        }
        let saved = insights_request(cx, reqwest::Method::POST, "/api/v1/questions", Some(Value::Object(body))).await;
        match saved {
            Ok(saved) if !saved.is_null() => created.push(Value::Object(copy_keys(&saved, &["id", "name"]))),
            Ok(_) => failed.push(json!({ "index": index, "name": q.get("name"), "error": {} })),
            Err(e) => {
                // `{ code: e.code, ...e.details }` — nothing of a JavaScript exception.
                let error = if e.code == "INTERNAL_ERROR" && e.cause.is_some() {
                    Map::new()
                } else {
                    spread([("code".to_string(), json!(e.code))].into_iter().collect(), &e.details)
                };
                failed.push(json!({ "index": index, "name": q.get("name"), "error": error }));
            }
        }
    }
    let id_text = js_template(dashboard_id.as_ref());
    let mut board = copy_keys(&dashboard, &["id", "name"]);
    board.insert("url".into(), insights_url(cx, &format!("/dashboard/{id_text}")));
    let returned = created.len() as u64;
    let mut payload = Map::new();
    payload.insert("dashboard".into(), Value::Object(board));
    payload.insert("questions".into(), Value::Array(created));
    if !failed.is_empty() {
        payload.insert("failed".into(), Value::Array(failed));
        payload.insert("hint".into(), json!("Corrigez ces questions et ajoutez-les avec insights_add_question (dashboard = l’identifiant ci-dessus)."));
    }
    Ok(Outcome { payload, audit: insights_audit("insights_dashboard", dashboard.get("id"), dashboard.get("name"), Some(returned)) })
}

async fn insights_add_question(cx: &ToolCx<'_>, args: &Map<String, Value>) -> Result<Outcome, AppError> {
    let mut c = Checker::new(args);
    c.only(&["name", "description", "query", "visualization", "dashboard"]);
    let dashboard = c.string("dashboard", 64, false);
    let mut question = args.clone();
    question.shift_remove("dashboard");
    check_question(&mut c, "", &question);
    c.done()?;
    insights_writer(cx).await?;
    let mut body = question.clone();
    if let Some(d) = &dashboard {
        body.insert("dashboard".into(), json!(d));
    }
    let saved = insights_request(cx, reqwest::Method::POST, "/api/v1/questions", Some(Value::Object(body))).await?;
    if saved.is_null() {
        return Err(malformed("question"));
    }
    let mut q = copy_keys(&saved, &["id", "name"]);
    q.insert("url".into(), insights_url(cx, &format!("/question/{}", js_template(saved.get("id")))));
    let mut payload = Map::new();
    payload.insert("question".into(), Value::Object(q));
    if let Some(d) = &dashboard {
        payload.insert("dashboard".into(), json!({ "id": d, "url": insights_url(cx, &format!("/dashboard/{d}")) }));
    }
    Ok(Outcome { payload, audit: insights_audit("insights_question", saved.get("id"), saved.get("name"), None) })
}

/// `parameterInvalid(['environment'])`-like checks of the entry point live in `routes`.
pub fn environment_of(args: &Map<String, Value>) -> Result<Option<String>, AppError> {
    let Some(value) = args.get("environment") else { return Ok(None) };
    let single: Map<String, Value> = [("environment".to_string(), value.clone())].into_iter().collect();
    let mut c = Checker::new(&single);
    let asked = c.name("environment");
    c.done()?;
    asked.map(Some).ok_or_else(|| parameter_invalid(vec!["environment".into()]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_declares_the_environment() {
        let cat = catalog();
        assert_eq!(cat.tools.len(), 21);
        assert_eq!(cat.reserved.len(), 26);
        let list_bases = cat.declared.iter().find(|t| t["name"] == "list_bases").unwrap();
        assert!(list_bases["inputSchema"]["properties"]["environment"].is_object());
        let whoami = cat.declared.iter().find(|t| t["name"] == "whoami").unwrap();
        assert!(whoami["inputSchema"]["properties"].get("environment").is_none());
        assert!(cat.tool("insights_search").is_some_and(|t| !t.takes_environment));
    }

    #[test]
    fn javascript_conversions() {
        assert_eq!(js_string(Some(&json!(1.0))), "1");
        assert_eq!(js_string(Some(&json!([1, null, "a"]))), "1,,a");
        assert_eq!(js_string(Some(&json!({}))), "[object Object]");
        assert_eq!(js_template(None), "undefined");
        assert_eq!(node_base64("aGVs\nbG8=xx"), b"hello");
        assert_eq!(node_base64("aGVsbG"), b"hell");
        assert_eq!(encode_uri_component("a b/é"), "a%20b%2F%C3%A9");
        assert_eq!(js_stringify(&js_numbers(&json!({ "a": 5.0, "b": [2.5] }))), r#"{"a":5,"b":[2.5]}"#);
    }

    #[test]
    fn results_are_sanitized() {
        let payload = json!({ "a": "x\u{202e}y" }).as_object().unwrap().clone();
        assert_eq!(tool_result(&payload, true).to_string(), r#"{"content":[{"type":"text","text":"{\"a\":\"xy\"}"}],"structuredContent":{"a":"xy"}}"#);
        assert_eq!(tool_error(&payload)["isError"], json!(true));
    }
}
