//! The schema as an agent reads it — `list_bases`, `describe_base`, `describe_table` and
//! `whoami` (`agent/describe.ts`, chapter 09 §4). Every block is a projection of the
//! catalog, key by key; a description is user data and travels under
//! `provenance: "user_data"`.

use super::view::{agent_view, display_field, link_target, resolve_agent_base, resolve_agent_table, AgentBase, AgentField, AgentTable, AgentView};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::Verdict;
use basedb_base::time::iso;
use basedb_base::tx::RequestContext;
use basedb_catalog::description::system_column_description;
use basedb_catalog::naming::{qualify, quote_identifier};
use basedb_catalog::projection::{names_environment, BaseRow};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

/// `INVERSE_BUDGETS.blocks`.
const INVERSE_BLOCKS: usize = 20;

/// `ON_DELETE_MEANING`: three fixed sentences, naming no object.
pub fn on_delete_meaning(on_delete: &str) -> Option<&'static str> {
    match on_delete {
        "restrict" => Some("La suppression d'une ligne cible encore référencée par ce champ est refusée (clause ON DELETE NO ACTION)."),
        "set_null" => Some("La suppression d'une ligne cible vide ce champ dans les lignes qui la référençaient."),
        "cascade" => Some("La suppression d'une ligne cible supprime en chaîne, par PostgreSQL, les lignes qui la référencent. La surface MCP n'émet jamais de DELETE : un agent ne peut déclencher aucune cascade."),
        _ => None,
    }
}

const HIDDEN_TARGET: &str = "Ce champ pointe vers une table que vous n’êtes pas autorisé à consulter.";

/// A notice: a closed code, a fixed sentence, and the visible field it concerns.
pub fn notice(kind: &str, message: &str, field: Option<&str>) -> Value {
    let mut out = Map::new();
    out.insert("kind".into(), json!(kind));
    if let Some(field) = field {
        out.insert("field".into(), json!(field));
    }
    out.insert("message".into(), json!(message));
    Value::Object(out)
}

/// `physicalNamesExposed`: `mcp_expose_physical_names` set to `false` withholds schema,
/// qualified names and SQL.
pub async fn physical_names_exposed(pools: &Pools, ctx: &RequestContext) -> Result<bool, AppError> {
    let conn = pools.catalog().await?;
    let row = conn
        .first(
            "SELECT s.value::text
               FROM _basedb.setting s
               LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
              WHERE s.key = 'mcp_expose_physical_names'
                AND (s.scope_kind = 'instance' OR t.ref = $1)
              ORDER BY (s.scope_kind = 'tenant') DESC
              LIMIT 1",
            &[&ctx.tenant_id],
        )
        .await?;
    let value: Option<Value> = row.and_then(|r| r.get::<_, Option<String>>(0)).and_then(|t| serde_json::from_str(&t).ok());
    Ok(!matches!(value, Some(Value::Bool(false))) && value != Some(json!("false")))
}

/// `estimates`: row counts from `pg_class.reltuples`, never a `COUNT(*)`; `-1` (never
/// analyzed) is `null`. Under a row rule, the table's size is not the reader's to learn.
async fn estimates(pools: &Pools, tables: &[&AgentTable]) -> Result<HashMap<String, Option<i64>>, AppError> {
    let mut by_schema: Vec<(String, Vec<String>)> = Vec::new();
    for t in tables {
        if t.decisions.read.row_predicate != "TRUE" {
            continue;
        }
        match by_schema.iter_mut().find(|(s, _)| *s == t.row.schema_name) {
            Some((_, list)) => list.push(t.row.table_name.clone()),
            None => by_schema.push((t.row.schema_name.clone(), vec![t.row.table_name.clone()])),
        }
    }
    let mut out = HashMap::new();
    for (schema, names) in by_schema {
        let conn = pools.get(PoolName::Data).await?;
        let rows = conn
            .rows(
                "SELECT c.relname::text AS name, c.reltuples::bigint AS n
                   FROM pg_catalog.pg_class c
                   JOIN pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
                  WHERE ns.nspname = $1 AND c.relname = ANY($2::text[]) AND c.relkind IN ('r', 'p')",
                &[&schema, &names],
            )
            .await?;
        for row in rows {
            let n: i64 = row.get(1);
            out.insert(format!("{schema}.{}", row.get::<_, String>(0)), (n >= 0).then_some(n));
        }
    }
    Ok(out)
}

