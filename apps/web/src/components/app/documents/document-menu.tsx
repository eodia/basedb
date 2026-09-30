'use client'

import { DocumentTemplatesDialog } from '@/components/app/documents/templates-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Hint } from '@/components/ui/tooltip'
import { type DocumentTemplate, type Table, api } from '@/lib/api/client'
import { $t } from '@/lib/i18n'
import { messageFor } from '@/lib/messages'
import { FileText, Loader2, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

/**
 * « Document », on a row's sheet — chapter 21: the row as a PDF, with one of its table's
 * templates or as its sheet, every field the reader reads. Opened in a tab of its own,
 * where the browser's viewer prints it or saves it. Whoever builds the table also finds
 * the templates' editor here, a row at hand to preview them on.
 */

export function DocumentMenu({
  table,
  recordId,
  tables,
  builds,
}: {
  readonly table: Table
  readonly recordId: string
  /** The base's tables: a table block lists the rows of another one. */
  readonly tables: readonly Table[]
  /** Building the base (`manage_schema`): the templates' editor is offered. */
  readonly builds: boolean
}) {
  const [templates, setTemplates] = useState<readonly DocumentTemplate[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const load = () => {
    api.documentTemplates(table).then(setTemplates, () => setTemplates([]))
  }

  const open = async (template: string) => {
    // The tab is opened on the click itself: opened after the wait, a browser would take
    // it for a pop-up and block it.
    const tab = window.open('', '_blank')
    setBusy(template)
    try {
      const blob = await api.documentPdf(table, recordId, template)
      const url = URL.createObjectURL(blob)
      if (tab !== null) tab.location.href = url
      else window.location.assign(url)
      // The tab has what it needs; the address is let go once it surely has.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      tab?.close()
      toast.error(messageFor(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <DropdownMenu onOpenChange={(o) => o && load()}>
        <Hint label={$t('Document PDF')}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={$t('Document PDF')}>
              {busy !== null ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {$t('Ouvrir en PDF')}
          </DropdownMenuLabel>
          {templates === null ? (
            <DropdownMenuItem disabled>
              <Loader2 className="size-4 animate-spin" />
              {$t('Chargement…')}
            </DropdownMenuItem>
          ) : (
            templates.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => void open(t.id)}>
                <FileText className="size-4" />
                <span className="truncate">{t.label}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuItem onSelect={() => void open('fiche')}>
            <FileText className="size-4 text-muted-foreground" />
            {$t('Fiche : tous les champs')}
          </DropdownMenuItem>
          {builds && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Settings2 className="size-4" />
                {$t('Modèles de document…')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {builds && (
        <DocumentTemplatesDialog
          open={editing}
          table={table}
          tables={tables}
          recordId={recordId}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
