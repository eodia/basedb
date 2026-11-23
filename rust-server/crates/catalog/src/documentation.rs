//! Readable documentation (`catalog/documentation.ts`): the third serialization of the
//! projection, in Markdown, in the reader's language.
//!
//! The prose is written in French and passes through [`Say::t`]: the French sentence is the
//! key of the catalogs in `documentation/texts/*.json` (one per language, edited by hand;
//! `documentation/tests.rs` lists what each one lacks). A sentence a catalog lacks is
//! written in French.

use crate::js::{encode_uri_component, js_collapse_spaces, js_trim_end};
use crate::labels::escape_label;
use crate::projection::{ProjectedBase, ProjectedField, ProjectedTable};
use basedb_base::rbac::decide::Action;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::LazyLock;

// ── The catalogs ─────────────────────────────────────────────────────────────────────

const TEXTS: &[(&str, &str)] = &[
    ("en", include_str!("documentation/texts/en.json")),
    ("de", include_str!("documentation/texts/de.json")),
    ("es", include_str!("documentation/texts/es.json")),
    ("it", include_str!("documentation/texts/it.json")),
    ("pt-BR", include_str!("documentation/texts/pt-BR.json")),
    ("nl", include_str!("documentation/texts/nl.json")),
    ("pl", include_str!("documentation/texts/pl.json")),
    ("cs", include_str!("documentation/texts/cs.json")),
    ("sv", include_str!("documentation/texts/sv.json")),
    ("da", include_str!("documentation/texts/da.json")),
    ("nb", include_str!("documentation/texts/nb.json")),
    ("fi", include_str!("documentation/texts/fi.json")),
    ("ro", include_str!("documentation/texts/ro.json")),
    ("hu", include_str!("documentation/texts/hu.json")),
    ("tr", include_str!("documentation/texts/tr.json")),
    ("uk", include_str!("documentation/texts/uk.json")),
    ("ja", include_str!("documentation/texts/ja.json")),
    ("zh-CN", include_str!("documentation/texts/zh-CN.json")),
    ("ko", include_str!("documentation/texts/ko.json")),
];

static CATALOGS: LazyLock<HashMap<&'static str, HashMap<String, String>>> = LazyLock::new(|| {
    TEXTS
        .iter()
        .map(|(locale, text)| (*locale, serde_json::from_str(text).expect("documentation texts are valid JSON")))
        .collect()
});

static PLACEHOLDER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{([A-Za-z0-9_]+)\}").unwrap());

/// `sayer`: says a French sentence in the reader's language, with its values filled in.
pub struct Say {
    catalog: Option<&'static HashMap<String, String>>,
}

impl Say {
    pub fn new(language: &str) -> Self {
        Say { catalog: CATALOGS.get(language) }
    }

    pub fn t(&self, french: &str) -> String {
        self.catalog.and_then(|c| c.get(french)).cloned().unwrap_or_else(|| french.to_string())
    }

    /// One pass over the sentence, never over what it inserts: a value may hold braces.
    pub fn tv(&self, french: &str, values: &[(&str, &str)]) -> String {
        let text = self.t(french);
        PLACEHOLDER
            .replace_all(&text, |c: &regex::Captures| match values.iter().find(|(k, _)| *k == &c[1]) {
                Some((_, v)) => v.to_string(),
                None => c[0].to_string(),
            })
            .into_owned()
    }
}

const GROUP_START: &str = "Prise en main";
const GROUP_API: &str = "API REST";
const GROUP_MCP: &str = "Agents (MCP)";
const GROUP_TABLES: &str = "Tables";
const GROUP_REFERENCE: &str = "Référence";

fn type_label(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "short_text" => "texte",
        "long_text" => "texte long",
        "number" => "nombre (chaîne décimale)",
        "boolean" => "booléen",
        "date" => "date (`2026-09-18`)",
        "datetime" => "date-heure UTC (`2026-09-18T14:03:00.000Z`)",
        "select" => "liste de choix",
        "multi_select" => "choix multiple (liste de valeurs)",
        "link" => "relation (`_id` de la ligne liée)",
        "multi_link" => "relation multiple (liste des `_id` des lignes liées, dans leur ordre)",
        "url" => "lien URL (`https://…` ou `mailto:…`)",
        "email" => "adresse e-mail",
        "autonumber" => "numéro automatique (lecture seule)",
        "user" => "personne (`id` d’un membre de l’espace)",
        "formula" => "formule",
        "file" => "documents (liste de fichiers)",
        "image" => "images (liste de fichiers)",
        "system" => "colonne système",
        _ => return None,
    })
}

// ── Building blocks ───────────────────────────────────────────────────────────────────

fn inline(text: &str) -> String {
    escape_label(crate::description::js_trim(&js_collapse_spaces(text)))
}

fn paragraph(text: &str) -> String {
    let mut s = inline(text);
    if s.starts_with('-') || s.starts_with('+') {
        s.insert(0, '\\');
    } else {
        let digits = s.bytes().take_while(u8::is_ascii_digit).count();
        if digits > 0 && s.as_bytes().get(digits) == Some(&b'.') {
            s.insert(digits, '\\');
        }
    }
    s
}

fn code(text: &str) -> String {
    format!("`{text}`")
}

fn row(cells: &[String]) -> String {
    format!("| {} |", cells.join(" | "))
}

fn md_table(header: &[String], rows: &[Vec<String>]) -> Vec<String> {
    let mut out = vec![row(header), row(&header.iter().map(|_| "---".to_string()).collect::<Vec<_>>())];
    out.extend(rows.iter().map(|r| row(r)));
    out
}

fn callout(kind: &str, lines: &[String]) -> Vec<String> {
    let mut out = vec![format!("> [!{kind}]")];
    out.extend(lines.iter().map(|l| js_trim_end(&format!("> {l}")).to_string()));
    out
}

