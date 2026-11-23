//! Le texte d'un PDF joint au copilote, extrait comme Node le fait (`unpdf`, donc pdf.js
//! `getTextContent`) : mêmes éléments de texte, mêmes espaces et fins de ligne, page par page.
//!
//! Le document est lu par `lopdf` (objets, flux décompressés) ; le contenu des pages, les polices et
//! la mise en page du texte suivent pdf.js à la lettre. Limites (voir `NOTES.md`, « Crate ai ») : pas de
//! réordonnancement bidirectionnel (hébreu, arabe), pas d'encodage tiré d'une police CFF ou TrueType
//! embarquée sans `ToUnicode`, pas de CMap prédéfinie autre qu'`Identity` (pdf.js, sans `cMapUrl`
//! dans `unpdf`, n'en lit pas non plus).

mod font;
mod lexer;
#[allow(clippy::all)]
mod tables;

use std::collections::HashMap;
use std::rc::Rc;
use std::sync::LazyLock;

use lopdf::{Dictionary, Document, Object, ObjectId};
use regex::Regex;
use unicode_normalization::UnicodeNormalization;

use font::Font;
use lexer::{Obj, Operations};

static NULL: Object = Object::Null;

/// Follows references (a bounded number of times).
pub(crate) fn deref<'a>(doc: &'a Document, mut o: &'a Object) -> &'a Object {
    for _ in 0..32 {
        match o {
            Object::Reference(id) => o = doc.get_object(*id).unwrap_or(&NULL),
            _ => return o,
        }
    }
    &NULL
}

/// A dictionary's entry, dereferenced (`None` when absent or null).
pub(crate) fn get<'a>(doc: &'a Document, d: &'a Dictionary, key: &[u8]) -> Option<&'a Object> {
    let o = deref(doc, d.get(key).ok()?);
    (!matches!(o, Object::Null)).then_some(o)
}

pub(crate) fn as_dict<'a>(doc: &'a Document, o: &'a Object) -> Option<&'a Dictionary> {
    match deref(doc, o) {
        Object::Dictionary(d) => Some(d),
        Object::Stream(s) => Some(&s.dict),
        _ => None,
    }
}

pub(crate) fn as_name(o: &Object) -> Option<Vec<u8>> {
    match o {
        Object::Name(n) => Some(n.clone()),
        _ => None,
    }
}

pub(crate) fn array<'a>(doc: &'a Document, o: &'a Object) -> Option<&'a Vec<Object>> {
    match deref(doc, o) {
        Object::Array(a) => Some(a),
        _ => None,
    }
}

/// A number, as pdf.js reads it: `lopdf` keeps reals in single precision, so their shortest
/// decimal form is read back in double precision.
pub(crate) fn num(o: &Object) -> Option<f64> {
    match o {
        Object::Integer(i) => Some(*i as f64),
        Object::Real(r) => format!("{r}").parse().ok(),
        _ => None,
    }
}

/// A stream's decoded bytes.
pub(crate) fn stream_bytes(doc: &Document, o: &Object) -> Option<Vec<u8>> {
    match deref(doc, o) {
        Object::Stream(s) => {
            if s.dict.get(b"Filter").is_ok() {
                s.decompressed_content().ok()
            } else {
                Some(s.content.clone())
            }
        }
        _ => None,
    }
}

const IDENTITY: [f64; 6] = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
const FONT_IDENTITY: [f64; 6] = [0.001, 0.0, 0.0, 0.001, 0.0, 0.0];

/// `Util.transform`.
fn mul(a: &[f64; 6], b: &[f64; 6]) -> [f64; 6] {
    [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5],
    ]
}

/// JavaScript truthiness of a number.
fn truthy(x: f64) -> bool {
    x != 0.0 && !x.is_nan()
}

fn js_sign(x: f64) -> f64 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        x
    }
}

