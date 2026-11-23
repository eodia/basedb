//! Filters and sorts — `records/filter.ts`, chapter 08 §4, chapter 04 §9.
//!
//! The grammar, the bounds, the operators per type, the casts and the SQL text are
//! Node's, character for character: the same filter yields the same statement, so
//! PostgreSQL answers both servers alike.

use basedb_base::error::AppError;
use basedb_base::rbac::rows::row_where;
use basedb_contracts::naming::quote_identifier;
use indexmap::IndexMap;
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::LazyLock;

use crate::js::{js_space, number_string};

pub const OPERATORS: [&str; 15] = [
    "eq", "ne", "eq_ci", "contains", "starts_with", "ends_with", "in", "is_null", "gt", "gte", "lt", "lte", "between", "has_any", "has_all",
];

const BYTES: usize = 4096;
const PREDICATES: usize = 32;
const DEPTH: usize = 8;
const IN_ELEMENTS: usize = 200;
const LINK_PATHS: usize = 4;

/// `ALLOWED[kind]`.
pub fn allowed(kind: &str) -> &'static [&'static str] {
    const EQ_ORD_NULL: &[&str] = &["eq", "ne", "in", "gt", "gte", "lt", "lte", "between", "is_null"];
    const TEXT: &[&str] = &["eq", "ne", "in", "eq_ci", "contains", "starts_with", "ends_with", "is_null"];
    const LIST: &[&str] = &["has_any", "has_all", "is_null"];
    const EQ_NULL: &[&str] = &["eq", "ne", "in", "is_null"];
    match kind {
        "short_text" | "url" | "email" => TEXT,
        "long_text" => &["contains", "is_null"],
        "number" | "date" | "datetime" | "formula" | "autonumber" | "rollup" | "count" => EQ_ORD_NULL,
        "boolean" => &["eq", "is_null"],
        "select" | "link" | "user" => EQ_NULL,
        "multi_select" | "multi_link" | "lookup" => LIST,
        "file" | "image" => &["is_null"],
        _ => &[],
    }
}

/// `CAST[kind]`.
pub fn cast(kind: &str) -> &'static str {
    match kind {
        "number" | "rollup" | "count" | "autonumber" => "numeric",
        "boolean" => "boolean",
        "date" => "date",
        "datetime" => "timestamptz",
        "link" | "multi_link" | "user" => "uuid",
        "file" | "image" => "jsonb",
        _ => "text",
    }
}

pub fn sortable_kind(kind: &str) -> bool {
    !matches!(kind, "long_text" | "multi_select" | "multi_link" | "lookup" | "file" | "image" | "button")
}

fn textual(kind: &str) -> bool {
    matches!(kind, "short_text" | "select" | "formula" | "url" | "email")
}

fn system_kind(name: &str) -> Option<&'static str> {
    match name {
        "_id" | "_created_by" | "_updated_by" => Some("link"),
        "_created_at" | "_updated_at" => Some("datetime"),
        _ => None,
    }
}

/// A column the filter may name.
#[derive(Clone, Debug, PartialEq)]
pub struct Column {
    pub name: String,
    pub kind: String,
    /// `v`: the lateral join of the fields computed at read time.
    pub alias: Option<String>,
    pub element_kind: Option<String>,
    pub stored: Option<bool>,
}

impl Column {
    pub fn new(name: &str, kind: &str) -> Column {
        Column { name: name.into(), kind: kind.into(), alias: None, element_kind: None, stored: None }
    }
}

pub type Columns = IndexMap<String, Column>;

/// A target reachable through a link path, resolved upstream.
#[derive(Clone, Debug)]
pub struct Target {
    pub relation: String,
    pub columns: Columns,
    pub display_column: Option<Column>,
    pub row_predicate: String,
    pub readable: bool,
}

pub struct Built {
    pub sql: String,
    pub params: Vec<Value>,
}

pub fn qi(name: &str) -> Result<String, AppError> {
    quote_identifier(name).map_err(|e| AppError::new("IDENTIFIER_INVALID").with("identifier", json!(e.0)))
}

fn malformed(detail: impl Into<String>) -> AppError {
    AppError::new("REQUEST_INVALID").with("parameter", json!("filter")).with("detail", json!(detail.into()))
}