fn fence(lang: &str, title: Option<&str>, body: Vec<String>) -> Vec<String> {
    let info = match title {
        None => lang.to_string(),
        Some(t) => format!("{lang} title=\"{t}\""),
    };
    let mut out = vec![format!("```{info}")];
    out.extend(body);
    out.push("```".into());
    out
}

fn pretty(value: &Value) -> Vec<String> {
    serde_json::to_string_pretty(value).unwrap_or_default().split('\n').map(String::from).collect()
}

fn literal(value: &str) -> String {
    if !value.is_empty() && value.bytes().all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b)) {
        code(value)
    } else {
        inline(value)
    }
}

fn s<T: AsRef<str>>(items: &[T]) -> Vec<String> {
    items.iter().map(|i| i.as_ref().to_string()).collect()
}

// ── Examples ──────────────────────────────────────────────────────────────────────────

const EXAMPLE_ID: &str = "0192f3c2-7b1e-7c4a-9a55-3e2f5d0c8b11";

static SAFE_OPTION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[\p{L}\p{N} _.,:;-]{1,40}$").unwrap());

#[derive(Clone, Copy, PartialEq, Eq)]
enum Direction {
    Read,
    Write,
}

fn safe_first_option(field: &ProjectedField, t: &Say) -> String {
    match field.options.as_ref().and_then(|o| o.first()).map(|o| o.value.as_str()) {
        Some(first) if SAFE_OPTION.is_match(first) => first.to_string(),
        _ => t.t("valeur"),
    }
}

fn sample(field: &ProjectedField, direction: Direction, t: &Say) -> Value {
    match field.kind.as_str() {
        "number" => json!("1240.00"),
        "boolean" => json!(true),
        "date" => json!("2026-09-18"),
        "datetime" => json!("2026-09-18T14:03:00.000Z"),
        "long_text" => json!(t.t("Un texte plus long.")),
        "select" => json!(safe_first_option(field, t)),
        "multi_select" => json!([safe_first_option(field, t)]),
        "file" | "image" => {
            if direction == Direction::Write {
                return json!([{ "id": EXAMPLE_ID }]);
            }
            let name = sample_file_name(field, t);
            json!([{
                "id": EXAMPLE_ID,
                "name": name,
                "type": if field.kind == "image" { "image/jpeg" } else { "application/pdf" },
                "size": 48213,
                "url": format!("/api/v1/…/files/{EXAMPLE_ID}/{name}?exp=…&sig=…"),
            }])
        }
        "link" => {
            if direction == Direction::Write {
                return json!(EXAMPLE_ID);
            }
            if field.link.as_ref().is_some_and(|l| l.masked) {
                json!({ "id": null, "display": null, "masked": true })
            } else {
                json!({ "id": EXAMPLE_ID, "display": t.t("Exemple") })
            }
        }
        "multi_link" => {
            if direction == Direction::Write {
                return json!([EXAMPLE_ID]);
            }
            if field.link.as_ref().is_some_and(|l| l.masked) {
                json!([{ "id": null, "display": null, "masked": true }])
            } else {
                json!([{ "id": EXAMPLE_ID, "display": t.t("Exemple") }])
            }
        }
        "formula" => json!(t.t("résultat")),
        "system" => {
            if field.name == "_id" || field.name.ends_with("_by") {
                json!(EXAMPLE_ID)
            } else {
                json!("2026-09-18T14:03:00.000Z")
            }
        }
        _ => json!(t.t("Exemple")),
    }
}

fn sample_file_name(field: &ProjectedField, t: &Say) -> String {
    if field.kind == "image" {
        t.t("photo.jpg")
    } else {
        t.t("devis.pdf")
    }
}

const SAMPLE_WIDTH: usize = 6;

