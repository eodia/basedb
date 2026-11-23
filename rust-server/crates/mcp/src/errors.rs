//! Errors as an agent reads them (`errors.ts`, chapter 09 §14): a `code` of the registry, a
//! FIXED French `message` per code, the parameters at fault, and a `hint` naming only tools.

use basedb_base::error::AppError;
use basedb_contracts::{error_codes::entry, ErrorClass};
use serde_json::{json, Map, Value};

/// `MESSAGES`: one sentence per code, naming nothing the agent wrote.
pub fn message(code: &str) -> Option<&'static str> {
    Some(match code {
        "PARAMETER_INVALID" => "Un paramètre ne respecte pas le schéma de l’outil.",
        "RESOURCE_NOT_FOUND" => "La ressource demandée est introuvable.",
        "NAME_AMBIGUOUS" => "Ce nom désigne plusieurs objets.",
        "FIELD_UNKNOWN" => "Le champ demandé n’existe pas dans cette table.",
        "FIELD_NOT_EXPANDABLE" => "Ce champ ne peut pas être développé.",
        "FIELD_NOT_WRITABLE" => "Ce champ n’est pas modifiable par cette surface.",
        "VALUE_INVALID" => "Une valeur ne correspond pas au type de son champ.",
        "VALUE_TOO_LONG" => "Une valeur dépasse la longueur maximale de son champ.",
        "VALUE_OUT_OF_RANGE" => "Une valeur sort des bornes de son champ.",
        "VALUE_OUT_OF_CONSTRAINT" => "Une valeur ne respecte pas une contrainte de la table.",
        "REQUIRED_VALUE_MISSING" => "Un champ obligatoire est vide.",
        "DUPLICATE_VALUE" => "Une valeur existe déjà dans un champ qui l’interdit.",
        "TEXT_TOO_LONG" => "Le texte dépasse la longueur autorisée.",
        "MCP_OPERATION_EXCLUDED" => "Cette opération n’existe pas sur la surface MCP.",
        "TOKEN_READ_ONLY" => "Ce jeton est en lecture seule.",
        "TOKEN_SUSPENDED" => "Ce jeton est suspendu.",
        "TOKEN_INVALID" => "Le jeton présenté n’est pas valide pour cette surface.",
        "TOKEN_EXPIRED" => "Le jeton présenté a expiré.",
        "TOKEN_REVOKED" => "Le jeton présenté a été révoqué.",
        "SESSION_NOT_INITIALIZED" => "La session n’est pas initialisée : envoyez d’abord initialize.",
        "CURSOR_INVALID" => "Le curseur n’est pas valide pour cette requête.",
        "QUOTA_EXCEEDED" => "Le quota d’appels de ce jeton est atteint.",
        "CONCURRENCY_CONFLICT" => "Un conflit d’accès concurrent a interrompu l’opération.",
        "PERMISSION_DENIED" => "Ce jeton peut lire cet objet mais pas y faire cette action.",
        "IDEMPOTENCY_CONFLICT" => "Cette clé d’idempotence a déjà servi pour un autre appel.",
        "IDEMPOTENCY_IN_PROGRESS" => "Un appel portant cette clé d’idempotence est en cours.",
        "IDEMPOTENCY_INTERRUPTED" => "L’appel portant cette clé d’idempotence a été interrompu.",
        "IDEMPOTENCY_STALE" => "Les droits ont changé depuis l’appel portant cette clé d’idempotence.",
        "LINK_TARGET_NOT_FOUND" => "La ligne cible de ce lien est introuvable.",
        "ROW_REFERENCED" => "Cette ligne est encore désignée par un lien d’une autre ligne.",
        "TOKEN_CASCADE_FORBIDDEN" => "Une relation en cascade emporterait d’autres lignes avec celle-ci : un jeton ne la supprime pas.",
        "RESTORE_RECORD_PRESENT" => "Cette ligne existe de nouveau : il n’y a rien à restaurer.",
        "RESTORE_TARGET_MISSING" => "Cette ligne désignait une ligne qui a disparu depuis : elle ne peut pas revenir telle quelle.",
        "LOCK_UNAVAILABLE" => "La table est momentanément verrouillée.",
        "FILTER_OPERATOR_INVALID" => "Cet opérateur ne s’applique pas à ce champ.",
        "FILTER_TOO_COMPLEX" => "Le filtre est trop complexe.",
        "SORT_UNAVAILABLE" => "Ce champ ne peut pas servir au tri.",
        "EXPAND_TOO_WIDE" => "Le développement demandé dépasse les bornes autorisées.",
        "EXPAND_TOO_DEEP" => "Le développement ne va pas au-delà d’un niveau.",
        "DEADLINE_EXCEEDED" => "L’opération a dépassé son délai.",
        "SERVICE_UNAVAILABLE" => "Le service est momentanément indisponible.",
        "INTERNAL_ERROR" => "Erreur interne du serveur.",
        _ => return None,
    })
}

/// `MESSAGES[code] ?? 'La requête a été refusée.'`.
pub fn message_or_refused(code: &str) -> &'static str {
    message(code).unwrap_or("La requête a été refusée.")
}

