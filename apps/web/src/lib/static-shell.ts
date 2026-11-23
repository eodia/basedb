/**
 * The interface built as static files (`BASEDB_WEB_STATIC=1`, next.config.ts), served by
 * basedb-server without Node (rust-server/crates/web).
 *
 * A static build cannot know the reader, nor the token in `/v/<jeton>`: each kind of page
 * is exported once, as a shell, and the server fills it as it serves it. The markers below
 * are the contract between the two sides — change them together.
 */

/** Whether this build is the static one: inlined at build time (next.config.ts `env`). */
export const STATIC_BUILD = process.env.BASEDB_WEB_STATIC_BUILT === '1'

/**
 * The one value a dynamic segment is exported with: `/v/__shell__`, `/__shell__` for any
 * other address. The server serves that shell for every token, every address.
 */
export const SHELL_SEGMENT = '__shell__'

/** `<html lang>` of a shell, replaced with the reader's language. */
export const SHELL_LOCALE = '__basedb_locale__'

/**
 * The id of the shell's script: its content (JSON) says what to fill in — the description in
 * French, translated by the server —, and the server puts in its place the description and
 * the script the layout writes otherwise (`window.__BASEDB_API__`… and the messages).
 */
export const SHELL_RUNTIME = '__basedb_runtime__'

/** `generateStaticParams` of a `[token]` segment: the shell alone, nothing outside static. */
export function shellTokens(): { token: string }[] {
  return STATIC_BUILD ? [{ token: SHELL_SEGMENT }] : []
}
