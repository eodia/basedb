import { escapeLabel } from './labels.js'
import type { ProjectedBase, ProjectedField, ProjectedTable } from './projection.js'

/**
 * OpenAPI 3.1 serialization — chapter 08 §9.
 *
 * SECOND serialization of the projection, never a second source. It reads the tree
 * `projectBase` produced and adds nothing to it: a specification that filtered by its
 * own means would, sooner or later, filter differently from `/meta` — and the looser of
 * the two would become the leak. §17.1 point 4 turns that into a test: the set of
 * tables, fields and link targets described by the three serializations must be
 * rigorously equal.
 *
 * Produced on demand, in memory. Never stored: a stored specification is a specification
 * that drifts, and the day a migration forgets to refresh it, the API and its contract
 * contradict each other (§9.2).
 */

/** A JSON Schema fragment. Deliberately loose: what matters is what goes INTO it. */
type Schema = Record<string, unknown>

/** `factures` → `Factures`. Table names are unique per base, so no collision. */
function schemaName(name: string): string {
  return name
    .split('_')
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * The read shape of a link — ALWAYS an object, never a bare identifier (§5.2).
 *
 * The asymmetry with the write shape is deliberate and described by two distinct
 * schemas: a caller writes a uuid, and reads `{id, display}`.
 */
function linkReadSchema(field: ProjectedField): Schema {
  const link = field.link
  const schema: Schema = {
    type: 'object',
    properties: {
      // Invisible target: `id` is described as ALWAYS null, exactly the §5.5 shape.
      id: link?.masked === true ? { type: 'null' } : { type: ['string', 'null'], format: 'uuid' },
      display: { type: ['string', 'null'] },
      masked: { type: 'boolean' },
    },
    required: ['id', 'display'],
  }

  // `x-basedb-link` is REDUCED when the target is invisible: no table name, no display
  // column. What remains belongs to the readable table itself — its own constraint.
  schema['x-basedb-link'] =
    link === undefined
      ? undefined
      : link.target === undefined
        ? { on_delete: link.onDelete, is_required: link.required }
        : {
            target_table: link.target.table,
            target_display_field: link.target.displayField,
            on_delete: link.onDelete,
            is_required: link.required,
            target_schema: { $ref: `#/components/schemas/${schemaName(link.target.table)}Read` },
          }

  return schema
}

/** JSON representation of each type — the normative table of §7.2. */
function scalarSchema(field: ProjectedField): Schema {
  const nullable = !field.required
  const of = (type: string, format?: string): Schema => ({
    type: nullable ? [type, 'null'] : type,
    ...(format === undefined ? {} : { format }),
  })

  switch (field.kind) {
    case 'number':
      // A decimal STRING, without exception: a float would silently round an amount,
      // and the column is `numeric`.
      return of('string', 'decimal')
    case 'boolean':
      return of('boolean')
    case 'date':
      return of('string', 'date')
    case 'datetime':
      return of('string', 'date-time')
    case 'system':
      return field.name === '_id' || field.name.endsWith('_by')
        ? { type: 'string', format: 'uuid' }
        : { type: 'string', format: 'date-time' }
    case 'formula':
      // The result type depends on the expression; describing it as a fixed type would
      // be a lie a client could act on.
      return {}
    default:
      return of('string')
  }
}

function fieldSchema(field: ProjectedField): Schema {
  const schema = field.kind === 'link' ? linkReadSchema(field) : scalarSchema(field)
  return {
    ...schema,
    // The choices are a CHECK in the database, so they belong in the contract: a
    // generated client that offers anything else offers a value that will be refused.
    ...(field.options === undefined ? {} : { enum: field.options.map((o) => o.value) }),
    title: escapeLabel(field.label),
    ...(field.readOnly ? { readOnly: true } : {}),
    // The API does not re-sanitize on read: the contract is that the consumer does it
    // at render time, so the specification has to say which fields are concerned.
    ...(field.unsafeHtml ? { 'x-basedb-unsafe-html': true } : {}),
  }
}

/** Read schema: every field the reader can see, system columns included. */
function readSchema(table: ProjectedTable): Schema {
  const properties: Record<string, Schema> = {}
  for (const field of table.fields) properties[field.name] = fieldSchema(field)
  return {
    type: 'object',
    title: escapeLabel(table.label),
    properties,
  }
}

/**
 * Write schema: only what the reader can write.
 *
 * A link accepts a bare uuid, `null`, or `{"id": "<uuid>"}` — three forms, because an
 * integration holding an identifier should not have to wrap it.
 */
function writeSchema(table: ProjectedTable): Schema {
  const properties: Record<string, Schema> = {}
  const required: string[] = []

  for (const field of table.fields) {
    if (field.readOnly) continue

    properties[field.name] =
      field.kind === 'link'
        ? {
            title: escapeLabel(field.label),
            oneOf: [
              { type: 'string', format: 'uuid' },
              { type: 'null' },
              { type: 'object', properties: { id: { type: ['string', 'null'], format: 'uuid' } } },
            ],
          }
        : fieldSchema(field)

    if (field.required) required.push(field.name)
  }

  return {
    type: 'object',
    title: `${escapeLabel(table.label)} (écriture)`,
    properties,
    ...(required.length === 0 ? {} : { required }),
  }
}

/** The enveloped response of §7.1: `{data, included, meta}`. */
function listResponse(table: ProjectedTable, expandable: readonly string[]): Schema {
  const name = schemaName(table.name)
  return {
    type: 'object',
    properties: {
      data: { type: 'array', items: { $ref: `#/components/schemas/${name}Read` } },
      // `included` is described only when there is something to expand: announcing an
      // empty annex section would suggest an expansion the enum does not offer.
      ...(expandable.length === 0
        ? {}
        : {
            included: {
              type: 'object',
              description:
                'Objets liés, indexés par nom de table puis par identifiant. ' +
                'Un objet y figure une seule fois, quel que soit le nombre de lignes qui le référencent.',
            },
          }),
      meta: {
        type: 'object',
        properties: {
          columns: { type: 'array', items: { type: 'string' } },
          has_next_page: { type: 'boolean' },
        },
      },
    },
  }
}

const ERROR_RESPONSE: Schema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    details: { type: 'object' },
    request_id: { type: 'string' },
  },
}

