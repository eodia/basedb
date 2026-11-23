//! Taking a whole table out — or a whole view — as a file: `records/export.ts` and
//! `export-xlsx.ts`, behind `GET /api/v1/{tenant}/data/{base}/{table}/export`
//! (`apps/api/src/export-route.ts`).
//!
//! Every page is read by [`list_records`] itself (same mask, same row predicate, same links),
//! a page at a time; everything that can be refused is refused before the first byte; a
//! failure once the file has begun tears the connection down; the audit line is written when
//! the file ends, early or not.

use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::sync::{LazyLock, Mutex};

use axum::body::{Body, Bytes};
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use basedb_base::audit::{write_audit, AuditEntry};
use basedb_base::db::{Exec, PoolName, Pools};
use basedb_base::error::AppError;
use basedb_base::tx::{with_transaction, RequestContext, TxOptions};
use chrono::{DateTime, Datelike, SecondsFormat, Timelike, Utc};
use flate2::write::DeflateEncoder;
use flate2::{Compression, Crc};
use serde_json::{json, Map, Value};

use basedb_base::idempotency::js_stringify;

use crate::drain::js_string;
use crate::html::rich_text_to_plain;
use crate::js::{is_uuid_ci, js_space, js_trim, number_string};
use crate::list::{build_plan, build_select, list_records, ListOptions, ListResult, COUNT_CEILING, MAX_LIMIT};
use crate::pg::{refs, row_object, P};

/// `RECORD_EXPORT_FORMATS`.
pub const FORMATS: [&str; 3] = ["csv", "json", "xlsx"];
/// `RECORD_EXPORT_MAX_ROWS`.
pub const MAX_ROWS_DEFAULT: u64 = 1_000_000;
/// `EXPORT_MAX_MS`.
const EXPORT_MAX_MS: i64 = 30 * 60_000;
/// `EXPORTS_PER_ACTOR`.
pub const EXPORTS_PER_ACTOR: usize = 3;
/// `CELL_LIMIT`, in UTF-16 units.
const CELL_LIMIT: usize = 32_767;
/// `MAX_COLUMNS`, `MAX_ROWS` of a sheet.
const SHEET_COLUMNS: usize = 16_384;
const SHEET_ROWS: u64 = 1_048_576;

/// What the route hands the export.
pub struct ExportOptions {
    pub table_id: String,
    pub format: String,
    pub headers_label: bool,
    pub filter: Option<String>,
    pub sort: Option<String>,
    pub fields: Vec<String>,
}

/// The ceiling of the instance: `BASEDB_EXPORT_MAX_ROWS` when a positive integer.
pub fn ceiling_of(setting: Option<String>) -> u64 {
    let n = setting.map(|s| basedb_catalog::js::js_to_number(&s)).unwrap_or(f64::NAN);
    if n.is_finite() && n.fract() == 0.0 && n > 0.0 {
        n as u64
    } else {
        MAX_ROWS_DEFAULT
    }
}

// ── Exports under way, by actor ──────────────────────────────────────────────────────

static RUNNING: LazyLock<Mutex<HashMap<String, usize>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// One of the actor's slots; let go when dropped.
struct Slot(String);

impl Slot {
    fn take(holder: String) -> Result<Slot, AppError> {
        let mut running = RUNNING.lock().unwrap_or_else(|e| e.into_inner());
        let n = running.get(&holder).copied().unwrap_or(0);
        if n >= EXPORTS_PER_ACTOR {
            return Err(AppError::new("CONCURRENCY_LIMIT_EXCEEDED").with("exports", json!(EXPORTS_PER_ACTOR)));
        }
        running.insert(holder.clone(), n + 1);
        Ok(Slot(holder))
    }
}

impl Drop for Slot {
    fn drop(&mut self) {
        let mut running = RUNNING.lock().unwrap_or_else(|e| e.into_inner());
        let left = running.get(&self.0).copied().unwrap_or(1).saturating_sub(1);
        if left == 0 {
            running.remove(&self.0);
        } else {
            running.insert(self.0.clone(), left);
        }
    }
}

// ── Cells ────────────────────────────────────────────────────────────────────────────

/// `Cell`: text, a number, a yes/no, or nothing.
#[derive(Debug, Clone, PartialEq)]
pub enum Cell {
    Null,
    Text(String),
    Num(f64),
    Bool(bool),
}

impl Cell {
    /// `String(cell)`.
    fn text(&self) -> String {
        match self {
            Cell::Null => "null".into(),
            Cell::Text(s) => s.clone(),
            Cell::Num(f) => number_string(*f),
            Cell::Bool(b) => b.to_string(),
        }
    }
}

/// `ExportColumn`.
pub struct ExportColumn {
    pub name: String,
    pub label: String,
    pub kind: String,
    pub element_kind: Option<String>,
    pub rich: bool,
    pub numeric: bool,
    pub choices: Option<HashMap<String, String>>,
}

fn system_kind(name: &str) -> Option<&'static str> {
    match name {
        "_id" => Some("short_text"),
        "_created_at" | "_updated_at" => Some("datetime"),
        "_created_by" | "_updated_by" => Some("user"),
        _ => None,
    }
}

