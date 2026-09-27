// The sentences of apps/web to translate — chapter 11 §10.
//
//   node tooling/i18n/extract.mjs
//
// Reads every `$t('…')` and `$tp(n, '…', '…')` of apps/web/src, plus the texts the
// interface translates without writing them itself — the descriptions of the system
// columns (packages/core) and the cards of the official templates (packages/templates) —
// and writes tooling/i18n/app-source.json: each French sentence, its plural forms when it
// has some, and where it is used, for the translator's context.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '../..',
)
const web = path.join(root, 'apps/web')
const require = createRequire(path.join(web, 'package.json'))
const ts = require('typescript')

const entries = new Map()
const dynamic = []

function add(key, where, forms) {
  let entry = entries.get(key)
  if (entry === undefined) {
    entry = forms === undefined ? { where: [] } : { one: forms.one, other: forms.other, where: [] }
    entries.set(key, entry)
  } else if (forms !== undefined && entry.one === undefined) {
    entry.one = forms.one
    entry.other = forms.other
  }
  if (entry.where.length < 3 && !entry.where.includes(where)) entry.where.push(where)
}

const literal = (node) =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, found)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(p)
  }
  return found
}

for (const file of walk(path.join(web, 'src'))) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes('$t')) continue
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const rel = path.relative(path.join(web, 'src'), file).replace(/\\/g, '/')
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const where = `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`
      if (node.expression.text === '$t' || node.expression.text === 'msg') {
        const key = literal(node.arguments[0])
        if (key !== null) add(key, where)
        else dynamic.push(where)
      } else if (node.expression.text === '$tp') {
        const one = literal(node.arguments[1])
        const other = literal(node.arguments[2])
        if (one !== null && other !== null) add(other, where, { one, other })
        else dynamic.push(where)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

// The descriptions of the system columns, as the server writes them.
const description = fs.readFileSync(
  path.join(root, 'packages/core/src/catalog/description.ts'),
  'utf8',
)
const block = /SYSTEM_COLUMN_DESCRIPTIONS[^{]*\{([\s\S]*?)\n\}/.exec(description)?.[1] ?? ''
for (const m of block.matchAll(/^\s*\w+:\s*'((?:[^'\\]|\\.)*)'/gm))
  add(m[1], 'packages/core/src/catalog/description.ts')

// The cards of the official templates.
const catalog = path.join(root, 'packages/templates/catalog')
for (const name of fs.readdirSync(catalog).filter((n) => n.endsWith('.json'))) {
  const t = JSON.parse(fs.readFileSync(path.join(catalog, name), 'utf8'))
  const where = `packages/templates/catalog/${name}`
  for (const key of ['label', 'summary', 'description', 'category'])
    if (typeof t[key] === 'string') add(t[key], where)
  for (const tag of t.tags ?? []) if (typeof tag === 'string') add(tag, where)
}

const sorted = Object.fromEntries(
  [...entries.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr')),
)
fs.writeFileSync(
  path.join(root, 'tooling/i18n/app-source.json'),
  `${JSON.stringify(sorted, null, 2)}\n`,
  'utf8',
)
const plurals = [...entries.values()].filter((e) => e.one !== undefined).length
const words = [...entries.keys()].join(' ').split(/\s+/).length
console.log(
  `${entries.size} sentences (${plurals} with plural forms, about ${words} words); ${dynamic.length} calls with a computed key`,
)
