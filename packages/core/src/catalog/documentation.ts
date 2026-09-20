import { escapeLabel } from './labels.js'
import type { ProjectedBase, ProjectedField, ProjectedTable } from './projection.js'

/**
 * Readable documentation — chapter 08 §9.4.
 *
 * THIRD serialization of the same projection. Two documents rather than one, because
 * the two audiences do not ask the same thing: a client generator wants schemas, enums
 * and return codes; a human integrator wants to know what a link field is, why a
 * deletion is refused, and what awaits them if they write in direct SQL. Merging the
 * two would drown the machine contract in prose, or send the human back to a
 * specification they cannot read.
 *
 * Every label and every description passes through `escapeLabel`: this is Markdown, and a
 * viewer renders it.
 *
 * THE MARKDOWN SUBSET. The generator emits a small, closed subset, and the web viewer
 * renders exactly that — anything else is shown as text, which is the safe outcome:
 *
 *   - `###` and `####` headings (the section title is `DocSection.title`, not a heading);
 *   - paragraphs, `-` lists (nested by two spaces), inline `code` and **bold**;
 *   - GFM tables, whose cells hold only inline content;
 *   - `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` callouts;
 *   - fenced blocks (```` ```bash title="cURL" ````). Consecutive fences form one tab
 *     group; an inline code cell that is exactly an HTTP verb is drawn as a method badge.
 *
 * Each of these degrades to something readable in any other Markdown viewer, which is why
 * they were chosen over a structured format the chapter never asked for.
 */

export interface DocSection {
  readonly id: string
  readonly title: string
  /** Navigation group, in order of first appearance: what a sidebar titles its sections. */
  readonly group: string
  readonly markdown: string
}

export interface Documentation {
  readonly title: string
  readonly sections: readonly DocSection[]
}

const GROUP_START = 'Prise en main'
const GROUP_TABLES = 'Tables'
const GROUP_REFERENCE = 'Référence'

/** How each type arrives in JSON — the normative table of §7.2, in prose. */
const TYPE_LABEL: Readonly<Record<string, string>> = {
  short_text: 'texte',
  long_text: 'texte long',
  number: 'nombre (chaîne décimale)',
  boolean: 'booléen',
  date: 'date (`2026-09-18`)',
  datetime: 'date-heure UTC (`2026-09-18T14:03:00.000Z`)',
  select: 'liste de choix',
  link: 'lien',
  formula: 'formule',
  system: 'colonne système',
}

// ── Building blocks ───────────────────────────────────────────────────────────────────

/** Inline text from a user: escaped, and on ONE line so that it can sit in a table cell. */
function inline(text: string): string {
  return escapeLabel(text.replace(/\s+/g, ' ').trim())
}

/**
 * A description as a paragraph.
 *
 * `escapeLabel` deliberately leaves `-` and `.` alone, because they only matter at the
 * start of a line and the generator never puts a label first on one. A description IS
 * placed first on a line, so a leading list marker is neutralized here.
 */
function paragraph(text: string): string {
  return inline(text)
    .replace(/^([-+])/, '\\$1')
    .replace(/^(\d+)\./, '$1\\.')
}

function code(text: string): string {
  return `\`${text}\``
}

function row(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`
}

function mdTable(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  return [row(header), row(header.map(() => '---')), ...rows.map(row)]
}

type CalloutKind = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING'

function callout(kind: CalloutKind, ...lines: string[]): string[] {
  return [`> [!${kind}]`, ...lines.map((line) => `> ${line}`).map((line) => line.trimEnd())]
}

function fence(lang: string, title: string | undefined, body: readonly string[]): string[] {
  const info = title === undefined ? lang : `${lang} title="${title}"`
  return [`\`\`\`${info}`, ...body, '```']
}

/** An option value as it can safely appear in prose: code when plain, escaped otherwise. */
function literal(value: string): string {
  return /^[A-Za-z0-9_.-]+$/.test(value) ? code(value) : inline(value)
}

// ── Examples ──────────────────────────────────────────────────────────────────────────

/** A well-formed identifier that belongs to no row: an example must never be a real one. */
const EXAMPLE_ID = '0192f3c2-7b1e-7c4a-9a55-3e2f5d0c8b11'

