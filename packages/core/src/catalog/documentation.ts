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
const GROUP_API = 'API REST'
const GROUP_MCP = 'Agents (MCP)'
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
  multi_select: 'choix multiple (liste de valeurs)',
  link: 'relation (`_id` de la ligne liée)',
  multi_link: 'relation multiple (liste des `_id` des lignes liées, dans leur ordre)',
  url: 'lien URL (`https://…` ou `mailto:…`)',
  email: 'adresse e-mail',
  autonumber: 'numéro automatique (lecture seule)',
  user: 'personne (`id` d’un membre de l’espace)',
  formula: 'formule',
  file: 'documents (liste de fichiers)',
  image: 'images (liste de fichiers)',
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
    case 'multi_select': {
      const first = field.options?.[0]?.value
      return [first !== undefined && /^[\p{L}\p{N} _.,:;-]{1,40}$/u.test(first) ? first : 'valeur']
    }
    case 'file':
    case 'image': {
      // Written as the identifier a deposit returned; read back described, with its link.
      if (direction === 'write') return [{ id: EXAMPLE_ID }]
      const name = field.kind === 'image' ? 'photo.jpg' : 'devis.pdf'
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
        : { id: EXAMPLE_ID, display: 'Exemple' }
    case 'multi_link':
      if (direction === 'write') return [EXAMPLE_ID]
      return field.link?.masked === true
        ? [{ id: null, display: null, masked: true }]
        : [{ id: EXAMPLE_ID, display: 'Exemple' }]
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

    // A file is deposited first, then cited by the write: the example says so once per
    // table that has a file field, with the first one.
    const fileField = table.fields.find(
      (f) => (f.kind === 'file' || f.kind === 'image') && !f.readOnly,
    )
    if (fileField !== undefined) {
      const name = fileField.kind === 'image' ? 'photo.jpg' : 'devis.pdf'
      const type = fileField.kind === 'image' ? 'image/jpeg' : 'application/pdf'
      lines.push(
        '#### Déposer un fichier',
        '',
        `Le corps est le fichier lui-même. La réponse donne un \`id\`, à écrire ensuite dans ${code(fileField.name)} : \`{"values": {"${fileField.name}": [{"id": "…"}]}}\`.`,
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
    summary: 'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.',
    needs: 'none',
  },
  { name: 'list_bases', summary: 'Les bases que le jeton peut lire.', needs: 'read' },
  {
    name: 'describe_base',
    summary: 'Les tables d’une base et le graphe de leurs relations.',
    needs: 'read',
  },
  {
    name: 'describe_table',
    summary:
      'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.',
    needs: 'read',
  },
  {
    name: 'list_records',
    summary: 'Lire des lignes : filtre, tri, pagination par curseur.',
    needs: 'read',
  },
  {
    name: 'get_record',
    summary: 'Lire une ligne par son `_id`, les textes longs en entier si on le demande.',
    needs: 'read',
  },
  {
    name: 'lookup_records',
    summary: 'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.',
    needs: 'read',
  },
  { name: 'create_record', summary: 'Créer une ligne.', needs: 'create' },
  { name: 'update_record', summary: 'Modifier les champs nommés d’une ligne.', needs: 'update' },
  {
    name: 'propose_create_table',
    summary: 'Proposer une table et ses premiers champs — une personne décide.',
    needs: 'propose',
  },
  {
    name: 'propose_add_field',
    summary: 'Proposer un champ, une liste de choix ou une relation — une personne décide.',
    needs: 'propose',
  },
  {
    name: 'get_proposal',
    summary: 'Relire une proposition du jeton et savoir ce qu’il en est advenu.',
    needs: 'read',
  },
]

/** Where the relay lives in a checkout, as the connection dialog also says it. */
const RELAY = '<dépôt basedb>/apps/mcp/dist/relay.js'

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
function agentUsage(base: ProjectedBase, table: ProjectedTable): string[] {
  const lines: string[] = ['### Depuis un agent (MCP)', '']

  if (!base.agentsEnabled) {
    lines.push(
      ...callout(
        'NOTE',
        'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table,',
        'quel que soit le jeton.',
      ),
    )
    return lines
  }

  const canRead = table.actions.includes('read')
  const rows: string[][] = []
  if (canRead) {
    rows.push([code('describe_table'), 'Connaître ses champs, et lesquels sont modifiables'])
    rows.push([code('list_records'), 'Lire ses lignes — filtre, tri, pagination'])
    rows.push([code('get_record'), 'Lire une ligne par son `_id`'])
    if (table.displayField !== null) {
      rows.push([
        code('lookup_records'),
        `Trouver une ligne par sa valeur d’affichage, ${code(table.displayField)}`,
      ])
    }
  }
  if (table.actions.includes('create')) rows.push([code('create_record'), 'Créer une ligne'])
  if (table.actions.includes('update')) rows.push([code('update_record'), 'Modifier une ligne'])

  if (rows.length === 0) {
    lines.push('Aucun outil ne vous est ouvert sur cette table.')
    return lines
  }

  lines.push(
    'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.',
    '',
    ...mdTable(['Outil', 'Pour'], rows),
  )

  if (table.actions.includes('delete')) {
    lines.push(
      '',
      'Supprimer une ligne reste réservé à l’API REST et à l’interface : aucun outil MCP ne supprime.',
    )
  }

  const hidden = table.fields.filter((f) => f.hiddenFromAgents === true)
  if (hidden.length > 0) {
    lines.push(
      '',
      `**Invisibles pour un agent :** ${hidden.map((f) => code(f.name)).join(', ')}. Pour lui, ces`,
      'colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.',
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
    if (text !== undefined) args.filter = { [text.name]: { op: 'contains', value: 'Exemple' } }
    args.limit = 20
    calls.push(...fence('json', 'list_records', JSON.stringify(args, null, 2).split('\n')))
  }
  if (table.actions.includes('create')) {
    const values: Record<string, unknown> = {}
    for (const field of table.fields) {
      if (!agentWritable(field)) continue
      if (Object.keys(values).length >= SAMPLE_WIDTH) break
      values[field.name] = sample(field, 'write')
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
    lines.push('', '#### Arguments d’un appel', '', ...calls)
  }

  return lines
}

/** The three sections of the « Agents (MCP) » group. */
function agentSections(base: ProjectedBase): DocSection[] {
  const hidden = base.tables.flatMap((t) =>
    t.fields.filter((f) => f.hiddenFromAgents === true).map((f) => `${t.name}.${f.name}`),
  )
  const mintsTokens = base.baseActions.includes('manage_tokens')

  const connect: DocSection = {
    id: 'mcp-connexion',
    title: 'Connecter un agent',
    group: GROUP_MCP,
    markdown: [
      'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP :',
      'il la découvre, la lit et, si vous le décidez, y crée et modifie des lignes. Il passe par',
      'les mêmes permissions que l’API REST.',
      '',
      ...(base.agentsEnabled
        ? []
        : [
            ...callout(
              'WARNING',
              '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil',
              'ne la voit, quel que soit le jeton présenté.',
            ),
            '',
          ]),
      '### Créer un jeton',
      '',
      ...(mintsTokens
        ? [
            'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché.',
            'Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture se choisit',
            'explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché',
            'aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).',
          ]
        : callout(
            'NOTE',
            'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas.',
            'Demandez-en un à la personne qui la gère.',
          )),
      '',
      '### Garder le jeton hors de la configuration',
      '',
      'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le',
      'fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par',
      'tous les programmes de la session.',
      '',
      ...fence('powershell', 'Windows (PowerShell)', [
        "[Environment]::SetEnvironmentVariable('BASEDB_TOKEN', '<jeton>', 'User')",
      ]),
      '',
      ...fence('bash', 'macOS, Linux', ['echo "export BASEDB_TOKEN=\'<jeton>\'" >> ~/.profile']),
      '',
      '### Déclarer le serveur dans le client',
      '',
      'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur.',
      'Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si',
      'rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).',
      '',
      ...fence('bash', 'Claude Code', [
        `claude mcp add basedb -- node ${RELAY} --url "$BASEDB_MCP_URL" --token-env BASEDB_TOKEN`,
      ]),
      '',
      ...fence(
        'json',
        'Autre client MCP',
        JSON.stringify(
          {
            mcpServers: {
              basedb: {
                command: 'node',
                args: [RELAY, '--url', 'https://votre-instance/mcp', '--token-env', 'BASEDB_TOKEN'],
              },
            },
          },
          null,
          2,
        ).split('\n'),
      ),
      '',
      '### Sans relais',
      '',
      'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec',
      'l’en-tête `Authorization: Bearer <jeton>`. Un jeton n’est accepté que sur les accès',
      'cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.',
      '',
      '### Vérifier',
      '',
      'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base',
      'de sa portée et ses droits effectifs.',
    ].join('\n'),
  }

  const tools: DocSection = {
    id: 'mcp-outils',
    title: 'Outils',
    group: GROUP_MCP,
    markdown: [
      `${DOCUMENTED_MCP_TOOLS.length} outils, toujours les mêmes : leur nom et leur description ne`,
      'dépendent jamais de vos données. Le schéma se découvre en les appelant.',
      '',
      ...mdTable(
        ['Outil', 'Rôle', 'Écrit'],
        DOCUMENTED_MCP_TOOLS.map((tool) => [
          code(tool.name),
          tool.summary,
          tool.needs === 'create' || tool.needs === 'update'
            ? 'oui'
            : tool.needs === 'propose'
              ? 'propose'
              : 'non',
        ]),
      ),
      '',
      '### Enchaînement type',
      '',
      '- `list_bases`, puis `describe_base` : ce qui existe.',
      '- `describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que',
      '  le jeton peut écrire (`access: "write"`).',
      '- `list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que',
      '  `has_more` vaut `true`.',
      '- Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou',
      '  `update_record` avec le `_id` trouvé.',
      '- Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis',
      '  `get_proposal` pour suivre la décision.',
      '',
      '### Propositions de structure',
      '',
      'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend',
      'dans la file « Propositions » de la base, où une personne qui peut modifier la structure',
      'l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle',
      'est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le',
      'droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.',
      '',
      '- Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même',
      '  objet remplace la précédente (`superseded`).',
      '- Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).',
      '',
      '### Ce qui n’existe pas',
      '',
      'Aucun outil ne supprime une ligne, n’exécute de SQL ni ne gère les droits ou les jetons.',
      'Un agent qui appelle un tel nom — `delete_record`, `run_sql`… — reçoit',
      '`MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.',
      '',
      '### Bornes',
      '',
      '- `limit` : 25 lignes par défaut, 100 au plus.',
      '- Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.',
      '- Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans',
      '  `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.',
      '- Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.',
    ].join('\n'),
  }

  const scope: DocSection = {
    id: 'mcp-perimetre',
    title: 'Ce que voit un agent',
    group: GROUP_MCP,
    markdown: [
      'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.',
      '',
      '- **Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les',
      '  droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est',
      '  désactivé, le jeton cesse de répondre.',
      '- **Lire, créer, modifier** — jamais supprimer. Un jeton en lecture seule refuse toute',
      '  écriture (`TOKEN_READ_ONLY`).',
      `- **Cette base** : ${
        base.agentsEnabled
          ? 'ouverte aux agents.'
          : '**fermée aux agents** — aucun outil ne la voit.'
      }`,
      `- **Colonnes réservées aux humains** : ${
        hidden.length === 0
          ? 'aucune dans ce que vous voyez de cette base.'
          : `${hidden.map((name) => code(name)).join(', ')}. Pour un agent, elles n’existent pas.`
      }`,
      '- **Des données, pas des consignes** : descriptions et contenus sont rendus comme des',
      '  données saisies par des utilisateurs, et les outils le disent à l’agent.',
      '- **Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par',
      '  leurs valeurs.',
    ].join('\n'),
  }

  return [connect, tools, scope]
}

// ── A table ───────────────────────────────────────────────────────────────────────────

function typeCell(field: ProjectedField): string {
  const marks: string[] = []
  if (field.required) marks.push('obligatoire')
  if (field.ai === true) marks.push('calculé par l’IA')
  else if (field.readOnly && !field.system) marks.push('lecture seule')
  if (field.unsafeHtml) marks.push('HTML riche — **à assainir à l’affichage**')
  if (field.hiddenFromAgents === true) marks.push('invisible pour les agents')

  let type = TYPE_LABEL[field.kind] ?? field.kind
  if (field.link?.target !== undefined) type = `relation → ${code(field.link.target.table)}`

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
    lines.push('', '### Champs relation', '', ...links.flatMap(describeLink))
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

  lines.push('', ...agentUsage(base, table))

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
      'celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les',
      'colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance',
      'à consulter.',
      '',
      'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP**',
      'pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.',
      '',
      ...mdTable(
        ['Élément', 'Valeur'],
        [
          ['Schéma PostgreSQL', code(base.name)],
          ['Préfixe des routes REST', code(prefix)],
          [
            'Agents (MCP)',
            base.agentsEnabled ? 'ouverte — voir « Connecter un agent »' : '**fermée aux agents**',
          ],
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
    group: GROUP_API,
    markdown: [
      'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le',
      'cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y',
      'compris celles qu’une page étrangère provoque.',
      '',
      '### Jeton d’intégration',
      '',
      'Un programme — script, synchronisation, autre application — présente un **jeton',
      'd’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, et crée',
      'et modifie s’il a été créé en écriture, mais **ne supprime jamais** ; et il n’a jamais plus',
      'de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la',
      'console SQL et l’IA lui restent fermées.',
      '',
      ...(base.baseActions.includes('manage_tokens')
        ? [
            'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST**',
            'coché. Il n’est affiché qu’une fois.',
          ]
        : callout(
            'NOTE',
            'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas.',
            'Demandez-en un à la personne qui la gère.',
          )),
      '',
      '### Appel',
      '',
      ...fence('bash', 'cURL', [
        'export BASEDB_URL="https://votre-instance"',
        'export BASEDB_TOKEN="<jeton>"',
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
    group: GROUP_API,
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
            'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la',
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
      '### API REST',
      '',
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
      '',
      '### Côté MCP',
      '',
      'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet',
      'JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment',
      'corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.',
      '',
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
    title: `${escapeLabel(base.label)} — documentation API et MCP`,
    sections: [
      overview,
      authentication,
      conventions,
      ...agentSections(base),
      ...base.tables.map((t) => describeTable(base, t, tenantRef)),
      relationsSection,
      responses,
      sql,
    ],
  }
}
