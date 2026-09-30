import { parseDocument } from 'htmlparser2'
import PDFDocument from 'pdfkit'
import { type FontFace, type FontSet, covers, winAnsi } from './fonts.js'
import type { Orientation, PageSize } from './spec.js'

/**
 * Setting a document on pages — chapter 21 §4. What comes in is already read, formatted
 * and allowed: texts, labels and values, with no catalog and no rights left to decide.
 * What goes out is the PDF's bytes.
 *
 * Rich text is the canonical form of the sanitizer (`rich-text.ts`): headings, paragraphs,
 * bold, italic, underline, strikethrough, lists, quotes, code, links, rules. A run of text
 * is set in the Latin face when it has all its characters, in the CJK face otherwise.
 */

export type LaidBlock =
  | { readonly kind: 'html'; readonly html: string }
  | {
      readonly kind: 'fields'
      readonly rows: ReadonlyArray<{ readonly label: string; readonly value: string }>
    }
  | {
      readonly kind: 'table'
      readonly title: string
      readonly columns: ReadonlyArray<{ readonly label: string; readonly numeric: boolean }>
      readonly rows: ReadonlyArray<ReadonlyArray<string>>
      /** One cell per column, `null` where nothing is summed; `null`: no total row. */
      readonly totals: ReadonlyArray<string | null> | null
      /** Rows left out past the bound, said under the table. */
      readonly more: string | null
    }
  | { readonly kind: 'break' }

export interface LaidDocument {
  readonly title: string
  readonly locale: string
  readonly page: { readonly size: PageSize; readonly orientation: Orientation }
  readonly footer: string
  /** `1 / 3`, in the document's language. */
  readonly pageLabel: (page: number, count: number) => string
  readonly blocks: readonly LaidBlock[]
}

const MARGIN = 56
const TEXT = '#111827'
const MUTED = '#6b7280'
const RULE = '#e5e7eb'
const HEAD_FILL = '#f3f4f6'
const LINK = '#1d4ed8'
const SIZE = 10
const LINE_GAP = 2.5

interface Run {
  readonly text: string
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly link: string | null
}

