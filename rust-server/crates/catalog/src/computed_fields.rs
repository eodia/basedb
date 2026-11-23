//! Formulas, lookups, rollups and counts (`catalog/computed-fields.ts`): a formula is a
//! generated column when it can be one, else a tree; the others have no column at all.

use crate::allocation::{allocate_name, AllocationRequest, Candidate, ObjectKind, ScopeKind};
use crate::description::comment_text;
use crate::formula::{emit_formula, kind_of_type, parse_formula, resolve_formula, EmitContext, FormulaField, FormulaType, Node};
use crate::http::label_key;
use crate::js::js_numbers;
use crate::naming::{qualify, quote_identifier};
use crate::operations::sql_comment_on_column;
use crate::sql_views::{detach_sql_views, reattach_sql_views};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_table;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use serde_json::json;
use std::collections::HashMap;

type R<T> = Result<T, AppError>;

/// `FormulaInput`: an expression, and the zone `AUJOURDHUI()` reads.
#[derive(Debug, Clone, PartialEq)]
pub struct FormulaInput {
    pub expression: String,
    pub timezone: Option<String>,
}

/// `RollupInput`: the relation followed and what is read, by physical names.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct RollupInput {
    pub via: String,
    pub via_table: Option<String>,
    pub target: Option<String>,
    pub aggregate: Option<String>,
}

/// `TableRef` (and `Location` of `fields.ts`): a live table and where it lives.
#[derive(Debug, Clone, PartialEq)]
pub struct TableRef {
    pub table_id: String,
    pub base_id: String,
    pub table_name: String,
    pub schema_name: String,
}

/// `tableRef` / `locate`: `RESOURCE_NOT_FOUND {table}` when the table is not live.
pub async fn table_ref<E: Exec + Sync>(exec: &E, table_id: &str) -> R<TableRef> {
    let row = exec
        .first(
            "SELECT t.id::text, t.base_id::text, tn.name, sn.name
               FROM _basedb.table_def t
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               JOIN _basedb.db_schema s      ON s.id = t.schema_id
               JOIN _basedb.physical_name sn ON sn.id = s.name_id
              WHERE t.id = $1::text::uuid AND t.is_live",
            &[&table_id],
        )
        .await?;
    let Some(r) = row else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
    };
    Ok(TableRef { table_id: r.get(0), base_id: r.get(1), table_name: r.get(2), schema_name: r.get(3) })
}

/// `formulaFields`: the fields of a table a formula may name.
async fn formula_fields<E: Exec + Sync>(exec: &E, table_id: &str) -> R<Vec<FormulaField>> {
    let rows = exec
        .rows(
            "SELECT f.id::text, f.label, n.name, f.kind,
                    CASE WHEN f.kind IN ('lookup', 'rollup', 'count', 'button') THEN false
                         WHEN f.kind = 'formula' THEN coalesce(fc.is_stored, true)
                         ELSE true END AS stored,
                    coalesce(rc.result_kind, fc.result_kind) AS result_kind,
                    coalesce(rc.is_multiple, false) AS multiple
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
               LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
               LEFT JOIN _basedb.field_rollup_config rc  ON rc.field_id = f.id
              WHERE f.table_id = $1::text::uuid AND f.is_live",
            &[&table_id],
        )
        .await?;
    Ok(rows
        .iter()
        .map(|r| FormulaField { id: r.get(0), label: r.get(1), name: r.get(2), kind: r.get(3), stored: r.get(4), result_kind: r.get(5), multiple: r.get(6) })
        .collect())
}

/// `PG_TYPE`.
fn pg_type(t: FormulaType) -> &'static str {
    match t {
        FormulaType::Number => "numeric",
        FormulaType::Text | FormulaType::Null => "text",
        FormulaType::Boolean => "boolean",
        FormulaType::Date => "date",
        FormulaType::Datetime => "timestamptz",
    }
}

/// `typeOfField`.
fn type_of_field(field: Option<&FormulaField>) -> FormulaType {
    let kind = match field {
        Some(f) if !f.stored => f.result_kind.as_deref().unwrap_or(""),
        Some(f) => f.kind.as_str(),
        None => "",
    };
    match kind {
        "number" | "autonumber" => FormulaType::Number,
        "boolean" => FormulaType::Boolean,
        "date" => FormulaType::Date,
        "datetime" => FormulaType::Datetime,
        _ => FormulaType::Text,
    }
}

