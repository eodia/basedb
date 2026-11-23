//! The purge (`catalog/purge.ts`, chapter 06 §5): the export that must precede it — one
//! CSV per table and a manifest — then the irreversible destruction, run by the migration
//! engine, whose catalog rows become tombstones.

use crate::deletion::TABLE_BATCH;
use crate::engine::{self, Proposal, Step};
use crate::js::{js_number, js_order};
use crate::lifecycle::require_lifecycle_admin;
use crate::migrations::Migration;
use crate::naming::{qualify, quote_identifier, quote_literal, slugify, SlugNature};
use crate::sql_views::purge_sql_view_statements;
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::loader::load_grants;
use basedb_base::time::{from_ms, iso, now_ms};
use basedb_base::tx::{with_transaction, Isolation, RequestContext, Surface, TxOptions};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::{Path, PathBuf};

type R<T> = Result<T, AppError>;

/// `PURGE_DELAY_DAYS`, in milliseconds.
const PURGE_DELAY_MS: i64 = 30 * 86_400_000;
/// `EXPORT_MAX_ROWS`.
pub const EXPORT_MAX_ROWS: f64 = 2_000_000.0;
const FETCH_ROWS: usize = 1000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Base,
    Table,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Base => "base",
            Kind::Table => "table",
        }
    }
}

#[derive(Debug, Clone)]
struct TargetTable {
    id: String,
    label: String,
    name: String,
}

#[derive(Debug, Clone)]
struct Target {
    kind: Kind,
    id: String,
    base_id: String,
    label: String,
    /// `deleted_at::text`, as the manifest records it.
    deleted_at: String,
    /// `deleted_at`, in milliseconds (what `Date.parse` keeps of it).
    deleted_ms: i64,
    schema_id: String,
    schema_name: String,
    schema_name_id: String,
    tables: Vec<TargetTable>,
}

/// `isUuid` of `purge.ts`: 36 hexadecimal digits or dashes.
fn loose_uuid(value: &str) -> bool {
    value.len() == 36 && value.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-')
}

/// `loadTarget`: a deleted object not yet purged — a live base's table, or a deleted base.
async fn load_target<E: Exec + Sync>(exec: &E, ctx: &RequestContext, kind: Kind, id: &str) -> R<Target> {
    if !loose_uuid(id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    if kind == Kind::Base {
        let rows = exec
            .rows(
                "SELECT b.label, b.deleted_at::text, (floor(extract(epoch FROM b.deleted_at) * 1000))::int8,
                        s.id::text AS schema_id, n.name::text AS schema_name, s.name_id::text AS schema_name_id
                   FROM _basedb.base b
                   JOIN _basedb.tenant t        ON t.id = b.tenant_id
                   JOIN _basedb.db_schema s     ON s.base_id = b.id AND s.role = 'current'
                                               AND s.dropped_at IS NULL
                   JOIN _basedb.physical_name n ON n.id = s.name_id
                  WHERE b.id = $1::text::uuid AND t.ref = $2 AND b.deleted_at IS NOT NULL AND NOT b.is_purged",
                &[&id, &ctx.tenant_id],
            )
            .await?;
        let Some(base) = rows.first() else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(id)));
        };
        let tables = exec
            .rows(
                "SELECT t.id::text, t.label, n.name::text FROM _basedb.table_def t
                   JOIN _basedb.physical_name n ON n.id = t.name_id
                  WHERE t.base_id = $1::text::uuid AND NOT t.is_purged ORDER BY t.position, t.id",
                &[&id],
            )
            .await?
            .iter()
            .map(|r| TargetTable { id: r.get(0), label: r.get(1), name: r.get(2) })
            .collect();
        return Ok(Target {
            kind,
            id: id.to_string(),
            base_id: id.to_string(),
            label: base.get(0),
            deleted_at: base.get(1),
            deleted_ms: base.get(2),
            schema_id: base.get(3),
            schema_name: base.get(4),
            schema_name_id: base.get(5),
            tables,
        });
    }
    let rows = exec
        .rows(
            "SELECT t.base_id::text, t.label, n.name::text, t.deleted_at::text,
                    (floor(extract(epoch FROM t.deleted_at) * 1000))::int8,
                    s.id::text AS schema_id, sn.name::text AS schema_name, s.name_id::text AS schema_name_id
               FROM _basedb.table_def t
               JOIN _basedb.physical_name n  ON n.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
               JOIN _basedb.base b           ON b.id = t.base_id
               JOIN _basedb.tenant te        ON te.id = b.tenant_id
              WHERE t.id = $1::text::uuid AND te.ref = $2 AND t.deleted_at IS NOT NULL AND NOT t.is_purged
                AND b.is_live",
            &[&id, &ctx.tenant_id],
        )
        .await?;
    let Some(t) = rows.first() else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(id)));
    };
    let label: String = t.get(1);
    Ok(Target {
        kind,
        id: id.to_string(),
        base_id: t.get(0),
        label: label.clone(),
        deleted_at: t.get(3),
        deleted_ms: t.get(4),
        schema_id: t.get(5),
        schema_name: t.get(6),
        schema_name_id: t.get(7),
        tables: vec![TargetTable { id: id.to_string(), label, name: t.get(2) }],
    })
}