fn estimate_of(map: &HashMap<String, Option<i64>>, table: &AgentTable) -> Value {
    json!(map.get(&format!("{}.{}", table.row.schema_name, table.row.table_name)).cloned().flatten())
}

fn display_block(table: &AgentTable) -> Option<Value> {
    display_field(table).map(|f| json!({ "name": f.name, "label": f.label, "kind": f.kind }))
}

fn business_count(table: &AgentTable) -> usize {
    table.fields.iter().filter(|f| !f.system).count()
}

fn environment_block(out: &mut Map<String, Value>, base: &AgentBase) {
    out.insert("environment".into(), json!(base.row.environment));
    out.insert("production".into(), json!(base.row.is_production));
}

/// `lookOf`: the colour and pictogram, when set.
fn look_of(out: &mut Map<String, Value>, color: &Option<String>, icon: &Option<String>) {
    if let Some(c) = color {
        out.insert("color".into(), json!(c));
    }
    if let Some(i) = icon {
        out.insert("icon".into(), json!(i));
    }
}

fn qualified(schema: &str, table: &str) -> String {
    qualify(schema, table).unwrap_or_else(|_| format!("\"{schema}\".\"{table}\""))
}

/// `Number(catalog_version)`.
fn number_of(text: &str) -> Value {
    text.parse::<i64>().map(|n| json!(n)).unwrap_or_else(|_| text.parse::<f64>().ok().map_or(Value::Null, |f| json!(f)))
}

/// `basesOf`: the visible bases — of the environment asked, when one is.
fn bases_of(view: &AgentView) -> Vec<&AgentBase> {
    let Some(asked) = &view.ctx.environment else { return view.bases.iter().collect() };
    view.bases
        .iter()
        .filter(|b| {
            let production: Option<&BaseRow> = view.raw.bases.iter().find(|p| p.lineage_id == b.row.lineage_id && p.is_production);
            names_environment(&b.row, asked, production)
        })
        .collect()
}

/// `list_bases`.
pub async fn agent_list_bases(pools: &Pools, ctx: &RequestContext) -> Result<Value, AppError> {
    let view = agent_view(pools, ctx).await?;
    let exposed = physical_names_exposed(pools, ctx).await?;
    let bases: Vec<Value> = bases_of(&view)
        .into_iter()
        .map(|b| {
            let mut out = Map::new();
            out.insert("id".into(), json!(b.row.id));
            out.insert("name".into(), json!(b.name));
            out.insert("label".into(), json!(b.row.label));
            out.insert("description".into(), json!(b.row.description));
            environment_block(&mut out, b);
            if exposed {
                out.insert("schema".into(), json!(b.row.schema_name));
            }
            out.insert("table_count".into(), json!(b.tables.len()));
            Value::Object(out)
        })
        .collect();
    Ok(json!({ "bases": bases, "has_more": false, "provenance": "user_data" }))
}

