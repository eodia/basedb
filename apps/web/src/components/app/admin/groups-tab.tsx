'use client'

import { initials } from '@/components/app/admin/admin-panel'
import { ConfirmDialog } from '@/components/app/admin/users-tab'
import { cancelled, useElevated } from '@/components/app/elevation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type AdminUser, type Group, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Loader2, Lock, Pencil, Plus, Trash2, UserMinus, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Groups and who is in them — Metabase's « Groups ».
 *
 * Rights are granted to groups, never to a person: to give someone access, one puts them
 * in a group that has it. Two groups come with every tenant and cannot be renamed or
 * removed — « Administrateurs », who hold every right, and « Tous les utilisateurs »,
 * which everyone belongs to and which therefore starts with nothing.
 */

type Member = { readonly id: string; readonly email: string; readonly display_name: string }

export function GroupsTab() {
  const elevated = useElevated()
  const [groups, setGroups] = useState<readonly Group[] | null>(null)
  const [users, setUsers] = useState<readonly AdminUser[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [members, setMembers] = useState<readonly Member[] | null>(null)
  const [adding, setAdding] = useState('')
  const [naming, setNaming] = useState<{ readonly group: Group | null } | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [g, u] = await Promise.all([api.groups(), api.users()])
      setGroups(g)
      setUsers(u)
      setSelected((was) => (was !== null && g.some((x) => x.id === was) ? was : (g[0]?.id ?? null)))
    } catch (e) {
      setError(messageFor(e))
      setGroups([])
    }
  }, [])

  const loadMembers = useCallback(async (id: string) => {
    setMembers(null)
    try {
      setMembers(await api.groupMembers(id))
    } catch (e) {
      setError(messageFor(e))
      setMembers([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setAdding('')
    if (selected !== null) void loadMembers(selected)
  }, [selected, loadMembers])

  const group = groups?.find((g) => g.id === selected) ?? null

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await elevated(fn)
      await load()
      if (selected !== null) await loadMembers(selected)
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    }
  }

  const candidates = users.filter((u) => !u.disabled && !(members ?? []).some((m) => m.id === u.id))

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Groupes</h1>
          <p className="text-sm text-muted-foreground">
            Les droits s’accordent à des groupes : pour donner un accès à une personne, placez-la
            dans un groupe qui l’a.
          </p>
        </div>
        <Button onClick={() => setNaming({ group: null })}>
          <Plus className="size-4" />
          Nouveau groupe
        </Button>
      </div>

      {error !== null && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <ul className="h-fit overflow-hidden rounded-lg border">
          {groups === null && (
            <li className="px-3 py-4 text-center">
              <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
            </li>
          )}
          {(groups ?? []).map((g) => (
            <li key={g.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => setSelected(g.id)}
                aria-current={g.id === selected ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60',
                  g.id === selected && 'bg-accent',
                )}
              >
                <Users className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{g.label}</span>
                {g.system !== null && <Lock className="size-3 text-muted-foreground" />}
                <span className="text-xs tabular-nums text-muted-foreground">{g.member_count}</span>
              </button>
            </li>
          ))}
        </ul>

        {group !== null && (
          <section className="rounded-lg border">
            <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <h2 className="text-base font-semibold">{group.label}</h2>
              {group.system !== null && <Badge variant="secondary">Groupe fourni par basedb</Badge>}
              <div className="flex-1" />
              {group.system === null && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setNaming({ group })}>
                    <Pencil className="size-4" />
                    Renommer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(group)}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                </>
              )}
            </header>

            <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">
              {group.system === 'admins'
                ? 'Les administrateurs ont tous les droits sur tous les projets, et administrent les comptes et les permissions.'
                : group.system === 'everyone'
                  ? 'Chaque compte fait partie de ce groupe. Ce qui lui est accordé, tout le monde l’a : il ne reçoit donc rien par défaut.'
                  : 'Les droits de ce groupe se règlent dans l’onglet Permissions.'}
            </p>

            {group.system !== 'everyone' && (
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Select value={adding} onValueChange={setAdding}>
                  <SelectTrigger className="max-w-sm" aria-label="Personne à ajouter">
                    <SelectValue placeholder="Ajouter une personne…" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={adding === ''}
                  onClick={() =>
                    void act(async () => {
                      await api.setGroupMember(group.id, adding, true)
                      setAdding('')
                    })
                  }
                >
                  Ajouter
                </Button>
              </div>
            )}

            <ul className="divide-y">
              {members === null && (
                <li className="px-4 py-4 text-center">
                  <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                </li>
              )}
              {(members ?? []).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                    {initials(m.display_name, m.email)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.display_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                  </span>
                  {group.system !== 'everyone' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Retirer ${m.email} du groupe`}
                      title="Retirer du groupe"
                      onClick={() => void act(() => api.setGroupMember(group.id, m.id, false))}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
              {members !== null && members.length === 0 && (
                <li className="px-4 py-4 text-sm text-muted-foreground">Aucun membre.</li>
              )}
            </ul>
          </section>
        )}
      </div>

      <GroupDialog
        open={naming !== null}
        group={naming?.group ?? null}
        onClose={() => setNaming(null)}
        onDone={(id) => {
          setNaming(null)
          void load().then(() => setSelected(id))
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Supprimer « ${deleting?.label ?? ''} » ?`}
        body="Ses membres perdent les droits que ce groupe leur donnait. Leurs comptes restent intacts."
        action="Supprimer le groupe"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting === null) return
          const id = deleting.id
          await elevated(() => api.deleteGroup(id))
          setDeleting(null)
          setSelected(null)
          await load()
        }}
      />
    </div>
  )
}

function GroupDialog({
  open,
  group,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly group: Group | null
  readonly onClose: () => void
  readonly onDone: (id: string) => void
}) {
  const elevated = useElevated()
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel(group?.label ?? '')
    setError(null)
  }, [open, group])

  const submit = async () => {
    const trimmed = label.trim()
    if (trimmed === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      if (group === null) {
        const created = await elevated(() => api.createGroup(trimmed))
        onDone(created.id)
      } else {
        if (trimmed !== group.label) await elevated(() => api.renameGroup(group.id, trimmed))
        onDone(group.id)
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
          <DialogTitle>{group === null ? 'Nouveau groupe' : 'Renommer le groupe'}</DialogTitle>
          <DialogDescription>
            Un groupe réunit des personnes qui doivent avoir les mêmes droits — une équipe, un
            service, un rôle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="group-label">Nom du groupe</Label>
          <Input
            id="group-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="Ex. Comptabilité"
            autoFocus
            disabled={busy}
          />
          {error !== null && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={label.trim() === '' || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {group === null ? 'Créer le groupe' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
