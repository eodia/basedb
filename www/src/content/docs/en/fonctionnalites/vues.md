---
title: Views
description: Grid, kanban, calendar, timeline, gallery, list, form and survey — collaborative or personal.
---

A table can be shown in **eight ways**. A view copies no data, and grants no more permission
than the table itself.

:::note
These views are ways of showing **one** table. A [SQL view](/basedb/en/fonctionnalites/requetes-et-vues-sql/)
is something else: a real PostgreSQL view, written in SQL over the base’s tables, and filed
among them in the sidebar.
:::

| View | What it shows | What it needs |
|---|---|---|
| **Grid** | rows, filtered, sorted, grouped, with chosen columns | — |
| **Kanban** | cards in columns | a single select |
| **Calendar** | rows on their date, by month or by week | a date field |
| **Timeline** | bars between two dates, and their dependencies | a start date |
| **Gallery** | cards, with a cover image | — |
| **List** | one line per row, in collapsible groups | — |
| **Form** | a page of questions to create a row | — |
| **Survey** | the same questions, one per screen | — |

## The view selector

It sits to the left of “Filter”. “All rows” is the table’s grid, which nobody saved and nobody
can delete; then come the **collaborative views**, in the order chosen by whoever builds the
base, and then **My views**.

- A **collaborative view** is seen by everyone. Creating, configuring, renaming, reordering or
  deleting one requires the **Manage** level. It can be **locked**: a padlock says so, and
  nobody can change it until they unlock it.
- A **personal view** is seen only by you, and only requires being able to read the table.
  **Create personal view**, or **Save as view** after filtering and sorting: everyone keeps
  their own ways of reading, without changing anything for the others. **Duplicate** on a
  collaborative view makes a personal copy of it.

![A gallery of clients](../../../../assets/screens/galerie.png)

## The toolbar

Above the grid, in this order:

- **Filter** combines conditions per field;
- **Columns** chooses what is shown — the system columns are set apart, under
  “System information”;
- **Group** sorts rows by a single-value field — single select, relation, person, date,
  number, text, checkbox… — into collapsible groups, each with its count across the whole
  filter;
- **Colors** colors the rows by a single select, or by **rules** — a filter and a color, twenty
  at most — as a stripe, a background, or both;
- **Row height**: short, medium, tall, extra tall;
- **Search…**, on the right, searches all columns as you type; Esc clears the search. It also
  works for the kanban, calendar, timeline, gallery and list, and is never saved in the view.

Under each column, a **Summary** computed over all the rows of the filter, not just the page:
filled, empty, unique values, sum, average, minimum, maximum, checked boxes.

## Kanban, calendar, timeline

- The **kanban** sorts cards by a single select; dragging a card updates the row, and a “+” at
  the top of a column creates a row that already has that choice. Each card shows a title, a
  cover image, the chosen fields, and a **description** that cites the row’s values —
  “Delivery scheduled for `{{Date}}` for `{{Client}}`” —, written in the view settings with
  the **Insert field** button.
- The **calendar** places each row on its date, with an optional end date; dragging a row from
  one day to another moves it.
- The **timeline** draws bars between a start date and an end date, grouped by a single select
  or a relation. With the **Depends on** setting — a relation from the table to itself — an
  arrow links each task to the ones it depends on, in red when it goes back in time.

![A timeline with its dependencies](../../../../assets/screens/chronologie.png)

![A calendar by due date](../../../../assets/screens/calendrier.png)

## Gallery and list

- The **gallery** shows cards: a **cover image** (cropped or whole), a size (small, medium,
  large cards), a color by single select.
- The **list** shows one line per row, **grouped** by a single select, a relation or a person.

![A list of clients, grouped by sector](../../../../assets/screens/liste.png)

In the kanban, the gallery and the list, cards and rows can be **ordered by hand** by dragging
them — up to 5,000; a chosen sort takes precedence over this order.

## Form and survey

You check the questions and put them in order; each has a title, a help text, an example
answer, and can be made required. The form has its own title, its introduction, its button
label and its thank-you message. It is filled in inside basedb, or
[shared through a link](/basedb/en/fonctionnalites/formulaires-partages/).

Nothing needs setting up to start: a new form asks what a person answers — not the status, the
assigned person or the relations the team fills in afterwards, unless they are required —,
wears its table’s color and a light theme, and each empty field shows a fitting example.
Everything else can be changed whenever you like:

- **Appearance**: eight themes — Light, Soft, Dawn, Ocean, Forest, Night, Paper, Minimal —, an
  accent color, a font, a left or centered alignment;
- **Ask only if…**: a question is only asked if an earlier answer calls for it ("Sentiment is
  Negative", "Rating is at most 2"). A hidden question is neither required nor sent;
- **More options**: the welcome and submit buttons, the numbers, the progress bar, moving
  automatically to the next question, the end message and an end button ("Back to site"), the
  confetti.

The **survey** fills the whole screen: a welcome screen that says how long it takes, then one
question at a time, sliding in. Everything also works from the keyboard: **Enter** to continue,
the letters **A**, **B**, **C**… for a choice, **Y** or **N** for yes or no, digits for a
rating — a single choice moves on to the next question by itself. Sending it is celebrated: a
checkmark draws itself, and confetti in the form’s colors.

## Sharing a view

A data view — grid, kanban, calendar, timeline, gallery, list — can be **shared read-only**
through a link, embedded in another site, and a calendar becomes a calendar feed. See
[Shared views](/basedb/en/fonctionnalites/vues-partagees/).

## What the reader does not see

A view is **reprojected for its reader**: a field hidden from them disappears from the
columns, the cards and the questions. A view whose filter cites a hidden field is not shown at
all: shown without its filter, it would show more than it was made to show.
