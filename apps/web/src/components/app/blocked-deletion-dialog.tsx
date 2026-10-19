'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type ReferencedBlock, type Table, api } from '@/lib/api/client'
import { $t, $tp } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ExternalLink, Link2 } from 'lucide-react'

/**
 * Rows that cannot be deleted, said BEFORE anything is — chapter 04 §4.1.
 *
 * A relation whose rule is « interdire » (`restrict`) refuses to delete a row other rows
 * still point to: the database holds that, and a deletion tried anyway would stop at the
 * first such row, half done, with a sentence that names neither the row nor what cites it.
 * So the rows are asked about first, and this dialog says which ones are cited, by what,
 * and opens each citing row in one click — the remedy is there: change it, or delete it
 * first. The rows nothing holds may still go, together.
 *
 * A relation that empties itself (`set_null`) or follows the deletion (`cascade`) does not
 * stand in the way, and is not listed.
 */

/** A row the deletion would be refused for, and what holds it. */
export interface BlockedRow {
  readonly id: string
  readonly label: string
  readonly blocks: readonly ReferencedBlock[]
}

export interface BlockedDeletion {
  readonly rows: readonly BlockedRow[]
  /** The rows of the same gesture nothing holds — they may be deleted on their own. */
  readonly free: readonly string[]
}

/** How many rows are asked about at once: enough to be quick, not a flood of requests. */
const AT_ONCE = 8

/**
 * The rows among `ids` that a `restrict` relation holds, with the blocks that hold them.
 * `labelOf` names a row as the grid shows it.
 */
export async function blockedRows(
  table: Table,
  tables: readonly Table[],
  ids: readonly string[],
  labelOf: (id: string) => string,
): Promise<BlockedRow[]> {
  // Only the relations aiming here that forbid deleting a cited row. One whose rule is
  // unknown — a table the reader does not see in full — is kept: better said than missed.
  const forbids = (block: ReferencedBlock) => {
    const source = tables.find((t) => t.name === block.table)
    const field = source?.fields.find((f) => f.name === block.field)
    const rule = field?.link?.on_delete
    return rule === undefined || rule === 'restrict'
  }
  const found: BlockedRow[] = []
  for (let i = 0; i < ids.length; i += AT_ONCE) {
    const slice = ids.slice(i, i + AT_ONCE)
    const answers = await Promise.all(
      slice.map((id) =>
        api
          .referencedBy(table, id)
          .then((blocks) => blocks.filter((b) => b.count > 0 && forbids(b)))
          // A row whose references cannot be read is tried as it is: the deletion's own
          // refusal, if any, still reaches the screen.
          .catch(() => [] as ReferencedBlock[]),
      ),
    )
    answers.forEach((blocks, index) => {
      const id = slice[index]
      if (id !== undefined && blocks.length > 0) found.push({ id, label: labelOf(id), blocks })
    })
  }
  return found
}

/** At most this many rows are detailed: past it, the list says how many more. */
const SHOWN = 5

export function BlockedDeletionDialog({
  blocked,
  busy,
  onClose,
  onFollow,
  onDeleteFree,
}: {
  readonly blocked: BlockedDeletion | null
  readonly busy: boolean
  readonly onClose: () => void
  /** Opens a citing row — the place to undo the link. */
  readonly onFollow: (table: string, id: string) => void
  /** Deletes the rows nothing holds. */
  readonly onDeleteFree: () => void
}) {
  const rows = blocked?.rows ?? []
  const single = rows.length === 1 ? rows[0] : undefined
  const free = blocked?.free.length ?? 0

  return (
    <Dialog open={blocked !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {single !== undefined
              ? $t('« {label} » est encore citée', { label: single.label })
              : $tp(
                  rows.length,
                  '{count} ligne est encore citée',
                  '{count} lignes sont encore citées',
                )}
          </DialogTitle>
          <DialogDescription>
            {$t(
              'D’autres lignes y sont liées par une relation qui interdit de supprimer une ligne encore citée. Retirez ce lien dans ces lignes, ou supprimez-les d’abord.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {rows.slice(0, SHOWN).map((row) => (
            <div key={row.id} className="space-y-2">
              {single === undefined && <p className="text-sm font-medium">{row.label}</p>}
              {row.blocks.map((block) => (
                <div key={`${block.table}.${block.field}`}>
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link2 className="size-3" />
                    {block.label} ·{' '}
                    {$tp(block.count, '{count} ligne la cite', '{count} lignes la citent')}
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    {block.rows.map((citing, index) => (
                      // No tooltip: the dialog puts the focus on the first row, and a hint
                      // opened by that focus would cover the text above it.
                      <button
                        key={citing.id}
                        type="button"
                        aria-label={$t('Ouvrir la fiche')}
                        onClick={() => onFollow(block.table, citing.id)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60',
                          index > 0 && 'border-t',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-primary">
                          {citing.display ?? citing.id.slice(0, 8)}
                        </span>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                  {block.capped && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {$t('Plus de {count} lignes.', { count: block.count })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))}
          {rows.length > SHOWN && (
            <p className="text-sm text-muted-foreground">
              {$tp(
                rows.length - SHOWN,
                'Et {count} autre ligne dans le même cas.',
                'Et {count} autres lignes dans le même cas.',
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant={free > 0 ? 'ghost' : 'default'} onClick={onClose} disabled={busy}>
            {free > 0 ? $t('Annuler') : $t('Compris')}
          </Button>
          {free > 0 && (
            <Button variant="destructive" onClick={onDeleteFree} disabled={busy}>
              {$tp(free, 'Supprimer la ligne non citée', 'Supprimer les {count} lignes non citées')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
