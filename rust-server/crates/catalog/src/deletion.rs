//! Logical deletion and restoration (`catalog/lifecycle.ts` `deleteTable`, `deleteBase`,
//! `restoreBase`, `previewTableDeletion`; `catalog/field-deletion.ts`): plans built in a
//! catalog transaction, then run by the migration engine.

use crate::engine::{self, origin_of, Proposal, Step};
use crate::lifecycle::{assert_administration, assert_manage_schema};
use crate::migrations::Migration;
use crate::naming::{parse_schema_name, qualify, quote_identifier, quote_literal, relegated_name, relegation_date, MAX_RELEGATED_BASE_SLUG_BYTES};
use crate::operations::default_project_id;
use crate::allocation::SCOPE_INSTANCE;
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{Action, SYSTEM_COLUMNS};
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::require_on_table;
use basedb_base::time::iso;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use tokio_postgres::Row;

type R<T> = Result<T, AppError>;

/// `TABLE_BATCH`.
pub const TABLE_BATCH: usize = 10;
const VIEW_BATCH: usize = 10;

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn plural(n: usize, s: &str) -> &str {
    if n > 1 {
        s
    } else {
        ""
    }
}

/// `truncateBytes`: cut on bytes, back to a character boundary.
pub fn truncate_bytes(value: &str, max: usize) -> String {
    if value.len() <= max {
        return value.to_string();
    }
    let mut end = max;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    value[..end].to_string()
}

/// `stripRelegation`: `zz_supprime_20260918_clients` → `clients`.
pub fn strip_relegation(name: &str) -> String {
    if let Some(rest) = name.strip_prefix("zz_supprime_") {
        let b = rest.as_bytes();
        if b.len() >= 9 && b[..8].iter().all(u8::is_ascii_digit) && b[8] == b'_' {
            return rest[9..].to_string();
        }
    }
    name.to_string()
}

/// Where `freeName` tests a physical collision.
pub enum PhysicalScope<'a> {
    Schema,
    Relation(&'a str),
}

/// `freeName`: the suffix loop over the registry and `pg_catalog`.
pub async fn free_name<E: Exec + Sync>(exec: &E, scope_id: &str, wanted: &str, reserved: &mut HashSet<String>, scope: PhysicalScope<'_>) -> R<String> {
    for rank in 1..=99u32 {
        let suffix = if rank == 1 { String::new() } else { format!("_{rank}") };
        let candidate = format!("{}{suffix}", truncate_bytes(wanted, 63 - suffix.len()));
        if reserved.contains(&candidate) {
            continue;
        }
        let n: i64 = exec
            .rows("SELECT count(*) AS n FROM _basedb.physical_name WHERE scope_id = $1::text::uuid AND name = $2", &[&scope_id, &candidate])
            .await?[0]
            .get(0);
        if n > 0 {
            continue;
        }
        let n: i64 = match scope {
            PhysicalScope::Schema => exec.rows("SELECT count(*) AS n FROM pg_namespace WHERE nspname = $1", &[&candidate]).await?[0].get(0),
            PhysicalScope::Relation(schema) => exec
                .rows(
                    "SELECT count(*) AS n FROM pg_class c
                       JOIN pg_namespace ns ON ns.oid = c.relnamespace
                      WHERE ns.nspname = $2 AND c.relname = $1",
                    &[&candidate, &schema],
                )
                .await?[0]
                .get(0),
        };
        if n > 0 {
            continue;
        }
        reserved.insert(candidate.clone());
        return Ok(candidate);
    }
    Err(AppError::new("NAME_COLLISION_UNRESOLVED").with("name", json!(wanted)))
}

/// `assertNoUnknownDependent`: views outside the product built over these schemas.
pub async fn assert_no_unknown_dependent<E: Exec + Sync>(exec: &E, schemas: &[String]) -> R<()> {
    if schemas.is_empty() {
        return Ok(());
    }
    let rows = exec
        .rows(
            "SELECT DISTINCT
                    dn.nspname || '.' || dc.relname AS dependent,
                    rn.nspname || '.' || rc.relname AS referenced
               FROM pg_depend d
               JOIN pg_rewrite r  ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
               JOIN pg_class dc   ON dc.oid = r.ev_class
               JOIN pg_namespace dn ON dn.oid = dc.relnamespace
               JOIN pg_class rc   ON rc.oid = d.refobjid AND d.refclassid = 'pg_class'::regclass
               JOIN pg_namespace rn ON rn.oid = rc.relnamespace
              WHERE rn.nspname = ANY($1::text[])
                AND dn.nspname <> ALL($1::text[])
                AND dc.oid <> rc.oid",
            &[&schemas],
        )
        .await?;
    if let Some(b) = rows.first() {
        return Err(AppError::new("DEPENDENT_OBJECT").with("dependent", json!(b.get::<_, String>(0))).with("referenced", json!(b.get::<_, String>(1))));
    }
    Ok(())
}

/// `MultiLinkRow`.
pub struct MultiLinkRow {
    pub field_id: String,
    pub column: String,
    pub index_id: String,
    pub index_name: String,
    pub schema_name: String,
    pub table_name: String,
    pub target_schema: String,
    pub target_name: String,
    pub target_label: String,
}

/// `loadMultiLinks`.
pub async fn load_multi_links<E: Exec + Sync>(exec: &E, condition: &str, parameter: &str) -> R<Vec<MultiLinkRow>> {
    let rows = exec
        .rows(
            &format!(
                "SELECT lc.field_id::text, n.name AS column, lc.fk_index_id::text AS index_id, ixn.name AS index_name,
                        sn.name AS schema_name, tn.name AS table_name,
                        tsn.name AS target_schema, ttn.name AS target_name, tt.label AS target_label
                   FROM _basedb.field_link_config lc
                   JOIN _basedb.field f           ON f.id = lc.field_id AND f.deleted_at IS NULL
                   JOIN _basedb.physical_name n   ON n.id = f.name_id
                   JOIN _basedb.table_def t       ON t.id = f.table_id
                   JOIN _basedb.physical_name tn  ON tn.id = t.name_id
                   JOIN _basedb.db_schema s       ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn  ON sn.id = s.name_id
                   JOIN _basedb.table_index ix    ON ix.id = lc.fk_index_id
                   JOIN _basedb.physical_name ixn ON ixn.id = ix.name_id
                   JOIN _basedb.table_def tt      ON tt.id = lc.target_table_id
                   JOIN _basedb.physical_name ttn ON ttn.id = tt.name_id
                   JOIN _basedb.db_schema ts      ON ts.id = tt.schema_id
                   JOIN _basedb.physical_name tsn ON tsn.id = ts.name_id
                  WHERE {condition} AND lc.kind = 'multi_link' AND lc.fk_dropped_at IS NULL"
            ),
            &[&parameter],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| MultiLinkRow {
            field_id: r.get(0),
            column: r.get(1),
            index_id: r.get(2),
            index_name: r.get(3),
            schema_name: r.get(4),
            table_name: r.get(5),
            target_schema: r.get(6),
            target_name: r.get(7),
            target_label: r.get(8),
        })
        .collect())
}

