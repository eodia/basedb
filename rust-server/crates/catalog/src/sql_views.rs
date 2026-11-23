//! SQL views — chapter 11 §1.8 (`catalog/sql-views.ts`): real PostgreSQL views of a base's
//! schema, listed among its tables.

use crate::allocation::{allocate_name, AllocationRequest, Candidate, ObjectKind, ScopeKind};
use crate::description::{js_trim, normalize_description};
use crate::http::{checked_look, collapse_spaces, js_len, label_key, look_of_body, nfc, LookInput};
use crate::js::js_trim_end;
use crate::naming::{qualify, quote_identifier, quote_literal};
use crate::reader::reader_reach;
use crate::structure::{in_structure, StructureTx};
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::{load_base_target, visible_inside};
use basedb_base::tx::{with_transaction, RequestContext, Surface, TxOptions};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use tokio_postgres::error::ErrorPosition;
use tokio_postgres::Row;

/// The schemas every role reads: a view may cite them without citing another base.
const SHARED_SCHEMAS: [&str; 2] = ["pg_catalog", "information_schema"];

pub const SELECT: &str = "
  SELECT v.id::text, v.base_id::text, vn.name, sn.name AS schema_name, v.label, v.description,
         v.definition, v.broken_reason, v.color, v.icon, v.image, v.updated_at::text
    FROM _basedb.sql_view v
    JOIN _basedb.physical_name vn ON vn.id = v.name_id
    JOIN _basedb.db_schema s      ON s.id = v.schema_id
    JOIN _basedb.physical_name sn ON sn.id = s.name_id";

/// A row of [`SELECT`].
#[derive(Debug, Clone)]
pub struct ViewRow {
    pub id: String,
    pub base_id: String,
    pub name: String,
    pub schema_name: String,
    pub label: String,
    pub description: Option<String>,
    pub definition: String,
    pub broken_reason: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
    pub updated_at: String,
}

impl ViewRow {
    pub fn of(r: &Row) -> ViewRow {
        ViewRow {
            id: r.get(0),
            base_id: r.get(1),
            name: r.get(2),
            schema_name: r.get(3),
            label: r.get(4),
            description: r.get(5),
            definition: r.get(6),
            broken_reason: r.get(7),
            color: r.get(8),
            icon: r.get(9),
            image: r.get(10),
            updated_at: r.get(11),
        }
    }

    /// `shaped`: the view as the API returns it.
    pub fn shaped(&self, manages: bool) -> Value {
        json!({
            "id": self.id,
            "baseId": self.base_id,
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "definition": self.definition,
            "broken": self.broken_reason,
            "color": self.color,
            "icon": self.icon,
            "image": self.image,
            "editable": manages,
            "updatedAt": self.updated_at,
        })
    }
}

/// One relation a view reads.
#[derive(Debug, Clone, PartialEq)]
pub struct Dependency {
    pub schema: String,
    pub relation: String,
    /// `pg_class.relkind`.
    pub kind: String,
    /// The column read, `None` when the relation is read as a whole.
    pub column: Option<String>,
}

/// `dependenciesOf`: every relation the given views read, down through the views they read.
pub async fn dependencies_of<E: Exec + Sync>(exec: &E, view_ids: &[String]) -> Result<HashMap<String, Vec<Dependency>>, AppError> {
    let mut out: HashMap<String, Vec<Dependency>> = HashMap::new();
    if view_ids.is_empty() {
        return Ok(out);
    }
    let rows = exec
        .rows(
            "WITH RECURSIVE roots AS (
               SELECT v.id AS view_id, c.oid AS rel
                 FROM _basedb.sql_view v
                 JOIN _basedb.physical_name vn ON vn.id = v.name_id
                 JOIN _basedb.db_schema s      ON s.id = v.schema_id
                 JOIN _basedb.physical_name sn ON sn.id = s.name_id
                 JOIN pg_namespace n ON n.nspname = sn.name
                 JOIN pg_class c     ON c.relnamespace = n.oid AND c.relname = vn.name AND c.relkind = 'v'
                WHERE v.id = ANY($1::text[]::uuid[])
             ), deps(view_id, rel, att) AS (
               SELECT roots.view_id, d.refobjid, d.refobjsubid
                 FROM roots
                 JOIN pg_rewrite r ON r.ev_class = roots.rel
                 JOIN pg_depend d  ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
                WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid <> roots.rel
               UNION
               SELECT deps.view_id, d.refobjid, d.refobjsubid
                 FROM deps
                 JOIN pg_class c   ON c.oid = deps.rel AND c.relkind = 'v'
                 JOIN pg_rewrite r ON r.ev_class = c.oid
                 JOIN pg_depend d  ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
                WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid <> c.oid
             )
             SELECT DISTINCT deps.view_id::text, n.nspname::text AS schema, c.relname::text AS relation,
                    c.relkind::text AS kind, a.attname::text AS \"column\"
               FROM deps
               JOIN pg_class c     ON c.oid = deps.rel
               JOIN pg_namespace n ON n.oid = c.relnamespace
               LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = deps.att AND deps.att > 0",
            &[&view_ids],
        )
        .await?;
    for r in rows {
        out.entry(r.get(0)).or_default().push(Dependency { schema: r.get(1), relation: r.get(2), kind: r.get(3), column: r.get(4) });
    }
    Ok(out)
}

