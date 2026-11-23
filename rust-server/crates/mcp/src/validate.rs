//! Protocol-stage validation (`validate.ts`, chapter 09 §14.2): type, cardinality, size —
//! before any resolution, naming parameters only, never an object of the catalog.

use crate::errors::parameter_invalid;
use crate::shape::utf16_len;
use basedb_base::error::AppError;
use basedb_catalog::views::js_keys;
use basedb_records::{filter::OPERATORS, js::{is_uuid_ci, js_trim}};
use serde_json::{json, Map, Value};

pub const NAME: usize = 128;
const VALUES_KEYS: usize = 100;
const TEXT_BYTES: usize = 32 * 1024;
const PREDICATES: usize = 10;
const IN_VALUES: usize = 100;

/// `Checker`: faults collected in order, `done` refuses them all at once.
pub struct Checker<'a> {
    params: &'a Map<String, Value>,
    faults: Vec<String>,
}

impl<'a> Checker<'a> {
    pub fn new(params: &'a Map<String, Value>) -> Self {
        Checker { params, faults: Vec::new() }
    }

    /// Unknown keys are faults (`additionalProperties: false`).
    pub fn only(&mut self, allowed: &[&str]) -> &mut Self {
        for key in js_keys(self.params) {
            if !allowed.contains(&key.as_str()) {
                self.faults.push(key.clone());
            }
        }
        self
    }

    fn fault<T>(&mut self, path: impl Into<String>) -> Option<T> {
        self.faults.push(path.into());
        None
    }

    pub fn entry(&mut self, path: impl Into<String>, ok: bool) {
        if !ok {
            self.faults.push(path.into());
        }
    }

    pub fn name(&mut self, key: &str) -> Option<String> {
        self.name_opt(key, true)
    }

    pub fn name_opt(&mut self, key: &str, required: bool) -> Option<String> {
        match self.params.get(key) {
            None => {
                if required {
                    self.fault(key)
                } else {
                    None
                }
            }
            Some(Value::String(s)) if !js_trim(s).is_empty() && utf16_len(s) <= NAME => Some(s.clone()),
            Some(_) => self.fault(key),
        }
    }

    pub fn uuid(&mut self, key: &str) -> Option<String> {
        match self.params.get(key) {
            Some(Value::String(s)) if is_uuid_ci(s) => Some(s.clone()),
            _ => self.fault(key),
        }
    }

    pub fn string(&mut self, key: &str, max: usize, required: bool) -> Option<String> {
        match self.params.get(key) {
            None => {
                if required {
                    self.fault(key)
                } else {
                    None
                }
            }
            Some(Value::String(s)) if utf16_len(s) <= max && !(required && s.is_empty()) => Some(s.clone()),
            Some(_) => self.fault(key),
        }
    }

    pub fn integer(&mut self, key: &str, min: f64, max: f64) -> Option<f64> {
        match self.params.get(key) {
            None => None,
            Some(Value::Number(n)) => match n.as_f64() {
                Some(f) if f.fract() == 0.0 && f >= min && f <= max => Some(f),
                _ => self.fault(key),
            },
            Some(_) => self.fault(key),
        }
    }

    pub fn boolean(&mut self, key: &str) -> Option<bool> {
        match self.params.get(key) {
            None => None,
            Some(Value::Bool(b)) => Some(*b),
            Some(_) => self.fault(key),
        }
    }

    pub fn names(&mut self, key: &str, max: usize) -> Option<Vec<String>> {
        match self.params.get(key) {
            None => None,
            Some(Value::Array(items)) if items.len() <= max => {
                let mut out = Vec::new();
                for (i, item) in items.iter().enumerate() {
                    match item {
                        Value::String(s) if !s.is_empty() && utf16_len(s) <= NAME * 2 => out.push(s.clone()),
                        _ => return self.fault(format!("{key}[{i}]")),
                    }
                }
                Some(out)
            }
            Some(_) => self.fault(key),
        }
    }

    /// The filter: `{field: {op, value?}}`, each predicate checked against its operator.
    pub fn filter(&mut self, key: &str) -> Option<Map<String, Value>> {
        let v = self.params.get(key)?;
        let Value::Object(map) = v else { return self.fault(key) };
        if map.len() > PREDICATES {
            return self.fault(key);
        }
        let mut out = Map::new();
        for field in js_keys(map) {
            let predicate = &map[field];
            let path = format!("{key}.{field}");
            if field.is_empty() || utf16_len(field) > NAME {
                self.faults.push(path);
                continue;
            }
            let Value::Object(predicate) = predicate else {
                self.faults.push(path);
                continue;
            };
            if predicate.keys().any(|k| k != "op" && k != "value") {
                self.faults.push(path.clone());
            }
            let op = match predicate.get("op") {
                Some(Value::String(op)) if OPERATORS.contains(&op.as_str()) => op.clone(),
                _ => {
                    self.faults.push(format!("{path}.op"));
                    continue;
                }
            };
            let value = predicate.get("value");
            if !predicate_value(&op, value) {
                self.faults.push(format!("{path}.value"));
                continue;
            }
            let mut p = Map::new();
            p.insert("op".into(), json!(op));
            if let Some(v) = value {
                p.insert("value".into(), v.clone());
            }
            out.insert(field.clone(), Value::Object(p));
        }
        Some(out)
    }

