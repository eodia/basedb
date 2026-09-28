'use client'

import type { Upload } from '@/components/app/files'
import { FormFill } from '@/components/app/forms/form-fill'
import type { SearchLink } from '@/components/app/pickers'
import { Unavailable } from '@/components/app/views/kanban-view'
import { Button } from '@/components/ui/button'
import { type Field, type LinkOption, type Table, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import type { FormSpec } from '@/lib/views'
import { Share2 } from 'lucide-react'

/**
 * The form and the survey — a row asked for, rather than shown (ch. 11 §1.4). The screen
 * itself is `FormFill` (components/app/forms), the same in the application and through a
 * shared link; here it writes with the reader's own rights.
 *
 * A question is required when the view says so, or when the field itself is: a form cannot
 * make a required column optional, since the database would refuse the row anyway.
 */

/**
 * The form as the application shows it, to whoever may add rows to its table — and, to
 * whoever builds it, the way to share it (chapter 15).
 */
export function FormView({
  kind,
  table,
  fields,
  spec,
  viewLabel,
  linkOptions,
  onSearchLink,
  onUpload,
  onCreated,
  onShare,
}: {
  readonly kind: 'form' | 'survey'
  readonly table: Table
  readonly fields: readonly Field[]
  readonly spec: FormSpec
  readonly viewLabel: string
  readonly linkOptions: Readonly<Record<string, readonly LinkOption[]>>
  readonly onSearchLink: SearchLink
  readonly onUpload?: Upload
  /** A row was written: the other views of the table have one more. */
  readonly onCreated: () => void
  /** Opens the sharing of this form — offered to whoever builds the table. */
  readonly onShare?: () => void
}) {
  const share =
    onShare === undefined ? null : (
      <div className="absolute top-3 right-4 z-30">
        <Button variant="outline" size="sm" onClick={onShare} className="bg-background shadow-sm">
          <Share2 className="size-4" />
          {$t('Partager')}
        </Button>
      </div>
    )
  if (!table.actions.includes('create')) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        {share}
        <Unavailable>
          {$t(
            'Vous ne pouvez pas ajouter de lignes à « {label} » : ce formulaire ne vous est pas ouvert.',
            { label: table.label },
          )}
        </Unavailable>
      </div>
    )
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {share}
      <FormFill
        kind={kind}
        fields={fields}
        spec={spec}
        viewLabel={viewLabel}
        tableColor={table.color}
        linkOptions={linkOptions}
        onSearchLink={onSearchLink}
        onUpload={onUpload}
        submit={async (values) => {
          await api.createRecord(table, values)
        }}
        onSent={onCreated}
      />
    </div>
  )
}
