'use client'

import { LookButton } from '@/components/app/look-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { copy } from '@/lib/export'
import { $t } from '@/lib/i18n'
import {
  type OptionDraft,
  emptyDraft,
  parseOptionsJson,
  serializeOptions,
  valuesOf,
} from '@/lib/options'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, ChevronUp, Copy, Lock, Plus, Trash2 } from 'lucide-react'
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
          {$t('Aucun choix. Ajoutez-en un, ou collez une liste JSON plus bas.')}
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
                  aria-label={$t('Monter ce choix')}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={$t('Descendre ce choix')}
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                  className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>

              <LookButton
                look={draft}
                label={$t('Apparence du choix {value}', { value: draft.label || '' }).trim()}
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
                  placeholder={$t('Libellé du choix')}
                  aria-label={$t('Libellé du choix {value}', { value: index + 1 })}
                  disabled={disabled}
                  className="h-8"
                />
                <p
                  className="mt-0.5 flex items-center gap-1 truncate px-1 font-mono text-[11px] text-muted-foreground"
                  title={
                    draft.locked
                      ? $t('Valeur enregistrée (non modifiable)')
                      : $t('Valeur enregistrée, dérivée du libellé')
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
                aria-label={$t('Retirer le choix {value}', { value: draft.label || index + 1 })}
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
        {$t('Ajouter un choix')}
      </Button>

      <JsonPanel value={value} known={known} onChange={onChange} disabled={disabled} />
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
    if (!(await copy(text))) return setError($t('Le presse-papiers n’est pas accessible ici.'))
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {$t('JSON')}
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
          {copied ? $t('Copié') : $t('Copier')}
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
          {$t('Exemple :')} <span className="font-mono">["Actif", "Inactif"]</span>
        </p>
      )}
    </div>
  )
}
