//! A document template's definition — `documents/spec.ts`, chapter 21 §1: the page, the
//! language, a theme, a header and a footer, and blocks. Read strictly from what a caller sends
//! (refused at its first fault, naming it), leniently from what is stored (a default where it no
//! longer reads); checked against the catalog when written (`normalize_spec`).

use super::images::{data_url_of, decode_image, Decoded, MAX_IMAGE_BYTES};
use crate::js::{is_js_space, js_length, js_slice, js_trim};
use basedb_base::db::Exec;
use basedb_base::error::AppError;
use serde_json::{json, Map, Value};
use std::collections::HashMap;

pub const MAX_BLOCKS: usize = 50;
pub const MAX_COLUMNS: usize = 12;
pub const MAX_HTML_CHARS: usize = 50_000;
pub const MAX_ROWS_LISTED: usize = 500;
pub const MAX_IMAGES: usize = 8;

/// A JavaScript number as JSON: an integral value without its `.0`.
pub fn num(v: f64) -> Value {
    if v.fract() == 0.0 && v.abs() < 9.0e15 {
        json!(v as i64)
    } else {
        json!(v)
    }
}

#[derive(Clone, Debug)]
pub struct Theme {
    pub accent: String,
    pub text: String,
    pub font: String,
    pub title_font: String,
    pub size: f64,
    pub margin: f64,
    pub titles: String,
    pub border: String,
}

impl Default for Theme {
    fn default() -> Self {
        Theme {
            accent: "#1d4ed8".into(),
            text: "#111827".into(),
            font: "sans".into(),
            title_font: "sans".into(),
            size: 10.0,
            margin: 20.0,
            titles: "plain".into(),
            border: "none".into(),
        }
    }
}

#[derive(Clone, Debug)]
pub enum ImageSource {
    /// A canonical `data:` address.
    Upload(String),
    Field(String),
}

impl ImageSource {
    fn to_json(&self) -> Value {
        match self {
            ImageSource::Upload(data) => json!({ "kind": "upload", "data": data }),
            ImageSource::Field(field) => json!({ "kind": "field", "field": field }),
        }
    }
}

#[derive(Clone, Debug)]
pub struct Header {
    pub show: String,
    pub logo: Option<ImageSource>,
    pub logo_width: f64,
    pub left: String,
    pub right: String,
    pub rule: bool,
}

impl Default for Header {
    fn default() -> Self {
        Header { show: "none".into(), logo: None, logo_width: 40.0, left: String::new(), right: String::new(), rule: false }
    }
}

#[derive(Clone, Debug)]
pub struct Footer {
    pub html: String,
    pub align: String,
    pub page_numbers: bool,
    pub rule: bool,
}

impl Default for Footer {
    fn default() -> Self {
        Footer { html: String::new(), align: "left".into(), page_numbers: true, rule: false }
    }
}

#[derive(Clone, Debug)]
pub enum RowsSource {
    Incoming { table: String, field: String },
    Outgoing { field: String },
}

#[derive(Clone, Debug)]
pub enum Block {
    Text { html: String, align: String, size: String, style: String },
    Fields { fields: Vec<String>, columns: i64, labels: String, hide_empty: bool },
    Rows {
        title: String,
        source: RowsSource,
        columns: Vec<String>,
        totals: Vec<String>,
        style: String,
        zebra: bool,
        headers: Vec<(String, String)>,
        widths: Vec<(String, f64)>,
        align: Vec<(String, String)>,
    },
    Image { source: ImageSource, width: f64, align: String },
    Title { text: String, subtitle: String, style: String, align: String, size: String },
    Divider { color: String, thickness: f64, width: f64 },
    Spacer { height: f64 },
    Columns { widths: Vec<f64>, columns: Vec<Vec<Block>> },
    Break,
}

