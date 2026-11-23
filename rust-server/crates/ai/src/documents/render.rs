//! A row as a document — `documents/render.ts`, chapter 21 §3. Everything is read with the
//! rights of whoever asks: the row through the one point of enforcement, its linked rows
//! likewise, its fields through their mask. A template only lays out what is read already.

use super::fonts::find_fonts;
use super::images::{field_image, node_base64};
use super::intl;
use super::layout::{layout_pdf, Laid, LaidDocument, LaidFooter, LaidHeader, TableColumn};
use super::spec::{escape_html, normalize_spec, Block, ImageSource, RowsSource, Spec, MAX_ROWS_LISTED};
use super::templates::read_template;
use crate::js::{is_js_space, js_number_string, js_slice, js_string, js_to_number, js_trim};
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::AppError;
use basedb_base::rbac::require::require_on_table;
use basedb_base::rbac::Action;
use basedb_base::tx::{with_transaction, ActorKind, RequestContext, TxOptions};
use basedb_base::AppState;
use basedb_catalog::projection::{project_base, FieldFormat, ProjectedField, ProjectedTable};
use basedb_records::html::rich_text_to_plain;
use basedb_records::{list_records, ListOptions};
use chrono::{DateTime, Datelike, NaiveDate, Timelike, Utc};
use indexmap::IndexMap;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

type Row = Map<String, Value>;

static VARIABLE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{\s*([a-z0-9_]+)\s*\}\}").unwrap());
static ID: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^[0-9a-f-]{36}$").unwrap());
static DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})").unwrap());

/// Yes and no, in each language a document may be written in.
fn yes_no(locale: &str) -> (&'static str, &'static str) {
    match locale {
        "fr" => ("oui", "non"),
        "en" => ("yes", "no"),
        "de" => ("ja", "nein"),
        "es" => ("sí", "no"),
        "it" => ("sì", "no"),
        "pt-BR" => ("sim", "não"),
        "nl" => ("ja", "nee"),
        "pl" => ("tak", "nie"),
        "cs" => ("ano", "ne"),
        "sv" | "da" => ("ja", "nej"),
        "nb" => ("ja", "nei"),
        "fi" => ("kyllä", "ei"),
        "ro" => ("da", "nu"),
        "hu" => ("igen", "nem"),
        "tr" => ("evet", "hayır"),
        "uk" => ("так", "ні"),
        "ja" => ("はい", "いいえ"),
        "zh-CN" => ("是", "否"),
        "ko" => ("예", "아니요"),
        _ => ("yes", "no"),
    }
}

/// The word the total row of a table opens with.
fn total_word(locale: &str) -> &'static str {
    match locale {
        "de" => "Summe",
        "it" => "Totale",
        "nl" => "Totaal",
        "pl" => "Suma",
        "cs" => "Celkem",
        "sv" => "Summa",
        "da" => "I alt",
        "nb" => "Totalt",
        "fi" => "Yhteensä",
        "hu" => "Összesen",
        "tr" => "Toplam",
        "uk" => "Разом",
        "ja" => "合計",
        "zh-CN" => "合计",
        "ko" => "합계",
        _ => "Total",
    }
}

/// The kind a value reads as: a computed field's result, or the field's own.
fn kind_of(field: &ProjectedField) -> &str {
    field.computed.as_ref().map(|c| c.result_kind.as_str()).unwrap_or(&field.kind)
}

fn numeric(field: &ProjectedField) -> bool {
    matches!(kind_of(field), "number" | "count" | "autonumber") && !field.computed.as_ref().is_some_and(|c| c.multiple)
}

/// `Number(value)`.
fn js_number_of(value: Option<&Value>) -> f64 {
    match value {
        None | Some(Value::Object(_)) => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => f64::from(u8::from(*b)),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => js_to_number(s),
        Some(v @ Value::Array(_)) => js_to_number(&js_string(Some(v))),
    }
}

fn pad2(text: String) -> String {
    if text.encode_utf16().count() < 2 {
        format!("0{text}")
    } else {
        text
    }
}

