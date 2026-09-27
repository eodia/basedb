---
title: Introduction
description: What basedb is, and what sets it apart from collaborative spreadsheets.
---

**basedb** is a collaborative database, in the spirit of collaborative spreadsheets, that you
host yourself — with one difference that drives everything else: **your data lives in real
PostgreSQL tables**, typed and plainly named.

![A table’s grid in basedb](../../../../assets/screens/grille.png)

## A simple promise

No generic model, no catch-all `JSONB`, no `field_1837`:

| In basedb | In PostgreSQL |
|---|---|
| A base “Ventes” | a schema `b_t4z56fq_ventes` |
| A table “Opportunités” | a table `opportunites` |
| A field “Échéance” (Date) | a column `echeance date` |
| A single select “Statut” | a `text` column and its `CHECK` constraint |
| A relation “Client” | a `clients_id uuid` column and its `FOREIGN KEY` |

So you can open `psql`, a BI tool or a Python script and read your data without going through
the product — and even write to it: the constraints hold, and the history records the write.

## Who is it for?

- **Business teams** who want a grid, views and forms without waiting for a development
  project.
- **Technical teams** who refuse to see their data locked into a proprietary format, and want
  to plug in their usual tools.
- **AI agents**, which find an MCP server, clear permissions and proposals submitted to a
  person.

## What you will find

- Typed [tables and fields](/basedb/en/fonctionnalites/tables-et-champs/), relations that are
  real foreign keys — or multiple ones —, formulas computed by PostgreSQL, lookups and rollups
  across relations.
- Eight [views](/basedb/en/fonctionnalites/vues/): grid, kanban, calendar, timeline, gallery,
  list, form, survey — collaborative or personal.
- [Forms](/basedb/en/fonctionnalites/formulaires-partages/) and
  [views](/basedb/en/fonctionnalites/vues-partagees/) shared through a link, and calendars you
  can subscribe to from a calendar app.
- [Collaboration](/basedb/en/fonctionnalites/collaboration/): comments and mentions,
  notifications, real-time updates.
- [Automations](/basedb/en/fonctionnalites/automatisations/) and
  [dashboards](/basedb/en/fonctionnalites/tableaux-de-bord/) with their questions, built with the mouse or in SQL.
- [SQL for everyone](/basedb/en/fonctionnalites/requetes-et-vues-sql/), with each person’s own
  permissions: saved queries kept under the tables, and real PostgreSQL views filed among them.
- [Base templates](/basedb/en/fonctionnalites/modeles/), picked from a gallery or requested
  from the AI.
- [Environments](/basedb/en/fonctionnalites/environnements/) — production, staging — that you
  compare and migrate.
- A [history](/basedb/en/fonctionnalites/historique/) of every write, direct SQL included, and
  Ctrl+Z to undo.
- [Permissions](/basedb/en/fonctionnalites/droits/) by group, down to the field.
- A [REST API](/basedb/en/integrations/api-rest/), an [MCP server](/basedb/en/integrations/mcp/),
  [webhooks](/basedb/en/integrations/webhooks/), Slack and
  [synced tables](/basedb/en/integrations/synchronisation/).
- Optional [AI](/basedb/en/fonctionnalites/ia/): fields computed by a model, Copilot.

## Project status

basedb is free software (AGPL-3.0) developed by [Eodia](https://eodia.com/fr/), an AI-native
software studio, and is under active development. The core, the API, the MCP server and the
interface work and are covered by more than a thousand tests; the
[roadmap](/basedb/en/feuille-de-route/) says what is still to come. Its
[architecture document](https://github.com/eodia/basedb/tree/main/docs/architecture), some
twenty chapters long, sets down every decision.

:::tip[Try it]
Once the repository is cloned, one command is enough: `docker compose up -d`. See
[installation](/basedb/en/guides/installation/).
:::