/// `describe_base` — §4.1.
pub async fn agent_describe_base(pools: &Pools, ctx: &RequestContext, base_ref: &str) -> Result<Value, AppError> {
    let view = agent_view(pools, ctx).await?;
    let base = resolve_agent_base(&view, base_ref)?;
    let exposed = physical_names_exposed(pools, ctx).await?;
    let counts = estimates(pools, &base.tables.iter().collect::<Vec<_>>()).await?;

    // The graph after projection: an edge appears only when both of its tables are readable.
    let mut relations = Vec::new();
    for table in &base.tables {
        for field in &table.fields {
            let (Some(link), Some((_, target))) = (&field.link, link_target(&view, field)) else { continue };
            relations.push(json!({
                "from_table": table.row.table_name,
                "from_field": field.name,
                "to_table": target.row.table_name,
                "to_column": "_id",
                "cardinality": "many_to_one",
                "on_delete": link.on_delete,
                "required": field.row.as_ref().is_some_and(|r| r.is_required),
            }));
        }
    }

    // Membership in the order Node's `Map` holds it: the rows of `application_table` as the
    // snapshot read them, without an `ORDER BY`.
    let conn = pools.catalog().await?;
    let membership = conn
        .rows(
            "SELECT appt.table_id::text, appt.application_id::text
               FROM _basedb.application_table appt
               JOIN _basedb.table_def t ON t.id = appt.table_id
               JOIN _basedb.base b      ON b.id = t.base_id
               JOIN _basedb.tenant te   ON te.id = b.tenant_id
              WHERE te.ref = $1 AND t.is_live",
            &[&ctx.tenant_id],
        )
        .await?;
    let mut order: Vec<String> = Vec::new();
    for row in &membership {
        let table: String = row.get(0);
        if !order.contains(&table) {
            order.push(table);
        }
    }
    let visible: HashMap<&str, &str> = base.tables.iter().map(|t| (t.row.id.as_str(), t.row.table_name.as_str())).collect();
    let applications: Vec<Value> = view
        .raw
        .application_rows
        .iter()
        .filter(|a| a.base_id == base.row.id)
        .filter_map(|a| {
            let tables: Vec<&str> = order
                .iter()
                .filter(|t| view.raw.applications.get(*t).is_some_and(|apps| apps.contains(&a.id)))
                .filter_map(|t| visible.get(t.as_str()).copied())
                .collect();
            (!tables.is_empty()).then(|| json!({ "name": a.name, "label": a.label, "tables": tables }))
        })
        .collect();

    let mut head = Map::new();
    head.insert("id".into(), json!(base.row.id));
    head.insert("name".into(), json!(base.name));
    head.insert("label".into(), json!(base.row.label));
    head.insert("description".into(), json!(base.row.description));
    environment_block(&mut head, base);
    if exposed {
        head.insert("schema".into(), json!(base.row.schema_name));
    }
    head.insert("catalog_version".into(), number_of(&base.row.catalog_version));

    let tables: Vec<Value> = base
        .tables
        .iter()
        .map(|t| {
            let mut out = Map::new();
            out.insert("id".into(), json!(t.row.id));
            out.insert("name".into(), json!(t.row.table_name));
            out.insert("label".into(), json!(t.row.label));
            out.insert("description".into(), json!(t.row.description));
            look_of(&mut out, &t.row.color, &t.row.icon);
            if let Some(display) = display_block(t) {
                out.insert("display_field".into(), display);
            }
            out.insert("field_count".into(), json!(business_count(t)));
            out.insert("row_count_estimate".into(), estimate_of(&counts, t));
            Value::Object(out)
        })
        .collect();
    let notices = if base.tables.is_empty() {
        vec![notice(
            "empty_base",
            "Cette base n’a encore aucune table que vous puissiez lire : proposez-en une avec propose_create_table ; une personne qui gère la base l’approuve dans l’application.",
            None,
        )]
    } else {
        vec![]
    };
    Ok(json!({
        "base": head,
        "tables": tables,
        "relations": relations,
        "applications": applications,
        "provenance": "user_data",
        "notices": notices,
    }))
}

