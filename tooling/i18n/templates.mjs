// The official templates in the nineteen other languages — chapter 20.
//
//   node tooling/i18n/templates.mjs extract                the texts → templates-source.json
//   node tooling/i18n/templates.mjs prefill [locale…]      the gallery cards, from the app
//   node tooling/i18n/templates.mjs check [locale…] [--strict]
//
// A template is written in French (packages/templates/catalog/<key>.json). Its texts in a
// language are a dictionary, packages/templates/i18n/<locale>/<key>.json: the French text →
// its translation, in reading order. `check` says, per template, what is missing, what no
// longer exists, which translation loses a `{{citation}}` or breaks a limit, and whether the
// template, once localized, is still valid — the same validator an instance applies.
// `--strict` fails on errors (exit 1).
//
// Needs the compiled packages: npx tsc -b packages/templates
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { LOCALES } from './check.mjs'

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '../..',
)
const load = (p) => import(pathToFileURL(path.join(root, p)).href)
const { checkTemplate, localizeTemplate, templateTexts } = await load(
  'packages/contracts/dist/index.js',
)
const { bundledTemplates } = await load('packages/templates/dist/index.js')

const SOURCE = path.join(root, 'tooling/i18n/templates-source.json')
const dictionaryFile = (locale, key) =>
  path.join(root, 'packages/templates/i18n', locale, `${key}.json`)
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
const read = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {})

/** The catalog's templates, checked, by key. */
function templates() {
  const out = new Map()
  for (const { file, raw } of bundledTemplates()) {
    const check = checkTemplate(raw)
    if (!check.ok) throw new Error(`${file} is not a valid template`)
    out.set(check.template.key, check.template)
  }
  return out
}

/** The longest a text of a kind may be once translated — the validator's limits. */
const LIMITS = { label: 80, option: 80, tag: 30, button: 40 }

const citations = (text) =>
  [...String(text).matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1]).sort()
const tags = (text) =>
  [...String(text).matchAll(/<\/?([a-z0-9]+)\b/gi)].map((m) => m[1].toLowerCase()).sort()
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/** The problems of one dictionary: `{ translated, missing, stale, errors }`. */
export function checkDictionary(template, dictionary, texts = templateTexts(template)) {
  const result = { translated: 0, missing: [], stale: [], errors: [] }
  const known = new Set(texts.map((t) => t.text))
  for (const key of Object.keys(dictionary)) if (!known.has(key)) result.stale.push(key)
  for (const { text, kind } of texts) {
    const value = dictionary[text]
    if (typeof value !== 'string' || value.trim() === '') {
      result.missing.push(text)
      continue
    }
    result.translated++
    if (!same(citations(text), citations(value)))
      result.errors.push(`${text}: citations {{${citations(value)}}} ≠ {{${citations(text)}}}`)
    if (kind === 'rich' && !same(tags(text), tags(value)))
      result.errors.push(`${text.slice(0, 60)}…: HTML tags differ`)
    const limit = LIMITS[kind]
    if (limit !== undefined && value.trim().length > limit)
      result.errors.push(`${text}: ${value.length} characters, ${limit} at most`)
    if (kind === 'url' && !/^(https?:\/\/|mailto:)/i.test(value))
      result.errors.push(`${text}: an address keeps its scheme (https://, mailto:)`)
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+$/.test(value))
      result.errors.push(`${text}: not an e-mail address`)
  }
  const check = localizeTemplate(template, dictionary)
  if (!check.ok) {
    for (const issue of check.issues)
      result.errors.push(`localized: ${issue.path} — ${issue.message}`)
  }
  return result
}

const [command, ...rest] = process.argv.slice(2)
const strict = rest.includes('--strict')
const locales = rest.filter((a) => !a.startsWith('--'))
const chosen = locales.length > 0 ? locales : LOCALES

if (command === 'extract') {
  const out = {}
  let count = 0
  let words = 0
  for (const [key, template] of templates()) {
    out[key] = Object.fromEntries(
      templateTexts(template).map(({ text, kind, where }) => [text, { kind, where }]),
    )
    count += Object.keys(out[key]).length
    words += Object.keys(out[key]).reduce((n, t) => n + t.split(/\s+/).length, 0)
  }
  write(SOURCE, out)
  console.log(`${count} texts (about ${words} words) in ${Object.keys(out).length} templates`)
} else if (command === 'prefill') {
  // The gallery card of each template — name, summary, description, category, tags — is
  // already translated in the app's catalogs: the dictionaries start from it.
  for (const locale of chosen) {
    const app = read(path.join(root, 'apps/web/src/locales', `${locale}.json`))
    let filled = 0
    for (const [key, template] of templates()) {
      const file = dictionaryFile(locale, key)
      const dictionary = read(file)
      const texts = templateTexts(template)
      for (const { text } of texts) {
        if (dictionary[text] === undefined && typeof app[text] === 'string') {
          dictionary[text] = app[text]
          filled++
        }
      }
      // In reading order, the order the texts are listed in.
      const ordered = Object.fromEntries(
        texts
          .filter((t) => dictionary[t.text] !== undefined)
          .map((t) => [t.text, dictionary[t.text]]),
      )
      if (Object.keys(ordered).length > 0) write(file, ordered)
    }
    console.log(`${locale}: ${filled} texts taken from the app's catalog`)
  }
} else if (command === 'check') {
  let failed = false
  for (const locale of chosen) {
    let translated = 0
    let total = 0
    const lines = []
    for (const [key, template] of templates()) {
      const texts = templateTexts(template)
      const r = checkDictionary(template, read(dictionaryFile(locale, key)), texts)
      translated += r.translated
      total += texts.length
      if (r.errors.length > 0) failed = true
      if (r.missing.length + r.stale.length + r.errors.length > 0) {
        lines.push(
          `  ${key}: ${r.translated}/${texts.length}, ${r.missing.length} missing, ${r.stale.length} stale, ${r.errors.length} errors`,
        )
        for (const e of r.errors.slice(0, 20)) lines.push(`    ✗ ${e}`)
        for (const m of r.missing.slice(0, 5)) lines.push(`    … missing: ${m.slice(0, 80)}`)
        for (const s of r.stale.slice(0, 5)) lines.push(`    ~ stale: ${s.slice(0, 80)}`)
      }
    }
    console.log(`${locale}\t${translated}/${total} texts translated`)
    for (const line of lines) console.log(line)
  }
  if (strict && failed) process.exit(1)
} else {
  console.log('usage: templates.mjs extract | prefill [locale…] | check [locale…] [--strict]')
}
