//! Synchronizing the ROWS of a table from one environment to another
//! (`environments/rows.ts`, chapter 14 §4): one query joining both schemas on `_id`,
//! one statement per verb — nothing leaves PostgreSQL.

use crate::environments::snapshot_options;
use crate::family::load_pair;
use crate::naming::{qualify, quote_identifier};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Verdict};
use basedb_base::rbac::loader::{load_grants, load_target};
use basedb_base::time::iso;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::future::Future;
use std::pin::Pin;
use std::sync::OnceLock;
use tokio_postgres::types::ToSql;

type R<T> = Result<T, AppError>;

/// Drains the change feed into the history (`drainHistory`, the records crate's).
pub type HistoryDrainer = fn(Pools) -> Pin<Box<dyn Future<Output = ()> + Send>>;

static DRAINER: OnceLock<HistoryDrainer> = OnceLock::new();

/// Installs the history drainer a row synchronization runs first; the server hands it
/// over at start (the catalog cannot depend on the records crate).
pub fn set_history_drainer(drain: HistoryDrainer) {
    let _ = DRAINER.set(drain);
}

const SAMPLE: usize = 20;

/// `NOT_COPIED`: files belong to one field, formulas to the table that computes them.
fn not_copied(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "file" => "Documents : leurs fichiers appartiennent à l’environnement qui les a reçus.",
        "image" => "Images : leurs fichiers appartiennent à l’environnement qui les a reçus.",
        "formula" => "Formule : calculée par l’environnement cible.",
        "autonumber" => "Numéro automatique : donné par l’environnement cible.",
        "lookup" => "Recherche : lue à travers une relation, sans colonne.",
        "rollup" => "Cumul : lu à travers une relation, sans colonne.",
        "count" => "Décompte : lu à travers une relation, sans colonne.",
        _ => return None,
    })
}

struct FieldLine {
    id: String,
    lineage: String,
    label: String,
    kind: String,
    name: String,
    has_ai: bool,
}

struct Side {
    table_id: String,
    relation: String,
    label: String,
    display_lineage: Option<String>,
    fields: Vec<FieldLine>,
}

struct Pair {
    lineage: String,
    label: String,
    kind: String,
    from: String,
    to: String,
}

struct Plan {
    source: Side,
    target: Side,
    table_label: String,
    pairs: Vec<Pair>,
    skipped: Vec<(String, String)>,
    display: (Option<String>, Option<String>),
    references: Vec<(String, String)>,
}

async fn side_of<E: Exec + Sync>(exec: &E, base_id: &str, table_lineage: &str) -> R<Option<Side>> {
    let Some(table) = exec
        .first(
            "SELECT t.id::text, t.label, tn.name AS table_name, sn.name AS schema_name,
                    df.lineage_id::text AS display_lineage
               FROM _basedb.table_def t
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
               LEFT JOIN _basedb.field df    ON df.id = t.display_field_id
              WHERE t.base_id = $1::text::uuid AND t.lineage_id = $2::text::uuid AND t.deleted_at IS NULL",
            &[&base_id, &table_lineage],
        )
        .await?
    else {
        return Ok(None);
    };
    let table_id: String = table.get(0);
    let fields = exec
        .rows(
            "SELECT f.id::text, f.lineage_id::text, f.label, f.kind, n.name,
                    EXISTS (SELECT 1 FROM _basedb.field_ai_config a WHERE a.field_id = f.id) AS has_ai
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.deleted_at IS NULL
              ORDER BY f.position",
            &[&table_id],
        )
        .await?
        .iter()
        .map(|r| FieldLine { id: r.get(0), lineage: r.get(1), label: r.get(2), kind: r.get(3), name: r.get(4), has_ai: r.get(5) })
        .collect();
    Ok(Some(Side { relation: qualify(&table.get::<_, String>(3), &table.get::<_, String>(2))?, table_id, label: table.get(1), display_lineage: table.get(4), fields }))
}

fn refused(verdict: Verdict, table: &str, action: &str) -> AppError {
    let code = if verdict == Verdict::Invisible { "RESOURCE_NOT_FOUND" } else { "ADMIN_REQUIRED" };
    AppError::new(code).with("table", json!(table)).with("action", json!(action))
}

fn action_name(action: Action) -> &'static str {
    match action {
        Action::Create => "create",
        Action::Update => "update",
        Action::Delete => "delete",
        _ => "read",
    }
}

