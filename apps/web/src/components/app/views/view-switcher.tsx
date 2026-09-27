'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Hint } from '@/components/ui/tooltip'
import type { SavedView, ViewKind } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { KIND_INFO, VIEW_KINDS } from '@/lib/views'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  ChevronDown,
  Copy,
  Ellipsis,
  GripVertical,
  Lock,
  LockOpen,
  Pencil,
  Settings2,
  Share2,
  Table2,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * The view selector — to the left of « Filtrer », where the eye starts reading the
 * toolbar (ch. 11 §1.4).
 *
 * « Toutes les lignes » is always first: the table's own grid, which nobody saved and
 * nobody can delete, where every reader finds every row. The saved views follow in the
 * order someone gave them — a drag of the handle, or the keyboard — and that order is
 * everyone's, since views are shared. Whoever builds the base creates, renames,
 * configures, duplicates and deletes them; everyone else picks among them.
 */
export function ViewSwitcher({
  views,
  activeId,
  canManage,
  modified,
  onSelect,
  onCreate,
  onConfigure,
  onRename,
  onDuplicate,
  onDelete,
  onReorder,
  onShare,
  onLock,
}: {
  readonly views: readonly SavedView[]
  /** `null` for the table's own grid. */
  readonly activeId: string | null
  readonly canManage: boolean
  /** The view on screen differs from what it saved: a dot says so on the trigger. */
  readonly modified: boolean
  readonly onSelect: (id: string | null) => void
  readonly onCreate: (kind: ViewKind) => void
  readonly onConfigure: (view: SavedView) => void
  /** Resolves to the refusal to show, or `null` once renamed. */
  readonly onRename: (view: SavedView, label: string) => Promise<string | null>
  readonly onDuplicate: (view: SavedView) => void
  readonly onDelete: (view: SavedView) => Promise<void>
  readonly onReorder: (ids: readonly string[]) => Promise<void>
  /** Shares a collaborative view: a form to answer, any other to read (chapter 15). */
  readonly onShare?: (view: SavedView) => void
  /** Locks or unlocks a collaborative view. */
  readonly onLock?: (view: SavedView, locked: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<SavedView | null>(null)
  const [busy, setBusy] = useState(false)
  // The order as dropped, while the server has not answered: then its own replaces it.
  const [pending, setPending] = useState<readonly string[] | null>(null)
  const signature = views.map((v) => v.id).join(',')
  useEffect(() => {
    void signature
    setPending(null)
  }, [signature])

  // The collaborative views, in the shared order; the reader's own, apart, after them.
  const shared = views.filter((v) => !v.personal)
  const mine = views.filter((v) => v.personal)
  const ordered =
    pending === null ? shared : pending.flatMap((id) => shared.filter((v) => v.id === id))
  const active = views.find((v) => v.id === activeId) ?? null
  const Icon = active === null ? Table2 : KIND_INFO[active.kind].icon

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (event: DragEndEvent) => {
    const { active: dragged, over } = event
    if (over === null || dragged.id === over.id) return
    const ids = ordered.map((v) => v.id)
    const next = arrayMove(ids, ids.indexOf(String(dragged.id)), ids.indexOf(String(over.id)))
    setPending(next)
    void onReorder(next).finally(() => setPending(null))
  }

  const pick = (id: string | null) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 max-w-56 gap-1.5 px-2 text-xs"
            aria-label={$t('Changer de vue')}
          >
            <Icon className="size-3.5 text-primary" />
            <span className="truncate">{active?.label ?? $t('Toutes les lignes')}</span>
            {modified && (
              <Hint label={$t('Modifiée, non enregistrée')}>
                <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
              </Hint>
            )}
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-1">
          <ViewRow
            icon={<Table2 className="size-4 text-muted-foreground" />}
            label={$t('Toutes les lignes')}
            sublabel={$t('La grille de la table')}
            active={activeId === null}
            onSelect={() => pick(null)}
          />

          {ordered.length > 0 && <div className="my-1 border-t" />}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={ordered.map((v) => v.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="max-h-72 overflow-y-auto scroll-discret">
                {ordered.map((view) => (
                  <SortableView
                    key={view.id}
                    view={view}
                    active={view.id === activeId}
                    canManage={canManage}
                    sortable={canManage}
                    onLock={
                      onLock === undefined || !canManage
                        ? undefined
                        : (locked) => onLock(view, locked)
                    }
                    onSelect={() => pick(view.id)}
                    onConfigure={() => {
                      setOpen(false)
                      onConfigure(view)
                    }}
                    onRename={(label) => onRename(view, label)}
                    onDuplicate={() => {
                      setOpen(false)
                      onDuplicate(view)
                    }}
                    onDelete={() => {
                      setOpen(false)
                      setDeleting(view)
                    }}
                    onShare={
                      onShare !== undefined && canManage
                        ? () => {
                            setOpen(false)
                            onShare(view)
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {mine.length > 0 && (
            <>
              <div className="my-1 border-t" />
              <p className="flex items-center gap-1.5 px-2 pt-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <UserRound className="size-3" />
                {$t('Mes vues')}
              </p>
              {mine.map((view) => (
                <SortableView
                  key={view.id}
                  view={view}
                  active={view.id === activeId}
                  // Its owner's: configured, renamed, deleted by them — never shared.
                  canManage
                  sortable={false}
                  onSelect={() => pick(view.id)}
                  onConfigure={() => {
                    setOpen(false)
                    onConfigure(view)
                  }}
                  onRename={(label) => onRename(view, label)}
                  onDuplicate={() => {
                    setOpen(false)
                    onDuplicate(view)
                  }}
                  onDelete={() => {
                    setOpen(false)
                    setDeleting(view)
                  }}
                />
              ))}
            </>
          )}

          <div className="my-1 border-t" />
          {
            <div className="p-1">
              <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {canManage ? $t('Créer une vue') : $t('Créer une vue personnelle')}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {VIEW_KINDS.map((kind) => {
                  const KindIcon = KIND_INFO[kind].icon
                  return (
                    <Hint key={kind} label={KIND_INFO[kind].summary}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          onCreate(kind)
                        }}
                        className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] hover:bg-accent"
                      >
                        <KindIcon className="size-4 text-muted-foreground" />
                        {KIND_INFO[kind].label}
                      </button>
                    </Hint>
                  )
                })}
              </div>
            </div>
          }
        </PopoverContent>
      </Popover>

      <Dialog open={deleting !== null} onOpenChange={(next) => !next && !busy && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {$t('Supprimer la vue « {label} » ?', { label: deleting?.label })}
            </DialogTitle>
            <DialogDescription>
              {deleting?.personal === true
                ? $t('Elle disparaît de vos vues. Les lignes, elles, ne sont pas touchées.')
                : $t(
                    'Elle disparaît pour tous ceux qui lisent la table. Les lignes, elles, ne sont pas touchées.',
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>
              {$t('Annuler')}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (deleting === null) return
                setBusy(true)
                try {
                  await onDelete(deleting)
                } finally {
                  setBusy(false)
                  setDeleting(null)
                }
              }}
            >
              {busy ? $t('Suppression…') : $t('Supprimer la vue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ViewRow({
  icon,
  label,
  sublabel,
  active,
  onSelect,
  handle,
  menu,
}: {
  readonly icon: React.ReactNode
  readonly label: React.ReactNode
  readonly sublabel?: string
  readonly active: boolean
  readonly onSelect: () => void
  readonly handle?: React.ReactNode
  readonly menu?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'group/view flex items-center gap-1 rounded-md pr-1 hover:bg-accent',
        active && 'bg-accent/70',
      )}
    >
      {handle ?? <span className="w-1" />}
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1 text-left text-sm"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{label}</span>
          {sublabel !== undefined && (
            <span className="block truncate text-[11px] text-muted-foreground">{sublabel}</span>
          )}
        </span>
        {active && <Check className="size-3.5 shrink-0 text-primary" />}
      </button>
      {menu}
    </div>
  )
}

function SortableView({
  view,
  active,
  canManage,
  sortable,
  onSelect,
  onConfigure,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  onLock,
}: {
  readonly view: SavedView
  readonly active: boolean
  readonly canManage: boolean
  /** Its place in the shared order can be dragged — never a personal view's. */
  readonly sortable: boolean
  readonly onSelect: () => void
  readonly onConfigure: () => void
  readonly onRename: (label: string) => Promise<string | null>
  readonly onDuplicate: () => void
  readonly onDelete: () => void
  readonly onShare?: () => void
  readonly onLock?: (locked: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: view.id,
    disabled: !sortable,
  })
  // Locked, a view is changed by nobody until someone unlocks it.
  const editable = canManage && !view.locked
  const [renaming, setRenaming] = useState(false)
  const [text, setText] = useState(view.label)
  const [error, setError] = useState<string | null>(null)
  const Icon = KIND_INFO[view.kind].icon

  const finish = async (save: boolean) => {
    const label = text.trim()
    if (!save || label === '' || label === view.label) {
      setRenaming(false)
      setText(view.label)
      setError(null)
      return
    }
    const refusal = await onRename(label)
    if (refusal === null) {
      setRenaming(false)
      setError(null)
    } else {
      setError(refusal)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 rounded-md bg-background shadow-md')}
    >
      {renaming ? (
        <div className="px-1 py-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void finish(true)
              if (e.key === 'Escape') {
                e.stopPropagation()
                void finish(false)
              }
            }}
            onBlur={() => void finish(true)}
            maxLength={255}
            className="h-8 text-sm"
            aria-label={$t('Nouveau nom de la vue')}
            autoFocus
          />
          {error !== null && <p className="px-1 pt-1 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <ViewRow
          icon={<Icon className="size-4 shrink-0 text-muted-foreground" />}
          label={
            <span className="flex items-center gap-1.5">
              <span className="truncate">{view.label}</span>
              {view.locked && (
                <Lock
                  className="size-3 shrink-0 text-muted-foreground"
                  aria-label={$t('Verrouillée')}
                />
              )}
            </span>
          }
          sublabel={
            view.filter_hidden ? $t('Filtre sur un champ qui ne vous est pas ouvert') : undefined
          }
          active={active}
          onSelect={onSelect}
          handle={
            sortable ? (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="cursor-grab rounded p-0.5 text-muted-foreground opacity-40 hover:bg-background group-hover/view:opacity-100 active:cursor-grabbing"
                aria-label={$t('Déplacer la vue {label}', { label: view.label })}
              >
                <GripVertical className="size-3.5" />
              </button>
            ) : undefined
          }
          menu={
            canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground opacity-0 hover:bg-background focus-visible:opacity-100 group-hover/view:opacity-100 data-[state=open]:opacity-100"
                    aria-label={$t('Actions sur la vue {label}', { label: view.label })}
                  >
                    <Ellipsis className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={onConfigure} disabled={!editable}>
                    <Settings2 className="size-4" />
                    {$t('Configurer…')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!editable}
                    onSelect={() => {
                      setText(view.label)
                      setRenaming(true)
                    }}
                  >
                    <Pencil className="size-4" />
                    {$t('Renommer')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onDuplicate}>
                    <Copy className="size-4" />
                    {$t('Dupliquer')}
                  </DropdownMenuItem>
                  {onShare !== undefined && (
                    <DropdownMenuItem onSelect={onShare}>
                      <Share2 className="size-4" />
                      {$t('Partager…')}
                    </DropdownMenuItem>
                  )}
                  {onLock !== undefined && (
                    <DropdownMenuItem onSelect={() => onLock(!view.locked)}>
                      {view.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                      {view.locked ? $t('Déverrouiller la vue') : $t('Verrouiller la vue')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onDelete} disabled={!editable} variant="destructive">
                    <Trash2 className="size-4" />
                    {$t('Supprimer')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