/// `linkText`.
fn link_text(value: &Value) -> String {
    let Some(link) = value.as_object() else {
        return if value.is_array() || value.is_null() { String::new() } else { js_string(value) };
    };
    if link.get("masked") == Some(&Value::Bool(true)) {
        return String::new();
    }
    if let Some(Value::String(display)) = link.get("display") {
        if !display.is_empty() {
            return display.clone();
        }
    }
    match link.get("id") {
        Some(Value::String(id)) => id.clone(),
        _ => String::new(),
    }
}

/// `fileText`.
fn file_text(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Object(o) => o.get("name").and_then(Value::as_str).unwrap_or("").to_string(),
        Value::Array(_) => String::new(),
        other => js_string(other),
    }
}

/// `figureText`: a `numeric` text without the zeros that only fill its scale.
fn figure_text(value: &Value) -> Cell {
    match value {
        Value::String(s) if s.contains('.') => {
            static TRAILING: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"(\.\d*?)0+$").unwrap());
            let s = TRAILING.replace(s, "$1");
            Cell::Text(s.strip_suffix('.').unwrap_or(&s).to_string())
        }
        Value::String(s) => Cell::Text(s.clone()),
        Value::Number(_) => Cell::Num(value.as_f64().unwrap_or(f64::NAN)),
        Value::Bool(b) => Cell::Bool(*b),
        Value::Null => Cell::Null,
        other => Cell::Text(js_string(other)),
    }
}

/// `instantText`: ISO 8601, UTC; what cannot be read as an instant is left as written.
fn instant_text(value: &Value) -> String {
    let text = js_string(value);
    match DateTime::parse_from_rfc3339(&text) {
        Ok(at) => at.with_timezone(&Utc).to_rfc3339_opts(SecondsFormat::Millis, true),
        Err(_) => text,
    }
}

/// `dayText`.
fn day_text(value: &Value) -> String {
    let text = js_string(value);
    let b = text.as_bytes();
    let day = b.len() >= 10 && b[..4].iter().all(u8::is_ascii_digit) && b[4] == b'-' && b[5..7].iter().all(u8::is_ascii_digit) && b[7] == b'-' && b[8..10].iter().all(u8::is_ascii_digit);
    if day {
        text[..10].to_string()
    } else {
        text
    }
}

/// `scalarCell`.
fn scalar_cell(value: &Value, kind: &str, column: &ExportColumn, people: &HashMap<String, String>) -> Cell {
    match kind {
        "select" | "multi_select" => {
            let key = js_string(value);
            Cell::Text(column.choices.as_ref().and_then(|c| c.get(&key)).cloned().unwrap_or(key))
        }
        "user" => {
            let key = js_string(value);
            Cell::Text(people.get(&key).cloned().unwrap_or(key))
        }
        "link" | "multi_link" => Cell::Text(link_text(value)),
        "file" | "image" => Cell::Text(file_text(value)),
        "long_text" => {
            let text = js_string(value);
            Cell::Text(if column.rich { rich_text_to_plain(&text) } else { text })
        }
        "date" => Cell::Text(day_text(value)),
        "datetime" => Cell::Text(instant_text(value)),
        "boolean" => Cell::Bool(value == &Value::Bool(true) || value == &Value::String("true".into())),
        "number" | "autonumber" | "count" => figure_text(value),
        _ => match value {
            Value::Number(_) => Cell::Num(value.as_f64().unwrap_or(f64::NAN)),
            Value::Bool(b) => Cell::Bool(*b),
            Value::Object(o) if o.contains_key("display") => Cell::Text(link_text(value)),
            Value::Object(o) => match o.get("name") {
                Some(Value::String(name)) => Cell::Text(name.clone()),
                _ => Cell::Text(js_stringify(value)),
            },
            Value::Array(_) => Cell::Text(js_stringify(value)),
            other => Cell::Text(js_string(other)),
        },
    }
}

/// `cellOf`: a list becomes its elements, written one after another.
pub fn cell_of(value: Option<&Value>, column: &ExportColumn, people: &HashMap<String, String>) -> Cell {
    match value {
        None | Some(Value::Null) => Cell::Null,
        Some(Value::Array(items)) => {
            let kind = column.element_kind.as_deref().unwrap_or(&column.kind);
            let parts: Vec<String> = items
                .iter()
                .map(|item| match scalar_cell(item, kind, column, people) {
                    Cell::Null => String::new(),
                    cell => cell.text(),
                })
                .filter(|p| !p.is_empty())
                .collect();
            if parts.is_empty() {
                Cell::Null
            } else {
                Cell::Text(parts.join(", "))
            }
        }
        Some(v) => scalar_cell(v, &column.kind, column, people),
    }
}

/// `neutralize`: a text a spreadsheet would run as a formula, made harmless.
pub fn neutralize(text: &str) -> String {
    let mut chars = text.chars();
    let first = chars.next();
    let second = chars.next();
    let formula = matches!(first, Some('=' | '@' | '\t' | '\r'))
        || (matches!(first, Some('+' | '-')) && second.is_some_and(|c| !(c.is_ascii_digit() || js_space(c) || c == '.' || c == ',')));
    if formula {
        format!("'{text}")
    } else {
        text.to_string()
    }
}

/// `csvField` (RFC 4180).
pub fn csv_field(cell: &Cell) -> String {
    let text = match cell {
        Cell::Null => return String::new(),
        Cell::Text(s) => neutralize(s),
        other => other.text(),
    };
    if text.contains(['"', ',', '\r', '\n']) {
        format!("\"{}\"", text.replace('"', "\"\""))
    } else {
        text
    }
}