/// The text of each page of a PDF, as `unpdf`'s `extractText({ mergePages: false })` gives
/// it; `None` when the file cannot be read.
pub fn pdf_pages(data: &[u8]) -> Option<Vec<String>> {
    let mut doc = Document::load_mem(data).ok()?;
    if doc.is_encrypted() && doc.decrypt("").is_err() {
        return None;
    }
    // pdf.js refuses a document without a catalog whose page tree counts its pages.
    let catalog = doc.catalog().ok()?;
    let tree = get(&doc, catalog, b"Pages").and_then(|o| as_dict(&doc, o))?;
    if !matches!(get(&doc, tree, b"Count"), Some(Object::Integer(_))) {
        return None;
    }
    let pages: Vec<ObjectId> = doc.get_pages().into_values().collect();
    Some(pages.iter().map(|&id| page_text(&doc, id)).collect())
}

/// A page's property, inherited from its ancestors.
fn inherited<'a>(doc: &'a Document, page: &'a Dictionary, key: &[u8]) -> Option<&'a Object> {
    let mut d = page;
    for _ in 0..64 {
        if let Some(o) = get(doc, d, key) {
            return Some(o);
        }
        d = get(doc, d, b"Parent").and_then(|p| as_dict(doc, p))?;
    }
    None
}

fn bounding_box(doc: &Document, page: &Dictionary, key: &[u8]) -> Option<[f64; 4]> {
    let a = array(doc, inherited(doc, page, key)?)?;
    if a.len() != 4 {
        return None;
    }
    let v: Vec<f64> = a.iter().filter_map(|o| num(deref(doc, o))).collect();
    if v.len() != 4 {
        return None;
    }
    let b = [v[0].min(v[2]), v[1].min(v[3]), v[0].max(v[2]), v[1].max(v[3])];
    (b[2] - b[0] > 0.0 && b[3] - b[1] > 0.0).then_some(b)
}

/// `Page.view`: the crop box within the media box.
fn view_box(doc: &Document, page: &Dictionary) -> [f64; 4] {
    let media = bounding_box(doc, page, b"MediaBox").unwrap_or([0.0, 0.0, 612.0, 792.0]);
    let crop = bounding_box(doc, page, b"CropBox").unwrap_or(media);
    if crop == media {
        return media;
    }
    let b = [crop[0].max(media[0]), crop[1].max(media[1]), crop[2].min(media[2]), crop[3].min(media[3])];
    if b[0] > b[2] || b[1] > b[3] || b[2] - b[0] <= 0.0 || b[3] - b[1] <= 0.0 {
        return media;
    }
    b
}

fn page_text(doc: &Document, id: ObjectId) -> String {
    let Ok(page) = doc.get_dictionary(id) else { return String::new() };
    let resources = inherited(doc, page, b"Resources").and_then(|o| as_dict(doc, o));
    let mut content = vec![];
    match page.get(b"Contents").ok().map(|o| deref(doc, o)) {
        Some(Object::Array(parts)) => {
            for part in parts {
                content.extend(stream_bytes(doc, part).unwrap_or_default());
            }
        }
        Some(o) => content = stream_bytes(doc, o).unwrap_or_default(),
        None => {}
    }
    let mut ex = Extractor { doc, view: view_box(doc, page), items: vec![], fonts: HashMap::new(), fallback: None };
    let mut refs = vec![];
    Run::new(&mut ex, resources, TextState::default()).run(&content, &mut refs);
    ex.items.iter().map(|i| if i.eol { format!("{}\n", i.text) } else { i.text.clone() }).collect()
}

struct Item {
    text: String,
    eol: bool,
}

struct Extractor<'d> {
    doc: &'d Document,
    view: [f64; 4],
    items: Vec<Item>,
    fonts: HashMap<ObjectId, Rc<Font>>,
    fallback: Option<Rc<Font>>,
}

impl<'d> Extractor<'d> {
    /// `loadFont`: by reference (cached), inline, or pdf.js's fallback font when missing.
    fn font(&mut self, entry: Option<&'d Object>) -> Rc<Font> {
        let doc = self.doc;
        match entry {
            Some(Object::Reference(id)) => {
                if let Some(f) = self.fonts.get(id) {
                    return f.clone();
                }
                let f = match as_dict(doc, deref(doc, &Object::Reference(*id))) {
                    Some(d) => Rc::new(font::load_font(doc, d)),
                    None => self.fallback(),
                };
                self.fonts.insert(*id, f.clone());
                f
            }
            Some(o) => match as_dict(doc, o) {
                Some(d) => Rc::new(font::load_font(doc, d)),
                None => self.fallback(),
            },
            None => self.fallback(),
        }
    }

