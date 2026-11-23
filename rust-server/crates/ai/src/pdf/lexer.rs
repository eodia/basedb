//! Le lexeur et l'analyseur des flux de contenu (et des CMap), comme ceux de pdf.js : nombres en
//! double précision, chaînes en octets, opérateurs découpés selon les commandes connues.

/// An object of a content stream.
#[derive(Clone, Debug)]
pub(crate) enum Obj {
    Num(f64),
    Str(Vec<u8>),
    Name(Vec<u8>),
    Arr(Vec<Obj>),
    #[allow(dead_code)]
    Dict(Vec<(Vec<u8>, Obj)>),
    #[allow(dead_code)]
    Bool(bool),
    Null,
    Cmd(Vec<u8>),
    Image,
}

impl Obj {
    pub fn num(&self) -> f64 {
        match self {
            Obj::Num(n) => *n,
            _ => f64::NAN,
        }
    }
}

/// The operators pdf.js knows: name, arguments, variable arguments (`None`: a prefix only).
pub(crate) static OPS: &[(&str, Option<(usize, bool)>)] = &[
    ("\"", Some((3, false))),
    ("'", Some((1, false))),
    ("B", Some((0, false))),
    ("B*", Some((0, false))),
    ("BD", None),
    ("BDC", Some((2, false))),
    ("BI", Some((0, false))),
    ("BM", None),
    ("BMC", Some((1, false))),
    ("BT", Some((0, false))),
    ("BX", Some((0, false))),
    ("CS", Some((1, false))),
    ("DP", Some((2, false))),
    ("Do", Some((1, false))),
    ("EI", Some((1, false))),
    ("EMC", Some((0, false))),
    ("ET", Some((0, false))),
    ("EX", Some((0, false))),
    ("F", Some((0, false))),
    ("G", Some((1, false))),
    ("ID", Some((0, false))),
    ("J", Some((1, false))),
    ("K", Some((4, false))),
    ("M", Some((1, false))),
    ("MP", Some((1, false))),
    ("Q", Some((0, false))),
    ("RG", Some((3, false))),
    ("S", Some((0, false))),
    ("SC", Some((4, true))),
    ("SCN", Some((33, true))),
    ("T*", Some((0, false))),
    ("TD", Some((2, false))),
    ("TJ", Some((1, false))),
    ("TL", Some((1, false))),
    ("Tc", Some((1, false))),
    ("Td", Some((2, false))),
    ("Tf", Some((2, false))),
    ("Tj", Some((1, false))),
    ("Tm", Some((6, false))),
    ("Tr", Some((1, false))),
    ("Ts", Some((1, false))),
    ("Tw", Some((1, false))),
    ("Tz", Some((1, false))),
    ("W", Some((0, false))),
    ("W*", Some((0, false))),
    ("b", Some((0, false))),
    ("b*", Some((0, false))),
    ("c", Some((6, false))),
    ("cm", Some((6, false))),
    ("cs", Some((1, false))),
    ("d", Some((2, false))),
    ("d0", Some((2, false))),
    ("d1", Some((6, false))),
    ("f", Some((0, false))),
    ("f*", Some((0, false))),
    ("fa", None),
    ("fal", None),
    ("fals", None),
    ("false", None),
    ("g", Some((1, false))),
    ("gs", Some((1, false))),
    ("h", Some((0, false))),
    ("i", Some((1, false))),
    ("j", Some((1, false))),
    ("k", Some((4, false))),
    ("l", Some((2, false))),
    ("m", Some((2, false))),
    ("n", Some((0, false))),
    ("nu", None),
    ("nul", None),
    ("null", None),
    ("q", Some((0, false))),
    ("re", Some((4, false))),
    ("rg", Some((3, false))),
    ("ri", Some((1, false))),
    ("s", Some((0, false))),
    ("sc", Some((4, true))),
    ("scn", Some((33, true))),
    ("sh", Some((1, false))),
    ("true", None),
    ("v", Some((4, false))),
    ("w", Some((1, false))),
    ("y", Some((4, false))),
];

fn op(name: &[u8]) -> Option<&'static Option<(usize, bool)>> {
    OPS.binary_search_by(|(k, _)| k.as_bytes().cmp(name)).ok().map(|i| &OPS[i].1)
}