/// A formula compiled against the table's fields of the day.
pub struct Compiled {
    pub ast: Node,
    pub r#type: FormulaType,
    pub dependencies: Vec<String>,
    pub stored: bool,
    pub timezone: Option<String>,
    pub generated: String,
}

impl Compiled {
    /// `JSON.stringify(compiled.ast)`.
    fn ast_json(&self) -> String {
        js_numbers(self.ast.to_json()).to_string()
    }
}

/// `compile`.
async fn compile<E: Exec + Sync>(exec: &E, table_id: &str, input: &FormulaInput, self_id: Option<&str>) -> R<Compiled> {
    let fields: Vec<FormulaField> = formula_fields(exec, table_id).await?.into_iter().filter(|f| Some(f.id.as_str()) != self_id).collect();
    let mut by_key: HashMap<String, FormulaField> = HashMap::new();
    let mut by_id: HashMap<String, FormulaField> = HashMap::new();
    for f in &fields {
        by_key.insert(label_key(&f.label), f.clone());
        by_id.insert(f.id.clone(), f.clone());
    }
    let resolved = resolve_formula(&parse_formula(&input.expression)?, &by_key, &|l: &str| label_key(l))?;

    for p in &resolved.patterns {
        if let Err(e) = exec.rows("SELECT (''::text COLLATE \"und-x-icu\") ~ $1::text AS ok", &[&p.pattern]).await {
            if e.sqlstate.as_deref() == Some("2201B") {
                let mut refusal = AppError::new("FORMULA_SYNTAX").with("position", json!(p.position)).with("detail", json!(format!("motif_invalide:{}", p.fun)));
                if let Some(reason) = &e.cause {
                    refusal = refusal.with("reason", json!(reason));
                }
                return Err(refusal);
            }
            return Err(e);
        }
    }

    let timezone = resolved.uses_timezone.then(|| input.timezone.clone().unwrap_or_else(|| "Europe/Paris".to_string()));
    if let Some(tz) = &timezone {
        let known = exec.first("SELECT true AS ok FROM pg_timezone_names WHERE name = $1 LIMIT 1", &[tz]).await?;
        if known.is_none() {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("timezone")).with("reason", json!("fuseau_inconnu")).with("timezone", json!(tz)));
        }
    }

    let generated = if resolved.stored {
        let field = |id: &str| quote_identifier(by_id.get(id).map(|f| f.name.as_str()).unwrap_or("")).unwrap_or_else(|_| "\"\"".to_string());
        let type_of = |id: &str| type_of_field(by_id.get(id));
        emit_formula(&resolved.ast, &EmitContext { field: &field, type_of: &type_of, timezone: timezone.as_deref().unwrap_or("Europe/Paris") })?
    } else {
        String::new()
    };
    Ok(Compiled { ast: resolved.ast, r#type: resolved.r#type, dependencies: resolved.dependencies, stored: resolved.stored, timezone, generated })
}

/// `addGeneratedColumn`: a constant with no collation is the formula's fault.
async fn add_generated_column<E: Exec + Sync>(exec: &E, sql: &str) -> R<()> {
    match exec.execute_op(sql, &[], SqlOp::Ddl).await {
        Ok(_) => Ok(()),
        Err(e) if e.sqlstate.as_deref() == Some("42P22") => {
            let mut refusal = AppError::new("FORMULA_SYNTAX").with("position", json!(0)).with("detail", json!("texte_ecrit_seul"));
            refusal.cause = e.cause;
            Err(refusal)
        }
        Err(e) => Err(e),
    }
}

async fn write_dependencies<E: Exec + Sync>(exec: &E, field_id: &str, table_id: &str, dependencies: &[String]) -> R<()> {
    exec.execute_op("DELETE FROM _basedb.field_formula_dependency WHERE formula_field_id = $1::text::uuid", &[&field_id], SqlOp::Delete).await?;
    for id in dependencies {
        exec.execute_op(
            "INSERT INTO _basedb.field_formula_dependency (formula_field_id, depends_on_field_id, table_id)
             VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid)",
            &[&field_id, id, &table_id],
            SqlOp::Insert,
        )
        .await?;
    }
    Ok(())
}