    /// Values to write: `{field: scalar | null | [strings]}`, 1 to 100 of them.
    pub fn values(&mut self, key: &str) -> Option<Map<String, Value>> {
        let Some(Value::Object(map)) = self.params.get(key) else { return self.fault(key) };
        if map.is_empty() || map.len() > VALUES_KEYS {
            return self.fault(key);
        }
        for field in js_keys(map) {
            let value = &map[field];
            let ok = !field.is_empty()
                && utf16_len(field) <= NAME
                && match value {
                    Value::Null | Value::Bool(_) | Value::Number(_) => true,
                    Value::String(s) => s.len() <= TEXT_BYTES,
                    Value::Array(items) => items.len() <= IN_VALUES && items.iter().all(|x| matches!(x, Value::String(s) if s.len() <= TEXT_BYTES)),
                    Value::Object(_) => false,
                };
            if !ok {
                self.faults.push(format!("{key}.{field}"));
            }
        }
        Some(map.clone())
    }

    /// A non-empty list of at most `max` plain objects.
    pub fn objects(&mut self, key: &str, max: usize, required: bool) -> Option<Vec<Map<String, Value>>> {
        match self.params.get(key) {
            None => {
                if required {
                    self.fault(key)
                } else {
                    None
                }
            }
            Some(Value::Array(items)) if !items.is_empty() && items.len() <= max && items.iter().all(Value::is_object) => {
                Some(items.iter().filter_map(|x| x.as_object().cloned()).collect())
            }
            Some(_) => self.fault(key),
        }
    }

    pub fn done(&mut self) -> Result<(), AppError> {
        if self.faults.is_empty() {
            Ok(())
        } else {
            Err(parameter_invalid(std::mem::take(&mut self.faults)))
        }
    }
}

fn scalar(x: &Value) -> bool {
    match x {
        Value::String(s) => s.len() <= TEXT_BYTES,
        Value::Bool(_) | Value::Number(_) => true,
        _ => false,
    }
}

fn predicate_value(op: &str, value: Option<&Value>) -> bool {
    match op {
        "is_null" => matches!(value, None | Some(Value::Bool(_))),
        "in" => matches!(value, Some(Value::Array(a)) if a.len() <= IN_VALUES && a.iter().all(scalar)),
        "between" => matches!(value, Some(Value::Array(a)) if a.len() == 2 && a.iter().all(scalar)),
        "has_any" | "has_all" => match value {
            Some(Value::Array(a)) => !a.is_empty() && a.len() <= IN_VALUES && a.iter().all(scalar),
            Some(v) => scalar(v),
            None => false,
        },
        _ => value.is_some_and(scalar),
    }
}

/// `argumentsOf`: the tool's arguments, `{}` when absent.
pub fn arguments_of(params: Option<&Value>) -> Result<Map<String, Value>, AppError> {
    match params.and_then(|p| p.as_object()).and_then(|p| p.get("arguments")) {
        None | Some(Value::Null) => Ok(Map::new()),
        Some(Value::Object(args)) => Ok(args.clone()),
        Some(_) => Err(parameter_invalid(vec!["arguments".into()])),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: Value) -> Map<String, Value> {
        v.as_object().unwrap().clone()
    }

    #[test]
    fn faults_are_collected_in_order() {
        let a = args(json!({ "zz": 1, "2": 0, "base": " ", "limit": 5.0, "filter": { "x": { "op": "eq", "value": [1] }, "y": { "op": "nope" }, "": {} } }));
        let mut c = Checker::new(&a);
        c.only(&["base", "limit", "filter"]);
        assert_eq!(c.name("base"), None);
        assert_eq!(c.integer("limit", 1.0, 1e6), Some(5.0));
        c.filter("filter");
        let err = c.done().unwrap_err();
        assert_eq!(err.details["invalid_params"], json!(["2", "zz", "base", "filter.x.value", "filter.y.op", "filter."]));
    }

    #[test]
    fn values_and_arguments() {
        let a = args(json!({ "values": { "a": { "x": 1 }, "b": ["s"], "c": null } }));
        let mut c = Checker::new(&a);
        assert!(c.values("values").is_some());
        assert_eq!(c.done().unwrap_err().details["invalid_params"], json!(["values.a"]));
        assert!(arguments_of(Some(&json!({ "arguments": [] }))).is_err());
        assert_eq!(arguments_of(Some(&json!({ "arguments": null }))).unwrap(), Map::new());
        assert_eq!(arguments_of(Some(&json!(3))).unwrap(), Map::new());
    }
}
