import { escapeLabel } from './labels.js'
import type { ProjectedBase, ProjectedField, ProjectedTable } from './projection.js'

/**
 * Readable documentation — chapter 08 §9.4.
 *
 * THIRD serialization of the same projection. Two documents rather than one, because
 * the two audiences do not ask the same thing: a client generator wants schemas, enums
 * and return codes; a human integrator wants to know what a link field is, why a
 * deletion is refused, and what awaits them if they write in direct SQL. Merging the
 * two would drown the machine contract in prose, or send the human back to a
 * specification they cannot read.
 *
 * Every label passes through `escapeLabel`: this is Markdown, and a viewer renders it.
 */

export interface DocSection {
  readonly id: string
  readonly title: string
  readonly markdown: string
}

export interface Documentation {
  readonly title: string
  readonly sections: readonly DocSection[]
}

/** How each type arrives in JSON — the normative table of §7.2, in prose. */
const TYPE_LABEL: Readonly<Record<string, string>> = {
  short_text: 'texte',
  long_text: 'texte long',
  number: 'nombre (chaîne décimale)',
  boolean: 'booléen',
  date: 'date (`2026-09-18`)',
  datetime: 'date-heure UTC (`2026-09-18T14:03:00.000Z`)',
  select: 'liste de choix',
  link: 'lien',
  formula: 'formule',
  system: 'colonne système',
}

function describeField(field: ProjectedField): string {
  const marks: string[] = []
  if (field.required) marks.push('obligatoire')
  if (field.readOnly) marks.push('lecture seule')
  if (field.unsafeHtml) marks.push('HTML riche — **à assainir à l’affichage**')

  const type = TYPE_LABEL[field.kind] ?? field.kind
  const suffix = marks.length === 0 ? '' : ` · ${marks.join(', ')}`

  if (field.link === undefined) {
    return `- \`${field.name}\` — ${escapeLabel(field.label)} · ${type}${suffix}`
  }

  // A link whose target is invisible is still described — the field exists on a table
  // the reader can read — but nothing of its target is said.
  const shownBy =
    field.link.target?.displayField === null
      ? ' (aucune colonne d’affichage désignée : la cellule montre l’identifiant)'
      : `, affiché par \`${field.link.target?.displayField}\``

  const target =
    field.link.target === undefined
      ? 'cible non visible pour vous : la cellule vaut toujours `{"id":null,"display":null,"masked":true}`'
      : `pointe vers \`${field.link.target.table}\`${shownBy}`

  const onDelete =
    field.link.onDelete === 'restrict'
      ? 'supprimer la ligne cible est refusé tant qu’elle est référencée'
      : field.link.onDelete === 'set_null'
        ? 'supprimer la ligne cible vide cette cellule'
        : 'supprimer la ligne cible supprime aussi cette ligne'

  return [
    `- \`${field.name}\` — ${escapeLabel(field.label)} · lien${suffix}`,
    `  - ${target}`,
    `  - à la suppression : ${onDelete}`,
    '  - en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture,' +
      ' toujours `{"id": …, "display": …}`',
  ].join('\n')
}

function describeTable(base: ProjectedBase, table: ProjectedTable): DocSection {
  const verbs: Readonly<Record<string, string>> = {
    read: 'lire',
    create: 'créer',
    update: 'modifier',
    delete: 'supprimer',
  }
  const allowed = table.actions.map((a) => verbs[a] ?? a).join(', ')
  const expandable = table.fields.filter((f) => f.link?.expandable === true).map((f) => f.name)

  const lines = [
    `En SQL : ${table.sql}`,
    '',
    `Vous pouvez y **${allowed}**. Les verbes absents de cette liste ne vous sont pas ouverts,`,
    'et les chemins correspondants ne sont pas décrits.',
    '',
    `URL : \`/api/v1/{tenant}/data/${base.name}/${table.name}\``,
    '',
    '### Colonnes',
    '',
    ...table.fields.filter((f) => !f.system).map(describeField),
    '',
    '### Colonnes système',
    '',
    'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la',
    'reprise incrémentale, et aucun réglage ne les masque.',
    '',
    // Listed one by one, like the others: the three serializations are compared field by
    // field (§17.1 point 4), and prose that merely alludes to them would make the
    // comparison pass while the documentation said less than the specification.
    ...table.fields.filter((f) => f.system).map(describeField),
  ]

  if (expandable.length > 0) {
    lines.push(
      '',
      '### Expansion',
      '',
      `\`?expand=${expandable.join(',')}\` — profondeur 1 sans exception.`,
      'Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant,',
      'et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.',
    )
  }

  if (table.referencedBy) {
    lines.push(
      '',
      '### Lignes référençantes',
      '',
      `\`GET /api/v1/{tenant}/data/${base.name}/${table.name}/{id}/referenced_by\` liste les lignes`,
      'qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible',
      'n’y figure pas du tout — ni bloc, ni compteur, ni mention.',
    )
  }

  return {
    id: table.name,
    title: escapeLabel(table.label),
    markdown: lines.join('\n'),
  }
}

