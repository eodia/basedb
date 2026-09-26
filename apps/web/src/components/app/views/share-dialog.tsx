'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  type FormSharing,
  type ShareAccess,
  type ShareState,
  type TableRef,
  api,
} from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Sharing a form or a survey — chapter 15, on screen.
 *
 * One link per form. PUBLIC, anyone who has it answers, with no account; for MEMBERS, the
 * person signs in first — and the form can be kept to some groups. Either way the answer
 * needs no right on the table: it is written on the authority of whoever saved the sharing
 * last, which the dialog says, since it is what closes the form if that right goes.
 */

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

const STATE: Readonly<Record<ShareState, { label: string; tone: string }>> = {
  open: { label: 'Ouvert', tone: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  inactive: { label: 'Désactivé', tone: 'bg-muted text-muted-foreground' },
  closed: { label: 'Fermé', tone: 'bg-muted text-muted-foreground' },
  full: { label: 'Complet', tone: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  authority: { label: 'Suspendu', tone: 'bg-rose-500/15 text-rose-800 dark:text-rose-300' },
}

/** `2026-10-01T18:00:00.000Z` → the value of a `datetime-local` input, in local time. */
function toLocalInput(iso: string | null): string {
  if (iso === null) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/f/${token}`
}

function AccessChoice({
  value,
  onChange,
  disabled,
}: {
  readonly value: ShareAccess
  readonly onChange: (value: ShareAccess) => void
  readonly disabled: boolean
}) {
  const choices: ReadonlyArray<{
    value: ShareAccess
    icon: typeof Globe
    title: string
    text: string
  }> = [
    {
      value: 'public',
      icon: Globe,
      title: 'Public',
      text: 'Toute personne qui a le lien répond, sans compte.',
    },
    {
      value: 'members',
      icon: Users,
      title: 'Membres connectés',
      text: 'La personne se connecte d’abord ; sa réponse porte son nom.',
    },
  ]
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Qui peut répondre</legend>
      {choices.map((choice) => (
        <label
          key={choice.value}
          htmlFor={`share-access-${choice.value}`}
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            value === choice.value
              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
              : 'hover:bg-accent',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            id={`share-access-${choice.value}`}
            type="radio"
            name="share-access"
            value={choice.value}
            checked={value === choice.value}
            disabled={disabled}
            onChange={() => onChange(choice.value)}
            className="sr-only"
          />
          <choice.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="block text-sm font-medium">{choice.title}</span>
            <span className="block text-xs text-muted-foreground">{choice.text}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function ShareFormDialog({
  table,
  view,
  onClose,
}: {
  readonly table: TableRef & { readonly label: string }
  /** The form view to share — `null` closes the dialog. */
  readonly view: { readonly id: string; readonly label: string } | null
  readonly onClose: () => void
}) {
  const [sharing, setSharing] = useState<FormSharing | null>(null)
  const [access, setAccess] = useState<ShareAccess>('public')
  const [active, setActive] = useState(true)
  const [closesAt, setClosesAt] = useState('')
  const [maxResponses, setMaxResponses] = useState('')
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [renewing, setRenewing] = useState(false)

  /** The form reflects what the server holds — after a load, and after every save. */
  const adopt = useCallback((next: FormSharing) => {
    setSharing(next)
    const share = next.share
    setAccess(share?.access ?? 'public')
    setActive(share?.active ?? true)
    setClosesAt(toLocalInput(share?.closes_at ?? null))
    setMaxResponses(share?.max_responses == null ? '' : String(share.max_responses))
    setGroups(new Set(share?.groups ?? []))
  }, [])

  const viewId = view?.id ?? null
  // Keyed on the table's names, not on the object a parent may rebuild at every render.
  const { base, name } = table
  useEffect(() => {
    if (viewId === null) {
      setSharing(null)
      setError(null)
      setRenewing(false)
      return
    }
    api.formSharing({ base, name }, viewId).then(adopt, (e) => setError(messageFor(e)))
  }, [base, name, viewId, adopt])

  const maxOk = maxResponses.trim() === '' || /^[1-9]\d{0,6}$/.test(maxResponses.trim())

  const save = async (overrides: Partial<{ active: boolean }> = {}) => {
    if (viewId === null || !maxOk) return
    setBusy(true)
    setError(null)
    try {
      adopt(
        await api.saveFormSharing(table, viewId, {
          access,
          active: overrides.active ?? active,
          closes_at: closesAt === '' ? null : new Date(closesAt).toISOString(),
          max_responses: maxResponses.trim() === '' ? null : Number(maxResponses.trim()),
          groups: access === 'members' ? [...groups] : [],
        }),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const act = async (work: () => Promise<FormSharing | undefined>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await work()
      if (next !== undefined) adopt(next)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const share = sharing?.share ?? null
  const url = share === null || share.token === '' ? null : shareUrl(share.token)

  const copy = async () => {
    if (url === null) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // A browser without clipboard access: the link stays selectable in its box.
    }
  }

  return (
    <Dialog open={view !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Partager « {view?.label} »</DialogTitle>
          <DialogDescription>
            Répondre ne demande aucun droit sur la table : chaque réponse ajoute une ligne à «{' '}
            {table.label} », et rien d’autre de la table n’est montré.
          </DialogDescription>
        </DialogHeader>

        {sharing === null && error === null ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {share !== null && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      STATE[share.state].tone,
                    )}
                  >
                    {STATE[share.state].label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {share.response_count} réponse{share.response_count > 1 ? 's' : ''}
                    {share.last_response_at !== null &&
                      ` · dernière le ${DATE.format(new Date(share.last_response_at))}`}
                  </span>
                  <Label htmlFor="share-active" className="text-xs font-normal">
                    Lien actif
                  </Label>
                  <Switch
                    id="share-active"
                    checked={active}
                    disabled={busy}
                    onCheckedChange={(checked) => {
                      setActive(checked)
                      void save({ active: checked })
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={url ?? 'Lien illisible : régénérez-le.'}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Lien du formulaire"
                    className="h-8 font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => void copy()}
                    disabled={url === null}
                    aria-label="Copier le lien"
                    title="Copier le lien"
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    asChild={url !== null}
                    disabled={url === null}
                    aria-label="Ouvrir le formulaire"
                    title="Ouvrir le formulaire"
                  >
                    {url === null ? (
                      <ExternalLink className="size-4" />
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </Button>
                </div>
                {renewing ? (
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 flex-1">
                      L’ancien lien cessera de fonctionner immédiatement, pour tous ceux qui l’ont
                      reçu.
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setRenewing(false)}>
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setRenewing(false)
                        if (viewId !== null) {
                          void act(() => api.regenerateFormShare(table, viewId))
                        }
                      }}
                    >
                      Régénérer
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRenewing(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="size-3" />
                    Régénérer le lien
                  </button>
                )}
                {share.state === 'authority' && (
                  <p className="text-xs text-rose-700 dark:text-rose-400">
                    {share.published_by.name ?? 'La personne qui l’a publié'} ne peut plus ajouter
                    de lignes à cette table : le formulaire est suspendu. Enregistrez pour en
                    devenir la personne qui publie.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Qui peut répondre</Label>
              <AccessChoice value={access} onChange={setAccess} disabled={busy} />
            </div>

            {access === 'members' && (sharing?.groups.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>Réservé aux groupes</Label>
                <p className="text-xs text-muted-foreground">
                  Aucun coché : tout membre connecté répond.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {sharing?.groups.map((group) => (
                    <label
                      key={group.id}
                      htmlFor={`share-group-${group.id}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`share-group-${group.id}`}
                        checked={groups.has(group.id)}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setGroups((was) => {
                            const next = new Set(was)
                            if (checked === true) next.add(group.id)
                            else next.delete(group.id)
                            return next
                          })
                        }
                      />
                      <span className="truncate">{group.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="share-closes">Fermer le</Label>
                <Input
                  id="share-closes"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  disabled={busy}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-max">Nombre maximal de réponses</Label>
                <Input
                  id="share-max"
                  inputMode="numeric"
                  value={maxResponses}
                  onChange={(e) => setMaxResponses(e.target.value)}
                  placeholder="Illimité"
                  disabled={busy}
                  className={cn('h-8', !maxOk && 'border-destructive')}
                />
              </div>
            </div>

            {(sharing?.omitted.length ?? 0) > 0 && (
              <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  Questions non posées par le lien
                </p>
                {sharing?.omitted.map((o) => (
                  <p key={o.field} className="text-muted-foreground">
                    <span className="text-foreground">{o.field}</span> — {o.reason}
                  </p>
                ))}
              </div>
            )}

            {share !== null && (
              <p className="text-xs text-muted-foreground">
                Les réponses s’écrivent avec les droits de{' '}
                <span className="font-medium text-foreground">
                  {share.published_by.name ?? 'la personne qui l’a publié'}
                </span>
                , qui a enregistré ce partage en dernier.
              </p>
            )}

            {error !== null && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {share !== null ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => {
                if (viewId === null) return
                void act(async () => {
                  await api.deleteFormShare(table, viewId)
                  return api.formSharing(table, viewId)
                })
              }}
            >
              Arrêter le partage
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Fermer
            </Button>
            <Button onClick={() => void save()} disabled={busy || !maxOk || sharing === null}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {share === null ? 'Créer le lien' : 'Enregistrer'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
