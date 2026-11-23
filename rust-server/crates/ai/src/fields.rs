//! `ai/field.ts`, `prompt.ts`, `answer.ts`: the AI fields — a prompt that cites other
//! columns, a value computed per row, written like any other.
//!
//! The background worker stays Node's (`startAiWorker`): it fills the cells the routes here
//! schedule (`sweep_after`, `next_sweep_at`), against the same tables.

use crate::js::{chars_len, chars_prefix, js_string, js_trim};
use crate::prompts;
use crate::provider::{assert_quota, invoke, resolve_provider, Env, InvokeOptions, ProviderConfig, Usage};
use crate::schedule::{check_schedule, next_run};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::idempotency::js_stringify;
use basedb_base::rbac::{decide, load_grants, load_target, require_on_field, Action};
use basedb_base::time::iso;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::AppState;
use basedb_base::db::Pools;
use basedb_catalog::naming::{qualify, quote_identifier};
use basedb_catalog::pg_values::parse_value;
use chrono::{DateTime, Utc};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

pub const MAX_PROMPT_CHARS: usize = 8000;
pub const MAX_VALUE_CHARS: usize = 4000;
pub const MAX_AI_VALUE_CHARS: usize = 10_000;
pub const EMPTY_VALUE: &str = "(vide)";
pub(crate) const FIRST: &str = "00000000-0000-0000-0000-000000000000";

pub const AI_KINDS: [&str; 7] = ["short_text", "long_text", "url", "number", "select", "boolean", "date"];

pub fn is_ai_kind(kind: &str) -> bool {
    AI_KINDS.contains(&kind)
}

fn is_textual_ai(kind: &str) -> bool {
    kind == "short_text" || kind == "long_text"
}

fn re(cell: &'static OnceLock<Regex>, src: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(src).unwrap())
}

fn reference() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"\{\{\s*([^{}]+?)\s*\}\}")
}

// ── The input ─────────────────────────────────────────────────────────────────

/// `AiFieldInput`, as `aiInputOf` of `app.ts` reads it.
#[derive(Debug, Clone, PartialEq)]
pub struct AiInput {
    pub prompt: String,
    pub mode: String,
    pub cron: Option<String>,
    pub timezone: Option<String>,
    pub consent: bool,
}

fn request_invalid(field: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field))
}

/// `aiInputOf`: the shapes, in the order Node checks them.
pub fn ai_input_of(raw: &Value) -> Result<AiInput, AppError> {
    let empty = Value::Object(Map::new());
    let body = if raw.is_object() || raw.is_array() { raw } else { &empty };
    let refresh = match body.get("refresh") {
        Some(r) if r.is_object() || r.is_array() => r,
        _ => &empty,
    };
    let Some(prompt) = body.get("prompt").and_then(Value::as_str) else { return Err(request_invalid("prompt")) };
    let mode = match refresh.get("mode").and_then(Value::as_str) {
        Some(m @ ("if_empty" | "schedule")) => m.to_string(),
        _ => return Err(request_invalid("refresh.mode")),
    };
    for key in ["cron", "timezone"] {
        if refresh.get(key).is_some_and(|v| !v.is_null() && !v.is_string()) {
            return Err(request_invalid(&format!("refresh.{key}")));
        }
    }
    if body.get("consent").is_some_and(|v| !v.is_boolean()) {
        return Err(request_invalid("consent"));
    }
    Ok(AiInput {
        prompt: prompt.to_string(),
        mode,
        cron: refresh.get("cron").and_then(Value::as_str).map(str::to_string),
        timezone: refresh.get("timezone").and_then(Value::as_str).map(str::to_string),
        consent: body.get("consent") == Some(&Value::Bool(true)),
    })
}

// ── The prompt ────────────────────────────────────────────────────────────────

/// `\s+` → one space, as JavaScript's `\s`.
fn collapse(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut space = false;
    for c in text.chars() {
        if crate::js::is_js_space(c) {
            if !space {
                out.push(' ');
            }
            space = true;
        } else {
            out.push(c);
            space = false;
        }
    }
    out
}

fn strip_marks(text: &str) -> String {
    static MARKS: OnceLock<Regex> = OnceLock::new();
    let nfd: String = text.nfd().collect();
    re(&MARKS, r"\p{M}").replace_all(&nfd, "").to_lowercase()
}

/// `fold` of `prompt.ts`.
fn fold_label(text: &str) -> String {
    js_trim(&collapse(&strip_marks(text))).to_string()
}

fn prompt_invalid(reason: &str, variable: Option<&str>) -> AppError {
    let e = AppError::new("REQUEST_INVALID").with("field", json!("prompt")).with("reason", json!(reason));
    match variable {
        Some(v) => e.with("variable", json!(v)),
        None => e,
    }
}

/// A field a prompt may cite.
#[derive(Debug, Clone)]
pub struct Citable {
    pub name: String,
    pub label: String,
}

