//! Structure proposals (`proposals/index.ts`, chapter 09 §7): an agent never changes a
//! structure, it PROPOSES, and a person approves. A proposal is a `_basedb.migration` row
//! with `origin = 'mcp'`; at approval every check is made again and the request is carried
//! out by the catalog's ordinary operations, in the name of the person the token speaks for.
//!
//! The `agent_propose_*` and `agent_get_proposal` functions serve the MCP surface; the
//! review queue (`list`, `approve`, `reject`) is also served over REST here.

use crate::agent::view::{agent_view, logical_name, resolve_agent_base, resolve_agent_table, text_of};
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::Extension;
use basedb_admin::common::{js_trim, nfc};
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{json_ok, ApiResult, AppError, SqlOp};
use basedb_base::idempotency::js_stringify;
use basedb_base::layers::RequestId;
use basedb_base::rbac::{decide, load_grants, require_on_base, Action, Target, TargetKind, Verdict};
use basedb_base::time::{iso, sha256};
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_catalog::description::normalize_description;
use basedb_catalog::fields::{add_field, create_link_field, AddFieldRequest, CreateLinkRequest};
use basedb_catalog::http::{normalize_look, LookInput};
use basedb_catalog::naming::{qualify, quote_identifier, slugify, SlugNature, MAX_FIELD_NAME_BYTES, MAX_TABLE_NAME_BYTES};
use basedb_catalog::operations::{create_table, pg_type_of, update_table};
use basedb_catalog::projection::resolve_base;
use basedb_catalog::select_options::set_select_options;
use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

/// `PROPOSAL_LIFETIME_MS`: a proposal nobody decided on after a day no longer describes the base.
pub const PROPOSAL_LIFETIME_SECONDS: i64 = 24 * 3600;
/// `MAX_OPEN_PROPOSALS`, per token and per base.
pub const MAX_OPEN_PROPOSALS: usize = 5;
const PLANNER_VERSION: i32 = 1;
const LIFETIME: &str = "86400 seconds";

const PLAIN_KINDS: [&str; 8] = ["short_text", "long_text", "number", "boolean", "date", "datetime", "url", "email"];
const CHOICE_KINDS: [&str; 2] = ["select", "multi_select"];

/// `LOOK_ICONS` (`@basedb/contracts` `look.ts`): the pictograms the application draws.
pub const LOOK_ICONS: &[&str] = &[
    "circle", "circle-check", "circle-x", "circle-alert", "circle-help", "circle-dot", "circle-dashed", "circle-pause", "circle-play", "circle-stop",
    "circle-dollar-sign", "circle-user", "check", "check-check", "x", "plus", "minus", "clock", "hourglass", "timer", "calendar", "calendar-check",
    "calendar-clock", "flag", "bookmark", "star", "heart", "flame", "zap", "bell", "bell-off", "triangle-alert", "octagon-alert", "info", "shield",
    "shield-check", "shield-alert", "lock", "lock-open", "eye", "eye-off", "thumbs-up", "thumbs-down", "smile", "frown", "meh", "angry", "laugh",
    "user", "users", "user-check", "building", "building-2", "briefcase", "house", "mail", "phone", "message-square", "send", "inbox", "archive",
    "trash-2", "pencil", "file", "file-text", "file-check", "folder", "tag", "tags", "hash", "link", "paperclip", "package", "truck",
    "shopping-cart", "credit-card", "euro", "dollar-sign", "banknote", "wallet", "receipt", "percent", "trending-up", "trending-down",
    "chart-line", "chart-bar", "chart-pie", "rocket", "target", "trophy", "crown", "gift", "lightbulb", "wrench", "settings", "bug", "code",
    "terminal", "database", "server", "cloud", "globe", "map-pin", "sun", "moon", "snowflake", "leaf", "droplet", "coffee", "music", "camera",
    "image", "play", "pause", "square", "ban", "arrow-up", "arrow-down", "arrow-right", "refresh-cw", "loader", "sparkles", "wand", "sticker",
    "award", "medal", "gem", "handshake", "megaphone", "siren", "hammer", "key", "fingerprint", "pin", "pin-off", "filter", "funnel",
    "list-checks", "list-todo", "clipboard-check", "clipboard-list", "search", "flag-triangle-right", "thermometer", "wifi", "battery", "plug",
    "power", "cpu", "hard-drive", "smartphone", "monitor", "printer",
];

/// `isLookIcon`.
pub fn is_look_icon(name: &str) -> bool {
    LOOK_ICONS.contains(&name)
}

/// One proposal, as the agent and the review screen read it.
#[derive(Debug, Clone)]
pub struct Proposal {
    pub id: String,
    pub status: String,
    /// `{id, name, label}`.
    pub base: Value,
    pub requested_at: String,
    pub expires_at: String,
    pub requested_by: Value,
    pub token: Value,
    pub summary_template: String,
    pub summary_params: Value,
    pub affected_objects: Value,
    pub up_sql: Value,
    pub down_sql: Value,
    pub decided_by: Value,
    pub decided_at: Value,
    pub error: Option<String>,
}

impl Proposal {
    /// app.ts's `serializeProposal`.
    pub fn to_rest(&self) -> Value {
        json!({
            "id": self.id,
            "status": self.status,
            "base": self.base,
            "requested_at": self.requested_at,
            "expires_at": self.expires_at,
            "requested_by": self.requested_by,
            "token": self.token,
            "summary_template": self.summary_template,
            "summary_params": self.summary_params,
            "affected_objects": self.affected_objects,
            "up_sql": self.up_sql,
            "down_sql": self.down_sql,
            "decided_by": self.decided_by,
            "decided_at": self.decided_at,
            "error": self.error,
        })
    }
}

fn user_data(value: Value) -> Value {
    json!({ "value": value, "provenance": "user_data" })
}

fn invalid(field: impl Into<String>) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field.into()))
}

/// `checkLabel`.
fn check_label(label: Option<&Value>, field: &str) -> Result<String, AppError> {
    let text = label.and_then(Value::as_str).map(|l| js_trim(&nfc(l)).to_string()).unwrap_or_default();
    if text.is_empty() {
        return Err(AppError::new("LABEL_EMPTY").with("field", json!(field)));
    }
    if text.chars().count() > 255 {
        return Err(AppError::new("LABEL_TOO_LONG").with("field", json!(field)).with("maximum", json!(255)));
    }
    Ok(text)
}

/// `checkLook` on a colour and a pictogram (`None` = left out): only the keys given.
fn check_look(color: Option<&Value>, icon: Option<&Value>, path: &str) -> Result<Option<Map<String, Value>>, AppError> {
    let mut out = Map::new();
    if let Some(c) = color {
        if !c.is_null() && !c.is_string() {
            return Err(invalid(format!("{path}.color")));
        }
        let field = format!("{path}.color");
        let look = normalize_look(&LookInput { color: Some(c.as_str().map(String::from)), icon: None, image: None }, |reason| {
            AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!(reason))
        })?;
        out.insert("color".into(), json!(look.color));
    }
    if let Some(i) = icon {
        let icon = match i {
            Value::String(s) => Value::String(js_trim(s).to_string()),
            other => other.clone(),
        };
        let blank = icon.as_str() == Some("");
        if !icon.is_null() && !blank && !icon.as_str().is_some_and(is_look_icon) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!(format!("{path}.icon"))).with("reason", json!("icone_inconnue")));
        }
        out.insert("icon".into(), if blank { Value::Null } else { icon });
    }
    Ok((!out.is_empty()).then_some(out))
}

