'use client'

import { cancelled, useElevated } from '@/components/app/elevation'
import {
  type LinkNotice,
  Refusal,
  SettingsSection,
  TabHeading,
} from '@/components/app/settings/section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Hint } from '@/components/ui/tooltip'
import { type Identities, type Me, api } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Check, CircleCheck, CircleX, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Who one is to the others, and how one signs in — chapter 11 §10.
 *
 * The name is changed at once: it is what the others read in a person field, a comment,
 * the history, and nothing about signing in depends on it. The address and the linked
 * providers are ways IN to the account, and ask for the password again before they move
 * (chapter 05 §2.2) — the screen does not ask up front, the server's refusal brings the
 * question when it is needed.
 */

const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale())

export function ProfileTab({
  me,
  notice,
  onMe,
  onDismissNotice,
}: {
  readonly me: Me
  readonly notice: LinkNotice | null
  readonly onMe: (me: Me) => void
  readonly onDismissNotice: () => void
}) {
  return (
    <>
      <TabHeading title={$t('Profil')}>
        {$t('Ce que les autres voient de vous, et les moyens de vous connecter.')}
      </TabHeading>

      {notice !== null && (
        <output
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
            notice.ok
              ? 'border-primary/30 bg-primary/5'
              : 'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          {notice.ok ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          ) : (
            <CircleX className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            onClick={onDismissNotice}
            aria-label={$t('Fermer')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </output>
      )}

      <NameSection me={me} onMe={onMe} />
      <AddressSection me={me} onMe={onMe} />
      <IdentitiesSection />
    </>
  )
}

/** « Enregistré », for a moment, where the button was pressed. */
function useSaved(): [boolean, () => void] {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(timer)
  }, [saved])
  return [saved, () => setSaved(true)]
}

function NameSection({ me, onMe }: { readonly me: Me; readonly onMe: (me: Me) => void }) {
  const [name, setName] = useState(me.displayName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, markSaved] = useSaved()

  const changed = name.trim() !== '' && name.trim() !== me.displayName

  const save = async () => {
    if (!changed || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api.updateProfile({ displayName: name.trim() })
      onMe(updated)
      setName(updated.displayName)
      markSaved()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection
      title={$t('Nom affiché')}
      description={$t(
        'Celui que les autres lisent : dans un champ Personne, un commentaire, une mention, l’historique.',
      )}
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={$t('Nom affiché')}
          maxLength={120}
          autoComplete="name"
          disabled={busy}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline" disabled={busy || !changed}>
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            saved && <Check className="animate-in zoom-in-50 text-primary duration-200" />
          )}
          {saved ? $t('Enregistré') : $t('Enregistrer')}
        </Button>
      </form>
      {error !== null && (
        <div className="mt-2">
          <Refusal>{error}</Refusal>
        </div>
      )}
    </SettingsSection>
  )
}

function AddressSection({ me, onMe }: { readonly me: Me; readonly onMe: (me: Me) => void }) {
  const elevated = useElevated()
  const [email, setEmail] = useState(me.email)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Without a password the address is the provider's, and follows it at every sign-in: it
  // is shown, and said to be so, rather than offered as a field that would be refused.
  if (!me.hasPassword) {
    return (
      <SettingsSection
        title={$t('Adresse de connexion')}
        description={$t(
          'Votre compte se connecte par un fournisseur d’identité : son adresse suit celle de votre compte chez lui, à chaque connexion.',
        )}
      >
        <p className="text-sm font-medium">{me.email}</p>
      </SettingsSection>
    )
  }

  const changed = email.trim() !== '' && email.trim() !== me.email

  const save = async () => {
    if (!changed || busy) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      const updated = await elevated(() => api.changeEmail(email.trim()))
      onMe(updated)
      setEmail(updated.email)
      setDone(true)
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection
      title={$t('Adresse de connexion')}
      description={$t(
        'Celle avec laquelle vous vous connectez, et où arrive un lien de réinitialisation du mot de passe. La changer demande votre mot de passe ; l’ancienne adresse en est prévenue.',
      )}
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setDone(false)
          }}
          aria-label={$t('Adresse de connexion')}
          autoComplete="email"
          disabled={busy}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline" disabled={busy || !changed}>
          {busy && <Loader2 className="animate-spin" />}
          {$t('Changer l’adresse')}
        </Button>
      </form>
      {done && (
        <p className="mt-2 text-sm text-muted-foreground">
          {$t('Adresse changée : connectez-vous désormais avec {email}.', { email: me.email })}
        </p>
      )}
      {error !== null && (
        <div className="mt-2">
          <Refusal>{error}</Refusal>
        </div>
      )}
    </SettingsSection>
  )
}

