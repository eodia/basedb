import type { Row } from '@/components/app/grid/cell'
import { type TableRef, api } from '@/lib/api/client'

/**
 * Every row a view needs, page after page, up to a ceiling.
 *
 * A calendar or a timeline shows a WINDOW — a month, a few weeks — and the rows of that
 * window are what it asks for, by a date clause joined to the view's filter. Within it,
 * pages are walked by cursor, never by offset (ch. 11 §1.2), and the ceiling keeps a
 * window that holds too much from loading the table: past it, the screen says so rather
 * than pretending it showed everything.
 */
export async function loadRows(
  table: TableRef,
  options: { readonly filter: string; readonly sort: string; readonly ceiling: number },
): Promise<{ readonly rows: Row[]; readonly capped: boolean }> {
  const rows: Row[] = []
  let after: string | undefined
  while (rows.length < options.ceiling) {
    const page = await api.list(table, {
      filter: options.filter,
      sort: options.sort,
      // The kernel's own ceiling per page.
      limit: Math.min(500, options.ceiling - rows.length),
      after,
    })
    rows.push(...(page.data as Row[]))
    if (!page.meta.has_next_page || page.meta.next_cursor === null) {
      return { rows, capped: false }
    }
    after = page.meta.next_cursor
  }
  return { rows, capped: true }
}