fn too_complex(bound: &str, maximum: usize) -> AppError {
    AppError::new("FILTER_TOO_COMPLEX").with("bound", json!(bound)).with("maximum", json!(maximum))
}

// ── Lexical analysis ────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq)]
enum Token {
    Word(String),
    Str(String),
    Num(f64),
    Sym(char),
}

static DATE_TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:T[0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]+)?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?").unwrap()
});
static WORD_TOKEN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[_a-zA-Z][_a-zA-Z0-9.:+-]*").unwrap());

fn word_char(b: Option<&u8>) -> bool {
    b.is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'_' || *b == b'-')
}

/// `/^-?\d+(?:\.\d+)?(?![\w-])/` with the regex's backtracking: the whole fraction, or none.
fn number_token(rest: &str) -> Option<&str> {
    let b = rest.as_bytes();
    let mut i = usize::from(b.first() == Some(&b'-'));
    let start = i;
    while b.get(i).is_some_and(u8::is_ascii_digit) {
        i += 1;
    }
    if i == start {
        return None;
    }
    let int_end = i;
    if b.get(i) == Some(&b'.') {
        let mut j = i + 1;
        while b.get(j).is_some_and(u8::is_ascii_digit) {
            j += 1;
        }
        if j > i + 1 && !word_char(b.get(j)) {
            return Some(&rest[..j]);
        }
    }
    (!word_char(b.get(int_end))).then(|| &rest[..int_end])
}

fn tokenize(input: &str) -> Result<Vec<Token>, AppError> {
    let mut tokens = Vec::new();
    let mut i = 0;
    while i < input.len() {
        let c = input[i..].chars().next().unwrap_or(' ');
        if js_space(c) {
            i += c.len_utf8();
            continue;
        }
        if "()[],".contains(c) {
            tokens.push(Token::Sym(c));
            i += 1;
            continue;
        }
        if c == '"' {
            let mut v = String::new();
            i += 1;
            let mut closed = false;
            while i < input.len() {
                let ch = input[i..].chars().next().unwrap_or(' ');
                if ch == '"' {
                    closed = true;
                    break;
                }
                if ch == '\\' {
                    let next = input[i + 1..].chars().next();
                    if next == Some('"') || next == Some('\\') {
                        v.push(next.unwrap_or('\\'));
                        i += 2;
                        continue;
                    }
                }
                v.push(ch);
                i += ch.len_utf8();
            }
            if !closed {
                return Err(malformed("unterminated string"));
            }
            i += 1;
            tokens.push(Token::Str(v));
            continue;
        }
        let rest = &input[i..];
        if c.is_ascii_digit() {
            if let Some(m) = DATE_TOKEN.find(rest) {
                tokens.push(Token::Word(m.as_str().into()));
                i += m.end();
                continue;
            }
        }
        if c.is_ascii_digit() || c == '-' {
            if let Some(n) = number_token(rest) {
                tokens.push(Token::Num(n.parse::<f64>().unwrap_or(f64::NAN)));
                i += n.len();
                continue;
            }
        }
        if let Some(m) = WORD_TOKEN.find(rest) {
            tokens.push(Token::Word(m.as_str().into()));
            i += m.end();
            continue;
        }
        return Err(malformed(format!("unexpected character \"{c}\"")));
    }
    Ok(tokens)
}

// ── Syntactic analysis ──────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq)]
enum Scalar {
    Str(String),
    Num(f64),
    Bool(bool),
}