/// `canonicalizePrompt`: labels become names, `{{name}}`.
pub fn canonicalize_prompt(prompt: &str, fields: &[Citable], self_name: Option<&str>) -> Result<(String, Vec<String>), AppError> {
    let text = js_trim(prompt);
    if text.is_empty() {
        return Err(prompt_invalid("consigne_vide", None));
    }
    if chars_len(text) > MAX_PROMPT_CHARS {
        return Err(prompt_invalid("consigne_trop_longue", None));
    }
    let by_name: HashMap<&str, &Citable> = fields.iter().map(|f| (f.name.as_str(), f)).collect();
    let mut by_label: HashMap<String, &Citable> = HashMap::new();
    for f in fields {
        by_label.insert(fold_label(&f.label), f);
    }
    let mut cited: Vec<String> = vec![];
    let mut out = String::new();
    let mut last = 0;
    for c in reference().captures_iter(text) {
        let whole = c.get(0).unwrap();
        let raw = &c[1];
        let Some(found) = by_name.get(raw).copied().or_else(|| by_label.get(&fold_label(raw)).copied()) else {
            return Err(prompt_invalid("variable_inconnue", Some(raw)));
        };
        if Some(found.name.as_str()) == self_name {
            return Err(prompt_invalid("variable_circulaire", Some(raw)));
        }
        if !cited.contains(&found.name) {
            cited.push(found.name.clone());
        }
        out.push_str(&text[last..whole.start()]);
        out.push_str(&format!("{{{{{}}}}}", found.name));
        last = whole.end();
    }
    out.push_str(&text[last..]);
    Ok((out, cited))
}

/// `citedNames`.
pub fn cited_names(prompt: &str) -> Vec<String> {
    let mut out: Vec<String> = vec![];
    for c in reference().captures_iter(prompt) {
        if !out.iter().any(|n| n == &c[1]) {
            out.push(c[1].to_string());
        }
    }
    out
}

/// `renderPrompt`.
pub fn render_prompt(prompt: &str, values: &HashMap<String, String>) -> String {
    reference().replace_all(prompt, |c: &regex::Captures| values.get(&c[1]).cloned().unwrap_or_else(|| EMPTY_VALUE.to_string())).to_string()
}

/// `ValueContext`.
#[derive(Default)]
pub struct ValueContext<'a> {
    pub kind: &'a str,
    pub options: Option<&'a HashMap<String, String>>,
    pub displays: Option<&'a HashMap<String, String>>,
}

/// `formatValue`: a cell as the prompt reads it — the values as node-postgres hands them.
pub fn format_value(value: &Value, context: &ValueContext) -> String {
    if value.is_null() || value.as_str() == Some("") {
        return EMPTY_VALUE.to_string();
    }
    let s = |v: &Value| js_string(Some(v));
    let text = match context.kind {
        "number" => {
            static ZEROS: OnceLock<Regex> = OnceLock::new();
            static DOT: OnceLock<Regex> = OnceLock::new();
            let t = re(&ZEROS, r"(\.[0-9]*?)0+$").replace(&s(value), "$1").to_string();
            re(&DOT, r"\.$").replace(&t, "").to_string()
        }
        "boolean" => if value == &Value::Bool(true) { "oui" } else { "non" }.to_string(),
        "select" => context.options.and_then(|o| o.get(&s(value))).cloned().unwrap_or_else(|| s(value)),
        "multi_select" => {
            let items = match value {
                Value::Array(a) => a.clone(),
                other => vec![other.clone()],
            };
            items.iter().map(|v| context.options.and_then(|o| o.get(&s(v))).cloned().unwrap_or_else(|| s(v))).collect::<Vec<_>>().join(", ")
        }
        "link" => context.displays.and_then(|d| d.get(&s(value))).cloned().unwrap_or_else(|| s(value)),
        "file" | "image" => match value {
            Value::Array(a) => a
                .iter()
                .map(|f| match f {
                    Value::Object(o) => match o.get("name") {
                        None | Some(Value::Null) => String::new(),
                        n => js_string(n),
                    },
                    _ => String::new(),
                })
                .filter(|n| !n.is_empty())
                .collect::<Vec<_>>()
                .join(", "),
            _ => String::new(),
        },
        _ => match value {
            Value::Object(_) | Value::Array(_) => js_stringify(value),
            other => s(other),
        },
    };
    if text.is_empty() {
        return EMPTY_VALUE.to_string();
    }
    chars_prefix(&text, MAX_VALUE_CHARS).to_string()
}

// ── The answer ────────────────────────────────────────────────────────────────

/// `AiOption`.
#[derive(Debug, Clone)]
pub struct AiOption {
    pub value: String,
    pub label: String,
}

/// `expectedFormat`.
pub fn expected_format(kind: &str, options: &[AiOption]) -> Option<String> {
    Some(match kind {
        "short_text" => "un texte court, sur une seule ligne".into(),
        "url" => "une adresse web complète commençant par https:// (ou mailto: pour une adresse e-mail), et rien d’autre".into(),
        "number" => "un nombre seul, en chiffres, avec un point décimal si besoin (ex. 1234.5), sans unité ni texte".into(),
        "select" => format!("exactement une de ces valeurs, recopiée telle quelle : {}", options.iter().map(|o| format!("« {} »", o.label)).collect::<Vec<_>>().join(", ")),
        "boolean" => "« oui » ou « non », et rien d’autre".into(),
        "date" => "une date au format AAAA-MM-JJ, et rien d’autre".into(),
        _ => return None,
    })
}

/// `fold` of `answer.ts`: quotes and closing punctuation off the ends.
fn fold_answer(text: &str) -> String {
    static ENDS: OnceLock<Regex> = OnceLock::new();
    let bare = strip_marks(text);
    const SPACE: &str = r"\t\n\x0B\x0C\r \u{A0}\u{1680}\u{2000}-\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}";
    let ends = re(&ENDS, &format!("^[{SPACE}\"'«»“”‘’`]+|[{SPACE}\"'«»“”‘’`.!]+$"));
    collapse(&ends.replace_all(&bare, ""))
}