/**
 * A value of the right shape for a field, for the examples.
 *
 * Built from the KIND, never from data: a documentation that quoted a real cell would
 * publish it to whoever can read the documentation. The one thing taken from the catalog is
 * the first option of a `select`, and only when it is safe to drop into a shell command and
 * a fenced block — a user's option may contain a quote or a backtick.
 */
function sample(field: ProjectedField, direction: 'read' | 'write'): unknown {
  switch (field.kind) {
    case 'number':
      return '1240.00'
    case 'boolean':
      return true
    case 'date':
      return '2026-09-18'
    case 'datetime':
      return '2026-09-18T14:03:00.000Z'
    case 'long_text':
      return 'Un texte plus long.'
    case 'select': {
      const first = field.options?.[0]?.value
      return first !== undefined && /^[\p{L}\p{N} _.,:;-]{1,40}$/u.test(first) ? first : 'valeur'
    }
    case 'link':
      if (direction === 'write') return EXAMPLE_ID
      return field.link?.masked === true
        ? { id: null, display: null, masked: true }
        : { id: EXAMPLE_ID, display: 'Exemple' }
    case 'formula':
      return 'résultat'
    case 'system':
      return field.name === '_id' || field.name.endsWith('_by')
        ? EXAMPLE_ID
        : '2026-09-18T14:03:00.000Z'
    default:
      return 'Exemple'
  }
}

/** At most this many business columns in a sample: the point is the shape, not the width. */
const SAMPLE_WIDTH = 6

function examples(base: ProjectedBase, table: ProjectedTable, tenantRef: string): string[] {
  const root = `/api/v1/${tenantRef}/data/${base.name}/${table.name}`
  const canRead = table.actions.includes('read')
  const canCreate = table.actions.includes('create')
  if (!canRead && !canCreate) return []

  const lines: string[] = ['### Exemples', '']

  if (canRead) {
    const business = table.fields.filter((f) => !f.system).slice(0, SAMPLE_WIDTH)
    const rowSample: Record<string, unknown> = { _id: EXAMPLE_ID }
    for (const field of business) rowSample[field.name] = sample(field, 'read')

    lines.push(
      '#### Lister les lignes',
      '',
      ...fence('bash', 'cURL', [
        `curl "$BASEDB_URL${root}?limit=20" \\`,
        '  -H "Authorization: Bearer $BASEDB_TOKEN"',
      ]),
      '',
      ...fence('js', 'JavaScript', [
        'const response = await fetch(',
        `  \`\${process.env.BASEDB_URL}${root}?limit=20\`,`,
        '  { headers: { Authorization: `Bearer ${process.env.BASEDB_TOKEN}` } },',
        ')',
        'const { data, meta } = await response.json()',
      ]),
      '',
      '#### Réponse',
      '',
      ...fence(
        'json',
        undefined,
        JSON.stringify(
          {
            data: [rowSample],
            included: {},
            meta: { has_next_page: false, next_cursor: null },
          },
          null,
          2,
        ).split('\n'),
      ),
      '',
    )
  }

  if (canCreate) {
    const values: Record<string, unknown> = {}
    for (const field of table.fields) {
      if (field.system || field.readOnly || field.kind === 'formula') continue
      if (Object.keys(values).length >= SAMPLE_WIDTH) break
      values[field.name] = sample(field, 'write')
    }
    const body = JSON.stringify({ values })

    lines.push(
      '#### Créer une ligne',
      '',
      ...fence('bash', 'cURL', [
        `curl -X POST "$BASEDB_URL${root}" \\`,
        '  -H "Authorization: Bearer $BASEDB_TOKEN" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '${body}'`,
      ]),
      '',
      ...fence('js', 'JavaScript', [
        'const response = await fetch(',
        `  \`\${process.env.BASEDB_URL}${root}\`,`,
        '  {',
        "    method: 'POST',",
        '    headers: {',
        '      Authorization: `Bearer ${process.env.BASEDB_TOKEN}`,',
        "      'Content-Type': 'application/json',",
        '    },',
        `    body: JSON.stringify(${JSON.stringify({ values })}),`,
        '  },',
        ')',
      ]),
      '',
    )
  }

  return lines
}

