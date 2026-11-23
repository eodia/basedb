//! `sanitize-html` 2.18 over `htmlparser2` 12, as `records/rich-text.ts` uses them: the
//! tokenizer, the tree builder's implied closes and the sanitizer's callbacks, ported state
//! for state so that a rich text is stored byte for byte as Node stores it.
//!
//! Only what the two profiles reach is ported (`discard` mode, no style, no class, no
//! `nestingLimit`, no `exclusiveFilter`); everything the parser does is.

use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;

use crate::entities::ENTITIES;
use crate::js::js_trim;

// ---------------------------------------------------------------------------------------
// Entities (`entities/decode`, the binary trie read as the sorted list it encodes).

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Legacy,
    Attribute,
}

fn entity(name: &[u8]) -> Option<&'static str> {
    let name = std::str::from_utf8(name).ok()?;
    ENTITIES.binary_search_by(|(n, _)| n.cmp(&name)).ok().map(|i| ENTITIES[i].1)
}

fn extends(prefix: &[u8]) -> bool {
    let Ok(prefix) = std::str::from_utf8(prefix) else { return false };
    let i = ENTITIES.partition_point(|(n, _)| *n < prefix);
    ENTITIES.get(i).is_some_and(|(n, _)| n.starts_with(prefix))
}

fn replace_code_point(cp: u64) -> char {
    const C1: [u32; 32] = [
        8364, 0, 8218, 402, 8222, 8230, 8224, 8225, 710, 8240, 352, 8249, 338, 0, 381, 0, 0, 8216, 8217, 8220, 8221, 8226, 8211, 8212, 732, 8482,
        353, 8250, 339, 0, 382, 376,
    ];
    if cp == 0 || (0xd800..=0xdfff).contains(&cp) || cp > 0x10ffff {
        return '\u{fffd}';
    }
    let cp = cp as u32;
    let cp = if (128..=159).contains(&cp) && C1[(cp - 128) as usize] != 0 { C1[(cp - 128) as usize] } else { cp };
    char::from_u32(cp).unwrap_or('\u{fffd}')
}

/// The character reference starting at `amp` (an `&`): what it decodes to and how many
/// bytes it spans, or nothing when the `&` is a plain character.
fn decode_entity(input: &[u8], amp: usize, mode: Mode) -> Option<(String, usize)> {
    let start = amp + 1;
    if input.get(start) == Some(&b'#') {
        let mut i = start + 1;
        let mut consumed = 2;
        let hex = input.get(i).is_some_and(|c| c | 0x20 == b'x');
        if i >= input.len() {
            return None;
        }
        let expected = if hex {
            i += 1;
            consumed += 1;
            3
        } else {
            2
        };
        let mut value: u64 = 0;
        while let Some(&c) = input.get(i) {
            let digit = if c.is_ascii_digit() {
                (c - b'0') as u64
            } else if hex && (c | 0x20).is_ascii_lowercase() && (c | 0x20) <= b'f' {
                ((c | 0x20) - b'a' + 10) as u64
            } else {
                break;
            };
            value = value.saturating_mul(if hex { 16 } else { 10 }).saturating_add(digit);
            consumed += 1;
            i += 1;
        }
        if consumed <= expected {
            return None;
        }
        if input.get(i) == Some(&b';') {
            consumed += 1;
        }
        return Some((replace_code_point(value).to_string(), consumed));
    }
    let mut legacy: Option<usize> = None;
    let mut i = start;
    loop {
        let prefix = &input[start..i];
        if i > start && entity(prefix).is_some() {
            legacy = Some(i);
        }
        let Some(&c) = input.get(i) else {
            return match legacy {
                Some(end) if mode != Mode::Attribute || end == i => Some((entity(&input[start..end])?.to_string(), end - amp)),
                _ => None,
            };
        };
        if c == b';' && i > start {
            let mut full = prefix.to_vec();
            full.push(b';');
            if let Some(v) = entity(&full) {
                return Some((v.to_string(), i + 1 - amp));
            }
        }
        let mut next = prefix.to_vec();
        next.push(c);
        if c != b';' && extends(&next) {
            i += 1;
            continue;
        }
        return match legacy {
            Some(end) if mode != Mode::Attribute || (end == i && !(c == b'=' || c.is_ascii_alphanumeric())) => {
                Some((entity(&input[start..end])?.to_string(), end - amp))
            }
            _ => None,
        };
    }
}

// ---------------------------------------------------------------------------------------
// Tokenizer (`htmlparser2/Tokenizer`), HTML mode, entities decoded, one buffer.

#[derive(Clone, Copy, PartialEq, Debug)]
enum St {
    Text,
    BeforeTagName,
    InTagName,
    InSelfClosingTag,
    BeforeClosingTagName,
    InClosingTagName,
    AfterClosingTagName,
    BeforeAttributeName,
    InAttributeName,
    AfterAttributeName,
    BeforeAttributeValue,
    InAttrDq,
    InAttrSq,
    InAttrNq,
    BeforeDeclaration,
    InDeclaration,
    BeforeComment,
    CdataSequence,
    DeclarationSequence,
    InSpecialComment,
    InCommentLike,
    SpecialStartSequence,
    InSpecialTag,
    InPlainText,
}

