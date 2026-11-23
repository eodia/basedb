//! The rules both sides of a form share — `contracts/src/forms.ts` and `quiz.ts` — and the
//! iCalendar feed of a shared calendar (`integrations/ical.ts`, `forms/shared-calendar.ts`).

use basedb_catalog::js::js_to_number;
use basedb_catalog::projection::ProjectedField;
use chrono::{DateTime, Duration, Local, NaiveDate, NaiveDateTime, TimeZone, Utc};
use serde_json::{Map, Value};
use std::collections::HashSet;
use unicode_normalization::UnicodeNormalization;

use crate::js::{js_space, js_trim};

pub const QUIZ_MAX_POINTS: i64 = 100;
const QUIZ_MAX_ACCEPTED: usize = 20;
const QUIZ_TEXT_KINDS: [&str; 3] = ["short_text", "email", "url"];
pub const QUIZ_REVEALS: [&str; 3] = ["each", "end", "never"];
pub const FORM_PREFILL_KINDS: [&str; 2] = ["date", "datetime"];

/// `isEmptyAnswer`: no value, an empty text, an empty choice. `false` is an answer.
pub fn is_empty_answer(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => true,
        Some(Value::String(s)) => js_trim(s).is_empty(),
        Some(Value::Array(a)) => a.is_empty(),
        Some(Value::Object(o)) => match o.get("id") {
            None => o.is_empty(),
            Some(id) => !id.is_string(),
        },
        Some(_) => false,
    }
}

/// `asNumber`: a number, or a text that reads as one (its first comma a decimal point).
pub fn as_number(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(n) => n.as_f64().filter(|f| f.is_finite()),
        Value::String(s) if !js_trim(s).is_empty() => {
            let n = js_to_number(&s.replacen(',', ".", 1));
            n.is_finite().then_some(n)
        }
        _ => None,
    }
}

fn number_of(v: &Value) -> Option<f64> {
    v.as_f64()
}

/// `String(answer)` of a boolean.
fn same(answer: Option<&Value>, value: &Value) -> bool {
    match value {
        Value::Bool(_) => answer == Some(value),
        Value::Number(n) => as_number(answer).is_some_and(|a| Some(a) == n.as_f64()),
        Value::Null => is_empty_answer(answer),
        Value::String(v) => match answer {
            Some(Value::String(a)) => js_trim(a).to_lowercase() == js_trim(v).to_lowercase(),
            Some(Value::Number(_)) => as_number(Some(value)) == answer.and_then(number_of),
            Some(Value::Bool(b)) => b.to_string() == *v,
            _ => false,
        },
        _ => false,
    }
}

/// `FormCondition`: `{ field, op, value }`, as `conditionOf` reads it from a spec.
#[derive(Debug, Clone, PartialEq)]
pub struct Condition {
    pub field: String,
    pub op: String,
    pub value: Value,
}

impl Condition {
    /// `conditionOf`: what the spec keeps — the kernel validated it when the view was saved.
    pub fn of(raw: Option<&Value>) -> Option<Condition> {
        let o = raw?.as_object()?;
        let field = o.get("field")?.as_str()?.to_string();
        let op = o.get("op")?.as_str()?.to_string();
        let value = match o.get("value") {
            Some(v @ (Value::String(_) | Value::Number(_) | Value::Bool(_))) => v.clone(),
            _ => Value::Null,
        };
        Some(Condition { field, op, value })
    }

    pub fn to_json(&self) -> Value {
        serde_json::json!({ "field": self.field, "op": self.op, "value": self.value })
    }

    /// `conditionHolds`. An unknown operator holds nothing (`undefined`).
    pub fn holds(&self, answer: Option<&Value>) -> bool {
        match self.op.as_str() {
            "answered" => !is_empty_answer(answer),
            "empty" => is_empty_answer(answer),
            "is" => match answer {
                Some(Value::Array(a)) => a.len() == 1 && same(a.first(), &self.value),
                _ => same(answer, &self.value),
            },
            "is_not" => !Condition { op: "is".into(), ..self.clone() }.holds(answer),
            "includes" => match answer {
                Some(Value::Array(a)) => a.iter().any(|x| same(Some(x), &self.value)),
                _ => same(answer, &self.value),
            },
            "excludes" => !Condition { op: "includes".into(), ..self.clone() }.holds(answer),
            "gte" | "lte" => match (as_number(answer), as_number(Some(&self.value))) {
                (Some(n), Some(bound)) => {
                    if self.op == "gte" {
                        n >= bound
                    } else {
                        n <= bound
                    }
                }
                _ => false,
            },
            _ => false,
        }
    }
}