    fn fallback(&mut self) -> Rc<Font> {
        self.fallback.get_or_insert_with(|| Rc::new(font::fallback_font())).clone()
    }
}

/// pdf.js's `TextState`.
#[derive(Clone)]
struct TextState {
    ctm: [f64; 6],
    font_name: Option<Vec<u8>>,
    font_size: f64,
    font: Option<Rc<Font>>,
    font_matrix: [f64; 6],
    tm: [f64; 6],
    tlm: [f64; 6],
    char_spacing: f64,
    word_spacing: f64,
    leading: f64,
    h_scale: f64,
    rise: f64,
}

impl Default for TextState {
    fn default() -> Self {
        TextState {
            ctm: IDENTITY,
            font_name: None,
            font_size: 0.0,
            font: None,
            font_matrix: FONT_IDENTITY,
            tm: IDENTITY,
            tlm: IDENTITY,
            char_spacing: 0.0,
            word_spacing: 0.0,
            leading: 0.0,
            h_scale: 1.0,
            rise: 0.0,
        }
    }
}

impl TextState {
    fn translate_tm(&mut self, x: f64, y: f64) {
        let m = &mut self.tm;
        m[4] += m[0] * x + m[2] * y;
        m[5] += m[1] * x + m[3] * y;
    }

    fn translate_tlm(&mut self, x: f64, y: f64) {
        let m = &mut self.tlm;
        m[4] += m[0] * x + m[2] * y;
        m[5] += m[1] * x + m[3] * y;
    }

    fn carriage_return(&mut self) {
        self.translate_tlm(0.0, -self.leading);
        self.tm = self.tlm;
    }

    fn vertical(&self) -> bool {
        self.font.as_ref().is_some_and(|f| f.vertical)
    }
}

/// The text item being built (`textContentItem`): it outlives flushes, as in pdf.js.
struct Building {
    initialized: bool,
    text: Vec<String>,
    total_width: f64,
    total_height: f64,
    width: f64,
    height: f64,
    vertical: bool,
    prev_transform: Option<[f64; 6]>,
    prev_text_rise: f64,
    advance_scale: f64,
    space_in_flow_min: f64,
    space_in_flow_max: f64,
    tracking_space_min: f64,
    negative_space_max: f64,
    not_a_space: f64,
    has_eol: bool,
}

impl Default for Building {
    fn default() -> Self {
        Building {
            initialized: false,
            text: vec![],
            total_width: 0.0,
            total_height: 0.0,
            width: 0.0,
            height: 0.0,
            vertical: false,
            prev_transform: None,
            prev_text_rise: 0.0,
            advance_scale: 0.0,
            space_in_flow_min: 0.0,
            space_in_flow_max: 0.0,
            tracking_space_min: f64::INFINITY,
            negative_space_max: f64::NEG_INFINITY,
            not_a_space: f64::NEG_INFINITY,
            has_eol: false,
        }
    }
}

#[derive(PartialEq)]
enum Category {
    Whitespace,
    Diacritic,
    FormatMark,
    Other,
}

