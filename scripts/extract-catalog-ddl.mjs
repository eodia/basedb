/**
 * Extracts the SQL blocks of chapter 02 and lays them out as numbered catalog
 * migrations.
 *
 *   node scripts/extract-catalog-ddl.mjs           # inventory, writes nothing
 *   node scripts/extract-catalog-ddl.mjs --write   # writes the migrations
 *
 * Chapter 02 is authoritative on the catalog; the DDL is therefore DERIVED from it, not
 * transcribed. Not every block is DDL to apply: some are diagnostic or reconciliation
 * queries. The sorting is done on the block's first statement.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SOURCE = fileURLToPath(new URL('../docs/architecture/02-catalogue.md', import.meta.url))
const TARGET = fileURLToPath(new URL('../packages/catalog-schema/migrations', import.meta.url))

/** One migration per chapter domain, in reading order. */
const MIGRATIONS = [
  {
    file: '0001_socle.sql',
    title: 'Schemas, shared functions, physical states',
    from: 'Socle technique',
  },
  {
    file: '0002_noms_physiques.sql',
    title: 'Physical name registry and lock classes',
    from: 'Domaine 1',
  },
  { file: '0003_identite.sql', title: 'Identity, sessions, permissions', from: 'Domaine 2' },
  {
    file: '0004_structure.sql',
    title: 'Bases, tables, fields, constraints, links',
    from: 'Domaine 3',
  },
  {
    file: '0005_integrations.sql',
    title: 'Tokens, webhooks, settings, secrets, AI',
    from: 'Domaine 4',
  },
  {
    file: '0006_journalisation.sql',
    title: 'Migrations, logs, capture and drain',
    from: 'Domaine 5',
  },
  {
    file: '0007_semis.sql',
    title: 'Error codes and retention policies',
    from: 'Registre des codes',
  },
  { file: '0008_declencheurs.sql', title: 'Catalog triggers', from: 'Les déclencheurs' },
]

/** A statement that creates or alters an object, as opposed to a query. */
const DDL = /^\s*(CREATE|ALTER|COMMENT|INSERT|GRANT|REVOKE|DO\b)/i

/**
 * A block's first real statement: chapter blocks often open on an SQL comment
 * explaining what they install, and classifying them on the first line would wrongly
 * file DDL among the queries.
 */
function firstStatement(body) {
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('--')) continue
    return trimmed
  }
  return ''
}

const text = readFileSync(SOURCE, 'utf8')
const lines = text.split(/\r?\n/)

const blocks = []
// The domain comes from the level-2 heading, the section from level 3: both must be
// tracked separately. A `###` overwriting the `##` would lose the domain, since it is
// the domain that decides the host migration.
let domain = '(before the first section)'
let section = domain
let inside = false
let current = []
let startLine = 0

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]

  const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/)
  if (heading && !inside) {
    section = heading[2]
    if (heading[1] === '##') domain = heading[2]
    continue
  }

  if (/^```sql\s*$/.test(line)) {
    inside = true
    current = []
    startLine = i + 2
    continue
  }

  if (inside && /^```\s*$/.test(line)) {
    inside = false
    const body = current.join('\n').trim()
    blocks.push({
      section,
      domain,
      line: startLine,
      body,
      isDDL: DDL.test(firstStatement(body)),
      first: body.split('\n')[0].slice(0, 76),
    })
    continue
  }

  if (inside) current.push(line)
}

const write = process.argv.includes('--write')
// 0001 is PUBLISHED (0.1.0): installations recorded its checksum, and would refuse to start
// on a rewritten one. The catalog now changes by numbered migrations — see
// scripts/catalog-migrations.mjs; this script only takes the inventory of chapter 02.
if (write) {
  console.error(
    '✗ 0001_catalogue.sql est scellée : un changement du catalogue va dans une nouvelle migration (pnpm catalog new <nom>).',
  )
  process.exit(1)
}

console.log(`${blocks.length} SQL blocks in chapter 02\n`)
for (const b of blocks) {
  const mark = b.isDDL ? 'DDL ' : 'qry '
  console.log(
    `  ${mark} L${String(b.line).padStart(4)}  ${b.section.slice(0, 38).padEnd(38)} ${b.first}`,
  )
}

const ddl = blocks.filter((b) => b.isDDL)
console.log(`\n${ddl.length} DDL blocks, ${blocks.length - ddl.length} queries set aside`)

if (!write) {
  console.log('\n(inventory only — rerun with --write to produce the migrations)')
  process.exit(0)
}

/** Files a block into the migration whose chapter section carries the prefix. */
function migrationOf(sectionName) {
  for (let i = MIGRATIONS.length - 1; i >= 0; i--) {
    if (sectionName.startsWith(MIGRATIONS[i].from)) return i
  }
  return null
}

