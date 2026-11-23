//! `sync/tables.ts` and its routes (`/admin/bases/{base}/synced-tables`): a table kept like
//! its source by the server — created with the source's columns and a key field, its rows
//! brought to the source as its mode says, under the system's identity
//! ([`basedb_records::sync_rows::apply`]). The worker ([`sync_due`]) takes the tables due.

// `AppError` (crate base) is the error of every domain: its size is shared, not this module's.
#![allow(clippy::result_large_err)]

use crate::common::{fields, js_slice, js_string, js_trim, strict_json};
use crate::insights::{call, person_of, token_for};
use crate::sealing::{seal, unseal};
use crate::sync_sources::{encode_uri_component, failed, intl_zone, read_source, unique_keys, InsightsSource, SourceColumn, SourceData};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Extension;
use basedb_base::auth::bearer_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{empty, json_ok, json_response, ApiResult, AppError, SqlOp};
use basedb_base::layers::RequestId;
use basedb_base::rbac::decide::Action;
use basedb_base::rbac::require::require_on_base;
use basedb_base::tx::{with_transaction, Actor, ActorKind, RequestContext, Surface, TxOptions};
use basedb_base::Shared;
use basedb_catalog::targets::TargetPolicy;
use basedb_records::sync_rows::{apply, SourceRow, SyncColumn, SyncCounts, SyncMode, SyncTarget};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::LazyLock;

const PURPOSE: &str = "sync/source";
const SYSTEM: &str = "00000000-0000-0000-0000-000000000000";
pub const KEY_LABEL: &str = "Clé de synchronisation";
pub const STAMP_LABEL: &str = "Synchronisée le";
const MODES: [&str; 5] = ["mirror", "upsert", "insert", "replace", "snapshot"];
const SCHEDULES: [&str; 3] = ["interval", "daily", "manual"];

/// The next due date, from the row's own settings: in N minutes; the next HH:MM in its time
/// zone; never, by hand only. Set by a statement of its own — an UPDATE sees the old values.
const NEXT_DUE: &str = "CASE schedule
    WHEN 'manual' THEN 'infinity'::timestamptz
    WHEN 'daily' THEN (
      SELECT CASE WHEN due > pg_catalog.clock_timestamp() THEN due ELSE due + interval '1 day' END
        FROM (SELECT (date_trunc('day', pg_catalog.clock_timestamp() AT TIME ZONE time_zone)
                      + daily_at::time) AT TIME ZONE time_zone AS due) AS next)
    ELSE pg_catalog.clock_timestamp() + make_interval(mins => interval_minutes)
  END";

fn invalid(field: &str, reason: &str) -> AppError {
    AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!(reason))
}

/// `systemContext`: the writer of a synced table's rows.
fn system_context(tenant_ref: &str) -> RequestContext {
    let mut ctx = RequestContext::new(uuid::Uuid::new_v4().to_string(), Actor { kind: ActorKind::System, id: SYSTEM.into(), token_id: None }, tenant_ref, Surface::System);
    ctx.deadline = ctx.timestamp + chrono::Duration::minutes(30);
    ctx
}

#[derive(Clone, Debug, PartialEq)]
pub struct Settings {
    pub mode: String,
    pub schedule: String,
    pub interval_minutes: i32,
    pub daily_at: Option<String>,
    pub time_zone: String,
    pub key_columns: Option<Vec<String>>,
}

impl Settings {
    /// The settings of a synced table as [`list`] serialises it.
    fn of(t: &Value) -> Settings {
        let text = |k: &str| t.get(k).and_then(Value::as_str).unwrap_or("").to_string();
        Settings {
            mode: text("mode"),
            schedule: text("schedule"),
            interval_minutes: t.get("interval_minutes").and_then(Value::as_i64).unwrap_or(60) as i32,
            daily_at: t.get("daily_at").and_then(Value::as_str).map(str::to_string),
            time_zone: text("time_zone"),
            key_columns: t.get("key_columns").and_then(Value::as_array).map(|a| a.iter().map(js_string).collect()),
        }
    }
}

