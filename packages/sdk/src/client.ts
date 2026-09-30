import { BasedbError } from './errors.js'
import type { BaseSummary, Member, MetaBase } from './meta.js'
import type {
  BaseTypes,
  IsoDateTime,
  Schema,
  TableTypes,
  Untyped,
  WithLinkIds,
  WriteValues,
} from './values.js'

/**
 * basedb's REST API (chapter 08) from TypeScript — the same API the interface uses, with the
 * rights of the token and nothing more.
 *
 *   const db = new Basedb<Schema>({ url: 'https://basedb.example.com', token })
 *   const deals = db.base('b_t4z56fq_ventes').table('opportunites')
 *   for await (const deal of deals.all({ filter: filter`statut eq ${'gagne'}` })) …
 *
 * `Schema` is what `basedb-sdk types` generates from the instance: the rows are then typed,
 * a choice list is the union of its values, and a table or a field that does not exist is
 * an error before the program runs. Without it, rows are plain records.
 */

export interface BasedbOptions {
  /** Where basedb is served: `https://basedb.example.com`. */
  readonly url: string
  /** An integration token (`bdb_…`), created from the base's menu › API et agents. */
  readonly token: string
  /** The workspace, as the API addresses name it: `t4z56fq` unless the instance sets `BASEDB_TENANT`. */
  readonly workspace?: string
  /** Another `fetch`: a proxy, a test, a runtime without a global one. */
  readonly fetch?: (input: string, init: RequestInit) => Promise<Response>
  /** How many times a request basedb asked to slow down (429) is tried again. Default 2. */
  readonly retries?: number
}

type Query = Readonly<Record<string, string | number | boolean | undefined>>

interface Call {
  readonly query?: Query
  readonly json?: unknown
  readonly body?: BodyInit
  readonly headers?: Readonly<Record<string, string>>
}

/** Every transaction a write made, kept beside the row it answered: what `undo` needs. */
const transactions = new WeakMap<object, string>()

// A mapped constraint rather than `Schema`: an interface has no implicit index signature.
export class Basedb<S extends { readonly [B in keyof S]: BaseTypes } = Untyped> {
  readonly #root: string
  readonly #prefix: string
  readonly #token: string
  readonly #fetch: (input: string, init: RequestInit) => Promise<Response>
  readonly #retries: number

  constructor(options: BasedbOptions) {
    this.#root = options.url.trim().replace(/\/+$/, '')
    this.#prefix = `/api/v1/${encodeURIComponent(options.workspace ?? 't4z56fq')}`
    this.#token = options.token
    this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
    this.#retries = options.retries ?? 2
  }

  /** A base, by its technical name (`b_t4z56fq_ventes`). */
  base<B extends keyof S & string>(name: B): Base<S[B]> {
    return new Base<S[B]>(this as unknown as Basedb<Schema>, name)
  }

  /** The bases the token opens. */
  async bases(): Promise<BaseSummary[]> {
    return (await this.json<{ data: BaseSummary[] }>('GET', '/meta/bases')).data
  }

  /** The people of the workspace — who a Person field can name. */
  async users(): Promise<Member[]> {
    return (await this.json<{ data: Member[] }>('GET', '/meta/users')).data
  }

  /**
   * Undoes a write — the transaction a row answered by `create` or `update` came with
   * (`db.transactionOf(row)`), or its id. Refused if the row changed since.
   */
  async undo(write: object | string): Promise<{ transaction: string }> {
    const transaction = typeof write === 'string' ? write : this.transactionOf(write)
    if (transaction === undefined) {
      throw new TypeError('This row did not come from a write of this client')
    }
    const answer = await this.json<{ data: { transaction: string } }>('POST', '/history/undo', {
      json: { transaction },
    })
    return { transaction: answer.data.transaction }
  }

  /** The transaction of a row that `create` or `update` answered. */
  transactionOf(row: object): string | undefined {
    return transactions.get(row)
  }

  /** Runs an automation started by a button, for one row; basedb queues it (`run`). */
  async runAutomation(automation: string, record: string): Promise<{ run: string }> {
    return (
      await this.json<{ data: { run: string } }>(
        'POST',
        `/automations/${encodeURIComponent(automation)}/run`,
        { json: { record } },
      )
    ).data
  }

