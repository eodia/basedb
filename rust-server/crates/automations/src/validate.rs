//! `checkedDefinition` / `checkedStep` of `automations/catalog.ts`: an automation as given,
//! checked against its base, its steps stored (camelCase keys, Node's key order).

use crate::defs::*;
use basedb_base::db::Exec;
use basedb_base::error::AppError;
use basedb_base::tx::{RequestContext, Tx};
use basedb_catalog::targets::{check_target, TargetPolicy};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::pin::Pin;

/// `invalid(field, reason, detail?)`.
pub fn invalid(field: &str, reason: &str, detail: Option<Value>) -> AppError {
    let mut details = Map::new();
    details.insert("field".into(), json!(field));
    details.insert("reason".into(), json!(reason));
    if let Some(d) = detail {
        details.insert("detail".into(), d);
    }
    AppError::new("REQUEST_INVALID").details(Value::Object(details))
}

fn inv(field: &str, reason: &str) -> AppError {
    invalid(field, reason, None)
}

fn invd(field: &str, reason: &str, detail: impl Into<Value>) -> AppError {
    invalid(field, reason, Some(detail.into()))
}

/// `TableInfo`.
#[derive(Debug, Clone)]
pub struct TableInfo {
    pub id: String,
    pub name: String,
    pub fields: HashMap<String, String>,
}

impl TableInfo {
    pub fn kind(&self, field: &str) -> Option<&str> {
        self.fields.get(field).map(String::as_str)
    }
}

/// `tablesOf`: the live tables of a base.
pub async fn tables_of<E: Exec + Sync>(exec: &E, base_id: &str) -> Result<Vec<TableInfo>, AppError> {
    let rows = exec
        .rows(
            "SELECT t.id::text, tn.name, fn.name AS field, f.kind
               FROM _basedb.table_def t
               JOIN _basedb.physical_name tn ON tn.id = t.name_id
               LEFT JOIN _basedb.field f ON f.table_id = t.id AND f.is_live
               LEFT JOIN _basedb.physical_name fn ON fn.id = f.name_id
              WHERE t.base_id = $1::text::uuid AND t.is_live",
            &[&base_id],
        )
        .await?;
    let mut out: Vec<TableInfo> = Vec::new();
    for r in rows {
        let id: String = r.get(0);
        let at = match out.iter().position(|t| t.id == id) {
            Some(i) => i,
            None => {
                out.push(TableInfo { id: id.clone(), name: r.get(1), fields: HashMap::new() });
                out.len() - 1
            }
        };
        if let (Some(f), Some(k)) = (r.get::<_, Option<String>>(2), r.get::<_, Option<String>>(3)) {
            out[at].fields.insert(f, k);
        }
    }
    Ok(out)
}

fn table_by_name<'a>(tables: &'a [TableInfo], name: Option<&Value>, field: &str) -> Result<&'a TableInfo, AppError> {
    let n = name.and_then(Value::as_str);
    tables.iter().find(|t| Some(t.name.as_str()) == n || Some(t.id.as_str()) == n).ok_or_else(|| invalid(field, "table_inconnue", name.cloned()))
}

/// `Scope`.
#[derive(Clone)]
pub struct Scope {
    pub trigger: Option<TableInfo>,
    /// Step id → the table of the row it gives, `None` for none.
    pub steps: HashMap<String, Option<TableInfo>>,
    pub deleted: bool,
    pub payload: bool,
}

/// `citationsOf`.
pub fn citations_of(text: &str) -> Vec<Vec<String>> {
    citation().captures_iter(text).map(|m| m[1].split('.').map(str::to_string).collect()).collect()
}

/// `checkCitations`.
pub fn check_citations(text: &str, scope: &Scope, field: &str) -> Result<(), AppError> {
    for path in citations_of(text) {
        let head = &path[0];
        let triggering = head == TRIGGER_ROW && (scope.trigger.is_some() || scope.payload);
        if path.len() > 1 && !triggering && !scope.steps.contains_key(head) {
            return Err(invd(field, "etape_inconnue", head.as_str()));
        }
    }
    Ok(())
}

fn checked_values(raw: &Value, table: &TableInfo, field: &str, scope: &Scope) -> Result<Value, AppError> {
    let Some(values) = raw.as_object() else { return Err(inv(field, "valeurs_invalides")) };
    if values.is_empty() {
        return Err(inv(field, "aucune_valeur"));
    }
    for (name, value) in values {
        if !table.fields.contains_key(name) {
            return Err(invd(field, "champ_inconnu", name.as_str()));
        }
        if let Some(s) = value.as_str() {
            check_citations(s, scope, &format!("{field}.{name}"))?;
        }
    }
    Ok(raw.clone())
}