/// `visibleQuestions`: the fields shown, in order, for the answers given. A condition reading
/// a hidden question reads it unanswered.
pub fn visible_questions(questions: &[(String, Option<Condition>)], answers: &Map<String, Value>) -> Vec<String> {
    let mut shown: HashSet<String> = HashSet::new();
    let mut out = Vec::new();
    for (field, condition) in questions {
        let visible = match condition {
            None => true,
            Some(c) => c.holds(if shown.contains(&c.field) { answers.get(&c.field) } else { None }),
        };
        if visible {
            shown.insert(field.clone());
            out.push(field.clone());
        }
    }
    out
}

fn is_text(value: &Value, max: usize) -> bool {
    value.as_str().is_some_and(|s| !js_trim(s).is_empty() && s.chars().count() <= max)
}

/// `quizAnswerFits`: whether a right answer has the shape its kind expects.
pub fn quiz_answer_fits(kind: &str, correct: Option<&Value>) -> bool {
    let Some(correct) = correct else { return false };
    match kind {
        "select" => is_text(correct, 255),
        "multi_select" => correct.as_array().is_some_and(|a| {
            !a.is_empty() && a.iter().all(|v| is_text(v, 255)) && a.iter().filter_map(Value::as_str).collect::<HashSet<_>>().len() == a.len()
        }),
        "boolean" => correct.is_boolean(),
        "number" => correct.is_number(),
        "date" => correct.as_str().is_some_and(|s| {
            let b = s.as_bytes();
            b.len() == 10 && b.iter().enumerate().all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
        }),
        _ => {
            QUIZ_TEXT_KINDS.contains(&kind)
                && correct.as_array().is_some_and(|a| !a.is_empty() && a.len() <= QUIZ_MAX_ACCEPTED && a.iter().all(|v| is_text(v, 255)))
        }
    }
}