/// `planOf`: the columns a synchronization copies, and the rights it needs.
async fn plan_of<E: Exec + Sync>(exec: &E, ctx: &RequestContext, grants: &ActorGrants, source_id: &str, target_id: &str, table_lineage: &str, target_actions: &[Action]) -> R<Plan> {
    let missing = || AppError::new("SYNC_TABLE_MISSING").with("table", json!(table_lineage));
    let source = side_of(exec, source_id, table_lineage).await?;
    let target = side_of(exec, target_id, table_lineage).await?;
    let (Some(source), Some(target)) = (source, target) else { return Err(missing()) };
    let source_target = load_target(exec, ctx, &source.table_id).await?;
    let target_target = load_target(exec, ctx, &target.table_id).await?;
    let (Some(source_target), Some(target_target)) = (source_target, target_target) else { return Err(missing()) };
    let read = decide(ctx, grants, Action::Read, &source_target);
    if read.verdict != Verdict::Allowed {
        return Err(refused(read.verdict, &source.label, "read"));
    }
    let target_read = decide(ctx, grants, Action::Read, &target_target);
    if target_read.verdict != Verdict::Allowed {
        return Err(refused(target_read.verdict, &target.label, "read"));
    }
    for action in target_actions {
        if decide(ctx, grants, *action, &target_target).verdict != Verdict::Allowed {
            return Err(AppError::new("ADMIN_REQUIRED").with("table", json!(target.label)).with("action", json!(action_name(*action))));
        }
    }
    let writable = decide(ctx, grants, Action::Update, &target_target).writable_fields;

    let mut pairs = Vec::new();
    let mut skipped = Vec::new();
    for field in &source.fields {
        if let Some(reason) = not_copied(&field.kind) {
            skipped.push((field.label.clone(), reason.to_string()));
            continue;
        }
        let Some(other) = target.fields.iter().find(|f| f.lineage == field.lineage).filter(|o| o.kind == field.kind) else {
            skipped.push((field.label.clone(), "Absent de l’environnement cible.".into()));
            continue;
        };
        if !read.readable_fields.contains(&field.id) {
            skipped.push((field.label.clone(), "Masqué pour vous dans la source.".into()));
            continue;
        }
        let allowed = writable.contains(&other.id) || (other.has_ai && target_read.readable_fields.contains(&other.id));
        if !allowed {
            skipped.push((field.label.clone(), "Non modifiable pour vous dans la cible.".into()));
            continue;
        }
        pairs.push(Pair { lineage: field.lineage.clone(), label: field.label.clone(), kind: field.kind.clone(), from: field.name.clone(), to: other.name.clone() });
    }

    let display_of = |side: &Side, readable: &indexmap::IndexSet<String>| {
        side.fields
            .iter()
            .find(|f| Some(&f.lineage) == side.display_lineage.as_ref() && readable.contains(&f.id))
            .or_else(|| side.fields.iter().find(|f| f.kind == "short_text" && readable.contains(&f.id)))
            .map(|f| f.name.clone())
    };
    let display = (display_of(&source, &read.readable_fields), display_of(&target, &target_read.readable_fields));

    let references = exec
        .rows(
            "SELECT cn.name AS constraint_name, tt.label
               FROM _basedb.field_link_config lc
               JOIN _basedb.field f             ON f.id = lc.field_id
               JOIN _basedb.table_def tt        ON tt.id = lc.target_table_id
               JOIN _basedb.table_constraint c  ON c.id = lc.fk_constraint_id
               JOIN _basedb.physical_name cn    ON cn.id = c.name_id
              WHERE f.table_id = $1::text::uuid AND lc.fk_dropped_at IS NULL",
            &[&target.table_id],
        )
        .await?
        .iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect();

    Ok(Plan { table_label: source.label.clone(), source, target, pairs, skipped, display, references })
}

fn col(alias: &str, name: &str) -> R<String> {
    Ok(format!("{alias}.{}", quote_identifier(name)?))
}

/// `ROW(…)` of the copied columns on one side — `ROW()` compares equal when there are none.
fn row_of(plan: &Plan, from_side: bool, alias: &str) -> R<String> {
    let cols = plan.pairs.iter().map(|p| col(alias, if from_side { &p.from } else { &p.to })).collect::<R<Vec<_>>>()?;
    Ok(format!("ROW({})", cols.join(", ")))
}