// ── The export (§5.2) ───────────────────────────────────────────────────────────────

/// `\s` of JavaScript at either end.
fn edge_space(text: &str) -> bool {
    text.chars().next().is_some_and(crate::formula::js_space) || text.chars().last().is_some_and(crate::formula::js_space)
}

/// `csvCell`: RFC 4180, NULL an empty field, `''` a quoted one.
pub fn csv_cell(value: Option<&str>) -> String {
    let Some(text) = value else { return String::new() };
    if text.is_empty() {
        return "\"\"".into();
    }
    if text.contains(['"', ',', '\r', '\n']) || edge_space(text) {
        format!("\"{}\"", text.replace('"', "\"\""))
    } else {
        text.to_string()
    }
}

/// How a column is read as the text node-postgres would have given `csvCell`.
fn cell_expression(column: &str, typname: &str, category: &str) -> R<(String, bool)> {
    let c = quote_identifier(column)?;
    Ok(match (typname, category) {
        ("bool", _) => (format!("CASE WHEN {c} THEN 'true' WHEN NOT {c} THEN 'false' END"), false),
        ("timestamptz", _) => (format!("to_char({c} AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')"), false),
        ("timestamp", _) => (format!("to_char({c}, 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')"), false),
        ("date", _) => (format!("to_char({c}, 'YYYY-MM-DD\"T00:00:00.000Z\"')"), false),
        ("bytea", _) => (format!("'\\x' || encode({c}, 'hex')"), false),
        ("json", _) | ("jsonb", _) | (_, "A") => (format!("to_jsonb({c})::text"), true),
        _ => (format!("{c}::text"), false),
    })
}

/// `Fingerprint`: what tells, at purge time, that nobody wrote since the export.
async fn fingerprint_of<E: Exec + Sync>(exec: &E, schema: &str, table: &str) -> R<(i64, String)> {
    let row = exec
        .rows(&format!("SELECT count(*)::int8 AS rows, coalesce(max(xmin::text::bigint), 0)::text AS max_xmin FROM {}", qualify(schema, table)?), &[])
        .await?;
    Ok(row.first().map(|r| (r.get(0), r.get(1))).unwrap_or((0, "0".into())))
}

/// `statsOf`.
async fn stats_of<E: Exec + Sync>(exec: &E, schema: &str, table: &str) -> R<Value> {
    exec.rows("SELECT pg_stat_clear_snapshot()", &[]).await?;
    let rows = exec
        .rows(
            "SELECT n_tup_ins::text, n_tup_upd::text, n_tup_del::text
               FROM pg_stat_user_tables WHERE schemaname = $1 AND relname = $2",
            &[&schema, &table],
        )
        .await?;
    Ok(match rows.first() {
        Some(r) => json!({ "n_tup_ins": r.get::<_, String>(0), "n_tup_upd": r.get::<_, String>(1), "n_tup_del": r.get::<_, String>(2) }),
        None => Value::Null,
    })
}

