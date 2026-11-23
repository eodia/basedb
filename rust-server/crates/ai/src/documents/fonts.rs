//! The faces a document is set in (`fonts.ts`), and how pdfkit measures them: a TrueType or
//! CFF face shaped run after run (`EmbeddedFont.layout`), or one of the PDF's own faces
//! measured by its metrics (`AFMFont`, `afm.json`, read once from Node's pdfkit).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};

use rustybuzz::ttf_parser;
use serde::Deserialize;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct FontFace {
    pub path: PathBuf,
    /// The face's PostScript name, in a collection (`.ttc`) that holds several.
    pub family: Option<String>,
}

#[derive(Clone, Debug)]
pub struct FontStyles {
    pub regular: FontFace,
    pub bold: FontFace,
    pub italic: FontFace,
    pub bold_italic: FontFace,
}

#[derive(Clone, Debug)]
pub struct FontSet {
    pub latin: FontStyles,
    /// For what the Latin face lacks, tried in order: a regular and a bold weight.
    pub fallbacks: Vec<(FontFace, FontFace)>,
    pub serif: Option<FontStyles>,
}

fn exists(p: &Path) -> bool {
    p.is_file()
}

fn latin_in(dir: &Path, names: [&str; 4]) -> Option<FontStyles> {
    let files: Vec<PathBuf> = names.iter().map(|n| dir.join(n)).collect();
    if !files.iter().all(|f| exists(f)) {
        return None;
    }
    let face = |i: usize| FontFace { path: files[i].clone(), family: None };
    Some(FontStyles { regular: face(0), bold: face(1), italic: face(2), bold_italic: face(3) })
}

const NOTO_SERIF: [&str; 4] = ["NotoSerif-Regular.ttf", "NotoSerif-Bold.ttf", "NotoSerif-Italic.ttf", "NotoSerif-BoldItalic.ttf"];
const NOTO: [&str; 4] = ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSans-Italic.ttf", "NotoSans-BoldItalic.ttf"];

fn serif_in(folder: Option<&str>) -> Option<FontStyles> {
    folder.into_iter().chain(["/usr/share/fonts/truetype/noto"]).find_map(|dir| latin_in(Path::new(dir), NOTO_SERIF))
}

/// The faces found for a document in `locale`; `None`: the PDF's built-in Helvetica.
pub fn find_fonts(locale: &str) -> Option<FontSet> {
    let folder = std::env::var("BASEDB_PDF_FONTS").ok().filter(|f| !f.is_empty());
    find_fonts_in(locale, folder.as_deref())
}

pub fn find_fonts_in(locale: &str, folder: Option<&str>) -> Option<FontSet> {
    let region = match locale {
        "ja" => "jp",
        "ko" => "kr",
        _ => "sc",
    };
    let cjk = |dir: &str| -> Vec<(FontFace, FontFace)> {
        let regular = Path::new(dir).join("NotoSansCJK-Regular.ttc");
        let bold = Path::new(dir).join("NotoSansCJK-Bold.ttc");
        if !exists(&regular) {
            return vec![];
        }
        let face = FontFace { path: regular, family: Some(format!("NotoSansCJK{region}-Regular")) };
        let bold = if exists(&bold) { FontFace { path: bold, family: Some(format!("NotoSansCJK{region}-Bold")) } } else { face.clone() };
        vec![(face, bold)]
    };
    let mut dirs: Vec<(&str, &str)> = vec![];
    if let Some(f) = folder {
        dirs.push((f, f));
    }
    dirs.push(("/usr/share/fonts/truetype/noto", "/usr/share/fonts/opentype/noto"));
    for (latin_dir, cjk_dir) in dirs {
        if let Some(latin) = latin_in(Path::new(latin_dir), NOTO) {
            return Some(FontSet { latin, fallbacks: cjk(cjk_dir), serif: serif_in(folder) });
        }
    }
    let windows = Path::new("C:/Windows/Fonts");
    if let Some(arial) = latin_in(windows, ["arial.ttf", "arialbd.ttf", "ariali.ttf", "arialbi.ttf"]) {
        let at = |file: &str, family: Option<&str>| {
            let p = windows.join(file);
            exists(&p).then(|| FontFace { path: p, family: family.map(str::to_string) })
        };
        let chinese = (at("msyh.ttc", Some("MicrosoftYaHei")), at("msyhbd.ttc", Some("MicrosoftYaHei-Bold")));
        let japanese = (at("YuGothR.ttc", Some("YuGothic-Regular")), at("YuGothB.ttc", Some("YuGothic-Bold")));
        let korean = (at("malgun.ttf", None), at("malgunbd.ttf", None));
        let order = match locale {
            "ja" => [japanese, chinese, korean],
            "ko" => [korean, chinese, japanese],
            _ => [chinese, japanese, korean],
        };
        let fallbacks = order
            .into_iter()
            .filter_map(|(regular, bold)| {
                let regular = regular?;
                let bold = bold.unwrap_or_else(|| regular.clone());
                Some((regular, bold))
            })
            .collect();
        return Some(FontSet { latin: arial, fallbacks, serif: serif_in(folder) });
    }
    let mac = Path::new("/System/Library/Fonts/Supplemental");
    if let Some(arial) = latin_in(mac, ["Arial.ttf", "Arial Bold.ttf", "Arial Italic.ttf", "Arial Bold Italic.ttf"]) {
        let unicode = mac.join("Arial Unicode.ttf");
        let fallbacks = if exists(&unicode) {
            let f = FontFace { path: unicode, family: None };
            vec![(f.clone(), f)]
        } else {
            vec![]
        };
        return Some(FontSet { latin: arial, fallbacks, serif: serif_in(folder) });
    }
    None
}