/// `checkLook` on a raw `look` argument.
fn check_look_value(raw: Option<&Value>, path: &str) -> Result<Option<Map<String, Value>>, AppError> {
    match raw {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Object(m)) => check_look(m.get("color"), m.get("icon"), path),
        Some(Value::Array(_)) => Ok(None),
        Some(_) => Err(invalid(path)),
    }
}

/// `lookParam`.
fn look_param(look: &Map<String, Value>) -> Value {
    let mut m = look.clone();
    m.insert("provenance".into(), json!("system"));
    Value::Object(m)
}

/// `checkField`.
fn check_field(field: &Value, path: &str, allow_choices: bool) -> Result<Value, AppError> {
    let label = check_label(field.get("label"), &format!("{path}.label"))?;
    let kind = field.get("kind").and_then(Value::as_str).unwrap_or("");
    let allowed = PLAIN_KINDS.contains(&kind) || (allow_choices && CHOICE_KINDS.contains(&kind));
    if !allowed {
        return Err(invalid(format!("{path}.kind")));
    }
    let description = normalize_description(field.get("description"), &format!("{path}.description"))?;
    let raw_options = match field.get("options") {
        None | Some(Value::Null) => None,
        Some(Value::Array(a)) => Some(a),
        Some(_) => return Err(invalid(format!("{path}.options"))),
    };
    if CHOICE_KINDS.contains(&kind) && raw_options.is_none_or(|o| o.is_empty()) {
        return Err(invalid(format!("{path}.options")));
    }
    let mut out = Map::new();
    out.insert("label".into(), json!(label));
    out.insert("kind".into(), json!(kind));
    out.insert("description".into(), json!(description));
    out.insert("required".into(), json!(field.get("required") == Some(&Value::Bool(true))));
    if let Some(options) = raw_options {
        let mut list = Vec::new();
        for (i, o) in options.iter().enumerate() {
            let look = check_look(o.get("color"), o.get("icon"), &format!("{path}.options[{i}]"))?;
            let mut m = Map::new();
            if let Some(v) = o.get("value") {
                m.insert("value".into(), v.clone());
            }
            if let Some(l) = o.get("label") {
                m.insert("label".into(), l.clone());
            }
            if let Some(look) = look {
                m.extend(look);
            }
            list.push(Value::Object(m));
        }
        out.insert("options".into(), Value::Array(list));
    }
    Ok(Value::Object(out))
}

/// `candidate`: the column name a label would get — the registry has the last word.
fn candidate(label: &str, table: bool) -> String {
    if table {
        slugify(label, MAX_TABLE_NAME_BYTES, SlugNature::Table).slug
    } else {
        slugify(label, MAX_FIELD_NAME_BYTES, SlugNature::Champ).slug
    }
}

/// `personOf`: the user context of the person a token speaks for.
fn person_of(ctx: &RequestContext, user_id: &str) -> RequestContext {
    RequestContext::new(ctx.request_id.clone(), Actor::user(user_id), ctx.tenant_id.clone(), Surface::Ui)
}

/// `assertPersonManages`: `manage_schema` on the base, for that person — or `code`.
async fn assert_person_manages<E: Exec + Sync>(exec: &E, person: &RequestContext, base_id: &str, code: &'static str) -> Result<(), AppError> {
    let Some(base) = exec.first("SELECT id::text, project_id::text, mcp_enabled FROM _basedb.base WHERE id = $1::text::uuid AND is_live", &[&base_id]).await? else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("base", json!(base_id)));
    };
    let grants = load_grants(exec, person).await?;
    let mut target = Target::new(TargetKind::Base, base.get::<_, String>(0), Some(person.tenant_id.clone()));
    target.project_id = Some(base.get(1));
    target.base_id = Some(base.get(0));
    target.agents_excluded = !base.get::<_, bool>(2);
    if decide(person, &grants, Action::ManageSchema, &target).verdict != Verdict::Allowed {
        return Err(AppError::new(code).with("base", json!(base_id)).with("action", json!("manage_schema")));
    }
    Ok(())
}

/// `assertTokenWrites`: a read-only token proposes nothing.
async fn assert_token_writes<E: Exec + Sync>(exec: &E, ctx: &RequestContext) -> Result<(), AppError> {
    let Some(token) = &ctx.actor.token_id else { return Ok(()) };
    let row = exec
        .first(
            "SELECT EXISTS (
               SELECT 1 FROM _basedb.api_token tk
                 JOIN _basedb.permission p ON p.role_id = tk.role_id
                WHERE tk.id = $1::text::uuid AND p.action IN ('create', 'update')) AS writes",
            &[token],
        )
        .await?;
    if !row.is_some_and(|r| r.get::<_, bool>(0)) {
        return Err(AppError::new("TOKEN_READ_ONLY").with("object", Value::Null));
    }
    Ok(())
}

struct Preview {
    label: String,
    summary_template: &'static str,
    summary_params: Value,
    affected_objects: Value,
    up_sql: Vec<String>,
    down_sql: Vec<String>,
    object_key: String,
}

