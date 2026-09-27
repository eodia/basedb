import { type Say, sayer } from './documentation-texts/index.js'
import { escapeLabel } from './labels.js'
import type { ProjectedBase, ProjectedField, ProjectedTable } from './projection.js'

/**
 * Readable documentation — chapter 08 §9.4, and the agent surface of chapter 09.
 *
 * One document for the two doors of a base: the REST API, for programs, and the MCP
 * server, for agents. They share the permissions, the names and the types, so they share
 * the pages that say so — overview, tables, relations — and each has its own group for
 * what is its own: authentication and conventions for the API, connection, tools and
 * scope for MCP. Every table page says how to reach the table through both.
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
 * IN THE READER'S LANGUAGE — chapter 11 §10. The prose is written in French and passes
 * through `t`, like the interface's `$t`: the French sentence is the key, values go in
 * `{name}`, one whole paragraph per call. The catalogs are in `documentation-texts/`; a
 * sentence a catalog lacks is written in French. What is not prose stays as it is in
 * every language: names, paths, codes, and the server's own messages quoted in examples.
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

/**
 * A sentence written outside a `t` call — in a table of labels — that `t` translates
 * where it is shown. The marker is how the catalog test finds it.
 */
const phrase = (french: string): string => french

const GROUP_START = phrase('Prise en main')
const GROUP_API = phrase('API REST')
const GROUP_MCP = phrase('Agents (MCP)')
const GROUP_TABLES = phrase('Tables')
const GROUP_REFERENCE = phrase('Référence')

/** How each type arrives in JSON — the normative table of §7.2, in prose. */
const TYPE_LABEL: Readonly<Record<string, string>> = {
  short_text: phrase('texte'),
  long_text: phrase('texte long'),
  number: phrase('nombre (chaîne décimale)'),
  boolean: phrase('booléen'),
  date: phrase('date (`2026-09-18`)'),
  datetime: phrase('date-heure UTC (`2026-09-18T14:03:00.000Z`)'),
  select: phrase('liste de choix'),
  multi_select: phrase('choix multiple (liste de valeurs)'),
  link: phrase('relation (`_id` de la ligne liée)'),
  multi_link: phrase('relation multiple (liste des `_id` des lignes liées, dans leur ordre)'),
  url: phrase('lien URL (`https://…` ou `mailto:…`)'),
  email: phrase('adresse e-mail'),
  autonumber: phrase('numéro automatique (lecture seule)'),
  user: phrase('personne (`id` d’un membre de l’espace)'),
  formula: phrase('formule'),
  file: phrase('documents (liste de fichiers)'),
  image: phrase('images (liste de fichiers)'),
  system: phrase('colonne système'),
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
function sample(field: ProjectedField, direction: 'read' | 'write', t: Say): unknown {
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
      return t('Un texte plus long.')
    case 'select': {
      const first = field.options?.[0]?.value
      return first !== undefined && /^[\p{L}\p{N} _.,:;-]{1,40}$/u.test(first) ? first : t('valeur')
    }
    case 'multi_select': {
      const first = field.options?.[0]?.value
      return [
        first !== undefined && /^[\p{L}\p{N} _.,:;-]{1,40}$/u.test(first) ? first : t('valeur'),
      ]
    }
    case 'file':
    case 'image': {
      // Written as the identifier a deposit returned; read back described, with its link.
      if (direction === 'write') return [{ id: EXAMPLE_ID }]
      const name = sampleFileName(field, t)
      return [
        {
          id: EXAMPLE_ID,
          name,
          type: field.kind === 'image' ? 'image/jpeg' : 'application/pdf',
          size: 48213,
          url: `/api/v1/…/files/${EXAMPLE_ID}/${name}?exp=…&sig=…`,
        },
      ]
    }
    case 'link':
      if (direction === 'write') return EXAMPLE_ID
      return field.link?.masked === true
        ? { id: null, display: null, masked: true }
        : { id: EXAMPLE_ID, display: t('Exemple') }
    case 'multi_link':
      if (direction === 'write') return [EXAMPLE_ID]
      return field.link?.masked === true
        ? [{ id: null, display: null, masked: true }]
        : [{ id: EXAMPLE_ID, display: t('Exemple') }]
    case 'formula':
      return t('résultat')
    case 'system':
      return field.name === '_id' || field.name.endsWith('_by')
        ? EXAMPLE_ID
        : '2026-09-18T14:03:00.000Z'
    default:
      return t('Exemple')
  }
}