/// `\p{Diacritic}` as V8 reads it (Unicode 17, generated with Node).
const DIACRITIC: [(u32, u32); 220] = [
    (0x5E, 0x5E), (0x60, 0x60), (0xA8, 0xA8), (0xAF, 0xAF), (0xB4, 0xB4), (0xB7, 0xB8), (0x2B0, 0x34E), (0x350, 0x357), (0x35D, 0x362), (0x374, 0x375),
    (0x37A, 0x37A), (0x384, 0x385), (0x483, 0x487), (0x559, 0x559), (0x591, 0x5BD), (0x5BF, 0x5BF), (0x5C1, 0x5C2), (0x5C4, 0x5C5), (0x5C7, 0x5C7), (0x64B, 0x652),
    (0x657, 0x658), (0x6DF, 0x6E0), (0x6E5, 0x6E6), (0x6EA, 0x6EC), (0x730, 0x74A), (0x7A6, 0x7B0), (0x7EB, 0x7F5), (0x818, 0x819), (0x898, 0x89F), (0x8C9, 0x8D2),
    (0x8E3, 0x8FE), (0x93C, 0x93C), (0x94D, 0x94D), (0x951, 0x954), (0x971, 0x971), (0x9BC, 0x9BC), (0x9CD, 0x9CD), (0xA3C, 0xA3C), (0xA4D, 0xA4D), (0xABC, 0xABC),
    (0xACD, 0xACD), (0xAFD, 0xAFF), (0xB3C, 0xB3C), (0xB4D, 0xB4D), (0xB55, 0xB55), (0xBCD, 0xBCD), (0xC3C, 0xC3C), (0xC4D, 0xC4D), (0xCBC, 0xCBC), (0xCCD, 0xCCD),
    (0xD3B, 0xD3C), (0xD4D, 0xD4D), (0xDCA, 0xDCA), (0xE3A, 0xE3A), (0xE47, 0xE4C), (0xE4E, 0xE4E), (0xEBA, 0xEBA), (0xEC8, 0xECC), (0xF18, 0xF19), (0xF35, 0xF35),
    (0xF37, 0xF37), (0xF39, 0xF39), (0xF3E, 0xF3F), (0xF82, 0xF84), (0xF86, 0xF87), (0xFC6, 0xFC6), (0x1037, 0x1037), (0x1039, 0x103A), (0x1063, 0x1064), (0x1069, 0x106D),
    (0x1087, 0x108D), (0x108F, 0x108F), (0x109A, 0x109B), (0x135D, 0x135F), (0x1714, 0x1715), (0x1734, 0x1734), (0x17C9, 0x17D3), (0x17DD, 0x17DD), (0x1939, 0x193B), (0x1A60, 0x1A60),
    (0x1A75, 0x1A7C), (0x1A7F, 0x1A7F), (0x1AB0, 0x1ABE), (0x1AC1, 0x1ACB), (0x1ACF, 0x1ADD), (0x1AE0, 0x1AEB), (0x1B34, 0x1B34), (0x1B44, 0x1B44), (0x1B6B, 0x1B73), (0x1BAA, 0x1BAB),
    (0x1BE6, 0x1BE6), (0x1BF2, 0x1BF3), (0x1C36, 0x1C37), (0x1C78, 0x1C7D), (0x1CD0, 0x1CE8), (0x1CED, 0x1CED), (0x1CF4, 0x1CF4), (0x1CF7, 0x1CF9), (0x1D2C, 0x1D6A), (0x1D9B, 0x1DBE),
    (0x1DC4, 0x1DCF), (0x1DF5, 0x1DFF), (0x1FBD, 0x1FBD), (0x1FBF, 0x1FC1), (0x1FCD, 0x1FCF), (0x1FDD, 0x1FDF), (0x1FED, 0x1FEF), (0x1FFD, 0x1FFE), (0x2CEF, 0x2CF1), (0x2E2F, 0x2E2F),
    (0x302A, 0x302F), (0x3099, 0x309C), (0x30FC, 0x30FC), (0xA66F, 0xA66F), (0xA67C, 0xA67D), (0xA67F, 0xA67F), (0xA69C, 0xA69D), (0xA6F0, 0xA6F1), (0xA700, 0xA721), (0xA788, 0xA78A),
    (0xA7F1, 0xA7F1), (0xA7F8, 0xA7F9), (0xA806, 0xA806), (0xA82C, 0xA82C), (0xA8C4, 0xA8C4), (0xA8E0, 0xA8F1), (0xA92B, 0xA92E), (0xA953, 0xA953), (0xA9B3, 0xA9B3), (0xA9C0, 0xA9C0),
    (0xA9E5, 0xA9E5), (0xAA7B, 0xAA7D), (0xAABF, 0xAAC2), (0xAAF6, 0xAAF6), (0xAB5B, 0xAB5F), (0xAB69, 0xAB6B), (0xABEC, 0xABED), (0xFB1E, 0xFB1E), (0xFE20, 0xFE2F), (0xFF3E, 0xFF3E),
    (0xFF40, 0xFF40), (0xFF70, 0xFF70), (0xFF9E, 0xFF9F), (0xFFE3, 0xFFE3), (0x102E0, 0x102E0), (0x10780, 0x10785), (0x10787, 0x107B0), (0x107B2, 0x107BA), (0x10A38, 0x10A3A), (0x10A3F, 0x10A3F),
    (0x10AE5, 0x10AE6), (0x10D22, 0x10D27), (0x10D4E, 0x10D4E), (0x10D69, 0x10D6D), (0x10EFA, 0x10EFA), (0x10EFD, 0x10EFF), (0x10F46, 0x10F50), (0x10F82, 0x10F85), (0x11046, 0x11046), (0x11070, 0x11070),
    (0x110B9, 0x110BA), (0x11133, 0x11134), (0x11173, 0x11173), (0x111C0, 0x111C0), (0x111CA, 0x111CC), (0x11235, 0x11236), (0x112E9, 0x112EA), (0x1133B, 0x1133C), (0x1134D, 0x1134D), (0x11366, 0x1136C),
    (0x11370, 0x11374), (0x113CE, 0x113D0), (0x113D2, 0x113D3), (0x113E1, 0x113E2), (0x11442, 0x11442), (0x11446, 0x11446), (0x114C2, 0x114C3), (0x115BF, 0x115C0), (0x1163F, 0x1163F), (0x116B6, 0x116B7),
    (0x1172B, 0x1172B), (0x11839, 0x1183A), (0x1193D, 0x1193E), (0x11943, 0x11943), (0x119E0, 0x119E0), (0x11A34, 0x11A34), (0x11A47, 0x11A47), (0x11A99, 0x11A99), (0x11C3F, 0x11C3F), (0x11D42, 0x11D42),
    (0x11D44, 0x11D45), (0x11D97, 0x11D97), (0x11DD9, 0x11DD9), (0x11F41, 0x11F42), (0x11F5A, 0x11F5A), (0x13447, 0x13455), (0x1612F, 0x1612F), (0x16AF0, 0x16AF4), (0x16B30, 0x16B36), (0x16D6B, 0x16D6C),
    (0x16F8F, 0x16F9F), (0x16FF0, 0x16FF1), (0x1AFF0, 0x1AFF3), (0x1AFF5, 0x1AFFB), (0x1AFFD, 0x1AFFE), (0x1CF00, 0x1CF2D), (0x1CF30, 0x1CF46), (0x1D167, 0x1D169), (0x1D16D, 0x1D172), (0x1D17B, 0x1D182),
    (0x1D185, 0x1D18B), (0x1D1AA, 0x1D1AD), (0x1E030, 0x1E06D), (0x1E130, 0x1E136), (0x1E2AE, 0x1E2AE), (0x1E2EC, 0x1E2EF), (0x1E5EE, 0x1E5EF), (0x1E8D0, 0x1E8D6), (0x1E944, 0x1E946), (0x1E948, 0x1E94A),
];

