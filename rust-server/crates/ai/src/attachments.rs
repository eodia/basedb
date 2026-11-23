//! `ai/attachments.ts`: the attachments of a copilot conversation — their TEXT reaches the
//! provider, never the file; an image is sent beside the payload.

use crate::js::{chars_len, chars_prefix, js_slice, js_to_number, js_trim};
use crate::provider::{AiImage, MAX_PAYLOAD_BYTES};
use basedb_base::error::AppError;
use basedb_base::idempotency::js_stringify;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::io::Read;
use std::sync::OnceLock;

pub const MAX_ATTACHMENT_BYTES: usize = 20 * 1024 * 1024;
pub const MAX_ATTACHMENT_CHARS: usize = 24_000;
pub const MAX_ATTACHMENTS: usize = 5;
const MAX_TURN_CHARS: i64 = 24_000;
const PAYLOAD_RESERVE_BYTES: i64 = 24 * 1024;
const MAX_INFLATED_BYTES: u64 = 64 * 1024 * 1024;
const MAX_SHEET_ROWS: usize = 2_000;
pub const MAX_ATTACHED_IMAGES: usize = 3;
pub const MAX_IMAGE_BASE64: usize = 6_800_000;
pub const IMAGE_TYPES: [&str; 4] = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const TEXT_EXTENSIONS: [&str; 16] = ["txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "log", "sql", "yaml", "yml", "ini", "tex", "rtf"];

/// `ExtractedAttachment`, in the API's spelling.
#[derive(Debug, Clone, PartialEq)]
pub struct Extracted {
    pub name: String,
    pub kind: &'static str,
    pub text: String,
    pub chars: usize,
    pub truncated: bool,
    pub parts: Option<usize>,
    pub media_type: Option<&'static str>,
}

impl Extracted {
    pub fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "kind": self.kind,
            "text": self.text,
            "chars": self.chars,
            "truncated": self.truncated,
            "parts": self.parts,
            "media_type": self.media_type,
        })
    }
}

fn unreadable(reason: &str) -> AppError {
    AppError::new("AI_ATTACHMENT_UNREADABLE").with("reason", json!(reason))
}

fn re(cell: &'static OnceLock<Regex>, src: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(src).unwrap())
}

/// `extractAttachment`: the kind is told by the bytes first.
pub fn extract_attachment(name: &str, bytes: &[u8]) -> Result<Extracted, AppError> {
    let name = js_slice(js_trim(name), 200);
    let name = if name.is_empty() { "document".to_string() } else { name.to_string() };
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err(AppError::new("BODY_TOO_LARGE").with("maximum", json!(MAX_ATTACHMENT_BYTES)));
    }
    if bytes.is_empty() {
        return Err(unreadable("fichier_vide"));
    }
    static EXT: OnceLock<Regex> = OnceLock::new();
    let extension = re(&EXT, r"(?i)\.([a-z0-9]+)$").captures(&name).map(|c| c[1].to_lowercase()).unwrap_or_default();

    let (kind, text, parts): (&'static str, String, Option<usize>) = if bytes.starts_with(b"%PDF") {
        let (text, pages) = read_pdf(bytes)?;
        ("pdf", text, Some(pages))
    } else if bytes.starts_with(&[0x50, 0x4b, 0x03, 0x04]) {
        let (kind, text, parts) = read_office(bytes)?;
        (kind, text, Some(parts))
    } else if bytes.starts_with(&[0xd0, 0xcf, 0x11, 0xe0]) {
        return Err(unreadable("format_office_ancien"));
    } else if let Some(media_type) = image_type(bytes) {
        return Ok(Extracted { name, kind: "image", text: String::new(), chars: 0, truncated: false, parts: None, media_type: Some(media_type) });
    } else if TEXT_EXTENSIONS.contains(&extension.as_str()) || extension.is_empty() || !bytes[..bytes.len().min(8192)].contains(&0) {
        (if extension == "csv" || extension == "tsv" { "sheet" } else { "text" }, decode_text(bytes), None)
    } else {
        return Err(unreadable("format_inconnu"));
    };

    let clean = clean_text(&text);
    if clean.is_empty() {
        return Err(unreadable("aucun_texte"));
    }
    let chars = chars_len(&clean);
    Ok(Extracted {
        name,
        kind,
        text: if chars > MAX_ATTACHMENT_CHARS { chars_prefix(&clean, MAX_ATTACHMENT_CHARS).to_string() } else { clean.clone() },
        chars,
        truncated: chars > MAX_ATTACHMENT_CHARS,
        parts,
        media_type: None,
    })
}