impl Scalar {
    /// `String(value)`.
    fn js_string(&self) -> String {
        match self {
            Scalar::Str(s) => s.clone(),
            Scalar::Num(n) => number_string(*n),
            Scalar::Bool(b) => b.to_string(),
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
enum Val {
    None,
    One(Scalar),
    List(Vec<Scalar>),
}

#[derive(Debug)]
enum Node {
    Or(Box<Node>, Box<Node>),
    And(Box<Node>, Box<Node>),
    Not(Box<Node>),
    Pred { field: String, op: &'static str, value: Val },
}

struct Parser {
    tokens: Vec<Token>,
    position: usize,
    predicates: usize,
    depth: usize,
}

impl Parser {
    fn parse(mut self) -> Result<Node, AppError> {
        if self.tokens.is_empty() {
            return Err(malformed("empty filter"));
        }
        let tree = self.or()?;
        if self.position < self.tokens.len() {
            return Err(malformed("incomplete expression"));
        }
        Ok(tree)
    }
    fn or(&mut self) -> Result<Node, AppError> {
        let mut left = self.and()?;
        while self.keyword("or") {
            left = Node::Or(Box::new(left), Box::new(self.and()?));
        }
        Ok(left)
    }
    fn and(&mut self) -> Result<Node, AppError> {
        let mut left = self.unary()?;
        while self.keyword("and") {
            left = Node::And(Box::new(left), Box::new(self.unary()?));
        }
        Ok(left)
    }
    fn unary(&mut self) -> Result<Node, AppError> {
        if self.keyword("not") {
            return Ok(Node::Not(Box::new(self.unary()?)));
        }
        self.primary()
    }
    fn primary(&mut self) -> Result<Node, AppError> {
        if self.symbol('(') {
            self.depth += 1;
            if self.depth > DEPTH {
                return Err(too_complex("parenthesis depth", DEPTH));
            }
            let inner = self.or()?;
            if !self.symbol(')') {
                return Err(malformed("missing closing parenthesis"));
            }
            self.depth -= 1;
            return Ok(inner);
        }
        self.predicate()
    }
    fn predicate(&mut self) -> Result<Node, AppError> {
        self.predicates += 1;
        if self.predicates > PREDICATES {
            return Err(too_complex("number of predicates", PREDICATES));
        }
        let Some(Token::Word(field)) = self.tokens.get(self.position).cloned() else {
            return Err(malformed("field name expected"));
        };
        self.position += 1;
        let Some(Token::Word(op)) = self.tokens.get(self.position).cloned() else {
            return Err(malformed(format!("operator expected after \"{field}\"")));
        };
        self.position += 1;
        let lower = op.to_lowercase();
        let Some(operator) = OPERATORS.iter().find(|o| **o == lower) else {
            return Err(AppError::new("FILTER_OPERATOR_INVALID").with("operator", json!(op)));
        };
        let value = if *operator == "is_null" { Val::None } else { self.value()? };
        Ok(Node::Pred { field, op: operator, value })
    }
    fn value(&mut self) -> Result<Val, AppError> {
        let Some(token) = self.tokens.get(self.position).cloned() else {
            return Err(malformed("value expected"));
        };
        if token == Token::Sym('[') {
            self.position += 1;
            let mut list = Vec::new();
            while !self.symbol(']') {
                let Some(element) = self.tokens.get(self.position).cloned() else {
                    return Err(malformed("missing closing bracket"));
                };
                list.push(scalar(&element)?);
                self.position += 1;
                if list.len() > IN_ELEMENTS {
                    return Err(too_complex("elements in a list", IN_ELEMENTS));
                }
                self.symbol(',');
            }
            return Ok(Val::List(list));
        }
        self.position += 1;
        Ok(Val::One(scalar(&token)?))
    }
    fn keyword(&mut self, word: &str) -> bool {
        if let Some(Token::Word(w)) = self.tokens.get(self.position) {
            if w.to_lowercase() == word {
                self.position += 1;
                return true;
            }
        }
        false
    }
    fn symbol(&mut self, s: char) -> bool {
        if self.tokens.get(self.position) == Some(&Token::Sym(s)) {
            self.position += 1;
            return true;
        }
        false
    }
}

fn scalar(token: &Token) -> Result<Scalar, AppError> {
    match token {
        Token::Str(s) => Ok(Scalar::Str(s.clone())),
        Token::Num(n) => Ok(Scalar::Num(*n)),
        Token::Word(w) if w == "true" || w == "false" => Ok(Scalar::Bool(w == "true")),
        Token::Word(w) => Ok(Scalar::Str(w.clone())),
        Token::Sym(_) => Err(malformed("invalid value")),
    }
}

// ── Value coercion ──────────────────────────────────────────────────────────

static DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$").unwrap());
static ISO_INSTANT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^([+-][0-9]{6}|[0-9]{4})(?:-([0-9]{2})(?:-([0-9]{2}))?)?(?:[T ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]+)?)?)?\s*(Z|[+-][0-9]{2}:?[0-9]{2})?$").unwrap()
});

