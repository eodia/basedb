'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { type ThemePreference, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Monitor,
  MonitorSmartphone,
  Moon,
  Sun,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The profile, bottom-left — the one corner of the screen that is about the reader
 * rather than about the data.
 *
 * It holds the three things a session-holder acts on: how the product looks, the
 * password, and the way out. Open sessions get a panel of their own, because "où suis-je
 * connecté" is a security question and deserves more than a menu line.
 *
 * Above them, what the sidebar hands it: the entries that are not the data itself —
 * documentation, integrations, administration —, kept out of the column.
 */

interface Props {
  readonly user: { readonly displayName: string; readonly email: string }
  /** The reduced sidebar: the avatar alone, the name in a tooltip. */
  readonly compact?: boolean
  /** Menu items shown first, under the name. */
  readonly entries?: React.ReactNode
  readonly onSignedOut: () => void
}

export function UserMenu({ user, compact = false, entries, onSignedOut }: Props) {
  const preference = useTheme((s) => s.preference)
  const setPreference = useTheme((s) => s.setPreference)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)

  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={compact ? user.displayName : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent',
          compact && 'justify-center p-1',
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials}</AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    </DropdownMenuTrigger>
  )

  return (
    <>
      <DropdownMenu>
        {compact ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">{user.displayName}</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}

        {/* `side="top"`: the trigger sits at the bottom of the window, and a menu opening
            downwards would be clipped by it. */}
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm text-foreground">{user.displayName}</span>
            <span className="block truncate">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {entries !== undefined && (
            <>
              {entries}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {preference === 'system' ? (
                <Monitor className="size-4" />
              ) : preference === 'dark' ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
              Apparence
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuRadioGroup
                value={preference}
                onValueChange={(v) => setPreference(v as ThemePreference)}
              >
                <DropdownMenuRadioItem value="system">
                  <Monitor className="size-4" />
                  Suivre le système
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">
                  <Sun className="size-4" />
                  Clair
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="size-4" />
                  Sombre
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound className="size-4" />
            Changer le mot de passe
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSessionsOpen(true)}>
            <MonitorSmartphone className="size-4" />
            Sessions ouvertes
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              void api.logout().finally(onSignedOut)
            }}
          >
            <LogOut className="size-4" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <SessionsDialog open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </>
  )
}

function PasswordDialog({
  open,
  onClose,
}: { readonly open: boolean; readonly onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
    setDone(false)
  }, [open])

  // The mismatch is caught here because it is not a server question: the server never
  // sees the confirmation field, and never should.
  const mismatched = confirm !== '' && next !== confirm
  const ready = current !== '' && next !== '' && next === confirm && !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await api.changePassword(current, next)
      setDone(true)
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
          <DialogTitle>Changer le mot de passe</DialogTitle>
          <DialogDescription>Vos autres sessions seront déconnectées.</DialogDescription>
        </DialogHeader>

        {done ? (
          <p className="text-sm">Mot de passe changé.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="current">Mot de passe actuel</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">Nouveau mot de passe</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmation</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
              {mismatched && (
                <p className="text-xs text-destructive">Les deux saisies diffèrent.</p>
              )}
            </div>
            {error !== null && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {done ? 'Fermer' : 'Annuler'}
          </Button>
          {!done && (
            <Button disabled={!ready} onClick={() => void submit()}>
              {busy ? 'Enregistrement…' : 'Changer'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Session {
  readonly id: string
  readonly created_at: string
  readonly last_seen_at: string
  readonly ip: string | null
  readonly user_agent: string | null
  readonly current: boolean
}

function SessionsDialog({
  open,
  onClose,
}: { readonly open: boolean; readonly onClose: () => void }) {
  const [sessions, setSessions] = useState<readonly Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSessions(await api.sessions())
    } catch (e) {
      setError(messageFor(e))
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sessions ouvertes</DialogTitle>
          <DialogDescription>Les appareils connectés à votre compte.</DialogDescription>
        </DialogHeader>

        {error !== null && <p className="text-sm text-destructive">{error}</p>}

        <ul className="max-h-72 space-y-2 overflow-y-auto scroll-discret">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {session.user_agent ?? 'Appareil inconnu'}
                  {session.current && (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Celle-ci
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.ip ?? 'adresse inconnue'} — vue le{' '}
                  {new Date(session.last_seen_at).toLocaleString('fr-FR')}
                </p>
              </div>
              {!session.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await api.revokeSession(session.id).catch((e) => setError(messageFor(e)))
                    await load()
                  }}
                >
                  Fermer
                </Button>
              )}
            </li>
          ))}
          {sessions.length === 0 && error === null && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              Aucune autre session.
            </li>
          )}
        </ul>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy || sessions.length < 2}
            onClick={async () => {
              setBusy(true)
              // This one closes THIS session too, server-side — so the screen must not
              // pretend otherwise. It reloads, and the login screen comes back.
              await api.revokeOtherSessions().catch((e) => setError(messageFor(e)))
              setBusy(false)
              window.location.reload()
            }}
          >
            Tout fermer
          </Button>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