/// `readsAll`: whether someone who reads `reach` of the schema reads everything a view reads.
pub fn reads_all(dependencies: &[Dependency], schema: &str, reach: &indexmap::IndexMap<String, HashSet<String>>) -> bool {
    dependencies.iter().all(|d| {
        if SHARED_SCHEMAS.contains(&d.schema.as_str()) {
            return true;
        }
        if d.schema != schema {
            return false;
        }
        if d.kind == "v" {
            return true;
        }
        if d.kind != "r" && d.kind != "p" {
            return false;
        }
        match reach.get(&d.relation) {
            None => false,
            Some(columns) => d.column.as_ref().is_none_or(|c| columns.contains(c)),
        }
    })
}

/// A base as [`sql_view_summaries`] judges it.
pub struct SummaryBase {
    pub id: String,
    pub schema: String,
    /// The columns the caller reads, per table name.
    pub readable: indexmap::IndexMap<String, HashSet<String>>,
}

/// `sqlViewSummaries`: per base, the views the navigation lists for the caller.
pub async fn sql_view_summaries<E: Exec + Sync>(exec: &E, bases: &[SummaryBase], managed: &HashSet<String>) -> Result<HashMap<String, Vec<Value>>, AppError> {
    let mut out: HashMap<String, Vec<Value>> = HashMap::new();
    if bases.is_empty() {
        return Ok(out);
    }
    let ids: Vec<String> = bases.iter().map(|b| b.id.clone()).collect();
    let rows: Vec<ViewRow> = exec
        .rows(&format!("{SELECT} WHERE v.base_id = ANY($1::text[]::uuid[]) ORDER BY v.position, v.label_key"), &[&ids])
        .await?
        .iter()
        .map(ViewRow::of)
        .collect();
    if rows.is_empty() {
        return Ok(out);
    }
    let judged: Vec<String> = rows.iter().filter(|r| !managed.contains(&r.base_id) && r.broken_reason.is_none()).map(|r| r.id.clone()).collect();
    let dependencies = dependencies_of(exec, &judged).await?;
    let by_id: HashMap<&str, &SummaryBase> = bases.iter().map(|b| (b.id.as_str(), b)).collect();
    for row in &rows {
        let Some(base) = by_id.get(row.base_id.as_str()) else { continue };
        if !managed.contains(&row.base_id) {
            if row.broken_reason.is_some() {
                continue;
            }
            if !reads_all(dependencies.get(&row.id).map(Vec::as_slice).unwrap_or(&[]), &base.schema, &base.readable) {
                continue;
            }
        }
        out.entry(row.base_id.clone()).or_default().push(json!({
            "id": row.id,
            "name": row.name,
            "label": row.label,
            "broken": row.broken_reason.is_some(),
            "color": row.color,
            "icon": row.icon,
            "image": row.image,
        }));
    }
    Ok(out)
}

// ------------------------------------------------------------------------------------
// Reading, one base at a time

type R<T> = Result<T, AppError>;

const MAX_DEFINITION_CHARS: usize = 100_000;
const MAX_LABEL_CHARS: usize = 255;

impl ViewRow {
    /// `serializeSqlView` of `app.ts`.
    pub fn serialized(&self, editable: bool) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "definition": self.definition,
            "broken": self.broken_reason,
            "color": self.color,
            "icon": self.icon,
            "image": self.image,
            "editable": editable,
            "updated_at": self.updated_at,
        })
    }
}

/// `accessTo`: whether the caller manages the base; one they do not see does not exist.
async fn access_to<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<bool> {
    let grants = load_grants(exec, ctx).await?;
    let unseen = || AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id));
    let Some(target) = load_base_target(exec, ctx, base_id).await? else { return Err(unseen()) };
    let manages = decide(ctx, &grants, Action::ManageSchema, &target).verdict == Verdict::Allowed;
    let sees = manages || decide(ctx, &grants, Action::Read, &target).verdict == Verdict::Allowed || visible_inside(exec, ctx, &grants, &target).await?;
    if !sees {
        return Err(unseen());
    }
    Ok(manages)
}

