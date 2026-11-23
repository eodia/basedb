//! Comparing the structure of two environments, and carrying one into the other
//! (`environments/structure.ts`, chapter 14 §3).
//!
//! Objects are matched by LINEAGE, never by name. The plan is a list of ordinary kernel
//! operations ([`build_plan`] is pure); applying runs each in its own transaction, then
//! mirrors the grants of what it created and records the synchronization.

use crate::family::{load_family, load_pair, EnvironmentSummary};
use crate::fields::{self, AddFieldRequest, CreateLinkRequest};
use crate::http::LookInput;
use crate::{deletion, operations, select_options};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_base;
use basedb_base::time::iso;
use basedb_base::tx::{with_transaction, Isolation, RequestContext, TxOptions};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

type R<T> = Result<T, AppError>;

/// `{ readOnly: true, isolation: 'repeatable read' }`.
pub fn snapshot_options() -> TxOptions {
    TxOptions { isolation: Isolation::RepeatableRead, read_only: true, ..Default::default() }
}

// ── The structure of one environment ──────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub struct StructureOption {
    pub value: String,
    pub label: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
}

impl StructureOption {
    pub fn to_json(&self) -> Value {
        json!({ "value": self.value, "label": self.label, "color": self.color, "icon": self.icon, "image": self.image })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct StructureLink {
    pub target_lineage: String,
    pub target_label: String,
    pub on_delete: String,
}

/// The prompt cites columns by LINEAGE here (`{{@…}}`), to compare across environments.
#[derive(Debug, Clone, PartialEq)]
pub struct StructureAi {
    pub prompt: String,
    pub mode: String,
    pub cron: Option<String>,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StructureField {
    pub id: String,
    pub lineage: String,
    pub name: String,
    pub label: String,
    pub kind: String,
    pub description: Option<String>,
    pub required: bool,
    pub position: i32,
    pub rich: bool,
    pub options: Option<Vec<StructureOption>>,
    pub link: Option<StructureLink>,
    pub ai: Option<StructureAi>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StructureTable {
    pub id: String,
    pub lineage: String,
    pub name: String,
    pub label: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    pub position: i32,
    pub deleted: bool,
    pub display_lineage: Option<String>,
    pub fields: Vec<StructureField>,
}

static REFERENCE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{\s*([^{}]+?)\s*\}\}").expect("regex"));
static NEUTRAL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{@([0-9a-f-]{36})\}\}").expect("regex"));

/// `neutralPrompt`: a stored prompt (`{{nom}}`) with its citations by lineage (`{{@…}}`).
pub fn neutral_prompt(prompt: &str, lineage_by_name: &HashMap<String, String>) -> String {
    REFERENCE
        .replace_all(prompt, |c: &regex::Captures| {
            let name = crate::description::js_trim(&c[1]);
            match lineage_by_name.get(name) {
                Some(lineage) => format!("{{{{@{lineage}}}}}"),
                None => c[0].to_string(),
            }
        })
        .into_owned()
}

/// `localPrompt`: back to the target's names; `None` when a cited column has no counterpart there.
pub fn local_prompt(prompt: &str, name_by_lineage: &HashMap<String, String>) -> Option<String> {
    let mut missing = false;
    let out = NEUTRAL
        .replace_all(prompt, |c: &regex::Captures| match name_by_lineage.get(&c[1]) {
            Some(name) => format!("{{{{{name}}}}}"),
            None => {
                missing = true;
                format!("{{{{{}}}}}", &c[1])
            }
        })
        .into_owned();
    (!missing).then_some(out)
}

/// `loadStructure`: the live tables and fields of a base, and its deleted tables.
pub async fn load_structure<E: Exec + Sync>(exec: &E, base_id: &str) -> R<Vec<StructureTable>> {
    let tables = exec
        .rows(
            "SELECT t.id::text, t.lineage_id::text, tn.name, t.label, t.description, t.color, t.icon, t.image,
                    t.position::int, t.deleted_at IS NOT NULL AS deleted, df.lineage_id::text AS display_lineage
               FROM _basedb.table_def t
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               LEFT JOIN _basedb.field df    ON df.id = t.display_field_id
              WHERE t.base_id = $1::text::uuid AND NOT t.is_purged
              ORDER BY t.position, t.label",
            &[&base_id],
        )
        .await?;
    let field_rows = exec
        .rows(
            "SELECT f.id::text, f.table_id::text, f.lineage_id::text, n.name, f.label, f.kind, f.description,
                    f.is_required, f.position::int, lc.on_delete, tt.lineage_id::text AS target_lineage,
                    tt.label AS target_label, ai.prompt, ai.refresh_mode, ai.refresh_cron,
                    ai.refresh_timezone, coalesce(tc.is_rich, false) AS is_rich
               FROM _basedb.field f
               JOIN _basedb.table_def t      ON t.id = f.table_id
               JOIN _basedb.physical_name n  ON n.id = f.name_id
               LEFT JOIN _basedb.field_link_config lc ON lc.field_id = f.id
               LEFT JOIN _basedb.table_def tt         ON tt.id = lc.target_table_id
               LEFT JOIN _basedb.field_ai_config ai   ON ai.field_id = f.id
               LEFT JOIN _basedb.field_text_config tc ON tc.field_id = f.id
              WHERE f.base_id = $1::text::uuid AND f.deleted_at IS NULL AND t.deleted_at IS NULL
              ORDER BY f.position, f.created_at",
            &[&base_id],
        )
        .await?;
    let option_rows = exec
        .rows(
            "SELECT o.field_id::text, o.value, o.label, o.color, o.icon, o.image
               FROM _basedb.select_option o
               JOIN _basedb.field f ON f.id = o.field_id
              WHERE f.base_id = $1::text::uuid AND o.deleted_at IS NULL AND f.deleted_at IS NULL
              ORDER BY o.position",
            &[&base_id],
        )
        .await?;
    let mut options: HashMap<String, Vec<StructureOption>> = HashMap::new();
    for o in &option_rows {
        options.entry(o.get(0)).or_default().push(StructureOption { value: o.get(1), label: o.get(2), color: o.get(3), icon: o.get(4), image: o.get(5) });
    }

    let mut out = Vec::with_capacity(tables.len());
    for t in &tables {
        let table_id: String = t.get(0);
        let own: Vec<_> = field_rows.iter().filter(|f| f.get::<_, String>(1) == table_id).collect();
        let lineage_by_name: HashMap<String, String> = own.iter().map(|f| (f.get::<_, String>(3), f.get::<_, String>(2))).collect();
        let fields = own
            .iter()
            .map(|f| {
                let id: String = f.get(0);
                let kind: String = f.get(5);
                let target_lineage: Option<String> = f.get(10);
                let prompt: Option<String> = f.get(12);
                let mode: Option<String> = f.get(13);
                StructureField {
                    options: matches!(kind.as_str(), "select" | "multi_select").then(|| options.get(&id).cloned().unwrap_or_default()),
                    link: target_lineage.map(|target_lineage| StructureLink {
                        target_lineage,
                        target_label: f.get::<_, Option<String>>(11).unwrap_or_default(),
                        on_delete: f.get::<_, Option<String>>(9).unwrap_or_else(|| "restrict".into()),
                    }),
                    ai: match (prompt, mode) {
                        (Some(p), Some(m)) => Some(StructureAi { prompt: neutral_prompt(&p, &lineage_by_name), mode: m, cron: f.get(14), timezone: f.get(15) }),
                        _ => None,
                    },
                    id,
                    lineage: f.get(2),
                    name: f.get(3),
                    label: f.get(4),
                    kind,
                    description: f.get(6),
                    required: f.get(7),
                    position: f.get(8),
                    rich: f.get(16),
                }
            })
            .collect();
        out.push(StructureTable {
            id: table_id,
            lineage: t.get(1),
            name: t.get(2),
            label: t.get(3),
            description: t.get(4),
            color: t.get(5),
            icon: t.get(6),
            image: t.get(7),
            position: t.get(8),
            deleted: t.get(9),
            display_lineage: t.get(10),
            fields,
        });
    }
    Ok(out)
}

/// `lastChanges`: when each object of a base last changed, in JavaScript milliseconds.
pub async fn last_changes<E: Exec + Sync>(exec: &E, base_id: &str) -> R<HashMap<String, i64>> {
    let rows = exec
        .rows(
            "SELECT key::text, max(occurred_at) AS at FROM (
               SELECT CASE WHEN object_kind = 'select_option' THEN parent_object_id ELSE object_id END
                        AS key,
                      occurred_at
                 FROM _basedb.structure_revision
                WHERE base_id = $1::text::uuid
                  AND object_kind IN ('table_def', 'field', 'field_config', 'select_option')
             ) r
             GROUP BY key",
            &[&base_id],
        )
        .await?;
    Ok(rows
        .iter()
        .filter_map(|r| {
            let key: Option<String> = r.get(0);
            let at: Option<DateTime<Utc>> = r.get(1);
            Some((key.unwrap_or_else(|| "null".into()), at?.timestamp_millis()))
        })
        .collect())
}

/// `lastSync`: the last time one of the two was carried into the other, structure-wise.
pub async fn last_sync<E: Exec + Sync>(exec: &E, a: &str, b: &str) -> R<Option<DateTime<Utc>>> {
    let row = exec
        .first(
            "SELECT max(synced_at) AS at FROM _basedb.environment_sync
              WHERE kind IN ('fork', 'structure')
                AND ((source_base_id = $1::text::uuid AND target_base_id = $2::text::uuid)
                  OR (source_base_id = $2::text::uuid AND target_base_id = $1::text::uuid))",
            &[&a, &b],
        )
        .await?;
    Ok(row.and_then(|r| r.get::<_, Option<DateTime<Utc>>>(0)))
}

/// JavaScript milliseconds, as `new Date(at).getTime()` reads a timestamp.
fn millis(at: DateTime<Utc>) -> i64 {
    at.timestamp_millis()
}

// ── Comparing every environment ───────────────────────────────────────────────

fn table_signature(t: Option<&StructureTable>) -> String {
    match t {
        None => "absent".into(),
        Some(t) => json!([t.deleted, t.label, t.description, t.color, t.icon, t.image, if t.deleted { None } else { t.display_lineage.clone() }]).to_string(),
    }
}

fn ai_json(ai: &Option<StructureAi>) -> Value {
    match ai {
        None => Value::Null,
        Some(a) => json!({ "prompt": a.prompt, "mode": a.mode, "cron": a.cron, "timezone": a.timezone }),
    }
}

fn field_signature(f: Option<&StructureField>) -> String {
    match f {
        None => "absent".into(),
        Some(f) => json!([
            f.label,
            f.kind,
            f.description,
            f.required,
            f.rich,
            f.options.as_ref().map(|o| o.iter().map(StructureOption::to_json).collect::<Vec<_>>()),
            f.link.as_ref().map(|l| l.target_lineage.clone()),
            f.link.as_ref().map(|l| l.on_delete.clone()),
            ai_json(&f.ai),
        ])
        .to_string(),
    }
}

/// `unionOrder`: lineages in a stable order, the first list's, then the newcomers.
fn union_order<'a>(lists: impl IntoIterator<Item = Vec<&'a str>>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for list in lists {
        for lineage in list {
            if seen.insert(lineage.to_string()) {
                out.push(lineage.to_string());
            }
        }
    }
    out
}