/// `HINTS`: what to do next, citing tools and never an object.
fn hint(code: &str) -> Option<&'static str> {
    Some(match code {
        "PARAMETER_INVALID" => "Corrigez les paramètres listés dans invalid_params d’après le schéma de l’outil.",
        "RESOURCE_NOT_FOUND" => "Utilisez list_bases puis describe_base pour connaître les bases et tables accessibles.",
        "FIELD_UNKNOWN" => "Utilisez describe_table pour la liste des champs de cette table.",
        "FIELD_NOT_EXPANDABLE" => "Seuls les champs lien marqués expandable dans describe_table se développent.",
        "FIELD_NOT_WRITABLE" => "Les colonnes système et les champs formule ne se modifient jamais ; voir access dans describe_table.",
        "VALUE_INVALID" => "Le format attendu figure dans details.expected ; voir la description de create_record.",
        "VALUE_TOO_LONG" => "La longueur maximale figure dans details.maximum et dans describe_table (max_length).",
        "REQUIRED_VALUE_MISSING" => "Renseignez les champs marqués required dans describe_table.",
        "DUPLICATE_VALUE" => "Ce champ exige une valeur unique : une autre ligne porte déjà celle-ci.",
        "MCP_OPERATION_EXCLUDED" => "Cette opération se fait dans l’interface basedb, par une personne.",
        "TOKEN_READ_ONLY" => "Un jeton en lecture et écriture se crée dans l’interface basedb.",
        "TOKEN_SUSPENDED" => "La suspension se lève dans l’interface basedb, écran Intégrations.",
        "TOKEN_INVALID" => "Vérifiez le jeton configuré, ou créez-en un dans l’interface basedb.",
        "TOKEN_EXPIRED" => "Créez un nouveau jeton dans l’interface basedb.",
        "TOKEN_REVOKED" => "Créez un nouveau jeton dans l’interface basedb.",
        "SESSION_NOT_INITIALIZED" => "Envoyez initialize avant tout autre message.",
        "CURSOR_INVALID" => "Relancez la requête sans cursor pour repartir de la première page.",
        "QUOTA_EXCEEDED" => "Patientez retry_after secondes avant de réessayer.",
        "CONCURRENCY_CONFLICT" => "Réessayez l’appel.",
        "PERMISSION_DENIED" => "Demandez ce droit à la personne qui a créé le jeton ; voir access dans describe_table.",
        "IDEMPOTENCY_CONFLICT" => "Utilisez une nouvelle clé d’idempotence pour un appel différent.",
        "IDEMPOTENCY_IN_PROGRESS" => "Réessayez dans une seconde avec la même clé.",
        "IDEMPOTENCY_INTERRUPTED" => "Vérifiez avec list_records ou get_record avant de réessayer avec une nouvelle clé.",
        "IDEMPOTENCY_STALE" => "Relisez l’état avec get_record, puis réessayez avec une nouvelle clé.",
        "LINK_TARGET_NOT_FOUND" => "Un lien se renseigne avec le _id d’une ligne de la table cible ; lookup_records le trouve.",
        "LOCK_UNAVAILABLE" => "Réessayez dans quelques instants.",
        "ROW_REFERENCED" => "Supprimez ou modifiez d’abord les lignes qui la désignent ; describe_table dit, pour chaque lien, ce que devient une ligne liée (on_delete).",
        "RESTORE_RECORD_PRESENT" => "Lisez la ligne avec get_record.",
        "TOKEN_CASCADE_FORBIDDEN" => "Cette suppression se fait dans l’interface basedb, par une personne qui voit ce qu’elle emporte.",
        "RESTORE_TARGET_MISSING" => "Restaurez d’abord la ligne qu’elle désignait, puis réessayez.",
        "FILTER_OPERATOR_INVALID" => "Les opérateurs admis par type figurent dans la description de list_records.",
        "SORT_UNAVAILABLE" => "Triez sur un autre champ.",
        "EXPAND_TOO_WIDE" => "Développez moins de champs lien à la fois.",
        "DEADLINE_EXCEEDED" => "Resserrez le filtre ou réduisez limit.",
        "SERVICE_UNAVAILABLE" => "Réessayez dans quelques instants.",
        _ => return None,
    })
}

/// `SPECIFIC_HINTS`: chosen by the kernel through a closed marker in the details.
fn specific_hint(marker: &str) -> Option<&'static str> {
    Some(match marker {
        "describe_table" => "Cette table n’a pas de champ d’affichage lisible : consultez describe_table.",
        "rich_text" => "Les champs de texte riche se modifient dans l’interface basedb.",
        "token_delete" => "Ce jeton n’a pas été créé pour supprimer : un jeton « Lecture, écriture et suppression » se crée dans l’interface basedb.",
        _ => return None,
    })
}

const RETRYABLE: [&str; 5] = ["QUOTA_EXCEEDED", "CONCURRENCY_CONFLICT", "LOCK_UNAVAILABLE", "IDEMPOTENCY_IN_PROGRESS", "SERVICE_UNAVAILABLE"];