  /** Any route of the API, under `/api/v1/<workspace>` — for what this client does not name. */
  async request(method: string, path: string, call: Call = {}): Promise<Response> {
    const url = new URL(`${this.#root}${this.#prefix}${path}`)
    for (const [key, value] of Object.entries(call.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.#token}`,
      accept: 'application/json',
      ...(call.json === undefined ? {} : { 'content-type': 'application/json' }),
      ...call.headers,
    }
    const body = call.json === undefined ? call.body : JSON.stringify(call.json)
    for (let attempt = 0; ; attempt++) {
      const response = await this.#fetch(url.toString(), { method, headers, body })
      // 429: basedb refused before doing anything, so asking again is always safe.
      if (response.status === 429 && attempt < this.#retries) {
        const after = Number(response.headers.get('retry-after'))
        const seconds = Number.isFinite(after) && after > 0 ? Math.min(after, 30) : 2 ** attempt
        await new Promise((r) => setTimeout(r, seconds * 1000))
        continue
      }
      if (!response.ok) throw await BasedbError.from(response)
      return response
    }
  }

  /** @internal A route answering JSON. */
  async json<T>(method: string, path: string, call: Call = {}): Promise<T> {
    const response = await this.request(method, path, call)
    return (response.status === 204 ? undefined : await response.json()) as T
  }

  /** @internal A write: its row, its transaction remembered beside it. */
  async write<T extends object>(method: string, path: string, call: Call): Promise<T> {
    const response = await this.request(method, path, call)
    const row = ((await response.json()) as { data: T }).data
    const transaction = response.headers.get('x-basedb-transaction')
    if (transaction !== null) transactions.set(row, transaction)
    return row
  }

  /** @internal An address of the instance itself — a file's signed link. */
  absolute(path: string): string {
    return path.startsWith('/') ? `${this.#root}${path}` : path
  }
}

export class Base<T> {
  constructor(
    readonly db: Basedb<Schema>,
    /** The technical name: `b_t4z56fq_ventes`. */
    readonly name: string,
  ) {}

  /** A table, by its technical name (`opportunites`). */
  table<N extends keyof T & string>(name: N): Table<T[N] extends TableTypes ? T[N] : never> {
    return new Table(this.db, this.name, name)
  }

  /** Its tables and their fields, as the token sees them. */
  async describe(): Promise<MetaBase> {
    return (
      await this.db.json<{ data: MetaBase }>('GET', `/meta/bases/${encodeURIComponent(this.name)}`)
    ).data
  }
}

/** What a page of rows is asked with. */
export interface ListOptions {
  /** basedb's filter — best written with the `filter` template: filter`statut eq ${value}`. */
  readonly filter?: string
  /** Technical names, a minus sign for descending: `'-montant,nom'` or `['-montant', 'nom']`. */
  readonly sort?: string | readonly string[]
  /** Rows per page: 50 by default, 500 at most. */
  readonly limit?: number
  /** Where the previous page stopped: its `next`. */
  readonly after?: string
  /** Long texts as written, `{{colonne}}` included, rather than with the row's values. */
  readonly variables?: 'raw'
  /** Also count every row the filter keeps (capped at 100 000). */
  readonly count?: boolean
}

export interface Page<R> {
  readonly rows: R[]
  /** Where the next page starts — `after` —, or `null` on the last one. */
  readonly next: string | null
  /** With `count: true`: the rows the filter keeps, and whether that count was capped. */
  readonly count?: number
  readonly countCapped?: boolean
}

/** A row deleted since an instant: what a mirror removes (chapter 08 §6.5). */
export interface Deletion {
  readonly _id: string
  readonly deleted_at: IsoDateTime
  readonly deleted_by: string | null
  readonly cause: string
}

export interface Comment {
  readonly id: string
  readonly record_id: string
  readonly author: { readonly id: string; readonly name: string }
  readonly body: string
  readonly mentions: readonly string[]
  readonly created_at: IsoDateTime
  readonly edited_at: IsoDateTime | null
}

/** A summary of `aggregate`: `sum`, `avg`, `min`, `max`, `filled`, `empty`, `unique`, `checked`. */
export type Aggregate = 'sum' | 'avg' | 'min' | 'max' | 'filled' | 'empty' | 'unique' | 'checked'

/** A file deposited with `upload`: written into a row by its `id`. */
export interface Upload {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly size: number
}

type Read<T extends TableTypes> = T['read']

export class Table<T extends TableTypes> {
  readonly #db: Basedb<Schema>
  readonly #path: string

