//! One audit line per agent call (`agent/audit.ts`, chapter 09 §13): the SHAPE of the
//! parameters, never their values — each value replaced by a truncated keyed digest.

use basedb_base::audit::{write_audit, write_security, AuditEntry, SecurityEntry};
use basedb_base::db::Pools;
use basedb_base::error::AppError;
use basedb_base::idempotency::js_stringify;
use basedb_base::time::{hex, hmac_sha256};
use basedb_base::tx::{ActorKind, RequestContext};
use serde_json::{json, Map, Value};

/// `AgentCall`.
#[derive(Debug, Clone, Default)]
pub struct AgentCall {
    pub tool: String,
    pub session_id: Option<String>,
    /// `clientInfo` as declared at `initialize`: `{ name, version }`, trusted by nothing.
    pub client: Option<Value>,
    pub params: Map<String, Value>,
    /// `None` for a success, the registry code otherwise.
    pub outcome: Option<String>,
    pub returned: Option<u64>,
    pub truncated: Option<bool>,
    pub object_kind: String,
    pub object_id: Option<String>,
    pub object_name: Option<String>,
    pub base_id: Option<String>,
    pub table_id: Option<String>,
}

/// The codes that say something about the existence of an object, or refuse an act.
const SECURITY_OUTCOMES: [&str; 8] = [
    "RESOURCE_NOT_FOUND",
    "FIELD_UNKNOWN",
    "PERMISSION_DENIED",
    "TOKEN_READ_ONLY",
    "FIELD_NOT_WRITABLE",
    "LINK_TARGET_NOT_FOUND",
    "MCP_OPERATION_EXCLUDED",
    "QUOTA_EXCEEDED",
];

/// `bounded`: a string cut at `max` UTF-16 units, or nothing.
fn bounded(value: Option<&Value>, max: usize) -> Option<String> {
    let text = value?.as_str()?;
    let units: Vec<u16> = text.encode_utf16().take(max).collect();
    Some(String::from_utf16_lossy(&units))
}

/// `paramsShape`: the shape of a call's parameters, and nothing of their values.
pub fn params_shape(params: &Map<String, Value>, digest: &dyn Fn(&Value) -> String) -> Map<String, Value> {
    let names = |value: Option<&Value>| -> Option<Value> {
        let list = value?.as_array()?;
        Some(Value::Array(list.iter().filter(|v| v.is_string()).map(|v| json!(bounded(Some(v), 128))).collect()))
    };
    let mut shape = Map::new();
    for key in ["base", "table"] {
        if let Some(v) = bounded(params.get(key), 128) {
            shape.insert(key.into(), json!(v));
        }
    }
    if let Some(v) = bounded(params.get("_id"), 64) {
        shape.insert("_id".into(), json!(v));
    }
    for key in ["select", "sort", "expand", "expand_fields", "full_fields"] {
        if let Some(v) = names(params.get(key)) {
            shape.insert(key.into(), v);
        }
    }
    if let Some(limit) = params.get("limit").filter(|v| v.is_number()) {
        shape.insert("limit".into(), limit.clone());
    }
    if params.contains_key("cursor") {
        shape.insert("cursor".into(), json!(true));
    }
    if let Some(v) = params.get("include_count") {
        shape.insert("include_count".into(), json!(*v == json!(true)));
    }
    if params.contains_key("idempotency_key") {
        shape.insert("idempotency_key".into(), json!(true));
    }
    if let Some(filter) = params.get("filter").and_then(Value::as_object) {
        let entries: Vec<Value> = filter
            .iter()
            .map(|(field, p)| {
                let mut entry = Map::new();
                entry.insert("field".into(), json!(bounded(Some(&json!(field)), 128)));
                let op = bounded(p.get("op"), 16);
                if let Some(op) = op {
                    entry.insert("op".into(), json!(op));
                }
                if let Some(value) = p.get("value") {
                    entry.insert("value_digest".into(), json!(digest(value)));
                }
                Value::Object(entry)
            })
            .collect();
        shape.insert("filter".into(), Value::Array(entries));
    }
    if let Some(value) = params.get("value") {
        shape.insert("value_digest".into(), json!(digest(value)));
    }
    if let Some(values) = params.get("values").and_then(Value::as_object) {
        shape.insert("values".into(), Value::Array(values.keys().map(|k| json!(bounded(Some(&json!(k)), 128))).collect()));
    }
    shape
}