/// `dropMultiLinks`.
pub fn drop_multi_links(links: &[MultiLinkRow], stamp: &str) -> R<Vec<String>> {
    let mut out = Vec::new();
    for link in links {
        let source = crate::naming::multi_link_trigger_name(&link.table_name, &link.column);
        let target = crate::naming::multi_link_target_trigger_name(&link.target_name, &link.table_name, &link.column);
        out.push(format!("DROP TRIGGER IF EXISTS {} ON {};", quote_identifier(&source)?, qualify(&link.schema_name, &link.table_name)?));
        out.push(format!("DROP TRIGGER IF EXISTS {} ON {};", quote_identifier(&target)?, qualify(&link.target_schema, &link.target_name)?));
        out.push(format!("DROP INDEX IF EXISTS {};", qualify(&link.schema_name, &link.index_name)?));
        out.push(format!(
            "UPDATE _basedb.field_link_config SET fk_dropped_at = {stamp}::timestamptz WHERE field_id = {}::uuid;",
            quote_literal(&link.field_id)
        ));
        out.push(format!(
            "UPDATE _basedb.table_index SET state = 'dropped', dropped_at = {stamp}::timestamptz, state_changed_at = {stamp}::timestamptz WHERE id = {}::uuid;",
            quote_literal(&link.index_id)
        ));
    }
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
fn fk_drop(schema: &str, table: &str, constraint: &str, index: &str, field_id: &str, constraint_id: &str, index_id: &str, stamp: &str) -> R<Vec<String>> {
    Ok(vec![
        format!("ALTER TABLE {} DROP CONSTRAINT IF EXISTS {};", qualify(schema, table)?, quote_identifier(constraint)?),
        format!("DROP INDEX IF EXISTS {};", qualify(schema, index)?),
        format!("UPDATE _basedb.field_link_config SET fk_dropped_at = {stamp}::timestamptz WHERE field_id = {}::uuid;", quote_literal(field_id)),
        format!(
            "UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = {stamp}::timestamptz, state_changed_at = {stamp}::timestamptz WHERE id = {}::uuid;",
            quote_literal(constraint_id)
        ),
        format!(
            "UPDATE _basedb.table_index SET state = 'dropped', dropped_at = {stamp}::timestamptz, state_changed_at = {stamp}::timestamptz WHERE id = {}::uuid;",
            quote_literal(index_id)
        ),
    ])
}

fn clear_display(id: &str) -> String {
    format!(
        "UPDATE _basedb.table_def
   SET display_field_id = NULL, display_field_kind = NULL,
       display_field_is_live = NULL, display_field_can_be_display = NULL
 WHERE id = {id};"
    )
}

#[allow(clippy::too_many_arguments)]
fn insert_name(name_id: &str, scope_kind: &str, scope_id: &str, name: &str, object_kind: &str, state: &str, previous: &str, actor: &str) -> String {
    format!(
        "INSERT INTO _basedb.physical_name
       (id, scope_kind, scope_id, name, object_kind, state, slug_version,
        previous_name_id, allocated_by)
VALUES ({}::uuid, '{scope_kind}', {}::uuid,
        {}, '{object_kind}', '{state}', 1,
        {}::uuid, {actor}::uuid);",
        quote_literal(name_id),
        quote_literal(scope_id),
        quote_literal(name),
        quote_literal(previous)
    )
}

fn retire_name(name_id: &str, stamp: &str) -> String {
    format!(
        "UPDATE _basedb.physical_name
   SET state = 'retired', state_changed_at = {stamp}::timestamptz
 WHERE id = {}::uuid;",
        quote_literal(name_id)
    )
}

fn s(r: &Row, i: usize) -> String {
    r.get(i)
}

// ── Table ──────────────────────────────────────────────────────────────────────

/// `deleteTable`.
pub async fn delete_table(pools: &Pools, ctx: &RequestContext, table_id: &str) -> R<Migration> {
    let (base_id, label, relegated, locked, statements) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let table = tx
            .first(
                "SELECT t.id::text, t.base_id::text, t.label, tn.name, t.name_id::text, t.schema_id::text,
                        sn.name AS schema_name, b.structure_state
                   FROM _basedb.table_def t
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                   JOIN _basedb.db_schema s      ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                   JOIN _basedb.base b           ON b.id = t.base_id
                   JOIN _basedb.tenant te        ON te.id = b.tenant_id
                  WHERE t.id = $1::text::uuid AND t.deleted_at IS NULL AND b.deleted_at IS NULL AND te.ref = $2",
                &[&table_id, &ctx.tenant_id],
            )
            .await?
            .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)))?;
        let (id, base_id, label, name, name_id, schema_id, schema_name, state) = (s(&table, 0), s(&table, 1), s(&table, 2), s(&table, 3), s(&table, 4), s(&table, 5), s(&table, 6), s(&table, 7));
        if state == "frozen" {
            return Err(AppError::new("BASE_STRUCTURE_FROZEN").with("base", json!(base_id)));
        }
        let grants = load_grants(&tx, ctx).await?;
        assert_manage_schema(&tx, ctx, &grants, &base_id).await?;

        let referencing = tx
            .rows(
                "SELECT ot.label AS table_label, f.label AS field_label
                   FROM _basedb.field_link_config lc
                   JOIN _basedb.field f      ON f.id = lc.field_id AND f.deleted_at IS NULL
                   JOIN _basedb.table_def ot ON ot.id = f.table_id AND ot.deleted_at IS NULL
                  WHERE lc.target_table_id = $1::text::uuid AND lc.fk_dropped_at IS NULL AND ot.id <> $1::text::uuid",
                &[&table_id],
            )
            .await?;
        if !referencing.is_empty() {
            let by: Vec<String> = referencing.iter().map(|r| format!("{}.{}", s(r, 0), s(r, 1))).collect();
            return Err(AppError::new("TABLE_REFERENCED").with("table", json!(label)).with("by", json!(by)));
        }
        let borne = tx
            .rows(
                "SELECT lc.field_id::text, lc.fk_constraint_id::text AS constraint_id, cn.name AS constraint_name,
                        lc.fk_index_id::text AS index_id, ixn.name AS index_name, tt.label AS target_label
                   FROM _basedb.field_link_config lc
                   JOIN _basedb.field f            ON f.id = lc.field_id AND f.deleted_at IS NULL
                   JOIN _basedb.table_constraint c ON c.id = lc.fk_constraint_id
                   JOIN _basedb.physical_name cn   ON cn.id = c.name_id
                   JOIN _basedb.table_index ix     ON ix.id = lc.fk_index_id
                   JOIN _basedb.physical_name ixn  ON ixn.id = ix.name_id
                   JOIN _basedb.table_def tt       ON tt.id = lc.target_table_id
                  WHERE f.table_id = $1::text::uuid AND lc.fk_dropped_at IS NULL",
                &[&table_id],
            )
            .await?;
        let multi = load_multi_links(&tx, "f.table_id = $1::text::uuid", table_id).await?;
        let views = tx
            .rows(
                "SELECT v.id::text, n.name, sn.name AS schema_name
                   FROM _basedb.sql_view_alias v
                   JOIN _basedb.physical_name n  ON n.id = v.name_id
                   JOIN _basedb.db_schema s      ON s.id = v.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                  WHERE v.target_table_id = $1::text::uuid AND v.dropped_at IS NULL",
                &[&table_id],
            )
            .await?;

        let at = ctx.timestamp;
        let stamp = quote_literal(&iso(at));
        let actor = quote_literal(&ctx.actor.id);
        let idq = format!("{}::uuid", quote_literal(&id));
        let mut reserved = HashSet::new();
        let relegated = free_name(&tx, &schema_id, &relegated_name(&name, at), &mut reserved, PhysicalScope::Relation(&schema_name)).await?;
        let name_id_new = new_id();
        let mut st: Vec<String> = Vec::new();
        for l in &borne {
            st.extend(fk_drop(&schema_name, &name, &s(l, 2), &s(l, 4), &s(l, 0), &s(l, 1), &s(l, 3), &stamp)?);
        }
        st.extend(drop_multi_links(&multi, &stamp)?);
        for v in &views {
            st.push(format!("DROP VIEW IF EXISTS {};", qualify(&s(v, 2), &s(v, 1))?));
            st.push(format!("UPDATE _basedb.sql_view_alias SET dropped_at = {stamp}::timestamptz WHERE id = {}::uuid;", quote_literal(&s(v, 0))));
        }
        st.push(clear_display(&idq));
        st.push(format!(
            "UPDATE _basedb.field
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid, is_live = false
 WHERE table_id = {idq} AND deleted_at IS NULL;"
        ));
        st.push(insert_name(&name_id_new, "schema", &schema_id, &relegated, "table", "relegated", &name_id, &actor));
        st.push(retire_name(&name_id, &stamp));
        st.push(format!("ALTER TABLE {} RENAME TO {};", qualify(&schema_name, &name)?, quote_identifier(&relegated)?));
        st.push(format!(
            "UPDATE _basedb.table_def
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid, is_live = false,
       name_id = {}::uuid
 WHERE id = {idq};",
            quote_literal(&name_id_new)
        ));
        st.push(format!(
            "UPDATE _basedb.view_def
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid
 WHERE table_id = {idq} AND deleted_at IS NULL;"
        ));
        let mut locked: Vec<String> = borne.iter().map(|l| s(l, 5)).collect();
        locked.extend(multi.iter().map(|m| m.target_label.clone()));
        Ok((base_id, label, relegated, locked, st))
    })
    .await?;
    engine::run(
        pools,
        ctx,
        &Proposal {
            base_id,
            label: format!("Suppression logique de la table « {label} »"),
            origin: origin_of(ctx),
            steps: vec![Step::new(format!("Reléguer « {label} »"), statements, "exclusive")],
            catalog_diff: engine::diff(&[("operation", json!("delete_table")), ("table", json!(label)), ("relegated_name", json!(relegated)), ("locked_tables", json!(locked))]),
            affected_objects: Some(json!([{ "kind": "table", "label": label, "relegated": relegated }])),
        },
    )
    .await
}

