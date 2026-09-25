'use client'

import { DescriptionField, isTooLong } from '@/components/app/description'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type DeletedBase, type Project, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronsUpDown,
  FolderKanban,
  History,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The project switcher, top of the sidebar — chapter 05 §15.
 *
 * A project is what one navigates by: it is chosen here, and the column below lists its
 * bases and the tables of each. Creating one is administering the tenant, so the entry is
 * offered to administrators only; renaming one wants `manage_schema` on it, deleting one
 * the tenant's — and an empty project, since its bases are real schemas with real rows.
 *
 * The deleted bases live here too: a base comes back into its project, and this is the
 * menu from which one looks at what a project held.
 */

interface Props {
  readonly projects: readonly Project[]
  readonly project: Project | null
  /** Holds `manage_schema` on the tenant: creates and deletes projects. */
  readonly administers: boolean
  /** The reduced sidebar: the switcher is its icon alone, the label in a tooltip. */
  readonly compact?: boolean
  readonly onSelect: (id: string) => void
  readonly onNew: () => void
  /** A project was renamed, a base restored: the list is reread. */
  readonly onChanged: () => void
  readonly onDeleted: (id: string) => void
}

export function ProjectMenu({
  projects,
  project,
  administers,
  compact = false,
  onSelect,
  onNew,
  onChanged,
  onDeleted,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState<readonly DeletedBase[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadDeleted = useCallback(async () => {
    try {
      setDeleted(await api.deletedBases())
    } catch {
      // Without the administration role the route answers an absence, not a refusal:
      // the submenu simply does not appear.
      setDeleted([])
    }
  }, [])

  useEffect(() => {
    void loadDeleted()
  }, [loadDeleted])

  const canEdit = project?.actions.includes('manage_schema') === true
  const baseCount = project?.bases.length ?? 0

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={compact ? (project?.label ?? 'Aucun projet') : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent',
          compact && 'justify-center p-0.5',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <FolderKanban className="size-4.5" />
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {project?.label ?? 'Aucun projet'}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {project === null
                  ? 'Projet'
                  : `Projet · ${baseCount} ${baseCount > 1 ? 'bases' : 'base'}`}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    </DropdownMenuTrigger>
  )

  return (
    <div className={compact ? 'p-2' : 'p-3'}>
      {/* Reopening the menu dismisses an old refusal: it is where one would retry. */}
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) return
          setError(null)
          void loadDeleted()
        }}
      >
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">{project?.label ?? 'Aucun projet'}</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}

        <DropdownMenuContent side={compact ? 'right' : 'bottom'} align="start" className="w-64">
          <DropdownMenuLabel>Projets</DropdownMenuLabel>
          {projects.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucun projet.</div>
          )}
          {projects.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => onSelect(p.id)}>
              <FolderKanban className="size-4" />
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              {project?.id === p.id && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}

          {(administers || (project !== null && canEdit)) && <DropdownMenuSeparator />}

          {administers && (
            <DropdownMenuItem onSelect={onNew}>
              <Plus className="size-4" />
              Nouveau projet
            </DropdownMenuItem>
          )}

          {project !== null && canEdit && (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil className="size-4" />
              Modifier « {project.label} »
            </DropdownMenuItem>
          )}
          {project !== null && administers && (
            <DropdownMenuItem
              onSelect={() => setDeleting(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Supprimer « {project.label} »
            </DropdownMenuItem>
          )}

          {deleted.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <History className="size-4" />
                  Bases supprimées ({deleted.length})
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64">
                  <DropdownMenuLabel>Cliquez pour restaurer</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {deleted.map((d) => (
                    <DropdownMenuItem
                      key={d.id}
                      onSelect={async () => {
                        setError(null)
                        try {
                          await api.restoreBase(d.name)
                          await loadDeleted()
                          onChanged()
                        } catch (e) {
                          setError(messageFor(e))
                        }
                      }}
                    >
                      <History className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{d.label}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {new Date(d.deleted_at).toLocaleDateString('fr-FR')}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* In the reduced column the refusal floats beside it: 40 pixels do not hold a sentence. */}
      {error !== null && (
        <p
          role="alert"
          className={cn(
            'mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive',
            compact && 'absolute top-2 left-full z-50 mt-0 ml-2 w-64 bg-background shadow-lg',
          )}
        >
          {error}
        </p>
      )}

      {project !== null && (
        <>
          <ProjectDialog
            open={editing}
            project={project}
            onClose={() => setEditing(false)}
            onDone={() => {
              setEditing(false)
              onChanged()
            }}
          />
          <DeleteProjectDialog
            open={deleting}
            project={project}
            onClose={() => setDeleting(false)}
            onDone={() => {
              setDeleting(false)
              onDeleted(project.id)
            }}
          />
        </>
      )}
    </div>
  )
}

/**
 * Names a project and says what it is for — a new one, or the one given.
 *
 * `onDone` receives the identifier of the project created, so the caller can open it.
 */
export function ProjectDialog({
  open,
  project,
  onClose,
  onDone,
}: {
  readonly open: boolean
  /** Absent for a new project. */
  readonly project?: Pick<Project, 'id' | 'label' | 'description'>
  readonly onClose: () => void
  readonly onDone: (id: string) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel(project?.label ?? '')
    setDescription(project?.description ?? '')
    setError(null)
  }, [open, project?.label, project?.description])

  const ready = label.trim() !== '' && !isTooLong(description) && !busy

  const submit = async () => {
    if (!ready) return
    const trimmed = label.trim()
    const text = description.trim() === '' ? null : description.trim()
    setBusy(true)
    setError(null)
    try {
      if (project === undefined) {
        const created = await api.createProject(trimmed, text ?? undefined)
        onDone(created.id)
      } else {
        // Only what changed is sent, and an emptied description is a `null` — "clear it".
        const patch: { label?: string; description?: string | null } = {}
        if (trimmed !== project.label) patch.label = trimmed
        if (text !== (project.description ?? null)) patch.description = text
        if (Object.keys(patch).length > 0) await api.updateProject(project.id, patch)
        onDone(project.id)
      }
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project === undefined ? 'Nouveau projet' : 'Modifier le projet'}
          </DialogTitle>
          <DialogDescription>
            Un projet regroupe des bases. Les droits accordés sur un projet valent pour toutes ses
            bases et toutes leurs tables, y compris celles créées plus tard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-label">Libellé</Label>
            <Input
              id="project-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Ex. Commercial"
              autoFocus
              disabled={busy}
            />
          </div>

          <DescriptionField
            id="project-description"
            value={description}
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder="À quoi sert ce projet ?"
            disabled={busy}
          />

          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!ready}>
            {busy ? 'Enregistrement…' : project === undefined ? 'Créer le projet' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Deleting a project. Only an empty one goes: its bases are deleted first, each through
 * its own plan — the server refuses otherwise, and the dialog says why before asking.
 */
function DeleteProjectDialog({
  open,
  project,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly project: Project
  readonly onClose: () => void
  readonly onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const count = project.bases.length

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteProject(project.id)
      onDone()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer « {project.label} » ?</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `Ce projet contient encore ${count} ${count > 1 ? 'bases' : 'base'} : supprimez-les d’abord, chacune depuis son menu.`
              : 'Le projet est vide. Les droits accordés dessus disparaissent avec lui.'}
          </DialogDescription>
        </DialogHeader>

        {error !== null && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={busy || count > 0}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? 'Suppression…' : 'Supprimer le projet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