/// `checkedSettings`: the settings asked for (the body's `mode`, `schedule`,
/// `interval_minutes`, `daily_at`, `time_zone`, `key_columns`) over the current ones or the
/// defaults, each refused by name.
pub fn checked_settings(input: &Value, current: Option<&Settings>, source_keys: &[String]) -> Result<Settings, AppError> {
    let given = |k: &str| input.get(k);
    let mode = match given("mode") {
        None => current.map_or("mirror".to_string(), |c| c.mode.clone()),
        Some(v) => v.as_str().filter(|m| MODES.contains(m)).ok_or_else(|| invalid("mode", "mode_inconnu"))?.to_string(),
    };
    if !MODES.contains(&mode.as_str()) {
        return Err(invalid("mode", "mode_inconnu"));
    }
    let schedule = match given("schedule") {
        None => current.map_or("interval".to_string(), |c| c.schedule.clone()),
        Some(v) => v.as_str().filter(|s| SCHEDULES.contains(s)).ok_or_else(|| invalid("schedule", "rythme_inconnu"))?.to_string(),
    };
    if !SCHEDULES.contains(&schedule.as_str()) {
        return Err(invalid("schedule", "rythme_inconnu"));
    }
    let interval = match given("interval_minutes").filter(|v| !v.is_null()) {
        Some(Value::Number(n)) => n.as_f64().map_or(f64::NAN, |f| (f + 0.5).floor()),
        Some(_) => f64::NAN,
        None => current.map_or(60.0, |c| f64::from(c.interval_minutes)),
    };
    if !(15.0..=1440.0).contains(&interval) {
        return Err(invalid("interval_minutes", "entre_15_et_1440"));
    }
    let raw_daily = match given("daily_at") {
        None => current.and_then(|c| c.daily_at.clone()).map(Value::from).unwrap_or(Value::Null),
        Some(v) => v.clone(),
    };
    let daily_at = match &raw_daily {
        Value::Null => None,
        Value::String(s) if s.is_empty() => None,
        other => Some(js_string(other)),
    };
    static TIME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^([01][0-9]|2[0-3]):[0-5][0-9]$").unwrap());
    if daily_at.as_deref().is_some_and(|d| !TIME.is_match(d)) {
        return Err(invalid("daily_at", "heure_invalide"));
    }
    if schedule == "daily" && daily_at.is_none() {
        return Err(invalid("daily_at", "heure_requise"));
    }
    let time_zone = match given("time_zone") {
        None => current.map_or("UTC".to_string(), |c| c.time_zone.clone()),
        Some(v) => js_string(v),
    };
    if intl_zone(&time_zone).is_none() {
        return Err(invalid("time_zone", "fuseau_inconnu"));
    }
    let mut key_columns = current.and_then(|c| c.key_columns.clone());
    match given("key_columns") {
        None => {}
        Some(Value::Null) => key_columns = None,
        Some(Value::Array(a)) if a.len() <= 8 && a.iter().all(|k| k.as_str().is_some_and(|k| source_keys.iter().any(|s| s == k))) => {
            let mut unique: Vec<String> = Vec::new();
            for k in a.iter().filter_map(Value::as_str) {
                if !unique.iter().any(|u| u == k) {
                    unique.push(k.to_string());
                }
            }
            key_columns = if unique.is_empty() { None } else { Some(unique) };
        }
        Some(_) => return Err(invalid("key_columns", "colonne_inconnue")),
    }
    Ok(Settings { mode, schedule, interval_minutes: interval as i32, daily_at, time_zone, key_columns })
}

/// `keyed`: the rows keyed by the chosen columns' values — `A · B` —, or as the source keys them.
pub fn keyed(rows: Vec<SourceRow>, key_columns: Option<&[String]>) -> Vec<SourceRow> {
    let Some(columns) = key_columns.filter(|k| !k.is_empty()) else { return rows };
    let rows = rows
        .into_iter()
        .map(|r| {
            let key = columns.iter().map(|k| r.values.get(k).filter(|v| !v.is_null()).map(js_string).unwrap_or_default()).collect::<Vec<_>>().join(" · ");
            SourceRow { key, values: r.values }
        })
        .collect();
    unique_keys(rows)
}

/// `checkedParameters`: an object, its JSON within 10 000 characters.
fn checked_parameters(raw: Option<&Value>) -> Result<Option<Value>, AppError> {
    match raw {
        None | Some(Value::Null) => Ok(None),
        Some(v @ Value::Object(_)) if crate::common::js_len(&v.to_string()) <= 10_000 => Ok(Some(v.clone())),
        Some(_) => Err(invalid("source.parameters", "parametres_invalides")),
    }
}

struct ResolvedSource {
    kind: String,
    /// What is sealed: the address, or `insights:question/<id>`.
    url: String,
    host: String,
    options: Map<String, Value>,
}

/// `new URL(url).host`.
fn url_host(url: &str) -> Option<String> {
    let parsed = url::Url::parse(url).ok()?;
    let host = parsed.host_str().unwrap_or("");
    Some(match parsed.port() {
        Some(port) => format!("{host}:{port}"),
        None => host.to_string(),
    })
}

