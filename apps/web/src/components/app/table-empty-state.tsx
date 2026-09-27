'use client'

import { TableIllustration } from '@/components/app/table-illustration'
import { Button } from '@/components/ui/button'
import { $t } from '@/lib/i18n'
import { Plus } from 'lucide-react'

export function TableEmptyState({
  kind = 'empty',
  onAdd,
  onFirstPage,
}: {
  readonly kind?: 'empty' | 'filtered' | 'result' | 'page'
  readonly onAdd?: () => void
  readonly onFirstPage?: () => void
}) {
  const title = {
    empty: $t('Tout commence par une première ligne.'),
    filtered: $t('Aucune ligne ne correspond.'),
    result: $t('Aucun résultat pour cette requête.'),
    page: $t('Vous avez fait le tour.'),
  }[kind]
  const description = {
    empty: onAdd
      ? $t('Votre table est prête. Ajoutez votre premier enregistrement pour lui donner vie.')
      : $t('Votre table est prête. Les enregistrements apparaîtront ici dès leur ajout.'),
    filtered: $t('Essayez une autre recherche ou ajustez vos filtres pour retrouver vos données.'),
    result: $t('La requête a été exécutée, mais elle ne renvoie aucune ligne.'),
    page: $t('Il n’y a plus de lignes sur cette page. Revenez au début pour explorer votre table.'),
  }[kind]

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6 py-8 text-center">
      <div className="w-full max-w-md">
        <TableIllustration />
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {kind === 'empty' && onAdd !== undefined && (
          <Button className="mt-5" onClick={onAdd}>
            <Plus className="size-4" />
            {$t('Ajouter la première ligne')}
          </Button>
        )}
        {kind === 'page' && onFirstPage !== undefined && (
          <Button variant="outline" className="mt-5" onClick={onFirstPage}>
            {$t('Revenir à la première page')}
          </Button>
        )}
      </div>
    </div>
  )
}
