//! Reading the structure history of a base (`history/structure.ts`, chapter 07 §8.1): one
//! line per act, what it touched, and the attributes that changed from what to what.

use crate::js::js_numbers;
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_base;
use basedb_base::time::iso;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

type R<T> = Result<T, AppError>;

const ATTRIBUTES: &[(&str, &[(&str, &str)])] = &[
    (
        "base",
        &[
            ("label", "Libellé"),
            ("description", "Description"),
            ("color", "Couleur"),
            ("icon", "Pictogramme"),
            ("image", "Image"),
            ("environment", "Environnement"),
            ("mcp_enabled", "Ouverte aux agents"),
            ("structure_state", "État de la structure"),
        ],
    ),
    (
        "table_def",
        &[
            ("label", "Libellé"),
            ("description", "Description"),
            ("color", "Couleur"),
            ("icon", "Pictogramme"),
            ("image", "Image"),
            ("display_field_id", "Colonne d’affichage"),
        ],
    ),
    ("field", &[("label", "Libellé"), ("description", "Description"), ("is_required", "Obligatoire"), ("expose_to_agents", "Visible des agents")]),
    ("field_ai_config", &[("prompt", "Consigne"), ("refresh_mode", "Rafraîchissement"), ("refresh_cron", "Planning")]),
    ("select_option", &[("label", "Libellé"), ("color", "Couleur"), ("icon", "Pictogramme"), ("image", "Image")]),
];

fn kind_label(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "short_text" => "texte",
        "long_text" => "texte long",
        "url" => "lien URL",
        "number" => "nombre",
        "boolean" => "booléen",
        "date" => "date",
        "datetime" => "date et heure",
        "select" => "liste de choix",
        "multi_select" => "choix multiple",
        "file" => "document",
        "image" => "image",
        "link" => "relation",
        "formula" => "formule",
        _ => return None,
    })
}

