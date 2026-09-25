import { ERROR_CODES } from '@basedb/contracts'
import { BasedbError } from '@basedb/core'

/**
 * Errors as an agent reads them — chapter 09 §14.
 *
 * A failure is a tool result in error whose text is a stable JSON object: a `code` of
 * the single registry (A23), a `message` in French, FIXED per code — no string an agent
 * sent is ever interpolated into it, the offending name stays in `invalid_params` — and
 * a `hint` that lets the agent correct itself in one try. A `hint` only cites what the
 * bearer can already see, and here it cites nothing but tools.
 */

export interface ErrorPayload {
  readonly code: string
  readonly message: string
  /** The object concerned, only when the bearer can see it. */
  readonly object?: { readonly kind: string; readonly name: string }
  readonly invalid_params?: readonly string[]
  readonly details?: Readonly<Record<string, unknown>>
  readonly hint?: string
  readonly retryable: boolean
  readonly retry_after?: number
  readonly request_id?: string
}

/** One sentence per code, affirmative, naming nothing the agent wrote. */
const MESSAGES: Readonly<Record<string, string>> = {
  PARAMETER_INVALID: 'Un paramètre ne respecte pas le schéma de l’outil.',
  RESOURCE_NOT_FOUND: 'La ressource demandée est introuvable.',
  NAME_AMBIGUOUS: 'Ce nom désigne plusieurs objets.',
  FIELD_UNKNOWN: 'Le champ demandé n’existe pas dans cette table.',
  FIELD_NOT_EXPANDABLE: 'Ce champ ne peut pas être développé.',
  FIELD_NOT_WRITABLE: 'Ce champ n’est pas modifiable par cette surface.',
  VALUE_INVALID: 'Une valeur ne correspond pas au type de son champ.',
  VALUE_TOO_LONG: 'Une valeur dépasse la longueur maximale de son champ.',
  VALUE_OUT_OF_RANGE: 'Une valeur sort des bornes de son champ.',
  VALUE_OUT_OF_CONSTRAINT: 'Une valeur ne respecte pas une contrainte de la table.',
  REQUIRED_VALUE_MISSING: 'Un champ obligatoire est vide.',
  DUPLICATE_VALUE: 'Une valeur existe déjà dans un champ qui l’interdit.',
  TEXT_TOO_LONG: 'Le texte dépasse la longueur autorisée.',
  MCP_OPERATION_EXCLUDED: 'Cette opération n’existe pas sur la surface MCP.',
  TOKEN_READ_ONLY: 'Ce jeton est en lecture seule.',
  TOKEN_SUSPENDED: 'Ce jeton est suspendu.',
  TOKEN_INVALID: 'Le jeton présenté n’est pas valide pour cette surface.',
  TOKEN_EXPIRED: 'Le jeton présenté a expiré.',
  TOKEN_REVOKED: 'Le jeton présenté a été révoqué.',
  SESSION_NOT_INITIALIZED: 'La session n’est pas initialisée : envoyez d’abord initialize.',
  CURSOR_INVALID: 'Le curseur n’est pas valide pour cette requête.',
  QUOTA_EXCEEDED: 'Le quota d’appels de ce jeton est atteint.',
  CONCURRENCY_CONFLICT: 'Un conflit d’accès concurrent a interrompu l’opération.',
  PERMISSION_DENIED: 'Ce jeton peut lire cet objet mais pas y faire cette action.',
  IDEMPOTENCY_CONFLICT: 'Cette clé d’idempotence a déjà servi pour un autre appel.',
  IDEMPOTENCY_IN_PROGRESS: 'Un appel portant cette clé d’idempotence est en cours.',
  IDEMPOTENCY_INTERRUPTED: 'L’appel portant cette clé d’idempotence a été interrompu.',
  IDEMPOTENCY_STALE: 'Les droits ont changé depuis l’appel portant cette clé d’idempotence.',
  LINK_TARGET_NOT_FOUND: 'La ligne cible de ce lien est introuvable.',
  LOCK_UNAVAILABLE: 'La table est momentanément verrouillée.',
  FILTER_OPERATOR_INVALID: 'Cet opérateur ne s’applique pas à ce champ.',
  FILTER_TOO_COMPLEX: 'Le filtre est trop complexe.',
  SORT_UNAVAILABLE: 'Ce champ ne peut pas servir au tri.',
  EXPAND_TOO_WIDE: 'Le développement demandé dépasse les bornes autorisées.',
  EXPAND_TOO_DEEP: 'Le développement ne va pas au-delà d’un niveau.',
  DEADLINE_EXCEEDED: 'L’opération a dépassé son délai.',
  SERVICE_UNAVAILABLE: 'Le service est momentanément indisponible.',
  INTERNAL_ERROR: 'Erreur interne du serveur.',
}

