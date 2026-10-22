import type { TargetPolicy } from '../webhooks/target.js'
import { parseTrusted } from '../webhooks/target.js'
import type { FileStorageConfig } from './storage.js'

/**
 * Where files go and which addresses the server may reach, read from the environment —
 * ONE reading for every process that starts a kernel.
 *
 * The REST API and the MCP server are two processes on the same database (chapter 09
 * §1.2): a file one deposits, the other must find where it put it, and an address one
 * refuses, the other must refuse too. Each read these variables on its own until the MCP
 * server started depositing files (`attach_file`): it then wrote them where nothing reads.
 */

/** A variable of the environment, empty counting as unset (`KEY=` in a `.env` file). */
type Setting = (name: string) => string | undefined

/** `BASEDB_S3_*` when a bucket is named, else a directory: `BASEDB_FILES_DIR`, or `fallback`. */
export function fileStorageFromEnvironment(setting: Setting, fallback: string): FileStorageConfig {
  const bucket = setting('BASEDB_S3_BUCKET')
  if (bucket !== undefined) {
    const missing = [
      'BASEDB_S3_ENDPOINT',
      'BASEDB_S3_ACCESS_KEY_ID',
      'BASEDB_S3_SECRET_ACCESS_KEY',
    ].filter((name) => setting(name) === undefined)
    if (missing.length > 0) {
      throw new Error(
        `BASEDB_S3_BUCKET is set, but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not.`,
      )
    }
    return {
      driver: 's3',
      endpoint: setting('BASEDB_S3_ENDPOINT') as string,
      bucket,
      region: setting('BASEDB_S3_REGION') ?? 'us-east-1',
      accessKeyId: setting('BASEDB_S3_ACCESS_KEY_ID') as string,
      secretAccessKey: setting('BASEDB_S3_SECRET_ACCESS_KEY') as string,
      forcePathStyle: setting('BASEDB_S3_FORCE_PATH_STYLE') !== '0',
    }
  }
  return { driver: 'local', directory: setting('BASEDB_FILES_DIR') ?? fallback }
}

/** `BASEDB_FILES_MAX_MB`, in bytes — `undefined` for the kernel's default. */
export function maxFileBytesFromEnvironment(setting: Setting): number | undefined {
  const mb = Number(setting('BASEDB_FILES_MAX_MB') ?? '')
  return Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : undefined
}

/**
 * Where a webhook, an automation, a synced table — or a file fetched for an agent — may go
 * (chapter 08 §10.8): public HTTPS, plus `BASEDB_WEBHOOK_ALLOW`; `BASEDB_WEBHOOK_DEV=1`
 * opens this machine, for development. Throws on a malformed `BASEDB_WEBHOOK_ALLOW`.
 */
export function webhookTargetsFromEnvironment(setting: Setting): TargetPolicy {
  const dev = setting('BASEDB_WEBHOOK_DEV') === '1'
  let trusted: readonly string[]
  try {
    trusted = parseTrusted(setting('BASEDB_WEBHOOK_ALLOW') ?? '')
  } catch (error) {
    throw new Error(`BASEDB_WEBHOOK_ALLOW : ${(error as Error).message}.`)
  }
  return { allowHttp: dev, allowPrivate: dev, trusted }
}
