import { type Template, type TemplateIssue, checkTemplate } from '@basedb/contracts'
import { type ProviderTransport, assertQuota, invoke, resolveProvider } from '../ai/draft.js'
import { BasedbError } from '../errors/index.js'
import { loadProjectTarget, requireAction } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * A base template proposed by the AI — chapter 20 §5, chapter 12 §1.7.
 *
 * A draft like the others (INV-IA1): the proposal is checked by the templates' validator
 * in repair mode — what does not hold is dropped and said —, shown whole, and becomes a
 * base only by the person's gesture, through the ordinary routes.
 *
 * INV-IA2 holds without exception: the payload carries the sentence, the previous proposal
 * when the person refines it — a template the AI wrote itself —, and today's date. No
 * label, no value of any base.
 */

export interface TemplateDraftRequest {
  /** The project the base will be created in: the permission is the act prepared. */
  readonly projectId: string
  readonly request: string
  /** The proposal being refined, as the gallery shows it. */
  readonly previous?: unknown
}

export interface TemplateDraft {
  readonly template: Template
  readonly explanation: string
  /** What the repair dropped, said under the proposal. */
  readonly issues: readonly TemplateIssue[]
}

const MAX_REQUEST_CHARS = 2000
/** Past this, the previous proposal travels without its rows: the payload has a ceiling. */
const PREVIOUS_MAX_BYTES = 40 * 1024

const TEMPLATE_DRAFT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['template', 'explanation'],
  properties: {
    template: {
      type: 'object',
      required: ['label', 'summary', 'tables'],
      properties: {
        key: { type: 'string' },
        label: { type: 'string' },
        summary: { type: 'string' },
        category: { type: 'string' },
        icon: { type: 'string' },
        tables: { type: 'array' },
        links: { type: 'array' },
        rows: { type: 'object' },
        views: { type: 'array' },
        dashboards: { type: 'array' },
        automations: { type: 'array' },
      },
    },
    explanation: { type: 'string' },
  },
}