/** The faces, registered once on the document, and the one each text is set in. */
class Faces {
  private readonly builtIn: boolean
  constructor(
    private readonly doc: PDFKit.PDFDocument,
    private readonly set: FontSet | null,
  ) {
    this.builtIn = set === null
    if (set === null) return
    const add = (name: string, face: FontFace) =>
      face.family === undefined
        ? doc.registerFont(name, face.path)
        : doc.registerFont(name, face.path, face.family)
    add('r', set.regular)
    add('b', set.bold)
    add('i', set.italic)
    add('bi', set.boldItalic)
    set.fallbacks.forEach((f, i) => {
      add(`f${i}`, f.regular)
      add(`f${i}b`, f.bold)
    })
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

  private latin(bold: boolean, italic: boolean): string {
    if (this.builtIn) {
      return bold
        ? italic
          ? 'Helvetica-BoldOblique'
          : 'Helvetica-Bold'
        : italic
          ? 'Helvetica-Oblique'
          : 'Helvetica'
    }
    return bold ? (italic ? 'bi' : 'b') : italic ? 'i' : 'r'
  }

  private face(name: string): FontFace | null {
    const set = this.set
    if (set === null) return null
    return { r: set.regular, b: set.bold, i: set.italic, bi: set.boldItalic }[name] ?? null
  }

  /** The face for a whole text: the Latin one when it has every character. */
  whole(text: string, bold = false, italic = false): { font: string; text: string } {
    const latin = this.latin(bold, italic)
    if (this.builtIn) return { font: latin, text: winAnsi(text) }
    const face = this.face(latin) as FontFace
    if (covers(face, text) || (this.set?.fallbacks.length ?? 0) === 0) return { font: latin, text }
    return { font: this.fallbackFor(text, bold), text }
  }

  /** A run cut where its characters change face — a Latin name inside a Japanese line. */
  split(run: Run): Array<Run & { font: string }> {
    const latin = this.latin(run.bold, run.italic)
    if (this.builtIn || (this.set?.fallbacks.length ?? 0) === 0) {
      const { font, text } = this.whole(run.text, run.bold, run.italic)
      return [{ ...run, font, text }]
    }
    const face = this.face(latin) as FontFace
    const out: Array<Run & { font: string }> = []
    let current = ''
    let currentFont = ''
    for (const ch of run.text) {
      const font = covers(face, ch) ? latin : this.fallbackFor(ch, run.bold)
      if (font !== currentFont && current !== '') {
        out.push({ ...run, text: current, font: currentFont })
        current = ''
      }
      currentFont = font
      current += ch
    }
    if (current !== '') out.push({ ...run, text: current, font: currentFont })
    return out
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
function runsOf(nodes: readonly Node[], mark: Omit<Run, 'text'>): Run[] {
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

const PLAIN: Omit<Run, 'text'> = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  link: null,
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

class Writer {
  readonly doc: PDFKit.PDFDocument
  readonly faces: Faces
  readonly left: number
  readonly width: number

  constructor(doc: PDFKit.PDFDocument, faces: Faces) {
    this.doc = doc
    this.faces = faces
    this.left = MARGIN
    this.width = doc.page.width - 2 * MARGIN
  }

  get bottom(): number {
    return this.doc.page.height - MARGIN
  }

  /** Room for `height` more points on this page, or a new page. */
  ensure(height: number): void {
    if (this.doc.y + height > this.bottom) this.doc.addPage()
  }

  /** A paragraph of runs, from `x`, `width` wide. */
  runs(runs: readonly Run[], x: number, width: number, size: number, color = TEXT): void {
    const doc = this.doc
    const parts = runs.flatMap((r) => this.faces.split(r))
    if (parts.length === 0) {
      doc.moveDown(0.5)
      return
    }
    const start = doc.y
    parts.forEach((part, i) => {
      doc
        .font(part.font)
        .fontSize(size)
        .fillColor(part.link !== null ? LINK : color)
      const options: PDFKit.Mixins.TextOptions = {
        width,
        lineGap: LINE_GAP,
        continued: i < parts.length - 1,
        underline: part.underline || part.link !== null,
        strike: part.strike,
        ...(part.link !== null ? { link: part.link } : {}),
      }
      if (i === 0) doc.text(part.text, x, start, options)
      else doc.text(part.text, options)
    })
    doc.x = this.left
  }

  html(html: string): void {
    const root = parseDocument(html) as unknown as Node
    this.nodes(root.children ?? [], this.left, this.width, 0)
  }

  private nodes(nodes: readonly Node[], x: number, width: number, depth: number): void {
    const doc = this.doc
    for (const node of nodes) {
      if (node.type === 'text') {
        const runs = trimRuns(runsOf([node], PLAIN))
        if (runs.length > 0) {
          this.runs(runs, x, width, SIZE)
          doc.moveDown(0.4)
        }
        continue
      }
      if (node.type !== 'tag') continue
      const children = node.children ?? []
      switch (node.name) {
        case 'h1':
        case 'h2':
        case 'h3': {
          const size = node.name === 'h1' ? 18 : node.name === 'h2' ? 14 : 12
          if (doc.y > MARGIN + 1) doc.moveDown(0.3)
          this.ensure(size * 2.4)
          this.runs(trimRuns(runsOf(children, { ...PLAIN, bold: true })), x, width, size)
          doc.moveDown(0.35)
          break
        }
        case 'p':
          this.ensure(SIZE * 1.6)
          this.runs(trimRuns(runsOf(children, PLAIN)), x, width, SIZE)
          doc.moveDown(0.4)
          break
        case 'pre':
          this.ensure(SIZE * 1.6)
          this.runs([{ ...PLAIN, text: decode(textOf(children)) }], x + 8, width - 8, 9, MUTED)
          doc.moveDown(0.4)
          break
        case 'blockquote': {
          const top = doc.y
          const page = doc.bufferedPageRange().count
          this.nodes(children, x + 12, width - 12, depth)
          if (doc.bufferedPageRange().count === page) {
            doc
              .moveTo(x + 2, top)
              .lineTo(x + 2, doc.y - 4)
              .lineWidth(2)
              .strokeColor(RULE)
              .stroke()
          }
          break
        }
        case 'ul':
        case 'ol': {
          let n = 0
          for (const item of children) {
            if (item.type !== 'tag' || item.name !== 'li') continue
            n += 1
            const marker = node.name === 'ol' ? `${n}.` : depth % 2 === 0 ? '•' : '◦'
            this.ensure(SIZE * 1.6)
            const inner = item.children ?? []
            const own = inner.filter(
              (c) => !(c.type === 'tag' && (c.name === 'ul' || c.name === 'ol')),
            )
            const lists = inner.filter(
              (c) => c.type === 'tag' && (c.name === 'ul' || c.name === 'ol'),
            )
            const top = doc.y
            const bullet = this.faces.whole(marker)
            doc.font(bullet.font).fontSize(SIZE).fillColor(MUTED)
            doc.text(bullet.text, x, top, { width: 16, lineBreak: false })
            doc.x = this.left
            doc.y = top
            // `<li><p>…</p></li>` or bare runs: the item's own text, then its sub-lists.
            const runs = trimRuns(
              own.flatMap((c) =>
                c.type === 'tag' && c.name === 'p'
                  ? [...runsOf(c.children ?? [], PLAIN), { ...PLAIN, text: ' ' }]
                  : runsOf([c], PLAIN),
              ),
            )
            this.runs(runs.length > 0 ? runs : [{ ...PLAIN, text: ' ' }], x + 16, width - 16, SIZE)
            doc.moveDown(0.15)
            if (lists.length > 0) this.nodes(lists, x + 16, width - 16, depth + 1)
          }
          doc.moveDown(0.3)
          break
        }
        case 'hr':
          this.ensure(12)
          doc.moveDown(0.3)
          doc
            .moveTo(x, doc.y)
            .lineTo(x + width, doc.y)
            .lineWidth(0.75)
            .strokeColor(RULE)
            .stroke()
          doc.moveDown(0.6)
          break
        default:
          // An inline element at the top — the sanitizer leaves none, but a paragraph
          // it would be.
          this.runs(trimRuns(runsOf([node], PLAIN)), x, width, SIZE)
          doc.moveDown(0.4)
      }
    }
  }

  /** The row's fields: the label on the left, the value beside it. */
  fields(rows: ReadonlyArray<{ readonly label: string; readonly value: string }>): void {
    const doc = this.doc
    const labelWidth = Math.min(170, this.width * 0.34)
    const valueWidth = this.width - labelWidth - 12
    for (const row of rows) {
      const label = this.faces.whole(row.label)
      const value = this.faces.whole(row.value === '' ? '—' : row.value)
      doc.font(label.font).fontSize(9)
      const hl = doc.heightOfString(label.text, { width: labelWidth, lineGap: LINE_GAP })
      doc.font(value.font).fontSize(SIZE)
      const hv = doc.heightOfString(value.text, { width: valueWidth, lineGap: LINE_GAP })
      const height = Math.max(hl, hv) + 8
      this.ensure(height)
      const top = doc.y
      doc
        .font(label.font)
        .fontSize(9)
        .fillColor(MUTED)
        .text(label.text, this.left, top + 1, { width: labelWidth, lineGap: LINE_GAP })
      doc
        .font(value.font)
        .fontSize(SIZE)
        .fillColor(row.value === '' ? MUTED : TEXT)
        .text(value.text, this.left + labelWidth + 12, top, {
          width: valueWidth,
          lineGap: LINE_GAP,
        })
      doc
        .moveTo(this.left, top + height - 3)
        .lineTo(this.left + this.width, top + height - 3)
        .lineWidth(0.5)
        .strokeColor(RULE)
        .stroke()
      doc.x = this.left
      doc.y = top + height
    }
    doc.moveDown(0.6)
  }

  /** A table: its header repeated on each page, numbers on the right, totals under it. */
  table(block: Extract<LaidBlock, { kind: 'table' }>): void {
    const doc = this.doc
    const pad = 5
    const n = block.columns.length
    if (block.title !== '') {
      if (doc.y > MARGIN + 1) doc.moveDown(0.3)
      this.ensure(40)
      const title = this.faces.whole(block.title, true)
      doc.font(title.font).fontSize(12).fillColor(TEXT).text(title.text, this.left, doc.y)
      doc.moveDown(0.3)
    }

    // Natural widths: the widest cell of each column; text columns share what is left.
    const natural = block.columns.map((column, c) => {
      const width = (text: string, bold: boolean, size: number) => {
        const set = this.faces.whole(text, bold)
        doc.font(set.font).fontSize(size)
        return doc.widthOfString(set.text)
      }
      // The total is set in bold: measured in bold, or it would wrap under its own column.
      let w = Math.max(width(column.label, true, 9), width(block.totals?.[c] ?? '', true, 9.5))
      for (const row of block.rows.slice(0, 200)) w = Math.max(w, width(row[c] ?? '', false, 9.5))
      return w + 2 * pad + 1
    })
    const widths = natural.map((w, c) =>
      block.columns[c]?.numeric ? Math.min(w, this.width * 0.3) : w,
    )
    const total = widths.reduce((a, b) => a + b, 0)
    const textCols = block.columns.map((c, i) => (c.numeric ? -1 : i)).filter((i) => i >= 0)
    if (total < this.width && textCols.length > 0) {
      const extra = (this.width - total) / textCols.length
      for (const i of textCols) widths[i] = (widths[i] as number) + extra
    } else if (total > this.width) {
      const fixed = widths.reduce((a, w, i) => (textCols.includes(i) ? a : a + w), 0)
      const room = Math.max(this.width - fixed, textCols.length * 40)
      const textTotal = textCols.reduce((a, i) => a + (widths[i] as number), 0)
      for (const i of textCols) widths[i] = Math.max(40, ((widths[i] as number) / textTotal) * room)
      const now = widths.reduce((a, b) => a + b, 0)
      if (now > this.width)
        for (let i = 0; i < n; i++) widths[i] = ((widths[i] as number) / now) * this.width
    }

    const heightOf = (cells: readonly string[], bold: boolean, size: number) =>
      Math.max(
        ...cells.map((cell, c) => {
          const set = this.faces.whole(cell, bold)
          doc.font(set.font).fontSize(size)
          return doc.heightOfString(set.text, {
            width: (widths[c] as number) - 2 * pad,
            lineGap: 1.5,
          })
        }),
        size,
      ) +
      2 * pad

    const draw = (
      cells: readonly string[],
      bold: boolean,
      size: number,
      fill: string | null,
      rule: string,
    ) => {
      const height = heightOf(cells, bold, size)
      const top = doc.y
      if (fill !== null) doc.rect(this.left, top, this.width, height).fill(fill)
      let x = this.left
      cells.forEach((cell, c) => {
        const set = this.faces.whole(cell, bold)
        doc
          .font(set.font)
          .fontSize(size)
          .fillColor(bold && fill !== null ? MUTED : TEXT)
          .text(set.text, x + pad, top + pad, {
            width: (widths[c] as number) - 2 * pad,
            align: block.columns[c]?.numeric ? 'right' : 'left',
            lineGap: 1.5,
          })
        x += widths[c] as number
      })
      doc
        .moveTo(this.left, top + height)
        .lineTo(this.left + this.width, top + height)
        .lineWidth(rule === TEXT ? 0.9 : 0.5)
        .strokeColor(rule)
        .stroke()
      doc.x = this.left
      doc.y = top + height
    }

    const header = block.columns.map((c) => c.label)
    const headerHeight = heightOf(header, true, 9)
    this.ensure(headerHeight + 24)
    draw(header, true, 9, HEAD_FILL, RULE)
    for (const row of block.rows) {
      const height = heightOf(row, false, 9.5)
      if (doc.y + height > this.bottom) {
        doc.addPage()
        draw(header, true, 9, HEAD_FILL, RULE)
      }
      draw(row, false, 9.5, null, RULE)
    }
    if (block.totals !== null) {
      const cells = block.totals.map((t) => t ?? '')
      if (doc.y + heightOf(cells, true, 9.5) > this.bottom) doc.addPage()
      draw(cells, true, 9.5, null, TEXT)
    }
    if (block.more !== null) {
      doc.moveDown(0.3)
      const more = this.faces.whole(block.more)
      doc.font(more.font).fontSize(8.5).fillColor(MUTED).text(more.text, this.left, doc.y)
    }
    doc.moveDown(0.8)
  }
}

function textOf(nodes: readonly Node[]): string {
  return nodes.map((n) => (n.type === 'text' ? (n.data ?? '') : textOf(n.children ?? []))).join('')
}

/** The document as PDF bytes. */
export function layoutPdf(document: LaidDocument, fonts: FontSet | null): Promise<Buffer> {
  const doc = new PDFDocument({
    size: document.page.size,
    layout: document.page.orientation,
    margin: MARGIN,
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
  const writer = new Writer(doc, faces)
  doc.fillColor(TEXT)

  for (const block of document.blocks) {
    switch (block.kind) {
      case 'html':
        writer.html(block.html)
        break
      case 'fields':
        writer.fields(block.rows)
        break
      case 'table':
        writer.table(block)
        break
      case 'break':
        doc.addPage()
        break
    }
  }

  // The foot of every page, once their number is known.
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const bottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    const y = doc.page.height - MARGIN + 22
    const label = faces.whole(document.pageLabel(i - range.start + 1, range.count))
    doc.font(label.font).fontSize(8).fillColor(MUTED)
    const labelWidth = doc.widthOfString(label.text) + 2
    doc.text(label.text, doc.page.width - MARGIN - labelWidth, y, {
      width: labelWidth,
      lineBreak: false,
    })
    if (document.footer !== '') {
      const footer = faces.whole(document.footer)
      doc
        .font(footer.font)
        .fontSize(8)
        .fillColor(MUTED)
        .text(footer.text, MARGIN, y, {
          width: doc.page.width - 2 * MARGIN - labelWidth - 16,
          height: 10,
          ellipsis: true,
          lineBreak: false,
        })
    }
    doc.page.margins.bottom = bottom
  }
  doc.flushPages()
  doc.end()
  return done
}