impl Block {
    pub fn to_json(&self) -> Value {
        match self {
            Block::Text { html, align, size, style } => json!({ "kind": "text", "html": html, "align": align, "size": size, "style": style }),
            Block::Fields { fields, columns, labels, hide_empty } => {
                json!({ "kind": "fields", "fields": fields, "columns": columns, "labels": labels, "hide_empty": hide_empty })
            }
            Block::Rows { title, source, columns, totals, style, zebra, headers, widths, align } => {
                let source = match source {
                    RowsSource::Incoming { table, field } => json!({ "kind": "incoming", "table": table, "field": field }),
                    RowsSource::Outgoing { field } => json!({ "kind": "outgoing", "field": field }),
                };
                json!({
                    "kind": "rows",
                    "title": title,
                    "source": source,
                    "columns": columns,
                    "totals": totals,
                    "style": style,
                    "zebra": zebra,
                    "headers": headers.iter().map(|(k, v)| (k.clone(), json!(v))).collect::<Map<_, _>>(),
                    "widths": widths.iter().map(|(k, v)| (k.clone(), num(*v))).collect::<Map<_, _>>(),
                    "align": align.iter().map(|(k, v)| (k.clone(), json!(v))).collect::<Map<_, _>>(),
                })
            }
            Block::Image { source, width, align } => json!({ "kind": "image", "source": source.to_json(), "width": num(*width), "align": align }),
            Block::Title { text, subtitle, style, align, size } => {
                json!({ "kind": "title", "text": text, "subtitle": subtitle, "style": style, "align": align, "size": size })
            }
            Block::Divider { color, thickness, width } => json!({ "kind": "divider", "color": color, "thickness": num(*thickness), "width": num(*width) }),
            Block::Spacer { height } => json!({ "kind": "spacer", "height": num(*height) }),
            Block::Columns { widths, columns } => json!({
                "kind": "columns",
                "widths": widths.iter().map(|w| num(*w)).collect::<Vec<_>>(),
                "columns": columns.iter().map(|c| c.iter().map(Block::to_json).collect::<Vec<_>>()).collect::<Vec<_>>(),
            }),
            Block::Break => json!({ "kind": "break" }),
        }
    }
}

#[derive(Clone, Debug)]
pub struct Spec {
    pub size: String,
    pub orientation: String,
    pub valign: String,
    pub locale: String,
    pub theme: Theme,
    pub header: Header,
    pub footer: Footer,
    pub blocks: Vec<Block>,
}

impl Spec {
    /// `SHEET`: every field the reader reads.
    pub fn sheet() -> Spec {
        Spec {
            size: "A4".into(),
            orientation: "portrait".into(),
            valign: "top".into(),
            locale: "fr".into(),
            theme: Theme::default(),
            header: Header::default(),
            footer: Footer::default(),
            blocks: vec![Block::Fields { fields: vec![], columns: 1, labels: "beside".into(), hide_empty: false }],
        }
    }

    pub fn to_json(&self) -> Value {
        let t = &self.theme;
        let h = &self.header;
        let f = &self.footer;
        json!({
            "page": { "size": self.size, "orientation": self.orientation, "valign": self.valign },
            "locale": self.locale,
            "theme": {
                "accent": t.accent, "text": t.text, "font": t.font, "title_font": t.title_font,
                "size": num(t.size), "margin": num(t.margin), "titles": t.titles, "border": t.border,
            },
            "header": {
                "show": h.show, "logo": h.logo.as_ref().map(ImageSource::to_json), "logo_width": num(h.logo_width),
                "left": h.left, "right": h.right, "rule": h.rule,
            },
            "footer": { "html": f.html, "align": f.align, "page_numbers": f.page_numbers, "rule": f.rule },
            "blocks": self.blocks.iter().map(Block::to_json).collect::<Vec<_>>(),
        })
    }
}

fn refuse(field: &str, reason: &str, detail: Option<Value>) -> AppError {
    let e = AppError::new("REQUEST_INVALID").with("field", json!(field)).with("reason", json!(reason));
    match detail {
        Some(d) => e.with("detail", d),
        None => e,
    }
}

/// `value.replace(/\s+/g, ' ').trim()`.
pub fn fold_spaces(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut space = false;
    for c in text.chars() {
        if is_js_space(c) {
            space = true;
        } else {
            if space {
                out.push(' ');
            }
            space = false;
            out.push(c);
        }
    }
    if space {
        out.push(' ');
    }
    js_trim(&out).to_string()
}

const NULL: Value = Value::Null;

/// A property as JavaScript reads it on anything: `undefined` (here `Null`-less `None`) off an object.
fn prop<'a>(v: &'a Value, key: &str) -> Option<&'a Value> {
    v.as_object().and_then(|o| o.get(key))
}

