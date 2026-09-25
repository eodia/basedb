import { createHash, createHmac } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { BasedbError } from '../errors/index.js'

/**
 * Where the bytes of a `file` or `image` field live — chapter 04 §3 bis.
 *
 * Not in PostgreSQL. A cell holds the list of its files, and the catalog one row per
 * file; the bytes go to a store made for them, so that a base of scanned invoices does
 * not make every backup, every `VACUUM` and every replica carry them.
 *
 * Two drivers, one contract. The LOCAL one needs nothing and suits a single host; the
 * S3 one speaks the protocol every object store now speaks — AWS, Scaleway, OVH,
 * Cloudflare R2, Garage, SeaweedFS, and a MinIO an operator already runs. The kernel
 * never learns which: it asks for a key, and gets bytes.
 */
export interface FileStorage {
  /** Stores `body` under `key`, replacing nothing: keys are drawn at random. */
  put(key: string, body: Uint8Array, type: string): Promise<void>
  /** The bytes under `key`, as a stream — a 20 MB PDF is never held whole to be served. */
  get(key: string): Promise<ReadableStream<Uint8Array>>
  /** Removes `key`. Removing what is already gone is not an error. */
  delete(key: string): Promise<void>
  /** Said once at startup, so the operator sees where the files go. */
  readonly description: string
}

export type FileStorageConfig =
  | { readonly driver: 'local'; readonly directory: string }
  | {
      readonly driver: 's3'
      /** `https://s3.fr-par.scw.cloud`, `http://localhost:3900`… */
      readonly endpoint: string
      readonly bucket: string
      readonly region: string
      readonly accessKeyId: string
      readonly secretAccessKey: string
      /**
       * `https://host/bucket/key` rather than `https://bucket.host/key`. True by default:
       * it is what self-hosted stores expect, and what needs no wildcard DNS.
       */
      readonly forcePathStyle?: boolean
    }

export function createFileStorage(config: FileStorageConfig): FileStorage {
  return config.driver === 'local' ? new LocalStorage(config.directory) : new S3Storage(config)
}

/** A key is ours — `<base>/<uuid>` — and is checked anyway before it becomes a path. */
const KEY = /^[0-9a-f-]+(\/[0-9a-f-]+)*$/

function checkedKey(key: string): string {
  if (!KEY.test(key)) {
    throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'clé de fichier invalide' } })
  }
  return key
}

/** Unavailable storage is the operator's to fix, never the caller's: an incident. */
function unavailable(cause: unknown): BasedbError {
  return new BasedbError('SERVICE_UNAVAILABLE', {
    details: { reason: 'stockage de fichiers injoignable' },
    cause,
  })
}

class LocalStorage implements FileStorage {
  private readonly root: string
  readonly description: string

  constructor(directory: string) {
    this.root = resolve(directory)
    this.description = `disque local, ${this.root}`
  }

  private pathOf(key: string): string {
    const path = resolve(join(this.root, checkedKey(key)))
    // Belt and braces: the key alphabet already excludes `..`.
    if (!path.startsWith(this.root + sep)) {
      throw new BasedbError('INTERNAL_ERROR', { details: { reason: 'clé hors du répertoire' } })
    }
    return path
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const path = this.pathOf(key)
    try {
      await mkdir(dirname(path), { recursive: true })
      // Written aside then renamed: a reader never sees half a file, even when the
      // process dies mid-write.
      const partial = `${path}.partial`
      await writeFile(partial, body)
      await rename(partial, path)
    } catch (error) {
      throw unavailable(error)
    }
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const path = this.pathOf(key)
    try {
      await stat(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new BasedbError('RESOURCE_NOT_FOUND', { details: { file: key } })
      }
      throw unavailable(error)
    }
    return Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true })
  }
}

const EMPTY_SHA256 = createHash('sha256').update('').digest('hex')

/**
 * An S3-compatible bucket, signed with AWS Signature Version 4.
 *
 * Written against `fetch` and `node:crypto` rather than an SDK: three verbs on one
 * bucket do not justify a dependency of several megabytes, and the signature is a
 * documented algorithm, not a moving target.
 */
class S3Storage implements FileStorage {
  private readonly endpoint: URL
  readonly description: string

  constructor(private readonly config: Extract<FileStorageConfig, { driver: 's3' }>) {
    this.endpoint = new URL(config.endpoint)
    this.description = `S3, ${this.endpoint.origin}, compartiment ${config.bucket}`
  }

  private urlOf(key: string): URL {
    const path = checkedKey(key)
    if (this.config.forcePathStyle === false) {
      const url = new URL(this.endpoint)
      url.hostname = `${this.config.bucket}.${url.hostname}`
      url.pathname = `/${path}`
      return url
    }
    const url = new URL(this.endpoint)
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(this.config.bucket)}/${path}`
    return url
  }

  private async send(
    method: 'GET' | 'PUT' | 'DELETE',
    key: string,
    body?: Uint8Array,
    type?: string,
  ): Promise<Response> {
    const url = this.urlOf(key)
    const payloadHash =
      body === undefined ? EMPTY_SHA256 : createHash('sha256').update(body).digest('hex')
    const headers = signV4({
      method,
      url,
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      payloadHash,
      extra: type === undefined ? {} : { 'content-type': type },
      now: new Date(),
    })
    try {
      return await fetch(url, { method, headers, body })
    } catch (error) {
      throw unavailable(error)
    }
  }

  async put(key: string, body: Uint8Array, type: string): Promise<void> {
    const response = await this.send('PUT', key, body, type)
    if (!response.ok) throw unavailable(await failure(response))
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const response = await this.send('GET', key)
    if (response.status === 404) {
      throw new BasedbError('RESOURCE_NOT_FOUND', { details: { file: key } })
    }
    if (!response.ok || response.body === null) throw unavailable(await failure(response))
    return response.body
  }

  async delete(key: string): Promise<void> {
    const response = await this.send('DELETE', key)
    if (!response.ok && response.status !== 404) throw unavailable(await failure(response))
  }
}

/** The store's own words, for the log — an S3 error is an XML body naming its cause. */
async function failure(response: Response): Promise<Error> {
  const text = await response.text().catch(() => '')
  return new Error(`S3 ${response.status}: ${text.slice(0, 500)}`)
}

const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest()

/**
 * The `Authorization` header of Signature Version 4, for a request with no query string.
 *
 * Exported for its test: a signature that is subtly wrong is refused by every store with
 * the same `SignatureDoesNotMatch`, and the reference vectors are the only way to know
 * which part is.
 */
export function signV4(request: {
  readonly method: string
  readonly url: URL
  readonly region: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly payloadHash: string
  readonly extra: Readonly<Record<string, string>>
  readonly now: Date
}): Record<string, string> {
  const amzDate = request.now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${request.region}/s3/aws4_request`

  const headers: Record<string, string> = {
    host: request.url.host,
    'x-amz-content-sha256': request.payloadHash,
    'x-amz-date': amzDate,
    ...Object.fromEntries(Object.entries(request.extra).map(([k, v]) => [k.toLowerCase(), v])),
  }
  const names = Object.keys(headers).sort()
  const canonicalHeaders = names.map((n) => `${n}:${headers[n].trim()}\n`).join('')
  const signedHeaders = names.join(';')

  const canonicalRequest = [
    request.method,
    request.url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    request.payloadHash,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${request.secretAccessKey}`, day), request.region), 's3'),
    'aws4_request',
  )
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  // `host` is set by `fetch` from the URL; sending it again is refused by undici.
  const { host: _host, ...sent } = headers
  return {
    ...sent,
    authorization: `AWS4-HMAC-SHA256 Credential=${request.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}