/// `insertProposal`: superseding an open one of the same token on the same objects.
async fn insert_proposal<E: Exec + Sync>(exec: &E, ctx: &RequestContext, request: &Value, preview: &Preview) -> Result<String, AppError> {
    let token_id = ctx.actor.token_id.clone();
    let base_id = text_of(request.get("baseId"));
    let version: Option<String> = exec.first("SELECT catalog_version::text FROM _basedb.base WHERE id = $1::text::uuid", &[&base_id]).await?.map(|r| r.get(0));
    exec.execute_op(
        "UPDATE _basedb.migration SET status = 'expired'
          WHERE origin = 'mcp' AND status = 'proposed'
            AND requested_at < clock_timestamp() - $1::text::interval",
        &[&LIFETIME],
        SqlOp::Update,
    )
    .await?;
    let open = exec
        .rows(
            "SELECT id::text, catalog_diff->>'object_key' AS object_key
               FROM _basedb.migration
              WHERE origin = 'mcp' AND status = 'proposed' AND base_id = $1::text::uuid
                AND catalog_diff->>'token_id' IS NOT DISTINCT FROM $2::text",
            &[&base_id, &token_id],
        )
        .await?;
    let replaced: Option<String> = open.iter().find(|o| o.get::<_, Option<String>>(1).as_deref() == Some(preview.object_key.as_str())).map(|o| o.get(0));
    if replaced.is_none() && open.len() >= MAX_OPEN_PROPOSALS {
        return Err(AppError::new("TOO_MANY_OPEN_PROPOSALS").with("maximum", json!(MAX_OPEN_PROPOSALS)));
    }
    let catalog_diff = json!({
        "operation": request.get("operation"),
        "request": request,
        "catalog_version": version,
        "token_id": token_id,
        "object_key": preview.object_key,
        "summary_template": preview.summary_template,
        "summary_params": preview.summary_params,
    });
    let checksum = sha256(js_stringify(&json!({ "catalogDiff": catalog_diff, "upSql": preview.up_sql })).as_bytes());
    let id = uuid::Uuid::new_v4().to_string();
    exec.execute_op(
        "INSERT INTO _basedb.migration
           (id, base_id, label, origin, status, planner_version, up_sql, down_sql, checksum,
            catalog_diff, affected_objects, requested_by)
         VALUES ($1::text::uuid, $2::text::uuid, $3, 'mcp', 'proposed', $4, $5::text::jsonb, $6::text::jsonb, $7,
                 $8::text::jsonb, $9::text::jsonb, $10::text::uuid)",
        &[
            &id,
            &base_id,
            &preview.label,
            &PLANNER_VERSION,
            &js_stringify(&json!(preview.up_sql)),
            &js_stringify(&json!(preview.down_sql)),
            &checksum,
            &js_stringify(&catalog_diff),
            &js_stringify(&preview.affected_objects),
            &ctx.actor.id,
        ],
        SqlOp::Insert,
    )
    .await?;
    if let Some(replaced) = &replaced {
        exec.execute_op(
            "UPDATE _basedb.migration SET status = 'superseded', superseded_by_id = $2::text::uuid WHERE id = $1::text::uuid",
            &[replaced, &id],
            SqlOp::Update,
        )
        .await?;
    }
    let mut entry = AuditEntry::new("proposal.create", "migration");
    entry.object_id = Some(id.clone());
    entry.object_name = Some(preview.label.clone());
    entry.payload.insert("operation".into(), request.get("operation").cloned().unwrap_or(Value::Null));
    write_audit(exec, ctx, &entry).await?;
    Ok(id)
}

fn plural(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n > 1 { many } else { one })
}

/// `agentProposeCreateTable` — `propose_create_table`: a table and its first fields.
pub async fn agent_propose_create_table(pools: &Pools, ctx: &RequestContext, request: &Value) -> Result<Proposal, AppError> {
    let view = agent_view(pools, ctx).await?;
    let base = resolve_agent_base(&view, text_of(request.get("base")))?;
    let label = check_label(request.get("label"), "label")?;
    let look = check_look_value(request.get("look"), "look")?;
    let description = normalize_description(request.get("description"), "description")?;
    let raw_fields = match request.get("fields") {
        Some(Value::Array(a)) if !a.is_empty() => a,
        _ => return Err(invalid("fields")),
    };
    let fields = raw_fields.iter().enumerate().map(|(i, f)| check_field(f, &format!("fields[{i}]"), false)).collect::<Result<Vec<_>, _>>()?;
    let table = candidate(&label, true);
    let mut columns = Vec::new();
    for f in &fields {
        let column = quote_identifier(&candidate(text_of(f.get("label")), false))?;
        columns.push(format!("  {column} {}", pg_type_of(text_of(f.get("kind")))?));
    }
    let qualified = qualify(&base.row.schema_name, &table)?;
    let mut req = Map::new();
    req.insert("operation".into(), json!("create_table"));
    req.insert("baseId".into(), json!(base.row.id));
    req.insert("label".into(), json!(label));
    req.insert("description".into(), json!(description));
    req.insert("fields".into(), json!(fields));
    let mut params = Map::new();
    params.insert("table_label".into(), user_data(json!(label)));
    params.insert("table_description".into(), user_data(json!(description)));
    if let Some(look) = &look {
        req.insert("look".into(), Value::Object(look.clone()));
        params.insert("look".into(), look_param(look));
    }
    params.insert(
        "fields".into(),
        json!(fields
            .iter()
            .map(|f| json!({ "label": user_data(f["label"].clone()), "kind": { "value": f["kind"], "provenance": "system" }, "description": user_data(f["description"].clone()) }))
            .collect::<Vec<_>>()),
    );
    let preview = Preview {
        label: format!("Création de la table « {label} »"),
        summary_template: "create_table",
        summary_params: Value::Object(params),
        affected_objects: json!([{
            "role": "created",
            "kind": "table",
            "physical": table,
            "effects": [
                format!("création de la table {table}, avec {} et les cinq colonnes système", plural(fields.len(), "champ", "champs")),
                "aucune table existante n’est touchée",
            ],
        }]),
        up_sql: vec![format!("CREATE TABLE {qualified} (\n  \"_id\" uuid PRIMARY KEY,\n{}\n)", columns.join(",\n"))],
        down_sql: vec![format!("DROP TABLE {qualified} RESTRICT")],
        object_key: format!("create_table:{}", label.to_lowercase()),
    };
    let request = Value::Object(req);
    let base_id = base.row.id.clone();
    let (request, preview, base_id) = (&request, &preview, &base_id);
    let id = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        assert_token_writes(&tx, ctx).await?;
        assert_person_manages(&tx, &person_of(ctx, &ctx.actor.id), base_id, "PERMISSION_DENIED").await?;
        insert_proposal(&tx, ctx, request, preview).await
    })
    .await?;
    agent_get_proposal(pools, ctx, &id).await
}