const CDATA: &[u8] = b"CDATA[";
const CDATA_END: &[u8] = b"]]>";
const COMMENT_END: &[u8] = b"--!>";
const DOCTYPE: &[u8] = b"doctype";
const IFRAME_END: &[u8] = b"</iframe";
const NOEMBED_END: &[u8] = b"</noembed";
const NOFRAMES_END: &[u8] = b"</noframes";
const PLAINTEXT: &[u8] = b"</plaintext";
const SCRIPT_END: &[u8] = b"</script";
const STYLE_END: &[u8] = b"</style";
const TITLE_END: &[u8] = b"</title";
const TEXTAREA_END: &[u8] = b"</textarea";
const XMP_END: &[u8] = b"</xmp";

fn special_start(c: u8) -> Option<&'static [u8]> {
    match c | 0x20 {
        b'i' => Some(IFRAME_END),
        b'n' => Some(NOEMBED_END),
        b'p' => Some(PLAINTEXT),
        b's' => Some(SCRIPT_END),
        b't' => Some(TITLE_END),
        b'x' => Some(XMP_END),
        _ => None,
    }
}

fn ws(c: u8) -> bool {
    matches!(c, b' ' | b'\n' | b'\t' | 0x0c | b'\r')
}

fn end_of_tag_section(c: u8) -> bool {
    c == b'/' || c == b'>' || ws(c)
}

fn same(a: &[u8], b: &[u8]) -> bool {
    std::ptr::eq(a, b)
}

struct Tokenizer<'a> {
    buf: &'a [u8],
    state: St,
    section_start: isize,
    index: usize,
    is_special: bool,
    seq: &'static [u8],
    seq_index: usize,
}

