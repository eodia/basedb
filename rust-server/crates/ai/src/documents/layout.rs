//! Setting a document on pages — `documents/layout.ts`, chapter 21 §4, line for line. What
//! comes in is already read, formatted and allowed; what goes out is the PDF's bytes. Every text
//! is cut into lines before anything is drawn, so that the height of anything is known before
//! it is placed.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::LazyLock;

use regex::Regex;

use super::fonts::{covers, load, win_ansi, win_ansi_covers, FontFace, FontRef, FontSet, FontStyles};
use super::html::{self, Node};
use super::spec::Theme;
use super::writer::{Pdf, TextOptions};
use crate::js::is_js_space;

#[derive(Clone, Debug)]
pub struct TableColumn {
    pub label: String,
    pub numeric: bool,
    pub align: Option<String>,
    pub width: Option<f64>,
}

#[derive(Clone, Debug)]
pub enum Laid {
    Html { html: String, align: Option<String>, size: Option<String>, style: Option<String> },
    Fields { rows: Vec<(String, String)>, columns: Option<usize>, labels: Option<String> },
    Table {
        title: String,
        columns: Vec<TableColumn>,
        rows: Vec<Vec<String>>,
        totals: Option<Vec<Option<String>>>,
        more: Option<String>,
        style: Option<String>,
        zebra: bool,
    },
    Break,
    Image { data: Vec<u8>, width: f64, align: String },
    Title { text: String, subtitle: String, style: String, align: String, size: String },
    Divider { color: String, thickness: f64, width: Option<f64> },
    Spacer { height: f64 },
    Columns { widths: Vec<f64>, columns: Vec<Vec<Laid>> },
}

pub struct LaidHeader {
    pub show: String,
    pub logo: Option<Vec<u8>>,
    pub logo_width: f64,
    pub left: String,
    pub right: String,
    pub rule: bool,
}

pub struct LaidFooter {
    pub html: String,
    pub align: String,
    pub page_numbers: bool,
    pub rule: bool,
}

pub struct LaidDocument {
    pub title: String,
    pub locale: String,
    pub size: String,
    pub orientation: String,
    pub valign: String,
    pub theme: Theme,
    pub header: Option<LaidHeader>,
    pub footer: LaidFooter,
    pub page_label: Box<dyn Fn(usize, usize) -> String>,
    pub blocks: Vec<Laid>,
}

const MM: f64 = 72.0 / 25.4;
const RULE: &str = "#e5e7eb";
const HEAD_FILL: &str = "#f3f4f6";
const ZEBRA: &str = "#f9fafb";
const INK: &str = "#111827";
const WHITE: &str = "#ffffff";
const DEFAULT_TEXT: &str = "#111827";

// ── Colours ──────────────────────────────────────────────────────────────────

fn rgb(hex: &str) -> [f64; 3] {
    let n = u32::from_str_radix(hex.get(1..).unwrap_or(""), 16).unwrap_or(0);
    [((n >> 16) & 255) as f64, ((n >> 8) & 255) as f64, (n & 255) as f64]
}

fn hex_of(c: [f64; 3]) -> String {
    let p = |v: f64| (v.clamp(0.0, 255.0) + 0.5).floor() as u8;
    format!("#{:02x}{:02x}{:02x}", p(c[0]), p(c[1]), p(c[2]))
}