const TEMPLATE_SYSTEM = `Tu conçois des modèles de base de données pour basedb, une base collaborative dont chaque table est une vraie table PostgreSQL. On te décrit un besoin en une phrase ; tu réponds par UN objet JSON, et rien d'autre :
{ "template": { …le modèle… }, "explanation": "deux phrases qui disent ce que tu as prévu et pourquoi" }

Tout est en français : libellés, choix, lignes d'exemple. Les libellés sont courts, avec une majuscule initiale et des accents.

FORMAT DU MODÈLE
{
  "key": "mots-en-minuscules-avec-tirets",
  "label": "Nom du modèle", "summary": "Une phrase.", "category": "Une catégorie courte", "icon": "nom d'icône",
  "base": { "label": "Nom de la base", "description": "À quoi elle sert." },
  "tables": [ { "key": "cle_table", "label": "Libellé", "description": "…", "icon": "…", "fields": [ …champs… ] } ],
  "links": [ { "from": "cle_table", "label": "Libellé du champ relation", "to": "cle_autre_table", "multiple": false } ],
  "rows": { "cle_table": [ { "$key": "cle-ligne", "Libellé du champ": valeur, … } ] },
  "views": [ …vues… ], "dashboards": [ …tableaux de bord… ], "automations": [ …automatisations… ]
}

TABLES ET CHAMPS
- De 2 à 5 tables, de 4 à 12 champs chacune. Le PREMIER champ de chaque table est son nom ou son titre, de type short_text.
- Un champ : { "label": "…", "kind": "…", "description": "facultative" }. Types (kind) : short_text, long_text, number, boolean, date, datetime, select, multi_select, url, email, user, autonumber, formula, lookup, rollup, count.
- select et multi_select : "options": ["Choix 1", "Choix 2", …] (3 à 7 choix), ou des objets { "label": "…", "color": "#rrggbb" }.
- number peut avoir "format": { "display": "currency", "currency": "EUR" } ou { "display": "percent" } ou { "display": "rating", "rating_max": 5 } ou { "display": "duration" }.
- Une relation n'est JAMAIS un champ : déclare-la dans "links". Elle ajoute à la table "from" un champ du libellé donné. "multiple": true pour plusieurs lignes.
- formula : "formula": "[Prix] * [Quantité]". Les champs se citent [Libellé] ; séparateur d'arguments « ; » ; point décimal. Fonctions : SI(c;a;b), ET, OU, NON, ARRONDI(x;n), ABS, MIN(a;b), MAX(a;b), JOURS(a;b) (jours de b à a), AJOUTER_JOURS(d;n), AUJOURDHUI(), ANNEE(d), MOIS(d), JOUR(d), ESTVIDE(x), SIVIDE(a;b), MAJUSCULE, GAUCHE(x;n), LONGUEUR(x), & pour concaténer du texte. Une formule cite des champs de sa table, déclarés avant elle s'ils sont calculés.
- lookup : "rollup": { "via": "Libellé de la relation", "target": "Champ lu dans la table visée" }.
- rollup : "rollup": { "via": "…", "target": "…", "aggregate": "sum" } (count, sum, avg, min, max).
- count : "rollup": { "via": "Libellé de la relation", "table": "cle_de_la_table_qui_porte_la_relation" } pour compter les lignes d'une autre table qui pointent vers celle-ci. Le même "table" sert à un rollup sur une relation qui arrive.
- user : une personne du compte.

CHAMPS CALCULÉS PAR L'IA — la force de basedb, utilise-les dès que le besoin comporte du texte à lire, classer, résumer, noter ou rédiger (un avis, un ticket, une candidature, un article, une demande…) : 1 à 3 champs IA.
- Ajoute "ai": { "prompt": "Consigne qui cite {{Libellé}} des champs de la même table" } à un champ de type short_text, long_text, number, select, boolean, date ou url. Jamais sur le premier champ.
- Un select IA a ses options : l'IA choisira parmi elles. Exemples : un sentiment (Positif, Neutre, Négatif), une catégorie, une priorité, un score de 1 à 5 (number, format rating), un résumé (short_text), une réponse proposée (long_text).

LIGNES D'EXEMPLE
- 5 à 10 lignes par table, crédibles, variées, en français (noms, entreprises, textes réalistes).
- Valeurs par libellé de champ. Un select par le libellé du choix ; un multi_select par une liste de libellés ; une relation par "@cle-ligne" (la "$key" d'une ligne de la table visée), une liste pour une relation multiple ; une date relative au jour : "today", "+3d", "-2w", "+1m" (ou "2026-10-01") ; une date-heure "+1d 14:30" ; une personne par "$moi" seulement.
- Donne aussi une valeur d'exemple aux champs IA : elle sert si l'IA n'est pas configurée. Ne donne aucune valeur aux champs formula, lookup, rollup, count, autonumber.

VUES — 3 à 6 : { "table": "cle", "label": "…", "kind": "…", "spec": { … } }, champs cités par leur libellé.
- grid : { "filter": "[Statut] ne \\"Terminé\\"", "sorts": [{ "field": "Échéance", "direction": "asc" }], "group_by": "…" }
- kanban : { "group_by": "un select", "card_fields": ["…", "…"] }
- calendar : { "date_field": "une date", "card_fields": ["…"] }
- timeline : { "start_field": "date de début", "end_field": "date de fin" }
- gallery : { "card_fields": ["…"] } ; list : { "group_by": "un select", "card_fields": ["…"] }
- form : { "title": "…", "description": "…", "fields": [{ "field": "Libellé", "required": true }] } — questions de type texte, nombre, date, case, choix ou e-mail seulement.
- Filtres : [Libellé] suivi de eq, ne, gt, gte, lt, lte ou contains et d'une valeur ; un texte entre guillemets ; un choix par son libellé ; une case : eq true ; un champ vide : [Libellé] is_null, sans valeur (not [Libellé] is_null pour un champ rempli) ; and, or.

TABLEAU DE BORD — un seul, 3 à 6 blocs : { "label": "…", "blocks": [ … ] }
- { "kind": "number", "title": "…", "table": "cle", "aggregate": "count", "filter": "…" } ou "aggregate": "sum"/"avg" avec "field": "Libellé".
- { "kind": "chart", "title": "…", "table": "cle", "group_by": "un select", "style": "bar" ou "pie" }
- { "kind": "list", "title": "…", "table": "cle", "fields": ["…"], "filter": "…", "sort": "Libellé" ou "-Libellé", "limit": 5 }
- { "kind": "text", "title": "…", "body": "…" }. "width": 1, 2 ou 3 (sur 3 colonnes).

AUTOMATISATIONS — 0 à 2, seulement si elles servent vraiment :
{ "label": "…", "trigger": { "kind": "record_updated", "table": "cle", "fields": ["Statut"] }, "condition": "[Statut] eq \\"Terminé\\"", "actions": [ … ] }
- trigger.kind : record_created, record_updated ; actions : { "kind": "update_record", "values": { "Libellé": "valeur ou {{Libellé}} ou {{_maintenant}}" } }, { "kind": "create_record", "table": "cle", "values": { … } }, { "kind": "notify", "users": ["$moi"], "message": "… {{Libellé}} …" }.

INTERDIT : fichiers, images, webhooks, partages, liens publics, personnes autres que "$moi".

Icônes (champ "icon") : bug, rocket, users, user, building-2, briefcase, package, truck, shopping-cart, receipt, wallet, calendar, clock, message-square, mail, star, heart, flag, target, trophy, lightbulb, award, list-todo, clipboard-list, file-text, folder, tag, map-pin, house, wrench, sparkles, megaphone, chart-bar, handshake, gift, coffee, leaf, globe, camera, music.

Si "previous" est fourni, c'est ta proposition précédente : applique la demande à ce modèle, garde ce qui n'est pas concerné, et renvoie le modèle ENTIER.`

