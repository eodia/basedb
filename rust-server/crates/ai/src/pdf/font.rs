//! Les polices d'un PDF, comme pdf.js les lit pour en extraire le texte : codes → caractères
//! (ToUnicode, encodages, liste de glyphes Adobe), largeurs, CMap des polices composites.

use std::collections::{BTreeMap, HashMap};

use lopdf::{Dictionary, Document, Object};

use super::lexer::{Lexer, Obj};
use super::tables::{self, Metrics};
use super::{array, as_dict, as_name, deref, get, num, stream_bytes};

const SYMBOLIC: i64 = 4;
const NONSYMBOLIC: i64 = 32;

/// Which built-in encoding a font uses (compared by identity, as pdf.js does).
#[derive(Clone, Copy, PartialEq, Eq)]
enum Enc {
    Standard,
    WinAnsi,
    MacRoman,
    Symbol,
    ZapfDingbats,
    Expert,
    MacExpert,
}

impl Enc {
    fn by_name(name: &str) -> Option<Enc> {
        Some(match name {
            "WinAnsiEncoding" => Enc::WinAnsi,
            "StandardEncoding" => Enc::Standard,
            "MacRomanEncoding" => Enc::MacRoman,
            "SymbolSetEncoding" => Enc::Symbol,
            "ZapfDingbatsEncoding" => Enc::ZapfDingbats,
            "ExpertEncoding" => Enc::Expert,
            "MacExpertEncoding" => Enc::MacExpert,
            _ => return None,
        })
    }

    fn table(self) -> &'static [&'static str; 256] {
        match self {
            Enc::Standard => &tables::STANDARD,
            Enc::WinAnsi => &tables::WIN_ANSI,
            Enc::MacRoman => &tables::MAC_ROMAN,
            Enc::Symbol => &tables::SYMBOL,
            Enc::ZapfDingbats => &tables::ZAPF_DINGBATS,
            Enc::Expert => &tables::EXPERT,
            Enc::MacExpert => &tables::MAC_EXPERT,
        }
    }
}

fn glyph_unicode(name: &str) -> Option<u32> {
    tables::GLYPHS.binary_search_by(|(k, _)| (*k).cmp(name)).ok().map(|i| tables::GLYPHS[i].1)
}

fn sorted_has(list: &[&str], name: &str) -> bool {
    list.binary_search(&name).is_ok()
}

fn std_font(name: &str) -> Option<&'static str> {
    tables::STD_FONT_MAP.binary_search_by(|(k, _)| (*k).cmp(name)).ok().map(|i| tables::STD_FONT_MAP[i].1)
}

fn metrics(name: &str) -> Option<&'static Metrics> {
    tables::METRICS.binary_search_by(|(k, _)| (*k).cmp(name)).ok().map(|i| &tables::METRICS[i].1)
}

/// `String.fromCharCode`: a UTF-16 code unit (a lone surrogate becomes U+FFFD).
pub(crate) fn from_char_code(code: u32) -> String {
    char::from_u32(code & 0xffff).unwrap_or('\u{fffd}').to_string()
}

/// `parseInt(s, 16)`: the leading hexadecimal digits, if any.
fn parse_hex_prefix(s: &str) -> Option<u32> {
    let digits: String = s.trim_start().chars().take_while(char::is_ascii_hexdigit).collect();
    if digits.is_empty() {
        return None;
    }
    u64::from_str_radix(&digits[..digits.len().min(15)], 16).ok().map(|v| v.min(u32::MAX as u64) as u32)
}

/// `getUnicodeForGlyph`: the glyph list, then `uniXXXX` / `uXXXX[XX]`.
fn unicode_for_glyph(name: &str) -> Option<u32> {
    if let Some(u) = glyph_unicode(name) {
        return Some(u);
    }
    if !name.starts_with('u') {
        return None;
    }
    let len = name.len();
    let rest = if len == 7 && name.starts_with("uni") {
        &name[3..]
    } else if (5..=7).contains(&len) {
        &name[1..]
    } else {
        return None;
    };
    if rest != rest.to_uppercase() {
        return None;
    }
    parse_hex_prefix(rest)
}

/// `normalizeFontName`.
fn normalize_font_name(name: &str) -> String {
    name.chars().filter(|c| !c.is_whitespace()).map(|c| if c == ',' || c == '_' { '-' } else { c }).collect()
}

fn is_serif_font(name: &str) -> bool {
    let first = name.split('-').next().unwrap_or("");
    sorted_has(tables::SERIF_FONTS, first) || first.to_lowercase().contains("serif")
}

fn is_known_font_name(name: &str) -> bool {
    let n = normalize_font_name(name);
    std_font(&n).is_some() || sorted_has(tables::SERIF_FONTS, &n) || sorted_has(tables::SYMBOLS_FONTS, &n)
}

/// `getBaseFontMetrics`: (default width, per-glyph widths).
fn base_font_metrics(name: &str) -> (f64, Option<&'static [(&'static str, f64)]>, bool) {
    let n = normalize_font_name(name);
    let n = std_font(&n).map(str::to_string).unwrap_or(n);
    let m = metrics(&n).or_else(|| metrics(if is_serif_font(name) { "Times-Roman" } else { "Helvetica" }));
    match m {
        Some(Metrics::Fixed(w)) => (*w, None, true),
        Some(Metrics::Table(t)) => (0.0, Some(t), false),
        None => (0.0, None, false),
    }
}