fn is_diacritic(c: char) -> bool {
    let cp = c as u32;
    DIACRITIC.binary_search_by(|&(a, b)| if b < cp { std::cmp::Ordering::Less } else if a > cp { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal }).is_ok()
}

/// `looseText`: without case, without accents, its spaces tidied.
pub fn loose_text(text: &str) -> String {
    let lowered = text.nfd().filter(|c| !is_diacritic(*c)).collect::<String>().to_lowercase();
    let mut out = String::with_capacity(lowered.len());
    let mut space = false;
    for c in lowered.chars() {
        if js_space(c) {
            if !space {
                out.push(' ');
            }
            space = true;
        } else {
            out.push(c);
            space = false;
        }
    }
    js_trim(&out).to_string()
}

/// `isRightAnswer`. Nothing answered is never right.
pub fn is_right_answer(kind: &str, correct: &Value, answer: Option<&Value>) -> bool {
    if is_empty_answer(answer) {
        return false;
    }
    let Some(answer) = answer else { return false };
    match kind {
        "select" => answer.is_string() && answer == correct,
        "multi_select" => match (answer.as_array(), correct.as_array()) {
            (Some(given), Some(correct)) => {
                let given: HashSet<&str> = given.iter().filter_map(Value::as_str).collect();
                given.len() == correct.len() && correct.iter().all(|v| v.as_str().is_some_and(|s| given.contains(s)))
            }
            _ => false,
        },
        "boolean" => answer == correct,
        "number" => match (correct.as_f64(), as_number(Some(answer))) {
            (Some(c), Some(n)) if correct.is_number() => (n - c).abs() < 1e-9,
            _ => false,
        },
        "date" => answer.as_str().is_some_and(|a| Some(a.chars().take(10).collect::<String>().as_str()) == correct.as_str()),
        _ => match (answer.as_str(), correct.as_array()) {
            (Some(a), Some(accepted)) => {
                let a = loose_text(a);
                accepted.iter().any(|x| x.as_str().is_some_and(|x| loose_text(x) == a))
            }
            _ => false,
        },
    }
}

