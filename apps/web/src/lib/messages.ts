import { $t, $tp, intlLocale } from '@/lib/i18n'
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
  CREDENTIALS_INVALID: $t('Identifiants incorrects, ou compte indisponible.'),
  AUTHENTICATION_REQUIRED: $t('Session expirée ou absente : reconnectez-vous.'),
  SESSION_EXPIRED: $t('Session expirée : reconnectez-vous.'),
  // Coming back from a sign-in provider (chapter 13 §3).
  PROVISIONING_REFUSED: $t(
    'Aucun compte n’est associé à cette adresse, et elle ne peut pas en créer un ici : demandez une invitation.',
  ),
  OIDC_ACCOUNT_LINK_REQUIRED: $t(
    'Un compte existe déjà avec cette adresse : connectez-vous avec son mot de passe.',
  ),
  OIDC_STATE_INVALID: $t('La connexion a expiré ou a été interrompue : recommencez.'),
  OIDC_TOKEN_INVALID: $t('Le fournisseur n’a pas pu confirmer votre identité : recommencez.'),
  OIDC_PROVIDER_UNKNOWN: $t('Ce moyen de connexion n’est pas proposé ici.'),
  PASSWORD_POLICY_VIOLATION: $t(
    'Mot de passe refusé : au moins 8 caractères, et sans reprendre votre adresse ni votre nom.',
  ),
  EXPAND_UNAVAILABLE: $t('Ce champ ne peut pas être développé, ou sa cible n’est pas visible.'),
  RESOURCE_NOT_FOUND: $t('Élément introuvable.'),
  LABEL_EMPTY: $t('Le libellé ne peut pas être vide.'),
  FORMULA_SYNTAX: $t('La formule est mal écrite.'),
  FORMULA_FIELD_NOT_FOUND: $t('La formule cite un champ qui n’existe pas.'),
  FORMULA_TYPE_MISMATCH: $t('La formule mélange des types incompatibles.'),
  FORMULA_LINK_FORBIDDEN: $t(
    'Une formule ne cite pas une relation : ajoutez une recherche ou un cumul, et citez-le.',
  ),
  FORMULA_DEPENDS_ON_FORMULA: $t(
    'Une formule ne cite pas une autre formule : réécrivez l’expression complète.',
  ),
  FORMULA_FUNCTION_NOT_IMMUTABLE: $t(
    'Une date ne se convertit pas en texte dans une formule : passez par ANNEE, MOIS, JOUR.',
  ),
  COMPUTED_FIELD_READ_ONLY: $t('Ce champ est calculé : il ne s’écrit pas.'),
  REQUIRED_VALUE_MISSING: $t('Un champ obligatoire est vide.'),
  FIELD_NOT_WRITABLE: $t('Vous ne pouvez pas modifier ce champ.'),
  FILTER_FIELD_UNKNOWN: $t('Champ inconnu.'),
  SORT_FIELD_UNKNOWN: $t('Champ de tri inconnu.'),
  SORT_UNAVAILABLE: $t('Ce champ ne peut pas servir de tri.'),
  FILTER_OPERATOR_INVALID: $t('Cet opérateur ne s’applique pas à ce type de champ.'),
  FILTER_VALUE_INVALID: $t('La valeur du filtre ne correspond pas au type du champ.'),
  FILTER_TOO_COMPLEX: $t('Filtre trop complexe : trop de conditions ou de parenthèses.'),
  FILTER_TOO_LONG: $t('Filtre trop long.'),
  FILTER_NOT_SUPPORTED: $t('Ce filtre n’est pas encore pris en charge.'),
  FILTER_DISPLAY_UNAVAILABLE: $t('La table visée n’a pas de colonne d’affichage.'),
  EXPAND_TOO_DEEP: $t('Un chemin ne peut traverser qu’une seule relation.'),
  // A cursor is bound to its reader and to its query (ch. 08 §6.2), so these two say
  // what to DO rather than what went wrong: one is unrecoverable, the other reloads.
  CURSOR_INVALID: $t('Page expirée : revenez à la première page.'),
  CURSOR_STALE: $t('Le tri ou le filtre ont changé : retour au début de la liste.'),
  REQUEST_INVALID: $t('Expression mal formée : vérifiez la syntaxe du filtre.'),
  DUPLICATE_VALUE: $t('Cette valeur existe déjà.'),
  VALUE_INVALID: $t('Valeur invalide pour ce type de champ.'),
  ADMIN_REQUIRED: $t('Action réservée à l’administration.'),
  LINK_TARGET_NOT_FOUND: $t('La ligne liée n’existe pas, ou n’est pas visible.'),
  ROW_REFERENCED: $t('Cette ligne est encore référencée par une autre table.'),
  ROW_OUT_OF_SCOPE: $t(
    'Cette ligne ne ferait pas partie des lignes que vous voyez : elle n’a pas été créée.',
  ),
  LINK_CROSS_DATABASE: $t('Une relation ne peut pas viser une table d’une autre base.'),
  LINK_SELF_REQUIRED: $t('Une relation vers la même table ne peut pas être obligatoire.'),
  LINK_SET_NULL_ON_REQUIRED: $t(
    '« Vider à la suppression » est incompatible avec une relation obligatoire.',
  ),
  LINK_CASCADE_NOT_GRANTED: $t('La suppression en cascade exige une confirmation explicite.'),
  VALIDATION_FAILED: $t('Valeur refusée par une règle métier.'),

  // Chapter 06 — lifecycle.
  LABEL_DUPLICATE: $t('Ce libellé est déjà pris.'),
  LABEL_TOO_LONG: $t('Libellé trop long : 255 caractères au maximum.'),
  OPTION_IN_USE: $t('Ce choix est encore porté par des lignes.'),
  // The registry has one code for every text the API bounds, so this is only the fallback:
  // `messageFor` says WHICH text when `details.field` tells it.
  TEXT_TOO_LONG: $t('Texte trop long.'),
  BASE_NOT_EMPTY: $t('Cette base contient encore des tables vivantes.'),
  BASE_STRUCTURE_FROZEN: $t('La structure de cette base est gelée : une dérive a été détectée.'),
  TABLE_REFERENCED: $t('Cette table est encore visée par une relation active.'),
  DEPENDENT_OBJECT: $t('Un objet créé en SQL (une vue, par exemple) en dépend encore.'),
  ALIAS_DEPENDENT: $t('Un alias de compatibilité est encore utilisé.'),
  TARGET_PURGED: $t('Cet objet a été purgé : il n’est plus restaurable.'),
  RESTORE_TARGET_MISSING: $t('Il n’y a rien à restaurer ici.'),
  RESTORE_OUT_OF_RETENTION: $t(
    'La période de rétention est dépassée : la restauration n’est plus possible.',
  ),
  NAME_COLLISION_UNRESOLVED: $t('Impossible de trouver un nom libre.'),

  // Chapter 07 — history.
  REVISION_SUPERSEDED: $t(
    'Un de ces champs a changé depuis : annuler cette modification effacerait la plus récente.',
  ),
  RESTORE_RECORD_PRESENT: $t('Cette ligne existe de nouveau : il n’y a rien à restaurer.'),
  TRUNCATE_FORBIDDEN: $t(
    'Vider une table d’un coup est refusé : supprimez ses lignes, qui seront historisées.',
  ),
  BULK_OPERATION_REFUSED: $t('Trop de lignes dans une seule opération : découpez-la en lots.'),
  HISTORY_IMMUTABLE: $t('L’historique ne se modifie pas.'),

  // Chapter 06 — physical names, aliases, purge.
  NAME_RETIRED: $t('Ce nom a déjà servi : un nom n’est jamais réattribué, même après suppression.'),
  NAME_TAKEN_OUTSIDE_REGISTRY: $t('Un objet créé hors de basedb porte déjà ce nom dans la base.'),
  IDENTIFIER_INVALID: $t(
    'Nom invalide : lettres minuscules sans accent, chiffres et « _ », commençant par une lettre, hors mots réservés.',
  ),
  NAME_TOO_LONG: $t('Nom trop long pour PostgreSQL.'),
  TOO_MANY_ALIASES: $t(
    'Cet objet a déjà cinq alias : supprimez-en un avant de le renommer encore.',
  ),
  PURGE_TOO_EARLY: $t('La purge n’est possible que trente jours après la suppression.'),
  EXPORT_UNAVAILABLE: $t('L’export préalable à la purge n’a pas pu être écrit ou relu.'),
  EXPORT_STALE: $t(
    'Des données ont été écrites depuis l’export : refaites l’export avant de purger.',
  ),

  // Chapter 09 §7 — agent proposals.
  PROPOSAL_STALE: $t(
    'La structure de la base a changé depuis cette proposition : l’agent doit la refaire.',
  ),
  PROPOSAL_EXPIRED: $t('Cette proposition a plus de 24 heures : elle a expiré.'),
  AUTHORIZATION_REVOKED: $t(
    'La personne pour qui l’agent agit, ou son jeton, n’a plus le droit de faire cette modification.',
  ),
  TOO_MANY_OPEN_PROPOSALS: $t('Trop de propositions en attente pour ce jeton.'),

  // Chapter 03 — migrations.
  MIGRATION_IN_PROGRESS: $t('Une migration est déjà en cours sur cette base.'),
  MIGRATION_STALE: $t('Cette migration n’est plus dans un état où elle peut être appliquée.'),
  MIGRATION_TAMPERED: $t('Le plan a changé depuis sa proposition. Réessayez.'),
  MIGRATION_TOO_LARGE: $t('Ce plan dépasse la taille qu’une migration peut porter.'),
  MIGRATION_EXPIRED: $t('Cette proposition de migration a expiré.'),

  // Chapter 12 — AI. None of these is the caller's fault, and each says what to do.
  AI_DISABLED: $t('L’IA n’est pas activée sur cette instance.'),
  AI_CONSENT_REQUIRED: $t('Le consentement à l’envoi de données au fournisseur n’a pas été donné.'),
  AI_NOT_CONFIGURED: $t('Aucun fournisseur d’IA n’est configuré, ou sa clé est absente.'),
  MAIL_NOT_CONFIGURED: $t(
    'Cette instance n’envoie pas de courriels : aucun serveur d’envoi n’y est configuré.',
  ),
  RESET_TOKEN_INVALID: $t(
    'Ce lien ne vaut plus : il a déjà servi, ou ses 30 minutes sont passées. Demandez-en un nouveau.',
  ),
  AI_QUOTA_EXCEEDED: $t('Plafond d’appels à l’IA atteint.'),
  AI_PROVIDER_UNAVAILABLE: $t('Le fournisseur d’IA ne répond pas. Réessayez dans un instant.'),
  AI_RESPONSE_UNUSABLE: $t('Réponse de l’IA inutilisable. Reformulez la demande.'),
  AI_PAYLOAD_TOO_LARGE: $t('Cette base est trop grande pour tenir dans une demande.'),

  // Chapter 08 §11 — integration tokens.
  ELEVATION_REQUIRED: $t('Confirmez votre mot de passe pour faire cela.'),
  ROLE_NOT_DELEGABLE: $t('Vous ne pouvez pas accorder à un jeton des droits que vous n’avez pas.'),
  TOKEN_EXPIRY_REQUIRED: $t('La validité d’un jeton va de 1 à 365 jours.'),

  // Chapter 15 — shared forms.
  FORM_CLOSED: $t('Ce formulaire n’accepte plus de réponses.'),
  FORM_RESTRICTED: $t('Ce formulaire est réservé à certains groupes.'),
  VIEW_SHARE_CLOSED: $t('Ce partage n’est plus accessible.'),
  VIEW_SHARE_RESTRICTED: $t('Ce partage est réservé à certains groupes.'),
  VIEW_LOCKED: $t('Cette vue est verrouillée : déverrouillez-la pour la modifier.'),
  SQL_VIEW_BROKEN: $t(
    'Cette vue SQL a dû être retirée de la base par un changement de structure : corrigez sa définition.',
  ),

  // Chapters 17 and 19 — automations, integrations, synced tables.
  AUTOMATION_DISABLED: $t('Cette automatisation est désactivée ou supprimée.'),
  AUTOMATION_WEBHOOK_FAILED: $t('Le service appelé n’a pas répondu correctement.'),
  TABLE_SYNCED: $t(
    'Cette table est synchronisée : ses lignes suivent leur source et ne se modifient pas ici.',
  ),
  SYNC_SOURCE_FAILED: $t(
    'La source n’a pas pu être lue : elle est injoignable, trop grosse ou illisible.',
  ),

  // Chapter 14 — environments.
  ENVIRONMENT_IS_PRODUCTION: $t(
    'La production est la base elle-même : elle se supprime avec la base, pas seule.',
  ),
  ENVIRONMENT_MISMATCH: $t('Ces deux bases ne sont pas deux environnements d’une même base.'),
  SYNC_REFERENCE_MISSING: $t(
    'Une relation désigne une ligne absente de l’environnement cible : synchronisez d’abord la table visée.',
  ),
  SYNC_TABLE_MISSING: $t(
    'Cette table n’existe pas dans les deux environnements : reportez d’abord la structure.',
  ),
  SYNC_VALUES_REFUSED: $t(
    'Des valeurs sont refusées par l’environnement cible (choix absent, champ obligatoire…) : reportez d’abord la structure.',
  ),

  // Chapter 05 §15 — projects, people and groups.
  PROJECT_NOT_EMPTY: $t('Ce projet contient encore des bases : supprimez-les d’abord.'),
  EMAIL_TAKEN: $t('Un compte existe déjà avec cette adresse.'),
  GROUP_SYSTEM_IMMUTABLE: $t(
    'Ce groupe est fourni par basedb : il ne peut être ni renommé ni supprimé.',
  ),
  LAST_TENANT_ADMIN: $t('Il doit rester au moins un administrateur actif.'),
  ACTION_FORBIDDEN: $t('Cette action n’est pas permise.'),

  // Chapter 04 §3 bis — files.
  BODY_TOO_LARGE: $t('Fichier trop lourd.'),
  CONTENT_TYPE_INVALID: $t(
    'Ce fichier n’est pas une image acceptée : PNG, JPEG, GIF, WebP ou AVIF.',
  ),
  VALUE_OUT_OF_CONSTRAINT: $t(
    'Valeur refusée par la base : elle ne respecte pas la règle du champ.',
  ),
  SERVICE_UNAVAILABLE: $t('Service momentanément indisponible. Réessayez dans un instant.'),
}