fn clean_text(text: &str) -> String {
    static CR: OnceLock<Regex> = OnceLock::new();
    static TRAIL: OnceLock<Regex> = OnceLock::new();
    static BLANK: OnceLock<Regex> = OnceLock::new();
    let t = re(&CR, r"\r\n?").replace_all(text, "\n");
    let t = re(&TRAIL, r"[\t\x0B\x0C\r \u{A0}\u{1680}\u{2000}-\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}]+\n").replace_all(&t, "\n");
    let t = re(&BLANK, r"\n{3,}").replace_all(&t, "\n\n");
    js_trim(&t).to_string()
}

/// `readAttachments`: the attachments of a request, checked and bounded.
pub fn read_attachments(raw: Option<&Value>) -> Result<Vec<(String, String, Option<AiImage>)>, AppError> {
    let raw = match raw {
        None | Some(Value::Null) => return Ok(vec![]),
        Some(v) => v,
    };
    let Some(items) = raw.as_array().filter(|a| a.len() <= MAX_ATTACHMENTS) else {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("attachments")).with("maximum", json!(MAX_ATTACHMENTS)));
    };
    static B64: OnceLock<Regex> = OnceLock::new();
    let mut list = vec![];
    for (i, item) in items.iter().enumerate() {
        let invalid = || AppError::new("REQUEST_INVALID").with("field", json!(format!("attachments[{i}]")));
        let empty = Map::new();
        let a = item.as_object().unwrap_or(&empty);
        let Some(name) = a.get("name").and_then(Value::as_str) else { return Err(invalid()) };
        let name = js_slice(name, 200).to_string();
        match a.get("image") {
            None | Some(Value::Null) => {}
            Some(image) => {
                let media_type = image.get("media_type").and_then(Value::as_str).and_then(|t| IMAGE_TYPES.iter().find(|x| **x == t));
                let data = image.get("data").and_then(Value::as_str);
                match (media_type, data) {
                    (Some(m), Some(d)) if d.len() <= MAX_IMAGE_BASE64 && re(&B64, r"^[A-Za-z0-9+/]+={0,2}$").is_match(d) => {
                        list.push((name, String::new(), Some(AiImage { media_type: m.to_string(), data: d.to_string() })));
                        continue;
                    }
                    _ => return Err(invalid()),
                }
            }
        }
        let Some(text) = a.get("text").and_then(Value::as_str) else { return Err(invalid()) };
        list.push((name, chars_prefix(text, MAX_ATTACHMENT_CHARS).to_string(), None));
    }
    if list.iter().filter(|a| a.2.is_some()).count() > MAX_ATTACHED_IMAGES {
        return Err(AppError::new("REQUEST_INVALID").with("field", json!("attachments")).with("maximum_images", json!(MAX_ATTACHED_IMAGES)));
    }
    Ok(list)
}

/// An attachment as a copilot request carries it.
pub type Attachment = (String, String, Option<AiImage>);

/// `attachTo`: the payload with the texts, the system with the rule, the images beside.
pub fn attach_to(payload: Value, system: String, attachments: &[Attachment]) -> (Value, String, Vec<AiImage>) {
    if attachments.is_empty() {
        return (payload, system, vec![]);
    }
    let used = js_stringify(&payload).len() as i64;
    let mut payload = payload;
    if let Value::Object(m) = &mut payload {
        m.insert("attachments".into(), attachments_payload(attachments, used));
    }
    (payload, system + crate::prompts::ATTACHMENTS_RULE, attachments.iter().filter_map(|a| a.2.clone()).collect())
}