/// `resolveSource`: the source asked for, checked — for insights, the question read as the person.
async fn resolve_source(st: &Shared, ctx: &RequestContext, input: &Value) -> Result<ResolvedSource, AppError> {
    let kind = input.get("kind").and_then(Value::as_str).unwrap_or("");
    let known = matches!(kind, "csv" | "ics" | "basedb") || (kind == "insights" && st.cfg.insights.is_some());
    if !known {
        return Err(invalid("source.kind", "source_inconnue"));
    }
    if kind == "insights" {
        let question = input.get("question").and_then(Value::as_str).map(js_trim).unwrap_or("");
        static QUESTION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_-]{1,64}$").unwrap());
        if !QUESTION.is_match(question) {
            return Err(invalid("source.question", "question_attendue"));
        }
        let config = st.cfg.insights.as_ref().expect("insights");
        let person = person_of(st, &ctx.actor.id).await?;
        let found = call(config, &token_for(config, &person, 300), reqwest::Method::GET, &format!("/api/v1/questions/{}", encode_uri_component(question)), None).await?;
        let parameters = checked_parameters(input.get("parameters"))?;
        let id = found.get("id").cloned();
        let mut options = Map::new();
        if let Some(id) = &id {
            options.insert("question".into(), id.clone());
        }
        if let Some(name) = found.get("name") {
            options.insert("name".into(), name.clone());
        }
        if let Some(p) = parameters {
            options.insert("parameters".into(), p);
        }
        let id_text = match &id {
            None => "undefined".to_string(),
            Some(v) => js_string(v),
        };
        return Ok(ResolvedSource { kind: kind.into(), url: format!("insights:question/{id_text}"), host: "insights".into(), options });
    }
    let url = input.get("url").and_then(Value::as_str).map(js_trim).unwrap_or("").to_string();
    let host = url_host(&url).ok_or_else(|| failed("adresse_refusee"))?;
    Ok(ResolvedSource { kind: kind.into(), url, host, options: Map::new() })
}

/// `read`: the source fetched and read — an insights question as `user_id`.
async fn read(st: &Shared, source: &ResolvedSource, user_id: Option<&str>) -> Result<SourceData, AppError> {
    let targets = TargetPolicy::from_config(&st.cfg);
    let insights = match (&st.cfg.insights, source.kind.as_str(), source.options.get("question")) {
        (Some(config), "insights", Some(question)) => {
            let user = user_id.ok_or_else(|| failed("auteur_inconnu"))?;
            Some(InsightsSource {
                config,
                person: person_of(st, user).await?,
                question: js_string(question),
                parameters: source.options.get("parameters").filter(|p| !p.is_null()).cloned(),
            })
        }
        _ => None,
    };
    read_source(&source.kind, &source.url, &targets, insights).await
}

fn columns_json(columns: &[SourceColumn]) -> Value {
    Value::Array(columns.iter().map(SourceColumn::to_json).collect())
}

/// `listSyncedTables`, serialised as the route answers (`serializeSynced`).
pub async fn list(st: &Shared, ctx: &RequestContext, base_id: &str, table_id: Option<&str>) -> Result<Vec<Value>, AppError> {
    let (c, b, t) = (ctx, base_id, table_id);
    with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::read_only(), |tx| async move {
        require_on_base(&tx, c, Action::ManageSchema, b).await?;
        let rows = tx
            .rows(
                "SELECT s.table_id::text, tn.name AS table_name, t.label, s.source_kind, s.url_host,
                        s.mode, s.schedule, s.interval_minutes, s.daily_at, s.time_zone, s.key_columns,
                        s.columns, s.source_options,
                        CASE WHEN s.schedule = 'manual' THEN NULL ELSE s.next_sync_at::text END
                          AS next_sync_at,
                        s.last_synced_at::text, s.last_status, s.last_error, s.last_counts
                   FROM _basedb.table_sync s
                   JOIN _basedb.table_def t ON t.id = s.table_id AND t.is_live
                   JOIN _basedb.physical_name tn ON tn.id = t.name_id
                  WHERE s.base_id = $1::text::uuid AND ($2::text::uuid IS NULL OR s.table_id = $2::text::uuid)
                  ORDER BY t.label",
                &[&b, &t],
            )
            .await?;
        Ok(rows
            .iter()
            .map(|r| {
                let columns: Vec<Value> = match r.get::<_, Value>(11) {
                    Value::Array(a) => a
                        .iter()
                        .map(|c| {
                            let mut m = Map::new();
                            if let Some(k) = c.get("key") {
                                m.insert("key".into(), k.clone());
                            }
                            let label = c.get("label").filter(|l| !l.is_null()).or_else(|| c.get("key"));
                            if let Some(l) = label {
                                m.insert("label".into(), l.clone());
                            }
                            if let Some(k) = c.get("kind") {
                                m.insert("kind".into(), k.clone());
                            }
                            Value::Object(m)
                        })
                        .collect(),
                    _ => Vec::new(),
                };
                let options: Value = r.get(12);
                let question = match options.get("question") {
                    None => Value::Null,
                    Some(q) => json!({ "id": q, "name": options.get("name").filter(|n| !n.is_null()).cloned().unwrap_or(json!("")) }),
                };
                json!({
                    "table_id": r.get::<_, String>(0),
                    "table": r.get::<_, String>(1),
                    "label": r.get::<_, String>(2),
                    "source_kind": r.get::<_, String>(3),
                    "host": r.get::<_, String>(4),
                    "mode": r.get::<_, String>(5),
                    "schedule": r.get::<_, String>(6),
                    "interval_minutes": r.get::<_, i32>(7),
                    "daily_at": r.get::<_, Option<String>>(8),
                    "time_zone": r.get::<_, String>(9),
                    "key_columns": r.get::<_, Option<Value>>(10),
                    "columns": columns,
                    "question": question,
                    "parameters": options.get("parameters").filter(|p| !p.is_null()).cloned().unwrap_or(Value::Null),
                    "next_sync_at": r.get::<_, Option<String>>(13),
                    "last_synced_at": r.get::<_, Option<String>>(14),
                    "last_status": r.get::<_, Option<String>>(15),
                    "last_error": r.get::<_, Option<String>>(16),
                    "last_counts": r.get::<_, Option<Value>>(17),
                })
            })
            .collect())
    })
    .await
}