/// `toISOString`.
fn iso(at: &DateTime<Utc>) -> String {
    at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

struct Formatter<'a> {
    locale: String,
    timezone: String,
    yes: &'static str,
    no: &'static str,
    people: &'a HashMap<String, String>,
    tables: &'a [ProjectedTable],
}

impl Formatter<'_> {
    /// A lookup or a rollup reads as what it reaches: an amount stays an amount.
    fn format_of<'f>(&'f self, field: &'f ProjectedField) -> Option<&'f FieldFormat> {
        if field.format.is_some() {
            return field.format.as_ref();
        }
        let computed = field.computed.as_ref()?;
        let via = computed.via.as_ref()?;
        let target = computed.target.as_ref()?;
        self.tables.iter().find(|t| t.name == via.reached)?.fields.iter().find(|f| &f.name == target)?.format.as_ref()
    }

    fn number(&self, value: Option<&Value>, field: &ProjectedField) -> String {
        let n = match value {
            Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
            other => js_number_of(other),
        };
        if !n.is_finite() {
            return js_string(value);
        }
        let format = self.format_of(field);
        let l = self.locale.as_str();
        match format.map(|f| f.display.as_str()) {
            Some("currency") => {
                let code = format.and_then(|f| f.currency.as_deref()).unwrap_or("EUR");
                intl::currency(l, n, code).unwrap_or_else(|| js_number_string(n))
            }
            Some("percent") => intl::percent(l, n),
            Some("integer") => intl::decimal(l, n, 0),
            Some("duration") => {
                let s = (n + 0.5).floor();
                let h = (s / 3600.0).floor();
                let m = ((s % 3600.0) / 60.0).floor();
                let rest = s % 60.0;
                let tail = if rest == 0.0 { String::new() } else { format!(":{}", pad2(js_number_string(rest))) };
                format!("{}:{}{tail}", js_number_string(h), pad2(js_number_string(m)))
            }
            Some("rating") => {
                let max = format.and_then(|f| f.rating_max).unwrap_or(5);
                format!("{} / {max}", js_number_string((n + 0.5).floor()))
            }
            _ => intl::decimal(l, n, 10),
        }
    }

    fn one(&self, value: Option<&Value>, field: &ProjectedField, kind: &str) -> String {
        let v = match value {
            None | Some(Value::Null) => return String::new(),
            Some(Value::String(s)) if s.is_empty() => return String::new(),
            Some(v) => v,
        };
        let text = || js_string(Some(v));
        match kind {
            "number" | "count" | "autonumber" => self.number(Some(v), field),
            "boolean" => (if *v == Value::Bool(true) { self.yes } else { self.no }).to_string(),
            "date" => {
                let s = text();
                let Some(m) = DATE.captures(&s) else { return s };
                let (y, mo, d) = (m[1].parse::<i32>().unwrap_or(0), m[2].parse::<i64>().unwrap_or(0), m[3].parse::<i64>().unwrap_or(0));
                // `Date.UTC` carries an overflowing month or day into the next.
                let date = NaiveDate::from_ymd_opt(y + (mo - 1).div_euclid(12) as i32, ((mo - 1).rem_euclid(12) + 1) as u32, 1)
                    .and_then(|first| first.checked_add_signed(chrono::Duration::days(d - 1)));
                match date {
                    Some(date) => intl::long_date(&self.locale, date.year(), date.month(), date.day()),
                    None => s,
                }
            }
            "datetime" => {
                let s = text();
                let Ok(at) = DateTime::parse_from_rfc3339(&s) else { return s };
                let at = at.with_timezone(&Utc);
                match self.timezone.parse::<chrono_tz::Tz>().ok().or_else(|| chrono_tz::Tz::from_str_insensitive(&self.timezone).ok()) {
                    Some(tz) => {
                        let local = at.with_timezone(&tz);
                        intl::long_datetime(&self.locale, local.year(), local.month(), local.day(), local.hour(), local.minute())
                    }
                    None => iso(&at),
                }
            }
            "select" => match v {
                Value::String(s) => field.options.as_ref().and_then(|o| o.iter().find(|o| &o.value == s)).map(|o| o.label.clone()).unwrap_or_else(text),
                _ => text(),
            },
            "user" => self.people.get(&text()).cloned().unwrap_or_default(),
            "link" => match v {
                Value::Object(o) => js_string(o.get("display")),
                _ => text(),
            },
            "long_text" => {
                if field.unsafe_html {
                    rich_text_to_plain(&text())
                } else {
                    text()
                }
            }
            "file" | "image" => match v {
                Value::Object(o) => js_string(o.get("name")),
                Value::Array(_) => js_string(None),
                _ => text(),
            },
            _ => match v {
                Value::Object(_) | Value::Array(_) => serde_json::to_string(v).unwrap_or_default(),
                _ => text(),
            },
        }
    }

    fn format(&self, value: Option<&Value>, field: &ProjectedField) -> String {
        let kind = kind_of(field);
        if let Some(Value::Array(items)) = value {
            let each = match kind {
                "multi_select" => "select",
                "multi_link" => "link",
                k => k,
            };
            return items.iter().map(|v| self.one(Some(v), field, each)).filter(|t| !t.is_empty()).collect::<Vec<_>>().join(", ");
        }
        if kind == "multi_select" {
            return self.one(value, field, "select");
        }
        self.one(value, field, kind)
    }
}

