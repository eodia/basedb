/**
 * What basedb's REST API reads and writes, value by value (basedb chapter 08 §7.2).
 *
 * A number is ALWAYS decimal text — `"1250.50"` —, never a JavaScript number: `JSON.parse`
 * would round any amount beyond fifteen significant digits without a word. It is written as
 * a number or as text. Dates are ISO text, instants in UTC. A linked row reads as its `_id`
 * and the value of its display field, and is written by its `_id` alone.
 */

/** A number as basedb reads it: decimal text, never rounded — `"1250.5000000000"`. */
export type Decimal = string

/** A date: `"2026-09-18"`. */
export type IsoDate = string

/** An instant, in UTC: `"2026-09-18T14:03:00.000Z"`. */
export type IsoDateTime = string

/** A linked row, read with `links: 'display'` (the default). */
export interface LinkValue {
  readonly id: string | null
  readonly display: string | null
  /** The row exists but is hidden from the reader: neither its id nor its value is said. */
  readonly masked?: true
}

/** A file of a Document or Image field; `url` is signed, and expires within hours. */
export interface FileValue {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly size: number
  readonly url: string
}

/** The columns every row has, readable by whoever reads the row. */
export interface SystemColumns {
  readonly _id: string
  readonly _created_at: IsoDateTime
  readonly _updated_at: IsoDateTime
  readonly _created_by: string | null
  readonly _updated_by: string | null
}

/** A linked row as it is written: its `_id`, or what a read gave back. */
export type LinkWrite = string | { readonly id: string }

/** A file as it is written into a row: the id `upload` returned, or what a read gave back. */
export type FileWrite = string | { readonly id: string }

/** A row of a table whose types were not generated. */
export type Row = SystemColumns & Readonly<Record<string, unknown>>

/** A value as it is sent: what a program may hand, before JSON. */
export type WriteValues = Readonly<Record<string, unknown>>

type IdOf<V> = [V] extends [readonly LinkValue[]]
  ? string[]
  : [V] extends [LinkValue | null]
    ? null extends V
      ? string | null
      : string
    : V

/** A row read with `links: 'id'` — and as a write answers: each link as its `_id` alone. */
export type WithLinkIds<R> = { readonly [K in keyof R]: IdOf<R[K]> }

/** The three shapes of a table's rows: read, created, updated. */
export interface TableTypes {
  readonly read: object
  readonly create: object
  readonly update: object
}

/** The tables of a base, by technical name. */
export type BaseTypes = { readonly [table: string]: TableTypes }

/** The bases of a workspace, by technical name — what `basedb-sdk types` generates. */
export type Schema = { readonly [base: string]: BaseTypes }

/** A table whose types were not generated: plain records. */
export interface UntypedTable {
  readonly read: Row
  readonly create: WriteValues
  readonly update: WriteValues
}

/** A workspace whose types were not generated. */
export type Untyped = { readonly [base: string]: { readonly [table: string]: UntypedTable } }
