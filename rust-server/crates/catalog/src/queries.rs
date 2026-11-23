//! Saved queries — chapter 11 §1.7 (`catalog/queries.ts`): SQL questions of kind `sql`,
//! read and written through their deprecated routes.

use crate::description::normalize_description;
use crate::http::{collapse_spaces, js_len, label_key, nfc};
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::{decide, Action, Verdict};
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::{load_base_target, visible_inside};
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

pub const QUERY_AUDIENCES: [&str; 3] = ["personal", "base", "groups"];
const MAX_STATEMENT_CHARS: usize = 100_000;
const MAX_LABEL_CHARS: usize = 255;

const SQL_QUESTION: &str = "q.kind = 'sql' AND q.deleted_at IS NULL";

const SELECT: &str = "
  SELECT q.id::text, q.base_id::text, q.label, q.description, q.query->>'sql' AS statement,
         q.audience, q.created_by::text AS owner_id, u.display_name AS owner_name,
         q.updated_at::text,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id::text, 'label', r.label)
                                    ORDER BY r.label)
                     FROM _basedb.question_role qr
                     JOIN _basedb.role r ON r.id = qr.role_id AND r.deleted_at IS NULL
                    WHERE qr.question_id = q.id), '[]'::jsonb) AS groups
    FROM _basedb.question q
    JOIN _basedb.app_user u ON u.id = q.created_by";

const VISIBLE: &str = "
  (q.created_by = $2::text::uuid
   OR q.audience = 'base'
   OR (q.audience = 'groups'
       AND ($3::boolean OR EXISTS (
             SELECT 1 FROM _basedb.question_role qr
               JOIN _basedb.role_member m ON m.role_id = qr.role_id
              WHERE qr.question_id = q.id AND m.user_id = $2::text::uuid))))";

/// `SavedQuery`.
#[derive(Debug, Clone)]
pub struct SavedQuery {
    pub id: String,
    pub base_id: String,
    pub label: String,
    pub description: Option<String>,
    pub statement: String,
    pub audience: String,
    pub groups: Value,
    pub owner_id: String,
    pub owner_name: String,
    pub mine: bool,
    pub editable: bool,
    pub updated_at: String,
}

impl SavedQuery {
    fn of(r: &tokio_postgres::Row, ctx: &RequestContext, manages: bool) -> SavedQuery {
        let owner_id: String = r.get(6);
        let audience: String = r.get(5);
        let mine = owner_id == ctx.actor.id;
        SavedQuery {
            id: r.get(0),
            base_id: r.get(1),
            label: r.get(2),
            description: r.get(3),
            statement: r.get::<_, Option<String>>(4).unwrap_or_default(),
            groups: if audience == "groups" { r.get(9) } else { json!([]) },
            editable: if audience == "personal" { mine } else { manages },
            audience,
            owner_id,
            owner_name: r.get(7),
            mine,
            updated_at: r.get(8),
        }
    }

    /// `serializeQuery` of `app.ts`.
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "label": self.label,
            "description": self.description,
            "statement": self.statement,
            "audience": self.audience,
            "groups": self.groups,
            "owner": { "id": self.owner_id, "name": self.owner_name },
            "mine": self.mine,
            "editable": self.editable,
            "updated_at": self.updated_at,
        })
    }
}

/// `QueryInput`, each key as the body gave it (`None`: absent).
#[derive(Debug, Clone, Default)]
pub struct QueryInput {
    pub label: Option<Value>,
    pub description: Option<Value>,
    pub statement: Option<Value>,
    pub audience: Option<Value>,
    pub group_ids: Option<Vec<Value>>,
}

impl QueryInput {
    /// `queryInput` of `app.ts`.
    pub fn of_body(body: &Value) -> QueryInput {
        QueryInput {
            label: body.get("label").cloned(),
            description: body.get("description").cloned(),
            statement: body.get("statement").cloned(),
            audience: body.get("audience").cloned(),
            group_ids: body.get("group_ids").and_then(Value::as_array).cloned(),
        }
    }
}

/// `accessTo`: whether the caller manages a base they see; unseen, it does not exist.
pub async fn access_to<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str, users_only: bool) -> Result<bool, AppError> {
    let grants = load_grants(exec, ctx).await?;
    let target = load_base_target(exec, ctx, base_id).await?;
    let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id));
    let Some(target) = target else { return Err(not_found()) };
    if users_only && ctx.actor.kind != ActorKind::User {
        return Err(not_found());
    }
    let manages = decide(ctx, &grants, Action::ManageSchema, &target).verdict == Verdict::Allowed;
    let sees = manages || decide(ctx, &grants, Action::Read, &target).verdict == Verdict::Allowed || visible_inside(exec, ctx, &grants, &target).await?;
    if !sees {
        return Err(not_found());
    }
    Ok(manages)
}