pub fn mix(a: &str, b: &str, t: f64) -> String {
    let x = rgb(a);
    let y = rgb(b);
    hex_of([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

fn luminance(hex: &str) -> f64 {
    let c = rgb(hex).map(|v| {
        let c = v / 255.0;
        if c <= 0.03928 {
            c / 12.92
        } else {
            ((c + 0.055) / 1.055).powf(2.4)
        }
    });
    0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

pub fn on_color(hex: &str) -> String {
    let l = luminance(hex);
    if 1.05 / (l + 0.05) >= (l + 0.05) / (luminance(INK) + 0.05) {
        WHITE.into()
    } else {
        INK.into()
    }
}

#[derive(Clone)]
struct Palette {
    text: String,
    muted: String,
    accent: String,
    on_accent: String,
    on_accent_muted: String,
    tint: String,
    tint_strong: String,
}

fn palette_of(theme: &Theme) -> Palette {
    let on = on_color(&theme.accent);
    Palette {
        text: theme.text.clone(),
        muted: if theme.text == DEFAULT_TEXT { "#6b7280".into() } else { mix(&theme.text, WHITE, 0.42) },
        accent: theme.accent.clone(),
        on_accent_muted: mix(&on, &theme.accent, 0.3),
        on_accent: on,
        tint: mix(&theme.accent, WHITE, 0.93),
        tint_strong: mix(&theme.accent, WHITE, 0.86),
    }
}

// ── Faces ────────────────────────────────────────────────────────────────────

const SANS: [&str; 4] = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"];
const SERIF: [&str; 4] = ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"];

fn style_index(bold: bool, italic: bool) -> usize {
    match (bold, italic) {
        (true, true) => 3,
        (true, false) => 1,
        (false, true) => 2,
        (false, false) => 0,
    }
}

struct Faces {
    set: Option<FontSet>,
    registered: HashMap<String, FontFace>,
    cache: RefCell<HashMap<String, FontRef>>,
}

impl Faces {
    fn new(set: Option<FontSet>) -> Faces {
        let mut registered = HashMap::new();
        if let Some(set) = &set {
            let mut styles = |prefix: &str, s: &FontStyles| {
                registered.insert(format!("{prefix}r"), s.regular.clone());
                registered.insert(format!("{prefix}b"), s.bold.clone());
                registered.insert(format!("{prefix}i"), s.italic.clone());
                registered.insert(format!("{prefix}bi"), s.bold_italic.clone());
            };
            styles("", &set.latin);
            if let Some(serif) = &set.serif {
                styles("s", serif);
            }
            for (i, (regular, bold)) in set.fallbacks.iter().enumerate() {
                registered.insert(format!("f{i}"), regular.clone());
                registered.insert(format!("f{i}b"), bold.clone());
            }
        }
        Faces { set, registered, cache: RefCell::new(HashMap::new()) }
    }

    /// The face registered under a name; Helvetica for a file that cannot be read.
    fn font(&self, name: &str) -> FontRef {
        if let Some(f) = self.cache.borrow().get(name) {
            return f.clone();
        }
        let font = match self.registered.get(name) {
            Some(face) => load(face).map(FontRef::Embedded),
            None => FontRef::standard(name),
        }
        .or_else(|| FontRef::standard("Helvetica"))
        .expect("Helvetica");
        self.cache.borrow_mut().insert(name.to_string(), font.clone());
        font
    }

    fn primary(&self, family: &str, bold: bool, italic: bool) -> (String, Option<FontFace>) {
        let k = style_index(bold, italic);
        let serif = family == "serif";
        let styles = match &self.set {
            Some(set) if serif => set.serif.as_ref(),
            Some(set) => Some(&set.latin),
            None => None,
        };
        match styles {
            None => ((if serif { SERIF } else { SANS })[k].to_string(), None),
            Some(s) => {
                let faces = [&s.regular, &s.bold, &s.italic, &s.bold_italic];
                let prefix = if serif { "s" } else { "" };
                (format!("{prefix}{}", ["r", "b", "i", "bi"][k]), Some(faces[k].clone()))
            }
        }
    }

    fn fallback_for(&self, text: &str, bold: bool) -> String {
        let all = self.set.as_ref().map(|s| s.fallbacks.as_slice()).unwrap_or(&[]);
        let i = all.iter().position(|f| covers(&f.0, text)).unwrap_or(0);
        if bold {
            format!("f{i}b")
        } else {
            format!("f{i}")
        }
    }

    fn split(&self, text: &str, family: &str, bold: bool, italic: bool) -> Vec<(String, String)> {
        let (name, face) = self.primary(family, bold, italic);
        let Some(face) = face else {
            if win_ansi_covers(text) {
                return vec![(text.to_string(), name)];
            }
            if family == "serif" && self.set.is_some() {
                return self.split(text, "sans", bold, italic);
            }
            return vec![(win_ansi(text), name)];
        };
        let fallbacks = self.set.as_ref().map(|s| s.fallbacks.len()).unwrap_or(0);
        if fallbacks == 0 || covers(&face, text) {
            return vec![(text.to_string(), name)];
        }
        let mut out = vec![];
        let mut current = String::new();
        let mut current_font = String::new();
        for ch in text.chars() {
            let mut b = [0u8; 4];
            let s = ch.encode_utf8(&mut b);
            let font = if covers(&face, s) { name.clone() } else { self.fallback_for(s, bold) };
            if font != current_font && !current.is_empty() {
                out.push((std::mem::take(&mut current), current_font.clone()));
            }
            current_font = font;
            current.push(ch);
        }
        if !current.is_empty() {
            out.push((current, current_font));
        }
        out
    }
}

// ── Lines ────────────────────────────────────────────────────────────────────

#[derive(Clone, Default)]
struct Mark {
    bold: bool,
    italic: bool,
    underline: bool,
    strike: bool,
    link: Option<String>,
}

#[derive(Clone)]
struct Run {
    mark: Mark,
    text: String,
}

#[derive(Clone)]
struct TextStyle {
    size: f64,
    family: String,
    color: String,
    bold: bool,
    align: String,
    tracking: f64,
    line_gap: Option<f64>,
    link_color: Option<String>,
}

#[derive(Clone, Copy, PartialEq)]
enum Kind {
    Word,
    Space,
    Newline,
}

#[derive(Clone)]
struct Token {
    text: String,
    kind: Kind,
    font: String,
    size: f64,
    color: String,
    underline: bool,
    strike: bool,
    link: Option<String>,
    tracking: f64,
    width: f64,
}

type LineDraw = Rc<dyn Fn(&mut Pdf, f64, f64)>;

#[derive(Clone)]
struct Line {
    width: f64,
    height: f64,
    draw: LineDraw,
}

const JS_SPACE: &str = r"\t\x0B\x0C\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";
const CJK: &str = r"\x{2E80}-\x{303F}\x{3040}-\x{30FF}\x{3400}-\x{4DBF}\x{4E00}-\x{9FFF}\x{AC00}-\x{D7AF}\x{F900}-\x{FAFF}\x{FF00}-\x{FFEF}";

static TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(r"\n|[{JS_SPACE}]+|[{CJK}]|-*[^\n{JS_SPACE}{CJK}\-]+-?|-+")).expect("TOKEN")
});

#[derive(Clone, Copy)]
struct Metrics {
    height: f64,
    ascent: f64,
}

struct Typesetter {
    faces: Rc<Faces>,
    widths: RefCell<HashMap<(String, u64, u64, String), f64>>,
    metrics: RefCell<HashMap<(String, u64), Metrics>>,
}

struct Fragment {
    text: String,
    name: String,
    font: FontRef,
    size: f64,
    color: String,
    underline: bool,
    strike: bool,
    link: Option<String>,
    tracking: f64,
    width: f64,
    space: bool,
    dy: f64,
}

impl Typesetter {
    fn new(faces: Rc<Faces>) -> Typesetter {
        Typesetter { faces, widths: RefCell::new(HashMap::new()), metrics: RefCell::new(HashMap::new()) }
    }

    fn measure(&self, text: &str, font: &str, size: f64, tracking: f64) -> f64 {
        let key = (font.to_string(), size.to_bits(), tracking.to_bits(), text.to_string());
        if let Some(w) = self.widths.borrow().get(&key) {
            return *w;
        }
        let w = self.faces.font(font).width_of(text, size, tracking);
        self.widths.borrow_mut().insert(key, w);
        w
    }

    fn metrics_of(&self, font: &str, size: f64) -> Metrics {
        let key = (font.to_string(), size.to_bits());
        if let Some(m) = self.metrics.borrow().get(&key) {
            return *m;
        }
        let f = self.faces.font(font);
        let m = Metrics { height: f.line_height(size, true), ascent: f.ascender() / 1000.0 * size };
        self.metrics.borrow_mut().insert(key, m);
        m
    }

    fn width(&self, text: &str, style: &TextStyle, bold: bool) -> f64 {
        self.faces.split(text, &style.family, bold, false).iter().map(|(t, f)| self.measure(t, f, style.size, style.tracking)).sum()
    }

    fn plain(&self, text: &str, width: f64, style: &TextStyle) -> Vec<Line> {
        self.lines(&[Run { mark: Mark::default(), text: text.to_string() }], width, style)
    }

    fn lines(&self, runs: &[Run], width: f64, style: &TextStyle) -> Vec<Line> {
        let size = style.size;
        let tracking = style.tracking;
        let mut tokens: Vec<Token> = vec![];
        for run in runs {
            let bold = run.mark.bold || style.bold;
            for (text, font) in self.faces.split(&run.text, &style.family, bold, run.mark.italic) {
                for m in TOKEN.find_iter(&text) {
                    let t = m.as_str();
                    let kind = if t == "\n" {
                        Kind::Newline
                    } else if t.chars().all(is_js_space) {
                        Kind::Space
                    } else {
                        Kind::Word
                    };
                    let shown = if kind == Kind::Space { " ".to_string() } else { t.to_string() };
                    let width = if kind == Kind::Newline { 0.0 } else { self.measure(&shown, &font, size, tracking) };
                    tokens.push(Token {
                        text: shown,
                        kind,
                        font: font.clone(),
                        size,
                        color: if run.mark.link.is_some() { style.link_color.clone().unwrap_or_else(|| style.color.clone()) } else { style.color.clone() },
                        underline: run.mark.underline || run.mark.link.is_some(),
                        strike: run.mark.strike,
                        link: run.mark.link.clone(),
                        tracking,
                        width,
                    });
                }
            }
        }
        if !tokens.iter().any(|t| t.kind == Kind::Word) {
            return vec![];
        }

        let mut rows: Vec<(Vec<Token>, bool)> = vec![];
        let mut line: Vec<Token> = vec![];
        let mut used = 0.0;
        let close = |rows: &mut Vec<(Vec<Token>, bool)>, line: &mut Vec<Token>, used: &mut f64, last: bool| {
            while line.last().is_some_and(|t| t.kind == Kind::Space) {
                line.pop();
            }
            rows.push((std::mem::take(line), last));
            *used = 0.0;
        };
        for t in tokens {
            if t.kind == Kind::Newline {
                close(&mut rows, &mut line, &mut used, true);
                continue;
            }
            if t.kind == Kind::Space {
                if line.is_empty() {
                    continue;
                }
                used += t.width;
                line.push(t);
                continue;
            }
            if used + t.width > width && line.iter().any(|x| x.kind == Kind::Word) {
                close(&mut rows, &mut line, &mut used, false);
            }
            if t.width <= width {
                used += t.width;
                line.push(t);
                continue;
            }
            let mut chunk = String::new();
            for ch in t.text.chars() {
                let mut next = chunk.clone();
                next.push(ch);
                let w = self.measure(&next, &t.font, t.size, t.tracking);
                if used + w > width && !chunk.is_empty() {
                    let cw = self.measure(&chunk, &t.font, t.size, t.tracking);
                    line.push(Token { text: std::mem::take(&mut chunk), width: cw, ..t.clone() });
                    close(&mut rows, &mut line, &mut used, false);
                    chunk.push(ch);
                } else {
                    chunk = next;
                }
            }
            if !chunk.is_empty() {
                let w = self.measure(&chunk, &t.font, t.size, t.tracking);
                line.push(Token { text: chunk, width: w, ..t.clone() });
                used += w;
            }
        }
        if !line.is_empty() {
            close(&mut rows, &mut line, &mut used, true);
        }

        let base_font = self.faces.split("x", &style.family, style.bold, false).into_iter().next().map(|p| p.1).unwrap_or_else(|| "Helvetica".into());
        let base = self.metrics_of(&base_font, size);
        let gap = style.line_gap.unwrap_or(size * 0.25);
        let align = style.align.clone();
        rows.into_iter()
            .map(|(parts, last)| {
                let metrics: Vec<Metrics> = parts.iter().map(|p| self.metrics_of(&p.font, p.size)).collect();
                let ascent = metrics.iter().fold(base.ascent, |a, m| a.max(m.ascent));
                let height = metrics.iter().fold(base.height, |a, m| a.max(m.height)) + gap;
                let line_width: f64 = parts.iter().map(|p| p.width).sum();
                let spaces = parts.iter().filter(|p| p.kind == Kind::Space).count();
                let justify = align == "justify" && !last && spaces > 0;
                let mut merged: Vec<Token> = vec![];
                for p in parts {
                    if let Some(prev) = merged.last_mut() {
                        if !justify
                            && prev.font == p.font
                            && prev.color == p.color
                            && prev.underline == p.underline
                            && prev.strike == p.strike
                            && prev.link == p.link
                        {
                            prev.text.push_str(&p.text);
                            prev.width += p.width;
                            continue;
                        }
                    }
                    merged.push(p);
                }
                let fragments: Vec<Fragment> = merged
                    .into_iter()
                    .map(|f| {
                        let m = self.metrics_of(&f.font, f.size);
                        Fragment {
                            font: self.faces.font(&f.font),
                            name: f.font,
                            text: f.text,
                            size: f.size,
                            color: f.color,
                            underline: f.underline,
                            strike: f.strike,
                            link: f.link,
                            tracking: f.tracking,
                            width: f.width,
                            space: f.kind == Kind::Space,
                            dy: ascent - m.ascent,
                        }
                    })
                    .collect();
                let align = align.clone();
                let draw: LineDraw = Rc::new(move |pdf: &mut Pdf, x: f64, y: f64| {
                    let free = (width - line_width).max(0.0);
                    let mut cx = x + if align == "right" {
                        free
                    } else if align == "center" {
                        free / 2.0
                    } else {
                        0.0
                    };
                    let extra = if justify { free / spaces as f64 } else { 0.0 };
                    for f in &fragments {
                        if f.space && justify {
                            cx += f.width + extra;
                            continue;
                        }
                        let o = TextOptions { underline: f.underline, strike: f.strike, tracking: f.tracking, link: f.link.as_deref() };
                        pdf.text(&f.name, &f.font, f.size, &f.color, &f.text, cx, y + f.dy, &o);
                        cx += f.width;
                    }
                });
                Line { width: line_width, height, draw }
            })
            .collect()
    }
}

// ── Placing ──────────────────────────────────────────────────────────────────

#[derive(Clone, Copy)]
struct Landing {
    page: usize,
    top: bool,
}

type Draw = Rc<dyn Fn(&mut Pdf, f64, f64, Option<Landing>)>;

#[derive(Clone, Default)]
struct Item {
    height: f64,
    draw: Option<Draw>,
    gap: bool,
    space: bool,
    keep: bool,
    head: Option<Rc<Item>>,
    page_break: bool,
}

fn gap(height: f64, draw: Option<Draw>) -> Item {
    Item { height, gap: true, draw, ..Item::default() }
}

fn item(height: f64, draw: impl Fn(&mut Pdf, f64, f64, Option<Landing>) + 'static) -> Item {
    Item { height, draw: Some(Rc::new(draw)), ..Item::default() }
}

fn height_of(items: &[Item]) -> f64 {
    items.iter().map(|i| i.height).sum()
}

fn lines_height(lines: &[Line]) -> f64 {
    lines.iter().map(|l| l.height).sum()
}

fn trimmed(items: Vec<Item>) -> Vec<Item> {
    let mut start = 0;
    let mut end = items.len();
    while start < end && items[start].gap {
        start += 1;
    }
    while end > start && items[end - 1].gap {
        end -= 1;
    }
    items[start..end].to_vec()
}

fn draw_stack(pdf: &mut Pdf, items: &[Item], x: f64, y: f64) {
    let mut cy = y;
    for item in items {
        if item.page_break {
            continue;
        }
        if let Some(d) = &item.draw {
            d(pdf, x, cy, None);
        }
        cy += item.height;
    }
}

struct Frame {
    left: f64,
    top: Rc<dyn Fn(usize) -> f64>,
    bottom: f64,
}

struct Pager<'a> {
    page: usize,
    y: f64,
    frame: &'a Frame,
}

