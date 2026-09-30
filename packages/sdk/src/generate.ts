import type { MetaBase, MetaField, MetaTable } from './meta.js'

/**
 * The types of a workspace's tables, written as TypeScript from what `/meta` describes —
 * what `basedb-sdk types` writes into a file of the program:
 *
 *   export interface Opportunites extends SystemColumns { titre: string; statut: 'nouveau' | 'gagne' | null; … }
 *   export interface OpportunitesCreate { titre: string; statut?: 'nouveau' | 'gagne' | null; … }
 *   export interface Schema { b_t4z56fq_ventes: { opportunites: { read: …; create: …; update: … } } }
 *
 * A row is typed as basedb reads it (chapter 08 §7.2): numbers as decimal text, dates as ISO
 * text, a link as `{ id, display }`, a choice as the union of its values. A row is created
 * with every required field that has no default, and none that basedb computes.
 */

const TEXT = new Set(['short_text', 'long_text', 'email', 'url'])

/** A value as basedb reads it, for a field of `kind` (a computed field: of its result). */
function readType(kind: string, field: MetaField): string {
  if (TEXT.has(kind)) return 'string'
  switch (kind) {
    case 'number':
    case 'autonumber':
    case 'count':
      return 'Decimal'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'IsoDate'
    case 'datetime':
      return 'IsoDateTime'
    case 'select':
      return choices(field)
    case 'multi_select':
      return `ReadonlyArray<${choices(field)}>`
    case 'user':
      return 'string'
    case 'link':
      return 'LinkValue'
    case 'multi_link':
      return 'ReadonlyArray<LinkValue>'
    case 'file':
    case 'image':
      return 'ReadonlyArray<FileValue>'
    default:
      return 'unknown'
  }
}

/** The values of a choice list, as a union — `string` when it has none yet. */
function choices(field: MetaField): string {
  const values = (field.options ?? []).map((o) => JSON.stringify(o.value))
  return values.length === 0 ? 'string' : values.join(' | ')
}

/** A value as a program writes it. */
function writeType(field: MetaField): string {
  switch (field.kind) {
    case 'number':
      return 'number | Decimal'
    case 'datetime':
      return 'IsoDateTime | Date'
    case 'link':
      return 'LinkWrite'
    case 'multi_link':
      return 'ReadonlyArray<LinkWrite>'
    case 'file':
    case 'image':
      return 'ReadonlyArray<FileWrite>'
    default:
      return readType(field.kind, field)
  }
}

/** What basedb computes or keeps itself: read, never written. */
const computedKinds = new Set(['formula', 'lookup', 'rollup', 'count', 'autonumber', 'button'])

const isWritten = (f: MetaField) =>
  !f.system &&
  !f.read_only &&
  f.ai !== true &&
  f.computed === undefined &&
  !computedKinds.has(f.kind)

/** A field that holds a value at all: a button is an action, not a column. */
const isRead = (f: MetaField) => !f.system && f.kind !== 'button'

function readOf(field: MetaField): string {
  const computed = field.computed
  if (computed !== undefined) {
    const one = readType(computed.result_kind, field)
    return `${computed.multiple ? `ReadonlyArray<${one}>` : one} | null`
  }
  const type = readType(field.kind, field)
  // A required field always holds a value; a link to a hidden row reads as `masked`, still an object.
  return field.required ? type : `${type} | null`
}

/** A comment for the field: its label, and its description when it has one. */
function doc(field: MetaField, indent: string): string {
  const lines = [field.label, ...(field.description ? ['', field.description] : [])]
    .join('\n')
    .replace(/\*\//g, '*\\/')
    .split('\n')
  return lines.length === 1
    ? `${indent}/** ${lines[0]} */\n`
    : `${indent}/**\n${lines.map((l) => `${indent} *${l === '' ? '' : ` ${l}`}`).join('\n')}\n${indent} */\n`
}

/** `opportunites` → `Opportunites`, `b_t4z56fq_ventes` → `Ventes`. */
export function pascal(name: string): string {
  const words = name
    .replace(/^b_[a-z0-9]+_/, '')
    .split('_')
    .filter((w) => w !== '')
  const joined = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  return /^[A-Za-z]/.test(joined) ? joined : `T${joined}`
}

const RESERVED = new Set([
  'Schema',
  'SystemColumns',
  'LinkValue',
  'FileValue',
  'LinkWrite',
  'FileWrite',
  'Decimal',
  'IsoDate',
  'IsoDateTime',
])

function tableTypes(
  table: MetaTable,
  prefix: string,
  taken: Set<string>,
): { name: string; source: string } {
  let name = `${prefix}${pascal(table.name)}`
  while (RESERVED.has(name) || taken.has(name)) name = `${name}Row`
  taken.add(name)

  const read = table.fields.filter(isRead)
  const written = table.fields.filter(isWritten)
  const header = `/** ${table.label}${table.description ? ` — ${table.description.replace(/\*\//g, '*\\/')}` : ''} (\`${table.name}\`) */\n`
  const readBody = read.map((f) => `${doc(f, '  ')}  readonly ${f.name}: ${readOf(f)}\n`).join('')
  const createBody = written
    .map((f) => {
      const needed = f.required && f.default === undefined
      return `${doc(f, '  ')}  ${f.name}${needed ? '' : '?'}: ${writeType(f)}${f.required ? '' : ' | null'}\n`
    })
    .join('')
  const updateBody = written
    .map((f) => `${doc(f, '  ')}  ${f.name}?: ${writeType(f)}${f.required ? '' : ' | null'}\n`)
    .join('')
  const source = [
    `${header}export interface ${name} extends SystemColumns {\n${readBody}}\n`,
    `/** A row of ${table.label}, as it is created. */\nexport interface ${name}Create {\n${createBody}}\n`,
    `/** The fields of a row of ${table.label} that an update changes. */\nexport interface ${name}Update {\n${updateBody}}\n`,
  ].join('\n')
  return { name, source }
}

/** The TypeScript source of the types of these bases. */
export function typesOf(
  bases: readonly MetaBase[],
  options: { readonly source?: string; readonly module?: string } = {},
): string {
  const taken = new Set<string>()
  const several = bases.length > 1
  const parts: string[] = []
  const schema: string[] = []
  for (const base of bases) {
    const entries: string[] = []
    for (const table of base.tables) {
      const { name, source } = tableTypes(table, several ? pascal(base.name) : '', taken)
      parts.push(source)
      entries.push(
        `    readonly ${table.name}: { readonly read: ${name}; readonly create: ${name}Create; readonly update: ${name}Update }\n`,
      )
    }
    schema.push(`  /** ${base.label} */\n  readonly ${base.name}: {\n${entries.join('')}  }\n`)
  }
  const module = options.module ?? '@basedb/sdk'
  // Only what is used: a project with `noUnusedLocals` refuses an import that is not.
  const body = parts.join('\n')
  const used = [...RESERVED]
    .filter((n) => n !== 'Schema' && new RegExp(`\\b${n}\\b`).test(body))
    .sort()
  return [
    `// Generated by basedb-sdk${options.source ? ` from ${options.source}` : ''}. Do not edit: run it again when the tables change.\n`,
    `import type {\n${used.map((n) => `  ${n},\n`).join('')}} from '${module}'\n`,
    ...parts,
    `/** The bases, their tables and their rows: \`new Basedb<Schema>(…)\`. */\nexport type Schema = {\n${schema.join('')}}\n`,
  ].join('\n')
}