/// `getCharUnicodeCategory`.
fn category(s: &str) -> Category {
    static MN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\p{Mn}+$").expect("regex"));
    static CF: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\p{Cf}+$").expect("regex"));
    let js_space = |c: char| {
        matches!(c, '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
    };
    if !s.is_empty() && s.chars().all(js_space) {
        Category::Whitespace
    } else if MN.is_match(s) {
        Category::Diacritic
    } else if CF.is_match(s) {
        Category::FormatMark
    } else {
        Category::Other
    }
}

/// `normalizeUnicode`: compatibility forms (ligatures, presentation forms…) decomposed.
fn normalize_unicode(s: &str) -> String {
    static RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(
            r"([\x{a0}\x{b5}\x{37e}\x{eb3}\x{2000}-\x{200a}\x{202f}\x{2126}\x{fb00}-\x{fb04}\x{fb06}\x{fb20}-\x{fb36}\x{fb38}-\x{fb3c}\x{fb3e}\x{fb40}\x{fb41}\x{fb43}\x{fb44}\x{fb46}-\x{fba1}\x{fba4}-\x{fba9}\x{fbae}-\x{fbb1}\x{fbd3}-\x{fbdc}\x{fbde}-\x{fbe7}\x{fbea}-\x{fbf8}\x{fbfc}\x{fbfd}\x{fc00}-\x{fc5d}\x{fc64}-\x{fcf1}\x{fcf5}-\x{fd3d}\x{fd88}\x{fdf4}\x{fdfa}\x{fdfb}\x{fe71}\x{fe77}\x{fe79}\x{fe7b}\x{fe7d}]+)|(\x{fb05}+)",
        )
        .expect("regex")
    });
    RE.replace_all(s, |c: &regex::Captures| match c.get(1) {
        Some(m) => m.as_str().nfkc().collect::<String>(),
        None => "\u{17f}t".repeat(c[2].chars().count()),
    })
    .into_owned()
}

/// One run of `getTextContent` (a page, or a form XObject within it).
struct Run<'x, 'd> {
    ex: &'x mut Extractor<'d>,
    resources: Option<&'d Dictionary>,
    st: TextState,
    stack: Vec<TextState>,
    te: Option<TextState>,
    b: Building,
    last: [String; 2],
    slot: usize,
}

/// A failure pdf.js would throw: the rest of the stream is ignored.
struct Abort;

impl<'x, 'd> Run<'x, 'd> {
    fn new(ex: &'x mut Extractor<'d>, resources: Option<&'d Dictionary>, st: TextState) -> Self {
        Run { ex, resources, st, stack: vec![], te: None, b: Building::default(), last: [" ".into(), " ".into()], slot: 0 }
    }

    fn save_last_char(&mut self, c: &str) -> bool {
        let t = (self.slot + 1) % 2;
        let n = self.last[self.slot] != " " && self.last[t] == " ";
        self.last[self.slot] = c.to_string();
        self.slot = t;
        n
    }

    fn should_add_whitespace(&self) -> bool {
        self.last[self.slot] != " " && self.last[(self.slot + 1) % 2] == " "
    }

    fn reset_last_chars(&mut self) {
        self.last = [" ".into(), " ".into()];
        self.slot = 0;
    }

    fn push_whitespace(&mut self) {
        self.ex.items.push(Item { text: " ".into(), eol: false });
    }

    fn current_transform(&self) -> [f64; 6] {
        let st = &self.st;
        let mut t = [st.font_size * st.h_scale, 0.0, 0.0, st.font_size, 0.0, st.rise];
        if let Some(f) = &st.font {
            if f.type3 && st.font_size <= 1.0 && st.font_matrix != FONT_IDENTITY {
                if let Some(bb) = f.bbox {
                    let h = bb[3] - bb[1];
                    if h > 0.0 {
                        t[3] *= h * st.font_matrix[3];
                    }
                }
            }
        }
        mul(&st.ctm, &mul(&st.tm, &t))
    }

    fn ensure_item(&mut self) {
        if self.b.initialized {
            return;
        }
        let t = self.current_transform();
        let vertical = self.st.vertical();
        let b = &mut self.b;
        if vertical {
            b.width = t[0].hypot(t[1]);
            b.total_width = b.width;
            b.height = 0.0;
            b.total_height = 0.0;
            b.vertical = true;
        } else {
            b.width = 0.0;
            b.total_width = 0.0;
            b.height = t[2].hypot(t[3]);
            b.total_height = b.height;
            b.vertical = false;
        }
        b.advance_scale = self.st.ctm[0].hypot(self.st.ctm[1]) * self.st.tlm[0].hypot(self.st.tlm[1]);
        let fs = self.st.font_size;
        b.tracking_space_min = fs * 0.102;
        b.not_a_space = fs * 0.03;
        b.negative_space_max = fs * -0.2;
        b.space_in_flow_min = fs * 0.102;
        b.space_in_flow_max = fs * 0.6;
        b.has_eol = false;
        b.initialized = true;
    }