fn iso_date(year: i64, month: i64, day: i64) -> Option<String> {
    // `Date.UTC` reads the years 0 to 99 as 1900 to 1999: never the year asked.
    if year < 100 {
        return None;
    }
    let d = chrono::NaiveDate::from_ymd_opt(year as i32, month as u32, day as u32)?;
    Some(d.format("%Y-%m-%d").to_string())
}

/// `parseAnswer`: the model's text read into the field's type; `None`, not that type.
pub fn parse_answer(kind: &str, answer: &str, options: &[AiOption]) -> Option<Value> {
    let text = js_trim(answer);
    match kind {
        "long_text" => Some(json!(text)),
        "short_text" => {
            static NL: OnceLock<Regex> = OnceLock::new();
            Some(json!(re(&NL, r"\s*\n\s*").replace_all(text, " ")))
        }
        "url" => {
            if text.is_empty() {
                return None;
            }
            static URL: OnceLock<Regex> = OnceLock::new();
            static TAIL: OnceLock<Regex> = OnceLock::new();
            let found = re(&URL, r#"(?i)(https?://|mailto:)[^\s<>"'«»)\]]+"#)
                .find(text)
                .map(|m| m.as_str().to_string())
                .unwrap_or_else(|| text.split(crate::js::is_js_space).next().unwrap_or("").to_string());
            let found = re(&TAIL, r"[.,;:]+$").replace(&found, "").to_string();
            basedb_records::values::shape_url("ai", &json!(found)).ok().flatten().map(Value::String)
        }
        "number" => {
            static NUMBER: OnceLock<Regex> = OnceLock::new();
            static THOUSANDS: OnceLock<Regex> = OnceLock::new();
            let found = re(&NUMBER, r"-?[0-9]{1,3}(?:[\s\u{a0}\u{202f}][0-9]{3})+(?:[.,][0-9]+)?|-?[0-9]+(?:[.,][0-9]+)?").find(text)?;
            let bare = re(&THOUSANDS, r"[\s\u{a0}\u{202f}]").replace_all(found.as_str(), "").replacen(',', ".", 1);
            Some(json!(bare))
        }
        "select" => {
            let wanted = fold_answer(text);
            if wanted.is_empty() {
                return None;
            }
            if let Some(exact) = options.iter().find(|o| fold_answer(&o.value) == wanted || fold_answer(&o.label) == wanted) {
                return Some(json!(exact.value));
            }
            let named: Vec<&AiOption> = options.iter().filter(|o| wanted.contains(&fold_answer(&o.label)) || wanted.contains(&fold_answer(&o.value))).collect();
            (named.len() == 1).then(|| json!(named[0].value))
        }
        "boolean" => {
            let folded = fold_answer(text);
            let word = folded.split(|c: char| crate::js::is_js_space(c) || matches!(c, ',' | ';' | ':')).next().unwrap_or("");
            if ["oui", "yes", "true", "vrai", "1"].contains(&word) {
                Some(json!(true))
            } else if ["non", "no", "false", "faux", "0"].contains(&word) {
                Some(json!(false))
            } else {
                None
            }
        }
        "date" => {
            static ISO: OnceLock<Regex> = OnceLock::new();
            static FR: OnceLock<Regex> = OnceLock::new();
            let n = |s: &str| s.parse::<i64>().unwrap_or(0);
            if let Some(c) = re(&ISO, r"([0-9]{4})-([0-9]{2})-([0-9]{2})").captures(text) {
                return iso_date(n(&c[1]), n(&c[2]), n(&c[3])).map(Value::String);
            }
            if let Some(c) = re(&FR, r"([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})").captures(text) {
                return iso_date(n(&c[3]), n(&c[2]), n(&c[1])).map(Value::String);
            }
            None
        }
        _ => None,
    }
}

// ── The configuration ─────────────────────────────────────────────────────────

struct Prepared {
    prompt: String,
    mode: &'static str,
    cron: Option<String>,
    timezone: Option<String>,
    next_sweep_at: Option<DateTime<Utc>>,
}

/// `prepareConfig`: the fields the person may read are the ones the prompt may cite.
async fn prepare_config<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str, self_name: &str, input: &AiInput) -> Result<Prepared, AppError> {
    let grants = load_grants(exec, ctx).await?;
    let Some(target) = load_target(exec, ctx, table_id).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
    };
    let readable = decide(ctx, &grants, Action::Read, &target).readable_fields;
    let rows = exec
        .rows(
            "SELECT f.id::text, n.name, f.label
               FROM _basedb.field f JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live
              ORDER BY f.position",
            &[&table_id],
        )
        .await?;
    let citable: Vec<Citable> = rows.iter().filter(|r| readable.contains(&r.get::<_, String>(0))).map(|r| Citable { name: r.get(1), label: r.get(2) }).collect();
    let (prompt, _) = canonicalize_prompt(&input.prompt, &citable, Some(self_name))?;
    match input.mode.as_str() {
        "schedule" => {
            let cron = js_trim(input.cron.as_deref().unwrap_or("")).to_string();
            let timezone = js_trim(input.timezone.as_deref().unwrap_or(""));
            let timezone = if timezone.is_empty() { "UTC" } else { timezone }.to_string();
            let (parsed, tz) = check_schedule(&cron, &timezone, ctx.timestamp)?;
            Ok(Prepared {
                prompt,
                mode: "schedule",
                cron: Some(cron.split(crate::js::is_js_space).filter(|p| !p.is_empty()).collect::<Vec<_>>().join(" ")),
                timezone: Some(timezone),
                next_sweep_at: next_run(&parsed, tz, ctx.timestamp),
            })
        }
        "if_empty" => Ok(Prepared { prompt, mode: "if_empty", cron: None, timezone: None, next_sweep_at: None }),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!("refresh")).with("reason", json!("mode"))),
    }
}

