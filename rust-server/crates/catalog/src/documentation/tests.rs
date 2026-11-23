//! `test/unit/documentation.test.ts` and `documentation-texts.test.ts`, on hand-built projections.

use super::*;
use crate::description::system_column_description;
use crate::projection::{BaseEnvironment, LinkTarget, ProjectRef, ProjectedLink, ProjectedOption};
use basedb_base::rbac::decide::SYSTEM_COLUMNS;

const TENANT: &str = "t4z56fq";

fn system() -> Vec<ProjectedField> {
    SYSTEM_COLUMNS
        .iter()
        .map(|name| ProjectedField {
            description: system_column_description(name).map(String::from),
            kind: "system".into(),
            read_only: true,
            system: true,
            ..field(name)
        })
        .collect()
}

fn field(name: &str) -> ProjectedField {
    ProjectedField {
        name: name.into(),
        label: name.into(),
        description: None,
        kind: "short_text".into(),
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
    }
}

fn table(name: &str) -> ProjectedTable {
    ProjectedTable {
        id: format!("id-{name}"),
        name: name.into(),
        label: name.into(),
        description: None,
        sql: format!("\"b_{TENANT}_crm\".\"{name}\""),
        actions: vec![Action::Read, Action::Create, Action::Update, Action::Delete],
        fields: system(),
        referenced_by: false,
        display_field: None,
        color: None,
        icon: None,
        image: None,
        synced: false,
    }
}

fn with_fields(mut t: ProjectedTable, fields: Vec<ProjectedField>) -> ProjectedTable {
    t.fields.extend(fields);
    t
}

fn base(tables: Vec<ProjectedTable>) -> ProjectedBase {
    ProjectedBase {
        id: "base-1".into(),
        name: format!("b_{TENANT}_crm"),
        label: "CRM".into(),
        description: None,
        project: ProjectRef { id: "project-1".into(), label: "Commercial".into() },
        base_actions: vec![Action::Read, Action::Create, Action::Update, Action::Delete, Action::ManageSchema, Action::ManageTokens],
        agents_enabled: true,
        tables,
        color: None,
        icon: None,
        image: None,
        environment: BaseEnvironment { lineage: "base-1".into(), label: "Production".into(), production: true, position: 0 },
    }
}

fn sections(doc: &Value) -> &Vec<Value> {
    doc["sections"].as_array().unwrap()
}

fn md(doc: &Value, id: &str) -> String {
    sections(doc).iter().find(|s| s["id"] == id).map(|s| s["markdown"].as_str().unwrap().to_string()).unwrap_or_default()
}

fn doc_fr(b: &ProjectedBase) -> Value {
    to_documentation(b, TENANT, "fr")
}

#[test]
fn files_every_section_under_a_group_in_sidebar_order() {
    let doc = doc_fr(&base(vec![table("factures"), table("clients")]));
    let mut groups: Vec<&str> = Vec::new();
    for s in sections(&doc) {
        let g = s["group"].as_str().unwrap();
        if !groups.contains(&g) {
            groups.push(g);
        }
    }
    assert_eq!(groups, ["Prise en main", "API REST", "Agents (MCP)", "Tables", "Référence"]);
    let tables: Vec<&str> = sections(&doc).iter().filter(|s| s["group"] == "Tables").map(|s| s["id"].as_str().unwrap()).collect();
    assert_eq!(tables, ["factures", "clients"]);
    let ids: Vec<&str> = sections(&doc).iter().map(|s| s["id"].as_str().unwrap()).collect();
    for id in ["lire-cette-base", "api-authentification", "api-conventions", "api-relations", "codes-de-reponse", "ecrire-en-sql", "mcp-connexion", "mcp-outils", "mcp-perimetre"] {
        assert!(ids.contains(&id), "{id}");
    }
    assert!(md(&doc, "lire-cette-base").contains("> [!WARNING]"));
    assert!(md(&doc, "lire-cette-base").contains("ce que VOUS pouvez voir"));
    assert!(md(&doc, "ecrire-en-sql").contains("> [!IMPORTANT]"));
    assert!(md(&doc, "ecrire-en-sql").contains("ne s’appliquent pas en SQL direct"));
}

fn invoices() -> ProjectedTable {
    let mut t = table("factures");
    t.label = "Factures".into();
    t.description = Some("Factures émises aux clients.".into());
    with_fields(
        t,
        vec![
            ProjectedField { label: "Numéro".into(), required: true, description: Some("Numéro unique.".into()), ..field("numero") },
            ProjectedField { label: "Montant".into(), kind: "number".into(), ..field("montant") },
        ],
    )
}

