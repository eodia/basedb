'use client'

import type { Row } from '@/components/app/grid/cell'
import { PanelField } from '@/components/app/record-panel'
import { Choice } from '@/components/ui/choice'
import type { Field, FieldDefault } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { MembersProvider } from '@/lib/members'

/**
 * What a row created without a field takes — chapter 04 §1.5. A value, today's date, the
 * instant, or the person creating the row: the kernel applies it whatever the surface —
 * screen, API, import, form, automation —, and the screens prefill it.
 */

/** The defaults each kind of field takes: the kernel's own list. */
const KINDS: Readonly<Record<string, readonly FieldDefault['kind'][]>> = {
  short_text: ['value'],
  long_text: ['value'],
  number: ['value'],
  boolean: ['value'],
  date: ['today', 'value'],
  datetime: ['now', 'value'],
  select: ['value'],
  multi_select: ['value'],
  url: ['value'],
  email: ['value'],
  user: ['me', 'value'],
}

/** A field that takes a default: of a kind that does, and not filled by the AI. */
export function acceptsDefault(field: Field): boolean {
  return (
    KINDS[field.kind] !== undefined &&
    field.ai !== true &&
    field.system !== true &&
    field.computed === undefined
  )
}

export const sameDefault = (a: FieldDefault | null, b: FieldDefault | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/** A draft that can be saved: a fixed value holds something. */
export function defaultReady(draft: FieldDefault | null): boolean {
  if (draft === null || draft.kind !== 'value') return true
  const v = draft.value
  return !(v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0))
}

const noSearch = async () => ({ options: [], truncated: false, filtered: true })

export function DefaultValueEditor({
  field,
  value,
  onChange,
  disabled,
}: {
  readonly field: Field
  readonly value: FieldDefault | null
  readonly onChange: (next: FieldDefault | null) => void
  readonly disabled?: boolean
}) {
  const kinds = KINDS[field.kind] ?? []
  const labels: Readonly<Record<FieldDefault['kind'], string>> = {
    value: $t('Une valeur fixe'),
    today: $t('La date du jour'),
    now: $t('L’instant de la création'),
    me: $t('La personne qui crée la ligne'),
  }
  // The input of the record panel, on a row of one field: the same widget as the value.
  const input = value?.kind === 'value' && (
    <div className="rounded-md border px-3 py-2">
      <PanelField
        field={{ ...field, read_only: false }}
        row={{ _id: '', [field.name]: value.value ?? null } as Row}
        onSearchLink={noSearch}
        onCommit={async (next) => onChange({ kind: 'value', value: next })}
      />
    </div>
  )
  return (
    <div className="space-y-1.5">
      <label htmlFor="edit-field-default" className="text-sm text-muted-foreground">
        {$t('Valeur par défaut')}
      </label>
      <Choice
        id="edit-field-default"
        value={value?.kind ?? 'none'}
        onValueChange={(kind) =>
          onChange(
            kind === 'none'
              ? null
              : kind === 'value'
                ? {
                    kind: 'value',
                    // An unticked box is already an answer — « non ».
                    value:
                      value?.kind === 'value'
                        ? value.value
                        : field.kind === 'boolean'
                          ? false
                          : null,
                  }
                : { kind: kind as FieldDefault['kind'] },
          )
        }
        options={[
          { value: 'none', label: $t('Aucune') },
          ...kinds.map((kind) => ({ value: kind, label: labels[kind] })),
        ]}
        aria-label={$t('Valeur par défaut')}
        disabled={disabled}
        size="default"
      />
      {field.kind === 'user' ? <MembersProvider>{input}</MembersProvider> : input}
      <p className="text-xs text-muted-foreground">
        {$t(
          'Prise par toute ligne créée sans valeur pour ce champ — depuis l’interface, l’API, un import ou un formulaire. Les lignes existantes ne changent pas.',
        )}
      </p>
    </div>
  )
}
