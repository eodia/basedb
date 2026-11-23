//! A field added to a live table, and its later settings (`catalog/fields.ts`, `links.ts`,
//! `field-unique.ts`): the column, its catalog row, its satellite and its constraints.

use crate::allocation::{allocate_name, AllocationRequest, Candidate, ObjectKind, ScopeKind};
use crate::computed_fields::{add_formula_field, add_rollup_field, insert_computed_field, insert_field_row, table_ref, ComputedFieldRow, FormulaInput, RollupInput, TableRef};
use crate::description::{comment_text, js_trim, normalize_description};
use crate::field_config::{normalize_format, write_format, FieldFormat};
use crate::js::js_length;
use crate::naming::{
    check_constraint_name, foreign_key_name, index_name, link_column_name, link_column_name_from_label, multi_link_column_name, multi_link_column_name_from_label,
    multi_link_target_trigger_name, multi_link_trigger_name, qualify, quote_identifier, quote_literal, slugify, unique_constraint_name, SlugNature,
};
use crate::operations::{add_pattern_check, nullability_of, pg_type_of, sql_comment_on_column};
use crate::select_options::{add_select_options, insert_constraint, insert_member, is_choice_kind};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::{require_on_field, require_on_table};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use regex::Regex;
use serde_json::{json, Value};
use std::sync::LazyLock;

type R<T> = Result<T, AppError>;

fn invalid(field: &str, reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!(reason))
}

async fn ddl<E: Exec + Sync>(exec: &E, sql: &str) -> R<()> {
    exec.execute_op(sql, &[], SqlOp::Ddl).await.map(|_| ())
}

// ── addField ──────────────────────────────────────────────────────────────────────

/// `AddFieldRequest`.
#[derive(Debug, Clone, Default)]
pub struct AddFieldRequest {
    pub table_id: String,
    pub label: String,
    pub kind: String,
    /// Raw, as the caller gave it: `normalizeDescription` judges it.
    pub description: Option<Value>,
    pub options: Option<Vec<Value>>,
    pub format: Option<Value>,
    pub formula: Option<FormulaInput>,
    pub rollup: Option<RollupInput>,
    pub button: Option<Value>,
    pub rich: bool,
    pub technical_name: Option<String>,
    pub lineage_id: Option<String>,
    /// The AI option, normalized (`ai_hooks::AiHooks::input_of`); the `ai` crate writes it.
    pub ai: Option<Value>,
}

/// `AddedField`.
#[derive(Debug, Clone)]
pub struct AddedField {
    pub field_id: String,
    pub name: String,
    pub label: String,
    pub description: Option<String>,
    pub kind: String,
    pub sql: Vec<String>,
}

/// `insertSatellite`: the configuration row `ck_field_config_present` demands.
async fn insert_satellite<E: Exec + Sync>(exec: &E, field_id: &str, kind: &str) -> R<()> {
    let (sql, with_kind) = match kind {
        "short_text" | "long_text" => ("INSERT INTO _basedb.field_text_config (field_id, kind) VALUES ($1::text::uuid, $2)", true),
        "number" => ("INSERT INTO _basedb.field_number_config (field_id) VALUES ($1::text::uuid)", false),
        "boolean" => ("INSERT INTO _basedb.field_boolean_config (field_id) VALUES ($1::text::uuid)", false),
        "date" | "datetime" => ("INSERT INTO _basedb.field_datetime_config (field_id, kind) VALUES ($1::text::uuid, $2)", true),
        "formula" => ("INSERT INTO _basedb.field_formula_config (field_id) VALUES ($1::text::uuid)", false),
        _ => return Ok(()),
    };
    if with_kind {
        exec.execute_op(sql, &[&field_id, &kind], SqlOp::Insert).await?;
    } else {
        exec.execute_op(sql, &[&field_id], SqlOp::Insert).await?;
    }
    Ok(())
}

/// `fileShapeCheck`.
pub fn file_shape_check(column: &str) -> String {
    format!("{column} IS NULL OR CASE WHEN jsonb_typeof({column}) = 'array' THEN jsonb_array_length({column}) BETWEEN 1 AND 20 ELSE false END")
}

/// `addFileShape`.
async fn add_file_shape<E: Exec + Sync>(exec: &E, ctx: &RequestContext, where_: &TableRef, field_id: &str, kind: &str, column: &str) -> R<Vec<String>> {
    let name = allocate_name(
        exec,
        ctx,
        &AllocationRequest::new(Candidate::Derived(check_constraint_name(&where_.table_name, column, "files")), ObjectKind::Constraint, ScopeKind::Table, where_.table_id.clone()),
    )
    .await?;
    let constraint_id = insert_constraint(exec, ctx, &where_.table_id, &where_.base_id, &name.name_id, "files", "active").await?;
    insert_member(exec, &constraint_id, field_id, &where_.table_id).await?;
    exec.execute_op(
        "INSERT INTO _basedb.field_file_config (field_id, kind, shape_constraint_id) VALUES ($1::text::uuid, $2, $3::text::uuid)",
        &[&field_id, &kind, &constraint_id],
        SqlOp::Insert,
    )
    .await?;
    let statement = format!(
        "ALTER TABLE {} ADD CONSTRAINT {} CHECK ({});",
        qualify(&where_.schema_name, &where_.table_name)?,
        quote_identifier(&name.name)?,
        file_shape_check(&quote_identifier(column)?)
    );
    ddl(exec, &statement).await?;
    Ok(vec![statement])
}

