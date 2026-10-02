import { highlights, prepare, scoreOf, tokensOf } from '@/lib/search'

/**
 * What the picker of an automation's steps — and of its trigger — lists for a text typed:
 * the search of the command palette (`lib/search.ts`), over a few dozen entries, each by
 * its label, its hint and words it answers to. Kept apart from the dialog so that what a
 * word finds can be tested.
 */

export interface PickerEntry {
  /** The kind it adds: `email`, `date_reached`. */
  readonly id: string
  /** The category it is listed under. */
  readonly category: string
  readonly label: string
  readonly hint: string
  /** Other words it answers to, in the reader's language: « pdf facture » for a document. */
  readonly keywords: string
}

export interface PickerMatch<E extends PickerEntry> {
  readonly entry: E
  /** The code points of its label to highlight. */
  readonly lit: ReadonlySet<number>
}

export interface PickerResult<E extends PickerEntry> {
  /**
   * What is listed: in the catalogue's order while nothing is typed, the best first once
   * something is.
   */
  readonly matches: readonly PickerMatch<E>[]
  /** How many each category holds — of those the text finds, once one is typed. */
  readonly counts: Readonly<Record<string, number>>
  /** How many the text finds, every category together. */
  readonly total: number
}

/**
 * The entries a text finds, in a category or in all (`null`). Accents and case aside, by
 * word starts, initials and slips; a word must be found in the label, the hint or the
 * words it answers to — `facture` finds « Générer un PDF ».
 */
export function pickerMatches<E extends PickerEntry>(
  entries: readonly E[],
  query: string,
  category: string | null,
): PickerResult<E> {
  const tokens = tokensOf(query)
  const found =
    tokens.length === 0
      ? entries.map((entry, index) => ({ entry, score: 0, index }))
      : entries
          .map((entry, index) => ({
            entry,
            index,
            score: scoreOf(
              tokens,
              prepare({ title: entry.label, keywords: `${entry.hint} ${entry.keywords}` }),
            ),
          }))
          .filter((m) => m.score > 0)
          // Among equals, the catalogue's order: the list holds still as one types.
          .sort((a, b) => b.score - a.score || a.index - b.index)
  const counts: Record<string, number> = {}
  for (const { entry } of found) counts[entry.category] = (counts[entry.category] ?? 0) + 1
  return {
    matches: found
      .filter((m) => category === null || m.entry.category === category)
      .map(({ entry }) => ({ entry, lit: highlights(entry.label, tokens) })),
    counts,
    total: found.length,
  }
}
