import { requireOnBase } from '../rbac/require.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'

/**
 * Reading the structure history of a base — chapter 07 §8.1.
 *
 * `structure_revision` holds catalog rows, before and after: faithful, and unreadable as
 * such. This turns them into what a person asks of a history — « who made Statut
 * required, and when? » —: one line per act, what it touched, and the attributes that
 * changed from what to what. The constraints and indexes the kernel derives from a field
 * are left out of the reading, not out of the journal: they follow the field, and a line
 * per derived object would bury the act under its consequences.
 */

export interface StructureChange {
  readonly attribute: string
  readonly from: string | null
  readonly to: string | null
}

export interface StructureEvent {
  readonly id: string
  readonly at: string
  readonly op: 'create' | 'update' | 'soft_delete' | 'restore' | 'purge' | 'rename_physical'
  readonly object: 'base' | 'table' | 'field' | 'ai' | 'option' | 'config'
  /** The table the act belongs to — `null` for the base itself. */
  readonly table: string | null
  /** The field, for an act on a field, its configuration or one of its choices. */
  readonly field: string | null
  readonly summary: string
  readonly changes: readonly StructureChange[]
  readonly actor: {
    readonly kind: string
    readonly name: string | null
  }
  readonly migrationId: string | null
}

export interface StructureHistoryPage {
  readonly events: readonly StructureEvent[]
  /** Pass back as `before` for the page after; `null` at the end. */
  readonly next: string | null
}

type Row = Record<string, unknown> | null

/** The attributes a person recognizes, per catalog table, with how to say them. */
const ATTRIBUTES: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  base: [
    ['label', 'Libellé'],
    ['description', 'Description'],
    ['color', 'Couleur'],
    ['icon', 'Pictogramme'],
    ['image', 'Image'],
    ['environment', 'Environnement'],
    ['mcp_enabled', 'Ouverte aux agents'],
    ['structure_state', 'État de la structure'],
  ],
  table_def: [
    ['label', 'Libellé'],
    ['description', 'Description'],
    ['color', 'Couleur'],
    ['icon', 'Pictogramme'],
    ['image', 'Image'],
    ['display_field_id', 'Colonne d’affichage'],
  ],
  field: [
    ['label', 'Libellé'],
    ['description', 'Description'],
    ['is_required', 'Obligatoire'],
    ['expose_to_agents', 'Visible des agents'],
  ],
  field_ai_config: [
    ['prompt', 'Consigne'],
    ['refresh_mode', 'Rafraîchissement'],
    ['refresh_cron', 'Planning'],
  ],
  select_option: [
    ['label', 'Libellé'],
    ['color', 'Couleur'],
    ['icon', 'Pictogramme'],
    ['image', 'Image'],
  ],
}

const KIND_LABEL: Readonly<Record<string, string>> = {
  short_text: 'texte',
  long_text: 'texte long',
  url: 'lien URL',
  number: 'nombre',
  boolean: 'booléen',
  date: 'date',
  datetime: 'date et heure',
  select: 'liste de choix',
  multi_select: 'choix multiple',
  file: 'document',
  image: 'image',
  link: 'relation',
  formula: 'formule',
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  if (typeof value === 'string') return value.startsWith('data:') ? '(image)' : value
  return String(value)
}

function changesOf(
  table: string,
  before: Row,
  after: Row,
  fieldLabels: ReadonlyMap<string, string>,
): StructureChange[] {
  if (before === null || after === null) return []
  const out: StructureChange[] = []
  for (const [key, attribute] of ATTRIBUTES[table] ?? []) {
    const from = before[key]
    const to = after[key]
    if (JSON.stringify(from) === JSON.stringify(to)) continue
    // A display column is a field: said by its label, not by its key.
    const say = (value: unknown) =>
      key === 'display_field_id' && typeof value === 'string'
        ? (fieldLabels.get(value) ?? null)
        : text(value)
    out.push({ attribute, from: say(from), to: say(to) })
  }
  return out
}

function label(row: Row): string | null {
  const value = row?.label
  return typeof value === 'string' ? value : null
}

/**
 * One page of the structure history of a base, most recent first.
 * `manage_schema` on the base: it names every field, masked ones included.
 */
