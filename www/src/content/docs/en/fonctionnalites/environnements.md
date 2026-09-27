---
title: Environments
description: Production, staging, development — compare, migrate, sync.
---

A base can have **environments**: production, staging, development… Each one is a full base
in its own right — its schema, its tables, its rows, its permissions — and they all share the
**lineage** of the base, its tables and its fields.

## In the interface

The sidebar shows **one line per base**, with a badge that says which environment is open and
lets you switch. The badge does not appear as long as there is only production.

Environments are added, renamed and deleted in **Edit base…**: a new environment is born from
a **copy of the schema** of another one, without its rows.

## Comparing environments

From the base’s menu, under **More actions**, **Compare environments…** opens a dialog:

- **Schema**: environments in columns, tables and fields in rows; what differs from production
  is highlighted.
- **Apply migrations…** prepares the plan to go from one environment to another, step by step.
  It never checks by default what would undo a more recent change in the target.
- **Row sync**: table by table, carry rows over from one environment to another, by
  identifier.

![Comparing production and staging](../../../../assets/screens/environnements.png)

## How basedb knows who changed what

The comparison relies on the **schema history**: every creation, change or deletion of a table
or a field is captured by a trigger on the catalog, and can be read in the “Schema” tab of the
history. Lineage identifiers link a staging field to its production counterpart, even when
renamed.

## In SQL

Each environment is a schema: `b_t4z56fq_ventes` for production, `b_t4z56fq_ventes_recette`
for staging. Your queries switch environments by switching schemas — or `search_path`.