    fn update_advance_scale(&mut self) {
        if !self.b.initialized {
            return;
        }
        let t = self.st.ctm[0].hypot(self.st.ctm[1]) * self.st.tlm[0].hypot(self.st.tlm[1]);
        let b = &mut self.b;
        if t != b.advance_scale {
            if b.vertical {
                b.total_height += b.height * b.advance_scale;
                b.height = 0.0;
            } else {
                b.total_width += b.width * b.advance_scale;
                b.width = 0.0;
            }
            b.advance_scale = t;
        }
    }

    fn flush(&mut self) {
        if !self.b.initialized {
            return;
        }
        let text = normalize_unicode(&self.b.text.concat());
        self.ex.items.push(Item { text, eol: self.b.has_eol });
        self.b.initialized = false;
        self.b.text.clear();
    }

    fn append_eol(&mut self) {
        self.reset_last_chars();
        if self.b.initialized {
            self.b.has_eol = true;
            self.flush();
        } else {
            self.ex.items.push(Item { text: String::new(), eol: true });
        }
    }

    fn add_fake_spaces(&mut self, e: f64, sign: f64) -> bool {
        if sign * self.b.space_in_flow_min <= e && e <= sign * self.b.space_in_flow_max {
            if self.b.initialized {
                self.reset_last_chars();
                self.b.text.push(" ".into());
            }
            return false;
        }
        self.flush();
        self.reset_last_chars();
        self.push_whitespace();
        true
    }

    /// `compareWithLastPosition`.
    fn compare_with_last_position(&mut self, e: f64) -> bool {
        let t = self.current_transform();
        let (mut n, mut r) = (t[4], t[5]);
        let c = self.ex.view;
        let vertical = self.st.vertical();
        if vertical {
            if n < c[0] || n > c[2] || r + e < c[1] || r > c[3] {
                return false;
            }
        } else if n + e < c[0] || n > c[2] || r < c[1] || r > c[3] {
            return false;
        }
        let Some(prev) = self.b.prev_transform else { return true };
        let (mut i, mut a) = (prev[4], prev[5]);
        if i == n && a == r {
            return true;
        }
        let rotation = if truthy(t[0]) && t[1] == 0.0 && t[2] == 0.0 {
            if t[0] > 0.0 {
                0
            } else {
                180
            }
        } else if truthy(t[1]) && t[0] == 0.0 && t[3] == 0.0 {
            if t[1] > 0.0 {
                90
            } else {
                270
            }
        } else {
            -1
        };
        let inverse = |x: f64, y: f64, m: &[f64; 6]| {
            let h = m[0].hypot(m[1]);
            ((m[0] * x + m[1] * y) / h, (m[2] * x + m[3] * y) / h)
        };
        match rotation {
            0 => {}
            90 => {
                (n, r) = (r, n);
                (i, a) = (a, i);
            }
            180 => (n, r, i, a) = (-n, -r, -i, -a),
            270 => {
                (n, r) = (-r, -n);
                (i, a) = (-a, -i);
            }
            _ => {
                (n, r) = inverse(n, r, &t);
                (i, a) = inverse(i, a, &prev);
            }
        }
        if vertical {
            let e = (a - r) / self.b.advance_scale;
            let t = n - i;
            let o = js_sign(if truthy(self.b.height) { self.b.height } else { self.b.total_height });
            if e < o * self.b.negative_space_max {
                if t.abs() > 0.5 * self.b.width {
                    self.append_eol();
                    return true;
                }
                self.reset_last_chars();
                self.flush();
                return true;
            }
            if t.abs() > self.b.width {
                self.append_eol();
                return true;
            }
            if e <= o * self.b.not_a_space {
                self.reset_last_chars();
            }
            if e <= o * self.b.tracking_space_min {
                if self.should_add_whitespace() {
                    self.reset_last_chars();
                    self.flush();
                    self.push_whitespace();
                } else {
                    self.b.height += e;
                }
            } else if !self.add_fake_spaces(e, o) {
                if self.b.text.is_empty() {
                    self.reset_last_chars();
                    self.push_whitespace();
                } else {
                    self.b.height += e;
                }
            }
            if t.abs() > self.b.width * 0.25 {
                self.flush();
            }
            return true;
        }
        let s = (n - i) / self.b.advance_scale;
        let l = r - a;
        let u = js_sign(if truthy(self.b.width) { self.b.width } else { self.b.total_width });
        if s < u * self.b.negative_space_max {
            if l.abs() > 0.5 * self.b.height {
                self.append_eol();
                return true;
            }
            self.reset_last_chars();
            self.flush();
            return true;
        }
        let d = self.st.rise - self.b.prev_text_rise;
        let f = if d == 0.0 { l } else { l - t[3] / self.st.font_size * d };
        if f.abs() > self.b.height {
            self.append_eol();
            return true;
        }
        if s <= u * self.b.not_a_space {
            self.reset_last_chars();
        }
        if s <= u * self.b.tracking_space_min {
            if self.should_add_whitespace() {
                self.reset_last_chars();
                self.flush();
                self.push_whitespace();
            } else {
                self.b.width += s;
            }
        } else if !self.add_fake_spaces(s, u) {
            if self.b.text.is_empty() {
                self.reset_last_chars();
                self.push_whitespace();
            } else {
                self.b.width += s;
            }
        }
        if l.abs() > self.b.height * 0.25 {
            self.flush();
        }
        true
    }