/// `addField`: a column, ALWAYS nullable, its catalog row and its satellite, in one
/// transaction. An AI option is written by the `ai` crate (`ai_hooks`), in the same one.
pub async fn add_field(pools: &Pools, ctx: &RequestContext, request: &AddFieldRequest) -> R<AddedField> {
    if js_trim(&request.label).is_empty() {
        return Err(AppError::new("LABEL_EMPTY"));
    }
    let description = normalize_description(request.description.as_ref(), "description")?;
    let kind = request.kind.as_str();
    if kind == "link" || kind == "multi_link" {
        return Err(invalid("kind", "utiliser createLinkField"));
    }
    if kind == "button" {
        return add_button(pools, ctx, request, description).await;
    }
    if matches!(kind, "formula" | "lookup" | "rollup" | "count") {
        return add_computed(pools, ctx, request, description).await;
    }
    if request.rich && kind != "long_text" {
        return Err(invalid("rich", "texte_long_seul"));
    }
    if request.rich && request.ai.is_some() {
        return Err(invalid("ai", "type_sans_ia").with("kind", json!("rich_text")));
    }
    if is_choice_kind(kind) && request.options.as_ref().is_none_or(|o| o.is_empty()) {
        return Err(invalid("options", "liste_vide"));
    }
    let format: Option<FieldFormat> = match &request.format {
        Some(f) => Some(normalize_format(kind, f)?),
        None => None,
    };
    let hooks = match &request.ai {
        None => None,
        Some(ai) => {
            let hooks = crate::ai_hooks::required()?;
            if !(hooks.is_ai_kind)(kind) {
                return Err(invalid("ai", "type_sans_ia").with("kind", json!(kind)));
            }
            if ai.get("consent") != Some(&Value::Bool(true)) {
                return Err(AppError::new("AI_CONSENT_REQUIRED"));
            }
            Some((hooks, ai))
        }
    };
    let description_ref = description.as_deref();
    let format_ref = &format;
    let hooks_ref = &hooks;
    with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, &request.table_id).await?;
        let where_ = table_ref(&tx, &request.table_id).await?;
        let mut sql = Vec::new();
        let candidate = match &request.technical_name {
            Some(t) => Candidate::Technical(t.clone()),
            None => Candidate::Label(request.label.clone()),
        };
        let column = allocate_name(&tx, ctx, &AllocationRequest::new(candidate, ObjectKind::Field, ScopeKind::Table, where_.table_id.clone())).await?;
        let field_id = insert_field_row(&tx, ctx, &where_, kind, &column.name_id, &request.label, description_ref, false, request.lineage_id.as_deref()).await?;

        let add = format!(
            "ALTER TABLE {} ADD COLUMN {} {} {}",
            qualify(&where_.schema_name, &where_.table_name)?,
            quote_identifier(&column.name)?,
            pg_type_of(kind)?,
            nullability_of(kind, false)
        );
        let add = format!("{};", crate::js::js_trim_end(&add));
        ddl(&tx, &add).await?;
        sql.push(add);
        let comment = sql_comment_on_column(&where_.schema_name, &where_.table_name, &column.name, comment_text(&request.label, description_ref))?;
        ddl(&tx, &comment).await?;
        sql.push(comment);

        if is_choice_kind(kind) {
            let options = request.options.as_deref().unwrap_or_default();
            sql.extend(add_select_options(&tx, ctx, &where_.table_id, &where_.base_id, &where_.schema_name, &where_.table_name, &field_id, kind, &column.name, options).await?);
        } else if kind == "url" || kind == "email" {
            sql.extend(add_pattern_check(&tx, ctx, &where_.table_id, &where_.base_id, &where_.schema_name, &where_.table_name, &field_id, &column.name, kind).await?);
        } else if kind == "file" || kind == "image" {
            sql.extend(add_file_shape(&tx, ctx, &where_, &field_id, kind, &column.name).await?);
        } else if request.rich {
            tx.execute_op(
                "INSERT INTO _basedb.field_text_config (field_id, kind, is_rich, is_multiline, sanitizer_profile)
                 VALUES ($1::text::uuid, 'long_text', true, true, 'rich')",
                &[&field_id],
                SqlOp::Insert,
            )
            .await?;
            sql.extend(add_pattern_check(&tx, ctx, &where_.table_id, &where_.base_id, &where_.schema_name, &where_.table_name, &field_id, &column.name, "format").await?);
        } else {
            insert_satellite(&tx, &field_id, kind).await?;
            if let Some(f) = format_ref {
                write_format(&tx, &field_id, kind, f).await?;
            }
        }
        if let Some((hooks, ai)) = hooks_ref {
            // On top of the type's own satellite; the prompt is checked against the columns
            // as they are now, this one included.
            let target = crate::ai_hooks::AiFieldTarget { field_id: field_id.clone(), kind: kind.to_string(), table_id: where_.table_id.clone(), column: column.name.clone() };
            (hooks.insert)(tx.clone(), ctx.clone(), target, (*ai).clone()).await?;
        }
        Ok(AddedField { field_id, name: column.name, label: request.label.clone(), description: description_ref.map(str::to_string), kind: kind.to_string(), sql })
    })
    .await
}

/// `addComputed`: a formula, a lookup, a rollup or a count.
async fn add_computed(pools: &Pools, ctx: &RequestContext, request: &AddFieldRequest, description: Option<String>) -> R<AddedField> {
    let kind = request.kind.as_str();
    if kind == "formula" && request.formula.as_ref().is_none_or(|f| js_trim(&f.expression).is_empty()) {
        return Err(invalid("formula", "formule_sans_expression"));
    }
    if kind != "formula" && request.rollup.is_none() {
        return Err(invalid("rollup", "chemin_manquant"));
    }
    let description_ref = description.as_deref();
    with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, &request.table_id).await?;
        let where_ = table_ref(&tx, &request.table_id).await?;
        let (field_id, name) = insert_computed_field(
            &tx,
            ctx,
            &where_,
            &ComputedFieldRow { label: &request.label, kind, technical_name: request.technical_name.as_deref(), description: description_ref, lineage_id: request.lineage_id.as_deref() },
        )
        .await?;
        let sql = if kind == "formula" {
            let formula = request.formula.as_ref().ok_or_else(|| AppError::internal("formula"))?;
            add_formula_field(&tx, &where_, &field_id, &name, &request.label, description_ref, formula).await?
        } else {
            let rollup = request.rollup.as_ref().ok_or_else(|| AppError::internal("rollup"))?;
            add_rollup_field(&tx, ctx, &where_, &field_id, kind, rollup).await?;
            Vec::new()
        };
        Ok(AddedField { field_id, name, label: request.label.clone(), description: description_ref.map(str::to_string), kind: kind.to_string(), sql })
    })
    .await
}

