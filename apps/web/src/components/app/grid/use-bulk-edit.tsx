'use client'

import {
  CreateRowsDialog,
  type CreationAnswer,
  type FieldEdit,
  FieldEditDialog,
} from '@/components/app/grid/bulk-dialogs'
import {
  type Directories,
  type Ignored,
  type Plan,
  type RowLike,
  type Target,
  bulkWritable,
  enterFound,
  ignoredSummary,
  linkCandidates,
  linkDirectory,
  memberDirectory,
  parseClipboard,
  placements,
  planFill,
  planPaste,
  refsOf,
  targetsOf,
} from '@/components/app/grid/paste'
import type { SearchLink } from '@/components/app/pickers'
import {
  ApiError,
  type Field,
  type LinkOption,
  type Member,
  type TableRef,
  api,
} from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { fold } from '@/lib/import'
import { messageFor } from '@/lib/messages'
import { asOneStep, undo } from '@/lib/undo'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * Writing many cells at once from the grid — chapter 11 §2.4: a range pasted from a
 * spreadsheet, one value typed over a selection, a selection emptied, a field filled over
 * the rows ticked.
 *
 * Every one of them is the SAME act: a plan (`paste.ts`) of which rows get which values,
 * sent as ONE all-or-nothing batch of updates (chapter 08 §3.5) — and, for a paste that
 * overflows the table, a batch of creations before it. The two travel together as one
 * step of the undo journal, so that a single Ctrl+Z takes the whole gesture back.
 */

/** A batch carries a thousand rows at most (chapter 08 §3.6). */
export const BULK_MAX_ROWS = 1000

/** The searches a paste may make to find the rows its labels name. */
const LOOKUP_MAX = 500
const LOOKUP_PARALLEL = 6

interface Options {
  readonly table: TableRef | null
  /** The rows on screen, and the columns they are shown with. */
  readonly rows: readonly RowLike[]
  readonly fields: readonly Field[]
  /** Every field of the table, for « Modifier un champ… » to choose among. */
  readonly editableFields: readonly Field[]
  readonly canUpdate: boolean
  readonly canCreate: boolean
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  /** Reads the rows again — a value the database refused is never left on screen. */
  readonly reload: () => Promise<void>
  readonly onError: (message: string | null) => void
}

export interface BulkEdit {
  readonly canUpdate: boolean
  readonly busy: boolean
  /**
   * Pastes a clipboard text into the selected cells. `members` are the people of the
   * tenant, whom a person column names: the grid has them, this hook sits above them.
   */
  readonly paste: (
    cells: ReadonlySet<string>,
    text: string,
    members: readonly Member[],
  ) => Promise<void>
  /** Writes one value — as the API takes it — to every selected cell `active` fits. */
  readonly fill: (cells: ReadonlySet<string>, active: Field, value: unknown) => Promise<void>
  /** Empties the selected cells. */
  readonly clear: (cells: ReadonlySet<string>) => Promise<void>
  /** Opens the editor of `active`'s value for the selected cells. */
  readonly editCells: (cells: ReadonlySet<string>, active: Field) => void
  /** Opens « Modifier un champ » for the rows ticked. */
  readonly editRows: (ids: ReadonlySet<string>) => void
  /** The dialogs, to be rendered once beside the grid. */
  readonly dialogs: ReactNode
}

type Pending =
  | { readonly kind: 'cells'; readonly cells: ReadonlySet<string>; readonly active: Field }
  | { readonly kind: 'rows'; readonly ids: ReadonlySet<string> }

type How = 'paste' | 'fill' | 'clear' | 'rows'

const TITLES: Record<How, (n: number) => string> = {
  paste: (n) => $tp(n, '{count} cellule collée', '{count} cellules collées'),
  fill: (n) => $tp(n, '{count} cellule modifiée', '{count} cellules modifiées'),
  clear: (n) => $tp(n, '{count} cellule vidée', '{count} cellules vidées'),
  rows: (n) => $tp(n, '{count} ligne modifiée', '{count} lignes modifiées'),
}

/** The gesture, in the words of the undo toast: « Annulé : collage de 12 cellules ». */
const STEPS: Record<How, (n: number) => string> = {
  paste: (n) => $tp(n, 'collage de {count} cellule', 'collage de {count} cellules'),
  fill: (n) => $tp(n, 'modification de {count} cellule', 'modification de {count} cellules'),
  clear: (n) => $tp(n, 'effacement de {count} cellule', 'effacement de {count} cellules'),
  rows: (n) => $tp(n, 'modification de {count} ligne', 'modification de {count} lignes'),
}

const NOTHING: Record<How, () => string> = {
  paste: () => $t('Rien n’a pu être collé.'),
  fill: () => $t('Rien n’a pu être modifié.'),
  clear: () => $t('Rien n’a pu être vidé.'),
  rows: () => $t('Rien n’a pu être modifié.'),
}

