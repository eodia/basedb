import { randomBytes } from 'node:crypto'
import { startKernel } from '@basedb/core'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'

/**
 * Server startup — chapter 10 §9.2.
 *
 * The adapter knows nothing of the database beyond its connection string, which it
 * hands to the kernel without ever opening it itself.
 */

const connectionString = process.env.DATABASE_URL
if (connectionString === undefined) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

/**
 * Delivery, when the operator has configured one.
 *
 * `BASEDB_DEV_MAIL=1` prints the message instead of sending it — a development
 * affordance, OFF by default and named as such, because a reset link written to a log
 * file is a reset link anyone holding that file can use. With neither, nothing leaves
 * and the way back in is the operational command of chapter 13 §7.
 */
const mailer =
  process.env.BASEDB_DEV_MAIL === '1'
    ? async (message: { to: string; subject: string; body: string }) => {
        console.log(`[courriel · développement] ${message.to} — ${message.subject}`)
        console.log(`[courriel · développement] secret : ${message.body}`)
      }
    : undefined

const kernel = startKernel({
  connectionString,
  encryptionKey: process.env.BASEDB_ENCRYPTION_KEY,
  mailer,
})
const port = Number(process.env.PORT ?? 8787)

if (process.env.BASEDB_MIGRATE === '1') {
  const n = await kernel.migrateCatalog()
  console.log(`Catalog applied (${n} migration${n > 1 ? 's' : ''}).`)
}

// The bootstrapped administrator's ADDRESS, published so the login form can prefill it.
// Its password is printed once below and never served over HTTP.
let developmentEmail: string | undefined

if (process.env.BASEDB_BOOTSTRAP === '1') {
  const tenantRef = process.env.BASEDB_TENANT ?? 't4z56fq'
  const adminEmail = process.env.BASEDB_ADMIN_EMAIL ?? 'admin@basedb.local'
  const a = await kernel.bootstrap({
    tenantRef,
    email: adminEmail,
  })
  developmentEmail = adminEmail

  // The administrator needs a password, or the instance has an account nobody can use.
  // Given explicitly in production; generated and PRINTED ONCE in development, because
  // a default password shipped with the product is the same password everywhere.
  const given = process.env.BASEDB_ADMIN_PASSWORD
  const password = given ?? `basedb-${randomBytes(9).toString('base64url')}`
  if (!a.alreadyDone || given !== undefined) {
    await kernel.setPassword({ userId: a.userId, password })
  }

  console.log(`${a.alreadyDone ? 'Bootstrap already done' : 'Bootstrapped'} — ${adminEmail}`)
  if (given === undefined && !a.alreadyDone) {
    console.log(`Mot de passe administrateur (affiché une seule fois) : ${password}`)
  }
}

// Unset: any `localhost` origin is accepted (development).
const raw = process.env.BASEDB_ORIGINS
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
  publicUrl: process.env.BASEDB_PUBLIC_URL,
  tenantRef: process.env.BASEDB_TENANT,
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`basedb API on http://localhost:${info.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void kernel.close().then(() => process.exit(0))
  })
}
