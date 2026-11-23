//! A rich text read as `htmlparser2`'s `parseDocument` reads it — enough of it for the
//! sanitizer's canonical form (`rich-text.ts`): tags lowercased, entities decoded, void
//! elements, the closings a `<p>` or an `<li>` implies, a stray `</p>` or `</br>`.

#[derive(Clone, Debug)]
pub enum Node {
    Text(String),
    Tag { name: String, attribs: Vec<(String, String)>, children: Vec<Node> },
    Other,
}

impl Node {
    pub fn children(&self) -> &[Node] {
        match self {
            Node::Tag { children, .. } => children,
            _ => &[],
        }
    }

    pub fn name(&self) -> Option<&str> {
        match self {
            Node::Tag { name, .. } => Some(name),
            _ => None,
        }
    }

    pub fn attr(&self, key: &str) -> Option<&str> {
        match self {
            Node::Tag { attribs, .. } => attribs.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str()),
            _ => None,
        }
    }
}

const VOID: &[&str] = &[
    "area", "base", "basefont", "br", "col", "command", "embed", "frame", "hr", "image", "img", "input", "isindex", "keygen", "link",
    "meta", "param", "source", "track", "wbr",
];

/// The tags whose opening closes an open `<p>` (`openImpliesClose`).
const CLOSES_P: &[&str] = &[
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption",
    "figure", "footer", "form", "header", "hr", "main", "nav", "ol", "pre", "section", "table", "ul",
];

