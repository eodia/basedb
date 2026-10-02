'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type DocumentBlock,
  type DocumentSpec,
  type DocumentTemplate,
  type Table,
  api,
} from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { arrayMove } from '@dnd-kit/sortable'
import { FileText, LayoutTemplate, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BlockPicker } from './block-picker'
import { BlockList } from './blocks'
import {
  type BlockKind,
  MAX_BLOCKS,
  complete,
  countBlocks,
  newBlock,
  sendable,
  sourcesOf,
} from './model'
import { HeaderFooterPanel, StylePanel } from './panels'
import { type PresetId, buildPreset, presets } from './presets'

/**
 * The document templates of a table — chapter 21. The templates on the left; the one
 * chosen in the middle — its blocks, its style and page, its header and footer —; and
 * beside it the PDF it makes of the row the editor was opened from, set again by the
 * server a moment after each change, unsaved changes included.
 *
 * A new template starts from a starting point — an invoice, a quote, a sheet, a
 * certificate — built from the table's own columns, or from a blank page.
 */

interface Draft {
  readonly id: string | null
  readonly label: string
  readonly spec: DocumentSpec
  /** One per block: what React and the drag know it by. */
  readonly keys: readonly string[]
}

const newKey = () => Math.random().toString(36).slice(2, 10)

const draftOf = (id: string | null, label: string, spec: DocumentSpec): Draft => ({
  id,
  label,
  spec,
  keys: spec.blocks.map(newKey),
})