impl<'a> Pager<'a> {
    fn at_top(&self) -> bool {
        self.y <= (self.frame.top)(self.page) + 0.5
    }

    fn new_page(&mut self, pdf: &mut Pdf) {
        pdf.add_page();
        self.page += 1;
        self.y = (self.frame.top)(self.page);
    }

    fn chain(items: &[Item], from: usize) -> f64 {
        let mut h = 0.0;
        for item in &items[from..] {
            if item.page_break {
                break;
            }
            h += item.height;
            if !item.keep && !item.gap {
                break;
            }
        }
        h
    }

    fn place(&mut self, pdf: &mut Pdf, items: &[Item], center: bool) {
        let x = self.frame.left;
        let room = self.frame.bottom - (self.frame.top)(1);
        if center && !items.iter().any(|i| i.page_break) {
            let used = height_of(&trimmed(items.to_vec()));
            let free = self.frame.bottom - (self.frame.top)(0) - used;
            if free > 0.0 {
                self.y += free / 2.0;
            }
        }
        for (i, item) in items.iter().enumerate() {
            if item.page_break {
                self.new_page(pdf);
                continue;
            }
            if item.space {
                if self.y + item.height > self.frame.bottom {
                    self.new_page(pdf);
                } else {
                    self.y += item.height;
                }
                continue;
            }
            if item.gap {
                if self.at_top() {
                    continue;
                }
                if self.y + item.height > self.frame.bottom {
                    self.new_page(pdf);
                    continue;
                }
                if let Some(d) = &item.draw {
                    d(pdf, x, self.y, Some(Landing { page: self.page, top: false }));
                }
                self.y += item.height;
                continue;
            }
            let kept = if item.keep { Pager::chain(items, i) } else { item.height };
            let need = if kept <= room { kept } else { item.height };
            if self.y + need > self.frame.bottom + 0.01 && !self.at_top() {
                self.new_page(pdf);
                if let Some(head) = &item.head {
                    if let Some(d) = &head.draw {
                        d(pdf, x, self.y, Some(Landing { page: self.page, top: true }));
                    }
                    self.y += head.height;
                }
            }
            if let Some(d) = &item.draw {
                d(pdf, x, self.y, Some(Landing { page: self.page, top: self.at_top() }));
            }
            self.y += item.height;
        }
    }
}

// ── Rich text ────────────────────────────────────────────────────────────────

fn inline_mark(name: &str, mark: &mut Mark) {
    match name {
        "strong" | "b" => mark.bold = true,
        "em" | "i" => mark.italic = true,
        "u" => mark.underline = true,
        "s" => mark.strike = true,
        _ => {}
    }
}

static DEC: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"&#(\d+);").expect("dec"));
static HEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)&#x([0-9a-f]+);").expect("hex"));

fn code_point(n: Option<u32>) -> String {
    n.and_then(char::from_u32).unwrap_or('\u{fffd}').to_string()
}

/// `decode`, applied to a text the parser has already decoded.
fn decode(text: &str) -> String {
    let t = text.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"");
    let t = DEC.replace_all(&t, |c: &regex::Captures| code_point(c[1].parse().ok()));
    let t = HEX.replace_all(&t, |c: &regex::Captures| code_point(u32::from_str_radix(&c[1], 16).ok()));
    t.replace("&amp;", "&")
}

/// `text.replace(/\s+/g, ' ')`.
fn fold(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut space = false;
    for c in text.chars() {
        if is_js_space(c) {
            if !space {
                out.push(' ');
            }
            space = true;
        } else {
            out.push(c);
            space = false;
        }
    }
    out
}

fn runs_of(nodes: &[Node], mark: &Mark) -> Vec<Run> {
    let mut out = vec![];
    for node in nodes {
        match node {
            Node::Text(data) => {
                let text = fold(&decode(data));
                if !text.is_empty() {
                    out.push(Run { mark: mark.clone(), text });
                }
            }
            Node::Other => {}
            Node::Tag { name, children, .. } => {
                if name == "br" {
                    out.push(Run { mark: mark.clone(), text: "\n".into() });
                    continue;
                }
                if name == "ul" || name == "ol" {
                    continue;
                }
                let mut inner = mark.clone();
                inline_mark(name, &mut inner);
                if name == "a" {
                    inner.link = node.attr("href").map(str::to_string);
                }
                out.extend(runs_of(children, &inner));
            }
        }
    }
    out
}

fn trim_runs(runs: Vec<Run>) -> Vec<Run> {
    let mut out: Vec<Run> = runs.into_iter().filter(|r| !r.text.is_empty()).collect();
    if let Some(first) = out.first_mut() {
        first.text = first.text.trim_start_matches(' ').to_string();
    }
    if let Some(last) = out.last_mut() {
        last.text = last.text.trim_end_matches(' ').to_string();
    }
    out.into_iter().filter(|r| !r.text.is_empty()).collect()
}

