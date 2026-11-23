//! What an agent sees of the catalog (`agent/view.ts`, chapter 09 §3 and §4): the SAME
//! snapshot and the SAME decider as every other projection, with the shape of this chapter.
//! Every failure to resolve is the same `RESOURCE_NOT_FOUND`.

use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::rbac::{decide, Action, ActorGrants, Decision, Verdict, SYSTEM_COLUMNS};
use basedb_base::tx::{RequestContext, Surface};
use basedb_catalog::projection::{base_in_environment, base_target_of, snapshot, BaseRow, FieldRow, LinkRow, RawCatalog, TableRow, TargetFactory};
use basedb_records::values::is_file_kind;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// `SYSTEM_LABELS`: the fixed labels of the five system columns.
pub fn system_label(name: &str) -> &'static str {
    match name {
        "_id" => "Identifiant",
        "_created_at" => "Créé le",
        "_updated_at" => "Modifié le",
        "_created_by" => "Créé par",
        "_updated_by" => "Modifié par",
        _ => "",
    }
}

/// `AgentField`.
#[derive(Debug, Clone)]
pub struct AgentField {
    pub id: Option<String>,
    pub name: String,
    pub label: String,
    pub kind: String,
    pub system: bool,
    pub row: Option<FieldRow>,
    /// Writable on THIS surface: a formula, rich text, file or system column never is.
    pub writable: bool,
    /// Writable by the rights, whatever this surface refuses.
    pub granted_write: bool,
    pub link: Option<LinkRow>,
}

/// The five decisions of a table.
#[derive(Debug, Clone)]
pub struct AgentDecisions {
    pub read: Decision,
    pub create: Decision,
    pub update: Decision,
    pub delete: Decision,
    pub manage_schema: Decision,
}

/// `AgentTable`; its base is `view.base_of(table)`.
#[derive(Debug, Clone)]
pub struct AgentTable {
    pub row: TableRow,
    pub fields: Vec<AgentField>,
    pub decisions: AgentDecisions,
}

/// `AgentBase`.
#[derive(Debug, Clone)]
pub struct AgentBase {
    pub row: BaseRow,
    /// The logical name an agent reads: `crm` for `b_t4z56fq_crm`.
    pub name: String,
    pub tables: Vec<AgentTable>,
}

/// `AgentView`.
pub struct AgentView {
    pub ctx: RequestContext,
    pub grants: Arc<ActorGrants>,
    pub raw: Arc<RawCatalog>,
    /// Visible bases only, open to agents.
    pub bases: Vec<AgentBase>,
}

impl AgentView {
    /// `tableById.get`, with the table's base.
    pub fn table_by_id(&self, id: &str) -> Option<(&AgentBase, &AgentTable)> {
        self.bases.iter().find_map(|b| b.tables.iter().find(|t| t.row.id == id).map(|t| (b, t)))
    }

    /// The base a table of this view belongs to.
    pub fn base_of(&self, table: &AgentTable) -> Option<&AgentBase> {
        self.bases.iter().find(|b| b.row.id == table.row.base_id)
    }
}

/// `logicalName`: `b_<tenant>_crm` → `crm`.
pub fn logical_name(schema_name: &str, tenant_ref: &str) -> String {
    let prefix = format!("b_{tenant_ref}_");
    schema_name.strip_prefix(&prefix).unwrap_or(schema_name).to_string()
}

/// `requireAgentSurface`.
pub fn require_agent_surface(ctx: &RequestContext) -> Result<(), AppError> {
    if ctx.surface != Surface::Mcp {
        return Err(AppError::new("INTERNAL_ERROR").with("reason", json!("agent operation off surface")));
    }
    Ok(())
}

/// `agentView`: the agent's view of the tenant, from the cached snapshot.
pub async fn agent_view(pools: &Pools, ctx: &RequestContext) -> Result<AgentView, AppError> {
    require_agent_surface(ctx)?;
    let snap = snapshot(pools, ctx).await?;
    Ok(build_view(ctx, snap.grants, snap.raw))
}

