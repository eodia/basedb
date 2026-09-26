'use client'

import { FieldIcon, KindLabel } from '@/components/app/field-icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError, type DescribedBase, type Field, type Table, api } from '@/lib/api/client'
import {
  type Cell,
  DELIMITERS,
  ImportError,
  type Kind,
  type ParsedTable,
  chunk,
  convert,
  inferKind,
  isImportable,
  labelFromFileName,
  matchColumns,
  parseText,
} from '@/lib/import'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowLeft, Check, FileText, Loader2, Upload } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Importing a file into a table — or into a table it creates.
 *
 * The file is read and converted HERE, in the browser, and what reaches the API is rows
 * already shaped like the columns they go into. That is where a mistake is cheap to show —
 * « ligne 41, colonne Montant : nombre invalide » — and not a refused batch of a thousand.
 *
 * Three steps, none skippable: the file (what was read, and how), the destination (an
 * existing table, whose fields the columns are matched to, or a new one, whose fields are
 * inferred and shown for correction), then the import itself, in batches of 500.
 *
 * Each batch is all or nothing (chapter 08 §3.5), but the import is a SEQUENCE of them, and
 * the screen says so honestly: when batch 3 fails, batches 1 and 2 are in the table, and the
 * refusal says how many rows went through and which file row stopped it. Pretending the
 * whole import was atomic would leave people to guess what state their table is in.
 */

const MAX_BYTES = 20 * 1024 * 1024
const MAX_ROWS = 50_000
const BATCH = 500
const SKIP = '__skip__'
const NEW_KINDS: readonly Kind[] = [
  'short_text',
  'long_text',
  'url',
  'number',
  'boolean',
  'date',
  'datetime',
]

export interface ImportResult {
  readonly table: { readonly base: string; readonly name: string; readonly label: string }
  readonly createdTable: boolean
  readonly created: number
}

interface Props {
  readonly open: boolean
  readonly base: DescribedBase
  /** The table the person aimed at, or none: then a new one is proposed. */
  readonly initial: Table | null
  readonly onClose: () => void
  readonly onImported: (result: ImportResult) => Promise<void>
}

type Step = 'file' | 'target' | 'run'

interface NewColumn {
  readonly include: boolean
  readonly label: string
  readonly kind: Kind
}

interface Problem {
  /** The row as a person counts it in the file, header included. */
  readonly row: number
  readonly column: string
  readonly value: string
  readonly reason: string
}

interface Run {
  readonly phase: 'running' | 'done' | 'failed'
  readonly done: number
  readonly total: number
  readonly error: string | null
  readonly tableLabel: string
  readonly tableName: string
}