/// `previewTableDeletion`, as the route publishes it.
pub async fn preview_table_deletion(pools: &Pools, ctx: &RequestContext, table_id: &str) -> R<Value> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let table = tx
            .first(
                "SELECT t.label, tn.name, sn.name AS schema_name
                   FROM _basedb.table_def t
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                   JOIN _basedb.db_schema s      ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                   JOIN _basedb.base b           ON b.id = t.base_id
                   JOIN _basedb.tenant te        ON te.id = b.tenant_id
                  WHERE t.id = $1::text::uuid AND t.deleted_at IS NULL AND te.ref = $2",
                &[&table_id, &ctx.tenant_id],
            )
            .await?
            .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)))?;
        let referencing: Vec<String> = tx
            .rows(
                "SELECT ot.label || '.' || f.label AS label
                   FROM _basedb.field_link_config lc
                   JOIN _basedb.field f      ON f.id = lc.field_id AND f.deleted_at IS NULL
                   JOIN _basedb.table_def ot ON ot.id = f.table_id AND ot.deleted_at IS NULL
                  WHERE lc.target_table_id = $1::text::uuid AND lc.fk_dropped_at IS NULL AND ot.id <> $1::text::uuid",
                &[&table_id],
            )
            .await?
            .iter()
            .map(|r| s(r, 0))
            .collect();
        let locked: Vec<String> = tx
            .rows(
                "SELECT DISTINCT tt.label
                   FROM _basedb.field_link_config lc
                   JOIN _basedb.field f      ON f.id = lc.field_id AND f.deleted_at IS NULL
                   JOIN _basedb.table_def tt ON tt.id = lc.target_table_id
                  WHERE f.table_id = $1::text::uuid AND lc.fk_dropped_at IS NULL",
                &[&table_id],
            )
            .await?
            .iter()
            .map(|r| s(r, 0))
            .collect();
        let (name, schema) = (s(&table, 1), s(&table, 2));
        let estimate = tx
            .first(
                "SELECT CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS rows
                   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = $1 AND c.relname = $2",
                &[&schema, &name],
            )
            .await?
            .and_then(|r| r.get::<_, Option<i64>>(0));
        Ok(json!({
            "label": s(&table, 0),
            "row_count": estimate,
            "referenced_by": referencing,
            "locked_tables": locked,
            "relegated_name": relegated_name(&name, ctx.timestamp),
        }))
    })
    .await
}

// ── Base ───────────────────────────────────────────────────────────────────────

struct PlannedTable {
    id: String,
    name: String,
    label: String,
    relegated: String,
    name_id: String,
    previous_name_id: String,
}

/// `deleteBase` of the kernel: every environment of the base, production last.
pub async fn delete_base(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Migration> {
    let order = deletion_order(pools, ctx, base_id).await?;
    let mut last = None;
    for id in &order {
        let m = delete_one_base(pools, ctx, id).await?;
        if m.status != "applied" {
            return Ok(m);
        }
        last = Some(m);
    }
    match last {
        Some(m) => Ok(m),
        None => delete_one_base(pools, ctx, base_id).await,
    }
}

/// `deletionOrder` (`environments/family.ts`).
pub async fn deletion_order(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Vec<String>> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let family = crate::family::load_family(&tx, ctx, base_id).await?;
        let mut envs = family.environments;
        envs.sort_by_key(|e| e.production);
        Ok(envs.into_iter().map(|e| e.id).collect())
    })
    .await
}