    /// `buildTextContentItem`.
    fn build(&mut self, chars: &[u8], extra: f64) -> Result<(), Abort> {
        let Some(font) = self.st.font.clone() else { return Ok(()) };
        if let Some(te) = &self.te {
            let changed = te.font_size != self.st.font_size
                || (te.font_name != self.st.font_name
                    && match &te.font {
                        Some(tf) => tf.name != font.name || tf.vertical != font.vertical,
                        None if font.name.is_some() => true,
                        None => return Err(Abort),
                    });
            if changed {
                self.flush();
                self.te = Some(self.st.clone());
            }
        }
        let vertical = font.vertical;
        let r = if vertical { -self.st.char_spacing } else { self.st.char_spacing };
        if chars.is_empty() {
            let e = r + extra;
            if truthy(e) {
                if vertical {
                    self.st.translate_tm(0.0, -e);
                } else {
                    self.st.translate_tm(e * self.st.h_scale, 0.0);
                }
            }
            return Ok(());
        }
        let glyphs = font.glyphs(chars);
        let a = self.st.font_matrix[0] * self.st.font_size;
        let count = glyphs.len();
        for (index, g) in glyphs.into_iter().enumerate() {
            let cat = category(&g.unicode);
            if cat == Category::FormatMark {
                continue;
            }
            let mut l = r + if index + 1 == count { extra } else { 0.0 };
            let mut u = (if vertical { g.vmetric } else { g.width }) * a;
            if g.is_space {
                l += self.st.word_spacing;
            }
            if cat == Category::Whitespace {
                if vertical {
                    l += -u;
                    self.st.translate_tm(0.0, -l);
                } else {
                    l += u;
                    self.st.translate_tm(l * self.st.h_scale, 0.0);
                }
                self.save_last_char(" ");
                continue;
            }
            if cat != Category::Diacritic && !self.compare_with_last_position(u) {
                if vertical {
                    self.st.translate_tm(0.0, u);
                } else {
                    self.st.translate_tm(u * self.st.h_scale, 0.0);
                }
                continue;
            }
            self.ensure_item();
            if cat == Category::Diacritic {
                u = 0.0;
            }
            if vertical {
                self.st.translate_tm(0.0, u);
                u = u.abs();
                self.b.height += u;
            } else {
                u *= self.st.h_scale;
                self.st.translate_tm(u, 0.0);
                self.b.width += u;
            }
            if truthy(u) {
                self.b.prev_transform = Some(self.current_transform());
                self.b.prev_text_rise = self.st.rise;
            }
            if self.save_last_char(&g.unicode) {
                self.b.text.push(" ".into());
            }
            self.b.text.push(g.unicode);
            if truthy(l) {
                if vertical {
                    self.st.translate_tm(0.0, -l);
                } else {
                    self.st.translate_tm(l * self.st.h_scale, 0.0);
                }
            }
        }
        Ok(())
    }

