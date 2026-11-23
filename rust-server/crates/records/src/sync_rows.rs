//! The row writes of a synced table (`apply` of `sync/tables.ts`, chapter 19 §3.2).
//!
//! The synchronisation routes — creating a synced table adds its fields, which the catalog
//! crate owns — call [`apply`] once the source is read and keyed. The writer is the
//! system: [`crate::write::refuse_synced`] lets it, and nobody else.

use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::tx::RequestContext;
use indexmap::IndexMap;
use serde_json::{Map, Value};

use crate::list::{list_records, ListOptions};
use crate::write::{create_records, delete_rows, update_records};

/// How a synced table follows its source.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SyncMode {
    /// Created, changed, deleted: the table is the source.
    Mirror,
    /// Created and changed, never deleted.
    Upsert,
    /// Only the keys never seen.
    Insert,
    /// Every row deleted, every row of the source written.
    Replace,
    /// Every row of the source added, dated.
    Snapshot,
}

impl SyncMode {
    pub fn parse(text: &str) -> Option<SyncMode> {
        Some(match text {
            "mirror" => SyncMode::Mirror,
            "upsert" => SyncMode::Upsert,
            "insert" => SyncMode::Insert,
            "replace" => SyncMode::Replace,
            "snapshot" => SyncMode::Snapshot,
            _ => return None,
        })
    }
}

/// A source column and the field that holds it.
#[derive(Clone, Debug)]
pub struct SyncColumn {
    pub key: String,
    pub field: String,
    pub kind: String,
}

pub struct SyncTarget {
    pub table_id: String,
    pub key_field: String,
    pub stamp_field: Option<String>,
    pub columns: Vec<SyncColumn>,
}

/// A row of the source, by its key.
pub struct SourceRow {
    pub key: String,
    pub values: Map<String, Value>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SyncCounts {
    pub created: usize,
    pub updated: usize,
    pub deleted: i64,
}

/// `String(v)`, `null` and `undefined` as `''` (`String(v ?? '')`).
fn js_string(v: Option<&Value>) -> String {
    match v {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => n.as_f64().map(crate::js::number_string).unwrap_or_else(|| n.to_string()),
        Some(Value::Array(a)) => a.iter().map(|v| js_string(Some(v))).collect::<Vec<_>>().join(","),
        Some(Value::Object(_)) => "[object Object]".into(),
    }
}

/// `Number(v)`.
fn js_number(v: Option<&Value>) -> f64 {
    match v {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => f64::from(u8::from(*b)),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::Object(_)) => f64::NAN,
        Some(other @ (Value::String(_) | Value::Array(_))) => {
            if let Value::Array(a) = other {
                if a.len() > 1 {
                    return f64::NAN;
                }
            }
            let text = js_string(Some(other));
            let t = crate::js::js_trim(&text);
            if t.is_empty() {
                return 0.0;
            }
            let lower = t.to_ascii_lowercase();
            for (prefix, radix) in [("0x", 16), ("0o", 8), ("0b", 2)] {
                if let Some(digits) = lower.strip_prefix(prefix) {
                    return u64::from_str_radix(digits, radix).map(|n| n as f64).unwrap_or(f64::NAN);
                }
            }
            match t {
                "Infinity" | "+Infinity" => f64::INFINITY,
                "-Infinity" => f64::NEG_INFINITY,
                _ if t.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | 'e' | 'E' | '+' | '-')) => t.parse().unwrap_or(f64::NAN),
                _ => f64::NAN,
            }
        }
    }
}

/// `same`: two values as the same cell holds them — a date by its day, a number by its value.
pub fn same(a: Option<&Value>, b: Option<&Value>, kind: &str) -> bool {
    let empty = |v: Option<&Value>| matches!(v, None | Some(Value::Null)) || v.and_then(Value::as_str) == Some("");
    if empty(a) && empty(b) {
        return true;
    }
    // `String(undefined)`, unlike `String(v ?? '')`.
    let raw = |v: Option<&Value>| if v.is_none() { "undefined".to_string() } else if v == Some(&Value::Null) { "null".to_string() } else { js_string(v) };
    match kind {
        "number" => js_number(a) == js_number(b),
        "datetime" => {
            // The current value is the `Date` pg gives, and `String(date)` drops its
            // milliseconds: a stored instant with some never equals its source.
            let at = |v| basedb_catalog::field_config::js_date_parse(&raw(v)).map(|t| t.timestamp_millis());
            matches!((at(a), at(b)), (Some(x), Some(y)) if x.div_euclid(1000) * 1000 == y)
        }
        "date" => raw(a).chars().take(10).collect::<String>() == raw(b).chars().take(10).collect::<String>(),
        _ => js_string(a) == js_string(b),
    }
}

