//! The buttons of a table's toolbar (`catalog/table-buttons.ts`): read by whoever reads the
//! table, set by whoever manages its structure. Pressing one starts automation runs and
//! belongs to the automations domain (`basedb-automations`, `routes::press`).

use crate::description::js_trim;
use crate::http::js_len;
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::{AppError, SqlOp};
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_table;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

type R<T> = Result<T, AppError>;

pub const BUTTON_TARGETS: [&str; 3] = ["selection", "view", "none"];
const MAX_BUTTONS: i32 = 12;

#[derive(Debug, Clone)]
pub struct TableButton {
    pub id: String,
    pub table_id: String,
    pub label: String,
    pub color: Option<String>,
    pub action: String,
    pub url: Option<String>,
    /// `(id, label)` of the automation it starts.
    pub automation: Option<(String, String)>,
    pub target: String,
    pub confirm: bool,
    pub position: i32,
}

impl TableButton {
    /// `tableButtonJson` of `app.ts`.
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "label": self.label,
            "color": self.color,
            "action": self.action,
            "url": self.url,
            "automation": self.automation.as_ref().map(|(id, label)| json!({ "id": id, "label": label })),
            "target": self.target,
            "confirm": self.confirm,
            "position": self.position,
        })
    }
}

const SELECT: &str = "SELECT b.id::text, b.table_id::text, b.label, b.color, b.action, b.url,
                             b.automation_id::text, a.label AS automation_label, b.target, b.confirm,
                             b.position
                        FROM _basedb.table_button b
                        LEFT JOIN _basedb.automation a ON a.id = b.automation_id";

fn to_button(r: &tokio_postgres::Row) -> TableButton {
    let automation_id: Option<String> = r.get(6);
    let automation_label: Option<String> = r.get(7);
    TableButton {
        id: r.get(0),
        table_id: r.get(1),
        label: r.get(2),
        color: r.get(3),
        action: r.get(4),
        url: r.get(5),
        automation: automation_id.map(|id| (id, automation_label.unwrap_or_default())),
        target: r.get(8),
        confirm: r.get(9),
        position: r.get(10),
    }
}

fn refuse(field: &str, reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!(reason))
}

fn is_uuid(s: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap()).is_match(s)
}

fn is_color(s: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^#[0-9a-f]{6}$").unwrap()).is_match(s)
}

fn is_address(s: &str) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)^(https?://|mailto:)").unwrap()).is_match(s)
}

/// `listTableButtons`: in their order.
pub async fn list_buttons(pools: &Pools, ctx: &RequestContext, table_id: &str) -> R<Vec<TableButton>> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_table(&tx, ctx, Action::Read, table_id).await?;
        let rows = tx
            .rows(&format!("{SELECT} WHERE b.table_id = $1::text::uuid ORDER BY b.position, b.created_at"), &[&table_id])
            .await?;
        Ok(rows.iter().map(to_button).collect())
    })
    .await
}

struct Settings {
    label: String,
    color: Option<String>,
    action: &'static str,
    url: Option<String>,
    automation_id: Option<String>,
    target: String,
    confirm: bool,
}

/// `settingsOf`: a label, a colour, an address that opens a page or a mail, or an
/// automation of the same base whose trigger fits the target.
async fn settings_of<E: Exec + Sync>(exec: &E, table_id: &str, input: &Value) -> R<Settings> {
    if input.is_null() {
        return Err(AppError::internal("Cannot read properties of null (reading 'label')"));
    }
    let label = match input.get("label") {
        Some(Value::String(s)) => js_trim(s).to_string(),
        _ => String::new(),
    };
    let n = js_len(&label);
    if !(1..=60).contains(&n) {
        return Err(refuse("label", "libelle_invalide"));
    }
    let color = match input.get("color") {
        Some(Value::String(s)) if !s.is_empty() => Some(s.to_lowercase()),
        _ => None,
    };
    if color.as_deref().is_some_and(|c| !is_color(c)) {
        return Err(refuse("color", "couleur_invalide"));
    }
    let action = match input.get("action").and_then(Value::as_str) {
        Some("url") => "url",
        Some("automation") => "automation",
        _ => return Err(refuse("action", "action_inconnue")),
    };
    let confirm = input.get("confirm") == Some(&Value::Bool(true));

    if action == "url" {
        let url = match input.get("url") {
            Some(Value::String(s)) => js_trim(s).to_string(),
            _ => String::new(),
        };
        if js_len(&url) > 2048 || !is_address(&url) {
            return Err(refuse("url", "adresse_invalide"));
        }
        return Ok(Settings { label, color, action, url: Some(url), automation_id: None, target: "none".into(), confirm });
    }

    let target = match input.get("target").and_then(Value::as_str) {
        Some(t) if BUTTON_TARGETS.contains(&t) => t.to_string(),
        _ => return Err(refuse("target", "cible_inconnue")),
    };
    let automation_id = match input.get("automation") {
        Some(Value::String(s)) => s.clone(),
        _ => String::new(),
    };
    if !is_uuid(&automation_id) {
        return Err(refuse("automation", "automatisation_inconnue"));
    }
    let Some(found) = exec
        .first(
            "SELECT a.trigger_kind, a.table_id::text
               FROM _basedb.automation a
               JOIN _basedb.table_def t ON t.base_id = a.base_id AND t.id = $2::text::uuid
              WHERE a.id = $1::text::uuid AND a.deleted_at IS NULL",
            &[&automation_id, &table_id],
        )
        .await?
    else {
        return Err(refuse("automation", "automatisation_inconnue"));
    };
    let trigger_kind: String = found.get(0);
    let automation_table: Option<String> = found.get(1);
    let fits = if target == "none" {
        automation_table.is_none()
    } else {
        trigger_kind == "button" && automation_table.as_deref() == Some(table_id)
    };
    if !fits {
        return Err(refuse("automation", if target == "none" { "automatisation_sans_table" } else { "declencheur_bouton" }));
    }
    Ok(Settings { label, color, action, url: None, automation_id: Some(automation_id), target, confirm })
}