fn table_cell(t: &StructureTable) -> Value {
    let display = t.fields.iter().find(|f| Some(&f.lineage) == t.display_lineage.as_ref());
    json!({
        "label": t.label,
        "name": t.name,
        "deleted": t.deleted,
        "description": t.description,
        "color": t.color,
        "icon": t.icon,
        "image": t.image,
        "displayField": display.map(|f| f.label.clone()),
    })
}

fn field_cell(f: &StructureField) -> Value {
    json!({
        "label": f.label,
        "name": f.name,
        "kind": f.kind,
        "required": f.required,
        "description": f.description,
        "options": f.options.as_ref().map(|o| o.iter().map(|o| o.label.clone()).collect::<Vec<_>>()),
        "link": f.link.as_ref().map(|l| l.target_label.clone()),
        "ai": f.ai.is_some(),
    })
}

/// `compareEnvironments`: every environment of a base side by side.
pub async fn compare_environments(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Value> {
    with_transaction(pools, PoolName::Catalog, ctx, snapshot_options(), |tx| async move {
        let family = load_family(&tx, ctx, base_id).await?;
        for env in &family.environments {
            require_on_base(&tx, ctx, Action::ManageSchema, &env.id).await?;
        }
        let mut structures = Vec::new();
        for env in &family.environments {
            structures.push(load_structure(&tx, &env.id).await?);
        }
        let mut tables = Vec::new();
        for lineage in union_order(structures.iter().map(|s| s.iter().map(|t| t.lineage.as_str()).collect())) {
            let by_env: Vec<Option<&StructureTable>> = structures.iter().map(|s| s.iter().find(|t| t.lineage == lineage)).collect();
            let live: Vec<&[StructureField]> = by_env.iter().map(|t| match t {
                Some(t) if !t.deleted => t.fields.as_slice(),
                _ => &[],
            }).collect();
            let mut fields = Vec::new();
            let mut any_field_differs = false;
            for field_lineage in union_order(live.iter().map(|l| l.iter().map(|f| f.lineage.as_str()).collect())) {
                let cells: Vec<Option<&StructureField>> = live.iter().map(|l| l.iter().find(|f| f.lineage == field_lineage)).collect();
                let differs = cells.iter().map(|c| field_signature(*c)).collect::<HashSet<_>>().len() > 1;
                any_field_differs |= differs;
                fields.push(json!({
                    "lineage": field_lineage,
                    "cells": cells.iter().map(|c| c.map(field_cell).unwrap_or(Value::Null)).collect::<Vec<_>>(),
                    "differs": differs,
                }));
            }
            let differs = by_env.iter().map(|t| table_signature(*t)).collect::<HashSet<_>>().len() > 1 || any_field_differs;
            tables.push(json!({
                "lineage": lineage,
                "cells": by_env.iter().map(|t| t.map(table_cell).unwrap_or(Value::Null)).collect::<Vec<_>>(),
                "fields": fields,
                "differs": differs,
            }));
        }
        Ok(json!({
            "environments": family.environments.iter().map(EnvironmentSummary::to_json).collect::<Vec<_>>(),
            "tables": tables,
        }))
    })
    .await
}

// ── The plan ──────────────────────────────────────────────────────────────────

/// Created with their table by `createTable`; the others are added one by one.
const TABLE_KINDS: [&str; 8] = ["short_text", "long_text", "url", "email", "number", "boolean", "date", "datetime"];

fn table_kind(kind: &str) -> bool {
    TABLE_KINDS.contains(&kind)
}

fn kind_label(kind: &str) -> &str {
    match kind {
        "short_text" => "texte",
        "long_text" => "texte long",
        "url" => "lien URL",
        "email" => "e-mail",
        "autonumber" => "numéro automatique",
        "user" => "personne",
        "number" => "nombre",
        "boolean" => "booléen",
        "date" => "date",
        "datetime" => "date et heure",
        "select" => "liste de choix",
        "multi_select" => "choix multiple",
        "file" => "document",
        "image" => "image",
        "link" => "relation",
        "multi_link" => "relation multiple",
        "formula" => "formule",
        other => other,
    }
}

/// The order steps are applied in.
fn phase(kind: &str) -> u8 {
    match kind {
        "create_table" => 1,
        "add_field" => 2,
        "add_link" => 3,
        "update_table" | "update_field" | "set_options" | "set_required" => 4,
        "set_ai" | "remove_ai" => 5,
        "set_display" | "reorder_fields" => 6,
        _ => 7,
    }
}

fn look(color: &Option<String>, icon: &Option<String>, image: &Option<String>) -> String {
    if image.is_some() {
        "image".into()
    } else if let Some(icon) = icon {
        format!("pictogramme {icon}")
    } else {
        color.clone().unwrap_or_else(|| "aucune".into())
    }
}

fn options_text(options: &Option<Vec<StructureOption>>) -> Option<String> {
    options.as_ref().map(|o| o.iter().map(|o| o.label.as_str()).collect::<Vec<_>>().join(", "))
}

const TABLE_GONE: &str = "La table n’existe pas, ou plus, dans la cible.";
const FIELD_GONE: &str = "Le champ n’existe pas, ou plus, dans la cible.";

/// What running a step takes — the closures of `structure.ts`, as data.
#[derive(Debug, Clone)]
pub enum Run {
    DeleteTable { lineage: String },
    CreateTable { table: StructureTable, simple: Vec<StructureField> },
    UpdateTable { table: StructureTable, other: StructureTable },
    AddLink { table: String, field: StructureField },
    AddField { table: String, field: StructureField },
    UpdateField { field: StructureField, there: StructureField },
    SetOptions { field: StructureField },
    SetRequired { field: StructureField },
    RemoveAi { field: String },
    SetAi { field: String, table: String, ai: StructureAi },
    SetDisplay { table: String, display: String },
    Reorder { table: String, order: Vec<String> },
}

#[derive(Debug, Clone)]
pub struct StepChange {
    pub attribute: String,
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PlanStep {
    pub id: String,
    pub kind: &'static str,
    pub table: (String, String),
    pub field: Option<(String, String, String)>,
    pub summary: String,
    pub changes: Vec<StepChange>,
    pub status: &'static str,
    pub selected: bool,
    pub destructive: bool,
    pub depends_on: Vec<String>,
    pub run: Run,
}

impl PlanStep {
    pub fn to_json(&self) -> Value {
        let mut m = Map::new();
        m.insert("id".into(), json!(self.id));
        m.insert("kind".into(), json!(self.kind));
        m.insert("table".into(), json!({ "lineage": self.table.0, "label": self.table.1 }));
        if let Some((lineage, label, kind)) = &self.field {
            m.insert("field".into(), json!({ "lineage": lineage, "label": label, "kind": kind }));
        }
        m.insert("summary".into(), json!(self.summary));
        m.insert("changes".into(), self.changes.iter().map(|c| json!({ "attribute": c.attribute, "from": c.from, "to": c.to })).collect());
        m.insert("status".into(), json!(self.status));
        m.insert("dependsOn".into(), json!(self.depends_on));
        m.insert("destructive".into(), json!(self.destructive));
        m.insert("selected".into(), json!(self.selected));
        Value::Object(m)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlanNote {
    pub table: String,
    pub field: Option<String>,
    pub message: String,
}

impl PlanNote {
    pub fn to_json(&self) -> Value {
        let mut m = Map::new();
        m.insert("table".into(), json!(self.table));
        if let Some(f) = &self.field {
            m.insert("field".into(), json!(f));
        }
        m.insert("message".into(), json!(self.message));
        Value::Object(m)
    }
}

/// Who changed what, by the structure history; `since` is the last synchronization.
#[derive(Debug, Clone, Default)]
pub struct Recency {
    pub source: HashMap<String, i64>,
    pub target: HashMap<String, i64>,
    pub since: Option<i64>,
}

/// `statusOf`.
fn status_of(recency: &Recency, source_id: &str, target_id: &str) -> &'static str {
    let s = recency.source.get(source_id).copied().unwrap_or(0);
    let t = recency.target.get(target_id).copied().unwrap_or(0);
    if recency.since.is_some_and(|since| s > since && t > since) {
        return "conflict";
    }
    if t > s {
        "target_newer"
    } else {
        "ready"
    }
}

struct StepSpec {
    id: String,
    kind: &'static str,
    table: (String, String),
    field: Option<(String, String, String)>,
    summary: String,
    changes: Vec<StepChange>,
    status: &'static str,
    destructive: bool,
    depends_on: Vec<String>,
}

fn step(spec: StepSpec, run: Run) -> PlanStep {
    PlanStep {
        selected: spec.status == "ready",
        id: spec.id,
        kind: spec.kind,
        table: spec.table,
        field: spec.field,
        summary: spec.summary,
        changes: spec.changes,
        status: spec.status,
        destructive: spec.destructive,
        depends_on: spec.depends_on,
        run,
    }
}

fn change(attribute: &str, from: Option<String>, to: Option<String>) -> StepChange {
    StepChange { attribute: attribute.into(), from, to }
}

fn note(table: &str, field: Option<&str>, message: String) -> PlanNote {
    PlanNote { table: table.into(), field: field.map(str::to_string), message }
}

/// `buildPlan`: the steps that would make `target` look like `source`, and what they
/// cannot settle. Pure.
pub fn build_plan(source: &[StructureTable], target: &[StructureTable], recency: &Recency, names: (&str, &str)) -> (Vec<PlanStep>, Vec<PlanNote>) {
    let mut steps: Vec<PlanStep> = Vec::new();
    let mut notes: Vec<PlanNote> = Vec::new();
    let target_by_lineage: HashMap<&str, &StructureTable> = target.iter().map(|t| (t.lineage.as_str(), t)).collect();
    let source_lineages: HashSet<&str> = source.iter().map(|t| t.lineage.as_str()).collect();
    let table_need = |lineage: &str| -> Vec<String> {
        match target_by_lineage.get(lineage) {
            Some(t) if !t.deleted => vec![],
            _ => vec![format!("create_table:{lineage}")],
        }
    };

    for table in source {
        let tref = (table.lineage.clone(), table.label.clone());
        let other = target_by_lineage.get(table.lineage.as_str()).copied();

        if table.deleted {
            if let Some(other) = other.filter(|o| !o.deleted) {
                steps.push(step(
                    StepSpec {
                        id: format!("delete_table:{}", table.lineage),
                        kind: "delete_table",
                        table: tref,
                        field: None,
                        summary: format!("Supprimer la table « {} »", other.label),
                        changes: vec![],
                        status: status_of(recency, &table.id, &other.id),
                        destructive: true,
                        depends_on: vec![],
                    },
                    Run::DeleteTable { lineage: table.lineage.clone() },
                ));
            }
            continue;
        }

        if other.is_some_and(|o| o.deleted) {
            notes.push(note(&table.label, None, format!("Supprimée dans « {} » : restaurez-la d’abord pour y reporter la structure.", names.1)));
            continue;
        }

        let created = other.is_none();
        let create_id = format!("create_table:{}", table.lineage);
        let deps: Vec<String> = if created { vec![create_id.clone()] } else { vec![] };

        if let Some(other) = other {
            let mut changes = Vec::new();
            if other.label != table.label {
                changes.push(change("Libellé", Some(other.label.clone()), Some(table.label.clone())));
            }
            if other.description != table.description {
                changes.push(change("Description", other.description.clone(), table.description.clone()));
            }
            let (lo, lt) = (look(&other.color, &other.icon, &other.image), look(&table.color, &table.icon, &table.image));
            if lo != lt || other.color != table.color {
                changes.push(change("Apparence", Some(lo), Some(lt)));
            }
            if !changes.is_empty() {
                steps.push(step(
                    StepSpec {
                        id: format!("update_table:{}", table.lineage),
                        kind: "update_table",
                        table: tref.clone(),
                        field: None,
                        summary: format!("Modifier la table « {} »", other.label),
                        changes,
                        status: status_of(recency, &table.id, &other.id),
                        destructive: false,
                        depends_on: vec![],
                    },
                    Run::UpdateTable { table: table.clone(), other: other.clone() },
                ));
            }
        } else {
            let simple: Vec<StructureField> = table.fields.iter().filter(|f| table_kind(&f.kind) && !f.rich).cloned().collect();
            let listed = table.fields.iter().map(|f| f.label.as_str()).collect::<Vec<_>>().join(", ");
            steps.push(step(
                StepSpec {
                    id: create_id.clone(),
                    kind: "create_table",
                    table: tref.clone(),
                    field: None,
                    summary: format!("Créer la table « {} »", table.label),
                    changes: vec![change("Champs", None, Some(if listed.is_empty() { "aucun".into() } else { listed }))],
                    status: "ready",
                    destructive: false,
                    depends_on: vec![],
                },
                Run::CreateTable { table: table.clone(), simple },
            ));
        }

        let target_fields: HashMap<&str, &StructureField> = other.map(|o| o.fields.iter().map(|f| (f.lineage.as_str(), f)).collect()).unwrap_or_default();
        for field in &table.fields {
            let fref = Some((field.lineage.clone(), field.label.clone(), field.kind.clone()));
            let there = target_fields.get(field.lineage.as_str()).copied();

            if field.kind == "formula" {
                if there.is_none() {
                    notes.push(note(&table.label, Some(&field.label), "Formule : elle ne se recopie pas encore d’un environnement à l’autre.".into()));
                }
                continue;
            }

            let mut add_id: Option<String> = None;
            match there {
                None => {
                    if created && table_kind(&field.kind) {
                        // Created with its table, by the table's step.
                    } else if let Some(link) = &field.link {
                        add_id = Some(format!("add_link:{}", field.lineage));
                        if link.on_delete == "cascade" {
                            notes.push(note(&table.label, Some(&field.label), "Relation en cascade : à recréer à la main, avec sa confirmation.".into()));
                            continue;
                        }
                        let mut depends_on = deps.clone();
                        depends_on.extend(table_need(&link.target_lineage));
                        steps.push(step(
                            StepSpec {
                                id: format!("add_link:{}", field.lineage),
                                kind: "add_link",
                                table: tref.clone(),
                                field: fref.clone(),
                                summary: format!("Ajouter la relation « {} » vers « {} »", field.label, link.target_label),
                                changes: vec![],
                                status: "ready",
                                destructive: false,
                                depends_on,
                            },
                            Run::AddLink { table: table.lineage.clone(), field: field.clone() },
                        ));
                    } else {
                        add_id = Some(format!("add_field:{}", field.lineage));
                        steps.push(step(
                            StepSpec {
                                id: format!("add_field:{}", field.lineage),
                                kind: "add_field",
                                table: tref.clone(),
                                field: fref.clone(),
                                summary: format!("Ajouter le champ « {} » ({})", field.label, kind_label(&field.kind)),
                                changes: if field.options.is_none() { vec![] } else { vec![change("Choix", None, options_text(&field.options))] },
                                status: "ready",
                                destructive: false,
                                depends_on: deps.clone(),
                            },
                            Run::AddField { table: table.lineage.clone(), field: field.clone() },
                        ));
                    }
                }
                Some(there) => {
                    let status = status_of(recency, &field.id, &there.id);
                    let mut field_changes = Vec::new();
                    if there.label != field.label {
                        field_changes.push(change("Libellé", Some(there.label.clone()), Some(field.label.clone())));
                    }
                    if there.description != field.description {
                        field_changes.push(change("Description", there.description.clone(), field.description.clone()));
                    }
                    if !field_changes.is_empty() {
                        steps.push(step(
                            StepSpec {
                                id: format!("update_field:{}", field.lineage),
                                kind: "update_field",
                                table: tref.clone(),
                                field: fref.clone(),
                                summary: format!("Modifier le champ « {} »", there.label),
                                changes: field_changes,
                                status,
                                destructive: false,
                                depends_on: vec![],
                            },
                            Run::UpdateField { field: field.clone(), there: there.clone() },
                        ));
                    }
                    if field.options.is_some() && field.options != there.options {
                        steps.push(step(
                            StepSpec {
                                id: format!("set_options:{}", field.lineage),
                                kind: "set_options",
                                table: tref.clone(),
                                field: fref.clone(),
                                summary: format!("Mettre à jour les choix de « {} »", there.label),
                                changes: vec![change("Choix", options_text(&there.options), options_text(&field.options))],
                                status,
                                destructive: false,
                                depends_on: vec![],
                            },
                            Run::SetOptions { field: field.clone() },
                        ));
                    }
                    if there.required != field.required {
                        let yes_no = |b: bool| Some(if b { "oui" } else { "non" }.to_string());
                        steps.push(step(
                            StepSpec {
                                id: format!("set_required:{}", field.lineage),
                                kind: "set_required",
                                table: tref.clone(),
                                field: fref.clone(),
                                summary: if field.required { format!("Rendre « {} » obligatoire", there.label) } else { format!("Rendre « {} » facultatif", there.label) },
                                changes: vec![change("Obligatoire", yes_no(there.required), yes_no(field.required))],
                                status,
                                destructive: false,
                                depends_on: vec![],
                            },
                            Run::SetRequired { field: field.clone() },
                        ));
                    }
                    let target_of = |f: &StructureField| f.link.as_ref().map(|l| (l.target_lineage.clone(), l.on_delete.clone()));
                    if target_of(there) != target_of(field) {
                        notes.push(note(&table.label, Some(&field.label), "Cible ou comportement à la suppression différents : à reprendre à la main.".into()));
                    }
                    if field.ai.is_none() && there.ai.is_some() {
                        steps.push(step(
                            StepSpec {
                                id: format!("remove_ai:{}", field.lineage),
                                kind: "remove_ai",
                                table: tref.clone(),
                                field: fref.clone(),
                                summary: format!("Retirer l’IA de « {} »", there.label),
                                changes: vec![],
                                status,
                                destructive: false,
                                depends_on: vec![],
                            },
                            Run::RemoveAi { field: field.lineage.clone() },
                        ));
                    }
                }
            }

            if let Some(ai) = &field.ai {
                if there.is_none_or(|t| t.ai.as_ref() != Some(ai)) {
                    let needs = match there {
                        None => {
                            let mut n = deps.clone();
                            n.extend(add_id.clone());
                            n
                        }
                        Some(_) => vec![],
                    };
                    let recent = there.map_or("ready", |t| status_of(recency, &field.id, &t.id));
                    steps.push(step(
                        StepSpec {
                            id: format!("set_ai:{}", field.lineage),
                            kind: "set_ai",
                            table: tref.clone(),
                            field: fref.clone(),
                            summary: if there.is_none_or(|t| t.ai.is_none()) {
                                format!("Activer l’IA sur « {} »", field.label)
                            } else {
                                format!("Mettre à jour l’IA de « {} »", field.label)
                            },
                            changes: vec![change("Consigne", None, Some(NEUTRAL.replace_all(&ai.prompt, "…").into_owned()))],
                            status: if recent == "ready" { "needs_consent" } else { recent },
                            destructive: false,
                            depends_on: needs,
                        },
                        Run::SetAi { field: field.lineage.clone(), table: table.lineage.clone(), ai: ai.clone() },
                    ));
                }
            }
        }

        if let Some(other) = other {
            for f in &other.fields {
                if !table.fields.iter().any(|s| s.lineage == f.lineage) {
                    notes.push(note(&table.label, Some(&f.label), format!("Seulement dans « {} ».", names.1)));
                }
            }
        }

        // The display column, once the field it names exists.
        let target_display = other.and_then(|o| o.display_lineage.clone());
        if let Some(display_lineage) = table.display_lineage.clone().filter(|d| Some(d) != target_display.as_ref()) {
            let display_field = table.fields.iter().find(|f| f.lineage == display_lineage);
            let add_step = steps
                .iter()
                .find(|s| s.field.as_ref().is_some_and(|f| f.0 == display_lineage) && (s.kind == "add_field" || s.kind == "add_link"))
                .map(|s| s.id.clone());
            let mut depends_on = deps.clone();
            depends_on.extend(add_step);
            let from = other.and_then(|o| o.fields.iter().find(|f| Some(&f.lineage) == target_display.as_ref())).map(|f| f.label.clone());
            steps.push(step(
                StepSpec {
                    id: format!("set_display:{}", table.lineage),
                    kind: "set_display",
                    table: tref.clone(),
                    field: None,
                    summary: format!("Colonne d’affichage de « {} » : « {} »", table.label, display_field.map_or("?", |f| f.label.as_str())),
                    changes: vec![change("Colonne d’affichage", from, display_field.map(|f| f.label.clone()))],
                    status: other.map_or("ready", |o| status_of(recency, &table.id, &o.id)),
                    destructive: false,
                    depends_on,
                },
                Run::SetDisplay { table: table.lineage.clone(), display: display_lineage },
            ));
        }

        // The order of the columns, when it would not be the source's.
        let source_order: Vec<String> = table.fields.iter().filter(|f| f.kind != "formula").map(|f| f.lineage.clone()).collect();
        let adding: HashSet<String> = steps
            .iter()
            .filter(|s| s.table.0 == table.lineage && (s.kind == "add_field" || s.kind == "add_link"))
            .filter_map(|s| s.field.as_ref().map(|f| f.0.clone()))
            .collect();
        let predicted: Vec<String> = match other {
            None => source_order.iter().filter(|l| !adding.contains(*l)).chain(source_order.iter().filter(|l| adding.contains(*l))).cloned().collect(),
            Some(o) => o
                .fields
                .iter()
                .map(|f| f.lineage.clone())
                .filter(|l| source_order.contains(l))
                .chain(source_order.iter().filter(|l| adding.contains(*l)).cloned())
                .collect(),
        };
        let desired: Vec<String> = source_order.iter().filter(|l| predicted.contains(l)).cloned().collect();
        if desired != predicted {
            steps.push(step(
                StepSpec {
                    id: format!("reorder_fields:{}", table.lineage),
                    kind: "reorder_fields",
                    table: tref.clone(),
                    field: None,
                    summary: format!("Réordonner les champs de « {} »", table.label),
                    changes: vec![],
                    status: other.map_or("ready", |o| status_of(recency, &table.id, &o.id)),
                    destructive: false,
                    depends_on: deps.clone(),
                },
                Run::Reorder { table: table.lineage.clone(), order: source_order },
            ));
        }
    }

    for table in target {
        if !table.deleted && !source_lineages.contains(table.lineage.as_str()) {
            notes.push(note(&table.label, None, format!("Seulement dans « {} ».", names.1)));
        }
    }

    // Applied phase by phase; within a phase, in the source's order (a stable sort).
    steps.sort_by_key(|s| phase(s.kind));
    (steps, notes)
}

/// What `plan` loads: both sides, the target's structure, and the plan.
pub struct Planned {
    pub source: EnvironmentSummary,
    pub target: EnvironmentSummary,
    pub since: Option<DateTime<Utc>>,
    pub structure: Vec<StructureTable>,
    pub steps: Vec<PlanStep>,
    pub notes: Vec<PlanNote>,
}

async fn plan<E: Exec + Sync>(exec: &E, ctx: &RequestContext, source_id: &str, target_id: &str) -> R<Planned> {
    let (_family, source, target) = load_pair(exec, ctx, source_id, target_id).await?;
    require_on_base(exec, ctx, Action::ManageSchema, source_id).await?;
    require_on_base(exec, ctx, Action::ManageSchema, target_id).await?;
    let source_structure = load_structure(exec, source_id).await?;
    let target_structure = load_structure(exec, target_id).await?;
    let since = last_sync(exec, source_id, target_id).await?;
    let recency = Recency { source: last_changes(exec, source_id).await?, target: last_changes(exec, target_id).await?, since: since.map(millis) };
    let (steps, notes) = build_plan(&source_structure, &target_structure, &recency, (&source.environment, &target.environment));
    Ok(Planned { source, target, since, structure: target_structure, steps, notes })
}

/// Plans in a read-only snapshot — what `planStructure` and `applyStructure` share.
pub async fn load_plan(pools: &Pools, ctx: &RequestContext, source_id: &str, target_id: &str) -> R<Planned> {
    with_transaction(pools, PoolName::Catalog, ctx, snapshot_options(), |tx| async move { plan(&tx, ctx, source_id, target_id).await }).await
}

/// `planStructure`.
pub async fn plan_structure(pools: &Pools, ctx: &RequestContext, source_id: &str, target_id: &str) -> R<Value> {
    let p = load_plan(pools, ctx, source_id, target_id).await?;
    Ok(json!({
        "source": p.source.to_json(),
        "target": p.target.to_json(),
        "lastSync": p.since.map(iso),
        "steps": p.steps.iter().map(PlanStep::to_json).collect::<Vec<_>>(),
        "notes": p.notes.iter().map(PlanNote::to_json).collect::<Vec<_>>(),
    }))
}

/// The steps an apply would hand to the `ai` crate: `remove_ai`, and `set_ai` once
/// consented — the caller refuses the request when there is one and that crate is not
/// installed (`ai_hooks`).
pub fn needs_ai_crate(planned: &Planned, wanted: Option<&[String]>, consent: bool) -> bool {
    crate::ai_hooks::ai_hooks().is_none()
        && planned
            .steps
            .iter()
            .filter(|s| wanted.is_none_or(|w| w.contains(&s.id)))
            .any(|s| s.kind == "remove_ai" || (s.kind == "set_ai" && consent))
}

#[derive(Debug, Clone)]
struct TargetField {
    id: String,
    name: String,
    table: String,
}

struct ApplyState<'a> {
    pools: &'a Pools,
    ctx: &'a RequestContext,
    target_base_id: String,
    consent: bool,
    tables: HashMap<String, String>,
    fields: HashMap<String, TargetField>,
    created_tables: Vec<String>,
    created_fields: Vec<String>,
}

impl ApplyState<'_> {
    fn created_table(&mut self, lineage: &str) {
        if !self.created_tables.iter().any(|l| l == lineage) {
            self.created_tables.push(lineage.to_string());
        }
    }
    fn created_field(&mut self, lineage: &str) {
        if !self.created_fields.iter().any(|l| l == lineage) {
            self.created_fields.push(lineage.to_string());
        }
    }
}

enum StepError {
    Skipped(String),
    Failed(AppError),
}

impl From<AppError> for StepError {
    fn from(e: AppError) -> Self {
        StepError::Failed(e)
    }
}

fn skipped(note: &str) -> StepError {
    StepError::Skipped(note.to_string())
}

fn option_values(options: &[StructureOption]) -> Vec<Value> {
    options.iter().map(StructureOption::to_json).collect()
}

async fn run_step(state: &mut ApplyState<'_>, run: &Run) -> Result<Option<String>, StepError> {
    let (pools, ctx) = (state.pools, state.ctx);
    match run {
        Run::DeleteTable { lineage } => {
            let id = state.tables.get(lineage).cloned().ok_or_else(|| skipped(TABLE_GONE))?;
            let migration = deletion::delete_table(pools, ctx, &id).await?;
            if migration.status != "applied" {
                let code = migration.error_code.unwrap_or_default();
                let code = if basedb_contracts::error_codes::is_error_code(&code) { code } else { "INTERNAL_ERROR".into() };
                return Err(StepError::Failed(AppError::new(&code)));
            }
            Ok(None)
        }
        Run::CreateTable { table, simple } => {
            let fields: Vec<Value> = simple
                .iter()
                .map(|f| json!({ "label": f.label, "kind": f.kind, "required": f.required, "description": f.description, "lineageId": f.lineage }))
                .collect();
            let fields = Value::Array(fields);
            let description = json!(table.description);
            let done = operations::create_table_in_lineage(pools, ctx, &state.target_base_id, &table.label, Some(&description), Some(&fields), None, Some(&table.lineage)).await?;
            state.tables.insert(table.lineage.clone(), done.table_id.clone());
            state.created_table(&table.lineage);
            for (index, f) in done.fields.iter().enumerate() {
                let Some(lineage) = simple.get(index).map(|s| s.lineage.clone()) else { continue };
                state.fields.insert(lineage.clone(), TargetField { id: f.field_id.clone(), name: f.name.clone(), table: table.lineage.clone() });
                state.created_field(&lineage);
            }
            if table.color.is_some() || table.icon.is_some() || table.image.is_some() {
                let look = LookInput { color: Some(table.color.clone()), icon: Some(table.icon.clone()), image: Some(table.image.clone()) };
                operations::update_table(pools, ctx, &done.table_id, None, Some(&look)).await?;
            }
            Ok(None)
        }
        Run::UpdateTable { table, other } => {
            let id = state.tables.get(&table.lineage).cloned().ok_or_else(|| skipped(TABLE_GONE))?;
            let looks_differ = look(&other.color, &other.icon, &other.image) != look(&table.color, &table.icon, &table.image);
            if other.label != table.label || looks_differ {
                let look = LookInput { color: Some(table.color.clone()), icon: Some(table.icon.clone()), image: Some(table.image.clone()) };
                let label = (other.label != table.label).then_some(table.label.as_str());
                operations::update_table(pools, ctx, &id, label, Some(&look)).await?;
            }
            if other.description != table.description {
                operations::set_table_description(pools, ctx, &id, Some(&json!(table.description))).await?;
            }
            Ok(None)
        }
        Run::AddLink { table, field } => {
            let link = field.link.as_ref().ok_or_else(|| skipped(TABLE_GONE))?;
            let (Some(table_id), Some(target_table_id)) = (state.tables.get(table).cloned(), state.tables.get(&link.target_lineage).cloned()) else {
                return Err(skipped(TABLE_GONE));
            };
            let done = fields::create_link_field(
                pools,
                ctx,
                &CreateLinkRequest {
                    table_id,
                    target_table_id,
                    label: field.label.clone(),
                    description: Some(json!(field.description)),
                    required: Some(field.required),
                    on_delete: Some(link.on_delete.clone()),
                    multiple: field.kind == "multi_link",
                    technical_name: None,
                    lineage_id: Some(field.lineage.clone()),
                },
            )
            .await?;
            state.fields.insert(field.lineage.clone(), TargetField { id: done.field_id, name: done.name, table: table.clone() });
            state.created_field(&field.lineage);
            Ok(None)
        }
        Run::AddField { table, field } => {
            let table_id = state.tables.get(table).cloned().ok_or_else(|| skipped(TABLE_GONE))?;
            let done = fields::add_field(
                pools,
                ctx,
                &AddFieldRequest {
                    table_id,
                    label: field.label.clone(),
                    kind: field.kind.clone(),
                    description: Some(json!(field.description)),
                    options: field.options.as_deref().map(option_values),
                    rich: field.rich,
                    lineage_id: Some(field.lineage.clone()),
                    ..Default::default()
                },
            )
            .await?;
            state.fields.insert(field.lineage.clone(), TargetField { id: done.field_id.clone(), name: done.name, table: table.clone() });
            state.created_field(&field.lineage);
            if !field.required {
                return Ok(None);
            }
            match fields::set_field_required(pools, ctx, &done.field_id, true).await {
                Ok(_) => Ok(None),
                Err(_) => Ok(Some("Ajouté, mais laissé facultatif : des lignes de la cible sont vides.".into())),
            }
        }
        Run::UpdateField { field, there } => {
            let target = state.fields.get(&field.lineage).cloned().ok_or_else(|| skipped(FIELD_GONE))?;
            if there.label != field.label {
                operations::set_field_label(pools, ctx, &target.id, &field.label).await?;
            }
            if there.description != field.description {
                operations::set_field_description(pools, ctx, &target.id, Some(&json!(field.description))).await?;
            }
            Ok(None)
        }
        Run::SetOptions { field } => {
            let target = state.fields.get(&field.lineage).cloned().ok_or_else(|| skipped(FIELD_GONE))?;
            select_options::set_select_options(pools, ctx, &target.id, &option_values(field.options.as_deref().unwrap_or_default())).await?;
            Ok(None)
        }
        Run::SetRequired { field } => {
            let target = state.fields.get(&field.lineage).cloned().ok_or_else(|| skipped(FIELD_GONE))?;
            fields::set_field_required(pools, ctx, &target.id, field.required).await?;
            Ok(None)
        }
        Run::SetAi { field, table, ai } => {
            if !state.consent {
                return Err(skipped("Non appliquée : le consentement à l’envoi des valeurs manque."));
            }
            let target = state.fields.get(field).cloned().ok_or_else(|| skipped(FIELD_GONE))?;
            let names: HashMap<String, String> = state.fields.iter().filter(|(_, f)| &f.table == table).map(|(l, f)| (l.clone(), f.name.clone())).collect();
            let Some(prompt) = local_prompt(&ai.prompt, &names) else {
                return Err(skipped("Une colonne citée par la consigne manque dans la cible."));
            };
            let hooks = crate::ai_hooks::required()?;
            let input = json!({ "prompt": prompt, "refresh": { "mode": ai.mode, "cron": ai.cron, "timezone": ai.timezone }, "consent": true });
            (hooks.set)(state.pools.clone(), state.ctx.clone(), target.id, input).await?;
            Ok(None)
        }
        Run::RemoveAi { field } => {
            let target = state.fields.get(field).cloned().ok_or_else(|| skipped(FIELD_GONE))?;
            let hooks = crate::ai_hooks::required()?;
            (hooks.disable)(state.pools.clone(), state.ctx.clone(), target.id).await?;
            Ok(None)
        }
        Run::SetDisplay { table, display } => {
            let (Some(table_id), Some(target)) = (state.tables.get(table).cloned(), state.fields.get(display).cloned()) else {
                return Err(skipped(FIELD_GONE));
            };
            fields::set_display_column(pools, ctx, &table_id, Some(&target.id)).await?;
            Ok(None)
        }
        Run::Reorder { table, order } => {
            let table_id = state.tables.get(table).cloned().ok_or_else(|| skipped(TABLE_GONE))?;
            let names: Vec<String> = order.iter().filter_map(|l| state.fields.get(l)).filter(|f| &f.table == table).map(|f| f.name.clone()).collect();
            if !names.is_empty() {
                operations::reorder_fields(pools, ctx, &table_id, &names).await?;
            }
            Ok(None)
        }
    }
}

/// `applyStructure`: runs the chosen steps of a FRESH plan (`None` — every step), then
/// mirrors the grants of what it created and records the synchronization.
pub async fn apply_planned(pools: &Pools, ctx: &RequestContext, planned: Planned, wanted: Option<&[String]>, consent: bool, fork: bool) -> R<Value> {
    let Planned { source, target, structure, steps, .. } = planned;
    let mut state = ApplyState {
        pools,
        ctx,
        target_base_id: target.id.clone(),
        consent,
        tables: structure.iter().filter(|t| !t.deleted).map(|t| (t.lineage.clone(), t.id.clone())).collect(),
        fields: structure
            .iter()
            .filter(|t| !t.deleted)
            .flat_map(|t| t.fields.iter().map(|f| (f.lineage.clone(), TargetField { id: f.id.clone(), name: f.name.clone(), table: t.lineage.clone() })))
            .collect(),
        created_tables: Vec::new(),
        created_fields: Vec::new(),
    };
    // `new Set(request.steps)`: the order of first appearance, without repeats.
    let wanted: Option<Vec<String>> = wanted.map(|w| {
        let mut seen = HashSet::new();
        w.iter().filter(|id| seen.insert(id.as_str())).cloned().collect()
    });
    let mut done: HashSet<String> = HashSet::new();
    let mut results: Vec<Value> = Vec::new();
    let result = |s: &PlanStep, outcome: &str, code: Option<&str>, note: Option<&str>| {
        let mut m = Map::new();
        m.insert("id".into(), json!(s.id));
        m.insert("kind".into(), json!(s.kind));
        m.insert("summary".into(), json!(s.summary));
        m.insert("outcome".into(), json!(outcome));
        if let Some(c) = code {
            m.insert("code".into(), json!(c));
        }
        if let Some(n) = note {
            m.insert("note".into(), json!(n));
        }
        Value::Object(m)
    };
    for s in &steps {
        if wanted.as_ref().is_some_and(|w| !w.contains(&s.id)) {
            continue;
        }
        if s.depends_on.iter().any(|d| !done.contains(d)) {
            results.push(result(s, "skipped", None, Some("Dépend d’une étape non appliquée.")));
            continue;
        }
        match run_step(&mut state, &s.run).await {
            Ok(note) => {
                done.insert(s.id.clone());
                results.push(result(s, "applied", None, note.as_deref()));
            }
            Err(StepError::Skipped(note)) => results.push(result(s, "skipped", None, Some(&note))),
            Err(StepError::Failed(e)) => results.push(result(s, "failed", Some(e.code), None)),
        }
    }
    if let Some(wanted) = &wanted {
        for id in wanted {
            if steps.iter().any(|s| &s.id == id) {
                continue;
            }
            let kind = id.split(':').next().unwrap_or("update_table");
            results.push(json!({
                "id": id,
                "kind": kind,
                "summary": "Étape qui n’existe plus : la structure a changé depuis.",
                "outcome": "skipped",
            }));
        }
    }
    let count = |o: &str| results.iter().filter(|r| r["outcome"] == o).count();
    let (applied, failed, skipped_n) = (count("applied"), count("failed"), count("skipped"));

    let summary = json!({ "applied": applied, "failed": failed, "skipped": skipped_n }).to_string();
    let (created_tables, created_fields) = (&state.created_tables, &state.created_fields);
    let (source_id, target_id, summary) = (&source.id, &target.id, &summary);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        if !created_tables.is_empty() {
            tx.execute_op(
                "INSERT INTO _basedb.permission (role_id, scope_kind, scope_table_id, action, granted_by)
                 SELECT p.role_id, 'table', tt.id, p.action, $4::text::uuid
                   FROM _basedb.permission p
                   JOIN _basedb.table_def st ON st.id = p.scope_table_id AND st.base_id = $1::text::uuid
                   JOIN _basedb.table_def tt ON tt.base_id = $2::text::uuid AND tt.lineage_id = st.lineage_id
                                            AND tt.deleted_at IS NULL
                  WHERE p.scope_kind = 'table' AND st.lineage_id = ANY($3::text[]::uuid[])
                 ON CONFLICT DO NOTHING",
                &[source_id, target_id, created_tables, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        }
        if !created_fields.is_empty() {
            tx.execute_op(
                "INSERT INTO _basedb.field_permission (role_id, field_id, access)
                 SELECT fp.role_id, tf.id, fp.access
                   FROM _basedb.field_permission fp
                   JOIN _basedb.field sf     ON sf.id = fp.field_id AND sf.base_id = $1::text::uuid
                   JOIN _basedb.table_def st ON st.id = sf.table_id
                   JOIN _basedb.table_def tt ON tt.base_id = $2::text::uuid AND tt.lineage_id = st.lineage_id
                   JOIN _basedb.field tf     ON tf.table_id = tt.id AND tf.lineage_id = sf.lineage_id
                                            AND tf.deleted_at IS NULL
                  WHERE sf.lineage_id = ANY($3::text[]::uuid[])
                 ON CONFLICT DO NOTHING",
                &[source_id, target_id, created_fields],
                SqlOp::Insert,
            )
            .await?;
        }
        tx.execute_op(
            "INSERT INTO _basedb.environment_sync
               (lineage_id, source_base_id, target_base_id, kind, synced_by, summary)
             SELECT b.lineage_id, $1::text::uuid, $2::text::uuid, $3, $4::text::uuid, $5::text::jsonb
               FROM _basedb.base b WHERE b.id = $1::text::uuid",
            &[source_id, target_id, &if fork { "fork" } else { "structure" }, &ctx.actor.id, summary],
            SqlOp::Insert,
        )
        .await?;
        Ok(())
    })
    .await?;

    Ok(json!({
        "source": source.to_json(),
        "target": target.to_json(),
        "results": results,
        "applied": applied,
        "failed": failed,
        "skipped": skipped_n,
    }))
}

/// Whether the environment a creation would copy has an AI field — what the `ai` crate
/// would be asked to carry over once consented (the caller refuses without that crate).
pub async fn source_has_ai(pools: &Pools, ctx: &RequestContext, base_id: &str, source_id: Option<&str>) -> R<bool> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let family = load_family(&tx, ctx, base_id).await?;
        let source = match source_id {
            None => family.environments.iter().find(|e| e.production).or(family.environments.first()),
            Some(id) => family.environments.iter().find(|e| e.id == id),
        };
        let Some(source) = source else { return Ok(false) };
        let row = tx
            .first(
                "SELECT EXISTS (
                   SELECT 1 FROM _basedb.field_ai_config a
                     JOIN _basedb.field f     ON f.id = a.field_id
                     JOIN _basedb.table_def t ON t.id = f.table_id
                    WHERE f.base_id = $1::text::uuid AND f.deleted_at IS NULL AND t.deleted_at IS NULL)",
                &[&source.id],
            )
            .await?;
        Ok(row.is_some_and(|r| r.get::<_, bool>(0)))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field(lineage: &str, label: &str, kind: &str) -> StructureField {
        StructureField {
            id: format!("id-{lineage}"),
            lineage: lineage.into(),
            name: label.to_lowercase(),
            label: label.into(),
            kind: kind.into(),
            description: None,
            required: false,
            position: 1,
            rich: false,
            options: None,
            link: None,
            ai: None,
        }
    }

    fn table(lineage: &str, label: &str, fields: Vec<StructureField>) -> StructureTable {
        StructureTable {
            id: format!("id-{lineage}"),
            lineage: lineage.into(),
            name: label.to_lowercase(),
            label: label.into(),
            description: None,
            color: None,
            icon: None,
            image: None,
            position: 1,
            deleted: false,
            display_lineage: None,
            fields,
        }
    }

    #[test]
    fn a_new_table_is_created_then_completed_phase_by_phase() {
        let mut status = field("f2", "Statut", "select");
        status.options = Some(vec![StructureOption { value: "a".into(), label: "A".into(), color: None, icon: None, image: None }]);
        let mut client = field("f3", "Client", "link");
        client.link = Some(StructureLink { target_lineage: "t0".into(), target_label: "Clients".into(), on_delete: "restrict".into() });
        let mut t = table("t1", "Commandes", vec![field("f1", "Nom", "short_text"), status, client, field("f4", "Total", "formula")]);
        t.display_lineage = Some("f2".into());
        let (steps, notes) = build_plan(&[t], &[], &Recency::default(), ("Production", "Recette"));
        let ids: Vec<&str> = steps.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, ["create_table:t1", "add_field:f2", "add_link:f3", "set_display:t1"]);
        assert_eq!(steps[2].depends_on, ["create_table:t1", "create_table:t0"]);
        assert_eq!(steps[3].depends_on, ["create_table:t1", "add_field:f2"]);
        assert_eq!(steps[0].changes[0].to.as_deref(), Some("Nom, Statut, Client, Total"));
        assert_eq!(notes, [note("Commandes", Some("Total"), "Formule : elle ne se recopie pas encore d’un environnement à l’autre.".into())]);
    }

    #[test]
    fn a_newer_target_change_is_proposed_but_not_selected() {
        let source = table("t1", "Clients", vec![field("f1", "Nom", "short_text")]);
        let mut target = source.clone();
        target.id = "other".into();
        target.label = "Comptes".into();
        let recency = Recency { source: HashMap::from([("id-t1".into(), 10)]), target: HashMap::from([("other".into(), 20)]), since: None };
        let (steps, _) = build_plan(std::slice::from_ref(&source), std::slice::from_ref(&target), &recency, ("P", "R"));
        assert_eq!((steps[0].kind, steps[0].status, steps[0].selected), ("update_table", "target_newer", false));
        let recency = Recency { since: Some(5), ..recency };
        let (steps, _) = build_plan(&[source], &[target], &recency, ("P", "R"));
        assert_eq!(steps[0].status, "conflict");
    }

    #[test]
    fn fields_added_to_an_existing_table_land_at_its_end() {
        let source = table("t1", "Clients", vec![field("f2", "Code", "number"), field("f1", "Nom", "short_text")]);
        let target = table("t1", "Clients", vec![field("f1", "Nom", "short_text")]);
        let (steps, _) = build_plan(&[source], &[target], &Recency::default(), ("P", "R"));
        let ids: Vec<&str> = steps.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, ["add_field:f2", "reorder_fields:t1"]);
    }

    #[test]
    fn prompts_cite_columns_by_lineage() {
        let names = HashMap::from([("nom".to_string(), "0190a0a0-0000-7000-8000-000000000001".to_string())]);
        assert_eq!(neutral_prompt("Résume {{ nom }} et {{autre}}", &names), "Résume {{@0190a0a0-0000-7000-8000-000000000001}} et {{autre}}");
        assert_eq!(NEUTRAL.replace_all("a {{@0190a0a0-0000-7000-8000-000000000001}} b", "…"), "a … b");
    }
}