fn text_of(nodes: &[Node]) -> String {
    nodes
        .iter()
        .map(|n| match n {
            Node::Text(t) => t.clone(),
            n => text_of(n.children()),
        })
        .collect()
}

#[derive(Clone)]
struct Para {
    runs: Vec<Run>,
    style: TextStyle,
    indent: f64,
    marker: Option<String>,
    before: f64,
    after: f64,
    keep: bool,
    rule: f64,
    hr: bool,
    quote: usize,
}

#[derive(Clone)]
struct TextBase {
    size: f64,
    color: String,
    align: String,
}

fn upper(text: &str, locale: &str) -> String {
    let lang = locale.split(['-', '_']).next().unwrap_or("").to_ascii_lowercase();
    if lang == "tr" || lang == "az" {
        return text.replace('i', "İ").to_uppercase();
    }
    text.to_uppercase()
}

// ── Composing ────────────────────────────────────────────────────────────────

/// A picture opened, with its sides as it is shown.
#[derive(Clone, Copy)]
struct Opened {
    id: usize,
    width: f64,
    height: f64,
}

type Decorate = Rc<dyn Fn(&mut Pdf, f64, f64, f64, bool, bool)>;

struct Cell {
    x: f64,
    lines: Vec<Line>,
    dy: f64,
}

struct Composer {
    pdf: Rc<RefCell<Pdf>>,
    palette: Palette,
    ty: Typesetter,
    theme: Theme,
    room: f64,
    locale: String,
    header_on: Rc<dyn Fn(usize) -> bool>,
    inset: f64,
}

type DrawFn = Rc<dyn Fn(&mut Pdf, f64, f64)>;

pub struct Band {
    pub height: f64,
    draw: DrawFn,
}

impl Composer {
    fn size(&self) -> f64 {
        self.theme.size
    }

    fn body(&self, base: &TextBase) -> TextStyle {
        TextStyle {
            size: base.size,
            family: self.theme.font.clone(),
            color: base.color.clone(),
            bold: false,
            align: base.align.clone(),
            tracking: 0.0,
            line_gap: None,
            link_color: Some(self.palette.accent.clone()),
        }
    }

    fn base(&self, size: f64, color: &str, align: &str) -> TextBase {
        TextBase { size, color: color.to_string(), align: align.to_string() }
    }

    fn paras(&self, nodes: &[Node], base: &TextBase, indent: f64, quote: usize, depth: usize) -> Vec<Para> {
        let mut out: Vec<Para> = vec![];
        let s = base.size;
        let para = |runs: Vec<Run>| Para {
            runs,
            style: self.body(base),
            indent,
            marker: None,
            before: 0.0,
            after: s * 0.5,
            keep: false,
            rule: 0.0,
            hr: false,
            quote,
        };
        for node in nodes {
            let (name, children) = match node {
                Node::Text(_) => {
                    let runs = trim_runs(runs_of(std::slice::from_ref(node), &Mark::default()));
                    if !runs.is_empty() {
                        out.push(para(runs));
                    }
                    continue;
                }
                Node::Other => continue,
                Node::Tag { name, children, .. } => (name.as_str(), children.as_slice()),
            };
            match name {
                "h1" | "h2" | "h3" => {
                    let k = match name {
                        "h1" => 1.8,
                        "h2" => 1.4,
                        _ => 1.2,
                    };
                    let size = s * k;
                    let titles = self.theme.titles.as_str();
                    let mut style = self.body(base);
                    style.size = size;
                    style.family = self.theme.title_font.clone();
                    style.bold = true;
                    style.color = if titles == "accent" { self.palette.accent.clone() } else { base.color.clone() };
                    style.align = if base.align == "justify" { "left".into() } else { base.align.clone() };
                    style.line_gap = Some(size * 0.15);
                    let mut p = para(trim_runs(runs_of(children, &Mark { bold: true, ..Mark::default() })));
                    p.style = style;
                    p.before = s * 0.6;
                    p.after = size * 0.4;
                    p.keep = true;
                    p.rule = if titles == "rule" && name != "h3" {
                        if name == "h1" {
                            1.5
                        } else {
                            1.0
                        }
                    } else {
                        0.0
                    };
                    out.push(p);
                }
                "p" => out.push(para(trim_runs(runs_of(children, &Mark::default())))),
                "pre" => {
                    let mut p = para(vec![Run { mark: Mark::default(), text: decode(&text_of(children)) }]);
                    let mut style = self.body(base);
                    style.size = s * 0.9;
                    style.color = self.palette.muted.clone();
                    style.align = "left".into();
                    p.style = style;
                    p.indent = indent + 8.0;
                    out.push(p);
                }
                "blockquote" => out.extend(self.paras(children, base, indent + 12.0, quote + 1, depth)),
                "ul" | "ol" => {
                    let mut n = 0;
                    let items: Vec<&Node> = children.iter().filter(|c| c.name() == Some("li")).collect();
                    for item in &items {
                        n += 1;
                        let marker = if name == "ol" {
                            format!("{n}.")
                        } else if depth.is_multiple_of(2) {
                            "•".to_string()
                        } else {
                            "◦".to_string()
                        };
                        let inner = item.children();
                        let is_list = |c: &Node| matches!(c.name(), Some("ul") | Some("ol"));
                        let lists: Vec<Node> = inner.iter().filter(|c| is_list(c)).cloned().collect();
                        let mut runs = vec![];
                        for c in inner.iter().filter(|c| !is_list(c)) {
                            if c.name() == Some("p") {
                                runs.extend(runs_of(c.children(), &Mark::default()));
                                runs.push(Run { mark: Mark::default(), text: " ".into() });
                            } else {
                                runs.extend(runs_of(std::slice::from_ref(c), &Mark::default()));
                            }
                        }
                        let runs = trim_runs(runs);
                        let runs = if runs.is_empty() { vec![Run { mark: Mark::default(), text: "\u{a0}".into() }] } else { runs };
                        let mut p = para(runs);
                        p.style.align = "left".into();
                        p.indent = indent + 16.0;
                        p.marker = Some(marker);
                        p.after = s * 0.2;
                        out.push(p);
                        if !lists.is_empty() {
                            out.extend(self.paras(&lists, base, indent + 16.0, quote, depth + 1));
                        }
                    }
                    if !items.is_empty() {
                        if let Some(last) = out.last_mut() {
                            last.after = last.after.max(s * 0.45);
                        }
                    }
                }
                "hr" => {
                    let mut p = para(vec![]);
                    p.hr = true;
                    p.before = s * 0.35;
                    p.after = s * 0.7;
                    out.push(p);
                }
                _ => out.push(para(trim_runs(runs_of(std::slice::from_ref(node), &Mark::default())))),
            }
        }
        out
    }

