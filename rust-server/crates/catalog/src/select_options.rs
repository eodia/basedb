//! The options of a `select` (`catalog/select-options.ts`): a value, a label and a look per
//! option, and the `CHECK` that makes the list true in the database.

use crate::allocation::{allocate_name, AllocationRequest, Candidate, ObjectKind, ScopeKind};
use crate::description::js_trim;
use crate::http::{normalize_look, LookInput};
use crate::lifecycle::assert_manage_schema;
use crate::naming::{check_constraint_name, qualify, quote_identifier, quote_literal};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::require_on_field;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use serde_json::{json, Value};
use std::collections::HashSet;

type R<T> = Result<T, AppError>;

pub const MAX_OPTIONS: usize = 200;
pub const MAX_OPTION_CHARS: usize = 200;
pub const MAX_LABEL_CHARS: usize = 255;

/// `SelectOption`.
#[derive(Debug, Clone, PartialEq)]
pub struct SelectOption {
    pub value: String,
    pub label: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub image: Option<String>,
}

impl SelectOption {
    pub fn to_json(&self) -> Value {
        json!({ "value": self.value, "label": self.label, "color": self.color, "icon": self.icon, "image": self.image })
    }
}

/// `isChoiceKind`.
pub fn is_choice_kind(kind: &str) -> bool {
    kind == "select" || kind == "multi_select"
}

/// `choiceCheck`: the body of the `ck_…__enum` of a choice column.
pub fn choice_check(kind: &str, column: &str, values: &[String]) -> String {
    let list = values.iter().map(|v| quote_literal(v)).collect::<Vec<_>>().join(", ");
    if kind == "select" {
        format!("{column} IN ({list})")
    } else {
        format!("cardinality({column}) > 0 AND array_ndims({column}) = 1 AND {column} <@ ARRAY[{list}]::text[]")
    }
}

fn invalid(reason: &str, option: Option<&str>) -> AppError {
    let e = AppError::new("REQUEST_INVALID").with("field", json!("options")).with("reason", json!(reason));
    match option {
        Some(o) => e.with("option", json!(o)),
        None => e,
    }
}

/// Whether Node would throw a `TypeError` reading the list — a label neither text nor
/// `null` (`raw.label.trim`): such a request is refused as invalid rather than imitated.
pub fn options_unreadable(options: &[Value]) -> bool {
    options.iter().any(|o| o.get("label").is_some_and(|l| !l.is_null() && !l.is_string()))
}

/// `normalizeLook(raw)` of one option: a key neither text nor absent reads as empty.
fn look_input(raw: &Value) -> LookInput {
    let key = |k: &str| raw.get(k).map(|v| v.as_str().map(str::to_string));
    LookInput { color: key("color"), icon: key("icon"), image: key("image") }
}

/// `normalizeOptions`.
pub fn normalize_options(options: &[Value]) -> R<Vec<SelectOption>> {
    if options.is_empty() {
        return Err(invalid("liste_vide", None));
    }
    if options.len() > MAX_OPTIONS {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("options")).with("reason", json!("trop_d_options")).with("maximum", json!(MAX_OPTIONS)));
    }
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::with_capacity(options.len());
    for raw in options {
        let Some(value) = raw.get("value").and_then(Value::as_str) else {
            return Err(invalid("valeur_absente", None));
        };
        let value = js_trim(value).to_string();
        if value.is_empty() {
            return Err(invalid("vide", None));
        }
        if value.contains('\0') {
            return Err(invalid("caractere_nul", Some(&value)));
        }
        if value.chars().count() > MAX_OPTION_CHARS {
            return Err(invalid("trop_long", Some(&value)));
        }
        if !seen.insert(value.clone()) {
            return Err(AppError::new("DUPLICATE_VALUE").with("option", json!(value)));
        }
        let label = raw.get("label").and_then(Value::as_str).map(js_trim).unwrap_or("");
        let label = if label.is_empty() { value.clone() } else { label.to_string() };
        if label.chars().count() > MAX_LABEL_CHARS {
            return Err(AppError::new("LABEL_TOO_LONG").with("maximum", json!(MAX_LABEL_CHARS)));
        }
        let look = normalize_look(&look_input(raw), |reason| invalid(reason, Some(&value)))?;
        out.push(SelectOption { value, label, color: look.color, icon: look.icon, image: look.image });
    }
    Ok(out)
}