/// `listSqlViews`: all of them for whoever manages the base, those whose every table and
/// field they read for everyone else. Serialized.
pub async fn list_sql_views(pools: &Pools, ctx: &RequestContext, base_id: &str) -> R<Vec<Value>> {
    let (manages, rows) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id).await?;
        let rows = tx.rows(&format!("{SELECT} WHERE v.base_id = $1::text::uuid ORDER BY v.position, v.label_key"), &[&base_id]).await?;
        Ok((manages, rows.iter().map(ViewRow::of).collect::<Vec<_>>()))
    })
    .await?;
    if manages {
        return Ok(rows.iter().map(|r| r.serialized(true)).collect());
    }
    Ok(readable_for(pools, ctx, base_id, rows).await?.iter().map(|r| r.serialized(false)).collect())
}

/// `readableFor`: the rows the caller reads everything of. Broken ones read nothing.
async fn readable_for(pools: &Pools, ctx: &RequestContext, base_id: &str, rows: Vec<ViewRow>) -> R<Vec<ViewRow>> {
    let standing: Vec<ViewRow> = rows.into_iter().filter(|r| r.broken_reason.is_none()).collect();
    if standing.is_empty() {
        return Ok(standing);
    }
    let reach = reader_reach(pools, ctx, base_id).await?;
    let ids: Vec<String> = standing.iter().map(|r| r.id.clone()).collect();
    let ids = &ids;
    let dependencies = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move { dependencies_of(&tx, ids).await }).await?;
    Ok(standing.into_iter().filter(|r| reads_all(dependencies.get(&r.id).map(Vec::as_slice).unwrap_or(&[]), &reach.schema, &reach.tables)).collect())
}

const ONE: &str = "WHERE v.base_id = $1::text::uuid AND (v.id::text = $2::text OR vn.name = $2::text)";

fn not_found(view: &str) -> AppError {
    AppError::new("RESOURCE_NOT_FOUND").with("view", json!(view))
}

/// `getSqlView`: the same rule as the list — a view someone does not read everything of
/// does not exist for them. Serialized.
pub async fn get_sql_view(pools: &Pools, ctx: &RequestContext, base_id: &str, view: &str) -> R<Value> {
    let (manages, row) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id).await?;
        let row = tx.rows(&format!("{SELECT} {ONE}"), &[&base_id, &view]).await?.first().map(ViewRow::of);
        Ok((manages, row))
    })
    .await?;
    let row = row.ok_or_else(|| not_found(view))?;
    if manages {
        return Ok(row.serialized(true));
    }
    readable_for(pools, ctx, base_id, vec![row]).await?.first().map(|r| r.serialized(false)).ok_or_else(|| not_found(view))
}

// ------------------------------------------------------------------------------------
// Writing

/// `SqlViewInput` (as `sqlViewInput` of `app.ts` passes it: the values as sent).
#[derive(Debug, Default)]
pub struct SqlViewInput<'a> {
    pub label: Option<&'a Value>,
    pub name: Option<&'a Value>,
    pub description: Option<&'a Value>,
    pub definition: Option<&'a Value>,
    pub look: Option<LookInput>,
}

impl<'a> SqlViewInput<'a> {
    /// `sqlViewInput`: the look travels flat, as a table's does.
    pub fn of_body(body: &'a Value) -> R<SqlViewInput<'a>> {
        let look = look_of_body(body)?;
        Ok(SqlViewInput { label: body.get("label"), name: body.get("name"), description: body.get("description"), definition: body.get("definition"), look })
    }
}

/// `baseOf`: the base's current schema (id, name); frozen, it takes no structure step.
async fn base_of<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<(String, String)> {
    let row = exec
        .first(
            "SELECT s.id::text AS schema_id, sn.name::text AS schema_name, b.structure_state::text
               FROM _basedb.base b
               JOIN _basedb.tenant t         ON t.id = b.tenant_id
               JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE b.id::text = $1::text AND t.ref = $2::text AND b.is_live",
            &[&base_id, &ctx.tenant_id],
        )
        .await?
        .ok_or_else(|| AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)))?;
    if row.get::<_, String>(2) == "frozen" {
        return Err(AppError::new("BASE_STRUCTURE_FROZEN").with("base", json!(base_id)));
    }
    Ok((row.get(0), row.get(1)))
}

/// `requireBuilder`: building a view is building the base — `manage_schema`, a person only.
async fn require_builder<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str) -> R<()> {
    let manages = access_to(exec, ctx, base_id).await?;
    if !manages || ctx.surface == Surface::Mcp {
        return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
    }
    Ok(())
}