fn metric_width(table: Option<&[(&str, f64)]>, glyph: &str) -> Option<f64> {
    let t = table?;
    t.binary_search_by(|(k, _)| (*k).cmp(glyph)).ok().map(|i| t[i].1)
}

/// A value of a CMap: a CID or a destination string (bytes).
#[derive(Clone)]
pub(crate) enum CVal {
    Num(u32),
    Str(Vec<u8>),
}

/// A CMap: the encoding of a composite font, or a ToUnicode map.
#[derive(Default)]
pub(crate) struct CMap {
    codespace: [Vec<(u32, u32)>; 4],
    map: HashMap<u32, CVal>,
    pub vertical: bool,
    identity: bool,
}

impl CMap {
    fn identity(vertical: bool) -> CMap {
        let mut c = CMap { vertical, identity: true, ..CMap::default() };
        c.codespace[1].push((0, 0xffff));
        c
    }

    /// `readCharCode`: the code at `offset` and its length in bytes.
    fn read_char_code(&self, bytes: &[u8], offset: usize) -> (u32, usize) {
        let mut c: u32 = 0;
        for (n, ranges) in self.codespace.iter().enumerate() {
            c = (c << 8) | bytes.get(offset + n).copied().unwrap_or(0) as u32;
            if ranges.iter().any(|&(lo, hi)| c >= lo && c <= hi) {
                return (c, n + 1);
            }
        }
        (0, 1)
    }

    fn lookup(&self, code: u32) -> Option<CVal> {
        if self.identity {
            return (code <= 0xffff).then_some(CVal::Num(code));
        }
        self.map.get(&code).cloned()
    }
}

/// `strToInt`.
fn str_to_int(s: &[u8]) -> u32 {
    s.iter().fold(0u32, |a, &b| (a << 8) | b as u32)
}

fn incr_last_byte(mut dst: Vec<u8>) -> Vec<u8> {
    let last = dst.len() - 1;
    if dst[last] == 0xff {
        if last >= 1 {
            dst[last - 1] = dst[last - 1].wrapping_add(1);
        }
        dst[last] = 0;
    } else {
        dst[last] += 1;
    }
    dst
}

/// `parseCMap`: an embedded CMap (encoding or ToUnicode). `None` when it uses another CMap by name.
pub(crate) fn parse_cmap(data: &[u8]) -> CMap {
    let mut cmap = CMap::default();
    let mut lex = Lexer::new(data, false);
    let mut previous: Option<Obj> = None;
    const MAX_RANGE: u32 = (1 << 24) - 1;
    'objects: while let Ok(Some(obj)) = lex.obj() {
        match obj {
            Obj::Name(ref n) if n == b"WMode" => {
                if let Ok(Some(Obj::Num(v))) = lex.obj() {
                    cmap.vertical = v == 1.0;
                }
            }
            Obj::Cmd(ref c) => {
                let section = c.as_slice();
                let end: &[u8] = match section {
                    b"endcmap" => break 'objects,
                    b"begincodespacerange" => b"endcodespacerange",
                    b"beginbfchar" => b"endbfchar",
                    b"beginbfrange" => b"endbfrange",
                    b"begincidchar" => b"endcidchar",
                    b"begincidrange" => b"endcidrange",
                    _ => {
                        previous = Some(obj.clone());
                        continue;
                    }
                };
                let mut items = vec![];
                loop {
                    match lex.obj() {
                        Ok(Some(Obj::Cmd(c))) if c == end => break,
                        Ok(Some(o)) => items.push(o),
                        _ => break 'objects,
                    }
                }
                match section {
                    b"begincodespacerange" => {
                        for pair in items.chunks(2) {
                            if let [Obj::Str(lo), Obj::Str(hi)] = pair {
                                let n = hi.len();
                                if (1..=4).contains(&n) {
                                    cmap.codespace[n - 1].push((str_to_int(lo), str_to_int(hi)));
                                }
                            } else {
                                break;
                            }
                        }
                    }
                    b"beginbfchar" => {
                        for pair in items.chunks(2) {
                            match pair {
                                [Obj::Str(src), Obj::Str(dst)] => {
                                    cmap.map.insert(str_to_int(src), CVal::Str(dst.clone()));
                                }
                                [Obj::Str(src), Obj::Num(dst)] => {
                                    cmap.map.insert(str_to_int(src), CVal::Num(*dst as u32));
                                }
                                _ => break,
                            }
                        }
                    }
                    b"beginbfrange" => {
                        for triple in items.chunks(3) {
                            let [Obj::Str(lo), Obj::Str(hi), dst] = triple else { break };
                            let (mut lo, hi) = (str_to_int(lo), str_to_int(hi));
                            if hi.saturating_sub(lo) > MAX_RANGE {
                                break;
                            }
                            match dst {
                                Obj::Str(d) if !d.is_empty() => {
                                    let mut d = d.clone();
                                    while lo <= hi {
                                        cmap.map.insert(lo, CVal::Str(d.clone()));
                                        d = incr_last_byte(d);
                                        lo += 1;
                                    }
                                }
                                Obj::Num(d) if *d >= 0.0 && *d < 256.0 => {
                                    let mut d = vec![*d as u8];
                                    while lo <= hi {
                                        cmap.map.insert(lo, CVal::Str(d.clone()));
                                        d = incr_last_byte(d);
                                        lo += 1;
                                    }
                                }
                                Obj::Arr(a) => {
                                    for v in a {
                                        if lo > hi {
                                            break;
                                        }
                                        if let Obj::Str(s) = v {
                                            cmap.map.insert(lo, CVal::Str(s.clone()));
                                        }
                                        lo += 1;
                                    }
                                }
                                _ => break,
                            }
                        }
                    }
                    b"begincidchar" => {
                        for pair in items.chunks(2) {
                            let [Obj::Str(src), Obj::Num(dst)] = pair else { break };
                            cmap.map.insert(str_to_int(src), CVal::Num(*dst as u32));
                        }
                    }
                    _ => {
                        for triple in items.chunks(3) {
                            let [Obj::Str(lo), Obj::Str(hi), Obj::Num(dst)] = triple else { break };
                            let (mut lo, hi, mut dst) = (str_to_int(lo), str_to_int(hi), *dst as u32);
                            if hi.saturating_sub(lo) > MAX_RANGE {
                                break;
                            }
                            while lo <= hi {
                                cmap.map.insert(lo, CVal::Num(dst));
                                lo += 1;
                                dst += 1;
                            }
                        }
                    }
                }
            }
            _ => previous = Some(obj),
        }
    }
    let _ = previous;
    cmap
}

