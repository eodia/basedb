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
import {
  type ApiToken,
  type DescribedBase,
  type TokenSurface,
  api,
  mcpEndpoint,
  restRoot,
} from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { KeyRound, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Integration tokens of a base — chapter 08 §11, chapter 09 §9.
 *
 * ONE token for the two doors of a base: the REST API, for a program, and the MCP server,
 * for an agent — both by default, either on its own if that is all it is for. It is
 * scoped to THIS base and read-only by default: writing is a decision made here,
 * explicitly, never a default (09 §6.4). It asks for the password again, because minting
 * a door out of the instance demands a proof made seconds ago (05 §2.2).
 *
 * The secret is shown ONCE, followed by what each door needs, with the token in an
 * environment variable: a configuration file is versioned and synced, so it carries only
 * the variable's name (09 §9.2). One variable, `BASEDB_TOKEN`, for both: the relay is told
 * its name with `--token-env`.
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
  { id: 'rest', label: 'API REST', hint: 'un programme, un script, une synchronisation' },
  { id: 'mcp', label: 'MCP', hint: 'un agent : Claude ou tout client MCP' },
]

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

/** Why a token no longer answers, if it does not. */
function stateOf(token: ApiToken): string | null {
  if (token.revoked_at !== null) return 'Révoqué'
  if (token.suspended_at !== null) return 'Suspendu'
  if (token.expires_at !== null && Date.parse(token.expires_at) <= Date.now()) return 'Expiré'
  return null
}

