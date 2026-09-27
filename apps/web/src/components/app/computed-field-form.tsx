'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Badge } from '@/components/ui/badge'
import { Choice } from '@/components/ui/choice'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import type { Field, RollupInput, Table } from '@/lib/api/client'
import { AGGREGATE_NAMES, effectiveKind } from '@/lib/computed'
import { $t, locale } from '@/lib/i18n'
import { useRef } from 'react'

/**
 * The settings of a computed field, in the « Nouveau champ » dialog — chapter 04 §7 and
 * §7 ter: the expression of a formula, the path of a lookup, a rollup or a count.
 */

/**
 * The language formulas are written in: French on a French screen, English on any other —
 * the language the server renders them back in. Both are read on every screen.
 */
const FRENCH = locale() === 'fr'

/** The functions of the language, with how each is written — the dialog's reminder. */
const FUNCTIONS: ReadonlyArray<readonly [french: string, english: string, meaning: string]> = [
  ['SI(condition; alors; sinon)', 'IF(condition, then, else)', $t('une valeur ou une autre')],
  ['SIVIDE(valeur; sinon)', 'IFBLANK(value, fallback)', $t('une valeur de repli')],
  ['ESTVIDE(valeur)', 'ISBLANK(value)', $t('vrai si vide')],
  ['ARRONDI(nombre; décimales)', 'ROUND(number, decimals)', $t('un nombre arrondi')],
  ['ABS · PLAFOND · PLANCHER', 'ABS · CEILING · FLOOR', $t('sur un nombre')],
  ['MIN(a; b) · MAX(a; b)', 'MIN(a, b) · MAX(a, b)', $t('nombres ou dates')],
  ['MAJUSCULE · MINUSCULE · SANSESPACES', 'UPPER · LOWER · TRIM', $t('sur un texte')],
  ['GAUCHE(texte; n) · DROITE(texte; n)', 'LEFT(text, n) · RIGHT(text, n)', $t('début ou fin')],
  ['LONGUEUR(texte)', 'LEN(text)', $t('nombre de caractères')],
  [
    'TEXTE(nombre) · NOMBRE(texte)',
    'TEXT(number) · VALUE(text)',
    $t('d’un nombre en texte, et l’inverse'),
  ],
  ['ANNEE · MOIS · JOUR · JOURSEMAINE', 'YEAR · MONTH · DAY · WEEKDAY', $t('parties d’une date')],
  ['JOURS(fin; début)', 'DAYS(end, start)', $t('jours entre deux dates')],
  ['AJOUTER_JOURS(date; n)', 'ADD_DAYS(date, n)', $t('une date déplacée')],
  ['DATE(année; mois; jour)', 'DATE(year, month, day)', $t('une date')],
  ['AUJOURDHUI() · MAINTENANT()', 'TODAY() · NOW()', $t('calculée à chaque lecture')],
]

/** The types a formula can cite: one value per row — never a relation or a list. */
const CITABLE = new Set([
  'short_text',
  'long_text',
  'url',
  'email',
  'select',
  'number',
  'autonumber',
  'boolean',
  'date',
  'datetime',
])

function citable(field: Field): boolean {
  if (field.system === true) return false
  if (field.kind === 'formula') return false
  if (field.computed !== undefined) return !field.computed.multiple
  return CITABLE.has(field.kind)
}

/**
 * The expression of a formula, with the fields to insert and a reminder of the functions.
 * A field is cited by its label between brackets; a click on a chip inserts it where the
 * cursor stands.
 */