/// `insertAiConfig`: inside the transaction that adds the field (or makes it an AI one).
#[allow(clippy::too_many_arguments)]
pub async fn insert_ai_config<E: Exec + Sync>(exec: &E, ctx: &RequestContext, env: &dyn Env, field_id: &str, kind: &str, table_id: &str, column: &str, input: &AiInput) -> Result<(), AppError> {
    if !input.consent {
        return Err(AppError::new("AI_CONSENT_REQUIRED"));
    }
    if !is_ai_kind(kind) {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("ai")).with("reason", json!("type_sans_ia")).with("kind", json!(kind)));
    }
    let config = prepare_config(exec, ctx, table_id, column, input).await?;
    resolve_provider(exec, ctx, env).await?;
    exec.execute_op(
        "INSERT INTO _basedb.field_ai_config
           (field_id, prompt, refresh_mode, refresh_cron, refresh_timezone, next_sweep_at, consented_by, kind)
         VALUES ($1::text::uuid, $2, $3, $4, $5, $6, $7::text::uuid, $8)",
        &[&field_id, &config.prompt, &config.mode, &config.cron, &config.timezone, &config.next_sweep_at, &ctx.actor.id, &kind],
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}

async fn touch_field<E: Exec + Sync>(exec: &E, ctx: &RequestContext, field_id: &str) -> Result<(), AppError> {
    exec.execute_op(
        "UPDATE _basedb.field SET updated_at = clock_timestamp(), updated_by = $2::text::uuid WHERE id = $1::text::uuid",
        &[&field_id, &ctx.actor.id],
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

fn not_ai() -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("kind")).with("reason", json!("pas_un_champ_ia"))
}

/// `aiFieldStatus`, in the API's spelling (`aiStatusJson`).
pub async fn ai_field_status(st: &AppState, ctx: &RequestContext, field_id: &str) -> Result<Value, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        let field_id = field_id.to_string();
        async move {
            require_on_field(&tx, &ctx, Action::Read, &field_id).await?;
            let Some(row) = tx
                .first(
                    "SELECT f.table_id::text, c.prompt, c.refresh_mode, c.refresh_cron, c.refresh_timezone,
                            c.next_sweep_at, c.sweep_after IS NOT NULL, c.last_run_at, c.last_error, c.last_error_at,
                            c.computed_count, c.consented_at
                       FROM _basedb.field_ai_config c JOIN _basedb.field f ON f.id = c.field_id
                      WHERE c.field_id = $1::text::uuid AND f.is_live",
                    &[&field_id],
                )
                .await?
            else {
                return Err(not_ai());
            };
            let table_id: String = row.get(0);
            let prompt: String = row.get(1);
            let names = cited_names(&prompt);
            let labels = tx
                .rows(
                    "SELECT n.name, f.label FROM _basedb.field f
                       JOIN _basedb.physical_name n ON n.id = f.name_id
                      WHERE f.table_id = $1::text::uuid AND f.is_live AND n.name = ANY($2::text[])",
                    &[&table_id, &names],
                )
                .await?;
            let label_of: HashMap<String, String> = labels.iter().map(|r| (r.get(0), r.get(1))).collect();
            let at = |i: usize| row.get::<_, Option<DateTime<Utc>>>(i).map(iso);
            Ok(json!({
                "prompt": prompt,
                "cited": names.iter().map(|n| json!({ "name": n, "label": label_of.get(n).unwrap_or(n) })).collect::<Vec<_>>(),
                "refresh": { "mode": row.get::<_, String>(2), "cron": row.get::<_, Option<String>>(3), "timezone": row.get::<_, Option<String>>(4) },
                "next_sweep_at": at(5),
                "sweeping": row.get::<_, bool>(6),
                "last_run_at": at(7),
                "last_error": row.get::<_, Option<String>>(8),
                "last_error_at": at(9),
                "computed_count": row.get::<_, i64>(10),
                "consented_at": iso(row.get::<_, DateTime<Utc>>(11)),
            }))
        }
    })
    .await
}

/// `setAiField`: the prompt or the schedule changed; a fresh consent each time.
pub async fn set_ai_field(st: &AppState, ctx: &RequestContext, field_id: &str, input: &AiInput, recompute: bool) -> Result<Value, AppError> {
    write_ai_field(&st.pools, &st.cfg, ctx, field_id, input, recompute).await?;
    ai_field_status(st, ctx, field_id).await
}

