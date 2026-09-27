import type { BasedbError, ProviderTransport } from '@basedb/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attemptFor, providerTransport, under } from '../../src/ai-transport.js'

/**
 * The AI transport — chapter 12 §2. What is checked here is where a call goes and with
 * which headers: the vendors' own addresses by default, the operator's otherwise — an
 * Azure deployment, a gateway, a local model —, their headers added to every call.
 */

type Request = Parameters<ProviderTransport>[0]

const request = (over: Partial<Request> = {}): Request => ({
  provider: 'openai',
  model: 'modele',
  apiKey: 'cle',
  system: 'Consigne',
  payload: { question: 'q' },
  schema: { type: 'object' },
  timeoutMs: 5_000,
  ...over,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('under', () => {
  it('appends the operation to the path, and keeps the query string after it', () => {
    expect(under('https://api.openai.com/v1', '/chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions',
    )
    expect(under('https://atelier.openai.azure.com/openai/v1/', '/chat/completions')).toBe(
      'https://atelier.openai.azure.com/openai/v1/chat/completions',
    )
    expect(
      under(
        'https://atelier.openai.azure.com/openai/deployments/gpt-4o?api-version=2024-10-21',
        '/chat/completions',
      ),
    ).toBe(
      'https://atelier.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21',
    )
  })
})

describe('attemptFor', () => {
  it('calls each vendor at its own address, with its own key header', () => {
    const openai = attemptFor(request())
    expect(openai.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(openai.headers).toEqual({
      authorization: 'Bearer cle',
      'content-type': 'application/json',
    })

    const anthropic = attemptFor(request({ provider: 'anthropic' }))
    expect(anthropic.url).toBe('https://api.anthropic.com/v1/messages')
    expect(anthropic.headers).toMatchObject({ 'x-api-key': 'cle' })

    expect(attemptFor(request({ provider: 'mistral' })).url).toBe(
      'https://api.mistral.ai/v1/chat/completions',
    )
  })

  it('sends a compatible server OpenAI’s body, with Azure’s `api-key` and no bearer', () => {
    const azure = attemptFor(
      request({
        provider: 'openai_compatible',
        apiKey: '',
        baseUrl: 'https://atelier.openai.azure.com/openai/v1',
        headers: { 'api-key': 'cle-azure' },
      }),
    )
    expect(azure.url).toBe('https://atelier.openai.azure.com/openai/v1/chat/completions')
    expect(azure.headers).toEqual({
      'api-key': 'cle-azure',
      'content-type': 'application/json',
    })
    expect(azure.body).toMatchObject({
      model: 'modele',
      response_format: { type: 'json_object' },
    })
  })

  it('lets the operator’s headers replace the key’s, never the body’s type', () => {
    const gateway = attemptFor(
      request({
        baseUrl: 'https://passerelle.example.com/openai/v1',
        headers: { authorization: 'Bearer passerelle', 'content-type': 'text/plain' },
      }),
    )
    expect(gateway.url).toBe('https://passerelle.example.com/openai/v1/chat/completions')
    expect(gateway.headers).toEqual({
      authorization: 'Bearer passerelle',
      'content-type': 'application/json',
    })
  })

  it('refuses a compatible server without its address', () => {
    expect(() => attemptFor(request({ provider: 'openai_compatible' }))).toThrow(
      expect.objectContaining({ code: 'AI_NOT_CONFIGURED' }),
    )
  })
})

describe('providerTransport', () => {
  it('sends the call where the attempt says, and reads the answer', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"value":"oui"}' } }],
            usage: { prompt_tokens: 12, completion_tokens: 3 },
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetch)
    const answer = await providerTransport(
      request({
        provider: 'openai_compatible',
        apiKey: '',
        baseUrl: 'https://reponse.openai.azure.com/openai/v1',
        headers: { 'api-key': 'cle-azure' },
      }),
    )
    expect(answer).toEqual({ text: '{"value":"oui"}', inputTokens: 12, outputTokens: 3 })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://reponse.openai.azure.com/openai/v1/chat/completions')
    expect(init.headers).toMatchObject({ 'api-key': 'cle-azure' })
  })

  it('opens its circuit per address: a failing deployment does not close the others', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    const failing = request({
      provider: 'openai_compatible',
      baseUrl: 'https://panne.openai.azure.com/openai/deployments/absent?api-version=2024-10-21',
    })
    for (let i = 0; i < 5; i++) {
      await expect(providerTransport(failing)).rejects.toMatchObject({
        code: 'AI_PROVIDER_UNAVAILABLE',
        details: { status: 404 },
      })
    }
    expect(fetch).toHaveBeenCalledTimes(5)

    // Open: refused at once, nothing sent.
    const open = (await providerTransport(failing).catch((e) => e)) as BasedbError
    expect(open.details).toMatchObject({ provider: 'openai_compatible' })
    expect(open.details.retry_after).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledTimes(5)

    // Another address is still called.
    await providerTransport(request()).catch(() => undefined)
    expect(fetch).toHaveBeenCalledTimes(6)
  })
})
