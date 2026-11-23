//! A base built from a template, in one operation — `applyTemplate` of
//! `packages/contracts/src/template-apply.ts` against the kernel, as
//! `packages/core/src/templates/apply.ts` drives it: the whole base, or none.
//!
//! Native whole once the automations crate has handed its creator over (else the route hands
//! templates with automations to Node); the AI fields go through the `ai` crate's services
//! (`ai_hooks`).

use crate::deletion;
use crate::fields::{self, AddFieldRequest, CreateLinkRequest};
use crate::computed_fields::{FormulaInput, RollupInput};
use crate::http::LookInput;
use crate::operations;
use crate::template_check::{cited_in_text, find_option, js_string, label_key, replace_cited, resolve_template_date, translate_filter, view_field_keys, Resolved};
use crate::views::{self, ViewInput};
use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::tx::{ActorKind, RequestContext};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::OnceLock;

type R<T> = Result<T, AppError>;
/// A row's values, by column name, in order.
pub type Entries = Vec<(String, Value)>;
type Boxed<T> = Pin<Box<dyn Future<Output = R<T>> + Send>>;

/// The records crate's writers, which the catalog cannot depend on: `createRecords` (the
/// identifiers, in order) and `updateRecord`.
pub struct RowWriters {
    pub create: fn(Pools, RequestContext, String, Vec<Value>) -> Boxed<Vec<String>>,
    pub update: fn(Pools, RequestContext, String, String, Entries) -> Boxed<()>,
}

static WRITERS: OnceLock<RowWriters> = OnceLock::new();

/// Installs the row writers the sample rows go through; the server hands them over at start.
pub fn set_template_row_writers(writers: RowWriters) {
    let _ = WRITERS.set(writers);
}

/// The automations crate's `createAutomation` (base, input as `POST …/automations` takes
/// it): the identifier. Without it, a template with automations is refused.
pub type AutomationCreator = Box<dyn Fn(RequestContext, String, Value) -> Boxed<String> + Send + Sync>;

static AUTOMATIONS: OnceLock<AutomationCreator> = OnceLock::new();

/// Installs the automations' creator; the automations crate hands it over with its routes.
pub fn set_template_automation_creator(creator: AutomationCreator) {
    let _ = AUTOMATIONS.set(creator);
}

/// `automationFor`: an automation as the API takes it; `me` stands for `$moi`.
fn automation_for(automation: &Value, built: &HashMap<String, BuiltTable>, me: Option<&str>) -> Value {
    let trigger = &automation["trigger"];
    let table = trigger["table"].as_str().and_then(|k| built.get(k));
    let values_for = |values: &Value, target: Option<&BuiltTable>| {
        let mut out = Map::new();
        for (label, value) in values.as_object().cloned().unwrap_or_default() {
            let Some(field) = field_of(target, &label) else { continue };
            let converted = match value.as_str() {
                Some(text) if field.options.is_some() => json!(choice_value(field, text)),
                Some(text) => json!(text_for(text, table)),
                None => value,
            };
            out.insert(field.name.clone(), converted);
        }
        Value::Object(out)
    };
    let actions: Vec<Value> = arr(&automation["actions"])
        .iter()
        .map(|action| match str_of(&action["kind"]) {
            "update_record" => json!({ "kind": "update_record", "values": values_for(&action["values"], table) }),
            "create_record" => {
                let target = action["table"].as_str().and_then(|k| built.get(k));
                json!({
                    "kind": "create_record",
                    "table": target.map_or_else(|| action["table"].clone(), |t| json!(t.name)),
                    "values": values_for(&action["values"], target),
                })
            }
            "notify" => json!({
                "kind": "notify",
                "users": match me {
                    None => vec![],
                    Some(me) => arr(&action["users"]).iter().filter(|u| *u == "$moi").map(|_| json!(me)).collect::<Vec<_>>(),
                },
                "user_field": action["user_field"].as_str().and_then(|l| field_of(table, l)).map(|f| f.name.clone()),
                "message": text_for(str_of(&action["message"]), table),
            }),
            _ => action.clone(),
        })
        .collect();
    let condition = str_of(&automation["condition"]);
    json!({
        "label": automation["label"],
        "description": automation.get("description").cloned().unwrap_or(Value::Null),
        "enabled": automation["enabled"],
        "trigger": {
            "kind": trigger["kind"],
            "table": table.map(|t| t.name.clone()),
            "fields": arr(&trigger["fields"]).iter().filter_map(|l| l.as_str().and_then(|l| field_of(table, l)).map(|f| f.name.clone())).collect::<Vec<_>>(),
            "schedule": trigger.get("schedule").cloned().unwrap_or(Value::Null),
        },
        "condition": if condition.is_empty() { Value::Null } else { json!(filter_for(condition, table)) },
        "actions": actions,
    })
}