async fn require_schema(st: &Shared, ctx: &RequestContext, base_id: &str) -> Result<(), AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| async move { require_on_base(&tx, ctx, Action::ManageSchema, base_id).await.map(|_| ()) }).await
}

fn counts_json(c: &SyncCounts) -> Value {
    json!({ "created": c.created, "updated": c.updated, "deleted": c.deleted })
}

/// `previewSyncSource`: its columns, its first twenty rows, how many.
pub async fn preview(st: &Shared, ctx: &RequestContext, base_id: &str, input: &Value) -> Result<Value, AppError> {
    require_schema(st, ctx, base_id).await?;
    let source = resolve_source(st, ctx, input).await?;
    let data = read(st, &source, Some(&ctx.actor.id)).await?;
    let rows: Vec<Value> = data.rows.iter().take(20).map(|r| json!({ "key": r.key, "values": r.values })).collect();
    Ok(json!({ "columns": columns_json(&data.columns), "rows": rows, "total": data.rows.len() }))
}

/// `createSyncedTable`: the table made from its source, and filled.
pub async fn create(st: &Shared, ctx: &RequestContext, base_id: &str, body: &Value) -> Result<Value, AppError> {
    let label = body.get("label").and_then(Value::as_str).map(|l| js_slice(js_trim(l), 255)).unwrap_or("").to_string();
    if label.is_empty() {
        return Err(invalid("label", "libelle_invalide"));
    }
    require_schema(st, ctx, base_id).await?;
    let input = body.get("source").filter(|s| !s.is_null()).cloned().unwrap_or_else(|| json!({}));
    let source = resolve_source(st, ctx, &input).await?;
    let data = read(st, &source, Some(&ctx.actor.id)).await?;
    if data.columns.is_empty() {
        return Err(failed("aucune_colonne"));
    }
    let all_keys: Vec<String> = data.columns.iter().map(|c| c.key.clone()).collect();
    let settings = checked_settings(body, None, &all_keys)?;
    let mut kept: Vec<SourceColumn> = data.columns.clone();
    match body.get("columns") {
        None | Some(Value::Null) => {}
        Some(Value::Array(a)) if a.iter().all(|k| k.as_str().is_some_and(|k| all_keys.iter().any(|s| s == k))) => {
            let mut wanted: Vec<&str> = a.iter().filter_map(Value::as_str).collect();
            wanted.extend(settings.key_columns.iter().flatten().map(String::as_str));
            kept = data.columns.iter().filter(|c| wanted.contains(&c.key.as_str())).cloned().collect();
            if kept.is_empty() {
                return Err(invalid("columns", "aucune_colonne"));
            }
        }
        Some(_) => return Err(invalid("columns", "colonne_inconnue")),
    }

    let description = if source.kind == "insights" {
        format!("Synchronisée depuis la question insights « {} ».", source.options.get("name").filter(|n| !n.is_null()).map(js_string).unwrap_or_default())
    } else {
        format!("Synchronisée depuis {}.", source.host)
    };
    let mut field_specs = vec![json!({ "label": KEY_LABEL, "kind": "short_text" })];
    for c in &kept {
        let label = if c.label == KEY_LABEL || c.label == STAMP_LABEL { format!("{} (source)", c.label) } else { c.label.clone() };
        field_specs.push(json!({ "label": label, "kind": c.kind }));
    }
    let snapshot = settings.mode == "snapshot";
    if snapshot {
        field_specs.push(json!({ "label": STAMP_LABEL, "kind": "datetime" }));
    }
    let created = basedb_catalog::operations::create_table(&st.pools, ctx, base_id, &label, Some(&json!(description)), Some(&Value::Array(field_specs)), None).await?;
    let Some((key_field, fields)) = created.fields.split_first() else {
        return Err(AppError::new("INTERNAL_ERROR").with("reason", json!("sync key field")));
    };
    let stamp_field = if snapshot { fields.get(kept.len()) } else { None };
    let columns: Vec<SyncColumn> = kept.iter().zip(fields).map(|(c, f)| SyncColumn { key: c.key.clone(), field: f.name.clone(), kind: c.kind.clone() }).collect();
    let columns_stored: Vec<Value> = kept.iter().zip(&columns).map(|(c, s)| json!({ "key": c.key, "field": s.field, "kind": c.kind, "label": c.label })).collect();
    if let Some(first) = fields.first() {
        let _ = basedb_catalog::fields::set_display_column(&st.pools, ctx, &created.table_id, Some(&first.field_id)).await;
    }

    let sealed = seal(st.instance_key()?, PURPOSE, &source.url);
    let key_columns = settings.key_columns.as_ref().map(|k| json!(k).to_string());
    let options = Value::Object(source.options.clone()).to_string();
    let columns_text = Value::Array(columns_stored).to_string();
    let stamp_id = stamp_field.map(|f| f.field_id.clone());
    let (tid, s, kf) = (&created.table_id, &settings, &key_field.field_id);
    let (sealed, cols, kc, opts, stamp, kind, host) = (&sealed, &columns_text, &key_columns, &options, &stamp_id, &source.kind, &source.host);
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        tx.execute_op(
            "INSERT INTO _basedb.table_sync
               (table_id, base_id, source_kind, url_sealed, url_host, interval_minutes, key_field_id,
                columns, next_sync_at, created_by, mode, schedule, daily_at, time_zone, key_columns,
                source_options, stamp_field_id)
             VALUES ($1::text::uuid, $2::text::uuid, $3, $4, $5, $6, $7::text::uuid, $8::text::jsonb,
                     pg_catalog.clock_timestamp(), $9::text::uuid, $10, $11, $12, $13, $14::text::jsonb,
                     $15::text::jsonb, $16::text::uuid)",
            &[tid, &base_id, kind, sealed, host, &s.interval_minutes, kf, cols, &ctx.actor.id, &s.mode, &s.schedule, &s.daily_at, &s.time_zone, kc, opts, stamp],
            SqlOp::Insert,
        )
        .await?;
        tx.execute_op(&format!("UPDATE _basedb.table_sync SET next_sync_at = {NEXT_DUE} WHERE table_id = $1::text::uuid"), &[tid], SqlOp::Update).await?;
        Ok(())
    })
    .await?;

    let target = SyncTarget { table_id: created.table_id.clone(), key_field: key_field.name.clone(), stamp_field: stamp_field.map(|f| f.name.clone()), columns };
    let mode = SyncMode::parse(&settings.mode).expect("mode");
    let counts = apply(&st.pools, &system_context(&ctx.tenant_id), st.instance_key()?, &target, mode, &keyed(data.rows, settings.key_columns.as_deref())).await?;
    let conn = st.pools.catalog().await?;
    conn.execute_op(
        "UPDATE _basedb.table_sync SET last_synced_at = pg_catalog.clock_timestamp(),
                last_status = 'ok', last_error = NULL, last_counts = $2::text::jsonb
          WHERE table_id = $1::text::uuid",
        &[&created.table_id, &counts_json(&counts).to_string()],
        SqlOp::Update,
    )
    .await?;
    drop(conn);
    one(list(st, ctx, base_id, Some(&created.table_id)).await?)
}

