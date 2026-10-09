import { once } from 'node:events'
import { type Server, createServer } from 'node:https'
import type { AddressInfo } from 'node:net'
import {
  type BasedbError,
  type ProviderTransport,
  endpointFromEnv,
  verifiesProviderCertificate,
} from '@basedb/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { providerTransport } from '../../src/ai-transport.js'

/**
 * `BASEDB_AI_PROVIDER_SSL_VERIFY` — chapter 12 §2.3. A provider behind a certificate the
 * instance cannot check (a self-signed gateway, a re-signing proxy) is refused by default,
 * and reached once the operator says so — for the environment's provider, and for its
 * calls alone.
 *
 * The server below is a real HTTPS server with a self-signed certificate for 127.0.0.1,
 * made for this test and trusted by nothing.
 */

const CERT = [
  '-----BEGIN CERTIFICATE-----',
  'MIIDJzCCAg+gAwIBAgIUY0yEnNoEpsN1nK4o24mYkkjIf/EwDQYJKoZIhvcNAQEL',
  'BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MTAwOTE0NTc0NloYDzIxMjYw',
  'OTE1MTQ1NzQ2WjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEB',
  'AQUAA4IBDwAwggEKAoIBAQDqCPEGiIlnLfo0IEGpt1Fs88SE5DHaWKpbQii9Kgqm',
  '0KS34UjA5VnctD+ZTA8SrcBn9IryVihEjFjK6pw9brncj1mr77OSHbS34tTKtLMk',
  'QNjrM8OCdkwk8rZJqtFKZIjML/frD4DdNk7HS2sC6IW9lgusRpbApt9tWC7tXycV',
  'OUcxq300trczEc+NXp6mvOiepl4soOouB8o0PimnV56PEZ27OHUCpoi50uK8+Trg',
  '4W3CdUq5ua7FGsAENYAjVR6OCPJY9KEtlA+s3BtvOyhEL5VCNLovnyLb4XtgOoqy',
  'WDFR+r8cxq/jk/A+hDC6px1pETiKFheGjWX7WrgyGqkzAgMBAAGjbzBtMB0GA1Ud',
  'DgQWBBRDrR6vke+yamkvmeQlvwo4OsFH1TAfBgNVHSMEGDAWgBRDrR6vke+yamkv',
  'meQlvwo4OsFH1TAPBgNVHRMBAf8EBTADAQH/MBoGA1UdEQQTMBGHBH8AAAGCCWxv',
  'Y2FsaG9zdDANBgkqhkiG9w0BAQsFAAOCAQEAsSYjz/iLfKYJzZWmqO12byvp/Ruo',
  'r7BhRvucHRgdkzScMtZckQ1SUC7C3P6GMIAlfNCRQdZDHS3/KFJybxTa4Jhfcy8r',
  '340vG3aZkixUOw6sM2nmw812Gg4HyCvILdvfauNnVDXHj1m++8iah6fuTfYetnRE',
  '9hD592TD5eJC8gjClKzdK19CNH8kYSdYfxGOE/YUZKBh+jj++uf58e9KayCFWnP5',
  'ksxn6R8jJTMPoFUqatdtnUwX4NeJJImq3uxn0hRMlanjUFYZ7+A6gHfU9gsehx72',
  'qB2AvxtuzNTAVP6JirK2yfRQ99J+NkvEdtN5+x4RbEYWyrBBz8o7B/7rhw==',
  '-----END CERTIFICATE-----',
].join('\n')

