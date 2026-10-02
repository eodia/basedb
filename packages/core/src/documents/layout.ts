import { parseDocument } from 'htmlparser2'
import PDFDocument from 'pdfkit'
import {
  type FontFace,
  type FontSet,
  type FontStyles,
  covers,
  winAnsi,
  winAnsiCovers,
} from './fonts.js'
import {
  type Align,
  DEFAULT_THEME,
  type DocumentTheme,
  type Face,
  type FieldsBlock,
  type Orientation,
  type PageSize,
  type TextBlock,
  type TitleBlock,
} from './spec.js'

/**
 * Setting a document on pages — chapter 21 §4. What comes in is already read, formatted
 * and allowed: texts, labels, values and pictures, with no catalog and no rights left to
 * decide. What goes out is the PDF's bytes.
 *
 * pdfkit draws; the lines are broken here. Every text is cut into lines before anything
 * is drawn — its words measured in the face each one is set in —, so that the height of
 * anything is known before it is placed: a tinted box is drawn under its text, columns
 * side by side, a title kept with what follows it, a table's head repeated on each page.
 *
 * Rich text is the canonical form of the sanitizer (`rich-text.ts`): headings, paragraphs,
 * bold, italic, underline, strikethrough, lists, quotes, code, links, rules. A run of text
 * is set in the Latin face when it has all its characters, in the CJK face otherwise.
 */

export type LaidBlock =
  | {
      readonly kind: 'html'
      readonly html: string
      readonly align?: Align | 'justify'
      readonly size?: TextBlock['size']
      readonly style?: TextBlock['style']
    }
  | {
      readonly kind: 'fields'
      readonly rows: ReadonlyArray<{ readonly label: string; readonly value: string }>
      readonly columns?: 1 | 2 | 3
      readonly labels?: FieldsBlock['labels']
    }
  | {
      readonly kind: 'table'
      readonly title: string
      readonly columns: ReadonlyArray<{
        readonly label: string
        readonly numeric: boolean
        readonly align?: Align
        /** In percent of the table's width; none: from what the column holds. */
        readonly width?: number | null
      }>
      readonly rows: ReadonlyArray<ReadonlyArray<string>>
      /** One cell per column, `null` where nothing is summed; `null`: no total row. */
      readonly totals: ReadonlyArray<string | null> | null
      /** Rows left out past the bound, said under the table. */
      readonly more: string | null
      readonly style?: 'light' | 'accent' | 'lines'
      readonly zebra?: boolean
    }
  | { readonly kind: 'break' }
  | {
      readonly kind: 'image'
      /** PNG or JPEG bytes. */
      readonly data: Buffer
      /** In percent of the width it is set in. */
      readonly width: number
      readonly align: Align
    }
  | {
      readonly kind: 'title'
      readonly text: string
      readonly subtitle: string
      readonly style: TitleBlock['style']
      readonly align: Align
      readonly size: TitleBlock['size']
    }
  | {
      readonly kind: 'divider'
      readonly color: 'accent' | 'light' | 'text'
      /** In points. */
      readonly thickness: number
      /** In percent of the width it is set in, centred; all of it when absent. */
      readonly width?: number
    }
  /** Space, in millimetres. */
  | { readonly kind: 'spacer'; readonly height: number }
  | {
      readonly kind: 'columns'
      readonly widths: readonly number[]
      readonly columns: ReadonlyArray<readonly LaidBlock[]>
    }

export interface LaidHeader {
  readonly show: 'first' | 'every'
  readonly logo: Buffer | null
  /** In millimetres. */
  readonly logoWidth: number
  readonly left: string
  readonly right: string
  readonly rule: boolean
}

export interface LaidFooter {
  readonly html: string
  readonly align: 'left' | 'center'
  readonly pageNumbers: boolean
  readonly rule: boolean
}

export interface LaidDocument {
  readonly title: string
  readonly locale: string
  readonly page: {
    readonly size: PageSize
    readonly orientation: Orientation
    /** `center`: a document that fits on one page is set in the middle of its height. */
    readonly valign?: 'top' | 'center'
  }
  /** None: the look templates had before themes. */
  readonly theme?: DocumentTheme
  readonly header?: LaidHeader | null
  readonly footer: LaidFooter
  /** `1 / 3`, in the document's language. */
  readonly pageLabel: (page: number, count: number) => string
  readonly blocks: readonly LaidBlock[]
}

/** Points in a millimetre. */
const MM = 72 / 25.4
const RULE = '#e5e7eb'
const HEAD_FILL = '#f3f4f6'
const ZEBRA = '#f9fafb'
const INK = '#111827'
const WHITE = '#ffffff'

// ── Colours ──────────────────────────────────────────────────────────────────