/// `deleteBase` of `lifecycle.ts`: one base.
pub async fn delete_one_base(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Migration> {
    let plan = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        assert_administration(&grants, base_id)?;
        build_deletion_plan(&tx, ctx, base_id).await
    })
    .await?;
    let (label, schema, relegated_schema, tables, aliases, steps) = plan;
    let mut affected: Vec<Value> = tables.iter().map(|t| json!({ "kind": "table", "name": t.name, "label": t.label })).collect();
    affected.extend(aliases.iter().map(|(_, n)| json!({ "kind": "schema", "name": n })));
    engine::run(
        pools,
        ctx,
        &Proposal {
            base_id: base_id.to_string(),
            label: format!("Suppression logique de « {label} »"),
            origin: origin_of(ctx),
            steps,
            catalog_diff: engine::diff(&[
                ("operation", json!("delete_base")),
                ("base", json!(label)),
                ("schema", json!(schema)),
                ("relegated_schema", json!(relegated_schema)),
                ("tables", json!(tables.len())),
                ("alias_schemas", json!(aliases.len())),
            ]),
            affected_objects: Some(Value::Array(affected)),
        },
    )
    .await
}

type DeletionPlan = (String, String, String, Vec<PlannedTable>, Vec<(String, String)>, Vec<Step>);

async fn build_deletion_plan<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<DeletionPlan> {
    let base = exec
        .first(
            "SELECT b.label, b.is_live, b.structure_state, t.ref AS tenant_ref
               FROM _basedb.base b
               JOIN _basedb.tenant t ON t.id = b.tenant_id
              WHERE b.id = $1::text::uuid",
            &[&base_id],
        )
        .await?
        .filter(|r| r.get::<_, bool>(1))
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)))?;
    if s(&base, 2) == "frozen" {
        return Err(AppError::new("BASE_STRUCTURE_FROZEN").with("base", json!(base_id)));
    }
    let (label, tenant_ref) = (s(&base, 0), s(&base, 3));
    let current = exec
        .first(
            "SELECT s.id::text, n.name, s.name_id::text
               FROM _basedb.db_schema s
               JOIN _basedb.physical_name n ON n.id = s.name_id
              WHERE s.base_id = $1::text::uuid AND s.role = 'current' AND s.dropped_at IS NULL",
            &[&base_id],
        )
        .await?
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)))?;
    let (schema_id, schema_name, schema_name_id) = (s(&current, 0), s(&current, 1), s(&current, 2));
    let tables = exec
        .rows(
            "SELECT t.id::text, n.name, t.label, t.name_id::text
               FROM _basedb.table_def t
               JOIN _basedb.physical_name n ON n.id = t.name_id
              WHERE t.base_id = $1::text::uuid AND t.deleted_at IS NULL
              ORDER BY t.position, t.id",
            &[&base_id],
        )
        .await?;
    if tables.len() > TABLE_BATCH * 32 {
        return Err(AppError::new("MIGRATION_TOO_LARGE").with("tables", json!(tables.len())).with("maximum", json!(TABLE_BATCH * 32)));
    }
    let aliases: Vec<(String, String)> = exec
        .rows(
            "SELECT s.id::text, n.name
               FROM _basedb.db_schema s
               JOIN _basedb.physical_name n ON n.id = s.name_id
              WHERE s.base_id = $1::text::uuid AND s.role = 'alias' AND s.dropped_at IS NULL",
            &[&base_id],
        )
        .await?
        .iter()
        .map(|r| (s(r, 0), s(r, 1)))
        .collect();
    let mut schemas = vec![schema_name.clone()];
    schemas.extend(aliases.iter().map(|(_, n)| n.clone()));
    assert_no_unknown_dependent(exec, &schemas).await?;

    let at = ctx.timestamp;
    let stamp = quote_literal(&iso(at));
    let actor = quote_literal(&ctx.actor.id);
    let mut reserved = HashSet::new();
    let mut planned = Vec::new();
    for t in &tables {
        let name = s(t, 1);
        let relegated = free_name(exec, &schema_id, &relegated_name(&name, at), &mut reserved, PhysicalScope::Relation(&schema_name)).await?;
        planned.push(PlannedTable { id: s(t, 0), name, label: s(t, 2), relegated, name_id: new_id(), previous_name_id: s(t, 3) });
    }
    let slug = parse_schema_name(&schema_name).map(|(_, slug)| slug).unwrap_or_else(|| schema_name.clone());
    let suffix = format!("zz_supprime_{}_{}", relegation_date(at), truncate_bytes(&slug, MAX_RELEGATED_BASE_SLUG_BYTES));
    let relegated_schema = free_name(exec, SCOPE_INSTANCE, &format!("b_{tenant_ref}_{suffix}"), &mut reserved, PhysicalScope::Schema).await?;
    let schema_name_new = new_id();

    let mut steps = Vec::new();
    let links = exec
        .rows(
            "SELECT lc.field_id::text, lc.fk_constraint_id::text AS constraint_id, cn.name AS constraint_name,
                    lc.fk_index_id::text AS index_id, ixn.name AS index_name, tn.name AS table_name
               FROM _basedb.field_link_config lc
               JOIN _basedb.field f            ON f.id = lc.field_id
               JOIN _basedb.table_def t        ON t.id = f.table_id
               JOIN _basedb.physical_name tn   ON tn.id = t.name_id
               JOIN _basedb.table_constraint c ON c.id = lc.fk_constraint_id
               JOIN _basedb.physical_name cn   ON cn.id = c.name_id
               JOIN _basedb.table_index ix     ON ix.id = lc.fk_index_id
               JOIN _basedb.physical_name ixn  ON ixn.id = ix.name_id
              WHERE lc.base_id = $1::text::uuid AND lc.fk_dropped_at IS NULL AND t.deleted_at IS NULL",
            &[&base_id],
        )
        .await?;
    let multi = load_multi_links(exec, "lc.base_id = $1::text::uuid AND t.deleted_at IS NULL", base_id).await?;
    for batch in multi.chunks(TABLE_BATCH) {
        let n = batch.len();
        steps.push(Step::new(format!("Détacher {n} relation{} multiple{}", plural(n, "s"), plural(n, "s")), drop_multi_links(batch, &stamp)?, "exclusive"));
    }
    for batch in links.chunks(TABLE_BATCH) {
        let mut st = Vec::new();
        for l in batch {
            st.extend(fk_drop(&schema_name, &s(l, 5), &s(l, 2), &s(l, 4), &s(l, 0), &s(l, 1), &s(l, 3), &stamp)?);
        }
        let n = batch.len();
        steps.push(Step::new(format!("Détacher {n} lien{}", plural(n, "s")), st, "exclusive"));
    }
    for batch in planned.chunks(TABLE_BATCH) {
        let mut st = Vec::new();
        for t in batch {
            let id = format!("{}::uuid", quote_literal(&t.id));
            st.push(clear_display(&id));
            st.push(format!(
                "UPDATE _basedb.field
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid, is_live = false
 WHERE table_id = {id} AND deleted_at IS NULL;"
            ));
            st.push(insert_name(&t.name_id, "schema", &schema_id, &t.relegated, "table", "relegated", &t.previous_name_id, &actor));
            st.push(retire_name(&t.previous_name_id, &stamp));
            st.push(format!("ALTER TABLE {} RENAME TO {};", qualify(&schema_name, &t.name)?, quote_identifier(&t.relegated)?));
            st.push(format!(
                "UPDATE _basedb.table_def
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid, is_live = false,
       name_id = {}::uuid
 WHERE id = {id};",
                quote_literal(&t.name_id)
            ));
        }
        let n = batch.len();
        steps.push(Step::new(format!("Reléguer {n} table{}", plural(n, "s")), st, "exclusive"));
    }
    for (alias_id, alias_name) in &aliases {
        let views = exec
            .rows(
                "SELECT v.id::text, n.name
                   FROM _basedb.sql_view_alias v
                   JOIN _basedb.physical_name n ON n.id = v.name_id
                  WHERE v.schema_id = $1::text::uuid AND v.dropped_at IS NULL",
                &[alias_id],
            )
            .await?;
        for batch in views.chunks(VIEW_BATCH) {
            let mut st = Vec::new();
            for v in batch {
                st.push(format!("DROP VIEW IF EXISTS {};", qualify(alias_name, &s(v, 1))?));
                st.push(format!("UPDATE _basedb.sql_view_alias SET dropped_at = {stamp}::timestamptz WHERE id = {}::uuid;", quote_literal(&s(v, 0))));
            }
            let n = batch.len();
            steps.push(Step::new(format!("Supprimer {n} vue{} d’alias", plural(n, "s")), st, "short"));
        }
        steps.push(Step::new(
            format!("Supprimer le schéma d’alias {alias_name}"),
            vec![
                format!("DROP SCHEMA IF EXISTS {} RESTRICT;", quote_identifier(alias_name)?),
                format!("UPDATE _basedb.db_schema SET dropped_at = {stamp}::timestamptz WHERE id = {}::uuid;", quote_literal(alias_id)),
            ],
            "short",
        ));
    }
    let bq = quote_literal(base_id);
    steps.push(Step::new(
        "Reléguer le schéma et clore la base",
        vec![
            insert_name(&schema_name_new, "instance", SCOPE_INSTANCE, &relegated_schema, "schema", "relegated", &schema_name_id, &actor),
            retire_name(&schema_name_id, &stamp),
            format!("ALTER SCHEMA {} RENAME TO {};", quote_identifier(&schema_name)?, quote_identifier(&relegated_schema)?),
            format!(
                "UPDATE _basedb.db_schema
   SET name_id = {}::uuid
 WHERE id = {}::uuid;",
                quote_literal(&schema_name_new),
                quote_literal(&schema_id)
            ),
            format!(
                "UPDATE _basedb.view_def
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid
 WHERE deleted_at IS NULL
   AND table_id IN (SELECT id FROM _basedb.table_def
                     WHERE base_id = {bq}::uuid);"
            ),
            format!(
                "UPDATE _basedb.application
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid
 WHERE base_id = {bq}::uuid AND deleted_at IS NULL;"
            ),
            format!(
                "UPDATE _basedb.base
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid, is_live = false
 WHERE id = {bq}::uuid;"
            ),
        ],
        "short",
    ));
    Ok((label, schema_name, relegated_schema, planned, aliases, steps))
}

