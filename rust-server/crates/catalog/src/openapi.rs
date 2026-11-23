//! The OpenAPI 3.1 serialization of the projection (`catalog/openapi.ts`).
//!
//! What THIS reader may do, nothing more: two readers get two contracts.

use crate::labels::escape_label;
use crate::projection::{ProjectedBase, ProjectedField, ProjectedTable};
use basedb_base::rbac::decide::Action;
use serde_json::{json, Map, Value};

/// `MAX_FILES_PER_VALUE` (`ddl/emit.ts`).
pub const MAX_FILES_PER_VALUE: usize = 20;

const UNSORTED: [&str; 7] = ["link", "multi_link", "long_text", "multi_select", "file", "image", "button"];

/// `schemaName`: `lignes_factures` → `LignesFactures`.
pub fn schema_name(name: &str) -> String {
    name.split('_')
        .filter(|p| !p.is_empty())
        .map(|p| {
            let mut chars = p.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect()
}

fn obj(v: Value) -> Map<String, Value> {
    match v {
        Value::Object(m) => m,
        _ => Map::new(),
    }
}

/// `{...a, ...b}`: a key already there keeps its place and takes the new value.
fn spread(a: &mut Map<String, Value>, b: Map<String, Value>) {
    for (k, v) in b {
        a.insert(k, v);
    }
}

fn link_read_schema(field: &ProjectedField) -> Map<String, Value> {
    let masked = field.link.as_ref().is_some_and(|l| l.masked);
    let mut schema = obj(json!({
        "type": "object",
        "properties": {
            "id": if masked { json!({ "type": "null" }) } else { json!({ "type": ["string", "null"], "format": "uuid" }) },
            "display": { "type": ["string", "null"] },
            "masked": { "type": "boolean" },
        },
        "required": ["id", "display"],
    }));
    if let Some(link) = &field.link {
        let value = match &link.target {
            None => json!({ "on_delete": link.on_delete, "is_required": link.required }),
            Some(t) => json!({
                "target_table": t.table,
                "target_display_field": t.display_field,
                "on_delete": link.on_delete,
                "is_required": link.required,
                "target_schema": { "$ref": format!("#/components/schemas/{}Read", schema_name(&t.table)) },
            }),
        };
        schema.insert("x-basedb-link".into(), value);
    }
    schema
}

fn scalar_schema(field: &ProjectedField) -> Map<String, Value> {
    let nullable = !field.required;
    let of = |t: &str, format: Option<&str>| {
        let mut m = Map::new();
        m.insert("type".into(), if nullable { json!([t, "null"]) } else { json!(t) });
        if let Some(f) = format {
            m.insert("format".into(), json!(f));
        }
        m
    };
    let with = |mut m: Map<String, Value>, k: &str, v: Value| {
        m.insert(k.into(), v);
        m
    };
    match field.kind.as_str() {
        "number" => of("string", Some("decimal")),
        "boolean" => of("boolean", None),
        "date" => of("string", Some("date")),
        "url" => with(of("string", Some("uri")), "maxLength", json!(2048)),
        "email" => with(of("string", Some("email")), "maxLength", json!(254)),
        "autonumber" => with(of("string", Some("int64")), "readOnly", json!(true)),
        "user" => of("string", Some("uuid")),
        "datetime" => of("string", Some("date-time")),
        "system" => {
            if field.name == "_id" || field.name.ends_with("_by") {
                obj(json!({ "type": "string", "format": "uuid" }))
            } else {
                obj(json!({ "type": "string", "format": "date-time" }))
            }
        }
        "formula" => Map::new(),
        "multi_select" => {
            let mut items = obj(json!({ "type": "string" }));
            if let Some(options) = &field.options {
                items.insert("enum".into(), json!(options.iter().map(|o| o.value.clone()).collect::<Vec<_>>()));
            }
            obj(json!({
                "type": if nullable { json!(["array", "null"]) } else { json!("array") },
                "items": items,
                "minItems": 1,
                "uniqueItems": true,
            }))
        }
        "file" | "image" => obj(json!({
            "type": if nullable { json!(["array", "null"]) } else { json!("array") },
            "items": {
                "type": "object",
                "required": ["id"],
                "properties": {
                    "id": { "type": "string", "format": "uuid" },
                    "name": { "type": "string", "readOnly": true },
                    "type": { "type": "string", "readOnly": true },
                    "size": { "type": "integer", "readOnly": true },
                    "url": { "type": "string", "readOnly": true },
                },
            },
            "minItems": 1,
            "maxItems": MAX_FILES_PER_VALUE,
        })),
        _ => of("string", None),
    }
}

fn describe(description: Option<&str>) -> Map<String, Value> {
    let mut m = Map::new();
    if let Some(d) = description {
        m.insert("description".into(), json!(escape_label(d)));
    }
    m
}

fn field_schema(field: &ProjectedField) -> Map<String, Value> {
    let mut schema = match field.kind.as_str() {
        "link" => link_read_schema(field),
        "multi_link" => obj(json!({ "type": ["array", "null"], "items": link_read_schema(field) })),
        _ => scalar_schema(field),
    };
    spread(&mut schema, describe(field.description.as_deref()));
    if let (Some(options), false) = (&field.options, field.kind == "multi_select") {
        schema.insert("enum".into(), json!(options.iter().map(|o| o.value.clone()).collect::<Vec<_>>()));
    }
    schema.insert("title".into(), json!(escape_label(&field.label)));
    if field.read_only {
        schema.insert("readOnly".into(), json!(true));
    }
    if field.unsafe_html {
        schema.insert("format".into(), json!("html"));
        schema.insert("x-basedb-unsafe-html".into(), json!(true));
    }
    schema
}

fn read_schema(table: &ProjectedTable) -> Value {
    let mut properties = Map::new();
    for f in &table.fields {
        properties.insert(f.name.clone(), Value::Object(field_schema(f)));
    }
    let mut m = obj(json!({ "type": "object", "title": escape_label(&table.label) }));
    spread(&mut m, describe(table.description.as_deref()));
    m.insert("properties".into(), Value::Object(properties));
    Value::Object(m)
}

fn write_schema(table: &ProjectedTable) -> Value {
    let mut properties = Map::new();
    let mut required = Vec::new();
    for f in &table.fields {
        if f.read_only {
            continue;
        }
        let schema = match f.kind.as_str() {
            "link" => {
                let mut m = obj(json!({ "title": escape_label(&f.label) }));
                spread(&mut m, describe(f.description.as_deref()));
                m.insert(
                    "oneOf".into(),
                    json!([
                        { "type": "string", "format": "uuid" },
                        { "type": "null" },
                        { "type": "object", "properties": { "id": { "type": ["string", "null"], "format": "uuid" } } },
                    ]),
                );
                m
            }
            "multi_link" => {
                let mut m = obj(json!({ "title": escape_label(&f.label) }));
                spread(&mut m, describe(f.description.as_deref()));
                m.insert(
                    "oneOf".into(),
                    json!([
                        {
                            "type": "array",
                            "items": { "oneOf": [
                                { "type": "string", "format": "uuid" },
                                { "type": "object", "properties": { "id": { "type": "string", "format": "uuid" } } },
                            ] },
                        },
                        { "type": "string", "format": "uuid" },
                        { "type": "null" },
                    ]),
                );
                m
            }
            _ => field_schema(f),
        };
        properties.insert(f.name.clone(), Value::Object(schema));
        if f.required {
            required.push(f.name.clone());
        }
    }
    let mut m = obj(json!({ "type": "object", "title": format!("{} (écriture)", escape_label(&table.label)) }));
    spread(&mut m, describe(table.description.as_deref()));
    m.insert("properties".into(), Value::Object(properties));
    if !required.is_empty() {
        m.insert("required".into(), json!(required));
    }
    Value::Object(m)
}

fn list_response(table: &ProjectedTable, expandable: &[String]) -> Value {
    let name = schema_name(&table.name);
    let mut properties = obj(json!({ "data": { "type": "array", "items": { "$ref": format!("#/components/schemas/{name}Read") } } }));
    if !expandable.is_empty() {
        properties.insert(
            "included".into(),
            json!({
                "type": "object",
                "description": "Objets liés, indexés par nom de table puis par identifiant. Un objet y figure une seule fois, quel que soit le nombre de lignes qui le référencent.",
            }),
        );
    }
    properties.insert(
        "meta".into(),
        json!({ "type": "object", "properties": { "columns": { "type": "array", "items": { "type": "string" } }, "has_next_page": { "type": "boolean" } } }),
    );
    json!({ "type": "object", "properties": properties })
}

fn error_response() -> Value {
    json!({ "type": "object", "properties": { "code": { "type": "string" }, "details": { "type": "object" }, "request_id": { "type": "string" } } })
}

fn error_content() -> Value {
    json!({ "application/json": { "schema": error_response() } })
}

/// `{...given, ...commonResponses()}` — key order is settled by [`crate::js::js_order`].
fn responses(mut given: Map<String, Value>) -> Value {
    given.insert("401".into(), json!({ "description": "Authentification absente ou refusée.", "content": error_content() }));
    given.insert(
        "404".into(),
        json!({ "description": "Ressource inexistante OU invisible — les deux réponses sont identiques, octet pour octet.", "content": error_content() }),
    );
    Value::Object(given)
}

fn id_parameter() -> Value {
    json!({ "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } })
}

/// `toOpenApi`.
pub fn to_openapi(base: &ProjectedBase, tenant_ref: &str) -> Value {
    let mut paths = Map::new();
    let mut schemas = Map::new();

    for table in &base.tables {
        let name = schema_name(&table.name);
        let label = escape_label(&table.label);
        let expandable: Vec<String> = table.fields.iter().filter(|f| f.link.as_ref().is_some_and(|l| l.expandable)).map(|f| f.name.clone()).collect();
        let sortable: Vec<String> = table.fields.iter().filter(|f| !UNSORTED.contains(&f.kind.as_str())).map(|f| f.name.clone()).collect();
        let can = |a: Action| table.actions.contains(&a);
        let read_ref = json!({ "$ref": format!("#/components/schemas/{name}Read") });
        let write_ref = json!({ "$ref": format!("#/components/schemas/{name}Write") });

        schemas.insert(format!("{name}Read"), read_schema(table));
        if can(Action::Create) || can(Action::Update) {
            schemas.insert(format!("{name}Write"), write_schema(table));
        }

        let mut collection = Map::new();
        let mut item = Map::new();

        if can(Action::Read) {
            let mut parameters = vec![
                json!({ "name": "filter", "in": "query", "schema": { "type": "string" }, "description": "Expression de filtrage — voir la documentation lisible." }),
                json!({ "name": "sort", "in": "query", "schema": { "type": "string", "enum": sortable } }),
                json!({ "name": "limit", "in": "query", "schema": { "type": "integer", "maximum": 200 } }),
                json!({ "name": "after", "in": "query", "schema": { "type": "string" } }),
                json!({
                    "name": "links",
                    "in": "query",
                    "schema": { "type": "string", "enum": ["display", "id"] },
                    "description": "`id` supprime la résolution des libellés : recommandé pour les intégrations.",
                }),
            ];
            if !expandable.is_empty() {
                parameters.push(json!({
                    "name": "expand",
                    "in": "query",
                    "schema": { "type": "string", "enum": expandable },
                    "description": "Profondeur 1 sans exception. Les objets arrivent dans `included`.",
                }));
            }
            let mut get = obj(json!({ "summary": format!("Lister {label}") }));
            spread(&mut get, describe(table.description.as_deref()));
            get.insert("parameters".into(), Value::Array(parameters));
            get.insert(
                "responses".into(),
                responses(obj(json!({
                    "200": { "description": "Page de résultats.", "content": { "application/json": { "schema": list_response(table, &expandable) } } },
                }))),
            );
            collection.insert("get".into(), Value::Object(get));
            item.insert(
                "get".into(),
                json!({
                    "summary": format!("Lire une ligne de {label}"),
                    "responses": responses(obj(json!({ "200": { "description": "La ligne.", "content": { "application/json": { "schema": read_ref } } } }))),
                }),
            );
        }

        if can(Action::Create) {
            collection.insert(
                "post".into(),
                json!({
                    "summary": format!("Créer dans {label}"),
                    "requestBody": { "content": { "application/json": { "schema": write_ref } } },
                    "responses": responses(obj(json!({ "201": { "description": "Ligne créée." } }))),
                }),
            );
        }

        if can(Action::Update) {
            item.insert(
                "patch".into(),
                json!({
                    "summary": format!("Modifier une ligne de {label}"),
                    "requestBody": { "content": { "application/json": { "schema": write_ref } } },
                    "responses": responses(obj(json!({ "200": { "description": "Ligne modifiée." } }))),
                }),
            );
        }

        if can(Action::Delete) {
            item.insert(
                "delete".into(),
                json!({
                    "summary": format!("Supprimer une ligne de {label}"),
                    "responses": responses(obj(json!({
                        "204": { "description": "Supprimée." },
                        "409": { "description": "Ligne encore référencée — seules les tables visibles sont nommées.", "content": error_content() },
                    }))),
                }),
            );
        }

        let root = format!("/data/{}/{}", base.name, table.name);
        if !collection.is_empty() {
            paths.insert(root.clone(), Value::Object(collection));
        }
        if !item.is_empty() {
            let mut m = Map::new();
            m.insert("parameters".into(), json!([id_parameter()]));
            spread(&mut m, item);
            paths.insert(format!("{root}/{{id}}"), Value::Object(m));
        }

        let (can_create, can_update) = (can(Action::Create), can(Action::Update));
        if can_create || can_update {
            let mut operations = Vec::new();
            if can_create {
                operations.push(json!({
                    "type": "object",
                    "required": ["op", "data"],
                    "properties": { "op": { "type": "string", "enum": ["create"] }, "data": write_ref },
                }));
            }
            if can_update {
                let write_properties = schemas.get(&format!("{name}Write")).and_then(|s| s.get("properties")).cloned().unwrap_or(Value::Null);
                operations.push(json!({
                    "type": "object",
                    "required": ["op", "id", "data"],
                    "properties": {
                        "op": { "type": "string", "enum": ["update"] },
                        "id": { "type": "string", "format": "uuid", "description": "La ligne à modifier." },
                        "data": {
                            "type": "object",
                            "description": "Les champs à modifier : un champ absent reste tel qu’il est, `null` le vide. Chaque ligne peut nommer des champs différents.",
                            "properties": write_properties,
                        },
                    },
                }));
            }
            let summary = if can_create && can_update {
                format!("Créer ou modifier plusieurs lignes dans {label}")
            } else if can_create {
                format!("Créer plusieurs lignes dans {label}")
            } else {
                format!("Modifier plusieurs lignes dans {label}")
            };
            let items = if operations.len() == 1 { operations.remove(0) } else { json!({ "oneOf": operations }) };
            paths.insert(
                format!("{root}/batch"),
                json!({
                    "post": {
                        "summary": summary,
                        "description": "Tout ou rien : une seule transaction, et si une ligne est refusée aucune n’est écrite. Le refus porte `details.index`, la position de la ligne fautive. Seules les opérations `create` et `update` sont prises en charge, avec `atomic: true`, et un lot n’en contient qu’un genre. Un lot de modifications est annulable d’un seul geste : `X-Basedb-Transaction` nomme sa transaction, que `POST /history/undo` défait. Une ligne n’y figure qu’une fois.",
                        "requestBody": { "content": { "application/json": { "schema": {
                            "type": "object",
                            "required": ["operations"],
                            "properties": {
                                "atomic": { "type": "boolean", "enum": [true] },
                                "operations": { "type": "array", "maxItems": 1000, "items": items },
                            },
                        } } } },
                        "responses": responses(obj(json!({
                            "200": {
                                "description": "Toutes les lignes ont été écrites, dans l’ordre.",
                                "content": { "application/json": { "schema": {
                                    "type": "object",
                                    "properties": {
                                        "atomic": { "type": "boolean" },
                                        "results": { "type": "array", "items": { "type": "object", "properties": {
                                            "index": { "type": "integer" },
                                            "status": { "type": "string", "enum": ["created", "updated"] },
                                            "id": { "type": "string", "format": "uuid" },
                                        } } },
                                        "summary": { "type": "object" },
                                    },
                                } } },
                            },
                            "413": { "description": "Plus de 1 000 opérations.", "content": error_content() },
                        }))),
                    },
                }),
            );
        }

        if can(Action::Read) {
            paths.insert(
                format!("{root}/export"),
                json!({
                    "get": {
                        "summary": format!("Exporter {label}"),
                        "description": "Toutes les lignes que le filtre retient — pas seulement une page —, envoyées au fur et à mesure de la lecture. Les colonnes que vous ne lisez pas n’y sont jamais, comme dans une liste. Au-delà de 1 000 000 de lignes, l’export est refusé avant son premier octet (`400`, `details.reason: export_trop_gros`) : filtrez.",
                        "parameters": [
                            {
                                "name": "format",
                                "in": "query",
                                "required": true,
                                "schema": { "type": "string", "enum": ["csv", "xlsx", "json"] },
                                "description": "`csv` (UTF-8 avec BOM, séparateur `,`), `xlsx` (Excel) ou `json`. Un libellé de relation, un nom de personne, un nom de fichier, une date ISO : ce qu’un écran affiche.",
                            },
                            { "name": "filter", "in": "query", "schema": { "type": "string" }, "description": "Expression de filtrage — la même que pour une liste." },
                            { "name": "sort", "in": "query", "schema": { "type": "string", "enum": sortable } },
                            {
                                "name": "fields",
                                "in": "query",
                                "schema": { "type": "string" },
                                "description": "Les colonnes à écrire, par nom physique et dans cet ordre, séparées par des virgules. Absent : toutes celles que vous lisez, colonnes système comprises.",
                            },
                            {
                                "name": "headers",
                                "in": "query",
                                "schema": { "type": "string", "enum": ["name", "label"] },
                                "description": "Ce que dit la ligne d’en-tête d’un CSV ou d’un classeur : le nom physique (par défaut) ou le libellé. Les clés d’un JSON sont toujours les noms physiques.",
                            },
                        ],
                        "responses": responses(obj(json!({
                            "200": {
                                "description": "Le fichier, en pièce jointe.",
                                "content": {
                                    "text/csv": { "schema": { "type": "string" } },
                                    "application/json": { "schema": { "type": "array", "items": { "type": "object" } } },
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { "schema": { "type": "string", "format": "binary" } },
                                },
                            },
                            "400": { "description": "Format, filtre, tri ou colonne refusés — ou plus de lignes que le plafond.", "content": error_content() },
                            "429": { "description": "Trois exports sont déjà en cours pour vous.", "content": error_content() },
                        }))),
                    },
                }),
            );
        }

        if table.referenced_by && can(Action::Read) {
            paths.insert(
                format!("{root}/{{id}}/referenced_by"),
                json!({
                    "parameters": [id_parameter()],
                    "get": {
                        "summary": format!("Lignes référençant une ligne de {label}"),
                        "responses": responses(obj(json!({ "200": { "description": "Blocs de liens inverses." } }))),
                    },
                }),
            );
        }
    }

    let environment = json!({ "$ref": "#/components/parameters/Environment" });
    for item in paths.values_mut() {
        if let Value::Object(m) = item {
            match m.get_mut("parameters") {
                Some(Value::Array(p)) => p.push(environment.clone()),
                _ => {
                    m.insert("parameters".into(), json!([environment.clone()]));
                }
            }
        }
    }

    let mut description = Vec::new();
    if let Some(d) = &base.description {
        description.push(escape_label(d));
    }
    description.push(
        "Cette spécification décrit ce que VOUS pouvez voir : deux lecteurs en obtiennent deux versions différentes. Elle ne doit donc jamais être publiée telle quelle."
            .to_string(),
    );

    crate::js::js_order(json!({
        "openapi": "3.1.0",
        "info": { "title": format!("{} — basedb", escape_label(&base.label)), "version": "1", "description": description.join("\n\n") },
        "servers": [{ "url": format!("/api/v1/{tenant_ref}") }],
        "security": [{ "bearer": [] }],
        "paths": paths,
        "components": {
            "schemas": schemas,
            "securitySchemes": {
                "bearer": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "Un jeton d’intégration (bdb_…), créé depuis le menu de la base : API et agents › Jetons API et MCP.",
                },
            },
            "parameters": {
                "Environment": {
                    "name": "X-Basedb-Environment",
                    "in": "header",
                    "required": false,
                    "description": "L’environnement de la base : production, recette… Absent : celui que nomme la base dans le chemin. Un jeton créé pour un seul environnement n’ouvre que le sien.",
                    "schema": { "type": "string", "maxLength": 60 },
                },
            },
        },
    }))
}