// ── A face read from its file ────────────────────────────────────────────────

/// A TrueType or CFF face, read once per process (its bytes live as long as it).
pub struct Loaded {
    pub data: &'static [u8],
    pub index: u32,
    pub face: rustybuzz::Face<'static>,
    pub postscript_name: String,
    pub units_per_em: f64,
    /// `1000 / unitsPerEm`.
    pub scale: f64,
    pub ascender: f64,
    pub descender: f64,
    pub line_gap: f64,
    pub cff: bool,
    run_cache: Mutex<HashMap<String, Arc<Run>>>,
}

/// A shaped run, in thousandths of the size.
pub struct Run {
    pub glyphs: Vec<Glyph>,
    pub advance: f64,
}

#[derive(Clone)]
pub struct Glyph {
    pub id: u16,
    pub x_advance: f64,
    pub advance_width: f64,
    pub x_offset: f64,
    pub y_offset: f64,
    /// The characters the glyph stands for (empty for a glyph after the first of a cluster).
    pub text: String,
}

fn postscript_name(face: &ttf_parser::Face) -> Option<String> {
    face.names()
        .into_iter()
        .filter(|n| n.name_id == ttf_parser::name_id::POST_SCRIPT_NAME)
        .find_map(|n| n.to_string())
}

static LOADED: LazyLock<Mutex<HashMap<FontFace, Option<Arc<Loaded>>>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static FILES: LazyLock<Mutex<HashMap<PathBuf, &'static [u8]>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// A face, read once; `None` when its file cannot be read.
pub fn load(face: &FontFace) -> Option<Arc<Loaded>> {
    if let Some(l) = LOADED.lock().unwrap().get(face) {
        return l.clone();
    }
    let loaded = read(face).map(Arc::new);
    LOADED.lock().unwrap().insert(face.clone(), loaded.clone());
    loaded
}

fn read(face: &FontFace) -> Option<Loaded> {
    let data: &'static [u8] = {
        let mut files = FILES.lock().unwrap();
        match files.get(&face.path) {
            Some(d) => d,
            None => {
                let bytes = std::fs::read(&face.path).ok()?;
                let leaked: &'static [u8] = Box::leak(bytes.into_boxed_slice());
                files.insert(face.path.clone(), leaked);
                leaked
            }
        }
    };
    let count = ttf_parser::fonts_in_collection(data);
    let index = match (&face.family, count) {
        (Some(family), Some(n)) => (0..n).find(|&i| {
            ttf_parser::Face::parse(data, i).ok().and_then(|f| postscript_name(&f)).as_deref() == Some(family.as_str())
        })?,
        _ => 0,
    };
    let rb = rustybuzz::Face::from_slice(data, index)?;
    let units = rb.units_per_em() as f64;
    let scale = 1000.0 / units;
    let hhea = rb.tables().hhea;
    Some(Loaded {
        data,
        index,
        postscript_name: postscript_name(&rb).unwrap_or_default(),
        units_per_em: units,
        scale,
        ascender: hhea.ascender as f64 * scale,
        descender: hhea.descender as f64 * scale,
        line_gap: hhea.line_gap as f64 * scale,
        cff: rb.tables().cff.is_some(),
        face: rb,
        run_cache: Mutex::new(HashMap::new()),
    })
}

