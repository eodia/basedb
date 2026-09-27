'use client'

import { OptionBadge, hasLook } from '@/components/app/option-badge'
import { Badge } from '@/components/ui/badge'
import { Combobox, type ComboboxOption, filterOptions } from '@/components/ui/combobox'
import { Hint } from '@/components/ui/tooltip'
import type { Field, LinkOption } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Link2 } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

/**
 * The two ways to choose a value — from a list of choices, and from the rows of another
 * table.
 *
 * Both are the same combobox: type to narrow, arrows and Enter to choose. A column that
 * holds three values and one that points at ten thousand rows are handled alike, which
 * is the reason neither gets a plain dropdown.
 */

export interface LinkSearchResult {
  readonly options: readonly LinkOption[]
  /** True when the target holds more rows than `options` carries. */
  readonly truncated: boolean
  /**
   * True when the server already applied the text. False means `options` is only the
   * first rows of the target, for the picker to narrow itself — which is what happens
   * when the display column is not text, and so cannot be searched.
   */
  readonly filtered: boolean
}

/**
 * Asks the server for the rows of a link's target that match a text. An empty text lists
 * the first rows in the target's own order.
 */
export type SearchLink = (field: Field, query: string) => Promise<LinkSearchResult>

interface PickerProps {
  readonly field: Field
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  /** `cell` is the compact chip of a grid; `form` is the bordered field of a form. */
  readonly appearance: 'cell' | 'form'
  /** Shown while nothing is chosen. */
  readonly placeholder?: string
}

/** In a grid the chevron stays out of sight until the row is hovered or the list is open. */
const TRIGGER: Readonly<Record<PickerProps['appearance'], string>> = {
  cell: 'h-7 border-transparent bg-transparent px-1.5 text-xs shadow-none hover:bg-muted [&>svg]:opacity-0 group-hover/row:[&>svg]:opacity-50 data-[state=open]:[&>svg]:opacity-100',
  form: '',
}

/** A field that may be empty offers a way to empty it; a required one must not. */
const clearLabelOf = (field: Field) => (field.required === true ? undefined : $t('Aucune valeur'))

function Shown({
  label,
  appearance,
  icon,
  placeholder,
}: {
  readonly label: string | null
  readonly appearance: PickerProps['appearance']
  readonly icon: ReactNode
  readonly placeholder: string
}) {
  if (label === null) return <span className="text-muted-foreground">{placeholder}</span>
  if (appearance === 'form') return <span className="truncate">{label}</span>
  return (
    <Badge variant="secondary" className="min-w-0 shrink gap-1.5 overflow-hidden font-normal">
      {icon}
      <span className="truncate">{label}</span>
    </Badge>
  )
}

/**
 * A `select` field: the choices are declared by the catalog, so they are all here.
 *
 * A choice that has a look — a colour, a pictogram, a picture — is drawn as its chip, in
 * the list and once chosen; one that has none keeps the plain rendering it always had, so
 * a list nobody dressed does not change.
 */