/// `rowSource`: the ref, and the table of that row.
pub fn row_source(raw: &Value, scope: &Scope, field: &str, required: Option<&str>, acting: bool) -> Result<(Option<String>, Option<TableInfo>), AppError> {
    let r#ref = match raw.as_str().filter(|s| !s.is_empty()) {
        Some(s) => Some(s.to_string()),
        None => scope.trigger.as_ref().map(|_| TRIGGER_ROW.to_string()),
    };
    let Some(r#ref) = r#ref.filter(|r| !(r == TRIGGER_ROW && scope.trigger.is_none())) else {
        if let Some(reason) = required {
            return Err(inv(field, reason));
        }
        return Ok((None, None));
    };
    if r#ref == TRIGGER_ROW && acting && scope.deleted {
        return Err(inv(field, "ligne_supprimee"));
    }
    if r#ref == TRIGGER_ROW {
        return Ok((Some(r#ref), scope.trigger.clone()));
    }
    match scope.steps.get(&r#ref) {
        None => Err(invd(field, "etape_inconnue", r#ref.as_str())),
        Some(None) => Err(invd(field, "etape_sans_ligne", r#ref.as_str())),
        Some(Some(t)) => Ok((Some(r#ref.clone()), Some(t.clone()))),
    }
}

/// `idsOf`.
fn ids_of(raw: &Value, into: &mut HashSet<String>) {
    for step in arr(raw) {
        if let Some(id) = step["id"].as_str() {
            into.insert(id.to_string());
        }
        ids_of(&step["steps"], into);
        for p in arr(&step["paths"]) {
            if let Some(id) = p["id"].as_str() {
                into.insert(id.to_string());
            }
            ids_of(&p["steps"], into);
        }
    }
}

/// `Walk`.
pub struct Walk<'a> {
    pub tx: Tx,
    pub ctx: &'a RequestContext,
    pub base_id: String,
    pub tables: Vec<TableInfo>,
    pub targets: &'a TargetPolicy,
    pub taken: HashSet<String>,
    pub seen: HashSet<String>,
    pub writing: bool,
    /// The instance key that seals a secret header; `None` for a draft.
    pub sealing: Option<String>,
    pub kept: HashMap<String, Vec<Value>>,
    pub self_id: Option<String>,
    pub documents: HashSet<String>,
    pub count: usize,
    /// What `resolveProvider` reads, when an AI step is written.
    pub env: &'a basedb_base::config::Config,
}

#[derive(Clone, Copy)]
struct Place {
    depth: usize,
    in_loop: bool,
    in_attempt: bool,
}

/// `identifier`.
fn identifier(walk: &mut Walk<'_>, raw: &Value, prefix: char, field: &str) -> Result<String, AppError> {
    let given = !(raw.is_null() || raw.as_str() == Some(""));
    if given {
        let Some(s) = raw.as_str().filter(|s| step_id_re().is_match(s) && *s != TRIGGER_ROW) else {
            return Err(invd(field, "identifiant_invalide", raw.clone()));
        };
        if walk.seen.contains(s) {
            return Err(invd(field, "identifiant_en_double", s));
        }
        walk.seen.insert(s.to_string());
        return Ok(s.to_string());
    }
    let mut n = 1;
    while walk.taken.contains(&format!("{prefix}{n}")) {
        n += 1;
    }
    let id = format!("{prefix}{n}");
    walk.taken.insert(id.clone());
    walk.seen.insert(id.clone());
    Ok(id)
}

/// `aboutStep`.
fn about_step(error: AppError, id: &str) -> AppError {
    if error.code == "INTERNAL_ERROR" || error.details.contains_key("step") {
        return error;
    }
    error.with("step", json!(id))
}

type Boxed<'a, T> = Pin<Box<dyn Future<Output = Result<T, AppError>> + Send + 'a>>;

fn checked_steps<'w, 'a: 'w>(walk: &'w mut Walk<'a>, raw: &'w Value, outer: &'w Scope, at: &'w str, place: Place) -> Boxed<'w, Vec<Value>> {
    Box::pin(async move {
        let Some(list) = raw.as_array() else { return Err(inv(at, "etapes_invalides")) };
        let mut scope = outer.clone();
        let mut out = Vec::new();
        for (index, item) in list.iter().enumerate() {
            let field = format!("{at}[{index}]");
            let empty = json!({});
            let a = if item.is_object() { item } else { &empty };
            walk.count += 1;
            if walk.count > MAX_STEPS {
                return Err(invd("actions", "trop_d_etapes", MAX_STEPS));
            }
            let id = identifier(walk, a.get("id").unwrap_or(&Value::Null), 'e', &format!("{field}.id"))?;
            match checked_step(walk, a, &id, &scope, &field, place).await {
                Ok((step, gives)) => {
                    out.push(step);
                    if let Some(g) = gives {
                        scope.steps.insert(id, g);
                    }
                }
                Err(e) => return Err(about_step(e, &id)),
            }
        }
        Ok(out)
    })
}

fn trimmed(v: &Value) -> String {
    v.as_str().map(|s| js_trim(s).to_string()).unwrap_or_default()
}

fn nonempty(v: &Value) -> Option<String> {
    v.as_str().filter(|s| !s.is_empty()).map(str::to_string)
}

fn uuids(v: &Value) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for u in arr(v) {
        if let Some(s) = u.as_str().filter(|s| uuid_re().is_match(s)) {
            if !out.iter().any(|x| x == s) {
                out.push(s.to_string());
            }
        }
    }
    out
}

fn addresses(v: &Value) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for x in arr(v) {
        if let Some(s) = x.as_str() {
            let t = js_trim(s);
            let t = if t.len() >= 7 && t[..7].eq_ignore_ascii_case("mailto:") { &t[7..] } else { t };
            if !t.is_empty() && !out.iter().any(|y| y == t) {
                out.push(t.to_string());
            }
        }
    }
    out
}

async fn known_users(walk: &Walk<'_>, users: &[String], field: &str) -> Result<(), AppError> {
    if users.is_empty() {
        return Ok(());
    }
    let rows = walk
        .tx
        .rows(
            "SELECT u.id::text FROM _basedb.app_user u JOIN _basedb.tenant t ON t.id = u.tenant_id
              WHERE t.ref = $1 AND u.id = ANY($2::text[]::uuid[]) AND u.deleted_at IS NULL",
            &[&walk.ctx.tenant_id, &users],
        )
        .await?;
    let known: Vec<String> = rows.iter().map(|r| r.get::<_, String>(0)).collect();
    if let Some(unknown) = users.iter().find(|u| !known.iter().any(|k| k.eq_ignore_ascii_case(u))) {
        return Err(invd(field, "personne_inconnue", unknown.as_str()));
    }
    Ok(())
}

fn checked_sort(raw: &Value, table: &TableInfo, at: &str) -> Result<Value, AppError> {
    let sort = trimmed(raw);
    if sort.is_empty() {
        return Ok(Value::Null);
    }
    let name = sort.strip_prefix('-').unwrap_or(&sort);
    if !table.fields.contains_key(name) && !SYSTEM_SORTS.contains(&name) {
        return Err(invd(&format!("{at}.sort"), "champ_inconnu", name));
    }
    Ok(json!(sort))
}

fn checked_filter(raw: &Value, scope: &Scope, at: &str) -> Result<String, AppError> {
    let filter = trimmed(raw);
    if js_len(&filter) > 4000 {
        return Err(inv(&format!("{at}.filter"), "texte_trop_long"));
    }
    check_citations(&filter, scope, &format!("{at}.filter"))?;
    Ok(filter)
}

fn obj(pairs: Vec<(&str, Value)>) -> Value {
    let mut m = Map::new();
    for (k, v) in pairs {
        m.insert(k.into(), v);
    }
    Value::Object(m)
}

fn opt(v: Option<String>) -> Value {
    v.map(Value::String).unwrap_or(Value::Null)
}

/// What a step gives: nothing (`None`), no row (`Some(None)`), a row of a table.
type Gives = Option<Option<TableInfo>>;

async fn checked_step(walk: &mut Walk<'_>, a: &Value, id: &str, scope: &Scope, at: &str, place: Place) -> Result<(Value, Gives), AppError> {
    let g = |k: &str| a.get(k).unwrap_or(&Value::Null);
    let kind = a.get("kind").cloned().unwrap_or(Value::Null);
    match kind.as_str().unwrap_or("") {
        "update_record" => {
            let (r, table) = row_source(g("record"), scope, &format!("{at}.record"), Some("action_sans_ligne"), true)?;
            let table = table.expect("required");
            let values = checked_values(g("values"), &table, &format!("{at}.values"), scope)?;
            Ok((obj(vec![("id", json!(id)), ("kind", json!("update_record")), ("record", opt(r)), ("values", values)]), Some(Some(table))))
        }
        "create_record" => {
            let table = table_by_name(&walk.tables, a.get("table"), &format!("{at}.table"))?.clone();
            let values = checked_values(g("values"), &table, &format!("{at}.values"), scope)?;
            Ok((obj(vec![("id", json!(id)), ("kind", json!("create_record")), ("table", json!(table.id)), ("values", values)]), Some(Some(table))))
        }
        "find_record" => {
            let table = table_by_name(&walk.tables, a.get("table"), &format!("{at}.table"))?.clone();
            let filter = checked_filter(g("filter"), scope, at)?;
            let sort = checked_sort(g("sort"), &table, at)?;
            Ok((obj(vec![("id", json!(id)), ("kind", json!("find_record")), ("table", json!(table.id)), ("filter", json!(filter)), ("sort", sort)]), Some(Some(table))))
        }
        "notify" => {
            let (r, table) = row_source(g("record"), scope, &format!("{at}.record"), None, false)?;
            let users = uuids(g("users"));
            if users.len() > MAX_NOTIFIED {
                return Err(invd(&format!("{at}.users"), "trop_de_personnes", MAX_NOTIFIED));
            }
            let user_field = nonempty(g("user_field"));
            if let Some(f) = &user_field {
                if table.as_ref().and_then(|t| t.kind(f)) != Some("user") {
                    return Err(invd(&format!("{at}.user_field"), "champ_personne_attendu", f.as_str()));
                }
            }
            if users.is_empty() && user_field.is_none() {
                return Err(inv(&format!("{at}.users"), "personne_a_prevenir"));
            }
            known_users(walk, &users, &format!("{at}.users")).await?;
            let message = trimmed(g("message"));
            if message.is_empty() || js_len(&message) > 1000 {
                return Err(inv(&format!("{at}.message"), "message_invalide"));
            }
            check_citations(&message, scope, &format!("{at}.message"))?;
            Ok((
                obj(vec![("id", json!(id)), ("kind", json!("notify")), ("record", opt(r)), ("users", json!(users)), ("userField", opt(user_field)), ("message", json!(message))]),
                None,
            ))
        }
        "email" => {
            let (r, table) = row_source(g("record"), scope, &format!("{at}.record"), None, false)?;
            let users = uuids(g("users"));
            let addrs = addresses(g("addresses"));
            if let Some(wrong) = addrs.iter().find(|x| !is_address(x)) {
                return Err(invd(&format!("{at}.addresses"), "adresse_email", wrong.as_str()));
            }
            if users.len() + addrs.len() > MAX_MAILED {
                return Err(invd(&format!("{at}.users"), "trop_de_destinataires", MAX_MAILED));
            }
            let user_field = nonempty(g("user_field"));
            if let Some(f) = &user_field {
                if table.as_ref().and_then(|t| t.kind(f)) != Some("user") {
                    return Err(invd(&format!("{at}.user_field"), "champ_personne_attendu", f.as_str()));
                }
            }
            let email_field = nonempty(g("email_field"));
            if let Some(f) = &email_field {
                if table.as_ref().and_then(|t| t.kind(f)) != Some("email") {
                    return Err(invd(&format!("{at}.email_field"), "champ_email_attendu", f.as_str()));
                }
            }
            if users.is_empty() && addrs.is_empty() && user_field.is_none() && email_field.is_none() {
                return Err(inv(&format!("{at}.users"), "destinataire_manquant"));
            }
            known_users(walk, &users, &format!("{at}.users")).await?;
            let subject = trimmed(g("subject"));
            if subject.is_empty() || js_len(&subject) > 200 || subject.contains(['\r', '\n']) {
                return Err(inv(&format!("{at}.subject"), "objet_invalide"));
            }
            check_citations(&subject, scope, &format!("{at}.subject"))?;
            let format = if g("format").is_null() { json!("text") } else { g("format").clone() };
            let html = match format.as_str() {
                Some("text") => false,
                Some("html") => true,
                _ => return Err(invd(&format!("{at}.format"), "format_inconnu", format.clone())),
            };
            let written = trimmed(g("message"));
            let message = if html { basedb_records::html::sanitize_rich_text(&written) } else { written };
            if message.is_empty() || js_len(&message) > if html { 50_000 } else { 5000 } {
                return Err(inv(&format!("{at}.message"), "message_invalide"));
            }
            check_citations(&message, scope, &format!("{at}.message"))?;
            let mode = if g("mode").is_null() { json!("each") } else { g("mode").clone() };
            if mode != json!("each") && mode != json!("together") {
                return Err(invd(&format!("{at}.mode"), "valeur_invalide", mode.clone()));
            }
            let cc = addresses(g("cc"));
            if !cc.is_empty() && mode != json!("together") {
                return Err(inv(&format!("{at}.cc"), "copie_sans_envoi_groupe"));
            }
            if cc.len() > MAX_CC {
                return Err(invd(&format!("{at}.cc"), "trop_de_destinataires", MAX_CC));
            }
            if let Some(wrong) = cc.iter().find(|x| !is_address(x)) {
                return Err(invd(&format!("{at}.cc"), "adresse_email", wrong.as_str()));
            }
            let reply_to = Some(trimmed(g("reply_to"))).filter(|s| !s.is_empty() && g("reply_to").is_string());
            if let Some(rt) = &reply_to {
                let plain = citation().replace_all(rt, "");
                if js_len(rt) > 254 || (plain == rt.as_str() && !is_address(rt)) {
                    return Err(invd(&format!("{at}.reply_to"), "reponse_a_invalide", rt.as_str()));
                }
                check_citations(rt, scope, &format!("{at}.reply_to"))?;
            }
            let attachments = checked_attachments(g("attachments"), scope, walk, &format!("{at}.attachments"))?;
            Ok((
                obj(vec![
                    ("id", json!(id)),
                    ("kind", json!("email")),
                    ("record", opt(r)),
                    ("users", json!(users)),
                    ("userField", opt(user_field)),
                    ("emailField", opt(email_field)),
                    ("addresses", json!(addrs)),
                    ("subject", json!(subject)),
                    ("message", json!(message)),
                    ("mode", mode),
                    ("cc", json!(cc)),
                    ("replyTo", opt(reply_to)),
                    ("format", format),
                    ("attachments", Value::Array(attachments)),
                ]),
                None,
            ))
        }
        "webhook" => {
            let (r, _) = row_source(g("record"), scope, &format!("{at}.record"), None, false)?;
            let (text, plain) = url_of(g("url"), &format!("{at}.url"))?;
            check_citations(&text, scope, &format!("{at}.url"))?;
            let host = check_target(&plain, walk.targets).await?.host_str().unwrap_or("").to_lowercase();
            let method = if g("method").is_null() { json!("POST") } else { g("method").clone() };
            let Some(m) = method.as_str().filter(|m| HTTP_METHODS.contains(m)) else {
                return Err(invd(&format!("{at}.method"), "methode_inconnue", method.clone()));
            };
            let m = m.to_string();
            let format = if g("format").is_null() { json!("json") } else { g("format").clone() };
            let Some(f) = format.as_str().filter(|f| BODY_FORMATS.contains(f)) else {
                return Err(invd(&format!("{at}.format"), "format_inconnu", format.clone()));
            };
            let f = f.to_string();
            let headers = checked_headers(walk, g("headers"), id, &host, scope, &format!("{at}.headers"))?;
            let composed = !g("body").is_null();
            if composed && !has_body(&m) {
                return Err(invd(&format!("{at}.body"), "corps_sans_objet", m.as_str()));
            }
            let body = if composed { json!(checked_body(g("body"), &f, scope, &format!("{at}.body"))?) } else { Value::Null };
            let retries = if g("retries").is_null() { json!(0) } else { g("retries").clone() };
            if !integer_of(&retries).is_some_and(|n| (0.0..=MAX_RETRIES).contains(&n)) {
                return Err(invd(&format!("{at}.retries"), "reessais_invalides", 3));
            }
            Ok((
                obj(vec![
                    ("id", json!(id)),
                    ("kind", json!("webhook")),
                    ("record", opt(r)),
                    ("url", json!(text)),
                    ("method", json!(m)),
                    ("headers", Value::Array(headers)),
                    ("body", body),
                    ("format", json!(f)),
                    ("retries", retries),
                ]),
                Some(None),
            ))
        }
        "for_each" => {
            if place.in_loop {
                return Err(inv(at, "boucle_dans_boucle"));
            }
            if place.depth >= MAX_DEPTH {
                return Err(invd(at, "branches_trop_profondes", MAX_DEPTH));
            }
            let table = table_by_name(&walk.tables, a.get("table"), &format!("{at}.table"))?.clone();
            let filter = checked_filter(g("filter"), scope, at)?;
            let sort = checked_sort(g("sort"), &table, at)?;
            let limit = if g("limit").is_null() { json!(DEFAULT_LOOP_ROWS as i64) } else { g("limit").clone() };
            if !integer_of(&limit).is_some_and(|n| (1.0..=MAX_LOOP_ROWS).contains(&n)) {
                return Err(invd(&format!("{at}.limit"), "limite_invalide", 200));
            }
            let on_error = if g("on_error").is_null() { json!("stop") } else { g("on_error").clone() };
            if on_error != json!("stop") && on_error != json!("continue") {
                return Err(invd(&format!("{at}.on_error"), "valeur_invalide", on_error.clone()));
            }
            let mut inner = scope.clone();
            inner.steps.insert(id.to_string(), Some(table.clone()));
            let raw_steps = if g("steps").is_null() { json!([]) } else { g("steps").clone() };
            let steps = checked_steps(walk, &raw_steps, &inner, &format!("{at}.steps"), Place { depth: place.depth + 1, in_loop: true, ..place }).await?;
            Ok((
                obj(vec![
                    ("id", json!(id)),
                    ("kind", json!("for_each")),
                    ("table", json!(table.id)),
                    ("filter", json!(filter)),
                    ("sort", sort),
                    ("limit", limit),
                    ("onError", on_error),
                    ("steps", Value::Array(steps)),
                ]),
                Some(None),
            ))
        }
        "slack" => {
            let integration = g("integration").as_str().unwrap_or("").to_string();
            let found = walk
                .tx
                .first(
                    "SELECT id::text FROM _basedb.integration
                      WHERE id::text = $1 AND base_id = $2::text::uuid AND kind = 'slack' AND deleted_at IS NULL",
                    &[&integration, &walk.base_id],
                )
                .await?;
            if found.is_none() {
                return Err(invd(&format!("{at}.integration"), "connexion_inconnue", integration.as_str()));
            }
            let message = trimmed(g("message"));
            if message.is_empty() || js_len(&message) > 3000 {
                return Err(inv(&format!("{at}.message"), "message_invalide"));
            }
            check_citations(&message, scope, &format!("{at}.message"))?;
            Ok((obj(vec![("id", json!(id)), ("kind", json!("slack")), ("integration", json!(integration)), ("message", json!(message))]), None))
        }
        "ai" => {
            let prompt = trimmed(g("prompt"));
            if prompt.is_empty() {
                return Err(inv(&format!("{at}.prompt"), "consigne_vide"));
            }
            if prompt.chars().count() > MAX_PROMPT_CHARS {
                return Err(invd(&format!("{at}.prompt"), "consigne_trop_longue", MAX_PROMPT_CHARS));
            }
            check_citations(&prompt, scope, &format!("{at}.prompt"))?;
            let answer = if g("answer").is_null() { json!("long_text") } else { g("answer").clone() };
            if !answer.as_str().is_some_and(|x| AI_KINDS.contains(&x)) {
                return Err(invd(&format!("{at}.answer"), "reponse_inconnue", answer.clone()));
            }
            let select = answer == json!("select");
            let mut options: Vec<String> = Vec::new();
            if select {
                for o in arr(g("options")) {
                    if let Some(s) = o.as_str() {
                        let t = js_trim(s);
                        if !t.is_empty() && !options.iter().any(|x| x == t) {
                            options.push(t.to_string());
                        }
                    }
                }
            }
            if select && options.is_empty() {
                return Err(inv(&format!("{at}.options"), "aucun_choix"));
            }
            if options.len() > MAX_AI_OPTIONS || options.iter().any(|o| js_len(o) > 255) {
                return Err(invd(&format!("{at}.options"), "trop_de_choix", MAX_AI_OPTIONS));
            }
            if g("consent") != &json!(true) {
                return Err(AppError::new("AI_CONSENT_REQUIRED").with("field", json!(format!("{at}.consent"))).with("reason", json!("consentement_requis")));
            }
            if walk.writing {
                basedb_ai::provider::resolve_provider(&walk.tx, walk.ctx, walk.env).await?;
            }
            Ok((
                obj(vec![("id", json!(id)), ("kind", json!("ai")), ("prompt", json!(prompt)), ("answer", answer), ("options", json!(options)), ("consent", json!(true))]),
                Some(None),
            ))
        }
        "branch" => {
            if place.depth >= MAX_DEPTH {
                return Err(invd(at, "branches_trop_profondes", MAX_DEPTH));
            }
            let raw = arr(g("paths"));
            if raw.is_empty() {
                return Err(inv(&format!("{at}.paths"), "aucun_chemin"));
            }
            if raw.len() > MAX_PATHS {
                return Err(invd(&format!("{at}.paths"), "trop_de_chemins", MAX_PATHS));
            }
            let mut paths = Vec::new();
            for (index, item) in raw.iter().enumerate() {
                let field = format!("{at}.paths[{index}]");
                let pid = identifier(walk, item.get("id").unwrap_or(&Value::Null), 'c', &format!("{field}.id"))?;
                let w = item.get("when").unwrap_or(&Value::Null);
                let when = if !w.is_null() {
                    if w.get("op").is_some() {
                        checked_value_test(w, scope, &format!("{field}.when"))?
                    } else {
                        let (r, _) = row_source(w.get("record").unwrap_or(&Value::Null), scope, &format!("{field}.when.record"), Some("condition_sans_ligne"), false)?;
                        let condition = trimmed(w.get("condition").unwrap_or(&Value::Null));
                        if js_len(&condition) > 4000 {
                            return Err(inv(&format!("{field}.when.condition"), "texte_trop_long"));
                        }
                        check_citations(&condition, scope, &format!("{field}.when.condition"))?;
                        obj(vec![("record", opt(r)), ("condition", json!(condition))])
                    }
                } else {
                    if index != raw.len() - 1 {
                        return Err(inv(&format!("{field}.when"), "sinon_en_dernier"));
                    }
                    Value::Null
                };
                let label = match item.get("label").and_then(Value::as_str).map(js_trim).filter(|s| !s.is_empty()) {
                    Some(l) => js_slice(l, 60),
                    None if when.is_null() => "Sinon".into(),
                    None => format!("Chemin {}", index + 1),
                };
                let raw_steps = item.get("steps").filter(|v| !v.is_null()).cloned().unwrap_or(json!([]));
                let steps = checked_steps(walk, &raw_steps, scope, &format!("{field}.steps"), Place { depth: place.depth + 1, ..place }).await?;
                paths.push(obj(vec![("id", json!(pid)), ("label", json!(label)), ("when", when), ("steps", Value::Array(steps))]));
            }
            Ok((obj(vec![("id", json!(id)), ("kind", json!("branch")), ("paths", Value::Array(paths))]), None))
        }
        "attempt" => {
            if place.depth >= MAX_DEPTH {
                return Err(invd(at, "branches_trop_profondes", MAX_DEPTH));
            }
            let raw = arr(g("paths"));
            if raw.len() != 2 {
                return Err(inv(&format!("{at}.paths"), "essai_deux_chemins"));
            }
            let mut paths = Vec::new();
            for (index, item) in raw.iter().enumerate() {
                let field = format!("{at}.paths[{index}]");
                let pid = identifier(walk, item.get("id").unwrap_or(&Value::Null), 'c', &format!("{field}.id"))?;
                let label = match item.get("label").and_then(Value::as_str).map(js_trim).filter(|s| !s.is_empty()) {
                    Some(l) => js_slice(l, 60),
                    None if index == 0 => "Essayer".into(),
                    None => "En cas d\u{2019}\u{e9}chec".into(),
                };
                let mut inner = scope.clone();
                if index != 0 {
                    inner.steps.insert(id.to_string(), None);
                }
                let raw_steps = item.get("steps").filter(|v| !v.is_null()).cloned().unwrap_or(json!([]));
                let steps = checked_steps(walk, &raw_steps, &inner, &format!("{field}.steps"), Place { depth: place.depth + 1, in_attempt: true, ..place }).await?;
                paths.push(obj(vec![("id", json!(pid)), ("label", json!(label)), ("when", Value::Null), ("steps", Value::Array(steps))]));
            }
            Ok((obj(vec![("id", json!(id)), ("kind", json!("attempt")), ("paths", Value::Array(paths))]), Some(None)))
        }
        "delete_record" => {
            let (r, _) = row_source(g("record"), scope, &format!("{at}.record"), Some("action_sans_ligne"), true)?;
            Ok((obj(vec![("id", json!(id)), ("kind", json!("delete_record")), ("record", opt(r))]), None))
        }
        "aggregate" => {
            let table = table_by_name(&walk.tables, a.get("table"), &format!("{at}.table"))?.clone();
            let filter = checked_filter(g("filter"), scope, at)?;
            let raw = arr(g("measures"));
            if raw.len() > MAX_MEASURES {
                return Err(invd(&format!("{at}.measures"), "trop_de_mesures", MAX_MEASURES));
            }
            let mut measures: Vec<(String, String)> = Vec::new();
            for (index, m) in raw.iter().enumerate() {
                let field = m.get("field").and_then(Value::as_str).unwrap_or("").to_string();
                let kind = table.kind(&field);
                let f = m.get("fn").cloned().unwrap_or(Value::Null);
                let fs = f.as_str().unwrap_or("");
                let fits = match (fs, kind) {
                    ("sum" | "avg", Some(k)) => NUMERIC_KINDS.contains(&k),
                    ("min" | "max", Some(k)) => ORDERED_KINDS.contains(&k),
                    _ => false,
                };
                if !fits {
                    let shown = if f.is_null() && m.get("fn").is_none() { "undefined".to_string() } else { js_string(&f) };
                    return Err(invd(&format!("{at}.measures[{index}]"), "mesure_invalide", format!("{shown}:{field}")));
                }
                if !measures.iter().any(|(x, y)| x == fs && *y == field) {
                    measures.push((fs.to_string(), field));
                }
            }
            let measures: Vec<Value> = measures.into_iter().map(|(f, field)| json!({ "fn": f, "field": field })).collect();
            Ok((
                obj(vec![("id", json!(id)), ("kind", json!("aggregate")), ("table", json!(table.id)), ("filter", json!(filter)), ("measures", Value::Array(measures))]),
                Some(None),
            ))
        }
        "run_automation" => {
            let target = g("automation").as_str().unwrap_or("").to_string();
            if !uuid_re().is_match(&target) {
                return Err(invd(&format!("{at}.automation"), "automation_inconnue", target.as_str()));
            }
            if walk.self_id.as_deref() == Some(target.as_str()) {
                return Err(inv(&format!("{at}.automation"), "automation_elle_meme"));
            }
            let found = walk
                .tx
                .first(
                    "SELECT trigger_kind, table_id::text FROM _basedb.automation
                      WHERE id = $1::text::uuid AND base_id = $2::text::uuid AND deleted_at IS NULL",
                    &[&target, &walk.base_id],
                )
                .await?;
            let Some(found) = found else { return Err(invd(&format!("{at}.automation"), "automation_inconnue", target.as_str())) };
            let table_id: Option<String> = found.get(1);
            let Some(table_id) = table_id else {
                return Ok((obj(vec![("id", json!(id)), ("kind", json!("run_automation")), ("automation", json!(target)), ("record", Value::Null)]), None));
            };
            let (r, table) = row_source(g("record"), scope, &format!("{at}.record"), Some("ligne_requise"), false)?;
            if table.map(|t| t.id) != Some(table_id) {
                return Err(inv(&format!("{at}.record"), "table_differente"));
            }
            Ok((obj(vec![("id", json!(id)), ("kind", json!("run_automation")), ("automation", json!(target)), ("record", opt(r))]), None))
        }
        "document" => {
            let (r, table) = row_source(g("record"), scope, &format!("{at}.record"), Some("action_sans_ligne"), true)?;
            let table = table.expect("required");
            let template = nonempty(g("template")).map(|t| t.to_lowercase());
            if let Some(t) = &template {
                let found = if uuid_re().is_match(t) {
                    walk.tx.first("SELECT id::text FROM _basedb.document_template WHERE id = $1::text::uuid AND table_id = $2::text::uuid", &[t, &table.id]).await?
                } else {
                    None
                };
                if found.is_none() {
                    return Err(invd(&format!("{at}.template"), "modele_inconnu", t.as_str()));
                }
            }
            let field = nonempty(g("field"));
            if let Some(f) = &field {
                if table.kind(f) != Some("file") {
                    return Err(invd(&format!("{at}.field"), "champ_fichier_attendu", f.as_str()));
                }
            }
            let name = js_slice(&trimmed(g("name")), 200);
            check_citations(&name, scope, &format!("{at}.name"))?;
            walk.documents.insert(id.to_string());
            Ok((
                obj(vec![("id", json!(id)), ("kind", json!("document")), ("record", opt(r)), ("template", opt(template)), ("field", opt(field)), ("name", json!(name))]),
                Some(None),
            ))
        }
        "wait" => {
            if place.in_loop {
                return Err(inv(at, "attente_dans_boucle"));
            }
            if place.in_attempt {
                return Err(inv(at, "attente_dans_essai"));
            }
            let d = g("duration");
            let u = g("until");
            if d.is_null() == u.is_null() {
                return Err(inv(at, "attente_invalide"));
            }
            if !d.is_null() {
                let unit = d.get("unit").cloned().unwrap_or(Value::Null);
                let amount = d.get("amount").cloned().unwrap_or(Value::Null);
                let days = match (amount.as_f64(), unit.as_str()) {
                    (Some(n), Some("days")) => n,
                    (Some(n), Some("hours")) => n / 24.0,
                    (Some(n), Some("minutes")) => n / 1440.0,
                    _ => f64::NAN,
                };
                if !integer_of(&amount).is_some_and(|n| n >= 1.0) || days.is_nan() || days > MAX_WAIT_DAYS {
                    return Err(invd(&format!("{at}.duration"), "attente_invalide", 365));
                }
                let mut duration = Map::new();
                duration.insert("amount".into(), amount);
                if d.get("unit").is_some() {
                    duration.insert("unit".into(), unit);
                }
                return Ok((obj(vec![("id", json!(id)), ("kind", json!("wait")), ("duration", Value::Object(duration)), ("until", Value::Null)]), None));
            }
            let (r, table) = row_source(u.get("record").unwrap_or(&Value::Null), scope, &format!("{at}.until.record"), Some("action_sans_ligne"), true)?;
            let field = u.get("field").and_then(Value::as_str).unwrap_or("").to_string();
            if !table.as_ref().and_then(|t| t.kind(&field)).is_some_and(|k| DATE_KINDS.contains(&k)) {
                return Err(invd(&format!("{at}.until.field"), "champ_date_attendu", field.as_str()));
            }
            let offset = match u.get("offset_days") {
                None => json!(0),
                Some(v) => v.clone(),
            };
            if !integer_of(&offset).is_some_and(|n| n.abs() <= MAX_WAIT_DAYS) {
                return Err(invd(&format!("{at}.until.offset_days"), "decalage_invalide", 365));
            }
            let (time, timezone) = checked_time_of_day(u, &format!("{at}.until"))?;
            Ok((
                obj(vec![
                    ("id", json!(id)),
                    ("kind", json!("wait")),
                    ("duration", Value::Null),
                    ("until", obj(vec![("record", opt(r)), ("field", json!(field)), ("offsetDays", offset), ("at", json!(time)), ("timezone", json!(timezone))])),
                ]),
                None,
            ))
        }
        _ => Err(invalid(&format!("{at}.kind"), "action_inconnue", Some(kind.clone())).with_undefined(a.get("kind").is_none())),
    }
}

trait Undefined {
    fn with_undefined(self, undefined: bool) -> Self;
}

impl Undefined for AppError {
    /// `detail: undefined` is left out of Node's details.
    fn with_undefined(mut self, undefined: bool) -> Self {
        if undefined {
            self.details.remove("detail");
        }
        self
    }
}

/// `checkedTimeOfDay`.
fn checked_time_of_day(raw: &Value, at: &str) -> Result<(String, String), AppError> {
    let time = nonempty(raw.get("at").unwrap_or(&Value::Null)).unwrap_or_else(|| "09:00".into());
    if !time_of_day_re().is_match(&time) {
        return Err(inv(&format!("{at}.at"), "heure_invalide"));
    }
    let timezone = nonempty(raw.get("timezone").unwrap_or(&Value::Null)).unwrap_or_else(|| "Europe/Paris".into());
    if zone_of(&timezone).is_none() {
        return Err(inv(&format!("{at}.timezone"), "fuseau_inconnu"));
    }
    Ok((time, timezone))
}

/// `checkedAttachments`.
fn checked_attachments(raw: &Value, scope: &Scope, walk: &Walk<'_>, at: &str) -> Result<Vec<Value>, AppError> {
    let list = arr(raw);
    if list.len() > MAX_ATTACHMENTS {
        return Err(invd(at, "trop_de_pieces_jointes", MAX_ATTACHMENTS));
    }
    let mut out = Vec::new();
    for (index, x) in list.iter().enumerate() {
        let field = format!("{at}[{index}]");
        if let Some(step) = x.get("step").and_then(Value::as_str) {
            if !walk.documents.contains(step) || !scope.steps.contains_key(step) {
                return Err(invd(&field, "piece_jointe_invalide", step));
            }
            out.push(json!({ "step": step }));
            continue;
        }
        let (r, table) = row_source(x.get("record").unwrap_or(&Value::Null), scope, &format!("{field}.record"), Some("piece_jointe_invalide"), false)?;
        let name = x.get("field").and_then(Value::as_str).unwrap_or("").to_string();
        if !table.as_ref().and_then(|t| t.kind(&name)).is_some_and(|k| FILE_KINDS.contains(&k)) {
            return Err(invd(&format!("{field}.field"), "champ_fichier_attendu", name.as_str()));
        }
        out.push(json!({ "record": r, "field": name }));
    }
    Ok(out)
}

/// `checkedValueTest`.
fn checked_value_test(w: &Value, scope: &Scope, at: &str) -> Result<Value, AppError> {
    let op = w.get("op").cloned().unwrap_or(Value::Null);
    let Some(o) = op.as_str().filter(|o| VALUE_OPERATORS.contains(o)) else {
        return Err(invalid(&format!("{at}.op"), "operateur_inconnu", Some(op.clone())));
    };
    let value = trimmed(w.get("value").unwrap_or(&Value::Null));
    if value.is_empty() || js_len(&value) > 1000 {
        return Err(inv(&format!("{at}.value"), "valeur_invalide"));
    }
    check_citations(&value, scope, &format!("{at}.value"))?;
    let operand = if o == "empty" || o == "not_empty" {
        String::new()
    } else {
        match w.get("operand") {
            Some(Value::String(s)) => js_trim(s).to_string(),
            Some(n @ Value::Number(_)) => js_string(n),
            _ => String::new(),
        }
    };
    if js_len(&operand) > 1000 {
        return Err(inv(&format!("{at}.operand"), "valeur_invalide"));
    }
    check_citations(&operand, scope, &format!("{at}.operand"))?;
    Ok(json!({ "value": value, "op": o, "operand": operand }))
}

/// `urlOf`.
fn url_of(raw: &Value, field: &str) -> Result<(String, String), AppError> {
    let text = trimmed(raw);
    static R: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let authority = R
        .get_or_init(|| regex::Regex::new(r"(?i)^[a-z][a-z0-9+.-]*://([^/?#]*)").unwrap())
        .captures(&text)
        .and_then(|m| m.get(1).map(|g| g.as_str().to_string()))
        .unwrap_or_default();
    if authority.contains('{') {
        return Err(inv(field, "hote_cite"));
    }
    let plain = citation().replace_all(&text, "x").into_owned();
    Ok((text, plain))
}

/// `checkedHeaders`.
fn checked_headers(walk: &Walk<'_>, raw: &Value, step: &str, host: &str, scope: &Scope, at: &str) -> Result<Vec<Value>, AppError> {
    let list = arr(raw);
    if list.len() > MAX_HEADERS {
        return Err(invd(at, "trop_d_entetes", MAX_HEADERS));
    }
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::new();
    for (index, h) in list.iter().enumerate() {
        let field = format!("{at}[{index}]");
        let name = trimmed(h.get("name").unwrap_or(&Value::Null));
        if !header_name_re().is_match(&name) {
            return Err(invd(&format!("{field}.name"), "entete_invalide", name.as_str()));
        }
        let key = name.to_lowercase();
        if FORBIDDEN_HEADERS.contains(&key.as_str()) {
            return Err(invd(&format!("{field}.name"), "entete_interdit", name.as_str()));
        }
        if !seen.insert(key.clone()) {
            return Err(invd(&format!("{field}.name"), "entete_en_double", name.as_str()));
        }
        let value = h.get("value").and_then(Value::as_str).unwrap_or("").to_string();
        if js_len(&value) > 4000 || value.contains(['\r', '\n', '\0']) {
            return Err(invd(&format!("{field}.value"), "valeur_d_entete_invalide", name.as_str()));
        }
        if h.get("secret") != Some(&json!(true)) {
            check_citations(&value, scope, &format!("{field}.value"))?;
            out.push(json!({ "name": name, "value": value }));
            continue;
        }
        if !js_trim(&value).is_empty() {
            let sealed = match &walk.sealing {
                None => String::new(),
                Some(key) => {
                    let plain = serde_json::to_string(&json!({ "base": walk.base_id, "host": host, "value": js_trim(&value) })).unwrap_or_default();
                    basedb_admin::sealing::seal(key, WEBHOOK_SECRET, &plain)
                }
            };
            out.push(json!({ "name": name, "sealed": sealed, "host": host }));
            continue;
        }
        let before = walk.kept.get(step).and_then(|hs| hs.iter().find(|k| k.get("sealed").is_some() && k["name"].as_str().is_some_and(|n| n.to_lowercase() == key)));
        match before {
            None => {
                if walk.sealing.is_some() {
                    return Err(invd(&format!("{field}.value"), "secret_manquant", name.as_str()));
                }
                out.push(json!({ "name": name, "sealed": "", "host": host }));
            }
            Some(b) => {
                if b["host"].as_str() != Some(host) {
                    return Err(invd(&format!("{field}.value"), "secret_a_redonner", name.as_str()));
                }
                out.push(b.clone());
            }
        }
    }
    Ok(out)
}

/// `checkedBody`.
fn checked_body(raw: &Value, format: &str, scope: &Scope, at: &str) -> Result<String, AppError> {
    let body = trimmed(raw);
    if body.is_empty() {
        return Err(inv(at, "corps_vide"));
    }
    if js_len(&body) > MAX_BODY_CHARS {
        return Err(invd(at, "corps_trop_long", MAX_BODY_CHARS));
    }
    check_citations(&body, scope, at)?;
    if format == "json" {
        let composed = compose_json(&body, |_, quoted| if quoted { "x".into() } else { "0".into() });
        if serde_json::from_str::<Value>(&composed).is_err() {
            return Err(inv(at, "corps_json_invalide"));
        }
    } else if format == "form" {
        let pairs: Vec<&str> = split_form(&body).into_iter().filter(|p| !js_trim(p).is_empty()).collect();
        if pairs.iter().any(|p| !p.contains('=')) || form_pairs(&body).iter().any(|(k, _)| k.is_empty()) {
            return Err(inv(at, "corps_formulaire_invalide"));
        }
    }
    Ok(body)
}

/// `checkedSchedule`.
fn checked_schedule(raw: &Value) -> Result<Value, AppError> {
    let every = raw.get("every").cloned().unwrap_or(Value::Null);
    if !every.as_str().is_some_and(|e| ["hour", "day", "week"].contains(&e)) {
        return Err(inv("trigger.schedule.every", "valeur_invalide"));
    }
    let at = raw.get("at").and_then(Value::as_str).unwrap_or("09:00").to_string();
    if !time_of_day_re().is_match(&at) {
        return Err(inv("trigger.schedule.at", "heure_invalide"));
    }
    let weekday = match raw.get("weekday") {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        _ => 1.0,
    };
    if !(weekday.is_finite() && weekday == weekday.trunc() && (1.0..=7.0).contains(&weekday)) {
        return Err(inv("trigger.schedule.weekday", "valeur_invalide"));
    }
    let timezone = nonempty(raw.get("timezone").unwrap_or(&Value::Null)).unwrap_or_else(|| "Europe/Paris".into());
    if zone_of(&timezone).is_none() {
        return Err(inv("trigger.schedule.timezone", "fuseau_inconnu"));
    }
    let weekday = match raw.get("weekday") {
        Some(n @ Value::Number(_)) => n.clone(),
        _ => json!(1),
    };
    Ok(json!({ "every": every, "at": at, "weekday": weekday, "timezone": timezone }))
}

/// A definition, checked: what `checkedDefinition` returns.
#[derive(Debug, Clone)]
pub struct Definition {
    pub label: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub kind: String,
    pub table: Option<String>,
    pub fields: Vec<String>,
    pub schedule: Value,
    /// Stored form.
    pub date: Value,
    pub condition: Option<String>,
    pub actions: Vec<Value>,
}

/// `checkedDefinition`.
#[allow(clippy::too_many_arguments)]
pub async fn checked_definition(
    tx: &Tx,
    ctx: &RequestContext,
    base_id: &str,
    input: &Value,
    current: Option<&Automation>,
    targets: &TargetPolicy,
    sealing: Option<String>,
    env: &basedb_base::config::Config,
) -> Result<Definition, AppError> {
    let label = match input.get("label") {
        Some(Value::String(s)) => js_trim(s).to_string(),
        _ => current.map(|c| c.label.clone()).unwrap_or_default(),
    };
    if label.is_empty() || js_len(&label) > 255 {
        return Err(inv("label", "libelle_invalide"));
    }
    let description = match input.get("description") {
        None => current.and_then(|c| c.description.clone()),
        Some(Value::String(s)) if !js_trim(s).is_empty() => Some(js_slice(js_trim(s), 2000)),
        Some(_) => None,
    };
    let enabled = match input.get("enabled") {
        None => current.map(|c| c.enabled).unwrap_or(true),
        Some(v) => v == &json!(true),
    };
    let tables = tables_of(tx, base_id).await?;
    let raw_trigger = match input.get("trigger").filter(|v| !v.is_null()) {
        Some(t) => t.clone(),
        None => current.map(|c| c.wire_trigger()).unwrap_or(json!({})),
    };
    let kind_v = raw_trigger.get("kind").cloned().unwrap_or(Value::Null);
    let Some(kind) = kind_v.as_str().filter(|k| TRIGGERS.contains(k)).map(str::to_string) else {
        let e = invalid("trigger.kind", "declencheur_inconnu", Some(kind_v.clone()));
        return Err(e.with_undefined(raw_trigger.get("kind").is_none()));
    };
    let (mut table, mut fields, mut schedule, mut date) = (None, Vec::new(), Value::Null, Value::Null);
    if kind == "schedule" {
        schedule = checked_schedule(raw_trigger.get("schedule").unwrap_or(&Value::Null))?;
    } else if kind != "webhook" {
        let t = table_by_name(&tables, raw_trigger.get("table"), "trigger.table")?;
        if kind == "record_updated" {
            for f in arr(raw_trigger.get("fields").unwrap_or(&Value::Null)) {
                if let Some(s) = f.as_str() {
                    if !fields.iter().any(|x: &String| x == s) {
                        fields.push(s.to_string());
                    }
                }
            }
        }
        for f in &fields {
            if !t.fields.contains_key(f) {
                return Err(invd("trigger.fields", "champ_inconnu", f.as_str()));
            }
        }
        if kind == "date_reached" {
            let d = raw_trigger.get("date").filter(|v| !v.is_null()).cloned().unwrap_or(json!({}));
            let field = d.get("field").and_then(Value::as_str).unwrap_or("").to_string();
            if !t.kind(&field).is_some_and(|k| DATE_KINDS.contains(&k)) {
                return Err(invd("trigger.date.field", "champ_date_attendu", field.as_str()));
            }
            let offset = d.get("offset_days").filter(|v| !v.is_null()).cloned().unwrap_or(json!(0));
            if !integer_of(&offset).is_some_and(|n| n.abs() <= MAX_WAIT_DAYS) {
                return Err(invd("trigger.date.offset_days", "decalage_invalide", 365));
            }
            let (at, timezone) = checked_time_of_day(&d, "trigger.date")?;
            date = json!({ "field": field, "offsetDays": offset, "at": at, "timezone": timezone });
        }
        table = Some(t.id.clone());
    }
    let source = table.as_ref().and_then(|id| tables.iter().find(|t| &t.id == id).cloned());
    let raw_condition = match input.get("condition") {
        None => current.and_then(|c| c.condition.clone()).map(Value::String).unwrap_or(Value::Null),
        Some(v) => v.clone(),
    };
    let condition = raw_condition.as_str().map(js_trim).filter(|s| !s.is_empty()).map(str::to_string);
    if condition.is_some() && table.is_none() {
        return Err(inv("condition", "condition_sans_ligne"));
    }
    if condition.is_none() && kind == "record_matches" {
        return Err(inv("condition", "condition_requise"));
    }
    if let Some(c) = &condition {
        if js_len(c) > 4000 {
            return Err(inv("condition", "texte_trop_long"));
        }
        check_citations(c, &Scope { trigger: source.clone(), steps: HashMap::new(), deleted: false, payload: false }, "condition")?;
    }
    let raw_steps = match input.get("actions").filter(|v| !v.is_null()) {
        Some(a) => a.clone(),
        None => current.map(|c| Value::Array(wire_steps(&c.actions))).unwrap_or(Value::Null),
    };
    if !raw_steps.as_array().is_some_and(|a| !a.is_empty()) {
        return Err(inv("actions", "aucune_action"));
    }
    let mut taken = HashSet::new();
    ids_of(&raw_steps, &mut taken);
    let kept: HashMap<String, Vec<Value>> = current
        .map(|c| steps_of(&c.actions).into_iter().filter(|s| kind_of(s) == "webhook").map(|s| (id_of(s).to_string(), arr(&s["headers"]).to_vec())).collect())
        .unwrap_or_default();
    let mut walk = Walk {
        tx: tx.clone(),
        ctx,
        base_id: base_id.to_string(),
        tables,
        targets,
        taken,
        seen: HashSet::new(),
        writing: input.get("actions").is_some_and(|v| !v.is_null()),
        sealing,
        kept,
        self_id: current.map(|c| c.id.clone()),
        documents: HashSet::new(),
        count: 0,
        env,
    };
    let scope = Scope { trigger: source, steps: HashMap::new(), deleted: kind == "record_deleted", payload: kind == "webhook" };
    let actions = checked_steps(&mut walk, &raw_steps, &scope, "actions", Place { depth: 0, in_loop: false, in_attempt: false }).await?;
    Ok(Definition { label, description, enabled, kind, table, fields, schedule, date, condition, actions })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scope() -> Scope {
        let t = TableInfo { id: "t".into(), name: "taches".into(), fields: [("titre".to_string(), "short_text".to_string())].into() };
        Scope { trigger: Some(t), steps: HashMap::new(), deleted: false, payload: false }
    }

    #[test]
    fn citations_name_steps_passed() {
        let s = scope();
        assert!(check_citations("{{titre}} {{trigger.titre}} {{_maintenant}}", &s, "x").is_ok());
        let e = check_citations("{{e9.titre}}", &s, "x").unwrap_err();
        assert_eq!(Value::Object(e.details), json!({ "field": "x", "reason": "etape_inconnue", "detail": "e9" }));
        let e = row_source(&json!("trigger"), &Scope { deleted: true, ..s.clone() }, "r", Some("action_sans_ligne"), true).unwrap_err();
        assert_eq!(e.details["reason"], json!("ligne_supprimee"));
    }

    #[test]
    fn bodies_are_checked_by_format() {
        let s = scope();
        assert!(checked_body(&json!(r#"{"a": "{{titre}}", "n": {{titre}}}"#), "json", &s, "b").is_ok());
        assert!(checked_body(&json!(r#"{"a": }"#), "json", &s, "b").is_err());
        assert!(checked_body(&json!("a=1&b"), "form", &s, "b").is_err());
        assert!(checked_body(&json!("a=1\nb={{titre}}"), "form", &s, "b").is_ok());
    }

    #[test]
    fn value_tests_keep_their_operand() {
        let s = scope();
        let t = checked_value_test(&json!({ "value": " {{titre}} ", "op": "gt", "operand": 3 }), &s, "w").unwrap();
        assert_eq!(t, json!({ "value": "{{titre}}", "op": "gt", "operand": "3" }));
        assert!(checked_value_test(&json!({ "value": "x", "op": "like" }), &s, "w").is_err());
    }
}