/// A text's citations, each replaced by the value the reader reads — or by nothing.
fn resolve(text: &str, row: &Row, fields: &IndexMap<&str, &ProjectedField>, known: &HashSet<&str>, format: &Formatter, html: bool) -> String {
    VARIABLE
        .replace_all(text, |c: &regex::Captures| {
            let name = &c[1];
            match fields.get(name) {
                None if known.contains(name) => String::new(),
                None => c[0].to_string(),
                Some(field) => {
                    let value = format.format(row.get(name), field);
                    if html {
                        escape_html(&value)
                    } else {
                        value
                    }
                }
            }
        })
        .into_owned()
}

/// A file name every system takes: no separator, no reserved sign, no control character.
pub fn safe_name(text: &str) -> String {
    let mapped: String = text.chars().map(|c| if (c as u32) < 0x20 || "\\/:*?\"<>|".contains(c) { '-' } else { c }).collect();
    let mut folded = String::with_capacity(mapped.len());
    let mut space = false;
    for c in mapped.chars() {
        if is_js_space(c) {
            if !space {
                folded.push(' ');
            }
            space = true;
        } else {
            folded.push(c);
            space = false;
        }
    }
    js_slice(js_trim(&folded), 120).to_string()
}

pub struct RenderedDocument {
    pub bytes: Vec<u8>,
    pub filename: String,
    pub title: String,
}

/// What to print: a template of the table, its sheet (`template_id: None`), or — building
/// the table — a definition not saved yet (`draft`: its `label` and `spec` as sent).
pub struct DocumentRequest {
    pub table_id: String,
    pub record_id: String,
    pub template_id: Option<String>,
    pub draft: Option<(Option<Value>, Option<Value>)>,
}

pub struct Prepared {
    pub laid: LaidDocument,
    pub filename: String,
}

/// `renderDocument`: the PDF of one row. The automations' « document » step prints with it.
pub async fn render_document(st: &AppState, ctx: &RequestContext, request: &DocumentRequest) -> Result<RenderedDocument, AppError> {
    let prepared = prepare_document(st, ctx, request).await?;
    let bytes = layout_pdf(&prepared.laid, find_fonts(&prepared.laid.locale));
    Ok(RenderedDocument { bytes, filename: prepared.filename, title: prepared.laid.title })
}

struct Template {
    label: String,
    spec: Spec,
}

struct Listed<'a> {
    table: &'a ProjectedTable,
    rows: Vec<Row>,
    more: bool,
}

fn not_found(record: &str) -> AppError {
    AppError::new("RESOURCE_NOT_FOUND").with("record", json!(record))
}

