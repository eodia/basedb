# @basedb/sdk

TypeScript client for [basedb](https://eodia.github.io/basedb/)'s REST API — tables on
PostgreSQL, with an interface for the team. Typed rows, every page, files, and the types of
your tables generated from your own instance. No dependency: the standard `fetch`, on Node 18+,
Deno, Bun and in browsers.

```bash
npm install @basedb/sdk
```

## Generate the types of your tables

```bash
BASEDB_URL=https://basedb.example.com BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Every base the token opens (or `--base <name>`, repeated), one interface per table: the row as
basedb reads it, as it is created, as it is updated. Run it again when the tables change.

## Read and write

```ts
import { Basedb, BasedbError, filter } from '@basedb/sdk'
import type { Schema } from './basedb.js'

const db = new Basedb<Schema>({ url: 'https://basedb.example.com', token: process.env.BASEDB_TOKEN! })
const deals = db.base('b_t4z56fq_ventes').table('opportunites')

const deal = await deals.create({ titre: 'Audit', montant: 12500, statut: 'nouveau' })
await deals.update(deal._id, { statut: 'gagne' })

for await (const row of deals.all({ filter: filter`statut eq ${'gagne'} and montant gte ${10000}`, sort: '-montant' })) {
  console.log(row.titre, row.montant)
}
```

- A table, a field or a choice that does not exist is a **type error**; a field basedb computes
  (formula, lookup, count, automatic number) cannot be written; a required field must be given
  to create a row.
- `filter` writes each interpolated value as a literal: a text typed by a user stays a value,
  never a piece of the filter.
- Numbers read as **decimal text** (`"12500.0000000000"`) so that no digit is lost; they are
  written as numbers or as text.
- A linked row reads as `{ id, display }` and is written by its `_id`; `links: 'id'` reads the
  `_id` alone.
- `list()` gives one page and its `next`; `all()` every page, as they are needed; `first()`,
  `count()`, `aggregate()` for the rest.
- `upload(field, bytes, { name, type })` deposits a file; the row then cites its `id`.
  `fileUrl(file)` is its signed address.
- `db.undo(row)` undoes the write that answered this row — refused if it changed since.
- A refusal is a `BasedbError`: its `code` (stable, one per cause — `VALUE_OUT_OF_CONSTRAINT`,
  `ADMIN_REQUIRED`…), `status`, `details` and `requestId`. A `429` is tried again after the
  delay basedb asks.

## Tokens

An integration token is created in basedb from the base's menu, **API et agents › Jetons API et
MCP…**. It opens one base, reads its rows, writes them if it was created with write access, and
never has more rights than the person who created it. It **deletes only if it was created to**
(« Lecture, écriture et suppression »): otherwise `delete()` is refused.

## License

MIT
