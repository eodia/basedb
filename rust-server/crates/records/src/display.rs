//! The display value of links — `records/display.ts`, chapter 08 §5.4: one query per
//! distinct readable target table, never a join, never a query per row.

use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::{load_fields, load_grants, load_target};
use basedb_base::rbac::rows::row_where;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_contracts::naming::qualify;
use indexmap::{IndexMap, IndexSet};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

use crate::expand::{ExpandRequest, IDS_PER_TARGET, TARGETS};
use crate::filter::qi;
use crate::pg::{row_object, P};

/// A link field of the table being read (`loadLinkFields`).
#[derive(Clone, Debug)]
pub struct LinkField {
    pub column: String,
    pub target_table_id: String,
    pub kind: String,
}

/// `loadLinkFields`: links whose foreign key is in place, in catalog order.
pub async fn load_link_fields<E: Exec + Sync>(exec: &E, table_id: &str) -> Result<Vec<LinkField>, AppError> {
    let rows = exec
        .rows(
            "SELECT n.name AS column, lc.target_table_id::text AS target, f.kind
               FROM _basedb.field f
               JOIN _basedb.field_link_config lc ON lc.field_id = f.id
               JOIN _basedb.physical_name n      ON n.id = f.name_id
              WHERE f.table_id = $1::text::uuid AND f.is_live AND lc.fk_dropped_at IS NULL
              ORDER BY f.position",
            &[&table_id],
        )
        .await?;
    Ok(rows.iter().map(|r| LinkField { column: r.get(0), target_table_id: r.get(1), kind: r.get(2) }).collect())
}

#[derive(Clone, Debug)]
struct Target {
    table_name: String,
    relation: String,
    display_column: Option<String>,
    readable_columns: Vec<String>,
    readable: bool,
    row_predicate: String,
}

async fn resolve_targets<E: Exec + Sync>(exec: &E, ctx: &RequestContext, fields: &[LinkField]) -> Result<IndexMap<String, Target>, AppError> {
    let mut targets: IndexMap<String, Target> = IndexMap::new();
    let grants = load_grants(exec, ctx).await?;
    for field in fields {
        if targets.contains_key(&field.target_table_id) {
            continue;
        }
        let rbac = load_target(exec, ctx, &field.target_table_id).await?;
        let decision = rbac.as_ref().map(|t| decide(ctx, &grants, Action::Read, t));
        let readable = decision.as_ref().is_some_and(|d| d.verdict == Verdict::Allowed);
        let row = exec
            .first(
                "SELECT sn.name AS schema_name, tn.name AS table_name,
                        dn.name AS display_name, t.display_field_id::text
                   FROM _basedb.table_def t
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                   JOIN _basedb.db_schema s      ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                   LEFT JOIN _basedb.field df    ON df.id = t.display_field_id
                   LEFT JOIN _basedb.physical_name dn ON dn.id = df.name_id
                  WHERE t.id = $1::text::uuid",
                &[&field.target_table_id],
            )
            .await?;
        let Some(t) = row else { continue };
        let schema: String = t.get(0);
        let table: String = t.get(1);
        let display_name: Option<String> = t.get(2);
        let display_field_id: Option<String> = t.get(3);
        let display_readable = match (&display_field_id, &decision) {
            (Some(id), Some(d)) => d.readable_fields.contains(id),
            _ => false,
        };
        let mut readable_columns = Vec::new();
        if readable {
            for f in load_fields(exec, &field.target_table_id).await? {
                if decision.as_ref().is_some_and(|d| d.readable_fields.contains(&f.id)) && f.stored {
                    readable_columns.push(f.name);
                }
            }
        }
        targets.insert(
            field.target_table_id.clone(),
            Target {
                relation: qualify(&schema, &table).map_err(|e| AppError::internal(e.0))?,
                table_name: table,
                display_column: if display_readable { display_name } else { None },
                readable_columns,
                readable,
                row_predicate: decision.map(|d| d.row_predicate).unwrap_or_else(|| "TRUE".into()),
            },
        );
    }
    Ok(targets)
}

pub struct Resolved {
    pub rows: Vec<Map<String, Value>>,
    pub sql: Vec<String>,
    pub included: Map<String, Value>,
}

fn masked() -> Value {
    json!({ "id": null, "display": null, "masked": true })
}