/// `agentProposeAddField` — `propose_add_field`: a column, a list of choices, or a link.
pub async fn agent_propose_add_field(pools: &Pools, ctx: &RequestContext, request: &Value) -> Result<Proposal, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (base, table) = resolve_agent_table(&view, text_of(request.get("base")), text_of(request.get("table")))?;
    let label = check_label(request.get("label"), "label")?;
    let description = normalize_description(request.get("description"), "description")?;
    let at = qualify(&base.row.schema_name, &table.row.table_name)?;
    let person = person_of(ctx, &ctx.actor.id);

    if request.get("kind").and_then(Value::as_str) == Some("link") {
        let on_delete_raw = request.get("onDelete").and_then(Value::as_str);
        // Resolved inside the transaction, after the token and the person, as in Node.
        let target_ref = request.get("target");
        let resolve = || -> Result<(String, String, String, String), AppError> {
            if on_delete_raw == Some("cascade") {
                return Err(AppError::new("MCP_CASCADE_FORBIDDEN"));
            }
            let Some(target_ref) = target_ref.and_then(Value::as_str) else { return Err(invalid("target")) };
            let target = view.table_by_id(target_ref).map(|(_, t)| t).or_else(|| base.tables.iter().find(|t| t.row.table_name == target_ref));
            let Some(target) = target else {
                let elsewhere = view.bases.iter().any(|b| b.tables.iter().any(|t| t.row.table_name == target_ref || t.row.id == target_ref));
                if elsewhere {
                    return Err(AppError::new("LINK_CROSS_DATABASE"));
                }
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("param", json!("target")));
            };
            if target.row.base_id != base.row.id {
                return Err(AppError::new("LINK_CROSS_DATABASE"));
            }
            Ok((target.row.id.clone(), target.row.table_name.clone(), target.row.label.clone(), qualify(&base.row.schema_name, &target.row.table_name)?))
        };
        let on_delete = if on_delete_raw == Some("set_null") { "set_null" } else { "restrict" };
        let (resolve, label, description, at, person, base, table) = (&resolve, &label, &description, &at, &person, base, table);
        let id = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
            assert_token_writes(&tx, ctx).await?;
            assert_person_manages(&tx, person, &base.row.id, "PERMISSION_DENIED").await?;
            let (target_id, target_name, target_label, target_at) = resolve()?;
            let column = format!("{target_name}_id");
            let rows: i64 = tx.first(&format!("SELECT count(*)::text AS n FROM {at}"), &[]).await?.and_then(|r| r.get::<_, String>(0).parse().ok()).unwrap_or(0);
            let quoted = quote_identifier(&column)?;
            let request = json!({
                "operation": "add_link",
                "baseId": base.row.id,
                "tableId": table.row.id,
                "targetTableId": target_id,
                "label": label,
                "description": description,
                "onDelete": on_delete,
            });
            let preview = Preview {
                label: format!("Ajout du lien « {label} » vers « {target_label} »"),
                summary_template: "add_link_field",
                summary_params: json!({
                    "field_label": user_data(json!(label)),
                    "field_description": user_data(json!(description)),
                    "source_table": { "physical": table.row.table_name, "label": table.row.label, "provenance": "user_data" },
                    "target_table": { "physical": target_name, "label": target_label, "provenance": "user_data" },
                    "on_delete": { "value": on_delete, "provenance": "system" },
                }),
                affected_objects: json!([
                    {
                        "role": "modified",
                        "kind": "table",
                        "physical": table.row.table_name,
                        "effects": [format!("ajout de la colonne {column}"), format!("ajout d’un index sur {column}")],
                    },
                    {
                        "role": "referenced",
                        "kind": "table",
                        "physical": target_name,
                        "effects": [
                            format!("clé étrangère posée vers {target_name}._id"),
                            if on_delete == "restrict" {
                                format!("les suppressions de lignes de « {target_label} » seront refusées si elles sont référencées")
                            } else {
                                format!("supprimer une ligne de « {target_label} » videra ce champ dans les lignes qui la référencent")
                            },
                            "verrou SHARE ROW EXCLUSIVE sur les deux tables pendant la pose : les écritures attendent, les lectures non".to_string(),
                            format!("parcours de validation de {}", plural(rows.max(0) as usize, "ligne", "lignes")),
                        ],
                    },
                ]),
                up_sql: vec![
                    format!("ALTER TABLE {at} ADD COLUMN {quoted} uuid"),
                    format!(
                        "ALTER TABLE {at} ADD CONSTRAINT … FOREIGN KEY ({quoted}) REFERENCES {target_at} (\"_id\") ON DELETE {} NOT VALID",
                        if on_delete == "restrict" { "NO ACTION" } else { "SET NULL" }
                    ),
                    format!("ALTER TABLE {at} VALIDATE CONSTRAINT …"),
                ],
                down_sql: vec![format!("ALTER TABLE {at} DROP COLUMN {quoted}")],
                object_key: format!("add_field:{}:{}", table.row.id, label.to_lowercase()),
            };
            insert_proposal(&tx, ctx, &request, &preview).await
        })
        .await?;
        return agent_get_proposal(pools, ctx, &id).await;
    }

    let mut raw = Map::new();
    raw.insert("label".into(), json!(label));
    raw.insert("kind".into(), request.get("kind").cloned().unwrap_or(Value::Null));
    raw.insert("description".into(), json!(description));
    if let Some(options) = request.get("options") {
        raw.insert("options".into(), options.clone());
    }
    let (person, raw, base, table, label, description, at) = (&person, &Value::Object(raw), base, table, &label, &description, &at);
    let id = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        assert_token_writes(&tx, ctx).await?;
        assert_person_manages(&tx, person, &base.row.id, "PERMISSION_DENIED").await?;
        let field = check_field(raw, "field", true)?;
        let column = candidate(label, false);
        let quoted = quote_identifier(&column)?;
        let kind = text_of(field.get("kind")).to_string();
        let mut params = Map::new();
        params.insert("field_label".into(), user_data(json!(label)));
        params.insert("field_description".into(), user_data(json!(description)));
        params.insert("kind".into(), json!({ "value": kind, "provenance": "system" }));
        params.insert("table".into(), json!({ "physical": table.row.table_name, "label": table.row.label, "provenance": "user_data" }));
        if let Some(options) = field.get("options").and_then(Value::as_array) {
            let list: Vec<Value> = options
                .iter()
                .map(|o| {
                    let shown = o.get("label").cloned().filter(|l| !l.is_null()).or_else(|| o.get("value").cloned()).unwrap_or(Value::Null);
                    let mut m = match user_data(shown) {
                        Value::Object(m) => m,
                        _ => Map::new(),
                    };
                    for key in ["color", "icon"] {
                        if let Some(v) = o.get(key).filter(|v| !v.is_null()) {
                            m.insert(key.into(), v.clone());
                        }
                    }
                    Value::Object(m)
                })
                .collect();
            params.insert("options".into(), json!(list));
        }
        let preview = Preview {
            label: format!("Ajout du champ « {label} » à « {} »", table.row.label),
            summary_template: "add_field",
            summary_params: Value::Object(params),
            affected_objects: json!([{
                "role": "modified",
                "kind": "table",
                "physical": table.row.table_name,
                "effects": [format!("ajout de la colonne {column}, vide dans les lignes existantes")],
            }]),
            up_sql: vec![format!("ALTER TABLE {at} ADD COLUMN {quoted} {}", pg_type_of(&kind)?)],
            down_sql: vec![format!("ALTER TABLE {at} DROP COLUMN {quoted}")],
            object_key: format!("add_field:{}:{}", table.row.id, label.to_lowercase()),
        };
        let request = json!({ "operation": "add_field", "baseId": base.row.id, "tableId": table.row.id, "field": field });
        insert_proposal(&tx, ctx, &request, &preview).await
    })
    .await?;
    agent_get_proposal(pools, ctx, &id).await
}

