'use client'

import {
  STEP_ICONS,
  STEP_TONES,
  TRIGGER_ICONS,
  TRIGGER_TONE,
} from '@/components/app/automation-flow'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import type { AutomationTriggerKind } from '@/lib/api/client'
import type { Slot } from '@/lib/automation-layout'
import { type PickerEntry, pickerMatches } from '@/lib/automation-picker'
import {
  type Draft,
  STEP_CATEGORIES,
  STEP_DESCRIPTIONS,
  STEP_HINTS,
  STEP_KEYWORDS,
  STEP_LABELS,
  type StepKind,
  TRIGGER_CATEGORIES,
  TRIGGER_DESCRIPTIONS,
  TRIGGER_HINTS,
  TRIGGER_KEYWORDS,
  TRIGGER_LABELS,
  slotCaption,
  unavailableSteps,
} from '@/lib/automations'
import { $t } from '@/lib/i18n'
import { runsOf } from '@/lib/search'
import { cn } from '@/lib/utils'
import {
  Check,
  Clock,
  CornerDownLeft,
  FileText,
  Globe,
  LayoutGrid,
  type LucideIcon,
  MessagesSquare,
  Plus,
  Rows3,
  Search,
  Sparkles,
  Split,
  Zap,
} from 'lucide-react'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * The pickers of an automation's editor — what step to add, what sets it off. One dialog,
 * keyboard first as the command palette: a search field that finds a kind by its name,
 * what it does or a word it answers to, accents and case aside; the categories beside it,
 * each with how many it holds; the kind highlighted described before it is chosen. What
 * may not go at that place of the flow is shown, greyed, with the reason.
 */

interface PickerItem extends PickerEntry {
  readonly description: string
  readonly icon: LucideIcon
  readonly tone: string
  /** Why it may not be chosen here; absent: it may. */
  readonly unavailable?: string
}

interface PickerCategory {
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
}

const STEP_CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  rows: Rows3,
  communicate: MessagesSquare,
  documents: FileText,
  ai: Sparkles,
  logic: Split,
}

const TRIGGER_CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  rows: Rows3,
  time: Clock,
  outside: Globe,
}

/** The steps one may add at a place of the flow — the canvas's « + », the inspector's buttons. */
export function StepPicker({
  draft,
  slot,
  onPick,
  onClose,
}: {
  readonly draft: Draft
  /** Where the step goes; `null`: the picker is closed. */
  readonly slot: Slot | null
  readonly onPick: (kind: StepKind) => void
  readonly onClose: () => void
}) {
  const items = useMemo((): PickerItem[] => {
    const unavailable = slot === null ? {} : unavailableSteps(draft.steps, slot.path)
    return STEP_CATEGORIES.flatMap((c) =>
      c.kinds.map((kind) => {
        const reason = unavailable[kind]
        return {
          id: kind,
          category: c.id,
          label: STEP_LABELS[kind],
          hint: STEP_HINTS[kind],
          keywords: STEP_KEYWORDS[kind],
          description: STEP_DESCRIPTIONS[kind],
          icon: STEP_ICONS[kind],
          tone: STEP_TONES[kind],
          ...(reason === undefined ? {} : { unavailable: reason }),
        }
      }),
    )
  }, [draft.steps, slot])
  const categories = useMemo(
    () =>
      STEP_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        icon: STEP_CATEGORY_ICONS[c.id] ?? LayoutGrid,
      })),
    [],
  )
  return (
    <KindPicker
      open={slot !== null}
      icon={Plus}
      title={$t('Ajouter une étape')}
      context={slot === null ? '' : slotCaption(draft, slot)}
      placeholder={$t('Rechercher une étape : courriel, pdf, condition…')}
      action={$t('Ajouter')}
      actionHint={$t('ajouter')}
      categories={categories}
      items={items}
      current={null}
      onPick={(id) => onPick(id as StepKind)}
      onClose={onClose}
    />
  )
}

/** What sets an automation off, chosen among every kind of trigger. */
export function TriggerPicker({
  open,
  current,
  onPick,
  onClose,
}: {
  readonly open: boolean
  readonly current: AutomationTriggerKind
  readonly onPick: (kind: AutomationTriggerKind) => void
  readonly onClose: () => void
}) {
  const items = useMemo(
    (): PickerItem[] =>
      TRIGGER_CATEGORIES.flatMap((c) =>
        c.kinds.map((kind) => ({
          id: kind,
          category: c.id,
          label: TRIGGER_LABELS[kind],
          hint: TRIGGER_HINTS[kind],
          keywords: TRIGGER_KEYWORDS[kind],
          description: TRIGGER_DESCRIPTIONS[kind],
          icon: TRIGGER_ICONS[kind],
          tone: TRIGGER_TONE,
        })),
      ),
    [],
  )
  const categories = useMemo(
    () =>
      TRIGGER_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        icon: TRIGGER_CATEGORY_ICONS[c.id] ?? LayoutGrid,
      })),
    [],
  )
  return (
    <KindPicker
      open={open}
      icon={Zap}
      title={$t('Choisir le déclencheur')}
      context={$t('Ce qui fait partir l’automatisation')}
      placeholder={$t('Rechercher un déclencheur : date, webhook, filtre…')}
      action={$t('Choisir')}
      actionHint={$t('choisir')}
      categories={categories}
      items={items}
      current={current}
      onPick={(id) => onPick(id as AutomationTriggerKind)}
      onClose={onClose}
    />
  )
}