/// `buildView`.
pub fn build_view(ctx: &RequestContext, grants: Arc<ActorGrants>, raw: Arc<RawCatalog>) -> AgentView {
    let bases = {
        let factory = TargetFactory::new(ctx, &raw);
        let link_by_field: HashMap<&str, &LinkRow> = raw.links.iter().map(|l| (l.field_id.as_str(), l)).collect();
        let mut bases = Vec::new();
        for base_row in &raw.bases {
            let mut base = AgentBase { row: base_row.clone(), name: logical_name(&base_row.schema_name, &ctx.tenant_id), tables: Vec::new() };
            for table_row in raw.tables.iter().filter(|t| t.base_id == base_row.id) {
                let target = factory.target(table_row);
                let d = |a| decide(ctx, &grants, a, &target);
                let decisions = AgentDecisions { read: d(Action::Read), create: d(Action::Create), update: d(Action::Update), delete: d(Action::Delete), manage_schema: d(Action::ManageSchema) };
                if decisions.read.verdict != Verdict::Allowed {
                    continue;
                }
                let mut writable_by_rights: HashSet<String> = HashSet::new();
                for decision in [&decisions.create, &decisions.update] {
                    if decision.verdict == Verdict::Allowed {
                        writable_by_rights.extend(decision.writable_fields.iter().cloned());
                    }
                }
                let mut fields: Vec<AgentField> = SYSTEM_COLUMNS
                    .iter()
                    .map(|name| AgentField {
                        id: None,
                        name: name.to_string(),
                        label: system_label(name).to_string(),
                        kind: "system".into(),
                        system: true,
                        row: None,
                        writable: false,
                        granted_write: false,
                        link: None,
                    })
                    .collect();
                for row in factory.fields_of(&table_row.id) {
                    if !decisions.read.readable_fields.contains(&row.id) {
                        continue;
                    }
                    let granted = writable_by_rights.contains(&row.id);
                    fields.push(AgentField {
                        id: Some(row.id.clone()),
                        name: row.column.clone(),
                        label: row.label.clone(),
                        kind: row.kind.clone(),
                        system: false,
                        row: Some((*row).clone()),
                        writable: granted && row.kind != "formula" && !row.has_ai && !row.is_rich && !is_file_kind(&row.kind),
                        granted_write: granted,
                        link: link_by_field.get(row.id.as_str()).map(|l| (*l).clone()),
                    });
                }
                base.tables.push(AgentTable { row: table_row.clone(), fields, decisions });
            }
            if !base.tables.is_empty() || decide(ctx, &grants, Action::Read, &base_target_of(ctx, base_row)).verdict == Verdict::Allowed {
                bases.push(base);
            }
        }
        bases
    };
    AgentView { ctx: ctx.clone(), grants, raw, bases }
}

fn not_found() -> AppError {
    AppError::new("RESOURCE_NOT_FOUND")
}

/// `resolveAgentBase`: by logical name, schema name or catalog key, in the asked
/// environment; the search space is the visible bases, and nothing else.
pub fn resolve_agent_base<'v>(view: &'v AgentView, reference: &str) -> Result<&'v AgentBase, AppError> {
    let tenant = &view.ctx.tenant_id;
    let row = base_in_environment(&view.ctx, &view.raw.bases, |b| b.id == reference || b.schema_name == reference || logical_name(&b.schema_name, tenant) == reference)?;
    let Some(row) = row else { return Err(not_found()) };
    view.bases.iter().find(|b| b.row.id == row.id).ok_or_else(not_found)
}

/// `resolveAgentTable`.
pub fn resolve_agent_table<'v>(view: &'v AgentView, base_ref: &str, table_ref: &str) -> Result<(&'v AgentBase, &'v AgentTable), AppError> {
    let base = resolve_agent_base(view, base_ref)?;
    let table = base.tables.iter().find(|t| t.row.id == table_ref || t.row.table_name == table_ref).ok_or_else(not_found)?;
    Ok((base, table))
}

/// `resolveAgentField`: one path for `select`, `filter`, `sort`, `expand` and `values`.
pub fn resolve_agent_field<'t>(table: &'t AgentTable, reference: &str, param: &str) -> Result<&'t AgentField, AppError> {
    table
        .fields
        .iter()
        .find(|f| f.name == reference || f.id.as_deref() == Some(reference))
        .ok_or_else(|| AppError::new("FIELD_UNKNOWN").with("param", json!(param)).with("object", json!({ "kind": "table", "name": table.row.table_name })))
}

/// `linkTarget`: the table a readable link points at, if the bearer can read it.
pub fn link_target<'v>(view: &'v AgentView, field: &AgentField) -> Option<(&'v AgentBase, &'v AgentTable)> {
    view.table_by_id(&field.link.as_ref()?.target_table_id)
}

/// `displayField`: designated AND readable by the bearer.
pub fn display_field(table: &AgentTable) -> Option<&AgentField> {
    let id = table.row.display_field_id.as_deref()?;
    table.fields.iter().find(|f| f.id.as_deref() == Some(id))
}

/// A string argument, or `""` (what a non-string compares as in Node's lookups).
pub fn text_of(v: Option<&Value>) -> &str {
    v.and_then(Value::as_str).unwrap_or("")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logical_names_drop_the_tenant_prefix() {
        assert_eq!(logical_name("b_t4z56fq_crm", "t4z56fq"), "crm");
        assert_eq!(logical_name("autre", "t4z56fq"), "autre");
    }
}