/// `definitionError`: PostgreSQL's own message, its position brought back into the text
/// the person typed, past the `CREATE VIEW … AS` they did not.
fn definition_error(error: &tokio_postgres::Error, head: &str) -> AppError {
    let Some(db) = error.as_db_error() else { return AppError::internal(error) };
    let position = match db.position() {
        Some(ErrorPosition::Original(p)) => {
            let p = i64::from(*p) - js_len(head) as i64;
            if p > 0 {
                json!(p)
            } else {
                Value::Null
            }
        }
        _ => Value::Null,
    };
    AppError::new("REQUEST_INVALID")
        .with("field", json!("definition"))
        .with("sqlstate", json!(db.code().code()))
        .with("message", json!(db.message()))
        .with("detail", json!(db.detail()))
        .with("hint", json!(db.hint()))
        .with("position", position)
        .caused_by(error)
}

/// `writeView`: creates the view — or replaces it — from its definition, then checks what
/// PostgreSQL says it reads. Unqualified names resolve in the base's schema.
async fn write_view(tx: &StructureTx, schema: &str, name: &str, definition: &str, base_id: &str, replace: bool) -> R<()> {
    tx.simple(&format!("SET LOCAL search_path TO {}", quote_identifier(schema)?)).await?;
    let qualified = qualify(schema, name)?;
    let head = format!("CREATE {}VIEW {qualified} WITH (security_invoker = true) AS\n", if replace { "OR REPLACE " } else { "" });
    tx.simple("SAVEPOINT sql_view_write").await?;
    if let Err(error) = tx.single(&format!("{head}{definition}")).await {
        // A view whose columns change cannot be replaced in place: it is made again —
        // unless another view reads it, which PostgreSQL then names.
        let code = error.code().map(|c| c.code().to_string());
        if !replace || !matches!(code.as_deref(), Some("42P16") | Some("42804")) {
            return Err(definition_error(&error, &head));
        }
        tx.simple("ROLLBACK TO SAVEPOINT sql_view_write").await?;
        assert_unread(tx, schema, name).await?;
        tx.simple(&format!("DROP VIEW {qualified} RESTRICT")).await?;
        let create = format!("CREATE VIEW {qualified} WITH (security_invoker = true) AS\n");
        tx.single(&format!("{create}{definition}")).await.map_err(|e| definition_error(&e, &create))?;
    }
    tx.simple("RELEASE SAVEPOINT sql_view_write").await?;
    tx.simple("SET LOCAL search_path TO DEFAULT").await?;
    assert_inside_base(tx, schema, name, base_id).await
}

/// `assertInsideBase`: a view reads its own base and nothing else — its live tables, its
/// other views, PostgreSQL's catalog —, read from what PostgreSQL recorded.
async fn assert_inside_base<E: Exec + Sync>(exec: &E, schema: &str, name: &str, base_id: &str) -> R<()> {
    let qualified = qualify(schema, name)?;
    let outside = exec
        .first(
            "SELECT n.nspname || '.' || c.relname AS what
               FROM pg_rewrite r
               JOIN pg_depend d    ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
               JOIN pg_class c     ON d.refclassid = 'pg_class'::regclass AND c.oid = d.refobjid
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE r.ev_class = $1::text::regclass AND c.oid <> r.ev_class
                AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                AND NOT (n.nspname = $2::text AND (
                      EXISTS (SELECT 1 FROM _basedb.table_def t
                                JOIN _basedb.physical_name tn ON tn.id = t.name_id
                               WHERE t.base_id = $3::text::uuid AND t.is_live AND tn.name = c.relname)
                   OR EXISTS (SELECT 1 FROM _basedb.sql_view v
                                JOIN _basedb.physical_name vn ON vn.id = v.name_id
                               WHERE v.base_id = $3::text::uuid AND vn.name = c.relname)))
             UNION
             SELECT n.nspname || '.' || p.proname
               FROM pg_rewrite r
               JOIN pg_depend d    ON d.classid = 'pg_rewrite'::regclass AND d.objid = r.oid
               JOIN pg_proc p      ON d.refclassid = 'pg_proc'::regclass AND p.oid = d.refobjid
               JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE r.ev_class = $1::text::regclass AND n.nspname <> 'pg_catalog'
              LIMIT 1",
            &[&qualified, &schema, &base_id],
        )
        .await?;
    if let Some(row) = outside {
        let what: String = row.get(0);
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("definition")).with("reason", json!("hors_base")).with("object", json!(what)));
    }
    Ok(())
}