static BUTTON_COLOR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^#[0-9a-f]{6}$").unwrap());
static BUTTON_URL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^(https?://|mailto:)").unwrap());

/// `addButton`: no column, a label, and what a click does.
async fn add_button(pools: &Pools, ctx: &RequestContext, request: &AddFieldRequest, description: Option<String>) -> R<AddedField> {
    let empty = json!({});
    let input = match &request.button {
        None | Some(Value::Null) => &empty,
        Some(v) => v,
    };
    let text = input.get("label").and_then(Value::as_str).map(js_trim).unwrap_or("").to_string();
    if text.is_empty() || js_length(&text) > 60 {
        return Err(invalid("button.label", "libelle_invalide"));
    }
    let color = input.get("color").and_then(Value::as_str).filter(|c| !c.is_empty()).map(str::to_lowercase);
    if color.as_deref().is_some_and(|c| !BUTTON_COLOR.is_match(c)) {
        return Err(invalid("button.color", "couleur_invalide"));
    }
    let action = match input.get("action").and_then(Value::as_str) {
        Some(a @ ("url" | "automation")) => a.to_string(),
        _ => return Err(invalid("button.action", "action_inconnue")),
    };
    let url = if action == "url" { input.get("url").and_then(Value::as_str).map(|u| js_trim(u).to_string()) } else { None };
    if action == "url" && url.as_deref().is_none_or(|u| js_length(u) > 2048 || !BUTTON_URL.is_match(u)) {
        return Err(invalid("button.url", "adresse_invalide"));
    }
    let automation = if action == "automation" { input.get("automation").and_then(Value::as_str).map(str::to_string) } else { None };
    let (text_ref, color_ref, action_ref, url_ref, automation_ref, description_ref) = (&text, &color, &action, &url, &automation, description.as_deref());
    with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, &request.table_id).await?;
        let where_ = table_ref(&tx, &request.table_id).await?;
        if action_ref == "automation" {
            let found = tx
                .first(
                    "SELECT id::text FROM _basedb.automation
                      WHERE id::text = $1 AND table_id = $2::text::uuid AND trigger_kind = 'button' AND deleted_at IS NULL",
                    &[&automation_ref.as_deref().unwrap_or(""), &request.table_id],
                )
                .await?;
            if found.is_none() {
                return Err(invalid("button.automation", "automatisation_inconnue"));
            }
        }
        let (field_id, name) = insert_computed_field(
            &tx,
            ctx,
            &where_,
            &ComputedFieldRow { label: &request.label, kind: "button", technical_name: request.technical_name.as_deref(), description: description_ref, lineage_id: request.lineage_id.as_deref() },
        )
        .await?;
        tx.execute_op(
            "INSERT INTO _basedb.field_button_config (field_id, label, color, action, url_template, automation_id)
             VALUES ($1::text::uuid, $2, $3, $4, $5, $6::text::uuid)",
            &[&field_id, text_ref, color_ref, action_ref, url_ref, automation_ref],
            SqlOp::Insert,
        )
        .await?;
        Ok(AddedField { field_id, name, label: request.label.clone(), description: description_ref.map(str::to_string), kind: "button".to_string(), sql: Vec::new() })
    })
    .await
}

// ── Required ──────────────────────────────────────────────────────────────────────

struct RequiredPlan {
    relation: String,
    column: String,
    constraint_id: String,
    constraint_name: String,
}

