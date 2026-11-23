//! Ported from `packages/core/test/unit/formula.test.ts`.

use super::*;
use serde_json::Map;
use unicode_normalization::UnicodeNormalization;

fn key(label: &str) -> String {
    let lowered: String = label.nfc().collect::<String>().to_lowercase();
    lowered.split(js_space).filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" ")
}

fn field(id: &str, label: &str, name: &str, kind: &str, stored: bool, result: Option<&str>, multiple: bool) -> FormulaField {
    FormulaField {
        id: id.into(),
        label: label.into(),
        name: name.into(),
        kind: kind.into(),
        stored,
        result_kind: result.map(str::to_string),
        multiple,
    }
}

fn fields() -> Vec<FormulaField> {
    vec![
        field("f-prix", "Prix HT", "prix_ht", "number", true, None, false),
        field("f-taux", "Taux TVA", "taux_tva", "number", true, None, false),
        field("f-nom", "Nom", "nom", "short_text", true, None, false),
        field("f-debut", "Début", "debut", "date", true, None, false),
        field("f-fin", "Fin", "fin", "date", true, None, false),
        field("f-quand", "Quand", "quand", "datetime", true, None, false),
        field("f-client", "Client", "clients_id", "link", true, None, false),
        field("f-ttc", "TTC", "ttc", "formula", true, None, false),
        field("f-total", "Total factures", "total_factures", "rollup", false, Some("number"), false),
        field("f-villes", "Villes", "villes", "lookup", false, Some("short_text"), true),
        field("f-crochet", "Prix [HT]", "prix_crochet", "number", true, None, false),
    ]
}

fn resolve(text: &str) -> R<ResolvedFormula> {
    let by_key: HashMap<String, FormulaField> = fields().into_iter().map(|f| (key(&f.label), f)).collect();
    resolve_formula(&parse_formula(text)?, &by_key, &key)
}

fn ok(text: &str) -> ResolvedFormula {
    resolve(text).unwrap_or_else(|e| panic!("{text}: {e}"))
}

fn emit(text: &str) -> R<String> {
    let all = fields();
    let by_id = |id: &str| all.iter().find(|f| f.id == id).cloned();
    let field = |id: &str| format!("\"{}\"", by_id(id).map(|f| f.name).unwrap_or_default());
    let type_of = |id: &str| {
        let f = by_id(id);
        let kind = match &f {
            Some(f) if !f.stored => f.result_kind.clone().unwrap_or_default(),
            Some(f) => f.kind.clone(),
            None => String::new(),
        };
        match kind.as_str() {
            "number" => T::Number,
            "short_text" => T::Text,
            "date" => T::Date,
            "datetime" => T::Datetime,
            _ => T::Null,
        }
    };
    emit_formula(&resolve(text)?.ast, &EmitContext { field: &field, type_of: &type_of, timezone: "Europe/Paris" })
}

fn em(text: &str) -> String {
    emit(text).unwrap_or_else(|e| panic!("{text}: {e}"))
}

fn refusal(r: R<impl std::fmt::Debug>) -> (String, Map<String, Value>) {
    let e = r.expect_err("expected a refusal");
    (e.code.to_string(), details_of(&e))
}

fn within(sql: &str) -> String {
    format!("(CASE WHEN {sql} BETWEEN '0001-01-01'::date AND '9999-12-31'::date THEN {sql} END)")
}

fn formatted(local: &str, text: &str, datetime: bool) -> String {
    if datetime {
        format!("(CASE WHEN {local} BETWEEN '0001-01-01'::timestamp AND '9999-12-31 23:59:59.999999'::timestamp THEN {text} END)")
    } else {
        format!("(CASE WHEN {local} BETWEEN '0001-01-01'::date AND '9999-12-31'::date THEN {text} END)")
    }
}

