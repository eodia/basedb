import type { JSX } from 'react'

/**
 * Minimal renderer for the documentation of chapter 08 §9.4.
 *
 * It handles exactly the subset the generator emits — headings, bullets, inline code,
 * bold — and NOTHING else. An unknown construct is shown as text, which is the safe
 * outcome.
 *
 * It never uses `dangerouslySetInnerHTML`: every fragment below becomes a React text
 * node, and React escapes those. That is why this renderer UNDOES the escaping the
 * generator applied — that escaping protects viewers which interpret HTML, and here the
 * protection comes from React itself. Showing `&lt;img` to the reader would be the bug,
 * not the safety.
 */

const ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&apos;/g, "'"],
  [/&#39;/g, "'"],
  // Last, so that `&amp;lt;` yields the text `&lt;` rather than the character `<`.
  [/&amp;/g, '&'],
]

function plain(text: string): string {
  let out = text
  for (const [pattern, char] of ENTITIES) out = out.replace(pattern, char)
  // A backslash escape is what a Markdown renderer consumes: `\*` displays `*`.
  return out.replace(/\\([\\`*_[\]()#!|>~])/g, '$1')
}

/** Splits a line into text, `code` and **bold** fragments. */
function inline(line: string, keyPrefix: string): JSX.Element[] {
  const parts: JSX.Element[] = []
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  let match: RegExpExecArray | null = pattern.exec(line)
  let index = 0

  while (match !== null) {
    if (match.index > last) {
      parts.push(<span key={`${keyPrefix}-t${index}`}>{plain(line.slice(last, match.index))}</span>)
    }
    parts.push(
      match[1] !== undefined ? (
        <code
          key={`${keyPrefix}-c${index}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {plain(match[1])}
        </code>
      ) : (
        <strong key={`${keyPrefix}-b${index}`}>{plain(match[2] ?? '')}</strong>
      ),
    )
    last = match.index + match[0].length
    index += 1
    match = pattern.exec(line)
  }

  if (last < line.length)
    parts.push(<span key={`${keyPrefix}-t${index}`}>{plain(line.slice(last))}</span>)
  return parts
}

export function Markdown({ source }: { readonly source: string }) {
  const blocks: JSX.Element[] = []
  let bullets: string[] = []

  const flush = (key: string) => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={key} className="mb-3 list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          // The bullet text is stable within a rendered document, so it keys itself.
          <li key={`${key}-${b.slice(0, 40)}-${i}`}>{inline(b, `${key}-${i}`)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  const lines = source.split('\n')
  let paragraph: string[] = []

  const flushParagraph = (key: string) => {
    if (paragraph.length === 0) return
    blocks.push(
      <p key={key} className="mb-2.5">
        {inline(paragraph.join(' '), key)}
      </p>,
    )
    paragraph = []
  }

  lines.forEach((raw, i) => {
    const key = `l${i}`

    if (raw.startsWith('### ')) {
      flush(`${key}-u`)
      flushParagraph(`${key}-p`)
      blocks.push(
        <h4 key={key} className="mt-4 mb-1.5 text-sm font-semibold text-foreground">
          {plain(raw.slice(4))}
        </h4>,
      )
      return
    }

    // Nested bullets are folded into their parent: the depth carries no meaning the
    // reader needs, and a flat list reads better in a panel.
    if (raw.startsWith('- ') || raw.startsWith('  - ')) {
      flushParagraph(`${key}-p`)
      bullets.push(raw.replace(/^\s*- /, ''))
      return
    }

    if (raw.trim() === '') {
      flush(`${key}-u`)
      flushParagraph(`${key}-p`)
      return
    }

    // An indented line inside a list CONTINUES the previous bullet. Without this it
    // becomes a paragraph wedged between two bullets, which is how the panel first
    // rendered a sentence broken across two source lines.
    if (bullets.length > 0 && /^\s+\S/.test(raw)) {
      bullets[bullets.length - 1] += ` ${raw.trim()}`
      return
    }

    flush(`${key}-u`)
    paragraph.push(raw)
  })

  flush('end-u')
  flushParagraph('end-p')

  return <div className="text-sm leading-relaxed text-muted-foreground">{blocks}</div>
}