impl<'a> Tokenizer<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Tokenizer { buf, state: St::Text, section_start: 0, index: 0, is_special: false, seq: &[], seq_index: 0 }
    }

    fn ss(&self) -> usize {
        self.section_start.max(0) as usize
    }

    fn fast_forward_to(&mut self, c: u8) -> bool {
        loop {
            self.index += 1;
            if self.index >= self.buf.len() {
                break;
            }
            if self.buf[self.index] == c {
                return true;
            }
        }
        self.index = self.buf.len() - 1;
        false
    }

    /// An `&` in text or in a value: decoded on the spot (the decoder reads ahead anyway).
    fn entity(&mut self, p: &mut Parser, attribute: bool) {
        let mode = if attribute { Mode::Attribute } else { Mode::Legacy };
        let Some((text, consumed)) = decode_entity(self.buf, self.index, mode) else { return };
        let entity_start = self.index;
        if self.ss() < entity_start {
            if attribute {
                p.onattribdata(self.ss(), entity_start);
            } else {
                p.ontext(self.ss(), entity_start);
            }
        }
        self.section_start = (entity_start + consumed) as isize;
        self.index = entity_start + consumed - 1;
        if attribute {
            p.attribvalue.push_str(&text);
        } else {
            p.ontext_str(&text);
        }
    }

    fn state_text(&mut self, c: u8, p: &mut Parser) {
        if c == b'<' {
            if self.index as isize > self.section_start {
                p.ontext(self.ss(), self.index);
            }
            self.state = St::BeforeTagName;
            self.section_start = self.index as isize;
        } else if c == b'&' {
            self.entity(p, false);
        }
    }

    fn enter_tag_body(&mut self) {
        if same(self.seq, PLAINTEXT) {
            self.seq = &[];
            self.state = St::InPlainText;
        } else if self.is_special {
            self.state = St::InSpecialTag;
            self.seq_index = 0;
        } else {
            self.state = St::Text;
        }
    }

    fn state_special_start_sequence(&mut self, c: u8, p: &mut Parser) {
        let lower = c | 0x20;
        if self.seq_index < self.seq.len() {
            if lower == self.seq[self.seq_index] {
                self.seq_index += 1;
                return;
            }
            if self.seq_index == 3 {
                if same(self.seq, SCRIPT_END) && lower == STYLE_END[3] {
                    self.seq = STYLE_END;
                    self.seq_index = 4;
                    return;
                }
                if same(self.seq, TITLE_END) && lower == TEXTAREA_END[3] {
                    self.seq = TEXTAREA_END;
                    self.seq_index = 4;
                    return;
                }
            } else if self.seq_index == 4 && same(self.seq, NOEMBED_END) && lower == NOFRAMES_END[4] {
                self.seq = NOFRAMES_END;
                self.seq_index = 5;
                return;
            }
        } else if end_of_tag_section(c) {
            self.seq_index = 0;
            self.state = St::InTagName;
            self.state_in_tag_name(c, p);
            return;
        }
        self.is_special = false;
        self.seq = &[];
        self.seq_index = 0;
        self.state = St::InTagName;
        self.state_in_tag_name(c, p);
    }

    fn state_cdata_sequence(&mut self, c: u8, p: &mut Parser) {
        if c == CDATA[self.seq_index] {
            self.seq_index += 1;
            if self.seq_index == CDATA.len() {
                self.state = St::InCommentLike;
                self.seq = CDATA_END;
                self.seq_index = 0;
                self.section_start = self.index as isize + 1;
            }
        } else {
            self.seq_index = 0;
            self.state = St::InSpecialComment;
            self.state_in_special_comment(c, p);
        }
    }

    fn emit_comment(&mut self) {
        self.seq_index = 0;
        self.section_start = self.index as isize + 1;
        self.state = St::Text;
    }

    fn state_in_comment_like(&mut self, c: u8, p: &mut Parser) {
        let comment = same(self.seq, COMMENT_END);
        if comment
            && ((self.seq_index <= 1 && self.index as isize == self.section_start + self.seq_index as isize && c == b'>') || (self.seq_index == 2 && c == b'>'))
        {
            self.emit_comment();
        } else if comment && self.seq_index == self.seq.len() - 1 && c != b'>' {
            self.seq_index = usize::from(c == b'-');
        } else if c == self.seq[self.seq_index] {
            self.seq_index += 1;
            if self.seq_index == self.seq.len() {
                if same(self.seq, CDATA_END) {
                    p.oncdata(self.ss(), self.index - 2);
                }
                self.seq_index = 0;
                self.section_start = self.index as isize + 1;
                self.state = St::Text;
            }
        } else if self.seq_index == 0 {
            if self.fast_forward_to(self.seq[0]) {
                self.seq_index = 1;
            }
        } else if c != self.seq[self.seq_index - 1] {
            self.seq_index = 0;
        }
    }

    fn state_in_special_tag(&mut self, c: u8, p: &mut Parser) {
        if self.seq_index == self.seq.len() {
            if end_of_tag_section(c) {
                let end_of_text = self.index - self.seq.len();
                if (self.section_start) < end_of_text as isize {
                    p.ontext(self.ss(), end_of_text);
                }
                self.is_special = false;
                self.section_start = end_of_text as isize + 2;
                self.state_in_closing_tag_name(c, p);
                return;
            }
            self.seq_index = 0;
        }
        if (c | 0x20) == self.seq[self.seq_index] {
            self.seq_index += 1;
        } else if self.seq_index == 0 {
            if same(self.seq, TITLE_END) || same(self.seq, TEXTAREA_END) {
                if c == b'&' {
                    self.entity(p, false);
                }
            } else if self.fast_forward_to(b'<') {
                self.seq_index = 1;
            }
        } else {
            self.seq_index = usize::from(c == b'<');
        }
    }

    fn state_before_tag_name(&mut self, c: u8, p: &mut Parser) {
        if c == b'!' {
            self.state = St::BeforeDeclaration;
            self.section_start = self.index as isize + 1;
        } else if c == b'?' {
            self.state = St::InSpecialComment;
            self.section_start = self.index as isize;
        } else if c.is_ascii_alphabetic() {
            self.section_start = self.index as isize;
            let special = if p.in_foreign_context() { None } else { special_start(c) };
            match special {
                None => self.state = St::InTagName,
                Some(seq) => {
                    self.is_special = true;
                    self.seq = seq;
                    self.seq_index = 3;
                    self.state = St::SpecialStartSequence;
                }
            }
        } else if c == b'/' {
            self.state = St::BeforeClosingTagName;
        } else {
            self.state = St::Text;
            self.state_text(c, p);
        }
    }

    fn state_in_tag_name(&mut self, c: u8, p: &mut Parser) {
        if end_of_tag_section(c) {
            p.onopentagname(self.ss(), self.index);
            self.section_start = -1;
            self.state = St::BeforeAttributeName;
            self.state_before_attribute_name(c, p);
        }
    }

    fn state_before_closing_tag_name(&mut self, c: u8) {
        if ws(c) {
            self.state = St::InSpecialComment;
            self.section_start = self.index as isize;
        } else if c == b'>' {
            self.state = St::Text;
            self.section_start = self.index as isize + 1;
        } else {
            self.state = if c.is_ascii_alphabetic() { St::InClosingTagName } else { St::InSpecialComment };
            self.section_start = self.index as isize;
        }
    }

    fn state_in_closing_tag_name(&mut self, c: u8, p: &mut Parser) {
        if end_of_tag_section(c) {
            p.onclosetag(self.ss(), self.index);
            self.section_start = -1;
            self.state = St::AfterClosingTagName;
            self.state_after_closing_tag_name(c);
        }
    }

    fn state_after_closing_tag_name(&mut self, c: u8) {
        if c == b'>' || self.fast_forward_to(b'>') {
            self.state = St::Text;
            self.section_start = self.index as isize + 1;
        }
    }

    fn state_before_attribute_name(&mut self, c: u8, p: &mut Parser) {
        if c == b'>' {
            p.onopentagend();
            self.enter_tag_body();
            self.section_start = self.index as isize + 1;
        } else if c == b'/' {
            self.state = St::InSelfClosingTag;
        } else if !ws(c) {
            self.state = St::InAttributeName;
            self.section_start = self.index as isize;
        }
    }

    fn state_in_self_closing_tag(&mut self, c: u8, p: &mut Parser) {
        if c == b'>' {
            p.onselfclosingtag();
            self.section_start = self.index as isize + 1;
            self.enter_tag_body();
        } else if !ws(c) {
            self.state = St::BeforeAttributeName;
            self.state_before_attribute_name(c, p);
        }
    }

    fn state_in_attribute_name(&mut self, c: u8, p: &mut Parser) {
        if c == b'=' || end_of_tag_section(c) {
            p.onattribname(self.ss(), self.index);
            self.section_start = self.index as isize;
            self.state = St::AfterAttributeName;
            self.state_after_attribute_name(c, p);
        }
    }

    fn state_after_attribute_name(&mut self, c: u8, p: &mut Parser) {
        if c == b'=' {
            self.state = St::BeforeAttributeValue;
        } else if c == b'/' || c == b'>' {
            p.onattribend();
            self.section_start = -1;
            self.state = St::BeforeAttributeName;
            self.state_before_attribute_name(c, p);
        } else if !ws(c) {
            p.onattribend();
            self.state = St::InAttributeName;
            self.section_start = self.index as isize;
        }
    }

    fn state_before_attribute_value(&mut self, c: u8, p: &mut Parser) {
        if c == b'"' {
            self.state = St::InAttrDq;
            self.section_start = self.index as isize + 1;
        } else if c == b'\'' {
            self.state = St::InAttrSq;
            self.section_start = self.index as isize + 1;
        } else if !ws(c) {
            self.section_start = self.index as isize;
            self.state = St::InAttrNq;
            self.state_in_attr_nq(c, p);
        }
    }

    fn handle_in_attribute_value(&mut self, c: u8, quote: u8, p: &mut Parser) {
        if c == quote {
            p.onattribdata(self.ss(), self.index);
            self.section_start = -1;
            p.onattribend();
            self.state = St::BeforeAttributeName;
        } else if c == b'&' {
            self.entity(p, true);
        }
    }

    fn state_in_attr_nq(&mut self, c: u8, p: &mut Parser) {
        if ws(c) || c == b'>' {
            p.onattribdata(self.ss(), self.index);
            self.section_start = -1;
            p.onattribend();
            self.state = St::BeforeAttributeName;
            self.state_before_attribute_name(c, p);
        } else if c == b'&' {
            self.entity(p, true);
        }
    }

    fn state_before_declaration(&mut self, c: u8) {
        if c == b'[' {
            self.state = St::CdataSequence;
            self.seq_index = 0;
        } else if (c | 0x20) == DOCTYPE[0] {
            self.state = St::DeclarationSequence;
            self.seq = DOCTYPE;
            self.seq_index = 1;
        } else if c == b'>' {
            self.state = St::Text;
            self.section_start = self.index as isize + 1;
        } else if c == b'-' {
            self.state = St::BeforeComment;
        } else {
            self.state = St::InSpecialComment;
        }
    }

    fn state_declaration_sequence(&mut self, c: u8) {
        if self.seq_index == self.seq.len() {
            self.state = St::InDeclaration;
            self.state_in_declaration(c);
        } else if (c | 0x20) == self.seq[self.seq_index] {
            self.seq_index += 1;
        } else if c == b'>' {
            self.state = St::Text;
            self.section_start = self.index as isize + 1;
        } else {
            self.state = St::InSpecialComment;
        }
    }

    fn state_in_declaration(&mut self, c: u8) {
        if c == b'>' || self.fast_forward_to(b'>') {
            self.state = St::Text;
            self.section_start = self.index as isize + 1;
        }
    }

    fn state_before_comment(&mut self, c: u8) {
        if c == b'-' {
            self.state = St::InCommentLike;
            self.seq = COMMENT_END;
            self.seq_index = 0;
            self.section_start = self.index as isize + 1;
        } else if c == b'>' {
            self.state = St::Text;
            self.section_start = self.index as isize + 1;
        } else {
            self.state = St::InSpecialComment;
        }
    }

    fn state_in_special_comment(&mut self, c: u8, _p: &mut Parser) {
        if c == b'>' || self.fast_forward_to(b'>') {
            self.state = St::Text;
            self.section_start = self.index as isize + 1;
        }
    }

    fn run(&mut self, p: &mut Parser) {
        while self.index < self.buf.len() {
            let c = self.buf[self.index];
            match self.state {
                St::Text => self.state_text(c, p),
                St::InPlainText => self.index = self.buf.len() - 1,
                St::SpecialStartSequence => self.state_special_start_sequence(c, p),
                St::InSpecialTag => self.state_in_special_tag(c, p),
                St::CdataSequence => self.state_cdata_sequence(c, p),
                St::DeclarationSequence => self.state_declaration_sequence(c),
                St::InAttrDq => self.handle_in_attribute_value(c, b'"', p),
                St::InAttributeName => self.state_in_attribute_name(c, p),
                St::InCommentLike => self.state_in_comment_like(c, p),
                St::InSpecialComment => self.state_in_special_comment(c, p),
                St::BeforeAttributeName => self.state_before_attribute_name(c, p),
                St::InTagName => self.state_in_tag_name(c, p),
                St::InClosingTagName => self.state_in_closing_tag_name(c, p),
                St::BeforeTagName => self.state_before_tag_name(c, p),
                St::AfterAttributeName => self.state_after_attribute_name(c, p),
                St::InAttrSq => self.handle_in_attribute_value(c, b'\'', p),
                St::BeforeAttributeValue => self.state_before_attribute_value(c, p),
                St::BeforeClosingTagName => self.state_before_closing_tag_name(c),
                St::AfterClosingTagName => self.state_after_closing_tag_name(c),
                St::InAttrNq => self.state_in_attr_nq(c, p),
                St::InSelfClosingTag => self.state_in_self_closing_tag(c, p),
                St::InDeclaration => self.state_in_declaration(c),
                St::BeforeDeclaration => self.state_before_declaration(c),
                St::BeforeComment => self.state_before_comment(c),
            }
            self.index += 1;
        }
        // cleanup()
        if self.section_start != self.index as isize
            && (self.state == St::Text || self.state == St::InPlainText || (self.state == St::InSpecialTag && self.seq_index == 0))
        {
            p.ontext(self.ss(), self.index);
            self.section_start = self.index as isize;
        }
        // finish(): trailing data
        let end = self.buf.len();
        match self.state {
            St::InCommentLike | St::BeforeDeclaration | St::InSpecialComment | St::BeforeComment | St::CdataSequence | St::DeclarationSequence | St::InDeclaration => {}
            _ if self.section_start >= end as isize => {}
            St::InTagName
            | St::BeforeAttributeName
            | St::BeforeAttributeValue
            | St::AfterAttributeName
            | St::InAttributeName
            | St::InAttrSq
            | St::InAttrDq
            | St::InAttrNq
            | St::InClosingTagName => {}
            // `getSlice(-1, end)`: the library slices from the last character then.
            _ if self.section_start < 0 => {
                let text = String::from_utf8_lossy(self.buf);
                if let Some(last) = text.chars().last() {
                    p.ontext_str(&last.to_string());
                }
            }
            _ => p.ontext(self.ss(), end),
        }
        p.onend();
    }
}

