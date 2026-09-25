'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Me, api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

/**
 * The first screen of an account an administrator created, or whose password was reset.
 *
 * The password it signed in with was shown to someone else, so it is not the person's
 * own: nothing else opens until they choose one. The server keeps the flag until the
 * change goes through, so reloading the page lands here again.
 */
export function PasswordRequired({
  me,
  onDone,
  onSignOut,
}: {
  readonly me: Me
  readonly onDone: () => void
  readonly onSignOut: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The mismatch is caught here because it is not a server question: the server never
  // sees the confirmation field, and never should.
  const mismatched = confirm !== '' && next !== confirm
  const reused = next !== '' && next === current
  const ready = current !== '' && next !== '' && next === confirm && !reused && !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await api.changePassword(current, next)
      onDone()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
            <KeyRound className="size-6 text-muted-foreground" />
          </span>
          <h1 className="text-lg font-semibold">Choisissez votre mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            Bienvenue, {me.displayName}. Le mot de passe avec lequel vous venez de vous connecter
            est temporaire : remplacez-le par le vôtre pour continuer.
          </p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="temporary">Mot de passe temporaire</Label>
            <Input
              id="temporary"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Au moins 12 caractères, sans reprendre votre adresse ni votre nom.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmation</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatched && <p className="text-xs text-destructive">Les deux saisies diffèrent.</p>}
            {reused && (
              <p className="text-xs text-destructive">Choisissez un mot de passe différent.</p>
            )}
          </div>

          {error !== null && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={!ready}>
            {busy ? 'Enregistrement…' : 'Enregistrer et continuer'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Session de {me.email} ·{' '}
          <button type="button" onClick={onSignOut} className="underline underline-offset-2">
            se déconnecter
          </button>
        </p>
      </div>
    </main>
  )
}
