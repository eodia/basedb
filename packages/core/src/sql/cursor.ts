import type { PoolClient } from 'pg'

/**
 * Reading no more rows than are shown — the console's and the reader's row cap.
 *
 * Without it, `pg` buffers the WHOLE result before the cap cuts it: a `SELECT *` on a
 * table of ten million rows fills the process's memory to return five hundred. A
 * cursor fetches the rows shown and one more, to know there are others; `MOVE ALL`
 * then counts the rest on the server, so the total stays exact without a row of it
 * crossing the wire.
 *
 * Wrapping the text in `SELECT * FROM (…) LIMIT n` would do the same for a `SELECT`,
 * and break everything else a console accepts — several statements, a `BEGIN`, an
 * `UPDATE … RETURNING`. A cursor is declared only for a text that reads like a query;
 * PostgreSQL refuses the rest — several statements, a `WITH` that writes, a
 * `SELECT … INTO` —, and the caller then runs the text as it always did.
 */

const CURSOR = 'basedb_rows'
const PREFIX = `DECLARE ${CURSOR} NO SCROLL CURSOR FOR `
const SAVEPOINT = 'basedb_cursor'

/** What a capped read gives back: the columns, the first rows, and how many there were. */
export interface CappedResult {
  readonly fields: ReadonlyArray<{ readonly name: string; readonly dataTypeID: number }>
  readonly rows: unknown[][]
  readonly total: number
}

/**
 * Whether the text starts like a query a cursor can hold, past its comments and opening
 * parentheses. A guess, and a cheap one: PostgreSQL has the last word.
 */
export function cursorable(sql: string): boolean {
  let rest = sql
  for (;;) {
    const trimmed = rest.replace(/^[\s(]+/, '')
    if (trimmed.startsWith('--')) {
      const end = trimmed.indexOf('\n')
      rest = end === -1 ? '' : trimmed.slice(end + 1)
    } else if (trimmed.startsWith('/*')) {
      const end = trimmed.indexOf('*/')
      rest = end === -1 ? '' : trimmed.slice(end + 2)
    } else {
      return /^(select|with|values|table)\b/i.test(trimmed)
    }
  }
}

/**
 * Reads at most `limit` rows of `sql` through a cursor, inside the transaction the caller
 * opened. `null` when PostgreSQL will not declare a cursor over the text: the savepoint
 * leaves the transaction as it was, for the caller to run the text the ordinary way.
 */
export async function readCapped(
  client: PoolClient,
  sql: string,
  limit: number,
): Promise<CappedResult | null> {
  if (!cursorable(sql)) return null
  await client.query(`SAVEPOINT ${SAVEPOINT}`)
  try {
    // Extended protocol: one statement and no more — a `;` followed by another one is
    // refused here, not run. `queryMode` is not in `pg`'s types; the driver honours it.
    const declare = { text: PREFIX + sql, queryMode: 'extended' as const }
    await client.query(declare)
  } catch (error) {
    if (!declinedByCursor(error)) throw shifted(error)
    await client.query(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`)
    return null
  }
  try {
    const page = (await client.query({
      text: `FETCH FORWARD ${limit + 1} FROM ${CURSOR}`,
      rowMode: 'array',
    })) as unknown as { fields?: CappedResult['fields']; rows?: unknown[][] }
    const rows = page.rows ?? []
    let total = rows.length
    if (rows.length > limit) {
      const rest = await client.query(`MOVE FORWARD ALL IN ${CURSOR}`)
      total += rest.rowCount ?? 0
    }
    await client.query(`CLOSE ${CURSOR}`)
    await client.query(`RELEASE SAVEPOINT ${SAVEPOINT}`)
    return { fields: page.fields ?? [], rows, total }
  } catch (error) {
    throw shifted(error)
  }
}

/**
 * A text the cursor cannot hold, rather than a query that fails: a syntax error — several
 * statements, `SELECT … INTO`, or a real mistake, which the ordinary run reports again
 * at its true position —, or a feature a cursor does not take (`WITH … INSERT`).
 */
function declinedByCursor(error: unknown): boolean {
  const code = (error as { code?: string }).code
  return code === '42601' || code === '0A000'
}

/** An error's position counted in the person's text, not in the `DECLARE` around it. */
function shifted(error: unknown): unknown {
  const pg = error as { position?: string }
  if (typeof pg.position !== 'string') return error
  const at = Number(pg.position)
  if (Number.isFinite(at) && at > PREFIX.length) pg.position = String(at - PREFIX.length)
  return error
}