// ---------------------------------------------------------------------------------------
// Parser (`htmlparser2/Parser`): names, implied closes, the open elements.

fn implied_closes(name: &str) -> &'static [&'static str] {
    const P: &[&str] = &["p"];
    const HEADINGS: &[&str] = &["h1", "h2", "h3", "h4", "h5", "h6", "p"];
    const FORM: &[&str] = &["input", "option", "optgroup", "select", "button", "datalist", "textarea"];
    const SECTION: &[&str] = &["thead", "tbody"];
    const DDT: &[&str] = &["dd", "dt"];
    const RTP: &[&str] = &["rt", "rp"];
    match name {
        "tr" => &["tr", "th", "td"],
        "th" => &["th"],
        "td" => &["thead", "th", "td"],
        "body" => &["head", "link", "script"],
        "a" => &["a"],
        "li" => &["li"],
        "p" => P,
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => HEADINGS,
        "select" | "input" | "output" | "button" | "datalist" | "textarea" => FORM,
        "option" => &["option"],
        "optgroup" => &["optgroup", "option"],
        "dd" | "dt" => DDT,
        "address" | "article" | "aside" | "blockquote" | "details" | "div" | "dl" | "fieldset" | "figcaption" | "figure" | "footer" | "form"
        | "header" | "hr" | "main" | "nav" | "ol" | "pre" | "section" | "table" | "ul" => P,
        "rt" | "rp" => RTP,
        "tbody" | "tfoot" => SECTION,
        _ => &[],
    }
}

