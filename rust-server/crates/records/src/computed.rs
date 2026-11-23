//! Fields computed at read time — `records/computed.ts`, chapter 04 §7 ter: lookups,
//! rollups, counts and the formulas that cannot be stored, as ONE lateral join `v`.

use basedb_base::db::Exec;
use basedb_base::error::AppError;
use basedb_base::rbac::decide::{decide, Action, ActorGrants, Decision, Verdict};
use basedb_base::rbac::loader::load_target;
use basedb_base::rbac::rows::row_where;
use basedb_base::tx::RequestContext;
use basedb_catalog::formula::{emit_formula, EmitContext, FormulaType, Node};
use indexmap::IndexMap;
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::filter::qi;
use crate::pg::{col, P};

pub const COMPUTED_ALIAS: &str = "v";

/// A live field of the table, as the plan knows it.
#[derive(Clone, Debug)]
pub struct FieldInfo {
    pub name: String,
    pub kind: String,
    pub stored: bool,
}

#[derive(Clone, Debug)]
enum Expr {
    Rollup {
        kind: String,
        outgoing_multi: bool,
        reached_by: ReachedBy,
        via: String,
        x: String,
        u: String,
        relation: String,
        predicate: String,
        value: Option<String>,
        aggregate: Option<String>,
        is_multiple: bool,
    },
    Formula {
        ast: Node,
        timezone: String,
    },
}

#[derive(Clone, Debug)]
enum ReachedBy {
    Outgoing,
    IncomingMulti,
    Incoming,
}

/// A computed field a reader may project.
#[derive(Clone, Debug)]
pub struct Computed {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub element_kind: Option<String>,
    expr: Expr,
}

/// The computed fields of one read, in the catalog order of the fields.
#[derive(Clone, Debug, Default)]
pub struct ComputedSet {
    pub columns: Vec<Computed>,
    by_id: HashMap<String, Computed>,
    names: HashMap<String, (String, String)>,
}

fn s(row: &tokio_postgres::Row, name: &str) -> Option<String> {
    let i = row.columns().iter().position(|c| c.name() == name)?;
    match col(row, i) {
        Value::String(s) => Some(s),
        Value::Null => None,
        other => Some(other.to_string()),
    }
}

fn b(row: &tokio_postgres::Row, name: &str) -> Option<bool> {
    let i = row.columns().iter().position(|c| c.name() == name)?;
    col(row, i).as_bool()
}

struct Reached {
    relation: String,
    table_name: String,
    decision: Decision,
}

/// `loadTarget` + `decide` + location, once per table.
async fn reach<E: Exec + Sync>(
    exec: &E,
    ctx: &RequestContext,
    grants: &ActorGrants,
    cache: &mut HashMap<String, Option<std::sync::Arc<Reached>>>,
    table_id: &str,
) -> Result<Option<std::sync::Arc<Reached>>, AppError> {
    if let Some(v) = cache.get(table_id) {
        return Ok(v.clone());
    }
    let target = load_target(exec, ctx, table_id).await?;
    let verdict = target.as_ref().map(|t| decide(ctx, grants, Action::Read, t));
    let location = exec
        .first(
            "SELECT sn.name AS schema_name, tn.name AS table_name
         FROM _basedb.table_def t
         JOIN _basedb.physical_name tn ON tn.id = t.name_id
         JOIN _basedb.db_schema s      ON s.id = t.schema_id
         JOIN _basedb.physical_name sn ON sn.id = s.name_id
        WHERE t.id = $1 AND t.is_live",
            &[&P::text(table_id)],
        )
        .await?;
    let value = match (location, verdict) {
        (Some(loc), Some(d)) if d.verdict == Verdict::Allowed => {
            let schema: String = loc.get(0);
            let table: String = loc.get(1);
            Some(std::sync::Arc::new(Reached {
                relation: basedb_contracts::naming::qualify(&schema, &table).map_err(|e| AppError::internal(e.0))?,
                table_name: table,
                decision: d,
            }))
        }
        _ => None,
    };
    cache.insert(table_id.to_string(), value.clone());
    Ok(value)
}

/// `citedIds`.
pub fn cited_ids(ast: &Node) -> Vec<String> {
    fn walk(n: &Node, out: &mut Vec<String>) {
        match n {
            Node::Field(id) => {
                if !out.contains(id) {
                    out.push(id.clone());
                }
            }
            Node::Call { args, .. } => args.iter().for_each(|a| walk(a, out)),
            Node::Binary { left, right, .. } => {
                walk(left, out);
                walk(right, out);
            }
            Node::Not(e) | Node::Negate(e) => walk(e, out),
            _ => {}
        }
    }
    let mut out = Vec::new();
    walk(ast, &mut out);
    out
}

fn type_of_kind(kind: &str) -> FormulaType {
    match kind {
        "number" | "autonumber" => FormulaType::Number,
        "boolean" => FormulaType::Boolean,
        "date" => FormulaType::Date,
        "datetime" => FormulaType::Datetime,
        _ => FormulaType::Text,
    }
}