/** Refusals every route can produce, for the reasons chapter 08 §6 fixes. */
function commonResponses(): Record<string, unknown> {
  const error = { content: { 'application/json': { schema: ERROR_RESPONSE } } }
  return {
    '401': { description: 'Authentification absente ou refusée.', ...error },
    '404': {
      description:
        'Ressource inexistante OU invisible — les deux réponses sont identiques, octet pour octet.',
      ...error,
    },
  }
}

/**
 * Serializes a projected base as an OpenAPI 3.1 document.
 *
 * `tenantRef` enters the server URL: the tenant is in every path (§1.2), and a
 * specification whose paths cannot be called as printed is worth nothing.
 */
export function toOpenApi(base: ProjectedBase, tenantRef: string): Record<string, unknown> {
  const paths: Record<string, unknown> = {}
  const schemas: Record<string, unknown> = {}

  for (const table of base.tables) {
    const name = schemaName(table.name)
    const expandable = table.fields.filter((f) => f.link?.expandable === true).map((f) => f.name)
    // Unreadable fields are absent from the description, hence from every enum: there
    // is one single list, so they cannot drift apart.
    const sortable = table.fields.filter((f) => f.kind !== 'link').map((f) => f.name)

    schemas[`${name}Read`] = readSchema(table)
    if (table.actions.includes('create') || table.actions.includes('update')) {
      schemas[`${name}Write`] = writeSchema(table)
    }

    const collection: Record<string, unknown> = {}
    const item: Record<string, unknown> = {}

    if (table.actions.includes('read')) {
      collection.get = {
        summary: `Lister ${escapeLabel(table.label)}`,
        parameters: [
          {
            name: 'filter',
            in: 'query',
            schema: { type: 'string' },
            description: 'Expression de filtrage — voir la documentation lisible.',
          },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: sortable } },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 200 } },
          { name: 'after', in: 'query', schema: { type: 'string' } },
          {
            name: 'links',
            in: 'query',
            schema: { type: 'string', enum: ['display', 'id'] },
            description:
              '`id` supprime la résolution des libellés : recommandé pour les intégrations.',
          },
          ...(expandable.length === 0
            ? []
            : [
                {
                  name: 'expand',
                  in: 'query',
                  schema: { type: 'string', enum: expandable },
                  description: 'Profondeur 1 sans exception. Les objets arrivent dans `included`.',
                },
              ]),
        ],
        responses: {
          '200': {
            description: 'Page de résultats.',
            content: { 'application/json': { schema: listResponse(table, expandable) } },
          },
          ...commonResponses(),
        },
      }
      item.get = {
        summary: `Lire une ligne de ${escapeLabel(table.label)}`,
        responses: {
          '200': {
            description: 'La ligne.',
            content: {
              'application/json': { schema: { $ref: `#/components/schemas/${name}Read` } },
            },
          },
          ...commonResponses(),
        },
      }
    }

    if (table.actions.includes('create')) {
      collection.post = {
        summary: `Créer dans ${escapeLabel(table.label)}`,
        requestBody: {
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${name}Write` } },
          },
        },
        responses: { '201': { description: 'Ligne créée.' }, ...commonResponses() },
      }
    }

    if (table.actions.includes('update')) {
      item.patch = {
        summary: `Modifier une ligne de ${escapeLabel(table.label)}`,
        requestBody: {
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${name}Write` } },
          },
        },
        responses: { '200': { description: 'Ligne modifiée.' }, ...commonResponses() },
      }
    }

    if (table.actions.includes('delete')) {
      item.delete = {
        summary: `Supprimer une ligne de ${escapeLabel(table.label)}`,
        responses: {
          '204': { description: 'Supprimée.' },
          '409': {
            description: 'Ligne encore référencée — seules les tables visibles sont nommées.',
            content: { 'application/json': { schema: ERROR_RESPONSE } },
          },
          ...commonResponses(),
        },
      }
    }

    const root = `/data/${base.name}/${table.name}`
    if (Object.keys(collection).length > 0) paths[root] = collection
    if (Object.keys(item).length > 0) {
      paths[`${root}/{id}`] = {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        ...item,
      }
    }

    // Described ONLY when at least one inverse group is visible: the path would
    // otherwise answer an empty list, and that emptiness would itself say something.
    if (table.referencedBy && table.actions.includes('read')) {
      paths[`${root}/{id}/referenced_by`] = {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        get: {
          summary: `Lignes référençant une ligne de ${escapeLabel(table.label)}`,
          responses: { '200': { description: 'Blocs de liens inverses.' }, ...commonResponses() },
        },
      }
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${escapeLabel(base.label)} — basedb`,
      version: '1',
      description:
        'Cette spécification décrit ce que VOUS pouvez voir : deux lecteurs en obtiennent ' +
        'deux versions différentes. Elle ne doit donc jamais être publiée telle quelle.',
    },
    servers: [{ url: `/api/v1/${tenantRef}` }],
    paths,
    components: { schemas },
  }
}
