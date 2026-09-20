import { BasedbError } from '../errors/index.js'
import type { Executor, Pools } from '../runtime/pool.js'
import { unseal } from './sealing.js'

/**
 * OIDC provider configuration — chapter 13 §3.2.
 *
 * A provider is declared AT INSTANCE LEVEL, and a tenant may only restrict the list to
 * those it accepts — never declare one. The asymmetry is deliberate: choosing a provider
 * is choosing who signs the identities of one's users, hence the power to manufacture
 * them. That is an operator's act, not a tenant's.
 *
 * The client secret lives in `_basedb.secret`, sealed by the instance key, so a copy of
 * the database is not a copy of the credentials.
 */

/** Presets shipped with the product (§3.1). A generic provider needs none. */
export const PRESETS: Readonly<
  Record<string, { readonly label: string; readonly scopes: string }>
> = {
  google: { label: 'Google Workspace', scopes: 'openid email profile' },
  entra: { label: 'Microsoft Entra ID', scopes: 'openid email profile' },
  keycloak: { label: 'Keycloak', scopes: 'openid email profile' },
}

export interface OidcProvider {
  readonly slug: string
  readonly label: string
  /** Discovery document URL, or the issuer from which it is derived. */
  readonly issuer: string
  readonly clientId: string
  readonly clientSecret: string
  readonly scopes: string
  /** `off` (default) or `domains`, with an explicit list. Never anything else. */
  readonly provisioning: 'off' | 'domains'
  readonly provisioningDomains: readonly string[]
  /**
   * Providers trusted to have verified the address on these domains, which is the only
   * case where a missing `email_verified` is accepted (§3.4 point 5).
   */
  readonly trustedDomains: readonly string[]
}

interface SettingRow extends Record<string, unknown> {
  readonly key: string
  readonly value: unknown
  readonly scope_kind: 'instance' | 'tenant'
}

const PREFIX = 'auth.oidc.'

/**
 * Reads the declared providers, then removes those the tenant does not accept.
 *
 * Two-stage resolution, like every setting: the instance declares, the tenant may
 * narrow. A tenant setting naming a provider the instance never declared adds nothing —
 * there is no configuration behind the name.
 */
export async function loadProviders(
  exec: Executor,
  instanceKey: string,
  tenantRef: string,
): Promise<readonly OidcProvider[]> {
  const settings = await exec.query<SettingRow>(
    `SELECT s.key, s.value, s.scope_kind
       FROM _basedb.setting s
       LEFT JOIN _basedb.tenant t ON t.id = s.tenant_id
      WHERE s.key LIKE $1
        AND (s.scope_kind = 'instance' OR t.ref = $2)`,
    [`${PREFIX}%`, tenantRef],
  )

  const declared = new Map<string, Record<string, unknown>>()
  let accepted: readonly string[] | null = null

  for (const row of settings) {
    if (row.key === `${PREFIX}accepted` && row.scope_kind === 'tenant') {
      accepted = Array.isArray(row.value) ? (row.value as string[]) : null
      continue
    }
    // `auth.oidc.<slug>.<property>` — the slug cannot contain a dot, by the alphabet of
    // chapter 01.
    const rest = row.key.slice(PREFIX.length)
    const dot = rest.indexOf('.')
    if (dot === -1) continue

    const slug = rest.slice(0, dot)
    const property = rest.slice(dot + 1)
    const entry = declared.get(slug) ?? {}
    entry[property] = row.value
    declared.set(slug, entry)
  }

  const secrets = await exec.query<{ key: string; value_encrypted: Buffer }>(
    `SELECT key, value_encrypted FROM _basedb.secret
      WHERE scope_kind = 'instance' AND key LIKE $1 AND status = 'valid'`,
    [`${PREFIX}%.client_secret`],
  )
  const secretOf = new Map(
    secrets.map((s) => [
      s.key.slice(PREFIX.length).replace('.client_secret', ''),
      s.value_encrypted,
    ]),
  )

  const providers: OidcProvider[] = []
  for (const [slug, entry] of declared) {
    // A tenant that has narrowed the list gets only what it named.
    if (accepted !== null && !accepted.includes(slug)) continue

    const issuer = text(entry.issuer)
    const clientId = text(entry.client_id)
    const sealed = secretOf.get(slug)
    // A provider missing any of the three is not half-declared, it is not declared: an
    // authorization request without a client secret would fail at the provider anyway,
    // and later, with a message the user cannot act on.
    if (issuer === null || clientId === null || sealed === undefined) continue

    const clientSecret = unseal(instanceKey, 'oidc-client-secret', sealed.toString('utf8'))
    if (clientSecret === null) continue

    const preset = PRESETS[slug] ?? PRESETS[text(entry.preset) ?? '']
    providers.push({
      slug,
      label: text(entry.label) ?? preset?.label ?? slug,
      issuer,
      clientId,
      clientSecret,
      scopes: text(entry.scopes) ?? preset?.scopes ?? 'openid email profile',
      // Anything that is not exactly `domains` is `off`: a misspelt setting must close
      // the door, not open it.
      provisioning: text(entry.provisioning) === 'domains' ? 'domains' : 'off',
      provisioningDomains: list(entry.provisioning_domains),
      trustedDomains: list(entry.trusted_domains),
    })
  }

  return providers.sort((a, b) => a.slug.localeCompare(b.slug))
}

/** The one a caller named, or the refusal §9 fixes for an undeclared slug. */
export async function requireProvider(
  pools: Pools,
  instanceKey: string,
  tenantRef: string,
  slug: string,
): Promise<OidcProvider> {
  const providers = await pools.withConnection('catalog', (exec) =>
    loadProviders(exec, instanceKey, tenantRef),
  )
  const found = providers.find((p) => p.slug === slug)
  // Undeclared, or not accepted by this tenant: one answer. Telling them apart would
  // publish the operator's list to every tenant.
  if (found === undefined) throw new BasedbError('OIDC_PROVIDER_UNKNOWN', { details: { slug } })
  return found
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function list(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase())
}
