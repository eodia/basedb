//! A PDF written by hand, drawn as pdfkit draws (`1 0 0 -1 0 H cm`: the top left is the origin):
//! paths, text (`_fragment`: underline, strike, links, kerning in `TJ`), JPEG and PNG pictures.
//! Embedded faces are Type0/Identity-H fonts, subset (`subsetter`), with their `ToUnicode`; the
//! PDF's own faces are Type1 in `WinAnsiEncoding`.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt::Write as _;
use std::io::Write as _;

use flate2::write::ZlibEncoder;
use flate2::Compression;
use rustybuzz::ttf_parser;

use super::fonts::{Afm, FontRef};

/// pdfkit's `number`: six decimals at most.
pub fn num(n: f64) -> String {
    let r = (n * 1e6).round() / 1e6;
    if r == r.trunc() && r.abs() < 1e15 {
        format!("{}", r as i64)
    } else {
        let s = format!("{r:.6}");
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

fn color_ops(hex: &str) -> String {
    let n = u32::from_str_radix(hex.trim_start_matches('#'), 16).unwrap_or(0);
    let c = |v: u32| num(((v & 255) as f64) / 255.0);
    format!("{} {} {}", c(n >> 16), c(n >> 8), c(n))
}

#[derive(Default)]
struct Page {
    content: String,
    fonts: BTreeSet<usize>,
    images: BTreeSet<usize>,
    links: Vec<([f64; 4], String)>,
}

struct Font {
    font: FontRef,
    remapper: subsetter::GlyphRemapper,
    /// New glyph id → width (thousandths) and the text it stands for.
    glyphs: BTreeMap<u16, (f64, String)>,
}

/// A picture opened: its sides as stored, and its EXIF orientation.
pub struct Image {
    pub width: f64,
    pub height: f64,
    pub orientation: u16,
    kind: ImageKind,
    used: bool,
}

enum ImageKind {
    Jpeg { data: Vec<u8>, bits: u8, channels: u8 },
    Png { data: Vec<u8> },
}

pub struct TextOptions<'a> {
    pub underline: bool,
    pub strike: bool,
    pub tracking: f64,
    pub link: Option<&'a str>,
}

pub struct Pdf {
    pub width: f64,
    pub height: f64,
    pages: Vec<Page>,
    current: usize,
    fonts: Vec<Font>,
    font_ids: HashMap<String, usize>,
    images: Vec<Image>,
}

const KAPPA: f64 = 4.0 * ((std::f64::consts::SQRT_2 - 1.0) / 3.0);

impl Pdf {
    pub fn new(width: f64, height: f64) -> Pdf {
        let mut pdf = Pdf { width, height, pages: vec![], current: 0, fonts: vec![], font_ids: HashMap::new(), images: vec![] };
        pdf.add_page();
        pdf
    }

    pub fn add_page(&mut self) {
        let page = Page { content: format!("1 0 0 -1 0 {} cm\n", num(self.height)), ..Page::default() };
        self.pages.push(page);
        self.current = self.pages.len() - 1;
    }

    pub fn page_count(&self) -> usize {
        self.pages.len()
    }

    pub fn switch_to_page(&mut self, i: usize) {
        self.current = i;
    }

    fn out(&mut self, s: &str) {
        let c = &mut self.pages[self.current].content;
        c.push_str(s);
        c.push('\n');
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: &str) {
        let s = format!("{} {} {} {} re\n{} rg\nf", num(x), num(y), num(w), num(h), color_ops(color));
        self.out(&s);
    }

    pub fn stroke_rect(&mut self, x: f64, y: f64, w: f64, h: f64, line_width: f64, color: &str) {
        let s = format!("{} {} {} {} re\n{} w\n{} RG\nS", num(x), num(y), num(w), num(h), num(line_width), color_ops(color));
        self.out(&s);
    }

    fn rounded_path(x: f64, y: f64, w: f64, h: f64, r: f64) -> String {
        let r = r.min(0.5 * w).min(0.5 * h);
        let c = r * (1.0 - KAPPA);
        let p = |a: f64, b: f64| format!("{} {}", num(a), num(b));
        [
            format!("{} m", p(x + r, y)),
            format!("{} l", p(x + w - r, y)),
            format!("{} {} {} c", p(x + w - c, y), p(x + w, y + c), p(x + w, y + r)),
            format!("{} l", p(x + w, y + h - r)),
            format!("{} {} {} c", p(x + w, y + h - c), p(x + w - c, y + h), p(x + w - r, y + h)),
            format!("{} l", p(x + r, y + h)),
            format!("{} {} {} c", p(x + c, y + h), p(x, y + h - c), p(x, y + h - r)),
            format!("{} l", p(x, y + r)),
            format!("{} {} {} c", p(x, y + c), p(x + c, y), p(x + r, y)),
            "h".to_string(),
        ]
        .join("\n")
    }

    pub fn fill_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64, r: f64, color: &str) {
        let s = format!("{}\n{} rg\nf", Pdf::rounded_path(x, y, w, h, r), color_ops(color));
        self.out(&s);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn stroke_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64, r: f64, line_width: f64, color: &str) {
        let s = format!("{}\n{} w\n{} RG\nS", Pdf::rounded_path(x, y, w, h, r), num(line_width), color_ops(color));
        self.out(&s);
    }

    pub fn stroke_line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, line_width: f64, color: &str) {
        let s = format!("{} {} m\n{} {} l\n{} w\n{} RG\nS", num(x1), num(y1), num(x2), num(y2), num(line_width), color_ops(color));
        self.out(&s);
    }

    fn font_index(&mut self, name: &str, font: &FontRef) -> usize {
        if let Some(&i) = self.font_ids.get(name) {
            return i;
        }
        self.fonts.push(Font { font: font.clone(), remapper: subsetter::GlyphRemapper::new(), glyphs: BTreeMap::new() });
        let i = self.fonts.len() - 1;
        self.font_ids.insert(name.to_string(), i);
        i
    }

    /// `doc.font(name).fontSize(size).fillColor(color).text(text, x, y, { lineBreak: false, … })`.
    #[allow(clippy::too_many_arguments)]
    pub fn text(&mut self, name: &str, font: &FontRef, size: f64, color: &str, text: &str, x: f64, y: f64, o: &TextOptions) {
        let text: String = text.chars().filter(|&c| c != '\n').collect();
        if text.is_empty() {
            return;
        }
        let fi = self.font_index(name, font);
        let ascent = font.ascender() / 1000.0 * size;
        let line_height = font.line_height(size, false);
        let width = font.width_of(&text, size, o.tracking);
        if let Some(link) = o.link {
            let rect = [x, self.height - y - line_height, x + width, self.height - y];
            self.pages[self.current].links.push((rect, link.to_string()));
        }
        let decoration = if size < 10.0 { 0.5 } else { (size / 10.0).floor() };
        if o.underline {
            let ly = y + line_height - decoration;
            let s = format!("q\n{} RG\n{} w\n{} {} m\n{} {} l\nS\nQ", color_ops(color), num(decoration), num(x), num(ly), num(x + width), num(ly));
            self.out(&s);
        }
        if o.strike {
            let ly = y + line_height / 2.0;
            let s = format!("q\n{} RG\n{} w\n{} {} m\n{} {} l\nS\nQ", color_ops(color), num(decoration), num(x), num(ly), num(x + width), num(ly));
            self.out(&s);
        }
        // (code, x advance, advance width, x offset, y offset), all in thousandths.
        let mut glyphs: Vec<(String, f64, f64, f64, f64)> = vec![];
        match font {
            FontRef::Standard(_, afm) => {
                let codes = Afm::codes(&text);
                let advances = afm.advances(&codes);
                for (i, code) in codes.iter().enumerate() {
                    let code = if *code > 255 { 63 } else { *code };
                    let own = afm.widths.get(code as usize).copied().unwrap_or(0.0);
                    glyphs.push((format!("{code:02x}"), advances[i], own, 0.0, 0.0));
                }
            }
            FontRef::Embedded(loaded) => {
                let f = &mut self.fonts[fi];
                for run in loaded.layout(&text) {
                    for g in &run.glyphs {
                        let id = f.remapper.remap(g.id);
                        let entry = f.glyphs.entry(id).or_insert_with(|| (g.advance_width, String::new()));
                        if entry.1.is_empty() && !g.text.is_empty() {
                            entry.1 = g.text.clone();
                        }
                        glyphs.push((format!("{id:04x}"), g.x_advance, g.advance_width, g.x_offset, g.y_offset));
                    }
                }
            }
        }
        let page = &mut self.pages[self.current];
        page.fonts.insert(fi);
        let mut x = x;
        let y = self.height - y - ascent;
        let mut s = format!("{} rg\nq\n1 0 0 -1 0 {} cm\nBT\n1 0 0 1 {} {} Tm\n/F{} {} Tf\n", color_ops(color), num(self.height), num(x), num(y), fi + 1, num(size));
        if o.tracking != 0.0 {
            let _ = writeln!(s, "{} Tc", num(o.tracking));
        }
        let scale = size / 1000.0;
        let mut commands: Vec<String> = vec![];
        let mut last = 0;
        let mut had_offset = false;
        let segment = |commands: &mut Vec<String>, last: &mut usize, cur: usize| {
            if *last < cur {
                let hex: String = glyphs[*last..cur].iter().map(|g| g.0.as_str()).collect();
                let advance = glyphs[cur - 1].1 - glyphs[cur - 1].2;
                commands.push(format!("<{hex}> {}", num(-advance)));
            }
            *last = cur;
        };
        let flush = |s: &mut String, commands: &mut Vec<String>, last: &mut usize, cur: usize| {
            segment(commands, last, cur);
            if !commands.is_empty() {
                let _ = writeln!(s, "[{}] TJ", commands.join(" "));
                commands.clear();
            }
        };
        let mut i = 0;
        while i < glyphs.len() {
            let (_, x_advance, advance_width, x_offset, y_offset) = glyphs[i];
            if x_offset != 0.0 || y_offset != 0.0 {
                flush(&mut s, &mut commands, &mut last, i);
                let _ = writeln!(s, "1 0 0 1 {} {} Tm", num(x + x_offset * scale), num(y + y_offset * scale));
                flush(&mut s, &mut commands, &mut last, i + 1);
                had_offset = true;
            } else {
                if had_offset {
                    let _ = writeln!(s, "1 0 0 1 {} {} Tm", num(x), num(y));
                    had_offset = false;
                }
                if x_advance - advance_width != 0.0 {
                    segment(&mut commands, &mut last, i + 1);
                }
            }
            x += x_advance * scale;
            i += 1;
        }
        flush(&mut s, &mut commands, &mut last, glyphs.len());
        s.push_str("ET\nQ");
        self.out(&s);
    }

    /// Opens a JPEG or a PNG, as `PDFImage.open` does; `None`: neither, or unreadable.
    pub fn open_image(&mut self, data: &[u8]) -> Option<usize> {
        let image = if data.starts_with(&[0xff, 0xd8]) {
            open_jpeg(data)?
        } else if data.starts_with(&[0x89, 0x50, 0x4e, 0x47]) {
            let decoder = png::Decoder::new(data);
            let reader = decoder.read_info().ok()?;
            let info = reader.info();
            Image { width: info.width as f64, height: info.height as f64, orientation: 1, kind: ImageKind::Png { data: data.to_vec() }, used: false }
        } else {
            return None;
        };
        self.images.push(image);
        Some(self.images.len() - 1)
    }

    pub fn image_info(&self, id: usize) -> &Image {
        &self.images[id]
    }

    /// `doc.image(image, x, y, { width })`, turned by its EXIF orientation.
    pub fn image(&mut self, id: usize, x: f64, y: f64, width: f64) {
        let (iw, ih, orientation) = {
            let i = &self.images[id];
            (i.width, i.height, i.orientation)
        };
        if let ImageKind::Png { data } = &self.images[id].kind {
            if decode_png(data).is_none() {
                return;
            }
        }
        let (sw, sh) = if orientation > 4 { (ih, iw) } else { (iw, ih) };
        let w = width;
        let h = sh * (w / sw);
        let (mut xt, mut yt, mut wt, mut ht) = (x, y, w, h);
        let mut angle = 0.0;
        match orientation {
            2 => {
                wt = -w;
                ht = -h;
                xt += w;
                yt += h;
            }
            3 => {
                ht = -h;
                xt -= w;
                angle = 180.0;
            }
            4 => {}
            5 => {
                wt = h;
                ht = w;
                yt -= ht;
                angle = 90.0;
            }
            6 => {
                wt = h;
                ht = -w;
                angle = 90.0;
            }
            7 => {
                ht = -w;
                wt = -h;
                xt += h;
                angle = 90.0;
            }
            8 => {
                wt = h;
                ht = -w;
                xt -= h;
                yt += w;
                angle = -90.0;
            }
            _ => {
                ht = -h;
                yt += h;
            }
        }
        let mut s = String::from("q\n");
        if angle != 0.0 {
            let rad = angle * std::f64::consts::PI / 180.0;
            let (cos, sin) = (rad.cos(), rad.sin());
            let dx = x - (x * cos - y * sin);
            let dy = y - (x * sin + y * cos);
            let _ = writeln!(s, "{} {} {} {} {} {} cm", num(cos), num(sin), num(-sin), num(cos), num(dx), num(dy));
        }
        let _ = writeln!(s, "{} 0 0 {} {} {} cm", num(wt), num(ht), num(xt), num(yt));
        let _ = write!(s, "/I{} Do\nQ", id + 1);
        self.images[id].used = true;
        self.pages[self.current].images.insert(id);
        self.out(&s);
    }

    /// The file's bytes.
    pub fn finish(mut self, title: &str, lang: &str) -> Vec<u8> {
        let mut w = Objects::default();
        let catalog = w.reserve();
        let pages_id = w.reserve();
        let info = w.reserve();
        let font_refs: Vec<usize> = (0..self.fonts.len()).map(|_| w.reserve()).collect();
        let image_refs: Vec<Option<usize>> = self.images.iter().map(|i| i.used.then_some(0)).collect();
        let mut image_ids = vec![0; self.images.len()];
        for (i, used) in image_refs.iter().enumerate() {
            if used.is_some() {
                image_ids[i] = w.reserve();
            }
        }
        for (i, font) in std::mem::take(&mut self.fonts).into_iter().enumerate() {
            write_font(&mut w, font_refs[i], font);
        }
        for (i, image) in std::mem::take(&mut self.images).into_iter().enumerate() {
            if image.used {
                write_image(&mut w, image_ids[i], image);
            }
        }
        let mut kids = vec![];
        for page in std::mem::take(&mut self.pages) {
            let content = w.stream("", page.content.as_bytes(), true);
            let mut res = String::from("<< /ProcSet [/PDF /Text /ImageB /ImageC /ImageI]");
            if !page.fonts.is_empty() {
                res.push_str(" /Font <<");
                for f in &page.fonts {
                    let _ = write!(res, " /F{} {} 0 R", f + 1, font_refs[*f]);
                }
                res.push_str(" >>");
            }
            if !page.images.is_empty() {
                res.push_str(" /XObject <<");
                for i in &page.images {
                    let _ = write!(res, " /I{} {} 0 R", i + 1, image_ids[*i]);
                }
                res.push_str(" >>");
            }
            res.push_str(" >>");
            let mut annots = vec![];
            for (r, url) in &page.links {
                annots.push(w.add(format!(
                    "<< /Type /Annot /Subtype /Link /Rect [{} {} {} {}] /Border [0 0 0] /A << /S /URI /URI {} >> >>",
                    num(r[0]),
                    num(r[1]),
                    num(r[2]),
                    num(r[3]),
                    pdf_string(url)
                )));
            }
            let annots = if annots.is_empty() {
                String::new()
            } else {
                format!(" /Annots [{}]", annots.iter().map(|a| format!("{a} 0 R")).collect::<Vec<_>>().join(" "))
            };
            kids.push(w.add(format!(
                "<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {} {}] /Contents {content} 0 R /Resources {res}{annots} >>",
                num(self.width),
                num(self.height)
            )));
        }
        w.set(
            pages_id,
            format!("<< /Type /Pages /Count {} /Kids [{}] >>", kids.len(), kids.iter().map(|k| format!("{k} 0 R")).collect::<Vec<_>>().join(" ")),
        );
        let now = chrono::Utc::now().format("D:%Y%m%d%H%M%SZ").to_string();
        w.set(
            info,
            format!(
                "<< /Title {} /Creator (basedb) /Producer (basedb) /CreationDate {} >>",
                pdf_string(title),
                pdf_string(&now)
            ),
        );
        w.set(
            catalog,
            format!(
                "<< /Type /Catalog /Pages {pages_id} 0 R /Lang {} /ViewerPreferences << /DisplayDocTitle true >> >>",
                pdf_string(lang)
            ),
        );
        w.finish(catalog, info)
    }
}