/// `!Number.isNaN(Date.parse(value))`, for the ISO forms (and their space-separated
/// variant) V8 reads; its legacy free-form dates are not recognised.
pub fn date_parses(value: &str) -> bool {
    let Some(c) = ISO_INSTANT.captures(value) else { return false };
    let num = |i: usize| c.get(i).map(|m| m.as_str().parse::<u32>().unwrap_or(99));
    let month_ok = num(2).is_none_or(|m| (1..=12).contains(&m));
    let day_ok = num(3).is_none_or(|d| (1..=31).contains(&d));
    let hour_ok = num(4).is_none_or(|h| h <= 24);
    let minute_ok = num(5).is_none_or(|m| m <= 59);
    let second_ok = num(6).is_none_or(|s| s <= 59);
    // A bare time zone needs a time: `2024-01-01Z` is not a date V8 reads.
    let zone_ok = c.get(7).is_none() || c.get(4).is_some();
    month_ok && day_ok && hour_ok && minute_ok && second_ok && zone_ok
}

fn coerce(value: &Scalar, kind: &str, field: &str) -> Result<Value, AppError> {
    let invalid = || AppError::new("FILTER_VALUE_INVALID").with("field", json!(field)).with("value", json!(value.js_string()));
    match kind {
        "number" => {
            let n = match value {
                Scalar::Num(n) => *n,
                Scalar::Str(s) => basedb_catalog::js::js_to_number(s),
                Scalar::Bool(_) => return Err(invalid()),
            };
            if !n.is_finite() {
                return Err(invalid());
            }
            Ok(serde_json::Number::from_f64(n).map(Value::Number).unwrap_or(Value::Null))
        }
        "boolean" => match value {
            Scalar::Bool(b) => Ok(Value::Bool(*b)),
            _ => Err(invalid()),
        },
        "link" => match value {
            Scalar::Str(s) if crate::js::is_uuid_ci(s) => Ok(Value::String(s.clone())),
            _ => Err(invalid()),
        },
        "date" => match value {
            Scalar::Str(s) if DATE.is_match(s) => Ok(Value::String(s.clone())),
            _ => Err(invalid()),
        },
        "datetime" => match value {
            Scalar::Str(s) if date_parses(s) => Ok(Value::String(s.clone())),
            _ => Err(invalid()),
        },
        _ => match value {
            Scalar::Bool(_) => Err(invalid()),
            other => Ok(Value::String(other.js_string())),
        },
    }
}

// ── SQL translation ─────────────────────────────────────────────────────────

pub fn resolve_column(name: &str, columns: &Columns) -> Option<Column> {
    if let Some(c) = columns.get(name) {
        return Some(c.clone());
    }
    system_kind(name).map(|k| Column::new(name, k))
}

struct Ctx<'a> {
    columns: &'a Columns,
    links: &'a HashMap<String, Target>,
    paths: usize,
    base: usize,
    params: Vec<Value>,
}

impl Ctx<'_> {
    fn bind(&mut self, v: Value) -> usize {
        self.params.push(v);
        self.base + self.params.len() - 1
    }
    fn next_alias(&mut self) -> Result<String, AppError> {
        self.paths += 1;
        if self.paths > LINK_PATHS {
            return Err(too_complex("distinct link paths", LINK_PATHS));
        }
        Ok(format!("l{}", self.paths))
    }
}

/// `buildFilter`.
pub fn build_filter(
    expression: &str,
    columns: &Columns,
    alias: Option<&str>,
    first_parameter: usize,
    links: &HashMap<String, Target>,
) -> Result<Built, AppError> {
    let bytes = expression.len();
    if bytes > BYTES {
        return Err(AppError::new("FILTER_TOO_LONG").with("bytes", json!(bytes)).with("maximum", json!(BYTES)));
    }
    let tree = Parser { tokens: tokenize(expression)?, position: 0, predicates: 0, depth: 0 }.parse()?;
    let prefix = match alias {
        Some(a) => format!("{}.", qi(a)?),
        None => String::new(),
    };
    let mut ctx = Ctx { columns, links, paths: 0, base: first_parameter, params: Vec::new() };
    let sql = emit(&tree, &mut ctx, &prefix)?;
    Ok(Built { sql, params: ctx.params })
}

