import { TENANT_ID_LENGTH, isTenantId } from './tenant.js'

/**
 * Schema name composition — chapter 01 §5.
 *
 *   b_<tenantId>_<base>
 *   │ │ │        │└─ base slug, 1 to 53 bytes
 *   │ │ │        └── literal separator
 *   │ │ └─────────── tenantId, exactly 7 characters, always 't' + 6
 *   │ └───────────── literal separator
 *   └─────────────── literal marker 'b'
 */

/** `b_` + tenantId (7) + `_` = 10 bytes. */
export const SCHEMA_PREFIX_BYTES = 10

const MARKER = 'b_'

export function composeSchemaName(tenantId: string, baseSlug: string): string {
  return `${MARKER}${tenantId}_${baseSlug}`
}

export interface ParsedSchemaName {
  tenantId: string
  baseSlug: string
}

/**
 * Parses a schema name BY POSITION, never by splitting on `_`.
 *
 * The `tenantId` has a fixed length of 7 characters and always starts with `t`:
 * characters 1–2 are `b_`, characters 3–9 are the `tenantId`, character 10 is `_`, and
 * the rest is the base name. A base name containing `_` — the normal case — creates no
 * ambiguity.
 *
 *   `b_t4z56fq_factures_2024` → tenant `t4z56fq`, base `factures_2024`
 *
 * Returns `null` if the name is not a basedb base schema — which covers `_basedb`,
 * `_basedb_local`, `public` and any foreign schema.
 */
export function parseSchemaName(schemaName: string): ParsedSchemaName | null {
  if (!schemaName.startsWith(MARKER)) return null
  const tenantId = schemaName.slice(2, 2 + TENANT_ID_LENGTH)
  if (!isTenantId(tenantId)) return null
  if (schemaName[2 + TENANT_ID_LENGTH] !== '_') return null
  const baseSlug = schemaName.slice(3 + TENANT_ID_LENGTH)
  if (baseSlug.length === 0) return null
  return { tenantId, baseSlug }
}

/** True if the schema name belongs to the given tenant. */
export function schemaBelongsToTenant(schemaName: string, tenantId: string): boolean {
  return parseSchemaName(schemaName)?.tenantId === tenantId
}
