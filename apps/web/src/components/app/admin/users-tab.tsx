'use client'

import { initials, sinceWhen } from '@/components/app/admin/admin-panel'
import { cancelled, useElevated } from '@/components/app/elevation'
import { Badge } from '@/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type AdminUser, type Group, type Me, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  Check,
  Copy,
  Ellipsis,
  KeyRound,
  Loader2,
  Pencil,
  Search,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * The accounts of the tenant, created and reset without any e-mail.
 *
 * basedb sends no mail, so an account is created with a TEMPORARY password shown once to
 * the administrator, who hands it over; the person chooses their own at first sign-in.
 * The same goes for a reset. Nothing here ever shows a password again.
 *
 * An account is disabled rather than deleted: its name stays on what it wrote, its
 * sessions and tokens stop at once, and it can be brought back.
 */

type Dialogs =
  | { readonly kind: 'new' }
  | { readonly kind: 'edit'; readonly user: AdminUser }
  | { readonly kind: 'reset'; readonly user: AdminUser }
  | { readonly kind: 'disable'; readonly user: AdminUser }
  | { readonly kind: 'password'; readonly user: AdminUser; readonly password: string }

export function UsersTab({ me }: { readonly me: Me }) {
  const elevated = useElevated()
  const [users, setUsers] = useState<readonly AdminUser[] | null>(null)
  const [groups, setGroups] = useState<readonly Group[]>([])
  const [filter, setFilter] = useState('')
  const [dialog, setDialog] = useState<Dialogs | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [u, g] = await Promise.all([api.users(), api.groups()])
      setUsers(u)
      setGroups(g)
    } catch (e) {
      setError(messageFor(e))
      setUsers([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const all = users ?? []
    return needle === ''
      ? all
      : all.filter((u) => `${u.display_name} ${u.email}`.toLowerCase().includes(needle))
  }, [users, filter])

  /** Runs an act that may need the password, then reloads; a refusal lands in the banner. */
  const act = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await elevated(fn)
      await load()
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    }
  }

  const active = (users ?? []).filter((u) => !u.disabled).length

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">
            {users === null
              ? 'Chargement…'
              : `${active} ${active > 1 ? 'comptes actifs' : 'compte actif'}${
                  users.length > active ? `, ${users.length - active} désactivé(s)` : ''
                }.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher"
              aria-label="Rechercher un utilisateur"
              className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <UserPlus className="size-4" />
            Nouvel utilisateur
          </Button>
        </div>
      </div>

      {error !== null && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Groupes</th>
              <th className="px-3 py-2 font-medium">Dernière activité</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users === null && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </td>
              </tr>
            )}
            {shown.map((u) => (
              <tr key={u.id} className={cn(u.disabled && 'text-muted-foreground')}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                        u.disabled ? 'bg-muted' : 'bg-primary/10 text-primary',
                      )}
                    >
                      {initials(u.display_name, u.email)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{u.display_name}</span>
                        {u.email === me.email ? (
                          <span className="text-xs text-muted-foreground">(vous)</span>
                        ) : null}
                        {u.is_admin && <Badge variant="secondary">Administrateur</Badge>}
                        {u.disabled && <Badge variant="outline">Désactivé</Badge>}
                        {!u.disabled && u.must_change_password && (
                          <Badge variant="outline">Mot de passe temporaire</Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {u.groups
                      .filter((g) => groups.find((x) => x.id === g.id)?.system !== 'everyone')
                      .map((g) => (
                        <Badge key={g.id} variant="outline" className="font-normal">
                          {g.label}
                        </Badge>
                      ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                  {sinceWhen(u.last_seen_at)}
                </td>
                <td className="px-3 py-2.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions sur ${u.email}`}>
                        <Ellipsis className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => setDialog({ kind: 'edit', user: u })}>
                        <Pencil className="size-4" />
                        Modifier…
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setDialog({ kind: 'reset', user: u })}
                        disabled={u.disabled}
                      >
                        <KeyRound className="size-4" />
                        Réinitialiser le mot de passe…
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.disabled ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            void act(async () => {
                              await api.updateUser(u.id, { disabled: false })
                            })
                          }
                        >
                          <UserCheck className="size-4" />
                          Réactiver le compte
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => setDialog({ kind: 'disable', user: u })}
                          disabled={u.email === me.email}
                          className="text-destructive focus:text-destructive"
                        >
                          <UserX className="size-4" />
                          Désactiver le compte…
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {users !== null && shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Aucun utilisateur ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UserDialog
        open={dialog?.kind === 'new' || dialog?.kind === 'edit'}
        user={dialog?.kind === 'edit' ? dialog.user : null}
        groups={groups}
        onClose={() => setDialog(null)}
        onCreated={(user, password) => {
          setDialog({ kind: 'password', user, password })
          void load()
        }}
        onSaved={() => {
          setDialog(null)
          void load()
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'reset'}
        title="Réinitialiser le mot de passe ?"
        body={
          dialog?.kind === 'reset'
            ? `Un mot de passe temporaire remplacera celui de ${dialog.user.display_name}, et ses sessions ouvertes seront fermées. Un nouveau mot de passe lui sera demandé à sa prochaine connexion.`
            : ''
        }
        action="Réinitialiser"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== 'reset') return
          const user = dialog.user
          const reset = await elevated(() => api.resetUserPassword(user.id))
          setDialog({ kind: 'password', user, password: reset.temporary_password })
          void load()
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'disable'}
        title="Désactiver ce compte ?"
        body={
          dialog?.kind === 'disable'
            ? `${dialog.user.display_name} ne pourra plus se connecter ; ses sessions et ses jetons d’intégration cessent immédiatement. Ses écritures restent signées de son nom, et le compte peut être réactivé.`
            : ''
        }
        action="Désactiver"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== 'disable') return
          const user = dialog.user
          await elevated(() => api.updateUser(user.id, { disabled: true }))
          setDialog(null)
          void load()
        }}
      />

      <PasswordDialog
        open={dialog?.kind === 'password'}
        user={dialog?.kind === 'password' ? dialog.user : null}
        password={dialog?.kind === 'password' ? dialog.password : ''}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