// ── A table ───────────────────────────────────────────────────────────────────────────

function typeCell(field: ProjectedField): string {
  const marks: string[] = []
  if (field.required) marks.push('obligatoire')
  if (field.readOnly && !field.system) marks.push('lecture seule')
  if (field.unsafeHtml) marks.push('HTML riche — **à assainir à l’affichage**')

  let type = TYPE_LABEL[field.kind] ?? field.kind
  if (field.link?.target !== undefined) type = `lien → ${code(field.link.target.table)}`

  return [type, ...marks].join(' · ')
}

function descriptionCell(field: ProjectedField): string {
  const parts: string[] = []
  if (field.description !== null) parts.push(inline(field.description))

  if (field.options !== undefined && field.options.length > 0) {
    parts.push(`Valeurs : ${field.options.map((o) => literal(o.value)).join(', ')}.`)
  }

  return parts.length === 0 ? '—' : parts.join(' ')
}

/** What a link says about itself, once the reader's rights have been applied. */
function describeLink(field: ProjectedField): string[] {
  const link = field.link
  if (link === undefined) return []

  // A link whose target is invisible is still described — the field exists on a table
  // the reader can read — but nothing of its target is said.
  const target =
    link.target === undefined
      ? 'cible non visible pour vous : la cellule vaut toujours `{"id":null,"display":null,"masked":true}`'
      : `pointe vers ${code(link.target.table)}${
          link.target.displayField === null
            ? ' (aucune colonne d’affichage désignée : la cellule montre l’identifiant)'
            : `, affiché par ${code(link.target.displayField)}`
        }`

  const onDelete =
    link.onDelete === 'restrict'
      ? 'supprimer la ligne cible est refusé tant qu’elle est référencée'
      : link.onDelete === 'set_null'
        ? 'supprimer la ligne cible vide cette cellule'
        : 'supprimer la ligne cible supprime aussi cette ligne'

  return [
    `- **${code(field.name)}** — ${target}`,
    `  - à la suppression : ${onDelete}`,
    '  - en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture,' +
      ' toujours `{"id": …, "display": …}`',
  ]
}

function endpoints(base: ProjectedBase, table: ProjectedTable, tenantRef: string): string[] {
  const root = `/api/v1/${tenantRef}/data/${base.name}/${table.name}`
  const rows: string[][] = []

  if (table.actions.includes('read')) {
    rows.push([code('GET'), code(root), 'Lister les lignes — filtre, tri, pagination par curseur'])
    rows.push([code('GET'), code(`${root}/{id}`), 'Lire une ligne'])
  }
  if (table.actions.includes('create')) rows.push([code('POST'), code(root), 'Créer une ligne'])
  if (table.actions.includes('update')) {
    rows.push([code('PATCH'), code(`${root}/{id}`), 'Modifier une ligne'])
  }
  if (table.actions.includes('delete')) {
    rows.push([code('DELETE'), code(`${root}/{id}`), 'Supprimer une ligne'])
  }
  if (table.referencedBy && table.actions.includes('read')) {
    rows.push([
      code('GET'),
      code(`${root}/{id}/referenced_by`),
      'Lister les lignes qui pointent vers celle-ci',
    ])
  }

  return mdTable(['Méthode', 'Chemin', 'Rôle'], rows)
}