/** Proposes a whole base template from a sentence — or refines the previous proposal. */
export async function draftTemplate(
  pools: Pools,
  ctx: RequestContext,
  transport: ProviderTransport,
  request: TemplateDraftRequest,
): Promise<TemplateDraft> {
  const sentence = typeof request.request === 'string' ? request.request.trim() : ''
  if (sentence === '' || sentence.length > MAX_REQUEST_CHARS) {
    throw new BasedbError('REQUEST_INVALID', {
      details: { field: 'request', reason: sentence === '' ? 'vide' : 'trop_long' },
    })
  }

  const config = await withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      const project = await loadProjectTarget(exec, ctx, request.projectId)
      await requireAction(exec, ctx, 'manage_schema', project, { project: request.projectId })
      const resolved = await resolveProvider(exec, ctx)
      await assertQuota(exec, ctx)
      return resolved
    },
    { readOnly: true },
  )

  const payload: Record<string, unknown> = {
    intent: 'template_draft',
    request: sentence,
    today: new Date().toISOString().slice(0, 10),
  }
  if (request.previous !== undefined && request.previous !== null) {
    const previous = checkTemplate(request.previous, { repair: true })
    if (previous.ok) {
      const whole = JSON.stringify(previous.template)
      payload.previous =
        Buffer.byteLength(whole, 'utf8') <= PREVIOUS_MAX_BYTES
          ? previous.template
          : { ...previous.template, rows: {}, note: 'lignes omises : propose-les à nouveau' }
    }
  }

  const answer = await invoke(
    pools,
    ctx,
    transport,
    config,
    'template_draft',
    null,
    payload,
    TEMPLATE_DRAFT_SCHEMA,
    TEMPLATE_SYSTEM,
    { timeoutMs: 90_000, maxTokens: 12_000 },
  )

  const check = checkTemplate(answer.template, { repair: true })
  if (!check.ok) {
    throw new BasedbError('AI_RESPONSE_UNUSABLE', {
      details: { reason: 'modèle inutilisable', issues: check.issues.slice(0, 10) },
    })
  }
  return {
    template: check.template,
    explanation: typeof answer.explanation === 'string' ? answer.explanation.slice(0, 2000) : '',
    issues: check.issues,
  }
}
