//! `ai/draft.ts`: the two drafts — a filter expression for one table, a structure for a base.

use crate::language::in_language;
use crate::prompts;
use crate::provider::{assert_quota, invoke, resolve_provider, InvokeOptions, ProviderConfig, Usage};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::ScopeKind;
use basedb_base::rbac::{decide, load_grants, load_target, Action, Verdict};
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use basedb_base::AppState;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

/// `draftExpression`: the permission checked is reading the table; the fields sent are the
/// ones the reader's mask lets them read.
pub async fn draft_expression(st: &AppState, ctx: &RequestContext, table_id: &str, request: &str, previous_error: Option<&Value>) -> Result<Value, AppError> {
    struct Prepared {
        label: String,
        base_id: String,
        fields: Vec<(String, String, String, bool)>,
        config: ProviderConfig,
    }
    let prepared = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        let table_id = table_id.to_string();
        async move {
            let grants = load_grants(&tx, &ctx).await?;
            let Some(target) = load_target(&tx, &ctx, &table_id).await? else {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
            };
            let decision = decide(&ctx, &grants, Action::Read, &target);
            if decision.verdict != Verdict::Allowed {
                let code = if decision.verdict == Verdict::Invisible { "RESOURCE_NOT_FOUND" } else { "ADMIN_REQUIRED" };
                return Err(AppError::new(code).with("table", json!(table_id)));
            }
            let Some(table) = tx.first("SELECT label, base_id::text FROM _basedb.table_def WHERE id = $1::text::uuid", &[&table_id]).await? else {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
            };
            let rows = tx
                .rows(
                    "SELECT f.id::text, n.name, f.label, f.kind, f.is_required
                       FROM _basedb.field f
                       JOIN _basedb.physical_name n ON n.id = f.name_id
                      WHERE f.table_id = $1::text::uuid AND f.deleted_at IS NULL AND f.expose_to_agents
                      ORDER BY f.position",
                    &[&table_id],
                )
                .await?;
            let fields = rows
                .iter()
                .filter(|r| decision.readable_fields.contains(&r.get::<_, String>(0)))
                .map(|r| (r.get(1), r.get(2), r.get(3), r.get(4)))
                .collect();
            let config = resolve_provider(&tx, &ctx, &st.cfg).await?;
            assert_quota(&tx, &ctx, &st.cfg, Usage::ExpressionDraft).await?;
            Ok(Prepared { label: table.get(0), base_id: table.get(1), fields, config })
        }
    })
    .await?;

    let mut payload = Map::new();
    payload.insert("intent".into(), json!("expression_draft"));
    payload.insert("table_label".into(), json!(prepared.label));
    payload.insert(
        "fields".into(),
        Value::Array(prepared.fields.iter().map(|(name, label, kind, required)| json!({ "name": name, "label": label, "kind": kind, "required": required })).collect()),
    );
    payload.insert("request".into(), json!(request));
    if let Some(previous) = previous_error {
        payload.insert("previous_error".into(), previous.clone());
    }
    let answer = invoke(
        st,
        ctx,
        &prepared.config,
        Usage::ExpressionDraft,
        Some(&prepared.base_id),
        &Value::Object(payload),
        prompts::expression_schema(),
        prompts::EXPRESSION_SYSTEM,
        InvokeOptions::default(),
    )
    .await?;
    let filter = answer.get("filter").and_then(Value::as_str).unwrap_or("").to_string();
    let sort = answer.get("sort").and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string);
    let explanation = answer.get("explanation").and_then(Value::as_str).unwrap_or("").to_string();
    let known: HashSet<&str> = prepared.fields.iter().map(|f| f.0.as_str()).collect();
    for name in names_in(&filter) {
        let head = name.split('.').next().unwrap_or(&name).to_string();
        if !known.contains(head.as_str()) {
            return Err(AppError::new("AI_RESPONSE_UNUSABLE").with("reason", json!("champ inconnu dans la proposition")).with("field", json!(head)));
        }
    }
    Ok(json!({ "filter": filter, "sort": sort, "explanation": explanation }))
}