fn is_void(name: &str) -> bool {
    matches!(
        name,
        "area" | "base" | "basefont" | "br" | "col" | "command" | "embed" | "frame" | "hr" | "img" | "input" | "isindex" | "keygen" | "link" | "meta"
            | "param" | "source" | "track" | "wbr"
    )
}

fn is_integration(name: &str) -> bool {
    matches!(name, "mi" | "mo" | "mn" | "ms" | "mtext" | "annotation-xml" | "foreignObject" | "desc" | "title")
}

fn svg_adjust(name: &str) -> Option<&'static str> {
    Some(match name {
        "altglyph" => "altGlyph",
        "altglyphdef" => "altGlyphDef",
        "altglyphitem" => "altGlyphItem",
        "animatecolor" => "animateColor",
        "animatemotion" => "animateMotion",
        "animatetransform" => "animateTransform",
        "clippath" => "clipPath",
        "feblend" => "feBlend",
        "fecolormatrix" => "feColorMatrix",
        "fecomponenttransfer" => "feComponentTransfer",
        "fecomposite" => "feComposite",
        "feconvolvematrix" => "feConvolveMatrix",
        "fediffuselighting" => "feDiffuseLighting",
        "fedisplacementmap" => "feDisplacementMap",
        "fedistantlight" => "feDistantLight",
        "fedropshadow" => "feDropShadow",
        "feflood" => "feFlood",
        "fefunca" => "feFuncA",
        "fefuncb" => "feFuncB",
        "fefuncg" => "feFuncG",
        "fefuncr" => "feFuncR",
        "fegaussianblur" => "feGaussianBlur",
        "feimage" => "feImage",
        "femerge" => "feMerge",
        "femergenode" => "feMergeNode",
        "femorphology" => "feMorphology",
        "feoffset" => "feOffset",
        "fepointlight" => "fePointLight",
        "fespecularlighting" => "feSpecularLighting",
        "fespotlight" => "feSpotLight",
        "fetile" => "feTile",
        "feturbulence" => "feTurbulence",
        "foreignobject" => "foreignObject",
        "glyphref" => "glyphRef",
        "lineargradient" => "linearGradient",
        "radialgradient" => "radialGradient",
        "textpath" => "textPath",
        _ => return None,
    })
}