const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hexOf = (c: readonly number[]) =>
  `#${c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

/** `a` moved towards `b` by `t`, from 0 (all `a`) to 1 (all `b`). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return hexOf(x.map((v, i) => v + ((y[i] as number) - v) * t))
}

/** Relative luminance, as WCAG counts it. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** White or ink on a colour: whichever reads better. */
export function onColor(hex: string): string {
  const l = luminance(hex)
  return 1.05 / (l + 0.05) >= (l + 0.05) / (luminance(INK) + 0.05) ? WHITE : INK
}

interface Palette {
  readonly text: string
  readonly muted: string
  readonly accent: string
  readonly onAccent: string
  readonly onAccentMuted: string
  readonly tint: string
  readonly tintStrong: string
  readonly rule: string
}

function paletteOf(theme: DocumentTheme): Palette {
  const on = onColor(theme.accent)
  return {
    text: theme.text,
    muted: theme.text === DEFAULT_THEME.text ? '#6b7280' : mix(theme.text, WHITE, 0.42),
    accent: theme.accent,
    onAccent: on,
    onAccentMuted: mix(on, theme.accent, 0.3),
    tint: mix(theme.accent, WHITE, 0.93),
    tintStrong: mix(theme.accent, WHITE, 0.86),
    rule: RULE,
  }
}

// ── Faces ────────────────────────────────────────────────────────────────────

/** The PDF's own faces, which need no file: regular, bold, italic, bold italic. */
const STANDARD: Readonly<Record<Face, readonly [string, string, string, string]>> = {
  sans: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
  serif: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
}

const styleIndex = (bold: boolean, italic: boolean) => (bold ? (italic ? 3 : 1) : italic ? 2 : 0)

/** The faces, registered once on the document, and the one each piece of text is set in. */
class Faces {
  constructor(
    doc: PDFKit.PDFDocument,
    private readonly set: FontSet | null,
  ) {
    if (set === null) return
    const add = (name: string, face: FontFace) =>
      face.family === undefined
        ? doc.registerFont(name, face.path)
        : doc.registerFont(name, face.path, face.family)
    const styles = (prefix: string, s: FontStyles) => {
      add(`${prefix}r`, s.regular)
      add(`${prefix}b`, s.bold)
      add(`${prefix}i`, s.italic)
      add(`${prefix}bi`, s.boldItalic)
    }
    styles('', set)
    if (set.serif) styles('s', set.serif)
    set.fallbacks.forEach((f, i) => {
      add(`f${i}`, f.regular)
      add(`f${i}b`, f.bold)
    })
  }

  /** The face a family's text is first set in, and its file when it has one. */
  private primary(family: Face, bold: boolean, italic: boolean) {
    const k = styleIndex(bold, italic)
    const styles = family === 'serif' ? (this.set?.serif ?? null) : this.set
    if (styles === null || styles === undefined) {
      return { name: STANDARD[family][k] as string, face: null }
    }
    const faces = [styles.regular, styles.bold, styles.italic, styles.boldItalic]
    const prefix = family === 'serif' ? 's' : ''
    return { name: `${prefix}${['r', 'b', 'i', 'bi'][k]}`, face: faces[k] as FontFace }
  }

  /** The fallback that has a character — the first, when none has it. */
  private fallbackFor(text: string, bold: boolean): string {
    const all = this.set?.fallbacks ?? []
    const i = Math.max(
      0,
      all.findIndex((f) => covers(f.regular, text)),
    )
    return bold ? `f${i}b` : `f${i}`
  }

  /** A text cut where its characters change face — a Latin name inside a Japanese line. */
  split(
    text: string,
    family: Face,
    bold: boolean,
    italic: boolean,
  ): Array<{ text: string; font: string }> {
    const { name, face } = this.primary(family, bold, italic)
    if (face === null) {
      if (winAnsiCovers(text)) return [{ text, font: name }]
      // The PDF's Times cannot write it whole: the Latin face does, rather than a word
      // set in two faces.
      if (family === 'serif' && this.set !== null) return this.split(text, 'sans', bold, italic)
      return [{ text: winAnsi(text), font: name }]
    }
    if ((this.set?.fallbacks.length ?? 0) === 0 || covers(face, text)) return [{ text, font: name }]
    const out: Array<{ text: string; font: string }> = []
    let current = ''
    let currentFont = ''
    for (const ch of text) {
      const font = covers(face, ch) ? name : this.fallbackFor(ch, bold)
      if (font !== currentFont && current !== '') {
        out.push({ text: current, font: currentFont })
        current = ''
      }
      currentFont = font
      current += ch
    }
    if (current !== '') out.push({ text: current, font: currentFont })
    return out
  }
}

// ── Lines ────────────────────────────────────────────────────────────────────

interface Mark {
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly link: string | null
}

interface Run extends Mark {
  readonly text: string
}

const PLAIN: Mark = { bold: false, italic: false, underline: false, strike: false, link: null }
const NBSP = String.fromCharCode(0xa0)

/** How a paragraph is set. */
interface TextStyle {
  readonly size: number
  readonly family: Face
  readonly color: string
  readonly bold?: boolean
  readonly align?: Align | 'justify'
  /** Space between letters, in points. */
  readonly tracking?: number
  /** Space between lines, in points; a quarter of the size by default. */
  readonly lineGap?: number
  readonly linkColor?: string
}

interface Token {
  readonly text: string
  readonly kind: 'word' | 'space' | 'newline'
  readonly font: string
  readonly size: number
  readonly color: string
  readonly underline: boolean
  readonly strike: boolean
  readonly link: string | null
  readonly tracking: number
  readonly width: number
}

/** A line set: its size, and how to draw it with its top at `y`. */
export interface Line {
  readonly width: number
  readonly height: number
  draw(x: number, y: number): void
}

/** CJK characters, each of which a line may end after. */
const CJK =
  '\\u2e80-\\u303f\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af\\uf900-\\ufaff\\uff00-\\uffef'
/**
 * Words (cut after a hyphen, a sign kept with its number), runs of spaces, line breaks,
 * and CJK characters.
 */
const TOKEN = new RegExp(`\\n|[^\\S\\n]+|[${CJK}]|-*[^\\s${CJK}-]+-?|-+`, 'gu')

interface Metrics {
  readonly height: number
  readonly ascent: number
}

/** Sets texts into lines, with the document's faces and their metrics. */
class Typesetter {
  private readonly widths = new Map<string, number>()
  private readonly metrics = new Map<string, Metrics>()

  constructor(
    private readonly doc: PDFKit.PDFDocument,
    readonly faces: Faces,
  ) {}

  private measure(text: string, font: string, size: number, tracking: number): number {
    const key = `${font}\u0000${size}\u0000${tracking}\u0000${text}`
    let w = this.widths.get(key)
    if (w === undefined) {
      this.doc.font(font).fontSize(size)
      w = this.doc.widthOfString(text, { characterSpacing: tracking })
      this.widths.set(key, w)
    }
    return w
  }

  private metricsOf(font: string, size: number): Metrics {
    const key = `${font}\u0000${size}`
    let m = this.metrics.get(key)
    if (m === undefined) {
      this.doc.font(font).fontSize(size)
      const face = (this.doc as unknown as { _font: { ascender: number } })._font
      m = { height: this.doc.currentLineHeight(true), ascent: (face.ascender / 1000) * size }
      this.metrics.set(key, m)
    }
    return m
  }

  /** The width a text takes on one line, unbroken. */
  width(text: string, style: TextStyle, bold = style.bold ?? false): number {
    return this.faces
      .split(text, style.family, bold, false)
      .reduce((w, p) => w + this.measure(p.text, p.font, style.size, style.tracking ?? 0), 0)
  }

  /** A text of one style, cut into lines `width` wide. */
  plain(text: string, width: number, style: TextStyle): Line[] {
    return this.lines([{ ...PLAIN, text }], width, style)
  }

  /** Runs cut into lines `width` wide; none for a text with nothing to show. */
  lines(runs: readonly Run[], width: number, style: TextStyle): Line[] {
    const size = style.size
    const tracking = style.tracking ?? 0
    const tokens: Token[] = []
    for (const run of runs) {
      const bold = run.bold || (style.bold ?? false)
      for (const piece of this.faces.split(run.text, style.family, bold, run.italic)) {
        for (const m of piece.text.matchAll(TOKEN)) {
          const text = m[0]
          const kind = text === '\n' ? 'newline' : /^\s+$/.test(text) ? 'space' : 'word'
          const shown = kind === 'space' ? ' ' : text
          tokens.push({
            text: shown,
            kind,
            font: piece.font,
            size,
            color: run.link !== null ? (style.linkColor ?? style.color) : style.color,
            underline: run.underline || run.link !== null,
            strike: run.strike,
            link: run.link,
            tracking,
            width: kind === 'newline' ? 0 : this.measure(shown, piece.font, size, tracking),
          })
        }
      }
    }
    if (!tokens.some((t) => t.kind === 'word')) return []

    const rows: Array<{ tokens: Token[]; last: boolean }> = []
    let line: Token[] = []
    let used = 0
    const close = (last: boolean) => {
      while (line.length > 0 && line[line.length - 1]?.kind === 'space') line.pop()
      rows.push({ tokens: line, last })
      line = []
      used = 0
    }
    for (const t of tokens) {
      if (t.kind === 'newline') {
        close(true)
        continue
      }
      if (t.kind === 'space') {
        if (line.length === 0) continue
        line.push(t)
        used += t.width
        continue
      }
      if (used + t.width > width && line.some((x) => x.kind === 'word')) close(false)
      if (t.width <= width) {
        line.push(t)
        used += t.width
        continue
      }
      // A word wider than the line: cut where it no longer fits.
      let chunk = ''
      for (const ch of t.text) {
        const w = this.measure(chunk + ch, t.font, t.size, t.tracking)
        if (used + w > width && chunk !== '') {
          line.push({ ...t, text: chunk, width: this.measure(chunk, t.font, t.size, t.tracking) })
          close(false)
          chunk = ch
        } else {
          chunk += ch
        }
      }
      if (chunk !== '') {
        const w = this.measure(chunk, t.font, t.size, t.tracking)
        line.push({ ...t, text: chunk, width: w })
        used += w
      }
    }
    if (line.length > 0) close(true)

    const base = this.metricsOf(
      this.faces.split('x', style.family, style.bold ?? false, false)[0]?.font ?? 'Helvetica',
      size,
    )
    const gap = style.lineGap ?? size * 0.25
    const align = style.align ?? 'left'
    return rows.map(({ tokens: parts, last }) => {
      const metrics = parts.map((p) => this.metricsOf(p.font, p.size))
      const ascent = Math.max(base.ascent, ...metrics.map((m) => m.ascent))
      const height = Math.max(base.height, ...metrics.map((m) => m.height)) + gap
      const lineWidth = parts.reduce((w, p) => w + p.width, 0)
      const spaces = parts.filter((p) => p.kind === 'space').length
      const justify = align === 'justify' && !last && spaces > 0
      return {
        width: lineWidth,
        height,
        draw: (x: number, y: number) => {
          const free = Math.max(0, width - lineWidth)
          let cx = x + (align === 'right' ? free : align === 'center' ? free / 2 : 0)
          const extra = justify ? free / spaces : 0
          // Neighbours of one style are drawn as one fragment; justified, word by word.
          const fragments: Array<Token & { text: string; width: number }> = []
          for (const p of parts) {
            const prev = fragments[fragments.length - 1]
            const same =
              prev !== undefined &&
              !justify &&
              prev.font === p.font &&
              prev.color === p.color &&
              prev.underline === p.underline &&
              prev.strike === p.strike &&
              prev.link === p.link
            if (same) {
              fragments[fragments.length - 1] = {
                ...prev,
                text: prev.text + p.text,
                width: prev.width + p.width,
              }
            } else fragments.push({ ...p })
          }
          for (const f of fragments) {
            if (f.kind === 'space' && justify) {
              cx += f.width + extra
              continue
            }
            const m = this.metricsOf(f.font, f.size)
            this.doc.font(f.font).fontSize(f.size).fillColor(f.color)
            this.doc.text(f.text, cx, y + ascent - m.ascent, {
              lineBreak: false,
              underline: f.underline,
              strike: f.strike,
              ...(f.tracking === 0 ? {} : { characterSpacing: f.tracking }),
              ...(f.link !== null ? { link: f.link } : {}),
            })
            cx += f.width
          }
        },
      }
    })
  }
}

// ── Placing ──────────────────────────────────────────────────────────────────

/** What is placed on a page, top to bottom: a line, a row, a picture, some space. */
interface Item {
  readonly height: number
  /**
   * Draws it, its top at `y`, the frame it is set in starting at `x`; `at` says where it
   * lands when it is placed on a page, and is absent inside a box or a column.
   */
  readonly draw?: (x: number, y: number, at?: Landing) => void
  /** Space: left out at the top of a page, and at the two ends of a box or a column. */
  readonly gap?: boolean
  /**
   * Space asked for — a spacer block: kept wherever it stands, the top of a column
   * included; one that does not fit ends its page rather than starting the next.
   */
  readonly space?: boolean
  /** Kept on the page of what follows: a title, a table's head. */
  readonly keep?: boolean
  /** Drawn again at the top of a page it starts — a table's head. */
  readonly head?: Item
  readonly pageBreak?: boolean
}

/** Where an item lands: on which page, and whether at the top of its body. */
interface Landing {
  readonly page: number
  readonly top: boolean
}

const gap = (height: number, draw?: Item['draw']): Item => ({
  height,
  gap: true,
  ...(draw === undefined ? {} : { draw }),
})

const heightOf = (items: ReadonlyArray<{ readonly height: number }>) =>
  items.reduce((h, i) => h + i.height, 0)

/** Items without the space at their two ends: what a box holds. */
function trimmed(items: readonly Item[]): Item[] {
  let start = 0
  let end = items.length
  while (start < end && items[start]?.gap) start++
  while (end > start && items[end - 1]?.gap) end--
  return items.slice(start, end)
}

/** Draws items one under the other from `y`, on one page: what a box or a column holds. */
function drawStack(items: readonly Item[], x: number, y: number): void {
  let cy = y
  for (const item of items) {
    if (item.pageBreak) continue
    item.draw?.(x, cy)
    cy += item.height
  }
}

/** The body of the pages: where it starts on each, where it ends. */
interface Frame {
  readonly left: number
  readonly width: number
  readonly top: (page: number) => number
  readonly bottom: number
}

class Pager {
  page = 0
  y: number

  constructor(
    private readonly doc: PDFKit.PDFDocument,
    private readonly frame: Frame,
  ) {
    this.y = frame.top(0)
  }

  private atTop(): boolean {
    return this.y <= this.frame.top(this.page) + 0.5
  }

  private newPage(): void {
    this.doc.addPage()
    this.page += 1
    this.y = this.frame.top(this.page)
  }

  /** What a kept item needs on its page: itself, the kept ones after it, and the next. */
  private chain(items: readonly Item[], from: number): number {
    let h = 0
    for (let i = from; i < items.length; i++) {
      const item = items[i] as Item
      if (item.pageBreak) break
      h += item.height
      if (!item.keep && !item.gap) break
    }
    return h
  }

  /**
   * Places items page after page. `center`: what fits on the first page is set in the
   * middle of its height — a certificate, a card.
   */
  place(items: readonly Item[], center = false): void {
    const x = this.frame.left
    const room = this.frame.bottom - this.frame.top(1)
    if (center && !items.some((i) => i.pageBreak)) {
      const used = heightOf(trimmed(items))
      const free = this.frame.bottom - this.frame.top(0) - used
      if (free > 0) this.y += free / 2
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Item
      if (item.pageBreak) {
        this.newPage()
        continue
      }
      if (item.space) {
        if (this.y + item.height > this.frame.bottom) this.newPage()
        else this.y += item.height
        continue
      }
      if (item.gap) {
        if (this.atTop()) continue
        if (this.y + item.height > this.frame.bottom) {
          this.newPage()
          continue
        }
        item.draw?.(x, this.y, { page: this.page, top: false })
        this.y += item.height
        continue
      }
      const kept = item.keep ? this.chain(items, i) : item.height
      const need = kept <= room ? kept : item.height
      if (this.y + need > this.frame.bottom + 0.01 && !this.atTop()) {
        this.newPage()
        if (item.head !== undefined && item.head !== item) {
          item.head.draw?.(x, this.y, { page: this.page, top: true })
          this.y += item.head.height
        }
      }
      item.draw?.(x, this.y, { page: this.page, top: this.atTop() })
      this.y += item.height
    }
  }
}

// ── Rich text ────────────────────────────────────────────────────────────────

interface Node {
  readonly type: string
  readonly name?: string
  readonly data?: string
  readonly attribs?: Record<string, string>
  readonly children?: readonly Node[]
}

const INLINE_MARKS: Readonly<Record<string, Partial<Run>>> = {
  strong: { bold: true },
  b: { bold: true },
  em: { italic: true },
  i: { italic: true },
  u: { underline: true },
  s: { strike: true },
}

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&amp;/g, '&')

/** The runs of an element's inline content; blocks inside it are not followed. */
function runsOf(nodes: readonly Node[], mark: Mark): Run[] {
  const out: Run[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      const text = decode(node.data ?? '').replace(/\s+/g, ' ')
      if (text !== '') out.push({ ...mark, text })
      continue
    }
    if (node.type !== 'tag') continue
    if (node.name === 'br') {
      out.push({ ...mark, text: '\n' })
      continue
    }
    if (node.name === 'ul' || node.name === 'ol') continue
    const href = node.name === 'a' ? (node.attribs?.href ?? null) : mark.link
    out.push(
      ...runsOf(node.children ?? [], { ...mark, ...INLINE_MARKS[node.name ?? ''], link: href }),
    )
  }
  return out
}

/** Trims a paragraph's outer spaces, which HTML carries and a page must not. */
function trimRuns(runs: Run[]): Run[] {
  const out = runs.filter((r) => r.text !== '')
  if (out.length > 0) {
    const first = out[0] as Run
    out[0] = { ...first, text: first.text.replace(/^ +/, '') }
    const last = out[out.length - 1] as Run
    out[out.length - 1] = { ...last, text: last.text.replace(/ +$/, '') }
  }
  return out.filter((r) => r.text !== '')
}

function textOf(nodes: readonly Node[]): string {
  return nodes.map((n) => (n.type === 'text' ? (n.data ?? '') : textOf(n.children ?? []))).join('')
}

/** A paragraph of a rich text, before it is cut into lines. */
interface Para {
  readonly runs: readonly Run[]
  readonly style: TextStyle
  readonly indent: number
  readonly marker: string | null
  readonly before: number
  readonly after: number
  /** A heading: kept with what follows. */
  readonly keep: boolean
  /** An accent rule under a heading. */
  readonly rule: number
  /** A horizontal rule instead of text. */
  readonly hr: boolean
  /** How many quotes it is in: as many bars on its left. */
  readonly quote: number
}

/** The base of a rich text: its size, family, colour and alignment. */
interface TextBase {
  readonly size: number
  readonly color: string
  readonly align: Align | 'justify'
}

/** A label in capitals, as the document's language writes them. */
function upper(text: string, locale: string): string {
  try {
    return text.toLocaleUpperCase(locale)
  } catch {
    return text.toUpperCase()
  }
}

// ── Composing ────────────────────────────────────────────────────────────────

class Composer {
  readonly palette: Palette
  readonly type: Typesetter

  constructor(
    readonly doc: PDFKit.PDFDocument,
    faces: Faces,
    readonly theme: DocumentTheme,
    /** The height of a page's body: what an item never exceeds. */
    readonly room: number,
    readonly locale: string,
    /** Whether a page carries the header. */
    private readonly headerOn: (page: number) => boolean = () => false,
    /** How far a band edge to edge goes: the page's edges, or the frame drawn inside them. */
    private readonly inset = 0,
  ) {
    this.palette = paletteOf(theme)
    this.type = new Typesetter(doc, faces)
  }

  private get size(): number {
    return this.theme.size
  }

  private body(base: TextBase, extra: Partial<TextStyle> = {}): TextStyle {
    return {
      size: base.size,
      family: this.theme.font,
      color: base.color,
      align: base.align,
      linkColor: this.palette.accent,
      ...extra,
    }
  }

  // Rich text

  private paras(
    nodes: readonly Node[],
    base: TextBase,
    indent: number,
    quote: number,
    depth: number,
  ): Para[] {
    const out: Para[] = []
    const s = base.size
    const para = (runs: Run[], extra: Partial<Para> = {}): Para => ({
      runs,
      style: this.body(base),
      indent,
      marker: null,
      before: 0,
      after: s * 0.5,
      keep: false,
      rule: 0,
      hr: false,
      quote,
      ...extra,
    })
    for (const node of nodes) {
      if (node.type === 'text') {
        const runs = trimRuns(runsOf([node], PLAIN))
        if (runs.length > 0) out.push(para(runs))
        continue
      }
      if (node.type !== 'tag') continue
      const children = node.children ?? []
      switch (node.name) {
        case 'h1':
        case 'h2':
        case 'h3': {
          const k = node.name === 'h1' ? 1.8 : node.name === 'h2' ? 1.4 : 1.2
          const size = s * k
          const titles = this.theme.titles
          out.push(
            para(trimRuns(runsOf(children, { ...PLAIN, bold: true })), {
              style: this.body(base, {
                size,
                family: this.theme.title_font,
                bold: true,
                color: titles === 'accent' ? this.palette.accent : base.color,
                align: base.align === 'justify' ? 'left' : base.align,
                lineGap: size * 0.15,
              }),
              before: s * 0.6,
              after: size * 0.4,
              keep: true,
              rule: titles === 'rule' && node.name !== 'h3' ? (node.name === 'h1' ? 1.5 : 1) : 0,
            }),
          )
          break
        }
        case 'p':
          out.push(para(trimRuns(runsOf(children, PLAIN))))
          break
        case 'pre':
          out.push(
            para([{ ...PLAIN, text: decode(textOf(children)) }], {
              style: this.body(base, { size: s * 0.9, color: this.palette.muted, align: 'left' }),
              indent: indent + 8,
            }),
          )
          break
        case 'blockquote':
          out.push(...this.paras(children, base, indent + 12, quote + 1, depth))
          break
        case 'ul':
        case 'ol': {
          let n = 0
          const items = children.filter((c) => c.type === 'tag' && c.name === 'li')
          for (const item of items) {
            n += 1
            const marker = node.name === 'ol' ? `${n}.` : depth % 2 === 0 ? '•' : '◦'
            const inner = item.children ?? []
            const own = inner.filter(
              (c) => !(c.type === 'tag' && (c.name === 'ul' || c.name === 'ol')),
            )
            const lists = inner.filter(
              (c) => c.type === 'tag' && (c.name === 'ul' || c.name === 'ol'),
            )
            // `<li><p>…</p></li>` or bare runs: the item's own text, then its sub-lists.
            const runs = trimRuns(
              own.flatMap((c) =>
                c.type === 'tag' && c.name === 'p'
                  ? [...runsOf(c.children ?? [], PLAIN), { ...PLAIN, text: ' ' }]
                  : runsOf([c], PLAIN),
              ),
            )
            out.push(
              para(runs.length > 0 ? runs : [{ ...PLAIN, text: NBSP }], {
                style: this.body(base, { align: 'left' }),
                indent: indent + 16,
                marker,
                after: s * 0.2,
              }),
            )
            if (lists.length > 0)
              out.push(...this.paras(lists, base, indent + 16, quote, depth + 1))
          }
          const last = out[out.length - 1]
          if (last !== undefined && items.length > 0)
            out[out.length - 1] = { ...last, after: Math.max(last.after, s * 0.45) }
          break
        }
        case 'hr':
          out.push(para([], { hr: true, before: s * 0.35, after: s * 0.7 }))
          break
        default:
          // An inline element at the top — the sanitizer leaves none, but a paragraph
          // it would be.
          out.push(para(trimRuns(runsOf([node], PLAIN))))
      }
    }
    return out
  }

  /** A rich text as items, `width` wide. */
  richText(html: string, width: number, base: TextBase): Item[] {
    const root = parseDocument(html) as unknown as Node
    const paras = this.paras(root.children ?? [], base, 0, 0, 0)
    const items: Item[] = []
    const bars = (depth: number) => (x: number, y: number, h: number) => {
      for (let q = 0; q < depth; q++) {
        this.doc.rect(x + q * 12 + 1, y, 2, h).fill(RULE)
      }
    }
    paras.forEach((p, i) => {
      const next = paras[i + 1]
      const bar = bars(p.quote)
      if (p.before > 0)
        items.push(
          gap(
            p.before,
            p.quote > 0 && i > 0 && (paras[i - 1]?.quote ?? 0) >= p.quote
              ? (x, y) => bar(x, y, p.before)
              : undefined,
          ),
        )
      if (p.hr) {
        items.push({
          height: 1,
          draw: (x, y) => {
            this.doc
              .moveTo(x + p.indent, y + 0.5)
              .lineTo(x + width, y + 0.5)
              .lineWidth(0.75)
              .strokeColor(RULE)
              .stroke()
          },
        })
      } else {
        const lines = this.type.lines(p.runs, width - p.indent, p.style)
        if (lines.length === 0) {
          items.push(gap(base.size * 0.6))
          return
        }
        lines.forEach((line, k) => {
          const ruled = p.rule > 0 && k === lines.length - 1
          const height = line.height + (ruled ? p.rule + base.size * 0.5 : 0)
          items.push({
            height,
            keep: p.keep,
            draw: (x, y) => {
              if (p.quote > 0) bar(x, y, height)
              line.draw(x + p.indent, y)
              if (k === 0 && p.marker !== null) {
                const marker = this.type.plain(p.marker, 16, {
                  ...p.style,
                  color: this.palette.muted,
                  align: 'left',
                })[0]
                marker?.draw(x + p.indent - 16, y)
              }
              if (ruled) {
                this.doc
                  .rect(x + p.indent, y + line.height + base.size * 0.15, width - p.indent, p.rule)
                  .fill(this.palette.accent)
              }
            },
          })
        })
      }
      if (p.after > 0) {
        const inQuote = p.quote > 0 && (next?.quote ?? 0) >= p.quote
        items.push(gap(p.after, inQuote ? (x, y) => bar(x, y, p.after) : undefined))
      }
    })
    return items
  }

  // Blocks

  block(block: LaidBlock, width: number): Item[] {
    switch (block.kind) {
      case 'html':
        return this.text(block, width)
      case 'fields':
        return this.fields(block, width)
      case 'table':
        return this.table(block, width)
      case 'break':
        return [{ height: 0, pageBreak: true }]
      case 'image':
        return this.image(block, width)
      case 'title':
        return this.title(block, width)
      case 'divider': {
        const color =
          block.color === 'accent'
            ? this.palette.accent
            : block.color === 'text'
              ? this.palette.text
              : RULE
        return [
          gap(this.size * 0.5),
          {
            height: block.thickness,
            draw: (x, y) => {
              const w = (width * (block.width ?? 100)) / 100
              this.doc.rect(x + (width - w) / 2, y, w, block.thickness).fill(color)
            },
          },
          gap(this.size * 0.9),
        ]
      }
      case 'spacer':
        return [{ height: block.height * MM, space: true }]
      case 'columns':
        return this.columns(block, width)
    }
  }

  private text(block: Extract<LaidBlock, { kind: 'html' }>, width: number): Item[] {
    const size = this.size * (block.size === 'small' ? 0.85 : block.size === 'large' ? 1.2 : 1)
    const base: TextBase = { size, color: this.palette.text, align: block.align ?? 'left' }
    const style = block.style ?? 'plain'
    if (style === 'plain') return this.richText(block.html, width, base)
    const padX = style === 'bar' ? size * 1.2 : size * 1.2
    const padY = style === 'bar' ? size * 0.2 : size * 0.9
    const inner = trimmed(
      this.richText(block.html, width - (style === 'bar' ? padX : 2 * padX), base),
    )
    if (inner.length === 0) return []
    const height = heightOf(inner) + 2 * padY
    // Taller than a page: the text flows on, without its box.
    if (height > this.room) return this.richText(block.html, width, base)
    return [
      {
        height,
        draw: (x, y) => {
          if (style === 'tint') this.doc.roundedRect(x, y, width, height, 3).fill(this.palette.tint)
          else if (style === 'border')
            this.doc
              .roundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 3)
              .lineWidth(0.75)
              .strokeColor(mix(this.palette.accent, WHITE, 0.45))
              .stroke()
          else this.doc.rect(x, y, 2.5, height).fill(this.palette.accent)
          drawStack(inner, x + padX, y + padY)
        },
      },
      gap(this.size * 0.9),
    ]
  }

  /** A row of cells, each a stack of lines at its offset: one item, or one per band of lines when too tall. */
  private row(
    cells: ReadonlyArray<{
      readonly x: number
      readonly lines: readonly Line[]
      readonly dy?: number
    }>,
    padTop: number,
    padBottom: number,
    decorate: (x: number, y: number, height: number, first: boolean, last: boolean) => void,
    minHeight = 0,
  ): Item[] {
    const heights = cells.map((c) => heightOf(c.lines) + (c.dy ?? 0))
    const height = Math.max(minHeight, ...heights) + padTop + padBottom
    if (height <= this.room * 0.5) {
      return [
        {
          height,
          draw: (x, y) => {
            decorate(x, y, height, true, true)
            for (const c of cells) {
              let cy = y + padTop + (c.dy ?? 0)
              for (const line of c.lines) {
                line.draw(x + c.x, cy)
                cy += line.height
              }
            }
          },
        },
      ]
    }
    // A cell longer than half a page: the row goes on by bands of lines, page after page.
    const bands = Math.max(...cells.map((c) => c.lines.length))
    const out: Item[] = []
    for (let k = 0; k < bands; k++) {
      const first = k === 0
      const last = k === bands - 1
      const bandHeight =
        Math.max(...cells.map((c) => c.lines[k]?.height ?? 0)) +
        (first ? padTop : 0) +
        (last ? padBottom : 0)
      out.push({
        height: bandHeight,
        draw: (x, y) => {
          decorate(x, y, bandHeight, first, last)
          for (const c of cells) c.lines[k]?.draw(x + c.x, y + (first ? padTop : 0))
        },
      })
    }
    return out
  }

  /**
   * A summary: each label on the left, its value on the right, the last row — the total
   * due — in bold over an accent rule.
   */
  private summary(block: Extract<LaidBlock, { kind: 'fields' }>, width: number): Item[] {
    const s = this.size
    const p = this.palette
    const items: Item[] = []
    const valueW = Math.min(
      width * 0.5,
      Math.max(
        ...block.rows.map((r) =>
          this.type.width(
            r.value,
            this.body({ size: s * 1.1, color: p.text, align: 'right' }),
            true,
          ),
        ),
      ) + 4,
    )
    block.rows.forEach((row, i) => {
      const last = i === block.rows.length - 1 && block.rows.length > 1
      const size = last ? s * 1.1 : s
      const label = this.type.plain(
        row.label,
        width - valueW - 12,
        this.body({ size, color: last ? p.text : p.muted, align: 'left' }, { bold: last }),
      )
      const value = this.type.plain(
        row.value === '' ? '—' : row.value,
        valueW,
        this.body({ size, color: last ? p.accent : p.text, align: 'right' }, { bold: last }),
      )
      const pad = s * (last ? 0.55 : 0.4)
      items.push(
        ...this.row(
          [
            { x: 0, lines: label },
            { x: width - valueW, lines: value },
          ],
          pad,
          pad,
          (x, y, h, first) => {
            if (!first) return
            if (last) this.doc.rect(x, y - 0.6, width, 1.2).fill(p.accent)
            else if (i > 0) this.doc.rect(x, y - 0.25, width, 0.5).fill(RULE)
          },
        ),
      )
    })
    items.push(gap(s * 0.7))
    return items
  }

  private fields(block: Extract<LaidBlock, { kind: 'fields' }>, width: number): Item[] {
    if (block.labels === 'summary') return this.summary(block, width)
    const n = block.columns ?? 1
    const above = (block.labels ?? 'beside') === 'above'
    const s = this.size
    const gapX = n > 1 ? s * 2 : 0
    const cellW = (width - gapX * (n - 1)) / n
    const label: TextStyle = above
      ? this.body({ size: s * 0.78, color: this.palette.muted, align: 'left' }, { tracking: 0.3 })
      : this.body(
          { size: s * 0.9, color: this.palette.muted, align: 'left' },
          { lineGap: s * 0.25 },
        )
    const items: Item[] = []
    for (let i = 0; i < block.rows.length; i += n) {
      const group = block.rows.slice(i, i + n)
      const cells: Array<{ x: number; lines: Line[]; dy?: number }> = []
      group.forEach((row, c) => {
        const left = c * (cellW + gapX)
        const value = this.body({
          size: s,
          color: row.value === '' ? this.palette.muted : this.palette.text,
          align: 'left',
        })
        const shown = row.value === '' ? '—' : row.value
        if (above) {
          const labelLines = this.type.plain(upper(row.label, this.locale), cellW, label)
          const valueLines = this.type.plain(shown, cellW, value)
          const between: Line = { width: 0, height: s * 0.2, draw: () => {} }
          cells.push({ x: left, lines: [...labelLines, between, ...valueLines] })
        } else {
          const labelW = n === 1 ? Math.min(170, width * 0.34) : cellW * 0.4
          cells.push({ x: left, lines: this.type.plain(row.label, labelW, label), dy: 1 })
          cells.push({
            x: left + labelW + 12,
            lines: this.type.plain(shown, cellW - labelW - 12, value),
          })
        }
      })
      if (above) {
        items.push(...this.row(cells, 0, s * 0.9, () => {}))
      } else {
        items.push(
          ...this.row(cells, 0, 8 - s * 0.25, (x, y, h, _first, last) => {
            if (!last) return
            for (let c = 0; c < group.length; c++) {
              const left = x + c * (cellW + gapX)
              this.doc
                .moveTo(left, y + h - 3)
                .lineTo(left + cellW, y + h - 3)
                .lineWidth(0.5)
                .strokeColor(RULE)
                .stroke()
            }
          }),
        )
      }
    }
    items.push(gap(s * 0.7))
    return items
  }

  /** A table: its head repeated on each page, numbers on the right, totals under it. */
  private table(block: Extract<LaidBlock, { kind: 'table' }>, width: number): Item[] {
    const s = this.size
    const pad = s * 0.5
    const n = block.columns.length
    const style = block.style ?? 'light'
    const p = this.palette
    const headStyle = this.body(
      {
        size: s * 0.9,
        align: 'left',
        color: style === 'accent' ? p.onAccent : style === 'lines' ? p.accent : p.muted,
      },
      { bold: true, lineGap: s * 0.15 },
    )
    const cellStyle = this.body(
      { size: s * 0.95, align: 'left', color: p.text },
      { lineGap: s * 0.15 },
    )
    const totalStyle = this.body(
      { size: s, align: 'left', color: p.text },
      { bold: true, lineGap: s * 0.15 },
    )

    const items: Item[] = []
    if (block.title !== '') {
      const titles = this.theme.titles
      const lines = this.type.plain(block.title, width, {
        ...this.body({
          size: s * 1.2,
          align: 'left',
          color: titles === 'accent' ? p.accent : p.text,
        }),
        family: this.theme.title_font,
        bold: true,
      })
      items.push(gap(s * 0.3))
      for (const line of lines)
        items.push({ height: line.height, keep: true, draw: (x, y) => line.draw(x, y) })
      // The space under a title is kept with it: the head follows on the same page.
      items.push({ ...gap(s * 0.35), keep: true })
    }

    // Widths: those given in percent; the others from the widest of what they hold, the
    // text columns sharing what is left.
    const fixed = block.columns.map((c) => (c.width != null ? (c.width / 100) * width : null))
    const fixedTotal = fixed.reduce<number>((a, w) => a + (w ?? 0), 0)
    const free = block.columns.map((_, c) => c).filter((c) => fixed[c] === null)
    const scale =
      fixedTotal > width * (free.length > 0 ? 0.8 : 1)
        ? (width * (free.length > 0 ? 0.8 : 1)) / fixedTotal
        : 1
    const widths = block.columns.map((column, c) => {
      const given = fixed[c]
      if (given !== null && given !== undefined) return given * scale
      let w = Math.max(
        this.type.width(column.label, headStyle),
        this.type.width(block.totals?.[c] ?? '', totalStyle),
      )
      for (const row of block.rows.slice(0, 200))
        w = Math.max(w, this.type.width(row[c] ?? '', cellStyle))
      const natural = w + 2 * pad + 1
      return column.numeric ? Math.min(natural, width * 0.3) : natural
    })
    const room = width - fixedTotal * scale
    const freeTotal = free.reduce((a, c) => a + (widths[c] as number), 0)
    const textCols = free.filter((c) => !block.columns[c]?.numeric)
    if (free.length > 0) {
      if (freeTotal < room && textCols.length > 0) {
        const extra = (room - freeTotal) / textCols.length
        for (const c of textCols) widths[c] = (widths[c] as number) + extra
      } else if (freeTotal < room) {
        const extra = (room - freeTotal) / free.length
        for (const c of free) widths[c] = (widths[c] as number) + extra
      } else if (freeTotal > room) {
        // Too wide: a column narrower than its share keeps what it needs — a client's
        // name stays on one line —, and the wide ones share what is left by their width.
        let left = room
        let open = [...free]
        for (;;) {
          const share = left / Math.max(1, open.length)
          const narrow = open.filter((c) => (widths[c] as number) <= share)
          if (narrow.length === 0 || narrow.length === open.length) break
          for (const c of narrow) left -= widths[c] as number
          open = open.filter((c) => !narrow.includes(c))
        }
        const wanted = open.reduce((a, c) => a + (widths[c] as number), 0)
        for (const c of open) widths[c] = Math.max(40, ((widths[c] as number) / wanted) * left)
      }
    }
    const sum = widths.reduce((a, b) => a + b, 0)
    if (sum > width) for (let c = 0; c < n; c++) widths[c] = ((widths[c] as number) / sum) * width
    const offsets = widths.map((_, c) => widths.slice(0, c).reduce((a, b) => a + b, 0))
    const alignOf = (c: number): Align =>
      block.columns[c]?.align ?? (block.columns[c]?.numeric ? 'right' : 'left')

    const cellsOf = (cells: readonly string[], st: TextStyle) =>
      cells.map((cell, c) => ({
        x: (offsets[c] as number) + pad,
        lines: this.type.plain(cell, (widths[c] as number) - 2 * pad, { ...st, align: alignOf(c) }),
      }))
    const rule = (x: number, y: number, color: string, weight: number) =>
      this.doc.rect(x, y - weight / 2, width, weight).fill(color)

    const headCells = cellsOf(
      block.columns.map((c) => c.label),
      headStyle,
    )
    const [head] = this.row(
      headCells,
      pad,
      pad,
      (x, y, h) => {
        if (style === 'accent') this.doc.rect(x, y, width, h).fill(p.accent)
        else if (style === 'light') this.doc.rect(x, y, width, h).fill(HEAD_FILL)
        if (style === 'lines') rule(x, y + h, p.accent, 1.5)
        else if (style === 'light') rule(x, y + h, RULE, 0.5)
      },
      s * 0.9,
    )
    const headItem: Item = { ...(head as Item), keep: true }
    items.push(headItem)

    const zebra = style === 'accent' ? mix(p.accent, WHITE, 0.95) : ZEBRA
    block.rows.forEach((cells, r) => {
      const rowItems = this.row(
        cellsOf(cells, cellStyle),
        pad,
        pad,
        (x, y, h) => {
          if (block.zebra && r % 2 === 1) this.doc.rect(x, y, width, h).fill(zebra)
          if (style !== 'accent' || !block.zebra) rule(x, y + h, RULE, 0.5)
        },
        s * 0.95,
      )
      for (const item of rowItems) items.push({ ...item, head: headItem })
    })
    if (block.totals !== null) {
      const totals = block.totals.map((t) => t ?? '')
      const totalItems = this.row(
        cellsOf(totals, totalStyle),
        pad,
        pad,
        (x, y, h) => {
          if (style === 'accent') {
            this.doc.rect(x, y, width, h).fill(p.tintStrong)
            rule(x, y + h, p.accent, 1.2)
          } else if (style === 'lines') {
            rule(x, y, p.text, 0.9)
            rule(x, y + h, p.text, 0.9)
          } else {
            rule(x, y + h, p.text, 0.9)
          }
        },
        s,
      )
      for (const item of totalItems) items.push({ ...item, head: headItem })
    }
    if (block.more !== null) {
      items.push(gap(s * 0.3))
      for (const line of this.type.plain(
        block.more,
        width,
        this.body({ size: s * 0.85, color: p.muted, align: 'left' }),
      ))
        items.push({ height: line.height, draw: (x, y) => line.draw(x, y) })
    }
    items.push(gap(s * 1.1))
    return items
  }

  private image(block: Extract<LaidBlock, { kind: 'image' }>, width: number): Item[] {
    const opened = this.open(block.data)
    if (opened === null) return []
    let w = (width * block.width) / 100
    let h = (w * opened.height) / opened.width
    const most = this.room * 0.85
    if (h > most) {
      w *= most / h
      h = most
    }
    const offset =
      block.align === 'center' ? (width - w) / 2 : block.align === 'right' ? width - w : 0
    return [
      { height: h, draw: (x, y) => this.drawImage(opened, x + offset, y, w) },
      gap(this.size * 0.9),
    ]
  }

  /** A picture opened once, drawn as often as asked: a logo on every page is embedded once. */
  open(data: Buffer): Opened | null {
    try {
      const image = (this.doc as unknown as { openImage(src: Buffer): PdfImage }).openImage(data)
      // Turned a quarter by its EXIF orientation: its sides swap.
      const turned = (image.orientation ?? 1) > 4
      return {
        image,
        width: turned ? image.height : image.width,
        height: turned ? image.width : image.height,
      }
    } catch {
      return null
    }
  }

  drawImage(opened: Opened, x: number, y: number, width: number): void {
    try {
      // pdfkit takes the picture it opened where its types say a buffer.
      this.doc.image(opened.image as unknown as Buffer, x, y, { width })
    } catch {
      // A picture pdfkit cannot read is left out rather than failing the document.
    }
  }

  private title(block: Extract<LaidBlock, { kind: 'title' }>, width: number): Item[] {
    if (block.text === '' && block.subtitle === '') return []
    const p = this.palette
    const k = block.size === 'huge' ? 2.9 : block.size === 'medium' ? 1.5 : 2.1
    const size = this.size * k
    const band = block.style === 'band' || block.style === 'bleed'
    const padY = band ? Math.max(size * 0.45, this.size * 0.9) : 0
    // A band edge to edge keeps its text in line with the page's; a band in the margins
    // gives it room inside.
    const padX = block.style === 'band' ? this.size * 1.2 : 0
    const color = band ? p.onAccent : block.style === 'accent' ? p.accent : p.text
    const lines = this.type.plain(block.text, width - 2 * padX, {
      size,
      family: this.theme.title_font,
      bold: true,
      color,
      align: block.align,
      lineGap: size * 0.12,
    })
    const subSize = Math.max(this.size, size * 0.42)
    const sub =
      block.subtitle === ''
        ? []
        : this.type.plain(block.subtitle, width - 2 * padX, {
            size: subSize,
            family: this.theme.font,
            color: band ? p.onAccentMuted : p.muted,
            align: block.align,
          })
    const underline = block.style === 'underline'
    const barGap = underline ? this.size * 0.5 : 0
    const height =
      2 * padY +
      heightOf(lines) +
      (sub.length > 0 ? this.size * 0.15 + heightOf(sub) : 0) +
      (underline ? barGap + 3 : 0)
    const pageWidth = this.doc.page.width
    return [
      {
        height,
        keep: true,
        draw: (x, y, at) => {
          if (block.style === 'band') this.doc.rect(x, y, width, height).fill(p.accent)
          if (block.style === 'bleed') {
            // First on a page with no header, the band reaches the page's top edge too.
            const edge = this.inset
            const from = at?.top === true && !this.headerOn(at.page) ? edge : y
            this.doc.rect(edge, from, pageWidth - 2 * edge, y + height - from).fill(p.accent)
          }
          let cy = y + padY
          for (const line of lines) {
            line.draw(x + padX, cy)
            cy += line.height
          }
          if (sub.length > 0) cy += this.size * 0.15
          for (const line of sub) {
            line.draw(x + padX, cy)
            cy += line.height
          }
          if (underline) {
            const barW = Math.min(width, size * 2.2)
            const bx =
              block.align === 'center'
                ? x + (width - barW) / 2
                : block.align === 'right'
                  ? x + width - barW
                  : x
            this.doc.rect(bx, cy + barGap, barW, 3).fill(p.accent)
          }
        },
      },
      { ...gap(this.size * (band ? 1.4 : 1)), keep: true },
    ]
  }

  private columns(block: Extract<LaidBlock, { kind: 'columns' }>, width: number): Item[] {
    const gapX = this.size * 2
    const n = block.columns.length
    const weights = block.columns.map((_, c) => block.widths[c] ?? 1)
    const total = weights.reduce((a, b) => a + b, 0)
    const room = width - gapX * (n - 1)
    const widths = weights.map((w) => (room * w) / total)
    const stacks = block.columns.map((column, c) =>
      trimmed(column.flatMap((inner) => this.block(inner, widths[c] as number))),
    )
    const height = Math.max(0, ...stacks.map(heightOf))
    if (height === 0) return []
    // Taller than a page: the columns follow one another instead.
    if (height > this.room) {
      return block.columns.flatMap((column) => column.flatMap((inner) => this.block(inner, width)))
    }
    return [
      {
        height,
        draw: (x, y) => {
          let cx = x
          stacks.forEach((stack, c) => {
            drawStack(stack, cx, y)
            cx += (widths[c] as number) + gapX
          })
        },
      },
      gap(this.size * 0.9),
    ]
  }

  // The header and the footer

  /** The header, set once and drawn on its pages; `null` when it shows nothing. */
  header(
    header: LaidHeader,
    width: number,
  ): { height: number; draw: (x: number, y: number) => void } | null {
    const s = this.size * 0.9
    const logo = header.logo === null ? null : this.open(header.logo)
    const hasLeft = logo !== null || header.left !== ''
    const hasRight = header.right !== ''
    if (!hasLeft && !hasRight) return null
    const gapX = this.size * 2
    const leftW = hasRight ? (hasLeft ? (width - gapX) * 0.55 : 0) : width
    const rightW = hasLeft ? width - leftW - gapX : width
    let logoW = 0
    let logoH = 0
    if (logo !== null) {
      logoW = Math.min(header.logoWidth * MM, leftW)
      logoH = (logoW * logo.height) / logo.width
      const most = 32 * MM
      if (logoH > most) {
        logoW *= most / logoH
        logoH = most
      }
    }
    const base = (align: Align): TextBase => ({ size: s, color: this.palette.text, align })
    const left = header.left === '' ? [] : trimmed(this.richText(header.left, leftW, base('left')))
    const right =
      header.right === '' ? [] : trimmed(this.richText(header.right, rightW, base('right')))
    const logoGap = logo !== null && left.length > 0 ? this.size * 0.8 : 0
    const height = Math.max(logoH + logoGap + heightOf(left), heightOf(right))
    if (height === 0) return null
    const ruleGap = header.rule ? this.size * 0.9 : 0
    return {
      height: height + (header.rule ? ruleGap + 1 : 0),
      draw: (x, y) => {
        if (logo !== null) this.drawImage(logo, x, y, logoW)
        drawStack(left, x, y + logoH + logoGap)
        drawStack(right, x + width - rightW, y)
        if (header.rule) this.doc.rect(x, y + height + ruleGap, width, 1).fill(this.palette.accent)
      },
    }
  }

  footer(
    footer: LaidFooter,
    width: number,
    reserve: number,
  ): { height: number; draw: (x: number, y: number) => void } {
    const s = Math.max(7, this.size * 0.8)
    const textW = footer.align === 'center' ? width - 2 * reserve : width - reserve
    const items =
      footer.html === ''
        ? []
        : trimmed(
            this.richText(footer.html, textW, {
              size: s,
              color: this.palette.muted,
              align: footer.align,
            }),
          )
    const height = heightOf(items)
    return {
      height,
      draw: (x, y) => drawStack(items, footer.align === 'center' ? x + reserve : x, y),
    }
  }

  pageLabel(text: string): Line | null {
    const s = Math.max(7, this.size * 0.8)
    return (
      this.type.plain(
        text,
        200,
        this.body({ size: s, color: this.palette.muted, align: 'left' }),
      )[0] ?? null
    )
  }
}

/** A picture as pdfkit opens it — not in its published types. */
interface PdfImage {
  readonly width: number
  readonly height: number
  /** EXIF's: from 5 on, a quarter turn. */
  readonly orientation?: number
}

/** A picture opened, with its sides as it is shown. */
interface Opened {
  readonly image: PdfImage
  readonly width: number
  readonly height: number
}

/** The document as PDF bytes. */
export function layoutPdf(document: LaidDocument, fonts: FontSet | null): Promise<Buffer> {
  const theme = document.theme ?? DEFAULT_THEME
  const margin = theme.margin * MM
  const doc = new PDFDocument({
    size: document.page.size,
    layout: document.page.orientation,
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    bufferPages: true,
    autoFirstPage: true,
    lang: document.locale,
    displayTitle: true,
    info: { Title: document.title, Creator: 'basedb', Producer: 'basedb' },
  })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  const faces = new Faces(doc, fonts)
  const pageW = doc.page.width
  const pageH = doc.page.height
  const width = pageW - 2 * margin
  // The frame around each page, inset from its edges; header and footer stay inside it.
  const inset = margin * 0.38
  const framed = theme.border !== 'none'

  const measuring = new Composer(doc, faces, theme, pageH - 2 * margin, document.locale)
  const header =
    document.header === undefined || document.header === null
      ? null
      : measuring.header(document.header, width)
  const reserve = document.footer.pageNumbers
    ? measuring.type.width(document.pageLabel(888, 888), {
        size: Math.max(7, theme.size * 0.8),
        family: theme.font,
        color: INK,
      }) +
      theme.size * 1.6
    : 0
  const footer = measuring.footer(document.footer, width, reserve)
  const pageLabelHeight = document.footer.pageNumbers
    ? (measuring.pageLabel('1 / 1')?.height ?? 0)
    : 0
  const footerHeight = Math.max(footer.height, pageLabelHeight)

  const headerTop = Math.max(margin * 0.55, framed ? inset + theme.size * 1.4 : 0)
  const bodyTopWithHeader =
    header === null ? margin : Math.max(margin, headerTop + header.height + theme.size * 1.6)
  const footerBottom = pageH - Math.max(margin * 0.42, framed ? inset + theme.size * 1.2 : 14)
  const footerTop = footerBottom - footerHeight
  const ruleGap = document.footer.rule ? theme.size * 0.7 : 0
  const bodyBottom = Math.min(pageH - margin, footerTop - ruleGap - theme.size * 0.9)
  const everyHeader = document.header?.show === 'every'
  const headerOn = (page: number) => header !== null && (page === 0 || everyHeader)
  const frame: Frame = {
    left: margin,
    width,
    top: (page) => (headerOn(page) ? bodyTopWithHeader : margin),
    bottom: bodyBottom,
  }

  const composer = new Composer(
    doc,
    faces,
    theme,
    frame.bottom - Math.max(frame.top(0), frame.top(1)),
    document.locale,
    headerOn,
    framed ? inset : 0,
  )
  const items = document.blocks.flatMap((block) => composer.block(block, width))
  new Pager(doc, frame).place(items, document.page.valign === 'center')

  // What every page carries, once their number is known: the frame, the header, the foot.
  const palette = paletteOf(theme)
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const index = i - range.start
    if (theme.border === 'line') {
      doc
        .rect(inset, inset, pageW - 2 * inset, pageH - 2 * inset)
        .lineWidth(1)
        .strokeColor(palette.accent)
        .stroke()
    } else if (theme.border === 'double') {
      doc
        .rect(inset, inset, pageW - 2 * inset, pageH - 2 * inset)
        .lineWidth(2.2)
        .strokeColor(palette.accent)
        .stroke()
      const inner = inset + 4
      doc
        .rect(inner, inner, pageW - 2 * inner, pageH - 2 * inner)
        .lineWidth(0.6)
        .strokeColor(palette.accent)
        .stroke()
    }
    if (header !== null && (index === 0 || everyHeader)) header.draw(margin, headerTop)
    if (document.footer.rule && (footer.height > 0 || document.footer.pageNumbers)) {
      doc.rect(margin, footerTop - ruleGap, width, 0.5).fill(RULE)
    }
    footer.draw(margin, footerTop)
    if (document.footer.pageNumbers) {
      const label = composer.pageLabel(document.pageLabel(index + 1, range.count))
      if (label !== null) {
        const x = margin + width - label.width
        label.draw(x, footerTop)
      }
    }
  }
  doc.flushPages()
  doc.end()
  return done
}