export function FormulaEditor({
  value,
  onChange,
  fields,
  disabled,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly fields: readonly Field[]
  readonly disabled?: boolean
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  const insert = (text: string) => {
    const el = box.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    onChange(`${value.slice(0, start)}${text}${value.slice(end)}`)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    })
  }
  const shown = fields.filter(citable)
  return (
    <div className="space-y-2">
      <label htmlFor="field-formula" className="text-sm text-muted-foreground">
        {$t('Formule')}
      </label>
      <Textarea
        id="field-formula"
        ref={box}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="[Montant] * 1.2"
        className="min-h-20 font-mono text-sm"
        spellCheck={false}
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-1">
        {shown.map((f) => (
          <Hint key={f.name} label={$t('Insérer [{label}]', { label: f.label })}>
            <button
              type="button"
              onClick={() => insert(`[${f.label.replace(/]/g, ']]')}]`)}
              disabled={disabled}
              aria-label={$t('Insérer [{label}]', { label: f.label })}
            >
              <Badge variant="secondary" className="gap-1 font-normal hover:bg-secondary/70">
                <FieldIcon kind={f.kind} format={f.format?.display} className="size-3" />
                {f.label}
              </Badge>
            </button>
          </Hint>
        ))}
      </div>
      <details className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none text-sm">{$t('Fonctions')}</summary>
        <ul className="mt-2 space-y-1">
          {FUNCTIONS.map(([french, english, meaning]) => (
            <li key={french}>
              <code className="text-foreground">{FRENCH ? french : english}</code> — {meaning}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          {$t('Opérateurs :')} <code>+ - * /</code>, <code>&amp;</code>{' '}
          {$t('pour joindre des textes,')} <code>= &lt;&gt; &lt; &lt;= &gt; &gt;=</code>,{' '}
          <code>{FRENCH ? 'ET' : 'AND'}</code>, <code>{FRENCH ? 'OU' : 'OR'}</code>,{' '}
          <code>{FRENCH ? 'NON' : 'NOT'}</code>
          {$t('. Le séparateur d’arguments est')} <code>{FRENCH ? ';' : ','}</code>
          {$t(', le décimal est le point.')}
        </p>
      </details>
      <p className="text-xs text-muted-foreground">
        {$t(
          'Une formule est enregistrée dans la table tant qu’elle ne dépend que de la ligne. Avec {today}, {now} ou un champ lu à travers une relation, elle est calculée à chaque lecture : elle se filtre et se trie, mais n’existe pas en SQL direct.',
          {
            today: FRENCH ? 'AUJOURDHUI()' : 'TODAY()',
            now: FRENCH ? 'MAINTENANT()' : 'NOW()',
          },
        )}
      </p>
    </div>
  )
}

/** A relation that can be followed from a table: its own, or another table's aiming here. */
export interface Path {
  readonly key: string
  readonly label: string
  readonly reached: Table
  readonly input: Pick<RollupInput, 'via' | 'via_table'>
  /** A single row is reached: a lookup then reads one value. */
  readonly single: boolean
}

/** Every path a lookup, a rollup or a count of `table` may follow. */
export function pathsOf(table: Table, tables: readonly Table[]): Path[] {
  const paths: Path[] = []
  for (const f of table.fields) {
    if ((f.kind !== 'link' && f.kind !== 'multi_link') || f.link?.target === undefined) continue
    const reached = tables.find((t) => t.name === f.link?.target)
    if (reached === undefined) continue
    paths.push({
      key: `out:${f.name}`,
      label: `${f.label} → ${reached.label}`,
      reached,
      input: { via: f.name },
      single: f.kind === 'link',
    })
  }
  for (const other of tables) {
    for (const f of other.fields) {
      if ((f.kind !== 'link' && f.kind !== 'multi_link') || f.link?.target !== table.name) continue
      paths.push({
        key: `in:${other.name}:${f.name}`,
        label: $t('{label} liées par « {label2} »', { label: other.label, label2: f.label }),
        reached: other,
        input: { via: f.name, via_table: other.name },
        single: false,
      })
    }
  }
  return paths
}

export interface RollupDraft {
  readonly path: string
  readonly target: string
  readonly aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max' | ''
}

export const emptyRollup = (): RollupDraft => ({ path: '', target: '', aggregate: '' })

/** What a lookup or a rollup may read on the rows reached: one value per row, stored. */
function readable(field: Field): boolean {
  if (field.system === true) return false
  if (field.computed !== undefined) return field.kind === 'formula' && field.computed.stored
  return CITABLE.has(field.kind) || field.kind === 'user'
}

/** The aggregations a value of this kind allows. */
function aggregatesFor(kind: string): Array<'count' | 'sum' | 'avg' | 'min' | 'max'> {
  if (kind === 'number' || kind === 'autonumber') return ['sum', 'avg', 'min', 'max', 'count']
  if (kind === 'date' || kind === 'datetime') return ['min', 'max', 'count']
  return ['count']
}

export function rollupReady(kind: string, draft: RollupDraft): boolean {
  if (draft.path === '') return false
  if (kind === 'count') return true
  if (draft.target === '') return false
  return kind !== 'rollup' || draft.aggregate !== ''
}

export function rollupInputOf(
  kind: string,
  draft: RollupDraft,
  paths: readonly Path[],
): RollupInput | undefined {
  const path = paths.find((p) => p.key === draft.path)
  if (path === undefined) return undefined
  return {
    ...path.input,
    ...(kind === 'count' ? {} : { target: draft.target }),
    ...(kind === 'rollup' && draft.aggregate !== '' ? { aggregate: draft.aggregate } : {}),
  }
}

/** The path of a lookup, a rollup or a count, and what it reads. */
export function RollupForm({
  kind,
  paths,
  value,
  onChange,
  disabled,
}: {
  readonly kind: 'lookup' | 'rollup' | 'count'
  readonly paths: readonly Path[]
  readonly value: RollupDraft
  readonly onChange: (next: RollupDraft) => void
  readonly disabled?: boolean
}) {
  const path = paths.find((p) => p.key === value.path)
  const targets = path?.reached.fields.filter(readable) ?? []
  const target = targets.find((f) => f.name === value.target)
  const aggregates = target === undefined ? [] : aggregatesFor(effectiveKind(target))

  if (paths.length === 0) {
    return (
      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        {$t(
          'Aucune relation ne part de cette table ni n’y arrive : ajoutez d’abord un champ relation.',
        )}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="rollup-path" className="text-sm text-muted-foreground">
          {$t('Relation suivie')}
        </label>
        <Choice
          id="rollup-path"
          value={value.path === '' ? null : value.path}
          onValueChange={(next) => onChange({ path: next, target: '', aggregate: '' })}
          options={paths.map((p) => ({ value: p.key, label: p.label }))}
          placeholder={$t('Choisir une relation')}
          aria-label={$t('Relation suivie')}
          disabled={disabled}
          size="default"
        />
      </div>

      {kind !== 'count' && path !== undefined && (
        <div className="space-y-1.5">
          <label htmlFor="rollup-target" className="text-sm text-muted-foreground">
            {$t('Champ lu dans « {label} »', { label: path.reached.label })}
          </label>
          <Choice
            id="rollup-target"
            value={value.target === '' ? null : value.target}
            onValueChange={(next) => onChange({ ...value, target: next, aggregate: '' })}
            options={targets.map((f) => ({
              value: f.name,
              label: f.label,
              render: (
                <span className="flex items-center gap-2">
                  <FieldIcon kind={f.kind} format={f.format?.display} />
                  {f.label}
                </span>
              ),
            }))}
            placeholder={$t('Choisir un champ')}
            aria-label={$t('Champ lu')}
            disabled={disabled}
            size="default"
          />
        </div>
      )}

      {kind === 'rollup' && target !== undefined && (
        <div className="space-y-1.5">
          <label htmlFor="rollup-aggregate" className="text-sm text-muted-foreground">
            {$t('Calcul')}
          </label>
          <Select
            value={value.aggregate}
            onValueChange={(next) =>
              onChange({ ...value, aggregate: next as RollupDraft['aggregate'] })
            }
            disabled={disabled}
          >
            <SelectTrigger id="rollup-aggregate">
              <SelectValue placeholder={$t('Choisir un calcul')} />
            </SelectTrigger>
            <SelectContent>
              {aggregates.map((a) => (
                <SelectItem key={a} value={a}>
                  {AGGREGATE_NAMES[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {path !== undefined && (
        <p className="text-xs text-muted-foreground">
          {$t(
            '{value} Seules comptent les lignes que chaque lecteur peut voir ; un lecteur qui ne voit pas « {label} » ne voit pas ce champ.',
            {
              value:
                kind === 'lookup'
                  ? path.single
                    ? $t('La valeur du champ sur la ligne liée.')
                    : $t('La liste des valeurs, une par ligne liée, dans leur ordre.')
                  : kind === 'rollup'
                    ? $t('Un calcul sur toutes les lignes liées.')
                    : $t('Le nombre de lignes liées.'),
              label: path.reached.label,
            },
          )}
        </p>
      )}
    </div>
  )
}
