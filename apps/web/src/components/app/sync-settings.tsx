'use client'

import { ArrowLeft, ExternalLink, KeyRound, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  api,
  type DescribedBase,
  type InsightsItem,
  type SyncedTable,
  type SyncMode,
  type SyncPreview,
  type SyncSchedule,
  type SyncSettings,
  type SyncSourceColumn,
  type SyncSourceKind,
} from '@/lib/api/client'
import { $t, $tp, intlLocale } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'

/**
 * How a synced table is fed — chapter 19 §3.5: where from (a file, an agenda, the view of
 * another basedb, a question of insights — one table or several joined, in any database
 * Trino reaches), which columns, matched on which key, written how, and when.
 */

export interface SyncSourceOption {
  readonly kind: SyncSourceKind
  readonly label: string
  readonly hint: string
  readonly placeholder: string
}

export const SYNC_MODES: ReadonlyArray<{ value: SyncMode; label: string; hint: string }> = [
  {
    value: 'mirror',
    label: $t('Miroir'),
    hint: $t('Ajoute, met à jour, et supprime les lignes disparues de la source.'),
  },
  {
    value: 'upsert',
    label: $t('Mise à jour'),
    hint: $t('Ajoute et met à jour ; ne supprime jamais une ligne.'),
  },
  {
    value: 'insert',
    label: $t('Ajout seul'),
    hint: $t('N’ajoute que les clés nouvelles ; une ligne déjà là ne change plus.'),
  },
  {
    value: 'replace',
    label: $t('Remplacement'),
    hint: $t('Vide la table puis la recharge, à chaque passage.'),
  },
  {
    value: 'snapshot',
    label: $t('Historique'),
    hint: $t(
      'Ajoute toutes les lignes à chaque passage, datées : la table garde chaque état de la source.',
    ),
  },
]

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

export const DEFAULT_SETTINGS: SyncSettings = {
  mode: 'mirror',
  schedule: 'interval',
  interval_minutes: 60,
  daily_at: '06:00',
  time_zone: 'UTC',
  key_columns: [],
}

/** When a synced table runs, said in a few words. */
export function scheduleText(t: SyncSettings): string {
  if (t.schedule === 'manual') return $t('à la demande')
  if (t.schedule === 'daily') {
    return $t('chaque jour à {time} ({zone})', { time: t.daily_at ?? '', zone: t.time_zone })
  }
  return $tp(t.interval_minutes, 'toutes les {count} minute', 'toutes les {count} minutes', {
    count: t.interval_minutes,
  })
}

export function modeLabel(mode: SyncMode): string {
  return SYNC_MODES.find((m) => m.value === mode)?.label ?? mode
}

