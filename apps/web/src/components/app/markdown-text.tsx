'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorSelection, EditorState } from '@codemirror/state'
import {
  EditorView,
  type KeyBinding,
  keymap,
  placeholder as placeholderExtension,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Quote,
  Strikethrough,
} from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Long text, written in Markdown — how it reads in a cell, in the row's panel, and how it
 * is written.
 *
 * The column holds the Markdown source, as typed: psql reads the text a person wrote, and
 * the rendering is the screen's affair. Rendering never interprets HTML — `react-markdown`
 * builds React elements, and a `<script>` typed in a note is shown as text — and its links
 * leave in a new tab, without the opener, and only for the protocols a link may carry.
 */

// ── Reading ──────────────────────────────────────────────────────────────────────────

const components: Components = {
  h1: ({ children }) => <h1 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="mt-3 mb-1 text-sm font-semibold first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-3 mb-1 text-sm font-medium first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-3 mb-1 text-sm font-medium first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children, className }) => (
    <ul
      className={cn(
        'my-2 space-y-0.5 pl-5',
        className?.includes('contains-task-list') ? 'list-none pl-1' : 'list-disc',
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="[&>input]:mr-1.5 [&>input]:align-middle">{children}</li>,
  input: ({ checked, type }) =>
    type === 'checkbox' ? (
      <input type="checkbox" checked={checked === true} disabled readOnly />
    ) : null,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  code: ({ children, className }) =>
    className === undefined ? (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ) : (
      <code className={cn('font-mono text-xs', className)}>{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="my-3 border-border" />,
  // A picture in a note is a link, not an image fetched on every read: a remote image is
  // a request the reader did not choose to make, and a tracker's favourite beacon.
  img: ({ src, alt }) => (
    <a
      href={typeof src === 'string' ? src : undefined}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-primary underline underline-offset-2"
    >
      {alt !== undefined && alt !== '' ? alt : 'image'}
    </a>
  ),
}

/** A Markdown source, rendered — no HTML interpreted, links in a new tab. */
export const MarkdownView = memo(function MarkdownView({
  source,
  className,
}: {
  readonly source: string
  readonly className?: string
}) {
  return (
    <div className={cn('text-sm leading-relaxed break-words', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
})

/**
 * One line of what a Markdown text says, without its markup — what a cell of the grid
 * shows. Headings, list items and paragraphs are joined by a separator rather than lost.
 */
export function markdownExcerpt(source: string, max = 280): string {
  const text = source
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^\s*_][^*_]*?)[*_](?=[\s).,;:!?]|$)/gm, '$1$2')
    .split(/\n\s*\n|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' · ')
    .replace(/\s+/g, ' ')
    .trim()
  return [...text].length > max ? `${[...text].slice(0, max).join('')}…` : text
}

// ── Writing ──────────────────────────────────────────────────────────────────────────

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '600', color: 'var(--foreground)' },
  { tag: tags.heading1, fontSize: '1.15em' },
  { tag: tags.heading2, fontSize: '1.08em' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--primary)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
  { tag: tags.quote, color: 'var(--muted-foreground)' },
  { tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--muted-foreground)' },
])

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6' },
  '.cm-content': { padding: '10px 12px', caretColor: 'var(--foreground)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklab, var(--primary) 22%, transparent)',
  },
  '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
})

/** Wraps the selection in a marker — or unwraps it when it already is. */
function wrap(view: EditorView, before: string, after = before): boolean {
  const { state } = view
  view.dispatch(
    state.changeByRange((range) => {
      const outerBefore = state.sliceDoc(range.from - before.length, range.from)
      const outerAfter = state.sliceDoc(range.to, range.to + after.length)
      if (outerBefore === before && outerAfter === after) {
        return {
          changes: [
            { from: range.from - before.length, to: range.from, insert: '' },
            { from: range.to, to: range.to + after.length, insert: '' },
          ],
          range: EditorSelection.range(range.from - before.length, range.to - before.length),
        }
      }
      return {
        changes: [
          { from: range.from, insert: before },
          { from: range.to, insert: after },
        ],
        range: EditorSelection.range(range.from + before.length, range.to + before.length),
      }
    }),
  )
  view.focus()
  return true
}

/** Puts a marker at the start of every selected line — or takes it off when all have it. */
function prefix(view: EditorView, marker: (index: number) => string, pattern: RegExp): boolean {
  const { state } = view
  const lines: { from: number; text: string }[] = []
  for (const range of state.selection.ranges) {
    for (let at = range.from; at <= range.to; ) {
      const line = state.doc.lineAt(at)
      if (!lines.some((l) => l.from === line.from)) lines.push({ from: line.from, text: line.text })
      at = line.to + 1
    }
  }
  const all = lines.every((l) => pattern.test(l.text))
  view.dispatch({
    changes: lines.map((line, index) => {
      const found = line.text.match(pattern)?.[0] ?? ''
      return all
        ? { from: line.from, to: line.from + found.length, insert: '' }
        : { from: line.from, to: line.from + found.length, insert: marker(index) }
    }),
  })
  view.focus()
  return true
}

