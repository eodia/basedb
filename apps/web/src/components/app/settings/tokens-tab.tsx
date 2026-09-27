'use client'

import { cancelled, useElevated } from '@/components/app/elevation'
import { Refusal, SettingsSection, TabHeading } from '@/components/app/settings/section'
import { doorsOf, stateOf } from '@/components/app/token-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type OwnApiToken, api } from '@/lib/api/client'
import { $t, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { ChevronRight, KeyRound, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The integration tokens one minted, on every base — chapter 11 §10.
 *
 * A base's menu answers « who opened this base »; this list answers « which doors did I
 * open », the question a lost laptop or a leaked configuration file asks, all at once and
 * without walking every base. A token is revoked from here even when its base is gone or
 * one has lost the right to manage its tokens: closing a door one opened takes nothing
 * from anyone. Creating one stays in the base's menu, where its base is chosen.
 */

const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale())

export function TokensTab() {
  const elevated = useElevated()
  const [tokens, setTokens] = useState<readonly OwnApiToken[] | null>(null)
  const [showDead, setShowDead] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTokens(await api.ownTokens())
    } catch (e) {
      setTokens([])
      setError(messageFor(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const revoke = async (token: OwnApiToken) => {
    setBusy(token.id)
    setError(null)
    try {
      await elevated(() => api.revokeToken(token.id))
      await load()
    } catch (e) {
      if (!cancelled(e)) setError(messageFor(e))
    } finally {
      setBusy(null)
    }
  }

  const live = (tokens ?? []).filter((t) => stateOf(t) === null)
  const dead = (tokens ?? []).filter((t) => stateOf(t) !== null)

  return (
    <>
      <TabHeading title={$t('Jetons')}>
        {$t('Les jetons API et MCP que vous avez créés, sur toutes les bases.')}
      </TabHeading>

      <SettingsSection
        title={$t('Jetons actifs')}
        description={$t(
          'Chacun ouvre une base à un programme ou à un agent, avec au plus vos propres droits. Révoquez ceux qui ne servent plus : la révocation demande votre mot de passe et prend effet aussitôt.',
        )}
      >
        {tokens === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {$t('Chargement…')}
          </p>
        ) : live.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {$t(
              'Aucun jeton actif. Un jeton se crée depuis le menu d’une base, « Jetons API et MCP… ».',
            )}
          </p>
        ) : (
          <TokenList tokens={live} busy={busy} onRevoke={(t) => void revoke(t)} />
        )}

        {dead.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowDead((was) => !was)}
              aria-expanded={showDead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronRight
                className={showDead ? 'size-3.5 rotate-90 transition-transform' : 'size-3.5'}
              />
              {dead.length > 1
                ? $t('{deadCount} jetons révoqués, suspendus ou expirés', {
                    deadCount: dead.length,
                  })
                : $t('1 jeton révoqué, suspendu ou expiré')}
            </button>
            {showDead && (
              <div className="mt-2">
                <TokenList tokens={dead} busy={busy} onRevoke={(t) => void revoke(t)} />
              </div>
            )}
          </div>
        )}

        {error !== null && (
          <div className="mt-2">
            <Refusal>{error}</Refusal>
          </div>
        )}
      </SettingsSection>
    </>
  )
}

function TokenList({
  tokens,
  busy,
  onRevoke,
}: {
  readonly tokens: readonly OwnApiToken[]
  readonly busy: string | null
  readonly onRevoke: (token: OwnApiToken) => void
}) {
  return (
    <ul className="divide-y rounded-md border">
      {tokens.map((token) => {
        const state = stateOf(token)
        return (
          <li key={token.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <KeyRound className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">{token.label}</span>
                <span className="shrink-0 text-muted-foreground">·</span>
                <span className="truncate text-muted-foreground">
                  {token.base === null ? $t('base supprimée') : token.base.label}
                </span>
                {token.base !== null && !token.base.production && (
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {token.base.environment}
                  </Badge>
                )}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {$t('bdb_{prefix}… · {surfaces} · créé le {created_at} · {value} · {value2}', {
                  prefix: token.prefix,
                  surfaces: doorsOf(token.surfaces),
                  created_at: day(token.created_at),
                  value:
                    token.expires_at === null
                      ? $t('sans expiration')
                      : $t('expire le {expires_at}', { expires_at: day(token.expires_at) }),
                  value2:
                    token.last_used_at === null
                      ? $t('jamais utilisé')
                      : $t('utilisé le {last_used_at}', { last_used_at: day(token.last_used_at) }),
                })}
              </span>
            </span>
            <Badge variant="secondary" className="shrink-0">
              {token.access === 'write' ? $t('Lecture et écriture') : $t('Lecture seule')}
            </Badge>
            {state === null ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={busy !== null}
                onClick={() => onRevoke(token)}
              >
                {busy === token.id && <Loader2 className="animate-spin" />}
                {$t('Révoquer')}
              </Button>
            ) : (
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                {state}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