fn examples(base: &ProjectedBase, table: &ProjectedTable, tenant: &str, t: &Say) -> Vec<String> {
    let root = format!("/api/v1/{tenant}/data/{}/{}", base.name, table.name);
    let can_read = table.actions.contains(&Action::Read);
    let can_create = table.actions.contains(&Action::Create);
    if !can_read && !can_create {
        return vec![];
    }
    let mut lines = vec![format!("### {}", t.t("Exemples")), String::new()];

    if can_read {
        let mut row_sample = Map::new();
        row_sample.insert("_id".into(), json!(EXAMPLE_ID));
        for field in table.fields.iter().filter(|f| !f.system).take(SAMPLE_WIDTH) {
            row_sample.insert(field.name.clone(), sample(field, Direction::Read, t));
        }
        lines.push(format!("#### {}", t.t("Lister les lignes")));
        lines.push(String::new());
        lines.extend(fence("bash", Some("cURL"), vec![format!("curl \"$BASEDB_URL{root}?limit=20\" \\"), "  -H \"Authorization: Bearer $BASEDB_TOKEN\"".into()]));
        lines.push(String::new());
        lines.extend(fence(
            "js",
            Some("JavaScript"),
            s(&[
                "const response = await fetch(".to_string(),
                format!("  `${{process.env.BASEDB_URL}}{root}?limit=20`,"),
                "  { headers: { Authorization: `Bearer ${process.env.BASEDB_TOKEN}` } },".to_string(),
                ")".to_string(),
                "const { data, meta } = await response.json()".to_string(),
            ]),
        ));
        lines.push(String::new());
        lines.push(format!("#### {}", t.t("Réponse")));
        lines.push(String::new());
        lines.extend(fence(
            "json",
            None,
            pretty(&json!({ "data": [Value::Object(row_sample)], "included": {}, "meta": { "has_next_page": false, "next_cursor": null } })),
        ));
        lines.push(String::new());
    }

    if can_create {
        let mut values = Map::new();
        for field in &table.fields {
            if field.system || field.read_only || field.kind == "formula" {
                continue;
            }
            if values.len() >= SAMPLE_WIDTH {
                break;
            }
            values.insert(field.name.clone(), sample(field, Direction::Write, t));
        }
        let body = serde_json::to_string(&json!({ "values": Value::Object(values) })).unwrap_or_default();
        lines.push(format!("#### {}", t.t("Créer une ligne")));
        lines.push(String::new());
        lines.extend(fence(
            "bash",
            Some("cURL"),
            vec![
                format!("curl -X POST \"$BASEDB_URL{root}\" \\"),
                "  -H \"Authorization: Bearer $BASEDB_TOKEN\" \\".into(),
                "  -H \"Content-Type: application/json\" \\".into(),
                format!("  -d '{body}'"),
            ],
        ));
        lines.push(String::new());
        lines.extend(fence(
            "js",
            Some("JavaScript"),
            vec![
                "const response = await fetch(".into(),
                format!("  `${{process.env.BASEDB_URL}}{root}`,"),
                "  {".into(),
                "    method: 'POST',".into(),
                "    headers: {".into(),
                "      Authorization: `Bearer ${process.env.BASEDB_TOKEN}`,".into(),
                "      'Content-Type': 'application/json',".into(),
                "    },".into(),
                format!("    body: JSON.stringify({body}),"),
                "  },".into(),
                ")".into(),
            ],
        ));
        lines.push(String::new());

        if let Some(file_field) = table.fields.iter().find(|f| (f.kind == "file" || f.kind == "image") && !f.read_only) {
            let name = sample_file_name(file_field, t);
            let kind = if file_field.kind == "image" { "image/jpeg" } else { "application/pdf" };
            lines.push(format!("#### {}", t.t("Déposer un fichier")));
            lines.push(String::new());
            lines.push(t.tv(
                "Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.",
                &[("field", &code(&file_field.name)), ("write", &code(&format!("{{\"values\": {{\"{}\": [{{\"id\": \"…\"}}]}}}}", file_field.name)))],
            ));
            lines.push(String::new());
            lines.extend(fence(
                "bash",
                Some("cURL"),
                vec![
                    format!("curl -X POST \"$BASEDB_URL/api/v1/{tenant}/files/{}/{}/{}?name={name}\" \\", base.name, table.name, file_field.name),
                    "  -H \"Authorization: Bearer $BASEDB_TOKEN\" \\".into(),
                    format!("  -H \"Content-Type: {kind}\" \\"),
                    format!("  --data-binary @{name}"),
                ],
            ));
            lines.push(String::new());
        }
    }
    lines
}

// ── The agent surface (MCP) ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolNeeds {
    None,
    Read,
    Create,
    Update,
    Delete,
    Propose,
}

/// `DOCUMENTED_MCP_TOOLS`: the MCP tools as this documentation presents them.
pub const DOCUMENTED_MCP_TOOLS: &[(&str, &str, ToolNeeds)] = &[
    ("whoami", "L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.", ToolNeeds::None),
    ("list_bases", "Les bases que le jeton peut lire.", ToolNeeds::Read),
    ("describe_base", "Les tables d’une base et le graphe de leurs relations.", ToolNeeds::Read),
    ("describe_table", "Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.", ToolNeeds::Read),
    ("list_records", "Lire des lignes : filtre, tri, pagination par curseur.", ToolNeeds::Read),
    ("get_record", "Lire une ligne par son `_id`, les textes longs en entier si on le demande.", ToolNeeds::Read),
    ("lookup_records", "Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.", ToolNeeds::Read),
    ("create_record", "Créer une ligne.", ToolNeeds::Create),
    ("update_record", "Modifier les champs nommés d’une ligne.", ToolNeeds::Update),
    ("delete_record", "Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.", ToolNeeds::Delete),
    ("restore_record", "Ramener une ligne supprimée, sous son `_id`, depuis l’historique.", ToolNeeds::Create),
    ("attach_file", "Déposer un document ou une image dans un champ fichier d’une ligne — son contenu en base64, ou son adresse.", ToolNeeds::Update),
    ("propose_create_table", "Proposer une table et ses premiers champs — une personne décide.", ToolNeeds::Propose),
    ("propose_add_field", "Proposer un champ, une liste de choix ou une relation — une personne décide.", ToolNeeds::Propose),
    ("propose_update_look", "Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.", ToolNeeds::Propose),
    ("get_proposal", "Relire une proposition du jeton et savoir ce qu’il en est advenu.", ToolNeeds::Read),
    ("insights_describe_sources", "Les bases de données qu’interroge insights, à côté de basedb : leurs tables et leurs colonnes.", ToolNeeds::Read),
    ("insights_search", "Chercher par nom les questions et les tableaux de bord d’insights.", ToolNeeds::Read),
    ("insights_run_question", "Exécuter une question enregistrée d’insights et en lire les lignes.", ToolNeeds::Read),
    ("insights_create_dashboard", "Créer un tableau de bord dans insights, avec ses questions — il s’ouvre aussi dans basedb.", ToolNeeds::Create),
    ("insights_add_question", "Enregistrer une question dans insights, et l’ajouter en carte à un tableau de bord.", ToolNeeds::Create),
];

fn environment_example(base: &ProjectedBase, t: &Say) -> String {
    if base.environment.production {
        t.t("recette")
    } else {
        base.environment.label.clone()
    }
}

fn relay(t: &Say) -> String {
    format!("<{}>/scripts/mcp-relay.mjs", t.t("dépôt basedb"))
}

fn agent_writable(field: &ProjectedField) -> bool {
    !field.system
        && !field.read_only
        && !field.hidden_from_agents
        && !field.unsafe_html
        && field.kind != "formula"
        && !field.ai
        && field.kind != "file"
        && field.kind != "image"
}

