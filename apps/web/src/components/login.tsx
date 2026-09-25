'use client'

import { Clouds } from '@/components/clouds'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { useEffect, useState } from 'react'

/**
 * Login screen — chapter 13.
 *
 * ONE message for every failure: « Identifiants incorrects, ou compte indisponible. »
 * Unknown address, wrong password, disabled, locked or deleted account — the interface
 * shows the same sentence, because the API answers the same code, because none of them
 * is something a stranger may learn.
 */

export function Login({ onSignedIn }: { readonly onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [providers, setProviders] = useState<ReadonlyArray<{ slug: string; label: string }>>([])

  useEffect(() => {
    let alive = true
    // In development the server publishes the bootstrapped ADDRESS so the field is
    // prefilled. Never the password: that one is printed once in the server's output.
    void api.developmentAccount().then((account) => {
      if (alive && account !== null) setEmail(account.email)
    })
    // Nothing here depends on an address: before authentication, no route says anything
    // about who holds an account.
    void api
      .oidcProviders()
      .then((found) => {
        if (alive) setProviders(found)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.login(email, password)
      onSignedIn()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Clouds />
      <main className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="w-[min(26rem,92vw)] rounded-2xl border border-white/10 bg-zinc-950/80 p-7 text-zinc-100 shadow-2xl backdrop-blur-md">
          <h1 className="text-2xl font-semibold tracking-tight">basedb</h1>
          <p className="mt-1 mb-6 text-sm text-zinc-400">Des tables PostgreSQL nommées en clair.</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm text-zinc-400">
                Adresse
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-white/15 bg-white/5 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm text-zinc-400">
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-white/15 bg-white/5 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={busy || email === '' || password === ''}
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>

          {providers.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-3 text-xs text-zinc-500">
                <span className="h-px flex-1 bg-white/10" />
                ou
                <span className="h-px flex-1 bg-white/10" />
              </div>
              {providers.map((p) => (
                // A LINK, not a button with a fetch: the route answers with a redirect
                // to the provider, and the browser must follow it itself.
                <a
                  key={p.slug}
                  href={api.oidcStartUrl(p.slug)}
                  className="mb-2 block rounded-md border border-white/15 bg-white/5 py-2 text-center text-sm font-medium transition-colors hover:bg-white/10"
                >
                  Continuer avec {p.label}
                </a>
              ))}
            </div>
          )}

          {error !== null && (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <p className="mt-5 text-xs text-zinc-500">
            Premier démarrage : le mot de passe administrateur s’affiche dans le terminal du
            serveur.
          </p>
        </div>
      </main>
    </>
  )
}