/// `assertUnread`: refuses to take a view out of PostgreSQL while another view reads it,
/// naming that one rather than letting `DROP … RESTRICT` fail with a bare `2BP01`.
async fn assert_unread<E: Exec + Sync>(exec: &E, schema: &str, name: &str) -> R<()> {
    let readers = exec
        .first(
            "SELECT DISTINCT dc.relname::text AS name
               FROM pg_depend d
               JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
               JOIN pg_class dc  ON dc.oid = r.ev_class
              WHERE d.refclassid = 'pg_class'::regclass
                AND d.refobjid = to_regclass($1::text) AND dc.oid <> d.refobjid",
            &[&qualify(schema, name)?],
        )
        .await?;
    if let Some(row) = readers {
        let dependent: String = row.get(0);
        return Err(AppError::new("DEPENDENT_OBJECT").with("dependent", json!(dependent)).with("referenced", json!(name)).with("kind", json!("sql_view")));
    }
    Ok(())
}

async fn row_of<E: Exec + Sync>(exec: &E, base_id: &str, view: &str) -> R<ViewRow> {
    exec.first(&format!("{SELECT} {ONE}"), &[&base_id, &view]).await?.as_ref().map(ViewRow::of).ok_or_else(|| not_found(view))
}

/// `assertLabelFree`: a label is unique among the tables and views of a base.
async fn assert_label_free<E: Exec + Sync>(exec: &E, base_id: &str, label: &str, except: Option<&str>) -> R<()> {
    let clash = exec
        .first(
            "SELECT id::text FROM _basedb.sql_view
              WHERE base_id = $1::text::uuid AND label_key = $2::text AND ($3::text::uuid IS NULL OR id <> $3::text::uuid)
             UNION ALL
             SELECT id::text FROM _basedb.table_def
              WHERE base_id = $1::text::uuid AND label_key = $2::text AND deleted_at IS NULL",
            &[&base_id, &label_key(label), &except],
        )
        .await?;
    if clash.is_some() {
        return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)));
    }
    Ok(())
}

/// `checkLabel`.
fn check_label(value: Option<&Value>) -> R<String> {
    let Some(Value::String(s)) = value else { return Err(AppError::new("LABEL_EMPTY")) };
    let label = collapse_spaces(&nfc(s));
    if label.is_empty() {
        return Err(AppError::new("LABEL_EMPTY"));
    }
    if label.chars().count() > MAX_LABEL_CHARS {
        return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(MAX_LABEL_CHARS)));
    }
    Ok(label)
}

/// `checkDefinition`: the query as typed, less a final `;` `CREATE VIEW … AS` would not take.
fn check_definition(value: Option<&Value>) -> R<String> {
    let text = match value {
        Some(Value::String(s)) => {
            let trimmed = js_trim(s);
            let cut = match trimmed.strip_suffix(';') {
                Some(rest) => rest,
                None => trimmed,
            };
            js_trim_end(cut).to_string()
        }
        _ => String::new(),
    };
    let invalid = |reason: &str| AppError::new("REQUEST_INVALID").with("field", json!("definition")).with("reason", json!(reason));
    if text.is_empty() {
        return Err(invalid("vide"));
    }
    if js_len(&text) > MAX_DEFINITION_CHARS || text.contains('\u{0}') {
        return Err(invalid("invalide"));
    }
    Ok(text)
}

