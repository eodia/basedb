//! Addresses as points — `geo/geocode.ts`: what is known at once (`_basedb.geocode`, per
//! tenant), a few more asked of a Nominatim-compatible service paced on one queue for the
//! whole process, and how many are left.

use basedb_base::db::Exec;
use basedb_base::error::{AppError, SqlOp};
use basedb_base::tx::{ActorKind, RequestContext};
use basedb_base::Shared;
use basedb_catalog::js::{js_collapse_spaces, js_order, js_slice, js_to_number};
use serde_json::{json, Map, Value};
use std::time::{Duration, Instant};

pub const ASKED_PER_CALL: usize = 5;
pub const MAX_ADDRESSES: usize = 500;
const SPACING: Duration = Duration::from_millis(1_100);
const TIMEOUT: Duration = Duration::from_secs(8);

/// One queue for the whole process: the service's policy is per client.
static LAST: tokio::sync::Mutex<Option<Instant>> = tokio::sync::Mutex::const_new(None);

/// `normalizeAddress`: spaces collapsed, lower case, 500 code units at most.
pub fn normalize_address(text: &str) -> String {
    let collapsed = js_collapse_spaces(text);
    let lower = crate::js::js_trim(&collapsed).to_lowercase();
    js_slice(&lower, 500).to_string()
}

/// `geocoder.userAgent` of `server.ts`.
fn user_agent(st: &Shared) -> String {
    format!("basedb (+{})", st.cfg.setting("BASEDB_PUBLIC_URL").unwrap_or_else(|| "https://basedb.eodia.com".into()))
}

/// `Number(v)` of a JSON value.
fn number_of(v: Option<&Value>) -> f64 {
    match v {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => f64::from(u8::from(*b)),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => js_to_number(s),
        Some(_) => f64::NAN,
    }
}

/// `String(v)` of a JSON value.
pub(crate) fn string_of(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.as_f64().map(basedb_catalog::js::js_number_string).unwrap_or_default(),
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Array(items) => items.iter().map(|i| if i.is_null() { String::new() } else { string_of(i) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}

/// `a ?? b ?? c`.
fn coalesce<'a>(a: &'a Map<String, Value>, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|k| a.get(*k).filter(|v| !v.is_null()))
}

/// `[…].filter(Boolean).join(sep)`.
fn joined(values: &[Option<&Value>], sep: &str) -> String {
    values.iter().flatten().filter(|v| truthy(v)).map(|v| string_of(v)).collect::<Vec<_>>().join(sep)
}

/// `shortLabel`: number and street, postcode and town, country.
fn short_label(hit: &Map<String, Value>) -> Result<String, AppError> {
    let display = |fallback: String| match hit.get("display_name") {
        None | Some(Value::Null) => fallback,
        Some(v) => string_of(v),
    };
    let a = match hit.get("address") {
        None => return Ok(display(String::new())),
        Some(Value::Object(a)) => a,
        Some(Value::Null) => return Err(AppError::internal("Cannot read properties of null (reading 'house_number')")),
        Some(_) => return Ok(display(String::new())),
    };
    let street = joined(&[a.get("house_number"), coalesce(a, &["road", "pedestrian", "square"])], " ");
    let town = joined(&[a.get("postcode"), coalesce(a, &["city", "town", "village", "municipality"])], " ");
    let first: Option<Value> = if !street.is_empty() {
        Some(Value::String(street))
    } else {
        match a.get("amenity") {
            Some(v) if truthy(v) => Some(v.clone()),
            _ => a.get("building").cloned(),
        }
    };
    let parts: Vec<String> = [first, Some(Value::String(town)), a.get("country").cloned()]
        .into_iter()
        .flatten()
        .filter_map(|p| match p {
            Value::String(s) if !s.is_empty() => Some(s),
            _ => None,
        })
        .collect();
    Ok(if parts.len() >= 2 { parts.join(", ") } else { display(parts.join(", ")) })
}

/// `paced(ask(…))`: one request at a time for the process, 1.1 s apart.
async fn ask(st: &Shared, base: &str, query: &str, limit: usize, language: &str) -> Result<Vec<Value>, AppError> {
    let mut last = LAST.lock().await;
    if let Some(at) = *last {
        let next = at + SPACING;
        let now = Instant::now();
        if next > now {
            tokio::time::sleep(next - now).await;
        }
    }
    let result = ask_now(st, base, query, limit, language).await;
    *last = Some(Instant::now());
    result
}