/// `restoreBase`.
pub async fn restore_base(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Migration> {
    let (label, count, steps) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let grants = load_grants(&tx, ctx).await?;
        assert_administration(&grants, base_id)?;
        build_restoration_plan(&tx, ctx, base_id).await
    })
    .await?;
    engine::run(
        pools,
        ctx,
        &Proposal {
            base_id: base_id.to_string(),
            label: format!("Restauration de « {label} »"),
            origin: origin_of(ctx),
            steps,
            catalog_diff: engine::diff(&[("operation", json!("restore_base")), ("base", json!(label)), ("tables", json!(count))]),
            affected_objects: None,
        },
    )
    .await
}

async fn build_restoration_plan<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<(String, usize, Vec<Step>)> {
    let base = exec
        .first(
            "SELECT b.label, b.label_key, b.deleted_at IS NOT NULL, b.is_purged, t.ref AS tenant_ref,
                    b.project_id::text, p.deleted_at IS NULL AS project_live
               FROM _basedb.base b
               JOIN _basedb.tenant t  ON t.id = b.tenant_id
               JOIN _basedb.project p ON p.id = b.project_id
              WHERE b.id = $1::text::uuid",
            &[&base_id],
        )
        .await?
        .filter(|r| r.get::<_, bool>(2))
        .ok_or_else(|| AppError::new("RESTORE_TARGET_MISSING").with("base", json!(base_id)))?;
    if base.get::<_, bool>(3) {
        return Err(AppError::new("TARGET_PURGED").with("base", json!(base_id)));
    }
    let (label, label_key, tenant_ref) = (s(&base, 0), s(&base, 1), s(&base, 4));
    let project_id = if base.get::<_, bool>(6) { s(&base, 5) } else { default_project_id(exec, ctx).await? };
    let taken = exec
        .rows(
            "SELECT b.id FROM _basedb.base b
              WHERE b.project_id = $1::text::uuid AND b.label_key = $2 AND b.deleted_at IS NULL",
            &[&project_id, &label_key],
        )
        .await?;
    if !taken.is_empty() {
        return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)));
    }
    let schema = exec
        .first(
            "SELECT s.id::text, n.name, s.name_id::text
               FROM _basedb.db_schema s JOIN _basedb.physical_name n ON n.id = s.name_id
              WHERE s.base_id = $1::text::uuid AND s.role = 'current' AND s.dropped_at IS NULL",
            &[&base_id],
        )
        .await?
        .ok_or_else(|| AppError::new("RESTORE_TARGET_MISSING").with("base", json!(base_id)))?;
    let (schema_id, schema_name, schema_name_id) = (s(&schema, 0), s(&schema, 1), s(&schema, 2));
    let tables = exec
        .rows(
            "SELECT t.id::text, n.name, t.name_id::text, n.previous_name_id::text AS previous
               FROM _basedb.table_def t JOIN _basedb.physical_name n ON n.id = t.name_id
              WHERE t.base_id = $1::text::uuid AND t.deleted_at IS NOT NULL AND t.is_purged = false",
            &[&base_id],
        )
        .await?;
    let stamp = quote_literal(&iso(ctx.timestamp));
    let actor = quote_literal(&ctx.actor.id);
    let mut reserved = HashSet::new();
    let mut steps = Vec::new();
    let slug = strip_relegation(&parse_schema_name(&schema_name).map(|(_, s)| s).unwrap_or_else(|| "base".into()));
    let restored_schema = free_name(exec, SCOPE_INSTANCE, &format!("b_{tenant_ref}_{}", truncate_bytes(&slug, 53)), &mut reserved, PhysicalScope::Schema).await?;
    let schema_name_new = new_id();
    steps.push(Step::new(
        "Rouvrir la base",
        vec![
            insert_name(&schema_name_new, "instance", SCOPE_INSTANCE, &restored_schema, "schema", "active", &schema_name_id, &actor),
            format!("ALTER SCHEMA {} RENAME TO {};", quote_identifier(&schema_name)?, quote_identifier(&restored_schema)?),
            format!(
                "UPDATE _basedb.db_schema
   SET name_id = {}::uuid
 WHERE id = {}::uuid;",
                quote_literal(&schema_name_new),
                quote_literal(&schema_id)
            ),
            format!(
                "UPDATE _basedb.base
   SET deleted_at = NULL, deleted_by = NULL, is_live = true,
       project_id = {}::uuid,
       updated_at = {stamp}::timestamptz, updated_by = {actor}::uuid
 WHERE id = {}::uuid;",
                quote_literal(&project_id),
                quote_literal(base_id)
            ),
        ],
        "short",
    ));
    for batch in tables.chunks(TABLE_BATCH) {
        let mut st = Vec::new();
        for t in batch {
            let (tid, name, name_id, previous) = (s(t, 0), s(t, 1), s(t, 2), t.get::<_, Option<String>>(3));
            let previous_name = match previous {
                None => None,
                Some(p) => exec.first("SELECT name FROM _basedb.physical_name WHERE id = $1::text::uuid", &[&p]).await?.map(|r| s(&r, 0)),
            };
            let wanted = strip_relegation(previous_name.as_deref().unwrap_or(&name));
            let restored = free_name(exec, &schema_id, &wanted, &mut reserved, PhysicalScope::Relation(&restored_schema)).await?;
            let nid = new_id();
            st.push(insert_name(&nid, "schema", &schema_id, &restored, "table", "active", &name_id, &actor));
            st.push(format!("ALTER TABLE {} RENAME TO {};", qualify(&restored_schema, &name)?, quote_identifier(&restored)?));
            st.push(format!(
                "UPDATE _basedb.table_def
   SET deleted_at = NULL, deleted_by = NULL, is_live = true,
       name_id = {}::uuid
 WHERE id = {}::uuid;",
                quote_literal(&nid),
                quote_literal(&tid)
            ));
            st.push(format!(
                "UPDATE _basedb.field f
   SET deleted_at = NULL, deleted_by = NULL, is_live = true
 WHERE f.table_id = {}::uuid AND f.is_purged = false
   AND NOT EXISTS (SELECT 1 FROM _basedb.physical_name n
                    WHERE n.id = f.name_id AND n.state = 'relegated');",
                quote_literal(&tid)
            ));
        }
        let n = batch.len();
        steps.push(Step::new(format!("Restaurer {n} table{}", plural(n, "s")), st, "exclusive"));
    }
    Ok((label, tables.len(), steps))
}