fn agent_usage(base: &ProjectedBase, table: &ProjectedTable, t: &Say) -> Vec<String> {
    let mut lines = vec![format!("### {}", t.t("Depuis un agent (MCP)")), String::new()];
    if !base.agents_enabled {
        lines.extend(callout("NOTE", &[t.t("Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.")]));
        return lines;
    }
    let has = |a: Action| table.actions.contains(&a);
    let can_read = has(Action::Read);
    let mut rows: Vec<Vec<String>> = Vec::new();
    if can_read {
        rows.push(vec![code("describe_table"), t.t("Connaître ses champs, et lesquels sont modifiables")]);
        rows.push(vec![code("list_records"), t.t("Lire ses lignes — filtre, tri, pagination")]);
        rows.push(vec![code("get_record"), t.t("Lire une ligne par son `_id`")]);
        if let Some(display) = &table.display_field {
            rows.push(vec![code("lookup_records"), t.tv("Trouver une ligne par sa valeur d’affichage, {field}", &[("field", &code(display))])]);
        }
    }
    if has(Action::Create) {
        rows.push(vec![code("create_record"), t.t("Créer une ligne")]);
    }
    if has(Action::Update) {
        rows.push(vec![code("update_record"), t.t("Modifier une ligne")]);
    }
    if has(Action::Delete) {
        rows.push(vec![code("delete_record"), t.t("Supprimer une ligne — avec un jeton créé pour supprimer")]);
    }
    if has(Action::Create) {
        rows.push(vec![code("restore_record"), t.t("Ramener une ligne supprimée")]);
    }
    if has(Action::Update) && table.fields.iter().any(|f| (f.kind == "file" || f.kind == "image") && !f.read_only && !f.hidden_from_agents) {
        rows.push(vec![code("attach_file"), t.t("Déposer un document ou une image dans un champ fichier")]);
    }
    if rows.is_empty() {
        lines.push(t.t("Aucun outil ne vous est ouvert sur cette table."));
        return lines;
    }
    lines.push(t.t("Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum."));
    lines.push(String::new());
    lines.extend(md_table(&[t.t("Outil"), t.t("Pour")], &rows));

    if has(Action::Delete) {
        lines.push(String::new());
        lines.push(t.t("Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique."));
    }

    let hidden: Vec<&ProjectedField> = table.fields.iter().filter(|f| f.hidden_from_agents).collect();
    if !hidden.is_empty() {
        lines.push(String::new());
        lines.push(t.tv(
            "**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.",
            &[("fields", &hidden.iter().map(|f| code(&f.name)).collect::<Vec<_>>().join(", "))],
        ));
    }

    let mut calls: Vec<String> = Vec::new();
    if can_read {
        let text = table.fields.iter().find(|f| !f.system && !f.hidden_from_agents && (f.kind == "short_text" || f.kind == "long_text"));
        let mut args = Map::new();
        args.insert("base".into(), json!(base.name));
        args.insert("table".into(), json!(table.name));
        if let Some(text) = text {
            let mut filter = Map::new();
            filter.insert(text.name.clone(), json!({ "op": "contains", "value": t.t("Exemple") }));
            args.insert("filter".into(), Value::Object(filter));
        }
        args.insert("limit".into(), json!(20));
        calls.extend(fence("json", Some("list_records"), pretty(&Value::Object(args))));
    }
    if has(Action::Create) {
        let mut values = Map::new();
        for field in &table.fields {
            if !agent_writable(field) {
                continue;
            }
            if values.len() >= SAMPLE_WIDTH {
                break;
            }
            values.insert(field.name.clone(), sample(field, Direction::Write, t));
        }
        if !values.is_empty() {
            if !calls.is_empty() {
                calls.push(String::new());
            }
            calls.extend(fence("json", Some("create_record"), pretty(&json!({ "base": base.name, "table": table.name, "values": Value::Object(values) }))));
        }
    }
    if !calls.is_empty() {
        lines.push(String::new());
        lines.push(format!("#### {}", t.t("Arguments d’un appel")));
        lines.push(String::new());
        lines.extend(calls);
    }
    lines
}

fn no_token_for_you(t: &Say) -> Vec<String> {
    callout("NOTE", &[t.t("Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.")])
}

/// A documentation section: `{id, title, group, markdown}`.
pub struct DocSection {
    pub id: String,
    pub title: String,
    pub group: String,
    pub markdown: String,
}

impl DocSection {
    fn to_json(&self) -> Value {
        json!({ "id": self.id, "title": self.title, "group": self.group, "markdown": self.markdown })
    }
}

fn section(id: &str, title: String, group: String, lines: Vec<String>) -> DocSection {
    DocSection { id: id.into(), title, group, markdown: lines.join("\n") }
}

fn bullet(text: String) -> String {
    format!("- {text}")
}

