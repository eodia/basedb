//! The document templates of a table — `documents/templates.ts`, chapter 21 §2.

use super::spec::{fold_spaces, normalize_spec, read_spec, Spec};
use crate::js::js_length;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::require::require_on_table;
use basedb_base::rbac::Action;
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use basedb_base::AppState;
use serde_json::{json, Map, Value};
use tokio_postgres::Row;

pub struct DocumentTemplate {
    pub id: String,
    pub label: String,
    pub spec: Option<Spec>,
    pub position: i32,
    pub updated_at: String,
}

impl DocumentTemplate {
    /// `documentTemplateJson`.
    pub fn to_json(&self) -> Value {
        let mut out = Map::new();
        out.insert("id".into(), json!(self.id));
        out.insert("label".into(), json!(self.label));
        out.insert("position".into(), json!(self.position));
        out.insert("updated_at".into(), json!(self.updated_at));
        if let Some(spec) = &self.spec {
            out.insert("spec".into(), spec.to_json());
        }
        Value::Object(out)
    }
}

const COLUMNS: &str = "id::text, label, spec::text, position, updated_at::text";

fn of_row(row: &Row, with_spec: bool) -> DocumentTemplate {
    DocumentTemplate {
        id: row.get(0),
        label: row.get(1),
        spec: with_spec.then(|| read_spec(&serde_json::from_str::<Value>(&row.get::<_, String>(2)).unwrap_or(Value::Null))),
        position: row.get(3),
        updated_at: row.get(4),
    }
}

fn checked_label(label: Option<&Value>) -> Result<String, AppError> {
    let text = label.and_then(Value::as_str).map(fold_spaces).unwrap_or_default();
    if text.is_empty() || js_length(&text) > 120 {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("label")).with("reason", json!("libelle_invalide")));
    }
    Ok(text)
}

fn user_of(ctx: &RequestContext) -> Option<String> {
    (ctx.actor.kind == ActorKind::User).then(|| ctx.actor.id.clone())
}

pub async fn list_templates(st: &AppState, ctx: &RequestContext, table_id: &str) -> Result<Vec<DocumentTemplate>, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        let table_id = table_id.to_string();
        async move {
            require_on_table(&tx, &ctx, Action::Read, &table_id).await?;
            let builds = require_on_table(&tx, &ctx, Action::ManageSchema, &table_id).await.is_ok();
            let rows = tx
                .rows(
                    &format!("SELECT {COLUMNS} FROM _basedb.document_template WHERE table_id = $1::text::uuid ORDER BY position, label"),
                    &[&table_id],
                )
                .await?;
            Ok(rows.iter().map(|r| of_row(r, builds)).collect())
        }
    })
    .await
}

pub async fn read_template<E: Exec + Sync>(exec: &E, ctx: &RequestContext, table_id: &str, id: &str) -> Result<DocumentTemplate, AppError> {
    require_on_table(exec, ctx, Action::Read, table_id).await?;
    let row = exec
        .first(
            &format!("SELECT {COLUMNS} FROM _basedb.document_template WHERE id::text = $1 AND table_id = $2::text::uuid"),
            &[&id, &table_id],
        )
        .await?;
    match row {
        Some(row) => Ok(of_row(&row, true)),
        None => Err(AppError::new("RESOURCE_NOT_FOUND").with("template", json!(id))),
    }
}

pub async fn create_template(st: &AppState, ctx: &RequestContext, table_id: &str, label: Option<Value>, spec: Option<Value>) -> Result<DocumentTemplate, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let ctx = ctx.clone();
        let table_id = table_id.to_string();
        let (label, spec) = (label.clone(), spec.clone());
        async move {
            require_on_table(&tx, &ctx, Action::ManageSchema, &table_id).await?;
            let label = checked_label(label.as_ref())?;
            let spec = normalize_spec(&tx, &table_id, spec.as_ref()).await?;
            let text = basedb_base::idempotency::js_stringify(&spec.to_json());
            let user = user_of(&ctx);
            let rows = tx
                .query_op(
                    &format!(
                        "INSERT INTO _basedb.document_template (table_id, label, spec, position, created_by, updated_by)
                         SELECT $1::text::uuid, $2, $3::text::jsonb, coalesce(max(position) + 1, 0), $4::text::uuid, $4::text::uuid
                           FROM _basedb.document_template WHERE table_id = $1::text::uuid
                         RETURNING {COLUMNS}"
                    ),
                    &[&table_id, &label, &text, &user],
                    SqlOp::Insert,
                )
                .await?;
            Ok(of_row(&rows[0], true))
        }
    })
    .await
}

pub async fn update_template(st: &AppState, ctx: &RequestContext, table_id: &str, id: &str, label: Option<Value>, spec: Option<Value>) -> Result<DocumentTemplate, AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let ctx = ctx.clone();
        let (table_id, id) = (table_id.to_string(), id.to_string());
        let (label, spec) = (label.clone(), spec.clone());
        async move {
            require_on_table(&tx, &ctx, Action::ManageSchema, &table_id).await?;
            let label = match &label {
                None => None,
                Some(l) => Some(checked_label(Some(l))?),
            };
            let spec = match &spec {
                None => None,
                Some(s) => Some(basedb_base::idempotency::js_stringify(&normalize_spec(&tx, &table_id, Some(s)).await?.to_json())),
            };
            let user = user_of(&ctx);
            let rows = tx
                .query_op(
                    &format!(
                        "UPDATE _basedb.document_template
                            SET label = coalesce($3, label), spec = coalesce($4::text::jsonb, spec),
                                updated_at = clock_timestamp(), updated_by = $5::text::uuid
                          WHERE id::text = $1 AND table_id = $2::text::uuid
                          RETURNING {COLUMNS}"
                    ),
                    &[&id, &table_id, &label, &spec, &user],
                    SqlOp::Update,
                )
                .await?;
            match rows.first() {
                Some(row) => Ok(of_row(row, true)),
                None => Err(AppError::new("RESOURCE_NOT_FOUND").with("template", json!(id))),
            }
        }
    })
    .await
}

pub async fn delete_template(st: &AppState, ctx: &RequestContext, table_id: &str, id: &str) -> Result<(), AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| {
        let ctx = ctx.clone();
        let (table_id, id) = (table_id.to_string(), id.to_string());
        async move {
            require_on_table(&tx, &ctx, Action::ManageSchema, &table_id).await?;
            let rows = tx
                .query_op(
                    "DELETE FROM _basedb.document_template WHERE id::text = $1 AND table_id = $2::text::uuid RETURNING id",
                    &[&id, &table_id],
                    SqlOp::Delete,
                )
                .await?;
            if rows.is_empty() {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("template", json!(id)));
            }
            Ok(())
        }
    })
    .await
}
