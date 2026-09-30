'use client'

import {
  AuthLayout,
  FormError,
  PRESSABLE,
  PasswordInput,
  REVEAL,
  revealAt,
} from '@/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { reasonFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Loader2, MailCheck } from 'lucide-react'
import { useState } from 'react'

/**
 * A forgotten password — chapter 13 §2.3, in two screens.
 *
 * Asking: an address, and the same answer whether an account holds it or not — the
 * screen says a mail left « if an account exists », as the API does. Choosing: the code
 * the mail carried — in the link, or typed when the instance knows no public address — and
 * a new password. No session is opened: the sign-in that follows is the second proof.
 */

export function PasswordReset({
  initialEmail,
  code: given,
  onBack,
  onDone,
}: {
  readonly initialEmail: string
  /** The code of the link followed; `null` to ask for a link first. */
  readonly code: string | null
  readonly onBack: () => void
  /** The password was changed: back to signing in, which says so. */
  readonly onDone: () => void
}) {
  const [step, setStep] = useState<'ask' | 'sent' | 'choose'>(given === null ? 'ask' : 'choose')
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState(given ?? '')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ readonly text: string; readonly attempt: number } | null>(
    null,
  )

  const fail = (e: unknown) =>
    setError((was) => ({ text: reasonFor(e), attempt: (was?.attempt ?? 0) + 1 }))

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.requestPasswordReset(email.trim())
      setStep('sent')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const choose = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.confirmPasswordReset(code.trim(), password)
      onDone()
    } catch (e) {
      fail(e)
      setBusy(false)
    }
  }

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline"
    >
      {$t('Retour à la connexion')}
    </button>
  )

  if (step === 'sent') {
    return (
      <AuthLayout
        title={$t('Regardez vos courriels')}
        description={$t(
          'Si un compte existe pour {email}, un courriel vient de partir. Ouvrez le lien qu’il contient, dans les 30 minutes.',
          { email: email.trim() },
        )}
        footer={<p>{back}</p>}
      >
        <div className={cn('grid gap-4', REVEAL)} style={revealAt(0)}>
          <MailCheck className="size-10 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {$t('Rien reçu ? Regardez dans les indésirables, ou demandez un nouveau lien.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep('ask')}>
              {$t('Demander un nouveau lien')}
            </Button>
            <Button variant="ghost" onClick={() => setStep('choose')}>
              {$t('J’ai reçu un code')}
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (step === 'ask') {
    return (
      <AuthLayout
        title={$t('Mot de passe oublié')}
        description={$t(
          'Recevez par courriel un lien pour en choisir un nouveau. Il vaut 30 minutes.',
        )}
        footer={<p>{back}</p>}
      >
        <form onSubmit={ask} className="grid gap-5" aria-busy={busy}>
          <div className={cn('group grid gap-2', REVEAL)} style={revealAt(0)}>
            <Label htmlFor="reset-email">{$t('Adresse e-mail')}</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="vous@entreprise.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
              className="h-10"
            />
          </div>
          {error !== null && (
            <FormError key={error.attempt} id="reset-error">
              {error.text}
            </FormError>
          )}
          <div className={REVEAL} style={revealAt(1)}>
            <Button
              type="submit"
              size="lg"
              className={cn('w-full', PRESSABLE)}
              disabled={busy || email.trim() === ''}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {$t('Recevoir un lien')}
            </Button>
          </div>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={$t('Nouveau mot de passe')}
      description={$t('Choisissez le mot de passe avec lequel vous vous connecterez désormais.')}
      footer={<p>{back}</p>}
    >
      <form onSubmit={choose} className="grid gap-5" aria-busy={busy}>
        {given === null && (
          <div className={cn('group grid gap-2', REVEAL)} style={revealAt(0)}>
            <Label htmlFor="reset-code">{$t('Code reçu par courriel')}</Label>
            <Input
              id="reset-code"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              disabled={busy}
              className="h-10 font-mono"
            />
          </div>
        )}
        <div className={cn('group grid gap-2', REVEAL)} style={revealAt(1)}>
          <Label htmlFor="reset-password">{$t('Nouveau mot de passe')}</Label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            visible={visible}
            onVisibleChange={setVisible}
            required
            disabled={busy}
            className="h-10"
          />
        </div>
        {error !== null && (
          <FormError key={error.attempt} id="reset-error">
            {error.text}
          </FormError>
        )}
        <div className={REVEAL} style={revealAt(2)}>
          <Button
            type="submit"
            size="lg"
            className={cn('w-full', PRESSABLE)}
            disabled={busy || code.trim() === '' || password === ''}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {$t('Enregistrer le mot de passe')}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