const formatBytes = (n: number) =>
  n < 1024
    ? `${n} o`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} Ko`
      : `${(n / 1024 / 1024).toFixed(1)} Mo`

/** Windows-1252 is what a French spreadsheet exports when nobody asked for UTF-8. */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8
}

export function ImportDialog({ open, base, initial, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('file')
  const [file, setFile] = useState<{ name: string; size: number; text: string } | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [delimiter, setDelimiter] = useState<string | null>(null)

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [targetName, setTargetName] = useState('')
  const [mapping, setMapping] = useState<(string | null)[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newColumns, setNewColumns] = useState<NewColumn[]>([])
  const [acceptProblems, setAcceptProblems] = useState(false)

  const [run, setRun] = useState<Run | null>(null)
  const stop = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // What the dialog was opened ON is read when it opens, from here, and NOT through the
  // dependencies of the effect below. Importing into a new table refreshes the base, which
  // hands this dialog a new `base.tables`; an effect that depended on it would reset the
  // dialog in the middle of the import and wipe the screen that says it finished.
  const aimed = useRef({ initial, tables: base.tables })
  aimed.current = { initial, tables: base.tables }

  const reset = useCallback(() => {
    const { initial: aim, tables } = aimed.current
    setStep('file')
    setFile(null)
    setReadError(null)
    setHasHeader(true)
    setDelimiter(null)
    setMode(aim === null ? 'new' : 'existing')
    setTargetName(aim?.name ?? tables[0]?.name ?? '')
    setMapping([])
    setNewLabel('')
    setNewColumns([])
    setAcceptProblems(false)
    setRun(null)
    stop.current = false
  }, [])

  // A reopened dialog is an empty one: the file of the last import is not a suggestion.
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  // ── Step 1: the file ───────────────────────────────────────────────────────────────

  const parsed = useMemo<{ table: ParsedTable | null; error: string | null }>(() => {
    if (file === null) return { table: null, error: null }
    try {
      const table = parseText(file.name, file.text, {
        hasHeader,
        delimiter: delimiter ?? undefined,
      })
      if (table.rows.length > MAX_ROWS) {
        return {
          table: null,
          error: `${table.rows.length.toLocaleString('fr-FR')} lignes : ${MAX_ROWS.toLocaleString('fr-FR')} au maximum.`,
        }
      }
      return { table, error: null }
    } catch (e) {
      return { table: null, error: e instanceof ImportError ? e.message : 'Fichier illisible.' }
    }
  }, [file, hasHeader, delimiter])

  const table = parsed.table

  const pick = async (picked: File | undefined) => {
    if (picked === undefined) return
    setReadError(null)
    if (picked.size > MAX_BYTES) {
      setReadError(`Fichier trop volumineux (${formatBytes(MAX_BYTES)} au maximum).`)
      return
    }
    try {
      setFile({ name: picked.name, size: picked.size, text: await readText(picked) })
      setDelimiter(null)
    } catch {
      setReadError('Ce fichier ne peut pas être lu.')
    }
  }

  // ── Step 2: the destination ────────────────────────────────────────────────────────

  const target = base.tables.find((t) => t.name === targetName) ?? null
  const targetFields = useMemo(
    () => (target === null ? [] : target.fields.filter(isImportable)),
    [target],
  )

  // What the file suggests, computed when the person arrives at the step — not while they
  // choose a file, and not again when they come back, which would undo their corrections.
  const arrive = () => {
    if (table === null || file === null) return
    setMapping(matchColumns(table.columns, targetFields))
    setNewLabel((current) => (current === '' ? labelFromFileName(file.name) : current))
    setNewColumns(
      table.columns.map((column, i) => ({
        include: true,
        label: column,
        kind: inferKind(table.rows.map((r) => r[i])),
      })),
    )
    setAcceptProblems(false)
    setStep('target')
  }

  // Aiming at another table re-matches the columns: the old matches were for other fields.
  const aim = (name: string) => {
    setTargetName(name)
    const next = base.tables.find((t) => t.name === name)
    if (table !== null && next !== undefined) {
      setMapping(matchColumns(table.columns, next.fields.filter(isImportable)))
    }
    setAcceptProblems(false)
  }

  /**
   * Every row of the file as the record it would become, and every cell that would not go.
   * Keys are field names for an existing table and column indexes for a new one — the
   * real names do not exist until the table does.
   */
  const prepared = useMemo(() => {
    const problems: Problem[] = []
    const records: Record<string, unknown>[] = []
    const rowNumbers: number[] = []
    if (table === null) return { problems, records, rowNumbers, blank: 0 }

    const columns: Array<{ index: number; key: string; kind: string; field: Field | null }> = []
    if (mode === 'existing') {
      for (const [index, name] of mapping.entries()) {
        const field = targetFields.find((f) => f.name === name)
        if (field !== undefined) columns.push({ index, key: field.name, kind: field.kind, field })
      }
    } else {
      for (const [index, column] of newColumns.entries()) {
        if (column.include)
          columns.push({ index, key: String(index), kind: column.kind, field: null })
      }
    }

    let blank = 0
    const first = hasHeader ? 2 : 1
    for (const [rowIndex, row] of table.rows.entries()) {
      const record: Record<string, unknown> = {}
      for (const { index, key, kind, field } of columns) {
        const cell: Cell = row[index] ?? null
        const converted = convert(cell, kind, field?.options)
        if (!converted.ok) {
          problems.push({
            row: first + rowIndex,
            column: table.columns[index],
            value: String(cell),
            reason: converted.reason,
          })
        } else if (converted.value !== null) {
          record[key] = converted.value
        }
      }
      // A row with nothing in the mapped columns writes nothing: the API would refuse it.
      if (Object.keys(record).length === 0) blank++
      else {
        records.push(record)
        rowNumbers.push(first + rowIndex)
      }
    }
    return { problems, records, rowNumbers, blank }
  }, [table, mode, mapping, newColumns, targetFields, hasHeader])

  const requiredMissing = useMemo(() => {
    if (mode !== 'existing') return []
    const mapped = new Set(mapping.filter((m) => m !== null))
    return targetFields
      .filter((f) => f.required === true && !mapped.has(f.name))
      .map((f) => f.label)
  }, [mode, mapping, targetFields])

  const labelTaken =
    mode === 'new' &&
    base.tables.some((t) => t.label.trim().toLowerCase() === newLabel.trim().toLowerCase())
  const included = newColumns.filter((c) => c.include)
  const namesClash =
    mode === 'new' &&
    new Set(included.map((c) => c.label.trim().toLowerCase())).size !== included.length
  const anyEmptyName = mode === 'new' && included.some((c) => c.label.trim() === '')
  const mappedCount = mapping.filter((m) => m !== null).length

  const ready =
    prepared.records.length > 0 &&
    (prepared.problems.length === 0 || acceptProblems) &&
    (mode === 'existing'
      ? target !== null && mappedCount > 0
      : newLabel.trim() !== '' &&
        !labelTaken &&
        included.length > 0 &&
        !namesClash &&
        !anyEmptyName)

  // ── Step 3: the import ─────────────────────────────────────────────────────────────

  const start = async () => {
    if (!ready || table === null) return
    stop.current = false
    setStep('run')

    let destination = { base: base.name, name: target?.name ?? '' }
    let destinationLabel = target?.label ?? ''
    let records = prepared.records
    let createdTable = false
    let done = 0
    // What is on screen is what is true NOW: the counters are read when it is called, from
    // the variables the loop below moves, and never from the previous state.
    const show = (patch: Partial<Run> & Pick<Run, 'phase'>) =>
      setRun({
        done,
        total: records.length,
        error: null,
        tableLabel: destinationLabel,
        tableName: destination.name,
        ...patch,
      })

    setRun({
      phase: 'running',
      done: 0,
      total: records.length,
      error: null,
      tableLabel: destinationLabel,
      tableName: destination.name,
    })

    try {
      if (mode === 'new') {
        const created = await api.createTable(
          base.name,
          newLabel.trim(),
          included.map((c) => ({ label: c.label.trim(), kind: c.kind })),
        )
        createdTable = true
        destination = { base: base.name, name: created.name }
        destinationLabel = newLabel.trim()

        // Column indexes become the physical names the server chose, in creation order.
        const fresh = created.fields.filter((f) => f.system !== true)
        const indexes = newColumns.flatMap((c, i) => (c.include ? [i] : []))
        const nameOf = new Map(
          indexes.map((columnIndex, n) => [String(columnIndex), fresh[n]?.name] as const),
        )
        records = records.map((record) =>
          Object.fromEntries(
            Object.entries(record).map(([key, value]) => [nameOf.get(key) ?? key, value]),
          ),
        )
      }

      const batches = chunk(records, BATCH)
      for (const [k, part] of batches.entries()) {
        if (stop.current) {
          show({ phase: 'failed', error: 'Import interrompu.' })
          break
        }
        try {
          await api.createRecords(destination, part)
        } catch (e) {
          const index =
            e instanceof ApiError && typeof e.details.index === 'number' ? e.details.index : null
          const row = index === null ? null : prepared.rowNumbers[k * BATCH + index]
          const where = row === null ? '' : `Ligne ${row} du fichier : `
          const kept =
            done === 0
              ? 'Aucune ligne importée.'
              : `${done.toLocaleString('fr-FR')} ligne${done > 1 ? 's' : ''} importée${done > 1 ? 's' : ''}.`
          show({ phase: 'failed', error: `${where}${messageFor(e)} ${kept}` })
          break
        }
        done += part.length
        show({ phase: k === batches.length - 1 ? 'done' : 'running' })
      }
    } catch (e) {
      show({ phase: 'failed', error: messageFor(e) })
    }

    if (done > 0 || createdTable) {
      await onImported({
        table: { base: destination.base, name: destination.name, label: destinationLabel },
        createdTable,
        created: done,
      })
    }
  }

  const running = run?.phase === 'running'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !running && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Importer un fichier</DialogTitle>
        </DialogHeader>

        {step === 'file' && (
          <FileStep
            file={file}
            table={table}
            error={readError ?? parsed.error}
            hasHeader={hasHeader}
            delimiter={delimiter ?? table?.delimiter ?? ','}
            dragging={dragging}
            input={input}
            onPick={(f) => void pick(f)}
            onDragging={setDragging}
            onHasHeader={setHasHeader}
            onDelimiter={setDelimiter}
          />
        )}

        {step === 'target' && table !== null && (
          <div className="space-y-4">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">Destination</legend>
              {(
                [
                  ['existing', 'Une table existante', base.tables.length === 0],
                  ['new', 'Une nouvelle table', false],
                ] as const
              ).map(([value, label, disabled]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  disabled={disabled}
                  onClick={() => {
                    setMode(value)
                    setAcceptProblems(false)
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40',
                    mode === value ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-accent',
                  )}
                >
                  {label}
                </button>
              ))}
            </fieldset>

            {mode === 'existing' ? (
              <ExistingTarget
                base={base}
                target={target}
                fields={targetFields}
                table={table}
                mapping={mapping}
                requiredMissing={requiredMissing}
                onAim={aim}
                onMap={(index, name) => {
                  setMapping((m) => m.map((v, i) => (i === index ? name : v)))
                  setAcceptProblems(false)
                }}
              />
            ) : (
              <NewTarget
                table={table}
                label={newLabel}
                taken={labelTaken}
                columns={newColumns}
                clash={namesClash}
                onLabel={setNewLabel}
                onColumn={(index, patch) => {
                  setNewColumns((cols) =>
                    cols.map((c, i) => (i === index ? { ...c, ...patch } : c)),
                  )
                  setAcceptProblems(false)
                }}
              />
            )}

            <Summary
              records={prepared.records.length}
              blank={prepared.blank}
              problems={prepared.problems}
              accept={acceptProblems}
              onAccept={setAcceptProblems}
            />
          </div>
        )}

        {step === 'run' && run !== null && <RunStep run={run} />}

        <DialogFooter>
          {step === 'file' && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button disabled={table === null} onClick={arrive}>
                Suivant
              </Button>
            </>
          )}

          {step === 'target' && (
            <>
              <Button variant="ghost" onClick={() => setStep('file')}>
                <ArrowLeft className="size-4" />
                Retour
              </Button>
              <Button disabled={!ready} onClick={() => void start()}>
                <Upload className="size-4" />
                Importer {prepared.records.length.toLocaleString('fr-FR')} ligne
                {prepared.records.length > 1 ? 's' : ''}
              </Button>
            </>
          )}

          {step === 'run' && running && (
            <Button
              variant="outline"
              onClick={() => {
                stop.current = true
              }}
            >
              Interrompre
            </Button>
          )}
          {step === 'run' && !running && (
            <Button onClick={onClose}>{run?.phase === 'done' ? 'Terminé' : 'Fermer'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Step 1 ───────────────────────────────────────────────────────────────────────────

function FileStep({
  file,
  table,
  error,
  hasHeader,
  delimiter,
  dragging,
  input,
  onPick,
  onDragging,
  onHasHeader,
  onDelimiter,
}: {
  readonly file: { name: string; size: number } | null
  readonly table: ParsedTable | null
  readonly error: string | null
  readonly hasHeader: boolean
  readonly delimiter: string
  readonly dragging: boolean
  readonly input: RefObject<HTMLInputElement | null>
  readonly onPick: (file: File | undefined) => void
  readonly onDragging: (dragging: boolean) => void
  readonly onHasHeader: (value: boolean) => void
  readonly onDelimiter: (value: string) => void
}) {
  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          onDragging(true)
        }}
        onDragLeave={() => onDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          onDragging(false)
          onPick(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors hover:bg-accent/50',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">
          Déposez un fichier ici, ou cliquez pour le choisir
        </span>
        <span className="text-xs text-muted-foreground">
          CSV, TSV, TXT ou JSON — 20 Mo et 50 000 lignes au plus
        </span>
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,.json,.ndjson,.jsonl,text/csv,text/plain,application/json"
          className="sr-only"
          aria-label="Choisir un fichier"
          onChange={(e) => {
            onPick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>

      {error !== null && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {file !== null && table !== null && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatBytes(file.size)} · {table.rows.length.toLocaleString('fr-FR')} ligne
                {table.rows.length > 1 ? 's' : ''} · {table.columns.length} colonne
                {table.columns.length > 1 ? 's' : ''}
              </span>
            </span>

            <div className="flex items-center gap-2">
              <Checkbox
                id="import-header"
                checked={hasHeader}
                onCheckedChange={(c) => onHasHeader(c === true)}
              />
              <label htmlFor="import-header">La première ligne est l’en-tête</label>
            </div>

            {table.format === 'csv' && (
              <div className="flex items-center gap-2">
                <label htmlFor="import-delimiter">Séparateur</label>
                <Select value={delimiter} onValueChange={onDelimiter}>
                  <SelectTrigger id="import-delimiter" className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIMITERS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Preview table={table} />
        </>
      )}
    </div>
  )
}

function Preview({ table }: { readonly table: ParsedTable }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50">
          <tr>
            {table.columns.map((c) => (
              <th key={c} className="max-w-48 truncate whitespace-nowrap px-2.5 py-1.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 5).map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a preview of the first rows of a file — they have no identity but their place
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: the columns are positional
                  key={j}
                  className="max-w-48 truncate whitespace-nowrap px-2.5 py-1.5 text-muted-foreground"
                >
                  {cell === null ? '' : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 5 && (
        <p className="border-t px-2.5 py-1.5 text-xs text-muted-foreground">
          Les 5 premières lignes sur {table.rows.length.toLocaleString('fr-FR')}.
        </p>
      )}
    </div>
  )
}

// ── Step 2 ───────────────────────────────────────────────────────────────────────────

/** A few values of a column, so a name like « Colonne 3 » is not the only thing to go on. */
const sample = (table: ParsedTable, index: number) =>
  table.rows
    .map((r) => r[index])
    .filter((v): v is Exclude<Cell, null> => v !== null)
    .slice(0, 3)
    .join(' · ')

function ExistingTarget({
  base,
  target,
  fields,
  table,
  mapping,
  requiredMissing,
  onAim,
  onMap,
}: {
  readonly base: DescribedBase
  readonly target: Table | null
  readonly fields: readonly Field[]
  readonly table: ParsedTable
  readonly mapping: readonly (string | null)[]
  readonly requiredMissing: readonly string[]
  readonly onAim: (name: string) => void
  readonly onMap: (index: number, name: string | null) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Table</span>
        <Select value={target?.name ?? ''} onValueChange={onAim}>
          <SelectTrigger className="w-64" aria-label="Table de destination">
            <SelectValue placeholder="Choisir une table" />
          </SelectTrigger>
          <SelectContent>
            {base.tables.map((t) => (
              <SelectItem key={t.id} value={t.name}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="divide-y rounded-lg border">
        {table.columns.map((column, index) => (
          <li key={column} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{column}</p>
              <p className="truncate text-xs text-muted-foreground">
                {sample(table, index) || 'vide'}
              </p>
            </div>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <Select
              value={mapping[index] ?? SKIP}
              onValueChange={(value) => onMap(index, value === SKIP ? null : value)}
            >
              <SelectTrigger className="w-64" aria-label={`Champ pour la colonne ${column}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SKIP}>
                  <span className="text-muted-foreground">Ne pas importer</span>
                </SelectItem>
                {fields.map((f) => (
                  <SelectItem
                    key={f.name}
                    value={f.name}
                    // A field already fed by another column stays offered: choosing it moves
                    // the mapping, which is what a person correcting a wrong guess wants.
                  >
                    <span className="flex items-center gap-2">
                      <FieldIcon kind={f.kind} />
                      {f.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>

      {requiredMissing.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Champ{requiredMissing.length > 1 ? 's' : ''} obligatoire
          {requiredMissing.length > 1 ? 's' : ''} non associé
          {requiredMissing.length > 1 ? 's' : ''} : {requiredMissing.join(', ')}.
        </p>
      )}
    </div>
  )
}

function NewTarget({
  table,
  label,
  taken,
  columns,
  clash,
  onLabel,
  onColumn,
}: {
  readonly table: ParsedTable
  readonly label: string
  readonly taken: boolean
  readonly columns: readonly NewColumn[]
  readonly clash: boolean
  readonly onLabel: (label: string) => void
  readonly onColumn: (index: number, patch: Partial<NewColumn>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="import-new-label" className="text-sm text-muted-foreground">
          Libellé de la table
        </label>
        <Input
          id="import-new-label"
          value={label}
          onChange={(e) => onLabel(e.target.value)}
          aria-invalid={taken || undefined}
        />
        {taken && <p className="text-xs text-destructive">Une table porte déjà ce libellé.</p>}
      </div>

      <ul className="divide-y rounded-lg border">
        {table.columns.map((column, index) => {
          const c = columns[index]
          if (c === undefined) return null
          return (
            <li
              key={column}
              className={cn('flex items-center gap-3 px-3 py-2', !c.include && 'opacity-50')}
            >
              <Checkbox
                checked={c.include}
                onCheckedChange={(next) => onColumn(index, { include: next === true })}
                aria-label={`Importer la colonne ${column}`}
              />
              <div className="min-w-0 flex-1">
                <Input
                  value={c.label}
                  onChange={(e) => onColumn(index, { label: e.target.value })}
                  disabled={!c.include}
                  aria-label={`Libellé du champ pour la colonne ${column}`}
                  className="h-8"
                />
                <p className="mt-0.5 truncate px-1 text-xs text-muted-foreground">
                  {sample(table, index) || 'vide'}
                </p>
              </div>
              <Select
                value={c.kind}
                onValueChange={(kind) => onColumn(index, { kind: kind as Kind })}
                disabled={!c.include}
              >
                <SelectTrigger
                  className="w-44"
                  aria-label={`Type du champ pour la colonne ${column}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEW_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      <KindLabel kind={k} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          )
        })}
      </ul>

      {clash && (
        <p role="alert" className="text-xs text-destructive">
          Deux colonnes portent le même libellé de champ.
        </p>
      )}
    </div>
  )
}

function Summary({
  records,
  blank,
  problems,
  accept,
  onAccept,
}: {
  readonly records: number
  readonly blank: number
  readonly problems: readonly Problem[]
  readonly accept: boolean
  readonly onAccept: (accept: boolean) => void
}) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="font-medium">{records.toLocaleString('fr-FR')}</span> ligne
        {records > 1 ? 's' : ''} à importer
        {blank > 0 && (
          <span className="text-muted-foreground">
            {' '}
            · {blank.toLocaleString('fr-FR')} vide{blank > 1 ? 's' : ''} ignorée
            {blank > 1 ? 's' : ''}
          </span>
        )}
      </p>

      {problems.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {problems.length.toLocaleString('fr-FR')} cellule{problems.length > 1 ? 's' : ''}{' '}
            illisible
            {problems.length > 1 ? 's' : ''} pour le type du champ.
          </p>
          <ul className="space-y-0.5 pl-6 text-xs text-muted-foreground">
            {problems.slice(0, 5).map((p) => (
              <li key={`${p.row}:${p.column}`}>
                Ligne {p.row}, « {p.column} » : {p.reason} (« {p.value.slice(0, 40)} »)
              </li>
            ))}
            {problems.length > 5 && <li>… et {problems.length - 5} autres.</li>}
          </ul>
          <div className="flex items-center gap-2 pl-6">
            <Checkbox
              id="import-accept"
              checked={accept}
              onCheckedChange={(c) => onAccept(c === true)}
            />
            <label htmlFor="import-accept">
              Importer quand même, en laissant ces cellules vides
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 3 ───────────────────────────────────────────────────────────────────────────

function RunStep({ run }: { readonly run: Run }) {
  const percent = run.total === 0 ? 0 : Math.round((run.done / run.total) * 100)
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2 text-sm">
        {run.phase === 'running' && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        {run.phase === 'done' && <Check className="size-4 text-green-600" />}
        {run.phase === 'failed' && <AlertTriangle className="size-4 text-destructive" />}
        <span className="font-medium">
          {run.phase === 'running' && 'Import en cours…'}
          {run.phase === 'done' && 'Import terminé'}
          {run.phase === 'failed' && 'Import arrêté'}
        </span>
        <span className="text-muted-foreground">
          {run.done.toLocaleString('fr-FR')} / {run.total.toLocaleString('fr-FR')} lignes
          {run.tableLabel !== '' && <> dans « {run.tableLabel} »</>}
        </span>
      </div>

      <progress value={percent} max={100} className="sr-only">
        {percent} %
      </progress>
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full transition-[width]',
            run.phase === 'failed' ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {run.error !== null && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {run.error}
        </p>
      )}
    </div>
  )
}