// ── The workbook ─────────────────────────────────────────────────────────────────────

fn forbidden(c: char) -> bool {
    matches!(c, '\u{0}'..='\u{8}' | '\u{b}' | '\u{c}' | '\u{e}'..='\u{1f}' | '\u{fffe}' | '\u{ffff}')
}

/// `escapeXml`: cut at Excel's cell limit (UTF-16 units), the characters XML refuses removed.
fn escape_xml(value: &str) -> String {
    let mut units = 0;
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        units += c.len_utf16();
        if units > CELL_LIMIT {
            break;
        }
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            c if forbidden(c) => {}
            c => out.push(c),
        }
    }
    out
}

fn escape_attribute(value: &str) -> String {
    escape_xml(value).replace('"', "&quot;")
}

/// `columnLetters`.
pub fn column_letters(index: usize) -> String {
    let mut n = index as i64;
    let mut out = Vec::new();
    loop {
        out.push((b'A' + (n % 26) as u8) as char);
        n = n / 26 - 1;
        if n < 0 {
            break;
        }
    }
    out.iter().rev().collect()
}

/// `sheetNameOf`.
pub fn sheet_name_of(label: &str) -> String {
    let name: String = label.chars().map(|c| if matches!(c, '\\' | '/' | '?' | '*' | '[' | ']' | ':') { ' ' } else { c }).filter(|c| !forbidden(*c)).collect();
    let name = js_trim(name.trim_matches('\''));
    let cut: String = name.chars().take(31).collect();
    let cut = js_trim(&cut);
    if cut.is_empty() {
        "Export".into()
    } else {
        cut.to_string()
    }
}

/// `numberOf`: a figure Excel holds exactly (fifteen digits), or nothing.
pub fn number_of(text: &str) -> Option<f64> {
    static FIGURE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"^-?[0-9]+(\.[0-9]+)?$").unwrap());
    if !FIGURE.is_match(text) {
        return None;
    }
    let digits = text.strip_prefix('-').unwrap_or(text).replacen('.', "", 1);
    let trimmed = digits.trim_start_matches('0');
    let len = if trimmed.is_empty() { 1 } else { trimmed.len() };
    (len <= 15).then(|| text.parse::<f64>().unwrap_or(f64::NAN))
}

/// `cellXml`.
fn cell_xml(reference: &str, value: &Cell, style: u8) -> String {
    let s = if style == 0 { String::new() } else { format!(" s=\"{style}\"") };
    match value {
        Cell::Null => String::new(),
        Cell::Num(f) if f.is_finite() => format!("<c r=\"{reference}\"{s}><v>{}</v></c>", number_string(*f)),
        Cell::Num(_) => String::new(),
        Cell::Bool(b) => format!("<c r=\"{reference}\"{s} t=\"b\"><v>{}</v></c>", u8::from(*b)),
        Cell::Text(t) if t.is_empty() => String::new(),
        Cell::Text(t) => format!("<c r=\"{reference}\"{s} t=\"inlineStr\"><is><t xml:space=\"preserve\">{}</t></is></c>", escape_xml(t)),
    }
}

const MAIN: &str = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL: &str = "http://schemas.openxmlformats.org/package/2006/relationships";
const DECLARATION: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const OFFICE: &str = "application/vnd.openxmlformats-officedocument.spreadsheetml";

fn styles() -> String {
    [
        &format!("{DECLARATION}<styleSheet xmlns=\"{MAIN}\">"),
        "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font>",
        "<font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts>",
        "<fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill>",
        "<fill><patternFill patternType=\"gray125\"/></fill></fills>",
        "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>",
        "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>",
        "<cellXfs count=\"2\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>",
        "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/></cellXfs>",
        "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>",
    ]
    .concat()
}

/// The fixed parts of a one-sheet workbook, before the sheet.
fn fixed_parts(sheet_name: &str) -> Vec<(&'static str, String)> {
    vec![
        (
            "[Content_Types].xml",
            [
                &format!("{DECLARATION}<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"),
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>",
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>",
                &format!("<Override PartName=\"/xl/workbook.xml\" ContentType=\"{OFFICE}.sheet.main+xml\"/>"),
                &format!("<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"{OFFICE}.worksheet+xml\"/>"),
                &format!("<Override PartName=\"/xl/styles.xml\" ContentType=\"{OFFICE}.styles+xml\"/>"),
                "</Types>",
            ]
            .concat(),
        ),
        (
            "_rels/.rels",
            format!("{DECLARATION}<Relationships xmlns=\"{PACKAGE_REL}\"><Relationship Id=\"rId1\" Type=\"{REL}/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>"),
        ),
        (
            "xl/workbook.xml",
            format!(
                "{DECLARATION}<workbook xmlns=\"{MAIN}\" xmlns:r=\"{REL}\"><sheets><sheet name=\"{}\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>",
                escape_attribute(&sheet_name_of(sheet_name))
            ),
        ),
        (
            "xl/_rels/workbook.xml.rels",
            format!(
                "{DECLARATION}<Relationships xmlns=\"{PACKAGE_REL}\"><Relationship Id=\"rId1\" Type=\"{REL}/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"{REL}/styles\" Target=\"styles.xml\"/></Relationships>"
            ),
        ),
        ("xl/styles.xml", styles()),
    ]
}