/// `setSelectOptions`' result.
#[derive(Debug, Clone)]
pub struct SetOptionsResult {
    pub options: Vec<SelectOption>,
    pub added: Vec<String>,
    pub removed: Vec<String>,
    pub sql: Vec<String>,
}

struct Regenerated {
    relation: String,
    constraint_name: String,
    constraint_id: String,
}

async fn insert_option<E: Exec + Sync>(exec: &E, field_id: &str, option: &SelectOption, position: i32, update: bool) -> R<()> {
    let sql = if update {
        "UPDATE _basedb.select_option
            SET label = $3, color = $4, icon = $5, image = $6, position = $7
          WHERE field_id = $1::text::uuid AND value = $2 AND deleted_at IS NULL"
    } else {
        "INSERT INTO _basedb.select_option (field_id, value, label, color, icon, image, position)
         VALUES ($1::text::uuid, $2, $3, $4, $5, $6, $7)"
    };
    exec.execute_op(
        sql,
        &[&field_id, &option.value, &option.label, &option.color, &option.icon, &option.image, &position],
        if update { SqlOp::Update } else { SqlOp::Insert },
    )
    .await?;
    Ok(())
}

/// `addSelectOptions` of `fields.ts`: the options of a choice column just created, and its
/// constraint, born valid on an empty column.
#[allow(clippy::too_many_arguments)]
pub async fn add_select_options<E: Exec + Sync>(
    exec: &E,
    ctx: &RequestContext,
    table_id: &str,
    base_id: &str,
    schema: &str,
    table: &str,
    field_id: &str,
    kind: &str,
    column: &str,
    input: &[Value],
) -> R<Vec<String>> {
    let options = normalize_options(input)?;
    let name = allocate_name(
        exec,
        ctx,
        &AllocationRequest::new(Candidate::Derived(check_constraint_name(table, column, "enum")), ObjectKind::Constraint, ScopeKind::Table, table_id),
    )
    .await?;
    let constraint_id = insert_constraint(exec, ctx, table_id, base_id, &name.name_id, "enum", "active").await?;
    insert_member(exec, &constraint_id, field_id, table_id).await?;
    exec.execute_op(
        "INSERT INTO _basedb.field_select_config (field_id, kind, enum_constraint_id) VALUES ($1::text::uuid, $2, $3::text::uuid)",
        &[&field_id, &kind, &constraint_id],
        SqlOp::Insert,
    )
    .await?;
    for (i, option) in options.iter().enumerate() {
        insert_option(exec, field_id, option, i as i32 + 1, false).await?;
    }
    let values: Vec<String> = options.iter().map(|o| o.value.clone()).collect();
    let statement = format!(
        "ALTER TABLE {} ADD CONSTRAINT {} CHECK ({});",
        qualify(schema, table)?,
        quote_identifier(&name.name)?,
        choice_check(kind, &quote_identifier(column)?, &values)
    );
    exec.execute_op(&statement, &[], SqlOp::Ddl).await?;
    Ok(vec![statement])
}

pub(crate) async fn insert_constraint<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str, base_id: &str, name_id: &str, rule: &str, state: &str) -> R<String> {
    let rows = exec
        .query_op(
            "INSERT INTO _basedb.table_constraint
               (table_id, base_id, kind, name_id, rule, origin, state, created_by)
             VALUES ($1::text::uuid, $2::text::uuid, 'check', $3::text::uuid, $4, 'system', $5, $6::text::uuid) RETURNING id::text",
            &[&table_id, &base_id, &name_id, &rule, &state, &ctx.actor.id],
            SqlOp::Insert,
        )
        .await?;
    rows.first().map(|r| r.get(0)).ok_or_else(|| AppError::internal("constraint not created"))
}

pub(crate) async fn insert_member<E: Exec + Sync>(exec: &E, constraint_id: &str, field_id: &str, table_id: &str) -> R<()> {
    exec.execute_op(
        "INSERT INTO _basedb.table_constraint_member (constraint_id, field_id, table_id, position)
         VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, 1)",
        &[&constraint_id, &field_id, &table_id],
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}