/// `valueDigest`: `h:` and eight hex digits of an HMAC under the instance key.
pub fn value_digest(instance_key: &str, value: &Value) -> String {
    let full = hex(&hmac_sha256(instance_key.as_bytes(), &[js_stringify(value).as_bytes()]));
    format!("h:{}", &full[..8])
}

/// `recordAgentCall`: the audit line of one call, and a security line when the call was
/// refused or told something about the existence of an object.
pub async fn record_agent_call(pools: &Pools, ctx: &RequestContext, instance_key: &str, call: &AgentCall) -> Result<(), AppError> {
    let conn = pools.catalog().await?;
    let client = call.client.as_ref();
    let mut mcp = Map::new();
    mcp.insert("tool".into(), json!(call.tool));
    mcp.insert("session_id".into(), json!(call.session_id));
    mcp.insert(
        "client".into(),
        json!({
            "name": bounded(client.and_then(|c| c.get("name")), 128),
            "version": bounded(client.and_then(|c| c.get("version")), 64),
            "verified": false,
        }),
    );
    mcp.insert("params_shape".into(), Value::Object(params_shape(&call.params, &|v| value_digest(instance_key, v))));
    mcp.insert("outcome".into(), json!(call.outcome.as_deref().unwrap_or("ok")));
    if let Some(returned) = call.returned {
        mcp.insert("returned".into(), json!(returned));
    }
    if let Some(truncated) = call.truncated {
        mcp.insert("truncated".into(), json!(truncated));
    }
    let mut payload = Map::new();
    payload.insert("mcp".into(), Value::Object(mcp));
    let entry = AuditEntry {
        action: format!("mcp.{}", call.tool),
        object_kind: call.object_kind.clone(),
        object_id: call.object_id.clone(),
        object_name: call.object_name.clone(),
        base_id: call.base_id.clone(),
        table_id: call.table_id.clone(),
        payload,
    };
    write_audit(&conn, ctx, &entry).await?;

    if let Some(outcome) = call.outcome.as_deref().filter(|o| SECURITY_OUTCOMES.contains(o)) {
        let token = ctx.actor.kind == ActorKind::Token;
        let route = format!("/mcp/{}", call.tool);
        write_security(
            &conn,
            &SecurityEntry {
                token_id: if token { ctx.actor.token_id.as_deref() } else { None },
                user_id: if token { None } else { Some(ctx.actor.id.as_str()) },
                route: &route,
                error_code: outcome,
                request_id: Some(ctx.request_id.as_str()),
                ip: None,
            },
        )
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_shape_keeps_no_value() {
        let params = json!({
            "base": "crm", "table": "clients", "select": ["nom", 3], "limit": 10, "cursor": "x",
            "filter": { "email": { "op": "eq", "value": "a@b.c" } }, "values": { "nom": "Secret" }, "idempotency_key": "k"
        });
        let shape = params_shape(params.as_object().unwrap(), &|v| value_digest("clé", v));
        let text = Value::Object(shape.clone()).to_string();
        assert!(!text.contains("a@b.c") && !text.contains("Secret"));
        assert_eq!(shape["select"], json!(["nom"]));
        assert_eq!(shape["values"], json!(["nom"]));
        assert_eq!(shape["cursor"], json!(true));
        assert!(shape["filter"][0]["value_digest"].as_str().unwrap().starts_with("h:"));
    }

    #[test]
    fn digests_are_node_s() {
        assert_eq!(value_digest("cle-instance", &json!("a@b.c")), "h:434380d2");
        assert_eq!(value_digest("cle-instance", &json!(12.5)), "h:e0fa17da");
        assert_eq!(value_digest("cle-instance", &json!({ "b": 1, "a": [true, null] })), "h:c8dd6a61");
    }
}