// ── Field ──────────────────────────────────────────────────────────────────────

struct Located {
    id: String,
    label: String,
    kind: String,
    name: String,
    name_id: String,
    table_id: String,
    table_label: String,
    table_name: String,
    base_id: String,
    schema_name: String,
    structure_state: String,
    is_display: bool,
}

async fn locate_field<E: Exec + Sync>(exec: &E, ctx: &RequestContext, field_id: &str) -> R<Located> {
    let row = exec
        .first(
            "SELECT f.id::text, f.label, f.kind, n.name, f.name_id::text, t.id::text AS table_id,
                    t.label AS table_label, tn.name AS table_name, t.base_id::text,
                    sn.name AS schema_name, b.structure_state,
                    coalesce(t.display_field_id = f.id, false) AS is_display
               FROM _basedb.field f
               JOIN _basedb.physical_name n  ON n.id = f.name_id
               JOIN _basedb.table_def t      ON t.id = f.table_id AND t.deleted_at IS NULL
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
               JOIN _basedb.base b           ON b.id = t.base_id AND b.deleted_at IS NULL
               JOIN _basedb.tenant te        ON te.id = b.tenant_id
              WHERE f.id = $1::text::uuid AND f.deleted_at IS NULL AND te.ref = $2",
            &[&field_id, &ctx.tenant_id],
        )
        .await?;
    match row {
        Some(r) if !SYSTEM_COLUMNS.contains(&s(&r, 3).as_str()) => Ok(Located {
            id: s(&r, 0),
            label: s(&r, 1),
            kind: s(&r, 2),
            name: s(&r, 3),
            name_id: s(&r, 4),
            table_id: s(&r, 5),
            table_label: s(&r, 6),
            table_name: s(&r, 7),
            base_id: s(&r, 8),
            schema_name: s(&r, 9),
            structure_state: s(&r, 10),
            is_display: r.get(11),
        }),
        _ => Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id))),
    }
}

fn citation(name: &str) -> String {
    format!("\\{{\\{{\\s*{name}\\s*\\}}\\}}")
}

async fn users_of<E: Exec + Sync>(exec: &E, f: &Located) -> R<Vec<Value>> {
    let mut out = Vec::new();
    for r in exec
        .rows(
            "SELECT ff.label
               FROM _basedb.field_formula_dependency d
               JOIN _basedb.field ff ON ff.id = d.formula_field_id AND ff.deleted_at IS NULL
              WHERE d.depends_on_field_id = $1::text::uuid
              ORDER BY ff.position",
            &[&f.id],
        )
        .await?
    {
        out.push(json!({ "kind": "formula", "label": s(&r, 0), "table": null }));
    }
    for r in exec
        .rows(
            "SELECT rf.kind, rf.label, rt.id::text AS table_id, rt.label AS table_label
               FROM _basedb.field_rollup_config rc
               JOIN _basedb.field rf     ON rf.id = rc.field_id AND rf.deleted_at IS NULL
               JOIN _basedb.table_def rt ON rt.id = rf.table_id AND rt.deleted_at IS NULL
              WHERE rc.via_field_id = $1::text::uuid OR rc.target_field_id = $1::text::uuid
              ORDER BY rt.label, rf.position",
            &[&f.id],
        )
        .await?
    {
        let table = if s(&r, 2) == f.table_id { Value::Null } else { json!(s(&r, 3)) };
        out.push(json!({ "kind": s(&r, 0), "label": s(&r, 1), "table": table }));
    }
    let cite = citation(&f.name);
    for r in exec
        .rows(
            "SELECT f.label
               FROM _basedb.field_ai_config c
               JOIN _basedb.field f ON f.id = c.field_id AND f.deleted_at IS NULL
              WHERE f.table_id = $1::text::uuid AND f.id <> $2::text::uuid AND c.prompt ~ $3
              ORDER BY f.position",
            &[&f.table_id, &f.id, &cite],
        )
        .await?
    {
        out.push(json!({ "kind": "ai", "label": s(&r, 0), "table": null }));
    }
    for r in exec
        .rows(
            "SELECT f.label
               FROM _basedb.field_button_config c
               JOIN _basedb.field f ON f.id = c.field_id AND f.deleted_at IS NULL
              WHERE f.table_id = $1::text::uuid AND c.url_template ~ $2
              ORDER BY f.position",
            &[&f.table_id, &cite],
        )
        .await?
    {
        out.push(json!({ "kind": "button", "label": s(&r, 0), "table": null }));
    }
    for r in exec
        .rows(
            "SELECT r.label, rp.filter
               FROM _basedb.row_permission rp
               JOIN _basedb.role r ON r.id = rp.role_id
              WHERE rp.table_id = $1::text::uuid
              ORDER BY r.label",
            &[&f.table_id],
        )
        .await?
    {
        if crate::views::cited_fields(&s(&r, 1)).contains(&f.name) {
            out.push(json!({ "kind": "row_rule", "label": s(&r, 0), "table": null }));
        }
    }
    Ok(out)
}

