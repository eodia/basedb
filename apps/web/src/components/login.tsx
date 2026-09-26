'use client'

import { Brand } from '@/components/brand'
import { LoginBrand, LoginVisual } from '@/components/login-visual'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './login.module.css'

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
  const [passwordVisible, setPasswordVisible] = useState(false)
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
    if (busy) return
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
    <main className={styles.page}>
      <LoginVisual />
      <section className={styles.loginPanel} aria-labelledby="login-title">
        <header className={styles.panelHeader}>
          <div className={styles.mobileBrand}>
            <LoginBrand />
          </div>
          <span className={styles.headerLabel}>VOTRE ESPACE DE TRAVAIL</span>
        </header>

        <div className={styles.formContainer}>
          <div className={styles.welcomeMark} aria-hidden="true">
            <ArrowUpRight size={22} strokeWidth={1.5} />
          </div>
          <p className={styles.formEyebrow}>TOUT COMMENCE ICI</p>
          <h1 id="login-title">Heureux de vous retrouver.</h1>
          <p className={styles.formDescription}>Connectez-vous pour donner vie à vos données.</p>

          <form onSubmit={submit} className={styles.form} aria-busy={busy}>
            <div className={styles.field}>
              <label htmlFor="email">Adresse e-mail</label>
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
                aria-describedby={error !== null ? 'login-error' : undefined}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Mot de passe</label>
              <div className={styles.passwordField}>
                <Input
                  id="password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy}
                  aria-describedby={error !== null ? 'login-error' : undefined}
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={
                    passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                  }
                  aria-pressed={passwordVisible}
                  aria-controls="password"
                >
                  {passwordVisible ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error !== null && (
              <div id="login-error" role="alert" className={styles.error}>
                <CircleAlert size={17} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className={styles.submit}
              disabled={busy || email === '' || password === ''}
            >
              <span aria-live="polite">{busy ? 'Connexion en cours…' : 'Se connecter'}</span>
              {busy ? (
                <Loader2 className={styles.spinner} aria-hidden="true" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
            </Button>
          </form>

          {providers.length > 0 && (
            <div className={styles.providers}>
              <div className={styles.divider}>ou continuer avec</div>
              {providers.map((p) => (
                // A LINK, not a button with a fetch: the route answers with a redirect
                // to the provider, and the browser must follow it itself.
                <a key={p.slug} href={api.oidcStartUrl(p.slug)} className={styles.provider}>
                  Continuer avec {p.label}
                </a>
              ))}
            </div>
          )}

          <details className={styles.help}>
            <summary>
              Première connexion ?<ChevronDown size={14} aria-hidden="true" />
            </summary>
            <p>
              Le mot de passe administrateur s’affiche dans le terminal du serveur lors du premier
              démarrage. Pour un accès à votre organisation, contactez votre administrateur.
            </p>
          </details>
        </div>

        <footer className={styles.panelFooter}>
          <span>Vos données. Votre structure. Vos possibilités.</span>
          <Brand size={16} className={styles.footerBrand} />
        </footer>
      </section>
    </main>
  )
}
