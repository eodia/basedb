//! `/meta` serializations (`catalog/meta.ts`) and the operators each kind declares
//! (`operatorsFor`, `sortableKind` of `records/filter.ts`).

use crate::projection::{ProjectedBase, ProjectedField, VisibleBase};
use serde_json::{json, Map, Value};

const EQ: [&str; 3] = ["eq", "ne", "in"];
const ORD: [&str; 5] = ["gt", "gte", "lt", "lte", "between"];

/// `operatorsFor`: the filter operators a kind declares, in the published order.
pub fn operators_for(kind: &str) -> Vec<&'static str> {
    let cat = |parts: &[&[&'static str]]| parts.iter().flat_map(|p| p.iter().copied()).collect::<Vec<_>>();
    match kind {
        "short_text" | "url" | "email" => cat(&[&EQ, &["eq_ci", "contains", "starts_with", "ends_with", "is_null"]]),
        "long_text" => vec!["contains", "is_null"],
        "number" | "date" | "datetime" | "formula" | "autonumber" | "rollup" | "count" => cat(&[&EQ, &ORD, &["is_null"]]),
        "boolean" => vec!["eq", "is_null"],
        "select" | "link" | "user" => cat(&[&EQ, &["is_null"]]),
        "multi_select" | "multi_link" | "lookup" => vec!["has_any", "has_all", "is_null"],
        "file" | "image" => vec!["is_null"],
        _ => vec![],
    }
}

/// `sortableKind`.
pub fn sortable_kind(kind: &str) -> bool {
    !matches!(kind, "long_text" | "multi_select" | "multi_link" | "lookup" | "file" | "image" | "button")
}

/// `toBaseList`.
pub fn to_base_list(bases: &[VisibleBase]) -> Value {
    Value::Array(
        bases
            .iter()
            .map(|b| {
                json!({
                    "id": b.id,
                    "name": b.name,
                    "label": b.label,
                    "description": b.description,
                    "color": b.color,
                    "icon": b.icon,
                    "image": b.image,
                    "project": b.project.to_json(),
                    "environment": b.environment.to_json(),
                    "table_count": b.table_count,
                })
            })
            .collect(),
    )
}

fn field_meta(f: &ProjectedField) -> Value {
    let mut m = Map::new();
    m.insert("name".into(), json!(f.name));
    m.insert("label".into(), json!(f.label));
    m.insert("description".into(), json!(f.description));
    m.insert("kind".into(), json!(f.kind));
    m.insert("required".into(), json!(f.required));
    if f.unique {
        m.insert("unique".into(), json!(true));
    }
    m.insert("read_only".into(), json!(f.read_only));
    m.insert("system".into(), json!(f.system));
    m.insert("operators".into(), json!(operators_for(f.effective_kind())));
    m.insert("sortable".into(), json!(sortable_kind(f.effective_kind())));
    if f.unsafe_html {
        m.insert("unsafe_html".into(), json!(true));
    }
    if f.ai {
        m.insert("ai".into(), json!(true));
    }
    if let Some(options) = &f.options {
        m.insert("options".into(), Value::Array(options.iter().map(|o| o.to_json()).collect()));
    }
    if let Some(format) = &f.format {
        m.insert("format".into(), json!({ "display": format.display, "currency": format.currency, "rating_max": format.rating_max }));
    }
    if let Some(c) = &f.computed {
        let mut cm = Map::new();
        cm.insert("result_kind".into(), json!(c.result_kind));
        cm.insert("stored".into(), json!(c.stored));
        cm.insert("multiple".into(), json!(c.multiple));
        if let Some(expression) = &c.expression {
            cm.insert("expression".into(), json!(expression));
            cm.insert("timezone".into(), json!(c.timezone));
        }
        if let Some(via) = &c.via {
            cm.insert("via".into(), via.to_json());
            cm.insert("target".into(), json!(c.target));
            cm.insert("aggregate".into(), json!(c.aggregate));
        }
        m.insert("computed".into(), Value::Object(cm));
    }
    if let Some(button) = &f.button {
        m.insert("button".into(), button.to_json());
    }
    if let Some(default) = &f.default {
        m.insert("default".into(), default.to_json());
    }
    if let Some(link) = &f.link {
        let mut lm = Map::new();
        lm.insert("on_delete".into(), json!(link.on_delete));
        lm.insert("required".into(), json!(link.required));
        lm.insert("expandable".into(), json!(link.expandable));
        lm.insert("masked".into(), json!(link.masked));
        if let Some(target) = &link.target {
            lm.insert("target".into(), json!(target.table));
            lm.insert("target_display_field".into(), json!(target.display_field));
        }
        m.insert("link".into(), Value::Object(lm));
    }
    Value::Object(m)
}

/// `toMeta`: one base, with its tables and fields.
pub fn to_meta(base: &ProjectedBase) -> Value {
    let tables: Vec<Value> = base
        .tables
        .iter()
        .map(|t| {
            let mut m = Map::new();
            m.insert("id".into(), json!(t.id));
            m.insert("name".into(), json!(t.name));
            m.insert("label".into(), json!(t.label));
            m.insert("description".into(), json!(t.description));
            m.insert("color".into(), json!(t.color));
            m.insert("icon".into(), json!(t.icon));
            m.insert("image".into(), json!(t.image));
            m.insert("base".into(), json!(base.name));
            m.insert("sql".into(), json!(t.sql));
            m.insert("actions".into(), json!(t.actions.iter().map(|a| a.as_str()).collect::<Vec<_>>()));
            m.insert("referenced_by".into(), json!(t.referenced_by));
            if t.synced {
                m.insert("synced".into(), json!(true));
            }
            m.insert("display_field".into(), json!(t.display_field));
            m.insert("fields".into(), Value::Array(t.fields.iter().map(field_meta).collect()));
            Value::Object(m)
        })
        .collect();
    json!({
        "id": base.id,
        "name": base.name,
        "label": base.label,
        "description": base.description,
        "color": base.color,
        "icon": base.icon,
        "image": base.image,
        "project": base.project.to_json(),
        "environment": base.environment.to_json(),
        "actions": base.base_actions.iter().map(|a| a.as_str()).collect::<Vec<_>>(),
        "tables": tables,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operators_follow_the_kind() {
        assert_eq!(operators_for("short_text"), ["eq", "ne", "in", "eq_ci", "contains", "starts_with", "ends_with", "is_null"]);
        assert_eq!(operators_for("number"), ["eq", "ne", "in", "gt", "gte", "lt", "lte", "between", "is_null"]);
        assert!(operators_for("button").is_empty());
        assert!(operators_for("system").is_empty());
        assert!(!sortable_kind("lookup"));
        assert!(sortable_kind("system"));
    }
}