#[test]
fn a_table_section() {
    let m = md(&doc_fr(&base(vec![invoices()])), "factures");
    assert_eq!(m.split('\n').next().unwrap(), "Factures émises aux clients.");
    assert!(m.contains(&format!("**En SQL :** `\"b_{TENANT}_crm\".\"factures\"`")));
    assert!(m.contains("| `GET` | `/api/v1/t4z56fq/data/b_t4z56fq_crm/factures` |"));
    assert!(m.contains("| `DELETE` | `/api/v1/t4z56fq/data/b_t4z56fq_crm/factures/{id}` |"));
    assert!(m.contains("| Colonne | Libellé | Type | Description |"));
    assert!(m.contains("| `numero` | Numéro | texte · obligatoire | Numéro unique. |"));
    assert!(m.contains("| `montant` | Montant | nombre (chaîne décimale) | — |"));
    assert!(m.contains("| `_id` | colonne système |"));
    assert!(m.contains("UUID v7"));
    assert!(m.contains("```bash title=\"cURL\""));
    assert!(m.contains("```js title=\"JavaScript\""));
    assert!(m.contains("curl \"$BASEDB_URL/api/v1/t4z56fq/data/b_t4z56fq_crm/factures?limit=20\""));
    assert!(m.contains("\"montant\":\"1240.00\""));

    let mut read_only = table("factures");
    read_only.actions = vec![Action::Read];
    let r = md(&doc_fr(&base(vec![read_only])), "factures");
    assert!(r.contains("| `GET` |"));
    for absent in ["| `POST` |", "| `PATCH` |", "| `DELETE` |", "-X POST"] {
        assert!(!r.contains(absent), "{absent}");
    }
}

#[test]
fn leaves_read_only_and_computed_columns_out_of_the_creation_example() {
    let t = with_fields(table("factures"), vec![ProjectedField { kind: "formula".into(), read_only: true, ..field("total") }, field("numero")]);
    let m = md(&doc_fr(&base(vec![t])), "factures");
    let creation = m.split("#### Créer une ligne").nth(1).unwrap_or("");
    assert!(creation.contains("-d '{\"values\":{\"numero\":\"Exemple\"}}'"));
    assert!(!creation.contains("\"total\""));
}

#[test]
fn says_nothing_of_an_invisible_target() {
    let link = ProjectedLink { on_delete: "restrict".into(), required: false, target: None, expandable: false, masked: true };
    let t = with_fields(table("factures"), vec![ProjectedField { label: "Client".into(), kind: "link".into(), link: Some(link), ..field("clients_id") }]);
    let doc = doc_fr(&base(vec![t]));
    let json = serde_json::to_string(&doc).unwrap();
    assert!(json.contains("clients_id"));
    assert!(md(&doc, "api-relations").contains("→ une table que vous ne voyez pas"));
    assert!(md(&doc, "factures").contains("\"masked\":true"));
    assert!(!json.contains("`clients`"));
    assert!(!md(&doc, "factures").contains("### Expansion"));
}

#[test]
fn a_description_is_inert() {
    let mut t1 = table("t1");
    t1.description = Some("- une puce".into());
    let mut t2 = table("t2");
    t2.description = Some("1. un numéro".into());
    let doc = doc_fr(&base(vec![t1, t2]));
    assert_eq!(md(&doc, "t1").split('\n').next().unwrap(), "\\- une puce");
    assert_eq!(md(&doc, "t2").split('\n').next().unwrap(), "1\\. un numéro");

    let mut t1 = table("t1");
    t1.description = Some("Première ligne.\n\n# Titre\n\n```\ncode\n```".into());
    let doc = doc_fr(&base(vec![t1]));
    let m = md(&doc, "t1");
    let mut lines = m.split('\n');
    let lede = lines.next().unwrap();
    assert!(lede.contains("\\# Titre"));
    assert!(lede.contains("\\`\\`\\`"));
    assert_eq!(lines.next().unwrap(), "");

    let option = ProjectedOption { value: "x'; DROP TABLE t; --`".into(), label: "Piège".into(), color: None, icon: None, image: None };
    let t1 = with_fields(table("t1"), vec![ProjectedField { kind: "select".into(), options: Some(vec![option]), ..field("statut") }]);
    let m = md(&doc_fr(&base(vec![t1])), "t1");
    assert!(!m.contains("x'; DROP"));
    assert!(m.contains("\"statut\":\"valeur\""));
}