struct Written {
    rows: i64,
    sha256: String,
    max_xmin: String,
}

fn write_error(file: &str) -> AppError {
    AppError::new("EXPORT_UNAVAILABLE").with("reason", json!("ecriture")).with("file", json!(file))
}

/// `exportTable`: one table streamed to a CSV file, counted and hashed as it is written.
async fn export_table<E: Exec + Sync>(exec: &E, schema: &str, table: &str, path: &Path, file: &str) -> R<Written> {
    let qualified = qualify(schema, table)?;
    let columns = exec
        .rows(
            "SELECT a.attname::text, t.typname::text, t.typcategory::text FROM pg_attribute a
               JOIN pg_type t ON t.oid = a.atttypid
              WHERE a.attrelid = $1::text::regclass AND a.attnum > 0 AND NOT a.attisdropped
              ORDER BY a.attnum",
            &[&qualified],
        )
        .await?;
    let mut exprs = Vec::new();
    let mut json_cols = Vec::new();
    let mut header = Vec::new();
    for c in &columns {
        let name: String = c.get(0);
        let (expr, is_json) = cell_expression(&name, &c.get::<_, String>(1), &c.get::<_, String>(2))?;
        exprs.push(expr);
        json_cols.push(is_json);
        header.push(csv_cell(Some(&name)));
    }
    let out = std::fs::File::create(path).map_err(|_| write_error(file))?;
    let mut out = std::io::BufWriter::new(out);
    let mut hash = Sha256::new();
    let mut emit = |line: &str| -> R<()> {
        hash.update(line.as_bytes());
        out.write_all(line.as_bytes()).map_err(|_| write_error(file))
    };
    emit(&format!("{}\r\n", header.join(",")))?;
    let select = if exprs.is_empty() { String::new() } else { format!(", {}", exprs.join(", ")) };
    exec.rows(
        &format!("DECLARE basedb_export NO SCROLL CURSOR FOR SELECT xmin::text::bigint AS \"__basedb_xmin\"{select} FROM {qualified} ORDER BY \"_id\""),
        &[],
    )
    .await?;
    let mut rows = 0i64;
    let mut max_xmin = 0i64;
    loop {
        let batch = exec.rows(&format!("FETCH {FETCH_ROWS} FROM basedb_export"), &[]).await?;
        if batch.is_empty() {
            break;
        }
        let mut chunk = String::new();
        for row in &batch {
            max_xmin = max_xmin.max(row.get::<_, i64>(0));
            let cells: Vec<String> = (0..exprs.len())
                .map(|i| {
                    let raw: Option<String> = row.get(i + 1);
                    match (raw, json_cols[i]) {
                        (Some(text), true) => {
                            let v = serde_json::from_str::<Value>(&text).map(js_order).unwrap_or(Value::String(text));
                            csv_cell(Some(&v.to_string()))
                        }
                        (raw, _) => csv_cell(raw.as_deref()),
                    }
                })
                .collect();
            chunk.push_str(&cells.join(","));
            chunk.push_str("\r\n");
        }
        emit(&chunk)?;
        rows += batch.len() as i64;
    }
    exec.rows("CLOSE basedb_export", &[]).await?;
    drop(emit);
    out.flush().map_err(|_| write_error(file))?;
    Ok(Written { rows, sha256: basedb_base::time::hex(&hash.finalize()), max_xmin: max_xmin.to_string() })
}

