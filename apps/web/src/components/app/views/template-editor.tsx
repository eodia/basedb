'use client'

import { FieldIcon } from '@/components/app/field-icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import type { Field } from '@/lib/api/client'
import { parseTemplate, templateToLabels, templateToNames } from '@/lib/card-template'
import { $t } from '@/lib/i18n'
import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * A text with variables, written with the fields' LABELS — `{{Date de livraison}}` — and
 * handed back with their NAMES, as the view keeps it (`card-template.ts`).
 *
 * The draft is the person's own: what they type stays as typed, caret included, and only
 * what is handed out is translated. A value changed from outside — another view opened —
 * replaces the draft.
 */
export function TemplateEditor({
  id,
  value,
  onChange,
  fields,
  placeholder,
  max,
  disabled,
}: {
  readonly id: string
  /** As kept: variables by name. */
  readonly value: string
  readonly onChange: (next: string) => void
  /** What a variable may name. */
  readonly fields: readonly Field[]
  readonly placeholder?: string
  /** The bound, in characters, of what is kept. */
  readonly max?: number
  readonly disabled?: boolean
}) {
  const [draft, setDraft] = useState(() => templateToLabels(value, fields))
  const area = useRef<HTMLTextAreaElement>(null)
  /** Where the caret goes once the menu has closed: just after what was inserted. */
  const caret = useRef<number | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a value from OUTSIDE resets the draft
  useEffect(() => {
    if (templateToNames(draft, fields) !== value) setDraft(templateToLabels(value, fields))
  }, [value, fields])

  const change = (next: string) => {
    setDraft(next)
    onChange(templateToNames(next, fields))
  }

  // At the caret, or in place of the selection: where the person was writing.
  const insert = (field: Field) => {
    const box = area.current
    const token = `{{${field.label}}}`
    const start = box?.selectionStart ?? draft.length
    const end = box?.selectionEnd ?? draft.length
    change(draft.slice(0, start) + token + draft.slice(end))
    caret.current = start + token.length
  }

  // The menu hands the focus back to its button; after an insertion the person is
  // writing, so it goes back to the text, caret after the variable.
  const restore = (event: Event) => {
    const at = caret.current
    if (at === null) return
    event.preventDefault()
    caret.current = null
    requestAnimationFrame(() => {
      area.current?.focus()
      area.current?.setSelectionRange(at, at)
    })
  }

  const cited = parseTemplate(draft, fields).filter((p) => p.kind !== 'text')
  const seen = new Set<string>()
  const chips = cited.filter((p) => {
    const key = p.kind === 'field' ? p.field.name : `?${p.raw}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const length = [...templateToNames(draft, fields)].length
  const over = max !== undefined && length > max

  return (
    <div className="space-y-1.5">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled || fields.length === 0}>
              <Plus className="size-3.5" />
              {$t('Insérer un champ')}
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-72 overflow-y-auto"
            onCloseAutoFocus={restore}
          >
            {fields.map((f) => (
              <DropdownMenuItem key={f.name} onSelect={() => insert(f)}>
                <FieldIcon kind={f.kind} format={f.format?.display} />
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Textarea
        id={id}
        ref={area}
        value={draft}
        rows={3}
        disabled={disabled}
        onChange={(e) => change(e.target.value)}
        placeholder={placeholder}
        aria-invalid={over || undefined}
        className="text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {chips.map((part) =>
          part.kind === 'field' ? (
            <span
              key={part.field.name}
              className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"
            >
              <FieldIcon
                kind={part.field.kind}
                format={part.field.format?.display}
                className="size-3"
              />
              {part.field.label}
            </span>
          ) : part.kind === 'unknown' ? (
            <Hint
              key={`?${part.raw}`}
              label={$t('Aucun champ lisible de la table ne porte ce nom')}
            >
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
                {$t('{raw} — inconnu', { raw: part.raw })}
              </span>
            </Hint>
          ) : null,
        )}
        {max !== undefined && (
          <span className={over ? 'ml-auto text-destructive' : 'ml-auto text-muted-foreground'}>
            {length} / {max}
          </span>
        )}
      </div>
    </div>
  )
}
