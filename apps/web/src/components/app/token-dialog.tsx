'use client'

import { CodeGroup } from '@/components/api-reference/code-block'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Hint } from '@/components/ui/tooltip'
import {
  ApiError,
  type ApiToken,
  type BaseEnvironment,
  type DescribedBase,
  type TokenAccess,
  type TokenEnvironments,
  type TokenSurface,
  api,
  mcpEndpoint,
  restRoot,
} from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { KeyRound, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Integration tokens of a base — chapter 08 §11, chapter 09 §9.
 *
 * ONE token for the two doors of a base: the REST API, for a program, and the MCP server,
 * for an agent — both by default, either on its own if that is all it is for. It is
 * scoped to THIS base — all its environments by default, the environment being chosen per
 * request (chapter 14 §1 bis), or the one shown alone — and read-only by default: writing
 * is a decision made here, explicitly, never a default (09 §6.4). It asks for the password
 * again, because minting a door out of the instance demands a proof made seconds ago
 * (05 §2.2).
 *
 * The secret is shown ONCE, followed by what each door needs, with the token in an
 * environment variable: a configuration file is versioned and synced, so it carries only
 * the variable's name (09 §9.2). One variable, `BASEDB_TOKEN`, for both — and, for an
 * agent, one server per environment, all on the same token.
 */

/**
 * The lifetimes offered, "never" first and chosen by default: an integration breaks
 * silently the day its token expires. A token that should die gets a date here — and any
 * token can be revoked from this list at any time.
 */
const DURATIONS = ['never', '30', '90', '180', '365'] as const
type Duration = (typeof DURATIONS)[number]

/** The variable the snippets use, for the program and for the relay alike. */
const VARIABLE = 'BASEDB_TOKEN'

const SURFACES: ReadonlyArray<{ id: TokenSurface; label: string; hint: string }> = [
  { id: 'rest', label: $t('API REST'), hint: $t('un programme, un script, une synchronisation') },
  { id: 'mcp', label: $t('MCP'), hint: $t('un agent : Claude ou tout client MCP') },
]

const date = (iso: string) => new Date(iso).toLocaleDateString(intlLocale())

/** Why a token no longer answers, if it does not. */
export function stateOf(token: ApiToken): string | null {
  if (token.revoked_at !== null) return $t('Révoqué')
  if (token.suspended_at !== null) return $t('Suspendu')
  if (token.expires_at !== null && Date.parse(token.expires_at) <= Date.now()) return $t('Expiré')
  return null
}

/** An environment of the base, as the configurations name it. */
interface EnvironmentChoice {
  readonly name: string
  readonly label: string
  readonly production: boolean
}

/** `recette` from « Recette », `developpement` from « Développement »: a server's name. */
const slugOf = (label: string) =>
  label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'env'

/**
 * What each door needs, the token referenced by its variable and never written in it.
 * A token of the whole base gets one MCP server per environment, on the same token; the
 * REST examples name the base by its production name and choose with the header.
 */
function configuration(
  secret: string,
  base: string,
  surfaces: readonly string[],
  environments: readonly EnvironmentChoice[],
) {
  const endpoint = mcpEndpoint()
  // One server per environment — the production on the plain address, the others with
  // `?environment=` — or the plain address alone for a token of one environment.
  const servers = (environments.length === 0 ? [null] : environments).map((e) => ({
    name: e === null || e.production ? 'basedb' : `basedb-${slugOf(e.label)}`,
    url:
      e === null || e.production
        ? endpoint
        : `${endpoint}?environment=${encodeURIComponent(e.label)}`,
  }))
  const other = environments.find((e) => !e.production)
  return {
    variable: [
      {
        lang: 'powershell',
        title: $t('Windows (PowerShell)'),
        body: `[Environment]::SetEnvironmentVariable('${VARIABLE}', '${secret}', 'User')`,
      },
      {
        lang: 'bash',
        title: 'macOS, Linux',
        body: `echo "export ${VARIABLE}='${secret}'" >> ~/.profile`,
      },
    ],
    rest: surfaces.includes('rest')
      ? [
          {
            lang: 'bash',
            title: 'API REST — cURL',
            body: [
              `curl "${restRoot()}/meta/bases/${base}" \\`,
              `  -H "Authorization: Bearer $${VARIABLE}"${other === undefined ? '' : ' \\'}`,
              ...(other === undefined ? [] : [`  -H "X-Basedb-Environment: ${other.label}"`]),
            ].join('\n'),
          },
          {
            lang: 'js',
            title: $t('API REST — JavaScript'),
            body: [
              `const response = await fetch('${restRoot()}/meta/bases/${base}', {`,
              '  headers: {',
              `    Authorization: \`Bearer \${process.env.${VARIABLE}}\`,`,
              ...(other === undefined ? [] : [`    'X-Basedb-Environment': '${other.label}',`]),
              '  },',
              '})',
              'const { data } = await response.json()',
            ].join('\n'),
          },
        ]
      : [],
    mcp: surfaces.includes('mcp')
      ? [
          {
            lang: 'bash',
            title: $t('MCP — Claude Code'),
            body: servers
              .map(
                (s) =>
                  // Single quotes and the project scope: `.mcp.json` keeps `${BASEDB_TOKEN}`,
                  // which the client reads from the environment — never the token itself.
                  `claude mcp add --transport http --scope project ${s.name} "${s.url}" --header 'Authorization: Bearer \${${VARIABLE}}'`,
              )
              .join('\n'),
          },
          {
            lang: 'json',
            title: $t('MCP — fichier .mcp.json'),
            body: JSON.stringify(
              {
                mcpServers: Object.fromEntries(
                  servers.map((s) => [
                    s.name,
                    {
                      type: 'http',
                      url: s.url,
                      headers: { Authorization: `Bearer \${${VARIABLE}}` },
                    },
                  ]),
                ),
              },
              null,
              2,
            ),
          },
        ]
      : [],
  }
}

/** « API REST · MCP », as a token's line says where it is accepted. */
export function doorsOf(surfaces: readonly string[]): string {
  return SURFACES.filter((s) => surfaces.includes(s.id))
    .map((s) => s.label)
    .join(' · ')
}

/** What a token may do, as its badge and the rights menu say it. */
export const accessLabel = (access: TokenAccess) =>
  access === 'delete'
    ? $t('Lecture, écriture et suppression')
    : access === 'write'
      ? $t('Lecture et écriture')
      : $t('Lecture seule')

/** Why a token is refused to whoever reads or writes the base without managing it. */
const needsManage = () =>
  $t(
    'Créer un jeton pour cette base demande le niveau Gestion sur elle, ou sur son projet. Demandez-le à une personne qui la gère, ou à un administrateur.',
  )

/** What went wrong, said for tokens: a refusal of `manage_tokens` is not about the administration. */
const explain = (e: unknown) =>
  e instanceof ApiError && e.code === 'ADMIN_REQUIRED' ? needsManage() : messageFor(e)

export function TokenDialog({
  open,
  base,
  hasPassword = true,
  environments: family = [],
  onClose,
}: {
  readonly open: boolean
  /** Its verbs, when known: without `manage_tokens`, the dialog says why instead of failing. */
  readonly base: Pick<DescribedBase, 'name' | 'label'> & {
    readonly actions?: readonly string[]
    /** The environment shown: a token may be limited to it. */
    readonly environment?: BaseEnvironment
  }
  /** Every environment of the base, when known: one MCP server each in the configurations. */
  readonly environments?: readonly {
    readonly name: string
    readonly environment: BaseEnvironment
  }[]
  /** An account signed in through a provider only cannot prove a password (chapter 13 §5). */
  readonly hasPassword?: boolean
  readonly onClose: () => void
}) {
  const manages = base.actions === undefined || base.actions.includes('manage_tokens')
  const [tokens, setTokens] = useState<readonly ApiToken[] | null>(null)
  const [label, setLabel] = useState('')
  const [access, setAccess] = useState<TokenAccess>('read')
  const [surfaces, setSurfaces] = useState<ReadonlySet<TokenSurface>>(new Set(['rest', 'mcp']))
  const [days, setDays] = useState<Duration>('never')
  const [scope, setScope] = useState<TokenEnvironments>('all')
  const [password, setPassword] = useState('')
  const [issued, setIssued] = useState<{
    secret: string
    label: string
    surfaces: readonly string[]
    environments: TokenEnvironments
  } | null>(null)
  // The environments a configuration names: all of the base's, production first, for a
  // token of the whole base; the one shown for a token of one environment.
  const environment = base.environment
  const several = family.length > 1
  const choices: readonly EnvironmentChoice[] = [...family]
    .sort((a, b) => Number(b.environment.production) - Number(a.environment.production))
    .map((e) => ({
      name: e.name,
      label: e.environment.label,
      production: e.environment.production,
    }))
  const production = choices.find((e) => e.production)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTokens(await api.tokens(base.name))
    } catch (e) {
      setTokens([])
      setError(explain(e))
    }
  }, [base.name])

  useEffect(() => {
    if (!open) return
    setLabel('')
    setAccess('read')
    setSurfaces(new Set(['rest', 'mcp']))
    setDays('never')
    setScope('all')
    setPassword('')
    setIssued(null)
    setError(null)
    setTokens(null)
    if (manages) void load()
  }, [open, load, manages])

  /** Elevates, then acts: each act that opens or closes a door proves the password. */
  const elevated = async (act: () => Promise<void>) => {
    if (password === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.elevate(password)
      await act()
      setPassword('')
      await load()
    } catch (e) {
      setError(explain(e))
    } finally {
      setBusy(false)
    }
  }

  const ready = label.trim() !== '' && password !== '' && surfaces.size > 0 && !busy

  const create = () =>
    elevated(async () => {
      const token = await api.createToken({
        base: base.name,
        label: label.trim(),
        access,
        surfaces: SURFACES.map((s) => s.id).filter((id) => surfaces.has(id)),
        expiresInDays: days === 'never' ? null : Number(days),
        environments: scope,
      })
      setIssued({
        secret: token.secret,
        label: token.label,
        surfaces: token.surfaces,
        environments: token.environments,
      })
      setLabel('')
    })

  const revoke = (token: ApiToken) => elevated(() => api.revokeToken(token.id))

  const toggle = (id: TokenSurface, on: boolean) =>
    setSurfaces((was) => {
      const next = new Set(was)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const snippets =
    issued === null
      ? null
      : issued.environments === 'all'
        ? configuration(issued.secret, production?.name ?? base.name, issued.surfaces, choices)
        : configuration(issued.secret, base.name, issued.surfaces, [])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {$t('Jetons API et MCP — {label}', { label: base.label })}
            {several && environment !== undefined && (
              <Badge variant="outline" className="font-normal">
                {environment.label}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'Un jeton d’intégration ouvre cette base à un programme, par l’API REST, ou à un agent (Claude ou tout client MCP) : il la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il ne change jamais la structure, et ne voit que ce que vous pouvez voir.',
            )}
          </DialogDescription>
        </DialogHeader>

        {!manages ? (
          <div className="min-w-0 space-y-4">
            <p className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm">{needsManage()}</p>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                {$t('Fermer')}
              </Button>
            </DialogFooter>
          </div>
        ) : issued !== null && snippets !== null ? (
          <div className="min-w-0 space-y-3">
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {$t(
                'Copiez le jeton « {label} » maintenant : il ne sera plus jamais affiché. Placez-le dans la variable d’environnement',
                { label: issued.label },
              )}{' '}
              <code>{VARIABLE}</code>{' '}
              {$t(': les configurations ci-dessous n’en portent que le nom, jamais le jeton.')}
            </p>
            <CodeGroup blocks={snippets.variable} />
            {snippets.rest.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {$t('Pour un programme : l’en-tête')} <code>Authorization: Bearer</code>{' '}
                  {$t('sur les routes de données de cette base.')}
                  {issued.environments === 'all' && several && (
                    <>
                      {' '}
                      {$t('L’en-tête')} <code>X-Basedb-Environment</code>{' '}
                      {$t('choisit l’environnement ; sans lui, c’est la production.')}
                    </>
                  )}
                </p>
                <CodeGroup blocks={snippets.rest} />
              </>
            )}
            {snippets.mcp.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {issued.environments === 'all' && several
                    ? $t(
                        'Pour un agent : déclarez le serveur MCP dans votre client — un par environnement, tous sur ce même jeton. Un outil peut aussi viser un autre environnement avec son argument environment.',
                      )
                    : $t('Pour un agent : déclarez le serveur MCP dans votre client.')}
                </p>
                <CodeGroup blocks={snippets.mcp} />
              </>
            )}
            <DialogFooter>
              <Button onClick={() => setIssued(null)}>{$t('Terminé')}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="min-w-0 space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{$t('Jetons de cette base')}</h3>
              {tokens === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {$t('Chargement…')}
                </p>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">{$t('Aucun jeton pour l’instant.')}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {tokens.map((token) => {
                    const state = stateOf(token)
                    return (
                      <li key={token.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium">{token.label}</span>
                            {several && (
                              <Badge variant="outline" className="shrink-0 font-normal">
                                {token.environments === 'all'
                                  ? $t('Tous les environnements')
                                  : (environment?.label ?? '')}
                              </Badge>
                            )}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {$t('bdb_{prefix}… · {surfaces} · {value}{value2}', {
                              prefix: token.prefix,
                              surfaces: doorsOf(token.surfaces),
                              value:
                                token.expires_at === null
                                  ? $t('sans expiration')
                                  : $t('expire le {expires_at}', {
                                      expires_at: date(token.expires_at),
                                    }),
                              value2:
                                token.last_used_at !== null &&
                                $t(' · utilisé le {last_used_at}', {
                                  last_used_at: date(token.last_used_at),
                                }),
                            })}
                          </span>
                        </span>
                        <Badge variant="secondary">{accessLabel(token.access)}</Badge>
                        {state === null && hasPassword ? (
                          // Disabled buttons raise no pointer events: the hint hangs on a wrapper
                          // so it can still say why, while the password field is empty.
                          <Hint
                            label={
                              password === ''
                                ? $t('Saisissez votre mot de passe ci-dessous')
                                : undefined
                            }
                          >
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                disabled={password === '' || busy}
                                onClick={() => void revoke(token)}
                              >
                                {$t('Révoquer')}
                              </Button>
                            </span>
                          </Hint>
                        ) : state === null ? null : (
                          <span className="text-xs text-muted-foreground">{state}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {!hasPassword ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
                {$t(
                  'Créer ou révoquer un jeton demande de confirmer son mot de passe, et votre compte se connecte par un fournisseur d’identité, sans mot de passe. Demandez-le à une personne qui gère cette base et se connecte avec un mot de passe.',
                )}
              </p>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">{$t('Nouveau jeton')}</h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="token-label">{$t('À quoi sert ce jeton ?')}</Label>
                    <Input
                      id="token-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder={$t('Synchronisation avec la comptabilité')}
                      maxLength={200}
                    />
                  </div>

                  <fieldset className="space-y-1.5">
                    <legend className="mb-1.5 text-sm font-medium">{$t('Accès')}</legend>
                    {SURFACES.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={`token-surface-${s.id}`}
                          checked={surfaces.has(s.id)}
                          onCheckedChange={(on) => toggle(s.id, on === true)}
                        />
                        <label htmlFor={`token-surface-${s.id}`} className="cursor-pointer">
                          {s.label} <span className="text-muted-foreground">— {s.hint}</span>
                        </label>
                      </div>
                    ))}
                    {surfaces.size === 0 && (
                      <p className="text-xs text-destructive">
                        {$t('Choisissez au moins un accès.')}
                      </p>
                    )}
                  </fieldset>

                  {several && environment !== undefined && (
                    <div className="space-y-1.5">
                      <Label>{$t('Environnements')}</Label>
                      <Select value={scope} onValueChange={(v) => setScope(v as TokenEnvironments)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {$t('Toute la base — tous ses environnements')}
                          </SelectItem>
                          <SelectItem value="one">
                            {$t('Seulement « {environment} »', {
                              environment: environment.label,
                            })}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {scope === 'all'
                          ? $t(
                              'Un seul jeton pour la production, la recette et les environnements à venir : le programme ou l’agent choisit l’environnement à chaque appel.',
                            )
                          : $t('Le jeton n’ouvrira aucun autre environnement de la base.')}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{$t('Droits')}</Label>
                      <Select value={access} onValueChange={(v) => setAccess(v as TokenAccess)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">{$t('Lecture seule')}</SelectItem>
                          <SelectItem value="write">{accessLabel('write')}</SelectItem>
                          <SelectItem value="delete">{accessLabel('delete')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{$t('Validité')}</Label>
                      <Select value={days} onValueChange={(v) => setDays(v as Duration)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATIONS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d === 'never'
                                ? $t('Sans expiration')
                                : $tp(Number(d), '{count} jour', '{count} jours')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {access === 'write' && (
                    <p className="text-xs text-muted-foreground">
                      {$t('Le jeton pourra créer et modifier des lignes, jamais en supprimer.')}
                    </p>
                  )}
                  {access === 'delete' && (
                    <p className="text-xs text-muted-foreground">
                      {$t(
                        'Le jeton pourra aussi supprimer des lignes, une à la fois. Une ligne supprimée se restaure depuis son historique — ou par l’agent lui-même, avec restore_record.',
                      )}
                    </p>
                  )}
                </section>

                <div className="space-y-1.5">
                  <Label htmlFor="token-password">{$t('Votre mot de passe')}</Label>
                  <Input
                    id="token-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && ready && void create()}
                  />
                  <p className="text-xs text-muted-foreground">
                    {$t(
                      'Demandé pour créer ou révoquer un jeton : ouvrir une porte vers l’extérieur exige une preuve récente.',
                    )}
                  </p>
                </div>
              </>
            )}

            {error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {$t('Fermer')}
              </Button>
              {hasPassword && (
                <Button onClick={() => void create()} disabled={!ready}>
                  {busy ? $t('Création…') : $t('Créer le jeton')}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
