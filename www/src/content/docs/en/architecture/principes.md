---
title: Principles
description: The decisions that drive basedb’s architecture.
---

basedb was designed from an **architecture document** — sixteen chapters, in the repository,
under [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Its
chapter 00 sets down twenty-five decisions; here is their spirit.

## Data is tables, not a format

A user base is a PostgreSQL **schema**, a table is a table, a field is a typed column **with a
plain name**. No EAV (entity-attribute-value), no catch-all JSON document, no opaque names. The
`_basedb` catalog describes these objects; it does not replace them.

An intended consequence: direct SQL is a **legitimate** use. Constraints are set in the
database, the history is captured by triggers — nothing assumes that writes go through the
application.

## A single permission decision point

The interface, the REST API, the MCP server, shared forms, webhooks: everything goes through the
**same enforcement point** for permissions, in the core. The interface is a consumer of the API
like any other — no private route, no service token. A resource you cannot see responds exactly
like a resource that does not exist.

## The core decides, the adapters translate

A TypeScript monorepo: `@basedb/core` holds all the logic (catalog, DDL engine, permissions,
records, history); `apps/api` (Hono), `apps/mcp` and `apps/web` (Next.js) are adapters that do
not call one another. The interface never depends on the core: it speaks HTTP, period.

## Nothing is lost without a decision

Deleting sets aside, without destroying: a deleted table keeps its rows, readable in SQL under a
set-aside name, and can be restored. Renaming a physical name keeps the old one served by an
alias. Purging is an administration decision, preceded by a verified export.

## PostgreSQL, and nothing else

PostgreSQL 16 or later, and no required external dependency: no message queue, no cache, no
search engine. The webhook queue, the history drain, the rate limits — everything fits in the
database or in the process.

## Going further

| Chapter | Subject |
|---|---|
| 00 | Structuring decisions and error code registry |
| 01 | Naming and slugification |
| 02 | The `_basedb` catalog, source of truth |
| 03 | DDL engine and migrations |
| 04 | Field types and PostgreSQL mapping |
| 05 | Permissions |
| 06 | Lifecycle: renaming, deletion, purge |
| 07 | History |
| 08 | REST API and webhooks |
| 09 | MCP server |
| 10 | Software architecture |
| 11 | Interface |
| 12 | AI integration |
| 13 | Authentication |
| 14 | Environments |
| 15 | Shared forms |
