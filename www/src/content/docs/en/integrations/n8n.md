---
title: n8n
description: Read and write basedb rows from an n8n workflow, and trigger one for every row created, updated or deleted.
---

The **n8n-nodes-basedb** package adds three nodes to n8n:

| Node | Role |
|---|---|
| **basedb** | read and write a table’s rows, comment on a row; usable as a tool by an n8n AI agent |
| **basedb Trigger** | run a workflow for each row created — or created or updated — since the last poll |
| **basedb Webhook Trigger** | run a workflow the instant a row is created, updated or deleted |

## Install

In n8n: **Settings › Community Nodes › Install**, then `n8n-nodes-basedb`.

Without the interface — queue mode, a Docker image built in advance —: `npm install
n8n-nodes-basedb` in the `~/.n8n/nodes` folder, then restart n8n.

## Credentials

Create a **basedb API** credential in n8n:

| Field | Value |
|---|---|
| **Instance URL** | the address where you open basedb: `https://basedb.exemple.fr` |
| **Workspace** | the workspace’s reference, the one in the API addresses (`/api/v1/<workspace>/…`): `t4z56fq`, unless the instance sets `BASEDB_TENANT` |
| **Token** | an **integration token**: the base’s **⋯** menu → **API and agents** → **API and MCP tokens…** |

A token opens **one** base. It reads its rows, writes them if it was created with write access,
never has more permissions than the person who created it, and **never deletes**. On save, n8n
tries the connection and says if the token is refused.

## Reading and writing: the basedb node

| Operation | What it does |
|---|---|
| **Row › Create** | adds a row |
| **Row › Create or Update** | updates the row whose chosen fields carry these values, or adds it if none do |
| **Row › Get** | reads a row by its `_id` |
| **Row › Get Many** | reads the rows of a filter, in the requested order, up to a limit or all of them, page after page |
| **Row › Update** | updates a row, found by its `_id` or by other fields |
| **Comment › Create** | comments on a row; an @mention notifies the person |

The **base** and the **table** are chosen from lists, the ones the token opens. The fields to
write show with their name in basedb, a single select with its options, a Person field with the
workspace’s members; a computed field — formula, lookup, rollup, autonumber — does not appear
there, since basedb writes it itself. A value the field rejects stops the node with basedb’s
code and what it means.

- The **filter** and the **sort** use the fields’ technical names, the SQL ones:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. The grammar is that of the
  [REST API](/basedb/en/integrations/api-rest/#reading).
- **Numbers** arrive as decimal text (`"1250.50"`), to lose no digit; the **Numbers as
  Numbers** option converts them to numbers.
- A **relation** reads as `{ "id": …, "display": … }` and is written by the linked row’s `_id`.
- **Create or Update** never updates several rows: if several carry the values, the node stops
  rather than guess.
- No **Delete** operation: a token does not delete. To remove rows, mark them (a status
  “Archived”), or hand deletion to an
  [automation](/basedb/en/fonctionnalites/automatisations/).

## Running a workflow

### On every poll: basedb Trigger

The node asks basedb, at the chosen pace (every minute, every hour…), for the rows **created**
— or **created or updated** — since last time, plus a filter if needed. It works everywhere,
even when basedb cannot reach n8n. On its first poll, it notes where the table stands and emits
nothing; a test run from the editor returns the last row, so there is something to wire the
following nodes to.

### Instantly: basedb Webhook Trigger

Every row created, updated or deleted — even by SQL written directly in PostgreSQL — runs the
workflow at once:

1. Add the node and copy its **Production URL**.
2. In basedb, the base’s **⋯** menu → **API and agents** → **Webhooks…**: create a webhook to
   that address, choose its tables and its events.
3. basedb shows the **signing secret** once: put it in an n8n **basedb Webhook** credential.
4. Turn the workflow on.

Each event becomes one item: its `type` (`record.created`, `record.updated`, `record.deleted`),
the table, the row **before** and **after**, and the fields changed (`changed`). The node checks
the **signature** of each delivery and answers `401` to one with none, a wrong one, or one more
than five minutes old. basedb delivers **at least once**: deduplicate on the event’s `id` if the
workflow must not process it twice.

:::note
basedb only sends a webhook to a **public HTTPS** address: an n8n on a private network should
use **basedb Trigger** instead. See [Webhooks](/basedb/en/integrations/webhooks/).
:::

## Without the node

n8n’s **HTTP Request** node also talks to basedb: an `Authorization: Bearer <token>` header,
JSON both ways, pagination by `meta.next_cursor` passed as `after`
(`{{ $response.body.meta.next_cursor }}`), and resuming after an outage with a filter on
`_updated_at` and by `…/<table>/deleted?since=`.