/** Why a value was refused: the `reason` the kernel gives for `VALUE_INVALID`. */
const VALUE_REASONS: Readonly<Record<string, string>> = {
  fichier_inconnu: $t('Ce fichier n’a pas été déposé pour ce champ.'),
  reference_de_fichier: $t('Référence de fichier invalide.'),
  liste_de_textes: $t('Un choix multiple attend une liste de valeurs.'),
}

/** Why a list of choices was refused: the `reason` the kernel gives for `REQUEST_INVALID`. */
const OPTION_REASONS: Readonly<Record<string, string>> = {
  liste_vide: $t('Une liste de choix ne peut pas être vide.'),
  trop_d_options: $t('Trop de choix : 200 au maximum.'),
  vide: $t('Un choix n’a ni libellé ni valeur.'),
  valeur_absente: $t('Un choix n’a pas de valeur.'),
  trop_long: $t('Un choix est trop long : 200 caractères au maximum.'),
  caractere_nul: $t('Un choix contient un caractère interdit.'),
  couleur_invalide: $t('Couleur invalide : attendu #rrggbb.'),
  icone_invalide: $t('Nom de pictogramme invalide.'),
  image_invalide: $t('Image invalide : une adresse https ou une image png, jpeg, webp ou gif.'),
  image_trop_grande: $t('Image trop lourde : choisissez-en une plus petite.'),
  icone_et_image: $t('Un choix porte un pictogramme ou une image, pas les deux.'),
  pas_une_liste_de_choix: $t('Ce champ n’est pas une liste de choix.'),
}