/** Mode, key, and when: what a synced table is told, at its creation or afterwards. */
function SettingsFields({
  value,
  onChange,
  columns,
}: {
  readonly value: SyncSettings
  readonly onChange: (next: SyncSettings) => void
  readonly columns: readonly SyncSourceColumn[]
}) {
  const set = (patch: Partial<SyncSettings>) => onChange({ ...value, ...patch })
  const keyed = value.mode !== 'replace' && value.mode !== 'snapshot'
  const zones = useMemo(() => {
    try {
      return (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
        'timeZone',
      )
    } catch {
      return undefined
    }
  }, [])
  const toggleKey = (key: string) =>
    set({
      key_columns: value.key_columns.includes(key)
        ? value.key_columns.filter((k) => k !== key)
        : [...value.key_columns, key].slice(0, 8),
    })
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{$t('Façon de synchroniser')}</Label>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {SYNC_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={value.mode === m.value}
              onClick={() => set({ mode: m.value })}
              className={cn(
                'rounded-lg border p-2 text-left text-sm hover:bg-accent/60',
                value.mode === m.value && 'border-primary bg-primary/5 ring-1 ring-primary',
              )}
            >
              <span className="block font-medium">{m.label}</span>
              <span className="block text-xs text-muted-foreground">{m.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {keyed && columns.length > 0 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <KeyRound className="size-3.5" />
            {$t('Clé de rapprochement')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {$t(
              'Les colonnes qui reconnaissent une ligne d’un passage à l’autre. Aucune : la colonne « id » de la source, sinon le rang de la ligne.',
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={value.key_columns.includes(c.key)}
                onClick={() => toggleKey(c.key)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent/60',
                  value.key_columns.includes(c.key) &&
                    'border-primary bg-primary/10 text-primary ring-1 ring-primary',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{$t('Quand')}</Label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Select
            value={value.schedule}
            onValueChange={(s) => set({ schedule: s as SyncSchedule })}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interval">{$t('À intervalle régulier')}</SelectItem>
              <SelectItem value="daily">{$t('Chaque jour')}</SelectItem>
              <SelectItem value="manual">{$t('À la demande seulement')}</SelectItem>
            </SelectContent>
          </Select>
          {value.schedule === 'interval' && (
            <>
              <span className="text-muted-foreground">{$t('toutes les')}</span>
              <Input
                type="number"
                min={15}
                max={1440}
                value={value.interval_minutes}
                onChange={(e) => set({ interval_minutes: Number(e.target.value) })}
                className="h-8 w-24"
                aria-label={$t('Intervalle en minutes')}
              />
              <span className="text-muted-foreground">{$t('minutes')}</span>
            </>
          )}
          {value.schedule === 'daily' && (
            <>
              <span className="text-muted-foreground">{$t('à')}</span>
              <Input
                type="time"
                value={value.daily_at ?? '06:00'}
                onChange={(e) => set({ daily_at: e.target.value })}
                className="h-8 w-28"
                aria-label={$t('Heure')}
              />
              {zones === undefined ? (
                <Input
                  value={value.time_zone}
                  onChange={(e) => set({ time_zone: e.target.value })}
                  className="h-8 w-48"
                  aria-label={$t('Fuseau horaire')}
                />
              ) : (
                <Select value={value.time_zone} onValueChange={(z) => set({ time_zone: z })}>
                  <SelectTrigger className="h-8 w-56" aria-label={$t('Fuseau horaire')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['UTC', ...zones.filter((z) => z !== 'UTC')].map((z) => (
                      <SelectItem key={z} value={z}>
                        {z}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** The saved questions of insights, by name — and the way to write a new one there. */
function QuestionPicker({
  value,
  onChange,
}: {
  readonly value: InsightsItem | null
  readonly onChange: (q: InsightsItem) => void
}) {
  const [text, setText] = useState('')
  const [found, setFound] = useState<readonly InsightsItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      api
        .insightsSearch(text, 'question')
        .then((items) => {
          if (!live) return
          setFound(items)
          setError(null)
        })
        .catch((e) => {
          if (live) setError(messageFor(e))
        })
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [text])
  const openEditor = async () => {
    const tab = window.open('', '_blank')
    try {
      const { url } = await api.insightsLink('/question/new')
      if (tab !== null) tab.location.href = url
    } catch (e) {
      tab?.close()
      setError(messageFor(e))
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={$t('Chercher une question…')}
            className="h-8 pl-8"
          />
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void openEditor()}>
          <ExternalLink className="size-3.5" />
          {$t('Composer dans insights')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {$t(
          'Composez la requête dans le constructeur d’insights — une table, des jointures entre plusieurs bases, des filtres, des regroupements — enregistrez-la, puis choisissez-la ici.',
        )}
      </p>
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
      {found === null && error === null && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      {found !== null && (
        <div className="max-h-52 divide-y overflow-y-auto rounded-lg border scroll-discret">
          {found.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">{$t('Aucune question.')}</p>
          )}
          {found.map((q) => (
            <button
              key={q.id}
              type="button"
              aria-pressed={value?.id === q.id}
              onClick={() => onChange(q)}
              className={cn(
                'block w-full px-3 py-1.5 text-left text-sm hover:bg-accent/60',
                value?.id === q.id && 'bg-primary/5 font-medium text-primary',
              )}
            >
              {q.name}
              {q.description !== null && q.description !== '' && (
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {q.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value.toLocaleString(intlLocale())
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

/** A new synced table: its source, then what it keeps and how it follows it. */
export function SyncWizard({
  open,
  base,
  sources,
  onClose,
  onDone,
}: {
  readonly open: boolean
  readonly base: DescribedBase
  readonly sources: readonly SyncSourceOption[]
  readonly onClose: () => void
  readonly onDone: (created: SyncedTable) => void
}) {
  const [insights, setInsights] = useState(false)
  const [kind, setKind] = useState<SyncSourceKind>('csv')
  const [url, setUrl] = useState('')
  const [question, setQuestion] = useState<InsightsItem | null>(null)
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [label, setLabel] = useState('')
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set())
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SETTINGS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setKind('csv')
    setUrl('')
    setQuestion(null)
    setPreview(null)
    setLabel('')
    setKept(new Set())
    setSettings({ ...DEFAULT_SETTINGS, time_zone: browserZone() })
    setError(null)
    api
      .insightsStatus()
      .then((s) => setInsights(s.configured))
      .catch(() => setInsights(false))
  }, [open])

  const shown = sources.filter((s) => s.kind !== 'insights' || insights)
  const option = sources.find((s) => s.kind === kind)
  const source =
    kind === 'insights' ? { kind, question: question?.id ?? '' } : { kind, url: url.trim() }
  const ready = kind === 'insights' ? question !== null : url.trim() !== ''

  const read = async () => {
    setBusy(true)
    setError(null)
    try {
      const p = await api.previewSyncSource(base.name, source)
      setPreview(p)
      setKept(new Set(p.columns.map((c) => c.key)))
      if (label.trim() === '' && kind === 'insights' && question !== null) setLabel(question.name)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    if (preview === null) return
    setBusy(true)
    setError(null)
    try {
      const keys = settings.key_columns.filter((k) => kept.has(k))
      onDone(
        await api.createSyncedTable(base.name, {
          label: label.trim(),
          source,
          columns: preview.columns.filter((c) => kept.has(c.key)).map((c) => c.key),
          ...settings,
          key_columns: keys,
        }),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: string) =>
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const keptColumns = preview?.columns.filter((c) => kept.has(c.key)) ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scroll-discret">
        <DialogHeader>
          <DialogTitle>{$t('Nouvelle table synchronisée')}</DialogTitle>
          <DialogDescription>
            {preview === null
              ? $t('D’abord la source : basedb en lit les colonnes et les premières lignes.')
              : $t('Ce que la table garde de la source, et comment elle la suit.')}
          </DialogDescription>
        </DialogHeader>

        {preview === null ? (
          <div className="space-y-3">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {shown.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={kind === s.kind}
                  onClick={() => setKind(s.kind)}
                  className={cn(
                    'rounded-lg border p-2.5 text-left text-sm hover:bg-accent/60',
                    kind === s.kind && 'border-primary bg-primary/5 ring-1 ring-primary',
                  )}
                >
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </button>
              ))}
            </div>
            {kind === 'insights' ? (
              <QuestionPicker value={question} onChange={setQuestion} />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="sync-url">{$t('Adresse de la source')}</Label>
                <Input
                  id="sync-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={option?.placeholder}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sync-label">{$t('Nom de la table')}</Label>
              <Input
                id="sync-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={$t('Stock')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{$t('Colonnes gardées')}</Label>
              <p className="text-xs text-muted-foreground">
                {$tp(
                  preview.total,
                  '{count} ligne dans la source aujourd’hui — aperçu des premières.',
                  '{count} lignes dans la source aujourd’hui — aperçu des premières.',
                  { count: preview.total.toLocaleString(intlLocale()) },
                )}
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border scroll-discret">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {preview.columns.map((c) => (
                        <th
                          key={c.key}
                          className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                        >
                          <span className="flex items-center gap-1.5">
                            <Checkbox
                              checked={kept.has(c.key)}
                              onCheckedChange={() => toggle(c.key)}
                              aria-label={c.label}
                            />
                            {c.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 8).map((r) => (
                      <tr key={r.key} className="border-t">
                        {preview.columns.map((c) => (
                          <td
                            key={c.key}
                            className={cn(
                              'max-w-48 truncate px-2 py-1',
                              !kept.has(c.key) && 'text-muted-foreground/50 line-through',
                            )}
                          >
                            {formatCell(r.values[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <SettingsFields value={settings} onChange={setSettings} columns={keptColumns} />
          </div>
        )}

        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {preview !== null && (
            <Button
              variant="ghost"
              className="mr-auto gap-1.5"
              onClick={() => setPreview(null)}
              disabled={busy}
            >
              <ArrowLeft className="size-4" />
              {$t('Source')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          {preview === null ? (
            <Button onClick={() => void read()} disabled={busy || !ready}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? $t('Lecture de la source…') : $t('Lire la source')}
            </Button>
          ) : (
            <Button
              onClick={() => void create()}
              disabled={busy || label.trim() === '' || kept.size === 0}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? $t('Création…') : $t('Créer la table')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The settings of a synced table already there. */
export function SyncSettingsDialog({
  base,
  table,
  onClose,
  onSaved,
}: {
  readonly base: DescribedBase
  readonly table: SyncedTable | null
  readonly onClose: () => void
  readonly onSaved: (saved: SyncedTable) => void
}) {
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SETTINGS)
  const [parameters, setParameters] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (table === null) return
    setSettings({
      mode: table.mode,
      schedule: table.schedule,
      interval_minutes: table.interval_minutes,
      daily_at: table.daily_at ?? '06:00',
      time_zone: table.time_zone,
      key_columns: table.key_columns,
    })
    setParameters(
      Object.keys(table.parameters).length === 0 ? '' : JSON.stringify(table.parameters, null, 2),
    )
    setError(null)
  }, [table])
  const save = async () => {
    if (table === null) return
    let parsed: Record<string, unknown> | undefined
    if (table.source_kind === 'insights') {
      try {
        parsed = parameters.trim() === '' ? {} : (JSON.parse(parameters) as Record<string, unknown>)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error()
      } catch {
        setError($t('Les valeurs des variables s’écrivent en JSON : {"region": "Ouest"}.'))
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      onSaved(
        await api.updateSyncedTable(base.name, table.table, {
          ...settings,
          ...(parsed === undefined ? {} : { parameters: parsed }),
        }),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={table !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scroll-discret">
        <DialogHeader>
          <DialogTitle>{$t('Réglages de « {label} »', { label: table?.label ?? '' })}</DialogTitle>
          <DialogDescription>
            {table?.question !== null && table?.question !== undefined
              ? $t('Source : la question « {name} » d’insights.', { name: table.question.name })
              : $t('Source : {host}.', { host: table?.host ?? '' })}
          </DialogDescription>
        </DialogHeader>
        {table !== null && (
          <div className="space-y-4">
            <SettingsFields value={settings} onChange={setSettings} columns={table.columns} />
            {table.source_kind === 'insights' && (
              <div className="space-y-1.5">
                <Label htmlFor="sync-parameters">
                  {$t('Valeurs des variables de la question')}
                </Label>
                <Textarea
                  id="sync-parameters"
                  value={parameters}
                  onChange={(e) => setParameters(e.target.value)}
                  placeholder={'{"region": "Ouest"}'}
                  className="min-h-20 font-mono text-xs"
                />
              </div>
            )}
          </div>
        )}
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {$t('Enregistrer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
