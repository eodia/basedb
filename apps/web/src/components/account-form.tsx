'use client'

import {
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
import { ApiError } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { reasonFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'

/** The policy's first rule, shown filling up as the password is typed. */
const MIN_LENGTH = 8

export interface AccountValues {
  readonly name: string
  readonly email: string
  readonly password: string
}

/**
 * The fields of a new account — name, address, password and its confirmation — for the
 * first administrator, for one's own sign-up, and for signing up from an invitation.
 */
export function AccountForm({
  submitLabel,
  doneLabel,
  initialEmail = '',
  emailHint,
  onSubmit,
  onDone,
  onNotFound,
  notFoundMessage,
}: {
  readonly submitLabel: string
  /** What the button says once it worked, the moment before leaving. */
  readonly doneLabel: string
  readonly initialEmail?: string
  /** A line under the address — the domains the instance admits, say. */
  readonly emailHint?: string
  readonly onSubmit: (values: AccountValues) => Promise<void>
  readonly onDone: () => void
  /** The server says the road is gone: someone else took it, or it was closed. */
  readonly onNotFound?: () => void
  readonly notFoundMessage?: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<{ readonly text: string; readonly attempt: number } | null>(
    null,
  )

  // The mismatch is caught here because it is not a server question: the server never
  // sees the confirmation field.
  const mismatched = confirm !== '' && password !== confirm
  const confirmed = confirm !== '' && password === confirm
  const length = [...password.normalize('NFKC')].length
  const longEnough = length >= MIN_LENGTH
  const ready = name.trim() !== '' && email.trim() !== '' && password !== '' && confirmed && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ name, email, password })
      setDone(true)
      await pauseOnSuccess()
      onDone()
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && onNotFound !== undefined) {
        onNotFound()
        return
      }
      const text =
        e instanceof ApiError && e.status === 404 && notFoundMessage !== undefined
          ? notFoundMessage
          : reasonFor(e)
      // A new attempt number for each refusal, so the message shakes again.
      setError((was) => ({ text, attempt: (was?.attempt ?? 0) + 1 }))
      setBusy(false)
    }
  }

  const described = error !== null ? 'account-error' : undefined

  return (
    <form onSubmit={submit} className="grid gap-5" aria-busy={busy}>
      <div className={cn('group grid gap-2', REVEAL)} style={revealAt(0)}>
        <Label htmlFor="name" className="transition-colors group-focus-within:text-primary">
          {$t('Votre nom')}
        </Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder={$t('Prénom Nom')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          autoFocus
          disabled={busy}
          aria-describedby={described}
          className="h-10"
        />
      </div>

      <div className={cn('group grid gap-2', REVEAL)} style={revealAt(1)}>
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
          aria-describedby={described ?? (emailHint === undefined ? undefined : 'email-hint')}
          className="h-10"
        />
        {emailHint !== undefined && (
          <p id="email-hint" className="text-xs text-muted-foreground">
            {emailHint}
          </p>
        )}
      </div>

      <div className={cn('group grid gap-2', REVEAL)} style={revealAt(2)}>
        <Label htmlFor="password" className="transition-colors group-focus-within:text-primary">
          {$t('Mot de passe')}
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          visible={passwordVisible}
          onVisibleChange={setPasswordVisible}
          controls="password confirm-password"
          required
          disabled={busy}
          aria-describedby={described ?? 'password-hint'}
          className="h-10"
        />
        {/* The length, filling up: the one rule a person can see coming. */}
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-[width,background-color] duration-300 ease-out',
              longEnough ? 'bg-primary' : 'bg-muted-foreground/40',
            )}
            style={{ width: `${Math.min(length / MIN_LENGTH, 1) * 100}%` }}
          />
        </div>
        <p id="password-hint" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {longEnough && (
            <Check
              className="size-3.5 shrink-0 animate-in zoom-in-50 text-primary duration-200"
              aria-hidden="true"
            />
          )}
          {$t('Au moins 8 caractères, sans reprendre votre adresse ni votre nom.')}
        </p>
      </div>

      <div className={cn('group grid gap-2', REVEAL)} style={revealAt(3)}>
        <Label
          htmlFor="confirm-password"
          className="transition-colors group-focus-within:text-primary"
        >
          {$t('Confirmation')}
        </Label>
        <div className="relative">
          <Input
            id="confirm-password"
            name="confirm-password"
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={busy}
            aria-invalid={mismatched}
            aria-describedby={mismatched ? 'confirm-hint' : described}
            className="h-10 pr-10"
          />
          {confirmed && (
            <Check
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-in zoom-in-50 text-primary duration-200"
              aria-hidden="true"
            />
          )}
        </div>
        {mismatched && (
          <p
            id="confirm-hint"
            className="animate-in fade-in slide-in-from-top-1 text-xs text-destructive duration-200"
          >
            {$t('Les deux saisies diffèrent.')}
          </p>
        )}
      </div>

      {error !== null && (
        <FormError key={error.attempt} id="account-error">
          {error.text}
        </FormError>
      )}

      <div className={REVEAL} style={revealAt(4)}>
        <Button type="submit" size="lg" className={cn('mt-1 w-full', PRESSABLE)} disabled={!ready}>
          {done ? (
            <Check className="animate-in zoom-in-50 duration-200" aria-hidden="true" />
          ) : (
            busy && <Loader2 className="animate-spin" aria-hidden="true" />
          )}
          <span aria-live="polite">{done ? doneLabel : busy ? $t('Création…') : submitLabel}</span>
        </Button>
      </div>
    </form>
  )
}
