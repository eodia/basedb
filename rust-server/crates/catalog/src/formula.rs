//! The formula language — chapter 04 §7.2 to §7.6 (`core/src/formula/language.ts`).
//!
//! Three stages: [`parse_formula`] reads the typed text into a tree whose fields are still
//! labels; [`resolve_formula`] names each field by its catalog key, types every node and
//! decides whether the result can be stored; [`emit_formula`] turns the typed tree into SQL.
//! [`render_formula`] goes back from the stored tree to text with the labels of the day.
//!
//! Positions (`at`) are UTF-16 offsets, as JavaScript counts them: they are published in
//! `FORMULA_*` error details.

use basedb_base::error::AppError;
use indexmap::IndexSet;
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormulaType {
    Number,
    Text,
    Boolean,
    Date,
    Datetime,
    Null,
}

impl FormulaType {
    pub fn as_str(self) -> &'static str {
        match self {
            FormulaType::Number => "number",
            FormulaType::Text => "text",
            FormulaType::Boolean => "boolean",
            FormulaType::Date => "date",
            FormulaType::Datetime => "datetime",
            FormulaType::Null => "null",
        }
    }
}

/// The language a formula is written in (`formulaDialect` of `@basedb/contracts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormulaDialect {
    Fr,
    En,
}

impl FormulaDialect {
    pub fn as_str(self) -> &'static str {
        match self {
            FormulaDialect::Fr => "fr",
            FormulaDialect::En => "en",
        }
    }
}

/// A French screen reads formulas in French; every other screen, in English.
pub fn formula_dialect(language: &str) -> FormulaDialect {
    if language == "fr" {
        FormulaDialect::Fr
    } else {
        FormulaDialect::En
    }
}

/// `FORMULA_ENGLISH`: the English spelling of each word whose French one differs.
pub const FORMULA_ENGLISH: [(&str, &str); 44] = [
    ("SI", "IF"),
    ("SIVIDE", "IFBLANK"),
    ("ESTVIDE", "ISBLANK"),
    ("ARRONDI", "ROUND"),
    ("PLAFOND", "CEILING"),
    ("PLANCHER", "FLOOR"),
    ("MAJUSCULE", "UPPER"),
    ("MINUSCULE", "LOWER"),
    ("SANSESPACES", "TRIM"),
    ("GAUCHE", "LEFT"),
    ("DROITE", "RIGHT"),
    ("LONGUEUR", "LEN"),
    ("TEXTE", "TEXT"),
    ("NOMBRE", "VALUE"),
    ("STXT", "MID"),
    ("SUBSTITUE", "SUBSTITUTE"),
    ("TROUVE", "FIND"),
    ("CHERCHE", "SEARCH"),
    ("CONTIENT", "CONTAINS"),
    ("COMMENCEPAR", "STARTSWITH"),
    ("FINITPAR", "ENDSWITH"),
    ("NOMPROPRE", "PROPER"),
    ("JOINDRE_TEXTE", "TEXTJOIN"),
    ("REGEX_CORRESPOND", "REGEXMATCH"),
    ("REGEX_EXTRAIRE", "REGEXEXTRACT"),
    ("REGEX_REMPLACER", "REGEXREPLACE"),
    ("ANNEE", "YEAR"),
    ("MOIS", "MONTH"),
    ("JOUR", "DAY"),
    ("HEURE", "HOUR"),
    ("SECONDE", "SECOND"),
    ("JOURSEMAINE", "WEEKDAY"),
    ("NO_SEMAINE_ISO", "ISOWEEKNUM"),
    ("JOURS", "DAYS"),
    ("AJOUTER_JOURS", "ADD_DAYS"),
    ("AJOUTER_MOIS", "ADD_MONTHS"),
    ("FIN_MOIS", "EOMONTH"),
    ("AUJOURDHUI", "TODAY"),
    ("MAINTENANT", "NOW"),
    ("VRAI", "TRUE"),
    ("FAUX", "FALSE"),
    ("ET", "AND"),
    ("OU", "OR"),
    ("NON", "NOT"),
];

fn english(word: &str) -> Option<&'static str> {
    FORMULA_ENGLISH.iter().find(|(f, _)| *f == word).map(|(_, e)| *e)
}

/// A word as the tree spells it, whichever language it was typed in.
fn canonical(word: String) -> String {
    FORMULA_ENGLISH.iter().find(|(_, e)| *e == word).map(|(f, _)| f.to_string()).unwrap_or(word)
}

fn spell(word: &str, dialect: FormulaDialect) -> String {
    match dialect {
        FormulaDialect::En => english(word).unwrap_or(word).to_string(),
        FormulaDialect::Fr => word.to_string(),
    }
}

static WORD: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[\p{L}_][\p{L}\p{N}_]*").unwrap());

/// `formulaInEnglish`: a formula's text with its words renamed and `;` written `,`.
pub fn formula_in_english(text: &str) -> String {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i].1;
        if c == '"' || c == '[' {
            let close = if c == '"' { '"' } else { ']' };
            let mut j = i + 1;
            while j < chars.len() {
                if chars[j].1 == close {
                    if close == ']' && chars.get(j + 1).map(|x| x.1) == Some(']') {
                        j += 2;
                        continue;
                    }
                    break;
                }
                j += 1;
            }
            let end = chars.get(j + 1).map(|x| x.0).unwrap_or(text.len());
            out.push_str(&text[chars[i].0..end]);
            i = j + 1;
            continue;
        }
        if let Some(m) = WORD.find(&text[chars[i].0..]) {
            let w = m.as_str();
            let upper = w.to_uppercase();
            out.push_str(english(&upper).unwrap_or(w));
            i += w.chars().count();
            continue;
        }
        out.push(if c == ';' { ',' } else { c });
        i += 1;
    }
    out
}

/// A node as parsed: a field is still its label; `at` is where it starts.
#[derive(Debug, Clone, PartialEq)]
pub enum RawNode {
    Number { v: String, at: usize },
    Text { v: String, at: usize },
    Boolean { v: bool, at: usize },
    Null { at: usize },
    Field { label: String, at: usize },
    Call { fun: String, args: Vec<RawNode>, at: usize },
    Binary { op: String, left: Box<RawNode>, right: Box<RawNode>, at: usize },
    Not { e: Box<RawNode>, at: usize },
    Negate { e: Box<RawNode>, at: usize },
}

impl RawNode {
    pub fn at(&self) -> usize {
        match self {
            RawNode::Number { at, .. }
            | RawNode::Text { at, .. }
            | RawNode::Boolean { at, .. }
            | RawNode::Null { at }
            | RawNode::Field { at, .. }
            | RawNode::Call { at, .. }
            | RawNode::Binary { at, .. }
            | RawNode::Not { at, .. }
            | RawNode::Negate { at, .. } => *at,
        }
    }
}

/// The stored tree (`field_formula_config.ast`): a field is its catalog key.
#[derive(Debug, Clone, PartialEq)]
pub enum Node {
    Number(String),
    Text(String),
    Boolean(bool),
    Null,
    Field(String),
    Call { fun: String, args: Vec<Node> },
    Binary { op: String, left: Box<Node>, right: Box<Node> },
    Not(Box<Node>),
    Negate(Box<Node>),
}