/// `agentProposeUpdateLook` — `propose_update_look`: the colour and pictogram of a table,
/// and of the choices of its lists. No SQL against the user's schema, still reviewed.
pub async fn agent_propose_update_look(pools: &Pools, ctx: &RequestContext, request: &Value) -> Result<Proposal, AppError> {
    let view = agent_view(pools, ctx).await?;
    let (base, table) = resolve_agent_table(&view, text_of(request.get("base")), text_of(request.get("table")))?;
    let look = check_look_value(request.get("look"), "look")?;
    let entries: &[Value] = match request.get("fields") {
        None | Some(Value::Null) => &[],
        Some(Value::Array(a)) => a,
        Some(_) => return Err(invalid("fields")),
    };
    struct Chosen {
        field_id: String,
        name: String,
        label: String,
        known: HashMap<String, String>,
        options: Vec<Map<String, Value>>,
    }
    let mut chosen: Vec<Chosen> = Vec::new();
    for (i, entry) in entries.iter().enumerate() {
        let path = format!("fields[{i}]");
        let wanted = entry.get("field").and_then(Value::as_str);
        let field = table.fields.iter().find(|f| !f.system && wanted.is_some_and(|w| f.name == w || f.id.as_deref() == Some(w)));
        let Some(field) = field else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("param", json!(format!("{path}.field"))));
        };
        if !CHOICE_KINDS.contains(&field.kind.as_str()) {
            return Err(AppError::new("REQUEST_INVALID").with("field", json!(format!("{path}.field"))).with("reason", json!("pas_une_liste_de_choix")));
        }
        let field_id = field.id.clone().unwrap_or_default();
        let known: HashMap<String, String> = view.raw.options.get(&field_id).map(|os| os.iter().map(|o| (o.value.clone(), o.label.clone())).collect()).unwrap_or_default();
        let Some(asked) = entry.get("options").and_then(Value::as_array).filter(|a| !a.is_empty()) else {
            return Err(invalid(format!("{path}.options")));
        };
        let mut options = Vec::new();
        for (j, o) in asked.iter().enumerate() {
            let Some(value) = o.get("value").and_then(Value::as_str).filter(|v| known.contains_key(*v)) else {
                return Err(AppError::new("RESOURCE_NOT_FOUND").with("param", json!(format!("{path}.options[{j}].value"))));
            };
            let Some(option_look) = check_look(o.get("color"), o.get("icon"), &format!("{path}.options[{j}]"))? else {
                return Err(invalid(format!("{path}.options[{j}]")));
            };
            let mut m = Map::new();
            m.insert("value".into(), json!(value));
            m.extend(option_look);
            options.push(m);
        }
        chosen.push(Chosen { field_id, name: field.name.clone(), label: field.label.clone(), known, options });
    }
    if look.is_none() && chosen.is_empty() {
        return Err(invalid("look"));
    }

    let mut req = Map::new();
    req.insert("operation".into(), json!("set_look"));
    req.insert("baseId".into(), json!(base.row.id));
    req.insert("tableId".into(), json!(table.row.id));
    let mut params = Map::new();
    params.insert("table".into(), json!({ "physical": table.row.table_name, "label": table.row.label, "provenance": "user_data" }));
    let mut effects: Vec<String> = Vec::new();
    if let Some(look) = &look {
        req.insert("look".into(), Value::Object(look.clone()));
        params.insert("look".into(), look_param(look));
        effects.push("couleur ou pictogramme de la table".into());
    }
    req.insert("fields".into(), json!(chosen.iter().map(|c| json!({ "fieldId": c.field_id, "options": c.options })).collect::<Vec<_>>()));
    params.insert(
        "fields".into(),
        json!(chosen
            .iter()
            .map(|c| json!({
                "label": user_data(json!(c.label)),
                "options": c.options.iter().map(|o| {
                    let value = text_of(o.get("value"));
                    let mut m = match user_data(json!(c.known.get(value).cloned().unwrap_or_else(|| value.to_string()))) {
                        Value::Object(m) => m,
                        _ => Map::new(),
                    };
                    for key in ["color", "icon"] {
                        if let Some(v) = o.get(key) {
                            m.insert(key.into(), v.clone());
                        }
                    }
                    Value::Object(m)
                }).collect::<Vec<_>>(),
            }))
            .collect::<Vec<_>>()),
    );
    for c in &chosen {
        effects.push(format!("couleur ou pictogramme de {} choix du champ {}", c.options.len(), c.name));
    }
    effects.push("aucune donnée ni aucune colonne n’est touchée".into());
    let preview = Preview {
        label: format!("Apparence de la table « {} »", table.row.label),
        summary_template: "set_look",
        summary_params: Value::Object(params),
        affected_objects: json!([{ "role": "modified", "kind": "table", "physical": table.row.table_name, "effects": effects }]),
        up_sql: Vec::new(),
        down_sql: Vec::new(),
        object_key: format!("set_look:{}", table.row.id),
    };
    let request = Value::Object(req);
    let person = person_of(ctx, &ctx.actor.id);
    let (request, preview, person, base_id) = (&request, &preview, &person, &base.row.id);
    let id = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        assert_token_writes(&tx, ctx).await?;
        assert_person_manages(&tx, person, base_id, "PERMISSION_DENIED").await?;
        insert_proposal(&tx, ctx, request, preview).await
    })
    .await?;
    agent_get_proposal(pools, ctx, &id).await
}

const SELECT_PROPOSALS: &str = "
  SELECT m.id::text, m.status, m.base_id::text, b.label AS base_label, sn.name AS base_name,
         m.requested_at, m.requested_by::text, ru.display_name AS requested_name,
         m.catalog_diff, m.affected_objects, m.up_sql, m.down_sql,
         m.approved_by::text, au.display_name AS approved_name, m.approved_at,
         tk.label AS token_label, m.error_code
    FROM _basedb.migration m
    JOIN _basedb.base b           ON b.id = m.base_id
    JOIN _basedb.tenant t         ON t.id = b.tenant_id
    JOIN _basedb.db_schema s      ON s.base_id = b.id AND s.role = 'current' AND s.dropped_at IS NULL
    JOIN _basedb.physical_name sn ON sn.id = s.name_id
    LEFT JOIN _basedb.app_user ru ON ru.id = m.requested_by
    LEFT JOIN _basedb.app_user au ON au.id = m.approved_by
    LEFT JOIN _basedb.api_token tk ON tk.id::text = m.catalog_diff->>'token_id'
   WHERE m.origin = 'mcp' AND t.ref = $1";