async fn create_automation(ctx: &RequestContext, base_id: &str, input: Value) -> R<String> {
    let create = AUTOMATIONS.get().ok_or_else(|| AppError::internal("automatisations absentes"))?;
    create(ctx.clone(), base_id.to_string(), input).await
}

/// A field once built.
#[derive(Clone)]
struct BuiltField {
    label: String,
    id: String,
    name: String,
    kind: String,
    options: Option<Vec<Value>>,
    /// Computed by the AI: the sample rows leave it empty.
    ai: bool,
}

struct BuiltTable {
    key: String,
    label: String,
    id: String,
    name: String,
    fields: HashMap<String, BuiltField>,
}

impl BuiltTable {
    fn put(&mut self, field: BuiltField) {
        self.fields.insert(label_key(&field.label), field);
    }
}

fn field_of<'a>(table: Option<&'a BuiltTable>, label: &str) -> Option<&'a BuiltField> {
    table?.fields.get(&label_key(label))
}

/// `filterFor`.
fn filter_for(filter: &str, table: Option<&BuiltTable>) -> String {
    if crate::description::js_trim(filter).is_empty() {
        return String::new();
    }
    translate_filter(filter, |label| field_of(table, label).map(|f| Resolved { name: f.name.clone(), options: f.options.clone() })).0
}

/// `textFor`: `{{Libellé}}` → `{{nom}}`.
fn text_for(text: &str, table: Option<&BuiltTable>) -> String {
    replace_cited(text, |label| field_of(table, label).map(|f| format!("{{{{{}}}}}", f.name)))
}

/// `choiceValue`.
fn choice_value(field: &BuiltField, label: &str) -> String {
    find_option(field.options.as_ref(), label).and_then(|o| o["value"].as_str()).unwrap_or(label).to_string()
}

fn str_of(v: &Value) -> &str {
    v.as_str().unwrap_or_default()
}

fn arr(v: &Value) -> Vec<Value> {
    v.as_array().cloned().unwrap_or_default()
}

/// `specFor`.
fn spec_for(view: &Value, table: &BuiltTable) -> Value {
    let kind = str_of(&view["kind"]);
    let (one, many, _) = view_field_keys(kind);
    let name = |label: &Value| -> Option<String> { label.as_str().and_then(|l| field_of(Some(table), l)).map(|f| f.name.clone()) };
    let mut spec = Map::new();
    for (key, value) in view["spec"].as_object().cloned().unwrap_or_default() {
        let k = key.as_str();
        if one.contains(&k) {
            if let Some(found) = name(&value) {
                spec.insert(key, json!(found));
            }
        } else if many.contains(&k) {
            spec.insert(key, json!(arr(&value).iter().filter_map(name).collect::<Vec<_>>()));
        } else if k == "filter" {
            spec.insert(key, json!(filter_for(&js_string(Some(&value)), Some(table))));
        } else if k == "sorts" {
            let sorts: Vec<Value> = arr(&value)
                .iter()
                .filter_map(|s| name(&s["field"]).map(|f| json!({ "field": f, "direction": if s["direction"] == "desc" { "desc" } else { "asc" } })))
                .collect();
            spec.insert(key, Value::Array(sorts));
        } else if k == "summaries" {
            let mut out = Map::new();
            for (label, f) in value.as_object().cloned().unwrap_or_default() {
                if let Some(found) = name(&json!(label)) {
                    out.insert(found, f);
                }
            }
            spec.insert(key, Value::Object(out));
        } else if k == "color_rules" {
            let rules: Vec<Value> = arr(&value).iter().map(|r| json!({ "filter": filter_for(str_of(&r["filter"]), Some(table)), "color": r["color"] })).collect();
            spec.insert(key, Value::Array(rules));
        } else if k == "group_order" {
            let group = view["spec"]["group_by"].as_str().and_then(|g| field_of(Some(table), g));
            let order: Vec<Value> = arr(&value)
                .iter()
                .map(|l| match group {
                    None => l.clone(),
                    Some(g) => json!(choice_value(g, str_of(l))),
                })
                .collect();
            spec.insert(key, Value::Array(order));
        } else if k == "fields" && kind == "form" {
            let questions: Vec<Value> = arr(&value)
                .iter()
                .filter_map(|q| {
                    let found = name(&q["field"])?;
                    let mut m = Map::new();
                    m.insert("field".into(), json!(found));
                    m.insert("required".into(), json!(q["required"] == true));
                    m.insert("label".into(), q.get("label").cloned().unwrap_or(json!("")));
                    m.insert("help".into(), q.get("help").cloned().unwrap_or(json!("")));
                    if let Some(p) = q.get("placeholder") {
                        m.insert("placeholder".into(), p.clone());
                    }
                    if q["prefill"] == "today" {
                        m.insert("prefill".into(), json!("today"));
                    }
                    if let Some(show) = q.get("show_if") {
                        if let Some(read) = field_of(Some(table), str_of(&show["field"])) {
                            let mut s = Map::new();
                            s.insert("field".into(), json!(read.name));
                            if let Some(op) = show.get("op") {
                                s.insert("op".into(), op.clone());
                            }
                            let v = match show.get("value") {
                                Some(Value::String(v)) if read.kind == "select" || read.kind == "multi_select" => json!(choice_value(read, v)),
                                Some(v) => v.clone(),
                                None => Value::Null,
                            };
                            s.insert("value".into(), v);
                            m.insert("show_if".into(), Value::Object(s));
                        }
                    }
                    Some(Value::Object(m))
                })
                .collect();
            spec.insert(key, Value::Array(questions));
        } else {
            spec.insert(key, value);
        }
    }
    if kind == "form" && !spec.get("title").is_some_and(Value::is_string) {
        spec.insert("title".into(), view["label"].clone());
    }
    Value::Object(spec)
}