/**
 * Splits SQL into statements, on top-level `;`.
 *
 * Must know about strings, comments and above all dollar quoting: a function body
 * `$$ ... ; ... $$` contains `;` that terminate nothing.
 */
function splitStatements(sql) {
  const statements = []
  let current_ = ''
  let i = 0
  let dollar = null

  while (i < sql.length) {
    const rest = sql.slice(i)

    if (dollar) {
      if (rest.startsWith(dollar)) {
        current_ += dollar
        i += dollar.length
        dollar = null
        continue
      }
      current_ += sql[i++]
      continue
    }

    const opening = rest.match(/^\$[a-z_]*\$/i)
    if (opening) {
      dollar = opening[0]
      current_ += dollar
      i += dollar.length
      continue
    }

    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i)
      const stop = end === -1 ? sql.length : end
      current_ += sql.slice(i, stop)
      i = stop
      continue
    }

    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2)
      const stop = end === -1 ? sql.length : end + 2
      current_ += sql.slice(i, stop)
      i = stop
      continue
    }

    if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2
          continue
        }
        if (sql[j] === "'") break
        j++
      }
      current_ += sql.slice(i, j + 1)
      i = j + 1
      continue
    }

    if (sql[i] === ';') {
      statements.push(`${current_.trim()};`)
      current_ = ''
      i++
      continue
    }

    current_ += sql[i++]
  }

  if (current_.trim() !== '') statements.push(current_.trim())
  return statements.filter((s) => s.replace(/--[^\n]*/g, '').trim() !== ';')
}

/** Catalog objects a block creates. */
function createdObjects(body) {
  const found = new Set()
  const re =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+|UNLOGGED\s+)?(TABLE|VIEW|SEQUENCE|FUNCTION|TYPE|SCHEMA|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_.]*)/gi
  for (const m of body.matchAll(re)) {
    const [, kind, name] = m
    // An index is not a dependency: its table is what counts.
    if (kind.toUpperCase() === 'INDEX') continue
    found.add(name.toLowerCase())
  }
  return found
}