/// `String(value)` of JavaScript, for what a catalog image holds.
pub fn js_string(value: &Value) -> String {
    match value {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => match n.as_f64() {
            Some(f) if f.fract() == 0.0 && f.abs() < 1e21 => format!("{}", f as i128),
            Some(f) => format!("{f}"),
            None => n.to_string(),
        },
        Value::String(s) => s.clone(),
        Value::Array(items) => items.iter().map(|v| if v.is_null() { String::new() } else { js_string(v) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `text`: what a person reads of a value.
fn text(value: Option<&Value>) -> Option<String> {
    match value {
        None | Some(Value::Null) => None,
        Some(Value::Bool(b)) => Some(if *b { "oui" } else { "non" }.into()),
        Some(Value::String(s)) => Some(if s.starts_with("data:") { "(image)".into() } else { s.clone() }),
        Some(v) => Some(js_string(v)),
    }
}

/// `JSON.stringify(v)`, `undefined` included.
fn stringify(value: Option<&Value>) -> Option<String> {
    value.map(|v| js_numbers(v.clone()).to_string())
}

fn changes_of(table: &str, before: &Value, after: &Value, field_labels: &HashMap<String, String>) -> Vec<Value> {
    if before.is_null() || after.is_null() {
        return Vec::new();
    }
    let attributes = ATTRIBUTES.iter().find(|(t, _)| *t == table).map(|(_, a)| *a).unwrap_or(&[]);
    let mut out = Vec::new();
    for (key, attribute) in attributes {
        let from = before.get(*key);
        let to = after.get(*key);
        if stringify(from) == stringify(to) {
            continue;
        }
        let say = |value: Option<&Value>| -> Option<String> {
            match value {
                Some(Value::String(id)) if *key == "display_field_id" => field_labels.get(id).cloned(),
                _ => text(value),
            }
        };
        out.push(json!({ "attribute": attribute, "from": say(from), "to": say(to) }));
    }
    out
}

fn label(row: &Value) -> Option<String> {
    row.get("label").and_then(Value::as_str).map(String::from)
}

/// `Math.min(Math.max(limit ?? 50, 1), 200)`: may stay fractional, as in JavaScript.
#[allow(clippy::manual_clamp)] // `max`/`min` turn a NaN into a bound; `clamp` would keep it.
pub fn clamp_limit(limit: f64) -> f64 {
    limit.max(1.0).min(200.0)
}

fn js_number_text(f: f64) -> String {
    if f.fract() == 0.0 && f.abs() < 1e21 {
        format!("{}", f as i128)
    } else {
        format!("{f}")
    }
}

/// `structureHistory`: one page, most recent first. `manage_schema` on the base.
pub async fn structure_history(pools: &Pools, ctx: &RequestContext, base_id: &str, before: Option<&str>, limit: f64) -> R<Value> {
    let limit = clamp_limit(limit);
    with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        let fetch = js_number_text(limit + 1.0);
        let rows = tx
            .rows(
                "SELECT r.id::text, r.occurred_at, r.op, r.object_kind, r.catalog_table, r.before_row,
                        r.after_row, r.migration_id::text, r.actor_kind, u.display_name AS actor_name,
                        f.label AS field_label, f.kind AS field_kind,
                        coalesce(ft.label, t.label) AS table_label
                   FROM _basedb.structure_revision r
                   LEFT JOIN _basedb.app_user u ON u.id = r.actor_user_id
                   LEFT JOIN _basedb.field f ON f.id = CASE
                        WHEN r.object_kind IN ('field', 'field_config') THEN r.object_id
                        WHEN r.object_kind = 'select_option' THEN r.parent_object_id END
                   LEFT JOIN _basedb.table_def ft ON ft.id = f.table_id
                   LEFT JOIN _basedb.table_def t  ON t.id = r.object_id AND r.object_kind = 'table_def'
                  WHERE r.base_id = $1::text::uuid
                    AND r.object_kind IN ('base', 'table_def', 'field', 'field_config', 'select_option')
                    AND ($2::text::uuid IS NULL OR r.id < $2::text::uuid)
                  ORDER BY r.id DESC
                  LIMIT $3::text::bigint",
                &[&base_id, &before, &fetch],
            )
            .await?;

        let mut display_ids: Vec<String> = Vec::new();
        for r in &rows {
            let catalog_table: String = r.get(4);
            for image in [r.get::<_, Option<Value>>(5), r.get::<_, Option<Value>>(6)].into_iter().flatten() {
                if let Some(Value::String(id)) = image.get("display_field_id") {
                    if catalog_table == "table_def" && !display_ids.contains(id) {
                        display_ids.push(id.clone());
                    }
                }
            }
        }
        let mut field_labels = HashMap::new();
        if !display_ids.is_empty() {
            for f in tx.rows("SELECT id::text, label FROM _basedb.field WHERE id = ANY($1::text[]::uuid[])", &[&display_ids]).await? {
                field_labels.insert(f.get::<_, String>(0), f.get::<_, String>(1));
            }
        }

        let take = limit as usize;
        let mut events = Vec::new();
        for r in rows.iter().take(take) {
            let id: String = r.get(0);
            let occurred_at: DateTime<Utc> = r.get(1);
            let raw_op: String = r.get(2);
            let catalog_table: String = r.get(4);
            let before_row: Value = r.get::<_, Option<Value>>(5).unwrap_or(Value::Null);
            let after_row: Value = r.get::<_, Option<Value>>(6).unwrap_or(Value::Null);
            let migration_id: Option<String> = r.get(7);
            let actor_kind: String = r.get(8);
            let actor_name: Option<String> = r.get(9);
            let field_label: Option<String> = r.get(10);
            let field_kind: Option<String> = r.get(11);
            let table_label: Option<String> = r.get(12);

            let image = if after_row.is_null() { &before_row } else { &after_row };
            let op = if raw_op == "replace" { "update".to_string() } else { raw_op };
            let changes = changes_of(&catalog_table, &before_row, &after_row, &field_labels);
            let field = field_label.clone().or_else(|| label(image));
            let fl = field_label.clone().unwrap_or_default();
            let (object, summary) = match catalog_table.as_str() {
                "base" => (
                    "base",
                    match op.as_str() {
                        "create" => format!("Base « {} » créée", label(image).unwrap_or_default()),
                        "soft_delete" => "Base supprimée".into(),
                        "restore" => "Base restaurée".into(),
                        _ => "Base modifiée".into(),
                    },
                ),
                "table_def" => {
                    let name = label(image).or_else(|| table_label.clone()).unwrap_or_default();
                    (
                        "table",
                        match op.as_str() {
                            "create" => format!("Table « {name} » créée"),
                            "soft_delete" => format!("Table « {name} » supprimée"),
                            "restore" => format!("Table « {name} » restaurée"),
                            "rename_physical" => format!("Table « {name} » renommée en base"),
                            "purge" => format!("Table « {name} » purgée"),
                            _ => format!("Table « {name} » modifiée"),
                        },
                    )
                }
                "field" => {
                    let kind = match image.get("kind") {
                        Some(Value::String(k)) => k.clone(),
                        _ => field_kind.clone().unwrap_or_default(),
                    };
                    let f = field.clone().unwrap_or_default();
                    (
                        "field",
                        match op.as_str() {
                            "create" => format!("Champ « {f} » ajouté ({})", kind_label(&kind).map(String::from).unwrap_or(kind.clone())),
                            "soft_delete" => format!("Champ « {f} » supprimé"),
                            "restore" => format!("Champ « {f} » restauré"),
                            "rename_physical" => format!("Champ « {f} » renommé en base"),
                            _ => format!("Champ « {f} » modifié"),
                        },
                    )
                }
                "select_option" => {
                    let value = image.get("label").and_then(Value::as_str).unwrap_or("").to_string();
                    let deleted = |row: &Value| !matches!(row.get("deleted_at"), None | Some(Value::Null));
                    let retired = op == "purge" || (!deleted(&before_row) && deleted(&after_row));
                    (
                        "option",
                        if op == "create" {
                            format!("Choix « {value} » ajouté à « {fl} »")
                        } else if retired || op == "soft_delete" {
                            format!("Choix « {value} » retiré de « {fl} »")
                        } else {
                            format!("Choix « {value} » de « {fl} » modifié")
                        },
                    )
                }
                "field_ai_config" => (
                    "ai",
                    match op.as_str() {
                        "create" => format!("IA activée sur « {fl} »"),
                        "purge" => format!("IA retirée de « {fl} »"),
                        _ => format!("IA de « {fl} » modifiée"),
                    },
                ),
                _ => {
                    if op == "create" || op == "purge" {
                        continue;
                    }
                    ("config", format!("Configuration de « {fl} » modifiée"))
                }
            };
            if op == "update" && changes.is_empty() && object != "config" {
                continue;
            }
            let mut event = Map::new();
            event.insert("id".into(), json!(id));
            event.insert("at".into(), json!(iso(occurred_at)));
            event.insert("op".into(), json!(op));
            event.insert("object".into(), json!(object));
            event.insert("table".into(), if object == "base" { Value::Null } else { json!(table_label) });
            event.insert("field".into(), if object == "base" || object == "table" { Value::Null } else { json!(field_label.clone().or(field)) });
            event.insert("summary".into(), json!(summary));
            event.insert("changes".into(), Value::Array(changes));
            event.insert("actor".into(), json!({ "kind": actor_kind, "name": actor_name }));
            event.insert("migrationId".into(), json!(migration_id));
            events.push(Value::Object(event));
        }
        // `rows[limit - 1]`: none when the limit is fractional.
        let last = if limit.fract() == 0.0 { rows.get(take.wrapping_sub(1)) } else { None };
        let next = match last {
            Some(r) if rows.len() as f64 > limit => json!(r.get::<_, String>(0)),
            _ => Value::Null,
        };
        Ok(json!({ "events": events, "next": next }))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn changes_name_what_a_person_reads() {
        let labels: HashMap<String, String> = [("f1".to_string(), "Nom".to_string())].into();
        let before = json!({ "label": "A", "display_field_id": null, "color": "#aaa", "image": "data:x" });
        let after = json!({ "label": "B", "display_field_id": "f1", "color": "#aaa", "image": "data:y" });
        assert_eq!(
            changes_of("table_def", &before, &after, &labels),
            vec![
                json!({ "attribute": "Libellé", "from": "A", "to": "B" }),
                json!({ "attribute": "Image", "from": "(image)", "to": "(image)" }),
                json!({ "attribute": "Colonne d’affichage", "from": null, "to": "Nom" }),
            ]
        );
        assert!(changes_of("field", &Value::Null, &after, &labels).is_empty());
        assert_eq!(changes_of("field", &json!({ "is_required": false }), &json!({ "is_required": true }), &labels), vec![json!({ "attribute": "Obligatoire", "from": "non", "to": "oui" })]);
    }

    #[test]
    fn limits_stay_javascript_numbers() {
        assert_eq!(clamp_limit(0.0), 1.0);
        assert_eq!(clamp_limit(500.0), 200.0);
        assert_eq!(clamp_limit(2.5), 2.5);
        assert_eq!(js_number_text(3.5), "3.5");
        assert_eq!(js_number_text(51.0), "51");
    }
}