/// `describeField`: one field, per the projection table of §4.3.
fn describe_field(view: &AgentView, table: &AgentTable, field: &AgentField, exposed: bool, notices: &mut Vec<Value>) -> Value {
    if field.system {
        return json!({
            "name": field.name,
            "label": field.label,
            "kind": "system",
            "description": system_column_description(&field.name),
            "access": "read",
        });
    }
    let row = field.row.as_ref();
    let mut out = Map::new();
    out.insert("name".into(), json!(field.name));
    out.insert("label".into(), json!(field.label));
    out.insert("kind".into(), json!(field.kind));
    out.insert("description".into(), json!(row.and_then(|r| r.description.clone())));
    out.insert("access".into(), json!(if field.writable { "write" } else { "read" }));
    out.insert("required".into(), json!(row.is_some_and(|r| r.is_required)));
    if field.id.as_ref().is_some_and(|id| view.raw.unique.contains_key(id)) {
        out.insert("unique".into(), json!(true));
    }
    if (field.kind == "file" || field.kind == "image") && field.granted_write {
        out.insert("write_with".into(), json!("attach_file"));
    }
    if let Some(max) = row.and_then(|r| r.max_length) {
        out.insert("max_length".into(), json!(max));
    }
    if row.is_some_and(|r| r.is_rich) {
        out.insert("rich_text".into(), json!(true));
    }
    if let Some(kind) = row.and_then(|r| r.default_kind.as_deref()) {
        let value = if kind == "value" {
            json!({ "kind": "value", "value": row.and_then(|r| r.default_value.clone()).unwrap_or(Value::Null) })
        } else {
            json!({ "kind": kind })
        };
        out.insert("default".into(), value);
    }
    if let Some(options) = field.id.as_ref().and_then(|id| view.raw.options.get(id)) {
        let list: Vec<Value> = options
            .iter()
            .map(|o| {
                let mut m = Map::new();
                m.insert("value".into(), json!(o.value));
                m.insert("label".into(), json!(o.label));
                look_of(&mut m, &o.color, &o.icon);
                Value::Object(m)
            })
            .collect();
        out.insert("options".into(), Value::Array(list));
    }
    if let (true, Some(row)) = (field.kind == "formula", row) {
        // A source withheld from this bearer withholds the expression, which would name it.
        let sources: Vec<String> = field.id.as_ref().and_then(|id| view.raw.formula_sources.get(id)).cloned().unwrap_or_default();
        let readable: Vec<&AgentField> = sources.iter().filter_map(|id| table.fields.iter().find(|f| f.id.as_deref() == Some(id.as_str()))).collect();
        out.insert(
            "formula".into(),
            json!({
                "readable_expression": if readable.len() == sources.len() { json!(row.formula_expression) } else { Value::Null },
                "source_fields": readable.iter().map(|f| f.name.clone()).collect::<Vec<_>>(),
                "result_kind": row.formula_result_kind,
                "is_stored": row.formula_is_stored.unwrap_or(true),
            }),
        );
    }
    if let Some(link) = &field.link {
        match link_target(view, field) {
            None => {
                out.insert("link".into(), Value::Null);
                out.insert("expandable".into(), json!(false));
                notices.push(notice("link_target_hidden", HIDDEN_TARGET, Some(&field.name)));
            }
            Some((_, target)) => {
                let target_display = display_block(target);
                let qualified_name = qualified(&target.row.schema_name, &target.row.table_name);
                let mut target_table = Map::new();
                target_table.insert("name".into(), json!(target.row.table_name));
                target_table.insert("id".into(), json!(target.row.id));
                target_table.insert("label".into(), json!(target.row.label));
                if exposed {
                    target_table.insert("qualified".into(), json!(qualified_name));
                }
                if let Some(d) = &target_display {
                    target_table.insert("display_field".into(), d.clone());
                }
                let mut l = Map::new();
                l.insert("target_table".into(), Value::Object(target_table));
                l.insert("fk_column".into(), json!(field.name));
                if exposed {
                    l.insert("fk_constraint".into(), json!(link.fk_constraint));
                    l.insert("fk_index".into(), json!(link.fk_index));
                    l.insert("references".into(), json!(format!("{qualified_name}.{}", quote_identifier("_id").unwrap_or_else(|_| "\"_id\"".into()))));
                }
                l.insert("cardinality".into(), json!("many_to_one"));
                l.insert("on_delete".into(), json!(link.on_delete));
                if let Some(meaning) = on_delete_meaning(&link.on_delete) {
                    l.insert("on_delete_meaning".into(), json!(meaning));
                }
                l.insert("expandable".into(), json!(target_display.is_some()));
                if exposed {
                    let column = quote_identifier(&field.name).unwrap_or_else(|_| format!("\"{}\"", field.name));
                    l.insert("join_sql".into(), json!(format!("LEFT JOIN {qualified_name} AS \"c\" ON \"c\".\"_id\" = \"t\".{column}")));
                }
                out.insert("link".into(), Value::Object(l));
            }
        }
    }
    Value::Object(out)
}

