'use client'

import { Refusal, SettingsSection, TabHeading } from '@/components/app/settings/section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Hint } from '@/components/ui/tooltip'
import { type Me, api } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { Loader2, Monitor } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The password, and where one is signed in — chapter 13 §2.3 and §4.3.
 *
 * Open sessions are listed where they can be closed one by one: « où suis-je connecté »
 * is a security question, and the answer is only useful next to the gesture it calls for.
 */

export function SecurityTab({ me }: { readonly me: Me }) {
  return (
    <>
      <TabHeading title={$t('Sécurité')}>
        {$t('Votre mot de passe, et les appareils connectés.')}
      </TabHeading>
      <PasswordSection hasPassword={me.hasPassword} />
      <SessionsSection />
    </>
  )
}

function PasswordSection({ hasPassword }: { readonly hasPassword: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!hasPassword) {
    return (
      <SettingsSection
        title={$t('Mot de passe')}
        description={$t(
          'Votre compte n’a pas de mot de passe : vous vous connectez par votre fournisseur d’identité.',
        )}
      />
    )
  }

  // The mismatch is caught here because it is not a server question: the server never
  // sees the confirmation field, and never should.
  const mismatched = confirm !== '' && next !== confirm
  const ready = current !== '' && next !== '' && next === confirm && !busy

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection
      title={$t('Mot de passe')}
      description={$t(
        'Le changer ferme vos autres sessions : c’est souvent la raison pour laquelle on le change.',
      )}
    >
      <form
        className="grid max-w-sm gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="settings-current">{$t('Mot de passe actuel')}</Label>
          <Input
            id="settings-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="settings-next">{$t('Nouveau mot de passe')}</Label>
          <Input
            id="settings-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="settings-confirm">{$t('Confirmation')}</Label>
          <Input
            id="settings-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatched && (
            <p className="text-xs text-destructive">{$t('Les deux saisies diffèrent.')}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!ready}>
            {busy && <Loader2 className="animate-spin" />}
            {$t('Changer le mot de passe')}
          </Button>
          {done && (
            <span className="text-sm text-muted-foreground">
              {$t('Mot de passe changé ; vos autres sessions sont fermées.')}
            </span>
          )}
        </div>
        {error !== null && <Refusal>{error}</Refusal>}
      </form>
    </SettingsSection>
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

function SessionsSection() {
  const [sessions, setSessions] = useState<readonly Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSessions(await api.sessions())
    } catch (e) {
      setError(messageFor(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const close = async (id: string) => {
    setBusy(id)
    await api.revokeSession(id).catch((e) => setError(messageFor(e)))
    await load()
    setBusy(null)
  }

  const closeAll = async () => {
    setBusy('all')
    // This one closes THIS session too, server-side — so the screen must not pretend
    // otherwise. It reloads, and the login screen comes back.
    await api.revokeOtherSessions().catch((e) => setError(messageFor(e)))
    window.location.reload()
  }

  return (
    <SettingsSection
      title={$t('Sessions ouvertes')}
      description={$t(
        'Les appareils connectés à votre compte. Fermez celles que vous ne reconnaissez pas.',
      )}
      action={
        <Hint label={$t('Toutes, celle-ci comprise : vous devrez vous reconnecter.')}>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null || sessions === null || sessions.length < 2}
            onClick={() => void closeAll()}
          >
            {$t('Tout fermer')}
          </Button>
        </Hint>
      }
    >
      {sessions === null && error === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {$t('Chargement…')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(sessions ?? []).map((session) => (
            <li key={session.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {session.user_agent ?? $t('Appareil inconnu')}
                  {session.current && (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {$t('Celle-ci')}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {$t('{value} — ouverte le {intlLocale}, vue le {value2}', {
                    value: session.ip ?? $t('adresse inconnue'),
                    intlLocale: new Date(session.created_at).toLocaleDateString(intlLocale()),
                    value2: new Date(session.last_seen_at).toLocaleString(intlLocale()),
                  })}
                </p>
              </div>
              {!session.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void close(session.id)}
                >
                  {busy === session.id && <Loader2 className="animate-spin" />}
                  {$t('Fermer')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error !== null && (
        <div className="mt-2">
          <Refusal>{error}</Refusal>
        </div>
      )}
    </SettingsSection>
  )
}
