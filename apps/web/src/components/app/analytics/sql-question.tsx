'use client'

import { PeriodPicker } from '@/components/app/analytics/filter-editor'
import { SqlEditor } from '@/components/app/sql-editor'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { describeDate } from '@/lib/analytics/model'
import type { DescribedBase } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import {
  type Constraint,
  type SqlQuery,
  type SqlVariable,
  type SqlVariableType,
  sqlVariableNames,
} from '@basedb/contracts'
import { CalendarDays, Loader2, Play } from 'lucide-react'

/**
 * A SQL question — chapter 18 §3.3: one `SELECT`, run read only with the reader's rights,
 * its variables written `{{nom}}`, a part to drop when one has no value between `[[` and
 * `]]`. A variable is text, a number, a day, or a whole condition on a column — what lets a
 * dashboard's filter narrow a SQL question like any other.
 */

const TYPE_LABELS: Readonly<Record<SqlVariableType, string>> = {
  text: $t('Texte'),
  number: $t('Nombre'),
  date: $t('Date'),
  filter: $t('Filtre de colonne'),
}

/** The variables the text cites, each with its settings — kept, or new with defaults. */
export function variablesOf(query: SqlQuery): SqlVariable[] {
  const declared = new Map((query.variables ?? []).map((v) => [v.name, v]))
  return sqlVariableNames(query.sql).map(
    (name) => declared.get(name) ?? { name, label: name, type: 'text' },
  )
}

/** What trying values in the editor asks the kernel to apply. */
export function testConstraints(
  variables: readonly SqlVariable[],
  values: Readonly<Record<string, string>>,
): Constraint[] {
  const out: Constraint[] = []
  for (const v of variables) {
    const raw = (values[v.name] ?? '').trim()
    if (raw === '') continue
    const target = { variable: v.name }
    const kind = v.type === 'filter' ? (v.column_kind ?? 'text') : v.type
    if (kind === 'date' || kind === 'datetime') out.push({ target, type: 'date', value: raw })
    else if (kind === 'number')
      out.push({ target, type: 'number', value: [Number(raw.replace(',', '.'))] })
    else
      out.push({
        target,
        type: 'category',
        value: raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== ''),
      })
  }
  return out
}

function ValueInput({
  variable,
  value,
  onChange,
}: {
  readonly variable: SqlVariable
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  const kind = variable.type === 'filter' ? (variable.column_kind ?? 'text') : variable.type
  if (kind === 'date' || kind === 'datetime') {
    return (
      <Popover modal>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal">
            <CalendarDays className="size-3.5" />
            {value === '' ? variable.label : `${variable.label} : ${describeDate(value)}`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <PeriodPicker value={value} onChange={onChange} />
          {value !== '' && (
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange('')}>
              {$t('Effacer')}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    )
  }
  return (
    <Input
      type={kind === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={variable.label}
      aria-label={variable.label}
      className="h-8 w-44"
    />
  )
}

export function SqlQuestionEditor({
  base,
  query,
  onChange,
  onRun,
  running,
  error,
  values,
  onValues,
}: {
  readonly base: DescribedBase
  readonly query: SqlQuery
  readonly onChange: (query: SqlQuery) => void
  readonly onRun: () => void
  readonly running: boolean
  readonly error: { message: string; position: number | null } | null
  readonly values: Readonly<Record<string, string>>
  readonly onValues: (values: Record<string, string>) => void
}) {
  const variables = variablesOf(query)
  const setVariable = (name: string, patch: Partial<SqlVariable>) => {
    const next = variables.map((v) => {
      if (v.name !== name) return v
      const merged: Record<string, unknown> = { ...v, ...patch }
      for (const [k, x] of Object.entries(merged)) if (x === undefined) delete merged[k]
      return merged as unknown as SqlVariable
    })
    onChange({ ...query, variables: next })
  }

  return (
    <div className="flex min-h-0 flex-col border-b md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-56 min-h-0 overflow-hidden border-b md:h-64">
          <SqlEditor
            value={query.sql}
            base={base}
            placeholder="SELECT statut, count(*) FROM taches WHERE {{periode}} GROUP BY 1"
            onChange={(sql) =>
              onChange({
                ...query,
                sql,
                ...(variables.length === 0 ? {} : { variables: variablesOf({ ...query, sql }) }),
              })
            }
            onRun={() => onRun()}
            serverError={error}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {variables.map((v) => (
            <ValueInput
              key={v.name}
              variable={v}
              value={values[v.name] ?? ''}
              onChange={(value) => onValues({ ...values, [v.name]: value })}
            />
          ))}
          <div className="flex-1" />
          <Button size="sm" onClick={onRun} disabled={running || query.sql.trim() === ''}>
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {$t('Exécuter')}
          </Button>
        </div>
      </div>
      {variables.length > 0 && (
        <aside className="max-h-80 w-full shrink-0 space-y-3 overflow-y-auto border-t p-3 md:max-h-none md:w-72 md:border-t-0 md:border-l scroll-discret">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {$t('Variables')}
          </h3>
          {variables.map((v) => (
            <div key={v.name} className="space-y-2 rounded-lg border p-2.5 text-sm">
              <code className="text-xs text-muted-foreground">{`{{${v.name}}}`}</code>
              <Input
                value={v.label}
                onChange={(e) => setVariable(v.name, { label: e.target.value })}
                aria-label={$t('Libellé de la variable')}
                className="h-8"
              />
              <Choice
                value={v.type}
                onValueChange={(type) => setVariable(v.name, { type: type as SqlVariableType })}
                options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                aria-label={$t('Type de la variable')}
              />
              {v.type === 'filter' && (
                <>
                  <Input
                    value={v.column ?? ''}
                    onChange={(e) => setVariable(v.name, { column: e.target.value })}
                    placeholder="c.date_commande"
                    aria-label={$t('Colonne filtrée')}
                    className="h-8 font-mono text-xs"
                  />
                  <Choice
                    value={v.column_kind ?? 'text'}
                    onValueChange={(kind) =>
                      setVariable(v.name, { column_kind: kind as SqlVariable['column_kind'] })
                    }
                    options={[
                      { value: 'date', label: $t('Une date') },
                      { value: 'datetime', label: $t('Une date et heure') },
                      { value: 'number', label: $t('Un nombre') },
                      { value: 'text', label: $t('Un texte') },
                    ]}
                    aria-label={$t('Ce que contient la colonne')}
                  />
                  <p className="text-xs text-muted-foreground">
                    <code>{`{{${v.name}}}`}</code>{' '}
                    {$t('devient une condition sur cette colonne, ou')} <code>TRUE</code>{' '}
                    {$t('sans valeur.')}
                  </p>
                </>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{$t('Obligatoire')}</span>
                <Switch
                  aria-label={$t('Obligatoire')}
                  checked={v.required === true}
                  onCheckedChange={(on) => setVariable(v.name, { required: on || undefined })}
                />
              </div>
              <Input
                value={typeof v.default === 'string' ? v.default : ''}
                onChange={(e) =>
                  setVariable(v.name, {
                    default: e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder={$t('Valeur par défaut')}
                aria-label={$t('Valeur par défaut')}
                className="h-8"
              />
            </div>
          ))}
        </aside>
      )}
    </div>
  )
}
