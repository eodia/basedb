---
title: Direct SQL
description: Read and write basedb tables with psql, a BI tool or a script.
---

It is basedb’s reason for being: **your tables are real tables**. Any PostgreSQL client reads
them under their names.

## Names

| Object | Physical name | Example |
|---|---|---|
| Base | a schema `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Staging environment | the schema, with a suffix | `b_t4z56fq_ventes_recette` |
| Table | its slugified name | `opportunites` |
| Field | its slugified name | `echeance` |
| Relation | `<table cible>_id` | `clients_id` |
| [SQL view](/basedb/en/fonctionnalites/requetes-et-vues-sql/) | its technical name, in the base’s schema | `factures_a_encaisser` |

Each base’s **API and MCP documentation** page gives them all, and `\d` in `psql` shows the
descriptions (`COMMENT ON`).

## In the interface

The **+** in the tab bar, or the base’s **⋯** menu → **SQL query**: an editor with syntax
highlighting and completion, whose result is shown in the same grid as your tables.

![A saved query, and two SQL views filed among the tables](../../../../assets/screens/en/requete-sql.webp)

- **Everyone reads there with their own permissions**: the Manage level has the whole base,
  writes included; other members write read-only SQL, where a closed table does not exist and a
  hidden field disappears.
- A query **is saved** under the tables — for yourself, for the whole base or for groups —, and
  becomes, if you want, an **SQL view**: a real PostgreSQL view, filed among the tables and
  readable from `psql`.

Everything is detailed in [SQL queries and views](/basedb/en/fonctionnalites/requetes-et-vues-sql/).

## From psql

With the provided `docker-compose.yml`, PostgreSQL is published on `127.0.0.1:5432`:

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

This account is the base’s owner: it reads everything, and basedb’s permissions do not apply to
it. For a BI tool, create a separate role with its own `GRANT`s instead. If a table carries a
[row rule](/basedb/en/fonctionnalites/droits/#down-to-the-row), PostgreSQL applies row-level
security to it: such a role sees no rows there without the `BYPASSRLS` attribute or a policy of
its own.

## Writing in SQL

It is allowed. Constraints (single selects, relations, URLs, required) are enforced by
PostgreSQL and reject an invalid value, just as in the interface. And the write is **recorded
in the history**: the history shows it as “Direct SQL session”, with the session that made it,
and it can be undone like any other.

:::caution
Changing the **schema** in SQL (`ALTER TABLE`) bypasses basedb’s catalog, which would not know
about it. Go through the interface, the API or an agent proposal: the migration engine plans,
keeps locks short and keeps the catalog accurate.
:::
