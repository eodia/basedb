'use client'

import { OptionGlyph, hasLook } from '@/components/app/option-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { copy } from '@/lib/export'
import { OPTION_ICONS } from '@/lib/option-icons'
import {
  MAX_IMAGE_CHARS,
  type OptionDraft,
  PRESET_COLORS,
  emptyDraft,
  normalizeHex,
  parseOptionsJson,
  serializeOptions,
  shrinkImage,
  valuesOf,
} from '@/lib/options'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ImageUp,
  Lock,
  Palette,
  Pipette,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * The editor of a list of choices: one row per choice, and the same list as JSON below.
 *
 * A row is a label, how the choice looks (a colour of any hue, and a pictogram or a
 * picture), and its place in the list. The stored value is not typed: for a choice that
 * already exists it is shown and fixed, because renaming it would rewrite the table's data;
 * for a new one it is derived from the label, and shown, so nobody is surprised by it.
 *
 * The JSON is the same list, both ways. Copying it hands a whole list to another field or
 * another base; pasting one over it replaces the rows at once — which is quicker than
 * building fifteen statuses by hand.
 */

interface Props {
  readonly value: OptionDraft[]
  readonly onChange: (next: OptionDraft[]) => void
  /**
   * The values the catalog already holds, so a pasted choice that names one keeps it
   * instead of being read as a new one that would clash. Empty when the field is being
   * created.
   */
  readonly known?: ReadonlySet<string>
  readonly disabled?: boolean
}

const NO_VALUES: ReadonlySet<string> = new Set()