/// `resolveComputed`.
pub async fn resolve_computed<E: Exec + Sync>(
    exec: &E,
    ctx: &RequestContext,
    grants: &ActorGrants,
    decision: &Decision,
    fields: &IndexMap<String, FieldInfo>,
) -> Result<ComputedSet, AppError> {
    let wanted: Vec<&String> = fields
        .iter()
        .filter(|(id, f)| !f.stored && matches!(f.kind.as_str(), "lookup" | "rollup" | "count" | "formula") && decision.readable_fields.contains(*id))
        .map(|(id, _)| id)
        .collect();
    let mut set = ComputedSet { names: fields.iter().map(|(id, f)| (id.clone(), (f.name.clone(), f.kind.clone()))).collect(), ..Default::default() };
    if wanted.is_empty() {
        return Ok(set);
    }
    let ids = P::of(&json!(wanted));
    let rollups = exec
        .rows(
            "SELECT rc.field_id, rc.kind, rc.direction, rc.via_field_id, vn.name AS via_column,
            vf.kind AS via_kind, vf.table_id AS via_table_id,
            lc.target_table_id AS link_target_table_id,
            (vf.is_live AND lc.fk_dropped_at IS NULL) AS via_live,
            rc.target_field_id, tn.name AS target_column, tf.is_live AS target_live,
            rc.aggregate, rc.result_kind, rc.is_multiple
       FROM _basedb.field_rollup_config rc
       JOIN _basedb.field vf             ON vf.id = rc.via_field_id
       JOIN _basedb.physical_name vn     ON vn.id = vf.name_id
       JOIN _basedb.field_link_config lc ON lc.field_id = vf.id
       LEFT JOIN _basedb.field tf        ON tf.id = rc.target_field_id
       LEFT JOIN _basedb.physical_name tn ON tn.id = tf.name_id
      WHERE rc.field_id = ANY($1::uuid[])",
            &[&ids],
        )
        .await?;
    let formulas = exec
        .rows(
            "SELECT field_id, ast, timezone FROM _basedb.field_formula_config
      WHERE field_id = ANY($1::uuid[]) AND NOT is_stored",
            &[&ids],
        )
        .await?;

    let mut cache = HashMap::new();
    let mut counter = 0;
    for row in &rollups {
        let Some(field_id) = s(row, "field_id") else { continue };
        let Some(field) = fields.get(&field_id) else { continue };
        if b(row, "via_live") != Some(true) {
            continue;
        }
        let target_field_id = s(row, "target_field_id");
        if target_field_id.is_some() && b(row, "target_live") != Some(true) {
            continue;
        }
        let direction = s(row, "direction").unwrap_or_default();
        let outgoing = direction == "outgoing";
        let reached_id = if outgoing { s(row, "link_target_table_id") } else { s(row, "via_table_id") }.unwrap_or_default();
        let Some(other) = reach(exec, ctx, grants, &mut cache, &reached_id).await? else { continue };
        let via_field_id = s(row, "via_field_id").unwrap_or_default();
        if outgoing && !decision.readable_fields.contains(&via_field_id) {
            continue;
        }
        if !outgoing && !other.decision.readable_fields.contains(&via_field_id) {
            continue;
        }
        if let Some(t) = &target_field_id {
            if !other.decision.readable_fields.contains(t) {
                continue;
            }
        }
        counter += 1;
        let x = qi(&format!("x{counter}"))?;
        let u = qi(&format!("u{counter}"))?;
        let via = qi(&s(row, "via_column").unwrap_or_default())?;
        let predicate = format!(
            "( /*predicat_lignes:{}*/ {} )",
            other.table_name,
            row_where(&other.decision.row_predicate, Some(&format!("x{counter}")))
        );
        let value = match s(row, "target_column") {
            Some(c) => Some(format!("{x}.{}", qi(&c)?)),
            None => None,
        };
        let via_kind = s(row, "via_kind").unwrap_or_default();
        let kind = s(row, "kind").unwrap_or_default();
        let is_multiple = b(row, "is_multiple") == Some(true);
        let result_kind = s(row, "result_kind").unwrap_or_default();
        let list = kind == "lookup" && is_multiple;
        set.by_id.insert(
            field_id.clone(),
            Computed {
                id: field_id,
                name: field.name.clone(),
                kind: if list { "lookup".into() } else { result_kind.clone() },
                element_kind: list.then_some(result_kind),
                expr: Expr::Rollup {
                    kind,
                    outgoing_multi: outgoing && via_kind == "multi_link",
                    reached_by: if outgoing {
                        ReachedBy::Outgoing
                    } else if via_kind == "multi_link" {
                        ReachedBy::IncomingMulti
                    } else {
                        ReachedBy::Incoming
                    },
                    via,
                    x,
                    u,
                    relation: other.relation.clone(),
                    predicate,
                    value,
                    aggregate: s(row, "aggregate"),
                    is_multiple,
                },
            },
        );
    }

    for row in &formulas {
        let Some(field_id) = s(row, "field_id") else { continue };
        let Some(field) = fields.get(&field_id) else { continue };
        let ast_json = row.try_get::<_, crate::pg::Js>("ast").map(|j| j.0).unwrap_or(Value::Null);
        let Some(ast) = Node::from_json(&ast_json) else { continue };
        let readable = cited_ids(&ast).iter().all(|id| {
            decision.readable_fields.contains(id) && (fields.get(id).is_none_or(|f| f.stored) || set.by_id.contains_key(id)) && fields.contains_key(id)
        });
        if !readable {
            continue;
        }
        let config = exec.first("SELECT result_kind FROM _basedb.field_formula_config WHERE field_id = $1", &[&P::text(&field_id)]).await?;
        let kind = config.and_then(|r| r.try_get::<_, String>(0).ok()).unwrap_or_else(|| "short_text".into());
        let timezone = s(row, "timezone").unwrap_or_else(|| "Europe/Paris".into());
        set.by_id.insert(field_id.clone(), Computed { id: field_id, name: field.name.clone(), kind, element_kind: None, expr: Expr::Formula { ast, timezone } });
    }

    set.columns = wanted.iter().filter_map(|id| set.by_id.get(*id).cloned()).collect();
    Ok(set)
}