export async function structureHistory(
  pools: Pools,
  ctx: RequestContext,
  request: { readonly baseId: string; readonly before?: string; readonly limit?: number },
): Promise<StructureHistoryPage> {
  const limit = Math.min(Math.max(request.limit ?? 50, 1), 200)
  return withTransaction(
    pools,
    'catalog',
    ctx,
    async (exec) => {
      await requireOnBase(exec, ctx, 'manage_schema', request.baseId)
      const rows = await exec.query<{
        id: string
        occurred_at: Date
        op: StructureEvent['op'] | 'replace'
        object_kind: string
        catalog_table: string
        before_row: Row
        after_row: Row
        migration_id: string | null
        actor_kind: string
        actor_name: string | null
        field_label: string | null
        field_kind: string | null
        table_label: string | null
      }>(
        `SELECT r.id, r.occurred_at, r.op, r.object_kind, r.catalog_table, r.before_row,
                r.after_row, r.migration_id, r.actor_kind, u.display_name AS actor_name,
                f.label AS field_label, f.kind AS field_kind,
                coalesce(ft.label, t.label) AS table_label
           FROM _basedb.structure_revision r
           LEFT JOIN _basedb.app_user u ON u.id = r.actor_user_id
           -- The field an act on a field, its configuration or a choice belongs to.
           LEFT JOIN _basedb.field f ON f.id = CASE
                WHEN r.object_kind IN ('field', 'field_config') THEN r.object_id
                WHEN r.object_kind = 'select_option' THEN r.parent_object_id END
           LEFT JOIN _basedb.table_def ft ON ft.id = f.table_id
           LEFT JOIN _basedb.table_def t  ON t.id = r.object_id AND r.object_kind = 'table_def'
          WHERE r.base_id = $1
            AND r.object_kind IN ('base', 'table_def', 'field', 'field_config', 'select_option')
            AND ($2::uuid IS NULL OR r.id < $2::uuid)
          ORDER BY r.id DESC
          LIMIT $3`,
        [request.baseId, request.before ?? null, limit + 1],
      )

      const displayIds = new Set<string>()
      for (const row of rows) {
        for (const image of [row.before_row, row.after_row]) {
          const id = image?.display_field_id
          if (row.catalog_table === 'table_def' && typeof id === 'string') displayIds.add(id)
        }
      }
      const fieldLabels = new Map(
        displayIds.size === 0
          ? []
          : (
              await exec.query<{ id: string; label: string }>(
                'SELECT id, label FROM _basedb.field WHERE id = ANY($1::uuid[])',
                [[...displayIds]],
              )
            ).map((f) => [f.id, f.label] as const),
      )

      const events: StructureEvent[] = []
      for (const row of rows.slice(0, limit)) {
        const image = row.after_row ?? row.before_row
        const op = row.op === 'replace' ? 'update' : row.op
        const changes = changesOf(row.catalog_table, row.before_row, row.after_row, fieldLabels)
        let object: StructureEvent['object']
        let summary: string
        const field = row.field_label ?? label(image)
        switch (row.catalog_table) {
          case 'base': {
            object = 'base'
            summary =
              op === 'create'
                ? `Base « ${label(image) ?? ''} » créée`
                : op === 'soft_delete'
                  ? 'Base supprimée'
                  : op === 'restore'
                    ? 'Base restaurée'
                    : 'Base modifiée'
            break
          }
          case 'table_def': {
            object = 'table'
            const name = label(image) ?? row.table_label ?? ''
            summary =
              op === 'create'
                ? `Table « ${name} » créée`
                : op === 'soft_delete'
                  ? `Table « ${name} » supprimée`
                  : op === 'restore'
                    ? `Table « ${name} » restaurée`
                    : op === 'rename_physical'
                      ? `Table « ${name} » renommée en base`
                      : op === 'purge'
                        ? `Table « ${name} » purgée`
                        : `Table « ${name} » modifiée`
            break
          }
          case 'field': {
            object = 'field'
            const kind = typeof image?.kind === 'string' ? image.kind : (row.field_kind ?? '')
            summary =
              op === 'create'
                ? `Champ « ${field ?? ''} » ajouté (${KIND_LABEL[kind] ?? kind})`
                : op === 'soft_delete'
                  ? `Champ « ${field ?? ''} » supprimé`
                  : op === 'restore'
                    ? `Champ « ${field ?? ''} » restauré`
                    : op === 'rename_physical'
                      ? `Champ « ${field ?? ''} » renommé en base`
                      : `Champ « ${field ?? ''} » modifié`
            break
          }
          case 'select_option': {
            object = 'option'
            const value = typeof image?.label === 'string' ? image.label : ''
            const retired =
              op === 'purge' ||
              (row.before_row?.deleted_at == null && row.after_row?.deleted_at != null)
            summary =
              op === 'create'
                ? `Choix « ${value} » ajouté à « ${row.field_label ?? ''} »`
                : retired || op === 'soft_delete'
                  ? `Choix « ${value} » retiré de « ${row.field_label ?? ''} »`
                  : `Choix « ${value} » de « ${row.field_label ?? ''} » modifié`
            break
          }
          case 'field_ai_config': {
            object = 'ai'
            summary =
              op === 'create'
                ? `IA activée sur « ${row.field_label ?? ''} »`
                : op === 'purge'
                  ? `IA retirée de « ${row.field_label ?? ''} »`
                  : `IA de « ${row.field_label ?? ''} » modifiée`
            break
          }
          default: {
            // A type's configuration is born and dies with its field: said with it.
            if (op === 'create' || op === 'purge') continue
            object = 'config'
            summary = `Configuration de « ${row.field_label ?? ''} » modifiée`
          }
        }
        // An update that changed nothing a person reads — a mirror column following its
        // field, say — is not an act of its own.
        if (op === 'update' && changes.length === 0 && object !== 'config') continue
        events.push({
          id: row.id,
          at: new Date(row.occurred_at).toISOString(),
          op,
          object,
          table: object === 'base' ? null : (row.table_label ?? null),
          field: object === 'base' || object === 'table' ? null : (row.field_label ?? field),
          summary,
          changes,
          actor: { kind: row.actor_kind, name: row.actor_name },
          migrationId: row.migration_id,
        })
      }
      const last = rows[limit - 1]
      return { events, next: rows.length > limit && last !== undefined ? last.id : null }
    },
    { readOnly: true },
  )
}