fn empty_to_null(v: Value) -> Value {
    match v {
        Value::String(s) if s.is_empty() => Value::Null,
        other => other,
    }
}

/// `resolveDisplays`.
pub async fn resolve_displays(
    pools: &Pools,
    ctx: &RequestContext,
    table_id: &str,
    rows: Vec<Map<String, Value>>,
    expand: &ExpandRequest,
    readable_columns: &IndexSet<String>,
) -> Result<Resolved, AppError> {
    let table = table_id.to_string();
    let empty_page = rows.is_empty();
    let no_expand = expand.is_empty();
    let (fields, targets) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let table = table.clone();
        async move {
            let fields = load_link_fields(&tx, &table).await?;
            if no_expand && (fields.is_empty() || empty_page) {
                return Ok((fields, None));
            }
            let targets = resolve_targets(&tx, ctx, &fields).await?;
            Ok((fields, Some(targets)))
        }
    })
    .await?;
    let Some(targets) = targets else {
        return Ok(Resolved { rows, sql: vec![], included: Map::new() });
    };

    let reachable: IndexSet<&String> =
        fields.iter().filter(|f| targets.get(&f.target_table_id).is_some_and(|t| t.readable)).map(|f| &f.target_table_id).collect();
    if reachable.len() > TARGETS {
        return Err(AppError::new("EXPAND_TOO_WIDE").with("bound", json!("target tables")).with("maximum", json!(TARGETS)).with("links", json!("id")));
    }
    for column in expand.keys() {
        if !readable_columns.contains(column) {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(column)));
        }
        let field = fields.iter().find(|f| &f.column == column && f.kind == "link");
        if field.is_none_or(|f| !targets.get(&f.target_table_id).is_some_and(|t| t.readable)) {
            return Err(AppError::new("EXPAND_UNAVAILABLE").with("field", json!(column)));
        }
    }
    if fields.is_empty() || rows.is_empty() {
        return Ok(Resolved { rows, sql: vec![], included: Map::new() });
    }

    let mut by_target: IndexMap<String, IndexSet<String>> = IndexMap::new();
    for field in &fields {
        if !targets.get(&field.target_table_id).is_some_and(|t| t.readable) {
            continue;
        }
        for row in &rows {
            let ids: Vec<String> = match row.get(&field.column) {
                Some(Value::String(s)) => vec![s.clone()],
                Some(Value::Array(a)) => a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect(),
                _ => vec![],
            };
            if ids.is_empty() {
                continue;
            }
            by_target.entry(field.target_table_id.clone()).or_default().extend(ids);
        }
    }

    let mut expanded: IndexMap<String, Option<IndexSet<String>>> = IndexMap::new();
    for (column, projection) in expand {
        let Some(field) = fields.iter().find(|f| &f.column == column && f.kind == "link") else { continue };
        let current = expanded.get(&field.target_table_id).cloned();
        match (projection, current) {
            (None, _) | (_, Some(None)) => {
                expanded.insert(field.target_table_id.clone(), None);
            }
            (Some(p), current) => {
                let mut set = current.flatten().unwrap_or_default();
                set.extend(p.iter().cloned());
                expanded.insert(field.target_table_id.clone(), Some(set));
            }
        }
    }

    let mut displays: HashMap<String, HashMap<String, Value>> = HashMap::new();
    let mut included = Map::new();
    let mut sql = Vec::new();
    let mut conn = None;

    for (target_id, ids) in &by_target {
        let Some(target) = targets.get(target_id) else { continue };
        if ids.len() > IDS_PER_TARGET {
            return Err(AppError::new("EXPAND_TOO_WIDE")
                .with("bound", json!("distinct identifiers per target"))
                .with("maximum", json!(IDS_PER_TARGET))
                .with("links", json!("id")));
        }
        let is_expanded = expanded.contains_key(target_id);
        let mut projected: IndexSet<String> = IndexSet::new();
        if is_expanded {
            let asked = expanded.get(target_id).cloned().flatten();
            for column in &target.readable_columns {
                if asked.as_ref().is_none_or(|a| a.contains(column)) {
                    projected.insert(column.clone());
                }
            }
            if let Some(d) = &target.display_column {
                projected.insert(d.clone());
            }
        }
        let mut parts = vec!["\"_id\"".to_string()];
        if let Some(d) = &target.display_column {
            parts.push(format!("{} AS \"_display\"", qi(d)?));
        }
        for column in &projected {
            if Some(column) == target.display_column.as_ref() {
                continue;
            }
            parts.push(qi(column)?);
        }
        let query = format!(
            "SELECT {}\n  FROM {}\n WHERE \"_id\" = ANY($1::uuid[])\n   AND ( /*predicat_lignes:{target_id}*/ {} );",
            parts.join(", "),
            target.relation,
            row_where(&target.row_predicate, Some(&target.relation))
        );
        sql.push(query.clone());
        if conn.is_none() {
            conn = Some(pools.get(PoolName::Data).await?);
        }
        let c = conn.as_ref().expect("connection");
        let param = P::of(&json!(ids.iter().collect::<Vec<_>>()));
        let found: Vec<Map<String, Value>> = c.rows(&query, &[&param]).await?.iter().map(row_object).collect();

        displays.insert(
            target_id.clone(),
            found.iter().map(|r| (js_string(r.get("_id")), r.get("_display").cloned().unwrap_or(Value::Null))).collect(),
        );
        if is_expanded {
            let mut by_id = Map::new();
            for row in &found {
                let mut rest = row.clone();
                let display = rest.shift_remove("_display");
                if let Some(d) = &target.display_column {
                    if projected.contains(d) {
                        let v = row.get(d).filter(|v| !v.is_null()).cloned().or(display.filter(|v| !v.is_null())).unwrap_or(Value::Null);
                        rest.insert(d.clone(), v);
                    }
                }
                by_id.insert(js_string(row.get("_id")), Value::Object(rest));
            }
            included.insert(target.table_name.clone(), Value::Object(by_id));
        }
    }

    let rendered = rows
        .into_iter()
        .map(|row| {
            let mut copy = row.clone();
            for field in &fields {
                let Some(value) = row.get(&field.column) else { continue };
                let target = targets.get(&field.target_table_id).filter(|t| t.readable);
                let table = displays.get(&field.target_table_id);
                if field.kind == "multi_link" {
                    copy.insert(field.column.clone(), multi_link_value(value, target.is_some(), table));
                    continue;
                }
                if target.is_none() {
                    copy.insert(field.column.clone(), masked());
                    continue;
                }
                let Value::String(id) = value else {
                    copy.insert(field.column.clone(), json!({ "id": null, "display": null }));
                    continue;
                };
                match table.and_then(|t| t.get(id)) {
                    None => {
                        copy.insert(field.column.clone(), masked());
                    }
                    Some(display) => {
                        copy.insert(field.column.clone(), json!({ "id": id, "display": empty_to_null(display.clone()) }));
                    }
                }
            }
            copy
        })
        .collect();

    Ok(Resolved { rows: rendered, sql, included })
}

