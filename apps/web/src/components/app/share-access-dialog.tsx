'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { type AccessLevel, type Invitation, type Sharing, api } from '@/lib/api/client'
import { $t, groupName, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Check, Copy, Link2, Loader2, UserPlus, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Sharing a project or a base — chapter 05 §15.8.
 *
 * Its managers invite people by a link, at a level, see who has access and change it. A
 * link, not an email: basedb sends none, and whoever invites sends it the way their team
 * talks. It is shown again as long as it waits, so it can be resent.
 */

export interface ShareTarget {
  readonly kind: 'project' | 'base'
  readonly id: string
  readonly label: string
}

type Level = Exclude<AccessLevel, 'none'>

const LEVELS: ReadonlyArray<{ id: Level; label: string; hint: string }> = [
  { id: 'read', label: $t('Lecture'), hint: $t('Voir les lignes') },
  { id: 'edit', label: $t('Modification'), hint: $t('Ajouter, modifier, supprimer des lignes') },
  { id: 'manage', label: $t('Gestion'), hint: $t('Et changer la structure, partager') },
]

const LABELS: Readonly<Record<AccessLevel | 'granular', string>> = {
  none: $t('Aucun accès'),
  read: $t('Lecture'),
  edit: $t('Modification'),
  manage: $t('Gestion'),
  granular: $t('Accès partiel'),
}

/** The page an invitation's link opens, on this very interface. */
export const invitationUrl = (token: string) =>
  `${window.location.origin}/invitation/${encodeURIComponent(token)}`

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

/** Copies a link, and says so for a moment. */
function CopyButton({ text, label }: { readonly text: string; readonly label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true))
      }}
      aria-label={label}
    >
      {copied ? (
        <Check className="animate-in zoom-in-50 text-primary duration-200" />
      ) : (
        <Copy className="animate-in fade-in duration-200" />
      )}
      <span aria-live="polite">{copied ? $t('Copié') : $t('Copier')}</span>
    </Button>
  )
}