export function EnumPicker({ field, value, onChange, appearance, placeholder = '—' }: PickerProps) {
  const options = field.options ?? []
  const chosen = value === null ? undefined : options.find((o) => o.value === value)
  // A value the list does not carry is shown as stored, not as if nothing were chosen.
  const label = value === null ? null : (chosen?.label ?? value)

  const choices: ComboboxOption[] = options.map((o) => ({
    value: o.value,
    label: o.label,
    render: hasLook(o) ? <OptionBadge option={o} /> : undefined,
  }))

  return (
    <Combobox
      value={value}
      onValueChange={onChange}
      options={choices}
      clearLabel={clearLabelOf(field)}
      searchPlaceholder={$t('Rechercher une valeur…')}
      className={TRIGGER[appearance]}
      aria-label={field.label}
    >
      {chosen !== undefined && hasLook(chosen) ? (
        <OptionBadge option={chosen} />
      ) : (
        <Shown
          label={label}
          appearance={appearance}
          placeholder={placeholder}
          icon={<span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" />}
        />
      )}
    </Combobox>
  )
}

/**
 * A `multi_select` field: the same list, every choice a toggle.
 *
 * The value is sent WHOLE on each toggle — the list after the click, in the order the
 * catalog declares, not the order clicked — so two quick clicks cannot interleave into a
 * list neither of them meant. Empty is `null`: the column holds no empty array.
 */
export function MultiEnumPicker({
  field,
  value,
  onChange,
  appearance,
  placeholder = '—',
}: {
  readonly field: Field
  readonly value: readonly string[]
  readonly onChange: (value: readonly string[] | null) => void
  readonly appearance: PickerProps['appearance']
  readonly placeholder?: string
}) {
  const options = field.options ?? []
  const chosen = new Set(value)

  const choices: ComboboxOption[] = options.map((o) => ({
    value: o.value,
    label: o.label,
    render: hasLook(o) ? <OptionBadge option={o} /> : undefined,
  }))

  const toggle = (picked: string | null) => {
    if (picked === null) return onChange(null)
    const next = new Set(chosen)
    if (next.has(picked)) next.delete(picked)
    else next.add(picked)
    // Declared order first; a value the list no longer carries keeps its place at the end.
    const ordered = [
      ...options.map((o) => o.value).filter((v) => next.has(v)),
      ...value.filter((v) => next.has(v) && !options.some((o) => o.value === v)),
    ]
    onChange(ordered.length === 0 ? null : ordered)
  }

  return (
    <Combobox
      value={null}
      selected={chosen}
      onValueChange={toggle}
      options={choices}
      clearLabel={field.required === true ? undefined : $t('Tout retirer')}
      searchPlaceholder={$t('Rechercher une valeur…')}
      className={cn(TRIGGER[appearance], appearance === 'form' && 'h-auto min-h-9 py-1.5')}
      aria-label={field.label}
    >
      <ChoiceChips
        field={field}
        values={value}
        placeholder={placeholder}
        wrap={appearance === 'form'}
      />
    </Combobox>
  )
}

/**
 * The chosen values of a multiple choice, as chips. On one line in a grid — the cell is
 * a row's height, and what does not fit is counted — and wrapped in a form.
 */
export function ChoiceChips({
  field,
  values,
  placeholder = '—',
  wrap = false,
}: {
  readonly field: Field
  readonly values: readonly string[]
  readonly placeholder?: string
  readonly wrap?: boolean
}) {
  if (values.length === 0) return <span className="text-muted-foreground">{placeholder}</span>
  const shown = wrap ? values : values.slice(0, 3)
  return (
    <span className={cn('flex min-w-0 items-center gap-1', wrap ? 'flex-wrap' : 'overflow-hidden')}>
      {shown.map((v) => {
        const option = field.options?.find((o) => o.value === v)
        return option !== undefined && hasLook(option) ? (
          <OptionBadge key={v} option={option} className="shrink-0" />
        ) : (
          <Badge key={v} variant="secondary" className="shrink-0 font-normal">
            {option?.label ?? v}
          </Badge>
        )
      })}
      {values.length > shown.length && (
        <span className="shrink-0 text-xs text-muted-foreground">
          +{values.length - shown.length}
        </span>
      )}
    </span>
  )
}

/** The values of a multiple choice, whatever the wire brought: anything else reads as none. */
export function choicesOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

interface LinkPickerProps extends PickerProps {
  /** What the row itself calls the linked row: the display value the server resolved. */
  readonly display?: string | null
  /**
   * The first rows of the target, loaded with the table. They fill the list the instant
   * it opens, and stand in for the server when it cannot search.
   */
  readonly options: readonly LinkOption[]
  readonly onSearch: SearchLink
}

/** How long a pause in typing means "search now". */
const TYPING_PAUSE_MS = 200

const toChoice = (option: LinkOption): ComboboxOption => ({
  value: option.id,
  label: option.display,
})

/**
 * The search behind both link pickers: the rows of the target, asked of the server as one
 * types, the rows loaded with the table standing in until it answers.
 *
 * Searching there is not an optimisation. The rows loaded with the table are one page,
 * and a target with more rows than that would simply not offer the ones past it — a
 * search that cannot find a row that exists is worse than no search.
 */
function useLinkSearch(field: Field, options: readonly LinkOption[], onSearch: SearchLink) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{
    readonly query: string
    readonly result: LinkSearchResult
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const search = (text: string) => {
    setQuery(text)
    clearTimeout(timer.current)

    const run = () => {
      // Only the newest request may answer: a slow reply for "du" must not overwrite the
      // list already shown for "dup".
      const mine = ++latest.current
      setLoading(true)
      onSearch(field, text).then(
        (result) => {
          if (mine !== latest.current) return
          setFound({ query: text, result })
          setFailed(false)
          setLoading(false)
        },
        () => {
          if (mine !== latest.current) return
          setFound(null)
          setFailed(true)
          setLoading(false)
        },
      )
    }

    // An empty text is the list OPENING, not someone typing: there is nothing to wait for.
    if (text === '') run()
    else timer.current = setTimeout(run, TYPING_PAUSE_MS)
  }

  // What the server said about THIS text. A reply for an earlier one is not shown: until
  // the right one arrives, the rows already loaded are narrowed locally.
  const settled = found !== null && found.query === query ? found.result : null
  const listed = (settled === null ? options : settled.options).map(toChoice)
  const shown = settled?.filtered === true ? listed : filterOptions(listed, query)

  const notice = failed
    ? $t('Recherche indisponible.')
    : settled?.truncated !== true
      ? null
      : settled.filtered
        ? $t('Précisez la recherche pour voir d’autres résultats.')
        : $t('Liste incomplète.')

  return { search, shown, loading, notice }
}

/** A link field: one row of the target table. */
export function LinkPicker({
  field,
  value,
  display,
  options,
  onSearch,
  onChange,
  appearance,
  placeholder = '—',
}: LinkPickerProps) {
  const { search, shown, loading, notice } = useLinkSearch(field, options, onSearch)
  const [picked, setPicked] = useState<LinkOption | null>(null)

  const label =
    value === null
      ? null
      : (display ??
        (picked?.id === value ? picked.display : undefined) ??
        options.find((o) => o.id === value)?.display ??
        value.slice(0, 8))

  return (
    <Combobox
      value={value}
      onValueChange={(next) => {
        const chosen = next === null ? undefined : shown.find((o) => o.value === next)
        setPicked(chosen === undefined ? null : { id: chosen.value, display: chosen.label })
        onChange(next)
      }}
      options={shown}
      onQueryChange={search}
      loading={loading}
      notice={notice}
      clearLabel={clearLabelOf(field)}
      searchPlaceholder={$t('Rechercher un enregistrement…')}
      emptyLabel={$t('Aucun enregistrement trouvé')}
      className={TRIGGER[appearance]}
      aria-label={field.label}
    >
      <Shown
        label={label}
        appearance={appearance}
        placeholder={placeholder}
        icon={<Link2 className="size-3" />}
      />
    </Combobox>
  )
}

/** A linked row as a read returns it (chapter 04 §4.7). */
export interface LinkValue {
  readonly id: string | null
  readonly display: string | null
  readonly masked?: boolean
}

/** The rows of a multi-link, whatever the wire brought: anything else reads as none. */
export function linksOf(value: unknown): readonly LinkValue[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is LinkValue => typeof v === 'object' && v !== null && 'id' in (v as object),
  )
}

