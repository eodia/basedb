---
title: TypeScript SDK
description: Read and write basedb rows from TypeScript, with your tables’ types generated from your instance.
---

The **@basedb/sdk** package calls the [REST API](/basedb/en/integrations/api-rest/) from
TypeScript or JavaScript: typed rows, every page, files, refusals with their code. No
dependency: the standard `fetch`, under Node 18 and later, Deno, Bun or in a browser.

```bash
npm install @basedb/sdk
```

## Your tables’ types

One command reads your bases’ description and writes their types into a file of your program:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Every base the token opens — or the ones named by `--base`, repeated —, and for each table
three shapes: the row as basedb **reads** it, as it is **created**, as it is **updated**. A
single select becomes the union of its values; a field basedb computes — formula, lookup,
rollup, count, autonumber — reads without being written; a required field with no default value
is required at creation. Rerun the command when the tables change.

## Reading and writing

```ts
import { Basedb, BasedbError, filter } from '@basedb/sdk'
import type { Schema } from './basedb.js'

const db = new Basedb<Schema>({ url: 'https://basedb.exemple.fr', token: process.env.BASEDB_TOKEN! })
const opportunites = db.base('b_t4z56fq_ventes').table('opportunites')

const o = await opportunites.create({ titre: 'Audit', montant: 12500, statut: 'nouveau' })
await opportunites.update(o._id, { statut: 'gagne' })

for await (const ligne of opportunites.all({
  filter: filter`statut eq ${'gagne'} and montant gte ${10000}`,
  sort: '-montant',
})) {
  console.log(ligne.titre, ligne.montant)
}
```

A table, a field or a choice that does not exist is a **type error**, before the program even
runs.

| Method | Role |
|---|---|
| `list(options)` | one page, and `next` for the following one |
| `all(options)` | every row of a filter, page after page, as they are read |
| `first(options)`, `count(filter)` | the first row, the number of rows |
| `get(id)` | one row |
| `create(values)`, `createMany(rows)` | add a row; several, all or none |
| `update(id, values)` | update fields; a missing field stays as is, `null` clears it |
| `aggregate({ aggregates, filter, group })` | sums, averages, counts over every row of a filter |
| `comments(id).list()`, `.add(text)` | a row’s comments; an @mention notifies |
| `upload(field, bytes, { name, type })` | drop off a file, which the row then cites by its `id` |
| `db.undo(row)` | undo the write that produced this row — refused if it has changed since |

- **`filter`** writes every inserted value as a value: text typed by a user stays text, never a
  piece of the filter.
- **Numbers** read as decimal text (`"12500.0000000000"`), to lose no digit; they are written as
  a number or as text.
- A **relation** reads as `{ id, display }` and is written by the linked row’s `_id`;
  `links: 'id'` reads only the `_id`.
- A **refusal** is a `BasedbError`: its `code` — stable, one per cause, the same in every
  language —, `status`, `details` and `requestId`. A request to slow down (`429`) is retried
  after the delay basedb indicates.

## Environments

A base that has several [environments](/basedb/en/fonctionnalites/environnements/) — production,
staging… — keeps its names and its types from one environment to the next. With a token created
for the whole base, `environment()` targets an environment, the same code running elsewhere:

```ts
const recette = db.environment('recette')
await recette.base('b_t4z56fq_ventes').table('opportunites').first()
```

The `environment` option of the constructor does the same for the whole client. The SDK sends the
`X-Basedb-Environment` header; without it, each base name designates its own environment
(`b_t4z56fq_ventes` is production).

## The token

An **integration token** is created in the interface: the base’s **⋯** menu → **API and
agents** → **API and MCP tokens…**. It opens one base — all its environments, or just one —,
reads its rows, writes them if it was created with write access, never has more permissions than
the person who created it, and **only deletes if it was created for that** (“Read, write and
delete”): otherwise `delete()` is refused.