impl Node {
    /// The tree as `field_formula_config.ast` stores it.
    pub fn to_json(&self) -> Value {
        match self {
            Node::Number(v) => json!({"t": "number", "v": v}),
            Node::Text(v) => json!({"t": "text", "v": v}),
            Node::Boolean(v) => json!({"t": "boolean", "v": v}),
            Node::Null => json!({"t": "null"}),
            Node::Field(id) => json!({"t": "field", "id": id}),
            Node::Call { fun, args } => {
                json!({"t": "call", "fn": fun, "args": args.iter().map(Node::to_json).collect::<Vec<_>>()})
            }
            Node::Binary { op, left, right } => {
                json!({"t": "binary", "op": op, "left": left.to_json(), "right": right.to_json()})
            }
            Node::Not(e) => json!({"t": "not", "e": e.to_json()}),
            Node::Negate(e) => json!({"t": "negate", "e": e.to_json()}),
        }
    }

    /// Reads a stored tree; `None` when it is not one.
    pub fn from_json(value: &Value) -> Option<Node> {
        let o = value.as_object()?;
        let s = |k: &str| o.get(k).and_then(Value::as_str).map(str::to_string);
        Some(match o.get("t")?.as_str()? {
            "number" => Node::Number(s("v")?),
            "text" => Node::Text(s("v")?),
            "boolean" => Node::Boolean(o.get("v")?.as_bool()?),
            "null" => Node::Null,
            "field" => Node::Field(s("id")?),
            "call" => Node::Call {
                fun: s("fn")?,
                args: o.get("args")?.as_array()?.iter().map(Node::from_json).collect::<Option<Vec<_>>>()?,
            },
            "binary" => Node::Binary {
                op: s("op")?,
                left: Box::new(Node::from_json(o.get("left")?)?),
                right: Box::new(Node::from_json(o.get("right")?)?),
            },
            "not" => Node::Not(Box::new(Node::from_json(o.get("e")?)?)),
            "negate" => Node::Negate(Box::new(Node::from_json(o.get("e")?)?)),
            _ => return None,
        })
    }
}

pub const MAX_FORMULA_CHARS: usize = 4000;
pub const MAX_FORMULA_DEPTH: usize = 16;

fn syntax(at: usize, detail: impl Into<String>) -> AppError {
    AppError::new("FORMULA_SYNTAX").with("position", json!(at)).with("detail", json!(detail.into()))
}

fn mismatch(at: usize, detail: impl Into<String>) -> AppError {
    AppError::new("FORMULA_TYPE_MISMATCH").with("position", json!(at)).with("detail", json!(detail.into()))
}

type R<T> = Result<T, AppError>;

// ── 1. Reading ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
enum Tok {
    Number(String),
    Text(String),
    Field(String),
    Word(String),
    Op(String),
    End,
}

/// JavaScript's `\s`.
pub(crate) fn js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{0B}' | '\u{0C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'..='\u{200A}'
            | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}'
    )
}

/// UTF-16 length, as JavaScript's `length`.
pub(crate) fn js_len(s: &str) -> usize {
    s.encode_utf16().count()
}

fn tokenize(input: &str) -> R<Vec<(Tok, usize)>> {
    // (byte offset, char, utf-16 offset)
    let mut chars: Vec<(usize, char, usize)> = Vec::new();
    let mut u = 0;
    for (b, c) in input.char_indices() {
        chars.push((b, c, u));
        u += c.len_utf16();
    }
    let total = u;
    let mut tokens = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let (byte, ch, at) = chars[i];
        if js_space(ch) {
            i += 1;
            continue;
        }
        if ch.is_ascii_digit() {
            let mut j = i;
            while j < chars.len() && chars[j].1.is_ascii_digit() {
                j += 1;
            }
            if j + 1 < chars.len() && chars[j].1 == '.' && chars[j + 1].1.is_ascii_digit() {
                j += 1;
                while j < chars.len() && chars[j].1.is_ascii_digit() {
                    j += 1;
                }
            }
            let end = chars.get(j).map(|c| c.0).unwrap_or(input.len());
            tokens.push((Tok::Number(input[byte..end].to_string()), at));
            i = j;
            continue;
        }
        if ch == '"' || ch == '[' {
            let close = if ch == '"' { '"' } else { ']' };
            let mut value = String::new();
            i += 1;
            loop {
                if i >= chars.len() {
                    return Err(syntax(at, if ch == '"' { "texte_non_ferme" } else { "champ_non_ferme" }));
                }
                if chars[i].1 == close {
                    if chars.get(i + 1).map(|c| c.1) == Some(close) {
                        value.push(close);
                        i += 2;
                        continue;
                    }
                    i += 1;
                    break;
                }
                value.push(chars[i].1);
                i += 1;
            }
            tokens.push((if ch == '"' { Tok::Text(value) } else { Tok::Field(value) }, at));
            continue;
        }
        let next = chars.get(i + 1).map(|c| c.1);
        let two: Option<&str> = match (ch, next) {
            ('<', Some('>')) => Some("<>"),
            ('<', Some('=')) => Some("<="),
            ('>', Some('=')) => Some(">="),
            _ => None,
        };
        if let Some(two) = two {
            tokens.push((Tok::Op(two.to_string()), at));
            i += 2;
            continue;
        }
        if "+-*/&=<>();,".contains(ch) {
            tokens.push((Tok::Op(if ch == ',' { ";".to_string() } else { ch.to_string() }), at));
            i += 1;
            continue;
        }
        if let Some(m) = WORD.find(&input[byte..]) {
            let w = m.as_str();
            tokens.push((Tok::Word(canonical(w.to_uppercase())), at));
            i += w.chars().count();
            continue;
        }
        return Err(syntax(at, format!("caractere_inattendu:{ch}")));
    }
    tokens.push((Tok::End, total));
    Ok(tokens)
}

struct Parser {
    tokens: Vec<(Tok, usize)>,
    pos: usize,
}