/** Serializes a projected base as readable documentation. */
export function toDocumentation(base: ProjectedBase, tenantRef: string): Documentation {
  const relations = base.tables.flatMap((table) =>
    table.fields
      .filter((f) => f.link !== undefined)
      .map((f) =>
        f.link?.target === undefined
          ? `- \`${table.name}.${f.name}\` → une table que vous ne voyez pas`
          : `- \`${table.name}.${f.name}\` → \`${f.link.target.table}\``,
      ),
  )

  const intro: DocSection = {
    id: 'lire-cette-base',
    title: 'Lire cette base',
    markdown: [
      `Cette base s’appelle \`${base.name}\` — c’est le nom du **schéma PostgreSQL**, et`,
      'celui que vous écrivez dans vos URL. Les tables et les colonnes portent les mêmes noms',
      'ici et en SQL : il n’y a pas de table de correspondance à consulter.',
      '',
      `Toutes les routes sont préfixées de \`/api/v1/${tenantRef}\`.`,
      '',
      '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux',
      'versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.',
    ].join('\n'),
  }

  const conventions: DocSection = {
    id: 'conventions',
    title: 'Conventions',
    markdown: [
      '- **Enveloppe partout** : `{ "data": …, "included": {…}, "meta": {…} }`. Une erreur',
      '  remplace `data` par le code, les détails et l’identifiant de requête.',
      '- **Les nombres sont des chaînes décimales**, sans exception : `{"montant":"1240.00"}`.',
      '  Un flottant arrondirait silencieusement un montant.',
      '- **Une ressource invisible et une ressource inexistante répondent la même chose**,',
      '  octet pour octet. Un `404` ne vous dit jamais si l’objet existe.',
      '- **Une authentification absente répond `401`**, jamais `404` : vous devez pouvoir',
      '  vous reconnecter.',
      '- **Pagination par curseur** : suivez `meta.has_next_page` et passez `after`.',
      '  Il n’existe aucune route d’export.',
      '- Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la',
      '  résolution des libellés — et autant d’allers-retours SQL.',
    ].join('\n'),
  }

  const relationsSection: DocSection = {
    id: 'relations',
    title: 'Relations',
    markdown:
      relations.length === 0
        ? 'Aucune relation visible dans cette base.'
        : [
            'Les liens sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la',
            'base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.',
            '',
            ...relations,
          ].join('\n'),
  }

  const sql: DocSection = {
    id: 'ecrire-en-sql',
    title: 'Écrire en SQL direct',
    markdown: [
      `Ouvrez \`psql\` et écrivez \`SELECT * FROM "${base.name}"."<table>"\` : ça marche, c’est`,
      'le but du produit. Ce qui vous attend :',
      '',
      '- Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne',
      '  référencée ne se supprime pas.',
      '- Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel :',
      '  `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by`',
      '  et `_updated_by` attendent un identifiant d’utilisateur.',
      '- **Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent',
      '  les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout',
      '  ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire',
      '  que de ne rien promettre.',
    ].join('\n'),
  }

  return {
    title: `${escapeLabel(base.label)} — documentation`,
    sections: [
      intro,
      conventions,
      relationsSection,
      ...base.tables.map((t) => describeTable(base, t)),
      sql,
    ],
  }
}