/// Where the exports go: `BASEDB_EXPORT_DIR`, by default `.basedb/exports` at the root.
pub fn export_dir(cfg: &basedb_base::config::Config) -> PathBuf {
    cfg.setting("BASEDB_EXPORT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| cfg.root.clone().unwrap_or_else(|| PathBuf::from(".")).join(".basedb").join("exports"))
}

/// `exportForPurge`: the response of `POST admin/purge/exports`.
pub async fn export_for_purge(pools: &Pools, ctx: &RequestContext, export_dir: &Path, kind: Kind, id: &str) -> R<Value> {
    let target = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let found = load_target(&tx, ctx, kind, id).await?;
        require_lifecycle_admin(&tx, ctx, &found.base_id).await?;
        Ok(found)
    })
    .await?;
    if export_dir.as_os_str().is_empty() {
        return Err(AppError::new("EXPORT_UNAVAILABLE").with("reason", json!("repertoire_absent")));
    }
    let at = iso(ctx.timestamp);
    let stamp: String = at.replace(['-', ':'], "");
    let stamp = stamp.split('.').next().unwrap_or("").to_string();
    let slug = slugify(&target.label, 40, SlugNature::Table).slug;
    let short: String = target.id.chars().take(8).collect();
    let directory = export_dir.join(&ctx.tenant_id).join(format!("{stamp}-{}-{slug}-{short}", target.kind.as_str()));
    let directory_text = directory.to_string_lossy().to_string();
    if std::fs::create_dir_all(&directory).is_err() {
        return Err(AppError::new("EXPORT_UNAVAILABLE").with("reason", json!("repertoire_inaccessible")).with("directory", json!(directory_text)));
    }

    let opts = TxOptions { isolation: Isolation::RepeatableRead, read_only: true, retries: 0 };
    let (t, dir) = (&target, &directory);
    let exported = with_transaction(pools, PoolName::Data, ctx, opts, |tx| async move {
        let names: Vec<String> = t.tables.iter().map(|x| x.name.clone()).collect();
        let estimate: f64 = tx
            .rows(
                "SELECT coalesce(sum(greatest(c.reltuples, 0)), 0)::float8 AS rows
                   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = $1 AND c.relname = ANY($2::text[])",
                &[&t.schema_name, &names],
            )
            .await?
            .first()
            .map(|r| r.get(0))
            .unwrap_or(0.0);
        if estimate > EXPORT_MAX_ROWS {
            return Err(AppError::new("EXPORT_UNAVAILABLE").with("reason", json!("trop_volumineux")).with("maximum", json!(2_000_000)));
        }
        let mut out = Vec::new();
        for table in &t.tables {
            let stats = stats_of(&tx, &t.schema_name, &table.name).await?;
            let qualified = qualify(&t.schema_name, &table.name)?;
            let bytes: f64 = tx.rows("SELECT pg_total_relation_size($1::text::regclass)::float8 AS bytes", &[&qualified]).await?.first().map(|r| r.get(0)).unwrap_or(0.0);
            let file = format!("{}.csv", table.name);
            let written = export_table(&tx, &t.schema_name, &table.name, &dir.join(&file), &file).await?;
            out.push((table.clone(), file, bytes, stats, written));
        }
        Ok(out)
    })
    .await?;

    let ids: Vec<String> = target.tables.iter().map(|x| x.id.clone()).collect();
    let ids_ref = &ids;
    let catalog = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let rows = tx
            .rows(
                "SELECT t.id::text, t.label, tn.name::text,
                        to_char(t.deleted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),
                        (SELECT coalesce(jsonb_agg(jsonb_build_object(
                                  'id', f.id, 'label', f.label, 'name', fn.name, 'kind', f.kind,
                                  'deleted_at', f.deleted_at) ORDER BY f.position), '[]'::jsonb)
                           FROM _basedb.field f JOIN _basedb.physical_name fn ON fn.id = f.name_id
                          WHERE f.table_id = t.id)::text
                   FROM _basedb.table_def t JOIN _basedb.physical_name tn ON tn.id = t.name_id
                  WHERE t.id = ANY($1::text[]::uuid[])",
                &[ids_ref],
            )
            .await?;
        Ok(rows
            .iter()
            .map(|r| {
                let fields = serde_json::from_str::<Value>(&r.get::<_, String>(4)).map(js_order).unwrap_or(Value::Null);
                json!({ "id": r.get::<_, String>(0), "label": r.get::<_, String>(1), "name": r.get::<_, String>(2), "deleted_at": r.get::<_, Option<String>>(3), "fields": fields })
            })
            .collect::<Vec<_>>())
    })
    .await?;

    let manifest = json!({
        "format": 1,
        "tenant": ctx.tenant_id,
        "kind": target.kind.as_str(),
        "target": { "id": target.id, "label": target.label, "deleted_at": target.deleted_at },
        "base_id": target.base_id,
        "schema": target.schema_name,
        "created_at": at,
        "catalog": catalog,
        "tables": exported.iter().map(|(t, file, bytes, stats, w)| json!({
            "id": t.id, "label": t.label, "name": t.name, "file": file, "rows": w.rows, "sha256": w.sha256,
            "bytes": js_number(*bytes), "stats": stats, "fingerprint": { "rows": w.rows, "maxXmin": w.max_xmin },
        })).collect::<Vec<_>>(),
    });
    let text = format!("{}\n", serde_json::to_string_pretty(&manifest).unwrap_or_default());
    if std::fs::write(directory.join("manifest.json"), text).is_err() {
        return Err(write_error("manifest.json"));
    }

    let total_rows: i64 = exported.iter().map(|e| e.4.rows).sum();
    let export_id = uuid::Uuid::new_v4().to_string();
    let (eid, tgt, dtext, man) = (&export_id, &target, &directory_text, &manifest);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let table_id = (tgt.kind == Kind::Table).then(|| tgt.id.clone());
        let manifest_text = man.to_string();
        tx.execute_op(
            "INSERT INTO _basedb.purge_export
               (id, tenant_id, base_id, table_id, directory, manifest, total_rows, created_by)
             SELECT $1::text::uuid, t.id, $2::text::uuid, $3::text::uuid, $4, $5::text::jsonb, $6, $7::text::uuid
               FROM _basedb.tenant t WHERE t.ref = $8",
            &[eid, &tgt.base_id, &table_id, dtext, &manifest_text, &total_rows, &ctx.actor.id, &ctx.tenant_id],
            SqlOp::Insert,
        )
        .await?;
        let mut entry = AuditEntry::new("purge.export", tgt.kind.as_str());
        entry.object_id = Some(tgt.id.clone());
        entry.object_name = Some(tgt.label.clone());
        entry.base_id = Some(tgt.base_id.clone());
        entry.payload = json_map(json!({ "export": eid, "directory": dtext, "rows": total_rows }));
        write_audit(&tx, ctx, &entry).await
    })
    .await?;

    Ok(json!({
        "id": export_id,
        "directory": directory_text,
        "created_at": at,
        "total_rows": total_rows,
        "total_bytes": js_number(exported.iter().map(|e| e.2).sum()),
        "tables": exported.iter().map(|(t, file, bytes, _, w)| json!({
            "id": t.id, "label": t.label, "name": t.name, "file": file, "rows": w.rows,
            "bytes": js_number(*bytes), "sha256": w.sha256,
        })).collect::<Vec<_>>(),
    }))
}

