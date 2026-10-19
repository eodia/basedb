import {
  BasedbError,
  type ExportFormat,
  type Kernel,
  RECORD_EXPORT_FORMATS,
  type RequestContext,
} from '@basedb/core'
import type { Context, Hono } from 'hono'

/**
 * `GET /api/v1/{tenantRef}/data/{base}/{table}/export` — a whole table, or a whole view,
 * as a file (chapter 08 §3.7).
 *
 * Its credential is the one of every data route: an access token in `Authorization:
 * Bearer` — a person's, which the interface mints from its session cookie with the CSRF
 * header — or an integration token. NOT the cookie itself. A cookie is sent by the browser
 * on every request to this origin, including those a foreign page provokes, and this route
 * reads for as long as the table is long: it stays behind the same door as the rows it
 * reads (chapter 13 §4). The interface fetches with its token and hands the bytes to the
 * browser as a file.
 *
 * The answer is a STREAM: the first byte leaves when the first page has been read, and the
 * next page is read only when the client has taken the one before. Everything that can be
 * refused is refused before that first byte, with the API's usual error body; a failure
 * once the file has begun tears the connection down, so a client never mistakes a file that
 * stops short for a whole one.
 */

type Variables = { requestId: string }

export interface ExportRouteDeps {
  readonly kernel: Kernel
  /** The credential check of the data routes: a person's access token, or an integration's. */
  readonly dataContext: (c: Context<{ Variables: Variables }, string>) => Promise<RequestContext>
}

const isFormat = (value: string): value is ExportFormat =>
  (RECORD_EXPORT_FORMATS as readonly string[]).includes(value)

export function mountExport(app: Hono<{ Variables: Variables }>, deps: ExportRouteDeps): void {
  // Declared before `/data/:base/:table/:id`, whose pattern it would otherwise be.
  app.get('/api/v1/:tenantRef/data/:base/:table/export', async (c) => {
    const ctx = await deps.dataContext(c)
    const table = await deps.kernel.resolveTable(ctx, c.req.param('base'), c.req.param('table'))

    const format = c.req.query('format') ?? ''
    if (!isFormat(format)) {
      throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'format' } })
    }
    const headers = c.req.query('headers') ?? 'name'
    if (headers !== 'name' && headers !== 'label') {
      throw new BasedbError('REQUEST_INVALID', { details: { parameter: 'headers' } })
    }
    const fields = (c.req.query('fields') ?? '')
      .split(',')
      .map((field) => field.trim())
      .filter((field) => field !== '')

    const exported = await deps.kernel.exportRecords(ctx, {
      tableId: table.tableId,
      format,
      headers,
      filter: c.req.query('filter'),
      sort: c.req.query('sort'),
      ...(fields.length === 0 ? {} : { fields }),
    })

    // Pulled, not pushed: the next page is read when the connection asks for more.
    const source = exported.body
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          try {
            const next = await source.next()
            if (next.done === true) {
              controller.close()
              await exported.close()
            } else {
              controller.enqueue(next.value)
            }
          } catch (error) {
            // The connection is torn down, not ended: see above.
            await exported.close()
            controller.error(error)
          }
        },
        async cancel() {
          // The client hung up: the generator's `finally` writes the audit line.
          await source.return()
          await exported.close()
        },
      },
      { highWaterMark: 0 },
    )

    return c.body(body, 200, {
      'content-type': exported.contentType,
      // The filename is the table's physical name and the day: ASCII, nothing to encode.
      'content-disposition': `attachment; filename="${exported.filename}"`,
      // Read for this person, once: no cache, shared or private, may keep it.
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      // A reverse proxy that buffers a response would hold the whole table before sending.
      'x-accel-buffering': 'no',
    })
  })
}