/** Why the prompt or the schedule of an AI field was refused (`REQUEST_INVALID`). */
const AI_REASONS: Readonly<Record<string, string>> = {
  consigne_vide: $t('La consigne est vide.'),
  consigne_trop_longue: $t('Consigne trop longue : 8 000 caractères au maximum.'),
  variable_circulaire: $t('Un champ IA ne peut pas se citer lui-même.'),
  cron_invalide: $t('Planification invalide.'),
  fuseau_inconnu: $t('Fuseau horaire inconnu.'),
  cron_sans_date: $t('Cette planification ne tombe jamais : aucune date ne la satisfait.'),
  frequence_trop_haute: $t('Trop fréquent : un recalcul toutes les 15 minutes au plus.'),
  pas_un_champ_ia: $t('Ce champ n’est pas un champ IA.'),
}

/** Why a view's configuration was refused (`REQUEST_INVALID`, `field: 'spec'`). */
const VIEW_REASONS: Readonly<Record<string, string>> = {
  champ_pivot_manquant: $t('Choisissez le champ pivot de la vue.'),
  type_de_champ_incompatible: $t('Ce champ n’a pas le type qu’attend la vue.'),
  champ_inconnu: $t('La vue cite un champ inconnu : il a peut-être été supprimé.'),
  cle_inconnue: $t('Configuration de vue invalide.'),
  doublon: $t('Un même champ est cité deux fois.'),
  formulaire_vide: $t('Un formulaire doit poser au moins une question.'),
  trop_de_tris: $t('Trois critères de tri au plus.'),
  texte_trop_long: $t('Un texte de la vue est trop long.'),
  spec_trop_volumineux: $t('Configuration de vue trop volumineuse.'),
  spec_invalide: $t('Configuration de vue invalide.'),
  valeur_invalide: $t('Configuration de vue invalide.'),
}