impl Loaded {
    pub fn has_glyph(&self, c: char) -> bool {
        self.face.glyph_index(c).is_some_and(|g| g.0 != 0)
    }

    fn shape(&self, text: &str) -> Run {
        let mut buffer = rustybuzz::UnicodeBuffer::new();
        buffer.push_str(text);
        buffer.guess_segment_properties();
        let out = rustybuzz::shape(&self.face, &[], buffer);
        let infos = out.glyph_infos();
        let positions = out.glyph_positions();
        let mut glyphs = Vec::with_capacity(infos.len());
        let mut advance = 0.0;
        for (i, (info, pos)) in infos.iter().zip(positions).enumerate() {
            let start = info.cluster as usize;
            let first = i == 0 || infos[i - 1].cluster != info.cluster;
            let end = infos[i..].iter().map(|g| g.cluster as usize).find(|&c| c != start).unwrap_or(text.len());
            let (lo, hi) = if end > start { (start, end) } else { (start, text.len()) };
            let id = info.glyph_id as u16;
            let x_advance = pos.x_advance as f64 * self.scale;
            advance += x_advance;
            glyphs.push(Glyph {
                id,
                x_advance,
                advance_width: self.face.glyph_hor_advance(ttf_parser::GlyphId(id)).unwrap_or(0) as f64 * self.scale,
                x_offset: pos.x_offset as f64 * self.scale,
                y_offset: pos.y_offset as f64 * self.scale,
                text: if first { text.get(lo..hi).unwrap_or("").to_string() } else { String::new() },
            });
        }
        Run { glyphs, advance }
    }

    fn run(&self, text: &str) -> Arc<Run> {
        if let Some(r) = self.run_cache.lock().unwrap().get(text) {
            return r.clone();
        }
        let r = Arc::new(self.shape(text));
        let mut cache = self.run_cache.lock().unwrap();
        if cache.len() > 20_000 {
            cache.clear();
        }
        cache.insert(text.to_string(), r.clone());
        r
    }

    /// `EmbeddedFont.layout`: the text cut after each space or tab, each piece shaped alone.
    pub fn layout(&self, text: &str) -> Vec<Arc<Run>> {
        let mut out = vec![];
        let mut last = 0;
        for (i, c) in text.char_indices() {
            if c == ' ' || c == '\t' {
                out.push(self.run(&text[last..i + 1]));
                last = i + 1;
            }
        }
        if last < text.len() {
            out.push(self.run(&text[last..]));
        }
        out
    }

    pub fn advance(&self, text: &str) -> f64 {
        self.layout(text).iter().map(|r| r.advance).sum()
    }
}

/// Whether a face has a glyph for every character of `text`. Read once per face.
pub fn covers(face: &FontFace, text: &str) -> bool {
    let Some(loaded) = load(face) else { return false };
    text.chars().all(|c| {
        let cp = c as u32;
        cp <= 0x20 || cp == 0xa0 || cp == 0x202f || loaded.has_glyph(c)
    })
}

const WIN_ANSI_EXTRAS: &str = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/// Whether the PDF's own faces — Helvetica, Times — write every character of `text`.
pub fn win_ansi_covers(text: &str) -> bool {
    text.chars().all(|c| {
        let cp = c as u32;
        !(0x80..=0x9f).contains(&cp) && (cp <= 0xff || WIN_ANSI_EXTRAS.contains(c))
    })
}

pub fn win_ansi(text: &str) -> String {
    text.chars().map(|c| if c as u32 <= 0xff || WIN_ANSI_EXTRAS.contains(c) { c } else { '?' }).collect()
}

// ── The PDF's own faces ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct Afm {
    pub ascender: f64,
    pub descender: f64,
    pub line_gap: f64,
    pub widths: Vec<f64>,
    kern: HashMap<String, f64>,
    #[serde(skip)]
    pairs: HashMap<(u8, u8), f64>,
}

static AFM: LazyLock<HashMap<String, Afm>> = LazyLock::new(|| {
    let mut all: HashMap<String, Afm> = serde_json::from_str(include_str!("afm.json")).expect("afm.json");
    for afm in all.values_mut() {
        afm.pairs = afm
            .kern
            .iter()
            .filter_map(|(k, v)| {
                let (a, b) = k.split_once(',')?;
                Some(((a.parse().ok()?, b.parse().ok()?), *v))
            })
            .collect();
    }
    all
});