/// `setFieldRequired`: `ADD … NOT VALID`, `VALIDATE` outside a transaction, `SET NOT NULL`,
/// the scaffold dropped; `(required, sql)`.
pub async fn set_field_required(pools: &Pools, ctx: &RequestContext, field_id: &str, required: bool) -> R<(bool, Vec<String>)> {
    let (mut sql, plan) = with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_field(&tx, ctx, Action::ManageSchema, field_id).await?;
        let row = tx
            .first(
                "SELECT f.table_id::text, f.base_id::text, f.kind, f.is_required,
                        n.name AS column_name, tn.name AS table_name, sn.name AS schema_name
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n  ON n.id = f.name_id
                   JOIN _basedb.table_def t      ON t.id = f.table_id
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                   JOIN _basedb.db_schema s      ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                  WHERE f.id = $1::text::uuid AND f.is_live",
                &[&field_id],
            )
            .await?;
        let Some(row) = row else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
        };
        let (table_id, base_id, kind, is_required, column_name, table_name, schema_name): (String, String, String, bool, String, String, String) =
            (row.get(0), row.get(1), row.get(2), row.get(3), row.get(4), row.get(5), row.get(6));
        if kind == "formula" {
            return Err(invalid("kind", "formule"));
        }
        if kind == "autonumber" {
            return Err(invalid("kind", "numero_automatique"));
        }
        if tx.first("SELECT 1 FROM _basedb.field_ai_config WHERE field_id = $1::text::uuid", &[&field_id]).await?.is_some() {
            return Err(invalid("kind", "champ_ia"));
        }
        let relation = qualify(&schema_name, &table_name)?;
        let column = quote_identifier(&column_name)?;
        if !required {
            let statement = format!("ALTER TABLE {relation} ALTER COLUMN {column} DROP NOT NULL;");
            ddl(&tx, &statement).await?;
            tx.execute_op("UPDATE _basedb.field SET is_required = false, required_state = 'absent' WHERE id = $1::text::uuid", &[&field_id], SqlOp::Update).await?;
            return Ok((vec![statement], None));
        }
        if is_required {
            return Ok((Vec::new(), None));
        }
        let name = allocate_name(
            &tx,
            ctx,
            &AllocationRequest::new(Candidate::Derived(check_constraint_name(&table_name, &column_name, "not_null")), ObjectKind::Constraint, ScopeKind::Table, table_id.clone()),
        )
        .await?;
        let constraint_id = insert_constraint(&tx, ctx, &table_id, &base_id, &name.name_id, "not_null", "not_valid").await?;
        insert_member(&tx, &constraint_id, field_id, &table_id).await?;
        let scaffold = format!("ALTER TABLE {relation} ADD CONSTRAINT {} CHECK ({column} IS NOT NULL) NOT VALID;", quote_identifier(&name.name)?);
        ddl(&tx, &scaffold).await?;
        tx.execute_op("UPDATE _basedb.field SET required_state = 'not_valid' WHERE id = $1::text::uuid", &[&field_id], SqlOp::Update).await?;
        Ok((vec![scaffold], Some(RequiredPlan { relation, column, constraint_id, constraint_name: name.name })))
    })
    .await?;
    let Some(plan) = plan else {
        return Ok((required, sql));
    };

    let constraint = quote_identifier(&plan.constraint_name)?;
    let validate = format!("ALTER TABLE {} VALIDATE CONSTRAINT {constraint};", plan.relation);
    let validated = {
        let conn = pools.get(PoolName::Ddl).await?;
        conn.execute_op(&validate, &[], SqlOp::Ddl).await.map(|_| ())
    };
    if validated.is_err() {
        if let Ok(conn) = pools.get(PoolName::Ddl).await {
            let _ = conn.execute_op(&format!("ALTER TABLE {} DROP CONSTRAINT IF EXISTS {constraint};", plan.relation), &[], SqlOp::Ddl).await;
        }
        let conn = pools.catalog().await?;
        conn.execute_op(
            "UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = clock_timestamp() WHERE id = $1::text::uuid",
            &[&plan.constraint_id],
            SqlOp::Update,
        )
        .await?;
        conn.execute_op("UPDATE _basedb.field SET required_state = 'absent' WHERE id = $1::text::uuid", &[&field_id], SqlOp::Update).await?;
        return Err(AppError::new("VALIDATION_FAILED").with("field", json!(field_id)).with("reason", json!("lignes_vides")));
    }
    sql.push(validate);

    let plan_ref = &plan;
    let tail = with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        let promote = format!("ALTER TABLE {} ALTER COLUMN {} SET NOT NULL;", plan_ref.relation, plan_ref.column);
        let drop = format!("ALTER TABLE {} DROP CONSTRAINT {};", plan_ref.relation, quote_identifier(&plan_ref.constraint_name)?);
        ddl(&tx, &promote).await?;
        ddl(&tx, &drop).await?;
        tx.execute_op(
            "UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = clock_timestamp() WHERE id = $1::text::uuid",
            &[&plan_ref.constraint_id],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op("UPDATE _basedb.field SET is_required = true, required_state = 'active' WHERE id = $1::text::uuid", &[&field_id], SqlOp::Update).await?;
        Ok(vec![promote, drop])
    })
    .await?;
    sql.extend(tail);
    Ok((true, sql))
}

// ── Unique ────────────────────────────────────────────────────────────────────────

const UNIQUE_KINDS: [&str; 6] = ["short_text", "email", "url", "number", "date", "datetime"];
const INDEXABLE_BYTES: i32 = 2000;

#[derive(Clone)]
struct UniqueField {
    table_id: String,
    base_id: String,
    kind: String,
    label: String,
    column_name: String,
    table_name: String,
    schema_name: String,
    ai: bool,
}

async fn duplicates_of<E: Exec + Sync>(exec: &E, field: &UniqueField) -> R<Vec<Value>> {
    let column = quote_identifier(&field.column_name)?;
    let rows = exec
        .rows(
            &format!(
                "SELECT {column}::text AS value, count(*) AS count
                   FROM {}
                  WHERE {column} IS NOT NULL
                  GROUP BY {column}
                 HAVING count(*) > 1
                  ORDER BY count(*) DESC, 1
                  LIMIT 20",
                qualify(&field.schema_name, &field.table_name)?
            ),
            &[],
        )
        .await?;
    Ok(rows.iter().map(|r| json!({ "value": r.get::<_, Option<String>>(0), "count": r.get::<_, i64>(1) })).collect())
}

struct UniquePlan {
    field: UniqueField,
    relation: String,
    column: String,
    constraint_id: String,
    name: String,
}