/**
 * The sentence for a code, refined by what the refusal carries when the code alone is
 * ambiguous. `TEXT_TOO_LONG` is the case: it is raised for any bounded text, and "trop
 * long" is no help to someone who has not been told which box to shorten.
 */
function explain(e: ApiError): string {
  // A formula's refusal names where: the field it cannot find, the position it stopped at.
  if (e.code.startsWith('FORMULA_')) {
    const base = EXPLANATIONS[e.code] ?? $t('La formule est refusée.')
    const where =
      typeof e.details.field === 'string'
        ? ` — [${e.details.field}]`
        : typeof e.details.position === 'number'
          ? $t(' — au caractère {value}', { value: e.details.position + 1 })
          : ''
    return `${base}${where}`
  }

  // A choice that rows still carry cannot leave the list. The count is the whole point of
  // the refusal: it says how much data stands in the way.
  if (e.code === 'OPTION_IN_USE' && Array.isArray(e.details.options)) {
    const used = (e.details.options as Array<{ value?: unknown; count?: unknown }>)
      .map(
        (o) =>
          `« ${String(o.value)} » (${$tp(Number(o.count), '{count} ligne', '{count} lignes')})`,
      )
      .join(', ')
    return $t('Impossible de retirer {used} : ce choix est encore utilisé.', { used })
  }

  // `description`, or the path to one inside a payload — `fields[0].description` when a
  // table is created with its columns.
  const field = e.details.field
  // A person's name is not a « libellé » to the person typing it.
  if (e.code === 'LABEL_EMPTY' && field === 'display_name')
    return $t('Le nom ne peut pas être vide.')
  if (e.code === 'LABEL_TOO_LONG' && field === 'display_name') {
    return $t('Nom trop long : 120 caractères au maximum.')
  }
  // A copy of rows that needs another table's rows first: that table is named.
  if (e.code === 'SYNC_REFERENCE_MISSING' && typeof e.details.target === 'string') {
    return $t(
      'Des lignes pointent vers « {target} », qui n’a pas encore ces lignes dans l’environnement cible : synchronisez-la d’abord.',
      { target: e.details.target },
    )
  }
  // A row brought back that points to a row gone since: the restoration names what blocks.
  if (e.code === 'RESTORE_TARGET_MISSING' && typeof e.details.record === 'string') {
    return $t('Une ligne vers laquelle elle pointait n’existe plus : restaurez-la d’abord.')
  }
  // Chapter 06: what blocks is named — a view someone built, a name already used.
  if (e.code === 'DEPENDENT_OBJECT' && e.details.kind === 'sql_view') {
    return $t('La vue SQL « {dependent} » la lit : modifiez-la ou supprimez-la d’abord.', {
      dependent: String(e.details.dependent),
    })
  }
  if (e.code === 'DEPENDENT_OBJECT') {
    const named = Array.isArray(e.details.dependents)
      ? (e.details.dependents as unknown[]).map(String)
      : typeof e.details.dependent === 'string'
        ? [e.details.dependent]
        : []
    if (named.length > 0) {
      return $t(
        'Des objets créés hors de basedb en dépendent : {named}. Ils doivent être supprimés d’abord, par leur auteur.',
        { named: named.join(', ') },
      )
    }
  }
  if (e.code === 'NAME_RETIRED' && typeof e.details.suggestion === 'string') {
    return $t('Ce nom a déjà servi, et un nom n’est jamais réattribué. Libre : « {suggestion} ».', {
      suggestion: e.details.suggestion,
    })
  }
  if (e.code === 'NAME_TAKEN_OUTSIDE_REGISTRY' && typeof e.details.owner === 'string') {
    return $t('Un objet créé hors de basedb (propriétaire {owner}) porte déjà ce nom.', {
      owner: e.details.owner,
    })
  }
  if (e.code === 'EXPORT_UNAVAILABLE' && e.details.reason === 'trop_volumineux') {
    return $t('Trop de lignes pour un export depuis l’interface (2 millions au plus).')
  }
  if (e.code === 'EXPORT_UNAVAILABLE' && e.details.reason === 'repertoire_absent') {
    return $t('Aucun répertoire d’export n’est configuré sur le serveur (BASEDB_EXPORT_DIR).')
  }
  if (e.code === 'PURGE_TOO_EARLY' && typeof e.details.purgeable_from === 'string') {
    const at = new Date(e.details.purgeable_from).toLocaleDateString(intlLocale())
    return $t(
      'Purge possible à partir du {at}. Seul un administrateur d’instance peut l’avancer, en le justifiant.',
      { at },
    )
  }
  // The public demo: what it refuses, and its AI (apps/api/src/demo.ts).
  if (e.details.reason === 'demo') {
    return e.code === 'AI_DISABLED'
      ? $t('L’IA n’est pas disponible dans la version de démo.')
      : $t('Cette action n’est pas disponible dans la version de démo.')
  }
  // Sharing a project or a base (chapter 05 §15.8).
  if (e.code === 'ACTION_FORBIDDEN' && e.details.reason === 'son_propre_acces') {
    return $t('Vous ne pouvez pas modifier votre propre accès.')
  }
  if (e.code === 'ACTION_FORBIDDEN' && e.details.reason === 'herite') {
    return $t('Cet accès vient du projet : modifiez-le depuis le partage du projet.')
  }
  // Creating one's own account on an instance kept to some domains (chapter 13 §8).
  if (e.code === 'REQUEST_INVALID' && e.details.reason === 'domaine_refuse') {
    const domains = Array.isArray(e.details.domains)
      ? e.details.domains.map((d) => `@${String(d)}`).join(', ')
      : ''
    return domains === ''
      ? $t('Cette adresse n’est pas acceptée sur cette instance.')
      : $t('Les comptes sont réservés aux adresses {domains}.', { domains })
  }
  if (e.code === 'ACTION_FORBIDDEN' && e.details.reason === 'soi_meme') {
    return $t('Vous ne pouvez pas désactiver votre propre compte.')
  }
  // One's own account, from the settings (chapter 13 §2.6, §3.5).
  if (e.code === 'ACTION_FORBIDDEN' && e.details.reason === 'adresse_du_fournisseur') {
    return $t('Votre adresse vient de votre fournisseur d’identité : elle ne se change pas ici.')
  }
  if (e.code === 'REQUEST_INVALID' && e.details.reason === 'identite_deja_liee') {
    return $t('Ce compte chez le fournisseur est déjà lié à un autre compte basedb.')
  }
  if (e.code === 'REQUEST_INVALID' && e.details.reason === 'fournisseur_deja_lie') {
    return $t('Un autre compte de ce fournisseur est déjà lié au vôtre : déliez-le d’abord.')
  }
  if (e.code === 'REQUEST_INVALID' && e.details.reason === 'derniere_identite') {
    return $t('C’est votre seul moyen de connexion : il ne peut pas être délié.')
  }
  if (e.code === 'REQUEST_INVALID') {
    if (field === 'email') return $t('Adresse électronique invalide.')
    const reason = e.details.reason
    if (field === 'spec' && typeof reason === 'string') {
      return VIEW_REASONS[reason] ?? $t('Configuration de vue invalide.')
    }
    // A citation that designates nothing is named: it is the one to correct.
    if (reason === 'variable_inconnue' && typeof e.details.variable === 'string') {
      return $t('La consigne cite « {variable} », qui n’est pas une colonne lisible de la table.', {
        variable: e.details.variable,
      })
    }
    if (reason === 'cron_invalide' && typeof e.details.detail === 'string') {
      return $t('Planification invalide — {detail}.', { detail: e.details.detail })
    }
    const known =
      typeof reason === 'string' ? (OPTION_REASONS[reason] ?? AI_REASONS[reason]) : undefined
    if (known !== undefined) return known
    if (field === 'options') return $t('Liste de choix invalide.')
  }
  if (e.code === 'VALUE_INVALID' && typeof e.details.reason === 'string') {
    const known = VALUE_REASONS[e.details.reason]
    if (known !== undefined) return known
  }
  if (e.code === 'BODY_TOO_LARGE' && typeof e.details.maximum === 'number') {
    return $t('Fichier trop lourd : {floor} Mo au maximum.', {
      floor: Math.floor(e.details.maximum / (1024 * 1024)),
    })
  }
  if (e.code === 'VALUE_OUT_OF_RANGE' && e.details.reason === 'trop_de_fichiers') {
    return $t('Trop de fichiers dans ce champ : {maximum} au maximum.', {
      maximum: String(e.details.maximum),
    })
  }
  if (e.code === 'TEXT_TOO_LONG' && typeof field === 'string' && /(^|\.)description$/.test(field)) {
    // The bound comes from the refusal, so the sentence follows the server if it moves.
    const maximum = typeof e.details.maximum === 'number' ? e.details.maximum : 1000
    return $t('Description trop longue : {maximum} caractères au maximum.', { maximum })
  }
  return EXPLANATIONS[e.code] ?? $t('Erreur inattendue.')
}

export function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    const detail = explain(e)
    // The login refusal carries no code and no trace: the one thing this screen must
    // not do is give a stranger something to tell two attempts apart by.
    if (e.code === 'CREDENTIALS_INVALID') return detail
    // A limit of the demo, not a fault: nothing to trace.
    if (e.details.reason === 'demo') return detail
    const trace = e.requestId !== '' ? ` · ${e.requestId.slice(0, 8)}` : ''
    return `${detail} (${e.code}${trace})`
  }
  return $t('L’API est injoignable.')
}

/**
 * The sentence alone, without the code and the trace — for a refusal shown next to the
 * box it concerns, while a person is still typing, where a code would be noise.
 */
export function reasonFor(e: unknown): string {
  return e instanceof ApiError ? explain(e) : $t('L’API est injoignable.')
}

/** The sentence for a code recorded earlier — the last incident of an AI field. */
export function sentenceFor(code: string): string {
  return EXPLANATIONS[code] ?? code
}