/// `attachmentsPayload`: the files share the room evenly; what a short one leaves goes on.
pub fn attachments_payload(attachments: &[Attachment], used_bytes: i64) -> Value {
    let room = ((MAX_PAYLOAD_BYTES as i64 - PAYLOAD_RESERVE_BYTES - used_bytes) as f64 / 1.5).floor() as i64;
    let mut left = MAX_TURN_CHARS.min(room).max(1_000);
    let texts = attachments.iter().filter(|a| a.2.is_none()).count() as i64;
    let mut image = 0;
    let mut text = 0i64;
    Value::Array(
        attachments
            .iter()
            .map(|(name, body, img)| {
                if img.is_some() {
                    image += 1;
                    return json!({ "name": name, "image": image });
                }
                let share = (left as f64 / (texts - text) as f64).floor() as i64;
                text += 1;
                let len = chars_len(body) as i64;
                let kept = chars_prefix(body, share.max(0) as usize);
                left -= len.min(share);
                if len > share {
                    json!({ "name": name, "text": kept, "truncated": true })
                } else {
                    json!({ "name": name, "text": kept })
                }
            })
            .collect(),
    )
}

// ── PDF ───────────────────────────────────────────────────────────────────────

fn read_pdf(bytes: &[u8]) -> Result<(String, usize), AppError> {
    let pages = std::panic::catch_unwind(|| crate::pdf::pdf_pages(bytes)).ok().flatten().ok_or_else(|| unreadable("pdf_illisible"))?;
    let total = pages.len();
    let texts: Vec<String> = pages
        .iter()
        .enumerate()
        .filter_map(|(i, p)| {
            let t = js_trim(p);
            if t.is_empty() {
                None
            } else {
                Some(format!("--- Page {} ---\n{t}", i + 1))
            }
        })
        .collect();
    if texts.is_empty() {
        return Err(unreadable("pdf_sans_texte"));
    }
    Ok((texts.join("\n\n"), total))
}

// ── Office and OpenDocument: a zip of XML ─────────────────────────────────────

type Zip<'a> = Vec<(String, Entry<'a>)>;

#[derive(Clone, Copy)]
struct Entry<'a> {
    buffer: &'a [u8],
    method: u16,
    size: usize,
    local: usize,
}

fn u16_at(b: &[u8], i: usize) -> Option<usize> {
    Some(u16::from_le_bytes(b.get(i..i + 2)?.try_into().ok()?) as usize)
}

fn u32_at(b: &[u8], i: usize) -> Option<usize> {
    Some(u32::from_le_bytes(b.get(i..i + 4)?.try_into().ok()?) as usize)
}

/// `readZip`: the central directory is the truth.
fn read_zip(buffer: &[u8]) -> Option<Zip<'_>> {
    let mut entries: Zip = vec![];
    let mut end = None;
    if buffer.len() >= 22 {
        let low = buffer.len().saturating_sub(65_557);
        let mut i = buffer.len() - 22;
        loop {
            if u32_at(buffer, i)? == 0x0605_4b50 {
                end = Some(i);
                break;
            }
            if i == low {
                break;
            }
            i -= 1;
        }
    }
    let end = end?;
    let count = u16_at(buffer, end + 10)?;
    let mut at = u32_at(buffer, end + 16)?;
    for _ in 0..count {
        if u32_at(buffer, at)? != 0x0201_4b50 {
            return None;
        }
        let method = u16_at(buffer, at + 10)? as u16;
        let size = u32_at(buffer, at + 20)?;
        let name_length = u16_at(buffer, at + 28)?;
        let extra_length = u16_at(buffer, at + 30)?;
        let comment_length = u16_at(buffer, at + 32)?;
        let local = u32_at(buffer, at + 42)?;
        let name = String::from_utf8_lossy(buffer.get(at + 46..at + 46 + name_length)?).to_string();
        at += 46 + name_length + extra_length + comment_length;
        let entry = Entry { buffer, method, size, local };
        match entries.iter_mut().find(|(n, _)| *n == name) {
            Some(e) => e.1 = entry,
            None => entries.push((name, entry)),
        }
    }
    Some(entries)
}