fn agent_sections(base: &ProjectedBase, t: &Say) -> Vec<DocSection> {
    let hidden: Vec<String> = base
        .tables
        .iter()
        .flat_map(|table| table.fields.iter().filter(|f| f.hidden_from_agents).map(move |f| format!("{}.{}", table.name, f.name)))
        .collect();
    let mints_tokens = base.base_actions.contains(&Action::ManageTokens);
    let token = t.t("<jeton>");
    let environment = environment_example(base, t);
    let instance = format!("https://{}", t.t("votre-instance"));

    let mut connect: Vec<String> = vec![
        t.t("Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST."),
        String::new(),
    ];
    if !base.agents_enabled {
        connect.extend(callout("WARNING", &[t.t("**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.")]));
        connect.push(String::new());
    }
    connect.push(format!("### {}", t.t("Créer un jeton")));
    connect.push(String::new());
    if mints_tokens {
        connect.push(t.t("Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »)."));
    } else {
        connect.extend(no_token_for_you(t));
    }
    connect.push(String::new());
    connect.push(format!("### {}", t.t("Garder le jeton hors de la configuration")));
    connect.push(String::new());
    connect.push(t.t("Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session."));
    connect.push(String::new());
    connect.extend(fence("powershell", Some("Windows (PowerShell)"), vec![format!("[Environment]::SetEnvironmentVariable('BASEDB_TOKEN', '{token}', 'User')")]));
    connect.push(String::new());
    connect.extend(fence("bash", Some("macOS, Linux"), vec![format!("echo \"export BASEDB_TOKEN='{token}'\" >> ~/.profile")]));
    connect.push(String::new());
    connect.push(format!("### {}", t.t("Déclarer le serveur dans le client")));
    connect.push(String::new());
    connect.push(t.tv(
        "Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.",
        &[("header", &code(&format!("Authorization: Bearer {token}")))],
    ));
    connect.push(String::new());
    let mut servers = Map::new();
    servers.insert("basedb".into(), json!({ "type": "http", "url": format!("{instance}/mcp"), "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" } }));
    servers.insert(
        format!("basedb-{environment}"),
        json!({ "type": "http", "url": format!("{instance}/mcp?environment={}", encode_uri_component(&environment)), "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" } }),
    );
    connect.extend(fence("json", Some(".mcp.json"), pretty(&json!({ "mcpServers": Value::Object(servers) }))));
    connect.push(String::new());
    connect.push(format!("### {}", t.t("Client sans HTTP : le relais")));
    connect.push(String::new());
    connect.push(t.t("Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `mcp-relay.mjs`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`)."));
    connect.push(String::new());
    connect.extend(fence(
        "bash",
        Some("Claude Code"),
        vec![
            format!("claude mcp add basedb -- node {} --url \"{instance}/mcp\" --token-env BASEDB_TOKEN", relay(t)),
            format!("claude mcp add basedb-{environment} -- node {} --url \"{instance}/mcp\" --token-env BASEDB_TOKEN --environment {environment}", relay(t)),
        ],
    ));
    connect.push(String::new());
    let other = t.t("Autre client MCP");
    connect.extend(fence(
        "json",
        Some(&other),
        pretty(&json!({ "mcpServers": { "basedb": { "command": "node", "args": [relay(t), "--url", format!("{instance}/mcp"), "--token-env", "BASEDB_TOKEN"] } } })),
    ));
    connect.push(String::new());
    connect.push(t.t("Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement."));
    connect.push(String::new());
    connect.push(format!("### {}", t.t("Choisir l’environnement")));
    connect.push(String::new());
    connect.push(t.t("Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :"));
    connect.push(String::new());
    connect.push(bullet(t.tv(
        "**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.",
        &[("base", &code(&base.name))],
    )));
    connect.push(bullet(t.tv(
        "**L’adresse du serveur** : {address} — un serveur déclaré par environnement.",
        &[("address", &code(&format!("…/mcp?environment={environment}")))],
    )));
    connect.push(bullet(t.tv(
        "**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.",
        &[("example", &code(&format!("{{\"base\": \"…\", \"environment\": \"{environment}\"}}")))],
    )));
    connect.push(String::new());
    connect.push(t.t("Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`."));
    connect.push(String::new());
    connect.push(format!("### {}", t.t("Vérifier")));
    connect.push(String::new());
    connect.push(t.t("Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs."));

    let mut tools: Vec<String> = vec![
        t.tv(
            "{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.",
            &[("count", &DOCUMENTED_MCP_TOOLS.len().to_string())],
        ),
        String::new(),
    ];
    tools.extend(md_table(
        &[t.t("Outil"), t.t("Rôle"), t.t("Écrit")],
        &DOCUMENTED_MCP_TOOLS
            .iter()
            .map(|(name, summary, needs)| {
                vec![
                    code(name),
                    t.t(summary),
                    match needs {
                        ToolNeeds::Create | ToolNeeds::Update | ToolNeeds::Delete => t.t("oui"),
                        ToolNeeds::Propose => t.t("propose"),
                        _ => t.t("non"),
                    },
                ]
            })
            .collect::<Vec<_>>(),
    ));
    tools.push(String::new());
    tools.push(format!("### {}", t.t("Enchaînement type")));
    tools.push(String::new());
    for sentence in [
        "`list_bases`, puis `describe_base` : ce qui existe.",
        "`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: \"write\"`).",
        "`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.",
        "Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.",
        "Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.",
        "Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.",
        "Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.",
    ] {
        tools.push(bullet(t.t(sentence)));
    }
    tools.push(String::new());
    tools.push(format!("### {}", t.t("Propositions de structure")));
    tools.push(String::new());
    tools.push(t.t("Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification."));
    tools.push(String::new());
    tools.push(bullet(t.t("Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).")));
    tools.push(bullet(t.t("Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).")));
    tools.push(String::new());
    tools.push(format!("### {}", t.t("Couleurs et pictogrammes")));
    tools.push(String::new());
    tools.push(t.t("Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle."));
    tools.push(String::new());
    tools.push(format!("### {}", t.t("Ce qui n’existe pas")));
    tools.push(String::new());
    tools.push(t.t("Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée."));
    tools.push(String::new());
    tools.push(format!("### {}", t.t("Bornes")));
    tools.push(String::new());
    for sentence in [
        "`limit` : 25 lignes par défaut, 100 au plus.",
        "Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.",
        "Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.",
        "Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.",
    ] {
        tools.push(bullet(t.t(sentence)));
    }

    let scope: Vec<String> = vec![
        t.t("Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins."),
        String::new(),
        bullet(t.t("**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.")),
        bullet(t.t("**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).")),
        bullet(if base.agents_enabled { t.t("**Cette base** : ouverte aux agents.") } else { t.t("**Cette base** : **fermée aux agents** — aucun outil ne la voit.") }),
        bullet(if hidden.is_empty() {
            t.t("**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.")
        } else {
            t.tv(
                "**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.",
                &[("columns", &hidden.iter().map(|n| code(n)).collect::<Vec<_>>().join(", "))],
            )
        }),
        bullet(t.t("**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.")),
        bullet(t.t("**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.")),
    ];

    vec![
        section("mcp-connexion", t.t("Connecter un agent"), t.t(GROUP_MCP), connect),
        section("mcp-outils", t.t("Outils"), t.t(GROUP_MCP), tools),
        section("mcp-perimetre", t.t("Ce que voit un agent"), t.t(GROUP_MCP), scope),
    ]
}