/** What each door needs, the token referenced by its variable and never written in it. */
function configuration(secret: string, base: string, surfaces: readonly string[]) {
  const endpoint = mcpEndpoint()
  const relay = '<dépôt basedb>/apps/mcp/dist/relay.js'
  const args = [relay, '--url', endpoint, '--token-env', VARIABLE]
  return {
    variable: [
      {
        lang: 'powershell',
        title: 'Windows (PowerShell)',
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
            body: `curl "${restRoot()}/meta/bases/${base}" \\\n  -H "Authorization: Bearer $${VARIABLE}"`,
          },
          {
            lang: 'js',
            title: 'API REST — JavaScript',
            body: [
              `const response = await fetch('${restRoot()}/meta/bases/${base}', {`,
              `  headers: { Authorization: \`Bearer \${process.env.${VARIABLE}}\` },`,
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
            title: 'MCP — Claude Code',
            body: `claude mcp add basedb -- node ${args.join(' ')}`,
          },
          {
            lang: 'json',
            title: 'MCP — autre client',
            body: JSON.stringify({ mcpServers: { basedb: { command: 'node', args } } }, null, 2),
          },
        ]
      : [],
  }
}

/** « API REST · MCP », as a token's line says where it is accepted. */
function doorsOf(surfaces: readonly string[]): string {
  return SURFACES.filter((s) => surfaces.includes(s.id))
    .map((s) => s.label)
    .join(' · ')
}

export function TokenDialog({
  open,
  base,
  onClose,
}: {
  readonly open: boolean
  readonly base: Pick<DescribedBase, 'name' | 'label'>
  readonly onClose: () => void
}) {
  const [tokens, setTokens] = useState<readonly ApiToken[] | null>(null)
  const [label, setLabel] = useState('')
  const [access, setAccess] = useState<'read' | 'write'>('read')
  const [surfaces, setSurfaces] = useState<ReadonlySet<TokenSurface>>(new Set(['rest', 'mcp']))
  const [days, setDays] = useState<Duration>('never')
  const [password, setPassword] = useState('')
  const [issued, setIssued] = useState<{
    secret: string
    label: string
    surfaces: readonly string[]
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTokens(await api.tokens(base.name))
    } catch (e) {
      setTokens([])
      setError(messageFor(e))
    }
  }, [base.name])

  useEffect(() => {
    if (!open) return
    setLabel('')
    setAccess('read')
    setSurfaces(new Set(['rest', 'mcp']))
    setDays('never')
    setPassword('')
    setIssued(null)
    setError(null)
    setTokens(null)
    void load()
  }, [open, load])

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
      setError(messageFor(e))
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
      })
      setIssued({ secret: token.secret, label: token.label, surfaces: token.surfaces })
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

  const snippets = issued === null ? null : configuration(issued.secret, base.name, issued.surfaces)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Jetons API et MCP — {base.label}</DialogTitle>
          <DialogDescription>
            Un jeton d’intégration ouvre cette base à un programme, par l’API REST, ou à un agent
            (Claude ou tout client MCP) : il la lit et, si vous le décidez, y crée et modifie des
            lignes. Il ne peut ni supprimer une ligne ni changer la structure, et ne voit que ce que
            vous pouvez voir.
          </DialogDescription>
        </DialogHeader>

        {issued !== null && snippets !== null ? (
          <div className="min-w-0 space-y-3">
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Copiez le jeton « {issued.label} » maintenant : il ne sera plus jamais affiché.
              Placez-le dans la variable d’environnement <code>{VARIABLE}</code> : les
              configurations ci-dessous n’en portent que le nom, jamais le jeton.
            </p>
            <CodeGroup blocks={snippets.variable} />
            {snippets.rest.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Pour un programme : l’en-tête <code>Authorization: Bearer</code> sur les routes de
                  données de cette base.
                </p>
                <CodeGroup blocks={snippets.rest} />
              </>
            )}
            {snippets.mcp.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Pour un agent : déclarez le relais dans votre client MCP.
                </p>
                <CodeGroup blocks={snippets.mcp} />
              </>
            )}
            <DialogFooter>
              <Button onClick={() => setIssued(null)}>Terminé</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="min-w-0 space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Jetons de cette base</h3>
              {tokens === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Chargement…
                </p>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun jeton pour l’instant.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {tokens.map((token) => {
                    const state = stateOf(token)
                    return (
                      <li key={token.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{token.label}</span>
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            bdb_{token.prefix}… · {doorsOf(token.surfaces)} ·{' '}
                            {token.expires_at === null
                              ? 'sans expiration'
                              : `expire le ${date(token.expires_at)}`}
                            {token.last_used_at !== null &&
                              ` · utilisé le ${date(token.last_used_at)}`}
                          </span>
                        </span>
                        <Badge variant="secondary">
                          {token.access === 'write' ? 'Lecture et écriture' : 'Lecture seule'}
                        </Badge>
                        {state === null ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={password === '' || busy}
                            title={
                              password === ''
                                ? 'Saisissez votre mot de passe ci-dessous'
                                : undefined
                            }
                            onClick={() => void revoke(token)}
                          >
                            Révoquer
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{state}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium">Nouveau jeton</h3>
              <div className="space-y-1.5">
                <Label htmlFor="token-label">À quoi sert ce jeton ?</Label>
                <Input
                  id="token-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Synchronisation avec la comptabilité"
                  maxLength={200}
                />
              </div>

              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-sm font-medium">Accès</legend>
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
                  <p className="text-xs text-destructive">Choisissez au moins un accès.</p>
                )}
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Droits</Label>
                  <Select value={access} onValueChange={(v) => setAccess(v as 'read' | 'write')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Lecture seule</SelectItem>
                      <SelectItem value="write">Lecture et écriture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Validité</Label>
                  <Select value={days} onValueChange={(v) => setDays(v as Duration)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d === 'never' ? 'Sans expiration' : `${d} jours`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {access === 'write' && (
                <p className="text-xs text-muted-foreground">
                  Le jeton pourra créer et modifier des lignes, jamais en supprimer.
                </p>
              )}
            </section>

            <div className="space-y-1.5">
              <Label htmlFor="token-password">Votre mot de passe</Label>
              <Input
                id="token-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ready && void create()}
              />
              <p className="text-xs text-muted-foreground">
                Demandé pour créer ou révoquer un jeton : ouvrir une porte vers l’extérieur exige
                une preuve récente.
              </p>
            </div>

            {error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Fermer
              </Button>
              <Button onClick={() => void create()} disabled={!ready}>
                {busy ? 'Création…' : 'Créer le jeton'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
