'use client'

import { ShareAccessDialog } from '@/components/app/share-access-dialog'
import { AccessChoice, embedCode } from '@/components/app/views/share-dialog'
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
  type DashboardShareState,
  type DashboardSharing,
  type DescribedBase,
  type ShareAccess,
  api,
} from '@/lib/api/client'
import { $t, groupName } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Check, Code2, Copy, ExternalLink, Loader2, RefreshCw, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Sharing a dashboard — chapter 18 §2.5, on screen. Two ways, side by side:
 *
 * - invite people to the BASE, as the base is shared: they then open the dashboard in the
 *   application, and each card reads with their own rights;
 * - or give a LINK to the dashboard alone, as a view is shared: public, or for signed-in
 *   members — some groups, perhaps. It needs no right on the base: the cards read on the
 *   authority of whoever saved the sharing last, and the page shows the dashboard, its
 *   filters, and nothing more — no exploration, no row opened.
 */

const STATE: Readonly<Record<DashboardShareState, { label: string; tone: string }>> = {
  open: { label: $t('Ouvert'), tone: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  inactive: { label: $t('Désactivé'), tone: 'bg-muted text-muted-foreground' },
  authority: { label: $t('Suspendu'), tone: 'bg-rose-500/15 text-rose-800 dark:text-rose-300' },
}

export const dashboardUrl = (token: string) => `${window.location.origin}/d/${token}`

export function ShareDashboardDialog({
  base,
  dashboard,
  onClose,
}: {
  readonly base: DescribedBase
  /** The dashboard to share — `null` closes the dialog. */
  readonly dashboard: { readonly id: string; readonly label: string } | null
  readonly onClose: () => void
}) {
  const [sharing, setSharing] = useState<DashboardSharing | null>(null)
  const [access, setAccess] = useState<ShareAccess>('public')
  const [active, setActive] = useState(true)
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set())
  const [canEmbed, setCanEmbed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [invite, setInvite] = useState(false)

  /** The form reflects what the server holds — after a load, and after every save. */
  const adopt = useCallback((next: DashboardSharing) => {
    setSharing(next)
    const share = next.share
    setAccess(share?.access ?? 'public')
    setActive(share?.active ?? true)
    setGroups(new Set(share?.groups ?? []))
    setCanEmbed(share?.can_embed ?? false)
  }, [])

  const id = dashboard?.id ?? null
  const baseName = base.name
  useEffect(() => {
    if (id === null) {
      setSharing(null)
      setError(null)
      setRenewing(false)
      return
    }
    api.dashboardSharing(baseName, id).then(adopt, (e) => setError(messageFor(e)))
  }, [baseName, id, adopt])

  const save = async (overrides: Partial<{ active: boolean; canEmbed: boolean }> = {}) => {
    if (id === null) return
    setBusy(true)
    setError(null)
    try {
      adopt(
        await api.saveDashboardSharing(baseName, id, {
          access,
          active: overrides.active ?? active,
          groups: access === 'members' ? [...groups] : [],
          can_embed: overrides.canEmbed ?? canEmbed,
        }),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const act = async (work: () => Promise<DashboardSharing>) => {
    setBusy(true)
    setError(null)
    try {
      adopt(await work())
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const share = sharing?.share ?? null
  const url = share === null || share.token === '' ? null : dashboardUrl(share.token)
  const code = url === null || dashboard === null ? null : embedCode(url, dashboard.label)

  const copy = async (what: 'link' | 'code') => {
    const text = what === 'link' ? url : code
    if (text === null) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // A browser without clipboard access: the text stays selectable in its box.
    }
  }

  return (
    <>
      <Dialog open={dashboard !== null && !invite} onOpenChange={(o) => !o && !busy && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{$t('Partager « {label} »', { label: dashboard?.label })}</DialogTitle>
            <DialogDescription>
              {$t(
                'Invitez des personnes à la base, ou donnez un lien vers ce seul tableau de bord.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <UserPlus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {$t('Inviter à la base « {label} »', { label: base.label })}
              </p>
              <p className="text-xs text-muted-foreground">
                {$t(
                  'Les personnes invitées ouvrent le tableau de bord dans basedb, et chaque carte lit avec leurs propres droits.',
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setInvite(true)}>
              {$t('Partager la base…')}
            </Button>
          </div>

          {sharing === null && error === null ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-sm font-medium">{$t('Lien du tableau de bord')}</p>
                <p className="text-xs text-muted-foreground">
                  {$t(
                    'Lire ne demande aucun droit sur la base : le lien montre les cartes et les filtres du tableau, sans exploration ni accès aux lignes.',
                  )}
                </p>
              </div>

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
                      {$t('Lecture seule')}
                    </span>
                    <Label htmlFor="dashboard-share-active" className="text-xs font-normal">
                      {$t('Lien actif')}
                    </Label>
                    <Switch
                      id="dashboard-share-active"
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
                      aria-label={$t('Lien du tableau de bord')}
                      className="h-8 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => void copy('link')}
                      disabled={url === null}
                      aria-label={$t('Copier le lien')}
                      title={$t('Copier le lien')}
                    >
                      {copied === 'link' ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      asChild={url !== null}
                      disabled={url === null}
                      aria-label={$t('Ouvrir le tableau de bord partagé')}
                      title={$t('Ouvrir le tableau de bord partagé')}
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
                        {$t(
                          'L’ancien lien cessera de fonctionner immédiatement, pour tous ceux qui l’ont reçu.',
                        )}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setRenewing(false)}>
                        {$t('Annuler')}
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setRenewing(false)
                          if (id !== null)
                            void act(() => api.regenerateDashboardShare(baseName, id))
                        }}
                      >
                        {$t('Régénérer')}
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRenewing(true)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="size-3" />
                      {$t('Régénérer le lien')}
                    </button>
                  )}
                  {share.state === 'authority' && (
                    <p className="text-xs text-rose-700 dark:text-rose-400">
                      {$t(
                        '{value} ne voit plus cette base : le tableau de bord partagé est suspendu. Enregistrez pour en devenir la personne qui publie.',
                        { value: share.published_by.name ?? $t('La personne qui l’a publié') },
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>{$t('Qui peut lire')}</Label>
                <AccessChoice
                  value={access}
                  onChange={setAccess}
                  disabled={busy}
                  reading
                  subject={$t('le tableau de bord')}
                />
              </div>

              {access === 'members' && (sharing?.groups.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label>{$t('Réservé aux groupes')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {$t('Aucun coché : tout membre connecté lit le tableau de bord.')}
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {sharing?.groups.map((group) => (
                      <label
                        key={group.id}
                        htmlFor={`dashboard-share-group-${group.id}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={`dashboard-share-group-${group.id}`}
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
                        <span className="truncate">{groupName(group.label)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="dashboard-share-embed"
                    checked={canEmbed}
                    disabled={busy}
                    onCheckedChange={(checked) => {
                      setCanEmbed(checked)
                      if (share !== null) void save({ canEmbed: checked })
                    }}
                  />
                  <Label htmlFor="dashboard-share-embed" className="font-normal">
                    {$t('Autoriser l’intégration à un autre site')}
                  </Label>
                </div>
                {share?.can_embed === true && code !== null && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Code2 className="size-3.5" />
                      {$t('Code à coller dans la page qui intègre le tableau de bord :')}
                    </p>
                    <div className="flex items-start gap-2">
                      <textarea
                        readOnly
                        value={code}
                        rows={3}
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label={$t('Code d’intégration')}
                        className="min-w-0 flex-1 resize-none rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-snug"
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => void copy('code')}
                        aria-label={$t('Copier le code')}
                        title={$t('Copier le code')}
                      >
                        {copied === 'code' ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {share !== null && (
                <p className="text-xs text-muted-foreground">
                  {$t('Les cartes se lisent avec les droits de')}{' '}
                  <span className="font-medium text-foreground">
                    {share.published_by.name ?? $t('la personne qui l’a publié')}
                  </span>
                  {$t(', qui a enregistré ce partage en dernier.')}
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
                  if (id === null) return
                  void act(async () => {
                    await api.deleteDashboardShare(baseName, id)
                    return api.dashboardSharing(baseName, id)
                  })
                }}
              >
                {$t('Arrêter le partage')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {$t('Fermer')}
              </Button>
              <Button onClick={() => void save()} disabled={busy || sharing === null}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {share === null ? $t('Créer le lien') : $t('Enregistrer')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ShareAccessDialog
        target={
          dashboard !== null && invite ? { kind: 'base', id: base.id, label: base.label } : null
        }
        onClose={() => setInvite(false)}
      />
    </>
  )
}