fn one(mut list: Vec<Value>) -> Result<Value, AppError> {
    // `synced as SyncedTable`: Node would answer `undefined` fields; the row is always there.
    if list.is_empty() {
        return Err(AppError::internal("table synchronisée introuvable"));
    }
    Ok(list.swap_remove(0))
}

fn not_found(table_id: &str) -> AppError {
    AppError::new("RESOURCE_NOT_FOUND").with("table", json!(table_id))
}

/// `updateSyncedTable`: mode, schedule, key, parameters. Turned to `snapshot`, the table gains
/// the field that dates each row it adds.
pub async fn update(st: &Shared, ctx: &RequestContext, base_id: &str, table_id: &str, body: &Value) -> Result<Value, AppError> {
    let current = list(st, ctx, base_id, Some(table_id)).await?.into_iter().next().ok_or_else(|| not_found(table_id))?;
    let keys: Vec<String> = current.get("columns").and_then(Value::as_array).map(|a| a.iter().filter_map(|c| c.get("key")).map(js_string).collect()).unwrap_or_default();
    let settings = checked_settings(body, Some(&Settings::of(&current)), &keys)?;
    let parameters = checked_parameters(body.get("parameters"))?;
    if parameters.is_some() && current.get("source_kind").and_then(Value::as_str) != Some("insights") {
        return Err(invalid("parameters", "source_sans_parametres"));
    }
    let real_id = current.get("table_id").and_then(Value::as_str).unwrap_or(table_id).to_string();
    let mut stamp_field_id: Option<String> = None;
    if settings.mode == "snapshot" {
        let conn = st.pools.catalog().await?;
        let row = conn.first("SELECT stamp_field_id::text FROM _basedb.table_sync WHERE table_id = $1::text::uuid", &[&real_id]).await?;
        drop(conn);
        stamp_field_id = row.and_then(|r| r.get::<_, Option<String>>(0));
        if stamp_field_id.is_none() {
            let request = basedb_catalog::fields::AddFieldRequest { table_id: real_id.clone(), label: STAMP_LABEL.into(), kind: "datetime".into(), ..Default::default() };
            stamp_field_id = Some(basedb_catalog::fields::add_field(&st.pools, ctx, &request).await?.field_id);
        }
    }
    let key_columns = settings.key_columns.as_ref().map(|k| json!(k).to_string());
    let parameters = parameters.map(|p| p.to_string());
    let (s, kc, stamp, params) = (&settings, &key_columns, &stamp_field_id, &parameters);
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        tx.execute_op(
            "UPDATE _basedb.table_sync
                SET mode = $3, schedule = $4, interval_minutes = $5, daily_at = $6, time_zone = $7,
                    key_columns = $8::text::jsonb,
                    stamp_field_id = coalesce($9::text::uuid, stamp_field_id),
                    source_options = CASE WHEN $10::text::jsonb IS NULL THEN source_options
                                          ELSE jsonb_set(source_options, '{parameters}', $10::text::jsonb) END
              WHERE table_id::text = $1 AND base_id = $2::text::uuid",
            &[&table_id, &base_id, &s.mode, &s.schedule, &s.interval_minutes, &s.daily_at, &s.time_zone, kc, stamp, params],
            SqlOp::Update,
        )
        .await?;
        tx.execute_op(
            &format!("UPDATE _basedb.table_sync SET next_sync_at = {NEXT_DUE} WHERE table_id::text = $1 AND base_id = $2::text::uuid"),
            &[&table_id, &base_id],
            SqlOp::Update,
        )
        .await?;
        Ok(())
    })
    .await?;
    one(list(st, ctx, base_id, Some(table_id)).await?)
}

