'use client'

import {
  AuthLayout,
  FormError,
  PRESSABLE,
  PasswordInput,
  REVEAL,
  pauseOnSuccess,
  revealAt,
} from '@/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { reasonFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Login screen — chapter 13.
 *
 * ONE message for every failure: « Identifiants incorrects, ou compte indisponible. »
 * Unknown address, wrong password, disabled, locked or deleted account — the interface
 * shows the same sentence, because the API answers the same code, because none of them
 * is something a stranger may learn.
 */

export function Login({
  onSignedIn,
  onSignUp,
  title = $t('Heureux de vous retrouver'),
  description = $t('Connectez-vous pour retrouver vos bases et vos tables.'),
  initialEmail = '',
  alwaysOfferSignUp = false,
  returnTo = '/',
}: {
  readonly onSignedIn: () => void
  /** Offered when the instance lets anyone create an account. */
  readonly onSignUp?: () => void
  /** What the screen says above the form — an invitation says what it offers. */
  readonly title?: string
  readonly description?: string
  readonly initialEmail?: string
  /** Offer creating an account whatever the instance's policy — an invitation admits it. */
  readonly alwaysOfferSignUp?: boolean
  /** Where a sign-in provider sends the browser back — the invitation's page, say. */
  readonly returnTo?: string
}) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ readonly text: string; readonly attempt: number } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)

  useEffect(() => {
    let alive = true
    // In development the server publishes the bootstrapped ADDRESS so the field is
    // prefilled. Never the password: that one is printed once in the server's output.
    void api.developmentAccount().then((account) => {
      if (alive && account !== null) setEmail(account.email)
    })
    // Back from a sign-in provider that refused: the code travels in the address, and is
    // taken out of it once read — a reload must not show it again.
    const params = new URLSearchParams(window.location.search)
    const refused = params.get('connexion')
    if (refused !== null) {
      setError({ text: reasonFor(new ApiError(refused, 400, '', {})), attempt: 1 })
      params.delete('connexion')
      const rest = params.toString()
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${rest === '' ? '' : `?${rest}`}`,
      )
    }
    void api.signupPolicy().then((policy) => {
      if (alive) setSignupOpen(policy !== null)
    })
    return () => {
      alive = false
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.login(email, password)
      setSignedIn(true)
      await pauseOnSuccess()
      onSignedIn()
    } catch (e) {
      // A new attempt number for each refusal, so the message shakes again.
      setError((was) => ({ text: reasonFor(e), attempt: (was?.attempt ?? 0) + 1 }))
      setBusy(false)
    }
  }

  const described = error !== null ? 'login-error' : undefined

  return (
    <AuthLayout
      title={title}
      description={description}
      footer={
        (signupOpen || alwaysOfferSignUp) && onSignUp !== undefined ? (
          <p>
            {$t('Pas encore de compte ?')}{' '}
            <button
              type="button"
              onClick={onSignUp}
              className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {$t('Créer un compte')}
            </button>
          </p>
        ) : (
          <details className="group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              {$t('Première connexion ?')}
              <ChevronDown
                className="size-3.5 transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-2 max-w-sm animate-in fade-in slide-in-from-top-1 leading-relaxed duration-300">
              {$t(
                'Votre administrateur crée votre compte et vous transmet un mot de passe temporaire. Si l’instance a été installée avec une adresse d’administrateur imposée, son mot de passe s’est affiché une seule fois dans les journaux du serveur.',
              )}
            </p>
          </details>
        )
      }
    >
      <form onSubmit={submit} className="grid gap-5" aria-busy={busy}>
        <div className={cn('group grid gap-2', REVEAL)} style={revealAt(0)}>
          <Label htmlFor="email" className="transition-colors group-focus-within:text-primary">
            {$t('Adresse e-mail')}
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="vous@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            aria-describedby={described}
            className="h-10"
          />
        </div>

        <div className={cn('group grid gap-2', REVEAL)} style={revealAt(1)}>
          <Label htmlFor="password" className="transition-colors group-focus-within:text-primary">
            {$t('Mot de passe')}
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            visible={passwordVisible}
            onVisibleChange={setPasswordVisible}
            required
            disabled={busy}
            aria-describedby={described}
            className="h-10"
          />
        </div>

        {error !== null && (
          <FormError key={error.attempt} id="login-error">
            {error.text}
          </FormError>
        )}

        <div className={REVEAL} style={revealAt(2)}>
          <Button
            type="submit"
            size="lg"
            className={cn('mt-1 w-full', PRESSABLE)}
            disabled={busy || email === '' || password === ''}
          >
            {signedIn ? (
              <Check className="animate-in zoom-in-50 duration-200" aria-hidden="true" />
            ) : (
              busy && <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            <span aria-live="polite">
              {signedIn ? $t('Connecté') : busy ? $t('Connexion…') : $t('Se connecter')}
            </span>
          </Button>
        </div>
      </form>

      <OidcButtons returnTo={returnTo} />
    </AuthLayout>
  )
}

/**
 * « Continuer avec … » — the sign-in providers the instance declares (chapter 13 §3).
 * Nothing when there are none. The same buttons sign in and sign up: a first sign-in
 * creates the account when the instance lets anyone create one.
 */
export function OidcButtons({ returnTo = '/' }: { readonly returnTo?: string }) {
  const [providers, setProviders] = useState<ReadonlyArray<{ slug: string; label: string }>>([])

  useEffect(() => {
    let alive = true
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

  if (providers.length === 0) return null
  return (
    <div className={cn('mt-6 grid gap-2', REVEAL)} style={revealAt(5)}>
      <div className="mb-1 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        {$t('ou')}
      </div>
      {providers.map((p) => (
        // A LINK, not a button with a fetch: the route answers with a redirect to the
        // provider, and the browser must follow it itself.
        <Button
          key={p.slug}
          variant="outline"
          size="lg"
          className={cn('w-full', PRESSABLE, 'hover:shadow-none')}
          asChild
        >
          <a href={api.oidcStartUrl(p.slug, returnTo)}>
            {$t('Continuer avec {label}', { label: p.label })}
          </a>
        </Button>
      ))}
    </div>
  )
}