/// `prepareDocument`: what the document says, read and written out — before a page is set.
pub async fn prepare_document(st: &AppState, ctx: &RequestContext, request: &DocumentRequest) -> Result<Prepared, AppError> {
    if !ID.is_match(&request.record_id) {
        return Err(not_found(&request.record_id));
    }
    let key = st.instance_key()?;
    let options = ListOptions {
        table_id: request.table_id.clone(),
        filter: Some(format!("_id eq \"{}\"", request.record_id.to_lowercase())),
        limit: Some(1.0),
        ..ListOptions::default()
    };
    let page = list_records(&st.pools, ctx, key, &options).await?;
    let Some(row) = page.rows.into_iter().next() else { return Err(not_found(&request.record_id)) };

    let conn = st.pools.get(PoolName::Catalog).await?;
    let table = conn
        .first(
            "SELECT t.base_id::text, b.tenant_id::text
               FROM _basedb.table_def t JOIN _basedb.base b ON b.id = t.base_id WHERE t.id = $1::text::uuid",
            &[&request.table_id],
        )
        .await?
        .map(|r| (r.get::<_, String>(0), r.get::<_, String>(1)));
    let reader = if ctx.actor.kind == ActorKind::User {
        conn.first("SELECT locale, timezone FROM _basedb.app_user WHERE id = $1::text::uuid", &[&ctx.actor.id])
            .await?
            .map(|r| (r.get::<_, Option<String>>(0), r.get::<_, String>(1)))
    } else {
        None
    };
    let base_id = table.as_ref().map(|t| t.0.clone());
    let names: Vec<(String, String)> = conn
        .rows(
            "SELECT f.table_id::text, n.name
               FROM _basedb.field f JOIN _basedb.physical_name n ON n.id = f.name_id
              WHERE f.is_live AND f.deleted_at IS NULL
                AND f.table_id IN (SELECT id FROM _basedb.table_def WHERE base_id = $1::text::uuid)",
            &[&base_id],
        )
        .await?
        .iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect();
    drop(conn);
    let Some((base_id, tenant_id)) = table else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(request.table_id)));
    };

    let template = if let Some((label, spec)) = &request.draft {
        let label = label.clone();
        let spec = spec.clone();
        Some(
            with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
                let ctx = ctx.clone();
                let table_id = request.table_id.clone();
                let label = label.clone();
                let spec = spec.clone();
                async move {
                    require_on_table(&tx, &ctx, Action::ManageSchema, &table_id).await?;
                    let label = match label.as_ref().and_then(Value::as_str).map(js_trim) {
                        Some(l) if !l.is_empty() => l.to_string(),
                        _ => "Aperçu".to_string(),
                    };
                    Ok(Template { label, spec: normalize_spec(&tx, &table_id, spec.as_ref()).await? })
                }
            })
            .await?,
        )
    } else if let Some(id) = &request.template_id {
        let found = with_transaction(&st.pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
            let ctx = ctx.clone();
            let table_id = request.table_id.clone();
            let id = id.clone();
            async move { read_template(&tx, &ctx, &table_id, &id).await }
        })
        .await?;
        Some(Template { label: found.label, spec: found.spec.unwrap_or_else(Spec::sheet) })
    } else {
        None
    };
    let (reader_locale, timezone) = match reader {
        Some((locale, timezone)) => (locale.unwrap_or_else(|| "fr".into()), timezone),
        None => ("fr".to_string(), "UTC".to_string()),
    };
    let spec = match &template {
        Some(t) => t.spec.clone(),
        None => Spec { locale: reader_locale, ..Spec::sheet() },
    };

    let base = project_base(&st.pools, ctx, &base_id).await?;
    let Some(own) = base.tables.iter().find(|t| t.id == request.table_id) else {
        return Err(AppError::internal("Cannot read properties of undefined (reading 'fields')"));
    };
    let by_table = |t: &'_ ProjectedTable| -> IndexMap<String, ProjectedField> {
        let mut out = IndexMap::new();
        for f in t.fields.iter().filter(|f| !f.system) {
            out.insert(f.name.clone(), f.clone());
        }
        out
    };
    let own_fields = by_table(own);
    let fields: IndexMap<&str, &ProjectedField> = own_fields.iter().map(|(k, v)| (k.as_str(), v)).collect();
    let known: HashSet<&str> = names.iter().filter(|(t, _)| *t == own.id).map(|(_, n)| n.as_str()).collect();

    // The rows each table block lists, read with the same rights.
    let mut listed: HashMap<usize, Listed> = HashMap::new();
    for (i, block) in spec.blocks.iter().enumerate() {
        if let Block::Rows { source, .. } = block {
            if let Some(found) = related_rows(st, ctx, key, &base.tables, own, &row, source).await? {
                listed.insert(i, found);
            }
        }
    }

    // The names of the people the row and its rows name.
    let mut ids: Vec<String> = Vec::new();
    let mut collect = |r: &Row, f: &mut dyn Iterator<Item = &ProjectedField>| {
        for field in f {
            if kind_of(field) != "user" {
                continue;
            }
            let values: Vec<&Value> = match r.get(&field.name) {
                Some(Value::Array(items)) => items.iter().collect(),
                Some(v) => vec![v],
                None => vec![],
            };
            for v in values {
                if let Value::String(id) = v {
                    if !ids.contains(id) {
                        ids.push(id.clone());
                    }
                }
            }
        }
    };
    collect(&row, &mut fields.values().copied());
    for l in listed.values() {
        let theirs = by_table(l.table);
        for r in &l.rows {
            collect(r, &mut theirs.values());
        }
    }
    let mut people = HashMap::new();
    if !ids.is_empty() {
        let conn = st.pools.get(PoolName::Catalog).await?;
        let rows = conn
            .rows(
                "SELECT id::text, coalesce(nullif(display_name, ''), email) AS name
                   FROM _basedb.app_user WHERE id = ANY($1::text[]::uuid[]) AND tenant_id = $2::text::uuid",
                &[&ids, &tenant_id],
            )
            .await?;
        for p in rows {
            people.insert(p.get::<_, String>(0), p.get::<_, String>(1));
        }
    }

    let (yes, no) = yes_no(&spec.locale);
    let format = Formatter { locale: spec.locale.clone(), timezone, yes, no, people: &people, tables: &base.tables };

    // What names the row: its display column, else its first text the reader reads.
    let named = match own.display_field.as_deref().and_then(|d| fields.get(d)) {
        Some(f) => Some(*f),
        None => fields.values().copied().find(|f| f.kind == "short_text"),
    };
    let id_text = js_string(row.get("_id"));
    let display = named.map(|f| format.format(row.get(&f.name), f)).filter(|d| !d.is_empty()).unwrap_or_else(|| js_slice(&id_text, 8).to_string());
    let label = template.as_ref().map(|t| t.label.clone()).unwrap_or_else(|| own.label.clone());
    let cite = |text: &str, html: bool| resolve(text, &row, &fields, &known, &format, html);

    // The pictures: those sent with the template, and those of the row's image fields.
    let mut sources: Vec<&ImageSource> = Vec::new();
    if spec.header.show != "none" {
        if let Some(logo) = &spec.header.logo {
            sources.push(logo);
        }
    }
    fn visit<'b>(block: &'b Block, out: &mut Vec<&'b ImageSource>) {
        match block {
            Block::Image { source, .. } => out.push(source),
            Block::Columns { columns, .. } => columns.iter().flatten().for_each(|b| visit(b, out)),
            _ => {}
        }
    }
    spec.blocks.iter().for_each(|b| visit(b, &mut sources));
    let mut pictures: HashMap<String, Option<Vec<u8>>> = HashMap::new();
    for source in sources {
        let ImageSource::Field(name) = source else { continue };
        if pictures.contains_key(name) {
            continue;
        }
        let picture = match fields.get(name.as_str()) {
            Some(f) if f.kind == "image" => field_image(st, &request.table_id, name, row.get(name)).await,
            _ => None,
        };
        pictures.insert(name.clone(), picture);
    }
    let picture = |source: Option<&ImageSource>| -> Option<Vec<u8>> {
        match source? {
            ImageSource::Field(name) => pictures.get(name).cloned().flatten(),
            ImageSource::Upload(data) => data.find(',').map(|comma| node_base64(&data[comma + 1..])),
        }
    };

    let lay = Lay { fields: &fields, format: &format, row: &row, listed: &listed, locale: &spec.locale, cite: &cite, picture: &picture };
    let mut blocks = Vec::new();
    if template.is_none() {
        blocks.push(Laid::Html { html: format!("<h1>{}</h1>", escape_html(&display)), align: None, size: None, style: None });
    }
    for (i, block) in spec.blocks.iter().enumerate() {
        if let Some(laid) = lay.block(block, Some(i)) {
            blocks.push(laid);
        }
    }

    let title = format!("{label} — {display}");
    let header = (spec.header.show != "none").then(|| LaidHeader {
        show: spec.header.show.clone(),
        logo: picture(spec.header.logo.as_ref()),
        logo_width: spec.header.logo_width,
        left: cite(&spec.header.left, true),
        right: cite(&spec.header.right, true),
        rule: spec.header.rule,
    });
    let footer = LaidFooter { html: cite(&spec.footer.html, true), align: spec.footer.align.clone(), page_numbers: spec.footer.page_numbers, rule: spec.footer.rule };
    let filename = format!("{}.pdf", safe_name(&title));
    Ok(Prepared {
        laid: LaidDocument {
            title,
            locale: spec.locale.clone(),
            size: spec.size.clone(),
            orientation: spec.orientation.clone(),
            valign: spec.valign.clone(),
            theme: spec.theme.clone(),
            header,
            footer,
            page_label: Box::new(|p, n| format!("{p} / {n}")),
            blocks,
        },
        filename,
    })
}