/** What was left out, as the toast says it: the count, then the reasons, the most frequent first. */
function LeftOut({ ignored }: { readonly ignored: readonly Ignored[] }) {
  const reasons = ignoredSummary(ignored)
  return (
    <div className="space-y-1">
      <p>{$tp(ignored.length, '{count} cellule ignorée', '{count} cellules ignorées')}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-xs opacity-80">
        {reasons.slice(0, 4).map(({ label, reason, count }) => (
          <li key={`${label}|${reason}`}>
            {label === ''
              ? $t('{reason} ({count})', { reason, count })
              : $t('{label} : {reason} ({count})', { label, reason, count })}
          </li>
        ))}
        {reasons.length > 4 && <li>…</li>}
      </ul>
    </div>
  )
}

/** Runs `work` on every item, `parallel` at a time. */
async function inParallel<T>(
  items: readonly T[],
  parallel: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++] as T
      await work(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, items.length) }, lane))
}

export function useBulkEdit(options: Options): BulkEdit {
  // The latest screen, for callbacks that outlive a render: a paste awaits the network.
  const latest = useRef(options)
  latest.current = options
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [asking, setAsking] = useState<{
    readonly count: number
    readonly answer: (answer: CreationAnswer) => void
  } | null>(null)

  const ask = useCallback(
    (count: number) =>
      new Promise<CreationAnswer>((resolve) => {
        setAsking({
          count,
          answer: (answer) => {
            setAsking(null)
            resolve(answer)
          },
        })
      }),
    [],
  )

  /** The rows and the people the labels of the clipboard name, found before anything is planned. */
  const directoriesFor = useCallback(
    async (
      texts: ReadonlyArray<{ readonly field: Field | undefined; readonly text: string }>,
      members: readonly Member[],
    ) => {
      const { linkOptions } = latest.current
      const directories = new Map<string, Map<string, string | null>>()
      const wanted = new Map<string, { field: Field; labels: Set<string> }>()
      for (const { field, text } of texts) {
        if (field === undefined) continue
        if (field.kind === 'user') {
          directories.set(field.name, memberDirectory(members))
        } else if (field.kind === 'link' || field.kind === 'multi_link') {
          const entry = wanted.get(field.name) ?? { field, labels: new Set<string>() }
          for (const label of linkCandidates(text)) entry.labels.add(label)
          wanted.set(field.name, entry)
        }
      }

      let searches = 0
      for (const [name, { field, labels }] of wanted) {
        const directory = linkDirectory(linkOptions[name] ?? [])
        // The options loaded are the first rows of the target: the others are searched for.
        const missing = [...labels].filter((label) => !directory.has(fold(label)))
        const budget = missing.slice(0, Math.max(0, LOOKUP_MAX - searches))
        searches += budget.length
        await inParallel(budget, LOOKUP_PARALLEL, async (label) => {
          try {
            enterFound(directory, label, (await latest.current.onSearchLink(field, label)).options)
          } catch {
            // A search that failed finds nothing: the cell is reported as not found.
          }
        })
        directories.set(name, directory)
      }
      return directories as Directories
    },
    [],
  )

  const failure = useCallback((error: unknown, rows: readonly { rowIndex: number }[]) => {
    const { fields } = latest.current
    if (!(error instanceof ApiError)) return messageFor(error)
    const index = typeof error.details.index === 'number' ? error.details.index : null
    const row = index === null ? undefined : rows[index]
    const column =
      typeof error.details.field === 'string'
        ? (fields.find((f) => f.name === error.details.field)?.label ?? null)
        : null
    const where =
      row === undefined
        ? ''
        : column === null
          ? $t('Ligne {row} : ', { row: row.rowIndex + 1 })
          : $t('Ligne {row}, colonne {column} : ', { row: row.rowIndex + 1, column })
    return `${where}${messageFor(error)}`
  }, [])

  /** Sends a plan: the rows to create first, then the rows to change, as one step. */
  const execute = useCallback(
    async (plan: Plan, how: How) => {
      const o = latest.current
      if (o.table === null) return
      const table = o.table
      const ignored: Ignored[] = [...plan.ignored]
      let creations = plan.creations

      if (creations.length > 0) {
        const answer = o.canCreate ? await ask(creations.length) : 'skip'
        if (answer === 'cancel') return
        if (answer === 'skip') {
          for (const row of creations) {
            for (let i = 0; i < row.cells; i++) {
              ignored.push({
                rowIndex: row.rowIndex,
                field: null,
                reason: o.canCreate
                  ? $t('ligne non créée')
                  : $t('ligne inexistante : vous ne pouvez pas en créer'),
              })
            }
          }
          creations = []
        }
      }

      const updates = plan.updates
      const written = [...updates, ...creations].reduce((sum, row) => sum + row.cells, 0)
      if (updates.length === 0 && creations.length === 0) {
        toast.error(NOTHING[how](), {
          description: ignored.length === 0 ? undefined : <LeftOut ignored={ignored} />,
        })
        return
      }
      if (updates.length > BULK_MAX_ROWS || creations.length > BULK_MAX_ROWS) {
        o.onError($t('Une écriture porte sur {max} lignes au plus.', { max: BULK_MAX_ROWS }))
        return
      }

      busyRef.current = true
      setBusy(true)
      o.onError(null)
      let stage: 'create' | 'update' = 'create'
      let created = 0
      try {
        await asOneStep(STEPS[how](written), async () => {
          if (creations.length > 0) {
            await api.createRecords(
              table,
              creations.map((row) => row.values),
            )
            created = creations.length
          }
          stage = 'update'
          if (updates.length > 0) {
            await api.updateRecords(
              table,
              updates.map((row) => ({ id: row.id as string, values: row.values })),
            )
          }
        })
        toast.success(TITLES[how](written), {
          description: ignored.length === 0 ? undefined : <LeftOut ignored={ignored} />,
          action: {
            label: $t('Annuler||défaire la dernière écriture'),
            onClick: () => void undo(),
          },
        })
      } catch (error) {
        const message = failure(error, stage === 'create' ? creations : updates)
        const done =
          created > 0
            ? ` ${$tp(created, '{count} ligne a été créée : Ctrl+Z la retire.', '{count} lignes ont été créées : Ctrl+Z les retire.')}`
            : ` ${$t('Rien n’a été écrit.')}`
        o.onError(`${message}${done}`)
      } finally {
        busyRef.current = false
        setBusy(false)
        await o.reload()
      }
    },
    [ask, failure],
  )

  const unavailable = useCallback(() => {
    const o = latest.current
    if (o.table !== null && o.canUpdate) return false
    toast.error($t('Vous ne pouvez pas modifier les lignes de cette table.'))
    return true
  }, [])

  const paste = useCallback(
    async (cells: ReadonlySet<string>, text: string, members: readonly Member[]) => {
      if (busyRef.current || unavailable()) return
      const matrix = parseClipboard(text)
      if (matrix.length === 0) return
      const o = latest.current
      if (matrix.length > BULK_MAX_ROWS) {
        o.onError($t('Un collage porte sur {max} lignes au plus.', { max: BULK_MAX_ROWS }))
        return
      }
      const input = { matrix, fields: o.fields, selection: refsOf(cells) }
      const directories = await directoriesFor(placements(input), members)
      // Planned against the screen as it is NOW: the searches took a moment.
      const now = latest.current
      await execute(
        planPaste({ ...input, fields: now.fields, rows: now.rows, directories }),
        'paste',
      )
    },
    [directoriesFor, execute, unavailable],
  )

  const fill = useCallback(
    async (cells: ReadonlySet<string>, active: Field, value: unknown) => {
      if (busyRef.current || unavailable()) return
      const o = latest.current
      await execute(
        planFill(targetsOf(refsOf(cells), o.fields, o.rows), o.rows, value, active),
        'fill',
      )
    },
    [execute, unavailable],
  )

  const clear = useCallback(
    async (cells: ReadonlySet<string>) => {
      if (busyRef.current || unavailable()) return
      const o = latest.current
      await execute(
        planFill(targetsOf(refsOf(cells), o.fields, o.rows), o.rows, null, null),
        'clear',
      )
    },
    [execute, unavailable],
  )

  const editCells = useCallback(
    (cells: ReadonlySet<string>, active: Field) => {
      if (busyRef.current || unavailable()) return
      setPending({ kind: 'cells', cells, active })
    },
    [unavailable],
  )

  const editRows = useCallback(
    (ids: ReadonlySet<string>) => {
      if (busyRef.current || unavailable()) return
      setPending({ kind: 'rows', ids })
    },
    [unavailable],
  )

  /** The editor's answer: the value goes to the cells or the rows it was opened for. */
  const apply = useCallback(
    async (field: Field, value: unknown) => {
      const open = pending
      if (open === null) return
      setPending(null)
      const o = latest.current
      if (open.kind === 'cells') {
        await execute(
          planFill(targetsOf(refsOf(open.cells), o.fields, o.rows), o.rows, value, open.active),
          'fill',
        )
        return
      }
      const targets: Target[] = o.rows.flatMap((row, rowIndex) =>
        open.ids.has(row._id) ? [{ rowIndex, id: row._id, field }] : [],
      )
      await execute(planFill(targets, o.rows, value, null), 'rows')
    },
    [execute, pending],
  )

  const edit: FieldEdit | null = useMemo(() => {
    if (pending === null) return null
    return pending.kind === 'cells'
      ? { fixed: pending.active, unit: 'cells', count: pending.cells.size }
      : { fixed: null, unit: 'rows', count: pending.ids.size }
  }, [pending])

  const dialogs = (
    <>
      <FieldEditDialog
        edit={edit}
        fields={options.editableFields.filter(bulkWritable)}
        linkOptions={options.linkOptions}
        onSearchLink={options.onSearchLink}
        busy={busy}
        onApply={apply}
        onClose={() => setPending(null)}
      />
      <CreateRowsDialog count={asking?.count ?? null} onAnswer={(a) => asking?.answer(a)} />
    </>
  )

  return { canUpdate: options.canUpdate, busy, paste, fill, clear, editCells, editRows, dialogs }
}
