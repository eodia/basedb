import type { Metadata } from 'next'
import { connection } from 'next/server'
import { I18nRoot } from '@/components/i18n-root'
import { $t } from '@/lib/i18n'
import { i18nScript, messagesOf, requestLocale, translate } from '@/lib/i18n-server'
import { SHELL_LOCALE, SHELL_RUNTIME, STATIC_BUILD } from '@/lib/static-shell'
import '../styles/globals.css'

const description = () => $t('Des tables PostgreSQL que l’on peut lire en SQL')

export async function generateMetadata(): Promise<Metadata> {
  // A static shell: basedb-server writes the description, in the reader's language.
  if (STATIC_BUILD) return { title: 'basedb' }
  const messages = await messagesOf(await requestLocale())
  return {
    title: 'basedb',
    description: translate(messages, description()),
  }
}

/**
 * Rendered on EVERY request, never prerendered — `connection()` below; the static build
 * (lib/static-shell.ts) excepted, whose server fills the shell on every request instead.
 *
 * Without this the route is static: Next renders the layout once, writes the result into
 * `.next/cache`, and serves those bytes afterwards — including the `window.__BASEDB_API__`
 * line below. Since `scripts/start.mjs` picks a free port on each run, the second run
 * inherits the first one's address and the interface calls a port nobody listens on,
 * showing "L'API ne répond pas" with nothing to explain why. Two development servers
 * sharing one `.next` do it to each other too.
 *
 * `connection()` is what makes the comment below true — what `dynamic = 'force-dynamic'`
 * did, which a static export refuses even unread. Reading the variable in a server
 * component is not enough on its own; the component has to actually run again.
 */

/**
 * The API address is handed to the BROWSER, not inlined at build time.
 *
 * `next.config.env` freezes the value into the bundle at compile time: a `next build`
 * run without the variable burns the fallback address into it, and the development
 * server then reuses that cache. Read here instead, at the moment it matters.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (STATIC_BUILD) return <StaticShell>{children}</StaticShell>
  await connection()
  // `||`, not `??`: an empty variable (`BASEDB_API=` in a `.env` file) means unset. A value
  // starting with `/` is this page's own origin — the Docker image (docker/start.mjs).
  const api = process.env.BASEDB_API || 'http://localhost:8787'
  // The MCP entry point, shown in the configuration an agent's client needs.
  const mcp = process.env.BASEDB_MCP || ''
  // The map's tiles (chapter 11 §1.9): OpenStreetMap's unless the operator names others.
  const tiles = {
    url: process.env.BASEDB_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      process.env.BASEDB_MAP_ATTRIBUTION ||
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }
  // The reader's language, and its messages — before any script of the application runs.
  const locale = await requestLocale()
  const messages = await messagesOf(locale)

  return (
    <html lang={locale}>
      <head>
        {/* Origins, not code: serialized as JSON so that no value can close the tag. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: passing runtime configuration to the client has no other path in Next 15
          dangerouslySetInnerHTML={{
            __html: `window.__BASEDB_API__=${JSON.stringify(api)};window.__BASEDB_MCP__=${JSON.stringify(mcp)};window.__BASEDB_TILES__=${JSON.stringify(tiles).replace(/</g, '\\u003c')};${i18nScript(locale, messages)}`,
          }}
        />
      </head>
      <body>
        <I18nRoot>{children}</I18nRoot>
      </body>
    </html>
  )
}

/**
 * The layout of the static build: what to fill in, not the values — the server replaces the
 * language and the script (rust-server/crates/web), with what the layout above writes.
 */
function StaticShell({ children }: { children: React.ReactNode }) {
  const fill = JSON.stringify({ description: description() }).replace(/</g, '\\u003c')
  return (
    <html lang={SHELL_LOCALE}>
      <head>
        <script
          id={SHELL_RUNTIME}
          type="application/json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the server's instructions, serialized as JSON
          dangerouslySetInnerHTML={{ __html: fill }}
        />
      </head>
      <body>
        <I18nRoot>{children}</I18nRoot>
      </body>
    </html>
  )
}
