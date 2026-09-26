import { ApiError } from './api/client'

/**
 * Translation of an error code into a French message.
 *
 * The code comes from the shared registry; formatting belongs to the adapter, in the
 * reader's language (chapter 10 §2.2). The kernel itself never produces a message meant
 * for display — which is why these strings are the only French ones in this file.
 */
const EXPLANATIONS: Readonly<Record<string, string>> = {
  // Chapter 13 §2.5 fixes this sentence, and it is deliberately vague: unknown address,
  // wrong password, disabled, locked or deleted account all reach it, because none of
  // them is something a stranger may learn.
  CREDENTIALS_INVALID: 'Identifiants incorrects, ou compte indisponible.',
  AUTHENTICATION_REQUIRED: 'Session expirée ou absente : reconnectez-vous.',
  SESSION_EXPIRED: 'Session expirée : reconnectez-vous.',
  PASSWORD_POLICY_VIOLATION:
    'Mot de passe refusé : au moins 8 caractères, et sans reprendre votre adresse ni votre nom.',
  EXPAND_UNAVAILABLE: 'Ce champ ne peut pas être développé, ou sa cible n’est pas visible.',
  RESOURCE_NOT_FOUND: 'Élément introuvable.',
  LABEL_EMPTY: 'Le libellé ne peut pas être vide.',
  FORMULA_SYNTAX: 'La formule est mal écrite.',
  FORMULA_FIELD_NOT_FOUND: 'La formule cite un champ qui n’existe pas.',
  FORMULA_TYPE_MISMATCH: 'La formule mélange des types incompatibles.',
  FORMULA_LINK_FORBIDDEN:
    'Une formule ne cite pas une relation : ajoutez une recherche ou un cumul, et citez-le.',
  FORMULA_DEPENDS_ON_FORMULA:
    'Une formule ne cite pas une autre formule : réécrivez l’expression complète.',
  FORMULA_FUNCTION_NOT_IMMUTABLE:
    'Une date ne se convertit pas en texte dans une formule : passez par ANNEE, MOIS, JOUR.',
  COMPUTED_FIELD_READ_ONLY: 'Ce champ est calculé : il ne s’écrit pas.',
  REQUIRED_VALUE_MISSING: 'Un champ obligatoire est vide.',
  FIELD_NOT_WRITABLE: 'Vous ne pouvez pas modifier ce champ.',
  FILTER_FIELD_UNKNOWN: 'Champ inconnu.',
  SORT_FIELD_UNKNOWN: 'Champ de tri inconnu.',
  SORT_UNAVAILABLE: 'Ce champ ne peut pas servir de tri.',
  FILTER_OPERATOR_INVALID: 'Cet opérateur ne s’applique pas à ce type de champ.',
  FILTER_VALUE_INVALID: 'La valeur du filtre ne correspond pas au type du champ.',
  FILTER_TOO_COMPLEX: 'Filtre trop complexe : trop de conditions ou de parenthèses.',
  FILTER_TOO_LONG: 'Filtre trop long.',
  FILTER_NOT_SUPPORTED: 'Ce filtre n’est pas encore pris en charge.',
  FILTER_DISPLAY_UNAVAILABLE: 'La table visée n’a pas de colonne d’affichage.',
  EXPAND_TOO_DEEP: 'Un chemin ne peut traverser qu’une seule relation.',
  // A cursor is bound to its reader and to its query (ch. 08 §6.2), so these two say
  // what to DO rather than what went wrong: one is unrecoverable, the other reloads.
  CURSOR_INVALID: 'Page expirée : revenez à la première page.',
  CURSOR_STALE: 'Le tri ou le filtre ont changé : retour au début de la liste.',
  REQUEST_INVALID: 'Expression mal formée : vérifiez la syntaxe du filtre.',
  DUPLICATE_VALUE: 'Cette valeur existe déjà.',
  VALUE_INVALID: 'Valeur invalide pour ce type de champ.',
  ADMIN_REQUIRED: 'Action réservée à l’administration.',
  LINK_TARGET_NOT_FOUND: 'La ligne liée n’existe pas, ou n’est pas visible.',
  ROW_REFERENCED: 'Cette ligne est encore référencée par une autre table.',
  LINK_CROSS_DATABASE: 'Une relation ne peut pas viser une table d’une autre base.',
  LINK_SELF_REQUIRED: 'Une relation vers la même table ne peut pas être obligatoire.',
  LINK_SET_NULL_ON_REQUIRED:
    '« Vider à la suppression » est incompatible avec une relation obligatoire.',
  LINK_CASCADE_NOT_GRANTED: 'La suppression en cascade exige une confirmation explicite.',
  VALIDATION_FAILED: 'Valeur refusée par une règle métier.',

  // Chapter 06 — lifecycle.
  LABEL_DUPLICATE: 'Ce libellé est déjà pris.',
  LABEL_TOO_LONG: 'Libellé trop long : 255 caractères au maximum.',
  OPTION_IN_USE: 'Ce choix est encore porté par des lignes.',
  // The registry has one code for every text the API bounds, so this is only the fallback:
  // `messageFor` says WHICH text when `details.field` tells it.
  TEXT_TOO_LONG: 'Texte trop long.',
  BASE_NOT_EMPTY: 'Cette base contient encore des tables vivantes.',
  BASE_STRUCTURE_FROZEN: 'La structure de cette base est gelée : une dérive a été détectée.',
  TABLE_REFERENCED: 'Cette table est encore visée par une relation active.',
  DEPENDENT_OBJECT: 'Un objet créé en SQL (une vue, par exemple) en dépend encore.',
  ALIAS_DEPENDENT: 'Un alias de compatibilité est encore utilisé.',
  TARGET_PURGED: 'Cet objet a été purgé : il n’est plus restaurable.',
  RESTORE_TARGET_MISSING: 'Il n’y a rien à restaurer ici.',
  RESTORE_OUT_OF_RETENTION:
    'La période de rétention est dépassée : la restauration n’est plus possible.',
  NAME_COLLISION_UNRESOLVED: 'Impossible de trouver un nom libre.',

  // Chapter 07 — history.
  REVISION_SUPERSEDED:
    'Un de ces champs a changé depuis : annuler cette modification effacerait la plus récente.',
  RESTORE_RECORD_PRESENT: 'Cette ligne existe de nouveau : il n’y a rien à restaurer.',
  TRUNCATE_FORBIDDEN:
    'Vider une table d’un coup est refusé : supprimez ses lignes, qui seront historisées.',
  BULK_OPERATION_REFUSED: 'Trop de lignes dans une seule opération : découpez-la en lots.',
  HISTORY_IMMUTABLE: 'L’historique ne se modifie pas.',

  // Chapter 06 — physical names, aliases, purge.
  NAME_RETIRED: 'Ce nom a déjà servi : un nom n’est jamais réattribué, même après suppression.',
  NAME_TAKEN_OUTSIDE_REGISTRY: 'Un objet créé hors de basedb porte déjà ce nom dans la base.',
  IDENTIFIER_INVALID:
    'Nom invalide : lettres minuscules sans accent, chiffres et « _ », commençant par une lettre, hors mots réservés.',
  NAME_TOO_LONG: 'Nom trop long pour PostgreSQL.',
  TOO_MANY_ALIASES: 'Cet objet a déjà cinq alias : supprimez-en un avant de le renommer encore.',
  PURGE_TOO_EARLY: 'La purge n’est possible que trente jours après la suppression.',
  EXPORT_UNAVAILABLE: 'L’export préalable à la purge n’a pas pu être écrit ou relu.',
  EXPORT_STALE: 'Des données ont été écrites depuis l’export : refaites l’export avant de purger.',

  // Chapter 09 §7 — agent proposals.
  PROPOSAL_STALE:
    'La structure de la base a changé depuis cette proposition : l’agent doit la refaire.',
  PROPOSAL_EXPIRED: 'Cette proposition a plus de 24 heures : elle a expiré.',
  AUTHORIZATION_REVOKED:
    'La personne pour qui l’agent agit, ou son jeton, n’a plus le droit de faire cette modification.',
  TOO_MANY_OPEN_PROPOSALS: 'Trop de propositions en attente pour ce jeton.',

  // Chapter 03 — migrations.
  MIGRATION_IN_PROGRESS: 'Une migration est déjà en cours sur cette base.',
  MIGRATION_STALE: 'Cette migration n’est plus dans un état où elle peut être appliquée.',
  MIGRATION_TAMPERED: 'Le plan a changé depuis sa proposition. Réessayez.',
  MIGRATION_TOO_LARGE: 'Ce plan dépasse la taille qu’une migration peut porter.',
  MIGRATION_EXPIRED: 'Cette proposition de migration a expiré.',

  // Chapter 12 — AI. None of these is the caller's fault, and each says what to do.
  AI_DISABLED: 'L’IA n’est pas activée sur cette instance.',
  AI_CONSENT_REQUIRED: 'Le consentement à l’envoi de données au fournisseur n’a pas été donné.',
  AI_NOT_CONFIGURED: 'Aucun fournisseur d’IA n’est configuré, ou sa clé est absente.',
  AI_QUOTA_EXCEEDED: 'Plafond d’appels à l’IA atteint.',
  AI_PROVIDER_UNAVAILABLE: 'Le fournisseur d’IA ne répond pas. Réessayez dans un instant.',
  AI_RESPONSE_UNUSABLE: 'Réponse de l’IA inutilisable. Reformulez la demande.',
  AI_PAYLOAD_TOO_LARGE: 'Cette base est trop grande pour tenir dans une demande.',

  // Chapter 08 §11 — integration tokens.
  ELEVATION_REQUIRED: 'Confirmez votre mot de passe pour faire cela.',
  ROLE_NOT_DELEGABLE: 'Vous ne pouvez pas accorder à un jeton des droits que vous n’avez pas.',
  TOKEN_EXPIRY_REQUIRED: 'La validité d’un jeton va de 1 à 365 jours.',

  // Chapter 15 — shared forms.
  FORM_CLOSED: 'Ce formulaire n’accepte plus de réponses.',
  FORM_RESTRICTED: 'Ce formulaire est réservé à certains groupes.',
  VIEW_SHARE_CLOSED: 'Cette vue partagée n’est plus accessible.',
  VIEW_SHARE_RESTRICTED: 'Cette vue partagée est réservée à certains groupes.',
  VIEW_LOCKED: 'Cette vue est verrouillée : déverrouillez-la pour la modifier.',

  // Chapters 17 and 19 — automations, integrations, synced tables.
  AUTOMATION_DISABLED: 'Cette automatisation est désactivée ou supprimée.',
  AUTOMATION_WEBHOOK_FAILED: 'Le service appelé n’a pas répondu correctement.',
  TABLE_SYNCED:
    'Cette table est synchronisée : ses lignes suivent leur source et ne se modifient pas ici.',
  SYNC_SOURCE_FAILED:
    'La source n’a pas pu être lue : elle est injoignable, trop grosse ou illisible.',

  // Chapter 14 — environments.
  ENVIRONMENT_IS_PRODUCTION:
    'La production est la base elle-même : elle se supprime avec la base, pas seule.',
  ENVIRONMENT_MISMATCH: 'Ces deux bases ne sont pas deux environnements d’une même base.',
  SYNC_REFERENCE_MISSING:
    'Une relation désigne une ligne absente de l’environnement cible : synchronisez d’abord la table visée.',
  SYNC_TABLE_MISSING:
    'Cette table n’existe pas dans les deux environnements : reportez d’abord la structure.',
  SYNC_VALUES_REFUSED:
    'Des valeurs sont refusées par l’environnement cible (choix absent, champ obligatoire…) : reportez d’abord la structure.',

  // Chapter 05 §15 — projects, people and groups.
  PROJECT_NOT_EMPTY: 'Ce projet contient encore des bases : supprimez-les d’abord.',
  EMAIL_TAKEN: 'Un compte existe déjà avec cette adresse.',
  GROUP_SYSTEM_IMMUTABLE:
    'Ce groupe est fourni par basedb : il ne peut être ni renommé ni supprimé.',
  LAST_TENANT_ADMIN: 'Il doit rester au moins un administrateur actif.',
  ACTION_FORBIDDEN: 'Cette action n’est pas permise.',

  // Chapter 04 §3 bis — files.
  BODY_TOO_LARGE: 'Fichier trop lourd.',
  CONTENT_TYPE_INVALID: 'Ce fichier n’est pas une image acceptée : PNG, JPEG, GIF, WebP ou AVIF.',
  VALUE_OUT_OF_CONSTRAINT: 'Valeur refusée par la base : elle ne respecte pas la règle du champ.',
  SERVICE_UNAVAILABLE: 'Service momentanément indisponible. Réessayez dans un instant.',
}