/// Character references, as the parser decodes them.
pub fn decode_entities(text: &str) -> String {
    if !text.contains('&') {
        return text.to_string();
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        let (ch, used) = entity(rest);
        match ch {
            Some(s) => {
                out.push_str(&s);
                rest = &rest[used..];
            }
            None => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

fn entity(s: &str) -> (Option<String>, usize) {
    let b = s.as_bytes();
    if b.len() > 2 && b[1] == b'#' {
        let (hex, start) = if b[2] == b'x' || b[2] == b'X' { (true, 3) } else { (false, 2) };
        let mut end = start;
        while end < b.len() && (if hex { b[end].is_ascii_hexdigit() } else { b[end].is_ascii_digit() }) {
            end += 1;
        }
        if end == start {
            return (None, 0);
        }
        let n = u32::from_str_radix(&s[start..end], if hex { 16 } else { 10 }).unwrap_or(0x110000);
        let used = if b.get(end) == Some(&b';') { end + 1 } else { end };
        let c = match n {
            0 => '\u{fffd}',
            n if n > 0x10ffff || (0xd800..=0xdfff).contains(&n) => '\u{fffd}',
            0x80..=0x9f => char::from_u32(C1[(n - 0x80) as usize]).unwrap_or('\u{fffd}'),
            n => char::from_u32(n).unwrap_or('\u{fffd}'),
        };
        return (Some(c.to_string()), used);
    }
    for (name, value) in NAMED {
        if s[1..].starts_with(name) {
            let end = 1 + name.len();
            if s.as_bytes().get(end) == Some(&b';') {
                return (Some(value.to_string()), end + 1);
            }
            return (Some(value.to_string()), end);
        }
    }
    (None, 0)
}

const C1: [u32; 32] = [
    0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019,
    0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

const NAMED: &[(&str, &str)] = &[("amp", "&"), ("lt", "<"), ("gt", ">"), ("quot", "\""), ("apos", "'"), ("nbsp", "\u{a0}")];

type Open = (String, Vec<(String, String)>, Vec<Node>);

struct Builder {
    stack: Vec<Open>,
}

impl Builder {
    fn push(&mut self, node: Node) {
        let children = &mut self.stack.last_mut().expect("root").2;
        if let (Node::Text(t), Some(Node::Text(last))) = (&node, children.last_mut()) {
            last.push_str(t);
            return;
        }
        children.push(node);
    }

    fn close_top(&mut self) {
        if self.stack.len() > 1 {
            let (name, attribs, children) = self.stack.pop().expect("open");
            self.push(Node::Tag { name, attribs, children });
        }
    }

    fn open(&mut self, name: String, attribs: Vec<(String, String)>) {
        let implies_p = CLOSES_P.contains(&name.as_str());
        while self.stack.len() > 1 {
            let top = self.stack.last().map(|t| t.0.as_str()).unwrap_or("");
            if (implies_p && top == "p") || (name == "li" && top == "li") {
                self.close_top();
            } else {
                break;
            }
        }
        if VOID.contains(&name.as_str()) {
            self.push(Node::Tag { name, attribs, children: vec![] });
        } else {
            self.stack.push((name, attribs, vec![]));
        }
    }

    fn close(&mut self, name: &str) {
        if let Some(at) = self.stack.iter().skip(1).rposition(|t| t.0 == name) {
            let depth = at + 1;
            while self.stack.len() > depth {
                self.close_top();
            }
        } else if name == "p" {
            self.open("p".into(), vec![]);
            self.close("p");
        } else if name == "br" {
            self.open("br".into(), vec![]);
        }
    }
}

/// The document's top-level nodes.
pub fn parse(html: &str) -> Vec<Node> {
    let mut b = Builder { stack: vec![(String::new(), vec![], vec![])] };
    let bytes = html.as_bytes();
    let mut i = 0;
    let mut text_start = 0;
    let flush = |b: &mut Builder, from: usize, to: usize| {
        if to > from {
            b.push(Node::Text(decode_entities(&html[from..to])));
        }
    };
    while i < bytes.len() {
        if bytes[i] != b'<' {
            i += 1;
            continue;
        }
        let next = bytes.get(i + 1).copied().unwrap_or(0);
        if next == b'!' || next == b'?' {
            flush(&mut b, text_start, i);
            let end = if html[i..].starts_with("<!--") {
                html[i + 4..].find("-->").map(|e| i + 4 + e + 3).unwrap_or(bytes.len())
            } else {
                html[i..].find('>').map(|e| i + e + 1).unwrap_or(bytes.len())
            };
            b.push(Node::Other);
            i = end;
            text_start = i;
            continue;
        }
        let closing = next == b'/';
        let name_start = if closing { i + 2 } else { i + 1 };
        if !bytes.get(name_start).is_some_and(|c| c.is_ascii_alphabetic()) {
            i += 1;
            continue;
        }
        flush(&mut b, text_start, i);
        let mut j = name_start;
        while j < bytes.len() && !bytes[j].is_ascii_whitespace() && bytes[j] != b'/' && bytes[j] != b'>' {
            j += 1;
        }
        let name = html[name_start..j].to_ascii_lowercase();
        let mut attribs = vec![];
        // Attributes, up to the tag's end.
        loop {
            while j < bytes.len() && (bytes[j].is_ascii_whitespace() || bytes[j] == b'/') {
                j += 1;
            }
            if j >= bytes.len() || bytes[j] == b'>' {
                j += 1;
                break;
            }
            let k0 = j;
            while j < bytes.len() && !bytes[j].is_ascii_whitespace() && bytes[j] != b'=' && bytes[j] != b'>' && bytes[j] != b'/' {
                j += 1;
            }
            let key = html[k0..j].to_ascii_lowercase();
            while j < bytes.len() && bytes[j].is_ascii_whitespace() {
                j += 1;
            }
            let mut value = String::new();
            if bytes.get(j) == Some(&b'=') {
                j += 1;
                while j < bytes.len() && bytes[j].is_ascii_whitespace() {
                    j += 1;
                }
                match bytes.get(j) {
                    Some(&q) if q == b'"' || q == b'\'' => {
                        let end = html[j + 1..].find(q as char).map(|e| j + 1 + e).unwrap_or(bytes.len());
                        value = decode_entities(&html[j + 1..end]);
                        j = (end + 1).min(bytes.len());
                    }
                    _ => {
                        let v0 = j;
                        while j < bytes.len() && !bytes[j].is_ascii_whitespace() && bytes[j] != b'>' {
                            j += 1;
                        }
                        value = decode_entities(&html[v0..j]);
                    }
                }
            }
            if !key.is_empty() && !attribs.iter().any(|(k, _): &(String, String)| *k == key) {
                attribs.push((key, value));
            }
        }
        if closing {
            b.close(&name);
        } else {
            b.open(name, attribs);
        }
        i = j.min(bytes.len());
        text_start = i;
    }
    flush(&mut b, text_start, bytes.len());
    while b.stack.len() > 1 {
        b.close_top();
    }
    b.stack.pop().map(|r| r.2).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_rich_text() {
        let nodes = parse("<p>a &amp;lt; <strong>b</strong></p><ul><li>x<li>y</ul><hr><p>c</p>");
        assert_eq!(nodes.len(), 4);
        assert_eq!(nodes[0].children().len(), 2);
        assert!(matches!(&nodes[0].children()[0], Node::Text(t) if t == "a &lt; "));
        assert_eq!(nodes[1].children().len(), 2);
        assert_eq!(nodes[2].name(), Some("hr"));
        let link = parse(r#"<a href="https://x.y/?a=1&amp;b=2">l</a>"#);
        assert_eq!(link[0].attr("href"), Some("https://x.y/?a=1&b=2"));
    }
}