/// A PDF text string: ASCII as is, anything else in UTF-16BE.
fn pdf_string(s: &str) -> String {
    if s.chars().all(|c| (' '..='~').contains(&c)) {
        let mut out = String::from("(");
        for c in s.chars() {
            if matches!(c, '(' | ')' | '\\') {
                out.push('\\');
            }
            out.push(c);
        }
        out.push(')');
        return out;
    }
    let mut out = String::from("<FEFF");
    for u in s.encode_utf16() {
        let _ = write!(out, "{u:04X}");
    }
    out.push('>');
    out
}

#[derive(Default)]
struct Objects {
    bodies: Vec<Option<Vec<u8>>>,
}

impl Objects {
    fn reserve(&mut self) -> usize {
        self.bodies.push(None);
        self.bodies.len()
    }

    fn set(&mut self, id: usize, body: String) {
        self.bodies[id - 1] = Some(body.into_bytes());
    }

    fn set_bytes(&mut self, id: usize, body: Vec<u8>) {
        self.bodies[id - 1] = Some(body);
    }

    fn add(&mut self, body: String) -> usize {
        let id = self.reserve();
        self.set(id, body);
        id
    }

    fn stream_bytes(dict: &str, data: &[u8], compress: bool) -> Vec<u8> {
        let (data, filter) = if compress {
            let mut e = ZlibEncoder::new(Vec::new(), Compression::default());
            let _ = e.write_all(data);
            (e.finish().unwrap_or_default(), " /Filter /FlateDecode")
        } else {
            (data.to_vec(), "")
        };
        let mut out = format!("<< /Length {}{filter}{dict} >>\nstream\n", data.len()).into_bytes();
        out.extend_from_slice(&data);
        out.extend_from_slice(b"\nendstream");
        out
    }