impl Parser {
    fn peek(&self) -> &(Tok, usize) {
        &self.tokens[self.pos]
    }
    fn next(&mut self) -> (Tok, usize) {
        let t = self.tokens[self.pos].clone();
        if self.pos < self.tokens.len() - 1 {
            self.pos += 1;
        } else {
            self.pos += 1;
            self.pos = self.pos.min(self.tokens.len() - 1);
        }
        t
    }
    fn is_op(&self, v: &str) -> bool {
        matches!(&self.peek().0, Tok::Op(o) if o == v)
    }
    fn is_word(&self, v: &str) -> bool {
        matches!(&self.peek().0, Tok::Word(o) if o == v)
    }
    fn expect(&mut self, v: &str) -> R<()> {
        let (t, at) = self.next();
        match t {
            Tok::Op(o) if o == v => Ok(()),
            _ => Err(syntax(at, format!("attendu:{v}"))),
        }
    }
    fn or(&mut self, d: usize) -> R<RawNode> {
        let mut left = self.and(d)?;
        while self.is_word("OU") {
            let at = self.next().1;
            let right = self.and(d)?;
            left = RawNode::Binary { op: "OU".into(), left: Box::new(left), right: Box::new(right), at };
        }
        Ok(left)
    }
    fn and(&mut self, d: usize) -> R<RawNode> {
        let mut left = self.not(d)?;
        while self.is_word("ET") {
            let at = self.next().1;
            let right = self.not(d)?;
            left = RawNode::Binary { op: "ET".into(), left: Box::new(left), right: Box::new(right), at };
        }
        Ok(left)
    }
    fn not(&mut self, d: usize) -> R<RawNode> {
        if self.is_word("NON") {
            let at = self.next().1;
            return Ok(RawNode::Not { e: Box::new(self.comparison(d)?), at });
        }
        self.comparison(d)
    }
    fn comparison(&mut self, d: usize) -> R<RawNode> {
        let left = self.sum(d)?;
        if let (Tok::Op(o), at) = self.peek().clone() {
            if ["=", "<>", "<", "<=", ">", ">="].contains(&o.as_str()) {
                self.next();
                let right = self.sum(d)?;
                return Ok(RawNode::Binary { op: o, left: Box::new(left), right: Box::new(right), at });
            }
        }
        Ok(left)
    }
    fn sum(&mut self, d: usize) -> R<RawNode> {
        let mut left = self.product(d)?;
        loop {
            match self.peek().clone() {
                (Tok::Op(o), at) if ["+", "-", "&"].contains(&o.as_str()) => {
                    self.next();
                    let right = self.product(d)?;
                    left = RawNode::Binary { op: o, left: Box::new(left), right: Box::new(right), at };
                }
                _ => return Ok(left),
            }
        }
    }
    fn product(&mut self, d: usize) -> R<RawNode> {
        let mut left = self.unary(d)?;
        loop {
            match self.peek().clone() {
                (Tok::Op(o), at) if ["*", "/"].contains(&o.as_str()) => {
                    self.next();
                    let right = self.unary(d)?;
                    left = RawNode::Binary { op: o, left: Box::new(left), right: Box::new(right), at };
                }
                _ => return Ok(left),
            }
        }
    }
    fn unary(&mut self, d: usize) -> R<RawNode> {
        if self.is_op("-") {
            let at = self.next().1;
            return Ok(RawNode::Negate { e: Box::new(self.primary(d)?), at });
        }
        self.primary(d)
    }
    fn primary(&mut self, d: usize) -> R<RawNode> {
        let (t, at) = self.next();
        if d > MAX_FORMULA_DEPTH {
            return Err(syntax(at, "imbrication_trop_profonde"));
        }
        match t {
            Tok::Number(v) => Ok(RawNode::Number { v, at }),
            Tok::Text(v) => Ok(RawNode::Text { v, at }),
            Tok::Field(label) => Ok(RawNode::Field { label, at }),
            Tok::Word(w) => {
                if w == "VRAI" || w == "FAUX" {
                    return Ok(RawNode::Boolean { v: w == "VRAI", at });
                }
                if w == "NULL" {
                    return Ok(RawNode::Null { at });
                }
                if !self.is_op("(") {
                    return Err(syntax(at, format!("mot_inconnu:{w}")));
                }
                self.next();
                let mut args = Vec::new();
                if !self.is_op(")") {
                    args.push(self.or(d + 1)?);
                    while self.is_op(";") {
                        self.next();
                        args.push(self.or(d + 1)?);
                    }
                }
                self.expect(")")?;
                Ok(RawNode::Call { fun: w, args, at })
            }
            Tok::Op(o) => {
                if o == "(" {
                    let inner = self.or(d + 1)?;
                    self.expect(")")?;
                    return Ok(inner);
                }
                Err(syntax(at, format!("inattendu:{o}")))
            }
            Tok::End => Err(syntax(at, "fin_inattendue")),
        }
    }
}

/// Reads a formula into a tree whose fields are still labels.
pub fn parse_formula(input: &str) -> R<RawNode> {
    if input.chars().count() > MAX_FORMULA_CHARS {
        return Err(syntax(0, "formule_trop_longue"));
    }
    if input.chars().all(js_space) {
        return Err(syntax(0, "formule_vide"));
    }
    let tokens = tokenize(input)?;
    let mut p = Parser { tokens, pos: 0 };
    let tree = p.or(0)?;
    let (rest, at) = p.peek().clone();
    if rest != Tok::End {
        return Err(syntax(at, "suite_inattendue"));
    }
    Ok(tree)
}

// ── 2. Resolving and typing ───────────────────────────────────────────────────────

/// A field a formula may name, as the catalog describes it.
#[derive(Debug, Clone, PartialEq)]
pub struct FormulaField {
    pub id: String,
    pub label: String,
    /// The physical name: what the SQL cites.
    pub name: String,
    pub kind: String,
    /// False for a field computed at read time.
    pub stored: bool,
    pub result_kind: Option<String>,
    pub multiple: bool,
}

pub fn type_of_kind(kind: &str) -> Option<FormulaType> {
    match kind {
        "short_text" | "long_text" | "url" | "email" | "select" => Some(FormulaType::Text),
        "number" | "autonumber" => Some(FormulaType::Number),
        "boolean" => Some(FormulaType::Boolean),
        "date" => Some(FormulaType::Date),
        "datetime" => Some(FormulaType::Datetime),
        _ => None,
    }
}

