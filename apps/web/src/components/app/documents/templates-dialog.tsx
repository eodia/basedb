'use client'

import { RichTextEditor } from '@/components/app/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Choice } from '@/components/ui/choice'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  type DocumentBlock,
  type DocumentSpec,
  type DocumentTemplate,
  type Field,
  type Table,
  api,
} from '@/lib/api/client'
import { $t, LOCALES, LOCALE_NAMES, locale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  ArrowDown,
  ArrowUp,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Rows3,
  SeparatorHorizontal,
  Trash2,
  Type,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * The document templates of a table — chapter 21. A list on the left, the one chosen in
 * the middle, and beside it the PDF it makes of the row the editor was opened from —
 * unsaved changes included, set by the server as they would be once saved.
 *
 * A template is a page (its size and orientation), the language its values are written
 * in, a line at the foot of each page, and blocks: rich text citing the row's columns,
 * the row's fields, the rows linked to it as a table with its totals, a page break.
 */

type Draft = { readonly id: string | null; readonly label: string; readonly spec: DocumentSpec }

const NUMERIC = new Set(['number', 'count', 'autonumber'])
const numeric = (f: Field) =>
  NUMERIC.has(f.computed?.result_kind ?? f.kind) && f.computed?.multiple !== true
const shown = (fields: readonly Field[]) =>
  fields.filter((f) => f.system !== true && f.kind !== 'button')

function firstDraft(table: Table): Draft {
  const named =
    table.display_field ??
    table.fields.find((f) => f.kind === 'short_text' && f.system !== true)?.name
  return {
    id: null,
    label: $t('Nouveau modèle'),
    spec: {
      page: { size: 'A4', orientation: 'portrait' },
      locale: locale(),
      footer: '',
      blocks: [
        { kind: 'text', html: named === undefined ? '' : `<h1>{{${named}}}</h1>` },
        { kind: 'fields', fields: [] },
      ],
    },
  }
}

/** The relations a table block may list: links to this table, and its multiple links. */
function sourcesOf(table: Table, tables: readonly Table[]) {
  const out: Array<{
    value: string
    label: string
    table: Table
    source: Extract<DocumentBlock, { kind: 'rows' }>['source']
  }> = []
  for (const t of tables) {
    for (const f of t.fields) {
      if ((f.kind === 'link' || f.kind === 'multi_link') && f.link?.target === table.name) {
        out.push({
          value: `in:${t.id}:${f.name}`,
          label: $t('{table} — par « {field} »', { table: t.label, field: f.label }),
          table: t,
          source: { kind: 'incoming', table: t.id, field: f.name },
        })
      }
    }
  }
  for (const f of table.fields) {
    const target = tables.find((t) => t.name === f.link?.target)
    if (f.kind === 'multi_link' && target !== undefined) {
      out.push({
        value: `out:${f.name}`,
        label: $t('{table} — liées par « {field} »', { table: target.label, field: f.label }),
        table: target,
        source: { kind: 'outgoing', field: f.name },
      })
    }
  }
  return out
}

const sourceKey = (s: Extract<DocumentBlock, { kind: 'rows' }>['source']) =>
  s.kind === 'incoming' ? `in:${s.table}:${s.field}` : `out:${s.field}`

export function DocumentTemplatesDialog({
  open,
  table,
  tables,
  recordId,
  onClose,
}: {
  readonly open: boolean
  readonly table: Table
  readonly tables: readonly Table[]
  /** The row the preview is set on. */
  readonly recordId: string
  readonly onClose: () => void
}) {
  const [templates, setTemplates] = useState<readonly DocumentTemplate[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const previewUrl = useRef<string | null>(null)

  const choose = useCallback(
    (template: DocumentTemplate | null) => {
      setDraft(
        template === null || template.spec === undefined
          ? firstDraft(table)
          : { id: template.id, label: template.label, spec: template.spec },
      )
      setDirty(false)
      setConfirming(false)
      setError(null)
    },
    [table],
  )

  const load = useCallback(
    async (select?: string) => {
      const list = await api.documentTemplates(table)
      setTemplates(list)
      choose(list.find((t) => t.id === select) ?? list[0] ?? null)
    },
    [table, choose],
  )

  useEffect(() => {
    if (!open) return
    setPreview(null)
    load().catch((e) => setError(messageFor(e)))
  }, [open, load])

  useEffect(
    () => () => {
      if (previewUrl.current !== null) URL.revokeObjectURL(previewUrl.current)
    },
    [],
  )

  const change = (next: Partial<Draft> | ((d: Draft) => Draft)) => {
    setDraft((d) => (d === null ? d : typeof next === 'function' ? next(d) : { ...d, ...next }))
    setDirty(true)
  }
  const changeSpec = (next: Partial<DocumentSpec>) =>
    change((d) => ({ ...d, spec: { ...d.spec, ...next } }))
  const setBlock = (i: number, block: DocumentBlock) =>
    change((d) => ({
      ...d,
      spec: { ...d.spec, blocks: d.spec.blocks.map((b, j) => (j === i ? block : b)) },
    }))

  const sources = useMemo(() => sourcesOf(table, tables), [table, tables])

  const refresh = async () => {
    if (draft === null) return
    setPreviewing(true)
    setError(null)
    try {
      const blob = await api.documentPreview(table, recordId, {
        label: draft.label,
        spec: draft.spec,
      })
      if (previewUrl.current !== null) URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = URL.createObjectURL(blob)
      setPreview(previewUrl.current)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setPreviewing(false)
    }
  }

  // The preview follows the template chosen, once, without waiting for a click.
  const shownId = draft?.id ?? 'new'
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per template chosen, not per keystroke
  useEffect(() => {
    if (open && draft !== null) void refresh()
  }, [open, shownId])

  const save = async () => {
    if (draft === null) return
    setBusy(true)
    setError(null)
    try {
      const saved =
        draft.id === null
          ? await api.createDocumentTemplate(table, { label: draft.label, spec: draft.spec })
          : await api.updateDocumentTemplate(table, draft.id, {
              label: draft.label,
              spec: draft.spec,
            })
      await load(saved.id)
      await refresh()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (draft?.id === null || draft === null) return
    setBusy(true)
    try {
      await api.deleteDocumentTemplate(table, draft.id)
      await load()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const add = (block: DocumentBlock) =>
    change((d) => ({ ...d, spec: { ...d.spec, blocks: [...d.spec.blocks, block] } }))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex h-[88vh] max-w-[min(1400px,96vw)] flex-col gap-3 sm:max-w-[min(1400px,96vw)]">
        <DialogHeader>
          <DialogTitle>{$t('Modèles de document — {label}', { label: table.label })}</DialogTitle>
          <DialogDescription>
            {$t(
              'Une ligne devient un PDF : une facture, un devis, une fiche. Le texte cite les colonnes, un tableau liste les lignes liées. Chacun le lit avec ses droits : un champ qu’il ne voit pas n’y figure pas.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)_minmax(0,26rem)] gap-4">
          {/* The templates of the table. */}
          <nav className="min-h-0 space-y-1 overflow-y-auto scroll-discret">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  draft?.id === t.id && 'bg-accent font-medium',
                )}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => choose(null)}
            >
              <Plus className="size-4" />
              {$t('Nouveau modèle')}
            </Button>
          </nav>

          {/* The one chosen. */}
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1 scroll-discret">
            {draft !== null && (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_10rem]">
                  <Input
                    value={draft.label}
                    onChange={(e) => change({ label: e.target.value })}
                    aria-label={$t('Nom du modèle')}
                    className="h-9"
                  />
                  <Choice
                    value={draft.spec.page.size}
                    onValueChange={(size) =>
                      changeSpec({ page: { ...draft.spec.page, size: size as 'A4' | 'LETTER' } })
                    }
                    options={[
                      { value: 'A4', label: 'A4' },
                      { value: 'LETTER', label: 'Letter' },
                    ]}
                    aria-label={$t('Format de page')}
                    size="default"
                  />
                  <Choice
                    value={draft.spec.page.orientation}
                    onValueChange={(o) =>
                      changeSpec({
                        page: { ...draft.spec.page, orientation: o as 'portrait' | 'landscape' },
                      })
                    }
                    options={[
                      { value: 'portrait', label: $t('Portrait') },
                      { value: 'landscape', label: $t('Paysage') },
                    ]}
                    aria-label={$t('Orientation')}
                    size="default"
                  />
                  <Choice
                    value={draft.spec.locale}
                    onValueChange={(l) => changeSpec({ locale: l as DocumentSpec['locale'] })}
                    options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
                    aria-label={$t('Langue des valeurs')}
                    size="default"
                  />
                </div>

                <ol className="space-y-3">
                  {draft.spec.blocks.map((block, i) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no identity but their place, which the arrows change
                      key={i}
                      className="rounded-lg border"
                    >
                      <BlockHeader
                        block={block}
                        first={i === 0}
                        last={i === draft.spec.blocks.length - 1}
                        onMove={(by) =>
                          change((d) => {
                            const blocks = [...d.spec.blocks]
                            const [moved] = blocks.splice(i, 1)
                            blocks.splice(i + by, 0, moved as DocumentBlock)
                            return { ...d, spec: { ...d.spec, blocks } }
                          })
                        }
                        onRemove={() =>
                          change((d) => ({
                            ...d,
                            spec: { ...d.spec, blocks: d.spec.blocks.filter((_, j) => j !== i) },
                          }))
                        }
                      />
                      <div className="p-3">
                        <BlockBody
                          block={block}
                          table={table}
                          sources={sources}
                          onChange={(b) => setBlock(i, b)}
                        />
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => add({ kind: 'text', html: '' })}
                  >
                    <Type className="size-4" />
                    {$t('Texte')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => add({ kind: 'fields', fields: [] })}
                  >
                    <ListChecks className="size-4" />
                    {$t('Champs de la ligne')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sources.length === 0}
                    onClick={() => {
                      const first = sources[0]
                      if (first === undefined) return
                      add({
                        kind: 'rows',
                        title: first.table.label,
                        source: first.source,
                        columns: shown(first.table.fields)
                          .filter((f) => f.kind !== 'link' && f.kind !== 'multi_link')
                          .slice(0, 4)
                          .map((f) => f.name),
                        totals: [],
                      })
                    }}
                  >
                    <Rows3 className="size-4" />
                    {$t('Tableau des lignes liées')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => add({ kind: 'break' })}>
                    <SeparatorHorizontal className="size-4" />
                    {$t('Saut de page')}
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="document-footer" className="text-sm text-muted-foreground">
                    {$t('Pied de page')}
                  </label>
                  <Input
                    id="document-footer"
                    value={draft.spec.footer}
                    onChange={(e) => changeSpec({ footer: e.target.value })}
                    placeholder="SIRET 123 456 789 00012 — {{numero}}"
                    className="h-9"
                  />
                  <span className="block text-xs text-muted-foreground">
                    {$t(
                      'Sur chaque page, avec son numéro. Il cite une colonne comme un texte, son nom entre doubles accolades.',
                    )}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* What it makes of the row. */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-muted-foreground">
                {$t('Aperçu sur la ligne ouverte')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refresh()}
                disabled={previewing}
              >
                {previewing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {$t('Actualiser')}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
              {preview !== null ? (
                <iframe title={$t('Aperçu du document')} src={preview} className="size-full" />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                  {previewing ? <Loader2 className="size-5 animate-spin" /> : $t('Aucun aperçu')}
                </div>
              )}
            </div>
          </div>
        </div>

        {error !== null && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          {draft?.id !== null && draft !== null && (
            <Button
              variant={confirming ? 'destructive' : 'ghost'}
              onClick={() => (confirming ? void remove() : setConfirming(true))}
              disabled={busy}
            >
              <Trash2 className="size-4" />
              {confirming ? $t('Confirmer la suppression') : $t('Supprimer le modèle')}
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Fermer')}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={busy || draft === null || (!dirty && draft.id !== null)}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {$t('Enregistrer')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const BLOCK_LABELS: Readonly<Record<DocumentBlock['kind'], string>> = {
  text: $t('Texte'),
  fields: $t('Champs de la ligne'),
  rows: $t('Tableau des lignes liées'),
  break: $t('Saut de page'),
}

function BlockHeader({
  block,
  first,
  last,
  onMove,
  onRemove,
}: {
  readonly block: DocumentBlock
  readonly first: boolean
  readonly last: boolean
  readonly onMove: (by: -1 | 1) => void
  readonly onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1 border-b bg-muted/40 px-3 py-1.5">
      <span className="flex-1 text-xs font-medium text-muted-foreground">
        {BLOCK_LABELS[block.kind]}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={first}
        onClick={() => onMove(-1)}
        aria-label={$t('Monter')}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={last}
        onClick={() => onMove(1)}
        aria-label={$t('Descendre')}
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={$t('Retirer le bloc')}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

function Checks({
  fields,
  chosen,
  onChange,
  disabled,
}: {
  readonly fields: readonly Field[]
  readonly chosen: readonly string[]
  readonly onChange: (next: string[]) => void
  readonly disabled?: (f: Field) => boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {fields.map((f) => (
        <label
          key={f.name}
          htmlFor={`${id}-${f.name}`}
          className="flex items-center gap-1.5 text-sm"
        >
          <Checkbox
            id={`${id}-${f.name}`}
            checked={chosen.includes(f.name)}
            disabled={disabled?.(f) ?? false}
            onCheckedChange={(v) =>
              onChange(v === true ? [...chosen, f.name] : chosen.filter((n) => n !== f.name))
            }
          />
          {f.label}
        </label>
      ))}
    </div>
  )
}

function BlockBody({
  block,
  table,
  sources,
  onChange,
}: {
  readonly block: DocumentBlock
  readonly table: Table
  readonly sources: ReturnType<typeof sourcesOf>
  readonly onChange: (next: DocumentBlock) => void
}): ReactNode {
  switch (block.kind) {
    case 'text':
      return (
        <div className="rounded-md border">
          <RichTextEditor
            value={block.html}
            onChange={(html) => html !== block.html && onChange({ ...block, html })}
            fields={shown(table.fields)}
            placeholder={$t('Écrire, et citer une colonne avec le menu « Colonne »…')}
            contentClassName="min-h-24"
          />
        </div>
      )
    case 'fields':
      return (
        <div className="space-y-2">
          <Checks
            fields={shown(table.fields)}
            chosen={block.fields}
            onChange={(fields) => onChange({ ...block, fields })}
          />
          <p className="text-xs text-muted-foreground">
            {$t('Aucun coché : tous les champs que le lecteur peut lire, dans leur ordre.')}
          </p>
        </div>
      )
    case 'rows': {
      const found = sources.find((s) => s.value === sourceKey(block.source))
      const theirs = found === undefined ? [] : shown(found.table.fields)
      const columns = theirs.filter((f) => block.columns.includes(f.name))
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={block.title}
              onChange={(e) => onChange({ ...block, title: e.target.value })}
              placeholder={$t('Titre du tableau')}
              aria-label={$t('Titre du tableau')}
              className="h-9"
            />
            <Choice
              value={found?.value ?? null}
              onValueChange={(v) => {
                const next = sources.find((s) => s.value === v)
                if (next !== undefined)
                  onChange({ ...block, source: next.source, columns: [], totals: [] })
              }}
              options={sources.map((s) => ({ value: s.value, label: s.label }))}
              placeholder={$t('Lignes à lister')}
              aria-label={$t('Lignes à lister')}
              size="default"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{$t('Colonnes, dans cet ordre')}</span>
            <Checks
              fields={theirs}
              chosen={block.columns}
              onChange={(next) =>
                onChange({
                  ...block,
                  columns: theirs.map((f) => f.name).filter((n) => next.includes(n)),
                  totals: block.totals.filter((t) => next.includes(t)),
                })
              }
            />
          </div>
          {columns.some(numeric) && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{$t('Totaux sous le tableau')}</span>
              <Checks
                fields={columns.filter(numeric)}
                chosen={block.totals}
                onChange={(totals) => onChange({ ...block, totals })}
              />
            </div>
          )}
        </div>
      )
    }
    case 'break':
      return (
        <p className="text-xs text-muted-foreground">
          {$t('La suite commence sur une nouvelle page.')}
        </p>
      )
  }
}
