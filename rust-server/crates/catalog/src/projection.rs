//! The catalog projection (`catalog/projection.ts`): the catalog as one actor may see it.
//!
//! One read of the catalog per tenant and per pair of counters ([`crate::cache`]), one
//! decision per table and action, and the same tree serves `/meta`, OpenAPI, the
//! documentation, and every resolver of a base, a table or a field.

use crate::cache::{read_versions, CatalogVersions, CATALOG_CACHE, GRANTS_CACHE};
use crate::description::system_column_description;
use crate::formula::{render_formula, FormulaDialect, Node};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Target, TargetKind, Verdict, SYSTEM_COLUMNS};
use basedb_base::rbac::loader::{load_grants, COMPUTED_KINDS};
use basedb_base::rbac::rows::compile_row_rules;
use basedb_base::tx::{with_transaction, Isolation, RequestContext, TxOptions};
use basedb_contracts::naming::quote::qualify;
use indexmap::IndexSet;
use regex::Regex;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock, Mutex};
use tokio_postgres::Row;
use unicode_normalization::UnicodeNormalization;

// ------------------------------------------------------------------------------------
// The catalog as read

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectRow {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub position: i64,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BaseRow {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    /// The base's NAME: its current schema.
    pub schema_name: String,
    pub mcp_enabled: bool,
    pub catalog_version: String,
    pub project_id: String,
    pub lineage_id: String,
    pub environment: String,
    pub is_production: bool,
    pub environment_position: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TableRow {
    pub id: String,
    pub base_id: String,
    pub label: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    pub table_name: String,
    pub schema_name: String,
    pub display_field_id: Option<String>,
    pub synced: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FieldRow {
    pub id: String,
    pub table_id: String,
    pub label: String,
    pub description: Option<String>,
    pub kind: String,
    pub is_required: bool,
    /// The physical column name.
    pub column: String,
    pub is_rich: bool,
    pub expose_to_agents: bool,
    pub max_length: Option<i64>,
    pub formula_expression: Option<String>,
    pub formula_result_kind: Option<String>,
    pub formula_is_stored: Option<bool>,
    pub has_ai: bool,
    pub number_format: Option<String>,
    pub currency_code: Option<String>,
    pub rating_max: Option<i64>,
    pub text_format: Option<String>,
    pub formula_ast: Option<Value>,
    pub formula_timezone: Option<String>,
    pub formula_deps: Option<Vec<String>>,
    pub rollup_direction: Option<String>,
    pub rollup_via_id: Option<String>,
    pub rollup_target_id: Option<String>,
    pub rollup_aggregate: Option<String>,
    pub rollup_result_kind: Option<String>,
    pub rollup_multiple: Option<bool>,
    pub button_label: Option<String>,
    pub button_color: Option<String>,
    pub button_action: Option<String>,
    pub button_url: Option<String>,
    pub button_automation: Option<String>,
    /// Only when the default still holds (`DEFAULT_STILL_VALID`).
    pub default_kind: Option<String>,
    pub default_value: Option<Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectedOption {
    pub value: String,
    pub label: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
}

impl ProjectedOption {
    pub fn to_json(&self) -> Value {
        json!({ "value": self.value, "label": self.label, "color": self.color, "icon": self.icon, "image": self.image })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct LinkRow {
    pub field_id: String,
    pub target_table_id: String,
    pub on_delete: String,
    pub fk_constraint: Option<String>,
    pub fk_index: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ApplicationRow {
    pub id: String,
    pub base_id: String,
    pub name: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct RawCatalog {
    pub projects: Vec<ProjectRow>,
    pub bases: Vec<BaseRow>,
    pub tables: Vec<TableRow>,
    pub fields: Vec<FieldRow>,
    pub links: Vec<LinkRow>,
    /// field id → its live options, in position order.
    pub options: HashMap<String, Vec<ProjectedOption>>,
    /// table id → the applications it belongs to.
    pub applications: HashMap<String, Vec<String>>,
    pub application_rows: Vec<ApplicationRow>,
    /// field id → the single-column unique constraint on it.
    pub unique: HashMap<String, String>,
    /// formula field id → the fields it reads.
    pub formula_sources: HashMap<String, Vec<String>>,
    /// table id → `(role id, filter)`.
    pub row_rules: HashMap<String, Vec<(String, String)>>,
}

/// `DEFAULT_STILL_VALID` (`records/defaults.ts`): a default whose options are gone, or on a
/// field an AI now fills, no longer applies.
pub const DEFAULT_STILL_VALID: &str = "(fd.kind <> 'value' OR f.kind NOT IN ('select','multi_select') OR NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(
         CASE jsonb_typeof(fd.value) WHEN 'array' THEN fd.value ELSE jsonb_build_array(fd.value) END
       ) AS v(value)
        WHERE NOT EXISTS (SELECT 1 FROM _basedb.select_option o
                           WHERE o.field_id = f.id AND o.deleted_at IS NULL AND o.value = v.value)))
     AND NOT EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id)";

fn base_row(r: &Row) -> BaseRow {
    BaseRow {
        id: r.get(0),
        label: r.get(1),
        description: r.get(2),
        color: r.get(3),
        icon: r.get(4),
        image: r.get(5),
        schema_name: r.get(6),
        mcp_enabled: r.get(7),
        catalog_version: r.get(8),
        project_id: r.get(9),
        lineage_id: r.get(10),
        environment: r.get(11),
        is_production: r.get(12),
        environment_position: r.get(13),
    }
}

/// The columns of [`BaseRow`], for a caller that reads one base (`b`, `sn` aliases).
pub const BASE_COLUMNS: &str = "b.id::text, b.label, b.description, b.color, b.icon, b.image, sn.name AS schema_name,
            b.mcp_enabled, b.catalog_version::text, b.project_id::text,
            b.lineage_id::text, b.environment, b.is_production, b.environment_position::int8";

/// `loadCatalog`: ten reads, all scoped to the tenant.
async fn load_catalog<E: Exec + Sync>(exec: &E, tenant: &str) -> Result<RawCatalog, AppError> {
    let t = [&tenant as &(dyn tokio_postgres::types::ToSql + Sync)];
    let projects = exec
        .rows(
            "SELECT p.id::text, p.label, p.description, p.position::int8, p.color, p.icon, p.image
               FROM _basedb.project p
               JOIN _basedb.tenant t ON t.id = p.tenant_id
              WHERE t.ref = $1 AND p.deleted_at IS NULL
              ORDER BY p.position, p.label",
            &t,
        )
        .await?
        .iter()
        .map(|r| ProjectRow { id: r.get(0), label: r.get(1), description: r.get(2), position: r.get(3), color: r.get(4), icon: r.get(5), image: r.get(6) })
        .collect();

    let bases = exec
        .rows(
            &format!(
                "SELECT {BASE_COLUMNS}
                   FROM _basedb.base b
                   JOIN _basedb.tenant t         ON t.id = b.tenant_id
                   JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current'
                                                AND s.dropped_at IS NULL
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                  WHERE t.ref = $1 AND b.is_live AND b.deleted_at IS NULL
                  ORDER BY b.label, NOT b.is_production, b.environment_position, b.environment"
            ),
            &t,
        )
        .await?
        .iter()
        .map(base_row)
        .collect();

    let tables = exec
        .rows(
            "SELECT t.id::text, t.base_id::text, t.label, t.description, t.color, t.icon, t.image,
                    tn.name AS table_name, sn.name AS schema_name, t.display_field_id::text,
                    EXISTS (SELECT 1 FROM _basedb.table_sync ts WHERE ts.table_id = t.id) AS synced
               FROM _basedb.table_def t
               JOIN _basedb.base b           ON b.id = t.base_id
               JOIN _basedb.tenant te        ON te.id = b.tenant_id
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE te.ref = $1 AND t.is_live AND t.deleted_at IS NULL
                AND b.is_live AND b.deleted_at IS NULL
              ORDER BY t.position, t.label",
            &t,
        )
        .await?
        .iter()
        .map(|r| TableRow {
            id: r.get(0),
            base_id: r.get(1),
            label: r.get(2),
            description: r.get(3),
            color: r.get(4),
            icon: r.get(5),
            image: r.get(6),
            table_name: r.get(7),
            schema_name: r.get(8),
            display_field_id: r.get(9),
            synced: r.get(10),
        })
        .collect();

    let fields = exec
        .rows(
            &format!(
                "SELECT f.id::text, f.table_id::text, f.label, f.description, f.kind, f.is_required, n.name AS column,
                        coalesce(tc.is_rich, false) AS is_rich, f.expose_to_agents, tc.max_length::int8,
                        fc.input_expression AS formula_expression, fc.result_kind AS formula_result_kind,
                        fc.is_stored AS formula_is_stored,
                        EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai,
                        nc.display_format AS number_format, nc.currency_code, nc.rating_max::int8,
                        tc.display_format AS text_format,
                        fc.ast AS formula_ast, fc.timezone AS formula_timezone,
                        CASE WHEN fc.field_id IS NULL THEN NULL ELSE ARRAY(
                          SELECT d.depends_on_field_id::text FROM _basedb.field_formula_dependency d
                           WHERE d.formula_field_id = f.id) END AS formula_deps,
                        rc.direction AS rollup_direction, rc.via_field_id::text AS rollup_via_id,
                        rc.target_field_id::text AS rollup_target_id, rc.aggregate AS rollup_aggregate,
                        rc.result_kind AS rollup_result_kind, rc.is_multiple AS rollup_multiple,
                        bc.label AS button_label, bc.color AS button_color, bc.action AS button_action,
                        bc.url_template AS button_url, bc.automation_id::text AS button_automation,
                        CASE WHEN fd.field_id IS NOT NULL AND {DEFAULT_STILL_VALID} THEN fd.kind END
                          AS default_kind,
                        fd.value AS default_value
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n ON n.id = f.name_id
                   LEFT JOIN _basedb.field_text_config tc    ON tc.field_id = f.id
                   LEFT JOIN _basedb.field_number_config nc  ON nc.field_id = f.id
                   LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
                   LEFT JOIN _basedb.field_rollup_config rc  ON rc.field_id = f.id
                   LEFT JOIN _basedb.field_button_config bc  ON bc.field_id = f.id
                   LEFT JOIN _basedb.field_default fd        ON fd.field_id = f.id
                   JOIN _basedb.table_def t     ON t.id = f.table_id
                   JOIN _basedb.base b          ON b.id = t.base_id
                   JOIN _basedb.tenant te       ON te.id = b.tenant_id
                  WHERE te.ref = $1 AND f.is_live AND f.deleted_at IS NULL AND t.is_live
                  ORDER BY f.position, f.label"
            ),
            &t,
        )
        .await?
        .iter()
        .map(|r| FieldRow {
            id: r.get(0),
            table_id: r.get(1),
            label: r.get(2),
            description: r.get(3),
            kind: r.get(4),
            is_required: r.get(5),
            column: r.get(6),
            is_rich: r.get(7),
            expose_to_agents: r.get(8),
            max_length: r.get(9),
            formula_expression: r.get(10),
            formula_result_kind: r.get(11),
            formula_is_stored: r.get(12),
            has_ai: r.get(13),
            number_format: r.get(14),
            currency_code: r.get(15),
            rating_max: r.get(16),
            text_format: r.get(17),
            formula_ast: r.get(18),
            formula_timezone: r.get(19),
            formula_deps: r.get(20),
            rollup_direction: r.get(21),
            rollup_via_id: r.get(22),
            rollup_target_id: r.get(23),
            rollup_aggregate: r.get(24),
            rollup_result_kind: r.get(25),
            rollup_multiple: r.get(26),
            button_label: r.get(27),
            button_color: r.get(28),
            button_action: r.get(29),
            button_url: r.get(30),
            button_automation: r.get(31),
            default_kind: r.get(32),
            default_value: r.get(33),
        })
        .collect();

    let links = exec
        .rows(
            "SELECT lc.field_id::text, lc.target_table_id::text, lc.on_delete,
                    cn.name AS fk_constraint, xn.name AS fk_index
               FROM _basedb.field_link_config lc
               JOIN _basedb.field f     ON f.id = lc.field_id
               JOIN _basedb.table_def t ON t.id = f.table_id
               JOIN _basedb.base b      ON b.id = t.base_id
               JOIN _basedb.tenant te   ON te.id = b.tenant_id
               LEFT JOIN _basedb.table_constraint c ON c.id = lc.fk_constraint_id
               LEFT JOIN _basedb.physical_name cn   ON cn.id = c.name_id
               JOIN _basedb.table_index x      ON x.id = lc.fk_index_id
               JOIN _basedb.physical_name xn   ON xn.id = x.name_id
              WHERE te.ref = $1 AND lc.fk_dropped_at IS NULL AND f.is_live AND t.is_live",
            &t,
        )
        .await?
        .iter()
        .map(|r| LinkRow { field_id: r.get(0), target_table_id: r.get(1), on_delete: r.get(2), fk_constraint: r.get(3), fk_index: r.get(4) })
        .collect();

    let unique = exec
        .rows(
            "SELECT min(m.field_id::text) AS field_id, min(cn.name) AS name
               FROM _basedb.table_constraint c
               JOIN _basedb.physical_name cn          ON cn.id = c.name_id
               JOIN _basedb.table_constraint_member m ON m.constraint_id = c.id
               JOIN _basedb.table_def t ON t.id = c.table_id
               JOIN _basedb.base b      ON b.id = t.base_id
               JOIN _basedb.tenant te   ON te.id = b.tenant_id
              WHERE te.ref = $1 AND c.kind = 'unique' AND c.dropped_at IS NULL AND c.state = 'active'
                AND t.is_live
              GROUP BY c.id
             HAVING count(*) = 1",
            &t,
        )
        .await?
        .iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect();

    let mut formula_sources: HashMap<String, Vec<String>> = HashMap::new();
    for r in exec
        .rows(
            "SELECT d.formula_field_id::text, d.depends_on_field_id::text AS field_id
               FROM _basedb.field_formula_dependency d
               JOIN _basedb.table_def t ON t.id = d.table_id
               JOIN _basedb.base b      ON b.id = t.base_id
               JOIN _basedb.tenant te   ON te.id = b.tenant_id
              WHERE te.ref = $1 AND NOT d.formula_is_purged AND NOT d.depends_on_is_purged",
            &t,
        )
        .await?
    {
        formula_sources.entry(r.get(0)).or_default().push(r.get(1));
    }

    let application_rows = exec
        .rows(
            "SELECT a.id::text, a.base_id::text, a.name, a.label
               FROM _basedb.application a
               JOIN _basedb.base b    ON b.id = a.base_id
               JOIN _basedb.tenant te ON te.id = b.tenant_id
              WHERE te.ref = $1 AND a.deleted_at IS NULL
              ORDER BY a.position, a.label",
            &t,
        )
        .await?
        .iter()
        .map(|r| ApplicationRow { id: r.get(0), base_id: r.get(1), name: r.get(2), label: r.get(3) })
        .collect();

    let mut options: HashMap<String, Vec<ProjectedOption>> = HashMap::new();
    for r in exec
        .rows(
            "SELECT o.field_id::text, o.value, o.label, o.color, o.icon, o.image
               FROM _basedb.select_option o
               JOIN _basedb.field f     ON f.id = o.field_id
               JOIN _basedb.table_def t ON t.id = f.table_id
               JOIN _basedb.base b      ON b.id = t.base_id
               JOIN _basedb.tenant te   ON te.id = b.tenant_id
              WHERE te.ref = $1 AND o.deleted_at IS NULL AND f.is_live AND t.is_live
              ORDER BY o.position",
            &t,
        )
        .await?
    {
        options
            .entry(r.get(0))
            .or_default()
            .push(ProjectedOption { value: r.get(1), label: r.get(2), color: r.get(3), icon: r.get(4), image: r.get(5) });
    }

    let mut applications: HashMap<String, Vec<String>> = HashMap::new();
    for r in exec
        .rows(
            "SELECT appt.table_id::text, appt.application_id::text
               FROM _basedb.application_table appt
               JOIN _basedb.table_def t ON t.id = appt.table_id
               JOIN _basedb.base b      ON b.id = t.base_id
               JOIN _basedb.tenant te   ON te.id = b.tenant_id
              WHERE te.ref = $1 AND t.is_live",
            &t,
        )
        .await?
    {
        applications.entry(r.get(0)).or_default().push(r.get(1));
    }

    let mut row_rules: HashMap<String, Vec<(String, String)>> = HashMap::new();
    for r in exec
        .rows(
            "SELECT rp.table_id::text, rp.role_id::text, rp.filter
               FROM _basedb.row_permission rp
               JOIN _basedb.role r    ON r.id = rp.role_id
               JOIN _basedb.tenant te ON te.id = r.tenant_id
              WHERE te.ref = $1",
            &t,
        )
        .await?
    {
        row_rules.entry(r.get(0)).or_default().push((r.get(1), r.get(2)));
    }

    Ok(RawCatalog { projects, bases, tables, fields, links, options, applications, application_rows, unique, formula_sources, row_rules })
}

// ------------------------------------------------------------------------------------
// The projected tree

#[derive(Debug, Clone, PartialEq)]
pub struct LinkTarget {
    pub table: String,
    pub display_field: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectedLink {
    pub on_delete: String,
    pub required: bool,
    /// Absent when the target table is not readable: the link is masked.
    pub target: Option<LinkTarget>,
    pub expandable: bool,
    pub masked: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FieldFormat {
    pub display: String,
    pub currency: Option<String>,
    pub rating_max: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectedButton {
    pub label: String,
    pub color: Option<String>,
    pub action: String,
    pub url: Option<String>,
    pub automation: Option<String>,
}

impl ProjectedButton {
    pub fn to_json(&self) -> Value {
        json!({ "label": self.label, "color": self.color, "action": self.action, "url": self.url, "automation": self.automation })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ComputedVia {
    pub field: String,
    pub table: String,
    pub direction: String,
    pub reached: String,
}

impl ComputedVia {
    pub fn to_json(&self) -> Value {
        json!({ "field": self.field, "table": self.table, "direction": self.direction, "reached": self.reached })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectedComputed {
    pub result_kind: String,
    pub stored: bool,
    pub multiple: bool,
    /// A formula's text, in the reader's dialect; with its time zone.
    pub expression: Option<String>,
    pub timezone: Option<String>,
    /// A lookup's or a rollup's path; with its target and aggregate.
    pub via: Option<ComputedVia>,
    pub target: Option<String>,
    pub aggregate: Option<String>,
}

/// `FieldDefault`: `{kind:'value', value}` or `{kind}`.
#[derive(Debug, Clone, PartialEq)]
pub struct FieldDefault {
    pub kind: String,
    pub value: Option<Value>,
}

impl FieldDefault {
    pub fn to_json(&self) -> Value {
        if self.kind == "value" {
            json!({ "kind": "value", "value": self.value.clone().unwrap_or(Value::Null) })
        } else {
            json!({ "kind": self.kind })
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectedField {
    pub name: String,
    pub label: String,
    pub description: Option<String>,
    pub kind: String,
    pub required: bool,
    pub unique: bool,
    pub read_only: bool,
    pub system: bool,
    pub unsafe_html: bool,
    pub options: Option<Vec<ProjectedOption>>,
    pub link: Option<ProjectedLink>,
    pub format: Option<FieldFormat>,
    pub hidden_from_agents: bool,
    pub ai: bool,
    pub computed: Option<ProjectedComputed>,
    pub button: Option<ProjectedButton>,
    pub default: Option<FieldDefault>,
}

impl ProjectedField {
    /// `effectiveKind`: what a computed field reads as.
    pub fn effective_kind(&self) -> &str {
        match &self.computed {
            None => &self.kind,
            Some(c) if c.multiple => "lookup",
            Some(c) => &c.result_kind,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectedTable {
    pub id: String,
    pub name: String,
    pub label: String,
    pub description: Option<String>,
    /// `"schema"."table"`.
    pub sql: String,
    pub actions: Vec<Action>,
    pub fields: Vec<ProjectedField>,
    pub referenced_by: bool,
    pub display_field: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    pub synced: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectRef {
    pub id: String,
    pub label: String,
}

impl ProjectRef {
    pub fn to_json(&self) -> Value {
        json!({ "id": self.id, "label": self.label })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct BaseEnvironment {
    pub lineage: String,
    pub label: String,
    pub production: bool,
    pub position: i64,
}

impl BaseEnvironment {
    pub fn to_json(&self) -> Value {
        json!({ "lineage": self.lineage, "label": self.label, "production": self.production, "position": self.position })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectedBase {
    pub id: String,
    pub name: String,
    pub label: String,
    pub description: Option<String>,
    pub project: ProjectRef,
    pub base_actions: Vec<Action>,
    pub agents_enabled: bool,
    pub tables: Vec<ProjectedTable>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    pub environment: BaseEnvironment,
}

/// `VisibleBase`: a base as a listing shows it.
#[derive(Debug, Clone, PartialEq)]
pub struct VisibleBase {
    pub id: String,
    pub name: String,
    pub label: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    pub project: ProjectRef,
    pub environment: BaseEnvironment,
    pub table_count: usize,
}

impl VisibleBase {
    pub fn of(b: &ProjectedBase) -> VisibleBase {
        VisibleBase {
            id: b.id.clone(),
            name: b.name.clone(),
            label: b.label.clone(),
            description: b.description.clone(),
            color: b.color.clone(),
            icon: b.icon.clone(),
            image: b.image.clone(),
            project: b.project.clone(),
            environment: b.environment.clone(),
            table_count: b.tables.len(),
        }
    }
}

/// The actions a base answers for, in this order.
pub const BASE_ACTIONS: [Action; 6] = [Action::Read, Action::Create, Action::Update, Action::Delete, Action::ManageSchema, Action::ManageTokens];
const DATA_ACTIONS: [Action; 4] = [Action::Read, Action::Create, Action::Update, Action::Delete];

/// `baseTargetOf`.
pub fn base_target_of(ctx: &RequestContext, base: &BaseRow) -> Target {
    let mut t = Target::new(TargetKind::Base, base.id.clone(), Some(ctx.tenant_id.clone()));
    t.project_id = Some(base.project_id.clone());
    t.base_id = Some(base.id.clone());
    t.agents_excluded = !base.mcp_enabled;
    t
}

/// `fieldsByTableOf`.
pub fn fields_by_table_of(raw: &RawCatalog) -> HashMap<&str, Vec<&FieldRow>> {
    let mut out: HashMap<&str, Vec<&FieldRow>> = HashMap::new();
    for f in &raw.fields {
        out.entry(f.table_id.as_str()).or_default().push(f);
    }
    out
}

/// `targetFactory`: a table as a decision target, from the snapshot alone.
pub struct TargetFactory<'a> {
    tenant: String,
    raw: &'a RawCatalog,
    fields_by_table: HashMap<&'a str, Vec<&'a FieldRow>>,
    agents_excluded: HashSet<&'a str>,
    project_of: HashMap<&'a str, &'a str>,
    compiled: Mutex<HashMap<String, HashMap<String, String>>>,
}

impl<'a> TargetFactory<'a> {
    pub fn new(ctx: &RequestContext, raw: &'a RawCatalog) -> Self {
        TargetFactory {
            tenant: ctx.tenant_id.clone(),
            raw,
            fields_by_table: fields_by_table_of(raw),
            agents_excluded: raw.bases.iter().filter(|b| !b.mcp_enabled).map(|b| b.id.as_str()).collect(),
            project_of: raw.bases.iter().map(|b| (b.id.as_str(), b.project_id.as_str())).collect(),
            compiled: Mutex::new(HashMap::new()),
        }
    }

    pub fn fields_of(&self, table_id: &str) -> &[&'a FieldRow] {
        self.fields_by_table.get(table_id).map(Vec::as_slice).unwrap_or(&[])
    }

    pub fn target(&self, table: &TableRow) -> Target {
        let fields = self.fields_of(&table.id);
        let rules = {
            let mut compiled = self.compiled.lock().unwrap();
            compiled
                .entry(table.id.clone())
                .or_insert_with(|| match self.raw.row_rules.get(&table.id) {
                    Some(rules) if !rules.is_empty() => {
                        let named: Vec<(String, String)> = fields.iter().map(|f| (f.column.clone(), f.kind.clone())).collect();
                        compile_row_rules(rules, &named)
                    }
                    _ => HashMap::new(),
                })
                .clone()
        };
        let mut t = Target::new(TargetKind::Table, table.id.clone(), Some(self.tenant.clone()));
        t.project_id = self.project_of.get(table.base_id.as_str()).map(|p| p.to_string());
        t.base_id = Some(table.base_id.clone());
        t.application_ids = self.raw.applications.get(&table.id).cloned().unwrap_or_default();
        t.field_ids = fields.iter().map(|f| f.id.clone()).collect();
        t.agent_hidden_field_ids = fields.iter().filter(|f| !f.expose_to_agents).map(|f| f.id.clone()).collect();
        t.agents_excluded = self.agents_excluded.contains(table.base_id.as_str());
        t.computed_field_ids = fields.iter().filter(|f| COMPUTED_KINDS.contains(&f.kind.as_str()) || f.has_ai).map(|f| f.id.clone()).collect();
        t.row_rules = rules;
        t
    }
}

fn format_of(field: &FieldRow) -> Option<FieldFormat> {
    let display = if field.kind == "number" { &field.number_format } else { &field.text_format };
    match display.as_deref() {
        None | Some("decimal") | Some("plain") => None,
        Some(d) => Some(FieldFormat { display: d.to_string(), currency: field.currency_code.clone(), rating_max: field.rating_max }),
    }
}

fn allowed(ctx: &RequestContext, grants: &ActorGrants, action: Action, target: &Target) -> bool {
    decide(ctx, grants, action, target).verdict == Verdict::Allowed
}

/// `project`: the catalog as this actor may see it.
pub fn project(ctx: &RequestContext, grants: &ActorGrants, raw: &RawCatalog, dialect: FormulaDialect) -> Vec<ProjectedBase> {
    let factory = TargetFactory::new(ctx, raw);
    let project_by_id: HashMap<&str, &ProjectRow> = raw.projects.iter().map(|p| (p.id.as_str(), p)).collect();
    let link_by_field: HashMap<&str, &LinkRow> = raw.links.iter().map(|l| (l.field_id.as_str(), l)).collect();
    let table_by_id: HashMap<&str, &TableRow> = raw.tables.iter().map(|t| (t.id.as_str(), t)).collect();
    let field_by_id: HashMap<&str, &FieldRow> = raw.fields.iter().map(|f| (f.id.as_str(), f)).collect();

    let mut readable: HashMap<&str, IndexSet<String>> = HashMap::new();
    for table in &raw.tables {
        let d = decide(ctx, grants, Action::Read, &factory.target(table));
        if d.verdict == Verdict::Allowed {
            readable.insert(table.id.as_str(), d.readable_fields);
        }
    }

    let mut referenced: HashSet<&str> = HashSet::new();
    for link in &raw.links {
        if let Some(source) = field_by_id.get(link.field_id.as_str()) {
            if readable.contains_key(source.table_id.as_str()) {
                referenced.insert(link.target_table_id.as_str());
            }
        }
    }

    let mut projected = Vec::new();
    for base in &raw.bases {
        let mut tables = Vec::new();
        for table in raw.tables.iter().filter(|t| t.base_id == base.id) {
            let Some(readable_fields) = readable.get(table.id.as_str()) else { continue };
            let target = factory.target(table);
            let synced = table.synced;
            let writable = if synced { IndexSet::new() } else { decide(ctx, grants, Action::Update, &target).writable_fields };
            let actions: Vec<Action> =
                DATA_ACTIONS.into_iter().filter(|a| (!synced || *a == Action::Read) && allowed(ctx, grants, *a, &target)).collect();

            let mut fields: Vec<ProjectedField> = SYSTEM_COLUMNS
                .iter()
                .map(|name| ProjectedField {
                    name: name.to_string(),
                    label: name.to_string(),
                    description: system_column_description(name).map(str::to_string),
                    kind: "system".into(),
                    required: false,
                    unique: false,
                    read_only: true,
                    system: true,
                    unsafe_html: false,
                    options: None,
                    link: None,
                    format: None,
                    hidden_from_agents: false,
                    ai: false,
                    computed: None,
                    button: None,
                    default: None,
                })
                .collect();

            for field in factory.fields_of(&table.id) {
                if !readable_fields.contains(&field.id) {
                    continue;
                }
                let projected_link = link_by_field.get(field.id.as_str()).map(|link| {
                    let target_table = table_by_id.get(link.target_table_id.as_str());
                    let target_readable = readable.get(link.target_table_id.as_str());
                    match (target_table, target_readable) {
                        (Some(target_table), Some(target_readable)) => {
                            let display = target_table
                                .display_field_id
                                .as_ref()
                                .filter(|id| target_readable.contains(*id))
                                .and_then(|id| field_by_id.get(id.as_str()).map(|f| f.column.clone()));
                            ProjectedLink {
                                on_delete: link.on_delete.clone(),
                                required: field.is_required,
                                target: Some(LinkTarget { table: target_table.table_name.clone(), display_field: display }),
                                expandable: field.kind == "link",
                                masked: false,
                            }
                        }
                        _ => ProjectedLink { on_delete: link.on_delete.clone(), required: field.is_required, target: None, expandable: false, masked: true },
                    }
                });

                let mut computed = None;
                if let (Some(via_id), Some(direction)) = (&field.rollup_via_id, &field.rollup_direction) {
                    let Some(via) = field_by_id.get(via_id.as_str()) else { continue };
                    let Some(via_link) = link_by_field.get(via.id.as_str()) else { continue };
                    let reached_id = if direction == "outgoing" { via_link.target_table_id.as_str() } else { via.table_id.as_str() };
                    let reached_fields = readable.get(reached_id);
                    let via_readable =
                        if direction == "outgoing" { readable_fields.contains(&via.id) } else { reached_fields.is_some_and(|r| r.contains(&via.id)) };
                    let target_readable = match &field.rollup_target_id {
                        None => true,
                        Some(t) => reached_fields.is_some_and(|r| r.contains(t)),
                    };
                    if reached_fields.is_none() || !via_readable || !target_readable {
                        continue;
                    }
                    computed = Some(ProjectedComputed {
                        result_kind: field.rollup_result_kind.clone().unwrap_or_else(|| "number".into()),
                        stored: false,
                        multiple: field.rollup_multiple == Some(true),
                        expression: None,
                        timezone: None,
                        via: Some(ComputedVia {
                            field: via.column.clone(),
                            table: table_by_id.get(via.table_id.as_str()).map(|t| t.table_name.clone()).unwrap_or_default(),
                            direction: direction.clone(),
                            reached: table_by_id.get(reached_id).map(|t| t.table_name.clone()).unwrap_or_default(),
                        }),
                        target: field.rollup_target_id.as_ref().and_then(|t| field_by_id.get(t.as_str()).map(|f| f.column.clone())),
                        aggregate: field.rollup_aggregate.clone(),
                    });
                } else if field.kind == "formula" {
                    if let Some(ast) = field.formula_ast.as_ref().filter(|a| !a.is_null()) {
                        if field.formula_is_stored == Some(false)
                            && !field.formula_deps.iter().flatten().all(|id| readable_fields.contains(id))
                        {
                            continue;
                        }
                        let label_of = |id: &str| field_by_id.get(id).map(|f| f.label.clone()).unwrap_or_else(|| "?".into());
                        let expression = Node::from_json(ast).map(|n| render_formula(&n, &label_of, dialect)).unwrap_or_default();
                        computed = Some(ProjectedComputed {
                            result_kind: field.formula_result_kind.clone().unwrap_or_else(|| "short_text".into()),
                            stored: field.formula_is_stored != Some(false),
                            multiple: false,
                            expression: Some(expression),
                            timezone: field.formula_timezone.clone(),
                            via: None,
                            target: None,
                            aggregate: None,
                        });
                    }
                }

                let button = match (&field.button_action, &field.button_label) {
                    (Some(action), Some(label)) => Some(ProjectedButton {
                        label: label.clone(),
                        color: field.button_color.clone(),
                        action: action.clone(),
                        url: field.button_url.clone(),
                        automation: field.button_automation.clone(),
                    }),
                    _ => None,
                };

                fields.push(ProjectedField {
                    name: field.column.clone(),
                    label: field.label.clone(),
                    description: field.description.clone(),
                    kind: field.kind.clone(),
                    required: field.is_required,
                    unique: raw.unique.contains_key(&field.id),
                    read_only: !writable.contains(&field.id),
                    system: false,
                    unsafe_html: field.is_rich,
                    options: raw.options.get(&field.id).cloned(),
                    link: projected_link,
                    format: format_of(field),
                    hidden_from_agents: !field.expose_to_agents,
                    ai: field.has_ai,
                    computed,
                    button,
                    default: field.default_kind.as_ref().map(|k| FieldDefault {
                        kind: k.clone(),
                        value: if k == "value" { Some(field.default_value.clone().unwrap_or(Value::Null)) } else { None },
                    }),
                });
            }

            let own_display = table
                .display_field_id
                .as_ref()
                .filter(|id| readable_fields.contains(*id))
                .and_then(|id| field_by_id.get(id.as_str()).map(|f| f.column.clone()));

            tables.push(ProjectedTable {
                id: table.id.clone(),
                name: table.table_name.clone(),
                label: table.label.clone(),
                description: table.description.clone(),
                sql: qualify(&table.schema_name, &table.table_name).unwrap_or_default(),
                actions,
                fields,
                referenced_by: referenced.contains(table.id.as_str()),
                display_field: own_display,
                color: table.color.clone(),
                icon: table.icon.clone(),
                image: table.image.clone(),
                synced,
            });
        }

        let base_target = base_target_of(ctx, base);
        let base_actions: Vec<Action> = BASE_ACTIONS.into_iter().filter(|a| allowed(ctx, grants, *a, &base_target)).collect();
        if !tables.is_empty() || base_actions.contains(&Action::Read) {
            projected.push(ProjectedBase {
                id: base.id.clone(),
                name: base.schema_name.clone(),
                label: base.label.clone(),
                description: base.description.clone(),
                project: ProjectRef {
                    id: base.project_id.clone(),
                    label: project_by_id.get(base.project_id.as_str()).map(|p| p.label.clone()).unwrap_or_default(),
                },
                base_actions,
                agents_enabled: base.mcp_enabled,
                tables,
                color: base.color.clone(),
                icon: base.icon.clone(),
                image: base.image.clone(),
                environment: environment_of(base),
            });
        }
    }
    projected
}

// ------------------------------------------------------------------------------------
// Environments

static MARKS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{M}").unwrap());
static NOT_WORD: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^\p{L}\p{N}]+").unwrap());

/// `foldEnvironment`: `Recette 2` and `recette-2` name the same environment.
pub fn fold_environment(value: &str) -> String {
    let decomposed: String = value.nfd().collect();
    let lowered = MARKS.replace_all(&decomposed, "").to_lowercase();
    NOT_WORD.replace_all(&lowered, "").into_owned()
}

/// `namesEnvironment`: does `asked` name this base's environment?
pub fn names_environment(base: &BaseRow, asked: &str, production: Option<&BaseRow>) -> bool {
    let key = fold_environment(asked);
    if key.is_empty() {
        return false;
    }
    if key == fold_environment(&base.environment) {
        return true;
    }
    if base.is_production {
        return key == "production" || key == "prod";
    }
    match production {
        Some(p) => {
            let prefix = format!("{}_", p.schema_name);
            base.schema_name.starts_with(&prefix) && fold_environment(&base.schema_name[prefix.len()..]) == key
        }
        None => false,
    }
}

/// `baseInEnvironment`: the base named, moved to the environment asked.
pub fn base_in_environment<'a>(ctx: &RequestContext, bases: &'a [BaseRow], matches: impl Fn(&BaseRow) -> bool) -> Result<Option<&'a BaseRow>, AppError> {
    let Some(named) = bases.iter().find(|b| matches(b)) else { return Ok(None) };
    let Some(asked) = &ctx.environment else { return Ok(Some(named)) };
    let family: Vec<&BaseRow> = bases.iter().filter(|b| b.lineage_id == named.lineage_id).collect();
    let production = family.iter().find(|b| b.is_production).copied();
    match family.into_iter().find(|b| names_environment(b, asked, production)) {
        Some(found) => Ok(Some(found)),
        None => Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(named.schema_name)).with("environment", json!(asked))),
    }
}

/// `referenceIn`: a base reference, moved to the environment asked.
pub fn reference_in(ctx: &RequestContext, bases: &[BaseRow], reference: &str) -> Result<String, AppError> {
    if ctx.environment.is_none() {
        return Ok(reference.to_string());
    }
    Ok(base_in_environment(ctx, bases, |b| b.schema_name == reference || b.id == reference)?
        .map(|b| b.id.clone())
        .unwrap_or_else(|| reference.to_string()))
}

/// `ofEnvironment`: with an environment asked, only the bases of that environment.
pub fn of_environment<T>(ctx: &RequestContext, bases: &[BaseRow], items: Vec<T>, id_of: impl Fn(&T) -> &str) -> Vec<T> {
    let Some(asked) = &ctx.environment else { return items };
    let keep: HashSet<&str> = bases
        .iter()
        .filter(|b| {
            let production = bases.iter().find(|p| p.lineage_id == b.lineage_id && p.is_production);
            names_environment(b, asked, production)
        })
        .map(|b| b.id.as_str())
        .collect();
    items.into_iter().filter(|i| keep.contains(id_of(i))).collect()
}

/// `environmentOf`.
pub fn environment_of(base: &BaseRow) -> BaseEnvironment {
    BaseEnvironment { lineage: base.lineage_id.clone(), label: base.environment.clone(), production: base.is_production, position: base.environment_position }
}

// ------------------------------------------------------------------------------------
// Snapshot and resolvers

/// What every projection is built from.
#[derive(Clone)]
pub struct Snapshot {
    pub grants: Arc<ActorGrants>,
    pub raw: Arc<RawCatalog>,
    pub versions: CatalogVersions,
}

const CATALOG_READ: TxOptions = TxOptions { isolation: Isolation::RepeatableRead, read_only: true, retries: 2 };

/// `snapshot`: counters, catalog and grants read in ONE repeatable-read transaction.
pub async fn snapshot(pools: &Pools, ctx: &RequestContext) -> Result<Snapshot, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, CATALOG_READ, |tx| {
        let ctx = ctx.clone();
        async move {
            let Some(versions) = read_versions(&tx, &ctx.tenant_id).await? else {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("tenant", json!(ctx.tenant_id)));
            };
            let raw = match CATALOG_CACHE.get(&ctx.tenant_id, &versions) {
                Some(raw) => raw,
                None => {
                    let raw = Arc::new(load_catalog(&tx, &ctx.tenant_id).await?);
                    CATALOG_CACHE.set(&ctx.tenant_id, &versions, raw.clone());
                    raw
                }
            };
            let key = format!("{}|{}|{}", ctx.tenant_id, ctx.actor.id, ctx.actor.token_id.as_deref().unwrap_or(""));
            let grants = match GRANTS_CACHE.get(&key, &versions) {
                Some(g) => g,
                None => {
                    let g = Arc::new(load_grants(&tx, &ctx).await?);
                    GRANTS_CACHE.set(&key, &versions, g.clone());
                    g
                }
            };
            Ok(Snapshot { grants, raw, versions })
        }
    })
    .await
}

/// `listVisibleBases`.
pub async fn list_visible_bases(pools: &Pools, ctx: &RequestContext) -> Result<Vec<VisibleBase>, AppError> {
    let s = snapshot(pools, ctx).await?;
    let bases = of_environment(ctx, &s.raw.bases, project(ctx, &s.grants, &s.raw, FormulaDialect::Fr), |b| &b.id);
    Ok(bases.iter().map(VisibleBase::of).collect())
}

/// `projectBase`: one base, as this actor may see it.
pub async fn project_base(pools: &Pools, ctx: &RequestContext, reference: &str) -> Result<ProjectedBase, AppError> {
    let s = snapshot(pools, ctx).await?;
    let r = reference_in(ctx, &s.raw.bases, reference)?;
    project(ctx, &s.grants, &s.raw, FormulaDialect::Fr)
        .into_iter()
        .find(|b| b.name == r || b.id == r)
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("base", json!(reference)))
}

/// `ResolvedTable`.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedTable {
    pub table_id: String,
    pub base_id: String,
    pub table_name: String,
    pub base_name: String,
}

/// `resolveTable`: a readable table, by name or id; else `RESOURCE_NOT_FOUND {base, table}`.
pub async fn resolve_table(pools: &Pools, ctx: &RequestContext, base_ref: &str, table_ref: &str) -> Result<ResolvedTable, AppError> {
    let s = snapshot(pools, ctx).await?;
    let bases = project(ctx, &s.grants, &s.raw, FormulaDialect::Fr);
    let r = reference_in(ctx, &s.raw.bases, base_ref)?;
    let base = bases.iter().find(|b| b.name == r || b.id == r);
    let table = base.and_then(|b| b.tables.iter().find(|t| t.name == table_ref || t.id == table_ref));
    match (base, table) {
        (Some(b), Some(t)) => Ok(ResolvedTable { table_id: t.id.clone(), base_id: b.id.clone(), table_name: t.name.clone(), base_name: b.name.clone() }),
        _ => Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_ref)).with("table", json!(table_ref))),
    }
}

/// `resolveBase`: a live base by name or id, readable or not (the caller decides).
pub async fn resolve_base(pools: &Pools, ctx: &RequestContext, reference: &str) -> Result<(String, String), AppError> {
    let s = snapshot(pools, ctx).await?;
    match base_in_environment(ctx, &s.raw.bases, |b| b.schema_name == reference || b.id == reference)? {
        Some(b) => Ok((b.id.clone(), b.schema_name.clone())),
        None => Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(reference))),
    }
}

/// A resolved field: `(field id, table id, physical name)`.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedField {
    pub field_id: String,
    pub table_id: String,
    pub name: String,
}

/// `resolveField`: a live field of a readable table, by name or id.
pub async fn resolve_field(pools: &Pools, ctx: &RequestContext, base_ref: &str, table_ref: &str, field_ref: &str) -> Result<ResolvedField, AppError> {
    let table = resolve_table(pools, ctx, base_ref, table_ref).await?;
    let conn = pools.catalog().await?;
    let row = conn
        .first(
            "SELECT f.id::text, n.name
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live AND (n.name = $2 OR f.id::text = $2)",
            &[&table.table_id, &field_ref],
        )
        .await?;
    match row {
        Some(r) => Ok(ResolvedField { field_id: r.get(0), table_id: table.table_id, name: r.get(1) }),
        None => Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_ref))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base(id: &str, schema: &str, env: &str, production: bool) -> BaseRow {
        BaseRow {
            id: id.into(),
            label: "Ventes".into(),
            description: None,
            color: None,
            icon: None,
            image: None,
            schema_name: schema.into(),
            mcp_enabled: true,
            catalog_version: "1".into(),
            project_id: "p".into(),
            lineage_id: "l".into(),
            environment: env.into(),
            is_production: production,
            environment_position: 0,
        }
    }

    #[test]
    fn environments_are_named_loosely() {
        let prod = base("a", "b_t_ventes", "Production", true);
        let recette = base("b", "b_t_ventes_recette_2", "Recette 2", false);
        assert_eq!(fold_environment("Récette-2 "), "recette2");
        assert!(names_environment(&prod, "prod", None));
        assert!(names_environment(&prod, "PRODUCTION", None));
        assert!(names_environment(&recette, "recette 2", Some(&prod)));
        assert!(names_environment(&recette, "recette_2", Some(&prod)));
        assert!(!names_environment(&recette, "prod", Some(&prod)));
        assert!(!names_environment(&recette, "  ", Some(&prod)));
        let bases = vec![prod.clone(), recette.clone()];
        let ctx = RequestContext::new("r", basedb_base::tx::Actor::user("u"), "t", basedb_base::tx::Surface::Rest).with_environment(Some("recette 2"));
        assert_eq!(reference_in(&ctx, &bases, "b_t_ventes").unwrap(), "b");
        let ctx = ctx.with_environment(Some("dev"));
        let e = reference_in(&ctx, &bases, "a").unwrap_err();
        assert_eq!(e.details["base"], json!("b_t_ventes"));
        assert_eq!(e.details["environment"], json!("dev"));
        assert_eq!(of_environment(&ctx, &bases, vec!["a", "b"], |s| s).len(), 0);
    }
}
