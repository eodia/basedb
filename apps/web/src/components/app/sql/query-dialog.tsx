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
import { type QueryAudience, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { Database, Lock, type LucideIcon, Users } from 'lucide-react'
import { useState } from 'react'

/**
 * Who sees a question written in SQL — a query, as the navigation lists it (chapter 11 §1.7).
 *
 * A saved query is a SQL question: it is saved, renamed and shared by the dialog of the
 * questions (`analytics/question-dialog.tsx`), whose three audiences are these. What they
 * share is the TEXT. Whoever opens a query runs it with their own rights, so sharing one with
 * a group never shows its members what its author reads and they do not. Sharing is building
 * the base: offered to whoever manages it, the server deciding anyway.
 */

export const AUDIENCES: ReadonlyArray<{
  readonly value: QueryAudience
  readonly icon: LucideIcon
  readonly title: string
  readonly text: string
}> = [
  {
    value: 'personal',
    icon: Lock,
    title: $t('Personnelle'),
    text: $t('Vous seul la voyez.'),
  },
  {
    value: 'base',
    icon: Database,
    title: $t('Toute la base'),
    text: $t('Quiconque lit la base la voit.'),
  },
  {
    value: 'groups',
    icon: Users,
    title: $t('Des groupes'),
    text: $t('Les membres des groupes choisis.'),
  },
]

/** The icon an audience is shown with, in the navigation and in a tab. */
export const audienceIcon = (audience: QueryAudience): LucideIcon =>
  AUDIENCES.find((a) => a.value === audience)?.icon ?? Lock

/**
 * « Supprimer », from a query's menu in the navigation: asked once, then gone for whoever saw
 * it. A tab that shows it keeps its text, as a question not saved.
 */
export function DeleteQueryDialog({
  base,
  query,
  onClose,
  onDeleted,
}: {
  /** The base's name. */
  readonly base: string
  readonly query: { readonly id: string; readonly label: string; readonly audience: QueryAudience }
  readonly onClose: () => void
  readonly onDeleted: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteQuestion(base, query.id)
      onDeleted(query.id)
      onClose()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {$t('Supprimer la requête « {label} » ?', { label: query.label })}
          </DialogTitle>
          <DialogDescription>
            {query.audience === 'personal'
              ? $t('Elle disparaît de vos requêtes. Un onglet qui la montre garde son texte.')
              : $t(
                  'Elle disparaît pour tous ceux qui la voient. Un onglet qui la montre garde son texte.',
                )}
          </DialogDescription>
        </DialogHeader>
        {error !== null && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {$t('Annuler')}
          </Button>
          <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
            {busy ? $t('Suppression…') : $t('Supprimer la requête')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