fn emit(node: &Node, ctx: &mut Ctx, prefix: &str) -> Result<String, AppError> {
    Ok(match node {
        Node::Or(l, r) => {
            let l = emit(l, ctx, prefix)?;
            format!("({l} OR {})", emit(r, ctx, prefix)?)
        }
        Node::And(l, r) => {
            let l = emit(l, ctx, prefix)?;
            format!("({l} AND {})", emit(r, ctx, prefix)?)
        }
        Node::Not(inner) => format!("NOT ({})", emit(inner, ctx, prefix)?),
        Node::Pred { field, op, value } => {
            if field.contains('.') {
                return link_path(field, op, value, ctx, prefix);
            }
            let Some(column) = resolve_column(field, ctx.columns) else {
                return Err(AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(field)));
            };
            let col = format!("{}{}", column_prefix(&column, prefix)?, qi(&column.name)?);
            comparison(&col, &column, field, op, value, ctx)?
        }
    })
}

fn column_prefix(column: &Column, prefix: &str) -> Result<String, AppError> {
    Ok(match &column.alias {
        None => prefix.to_string(),
        Some(a) => format!("{}.", qi(a)?),
    })
}

fn link_path(field: &str, op: &str, value: &Val, ctx: &mut Ctx, prefix: &str) -> Result<String, AppError> {
    let parts: Vec<&str> = field.split('.').collect();
    let link_name = parts[0];
    let target_field = parts.get(1).copied();
    if parts.len() > 2 || target_field.is_none_or(str::is_empty) {
        return Err(AppError::new("EXPAND_TOO_DEEP").with("path", json!(field)));
    }
    let target_field = target_field.unwrap_or_default();
    let unknown = || AppError::new("FILTER_FIELD_UNKNOWN").with("field", json!(field));
    let link = match ctx.columns.get(link_name) {
        Some(l) if l.kind == "link" || l.kind == "multi_link" => l.clone(),
        _ => return Err(unknown()),
    };
    let target = match ctx.links.get(link_name) {
        Some(t) if t.readable => t.clone(),
        _ => return Err(unknown()),
    };
    let column = if target_field == "display" {
        match &target.display_column {
            None => return Err(AppError::new("FILTER_DISPLAY_UNAVAILABLE").with("path", json!(field))),
            Some(c) => c.clone(),
        }
    } else {
        resolve_column(target_field, &target.columns).ok_or_else(unknown)?
    };
    let alias = ctx.next_alias()?;
    let q = qi(&alias)?;
    let inner = comparison(&format!("{q}.{}", qi(&column.name)?), &column, field, op, value, ctx)?;
    let source = format!("{prefix}{}", qi(link_name)?);
    let reach = if link.kind == "multi_link" { format!("= ANY({source})") } else { format!("= {source}") };
    Ok(format!(
        "EXISTS (SELECT 1\n              FROM {} AS {q}\n             WHERE {q}.\"_id\" {reach}\n               AND ( /*predicat_lignes:{link_name}*/ {} )\n               AND {inner})",
        target.relation,
        row_where(&target.row_predicate, Some(&alias))
    ))
}