fn absent(v: Option<&Value>) -> bool {
    matches!(v, None | Some(Value::Null))
}

struct Reader {
    strict: bool,
    images: usize,
}

type R<T> = Result<T, AppError>;

impl Reader {
    fn fail<T>(&self, field: &str, reason: &str, fallback: T, detail: Option<Value>) -> R<T> {
        if self.strict {
            Err(refuse(field, reason, detail))
        } else {
            Ok(fallback)
        }
    }

    fn one_of(&self, value: Option<&Value>, field: &str, allowed: &[&str], fallback: &str) -> R<String> {
        self.one_of_reason(value, field, allowed, fallback, "valeur_inconnue")
    }

    fn one_of_reason(&self, value: Option<&Value>, field: &str, allowed: &[&str], fallback: &str, reason: &str) -> R<String> {
        if absent(value) {
            return Ok(fallback.into());
        }
        match value.and_then(Value::as_str) {
            Some(s) if allowed.contains(&s) => Ok(s.into()),
            _ => self.fail(field, reason, fallback.into(), Some(json!(allowed))),
        }
    }

    fn number(&self, value: Option<&Value>, field: &str, min: f64, max: f64, fallback: f64, step: f64) -> R<f64> {
        if absent(value) {
            return Ok(fallback);
        }
        match value.and_then(Value::as_f64) {
            Some(v) if v.is_finite() && v >= min && v <= max => Ok((v / step + 0.5).floor() * step),
            _ => self.fail(field, "valeur_hors_bornes", fallback, Some(json!({ "min": num(min), "max": num(max) }))),
        }
    }

    fn bool(value: Option<&Value>, fallback: bool) -> bool {
        value.and_then(Value::as_bool).unwrap_or(fallback)
    }

    fn color(&self, value: Option<&Value>, field: &str, fallback: &str) -> R<String> {
        if absent(value) || value.and_then(Value::as_str) == Some("") {
            return Ok(fallback.into());
        }
        if let Some(s) = value.and_then(Value::as_str) {
            let hex = |b: &[u8]| b.iter().all(u8::is_ascii_hexdigit);
            let b = s.as_bytes();
            if b.len() == 4 && b[0] == b'#' && hex(&b[1..]) {
                let c: Vec<char> = s[1..].chars().collect();
                return Ok(format!("#{0}{0}{1}{1}{2}{2}", c[0], c[1], c[2]).to_lowercase());
            }
            if b.len() == 7 && b[0] == b'#' && hex(&b[1..]) {
                return Ok(s.to_lowercase());
            }
        }
        self.fail(field, "couleur_invalide", fallback.into(), None)
    }

    fn line(&self, value: Option<&Value>, field: &str, max: usize) -> R<String> {
        let text = value.and_then(Value::as_str).map(fold_spaces).unwrap_or_default();
        if js_length(&text) > max {
            let cut = js_slice(&text, max).to_string();
            return self.fail(field, "texte_trop_long", cut, Some(json!(max)));
        }
        Ok(text)
    }

    fn html(&self, value: Option<&Value>, field: &str, max: usize) -> R<String> {
        let html = value.and_then(Value::as_str).map(basedb_records::html::sanitize_rich_text).unwrap_or_default();
        if js_length(&html) > max {
            return self.fail(field, "texte_trop_long", String::new(), Some(json!(max)));
        }
        Ok(html)
    }

    fn names(&self, value: Option<&Value>, field: &str, max: usize) -> R<Vec<String>> {
        if absent(value) {
            return Ok(vec![]);
        }
        let Some(items) = value.and_then(Value::as_array) else {
            return self.fail(field, "liste_attendue", vec![], None);
        };
        let mut out: Vec<String> = Vec::new();
        for s in items.iter().filter_map(Value::as_str) {
            if !out.iter().any(|o| o == s) {
                out.push(s.to_string());
            }
        }
        if out.len() > max {
            let cut = out[..max].to_vec();
            return self.fail(field, "trop_de_colonnes", cut, Some(json!(max)));
        }
        Ok(out)
    }

