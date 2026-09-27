import { describe, expect, it } from 'vitest'
import { demoRefusal, demoTransport } from '../../src/demo.js'

/**
 * The public demo — what a visitor may do. Reading and editing what exists pass; creating
 * and deleting are refused by name, the AI with its own sentence, and a route nobody named
 * is refused too.
 */

const T = '/api/v1/t4z56fq'

const refused = (method: string, path: string) => demoRefusal(method, path)?.code ?? null
const reason = (method: string, path: string) => demoRefusal(method, path)?.details.reason

describe('demoRefusal', () => {
  it('lets every read through, and the preflights', () => {
    expect(refused('GET', `${T}/data/ventes/clients`)).toBeNull()
    expect(refused('GET', `${T}/admin/users`)).toBeNull()
    expect(refused('OPTIONS', `${T}/admin/bases`)).toBeNull()
  })

  it('lets the session through: signing in and out, the token, the elevation', () => {
    expect(refused('POST', '/auth/password/login')).toBeNull()
    expect(refused('POST', '/auth/session/access')).toBeNull()
    expect(refused('DELETE', '/auth/session')).toBeNull()
    expect(refused('POST', '/auth/elevate')).toBeNull()
  })

  it('lets a row be edited and the edit taken back', () => {
    expect(refused('PATCH', `${T}/data/ventes/clients/0190a0b2`)).toBeNull()
    expect(refused('POST', `${T}/history/undo`)).toBeNull()
    expect(refused('POST', `${T}/history/42/revert`)).toBeNull()
  })

  it('lets the structure as it stands be changed: a field, a view, their order', () => {
    expect(refused('PATCH', `${T}/admin/bases/ventes/tables/clients/fields/statut`)).toBeNull()
    expect(refused('PUT', `${T}/admin/bases/ventes/tables/clients/fields/order`)).toBeNull()
    expect(refused('PATCH', `${T}/admin/bases/ventes/tables/clients/views/0190`)).toBeNull()
    expect(refused('PUT', `${T}/admin/bases/ventes/tables/clients/views/order`)).toBeNull()
  })

  it('refuses every creation', () => {
    for (const path of [
      `${T}/admin/projects`,
      `${T}/admin/bases`,
      `${T}/admin/bases/ventes/tables`,
      `${T}/admin/bases/ventes/tables/clients/fields`,
      `${T}/admin/bases/ventes/tables/clients/views`,
      `${T}/data/ventes/clients`,
      `${T}/data/ventes/clients/batch`,
      `${T}/data/ventes/clients/0190/comments`,
      `${T}/files/ventes/clients/photo`,
      `${T}/admin/users`,
      `${T}/admin/tokens`,
      `${T}/sharing/base/0190/invitations`,
      '/auth/signup',
      '/api/v1/forms/abc',
    ]) {
      expect([path, refused('POST', path)]).toEqual([path, 'ACTION_FORBIDDEN'])
      expect(reason('POST', path)).toBe('demo')
    }
  })

  it('refuses every deletion, and the account’s own settings', () => {
    expect(refused('DELETE', `${T}/admin/bases/ventes`)).toBe('ACTION_FORBIDDEN')
    expect(refused('DELETE', `${T}/data/ventes/clients/0190`)).toBe('ACTION_FORBIDDEN')
    expect(refused('DELETE', '/auth/sessions')).toBe('ACTION_FORBIDDEN')
    expect(refused('POST', '/auth/password/change')).toBe('ACTION_FORBIDDEN')
    expect(refused('PATCH', '/auth/me')).toBe('ACTION_FORBIDDEN')
    expect(refused('PUT', '/auth/me/email')).toBe('ACTION_FORBIDDEN')
  })

  it('refuses what reaches beyond the instance: automations, links, webhooks', () => {
    expect(refused('PATCH', `${T}/admin/bases/ventes/automations/0190`)).toBe('ACTION_FORBIDDEN')
    expect(refused('PUT', `${T}/admin/bases/ventes/tables/clients/views/0190/share`)).toBe(
      'ACTION_FORBIDDEN',
    )
    expect(refused('PATCH', `${T}/admin/webhooks/0190`)).toBe('ACTION_FORBIDDEN')
  })

  it('answers the AI routes with the AI’s own refusal, the schedule preview aside', () => {
    expect(refused('POST', `${T}/ai/bases/ventes/copilot`)).toBe('AI_DISABLED')
    expect(reason('POST', `${T}/ai/bases/ventes/copilot`)).toBe('demo')
    expect(refused('POST', `${T}/admin/templates/draft`)).toBe('AI_DISABLED')
    expect(refused('POST', `${T}/admin/bases/ventes/tables/avis/fields/sentiment/ai/run`)).toBe(
      'AI_DISABLED',
    )
    expect(refused('POST', `${T}/ai/schedule/preview`)).toBeNull()
  })
})

describe('demoTransport', () => {
  it('calls no provider, and says why', async () => {
    await expect(
      demoTransport({
        provider: 'mistral',
        model: 'modele',
        apiKey: 'cle',
        system: 'Consigne',
        payload: {},
        schema: { type: 'object' },
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: 'AI_DISABLED', details: { reason: 'demo' } })
  })
})
