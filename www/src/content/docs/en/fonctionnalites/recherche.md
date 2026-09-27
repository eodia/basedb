---
title: Search
description: A single field to find everything — tables, views, dashboards, rows, commands — and to ask Copilot a question. Ctrl+K.
---

The **Search tables, rows, commands…** field, at the center of the top bar, opens search: a
single field for everything you can reach in basedb. **Ctrl+K** (**⌘K** on Mac) opens or closes
it from any screen — except inside a text editor, where it adds a link instead.

## What it finds

| | |
|---|---|
| **Tables and objects** | the projects and bases you can see; the tables, SQL views and saved queries; the views of the tables in the open base, personal ones included; the questions, dashboards and automations of the project’s bases; the tables’ columns; the open tabs |
| **Rows** | the data itself, in the tables of the open base: column text, list choices, an exact number — from two characters on. A pasted row identifier finds its row |
| **Commands** | what the application can do: go to the schema, the history, the base’s dashboards; create a table, a question, an SQL query, a base, a project, start from a template; import into a table; undo or redo the last write; close or switch tabs; change the theme; open Copilot; **Copy this page’s link**; open a settings or administration tab; sign out |
| **Copilot** | a natural-language question, handed to Copilot |

**Enter** opens the chosen result: a row opens in its table, on its details. On a large screen, a
panel on the right shows a preview of it — a row’s values, a table’s columns and description, a
dashboard’s or automation’s description. Paste a basedb address: **Open this link** takes you
there (see
[a link to every screen](/basedb/en/fonctionnalites/collaboration/#a-link-to-every-screen)).

An empty field offers your **recent items**, the open tabs, the base’s tables and a few
suggestions.

## Type as you think

- **No accents or capitals**: `lumen studio` finds “Lumen Studio”.
- **Word beginnings and initials**: `nc` for “New client”, `newtab` for “New table”.
- **One typo forgiven** — a letter missing, doubled, swapped or reversed, two in a word of more
  than seven letters —, never on the first letter.
- **Every word typed must be found somewhere**, in the name or in what contains it: `ventes
  clients` finds the “Clients” table in the “Ventes” base. The kind can be typed too: `view`,
  `auto`, `dashboard`.
- **A table, then what to search for in it**: `clients lyon` searches for “lyon” in the rows of
  the “Clients” table.

At the top, the **best match**; what you open often and recently rises up. This memory stays in
your browser.

## Narrowing the search

The chips under the field — **All**, **Tables and objects**, **Rows**, **Commands**,
**Copilot** — narrow what is searched. A first character does the same:

| Type first | To search |
|---|---|
| `#` | only tables and objects |
| `/` | only rows |
| `>` | only commands |
| `?` | a question for Copilot |

**Tab**, on a table or a base, searches **inside** it: its name is shown in the field, and the
search then covers only its rows, its views, its columns and its commands. The empty field then
shows the twenty most recently changed rows. **⌫**, with the field empty, backs out of it;
**Esc** goes back one step, then closes.

## Asking Copilot

Every search ends with **Ask Copilot: “…”**, placed at the top when the text reads like a
question — it ends with “?”, starts with “how many”, “what”, “show”…, or has five words or
more. Copilot opens on the base and receives the question as if you had typed it there. It reads
the schema, not the rows, unless you check **Allow reading data**, and it proposes: nothing
changes before you apply it. AI must be configured on the instance — see
[Artificial intelligence](/basedb/en/fonctionnalites/ia/).

## Permissions and limits

Search goes through the same routes as the rest of the screen, **with your permissions**: a
table or a column closed to you does not appear, neither among the objects nor in the rows.
Automations are only offered to those with the **Manage** level on their base.

- Rows are searched in the open base, or in the base or table you entered with Tab: three rows
  per table, over 24 tables at most; twenty rows in a table.
- Questions, dashboards and automations are those of the open project (eight bases at most),
  re-read at most every two minutes.
- Each group shows a few results, then **N more results**, which opens it in full.

## Keyboard shortcuts

**Shortcuts**, at the bottom of search, or the **Keyboard shortcuts** command, shows them all.
**Ctrl** reads as **⌘** on Mac.

| Keys | Effect |
|---|---|
| **Ctrl+K** | open or close search |
| **↑** **↓**, **Enter** | browse results, open the result |
| **Alt+W** | close the tab |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | next tab, previous tab |
| middle click | close a tab |
| **Ctrl+A**, **Ctrl+C** | in the grid, select all, copy the chosen cells |
| **Ctrl+click** | follow a relation |
| **Ctrl+Z**, **Ctrl+Y** | undo the last write, redo it |
| **Ctrl+Enter** | send a comment, save a description |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | in a text: bold, italic, link |
