'use client'

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
  ApiError,
  type CompatibilityAlias,
  type DeletedTable,
  type PurgeExport,
  type RenameImpact,
  api,
} from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { AlertTriangle, Loader2, Scissors, Trash2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Chapter 06, on screen: the physical name of a base, a table or a field, the aliases
 * left behind by a rename, and the purge.
 *
 * These are administration acts, and every one of them is built the same way: what the
 * act would touch first, then the name typed in full, then the act. The screens say what
 * they cannot know — a script that writes a table's name by hand is invisible from here —
 * because promising a safety that is not there would be worse than having none.
 */

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })
const NUMBER = new Intl.NumberFormat('fr-FR')

function size(bytes: number | null): string {
  if (bytes === null) return 'inconnue'
  if (bytes < 1024 * 1024) return `${NUMBER.format(Math.ceil(bytes / 1024))} Ko`
  return `${NUMBER.format(Math.round((bytes / 1024 / 1024) * 10) / 10)} Mo`
}

function ErrorLine({ error }: { readonly error: string | null }) {
  if (error === null) return null
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  )
}

function Confirm({
  expected,
  value,
  onChange,
  what,
}: {
  readonly expected: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly what: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="confirm-name" className="text-sm">
        Pour confirmer, saisissez {what} :{' '}
        <code className="rounded bg-muted px-1 font-mono">{expected}</code>
      </Label>
      <Input
        id="confirm-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
      />
    </div>
  )
}

// ── Physical rename ────────────────────────────────────────────────────────────

export type PhysicalTarget = {
  readonly kind: 'base' | 'table' | 'field'
  readonly id: string
  readonly label: string
}

const KIND_NAME: Readonly<Record<PhysicalTarget['kind'], string>> = {
  base: 'la base',
  table: 'la table',
  field: 'le champ',
}