/** `[texte](https://)`, the address selected, ready to be typed over. */
function link(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  const text = state.sliceDoc(range.from, range.to) || 'lien'
  const insert = `[${text}](https://)`
  const url = range.from + text.length + 3
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(url, url + 'https://'.length),
  })
  view.focus()
  return true
}

const LIST = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/

const ACTIONS: ReadonlyArray<{
  readonly label: string
  readonly icon: LucideIcon
  readonly keys?: string
  readonly run: (view: EditorView) => boolean
}> = [
  { label: 'Titre', icon: Heading2, run: (v) => prefix(v, () => '## ', /^#{1,6}\s+/) },
  { label: 'Gras', icon: Bold, keys: 'Ctrl+B', run: (v) => wrap(v, '**') },
  { label: 'Italique', icon: Italic, keys: 'Ctrl+I', run: (v) => wrap(v, '_') },
  { label: 'Barré', icon: Strikethrough, run: (v) => wrap(v, '~~') },
  { label: 'Liste', icon: List, run: (v) => prefix(v, () => '- ', LIST) },
  { label: 'Liste numérotée', icon: ListOrdered, run: (v) => prefix(v, (i) => `${i + 1}. `, LIST) },
  { label: 'Cases à cocher', icon: ListChecks, run: (v) => prefix(v, () => '- [ ] ', LIST) },
  { label: 'Citation', icon: Quote, run: (v) => prefix(v, () => '> ', /^>\s?/) },
  { label: 'Code', icon: Code, run: (v) => wrap(v, '`') },
  { label: 'Lien', icon: LinkIcon, keys: 'Ctrl+K', run: link },
]

export interface MarkdownEditorProps {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Ctrl+Entrée. */
  readonly onSubmit?: () => void
  /** Échap. */
  readonly onCancel?: () => void
  /** Focus left the editor — the row's panel saves then, as its other fields do. */
  readonly onBlur?: () => void
  readonly autoFocus?: boolean
  readonly readOnly?: boolean
  readonly placeholder?: string
  /** The writing area's height, in pixels: it grows beyond it up to twice as much. */
  readonly minHeight?: number
  readonly label: string
  readonly className?: string
}

/** A Markdown editor: a toolbar, the source with its markup coloured, and a preview. */
export function MarkdownEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  onBlur,
  autoFocus = false,
  readOnly = false,
  placeholder,
  minHeight = 160,
  label,
  className,
}: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const latest = useRef({ onChange, onSubmit, onCancel, onBlur })
  latest.current = { onChange, onSubmit, onCancel, onBlur }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounted once — the callbacks travel through the ref above, and the document through its own effect; rebuilding the editor would lose the cursor and the undo history.
  useEffect(() => {
    if (host.current === null) return
    const keys: KeyBinding[] = [
      { key: 'Mod-b', run: (v) => wrap(v, '**') },
      { key: 'Mod-i', run: (v) => wrap(v, '_') },
      { key: 'Mod-k', run: link },
      {
        key: 'Mod-Enter',
        preventDefault: true,
        run: () => {
          latest.current.onSubmit?.()
          return latest.current.onSubmit !== undefined
        },
      },
      {
        key: 'Escape',
        run: () => {
          latest.current.onCancel?.()
          return latest.current.onCancel !== undefined
        },
      },
    ]
    // Destroying a focused editor makes the browser fire `blur` on it. That blur is no
    // one leaving the editor: taken for one, it closed the editor the instant it opened —
    // React mounts an effect twice in development — and saved the text a second time on
    // every ordinary close.
    let destroyed = false
    const editor = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          markdown(),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.contentAttributes.of({ 'aria-label': label }),
          placeholderExtension(placeholder ?? 'Écrire en Markdown…'),
          keymap.of([...keys, ...historyKeymap, indentWithTab, ...defaultKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onChange(update.state.doc.toString())
          }),
          EditorView.domEventHandlers({
            blur: () => {
              if (!destroyed) latest.current.onBlur?.()
              return false
            },
          }),
        ],
      }),
      parent: host.current,
    })
    view.current = editor
    if (autoFocus) {
      editor.focus()
      editor.dispatch({ selection: EditorSelection.cursor(editor.state.doc.length) })
    }
    return () => {
      destroyed = true
      editor.destroy()
      view.current = null
    }
  }, [])

  // A value set from outside — the row read back after a save. Guarded on inequality, or
  // every keystroke would echo back and reset the caret.
  useEffect(() => {
    const editor = view.current
    if (editor === null) return
    const current = editor.state.doc.toString()
    if (current === value) return
    editor.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  return (
    <div className={cn('overflow-hidden rounded-md border bg-background', className)}>
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.keys === undefined ? action.label : `${action.label} (${action.keys})`}
            aria-label={action.label}
            disabled={readOnly || mode === 'preview'}
            // The editor keeps its selection: a mousedown on the toolbar would take it away.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => view.current !== null && action.run(view.current)}
            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-40"
          >
            <action.icon className="size-3.5" />
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex rounded-md bg-background p-0.5 text-xs">
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMode(m)}
              className={cn(
                'rounded px-2 py-0.5',
                mode === m ? 'bg-muted font-medium' : 'text-muted-foreground',
              )}
            >
              {m === 'write' ? 'Écrire' : 'Aperçu'}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={host}
        className={cn('scroll-discret overflow-y-auto', mode === 'preview' && 'hidden')}
        style={{ minHeight, maxHeight: minHeight * 2 }}
      />
      {mode === 'preview' && (
        <div
          className="scroll-discret overflow-y-auto px-3 py-2.5"
          style={{ minHeight, maxHeight: minHeight * 2 }}
        >
          {value.trim() === '' ? (
            <p className="text-sm text-muted-foreground">Rien à afficher.</p>
          ) : (
            <MarkdownView source={value} />
          )}
        </div>
      )}
    </div>
  )
}

