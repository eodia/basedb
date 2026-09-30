# n8n-nodes-basedb

n8n nodes for [basedb](https://eodia.github.io/basedb/) — tables on PostgreSQL, with an
interface for the team. Read and write the rows of your tables from a workflow, and start a
workflow when a row is created, changed or deleted.

| Node | What it does |
|---|---|
| **basedb** | Rows: create, create or update, get, get many (filtered, sorted, every page), update. Comments: add one to a row. Usable as a tool by an AI agent. |
| **basedb Trigger** | Checks a table at the interval you choose and starts the workflow for each row created — or created or updated — since the last check. Works wherever n8n runs. |
| **basedb Webhook Trigger** | Receives basedb's webhooks the moment a row is created, updated or deleted — even by SQL written straight into PostgreSQL — and checks their signature. |

## Install

In n8n: **Settings › Community Nodes › Install**, and enter `n8n-nodes-basedb`.

Without the interface (queue mode, Docker): in `~/.n8n/nodes`, run `npm install n8n-nodes-basedb`,
then restart n8n.

## Credentials

- **Instance URL** — where you open basedb: `https://basedb.example.com`.
- **Workspace** — the reference in the API addresses, `/api/v1/<workspace>/…`: `t4z56fq` unless
  your instance sets `BASEDB_TENANT`.
- **Token** — an integration token, created in basedb from the base's menu, **API et agents ›
  Jetons API et MCP…**. It opens one base, reads its rows, and writes them if it was created with
  write access. It never has more rights than the person who created it, and it never deletes.

The **basedb Webhook Trigger** takes another credential: the signing secret basedb shows once,
when the webhook is created (**API et agents › Webhooks…**, with the node's production URL).

## Good to know

- Fields are listed with their names in basedb; the filter and the sort use their **technical
  names** — the ones you read in SQL: `statut eq "gagne" and montant gte 10000`, `-montant,nom`.
  Operators: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`, `gt`,
  `gte`, `lt`, `lte`, `between`, joined by `and`, `or`, `not` and parentheses.
- Numbers arrive as **decimal text** (`"1250.50"`), so that no digit is lost. The option
  **Numbers as Numbers** turns them into JavaScript numbers.
- Linked rows read as `{ "id": …, "display": … }` and are written by their `_id`.
- **Create or Update** updates the one row whose chosen fields hold the values, and adds a row
  when none does; when several match, it stops rather than guess.
- The webhook trigger answers `401` to a delivery whose signature is missing, wrong, or more
  than five minutes old. basedb delivers at least once: deduplicate on the event's `id`.

## License

MIT