/// `setFieldUnique`: a unique index built `CONCURRENTLY`, then the constraint over it;
/// `(unique, sql)`.
pub async fn set_field_unique(pools: &Pools, ctx: &RequestContext, field_id: &str, unique: bool) -> R<(bool, Vec<String>)> {
    let (sql, plan) = with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_field(&tx, ctx, Action::ManageSchema, field_id).await?;
        let row = tx
            .first(
                "SELECT f.table_id::text, f.base_id::text, f.kind, f.label,
                        n.name AS column_name, tn.name AS table_name, sn.name AS schema_name,
                        EXISTS (SELECT 1 FROM _basedb.field_ai_config c WHERE c.field_id = f.id) AS ai
                   FROM _basedb.field f
                   JOIN _basedb.physical_name n  ON n.id = f.name_id
                   JOIN _basedb.table_def t      ON t.id = f.table_id
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                   JOIN _basedb.db_schema s      ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                  WHERE f.id = $1::text::uuid AND f.is_live",
                &[&field_id],
            )
            .await?;
        let Some(row) = row else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
        };
        let field = UniqueField {
            table_id: row.get(0),
            base_id: row.get(1),
            kind: row.get(2),
            label: row.get(3),
            column_name: row.get(4),
            table_name: row.get(5),
            schema_name: row.get(6),
            ai: row.get(7),
        };
        let relation = qualify(&field.schema_name, &field.table_name)?;
        let existing = tx
            .first(
                "SELECT c.id::text, n.name, c.state
                   FROM _basedb.table_constraint c
                   JOIN _basedb.physical_name n           ON n.id = c.name_id
                   JOIN _basedb.table_constraint_member m ON m.constraint_id = c.id
                  WHERE m.field_id = $1::text::uuid AND c.kind = 'unique' AND c.state <> 'dropped'
                    AND (SELECT count(*) FROM _basedb.table_constraint_member o
                          WHERE o.constraint_id = c.id) = 1
                  ORDER BY c.created_at DESC
                  LIMIT 1",
                &[&field_id],
            )
            .await?
            .map(|r| (r.get::<_, String>(0), r.get::<_, String>(1), r.get::<_, String>(2)));

        if !unique {
            let Some((id, name, _)) = existing else {
                return Ok((Vec::new(), None));
            };
            let statement = format!("ALTER TABLE {relation} DROP CONSTRAINT IF EXISTS {};", quote_identifier(&name)?);
            ddl(&tx, &statement).await?;
            ddl(&tx, &format!("DROP INDEX IF EXISTS {};", qualify(&field.schema_name, &name)?)).await?;
            tx.execute_op(
                "UPDATE _basedb.table_constraint
                    SET state = 'dropped', dropped_at = clock_timestamp(), state_changed_at = clock_timestamp()
                  WHERE id = $1::text::uuid",
                &[&id],
                SqlOp::Update,
            )
            .await?;
            return Ok((vec![statement], None));
        }
        if let Some((_, _, state)) = &existing {
            if state == "active" {
                return Ok((Vec::new(), None));
            }
            return Err(AppError::new("MIGRATION_IN_PROGRESS").with("field", json!(field.label)));
        }
        if !UNIQUE_KINDS.contains(&field.kind.as_str()) {
            return Err(invalid("unique", "type_sans_unicite").with("kind", json!(field.kind)));
        }
        if field.ai {
            return Err(invalid("unique", "champ_ia"));
        }
        let column = quote_identifier(&field.column_name)?;
        if matches!(field.kind.as_str(), "short_text" | "email" | "url") {
            let longest = tx.first(&format!("SELECT max(octet_length({column}))::int AS bytes FROM {relation}"), &[]).await?;
            let bytes: Option<i32> = longest.and_then(|r| r.get(0));
            if bytes.unwrap_or(0) > INDEXABLE_BYTES {
                return Err(AppError::new("INDEX_LENGTH_EXCEEDED").with("field", json!(field.label)).with("bytes", json!(bytes)).with("maximum", json!(INDEXABLE_BYTES)));
            }
        }
        let duplicates = duplicates_of(&tx, &field).await?;
        if !duplicates.is_empty() {
            return Err(AppError::new("DUPLICATE_VALUE").with("field", json!(field.label)).with("duplicates", json!(duplicates)));
        }
        let name = allocate_name(
            &tx,
            ctx,
            &AllocationRequest::new(Candidate::Derived(unique_constraint_name(&field.table_name, &[&field.column_name])), ObjectKind::Constraint, ScopeKind::Table, field.table_id.clone()),
        )
        .await?;
        let rows = tx
            .query_op(
                "INSERT INTO _basedb.table_constraint (table_id, base_id, kind, name_id, origin, state, created_by)
                 VALUES ($1::text::uuid, $2::text::uuid, 'unique', $3::text::uuid, 'user', 'building', $4::text::uuid) RETURNING id::text",
                &[&field.table_id, &field.base_id, &name.name_id, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let constraint_id: String = rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("constraint not created"))?;
        insert_member(&tx, &constraint_id, field_id, &field.table_id).await?;
        Ok((Vec::new(), Some(UniquePlan { field, relation, column, constraint_id, name: name.name })))
    })
    .await?;
    let Some(plan) = plan else {
        return Ok((unique, sql));
    };

    let index = qualify(&plan.field.schema_name, &plan.name)?;
    let quoted = quote_identifier(&plan.name)?;
    let build = format!("CREATE UNIQUE INDEX CONCURRENTLY {quoted} ON {} ({});", plan.relation, plan.column);
    let abandon = || async {
        if let Ok(conn) = pools.get(PoolName::Ddl).await {
            let _ = conn.execute_op(&format!("DROP INDEX CONCURRENTLY IF EXISTS {index};"), &[], SqlOp::Ddl).await;
        }
        let conn = pools.catalog().await?;
        conn.execute_op(
            "UPDATE _basedb.table_constraint
                SET state = 'dropped', dropped_at = clock_timestamp(), state_changed_at = clock_timestamp()
              WHERE id = $1::text::uuid",
            &[&plan.constraint_id],
            SqlOp::Update,
        )
        .await?;
        Ok::<(), AppError>(())
    };

    let built = {
        let conn = pools.get(PoolName::Ddl).await?;
        conn.execute_op(&build, &[], SqlOp::Ddl).await.map(|_| ())
    };
    if let Err(e) = built {
        abandon().await?;
        let duplicates = match pools.get(PoolName::Data).await {
            Ok(conn) => duplicates_of(&conn, &plan.field).await.unwrap_or_default(),
            Err(_) => Vec::new(),
        };
        if !duplicates.is_empty() {
            return Err(AppError::new("DUPLICATE_VALUE").with("field", json!(plan.field.label)).with("duplicates", json!(duplicates)));
        }
        return Err(e);
    }

    let attach = format!("ALTER TABLE {} ADD CONSTRAINT {quoted} UNIQUE USING INDEX {quoted};", plan.relation);
    let (attach_ref, plan_ref) = (&attach, &plan);
    let attached = with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        ddl(&tx, attach_ref).await?;
        tx.execute_op(
            "UPDATE _basedb.table_constraint SET state = 'active', state_changed_at = clock_timestamp() WHERE id = $1::text::uuid",
            &[&plan_ref.constraint_id],
            SqlOp::Update,
        )
        .await?;
        Ok(())
    })
    .await;
    if let Err(e) = attached {
        abandon().await?;
        return Err(e);
    }
    Ok((true, vec![build, attach]))
}