    fn image(&mut self, value: Option<&Value>, field: &str) -> R<Option<ImageSource>> {
        if absent(value) {
            return Ok(None);
        }
        let raw = value.unwrap_or(&NULL);
        let kind = prop(raw, "kind");
        if kind.and_then(Value::as_str) == Some("field") {
            return match prop(raw, "field").and_then(Value::as_str) {
                Some(f) if !f.is_empty() => Ok(Some(ImageSource::Field(f.to_string()))),
                _ => self.fail(&format!("{field}.field"), "champ_image_attendu", None, None),
            };
        }
        if kind.and_then(Value::as_str) != Some("upload") {
            return self.fail(&format!("{field}.kind"), "source_inconnue", None, None);
        }
        match decode_image(prop(raw, "data")) {
            Decoded::TooLarge => self.fail(&format!("{field}.data"), "image_trop_lourde", None, Some(json!(MAX_IMAGE_BYTES))),
            Decoded::Invalid => self.fail(&format!("{field}.data"), "image_invalide", None, None),
            Decoded::Image(bytes, facts) => {
                self.images += 1;
                if self.images > MAX_IMAGES {
                    return self.fail(field, "trop_d_images", None, Some(json!(MAX_IMAGES)));
                }
                Ok(Some(ImageSource::Upload(data_url_of(&bytes, &facts))))
            }
        }
    }

    /// `record`: a map keyed by column, kept to the columns listed, in the object's order.
    fn record<T>(&mut self, value: Option<&Value>, columns: &[String], mut read: impl FnMut(&mut Self, &Value, &str) -> R<Option<T>>) -> R<Vec<(String, T)>> {
        let mut out: Vec<(String, T)> = Vec::new();
        let Some(object) = value.and_then(Value::as_object) else { return Ok(out) };
        for (key, v) in js_entries(object) {
            if !columns.iter().any(|c| c == key) {
                continue;
            }
            if let Some(read) = read(self, v, key)? {
                match out.iter_mut().find(|(k, _)| k == key) {
                    Some(slot) => slot.1 = read,
                    None => out.push((key.to_string(), read)),
                }
            }
        }
        Ok(out)
    }
}

/// `Object.entries`: the keys that are array indexes first, in ascending order.
fn js_entries(object: &Map<String, Value>) -> Vec<(&str, &Value)> {
    let index = |k: &str| -> Option<u32> {
        if k == "0" || (!k.starts_with('0') && !k.is_empty() && k.bytes().all(|b| b.is_ascii_digit())) {
            k.parse::<u32>().ok().filter(|n| *n < u32::MAX)
        } else {
            None
        }
    };
    let mut numeric: Vec<(u32, &str, &Value)> = object.iter().filter_map(|(k, v)| index(k).map(|n| (n, k.as_str(), v))).collect();
    numeric.sort_by_key(|(n, _, _)| *n);
    let mut out: Vec<(&str, &Value)> = numeric.into_iter().map(|(_, k, v)| (k, v)).collect();
    out.extend(object.iter().filter(|(k, _)| index(k).is_none()).map(|(k, v)| (k.as_str(), v)));
    out
}

const ALIGNS: [&str; 3] = ["left", "center", "right"];
const INNER: [&str; 6] = ["text", "fields", "image", "title", "divider", "spacer"];

fn read_theme(r: &Reader, value: Option<&Value>) -> R<Theme> {
    let raw = match value {
        Some(v @ (Value::Object(_) | Value::Array(_))) => v,
        _ => &NULL,
    };
    let d = Theme::default();
    let p = |k: &str| prop(raw, k);
    Ok(Theme {
        accent: r.color(p("accent"), "spec.theme.accent", &d.accent)?,
        text: r.color(p("text"), "spec.theme.text", &d.text)?,
        font: r.one_of(p("font"), "spec.theme.font", &["sans", "serif"], &d.font)?,
        title_font: r.one_of(p("title_font"), "spec.theme.title_font", &["sans", "serif"], &d.title_font)?,
        size: r.number(p("size"), "spec.theme.size", 8.0, 14.0, d.size, 0.5)?,
        margin: r.number(p("margin"), "spec.theme.margin", 8.0, 40.0, d.margin, 1.0)?,
        titles: r.one_of(p("titles"), "spec.theme.titles", &["plain", "accent", "rule"], &d.titles)?,
        border: r.one_of(p("border"), "spec.theme.border", &["none", "line", "double"], &d.border)?,
    })
}