/** Why a value was refused: the `reason` the kernel gives for `VALUE_INVALID`. */
const VALUE_REASONS: Readonly<Record<string, string>> = {
  fichier_inconnu: 'Ce fichier n’a pas été déposé pour ce champ.',
  reference_de_fichier: 'Référence de fichier invalide.',
  liste_de_textes: 'Un choix multiple attend une liste de valeurs.',
}

/** Why a list of choices was refused: the `reason` the kernel gives for `REQUEST_INVALID`. */
const OPTION_REASONS: Readonly<Record<string, string>> = {
  liste_vide: 'Une liste de choix ne peut pas être vide.',
  trop_d_options: 'Trop de choix : 200 au maximum.',
  vide: 'Un choix n’a ni libellé ni valeur.',
  valeur_absente: 'Un choix n’a pas de valeur.',
  trop_long: 'Un choix est trop long : 200 caractères au maximum.',
  caractere_nul: 'Un choix contient un caractère interdit.',
  couleur_invalide: 'Couleur invalide : attendu #rrggbb.',
  icone_invalide: 'Nom de pictogramme invalide.',
  image_invalide: 'Image invalide : une adresse https ou une image png, jpeg, webp ou gif.',
  image_trop_grande: 'Image trop lourde : choisissez-en une plus petite.',
  icone_et_image: 'Un choix porte un pictogramme ou une image, pas les deux.',
  pas_une_liste_de_choix: 'Ce champ n’est pas une liste de choix.',
}