/// `setAiField` without the status it answers: what the catalog's plans call.
pub async fn write_ai_field(pools: &Pools, env: &dyn Env, ctx: &RequestContext, field_id: &str, input: &AiInput, recompute: bool) -> Result<(), AppError> {
    if !input.consent {
        return Err(AppError::new("AI_CONSENT_REQUIRED"));
    }
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let ctx = ctx.clone();
        let field_id = field_id.to_string();
        let input = input.clone();
        async move {
            require_on_field(&tx, &ctx, Action::ManageSchema, &field_id).await?;
            let Some(field) = tx
                .first(
                    "SELECT f.table_id::text, n.name, f.kind,
                            EXISTS (SELECT 1 FROM _basedb.field_ai_config c WHERE c.field_id = f.id) AS has_ai,
                            coalesce(tc.is_rich, false) AS is_rich
                       FROM _basedb.field f
                       JOIN _basedb.physical_name n ON n.id = f.name_id
                       LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
                      WHERE f.id = $1::text::uuid AND f.is_live",
                    &[&field_id],
                )
                .await?
            else {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
            };
            let (table_id, name, kind): (String, String, String) = (field.get(0), field.get(1), field.get(2));
            if field.get::<_, bool>(4) {
                return Err(AppError::new("REQUEST_INVALID").with("field", json!("ai")).with("reason", json!("type_sans_ia")).with("kind", json!("rich_text")));
            }
            if !field.get::<_, bool>(3) {
                insert_ai_config(&tx, &ctx, env, &field_id, &kind, &table_id, &name, &input).await?;
                if recompute {
                    tx.execute_op("UPDATE _basedb.field_ai_config SET sweep_after = $2::text::uuid WHERE field_id = $1::text::uuid", &[&field_id, &FIRST], SqlOp::Update)
                        .await?;
                }
                touch_field(&tx, &ctx, &field_id).await?;
                return Ok(());
            }
            let config = prepare_config(&tx, &ctx, &table_id, &name, &input).await?;
            tx.execute_op(
                "UPDATE _basedb.field_ai_config
                    SET prompt = $2, refresh_mode = $3, refresh_cron = $4, refresh_timezone = $5,
                        next_sweep_at = $6, consented_by = $7::text::uuid, consented_at = clock_timestamp(),
                        sweep_after = CASE WHEN $8::boolean THEN $9::text::uuid ELSE sweep_after END,
                        last_error = NULL, last_error_at = NULL
                  WHERE field_id = $1::text::uuid",
                &[&field_id, &config.prompt, &config.mode, &config.cron, &config.timezone, &config.next_sweep_at, &ctx.actor.id, &recompute, &FIRST],
                SqlOp::Update,
            )
            .await?;
            Ok(())
        }
    })
    .await
}

/// `disableAiField`: an ordinary field again, its values kept.
pub async fn disable_ai_field(st: &AppState, ctx: &RequestContext, field_id: &str) -> Result<(), AppError> {
    remove_ai_field(&st.pools, ctx, field_id).await
}

/// `disableAiField`, on the pools alone.
pub async fn remove_ai_field(pools: &Pools, ctx: &RequestContext, field_id: &str) -> Result<(), AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let ctx = ctx.clone();
        let field_id = field_id.to_string();
        async move {
            remove_ai_config(&tx, &ctx, &field_id).await?;
            Ok(())
        }
    })
    .await
}

/// The heart of `disableAiField`, inside a transaction the caller holds.
pub async fn remove_ai_config<E: Exec + Sync>(exec: &E, ctx: &RequestContext, field_id: &str) -> Result<(), AppError> {
    require_on_field(exec, ctx, Action::ManageSchema, field_id).await?;
    let removed = exec.query_op("DELETE FROM _basedb.field_ai_config WHERE field_id = $1::text::uuid RETURNING field_id", &[&field_id], SqlOp::Delete).await?;
    if removed.is_empty() {
        return Err(not_ai());
    }
    touch_field(exec, ctx, field_id).await
}

/// `requestAiSweep`: every row again, by the worker.
pub async fn request_ai_sweep(st: &AppState, ctx: &RequestContext, field_id: &str) -> Result<(), AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let ctx = ctx.clone();
        let field_id = field_id.to_string();
        async move {
            require_on_field(&tx, &ctx, Action::ManageSchema, &field_id).await?;
            let updated = tx
                .query_op(
                    "UPDATE _basedb.field_ai_config SET sweep_after = $2::text::uuid, last_error = NULL, last_error_at = NULL
                      WHERE field_id = $1::text::uuid RETURNING field_id",
                    &[&field_id, &FIRST],
                    SqlOp::Update,
                )
                .await?;
            if updated.is_empty() {
                return Err(not_ai());
            }
            Ok(())
        }
    })
    .await
}

// ── One cell ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct Cited {
    name: String,
    kind: String,
    options: Option<HashMap<String, String>>,
    link: Option<(String, Option<String>)>,
}

#[derive(Debug, Clone)]
pub(crate) struct LoadedField {
    kind: String,
    options: Vec<AiOption>,
    column: String,
    field_label: String,
    table_label: String,
    base_id: String,
    relation: String,
    prompt: String,
    pub(crate) mode: String,
    pub(crate) cron: Option<String>,
    pub(crate) timezone: Option<String>,
    pub(crate) next_sweep_at: Option<DateTime<Utc>>,
    pub(crate) sweep_after: Option<String>,
    cited: Vec<Cited>,
}