struct Column {
    notnull: bool,
    identity: bool,
    generated: bool,
}

async fn column_of<E: Exec + Sync>(exec: &E, f: &Located) -> R<Option<Column>> {
    let q = qualify(&f.schema_name, &f.table_name)?;
    Ok(exec
        .first(
            "SELECT a.attnotnull AS notnull, a.attidentity <> '' AS identity,
                    a.attgenerated <> '' AS generated
               FROM pg_attribute a
              WHERE a.attrelid = to_regclass($1) AND a.attname = $2 AND NOT a.attisdropped",
            &[&q, &f.name],
        )
        .await?
        .map(|r| Column { notnull: r.get(0), identity: r.get(1), generated: r.get(2) }))
}

/// `ColumnView`: `(kind, name)`.
async fn views_on<E: Exec + Sync>(exec: &E, f: &Located) -> R<Vec<(&'static str, String)>> {
    let q = qualify(&f.schema_name, &f.table_name)?;
    let rows = exec
        .rows(
            "SELECT DISTINCT dn.nspname::text AS schema, dc.relname::text AS name,
                    EXISTS (SELECT 1 FROM _basedb.sql_view_alias v
                              JOIN _basedb.physical_name vn ON vn.id = v.name_id
                              JOIN _basedb.db_schema vs     ON vs.id = v.schema_id
                              JOIN _basedb.physical_name vsn ON vsn.id = vs.name_id
                             WHERE v.dropped_at IS NULL AND vn.name = dc.relname
                               AND vsn.name = dn.nspname) AS alias,
                    (SELECT sv.label FROM _basedb.sql_view sv
                       JOIN _basedb.physical_name svn ON svn.id = sv.name_id
                       JOIN _basedb.db_schema ss      ON ss.id = sv.schema_id
                       JOIN _basedb.physical_name ssn ON ssn.id = ss.name_id
                      WHERE svn.name = dc.relname AND ssn.name = dn.nspname
                      LIMIT 1) AS label
               FROM pg_attribute a
               JOIN pg_depend d     ON d.refclassid = 'pg_class'::regclass AND d.refobjid = a.attrelid
                                   AND d.refobjsubid = a.attnum
               JOIN pg_rewrite r    ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
               JOIN pg_class dc     ON dc.oid = r.ev_class
               JOIN pg_namespace dn ON dn.oid = dc.relnamespace
              WHERE a.attrelid = to_regclass($1) AND a.attname = $2 AND dc.oid <> a.attrelid
              ORDER BY 1, 2",
            &[&q, &f.name],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let (schema, name, alias, label) = (s(r, 0), s(r, 1), r.get::<_, bool>(2), r.get::<_, Option<String>>(3));
            if alias {
                ("alias", format!("{schema}.{name}"))
            } else if let Some(l) = label {
                ("sql_view", l)
            } else {
                ("other", format!("{schema}.{name}"))
            }
        })
        .collect())
}

async fn link_of<E: Exec + Sync>(exec: &E, f: &Located) -> R<Option<(String, String, String)>> {
    Ok(exec
        .first(
            "SELECT lc.kind, lc.on_delete, tt.label AS target_label
               FROM _basedb.field_link_config lc
               JOIN _basedb.table_def tt ON tt.id = lc.target_table_id
              WHERE lc.field_id = $1::text::uuid AND lc.fk_dropped_at IS NULL",
            &[&f.id],
        )
        .await?
        .map(|r| (s(&r, 0), s(&r, 1), s(&r, 2))))
}

async fn free_column_name<E: Exec + Sync>(exec: &E, f: &Located, at: chrono::DateTime<chrono::Utc>) -> R<String> {
    let wanted = relegated_name(&f.name, at);
    let q = qualify(&f.schema_name, &f.table_name)?;
    for rank in 1..=99u32 {
        let suffix = if rank == 1 { String::new() } else { format!("_{rank}") };
        let candidate = format!("{}{suffix}", truncate_bytes(&wanted, 63 - suffix.len()));
        let n: i64 = exec
            .rows(
                "SELECT (SELECT count(*) FROM _basedb.physical_name WHERE scope_id = $1::text::uuid AND name = $2)
                      + (SELECT count(*) FROM pg_attribute
                          WHERE attrelid = to_regclass($3) AND attname = $2) AS n",
                &[&f.table_id, &candidate, &q],
            )
            .await?[0]
            .get(0);
        if n == 0 {
            return Ok(candidate);
        }
    }
    Err(AppError::new("NAME_COLLISION_UNRESOLVED").with("name", json!(wanted)))
}

/// `previewFieldDeletion`, as the route publishes it.
pub async fn preview_field_deletion(pools: &Pools, ctx: &RequestContext, field_id: &str) -> R<Value> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let f = locate_field(&tx, ctx, field_id).await?;
        require_on_table(&tx, ctx, Action::ManageSchema, &f.table_id).await?;
        let link = link_of(&tx, &f).await?;
        let column = column_of(&tx, &f).await?;
        let users = users_of(&tx, &f).await?;
        let views: Vec<Value> = if column.is_none() {
            Vec::new()
        } else {
            views_on(&tx, &f).await?.into_iter().map(|(k, n)| json!({ "kind": k, "name": n })).collect()
        };
        let saved = tx
            .rows(
                "SELECT label, spec FROM _basedb.view_def
                  WHERE table_id = $1::text::uuid AND deleted_at IS NULL AND (owner_id IS NULL OR owner_id = $2::text::uuid)
                  ORDER BY position, label",
                &[&f.table_id, &ctx.actor.id],
            )
            .await?;
        let mut saved_views = Vec::new();
        for r in &saved {
            let spec: Option<Value> = r.get(1);
            let empty = Map::new();
            let map = spec.as_ref().and_then(Value::as_object).unwrap_or(&empty);
            if let Some(loses) = crate::views::view_loss(map, &f.name) {
                saved_views.push(json!({ "label": s(r, 0), "loses": loses }));
            }
        }
        let locked: Vec<String> = match &link {
            Some((_, _, target)) if *target != f.table_label => vec![target.clone()],
            _ => vec![],
        };
        Ok(json!({
            "label": f.label,
            "kind": f.kind,
            "is_display": f.is_display,
            "used_by": users,
            "views": views,
            "saved_views": saved_views,
            "locked_tables": locked,
            "cascade_lost": link.as_ref().is_some_and(|(_, d, _)| d == "cascade"),
            "relegated_name": column.map(|_| relegated_name(&f.name, ctx.timestamp)),
        }))
    })
    .await
}