    fn set_font(&mut self, font: Rc<Font>) {
        self.st.font_matrix = font.font_matrix.unwrap_or(FONT_IDENTITY);
        self.st.font = Some(font);
    }

    fn resource(&self, kind: &[u8], name: &[u8]) -> Option<&'d Object> {
        let doc = self.ex.doc;
        let group = get(doc, self.resources?, kind).and_then(|o| as_dict(doc, o))?;
        group.get(name).ok()
    }

    /// `getTextContent`'s loop; errors end it, keeping what was read.
    fn run(mut self, content: &[u8], refs: &mut Vec<ObjectId>) {
        let _ = self.operations(content, refs);
        self.flush();
    }

    fn operations(&mut self, content: &[u8], refs: &mut Vec<ObjectId>) -> Result<(), Abort> {
        let mut ops = Operations::new(content);
        loop {
            let Ok(Some((cmd, args))) = ops.read() else { return Ok(()) };
            let n = |i: usize| args.get(i).map_or(f64::NAN, Obj::num);
            match cmd.as_slice() {
                b"q" => self.stack.push(self.st.clone()),
                b"Q" => {
                    if let Some(s) = self.stack.pop() {
                        self.st = s;
                    }
                }
                b"cm" => self.st.ctm = mul(&self.st.ctm, &[n(0), n(1), n(2), n(3), n(4), n(5)]),
                _ => {}
            }
            if self.te.is_none() {
                self.te = Some(self.st.clone());
            }
            match cmd.as_slice() {
                b"Tf" => {
                    let name = match &args[0] {
                        Obj::Name(name) => Some(name.clone()),
                        _ => None,
                    };
                    let size = n(1);
                    if self.st.font.is_some() && name == self.st.font_name && size == self.st.font_size {
                        continue;
                    }
                    let entry = name.as_deref().and_then(|name| self.resource(b"Font", name));
                    self.st.font_name = name;
                    self.st.font_size = size;
                    let font = self.ex.font(entry);
                    self.set_font(font);
                }
                b"Ts" => self.st.rise = n(0),
                b"Tz" => self.st.h_scale = n(0) / 100.0,
                b"TL" => self.st.leading = n(0),
                b"Td" => {
                    self.st.translate_tlm(n(0), n(1));
                    self.st.tm = self.st.tlm;
                }
                b"TD" => {
                    self.st.leading = -n(1);
                    self.st.translate_tlm(n(0), n(1));
                    self.st.tm = self.st.tlm;
                }
                b"T*" => self.st.carriage_return(),
                b"Tm" => {
                    let m = [n(0), n(1), n(2), n(3), n(4), n(5)];
                    self.st.tm = m;
                    self.st.tlm = m;
                    self.update_advance_scale();
                }
                b"Tc" => self.st.char_spacing = n(0),
                b"Tw" => self.st.word_spacing = n(0),
                b"BT" => {
                    self.st.tm = IDENTITY;
                    self.st.tlm = IDENTITY;
                }
                b"TJ" => {
                    if self.st.font.is_none() {
                        continue;
                    }
                    let f = (if self.st.vertical() { 1.0 } else { -1.0 }) * self.st.font_size / 1000.0;
                    let items = match &args[0] {
                        Obj::Arr(items) => items.clone(),
                        Obj::Str(_) => vec![args[0].clone()],
                        _ => return Err(Abort),
                    };
                    let mut chars = vec![];
                    for item in items {
                        match item {
                            Obj::Str(s) => chars.extend(s),
                            Obj::Num(v) if v != 0.0 => {
                                self.build(&chars, v * f)?;
                                chars.clear();
                            }
                            _ => {}
                        }
                    }
                    if !chars.is_empty() {
                        self.build(&chars, 0.0)?;
                    }
                }
                b"Tj" | b"'" | b"\"" => {
                    if self.st.font.is_none() {
                        continue;
                    }
                    if cmd == b"\"" {
                        self.st.word_spacing = n(0);
                        self.st.char_spacing = n(1);
                    }
                    if cmd != b"Tj" {
                        self.st.carriage_return();
                    }
                    if let Some(Obj::Str(s)) = args.last() {
                        self.build(s, 0.0)?;
                    }
                }
                b"Do" => {
                    self.flush();
                    if let Obj::Name(name) = &args[0] {
                        self.form(name, refs);
                    }
                }
                b"gs" => {
                    if let Obj::Name(name) = &args[0] {
                        self.graphics_state(name);
                    }
                }
                b"BMC" | b"BDC" | b"EMC" => self.flush(),
                _ => {}
            }
        }
    }

    fn graphics_state(&mut self, name: &[u8]) {
        let doc = self.ex.doc;
        let Some(gs) = self.resource(b"ExtGState", name).and_then(|o| as_dict(doc, o)) else { return };
        let Some(font) = get(doc, gs, b"Font").and_then(|o| array(doc, o)) else { return };
        self.flush();
        self.st.font_name = None;
        self.st.font_size = font.get(1).and_then(|o| num(deref(doc, o))).unwrap_or(f64::NAN);
        let font = self.ex.font(font.first());
        self.set_font(font);
    }

    /// A form XObject: its text, read with a copy of the state, in a run of its own.
    fn form(&mut self, name: &[u8], refs: &mut Vec<ObjectId>) {
        let doc = self.ex.doc;
        let Some(raw) = self.resource(b"XObject", name) else { return };
        let id = match raw {
            Object::Reference(id) => Some(*id),
            _ => None,
        };
        let Object::Stream(stream) = deref(doc, raw) else { return };
        if get(doc, &stream.dict, b"Subtype").and_then(as_name).as_deref() != Some(b"Form") {
            return;
        }
        if id.is_some_and(|id| refs.contains(&id)) {
            return;
        }
        let mut st = self.st.clone();
        if let Some(m) = get(doc, &stream.dict, b"Matrix").and_then(|o| array(doc, o)) {
            let v: Vec<f64> = m.iter().filter_map(|o| num(deref(doc, o))).collect();
            if v.len() == 6 && m.len() == 6 {
                st.ctm = mul(&st.ctm, &[v[0], v[1], v[2], v[3], v[4], v[5]]);
            }
        }
        let resources = get(doc, &stream.dict, b"Resources").and_then(|o| as_dict(doc, o)).or(self.resources);
        let content = stream_bytes(doc, raw).unwrap_or_default();
        if let Some(id) = id {
            refs.push(id);
        }
        Run::new(self.ex, resources, st).run(&content, refs);
        if id.is_some() {
            refs.pop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A one-page PDF around a content stream, with a Helvetica (WinAnsi) font `F1`.
    fn pdf(content: &str) -> Vec<u8> {
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>".to_string(),
            format!("<< /Length {} >>\nstream\n{content}\nendstream", content.len()),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>".to_string(),
        ];
        let mut out = b"%PDF-1.4\n".to_vec();
        let mut offsets = vec![];
        for (i, o) in objects.iter().enumerate() {
            offsets.push(out.len());
            out.extend(format!("{} 0 obj\n{o}\nendobj\n", i + 1).bytes());
        }
        let xref = out.len();
        out.extend(format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).bytes());
        for o in offsets {
            out.extend(format!("{o:010} 00000 n \n").bytes());
        }
        out.extend(format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n", objects.len() + 1).bytes());
        out
    }

    #[test]
    fn lines_words_and_kerning() {
        let text = pdf_pages(&pdf(
            "BT /F1 12 Tf 72 700 Td (Chiffre d'affaires) Tj 0 -14 Td [(Bon)-30(jour)] TJ ( le) Tj [(mo)-3000(nde)] TJ ET",
        ))
        .unwrap()
        .join("");
        // unpdf gives the same: « ( le) » only moves the pen, a wide kerning gap is a space.
        assert_eq!(text, "Chiffre d'affaires\nBonjour lemo nde");
    }

    #[test]
    fn unreadable_files_are_none() {
        assert!(pdf_pages(b"not a pdf").is_none());
    }

    #[test]
    fn ligatures_are_decomposed() {
        assert_eq!(normalize_unicode("\u{fb01}n \u{fb05}"), "fin \u{17f}t");
    }
}