#[derive(Clone, Copy, PartialEq)]
enum Foreign {
    None,
    Svg,
    MathMl,
}

struct Parser<'a> {
    buf: &'a [u8],
    tagname: String,
    attribname: String,
    attribvalue: String,
    attribs: Option<Vec<(String, String)>>,
    /// Open elements, the innermost LAST (`stack[0]` in the library).
    stack: Vec<String>,
    foreign: Vec<Foreign>,
    san: Sanitizer<'a>,
}

impl<'a> Parser<'a> {
    fn slice(&self, start: usize, end: usize) -> String {
        String::from_utf8_lossy(&self.buf[start..end]).into_owned()
    }

    fn in_foreign_context(&self) -> bool {
        *self.foreign.last().unwrap_or(&Foreign::None) != Foreign::None
    }

    fn ontext(&mut self, start: usize, end: usize) {
        let text = self.slice(start, end);
        self.san.ontext(&text);
    }

    fn ontext_str(&mut self, text: &str) {
        self.san.ontext(text);
    }

    fn read_tag_name(&self, start: usize, end: usize) -> String {
        let name = self.slice(start, end).to_lowercase();
        if *self.foreign.last().unwrap_or(&Foreign::None) == Foreign::Svg {
            return svg_adjust(&name).map(str::to_string).unwrap_or(name);
        }
        if self.foreign.len() > 1 {
            if let Some(adjusted) = svg_adjust(&name) {
                if self.stack.iter().any(|s| s == adjusted) {
                    return adjusted.to_string();
                }
            }
        }
        if !self.in_foreign_context() {
            return if name == "image" { "img".into() } else { name };
        }
        name
    }

    fn onopentagname(&mut self, start: usize, end: usize) {
        let name = self.read_tag_name(start, end);
        self.emit_open_tag(name);
    }

    fn emit_open_tag(&mut self, name: String) {
        self.tagname = name.clone();
        if name == "form" && self.stack.iter().any(|s| s == "form") {
            self.tagname = String::new();
            return;
        }
        let closes = implied_closes(&name);
        while self.stack.last().is_some_and(|top| closes.contains(&top.as_str())) {
            self.pop_element(true);
        }
        if !is_void(&name) {
            self.stack.push(name.clone());
            if name == "svg" {
                self.foreign.push(Foreign::Svg);
            } else if name == "math" {
                self.foreign.push(Foreign::MathMl);
            } else if is_integration(&name) {
                self.foreign.push(Foreign::None);
            }
        }
        self.attribs = Some(Vec::new());
    }

    fn end_open_tag(&mut self) {
        if let Some(attribs) = self.attribs.take() {
            let name = self.tagname.clone();
            self.san.onopentag(&name, attribs);
        }
        if is_void(&self.tagname) {
            let name = self.tagname.clone();
            self.san.onclosetag(&name);
        }
        self.tagname = String::new();
    }

    fn onopentagend(&mut self) {
        self.end_open_tag();
    }

    fn onclosetag(&mut self, start: usize, end: usize) {
        let name = self.read_tag_name(start, end);
        if !is_void(&name) {
            if let Some(pos) = self.stack.iter().rev().position(|s| *s == name) {
                for _ in 0..pos {
                    self.pop_element(true);
                }
                self.pop_element(false);
            } else if name == "p" {
                self.emit_open_tag("p".into());
                self.close_current_tag();
            }
        } else if name == "br" {
            self.san.onopentag("br", Vec::new());
            self.san.onclosetag("br");
        }
    }

    fn onselfclosingtag(&mut self) {
        if self.in_foreign_context() {
            self.close_current_tag();
        } else {
            self.onopentagend();
        }
    }

    fn pop_element(&mut self, _implied: bool) {
        let Some(element) = self.stack.pop() else { return };
        if matches!(element.as_str(), "math" | "svg") || is_integration(&element) {
            self.foreign.pop();
        }
        self.san.onclosetag(&element);
    }

    fn close_current_tag(&mut self) {
        let name = self.tagname.clone();
        self.end_open_tag();
        if self.stack.last() == Some(&name) {
            self.pop_element(false);
        }
    }

    fn onattribname(&mut self, start: usize, end: usize) {
        self.attribname = self.slice(start, end).to_lowercase();
    }

    fn onattribdata(&mut self, start: usize, end: usize) {
        let data = self.slice(start, end);
        self.attribvalue.push_str(&data);
    }

