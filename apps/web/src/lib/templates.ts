import { $t, $tp } from '@/lib/i18n'
import type { TemplateApplyReport, TemplateStep } from '@basedb/contracts'

/**
 * Base templates as the interface shows their building — chapter 20 §4. The building itself
 * is the server's, in one operation (`api.createBaseFromTemplate`): the whole base or none.
 * What remains here is saying it — each step as it starts, and what was built otherwise than
 * the template said.
 */

export { aiFieldsOf } from '@basedb/contracts'

/** A step of the building, in the reader's words. */
export function stepText(step: TemplateStep): string {
  switch (step.kind) {
    case 'table':
      return $t('Table « {label} » ({value}/{tablesCount})…', {
        label: step.label,
        value: step.index,
        tablesCount: step.count,
      })
    case 'fields':
      return $t('Champs de « {label} »…', { label: step.table })
    case 'ai_field':
      return $t('Champ IA « {label} »…', { label: step.label })
    case 'link':
      return $t('Relation « {label} »…', { label: step.label })
    case 'computed':
      return $t('Champ calculé « {label} »…', { label: step.label })
    case 'rows':
      return $t('Lignes d’exemple de « {label} »…', { label: step.table })
    case 'row_links':
      return $t('Relations entre les lignes…')
    case 'automation':
      return $t('Automatisation « {label} »…', { label: step.label })
    case 'button':
      return $t('Bouton « {label} »…', { label: step.label })
    case 'view':
      return $t('Vue « {label} »…', { label: step.label })
    case 'dashboard':
      return $t('Tableau de bord « {label} »…', { label: step.label })
  }
}

/** What was built otherwise than the template said, in sentences. */
export function warningsOf(report: TemplateApplyReport, aiConsent: boolean): string[] {
  const warnings: string[] = []
  const degraded = report.aiDegraded
  if (degraded > 0) {
    warnings.push(
      aiConsent
        ? report.sampled
          ? $tp(
              degraded,
              'L’IA n’est pas configurée : {count} champ IA créé comme un champ ordinaire, avec ses valeurs d’exemple.',
              'L’IA n’est pas configurée : {count} champs IA créés comme des champs ordinaires, avec leurs valeurs d’exemple.',
            )
          : $tp(
              degraded,
              'L’IA n’est pas configurée : {count} champ IA créé comme un champ ordinaire.',
              'L’IA n’est pas configurée : {count} champs IA créés comme des champs ordinaires.',
            )
        : report.sampled
          ? $tp(
              degraded,
              'Sans votre accord, {count} champ IA a été créé comme un champ ordinaire, avec ses valeurs d’exemple.',
              'Sans votre accord, {count} champs IA ont été créés comme des champs ordinaires, avec leurs valeurs d’exemple.',
            )
          : $tp(
              degraded,
              'Sans votre accord, {count} champ IA a été créé comme un champ ordinaire.',
              'Sans votre accord, {count} champs IA ont été créés comme des champs ordinaires.',
            ),
    )
  }
  for (const label of report.notRequired) {
    warnings.push($t('« {label} » n’a pas pu être rendu obligatoire.', { label }))
  }
  return warnings
}