/// `setSelectOptions`: the whole list replaced, in the given order; the constraint
/// regenerated when the set of values moves (`DROP` + `ADD … NOT VALID`, then `VALIDATE`
/// outside any transaction).
pub async fn set_select_options(pools: &Pools, ctx: &RequestContext, field_id: &str, input: &[Value]) -> R<SetOptionsResult> {
    let wanted = normalize_options(input)?;
    let wanted_ref = &wanted;
    let (added, removed, sql, regenerated) = with_transaction(pools, PoolName::Ddl, ctx, TxOptions::default(), |tx| async move {
        require_on_field(&tx, ctx, Action::ManageSchema, field_id).await?;
        let row = tx
            .first(
                "SELECT f.table_id::text, f.base_id::text, f.kind,
                        cn.name AS column_name, tn.name AS table_name, sn.name AS schema_name,
                        sc.enum_constraint_id::text AS constraint_id
                   FROM _basedb.field f
                   JOIN _basedb.physical_name cn ON cn.id = f.name_id
                   JOIN _basedb.table_def t      ON t.id = f.table_id
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                   JOIN _basedb.db_schema s      ON s.id = t.schema_id
                   JOIN _basedb.physical_name sn ON sn.id = s.name_id
                   LEFT JOIN _basedb.field_select_config sc ON sc.field_id = f.id
                  WHERE f.id = $1::text::uuid AND f.is_live AND t.is_live",
                &[&field_id],
            )
            .await?;
        let Some(row) = row else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("field", json!(field_id)));
        };
        let (table_id, base_id, kind, column_name, table_name, schema_name, old_constraint): (String, String, String, String, String, String, Option<String>) =
            (row.get(0), row.get(1), row.get(2), row.get(3), row.get(4), row.get(5), row.get(6));
        if !is_choice_kind(&kind) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!("kind")).with("reason", json!("pas_une_liste_de_choix")));
        }
        let grants = load_grants(&tx, ctx).await?;
        assert_manage_schema(&tx, ctx, &grants, &base_id).await?;

        let existing = tx.rows("SELECT value, deleted_at IS NOT NULL AS archived FROM _basedb.select_option WHERE field_id = $1::text::uuid", &[&field_id]).await?;
        let mut live: indexmap::IndexSet<String> = indexmap::IndexSet::new();
        let mut archived: Vec<String> = Vec::new();
        for r in &existing {
            let (value, is_archived): (String, bool) = (r.get(0), r.get(1));
            if is_archived {
                archived.push(value);
            } else {
                live.insert(value);
            }
        }
        let wanted_values: HashSet<&str> = wanted_ref.iter().map(|o| o.value.as_str()).collect();
        let added: Vec<String> = wanted_ref.iter().filter(|o| !live.contains(&o.value)).map(|o| o.value.clone()).collect();
        let removed: Vec<String> = live.iter().filter(|v| !wanted_values.contains(v.as_str())).cloned().collect();

        let relation = qualify(&schema_name, &table_name)?;
        let column = quote_identifier(&column_name)?;

        if !removed.is_empty() {
            tx.execute_op(&format!("LOCK TABLE {relation} IN SHARE ROW EXCLUSIVE MODE"), &[], SqlOp::Ddl).await?;
            let count_sql = if kind == "select" {
                format!("SELECT {column} AS value, count(*)::int AS count FROM {relation} WHERE {column} = ANY($1::text[]) GROUP BY {column} ORDER BY 1")
            } else {
                format!(
                    "SELECT v.value, count(*)::int AS count
                       FROM {relation} CROSS JOIN LATERAL unnest({column}) AS v(value)
                      WHERE {column} && $1::text[] AND v.value = ANY($1::text[])
                      GROUP BY v.value ORDER BY 1"
                )
            };
            let used = tx.rows(&count_sql, &[&removed]).await?;
            if !used.is_empty() {
                let options: Vec<Value> = used.iter().map(|r| json!({ "value": r.get::<_, String>(0), "count": r.get::<_, i32>(1) })).collect();
                return Err(AppError::new("OPTION_IN_USE").with("field", json!(field_id)).with("options", json!(options)));
            }
            tx.execute_op(
                "DELETE FROM _basedb.select_option WHERE field_id = $1::text::uuid AND value = ANY($2::text[]) AND deleted_at IS NULL",
                &[&field_id, &removed],
                SqlOp::Delete,
            )
            .await?;
        }
        for (i, option) in wanted_ref.iter().enumerate() {
            insert_option(&tx, field_id, option, i as i32 + 1, live.contains(&option.value)).await?;
        }
        if added.is_empty() && removed.is_empty() {
            return Ok((added, removed, Vec::new(), None));
        }

        let mut values: Vec<String> = wanted_ref.iter().map(|o| o.value.clone()).collect();
        values.extend(archived);
        let name = allocate_name(
            &tx,
            ctx,
            &AllocationRequest::new(Candidate::Derived(check_constraint_name(&table_name, &column_name, "enum")), ObjectKind::Constraint, ScopeKind::Table, table_id.clone()),
        )
        .await?;
        let constraint_id = insert_constraint(&tx, ctx, &table_id, &base_id, &name.name_id, "enum", "not_valid").await?;
        insert_member(&tx, &constraint_id, field_id, &table_id).await?;
        let mut drop = String::new();
        if let Some(old) = &old_constraint {
            let r = tx.first("SELECT n.name FROM _basedb.table_constraint k JOIN _basedb.physical_name n ON n.id = k.name_id WHERE k.id = $1::text::uuid", &[old]).await?;
            let old_name: String = r.map(|r| r.get(0)).ok_or_else(|| AppError::internal("Cannot read properties of undefined (reading 'name')"))?;
            drop = format!("DROP CONSTRAINT {}, ", quote_identifier(&old_name)?);
        }
        let statement = format!("ALTER TABLE {relation} {drop}ADD CONSTRAINT {} CHECK ({}) NOT VALID;", quote_identifier(&name.name)?, choice_check(&kind, &column, &values));
        tx.execute_op(&statement, &[], SqlOp::Ddl).await?;
        tx.execute_op(
            "UPDATE _basedb.field_select_config SET enum_constraint_id = $2::text::uuid WHERE field_id = $1::text::uuid",
            &[&field_id, &constraint_id],
            SqlOp::Update,
        )
        .await?;
        if let Some(old) = &old_constraint {
            tx.execute_op("UPDATE _basedb.table_constraint SET state = 'dropped', dropped_at = clock_timestamp() WHERE id = $1::text::uuid", &[old], SqlOp::Update).await?;
        }
        Ok((added, removed, vec![statement], Some(Regenerated { relation, constraint_name: name.name, constraint_id })))
    })
    .await?;

    let mut sql = sql;
    if let Some(plan) = regenerated {
        let validate = format!("ALTER TABLE {} VALIDATE CONSTRAINT {};", plan.relation, quote_identifier(&plan.constraint_name)?);
        let conn = pools.get(PoolName::Ddl).await?;
        if let Err(e) = conn.execute_op(&validate, &[], SqlOp::Ddl).await {
            let mut refusal = AppError::new("VALIDATION_FAILED").with("field", json!(field_id)).with("reason", json!("contrainte_non_validee"));
            refusal.cause = e.cause;
            return Err(refusal);
        }
        drop(conn);
        sql.push(validate);
        let conn = pools.catalog().await?;
        conn.execute_op("UPDATE _basedb.table_constraint SET state = 'active' WHERE id = $1::text::uuid", &[&plan.constraint_id], SqlOp::Update).await?;
    }
    Ok(SetOptionsResult { options: wanted, added, removed, sql })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_are_node_s() {
        let v = vec!["a".to_string(), "l'b".to_string()];
        assert_eq!(choice_check("select", "\"c\"", &v), "\"c\" IN ('a', 'l''b')");
        assert_eq!(choice_check("multi_select", "\"c\"", &v), "cardinality(\"c\") > 0 AND array_ndims(\"c\") = 1 AND \"c\" <@ ARRAY['a', 'l''b']::text[]");
    }

    #[test]
    fn options_are_normalized() {
        let o = normalize_options(&[json!({ "value": " a ", "label": " ", "color": "#ABC" }), json!({ "value": "b", "label": "Bé", "color": 3 })]).unwrap();
        assert_eq!(o[0].to_json(), json!({ "value": "a", "label": "a", "color": "#aabbcc", "icon": null, "image": null }));
        assert_eq!(o[1].label, "Bé");
        assert_eq!(o[1].color, None);
        let reason = |v: Vec<Value>| normalize_options(&v).unwrap_err();
        assert_eq!(reason(vec![]).details["reason"], json!("liste_vide"));
        assert_eq!(reason(vec![json!("a")]).details["reason"], json!("valeur_absente"));
        assert_eq!(reason(vec![json!({ "value": "  " })]).details["reason"], json!("vide"));
        assert_eq!(reason(vec![json!({ "value": "a" }), json!({ "value": "a " })]).code, "DUPLICATE_VALUE");
        assert_eq!(reason(vec![json!({ "value": "a", "icon": "Bad Icon" })]).details, json!({ "field": "options", "reason": "icone_invalide", "option": "a" }).as_object().unwrap().clone());
        assert!(options_unreadable(&[json!({ "value": "a", "label": 3 })]));
    }
}