/** Catalog objects a block references, and which must therefore pre-exist. */
function referencedObjects(body) {
  const found = new Set()
  const patterns = [
    /REFERENCES\s+([a-z_][a-z0-9_.]*)/gi,
    /nextval\('([a-z_][a-z0-9_.]*)'/gi,
    /\bFROM\s+(_basedb(?:_local)?\.[a-z0-9_]+)/gi,
    /\bJOIN\s+(_basedb(?:_local)?\.[a-z0-9_]+)/gi,
    /DEFAULT\s+(_basedb(?:_local)?\.[a-z0-9_]+)\s*\(/gi,
    /\bON\s+(_basedb(?:_local)?\.[a-z0-9_]+)/gi,
    /ALTER\s+TABLE\s+(?:ONLY\s+)?(_basedb(?:_local)?\.[a-z0-9_]+)/gi,
    /\bINSERT\s+INTO\s+(_basedb(?:_local)?\.[a-z0-9_]+)/gi,
    /\bCOMMENT\s+ON\s+\w+\s+(_basedb(?:_local)?\.[a-z0-9_]+)/gi,
  ]
  for (const re of patterns) {
    for (const m of body.matchAll(re)) found.add(m[1].toLowerCase())
  }
  return found
}

/**
 * Removes from a `CREATE TABLE` the inline foreign keys targeting a table that does not
 * exist yet, and returns the matching `ALTER TABLE ... ADD CONSTRAINT`.
 *
 * The constraint name follows the normative pattern `fk_<table>__<column>` of chapter
 * 01 §9.1: that is the name PostgreSQL will show in a violation message.
 */
function deferForeignKeys(body, targets) {
  const table = body.match(/CREATE\s+TABLE\s+([a-z_][a-z0-9_.]*)/i)?.[1]
  if (!table) return { body, deferred: [] }
  const bareTable = table.split('.').pop()

  const deferred = []
  let output = body

  for (const target of targets) {
    const escaped = target.replace(/[.]/g, '\\.')
    // `  <column> <type…> REFERENCES <target>(<col>) <actions>,`
    const re = new RegExp(
      `^([ \\t]*)([a-z_][a-z0-9_]*)([^\\n,]*?)\\s+REFERENCES\\s+${escaped}\\s*\\(([a-z_][a-z0-9_]*)\\)([^\\n,]*)(,?)$`,
      'gim',
    )

    output = output.replace(re, (_all, indent, column, before, targetCol, actions, comma) => {
      const name = `fk_${bareTable}__${column}`
      deferred.push({
        target,
        sql: `-- Deferred constraint: ${table}.${column} → ${target}, creation cycle.\n--\n-- DEFERRABLE INITIALLY DEFERRED: a CREATION cycle is almost always an INSERTION\n-- cycle too. \`tenant.created_by\` requires an \`app_user\`, whose \`tenant_id\`\n-- requires a \`tenant\`: without deferring the check to COMMIT, the product's very\n-- first bootstrap would be impossible. Chapter 02 already applies this regime to\n-- the \`table_def\` ↔ \`field\` cycle.\nALTER TABLE ${table}\n  ADD CONSTRAINT ${name} FOREIGN KEY (${column})\n  REFERENCES ${target}(${targetCol})${actions.trimEnd()}\n  DEFERRABLE INITIALLY DEFERRED;`,
      })
      return `${indent}${column}${before}${comma}`
    })
  }

  return { body: output, deferred }
}

/**
 * Sorts the blocks so that every referenced object is created before being referenced.
 *
 * Chapter 02 presents the DDL by functional domain — that is the READING order, which
 * is not an APPLICATION order: the physical name registry references `app_user`, which
 * belongs to the next domain. The sort is stable: at equal dependencies the document
 * order is preserved, so the migrations stay readable against the chapter.
 */
function sortByDependencies(sourceBlocks) {
  // Sorting is done on STATEMENTS, not blocks: a chapter block groups several tables by
  // reading affinity, and those groupings create cycles that do not exist between the
  // tables themselves. Thus the block creating `base` also creates `sql_view_alias`,
  // which references `table_def`, which references `base`.
  let order = 0
  const remaining = sourceBlocks.flatMap((b) =>
    splitStatements(b.body).map((body) => ({
      section: b.section,
      domain: b.domain,
      line: b.line,
      body,
      index: order++,
      creates: createdObjects(body),
      requires: referencedObjects(body),
    })),
  )

  const available = new Set(['pg_catalog', 'public'])
  const ordered = []
  const deferredReports = []

  while (remaining.length > 0) {
    const next = remaining.findIndex((b) =>
      [...b.requires].every((dep) => available.has(dep) || b.creates.has(dep)),
    )

    if (next === -1) {
      // A real cycle. `tenant.created_by` references `app_user`, and
      // `app_user.tenant_id` references `tenant`: no order creates both with inline
      // foreign keys. We break the cycle as the DDL engine will have to for user tables
      // (chapter 03) — the table is created without the offending constraint, which is
      // DEFERRED into an `ALTER TABLE ... ADD CONSTRAINT` once the target is present.
      let chosen = 0
      let fewest = Number.POSITIVE_INFINITY
      for (let i = 0; i < remaining.length; i++) {
        const missingCount = [...remaining[i].requires].filter(
          (d) => !available.has(d) && !remaining[i].creates.has(d),
        ).length
        if (missingCount < fewest) {
          fewest = missingCount
          chosen = i
        }
      }

      const block = remaining[chosen]
      const missing = [...block.requires].filter((d) => !available.has(d) && !block.creates.has(d))
      const { body, deferred } = deferForeignKeys(block.body, missing)

      deferredReports.push({ line: block.line, missing, deferred: deferred.length })
      remaining.splice(chosen, 1)
      for (const o of block.creates) available.add(o)
      ordered.push({ ...block, body })

      // The deferred constraints become statements in their own right, which the sort
      // will place by itself after their target is created.
      for (const alter of deferred) {
        remaining.push({
          section: block.section,
          domain: block.domain,
          line: block.line,
          body: alter.sql,
          index: order++,
          creates: new Set(),
          requires: new Set([alter.target]),
        })
      }
      continue
    }

    const [block] = remaining.splice(next, 1)
    for (const o of block.creates) available.add(o)
    ordered.push(block)
  }

  return { ordered, deferredReports }
}

const { ordered, deferredReports } = sortByDependencies(ddl)

if (deferredReports.length > 0) {
  console.log('\nBlocks laid out in document order for lack of an orderable position:')
  for (const d of deferredReports) {
    console.log(`  line ${d.line} — unresolved reference: ${d.missing.join(', ')}`)
  }
}

// ONE single migration for creating the catalog.
//
// The chapter's split by domain is a READING convenience: laid out in thematic files it
// reintroduces disorder between them, since dependencies cross domains. The system
// catalog is installed in one go at bootstrap (chapter 10 §9.2); `_basedb.catalog_migration`
// then versions its evolutions, which will be 0002, 0003, each with its own order.
mkdirSync(TARGET, { recursive: true })

const header = `-- 0001_catalogue.sql — the \`_basedb\` catalog and the colocated \`_basedb_local\` schema\n--\n-- GENERATED FILE from docs/architecture/02-catalogue.md.\n-- Regenerate with: node scripts/extract-catalog-ddl.mjs --write\n--\n-- Chapter 02 is authoritative on the catalog: every correction is made in the\n-- document, never here.\n--\n-- ${ordered.length} statements, topologically sorted. The chapter order is a reading order,\n-- not an application order: the name registry references \`app_user\`, which belongs to\n-- the next domain.\n\n`

// The trigger functions are written by hand: the chapter gives their role, not their
// body. They are injected at the top — `check_function_bodies` does not validate the
// existence of relations cited inside a PL/pgSQL body, so they may precede the tables
// they read.
const FUNCTIONS = fileURLToPath(
  new URL('../packages/catalog-schema/sql/fonctions-declencheurs.sql', import.meta.url),
)
const functions = readFileSync(FUNCTIONS, 'utf8').trim()

// The `fold_v1` folding function is confronted with chapter 04 by a dedicated test; it
// is injected along with the other `_basedb_local` functions, before any table.
const NORMALIZATION = fileURLToPath(
  new URL('../packages/catalog-schema/sql/fonctions-normalisation.sql', import.meta.url),
)
const normalization = readFileSync(NORMALIZATION, 'utf8').trim()

// The indexes on referencing columns are written by hand too, and for the same reason:
// the chapter deliberately omits them from its DDL blocks and entrusts their creation
// to a mechanism, not to a list.
// The version triggers come last: `CREATE TRIGGER` needs its table to exist, unlike a
// PL/pgSQL body. They keep `catalog_version` and `authz_version` honest whoever writes —
// the application, a script, or a person in psql.
const VERSIONS = fileURLToPath(
  new URL('../packages/catalog-schema/sql/declencheurs-versions.sql', import.meta.url),
)
const versions = readFileSync(VERSIONS, 'utf8').trim()

const FK_INDEXES = fileURLToPath(
  new URL('../packages/catalog-schema/sql/index-cles-etrangeres.sql', import.meta.url),
)
const fkIndexes = readFileSync(FK_INDEXES, 'utf8').trim()

// The data history of chapter 07 — capture, journals, immutability — owns its DDL, as
// chapter 02 says of it: it is written by hand after chapter 07 and comes last, since it
// partitions tables chapter 02 creates (change_event, webhook_delivery).
const HISTORY = fileURLToPath(
  new URL('../packages/catalog-schema/sql/historique.sql', import.meta.url),
)
const history = readFileSync(HISTORY, 'utf8').trim()

// The integrity of multi-links (chapter 04 §4 bis): two shared trigger functions of
// _basedb_local, which the DDL engine attaches to the tables of each such field.
const MULTI_LINKS = fileURLToPath(
  new URL('../packages/catalog-schema/sql/relations-multiples.sql', import.meta.url),
)
const multiLinks = readFileSync(MULTI_LINKS, 'utf8').trim()

// The functions a stored formula may call beyond PostgreSQL's own (chapter 04 §7.3).
const FORMULAS = fileURLToPath(
  new URL('../packages/catalog-schema/sql/formules.sql', import.meta.url),
)
const formulas = readFileSync(FORMULAS, 'utf8').trim()

// The lifecycle of chapter 06 completes what chapter 02 left half-set on the aliases, and
// adds the export a purge requires. After the history: it alters tables created above.
const LIFECYCLE = fileURLToPath(
  new URL('../packages/catalog-schema/sql/cycle-de-vie.sql', import.meta.url),
)
const lifecycle = readFileSync(LIFECYCLE, 'utf8').trim()

// The structure history of chapter 07 §8 — `structure_revision` and the triggers that
// feed it — comes last of all: its triggers sit on catalog tables every block above
// creates, and its immutability reuses the history's function.
const STRUCTURE_HISTORY = fileURLToPath(
  new URL('../packages/catalog-schema/sql/historique-structure.sql', import.meta.url),
)
const structureHistory = readFileSync(STRUCTURE_HISTORY, 'utf8').trim()

// The functions live in `_basedb`: they slot in after the `CREATE SCHEMA` statements
// and before everything else.
const afterSchemas = ordered.findLastIndex((b) => /^\s*CREATE\s+SCHEMA/i.test(b.body)) + 1

let previousSection = null
const head = ordered.slice(0, afterSchemas)
const tail = ordered.slice(afterSchemas)

const render = (list) =>
  list
    .map((b) => {
      const title =
        b.section === previousSection
          ? ''
          : `\n-- ${'─'.repeat(72)}\n-- ${b.section} (chapter 02, line ${b.line})\n-- ${'─'.repeat(72)}\n`
      previousSection = b.section
      return `${title}${b.body}`
    })
    .join('\n\n')

writeFileSync(
  `${TARGET}/0001_catalogue.sql`,
  `${header}${render(head)}\n\n${normalization}\n\n${functions}\n\n${render(tail)}\n\n${fkIndexes}\n\n${versions}\n\n${history}\n\n${multiLinks}\n\n${formulas}\n\n${lifecycle}\n\n${structureHistory}\n`,
)
console.log(`\n  0001_catalogue.sql  ${ordered.length} statements`)
void migrationOf
void MIGRATIONS