/**
 * Creates an account, or edits one: the name, and the groups it belongs to.
 *
 * « Tous les utilisateurs » is not offered: everyone is in it, always. « Administrateurs »
 * is offered like any other group — being an administrator IS belonging to it.
 */
function UserDialog({
  open,
  user,
  groups,
  onClose,
  onCreated,
  onSaved,
}: {
  readonly open: boolean
  readonly user: AdminUser | null
  readonly groups: readonly Group[]
  readonly onClose: () => void
  readonly onCreated: (user: AdminUser, password: string) => void
  readonly onSaved: () => void
}) {
  const elevated = useElevated()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEmail(user?.email ?? '')
    setName(user?.display_name ?? '')
    setChosen(new Set((user?.groups ?? []).map((g) => g.id)))
    setError(null)
  }, [open, user])

  const choosable = groups.filter((g) => g.system !== 'everyone')
  const ready = (user !== null || email.trim() !== '') && name.trim() !== '' && !busy

  const toggle = (id: string, on: boolean) =>
    setChosen((was) => {
      const next = new Set(was)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      if (user === null) {
        const created = await elevated(() =>
          api.createUser({ email: email.trim(), displayName: name.trim(), groups: [...chosen] }),
        )
        onCreated(created.user, created.temporary_password)
      } else {
        await elevated(async () => {
          if (name.trim() !== user.display_name) {
            await api.updateUser(user.id, { display_name: name.trim() })
          }
          const before = new Set(user.groups.map((g) => g.id))
          const same = before.size === chosen.size && [...chosen].every((id) => before.has(id))
          if (!same) await api.setUserGroups(user.id, [...chosen])
        })
        onSaved()
      }
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {user === null ? 'Nouvel utilisateur' : 'Modifier l’utilisateur'}
          </DialogTitle>
          <DialogDescription>
            {user === null
              ? 'Un mot de passe temporaire sera affiché une seule fois : transmettez-le à la personne, qui en choisira un à sa première connexion.'
              : user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {user === null && (
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Adresse électronique</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@exemple.fr"
                autoFocus
                disabled={busy}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Nom affiché</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Prénom Nom"
              autoFocus={user !== null}
              disabled={busy}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">Groupes</legend>
            <p className="text-xs text-muted-foreground">
              Tout le monde fait partie de « Tous les utilisateurs ».
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 scroll-discret">
              {choosable.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    id={`user-group-${g.id}`}
                    checked={chosen.has(g.id)}
                    onCheckedChange={(on) => toggle(g.id, on === true)}
                    disabled={busy}
                  />
                  <label htmlFor={`user-group-${g.id}`} className="flex-1 cursor-pointer">
                    {g.label}
                  </label>
                  {g.system === 'admins' && (
                    <span className="text-xs text-muted-foreground">tous les droits</span>
                  )}
                </div>
              ))}
              {choosable.length === 0 && (
                <p className="px-1.5 py-1 text-sm text-muted-foreground">Aucun groupe.</p>
              )}
            </div>
          </fieldset>

          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!ready}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {user === null ? 'Créer le compte' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The temporary password, shown once, with a button to copy it. */
function PasswordDialog({
  open,
  user,
  password,
  onClose,
}: {
  readonly open: boolean
  readonly user: AdminUser | null
  readonly password: string
  readonly onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) setCopied(false)
  }, [open])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mot de passe temporaire</DialogTitle>
          <DialogDescription>
            Transmettez-le à {user?.display_name ?? 'la personne'} ({user?.email}). Il ne sera plus
            jamais affiché ; un nouveau mot de passe lui sera demandé à sa première connexion.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-base tracking-wide select-all">
            {password}
          </code>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Terminé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A yes-or-no question whose « yes » may fail: the refusal is shown in the dialog. */
export function ConfirmDialog({
  open,
  title,
  body,
  action,
  destructive = false,
  onClose,
  onConfirm,
}: {
  readonly open: boolean
  readonly title: string
  readonly body: string
  readonly action: string
  readonly destructive?: boolean
  readonly onClose: () => void
  readonly onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
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
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