/// A formula's result, as the kind of a field (`field_formula_config.result_kind`).
pub fn kind_of_type(t: FormulaType) -> &'static str {
    match t {
        FormulaType::Number => "number",
        FormulaType::Text | FormulaType::Null => "short_text",
        FormulaType::Boolean => "boolean",
        FormulaType::Date => "date",
        FormulaType::Datetime => "datetime",
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RegexPattern {
    pub pattern: String,
    pub fun: String,
    pub position: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedFormula {
    pub ast: Node,
    pub r#type: FormulaType,
    pub dependencies: Vec<String>,
    pub stored: bool,
    pub uses_today: bool,
    pub uses_timezone: bool,
    pub patterns: Vec<RegexPattern>,
}

const MAX_JOINED: usize = 32;
use FormulaType as T;
const DAYS: &[FormulaType] = &[T::Date, T::Datetime];

struct Spec {
    arity: usize,
    max: Option<usize>,
    volatile: bool,
    days: &'static [usize],
    pattern: Option<usize>,
}

/// The names a formula may call, in the order of the table of §7.3.
pub const FORMULA_FUNCTIONS: &[&str] = &[
    "SI", "SIVIDE", "ESTVIDE", "ARRONDI", "ABS", "PLAFOND", "PLANCHER", "MIN", "MAX", "MAJUSCULE", "MINUSCULE",
    "SANSESPACES", "LONGUEUR", "GAUCHE", "DROITE", "STXT", "SUBSTITUE", "TROUVE", "CHERCHE", "CONTIENT",
    "COMMENCEPAR", "FINITPAR", "NOMPROPRE", "REPT", "CONCAT", "JOINDRE_TEXTE", "REGEX_CORRESPOND",
    "REGEX_EXTRAIRE", "REGEX_REMPLACER", "TEXTE", "NOMBRE", "ANNEE", "MOIS", "JOUR", "JOURSEMAINE",
    "NO_SEMAINE_ISO", "HEURE", "MINUTE", "SECONDE", "JOURS", "AJOUTER_JOURS", "AJOUTER_MOIS", "FIN_MOIS",
    "DATEDIF", "DATE", "AUJOURDHUI", "MAINTENANT",
];

fn spec(name: &str) -> Option<Spec> {
    let s = |arity: usize| Spec { arity, max: None, volatile: false, days: &[], pattern: None };
    Some(match name {
        "SI" | "STXT" | "SUBSTITUE" | "DATEDIF" | "DATE" => {
            let mut x = s(3);
            if name == "DATEDIF" {
                x.days = &[0, 1];
            }
            x
        }
        "SIVIDE" | "ARRONDI" | "MIN" | "MAX" | "GAUCHE" | "DROITE" | "TROUVE" | "CHERCHE" | "CONTIENT"
        | "COMMENCEPAR" | "FINITPAR" | "REPT" => s(2),
        "ESTVIDE" | "ABS" | "PLAFOND" | "PLANCHER" | "MAJUSCULE" | "MINUSCULE" | "SANSESPACES" | "LONGUEUR"
        | "NOMPROPRE" | "NOMBRE" => s(1),
        "CONCAT" => Spec { max: Some(MAX_JOINED), ..s(1) },
        "JOINDRE_TEXTE" => Spec { max: Some(MAX_JOINED + 2), ..s(3) },
        "REGEX_CORRESPOND" | "REGEX_EXTRAIRE" => Spec { pattern: Some(1), ..s(2) },
        "REGEX_REMPLACER" => Spec { pattern: Some(1), ..s(3) },
        "TEXTE" => Spec { max: Some(2), days: &[0], ..s(1) },
        "ANNEE" | "MOIS" | "JOUR" | "JOURSEMAINE" | "NO_SEMAINE_ISO" | "HEURE" | "MINUTE" | "SECONDE" => {
            Spec { days: &[0], ..s(1) }
        }
        "JOURS" => Spec { days: &[0, 1], ..s(2) },
        "AJOUTER_JOURS" | "AJOUTER_MOIS" => Spec { days: &[0], ..s(2) },
        "FIN_MOIS" => Spec { max: Some(2), days: &[0], ..s(1) },
        "AUJOURDHUI" | "MAINTENANT" => Spec { volatile: true, ..s(0) },
        _ => return None,
    })
}

fn expect_type(actual: Option<FormulaType>, allowed: &[FormulaType], at: usize, where_: &str) -> R<()> {
    match actual {
        None | Some(T::Null) => Ok(()),
        Some(a) if allowed.contains(&a) => Ok(()),
        Some(a) => Err(mismatch(at, format!("{where_}:{}", a.as_str()))),
    }
}

fn unify(a: FormulaType, b: FormulaType, at: usize) -> R<FormulaType> {
    if a == T::Null {
        return Ok(b);
    }
    if b == T::Null || a == b {
        return Ok(a);
    }
    Err(mismatch(at, format!("{}≠{}", a.as_str(), b.as_str())))
}

fn numbers(args: &[FormulaType], at: usize, w: &str) -> R<FormulaType> {
    for a in args {
        expect_type(Some(*a), &[T::Number], at, w)?;
    }
    Ok(T::Number)
}

fn texts(args: &[FormulaType], at: usize, w: &str) -> R<FormulaType> {
    for a in args {
        expect_type(Some(*a), &[T::Text], at, w)?;
    }
    Ok(T::Text)
}

fn joined(args: &[FormulaType], at: usize, w: &str) -> R<FormulaType> {
    for a in args {
        if *a == T::Date || *a == T::Datetime {
            return Err(AppError::new("FORMULA_FUNCTION_NOT_IMMUTABLE")
                .with("position", json!(at))
                .with("function", json!(w))
                .with("reason", json!("date_en_texte")));
        }
    }
    Ok(T::Text)
}

/// The typing of a call's result from its arguments (`FUNCTIONS[fn].type`).
fn call_type(name: &str, args: &[FormulaType], at: usize) -> R<FormulaType> {
    let a = |i: usize| args.get(i).copied();
    match name {
        "SI" => {
            expect_type(a(0), &[T::Boolean], at, "SI")?;
            unify(a(1).unwrap_or(T::Null), a(2).unwrap_or(T::Null), at)
        }
        "SIVIDE" => unify(a(0).unwrap_or(T::Null), a(1).unwrap_or(T::Null), at),
        "ESTVIDE" => Ok(T::Boolean),
        "ARRONDI" | "ABS" | "PLAFOND" | "PLANCHER" => numbers(args, at, name),
        "MIN" | "MAX" => {
            let ord = &[T::Number, T::Date, T::Datetime];
            expect_type(a(0), ord, at, name)?;
            expect_type(a(1), ord, at, name)?;
            unify(a(0).unwrap_or(T::Null), a(1).unwrap_or(T::Null), at)
        }
        "MAJUSCULE" | "MINUSCULE" | "SANSESPACES" | "NOMPROPRE" | "SUBSTITUE" | "REGEX_EXTRAIRE"
        | "REGEX_REMPLACER" => texts(args, at, name),
        "LONGUEUR" | "TROUVE" | "CHERCHE" | "NOMBRE" => {
            texts(args, at, name)?;
            Ok(T::Number)
        }
        "GAUCHE" | "DROITE" | "REPT" => {
            expect_type(a(0), &[T::Text], at, name)?;
            expect_type(a(1), &[T::Number], at, name)?;
            Ok(T::Text)
        }
        "STXT" => {
            expect_type(a(0), &[T::Text], at, name)?;
            expect_type(a(1), &[T::Number], at, name)?;
            expect_type(a(2), &[T::Number], at, name)?;
            Ok(T::Text)
        }
        "CONTIENT" | "COMMENCEPAR" | "FINITPAR" | "REGEX_CORRESPOND" => {
            texts(args, at, name)?;
            Ok(T::Boolean)
        }
        "CONCAT" => joined(args, at, name),
        "JOINDRE_TEXTE" => {
            expect_type(a(0), &[T::Text], at, name)?;
            expect_type(a(1), &[T::Boolean], at, name)?;
            joined(args.get(2..).unwrap_or(&[]), at, name)
        }
        "TEXTE" => match a(1) {
            None => {
                if a(0) == Some(T::Date) || a(0) == Some(T::Datetime) {
                    return Err(AppError::new("FORMULA_FUNCTION_NOT_IMMUTABLE")
                        .with("position", json!(at))
                        .with("function", json!("TEXTE"))
                        .with("reason", json!("date_en_texte")));
                }
                expect_type(a(0), &[T::Number, T::Boolean, T::Text], at, "TEXTE")?;
                Ok(T::Text)
            }
            Some(_) => {
                expect_type(a(0), &[T::Date, T::Datetime], at, "TEXTE")?;
                expect_type(a(1), &[T::Text], at, "TEXTE")?;
                Ok(T::Text)
            }
        },
        "ANNEE" | "MOIS" | "JOUR" | "JOURSEMAINE" | "NO_SEMAINE_ISO" => {
            expect_type(a(0), DAYS, at, name)?;
            Ok(T::Number)
        }
        "HEURE" | "MINUTE" | "SECONDE" => {
            expect_type(a(0), &[T::Datetime], at, name)?;
            Ok(T::Number)
        }
        "JOURS" => {
            expect_type(a(0), DAYS, at, name)?;
            expect_type(a(1), DAYS, at, name)?;
            Ok(T::Number)
        }
        "AJOUTER_JOURS" | "AJOUTER_MOIS" => {
            expect_type(a(0), DAYS, at, name)?;
            expect_type(a(1), &[T::Number], at, name)?;
            Ok(T::Date)
        }
        "FIN_MOIS" => {
            expect_type(a(0), DAYS, at, name)?;
            if a(1).is_some() {
                expect_type(a(1), &[T::Number], at, name)?;
            }
            Ok(T::Date)
        }
        "DATEDIF" => {
            expect_type(a(0), DAYS, at, name)?;
            expect_type(a(1), DAYS, at, name)?;
            expect_type(a(2), &[T::Text], at, name)?;
            Ok(T::Number)
        }
        "DATE" => {
            numbers(args, at, name)?;
            Ok(T::Date)
        }
        "AUJOURDHUI" => Ok(T::Date),
        "MAINTENANT" => Ok(T::Datetime),
        _ => Ok(T::Null),
    }
}

fn written_text<'a>(node: Option<&'a Node>, at: usize, w: &str) -> R<&'a str> {
    match node {
        Some(Node::Text(v)) => Ok(v),
        _ => Err(syntax(at, format!("texte_ecrit_attendu:{w}"))),
    }
}

