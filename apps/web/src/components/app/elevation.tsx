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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { ShieldCheck } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

/**
 * Elevation, asked for WHEN it is needed — chapter 05 §2.2.
 *
 * Administering people and permissions wants a session that proved its password within the
 * last five minutes. The screens do not ask up front: they act, and when the server answers
 * `ELEVATION_REQUIRED` this provider asks for the password, elevates, and replays the act.
 * Someone who elevated a minute ago is not asked again — the server knows, the screen need
 * not keep a clock of its own.
 */

/** Raised to the caller when the person closes the password dialog instead of answering. */
class ElevationCancelled extends Error {
  constructor() {
    super('ELEVATION_CANCELLED')
    this.name = 'ElevationCancelled'
  }
}

/** True when an act failed only because the person declined to confirm their password. */
export function cancelled(e: unknown): boolean {
  return e instanceof ElevationCancelled
}

type Elevated = <T>(act: () => Promise<T>) => Promise<T>

const Context = createContext<Elevated | null>(null)

/** Runs an administrative act, asking for the password first if the server wants it. */
export function useElevated(): Elevated {
  const run = useContext(Context)
  if (run === null) throw new Error('useElevated outside of <ElevationProvider>')
  return run
}

export function ElevationProvider({ children }: { readonly children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null)

  const ask = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        // A second request while the dialog is up joins the first: one password, both acts.
        const previous = pending.current
        pending.current = {
          resolve: () => {
            previous?.resolve()
            resolve()
          },
          reject: (e) => {
            previous?.reject(e)
            reject(e)
          },
        }
        setPassword('')
        setError(null)
        setOpen(true)
      }),
    [],
  )

  const run = useCallback<Elevated>(
    async (act) => {
      try {
        return await act()
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== 'ELEVATION_REQUIRED') throw e
        await ask()
        return act()
      }
    },
    [ask],
  )

  const close = () => {
    if (busy) return
    pending.current?.reject(new ElevationCancelled())
    pending.current = null
    setOpen(false)
  }

  const submit = async () => {
    if (password === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.elevate(password)
      setOpen(false)
      setPassword('')
      pending.current?.resolve()
      pending.current = null
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Context.Provider value={run}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              {$t('Confirmez votre mot de passe')}
            </DialogTitle>
            <DialogDescription>
              {$t(
                'Administrer les comptes et les droits demande une confirmation, valable cinq minutes.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="elevation-password">{$t('Mot de passe')}</Label>
            <Input
              id="elevation-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              autoFocus
              disabled={busy}
            />
            {error !== null && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {$t('Annuler')}
            </Button>
            <Button onClick={() => void submit()} disabled={password === '' || busy}>
              {busy ? $t('Vérification…') : $t('Confirmer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  )
}
