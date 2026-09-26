import { BasedbError, type ProviderTransport } from '@basedb/core'

/**
 * The AI transport — chapter 12 §2.3, the adapter's half.
 *
 * "Le noyau décide, l'adaptateur appelle." This file holds the transport, the
 * authentication, the provider-specific shape, the timeouts, the retries and the
 * normalisation — and nothing else. It cannot reach the catalog, does not know what a
 * base is, and decides nothing: it receives a system instruction, a payload and a
 * schema, and gives back text.
 *
 * Three providers, one function each, because their request bodies genuinely differ and
 * a shared abstraction over three shapes would be longer than the three shapes.
 */

interface Attempt {
  readonly url: string
  readonly headers: Record<string, string>
  readonly body: unknown
  readonly extract: (response: Record<string, unknown>) => {
    text: string
    inputTokens: number | null
    outputTokens: number | null
  }
}

/**
 * The circuit breaker of §2.4.
 *
 * Five consecutive failures on a (tenant, provider) pair open it for five minutes:
 * refused immediately, consuming neither quota nor time. Keyed by provider alone here —
 * the transport does not know the tenant, and must not be told, since knowing it is the
 * first step towards deciding something with it.
 */
const breaker = new Map<string, { failures: number; openUntil: number }>()
const BREAKER_THRESHOLD = 5
const BREAKER_MS = 5 * 60_000

function instruction(system: string, schema: Record<string, unknown>): string {
  return `${system}\n\nSCHÉMA DE LA RÉPONSE :\n${JSON.stringify(schema, null, 2)}`
}

function attemptFor(request: Parameters<ProviderTransport>[0]): Attempt {
  const system = instruction(request.system, request.schema)
  const user = JSON.stringify(request.payload)

  switch (request.provider) {
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': request.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: {
          model: request.model,
          max_tokens: request.maxTokens ?? 2048,
          system,
          messages: [{ role: 'user', content: user }],
        },
        extract: (response) => {
          const content = response.content as ReadonlyArray<{ type: string; text?: string }>
          const usage = response.usage as
            | { input_tokens?: number; output_tokens?: number }
            | undefined
          return {
            text: (content ?? [])
              .filter((part) => part.type === 'text')
              .map((part) => part.text ?? '')
              .join(''),
            inputTokens: usage?.input_tokens ?? null,
            outputTokens: usage?.output_tokens ?? null,
          }
        },
      }

    case 'openai':
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${request.apiKey}`,
        },
        body: {
          model: request.model,
          // JSON mode rather than a strict schema: the kernel validates the object
          // itself, so the provider's own validator would be a second, weaker one.
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        extract: (response) => {
          const choices = response.choices as ReadonlyArray<{ message?: { content?: string } }>
          const usage = response.usage as
            | { prompt_tokens?: number; completion_tokens?: number }
            | undefined
          return {
            text: choices?.[0]?.message?.content ?? '',
            inputTokens: usage?.prompt_tokens ?? null,
            outputTokens: usage?.completion_tokens ?? null,
          }
        },
      }

    case 'mistral':
      return {
        url: 'https://api.mistral.ai/v1/chat/completions',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${request.apiKey}`,
        },
        body: {
          model: request.model,
          ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        extract: (response) => {
          const choices = response.choices as ReadonlyArray<{ message?: { content?: string } }>
          const usage = response.usage as
            | { prompt_tokens?: number; completion_tokens?: number }
            | undefined
          return {
            text: choices?.[0]?.message?.content ?? '',
            inputTokens: usage?.prompt_tokens ?? null,
            outputTokens: usage?.completion_tokens ?? null,
          }
        },
      }
  }
}

/**
 * Calls a provider, once, with one immediate retry on `429`, `5xx` and network errors.
 *
 * No queue and no deferred retry (§2.4): "un brouillon livré dix minutes plus tard n'a
 * plus d'objet". No automatic fallback to another provider either — the tenant consented
 * to a NAMED provider, and a fallback would send their payload to a third party they
 * never agreed to, to spare them an error message.
 */
export const providerTransport: ProviderTransport = async (request) => {
  const state = breaker.get(request.provider)
  if (state !== undefined && state.openUntil > Date.now()) {
    throw new BasedbError('AI_PROVIDER_UNAVAILABLE', {
      details: {
        provider: request.provider,
        retry_after: Math.ceil((state.openUntil - Date.now()) / 1000),
      },
    })
  }

  const attempt = attemptFor(request)
  const deadline = Date.now() + Math.max(1_000, request.timeoutMs)
  let lastStatus: number | null = null

  for (let round = 0; round < 2; round++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)

    try {
      const response = await fetch(attempt.url, {
        method: 'POST',
        headers: attempt.headers,
        body: JSON.stringify(attempt.body),
        signal: controller.signal,
      })

      if (response.ok) {
        const body = (await response.json()) as Record<string, unknown>
        breaker.delete(request.provider)
        return attempt.extract(body)
      }

      lastStatus = response.status
      // A 401 is the recipient's verdict on the key, not a transient failure: retrying
      // it is pointless and a second wrong attempt can get the key rate-limited.
      if (response.status === 401 || response.status === 403) break
      if (response.status !== 429 && response.status < 500) break

      // Respect an announced delay when it fits in the remaining budget.
      const retryAfter = Number(response.headers.get('retry-after') ?? '0')
      const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : 0
      if (wait > 0 && Date.now() + wait < deadline) {
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
    } catch {
      // Network error or abort: one more round if the budget allows.
    } finally {
      clearTimeout(timer)
    }
  }

  const current = breaker.get(request.provider) ?? { failures: 0, openUntil: 0 }
  const failures = current.failures + 1
  breaker.set(request.provider, {
    failures,
    openUntil: failures >= BREAKER_THRESHOLD ? Date.now() + BREAKER_MS : 0,
  })

  throw new BasedbError('AI_PROVIDER_UNAVAILABLE', {
    details: { provider: request.provider, status: lastStatus },
  })
}