  constructor(
    db: Basedb<Schema>,
    readonly base: string,
    /** The technical name: `opportunites`. */
    readonly name: string,
  ) {
    this.#db = db
    this.#path = `/data/${encodeURIComponent(base)}/${encodeURIComponent(name)}`
  }

  /** One page of rows. */
  list(options?: ListOptions & { readonly links?: 'display' }): Promise<Page<Read<T>>>
  list(options: ListOptions & { readonly links: 'id' }): Promise<Page<WithLinkIds<Read<T>>>>
  async list(
    options: ListOptions & { readonly links?: 'display' | 'id' } = {},
  ): Promise<Page<unknown>> {
    const body = await this.#db.json<{
      data: unknown[]
      meta: {
        next_cursor: string | null
        has_next_page: boolean
        count?: number | null
        count_is_capped?: boolean
      }
    }>('GET', this.#path, {
      query: {
        filter: options.filter,
        sort: Array.isArray(options.sort) ? options.sort.join(',') : (options.sort as string),
        limit: options.limit,
        after: options.after,
        links: options.links,
        variables: options.variables,
        count: options.count === true ? 'exact' : undefined,
      },
    })
    return {
      rows: body.data,
      next: body.meta.has_next_page ? body.meta.next_cursor : null,
      ...(typeof body.meta.count === 'number'
        ? { count: body.meta.count, countCapped: body.meta.count_is_capped === true }
        : {}),
    }
  }

  /** Every row a filter keeps, page after page, as they are needed. */
  all(
    options?: Omit<ListOptions, 'after' | 'count'> & { readonly links?: 'display' },
  ): AsyncIterable<Read<T>>
  all(
    options: Omit<ListOptions, 'after' | 'count'> & { readonly links: 'id' },
  ): AsyncIterable<WithLinkIds<Read<T>>>
  async *all(
    options: Omit<ListOptions, 'after' | 'count'> & { readonly links?: 'display' | 'id' } = {},
  ): AsyncIterable<unknown> {
    let after: string | undefined
    do {
      const page: Page<unknown> = await this.list({
        ...options,
        limit: options.limit ?? 200,
        after,
      } as ListOptions & { links: 'id' })
      yield* page.rows
      after = page.next ?? undefined
    } while (after !== undefined)
  }

  /** The first row a filter keeps, in the order asked, or `null`. */
  async first(
    options: Omit<ListOptions, 'after' | 'limit' | 'count'> = {},
  ): Promise<Read<T> | null> {
    return (await this.list({ ...options, limit: 1 })).rows[0] ?? null
  }

  /** How many rows a filter keeps — capped at 100 000. */
  async count(filter?: string): Promise<number> {
    return (await this.list({ filter, limit: 1, count: true })).count ?? 0
  }

  /** One row, by its `_id`. */
  get(
    id: string,
    options?: { readonly links?: 'display'; readonly variables?: 'raw' },
  ): Promise<Read<T>>
  get(
    id: string,
    options: { readonly links: 'id'; readonly variables?: 'raw' },
  ): Promise<WithLinkIds<Read<T>>>
  async get(
    id: string,
    options: { readonly links?: 'display' | 'id'; readonly variables?: 'raw' } = {},
  ): Promise<unknown> {
    return (
      await this.#db.json<{ data: unknown }>('GET', `${this.#path}/${encodeURIComponent(id)}`, {
        query: { links: options.links, variables: options.variables },
      })
    ).data
  }

  /** Adds a row; answers it as stored — links as their `_id`. */
  create(values: T['create']): Promise<WithLinkIds<Read<T>>> {
    return this.#db.write('POST', this.#path, { json: { values } })
  }

  /** Adds rows, all or none: one refused, and nothing is written (1 000 at most). */
  async createMany(rows: readonly T['create'][]): Promise<string[]> {
    const answer = await this.#db.json<{
      results: Array<{ index: number; status: string; id?: string }>
    }>('POST', `${this.#path}/batch`, {
      json: { atomic: true, operations: rows.map((data) => ({ op: 'create', data })) },
    })
    return answer.results.map((r) => r.id ?? '')
  }

  /** Changes fields of a row; a field left out stays as it is, `null` empties it. */
  update(id: string, values: T['update']): Promise<WithLinkIds<Read<T>>> {
    return this.#db.write('PATCH', `${this.#path}/${encodeURIComponent(id)}`, {
      json: { values },
    })
  }

  /**
   * Deletes a row — with a session's rights: an integration token never deletes
   * (`ADMIN_REQUIRED`).
   */
  async delete(id: string): Promise<void> {
    await this.#db.request('DELETE', `${this.#path}/${encodeURIComponent(id)}`)
  }

  /**
   * Summaries over every row a filter keeps: `{ montant: 'sum', nom: 'filled' }`, and with
   * `group`, the count of each value of that field (500 values at most).
   */
  async aggregate(options: {
    readonly aggregates: Readonly<Record<string, Aggregate>>
    readonly filter?: string
    readonly group?: string
  }): Promise<{
    total: number
    values: Record<string, unknown>
    groups: Array<{ value: unknown; count: number }> | null
    groupsCapped: boolean
  }> {
    const answer = await this.#db.json<{
      data: {
        total: number
        values: Record<string, unknown>
        groups: Array<{ value: unknown; count: number }> | null
        groups_capped: boolean
      }
    }>('GET', `${this.#path}/aggregate`, {
      query: {
        aggregates: Object.entries(options.aggregates)
          .map(([field, fn]) => `${field}:${fn}`)
          .join(','),
        filter: options.filter,
        group: options.group,
      },
    })
    const { total, values, groups, groups_capped } = answer.data
    return { total, values, groups, groupsCapped: groups_capped }
  }

  /** The rows deleted since an instant — with the rows changed since, what keeps a mirror. */
  async *deletedSince(since: IsoDateTime | Date): AsyncIterable<Deletion> {
    let cursor: string | undefined
    do {
      const page = await this.#db.json<{ data: Deletion[]; meta: { next_cursor: string | null } }>(
        'GET',
        `${this.#path}/deleted`,
        { query: { since: since instanceof Date ? since.toISOString() : since, cursor } },
      )
      yield* page.data
      cursor = page.meta.next_cursor ?? undefined
    } while (cursor !== undefined)
  }

  /** The comments of a row, and adding one — an @mention notifies the person. */
  comments(id: string): { list(): Promise<Comment[]>; add(body: string): Promise<Comment> } {
    const path = `${this.#path}/${encodeURIComponent(id)}/comments`
    return {
      list: async () => (await this.#db.json<{ data: Comment[] }>('GET', path)).data,
      add: async (body) =>
        (await this.#db.json<{ data: Comment }>('POST', path, { json: { body } })).data,
    }
  }

  /**
   * Deposits a file for a Document or Image field; the row then cites it:
   * `update(id, { devis: [file.id] })`. An image is checked in its bytes (PNG, JPEG, GIF,
   * WebP, AVIF).
   */
  async upload(
    field: string,
    data: Blob | ArrayBuffer | Uint8Array,
    options: { readonly name: string; readonly type?: string },
  ): Promise<Upload> {
    const type =
      options.type ??
      (data instanceof Blob && data.type !== '' ? data.type : 'application/octet-stream')
    return (
      await this.#db.json<{ data: Upload }>(
        'POST',
        `/files/${encodeURIComponent(this.base)}/${encodeURIComponent(this.name)}/${encodeURIComponent(field)}`,
        {
          query: { name: options.name },
          body: data as BodyInit,
          headers: { 'content-type': type },
        },
      )
    ).data
  }

  /** A file's address, whole: the `url` a row gives is signed, and relative to the instance. */
  fileUrl(file: { readonly url: string }): string {
    return this.#db.absolute(file.url)
  }
}

export type { WriteValues }