/// The head of the sheet: its columns, frozen header row, and the header itself.
fn sheet_head(header: &[String]) -> String {
    let widths: String = header
        .iter()
        .enumerate()
        .map(|(i, title)| {
            let width = (title.chars().count() + 3).clamp(10, 40);
            format!("<col min=\"{0}\" max=\"{0}\" width=\"{width}\" customWidth=\"1\"/>", i + 1)
        })
        .collect();
    let titles: String = header.iter().enumerate().map(|(i, t)| cell_xml(&format!("{}1", column_letters(i)), &Cell::Text(t.clone()), 1)).collect();
    format!(
        "{DECLARATION}<worksheet xmlns=\"{MAIN}\"><sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"15\"/><cols>{widths}</cols><sheetData><row r=\"1\">{titles}</row>"
    )
}

/// A zip written as a stream, with data descriptors (`zipOf`).
pub struct Zip {
    time: u16,
    date: u16,
    offset: u64,
    entries: Vec<(Vec<u8>, u64, u32, u64, u64)>,
    current: Option<Part>,
}

struct Part {
    name: Vec<u8>,
    start: u64,
    crc: Crc,
    compressed: u64,
    deflater: DeflateEncoder<Vec<u8>>,
}

const ZIP_LIMIT: u64 = 0xffff_ffff;

impl Zip {
    pub fn new(at: DateTime<Utc>) -> Zip {
        let time = ((at.hour() << 11) | (at.minute() << 5) | (at.second() >> 1)) as u16;
        let date = (((at.year() - 1980).max(0) as u32) << 9 | (at.month() << 5) | at.day()) as u16;
        Zip { time, date, offset: 0, entries: Vec::new(), current: None }
    }

    /// Opens a part: its local header.
    pub fn begin(&mut self, name: &str) -> Vec<u8> {
        let name = name.as_bytes().to_vec();
        let mut out = Vec::with_capacity(30 + name.len());
        out.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        out.extend_from_slice(&20u16.to_le_bytes());
        out.extend_from_slice(&0x0808u16.to_le_bytes());
        out.extend_from_slice(&8u16.to_le_bytes());
        out.extend_from_slice(&self.time.to_le_bytes());
        out.extend_from_slice(&self.date.to_le_bytes());
        out.extend_from_slice(&[0; 12]);
        out.extend_from_slice(&(name.len() as u16).to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&name);
        self.current = Some(Part { name, start: self.offset, crc: Crc::new(), compressed: 0, deflater: DeflateEncoder::new(Vec::new(), Compression::new(3)) });
        self.offset += out.len() as u64;
        out
    }

    /// Feeds the open part; hands back what the deflater has produced so far.
    pub fn write(&mut self, data: &[u8]) -> std::io::Result<Vec<u8>> {
        let part = self.current.as_mut().ok_or_else(|| std::io::Error::other("no open part"))?;
        part.crc.update(data);
        part.deflater.write_all(data)?;
        let out = std::mem::take(part.deflater.get_mut());
        part.compressed += out.len() as u64;
        self.offset += out.len() as u64;
        Ok(out)
    }

    /// Closes the open part: the rest of its deflated bytes, then its data descriptor.
    pub fn end(&mut self) -> std::io::Result<Vec<u8>> {
        let mut part = self.current.take().ok_or_else(|| std::io::Error::other("no open part"))?;
        let mut out = part.deflater.finish()?;
        part.compressed += out.len() as u64;
        self.offset += out.len() as u64;
        let size = u64::from(part.crc.amount());
        if size > ZIP_LIMIT || part.compressed > ZIP_LIMIT || self.offset > ZIP_LIMIT {
            return Err(std::io::Error::other("workbook larger than 4 GiB"));
        }
        let crc = part.crc.sum();
        out.extend_from_slice(&0x0807_4b50u32.to_le_bytes());
        out.extend_from_slice(&crc.to_le_bytes());
        out.extend_from_slice(&(part.compressed as u32).to_le_bytes());
        out.extend_from_slice(&(size as u32).to_le_bytes());
        self.offset += 16;
        self.entries.push((part.name, part.start, crc, part.compressed, size));
        Ok(out)
    }