    fn rich_text(&self, source: &str, width: f64, base: &TextBase) -> Vec<Item> {
        let root = html::parse(source);
        let paras = self.paras(&root, base, 0.0, 0, 0);
        let mut items: Vec<Item> = vec![];
        let bar = |depth: usize| {
            move |pdf: &mut Pdf, x: f64, y: f64, h: f64| {
                for q in 0..depth {
                    pdf.fill_rect(x + q as f64 * 12.0 + 1.0, y, 2.0, h, RULE);
                }
            }
        };
        for (i, p) in paras.iter().enumerate() {
            let next = paras.get(i + 1);
            if p.before > 0.0 {
                let draw: Option<Draw> = if p.quote > 0 && i > 0 && paras[i - 1].quote >= p.quote {
                    let b = bar(p.quote);
                    let h = p.before;
                    Some(Rc::new(move |pdf: &mut Pdf, x, y, _| b(pdf, x, y, h)))
                } else {
                    None
                };
                items.push(gap(p.before, draw));
            }
            if p.hr {
                let indent = p.indent;
                items.push(item(1.0, move |pdf, x, y, _| pdf.stroke_line(x + indent, y + 0.5, x + width, y + 0.5, 0.75, RULE)));
            } else {
                let lines = self.ty.lines(&p.runs, width - p.indent, &p.style);
                if lines.is_empty() {
                    items.push(gap(base.size * 0.6, None));
                    continue;
                }
                let marker = p.marker.as_ref().and_then(|m| {
                    let mut style = p.style.clone();
                    style.color = self.palette.muted.clone();
                    style.align = "left".into();
                    self.ty.plain(m, 16.0, &style).into_iter().next()
                });
                let count = lines.len();
                for (k, line) in lines.into_iter().enumerate() {
                    let ruled = p.rule > 0.0 && k == count - 1;
                    let height = line.height + if ruled { p.rule + base.size * 0.5 } else { 0.0 };
                    let b = bar(p.quote);
                    let (quote, indent, rule, size) = (p.quote, p.indent, p.rule, base.size);
                    let marker = if k == 0 { marker.clone() } else { None };
                    let accent = self.palette.accent.clone();
                    let mut it = item(height, move |pdf, x, y, _| {
                        if quote > 0 {
                            b(pdf, x, y, height);
                        }
                        (line.draw)(pdf, x + indent, y);
                        if let Some(m) = &marker {
                            (m.draw)(pdf, x + indent - 16.0, y);
                        }
                        if ruled {
                            pdf.fill_rect(x + indent, y + line.height + size * 0.15, width - indent, rule, &accent);
                        }
                    });
                    it.keep = p.keep;
                    items.push(it);
                }
            }
            if p.after > 0.0 {
                let in_quote = p.quote > 0 && next.map(|n| n.quote).unwrap_or(0) >= p.quote;
                let draw: Option<Draw> = if in_quote {
                    let b = bar(p.quote);
                    let h = p.after;
                    Some(Rc::new(move |pdf: &mut Pdf, x, y, _| b(pdf, x, y, h)))
                } else {
                    None
                };
                items.push(gap(p.after, draw));
            }
        }
        items
    }

    fn block(&self, block: &Laid, width: f64) -> Vec<Item> {
        match block {
            Laid::Html { html, align, size, style } => self.text(html, align.as_deref(), size.as_deref(), style.as_deref(), width),
            Laid::Fields { rows, columns, labels } => {
                if labels.as_deref() == Some("summary") {
                    self.summary(rows, width)
                } else {
                    self.fields(rows, columns.unwrap_or(1), labels.as_deref().unwrap_or("beside"), width)
                }
            }
            Laid::Table { .. } => self.table(block, width),
            Laid::Break => vec![Item { page_break: true, ..Item::default() }],
            Laid::Image { data, width: pct, align } => self.image(data, *pct, align, width),
            Laid::Title { text, subtitle, style, align, size } => self.title(text, subtitle, style, align, size, width),
            Laid::Divider { color, thickness, width: w } => {
                let color = match color.as_str() {
                    "accent" => self.palette.accent.clone(),
                    "text" => self.palette.text.clone(),
                    _ => RULE.to_string(),
                };
                let (thickness, pct) = (*thickness, w.unwrap_or(100.0));
                vec![
                    gap(self.size() * 0.5, None),
                    item(thickness, move |pdf, x, y, _| {
                        let w = width * pct / 100.0;
                        pdf.fill_rect(x + (width - w) / 2.0, y, w, thickness, &color);
                    }),
                    gap(self.size() * 0.9, None),
                ]
            }
            Laid::Spacer { height } => vec![Item { height: height * MM, space: true, ..Item::default() }],
            Laid::Columns { widths, columns } => self.columns(widths, columns, width),
        }
    }

    fn text(&self, source: &str, align: Option<&str>, size: Option<&str>, style: Option<&str>, width: f64) -> Vec<Item> {
        let size = self.size()
            * match size {
                Some("small") => 0.85,
                Some("large") => 1.2,
                _ => 1.0,
            };
        let base = self.base(size, &self.palette.text, align.unwrap_or("left"));
        let style = style.unwrap_or("plain").to_string();
        if style == "plain" {
            return self.rich_text(source, width, &base);
        }
        let bar = style == "bar";
        let pad_x = size * 1.2;
        let pad_y = if bar { size * 0.2 } else { size * 0.9 };
        let inner = trimmed(self.rich_text(source, width - if bar { pad_x } else { 2.0 * pad_x }, &base));
        if inner.is_empty() {
            return vec![];
        }
        let height = height_of(&inner) + 2.0 * pad_y;
        if height > self.room {
            return self.rich_text(source, width, &base);
        }
        let p = self.palette.clone();
        vec![
            item(height, move |pdf, x, y, _| {
                if style == "tint" {
                    pdf.fill_rounded_rect(x, y, width, height, 3.0, &p.tint);
                } else if style == "border" {
                    pdf.stroke_rounded_rect(x + 0.5, y + 0.5, width - 1.0, height - 1.0, 3.0, 0.75, &mix(&p.accent, WHITE, 0.45));
                } else {
                    pdf.fill_rect(x, y, 2.5, height, &p.accent);
                }
                draw_stack(pdf, &inner, x + pad_x, y + pad_y);
            }),
            gap(self.size() * 0.9, None),
        ]
    }

    fn row(&self, cells: Vec<Cell>, pad_top: f64, pad_bottom: f64, decorate: Decorate, min_height: f64) -> Vec<Item> {
        let height = cells.iter().map(|c| lines_height(&c.lines) + c.dy).fold(min_height, f64::max) + pad_top + pad_bottom;
        if height <= self.room * 0.5 {
            return vec![item(height, move |pdf, x, y, _| {
                decorate(pdf, x, y, height, true, true);
                for c in &cells {
                    let mut cy = y + pad_top + c.dy;
                    for line in &c.lines {
                        (line.draw)(pdf, x + c.x, cy);
                        cy += line.height;
                    }
                }
            })];
        }
        let bands = cells.iter().map(|c| c.lines.len()).max().unwrap_or(0);
        let cells = Rc::new(cells);
        let mut out = vec![];
        for k in 0..bands {
            let first = k == 0;
            let last = k == bands - 1;
            let band_height = cells.iter().map(|c| c.lines.get(k).map(|l| l.height).unwrap_or(0.0)).fold(f64::NEG_INFINITY, f64::max)
                + if first { pad_top } else { 0.0 }
                + if last { pad_bottom } else { 0.0 };
            let cells = cells.clone();
            let decorate = decorate.clone();
            out.push(item(band_height, move |pdf, x, y, _| {
                decorate(pdf, x, y, band_height, first, last);
                for c in cells.iter() {
                    if let Some(line) = c.lines.get(k) {
                        (line.draw)(pdf, x + c.x, y + if first { pad_top } else { 0.0 });
                    }
                }
            }));
        }
        out
    }

    fn summary(&self, rows: &[(String, String)], width: f64) -> Vec<Item> {
        let s = self.size();
        let p = self.palette.clone();
        let mut items = vec![];
        let measure = self.body(&self.base(s * 1.1, &p.text, "right"));
        let widest = rows.iter().map(|r| self.ty.width(&r.1, &measure, true)).fold(f64::NEG_INFINITY, f64::max);
        let value_w = (width * 0.5).min(widest + 4.0);
        let n = rows.len();
        for (i, (label, value)) in rows.iter().enumerate() {
            let last = i == n - 1 && n > 1;
            let size = if last { s * 1.1 } else { s };
            let mut ls = self.body(&self.base(size, if last { &p.text } else { &p.muted }, "left"));
            ls.bold = last;
            let label = self.ty.plain(label, width - value_w - 12.0, &ls);
            let mut vs = self.body(&self.base(size, if last { &p.accent } else { &p.text }, "right"));
            vs.bold = last;
            let value = self.ty.plain(if value.is_empty() { "—" } else { value }, value_w, &vs);
            let pad = s * if last { 0.55 } else { 0.4 };
            let accent = p.accent.clone();
            let decorate: Decorate = Rc::new(move |pdf, x, y, _h, first, _last| {
                if !first {
                    return;
                }
                if last {
                    pdf.fill_rect(x, y - 0.6, width, 1.2, &accent);
                } else if i > 0 {
                    pdf.fill_rect(x, y - 0.25, width, 0.5, RULE);
                }
            });
            items.extend(self.row(vec![Cell { x: 0.0, lines: label, dy: 0.0 }, Cell { x: width - value_w, lines: value, dy: 0.0 }], pad, pad, decorate, 0.0));
        }
        items.push(gap(s * 0.7, None));
        items
    }