/// `namesIn`: the field names a filter mentions, strings removed first.
pub fn names_in(filter: &str) -> Vec<String> {
    static STRINGS: OnceLock<Regex> = OnceLock::new();
    static WORDS: OnceLock<Regex> = OnceLock::new();
    let strings = STRINGS.get_or_init(|| Regex::new(r#""(?:[^"\\]|\\[^\n\r\u{2028}\u{2029}])*""#).unwrap());
    let words = WORDS.get_or_init(|| Regex::new(r"[_a-zA-Z][_a-zA-Z0-9.]*").unwrap());
    const KEYWORDS: [&str; 18] =
        ["and", "or", "not", "eq", "ne", "eq_ci", "contains", "starts_with", "ends_with", "in", "is_null", "gt", "gte", "lt", "lte", "between", "true", "false"];
    let without = strings.replace_all(filter, "\"\"");
    let mut names = vec![];
    let mut expect_field = true;
    for m in words.find_iter(&without) {
        let word = m.as_str();
        let lower = word.to_lowercase();
        if KEYWORDS.contains(&lower.as_str()) {
            expect_field = matches!(lower.as_str(), "and" | "or" | "not");
            continue;
        }
        if expect_field {
            names.push(word.to_string());
        }
        expect_field = false;
    }
    names
}

/// `draftStructure`: demands `manage_schema` on the base (or the tenant).
pub async fn draft_structure(st: &AppState, ctx: &RequestContext, base_id: &str, request: &str, language: &str) -> Result<Value, AppError> {
    struct Prepared {
        label: String,
        tables: Vec<(String, String)>,
        fields: Vec<(String, String, String, bool, Option<String>)>,
        config: ProviderConfig,
    }
    let prepared = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let ctx = ctx.clone();
        let base_id = base_id.to_string();
        async move {
            let grants = load_grants(&tx, &ctx).await?;
            let allowed = grants.is_instance_admin
                || grants.roles.iter().any(|role| {
                    role.permissions.iter().any(|p| p.action == Action::ManageSchema && (p.scope_kind == ScopeKind::Tenant || p.scope_id == base_id))
                });
            if !allowed {
                return Err(AppError::new("ADMIN_REQUIRED").with("base", json!(base_id)));
            }
            let Some(base) = tx.first("SELECT label FROM _basedb.base WHERE id = $1::text::uuid AND deleted_at IS NULL", &[&base_id]).await? else {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)));
            };
            let tables = tx
                .rows("SELECT id::text, label FROM _basedb.table_def WHERE base_id = $1::text::uuid AND deleted_at IS NULL ORDER BY position", &[&base_id])
                .await?
                .iter()
                .map(|r| (r.get(0), r.get(1)))
                .collect();
            let fields = tx
                .rows(
                    "SELECT f.table_id::text, f.label, f.kind, f.is_required, lc.target_table_id::text
                       FROM _basedb.field f
                       LEFT JOIN _basedb.field_link_config lc ON lc.field_id = f.id
                      WHERE f.base_id = $1::text::uuid AND f.deleted_at IS NULL AND f.expose_to_agents
                      ORDER BY f.position",
                    &[&base_id],
                )
                .await?
                .iter()
                .map(|r| (r.get(0), r.get(1), r.get(2), r.get(3), r.get(4)))
                .collect();
            let config = resolve_provider(&tx, &ctx, &st.cfg).await?;
            assert_quota(&tx, &ctx, &st.cfg, Usage::StructureDraft).await?;
            Ok(Prepared { label: base.get(0), tables, fields, config })
        }
    })
    .await?;

    let ordinal_of: HashMap<&str, String> = prepared.tables.iter().enumerate().map(|(i, t)| (t.0.as_str(), format!("t{}", i + 1))).collect();
    let tables: Vec<Value> = prepared
        .tables
        .iter()
        .map(|(id, label)| {
            let fields: Vec<Value> = prepared
                .fields
                .iter()
                .filter(|f| &f.0 == id)
                .map(|(_, label, kind, required, target)| {
                    let mut f = Map::new();
                    f.insert("label".into(), json!(label));
                    f.insert("kind".into(), json!(kind));
                    f.insert("required".into(), json!(required));
                    if let Some(target) = target {
                        f.insert("target".into(), json!(ordinal_of.get(target.as_str())));
                    }
                    Value::Object(f)
                })
                .collect();
            json!({ "ref": ordinal_of[id.as_str()], "label": label, "fields": fields })
        })
        .collect();
    let payload = json!({ "intent": "structure_draft", "base_label": prepared.label, "tables": tables, "request": request });
    let system = in_language(prompts::STRUCTURE_SYSTEM, Some(language));
    let answer = invoke(st, ctx, &prepared.config, Usage::StructureDraft, Some(base_id), &payload, prompts::structure_schema(), &system, InvokeOptions::default()).await?;

    let by_ordinal: HashMap<&str, &str> = ordinal_of.iter().map(|(id, r)| (r.as_str(), *id)).collect();
    let label_of: HashMap<&str, &str> = prepared.tables.iter().map(|(id, l)| (id.as_str(), l.as_str())).collect();
    let drafted = answer.get("tables").and_then(Value::as_array).cloned().unwrap_or_default();
    let tables: Vec<Value> = drafted
        .iter()
        .map(|table| {
            let fields: Vec<Value> = table
                .get("fields")
                .and_then(Value::as_array)
                .map(|fields| {
                    fields
                        .iter()
                        .map(|field| {
                            let reference = field.get("target").and_then(Value::as_str);
                            let target_id = reference.and_then(|r| by_ordinal.get(r).copied());
                            let local = match (reference, target_id) {
                                (Some(r), None) => drafted.iter().find(|t| t.get("ref").and_then(Value::as_str) == Some(r)),
                                _ => None,
                            };
                            let target = match (target_id, local) {
                                (Some(id), _) => label_of.get(id).map(|l| json!(l)).unwrap_or(Value::Null),
                                (None, Some(t)) => json!(js_label(t.get("label"), "")),
                                _ => Value::Null,
                            };
                            json!({
                                "label": js_label(field.get("label"), ""),
                                "kind": js_label(field.get("kind"), "short_text"),
                                "required": field.get("required") == Some(&Value::Bool(true)),
                                "target": target,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            json!({ "label": js_label(table.get("label"), ""), "fields": fields })
        })
        .collect();
    let explanation = answer.get("explanation").and_then(Value::as_str).unwrap_or("");
    Ok(json!({ "tables": tables, "explanation": explanation }))
}

/// `String(x ?? fallback)`.
fn js_label(v: Option<&Value>, fallback: &str) -> String {
    match v {
        None | Some(Value::Null) => fallback.to_string(),
        other => crate::js::js_string(other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_of_a_filter() {
        assert_eq!(names_in(r#"statut eq "montant gt 3" and not client.nom contains "x""#), ["statut", "client.nom"]);
        assert_eq!(names_in("prix gt 3 or quantite between 1 and 2"), ["prix", "quantite"]);
        assert_eq!(names_in("A IS_NULL"), ["A"]);
    }
}
