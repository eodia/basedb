// Wraps the French texts of apps/web in `$t(...)` — chapter 11 §10.
//
//   node tooling/i18n/codemod.mjs [--write] [files…]
//
// Without --write it only reports. It reads the TypeScript syntax tree, never the text:
// JSX text (runs of text and simple expressions become one sentence with `{name}`
// placeholders), text attributes (`aria-label`, `title`, `placeholder`…), and string and
// template literals whose content reads as French prose. What it cannot decide — plurals
// assembled from a suffix (`ligne{n > 1 ? 's' : ''}`), text inside `<code>` — is listed in
// the report, for a person.
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

const args = process.argv.slice(2)
const write = args.includes('--write')
// --audit: every context read as strong — lists single words a table of labels holds.
const audit = args.includes('--audit')
const only = args.filter((a) => !a.startsWith('--'))

const SKIP_FILES = [
  /[\\/]lib[\\/]i18n(-server)?\.ts$/,
  /[\\/]locales[\\/]/,
  /\.test\.tsx?$/,
  /[\\/]components[\\/]api-reference[\\/]highlight\.ts$/,
]

// ── What reads as French ─────────────────────────────────────────────────────────────

const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿŒœ'
const ACCENT = /[À-ÖØ-öø-ÿŒœ«»’…]/
const STOPWORD =
  /(^|[\s(«'’])(le|la|les|un|une|des|du|de|d’|l’|et|ou|à|au|aux|en|pour|par|sur|dans|avec|sans|ce|cet|cette|ces|vous|votre|vos|est|sont|pas|ne|n’|qui|que|qu’|se|sa|son|ses|leur|leurs|il|elle|on|y|plus|tout|tous|toute|toutes|aucun|aucune|cette|ici|déjà|encore|bien|chaque|même|ni|si|puis|quand|comme)(?=[\s,.;:!?)»…]|$)/i
const TAILWIND =
  /(^|\s)(-?[a-z]+:)*(flex|grid|block|inline|hidden|contents|table|absolute|relative|fixed|sticky|static|truncate|italic|underline|uppercase|lowercase|capitalize|shrink-0|grow|sr-only|antialiased|tabular-nums|(text|bg|border|px|py|pt|pb|pl|pr|p|m|mx|my|mt|mb|ml|mr|w|h|min-w|max-w|min-h|max-h|gap|space|rounded|font|leading|tracking|size|inset|top|left|right|bottom|z|opacity|shadow|ring|outline|overflow|cursor|select|pointer-events|transition|duration|ease|animate|items|justify|self|place|content|order|col|row|basis|fill|stroke|object|aspect|divide|line-clamp|whitespace|break|scroll|snap|translate|rotate|scale|origin|decoration|underline-offset|list|align|from|to|via|backdrop|blur|grayscale|invert|sepia|accent|caret)-[^\s]+)(?=\s|$)/
const CODE_LIKE =
  /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM)\b|=>|\(\)\s*[;{]|^\s*[{[]|:\/\/|^\s*\/|^[#.][\w-]+$|^[\w-]+\/[\w.+-]+$|^\w+(\.\w+)+\(|\$\{/

function words(text) {
  // A placeholder stands for a word: `Dans {table}` has two, `past{n}{unit}s` one.
  return text
    .replace(/\{\w+\}/g, '0')
    .replace(/<[^>]+>/g, ' ')
    .trim()
}

/** Prose a person reads — in French. `strong` allows a single capitalized word. */
function isFrench(text, strong = false) {
  const t = words(text)
  if (!new RegExp(`[${LETTER}]{2}`).test(t)) return false
  if (CODE_LIKE.test(t)) return false
  // CSS, a rel, a filter expression, markup with styles: values, not prose.
  if (
    /\d+px\b|var\(--|\bnoopener\b|style=|^\s*(select|with|insert|update|delete|from)\s/i.test(text)
  )
    return false
  // Code shown as an example, a colour, a filter expression, an identifier built in place.
  if (
    /\b(const|let|function|return|await)\s|color-mix\(|^claude |\{\w+\}\s(eq|ne|gt|gte|lt|lte|contains|in|is_null)\s|^\w*\{\w+\}\{\w+\}\w*$|^Bearer |\/ span |^echo |^\{\w+\} (and|or) \{\w+\}$/.test(
      text,
    )
  )
    return false
  if (/\b[a-z]+_[a-z_]+\b/.test(t) && !ACCENT.test(t)) return false
  const spaced = new RegExp(`[${LETTER}]{2,}[\\s  ]+[${LETTER}«(\\d]`).test(t)
  if (spaced && TAILWIND.test(t) && !ACCENT.test(t) && !STOPWORD.test(t)) return false
  if (/^[a-z0-9_.:\-/]+$/.test(t)) return false // an identifier, a key, a path
  if (ACCENT.test(t) || STOPWORD.test(t)) return true
  if (spaced && /[a-zà-ÿ]{3,}/.test(t)) return true
  if (/…$/.test(t)) return true
  if (
    strong &&
    new RegExp(`^[A-ZÀ-Ý][${LETTER}’'-]+([\\s  ][${LETTER}’'-]+){0,3}[.:!?…]?$`).test(t)
  )
    return true
  return false
}

const TEXT_ATTRS = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'title',
  'placeholder',
  'alt',
  'label',
  'description',
  'hint',
  'summary',
  'heading',
  'subtitle',
  'message',
  'emptyText',
  'empty',
  'text',
  'caption',
  'tooltip',
  'confirm',
  'confirmLabel',
  'cancelLabel',
  'submitLabel',
  'actionLabel',
  'searchPlaceholder',
  'noun',
  'unit',
  'help',
  'legend',
  'prompt',
  'question',
  'lead',
  'name',
])
const SKIP_ATTRS = new Set([
  'className',
  'class',
  'id',
  'key',
  'type',
  'value',
  'defaultValue',
  'href',
  'src',
  'role',
  'htmlFor',
  'variant',
  'size',
  'side',
  'align',
  'mode',
  'kind',
  'format',
  'icon',
  'as',
  'method',
  'action',
  'target',
  'rel',
  'autoComplete',
  'inputMode',
  'pattern',
  'accept',
  'lang',
  'dir',
  'sizes',
  'srcSet',
  'style',
  'd',
  'viewBox',
  'fill',
  'stroke',
  'xmlns',
  'width',
  'height',
  'min',
  'max',
  'step',
  'form',
  'orientation',
  'panel',
  'slot',
  'data-slot',
  'tone',
  'color',
  'field',
  'table',
  'base',
  'column',
  'layout',
  'position',
  'sideOffset',
  'download',
  'encType',
  'enterKeyHint',
])
const UI_KEYS = new Set([
  'label',
  'title',
  'description',
  'hint',
  'placeholder',
  'message',
  'text',
  'error',
  'empty',
  'help',
  'tooltip',
  'heading',
  'subtitle',
  'caption',
  'summary',
  'detail',
  'details',
  'confirm',
  'cancel',
  'action',
  'prompt',
  'question',
  'lead',
  'short',
  'long',
  'plural',
  'singular',
  'noun',
  'unit',
  'reason',
  'explanation',
  'note',
  'notice',
  'success',
  'failure',
  'verb',
  'what',
  'why',
  'how',
  'name',
  'displayName',
  'emptyText',
  'searchPlaceholder',
  'legend',
  'body',
  'intro',
  'tip',
  'warning',
  'category',
  'group',
  'section',
  'tab',
])
const DATA_KEYS = new Set([
  'kind',
  'type',
  'id',
  'key',
  'value',
  'op',
  'code',
  'mode',
  'variant',
  'icon',
  'format',
  'align',
  'side',
  'role',
  'method',
  'field',
  'table',
  'base',
  'column',
  'color',
  'tone',
  'lang',
  'locale',
  'event',
  'trigger',
  'href',
  'url',
  'src',
  'path',
  'className',
  'class',
  'style',
  'width',
  'height',
  'sort',
  'order',
  'direction',
  'slug',
  'ref',
  'token',
  'provider',
  'fn',
  'agg',
  'aggregate',
  'unitKey',
  'display',
  'separator',
  'placeholderKey',
  'accept',
  'mime',
  'extension',
  'pattern',
  'regex',
  'sql',
  'expression',
  'formula',
  'shortcut',
  'keys',
  'hotkey',
  'combo',
  'tag',
])
const SKIP_CALLS = new Set([
  'cn',
  'clsx',
  'cva',
  'twMerge',
  'require',
  'setAttribute',
  'getAttribute',
  'removeAttribute',
  'querySelector',
  'querySelectorAll',
  'closest',
  'matches',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'getItem',
  'setItem',
  'removeItem',
  'fetch',
  'RegExp',
  'parse',
  'stringify',
  'createElement',
  'createElementNS',
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'startsWith',
  'endsWith',
  'includes',
  'indexOf',
  'lastIndexOf',
  'split',
  'replace',
  'replaceAll',
  'match',
  'matchAll',
  'test',
  'has',
  'get',
  'delete',
  'postMessage',
  'encodeURIComponent',
  'decodeURIComponent',
  'URL',
  'URLSearchParams',
  'append',
  'call',
  'data',
  'path',
  'v1',
  'raw',
  'log',
  'warn',
  'info',
  'debug',
  'error',
  'trace',
  'assert',
  'Error',
  'TypeError',
  'RangeError',
  'String',
  'Number',
  'Symbol',
  'mark',
  'measure',
  'DateTimeFormat',
  'NumberFormat',
  'PluralRules',
  'Collator',
  'RelativeTimeFormat',
  'ListFormat',
  'DisplayNames',
  'localeCompare',
  'padStart',
  'padEnd',
  'repeat',
  'join',
  'concat',
  'at',
  'charAt',
  'slice',
  'substring',
  'toUpperCase',
  'toLowerCase',
  'normalize',
  'dynamic',
  'useLocalStorage',
  'storageKey',
  'keyOf',
  'cellKey',
  'send',
  'emit',
  'on',
  'off',
  'once',
  '$t',
  '$tp',
  'isFrench',
  'format',
  'formatDate',
  'parseISO',
])
const CODE_TAGS = new Set(['code', 'pre', 'kbd', 'samp', 'var'])
/** What the audit must leave alone: key names, currency codes, SQL words, demo data. */
const AUDIT_KEEP = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'JPY',
  'NULL',
  'TRUE',
  'FALSE',
  'UTC',
  'ApiError',
  'ElevationCancelled',
  'LM',
  'TR',
  'Lyon',
  'Nantes',
  'Bordeaux',
  'Vienne',
  'Grenoble',
  'Actif',
  'Prospect',
  'Ancien',
])

// ── Reporting ────────────────────────────────────────────────────────────────────────

const report = { files: 0, runs: 0, attrs: 0, literals: 0, templates: 0, todo: [], wrapped: [] }

function quote(text) {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

// ── JSX text, as React reads it ──────────────────────────────────────────────────────

function decodeEntities(text) {
  const named = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    hellip: '…',
    laquo: '«',
    raquo: '»',
    rsquo: '’',
    mdash: '—',
    ndash: '–',
    middot: '·',
    thinsp: ' ',
    nnbsp: ' ',
  }
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (whole, n) => named[n.toLowerCase()] ?? whole)
}

/** Babel's `cleanJSXElementLiteralChild`: what a JSX text renders. */
function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  let last = 0
  lines.forEach((l, i) => {
    if (/[^ \t]/.test(l)) last = i
  })
  let out = ''
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, ' ')
    if (i !== 0) t = t.replace(/^[ ]+/, '')
    if (i !== lines.length - 1) t = t.replace(/[ ]+$/, '')
    if (t) {
      if (i !== last) t += ' '
      out += t
    }
  })
  return decodeEntities(out)
}