fn call_check(name: &str, nodes: &[Node], types: &[FormulaType], ats: &[usize], at: usize) -> R<()> {
    let at_of = |i: usize| ats.get(i).copied().unwrap_or(at);
    match name {
        "JOINDRE_TEXTE" => {
            written_text(nodes.first(), at_of(0), "JOINDRE_TEXTE:separateur")?;
            if !matches!(nodes.get(1), Some(Node::Boolean(_))) {
                return Err(syntax(at_of(1), "valeur_ecrite_attendue:JOINDRE_TEXTE:ignorer_vides"));
            }
            Ok(())
        }
        "TEXTE" => {
            if nodes.len() < 2 {
                return Ok(());
            }
            let format = written_text(nodes.get(1), at_of(1), "TEXTE:format")?;
            let parts = parse_date_format(format, at_of(1))?;
            if types.first() == Some(&T::Date)
                && parts.iter().any(|p| matches!(p, FormatPart::Unit(u, _) if matches!(*u, "hour" | "minute" | "second")))
            {
                return Err(mismatch(at, "TEXTE:heure_sur_date"));
            }
            Ok(())
        }
        "DATEDIF" => {
            date_dif_unit(written_text(nodes.get(2), at_of(2), "DATEDIF:unite")?, at_of(2))?;
            Ok(())
        }
        _ => Ok(()),
    }
}

#[derive(Debug, Clone, PartialEq)]
enum FormatPart {
    Text(String),
    /// unit (`year`, `month`, `day`, `hour`, `minute`, `second`), digits
    Unit(&'static str, usize),
}

fn format_letter(c: char) -> Option<&'static str> {
    match c {
        'y' | 'a' => Some("year"),
        'm' => Some("month"),
        'd' | 'j' => Some("day"),
        'h' => Some("hour"),
        's' => Some("second"),
        _ => None,
    }
}

fn lower_char(c: char) -> String {
    c.to_lowercase().collect()
}

fn parse_date_format(format: &str, at: usize) -> R<Vec<FormatPart>> {
    let chars: Vec<char> = format.chars().collect();
    let mut parts: Vec<FormatPart> = Vec::new();
    fn literal(parts: &mut Vec<FormatPart>, v: &str) {
        if let Some(FormatPart::Text(last)) = parts.last_mut() {
            last.push_str(v);
        } else {
            parts.push(FormatPart::Text(v.to_string()));
        }
    }
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '\\' {
            let Some(next) = chars.get(i + 1) else {
                return Err(syntax(at, "format_inconnu:\\"));
            };
            literal(&mut parts, &next.to_string());
            i += 2;
            continue;
        }
        if !ch.is_ascii_alphabetic() {
            literal(&mut parts, &ch.to_string());
            i += 1;
            continue;
        }
        let low = ch.to_ascii_lowercase();
        let unit = format_letter(low);
        let mut run = 1;
        while chars.get(i + run).map(|c| lower_char(*c)) == Some(low.to_string()) {
            run += 1;
        }
        let code: String = chars[i..i + run].iter().collect();
        let Some(unit) = unit else {
            return Err(syntax(at, format!("format_inconnu:{ch}")));
        };
        if unit == "year" {
            if run != 2 && run != 4 {
                return Err(syntax(at, format!("format_inconnu:{code}")));
            }
        } else if run > 2 {
            return Err(syntax(at, format!("format_inconnu:{code}")));
        }
        parts.push(FormatPart::Unit(unit, run));
        i += run;
    }
    let codes: Vec<usize> = parts.iter().enumerate().filter(|(_, p)| !matches!(p, FormatPart::Text(_))).map(|(i, _)| i).collect();
    let unit_at = |k: Option<&usize>| k.and_then(|&i| match &parts[i] {
        FormatPart::Unit(u, _) => Some(*u),
        _ => None,
    });
    let mut out = parts.clone();
    for (ci, &pi) in codes.iter().enumerate() {
        if let FormatPart::Unit("month", d) = parts[pi] {
            let before = if ci == 0 { None } else { unit_at(codes.get(ci - 1)) };
            let after = unit_at(codes.get(ci + 1));
            if before == Some("hour") || after == Some("second") {
                out[pi] = FormatPart::Unit("minute", d);
            }
        }
    }
    Ok(out)
}

fn date_dif_unit(unit: &str, at: usize) -> R<String> {
    let upper = unit.to_uppercase();
    if !["Y", "M", "D", "YM"].contains(&upper.as_str()) {
        return Err(syntax(at, format!("unite_inconnue:{unit}")));
    }
    Ok(upper)
}

fn regex_pattern(node: Option<&Node>, at: usize, w: &str) -> R<String> {
    let pattern = written_text(node, at, &format!("{w}:motif"))?;
    let units: Vec<u16> = pattern.encode_utf16().collect();
    let mut i = 0;
    while i < units.len() {
        if units[i] != b'\\' as u16 {
            i += 1;
            continue;
        }
        if let Some(&n) = units.get(i + 1) {
            if (b'1' as u16..=b'9' as u16).contains(&n) {
                return Err(syntax(at, format!("motif_refuse:{w}:reference_arriere")));
            }
        }
        i += 2;
    }
    Ok(pattern.to_string())
}