/// A font's map from codes to text.
pub(crate) enum ToUnicode {
    Identity(u32, u32),
    Map(HashMap<u32, String>),
}

impl ToUnicode {
    fn get(&self, code: u32) -> Option<String> {
        match self {
            ToUnicode::Identity(a, b) => (*a <= code && code <= *b).then(|| from_char_code(code)),
            ToUnicode::Map(m) => m.get(&code).cloned(),
        }
    }

    fn has(&self, code: u32) -> bool {
        match self {
            ToUnicode::Identity(a, b) => *a <= code && code <= *b,
            ToUnicode::Map(m) => m.contains_key(&code),
        }
    }

    fn size(&self) -> usize {
        match self {
            ToUnicode::Identity(a, b) => (*b + 1).saturating_sub(*a) as usize,
            ToUnicode::Map(m) => m.len(),
        }
    }
}

/// UTF-16BE bytes (an odd length gets a leading zero byte) to text, surrogate pairs joined.
fn utf16_text(bytes: &[u8]) -> String {
    let mut b = bytes.to_vec();
    if !b.len().is_multiple_of(2) {
        b.insert(0, 0);
    }
    let mut out = String::new();
    let mut i = 0;
    while i + 1 < b.len() {
        let n = (b[i] as u32) << 8 | b[i + 1] as u32;
        if n & 0xf800 != 0xd800 {
            out.push(char::from_u32(n).unwrap_or('\u{fffd}'));
            i += 2;
            continue;
        }
        i += 2;
        let lo = if i + 1 < b.len() { (b[i] as u32) << 8 | b[i + 1] as u32 } else { 0 };
        out.push(char::from_u32(((n & 0x3ff) << 10) + (lo & 0x3ff) + 0x10000).unwrap_or('\u{fffd}'));
        i += 2;
    }
    out
}

/// `readToUnicode`.
fn read_to_unicode(doc: &Document, obj: Option<&Object>) -> Result<Option<ToUnicode>, ()> {
    let Some(obj) = obj else { return Ok(None) };
    if let Some(name) = as_name(obj) {
        return match name.as_slice() {
            b"Identity-H" | b"Identity-V" => Ok(Some(ToUnicode::Identity(0, 65535))),
            _ => Err(()),
        };
    }
    let Some(data) = stream_bytes(doc, obj) else { return Ok(None) };
    let cmap = parse_cmap(&data);
    let mut map = HashMap::new();
    for (code, v) in cmap.map {
        let text = match v {
            CVal::Num(n) => char::from_u32(n).map(String::from).unwrap_or_default(),
            CVal::Str(s) => utf16_text(&s),
        };
        map.insert(code, text);
    }
    Ok(Some(ToUnicode::Map(map)))
}

/// A glyph of a shown string.
pub(crate) struct Glyph {
    pub unicode: String,
    pub width: f64,
    pub vmetric: f64,
    pub is_space: bool,
}

/// A loaded font: what text extraction needs of it.
pub(crate) struct Font {
    /// `None` for pdf.js's `ErrorFont`, which shows no glyph.
    pub name: Option<String>,
    pub vertical: bool,
    pub type3: bool,
    pub font_matrix: Option<[f64; 6]>,
    pub bbox: Option<[f64; 4]>,
    error: bool,
    missing_type1: bool,
    cmap: Option<CMap>,
    to_unicode: ToUnicode,
    widths: HashMap<u32, f64>,
    default_width: f64,
    vmetrics: HashMap<u32, f64>,
    default_vmetric: f64,
    encoding: Vec<String>,
}