// ── Placeholders ─────────────────────────────────────────────────────────────────────

const METHODS = new Set([
  'toLocaleString',
  'toString',
  'toFixed',
  'trim',
  'toLowerCase',
  'toUpperCase',
  'join',
  'slice',
])

function nameFor(expr) {
  let e = expr
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e))
    e = e.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) {
    if (e.name.text === 'length')
      return `${nameFor(e.expression)}Count`.replace(/^valueCount$/, 'count')
    return e.name.text
  }
  if (ts.isCallExpression(e)) {
    const callee = e.expression
    if (ts.isPropertyAccessExpression(callee) && METHODS.has(callee.name.text))
      return nameFor(callee.expression)
    if (e.arguments.length > 0) {
      const first = nameFor(e.arguments[0])
      if (first !== 'value') return first
    }
    if (ts.isIdentifier(callee)) return callee.text
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  }
  if (ts.isElementAccessExpression(e)) return nameFor(e.expression)
  return 'value'
}

function uniqueName(names, base) {
  // `LOCALE_NAMES` reads `localeNames`: a placeholder is a word, not a constant.
  const camel = /^[A-Z0-9_]+$/.test(base)
    ? base.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
    : base
  const clean = /^[A-Za-z_]\w*$/.test(camel) ? camel : 'value'
  let name = clean
  let i = 2
  while (names.has(name)) name = `${clean}${i++}`
  names.add(name)
  return name
}