// ── A table ───────────────────────────────────────────────────────────────────────────

fn type_cell(field: &ProjectedField, t: &Say) -> String {
    let mut marks: Vec<String> = Vec::new();
    if field.required {
        marks.push(t.t("obligatoire"));
    }
    if field.ai {
        marks.push(t.t("calculé par l’IA"));
    } else if field.read_only && !field.system {
        marks.push(t.t("lecture seule"));
    }
    if field.unsafe_html {
        marks.push(t.t("HTML riche — **à assainir à l’affichage**"));
    }
    if field.hidden_from_agents {
        marks.push(t.t("invisible pour les agents"));
    }
    let mut kind = match type_label(&field.kind) {
        Some(label) => t.t(label),
        None => field.kind.clone(),
    };
    if let Some(target) = field.link.as_ref().and_then(|l| l.target.as_ref()) {
        kind = t.tv("relation → {table}", &[("table", &code(&target.table))]);
    }
    let mut parts = vec![kind];
    parts.extend(marks);
    parts.join(" · ")
}

fn description_cell(field: &ProjectedField, t: &Say) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(d) = &field.description {
        parts.push(inline(d));
    }
    if let Some(options) = field.options.as_ref().filter(|o| !o.is_empty()) {
        parts.push(t.tv("Valeurs : {values}.", &[("values", &options.iter().map(|o| literal(&o.value)).collect::<Vec<_>>().join(", "))]));
    }
    if parts.is_empty() {
        "—".into()
    } else {
        parts.join(" ")
    }
}

fn describe_link(field: &ProjectedField, t: &Say) -> Vec<String> {
    let Some(link) = &field.link else { return vec![] };
    let target = match &link.target {
        None => t.tv("cible non visible pour vous : la cellule vaut toujours {cell}", &[("cell", &code("{\"id\":null,\"display\":null,\"masked\":true}"))]),
        Some(target) => match &target.display_field {
            None => t.tv(
                "pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)",
                &[("table", &code(&target.table))],
            ),
            Some(display) => t.tv("pointe vers {table}, affiché par {field}", &[("table", &code(&target.table)), ("field", &code(display))]),
        },
    };
    let on_delete = match link.on_delete.as_str() {
        "restrict" => t.t("à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée"),
        "set_null" => t.t("à la suppression : supprimer la ligne cible vide cette cellule"),
        _ => t.t("à la suppression : supprimer la ligne cible supprime aussi cette ligne"),
    };
    vec![
        format!("- **{}** — {target}", code(&field.name)),
        format!("  - {on_delete}"),
        format!("  - {}", t.t("en écriture, acceptez un `uuid` nu, `null`, ou `{\"id\": \"…\"}` ; en lecture, toujours `{\"id\": …, \"display\": …}`")),
    ]
}

fn endpoints(base: &ProjectedBase, table: &ProjectedTable, tenant: &str, t: &Say) -> Vec<String> {
    let root = format!("/api/v1/{tenant}/data/{}/{}", base.name, table.name);
    let has = |a: Action| table.actions.contains(&a);
    let mut rows: Vec<Vec<String>> = Vec::new();
    if has(Action::Read) {
        rows.push(vec![code("GET"), code(&root), t.t("Lister les lignes — filtre, tri, pagination par curseur")]);
        rows.push(vec![code("GET"), code(&format!("{root}/{{id}}")), t.t("Lire une ligne")]);
    }
    if has(Action::Create) {
        rows.push(vec![code("POST"), code(&root), t.t("Créer une ligne")]);
    }
    if has(Action::Update) {
        rows.push(vec![code("PATCH"), code(&format!("{root}/{{id}}")), t.t("Modifier une ligne")]);
    }
    if has(Action::Delete) {
        rows.push(vec![code("DELETE"), code(&format!("{root}/{{id}}")), t.t("Supprimer une ligne")]);
    }
    if table.referenced_by && has(Action::Read) {
        rows.push(vec![code("GET"), code(&format!("{root}/{{id}}/referenced_by")), t.t("Lister les lignes qui pointent vers celle-ci")]);
    }
    md_table(&[t.t("Méthode"), t.t("Chemin"), t.t("Rôle")], &rows)
}

fn verb(action: Action) -> Option<&'static str> {
    match action {
        Action::Read => Some("lire"),
        Action::Create => Some("créer"),
        Action::Update => Some("modifier"),
        Action::Delete => Some("supprimer"),
        _ => None,
    }
}