// ── Links ─────────────────────────────────────────────────────────────────────────

/// `CreateLinkFieldRequest`.
#[derive(Debug, Clone, Default)]
pub struct CreateLinkRequest {
    pub table_id: String,
    pub target_table_id: String,
    pub label: String,
    pub description: Option<Value>,
    pub required: Option<bool>,
    /// `restrict`, `set_null` or `cascade`.
    pub on_delete: Option<String>,
    pub multiple: bool,
    pub technical_name: Option<String>,
    pub lineage_id: Option<String>,
}

/// `CreatedLinkField`.
#[derive(Debug, Clone)]
pub struct CreatedLink {
    pub field_id: String,
    pub label: String,
    pub description: Option<String>,
    pub name: String,
    pub target_table_name: String,
    pub constraint_name: Option<String>,
    pub index_name: String,
    pub on_delete: String,
    pub kind: &'static str,
    pub sql: Vec<String>,
}

#[derive(Clone)]
struct LinkEnd {
    table: TableRef,
    label: String,
}

async fn link_end<E: Exec + Sync>(exec: &E, table_id: &str) -> R<LinkEnd> {
    let row = exec
        .first(
            "SELECT t.id::text, t.base_id::text, t.label, sn.name AS schema_name, tn.name AS table_name
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
    Ok(LinkEnd { table: TableRef { table_id: r.get(0), base_id: r.get(1), schema_name: r.get(3), table_name: r.get(4) }, label: r.get(2) })
}

/// The refusals of §4.2 (`check`).
fn check_link(source: &LinkEnd, target: &LinkEnd, on_delete: &str, required: bool) -> R<()> {
    if source.table.base_id != target.table.base_id {
        return Err(AppError::new("LINK_CROSS_DATABASE").with("source", json!(source.table.table_name)).with("target", json!(target.table.table_name)));
    }
    if required && on_delete == "set_null" {
        return Err(AppError::new("LINK_SET_NULL_ON_REQUIRED").with("table", json!(source.table.table_name)));
    }
    if required && source.table.table_id == target.table.table_id {
        return Err(AppError::new("LINK_SELF_REQUIRED").with("table", json!(source.table.table_name)));
    }
    if on_delete == "cascade" {
        return Err(AppError::new("LINK_CASCADE_NOT_GRANTED").with("reason", json!("cascade confirmation is not implemented yet")));
    }
    Ok(())
}

fn on_delete_clause(on_delete: &str) -> &'static str {
    match on_delete {
        "set_null" => "SET NULL",
        "cascade" => "CASCADE",
        _ => "NO ACTION",
    }
}