    fn fields(&self, rows: &[(String, String)], n: usize, labels: &str, width: f64) -> Vec<Item> {
        let n = n.max(1);
        let above = labels == "above";
        let s = self.size();
        let gap_x = if n > 1 { s * 2.0 } else { 0.0 };
        let cell_w = (width - gap_x * (n as f64 - 1.0)) / n as f64;
        let label = if above {
            let mut st = self.body(&self.base(s * 0.78, &self.palette.muted, "left"));
            st.tracking = 0.3;
            st
        } else {
            let mut st = self.body(&self.base(s * 0.9, &self.palette.muted, "left"));
            st.line_gap = Some(s * 0.25);
            st
        };
        let mut items = vec![];
        for group in rows.chunks(n) {
            let mut cells = vec![];
            for (c, (row_label, row_value)) in group.iter().enumerate() {
                let left = c as f64 * (cell_w + gap_x);
                let value = self.body(&self.base(s, if row_value.is_empty() { &self.palette.muted } else { &self.palette.text }, "left"));
                let shown = if row_value.is_empty() { "—" } else { row_value.as_str() };
                if above {
                    let mut lines = self.ty.plain(&upper(row_label, &self.locale), cell_w, &label);
                    lines.push(Line { width: 0.0, height: s * 0.2, draw: Rc::new(|_, _, _| {}) });
                    lines.extend(self.ty.plain(shown, cell_w, &value));
                    cells.push(Cell { x: left, lines, dy: 0.0 });
                } else {
                    let label_w = if n == 1 { (170f64).min(width * 0.34) } else { cell_w * 0.4 };
                    cells.push(Cell { x: left, lines: self.ty.plain(row_label, label_w, &label), dy: 1.0 });
                    cells.push(Cell { x: left + label_w + 12.0, lines: self.ty.plain(shown, cell_w - label_w - 12.0, &value), dy: 0.0 });
                }
            }
            if above {
                items.extend(self.row(cells, 0.0, s * 0.9, Rc::new(|_, _, _, _, _, _| {}), 0.0));
            } else {
                let count = group.len();
                let decorate: Decorate = Rc::new(move |pdf, x, y, h, _first, last| {
                    if !last {
                        return;
                    }
                    for c in 0..count {
                        let left = x + c as f64 * (cell_w + gap_x);
                        pdf.stroke_line(left, y + h - 3.0, left + cell_w, y + h - 3.0, 0.5, RULE);
                    }
                });
                items.extend(self.row(cells, 0.0, 8.0 - s * 0.25, decorate, 0.0));
            }
        }
        items.push(gap(s * 0.7, None));
        items
    }

    fn table(&self, block: &Laid, width: f64) -> Vec<Item> {
        let Laid::Table { title, columns, rows, totals, more, style, zebra } = block else { return vec![] };
        let s = self.size();
        let pad = s * 0.5;
        let n = columns.len();
        let style = style.clone().unwrap_or_else(|| "light".into());
        let p = self.palette.clone();
        let mut head_style = self.body(&self.base(
            s * 0.9,
            match style.as_str() {
                "accent" => &p.on_accent,
                "lines" => &p.accent,
                _ => &p.muted,
            },
            "left",
        ));
        head_style.bold = true;
        head_style.line_gap = Some(s * 0.15);
        let mut cell_style = self.body(&self.base(s * 0.95, &p.text, "left"));
        cell_style.line_gap = Some(s * 0.15);
        let mut total_style = self.body(&self.base(s, &p.text, "left"));
        total_style.bold = true;
        total_style.line_gap = Some(s * 0.15);

        let mut items: Vec<Item> = vec![];
        if !title.is_empty() {
            let titles = self.theme.titles.as_str();
            let mut st = self.body(&self.base(s * 1.2, if titles == "accent" { &p.accent } else { &p.text }, "left"));
            st.family = self.theme.title_font.clone();
            st.bold = true;
            let lines = self.ty.plain(title, width, &st);
            items.push(gap(s * 0.3, None));
            for line in lines {
                let mut it = item(line.height, move |pdf, x, y, _| (line.draw)(pdf, x, y));
                it.keep = true;
                items.push(it);
            }
            let mut g = gap(s * 0.35, None);
            g.keep = true;
            items.push(g);
        }

        let fixed: Vec<Option<f64>> = columns.iter().map(|c| c.width.map(|w| w / 100.0 * width)).collect();
        let fixed_total: f64 = fixed.iter().map(|w| w.unwrap_or(0.0)).sum();
        let free: Vec<usize> = (0..n).filter(|&c| fixed[c].is_none()).collect();
        let share = if free.is_empty() { 1.0 } else { 0.8 };
        let scale = if fixed_total > width * share { width * share / fixed_total } else { 1.0 };
        let mut widths: Vec<f64> = columns
            .iter()
            .enumerate()
            .map(|(c, column)| {
                if let Some(given) = fixed[c] {
                    return given * scale;
                }
                let total = totals.as_ref().and_then(|t| t.get(c).cloned().flatten()).unwrap_or_default();
                let mut w = self.ty.width(&column.label, &head_style, head_style.bold).max(self.ty.width(&total, &total_style, total_style.bold));
                for row in rows.iter().take(200) {
                    w = w.max(self.ty.width(row.get(c).map(String::as_str).unwrap_or(""), &cell_style, cell_style.bold));
                }
                let natural = w + 2.0 * pad + 1.0;
                if column.numeric {
                    natural.min(width * 0.3)
                } else {
                    natural
                }
            })
            .collect();
        let room = width - fixed_total * scale;
        let free_total: f64 = free.iter().map(|&c| widths[c]).sum();
        let text_cols: Vec<usize> = free.iter().copied().filter(|&c| !columns[c].numeric).collect();
        if !free.is_empty() {
            if free_total < room && !text_cols.is_empty() {
                let extra = (room - free_total) / text_cols.len() as f64;
                for &c in &text_cols {
                    widths[c] += extra;
                }
            } else if free_total < room {
                let extra = (room - free_total) / free.len() as f64;
                for &c in &free {
                    widths[c] += extra;
                }
            } else if free_total > room {
                let mut left = room;
                let mut open = free.clone();
                loop {
                    let share = left / open.len().max(1) as f64;
                    let narrow: Vec<usize> = open.iter().copied().filter(|&c| widths[c] <= share).collect();
                    if narrow.is_empty() || narrow.len() == open.len() {
                        break;
                    }
                    for &c in &narrow {
                        left -= widths[c];
                    }
                    open.retain(|c| !narrow.contains(c));
                }
                let wanted: f64 = open.iter().map(|&c| widths[c]).sum();
                for &c in &open {
                    widths[c] = (widths[c] / wanted * left).max(40.0);
                }
            }
        }
        let sum: f64 = widths.iter().sum();
        if sum > width {
            for w in widths.iter_mut() {
                *w = *w / sum * width;
            }
        }
        let offsets: Vec<f64> = (0..n).map(|c| widths[..c].iter().sum()).collect();
        let align_of = |c: usize| -> String {
            columns[c].align.clone().unwrap_or_else(|| if columns[c].numeric { "right".into() } else { "left".into() })
        };
        let cells_of = |cells: &[String], st: &TextStyle| -> Vec<Cell> {
            cells
                .iter()
                .enumerate()
                .map(|(c, cell)| {
                    let mut st = st.clone();
                    st.align = align_of(c);
                    Cell { x: offsets[c] + pad, lines: self.ty.plain(cell, widths[c] - 2.0 * pad, &st), dy: 0.0 }
                })
                .collect()
        };
        let rule = move |pdf: &mut Pdf, x: f64, y: f64, color: &str, weight: f64| pdf.fill_rect(x, y - weight / 2.0, width, weight, color);

        let labels: Vec<String> = columns.iter().map(|c| c.label.clone()).collect();
        let head_decor: Decorate = {
            let (style, p) = (style.clone(), p.clone());
            Rc::new(move |pdf, x, y, h, _, _| {
                if style == "accent" {
                    pdf.fill_rect(x, y, width, h, &p.accent);
                } else if style == "light" {
                    pdf.fill_rect(x, y, width, h, HEAD_FILL);
                }
                if style == "lines" {
                    rule(pdf, x, y + h, &p.accent, 1.5);
                } else if style == "light" {
                    rule(pdf, x, y + h, RULE, 0.5);
                }
            })
        };
        let head = self.row(cells_of(&labels, &head_style), pad, pad, head_decor, s * 0.9).into_iter().next().unwrap_or_default();
        let head_item = Rc::new(Item { keep: true, ..head });
        items.push((*head_item).clone());

        let zebra_color = if style == "accent" { mix(&p.accent, WHITE, 0.95) } else { ZEBRA.to_string() };
        for (r, cells) in rows.iter().enumerate() {
            let (style, zebra, zebra_color) = (style.clone(), *zebra, zebra_color.clone());
            let decorate: Decorate = Rc::new(move |pdf, x, y, h, _, _| {
                if zebra && r % 2 == 1 {
                    pdf.fill_rect(x, y, width, h, &zebra_color);
                }
                if style != "accent" || !zebra {
                    rule(pdf, x, y + h, RULE, 0.5);
                }
            });
            for it in self.row(cells_of(cells, &cell_style), pad, pad, decorate, s * 0.95) {
                items.push(Item { head: Some(head_item.clone()), ..it });
            }
        }
        if let Some(totals) = totals {
            let totals: Vec<String> = totals.iter().map(|t| t.clone().unwrap_or_default()).collect();
            let (style, p) = (style.clone(), p.clone());
            let decorate: Decorate = Rc::new(move |pdf, x, y, h, _, _| {
                if style == "accent" {
                    pdf.fill_rect(x, y, width, h, &p.tint_strong);
                    rule(pdf, x, y + h, &p.accent, 1.2);
                } else if style == "lines" {
                    rule(pdf, x, y, &p.text, 0.9);
                    rule(pdf, x, y + h, &p.text, 0.9);
                } else {
                    rule(pdf, x, y + h, &p.text, 0.9);
                }
            });
            for it in self.row(cells_of(&totals, &total_style), pad, pad, decorate, s) {
                items.push(Item { head: Some(head_item.clone()), ..it });
            }
        }
        if let Some(more) = more {
            items.push(gap(s * 0.3, None));
            for line in self.ty.plain(more, width, &self.body(&self.base(s * 0.85, &p.muted, "left"))) {
                items.push(item(line.height, move |pdf, x, y, _| (line.draw)(pdf, x, y)));
            }
        }
        items.push(gap(s * 1.1, None));
        items
    }