fn read_header(r: &mut Reader, value: Option<&Value>) -> R<Header> {
    let raw = match value {
        Some(v @ (Value::Object(_) | Value::Array(_))) => v,
        _ => return Ok(Header::default()),
    };
    let d = Header::default();
    let p = |k: &str| prop(raw, k);
    Ok(Header {
        show: r.one_of(p("show"), "spec.header.show", &["none", "first", "every"], &d.show)?,
        logo: r.image(p("logo"), "spec.header.logo")?,
        logo_width: r.number(p("logo_width"), "spec.header.logo_width", 10.0, 120.0, d.logo_width, 1.0)?,
        left: r.html(p("left"), "spec.header.left", 5_000)?,
        right: r.html(p("right"), "spec.header.right", 5_000)?,
        rule: Reader::bool(p("rule"), d.rule),
    })
}

pub fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn read_footer(r: &Reader, value: Option<&Value>) -> R<Footer> {
    if let Some(Value::String(s)) = value {
        let line = r.line(Some(&Value::String(s.clone())), "spec.footer", 300)?;
        let html = if line.is_empty() { String::new() } else { format!("<p>{}</p>", escape_html(&line)) };
        return Ok(Footer { html, ..Footer::default() });
    }
    let raw = match value {
        Some(v @ (Value::Object(_) | Value::Array(_))) => v,
        _ => return Ok(Footer::default()),
    };
    let d = Footer::default();
    let p = |k: &str| prop(raw, k);
    Ok(Footer {
        html: r.html(p("html"), "spec.footer.html", 3_000)?,
        align: r.one_of(p("align"), "spec.footer.align", &["left", "center"], &d.align)?,
        page_numbers: Reader::bool(p("page_numbers"), d.page_numbers),
        rule: Reader::bool(p("rule"), d.rule),
    })
}

fn kind_detail(kind: Option<&Value>) -> Option<Value> {
    kind.cloned()
}