/// `deleteField`.
pub async fn delete_field(pools: &Pools, ctx: &RequestContext, field_id: &str) -> R<Migration> {
    let (base_id, label, table_label, relegated, locked, statements) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let f = locate_field(&tx, ctx, field_id).await?;
        if f.structure_state == "frozen" {
            return Err(AppError::new("BASE_STRUCTURE_FROZEN").with("base", json!(f.base_id)));
        }
        require_on_table(&tx, ctx, Action::ManageSchema, &f.table_id).await?;
        if f.is_display {
            return Err(AppError::new("DISPLAY_FIELD_IN_USE").with("field", json!(f.label)).with("table", json!(f.table_label)));
        }
        let users = users_of(&tx, &f).await?;
        if !users.is_empty() {
            return Err(AppError::new("FIELD_USED_BY_FORMULA").with("field", json!(f.label)).with("by", json!(users)));
        }
        let column = column_of(&tx, &f).await?;
        let views = if column.is_none() { Vec::new() } else { views_on(&tx, &f).await? };
        let alias: Vec<&String> = views.iter().filter(|(k, _)| *k == "alias").map(|(_, n)| n).collect();
        if !alias.is_empty() {
            return Err(AppError::new("COLUMN_HAS_VIEW_DEPENDENCIES").with("field", json!(f.label)).with("views", json!(alias)));
        }
        if let Some((kind, name)) = views.first() {
            let mut e = AppError::new("DEPENDENT_OBJECT").with("dependent", json!(name)).with("referenced", json!(f.label));
            if *kind == "sql_view" {
                e = e.with("kind", json!("sql_view"));
            }
            return Err(e);
        }
        let at = ctx.timestamp;
        let stamp = quote_literal(&iso(at));
        let actor = quote_literal(&ctx.actor.id);
        let idq = format!("{}::uuid", quote_literal(&f.id));
        let table = qualify(&f.schema_name, &f.table_name)?;
        let mut st = Vec::new();
        let link = link_of(&tx, &f).await?;
        match &link {
            Some((kind, _, _)) if kind == "multi_link" => {
                let multi = load_multi_links(&tx, "f.id = $1::text::uuid", &f.id).await?;
                st.extend(drop_multi_links(&multi, &stamp)?);
            }
            Some(_) => st.push(format!("UPDATE _basedb.field_link_config SET fk_dropped_at = {stamp}::timestamptz WHERE field_id = {idq};")),
            None => {}
        }
        for c in tx
            .rows(
                "SELECT DISTINCT c.id::text, n.name
                   FROM _basedb.table_constraint c
                   JOIN _basedb.table_constraint_member m ON m.constraint_id = c.id
                   JOIN _basedb.physical_name n           ON n.id = c.name_id
                  WHERE m.field_id = $1::text::uuid AND c.state <> 'dropped' AND c.kind <> 'primary_key'
                  ORDER BY 2",
                &[&f.id],
            )
            .await?
        {
            st.push(format!("ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {};", quote_identifier(&s(&c, 1))?));
            st.push(format!(
                "UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = {stamp}::timestamptz, state_changed_at = {stamp}::timestamptz WHERE id = {}::uuid;",
                quote_literal(&s(&c, 0))
            ));
        }
        for ix in tx
            .rows(
                "SELECT DISTINCT ix.id::text, n.name
                   FROM _basedb.table_index ix
                   JOIN _basedb.table_index_member m ON m.index_id = ix.id
                   JOIN _basedb.physical_name n      ON n.id = ix.name_id
                  WHERE m.field_id = $1::text::uuid AND ix.state <> 'dropped'
                  ORDER BY 2",
                &[&f.id],
            )
            .await?
        {
            st.push(format!("DROP INDEX IF EXISTS {};", qualify(&f.schema_name, &s(&ix, 1))?));
            st.push(format!(
                "UPDATE _basedb.table_index SET state = 'dropped', dropped_at = {stamp}::timestamptz, state_changed_at = {stamp}::timestamptz WHERE id = {}::uuid;",
                quote_literal(&s(&ix, 0))
            ));
        }
        let name_id_new = new_id();
        let relegated = match &column {
            Some(_) => Some(free_column_name(&tx, &f, at).await?),
            None => None,
        };
        if let (Some(c), Some(r)) = (&column, &relegated) {
            let col = quote_identifier(&f.name)?;
            if c.generated {
                st.push(format!("ALTER TABLE {table} ALTER COLUMN {col} DROP EXPRESSION;"));
            }
            if c.identity {
                st.push(format!("ALTER TABLE {table} ALTER COLUMN {col} DROP IDENTITY;"));
            }
            if c.notnull || c.identity {
                st.push(format!("ALTER TABLE {table} ALTER COLUMN {col} DROP NOT NULL;"));
            }
            st.push(format!("ALTER TABLE {table} RENAME COLUMN {col} TO {};", quote_identifier(r)?));
        }
        let registered = match &relegated {
            Some(r) => r.clone(),
            None => free_column_name(&tx, &f, at).await?,
        };
        st.push(insert_name(&name_id_new, "table", &f.table_id, &registered, "field", "relegated", &f.name_id, &actor));
        st.push(retire_name(&f.name_id, &stamp));
        st.push(format!(
            "UPDATE _basedb.field
   SET deleted_at = {stamp}::timestamptz, deleted_by = {actor}::uuid, is_live = false,
       name_id = {}::uuid, is_required = false, required_state = 'absent'
 WHERE id = {idq};",
            quote_literal(&name_id_new)
        ));
        let locked: Vec<String> = match &link {
            Some((_, _, target)) if *target != f.table_label => vec![target.clone()],
            _ => vec![],
        };
        Ok((f.base_id, f.label, f.table_label, relegated, locked, st))
    })
    .await?;
    engine::run(
        pools,
        ctx,
        &Proposal {
            base_id,
            label: format!("Suppression logique du champ « {label} » de « {table_label} »"),
            origin: origin_of(ctx),
            steps: vec![Step::new(format!("Reléguer « {label} »"), statements, "exclusive")],
            catalog_diff: engine::diff(&[
                ("operation", json!("delete_field")),
                ("table", json!(table_label)),
                ("field", json!(label)),
                ("relegated_name", json!(relegated)),
                ("locked_tables", json!(locked)),
            ]),
            affected_objects: Some(json!([{ "kind": "field", "label": label, "relegated": relegated }])),
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relegation_is_stripped_and_bytes_cut_on_a_boundary() {
        assert_eq!(strip_relegation("zz_supprime_20260918_clients"), "clients");
        assert_eq!(strip_relegation("zz_supprime_2026_x"), "zz_supprime_2026_x");
        assert_eq!(strip_relegation("clients"), "clients");
        assert_eq!(truncate_bytes("ééé", 3), "é");
        assert_eq!(truncate_bytes("abc", 5), "abc");
    }
}
