//! Cursor pagination — `records/cursor.ts`: sealed, bound to the actor, the table and the
//! query's shape. Node and Rust share the instance key: each opens the other's cursors.

use basedb_base::error::AppError;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::filter::SortTerm;
use crate::sealing::{seal, unseal};

const PURPOSE: &str = "cursor";

pub struct Binding<'a> {
    pub actor_id: &'a str,
    pub table_id: &'a str,
    pub fingerprint: &'a str,
}

pub struct Payload {
    pub keys: Vec<Value>,
    pub id: String,
}

/// `fingerprintOf`.
pub fn fingerprint_of(sort: &str, filter: &str, columns: &[String]) -> String {
    let mut h = Sha256::new();
    h.update(sort.as_bytes());
    h.update(b" ");
    h.update(filter.as_bytes());
    h.update(b" ");
    h.update(columns.join(",").as_bytes());
    let digest = basedb_base::time::b64url(&h.finalize());
    digest.chars().take(16).collect()
}

pub fn encode_cursor(key: &str, keys: &[Value], id: &str, binding: &Binding) -> String {
    let payload = json!({ "a": binding.actor_id, "t": binding.table_id, "q": binding.fingerprint, "k": keys, "i": id });
    seal(key, PURPOSE, &basedb_base::idempotency::js_stringify(&payload))
}

pub fn decode_cursor(key: &str, raw: &str, binding: &Binding) -> Result<Payload, AppError> {
    let illegible = || AppError::new("CURSOR_INVALID").with("reason", json!("illisible"));
    let opened = unseal(key, PURPOSE, raw).ok_or_else(illegible)?;
    let parsed: Value = serde_json::from_str(&opened).map_err(|_| illegible())?;
    let parsed = basedb_catalog::js::js_numbers(parsed);
    let id = parsed.get("i").and_then(Value::as_str);
    let keys = parsed.get("k").and_then(Value::as_array);
    let (Some(id), Some(keys)) = (id, keys) else {
        return Err(AppError::new("CURSOR_INVALID").with("reason", json!("curseur étranger")));
    };
    if parsed.get("a").and_then(Value::as_str) != Some(binding.actor_id) || parsed.get("t").and_then(Value::as_str) != Some(binding.table_id) {
        return Err(AppError::new("CURSOR_INVALID").with("reason", json!("curseur étranger")));
    }
    if parsed.get("q").and_then(Value::as_str) != Some(binding.fingerprint) {
        return Err(AppError::new("CURSOR_STALE")
            .with("reason", json!("le tri, le filtre ou la projection ont changé"))
            .with("retry_from_start", json!(true)));
    }
    Ok(Payload { keys: keys.clone(), id: id.to_string() })
}

/// `keysetPredicate`: the deeper levels bind first, as Node's recursion does.
pub fn keyset_predicate(terms: &[SortTerm], keys: &[Value], id: &str, id_expression: &str, params: &mut Vec<Value>, cast_of: &dyn Fn(&SortTerm) -> String) -> String {
    fn level(i: usize, terms: &[SortTerm], keys: &[Value], id: &str, id_expression: &str, params: &mut Vec<Value>, cast_of: &dyn Fn(&SortTerm) -> String) -> String {
        if i >= terms.len() {
            params.push(Value::String(id.to_string()));
            return format!("{id_expression} > ${}::uuid", params.len());
        }
        let term = &terms[i];
        let value = keys.get(i).cloned().unwrap_or(Value::Null);
        let tail = level(i + 1, terms, keys, id, id_expression, params, cast_of);
        let e = &term.expression;
        if value.is_null() {
            return if term.descending { format!("({e} IS NULL AND ({tail}) OR {e} IS NOT NULL)") } else { format!("({e} IS NULL AND ({tail}))") };
        }
        params.push(value);
        let ph = format!("${}::{}", params.len(), cast_of(term));
        let strictly = if term.descending { format!("{e} < {ph}") } else { format!("{e} > {ph}") };
        let nulls = if term.descending { String::new() } else { format!(" OR {e} IS NULL") };
        format!("({strictly}{nulls} OR ({e} = {ph} AND ({tail})))")
    }
    level(0, terms, keys, id, id_expression, params, cast_of)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursors_bind_actor_table_and_shape() {
        let b = Binding { actor_id: "user:1", table_id: "t1", fingerprint: "fp" };
        let c = encode_cursor("k", &[json!("x"), Value::Null], "id-1", &b);
        let p = decode_cursor("k", &c, &b).unwrap();
        assert_eq!((p.keys, p.id.as_str()), (vec![json!("x"), Value::Null], "id-1"));
        let other = Binding { actor_id: "user:2", ..b };
        assert_eq!(decode_cursor("k", &c, &other).err().unwrap().details["reason"], "curseur étranger");
        let stale = Binding { actor_id: "user:1", table_id: "t1", fingerprint: "fp2" };
        assert_eq!(decode_cursor("k", &c, &stale).err().unwrap().code, "CURSOR_STALE");
        assert_eq!(decode_cursor("k", "nope", &stale).err().unwrap().details["reason"], "illisible");
    }

    #[test]
    fn keyset_binds_the_tail_first() {
        let terms = vec![SortTerm { name: "n".into(), kind: "number".into(), descending: true, expression: "\"t\".\"n\"".into() }];
        let mut params = vec![json!("filter")];
        let sql = keyset_predicate(&terms, &[json!("3")], "id", "\"t\".\"_id\"", &mut params, &|_| "numeric".into());
        assert_eq!(sql, "(\"t\".\"n\" < $3::numeric OR (\"t\".\"n\" = $3::numeric AND (\"t\".\"_id\" > $2::uuid)))");
        assert_eq!(params, vec![json!("filter"), json!("id"), json!("3")]);
    }
}