    /// The central directory and its end record.
    pub fn finish(&mut self) -> Vec<u8> {
        let directory = self.offset;
        let mut out = Vec::new();
        for (name, start, crc, compressed, size) in &self.entries {
            out.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
            out.extend_from_slice(&20u16.to_le_bytes());
            out.extend_from_slice(&20u16.to_le_bytes());
            out.extend_from_slice(&0x0808u16.to_le_bytes());
            out.extend_from_slice(&8u16.to_le_bytes());
            out.extend_from_slice(&self.time.to_le_bytes());
            out.extend_from_slice(&self.date.to_le_bytes());
            out.extend_from_slice(&crc.to_le_bytes());
            out.extend_from_slice(&(*compressed as u32).to_le_bytes());
            out.extend_from_slice(&(*size as u32).to_le_bytes());
            out.extend_from_slice(&(name.len() as u16).to_le_bytes());
            out.extend_from_slice(&[0; 12]);
            out.extend_from_slice(&(*start as u32).to_le_bytes());
            out.extend_from_slice(name);
        }
        let length = out.len() as u32;
        out.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
        out.extend_from_slice(&[0; 4]);
        out.extend_from_slice(&(self.entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&(self.entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&length.to_le_bytes());
        out.extend_from_slice(&(directory as u32).to_le_bytes());
        out.extend_from_slice(&[0; 2]);
        out
    }
}

// ── The export ───────────────────────────────────────────────────────────────────────

fn content_type(format: &str) -> &'static str {
    match format {
        "csv" => "text/csv; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        _ => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
}

struct Meta {
    base_id: Option<String>,
    name: String,
    label: Option<String>,
}

/// Everything the producer carries once the export is open.
struct Running {
    pools: Pools,
    ctx: RequestContext,
    key: String,
    options: ExportOptions,
    columns: Vec<ExportColumn>,
    names: Vec<String>,
    asked: Vec<String>,
    header: Vec<String>,
    meta: Meta,
    max_rows: u64,
    delivered: u64,
    outcome: &'static str,
    people: HashMap<String, String>,
    user_columns: Vec<String>,
    _slot: Slot,
}

/// `exportRecords` and the route's answer: refused with an error before the first byte, or a
/// streaming response.
pub async fn export_response(pools: &Pools, ctx: &RequestContext, key: &str, options: ExportOptions, ceiling: u64) -> Result<Response, AppError> {
    if !FORMATS.contains(&options.format.as_str()) {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("format")));
    }
    let slot = Slot::take(ctx.actor_key())?;
    let xlsx = options.format == "xlsx";
    let max_rows = ceiling.min(if xlsx { SHEET_ROWS - 1 } else { u64::MAX }).max(1);

    let table_id = options.table_id.clone();
    let plan = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let table_id = table_id.clone();
        async move { build_plan(&tx, ctx, &table_id).await }
    })
    .await?;

    let mut asked: Vec<String> = Vec::new();
    for f in &options.fields {
        let f = js_trim(f);
        if !f.is_empty() && !asked.iter().any(|a| a == f) {
            asked.push(f.to_string());
        }
    }
    for name in &asked {
        if !plan.columns.contains(name) {
            return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(name)));
        }
    }
    let names = if asked.is_empty() { plan.columns.clone() } else { asked.clone() };
    if xlsx && names.len() > SHEET_COLUMNS {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("fields")).with("reason", json!("export_trop_large")));
    }

    let probe_options = ListOptions { table_id: options.table_id.clone(), filter: options.filter.clone(), sort: options.sort.clone(), ..Default::default() };
    let probe = build_select(&plan, &plan.columns, &probe_options, 1.0, key, &ctx.actor_key())?;
    let tail = format!("LIMIT {}) AS bounded;", COUNT_CEILING + 1);
    let Some(head) = probe.count_sql.strip_suffix(&tail) else {
        return Err(AppError::new("INTERNAL_ERROR").with("reason", json!("the count query changed shape")));
    };
    let bounded = format!("{head}LIMIT {}) AS bounded;", max_rows + 1);
    let counted = {
        let conn = pools.get(PoolName::Data).await?;
        let ps: Vec<P> = probe.count_params.iter().map(P::of).collect();
        conn.rows(&bounded, &refs(&ps)).await?.iter().map(row_object).collect::<Vec<_>>()
    };
    let n = counted.first().and_then(|r| r.get("n")).map(js_string).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    if n > max_rows {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("filter")).with("reason", json!("export_trop_gros")).with("maximum", json!(max_rows)));
    }

    let choice_fields: Vec<String> = names.iter().filter(|n| plan.filterable.get(*n).is_some_and(|c| c.kind == "select" || c.kind == "multi_select")).cloned().collect();
    let table_id = options.table_id.clone();
    let (table, labels, choices) = with_transaction(pools, PoolName::Catalog, ctx, TxOptions::read_only(), |tx| {
        let (table_id, choice_fields) = (table_id.clone(), choice_fields.clone());
        async move {
            let table = tx
                .first(
                    "SELECT t.base_id::text AS base_id, tn.name, t.label
                       FROM _basedb.table_def t
                       JOIN _basedb.physical_name tn ON tn.id = t.name_id
                      WHERE t.id = $1::text::uuid",
                    &[&table_id],
                )
                .await?
                .map(|r| Meta { base_id: r.get(0), name: r.get(1), label: r.get(2) });
            let labels: HashMap<String, String> = tx
                .rows(
                    "SELECT n.name, f.label
                       FROM _basedb.field f
                       JOIN _basedb.physical_name n ON n.id = f.name_id
                      WHERE f.table_id = $1::text::uuid AND f.is_live",
                    &[&table_id],
                )
                .await?
                .iter()
                .map(|r| (r.get(0), r.get(1)))
                .collect();
            let mut choices: HashMap<String, HashMap<String, String>> = HashMap::new();
            if !choice_fields.is_empty() {
                let wanted = P::of(&json!(choice_fields));
                let rows = tx
                    .rows(
                        "SELECT n.name AS field, o.value, o.label
                           FROM _basedb.select_option o
                           JOIN _basedb.field f ON f.id = o.field_id
                           JOIN _basedb.physical_name n ON n.id = f.name_id
                          WHERE f.table_id = $1::text::uuid AND f.is_live AND n.name = ANY($2::text[])
                          ORDER BY (o.deleted_at IS NULL), o.position",
                        &[&P::text(&table_id), &wanted],
                    )
                    .await?;
                for r in rows {
                    choices.entry(r.get(0)).or_default().insert(r.get(1), r.get(2));
                }
            }
            Ok((table, labels, choices))
        }
    })
    .await?;
    let Some(meta) = table else {
        return Err(AppError::new("RESOURCE_NOT_FOUND").with("table", json!(options.table_id)));
    };

    let rich: HashSet<&str> = plan.fields.iter().filter(|f| f.rich).map(|f| f.name.as_str()).collect();
    let mut choices = choices;
    let columns: Vec<ExportColumn> = names
        .iter()
        .map(|name| {
            let filterable = plan.filterable.get(name);
            let kind = filterable.map(|c| c.kind.clone()).or_else(|| system_kind(name).map(str::to_string)).unwrap_or_else(|| "short_text".into());
            ExportColumn {
                name: name.clone(),
                label: labels.get(name).cloned().unwrap_or_else(|| name.clone()),
                numeric: matches!(kind.as_str(), "number" | "autonumber" | "count"),
                kind,
                element_kind: filterable.and_then(|c| c.element_kind.clone()),
                rich: rich.contains(name.as_str()),
                choices: choices.remove(name),
            }
        })
        .collect();

    let first = list_records(pools, ctx, key, &page_options(&options, &asked, None)).await?;

    let header: Vec<String> = columns.iter().map(|c| if options.headers_label { c.label.clone() } else { c.name.clone() }).collect();
    let user_columns = columns.iter().filter(|c| c.element_kind.as_deref().unwrap_or(&c.kind) == "user").map(|c| c.name.clone()).collect();
    let day = ctx.timestamp.to_rfc3339_opts(SecondsFormat::Millis, true)[..10].to_string();
    let filename = format!("{}-{day}.{}", meta.name, options.format);
    let format = options.format.clone();

    let running = Running {
        pools: pools.clone(),
        ctx: ctx.clone(),
        key: key.to_string(),
        options,
        columns,
        names,
        asked,
        header,
        meta,
        max_rows,
        delivered: 0,
        outcome: "aborted",
        people: HashMap::new(),
        user_columns,
        _slot: slot,
    };

    let (sender, receiver) = tokio::sync::mpsc::channel::<Result<Bytes, std::io::Error>>(1);
    tokio::spawn(produce(running, first, sender));
    let stream = futures_util::stream::unfold(receiver, |mut rx| async move { rx.recv().await.map(|item| (item, rx)) });

    let mut res = Response::new(Body::from_stream(stream));
    *res.status_mut() = StatusCode::OK;
    let h = res.headers_mut();
    h.insert("content-type", HeaderValue::from_static(content_type(&format)));
    if let Ok(v) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
        h.insert("content-disposition", v);
    }
    h.insert("cache-control", HeaderValue::from_static("private, no-store"));
    h.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    h.insert("x-accel-buffering", HeaderValue::from_static("no"));
    Ok(res)
}