/** Why the prompt or the schedule of an AI field was refused (`REQUEST_INVALID`). */
const AI_REASONS: Readonly<Record<string, string>> = {
  consigne_vide: 'La consigne est vide.',
  consigne_trop_longue: 'Consigne trop longue : 8 000 caractères au maximum.',
  variable_circulaire: 'Un champ IA ne peut pas se citer lui-même.',
  cron_invalide: 'Planification invalide.',
  fuseau_inconnu: 'Fuseau horaire inconnu.',
  cron_sans_date: 'Cette planification ne tombe jamais : aucune date ne la satisfait.',
  frequence_trop_haute: 'Trop fréquent : un recalcul toutes les 15 minutes au plus.',
  pas_un_champ_ia: 'Ce champ n’est pas un champ IA.',
}

/** Why a view's configuration was refused (`REQUEST_INVALID`, `field: 'spec'`). */
const VIEW_REASONS: Readonly<Record<string, string>> = {
  champ_pivot_manquant: 'Choisissez le champ pivot de la vue.',
  type_de_champ_incompatible: 'Ce champ n’a pas le type qu’attend la vue.',
  champ_inconnu: 'La vue cite un champ inconnu : il a peut-être été supprimé.',
  cle_inconnue: 'Configuration de vue invalide.',
  doublon: 'Un même champ est cité deux fois.',
  formulaire_vide: 'Un formulaire doit poser au moins une question.',
  trop_de_tris: 'Trois critères de tri au plus.',
  texte_trop_long: 'Un texte de la vue est trop long.',
  spec_trop_volumineux: 'Configuration de vue trop volumineuse.',
  spec_invalide: 'Configuration de vue invalide.',
  valeur_invalide: 'Configuration de vue invalide.',
}

