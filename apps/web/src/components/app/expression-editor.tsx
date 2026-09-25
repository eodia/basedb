'use client'

import type { Field } from '@/lib/api/client'
import {
  KEYWORDS,
  LIST_OPERATORS,
  VALUELESS,
  check,
  flatten,
  format,
  tokenize,
} from '@/lib/expression'
import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { type Diagnostic, lintGutter, linter } from '@codemirror/lint'
import { Compartment, EditorState } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
  placeholder as placeholderExtension,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'

/**
 * The expression editor — chapter 08 §4, with the ergonomics of a code editor.
 *
 * What it is NOT is as important as what it is. It does not execute SQL, and the product
 * has no route that does: chapter 09 §1 refuses `execute_sql` "même en lecture seule",
 * because arbitrary SQL bypasses the field-by-field filtering, makes the log
 * uninterpretable — one no longer knows what was read — and forbids any volume bound.
 * Chapter 10 says the same from the other side: no adapter holds anything able to run a
 * SQL string.
 *
 * So this edits the CLOSED grammar the kernel does parse — thirteen operators, `and`,
 * `or`, `not`, link paths — and gives it what makes a language comfortable: colouring,
 * completion drawn from the catalog, inline refusals, and a formatter. The grammar is
 * smaller than SQL; the help around it does not have to be.
 */

interface Props {
  readonly value: string
  readonly fields: readonly Field[]
  readonly placeholder?: string
  readonly onChange: (value: string) => void
  /** Ctrl+Entrée. The editor never runs anything itself. */
  readonly onRun: () => void
  /** Refusal returned by the kernel for the last run, shown under the gutter. */
  readonly serverError?: string | null
}

// ── Colouring ────────────────────────────────────────────────────────────────
//
// Decorations rather than a Lezer grammar. The language is a dozen productions and its
// tokenizer already exists — writing a parser a second time in another formalism would
// buy incremental re-parsing this editor will never need at three lines of input.

const MARKS: Record<string, Decoration> = {
  field: Decoration.mark({ class: 'cm-bdb-field' }),
  operator: Decoration.mark({ class: 'cm-bdb-operator' }),
  keyword: Decoration.mark({ class: 'cm-bdb-keyword' }),
  string: Decoration.mark({ class: 'cm-bdb-string' }),
  number: Decoration.mark({ class: 'cm-bdb-number' }),
  punctuation: Decoration.mark({ class: 'cm-bdb-punctuation' }),
}

const highlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view)
    }

    build(view: EditorView): DecorationSet {
      const text = view.state.doc.toString()
      const marks = []
      for (const token of tokenize(text)) {
        const mark = MARKS[token.kind]
        if (mark === undefined || token.from === token.to) continue
        marks.push(mark.range(token.from, token.to))
      }
      return Decoration.set(marks)
    }
  },
  { decorations: (v) => v.decorations },
)

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    padding: '10px 12px',
    caretColor: 'var(--foreground)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'color-mix(in oklab, var(--muted-foreground) 60%, transparent)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
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
  '.cm-bdb-field': { color: 'var(--foreground)', fontWeight: '500' },
  '.cm-bdb-operator': { color: 'var(--primary)' },
  '.cm-bdb-keyword': { color: 'var(--primary)', fontWeight: '600' },
  // Not green, and not near it: the accent is green now, so operators and keywords carry
  // that hue. A green string beside a green operator would make the two indistinguishable
  // at a glance, which is the one thing syntax colour exists to prevent.
  '.cm-bdb-string': { color: 'oklch(0.55 0.14 35)' },
  '.cm-bdb-number': { color: 'oklch(0.52 0.15 265)' },
  '.cm-bdb-punctuation': { color: 'var(--muted-foreground)' },
})

// ── Completion ───────────────────────────────────────────────────────────────