/// `stopSyncedTable`: the table becomes an ordinary one, with its rows.
pub async fn stop(st: &Shared, ctx: &RequestContext, base_id: &str, table_id: &str) -> Result<(), AppError> {
    with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::default(), |tx| async move {
        require_on_base(&tx, ctx, Action::ManageSchema, base_id).await?;
        let rows = tx
            .query_op("DELETE FROM _basedb.table_sync WHERE table_id::text = $1 AND base_id = $2::text::uuid RETURNING table_id", &[&table_id, &base_id], SqlOp::Delete)
            .await?;
        if rows.is_empty() {
            return Err(not_found(table_id));
        }
        Ok(())
    })
    .await
}

/// `syncTable`: one table now. A source that fails deletes nothing: the failure is noted, and
/// the next attempt comes at the next due date.
pub async fn sync_table(st: &Shared, table_id: &str) -> Result<SyncCounts, AppError> {
    let conn = st.pools.catalog().await?;
    let found = conn
        .first(
            "SELECT s.source_kind, s.url_sealed, s.url_host, s.mode, s.key_columns, kn.name AS key_field,
                    sn.name AS stamp_field, s.columns, s.source_options, s.created_by::text,
                    te.ref AS tenant_ref
               FROM _basedb.table_sync s
               JOIN _basedb.field kf ON kf.id = s.key_field_id
               JOIN _basedb.physical_name kn ON kn.id = kf.name_id
               LEFT JOIN _basedb.field sf ON sf.id = s.stamp_field_id AND sf.is_live
               LEFT JOIN _basedb.physical_name sn ON sn.id = sf.name_id
               JOIN _basedb.base b ON b.id = s.base_id
               JOIN _basedb.tenant te ON te.id = b.tenant_id
              WHERE s.table_id = $1::text::uuid",
            &[&table_id],
        )
        .await?;
    drop(conn);
    let Some(row) = found else { return Err(not_found(table_id)) };
    let kind: String = row.get(0);
    let sealed: String = row.get(1);
    let host: String = row.get(2);
    let mode: String = row.get(3);
    let key_columns: Option<Vec<String>> = row.get::<_, Option<Value>>(4).and_then(|v| v.as_array().map(|a| a.iter().map(js_string).collect()));
    let key_field: String = row.get(5);
    let stamp_field: Option<String> = row.get(6);
    let columns: Vec<SyncColumn> = row
        .get::<_, Value>(7)
        .as_array()
        .map(|a| {
            a.iter()
                .map(|c| {
                    let text = |k: &str| c.get(k).map(js_string).unwrap_or_else(|| "undefined".into());
                    SyncColumn { key: text("key"), field: text("field"), kind: text("kind") }
                })
                .collect()
        })
        .unwrap_or_default();
    let options: Value = row.get(8);
    let created_by: Option<String> = row.get(9);
    let tenant_ref: String = row.get(10);

    let attempt = async {
        let url = unseal(st.instance_key()?, PURPOSE, &sealed).ok_or_else(|| failed("adresse_illisible"))?;
        let source = ResolvedSource { kind, url, host, options: options.as_object().cloned().unwrap_or_default() };
        let data = read(st, &source, created_by.as_deref()).await?;
        let target = SyncTarget { table_id: table_id.to_string(), key_field, stamp_field, columns };
        let mode = SyncMode::parse(&mode).ok_or_else(|| AppError::internal(format!("mode inconnu : {mode}")))?;
        apply(&st.pools, &system_context(&tenant_ref), st.instance_key()?, &target, mode, &keyed(data.rows, key_columns.as_deref())).await
    };
    let outcome = attempt.await;
    let (status, error, counts) = match &outcome {
        Ok(c) => ("ok", None, Some(counts_json(c).to_string())),
        Err(e) => {
            let detail = |k: &str| e.details.get(k).and_then(Value::as_str);
            let reason = match (detail("reason"), detail("message")) {
                (Some(r), _) => format!("{} : {r}", e.code),
                (None, Some(m)) => format!("{} : {m}", e.code),
                _ => e.code.to_string(),
            };
            ("failed", Some(js_slice(&reason, 500).to_string()), None)
        }
    };
    let conn = st.pools.catalog().await?;
    conn.execute_op(
        &format!(
            "UPDATE _basedb.table_sync
                SET last_synced_at = pg_catalog.clock_timestamp(), last_status = $2, last_error = $3,
                    last_counts = coalesce($4::text::jsonb, last_counts),
                    next_sync_at = {NEXT_DUE}
              WHERE table_id = $1::text::uuid"
        ),
        &[&table_id, &status, &error, &counts],
        SqlOp::Update,
    )
    .await?;
    outcome
}