    fn image(&self, data: &[u8], pct: f64, align: &str, width: f64) -> Vec<Item> {
        let Some(opened) = self.open(data) else { return vec![] };
        let mut w = width * pct / 100.0;
        let mut h = w * opened.height / opened.width;
        let most = self.room * 0.85;
        if h > most {
            w *= most / h;
            h = most;
        }
        let offset = match align {
            "center" => (width - w) / 2.0,
            "right" => width - w,
            _ => 0.0,
        };
        vec![item(h, move |pdf, x, y, _| pdf.image(opened.id, x + offset, y, w)), gap(self.size() * 0.9, None)]
    }

    fn open(&self, data: &[u8]) -> Option<Opened> {
        let mut pdf = self.pdf.borrow_mut();
        let id = pdf.open_image(data)?;
        let image = pdf.image_info(id);
        let turned = image.orientation > 4;
        Some(Opened {
            id,
            width: if turned { image.height } else { image.width },
            height: if turned { image.width } else { image.height },
        })
    }

    fn title(&self, text: &str, subtitle: &str, style: &str, align: &str, size_name: &str, width: f64) -> Vec<Item> {
        if text.is_empty() && subtitle.is_empty() {
            return vec![];
        }
        let p = self.palette.clone();
        let k = match size_name {
            "huge" => 2.9,
            "medium" => 1.5,
            _ => 2.1,
        };
        let size = self.size() * k;
        let band = style == "band" || style == "bleed";
        let pad_y = if band { (size * 0.45).max(self.size() * 0.9) } else { 0.0 };
        let pad_x = if style == "band" { self.size() * 1.2 } else { 0.0 };
        let color = if band {
            p.on_accent.clone()
        } else if style == "accent" {
            p.accent.clone()
        } else {
            p.text.clone()
        };
        let lines = self.ty.plain(
            text,
            width - 2.0 * pad_x,
            &TextStyle {
                size,
                family: self.theme.title_font.clone(),
                color,
                bold: true,
                align: align.to_string(),
                tracking: 0.0,
                line_gap: Some(size * 0.12),
                link_color: None,
            },
        );
        let sub_size = self.size().max(size * 0.42);
        let sub = if subtitle.is_empty() {
            vec![]
        } else {
            self.ty.plain(
                subtitle,
                width - 2.0 * pad_x,
                &TextStyle {
                    size: sub_size,
                    family: self.theme.font.clone(),
                    color: if band { p.on_accent_muted.clone() } else { p.muted.clone() },
                    bold: false,
                    align: align.to_string(),
                    tracking: 0.0,
                    line_gap: None,
                    link_color: None,
                },
            )
        };
        let underline = style == "underline";
        let base_size = self.size();
        let bar_gap = if underline { base_size * 0.5 } else { 0.0 };
        let height = 2.0 * pad_y
            + lines_height(&lines)
            + if sub.is_empty() { 0.0 } else { base_size * 0.15 + lines_height(&sub) }
            + if underline { bar_gap + 3.0 } else { 0.0 };
        let page_width = self.pdf.borrow().width;
        let (style, align) = (style.to_string(), align.to_string());
        let (inset, header_on) = (self.inset, self.header_on.clone());
        let mut it = item(height, move |pdf, x, y, at| {
            if style == "band" {
                pdf.fill_rect(x, y, width, height, &p.accent);
            }
            if style == "bleed" {
                let edge = inset;
                let from = match at {
                    Some(at) if at.top && !header_on(at.page) => edge,
                    _ => y,
                };
                pdf.fill_rect(edge, from, page_width - 2.0 * edge, y + height - from, &p.accent);
            }
            let mut cy = y + pad_y;
            for line in &lines {
                (line.draw)(pdf, x + pad_x, cy);
                cy += line.height;
            }
            if !sub.is_empty() {
                cy += base_size * 0.15;
            }
            for line in &sub {
                (line.draw)(pdf, x + pad_x, cy);
                cy += line.height;
            }
            if underline {
                let bar_w = width.min(size * 2.2);
                let bx = match align.as_str() {
                    "center" => x + (width - bar_w) / 2.0,
                    "right" => x + width - bar_w,
                    _ => x,
                };
                pdf.fill_rect(bx, cy + bar_gap, bar_w, 3.0, &p.accent);
            }
        });
        it.keep = true;
        let mut after = gap(base_size * if band { 1.4 } else { 1.0 }, None);
        after.keep = true;
        vec![it, after]
    }

    fn columns(&self, widths_in: &[f64], columns: &[Vec<Laid>], width: f64) -> Vec<Item> {
        let gap_x = self.size() * 2.0;
        let n = columns.len();
        let weights: Vec<f64> = (0..n).map(|c| widths_in.get(c).copied().unwrap_or(1.0)).collect();
        let total: f64 = weights.iter().sum();
        let room = width - gap_x * (n as f64 - 1.0);
        let widths: Vec<f64> = weights.iter().map(|w| room * w / total).collect();
        let stacks: Vec<Vec<Item>> = columns.iter().enumerate().map(|(c, column)| trimmed(column.iter().flat_map(|inner| self.block(inner, widths[c])).collect())).collect();
        let height = stacks.iter().map(|s| height_of(s)).fold(0.0, f64::max);
        if height == 0.0 {
            return vec![];
        }
        if height > self.room {
            return columns.iter().flat_map(|column| column.iter().flat_map(|inner| self.block(inner, width)).collect::<Vec<_>>()).collect();
        }
        vec![
            item(height, move |pdf, x, y, _| {
                let mut cx = x;
                for (c, stack) in stacks.iter().enumerate() {
                    draw_stack(pdf, stack, cx, y);
                    cx += widths[c] + gap_x;
                }
            }),
            gap(self.size() * 0.9, None),
        ]
    }

