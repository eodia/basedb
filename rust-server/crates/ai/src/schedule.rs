//! `ai/schedule.ts`: when an AI field recomputes its rows — five cron fields read in a zone.

use basedb_base::error::AppError;
use chrono::{DateTime, Datelike, TimeZone, Timelike, Utc};
use chrono_tz::Tz;
use regex::Regex;
use serde_json::json;
use std::collections::BTreeSet;
use std::sync::OnceLock;

/// `MIN_INTERVAL_MINUTES`.
pub const MIN_INTERVAL_MINUTES: i64 = 15;
const MINUTE: i64 = 60_000;

/// `Cron`.
#[derive(Debug, Clone, PartialEq)]
pub struct Cron {
    pub minute: BTreeSet<i64>,
    pub hour: BTreeSet<i64>,
    pub day: BTreeSet<i64>,
    pub month: BTreeSet<i64>,
    pub weekday: BTreeSet<i64>,
    pub day_restricted: bool,
    pub weekday_restricted: bool,
}

fn invalid(reason: &str, detail: Option<String>) -> AppError {
    let e = AppError::new("REQUEST_INVALID").with("field", json!("refresh")).with("reason", json!(reason));
    match detail {
        Some(d) => e.with("detail", json!(d)),
        None => e,
    }
}

fn parse_field(text: &str, min: i64, max: i64, name: &str) -> Result<BTreeSet<i64>, AppError> {
    static PART: OnceLock<Regex> = OnceLock::new();
    let re = PART.get_or_init(|| Regex::new(r"^(\*|[0-9]+(?:-[0-9]+)?)(?:/([0-9]+))?$").unwrap());
    let mut values = BTreeSet::new();
    for part in text.split(',') {
        let Some(m) = re.captures(part) else { return Err(invalid("cron_invalide", Some(format!("{name} : « {part} »")))) };
        let range = m.get(1).map(|r| r.as_str()).unwrap_or("*");
        let step_text = m.get(2).map(|s| s.as_str());
        let num = |s: &str| s.parse::<f64>().unwrap_or(f64::INFINITY);
        let step = step_text.map(num).unwrap_or(1.0);
        if step < 1.0 {
            return Err(invalid("cron_invalide", Some(format!("{name} : pas nul"))));
        }
        let (mut from, mut to) = (min as f64, max as f64);
        if range != "*" {
            let mut bounds = range.split('-').map(num);
            let a = bounds.next().unwrap_or(0.0);
            from = a;
            to = match bounds.next() {
                Some(b) => b,
                None if step_text.is_none() => a,
                None => max as f64,
            };
        }
        if from < min as f64 || to > max as f64 || from > to {
            return Err(invalid("cron_invalide", Some(format!("{name} : hors de {min}–{max}"))));
        }
        let mut v = from;
        while v <= to {
            values.insert(v as i64);
            v += step;
        }
    }
    Ok(values)
}

/// `parseCron`.
pub fn parse_cron(expression: &str) -> Result<Cron, AppError> {
    let fields: Vec<&str> = crate::js::js_trim(expression).split(crate::js::is_js_space).filter(|s| !s.is_empty()).collect();
    let fields = if crate::js::js_trim(expression).is_empty() { vec![""] } else { fields };
    if fields.len() != 5 {
        return Err(invalid("cron_invalide", Some("cinq champs attendus".into())));
    }
    let mut weekdays = parse_field(fields[4], 0, 7, "jour de semaine")?;
    if weekdays.remove(&7) {
        weekdays.insert(0);
    }
    Ok(Cron {
        minute: parse_field(fields[0], 0, 59, "minute")?,
        hour: parse_field(fields[1], 0, 23, "heure")?,
        day: parse_field(fields[2], 1, 31, "jour")?,
        month: parse_field(fields[3], 1, 12, "mois")?,
        weekday: weekdays,
        day_restricted: fields[2] != "*",
        weekday_restricted: fields[4] != "*",
    })
}

/// `checkTimezone`: a zone the runtime knows, else `fuseau_inconnu`.
pub fn check_timezone(timezone: &str) -> Result<Tz, AppError> {
    Tz::from_str_insensitive(timezone).map_err(|_| invalid("fuseau_inconnu", Some(timezone.to_string())))
}

struct Parts {
    month: i64,
    day: i64,
    hour: i64,
    minute: i64,
    weekday: i64,
}

fn parts_of(instant: i64, tz: Tz) -> Parts {
    let at = tz.timestamp_millis_opt(instant).single().unwrap_or_else(|| tz.from_utc_datetime(&Utc::now().naive_utc()));
    Parts {
        month: at.month() as i64,
        day: at.day() as i64,
        hour: at.hour() as i64,
        minute: at.minute() as i64,
        weekday: at.weekday().num_days_from_sunday() as i64,
    }
}