#[test]
fn reads_fields_by_label_and_types_the_result() {
    let r = ok("[prix ht] * (1 + [Taux TVA])");
    assert_eq!(r.r#type, T::Number);
    assert!(r.stored);
    let mut d = r.dependencies.clone();
    d.sort();
    assert_eq!(d, vec!["f-prix", "f-taux"]);
    assert_eq!(ok("[Prix [HT]]] + 1").dependencies, vec!["f-crochet"]);
}

#[test]
fn types_comparisons_logic_text_and_dates() {
    assert_eq!(ok("[Prix HT] > 100 ET NON ([Nom] = \"x\")").r#type, T::Boolean);
    assert_eq!(ok("[Nom] & \" — \" & [Prix HT]").r#type, T::Text);
    assert_eq!(ok("SI([Prix HT] > 100; \"cher\"; \"abordable\")").r#type, T::Text);
    assert_eq!(ok("[Fin] - [Début]").r#type, T::Number);
    assert_eq!(ok("JOURS([Fin]; [Début])").r#type, T::Number);
    assert_eq!(ok("[Début] + 7").r#type, T::Date);
    assert_eq!(ok("AJOUTER_JOURS([Début]; 30)").r#type, T::Date);
    let today = ok("JOURS(AUJOURDHUI(); [Début])");
    assert!(!today.stored && today.uses_today);
    assert!(!ok("[Total factures] * 1.2").stored);
}

#[test]
fn refuses_what_cannot_be_computed_by_name() {
    let (code, details) = refusal(resolve("[Inconnu] + 1"));
    assert_eq!(code, "FORMULA_FIELD_NOT_FOUND");
    assert_eq!(details.get("field"), Some(&json!("Inconnu")));
    assert_eq!(details.get("position"), Some(&json!(0)));
    for (text, code) in [
        ("[Client]", "FORMULA_LINK_FORBIDDEN"),
        ("[TTC] * 2", "FORMULA_DEPENDS_ON_FORMULA"),
        ("[Nom] + 1", "FORMULA_TYPE_MISMATCH"),
        ("[Villes]", "FORMULA_TYPE_MISMATCH"),
        ("TEXTE([Début])", "FORMULA_FUNCTION_NOT_IMMUTABLE"),
        ("TEXTE([Quand])", "FORMULA_FUNCTION_NOT_IMMUTABLE"),
        ("[Nom] & [Début]", "FORMULA_FUNCTION_NOT_IMMUTABLE"),
        ("HEURE([Début])", "FORMULA_TYPE_MISMATCH"),
        ("SI(1; 2)", "FORMULA_SYNTAX"),
        ("\"ouvert", "FORMULA_SYNTAX"),
        ("FOO(1)", "FORMULA_SYNTAX"),
    ] {
        assert_eq!(refusal(resolve(text)).0, code, "{text}");
    }
}

#[test]
fn reads_english_words_into_the_same_tree() {
    let pairs = [
        ("SI([Prix HT] > 100; \"cher\"; \"abordable\")", "IF([Prix HT] > 100, \"cher\", \"abordable\")"),
        ("ESTVIDE([Nom]) OU NON VRAI ET FAUX", "ISBLANK([Nom]) OR NOT TRUE AND FALSE"),
        ("ARRONDI(ABS([Prix HT]); 2)", "ROUND(ABS([Prix HT]), 2)"),
        ("JOURS(AJOUTER_JOURS([Fin]; 3); AUJOURDHUI())", "DAYS(ADD_DAYS([Fin], 3), TODAY())"),
        ("MAINTENANT()", "now()"),
        ("NO_SEMAINE_ISO([Début])", "ISOWEEKNUM([Début])"),
        (
            "CONCAT([Nom]; \"!\") & JOINDRE_TEXTE(\", \"; VRAI; [Nom]; [Nom])",
            "CONCAT([Nom], \"!\") & TEXTJOIN(\", \", TRUE, [Nom], [Nom])",
        ),
    ];
    for (fr, en) in pairs {
        assert_eq!(ok(en).ast, ok(fr).ast, "{en}");
    }
    assert_eq!(ok("SI([Prix HT] > 1, 2; 3)").ast, ok("IF([Prix HT] > 1; 2, 3)").ast);
}

#[test]
fn renders_in_either_language_and_reads_back() {
    let fr = "SI(NON ESTVIDE([Nom]) ET VRAI; ARRONDI([Prix HT]; 2); AUJOURDHUI() - [Début])";
    let ast = ok(fr).ast;
    let all = fields();
    let label = |id: &str| all.iter().find(|f| f.id == id).map(|f| f.label.clone()).unwrap_or(id.to_string());
    let english = render_formula(&ast, &label, FormulaDialect::En);
    assert_eq!(english, "IF(NOT ISBLANK([Nom]) AND TRUE, ROUND([Prix HT], 2), TODAY() - [Début])");
    assert_eq!(render_formula(&ast, &label, FormulaDialect::Fr), fr);
    assert_eq!(ok(&english).ast, ast);
    assert_eq!(formula_dialect("fr"), FormulaDialect::Fr);
    assert_eq!(formula_dialect("de"), FormulaDialect::En);
    assert_eq!(formula_in_english("SI([Prix; HT] > 1; \"a;b\"; 2)"), "IF([Prix; HT] > 1, \"a;b\", 2)");
}

#[test]
fn round_trips_json() {
    let ast = ok("SI([Prix HT] > 1; -[Prix HT]; NULL)").ast;
    assert_eq!(Node::from_json(&ast.to_json()), Some(ast));
}

#[test]
fn emits_guarded_sql() {
    assert_eq!(
        em("[Prix HT] / [Taux TVA]"),
        "(CASE WHEN \"taux_tva\" = 0 OR \"taux_tva\" IS NULL THEN NULL ELSE \"prix_ht\" / \"taux_tva\" END)"
    );
    assert_eq!(em("ARRONDI([Prix HT]; 2)"), "round(\"prix_ht\", least(greatest(2::numeric, -1000), 1000)::int)");
    assert_eq!(em("[Nom] & [Prix HT]"), "(coalesce(\"nom\"::text, '') || coalesce(trim_scale(\"prix_ht\")::text, ''))");
    assert_eq!(em("\"l'été \"\"chaud\"\"\""), "'l''été \"chaud\"'::text");
    assert_eq!(em("AUJOURDHUI()"), "(pg_catalog.now() AT TIME ZONE 'Europe/Paris')::date");
}

#[test]
fn text_functions() {
    assert_eq!(refusal(resolve("STXT([Nom]; 1)")).1.get("detail"), Some(&json!("arguments:STXT:3")));
    assert_eq!(refusal(resolve("CONCAT()")).1.get("detail"), Some(&json!("arguments:CONCAT:1-32")));
    assert_eq!(refusal(resolve("JOINDRE_TEXTE(\",\"; VRAI)")).1.get("detail"), Some(&json!("arguments:JOINDRE_TEXTE:3-34")));
    assert_eq!(em("STXT([Nom]; 2; 3)"), "substr(\"nom\", 2, 3)");
    assert_eq!(em("STXT([Nom]; 0; 99999999)"), "substr(\"nom\", 1, 1000000)");
    assert_eq!(
        em("STXT([Nom]; [Prix HT]; 3)"),
        "substr(\"nom\", (CASE WHEN \"prix_ht\" IS NULL THEN NULL ELSE trunc(least(greatest(\"prix_ht\", 1), 1000000))::int END), 3)"
    );
    assert_eq!(em("CHERCHE(\"x\"; [Nom])"), "nullif(strpos(lower(\"nom\" COLLATE \"und-x-icu\"), 'x'::text), 0)::numeric");
    assert!(em("CHERCHE(\"ÉA\"; [Nom])").contains("'éa'::text"));
    assert_eq!(
        em("FINITPAR([Nom]; \"a\")"),
        "starts_with(reverse(_basedb_local.fold_v1(\"nom\")), reverse(_basedb_local.fold_v1('a'::text)))"
    );
    assert_eq!(
        em("REPT(\"ab\"; 3)"),
        "(CASE WHEN length('ab'::text)::bigint * 3 > 32767 THEN NULL ELSE repeat('ab'::text, 3) END)"
    );
    assert!(em("REPT(\"ab\"; 99999)").contains("* 32767 >"));
    assert_eq!(em("CONCAT([Nom])"), "(coalesce(\"nom\"::text, ''))");
    assert_eq!(
        em("JOINDRE_TEXTE(\" - \"; FAUX; [Nom]; \"x\")"),
        "(coalesce(\"nom\"::text, '') || ' - ' || coalesce('x'::text::text, ''))"
    );
    assert_eq!(
        em("JOINDRE_TEXTE(\", \"; VRAI; [Nom]; \"x\")"),
        "substr((CASE WHEN length(\"nom\"::text) > 0 THEN ', ' || \"nom\"::text ELSE '' END) || (', ' || 'x'), 3)"
    );
    assert!(em("JOINDRE_TEXTE(\"→\"; VRAI; [Nom])").contains(", 2)"));
    assert_eq!(
        refusal(resolve("JOINDRE_TEXTE(\",\"; [Prix HT] > 1; \"a\")")).1.get("detail"),
        Some(&json!("valeur_ecrite_attendue:JOINDRE_TEXTE:ignorer_vides"))
    );
    let mut nested = "[Prix HT]".to_string();
    for _ in 0..14 {
        nested = format!("[Prix HT] / ({nested})");
    }
    assert_eq!(refusal(emit(&nested)).1.get("detail"), Some(&json!("formule_trop_complexe")));
}

#[test]
fn regular_expressions() {
    let text = "REGEX_CORRESPOND([Nom]; \"^[A-Z]\")";
    let r = ok(text);
    assert_eq!(r.r#type, T::Boolean);
    assert_eq!(r.patterns, vec![RegexPattern { pattern: "^[A-Z]".into(), fun: "REGEX_CORRESPOND".into(), position: text.find('"').unwrap() }]);
    assert_eq!(em("REGEX_CORRESPOND([Nom]; \"^a\")"), "((\"nom\") COLLATE \"und-x-icu\" ~ '^a'::text)");
    assert_eq!(
        refusal(resolve("REGEX_CORRESPOND([Nom]; \"(a+)\\1\")")).1.get("detail"),
        Some(&json!("motif_refuse:REGEX_CORRESPOND:reference_arriere"))
    );
    assert_eq!(ok("REGEX_CORRESPOND([Nom]; \"a\\\\1\")").patterns.len(), 1);
}

#[test]
fn texte_with_a_format() {
    assert_eq!(em("TEXT([Début], \"dd/mm/yyyy\")"), em("TEXTE([Début]; \"jj/mm/aaaa\")"));
    assert_eq!(
        em("TEXTE([Début]; \"jj/mm/aaaa\")"),
        formatted(
            "(\"debut\")",
            "lpad(extract(day from (\"debut\"))::int::text, 2, '0') || '/' || lpad(extract(month from (\"debut\"))::int::text, 2, '0') || '/' || lpad(extract(year from (\"debut\"))::int::text, 4, '0')",
            false
        )
    );
    let sql = em("TEXTE([Quand]; \"mm/jj hh:mm:ss\")");
    assert!(sql.find("extract(month").unwrap() < sql.find("extract(day").unwrap());
    assert!(sql.contains("extract(minute from"));
    assert_eq!(sql.matches("extract(month").count(), 1);
    let wall = "(\"quand\" AT TIME ZONE 'Europe/Paris')";
    assert_eq!(em("TEXTE([Quand]; \"aaaa\")"), formatted(wall, &format!("lpad(extract(year from {wall})::int::text, 4, '0')"), true));
    assert!(em("TEXTE([Début]; \"\\l\\u\")").contains("'lu'"));
    for (format, detail) in [
        ("lundi", "format_inconnu:l"),
        ("jjjj", "format_inconnu:jjjj"),
        ("mmmm aaaa", "format_inconnu:mmmm"),
        ("aaa", "format_inconnu:aaa"),
        ("jj\\", "format_inconnu:\\"),
    ] {
        assert_eq!(refusal(resolve(&format!("TEXTE([Début]; \"{format}\")"))).1.get("detail"), Some(&json!(detail)), "{format}");
    }
    assert_eq!(refusal(resolve("TEXTE([Début]; \"jj hh\")")).1.get("detail"), Some(&json!("TEXTE:heure_sur_date")));
}

#[test]
fn date_functions() {
    assert_eq!(em("AJOUTER_MOIS([Début]; 3)"), format!("({} + make_interval(months => 3))::date", within("\"debut\"")));
    assert!(em("AJOUTER_MOIS([Début]; 999999)").contains("months => 12000)"));
    let age = format!("age({}::timestamp, {}::timestamp)", within("\"fin\""), within("\"debut\""));
    assert_eq!(em("DATEDIF([Début]; [Fin]; \"Y\")"), format!("extract(year from {age})::numeric"));
    assert_eq!(em("DATEDIF([Début]; [Fin]; \"ym\")"), format!("extract(month from {age})::numeric"));
    assert_eq!(refusal(resolve("DATEDIF([Début]; [Fin]; \"MD\")")).1.get("detail"), Some(&json!("unite_inconnue:MD")));
    assert_eq!(em("JOURS([Fin]; [Début])"), "((\"fin\" - \"debut\")::numeric)");
    for text in ["ANNEE([Quand])", "FIN_MOIS([Quand])", "HEURE([Quand])", "DATEDIF([Début]; [Quand]; \"M\")"] {
        let r = ok(text);
        assert!(!r.stored && r.uses_timezone && !r.uses_today, "{text}");
    }
    assert_eq!(em("ANNEE([Quand])"), "extract(year from (\"quand\" AT TIME ZONE 'Europe/Paris')::date)::numeric");
}