/// `createTableButton`.
pub async fn create_button(pools: &Pools, ctx: &RequestContext, table_id: &str, input: &Value) -> R<TableButton> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let s = settings_of(&tx, table_id, input).await?;
        let count = tx
            .first(
                "SELECT count(*)::int AS n, coalesce(max(position) + 1, 0)::int AS next
                   FROM _basedb.table_button WHERE table_id = $1::text::uuid",
                &[&table_id],
            )
            .await?;
        let (n, next): (i32, i32) = count.map(|r| (r.get(0), r.get(1))).unwrap_or((0, 0));
        if n >= MAX_BUTTONS {
            return Err(refuse("table", "trop_de_boutons"));
        }
        let created = tx
            .query_op(
                "INSERT INTO _basedb.table_button
                   (table_id, label, color, action, url, automation_id, target, confirm, position,
                    created_by, updated_by)
                 VALUES ($1::text::uuid, $2::text, $3::text, $4::text, $5::text, $6::text::uuid, $7::text,
                         $8::boolean, $9::int, $10::text::uuid, $10::text::uuid)
                 RETURNING id::text",
                &[&table_id, &s.label, &s.color, &s.action, &s.url, &s.automation_id, &s.target, &s.confirm, &next, &ctx.actor.id],
                SqlOp::Insert,
            )
            .await?;
        let id: String = created[0].get(0);
        read_one(&tx, &id, None).await
    })
    .await
}

/// `updateTableButton`: what the request leaves out stays as it was.
pub async fn update_button(pools: &Pools, ctx: &RequestContext, table_id: &str, button_id: &str, input: &Value) -> R<TableButton> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let current = read_one(&tx, button_id, Some(table_id)).await?;
        let mut merged = Map::new();
        merged.insert("label".into(), json!(current.label));
        merged.insert("color".into(), json!(current.color));
        merged.insert("action".into(), json!(current.action));
        merged.insert("url".into(), json!(current.url));
        if let Some((id, _)) = &current.automation {
            merged.insert("automation".into(), json!(id));
        }
        merged.insert("target".into(), json!(current.target));
        merged.insert("confirm".into(), json!(current.confirm));
        if let Value::Object(m) = input {
            for (k, v) in m {
                merged.insert(k.clone(), v.clone());
            }
        }
        let s = settings_of(&tx, table_id, &Value::Object(merged)).await?;
        if input.is_null() {
            return Err(AppError::internal("Cannot read properties of null (reading 'position')"));
        }
        let position: i64 = match input.get("position") {
            Some(Value::Number(n)) if n.as_f64().is_some_and(|f| f.is_finite() && f.fract() == 0.0) => n.as_f64().unwrap() as i64,
            _ => current.position as i64,
        };
        tx.execute_op(
            "UPDATE _basedb.table_button
                SET label = $2::text, color = $3::text, action = $4::text, url = $5::text,
                    automation_id = $6::text::uuid, target = $7::text, confirm = $8::boolean,
                    position = $9::bigint, updated_at = clock_timestamp(), updated_by = $10::text::uuid
              WHERE id = $1::text::uuid",
            &[&current.id, &s.label, &s.color, &s.action, &s.url, &s.automation_id, &s.target, &s.confirm, &position, &ctx.actor.id],
            SqlOp::Update,
        )
        .await?;
        read_one(&tx, &current.id, None).await
    })
    .await
}

/// `deleteTableButton`: for good — buttons have no bin.
pub async fn delete_button(pools: &Pools, ctx: &RequestContext, table_id: &str, button_id: &str) -> R<()> {
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_table(&tx, ctx, Action::ManageSchema, table_id).await?;
        let current = read_one(&tx, button_id, Some(table_id)).await?;
        tx.execute_op("DELETE FROM _basedb.table_button WHERE id = $1::text::uuid", &[&current.id], SqlOp::Delete).await?;
        Ok(())
    })
    .await
}

/// `readOne`: a button, of the table when one is named.
pub async fn read_one<E: Exec + Sync>(exec: &E, button_id: &str, table_id: Option<&str>) -> R<TableButton> {
    let not_found = || AppError::new("RESOURCE_NOT_FOUND").with("button", json!(button_id));
    if !is_uuid(button_id) {
        return Err(not_found());
    }
    let row = match table_id {
        None => exec.first(&format!("{SELECT} WHERE b.id = $1::text::uuid"), &[&button_id]).await?,
        Some(t) => exec.first(&format!("{SELECT} WHERE b.id = $1::text::uuid AND b.table_id = $2::text::uuid"), &[&button_id, &t]).await?,
    };
    row.as_ref().map(to_button).ok_or_else(not_found)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses_open_a_page_or_a_mail_never_a_script() {
        assert!(is_address("https://example.org"));
        assert!(is_address("HTTP://example.org"));
        assert!(is_address("mailto:a@b.c"));
        assert!(!is_address("javascript:alert(1)"));
        assert!(!is_address("ftp://x"));
    }

    #[test]
    fn identifiers_and_colours() {
        assert!(is_uuid("01A1F442-CA03-7F69-A649-C73901BE9A61"));
        assert!(!is_uuid("01a1f442"));
        assert!(is_color("#a0b1c2"));
        assert!(!is_color("#A0B1C2"));
        assert!(!is_color("#abc"));
    }
}