/** `{n > 1 ? 's' : ''}`, `n === 1 ? 'ligne' : 'lignes'`: a plural built by hand. */
function isPluralPiece(expr) {
  let e = expr
  while (ts.isParenthesizedExpression(e)) e = e.expression
  if (!ts.isConditionalExpression(e)) return false
  const a = e.whenTrue
  const b = e.whenFalse
  if (!ts.isStringLiteralLike(a) || !ts.isStringLiteralLike(b)) return false
  const [x, y] = [a.text, b.text]
  if (x === '' || y === '') return (x + y).length <= 3
  const cond = e.condition.getText()
  if (!/[<>=]=?=?\s*[01]\b|\b[01]\s*[<>=]/.test(cond)) return false
  return x.startsWith(y) || y.startsWith(x) || x.slice(0, -2) === y.slice(0, -2)
}

function containsJsx(node) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

function containsPlural(node) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (ts.isConditionalExpression(n) && isPluralPiece(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

// ── The rewrite ──────────────────────────────────────────────────────────────────────

function processFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, kind)
  const rel = path.relative(root, file).replace(/\\/g, '/')
  let changed = false
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const todo = (node, why) =>
    report.todo.push(
      `${rel}:${line(node)}  ${why}  ${node.getText(sf).replace(/\s+/g, ' ').slice(0, 140)}`,
    )

  const call = (message, values) => {
    changed = true
    if (values.length === 0) return `$t(${quote(message)})`
    const props = values
      .map(([name, code]) => (code === name ? name : `${name}: ${code}`))
      .join(', ')
    return `$t(${quote(message)}, { ${props} })`
  }

  function emit(node) {
    const custom = rewrite(node)
    if (custom !== undefined) return custom
    return splice(node)
  }

  function splice(node) {
    const children = node.getChildren(sf).filter((c) => !ts.isJSDoc(c))
    let cursor = node === sf ? 0 : node.getStart(sf)
    let out = ''
    for (const c of children) {
      const start = c.getStart(sf)
      if (c.end <= start && c.kind !== ts.SyntaxKind.EndOfFileToken) continue
      out += text.slice(cursor, start)
      out += emit(c)
      cursor = c.end
    }
    return out + text.slice(cursor, node.end)
  }

  /** The context a literal sits in: whether it may be text a person reads. */
  function literalContext(node) {
    let p = node.parent
    while (
      p &&
      (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression?.(p))
    )
      p = p.parent
    if (!p) return 'skip'
    if (
      ts.isImportDeclaration(p) ||
      ts.isExportDeclaration(p) ||
      ts.isExternalModuleReference(p) ||
      ts.isImportTypeNode?.(p)
    )
      return 'skip'
    if (ts.isLiteralTypeNode(p) || ts.isTypeNode(p)) return 'skip'
    if (ts.isExpressionStatement(p)) return ts.isStringLiteral(node) ? 'skip' : 'normal' // 'use client'
    if (ts.isTaggedTemplateExpression(p)) return 'skip'
    if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return 'skip'
    if (ts.isCaseClause(p) && p.expression === node) return 'skip'
    if (ts.isPropertyAssignment(p) && p.name === node) return 'skip'
    if (ts.isComputedPropertyName(p)) return 'skip'
    if (ts.isJsxAttribute(p)) return 'skip' // handled with the attribute
    if (ts.isBinaryExpression(p)) {
      const op = p.operatorToken.kind
      const K = ts.SyntaxKind
      if (
        [
          K.EqualsEqualsEqualsToken,
          K.ExclamationEqualsEqualsToken,
          K.EqualsEqualsToken,
          K.ExclamationEqualsToken,
          K.InKeyword,
          K.InstanceOfKeyword,
          K.LessThanToken,
          K.GreaterThanToken,
        ].includes(op)
      )
        return 'skip'
    }
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
      const callee = p.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ''
      const owner = ts.isPropertyAccessExpression(callee) ? callee.expression.getText(sf) : ''
      if (
        SKIP_CALLS.has(name) ||
        /^(console|JSON|localStorage|sessionStorage|document|window\.location|Intl|Object|Reflect|api|navigator|history)\b/.test(
          owner,
        )
      )
        return 'skip'
      if (/^use(State|Ref|Memo|Callback|Reducer)$/.test(name)) return 'strong'
      if (
        /^(set[A-Z]\w*|toast|alert|confirm|notify|fail|refuse|report|say|announce|explain|onError|onDone)$/.test(
          name,
        )
      )
        return 'strong'
      return 'normal'
    }
    if (ts.isPropertyAssignment(p)) {
      const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : ''
      if (DATA_KEYS.has(key)) return 'skip'
      if (UI_KEYS.has(key)) return 'strong'
      return 'normal'
    }
    if (ts.isShorthandPropertyAssignment(p)) return 'skip'
    if (ts.isEnumMember(p)) return 'skip'
    if (ts.isVariableDeclaration(p)) {
      const name = p.name.getText(sf)
      if (
        /(class|Class|CLASSES|STYLE|Style|KEY|Key|key|URL|Url|PATH|Path|ID|Id|SQL|Sql|PATTERN|REGEX|FORMAT)$/.test(
          name,
        )
      )
        return 'skip'
      if (
        /(LABEL|Label|label|TITLE|Title|title|TEXT|Text|text|MESSAGE|Message|message|HINT|Hint|hint|PLACEHOLDER|Placeholder|placeholder)S?$/.test(
          name,
        )
      )
        return 'strong'
      return 'normal'
    }
    if (ts.isJsxExpression(p)) {
      // `title={'…'}` or a child `{'…'}` outside a run.
      const owner = p.parent
      if (ts.isJsxAttribute(owner)) return attrContext(owner)
      return 'strong'
    }
    if (
      ts.isConditionalExpression(p) ||
      ts.isBinaryExpression(p) ||
      ts.isArrayLiteralExpression(p) ||
      ts.isReturnStatement(p) ||
      ts.isArrowFunction(p) ||
      ts.isTemplateSpan(p) ||
      ts.isSpreadElement(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isDefaultClause?.(p) ||
      ts.isThrowStatement(p)
    ) {
      // Take the context of what holds the expression.
      if (ts.isThrowStatement(p)) return 'skip'
      if (ts.isParameter(p)) return 'normal'
      const outer = literalContext(p)
      return outer
    }
    return 'normal'
  }

  function attrContext(attr) {
    const name = attr.name.getText(sf)
    if (SKIP_ATTRS.has(name) || name.startsWith('data-') || /^on[A-Z]/.test(name)) return 'skip'
    if (TEXT_ATTRS.has(name)) return 'strong'
    return 'normal'
  }

  function translatable(value, context) {
    if (context === 'skip') return false
    if (audit && context !== 'strong' && (AUDIT_KEEP.has(value) || /^Bearer /.test(value)))
      return false
    return isFrench(value, audit || context === 'strong')
  }

  function rewrite(node) {
    // JSX children: runs of text and simple expressions become one sentence.
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node.openingFragment
      const closing = ts.isJsxElement(node) ? node.closingElement : node.closingFragment
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName.getText(sf) : ''
      return (
        emit(opening) +
        emitChildren(node.children, opening.end, closing.getStart(sf), CODE_TAGS.has(tag)) +
        emit(closing)
      )
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text
      if (!translatable(value, attrContext(node))) return undefined
      report.attrs++
      return `${node.name.getText(sf)}={${call(value, [])}}`
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const context = literalContext(node)
      if (!translatable(node.text, context)) return undefined
      report.literals++
      report.wrapped.push(`${rel}:${line(node)}  [${context}]  ${node.text}`)
      return call(node.text, [])
    }
    if (ts.isTemplateExpression(node)) {
      const context = literalContext(node)
      // Judged as the sentence it would become, each value a placeholder.
      const statics =
        node.head.text + node.templateSpans.map((s) => `{x}${s.literal.text}`).join('')
      if (!translatable(statics, context)) return undefined
      if (node.templateSpans.some((s) => containsPlural(s.expression))) {
        todo(node, 'PLURAL(template)')
        return undefined
      }
      const names = new Set()
      const values = []
      let message = node.head.text
      for (const span of node.templateSpans) {
        const name = uniqueName(names, nameFor(span.expression))
        values.push([name, emit(span.expression)])
        message += `{${name}}${span.literal.text}`
      }
      report.templates++
      report.wrapped.push(`${rel}:${line(node)}  [${context}]  ${message}`)
      return call(message, values)
    }
    return undefined
  }

  function emitChildren(children, from, to, inCode) {
    let out = ''
    let cursor = from
    const list = [...children]
    let i = 0
    while (i < list.length) {
      const child = list[i]
      const inRun = (c) =>
        ts.isJsxText(c) ||
        (ts.isJsxExpression(c) && c.expression !== undefined && !containsJsx(c.expression))
      if (!inRun(child)) {
        out += text.slice(cursor, child.getStart(sf)) + emit(child)
        cursor = child.end
        i++
        continue
      }
      let j = i
      while (j < list.length && inRun(list[j])) j++
      const run = list.slice(i, j)
      const replaced = emitRun(run, inCode)
      if (replaced === undefined) {
        for (const c of run) {
          out += text.slice(cursor, c.getStart(sf)) + emit(c)
          cursor = c.end
        }
      } else {
        out += text.slice(cursor, run[0].getStart(sf)) + replaced
        cursor = run[run.length - 1].end
      }
      i = j
    }
    return out + text.slice(cursor, to)
  }

  function emitRun(run, inCode) {
    const hasText = run.some(
      (c) => ts.isJsxText(c) && new RegExp(`[${LETTER}]{2}`).test(jsxTextValue(c.getFullText(sf))),
    )
    if (!hasText) return undefined
    if (inCode) {
      todo(run[0], 'CODE(text inside a code tag, left as is)')
      return undefined
    }
    if (run.some((c) => ts.isJsxExpression(c) && containsPlural(c.expression))) {
      todo(run[0], 'PLURAL(jsx)')
      return undefined
    }
    const names = new Set()
    const values = []
    let message = ''
    for (const c of run) {
      if (ts.isJsxText(c)) message += jsxTextValue(c.getFullText(sf))
      else if (ts.isStringLiteralLike(c.expression)) message += c.expression.text
      else {
        const name = uniqueName(names, nameFor(c.expression))
        values.push([name, emit(c.expression)])
        message += `{${name}}`
      }
    }
    const lead = /^\s/.test(message)
    const trail = /\s$/.test(message)
    const body = message.trim()
    if (!new RegExp(`[${LETTER}]{2}`).test(words(body))) return undefined
    if (CODE_LIKE.test(words(body)) && !ACCENT.test(body)) {
      todo(run[0], 'CODE(looks like code)')
      return undefined
    }
    report.runs++
    return `${lead ? "{' '}" : ''}{${call(body, values)}}${trail ? "{' '}" : ''}`
  }

  const out = emit(sf)
  if (!changed) return
  report.files++
  let result = out
  // The import, merged with an existing one from '@/lib/i18n'.
  const existing = /^import \{([^}]*)\} from '@\/lib\/i18n'\n/m.exec(result)
  if (existing) {
    if (!/\$t\b/.test(existing[1])) {
      const names = existing[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      names.unshift('$t')
      result = result.replace(existing[0], `import { ${names.join(', ')} } from '@/lib/i18n'\n`)
    }
  } else {
    const imports = [...result.matchAll(/^import [\s\S]*?from '[^']+'\n/gm)]
    const at =
      imports.length > 0
        ? imports[imports.length - 1].index + imports[imports.length - 1][0].length
        : /^'use client'\n/.test(result)
          ? result.indexOf('\n') + 1
          : 0
    result = `${result.slice(0, at)}import { $t } from '@/lib/i18n'\n${result.slice(at)}`
  }
  if (write) fs.writeFileSync(file, result, 'utf8')
  else if (only.length > 0) process.stdout.write(`\n===== ${rel}\n${result}`)
}

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, found)
    else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP_FILES.some((r) => r.test(p))) found.push(p)
  }
  return found
}

const files = only.length > 0 ? only.map((f) => path.resolve(f)) : walk(path.join(web, 'src'))
for (const f of files) processFile(f)
const reportPath = path.join(root, 'tooling/i18n/codemod-report.txt')
fs.writeFileSync(
  reportPath,
  `files ${report.files}, runs ${report.runs}, attributes ${report.attrs}, literals ${report.literals}, templates ${report.templates}\n\n${report.todo.join('\n')}\n`,
  'utf8',
)
fs.writeFileSync(
  path.join(root, 'tooling/i18n/codemod-wrapped.txt'),
  `${report.wrapped.join('\n')}\n`,
  'utf8',
)
console.log(
  `files ${report.files}, runs ${report.runs}, attributes ${report.attrs}, literals ${report.literals}, templates ${report.templates}, todo ${report.todo.length}`,
)
