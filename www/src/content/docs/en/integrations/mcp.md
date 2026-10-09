---
title: MCP server
description: Connect an AI agent to basedb through the Model Context Protocol.
---

basedb exposes an **MCP server** (`POST /mcp`, at the same address as the interface): an
agent — Claude, a coding assistant, your own agent — discovers the bases there, reads and writes
rows, deletes them if you allow it, and **proposes** schema changes.

## Connecting an agent

Create a token from **API and MCP tokens…** (the base’s menu, under **API and agents**), with
MCP access checked. The same token works for the REST API and for MCP, and opens **the whole
base**: its production and its other environments (see below).

Put the token in an environment variable, `BASEDB_TOKEN`, never in a configuration file. A client
that speaks MCP over HTTP — Claude Code, among others — targets `…/mcp` directly with the
`Authorization: Bearer <jeton>` header. With Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

The command writes the project’s `.mcp.json` file, where `${BASEDB_TOKEN}` remains a reference to
the variable: the token itself does not appear in it.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

A client that can only launch local programs (stdio) goes through the repository’s relay, which
reads the token from the variable named by `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Then ask the agent to call `whoami`: it says who created the token, which base it opens, its
environments and its permissions.

## Choose the environment

A base can have several [environments](/basedb/en/fonctionnalites/environnements/) — production,
staging, development — each with its own tables and rows. A whole-base token opens all of them,
and the environment is chosen, from the broadest to the most specific:

- **the base name**, nothing else: `crm` is production, `crm_recette` is staging;
- **the server address**: `…/mcp?environment=recette` targets staging for the whole connection.
  The relay does the same with `--environment recette`. This is how you declare one server per
  environment, all on the same token:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **the `environment` argument** of every tool that names a base, for a single call:
  `list_records` with `{"base": "crm", "table": "clients", "environment": "recette"}`.

An environment is named by its badge, ignoring case and accents (`Recette`, `recette`,
`developpement` for “Développement”), or by `production`. `whoami` lists the ones the token opens;
`list_bases` and `describe_base` say which environment each base belongs to.

A token can also be limited to a single environment, when it is created: it then sees no other.

## The fifteen tools

| Tool | Role |
|---|---|
| `whoami` | who the agent is, with which permissions, on which environments |
| `list_bases`, `describe_base`, `describe_table` | discover the schema, its descriptions and its appearance |
| `list_records`, `get_record`, `lookup_records` | read, filter, resolve a display value |
| `create_record`, `update_record` | write rows |
| `delete_record`, `restore_record` | delete a row — with a token created for that — and restore it |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propose a schema change |
| `propose_update_look` | propose the color and icon of a table and of its choices |

## Colors and icons

A table, and each choice of a choice list, have a color and an icon, as in the interface. The
agent chooses them when proposing:

- `propose_create_table` accepts `color` and `icon` for the table;
- `propose_add_field` accepts `color` and `icon` on each option of a `select` or a `multi_select`;
- `propose_update_look` changes those of an existing table and of its choices: an omitted key
  keeps what is in place, `null` clears it.

`color` is a `#rrggbb` color. `icon` is the name of a [Lucide](https://lucide.dev/icons/) icon
among those the interface draws — `truck`, `circle-check`, `flame`…: the tool’s schema lists
them, and an unknown name is refused. `describe_base` and `describe_table` return the current
appearance. A field, however, has no icon to choose: the interface draws the one for its type.

## Deleting rows

A token created with **Read, write and delete** rights lets the agent delete rows, **one at a
time**, by their `_id`. `delete_record` returns the row as it was, and the deletion is logged
under the token’s name; `restore_record` brings the row back under its `_id` — the agent can
undo its own mistake, and so can a person, from the history.

The agent does not delete:

- with a read-only, or read-and-write, token: the refusal says which token to create;
- a row that a cascading relation would take along with others (`TOKEN_CASCADE_FORBIDDEN`): that
  deletion happens in the interface, by a person who sees what it takes with it;
- several rows at once: no tool does that.

## What an agent does not do

- **It only deletes with your approval**: a token created for that, one row at a time.
- **It does not change the schema** — nor its appearance: it proposes changes. The proposal
  waits in **Agent proposals…** (the base’s menu), where a person who manages the schema
  approves or rejects it; without a decision, it expires after 24 hours.
- **It never has more permissions** than the person who created its token: the token’s
  permissions are intersected with theirs, environment by environment.
- It does not see fields marked invisible to agents, nor bases closed to MCP.

Each call is logged by the shape of its parameters, never by their values.