/// `specialChars`: 1 for white space, 2 for delimiters, 0 for regular characters.
fn special(c: u8) -> u8 {
    match c {
        0 | 9 | 10 | 12 | 13 | 32 => 1,
        b'(' | b')' | b'<' | b'>' | b'[' | b']' | b'{' | b'}' | b'/' | b'%' => 2,
        _ => 0,
    }
}

fn hex(c: u8) -> Option<u8> {
    (c as char).to_digit(16).map(|d| d as u8)
}

enum Tok {
    Eof,
    Obj(Obj),
    Cmd(Vec<u8>),
}

/// A failure pdf.js throws (`FormatError`): it ends the reading of the stream.
pub(crate) struct Malformed;

pub(crate) struct Lexer<'a> {
    s: &'a [u8],
    pos: usize,
    known: bool,
}

impl<'a> Lexer<'a> {
    /// `known`: split operators along pdf.js's known commands (content streams).
    pub fn new(s: &'a [u8], known: bool) -> Lexer<'a> {
        Lexer { s, pos: 0, known }
    }

    fn peek(&self) -> Option<u8> {
        self.s.get(self.pos).copied()
    }

    fn token(&mut self) -> Result<Tok, Malformed> {
        let mut comment = false;
        loop {
            let Some(c) = self.peek() else { return Ok(Tok::Eof) };
            if comment {
                if c == 10 || c == 13 {
                    comment = false;
                }
            } else if c == b'%' {
                comment = true;
            } else if special(c) != 1 {
                break;
            }
            self.pos += 1;
        }
        let c = self.s[self.pos];
        match c {
            b'0'..=b'9' | b'+' | b'-' | b'.' => return self.number().map(|n| Tok::Obj(Obj::Num(n))),
            b'(' => return Ok(Tok::Obj(Obj::Str(self.string()))),
            b'/' => return Ok(Tok::Obj(Obj::Name(self.name()))),
            b'[' | b']' | b'{' | b'}' => {
                self.pos += 1;
                return Ok(Tok::Cmd(vec![c]));
            }
            b'<' => {
                self.pos += 1;
                if self.peek() == Some(b'<') {
                    self.pos += 1;
                    return Ok(Tok::Cmd(b"<<".to_vec()));
                }
                return Ok(Tok::Obj(Obj::Str(self.hex_string())));
            }
            b'>' => {
                self.pos += 1;
                if self.peek() == Some(b'>') {
                    self.pos += 1;
                    return Ok(Tok::Cmd(b">>".to_vec()));
                }
                return Ok(Tok::Cmd(b">".to_vec()));
            }
            b')' => {
                self.pos += 1;
                return Err(Malformed);
            }
            _ => {}
        }
        self.pos += 1;
        let mut word = vec![c];
        if !(32..=127).contains(&c) {
            if let Some(n) = self.peek() {
                if (32..=127).contains(&n) {
                    return Ok(Tok::Cmd(word));
                }
            }
        }
        let mut known = self.known && op(&word).is_some();
        while let Some(n) = self.peek() {
            if special(n) != 0 {
                break;
            }
            let mut next = word.clone();
            next.push(n);
            if known && op(&next).is_none() {
                break;
            }
            if word.len() == 128 {
                return Err(Malformed);
            }
            word = next;
            self.pos += 1;
            known = self.known && op(&word).is_some();
        }
        Ok(match word.as_slice() {
            b"true" => Tok::Obj(Obj::Bool(true)),
            b"false" => Tok::Obj(Obj::Bool(false)),
            b"null" => Tok::Obj(Obj::Null),
            _ => Tok::Cmd(word),
        })
    }

    /// `getNumber`.
    fn number(&mut self) -> Result<f64, Malformed> {
        let mut c = self.peek();
        let mut divisor = 0.0;
        let mut sign = 1.0;
        if c == Some(b'-') {
            sign = -1.0;
            self.pos += 1;
            c = self.peek();
            if c == Some(b'-') {
                self.pos += 1;
                c = self.peek();
            }
        } else if c == Some(b'+') {
            self.pos += 1;
            c = self.peek();
        }
        while matches!(c, Some(10 | 13)) {
            self.pos += 1;
            c = self.peek();
        }
        if c == Some(b'.') {
            divisor = 10.0;
            self.pos += 1;
            c = self.peek();
        }
        let Some(d @ b'0'..=b'9') = c else {
            return match c {
                None | Some(b'(' | b'<') => Ok(0.0),
                Some(x) if special(x) == 1 => Ok(0.0),
                _ => Err(Malformed),
            };
        };
        let mut value = (d - b'0') as f64;
        self.pos += 1;
        while let Some(c) = self.peek() {
            match c {
                b'0'..=b'9' => {
                    if divisor != 0.0 {
                        divisor *= 10.0;
                    }
                    value = value * 10.0 + (c - b'0') as f64;
                }
                b'.' => {
                    if divisor == 0.0 {
                        divisor = 1.0;
                    } else {
                        break;
                    }
                }
                b'-' => {}
                _ => break,
            }
            self.pos += 1;
        }
        if divisor != 0.0 {
            value /= divisor;
        }
        Ok(sign * value)
    }

    /// `getString`.
    fn string(&mut self) -> Vec<u8> {
        self.pos += 1;
        let mut depth = 1;
        let mut out = vec![];
        while let Some(c) = self.peek() {
            self.pos += 1;
            match c {
                b'(' => {
                    depth += 1;
                    out.push(c);
                }
                b')' => {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                    out.push(c);
                }
                b'\\' => {
                    let Some(e) = self.peek() else { break };
                    self.pos += 1;
                    match e {
                        b'n' => out.push(b'\n'),
                        b'r' => out.push(b'\r'),
                        b't' => out.push(b'\t'),
                        b'b' => out.push(8),
                        b'f' => out.push(12),
                        b'0'..=b'7' => {
                            let mut v = (e & 15) as u32;
                            if let Some(d @ b'0'..=b'7') = self.peek() {
                                self.pos += 1;
                                v = (v << 3) + (d & 15) as u32;
                                if let Some(d @ b'0'..=b'7') = self.peek() {
                                    self.pos += 1;
                                    v = (v << 3) + (d & 15) as u32;
                                }
                            }
                            out.push(v as u8);
                        }
                        b'\r' => {
                            if self.peek() == Some(b'\n') {
                                self.pos += 1;
                            }
                        }
                        b'\n' => {}
                        other => out.push(other),
                    }
                }
                _ => out.push(c),
            }
        }
        out
    }

    /// `getHexString` (the `<` already read).
    fn hex_string(&mut self) -> Vec<u8> {
        let mut out = vec![];
        let mut first: Option<u8> = None;
        while let Some(c) = self.peek() {
            self.pos += 1;
            if c == b'>' {
                break;
            }
            let Some(d) = hex(c) else { continue };
            match first.take() {
                None => first = Some(d),
                Some(f) => out.push(f << 4 | d),
            }
        }
        if let Some(f) = first {
            out.push(f << 4);
        }
        out
    }

    /// `getName`.
    fn name(&mut self) -> Vec<u8> {
        self.pos += 1;
        let mut out = vec![];
        while let Some(c) = self.peek() {
            if special(c) != 0 {
                break;
            }
            self.pos += 1;
            if c == b'#' {
                match (self.peek().and_then(hex), self.s.get(self.pos + 1).copied().and_then(hex)) {
                    (Some(a), Some(b)) => {
                        out.push(a << 4 | b);
                        self.pos += 2;
                    }
                    _ => out.push(c),
                }
                continue;
            }
            out.push(c);
        }
        out
    }

    /// `Parser.getObj`: an object (arrays and dictionaries whole), a command, or `None` at the end.
    pub fn obj(&mut self) -> Result<Option<Obj>, Malformed> {
        let t = self.token()?;
        self.object(t)
    }

    fn object(&mut self, t: Tok) -> Result<Option<Obj>, Malformed> {
        match t {
            Tok::Eof => Ok(None),
            Tok::Obj(o) => Ok(Some(o)),
            Tok::Cmd(c) => match c.as_slice() {
                b"[" => {
                    let mut items = vec![];
                    loop {
                        match self.token()? {
                            Tok::Eof => return Err(Malformed),
                            Tok::Cmd(c) if c == b"]" => break,
                            t => {
                                if let Some(o) = self.object(t)? {
                                    items.push(o);
                                }
                            }
                        }
                    }
                    Ok(Some(Obj::Arr(items)))
                }
                b"<<" => Ok(Some(Obj::Dict(self.dict(b">>")?))),
                b"BI" if self.known => {
                    self.dict(b"ID")?;
                    self.skip_image_data();
                    Ok(Some(Obj::Image))
                }
                _ => Ok(Some(Obj::Cmd(c))),
            },
        }
    }

    fn dict(&mut self, end: &[u8]) -> Result<Vec<(Vec<u8>, Obj)>, Malformed> {
        let mut entries = vec![];
        loop {
            match self.token()? {
                Tok::Eof => return Err(Malformed),
                Tok::Cmd(c) if c == end => break,
                Tok::Obj(Obj::Name(k)) => {
                    let t = self.token()?;
                    if matches!(t, Tok::Eof) {
                        return Err(Malformed);
                    }
                    if let Some(v) = self.object(t)? {
                        entries.push((k, v));
                    }
                }
                _ => {}
            }
        }
        Ok(entries)
    }

    /// The data of an inline image: up to an `EI` between white spaces.
    fn skip_image_data(&mut self) {
        self.pos += 1;
        let s = self.s;
        let mut i = self.pos;
        while i + 1 < s.len() {
            if s[i] == b'E' && s[i + 1] == b'I' && (i == 0 || special(s[i - 1]) == 1) && s.get(i + 2).is_none_or(|&c| special(c) == 1) {
                self.pos = i;
                return;
            }
            i += 1;
        }
        self.pos = s.len();
    }
}

/// An operator and its arguments.
pub(crate) type Operation = (Vec<u8>, Vec<Obj>);

/// `EvaluatorPreprocessor.read`: the next operator with its arguments.
pub(crate) struct Operations<'a> {
    lex: Lexer<'a>,
    non_processed: Vec<Obj>,
}