/// `rowFor`: a row as the API takes it; the relations it cannot resolve yet, apart.
fn row_for(row: &Map<String, Value>, table: &BuiltTable, ids: &HashMap<String, String>, links: &HashMap<String, String>, me: Option<&str>, today: chrono::DateTime<chrono::Local>) -> (Vec<(String, Value)>, Map<String, Value>) {
    let mut values: Vec<(String, Value)> = Vec::new();
    fn set(values: &mut Vec<(String, Value)>, name: &str, v: Value) {
        match values.iter_mut().find(|(n, _)| n == name) {
            Some(slot) => slot.1 = v,
            None => values.push((name.to_string(), v)),
        }
    }
    let mut deferred = Map::new();
    for (label, value) in row {
        if label == "$key" {
            continue;
        }
        let Some(field) = field_of(Some(table), label) else { continue };
        if field.ai {
            continue;
        }
        if field.kind == "link" || field.kind == "multi_link" {
            let target = links.get(&format!("{}:{}", table.key, label_key(label))).cloned().unwrap_or_default();
            let refs = match value {
                Value::Array(a) => a.clone(),
                v => vec![v.clone()],
            };
            let found: Vec<Option<String>> = refs.iter().map(|r| ids.get(&format!("{target}:{}", str_of(r).chars().skip(1).collect::<String>())).cloned()).collect();
            let resolved: Vec<String> = found.iter().flatten().cloned().collect();
            if resolved.len() < found.len() {
                deferred.insert(label.clone(), value.clone());
            } else if field.kind == "link" {
                set(&mut values, &field.name, resolved.first().map_or(Value::Null, |id| json!(id)));
            } else {
                set(&mut values, &field.name, json!(resolved));
            }
            continue;
        }
        match field.kind.as_str() {
            "select" => set(&mut values, &field.name, json!(choice_value(field, &js_string(Some(value))))),
            "multi_select" => {
                let list = match value {
                    Value::Array(a) => a.clone(),
                    v => vec![v.clone()],
                };
                let mapped: Vec<Value> = list.iter().map(|v| json!(choice_value(field, &js_string(Some(v))))).collect();
                set(&mut values, &field.name, Value::Array(mapped));
            }
            "date" | "datetime" => set(&mut values, &field.name, json!(resolve_template_date(&js_string(Some(value)), &field.kind, today))),
            "user" => {
                if let (Some("$moi"), Some(me)) = (value.as_str(), me) {
                    set(&mut values, &field.name, json!(me));
                }
            }
            _ => set(&mut values, &field.name, value.clone()),
        }
    }
    (values, deferred)
}

