import type { FileStorage } from '../files/storage.js'
import type { Pools } from '../runtime/pool.js'

/**
 * The pictures of a document — chapter 21 §1.3. Two origins: a picture sent with the
 * template itself (a logo, a stamp), kept in its definition as a `data:` address; and the
 * picture an `image` field of the row holds, read from the file storage once the row has
 * been read with the reader's rights.
 *
 * PNG and JPEG only: the two formats a PDF embeds as they are. What a page cannot hold is
 * left out of the document rather than failing it.
 */

/** The heaviest picture a template may carry: a logo, not a photograph. */
export const MAX_IMAGE_BYTES = 300 * 1024

/** The heaviest picture of a field set in a document; past it, the picture is left out. */
export const MAX_FIELD_IMAGE_BYTES = 8 * 1024 * 1024

export interface ImageFacts {
  readonly type: 'image/png' | 'image/jpeg'
  readonly width: number
  readonly height: number
}

/** The start-of-frame markers of a JPEG, which carry its size. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/** What a PNG or a JPEG says of itself — `null` for anything else, or a broken file. */
export function imageFacts(bytes: Uint8Array): ImageFacts | null {
  const u16 = (at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0)
  const u32 = (at: number) => u16(at) * 0x10000 + u16(at + 2)
  const sane = (w: number, h: number) => w > 0 && h > 0 && w <= 20_000 && h <= 20_000
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 24 && png.every((b, i) => bytes[i] === b)) {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16))
    const width = u32(16)
    const height = u32(20)
    return chunk === 'IHDR' && sane(width, height) ? { type: 'image/png', width, height } : null
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null
      const marker = bytes[at + 1] as number
      // Fill bytes, and the markers that carry no length.
      if (marker === 0xff) {
        at += 1
        continue
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        at += 2
        continue
      }
      if (SOF.has(marker)) {
        const height = u16(at + 5)
        const width = u16(at + 7)
        return sane(width, height) ? { type: 'image/jpeg', width, height } : null
      }
      if (marker === 0xd9 || marker === 0xda) return null
      at += 2 + u16(at + 2)
    }
  }
  return null
}

const DATA_URL = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/

/**
 * A picture sent with a template: a `data:` address of a PNG or a JPEG, its bytes what
 * they say they are, no heavier than `MAX_IMAGE_BYTES`. The type is the bytes', never the
 * address's: a `data:image/png` that holds something else is refused.
 */
export function decodeImage(
  text: unknown,
): { readonly bytes: Buffer; readonly facts: ImageFacts } | 'invalid' | 'too_large' {
  if (typeof text !== 'string') return 'invalid'
  // The base64 of `MAX_IMAGE_BYTES` is a third longer: no need to decode a longer text.
  if (text.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64) return 'too_large'
  const match = DATA_URL.exec(text.replace(/\s+/g, ''))
  if (match === null) return 'invalid'
  const bytes = Buffer.from(match[2] as string, 'base64')
  if (bytes.length > MAX_IMAGE_BYTES) return 'too_large'
  const facts = imageFacts(bytes)
  return facts === null ? 'invalid' : { bytes, facts }
}

/** The canonical address of a picture: the type its bytes have, the base64 they make. */
export const dataUrlOf = (bytes: Buffer, facts: ImageFacts) =>
  `data:${facts.type};base64,${bytes.toString('base64')}`

/**
 * The file storage of the kernel that owns a set of pools — set once when the kernel
 * starts, so that whoever renders a document with the kernel's pools (the API, an
 * automation's step) reaches the row's pictures without carrying the storage along.
 */
const storages = new WeakMap<Pools, FileStorage>()

export function useDocumentStorage(pools: Pools, storage: FileStorage): void {
  storages.set(pools, storage)
}

/**
 * The first PNG or JPEG of an image field's value, as bytes — `null` when there is none,
 * when the storage is unknown, or when the file is not what the field says it holds.
 *
 * The value comes from the row as the reader read it: a field they may not see is not in
 * it, and this is never called. The file is looked up together with the field it was
 * deposited for, so that a value can only name a picture of that very field.
 */
export async function fieldImage(
  pools: Pools,
  tableId: string,
  field: string,
  value: unknown,
): Promise<Buffer | null> {
  const storage = storages.get(pools)
  if (storage === undefined || !Array.isArray(value)) return null
  const entries = value.filter(
    (v): v is { id: string; type?: unknown } =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as { id?: unknown }).id === 'string' &&
      /^[0-9a-f-]{36}$/i.test((v as { id: string }).id),
  )
  const first = entries.find((e) => e.type === 'image/png' || e.type === 'image/jpeg')
  if (first === undefined) return null
  const [file] = await pools.withConnection('catalog', (exec) =>
    exec.query<{ storage_key: string; mime_type: string; size_bytes: string }>(
      `SELECT sf.storage_key, sf.mime_type, sf.size_bytes::text
         FROM _basedb.stored_file sf
         JOIN _basedb.field f ON f.id = sf.field_id
         JOIN _basedb.physical_name n ON n.id = f.name_id
        WHERE sf.id = $1::uuid AND f.table_id = $2 AND n.name = $3`,
      [first.id, tableId, field],
    ),
  )
  if (
    file === undefined ||
    (file.mime_type !== 'image/png' && file.mime_type !== 'image/jpeg') ||
    Number(file.size_bytes) > MAX_FIELD_IMAGE_BYTES
  ) {
    return null
  }
  try {
    const stream = await storage.get(file.storage_key)
    const chunks: Uint8Array[] = []
    let size = 0
    const reader = stream.getReader()
    for (;;) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      size += chunk.length
      if (size > MAX_FIELD_IMAGE_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    return imageFacts(bytes) === null ? null : bytes
  } catch {
    return null
  }
}
