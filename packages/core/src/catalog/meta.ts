import type { FieldKind } from '../ddl/emit.js'
import { operatorsFor, sortableKind } from '../records/filter.js'
import type { ProjectedBase, VisibleBase } from './projection.js'

/**
 * `/meta/bases` and `/meta/bases/{base}` — chapter 08 §9.
 *
 * FIRST of the three serializations, and the plainest: it renames the projection's
 * fields to the snake_case the API uses and stops there. It lives here, beside
 * `toOpenApi` and `toDocumentation`, because the chapter treats the three as siblings —
 * putting one of them in the HTTP adapter would be the first step towards three
 * filterings instead of one.
 */

/** One line of the listing. */
export function toBaseList(bases: readonly VisibleBase[]): unknown {
  return bases.map((b) => ({
    id: b.id,
    name: b.name,
    label: b.label,
    description: b.description,
    color: b.color,
    icon: b.icon,
    image: b.image,
    project: b.project,
    table_count: b.tableCount,
  }))
}

export function toMeta(base: ProjectedBase): unknown {
  return {
    id: base.id,
    name: base.name,
    label: base.label,
    description: base.description,
    // How the base and its tables look: catalog only, keys always present.
    color: base.color,
    icon: base.icon,
    image: base.image,
    project: base.project,
    // Which environment of its base this one is (chapter 14): production, recette…
    environment: base.environment,
    // The verbs held on the base itself: `manage_schema` is what lets a table be added.
    actions: base.baseActions,
    tables: base.tables.map((t) => ({
      id: t.id,
      name: t.name,
      label: t.label,
      description: t.description,
      color: t.color,
      icon: t.icon,
      image: t.image,
      // The base name travels WITH the table: `{base}/{table}` is what addresses it, and
      // a description a caller cannot turn into a URL is half a description.
      base: base.name,
      // The physical name is ALWAYS returned (chapter 01 §2.5): it is the one the caller
      // will write in their SQL queries.
      sql: t.sql,
      actions: t.actions,
      referenced_by: t.referencedBy,
      display_field: t.displayField,
      fields: t.fields.map((f) => ({
        name: f.name,
        label: f.label,
        description: f.description,
        kind: f.kind,
        required: f.required,
        read_only: f.readOnly,
        system: f.system,
        // The operators this field accepts, and whether it can be ordered. Published so
        // that no client has to carry a copy of the normative table — one that would
        // drift the day a type gains an operator (chapter 11 §1.3).
        operators: operatorsFor(f.kind as FieldKind),
        sortable: sortableKind(f.kind as FieldKind),
        ...(f.unsafeHtml ? { unsafe_html: true } : {}),
        // Computed by the AI: read-only, filled by the kernel (chapter 12 §1.5).
        ...(f.ai === true ? { ai: true } : {}),
        ...(f.options === undefined ? {} : { options: f.options }),
        ...(f.link === undefined
          ? {}
          : {
              link: {
                on_delete: f.link.onDelete,
                required: f.link.required,
                expandable: f.link.expandable,
                masked: f.link.masked,
                // Absent when the target is invisible: not even its name is said.
                ...(f.link.target === undefined
                  ? {}
                  : {
                      target: f.link.target.table,
                      target_display_field: f.link.target.displayField,
                    }),
              },
            }),
      })),
    })),
  }
}