fn generated_column(relation: &str, column: &str, compiled: &Compiled) -> String {
    format!("ALTER TABLE {relation} ADD COLUMN {column} {}\n  GENERATED ALWAYS AS ({}) STORED;", pg_type(compiled.r#type), compiled.generated)
}

/// `addFormulaField`: the configuration, the dependencies, and the column when stored.
pub async fn add_formula_field<E: Exec + Sync>(exec: &E, where_: &TableRef, field_id: &str, name: &str, label: &str, description: Option<&str>, input: &FormulaInput) -> R<Vec<String>> {
    let compiled = compile(exec, &where_.table_id, input, Some(field_id)).await?;
    exec.execute_op(
        "INSERT INTO _basedb.field_formula_config
           (field_id, input_expression, ast, result_kind, is_stored, timezone)
         VALUES ($1::text::uuid, $2, $3::text::jsonb, $4, $5, $6)",
        &[&field_id, &input.expression, &compiled.ast_json(), &kind_of_type(compiled.r#type), &compiled.stored, &compiled.timezone],
        SqlOp::Insert,
    )
    .await?;
    write_dependencies(exec, field_id, &where_.table_id, &compiled.dependencies).await?;
    if !compiled.stored {
        return Ok(Vec::new());
    }
    let relation = qualify(&where_.schema_name, &where_.table_name)?;
    let add = generated_column(&relation, &quote_identifier(name)?, &compiled);
    add_generated_column(exec, &add).await?;
    let comment = sql_comment_on_column(&where_.schema_name, &where_.table_name, name, comment_text(label, description))?;
    exec.execute_op(&comment, &[], SqlOp::Ddl).await?;
    Ok(vec![add, comment])
}

/// `setFormula`: a formula's expression replaced; `(stored, sql)`.
pub async fn set_formula(pools: &Pools, ctx: &RequestContext, table_id: &str, field_name: &str, input: &FormulaInput) -> R<(bool, Vec<String>)> {
    with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let where_ = table_ref(&tx, table_id).await?;
        let row = tx
            .first(
                "SELECT f.id::text, f.label, f.description, fc.is_stored
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n ON n.id = f.name_id
                   JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
                  WHERE f.table_id = $1::text::uuid AND n.name = $2 AND f.is_live AND f.kind = 'formula'",
                &[&table_id, &field_name],
            )
            .await?;
        let Some(row) = row else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_name)));
        };
        let (field_id, label, description, was_stored): (String, String, Option<String>, Option<bool>) = (row.get(0), row.get(1), row.get(2), row.get(3));
        let was_stored = was_stored.unwrap_or(false);
        let compiled = compile(&tx, &where_.table_id, input, Some(&field_id)).await?;
        let relation = qualify(&where_.schema_name, &where_.table_name)?;
        let column = quote_identifier(field_name)?;
        let mut sql = Vec::new();
        let detached = if was_stored { detach_sql_views(&tx, &where_.schema_name, &where_.table_name, Some(field_name)).await? } else { Vec::new() };
        if was_stored {
            let drop = format!("ALTER TABLE {relation} DROP COLUMN {column};");
            tx.execute_op(&drop, &[], SqlOp::Ddl).await?;
            sql.push(drop);
        }
        if compiled.stored {
            let add = generated_column(&relation, &column, &compiled);
            add_generated_column(&tx, &add).await?;
            sql.push(add);
            let comment = sql_comment_on_column(&where_.schema_name, &where_.table_name, field_name, comment_text(&label, description.as_deref()))?;
            tx.execute_op(&comment, &[], SqlOp::Ddl).await?;
            sql.push(comment);
        }
        tx.execute_op(
            "UPDATE _basedb.field_formula_config
                SET input_expression = $2, ast = $3::text::jsonb, result_kind = $4, is_stored = $5, timezone = $6
              WHERE field_id = $1::text::uuid",
            &[&field_id, &input.expression, &compiled.ast_json(), &kind_of_type(compiled.r#type), &compiled.stored, &compiled.timezone],
            SqlOp::Update,
        )
        .await?;
        write_dependencies(&tx, &field_id, &where_.table_id, &compiled.dependencies).await?;
        tx.execute_op(
            "UPDATE _basedb.field SET updated_at = pg_catalog.clock_timestamp(), updated_by = $2::text::uuid WHERE id = $1::text::uuid",
            &[&field_id, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        reattach_sql_views(&tx, &detached, &format!("La formule « {label} » qu\u{2019}elle lit a changé de nature.")).await?;
        Ok((compiled.stored, sql))
    })
    .await
}

/// `LOOKABLE`: one value per row, stored.
const LOOKABLE: [&str; 12] = ["short_text", "long_text", "number", "boolean", "date", "datetime", "select", "url", "email", "user", "autonumber", "formula"];

fn refuse(reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!("rollup")).with("reason", json!(reason))
}

/// `addRollupField`: the path checked, the result typed, a catalog row. No column.
pub async fn add_rollup_field<E: Exec + Sync>(exec: &E, ctx: &RequestContext, where_: &TableRef, field_id: &str, kind: &str, input: &RollupInput) -> R<()> {
    let incoming = input.via_table.as_deref().is_some_and(|t| !t.is_empty());
    let table_name = if incoming { input.via_table.as_deref().unwrap_or_default() } else { where_.table_name.as_str() };
    let via = exec
        .first(
            "SELECT f.id::text, f.kind, f.table_id::text, lc.target_table_id::text
               FROM _basedb.field f
               JOIN _basedb.physical_name n      ON n.id = f.name_id
               JOIN _basedb.field_link_config lc ON lc.field_id = f.id
               JOIN _basedb.table_def t          ON t.id = f.table_id
               JOIN _basedb.physical_name tn     ON tn.id = t.name_id
              WHERE n.name = $1 AND f.is_live AND lc.fk_dropped_at IS NULL AND t.is_live
                AND t.base_id = $2::text::uuid AND tn.name = $3",
            &[&input.via, &where_.base_id, &table_name],
        )
        .await?;
    let Some(via) = via else {
        return Err(refuse("relation_inconnue").with("via", json!(input.via)));
    };
    let (via_id, via_kind, via_table_id, via_target_id): (String, String, String, String) = (via.get(0), via.get(1), via.get(2), via.get(3));
    if incoming && via_target_id != where_.table_id {
        return Err(refuse("relation_ne_designe_pas_la_table").with("via", json!(input.via)));
    }
    let reached = if incoming { &via_table_id } else { &via_target_id };
    require_on_table(exec, ctx, Action::Read, reached).await?;

    let mut result_kind = "number".to_string();
    let mut target_id: Option<String> = None;
    if kind != "count" {
        let target = match input.target.as_deref() {
            None | Some("") => return Err(refuse("champ_cible_manquant")),
            Some(t) => t,
        };
        let row = exec
            .first(
                "SELECT f.id::text, f.kind, fc.result_kind, coalesce(fc.is_stored, true) AS stored
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n ON n.id = f.name_id
                   LEFT JOIN _basedb.field_formula_config fc ON fc.field_id = f.id
                  WHERE f.table_id = $1::text::uuid AND n.name = $2 AND f.is_live",
                &[reached, &target],
            )
            .await?;
        let Some(row) = row else {
            return Err(refuse("champ_cible_inconnu").with("target", json!(target)));
        };
        let (id, target_kind, formula_kind, stored): (String, String, Option<String>, bool) = (row.get(0), row.get(1), row.get(2), row.get(3));
        if !LOOKABLE.contains(&target_kind.as_str()) || !stored {
            return Err(refuse("type_de_champ_incompatible").with("target", json!(target)).with("kind", json!(target_kind)));
        }
        target_id = Some(id);
        let value_kind = match target_kind.as_str() {
            "formula" => formula_kind.unwrap_or_else(|| "short_text".to_string()),
            "autonumber" => "number".to_string(),
            other => other.to_string(),
        };
        if kind == "lookup" {
            result_kind = value_kind;
        } else {
            let Some(aggregate) = input.aggregate.as_deref() else {
                return Err(refuse("agregat_manquant"));
            };
            let incompatible = match aggregate {
                "sum" | "avg" => value_kind != "number",
                "min" | "max" => !["number", "date", "datetime"].contains(&value_kind.as_str()),
                _ => false,
            };
            if incompatible {
                return Err(refuse("agregat_incompatible").with("aggregate", json!(aggregate)).with("kind", json!(value_kind)));
            }
            result_kind = if aggregate == "min" || aggregate == "max" { value_kind } else { "number".to_string() };
        }
    }
    let multiple = kind == "lookup" && !(via_kind == "link" && !incoming);
    let aggregate = if kind == "rollup" { input.aggregate.clone() } else { None };
    exec.execute_op(
        "INSERT INTO _basedb.field_rollup_config
           (field_id, kind, via_field_id, direction, target_field_id, aggregate, result_kind, is_multiple)
         VALUES ($1::text::uuid, $2, $3::text::uuid, $4, $5::text::uuid, $6, $7, $8)",
        &[&field_id, &kind, &via_id, &if incoming { "incoming" } else { "outgoing" }, &target_id, &aggregate, &result_kind, &multiple],
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}

/// `insertComputedField`'s request.
pub struct ComputedFieldRow<'a> {
    pub label: &'a str,
    pub kind: &'a str,
    pub technical_name: Option<&'a str>,
    pub description: Option<&'a str>,
    pub lineage_id: Option<&'a str>,
}

/// `insertComputedField`: a physical name and a field row, never a column; `(id, name)`.
pub async fn insert_computed_field<E: Exec + Sync>(exec: &E, ctx: &RequestContext, where_: &TableRef, request: &ComputedFieldRow<'_>) -> R<(String, String)> {
    let candidate = match request.technical_name {
        Some(t) => Candidate::Technical(t.to_string()),
        None => Candidate::Label(request.label.to_string()),
    };
    let column = allocate_name(exec, ctx, &AllocationRequest::new(candidate, ObjectKind::Field, ScopeKind::Table, where_.table_id.clone())).await?;
    let id = insert_field_row(exec, ctx, where_, request.kind, &column.name_id, request.label, request.description, false, request.lineage_id).await?;
    Ok((id, column.name))
}

/// The `INSERT INTO _basedb.field` every creation writes; the new field's id.
#[allow(clippy::too_many_arguments)]
pub async fn insert_field_row<E: Exec + Sync>(
    exec: &E,
    ctx: &RequestContext,
    where_: &TableRef,
    kind: &str,
    name_id: &str,
    label: &str,
    description: Option<&str>,
    required: bool,
    lineage_id: Option<&str>,
) -> R<String> {
    let position = exec.first("SELECT COALESCE(MAX(position), 0) + 1 AS n FROM _basedb.field WHERE table_id = $1::text::uuid", &[&where_.table_id]).await?;
    let position: i32 = position.map(|r| r.get(0)).unwrap_or(1);
    let rows = exec
        .query_op(
            "INSERT INTO _basedb.field
               (table_id, base_id, kind, name_id, label, label_key, description, is_required,
                position, created_by, updated_by, lineage_id)
             VALUES ($1::text::uuid, $2::text::uuid, $3, $4::text::uuid, $5, $6, $7, $8, $9, $10::text::uuid, $10::text::uuid,
                     coalesce($11::text::uuid, _basedb_local.uuid_generate_v7())) RETURNING id::text",
            &[&where_.table_id, &where_.base_id, &kind, &name_id, &label, &label_key(label), &description, &required, &position, &ctx.actor.id, &lineage_id],
            SqlOp::Insert,
        )
        .await?;
    rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("field not created"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field(kind: &str, stored: bool, result: Option<&str>) -> FormulaField {
        FormulaField { id: "x".into(), label: "X".into(), name: "x".into(), kind: kind.into(), stored, result_kind: result.map(str::to_string), multiple: false }
    }

    #[test]
    fn fields_type_as_node_s() {
        assert_eq!(type_of_field(Some(&field("autonumber", true, None))), FormulaType::Number);
        assert_eq!(type_of_field(Some(&field("lookup", false, Some("date")))), FormulaType::Date);
        assert_eq!(type_of_field(Some(&field("lookup", false, None))), FormulaType::Text);
        assert_eq!(type_of_field(None), FormulaType::Text);
        assert_eq!(pg_type(FormulaType::Null), "text");
    }
}