function describeTable(base: ProjectedBase, table: ProjectedTable, tenantRef: string): DocSection {
  const verbs: Readonly<Record<string, string>> = {
    read: 'lire',
    create: 'créer',
    update: 'modifier',
    delete: 'supprimer',
  }
  const allowed = table.actions.map((a) => `**${verbs[a] ?? a}**`).join(', ')
  const expandable = table.fields.filter((f) => f.link?.expandable === true).map((f) => f.name)
  const business = table.fields.filter((f) => !f.system)
  const links = business.filter((f) => f.link !== undefined)

  const lines: string[] = []

  if (table.description !== null) lines.push(paragraph(table.description), '')

  lines.push(
    `**En SQL :** ${code(table.sql)}`,
    '',
    `Vous pouvez ${allowed}. Les verbes absents de cette liste ne vous sont pas ouverts,`,
    'et les chemins correspondants ne sont pas décrits.',
    '',
    '### Points d’accès',
    '',
    ...endpoints(base, table, tenantRef),
    '',
    '### Colonnes',
    '',
    ...mdTable(
      ['Colonne', 'Libellé', 'Type', 'Description'],
      business.map((f) => [code(f.name), inline(f.label), typeCell(f), descriptionCell(f)]),
    ),
  )

  if (links.length > 0) {
    lines.push('', '### Champs lien', '', ...links.flatMap(describeLink))
  }

  lines.push(
    '',
    '### Colonnes système',
    '',
    'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la',
    'reprise incrémentale, et aucun réglage ne les masque.',
    '',
    // Listed one by one, like the others: the three serializations are compared field by
    // field (§17.1 point 4), and prose that merely alludes to them would make the
    // comparison pass while the documentation said less than the specification.
    ...mdTable(
      ['Colonne', 'Type', 'Description'],
      table.fields
        .filter((f) => f.system)
        .map((f) => [code(f.name), typeCell(f), descriptionCell(f)]),
    ),
  )

  if (expandable.length > 0) {
    lines.push(
      '',
      '### Expansion',
      '',
      `${code(`?expand=${expandable.join(',')}`)} — profondeur 1 sans exception.`,
      'Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant,',
      'et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.',
    )
  }

  if (table.referencedBy) {
    lines.push(
      '',
      '### Lignes référençantes',
      '',
      `${code(`GET /api/v1/${tenantRef}/data/${base.name}/${table.name}/{id}/referenced_by`)} liste`,
      'les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas',
      'visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.',
    )
  }

  const shown = examples(base, table, tenantRef)
  if (shown.length > 0) lines.push('', ...shown)

  return {
    id: table.name,
    title: escapeLabel(table.label),
    group: GROUP_TABLES,
    markdown: lines.join('\n').trimEnd(),
  }
}

// ── The whole base ────────────────────────────────────────────────────────────────────