/// `listQueries`.
pub async fn list_queries(pools: &Pools, ctx: &RequestContext, base_id: &str) -> Result<Vec<SavedQuery>, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id, true).await?;
        let rows = tx
            .rows(
                &format!(
                    "{SELECT}
                      WHERE q.base_id = $1::text::uuid AND {SQL_QUESTION} AND {VISIBLE}
                      ORDER BY q.audience = 'personal', lower(q.label), q.created_at"
                ),
                &[&base_id, &ctx.actor.id, &manages],
            )
            .await?;
        Ok(rows.iter().map(|r| SavedQuery::of(r, ctx, manages)).collect())
    })
    .await
}

/// `querySummaries`: per base, the queries the navigation lists.
pub async fn query_summaries<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_ids: &[String], managed: &HashSet<String>) -> Result<HashMap<String, Vec<Value>>, AppError> {
    let mut out: HashMap<String, Vec<Value>> = HashMap::new();
    if base_ids.is_empty() || ctx.actor.kind != ActorKind::User {
        return Ok(out);
    }
    let managed: Vec<String> = managed.iter().cloned().collect();
    let visible = VISIBLE.replace("$3::boolean", "(q.base_id = ANY($3::text[]::uuid[]))");
    let rows = exec
        .rows(
            &format!(
                "SELECT q.id::text, q.base_id::text, q.label, q.audience, q.created_by::text AS owner_id
                   FROM _basedb.question q
                  WHERE q.base_id = ANY($1::text[]::uuid[]) AND {SQL_QUESTION}
                    AND {visible}
                  ORDER BY q.audience = 'personal', lower(q.label), q.created_at"
            ),
            &[&base_ids, &ctx.actor.id, &managed],
        )
        .await?;
    for r in rows {
        let owner: String = r.get(4);
        out.entry(r.get(1)).or_default().push(json!({
            "id": r.get::<_, String>(0),
            "label": r.get::<_, String>(2),
            "audience": r.get::<_, String>(3),
            "mine": owner == ctx.actor.id,
        }));
    }
    Ok(out)
}

/// `getQuery`.
pub async fn get_query(pools: &Pools, ctx: &RequestContext, base_id: &str, query_id: &str) -> Result<SavedQuery, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id, true).await?;
        visible_row(&tx, ctx, base_id, query_id, manages).await
    })
    .await
}

/// `listQueryGroups`.
pub async fn list_query_groups(pools: &Pools, ctx: &RequestContext, base_id: &str) -> Result<Vec<Value>, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id, true).await?;
        if !manages {
            return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
        }
        let rows = tx
            .rows(
                "SELECT r.id::text, r.label FROM _basedb.role r
                   JOIN _basedb.tenant t ON t.id = r.tenant_id
                  WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
                  ORDER BY r.label",
                &[&ctx.tenant_id],
            )
            .await?;
        Ok(rows.iter().map(|r| json!({ "id": r.get::<_, String>(0), "label": r.get::<_, String>(1) })).collect())
    })
    .await
}

/// `createQuery`.
pub async fn create_query(pools: &Pools, ctx: &RequestContext, base_id: &str, input: &QueryInput) -> Result<SavedQuery, AppError> {
    let label = check_label(input.label.as_ref())?;
    let statement = check_statement(input.statement.as_ref())?;
    let description = normalize_description(input.description.as_ref(), "description")?;
    let audience = match &input.audience {
        None | Some(Value::Null) => "personal".to_string(),
        Some(v) => check_audience(v)?,
    };
    let (label, statement, description, audience) = (&label, &statement, &description, &audience);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id, true).await?;
        if audience != "personal" && !manages {
            return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
        }
        let group_ids = if audience == "groups" { check_groups(&tx, ctx, input.group_ids.as_deref()).await? } else { vec![] };
        assert_label_free(&tx, base_id, label, audience, None, &ctx.actor.id).await?;
        let query = json!({ "kind": "sql", "sql": statement }).to_string();
        let row = tx
            .query_op(
                "INSERT INTO _basedb.question
                   (base_id, label, description, kind, query, visualization, position, audience,
                    created_by, updated_by)
                 SELECT $1::text::uuid, $2::text, $3::text, 'sql', $4::text::jsonb, '{\"type\":\"table\"}'::jsonb,
                        coalesce(max(position), 0) + 1, $5::text, $6::text::uuid, $6::text::uuid
                   FROM _basedb.question WHERE base_id = $1::text::uuid AND deleted_at IS NULL
                 RETURNING id::text",
                &[&base_id, label, description, &query, audience, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let id: String = row[0].get(0);
        write_groups(&tx, &id, &group_ids).await?;
        let mut payload = Map::new();
        payload.insert("audience".into(), json!(audience));
        payload.insert("groups".into(), json!(group_ids));
        payload.insert("statement".into(), json!(statement));
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(id.clone()), object_name: Some(label.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("query.create", "question") },
        )
        .await?;
        visible_row(&tx, ctx, base_id, &id, manages).await
    })
    .await
}