/// Detail keys allowed through: each names only what the bearer may see.
const SAFE_DETAILS: [&str; 4] = ["field", "expected", "maximum", "action"];

/// `isIncident`: the kernel files every code without an HTTP status as an incident — which
/// the codes of chapter 09 all are; they are ordinary refusals here.
fn is_incident(error: &AppError) -> bool {
    error.class() == ErrorClass::Incident && entry(error.code).map(|e| e.chapter) != Some("09")
}

/// `errorPayload` (§14.1), from any error a call raised.
pub fn error_payload(error: &AppError, request_id: &str) -> Map<String, Value> {
    let mut out = Map::new();
    if is_incident(error) {
        out.insert("code".into(), json!("INTERNAL_ERROR"));
        out.insert("message".into(), json!(message("INTERNAL_ERROR")));
        out.insert("retryable".into(), json!(false));
        out.insert("request_id".into(), json!(request_id));
        return out;
    }
    let d = &error.details;
    out.insert("code".into(), json!(error.code));
    out.insert("message".into(), json!(message_or_refused(error.code)));
    if let Some(Value::Object(object)) = d.get("object") {
        if let Some(name) = object.get("name").filter(|n| n.is_string()) {
            let mut o = Map::new();
            if let Some(kind) = object.get("kind") {
                o.insert("kind".into(), kind.clone());
            }
            o.insert("name".into(), name.clone());
            out.insert("object".into(), Value::Object(o));
        }
    }
    match (d.get("invalid_params"), d.get("param")) {
        (Some(list @ Value::Array(_)), _) => {
            out.insert("invalid_params".into(), list.clone());
        }
        (_, Some(param @ Value::String(_))) => {
            out.insert("invalid_params".into(), json!([param]));
        }
        _ => {}
    }
    let details: Map<String, Value> = SAFE_DETAILS.iter().filter_map(|k| d.get(*k).map(|v| (k.to_string(), v.clone()))).collect();
    if !details.is_empty() {
        out.insert("details".into(), Value::Object(details));
    }
    let specific = d.get("hint").and_then(Value::as_str).and_then(specific_hint);
    if let Some(h) = specific.or_else(|| hint(error.code)) {
        out.insert("hint".into(), json!(h));
    }
    out.insert("retryable".into(), json!(RETRYABLE.contains(&error.code)));
    if let Some(n @ Value::Number(_)) = d.get("retry_after") {
        out.insert("retry_after".into(), n.clone());
    }
    out
}

/// `{ ...base, ...extra }`: a key already there keeps its place, a new one goes last.
pub fn spread(mut base: Map<String, Value>, extra: &Map<String, Value>) -> Map<String, Value> {
    for (k, v) in extra {
        base.insert(k.clone(), v.clone());
    }
    base
}

/// `errorPayloadOf`: the payload of a code raised by the entry point itself.
pub fn error_payload_of(code: &str, request_id: &str, extra: &Map<String, Value>) -> Map<String, Value> {
    let error = AppError::new(code).details(Value::Object(extra.clone()));
    spread(error_payload(&error, request_id), extra)
}

/// `parameterInvalid`: a refusal that names parameters, and no object of the catalog.
pub fn parameter_invalid(invalid: Vec<String>) -> AppError {
    AppError::new("PARAMETER_INVALID").with("invalid_params", json!(invalid))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payloads_follow_errors_ts() {
        let e = AppError::new("FIELD_UNKNOWN").with("param", json!("full_fields[0]")).with("object", json!({ "kind": "table", "name": "t" })).with("field", json!("x"));
        assert_eq!(
            Value::Object(error_payload(&e, "r")).to_string(),
            r#"{"code":"FIELD_UNKNOWN","message":"Le champ demandé n’existe pas dans cette table.","object":{"kind":"table","name":"t"},"invalid_params":["full_fields[0]"],"details":{"field":"x"},"hint":"Utilisez describe_table pour la liste des champs de cette table.","retryable":false}"#
        );
        let internal = Value::Object(error_payload(&AppError::internal("boom"), "r")).to_string();
        assert_eq!(internal, r#"{"code":"INTERNAL_ERROR","message":"Erreur interne du serveur.","retryable":false,"request_id":"r"}"#);
        let extra: Map<String, Value> = [("retry_after".to_string(), json!(3))].into_iter().collect();
        let quota = Value::Object(error_payload_of("QUOTA_EXCEEDED", "r", &extra)).to_string();
        assert!(quota.ends_with(r#""retryable":true,"retry_after":3}"#), "{quota}");
        let hinted = AppError::new("RESOURCE_NOT_FOUND").with("hint", json!("describe_table"));
        assert_eq!(error_payload(&hinted, "r")["hint"], json!(specific_hint("describe_table")));
        // An unknown marker falls back to the code's hint.
        let other = AppError::new("RESOURCE_NOT_FOUND").with("hint", json!("autre"));
        assert_eq!(error_payload(&other, "r")["hint"], json!(hint("RESOURCE_NOT_FOUND")));
    }
}
