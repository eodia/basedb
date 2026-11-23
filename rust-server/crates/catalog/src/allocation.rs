//! Name allocation — chapter 01 §6.1 (`core/src/naming/allocation.ts`): the ONLY path
//! through which a physical name comes into being. [`crate::naming`] computes candidates;
//! this holds the registry, the scope lock and the suffix loop — always inside the
//! transaction of the structure step that uses the name.

use crate::naming::{
    apply_name_restrictions, budget_for_nature, compose_schema_name, is_alphabet_a, slugify, truncate_hard, NameScope, SlugNature, SLUG_VERSION,
};
use basedb_base::db::Exec;
use basedb_base::error::{AppError, SqlOp};
use basedb_base::tx::RequestContext;
use serde_json::json;

type R<T> = Result<T, AppError>;

/// `SCOPE_INSTANCE`: the scope of schema names (§6.2).
pub const SCOPE_INSTANCE: &str = "00000000-0000-0000-0000-000000000001";

/// `LOCK_CLASS_NAME_ALLOCATION` (A8).
pub const LOCK_CLASS_NAME_ALLOCATION: i32 = 2;

/// `ObjectKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ObjectKind {
    Schema,
    Table,
    SqlView,
    Field,
    SystemField,
    Index,
    Constraint,
    Sequence,
    Trigger,
}

impl ObjectKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ObjectKind::Schema => "schema",
            ObjectKind::Table => "table",
            ObjectKind::SqlView => "sql_view",
            ObjectKind::Field => "field",
            ObjectKind::SystemField => "system_field",
            ObjectKind::Index => "index",
            ObjectKind::Constraint => "constraint",
            ObjectKind::Sequence => "sequence",
            ObjectKind::Trigger => "trigger",
        }
    }
}

/// `ScopeKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScopeKind {
    Instance,
    Schema,
    Table,
}

impl ScopeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ScopeKind::Instance => "instance",
            ScopeKind::Schema => "schema",
            ScopeKind::Table => "table",
        }
    }
}

/// Where the candidate comes from: a label (slugified), a technical name (alphabet A as
/// is), or an already assembled derived name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Candidate {
    Label(String),
    Technical(String),
    Derived(String),
}

/// `AllocationRequest`.
#[derive(Debug, Clone)]
pub struct AllocationRequest {
    pub candidate: Candidate,
    /// Tried BARE, under the lock, before the suffix loop (A7).
    pub derived_fallbacks: Vec<String>,
    pub object_kind: ObjectKind,
    pub scope_kind: ScopeKind,
    pub scope_id: String,
    /// For a schema: the tenant whose prefix the assembled name carries.
    pub tenant_id: Option<String>,
}

impl AllocationRequest {
    pub fn new(candidate: Candidate, object_kind: ObjectKind, scope_kind: ScopeKind, scope_id: impl Into<String>) -> Self {
        AllocationRequest { candidate, derived_fallbacks: Vec::new(), object_kind, scope_kind, scope_id: scope_id.into(), tenant_id: None }
    }
}

/// `AllocatedName`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AllocatedName {
    pub name: String,
    pub name_id: String,
    /// `SLUG_FALLBACK_APPLIED`.
    pub fallback_applied: bool,
    /// 1 for the bare candidate.
    pub rank: u32,
}

fn budget_of(kind: ObjectKind) -> (usize, NameScope, SlugNature) {
    match kind {
        ObjectKind::Schema => (budget_for_nature(SlugNature::Base), NameScope::Base, SlugNature::Base),
        ObjectKind::Table | ObjectKind::SqlView => (budget_for_nature(SlugNature::Table), NameScope::Table, SlugNature::Table),
        _ => (budget_for_nature(SlugNature::Champ), NameScope::Field, SlugNature::Champ),
    }
}

/// `applySuffix`: truncated to `max − len(_k)`, then suffixed.
pub fn apply_suffix(candidate: &str, rank: u32, max: usize) -> String {
    if rank <= 1 {
        return candidate.to_string();
    }
    let suffix = format!("_{rank}");
    format!("{}{suffix}", truncate_hard(candidate, max - suffix.len()))
}