/**
 * The rows of a multi-link, as chips. On one line in a grid, what does not fit counted;
 * wrapped in a form. A masked element — rows the reader may not see — reads « masqué »,
 * once, whatever it hides.
 */
export function LinkChips({
  values,
  placeholder = '—',
  wrap = false,
  onFollow,
}: {
  readonly values: readonly LinkValue[]
  readonly placeholder?: string
  readonly wrap?: boolean
  /** Opens a linked row — the chips become buttons. */
  readonly onFollow?: (id: string) => void
}) {
  if (values.length === 0) return <span className="text-muted-foreground">{placeholder}</span>
  // In a cell, two names cut short read better than one name and a stub: each chip may
  // shrink, down to a few letters, and what is left over is counted.
  const shown = wrap ? values : values.slice(0, 2)
  const holder = wrap ? 'max-w-full' : 'min-w-8 max-w-40 shrink'
  return (
    <span className={cn('flex min-w-0 items-center gap-1', wrap ? 'flex-wrap' : 'overflow-hidden')}>
      {shown.map((v) => {
        const label = v.masked === true ? $t('masqué') : (v.display ?? v.id?.slice(0, 8) ?? '—')
        // The only element without an identifier is the masked one, and there is one at most.
        const key = v.id ?? 'masked'
        const chip = (
          <Badge
            key={key}
            variant="secondary"
            className={cn(
              'w-full max-w-full justify-start gap-1 font-normal',
              v.masked === true && 'text-muted-foreground italic',
              onFollow !== undefined && v.id !== null && 'hover:bg-secondary/70',
            )}
            // A chip that opens its row already names it in its tooltip.
            title={onFollow !== undefined && v.id !== null ? undefined : label}
          >
            <Link2 className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </Badge>
        )
        const id = v.id
        return onFollow !== undefined && id !== null ? (
          <Hint key={key} label={$t('Ouvrir « {label} »', { label })}>
            <button
              type="button"
              className={cn('flex', holder)}
              onClick={() => onFollow(id)}
              aria-label={$t('Ouvrir « {label} »', { label })}
            >
              {chip}
            </button>
          </Hint>
        ) : (
          <span key={key} className={cn('flex', holder)}>
            {chip}
          </span>
        )
      })}
      {values.length > shown.length && (
        <span className="shrink-0 text-xs text-muted-foreground">
          +{values.length - shown.length}
        </span>
      )}
    </span>
  )
}