/// `loadField`.
pub(crate) async fn load_field<E: Exec + Sync>(exec: &E, field_id: &str) -> Result<Option<LoadedField>, AppError> {
    let Some(row) = exec
        .first(
            "SELECT f.table_id::text, f.kind, cn.name AS column, f.label AS field_label, t.label AS table_label,
                    t.base_id::text, tn.name AS table_name, sn.name AS schema_name, c.prompt,
                    c.refresh_mode, c.refresh_cron, c.refresh_timezone, c.next_sweep_at, c.sweep_after::text
               FROM _basedb.field_ai_config c
               JOIN _basedb.field f          ON f.id = c.field_id
               JOIN _basedb.physical_name cn ON cn.id = f.name_id
               JOIN _basedb.table_def t      ON t.id = f.table_id
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE c.field_id = $1::text::uuid AND f.is_live AND t.is_live",
            &[&field_id],
        )
        .await?
    else {
        return Ok(None);
    };
    let kind: String = row.get(1);
    if !is_ai_kind(&kind) {
        return Ok(None);
    }
    let table_id: String = row.get(0);
    let own = exec
        .rows("SELECT value, label FROM _basedb.select_option WHERE field_id = $1::text::uuid AND deleted_at IS NULL ORDER BY position", &[&field_id])
        .await?
        .iter()
        .map(|r| AiOption { value: r.get(0), label: r.get(1) })
        .collect();
    let prompt: String = row.get(8);
    let names = cited_names(&prompt);
    let fields = exec
        .rows(
            "SELECT f.id::text, n.name, f.kind FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live AND n.name = ANY($2::text[])",
            &[&table_id, &names],
        )
        .await?;
    let ids: Vec<String> = fields.iter().map(|f| f.get(0)).collect();
    let options = exec
        .rows("SELECT field_id::text, value, label FROM _basedb.select_option WHERE field_id = ANY($1::text[]::uuid[]) AND deleted_at IS NULL", &[&ids])
        .await?;
    let links = exec
        .rows(
            "SELECT lc.field_id::text, sn.name AS schema_name, tn.name AS table_name, dn.name AS display
               FROM _basedb.field_link_config lc
               JOIN _basedb.table_def t      ON t.id = lc.target_table_id
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
               LEFT JOIN _basedb.field d         ON d.id = t.display_field_id
               LEFT JOIN _basedb.physical_name dn ON dn.id = d.name_id
              WHERE lc.field_id = ANY($1::text[]::uuid[])",
            &[&ids],
        )
        .await?;
    let mut cited = vec![];
    for f in &fields {
        let id: String = f.get(0);
        let link = match links.iter().find(|l| l.get::<_, String>(0) == id) {
            None => None,
            Some(l) => Some((qualify(&l.get::<_, String>(1), &l.get::<_, String>(2))?, l.get::<_, Option<String>>(3))),
        };
        let own: HashMap<String, String> = options.iter().filter(|o| o.get::<_, String>(0) == id).map(|o| (o.get(1), o.get(2))).collect();
        cited.push(Cited { name: f.get(1), kind: f.get(2), options: (!own.is_empty()).then_some(own), link });
    }
    Ok(Some(LoadedField {
        kind,
        options: own,
        column: row.get(2),
        field_label: row.get(3),
        table_label: row.get(4),
        base_id: row.get(5),
        relation: qualify(&row.get::<_, String>(7), &row.get::<_, String>(6))?,
        prompt,
        mode: row.get(9),
        cron: row.get(10),
        timezone: row.get(11),
        next_sweep_at: row.get(12),
        sweep_after: row.get(13),
        cited,
    }))
}

/// `citedFingerprint`.
fn cited_fingerprint(field: &LoadedField) -> Result<String, AppError> {
    let columns = field.cited.iter().map(|c| quote_identifier(&c.name)).collect::<Result<Vec<_>, _>>()?;
    Ok(format!("md5(ROW({})::text)", columns.join(", ")))
}

/// A row as `readRows` hands it: its id, its fingerprint, the cited values as node-postgres reads them.
pub(crate) struct CellRow {
    pub(crate) id: String,
    fingerprint: String,
    values: HashMap<String, Value>,
}

/// One value per column, with its type, so that [`parse_value`] reads it as node-postgres does.
fn typed(column: &str) -> Result<String, AppError> {
    let q = quote_identifier(column)?;
    Ok(format!("{q}::text, pg_typeof({q})::oid"))
}

/// `computedColumns`: the identifier, the fingerprint, each cited value with its type.
fn computed_columns(field: &LoadedField) -> Result<String, AppError> {
    let mut columns = vec!["\"_id\"::text".to_string(), format!("{}::text", cited_fingerprint(field)?)];
    for c in &field.cited {
        columns.push(typed(&c.name)?);
    }
    Ok(columns.join(", "))
}

fn cell_row(field: &LoadedField, row: &tokio_postgres::Row) -> CellRow {
    let mut values = HashMap::new();
    for (i, c) in field.cited.iter().enumerate() {
        let text: Option<String> = row.get(2 + 2 * i);
        let oid: u32 = row.get(3 + 2 * i);
        values.insert(c.name.clone(), text.map(|t| parse_value(oid, &t)).unwrap_or(Value::Null));
    }
    CellRow { id: row.get(0), fingerprint: row.get(1), values }
}

async fn read_row(st: &AppState, field: &LoadedField, record: &str) -> Result<Option<CellRow>, AppError> {
    let sql = format!("SELECT {} FROM {} WHERE \"_id\" = $1::text::uuid", computed_columns(field)?, field.relation);
    let conn = st.pools.get(PoolName::Data).await?;
    let Some(row) = conn.first(&sql, &[&record]).await? else { return Ok(None) };
    Ok(Some(cell_row(field, &row)))
}