export function ShareAccessDialog({
  target,
  onClose,
}: {
  readonly target: ShareTarget | null
  readonly onClose: () => void
}) {
  const [sharing, setSharing] = useState<Sharing | null>(null)
  const [email, setEmail] = useState('')
  const [level, setLevel] = useState<Level>('edit')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<Invitation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (target === null) return
    try {
      setSharing(await api.sharing(target.kind, target.id))
    } catch (e) {
      setError(messageFor(e))
    }
  }, [target])

  useEffect(() => {
    setSharing(null)
    setFresh(null)
    setError(null)
    setEmail('')
    void load()
  }, [load])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (target === null || busy || email.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      const made = await api.invite(target.kind, target.id, email.trim(), level)
      setFresh(made)
      setEmail('')
      await load()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const change = async (user: string, next: AccessLevel) => {
    if (target === null) return
    setError(null)
    try {
      setSharing(await api.setPersonAccess(target.kind, target.id, user, next))
    } catch (e) {
      setError(messageFor(e))
    }
  }

  const revoke = async (id: string) => {
    setError(null)
    try {
      await api.revokeInvitation(id)
      if (fresh?.id === id) setFresh(null)
      await load()
    } catch (e) {
      setError(messageFor(e))
    }
  }

  const pending = sharing?.invitations.filter((i) => i.id !== fresh?.id) ?? []

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{$t('Partager « {label} »', { label: target?.label })}</DialogTitle>
          <DialogDescription>
            {target?.kind === 'project'
              ? $t('Invitez des personnes dans ce projet : elles accèdent à toutes ses bases.')
              : $t('Invitez des personnes dans cette base seulement.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={invite} className="flex gap-2">
          <Input
            type="email"
            placeholder="adresse@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={$t('Adresse de la personne à inviter')}
            disabled={busy}
            className="min-w-0 flex-1"
          />
          <Select value={level} onValueChange={(v) => setLevel(v as Level)} disabled={busy}>
            <SelectTrigger className="w-40" aria-label={$t('Niveau d’accès')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {LEVELS.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={busy || email.trim() === ''}>
            {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {$t('Inviter')}
          </Button>
        </form>
        {/* What the chosen level allows, said once, under the choice. */}
        <p
          key={level}
          className="-mt-2 animate-in fade-in text-xs text-muted-foreground duration-200"
        >
          {LEVELS.find((l) => l.id === level)?.label} :{' '}
          {LEVELS.find((l) => l.id === level)?.hint.toLowerCase()}.
        </p>

        {fresh !== null && (
          // The link just made: the one thing to do now is to send it.
          <div className="grid animate-in fade-in slide-in-from-top-2 gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 duration-300">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="size-4 text-primary" />
              {$t('Lien d’invitation pour {email}', { email: fresh.email })}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={invitationUrl(fresh.token)}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 font-mono text-xs"
                aria-label={$t('Lien d’invitation')}
              />
              <CopyButton
                text={invitationUrl(fresh.token)}
                label={$t('Copier le lien d’invitation')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {$t(
                'Envoyez-le à cette personne : valable 7 jours, pour une seule personne. Elle se connecte, ou crée son compte, en l’ouvrant.',
              )}
            </p>
          </div>
        )}

        {error !== null && (
          <p role="alert" className="animate-shake text-sm text-destructive">
            {error}
          </p>
        )}

        {sharing === null && error === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          sharing !== null && (
            <div className="grid max-h-[50vh] gap-4 overflow-y-auto pr-1">
              <section className="grid gap-1">
                <h3 className="text-xs font-medium text-muted-foreground">{$t('Personnes')}</h3>
                {sharing.people.length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">
                    {$t('Personne pour l’instant.')}
                  </p>
                )}
                {sharing.people.map((p, i) => (
                  <div
                    key={p.user_id}
                    className="flex animate-in fade-in items-center gap-3 rounded-md px-1 py-1.5 duration-300 fill-mode-both"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                      {initials(p.display_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.display_name}
                        {p.you && (
                          <span className="font-normal text-muted-foreground"> {$t('(vous)')}</span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.email}
                      </span>
                    </span>
                    {p.you || p.from === 'project' || p.level === 'granular' ? (
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {LABELS[p.level]}
                        {p.from === 'project' && $t(' · via le projet')}
                      </span>
                    ) : (
                      <Select
                        value={p.level}
                        onValueChange={(v) => void change(p.user_id, v as AccessLevel)}
                      >
                        <SelectTrigger
                          className="h-8 w-36 shrink-0"
                          aria-label={$t('Accès de {display_name}', {
                            display_name: p.display_name,
                          })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {LEVELS.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="none" className="text-destructive">
                            {$t('Retirer l’accès')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </section>

              {sharing.groups.length > 0 && (
                <section className="grid gap-1">
                  <h3 className="text-xs font-medium text-muted-foreground">{$t('Groupes')}</h3>
                  {sharing.groups.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 px-1 py-1.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                        <Users className="size-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{groupName(g.label)}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {LABELS[g.level]}
                      </span>
                    </div>
                  ))}
                  <p className="px-1 text-xs text-muted-foreground">
                    {$t('Les groupes se règlent dans l’administration.')}
                  </p>
                </section>
              )}

              {pending.length > 0 && (
                <section className="grid gap-1">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    {$t('Invitations en attente')}
                  </h3>
                  {pending.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-2 px-1 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{inv.email}</span>
                        <span className="block text-xs text-muted-foreground">
                          {$t('{labels} · expire le {intlLocale}', {
                            labels: LABELS[inv.level],
                            intlLocale: new Date(inv.expires_at).toLocaleDateString(intlLocale(), {
                              day: 'numeric',
                              month: 'long',
                            }),
                          })}
                        </span>
                      </span>
                      <CopyButton
                        text={invitationUrl(inv.token)}
                        label={$t('Copier le lien pour {email}', { email: inv.email })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void revoke(inv.id)}
                        aria-label={$t('Annuler l’invitation de {email}', { email: inv.email })}
                        className={cn('text-muted-foreground hover:text-destructive')}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </section>
              )}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