impl Entry<'_> {
    fn read(&self) -> Result<Vec<u8>, ()> {
        let b = self.buffer;
        if u32_at(b, self.local).ok_or(())? != 0x0403_4b50 {
            return Err(());
        }
        let start = self.local + 30 + u16_at(b, self.local + 26).ok_or(())? + u16_at(b, self.local + 28).ok_or(())?;
        let data = &b[start.min(b.len())..(start + self.size).min(b.len())];
        match self.method {
            0 => Ok(data.to_vec()),
            8 => {
                let mut out = vec![];
                let mut decoder = flate2::read::DeflateDecoder::new(data).take(MAX_INFLATED_BYTES + 1);
                decoder.read_to_end(&mut out).map_err(|_| ())?;
                if out.len() as u64 > MAX_INFLATED_BYTES {
                    return Err(());
                }
                Ok(out)
            }
            _ => Err(()),
        }
    }
}

fn has(zip: &Zip, path: &str) -> bool {
    zip.iter().any(|(n, _)| n == path)
}

fn xml(zip: &Zip, path: &str) -> Result<Option<String>, ()> {
    match zip.iter().find(|(n, _)| n == path) {
        None => Ok(None),
        Some((_, e)) => Ok(Some(String::from_utf8_lossy(&e.read()?).to_string())),
    }
}

fn read_office(bytes: &[u8]) -> Result<(&'static str, String, usize), AppError> {
    let zip = read_zip(bytes).ok_or_else(|| unreadable("archive_illisible"))?;
    let outcome = (|| -> Result<Option<(&'static str, String, usize)>, ()> {
        if has(&zip, "xl/workbook.xml") {
            return read_workbook(&zip).map(Some);
        }
        if has(&zip, "word/document.xml") {
            return Ok(Some(("document", word_text(&xml(&zip, "word/document.xml")?.unwrap_or_default()), 1)));
        }
        if has(&zip, "ppt/presentation.xml") {
            return read_slides(&zip).map(Some);
        }
        if let Some(content) = xml(&zip, "content.xml")? {
            let mime = xml(&zip, "mimetype")?.unwrap_or_default();
            let kind = if mime.contains("spreadsheet") {
                "sheet"
            } else if mime.contains("presentation") {
                "slides"
            } else {
                "document"
            };
            return Ok(Some((kind, open_document_text(&content), 1)));
        }
        Ok(None)
    })();
    match outcome {
        Ok(Some(read)) => Ok(read),
        Ok(None) => Err(unreadable("format_inconnu")),
        Err(()) => Err(unreadable("document_illisible")),
    }
}

/// An element of a walk through XML.
enum Event {
    Open(String, Vec<(String, String)>),
    Text(String),
    Close(String),
}

/// XML entities, as htmlparser2 in XML mode decodes them.
fn decode_entities(s: &str) -> String {
    if !s.contains('&') {
        return s.to_string();
    }
    static ENTITY: OnceLock<Regex> = OnceLock::new();
    re(&ENTITY, r"&(?:#[xX]([0-9a-fA-F]+)|#([0-9]+)|(amp|lt|gt|quot|apos));")
        .replace_all(s, |c: &regex::Captures| {
            if let Some(hex) = c.get(1) {
                return u32::from_str_radix(hex.as_str(), 16).ok().and_then(char::from_u32).unwrap_or('\u{FFFD}').to_string();
            }
            if let Some(dec) = c.get(2) {
                return dec.as_str().parse::<u32>().ok().and_then(char::from_u32).unwrap_or('\u{FFFD}').to_string();
            }
            match &c[3] {
                "amp" => "&",
                "lt" => "<",
                "gt" => ">",
                "quot" => "\"",
                _ => "'",
            }
            .to_string()
        })
        .to_string()
}