fn json_map(v: Value) -> Map<String, Value> {
    match v {
        Value::Object(m) => m,
        _ => Map::new(),
    }
}

// ── The purge (§5.3) ────────────────────────────────────────────────────────────────

/// `tombstone`: the catalog of one table becomes a tombstone, its names `purged`.
fn tombstone(schema: &str, table: &TargetTable, stamp: &str, actor: &str) -> R<Vec<String>> {
    let id = format!("{}::uuid", quote_literal(&table.id));
    Ok(vec![
        format!("DROP TABLE IF EXISTS {} RESTRICT;", qualify(schema, &table.name)?),
        format!("UPDATE _basedb.field SET purged_at = {stamp}::timestamptz, purged_by = {actor}::uuid, is_purged = true\n WHERE table_id = {id} AND NOT is_purged AND kind = 'formula';"),
        format!("UPDATE _basedb.field SET purged_at = {stamp}::timestamptz, purged_by = {actor}::uuid, is_purged = true\n WHERE table_id = {id} AND NOT is_purged;"),
        format!("UPDATE _basedb.table_index\n   SET state = 'dropped', dropped_at = coalesce(dropped_at, {stamp}::timestamptz),\n       state_changed_at = {stamp}::timestamptz\n WHERE table_id = {id} AND state <> 'dropped';"),
        format!("UPDATE _basedb.table_constraint\n   SET state = 'dropped', dropped_at = coalesce(dropped_at, {stamp}::timestamptz),\n       state_changed_at = {stamp}::timestamptz\n WHERE table_id = {id} AND state <> 'dropped';"),
        format!("UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = {stamp}::timestamptz\n WHERE state <> 'purged' AND (\n       scope_id = {id}\n    OR id IN (SELECT name_id FROM _basedb.table_def WHERE id = {id})\n    OR id IN (SELECT name_id FROM _basedb.table_index WHERE table_id = {id})\n    OR id IN (SELECT name_id FROM _basedb.table_constraint WHERE table_id = {id}));"),
        format!("UPDATE _basedb.table_def\n   SET purged_at = {stamp}::timestamptz, purged_by = {actor}::uuid, is_purged = true\n WHERE id = {id};"),
    ])
}