    fn stream(&mut self, dict: &str, data: &[u8], compress: bool) -> usize {
        let id = self.reserve();
        self.set_bytes(id, Objects::stream_bytes(dict, data, compress));
        id
    }

    fn finish(self, root: usize, info: usize) -> Vec<u8> {
        let mut out: Vec<u8> = b"%PDF-1.7\n%\xff\xff\xff\xff\n".to_vec();
        let mut offsets = vec![];
        for (i, body) in self.bodies.iter().enumerate() {
            offsets.push(out.len());
            out.extend_from_slice(format!("{} 0 obj\n", i + 1).as_bytes());
            out.extend_from_slice(body.as_deref().unwrap_or(b"null"));
            out.extend_from_slice(b"\nendobj\n");
        }
        let xref = out.len();
        let mut x = format!("xref\n0 {}\n0000000000 65535 f \n", self.bodies.len() + 1);
        for o in offsets {
            let _ = writeln!(x, "{o:010} 00000 n ");
        }
        let _ = write!(x, "trailer\n<< /Size {} /Root {root} 0 R /Info {info} 0 R >>\nstartxref\n{xref}\n%%EOF\n", self.bodies.len() + 1);
        out.extend_from_slice(x.as_bytes());
        out
    }
}

fn write_font(w: &mut Objects, id: usize, font: Font) {
    let loaded = match &font.font {
        FontRef::Standard(name, _) => {
            w.set(id, format!("<< /Type /Font /Subtype /Type1 /BaseFont /{name} /Encoding /WinAnsiEncoding >>"));
            return;
        }
        FontRef::Embedded(l) => l.clone(),
    };
    let program = subsetter::subset(loaded.data, loaded.index, &font.remapper).ok();
    let scale = loaded.scale;
    let face = &loaded.face;
    let tag: String = (0..6).map(|i| char::from(b'A' + ((id * 7 + i * 3) % 26) as u8)).collect();
    let name = format!("{tag}+{}", loaded.postscript_name.replace(' ', "_"));
    let mut descriptor = {
        let b = face.global_bounding_box();
        format!(
            "<< /Type /FontDescriptor /FontName /{name} /Flags 4 /FontBBox [{} {} {} {}] /ItalicAngle {} /Ascent {} /Descent {} /CapHeight {} /XHeight {} /StemV 0",
            num(b.x_min as f64 * scale),
            num(b.y_min as f64 * scale),
            num(b.x_max as f64 * scale),
            num(b.y_max as f64 * scale),
            num(face.italic_angle().unwrap_or(0.0) as f64),
            num(loaded.ascender),
            num(loaded.descender),
            num(face.capital_height().map(|v| v as f64).unwrap_or(loaded.ascender / scale) * scale),
            num(face.x_height().unwrap_or(0) as f64 * scale),
        )
    };
    let cff = loaded.cff;
    if let Some(program) = program {
        if cff {
            let table = ttf_parser::RawFace::parse(&program, 0)
                .ok()
                .and_then(|raw| raw.table(ttf_parser::Tag::from_bytes(b"CFF ")).map(<[u8]>::to_vec));
            if let Some(table) = table {
                let file = w.stream(" /Subtype /CIDFontType0C", &table, true);
                let _ = write!(descriptor, " /FontFile3 {file} 0 R");
            }
        } else {
            let file = w.stream(&format!(" /Length1 {}", program.len()), &program, true);
            let _ = write!(descriptor, " /FontFile2 {file} 0 R");
        }
    }
    descriptor.push_str(" >>");
    let descriptor = w.add(descriptor);
    let widths: Vec<String> = (0..font.remapper.num_gids()).map(|g| num(font.glyphs.get(&g).map(|e| e.0).unwrap_or(0.0))).collect();
    let cid = w.add(format!(
        "<< /Type /Font /Subtype /{} /BaseFont /{name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor {descriptor} 0 R /W [0 [{}]]{} >>",
        if cff { "CIDFontType0" } else { "CIDFontType2" },
        widths.join(" "),
        if cff { "" } else { " /CIDToGIDMap /Identity" }
    ));
    let mut cmap = String::from(
        "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000><ffff>\nendcodespacerange\n",
    );
    let entries: Vec<(u16, &String)> = font.glyphs.iter().filter(|(_, (_, t))| !t.is_empty()).map(|(g, (_, t))| (*g, t)).collect();
    for chunk in entries.chunks(100) {
        let _ = writeln!(cmap, "{} beginbfchar", chunk.len());
        for (g, t) in chunk {
            let hex: String = t.encode_utf16().map(|u| format!("{u:04x}")).collect();
            let _ = writeln!(cmap, "<{g:04x}> <{hex}>");
        }
        cmap.push_str("endbfchar\n");
    }
    cmap.push_str("endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n");
    let to_unicode = w.stream("", cmap.as_bytes(), true);
    w.set(
        id,
        format!("<< /Type /Font /Subtype /Type0 /BaseFont /{name} /Encoding /Identity-H /DescendantFonts [{cid} 0 R] /ToUnicode {to_unicode} 0 R >>"),
    );
}

