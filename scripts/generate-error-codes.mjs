/**
 * Generates `@basedb/contracts/src/error-codes.ts` from the annex of chapter 00.
 *
 *   node scripts/generate-error-codes.mjs
 *
 * The source of truth remains the document: A23 fixes "one code per condition" and
 * designates the annex's "Normative chapter" column as the sole authority on a code's
 * parentage. Copying that table by hand would make it diverge on the first addition; it
 * is therefore derived, and a test checks that the generated file is up to date.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SOURCE = fileURLToPath(
  new URL('../docs/architecture/00-decisions-structurantes.md', import.meta.url),
)
const TARGET = fileURLToPath(new URL('../packages/contracts/src/error-codes.ts', import.meta.url))

/** Turns a section title into a domain identifier. */
function domainOf(title) {
  return title
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const lines = readFileSync(SOURCE, 'utf8').split(/\r?\n/)
const start = lines.findIndex((l) => /^## Annexe/.test(l))
if (start === -1) throw new Error('Annex not found in chapter 00.')

const codes = []
let currentDomain = null

for (const line of lines.slice(start)) {
  const title = line.match(/^###\s+(.+?)\s*$/)
  if (title) {
    currentDomain = { label: title[1], key: domainOf(title[1]) }
    continue
  }

  const cells = line.match(/^\|\s*`([A-Z0-9_]+)`\s*\|(.+)\|\s*$/)
  if (!cells) continue

  const [, code, rest] = cells
  const columns = rest.split('|').map((c) => c.trim())
  if (columns.length < 3) throw new Error(`Malformed row for ${code}: ${line}`)

  const [condition, status, chapter] = columns
  const rawStatus = status.replace(/[`*]/g, '').trim()

  // A code may carry two statuses depending on its origin — such as
  // `IDENTIFIER_INVALID`, "422 ; 500 si construit par le noyau": entering a technical
  // name outside the alphabet is a validation error, the same condition reached by an
  // identifier the kernel built is an incident. We keep the first as the main status
  // and preserve the whole wording.
  const first = rawStatus.match(/\b(\d{3})\b/)
  const http = first ? Number(first[1]) : null
  const note = /^(\d{3}|—)$/.test(rawStatus) ? null : rawStatus

  codes.push({
    code,
    condition: condition.replace(/`/g, ''),
    http,
    chapter: chapter.replace(/[`*]/g, ''),
    note,
    domain: currentDomain?.key ?? 'unknown',
  })
}

if (codes.length === 0) throw new Error('No code extracted — the annex format has changed.')

const duplicates = codes.map((c) => c.code).filter((c, i, a) => a.indexOf(c) !== i)
if (duplicates.length > 0) {
  throw new Error(`A23 requires one code per condition; duplicates found: ${duplicates.join(', ')}`)
}

const domains = [...new Set(codes.map((c) => c.domain))]

const output = `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source: docs/architecture/00-decisions-structurantes.md, "Error code registry"
// annex. Regenerate with: node scripts/generate-error-codes.mjs
//
// A23: "A single registry [...] fixes one code per condition. A chapter may add a code
// to it, never rename one." The "Normative chapter" column alone is authoritative on a
// code's parentage.
//
// ${codes.length} codes, ${domains.length} domains.
//
// The \`condition\` strings are quoted verbatim from the French document, which is
// authoritative on their wording.

/** Functional domain of a code, taken from the annex sections. */
export type ErrorDomain =
${domains.map((d) => `  | '${d}'`).join('\n')}

/** Every error code in the registry. */
export type ErrorCode =
${codes.map((c) => `  | '${c.code}'`).join('\n')}

export interface ErrorCodeEntry {
  /** The condition this code denotes, as the annex words it. */
  readonly condition: string
  /** Associated HTTP status, or \`null\` when the condition has no HTTP surface. */
  readonly httpStatus: number | null
  /** Whole status wording when it depends on the origin, otherwise \`null\`. */
  readonly httpStatusNote: string | null
  /** Chapter defining the code. Sole authority on its parentage. */
  readonly chapter: string
  readonly domain: ErrorDomain
}

export const ERROR_CODES: Readonly<Record<ErrorCode, ErrorCodeEntry>> = Object.freeze({
${codes
  .map(
    (c) => `  ${c.code}: Object.freeze({
    condition: ${JSON.stringify(c.condition)},
    httpStatus: ${c.http === null ? 'null' : c.http},
    httpStatusNote: ${c.note === null ? 'null' : JSON.stringify(c.note)},
    chapter: ${JSON.stringify(c.chapter)},
    domain: '${c.domain}',
  }),`,
  )
  .join('\n')}
})

/** The list of codes, in annex order. */
export const ALL_ERROR_CODES: readonly ErrorCode[] = Object.freeze(
  Object.keys(ERROR_CODES) as ErrorCode[],
)

/** True if the string is a code of the registry. */
export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ERROR_CODES, value)
}

/**
 * HTTP status of a code, or \`null\` for a condition with no HTTP surface (startup
 * refusal, internal incident). Only the HTTP adapter uses it: the kernel knows nothing
 * of status codes (chapter 10 §2.2).
 */
export function httpStatusFor(code: ErrorCode): number | null {
  return ERROR_CODES[code].httpStatus
}
`

writeFileSync(TARGET, output)
console.log(`${codes.length} codes generated into ${TARGET}`)
for (const d of domains) {
  console.log(`  ${d.padEnd(32)} ${codes.filter((c) => c.domain === d).length}`)
}