/// Names fields by their catalog key, types the tree, and decides whether it can be stored.
/// `fields` is keyed by `key_of(label)`.
pub fn resolve_formula(
    raw: &RawNode,
    fields: &HashMap<String, FormulaField>,
    key_of: &dyn Fn(&str) -> String,
) -> R<ResolvedFormula> {
    struct St<'a> {
        fields: &'a HashMap<String, FormulaField>,
        key_of: &'a dyn Fn(&str) -> String,
        deps: IndexSet<String>,
        patterns: Vec<RegexPattern>,
        stored: bool,
        uses_today: bool,
        zoned: bool,
    }
    fn walk(st: &mut St, node: &RawNode) -> R<(Node, FormulaType)> {
        Ok(match node {
            RawNode::Number { v, .. } => (Node::Number(v.clone()), T::Number),
            RawNode::Text { v, .. } => (Node::Text(v.clone()), T::Text),
            RawNode::Boolean { v, .. } => (Node::Boolean(*v), T::Boolean),
            RawNode::Null { .. } => (Node::Null, T::Null),
            RawNode::Field { label, at } => {
                let Some(field) = st.fields.get(&(st.key_of)(label)) else {
                    return Err(AppError::new("FORMULA_FIELD_NOT_FOUND").with("position", json!(at)).with("field", json!(label)));
                };
                if field.kind == "link" || field.kind == "multi_link" {
                    return Err(AppError::new("FORMULA_LINK_FORBIDDEN").with("position", json!(at)).with("field", json!(label)));
                }
                if field.kind == "formula" {
                    return Err(AppError::new("FORMULA_DEPENDS_ON_FORMULA").with("position", json!(at)).with("field", json!(label)));
                }
                let computed = !field.stored;
                if computed && field.multiple {
                    return Err(mismatch(*at, format!("liste:{label}")));
                }
                let kind = if computed { field.result_kind.clone().unwrap_or_default() } else { field.kind.clone() };
                let Some(t) = type_of_kind(&kind) else {
                    return Err(mismatch(*at, format!("type_de_champ:{label}")));
                };
                if computed {
                    st.stored = false;
                }
                st.deps.insert(field.id.clone());
                (Node::Field(field.id.clone()), t)
            }
            RawNode::Call { fun, args, at } => {
                let Some(sp) = spec(fun) else {
                    return Err(syntax(*at, format!("fonction_inconnue:{fun}")));
                };
                let max = sp.max.unwrap_or(sp.arity);
                if args.len() < sp.arity || args.len() > max {
                    let expected = if max == sp.arity { sp.arity.to_string() } else { format!("{}-{max}", sp.arity) };
                    return Err(syntax(*at, format!("arguments:{fun}:{expected}")));
                }
                let mut walked = Vec::new();
                for a in args {
                    walked.push(walk(st, a)?);
                }
                if sp.volatile {
                    st.stored = false;
                    if fun == "AUJOURDHUI" {
                        st.uses_today = true;
                    }
                }
                let types: Vec<FormulaType> = walked.iter().map(|w| w.1).collect();
                let t = call_type(fun, &types, *at)?;
                let nodes: Vec<Node> = walked.into_iter().map(|w| w.0).collect();
                let ats: Vec<usize> = args.iter().map(RawNode::at).collect();
                call_check(fun, &nodes, &types, &ats, *at)?;
                if let Some(p) = sp.pattern {
                    let position = ats.get(p).copied().unwrap_or(*at);
                    st.patterns.push(RegexPattern { pattern: regex_pattern(nodes.get(p), position, fun)?, fun: fun.clone(), position });
                }
                if sp.days.iter().any(|&i| types.get(i) == Some(&T::Datetime)) {
                    st.stored = false;
                    st.zoned = true;
                }
                (Node::Call { fun: fun.clone(), args: nodes }, t)
            }
            RawNode::Binary { op, left, right, at } => {
                let (ln, l) = walk(st, left)?;
                let (rn, r) = walk(st, right)?;
                let at = *at;
                let t = match op.as_str() {
                    "ET" | "OU" => {
                        expect_type(Some(l), &[T::Boolean], at, op)?;
                        expect_type(Some(r), &[T::Boolean], at, op)?;
                        T::Boolean
                    }
                    "&" => {
                        if [l, r].iter().any(|x| *x == T::Date || *x == T::Datetime) {
                            return Err(AppError::new("FORMULA_FUNCTION_NOT_IMMUTABLE").with("position", json!(at)).with("function", json!("&")));
                        }
                        T::Text
                    }
                    "=" | "<>" | "<" | "<=" | ">" | ">=" => {
                        unify(l, r, at)?;
                        T::Boolean
                    }
                    "-" => {
                        if l == T::Date && r == T::Date {
                            T::Number
                        } else if l == T::Date && (r == T::Number || r == T::Null) {
                            T::Date
                        } else {
                            numbers(&[l, r], at, op)?
                        }
                    }
                    "+" => {
                        if (l == T::Date && (r == T::Number || r == T::Null)) || (r == T::Date && l == T::Number) {
                            T::Date
                        } else {
                            numbers(&[l, r], at, op)?
                        }
                    }
                    "*" | "/" => numbers(&[l, r], at, op)?,
                    _ => return Err(syntax(at, format!("operateur:{op}"))),
                };
                (Node::Binary { op: op.clone(), left: Box::new(ln), right: Box::new(rn) }, t)
            }
            RawNode::Not { e, at } => {
                let (n, t) = walk(st, e)?;
                expect_type(Some(t), &[T::Boolean], *at, "NON")?;
                (Node::Not(Box::new(n)), T::Boolean)
            }
            RawNode::Negate { e, at } => {
                let (n, t) = walk(st, e)?;
                expect_type(Some(t), &[T::Number], *at, "-")?;
                (Node::Negate(Box::new(n)), T::Number)
            }
        })
    }
    let mut st = St { fields, key_of, deps: IndexSet::new(), patterns: vec![], stored: true, uses_today: false, zoned: false };
    let (ast, t) = walk(&mut st, raw)?;
    if t == T::Null {
        return Err(mismatch(0, "resultat_toujours_vide"));
    }
    Ok(ResolvedFormula {
        ast,
        r#type: t,
        dependencies: st.deps.into_iter().collect(),
        stored: st.stored,
        uses_today: st.uses_today,
        uses_timezone: st.uses_today || st.zoned,
        patterns: st.patterns,
    })
}

// ── 3. Emitting SQL ───────────────────────────────────────────────────────────────

/// What emission needs of the catalog.
pub struct EmitContext<'a> {
    /// The SQL that reads a field, by catalog key.
    pub field: &'a dyn Fn(&str) -> String,
    /// The type of a field's value.
    pub type_of: &'a dyn Fn(&str) -> FormulaType,
    pub timezone: &'a str,
}

static NUMBER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[0-9]+(\.[0-9]+)?$").unwrap());
static TIMEZONE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$").unwrap());

fn literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn bounded_int(sql: &str, lo: i64, hi: i64) -> String {
    format!("least(greatest({sql}, {lo}), {hi})::int")
}

fn int_arg(node: &Node, sql: &str, lo: i64, hi: i64) -> String {
    if let Node::Number(v) = node {
        let n = v.parse::<f64>().unwrap_or(0.0).trunc();
        let clamped = n.max(lo as f64).min(hi as f64);
        return format!("{}", clamped as i64);
    }
    format!("(CASE WHEN {sql} IS NULL THEN NULL ELSE trunc(least(greatest({sql}, {lo}), {hi}))::int END)")
}

const MAX_SQL_CHARS: usize = 200_000;
const MAX_CHARS: i64 = 1_000_000;
const MAX_REPEATED: i64 = 32_767;
const MAX_MONTHS: i64 = 12_000;

fn regex_literal(node: &Node, w: &str) -> R<String> {
    Ok(format!("{}::text", literal(&regex_pattern(Some(node), 0, w)?)))
}

fn within_years(sql: &str) -> String {
    format!("(CASE WHEN {sql} BETWEEN '0001-01-01'::date AND '9999-12-31'::date THEN {sql} END)")
}

fn date_format_sql(parts: &[FormatPart], local: &str, datetime: bool) -> String {
    let pad = |sql: String, digits: usize| if digits == 2 { format!("lpad({sql}::text, 2, '0')") } else { format!("{sql}::text") };
    let pieces: Vec<String> = parts
        .iter()
        .map(|p| match p {
            FormatPart::Text(v) => literal(v),
            FormatPart::Unit("year", 4) => format!("lpad(extract(year from {local})::int::text, 4, '0')"),
            FormatPart::Unit("year", _) => format!("lpad((extract(year from {local})::int % 100)::text, 2, '0')"),
            FormatPart::Unit("second", d) => pad(format!("floor(extract(second from {local}))::int"), *d),
            FormatPart::Unit(u, d) => pad(format!("extract({u} from {local})::int"), *d),
        })
        .collect();
    let (first, last) = if datetime {
        ("'0001-01-01'::timestamp", "'9999-12-31 23:59:59.999999'::timestamp")
    } else {
        ("'0001-01-01'::date", "'9999-12-31'::date")
    };
    let text = if pieces.is_empty() { "''::text".to_string() } else { pieces.join(" || ") };
    format!("(CASE WHEN {local} BETWEEN {first} AND {last} THEN {text} END)")
}

fn as_text(sql: &str, t: FormulaType) -> String {
    match t {
        T::Number => format!("trim_scale({sql})::text"),
        T::Boolean => format!("CASE WHEN {sql} THEN 'VRAI' WHEN NOT {sql} THEN 'FAUX' END"),
        _ => format!("{sql}::text"),
    }
}

