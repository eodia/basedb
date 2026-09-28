'use client'

import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import { Input } from '@/components/ui/input'
import type { Field } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { PRESET_COLORS } from '@/lib/options'
import { cn } from '@/lib/utils'
import type { FormQuestion } from '@/lib/views'
import {
  FORM_THEMES,
  type FormAlign,
  type FormCondition,
  type FormConditionOp,
  type FormFont,
  type FormTheme,
  conditionNeedsValue,
} from '@basedb/contracts'
import { AlignCenter, AlignLeft, Check, GitBranch, Palette, X } from 'lucide-react'
import { type AnswerWidget, widgetOf } from './answers'
import { FONTS, type FormLook, THEMES, lookStyle } from './theme'

/**
 * The pieces of a form's editor (views/view-dialog.tsx): its look, chosen by seeing it,
 * and the condition that asks a question only when an earlier answer says so. Every
 * choice starts on a default that reads well — the table's colour, a light theme, the
 * theme's type —, so none has to be made.
 */

/** Eight looks, each shown as it is: its background, its type, its accent. */
export function ThemeGallery({
  look,
  tableColor,
  onChange,
}: {
  readonly look: FormLook
  readonly tableColor: string | null | undefined
  readonly onChange: (theme: FormTheme) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={$t('Thème')}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {FORM_THEMES.map((id) => {
        const { style } = lookStyle({ ...look, theme: id, font: 'auto' }, tableColor)
        const on = look.theme === id
        return (
          <button
            key={id}
            type="button"
            // biome-ignore lint/a11y/useSemanticElements: swatches drawn as what they choose, the ARIA radio pattern
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cn(
              'group overflow-hidden rounded-lg border text-left transition-shadow',
              on ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:shadow-md',
            )}
          >
            <span className="relative block h-16 px-2.5 pt-2" style={style}>
              <span className="block text-base leading-none font-semibold">Aa</span>
              <span className="mt-1.5 block h-1 w-12 rounded-full bg-(--fm-muted) opacity-40" />
              <span className="absolute right-2 bottom-2 h-3.5 w-8 rounded-[calc(var(--fm-radius)*0.5)] bg-(--fm-accent)" />
            </span>
            <span className="flex items-center justify-between gap-1 border-t bg-background px-2 py-1 text-xs">
              {THEMES[id].label}
              {on && <Check className="size-3.5 text-primary" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** The accent: the table's own colour by default, a few that go well, or any other. */
export function AccentPicker({
  accent,
  tableColor,
  theme,
  onChange,
}: {
  readonly accent: string
  readonly tableColor: string | null | undefined
  readonly theme: FormTheme
  readonly onChange: (accent: string) => void
}) {
  const auto = tableColor ?? THEMES[theme].accent
  const swatch = (color: string, on: boolean, label: string, value: string) => (
    <button
      key={value === '' ? 'auto' : value}
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={() => onChange(value)}
      className={cn(
        'flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110',
        on && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
      style={{ background: color }}
    >
      {on && <Check className="size-3.5 text-white mix-blend-difference" />}
    </button>
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 flex items-center gap-2 text-xs text-muted-foreground">
        {swatch(
          auto,
          accent === '',
          tableColor != null ? $t('Couleur de la table') : $t('Couleur du thème'),
          '',
        )}
        {tableColor != null ? $t('Couleur de la table') : $t('Couleur du thème')}
      </span>
      {PRESET_COLORS.map((c) => swatch(c, accent === c, c, c))}
      <label
        className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border bg-background hover:bg-accent"
        aria-label={$t('Autre couleur')}
      >
        <Palette className="size-3.5 text-muted-foreground" />
        <input
          type="color"
          value={accent === '' ? auto : accent}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

/** The type, each written in itself. */
export function FontPicker({
  font,
  theme,
  onChange,
}: {
  readonly font: FormFont
  readonly theme: FormTheme
  readonly onChange: (font: FormFont) => void
}) {
  const choices: ReadonlyArray<{ value: FormFont; label: string; stack: string }> = [
    {
      value: 'auto',
      label: $t('Celle du thème'),
      stack: FONTS[THEMES[theme].font].stack,
    },
    ...(['sans', 'serif', 'rounded', 'mono'] as const).map((f) => ({
      value: f,
      label: FONTS[f].label,
      stack: FONTS[f].stack,
    })),
  ]
  return (
    <div role="radiogroup" aria-label={$t('Police')} className="flex flex-wrap gap-1.5">
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          // biome-ignore lint/a11y/useSemanticElements: swatches drawn as what they choose, the ARIA radio pattern
          role="radio"
          aria-checked={font === c.value}
          onClick={() => onChange(c.value)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-sm transition-colors',
            font === c.value ? 'border-primary bg-primary/10 text-foreground' : 'hover:bg-accent',
          )}
          style={{ fontFamily: c.stack }}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

export function AlignPicker({
  align,
  onChange,
}: {
  readonly align: FormAlign
  readonly onChange: (align: FormAlign) => void
}) {
  const choices = [
    { value: 'left' as const, label: $t('À gauche'), Icon: AlignLeft },
    { value: 'center' as const, label: $t('Centré'), Icon: AlignCenter },
  ]
  return (
    <div role="radiogroup" aria-label={$t('Alignement')} className="flex gap-1.5">
      {choices.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          // biome-ignore lint/a11y/useSemanticElements: swatches drawn as what they choose, the ARIA radio pattern
          role="radio"
          aria-checked={align === value}
          onClick={() => onChange(value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors',
            align === value ? 'border-primary bg-primary/10' : 'hover:bg-accent',
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

// ── « Show only if… » ────────────────────────────────────────────────────────────────

const OP_LABELS: Readonly<Record<FormConditionOp, string>> = {
  is: $t('est'),
  is_not: $t('n’est pas'),
  includes: $t('contient'),
  excludes: $t('ne contient pas'),
  gte: $t('vaut au moins'),
  lte: $t('vaut au plus'),
  answered: $t('a une réponse'),
  empty: $t('est sans réponse'),
}

/** The comparisons that mean something for an answer of this sort. */
function opsFor(widget: AnswerWidget): FormConditionOp[] {
  switch (widget) {
    case 'choice':
      return ['is', 'is_not', 'answered', 'empty']
    case 'choices':
      return ['includes', 'excludes', 'answered', 'empty']
    case 'boolean':
      return ['is']
    case 'number':
    case 'rating':
      return ['gte', 'lte', 'is', 'answered', 'empty']
    default:
      return ['is', 'is_not', 'answered', 'empty']
  }
}

/** The value a condition starts with once its question is picked — the likeliest. */
function firstValue(field: Field, op: FormConditionOp): FormCondition['value'] {
  if (!conditionNeedsValue(op)) return null
  const widget = widgetOf(field)
  if (widget === 'boolean') return true
  if (widget === 'choice' || widget === 'choices') return field.options?.[0]?.value ?? null
  if (widget === 'rating') return Math.ceil((field.format?.rating_max ?? 5) / 2) + 1
  if (widget === 'number') return 1
  return null
}

/**
 * The condition of one question: shown only if an EARLIER question's answer says so. A
 * question with nothing before it has nothing to depend on, and says so by not offering it.
 */
export function ConditionEditor({
  condition,
  earlier,
  onChange,
}: {
  readonly condition: FormCondition | null
  /** The questions asked before this one, in order. */
  readonly earlier: ReadonlyArray<{ readonly question: FormQuestion; readonly field: Field }>
  readonly onChange: (next: FormCondition | null) => void
}) {
  if (earlier.length === 0) return null
  if (condition === null) {
    const first = earlier[earlier.length - 1] as (typeof earlier)[number]
    const op = opsFor(widgetOf(first.field))[0] as FormConditionOp
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 justify-start px-2 text-xs text-muted-foreground"
        onClick={() =>
          onChange({ field: first.field.name, op, value: firstValue(first.field, op) })
        }
      >
        <GitBranch className="size-3.5" />
        {$t('Poser seulement si…')}
      </Button>
    )
  }
  const read = earlier.find((e) => e.field.name === condition.field)
  if (read === undefined) return null
  const widget = widgetOf(read.field)
  const ops = opsFor(widget)
  const setField = (name: string) => {
    const e = earlier.find((x) => x.field.name === name)
    if (e === undefined) return
    const op = opsFor(widgetOf(e.field))[0] as FormConditionOp
    onChange({ field: name, op, value: firstValue(e.field, op) })
  }
  const setOp = (op: FormConditionOp) =>
    onChange({
      ...condition,
      op,
      value: conditionNeedsValue(op) ? (condition.value ?? firstValue(read.field, op)) : null,
    })
  const value = (() => {
    if (!conditionNeedsValue(condition.op)) return null
    if (widget === 'boolean') {
      return (
        <Choice
          size="xs"
          value={condition.value === false ? 'false' : 'true'}
          onValueChange={(v) => onChange({ ...condition, value: v === 'true' })}
          options={[
            { value: 'true', label: $t('Oui') },
            { value: 'false', label: $t('Non') },
          ]}
          aria-label={$t('Valeur')}
          className="w-24"
        />
      )
    }
    if (widget === 'choice' || widget === 'choices') {
      return (
        <Choice
          size="xs"
          value={typeof condition.value === 'string' ? condition.value : ''}
          onValueChange={(v) => onChange({ ...condition, value: v })}
          options={(read.field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
          aria-label={$t('Valeur')}
          className="w-40"
        />
      )
    }
    const numeric = widget === 'number' || widget === 'rating'
    return (
      <Input
        value={condition.value === null ? '' : String(condition.value)}
        inputMode={numeric ? 'decimal' : undefined}
        onChange={(e) => {
          const t = e.target.value
          const n = Number(t.replace(',', '.'))
          onChange({
            ...condition,
            value: numeric ? (t.trim() === '' || !Number.isFinite(n) ? null : n) : t,
          })
        }}
        placeholder={numeric ? '3' : $t('Valeur')}
        aria-label={$t('Valeur')}
        className="h-7 w-32 text-xs"
      />
    )
  })()
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1.5 text-xs">
      <GitBranch className="size-3.5 text-primary" />
      <span className="text-muted-foreground">{$t('Seulement si')}</span>
      <Choice
        size="xs"
        value={condition.field}
        onValueChange={setField}
        options={earlier.map((e) => ({
          value: e.field.name,
          label: e.question.label.trim() === '' ? e.field.label : e.question.label,
        }))}
        aria-label={$t('Question lue')}
        className="max-w-44"
      />
      <Choice
        size="xs"
        value={condition.op}
        onValueChange={(v) => setOp(v as FormConditionOp)}
        options={ops.map((op) => ({ value: op, label: OP_LABELS[op] }))}
        aria-label={$t('Comparaison')}
        className="w-36"
      />
      {value}
      <Button
        variant="ghost"
        size="icon-sm"
        className="ml-auto size-6"
        onClick={() => onChange(null)}
        aria-label={$t('Retirer la condition')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

/**
 * A condition can only read an earlier question: after a reorder or an untick, the ones
 * that no longer do are dropped rather than left for the server to refuse.
 */
export function keepConditions(questions: readonly FormQuestion[]): FormQuestion[] {
  const seen = new Set<string>()
  return questions.map((q) => {
    const kept = q.show_if !== null && seen.has(q.show_if.field) ? q.show_if : null
    seen.add(q.field)
    return kept === q.show_if ? q : { ...q, show_if: kept }
  })
}