/**
 * Suggests by POSITION in the grammar, never a flat dictionary.
 *
 * After a field, the operators ITS TYPE declares — read from `/meta`, so exactly those
 * and no others (chapter 11 §1.3). After an operator, the values that make sense: the
 * choices of a `select`, `true`/`false` for a boolean, today's date for a date. At the
 * start of a predicate, the fields.
 *
 * Suggesting an operator a type does not accept would be teaching a refusal.
 */
function completions(fields: readonly Field[]) {
  const byName = new Map(fields.map((f) => [f.name, f]))

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]*/)
    if (word === null) return null
    if (word.from === word.to && !context.explicit) return null

    const before = context.state.doc.sliceString(0, word.from)
    const tokens = tokenize(before)
    const last = tokens[tokens.length - 1]

    // ── after an operator: values ──
    if (last?.kind === 'operator') {
      const field = fieldOf(tokens, byName)
      const operator = last.text.toLowerCase()
      if (field === null || VALUELESS.has(operator)) return null

      const options: Completion[] = []
      if (field.kind === 'boolean') {
        options.push(
          { label: 'true', type: 'constant', detail: 'vrai' },
          { label: 'false', type: 'constant', detail: 'faux' },
        )
      } else if (
        (field.kind === 'select' || field.kind === 'multi_select') &&
        field.options !== undefined
      ) {
        for (const option of field.options) {
          options.push({
            label: `"${option.value}"`,
            type: 'enum',
            detail: option.label,
          })
        }
      } else if (field.kind === 'date' || field.kind === 'datetime') {
        const today = new Date().toISOString().slice(0, 10)
        options.push({ label: today, type: 'constant', detail: "aujourd'hui" })
      }

      if (LIST_OPERATORS.has(operator)) {
        options.unshift({
          label: '[]',
          type: 'keyword',
          detail: operator === 'between' ? 'deux bornes' : 'liste de valeurs',
          apply: (view, _completion, from, to) => {
            view.dispatch({
              changes: { from, to, insert: '[]' },
              selection: { anchor: from + 1 },
            })
          },
        })
      }

      return options.length === 0 ? null : { from: word.from, options }
    }

    // ── after a field: its operators ──
    if (last?.kind === 'field') {
      const field = byName.get(last.text)
      const operators = field?.operators
      if (operators !== undefined && operators.length > 0) {
        return {
          from: word.from,
          options: operators.map((operator) => ({
            label: operator,
            type: 'method',
            detail: OPERATOR_HELP[operator] ?? '',
            boost: operator === 'eq' ? 1 : 0,
          })),
        }
      }
      return null
    }

    // ── otherwise: fields, and the combinators ──
    const options: Completion[] = fields.map((field) => ({
      label: field.name,
      type: 'variable',
      detail: `${field.label} · ${field.kind}`,
      // Business fields before system ones: `_created_at` is useful and rarely what
      // someone is reaching for first.
      boost: field.system === true ? -1 : 0,
    }))

    // A link column opens a path of depth one onto the target's own columns. The
    // completion cannot list them — they belong to the target's mask, which only the
    // kernel knows — so it offers the dot and says what follows.
    for (const field of fields) {
      if (field.kind !== 'link' || field.link?.target === undefined) continue
      options.push({
        label: `${field.name}.`,
        type: 'namespace',
        detail: `chemin vers ${field.link.target}`,
      })
    }

    if (tokens.length > 0) {
      for (const keyword of KEYWORDS) {
        options.push({ label: keyword, type: 'keyword', detail: 'combinateur' })
      }
    }

    return { from: word.from, options }
  }
}

/** Walks back to the field the current predicate names. */
function fieldOf(
  tokens: ReturnType<typeof tokenize>,
  byName: ReadonlyMap<string, Field>,
): Field | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token?.kind === 'field') return byName.get(token.text) ?? null
  }
  return null
}