/**
 * A multi-link field: rows of the target, each a toggle — chapter 04 §4 bis.
 *
 * The list is sent WHOLE after each toggle, in the order the rows were linked: a row
 * chosen goes last, one removed leaves the others in place. Empty is `null`. The rows go
 * out as `{ id, display }` — the server reads the identifier, and the display lets the
 * cell show names before the answer comes back.
 */
export function MultiLinkPicker({
  field,
  value,
  options,
  onSearch,
  onChange,
  appearance,
  placeholder = '—',
  trigger,
}: {
  readonly field: Field
  readonly value: readonly LinkValue[]
  readonly options: readonly LinkOption[]
  readonly onSearch: SearchLink
  readonly onChange: (value: readonly LinkValue[] | null) => void
  readonly appearance: PickerProps['appearance']
  readonly placeholder?: string
  /** What opens the list, when the chips are drawn elsewhere — the panel's « Modifier ». */
  readonly trigger?: ReactNode
}) {
  const { search, shown, loading, notice } = useLinkSearch(field, options, onSearch)
  // What the reader may not see stays as it is: it is not theirs to drop.
  const masked = value.filter((v) => v.masked === true)
  const linked = value.filter((v) => v.masked !== true && v.id !== null)
  const chosen = new Set(linked.map((v) => v.id as string))

  const toggle = (picked: string | null) => {
    if (picked === null) return onChange(masked.length === 0 ? null : masked)
    const next = chosen.has(picked)
      ? linked.filter((v) => v.id !== picked)
      : [...linked, { id: picked, display: shown.find((o) => o.value === picked)?.label ?? null }]
    const all = [...next, ...masked]
    onChange(all.length === 0 ? null : all)
  }

  return (
    <Combobox
      value={null}
      selected={chosen}
      onValueChange={toggle}
      options={shown}
      onQueryChange={search}
      loading={loading}
      notice={notice}
      clearLabel={field.required === true ? undefined : $t('Tout retirer')}
      searchPlaceholder={$t('Rechercher un enregistrement…')}
      emptyLabel={$t('Aucun enregistrement trouvé')}
      className={cn(TRIGGER[appearance], appearance === 'form' && 'h-auto min-h-9 py-1.5')}
      aria-label={field.label}
    >
      {trigger ?? (
        <LinkChips values={value} placeholder={placeholder} wrap={appearance === 'form'} />
      )}
    </Combobox>
  )
}
