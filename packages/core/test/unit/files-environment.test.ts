import { describe, expect, it } from 'vitest'
import {
  fileStorageFromEnvironment,
  maxFileBytesFromEnvironment,
  webhookTargetsFromEnvironment,
} from '../../src/files/environment.js'

const env =
  (values: Record<string, string>) =>
  (name: string): string | undefined =>
    values[name]

describe('the files and the addresses, read once for every process', () => {
  it('puts files in BASEDB_FILES_DIR, else where the process says', () => {
    expect(fileStorageFromEnvironment(env({}), '/repo/.basedb/files')).toEqual({
      driver: 'local',
      directory: '/repo/.basedb/files',
    })
    expect(
      fileStorageFromEnvironment(env({ BASEDB_FILES_DIR: '/data/files' }), '/repo/.basedb/files'),
    ).toEqual({ driver: 'local', directory: '/data/files' })
  })

  it('goes to S3 when a bucket is named, and says what is missing', () => {
    expect(() => fileStorageFromEnvironment(env({ BASEDB_S3_BUCKET: 'b' }), '/x')).toThrow(
      /BASEDB_S3_ENDPOINT/,
    )
    expect(
      fileStorageFromEnvironment(
        env({
          BASEDB_S3_BUCKET: 'b',
          BASEDB_S3_ENDPOINT: 'https://s3.example',
          BASEDB_S3_ACCESS_KEY_ID: 'k',
          BASEDB_S3_SECRET_ACCESS_KEY: 's',
        }),
        '/x',
      ),
    ).toMatchObject({ driver: 's3', bucket: 'b', region: 'us-east-1', forcePathStyle: true })
  })

  it('reads the largest file in megabytes, and nothing else', () => {
    expect(maxFileBytesFromEnvironment(env({ BASEDB_FILES_MAX_MB: '10' }))).toBe(10 * 1024 * 1024)
    expect(maxFileBytesFromEnvironment(env({ BASEDB_FILES_MAX_MB: 'dix' }))).toBeUndefined()
    expect(maxFileBytesFromEnvironment(env({}))).toBeUndefined()
  })

  it('opens this machine only in development, and the operator’s servers always', () => {
    expect(webhookTargetsFromEnvironment(env({}))).toMatchObject({
      allowHttp: false,
      allowPrivate: false,
    })
    expect(webhookTargetsFromEnvironment(env({ BASEDB_WEBHOOK_DEV: '1' }))).toMatchObject({
      allowHttp: true,
      allowPrivate: true,
    })
    expect(
      webhookTargetsFromEnvironment(env({ BASEDB_WEBHOOK_ALLOW: '*.intra.exemple.fr' })).trusted,
    ).toHaveLength(1)
  })
})