/// `rowOrder`: the target of a relation before its source, when it can.
fn row_order(template: &Value) -> Vec<String> {
    fn visit(key: &str, links: &[Value], order: &mut Vec<String>, visiting: &mut Vec<String>) {
        if order.iter().any(|k| k == key) || visiting.iter().any(|k| k == key) {
            return;
        }
        visiting.push(key.to_string());
        for link in links {
            if link["from"] == key && link["to"] != key {
                visit(str_of(&link["to"]), links, order, visiting);
            }
        }
        visiting.retain(|k| k != key);
        order.push(key.to_string());
    }
    let links = arr(&template["links"]);
    let mut order = Vec::new();
    let mut visiting = Vec::new();
    for table in arr(&template["tables"]) {
        visit(str_of(&table["key"]), &links, &mut order, &mut visiting);
    }
    order
}

/// `fieldInput`: the input of an ordinary field of the template.
fn field_input(table_id: &str, field: &Value) -> AddFieldRequest {
    AddFieldRequest {
        table_id: table_id.to_string(),
        label: str_of(&field["label"]).to_string(),
        kind: str_of(&field["kind"]).to_string(),
        description: field.get("description").cloned(),
        options: field.get("options").and_then(Value::as_array).map(|o| o.iter().map(|o| json!({ "value": o["value"], "label": o["label"], "color": o["color"], "icon": o["icon"] })).collect()),
        format: field.get("format").cloned(),
        rich: field.get("rich") == Some(&Value::Bool(true)),
        ..Default::default()
    }
}

/// `rollupFor`: names for labels; `links` tells the table each relation reaches.
fn rollup_for(field: &Value, table_key: &str, built: &HashMap<String, BuiltTable>, links: &HashMap<String, String>) -> RollupInput {
    let rollup = &field["rollup"];
    let via_label = str_of(&rollup["via"]);
    let of_table = rollup.get("table").and_then(Value::as_str);
    let holder = built.get(of_table.unwrap_or(table_key));
    let via = field_of(holder, via_label);
    let reached_key = of_table.map(str::to_string).or_else(|| links.get(&format!("{table_key}:{}", label_key(via_label))).cloned());
    let reached = reached_key.and_then(|k| built.get(&k));
    RollupInput {
        via: via.map_or(via_label.to_string(), |f| f.name.clone()),
        via_table: of_table.map(|t| holder.map_or(t.to_string(), |h| h.name.clone())),
        target: rollup.get("target").and_then(Value::as_str).map(|t| field_of(reached, t).map_or(t.to_string(), |f| f.name.clone())),
        aggregate: rollup.get("aggregate").and_then(Value::as_str).map(str::to_string),
    }
}

/// `TemplateApplyReport`.
pub struct ApplyReport {
    pub ai_degraded: usize,
    pub sampled: bool,
    pub not_required: Vec<String>,
}

/// What building a template is asked.
pub struct ApplyRequest {
    pub label: Option<String>,
    /// `None`: the template's; `Some(Null)`: none.
    pub description: Option<Value>,
    pub project: Option<String>,
    pub rows: bool,
    /// The caller's yes to the AI fields' cited values leaving for the provider.
    pub ai_consent: bool,
}

/// `AppliedTemplate`.
pub struct Applied {
    pub base_id: String,
    pub name: String,
    pub label: String,
    pub report: ApplyReport,
}