/// `toProposal`.
fn to_proposal(row: &tokio_postgres::Row, tenant_ref: &str) -> Proposal {
    let diff: Value = row.get(8);
    let decision = diff.get("decision").filter(|d| !d.is_null());
    let status: String = row.get(1);
    let status = match decision {
        Some(_) => "rejected".to_string(),
        None if ["proposed", "approved", "applied", "expired", "superseded", "failed"].contains(&status.as_str()) => status,
        None => "proposed".into(),
    };
    let requested_at: DateTime<Utc> = row.get(5);
    let approved_by: Option<String> = row.get(12);
    let approved_at: Option<DateTime<Utc>> = row.get(14);
    let base_name: String = row.get(4);
    let or_empty_array = |v: Option<Value>| v.filter(|v| !v.is_null()).unwrap_or_else(|| json!([]));
    let (decided_by, decided_at) = match decision {
        Some(d) => (
            json!({ "id": d.get("by").cloned().filter(|v| !v.is_null()).unwrap_or(json!("")), "name": d.get("name").cloned().unwrap_or(Value::Null) }),
            d.get("at").cloned().unwrap_or(Value::Null),
        ),
        None => match approved_by {
            None => (Value::Null, approved_at.map(|a| json!(iso(a))).unwrap_or(Value::Null)),
            Some(by) => (json!({ "id": by, "name": row.get::<_, Option<String>>(13) }), approved_at.map(|a| json!(iso(a))).unwrap_or(Value::Null)),
        },
    };
    Proposal {
        id: row.get(0),
        status,
        base: json!({ "id": row.get::<_, String>(2), "name": logical_name(&base_name, tenant_ref), "label": row.get::<_, String>(3) }),
        requested_at: iso(requested_at),
        expires_at: iso(requested_at + Duration::seconds(PROPOSAL_LIFETIME_SECONDS)),
        requested_by: json!({ "id": row.get::<_, Option<String>>(6), "name": row.get::<_, Option<String>>(7) }),
        token: json!({ "id": diff.get("token_id").cloned().unwrap_or(Value::Null), "label": row.get::<_, Option<String>>(15) }),
        summary_template: match diff.get("summary_template") {
            None | Some(Value::Null) => String::new(),
            Some(Value::String(s)) => s.clone(),
            Some(other) => other.to_string(),
        },
        summary_params: diff.get("summary_params").cloned().filter(|v| !v.is_null()).unwrap_or_else(|| json!({})),
        affected_objects: or_empty_array(row.get(9)),
        up_sql: or_empty_array(row.get(10)),
        down_sql: or_empty_array(row.get(11)),
        decided_by,
        decided_at,
        error: row.get(16),
    }
}

fn looks_like_id(id: &str) -> bool {
    id.len() == 36 && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

/// `agentGetProposal` — `get_proposal`: the token that proposed it, and nobody else.
pub async fn agent_get_proposal(pools: &Pools, ctx: &RequestContext, proposal_id: &str) -> Result<Proposal, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        if !looks_like_id(proposal_id) {
            return Err(AppError::new("RESOURCE_NOT_FOUND"));
        }
        let row = tx.first(&format!("{SELECT_PROPOSALS} AND m.id = $2::text::uuid"), &[&ctx.tenant_id, &proposal_id]).await?;
        let mine = row.as_ref().is_some_and(|row| match &ctx.actor.token_id {
            None => row.get::<_, Option<String>>(6).as_deref() == Some(ctx.actor.id.as_str()),
            Some(token) => row.get::<_, Value>(8).get("token_id").and_then(Value::as_str) == Some(token.as_str()),
        });
        match row {
            Some(row) if mine => Ok(to_proposal(&row, &ctx.tenant_id)),
            _ => Err(AppError::new("RESOURCE_NOT_FOUND").with("proposal", json!(proposal_id))),
        }
    })
    .await
}

/// `listProposals`: the proposals of a base, newest first — the review queue.
pub async fn list_proposals(pools: &Pools, ctx: &RequestContext, base_id: &str) -> Result<Vec<Proposal>, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        tx.execute_op(
            "UPDATE _basedb.migration SET status = 'expired'
              WHERE origin = 'mcp' AND status = 'proposed' AND base_id = $1::text::uuid
                AND requested_at < clock_timestamp() - $2::text::interval",
            &[&base_id, &LIFETIME],
            SqlOp::Update,
        )
        .await?;
        let rows = tx.rows(&format!("{SELECT_PROPOSALS} AND m.base_id = $2::text::uuid ORDER BY m.requested_at DESC LIMIT 100"), &[&ctx.tenant_id, &base_id]).await?;
        Ok(rows.iter().map(|r| to_proposal(r, &ctx.tenant_id)).collect())
    })
    .await
}

async fn proposal_by_id(pools: &Pools, ctx: &RequestContext, id: &str) -> Result<Option<Proposal>, AppError> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        let row = tx.first(&format!("{SELECT_PROPOSALS} AND m.id = $2::text::uuid"), &[&ctx.tenant_id, &id]).await?;
        Ok(row.map(|r| to_proposal(&r, &ctx.tenant_id)))
    })
    .await
}

enum Checked {
    Expired,
    Go { requested_by: String, request: Value },
}

/// `approveProposal`: every check made again, now — then carried out.
pub async fn approve_proposal(pools: &Pools, ctx: &RequestContext, proposal_id: &str) -> Result<Proposal, AppError> {
    if !looks_like_id(proposal_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("proposal", json!(proposal_id));
    let checked = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let Some(row) = tx
            .first(
                "SELECT m.base_id::text, m.status, m.requested_by::text, m.requested_at,
                        m.catalog_diff, b.catalog_version::text
                   FROM _basedb.migration m
                   JOIN _basedb.base b   ON b.id = m.base_id
                   JOIN _basedb.tenant t ON t.id = b.tenant_id
                  WHERE m.id = $1::text::uuid AND m.origin = 'mcp' AND t.ref = $2
                  FOR UPDATE OF m",
                &[&proposal_id, &ctx.tenant_id],
            )
            .await?
        else {
            return Err(not_found());
        };
        let base_id: String = row.get(0);
        require_on_base(&tx, ctx, Action::ManageSchema, &base_id).await?;
        let status: String = row.get(1);
        let diff: Value = row.get(4);
        if status != "proposed" || diff.get("decision").is_some() {
            return Err(AppError::new("MIGRATION_STALE").with("proposal", json!(proposal_id)));
        }
        let requested_at: DateTime<Utc> = row.get(3);
        if requested_at + Duration::seconds(PROPOSAL_LIFETIME_SECONDS) < Utc::now() {
            tx.execute_op("UPDATE _basedb.migration SET status = 'expired' WHERE id = $1::text::uuid", &[&proposal_id], SqlOp::Update).await?;
            return Ok(Checked::Expired);
        }
        let version: Option<String> = row.get(5);
        if diff.get("catalog_version") != Some(&json!(version)) {
            return Err(AppError::new("PROPOSAL_STALE").with("proposal", json!(proposal_id)));
        }
        let requested_by: String = row.get(2);
        assert_person_manages(&tx, &person_of(ctx, &requested_by), &base_id, "AUTHORIZATION_REVOKED").await?;
        if let Some(token) = diff.get("token_id").and_then(Value::as_str) {
            let usable = tx
                .first(
                    "SELECT (tk.revoked_at IS NULL AND tk.suspended_at IS NULL
                             AND (tk.expires_at IS NULL OR tk.expires_at > clock_timestamp())
                             AND 'mcp' = ANY(tk.allowed_surfaces)
                             AND u.disabled_at IS NULL AND u.deleted_at IS NULL) AS usable
                       FROM _basedb.api_token tk JOIN _basedb.app_user u ON u.id = tk.created_by
                      WHERE tk.id = $1::text::uuid",
                    &[&token],
                )
                .await?
                .is_some_and(|r| r.get::<_, Option<bool>>(0) == Some(true));
            if !usable {
                return Err(AppError::new("AUTHORIZATION_REVOKED").with("proposal", json!(proposal_id)));
            }
        }
        tx.execute_op(
            "UPDATE _basedb.migration
                SET status = 'approved', approved_by = $2::text::uuid, approved_at = clock_timestamp()
              WHERE id = $1::text::uuid",
            &[&proposal_id, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        Ok(Checked::Go { requested_by, request: diff.get("request").cloned().unwrap_or(Value::Null) })
    })
    .await?;
    let (requested_by, request) = match checked {
        Checked::Expired => return Err(AppError::new("PROPOSAL_EXPIRED").with("proposal", json!(proposal_id))),
        Checked::Go { requested_by, request } => (requested_by, request),
    };

    let person = person_of(ctx, &requested_by);
    let created = match carry_out(pools, &person, &request).await {
        Ok(created) => created,
        Err(error) => {
            let code = error.code;
            with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
                tx.execute_op(
                    "UPDATE _basedb.migration
                        SET status = 'failed', finished_at = clock_timestamp(),
                            error_code = coalesce((SELECT code FROM _basedb.error_code WHERE code = $2), 'INTERNAL_ERROR'),
                            sequence = (SELECT coalesce(max(sequence), 0) + 1 FROM _basedb.migration
                                         WHERE base_id = (SELECT base_id FROM _basedb.migration WHERE id = $1::text::uuid))
                      WHERE id = $1::text::uuid",
                    &[&proposal_id, &code],
                    SqlOp::Update,
                )
                .await
            })
            .await?;
            return Err(error);
        }
    };

    let operation = request.get("operation").and_then(Value::as_str).map(String::from);
    let (created, operation) = (&js_stringify(&created), &operation);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        tx.execute_op(
            "UPDATE _basedb.migration
                SET status = 'applied', applied_by = $2::text::uuid, applied_at = clock_timestamp(),
                    finished_at = clock_timestamp(),
                    sequence = (SELECT coalesce(max(sequence), 0) + 1 FROM _basedb.migration
                                 WHERE base_id = (SELECT base_id FROM _basedb.migration WHERE id = $1::text::uuid)),
                    catalog_diff = catalog_diff || jsonb_build_object('created', $3::text::jsonb)
              WHERE id = $1::text::uuid",
            &[&proposal_id, &ctx.actor.id, created],
            SqlOp::Update,
        )
        .await?;
        let mut entry = AuditEntry::new("proposal.approve", "migration");
        entry.object_id = Some(proposal_id.to_string());
        entry.object_name = operation.clone();
        write_audit(&tx, ctx, &entry).await
    })
    .await?;
    proposal_by_id(pools, ctx, proposal_id).await?.ok_or_else(not_found)
}