    fn onattribend(&mut self) {
        let value = std::mem::take(&mut self.attribvalue);
        if let Some(attribs) = self.attribs.as_mut() {
            if !attribs.iter().any(|(n, _)| *n == self.attribname) {
                attribs.push((self.attribname.clone(), value));
            }
        }
    }

    fn oncdata(&mut self, start: usize, end: usize) {
        if self.in_foreign_context() {
            let text = self.slice(start, end);
            self.san.ontext(&text);
        }
    }

    fn onend(&mut self) {
        let open: Vec<String> = self.stack.iter().rev().cloned().collect();
        for name in open {
            self.san.onclosetag(&name);
        }
    }
}

// ---------------------------------------------------------------------------------------
// The sanitizer's callbacks (`sanitize-html`, `discard` mode).

#[derive(Clone, Copy, PartialEq)]
pub enum Profile {
    /// `sanitizeRichText`'s options.
    Rich,
    /// `richTextToPlain`'s: no tag at all.
    Plain,
}

const RICH_TAGS: &[&str] = &["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "blockquote", "code", "pre", "h1", "h2", "h3", "a", "hr"];
const NON_TEXT: &[&str] = &["script", "style", "textarea", "option", "xmp"];
const SELF_CLOSING: &[&str] = &["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta", "col"];
const MAX_IFRAME_FALLBACK_DEPTH: usize = 8;

struct Sanitizer<'a> {
    profile: Profile,
    result: String,
    stack: Vec<String>,
    depth: i64,
    skip_map: HashSet<i64>,
    skip_text: bool,
    skip_text_depth: i64,
    iframe_depth: usize,
    _source: std::marker::PhantomData<&'a ()>,
}

fn escape(s: &str, quote: bool) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' if quote => out.push_str("&quot;"),
            c => out.push(c),
        }
    }
    out
}

/// `launder`'s `naughtyHref` with the rich profile's schemes, protocol-relative refused.
fn naughty_href(href: &str) -> bool {
    let mut href: String = href.chars().filter(|c| *c as u32 > 0x20).collect();
    while let Some(first) = href.find("<!--") {
        let Some(last) = href[first + 4..].find("-->").map(|i| i + first + 4) else { break };
        href = format!("{}{}", &href[..first], &href[last + 3..]);
    }
    static SCHEME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^([a-zA-Z][a-zA-Z0-9.\-+]*):").unwrap());
    match SCHEME.captures(&href) {
        Some(c) => !["http", "https", "mailto"].contains(&c[1].to_lowercase().as_str()),
        None => href.starts_with("//") || href.starts_with("/\\") || href.starts_with("\\/") || href.starts_with("\\\\"),
    }
}

impl Sanitizer<'_> {
    fn allowed(&self, name: &str) -> bool {
        self.profile == Profile::Rich && RICH_TAGS.contains(&name)
    }

    fn onopentag(&mut self, name: &str, attribs: Vec<(String, String)>) {
        if self.skip_text {
            self.skip_text_depth += 1;
            return;
        }
        self.stack.push(name.to_string());
        let mut skip = false;
        if !self.allowed(name) {
            skip = true;
            self.skip_map.insert(self.depth);
            if NON_TEXT.contains(&name) {
                self.skip_text = true;
                self.skip_text_depth = 1;
            }
        }
        self.depth += 1;
        if skip {
            return;
        }
        self.result.push('<');
        self.result.push_str(name);
        if name == "a" {
            let get = |k: &str| attribs.iter().find(|(n, _)| n == k).map(|(_, v)| v.clone());
            let mut out: Vec<(&str, String)> = Vec::new();
            if let Some(href) = get("href") {
                out.push(("href", href));
            }
            if let Some(title) = get("title") {
                out.push(("title", title));
            }
            out.push(("rel", "noopener noreferrer nofollow".into()));
            if get("target").is_some() {
                out.push(("target", "_blank".into()));
            }
            for (a, value) in out {
                // Empty values of non-boolean attributes go (`nonBooleanAttributes`).
                if value.is_empty() {
                    continue;
                }
                if a == "href" && naughty_href(&value) {
                    continue;
                }
                self.result.push(' ');
                self.result.push_str(a);
                self.result.push_str("=\"");
                self.result.push_str(&escape(&value, true));
                self.result.push('"');
            }
        }
        if SELF_CLOSING.contains(&name) {
            self.result.push_str(" />");
        } else {
            self.result.push('>');
        }
    }

    fn ontext(&mut self, text: &str) {
        if self.skip_text {
            return;
        }
        let tag = self.stack.last().map(String::as_str);
        if tag == Some("iframe") && self.iframe_depth < MAX_IFRAME_FALLBACK_DEPTH {
            let inner = sanitize_at(text, self.profile, self.iframe_depth + 1);
            self.result.push_str(&inner);
        } else {
            self.result.push_str(&escape(text, false));
        }
    }

    fn onclosetag(&mut self, name: &str) {
        if self.skip_text {
            self.skip_text_depth -= 1;
            if self.skip_text_depth == 0 {
                self.skip_text = false;
            } else {
                return;
            }
        }
        let Some(frame) = self.stack.pop() else { return };
        if frame != name {
            self.stack.push(frame);
            return;
        }
        self.depth -= 1;
        if self.skip_map.remove(&self.depth) {
            return;
        }
        if SELF_CLOSING.contains(&name) {
            return;
        }
        self.result.push_str("</");
        self.result.push_str(name);
        self.result.push('>');
    }
}

