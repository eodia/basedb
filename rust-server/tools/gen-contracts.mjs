// Génère, depuis les paquets TypeScript compilés (la source de vérité), les tables Rust que
// `basedb-contracts` embarque : le registre des codes d'erreur (A23) et les mots réservés de
// PostgreSQL (`@basedb/naming`). À relancer quand l'un des deux change :
//
//   pnpm --filter @basedb/contracts --filter @basedb/naming build
//   node rust-server/tools/gen-contracts.mjs
//
// `cargo test -p basedb-contracts` vérifie ensuite les invariants (241 codes, statuts…).

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const out = join(here, '..', 'crates', 'contracts', 'src')

const { ERROR_CODES } = await import(
  pathToFileURL(join(repo, 'packages', 'contracts', 'dist', 'error-codes.js')).href
)
const { RESERVED_WORDS } = await import(
  pathToFileURL(join(repo, 'packages', 'naming', 'dist', 'index.js')).href
)

const str = (s) => JSON.stringify(s)
const opt = (v, f) => (v === null || v === undefined ? 'None' : `Some(${f(v)})`)

let codes = `//! GÉNÉRÉ par \`rust-server/tools/gen-contracts.mjs\` depuis \`packages/contracts\` — ne pas
//! modifier à la main. Le registre des codes d'erreur (annexe A23).

use crate::error_codes::ErrorCodeEntry;

pub(crate) static ENTRIES: &[ErrorCodeEntry] = &[
`
for (const [code, e] of Object.entries(ERROR_CODES)) {
  codes += `    ErrorCodeEntry { code: ${str(code)}, condition: ${str(e.condition)}, http_status: ${opt(e.httpStatus, String)}, http_status_note: ${opt(e.httpStatusNote, str)}, chapter: ${str(e.chapter)}, domain: ${str(e.domain)} },\n`
}
codes += '];\n'
writeFileSync(join(out, 'error_codes_table.rs'), codes)

let words = `//! GÉNÉRÉ par \`rust-server/tools/gen-contracts.mjs\` depuis \`packages/naming\` — ne pas
//! modifier à la main. Les mots réservés de PostgreSQL et leur catégorie (R, T, C).

pub(crate) static RESERVED_WORDS: &[(&str, char)] = &[
`
for (const [word, cat] of RESERVED_WORDS) words += `    (${str(word)}, '${cat}'),\n`
words += '];\n'
writeFileSync(join(out, 'naming', 'reserved_words_table.rs'), words)

console.log(
  `${Object.keys(ERROR_CODES).length} codes, ${RESERVED_WORDS.size} mots réservés écrits.`,
)