/// `QuizQuestion`: `correct` null, it asks without grading.
#[derive(Debug, Clone)]
pub struct QuizQuestion {
    pub field: String,
    pub kind: String,
    pub correct: Option<Value>,
    pub points: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuizMark {
    pub field: String,
    pub right: bool,
    pub points: i64,
    pub of: i64,
}

/// `scoreQuiz`: the answers to the questions SHOWN.
pub fn score_quiz(questions: &[QuizQuestion], answers: &Map<String, Value>, shown: &HashSet<String>) -> (i64, i64, Vec<QuizMark>) {
    let mut marks = Vec::new();
    for q in questions {
        let Some(correct) = &q.correct else { continue };
        if !shown.contains(&q.field) {
            continue;
        }
        let right = is_right_answer(&q.kind, correct, answers.get(&q.field));
        marks.push(QuizMark { field: q.field.clone(), right, points: if right { q.points } else { 0 }, of: q.points });
    }
    (marks.iter().map(|m| m.points).sum(), marks.iter().map(|m| m.of).sum(), marks)
}

/// `quizPassed`: `None` when the quiz sets no pass mark.
pub fn quiz_passed(score: i64, max: i64, pass_percent: Option<i64>) -> Option<bool> {
    pass_percent.map(|p| max > 0 && (score as f64 * 100.0) / max as f64 >= p as f64)
}

// ── iCalendar ────────────────────────────────────────────────────────────────

pub const CALENDAR_MAX_EVENTS: usize = 1000;

#[derive(Debug, Clone, PartialEq)]
pub enum Moment {
    Date(String),
    Instant(DateTime<Utc>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct CalendarEvent {
    pub uid: String,
    pub summary: String,
    pub description: String,
    pub start: Moment,
    pub end: Option<Moment>,
}

fn escape_text(value: &str) -> String {
    value.replace('\\', "\\\\").replace(';', "\\;").replace(',', "\\,").replace("\r\n", "\\n").replace('\n', "\\n")
}

/// A content line folded at 75 octets.
fn fold(line: &str) -> String {
    if line.len() <= 75 {
        return line.to_string();
    }
    let mut parts: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut size = 0;
    for c in line.chars() {
        let width = c.len_utf8();
        if size + width > if parts.is_empty() { 75 } else { 74 } {
            parts.push(std::mem::take(&mut current));
            size = 0;
        }
        current.push(c);
        size += width;
    }
    parts.push(current);
    parts.join("\r\n ")
}

fn compact_instant(at: &DateTime<Utc>) -> String {
    at.format("%Y%m%dT%H%M%SZ").to_string()
}

fn next_day(date: &str) -> String {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").map(|d| (d + Duration::days(1)).format("%Y-%m-%d").to_string()).unwrap_or_default()
}

fn moment_line(name: &str, moment: &Moment) -> String {
    match moment {
        Moment::Date(d) => format!("{name};VALUE=DATE:{}", d.replace('-', "")),
        Moment::Instant(at) => format!("{name}:{}", compact_instant(at)),
    }
}

/// `icsCalendar`.
pub fn ics_calendar(name: &str, events: &[CalendarEvent], now: DateTime<Utc>) -> String {
    let stamp = compact_instant(&now);
    let mut lines = vec![
        "BEGIN:VCALENDAR".to_string(),
        "VERSION:2.0".into(),
        "PRODID:-//basedb//vue partagee//FR".into(),
        "CALSCALE:GREGORIAN".into(),
        "METHOD:PUBLISH".into(),
        format!("X-WR-CALNAME:{}", escape_text(name)),
    ];
    for e in events {
        lines.push("BEGIN:VEVENT".into());
        lines.push(format!("UID:{}", escape_text(&e.uid)));
        lines.push(format!("DTSTAMP:{stamp}"));
        lines.push(moment_line("DTSTART", &e.start));
        if let Moment::Date(start) = &e.start {
            let last = match &e.end {
                Some(Moment::Date(d)) => d.as_str(),
                _ => start.as_str(),
            };
            let last = if last < start.as_str() { start.as_str() } else { last };
            lines.push(format!("DTEND;VALUE=DATE:{}", next_day(last).replace('-', "")));
        } else if let Some(end) = &e.end {
            lines.push(moment_line("DTEND", end));
        }
        lines.push(format!("SUMMARY:{}", escape_text(&e.summary)));
        if !e.description.is_empty() {
            lines.push(format!("DESCRIPTION:{}", escape_text(&e.description)));
        }
        lines.push("END:VEVENT".into());
    }
    lines.push("END:VCALENDAR".into());
    format!("{}\r\n", lines.iter().map(|l| fold(l)).collect::<Vec<_>>().join("\r\n"))
}

/// `new Date(value)` for what a list hands out: an ISO instant, a day (UTC midnight), a local
/// date-time without zone.
fn instant_of(value: &str) -> Option<DateTime<Utc>> {
    if let Ok(at) = DateTime::parse_from_rfc3339(value) {
        return Some(at.with_timezone(&Utc));
    }
    if let Ok(d) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        return Some(Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0)?));
    }
    for f in ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%dT%H:%M"] {
        if let Ok(at) = NaiveDateTime::parse_from_str(value, f) {
            return Local.from_local_datetime(&at).earliest().map(|l| l.with_timezone(&Utc));
        }
    }
    None
}

