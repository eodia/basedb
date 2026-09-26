'use client'

import { EnvironmentBadge } from '@/components/app/environment-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  type ApplyReport,
  type EnvironmentFamily,
  type EnvironmentSummary,
  api,
} from '@/lib/api/client'
import { messageFor } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { Layers, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

/**
 * The environments of a base, in its form — chapter 14.
 *
 * Production is the base as it was created; every other environment is a copy of the
 * STRUCTURE of one of them — its tables, its fields, its choices and its relations, not
 * its rows —, in a schema of its own. Renaming one renames its badge; deleting one
 * deletes it the way a base is deleted: its tables are relegated, not destroyed.
 */

const EXPLANATION =
  'Chaque environnement a son propre schéma, ses tables et ses lignes. Un nouvel environnement reçoit une copie de la structure — sans les lignes, qui se synchronisent ensuite depuis « Comparer les environnements ».'

/** What the copy of a structure did, said in one line — and its failures, if any. */
export function reportLine(report: ApplyReport): string {
  const parts = [
    `${report.applied} étape${report.applied > 1 ? 's' : ''} appliquée${report.applied > 1 ? 's' : ''}`,
  ]
  if (report.skipped > 0) parts.push(`${report.skipped} ignorée${report.skipped > 1 ? 's' : ''}`)
  if (report.failed > 0) parts.push(`${report.failed} en échec`)
  return parts.join(' · ')
}

function EnvironmentRow({
  base,
  env,
  onChanged,
  disabled,
}: {
  readonly base: string
  readonly env: EnvironmentSummary
  readonly onChanged: () => void
  readonly disabled: boolean
}) {
  const [label, setLabel] = useState(env.environment)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setLabel(env.environment), [env.environment])

  const rename = async () => {
    const next = label.trim()
    if (next === '' || next === env.environment || busy) {
      setLabel(env.environment)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.renameEnvironment(base, env.name, next)
      onChanged()
    } catch (e) {
      setError(messageFor(e))
      setLabel(env.environment)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const migration = await api.deleteEnvironment(base, env.name)
      if (migration.status !== 'applied') {
        setError(`La suppression s’est arrêtée à l’étape « ${migration.step_label ?? '?'} ».`)
        return
      }
      onChanged()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <li className="space-y-1.5 py-2">
      <div className="flex items-center gap-2">
        <EnvironmentBadge
          environment={{
            label: label.trim() || env.environment,
            production: env.production,
            position: env.position,
          }}
          className="w-24 justify-center"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => void rename()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void rename()
            }
            if (e.key === 'Escape') setLabel(env.environment)
          }}
          maxLength={60}
          disabled={disabled || busy}
          aria-label={`Nom de l’environnement ${env.environment}`}
          className="h-8"
        />
        {env.production ? (
          <span
            className="w-8 shrink-0 text-center text-[0.7rem] text-muted-foreground"
            title="L’environnement par défaut"
          >
            défaut
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirming(true)}
            disabled={disabled || busy}
            aria-label={`Supprimer l’environnement ${env.environment}`}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        )}
      </div>
      <p className="pl-26 text-xs text-muted-foreground">
        <span className="font-mono">{env.name}</span> · {env.tableCount} table
        {env.tableCount > 1 ? 's' : ''}
      </p>
      {confirming && (
        <div className="ml-26 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs">
          <span className="min-w-0 flex-1">
            Supprimer « {env.environment} » ? Ses tables sont reléguées, pas détruites : la base
            reste restaurable.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
            Annuler
          </Button>
          <Button variant="destructive" size="sm" onClick={() => void remove()} disabled={busy}>
            Supprimer
          </Button>
        </div>
      )}
      {error !== null && <p className="pl-26 text-xs text-destructive">{error}</p>}
    </li>
  )
}