async fn last_row_sync<E: Exec + Sync>(exec: &E, source_id: &str, target_id: &str, table_lineage: &str) -> R<Option<String>> {
    let row = exec
        .first(
            "SELECT max(synced_at) AS at FROM _basedb.environment_sync
              WHERE kind = 'rows' AND table_lineage_id = $3::text::uuid
                AND source_base_id = $1::text::uuid AND target_base_id = $2::text::uuid",
            &[&source_id, &target_id, &table_lineage],
        )
        .await?;
    Ok(row.and_then(|r| r.get::<_, Option<DateTime<Utc>>>(0)).map(iso))
}

fn params_of(values: &[String]) -> Vec<&(dyn ToSql + Sync)> {
    values.iter().map(|v| v as &(dyn ToSql + Sync)).collect()
}

/// `compareRows`: a table's rows between two environments of a base.
pub async fn compare_rows(pools: &Pools, ctx: &RequestContext, source_id: &str, target_id: &str, table_lineage: &str) -> R<Value> {
    with_transaction(pools, PoolName::Data, ctx, snapshot_options(), |tx| async move {
        let (_family, source, target) = load_pair(&tx, ctx, source_id, target_id).await?;
        let grants = load_grants(&tx, ctx).await?;
        let plan = plan_of(&tx, ctx, &grants, &source.id, &target.id, table_lineage, &[]).await?;
        let s = row_of(&plan, true, "s")?;
        let t = row_of(&plan, false, "t")?;
        let join = format!("{} s FULL JOIN {} t ON t.\"_id\" = s.\"_id\"", plan.source.relation, plan.target.relation);
        let counts = tx
            .first(
                &format!(
                    "SELECT count(*) FILTER (WHERE t.\"_id\" IS NULL)::int AS only_source,
                            count(*) FILTER (WHERE s.\"_id\" IS NULL)::int AS only_target,
                            count(*) FILTER (WHERE s.\"_id\" IS NOT NULL AND t.\"_id\" IS NOT NULL
                                               AND {s} IS DISTINCT FROM {t})::int AS different,
                            count(*) FILTER (WHERE s.\"_id\" IS NOT NULL AND t.\"_id\" IS NOT NULL
                                               AND {s} IS NOT DISTINCT FROM {t})::int AS identical
                       FROM {join}"
                ),
                &[],
            )
            .await?;
        let count = |i: usize| counts.as_ref().map_or(0, |r| r.get::<_, i32>(i));

        let display = match &plan.display {
            (Some(from), Some(to)) => format!("coalesce({}::text, {}::text)", col("s", from)?, col("t", to)?),
            (Some(from), None) => format!("{}::text", col("s", from)?),
            (None, Some(to)) => format!("{}::text", col("t", to)?),
            (None, None) => "NULL::text".into(),
        };
        let changed = if plan.pairs.is_empty() {
            "ARRAY[]::text[]".to_string()
        } else {
            let cases = plan
                .pairs
                .iter()
                .enumerate()
                .map(|(i, p)| Ok(format!("CASE WHEN {} IS DISTINCT FROM {} THEN ${}::text END", col("s", &p.from)?, col("t", &p.to)?, i + 1)))
                .collect::<R<Vec<_>>>()?;
            format!(
                "CASE WHEN s.\"_id\" IS NULL OR t.\"_id\" IS NULL THEN ARRAY[]::text[]
                      ELSE array_remove(ARRAY[{}]::text[], NULL) END",
                cases.join(", ")
            )
        };
        let labels: Vec<String> = plan.pairs.iter().map(|p| p.label.clone()).collect();
        let samples = tx
            .rows(
                &format!(
                    "SELECT x.id::text, x.display, x.status, x.changed FROM (
                       SELECT coalesce(s.\"_id\", t.\"_id\") AS id, {display} AS display,
                              CASE WHEN t.\"_id\" IS NULL THEN 'onlySource'
                                   WHEN s.\"_id\" IS NULL THEN 'onlyTarget'
                                   ELSE 'different' END AS status,
                              {changed} AS changed,
                              row_number() OVER (
                                PARTITION BY (t.\"_id\" IS NULL), (s.\"_id\" IS NULL)
                                ORDER BY coalesce(s.\"_id\", t.\"_id\")) AS n
                         FROM {join}
                        WHERE t.\"_id\" IS NULL OR s.\"_id\" IS NULL OR {s} IS DISTINCT FROM {t}
                     ) x WHERE x.n <= {SAMPLE}
                     ORDER BY x.status, x.id"
                ),
                &params_of(&labels),
            )
            .await?;
        let pick = |status: &str| -> Vec<Value> {
            samples
                .iter()
                .filter(|r| r.get::<_, String>(2) == status)
                .map(|r| json!({ "id": r.get::<_, String>(0), "display": r.get::<_, Option<String>>(1), "changed": r.get::<_, Vec<String>>(3) }))
                .collect()
        };
        let last = last_row_sync(&tx, &source.id, &target.id, table_lineage).await?;
        Ok(json!({
            "source": source.to_json(),
            "target": target.to_json(),
            "table": { "lineage": table_lineage, "label": plan.table_label },
            "columns": plan.pairs.iter().map(|p| json!({ "lineage": p.lineage, "label": p.label, "kind": p.kind })).collect::<Vec<_>>(),
            "skipped": plan.skipped.iter().map(|(label, reason)| json!({ "label": label, "reason": reason })).collect::<Vec<_>>(),
            "counts": { "onlySource": count(0), "onlyTarget": count(1), "different": count(2), "identical": count(3) },
            "samples": { "onlySource": pick("onlySource"), "onlyTarget": pick("onlyTarget"), "different": pick("different") },
            "lastSync": last,
        }))
    })
    .await
}

/// `refusal`: a refusal of the target's constraints, named for what the person can do.
fn refusal(error: AppError, plan: &Plan) -> AppError {
    let constraint = error.details.get("constraint").and_then(Value::as_str).map(str::to_string);
    let cause = format!("{}: {}", error.code, error.cause.clone().unwrap_or_default());
    match error.code {
        "LINK_TARGET_NOT_FOUND" => {
            let mut e = AppError::new("SYNC_REFERENCE_MISSING").with("table", json!(plan.table_label));
            if let Some(target) = constraint.as_ref().and_then(|c| plan.references.iter().find(|(n, _)| n == c)).map(|(_, l)| l.clone()) {
                e = e.with("target", json!(target));
            }
            e.caused_by(cause)
        }
        "VALUE_OUT_OF_CONSTRAINT" | "REQUIRED_VALUE_MISSING" | "VALUE_TOO_LONG" | "VALUE_OUT_OF_RANGE" | "DUPLICATE_VALUE" => {
            let mut e = AppError::new("SYNC_VALUES_REFUSED").with("table", json!(plan.table_label)).with("reason", json!(error.code));
            if let Some(c) = constraint.filter(|c| !c.is_empty()) {
                e = e.with("constraint", json!(c));
            }
            e.caused_by(cause)
        }
        _ => error,
    }
}

/// `syncRows` (with the kernel's `drainHistory` first): copies a table's rows from the
/// source to the target in ONE transaction.
#[allow(clippy::too_many_arguments)]
pub async fn sync_rows(pools: &Pools, ctx: &RequestContext, source_id: &str, target_id: &str, table_lineage: &str, insert: bool, update: bool, delete: bool) -> R<Value> {
    if let Some(drain) = DRAINER.get() {
        drain(pools.clone()).await;
    }
    let mut actions = Vec::new();
    if insert {
        actions.push(Action::Create);
    }
    if update {
        actions.push(Action::Update);
    }
    if delete {
        actions.push(Action::Delete);
    }
    if actions.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("reason", json!("rien_a_faire")));
    }
    let actions = &actions;
    with_transaction(pools, PoolName::Data, ctx, TxOptions::default(), |tx| async move {
        let (_family, source, target) = load_pair(&tx, ctx, source_id, target_id).await?;
        let grants = load_grants(&tx, ctx).await?;
        let plan = plan_of(&tx, ctx, &grants, &source.id, &target.id, table_lineage, actions).await?;
        let to = plan.pairs.iter().map(|p| quote_identifier(&p.to)).collect::<R<Vec<_>>>()?;
        let from = plan.pairs.iter().map(|p| col("s", &p.from)).collect::<R<Vec<_>>>()?;
        let (source_rel, target_rel) = (&plan.source.relation, &plan.target.relation);

        let mut counts = (0usize, 0usize, 0usize);
        let written: R<()> = async {
            if delete {
                let rows = tx
                    .query_op(
                        &format!(
                            "DELETE FROM {target_rel} t
                              WHERE NOT EXISTS (SELECT 1 FROM {source_rel} s WHERE s.\"_id\" = t.\"_id\")
                             RETURNING t.\"_id\""
                        ),
                        &[],
                        SqlOp::Delete,
                    )
                    .await?;
                counts.2 = rows.len();
            }
            if update && !plan.pairs.is_empty() {
                let rows = tx
                    .query_op(
                        &format!(
                            "UPDATE {target_rel} t
                                SET ({}) = ROW({})
                               FROM {source_rel} s
                              WHERE t.\"_id\" = s.\"_id\" AND {} IS DISTINCT FROM {}
                             RETURNING t.\"_id\"",
                            to.join(", "),
                            from.join(", "),
                            row_of(&plan, true, "s")?,
                            row_of(&plan, false, "t")?
                        ),
                        &[],
                        SqlOp::Update,
                    )
                    .await?;
                counts.1 = rows.len();
            }
            if insert {
                let rows = tx
                    .query_op(
                        &format!(
                            "INSERT INTO {target_rel} (\"_id\", \"_created_by\"{})
                             SELECT s.\"_id\", $1::text::uuid{}
                               FROM {source_rel} s
                              WHERE NOT EXISTS (SELECT 1 FROM {target_rel} t WHERE t.\"_id\" = s.\"_id\")
                             RETURNING \"_id\"",
                            to.iter().map(|c| format!(", {c}")).collect::<String>(),
                            from.iter().map(|c| format!(", {c}")).collect::<String>()
                        ),
                        &[&ctx.actor.id],
                        SqlOp::Insert,
                    )
                    .await?;
                counts.0 = rows.len();
            }
            Ok(())
        }
        .await;
        written.map_err(|e| refusal(e, &plan))?;
        let (inserted, updated, deleted) = counts;
        let summary = json!({ "inserted": inserted, "updated": updated, "deleted": deleted }).to_string();
        tx.execute_op(
            "INSERT INTO _basedb.environment_sync
               (lineage_id, source_base_id, target_base_id, kind, table_lineage_id, synced_by, summary)
             SELECT b.lineage_id, $1::text::uuid, $2::text::uuid, 'rows', $3::text::uuid, $4::text::uuid, $5::text::jsonb
               FROM _basedb.base b WHERE b.id = $1::text::uuid",
            &[&source.id, &target.id, &table_lineage, &ctx.actor.id, &summary],
            SqlOp::Insert,
        )
        .await?;
        Ok(json!({ "inserted": inserted, "updated": updated, "deleted": deleted }))
    })
    .await
}

/// `countRows`: the row count of every table of the pair.
pub async fn count_rows(pools: &Pools, ctx: &RequestContext, source_id: &str, target_id: &str) -> R<Value> {
    with_transaction(pools, PoolName::Data, ctx, snapshot_options(), |tx| async move {
        let (_family, source, target) = load_pair(&tx, ctx, source_id, target_id).await?;
        let grants = load_grants(&tx, ctx).await?;
        let ids = vec![source.id.clone(), target.id.clone()];
        let tables = tx
            .rows(
                "SELECT t.base_id::text, t.lineage_id::text, t.id::text, t.label, sn.name AS relation_schema,
                        tn.name AS relation_table
                   FROM _basedb.table_def t
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                   JOIN _basedb.db_schema s      ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                  WHERE t.base_id = ANY($1::text[]::uuid[]) AND t.deleted_at IS NULL
                  ORDER BY t.position, t.label",
                &[&ids],
            )
            .await?;
        // (lineage, label, source, target), in the order lineages are first met.
        let mut out: Vec<(String, String, Option<i32>, Option<i32>)> = Vec::new();
        for table in &tables {
            let table_id: String = table.get(2);
            let Some(t) = load_target(&tx, ctx, &table_id).await? else { continue };
            if decide(ctx, &grants, Action::Read, &t).verdict != Verdict::Allowed {
                continue;
            }
            let relation = qualify(&table.get::<_, String>(4), &table.get::<_, String>(5))?;
            let n = tx.first(&format!("SELECT count(*)::int AS n FROM {relation}"), &[]).await?.map_or(0, |r| r.get::<_, i32>(0));
            let (base_id, lineage, label): (String, String, String) = (table.get(0), table.get(1), table.get(3));
            let index = match out.iter().position(|e| e.0 == lineage) {
                Some(i) => i,
                None => {
                    out.push((lineage, label.clone(), None, None));
                    out.len() - 1
                }
            };
            let entry = &mut out[index];
            if base_id == source.id {
                entry.2 = Some(n);
                entry.1 = label;
            } else {
                entry.3 = Some(n);
            }
        }
        Ok(Value::Array(out.into_iter().map(|(lineage, label, s, t)| json!({ "lineage": lineage, "label": label, "source": s, "target": t })).collect()))
    })
    .await
}
