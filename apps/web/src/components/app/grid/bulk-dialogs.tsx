'use client'

import type { SearchLink } from '@/components/app/pickers'
import { PanelField, writeValues } from '@/components/app/record-panel'
import { Button } from '@/components/ui/button'
import { Choice } from '@/components/ui/choice'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { Field, LinkOption } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { useRef, useState } from 'react'

/**
 * The two questions a bulk edit may ask — chapter 11 §2.4.
 *
 * « Modifier un champ » is the editor of a field's value, for the rows ticked or the cells
 * selected; it is the very editor of the record's panel, so that every type — a choice, a
 * person, a date, several rows of another table — is chosen as it is anywhere else.
 * « Coller au-delà de la dernière ligne » is asked once, because creating rows is a
 * decision the person did not make by pasting.
 */

export interface FieldEdit {
  /** The field to write, or `null` to let the person choose among `fields`. */
  readonly fixed: Field | null
  /** What is written to: rows ticked, or cells selected. */
  readonly unit: 'rows' | 'cells'
  readonly count: number
}

/** Nothing typed, nothing chosen: the value that a field emptied would be. */
const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

export function FieldEditDialog({
  edit,
  fields,
  linkOptions,
  onSearchLink,
  busy,
  onApply,
  onClose,
}: {
  readonly edit: FieldEdit | null
  /** The fields that can be written, for the person to choose from. */
  readonly fields: readonly Field[]
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly busy: boolean
  /** `value` is what the API takes; `null` empties the field. */
  readonly onApply: (field: Field, value: unknown) => Promise<void>
  readonly onClose: () => void
}) {
  return (
    <Dialog open={edit !== null} onOpenChange={(open) => !open && onClose()}>
      {edit !== null && (
        <FieldEditBody
          edit={edit}
          fields={fields}
          linkOptions={linkOptions}
          onSearchLink={onSearchLink}
          busy={busy}
          onApply={onApply}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

function FieldEditBody({
  edit,
  fields,
  linkOptions,
  onSearchLink,
  busy,
  onApply,
  onClose,
}: {
  readonly edit: FieldEdit
  readonly fields: readonly Field[]
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly busy: boolean
  readonly onApply: (field: Field, value: unknown) => Promise<void>
  readonly onClose: () => void
}) {
  const [name, setName] = useState<string | null>(edit.fixed?.name ?? null)
  const field = edit.fixed ?? fields.find((f) => f.name === name) ?? null
  // What the editor last committed, kept in a ref as well: a text commits when it loses the
  // focus, which is the very click on « Appliquer », and the handler must see what it wrote.
  // A checkbox has two answers: it starts on « non », so that « non » can be applied.
  const start = edit.fixed?.kind === 'boolean' ? false : null
  const [draft, setDraft] = useState<unknown>(start)
  const latest = useRef<unknown>(start)
  const [problem, setProblem] = useState<string | null>(null)

  const choose = (next: string) => {
    setName(next)
    const chosen = fields.find((f) => f.name === next)
    const first = chosen?.kind === 'boolean' ? false : null
    latest.current = first
    setDraft(first)
    setProblem(null)
  }

  const apply = async (empty: boolean) => {
    if (field === null) return
    const written = empty
      ? null
      : (writeValues([field], { _id: '', [field.name]: latest.current })[field.name] ?? null)
    if (!empty && isEmpty(written)) {
      setProblem($t('Choisissez une valeur, ou videz le champ.'))
      return
    }
    await onApply(field, written)
  }

  const target =
    edit.unit === 'rows'
      ? $tp(
          edit.count,
          'La valeur remplacera celle de {count} ligne sélectionnée.',
          'La valeur remplacera celle de {count} lignes sélectionnées.',
        )
      : $tp(
          edit.count,
          'La valeur sera écrite dans {count} cellule sélectionnée.',
          'La valeur sera écrite dans {count} cellules sélectionnées.',
        )

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{$t('Modifier un champ')}</DialogTitle>
        <DialogDescription>{target}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {edit.fixed === null ? (
          <div className="space-y-1.5">
            <Label htmlFor="bulk-field">{$t('Champ')}</Label>
            <Choice
              id="bulk-field"
              value={name}
              onValueChange={choose}
              options={fields.map((f) => ({ value: f.name, label: f.label }))}
              placeholder={$t('Choisir un champ…')}
              aria-label={$t('Champ')}
              size="default"
              className="w-full"
              searchPlaceholder={$t('Rechercher un champ…')}
            />
          </div>
        ) : (
          <p className="text-sm font-medium">{edit.fixed.label}</p>
        )}

        {field !== null && (
          <div className="space-y-1.5">
            <Label>{$t('Valeur')}</Label>
            <PanelField
              // Another field is another editor: nothing typed for one is kept for the next.
              key={field.name}
              field={field}
              row={{ _id: '', [field.name]: draft }}
              options={linkOptions[field.name]}
              onSearchLink={onSearchLink}
              onCommit={async (value) => {
                latest.current = value
                setDraft(value)
                setProblem(null)
              }}
            />
          </div>
        )}

        {problem !== null && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {problem}
          </p>
        )}
      </div>

      <DialogFooter className="flex-wrap">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {$t('Annuler')}
        </Button>
        {field !== null && field.required !== true && (
          <Button variant="outline" onClick={() => void apply(true)} disabled={busy}>
            {$t('Vider le champ')}
          </Button>
        )}
        <Button onClick={() => void apply(false)} disabled={busy || field === null}>
          {busy ? $t('Modification…') : $t('Appliquer')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** What the person decides about the rows a paste would add. */
export type CreationAnswer = 'create' | 'skip' | 'cancel'

export function CreateRowsDialog({
  count,
  onAnswer,
}: {
  /** Rows past the last, or `null` while nothing is asked. */
  readonly count: number | null
  readonly onAnswer: (answer: CreationAnswer) => void
}) {
  return (
    <Dialog open={count !== null} onOpenChange={(open) => !open && onAnswer('cancel')}>
      {count !== null && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{$t('Le collage dépasse la dernière ligne')}</DialogTitle>
            <DialogDescription>
              {$tp(
                count,
                'Il déborde de {count} ligne sous la dernière du tableau. La créer avec les valeurs collées ?',
                'Il déborde de {count} lignes sous la dernière du tableau. Les créer avec les valeurs collées ?',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap">
            <Button variant="ghost" onClick={() => onAnswer('cancel')}>
              {$t('Annuler')}
            </Button>
            <Button variant="outline" onClick={() => onAnswer('skip')}>
              {$t('Ne pas créer de lignes')}
            </Button>
            <Button onClick={() => onAnswer('create')}>
              {$tp(count, 'Créer {count} ligne', 'Créer {count} lignes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