/// `applyTemplate` of `core/templates/apply.ts`: a base created for the purpose, the template
/// built into it, and deleted again if a step fails. `on_step` hears each step as it starts.
pub async fn apply_template(pools: &Pools, ctx: &RequestContext, template: &Value, request: &ApplyRequest, on_step: &(dyn Fn(&Value) + Send + Sync)) -> R<Applied> {
    let label = {
        let given = crate::description::js_trim(request.label.as_deref().unwrap_or_default()).to_string();
        if given.is_empty() {
            str_of(&template["base"]["label"]).to_string()
        } else {
            given
        }
    };
    let description = match &request.description {
        Some(d) => d.clone(),
        None => template["base"].get("description").cloned().unwrap_or(Value::Null),
    };
    let base = operations::create_base(pools, ctx, &label, Some(&description), request.project.as_deref()).await?;
    let step = std::sync::Mutex::new(Value::Null);
    let hear = |s: Value| {
        on_step(&s);
        *step.lock().unwrap() = s;
    };
    let me = (ctx.actor.kind == ActorKind::User).then_some(ctx.actor.id.as_str());
    match build(pools, ctx, &base.base_id, template, request.rows, request.ai_consent, me, &hear).await {
        Ok(report) => Ok(Applied { base_id: base.base_id, name: base.schema_name, label, report }),
        Err(error) => {
            let discarded = deletion::delete_base(pools, ctx, &base.base_id).await.is_ok();
            let last = step.lock().unwrap().clone();
            Err(error.with("template", json!({ "step": last, "base": base.schema_name, "discarded": discarded })))
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn build(pools: &Pools, ctx: &RequestContext, base_id: &str, template: &Value, with_rows: bool, ai_consent: bool, me: Option<&str>, on_step: &(dyn Fn(Value) + Send + Sync)) -> R<ApplyReport> {
    let today = chrono::Local::now();
    let tables = arr(&template["tables"]);
    let mut not_required = Vec::new();
    let mut built: HashMap<String, BuiltTable> = HashMap::new();
    let mut links: HashMap<String, String> = HashMap::new();
    let simple = |f: &Value| !["formula", "lookup", "rollup", "count", "button"].contains(&str_of(&f["kind"])) && f.get("ai").is_none();
    let missing = || AppError::internal("table absente");

    // 1. The tables, each with its display column.
    for (index, table) in tables.iter().enumerate() {
        on_step(json!({ "kind": "table", "label": table["label"], "index": index + 1, "count": tables.len() }));
        let table_fields = arr(&table["fields"]);
        let Some(first) = table_fields.first() else { continue };
        let mut first_input = Map::new();
        first_input.insert("label".into(), first["label"].clone());
        first_input.insert("kind".into(), first["kind"].clone());
        if let Some(d) = first.get("description") {
            first_input.insert("description".into(), d.clone());
        }
        let created = operations::create_table(pools, ctx, base_id, str_of(&table["label"]), table.get("description"), Some(&json!([first_input])), None).await?;
        let mut entry = BuiltTable { key: str_of(&table["key"]).to_string(), label: str_of(&table["label"]).to_string(), id: created.table_id.clone(), name: created.table_name.clone(), fields: HashMap::new() };
        let first_label = str_of(&first["label"]);
        if let Some(initial) = created.fields.iter().find(|f| label_key(&f.label) == label_key(first_label)) {
            entry.put(BuiltField { label: first_label.to_string(), id: initial.field_id.clone(), name: initial.name.clone(), kind: str_of(&first["kind"]).to_string(), options: None, ai: false });
        }
        if table.get("icon").is_some() || table.get("color").is_some() {
            let look = LookInput {
                color: table.get("color").map(|c| c.as_str().map(str::to_string)),
                icon: table.get("icon").map(|c| c.as_str().map(str::to_string)),
                image: None,
            };
            let _ = operations::update_table(pools, ctx, &created.table_id, None, Some(&look)).await;
        }
        built.insert(entry.key.clone(), entry);
    }

    // The fields the AI computes — with the person's consent, and an AI to compute them;
    // without, ordinary fields of their kind, which take the sample values (`aiOff`).
    let mut ai_off = !ai_consent;
    let mut degraded = 0usize;
    async fn add_ai_field(pools: &Pools, ctx: &RequestContext, entry: &mut BuiltTable, field: &Value, ai_off: &mut bool, degraded: &mut usize, on_step: &(dyn Fn(Value) + Send + Sync)) -> R<()> {
        on_step(json!({ "kind": "ai_field", "label": field["label"] }));
        let mut added = None;
        if !*ai_off {
            let ai = &field["ai"];
            let refresh = if ai["refresh"] == "if_empty" {
                json!({ "mode": "if_empty", "cron": null, "timezone": null })
            } else {
                json!({ "mode": "schedule", "cron": ai["refresh"]["cron"], "timezone": ai["refresh"]["timezone"] })
            };
            let request = AddFieldRequest { ai: Some(json!({ "prompt": ai["prompt"], "refresh": refresh, "consent": true })), ..field_input(&entry.id, field) };
            match fields::add_field(pools, ctx, &request).await {
                Ok(a) => added = Some(a),
                Err(e) if crate::ai_hooks::AI_UNAVAILABLE.contains(&e.code) => *ai_off = true,
                Err(e) => return Err(e),
            }
        }
        let with_ai = added.is_some();
        let added = match added {
            Some(a) => a,
            None => {
                *degraded += 1;
                fields::add_field(pools, ctx, &field_input(&entry.id, field)).await?
            }
        };
        entry.put(BuiltField {
            label: str_of(&field["label"]).to_string(),
            id: added.field_id,
            name: added.name,
            kind: str_of(&field["kind"]).to_string(),
            options: field.get("options").and_then(Value::as_array).cloned(),
            ai: with_ai,
        });
        Ok(())
    }

    // 2. Their fields, in their order — an AI field in its place when what it cites exists.
    let mut later_ai: Vec<(String, Value)> = Vec::new();
    for table in &tables {
        let key = str_of(&table["key"]).to_string();
        let rest: Vec<Value> = arr(&table["fields"]).into_iter().skip(1).filter(|f| simple(f) || f.get("ai").is_some()).collect();
        if !rest.is_empty() {
            on_step(json!({ "kind": "fields", "table": table["label"] }));
        }
        for field in rest {
            let entry = built.get_mut(&key).ok_or_else(missing)?;
            if field.get("ai").is_some() {
                let ready = cited_in_text(str_of(&field["ai"]["prompt"])).iter().all(|l| field_of(Some(entry), l).is_some());
                if ready {
                    add_ai_field(pools, ctx, entry, &field, &mut ai_off, &mut degraded, on_step).await?;
                } else {
                    later_ai.push((key.clone(), field));
                }
                continue;
            }
            let added = fields::add_field(pools, ctx, &field_input(&entry.id, &field)).await?;
            entry.put(BuiltField {
                label: str_of(&field["label"]).to_string(),
                id: added.field_id,
                name: added.name,
                kind: str_of(&field["kind"]).to_string(),
                options: field.get("options").and_then(Value::as_array).cloned(),
                ai: false,
            });
        }
    }

    // 3. The relations.
    for link in arr(&template["links"]) {
        let (from, to) = (str_of(&link["from"]), str_of(&link["to"]));
        let (Some(from_id), Some(to_id)) = (built.get(from).map(|t| t.id.clone()), built.get(to).map(|t| t.id.clone())) else { continue };
        on_step(json!({ "kind": "link", "label": link["label"] }));
        let created = fields::create_link_field(
            pools,
            ctx,
            &CreateLinkRequest {
                table_id: from_id,
                target_table_id: to_id,
                label: str_of(&link["label"]).to_string(),
                description: link.get("description").cloned(),
                multiple: link["multiple"] == true,
                ..Default::default()
            },
        )
        .await?;
        let entry = built.get_mut(from).ok_or_else(missing)?;
        entry.put(BuiltField {
            label: str_of(&link["label"]).to_string(),
            id: created.field_id,
            name: created.name,
            kind: if link["multiple"] == true { "multi_link" } else { "link" }.into(),
            options: None,
            ai: false,
        });
        links.insert(format!("{from}:{}", label_key(str_of(&link["label"]))), to.to_string());
    }

    // 4. What is computed, in rounds: one may read another.
    let mut pending: Vec<(String, Value)> = tables
        .iter()
        .flat_map(|t| arr(&t["fields"]).into_iter().filter(|f| ["formula", "lookup", "rollup", "count"].contains(&str_of(&f["kind"]))).map(|f| (str_of(&t["key"]).to_string(), f)).collect::<Vec<_>>())
        .collect();
    while !pending.is_empty() {
        let mut failed = Vec::new();
        let mut last_error = None;
        let count = pending.len();
        for (key, field) in pending {
            on_step(json!({ "kind": "computed", "label": field["label"] }));
            let table_id = built.get(&key).ok_or_else(missing)?.id.clone();
            let kind = str_of(&field["kind"]).to_string();
            let mut request = AddFieldRequest { table_id, label: str_of(&field["label"]).to_string(), kind: kind.clone(), description: field.get("description").cloned(), ..Default::default() };
            if kind == "formula" {
                request.formula = Some(FormulaInput { expression: str_of(&field["formula"]).to_string(), timezone: None });
            } else {
                request.rollup = Some(rollup_for(&field, &key, &built, &links));
            }
            match fields::add_field(pools, ctx, &request).await {
                Ok(added) => built.get_mut(&key).ok_or_else(missing)?.put(BuiltField { label: request.label, id: added.field_id, name: added.name, kind, options: None, ai: false }),
                Err(e) => {
                    last_error = Some(e);
                    failed.push((key, field));
                }
            }
        }
        if failed.len() == count {
            return Err(last_error.unwrap_or_else(|| AppError::internal("calcul")));
        }
        pending = failed;
    }

    // 5. The AI fields that cite a relation or a computed field.
    for (key, field) in &later_ai {
        let entry = built.get_mut(key).ok_or_else(missing)?;
        add_ai_field(pools, ctx, entry, field, &mut ai_off, &mut degraded, on_step).await?;
    }
    let rows_of = template["rows"].as_object().cloned().unwrap_or_default();
    let sampled = with_rows && rows_of.values().any(|r| r.as_array().is_some_and(|a| !a.is_empty()));

    // 6. The display columns.
    for table in &tables {
        let entry = built.get(str_of(&table["key"])).ok_or_else(missing)?;
        if let Some(display) = table["fields"].get(0).and_then(|f| field_of(Some(entry), str_of(&f["label"]))) {
            fields::set_display_column(pools, ctx, &entry.id, Some(&display.id)).await?;
        }
    }

    // 7. The rows, relations resolved by their keys — afterwards for those not created yet.
    let mut ids: HashMap<String, String> = HashMap::new();
    let mut later: Vec<(String, String, Map<String, Value>)> = Vec::new();
    let order = if with_rows { row_order(template) } else { vec![] };
    for key in order {
        let rows = arr(rows_of.get(&key).unwrap_or(&Value::Null));
        let Some(entry) = built.get(&key) else { continue };
        if rows.is_empty() {
            continue;
        }
        on_step(json!({ "kind": "rows", "table": entry.label }));
        let writers = WRITERS.get().ok_or_else(|| AppError::internal("écrivain de lignes absent"))?;
        let empty = Map::new();
        let prepared: Vec<(Entries, Map<String, Value>)> = rows.iter().map(|r| row_for(r.as_object().unwrap_or(&empty), entry, &ids, &links, me, today)).collect();
        for start in (0..prepared.len()).step_by(1000) {
            let chunk = &prepared[start..(start + 1000).min(prepared.len())];
            let records: Vec<Value> = chunk.iter().map(|(v, _)| Value::Object(v.iter().cloned().collect())).collect();
            let created = (writers.create)(pools.clone(), ctx.clone(), entry.id.clone(), records).await?;
            for (index, id) in created.iter().enumerate() {
                let Some(row) = rows.get(start + index) else { continue };
                if let Some(k) = row.get("$key") {
                    ids.insert(format!("{key}:{}", js_string(Some(k))), id.clone());
                }
                if let Some((_, deferred)) = chunk.get(index) {
                    if !deferred.is_empty() {
                        later.push((key.clone(), id.clone(), deferred.clone()));
                    }
                }
            }
        }
    }
    if !later.is_empty() {
        on_step(json!({ "kind": "row_links" }));
    }
    for (key, id, row) in &later {
        let entry = built.get(key).ok_or_else(missing)?;
        let (values, _) = row_for(row, entry, &ids, &links, me, today);
        if !values.is_empty() {
            let writers = WRITERS.get().ok_or_else(|| AppError::internal("écrivain de lignes absent"))?;
            (writers.update)(pools.clone(), ctx.clone(), entry.id.clone(), id.clone(), values).await?;
        }
    }

    // 8. The buttons, after the automations they trigger.
    let mut automation_ids: HashMap<String, String> = HashMap::new();
    for automation in arr(&template["automations"]).iter().filter(|a| a["trigger"]["kind"] == "button") {
        on_step(json!({ "kind": "automation", "label": automation["label"] }));
        let id = create_automation(ctx, base_id, automation_for(automation, &built, me)).await?;
        if let Some(key) = automation.get("key").and_then(Value::as_str) {
            automation_ids.insert(key.to_string(), id);
        }
    }
    for table in &tables {
        let key = str_of(&table["key"]);
        for field in arr(&table["fields"]).into_iter().filter(|f| f["kind"] == "button") {
            let Some(button) = field.get("button") else { continue };
            on_step(json!({ "kind": "button", "label": field["label"] }));
            let entry = built.get_mut(key).ok_or_else(missing)?;
            let automation = button.get("automation").and_then(Value::as_str).and_then(|k| automation_ids.get(k));
            let input = match automation {
                Some(id) => json!({
                    "label": button["label"],
                    "color": button.get("color").cloned().unwrap_or(Value::Null),
                    "action": "automation",
                    "automation": id,
                }),
                None => json!({
                    "label": button["label"],
                    "color": button.get("color").cloned().unwrap_or(Value::Null),
                    "action": "url",
                    "url": text_for(button.get("url").and_then(Value::as_str).unwrap_or_default(), Some(entry)),
                }),
            };
            let added = fields::add_field(pools, ctx, &AddFieldRequest { table_id: entry.id.clone(), label: str_of(&field["label"]).to_string(), kind: "button".into(), button: Some(input), ..Default::default() }).await?;
            entry.put(BuiltField { label: str_of(&field["label"]).to_string(), id: added.field_id, name: added.name, kind: "button".into(), options: None, ai: false });
        }
    }

    // 9. The required fields, now that the rows are there.
    for table in &tables {
        let entry = built.get(str_of(&table["key"])).ok_or_else(missing)?;
        for field in arr(&table["fields"]).into_iter().filter(|f| f["required"] == true) {
            let Some(found) = field_of(Some(entry), str_of(&field["label"])) else { continue };
            if fields::set_field_required(pools, ctx, &found.id, true).await.is_err() {
                not_required.push(str_of(&field["label"]).to_string());
            }
        }
    }

    // 10. The views, the other automations.
    for view in arr(&template["views"]) {
        let Some(entry) = built.get(str_of(&view["table"])) else { continue };
        on_step(json!({ "kind": "view", "label": view["label"] }));
        let spec = spec_for(&view, entry);
        let description = view.get("description").cloned().unwrap_or(Value::Null);
        views::create_view(
            pools,
            ctx,
            &entry.id,
            &ViewInput { label: Some(&view["label"]), kind: Some(&view["kind"]), description: Some(&description), spec: Some(&spec), personal: false, locked: None },
        )
        .await?;
    }
    for automation in arr(&template["automations"]).iter().filter(|a| a["trigger"]["kind"] != "button") {
        on_step(json!({ "kind": "automation", "label": automation["label"] }));
        create_automation(ctx, base_id, automation_for(automation, &built, me)).await?;
    }
    Ok(ApplyReport { ai_degraded: degraded, sampled, not_required })
}

/// Whether building `template` needs a crate that is not installed: automations when the
/// automations crate has not handed its creator over, AI fields the person consented to when
/// the AI crate is not. Never in `basedb-server`, which installs both — a router mounted
/// alone (tests) refuses such a template as an incident.
pub fn needs_missing_crate(template: &Value, ai_consent: bool) -> bool {
    let automations = template["automations"].as_array().is_some_and(|a| !a.is_empty()) && AUTOMATIONS.get().is_none();
    let ai = template["tables"].as_array().is_some_and(|t| t.iter().any(|t| t["fields"].as_array().is_some_and(|f| f.iter().any(|f| f.get("ai").is_some()))));
    automations || (ai_consent && ai && crate::ai_hooks::ai_hooks().is_none())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rows_follow_their_targets() {
        let t = json!({ "tables": [{ "key": "a" }, { "key": "b" }, { "key": "c" }], "links": [
            { "from": "a", "to": "b" }, { "from": "b", "to": "c" }, { "from": "c", "to": "c" }, { "from": "c", "to": "a" }
        ] });
        assert_eq!(row_order(&t), vec!["c", "b", "a"]);
    }

    #[test]
    fn texts_and_choices_by_name() {
        let mut t = BuiltTable { key: "t".into(), label: "T".into(), id: "x".into(), name: "t".into(), fields: HashMap::new() };
        t.put(BuiltField { label: "Statut".into(), id: "1".into(), name: "statut".into(), kind: "select".into(), options: Some(vec![json!({ "label": "En cours", "value": "en_cours" })]), ai: false });
        assert_eq!(text_for("Voir {{ statut }} {{_id}} {{Autre}}", Some(&t)), "Voir {{statut}} {{_id}} {{Autre}}");
        assert_eq!(choice_value(t.fields.get("statut").unwrap(), "en cours"), "en_cours");
        let spec = spec_for(&json!({ "kind": "form", "label": "F", "spec": { "fields": [{ "field": "Statut", "show_if": { "field": "Statut", "op": "eq", "value": "En cours" } }] } }), &t);
        assert_eq!(spec, json!({ "fields": [{ "field": "statut", "required": false, "label": "", "help": "", "show_if": { "field": "statut", "op": "eq", "value": "en_cours" } }], "title": "F" }));
    }
}