/// The SQL of a typed tree.
pub fn emit_formula(ast: &Node, context: &EmitContext) -> R<String> {
    Emitter { cx: context }.emit(ast)
}

struct Emitter<'a, 'b> {
    cx: &'a EmitContext<'b>,
}

impl Emitter<'_, '_> {
    fn type_of(&self, node: &Node) -> R<FormulaType> {
        Ok(match node {
            Node::Number(_) => T::Number,
            Node::Text(_) => T::Text,
            Node::Boolean(_) => T::Boolean,
            Node::Null => T::Null,
            Node::Field(id) => (self.cx.type_of)(id),
            Node::Not(_) => T::Boolean,
            Node::Negate(_) => T::Number,
            Node::Call { fun, args } => {
                if spec(fun).is_none() {
                    return Ok(T::Null);
                }
                let types = args.iter().map(|a| self.type_of(a)).collect::<R<Vec<_>>>()?;
                call_type(fun, &types, 0)?
            }
            Node::Binary { op, left, right } => {
                let l = self.type_of(left)?;
                let r = self.type_of(right)?;
                match op.as_str() {
                    "ET" | "OU" | "=" | "<>" | "<" | "<=" | ">" | ">=" => T::Boolean,
                    "&" => T::Text,
                    "-" if l == T::Date && r == T::Date => T::Number,
                    "-" | "+" if l == T::Date || r == T::Date => T::Date,
                    _ => T::Number,
                }
            }
        })
    }

    fn zone(&self) -> R<String> {
        if !TIMEZONE.is_match(self.cx.timezone) {
            return Err(AppError::new("FORMULA_SYNTAX").with("timezone", json!(self.cx.timezone)));
        }
        Ok(literal(self.cx.timezone))
    }

    fn emit(&self, node: &Node) -> R<String> {
        let sql = self.emit_node(node)?;
        if js_len(&sql) > MAX_SQL_CHARS {
            return Err(AppError::new("FORMULA_SYNTAX").with("detail", json!("formule_trop_complexe")));
        }
        Ok(sql)
    }

    fn emit_node(&self, node: &Node) -> R<String> {
        Ok(match node {
            Node::Number(v) => {
                if !NUMBER.is_match(v) {
                    return Err(AppError::new("FORMULA_SYNTAX").with("value", json!(v)));
                }
                format!("{v}::numeric")
            }
            Node::Text(v) => format!("{}::text", literal(v)),
            Node::Boolean(v) => (if *v { "TRUE" } else { "FALSE" }).to_string(),
            Node::Null => "NULL".to_string(),
            Node::Field(id) => (self.cx.field)(id),
            Node::Not(e) => format!("(NOT {})", self.emit(e)?),
            Node::Negate(e) => format!("(-{})", self.emit(e)?),
            Node::Binary { op, left, right } => {
                let l = self.emit(left)?;
                let r = self.emit(right)?;
                let lt = self.type_of(left)?;
                let rt = self.type_of(right)?;
                match op.as_str() {
                    "ET" => format!("({l} AND {r})"),
                    "OU" => format!("({l} OR {r})"),
                    "&" => format!("(coalesce({}, '') || coalesce({}, ''))", as_text(&l, lt), as_text(&r, rt)),
                    "/" => format!("(CASE WHEN {r} = 0 OR {r} IS NULL THEN NULL ELSE {l} / {r} END)"),
                    "-" if lt == T::Date && rt == T::Date => format!("(({l} - {r})::numeric)"),
                    "-" if lt == T::Date => format!("({l} - {})", bounded_int(&r, -100000, 100000)),
                    "-" => format!("({l} - {r})"),
                    "+" if lt == T::Date => format!("({l} + {})", bounded_int(&r, -100000, 100000)),
                    "+" if rt == T::Date => format!("({r} + {})", bounded_int(&l, -100000, 100000)),
                    "+" => format!("({l} + {r})"),
                    _ => format!("({l} {op} {r})"),
                }
            }
            Node::Call { fun, args } => self.emit_call(fun, args)?,
        })
    }