/// What `POST admin/purge` asks.
pub struct PurgeRequest<'a> {
    pub kind: Kind,
    pub id: &'a str,
    pub export_id: &'a str,
    pub confirm: &'a str,
    /// An instance administrator's shortcut past the thirty days.
    pub early_justification: Option<&'a str>,
}

struct Planned {
    target: Target,
    steps: Vec<Step>,
    rows: i64,
    directory: String,
}

/// `purge`: `{purged_tables, residual_schema, migration}`.
pub async fn purge(pools: &Pools, ctx: &RequestContext, req: &PurgeRequest<'_>) -> R<(usize, bool, Migration)> {
    if ctx.surface == Surface::Mcp {
        return Err(AppError::new("MCP_OPERATION_EXCLUDED"));
    }
    let planned = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let target = load_target(&tx, ctx, req.kind, req.id).await?;
        require_lifecycle_admin(&tx, ctx, &target.base_id).await?;
        if req.confirm != target.label {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("confirm")).with("reason", json!("saisir_le_libelle")));
        }
        let due = target.deleted_ms + PURGE_DELAY_MS;
        let early = now_ms() < due;
        if early {
            let grants = load_grants(&tx, ctx).await?;
            let justification = req.early_justification.map(crate::description::js_trim).unwrap_or("");
            if !grants.is_instance_admin || justification.is_empty() {
                return Err(AppError::new("PURGE_TOO_EARLY").with("purgeable_from", json!(iso(from_ms(due)))));
            }
        }
        if !loose_uuid(req.export_id) {
            return Err(AppError::new("EXPORT_UNAVAILABLE"));
        }
        let table_id = (target.kind == Kind::Table).then(|| target.id.clone());
        let rows = tx
            .rows(
                "SELECT e.directory, e.manifest, e.total_rows::text FROM _basedb.purge_export e
                   JOIN _basedb.tenant t ON t.id = e.tenant_id
                  WHERE e.id = $1::text::uuid AND t.ref = $2 AND e.used_at IS NULL AND e.base_id = $3::text::uuid
                    AND e.table_id IS NOT DISTINCT FROM $4::text::uuid",
                &[&req.export_id, &ctx.tenant_id, &target.base_id, &table_id],
            )
            .await?;
        let Some(exported) = rows.first() else {
            return Err(AppError::new("EXPORT_UNAVAILABLE").with("reason", json!("export_inconnu")));
        };
        let directory: String = exported.get(0);
        let manifest: Value = exported.get(1);
        let total_rows: String = exported.get(2);
        let listed = manifest.get("tables").and_then(Value::as_array).cloned().unwrap_or_default();
        for table in &target.tables {
            let Some(entry) = listed.iter().find(|t| t.get("id").and_then(Value::as_str) == Some(&table.id)) else {
                return Err(AppError::new("EXPORT_STALE").with("table", json!(table.name)));
            };
            let file = entry.get("file").and_then(Value::as_str).unwrap_or("");
            let content = match std::fs::read(Path::new(&directory).join(file)) {
                Ok(c) => c,
                Err(_) => return Err(AppError::new("EXPORT_UNAVAILABLE").with("reason", json!("fichier_absent")).with("file", json!(file))),
            };
            let digest = basedb_base::time::hex(&Sha256::digest(&content));
            if Some(digest.as_str()) != entry.get("sha256").and_then(Value::as_str) {
                return Err(AppError::new("EXPORT_UNAVAILABLE").with("reason", json!("fichier_altere")).with("file", json!(file)));
            }
            let (now_rows, now_xmin) = fingerprint_of(&tx, &target.schema_name, &table.name).await?;
            let fp = entry.get("fingerprint");
            let fp_rows = fp.and_then(|f| f.get("rows")).and_then(Value::as_f64);
            let fp_xmin = fp.and_then(|f| f.get("maxXmin")).and_then(Value::as_str);
            if fp_rows != Some(now_rows as f64) || fp_xmin != Some(now_xmin.as_str()) {
                return Err(AppError::new("EXPORT_STALE").with("table", json!(table.name)));
            }
            let qualified = qualify(&target.schema_name, &table.name)?;
            let is_base = target.kind == Kind::Base;
            let dependent = tx
                .rows(
                    "SELECT dn.nspname || '.' || dc.relname AS name
                       FROM pg_depend d
                       JOIN pg_rewrite r    ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
                       JOIN pg_class dc     ON dc.oid = r.ev_class
                       JOIN pg_namespace dn ON dn.oid = dc.relnamespace
                      WHERE d.refclassid = 'pg_class'::regclass
                        AND d.refobjid = $1::text::regclass AND dc.oid <> d.refobjid
                        AND NOT ($2::boolean AND dn.nspname = $3 AND EXISTS (
                              SELECT 1 FROM _basedb.sql_view v
                                JOIN _basedb.physical_name vn ON vn.id = v.name_id
                               WHERE v.base_id = $4::text::uuid AND vn.name = dc.relname))
                      LIMIT 1",
                    &[&qualified, &is_base, &target.schema_name, &target.base_id],
                )
                .await?;
            if let Some(d) = dependent.first() {
                return Err(AppError::new("DEPENDENT_OBJECT").with("dependent", json!(d.get::<_, String>(0))).with("referenced", json!(table.name)));
            }
        }

        let stamp = quote_literal(&iso(ctx.timestamp));
        let actor = quote_literal(&ctx.actor.id);
        let mut steps = Vec::new();
        if target.kind == Kind::Base {
            steps.push(Step::new(
                "Geler la structure de la base",
                vec![format!("UPDATE _basedb.base SET structure_state = 'frozen' WHERE id = {}::uuid;", quote_literal(&target.base_id))],
                "none",
            ));
            let views = purge_sql_view_statements(&tx, &target.base_id, &target.schema_name, &stamp).await?;
            if !views.is_empty() {
                steps.push(Step::new("Détruire les vues SQL", views, "short"));
            }
        }
        for batch in target.tables.chunks(TABLE_BATCH) {
            let mut statements = Vec::new();
            for t in batch {
                statements.extend(tombstone(&target.schema_name, t, &stamp, &actor)?);
            }
            steps.push(Step::new(format!("Détruire {} table{}", batch.len(), if batch.len() > 1 { "s" } else { "" }), statements, "exclusive"));
        }
        if target.kind == Kind::Base {
            let drop_schema = format!("DROP SCHEMA {} RESTRICT", quote_identifier(&target.schema_name)?);
            steps.push(Step::new(
                format!("Détruire le schéma {}", target.schema_name),
                vec![
                    format!(
                        "DO $purge$\nBEGIN\n  EXECUTE {};\n  UPDATE _basedb.db_schema SET dropped_at = {stamp}::timestamptz\n   WHERE id = {}::uuid;\n  UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = {stamp}::timestamptz\n   WHERE id = {}::uuid;\nEXCEPTION WHEN dependent_objects_still_exist THEN\n  NULL;\nEND\n$purge$;",
                        quote_literal(&drop_schema),
                        quote_literal(&target.schema_id),
                        quote_literal(&target.schema_name_id)
                    ),
                    format!(
                        "UPDATE _basedb.base\n   SET purged_at = {stamp}::timestamptz, purged_by = {actor}::uuid, is_purged = true\n WHERE id = {}::uuid;",
                        quote_literal(&target.base_id)
                    ),
                ],
                "short",
            ));
        }
        tx.execute_op(
            "UPDATE _basedb.purge_export SET used_at = clock_timestamp(), used_by = $2::text::uuid WHERE id = $1::text::uuid",
            &[&req.export_id, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        if early {
            let mut entry = AuditEntry::new("purge.early", target.kind.as_str());
            entry.object_id = Some(target.id.clone());
            entry.object_name = Some(target.label.clone());
            entry.base_id = Some(target.base_id.clone());
            entry.payload = json_map(json!({ "purgeable_from": iso(from_ms(due)), "justification": req.early_justification.unwrap_or("") }));
            write_audit(&tx, ctx, &entry).await?;
        }
        Ok(Planned { rows: total_rows.parse::<f64>().map(|f| f as i64).unwrap_or(0), target, steps, directory })
    })
    .await?;

    let t = &planned.target;
    let migration = engine::run(
        pools,
        ctx,
        &Proposal {
            base_id: t.base_id.clone(),
            label: format!("Purge {} « {} »", if t.kind == Kind::Base { "de la base" } else { "de la table" }, t.label),
            origin: if ctx.surface == Surface::Rest { "rest" } else { "ui" },
            steps: planned.steps.clone(),
            catalog_diff: json!({
                "operation": format!("purge_{}", t.kind.as_str()),
                "target": t.label,
                "tables": t.tables.iter().map(|x| x.name.clone()).collect::<Vec<_>>(),
                "export": req.export_id,
            }),
            affected_objects: Some(Value::Array(t.tables.iter().map(|x| json!({ "kind": "table", "name": x.name, "label": x.label })).collect())),
        },
    )
    .await?;

    let p = &planned;
    let residual = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let t = &p.target;
        let dropped = tx
            .rows("SELECT dropped_at IS NOT NULL AS dropped FROM _basedb.db_schema WHERE id = $1::text::uuid", &[&t.schema_id])
            .await?
            .first()
            .map(|r| r.get::<_, bool>(0))
            .unwrap_or(false);
        let residual = t.kind == Kind::Base && !dropped;
        let mut entry = AuditEntry::new(&format!("purge.{}", t.kind.as_str()), t.kind.as_str());
        entry.object_id = Some(t.id.clone());
        entry.object_name = Some(t.label.clone());
        entry.base_id = Some(t.base_id.clone());
        entry.payload = json_map(json!({
            "export": req.export_id,
            "directory": p.directory,
            "rows": p.rows,
            "tables": t.tables.iter().map(|x| x.name.clone()).collect::<Vec<_>>(),
            "residual_schema": residual,
        }));
        write_audit(&tx, ctx, &entry).await?;
        Ok(residual)
    })
    .await?;
    Ok((planned.target.tables.len(), residual, migration))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_cells_follow_postgres_convention() {
        assert_eq!(csv_cell(None), "");
        assert_eq!(csv_cell(Some("")), "\"\"");
        assert_eq!(csv_cell(Some("a,b")), "\"a,b\"");
        assert_eq!(csv_cell(Some("dit \"oui\"")), "\"dit \"\"oui\"\"\"");
        assert_eq!(csv_cell(Some(" bord")), "\" bord\"");
        assert_eq!(csv_cell(Some("simple")), "simple");
        assert!(loose_uuid("00000000-0000-0000-0000-000000000000"));
        assert!(!loose_uuid("abc"));
    }
}
