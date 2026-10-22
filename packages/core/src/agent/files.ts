import { isFileKind } from '../ddl/emit.js'
import { BasedbError } from '../errors/index.js'
import { type FileDeps, type UploadedFile, uploadFile } from '../files/operations.js'
import { updateRecord } from '../records/update.js'
import type { Pools } from '../runtime/pool.js'
import type { RequestContext } from '../tx/context.js'
import { type TargetPolicy, checkTarget } from '../webhooks/target.js'
import {
  type AgentWriteResult,
  agentError,
  readBack,
  requireWrite,
  writeResult,
} from './records.js'
import { agentView, resolveAgentField, resolveAgentTable } from './view.js'

/**
 * `attach_file` — a document or a picture put into a `file` or `image` field of an
 * existing row, by an agent (chapter 09 §6, chapter 04 §3 bis).
 *
 * The other writes of this surface leave file fields alone: a file is DEPOSITED before a
 * row cites it, and an agent writing `values` has no bytes to deposit. This tool is the two
 * moves in one: the deposit — the kernel's own, with its checks: the size bound, an image
 * recognised from its bytes and never from its name, SVG refused — then the write of the
 * row, the ordinary one, with the token's rights, the field mask and the history.
 *
 * The bytes come with the call (base64), or from an address the server fetches. That
 * address is held to the rule of webhooks (08 §10.8): a public host — or one the operator
 * trusts —, checked again at every redirect, so that an agent cannot make the server read
 * its own network. What it fetches is bounded by the same size as a deposit.
 *
 * `append` adds the file to those the field holds; `replace` leaves it alone in it. A file
 * deposited but not attached — the write refused after the deposit — is attached to
 * nothing, which the cleanup of unattached files is for.
 */

export interface AgentAttachRequest {
  readonly base: string
  readonly table: string
  readonly id: string
  readonly field: string
  /** The name shown and offered for download; from the address when absent. */
  readonly name?: string
  /** What the caller says the file is — believed for a document, checked for an image. */
  readonly contentType?: string
  /** The file itself… */
  readonly bytes?: Uint8Array
  /** …or where to fetch it. */
  readonly url?: string
  readonly mode?: 'append' | 'replace'
}

export interface AgentAttachResult extends AgentWriteResult {
  readonly file: Omit<UploadedFile, 'url'>
}

/** How long fetching an address may take, and how many redirects it may follow. */
const FETCH_TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 3

/** The last segment of an address's path, as a file name — empty when there is none. */
function nameFromUrl(url: URL): string {
  const last = url.pathname.split('/').filter(Boolean).pop() ?? ''
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

/** `filename="…"` or `filename*=UTF-8''…` of a `Content-Disposition`, when there is one. */
function nameFromDisposition(header: string | null): string {
  if (header === null) return ''
  const star = /filename\*\s*=\s*[^']*''([^;]+)/i.exec(header)?.[1]
  if (star !== undefined) {
    try {
      return decodeURIComponent(star.trim())
    } catch {
      // fall through to the plain form
    }
  }
  return /filename\s*=\s*"?([^";]+)"?/i.exec(header)?.[1]?.trim() ?? ''
}

/** Fetches a file the agent named by its address, under the webhooks' rule. */
async function fetchFile(
  raw: string,
  policy: TargetPolicy,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; type: string | undefined; name: string }> {
  const refused = (reason: string) =>
    new BasedbError('PARAMETER_INVALID', { details: { param: 'url', reason } })
  let url = await checkTarget(raw, policy).catch(() => {
    throw refused('cible_refusee')
  })
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  for (let hop = 0; ; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal }).catch(() => {
      throw refused('injoignable')
    })
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location')
      if (next === null || hop >= MAX_REDIRECTS) throw refused('trop_de_redirections')
      // Each hop is checked again: a public address may redirect inside.
      url = await checkTarget(new URL(next, url).toString(), policy).catch(() => {
        throw refused('cible_refusee')
      })
      continue
    }
    if (!response.ok || response.body === null) throw refused(`http_${response.status}`)
    const announced = Number(response.headers.get('content-length') ?? 0)
    if (announced > maxBytes) {
      throw new BasedbError('BODY_TOO_LARGE', {
        details: { size: announced, maximum: maxBytes },
      })
    }
    // Read under the bound, whatever the length announced: a server may lie.
    const chunks: Uint8Array[] = []
    let size = 0
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length
      if (size > maxBytes) {
        throw new BasedbError('BODY_TOO_LARGE', { details: { maximum: maxBytes } })
      }
      chunks.push(chunk)
    }
    const bytes = new Uint8Array(size)
    let at = 0
    for (const chunk of chunks) {
      bytes.set(chunk, at)
      at += chunk.length
    }
    return {
      bytes,
      type: response.headers.get('content-type') ?? undefined,
      name: nameFromDisposition(response.headers.get('content-disposition')) || nameFromUrl(url),
    }
  }
}

export async function agentAttachFile(
  pools: Pools,
  files: FileDeps,
  targets: TargetPolicy,
  ctx: RequestContext,
  request: AgentAttachRequest,
): Promise<AgentAttachResult> {
  const view = await agentView(pools, ctx)
  const table = resolveAgentTable(view, request.base, request.table)
  requireWrite(table, 'update')
  const field = resolveAgentField(table, request.field, 'field')
  const object = { kind: 'table', name: table.row.table_name }
  if (!isFileKind(field.kind)) {
    throw new BasedbError('PARAMETER_INVALID', {
      details: { param: 'field', reason: 'pas_un_champ_fichier', object },
    })
  }
  // Writable by the rights: this surface's own refusal of files is what this tool lifts.
  if (!field.grantedWrite) {
    throw new BasedbError('FIELD_NOT_WRITABLE', {
      details: { param: 'field', field: field.name, object },
    })
  }

  // The row first: a file deposited for a row that does not exist would be for nothing.
  const before = await readBack(pools, ctx, view, table, request.id)
  if (before === null) throw new BasedbError('RESOURCE_NOT_FOUND')
  const held = Array.isArray(before[field.name])
    ? (before[field.name] as Array<{ id?: unknown }>)
        .map((f) => f.id)
        .filter((id): id is string => typeof id === 'string')
    : []

  const source =
    request.url !== undefined
      ? await fetchFile(request.url, targets, files.maxBytes)
      : { bytes: request.bytes ?? new Uint8Array(), type: undefined, name: '' }
  if (source.bytes.length === 0) {
    throw new BasedbError('PARAMETER_INVALID', { details: { param: 'content', reason: 'vide' } })
  }

  let deposited: UploadedFile
  try {
    deposited = await uploadFile(files, ctx, {
      tableId: table.row.id,
      field: field.name,
      name: request.name ?? source.name,
      type: request.contentType ?? source.type,
      bytes: source.bytes,
    })
  } catch (error) {
    agentError(error, table, view)
  }

  const value = request.mode === 'replace' ? [deposited.id] : [...held, deposited.id]
  try {
    await updateRecord(pools, ctx, {
      tableId: table.row.id,
      recordId: request.id,
      values: { [field.name]: value },
    })
  } catch (error) {
    agentError(error, table, view)
  }

  const record = await readBack(pools, ctx, view, table, request.id)
  const { url: _link, ...file } = deposited
  return {
    ...writeResult(table, {
      _id: request.id.toLowerCase(),
      updated: true,
      file,
      ...(record === null ? {} : { record }),
      provenance: 'user_data',
    }),
    file,
  }
}