fn comparison(col: &str, column: &Column, field: &str, op: &str, value: &Val, ctx: &mut Ctx) -> Result<String, AppError> {
    if !allowed(&column.kind).contains(&op) {
        return Err(AppError::new("FILTER_OPERATOR_INVALID").with("field", json!(field)).with("operator", json!(op)).with("type", json!(column.kind)));
    }
    let value_kind = column.element_kind.clone().unwrap_or_else(|| column.kind.clone());
    let cast = cast(&value_kind);
    let scalar = |ctx: &mut Ctx, v: &Val| -> Result<String, AppError> {
        match v {
            Val::List(_) => Err(malformed(format!("\"{op}\" does not take a list"))),
            Val::One(s) => Ok(format!("${}::{cast}", ctx.bind(coerce(s, &value_kind, field)?))),
            Val::None => Err(AppError::internal("value missing")),
        }
    };
    Ok(match op {
        "is_null" => format!("{col} IS NULL"),
        "eq" => format!("{col} = {}", scalar(ctx, value)?),
        "ne" => format!("{col} <> {}", scalar(ctx, value)?),
        "gt" => format!("{col} > {}", scalar(ctx, value)?),
        "gte" => format!("{col} >= {}", scalar(ctx, value)?),
        "lt" => format!("{col} < {}", scalar(ctx, value)?),
        "lte" => format!("{col} <= {}", scalar(ctx, value)?),
        "in" => {
            let Val::List(items) = value else { return Err(malformed("\"in\" takes a list")) };
            let list = items.iter().map(|v| coerce(v, &value_kind, field)).collect::<Result<Vec<_>, _>>()?;
            format!("{col} = ANY(${}::{cast}[])", ctx.bind(Value::Array(list)))
        }
        "has_any" | "has_all" => {
            let items = match value {
                Val::List(items) => items.clone(),
                Val::One(s) => vec![s.clone()],
                Val::None => vec![],
            };
            if items.is_empty() {
                return Err(malformed(format!("\"{op}\" takes at least one value")));
            }
            let list = items.iter().map(|v| coerce(v, &value_kind, field)).collect::<Result<Vec<_>, _>>()?;
            let sign = if op == "has_any" { "&&" } else { "@>" };
            format!("{col} {sign} ${}::{cast}[]", ctx.bind(Value::Array(list)))
        }
        "between" => {
            let Val::List(items) = value else { return Err(malformed("\"between\" takes a list of two bounds")) };
            if items.len() != 2 {
                return Err(malformed("\"between\" takes a list of two bounds"));
            }
            let low = coerce(&items[0], &value_kind, field)?;
            let high = coerce(&items[1], &value_kind, field)?;
            let a = ctx.bind(low);
            let b = ctx.bind(high);
            format!("{col} BETWEEN ${a}::{cast} AND ${b}::{cast}")
        }
        "eq_ci" => format!("_basedb_local.fold_v1({col}) = _basedb_local.fold_v1({})", scalar(ctx, value)?),
        "contains" => like(col, value, ctx, "'%' || ", " || '%'")?,
        "starts_with" => like(col, value, ctx, "", " || '%'")?,
        "ends_with" => like(col, value, ctx, "'%' || ", "")?,
        _ => return Err(AppError::internal("operator")),
    })
}