/** Serializes a projected base as readable documentation. */
export function toDocumentation(base: ProjectedBase, tenantRef: string): Documentation {
  const prefix = `/api/v1/${tenantRef}`

  const relations = base.tables.flatMap((t) =>
    t.fields
      .filter((f) => f.link !== undefined)
      .map((f) =>
        f.link?.target === undefined
          ? `- \`${t.name}.${f.name}\` → une table que vous ne voyez pas`
          : `- \`${t.name}.${f.name}\` → \`${f.link.target.table}\``,
      ),
  )

  // A table section is identified by the table's logical name, so the sections that are
  // NOT tables must never be spelled like one. Every id below contains a hyphen, and a
  // logical name cannot: alphabet B of chapter 01 forbids it (§1.1), which is also what
  // tells a name from a UUID. A base with a table called "Relations" therefore cannot
  // shadow the section of that name.
  const overview: DocSection = {
    id: 'lire-cette-base',
    title: 'Vue d’ensemble',
    group: GROUP_START,
    markdown: [
      ...(base.description === null ? [] : [paragraph(base.description), '']),
      `Cette base s’appelle ${code(base.name)} — c’est le nom du **schéma PostgreSQL**, et`,
      'celui que vous écrivez dans vos URL. Les tables et les colonnes portent les mêmes noms',
      'ici et en SQL : il n’y a pas de table de correspondance à consulter.',
      '',
      ...mdTable(
        ['Élément', 'Valeur'],
        [
          ['Schéma PostgreSQL', code(base.name)],
          ['Préfixe des routes', code(prefix)],
          ['Tables visibles', String(base.tables.length)],
          ['Format', 'JSON, dans une enveloppe `{ "data": …, "included": {…}, "meta": {…} }`'],
        ],
      ),
      '',
      ...callout(
        'WARNING',
        '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux',
        'versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.',
      ),
    ].join('\n'),
  }

  const authentication: DocSection = {
    id: 'api-authentification',
    title: 'Authentification',
    group: GROUP_START,
    markdown: [
      'Toutes les routes de données demandent un **jeton d’accès**, dans l’en-tête',
      '`Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie',
      'sur chaque requête, y compris celles qu’une page étrangère provoque.',
      '',
      ...fence('bash', 'cURL', [
        'export BASEDB_URL="https://votre-instance"',
        'export BASEDB_TOKEN="<jeton d’accès>"',
        '',
        `curl "$BASEDB_URL${prefix}/meta/bases" \\`,
        '  -H "Authorization: Bearer $BASEDB_TOKEN"',
      ]),
      '',
      ...callout(
        'NOTE',
        'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous',
        'reconnecter.',
      ),
    ].join('\n'),
  }

  const conventions: DocSection = {
    id: 'api-conventions',
    title: 'Conventions',
    group: GROUP_START,
    markdown: [
      '### Enveloppe',
      '',
      'Toutes les réponses ont la même forme : `{ "data": …, "included": {…}, "meta": {…} }`.',
      'Une erreur remplace `data` par le code, les détails et l’identifiant de requête.',
      '',
      '### Nombres',
      '',
      '**Les nombres sont des chaînes décimales**, sans exception : `{"montant":"1240.00"}`.',
      'Un flottant arrondirait silencieusement un montant.',
      '',
      '### Ressource invisible',
      '',
      '**Une ressource invisible et une ressource inexistante répondent la même chose**,',
      'octet pour octet. Un `404` ne vous dit jamais si l’objet existe.',
      '',
      '### Pagination',
      '',
      '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`.',
      'Il n’existe aucune route d’export.',
      '',
      '### Identifiants seuls',
      '',
      'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la',
      'résolution des libellés — et autant d’allers-retours SQL.',
    ].join('\n'),
  }

  const relationsSection: DocSection = {
    id: 'api-relations',
    title: 'Relations',
    group: GROUP_REFERENCE,
    markdown:
      relations.length === 0
        ? 'Aucune relation visible dans cette base.'
        : [
            'Les liens sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la',
            'base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.',
            '',
            ...relations,
          ].join('\n'),
  }

  const responses: DocSection = {
    id: 'codes-de-reponse',
    title: 'Codes de réponse',
    group: GROUP_REFERENCE,
    markdown: [
      ...mdTable(
        ['Statut', 'Signification'],
        [
          [code('200'), 'Succès.'],
          [code('201'), 'Ligne créée.'],
          [code('204'), 'Suppression réussie, sans contenu.'],
          [code('401'), 'Authentification absente ou refusée.'],
          [
            code('404'),
            'Ressource inexistante **ou** invisible — les deux réponses sont identiques.',
          ],
          [code('409'), 'Suppression refusée : la ligne est encore référencée.'],
          [code('422'), 'Valeur refusée par la validation.'],
        ],
      ),
      '',
      'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :',
      '',
      ...fence('json', undefined, [
        '{',
        '  "code": "VALIDATION_FAILED",',
        '  "details": {},',
        `  "request_id": "${EXAMPLE_ID}"`,
        '}',
      ]),
      '',
      `La liste complète des codes est servie par ${code('GET /api/v1/codes')}.`,
    ].join('\n'),
  }

  const sql: DocSection = {
    id: 'ecrire-en-sql',
    title: 'Écrire en SQL direct',
    group: GROUP_REFERENCE,
    markdown: [
      'Ouvrez `psql` : ça marche, c’est le but du produit.',
      '',
      ...fence('sql', undefined, [`SELECT * FROM "${base.name}"."<table>" LIMIT 10;`]),
      '',
      'Ce qui vous attend :',
      '',
      '- Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne',
      '  référencée ne se supprime pas.',
      '- Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel :',
      '  `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by`',
      '  et `_updated_by` attendent un identifiant d’utilisateur.',
      '',
      ...callout(
        'IMPORTANT',
        '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent',
        'les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout',
        'ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire',
        'que de ne rien promettre.',
      ),
    ].join('\n'),
  }

  return {
    title: `${escapeLabel(base.label)} — documentation`,
    sections: [
      overview,
      authentication,
      conventions,
      ...base.tables.map((t) => describeTable(base, t, tenantRef)),
      relationsSection,
      responses,
      sql,
    ],
  }
}