/// `walk`: element by element, as htmlparser2 in XML mode.
fn walk(xml: &str, mut on: impl FnMut(Event)) {
    let mut rest = xml;
    while !rest.is_empty() {
        let Some(lt) = rest.find('<') else {
            on(Event::Text(decode_entities(rest)));
            break;
        };
        if lt > 0 {
            on(Event::Text(decode_entities(&rest[..lt])));
        }
        rest = &rest[lt..];
        if let Some(r) = rest.strip_prefix("<!--") {
            rest = r.find("-->").map(|i| &r[i + 3..]).unwrap_or("");
            continue;
        }
        if let Some(r) = rest.strip_prefix("<![CDATA[") {
            let (text, after) = r.find("]]>").map(|i| (&r[..i], &r[i + 3..])).unwrap_or((r, ""));
            on(Event::Text(text.to_string()));
            rest = after;
            continue;
        }
        if rest.starts_with("<?") || rest.starts_with("<!") {
            rest = rest.find('>').map(|i| &rest[i + 1..]).unwrap_or("");
            continue;
        }
        let Some(gt) = tag_end(rest) else { break };
        let inner = &rest[1..gt];
        rest = &rest[gt + 1..];
        if let Some(name) = inner.strip_prefix('/') {
            on(Event::Close(name.trim().to_string()));
            continue;
        }
        let self_closing = inner.ends_with('/');
        let inner = inner.strip_suffix('/').unwrap_or(inner);
        let name_end = inner.find(|c: char| c.is_whitespace()).unwrap_or(inner.len());
        let name = inner[..name_end].to_string();
        on(Event::Open(name.clone(), attributes(&inner[name_end..])));
        if self_closing {
            on(Event::Close(name));
        }
    }
}

fn tag_end(s: &str) -> Option<usize> {
    let mut quote: Option<char> = None;
    for (i, c) in s.char_indices() {
        match quote {
            Some(q) if c == q => quote = None,
            Some(_) => {}
            None if c == '"' || c == '\'' => quote = Some(c),
            None if c == '>' => return Some(i),
            None => {}
        }
    }
    None
}

fn attributes(s: &str) -> Vec<(String, String)> {
    static ATTR: OnceLock<Regex> = OnceLock::new();
    re(&ATTR, r#"([^\s=/>]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?"#)
        .captures_iter(s)
        .map(|c| {
            let v = c.get(2).or(c.get(3)).or(c.get(4)).map(|m| m.as_str()).unwrap_or("");
            (c[1].to_string(), decode_entities(v))
        })
        .collect()
}

fn attr<'a>(a: &'a [(String, String)], name: &str) -> Option<&'a str> {
    a.iter().find(|(k, _)| k == name).map(|(_, v)| v.as_str())
}