/** The file an example deposits: a photo for an image field, a quote otherwise. */
function sampleFileName(field: ProjectedField, t: Say): string {
  return field.kind === 'image' ? t('photo.jpg') : t('devis.pdf')
}

/** At most this many business columns in a sample: the point is the shape, not the width. */
const SAMPLE_WIDTH = 6

function examples(base: ProjectedBase, table: ProjectedTable, tenantRef: string, t: Say): string[] {
  const root = `/api/v1/${tenantRef}/data/${base.name}/${table.name}`
  const canRead = table.actions.includes('read')
  const canCreate = table.actions.includes('create')
  if (!canRead && !canCreate) return []

  const lines: string[] = [`### ${t('Exemples')}`, '']

  if (canRead) {
    const business = table.fields.filter((f) => !f.system).slice(0, SAMPLE_WIDTH)
    const rowSample: Record<string, unknown> = { _id: EXAMPLE_ID }
    for (const field of business) rowSample[field.name] = sample(field, 'read', t)

    lines.push(
      `#### ${t('Lister les lignes')}`,
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
      `#### ${t('Réponse')}`,
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
      values[field.name] = sample(field, 'write', t)
    }
    const body = JSON.stringify({ values })

    lines.push(
      `#### ${t('Créer une ligne')}`,
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

    // A file is deposited first, then cited by the write: the example says so once per
    // table that has a file field, with the first one.
    const fileField = table.fields.find(
      (f) => (f.kind === 'file' || f.kind === 'image') && !f.readOnly,
    )
    if (fileField !== undefined) {
      const name = sampleFileName(fileField, t)
      const type = fileField.kind === 'image' ? 'image/jpeg' : 'application/pdf'
      lines.push(
        `#### ${t('Déposer un fichier')}`,
        '',
        t(
          'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.',
          {
            field: code(fileField.name),
            write: code(`{"values": {"${fileField.name}": [{"id": "…"}]}}`),
          },
        ),
        '',
        ...fence('bash', 'cURL', [
          `curl -X POST "$BASEDB_URL/api/v1/${tenantRef}/files/${base.name}/${table.name}/${fileField.name}?name=${name}" \\`,
          '  -H "Authorization: Bearer $BASEDB_TOKEN" \\',
          `  -H "Content-Type: ${type}" \\`,
          `  --data-binary @${name}`,
        ]),
        '',
      )
    }
  }

  return lines
}

// ── The agent surface (MCP) ───────────────────────────────────────────────────────────

/**
 * The MCP tools as this documentation presents them — chapter 09 §2.2.
 *
 * The catalog itself lives in `apps/mcp`, which the kernel may not import. The two lists
 * are compared by a test on that side: a tool added there and not here fails it, and so
 * does a tool described here that no longer answers.
 */
export const DOCUMENTED_MCP_TOOLS: ReadonlyArray<{
  readonly name: string
  readonly summary: string
  /**
   * What it needs: nothing, reading, creating or modifying rows — or proposing a change
   * of structure, which a person then approves or refuses (chapter 09 §7).
   */
  readonly needs: 'none' | 'read' | 'create' | 'update' | 'propose'
}> = [
  {
    name: 'whoami',
    summary: phrase(
      'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.',
    ),
    needs: 'none',
  },
  { name: 'list_bases', summary: phrase('Les bases que le jeton peut lire.'), needs: 'read' },
  {
    name: 'describe_base',
    summary: phrase('Les tables d’une base et le graphe de leurs relations.'),
    needs: 'read',
  },
  {
    name: 'describe_table',
    summary: phrase(
      'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.',
    ),
    needs: 'read',
  },
  {
    name: 'list_records',
    summary: phrase('Lire des lignes : filtre, tri, pagination par curseur.'),
    needs: 'read',
  },
  {
    name: 'get_record',
    summary: phrase('Lire une ligne par son `_id`, les textes longs en entier si on le demande.'),
    needs: 'read',
  },
  {
    name: 'lookup_records',
    summary: phrase(
      'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.',
    ),
    needs: 'read',
  },
  { name: 'create_record', summary: phrase('Créer une ligne.'), needs: 'create' },
  {
    name: 'update_record',
    summary: phrase('Modifier les champs nommés d’une ligne.'),
    needs: 'update',
  },
  {
    name: 'propose_create_table',
    summary: phrase('Proposer une table et ses premiers champs — une personne décide.'),
    needs: 'propose',
  },
  {
    name: 'propose_add_field',
    summary: phrase('Proposer un champ, une liste de choix ou une relation — une personne décide.'),
    needs: 'propose',
  },
  {
    name: 'get_proposal',
    summary: phrase('Relire une proposition du jeton et savoir ce qu’il en est advenu.'),
    needs: 'read',
  },
]

/** Where the relay lives in a checkout, as the connection dialog also says it. */
const relay = (t: Say): string => `<${t('dépôt basedb')}>/apps/mcp/dist/relay.js`

/**
 * Fields an agent may write in an example: writable by the reader, visible to agents,
 * and of a kind the MCP tools accept — no file, no rich text, nothing computed.
 */
function agentWritable(field: ProjectedField): boolean {
  return (
    !field.system &&
    !field.readOnly &&
    field.hiddenFromAgents !== true &&
    !field.unsafeHtml &&
    field.kind !== 'formula' &&
    field.ai !== true &&
    field.kind !== 'file' &&
    field.kind !== 'image'
  )
}

/** « Depuis un agent (MCP) » in a table's section: the tools, what they reach, one call. */
function agentUsage(base: ProjectedBase, table: ProjectedTable, t: Say): string[] {
  const lines: string[] = [`### ${t('Depuis un agent (MCP)')}`, '']

  if (!base.agentsEnabled) {
    lines.push(
      ...callout(
        'NOTE',
        t(
          'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.',
        ),
      ),
    )
    return lines
  }

  const canRead = table.actions.includes('read')
  const rows: string[][] = []
  if (canRead) {
    rows.push([code('describe_table'), t('Connaître ses champs, et lesquels sont modifiables')])
    rows.push([code('list_records'), t('Lire ses lignes — filtre, tri, pagination')])
    rows.push([code('get_record'), t('Lire une ligne par son `_id`')])
    if (table.displayField !== null) {
      rows.push([
        code('lookup_records'),
        t('Trouver une ligne par sa valeur d’affichage, {field}', {
          field: code(table.displayField),
        }),
      ])
    }
  }
  if (table.actions.includes('create')) rows.push([code('create_record'), t('Créer une ligne')])
  if (table.actions.includes('update')) rows.push([code('update_record'), t('Modifier une ligne')])

  if (rows.length === 0) {
    lines.push(t('Aucun outil ne vous est ouvert sur cette table.'))
    return lines
  }

  lines.push(
    t('Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.'),
    '',
    ...mdTable([t('Outil'), t('Pour')], rows),
  )

  if (table.actions.includes('delete')) {
    lines.push(
      '',
      t(
        'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.',
      ),
    )
  }

  const hidden = table.fields.filter((f) => f.hiddenFromAgents === true)
  if (hidden.length > 0) {
    lines.push(
      '',
      t(
        '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.',
        { fields: hidden.map((f) => code(f.name)).join(', ') },
      ),
    )
  }

  const calls: string[] = []
  if (canRead) {
    const text = table.fields.find(
      (f) =>
        !f.system &&
        f.hiddenFromAgents !== true &&
        (f.kind === 'short_text' || f.kind === 'long_text'),
    )
    const args: Record<string, unknown> = { base: base.name, table: table.name }
    if (text !== undefined) args.filter = { [text.name]: { op: 'contains', value: t('Exemple') } }
    args.limit = 20
    calls.push(...fence('json', 'list_records', JSON.stringify(args, null, 2).split('\n')))
  }
  if (table.actions.includes('create')) {
    const values: Record<string, unknown> = {}
    for (const field of table.fields) {
      if (!agentWritable(field)) continue
      if (Object.keys(values).length >= SAMPLE_WIDTH) break
      values[field.name] = sample(field, 'write', t)
    }
    if (Object.keys(values).length > 0) {
      if (calls.length > 0) calls.push('')
      calls.push(
        ...fence(
          'json',
          'create_record',
          JSON.stringify({ base: base.name, table: table.name, values }, null, 2).split('\n'),
        ),
      )
    }
  }
  if (calls.length > 0) {
    lines.push('', `#### ${t('Arguments d’un appel')}`, '', ...calls)
  }

  return lines
}

/** The note shown where a token would be created, to a reader who cannot create one. */
function noTokenForYou(t: Say): string[] {
  return callout(
    'NOTE',
    t(
      'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.',
    ),
  )
}

/** The three sections of the « Agents (MCP) » group. */
function agentSections(base: ProjectedBase, t: Say): DocSection[] {
  const hidden = base.tables.flatMap((table) =>
    table.fields.filter((f) => f.hiddenFromAgents === true).map((f) => `${table.name}.${f.name}`),
  )
  const mintsTokens = base.baseActions.includes('manage_tokens')
  const token = t('<jeton>')

  const connect: DocSection = {
    id: 'mcp-connexion',
    title: t('Connecter un agent'),
    group: t(GROUP_MCP),
    markdown: [
      t(
        'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par les mêmes permissions que l’API REST.',
      ),
      '',
      ...(base.agentsEnabled
        ? []
        : [
            ...callout(
              'WARNING',
              t(
                '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.',
              ),
            ),
            '',
          ]),
      `### ${t('Créer un jeton')}`,
      '',
      ...(mintsTokens
        ? [
            t(
              'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).',
            ),
          ]
        : noTokenForYou(t)),
      '',
      `### ${t('Garder le jeton hors de la configuration')}`,
      '',
      t(
        'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.',
      ),
      '',
      ...fence('powershell', 'Windows (PowerShell)', [
        `[Environment]::SetEnvironmentVariable('BASEDB_TOKEN', '${token}', 'User')`,
      ]),
      '',
      ...fence('bash', 'macOS, Linux', [`echo "export BASEDB_TOKEN='${token}'" >> ~/.profile`]),
      '',
      `### ${t('Déclarer le serveur dans le client')}`,
      '',
      t(
        'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).',
      ),
      '',
      ...fence('bash', 'Claude Code', [
        `claude mcp add basedb -- node ${relay(t)} --url "$BASEDB_MCP_URL" --token-env BASEDB_TOKEN`,
      ]),
      '',
      ...fence(
        'json',
        t('Autre client MCP'),
        JSON.stringify(
          {
            mcpServers: {
              basedb: {
                command: 'node',
                args: [
                  relay(t),
                  '--url',
                  `https://${t('votre-instance')}/mcp`,
                  '--token-env',
                  'BASEDB_TOKEN',
                ],
              },
            },
          },
          null,
          2,
        ).split('\n'),
      ),
      '',
      `### ${t('Sans relais')}`,
      '',
      t(
        'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.',
        { header: code(`Authorization: Bearer ${token}`) },
      ),
      '',
      `### ${t('Vérifier')}`,
      '',
      t(
        'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.',
      ),
    ].join('\n'),
  }

  const tools: DocSection = {
    id: 'mcp-outils',
    title: t('Outils'),
    group: t(GROUP_MCP),
    markdown: [
      t(
        '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.',
        { count: DOCUMENTED_MCP_TOOLS.length },
      ),
      '',
      ...mdTable(
        [t('Outil'), t('Rôle'), t('Écrit')],
        DOCUMENTED_MCP_TOOLS.map((tool) => [
          code(tool.name),
          t(tool.summary),
          tool.needs === 'create' || tool.needs === 'update'
            ? t('oui')
            : tool.needs === 'propose'
              ? t('propose')
              : t('non'),
        ]),
      ),
      '',
      `### ${t('Enchaînement type')}`,
      '',
      `- ${t('`list_bases`, puis `describe_base` : ce qui existe.')}`,
      `- ${t(
        '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).',
      )}`,
      `- ${t(
        '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.',
      )}`,
      `- ${t(
        'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.',
      )}`,
      `- ${t(
        'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.',
      )}`,
      '',
      `### ${t('Propositions de structure')}`,
      '',
      t(
        'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.',
      ),
      '',
      `- ${t(
        'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).',
      )}`,
      `- ${t(
        'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).',
      )}`,
      '',
      `### ${t('Ce qui n’existe pas')}`,
      '',
      t(
        'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.',
      ),
      '',
      `### ${t('Bornes')}`,
      '',
      `- ${t('`limit` : 25 lignes par défaut, 100 au plus.')}`,
      `- ${t('Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.')}`,
      `- ${t(
        'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.',
      )}`,
      `- ${t('Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.')}`,
    ].join('\n'),
  }

  const scope: DocSection = {
    id: 'mcp-perimetre',
    title: t('Ce que voit un agent'),
    group: t(GROUP_MCP),
    markdown: [
      t('Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.'),
      '',
      `- ${t(
        '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.',
      )}`,
      `- ${t(
        '**Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).',
      )}`,
      `- ${
        base.agentsEnabled
          ? t('**Cette base** : ouverte aux agents.')
          : t('**Cette base** : **fermée aux agents** — aucun outil ne la voit.')
      }`,
      `- ${
        hidden.length === 0
          ? t('**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.')
          : t(
              '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.',
              {
                columns: hidden.map((name) => code(name)).join(', '),
              },
            )
      }`,
      `- ${t(
        '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.',
      )}`,
      `- ${t(
        '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.',
      )}`,
    ].join('\n'),
  }

  return [connect, tools, scope]
}

// ── A table ───────────────────────────────────────────────────────────────────────────

function typeCell(field: ProjectedField, t: Say): string {
  const marks: string[] = []
  if (field.required) marks.push(t('obligatoire'))
  if (field.ai === true) marks.push(t('calculé par l’IA'))
  else if (field.readOnly && !field.system) marks.push(t('lecture seule'))
  if (field.unsafeHtml) marks.push(t('HTML riche — **à assainir à l’affichage**'))
  if (field.hiddenFromAgents === true) marks.push(t('invisible pour les agents'))

  const known = TYPE_LABEL[field.kind]
  let type = known === undefined ? field.kind : t(known)
  if (field.link?.target !== undefined) {
    type = t('relation → {table}', { table: code(field.link.target.table) })
  }

  return [type, ...marks].join(' · ')
}

function descriptionCell(field: ProjectedField, t: Say): string {
  const parts: string[] = []
  if (field.description !== null) parts.push(inline(field.description))

  if (field.options !== undefined && field.options.length > 0) {
    parts.push(
      t('Valeurs : {values}.', { values: field.options.map((o) => literal(o.value)).join(', ') }),
    )
  }

  return parts.length === 0 ? '—' : parts.join(' ')
}

/** What a link says about itself, once the reader's rights have been applied. */
function describeLink(field: ProjectedField, t: Say): string[] {
  const link = field.link
  if (link === undefined) return []

  // A link whose target is invisible is still described — the field exists on a table
  // the reader can read — but nothing of its target is said.
  const target =
    link.target === undefined
      ? t('cible non visible pour vous : la cellule vaut toujours {cell}', {
          cell: code('{"id":null,"display":null,"masked":true}'),
        })
      : link.target.displayField === null
        ? t(
            'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)',
            { table: code(link.target.table) },
          )
        : t('pointe vers {table}, affiché par {field}', {
            table: code(link.target.table),
            field: code(link.target.displayField),
          })

  const onDelete =
    link.onDelete === 'restrict'
      ? t('à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée')
      : link.onDelete === 'set_null'
        ? t('à la suppression : supprimer la ligne cible vide cette cellule')
        : t('à la suppression : supprimer la ligne cible supprime aussi cette ligne')

  return [
    `- **${code(field.name)}** — ${target}`,
    `  - ${onDelete}`,
    `  - ${t(
      'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`',
    )}`,
  ]
}

function endpoints(
  base: ProjectedBase,
  table: ProjectedTable,
  tenantRef: string,
  t: Say,
): string[] {
  const root = `/api/v1/${tenantRef}/data/${base.name}/${table.name}`
  const rows: string[][] = []

  if (table.actions.includes('read')) {
    rows.push([
      code('GET'),
      code(root),
      t('Lister les lignes — filtre, tri, pagination par curseur'),
    ])
    rows.push([code('GET'), code(`${root}/{id}`), t('Lire une ligne')])
  }
  if (table.actions.includes('create')) rows.push([code('POST'), code(root), t('Créer une ligne')])
  if (table.actions.includes('update')) {
    rows.push([code('PATCH'), code(`${root}/{id}`), t('Modifier une ligne')])
  }
  if (table.actions.includes('delete')) {
    rows.push([code('DELETE'), code(`${root}/{id}`), t('Supprimer une ligne')])
  }
  if (table.referencedBy && table.actions.includes('read')) {
    rows.push([
      code('GET'),
      code(`${root}/{id}/referenced_by`),
      t('Lister les lignes qui pointent vers celle-ci'),
    ])
  }

  return mdTable([t('Méthode'), t('Chemin'), t('Rôle')], rows)
}

/** The verbs a table page says the reader may use, in bold. */
const VERBS: Readonly<Record<string, string>> = {
  read: phrase('lire'),
  create: phrase('créer'),
  update: phrase('modifier'),
  delete: phrase('supprimer'),
}

function describeTable(
  base: ProjectedBase,
  table: ProjectedTable,
  tenantRef: string,
  t: Say,
): DocSection {
  const allowed = table.actions
    .map((a) => `**${VERBS[a] === undefined ? a : t(VERBS[a])}**`)
    .join(', ')
  const expandable = table.fields.filter((f) => f.link?.expandable === true).map((f) => f.name)
  const business = table.fields.filter((f) => !f.system)
  const links = business.filter((f) => f.link !== undefined)

  const lines: string[] = []

  if (table.description !== null) lines.push(paragraph(table.description), '')

  lines.push(
    t('**En SQL :** {sql}', { sql: code(table.sql) }),
    '',
    t(
      'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.',
      { verbs: allowed },
    ),
    '',
    `### ${t('Points d’accès')}`,
    '',
    ...endpoints(base, table, tenantRef, t),
    '',
    `### ${t('Colonnes')}`,
    '',
    ...mdTable(
      [t('Colonne'), t('Libellé'), t('Type'), t('Description')],
      business.map((f) => [code(f.name), inline(f.label), typeCell(f, t), descriptionCell(f, t)]),
    ),
  )

  if (links.length > 0) {
    lines.push('', `### ${t('Champs relation')}`, '', ...links.flatMap((f) => describeLink(f, t)))
  }

  lines.push(
    '',
    `### ${t('Colonnes système')}`,
    '',
    t(
      'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.',
    ),
    '',
    // Listed one by one, like the others: the three serializations are compared field by
    // field (§17.1 point 4), and prose that merely alludes to them would make the
    // comparison pass while the documentation said less than the specification.
    ...mdTable(
      [t('Colonne'), t('Type'), t('Description')],
      table.fields
        .filter((f) => f.system)
        .map((f) => [code(f.name), typeCell(f, t), descriptionCell(f, t)]),
    ),
  )

  if (expandable.length > 0) {
    lines.push(
      '',
      `### ${t('Expansion')}`,
      '',
      t(
        '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.',
        { expand: code(`?expand=${expandable.join(',')}`) },
      ),
    )
  }

  if (table.referencedBy) {
    lines.push(
      '',
      `### ${t('Lignes référençantes')}`,
      '',
      t(
        '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.',
        {
          route: code(
            `GET /api/v1/${tenantRef}/data/${base.name}/${table.name}/{id}/referenced_by`,
          ),
        },
      ),
    )
  }

  const shown = examples(base, table, tenantRef, t)
  if (shown.length > 0) lines.push('', ...shown)

  lines.push('', ...agentUsage(base, table, t))

  return {
    id: table.name,
    title: escapeLabel(table.label),
    group: t(GROUP_TABLES),
    markdown: lines.join('\n').trimEnd(),
  }
}