impl ComputedSet {
    pub fn is_empty(&self) -> bool {
        self.columns.is_empty()
    }

    /// The expression of a computed field, given the alias of the table being read.
    pub fn expression(&self, c: &Computed, outer: &str) -> Result<String, AppError> {
        let o = qi(outer)?;
        match &c.expr {
            Expr::Rollup { kind, outgoing_multi, reached_by, via, x, u, relation, predicate, value, aggregate, is_multiple } => {
                let (from, order) = if *outgoing_multi {
                    (
                        format!(
                            "FROM unnest({o}.{via}) WITH ORDINALITY AS {u}(\"_u_id\", \"_u_ord\")\n                  JOIN {relation} AS {x} ON {x}.\"_id\" = {u}.\"_u_id\"\n                 WHERE {predicate}"
                        ),
                        format!("{u}.\"_u_ord\""),
                    )
                } else {
                    let reached = match reached_by {
                        ReachedBy::Outgoing => format!("{x}.\"_id\" = {o}.{via}"),
                        ReachedBy::IncomingMulti => format!("{x}.{via} @> ARRAY[{o}.\"_id\"]"),
                        ReachedBy::Incoming => format!("{x}.{via} = {o}.\"_id\""),
                    };
                    (format!("FROM {relation} AS {x} WHERE {reached} AND {predicate}"), format!("{x}.\"_id\""))
                };
                let value = value.clone().unwrap_or_else(|| "null".into());
                Ok(match kind.as_str() {
                    "count" => format!("(SELECT count(*)::numeric {from})"),
                    "rollup" => {
                        let f = aggregate.clone().unwrap_or_else(|| "count".into());
                        let agg = if f == "count" { format!("count({value})::numeric") } else { format!("{f}({value})") };
                        format!("(SELECT {agg} {from})")
                    }
                    _ => {
                        if *is_multiple {
                            format!("(SELECT array_agg({value} ORDER BY {order}) {from} AND {value} IS NOT NULL)")
                        } else {
                            format!("(SELECT {value} {from} LIMIT 1)")
                        }
                    }
                })
            }
            Expr::Formula { ast, timezone } => {
                let failure: std::cell::RefCell<Option<AppError>> = std::cell::RefCell::new(None);
                let field = |id: &str| -> String {
                    if let Some(computed) = self.by_id.get(id) {
                        return match self.expression(computed, outer) {
                            Ok(e) => e,
                            Err(e) => {
                                *failure.borrow_mut() = Some(e);
                                String::new()
                            }
                        };
                    }
                    let name = self.names.get(id).map(|n| n.0.clone()).unwrap_or_default();
                    match qi(&name) {
                        Ok(q) => format!("{o}.{q}"),
                        Err(e) => {
                            *failure.borrow_mut() = Some(e);
                            String::new()
                        }
                    }
                };
                let type_of = |id: &str| -> FormulaType {
                    let kind = match self.by_id.get(id) {
                        Some(c) => c.element_kind.clone().unwrap_or_else(|| c.kind.clone()),
                        None => self.names.get(id).map(|n| n.1.clone()).unwrap_or_default(),
                    };
                    type_of_kind(&kind)
                };
                let sql = emit_formula(ast, &EmitContext { field: &field, type_of: &type_of, timezone })?;
                if let Some(e) = failure.into_inner() {
                    return Err(e);
                }
                Ok(sql)
            }
        }
    }

    pub fn by_name(&self, name: &str) -> Option<&Computed> {
        self.columns.iter().find(|c| c.name == name)
    }

    /// `lateralJoin`.
    pub fn lateral_join(&self, outer: &str) -> Result<String, AppError> {
        if self.columns.is_empty() {
            return Ok(String::new());
        }
        let items = self.columns.iter().map(|c| Ok(format!("{} AS {}", self.expression(c, outer)?, qi(&c.name)?))).collect::<Result<Vec<_>, AppError>>()?;
        Ok(format!("\n  CROSS JOIN LATERAL (SELECT {}) AS {}", items.join(",\n    "), qi(COMPUTED_ALIAS)?))
    }
}