struct Lay<'a> {
    fields: &'a IndexMap<&'a str, &'a ProjectedField>,
    format: &'a Formatter<'a>,
    row: &'a Row,
    listed: &'a HashMap<usize, Listed<'a>>,
    locale: &'a str,
    cite: &'a dyn Fn(&str, bool) -> String,
    picture: &'a dyn Fn(Option<&ImageSource>) -> Option<Vec<u8>>,
}

impl Lay<'_> {
    fn block(&self, block: &Block, i: Option<usize>) -> Option<Laid> {
        let format = self.format;
        match block {
            Block::Text { html, align, size, style } => (!html.is_empty()).then(|| Laid::Html {
                html: (self.cite)(html, true),
                align: Some(align.clone()),
                size: Some(size.clone()),
                style: Some(style.clone()),
            }),
            Block::Fields { fields: names, columns, labels, hide_empty } => {
                let names: Vec<&str> = if names.is_empty() { self.fields.keys().copied().collect() } else { names.iter().map(String::as_str).collect() };
                let rows: Vec<(String, String)> = names
                    .into_iter()
                    .filter_map(|name| {
                        let field = self.fields.get(name)?;
                        if field.kind == "button" {
                            return None;
                        }
                        let value = format.format(self.row.get(name), field);
                        (!(*hide_empty && value.is_empty())).then(|| (field.label.clone(), value))
                    })
                    .collect();
                (!rows.is_empty()).then(|| Laid::Fields { rows, columns: Some((*columns).max(1) as usize), labels: Some(labels.clone()) })
            }
            Block::Rows { title, columns, totals, style, zebra, headers, widths, align, .. } => {
                let found = self.listed.get(&i?)?;
                let theirs: Vec<&ProjectedField> = found.table.fields.iter().filter(|f| !f.system).collect();
                let columns: Vec<&ProjectedField> = columns.iter().filter_map(|name| theirs.iter().copied().find(|f| &f.name == name)).collect();
                if columns.is_empty() {
                    return None;
                }
                let sums = (!totals.is_empty()).then(|| {
                    columns
                        .iter()
                        .map(|f| {
                            if !totals.contains(&f.name) || !numeric(f) {
                                return None;
                            }
                            let sum = found.rows.iter().fold(0.0, |a, r| {
                                let n = js_number_of(r.get(&f.name));
                                if n.is_finite() {
                                    a + n
                                } else {
                                    a
                                }
                            });
                            Some(format.number(Some(&json!(sum)), f))
                        })
                        .enumerate()
                        .map(|(c, t)| if c == 0 && t.is_none() { Some(total_word(self.locale).to_string()) } else { t })
                        .collect()
                });
                let lookup = |pairs: &[(String, String)], name: &str| pairs.iter().find(|(k, _)| k == name).map(|(_, v)| v.clone());
                Some(Laid::Table {
                    title: (self.cite)(title, false),
                    columns: columns
                        .iter()
                        .map(|f| TableColumn {
                            label: lookup(headers, &f.name).unwrap_or_else(|| f.label.clone()),
                            numeric: numeric(f),
                            align: lookup(align, &f.name),
                            width: widths.iter().find(|(k, _)| k == &f.name).map(|(_, w)| *w),
                        })
                        .collect(),
                    rows: found.rows.iter().map(|r| columns.iter().map(|f| format.format(r.get(&f.name), f)).collect()).collect(),
                    totals: sums,
                    more: found.more.then(|| format!("… {MAX_ROWS_LISTED}+")),
                    style: Some(style.clone()),
                    zebra: *zebra,
                })
            }
            Block::Image { source, width, align } => (self.picture)(Some(source)).map(|data| Laid::Image { data, width: *width, align: align.clone() }),
            Block::Title { text, subtitle, style, align, size } => {
                let text = (self.cite)(text, false);
                let subtitle = (self.cite)(subtitle, false);
                (!(text.is_empty() && subtitle.is_empty())).then(|| Laid::Title { text, subtitle, style: style.clone(), align: align.clone(), size: size.clone() })
            }
            Block::Divider { color, thickness, width } => Some(Laid::Divider { color: color.clone(), thickness: *thickness, width: Some(*width) }),
            Block::Spacer { height } => Some(Laid::Spacer { height: *height }),
            Block::Columns { widths, columns } => {
                let columns: Vec<Vec<Laid>> = columns.iter().map(|column| column.iter().filter_map(|inner| self.block(inner, None)).collect()).collect();
                (!columns.iter().all(Vec::is_empty)).then(|| Laid::Columns { widths: widths.clone(), columns })
            }
            Block::Break => Some(Laid::Break),
        }
    }
}