/// `updateQuery`.
pub async fn update_query(pools: &Pools, ctx: &RequestContext, base_id: &str, query_id: &str, input: &QueryInput) -> Result<SavedQuery, AppError> {
    let label = match &input.label {
        None => None,
        Some(v) => Some(check_label(Some(v))?),
    };
    let statement = match &input.statement {
        None => None,
        Some(v) => Some(check_statement(Some(v))?),
    };
    let audience = match &input.audience {
        None => None,
        Some(v) => Some(check_audience(v)?),
    };
    let sets_description = input.description.is_some();
    let description = if sets_description { normalize_description(input.description.as_ref(), "description")? } else { None };
    let (label, statement, audience, description) = (&label, &statement, &audience, &description);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id, true).await?;
        let current = visible_row(&tx, ctx, base_id, query_id, manages).await?;
        if !current.editable {
            return Err(AppError::new("ADMIN_REQUIRED").with("query", json!(query_id)));
        }
        let next_audience = audience.clone().unwrap_or_else(|| current.audience.clone());
        if next_audience != current.audience && !manages {
            return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
        }
        let next_label = label.clone().unwrap_or_else(|| current.label.clone());
        if label.is_some() || next_audience != current.audience {
            assert_label_free(&tx, base_id, &next_label, &next_audience, Some(&current.id), &current.owner_id).await?;
        }
        let group_ids = if next_audience != "groups" {
            Some(vec![])
        } else if input.group_ids.is_some() || current.audience != "groups" {
            Some(check_groups(&tx, ctx, input.group_ids.as_deref()).await?)
        } else {
            None
        };
        tx.execute_op(
            "UPDATE _basedb.question
                SET label = $2::text,
                    description = CASE WHEN $3::boolean THEN $4::text ELSE description END,
                    query = CASE WHEN $5::text IS NULL THEN query
                                 ELSE jsonb_set(query, '{sql}', to_jsonb($5::text)) END,
                    audience = $6::text,
                    updated_at = pg_catalog.clock_timestamp(), updated_by = $7::text::uuid
              WHERE id = $1::text::uuid",
            &[&current.id, &next_label, &sets_description, description, statement, &next_audience, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        if let Some(ids) = &group_ids {
            tx.execute_op("DELETE FROM _basedb.question_role WHERE question_id = $1::text::uuid", &[&current.id], SqlOp::Delete).await?;
            write_groups(&tx, &current.id, ids).await?;
        }
        let mut payload = Map::new();
        payload.insert("audience".into(), json!(next_audience));
        if let Some(ids) = &group_ids {
            payload.insert("groups".into(), json!(ids));
        }
        if let Some(s) = statement {
            payload.insert("statement".into(), json!(s));
        }
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(current.id.clone()), object_name: Some(next_label.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("query.update", "question") },
        )
        .await?;
        visible_row(&tx, ctx, base_id, query_id, manages).await
    })
    .await
}

/// `deleteQuery`.
pub async fn delete_query(pools: &Pools, ctx: &RequestContext, base_id: &str, query_id: &str) -> Result<(), AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let manages = access_to(&tx, ctx, base_id, true).await?;
        let current = visible_row(&tx, ctx, base_id, query_id, manages).await?;
        if !current.editable {
            return Err(AppError::new("ADMIN_REQUIRED").with("query", json!(query_id)));
        }
        tx.execute_op("UPDATE _basedb.question SET deleted_at = pg_catalog.clock_timestamp() WHERE id = $1::text::uuid", &[&current.id], SqlOp::Update).await?;
        let mut payload = Map::new();
        payload.insert("audience".into(), json!(current.audience));
        payload.insert("statement".into(), json!(current.statement));
        write_audit(
            &tx,
            ctx,
            &AuditEntry { object_id: Some(current.id.clone()), object_name: Some(current.label.clone()), base_id: Some(base_id.to_string()), payload, ..AuditEntry::new("query.delete", "question") },
        )
        .await
    })
    .await
}

async fn visible_row<E: Exec + Sync>(exec: &E, ctx: &RequestContext, base_id: &str, query_id: &str, manages: bool) -> Result<SavedQuery, AppError> {
    let row = exec
        .first(
            &format!("{SELECT}\n WHERE q.id::text = $4 AND q.base_id = $1::text::uuid AND {SQL_QUESTION} AND {VISIBLE}"),
            &[&base_id, &ctx.actor.id, &manages, &query_id],
        )
        .await?;
    match row {
        Some(r) => Ok(SavedQuery::of(&r, ctx, manages)),
        None => Err(AppError::new("RESOURCE_NOT_FOUND").with("query", json!(query_id))),
    }
}