async fn ask_now(st: &Shared, base: &str, query: &str, limit: usize, language: &str) -> Result<Vec<Value>, AppError> {
    let mut url = url::Url::parse(base).and_then(|b| b.join("/search")).map_err(|e| AppError::internal(format!("Invalid URL: {e}")))?;
    url.query_pairs_mut().append_pair("format", "jsonv2").append_pair("addressdetails", "1").append_pair("limit", &limit.to_string()).append_pair("q", query);
    let response = st
        .https
        .get(url.as_str())
        .header("user-agent", user_agent(st))
        .header("accept-language", language)
        .header("accept", "application/json")
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| AppError::internal(format!("fetch failed: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::new("GEOCODER_UNAVAILABLE").with("status", json!(response.status().as_u16())));
    }
    let hits: Value = response.json().await.map_err(|e| AppError::internal(format!("géocodeur : {e}")))?;
    let Value::Array(hits) = hits else { return Ok(Vec::new()) };
    let mut places = Vec::new();
    for h in &hits {
        let empty = Map::new();
        let hit = match h {
            Value::Object(o) => o,
            Value::Null => return Err(AppError::internal("Cannot read properties of null (reading 'lat')")),
            _ => &empty,
        };
        let (lat, lng) = (number_of(hit.get("lat")), number_of(hit.get("lon")));
        if lat.is_finite() && lng.is_finite() && lat.abs() <= 90.0 && lng.abs() <= 180.0 {
            let label = short_label(hit)?;
            places.push(json!({ "lat": crate::js::number_json(lat), "lng": crate::js::number_json(lng), "label": js_slice(&label, 500) }));
        }
    }
    Ok(places)
}

/// `geocodeAddresses`.
pub async fn geocode(st: &Shared, ctx: &RequestContext, addresses: &[Value], language: &str) -> Result<Value, AppError> {
    if !matches!(ctx.actor.kind, ActorKind::User | ActorKind::Token) {
        return Err(AppError::new("AUTHENTICATION_REQUIRED"));
    }
    let mut wanted: Vec<String> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for a in addresses {
        let Value::String(a) = a else { continue };
        let n = normalize_address(a);
        if !n.is_empty() && seen.insert(n.clone()) {
            wanted.push(n);
        }
    }
    if wanted.len() > MAX_ADDRESSES {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("addresses")).with("reason", json!("trop_d_adresses")).with("maximum", json!(MAX_ADDRESSES)));
    }
    let conn = st.pools.catalog().await?;
    let tenant: String = conn
        .first("SELECT id::text FROM _basedb.tenant WHERE ref = $1", &[&ctx.tenant_id])
        .await?
        .map(|r| r.get(0))
        .ok_or_else(|| AppError::new("AUTHENTICATION_REQUIRED"))?;
    let known = conn
        .rows("SELECT query, lat, lng, label FROM _basedb.geocode WHERE tenant_id = $1::text::uuid AND query = ANY($2::text[])", &[&tenant, &wanted])
        .await?;
    drop(conn);
    let mut places = Map::new();
    for k in &known {
        let (query, lat, lng, label): (String, Option<f64>, Option<f64>, Option<String>) = (k.get(0), k.get(1), k.get(2), k.get(3));
        let place = match (lat, lng) {
            (Some(lat), Some(lng)) => json!({ "lat": crate::js::number_json(lat), "lng": crate::js::number_json(lng), "label": label.unwrap_or_default() }),
            _ => Value::Null,
        };
        places.insert(query, place);
    }
    let Some(base) = st.cfg.geocoder_url.clone() else {
        return Ok(json!({ "places": js_order(Value::Object(places)), "pending": 0 }));
    };
    let missing: Vec<String> = wanted.iter().filter(|a| !places.contains_key(*a)).take(ASKED_PER_CALL).cloned().collect();
    for address in missing {
        let found = match ask(st, &base, &address, 1, language).await {
            Ok(mut hits) => (!hits.is_empty()).then(|| hits.swap_remove(0)),
            Err(_) => break,
        };
        places.insert(address.clone(), found.clone().unwrap_or(Value::Null));
        let (lat, lng, label) = match &found {
            Some(p) => (p["lat"].as_f64(), p["lng"].as_f64(), p["label"].as_str().map(str::to_string)),
            None => (None, None, None),
        };
        let conn = st.pools.catalog().await?;
        conn.query_op(
            "INSERT INTO _basedb.geocode (tenant_id, query, lat, lng, label)
             VALUES ($1::text::uuid, $2, $3, $4, $5)
             ON CONFLICT (tenant_id, query) DO UPDATE
                SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, label = EXCLUDED.label,
                    fetched_at = clock_timestamp()",
            &[&tenant, &address, &lat, &lng, &label],
            SqlOp::Insert,
        )
        .await?;
    }
    let pending = wanted.iter().filter(|a| !places.contains_key(*a)).count();
    Ok(json!({ "places": js_order(Value::Object(places)), "pending": pending }))
}

/// `searchAddresses`: what a typed text may be — asked when the input asks, never per key.
pub async fn search(st: &Shared, query: &str, language: &str) -> Result<Vec<Value>, AppError> {
    let query = js_collapse_spaces(query);
    let query = crate::js::js_trim(&query);
    let Some(base) = st.cfg.geocoder_url.clone() else { return Ok(Vec::new()) };
    if basedb_catalog::js::js_length(query) < 3 {
        return Ok(Vec::new());
    }
    ask(st, &base, js_slice(query, 300), 5, language).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses_and_labels() {
        assert_eq!(normalize_address("  12  Rue\tde la PAIX\n"), "12 rue de la paix");
        let hit = json!({ "display_name": "long", "address": { "house_number": "12", "road": "Rue de la Paix", "postcode": "75002", "city": "Paris", "country": "France" } });
        assert_eq!(short_label(hit.as_object().unwrap()).unwrap(), "12 Rue de la Paix, 75002 Paris, France");
        let hit = json!({ "display_name": "Tour Eiffel, Paris", "address": { "amenity": "Tour Eiffel" } });
        assert_eq!(short_label(hit.as_object().unwrap()).unwrap(), "Tour Eiffel, Paris");
        let hit = json!({ "address": { "road": "", "pedestrian": "x", "country": "France" } });
        assert_eq!(short_label(hit.as_object().unwrap()).unwrap(), "France");
        let hit = json!({ "display_name": 5 });
        assert_eq!(short_label(hit.as_object().unwrap()).unwrap(), "5");
        assert!(number_of(Some(&json!(null))) == 0.0 && number_of(None).is_nan() && number_of(Some(&json!("48.5"))) == 48.5);
    }
}
