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
  type PhysicalRef,
  type PurgeExport,
  type RenameImpact,
  api,
} from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { AlertTriangle, Loader2, Scissors, Trash2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Chapter 06, on screen: the physical name of a base, a table or a field — renamed from
 * the dialog that edits its label —, the aliases left behind by a rename, and the purge.
 *
 * These are administration acts, and every one of them is built the same way: what the
 * act would touch first, then the name typed in full, then the act. The screens say what
 * they cannot know — a script that writes a table's name by hand is invisible from here —
 * because promising a safety that is not there would be worse than having none.
 */

const DATE = new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium' })
const NUMBER = new Intl.NumberFormat(intlLocale())

function size(bytes: number | null): string {
  if (bytes === null) return 'inconnue'
  if (bytes < 1024 * 1024) return $t('{ceil} Ko', { ceil: NUMBER.format(Math.ceil(bytes / 1024)) })
  return $t('{format} Mo', { format: NUMBER.format(Math.round((bytes / 1024 / 1024) * 10) / 10) })
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
        {$t('Pour confirmer, saisissez {what} :', { what })}{' '}
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

/** What the dialog renames: the object, and the label it has in the catalog. */
export type PhysicalTarget = PhysicalRef & { readonly label: string }

/** What a relabelling takes along when the box is ticked: the name in the database. */
export interface PhysicalRename {
  /** The line under the label — and, ticked, what the rename would touch. */
  readonly element: React.ReactNode
  /** The rename is asked for. */
  readonly asked: boolean
  /** Nothing asked, or everything the rename needs is filled in. */
  readonly ready: boolean
  /**
   * Runs the rename if it is asked for, and answers the name before and after, as the
   * interface names the object — for a base, its whole logical name.
   */
  readonly run: () => Promise<{ readonly from: string; readonly to: string } | null>
}

/** The reference behind the key `usePhysicalRename` keeps: `kind:id`, or `field:b/t/f`. */
function refOf(opened: string): PhysicalRef {
  const [kind, rest] = [opened.slice(0, opened.indexOf(':')), opened.slice(opened.indexOf(':') + 1)]
  if (kind === 'field') {
    const [base, table, field] = rest.split('/') as [string, string, string]
    return { kind: 'field', base, table, field }
  }
  return { kind: kind === 'base' ? 'base' : 'table', id: rest }
}

/**
 * The physical name, under the label of an edit dialog — chapter 06 §2.
 *
 * One gesture renames: the label is always editable, and an administrator finds under it
 * « Renommer aussi en base : `clients` → `comptes` », the new name slugged from the label
 * being typed. Only ticked does the dialog grow what a physical rename is: what it would
 * touch, the new name to adjust, the alias, the current name typed in full. Everyone
 * else reads the name in the database, and that it does not move.
 *
 * `current` is the name the object carries — shown until the impact arrives, and to those
 * who cannot rename it.
 */
export function usePhysicalRename({
  target,
  current,
  label,
  administers,
}: {
  /** `null` while the dialog is closed. */
  readonly target: PhysicalTarget | null
  readonly current: string
  /** The label as typed in the dialog. */
  readonly label: string
  readonly administers: boolean
}): PhysicalRename {
  const [asked, setAsked] = useState(false)
  const [impact, setImpact] = useState<RenameImpact | null>(null)
  // The impact could not be read — the server does not count this person as an
  // administrator of structures: the plain line is shown instead of an offer refused.
  const [refused, setRefused] = useState(false)
  const [name, setName] = useState('')
  // A name typed by hand is no longer replaced by the suggestion.
  const touched = useRef(false)
  // The first reading is immediate; the next ones wait for the typing to pause.
  const loaded = useRef(false)
  const [alias, setAlias] = useState(true)
  const [days, setDays] = useState('180')
  const [confirm, setConfirm] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const kind = target?.kind
  const original = target?.label
  // Which object the dialog is open on: another one starts afresh — and the reference
  // the requests go to, rebuilt from it so that a new object literal each render does
  // not count as another object.
  const opened =
    target === null
      ? null
      : target.kind === 'field'
        ? `field:${target.base}/${target.table}/${target.field}`
        : `${target.kind}:${target.id}`

  // Opening the dialog opens the rename as it is now: nothing ticked.
  useEffect(() => {
    if (opened === null) return
    setAsked(false)
    setImpact(null)
    setRefused(false)
    setName('')
    touched.current = false
    loaded.current = false
    setAlias(!opened.startsWith('field:'))
    setDays('180')
    setConfirm('')
    setSuggestion(null)
  }, [opened])

  // The impact, read on opening and again as the label is typed — the suggestion follows
  // it. Debounced: a keystroke is not a question to the server.
  const typed = label.trim()
  useEffect(() => {
    if (!administers || opened === null) return
    const ref = refOf(opened)
    let live = true
    const timer = setTimeout(
      () => {
        api.renameImpact(ref, typed === '' || typed === original ? undefined : typed).then(
          (found) => {
            if (!live) return
            loaded.current = true
            setImpact(found)
            if (!touched.current) {
              setName(found.suggested === found.current ? '' : found.suggested)
            }
          },
          () => live && setRefused(true),
        )
      },
      loaded.current ? 300 : 0,
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [administers, opened, typed, original])

  const offered = administers && !refused && impact !== null
  const next = name.trim()
  const daysOk = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 3650
  const ready =
    !asked ||
    (impact !== null &&
      next !== '' &&
      next !== impact.current &&
      confirm === impact.current &&
      (!impact.alias_allowed || !alias || daysOk))

  const run = async () => {
    if (!asked || impact === null || opened === null) return null
    setSuggestion(null)
    try {
      const done = await api.renamePhysical(refOf(opened), {
        name: next,
        confirm,
        ...(impact.alias_allowed ? { alias, alias_days: Number(days) } : {}),
      })
      // A base is named by its whole schema, whose tail is the slug that changed.
      if (kind === 'base') {
        const stem = impact.qualified.slice(0, impact.qualified.length - impact.current.length)
        return { from: impact.qualified, to: `${stem}${done.name}` }
      }
      return { from: impact.current, to: done.name }
    } catch (e) {
      if (e instanceof ApiError && typeof e.details.suggestion === 'string') {
        setSuggestion(e.details.suggestion)
      }
      throw e
    }
  }

  const element = !offered ? (
    <p className="text-xs text-muted-foreground">
      {$t('Nom en base')} <code className="rounded bg-muted px-1 font-mono">{current}</code>{' '}
      {$t(
        ': il ne change pas avec le libellé, et les requêtes SQL comme les intégrations continuent de fonctionner.',
      )}
    </p>
  ) : (
    <div className="min-w-0 space-y-3">
      <div className="flex items-start gap-2 text-sm">
        <Checkbox
          id={`physical-${impact.id}`}
          checked={asked}
          onCheckedChange={(v) => setAsked(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor={`physical-${impact.id}`} className="block font-normal leading-snug">
          {$t('Renommer aussi en base :')}{' '}
          <code className="rounded bg-muted px-1 font-mono">{impact.current}</code>
          {next !== '' && next !== impact.current && (
            <>
              {' '}
              → <code className="rounded bg-muted px-1 font-mono">{next}</code>
            </>
          )}
        </Label>
      </div>

      {asked && (
        <div className="min-w-0 space-y-4 rounded-lg border bg-muted/30 p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted-foreground">{$t('Nom actuel')}</dt>
            <dd className="font-mono break-all">{impact.qualified}</dd>
            {impact.kind !== 'field' && (
              <>
                <dt className="text-muted-foreground">{$t('Lignes')}</dt>
                <dd>
                  {impact.estimated_rows === null
                    ? 'inconnu'
                    : `${NUMBER.format(Math.round(impact.estimated_rows))} (estimation)`}{' '}
                  · {size(impact.bytes)}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{$t('Webhooks')}</dt>
            <dd>{impact.webhooks.length === 0 ? 'aucun' : impact.webhooks.join(', ')}</dd>
            <dt className="text-muted-foreground">{$t('Jetons actifs (30 j)')}</dt>
            <dd>
              {impact.tokens.length === 0 ? 'aucun' : impact.tokens.map((t) => t.label).join(', ')}
            </dd>
          </dl>

          {impact.misaligned_links.length > 0 && (
            <p className="text-muted-foreground">
              {$t(
                'Ces colonnes de relation portent l’ancien nom et ne seront pas renommées : {map}.',
                { map: impact.misaligned_links.map((l) => `${l.table}.${l.column}`).join(', ') },
              )}
            </p>
          )}
          {impact.dependents.length > 0 && (
            <p className="text-muted-foreground">
              {$t('Objets créés hors de basedb qui en dépendent (ils suivent le renommage) :')}{' '}
              <span className="font-mono">{impact.dependents.join(', ')}</span>.
            </p>
          )}
          {impact.citing_prompts > 0 && (
            <p className="text-muted-foreground">
              {$tp(
                impact.citing_prompts,
                '{count} consigne de champ IA cite cette colonne : elle sera réécrite.',
                '{count} consignes de champ IA citent cette colonne : elles seront réécrites.',
              )}
            </p>
          )}

          <p className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>
              {$t(
                'L’API, le MCP et l’interface suivent d’eux-mêmes ; ce qui casse, c’est ce qui écrit l’ancien nom à la main — un script, un rapport, un modèle dbt —, et ces connexions ne sont pas observables depuis basedb.{value}',
                {
                  value: impact.alias_allowed
                    ? $t(
                        ' L’alias les protège, en lecture comme en écriture, sauf INSERT … ON CONFLICT DO UPDATE, COPY et TRUNCATE.',
                      )
                    : $t(' Un champ n’a pas d’alias possible : ce renommage est sans filet.'),
                },
              )}
            </span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="physical-name">{$t('Nouveau nom en base')}</Label>
            <Input
              id="physical-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                touched.current = true
              }}
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
            />
            {suggestion !== null && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setName(suggestion)
                  touched.current = true
                  setSuggestion(null)
                }}
              >
                {$t('Utiliser « {suggestion} »', { suggestion })}
              </Button>
            )}
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
                  {$t('Créer un alias de compatibilité sous l’ancien nom')}
                </Label>
              </span>
              {alias && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {$t('échéance')}
                  <Input
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="h-8 w-20"
                    inputMode="numeric"
                    aria-label={$t('Échéance de l’alias, en jours')}
                  />
                  {$t('jours')}
                </span>
              )}
            </div>
          )}
          {impact.live_aliases > 0 && (
            <p className="text-xs text-muted-foreground">
              {$t('{live_aliases} alias déjà en place (cinq au plus).', {
                live_aliases: impact.live_aliases,
              })}
            </p>
          )}

          <Confirm
            expected={impact.current}
            value={confirm}
            onChange={setConfirm}
            what={$t('le nom actuel')}
          />
        </div>
      )}
    </div>
  )

  return { element, asked, ready, run }
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
          <DialogTitle>
            {$t('Alias de compatibilité — {label}', { label: base?.label })}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'Un alias garde l’ancien nom d’une base ou d’une table en service après un renommage. On ne le supprime jamais sur la foi d’un compteur : la coupure à blanc le retire un temps, et ceux qui s’en servaient encore se manifestent.',
            )}
          </DialogDescription>
        </DialogHeader>
        <ErrorLine error={error} />

        {aliases === null ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        ) : aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{$t('Aucun alias sur cette base.')}</p>
        ) : (
          <ul className="min-w-0 space-y-2">
            {aliases.map((a) => (
              <li key={a.id} className="space-y-2 rounded-lg border px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono break-all">{a.qualified}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.kind === 'schema'
                        ? $tp(
                            a.views,
                            'ancien nom de la base — {count} vue',
                            'ancien nom de la base — {count} vues',
                          )
                        : $t('ancien nom de « {target_label} »', {
                            target_label: a.target_label,
                          })}{' '}
                      → <span className="font-mono">{a.target}</span>{' '}
                      {$t('· créé le {format}{value}', {
                        format: DATE.format(new Date(a.created_at)),
                        value:
                          a.drop_after !== null &&
                          $t(' · échéance le {format}', {
                            format: DATE.format(new Date(a.drop_after)),
                          }),
                      })}
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
                        {$t('Couper à blanc')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void act(a.id, () => api.restoreAlias(a.id))}
                      >
                        <Undo2 className="size-4" />
                        {$t('Rétablir')}
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
                      {$t('Supprimer')}
                    </Button>
                  </div>
                </div>

                {a.blank_cut !== null && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {$t('Coupé jusqu’au {format}, sous le nom', {
                      format: DATE.format(new Date(a.blank_cut.until)),
                    })}{' '}
                    <span className="font-mono">{a.blank_cut.name}</span>
                    {$t(
                      '. Les erreurs 42P01 sur l’ancien nom apparaissent dans le journal du serveur PostgreSQL.',
                    )}
                  </p>
                )}
                {a.dependents.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {$t('Construit dessus hors de basedb :')}{' '}
                    <span className="font-mono">{a.dependents.join(', ')}</span>{' '}
                    {$t('— la suppression est impossible tant qu’ils existent.')}
                  </p>
                )}

                {cutting?.id === a.id && (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                    <span className="text-muted-foreground">{$t('Couper pendant')}</span>
                    <Input
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      className="h-8 w-20"
                      inputMode="numeric"
                      aria-label={$t('Durée de la coupure, en jours')}
                    />
                    <span className="text-muted-foreground">
                      {$t('jours (35 au moins : le cycle le plus long connu sur cette base)')}
                    </span>
                    <Button
                      size="sm"
                      disabled={!cutOk || busy !== null}
                      onClick={() => void act(a.id, () => api.cutAlias(a.id, cutDays))}
                    >
                      {$t('Couper')}
                    </Button>
                  </div>
                )}
                {dropping?.id === a.id && (
                  <div className="space-y-2 border-t pt-2">
                    <Confirm
                      expected={a.name}
                      value={confirm}
                      onChange={setConfirm}
                      what={$t('le nom de l’alias')}
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={confirm !== a.name || busy !== null}
                        onClick={() => void act(a.id, () => api.dropAlias(a.id, confirm))}
                      >
                        {busy === a.id && <Loader2 className="size-4 animate-spin" />}
                        {$t('Supprimer l’alias')}
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
            {$t('Purger {value} « {label} »', {
              value: target?.kind === 'base' ? $t('la base') : $t('la table'),
              label: target?.label,
            })}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'La seule opération irréversible de basedb : les données sont détruites. Un export CSV est écrit d’abord sur le serveur d’application, et il n’est jamais effacé par basedb. Le nom, lui, reste réservé pour toujours.',
            )}
          </DialogDescription>
        </DialogHeader>
        <ErrorLine error={error} />

        {residual ? (
          <div className="space-y-3 text-sm">
            <p>
              {$t(
                'Les tables sont détruites, mais le schéma reste : un objet créé hors de basedb s’y trouve encore. Sa suppression revient à l’exploitant de la base.',
              )}
            </p>
            <DialogFooter>
              <Button onClick={onDone}>{$t('Terminé')}</Button>
            </DialogFooter>
          </div>
        ) : exported === null ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {$t('Supprimée le {value}. {value2}', {
                value: target === null ? '' : DATE.format(new Date(target.deletedAt)),
                value2: early
                  ? $t(
                      'La purge est possible à partir du {format} ; avant, seul un administrateur d’instance peut l’avancer, en le justifiant.',
                      { format: DATE.format(new Date(due)) },
                    )
                  : $t('Le délai de trente jours est écoulé.'),
              })}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                {$t('Annuler')}
              </Button>
              <Button onClick={() => void exportNow()} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {$t('Exporter d’abord')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="min-w-0 space-y-3 text-sm">
            <p>
              {$t('Export écrit dans')}{' '}
              <span className="font-mono break-all">{exported.directory}</span> :{' '}
              {$tp(
                exported.total_rows,
                '{count} ligne, {size} en base.',
                '{count} lignes, {size} en base.',
                {
                  size: size(exported.total_bytes),
                },
              )}
            </p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {exported.tables.map((t) => (
                <li key={t.id}>
                  {t.label} — {$tp(t.rows, '{count} ligne', '{count} lignes')} ·{' '}
                  <span className="font-mono">{t.file}</span>
                </li>
              ))}
            </ul>
            {early && (
              <div className="space-y-1.5">
                <Label htmlFor="purge-justification">
                  {$t('Justification (avant trente jours, administrateur d’instance)')}
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
              what={$t('le libellé exact')}
            />
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                {$t('Annuler')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void purgeNow()}
                disabled={
                  busy || confirm !== target?.label || (early && justification.trim() === '')
                }
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {$t('Purger définitivement')}
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
            <DialogTitle>{$t('Tables supprimées — {label}', { label: base?.label })}</DialogTitle>
            <DialogDescription>
              {$t(
                'Une table supprimée garde ses lignes sous un nom marqué ; elle peut être purgée trente jours après, une fois exportée.',
              )}
            </DialogDescription>
          </DialogHeader>
          <ErrorLine error={error} />
          {tables === null ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
            </div>
          ) : tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">{$t('Aucune table supprimée.')}</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {tables.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{t.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {$t('supprimée le {format}{value} ·', {
                        format: DATE.format(new Date(t.deleted_at)),
                        value: t.deleted_by !== null && ` par ${t.deleted_by}`,
                      })}{' '}
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
                    {$t('Purger…')}
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
