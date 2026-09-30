import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { type Locale, SOURCE_LOCALE, isLocale } from '@basedb/contracts'
import {
  type BasedbError,
  type FileStorageConfig,
  OIDC_PRESETS,
  type OidcProvider,
  endpointFromEnv,
  parseAddress,
  parseTrusted,
  smtpMailer,
  startKernel,
} from '@basedb/core'
import { serve } from '@hono/node-server'
import { providerTransport } from './ai-transport.js'
import { createApp } from './app.js'
import { type DemoConfig, demoTransport } from './demo.js'

/**
 * Server startup — chapter 10 §9.2.
 *
 * The adapter knows nothing of the database beyond its connection string, which it
 * hands to the kernel without ever opening it itself.
 */

/**
 * A variable of the environment, EMPTY COUNTING AS UNSET: `KEY=` in a `.env` file, or
 * `${KEY:-}` in a compose file, means "not given". Taken as a value, an empty
 * `BASEDB_ADMIN_PASSWORD` would become the administrator's password, and an empty
 * `BASEDB_ORIGINS` would refuse every browser.
 */
function setting(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? undefined : value
}

/**
 * The path basedb is served under, behind a gateway at `https://gateway.exemple.fr/basedb/`:
 * `BASEDB_BASE_PATH`, else the path of `BASEDB_PUBLIC_URL` — `/basedb`, or empty at the root.
 */
function basePathOf(): string {
  // Empty counts as unset, as everywhere in the compose file; `/` says the root.
  let raw = setting('BASEDB_BASE_PATH')
  if (raw === undefined) {
    const publicUrl = setting('BASEDB_PUBLIC_URL')
    try {
      raw = publicUrl === undefined ? '' : new URL(publicUrl).pathname
    } catch {
      raw = ''
    }
  }
  const trimmed = raw.trim().replace(/[/]+$/, '')
  return trimmed === '' ? '' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
const basePath = basePathOf()

const connectionString = setting('DATABASE_URL')
if (connectionString === undefined) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

/**
 * Delivery, when the operator has configured one — chapter 16 §2.4.
 *
 * `BASEDB_SMTP_HOST` set: the operator's relay, `BASEDB_MAIL_FROM` the sender every mail
 * carries. The port is 587 by default, secured by STARTTLS; 465 is TLS from the first
 * byte; `BASEDB_SMTP_SECURE=none` sends in clear, for a relay on the same host only.
 *
 * `BASEDB_DEV_MAIL=1` prints the message instead of sending it — a development
 * affordance, OFF by default and named as such, because a reset link written to a log
 * file is a reset link anyone holding that file can use. With neither, nothing leaves
 * and the way back in is the operational command of chapter 13 §7.
 */
function mailTransport() {
  const host = setting('BASEDB_SMTP_HOST')
  if (host !== undefined) {
    const from = parseAddress(setting('BASEDB_MAIL_FROM') ?? '')
    if (from === null) {
      console.error(
        'BASEDB_SMTP_HOST is set, but BASEDB_MAIL_FROM is not an address (basedb <no-reply@exemple.fr>).',
      )
      process.exit(1)
    }
    const port = Number(setting('BASEDB_SMTP_PORT') ?? '587')
    const secure = setting('BASEDB_SMTP_SECURE') ?? (port === 465 ? 'tls' : 'starttls')
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.error('BASEDB_SMTP_PORT is not a port.')
      process.exit(1)
    }
    if (secure !== 'tls' && secure !== 'starttls' && secure !== 'none') {
      console.error('BASEDB_SMTP_SECURE is tls, starttls or none.')
      process.exit(1)
    }
    return {
      mailer: smtpMailer(
        {
          host,
          port,
          secure,
          user: setting('BASEDB_SMTP_USER') ?? null,
          password: setting('BASEDB_SMTP_PASSWORD') ?? null,
          heloName:
            setting('BASEDB_SMTP_HELO') ?? from.address.slice(from.address.indexOf('@') + 1),
        },
        from,
      ),
      said: `Courriels : SMTP ${host}:${port} (${secure}), expéditeur ${from.address}.`,
    }
  }
  if (setting('BASEDB_DEV_MAIL') === '1') {
    return {
      mailer: async (message: { to: string; subject: string; body: string }) => {
        console.log(`[courriel · développement] ${message.to} — ${message.subject}`)
        console.log(`[courriel · développement] ${message.body}`)
      },
      said: 'Courriels : affichés dans le journal (BASEDB_DEV_MAIL=1), jamais envoyés.',
    }
  }
  return { mailer: undefined, said: 'Courriels : aucun envoi (BASEDB_SMTP_HOST non défini).' }
}

