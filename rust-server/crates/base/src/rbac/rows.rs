//! Les lignes qu'un groupe voit — chapitre 05 §16, tels `rbac/rows.ts` et `rbac/row-alias.ts`.
//!
//! Une règle de lignes est un filtre du chapitre 08 §4, compilé en un GABARIT SQL :
//! colonnes qualifiées par l'alias `"basedb_row"` (remplacé par chaque requête,
//! [`row_where`]), valeurs en littéraux, `@moi` remplacé par une sentinelle puis par la
//! personne au moment de la décision ([`personalize`]).
//!
//! La compilation d'une règle demande le constructeur de filtres, qui appartient au domaine
//! `records`. Le socle n'en dépend pas : `records` enregistre son compilateur au démarrage
//! par [`set_row_rule_compiler`]. Tant qu'aucun n'est enregistré, toute règle se compile en
//! `FALSE` — elle ne montre rien plutôt que tout, comme une règle qui ne compile plus.

use basedb_contracts::naming::{quote_identifier, quote_literal};
use std::collections::HashMap;
use std::sync::OnceLock;

/// The alias a rule's columns are qualified with until a query names its own.
pub const ROW_ALIAS: &str = "basedb_row";
const PLACEHOLDER: &str = "\"basedb_row\".";

/// What a rule writes for « the person looking ».
pub const ME: &str = "@moi";
const ME_WORDS: [&str; 2] = [ME, "@me"];
/// Stands for `@moi` in a compiled template: a v4 UUID nobody is ever given.
pub const ME_SENTINEL: &str = "ffffffff-ffff-4fff-bfff-ffffffffffff";

/// `rowWhere`: the predicate as one query writes it.
pub fn row_where(predicate: &str, alias: Option<&str>) -> String {
    let Some(alias) = alias.filter(|_| predicate != "TRUE") else { return predicate.to_string() };
    let prefix = if alias.starts_with('"') {
        format!("{alias}.")
    } else {
        format!("{}.", quote_identifier(alias).unwrap_or_else(|_| format!("\"{}\"", alias.replace('"', "\"\""))))
    };
    predicate.replace(PLACEHOLDER, &prefix)
}

/// `policyExpression`: for a PostgreSQL policy, columns bare.
pub fn policy_expression(predicate: &str) -> String {
    predicate.replace(PLACEHOLDER, "")
}

fn is_word_char(c: Option<char>) -> bool {
    c.is_some_and(|c| c.is_alphanumeric() || c == '_')
}

/// `@moi` outside any string, as the quoted sentinel. Inside a string it stays text.
pub fn with_sentinel(filter: &str) -> String {
    let chars: Vec<char> = filter.chars().collect();
    let mut out = String::with_capacity(filter.len());
    let mut in_string = false;
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if in_string {
            out.push(c);
            if c == '\\' && i + 1 < chars.len() {
                out.push(chars[i + 1]);
                i += 1;
            } else if c == '"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if c == '"' {
            in_string = true;
            out.push(c);
            i += 1;
            continue;
        }
        let word = ME_WORDS.iter().find(|w| {
            let w: Vec<char> = w.chars().collect();
            chars[i..].starts_with(&w) && !is_word_char(chars.get(i + w.len()).copied())
        });
        if let Some(w) = word {
            out.push('"');
            out.push_str(ME_SENTINEL);
            out.push('"');
            i += w.chars().count();
            continue;
        }
        out.push(c);
        i += 1;
    }
    out
}

/// `withMe`: a person's own filter, `@moi` being them.
pub fn with_me(filter: &str, person_id: &str) -> String {
    if !filter.contains('@') {
        return filter.to_string();
    }
    with_sentinel(filter).replace(&format!("\"{ME_SENTINEL}\""), &format!("\"{person_id}\""))
}

/// `personalize`: a template for one person.
pub fn personalize(template: &str, person_id: &str) -> String {
    let sentinel = quote_literal(ME_SENTINEL);
    let ok = person_id.len() == 36 && person_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
    template.replace(&sentinel, &if ok { quote_literal(person_id) } else { "NULL".into() })
}

/// A rule's compiler: `(filter, fields (name, kind)) → template`, or an error when it does
/// not compile (unknown field, bad operator…).
pub type RowRuleCompiler = fn(&str, &[(String, String)]) -> Result<String, crate::error::AppError>;

static COMPILER: OnceLock<RowRuleCompiler> = OnceLock::new();

/// Registered once, by `records`, at startup.
pub fn set_row_rule_compiler(compiler: RowRuleCompiler) {
    let _ = COMPILER.set(compiler);
}

/// `compileRowRule`: one rule checked against its table — its errors are the answer of the
/// route that saves it. Without a registered compiler, an internal error.
pub fn compile_row_rule(filter: &str, fields: &[(String, String)]) -> Result<String, crate::error::AppError> {
    match COMPILER.get() {
        Some(compile) => compile(filter, fields),
        None => Err(crate::error::AppError::internal("aucun compilateur de règles de lignes enregistré")),
    }
}

/// `compileRowRules`: role → template; a rule that no longer compiles becomes `FALSE`.
pub fn compile_row_rules(rules: &[(String, String)], fields: &[(String, String)]) -> HashMap<String, String> {
    let mut compiled = HashMap::new();
    for (role_id, filter) in rules {
        let template = match COMPILER.get() {
            Some(compile) => compile(filter, fields).unwrap_or_else(|_| "FALSE".into()),
            None => "FALSE".into(),
        };
        compiled.insert(role_id.clone(), template);
    }
    compiled
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn me_outside_strings_only() {
        assert_eq!(with_sentinel("owner eq @moi"), format!("owner eq \"{ME_SENTINEL}\""));
        assert_eq!(with_sentinel("note eq \"écrit par @moi\""), "note eq \"écrit par @moi\"");
        assert_eq!(with_sentinel("x eq @moine"), "x eq @moine");
        assert_eq!(with_me("a eq @me", "u-1"), "a eq \"u-1\"");
    }

    #[test]
    fn personalize_and_alias() {
        let t = format!("\"basedb_row\".\"owner\" = '{ME_SENTINEL}'");
        assert_eq!(personalize(&t, "not-a-uuid"), "\"basedb_row\".\"owner\" = NULL");
        assert_eq!(row_where(&t, Some("c")), format!("\"c\".\"owner\" = '{ME_SENTINEL}'"));
        assert_eq!(row_where("TRUE", Some("c")), "TRUE");
        assert_eq!(row_where(&t, None), t);
        assert_eq!(policy_expression(&t), format!("\"owner\" = '{ME_SENTINEL}'"));
    }

    #[test]
    fn without_compiler_rules_show_nothing() {
        let rules = compile_row_rules(&[("r".into(), "a eq 1".into())], &[]);
        assert_eq!(rules.get("r").map(String::as_str), Some("FALSE"));
    }
}