pub(crate) async fn write_groups<E: Exec + Sync>(exec: &E, query_id: &str, group_ids: &[String]) -> Result<(), AppError> {
    if group_ids.is_empty() {
        return Ok(());
    }
    exec.execute_op(
        "INSERT INTO _basedb.question_role (question_id, role_id)
         SELECT $1::text::uuid, g::uuid FROM unnest($2::text[]) AS g
         ON CONFLICT DO NOTHING",
        &[&query_id, &group_ids],
        SqlOp::Insert,
    )
    .await?;
    Ok(())
}

pub(crate) async fn check_groups<E: Exec + Sync>(exec: &E, ctx: &RequestContext, raw: Option<&[Value]>) -> Result<Vec<String>, AppError> {
    let mut asked: Vec<String> = Vec::new();
    for g in raw.unwrap_or(&[]) {
        if let Some(s) = g.as_str() {
            if !s.is_empty() && !asked.iter().any(|a| a == s) {
                asked.push(s.to_string());
            }
        }
    }
    if asked.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("groups")).with("reason", json!("aucun")));
    }
    let found = exec
        .rows(
            "SELECT r.id::text FROM _basedb.role r
               JOIN _basedb.tenant t ON t.id = r.tenant_id
              WHERE t.ref = $1 AND r.kind = 'group' AND r.deleted_at IS NULL
                AND r.id::text = ANY($2::text[])",
            &[&ctx.tenant_id, &asked],
        )
        .await?;
    if found.len() != asked.len() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("groups")).with("reason", json!("inconnu")));
    }
    Ok(found.iter().map(|r| r.get(0)).collect())
}

async fn assert_label_free<E: Exec + Sync>(exec: &E, base_id: &str, label: &str, audience: &str, except: Option<&str>, owner: &str) -> Result<(), AppError> {
    let same = exec
        .rows(
            &format!(
                "SELECT q.label FROM _basedb.question q
                  WHERE q.base_id = $1::text::uuid AND {SQL_QUESTION}
                    AND ($2::text::uuid IS NULL OR q.id <> $2::text::uuid)
                    AND CASE WHEN $3 = 'personal' THEN q.audience = 'personal' AND q.created_by = $4::text::uuid
                             ELSE q.audience <> 'personal' END"
            ),
            &[&base_id, &except, &audience, &owner],
        )
        .await?;
    let key = label_key(label);
    if same.iter().any(|r| label_key(&r.get::<_, String>(0)) == key) {
        return Err(AppError::new("LABEL_DUPLICATE").with("label", json!(label)));
    }
    Ok(())
}

/// `checkLabel` of queries and SQL views: text, NFC, spaces collapsed, â‰¤ 255 characters.
pub fn check_label(value: Option<&Value>) -> Result<String, AppError> {
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

fn check_statement(value: Option<&Value>) -> Result<String, AppError> {
    let statement = match value {
        Some(Value::String(s)) => crate::description::js_trim(s).to_string(),
        _ => String::new(),
    };
    if statement.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("statement")).with("reason", json!("vide")));
    }
    if js_len(&statement) > MAX_STATEMENT_CHARS || statement.contains('\0') {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("statement")).with("reason", json!("invalide")));
    }
    Ok(statement)
}

fn check_audience(value: &Value) -> Result<String, AppError> {
    match value.as_str() {
        Some(a) if QUERY_AUDIENCES.contains(&a) => Ok(a.to_string()),
        _ => Err(AppError::new("REQUEST_INVALID").with("field", json!("audience"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_what_a_query_is_given() {
        assert_eq!(check_label(Some(&json!("  Mes   relances "))).unwrap(), "Mes relances");
        assert_eq!(check_label(Some(&json!(3))).unwrap_err().code, "LABEL_EMPTY");
        assert_eq!(check_label(None).unwrap_err().code, "LABEL_EMPTY");
        assert_eq!(check_label(Some(&json!("x".repeat(256)))).unwrap_err().code, "LABEL_TOO_LONG");
        assert_eq!(check_statement(Some(&json!("  select 1 "))).unwrap(), "select 1");
        assert_eq!(check_statement(Some(&json!(" "))).unwrap_err().details["reason"], json!("vide"));
        assert_eq!(check_statement(Some(&json!("a\0"))).unwrap_err().details["reason"], json!("invalide"));
        assert_eq!(check_audience(&json!("groups")).unwrap(), "groups");
        assert_eq!(check_audience(&json!("tous")).unwrap_err().details["field"], json!("audience"));
    }
}