/// `readRows`: the empty rows, or all of them, after an identifier, in its order.
pub(crate) async fn read_rows(st: &AppState, field: &LoadedField, empty_only: bool, after: &str, limit: i64) -> Result<Vec<CellRow>, AppError> {
    let empty = if empty_only { format!("{} IS NULL AND ", quote_identifier(&field.column)?) } else { String::new() };
    let sql = format!(
        "SELECT {} FROM {} WHERE {empty}\"_id\" > $1::text::uuid ORDER BY \"_id\" LIMIT $2",
        computed_columns(field)?,
        field.relation
    );
    let conn = st.pools.get(PoolName::Data).await?;
    Ok(conn.rows(&sql, &[&after, &limit]).await?.iter().map(|r| cell_row(field, r)).collect())
}

/// `linkDisplays`: the display value of the linked rows, for the prompt.
pub(crate) async fn link_displays(st: &AppState, field: &LoadedField, rows: &[&CellRow]) -> Result<HashMap<String, HashMap<String, String>>, AppError> {
    let mut out = HashMap::new();
    for cited in &field.cited {
        let Some((relation, Some(display))) = &cited.link else { continue };
        let mut ids: Vec<String> = vec![];
        for r in rows {
            if let Some(Value::String(id)) = r.values.get(&cited.name) {
                if !ids.contains(id) {
                    ids.push(id.clone());
                }
            }
        }
        if ids.is_empty() {
            continue;
        }
        let sql = format!("SELECT \"_id\"::text AS id, {} FROM {relation} WHERE \"_id\" = ANY($1::text[]::uuid[])", typed(display)?);
        let conn = st.pools.get(PoolName::Data).await?;
        let found = conn.rows(&sql, &[&ids]).await?;
        let map = found
            .iter()
            .map(|f| {
                let text: Option<String> = f.get(1);
                let oid: u32 = f.get(2);
                (f.get::<_, String>(0), js_string(text.map(|t| parse_value(oid, &t)).as_ref()))
            })
            .collect();
        out.insert(cited.name.clone(), map);
    }
    Ok(out)
}

/// `computeFieldValue`: the provider's answer for one cell, trimmed and bounded.
#[allow(clippy::too_many_arguments)]
pub async fn compute_field_value(st: &AppState, ctx: &RequestContext, config: &ProviderConfig, base_id: &str, table_label: &str, field_label: &str, instruction: &str, format: Option<String>) -> Result<String, AppError> {
    let mut payload = Map::new();
    payload.insert("intent".into(), json!("field_compute"));
    payload.insert("table_label".into(), json!(table_label));
    payload.insert("field_label".into(), json!(field_label));
    payload.insert("instruction".into(), json!(instruction));
    if let Some(f) = format {
        payload.insert("expected_format".into(), json!(f));
    }
    let answer = invoke(st, ctx, config, Usage::FieldCompute, Some(base_id), &Value::Object(payload), prompts::field_schema(), prompts::FIELD_SYSTEM, InvokeOptions::default()).await?;
    let value = answer.get("value").and_then(Value::as_str).map(js_trim).unwrap_or("");
    Ok(chars_prefix(value, MAX_AI_VALUE_CHARS).to_string())
}

/// `computeRow`: `fill` writes only into a cell still empty (the worker), `overwrite` whatever it held.
pub(crate) async fn compute_row(
    st: &AppState,
    ctx: &RequestContext,
    config: &ProviderConfig,
    field: &LoadedField,
    row: &CellRow,
    displays: &HashMap<String, HashMap<String, String>>,
    fill: bool,
) -> Result<Value, AppError> {
    let mut values: HashMap<String, String> = HashMap::new();
    for cited in &field.cited {
        let context = ValueContext { kind: &cited.kind, options: cited.options.as_ref(), displays: displays.get(&cited.name) };
        values.insert(cited.name.clone(), format_value(row.values.get(&cited.name).unwrap_or(&Value::Null), &context));
    }
    let nothing = !values.is_empty() && values.values().all(|v| v == EMPTY_VALUE);
    if nothing && !is_textual_ai(&field.kind) {
        return Err(AppError::new("AI_RESPONSE_UNUSABLE").with("field", json!(field.column)).with("reason", json!("rien_a_lire")));
    }
    let answer = if nothing {
        String::new()
    } else {
        with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
            let ctx = ctx.clone();
            async move { assert_quota(&tx, &ctx, &st.cfg, Usage::FieldCompute).await }
        })
        .await?;
        compute_field_value(st, ctx, config, &field.base_id, &field.table_label, &field.field_label, &render_prompt(&field.prompt, &values), expected_format(&field.kind, &field.options))
            .await?
    };
    let Some(value) = parse_answer(&field.kind, &answer, &field.options) else {
        return Err(AppError::new("AI_RESPONSE_UNUSABLE").with("field", json!(field.column)).with("reason", json!("type_attendu")).with("kind", json!(field.kind)));
    };
    let cast = match field.kind.as_str() {
        "number" => "::numeric",
        "boolean" => "::boolean",
        "date" => "::date",
        _ => "",
    };
    let param = match &value {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    };
    let column = quote_identifier(&field.column)?;
    let sql = format!(
        "UPDATE {} SET {column} = $1::text{cast} WHERE \"_id\" = $2::text::uuid AND {} = $3{}",
        field.relation,
        cited_fingerprint(field)?,
        if fill { format!(" AND {column} IS NULL") } else { String::new() },
    );
    with_transaction(&st.pools, PoolName::Data, ctx, TxOptions::default(), |tx| {
        let sql = sql.clone();
        let param = param.clone();
        let id = row.id.clone();
        let fingerprint = row.fingerprint.clone();
        async move { tx.execute_op(&sql, &[&param, &id, &fingerprint], SqlOp::Update).await }
    })
    .await?;
    Ok(value)
}