fn page_options(options: &ExportOptions, asked: &[String], after: Option<String>) -> ListOptions {
    ListOptions {
        table_id: options.table_id.clone(),
        limit: Some(MAX_LIMIT),
        filter: options.filter.clone(),
        sort: options.sort.clone(),
        select: if asked.is_empty() { None } else { Some(asked.to_vec()) },
        after,
        ..Default::default()
    }
}

/// Why the producer stopped early: the reader went away, or the export failed.
enum Stop {
    Gone,
    Failed(String),
}

impl From<AppError> for Stop {
    fn from(e: AppError) -> Stop {
        Stop::Failed(e.code.to_string())
    }
}

impl From<std::io::Error> for Stop {
    fn from(e: std::io::Error) -> Stop {
        Stop::Failed(e.to_string())
    }
}

type Sender = tokio::sync::mpsc::Sender<Result<Bytes, std::io::Error>>;

async fn send(sender: &Sender, bytes: Vec<u8>) -> Result<(), Stop> {
    if bytes.is_empty() {
        return Ok(());
    }
    sender.send(Ok(Bytes::from(bytes))).await.map_err(|_| Stop::Gone)
}

impl Running {
    /// `learn`: the names of the people a page cites, for those not yet known.
    async fn learn(&mut self, rows: &[Map<String, Value>]) -> Result<(), AppError> {
        let mut wanted: Vec<String> = Vec::new();
        for row in rows {
            for name in &self.user_columns {
                let value = row.get(name);
                let ones: Vec<&Value> = match value {
                    Some(Value::Array(items)) => items.iter().collect(),
                    Some(v) => vec![v],
                    None => vec![],
                };
                for one in ones {
                    if let Value::String(id) = one {
                        if is_uuid_ci(id) && !self.people.contains_key(id) && !wanted.contains(id) {
                            wanted.push(id.clone());
                        }
                    }
                }
            }
        }
        if wanted.is_empty() {
            return Ok(());
        }
        let conn = self.pools.get(PoolName::Catalog).await?;
        let ids = P::of(&json!(wanted));
        for r in conn
            .rows(
                "SELECT id::text AS id, coalesce(nullif(display_name, ''), email) AS name
                   FROM _basedb.app_user
                  WHERE id = ANY($1::text::uuid[])",
                &[&ids],
            )
            .await?
        {
            self.people.insert(r.get(0), r.get(1));
        }
        for id in wanted {
            self.people.entry(id.clone()).or_insert(id);
        }
        Ok(())
    }