/// `allocateName`.
pub async fn allocate_name<E: Exec + Sync>(exec: &E, ctx: &RequestContext, request: &AllocationRequest) -> R<AllocatedName> {
    let (max, scope, nature) = budget_of(request.object_kind);
    let mut fallback_applied = false;
    let candidate = match &request.candidate {
        Candidate::Derived(name) => name.clone(),
        Candidate::Technical(name) => {
            if !is_alphabet_a(name) {
                return Err(AppError::new("IDENTIFIER_INVALID").with("technicalName", json!(name)));
            }
            name.clone()
        }
        Candidate::Label(label) => {
            let result = slugify(label, max, nature);
            fallback_applied = result.fallback_applied;
            result.slug
        }
    };
    let (escaped, needs_suffix_loop) = apply_name_restrictions(&candidate, scope, max);

    let key = lock_key(exec, request.scope_kind, &request.scope_id).await?;
    exec.rows("SELECT pg_advisory_xact_lock($1::int, $2::int)", &[&LOCK_CLASS_NAME_ALLOCATION, &key]).await?;

    let bare: Vec<String> = if needs_suffix_loop {
        Vec::new()
    } else {
        std::iter::once(escaped.clone()).chain(request.derived_fallbacks.iter().map(|f| truncate_hard(f, max))).collect()
    };
    for proposed in bare {
        let name = name_to_register(&proposed, request)?;
        if is_available(exec, &request.scope_id, &name, request.object_kind).await? {
            let name_id = insert_into_registry(exec, ctx, &name, request).await?;
            return Ok(AllocatedName { name, name_id, fallback_applied, rank: 1 });
        }
    }
    for rank in 2..=99 {
        let name = name_to_register(&apply_suffix(&escaped, rank, max), request)?;
        if is_available(exec, &request.scope_id, &name, request.object_kind).await? {
            let name_id = insert_into_registry(exec, ctx, &name, request).await?;
            return Ok(AllocatedName { name, name_id, fallback_applied, rank });
        }
    }
    Err(AppError::new("NAME_COLLISION_UNRESOLVED").with("candidate", json!(escaped)).with("scopeId", json!(request.scope_id)))
}

/// `lockKey`: from the catalog, never `hashtext()`; 1 for the instance scope.
async fn lock_key<E: Exec + Sync>(exec: &E, scope_kind: ScopeKind, scope_id: &str) -> R<i32> {
    let table = match scope_kind {
        ScopeKind::Instance => return Ok(1),
        ScopeKind::Schema => "_basedb.db_schema",
        ScopeKind::Table => "_basedb.table_def",
    };
    let row = exec.first(&format!("SELECT lock_key FROM {table} WHERE id = $1::text::uuid"), &[&scope_id]).await?;
    match row {
        Some(r) => Ok(r.get(0)),
        None => Err(AppError::new("INTERNAL_ERROR")
            .with("reason", json!("allocation scope unknown to the catalog"))
            .with("scopeKind", json!(scope_kind.as_str()))
            .with("scopeId", json!(scope_id))),
    }
}

/// `nameToRegister`: a schema is registered under its assembled name.
fn name_to_register(proposed: &str, request: &AllocationRequest) -> R<String> {
    if request.object_kind != ObjectKind::Schema {
        return Ok(proposed.to_string());
    }
    match &request.tenant_id {
        Some(tenant) => Ok(compose_schema_name(tenant, proposed)),
        None => Err(AppError::new("INTERNAL_ERROR").with("reason", json!("schema allocation without tenantId"))),
    }
}

/// `isAvailable`: no registry row, whatever its state; for a schema, nothing in
/// `pg_namespace` either — or `NAME_TAKEN_OUTSIDE_REGISTRY`.
async fn is_available<E: Exec + Sync>(exec: &E, scope_id: &str, name: &str, kind: ObjectKind) -> R<bool> {
    let taken: bool = exec
        .first("SELECT EXISTS (SELECT 1 FROM _basedb.physical_name WHERE scope_id = $1::text::uuid AND name = $2::text) AS exists", &[&scope_id, &name])
        .await?
        .map(|r| r.get(0))
        .unwrap_or(false);
    if taken {
        return Ok(false);
    }
    if kind == ObjectKind::Schema {
        let occupied: bool = exec
            .first("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1::text) AS exists", &[&name])
            .await?
            .map(|r| r.get(0))
            .unwrap_or(false);
        if occupied {
            return Err(AppError::new("NAME_TAKEN_OUTSIDE_REGISTRY").with("schema", json!(name)));
        }
    }
    Ok(true)
}

async fn insert_into_registry<E: Exec + Sync>(exec: &E, ctx: &RequestContext, name: &str, request: &AllocationRequest) -> R<String> {
    let rows = exec
        .query_op(
            "INSERT INTO _basedb.physical_name
               (scope_kind, scope_id, name, object_kind, state, slug_version, allocated_by)
             VALUES ($1::text, $2::text::uuid, $3::text, $4::text, 'active', $5::int, $6::text::uuid)
             RETURNING id::text",
            &[&request.scope_kind.as_str(), &request.scope_id, &name, &request.object_kind.as_str(), &SLUG_VERSION, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
    rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::new("INTERNAL_ERROR").with("reason", json!("registry insert returned no id")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suffixes_respect_the_budget() {
        assert_eq!(apply_suffix("clients", 1, 48), "clients");
        assert_eq!(apply_suffix("clients", 2, 48), "clients_2");
        let long = "a".repeat(48);
        assert_eq!(apply_suffix(&long, 9, 48), format!("{}_9", "a".repeat(46)));
        assert_eq!(apply_suffix(&long, 10, 48), format!("{}_10", "a".repeat(45)));
        assert_eq!(apply_suffix(&format!("{}_b", "a".repeat(45)), 2, 48), format!("{}_2", "a".repeat(45)));
    }
}
