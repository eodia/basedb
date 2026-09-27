'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Hint } from '@/components/ui/tooltip'
import type { Field } from '@/lib/api/client'
import { effectiveKind } from '@/lib/computed'
import { compileMatcher } from '@/lib/evaluate'
import { GROUPABLE_KINDS } from '@/lib/grid'
import { $t } from '@/lib/i18n'
import { PRESET_COLORS } from '@/lib/options'
import type { ColorRule, ColorStyle, RowHeight } from '@/lib/store/workspace'
import { cn } from '@/lib/utils'
import { Layers, Palette, Plus, Rows3, Search, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * The grid's own controls in the toolbar (chapter 11 §1.6): the quick search, the
 * grouping, the colours, the height of the rows. Each changes the overlay on screen; a
 * saved view keeps what was set when someone saves it — except the search, which is only
 * ever a search.
 */

/** Typed, then applied a moment after the last key: a request per keystroke is wasted. */
export function SearchBox({
  value,
  onChange,
}: {
  readonly value: string
  readonly onChange: (text: string) => void
}) {
  const [text, setText] = useState(value)
  const latest = useRef(onChange)
  latest.current = onChange
  // The value set from outside — a view switched, the search cleared elsewhere.
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (text === value) return
    const timer = setTimeout(() => latest.current(text), 300)
    return () => clearTimeout(timer)
  }, [text, value])

  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setText('')
            latest.current('')
          }
          if (e.key === 'Enter') latest.current(text)
        }}
        placeholder={$t('Rechercher…')}
        className={cn(
          'h-7 w-40 pr-6 pl-7 text-xs transition-[width] focus:w-56',
          text !== '' && 'w-56',
        )}
        aria-label={$t('Rechercher dans la table')}
      />
      {text !== '' && (
        <button
          type="button"
          onClick={() => {
            setText('')
            latest.current('')
          }}
          className="absolute right-1.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={$t('Effacer la recherche')}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

export function GroupMenu({
  fields,
  value,
  onChange,
}: {
  readonly fields: readonly Field[]
  readonly value: string | null
  readonly onChange: (field: string | null) => void
}) {
  // A computed field groups as its value: a total, a count — not a list.
  const groupable = fields.filter((f) => GROUPABLE_KINDS.includes(effectiveKind(f)))
  const current = fields.find((f) => f.name === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={current === undefined ? 'ghost' : 'secondary'}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
        >
          <Layers className="size-3.5" />
          {current === undefined
            ? $t('Grouper')
            : $t('Groupé par {label}', { label: current.label })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {$t('Regrouper les lignes selon')}
        </DropdownMenuLabel>
        {groupable.map((field) => (
          <DropdownMenuItem key={field.name} onSelect={() => onChange(field.name)}>
            <FieldIcon kind={field.kind} format={field.format?.display} />
            <span className="flex-1 truncate">{field.label}</span>
          </DropdownMenuItem>
        ))}
        {current !== undefined && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>
              {$t('Ne pas grouper')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const HEIGHTS: ReadonlyArray<readonly [RowHeight, string]> = [
  ['short', $t('Courte')],
  ['medium', $t('Moyenne||hauteur de ligne')],
  ['tall', $t('Haute')],
  ['extra', $t('Très haute')],
]

export function HeightMenu({
  value,
  onChange,
}: {
  readonly value: RowHeight
  readonly onChange: (height: RowHeight) => void
}) {
  return (
    <DropdownMenu>
      <Hint label={$t('Hauteur des lignes')}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label={$t('Hauteur des lignes')}
          >
            <Rows3 className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {$t('Hauteur des lignes')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as RowHeight)}>
          {HEIGHTS.map(([height, label]) => (
            <DropdownMenuRadioItem key={height} value={height}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** How a coloured row can show its colour, as the menu offers it. */
const COLOR_STYLES: ReadonlyArray<{ readonly value: ColorStyle; readonly label: string }> = [
  { value: 'both', label: $t('Trait et fond') },
  { value: 'stripe', label: $t('Trait à gauche') },
  { value: 'background', label: $t('Fond') },
]

/** The three ways to show a colour, each previewed in that colour. */
function StylePicker({
  color,
  value,
  onChange,
  label,
}: {
  readonly color: string
  readonly value: ColorStyle
  readonly onChange: (style: ColorStyle) => void
  /** Names the group for a screen reader: which colour these styles are for. */
  readonly label: string
}) {
  return (
    <fieldset className="grid grid-cols-3 gap-1">
      <legend className="sr-only">{label}</legend>
      {COLOR_STYLES.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={value === s.value}
          onClick={() => onChange(s.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px]',
            value === s.value ? 'border-primary bg-primary/5' : 'hover:bg-accent',
          )}
        >
          <span
            aria-hidden
            className="relative block h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] border"
            style={
              s.value === 'stripe'
                ? undefined
                : { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }
            }
          >
            {s.value !== 'background' && (
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: color }}
              />
            )}
          </span>
          <span className="truncate">{s.label}</span>
        </button>
      ))}
    </fieldset>
  )
}

/**
 * Colouring rows: by the choice a row carries in a list — its colour, as the list dresses
 * it —, or by rules, each a filter and a colour, the first that matches winning over the
 * list's. Each shows its colour its own way: a stripe at the row's left, a tinted
 * background, or both.
 */
export function ColorMenu({
  fields,
  field,
  rules,
  colorStyle,
  onField,
  onRules,
  onStyle,
}: {
  readonly fields: readonly Field[]
  readonly field: string | null
  readonly rules: readonly ColorRule[]
  readonly colorStyle: ColorStyle
  readonly onField: (field: string | null) => void
  readonly onRules: (rules: readonly ColorRule[]) => void
  readonly onStyle: (style: ColorStyle) => void
}) {
  const lists = fields.filter((f) => f.kind === 'select')
  const active = field !== null || rules.length > 0
  const set = (index: number, patch: Partial<ColorRule>) =>
    onRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  // The list's previews draw with one of its own colours.
  const listSample =
    lists.find((f) => f.name === field)?.options?.find((o) => o.color !== null)?.color ??
    PRESET_COLORS[0] ??
    '#16a34a'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
        >
          <Palette className="size-3.5" />
          {$t('Couleurs')}
          {rules.length > 0 && (
            <span className="rounded bg-primary/20 px-1 text-[10px] text-primary">
              {rules.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[26rem] space-y-4 p-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">{$t('Selon une liste de choix')}</p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onField(null)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs',
                field === null ? 'border-primary bg-primary/5' : 'hover:bg-accent',
              )}
            >
              {$t('Aucune')}
            </button>
            {lists.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => onField(f.name)}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs',
                  field === f.name ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                )}
              >
                {f.label}
              </button>
            ))}
            {lists.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {$t('La table n’a pas de liste de choix.')}
              </span>
            )}
          </div>
          {field !== null && (
            <StylePicker
              color={listSample}
              value={colorStyle}
              onChange={onStyle}
              label={$t('Affichage de la couleur de la liste')}
            />
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium">{$t('Règles')}</p>
            <p className="text-[11px] text-muted-foreground">
              {$t('Un filtre et une couleur ; la première règle qui correspond l’emporte.')}
            </p>
          </div>
          {rules.map((rule, index) => {
            const valid = rule.filter.trim() === '' || compileMatcher(rule.filter, fields) !== null
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: rules have no identity but their place
              <div key={index} className="space-y-1.5 rounded-md border p-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={rule.filter}
                    onChange={(e) => set(index, { filter: e.target.value })}
                    placeholder={$t('statut eq "bloque"')}
                    className={cn(
                      'h-7 flex-1 font-mono text-xs',
                      !valid && 'border-destructive focus-visible:ring-destructive/30',
                    )}
                    aria-label={$t('Filtre de la règle {value}', { value: index + 1 })}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    onClick={() => onRules(rules.filter((_, i) => i !== index))}
                    aria-label={$t('Retirer la règle')}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => set(index, { color })}
                      className={cn(
                        'size-5 rounded-full ring-offset-2 ring-offset-background',
                        rule.color === color && 'ring-2 ring-foreground/60',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={$t('Couleur {color}', { color })}
                    />
                  ))}
                </div>
                <StylePicker
                  color={rule.color}
                  value={rule.style}
                  onChange={(style) => set(index, { style })}
                  label={$t('Affichage de la règle {value}', { value: index + 1 })}
                />
                {!valid && (
                  <p className="text-[11px] text-destructive">
                    {$t('Filtre illisible : cette règle ne colorera rien.')}
                  </p>
                )}
              </div>
            )
          })}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              onRules([
                ...rules,
                { filter: '', color: PRESET_COLORS[0] ?? '#dc2626', style: 'both' },
              ])
            }
            disabled={rules.length >= 20}
          >
            <Plus className="size-3.5" />
            {$t('Ajouter une règle')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