    /// The next page's rows, or `None` when the table is done (`pages()`): the page after is
    /// read only once these rows have been handed on.
    async fn next_page(&mut self, page: &mut Option<ListResult>, cursor: &mut Option<String>, started: DateTime<Utc>) -> Result<Option<Vec<Map<String, Value>>>, AppError> {
        loop {
            if page.is_none() {
                let Some(after) = cursor.take() else { return Ok(None) };
                if (Utc::now() - started).num_milliseconds() > EXPORT_MAX_MS {
                    return Err(AppError::new("DEADLINE_EXCEEDED").with("reason", json!("export")));
                }
                let options = page_options(&self.options, &self.asked, Some(after));
                *page = Some(list_records(&self.pools, &self.ctx, &self.key, &options).await?);
            }
            let Some(current) = page.take() else { return Ok(None) };
            let room = (self.max_rows - self.delivered) as usize;
            let mut rows = current.rows;
            rows.truncate(room);
            self.delivered += rows.len() as u64;
            self.learn(&rows).await?;
            match (current.next_cursor, current.has_next_page) {
                (Some(next), true) if self.delivered < self.max_rows => *cursor = Some(next),
                (Some(_), true) => self.outcome = "truncated",
                _ => self.outcome = "complete",
            }
            if !rows.is_empty() {
                return Ok(Some(rows));
            }
        }
    }

    async fn write(&mut self, first: ListResult, sender: &Sender) -> Result<(), Stop> {
        let started = Utc::now();
        let mut page = Some(first);
        let mut cursor: Option<String> = None;
        match self.options.format.as_str() {
            "csv" => {
                // The BOM: Excel on Windows reads a CSV without one as Windows-1252.
                send(sender, vec![0xef, 0xbb, 0xbf]).await?;
                let line = self.header.iter().map(|h| csv_field(&Cell::Text(h.clone()))).collect::<Vec<_>>().join(",");
                send(sender, format!("{line}\r\n").into_bytes()).await?;
                while let Some(rows) = self.next_page(&mut page, &mut cursor, started).await? {
                    let mut chunk = String::new();
                    for row in &rows {
                        let line = self.columns.iter().map(|c| csv_field(&cell_of(row.get(&c.name), c, &self.people))).collect::<Vec<_>>().join(",");
                        chunk.push_str(&line);
                        chunk.push_str("\r\n");
                    }
                    send(sender, chunk.into_bytes()).await?;
                }
            }
            "json" => {
                send(sender, b"[".to_vec()).await?;
                let mut empty = true;
                while let Some(rows) = self.next_page(&mut page, &mut cursor, started).await? {
                    let mut chunk = String::new();
                    for row in &rows {
                        let mut out = Map::new();
                        for c in &self.columns {
                            out.insert(c.name.clone(), row.get(&c.name).cloned().unwrap_or(Value::Null));
                        }
                        chunk.push_str(if empty { "\n" } else { ",\n" });
                        chunk.push_str(&js_stringify(&Value::Object(out)));
                        empty = false;
                    }
                    send(sender, chunk.into_bytes()).await?;
                }
                send(sender, if empty { b"]\n".to_vec() } else { b"\n]\n".to_vec() }).await?;
            }
            _ => {
                let mut zip = Zip::new(self.ctx.timestamp);
                let label = self.meta.label.clone().unwrap_or_else(|| self.meta.name.clone());
                for (name, data) in fixed_parts(&label) {
                    let mut out = zip.begin(name);
                    out.extend(zip.write(data.as_bytes())?);
                    out.extend(zip.end()?);
                    send(sender, out).await?;
                }
                let mut out = zip.begin("xl/worksheets/sheet1.xml");
                out.extend(zip.write(sheet_head(&self.header).as_bytes())?);
                send(sender, out).await?;
                let letters: Vec<String> = (0..self.columns.len()).map(column_letters).collect();
                let mut row_number: u64 = 1;
                while let Some(rows) = self.next_page(&mut page, &mut cursor, started).await? {
                    let mut chunk = String::new();
                    for row in &rows {
                        row_number += 1;
                        let mut xml = String::new();
                        for (i, c) in self.columns.iter().enumerate() {
                            let mut cell = cell_of(row.get(&c.name), c, &self.people);
                            if c.numeric {
                                if let Cell::Text(t) = &cell {
                                    if let Some(n) = number_of(t) {
                                        cell = Cell::Num(n);
                                    }
                                }
                            }
                            xml.push_str(&cell_xml(&format!("{}{row_number}", letters[i]), &cell, 0));
                        }
                        chunk.push_str(&format!("<row r=\"{row_number}\">{xml}</row>"));
                    }
                    let out = zip.write(chunk.as_bytes())?;
                    send(sender, out).await?;
                }
                let mut out = zip.write(b"</sheetData></worksheet>")?;
                out.extend(zip.end()?);
                out.extend(zip.finish());
                send(sender, out).await?;
            }
        }
        Ok(())
    }