/// `String(value)` of an identifier read back.
fn js_string(v: Option<&Value>) -> String {
    match v {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Null) => "null".into(),
        None => "undefined".into(),
        Some(other) => other.to_string(),
    }
}

fn multi_link_value(value: &Value, readable: bool, table: Option<&HashMap<String, Value>>) -> Value {
    if !readable {
        return json!([masked()]);
    }
    let Value::Array(items) = value else { return Value::Null };
    if items.is_empty() {
        return Value::Null;
    }
    let mut out = Vec::new();
    let mut hidden = false;
    for id in items {
        match (id.as_str(), table) {
            (Some(id), Some(t)) if t.contains_key(id) => {
                out.push(json!({ "id": id, "display": empty_to_null(t[id].clone()) }));
            }
            _ => hidden = true,
        }
    }
    if hidden {
        out.push(masked());
    }
    Value::Array(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multi_links_hide_what_is_not_seen_as_one_element() {
        let mut t = HashMap::new();
        t.insert("a".to_string(), json!(""));
        assert_eq!(multi_link_value(&json!(["a", "b", "c"]), true, Some(&t)), json!([{ "id": "a", "display": null }, masked()]));
        assert_eq!(multi_link_value(&Value::Null, false, None), json!([masked()]));
        assert_eq!(multi_link_value(&json!([]), true, Some(&t)), Value::Null);
    }
}