#[test]
fn the_base_description_opens_the_overview() {
    let mut b = base(vec![table("factures")]);
    b.description = Some("Le suivi commercial.".into());
    assert_eq!(md(&doc_fr(&b), "lire-cette-base").split('\n').next().unwrap(), "Le suivi commercial.");
    assert!(md(&doc_fr(&base(vec![table("factures")])), "lire-cette-base").starts_with("Cette base s’appelle"));
}

#[test]
fn section_identifiers_cannot_be_shadowed() {
    let doc = doc_fr(&base(["relations", "conventions", "authentification", "lire", "ecrire"].iter().map(|n| table(n)).collect()));
    let ids: Vec<&str> = sections(&doc).iter().map(|s| s["id"].as_str().unwrap()).collect();
    let unique: std::collections::HashSet<&&str> = ids.iter().collect();
    assert_eq!(unique.len(), ids.len());
    let guide = doc_fr(&base(vec![]));
    for s in sections(&guide).iter().filter(|s| s["group"] != "Tables") {
        assert!(s["id"].as_str().unwrap().contains('-'));
    }
}

fn agent_invoices() -> ProjectedTable {
    let mut t = with_fields(
        table("factures"),
        vec![
            ProjectedField { label: "Numéro".into(), ..field("numero") },
            ProjectedField { label: "Montant".into(), kind: "number".into(), ..field("montant") },
            ProjectedField { label: "Marge".into(), kind: "number".into(), hidden_from_agents: true, ..field("marge") },
            ProjectedField { kind: "formula".into(), read_only: true, ..field("total") },
        ],
    );
    t.display_field = Some("numero".into());
    t
}

#[test]
fn the_agent_surface() {
    let doc = doc_fr(&base(vec![agent_invoices()]));
    let m = md(&doc, "factures");
    let agent = m.split("### Depuis un agent (MCP)").nth(1).unwrap_or("").to_string();
    for tool in ["describe_table", "list_records", "get_record", "create_record", "lookup_records", "delete_record", "restore_record"] {
        assert!(agent.contains(&format!("| `{tool}` |")), "{tool}");
    }
    assert!(agent.contains("« Lecture, écriture et suppression »"));
    assert!(agent.contains("**Invisibles pour un agent :** `marge`"));
    assert!(m.contains("invisible pour les agents"));
    let creation = agent.split("title=\"create_record\"").nth(1).unwrap_or("");
    assert!(creation.contains("\"numero\": \"Exemple\""));
    assert!(!creation.contains("\"marge\""));
    assert!(!creation.contains("\"total\""));
    assert!(md(&doc, "mcp-perimetre").contains("`factures.marge`"));
    assert!(agent.contains("```json title=\"list_records\""));
    assert!(agent.contains(&format!("\"base\": \"b_{TENANT}_crm\"")));
    assert!(agent.contains("\"montant\": \"1240.00\""));

    let mut read_only = table("factures");
    read_only.actions = vec![Action::Read];
    let part = md(&doc_fr(&base(vec![read_only])), "factures").split("### Depuis un agent (MCP)").nth(1).unwrap_or("").to_string();
    assert!(part.contains("| `list_records` |"));
    for absent in ["create_record", "update_record", "lookup_records"] {
        assert!(!part.contains(absent), "{absent}");
    }

    let mut closed = base(vec![agent_invoices()]);
    closed.agents_enabled = false;
    let closed = doc_fr(&closed);
    assert!(md(&closed, "factures").contains("n’est pas ouverte aux agents"));
    assert!(!md(&closed, "factures").contains("title=\"list_records\""));
    assert!(md(&closed, "mcp-connexion").contains("> [!WARNING]"));
    assert!(md(&closed, "lire-cette-base").contains("fermée aux agents"));
}

#[test]
fn tokens_are_minted_by_who_may() {
    let connect = |actions: Vec<Action>| {
        let mut b = base(vec![agent_invoices()]);
        b.base_actions = actions;
        let doc = doc_fr(&b);
        (md(&doc, "mcp-connexion"), md(&doc, "api-authentification"))
    };
    assert!(connect(vec![Action::Read, Action::ManageTokens]).0.contains("**Jetons API et MCP…**"));
    let (mcp, auth) = connect(vec![Action::Read]);
    assert!(!mcp.contains("**Jetons API et MCP…**"));
    assert!(mcp.contains("Demandez-en un"));
    assert!(!auth.contains("**Jetons API et MCP…**"));

    let doc = doc_fr(&base(vec![agent_invoices()]));
    let c = md(&doc, "mcp-connexion");
    assert!(c.contains("SetEnvironmentVariable('BASEDB_TOKEN'"));
    assert!(c.contains("--token-env BASEDB_TOKEN"));
    assert!(c.contains("claude mcp add basedb"));
    assert!(!Regex::new("bdb_[a-z0-9]{8}_").unwrap().is_match(&c));
    let auth = md(&doc, "api-authentification");
    assert!(auth.contains("### Jeton d’intégration"));
    assert!(auth.contains("**ne supprime que s’il a été créé pour cela**"));
    assert!(auth.contains("**Jetons API et MCP…**"));

    let tools = md(&doc, "mcp-outils");
    assert!(tools.contains("| `create_record` | Créer une ligne. | oui |"));
    assert!(tools.split('\n').find(|l| l.starts_with("| `delete_record` |")).unwrap().ends_with("| oui |"));
    assert!(tools.contains("| `list_records` |"));
    assert!(tools.contains("MCP_OPERATION_EXCLUDED"));
}

