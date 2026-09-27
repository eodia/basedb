'use client'

import { cancelled, useElevated } from '@/components/app/elevation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { type SignupPolicy, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Who may create an account — chapter 13 §8. Open by default; closed, only the invited
 * sign up; kept to some domains, only their addresses do.
 */
export function SignupSettings() {
  const elevated = useElevated()
  const [policy, setPolicy] = useState<SignupPolicy | null>(null)
  const [domains, setDomains] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api.adminSignupPolicy().then(
      (found) => {
        setPolicy(found)
        setDomains(found.domains.join(', '))
      },
      (e) => setError(messageFor(e)),
    )
  }, [])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(timer)
  }, [saved])

  const listed = domains
    .split(/[\s,;]+/)
    .map((d) => d.trim())
    .filter((d) => d !== '')

  const save = async (open: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const next = await elevated(() => api.setSignupPolicy({ open, domains: listed }))
      setPolicy(next)
      setDomains(next.domains.join(', '))
      setSaved(true)
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const changed = policy !== null && listed.join(',') !== policy.domains.join(',')

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">{$t('Création de comptes')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {policy === null
              ? $t('Chargement…')
              : policy.open
                ? $t(
                    'Toute personne qui atteint cette instance peut créer son compte, puis ses propres projets.',
                  )
                : $t(
                    'Seules les personnes invitées à un projet ou à une base peuvent créer un compte.',
                  )}
          </p>
        </div>
        <Switch
          checked={policy?.open ?? false}
          disabled={policy === null || busy}
          onCheckedChange={(open) => void save(open)}
          aria-label={$t('Ouvrir la création de comptes')}
        />
      </div>

      {policy?.open === true && (
        <div className="mt-4 grid animate-in fade-in slide-in-from-top-1 gap-2 duration-300">
          <Label htmlFor="signup-domains">{$t('Domaines acceptés')}</Label>
          <div className="flex gap-2">
            <Input
              id="signup-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder={$t('exemple.fr, autre.fr — vide : toutes les adresses')}
              disabled={busy}
              className="min-w-0 flex-1"
            />
            <Button variant="outline" onClick={() => void save(true)} disabled={busy || !changed}>
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : (
                saved && <Check className="animate-in zoom-in-50 text-primary duration-200" />
              )}
              {saved ? $t('Enregistré') : $t('Enregistrer')}
            </Button>
          </div>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="mt-3 animate-shake text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