/// `literal`: comments only.
fn literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// `registerObject`: a constraint or an index, its name and its member; its id.
async fn register_object<E: Exec + Sync>(exec: &E, ctx: &RequestContext, index: bool, values: &str, name: String, source: &TableRef, field_id: &str) -> R<String> {
    let kind = if index { ObjectKind::Index } else { ObjectKind::Constraint };
    let allocated = allocate_name(exec, ctx, &AllocationRequest::new(Candidate::Derived(name), kind, ScopeKind::Table, source.table_id.clone())).await?;
    let (table, columns, members, key) = if index {
        ("_basedb.table_index", "method, origin, state", "_basedb.table_index_member", "index_id")
    } else {
        ("_basedb.table_constraint", "kind, origin, state", "_basedb.table_constraint_member", "constraint_id")
    };
    let rows = exec
        .query_op(
            &format!("INSERT INTO {table} (table_id, base_id, name_id, {columns}, created_by) VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, {values}, $4::text::uuid) RETURNING id::text"),
            &[&source.table_id, &source.base_id, &allocated.name_id, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
    let id: String = rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("object not registered"))?;
    exec.execute_op(
        &format!("INSERT INTO {members} ({key}, field_id, table_id, position) VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, 1)"),
        &[&id, &field_id, &source.table_id],
        SqlOp::Insert,
    )
    .await?;
    Ok(id)
}

/// `advance`: a statement outside a transaction, framed by the catalog's state.
async fn advance(pools: &Pools, object_id: &str, table: &str, during: &str, statement: &str, done: &str) -> R<()> {
    set_object_state(pools, table, object_id, during).await?;
    {
        let conn = pools.get(PoolName::Ddl).await?;
        conn.execute_op(statement, &[], SqlOp::Ddl).await?;
    }
    set_object_state(pools, table, object_id, done).await
}

async fn set_object_state(pools: &Pools, table: &str, object_id: &str, state: &str) -> R<()> {
    let conn = pools.catalog().await?;
    conn.execute_op(
        &format!("UPDATE {table} SET state = $2, state_changed_at = pg_catalog.clock_timestamp() WHERE id = $1::text::uuid"),
        &[&object_id, &state],
        SqlOp::Update,
    )
    .await?;
    Ok(())
}

struct LinkPlan {
    field_id: String,
    name: String,
    fk_name: Option<String>,
    ix_name: String,
    constraint_id: Option<String>,
    index_id: String,
    relation: String,
    target_table_name: String,
    sql: Vec<String>,
}

/// `createLinkField`: a link (three steps) or a multi-link (two).
pub async fn create_link_field(pools: &Pools, ctx: &RequestContext, request: &CreateLinkRequest) -> R<CreatedLink> {
    let multiple = request.multiple;
    let required = request.required.unwrap_or(false);
    let on_delete = request.on_delete.clone().unwrap_or_else(|| if multiple && !required { "set_null".to_string() } else { "restrict".to_string() });
    let description = normalize_description(request.description.as_ref(), "description")?;
    let (on_delete_ref, description_ref) = (on_delete.as_str(), description.as_deref());

    let plan = with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, &request.table_id).await?;
        require_on_table(&tx, ctx, Action::ManageSchema, &request.target_table_id).await?;
        let source = link_end(&tx, &request.table_id).await?;
        let target = link_end(&tx, &request.target_table_id).await?;
        check_link(&source, &target, on_delete_ref, required)?;

        let label_slug = slugify(&request.label, 60, SlugNature::Champ).slug;
        let mut allocation = match &request.technical_name {
            Some(t) => AllocationRequest::new(Candidate::Technical(t.clone()), ObjectKind::Field, ScopeKind::Table, source.table.table_id.clone()),
            None => {
                let derived = if multiple { multi_link_column_name(&target.table.table_name) } else { link_column_name(&target.table.table_name) };
                AllocationRequest::new(Candidate::Derived(derived), ObjectKind::Field, ScopeKind::Table, source.table.table_id.clone())
            }
        };
        if request.technical_name.is_none() {
            allocation.derived_fallbacks = vec![if multiple { multi_link_column_name_from_label(&label_slug) } else { link_column_name_from_label(&label_slug) }];
        }
        let column_name = allocate_name(&tx, ctx, &allocation).await?;
        let kind = if multiple { "multi_link" } else { "link" };
        let field_id = insert_field_row(&tx, ctx, &source.table, kind, &column_name.name_id, &request.label, description_ref, required, request.lineage_id.as_deref()).await?;
        let relation = qualify(&source.table.schema_name, &source.table.table_name)?;
        let column = quote_identifier(&column_name.name)?;
        let ix_name = index_name(&source.table.table_name, &[&column_name.name]);

        if !multiple {
            let fk_name = foreign_key_name(&source.table.table_name, &column_name.name);
            let constraint_id = register_object(&tx, ctx, false, "'foreign_key', 'system', 'not_valid'", fk_name.clone(), &source.table, &field_id).await?;
            let index_id = register_object(&tx, ctx, true, "'btree', 'system', 'pending'", ix_name.clone(), &source.table, &field_id).await?;
            tx.execute_op(
                "INSERT INTO _basedb.field_link_config
                   (field_id, base_id, is_required, target_table_id, fk_constraint_id, fk_index_id, on_delete)
                 VALUES ($1::text::uuid, $2::text::uuid, $3, $4::text::uuid, $5::text::uuid, $6::text::uuid, $7)",
                &[&field_id, &source.table.base_id, &required, &target.table.table_id, &constraint_id, &index_id, &on_delete_ref],
                SqlOp::Insert,
            )
            .await?;
            let sql = vec![
                format!("ALTER TABLE {relation} ADD COLUMN {column} uuid NULL;"),
                format!("COMMENT ON COLUMN {relation}.{column} IS {};", literal(comment_text(&format!("Lien vers {}", target.label), description_ref))),
                format!(
                    "ALTER TABLE {relation}\n  ADD CONSTRAINT {}\n  FOREIGN KEY ({column}) REFERENCES {} (\"_id\")\n  ON DELETE {} ON UPDATE NO ACTION NOT VALID;",
                    quote_identifier(&fk_name)?,
                    qualify(&target.table.schema_name, &target.table.table_name)?,
                    on_delete_clause(on_delete_ref)
                ),
            ];
            for s in &sql {
                ddl(&tx, s).await?;
            }
            return Ok(LinkPlan {
                field_id,
                name: column_name.name,
                fk_name: Some(fk_name),
                ix_name,
                constraint_id: Some(constraint_id),
                index_id,
                relation,
                target_table_name: target.table.table_name,
                sql,
            });
        }

        let index_id = register_object(&tx, ctx, true, "'gin', 'system', 'pending'", ix_name.clone(), &source.table, &field_id).await?;
        tx.execute_op(
            "INSERT INTO _basedb.field_link_config
               (field_id, kind, base_id, is_required, target_table_id, fk_constraint_id, fk_index_id, on_delete)
             VALUES ($1::text::uuid, 'multi_link', $2::text::uuid, $3, $4::text::uuid, NULL, $5::text::uuid, $6)",
            &[&field_id, &source.table.base_id, &required, &target.table.table_id, &index_id, &on_delete_ref],
            SqlOp::Insert,
        )
        .await?;
        let mode = if on_delete_ref == "restrict" { "restrict" } else { "set_null" };
        let triggers = multi_link_triggers(&source.table, &target.table, &column_name.name, mode)?;
        for (scope, name) in [(&source.table.table_id, &triggers.0), (&target.table.table_id, &triggers.1)] {
            tx.execute_op(
                "INSERT INTO _basedb.physical_name (scope_kind, scope_id, name, object_kind, state, slug_version, allocated_by)
                 VALUES ('table', $1::text::uuid, $2, 'trigger', 'active', 1, $3::text::uuid)",
                &[scope, name, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        }
        let mut sql = vec![
            format!("ALTER TABLE {relation} ADD COLUMN {column} uuid[] NULL;"),
            format!("COMMENT ON COLUMN {relation}.{column} IS {};", literal(comment_text(&format!("Relation multiple vers {}", target.label), description_ref))),
        ];
        sql.extend(triggers.2);
        for s in &sql {
            ddl(&tx, s).await?;
        }
        Ok(LinkPlan { field_id, name: column_name.name, fk_name: None, ix_name, constraint_id: None, index_id, relation, target_table_name: target.table.table_name, sql })
    })
    .await?;

    let mut sql = plan.sql.clone();
    let ix = quote_identifier(&plan.ix_name)?;
    let column = quote_identifier(&plan.name)?;
    let index_sql =
        if multiple { format!("CREATE INDEX CONCURRENTLY {ix}\n  ON {} USING gin ({column});", plan.relation) } else { format!("CREATE INDEX CONCURRENTLY {ix}\n  ON {} ({column}, \"_id\");", plan.relation) };
    advance(pools, &plan.index_id, "_basedb.table_index", "building", &index_sql, "active").await?;
    sql.push(index_sql);
    if let (Some(fk), Some(constraint_id)) = (&plan.fk_name, &plan.constraint_id) {
        let validate = format!("ALTER TABLE {} VALIDATE CONSTRAINT {};", plan.relation, quote_identifier(fk)?);
        advance(pools, constraint_id, "_basedb.table_constraint", "validating", &validate, "active").await?;
        sql.push(validate);
    }
    Ok(CreatedLink {
        field_id: plan.field_id,
        label: request.label.clone(),
        description,
        name: plan.name,
        target_table_name: plan.target_table_name,
        constraint_name: plan.fk_name,
        index_name: plan.ix_name,
        on_delete,
        kind: if multiple { "multi_link" } else { "link" },
        sql,
    })
}