impl Font {
    pub fn error() -> Font {
        Font {
            name: None,
            vertical: false,
            type3: false,
            font_matrix: None,
            bbox: None,
            error: true,
            missing_type1: false,
            cmap: None,
            to_unicode: ToUnicode::Map(HashMap::new()),
            widths: HashMap::new(),
            default_width: 0.0,
            vmetrics: HashMap::new(),
            default_vmetric: 0.0,
            encoding: vec![],
        }
    }

    /// `charsToGlyphs`.
    pub fn glyphs(&self, chars: &[u8]) -> Vec<Glyph> {
        if self.error {
            return vec![];
        }
        let mut out = vec![];
        if let Some(cmap) = &self.cmap {
            let mut i = 0;
            while i < chars.len() {
                let (code, len) = cmap.read_char_code(chars, i);
                i += len;
                out.push(self.glyph(code, len == 1 && chars.get(i - 1) == Some(&32)));
            }
        } else {
            for &b in chars {
                out.push(self.glyph(b as u32, b == 32));
            }
        }
        out
    }

    fn glyph(&self, code: u32, is_space: bool) -> Glyph {
        let cid = match &self.cmap {
            Some(cmap) => match cmap.lookup(code) {
                Some(CVal::Num(n)) => Some(n),
                Some(CVal::Str(s)) => match s.len() {
                    1 => Some(s[0] as u32),
                    2 => Some((s[0] as u32) << 8 | s[1] as u32),
                    _ => None,
                },
                None => Some(code),
            },
            None => Some(code),
        };
        let width = cid.and_then(|c| self.widths.get(&c).copied()).unwrap_or(self.default_width);
        let vmetric = cid.and_then(|c| self.vmetrics.get(&c).copied()).unwrap_or(self.default_vmetric);
        let mut unicode = self.to_unicode.get(code).filter(|s| !s.is_empty()).unwrap_or_else(|| from_char_code(code));
        if self.missing_type1 && code < 256 && self.encoding.get(code as usize).is_some_and(String::is_empty) && !self.to_unicode.has(code) {
            unicode = " ".into();
        }
        Glyph { unicode, width, vmetric, is_space }
    }
}

fn pdf_string(o: &Object) -> Option<String> {
    match o {
        Object::Name(n) => Some(n.iter().map(|&b| b as char).collect()),
        Object::String(s, _) => Some(s.iter().map(|&b| b as char).collect()),
        _ => None,
    }
}

fn integer(o: Option<&Object>) -> Option<i64> {
    num(o?).filter(|v| v.fract() == 0.0).map(|v| v as i64)
}

/// The properties `extractDataStructures` builds.
struct Props {
    name: String,
    kind: String,
    composite: bool,
    embedded: bool,
    flags: i64,
    first_char: u32,
    last_char: u32,
    differences: BTreeMap<u32, String>,
    base_encoding: Option<Enc>,
    default_encoding: Enc,
    has_encoding: bool,
}

impl Props {
    /// The glyph names `differences.get(code) || defaultEncoding[code]`.
    fn names(&self) -> Vec<String> {
        let mut names: Vec<String> = self.default_encoding.table().iter().map(|s| s.to_string()).collect();
        for (&code, name) in &self.differences {
            if !name.is_empty() && (code as usize) < names.len() {
                names[code as usize] = name.clone();
            }
        }
        names
    }
}

/// `extractDataStructures`'s encoding part.
fn encoding_of(doc: &Document, dict: &Dictionary, p: &mut Props) -> Result<(), ()> {
    let mut base: Option<String> = None;
    if let Some(enc) = get(doc, dict, b"Encoding") {
        if let Some(d) = as_dict(doc, enc) {
            base = get(doc, d, b"BaseEncoding").and_then(as_name).map(|n| String::from_utf8_lossy(&n).into_owned());
            if let Some(diffs) = get(doc, d, b"Differences").and_then(|o| array(doc, o)) {
                let mut code = 0u32;
                for item in diffs {
                    let item = deref(doc, item);
                    if let Some(n) = num(item) {
                        code = n as u32;
                    } else if let Some(name) = as_name(item) {
                        p.differences.insert(code, String::from_utf8_lossy(&name).into_owned());
                        code += 1;
                    } else {
                        return Err(());
                    }
                }
            }
        } else if let Some(n) = as_name(enc) {
            base = Some(String::from_utf8_lossy(&n).into_owned());
        }
        if !matches!(base.as_deref(), Some("MacRomanEncoding" | "MacExpertEncoding" | "WinAnsiEncoding")) {
            base = None;
        }
    }
    let non_embedded = !p.embedded;
    let symbols_font = sorted_has(tables::SYMBOLS_FONTS, &p.name);
    if base.is_some() && non_embedded && symbols_font {
        base = None;
    }
    p.base_encoding = base.as_deref().and_then(Enc::by_name);
    p.default_encoding = match p.base_encoding {
        Some(e) => e,
        None => {
            let mut symbolic = p.flags & SYMBOLIC != 0;
            let nonsymbolic = p.flags & NONSYMBOLIC != 0;
            if p.kind == "TrueType" && symbolic && nonsymbolic && !p.differences.is_empty() {
                p.flags &= !SYMBOLIC;
                symbolic = false;
            }
            let mut e = Enc::Standard;
            if p.kind == "TrueType" && !nonsymbolic {
                e = Enc::WinAnsi;
            }
            if symbolic || symbols_font {
                e = Enc::MacRoman;
                if non_embedded {
                    let lower = p.name.to_lowercase();
                    if lower.contains("symbol") {
                        e = Enc::Symbol;
                    } else if lower.contains("dingbats") {
                        e = Enc::ZapfDingbats;
                    } else if lower.contains("wingdings") {
                        e = Enc::WinAnsi;
                    }
                }
            }
            e
        }
    };
    p.has_encoding = p.base_encoding.is_some() || !p.differences.is_empty();
    Ok(())
}