/** What to do next — closed sentences, citing tools and never an object. */
const HINTS: Readonly<Record<string, string>> = {
  PARAMETER_INVALID:
    'Corrigez les paramètres listés dans invalid_params d’après le schéma de l’outil.',
  RESOURCE_NOT_FOUND:
    'Utilisez list_bases puis describe_base pour connaître les bases et tables accessibles.',
  FIELD_UNKNOWN: 'Utilisez describe_table pour la liste des champs de cette table.',
  FIELD_NOT_EXPANDABLE:
    'Seuls les champs lien marqués expandable dans describe_table se développent.',
  FIELD_NOT_WRITABLE:
    'Les colonnes système et les champs formule ne se modifient jamais ; voir access dans describe_table.',
  VALUE_INVALID:
    'Le format attendu figure dans details.expected ; voir la description de create_record.',
  VALUE_TOO_LONG:
    'La longueur maximale figure dans details.maximum et dans describe_table (max_length).',
  REQUIRED_VALUE_MISSING: 'Renseignez les champs marqués required dans describe_table.',
  DUPLICATE_VALUE: 'Ce champ exige une valeur unique : une autre ligne porte déjà celle-ci.',
  MCP_OPERATION_EXCLUDED: 'Cette opération se fait dans l’interface basedb, par une personne.',
  TOKEN_READ_ONLY: 'Un jeton en lecture et écriture se crée dans l’interface basedb.',
  TOKEN_SUSPENDED: 'La suspension se lève dans l’interface basedb, écran Intégrations.',
  TOKEN_INVALID: 'Vérifiez le jeton configuré, ou créez-en un dans l’interface basedb.',
  TOKEN_EXPIRED: 'Créez un nouveau jeton dans l’interface basedb.',
  TOKEN_REVOKED: 'Créez un nouveau jeton dans l’interface basedb.',
  SESSION_NOT_INITIALIZED: 'Envoyez initialize avant tout autre message.',
  CURSOR_INVALID: 'Relancez la requête sans cursor pour repartir de la première page.',
  QUOTA_EXCEEDED: 'Patientez retry_after secondes avant de réessayer.',
  CONCURRENCY_CONFLICT: 'Réessayez l’appel.',
  PERMISSION_DENIED:
    'Demandez ce droit à la personne qui a créé le jeton ; voir access dans describe_table.',
  IDEMPOTENCY_CONFLICT: 'Utilisez une nouvelle clé d’idempotence pour un appel différent.',
  IDEMPOTENCY_IN_PROGRESS: 'Réessayez dans une seconde avec la même clé.',
  IDEMPOTENCY_INTERRUPTED:
    'Vérifiez avec list_records ou get_record avant de réessayer avec une nouvelle clé.',
  IDEMPOTENCY_STALE: 'Relisez l’état avec get_record, puis réessayez avec une nouvelle clé.',
  LINK_TARGET_NOT_FOUND:
    'Un lien se renseigne avec le _id d’une ligne de la table cible ; lookup_records le trouve.',
  LOCK_UNAVAILABLE: 'Réessayez dans quelques instants.',
  FILTER_OPERATOR_INVALID:
    'Les opérateurs admis par type figurent dans la description de list_records.',
  SORT_UNAVAILABLE: 'Triez sur un autre champ.',
  EXPAND_TOO_WIDE: 'Développez moins de champs lien à la fois.',
  DEADLINE_EXCEEDED: 'Resserrez le filtre ou réduisez limit.',
  SERVICE_UNAVAILABLE: 'Réessayez dans quelques instants.',
}

/** Specific hints, chosen by the kernel through a closed marker in the details. */
const SPECIFIC_HINTS: Readonly<Record<string, string>> = {
  describe_table: 'Cette table n’a pas de champ d’affichage lisible : consultez describe_table.',
  rich_text: 'Les champs de texte riche se modifient dans l’interface basedb.',
}

const RETRYABLE: ReadonlySet<string> = new Set([
  'QUOTA_EXCEEDED',
  'CONCURRENCY_CONFLICT',
  'LOCK_UNAVAILABLE',
  'IDEMPOTENCY_IN_PROGRESS',
  'SERVICE_UNAVAILABLE',
])

/** Detail keys allowed through: each names only what the bearer may see. */
const SAFE_DETAILS = ['field', 'expected', 'maximum', 'action'] as const

/**
 * True for a defect of the product, which the caller did nothing to cause.
 *
 * The kernel files every code WITHOUT an HTTP status as an incident — which the codes of
 * this surface all are (chapter 09 gives them none). They are ordinary refusals here.
 */
function isIncident(error: BasedbError): boolean {
  return error.class === 'incident' && ERROR_CODES[error.code].chapter !== '09'
}

/** The error payload of §14.1, from any error the tool call raised. */
export function errorPayload(error: unknown, requestId: string): ErrorPayload {
  if (!(error instanceof BasedbError) || isIncident(error)) {
    // An incident discloses an identifier and nothing else: no stack, no server message.
    return {
      code: 'INTERNAL_ERROR',
      message: MESSAGES.INTERNAL_ERROR,
      retryable: false,
      request_id: requestId,
    }
  }

  const d = error.details as Record<string, unknown>
  const object =
    d.object !== null &&
    typeof d.object === 'object' &&
    typeof (d.object as { name?: unknown }).name === 'string'
      ? (d.object as { kind: string; name: string })
      : undefined
  const invalid = Array.isArray(d.invalid_params)
    ? (d.invalid_params as string[])
    : typeof d.param === 'string'
      ? [d.param]
      : undefined
  const details = Object.fromEntries(
    SAFE_DETAILS.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]),
  )
  const specific = typeof d.hint === 'string' ? SPECIFIC_HINTS[d.hint] : undefined
  const hint = specific ?? HINTS[error.code]

  return {
    code: error.code,
    message: MESSAGES[error.code] ?? 'La requête a été refusée.',
    ...(object === undefined ? {} : { object: { kind: object.kind, name: object.name } }),
    ...(invalid === undefined ? {} : { invalid_params: invalid }),
    ...(Object.keys(details).length === 0 ? {} : { details }),
    ...(hint === undefined ? {} : { hint }),
    retryable: RETRYABLE.has(error.code),
    ...(typeof d.retry_after === 'number' ? { retry_after: d.retry_after } : {}),
  }
}

/** Stage 1 (§14.2): a refusal that names parameters, and no object of the catalog. */
export function parameterInvalid(invalid: readonly string[]): BasedbError {
  return new BasedbError('PARAMETER_INVALID', { details: { invalid_params: [...invalid] } })
}

export { MESSAGES }