    /// `close`: the audit line — the shape of the request, never a value.
    async fn close(&self) {
        let mut entry = AuditEntry::new("records.export", "table");
        entry.object_id = Some(self.options.table_id.clone());
        entry.object_name = Some(self.meta.name.clone());
        entry.base_id = self.meta.base_id.clone();
        entry.table_id = Some(self.options.table_id.clone());
        let columns: Vec<&String> = self.names.iter().take(200).collect();
        entry.payload.insert(
            "export".into(),
            json!({
                "format": self.options.format,
                "columns": columns,
                "filtered": !js_trim(self.options.filter.as_deref().unwrap_or("")).is_empty(),
                "sort": self.options.sort,
                "rows": self.delivered,
                "outcome": self.outcome,
            }),
        );
        let written = async {
            let conn = self.pools.get(PoolName::Catalog).await?;
            write_audit(&conn, &self.ctx, &entry).await
        };
        if let Err(e) = written.await {
            eprintln!("journal d’export : {}", e.code);
        }
    }
}

/// Pulls the table page after page into the response; the audit line is written before the
/// stream ends (or once the reader has gone).
async fn produce(mut running: Running, first: ListResult, sender: Sender) {
    match running.write(first, &sender).await {
        Ok(()) | Err(Stop::Gone) => {}
        Err(Stop::Failed(reason)) => {
            running.outcome = "failed";
            running.close().await;
            let _ = sender.send(Err(std::io::Error::other(reason))).await;
            return;
        }
    }
    running.close().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn column(kind: &str) -> ExportColumn {
        ExportColumn { name: "c".into(), label: "C".into(), kind: kind.into(), element_kind: None, rich: false, numeric: false, choices: None }
    }

    #[test]
    fn csv_cells_are_neutralized_and_quoted() {
        assert_eq!(neutralize("=1+1"), "'=1+1");
        assert_eq!(neutralize("-5"), "-5");
        assert_eq!(neutralize("- à faire"), "- à faire");
        assert_eq!(neutralize("+33 1"), "+33 1");
        assert_eq!(neutralize("-x"), "'-x");
        assert_eq!(neutralize("-"), "-");
        assert_eq!(csv_field(&Cell::Text("a,\"b\"".into())), "\"a,\"\"b\"\"\"");
        assert_eq!(csv_field(&Cell::Num(1.5)), "1.5");
        assert_eq!(csv_field(&Cell::Bool(false)), "false");
        assert_eq!(csv_field(&Cell::Null), "");
    }

    #[test]
    fn values_read_as_a_person_sees_them() {
        let people = HashMap::new();
        assert_eq!(cell_of(Some(&json!("1500.5000000000")), &column("number"), &people), Cell::Text("1500.5".into()));
        assert_eq!(cell_of(Some(&json!("12.000")), &column("number"), &people), Cell::Text("12".into()));
        assert_eq!(cell_of(Some(&json!("2026-01-15T23:30:00+00:00")), &column("datetime"), &people), Cell::Text("2026-01-15T23:30:00.000Z".into()));
        assert_eq!(cell_of(Some(&json!([{ "id": "x", "display": "" }, { "id": "y", "display": "Y" }, { "masked": true }])), &column("multi_link"), &people), Cell::Text("x, Y".into()));
        assert_eq!(cell_of(Some(&json!([])), &column("multi_select"), &people), Cell::Null);
        assert_eq!(cell_of(Some(&json!({ "a": 1 })), &column("formula"), &people), Cell::Text("{\"a\":1}".into()));
    }

    #[test]
    fn sheets_follow_excel_rules() {
        assert_eq!(column_letters(0), "A");
        assert_eq!(column_letters(25), "Z");
        assert_eq!(column_letters(26), "AA");
        assert_eq!(column_letters(701), "ZZ");
        assert_eq!(column_letters(702), "AAA");
        assert_eq!(sheet_name_of("'Ventes: 2026/T1'"), "Ventes  2026 T1");
        assert_eq!(sheet_name_of("''"), "Export");
        assert_eq!(sheet_name_of("  'x' "), "'x'");
        assert_eq!(number_of("0012.50"), Some(12.5));
        assert_eq!(number_of("1234567890123456"), None);
        assert_eq!(number_of("1e5"), None);
        assert_eq!(escape_xml("a<b>&\u{1}c"), "a&lt;b&gt;&amp;c");
    }

    #[test]
    fn a_workbook_is_a_readable_zip() {
        let mut zip = Zip::new(Utc::now());
        let mut bytes = zip.begin("a.xml");
        bytes.extend(zip.write(b"<x>bonjour</x>").unwrap());
        bytes.extend(zip.end().unwrap());
        bytes.extend(zip.finish());
        assert_eq!(&bytes[..4], &[0x50, 0x4b, 0x03, 0x04]);
        let end = bytes.len() - 22;
        assert_eq!(&bytes[end..end + 4], &[0x50, 0x4b, 0x05, 0x06]);
        let data = &bytes[30 + 5..];
        let mut inflated = String::new();
        std::io::Read::read_to_string(&mut flate2::read::DeflateDecoder::new(data), &mut inflated).unwrap();
        assert_eq!(inflated, "<x>bonjour</x>");
    }

    #[test]
    fn the_ceiling_reads_the_setting() {
        assert_eq!(ceiling_of(None), MAX_ROWS_DEFAULT);
        assert_eq!(ceiling_of(Some("5".into())), 5);
        assert_eq!(ceiling_of(Some("2.5".into())), MAX_ROWS_DEFAULT);
        assert_eq!(ceiling_of(Some("-1".into())), MAX_ROWS_DEFAULT);
    }
}