/// `_simpleFontToUnicode`.
fn simple_font_to_unicode(p: &Props, force_hex: bool) -> HashMap<u32, String> {
    let mut out = HashMap::new();
    let mut names: Vec<String> = p.default_encoding.table().iter().map(|s| s.to_string()).collect();
    for (&code, name) in &p.differences {
        if name != ".notdef" {
            let i = code as usize;
            if i >= names.len() {
                names.resize(i + 1, String::new());
            }
            names[i] = name.clone();
        }
    }
    for (code, name) in names.iter().enumerate() {
        let code = code as u32;
        if name.is_empty() {
            continue;
        }
        if let Some(u) = glyph_unicode(name) {
            out.insert(code, from_char_code(u));
            continue;
        }
        let mut value: f64 = 0.0;
        let first = name.as_bytes()[0];
        match first {
            b'G' if name.len() == 3 => value = parse_hex_prefix(&name[1..]).map_or(f64::NAN, f64::from),
            b'g' if name.len() == 5 => value = parse_hex_prefix(&name[1..]).map_or(f64::NAN, f64::from),
            b'C' | b'c' if (3..=4).contains(&name.len()) => {
                let rest = &name[1..];
                if force_hex {
                    value = parse_hex_prefix(rest).map_or(f64::NAN, f64::from);
                } else {
                    value = js_number(rest);
                    if value.is_nan() && parse_hex_prefix(rest).is_some() {
                        return simple_font_to_unicode(p, true);
                    }
                }
            }
            b'u' => {
                if let Some(u) = unicode_for_glyph(name) {
                    value = u as f64;
                }
            }
            _ => {
                if matches!(name.as_str(), "f_h" | "f_t" | "T_h") {
                    out.insert(code, name.replace('_', ""));
                    continue;
                }
            }
        }
        if value > 0.0 && value <= 1_114_111.0 && value.fract() == 0.0 {
            if let Some(base) = p.base_encoding {
                if value as u32 == code {
                    let n = base.table()[code as usize % 256];
                    if !n.is_empty() {
                        out.insert(code, from_char_code(glyph_unicode(n).unwrap_or(0)));
                        continue;
                    }
                }
            }
            out.insert(code, char::from_u32(value as u32).map(String::from).unwrap_or_else(|| "\u{fffd}".into()));
        }
    }
    out
}

/// JavaScript's `Number(s)` for the decimal forms a glyph name may hold.
fn js_number(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() {
        return 0.0;
    }
    if t.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | 'e' | 'E' | '+' | '-')) {
        t.parse().unwrap_or(f64::NAN)
    } else {
        f64::NAN
    }
}

/// The glyph names of an embedded Type 1 font's built-in encoding (its clear-text header).
fn type1_builtin_encoding(data: &[u8]) -> Option<Result<Enc, BTreeMap<u32, String>>> {
    let end = data.windows(5).position(|w| w == b"eexec").unwrap_or(data.len());
    let head = &data[..end];
    let mut pos = 0;
    let special = |c: u8| matches!(c, b'/' | b'[' | b']' | b'{' | b'}' | b'(' | b')');
    let white = |c: u8| matches!(c, 0 | 9 | 10 | 12 | 13 | 32);
    let mut token = || -> Option<String> {
        let mut comment = false;
        loop {
            let c = *head.get(pos)?;
            if comment {
                if c == 10 || c == 13 {
                    comment = false;
                }
            } else if c == b'%' {
                comment = true;
            } else if !white(c) {
                break;
            }
            pos += 1;
        }
        let c = head[pos];
        pos += 1;
        if special(c) {
            return Some((c as char).to_string());
        }
        let mut t = vec![c];
        while let Some(&c) = head.get(pos) {
            if white(c) || special(c) {
                break;
            }
            t.push(c);
            pos += 1;
        }
        Some(String::from_utf8_lossy(&t).into_owned())
    };
    loop {
        let t = token()?;
        if t != "/" {
            continue;
        }
        if token()? != "Encoding" {
            continue;
        }
        let arg = token()?;
        if !arg.bytes().all(|b| b.is_ascii_digit()) || arg.is_empty() {
            return Enc::by_name(&arg).map(Ok);
        }
        let size: usize = arg.parse().unwrap_or(0);
        let mut enc = BTreeMap::new();
        token();
        for _ in 0..size {
            let mut t = token()?;
            while t != "dup" && t != "def" {
                t = token()?;
            }
            if t == "def" {
                break;
            }
            let index: u32 = token()?.parse().unwrap_or(0);
            token();
            let glyph = token()?;
            enc.insert(index, glyph);
            token();
        }
        return Some(Err(enc));
    }
}