    fn emit_call(&self, fun: &str, nodes: &[Node]) -> R<String> {
        let a = nodes.iter().map(|n| self.emit(n)).collect::<R<Vec<_>>>()?;
        let t = nodes.iter().map(|n| self.type_of(n)).collect::<R<Vec<_>>>()?;
        let arg = |i: usize| a.get(i).cloned().unwrap_or_else(|| "undefined".to_string());
        let written = |i: usize| &nodes[i];
        let wall = |i: usize| -> R<String> { Ok(format!("({} AT TIME ZONE {})", arg(i), self.zone()?)) };
        let day = |i: usize| -> R<String> {
            if t.get(i) == Some(&T::Datetime) {
                Ok(format!("{}::date", wall(i)?))
            } else {
                Ok(arg(i))
            }
        };
        let fold = |i: usize| format!("_basedb_local.fold_v1({})", arg(i));
        let months = |i: usize| int_arg(written(i), &arg(i), -MAX_MONTHS, MAX_MONTHS);
        Ok(match fun {
            "SI" => format!("(CASE WHEN {} THEN {} ELSE {} END)", arg(0), arg(1), arg(2)),
            "SIVIDE" => format!("coalesce({}, {})", arg(0), arg(1)),
            "ESTVIDE" => format!("({} IS NULL)", arg(0)),
            "ARRONDI" => format!("round({}, {})", arg(0), bounded_int(&arg(1), -1000, 1000)),
            "ABS" => format!("abs({})", arg(0)),
            "PLAFOND" => format!("ceil({})", arg(0)),
            "PLANCHER" => format!("floor({})", arg(0)),
            "MIN" => format!("least({}, {})", arg(0), arg(1)),
            "MAX" => format!("greatest({}, {})", arg(0), arg(1)),
            "MAJUSCULE" => format!("upper({} COLLATE \"und-x-icu\")", arg(0)),
            "MINUSCULE" => format!("lower({} COLLATE \"und-x-icu\")", arg(0)),
            "SANSESPACES" => format!("btrim({})", arg(0)),
            "LONGUEUR" => format!("length({})::numeric", arg(0)),
            "GAUCHE" => format!("left({}, {})", arg(0), bounded_int(&arg(1), 0, 1000000)),
            "DROITE" => format!("right({}, {})", arg(0), bounded_int(&arg(1), 0, 1000000)),
            "STXT" => format!(
                "substr({}, {}, {})",
                arg(0),
                int_arg(written(1), &arg(1), 1, MAX_CHARS),
                int_arg(written(2), &arg(2), 0, MAX_CHARS)
            ),
            "SUBSTITUE" => format!("replace({}, {}, {})", arg(0), arg(1), arg(2)),
            "TROUVE" => format!("nullif(strpos({}, {}), 0)::numeric", arg(1), arg(0)),
            "CHERCHE" => {
                let lowered = |i: usize| match written(i) {
                    Node::Text(v) => format!("{}::text", literal(&v.to_lowercase())),
                    _ => format!("lower({} COLLATE \"und-x-icu\")", arg(i)),
                };
                format!("nullif(strpos({}, {}), 0)::numeric", lowered(1), lowered(0))
            }
            "CONTIENT" => format!("(strpos({}, {}) > 0)", fold(0), fold(1)),
            "COMMENCEPAR" => format!("starts_with({}, {})", fold(0), fold(1)),
            "FINITPAR" => format!("starts_with(reverse({}), reverse({}))", fold(0), fold(1)),
            "NOMPROPRE" => format!("initcap({} COLLATE \"und-x-icu\")", arg(0)),
            "REPT" => {
                let count = int_arg(written(1), &arg(1), 0, MAX_REPEATED);
                format!(
                    "(CASE WHEN length({})::bigint * {count} > {MAX_REPEATED} THEN NULL ELSE repeat({}, {count}) END)",
                    arg(0),
                    arg(0)
                )
            }
            "CONCAT" => format!(
                "({})",
                (0..nodes.len()).map(|i| format!("coalesce({}, '')", as_text(&arg(i), t[i]))).collect::<Vec<_>>().join(" || ")
            ),
            "JOINDRE_TEXTE" => {
                let separator = written_text(Some(written(0)), 0, "JOINDRE_TEXTE:separateur")?.to_string();
                let ignore = matches!(written(1), Node::Boolean(true));
                let parts: Vec<String> = (2..nodes.len()).map(|i| as_text(&arg(i), t[i])).collect();
                let sep = literal(&separator);
                if !ignore {
                    let glue = format!(" || {sep} || ");
                    return Ok(format!("({})", parts.iter().map(|p| format!("coalesce({p}, '')")).collect::<Vec<_>>().join(&glue)));
                }
                let all = parts
                    .iter()
                    .enumerate()
                    .map(|(i, p)| match written(i + 2) {
                        Node::Text(v) if v.is_empty() => "''".to_string(),
                        Node::Text(v) => format!("({sep} || {})", literal(v)),
                        _ => format!("(CASE WHEN length({p}) > 0 THEN {sep} || {p} ELSE '' END)"),
                    })
                    .collect::<Vec<_>>()
                    .join(" || ");
                format!("substr({all}, {})", separator.chars().count() + 1)
            }
            "REGEX_CORRESPOND" => {
                format!("(({}) COLLATE \"und-x-icu\" ~ {})", arg(0), regex_literal(written(1), "REGEX_CORRESPOND")?)
            }
            "REGEX_EXTRAIRE" => {
                format!("substring(({}) COLLATE \"und-x-icu\", {})", arg(0), regex_literal(written(1), "REGEX_EXTRAIRE")?)
            }
            "REGEX_REMPLACER" => format!(
                "regexp_replace(({}) COLLATE \"und-x-icu\", {}, {}, 'g')",
                arg(0),
                regex_literal(written(1), "REGEX_REMPLACER")?,
                arg(2)
            ),
            "TEXTE" => {
                if nodes.len() == 1 {
                    return Ok(as_text(&arg(0), t[0]));
                }
                let format = parse_date_format(written_text(Some(written(1)), 0, "TEXTE:format")?, 0)?;
                if t[0] == T::Datetime {
                    date_format_sql(&format, &wall(0)?, true)
                } else {
                    date_format_sql(&format, &format!("({})", arg(0)), false)
                }
            }
            "NOMBRE" => format!("(CASE WHEN {} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ({})::numeric ELSE NULL END)", arg(0), arg(0)),
            "ANNEE" => format!("extract(year from {})::numeric", day(0)?),
            "MOIS" => format!("extract(month from {})::numeric", day(0)?),
            "JOUR" => format!("extract(day from {})::numeric", day(0)?),
            "JOURSEMAINE" => format!("extract(isodow from {})::numeric", day(0)?),
            "NO_SEMAINE_ISO" => format!("extract(week from {})::numeric", day(0)?),
            "HEURE" => format!("extract(hour from {})::numeric", wall(0)?),
            "MINUTE" => format!("extract(minute from {})::numeric", wall(0)?),
            "SECONDE" => format!("floor(extract(second from {}))::numeric", wall(0)?),
            "JOURS" => format!("(({} - {})::numeric)", day(0)?, day(1)?),
            "AJOUTER_JOURS" => format!("({} + {})", day(0)?, bounded_int(&arg(1), -100000, 100000)),
            "AJOUTER_MOIS" => format!("({} + make_interval(months => {}))::date", within_years(&day(0)?), months(1)),
            "FIN_MOIS" => {
                let shift = if nodes.len() == 2 { months(1) } else { "0".to_string() };
                format!(
                    "(date_trunc('month', {} + make_interval(months => {shift})) + interval '1 month' - interval '1 day')::date",
                    within_years(&day(0)?)
                )
            }
            "DATEDIF" => {
                let unit = date_dif_unit(written_text(Some(written(2)), 0, "DATEDIF:unite")?, 0)?;
                let (d0, d1) = (within_years(&day(0)?), within_years(&day(1)?));
                let age = format!("age({d1}::timestamp, {d0}::timestamp)");
                match unit.as_str() {
                    "Y" => format!("extract(year from {age})::numeric"),
                    "M" => format!("(extract(year from {age}) * 12 + extract(month from {age}))::numeric"),
                    "YM" => format!("extract(month from {age})::numeric"),
                    _ => format!("(({d1} - {d0})::numeric)"),
                }
            }
            "DATE" => format!("_basedb_local.safe_date_v1({}, {}, {})", arg(0), arg(1), arg(2)),
            "AUJOURDHUI" => format!("(pg_catalog.now() AT TIME ZONE {})::date", self.zone()?),
            "MAINTENANT" => "pg_catalog.now()".to_string(),
            _ => return Err(AppError::new("FORMULA_SYNTAX").with("function", json!(fun))),
        })
    }
}

// ── 4. Rendering ──────────────────────────────────────────────────────────────────

fn precedence(op: &str) -> u8 {
    match op {
        "OU" => 1,
        "ET" => 2,
        "=" | "<>" | "<" | "<=" | ">" | ">=" => 4,
        "+" | "-" | "&" => 5,
        "*" | "/" => 6,
        _ => 0,
    }
}

/// The text of a stored tree, with today's labels and in the reader's language.
pub fn render_formula(ast: &Node, label_of: &dyn Fn(&str) -> String, dialect: FormulaDialect) -> String {
    let sep = if dialect == FormulaDialect::En { ", " } else { "; " };
    fn render(n: &Node, parent: u8, label_of: &dyn Fn(&str) -> String, d: FormulaDialect, sep: &str) -> String {
        match n {
            Node::Number(v) => v.clone(),
            Node::Text(v) => format!("\"{}\"", v.replace('"', "\"\"")),
            Node::Boolean(v) => spell(if *v { "VRAI" } else { "FAUX" }, d),
            Node::Null => "NULL".to_string(),
            Node::Field(id) => format!("[{}]", label_of(id).replace(']', "]]")),
            Node::Not(e) => {
                let text = format!("{} {}", spell("NON", d), render(e, 4, label_of, d, sep));
                if parent > 3 {
                    format!("({text})")
                } else {
                    text
                }
            }
            Node::Negate(e) => format!("-{}", render(e, 7, label_of, d, sep)),
            Node::Call { fun, args } => format!(
                "{}({})",
                spell(fun, d),
                args.iter().map(|a| render(a, 0, label_of, d, sep)).collect::<Vec<_>>().join(sep)
            ),
            Node::Binary { op, left, right } => {
                let p = precedence(op);
                let text = format!(
                    "{} {} {}",
                    render(left, p, label_of, d, sep),
                    spell(op, d),
                    render(right, p + 1, label_of, d, sep)
                );
                if p < parent {
                    format!("({text})")
                } else {
                    text
                }
            }
        }
    }
    render(ast, 0, label_of, dialect, sep)
}

/// Details of a `FORMULA_*` error, for tests.
#[cfg(test)]
fn details_of(e: &AppError) -> serde_json::Map<String, Value> {
    e.details.clone()
}

#[cfg(test)]
mod tests;