/**
 * The sentence for a code, refined by what the refusal carries when the code alone is
 * ambiguous. `TEXT_TOO_LONG` is the case: it is raised for any bounded text, and "trop
 * long" is no help to someone who has not been told which box to shorten.
 */
function explain(e: ApiError): string {
  // A formula's refusal names where: the field it cannot find, the position it stopped at.
  if (e.code.startsWith('FORMULA_')) {
    const base = EXPLANATIONS[e.code] ?? 'La formule est refusée.'
    const where =
      typeof e.details.field === 'string'
        ? ` — [${e.details.field}]`
        : typeof e.details.position === 'number'
          ? ` — au caractère ${e.details.position + 1}`
          : ''
    return `${base}${where}`
  }

  // A choice that rows still carry cannot leave the list. The count is the whole point of
  // the refusal: it says how much data stands in the way.
  if (e.code === 'OPTION_IN_USE' && Array.isArray(e.details.options)) {
    const used = (e.details.options as Array<{ value?: unknown; count?: unknown }>)
      .map(
        (o) => `« ${String(o.value)} » (${String(o.count)} ${o.count === 1 ? 'ligne' : 'lignes'})`,
      )
      .join(', ')
    return `Impossible de retirer ${used} : ce choix est encore utilisé.`
  }

  // `description`, or the path to one inside a payload — `fields[0].description` when a
  // table is created with its columns.
  const field = e.details.field
  // A copy of rows that needs another table's rows first: that table is named.
  if (e.code === 'SYNC_REFERENCE_MISSING' && typeof e.details.target === 'string') {
    return `Des lignes pointent vers « ${e.details.target} », qui n’a pas encore ces lignes dans l’environnement cible : synchronisez-la d’abord.`
  }
  // A row brought back that points to a row gone since: the restoration names what blocks.
  if (e.code === 'RESTORE_TARGET_MISSING' && typeof e.details.record === 'string') {
    return 'Une ligne vers laquelle elle pointait n’existe plus : restaurez-la d’abord.'
  }
  // Chapter 06: what blocks is named — a view someone built, a name already used.
  if (e.code === 'DEPENDENT_OBJECT') {
    const named = Array.isArray(e.details.dependents)
      ? (e.details.dependents as unknown[]).map(String)
      : typeof e.details.dependent === 'string'
        ? [e.details.dependent]
        : []
    if (named.length > 0) {
      return `Des objets créés hors de basedb en dépendent : ${named.join(', ')}. Ils doivent être supprimés d’abord, par leur auteur.`
    }
  }
  if (e.code === 'NAME_RETIRED' && typeof e.details.suggestion === 'string') {
    return `Ce nom a déjà servi, et un nom n’est jamais réattribué. Libre : « ${e.details.suggestion} ».`
  }
  if (e.code === 'NAME_TAKEN_OUTSIDE_REGISTRY' && typeof e.details.owner === 'string') {
    return `Un objet créé hors de basedb (propriétaire ${e.details.owner}) porte déjà ce nom.`
  }
  if (e.code === 'EXPORT_UNAVAILABLE' && e.details.reason === 'trop_volumineux') {
    return 'Trop de lignes pour un export depuis l’interface (2 millions au plus).'
  }
  if (e.code === 'EXPORT_UNAVAILABLE' && e.details.reason === 'repertoire_absent') {
    return 'Aucun répertoire d’export n’est configuré sur le serveur (BASEDB_EXPORT_DIR).'
  }
  if (e.code === 'PURGE_TOO_EARLY' && typeof e.details.purgeable_from === 'string') {
    const at = new Date(e.details.purgeable_from).toLocaleDateString('fr-FR')
    return `Purge possible à partir du ${at}. Seul un administrateur d’instance peut l’avancer, en le justifiant.`
  }
  if (e.code === 'ACTION_FORBIDDEN' && e.details.reason === 'soi_meme') {
    return 'Vous ne pouvez pas désactiver votre propre compte.'
  }
  if (e.code === 'REQUEST_INVALID') {
    if (field === 'email') return 'Adresse électronique invalide.'
    const reason = e.details.reason
    if (field === 'spec' && typeof reason === 'string') {
      return VIEW_REASONS[reason] ?? 'Configuration de vue invalide.'
    }
    // A citation that designates nothing is named: it is the one to correct.
    if (reason === 'variable_inconnue' && typeof e.details.variable === 'string') {
      return `La consigne cite « ${e.details.variable} », qui n’est pas une colonne lisible de la table.`
    }
    if (reason === 'cron_invalide' && typeof e.details.detail === 'string') {
      return `Planification invalide — ${e.details.detail}.`
    }
    const known =
      typeof reason === 'string' ? (OPTION_REASONS[reason] ?? AI_REASONS[reason]) : undefined
    if (known !== undefined) return known
    if (field === 'options') return 'Liste de choix invalide.'
  }
  if (e.code === 'VALUE_INVALID' && typeof e.details.reason === 'string') {
    const known = VALUE_REASONS[e.details.reason]
    if (known !== undefined) return known
  }
  if (e.code === 'BODY_TOO_LARGE' && typeof e.details.maximum === 'number') {
    return `Fichier trop lourd : ${Math.floor(e.details.maximum / (1024 * 1024))} Mo au maximum.`
  }
  if (e.code === 'VALUE_OUT_OF_RANGE' && e.details.reason === 'trop_de_fichiers') {
    return `Trop de fichiers dans ce champ : ${String(e.details.maximum)} au maximum.`
  }
  if (e.code === 'TEXT_TOO_LONG' && typeof field === 'string' && /(^|\.)description$/.test(field)) {
    // The bound comes from the refusal, so the sentence follows the server if it moves.
    const maximum = typeof e.details.maximum === 'number' ? e.details.maximum : 1000
    return `Description trop longue : ${maximum} caractères au maximum.`
  }
  return EXPLANATIONS[e.code] ?? 'Erreur inattendue.'
}

export function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    const detail = explain(e)
    // The login refusal carries no code and no trace: the one thing this screen must
    // not do is give a stranger something to tell two attempts apart by.
    if (e.code === 'CREDENTIALS_INVALID') return detail
    const trace = e.requestId !== '' ? ` · ${e.requestId.slice(0, 8)}` : ''
    return `${detail} (${e.code}${trace})`
  }
  return 'L’API est injoignable.'
}

/**
 * The sentence alone, without the code and the trace — for a refusal shown next to the
 * box it concerns, while a person is still typing, where a code would be noise.
 */
export function reasonFor(e: unknown): string {
  return e instanceof ApiError ? explain(e) : 'L’API est injoignable.'
}

/** The sentence for a code recorded earlier — the last incident of an AI field. */
export function sentenceFor(code: string): string {
  return EXPLANATIONS[code] ?? code
}