fn read_block(r: &mut Reader, value: &Value, at: &str, inner: bool) -> R<Block> {
    let b = value;
    let p = |k: &str| prop(b, k);
    let kind = p("kind").and_then(Value::as_str).unwrap_or("");
    let kind_known = p("kind").is_some_and(Value::is_string);
    if inner && !(kind_known && INNER.contains(&kind)) {
        return Err(refuse(&format!("{at}.kind"), "bloc_interdit_en_colonne", kind_detail(p("kind"))));
    }
    let field = |k: &str| format!("{at}.{k}");
    if !kind_known {
        return Err(refuse(&field("kind"), "bloc_inconnu", kind_detail(p("kind"))));
    }
    Ok(match kind {
        "text" => Block::Text {
            html: r.html(p("html"), &field("html"), MAX_HTML_CHARS)?,
            align: r.one_of(p("align"), &field("align"), &["left", "center", "right", "justify"], "left")?,
            size: r.one_of(p("size"), &field("size"), &["small", "normal", "large"], "normal")?,
            style: r.one_of(p("style"), &field("style"), &["plain", "tint", "border", "bar"], "plain")?,
        },
        "fields" => {
            let fields = r.names(p("fields"), &field("fields"), 200)?;
            let columns = match p("columns") {
                None | Some(Value::Null) => 1,
                Some(v) => match v.as_f64() {
                    Some(n) if n == 1.0 || n == 2.0 || n == 3.0 => n as i64,
                    _ => r.fail(&field("columns"), "valeur_inconnue", 1, Some(json!([1, 2, 3])))?,
                },
            };
            Block::Fields {
                fields,
                columns,
                labels: r.one_of(p("labels"), &field("labels"), &["beside", "above", "summary"], "beside")?,
                hide_empty: Reader::bool(p("hide_empty"), false),
            }
        }
        "rows" => {
            let source = p("source").unwrap_or(&NULL);
            let s = |k: &str| prop(source, k).and_then(Value::as_str).unwrap_or("").to_string();
            let checked = match prop(source, "kind").and_then(Value::as_str) {
                Some("incoming") => RowsSource::Incoming { table: s("table"), field: s("field") },
                Some("outgoing") => RowsSource::Outgoing { field: s("field") },
                _ => return Err(refuse(&field("source.kind"), "source_inconnue", None)),
            };
            let columns = r.names(p("columns"), &field("columns"), MAX_COLUMNS)?;
            if columns.is_empty() {
                return Err(refuse(&field("columns"), "aucune_colonne", None));
            }
            let title = r.line(p("title"), &field("title"), 200)?;
            let totals = r.names(p("totals"), &field("totals"), MAX_COLUMNS)?.into_iter().filter(|t| columns.contains(t)).collect();
            let style = r.one_of(p("style"), &field("style"), &["light", "accent", "lines"], "light")?;
            let zebra = Reader::bool(p("zebra"), false);
            let headers = r.record(p("headers"), &columns, |r, v, key| {
                let text = r.line(Some(v), &format!("{at}.headers.{key}"), 80)?;
                Ok(if text.is_empty() { None } else { Some(text) })
            })?;
            let widths = r.record(p("widths"), &columns, |r, v, key| {
                let w = r.number(Some(v), &format!("{at}.widths.{key}"), 3.0, 95.0, f64::NAN, 1.0)?;
                Ok(if w.is_nan() { None } else { Some(w) })
            })?;
            let align = r.record(p("align"), &columns, |r, v, key| {
                if v.is_null() {
                    return Ok(None);
                }
                Ok(Some(r.one_of(Some(v), &format!("{at}.align.{key}"), &ALIGNS, "left")?))
            })?;
            Block::Rows { title, source: checked, columns, totals, style, zebra, headers, widths, align }
        }
        "image" => {
            let Some(source) = r.image(p("source"), &field("source"))? else {
                return Err(refuse(&field("source"), "image_attendue", None));
            };
            Block::Image {
                source,
                width: r.number(p("width"), &field("width"), 5.0, 100.0, 40.0, 1.0)?,
                align: r.one_of(p("align"), &field("align"), &ALIGNS, "left")?,
            }
        }
        "title" => Block::Title {
            text: r.line(p("text"), &field("text"), 200)?,
            subtitle: r.line(p("subtitle"), &field("subtitle"), 300)?,
            style: r.one_of(p("style"), &field("style"), &["plain", "accent", "underline", "band", "bleed"], "accent")?,
            align: r.one_of(p("align"), &field("align"), &ALIGNS, "left")?,
            size: r.one_of(p("size"), &field("size"), &["medium", "large", "huge"], "large")?,
        },
        "divider" => Block::Divider {
            color: r.one_of(p("color"), &field("color"), &["accent", "light", "text"], "light")?,
            thickness: r.number(p("thickness"), &field("thickness"), 0.25, 6.0, 0.75, 0.25)?,
            width: r.number(p("width"), &field("width"), 5.0, 100.0, 100.0, 1.0)?,
        },
        "spacer" => Block::Spacer { height: r.number(p("height"), &field("height"), 1.0, 150.0, 8.0, 1.0)? },
        "columns" => {
            let list = match p("columns").and_then(Value::as_array) {
                Some(l) if (2..=3).contains(&l.len()) => l,
                _ => return Err(refuse(&field("columns"), "deux_ou_trois_colonnes", None)),
            };
            let mut columns = Vec::new();
            for (c, column) in list.iter().enumerate() {
                let Some(items) = column.as_array() else {
                    return Err(refuse(&format!("{at}.columns[{c}]"), "liste_attendue", None));
                };
                let mut blocks = Vec::new();
                for (j, inner) in items.iter().enumerate() {
                    let where_ = format!("{at}.columns[{c}][{j}]");
                    match read_block(r, inner, &where_, true) {
                        Ok(b) => blocks.push(b),
                        Err(e) if r.strict => return Err(e),
                        Err(_) => {}
                    }
                }
                columns.push(blocks);
            }
            let given = p("widths").and_then(Value::as_array);
            let mut widths = Vec::new();
            for c in 0..columns.len() {
                let w = given.and_then(|g| g.get(c)).filter(|v| !v.is_null()).cloned().unwrap_or(json!(1));
                widths.push(r.number(Some(&w), &format!("{at}.widths[{c}]"), 1.0, 12.0, 1.0, 1.0)?);
            }
            Block::Columns { widths, columns }
        }
        "break" => Block::Break,
        _ => return Err(refuse(&field("kind"), "bloc_inconnu", kind_detail(p("kind")))),
    })
}