/// What Node's list hands the agenda as a `Date` (a `timestamptz` column, read by `pg`), and
/// what this list hands out as its JSON: `2026-05-01T10:00:00.000Z`. Days stay text (`OID_DATE`).
fn was_date_object(value: &str, field: &ProjectedField) -> bool {
    const TEXTUAL: [&str; 7] = ["short_text", "long_text", "email", "url", "phone", "select", "multi_select"];
    if TEXTUAL.contains(&field.kind.as_str()) {
        return false;
    }
    let rest = match value.as_bytes().first() {
        Some(b'+' | b'-') if value.len() == 27 => &value[3..],
        _ if value.len() == 24 => value,
        _ => return false,
    };
    rest.bytes().enumerate().all(|(i, c)| match i {
        4 | 7 => c == b'-',
        10 => c == b'T',
        13 | 16 => c == b':',
        19 => c == b'.',
        23 => c == b'Z',
        _ => c.is_ascii_digit(),
    })
}

/// `momentOf`: a `Date` is not a string ? a date-time pivot never places an event in Node.
fn moment_of(value: Option<&Value>, field: Option<&ProjectedField>) -> Option<Moment> {
    let value = value?.as_str().filter(|s| !s.is_empty())?;
    let field = field?;
    if field.kind == "date" {
        return Some(Moment::Date(value.chars().take(10).collect()));
    }
    if was_date_object(value, field) {
        return None;
    }
    instant_of(value).map(Moment::Instant)
}

/// `textOf`: a value as an agenda's description reads it.
fn text_of(value: Option<&Value>, field: &ProjectedField) -> String {
    match value {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) if s.is_empty() => String::new(),
        Some(Value::Array(items)) => items.iter().map(|v| text_of(Some(v), field)).filter(|t| !t.is_empty()).collect::<Vec<_>>().join(", "),
        Some(Value::Object(o)) => match o.get("display").filter(|v| !v.is_null()).or_else(|| o.get("name").filter(|v| !v.is_null())) {
            Some(v) => crate::drain::js_string(v),
            None => String::new(),
        },
        Some(Value::Bool(b)) => (if *b { "Oui" } else { "Non" }).into(),
        Some(Value::String(s)) if was_date_object(s, field) => String::new(),
        Some(v) => {
            if let Some(s) = v.as_str() {
                if let Some(o) = field.options.as_ref().and_then(|o| o.iter().find(|o| o.value == s)) {
                    return o.label.clone();
                }
            }
            crate::drain::js_string(v)
        }
    }
}