interface KindPickerProps {
  readonly open: boolean
  readonly icon: LucideIcon
  readonly title: string
  /** Where it applies: « Après e2 · Chercher une ligne ». */
  readonly context: string
  readonly placeholder: string
  /** The button that chooses, and the word beside the Enter key. */
  readonly action: string
  readonly actionHint: string
  readonly categories: readonly PickerCategory[]
  readonly items: readonly PickerItem[]
  /** The kind already chosen, marked as such. */
  readonly current: string | null
  readonly onPick: (id: string) => void
  readonly onClose: () => void
}

function KindPicker(props: KindPickerProps) {
  // Drawn only while open: each opening starts afresh — an empty search, every category.
  return (
    <Dialog open={props.open} onOpenChange={(next) => !next && props.onClose()}>
      {props.open && <PickerBody {...props} />}
    </Dialog>
  )
}

function PickerBody({
  icon: TitleIcon,
  title,
  context,
  placeholder,
  action,
  actionHint,
  categories,
  items,
  current,
  onPick,
}: KindPickerProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  /** A kind was chosen: the focus is left to what it opened, not given back to the « + ». */
  const picked = useRef(false)
  const listId = useId()

  const typed = query.trim() !== ''
  const result = useMemo(() => pickerMatches(items, query, category), [items, query, category])
  const flat = result.matches
  const categoryOf = (id: string) => categories.find((c) => c.id === id)
  // The one highlighted: the one pointed at, else the first that may be chosen.
  const active =
    flat.find((m) => m.entry.id === activeId) ??
    flat.find((m) => m.entry.unavailable === undefined) ??
    flat[0]
  const activeIndex = active === undefined ? -1 : flat.indexOf(active)

  useEffect(() => {
    void activeIndex
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const choose = (item: PickerItem | undefined) => {
    if (item === undefined || item.unavailable !== undefined) return
    picked.current = true
    onPick(item.id)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const move = (to: number) => {
      e.preventDefault()
      if (flat.length === 0) return
      setActiveId(flat[(to + flat.length) % flat.length]?.entry.id ?? null)
    }
    switch (e.key) {
      case 'ArrowDown':
        return move(activeIndex + 1)
      case 'ArrowUp':
        return move(activeIndex - 1)
      case 'Home':
        if (query === '') move(0)
        return
      case 'End':
        if (query === '') move(flat.length - 1)
        return
      case 'Enter':
        e.preventDefault()
        if (!e.nativeEvent.isComposing) choose(active?.entry)
        return
    }
  }

  // Nothing typed: the kinds under their categories' names; typed: the best first.
  const sections = typed
    ? [{ id: '', label: '', matches: flat }]
    : categories
        .map((c) => ({
          id: c.id,
          label: c.label,
          matches: flat.filter((m) => m.entry.category === c.id),
        }))
        .filter((s) => s.matches.length > 0)

  return (
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      className="top-[10vh] flex h-[min(36rem,80vh)] w-[calc(100%-2rem)] max-w-3xl translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        input.current?.focus()
      }}
      onCloseAutoFocus={(e) => {
        if (picked.current) e.preventDefault()
      }}
    >
      <div className="flex items-center gap-2.5 border-b px-4 pt-3 pb-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
          <TitleIcon className="size-3.5" />
        </span>
        <DialogTitle className="shrink-0 text-sm">{title}</DialogTitle>
        {context !== '' && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">· {context}</span>
        )}
      </div>
      <div className="flex items-center gap-2 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          role="combobox"
          aria-expanded
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={active === undefined ? undefined : `${listId}-${activeIndex}`}
          aria-label={placeholder}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveId(null)
          }}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
        />
        <Kbd className="hidden sm:inline-flex">{$t('Échap')}</Kbd>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={$t('Catégories')}
          className="scroll-discret hidden w-44 shrink-0 space-y-0.5 overflow-y-auto border-r p-2 sm:block"
        >
          <CategoryButton
            icon={LayoutGrid}
            active={category === null}
            count={result.total}
            onClick={() => {
              setCategory(null)
              setActiveId(null)
              input.current?.focus()
            }}
          >
            {$t('Tout')}
          </CategoryButton>
          {categories.map((c) => (
            <CategoryButton
              key={c.id}
              icon={c.icon}
              active={category === c.id}
              count={result.counts[c.id] ?? 0}
              onClick={() => {
                setCategory(category === c.id ? null : c.id)
                setActiveId(null)
                input.current?.focus()
              }}
            >
              {c.label}
            </CategoryButton>
          ))}
        </nav>

        {/* biome-ignore lint/a11y/useFocusableInteractive: focus stays in the search box, which points at the highlighted option with aria-activedescendant */}
        <div
          ref={list}
          id={listId}
          // biome-ignore lint/a11y/useSemanticElements: a <select> cannot host a search box — the combobox pattern of the ARIA Authoring Practices
          role="listbox"
          aria-label={title}
          className="scroll-discret min-h-0 min-w-0 flex-1 overflow-y-auto p-1.5"
        >
          {sections.map((s) => (
            <div key={s.id} role="presentation" className="mb-1">
              {s.label !== '' && category === null && (
                <p className="px-2.5 pt-2 pb-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
              )}
              {s.matches.map((m) => {
                const at = flat.indexOf(m)
                return (
                  <Option
                    key={m.entry.id}
                    id={`${listId}-${at}`}
                    item={m.entry}
                    lit={m.lit}
                    active={at === activeIndex}
                    current={m.entry.id === current}
                    category={typed ? (categoryOf(m.entry.category)?.label ?? null) : null}
                    onHover={() => at !== activeIndex && setActiveId(m.entry.id)}
                    onChoose={() => choose(m.entry)}
                  />
                )
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {$t('Rien ne correspond à « {query} ».', { query: query.trim() })}
            </div>
          )}
        </div>

        {active !== undefined && (
          <Preview
            item={active.entry}
            category={categoryOf(active.entry.category)?.label ?? ''}
            current={active.entry.id === current}
            action={action}
            onChoose={() => choose(active.entry)}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t bg-muted/30 px-3 py-1.5 text-[0.7rem] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          {$t('parcourir')}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd>
          {actionHint}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>{$t('Échap')}</Kbd>
          {$t('fermer')}
        </span>
      </div>
    </DialogContent>
  )
}

function CategoryButton({
  icon: Icon,
  active,
  count,
  onClick,
  children,
}: {
  readonly icon: LucideIcon
  readonly active: boolean
  readonly count: number
  readonly onClick: () => void
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-accent font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        count === 0 && !active && 'opacity-50',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  )
}

function Lit({ text, lit }: { readonly text: string; readonly lit: ReadonlySet<number> }) {
  return (
    <>
      {runsOf(text, lit).map((run, i) =>
        run.lit ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one text, in order, never reordered
          <mark key={i} className="rounded-[2px] bg-primary/15 text-inherit">
            {run.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  )
}

function Option({
  id,
  item,
  lit,
  active,
  current,
  category,
  onHover,
  onChoose,
}: {
  readonly id: string
  readonly item: PickerItem
  readonly lit: ReadonlySet<number>
  readonly active: boolean
  readonly current: boolean
  /** Its category, said once a search mixes them. */
  readonly category: string | null
  readonly onHover: () => void
  readonly onChoose: () => void
}) {
  const Icon = item.icon
  const off = item.unavailable !== undefined
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the options never take focus — see the list
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard belongs to the search box, which drives this list through aria-activedescendant
    <div
      id={id}
      // biome-ignore lint/a11y/useSemanticElements: an <option> cannot live outside a <select> — see the list
      role="option"
      aria-selected={active}
      aria-disabled={off}
      data-active={active}
      // Keeps the caret in the search box: a click on a kind must not blur it.
      onMouseDown={(e) => e.preventDefault()}
      // `mousemove`, not `mouseenter`: the arrow keys scroll the list under a still pointer.
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn(
        'flex select-none items-center gap-3 rounded-lg px-2.5 py-2',
        off ? 'cursor-not-allowed' : 'cursor-pointer',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          item.tone,
          off && 'opacity-45 grayscale',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-medium', off && 'text-muted-foreground')}>
          <Lit text={item.label} lit={lit} />
        </span>
        <span
          className={cn(
            'block truncate text-xs',
            off ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
          )}
        >
          {item.unavailable ?? item.hint}
        </span>
      </span>
      {category !== null && (
        <span className="hidden shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground sm:inline">
          {category}
        </span>
      )}
      {current && (
        <span className="flex shrink-0 items-center gap-1 text-[0.7rem] text-primary">
          <Check className="size-3.5" />
          {$t('Actuel')}
        </span>
      )}
      {active && !off && !current && (
        <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </div>
  )
}

/** The kind highlighted, said whole: what it does, and why not here when it may not go. */
function Preview({
  item,
  category,
  current,
  action,
  onChoose,
}: {
  readonly item: PickerItem
  readonly category: string
  readonly current: boolean
  readonly action: string
  readonly onChoose: () => void
}) {
  const Icon = item.icon
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l bg-muted/25 p-4 md:flex">
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-xl shadow-xs',
          item.tone,
          item.unavailable !== undefined && 'opacity-50 grayscale',
        )}
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold leading-snug">{item.label}</p>
      <p className="text-xs text-muted-foreground">{category}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
      {item.unavailable !== undefined && (
        <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
          {item.unavailable}
        </p>
      )}
      <div className="mt-auto pt-4">
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={item.unavailable !== undefined}
          onClick={onChoose}
        >
          {current ? <Check className="size-4" /> : <Plus className="size-4" />}
          {action}
        </Button>
      </div>
    </aside>
  )
}