fn sanitize_at(html: &str, profile: Profile, iframe_depth: usize) -> String {
    let html = html.replace("<![CDATA[", "<!&#91;CDATA[");
    let bytes = html.as_bytes();
    let mut parser = Parser {
        buf: bytes,
        tagname: String::new(),
        attribname: String::new(),
        attribvalue: String::new(),
        attribs: None,
        stack: Vec::new(),
        foreign: vec![Foreign::None],
        san: Sanitizer {
            profile,
            result: String::new(),
            stack: Vec::new(),
            depth: 0,
            skip_map: HashSet::new(),
            skip_text: false,
            skip_text_depth: 0,
            iframe_depth,
            _source: std::marker::PhantomData,
        },
    };
    let mut tokenizer = Tokenizer::new(bytes);
    tokenizer.run(&mut parser);
    parser.san.result
}

/// `sanitizeHtml(html, options)` for one of the two profiles.
pub fn sanitize(html: &str, profile: Profile) -> String {
    sanitize_at(html, profile, 0)
}

const JS_WS: &str = r"[\t\n\x0B\x0C\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]";

/// `defuse`: the colon of `javascript:`, the equal sign of `on…=`, as entities.
fn defuse(html: &str) -> String {
    static JS: LazyLock<Regex> = LazyLock::new(|| Regex::new(&format!(r"[jJ][aA][vV][aA][sS][cC][rR][iI][pP][tT]({JS_WS}*):")).unwrap());
    static ON: LazyLock<Regex> = LazyLock::new(|| Regex::new(&format!(r"({JS_WS}[oO][nN][a-zA-Z]+{JS_WS}*)=")).unwrap());
    let html = JS.replace_all(html, |c: &regex::Captures| format!("javascript{}&#58;", &c[1]));
    ON.replace_all(&html, "${1}&#61;").into_owned()
}

/// `blank`: no text, no rule.
fn blank(html: &str) -> bool {
    let b = html.as_bytes();
    let mut kept = String::new();
    let mut i = 0;
    let mut from = 0;
    while i < b.len() {
        if b[i] == b'<' {
            let hr = b.len() >= i + 3
                && b[i + 1] | 0x20 == b'h'
                && b[i + 2] | 0x20 == b'r'
                && !b.get(i + 3).is_some_and(|c| c.is_ascii_alphanumeric() || *c == b'_');
            if !hr {
                if let Some(close) = html[i..].find('>') {
                    kept.push_str(&html[from..i]);
                    i += close + 1;
                    from = i;
                    continue;
                }
            }
        }
        i += 1;
    }
    kept.push_str(&html[from..]);
    let mut rest = kept.as_str();
    loop {
        if rest.len() >= 6 && rest.as_bytes()[..6].eq_ignore_ascii_case(b"&nbsp;") {
            rest = &rest[6..];
            continue;
        }
        match rest.chars().next() {
            None => return true,
            Some(c) if crate::js::js_space(c) => rest = &rest[c.len_utf8()..],
            Some(_) => return false,
        }
    }
}

/// `sanitizeRichText`: the canonical form of a rich text, `''` when nothing is left to read.
pub fn sanitize_rich_text(html: &str) -> String {
    let clean = defuse(js_trim(&sanitize(html, Profile::Rich)));
    if blank(&clean) {
        String::new()
    } else {
        clean
    }
}

/// `richTextToPlain`: a rich text as plain words.
pub fn rich_text_to_plain(html: &str) -> String {
    static BLOCK_END: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(&format!(r"(?i-u:</(?:p|li|h[1-3]|blockquote|pre)>)|(?i-u:<br){JS_WS}*/?>")).unwrap());
    static BREAKS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\n{3,}").unwrap());
    let marked = BLOCK_END.replace_all(html, "$0\n");
    let text = sanitize(&marked, Profile::Plain)
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#58;", ":")
        .replace("&#61;", "=");
    js_trim(&BREAKS.replace_all(&text, "\n\n")).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rich_text_matches_sanitize_html() {
        let cases: serde_json::Value = serde_json::from_str(include_str!("../tests/html-vectors.json")).unwrap();
        let mut failures = Vec::new();
        for case in cases.as_array().unwrap() {
            let input = case["input"].as_str().unwrap();
            let rich = sanitize_rich_text(input);
            let plain = rich_text_to_plain(input);
            if rich != case["rich"].as_str().unwrap() {
                failures.push(format!("rich {input:?}\n  got  {rich:?}\n  want {:?}", case["rich"]));
            }
            if plain != case["plain"].as_str().unwrap() {
                failures.push(format!("plain {input:?}\n  got  {plain:?}\n  want {:?}", case["plain"]));
            }
        }
        assert!(failures.is_empty(), "{} écarts :\n{}", failures.len(), failures.join("\n"));
    }
}