impl<'a> Operations<'a> {
    pub fn new(s: &'a [u8]) -> Operations<'a> {
        Operations { lex: Lexer::new(s, true), non_processed: vec![] }
    }

    pub fn read(&mut self) -> Result<Option<Operation>, Malformed> {
        let mut args: Vec<Obj> = vec![];
        loop {
            match self.lex.obj()? {
                None => return Ok(None),
                Some(Obj::Cmd(c)) => {
                    let Some(Some((n, variable))) = op(&c) else { continue };
                    let n = *n;
                    if !*variable {
                        while args.len() > n {
                            self.non_processed.push(args.remove(0));
                        }
                        while args.len() < n {
                            let Some(a) = self.non_processed.pop() else { break };
                            args.insert(0, a);
                        }
                        if args.len() < n {
                            args.clear();
                            continue;
                        }
                    }
                    return Ok(Some((c, args)));
                }
                Some(o) => {
                    args.push(o);
                    if args.len() > 33 {
                        return Err(Malformed);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operators_split_like_pdfjs() {
        let mut ops = Operations::new(b"BT /F1 12 Tf (a\\(b\\)\\101)Tj[(x)-250<41 4>]TJET 1.5.2 -.5 Td");
        let mut seen = vec![];
        while let Ok(Some((c, args))) = ops.read() {
            seen.push((String::from_utf8(c).unwrap(), args));
        }
        let names: Vec<&str> = seen.iter().map(|(c, _)| c.as_str()).collect();
        assert_eq!(names, ["BT", "Tf", "Tj", "TJ", "ET", "Td"]);
        assert!(matches!(&seen[2].1[0], Obj::Str(s) if s == b"a(b)A"));
        assert!(matches!(&seen[3].1[0], Obj::Arr(a) if matches!(&a[2], Obj::Str(s) if s == &[0x41, 0x40])));
        assert!(matches!(seen[5].1[..], [Obj::Num(a), Obj::Num(b)] if a == 0.2 && b == -0.5));
    }
}