const OPERATOR_HELP: Readonly<Record<string, string>> = {
  eq: 'égal',
  ne: 'différent',
  eq_ci: 'égal, casse ignorée',
  contains: 'contient',
  starts_with: 'commence par',
  ends_with: 'finit par',
  in: 'parmi une liste',
  is_null: 'non renseigné',
  gt: 'supérieur à',
  gte: 'supérieur ou égal',
  lt: 'inférieur à',
  lte: 'inférieur ou égal',
  between: 'entre deux bornes',
  has_any: 'contient au moins une des valeurs',
  has_all: 'contient toutes les valeurs',
}

// ── The component ────────────────────────────────────────────────────────────

export function ExpressionEditor({
  value,
  fields,
  placeholder,
  onChange,
  onRun,
  serverError,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const language = useRef(new Compartment())

  // The callbacks are held in refs so that changing one does not tear the editor down
  // and rebuild it — which would lose the cursor, the undo history and the open
  // completion popup on every parent render.
  const latest = useRef({ onChange, onRun, fields, serverError })
  latest.current = { onChange, onRun, fields, serverError }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounted once on purpose — the fields travel through the compartment below, the callbacks through the ref above, and the document through the effect after that. Rebuilding the editor on any of them would drop the cursor, the undo history and the open completion popup.
  useEffect(() => {
    if (host.current === null) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        closeBrackets(),
        highlighter,
        theme,
        lintGutter(),
        EditorView.lineWrapping,
        placeholderExtension(placeholder ?? 'montant gt 100 and payee eq false'),
        language.current.of([
          autocompletion({ activateOnTyping: true, icons: true, override: [completions(fields)] }),
          linter((v) => diagnosticsFor(v, latest.current.fields, latest.current.serverError)),
        ]),
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
              latest.current.onRun()
              return true
            },
          },
          {
            // The formatter, on the key every editor uses for it.
            key: 'Shift-Alt-f',
            preventDefault: true,
            run: (v) => {
              const formatted = format(v.state.doc.toString())
              if (formatted === v.state.doc.toString()) return true
              v.dispatch({
                changes: { from: 0, to: v.state.doc.length, insert: formatted },
              })
              return true
            },
          },
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latest.current.onChange(update.state.doc.toString())
        }),
      ],
    })

    const editor = new EditorView({ state, parent: host.current })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
    // Mounted once. The fields go through the compartment below, the callbacks through
    // the ref above, and the document through the effect after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The catalog changed — another table was opened, a column was added. The completion
  // source and the linter are swapped IN PLACE, through the compartment.
  useEffect(() => {
    const editor = view.current
    if (editor === null) return
    editor.dispatch({
      effects: language.current.reconfigure([
        autocompletion({ activateOnTyping: true, icons: true, override: [completions(fields)] }),
        linter((v) => diagnosticsFor(v, latest.current.fields, latest.current.serverError)),
      ]),
    })
  }, [fields])

  // The value changed from OUTSIDE — the copilot wrote one, a header menu added a
  // predicate. Guarded on inequality: echoing back every keystroke would reset the
  // cursor to the end of the line as one types.
  useEffect(() => {
    const editor = view.current
    if (editor === null) return
    const current = editor.state.doc.toString()
    if (current === value) return
    editor.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  return <div ref={host} className="min-h-0 flex-1 overflow-auto scroll-discret" />
}

function diagnosticsFor(
  view: EditorView,
  fields: readonly Field[],
  serverError: string | null | undefined,
): Diagnostic[] {
  const text = view.state.doc.toString()
  const diagnostics: Diagnostic[] = check(text, fields).map((problem) => ({
    from: Math.min(problem.from, text.length),
    to: Math.min(problem.to, text.length),
    severity: problem.severity,
    message: problem.message,
  }))

  // The kernel's refusal is shown on the whole line rather than guessed at a position:
  // the server tells us what it refused, not where, and inventing a range would point
  // at the wrong token as often as at the right one.
  if (serverError !== null && serverError !== undefined && serverError !== '') {
    diagnostics.push({
      from: 0,
      to: text.length,
      severity: 'error',
      message: serverError,
      source: 'noyau',
    })
  }

  return diagnostics
}

/** Re-exported so the toolbar button and the shortcut stay the same code. */
export { format, flatten }