fn count_of(blocks: &[Block]) -> usize {
    blocks
        .iter()
        .map(|b| {
            1 + match b {
                Block::Columns { columns, .. } => columns.iter().map(|c| count_of(c)).sum(),
                _ => 0,
            }
        })
        .sum()
}

/// `parseSpec`.
pub fn parse_spec(input: Option<&Value>, strict: bool) -> R<Spec> {
    let raw = match input {
        Some(v @ (Value::Object(_) | Value::Array(_))) => v,
        _ => return Err(refuse("spec", "objet_attendu", None)),
    };
    let mut r = Reader { strict, images: 0 };
    let page = prop(raw, "page").filter(|v| !v.is_null()).unwrap_or(&NULL);
    let size = r.one_of_reason(prop(page, "size"), "spec.page.size", &["A4", "LETTER"], "A4", "format_inconnu")?;
    let orientation = r.one_of_reason(prop(page, "orientation"), "spec.page.orientation", &["portrait", "landscape"], "portrait", "orientation_inconnue")?;
    let locale = match prop(raw, "locale") {
        None | Some(Value::Null) => "fr".to_string(),
        Some(Value::String(l)) if basedb_contracts::is_locale(l) => l.clone(),
        Some(_) => r.fail("spec.locale", "langue_inconnue", "fr".to_string(), Some(json!(basedb_contracts::LOCALES)))?,
    };
    let theme = read_theme(&r, prop(raw, "theme"))?;
    let header = read_header(&mut r, prop(raw, "header"))?;
    let footer = read_footer(&r, prop(raw, "footer"))?;
    let list = prop(raw, "blocks").and_then(Value::as_array);
    if list.is_none_or(Vec::is_empty) && strict {
        return Err(refuse("spec.blocks", "aucun_bloc", None));
    }
    let list: &[Value] = list.map(Vec::as_slice).unwrap_or(&[]);
    if list.len() > MAX_BLOCKS && strict {
        return Err(refuse("spec.blocks", "trop_de_blocs", Some(json!(MAX_BLOCKS))));
    }
    let mut blocks = Vec::new();
    for (i, value) in list.iter().enumerate() {
        match read_block(&mut r, value, &format!("spec.blocks[{i}]"), false) {
            Ok(b) => blocks.push(b),
            Err(e) if strict => return Err(e),
            Err(_) => {}
        }
    }
    if count_of(&blocks) > MAX_BLOCKS && strict {
        return Err(refuse("spec.blocks", "trop_de_blocs", Some(json!(MAX_BLOCKS))));
    }
    let valign = r.one_of(prop(page, "valign"), "spec.page.valign", &["top", "center"], "top")?;
    Ok(Spec { size, orientation, valign, locale, theme, header, footer, blocks })
}

/// `readSpec`: a stored definition as it reads today — never refused.
pub fn read_spec(stored: &Value) -> Spec {
    parse_spec(Some(stored), false).unwrap_or_else(|_| Spec::sheet())
}

struct Fields {
    kinds: HashMap<String, String>,
    targets: HashMap<String, String>,
}

async fn fields_of<E: Exec + Sync>(exec: &E, table_id: &str) -> R<Fields> {
    let rows = exec
        .rows(
            "SELECT n.name, f.kind, lc.target_table_id::text AS target
               FROM _basedb.field f
               JOIN _basedb.physical_name n ON n.id = f.name_id
               LEFT JOIN _basedb.field_link_config lc ON lc.field_id = f.id
              WHERE f.table_id = $1::text::uuid AND f.is_live AND f.deleted_at IS NULL",
            &[&table_id],
        )
        .await?;
    let mut kinds = HashMap::new();
    let mut targets = HashMap::new();
    for row in rows {
        let name: String = row.get(0);
        if let Some(t) = row.get::<_, Option<String>>(2) {
            targets.insert(name.clone(), t);
        }
        kinds.insert(name, row.get(1));
    }
    Ok(Fields { kinds, targets })
}