/// `multiLinkTriggers`: `(source trigger, target trigger, statements)`.
pub fn multi_link_triggers(source: &TableRef, target: &TableRef, column: &str, mode: &str) -> R<(String, String, Vec<String>)> {
    let source_name = multi_link_trigger_name(&source.table_name, column);
    let target_name = multi_link_target_trigger_name(&target.table_name, &source.table_name, column);
    let statements = vec![
        format!(
            "CREATE TRIGGER {}\n  BEFORE INSERT OR UPDATE OF {} ON {}\n  FOR EACH ROW EXECUTE FUNCTION _basedb_local.multi_link_check_v1({}, {}, {});",
            quote_identifier(&source_name)?,
            quote_identifier(column)?,
            qualify(&source.schema_name, &source.table_name)?,
            quote_literal(column),
            quote_literal(&target.schema_name),
            quote_literal(&target.table_name)
        ),
        format!(
            "CREATE TRIGGER {}\n  AFTER DELETE ON {}\n  REFERENCING OLD TABLE AS old_rows\n  FOR EACH STATEMENT EXECUTE FUNCTION _basedb_local.multi_link_deleted_v1({}, {}, {}, '{mode}');",
            quote_identifier(&target_name)?,
            qualify(&target.schema_name, &target.table_name)?,
            quote_literal(&source.schema_name),
            quote_literal(&source.table_name),
            quote_literal(column)
        ),
    ];
    Ok((source_name, target_name, statements))
}

// ── Display ───────────────────────────────────────────────────────────────────────

/// `setDisplayColumn`: `(field id, name)`, both `None` when withdrawn.
pub async fn set_display_column(pools: &Pools, ctx: &RequestContext, table_id: &str, field_id: Option<&str>) -> R<(Option<String>, Option<String>)> {
    with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let Some(field_id) = field_id else {
            tx.execute_op(
                "UPDATE _basedb.table_def
                    SET display_field_id = NULL, display_field_kind = NULL,
                        display_field_is_live = NULL, display_field_can_be_display = NULL,
                        updated_by = $2::text::uuid, updated_at = pg_catalog.clock_timestamp()
                  WHERE id = $1::text::uuid",
                &[&table_id, &ctx.actor.id],
                SqlOp::Update,
            )
            .await?;
            return Ok((None, None));
        };
        let row = tx
            .first(
                "SELECT f.kind, f.is_live, k.can_be_display, n.name
                   FROM _basedb.field f
                   JOIN _basedb.field_kind k     ON k.code = f.kind
                   JOIN _basedb.physical_name n  ON n.id = f.name_id
                  WHERE f.id = $1::text::uuid AND f.table_id = $2::text::uuid",
                &[&field_id, &table_id],
            )
            .await?;
        let Some(row) = row else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
        };
        let (kind, is_live, can_be_display, name): (String, bool, bool, String) = (row.get(0), row.get(1), row.get(2), row.get(3));
        if !can_be_display {
            return Err(AppError::new("VALIDATION_FAILED").with("violations", json!([{ "field": field_id, "type": kind, "reason": "type cannot be displayed" }])));
        }
        tx.execute_op(
            "UPDATE _basedb.table_def
                SET display_field_id = $2::text::uuid, display_field_kind = $3,
                    display_field_is_live = $4, display_field_can_be_display = $5,
                    updated_by = $6::text::uuid, updated_at = pg_catalog.clock_timestamp()
              WHERE id = $1::text::uuid",
            &[&table_id, &field_id, &kind, &is_live, &can_be_display, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        Ok((Some(field_id.to_string()), Some(name)))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shapes_and_clauses_are_node_s() {
        assert_eq!(file_shape_check("\"f\""), "\"f\" IS NULL OR CASE WHEN jsonb_typeof(\"f\") = 'array' THEN jsonb_array_length(\"f\") BETWEEN 1 AND 20 ELSE false END");
        assert_eq!(on_delete_clause("restrict"), "NO ACTION");
        assert_eq!(literal("l'a"), "'l''a'");
        let t = |id: &str, base: &str| LinkEnd { table: TableRef { table_id: id.into(), base_id: base.into(), table_name: format!("t{id}"), schema_name: "s".into() }, label: "T".into() };
        assert_eq!(check_link(&t("1", "a"), &t("2", "b"), "restrict", false).unwrap_err().code, "LINK_CROSS_DATABASE");
        assert_eq!(check_link(&t("1", "a"), &t("2", "a"), "set_null", true).unwrap_err().code, "LINK_SET_NULL_ON_REQUIRED");
        assert_eq!(check_link(&t("1", "a"), &t("1", "a"), "restrict", true).unwrap_err().code, "LINK_SELF_REQUIRED");
        assert_eq!(check_link(&t("1", "a"), &t("2", "a"), "cascade", false).unwrap_err().code, "LINK_CASCADE_NOT_GRANTED");
        assert!(check_link(&t("1", "a"), &t("1", "a"), "restrict", false).is_ok());
    }
}