/// `createSqlView`. Serialized, `editable`.
pub async fn create_sql_view(pools: &Pools, ctx: &RequestContext, base_id: &str, input: &SqlViewInput<'_>) -> R<Value> {
    let label = check_label(input.label)?;
    let definition = check_definition(input.definition)?;
    let description = normalize_description(input.description, "description")?;
    let look = checked_look(input.look.as_ref())?.unwrap_or_default();
    let (label, definition, description, look) = (&label, &definition, &description, &look);
    in_structure(pools, |tx| async move {
        require_builder(&tx, ctx, base_id).await?;
        let (schema_id, schema_name) = base_of(&tx, ctx, base_id).await?;
        assert_label_free(&tx, base_id, label, None).await?;
        let candidate = match input.name {
            None => Candidate::Label(label.clone()),
            Some(Value::String(s)) if js_trim(s).is_empty() => Candidate::Label(label.clone()),
            Some(Value::String(s)) => Candidate::Technical(js_trim(s).to_string()),
            Some(_) => return Err(AppError::internal("TypeError: input.name.trim is not a function")),
        };
        let allocated = allocate_name(&tx, ctx, &AllocationRequest::new(candidate, ObjectKind::SqlView, ScopeKind::Schema, schema_id.clone())).await?;
        write_view(&tx, &schema_name, &allocated.name, definition, base_id, false).await?;
        let row = tx
            .query_op(
                "INSERT INTO _basedb.sql_view
                   (base_id, schema_id, name_id, label, label_key, description, color, icon, image,
                    position, definition, created_by, updated_by)
                 SELECT $1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text,
                        coalesce((SELECT max(position) + 1 FROM _basedb.sql_view WHERE base_id = $1::text::uuid), 0),
                        $10::text, $11::text::uuid, $11::text::uuid
                 RETURNING id::text",
                &[&base_id, &schema_id, &allocated.name_id, label, &label_key(label), description, &look.color, &look.icon, &look.image, definition, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let id: String = row[0].get(0);
        tx.simple(&format!("COMMENT ON VIEW {} IS {}", qualify(&schema_name, &allocated.name)?, quote_literal(label))).await?;
        let mut payload = Map::new();
        payload.insert("label".into(), json!(label));
        payload.insert("definition".into(), json!(definition));
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(id.clone()), object_name: Some(allocated.name.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("sql_view.create", "sql_view") },
        )
        .await?;
        Ok(row_of(&tx, base_id, &id).await?.serialized(true))
    })
    .await
}

/// `updateSqlView`. Serialized, `editable`.
pub async fn update_sql_view(pools: &Pools, ctx: &RequestContext, base_id: &str, view: &str, input: &SqlViewInput<'_>) -> R<Value> {
    let label = input.label.map(|v| check_label(Some(v))).transpose()?;
    let definition = input.definition.map(|v| check_definition(Some(v))).transpose()?;
    let sets_description = input.description.is_some();
    let description = if sets_description { normalize_description(input.description, "description")? } else { None };
    let look = checked_look(input.look.as_ref())?;
    let (label, definition, description, look) = (&label, &definition, &description, &look);
    in_structure(pools, |tx| async move {
        require_builder(&tx, ctx, base_id).await?;
        let current = row_of(&tx, base_id, view).await?;
        if let Some(label) = label {
            assert_label_free(&tx, base_id, label, Some(&current.id)).await?;
        }
        // A new text — or a broken view's own one, saved again: PostgreSQL gets the view back.
        if let Some(definition) = definition {
            base_of(&tx, ctx, base_id).await?;
            write_view(&tx, &current.schema_name, &current.name, definition, base_id, current.broken_reason.is_none()).await?;
        }
        tx.execute_op(
            "UPDATE _basedb.sql_view
                SET label = coalesce($2::text, label), label_key = coalesce($3::text, label_key),
                    description = CASE WHEN $4::boolean THEN $5::text ELSE description END,
                    definition = coalesce($6::text, definition),
                    broken_reason = CASE WHEN $6::text IS NULL THEN broken_reason END,
                    color = CASE WHEN $7::boolean THEN $8::text ELSE color END,
                    icon  = CASE WHEN $7::boolean THEN $9::text ELSE icon END,
                    image = CASE WHEN $7::boolean THEN $10::text ELSE image END,
                    updated_at = pg_catalog.clock_timestamp(), updated_by = $11::text::uuid
              WHERE id = $1::text::uuid",
            &[
                &current.id,
                label,
                &label.as_deref().map(label_key),
                &sets_description,
                description,
                definition,
                &look.is_some(),
                &look.as_ref().and_then(|l| l.color.clone()),
                &look.as_ref().and_then(|l| l.icon.clone()),
                &look.as_ref().and_then(|l| l.image.clone()),
                &ctx.actor.id,
            ],
            SqlOp::Update,
        )
        .await?;
        if let Some(label) = label {
            tx.simple(&format!("COMMENT ON VIEW {} IS {}", qualify(&current.schema_name, &current.name)?, quote_literal(label))).await?;
        }
        let mut payload = Map::new();
        if let Some(label) = label {
            payload.insert("label".into(), json!(label));
        }
        if let Some(definition) = definition {
            payload.insert("definition".into(), json!(definition));
        }
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(current.id.clone()), object_name: Some(current.name.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("sql_view.update", "sql_view") },
        )
        .await?;
        Ok(row_of(&tx, base_id, &current.id).await?.serialized(true))
    })
    .await
}