// ── In the grid ──────────────────────────────────────────────────────────────────────

/**
 * A long-text cell: one line of what it says, the whole text rendered on hover, and a
 * Markdown editor opened over the cell by a double click — saved with Ctrl+Entrée, the
 * button, or a click elsewhere; Échap leaves it as it was.
 */
export function LongTextCell({
  value,
  label,
  readOnly,
  editing,
  emphasis,
  onStartEdit,
  onEndEdit,
  onCommit,
}: {
  readonly value: unknown
  readonly label: string
  readonly readOnly: boolean
  readonly editing: boolean
  readonly emphasis: boolean
  readonly onStartEdit: () => void
  readonly onEndEdit: () => void
  readonly onCommit: (value: string | null) => Promise<void>
}) {
  const initial = typeof value === 'string' ? value : ''
  const [draft, setDraft] = useState(initial)
  const done = useRef(false)

  useEffect(() => {
    if (!editing) return
    setDraft(initial)
    done.current = false
  }, [editing, initial])

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    onEndEdit()
    if (save && draft !== initial) void onCommit(draft.trim() === '' ? null : draft)
  }

  const excerpt = markdownExcerpt(initial)
  const shown = (
    <button
      type="button"
      tabIndex={-1}
      onDoubleClick={() => {
        if (!readOnly) onStartEdit()
      }}
      className={cn(
        'w-full truncate px-2 text-left',
        emphasis && 'font-medium',
        excerpt === '' && 'text-muted-foreground',
      )}
    >
      {excerpt === '' ? '—' : excerpt}
    </button>
  )

  return (
    <Popover open={editing} onOpenChange={() => undefined}>
      <PopoverAnchor asChild>
        {editing || initial.trim() === '' ? (
          shown
        ) : (
          <Tooltip delayDuration={450}>
            <TooltipTrigger asChild>{shown}</TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="max-h-80 max-w-md overflow-hidden border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg"
            >
              <MarkdownView source={initial} className="text-xs" />
            </TooltipContent>
          </Tooltip>
        )}
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={-32}
        className="w-[min(40rem,90vw)] p-2"
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          finish(false)
        }}
        onInteractOutside={() => finish(true)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          onSubmit={() => finish(true)}
          onCancel={() => finish(false)}
          autoFocus
          minHeight={180}
          label={label}
        />
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Markdown · Ctrl+Entrée pour enregistrer · Échap pour annuler
          </p>
          <Button variant="ghost" size="sm" onClick={() => finish(false)}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => finish(true)}>
            Enregistrer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Addresses ────────────────────────────────────────────────────────────────────────

const SAFE_URL = /^(https?:\/\/|mailto:)/i

/** How an address reads in a cell: its host and path, without the scheme. */
export function urlLabel(url: string): string {
  return url
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/\/$/, '')
}

/** A `url` field's value, as a link that opens in a new tab — only for a safe scheme. */
export function UrlLink({ url, className }: { readonly url: string; readonly className?: string }) {
  if (!SAFE_URL.test(url)) return <span className={className}>{url}</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={url}
      onClick={(e) => e.stopPropagation()}
      className={cn('truncate text-primary underline-offset-2 hover:underline', className)}
    >
      {urlLabel(url)}
    </a>
  )
}
