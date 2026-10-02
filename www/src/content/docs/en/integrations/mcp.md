---
title: MCP server
description: Connect an AI agent to basedb through the Model Context Protocol.
---

basedb exposes an **MCP server** (`POST /mcp`, at the same address as the interface): an
agent — Claude, a coding assistant, your own agent — discovers the bases there, reads and writes
rows, deletes them if you allow it, and **proposes** schema changes.

## Connecting an agent

Create a token from **API and MCP tokens…** (the base’s menu, under **API and agents**), with
MCP access checked. The same token works for the REST API and for MCP.

For a client that speaks HTTP, the address is `http://localhost:3000/mcp` with
`Authorization: Bearer <jeton>`. For a client that launches processes (stdio), the repository
provides a relay that reads the token from an environment variable — never from the
configuration:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## The fourteen tools

| Tool | Role |
|---|---|
| `whoami` | who the agent is, with which permissions |
| `list_bases`, `describe_base`, `describe_table` | discover the schema and its descriptions |
| `list_records`, `get_record`, `lookup_records` | read, filter, resolve a display value |
| `create_record`, `update_record` | write rows |
| `delete_record`, `restore_record` | delete a row — with a token created for that — and restore it |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propose a schema change |

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
- **It does not change the schema**: it proposes changes. The proposal waits in **Agent
  proposals…** (the base’s menu), where a person who manages the schema approves or rejects it;
  without a decision, it expires after 24 hours.
- **It never has more permissions** than the person who created its token: the token’s
  permissions are intersected with theirs.
- It does not see fields marked invisible to agents, nor bases closed to MCP.

Each call is logged by the shape of its parameters, never by their values.