fn read_workbook(zip: &Zip) -> Result<(&'static str, String, usize), ()> {
    let mut shared: Vec<String> = vec![];
    if let Some(strings) = xml(zip, "xl/sharedStrings.xml")? {
        let mut current: Option<Vec<String>> = None;
        let (mut in_text, mut phonetic) = (false, false);
        walk(&strings, |e| match e {
            Event::Open(n, _) if n == "si" => current = Some(vec![]),
            Event::Open(n, _) if n == "rPh" => phonetic = true,
            Event::Open(n, _) if n == "t" && !phonetic => in_text = true,
            Event::Text(t) if in_text => {
                if let Some(c) = current.as_mut() {
                    c.push(t)
                }
            }
            Event::Close(n) if n == "t" => in_text = false,
            Event::Close(n) if n == "rPh" => phonetic = false,
            Event::Close(n) if n == "si" => shared.push(current.take().unwrap_or_default().join("")),
            _ => {}
        });
    }
    let mut targets: Vec<(String, String)> = vec![];
    static TARGET: OnceLock<Regex> = OnceLock::new();
    walk(&xml(zip, "xl/_rels/workbook.xml.rels")?.unwrap_or_default(), |e| {
        if let Event::Open(n, a) = e {
            if n == "Relationship" {
                if let (Some(id), Some(target)) = (attr(&a, "Id"), attr(&a, "Target")) {
                    let path = re(&TARGET, r"^/?(xl/)?").replace(target, "xl/").to_string();
                    match targets.iter_mut().find(|(k, _)| k == id) {
                        Some(t) => t.1 = path,
                        None => targets.push((id.to_string(), path)),
                    }
                }
            }
        }
    });
    let mut sheets: Vec<(String, String)> = vec![];
    walk(&xml(zip, "xl/workbook.xml")?.unwrap_or_default(), |e| {
        if let Event::Open(n, a) = e {
            let id = attr(&a, "r:id").or_else(|| a.iter().find(|(k, _)| k.ends_with(":id")).map(|(_, v)| v.as_str()));
            let path = id.and_then(|id| targets.iter().find(|(k, _)| k == id)).map(|(_, p)| p.clone());
            if let Some(path) = path {
                if n == "sheet" && has(zip, &path) {
                    sheets.push((attr(&a, "name").map(str::to_string).unwrap_or_else(|| path.clone()), path));
                }
            }
        }
    });
    let mut blocks = vec![];
    for (name, path) in &sheets {
        let mut rows: Vec<Vec<String>> = vec![];
        let mut row: Option<Vec<String>> = None;
        let mut column = 0usize;
        let mut kind = String::new();
        let mut value: Vec<String> = vec![];
        let mut in_value = false;
        walk(&xml(zip, path)?.unwrap_or_default(), |e| match e {
            Event::Open(n, a) => {
                if n == "row" {
                    row = Some(vec![]);
                } else if n == "c" {
                    kind = attr(&a, "t").unwrap_or("").to_string();
                    value = vec![];
                    column = match attr(&a, "r") {
                        None => row.as_ref().map(Vec::len).unwrap_or(0),
                        Some(r) => column_index(r),
                    };
                } else if n == "v" || n == "t" {
                    in_value = true;
                }
            }
            Event::Text(t) => {
                if in_value {
                    value.push(t)
                }
            }
            Event::Close(n) => {
                if n == "v" || n == "t" {
                    in_value = false;
                } else if n == "c" {
                    if let Some(r) = row.as_mut() {
                        let raw = value.join("");
                        let shown = match kind.as_str() {
                            "s" => {
                                let i = js_to_number(&raw);
                                if i.fract() == 0.0 && i >= 0.0 && (i as usize) < shared.len() {
                                    shared[i as usize].clone()
                                } else {
                                    String::new()
                                }
                            }
                            "b" => if raw == "1" { "VRAI" } else { "FAUX" }.to_string(),
                            _ => raw,
                        };
                        while r.len() < column {
                            r.push(String::new());
                        }
                        let shown = cell(&shown);
                        if column < r.len() {
                            r[column] = shown;
                        } else {
                            r.push(shown);
                        }
                    }
                } else if n == "row" {
                    if let Some(r) = row.take() {
                        if rows.len() < MAX_SHEET_ROWS && r.iter().any(|v| !v.is_empty()) {
                            rows.push(r);
                        }
                    }
                }
            }
        });
        blocks.push(format!(
            "--- Feuille « {name} » ({} lignes) ---\n{}",
            rows.len(),
            rows.iter().map(|r| r.join("\t")).collect::<Vec<_>>().join("\n")
        ));
    }
    Ok(("sheet", blocks.join("\n\n"), sheets.len()))
}

/// `C12` → 2.
fn column_index(reference: &str) -> usize {
    let letters: String = reference.chars().take_while(|c| c.is_ascii_alphabetic()).collect::<String>().to_uppercase();
    let letters = if letters.is_empty() { "A".to_string() } else { letters };
    let index = letters.bytes().fold(0i64, |acc, b| acc * 26 + (b as i64 - 64));
    (index - 1).max(0) as usize
}

fn cell(value: &str) -> String {
    static WS: OnceLock<Regex> = OnceLock::new();
    js_trim(&re(&WS, r"[\t\r\n]+").replace_all(value, " ")).to_string()
}

fn word_text(document: &str) -> String {
    let mut out = String::new();
    let mut in_text = false;
    walk(document, |e| match e {
        Event::Open(n, _) if n == "w:t" => in_text = true,
        Event::Open(n, _) if n == "w:tab" => out.push('\t'),
        Event::Open(n, _) if n == "w:br" || n == "w:cr" => out.push('\n'),
        Event::Text(t) if in_text => out.push_str(&t),
        Event::Close(n) if n == "w:t" => in_text = false,
        Event::Close(n) if n == "w:p" => out.push('\n'),
        Event::Close(n) if n == "w:tc" => out.push('\t'),
        _ => {}
    });
    out
}