fn like(col: &str, value: &Val, ctx: &mut Ctx, before: &str, after: &str) -> Result<String, AppError> {
    let Val::One(v) = value else { return Err(malformed("this operator does not take a list")) };
    let mut escaped = String::new();
    for c in v.js_string().chars() {
        if matches!(c, '\\' | '%' | '_') {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    let n = ctx.bind(Value::String(escaped));
    Ok(format!("_basedb_local.fold_v1({col}) LIKE {before}_basedb_local.fold_v1(${n}::text){after} ESCAPE '\\'"))
}

// ── Sorting ─────────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct SortTerm {
    pub name: String,
    pub kind: String,
    pub descending: bool,
    pub expression: String,
}

pub struct BuiltSort {
    pub sql: String,
    pub columns: Vec<String>,
    pub terms: Vec<SortTerm>,
}

/// `buildSort`.
pub fn build_sort(expression: Option<&str>, columns: &Columns, alias: Option<&str>) -> Result<BuiltSort, AppError> {
    let prefix = match alias {
        Some(a) => format!("{}.", qi(a)?),
        None => String::new(),
    };
    let mut parts = Vec::new();
    let mut named: Vec<String> = Vec::new();
    let mut terms = Vec::new();
    for raw in expression.unwrap_or("").split(',') {
        let trimmed = crate::js::js_trim(raw);
        if trimmed.is_empty() {
            continue;
        }
        let descending = trimmed.starts_with('-');
        let name = if descending { &trimmed[1..] } else { trimmed };
        let Some(column) = resolve_column(name, columns) else {
            return Err(AppError::new("SORT_FIELD_UNKNOWN").with("field", json!(name)));
        };
        if !sortable_kind(&column.kind) {
            return Err(AppError::new("SORT_UNAVAILABLE").with("field", json!(name)).with("type", json!(column.kind)));
        }
        if named.contains(&column.name) {
            return Err(malformed(format!("repeated sort field: \"{name}\"")));
        }
        let collate = if textual(&column.kind) { " COLLATE \"und-x-icu\"" } else { "" };
        let fragment = format!("{}{}{collate}", column_prefix(&column, &prefix)?, qi(&column.name)?);
        parts.push(format!("{fragment} {}", if descending { "DESC" } else { "ASC" }));
        named.push(column.name.clone());
        terms.push(SortTerm { name: column.name.clone(), kind: column.kind.clone(), descending, expression: fragment });
    }
    parts.push(format!("{prefix}\"_id\" ASC"));
    Ok(BuiltSort { sql: parts.join(", "), columns: named, terms })
}

// ── Row rules ───────────────────────────────────────────────────────────────

const RULE_KINDS: [&str; 14] = [
    "short_text", "long_text", "number", "boolean", "date", "datetime", "select", "multi_select", "url", "email", "user", "link", "multi_link", "autonumber",
];

/// `ruleColumns(ruleFieldsOf(fields))`.
fn rule_columns(fields: &[(String, String)]) -> Columns {
    let mut columns = Columns::new();
    for (name, kind) in [("_id", "link"), ("_created_at", "datetime"), ("_updated_at", "datetime"), ("_created_by", "link"), ("_updated_by", "link")] {
        if !fields.iter().any(|(n, _)| n == name) {
            columns.insert(name.into(), Column::new(name, kind));
        }
    }
    for (name, kind) in fields {
        let stored = !matches!(kind.as_str(), "lookup" | "rollup" | "count" | "button");
        if stored && RULE_KINDS.contains(&kind.as_str()) {
            columns.insert(name.clone(), Column::new(name, kind));
        }
    }
    columns
}

fn literal_of(v: &Value) -> Result<String, AppError> {
    Ok(match v {
        Value::Null => "NULL".into(),
        Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.into(),
        Value::Number(n) => {
            let f = n.as_f64().unwrap_or(f64::NAN);
            if !f.is_finite() {
                return Err(AppError::new("FILTER_VALUE_INVALID").with("value", json!(number_string(f))));
            }
            number_string(f)
        }
        Value::Array(items) => format!("ARRAY[{}]", items.iter().map(literal_of).collect::<Result<Vec<_>, _>>()?.join(", ")),
        Value::String(s) => basedb_contracts::naming::quote_literal(s),
        other => basedb_contracts::naming::quote_literal(&other.to_string()),
    })
}

/// `compileRowRule(filter, ruleFieldsOf(fields))`: the template of a rule, values as
/// literals, columns on `"basedb_row"`. Registered as the socle's row-rule compiler.
pub fn compile_row_rule(filter: &str, fields: &[(String, String)]) -> Result<String, AppError> {
    let trimmed = crate::js::js_trim(filter);
    if trimmed.is_empty() {
        return Err(AppError::new("REQUEST_INVALID").with("parameter", json!("filter")).with("detail", json!("empty")));
    }
    let built = build_filter(
        &basedb_base::rbac::rows::with_sentinel(trimmed),
        &rule_columns(fields),
        Some(basedb_base::rbac::rows::ROW_ALIAS),
        1,
        &HashMap::new(),
    )?;
    let mut sql = built.sql;
    for n in (1..=built.params.len()).rev() {
        sql = sql.replace(&format!("${n}"), &literal_of(&built.params[n - 1])?);
    }
    Ok(sql)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cols() -> Columns {
        let mut c = Columns::new();
        for (n, k) in [("nom", "short_text"), ("budget", "number"), ("tags", "multi_select"), ("debut", "date"), ("client", "link"), ("notes", "long_text")] {
            c.insert(n.into(), Column::new(n, k));
        }
        c
    }

    fn build(f: &str) -> Result<Built, AppError> {
        build_filter(f, &cols(), Some("t"), 1, &HashMap::new())
    }

    #[test]
    fn predicates_bind_and_cast() {
        let b = build("nom eq \"a\\\"b\" and (budget gte 10.5 or not debut is_null)").unwrap();
        assert_eq!(b.sql, r#"("t"."nom" = $1::text AND ("t"."budget" >= $2::numeric OR NOT ("t"."debut" IS NULL)))"#);
        assert_eq!(b.params, vec![json!("a\"b"), json!(10.5)]);
        let b = build("tags has_any \"x\" and budget in [1, \"2\"] and nom contains \"10%_\"").unwrap();
        assert!(b.sql.contains(r#""t"."tags" && $1::text[]"#));
        assert!(b.sql.contains(r#""t"."budget" = ANY($2::numeric[])"#));
        assert_eq!(b.params[2], json!("10\\%\\_"));
        let b = build("debut between [2024-01-01, 2024-12-31]").unwrap();
        assert_eq!(b.sql, r#""t"."debut" BETWEEN $1::date AND $2::date"#);
        let b = build("_updated_at gte 2026-01-01T10:00:00Z").unwrap();
        assert_eq!(b.params, vec![json!("2026-01-01T10:00:00Z")]);
    }

    #[test]
    fn refusals_are_nodes() {
        let code = |f: &str| build(f).err().map(|e| (e.code, serde_json::to_value(&e.details).unwrap()));
        assert_eq!(code("").unwrap().1["detail"], "empty filter");
        assert_eq!(code("nom eq \"x").unwrap().1["detail"], "unterminated string");
        assert_eq!(code("nom eq 1.5.3").unwrap().1["detail"], "unexpected character \".\"");
        assert_eq!(code("nom like 1").unwrap().0, "FILTER_OPERATOR_INVALID");
        assert_eq!(code("notes eq \"a\"").unwrap().1["type"], "long_text");
        assert_eq!(code("salaire eq 1").unwrap().0, "FILTER_FIELD_UNKNOWN");
        assert_eq!(code("budget eq abc").unwrap().0, "FILTER_VALUE_INVALID");
        assert_eq!(code("budget eq true").unwrap().1["value"], "true");
        assert_eq!(code("client.nom eq 1").unwrap().0, "FILTER_FIELD_UNKNOWN");
        assert_eq!(code("client.a.b eq 1").unwrap().0, "EXPAND_TOO_DEEP");
        assert_eq!(code("nom in \"a\"").unwrap().1["detail"], "\"in\" takes a list");
        assert_eq!(code("nom eq").unwrap().1["detail"], "value expected");
        assert_eq!(code("nom eq [1").unwrap().1["detail"], "missing closing bracket");
        assert_eq!(code("((((((((( nom is_null )))))))))").unwrap().0, "FILTER_TOO_COMPLEX");
        assert_eq!(code("nom is_null nom").unwrap().1["detail"], "incomplete expression");
    }

    #[test]
    fn sorts_carry_collation_and_tiebreak() {
        let s = build_sort(Some("-nom, budget"), &cols(), Some("t")).unwrap();
        assert_eq!(s.sql, r#""t"."nom" COLLATE "und-x-icu" DESC, "t"."budget" ASC, "t"."_id" ASC"#);
        assert_eq!(build_sort(Some("tags"), &cols(), Some("t")).err().unwrap().code, "SORT_UNAVAILABLE");
        assert_eq!(build_sort(Some("nom,-nom"), &cols(), None).err().unwrap().code, "REQUEST_INVALID");
    }

    #[test]
    fn rules_compile_to_literals() {
        let fields = vec![("statut".to_string(), "select".to_string()), ("n".to_string(), "number".to_string())];
        let t = compile_row_rule(" statut in [\"a\", \"b'c\"] and _created_by eq @moi and n gt 2 ", &fields).unwrap();
        assert_eq!(
            t,
            r#"(("basedb_row"."statut" = ANY(ARRAY['a', 'b''c']::text[]) AND "basedb_row"."_created_by" = 'ffffffff-ffff-4fff-bfff-ffffffffffff'::uuid) AND "basedb_row"."n" > 2::numeric)"#
        );
    }

    #[test]
    fn instants_as_date_parse() {
        assert!(date_parses("2024-01-01"));
        assert!(date_parses("2024-01-01T10:00:00.123+02:00"));
        assert!(!date_parses("2024-13-01"));
        assert!(!date_parses("demain"));
    }
}