fn write_image(w: &mut Objects, id: usize, image: Image) {
    match image.kind {
        ImageKind::Jpeg { data, bits, channels } => {
            let space = match channels {
                1 => "/DeviceGray",
                4 => "/DeviceCMYK",
                _ => "/DeviceRGB",
            };
            let decode = if channels == 4 { " /Decode [1 0 1 0 1 0 1 0]" } else { "" };
            let dict = format!(
                " /Type /XObject /Subtype /Image /BitsPerComponent {bits} /Width {} /Height {} /ColorSpace {space} /Filter /DCTDecode{decode}",
                image.width, image.height
            );
            w.set_bytes(id, Objects::stream_bytes(&dict, &data, false));
        }
        ImageKind::Png { data } => {
            let Some((color, alpha, gray)) = decode_png(&data) else { return };
            let mut smask = String::new();
            if let Some(alpha) = alpha {
                let m = w.stream(
                    &format!(" /Type /XObject /Subtype /Image /Width {} /Height {} /BitsPerComponent 8 /ColorSpace /DeviceGray /Decode [0 1]", image.width, image.height),
                    &alpha,
                    true,
                );
                smask = format!(" /SMask {m} 0 R");
            }
            let dict = format!(
                " /Type /XObject /Subtype /Image /Width {} /Height {} /BitsPerComponent 8 /ColorSpace {}{smask}",
                image.width,
                image.height,
                if gray { "/DeviceGray" } else { "/DeviceRGB" }
            );
            w.set_bytes(id, Objects::stream_bytes(&dict, &color, true));
        }
    }
}