export function OptionsEditor({ value, onChange, known = NO_VALUES, disabled = false }: Props) {
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const stored = useMemo(() => valuesOf(value), [value])

  const update = (index: number, patch: Partial<OptionDraft>) =>
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const addAfter = (index: number) => {
    const draft = emptyDraft()
    const next = [...value]
    next.splice(index + 1, 0, draft)
    setFocusKey(draft.key)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Aucun choix. Ajoutez-en un, ou collez une liste JSON plus bas.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((draft, index) => (
            <li
              key={draft.key}
              className="flex items-center gap-1.5 rounded-lg border bg-background p-1.5"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Monter ce choix"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Descendre ce choix"
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                  className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>

              <LookButton
                draft={draft}
                disabled={disabled}
                onChange={(patch) => update(index, patch)}
              />

              <div className="min-w-0 flex-1">
                <Input
                  value={draft.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draft.label.trim() !== '') {
                      e.preventDefault()
                      addAfter(index)
                    }
                  }}
                  autoFocus={draft.key === focusKey}
                  placeholder="Libellé du choix"
                  aria-label={`Libellé du choix ${index + 1}`}
                  disabled={disabled}
                  className="h-8"
                />
                <p
                  className="mt-0.5 flex items-center gap-1 truncate px-1 font-mono text-[11px] text-muted-foreground"
                  title={
                    draft.locked
                      ? 'Valeur enregistrée dans la colonne : elle ne se renomme pas, cela réécrirait les lignes.'
                      : 'Valeur qui sera enregistrée dans la colonne, dérivée du libellé.'
                  }
                >
                  {draft.locked ? <Lock className="size-3 shrink-0" /> : <span aria-hidden>→</span>}
                  <span className="truncate">
                    {draft.label.trim() === '' && !draft.locked ? '…' : stored[index]}
                  </span>
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer le choix ${draft.label || index + 1}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => addAfter(value.length - 1)}
        className="text-muted-foreground"
      >
        <Plus className="size-4" />
        Ajouter un choix
      </Button>

      <JsonPanel value={value} known={known} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// ── How a choice looks ───────────────────────────────────────────────────────────────

/** The fold that lets `ete` find `Été`: the same one the combobox uses. */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

function LookButton({
  draft,
  onChange,
  disabled,
}: {
  readonly draft: OptionDraft
  readonly onChange: (patch: Partial<OptionDraft>) => void
  readonly disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'icon' | 'image'>('icon')

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Opens on what the choice has: a picture shows the picture pane.
        if (next) setMode(draft.image !== null ? 'image' : 'icon')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Apparence du choix ${draft.label || ''}`.trim()}
          title="Couleur, pictogramme ou image"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent',
            !hasLook(draft) && 'border-dashed',
          )}
        >
          {hasLook(draft) ? (
            <OptionGlyph look={draft} className="size-5" />
          ) : (
            <Palette className="size-4" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 space-y-3"
        // Inside a dialog, the wheel over a portal is swallowed by the dialog's scroll lock:
        // without this the pictogram grid would not scroll.
        onWheel={(e) => e.stopPropagation()}
      >
        <ColorPane color={draft.color} onChange={(color) => onChange({ color })} />

        <div className="space-y-2">
          <fieldset className="inline-flex rounded-md border p-0.5 text-xs">
            <legend className="sr-only">Pictogramme ou image</legend>
            {(['icon', 'image'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded px-2.5 py-1 transition-colors',
                  mode === m
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'icon' ? 'Pictogramme' : 'Image'}
              </button>
            ))}
          </fieldset>

          {mode === 'icon' ? (
            <IconPane
              icon={draft.icon}
              color={draft.color}
              onChange={(icon) => onChange({ icon, image: null })}
            />
          ) : (
            <ImagePane image={draft.image} onChange={(image) => onChange({ image, icon: null })} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColorPane({
  color,
  onChange,
}: {
  readonly color: string | null
  readonly onChange: (color: string | null) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Couleur</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label="Aucune couleur"
          aria-pressed={color === null}
          onClick={() => onChange(null)}
          className="flex size-6 items-center justify-center rounded-full border text-muted-foreground aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-1"
        >
          <X className="size-3" />
        </button>
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`Couleur ${preset}`}
            aria-pressed={color === preset}
            onClick={() => onChange(preset)}
            style={{ backgroundColor: preset }}
            className="size-6 rounded-full aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-1"
          />
        ))}
        {/* Any other colour: the browser's own picker, which also takes a typed hex. */}
        <label
          title="Une autre couleur"
          className={cn(
            'relative flex size-6 cursor-pointer items-center justify-center rounded-full border text-muted-foreground',
            color !== null && !PRESET_COLORS.includes(color) && 'ring-2 ring-ring ring-offset-1',
          )}
          style={
            color !== null && !PRESET_COLORS.includes(color)
              ? { backgroundColor: color }
              : undefined
          }
        >
          <input
            type="color"
            aria-label="Choisir une autre couleur"
            value={color ?? '#6b7280'}
            onChange={(e) => onChange(normalizeHex(e.target.value))}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <Pipette className="size-3" />
        </label>
      </div>
      {color !== null && <p className="font-mono text-[11px] text-muted-foreground">{color}</p>}
    </div>
  )
}

function IconPane({
  icon,
  color,
  onChange,
}: {
  readonly icon: string | null
  readonly color: string | null
  readonly onChange: (icon: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const needle = fold(query.trim())
  const shown =
    needle === ''
      ? OPTION_ICONS
      : OPTION_ICONS.filter((i) => fold(`${i.label} ${i.name}`).includes(needle))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-md border px-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un pictogramme…"
          aria-label="Chercher un pictogramme"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="scroll-discret grid max-h-44 grid-cols-7 gap-1 overflow-y-auto">
        {shown.map(({ name, label, Icon }) => (
          <button
            key={name}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={icon === name}
            onClick={() => onChange(name)}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-ring"
          >
            <Icon
              className="size-4"
              style={icon === name && color !== null ? { color } : undefined}
            />
          </button>
        ))}
        {shown.length === 0 && (
          <p className="col-span-7 py-4 text-center text-xs text-muted-foreground">
            Aucun pictogramme.
          </p>
        )}
      </div>

      {icon !== null && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X className="size-3.5" />
          Retirer le pictogramme
        </Button>
      )}
    </div>
  )
}

function ImagePane({
  image,
  onChange,
}: {
  readonly image: string | null
  readonly onChange: (image: string | null) => void
}) {
  const file = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (picked: File | undefined) => {
    if (picked === undefined) return
    setBusy(true)
    setError(null)
    try {
      onChange(await shrinkImage(picked))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image illisible.')
    } finally {
      setBusy(false)
      // The same file can be chosen twice in a row.
      if (file.current !== null) file.current.value = ''
    }
  }

  const useUrl = () => {
    const text = url.trim()
    if (!/^https:\/\/\S+$/i.test(text)) return setError('Une adresse https://… est attendue.')
    if (text.length > MAX_IMAGE_CHARS) return setError('Adresse trop longue.')
    setError(null)
    onChange(text)
    setUrl('')
  }

  return (
    <div className="space-y-2">
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => file.current?.click()}
      >
        <ImageUp className="size-4" />
        {busy ? 'Traitement…' : 'Choisir un fichier'}
      </Button>

      <div className="flex gap-1.5">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              useUrl()
            }
          }}
          placeholder="ou une adresse https://…"
          aria-label="Adresse de l’image"
          className="h-8 text-xs"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={useUrl}
          disabled={url.trim() === ''}
        >
          Utiliser
        </Button>
      </div>

      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {image !== null && (
        <div className="flex items-center gap-2">
          <OptionGlyph look={{ image }} className="size-8" />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="size-3.5" />
            Retirer l’image
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Un fichier est réduit à 64 pixels et gardé dans le catalogue, avec le choix.
      </p>
    </div>
  )
}

// ── The same list, as JSON ───────────────────────────────────────────────────────────

function JsonPanel({
  value,
  known,
  onChange,
  disabled,
}: {
  readonly value: OptionDraft[]
  readonly known: ReadonlySet<string>
  readonly onChange: (next: OptionDraft[]) => void
  readonly disabled: boolean
}) {
  const id = useId()
  const serialized = useMemo(() => serializeOptions(value), [value])
  const [text, setText] = useState(serialized)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // What the box last handed up. A change that is only the echo of the box's own text must
  // not rewrite it under the caret; a change made in the rows must.
  const emitted = useRef(serialized)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (serialized === emitted.current) return
    emitted.current = serialized
    setText(serialized)
    setError(null)
  }, [serialized])

  const edit = (next: string) => {
    setText(next)
    // An emptied box says nothing yet: it is being retyped, not submitted.
    if (next.trim() === '') return setError(null)

    const parsed = parseOptionsJson(next, known)
    if (!parsed.ok) return setError(parsed.error)

    setError(null)
    emitted.current = serializeOptions(parsed.drafts)
    if (emitted.current !== serialized) onChange(parsed.drafts)
  }

  const copyJson = async () => {
    if (!(await copy(text))) return setError('Le presse-papiers n’est pas accessible ici.')
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          JSON
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void copyJson()}
          aria-live="polite"
          className={cn(copied && 'text-green-600 hover:text-green-600')}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
      <Textarea
        id={id}
        value={text}
        onChange={(e) => edit(e.target.value)}
        disabled={disabled}
        rows={5}
        spellCheck={false}
        aria-invalid={error !== null || undefined}
        className="max-h-56 font-mono text-xs"
      />
      {error !== null ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Collez une liste ici pour remplacer les choix. Une simple liste de textes suffit :{' '}
          <span className="font-mono">["Actif", "Inactif"]</span>.
        </p>
      )}
    </div>
  )
}