fn describe_table(base: &ProjectedBase, table: &ProjectedTable, tenant: &str, t: &Say) -> DocSection {
    let allowed = table
        .actions
        .iter()
        .map(|a| format!("**{}**", verb(*a).map(|v| t.t(v)).unwrap_or_else(|| a.as_str().to_string())))
        .collect::<Vec<_>>()
        .join(", ");
    let expandable: Vec<&str> = table.fields.iter().filter(|f| f.link.as_ref().is_some_and(|l| l.expandable)).map(|f| f.name.as_str()).collect();
    let business: Vec<&ProjectedField> = table.fields.iter().filter(|f| !f.system).collect();
    let links: Vec<&ProjectedField> = business.iter().copied().filter(|f| f.link.is_some()).collect();

    let mut lines: Vec<String> = Vec::new();
    if let Some(d) = &table.description {
        lines.push(paragraph(d));
        lines.push(String::new());
    }
    lines.push(t.tv("**En SQL :** {sql}", &[("sql", &code(&table.sql))]));
    lines.push(String::new());
    lines.push(t.tv(
        "Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.",
        &[("verbs", &allowed)],
    ));
    lines.push(String::new());
    lines.push(format!("### {}", t.t("Points d’accès")));
    lines.push(String::new());
    lines.extend(endpoints(base, table, tenant, t));
    lines.push(String::new());
    lines.push(format!("### {}", t.t("Colonnes")));
    lines.push(String::new());
    lines.extend(md_table(
        &[t.t("Colonne"), t.t("Libellé"), t.t("Type"), t.t("Description")],
        &business.iter().map(|f| vec![code(&f.name), inline(&f.label), type_cell(f, t), description_cell(f, t)]).collect::<Vec<_>>(),
    ));
    if !links.is_empty() {
        lines.push(String::new());
        lines.push(format!("### {}", t.t("Champs relation")));
        lines.push(String::new());
        lines.extend(links.iter().flat_map(|f| describe_link(f, t)));
    }
    lines.push(String::new());
    lines.push(format!("### {}", t.t("Colonnes système")));
    lines.push(String::new());
    lines.push(t.t("Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque."));
    lines.push(String::new());
    lines.extend(md_table(
        &[t.t("Colonne"), t.t("Type"), t.t("Description")],
        &table.fields.iter().filter(|f| f.system).map(|f| vec![code(&f.name), type_cell(f, t), description_cell(f, t)]).collect::<Vec<_>>(),
    ));
    if !expandable.is_empty() {
        lines.push(String::new());
        lines.push(format!("### {}", t.t("Expansion")));
        lines.push(String::new());
        lines.push(t.tv(
            "{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.",
            &[("expand", &code(&format!("?expand={}", expandable.join(","))))],
        ));
    }
    if table.referenced_by {
        lines.push(String::new());
        lines.push(format!("### {}", t.t("Lignes référençantes")));
        lines.push(String::new());
        lines.push(t.tv(
            "{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.",
            &[("route", &code(&format!("GET /api/v1/{tenant}/data/{}/{}/{{id}}/referenced_by", base.name, table.name)))],
        ));
    }
    let shown = examples(base, table, tenant, t);
    if !shown.is_empty() {
        lines.push(String::new());
        lines.extend(shown);
    }
    lines.push(String::new());
    lines.extend(agent_usage(base, table, t));

    DocSection { id: table.name.clone(), title: escape_label(&table.label), group: t.t(GROUP_TABLES), markdown: js_trim_end(&lines.join("\n")).to_string() }
}

// ── The whole base ────────────────────────────────────────────────────────────────────