fn read_slides(zip: &Zip) -> Result<(&'static str, String, usize), ()> {
    static SLIDE: OnceLock<Regex> = OnceLock::new();
    let slide = re(&SLIDE, r"^ppt/slides/slide([0-9]+)\.xml$");
    let mut slides: Vec<(f64, &str)> =
        zip.iter().filter_map(|(path, _)| slide.captures(path).map(|c| (c[1].parse::<f64>().unwrap_or(f64::NAN), path.as_str()))).filter(|(n, _)| n.is_finite()).collect();
    slides.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let mut blocks = vec![];
    for (n, path) in &slides {
        let mut out = String::new();
        let mut in_text = false;
        walk(&xml(zip, path)?.unwrap_or_default(), |e| match e {
            Event::Open(n, _) if n == "a:t" => in_text = true,
            Event::Text(t) if in_text => out.push_str(&t),
            Event::Close(n) if n == "a:t" => in_text = false,
            Event::Close(n) if n == "a:p" => out.push('\n'),
            _ => {}
        });
        blocks.push(format!("--- Diapositive {} ---\n{}", crate::js::js_number_string(*n), js_trim(&out)));
    }
    Ok(("slides", blocks.join("\n\n"), slides.len()))
}

fn open_document_text(content: &str) -> String {
    let mut out: Vec<String> = vec![];
    let mut depth = 0i32;
    walk(content, |e| match e {
        Event::Open(n, _) => match n.as_str() {
            "office:body" => depth += 1,
            "text:tab" => out.push("\t".into()),
            "text:line-break" => out.push("\n".into()),
            "text:s" => out.push(" ".into()),
            _ => {}
        },
        Event::Text(t) => {
            if depth > 0 {
                out.push(t)
            }
        }
        Event::Close(n) => match n.as_str() {
            "office:body" => depth -= 1,
            "table:table-cell" => out.push("\t".into()),
            "table:table-row" | "text:h" => out.push("\n".into()),
            "text:p" => {
                let tab = out.last().map(|s| s == "\t").unwrap_or(false);
                out.push(if tab { " " } else { "\n" }.into());
            }
            _ => {}
        },
    });
    static TABS: OnceLock<Regex> = OnceLock::new();
    re(&TABS, r"\t+\n").replace_all(&out.concat(), "\n").to_string()
}

// ── Plain text ────────────────────────────────────────────────────────────────

fn image_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, 0x50, 0x4e, 0x47]) {
        return Some("image/png");
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some("image/jpeg");
    }
    if bytes.starts_with(&[0x47, 0x49, 0x46, 0x38]) {
        return Some("image/gif");
    }
    if bytes.starts_with(&[0x52, 0x49, 0x46, 0x46]) && bytes.get(8) == Some(&0x57) {
        return Some("image/webp");
    }
    None
}