/// `normalizeSpec`: what a caller sent, as the template stores it — or a refusal naming the
/// part that is wrong, the catalog of the day consulted.
pub async fn normalize_spec<E: Exec + Sync>(exec: &E, table_id: &str, input: Option<&Value>) -> R<Spec> {
    let spec = parse_spec(input, true)?;
    let own = fields_of(exec, table_id).await?;
    let base_id: String = exec
        .first("SELECT base_id::text FROM _basedb.table_def WHERE id = $1::text::uuid", &[&table_id])
        .await?
        .map(|r| r.get(0))
        .unwrap_or_default();
    let picture = |source: Option<&ImageSource>, at: &str| -> R<()> {
        if let Some(ImageSource::Field(f)) = source {
            if own.kinds.get(f).map(String::as_str) != Some("image") {
                return Err(refuse(&format!("{at}.field"), "champ_image_attendu", Some(json!(f))));
            }
        }
        Ok(())
    };
    picture(spec.header.logo.as_ref(), "spec.header.logo")?;
    let mut stack: Vec<(&Block, String)> = spec.blocks.iter().enumerate().map(|(i, b)| (b, format!("spec.blocks[{i}]"))).collect();
    stack.reverse();
    while let Some((block, at)) = stack.pop() {
        match block {
            Block::Fields { fields, .. } => {
                if let Some(unknown) = fields.iter().find(|f| !own.kinds.contains_key(*f)) {
                    return Err(refuse(&format!("{at}.fields"), "champ_inconnu", Some(json!(unknown))));
                }
            }
            Block::Image { source, .. } => picture(Some(source), &format!("{at}.source"))?,
            Block::Columns { columns, .. } => {
                let mut inner: Vec<(&Block, String)> = Vec::new();
                for (c, column) in columns.iter().enumerate() {
                    for (j, b) in column.iter().enumerate() {
                        inner.push((b, format!("{at}.columns[{c}][{j}]")));
                    }
                }
                inner.reverse();
                stack.extend(inner);
            }
            Block::Rows { source, columns, .. } => {
                let related = match source {
                    RowsSource::Incoming { table, field } => {
                        let found = exec
                            .first(
                                "SELECT id::text FROM _basedb.table_def
                                  WHERE id::text = $1 AND base_id = $2::text::uuid AND is_live AND deleted_at IS NULL",
                                &[table, &base_id],
                            )
                            .await?;
                        if found.is_none() {
                            return Err(refuse(&format!("{at}.source.table"), "table_inconnue", Some(json!(table))));
                        }
                        let related = fields_of(exec, table).await?;
                        let kind = related.kinds.get(field).map(String::as_str);
                        if !matches!(kind, Some("link" | "multi_link")) || related.targets.get(field).map(String::as_str) != Some(table_id) {
                            return Err(refuse(&format!("{at}.source.field"), "lien_vers_la_table_attendu", Some(json!(field))));
                        }
                        related
                    }
                    RowsSource::Outgoing { field } => {
                        let target = own.targets.get(field);
                        match (own.kinds.get(field).map(String::as_str), target) {
                            (Some("multi_link"), Some(target)) => fields_of(exec, target).await?,
                            _ => return Err(refuse(&format!("{at}.source.field"), "lien_multiple_attendu", Some(json!(field)))),
                        }
                    }
                };
                if let Some(unknown) = columns.iter().find(|c| !related.kinds.contains_key(*c)) {
                    return Err(refuse(&format!("{at}.columns"), "champ_inconnu", Some(json!(unknown))));
                }
            }
            _ => {}
        }
    }
    Ok(spec)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strict_and_lenient() {
        let e = parse_spec(Some(&json!({ "blocks": [] })), true).unwrap_err();
        assert_eq!(e.details.get("reason"), Some(&json!("aucun_bloc")));
        let e = parse_spec(Some(&json!({ "page": { "size": "A3" }, "blocks": [{ "kind": "break" }] })), true).unwrap_err();
        assert_eq!(e.details.get("detail"), Some(&json!(["A4", "LETTER"])));
        let spec = parse_spec(Some(&json!({ "theme": { "size": 10.3, "accent": "#ABC" }, "blocks": [{ "kind": "nope" }, { "kind": "divider", "thickness": 1.1 }] })), false).unwrap();
        assert_eq!(spec.theme.size, 10.5);
        assert_eq!(spec.theme.accent, "#aabbcc");
        assert_eq!(spec.blocks.len(), 1);
        assert_eq!(spec.blocks[0].to_json()["thickness"], json!(1));
        assert_eq!(fold_spaces("  a \n b  "), "a b");
        assert!(matches!(read_spec(&json!("x")).blocks[0], Block::Fields { .. }));
    }
}