/// `toDocumentation`: `{title, sections}`, in `language` (French when unknown).
pub fn to_documentation(base: &ProjectedBase, tenant: &str, language: &str) -> Value {
    let t = Say::new(language);
    let t = &t;
    let prefix = format!("/api/v1/{tenant}");
    let token = t.t("<jeton>");

    let relations: Vec<String> = base
        .tables
        .iter()
        .flat_map(|table| {
            table.fields.iter().filter(|f| f.link.is_some()).map(move |f| match f.link.as_ref().and_then(|l| l.target.as_ref()) {
                None => format!("- `{}.{}` → {}", table.name, f.name, t.t("une table que vous ne voyez pas")),
                Some(target) => format!("- `{}.{}` → `{}`", table.name, f.name, target.table),
            })
        })
        .collect();

    let envelope = code("{ \"data\": …, \"included\": {…}, \"meta\": {…} }");

    let mut overview: Vec<String> = Vec::new();
    if let Some(d) = &base.description {
        overview.push(paragraph(d));
        overview.push(String::new());
    }
    overview.push(t.tv(
        "Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.",
        &[("name", &code(&base.name))],
    ));
    overview.push(String::new());
    overview.push(t.t("Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre."));
    overview.push(String::new());
    overview.extend(md_table(
        &[t.t("Élément"), t.t("Valeur")],
        &[
            vec![t.t("Schéma PostgreSQL"), code(&base.name)],
            vec![t.t("Préfixe des routes REST"), code(&prefix)],
            vec![t.t("Agents (MCP)"), if base.agents_enabled { t.t("ouverte — voir « Connecter un agent »") } else { t.t("**fermée aux agents**") }],
            vec![t.t("Tables visibles"), base.tables.len().to_string()],
            vec![t.t("Format"), t.tv("JSON, dans une enveloppe {envelope}", &[("envelope", &envelope)])],
        ],
    ));
    overview.push(String::new());
    overview.extend(callout("WARNING", &[t.t("**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.")]));

    let mut authentication: Vec<String> = vec![
        t.t("Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque."),
        String::new(),
        format!("### {}", t.t("Jeton d’intégration")),
        String::new(),
        t.t("Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées."),
        String::new(),
    ];
    if base.base_actions.contains(&Action::ManageTokens) {
        authentication.push(t.t("Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois."));
    } else {
        authentication.extend(no_token_for_you(t));
    }
    authentication.push(String::new());
    authentication.push(format!("### {}", t.t("Appel")));
    authentication.push(String::new());
    authentication.extend(fence(
        "bash",
        Some("cURL"),
        vec![
            format!("export BASEDB_URL=\"https://{}\"", t.t("votre-instance")),
            format!("export BASEDB_TOKEN=\"{token}\""),
            String::new(),
            format!("curl \"$BASEDB_URL{prefix}/meta/bases\" \\"),
            "  -H \"Authorization: Bearer $BASEDB_TOKEN\"".into(),
        ],
    ));
    authentication.push(String::new());
    authentication.push(format!("### {}", t.t("Environnement")));
    authentication.push(String::new());
    authentication.push(t.tv(
        "Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.",
        &[("base", &code(&base.name)), ("header", &code(&format!("X-Basedb-Environment: {}", environment_example(base, t))))],
    ));
    authentication.push(String::new());
    authentication.extend(fence(
        "bash",
        Some("cURL"),
        vec![
            format!("curl \"$BASEDB_URL{prefix}/meta/bases/{}\" \\", base.name),
            "  -H \"Authorization: Bearer $BASEDB_TOKEN\" \\".into(),
            format!("  -H \"X-Basedb-Environment: {}\"", environment_example(base, t)),
        ],
    ));
    authentication.push(String::new());
    authentication.extend(callout("NOTE", &[t.t("Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.")]));

    let conventions: Vec<String> = vec![
        format!("### {}", t.t("Enveloppe")),
        String::new(),
        t.tv(
            "Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.",
            &[("envelope", &envelope)],
        ),
        String::new(),
        format!("### {}", t.t("Nombres")),
        String::new(),
        t.tv(
            "**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.",
            &[("example", &code(&format!("{{\"{}\":\"1240.00\"}}", t.t("montant"))))],
        ),
        String::new(),
        format!("### {}", t.t("Ressource invisible")),
        String::new(),
        t.t("**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe."),
        String::new(),
        format!("### {}", t.t("Pagination")),
        String::new(),
        t.t("**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export."),
        String::new(),
        format!("### {}", t.t("Identifiants seuls")),
        String::new(),
        t.t("Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL."),
    ];

    let relations_markdown = if relations.is_empty() {
        t.t("Aucune relation visible dans cette base.")
    } else {
        let mut lines = vec![
            t.t("Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles."),
            String::new(),
        ];
        lines.extend(relations);
        lines.join("\n")
    };

    let mut responses: Vec<String> = vec!["### API REST".into(), String::new()];
    responses.extend(md_table(
        &[t.t("Statut"), t.t("Signification")],
        &[
            vec![code("200"), t.t("Succès.")],
            vec![code("201"), t.t("Ligne créée.")],
            vec![code("204"), t.t("Suppression réussie, sans contenu.")],
            vec![code("401"), t.t("Authentification absente ou refusée.")],
            vec![code("404"), t.t("Ressource inexistante **ou** invisible — les deux réponses sont identiques.")],
            vec![code("409"), t.t("Suppression refusée : la ligne est encore référencée.")],
            vec![code("422"), t.t("Valeur refusée par la validation.")],
        ],
    ));
    responses.push(String::new());
    responses.push(t.t("Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :"));
    responses.push(String::new());
    responses.extend(fence(
        "json",
        None,
        vec!["{".into(), "  \"code\": \"VALIDATION_FAILED\",".into(), "  \"details\": {},".into(), format!("  \"request_id\": \"{EXAMPLE_ID}\""), "}".into()],
    ));
    responses.push(String::new());
    responses.push(t.tv("La liste complète des codes est servie par {route}.", &[("route", &code("GET /api/v1/codes"))]));
    responses.push(String::new());
    responses.push(format!("### {}", t.t("Côté MCP")));
    responses.push(String::new());
    responses.push(t.t("Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel."));
    responses.push(String::new());
    responses.extend(fence(
        "json",
        None,
        s(&[
            "{",
            "  \"code\": \"FIELD_NOT_WRITABLE\",",
            "  \"message\": \"Ce champ n’est pas modifiable par cette surface.\",",
            "  \"invalid_params\": [\"values.total\"],",
            "  \"hint\": \"Les colonnes système et les champs formule ne se modifient jamais ; voir access dans describe_table.\",",
            "  \"retryable\": false",
            "}",
        ]),
    ));

    let mut sql: Vec<String> = vec![t.t("Ouvrez `psql` : ça marche, c’est le but du produit."), String::new()];
    sql.extend(fence("sql", None, vec![format!("SELECT * FROM \"{}\".\"<table>\" LIMIT 10;", base.name)]));
    sql.push(String::new());
    sql.push(t.t("Ce qui vous attend :"));
    sql.push(String::new());
    sql.push(bullet(t.t("Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.")));
    sql.push(bullet(t.t("Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.")));
    sql.push(String::new());
    sql.extend(callout("IMPORTANT", &[t.t("**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.")]));

    let mut sections = vec![
        section("lire-cette-base", t.t("Vue d’ensemble"), t.t(GROUP_START), overview),
        section("api-authentification", t.t("Authentification"), t.t(GROUP_API), authentication),
        section("api-conventions", t.t("Conventions"), t.t(GROUP_API), conventions),
    ];
    sections.extend(agent_sections(base, t));
    sections.extend(base.tables.iter().map(|table| describe_table(base, table, tenant, t)));
    sections.push(DocSection { id: "api-relations".into(), title: t.t("Relations"), group: t.t(GROUP_REFERENCE), markdown: relations_markdown });
    sections.push(section("codes-de-reponse", t.t("Codes de réponse"), t.t(GROUP_REFERENCE), responses));
    sections.push(section("ecrire-en-sql", t.t("Écrire en SQL direct"), t.t(GROUP_REFERENCE), sql));

    json!({
        "title": t.tv("{base} — documentation API et MCP", &[("base", &escape_label(&base.label))]),
        "sections": sections.iter().map(DocSection::to_json).collect::<Vec<_>>(),
    })
}

#[cfg(test)]
mod tests;
