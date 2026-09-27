import { afterEach, describe, expect, it } from 'vitest'
import { endpointFromEnv, resolveProvider } from '../../src/ai/draft.js'
import type { BasedbError } from '../../src/errors/index.js'
import type { Executor } from '../../src/runtime/pool.js'
import type { RequestContext } from '../../src/tx/context.js'

/**
 * The provider from the environment — chapter 12 §3 — and the fourth one,
 * `openai_compatible`: any server speaking OpenAI's API at the operator's address, Azure
 * first, with the headers it asks for.
 */

const VARIABLES = [
  'BASEDB_AI_PROVIDER',
  'BASEDB_AI_MODEL',
  'BASEDB_AI_API_KEY',
  'BASEDB_AI_BASE_URL',
  'BASEDB_AI_HEADERS',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
] as const
const saved = Object.fromEntries(VARIABLES.map((k) => [k, process.env[k]]))

function environment(values: Partial<Record<(typeof VARIABLES)[number], string>>): void {
  for (const key of VARIABLES) {
    const value = values[key]
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }
}

afterEach(() => {
  for (const key of VARIABLES) {
    const value = saved[key]
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }
})

/** A catalog with these settings and no sealed key. */
function catalog(settings: Record<string, unknown> = {}): Executor {
  return {
    query: async (sql: string) =>
      sql.includes('_basedb.setting')
        ? Object.entries(settings).map(([key, value]) => ({ key, value, scope_kind: 'tenant' }))
        : [],
  } as unknown as Executor
}

const ctx = { tenantId: 't4z56fq' } as RequestContext

async function failure(promise: Promise<unknown>): Promise<BasedbError> {
  try {
    await promise
  } catch (e) {
    return e as BasedbError
  }
  throw new Error('aucun refus')
}

const AZURE = 'https://atelier.openai.azure.com/openai/v1'

describe('openai_compatible', () => {
  it('goes to the operator’s address with the headers they give, and no key of its own', async () => {
    environment({
      BASEDB_AI_PROVIDER: 'openai_compatible',
      BASEDB_AI_MODEL: 'gpt-4o-mini',
      BASEDB_AI_BASE_URL: AZURE,
      BASEDB_AI_HEADERS: '{"Api-Key": "cle-azure"}',
    })
    expect(await resolveProvider(catalog(), ctx)).toEqual({
      provider: 'openai_compatible',
      model: 'gpt-4o-mini',
      apiKey: '',
      keyScope: 'instance',
      baseUrl: AZURE,
      headers: { 'api-key': 'cle-azure' },
    })
  })

  it('takes BASEDB_AI_API_KEY when one is given', async () => {
    environment({
      BASEDB_AI_PROVIDER: 'openai_compatible',
      BASEDB_AI_MODEL: 'llama3.1',
      BASEDB_AI_BASE_URL: 'http://ollama:11434/v1',
      BASEDB_AI_API_KEY: 'cle-passerelle',
    })
    expect(await resolveProvider(catalog(), ctx)).toMatchObject({
      apiKey: 'cle-passerelle',
      baseUrl: 'http://ollama:11434/v1',
    })
  })

  it('is not configured without an address', async () => {
    environment({ BASEDB_AI_PROVIDER: 'openai_compatible', BASEDB_AI_MODEL: 'gpt-4o-mini' })
    const refused = await failure(resolveProvider(catalog(), ctx))
    expect(refused.code).toBe('AI_NOT_CONFIGURED')
    expect(refused.details).toMatchObject({ setting: 'BASEDB_AI_BASE_URL' })
  })
})

describe('the address and headers of the environment', () => {
  it('also serve a vendor reached through a gateway', async () => {
    environment({
      BASEDB_AI_PROVIDER: 'anthropic',
      BASEDB_AI_MODEL: 'claude-sonnet-5',
      ANTHROPIC_API_KEY: 'cle-anthropic',
      BASEDB_AI_BASE_URL: 'https://passerelle.example.com/anthropic/v1',
      BASEDB_AI_HEADERS: '{"Ocp-Apim-Subscription-Key": "abonnement"}',
    })
    expect(await resolveProvider(catalog(), ctx)).toMatchObject({
      provider: 'anthropic',
      apiKey: 'cle-anthropic',
      baseUrl: 'https://passerelle.example.com/anthropic/v1',
      headers: { 'ocp-apim-subscription-key': 'abonnement' },
    })
  })

  it('stay with their provider: a tenant that chose another gets neither, nor the key', async () => {
    environment({
      BASEDB_AI_PROVIDER: 'openai_compatible',
      BASEDB_AI_MODEL: 'gpt-4o-mini',
      BASEDB_AI_BASE_URL: AZURE,
      BASEDB_AI_HEADERS: '{"api-key": "cle-azure"}',
      BASEDB_AI_API_KEY: 'cle-azure',
    })
    const refused = await failure(resolveProvider(catalog({ 'ai.provider': 'anthropic' }), ctx))
    expect(refused.code).toBe('AI_NOT_CONFIGURED')
    expect(refused.details).toMatchObject({ secret: 'ai.anthropic.api_key' })

    process.env.ANTHROPIC_API_KEY = 'cle-anthropic'
    const config = await resolveProvider(catalog({ 'ai.provider': 'anthropic' }), ctx)
    expect(config).toEqual({
      provider: 'anthropic',
      model: 'gpt-4o-mini',
      apiKey: 'cle-anthropic',
      keyScope: 'instance',
    })
  })

  it('refuse what they cannot send', () => {
    for (const [BASEDB_AI_BASE_URL, BASEDB_AI_HEADERS, setting] of [
      ['atelier.openai.azure.com', '', 'BASEDB_AI_BASE_URL'],
      ['ftp://atelier.example.com', '', 'BASEDB_AI_BASE_URL'],
      ['', 'api-key: cle', 'BASEDB_AI_HEADERS'],
      ['', '["api-key", "cle"]', 'BASEDB_AI_HEADERS'],
      ['', '{"api-key": 42}', 'BASEDB_AI_HEADERS'],
      ['', '{"api key": "cle"}', 'BASEDB_AI_HEADERS'],
      ['', '{"api-key": "cle\\r\\nx-autre: 1"}', 'BASEDB_AI_HEADERS'],
    ]) {
      let refused: BasedbError | null = null
      try {
        endpointFromEnv({ BASEDB_AI_BASE_URL, BASEDB_AI_HEADERS })
      } catch (e) {
        refused = e as BasedbError
      }
      expect(refused?.code, `${BASEDB_AI_BASE_URL}${BASEDB_AI_HEADERS}`).toBe('AI_NOT_CONFIGURED')
      expect(refused?.details).toMatchObject({ setting })
    }
  })

  it('are nothing when unset or empty', () => {
    expect(endpointFromEnv({})).toEqual({})
    expect(endpointFromEnv({ BASEDB_AI_BASE_URL: ' ', BASEDB_AI_HEADERS: '' })).toEqual({})
  })
})
