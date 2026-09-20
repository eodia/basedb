'use client'

import type { DescribedBase } from '@/lib/api/client'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { PostgreSQL, type SQLNamespace, sql } from '@codemirror/lang-sql'
import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { HighlightStyle } from '@codemirror/language'
import { type Diagnostic, lintGutter, linter } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

/**
 * The SQL editor.
 *
 * It edits statements that really run, against the base's own schema, through the one
 * kernel operation that takes a SQL string. The product's architecture argues against
 * that surface existing at all — chapter 09 §1, chapter 10 §2.2 — and it exists by the
 * owner's decision; this component is where that decision meets a keyboard.
 *
 * What it brings over a textarea is what makes SQL bearable: the schema in the
 * completion list, so nobody has to remember `b_t4z56fq_demo.factures`; the formatter;
 * the PostgreSQL dialect's own keywords; and `Ctrl+Entrée` running the SELECTION when
 * there is one, which is how a console is actually used — a buffer of ten statements,
 * one of them highlighted.
 */

interface Props {
  readonly value: string
  /** The catalog, turned into a completion namespace. */
  readonly base: DescribedBase
  readonly placeholder?: string
  readonly onChange: (value: string) => void
  /** Ctrl+Entrée. Receives the selection when there is one, the whole buffer otherwise. */
  readonly onRun: (statement: string) => void
  /** The server's refusal for the last run, with its character position when it gave one. */
  readonly serverError?: { message: string; position: number | null } | null
  /**
   * Hands the toolbar a way in.
   *
   * The formatter is a keymap entry; a button above the editor needs to reach the same
   * code without the parent holding a `EditorView`, which would leak the editor's
   * internals into a component that has no business with them.
   */
  readonly onReady?: (api: { format: () => void }) => void
}

/**
 * The completion namespace, built from `/meta/bases`.
 *
 * Both spellings are registered for every table: the QUALIFIED one, which is what a
 * statement needs since the connection's `search_path` is the base's schema and nothing
 * more; and the bare one, which is what a person types. Registering only the qualified
 * form would make completion useless the moment someone starts with the table name.
 */
function namespaceOf(base: DescribedBase): SQLNamespace {
  const namespace: Record<string, SQLNamespace> = {}
  const tables: Record<string, SQLNamespace> = {}

  for (const table of base.tables) {
    const columns = table.fields.map((field) => ({
      label: field.name,
      type: 'property',
      detail: `${field.label} · ${field.kind}`,
    }))
    tables[table.name] = { self: { label: table.name, type: 'table' }, children: columns }
  }

  namespace[base.name] = { self: { label: base.name, type: 'type' }, children: tables }
  return { ...namespace, ...tables }
}

/**
 * Syntax colours, mapped onto the product's tokens rather than a packaged theme.
 *
 * `oneDark` would be a second palette living beside `globals.css`, right when the
 * accent has just moved from teal to green — the kind of thing that drifts.
 */
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--primary)', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: 'oklch(0.55 0.14 35)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'oklch(0.52 0.15 265)' },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: 'var(--muted-foreground)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.function(tags.variableName), tags.standard(tags.variableName)],
    color: 'oklch(0.55 0.13 300)',
  },
  { tag: tags.operator, color: 'var(--muted-foreground)' },
  { tag: tags.typeName, color: 'oklch(0.55 0.10 200)' },
])

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: 'transparent', height: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, monospace)', lineHeight: '1.6' },
  '.cm-content': { padding: '8px 0', caretColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'color-mix(in oklab, var(--muted-foreground) 55%, transparent)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--muted) 55%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--foreground)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklab, var(--primary) 22%, transparent)',
  },
  '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },
  '.cm-completionLabel': { fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
  '.cm-completionDetail': { fontStyle: 'normal', opacity: 0.6, marginLeft: '0.75rem' },
  '.cm-panels': { backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' },
})

/** The statement under the cursor: the selection if there is one, the buffer otherwise. */
export function statementOf(view: EditorView): string {
  const { from, to } = view.state.selection.main
  if (from !== to) return view.state.sliceDoc(from, to)
  return view.state.doc.toString()
}