/// A PNG's colour (8 bits, gray or RGB) and its alpha, when it has one.
fn decode_png(data: &[u8]) -> Option<(Vec<u8>, Option<Vec<u8>>, bool)> {
    let mut decoder = png::Decoder::new(data);
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder.read_info().ok()?;
    let mut buf = vec![0; reader.output_buffer_size()];
    let frame = reader.next_frame(&mut buf).ok()?;
    let buf = &buf[..frame.buffer_size()];
    let (channels, gray) = match frame.color_type {
        png::ColorType::Grayscale => (1, true),
        png::ColorType::GrayscaleAlpha => (2, true),
        png::ColorType::Rgb => (3, false),
        png::ColorType::Rgba => (4, false),
        png::ColorType::Indexed => return None,
    };
    if channels == 1 || channels == 3 {
        return Some((buf.to_vec(), None, gray));
    }
    let color_n = channels - 1;
    let mut color = Vec::with_capacity(buf.len() / channels * color_n);
    let mut alpha = Vec::with_capacity(buf.len() / channels);
    for px in buf.chunks_exact(channels) {
        color.extend_from_slice(&px[..color_n]);
        alpha.push(px[color_n]);
    }
    Some((color, Some(alpha), gray))
}

const MARKERS: [u16; 15] = [0xffc0, 0xffc1, 0xffc2, 0xffc3, 0xffc5, 0xffc6, 0xffc7, 0xffc8, 0xffc9, 0xffca, 0xffcb, 0xffcc, 0xffcd, 0xffce, 0xffcf];