/// UTF-8 when it is (its BOM dropped), Windows-1252 otherwise.
fn decode_text(bytes: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.strip_prefix('\u{FEFF}').unwrap_or(s).to_string();
    }
    const HIGH: [u32; 32] = [
        0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8D, 0x017D, 0x8F, 0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
        0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x017E, 0x0178,
    ];
    bytes
        .iter()
        .map(|&b| if (0x80..0xA0).contains(&b) { char::from_u32(HIGH[(b - 0x80) as usize]).unwrap_or('\u{FFFD}') } else { b as char })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn zip(files: &[(&str, &str)]) -> Vec<u8> {
        let mut out = vec![];
        let mut central = vec![];
        for (name, body) in files {
            let local = out.len() as u32;
            out.extend(0x0403_4b50u32.to_le_bytes());
            out.extend([20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            out.extend((body.len() as u32).to_le_bytes());
            out.extend((body.len() as u32).to_le_bytes());
            out.extend((name.len() as u16).to_le_bytes());
            out.extend(0u16.to_le_bytes());
            out.extend(name.as_bytes());
            out.extend(body.as_bytes());
            central.extend(0x0201_4b50u32.to_le_bytes());
            central.extend([20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            central.extend((body.len() as u32).to_le_bytes());
            central.extend((body.len() as u32).to_le_bytes());
            central.extend((name.len() as u16).to_le_bytes());
            central.extend([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            central.extend(local.to_le_bytes());
            central.extend(name.as_bytes());
        }
        let start = out.len() as u32;
        out.extend(&central);
        out.extend(0x0605_4b50u32.to_le_bytes());
        out.extend([0, 0, 0, 0]);
        out.extend((files.len() as u16).to_le_bytes());
        out.extend((files.len() as u16).to_le_bytes());
        out.extend((central.len() as u32).to_le_bytes());
        out.extend(start.to_le_bytes());
        out.extend([0, 0]);
        out
    }

    #[test]
    fn reads_a_word_document_and_a_workbook() {
        let docx = zip(&[("word/document.xml", "<w:document><w:p><w:r><w:t>Bonjour &amp; </w:t><w:tab/><w:t>monde</w:t></w:r></w:p></w:document>")]);
        let read = extract_attachment(" lettre.docx ", &docx).unwrap();
        assert_eq!((read.kind, read.text.as_str(), read.parts), ("document", "Bonjour & \tmonde", Some(1)));
        let xlsx = zip(&[
            ("xl/workbook.xml", r#"<workbook><sheets><sheet name="Clients" r:id="rId1"/></sheets></workbook>"#),
            ("xl/_rels/workbook.xml.rels", r#"<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>"#),
            ("xl/sharedStrings.xml", "<sst><si><t>Nom</t></si><si><t>Ada</t><rPh><t>x</t></rPh></si></sst>"),
            ("xl/worksheets/sheet1.xml", r#"<sheetData><row><c r="A1" t="s"><v>0</v></c><c r="C1"><v>3</v></c></row><row><c r="A2" t="s"><v>1</v></c><c r="B2" t="b"><v>1</v></c></row></sheetData>"#),
        ]);
        let read = extract_attachment("t.xlsx", &xlsx).unwrap();
        assert_eq!(read.text, "--- Feuille « Clients » (2 lignes) ---\nNom\t\t3\nAda\tVRAI");
        assert_eq!(read.parts, Some(1));
    }

    #[test]
    fn text_images_and_refusals() {
        let read = extract_attachment("", "a \r\n\r\n\r\n\r\nb".as_bytes()).unwrap();
        assert_eq!((read.name.as_str(), read.kind, read.text.as_str()), ("document", "text", "a\n\nb"));
        assert_eq!(extract_attachment("x.csv", &[0xe9, b';', b'1']).unwrap().text, "é;1");
        assert_eq!(extract_attachment("i", &[0x89, 0x50, 0x4e, 0x47, 0]).unwrap().media_type, Some("image/png"));
        assert_eq!(extract_attachment("x", b"").unwrap_err().details["reason"], json!("fichier_vide"));
        assert_eq!(extract_attachment("x.bin", &[1, 0, 2]).unwrap_err().details["reason"], json!("format_inconnu"));
        assert_eq!(extract_attachment("x.txt", b"  \n ").unwrap_err().details["reason"], json!("aucun_texte"));
        assert_eq!(extract_attachment("x.pdf", b"%PDF-1.4 rien").unwrap_err().details["reason"], json!("pdf_illisible"));
        assert_eq!(extract_attachment("x.zip", b"PK\x03\x04rien").unwrap_err().details["reason"], json!("archive_illisible"));
    }

    #[test]
    fn attachments_share_the_room() {
        let list = read_attachments(Some(&json!([{ "name": "a", "text": "x".repeat(30_000) }, { "name": "b", "text": "court" }]))).unwrap();
        assert_eq!(list[0].1.len(), 24_000);
        let p = attachments_payload(&list, 100);
        assert_eq!(p[0]["text"].as_str().unwrap().len(), 12_000);
        assert_eq!(p[0]["truncated"], json!(true));
        assert_eq!(p[1], json!({ "name": "b", "text": "court" }));
        assert_eq!(read_attachments(Some(&json!([{ "name": 1 }]))).unwrap_err().details["field"], json!("attachments[0]"));
        assert_eq!(read_attachments(Some(&json!({}))).unwrap_err().details["maximum"], json!(5));
    }
}
