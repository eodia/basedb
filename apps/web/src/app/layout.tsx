import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'basedb',
  description: 'Des tables PostgreSQL que l’on peut lire en SQL',
}

/**
 * Rendered on EVERY request, never prerendered.
 *
 * Without this the route is static: Next renders the layout once, writes the result into
 * `.next/cache`, and serves those bytes afterwards — including the `window.__BASEDB_API__`
 * line below. Since `scripts/start.mjs` picks a free port on each run, the second run
 * inherits the first one's address and the interface calls a port nobody listens on,
 * showing "L'API ne répond pas" with nothing to explain why. Two development servers
 * sharing one `.next` do it to each other too.
 *
 * `force-dynamic` is what makes the comment below true. Reading the variable in a server
 * component is not enough on its own; the component has to actually run again.
 */
export const dynamic = 'force-dynamic'

/**
 * The API address is handed to the BROWSER, not inlined at build time.
 *
 * `next.config.env` freezes the value into the bundle at compile time: a `next build`
 * run without the variable burns the fallback address into it, and the development
 * server then reuses that cache. Read here instead, at the moment it matters.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const api = process.env.BASEDB_API ?? 'http://localhost:8787'

  return (
    <html lang="fr">
      <head>
        {/* An origin, not code: serialized as JSON so that no value can close the
            tag. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: passing runtime configuration to the client has no other path in Next 15
          dangerouslySetInnerHTML={{ __html: `window.__BASEDB_API__=${JSON.stringify(api)}` }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