pub fn afm(name: &str) -> Option<&'static Afm> {
    AFM.get(name)
}

/// pdfkit's `WIN_ANSI_MAP`: the Windows-1252 code of a character (its own code below 256).
pub fn win_ansi_code(c: char) -> u32 {
    match c as u32 {
        402 => 131,
        8211 => 150,
        8212 => 151,
        8216 => 145,
        8217 => 146,
        8218 => 130,
        8220 => 147,
        8221 => 148,
        8222 => 132,
        8224 => 134,
        8225 => 135,
        8226 => 149,
        8230 => 133,
        8364 => 128,
        8240 => 137,
        8249 => 139,
        8250 => 155,
        710 => 136,
        8482 => 153,
        338 => 140,
        339 => 156,
        732 => 152,
        352 => 138,
        353 => 154,
        376 => 159,
        381 => 142,
        382 => 158,
        8208 | 8209 => 45,
        8239 => 160,
        cp => cp,
    }
}

impl Afm {
    /// The codes the text is written with (UTF-16 units, as pdfkit reads them).
    pub fn codes(text: &str) -> Vec<u32> {
        text.encode_utf16().map(|u| char::from_u32(u as u32).map(win_ansi_code).unwrap_or(u as u32)).collect()
    }

    fn width_of(&self, code: u32) -> f64 {
        self.widths.get(code as usize).copied().unwrap_or(0.0)
    }

    pub fn kern(&self, a: u32, b: u32) -> f64 {
        if a > 255 || b > 255 {
            return 0.0;
        }
        self.pairs.get(&(a as u8, b as u8)).copied().unwrap_or(0.0)
    }

    /// Each code's advance, kerning with the next included, in thousandths of the size.
    pub fn advances(&self, codes: &[u32]) -> Vec<f64> {
        (0..codes.len())
            .map(|i| self.width_of(codes[i]) + codes.get(i + 1).map(|&n| self.kern(codes[i], n)).unwrap_or(0.0))
            .collect()
    }

    pub fn advance(&self, text: &str) -> f64 {
        self.advances(&Afm::codes(text)).iter().sum()
    }
}

// ── A face as the document uses it ───────────────────────────────────────────

#[derive(Clone)]
pub enum FontRef {
    Standard(&'static str, &'static Afm),
    Embedded(Arc<Loaded>),
}

impl FontRef {
    pub fn standard(name: &str) -> Option<FontRef> {
        let (key, _) = AFM.get_key_value(name)?;
        Some(FontRef::Standard(key.as_str(), &AFM[name]))
    }

    pub fn ascender(&self) -> f64 {
        match self {
            FontRef::Standard(_, a) => a.ascender,
            FontRef::Embedded(l) => l.ascender,
        }
    }

    pub fn descender(&self) -> f64 {
        match self {
            FontRef::Standard(_, a) => a.descender,
            FontRef::Embedded(l) => l.descender,
        }
    }

    pub fn line_gap(&self) -> f64 {
        match self {
            FontRef::Standard(_, a) => a.line_gap,
            FontRef::Embedded(l) => l.line_gap,
        }
    }

    /// `currentLineHeight(includeGap)`.
    pub fn line_height(&self, size: f64, include_gap: bool) -> f64 {
        let gap = if include_gap { self.line_gap() } else { 0.0 };
        (self.ascender() + gap - self.descender()) / 1000.0 * size
    }

    /// `doc.widthOfString(text, { characterSpacing })`.
    pub fn width_of(&self, text: &str, size: f64, tracking: f64) -> f64 {
        let w = match self {
            FontRef::Standard(_, a) => a.advance(text),
            FontRef::Embedded(l) => l.advance(text),
        };
        w * size / 1000.0 + tracking * (text.encode_utf16().count() as f64 - 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_metrics() {
        let h = FontRef::standard("Helvetica").unwrap();
        // pdfkit: doc.font('Helvetica').fontSize(10).widthOfString('Hello') = 22.78, 'AVA' 18.51.
        assert!((h.width_of("Hello", 10.0, 0.0) - 22.78).abs() < 1e-9);
        assert!((h.width_of("AVA", 10.0, 0.0) - 18.51).abs() < 1e-9);
        assert!((h.line_height(10.0, true) - 11.56).abs() < 1e-9);
        assert!(win_ansi_covers("é€") && !win_ansi_covers("日"));
        assert_eq!(win_ansi("a日"), "a?");
    }
}