/// `nextRun`: the first instant strictly after `after` the expression matches.
pub fn next_run(cron: &Cron, tz: Tz, after: DateTime<Utc>) -> Option<DateTime<Utc>> {
    let after_ms = after.timestamp_millis();
    let mut t = after_ms.div_euclid(MINUTE) * MINUTE + MINUTE;
    let limit = after_ms + 5 * 366 * 24 * 60 * MINUTE;
    while t < limit {
        let p = parts_of(t, tz);
        let day_ok = if cron.day_restricted && cron.weekday_restricted {
            cron.day.contains(&p.day) || cron.weekday.contains(&p.weekday)
        } else {
            cron.day.contains(&p.day) && cron.weekday.contains(&p.weekday)
        };
        if !cron.month.contains(&p.month) || !day_ok {
            t += ((23 - p.hour) * 60 + (60 - p.minute)) * MINUTE;
            continue;
        }
        if !cron.hour.contains(&p.hour) {
            t += (60 - p.minute) * MINUTE;
            continue;
        }
        if !cron.minute.contains(&p.minute) {
            t += MINUTE;
            continue;
        }
        return Utc.timestamp_millis_opt(t).single();
    }
    None
}

/// `nextRuns`.
pub fn next_runs(cron: &Cron, tz: Tz, from: DateTime<Utc>, count: usize) -> Vec<DateTime<Utc>> {
    let mut runs = vec![];
    let mut cursor = from;
    while runs.len() < count {
        let Some(next) = next_run(cron, tz, cursor) else { break };
        runs.push(next);
        cursor = next;
    }
    runs
}

/// `checkSchedule`: a valid expression, a known zone, a date that exists, 15 minutes apart.
pub fn check_schedule(expression: &str, timezone: &str, now: DateTime<Utc>) -> Result<(Cron, Tz), AppError> {
    let cron = parse_cron(expression)?;
    let tz = check_timezone(timezone)?;
    let runs = next_runs(&cron, tz, now, 6);
    if runs.is_empty() {
        return Err(invalid("cron_sans_date", None));
    }
    for pair in runs.windows(2) {
        if (pair[1] - pair[0]).num_milliseconds() < MIN_INTERVAL_MINUTES * MINUTE {
            return Err(invalid("frequence_trop_haute", Some(format!("{MIN_INTERVAL_MINUTES} min au minimum"))));
        }
    }
    Ok((cron, tz))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn reads_the_five_fields() {
        let c = parse_cron(" 0 8 * * 1-5 ").unwrap();
        assert_eq!(c.hour, BTreeSet::from([8]));
        assert_eq!(c.weekday, BTreeSet::from([1, 2, 3, 4, 5]));
        assert_eq!(parse_cron("0 0 * * 7").unwrap().weekday, BTreeSet::from([0]));
        assert_eq!(parse_cron("*/20 * * * *").unwrap().minute, BTreeSet::from([0, 20, 40]));
        assert_eq!(parse_cron("5/20 * * * *").unwrap().minute, BTreeSet::from([5, 25, 45]));
        let e = parse_cron("0 8 * *").unwrap_err();
        assert_eq!(e.details["detail"], json!("cinq champs attendus"));
        assert_eq!(parse_cron("x 8 * * *").unwrap_err().details["detail"], json!("minute : « x »"));
        assert_eq!(parse_cron("0 24 * * *").unwrap_err().details["detail"], json!("heure : hors de 0–23"));
        assert_eq!(parse_cron("0 0 * * 9").unwrap_err().details["detail"], json!("jour de semaine : hors de 0–7"));
        assert_eq!(parse_cron("*/0 0 * * *").unwrap_err().details["detail"], json!("minute : pas nul"));
    }

    #[test]
    fn next_runs_in_the_zone() {
        let (c, tz) = check_schedule("0 8 * * *", "Europe/Paris", at("2025-03-29T12:00:00Z")).unwrap();
        let runs: Vec<String> = next_runs(&c, tz, at("2025-03-29T12:00:00Z"), 2).iter().map(|d| basedb_base::time::iso(*d)).collect();
        assert_eq!(runs, ["2025-03-30T06:00:00.000Z", "2025-03-31T06:00:00.000Z"]);
        assert_eq!(check_schedule("* * * * *", "UTC", at("2025-01-01T00:00:00Z")).unwrap_err().details["reason"], json!("frequence_trop_haute"));
        assert_eq!(check_schedule("0 0 31 2 *", "UTC", at("2025-01-01T00:00:00Z")).unwrap_err().details["reason"], json!("cron_sans_date"));
        assert_eq!(check_schedule("0 0 * * *", "Mars/Olympus", at("2025-01-01T00:00:00Z")).unwrap_err().details["reason"], json!("fuseau_inconnu"));
    }
}