/// `describe_table` — §4.2. Never truncated: it is the map, and must be complete.
pub async fn agent_describe_table(pools: &Pools, ctx: &RequestContext, base_ref: &str, table_ref: &str) -> Result<Value, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (_, table) = resolve_agent_table(&view, base_ref, table_ref)?;
    describe_resolved_table(pools, ctx, &view, table).await
}

/// `describeResolvedTable`.
pub async fn describe_resolved_table(pools: &Pools, ctx: &RequestContext, view: &AgentView, table: &AgentTable) -> Result<Value, AppError> {
    let exposed = physical_names_exposed(pools, ctx).await?;
    let counts = estimates(pools, &[table]).await?;
    let mut notices = Vec::new();
    let fields: Vec<Value> = table.fields.iter().map(|f| describe_field(view, table, f, exposed, &mut notices)).collect();
    let base = view.base_of(table);
    let base_name = base.map(|b| b.name.clone()).unwrap_or_default();

    // Inverse links: a group appears when the bearer reads the SOURCE table and field.
    let mut inverse = Vec::new();
    for link in &view.raw.links {
        if link.target_table_id != table.row.id {
            continue;
        }
        let Some(source_table_id) = view.raw.fields.iter().find(|f| f.id == link.field_id).map(|f| f.table_id.clone()) else { continue };
        let Some((_, source)) = view.table_by_id(&source_table_id) else { continue };
        let Some(source_field) = source.fields.iter().find(|f| f.id.as_deref() == Some(link.field_id.as_str())) else { continue };
        let mut filter = Map::new();
        filter.insert(source_field.name.clone(), json!({ "op": "eq", "value": "<_id de la ligne>" }));
        inverse.push(json!({
            "source_table": { "name": source.row.table_name, "id": source.row.id, "label": source.row.label },
            "source_field": { "name": source_field.name, "label": source_field.label },
            "on_delete": link.on_delete,
            "how_to_list": { "tool": "list_records", "base": base_name, "table": source.row.table_name, "filter": filter },
        }));
    }
    if inverse.len() > INVERSE_BLOCKS {
        notices.push(notice("inverse_links_truncated", &format!("Seuls les {INVERSE_BLOCKS} premiers liens inverses sont décrits."), None));
    }
    inverse.truncate(INVERSE_BLOCKS);

    let allowed = |v: Verdict| v == Verdict::Allowed;
    let access = json!({
        "read": true,
        "create": allowed(table.decisions.create.verdict),
        "update": allowed(table.decisions.update.verdict),
        "delete": allowed(table.decisions.delete.verdict),
        "manage_schema": allowed(table.decisions.manage_schema.verdict),
    });
    let mut head = Map::new();
    head.insert("id".into(), json!(table.row.id));
    head.insert("name".into(), json!(table.row.table_name));
    head.insert("label".into(), json!(table.row.label));
    if exposed {
        head.insert("qualified".into(), json!(qualified(&table.row.schema_name, &table.row.table_name)));
    }
    head.insert("description".into(), json!(table.row.description));
    if let Some(display) = display_block(table) {
        head.insert("display_field".into(), display);
    }
    head.insert("access".into(), access);
    head.insert("row_count_estimate".into(), estimate_of(&counts, table));
    Ok(json!({
        "table": head,
        "base": { "id": table.row.base_id, "name": base_name },
        "fields": fields,
        "inverse_links": inverse,
        "provenance": "user_data",
        "notices": notices,
    }))
}