/// `runSyncedTable`: « Synchroniser maintenant ».
pub async fn run(st: &Shared, ctx: &RequestContext, base_id: &str, table_id: &str) -> Result<Value, AppError> {
    let current = list(st, ctx, base_id, Some(table_id)).await?.into_iter().next().ok_or_else(|| not_found(table_id))?;
    let id = current.get("table_id").and_then(Value::as_str).unwrap_or(table_id).to_string();
    sync_table(st, &id).await?;
    one(list(st, ctx, base_id, Some(table_id)).await?)
}

/// `syncDue`: the tables due, one after the other (five at most a pass).
pub async fn sync_due(st: &Shared) -> Result<usize, AppError> {
    let conn = st.pools.catalog().await?;
    let due = conn
        .rows("SELECT table_id::text FROM _basedb.table_sync WHERE next_sync_at <= pg_catalog.clock_timestamp() ORDER BY next_sync_at LIMIT 5", &[])
        .await?;
    drop(conn);
    for row in &due {
        let id: String = row.get(0);
        let _ = sync_table(st, &id).await;
    }
    Ok(due.len())
}

// ── Routes ────────────────────────────────────────────────────────────────────────────────

async fn base_of(st: &Shared, ctx: &RequestContext, base: &str) -> Result<String, AppError> {
    Ok(basedb_catalog::projection::resolve_base(&st.pools, ctx, base).await?.0)
}

/// `syncedTableOf`: the context, the base, the table.
async fn synced_table_of(st: &Shared, headers: &HeaderMap, rid: &RequestId, tenant: &str, base: &str, table: &str) -> Result<(RequestContext, String, String), AppError> {
    let ctx = bearer_context(st, headers, rid, Some(tenant)).await?;
    let base_id = base_of(st, &ctx, base).await?;
    let t = basedb_catalog::projection::resolve_table(&st.pools, &ctx, base, table).await?;
    Ok((ctx, base_id, t.table_id))
}

/// `GET /api/v1/{tenant}/admin/bases/{base}/synced-tables`.
pub async fn list_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>) -> ApiResult {
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let base_id = base_of(&st, &ctx, &base).await?;
    Ok(json_ok(json!({ "data": list(&st, &ctx, &base_id, None).await? })))
}

/// `POST …/synced-tables/preview`.
pub async fn preview_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let base_id = base_of(&st, &ctx, &base).await?;
    let input = fields(&body)?.get("source").filter(|s| !s.is_null()).cloned().unwrap_or_else(|| json!({}));
    Ok(json_ok(json!({ "data": preview(&st, &ctx, &base_id, &input).await? })))
}

/// `POST …/synced-tables`.
pub async fn create_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base)): Path<(String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let ctx = bearer_context(&st, &headers, &rid, Some(&tenant)).await?;
    let base_id = base_of(&st, &ctx, &base).await?;
    let created = create(&st, &ctx, &base_id, fields(&body)?).await?;
    Ok(json_response(StatusCode::CREATED, &json!({ "data": created })))
}