/**
 * The providers of this instance, linked to the account or not.
 *
 * Linking sends the browser to the provider, and its return completes the link and comes
 * back here, with a word on the outcome. The last way in is never offered for unlinking:
 * the server would refuse it, and an account nobody can sign into says so to nobody.
 */
function IdentitiesSection() {
  const elevated = useElevated()
  const [found, setFound] = useState<Identities | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setFound(await api.identities())
    } catch (e) {
      setError(messageFor(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const link = async (slug: string) => {
    setBusy(slug)
    setError(null)
    try {
      const { url } = await elevated(() =>
        api.oidcLinkStart(slug, `/?parametres=profil&lien=${encodeURIComponent(slug)}`),
      )
      // The page is left for the provider's; `busy` stays on until it goes.
      window.location.assign(url)
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
      setBusy(null)
    }
  }

  const unlink = async (slug: string) => {
    setBusy(slug)
    setError(null)
    try {
      await elevated(() => api.oidcUnlink(slug))
      await load()
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setBusy(null)
    }
  }

  const providers = found?.providers ?? []
  const ways = (found?.password === true ? 1 : 0) + providers.filter((p) => p.linked_at).length

  return (
    <SettingsSection
      title={$t('Comptes liés')}
      description={
        found === null
          ? $t('Chargement…')
          : providers.length === 0
            ? $t(
                'Aucun fournisseur d’identité n’est configuré sur cette instance : vous vous connectez par mot de passe.',
              )
            : $t(
                'Un compte lié vous connecte en un clic, sans mot de passe. Lier ou délier un compte demande votre mot de passe.',
              )
      }
    >
      {providers.length > 0 && (
        <ul className="divide-y rounded-md border">
          {providers.map((p) => {
            const linked = p.linked_at !== null
            const last = linked && ways <= 1
            return (
              <li key={p.slug} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.linked_at === null
                      ? $t('Non lié')
                      : $t('Lié le {linked_at}{value}', {
                          linked_at: day(p.linked_at),
                          value:
                            p.last_used_at === null
                              ? ''
                              : $t(' · dernière connexion le {last_used_at}', {
                                  last_used_at: day(p.last_used_at),
                                }),
                        })}
                  </span>
                </span>
                {/* A disabled button raises no pointer events: the hint hangs on a wrapper so
                    it can still say why the account cannot be unlinked. */}
                <Hint
                  label={
                    last
                      ? $t('Votre seul moyen de connexion : il ne peut pas être délié.')
                      : found?.password === false
                        ? $t('Demande de confirmer un mot de passe, et votre compte n’en a pas.')
                        : undefined
                  }
                >
                  <span className="inline-flex">
                    <Button
                      variant={linked ? 'ghost' : 'outline'}
                      size="sm"
                      disabled={busy !== null || last || found?.password === false}
                      onClick={() => void (linked ? unlink(p.slug) : link(p.slug))}
                    >
                      {busy === p.slug && <Loader2 className="animate-spin" />}
                      {linked ? $t('Délier') : $t('Lier')}
                    </Button>
                  </span>
                </Hint>
              </li>
            )
          })}
        </ul>
      )}
      {found?.password === false && providers.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {$t(
            'Votre compte n’a pas de mot de passe : lier ou délier un fournisseur, qui demande de le confirmer, n’est pas possible ici. Un administrateur peut vous en attribuer un.',
          )}
        </p>
      )}
      {error !== null && (
        <div className="mt-2">
          <Refusal>{error}</Refusal>
        </div>
      )}
    </SettingsSection>
  )
}
