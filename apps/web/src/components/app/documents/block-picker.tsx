'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { $t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Columns2,
  Heading,
  Image,
  ListChecks,
  type LucideIcon,
  Minus,
  MoveVertical,
  Rows3,
  SeparatorHorizontal,
  Type,
} from 'lucide-react'
import type { BlockKind } from './model'

/**
 * What a block is, once: its icon, its name, what it shows. The picker groups them; the
 * cards of the editor name them the same way.
 */

export interface BlockMeta {
  readonly kind: BlockKind
  readonly icon: LucideIcon
  readonly label: string
  readonly description: string
  readonly group: 'content' | 'data' | 'layout'
}

export function blockMetas(): readonly BlockMeta[] {
  return [
    {
      kind: 'title',
      icon: Heading,
      label: $t('Titre'),
      description: $t('Un grand titre, sobre ou sur un bandeau de couleur.'),
      group: 'content',
    },
    {
      kind: 'text',
      icon: Type,
      label: $t('Texte'),
      description: $t('Du texte mis en forme, qui cite les colonnes de la ligne.'),
      group: 'content',
    },
    {
      kind: 'image',
      icon: Image,
      label: $t('Image'),
      description: $t('Un logo, un tampon, ou la photo d’un champ image.'),
      group: 'content',
    },
    {
      kind: 'fields',
      icon: ListChecks,
      label: $t('Champs de la ligne'),
      description: $t('Libellés et valeurs, en liste, en grille ou en récapitulatif.'),
      group: 'data',
    },
    {
      kind: 'rows',
      icon: Rows3,
      label: $t('Tableau des lignes liées'),
      description: $t('Les lignes liées à celle-ci, avec leurs totaux.'),
      group: 'data',
    },
    {
      kind: 'columns',
      icon: Columns2,
      label: $t('Colonnes'),
      description: $t('Deux ou trois colonnes côte à côte, chacune avec ses blocs.'),
      group: 'layout',
    },
    {
      kind: 'divider',
      icon: Minus,
      label: $t('Séparateur||trait horizontal dans un document'),
      description: $t('Un trait horizontal, fin ou épais.'),
      group: 'layout',
    },
    {
      kind: 'spacer',
      icon: MoveVertical,
      label: $t('Espace'),
      description: $t('Un blanc vertical de la hauteur choisie.'),
      group: 'layout',
    },
    {
      kind: 'break',
      icon: SeparatorHorizontal,
      label: $t('Saut de page'),
      description: $t('La suite commence sur une nouvelle page.'),
      group: 'layout',
    },
  ]
}

export const metaOf = (kind: BlockKind) => blockMetas().find((m) => m.kind === kind) as BlockMeta

/** The blocks to add, by group, in a dialog: the whole list in sight, never cut off. */
export function BlockPicker({
  open,
  onClose,
  onPick,
  kinds,
  unavailable = {},
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onPick: (kind: BlockKind) => void
  /** The kinds offered; all when absent — a column offers fewer. */
  readonly kinds?: readonly BlockKind[]
  /** Kinds shown but not offered, with why. */
  readonly unavailable?: Partial<Record<BlockKind, string>>
}) {
  const groups = [
    { id: 'content', title: $t('Contenu') },
    { id: 'data', title: $t('Données de la ligne') },
    { id: 'layout', title: $t('Mise en page') },
  ] as const
  const metas = blockMetas().filter((m) => kinds === undefined || kinds.includes(m.kind))
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto scroll-discret sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{$t('Ajouter un bloc')}</DialogTitle>
          <DialogDescription>
            {$t('Un bloc se déplace ensuite en le glissant par sa poignée.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {groups.map((g) => {
            const listed = metas.filter((m) => m.group === g.id)
            if (listed.length === 0) return null
            return (
              <div key={g.id} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {listed.map((m) => {
                    const why = unavailable[m.kind]
                    return (
                      <button
                        key={m.kind}
                        type="button"
                        disabled={why !== undefined}
                        onClick={() => {
                          onPick(m.kind)
                          onClose()
                        }}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                          'hover:border-primary/40 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
                          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <m.icon className="size-4" />
                        </span>
                        <span className="min-w-0 space-y-0.5">
                          <span className="block text-sm font-medium">{m.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {why ?? m.description}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