export function SqlEditor({
  value,
  base,
  placeholder,
  onChange,
  onRun,
  serverError,
  onReady,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const language = useRef(new Compartment())

  const latest = useRef({ onChange, onRun, serverError })
  latest.current = { onChange, onRun, serverError }
  const ready = useRef(onReady)
  ready.current = onReady

  const dialect = () =>
    sql({
      dialect: PostgreSQL,
      schema: namespaceOf(base),
      // The base's schema is already the `search_path`, so bare table names resolve.
      // Telling the completion engine that makes it offer columns after `factures.`.
      defaultSchema: base.name,
      upperCaseKeywords: true,
    })

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounted once — the schema travels through the compartment below, the callbacks through the ref above, and the document through its own effect. Rebuilding the editor on any of them would drop the cursor, the undo history and the open completion popup.
  useEffect(() => {
    if (host.current === null) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        closeBrackets(),
        bracketMatching(),
        indentOnInput(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        search({ top: true }),
        syntaxHighlighting(highlight),
        theme,
        lintGutter(),
        EditorView.lineWrapping,
        placeholderExtension(placeholder ?? 'SELECT * FROM …'),
        language.current.of([
          dialect(),
          autocompletion({ activateOnTyping: true, icons: true }),
          linter(() => diagnosticsFor(latest.current.serverError)),
        ]),
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: (v) => {
              latest.current.onRun(statementOf(v))
              return true
            },
          },
          {
            key: 'Shift-Alt-f',
            preventDefault: true,
            run: (v) => {
              void formatInto(v)
              return true
            },
          },
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...historyKeymap,
          indentWithTab,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latest.current.onChange(update.state.doc.toString())
        }),
      ],
    })

    const editor = new EditorView({ state, parent: host.current })
    view.current = editor
    ready.current?.({ format: () => void formatInto(editor) })
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [])

  // The catalog changed — another base opened, a table added. Swapped in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `dialect` closes over `base`, which is the dependency that matters here.
  useEffect(() => {
    const editor = view.current
    if (editor === null) return
    editor.dispatch({
      effects: language.current.reconfigure([
        dialect(),
        autocompletion({ activateOnTyping: true, icons: true }),
        linter(() => diagnosticsFor(latest.current.serverError)),
      ]),
    })
  }, [base])

  // A value set from OUTSIDE — a statement dropped in from the schema browser. Guarded
  // on inequality, or every keystroke would echo back and reset the caret.
  useEffect(() => {
    const editor = view.current
    if (editor === null) return
    const current = editor.state.doc.toString()
    if (current === value) return
    editor.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  return <div ref={host} className="scroll-discret min-h-0 flex-1 overflow-auto" />
}

/**
 * Lays the statement out, with `sql-formatter`.
 *
 * Loaded on demand: it is a hundred kilobytes of dialect tables that nobody needs until
 * they press the key, and the editor should open without them.
 *
 * It formats the SELECTION when there is one — the same rule as running — so one
 * statement can be tidied without reflowing the nine around it.
 */
async function formatInto(view: EditorView): Promise<void> {
  const { from, to } = view.state.selection.main
  const whole = from === to
  const source = whole ? view.state.doc.toString() : view.state.sliceDoc(from, to)
  if (source.trim() === '') return

  try {
    const { format } = await import('sql-formatter')
    const formatted = format(source, { language: 'postgresql', tabWidth: 2, keywordCase: 'upper' })
    if (formatted === source) return
    view.dispatch({
      changes: {
        from: whole ? 0 : from,
        to: whole ? view.state.doc.length : to,
        insert: formatted,
      },
      selection: EditorSelection.cursor((whole ? 0 : from) + formatted.length),
    })
  } catch {
    // A statement the formatter cannot parse is left exactly as typed. Reformatting on a
    // guess would be worse than not reformatting.
  }
}

/**
 * The server's refusal, placed on the character PostgreSQL pointed at.
 *
 * `position` is a 1-based character offset into the statement, which is what
 * `ERROR: syntax error at or near "…"` carries. Putting the marker there is the whole
 * value of surfacing the raw message: it says *where*.
 */
function diagnosticsFor(
  error: { message: string; position: number | null } | null | undefined,
): Diagnostic[] {
  if (error === null || error === undefined) return []
  const at = error.position === null ? 0 : Math.max(0, error.position - 1)
  return [{ from: at, to: at + 1, severity: 'error', message: error.message, source: 'postgres' }]
}