/// `deleteSqlView`: from PostgreSQL and from the catalog; its name stays taken. Refused
/// while another view reads it.
pub async fn delete_sql_view(pools: &Pools, ctx: &RequestContext, base_id: &str, view: &str) -> R<()> {
    in_structure(pools, |tx| async move {
        require_builder(&tx, ctx, base_id).await?;
        let current = row_of(&tx, base_id, view).await?;
        assert_unread(&tx, &current.schema_name, &current.name).await?;
        tx.simple(&format!("DROP VIEW IF EXISTS {} RESTRICT", qualify(&current.schema_name, &current.name)?)).await?;
        tx.execute_op(
            "UPDATE _basedb.physical_name SET state = 'retired', state_changed_at = pg_catalog.clock_timestamp()
              WHERE id = (SELECT name_id FROM _basedb.sql_view WHERE id = $1::text::uuid)",
            &[&current.id],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op("DELETE FROM _basedb.sql_view WHERE id = $1::text::uuid", &[&current.id], SqlOp::Delete).await?;
        let mut payload = Map::new();
        payload.insert("label".into(), json!(current.label));
        payload.insert("definition".into(), json!(current.definition));
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(current.id.clone()), object_name: Some(current.name.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("sql_view.delete", "sql_view") },
        )
        .await
    })
    .await
}

/// `reorderSqlViews`: those not named keep their place after.
pub async fn reorder_sql_views(pools: &Pools, ctx: &RequestContext, base_id: &str, order: &[String]) -> R<()> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_builder(&tx, ctx, base_id).await?;
        tx.execute_op(
            "UPDATE _basedb.sql_view v SET position = o.n
               FROM unnest($2::text[]) WITH ORDINALITY AS o(id, n)
              WHERE v.base_id = $1::text::uuid AND v.id::text = o.id",
            &[&base_id, &order],
            SqlOp::Update,
        )
        .await?;
        Ok(())
    })
    .await
}

// ------------------------------------------------------------------------------------
// Through the structure's own operations

/// `DetachedView`: a view taken out of PostgreSQL for a structure step, and how to put
/// it back.
#[derive(Debug, Clone)]
pub struct DetachedView {
    pub id: String,
    pub schema: String,
    pub name: String,
    /// What PostgreSQL held — exact whatever was renamed since the text was written.
    pub compiled: String,
}

/// `detachSqlViews`: takes out of PostgreSQL every SQL view that reads `column` of a
/// table — or the table itself when `None` —, directly or through another view.
/// Innermost first: the order [`reattach_sql_views`] puts them back in.
pub async fn detach_sql_views<E: Exec + Sync>(exec: &E, schema: &str, table: &str, column: Option<&str>) -> R<Vec<DetachedView>> {
    let found = exec
        .rows(
            "WITH RECURSIVE readers(rel, depth) AS (
               SELECT r.ev_class, 1
                 FROM pg_depend d
                 JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
                WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid = to_regclass($1::text)
                  AND r.ev_class <> d.refobjid
                  AND ($2::text IS NULL OR d.refobjsubid = (
                        SELECT attnum FROM pg_attribute WHERE attrelid = to_regclass($1::text) AND attname = $2::text))
               UNION
               SELECT r.ev_class, readers.depth + 1
                 FROM readers
                 JOIN pg_depend d  ON d.refclassid = 'pg_class'::regclass AND d.refobjid = readers.rel
                 JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
                WHERE r.ev_class <> readers.rel
             )
             SELECT v.id::text, c.relname::text AS name, pg_get_viewdef(c.oid, true) AS compiled,
                    max(readers.depth) AS depth
               FROM readers
               JOIN pg_class c     ON c.oid = readers.rel
               JOIN pg_namespace n ON n.oid = c.relnamespace
               JOIN _basedb.physical_name vn ON vn.name = c.relname
               JOIN _basedb.sql_view v       ON v.name_id = vn.id
               JOIN _basedb.db_schema s      ON s.id = v.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id AND sn.name = n.nspname
              GROUP BY v.id, c.relname, c.oid
              ORDER BY max(readers.depth)",
            &[&qualify(schema, table)?, &column],
        )
        .await?;
    if found.is_empty() {
        return Ok(Vec::new());
    }
    let views: Vec<DetachedView> = found.iter().map(|r| DetachedView { id: r.get(0), schema: schema.to_string(), name: r.get(1), compiled: r.get(2) }).collect();
    // One statement for all: PostgreSQL drops a set whose members read one another.
    let list = views.iter().map(|v| qualify(schema, &v.name)).collect::<R<Vec<_>>>()?.join(", ");
    exec.execute_op(&format!("DROP VIEW IF EXISTS {list} RESTRICT"), &[], SqlOp::Ddl).await?;
    Ok(views)
}

