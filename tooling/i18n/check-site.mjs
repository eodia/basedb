// The site's dictionaries against the French one — www/src/i18n/ui/<code>.ts.
//
//   node tooling/i18n/check-site.mjs [code…]
//
// Compiles `ui/fr.ts` and `ui/<code>.ts` (types dropped), then walks both: keys the
// translation lacks (they read in French), keys French doesn't have (the build refuses
// them), and strings whose `{placeholders}` or `<tags>` differ from the French.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '../..',
)
const dir = path.join(root, 'www/src/i18n/ui')
const require = createRequire(path.join(root, 'apps/web/package.json'))
const ts = require('typescript')

async function load(file) {
  const source = fs.readFileSync(file, 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const cleaned = js.replace(/^import .*$/gm, '')
  const mod = await import(`data:text/javascript;base64,${Buffer.from(cleaned).toString('base64')}`)
  return mod.default
}

const tokens = (s, re) =>
  [...String(s).matchAll(re)]
    .map((m) => m[0])
    .sort()
    .join(' ')
const PLACEHOLDER = /(?<!\{)\{\w+\}(?!\})/g
const TAG = /<\/?(strong|code|a|em|br|span)\b/g

function walk(fr, tr, at, out) {
  if (typeof fr === 'string') {
    if (typeof tr !== 'string') return out.errors.push(`${at}: a string is expected`)
    if (tokens(fr, PLACEHOLDER) !== tokens(tr, PLACEHOLDER))
      out.errors.push(`${at}: placeholders ${tokens(tr, PLACEHOLDER)} ≠ ${tokens(fr, PLACEHOLDER)}`)
    if (tokens(fr, TAG) !== tokens(tr, TAG)) out.warnings.push(`${at}: tags differ`)
    out.translated++
    return
  }
  if (typeof fr === 'function' || fr === null || typeof fr !== 'object') return
  if (Array.isArray(fr)) {
    if (!Array.isArray(tr)) return out.errors.push(`${at}: a list is expected`)
    fr.forEach((item, i) =>
      i < tr.length ? walk(item, tr[i], `${at}[${i}]`, out) : out.missing.push(`${at}[${i}]`),
    )
    return
  }
  if (typeof tr !== 'object' || tr === null) return out.errors.push(`${at}: an object is expected`)
  for (const key of Object.keys(fr)) {
    if (key in tr) walk(fr[key], tr[key], at ? `${at}.${key}` : key, out)
    else out.missing.push(at ? `${at}.${key}` : key)
  }
  for (const key of Object.keys(tr))
    if (!(key in fr) && !['one', 'few', 'many', 'other', 'two', 'zero'].includes(key))
      out.errors.push(`${at}.${key}: not in French`)
}

const fr = await load(path.join(dir, 'fr.ts'))
const codes =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : fs
        .readdirSync(dir)
        .filter((f) => /^[a-z]{2}(-[a-z]{2})?\.ts$/.test(f) && f !== 'fr.ts')
        .map((f) => f.slice(0, -3))
for (const code of codes) {
  const file = path.join(dir, `${code}.ts`)
  if (!fs.existsSync(file)) {
    console.log(`${code}: no file`)
    continue
  }
  const out = { translated: 0, missing: [], errors: [], warnings: [] }
  walk(fr, await load(file), '', out)
  console.log(
    `${code}: ${out.translated} strings, ${out.missing.length} missing, ${out.errors.length} errors, ${out.warnings.length} warnings`,
  )
  for (const e of out.errors.slice(0, 30)) console.log(`  ✗ ${e}`)
  for (const m of out.missing.slice(0, 30)) console.log(`  … missing: ${m}`)
  for (const w of out.warnings.slice(0, 10)) console.log(`  ! ${w}`)
}