fn look_input(look: &Value) -> LookInput {
    let text = |k: &str| look.get(k).and_then(Value::as_str).map(String::from);
    LookInput { color: Some(text("color")), icon: Some(text("icon")), image: None }
}

/// `carryOut`: the request, by the ordinary operation — what the schema editor would do.
async fn carry_out(pools: &Pools, person: &RequestContext, r: &Value) -> Result<Value, AppError> {
    let s = |k: &str| text_of(r.get(k)).to_string();
    let null_or = |v: Option<&Value>| v.cloned().unwrap_or(Value::Null);
    match text_of(r.get("operation")) {
        "create_table" => {
            let fields: Vec<Value> = r
                .get("fields")
                .and_then(Value::as_array)
                .map(|fs| {
                    fs.iter()
                        .map(|f| {
                            let mut m = Map::new();
                            m.insert("label".into(), null_or(f.get("label")));
                            m.insert("kind".into(), null_or(f.get("kind")));
                            if let Some(req) = f.get("required") {
                                m.insert("required".into(), req.clone());
                            }
                            m.insert("description".into(), null_or(f.get("description")));
                            Value::Object(m)
                        })
                        .collect()
                })
                .unwrap_or_default();
            let look = r.get("look").filter(|l| l.is_object()).map(look_input);
            let description = null_or(r.get("description"));
            let table = create_table(pools, person, &s("baseId"), &s("label"), Some(&description), Some(&json!(fields)), look.as_ref()).await?;
            Ok(json!({ "table_id": table.table_id, "table": table.table_name }))
        }
        "set_look" => carry_out_look(pools, person, r).await,
        "add_field" => {
            let field = r.get("field").cloned().unwrap_or(Value::Null);
            let options = field.get("options").and_then(Value::as_array).map(|os| {
                os.iter()
                    .map(|o| {
                        let label = o.get("label").cloned().filter(|l| !l.is_null()).or_else(|| o.get("value").cloned()).unwrap_or(Value::Null);
                        json!({ "value": o.get("value"), "label": label, "color": null_or(o.get("color")), "icon": null_or(o.get("icon")) })
                    })
                    .collect::<Vec<_>>()
            });
            let request = AddFieldRequest {
                table_id: s("tableId"),
                label: text_of(field.get("label")).to_string(),
                kind: text_of(field.get("kind")).to_string(),
                description: Some(null_or(field.get("description"))),
                options,
                ..Default::default()
            };
            let added = add_field(pools, person, &request).await?;
            Ok(json!({ "field_id": added.field_id, "field": added.name }))
        }
        _ => {
            let request = CreateLinkRequest {
                table_id: s("tableId"),
                target_table_id: s("targetTableId"),
                label: s("label"),
                description: Some(null_or(r.get("description"))),
                on_delete: r.get("onDelete").and_then(Value::as_str).map(String::from),
                ..Default::default()
            };
            let link = create_link_field(pools, person, &request).await?;
            Ok(json!({ "field_id": link.field_id }))
        }
    }
}

/// `merge`: a key the agent named replaces, a key it left out keeps, and a pictogram
/// chosen takes the place of a picture.
fn merge(current: [Option<String>; 3], asked: &Value) -> [Option<String>; 3] {
    let [color, icon, image] = current;
    let pick = |k: &str, keep: Option<String>| match asked.get(k) {
        None => keep,
        Some(v) => v.as_str().map(String::from),
    };
    let icon_asked = asked.get("icon");
    [pick("color", color), pick("icon", icon), if icon_asked.is_none_or(Value::is_null) { image } else { None }]
}