/// `PATCH …/synced-tables/{table}`.
pub async fn update_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>, bytes: Bytes) -> ApiResult {
    let body = strict_json(&bytes)?;
    let (ctx, base_id, table_id) = synced_table_of(&st, &headers, &rid, &tenant, &base, &table).await?;
    let updated = update(&st, &ctx, &base_id, &table_id, fields(&body)?).await?;
    Ok(json_ok(json!({ "data": updated })))
}

/// `DELETE …/synced-tables/{table}`.
pub async fn stop_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>) -> ApiResult {
    let (ctx, base_id, table_id) = synced_table_of(&st, &headers, &rid, &tenant, &base, &table).await?;
    stop(&st, &ctx, &base_id, &table_id).await?;
    Ok(empty(StatusCode::NO_CONTENT))
}

/// `POST …/synced-tables/{table}/run`.
pub async fn run_route(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path((tenant, base, table)): Path<(String, String, String)>) -> ApiResult {
    let (ctx, base_id, table_id) = synced_table_of(&st, &headers, &rid, &tenant, &base, &table).await?;
    Ok(json_ok(json!({ "data": run(&st, &ctx, &base_id, &table_id).await? })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys() -> Vec<String> {
        vec!["c0".into(), "c1".into()]
    }

    fn reason(r: Result<Settings, AppError>) -> (String, String) {
        let e = r.unwrap_err();
        (js_string(&e.details["field"]), js_string(&e.details["reason"]))
    }

    #[test]
    fn settings_are_checked_over_the_current_ones() {
        let s = checked_settings(&json!({}), None, &keys()).unwrap();
        assert_eq!(s, Settings { mode: "mirror".into(), schedule: "interval".into(), interval_minutes: 60, daily_at: None, time_zone: "UTC".into(), key_columns: None });
        let s = checked_settings(&json!({ "interval_minutes": 14.5, "daily_at": ["10:30"], "key_columns": ["c1", "c1", "c0"] }), None, &keys()).unwrap();
        assert_eq!((s.interval_minutes, s.daily_at.as_deref(), s.key_columns), (15, Some("10:30"), Some(vec!["c1".to_string(), "c0".to_string()])));
        let current = Settings { mode: "upsert".into(), schedule: "daily".into(), interval_minutes: 30, daily_at: Some("08:00".into()), time_zone: "Europe/Paris".into(), key_columns: Some(vec!["c0".into()]) };
        assert_eq!(checked_settings(&json!({ "interval_minutes": null }), Some(&current), &keys()).unwrap(), current);
        assert_eq!(checked_settings(&json!({ "key_columns": [] }), Some(&current), &keys()).unwrap().key_columns, None);
        let cases = [
            (json!({ "mode": null }), ("mode", "mode_inconnu")),
            (json!({ "schedule": "hourly" }), ("schedule", "rythme_inconnu")),
            (json!({ "interval_minutes": "60" }), ("interval_minutes", "entre_15_et_1440")),
            (json!({ "interval_minutes": 1440.5 }), ("interval_minutes", "entre_15_et_1440")),
            (json!({ "daily_at": "24:00" }), ("daily_at", "heure_invalide")),
            (json!({ "schedule": "daily", "daily_at": "" }), ("daily_at", "heure_requise")),
            (json!({ "time_zone": null }), ("time_zone", "fuseau_inconnu")),
            (json!({ "key_columns": ["c9"] }), ("key_columns", "colonne_inconnue")),
            (json!({ "key_columns": "c0" }), ("key_columns", "colonne_inconnue")),
        ];
        for (input, (field, why)) in cases {
            assert_eq!(reason(checked_settings(&input, None, &keys())), (field.to_string(), why.to_string()), "{input}");
        }
    }

    #[test]
    fn rows_are_keyed_by_the_chosen_columns() {
        let row = |a: Value, b: Value| SourceRow { key: "k".into(), values: [("a".to_string(), a), ("b".to_string(), b)].into_iter().collect() };
        let rows = keyed(vec![row(json!("x"), json!(1.5)), row(json!(null), json!(2)), row(json!("x"), json!(1.5))], Some(&["a".to_string(), "b".to_string()]));
        let got: Vec<&str> = rows.iter().map(|r| r.key.as_str()).collect();
        assert_eq!(got, ["x · 1.5", " · 2", "x · 1.5#2"]);
        assert_eq!(keyed(vec![row(json!(1), json!(2))], Some(&[])).remove(0).key, "k");
        assert_eq!(url_host("http://h.example:8796/a.csv").as_deref(), Some("h.example:8796"));
        assert_eq!(url_host("https://h.example:443/").as_deref(), Some("h.example"));
        assert_eq!(url_host("pas une adresse"), None);
        assert!(checked_parameters(Some(&json!([1]))).is_err());
        assert_eq!(checked_parameters(Some(&json!(null))).unwrap(), None);
    }
}