/// `relatedRows`: the rows a table block lists, read with the reader's rights — `None`:
/// not readable.
async fn related_rows<'a>(st: &AppState, ctx: &RequestContext, key: &str, tables: &'a [ProjectedTable], own: &ProjectedTable, row: &Row, source: &RowsSource) -> Result<Option<Listed<'a>>, AppError> {
    let id = js_string(row.get("_id"));
    let (table, filter) = match source {
        RowsSource::Incoming { table, field } => {
            let Some(table) = tables.iter().find(|t| &t.id == table) else { return Ok(None) };
            let Some(link) = table.fields.iter().find(|f| &f.name == field) else { return Ok(None) };
            let filter = if link.kind == "multi_link" { format!("{field} has_any [\"{id}\"]") } else { format!("{field} eq \"{id}\"") };
            (table, filter)
        }
        RowsSource::Outgoing { field } => {
            let target = own.fields.iter().find(|f| &f.name == field).and_then(|l| l.link.as_ref()).and_then(|l| l.target.as_ref()).map(|t| t.table.clone());
            let Some(table) = target.and_then(|name| tables.iter().find(|t| t.name == name)) else { return Ok(None) };
            let ids: Vec<String> = match row.get(field) {
                Some(Value::Array(items)) => items
                    .iter()
                    .filter_map(|v| match v {
                        Value::Object(o) => o.get("id"),
                        other => Some(other),
                    })
                    .filter_map(Value::as_str)
                    .filter(|id| ID.is_match(id))
                    .map(str::to_string)
                    .collect(),
                _ => vec![],
            };
            if ids.is_empty() {
                return Ok(Some(Listed { table, rows: vec![], more: false }));
            }
            (table, format!("_id in [{}]", ids.iter().map(|id| format!("\"{id}\"")).collect::<Vec<_>>().join(", ")))
        }
    };
    let options = ListOptions { table_id: table.id.clone(), filter: Some(filter), limit: Some(MAX_ROWS_LISTED as f64), ..ListOptions::default() };
    let page = list_records(&st.pools, ctx, key, &options).await?;
    Ok(Some(Listed { table, rows: page.rows, more: page.next_cursor.is_some() }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_names() {
        assert_eq!(safe_name("Devis — A/B: \"x\"\n  y"), "Devis — A-B- -x-- y");
        assert_eq!(safe_name(&"é".repeat(130)).chars().count(), 120);
    }

    #[test]
    fn numbers_as_node() {
        let people = HashMap::new();
        let tables: Vec<ProjectedTable> = vec![];
        let f = Formatter { locale: "fr".into(), timezone: "Europe/Paris".into(), yes: "oui", no: "non", people: &people, tables: &tables };
        let field = ProjectedField {
            name: "n".into(),
            label: "N".into(),
            description: None,
            kind: "number".into(),
            required: false,
            unique: false,
            read_only: false,
            system: false,
            unsafe_html: false,
            options: None,
            link: None,
            format: Some(FieldFormat { display: "duration".into(), currency: None, rating_max: None }),
            hidden_from_agents: false,
            ai: false,
            computed: None,
            button: None,
            default: None,
        };
        assert_eq!(f.format(Some(&json!(3725)), &field), "1:02:05");
        assert_eq!(f.format(Some(&json!(3600)), &field), "1:00");
        assert_eq!(f.format(Some(&json!("abc")), &field), "abc");
        assert_eq!(f.one(Some(&json!("2024-03-05T10:30:00.000Z")), &field, "datetime"), intl::long_datetime("fr", 2024, 3, 5, 11, 30));
        assert_eq!(f.one(Some(&json!("2024-13-01")), &field, "date"), intl::long_date("fr", 2025, 1, 1));
                assert_eq!(f.one(Some(&json!({"a": 1})), &field, "json"), "{\"a\":1}");
            }

    #[test]
    fn lays_out_a_readable_pdf() {
        let doc = |blocks: Vec<Laid>| LaidDocument {
            title: "Fiche — Lampe".into(),
            locale: "fr".into(),
            size: "A4".into(),
            orientation: "portrait".into(),
            valign: "top".into(),
            theme: super::super::spec::Theme::default(),
            header: Some(LaidHeader { show: "all".into(), logo: None, logo_width: 40.0, left: "<p>Atelier</p>".into(), right: String::new(), rule: true }),
            footer: LaidFooter { html: "<p>Pied</p>".into(), align: "left".into(), page_numbers: true, rule: false },
            page_label: Box::new(|p, n| format!("{p} / {n}")),
            blocks,
        };
        let blocks = vec![
            Laid::Html { html: "<h1>Lampe &amp; abat-jour</h1><p>Un <b>texte</b> riche.</p>".into(), align: None, size: None, style: None },
            Laid::Fields { rows: vec![("Prix".into(), "12,50 €".into()), ("Stock".into(), "3".into())], columns: Some(1), labels: Some("beside".into()) },
            Laid::Break,
            Laid::Table {
                title: "Lignes".into(),
                columns: vec![TableColumn { label: "Article".into(), numeric: false, align: None, width: None }, TableColumn { label: "Qté".into(), numeric: true, align: None, width: None }],
                rows: vec![vec!["Ampoule".into(), "2".into()]],
                totals: Some(vec![Some("Total".into()), Some("2".into())]),
                more: None,
                style: Some("lines".into()),
                zebra: true,
            },
        ];
        let bytes = layout_pdf(&doc(blocks), None);
        let pages = crate::pdf::pdf_pages(&bytes).expect("readable");
        assert_eq!(pages.len(), 2);
        let squeeze = |s: &str| s.chars().filter(|c| !c.is_whitespace()).collect::<String>();
        let first = squeeze(&pages[0]);
        for expected in ["Atelier", "Lampe&abat-jour", "Untexteriche.", "Prix", "12,50€", "Pied", "1/2"] {
            assert!(first.contains(expected), "{expected} missing from {first}");
        }
        assert!(squeeze(&pages[1]).contains("AmpouleQté") || squeeze(&pages[1]).contains("Ampoule"));
    }
}