/// `reattachSqlViews`: puts detached views back, innermost first. One that no longer
/// holds stays out, `broken` with `reason`, its definition kept.
pub async fn reattach_sql_views<E: Exec + Sync>(exec: &E, views: &[DetachedView], reason: &str) -> R<()> {
    for view in views {
        exec.execute_op("SAVEPOINT sql_view_reattach", &[], SqlOp::Ddl).await?;
        let attempt = async {
            exec.execute_op(&format!("SET LOCAL search_path TO {}", quote_identifier(&view.schema)?), &[], SqlOp::Ddl).await?;
            exec.execute_op(&format!("CREATE VIEW {} WITH (security_invoker = true) AS\n{}", qualify(&view.schema, &view.name)?, view.compiled), &[], SqlOp::Ddl).await?;
            exec.execute_op("SET LOCAL search_path TO DEFAULT", &[], SqlOp::Ddl).await?;
            exec.execute_op("RELEASE SAVEPOINT sql_view_reattach", &[], SqlOp::Ddl).await?;
            Ok::<(), AppError>(())
        }
        .await;
        if attempt.is_err() {
            exec.execute_op("ROLLBACK TO SAVEPOINT sql_view_reattach", &[], SqlOp::Ddl).await?;
            exec.execute_op(
                "UPDATE _basedb.sql_view SET broken_reason = $2::text, updated_at = pg_catalog.clock_timestamp()
                  WHERE id = $1::text::uuid",
                &[&view.id, &reason],
                SqlOp::Update,
            )
            .await?;
        }
    }
    Ok(())
}

/// `purgeSqlViewStatements`: the statements that take every SQL view of a base out of
/// PostgreSQL and the catalog — for the purge of the base, which destroys its schema.
pub async fn purge_sql_view_statements<E: Exec + Sync>(exec: &E, base_id: &str, schema: &str, stamp: &str) -> R<Vec<String>> {
    let views = exec
        .rows(
            "SELECT v.id::text, vn.name::text FROM _basedb.sql_view v
               JOIN _basedb.physical_name vn ON vn.id = v.name_id
              WHERE v.base_id = $1::text::uuid",
            &[&base_id],
        )
        .await?;
    if views.is_empty() {
        return Ok(Vec::new());
    }
    let list = views.iter().map(|v| qualify(schema, &v.get::<_, String>(1))).collect::<R<Vec<_>>>()?.join(", ");
    let base = quote_literal(base_id);
    Ok(vec![
        format!("DROP VIEW IF EXISTS {list} RESTRICT;"),
        format!(
            "UPDATE _basedb.physical_name SET state = 'purged', state_changed_at = {stamp}::timestamptz\n WHERE id IN (SELECT name_id FROM _basedb.sql_view WHERE base_id = {base}::uuid);"
        ),
        format!("DELETE FROM _basedb.sql_view WHERE base_id = {base}::uuid;"),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_definition_loses_its_final_semicolon_only() {
        let d = |s: &str| check_definition(Some(&json!(s)));
        assert_eq!(d("  SELECT 1 ;  ").unwrap(), "SELECT 1");
        assert_eq!(d("SELECT 1;;").unwrap(), "SELECT 1;");
        assert_eq!(d(" ; ").unwrap_err().details["reason"], json!("vide"));
        assert_eq!(check_definition(Some(&json!(5))).unwrap_err().details["reason"], json!("vide"));
        assert_eq!(d("SELECT '\u{0}'").unwrap_err().details["reason"], json!("invalide"));
        assert_eq!(check_label(Some(&json!("  Ventes   du  mois "))).unwrap(), "Ventes du mois");
        assert_eq!(check_label(None).unwrap_err().code, "LABEL_EMPTY");
    }

    fn dep(schema: &str, relation: &str, kind: &str, column: Option<&str>) -> Dependency {
        Dependency { schema: schema.into(), relation: relation.into(), kind: kind.into(), column: column.map(Into::into) }
    }

    #[test]
    fn judges_what_a_view_reads() {
        let mut reach = indexmap::IndexMap::new();
        reach.insert("clients".to_string(), HashSet::from(["nom".to_string()]));
        assert!(reads_all(&[dep("pg_catalog", "pg_class", "r", None)], "s", &reach));
        assert!(reads_all(&[dep("s", "clients", "r", Some("nom")), dep("s", "autre_vue", "v", None)], "s", &reach));
        assert!(reads_all(&[dep("s", "clients", "r", None)], "s", &reach));
        assert!(!reads_all(&[dep("s", "clients", "r", Some("email"))], "s", &reach));
        assert!(!reads_all(&[dep("s", "factures", "r", None)], "s", &reach));
        assert!(!reads_all(&[dep("autre", "clients", "r", None)], "s", &reach));
        assert!(!reads_all(&[dep("s", "seq", "S", None)], "s", &reach));
        assert!(reads_all(&[], "s", &reach));
    }
}