/// `loadFont` + `translateFont`, for a font dictionary.
pub(crate) fn load_font(doc: &Document, base: &Dictionary) -> Font {
    translate(doc, base).unwrap_or_else(|()| Font::error())
}

/// pdf.js's fallback font, used when a font resource is missing.
pub(crate) fn fallback_font() -> Font {
    let mut d = Dictionary::new();
    d.set("BaseFont", Object::Name(b"Helvetica".to_vec()));
    d.set("Type", Object::Name(b"FallbackType".to_vec()));
    d.set("Subtype", Object::Name(b"FallbackType".to_vec()));
    d.set("Encoding", Object::Name(b"WinAnsiEncoding".to_vec()));
    load_font(&Document::new(), &d)
}

fn matrix_of(doc: &Document, o: Option<&Object>) -> Option<[f64; 6]> {
    let a = array(doc, o?)?;
    if a.len() != 6 {
        return None;
    }
    let mut m = [0.0; 6];
    for (i, v) in a.iter().enumerate() {
        m[i] = num(deref(doc, v))?;
    }
    Some(m)
}

fn translate(doc: &Document, base: &Dictionary) -> Result<Font, ()> {
    let subtype = get(doc, base, b"Subtype").and_then(as_name).ok_or(())?;
    let composite = subtype == b"Type0";
    let dict: &Dictionary = if composite {
        let d = get(doc, base, b"DescendantFonts").ok_or(())?;
        let first = match array(doc, d) {
            Some(a) => deref(doc, a.first().ok_or(())?),
            None => d,
        };
        as_dict(doc, first).ok_or(())?
    } else {
        base
    };
    let kind = get(doc, dict, b"Subtype").and_then(as_name).ok_or(())?;
    let kind = String::from_utf8_lossy(&kind).into_owned();
    let first_char = integer(get(doc, dict, b"FirstChar")).unwrap_or(0).max(0) as u32;
    let last_char = integer(get(doc, dict, b"LastChar")).unwrap_or(if composite { 65535 } else { 255 }).max(0) as u32;
    let descriptor = get(doc, dict, b"FontDescriptor").and_then(|o| as_dict(doc, o));
    let to_unicode_obj = get(doc, dict, b"ToUnicode").or_else(|| get(doc, base, b"ToUnicode"));
    let type3 = kind == "Type3";
    let empty = Dictionary::new();

    let mut p = Props {
        name: String::new(),
        kind: kind.clone(),
        composite,
        embedded: false,
        flags: 0,
        first_char,
        last_char,
        differences: BTreeMap::new(),
        base_encoding: None,
        default_encoding: Enc::Standard,
        has_encoding: false,
    };
    let mut widths: HashMap<u32, f64> = HashMap::new();
    let default_width;
    let mut font_matrix = None;
    let mut bbox = None;
    let mut missing_file = true;
    let mut file_data: Option<(Vec<u8>, &'static str)> = None;
    let mut cmap: Option<CMap> = None;
    let mut vertical = false;
    let mut vmetrics = HashMap::new();
    let mut default_vmetric = 0.0;
    let mut cid_registry: Option<(String, String)> = None;

    let descriptor = match descriptor {
        Some(d) => Some(d),
        None if type3 || composite => Some(&empty),
        None => None,
    };
    let Some(descriptor) = descriptor else {
        let base_font = get(doc, dict, b"BaseFont").and_then(as_name).ok_or(())?;
        let name = normalize_font_name(&String::from_utf8_lossy(&base_font));
        let (dw, table, monospace) = base_font_metrics(&name);
        let first = name.split('-').next().unwrap_or("");
        p.flags = (if is_serif_font(first) { 2 } else { 0 })
            | (if monospace { 1 } else { 0 })
            | (if sorted_has(tables::SYMBOLS_FONTS, first) { SYMBOLIC } else { NONSYMBOLIC });
        p.name = name;
        encoding_of(doc, dict, &mut p)?;
        let to_unicode = build_to_unicode(doc, &p, to_unicode_obj, None)?;
        if let Some(ws) = get(doc, dict, b"Widths").and_then(|o| array(doc, o)) {
            for (code, w) in (first_char..).zip(ws.iter()) {
                if let Some(w) = num(deref(doc, w)) {
                    widths.insert(code, w);
                }
            }
        } else {
            widths = char_code_widths(table, &p);
        }
        return Ok(Font {
            name: Some(p.name.clone()),
            vertical: false,
            type3: false,
            font_matrix: None,
            bbox: None,
            error: false,
            missing_type1: kind == "Type1",
            cmap: None,
            to_unicode,
            widths,
            default_width: dw,
            vmetrics,
            default_vmetric,
            encoding: p.names(),
        });
    };

    let font_name = get(doc, descriptor, b"FontName").and_then(pdf_string);
    let base_font = get(doc, dict, b"BaseFont").and_then(pdf_string);
    let name = if type3 {
        font_name.or(Some(kind.clone()))
    } else {
        let mut d = font_name.clone();
        if font_name != base_font {
            if let (Some(m), Some(h)) = (&font_name, &base_font) {
                if h.starts_with(m.as_str()) || (!is_known_font_name(m) && is_known_font_name(h)) {
                    d = None;
                }
            }
            d = d.or(base_font);
        }
        d
    };
    p.name = name.ok_or(())?;
    for key in [b"FontFile".as_slice(), b"FontFile2", b"FontFile3"] {
        if let Some(f) = get(doc, descriptor, key) {
            p.embedded = true;
            if let Some(data) = stream_bytes(doc, f).filter(|d| !d.is_empty()) {
                missing_file = false;
                file_data = Some((data, if key == b"FontFile" { "Type1" } else { "other" }));
            }
            break;
        }
    }
    if let Some(m) = matrix_of(doc, get(doc, dict, b"FontMatrix")) {
        font_matrix = Some(m);
    }
    let bbox_obj = get(doc, descriptor, b"FontBBox").or_else(|| get(doc, dict, b"FontBBox"));
    if let Some(a) = bbox_obj.and_then(|o| array(doc, o)).filter(|a| a.len() == 4) {
        let v: Vec<f64> = a.iter().filter_map(|x| num(deref(doc, x))).collect();
        if v.len() == 4 {
            bbox = Some([v[0].min(v[2]), v[1].min(v[3]), v[0].max(v[2]), v[1].max(v[3])]);
        }
    } else if type3 {
        bbox = Some([0.0; 4]);
    }
    p.flags = integer(get(doc, descriptor, b"Flags")).unwrap_or(0);
    if composite {
        let enc = get(doc, base, b"Encoding").ok_or(())?;
        let c = if let Some(n) = as_name(enc) {
            match n.as_slice() {
                b"Identity-H" => CMap::identity(false),
                b"Identity-V" => CMap::identity(true),
                _ => return Err(()),
            }
        } else {
            let data = stream_bytes(doc, enc).ok_or(())?;
            parse_cmap(&data)
        };
        vertical = c.vertical;
        cmap = Some(c);
        if let Some(info) = get(doc, dict, b"CIDSystemInfo").and_then(|o| as_dict(doc, o)) {
            let s = |k: &[u8]| get(doc, info, k).and_then(pdf_string).unwrap_or_default();
            cid_registry = Some((s(b"Registry"), s(b"Ordering")));
        }
    }
    encoding_of(doc, dict, &mut p)?;
    let to_unicode = build_to_unicode(doc, &p, to_unicode_obj, cid_registry.as_ref())?;

    // extractWidths
    if composite {
        default_width = get(doc, dict, b"DW").and_then(num).map(f64::ceil).unwrap_or(1000.0);
        if let Some(w) = get(doc, dict, b"W").and_then(|o| array(doc, o)) {
            let mut i = 0;
            while i < w.len() {
                let Some(start) = num(deref(doc, &w[i])).filter(|v| v.fract() == 0.0) else { break };
                i += 1;
                let Some(next) = w.get(i).map(|o| deref(doc, o)) else { break };
                if let Some(list) = array(doc, next) {
                    for (c, v) in (start as u32..).zip(list.iter()) {
                        if let Some(v) = num(deref(doc, v)) {
                            widths.insert(c, v);
                        }
                    }
                } else if let Some(end) = num(next).filter(|v| v.fract() == 0.0) {
                    i += 1;
                    let Some(v) = w.get(i).and_then(|o| num(deref(doc, o))) else {
                        i += 1;
                        continue;
                    };
                    let mut c = start as i64;
                    while c <= end as i64 {
                        widths.insert(c as u32, v);
                        c += 1;
                    }
                } else {
                    break;
                }
                i += 1;
            }
        }
        if vertical {
            let dw2 = get(doc, dict, b"DW2").and_then(|o| array(doc, o)).and_then(|a| {
                let v: Vec<f64> = a.iter().filter_map(|x| num(deref(doc, x))).collect();
                (v.len() == 2 && a.len() == 2).then(|| (v[0], v[1]))
            });
            default_vmetric = dw2.map_or(-1000.0, |(_, w1)| w1);
            if let Some(w2) = get(doc, dict, b"W2").and_then(|o| array(doc, o)) {
                let mut i = 0;
                while i < w2.len() {
                    let Some(start) = num(deref(doc, &w2[i])).filter(|v| v.fract() == 0.0) else { break };
                    i += 1;
                    let Some(next) = w2.get(i).map(|o| deref(doc, o)) else { break };
                    if let Some(list) = array(doc, next) {
                        for (c, triple) in (start as u32..).zip(list.chunks(3)) {
                            let v: Vec<f64> = triple.iter().filter_map(|x| num(deref(doc, x))).collect();
                            if v.len() == 3 {
                                vmetrics.insert(c, v[0]);
                            }
                        }
                    } else if let Some(end) = num(next).filter(|v| v.fract() == 0.0) {
                        let v: Vec<f64> = (1..=3).filter_map(|k| w2.get(i + k).and_then(|o| num(deref(doc, o)))).collect();
                        i += 3;
                        if v.len() == 3 {
                            let mut c = start as i64;
                            while c <= end as i64 {
                                vmetrics.insert(c as u32, v[0]);
                                c += 1;
                            }
                        }
                    } else {
                        break;
                    }
                    i += 1;
                }
            }
        }
    } else if let Some(ws) = get(doc, dict, b"Widths").and_then(|o| array(doc, o)) {
        for (code, w) in (first_char..).zip(ws.iter()) {
            if let Some(w) = num(deref(doc, w)) {
                widths.insert(code, w);
            }
        }
        default_width = get(doc, descriptor, b"MissingWidth").and_then(num).unwrap_or(0.0);
    } else if let Some(bf) = get(doc, dict, b"BaseFont").and_then(as_name) {
        let (dw, table, _) = base_font_metrics(&String::from_utf8_lossy(&bf));
        widths = char_code_widths(table, &p);
        default_width = dw;
    } else {
        default_width = 0.0;
    }

    let mut to_unicode = to_unicode;
    // adjustType1ToUnicode, for an embedded Type 1 font's built-in encoding.
    let included = to_unicode_obj.is_some() && matches!(read_to_unicode(doc, to_unicode_obj), Ok(Some(ref t)) if t.size() > 0);
    if let (Some((data, "Type1")), false, false) = (&file_data, included, composite) {
        if let Some(builtin) = type1_builtin_encoding(data) {
            let entries: Option<BTreeMap<u32, String>> = match builtin {
                Ok(e) if e == p.default_encoding => None,
                Ok(e) => Some(e.table().iter().enumerate().filter(|(_, n)| !n.is_empty()).map(|(i, n)| (i as u32, n.to_string())).collect()),
                Err(map) => Some(map),
            };
            if let (Some(entries), ToUnicode::Map(map)) = (entries, &mut to_unicode) {
                for (code, glyph) in entries {
                    if p.has_encoding && (p.base_encoding.is_some() || p.differences.contains_key(&code)) {
                        continue;
                    }
                    if let Some(u) = unicode_for_glyph(&glyph) {
                        map.insert(code, from_char_code(u));
                    }
                }
            }
        }
    }

    Ok(Font {
        name: Some(p.name.clone()),
        vertical: !type3 && vertical,
        type3,
        font_matrix,
        bbox,
        error: false,
        missing_type1: missing_file && kind == "Type1",
        cmap,
        to_unicode,
        widths,
        default_width,
        vmetrics,
        default_vmetric,
        encoding: p.names(),
    })
}

/// `buildCharCodeToWidth`.
fn char_code_widths(table: Option<&[(&str, f64)]>, p: &Props) -> HashMap<u32, f64> {
    let mut out = HashMap::new();
    let enc = p.default_encoding.table();
    for code in 0..256u32 {
        let w = p
            .differences
            .get(&code)
            .and_then(|n| metric_width(table, n))
            .filter(|w| *w != 0.0)
            .or_else(|| metric_width(table, enc[code as usize]));
        if let Some(w) = w.filter(|w| *w != 0.0) {
            out.insert(code, w);
        }
    }
    out
}

/// `buildToUnicode` (with `amendFallbackToUnicode`, which Type 3 fonts skip).
fn build_to_unicode(doc: &Document, p: &Props, obj: Option<&Object>, cid: Option<&(String, String)>) -> Result<ToUnicode, ()> {
    let read = read_to_unicode(doc, obj)?;
    if let Some(t) = read.filter(|t| t.size() > 0) {
        let mut t = t;
        if !p.composite && p.has_encoding && p.kind != "Type3" {
            if let ToUnicode::Map(map) = &mut t {
                for (code, u) in simple_font_to_unicode(p, false) {
                    map.entry(code).or_insert(u);
                }
            }
        }
        return Ok(t);
    }
    if !p.composite {
        return Ok(ToUnicode::Map(simple_font_to_unicode(p, false)));
    }
    if let Some((registry, ordering)) = cid {
        if registry == "Adobe" && matches!(ordering.as_str(), "GB1" | "CNS1" | "Japan1" | "Korea1") {
            // pdf.js needs its packed CMaps (`cMapUrl`), which unpdf does not give it: the font fails.
            return Err(());
        }
    }
    Ok(ToUnicode::Identity(p.first_char, p.last_char))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glyph_names_resolve_like_pdfjs() {
        assert_eq!(unicode_for_glyph("eacute"), Some(0xe9));
        assert_eq!(unicode_for_glyph("uni20AC"), Some(0x20ac));
        assert_eq!(unicode_for_glyph("u1F600"), Some(0x1f600));
        assert_eq!(unicode_for_glyph("uni20ac"), None);
        assert_eq!(utf16_text(&[0xd8, 0x3d, 0xde, 0x00]), "\u{1f600}");
        assert_eq!(utf16_text(&[0x41]), "A");
    }

    #[test]
    fn cmaps_map_ranges_and_codespaces() {
        let c = parse_cmap(
            b"1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <41> <43> <0061> endbfrange 1 beginbfchar <20> <0020> endbfchar",
        );
        assert_eq!(c.read_char_code(b"A", 0), (0x41, 1));
        assert!(matches!(c.lookup(0x43), Some(CVal::Str(ref s)) if s == &[0, 0x63]));
        assert!(matches!(c.lookup(0x20), Some(CVal::Str(ref s)) if s == &[0, 0x20]));
    }
}