/** The environments of an existing base: rename, add from a copy, delete. */
export function EnvironmentsEditor({
  base,
  onChanged,
  disabled = false,
}: {
  /** Any environment of the base, by name. */
  readonly base: string
  readonly onChanged: () => void
  readonly disabled?: boolean
}) {
  const [family, setFamily] = useState<EnvironmentFamily | null>(null)
  const [adding, setAdding] = useState('')
  const [source, setSource] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<{ label: string; report: ApplyReport } | null>(null)

  const load = useCallback(async () => {
    try {
      setFamily(await api.environments(base))
    } catch (e) {
      setError(messageFor(e))
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load])

  const changed = () => {
    void load()
    onChanged()
  }

  const add = async () => {
    const label = adding.trim()
    if (label === '' || busy) return
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      const created = await api.createEnvironment(base, label, source === '' ? undefined : source)
      setReport({ label, report: created.report })
      setAdding('')
      changed()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  const environments = family?.environments ?? []

  return (
    <Card>
      <CardHeader>
        <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            Environnements
            {environments.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground tabular-nums">
                {environments.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>{EXPLANATION}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="py-1">
        {family === null && error === null ? (
          <div className="flex h-10 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="divide-y">
            {environments.map((env) => (
              <EnvironmentRow
                key={env.id}
                base={base}
                env={env}
                onChanged={changed}
                disabled={disabled || busy}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <div className="space-y-2 rounded-b-xl border-t bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void add()
              }
            }}
            placeholder="Ex. Recette"
            maxLength={60}
            disabled={disabled || busy || family === null}
            aria-label="Nom du nouvel environnement"
            className="h-8"
          />
          {environments.length > 1 && (
            <Select
              value={source === '' ? (environments[0]?.name ?? '') : source}
              onValueChange={setSource}
            >
              <SelectTrigger
                className="h-8 w-52 shrink-0 whitespace-nowrap"
                aria-label="Copier la structure de"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environments.map((env) => (
                  <SelectItem key={env.id} value={env.name}>
                    Copie de {env.environment}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void add()}
            disabled={disabled || busy || adding.trim() === '' || family === null}
            className="shrink-0"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {busy ? 'Copie de la structure…' : 'Ajouter'}
          </Button>
        </div>

        {report !== null && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs',
              report.report.failed > 0
                ? 'border-destructive/30 bg-destructive/5'
                : 'border-emerald-500/30 bg-emerald-500/5',
            )}
          >
            <div className="min-w-0 flex-1">
              <p>
                « {report.label} » créé — {reportLine(report.report)}.
              </p>
              {report.report.results
                .filter((r) => r.outcome !== 'applied')
                .map((r) => (
                  <p key={r.id} className="text-muted-foreground">
                    {r.summary} : {r.note ?? r.code ?? r.outcome}
                  </p>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setReport(null)}
              aria-label="Fermer"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Card>
  )
}

/**
 * The environments of a base being created: production, always, and the others named
 * here — created, each as a copy of production, once the base exists.
 */
export function NewEnvironmentsField({
  value,
  onChange,
  disabled,
}: {
  readonly value: readonly string[]
  readonly onChange: (next: readonly string[]) => void
  readonly disabled: boolean
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const label = draft.trim()
    if (label === '') return
    const key = label.toLowerCase()
    if (key === 'production' || value.some((v) => v.toLowerCase() === key)) {
      setDraft('')
      return
    }
    onChange([...value, label])
    setDraft('')
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor="new-base-environment">Environnements</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <EnvironmentBadge environment={{ label: 'Production', production: true, position: 0 }} />
        {value.map((label, index) => (
          <span key={label} className="inline-flex items-center gap-0.5">
            <EnvironmentBadge environment={{ label, production: false, position: index + 1 }} />
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== label))}
              disabled={disabled}
              aria-label={`Retirer ${label}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id="new-base-environment"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Ex. Recette, Développement…"
          maxLength={60}
          disabled={disabled}
          className="h-8"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={add}
          disabled={disabled || draft.trim() === ''}
        >
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Facultatif. Production est l’environnement par défaut ; les autres en reçoivent une copie de
        la structure.
      </p>
    </div>
  )
}
