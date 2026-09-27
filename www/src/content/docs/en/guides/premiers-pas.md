---
title: Getting started
description: Create a base, a table, fields, a view and a form.
---

This walkthrough takes ten minutes and covers the essentials: at the end, you will have a
table, a kanban view and a public form that writes into it.

:::tip[To see everything at once]
An empty project offers the **demo base**: a small agency, its clients, projects, tasks,
invoices and reviews, with formulas, views of every kind, a dashboard and automations.
**New base** also opens the [template gallery](/basedb/en/fonctionnalites/modeles/), where you
can describe your base to the AI.
:::

## 1. Create a base

Everything is organized by **project**: the selector at the top of the sidebar switches
projects or creates one. In the sidebar, the **+** to the right of the filter creates a base.
Give it a label — “Ventes” — and, if you like, a description, a color, an icon.

The base becomes a **PostgreSQL schema**: its physical name (`b_t4z56fq_ventes`) appears in
the form and in the generated documentation.

## 2. Create a table and its fields

From the base’s **⋯** menu: **New table**. Then add its fields from **Schema** — in that same
menu — and its **Field** button:

| Field | Type |
|---|---|
| Nom | Short text |
| Statut | Single select — Nouveau, Qualifié, Gagné, Perdu |
| Montant | Currency |
| Échéance | Date |
| Client | Relation → Clients |
| Notes | Long text (Markdown) |

Later, a formula (`JOURS([Échéance]; AUJOURDHUI())`), a lookup (the client’s city) or a rollup
(the total amount per client) are added the same way — see
[Tables and fields](/basedb/en/fonctionnalites/tables-et-champs/).

You can also **import a file** in CSV or JSON: the import guesses the types, lets you correct
them, creates the table or fills an existing one, and tells you row by row what it rejects.

![A base’s menu](../../../../assets/screens/menu-base.png)

## 3. Enter data and filter

The grid is edited like a spreadsheet: double-click or Enter to edit a cell, Esc to cancel.
**Filter** combines conditions per field; sorting is done from the column header;
**Search…**, on the right of the bar, searches all columns. Every change is saved
immediately — and [recorded in the history](/basedb/en/fonctionnalites/historique/):
**Ctrl+Z** undoes the last one.

## 4. Add a view

The view selector, to the left of “Filter”, offers “All rows” and then your views. Create a
**kanban** grouped by “Statut”: dragging a card from one column to another updates the row.

![A kanban by status](../../../../assets/screens/kanban.png)

## 5. Share a form

Create a **Form** view, check the questions, then **Share**: choose “Public” and copy the
link. Each response adds a row to the table, without giving the respondent any permission.
Details in [Shared forms](/basedb/en/fonctionnalites/formulaires-partages/).

## 6. Read in SQL

The base’s **⋯** menu → **New SQL query**: your tables are there, under their real names.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Save** files it under the tables, in the “Queries” section — for you, or for the whole
base — and **⋯** → **Create SQL view…** turns it into a real PostgreSQL view, filed among the
tables. Everyone reads them with their own permissions. See
[SQL queries and views](/basedb/en/fonctionnalites/requetes-et-vues-sql/).

It is the same from `psql` or your BI tool. See [Direct SQL](/basedb/en/integrations/sql/).