type Tab = 'blocks' | 'style' | 'frame'

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
  /** `null`: the starting points are shown, to begin a new template. */
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [tab, setTab] = useState<Tab>('blocks')
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const [inserting, setInserting] = useState<number | null>(null)
  /** The block just added: brought into view. */
  const [added, setAdded] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewUrl = useRef<string | null>(null)
  const asked = useRef(0)

  const sources = useMemo(() => sourcesOf(table, tables), [table, tables])
  const ctx = useMemo(() => ({ table, sources }), [table, sources])

  const choose = useCallback((template: DocumentTemplate | null) => {
    setDraft(
      template === null ? null : draftOf(template.id, template.label, complete(template.spec)),
    )
    setDirty(false)
    setConfirming(false)
    setLeaving(false)
    setError(null)
    setOpened(new Set())
    setTab('blocks')
  }, [])

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

  const change = (next: (d: Draft) => Draft) => {
    setDraft((d) => (d === null ? d : next(d)))
    setDirty(true)
    setLeaving(false)
  }
  const changeSpec = (next: Partial<DocumentSpec>) =>
    change((d) => ({ ...d, spec: { ...d.spec, ...next } }))
  const setBlocks = (blocks: readonly DocumentBlock[], keys: readonly string[]) =>
    change((d) => ({ ...d, spec: { ...d.spec, blocks }, keys }))

  const refresh = useCallback(
    async (shown: Draft) => {
      const mine = ++asked.current
      setPreviewing(true)
      try {
        const blob = await api.documentPreview(table, recordId, {
          label: shown.label,
          spec: sendable(shown.spec),
        })
        if (mine !== asked.current) return
        if (previewUrl.current !== null) URL.revokeObjectURL(previewUrl.current)
        previewUrl.current = URL.createObjectURL(blob)
        // The page fitted to the width, without the viewer's column of thumbnails.
        setPreview(`${previewUrl.current}#navpanes=0&view=FitH`)
        setPreviewError(null)
      } catch (e) {
        if (mine === asked.current) setPreviewError(messageFor(e))
      } finally {
        if (mine === asked.current) setPreviewing(false)
      }
    },
    [table, recordId],
  )

  // The preview follows the draft: at once for a template chosen, a moment after the
  // last change otherwise — not at each keystroke.
  const shownId = draft?.id ?? 'new'
  const lastShown = useRef<string | null>(null)
  useEffect(() => {
    if (!open || draft === null) return
    const fresh = lastShown.current !== shownId
    lastShown.current = shownId
    const timer = setTimeout(() => void refresh(draft), fresh ? 0 : 700)
    return () => clearTimeout(timer)
  }, [open, draft, shownId, refresh])

  const save = async () => {
    if (draft === null) return
    setBusy(true)
    setError(null)
    try {
      const body = { label: draft.label, spec: sendable(draft.spec) }
      const saved =
        draft.id === null
          ? await api.createDocumentTemplate(table, body)
          : await api.updateDocumentTemplate(table, draft.id, body)
      const list = await api.documentTemplates(table)
      setTemplates(list)
      // The draft stays as it is — its keys, its open cards —, now saved.
      setDraft((d) => (d === null ? d : { ...d, id: saved.id, label: saved.label }))
      lastShown.current = saved.id
      setDirty(false)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (draft === null || draft.id === null) return
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

  const close = () => {
    if (busy) return
    if (dirty && !leaving) {
      setLeaving(true)
      return
    }
    onClose()
  }

  const start = (id: PresetId) => {
    const built = buildPreset(id, table, sources)
    setDraft(draftOf(null, built.label, built.spec))
    setDirty(true)
    setOpened(new Set())
    setTab('blocks')
    setError(null)
  }

  const insert = (kind: BlockKind) => {
    if (draft === null || inserting === null) return
    const block = newBlock(kind, table, sources)
    if (block === null) return
    const key = newKey()
    const at = inserting
    setBlocks(
      [...draft.spec.blocks.slice(0, at), block, ...draft.spec.blocks.slice(at)],
      [...draft.keys.slice(0, at), key, ...draft.keys.slice(at)],
    )
    setOpened((o) => new Set(o).add(key))
    setAdded(key)
  }

  const full = draft !== null && countBlocks(draft.spec.blocks) >= MAX_BLOCKS

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        showCloseButton={false}
        // Nothing is focused on opening: the first button would show its ring for nothing.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex h-[94vh] max-w-[min(1600px,98vw)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1600px,98vw)]"
      >
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3">
          <FileText className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">
              {$t('Modèles de document — {label}', { label: table.label })}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {$t(
                'Une ligne devient un PDF : une facture, un devis, une fiche. Chacun le lit avec ses droits : un champ qu’il ne voit pas n’y figure pas.',
              )}
            </DialogDescription>
          </div>
          {leaving ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm">
              {$t('Modifications non enregistrées.')}
              <Button variant="ghost" size="sm" onClick={onClose}>
                {$t('Fermer sans enregistrer')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLeaving(false)}>
                {$t('Continuer')}
              </Button>
            </div>
          ) : (
            <>
              {draft?.id !== null && draft !== null && (
                <Button
                  variant={confirming ? 'destructive' : 'ghost'}
                  size="sm"
                  onClick={() => (confirming ? void remove() : setConfirming(true))}
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                  {confirming ? $t('Confirmer la suppression') : $t('Supprimer le modèle')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
                {$t('Fermer')}
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={busy || draft === null || (!dirty && draft.id !== null)}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {$t('Enregistrer')}
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[13rem_minmax(0,1fr)_minmax(0,34rem)]">
          {/* The templates of the table. */}
          <nav className="hidden min-h-0 space-y-1 overflow-y-auto border-r p-3 scroll-discret lg:block">
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
            {draft !== null && draft.id === null && (
              <div className="flex w-full items-center gap-2 rounded-md bg-accent px-2 py-1.5 text-sm font-medium">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{draft.label}</span>
              </div>
            )}
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

          {/* The one chosen, or where a new one starts. */}
          <main className="flex min-h-0 flex-col">
            {draft === null ? (
              <Gallery onPick={start} />
            ) : (
              <Tabs
                value={tab}
                onValueChange={(t) => setTab(t as Tab)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="space-y-2 border-b px-4 pt-3">
                  <Input
                    value={draft.label}
                    onChange={(e) => change((d) => ({ ...d, label: e.target.value }))}
                    aria-label={$t('Nom du modèle')}
                    className="h-9 text-base font-medium"
                  />
                  <TabsList className="border-b-0">
                    <TabsTrigger value="blocks">{$t('Contenu')}</TabsTrigger>
                    <TabsTrigger value="style">{$t('Style et page')}</TabsTrigger>
                    <TabsTrigger value="frame">{$t('En-tête et pied de page')}</TabsTrigger>
                  </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 scroll-discret">
                  <TabsContent value="blocks" className="space-y-3">
                    {draft.spec.blocks.length === 0 && (
                      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        {$t('Aucun bloc : ajoutez un titre, un texte, les champs de la ligne…')}
                      </p>
                    )}
                    <BlockList
                      blocks={draft.spec.blocks}
                      keys={draft.keys}
                      opened={opened}
                      onToggle={(key) =>
                        setOpened((o) => {
                          const next = new Set(o)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                      }
                      onChange={(i, block) =>
                        change((d) => ({
                          ...d,
                          spec: {
                            ...d.spec,
                            blocks: d.spec.blocks.map((b, j) => (j === i ? block : b)),
                          },
                        }))
                      }
                      onMove={(from, to) => {
                        if (to < 0 || to >= draft.spec.blocks.length) return
                        setBlocks(
                          arrayMove([...draft.spec.blocks], from, to),
                          arrayMove([...draft.keys], from, to),
                        )
                      }}
                      onRemove={(i) =>
                        setBlocks(
                          draft.spec.blocks.filter((_, j) => j !== i),
                          draft.keys.filter((_, j) => j !== i),
                        )
                      }
                      onDuplicate={(i) => {
                        if (full) return
                        const key = newKey()
                        setBlocks(
                          [
                            ...draft.spec.blocks.slice(0, i + 1),
                            draft.spec.blocks[i] as DocumentBlock,
                            ...draft.spec.blocks.slice(i + 1),
                          ],
                          [...draft.keys.slice(0, i + 1), key, ...draft.keys.slice(i + 1)],
                        )
                      }}
                      onInsert={(at) => !full && setInserting(at)}
                      added={added}
                      ctx={ctx}
                    />
                    <Button
                      variant="ghost"
                      className="w-full border border-dashed text-muted-foreground"
                      disabled={full}
                      onClick={() => setInserting(draft.spec.blocks.length)}
                    >
                      <Plus className="size-4" />
                      {full
                        ? $t('{count} blocs au plus', { count: MAX_BLOCKS })
                        : $t('Ajouter un bloc')}
                    </Button>
                  </TabsContent>
                  <TabsContent value="style">
                    <StylePanel spec={draft.spec} onChange={changeSpec} />
                  </TabsContent>
                  <TabsContent value="frame">
                    <HeaderFooterPanel spec={draft.spec} table={table} onChange={changeSpec} />
                  </TabsContent>
                </div>
              </Tabs>
            )}
            {error !== null && (
              <p
                role="alert"
                className="m-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </main>

          {/* What it makes of the row. */}
          <aside className="hidden min-h-0 flex-col gap-2 border-l bg-muted/30 p-3 lg:flex">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-muted-foreground">
                {previewing ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    {$t('Mise en page…')}
                  </span>
                ) : (
                  $t('Aperçu sur la ligne ouverte')
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => draft !== null && void refresh(draft)}
                disabled={previewing || draft === null}
              >
                <RefreshCw className="size-4" />
                {$t('Actualiser')}
              </Button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
              {draft !== null && preview !== null ? (
                <iframe title={$t('Aperçu du document')} src={preview} className="size-full" />
              ) : (
                <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {previewing ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : draft === null ? (
                    $t('Choisissez un point de départ : l’aperçu s’affichera ici.')
                  ) : (
                    $t('Aucun aperçu')
                  )}
                </div>
              )}
              {previewError !== null && draft !== null && (
                <p
                  role="alert"
                  className="absolute inset-x-2 bottom-2 rounded-md border border-destructive/30 bg-background/95 px-3 py-2 text-xs text-destructive shadow"
                >
                  {previewError}
                </p>
              )}
            </div>
          </aside>
        </div>

        <BlockPicker
          open={inserting !== null}
          onClose={() => setInserting(null)}
          onPick={insert}
          unavailable={
            sources.length === 0 ? { rows: $t('Aucune autre table n’est liée à celle-ci.') } : {}
          }
        />
      </DialogContent>
    </Dialog>
  )
}

/** The starting points of a new template, each drawn in small. */
function Gallery({ onPick }: { readonly onPick: (id: PresetId) => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6 scroll-discret">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <LayoutTemplate className="size-4 text-muted-foreground" />
            {$t('Nouveau modèle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {$t(
              'Choisissez un point de départ : il est construit avec les colonnes de cette table, et tout s’y change ensuite.',
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {presets().map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Miniature id={p.id} accent={p.accent} />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * A starting point drawn as a sheet of paper: white whatever the theme, since it is
 * the page that will be printed.
 */
function Miniature({ id, accent }: { readonly id: PresetId; readonly accent: string }) {
  const line = (w: string, extra = '') => (
    <div className={cn('h-1 rounded-full bg-neutral-200', extra)} style={{ width: w }} />
  )
  const landscape = id === 'certificate'
  return (
    <div className="flex h-36 items-center justify-center rounded-lg bg-muted/60 p-3">
      <div
        className={cn(
          'relative overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-black/5 transition-transform group-hover:-translate-y-0.5',
          landscape ? 'aspect-[1.414/1] h-24' : 'aspect-[1/1.414] h-full',
        )}
      >
        {id === 'blank' && (
          <div className="space-y-1.5 p-2.5">
            <div className="h-2 w-2/3 rounded-sm" style={{ backgroundColor: accent }} />
            {line('90%', 'mt-2')}
            {line('75%')}
            {line('85%')}
            {line('60%')}
          </div>
        )}
        {id === 'invoice' && (
          <div className="space-y-1.5 p-2">
            <div className="flex items-start justify-between">
              <div className="size-3 rounded-sm" style={{ backgroundColor: accent }} />
              <div className="h-1.5 w-6 rounded-sm" style={{ backgroundColor: accent }} />
            </div>
            <div className="h-px w-full" style={{ backgroundColor: accent }} />
            {line('40%')}
            <div className="h-1.5 w-full rounded-[1px]" style={{ backgroundColor: accent }} />
            {line('100%')}
            {line('100%', 'bg-neutral-100')}
            {line('100%')}
            <div className="ml-auto h-1.5 w-2/5 rounded-[1px] bg-neutral-200" />
          </div>
        )}
        {id === 'quote' && (
          <div className="space-y-1.5 p-2">
            <div className="h-4 w-full rounded-[1px]" style={{ backgroundColor: accent }} />
            <div className="grid grid-cols-3 gap-1">
              {line('100%')}
              {line('100%')}
              {line('100%')}
            </div>
            <div className="h-px w-full" style={{ backgroundColor: accent }} />
            {line('100%')}
            {line('100%')}
            <div className="h-2 w-full border-l-2 bg-neutral-50" style={{ borderColor: accent }} />
          </div>
        )}
        {id === 'sheet' && (
          <div>
            <div className="h-6 w-full" style={{ backgroundColor: accent }} />
            <div className="grid grid-cols-2 gap-1.5 p-2">
              <div className="h-8 rounded-[2px] bg-neutral-200" />
              <div className="space-y-1">
                {line('100%')}
                {line('70%')}
                {line('90%')}
              </div>
            </div>
            <div className="space-y-1 px-2">
              {line('40%')}
              {line('100%')}
            </div>
          </div>
        )}
        {id === 'certificate' && (
          <div
            className="absolute inset-1 flex flex-col items-center justify-center gap-1 border-2 border-double"
            style={{ borderColor: accent }}
          >
            <div className="h-1.5 w-1/2 rounded-sm" style={{ backgroundColor: accent }} />
            {line('35%')}
            <div className="h-1 w-1/3 rounded-sm bg-neutral-400" />
            {line('55%')}
          </div>
        )}
      </div>
    </div>
  )
}