/// `whoami` — identity, scope of the token, and the budgets it runs under.
pub async fn agent_who_am_i(pools: &Pools, ctx: &RequestContext, budgets: &Value) -> Result<Value, AppError> {
    let view = agent_view(pools, ctx).await?;
    let conn = pools.catalog().await?;
    let me = conn
        .first(
            "SELECT tk.id::text AS token_id, tk.label, tk.token_prefix AS prefix, tk.expires_at,
                    tk.base_id::text, tk.all_environments, u.display_name
               FROM _basedb.app_user u
               LEFT JOIN _basedb.api_token tk ON tk.id = $2::text::uuid AND tk.created_by = u.id
              WHERE u.id = $1::text::uuid",
            &[&ctx.actor.id, &ctx.actor.token_id],
        )
        .await?;
    let token_id: Option<String> = me.as_ref().and_then(|r| r.get(0));
    let base_id: Option<String> = me.as_ref().and_then(|r| r.get(4));
    let all_environments = me.as_ref().and_then(|r| r.get::<_, Option<bool>>(5)) == Some(true);
    let scope_row = view.raw.bases.iter().find(|b| Some(&b.id) == base_id.as_ref());
    let environments: Vec<&AgentBase> = view
        .bases
        .iter()
        .filter(|b| if all_environments { scope_row.is_some_and(|s| s.lineage_id == b.row.lineage_id) } else { Some(&b.row.id) == base_id.as_ref() })
        .collect();
    let scope_base = environments
        .iter()
        .find(|b| b.row.is_production)
        .copied()
        .or_else(|| view.bases.iter().find(|b| Some(&b.row.id) == base_id.as_ref()))
        .or_else(|| environments.first().copied());
    let tables: Vec<&AgentTable> = view.bases.iter().flat_map(|b| b.tables.iter()).collect();

    let mut actor = Map::new();
    actor.insert("kind".into(), json!(ctx.actor.kind.as_str()));
    if let (Some(id), Some(row)) = (token_id.filter(|t| !t.is_empty()), &me) {
        let expires: Option<chrono::DateTime<chrono::Utc>> = row.get(3);
        actor.insert(
            "token".into(),
            json!({ "id": id, "label": row.get::<_, Option<String>>(1), "prefix": row.get::<_, Option<String>>(2), "expires_at": expires.map(iso) }),
        );
    }
    actor.insert("user".into(), json!({ "id": ctx.actor.id, "display_name": me.as_ref().map(|r| r.get::<_, String>(6)) }));
    let available: Vec<Value> = environments
        .iter()
        .map(|b| {
            let mut m = Map::new();
            m.insert("name".into(), json!(b.name));
            environment_block(&mut m, b);
            Value::Object(m)
        })
        .collect();
    let allowed = |f: &dyn Fn(&AgentTable) -> Verdict| tables.iter().any(|t| f(t) == Verdict::Allowed);
    Ok(json!({
        "actor": actor,
        "tenant": ctx.tenant_id,
        "scope": {
            "base": scope_base.map(|b| json!({ "id": b.row.id, "name": b.name, "label": b.row.label })),
            "environments": if all_environments { "all" } else { "one" },
            "available": available,
            "current": ctx.environment,
        },
        "access": {
            "read": !tables.is_empty(),
            "create": allowed(&|t| t.decisions.create.verdict),
            "update": allowed(&|t| t.decisions.update.verdict),
            "delete": allowed(&|t| t.decisions.delete.verdict),
        },
        "budgets": budgets,
        "provenance": "user_data",
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notices_name_the_field_between_kind_and_message() {
        assert_eq!(notice("link_target_hidden", "m", Some("client")).to_string(), r#"{"kind":"link_target_hidden","field":"client","message":"m"}"#);
        assert_eq!(number_of("12"), json!(12));
        assert!(on_delete_meaning("autre").is_none());
    }
}
