import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { isFileKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { decide } from '../rbac/decide.js'
import { loadFields, loadGrants, loadTarget } from '../rbac/loader.js'
import type { Pools } from '../runtime/pool.js'
import { type RequestContext, withTransaction } from '../tx/context.js'
import type { FileStorage } from './storage.js'

/**
 * Files of `file` and `image` fields — chapter 04 §3 bis.
 *
 * The life of a file, in three moves:
 *
 *   1. it is DEPOSITED for a field: the bytes go to the storage, a `stored_file` row
 *      records what they are, and the caller gets an identifier;
 *   2. a row WRITE cites that identifier — `values.ts` checks it was deposited for this
 *      very field and copies name, type and size from the catalog into the cell;
 *   3. a READ of the row hands back, for each file, a LINK signed by the kernel.
 *
 * The link is the whole access check of the download, and that is deliberate. It is
 * minted only by a read that went through the enforcement point — table, field mask and
 * row predicate included — so holding one proves the right to the file as of that read.
 * It expires, and it needs no `Authorization` header, which an `<img src>` cannot send.
 */

/** The largest file accepted, unless the operator says otherwise. */
export const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024

/** The picture types an `image` field takes, found from the bytes, never from the name. */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'] as const

/**
 * The types served INLINE: pictures a browser only ever decodes, and PDF, which it opens
 * in a viewer that runs no script of the page's origin. Everything else is served as an
 * attachment — an HTML or SVG file opened in place would run its scripts on the API's
 * origin, next to the session cookie.
 */
const INLINE: ReadonlySet<string> = new Set([...IMAGE_TYPES, 'application/pdf'])

/** The type of a few formats, read from their first bytes. */
export function sniffType(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a'))
    return 'image/gif'
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) {
    return 'image/avif'
  }
  if (bytes.length >= 5 && ascii(0, 5) === '%PDF-') return 'application/pdf'
  return null
}

const MIME = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/

/**
 * A name fit to be shown and offered for download: no directory, no control character,
 * at most 255 characters. What is left of an empty one is "fichier".
 */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? ''
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is removed
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  const bounded = [...cleaned].slice(0, 255).join('')
  return bounded === '' || bounded === '.' || bounded === '..' ? 'fichier' : bounded
}

export interface UploadRequest {
  readonly tableId: string
  /** The field's physical name. */
  readonly field: string
  /** The name the file had where it came from. */
  readonly name: string
  /** What the client says it is — believed for a document, checked for an image. */
  readonly type: string | undefined
  readonly bytes: Uint8Array
}

export interface UploadedFile {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly size: number
  readonly url: string
}

export interface FileDeps {
  readonly pools: Pools
  readonly storage: FileStorage
  readonly maxBytes: number
  /** The key links are signed with, derived from the instance key. */
  readonly linkKey: Buffer
}

/**
 * Deposits a file for a field.
 *
 * Whoever may WRITE the field — on a new row or an existing one — may deposit for it; a
 * field they may not see is a field that does not exist. The deposit alone changes no
 * row: until a write cites it, the file is attached to nothing.
 */