fn be16(d: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_be_bytes([*d.get(at)?, *d.get(at + 1)?]))
}

fn open_jpeg(data: &[u8]) -> Option<Image> {
    let orientation = exif_orientation(data).unwrap_or(1);
    let mut pos = 2;
    let mut marker = 0;
    while pos < data.len() {
        while pos < data.len() && data[pos] != 0xff {
            pos += 1;
        }
        if pos >= data.len() {
            break;
        }
        marker = be16(data, pos)?;
        pos += 2;
        if MARKERS.contains(&marker) {
            break;
        }
        pos += be16(data, pos)? as usize;
    }
    if !MARKERS.contains(&marker) {
        return None;
    }
    pos += 2;
    let bits = *data.get(pos)?;
    let height = be16(data, pos + 1)?;
    let width = be16(data, pos + 3)?;
    let channels = *data.get(pos + 5)?;
    Some(Image {
        width: width as f64,
        height: height as f64,
        orientation,
        kind: ImageKind::Jpeg { data: data.to_vec(), bits, channels },
        used: false,
    })
}

/// pdfkit's `parseExifOrientation`.
fn exif_orientation(data: &[u8]) -> Option<u16> {
    if data.len() < 20 {
        return None;
    }
    let mut pos = 2;
    while pos < data.len() - 4 {
        while pos < data.len() && data[pos] != 0xff {
            pos += 1;
        }
        if pos >= data.len() - 4 {
            return None;
        }
        let marker = be16(data, pos)?;
        pos += 2;
        if marker == 0xffda {
            return None;
        }
        if (0xffd0..=0xffd9).contains(&marker) || marker == 0xff01 {
            continue;
        }
        if pos + 2 > data.len() {
            return None;
        }
        let length = be16(data, pos)? as usize;
        if marker == 0xffe1 && pos + 8 <= data.len() && &data[pos + 2..pos + 8] == b"Exif\0\0" {
            let tiff = pos + 8;
            if tiff + 8 > data.len() {
                return None;
            }
            let little = match &data[tiff..tiff + 2] {
                b"II" => true,
                b"MM" => false,
                _ => return None,
            };
            let r16 = |o: usize| -> Option<u16> {
                let b = [*data.get(o)?, *data.get(o + 1)?];
                Some(if little { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) })
            };
            let r32 = |o: usize| -> Option<u32> {
                let b = [*data.get(o)?, *data.get(o + 1)?, *data.get(o + 2)?, *data.get(o + 3)?];
                Some(if little { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
            };
            if r16(tiff + 2)? != 42 {
                return None;
            }
            let ifd = tiff + r32(tiff + 4)? as usize;
            if ifd + 2 > data.len() {
                return None;
            }
            for i in 0..r16(ifd)? as usize {
                let entry = ifd + 2 + i * 12;
                if entry + 12 > data.len() {
                    return None;
                }
                if r16(entry)? == 0x0112 {
                    let v = r16(entry + 8)?;
                    return (1..=8).contains(&v).then_some(v);
                }
            }
            return None;
        }
        pos += length;
    }
    None
}