const { mailer, said: mailSaid } = mailTransport()

/**
 * The geocoding service — chapter 11 §1.9: Nominatim, OpenStreetMap's, unless
 * `BASEDB_GEOCODER_URL` names another speaking its protocol, or `off`. Its policy asks a
 * `User-Agent` that names the application and where it runs.
 */
const geocoderSetting = setting('BASEDB_GEOCODER_URL')
const geocoder = {
  url:
    geocoderSetting === 'off' ? null : (geocoderSetting ?? 'https://nominatim.openstreetmap.org'),
  userAgent: `basedb (+${setting('BASEDB_PUBLIC_URL') ?? 'https://basedb.eodia.com'})`,
}

/**
 * Where the files of `file` and `image` fields go.
 *
 * `BASEDB_S3_BUCKET` set: an S3-compatible store — AWS, Scaleway, OVH, R2, Garage,
 * SeaweedFS… Otherwise a directory, `BASEDB_FILES_DIR`, by default `.basedb/files` at the
 * root of the repository: enough for one host, and said at startup.
 */
function fileStorage(): FileStorageConfig {
  const bucket = setting('BASEDB_S3_BUCKET')
  if (bucket !== undefined) {
    const missing = [
      'BASEDB_S3_ENDPOINT',
      'BASEDB_S3_ACCESS_KEY_ID',
      'BASEDB_S3_SECRET_ACCESS_KEY',
    ].filter((name) => setting(name) === undefined)
    if (missing.length > 0) {
      console.error(
        `BASEDB_S3_BUCKET is set, but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not.`,
      )
      process.exit(1)
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
  return {
    driver: 'local',
    directory:
      setting('BASEDB_FILES_DIR') ??
      fileURLToPath(new URL('../../../.basedb/files', import.meta.url)),
  }
}

const maxFileMb = Number(setting('BASEDB_FILES_MAX_MB') ?? '')

// Webhooks go to public HTTPS addresses only (chapter 08 §10.8). `BASEDB_WEBHOOK_DEV=1`
// relaxes that for a consumer on this machine — development only, and said at startup.
const webhookDev = setting('BASEDB_WEBHOOK_DEV') === '1'

// The servers of the operator's own network a webhook, an automation or a synced table may
// reach all the same — names, `*.` domains, addresses, ranges (chapter 08 §10.8).
function webhookAllow(): readonly string[] {
  try {
    return parseTrusted(setting('BASEDB_WEBHOOK_ALLOW') ?? '')
  } catch (error) {
    console.error(`BASEDB_WEBHOOK_ALLOW : ${(error as Error).message}.`)
    process.exit(1)
  }
}
const webhookTrusted = webhookAllow()

// Where a purge writes its export first (chapter 06 §5.2): on this host, never on the
// database server. `BASEDB_EXPORT_DIR`, by default `.basedb/exports` beside the files.
const exportDir =
  setting('BASEDB_EXPORT_DIR') ??
  fileURLToPath(new URL('../../../.basedb/exports', import.meta.url))

// Where the public site publishes its base templates (chapter 20 §3.1): its own address
// by default, another one to serve a catalog of one's own, `off` to read none.
const templatesSetting = setting('BASEDB_TEMPLATES_URL')
const templatesUrl =
  templatesSetting === undefined || templatesSetting === ''
    ? undefined
    : templatesSetting === 'off'
      ? null
      : templatesSetting

/** Why the catalog stops the start, in words an operator acts on. */
function catalogRefusal(error: unknown): string {
  const code = (error as { code?: string }).code
  const details = (error as { details?: Record<string, unknown> }).details ?? {}
  switch (code) {
    case 'CATALOG_VERSION_AHEAD':
      return `Cette base a été mise à jour par une version plus récente de basedb (catalogue en version ${String(details.recorded)}, ce code s’arrête à la ${String(details.shipped)}) : démarrez une version au moins aussi récente. Le retour arrière d’un catalogue n’existe pas — restaurez la sauvegarde d’avant la mise à jour pour revenir en arrière.`
    case 'CATALOG_CHECKSUM_MISMATCH':
      return `La migration de catalogue ${String(details.name)} enregistrée dans cette base n’est pas celle de ce code : la base ou le code a été modifié. Arrêt, pour ne rien écrire dans un catalogue dont l’histoire est inconnue.`
    case 'CATALOG_DRIFT':
      return `Le schéma _basedb de cette base n’est pas un catalogue basedb reconnu (${JSON.stringify(details)}).`
    case 'LOCK_UNAVAILABLE':
      return 'Un autre processus met le catalogue à jour depuis plus de cinq minutes : vérifiez-le (pg_locks, verrou consultatif 1, 1), puis redémarrez.'
    default:
      return `Mise à jour du catalogue impossible : ${error instanceof Error ? error.message : String(error)}`
  }
}

/**
 * Sign-in providers — chapter 13 §3 — declared in the environment:
 *
 *   BASEDB_OIDC_PROVIDERS=google,microsoft
 *   BASEDB_OIDC_GOOGLE_CLIENT_ID=…            BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…
 *   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<organisation>/v2.0
 *
 * Per provider, `_ISSUER` (a preset's by default), `_LABEL`, `_SCOPES`, `_TRUSTED_DOMAINS`,
 * and `_SIGNUP=off` to admit existing accounts only: otherwise a first sign-in creates the
 * account as the sign-up policy says. An incomplete provider is left out, and said so.
 */
function oidcProviders(): OidcProvider[] {
  const slugs = (setting('BASEDB_OIDC_PROVIDERS') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '')
  const domains = (value: string | undefined) =>
    (value ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter((d) => d !== '')

  const providers: OidcProvider[] = []
  for (const slug of slugs) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      console.error(
        `BASEDB_OIDC_PROVIDERS : « ${slug} » n’est pas un nom (lettres, chiffres, tirets).`,
      )
      continue
    }
    const name = (key: string) => `BASEDB_OIDC_${slug.toUpperCase().replace(/-/g, '_')}_${key}`
    const preset = OIDC_PRESETS[slug]
    const issuer = setting(name('ISSUER')) ?? preset?.issuer
    const clientId = setting(name('CLIENT_ID'))
    const clientSecret = setting(name('CLIENT_SECRET'))
    const missing = [
      issuer === undefined ? name('ISSUER') : null,
      clientId === undefined ? name('CLIENT_ID') : null,
      clientSecret === undefined ? name('CLIENT_SECRET') : null,
    ].filter((m) => m !== null)
    if (issuer === undefined || clientId === undefined || clientSecret === undefined) {
      console.error(
        `Connexion « ${slug} » ignorée : ${missing.join(', ')} ${missing.length > 1 ? 'manquants' : 'manquant'}.`,
      )
      continue
    }
    providers.push({
      slug,
      label: setting(name('LABEL')) ?? preset?.label ?? slug,
      issuer,
      clientId,
      clientSecret,
      scopes: setting(name('SCOPES')) ?? preset?.scopes ?? 'openid email profile',
      provisioning: setting(name('SIGNUP')) === 'off' ? 'off' : 'signup',
      provisioningDomains: [],
      trustedDomains: domains(setting(name('TRUSTED_DOMAINS'))),
    })
  }
  if (providers.length > 0) {
    const publicUrl = setting('BASEDB_PUBLIC_URL')
    console.log(
      `Connexion : ${providers.map((p) => p.label).join(', ')}. Adresse de retour à déclarer chez chacun : ${
        publicUrl === undefined
          ? '<BASEDB_PUBLIC_URL>/auth/oidc/<nom>/callback — BASEDB_PUBLIC_URL n’est pas défini'
          : `${publicUrl.replace(/\/$/, '')}/auth/oidc/<nom>/callback`
      }.`,
    )
  }
  return providers
}

const kernel = startKernel({
  oidcProviders: oidcProviders(),
  webhookTargets: { allowHttp: webhookDev, allowPrivate: webhookDev, trusted: webhookTrusted },
  exportDir,
  templatesUrl,
  connectionString,
  encryptionKey: setting('BASEDB_ENCRYPTION_KEY'),
  mailer,
  publicUrl: setting('BASEDB_PUBLIC_URL'),
  geocoder,
  files: {
    storage: fileStorage(),
    maxBytes: Number.isFinite(maxFileMb) && maxFileMb > 0 ? maxFileMb * 1024 * 1024 : undefined,
  },
})
console.log(`Fichiers : ${kernel.files.storage}.`)
console.log(mailSaid)
if (basePath !== '')
  console.log(`Chemin : servi sous ${basePath}/ (BASEDB_BASE_PATH ou chemin de BASEDB_PUBLIC_URL).`)
console.log(
  geocoder.url === null
    ? 'Géocodage : aucun (BASEDB_GEOCODER_URL=off).'
    : `Géocodage : ${geocoder.url}.`,
)
console.log(`Exports avant purge : ${exportDir}.`)
console.log(
  templatesUrl === null
    ? 'Modèles : catalogue du site non lu (BASEDB_TEMPLATES_URL=off).'
    : `Modèles : catalogue du site ${templatesUrl ?? 'public'} — intégrés en secours.`,
)
if (webhookDev) {
  console.log(
    'Webhooks : mode développement — HTTP et adresses locales acceptés (BASEDB_WEBHOOK_DEV=1).',
  )
}
if (webhookTrusted.length > 0) {
  console.log(
    `Webhooks : serveurs internes acceptés — ${webhookTrusted.join(', ')} (BASEDB_WEBHOOK_ALLOW).`,
  )
}
// The environment's AI provider, read once here: a mistyped name, address or header object
// is said at startup, not discovered later as « IA non configurée » in the interface.
const aiProvider = setting('BASEDB_AI_PROVIDER')
if (aiProvider !== undefined) {
  try {
    const { baseUrl } = endpointFromEnv(process.env)
    if (!['openai', 'anthropic', 'mistral', 'openai_compatible'].includes(aiProvider)) {
      console.error(
        `IA : BASEDB_AI_PROVIDER « ${aiProvider} » inconnu — openai, anthropic, mistral ou openai_compatible.`,
      )
    } else if (aiProvider === 'openai_compatible' && baseUrl === undefined) {
      console.error('IA : openai_compatible sans BASEDB_AI_BASE_URL, l’adresse du serveur.')
    } else {
      console.log(
        `IA : ${aiProvider}${baseUrl === undefined ? '' : ` à ${new URL(baseUrl).origin}`}.`,
      )
    }
  } catch (error) {
    console.error(
      (error as BasedbError).details?.setting === 'BASEDB_AI_HEADERS'
        ? 'IA : BASEDB_AI_HEADERS doit être un objet JSON de chaînes : {"api-key":"…"}.'
        : 'IA : BASEDB_AI_BASE_URL n’est pas une adresse http(s).',
    )
  }
}
const port = Number(setting('PORT') ?? 8787)

/**
 * The public demo — `BASEDB_DEMO=1`, see `demo.ts`. Its shared accounts, published for
 * the login form to prefill:
 *
 *   BASEDB_DEMO_ACCOUNTS=fr=demo@demo.com,en=demo-en@demo.com,…   one per language
 *   BASEDB_DEMO_PASSWORD=…                                          theirs, the same for all
 *
 * The operator creates them, each with its project, before turning the demo on; the
 * administrator stays apart, with a password of its own. Without BASEDB_DEMO_ACCOUNTS,
 * the one shared account is the administrator the environment names, with the password
 * it gives — reapplied at every start.
 */
let demo: DemoConfig | undefined
if (setting('BASEDB_DEMO') === '1') {
  const listed = (setting('BASEDB_DEMO_ACCOUNTS') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
  if (listed.length > 0) {
    const accounts: Array<{ locale: Locale; email: string }> = []
    for (const entry of listed) {
      const [locale, email] = entry.split('=').map((part) => part.trim())
      if (!isLocale(locale) || email === undefined || !email.includes('@')) {
        console.error(
          `BASEDB_DEMO_ACCOUNTS : « ${entry} » n’est pas une langue et une adresse (fr=demo@demo.com).`,
        )
        process.exit(1)
      }
      accounts.push({ locale, email })
    }
    const password = setting('BASEDB_DEMO_PASSWORD')
    if (password === undefined) {
      console.error(
        'BASEDB_DEMO_ACCOUNTS demande BASEDB_DEMO_PASSWORD, le mot de passe des comptes de la démo.',
      )
      process.exit(1)
    }
    demo = { accounts, password }
  } else {
    const email = setting('BASEDB_ADMIN_EMAIL')
    const password = setting('BASEDB_ADMIN_PASSWORD')
    if (email === undefined || password === undefined) {
      console.error(
        'BASEDB_DEMO=1 : sans BASEDB_DEMO_ACCOUNTS, le compte de la démo est l’administrateur que nomment BASEDB_ADMIN_EMAIL et BASEDB_ADMIN_PASSWORD, qui manquent.',
      )
      process.exit(1)
    }
    demo = { accounts: [{ locale: SOURCE_LOCALE, email }], password }
  }
  console.log(
    `Démo publique : ${demo.accounts.map((a) => `${a.email} (${a.locale})`).join(', ')}, identifiants publiés ; créations et suppressions refusées, IA factice.`,
  )
}
// The demo's AI calls no provider, the work in the background included.
const aiTransport = demo === undefined ? providerTransport : demoTransport

/**
 * The catalog — chapter 02, « Amorçage ». `BASEDB_MIGRATE=1` (the image's default) brings
 * it to the version this code ships: a fresh database gets all of it, an installation of
 * an earlier version what it lacks. Otherwise it is only checked, and a catalog that is
 * behind stops the start: this code would query tables it does not have yet.
 */
try {
  if (setting('BASEDB_MIGRATE') === '1') {
    const applied = await kernel.migrateCatalog({
      onApplied: (name, ms) => console.log(`Catalogue : ${name} appliquée (${ms} ms).`),
      onWaiting: () => console.log('Catalogue : un autre processus le met à jour, attente…'),
    })
    const state = await kernel.catalogStatus()
    console.log(
      applied === 0
        ? `Catalogue à jour (version ${state.applied}).`
        : `Catalogue mis à jour : version ${state.applied}.`,
    )
  } else {
    const state = await kernel.catalogStatus()
    if (state.pending.length > 0) {
      console.error(
        `Le catalogue est en version ${state.applied}, ce code attend la version ${state.shipped} (${state.pending.join(', ')}) : démarrez une fois avec BASEDB_MIGRATE=1.`,
      )
      process.exit(1)
    }
  }
} catch (error) {
  console.error(catalogRefusal(error))
  process.exit(1)
}

// The bootstrapped administrator's ADDRESS, published in development so the login form
// can prefill it. Its password is never served over HTTP.
let developmentEmail: string | undefined

/**
 * The first administrator — chapter 13 §7.
 *
 * Named by the operator (`BASEDB_ADMIN_EMAIL`), the server creates it here. Otherwise
 * nobody is invented: the first person to open the interface creates it, with their own
 * address and password. A built-in address would be the same everywhere, and one no
 * mail ever reaches.
 */
if (setting('BASEDB_BOOTSTRAP') === '1') {
  const tenantRef = setting('BASEDB_TENANT') ?? 't4z56fq'
  const adminEmail = setting('BASEDB_ADMIN_EMAIL')
  const given = setting('BASEDB_ADMIN_PASSWORD')

  if (adminEmail === undefined && (await kernel.bootstrapOpen())) {
    console.log(
      'Aucun administrateur : la première personne qui ouvre l’interface le crée. Ouvrez-la avant de publier l’instance sur un domaine.',
    )
  } else if (adminEmail !== undefined || given !== undefined) {
    const a = await kernel.bootstrap({ tenantRef, email: adminEmail }).catch((error: unknown) => {
      if (adminEmail !== undefined) throw error
      // No address to create one with, and an administrator exists — but not in this
      // tenant: `BASEDB_TENANT` changed since.
      console.error(
        `BASEDB_ADMIN_PASSWORD ignoré : aucun administrateur dans le tenant ${tenantRef}.`,
      )
      return null
    })
    if (a !== null) {
      // Only by the start that has just created the instance, and only in development: a
      // container restarting with `BASEDB_BOOTSTRAP=1` on every boot must not keep
      // publishing the address, and a production one must never publish it.
      if (!a.alreadyDone && setting('BASEDB_DEV_LOGIN') === '1') developmentEmail = a.email

      // The administrator needs a password, or the instance has an account nobody can
      // use. Given explicitly — and then reapplied at every start, to take back control —
      // or generated and PRINTED ONCE, because a default password shipped with the
      // product is the same password everywhere.
      const password = given ?? `basedb-${randomBytes(9).toString('base64url')}`
      if (!a.alreadyDone || given !== undefined) {
        await kernel.setPassword({ userId: a.userId, password })
      }

      console.log(`${a.alreadyDone ? 'Bootstrap already done' : 'Bootstrapped'} — ${a.email}`)
      if (given === undefined && !a.alreadyDone) {
        console.log(`Mot de passe administrateur (affiché une seule fois) : ${password}`)
      }
    }
  }
}

// Unset: any `localhost` origin is accepted (development).
const raw = setting('BASEDB_ORIGINS')
const allowedOrigins =
  raw === undefined
    ? undefined
    : raw
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o !== '')

const app = createApp({
  kernel,
  allowedOrigins,
  developmentEmail,
  // Stated by the operator, never inferred from a `Host` header a caller controls: the
  // provider compares this return address character for character with the one
  // registered against the client identifier.
  publicUrl: setting('BASEDB_PUBLIC_URL'),
  basePath,
  tenantRef: setting('BASEDB_TENANT'),
  demo,
})

// The history drain runs in the serving process (chapter 07 §1.4): without it, writes
// are captured but never reach the journals. The automations' AI steps call the provider
// through the same transport as the AI cells (chapter 17 §1.3).
kernel.startBackground({ aiTransport })
// The listening connection (chapter 10 §3.1): the drain woken by each write, the live
// signals relayed to the browsers (chapter 16 §3). Down, it retries on its own.
void kernel.live.start()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`basedb API on http://localhost:${info.port}`)
})

// The AI fields are filled here, in the API process and nowhere else: the MCP server
// answers agents, it does not run background work. `BASEDB_AI_WORKER=0` switches it off —
// for a second API process sharing the database, where one worker is enough.
if (setting('BASEDB_AI_WORKER') !== '0') {
  kernel.startAiWorker(aiTransport, {
    onError: (error) => console.error('Champs IA :', error),
  })
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void kernel.close().then(() => process.exit(0))
  })
}