/// Brings a synced table to its source, as its mode says, and returns what it did.
pub async fn apply(
    pools: &Pools,
    ctx: &RequestContext,
    instance_key: &str,
    target: &SyncTarget,
    mode: SyncMode,
    rows: &[SourceRow],
) -> Result<SyncCounts, AppError> {
    let table_id = target.table_id.as_str();
    let values_of = |values: &Map<String, Value>| -> Map<String, Value> {
        target.columns.iter().map(|c| (c.field.clone(), values.get(&c.key).cloned().unwrap_or(Value::Null))).collect()
    };
    let stamp = match (&target.stamp_field, mode) {
        (Some(field), SyncMode::Snapshot) => Some((field.clone(), Value::from(basedb_base::time::iso(ctx.timestamp)))),
        _ => None,
    };
    let create = |rows: Vec<&SourceRow>| {
        let records: Vec<Value> = rows
            .iter()
            .map(|r| {
                let mut record = Map::new();
                record.insert(target.key_field.clone(), Value::from(r.key.clone()));
                record.extend(values_of(&r.values));
                if let Some((field, at)) = &stamp {
                    record.insert(field.clone(), at.clone());
                }
                Value::Object(record)
            })
            .collect();
        async move {
            let n = records.len();
            let mut records = records.into_iter().peekable();
            while records.peek().is_some() {
                let chunk: Vec<Value> = records.by_ref().take(1000).collect();
                create_records(pools, ctx, table_id, chunk).await?;
            }
            Ok::<_, AppError>(n)
        }
    };

    match mode {
        SyncMode::Snapshot => return Ok(SyncCounts { created: create(rows.iter().collect()).await?, ..Default::default() }),
        SyncMode::Replace => {
            let deleted = delete_rows(pools, ctx, table_id, None).await?;
            return Ok(SyncCounts { created: create(rows.iter().collect()).await?, updated: 0, deleted });
        }
        _ => {}
    }

    let mut select = vec![target.key_field.clone()];
    if mode != SyncMode::Insert {
        select.extend(target.columns.iter().map(|c| c.field.clone()));
    }
    let mut existing: IndexMap<String, Map<String, Value>> = IndexMap::new();
    let mut after: Option<String> = None;
    loop {
        let options = ListOptions {
            table_id: table_id.to_string(),
            select: Some(select.clone()),
            limit: Some(500.0),
            after: after.clone(),
            links_id: true,
            variables_raw: true,
            ..Default::default()
        };
        let page = list_records(pools, ctx, instance_key, &options).await?;
        for row in page.rows {
            existing.insert(js_string(row.get(&target.key_field)), row);
        }
        after = page.next_cursor;
        if after.is_none() {
            break;
        }
    }

    let created = create(rows.iter().filter(|r| !existing.contains_key(&r.key)).collect()).await?;
    if mode == SyncMode::Insert {
        return Ok(SyncCounts { created, ..Default::default() });
    }

    let mut updates: Vec<(String, Value)> = Vec::new();
    for row in rows {
        let Some(current) = existing.get(&row.key) else { continue };
        let values = values_of(&row.values);
        let changed: Map<String, Value> = target
            .columns
            .iter()
            .filter(|c| !same(current.get(&c.field), values.get(&c.field), &c.kind))
            .map(|c| (c.field.clone(), values.get(&c.field).cloned().unwrap_or(Value::Null)))
            .collect();
        if !changed.is_empty() {
            updates.push((js_string(current.get("_id")), Value::Object(changed)));
        }
    }
    let updated = updates.len();
    let mut pending = updates.into_iter().peekable();
    while pending.peek().is_some() {
        let chunk: Vec<(String, Value)> = pending.by_ref().take(1000).collect();
        update_records(pools, ctx, table_id, chunk).await?;
    }
    if mode == SyncMode::Upsert {
        return Ok(SyncCounts { created, updated, deleted: 0 });
    }

    let keep: std::collections::HashSet<&str> = rows.iter().map(|r| r.key.as_str()).collect();
    let gone: Vec<String> = existing.iter().filter(|(key, _)| !keep.contains(key.as_str())).map(|(_, row)| js_string(row.get("_id"))).collect();
    let deleted = delete_rows(pools, ctx, table_id, Some(&gone)).await?;
    Ok(SyncCounts { created, updated, deleted })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cells_compare_as_the_column_holds_them() {
        assert!(same(Some(&json!(null)), Some(&json!("")), "short_text"));
        assert!(same(None, Some(&json!(null)), "number"));
        assert!(same(Some(&json!("12.5000000000")), Some(&json!(12.5)), "number"));
        assert!(!same(Some(&json!("abc")), Some(&json!("abc")), "number"));
        assert!(same(Some(&json!("2026-03-01T10:00:00.000Z")), Some(&json!("2026-03-01T11:00:00+01:00")), "datetime"));
        assert!(!same(Some(&json!("2026-03-01T10:00:00.250Z")), Some(&json!("2026-03-01T10:00:00.250Z")), "datetime"));
        assert!(same(Some(&json!("2026-03-01")), Some(&json!("2026-03-01T00:00:00Z")), "date"));
        assert!(!same(Some(&json!("x")), Some(&json!(null)), "short_text"));
        assert!(same(Some(&json!(true)), Some(&json!("true")), "boolean"));
        assert!(same(Some(&json!(["a", "b"])), Some(&json!("a,b")), "multi_select"));
    }
}