/// `calendarEvents`: each row an event, on the view's pivots.
pub fn calendar_events(kind: &str, spec: &Map<String, Value>, fields: &[ProjectedField], rows: &[Map<String, Value>], host: &str) -> Vec<CalendarEvent> {
    let by_name = |name: &str| fields.iter().find(|f| f.name == name);
    let pick = |key: &str| spec.get(key).and_then(Value::as_str).and_then(by_name);
    let start = pick(if kind == "timeline" { "start_field" } else { "date_field" });
    let end = pick("end_field");
    let is = |a: Option<&ProjectedField>, b: &ProjectedField| a.is_some_and(|a| a.name == b.name);
    let title = pick("title_field")
        .or_else(|| fields.iter().find(|f| ["short_text", "long_text", "email", "url"].contains(&f.kind.as_str())))
        .or_else(|| fields.iter().find(|f| !is(start, f) && !is(end, f)));
    let shown: Vec<&ProjectedField> = match spec.get("card_fields") {
        Some(Value::Array(names)) => names.iter().filter_map(|n| by_name(&crate::drain::js_string(n))).collect(),
        _ => Vec::new(),
    };
    let mut events = Vec::new();
    for row in rows {
        let Some(from) = moment_of(row.get(start.map(|f| f.name.as_str()).unwrap_or("")), start) else { continue };
        let summary = match title {
            None => "Sans titre".to_string(),
            Some(t) => Some(text_of(row.get(&t.name), t)).filter(|s| !s.is_empty()).unwrap_or_else(|| "Sans titre".into()),
        };
        let description = shown
            .iter()
            .filter_map(|f| {
                let text = text_of(row.get(&f.name), f);
                (!text.is_empty()).then(|| format!("{} : {text}", f.label))
            })
            .collect::<Vec<_>>()
            .join("\n");
        let id = row.get("_id").map(crate::drain::js_string).unwrap_or_else(|| "undefined".into());
        events.push(CalendarEvent {
            uid: format!("{id}@{host}"),
            summary,
            description,
            start: from,
            end: moment_of(row.get(end.map(|f| f.name.as_str()).unwrap_or("")), end),
        });
        if events.len() >= CALENDAR_MAX_EVENTS {
            break;
        }
    }
    events
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn map(v: Value) -> Map<String, Value> {
        v.as_object().unwrap().clone()
    }

    #[test]
    fn empty_answers_as_the_contract_reads_them() {
        assert!(is_empty_answer(None));
        assert!(is_empty_answer(Some(&json!("  "))));
        assert!(is_empty_answer(Some(&json!({}))));
        assert!(is_empty_answer(Some(&json!({ "id": 3 }))));
        assert!(!is_empty_answer(Some(&json!(false))));
        assert!(!is_empty_answer(Some(&json!({ "id": "x" }))));
        assert!(!is_empty_answer(Some(&json!({ "a": 1 }))));
    }

    #[test]
    fn conditions_compare_as_a_person_would() {
        let c = |op: &str, value: Value| Condition { field: "a".into(), op: op.into(), value };
        assert!(c("is", json!("Oui")).holds(Some(&json!(" oui "))));
        assert!(c("is", json!(3)).holds(Some(&json!("3,0"))));
        assert!(c("is", json!("true")).holds(Some(&json!(true))));
        assert!(c("is", json!("2")).holds(Some(&json!(2))));
        assert!(c("is", json!("x")).holds(Some(&json!(["X"]))));
        assert!(!c("is", json!("x")).holds(Some(&json!(["x", "y"]))));
        assert!(c("includes", json!("y")).holds(Some(&json!(["x", "y"]))));
        assert!(c("excludes", json!("z")).holds(Some(&json!(["x", "y"]))));
        assert!(c("gte", json!("4")).holds(Some(&json!(5))));
        assert!(!c("lte", json!(4)).holds(Some(&json!("abc"))));
        assert!(c("is", Value::Null).holds(None));
        assert!(!c("bogus", Value::Null).holds(None));
    }

    #[test]
    fn a_hidden_question_hides_what_depends_on_it() {
        let cond = |field: &str| Some(Condition { field: field.into(), op: "answered".into(), value: Value::Null });
        let qs = vec![("a".to_string(), None), ("b".to_string(), cond("a")), ("c".to_string(), cond("b"))];
        assert_eq!(visible_questions(&qs, &map(json!({ "b": "x" }))), vec!["a"]);
        assert_eq!(visible_questions(&qs, &map(json!({ "a": 1, "b": "x" }))), vec!["a", "b", "c"]);
    }

    #[test]
    fn loose_text_drops_case_accents_and_spaces() {
        assert_eq!(loose_text("  Éléphant\t  Rosé "), "elephant rose");
        assert_eq!(loose_text("Ça^va"), "cava");
    }

    #[test]
    fn quiz_answers_fit_and_grade() {
        assert!(quiz_answer_fits("date", Some(&json!("2024-02-30"))));
        assert!(!quiz_answer_fits("date", Some(&json!("2024-2-30"))));
        assert!(!quiz_answer_fits("multi_select", Some(&json!(["a", "a"]))));
        assert!(quiz_answer_fits("short_text", Some(&json!(["a"]))));
        assert!(!quiz_answer_fits("long_text", Some(&json!(["a"]))));
        assert!(is_right_answer("short_text", &json!(["Élan"]), Some(&json!(" elan "))));
        assert!(is_right_answer("multi_select", &json!(["a", "b"]), Some(&json!(["b", "a", "b"]))));
        assert!(is_right_answer("number", &json!(1.5), Some(&json!("1,5"))));
        assert!(is_right_answer("date", &json!("2024-01-02"), Some(&json!("2024-01-02T10:00"))));
        assert!(!is_right_answer("boolean", &json!(false), Some(&json!(null))));
        let qs = vec![
            QuizQuestion { field: "a".into(), kind: "boolean".into(), correct: Some(json!(true)), points: 2 },
            QuizQuestion { field: "b".into(), kind: "select".into(), correct: Some(json!("x")), points: 3 },
            QuizQuestion { field: "c".into(), kind: "select".into(), correct: None, points: 1 },
        ];
        let shown: HashSet<String> = ["a", "b", "c"].iter().map(|s| s.to_string()).collect();
        let (score, max, marks) = score_quiz(&qs, &map(json!({ "a": true, "b": "y" })), &shown);
        assert_eq!((score, max, marks.len()), (2, 5, 2));
        assert_eq!(quiz_passed(score, max, Some(40)), Some(true));
        assert_eq!(quiz_passed(score, max, Some(41)), Some(false));
        assert_eq!(quiz_passed(0, 0, None), None);
    }

    #[test]
    fn a_date_time_pivot_places_no_event_as_in_node() {
        let field = |name: &str, kind: &str| ProjectedField {
            name: name.into(),
            label: name.into(),
            description: None,
            kind: kind.into(),
            required: false,
            unique: false,
            read_only: false,
            system: false,
            unsafe_html: false,
            options: None,
            link: None,
            format: None,
            hidden_from_agents: false,
            ai: false,
            computed: None,
            button: None,
            default: None,
        };
        let fields = vec![field("nom", "short_text"), field("moment", "datetime"), field("jour", "date")];
        let row = |at: &str| serde_json::json!({ "_id": "r", "nom": "A", "moment": at, "jour": "2026-05-01" }).as_object().unwrap().clone();
        let spec = |pivot: &str| serde_json::json!({ "date_field": pivot, "card_fields": ["moment"] }).as_object().unwrap().clone();
        assert!(calendar_events("calendar", &spec("moment"), &fields, &[row("2026-05-01T10:00:00.000Z")], "h").is_empty());
        let events = calendar_events("calendar", &spec("jour"), &fields, &[row("2026-05-01T10:00:00.000Z")], "h");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].description, "");
        assert!(!was_date_object("2026-05-01T10:00:00.000Z", &fields[0]));
        assert!(was_date_object("+275760-09-13T00:00:00.000Z", &fields[1]));
        assert!(!was_date_object("2026-05-01 10:00:00+00", &fields[1]));
    }

    #[test]
    fn ics_escapes_folds_and_ends_whole_days_the_next_day() {
        let now = Utc.with_ymd_and_hms(2026, 1, 2, 3, 4, 5).unwrap();
        let long = "é".repeat(50);
        let events = vec![CalendarEvent {
            uid: "1@h".into(),
            summary: format!("a,b;c\\d\n{long}"),
            description: String::new(),
            start: Moment::Date("2024-02-28".into()),
            end: Some(Moment::Date("2024-02-27".into())),
        }];
        let ics = ics_calendar("Cal", &events, now);
        assert!(ics.contains("DTSTAMP:20260102T030405Z\r\n"));
        assert!(ics.contains("DTEND;VALUE=DATE:20240229\r\n"));
        assert!(ics.contains("SUMMARY:a\\,b\\;c\\\\d\\n"));
        for line in ics.split("\r\n") {
            assert!(line.len() <= 75, "{line}");
        }
        assert!(ics.ends_with("END:VCALENDAR\r\n"));
    }
}