const KEY = [
  '-----BEGIN PRIVATE KEY-----',
  'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDqCPEGiIlnLfo0',
  'IEGpt1Fs88SE5DHaWKpbQii9Kgqm0KS34UjA5VnctD+ZTA8SrcBn9IryVihEjFjK',
  '6pw9brncj1mr77OSHbS34tTKtLMkQNjrM8OCdkwk8rZJqtFKZIjML/frD4DdNk7H',
  'S2sC6IW9lgusRpbApt9tWC7tXycVOUcxq300trczEc+NXp6mvOiepl4soOouB8o0',
  'PimnV56PEZ27OHUCpoi50uK8+Trg4W3CdUq5ua7FGsAENYAjVR6OCPJY9KEtlA+s',
  '3BtvOyhEL5VCNLovnyLb4XtgOoqyWDFR+r8cxq/jk/A+hDC6px1pETiKFheGjWX7',
  'WrgyGqkzAgMBAAECggEAZMDQstVZAfiDPKmeWyg2f8c6FVQAOlXtkTgcPcO5rjMo',
  'lpkALzsNwrw+nQpnes0ehiJ7JvT8hPY+y6zQ8omWrmNwYVriXcc4I+odXd8JOFRK',
  'jodMZf/zq/xpibFmRLafRfhorOORwKo+pAHN4gSkfwf3ooUJJYsxqOtL2JkcRD//',
  'lFvzpf3XY5kZEPEkc3UlT876sTPocVzyZPimY9H6DXEvCsMJw5mtZ6Xzir6SI1az',
  'Fbog6ldjuYdm8zMtGVUbFSwvvZlTUw69UeXd3XDgBC2IonbZUJ/N4qspolsqz29C',
  'lABp7dCwAf5PwEAUvD5/wyP6fHsVFGr/UDD+L5Xo4QKBgQD8CRLWfHG6NxaNtBpH',
  'bugBEOAE3QQm4F3MROgkNG4n6za4XcF2UPT1oC0OqyR+yLBrtvivhsWcb7NH/x7f',
  'iAoKVRmkQ5273Ol4mBp/OlofIumiRRD2LzjILPpso8Pr/PyvUP4fhKHE4j+EqVir',
  'PuwV7Fc+GYXuwxGskbBbm4vgyQKBgQDtt2GcfEMNVwCkD1x/+IncDt674koNUEO8',
  'VYx31+o6DWxXBTcTigwnyOrimV68HQwX1efeEQiq+l5WJu5yeOcfFwZOoTT9Htor',
  'EHHWiZCBDdeEZqINgHQDqfmnz4dSoXMUqBf9YEOR5au6Ve3d9xnY7Nv4laQykUm2',
  'qWnF49hUGwKBgQDOKvX38nBtraaLYCqnCHhMdutpzwoYay0Pbcaf5yu9B9IJWtho',
  '2qynSNHSz/jYpX57fn9LxmlcIJt9Z5pvrC7aaObC0nTzOjDZ70KtlKQoGD0Z+nl3',
  'iQVf6jsoJ4abQqXJG+3lBm/2SEVBVe4slxo0jNKJAAPpXjTU/5BOP51a0QKBgQCt',
  'bX2cUhgFMnU4PDDK+ENztbGQN265OdbBH1TE1lR/F+3zqs1cxvlJSU78FNLFwRdi',
  'iF+KZrkBLHoItox+HXDZAM5MLVZgWNLoWi4DTAeN79BNOyd9XDrHtYl7gW+DvGAe',
  'MOiXpVSGq53W6vwIVU+ZMGzndhz9+3tg9UZC5pCcAwKBgQDgMCB7mIiKDwC/oKUR',
  'qhTtCvZCBXjJ8zxJ1VgMGxuccGB2Xx6DTETL5T7NpJLsW72RpH7JhnVbsAOACl8z',
  'JSEtXVxcugrT8914MJcmrbNdDLskfV+B4cPGPcgc1RdZbXoCB77VuA1QlXZ+fvCW',
  'Jmvp3wflJgnGVQ7nJOIKanUIOQ==',
  '-----END PRIVATE KEY-----',
].join('\n')

type Request = Parameters<ProviderTransport>[0]

let server: Server
let baseUrl: string

beforeAll(async () => {
  server = createServer({ cert: CERT, key: KEY }, (req, res) => {
    req.resume()
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        }),
      )
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `https://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
})

afterAll(() => {
  server.close()
})

const request = (over: Partial<Request> = {}): Request => ({
  provider: 'openai_compatible',
  model: 'modele',
  apiKey: 'cle',
  system: 'Consigne',
  payload: { question: 'q' },
  schema: { type: 'object' },
  timeoutMs: 5_000,
  baseUrl,
  ...over,
})

describe('BASEDB_AI_PROVIDER_SSL_VERIFY', () => {
  it('reads true, false, and says when it reads neither', () => {
    for (const value of [undefined, '', 'true', 'TRUE', '1', 'yes', 'on']) {
      expect(verifiesProviderCertificate(value)).toBe(true)
    }
    for (const value of ['false', 'False', '0', 'no', 'off', ' false ']) {
      expect(verifiesProviderCertificate(value)).toBe(false)
    }
    expect(verifiesProviderCertificate('peut-être')).toBeNull()
  })

  it('goes with the environment’s endpoint — and only when it reads false', () => {
    expect(endpointFromEnv({ BASEDB_AI_PROVIDER_SSL_VERIFY: 'false' })).toEqual({
      verifyCertificate: false,
    })
    expect(endpointFromEnv({ BASEDB_AI_PROVIDER_SSL_VERIFY: 'true' })).toEqual({})
    expect(endpointFromEnv({ BASEDB_AI_PROVIDER_SSL_VERIFY: 'peut-être' })).toEqual({})
    expect(endpointFromEnv({})).toEqual({})
  })

  it('refuses a provider whose certificate it cannot check, by default', async () => {
    const error = (await providerTransport(request()).catch((e) => e)) as BasedbError
    expect(error.code).toBe('AI_PROVIDER_UNAVAILABLE')
  })

  it('reaches it once the operator switches the check off', async () => {
    const answer = await providerTransport(request({ verifyCertificate: false }))
    expect(answer).toEqual({ text: '{"ok":true}', inputTokens: 3, outputTokens: 2 })
  })

  it('leaves every other call checking certificates — the next one included', async () => {
    await providerTransport(request({ verifyCertificate: false }))
    const error = (await providerTransport(request()).catch((e) => e)) as BasedbError
    expect(error.code).toBe('AI_PROVIDER_UNAVAILABLE')
    await expect(fetch(baseUrl)).rejects.toThrow()
  })
})
