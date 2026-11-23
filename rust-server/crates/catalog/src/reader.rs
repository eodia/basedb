//! What a person reads of a base, as PostgreSQL names it (`readerReach`/`readerReaches`
//! of `sql/reader.ts`): decided by the decider, from the same snapshot as the data routes.
//! The reader's LOGIN role and the console are in sql_console.rs.

use crate::projection::{base_target_of, snapshot, TargetFactory};
use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{decide, Action, Verdict, SYSTEM_COLUMNS};
use basedb_base::tx::RequestContext;
use serde_json::json;
use indexmap::IndexMap;
use std::collections::HashSet;

/// `Reach`.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Reach {
    pub schema: String,
    /// Readable table → its readable columns: the system ones and the readable fields'.
    pub tables: IndexMap<String, HashSet<String>>,
    /// Readable table → the rows the person reaches, as the decider wrote them.
    pub rows: IndexMap<String, String>,
}

/// `BaseReach`.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct BaseReach {
    pub base_id: String,
    pub label: String,
    pub reach: Reach,
}

/// `reachesOf`: a base with no table read and no right on the base itself is left out.
async fn reaches_of(pools: &Pools, ctx: &RequestContext, only: Option<&str>) -> Result<Vec<BaseReach>, AppError> {
    let s = snapshot(pools, ctx).await?;
    let factory = TargetFactory::new(ctx, &s.raw);
    let mut out = Vec::new();
    for base in &s.raw.bases {
        if only.is_some_and(|o| o != base.id) {
            continue;
        }
        let mut tables = IndexMap::new();
        let mut rows = IndexMap::new();
        for table in s.raw.tables.iter().filter(|t| t.base_id == base.id) {
            let decision = decide(ctx, &s.grants, Action::Read, &factory.target(table));
            if decision.verdict != Verdict::Allowed {
                continue;
            }
            rows.insert(table.table_name.clone(), decision.row_predicate.clone());
            let mut columns: HashSet<String> = SYSTEM_COLUMNS.iter().map(|c| c.to_string()).collect();
            for field in factory.fields_of(&table.id) {
                if decision.readable_fields.contains(&field.id) {
                    columns.insert(field.column.clone());
                }
            }
            tables.insert(table.table_name.clone(), columns);
        }
        if tables.is_empty() && decide(ctx, &s.grants, Action::Read, &base_target_of(ctx, base)).verdict != Verdict::Allowed {
            continue;
        }
        out.push(BaseReach { base_id: base.id.clone(), label: base.label.clone(), reach: Reach { schema: base.schema_name.clone(), tables, rows } });
    }
    Ok(out)
}

/// `readerReach`: one base; one not read does not exist (`RESOURCE_NOT_FOUND {base}`).
pub async fn reader_reach(pools: &Pools, ctx: &RequestContext, base_id: &str) -> Result<Reach, AppError> {
    reaches_of(pools, ctx, Some(base_id))
        .await?
        .into_iter()
        .next()
        .map(|b| b.reach)
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)))
}

/// `readerReaches`: every base of the tenant the person reads.
pub async fn reader_reaches(pools: &Pools, ctx: &RequestContext) -> Result<Vec<BaseReach>, AppError> {
    reaches_of(pools, ctx, None).await
}