/// `runAiCell`: one row now, its value returned.
pub async fn run_ai_cell(st: &AppState, ctx: &RequestContext, field_id: &str, record: &str) -> Result<Value, AppError> {
    let (field, config) = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        let field_id = field_id.to_string();
        async move {
            require_on_field(&tx, &ctx, Action::Update, &field_id).await?;
            let Some(field) = load_field(&tx, &field_id).await? else { return Err(not_ai()) };
            let config = resolve_provider(&tx, &ctx, &st.cfg).await?;
            Ok((field, config))
        }
    })
    .await?;
    let Some(row) = read_row(st, &field, record).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record)));
    };
    let displays = link_displays(st, &field, &[&row]).await?;
    let value = compute_row(st, ctx, &config, &field, &row, &displays, false).await?;
    let conn = st.pools.catalog().await?;
    conn.execute_op("UPDATE _basedb.field_ai_config SET computed_count = computed_count + 1 WHERE field_id = $1::text::uuid", &[&field_id], SqlOp::Update).await?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn citable() -> Vec<Citable> {
        vec![Citable { name: "avis".into(), label: "Avis client".into() }, Citable { name: "note".into(), label: "Note".into() }]
    }

    #[test]
    fn prompts_cite_by_name_or_label() {
        let (p, cited) = canonicalize_prompt("  Résume {{ avis  client }} et {{note}} ; {{Avis Client}} ", &citable(), Some("resume")).unwrap();
        assert_eq!(p, "Résume {{avis}} et {{note}} ; {{avis}}");
        assert_eq!(cited, ["avis", "note"]);
        let e = canonicalize_prompt("{{x}}", &citable(), None).unwrap_err();
        assert_eq!((e.details["reason"].clone(), e.details["variable"].clone()), (json!("variable_inconnue"), json!("x")));
        assert_eq!(canonicalize_prompt("{{note}}", &citable(), Some("note")).unwrap_err().details["reason"], json!("variable_circulaire"));
        assert_eq!(canonicalize_prompt(" ", &citable(), None).unwrap_err().details["reason"], json!("consigne_vide"));
        let values = HashMap::from([("avis".to_string(), "bien".to_string())]);
        assert_eq!(render_prompt("{{avis}} / {{note}}", &values), "bien / (vide)");
    }

    #[test]
    fn values_as_the_prompt_reads_them() {
        let ctx = |kind| ValueContext { kind, ..Default::default() };
        assert_eq!(format_value(&json!("12.5000000000"), &ctx("number")), "12.5");
        assert_eq!(format_value(&json!("3.0000000000"), &ctx("number")), "3");
        assert_eq!(format_value(&json!(true), &ctx("boolean")), "oui");
        assert_eq!(format_value(&json!(""), &ctx("short_text")), "(vide)");
        assert_eq!(format_value(&json!([{ "name": "a.pdf" }, { "x": 1 }]), &ctx("file")), "a.pdf");
        assert_eq!(format_value(&json!({ "b": 1, "a": 2 }), &ctx("json")), r#"{"b":1,"a":2}"#);
        let options = HashMap::from([("v1".to_string(), "Rouge".to_string())]);
        assert_eq!(format_value(&json!(["v1", "v2"]), &ValueContext { kind: "multi_select", options: Some(&options), displays: None }), "Rouge, v2");
    }

    #[test]
    fn answers_read_into_their_type() {
        let options = vec![AiOption { value: "positif".into(), label: "Positif".into() }, AiOption { value: "negatif".into(), label: "Négatif".into() }];
        assert_eq!(parse_answer("select", "« négatif ».", &options), Some(json!("negatif")));
        assert_eq!(parse_answer("select", "plutôt Positif", &options), Some(json!("positif")));
        assert_eq!(parse_answer("select", "les deux : positif et négatif", &options), None);
        assert_eq!(parse_answer("number", "environ 1 234,5 €", &[]), Some(json!("1234.5")));
        assert_eq!(parse_answer("boolean", "Oui, bien sûr", &[]), Some(json!(true)));
        assert_eq!(parse_answer("date", "le 3/9/2026", &[]), Some(json!("2026-09-03")));
        assert_eq!(parse_answer("date", "2026-02-30", &[]), None);
        assert_eq!(parse_answer("date", "0050-01-01", &[]), None);
        assert_eq!(parse_answer("short_text", " a \n  b ", &[]), Some(json!("a b")));
        assert_eq!(parse_answer("url", "Voir https://exemple.fr/a.", &[]), Some(json!("https://exemple.fr/a")));
    }

    #[test]
    fn input_checked_in_node_s_order() {
        assert_eq!(ai_input_of(&json!(null)).unwrap_err().details["field"], json!("prompt"));
        assert_eq!(ai_input_of(&json!({ "prompt": "x" })).unwrap_err().details["field"], json!("refresh.mode"));
        assert_eq!(ai_input_of(&json!({ "prompt": "x", "refresh": { "mode": "schedule", "timezone": 3 } })).unwrap_err().details["field"], json!("refresh.timezone"));
        assert_eq!(ai_input_of(&json!({ "prompt": "x", "refresh": { "mode": "if_empty" }, "consent": "oui" })).unwrap_err().details["field"], json!("consent"));
        let ok = ai_input_of(&json!({ "prompt": "x", "refresh": { "mode": "if_empty" }, "consent": true })).unwrap();
        assert!(ok.consent && ok.cron.is_none());
    }
}