#[test]
fn a_link_with_a_visible_target_is_described() {
    let link = ProjectedLink {
        on_delete: "set_null".into(),
        required: false,
        target: Some(LinkTarget { table: "clients".into(), display_field: Some("nom".into()) }),
        expandable: true,
        masked: false,
    };
    let t = with_fields(table("factures"), vec![ProjectedField { kind: "link".into(), link: Some(link), ..field("client") }]);
    let doc = doc_fr(&base(vec![t]));
    let m = md(&doc, "factures");
    assert!(m.contains("- **`client`** — pointe vers `clients`, affiché par `nom`"));
    assert!(m.contains("vide cette cellule"));
    assert!(m.contains("`?expand=client`"));
    assert!(md(&doc, "api-relations").contains("- `factures.client` → `clients`"));
}

// ── documentation-texts.test.ts ────────────────────────────────────────────────────────

#[test]
fn every_catalog_has_the_same_sentences_as_english() {
    let en = &CATALOGS["en"];
    for (locale, catalog) in CATALOGS.iter() {
        assert_eq!(catalog.len(), en.len(), "{locale}");
        for key in en.keys() {
            assert!(catalog.contains_key(key), "{locale}: {key}");
        }
    }
    assert_eq!(CATALOGS.len(), 19);
}

#[test]
fn every_translation_keeps_its_placeholders() {
    for (locale, catalog) in CATALOGS.iter() {
        for (french, translated) in catalog {
            let mut wanted: Vec<&str> = PLACEHOLDER.find_iter(french).map(|m| m.as_str()).collect();
            let mut got: Vec<&str> = PLACEHOLDER.find_iter(translated).map(|m| m.as_str()).collect();
            wanted.sort_unstable();
            got.sort_unstable();
            assert_eq!(wanted, got, "{locale}: {french}");
        }
    }
}

#[test]
fn a_reader_reads_their_language_and_french_fills_the_gaps() {
    let doc = to_documentation(&base(vec![invoices()]), TENANT, "en");
    let groups: Vec<&str> = sections(&doc).iter().map(|s| s["group"].as_str().unwrap()).collect();
    assert!(groups.contains(&"Getting started"));
    assert!(doc["title"].as_str().unwrap().starts_with("CRM"));
    let unknown = to_documentation(&base(vec![invoices()]), TENANT, "xx");
    assert_eq!(unknown, doc_fr(&base(vec![invoices()])));
    let say = Say::new("fr");
    assert_eq!(say.tv("{a} et {b} et {c}", &[("a", "{b}"), ("b", "2")]), "{b} et 2 et {c}");
}

#[test]
fn every_sentence_the_generator_says_is_in_the_catalogs() {
    // The French sentences of this module are the keys: one spelled differently from the
    // TypeScript would silently stay French in every other language.
    let source = include_str!("../documentation.rs");
    let en = &CATALOGS["en"];
    let quoted = Regex::new(r#"t\.tv?\(\s*"((?:[^"\\]|\\.)*)""#).unwrap();
    let mut missing = Vec::new();
    for c in quoted.captures_iter(source) {
        let text = c[1].replace("\\\"", "\"").replace("\\\\", "\\");
        if !en.contains_key(&text) {
            missing.push(text);
        }
    }
    for (_, summary, _) in DOCUMENTED_MCP_TOOLS {
        if !en.contains_key(*summary) {
            missing.push(summary.to_string());
        }
    }
    for kind in ["short_text", "long_text", "number", "boolean", "date", "datetime", "select", "multi_select", "link", "multi_link", "url", "email", "autonumber", "user", "formula", "file", "image", "system"] {
        let label = type_label(kind).unwrap();
        if !en.contains_key(label) {
            missing.push(label.to_string());
        }
    }
    assert!(missing.is_empty(), "{missing:#?}");
}