// ── The whole base ────────────────────────────────────────────────────────────────────

/**
 * Serializes a projected base as readable documentation, in `language` — French when it
 * is omitted or unknown, the language the prose is written in.
 */
export function toDocumentation(
  base: ProjectedBase,
  tenantRef: string,
  language = 'fr',
): Documentation {
  const t = sayer(language)
  const prefix = `/api/v1/${tenantRef}`
  const token = t('<jeton>')

  const relations = base.tables.flatMap((table) =>
    table.fields
      .filter((f) => f.link !== undefined)
      .map((f) =>
        f.link?.target === undefined
          ? `- \`${table.name}.${f.name}\` → ${t('une table que vous ne voyez pas')}`
          : `- \`${table.name}.${f.name}\` → \`${f.link.target.table}\``,
      ),
  )

  // A table section is identified by the table's logical name, so the sections that are
  // NOT tables must never be spelled like one. Every id below contains a hyphen, and a
  // logical name cannot: alphabet B of chapter 01 forbids it (§1.1), which is also what
  // tells a name from a UUID. A base with a table called "Relations" therefore cannot
  // shadow the section of that name.
  const overview: DocSection = {
    id: 'lire-cette-base',
    title: t('Vue d’ensemble'),
    group: t(GROUP_START),
    markdown: [
      ...(base.description === null ? [] : [paragraph(base.description), '']),
      t(
        'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.',
        { name: code(base.name) },
      ),
      '',
      t(
        'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.',
      ),
      '',
      ...mdTable(
        [t('Élément'), t('Valeur')],
        [
          [t('Schéma PostgreSQL'), code(base.name)],
          [t('Préfixe des routes REST'), code(prefix)],
          [
            t('Agents (MCP)'),
            base.agentsEnabled
              ? t('ouverte — voir « Connecter un agent »')
              : t('**fermée aux agents**'),
          ],
          [t('Tables visibles'), String(base.tables.length)],
          [
            t('Format'),
            t('JSON, dans une enveloppe {envelope}', {
              envelope: code('{ "data": …, "included": {…}, "meta": {…} }'),
            }),
          ],
        ],
      ),
      '',
      ...callout(
        'WARNING',
        t(
          '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.',
        ),
      ),
    ].join('\n'),
  }

  const authentication: DocSection = {
    id: 'api-authentification',
    title: t('Authentification'),
    group: t(GROUP_API),
    markdown: [
      t(
        'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.',
      ),
      '',
      `### ${t('Jeton d’intégration')}`,
      '',
      t(
        'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.',
      ),
      '',
      ...(base.baseActions.includes('manage_tokens')
        ? [
            t(
              'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.',
            ),
          ]
        : noTokenForYou(t)),
      '',
      `### ${t('Appel')}`,
      '',
      ...fence('bash', 'cURL', [
        `export BASEDB_URL="https://${t('votre-instance')}"`,
        `export BASEDB_TOKEN="${token}"`,
        '',
        `curl "$BASEDB_URL${prefix}/meta/bases" \\`,
        '  -H "Authorization: Bearer $BASEDB_TOKEN"',
      ]),
      '',
      ...callout(
        'NOTE',
        t(
          'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.',
        ),
      ),
    ].join('\n'),
  }

  const conventions: DocSection = {
    id: 'api-conventions',
    title: t('Conventions'),
    group: t(GROUP_API),
    markdown: [
      `### ${t('Enveloppe')}`,
      '',
      t(
        'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.',
        { envelope: code('{ "data": …, "included": {…}, "meta": {…} }') },
      ),
      '',
      `### ${t('Nombres')}`,
      '',
      t(
        '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.',
        { example: code(`{"${t('montant')}":"1240.00"}`) },
      ),
      '',
      `### ${t('Ressource invisible')}`,
      '',
      t(
        '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.',
      ),
      '',
      `### ${t('Pagination')}`,
      '',
      t(
        '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.',
      ),
      '',
      `### ${t('Identifiants seuls')}`,
      '',
      t(
        'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.',
      ),
    ].join('\n'),
  }

  const relationsSection: DocSection = {
    id: 'api-relations',
    title: t('Relations'),
    group: t(GROUP_REFERENCE),
    markdown:
      relations.length === 0
        ? t('Aucune relation visible dans cette base.')
        : [
            t(
              'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.',
            ),
            '',
            ...relations,
          ].join('\n'),
  }

  const responses: DocSection = {
    id: 'codes-de-reponse',
    title: t('Codes de réponse'),
    group: t(GROUP_REFERENCE),
    markdown: [
      '### API REST',
      '',
      ...mdTable(
        [t('Statut'), t('Signification')],
        [
          [code('200'), t('Succès.')],
          [code('201'), t('Ligne créée.')],
          [code('204'), t('Suppression réussie, sans contenu.')],
          [code('401'), t('Authentification absente ou refusée.')],
          [
            code('404'),
            t('Ressource inexistante **ou** invisible — les deux réponses sont identiques.'),
          ],
          [code('409'), t('Suppression refusée : la ligne est encore référencée.')],
          [code('422'), t('Valeur refusée par la validation.')],
        ],
      ),
      '',
      t('Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :'),
      '',
      ...fence('json', undefined, [
        '{',
        '  "code": "VALIDATION_FAILED",',
        '  "details": {},',
        `  "request_id": "${EXAMPLE_ID}"`,
        '}',
      ]),
      '',
      t('La liste complète des codes est servie par {route}.', {
        route: code('GET /api/v1/codes'),
      }),
      '',
      `### ${t('Côté MCP')}`,
      '',
      t(
        'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.',
      ),
      '',
      // The server's own answer, quoted as it arrives: not translated.
      ...fence('json', undefined, [
        '{',
        '  "code": "FIELD_NOT_WRITABLE",',
        '  "message": "Ce champ n’est pas modifiable par cette surface.",',
        '  "invalid_params": ["values.total"],',
        '  "hint": "Les colonnes système et les champs formule ne se modifient jamais ; voir access dans describe_table.",',
        '  "retryable": false',
        '}',
      ]),
    ].join('\n'),
  }

  const sql: DocSection = {
    id: 'ecrire-en-sql',
    title: t('Écrire en SQL direct'),
    group: t(GROUP_REFERENCE),
    markdown: [
      t('Ouvrez `psql` : ça marche, c’est le but du produit.'),
      '',
      ...fence('sql', undefined, [`SELECT * FROM "${base.name}"."<table>" LIMIT 10;`]),
      '',
      t('Ce qui vous attend :'),
      '',
      `- ${t(
        'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.',
      )}`,
      `- ${t(
        'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.',
      )}`,
      '',
      ...callout(
        'IMPORTANT',
        t(
          '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.',
        ),
      ),
    ].join('\n'),
  }

  return {
    title: t('{base} — documentation API et MCP', { base: escapeLabel(base.label) }),
    sections: [
      overview,
      authentication,
      conventions,
      ...agentSections(base, t),
      ...base.tables.map((table) => describeTable(base, table, tenantRef, t)),
      relationsSection,
      responses,
      sql,
    ],
  }
}