    fn header(&self, header: &LaidHeader, width: f64) -> Option<Band> {
        let s = self.size() * 0.9;
        let logo = header.logo.as_ref().and_then(|l| self.open(l));
        let has_left = logo.is_some() || !header.left.is_empty();
        let has_right = !header.right.is_empty();
        if !has_left && !has_right {
            return None;
        }
        let gap_x = self.size() * 2.0;
        let left_w = if has_right {
            if has_left {
                (width - gap_x) * 0.55
            } else {
                0.0
            }
        } else {
            width
        };
        let right_w = if has_left { width - left_w - gap_x } else { width };
        let (mut logo_w, mut logo_h) = (0.0, 0.0);
        if let Some(logo) = &logo {
            logo_w = (header.logo_width * MM).min(left_w);
            logo_h = logo_w * logo.height / logo.width;
            let most = 32.0 * MM;
            if logo_h > most {
                logo_w *= most / logo_h;
                logo_h = most;
            }
        }
        let left = if header.left.is_empty() { vec![] } else { trimmed(self.rich_text(&header.left, left_w, &self.base(s, &self.palette.text, "left"))) };
        let right = if header.right.is_empty() { vec![] } else { trimmed(self.rich_text(&header.right, right_w, &self.base(s, &self.palette.text, "right"))) };
        let logo_gap = if logo.is_some() && !left.is_empty() { self.size() * 0.8 } else { 0.0 };
        let height = (logo_h + logo_gap + height_of(&left)).max(height_of(&right));
        if height == 0.0 {
            return None;
        }
        let rule = header.rule;
        let rule_gap = if rule { self.size() * 0.9 } else { 0.0 };
        let accent = self.palette.accent.clone();
        Some(Band {
            height: height + if rule { rule_gap + 1.0 } else { 0.0 },
            draw: Rc::new(move |pdf, x, y| {
                if let Some(logo) = &logo {
                    pdf.image(logo.id, x, y, logo_w);
                }
                draw_stack(pdf, &left, x, y + logo_h + logo_gap);
                draw_stack(pdf, &right, x + width - right_w, y);
                if rule {
                    pdf.fill_rect(x, y + height + rule_gap, width, 1.0, &accent);
                }
            }),
        })
    }

    fn footer(&self, footer: &LaidFooter, width: f64, reserve: f64) -> Band {
        let s = (self.size() * 0.8).max(7.0);
        let center = footer.align == "center";
        let text_w = if center { width - 2.0 * reserve } else { width - reserve };
        let items = if footer.html.is_empty() { vec![] } else { trimmed(self.rich_text(&footer.html, text_w, &self.base(s, &self.palette.muted, &footer.align))) };
        let height = height_of(&items);
        Band { height, draw: Rc::new(move |pdf, x, y| draw_stack(pdf, &items, if center { x + reserve } else { x }, y)) }
    }

    fn page_label(&self, text: &str) -> Option<Line> {
        let s = (self.size() * 0.8).max(7.0);
        self.ty.plain(text, 200.0, &self.body(&self.base(s, &self.palette.muted, "left"))).into_iter().next()
    }
}

/// The document as PDF bytes.
pub fn layout_pdf(document: &LaidDocument, fonts: Option<FontSet>) -> Vec<u8> {
    let theme = document.theme.clone();
    let margin = theme.margin * MM;
    let (mut page_w, mut page_h) = if document.size == "LETTER" { (612.0, 792.0) } else { (595.28, 841.89) };
    if document.orientation == "landscape" {
        std::mem::swap(&mut page_w, &mut page_h);
    }
    let pdf = Rc::new(RefCell::new(Pdf::new(page_w, page_h)));
    let faces = Rc::new(Faces::new(fonts));
    let width = page_w - 2.0 * margin;
    let inset = margin * 0.38;
    let framed = theme.border != "none";

    let composer = |room: f64, header_on: Rc<dyn Fn(usize) -> bool>, inset: f64| Composer {
        pdf: pdf.clone(),
        palette: palette_of(&theme),
        ty: Typesetter::new(faces.clone()),
        theme: theme.clone(),
        room,
        locale: document.locale.clone(),
        header_on,
        inset,
    };
    let measuring = composer(page_h - 2.0 * margin, Rc::new(|_| false), 0.0);
    let header = document.header.as_ref().and_then(|h| measuring.header(h, width));
    let reserve = if document.footer.page_numbers {
        measuring.ty.width(
            &(document.page_label)(888, 888),
            &TextStyle {
                size: (theme.size * 0.8).max(7.0),
                family: theme.font.clone(),
                color: INK.into(),
                bold: false,
                align: "left".into(),
                tracking: 0.0,
                line_gap: None,
                link_color: None,
            },
            false,
        ) + theme.size * 1.6
    } else {
        0.0
    };
    let footer = measuring.footer(&document.footer, width, reserve);
    let page_label_height = if document.footer.page_numbers { measuring.page_label("1 / 1").map(|l| l.height).unwrap_or(0.0) } else { 0.0 };
    let footer_height = footer.height.max(page_label_height);

    let header_top = (margin * 0.55).max(if framed { inset + theme.size * 1.4 } else { 0.0 });
    let body_top_with_header = match &header {
        None => margin,
        Some(h) => margin.max(header_top + h.height + theme.size * 1.6),
    };
    let footer_bottom = page_h - (margin * 0.42).max(if framed { inset + theme.size * 1.2 } else { 14.0 });
    let footer_top = footer_bottom - footer_height;
    let rule_gap = if document.footer.rule { theme.size * 0.7 } else { 0.0 };
    let body_bottom = (page_h - margin).min(footer_top - rule_gap - theme.size * 0.9);
    let every_header = document.header.as_ref().is_some_and(|h| h.show == "every");
    let has_header = header.is_some();
    let header_on: Rc<dyn Fn(usize) -> bool> = Rc::new(move |page| has_header && (page == 0 || every_header));
    let top: Rc<dyn Fn(usize) -> f64> = {
        let header_on = header_on.clone();
        Rc::new(move |page| if header_on(page) { body_top_with_header } else { margin })
    };
    let frame = Frame { left: margin, top: top.clone(), bottom: body_bottom };

    let composer = composer(frame.bottom - top(0).max(top(1)), header_on, if framed { inset } else { 0.0 });
    let items: Vec<Item> = document.blocks.iter().flat_map(|b| composer.block(b, width)).collect();
    {
        let mut pdf = pdf.borrow_mut();
        let mut pager = Pager { page: 0, y: top(0), frame: &frame };
        pager.place(&mut pdf, &items, document.valign == "center");
    }

    let palette = palette_of(&theme);
    let count = pdf.borrow().page_count();
    for index in 0..count {
        let mut doc = pdf.borrow_mut();
        doc.switch_to_page(index);
        if theme.border == "line" {
            doc.stroke_rect(inset, inset, page_w - 2.0 * inset, page_h - 2.0 * inset, 1.0, &palette.accent);
        } else if theme.border == "double" {
            doc.stroke_rect(inset, inset, page_w - 2.0 * inset, page_h - 2.0 * inset, 2.2, &palette.accent);
            let inner = inset + 4.0;
            doc.stroke_rect(inner, inner, page_w - 2.0 * inner, page_h - 2.0 * inner, 0.6, &palette.accent);
        }
        if let Some(h) = &header {
            if index == 0 || every_header {
                (h.draw)(&mut doc, margin, header_top);
            }
        }
        if document.footer.rule && (footer.height > 0.0 || document.footer.page_numbers) {
            doc.fill_rect(margin, footer_top - rule_gap, width, 0.5, RULE);
        }
        (footer.draw)(&mut doc, margin, footer_top);
        if document.footer.page_numbers {
            drop(doc);
            let label = composer.page_label(&(document.page_label)(index + 1, count));
            let mut doc = pdf.borrow_mut();
            if let Some(label) = label {
                let x = margin + width - label.width;
                (label.draw)(&mut doc, x, footer_top);
            }
        }
    }
    drop(composer);
    drop(measuring);
    let pdf = Rc::try_unwrap(pdf).ok().expect("pdf").into_inner();
    pdf.finish(&document.title, &document.locale)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn colours_as_node() {
        assert_eq!(mix("#1d4ed8", WHITE, 0.93), "#eff3fc");
        assert_eq!(on_color("#1d4ed8"), WHITE);
        assert_eq!(on_color("#fde047"), INK);
    }

    #[test]
    fn tokens() {
        let t: Vec<&str> = TOKEN.find_iter("Prix-total: 12 日本\u{a0}x").map(|m| m.as_str()).collect();
        assert_eq!(t, vec!["Prix-", "total:", " ", "12", " ", "日", "本", "\u{a0}", "x"]);
    }
}