export async function uploadFile(
  deps: FileDeps,
  ctx: RequestContext,
  request: UploadRequest,
): Promise<UploadedFile> {
  if (request.bytes.length > deps.maxBytes) {
    throw new BasedbError('BODY_TOO_LARGE', {
      details: { size: request.bytes.length, maximum: deps.maxBytes },
    })
  }

  const target = await withTransaction(
    deps.pools,
    'catalog',
    ctx,
    async (exec) => {
      const grants = await loadGrants(exec, ctx)
      const table = await loadTarget(exec, ctx, request.tableId)
      if (table === null) {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { table: request.tableId } })
      }
      const fields = await loadFields(exec, request.tableId)
      const found = [...fields].find(([, f]) => f.name === request.field)

      const creating = decide(ctx, grants, 'create', table)
      const updating = decide(ctx, grants, 'update', table)
      const readable =
        found !== undefined &&
        (creating.readableFields.has(found[0]) || updating.readableFields.has(found[0]))
      if (found === undefined || !readable) {
        throw new BasedbError('FILTER_FIELD_UNKNOWN', { details: { field: request.field } })
      }
      const [fieldId, field] = found
      if (!creating.writableFields.has(fieldId) && !updating.writableFields.has(fieldId)) {
        throw new BasedbError('FIELD_NOT_WRITABLE', { details: { field: request.field } })
      }
      if (!isFileKind(field.kind)) {
        throw new BasedbError('REQUEST_INVALID', {
          details: { field: request.field, reason: 'pas_un_champ_fichier' },
        })
      }

      const [base] = await exec.query<{ base_id: string }>(
        'SELECT base_id FROM _basedb.table_def WHERE id = $1',
        [request.tableId],
      )
      return { fieldId, kind: field.kind, baseId: base.base_id }
    },
    { readOnly: true },
  )

  const sniffed = sniffType(request.bytes)
  const declared = (request.type ?? '').split(';')[0].trim().toLowerCase()

  let type: string
  if (target.kind === 'image') {
    // The bytes decide, not the name nor the header: a `.png` that is an HTML page must
    // not be served back as a picture. SVG is refused outright — it carries scripts.
    if (sniffed === null || !(IMAGE_TYPES as readonly string[]).includes(sniffed)) {
      throw new BasedbError('CONTENT_TYPE_INVALID', {
        details: { field: request.field, accepted: IMAGE_TYPES },
      })
    }
    type = sniffed
  } else {
    type = sniffed ?? (MIME.test(declared) ? declared : 'application/octet-stream')
  }

  const name = cleanFileName(request.name)
  const sha256 = createHash('sha256').update(request.bytes).digest('hex')
  const key = `${target.baseId}/${randomUUID()}`

  // The bytes first, the row second: a row pointing at bytes that never arrived would be
  // a file every reader fails to open. The reverse — bytes nobody points at — is what
  // the cleanup of unattached files is for.
  await deps.storage.put(key, request.bytes, type)

  let id: string
  try {
    const [row] = await deps.pools.withConnection('catalog', (exec) =>
      exec.query<{ id: string }>(
        `INSERT INTO _basedb.stored_file
           (base_id, field_id, storage_key, name, mime_type, size_bytes, sha256, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          target.baseId,
          target.fieldId,
          key,
          name,
          type,
          request.bytes.length,
          sha256,
          ctx.actor.id,
        ],
        'insert',
      ),
    )
    id = row.id
  } catch (error) {
    await deps.storage.delete(key).catch(() => undefined)
    throw error
  }

  const file = { id, name, type, size: request.bytes.length }
  return { ...file, url: fileLink(deps.linkKey, ctx.tenantId, file, ctx.timestamp) }
}

/** How long a link lasts: between six and twelve hours, see `expiryOf`. */
const LINK_WINDOW_MS = 6 * 60 * 60 * 1000

/**
 * The expiry of a link minted at `now`: the end of the NEXT six-hour window.
 *
 * Rounded rather than `now + ttl`, so that every read within a window mints the SAME
 * link — and the browser, which caches by URL, keeps the thumbnails of a grid across its
 * refreshes instead of downloading them again each time.
 */
function expiryOf(now: Date): number {
  return ((Math.floor(now.getTime() / LINK_WINDOW_MS) + 2) * LINK_WINDOW_MS) / 1000
}

function signature(key: Buffer, tenant: string, id: string, expires: number): string {
  return createHmac('sha256', key)
    .update(`${tenant}\n${id}\n${expires}`)
    .digest('base64url')
    .slice(0, 32)
}

/**
 * The path a reader downloads a file from, relative to the API's origin.
 *
 * The name is in the path for the reader's sake — it is what a browser proposes when
 * saving — and is NOT signed: the server answers with the catalog's name whatever it says.
 */
export function fileLink(
  key: Buffer,
  tenant: string,
  file: { readonly id: string; readonly name: string },
  now: Date,
): string {
  const expires = expiryOf(now)
  const sig = signature(key, tenant, file.id, expires)
  return `/api/v1/${encodeURIComponent(tenant)}/files/${file.id}/${encodeURIComponent(file.name)}?exp=${expires}&sig=${sig}`
}

/**
 * Adds its link to each file of the given columns, in place of nothing: a value that is
 * not a list of files is left as it is.
 */
export function withFileLinks(
  key: Buffer,
  ctx: RequestContext,
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: readonly string[],
): Array<Record<string, unknown>> {
  if (columns.length === 0) return rows as Array<Record<string, unknown>>
  return rows.map((row) => {
    const copy = { ...row }
    for (const column of columns) {
      const value = copy[column]
      if (!Array.isArray(value)) continue
      copy[column] = value.map((entry) =>
        typeof entry === 'object' && entry !== null && typeof entry.id === 'string'
          ? {
              ...entry,
              url: fileLink(
                key,
                ctx.tenantId,
                { id: entry.id, name: String(entry.name ?? 'fichier') },
                ctx.timestamp,
              ),
            }
          : entry,
      )
    }
    return copy
  })
}

export interface OpenedFile {
  readonly name: string
  readonly type: string
  readonly size: number
  readonly sha256: string
  /** True when the browser may show it in place rather than save it. */
  readonly inline: boolean
  /** Seconds the link has left: how long a cache may keep the answer. */
  readonly maxAge: number
  readonly body: ReadableStream<Uint8Array>
}

/**
 * Opens a file through its link.
 *
 * A link that is forged, altered, expired, or names a file that is gone gets the same
 * answer — not found — so that trying identifiers teaches nothing.
 */
export async function openFile(
  deps: FileDeps,
  request: {
    readonly tenant: string
    readonly id: string
    readonly expires: string | undefined
    readonly signature: string | undefined
  },
  now: Date,
): Promise<OpenedFile> {
  const notFound = () => new BasedbError('RESOURCE_NOT_FOUND', { details: { file: request.id } })

  const expires = Number(request.expires)
  if (!Number.isInteger(expires) || expires * 1000 < now.getTime()) throw notFound()
  if (!/^[0-9a-f-]{36}$/i.test(request.id)) throw notFound()

  const expected = Buffer.from(signature(deps.linkKey, request.tenant, request.id, expires))
  const given = Buffer.from(request.signature ?? '')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw notFound()

  const [file] = await deps.pools.withConnection('catalog', (exec) =>
    exec.query<{
      storage_key: string
      name: string
      mime_type: string
      size_bytes: string
      sha256: string
    }>(
      'SELECT storage_key, name, mime_type, size_bytes, sha256 FROM _basedb.stored_file WHERE id = $1',
      [request.id],
    ),
  )
  if (file === undefined) throw notFound()

  return {
    name: file.name,
    type: file.mime_type,
    size: Number(file.size_bytes),
    sha256: file.sha256,
    inline: INLINE.has(file.mime_type),
    maxAge: Math.max(0, Math.floor(expires - now.getTime() / 1000)),
    body: await deps.storage.get(file.storage_key),
  }
}