export function PhysicalRenameDialog({
  target,
  onClose,
  onDone,
}: {
  readonly target: PhysicalTarget | null
  readonly onClose: () => void
  /** Renamed: what the name was, and what it is now. */
  readonly onDone: (change: { readonly from: string; readonly to: string }) => void
}) {
  const [impact, setImpact] = useState<RenameImpact | null>(null)
  const [name, setName] = useState('')
  const [alias, setAlias] = useState(true)
  const [days, setDays] = useState('180')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  useEffect(() => {
    if (target === null) return
    setImpact(null)
    setConfirm('')
    setError(null)
    setSuggestion(null)
    setAlias(target.kind !== 'field')
    setDays('180')
    api.renameImpact(target.kind, target.id).then(
      (found) => {
        setImpact(found)
        setName(found.suggested === found.current ? '' : found.suggested)
      },
      (e) => setError(messageFor(e)),
    )
  }, [target])

  const submit = async () => {
    if (target === null || impact === null) return
    setBusy(true)
    setError(null)
    setSuggestion(null)
    try {
      const done = await api.renamePhysical(target.kind, target.id, {
        name: name.trim(),
        confirm,
        ...(impact.alias_allowed ? { alias, alias_days: Number(days) } : {}),
      })
      onDone({ from: impact.current, to: done.name })
    } catch (e) {
      setError(messageFor(e))
      if (e instanceof ApiError && typeof e.details.suggestion === 'string') {
        setSuggestion(e.details.suggestion)
      }
    } finally {
      setBusy(false)
    }
  }

  const daysOk = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 3650
  const ready =
    impact !== null &&
    name.trim() !== '' &&
    name.trim() !== impact.current &&
    confirm === impact.current &&
    (!impact.alias_allowed || !alias || daysOk) &&
    !busy

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Renommer en base — {target?.label}</DialogTitle>
          <DialogDescription>
            Change le nom de {target === null ? '' : KIND_NAME[target.kind]} dans PostgreSQL. Le
            libellé ne bouge pas, et l’API, le MCP et l’interface suivent d’eux-mêmes ; ce qui
            casse, c’est ce qui écrit l’ancien nom à la main — un script, un rapport, un modèle dbt.
          </DialogDescription>
        </DialogHeader>

        <ErrorLine error={error} />
        {suggestion !== null && (
          <Button variant="outline" size="sm" onClick={() => setName(suggestion)}>
            Utiliser « {suggestion} »
          </Button>
        )}

        {impact === null ? (
          error === null && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
            </div>
          )
        ) : (
          <div className="min-w-0 space-y-4 text-sm">
            <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-muted-foreground">Nom actuel</dt>
              <dd className="font-mono break-all">{impact.qualified}</dd>
              {impact.kind !== 'field' && (
                <>
                  <dt className="text-muted-foreground">Lignes</dt>
                  <dd>
                    {impact.estimated_rows === null
                      ? 'inconnu'
                      : `${NUMBER.format(Math.round(impact.estimated_rows))} (estimation)`}{' '}
                    · {size(impact.bytes)}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Webhooks</dt>
              <dd>{impact.webhooks.length === 0 ? 'aucun' : impact.webhooks.join(', ')}</dd>
              <dt className="text-muted-foreground">Jetons actifs (30 j)</dt>
              <dd>
                {impact.tokens.length === 0
                  ? 'aucun'
                  : impact.tokens.map((t) => t.label).join(', ')}
              </dd>
            </dl>

            {impact.misaligned_links.length > 0 && (
              <p className="text-muted-foreground">
                Ces colonnes de relation portent l’ancien nom et ne seront pas renommées :{' '}
                {impact.misaligned_links.map((l) => `${l.table}.${l.column}`).join(', ')}.
              </p>
            )}
            {impact.dependents.length > 0 && (
              <p className="text-muted-foreground">
                Objets créés hors de basedb qui en dépendent (ils suivent le renommage) :{' '}
                <span className="font-mono">{impact.dependents.join(', ')}</span>.
              </p>
            )}
            {impact.citing_prompts > 0 && (
              <p className="text-muted-foreground">
                {impact.citing_prompts} consigne{impact.citing_prompts > 1 ? 's' : ''} de champ IA
                cite{impact.citing_prompts > 1 ? 'nt' : ''} cette colonne : elle
                {impact.citing_prompts > 1 ? 's seront réécrites' : ' sera réécrite'}.
              </p>
            )}

            <p className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span>
                Les connexions SQL directes ne sont pas observables depuis basedb : personne ne peut
                dire ici qui écrit encore l’ancien nom.
                {impact.alias_allowed
                  ? ' L’alias les protège, en lecture comme en écriture, sauf INSERT … ON CONFLICT DO UPDATE, COPY et TRUNCATE.'
                  : ' Un champ n’a pas d’alias possible : ce renommage est sans filet.'}
              </span>
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="physical-name">Nouveau nom</Label>
              <Input
                id="physical-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
              />
            </div>

            {impact.alias_allowed && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2">
                  <Checkbox
                    id="physical-alias"
                    checked={alias}
                    onCheckedChange={(v) => setAlias(v === true)}
                  />
                  <Label htmlFor="physical-alias" className="font-normal">
                    Créer un alias de compatibilité sous l’ancien nom
                  </Label>
                </span>
                {alias && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    échéance
                    <Input
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      className="h-8 w-20"
                      inputMode="numeric"
                      aria-label="Échéance de l’alias, en jours"
                    />
                    jours
                  </span>
                )}
              </div>
            )}
            {impact.live_aliases > 0 && (
              <p className="text-xs text-muted-foreground">
                {impact.live_aliases} alias déjà en place (cinq au plus).
              </p>
            )}

            <Confirm
              expected={impact.current}
              value={confirm}
              onChange={setConfirm}
              what="le nom actuel"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!ready}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Renommer en base
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Aliases ────────────────────────────────────────────────────────────────────

export function AliasesDialog({
  base,
  onClose,
}: {
  readonly base: { readonly name: string; readonly label: string } | null
  readonly onClose: () => void
}) {
  const [aliases, setAliases] = useState<readonly CompatibilityAlias[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dropping, setDropping] = useState<CompatibilityAlias | null>(null)
  const [cutting, setCutting] = useState<CompatibilityAlias | null>(null)
  const [days, setDays] = useState('35')
  const [confirm, setConfirm] = useState('')

  const load = useCallback(async () => {
    if (base === null) return
    try {
      setAliases(await api.aliases(base.name))
    } catch (e) {
      setAliases([])
      setError(messageFor(e))
    }
  }, [base])

  useEffect(() => {
    if (base === null) return
    setAliases(null)
    setError(null)
    setDropping(null)
    setCutting(null)
    void load()
  }, [base, load])

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
      setDropping(null)
      setCutting(null)
      setConfirm('')
      await load()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(null)
    }
  }

  const cutDays = Number(days)
  const cutOk = /^\d+$/.test(days) && cutDays >= 35 && cutDays <= 3650

  return (
    <Dialog open={base !== null} onOpenChange={(o) => !o && busy === null && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alias de compatibilité — {base?.label}</DialogTitle>
          <DialogDescription>
            Un alias garde l’ancien nom d’une base ou d’une table en service après un renommage. On
            ne le supprime jamais sur la foi d’un compteur : la coupure à blanc le retire un temps,
            et ceux qui s’en servaient encore se manifestent.
          </DialogDescription>
        </DialogHeader>
        <ErrorLine error={error} />

        {aliases === null ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        ) : aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun alias sur cette base.</p>
        ) : (
          <ul className="min-w-0 space-y-2">
            {aliases.map((a) => (
              <li key={a.id} className="space-y-2 rounded-lg border px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono break-all">{a.qualified}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.kind === 'schema'
                        ? `ancien nom de la base — ${a.views} vue${a.views > 1 ? 's' : ''}`
                        : `ancien nom de « ${a.target_label} »`}{' '}
                      → <span className="font-mono">{a.target}</span> · créé le{' '}
                      {DATE.format(new Date(a.created_at))}
                      {a.drop_after !== null &&
                        ` · échéance le ${DATE.format(new Date(a.drop_after))}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {a.blank_cut === null ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => {
                          setCutting(a)
                          setDropping(null)
                          setDays('35')
                        }}
                      >
                        <Scissors className="size-4" />
                        Couper à blanc
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void act(a.id, () => api.restoreAlias(a.id))}
                      >
                        <Undo2 className="size-4" />
                        Rétablir
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      className="text-destructive"
                      onClick={() => {
                        setDropping(a)
                        setCutting(null)
                        setConfirm('')
                      }}
                    >
                      <Trash2 className="size-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>

                {a.blank_cut !== null && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Coupé jusqu’au {DATE.format(new Date(a.blank_cut.until))}, sous le nom{' '}
                    <span className="font-mono">{a.blank_cut.name}</span>. Les erreurs 42P01 sur
                    l’ancien nom apparaissent dans le journal du serveur PostgreSQL.
                  </p>
                )}
                {a.dependents.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Construit dessus hors de basedb :{' '}
                    <span className="font-mono">{a.dependents.join(', ')}</span> — la suppression
                    est impossible tant qu’ils existent.
                  </p>
                )}

                {cutting?.id === a.id && (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                    <span className="text-muted-foreground">Couper pendant</span>
                    <Input
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      className="h-8 w-20"
                      inputMode="numeric"
                      aria-label="Durée de la coupure, en jours"
                    />
                    <span className="text-muted-foreground">
                      jours (35 au moins : le cycle le plus long connu sur cette base)
                    </span>
                    <Button
                      size="sm"
                      disabled={!cutOk || busy !== null}
                      onClick={() => void act(a.id, () => api.cutAlias(a.id, cutDays))}
                    >
                      Couper
                    </Button>
                  </div>
                )}
                {dropping?.id === a.id && (
                  <div className="space-y-2 border-t pt-2">
                    <Confirm
                      expected={a.name}
                      value={confirm}
                      onChange={setConfirm}
                      what="le nom de l’alias"
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={confirm !== a.name || busy !== null}
                        onClick={() => void act(a.id, () => api.dropAlias(a.id, confirm))}
                      >
                        {busy === a.id && <Loader2 className="size-4 animate-spin" />}
                        Supprimer l’alias
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Purge ──────────────────────────────────────────────────────────────────────

export type PurgeTarget = {
  readonly kind: 'base' | 'table'
  readonly id: string
  readonly label: string
  readonly deletedAt: string
}

/** Export, then the label typed with the manifest's counts in view, then destruction. */
export function PurgeDialog({
  target,
  onClose,
  onDone,
}: {
  readonly target: PurgeTarget | null
  readonly onClose: () => void
  readonly onDone: () => void
}) {
  const [exported, setExported] = useState<PurgeExport | null>(null)
  const [confirm, setConfirm] = useState('')
  const [justification, setJustification] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [residual, setResidual] = useState(false)

  useEffect(() => {
    if (target === null) return
    setExported(null)
    setConfirm('')
    setJustification('')
    setError(null)
    setResidual(false)
  }, [target])

  const due = target === null ? 0 : Date.parse(target.deletedAt) + 30 * 86_400_000
  const early = Date.now() < due

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const exportNow = () =>
    run(async () => {
      if (target === null) return
      setExported(await api.exportForPurge(target.kind, target.id))
    })

  const purgeNow = () =>
    run(async () => {
      if (target === null || exported === null) return
      const done = await api.purge({
        kind: target.kind,
        id: target.id,
        export: exported.id,
        confirm,
        ...(early ? { early_justification: justification } : {}),
      })
      if (done.residual_schema) setResidual(true)
      else onDone()
    })

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Purger {target?.kind === 'base' ? 'la base' : 'la table'} « {target?.label} »
          </DialogTitle>
          <DialogDescription>
            La seule opération irréversible de basedb : les données sont détruites. Un export CSV
            est écrit d’abord sur le serveur d’application, et il n’est jamais effacé par basedb. Le
            nom, lui, reste réservé pour toujours.
          </DialogDescription>
        </DialogHeader>
        <ErrorLine error={error} />

        {residual ? (
          <div className="space-y-3 text-sm">
            <p>
              Les tables sont détruites, mais le schéma reste : un objet créé hors de basedb s’y
              trouve encore. Sa suppression revient à l’exploitant de la base.
            </p>
            <DialogFooter>
              <Button onClick={onDone}>Terminé</Button>
            </DialogFooter>
          </div>
        ) : exported === null ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Supprimée le {target === null ? '' : DATE.format(new Date(target.deletedAt))}.{' '}
              {early
                ? `La purge est possible à partir du ${DATE.format(new Date(due))} ; avant, seul un administrateur d’instance peut l’avancer, en le justifiant.`
                : 'Le délai de trente jours est écoulé.'}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={() => void exportNow()} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Exporter d’abord
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="min-w-0 space-y-3 text-sm">
            <p>
              Export écrit dans <span className="font-mono break-all">{exported.directory}</span> :{' '}
              {NUMBER.format(exported.total_rows)} ligne{exported.total_rows > 1 ? 's' : ''},{' '}
              {size(exported.total_bytes)} en base.
            </p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {exported.tables.map((t) => (
                <li key={t.id}>
                  {t.label} — {NUMBER.format(t.rows)} ligne{t.rows > 1 ? 's' : ''} ·{' '}
                  <span className="font-mono">{t.file}</span>
                </li>
              ))}
            </ul>
            {early && (
              <div className="space-y-1.5">
                <Label htmlFor="purge-justification">
                  Justification (avant trente jours, administrateur d’instance)
                </Label>
                <Input
                  id="purge-justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
              </div>
            )}
            <Confirm
              expected={target?.label ?? ''}
              value={confirm}
              onChange={setConfirm}
              what="le libellé exact"
            />
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => void purgeNow()}
                disabled={
                  busy || confirm !== target?.label || (early && justification.trim() === '')
                }
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Purger définitivement
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Deleted tables ─────────────────────────────────────────────────────────────

export function DeletedTablesDialog({
  base,
  onClose,
}: {
  readonly base: { readonly name: string; readonly label: string } | null
  readonly onClose: () => void
}) {
  const [tables, setTables] = useState<readonly DeletedTable[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [purging, setPurging] = useState<PurgeTarget | null>(null)

  const load = useCallback(async () => {
    if (base === null) return
    try {
      setTables(await api.deletedTables(base.name))
    } catch (e) {
      setTables([])
      setError(messageFor(e))
    }
  }, [base])

  useEffect(() => {
    if (base === null) return
    setTables(null)
    setError(null)
    void load()
  }, [base, load])

  return (
    <>
      <Dialog open={base !== null && purging === null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tables supprimées — {base?.label}</DialogTitle>
            <DialogDescription>
              Une table supprimée garde ses lignes sous un nom marqué ; elle peut être purgée trente
              jours après, une fois exportée.
            </DialogDescription>
          </DialogHeader>
          <ErrorLine error={error} />
          {tables === null ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
            </div>
          ) : tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune table supprimée.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {tables.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{t.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      supprimée le {DATE.format(new Date(t.deleted_at))}
                      {t.deleted_by !== null && ` par ${t.deleted_by}`} ·{' '}
                      <span className="font-mono">{t.name}</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('shrink-0 text-destructive')}
                    onClick={() =>
                      setPurging({
                        kind: 'table',
                        id: t.id,
                        label: t.label,
                        deletedAt: t.deleted_at,
                      })
                    }
                  >
                    Purger…
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <PurgeDialog
        target={purging}
        onClose={() => setPurging(null)}
        onDone={() => {
          setPurging(null)
          void load()
        }}
      />
    </>
  )
}