/// `carryOutLook`: on what the base holds NOW, by `updateTable` and `setSelectOptions`.
async fn carry_out_look(pools: &Pools, person: &RequestContext, r: &Value) -> Result<Value, AppError> {
    let table_id = text_of(r.get("tableId"));
    if let Some(look) = r.get("look").filter(|l| l.is_object()) {
        let current = with_transaction(pools, PoolName::Catalog, person, TxOptions::read_only(), |tx| async move {
            tx.first("SELECT color, icon, image FROM _basedb.table_def WHERE id = $1::text::uuid AND is_live", &[&table_id]).await
        })
        .await?;
        let Some(current) = current else {
            return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id)));
        };
        let [color, icon, image] = merge([current.get(0), current.get(1), current.get(2)], look);
        update_table(pools, person, table_id, None, Some(&LookInput { color: Some(color), icon: Some(icon), image: Some(image) })).await?;
    }
    for field in r.get("fields").and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[]) {
        let field_id = text_of(field.get("fieldId"));
        let current = with_transaction(pools, PoolName::Catalog, person, TxOptions::read_only(), |tx| async move {
            tx.rows(
                "SELECT value, label, color, icon, image FROM _basedb.select_option
                  WHERE field_id = $1::text::uuid AND deleted_at IS NULL ORDER BY position, value",
                &[&field_id],
            )
            .await
        })
        .await?;
        let asked: HashMap<&str, &Value> = field.get("options").and_then(Value::as_array).map(|os| os.iter().map(|o| (text_of(o.get("value")), o)).collect()).unwrap_or_default();
        let options: Vec<Value> = current
            .iter()
            .map(|o| {
                let value: String = o.get(0);
                let label: String = o.get(1);
                let now = [o.get(2), o.get(3), o.get(4)];
                let [color, icon, image] = match asked.get(value.as_str()) {
                    Some(wanted) => merge(now, wanted),
                    None => now,
                };
                json!({ "value": value, "label": label, "color": color, "icon": icon, "image": image })
            })
            .collect();
        set_select_options(pools, person, field_id, &options).await?;
    }
    Ok(json!({ "table_id": table_id }))
}

/// `rejectProposal`: recorded, and closed.
pub async fn reject_proposal(pools: &Pools, ctx: &RequestContext, proposal_id: &str) -> Result<Proposal, AppError> {
    if !looks_like_id(proposal_id) {
        return Err(AppError::new("RESOURCE_NOT_FOUND"));
    }
    let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("proposal", json!(proposal_id));
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        let Some(row) = tx
            .first(
                "SELECT m.base_id::text, m.status FROM _basedb.migration m
                   JOIN _basedb.base b ON b.id = m.base_id JOIN _basedb.tenant t ON t.id = b.tenant_id
                  WHERE m.id = $1::text::uuid AND m.origin = 'mcp' AND t.ref = $2 FOR UPDATE OF m",
                &[&proposal_id, &ctx.tenant_id],
            )
            .await?
        else {
            return Err(not_found());
        };
        let base_id: String = row.get(0);
        require_on_base(&tx, ctx, Action::ManageSchema, &base_id).await?;
        if row.get::<_, String>(1) != "proposed" {
            return Err(AppError::new("MIGRATION_STALE").with("proposal", json!(proposal_id)));
        }
        let name: Option<String> = tx.first("SELECT display_name AS name FROM _basedb.app_user WHERE id = $1::text::uuid", &[&ctx.actor.id]).await?.and_then(|r| r.get(0));
        tx.execute_op(
            "UPDATE _basedb.migration
                SET status = 'expired',
                    catalog_diff = catalog_diff || jsonb_build_object('decision',
                      jsonb_build_object('kind', 'rejected', 'by', $2::text, 'name', $3::text,
                                         'at', to_char(clock_timestamp() AT TIME ZONE 'UTC',
                                                       'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')))
              WHERE id = $1::text::uuid",
            &[&proposal_id, &ctx.actor.id, &name],
            SqlOp::Update,
        )
        .await?;
        let mut entry = AuditEntry::new("proposal.reject", "migration");
        entry.object_id = Some(proposal_id.to_string());
        write_audit(&tx, ctx, &entry).await
    })
    .await?;
    proposal_by_id(pools, ctx, proposal_id).await?.ok_or_else(not_found)
}

/// `openProposalCounts`: how many proposals await a decision, per base.
pub async fn open_proposal_counts<E: Exec + Sync>(exec: &E, base_ids: &[String]) -> Result<HashMap<String, i64>, AppError> {
    if base_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = exec
        .rows(
            "SELECT base_id::text, count(*)::int8 AS n FROM _basedb.migration
              WHERE origin = 'mcp' AND status = 'proposed' AND base_id = ANY($1::text[]::uuid[])
                AND requested_at >= clock_timestamp() - $2::text::interval
              GROUP BY base_id",
            &[&base_ids, &LIFETIME],
        )
        .await?;
    Ok(rows.iter().map(|r| (r.get(0), r.get(1))).collect())
}

// ── Routes (`/admin/proposals`) ─────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct BaseQuery {
    base: Option<String>,
}

/// `GET /api/v1/{tenant}/admin/proposals?base=`: the review queue of a base.
pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(tenant): Path<String>, Query(q): Query<BaseQuery>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let (base_id, _) = resolve_base(&st.pools, &ctx, q.base.as_deref().unwrap_or("")).await?;
    let proposals = list_proposals(&st.pools, &ctx, &base_id).await?;
    Ok(json_ok(json!({ "data": proposals.iter().map(Proposal::to_rest).collect::<Vec<_>>() })))
}

/// `POST /api/v1/{tenant}/admin/proposals/{id}/approve`.
pub async fn approve(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let proposal = approve_proposal(&st.pools, &ctx, &id).await?;
    Ok(json_ok(json!({ "data": proposal.to_rest() })))
}

/// `POST /api/v1/{tenant}/admin/proposals/{id}/reject`.
pub async fn reject(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, id)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let proposal = reject_proposal(&st.pools, &ctx, &id).await?;
    Ok(json_ok(json!({ "data": proposal.to_rest() })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn looks_are_checked_as_node_checks_them() {
        assert_eq!(check_look(None, Some(&json!(" star ")), "look").unwrap().unwrap()["icon"], json!("star"));
        assert_eq!(check_look(None, Some(&json!("")), "look").unwrap().unwrap()["icon"], Value::Null);
        let e = check_look(None, Some(&json!("licorne")), "look").unwrap_err();
        assert_eq!((e.code, e.details["reason"].clone()), ("REQUEST_INVALID", json!("icone_inconnue")));
        assert!(check_look(None, None, "look").unwrap().is_none());
        assert_eq!(check_look(Some(&json!(3)), None, "o").unwrap_err().details["field"], json!("o.color"));
        assert_eq!(check_look_value(Some(&json!("x")), "look").unwrap_err().details["field"], json!("look"));
    }

    #[test]
    fn fields_keep_nodes_shape() {
        let f = check_field(&json!({ "label": " Nom ", "kind": "short_text" }), "fields[0]", false).unwrap();
        assert_eq!(js_stringify(&f), r#"{"label":"Nom","kind":"short_text","description":null,"required":false}"#);
        assert_eq!(check_field(&json!({ "label": "x", "kind": "select" }), "f", false).unwrap_err().details["field"], json!("f.kind"));
        assert_eq!(check_field(&json!({ "label": "x", "kind": "select" }), "f", true).unwrap_err().details["field"], json!("f.options"));
    }

    #[test]
    fn a_pictogram_replaces_a_picture() {
        let now = [Some("#ff0000".to_string()), None, Some("https://x/y.png".to_string())];
        assert_eq!(merge(now.clone(), &json!({ "icon": "star" })), [Some("#ff0000".into()), Some("star".into()), None]);
        assert_eq!(merge(now.clone(), &json!({ "color": null })), [None, None, Some("https://x/y.png".into())]);
    }
}
