---
title: Permissions and groups
description: Accounts, groups, access levels by project, base and table, field-level restrictions, and your settings.
---

Permissions are granted to **groups**, never to people one by one. A level set on a project, a
base or a table flows down to everything below it, including what will be created later.

## The four levels

| Level | Allows |
|---|---|
| **No access** | nothing: the resource is invisible |
| **Read** | seeing rows, commenting on them, making personal views, viewing the schema and dashboards, asking and saving your own questions, writing read-only SQL and saving your personal queries |
| **Edit** | plus creating, updating and deleting rows |
| **Manage** | plus changing the schema, creating shared views and dashboards, sharing a dashboard through a link, sharing questions and queries, creating SQL views, automations, integrations and tokens; its SQL has the whole base, writes included |

Permissions **add up**: a person gets the highest level any of their groups gives them. Giving
a table less than its base makes it “granular”.

Two groups always exist: **Administrators**, who manage everything, and **All users**, which
every account belongs to — whatever is granted to it, everyone has.

## Down to the field

Below the grid of levels, **Fields** hides a column from a group, or makes it read-only for
them. The screen also shows what a given person actually sees, and through which group.

A hidden field is absent everywhere: from the grid, views, the API, MCP, the history, the SQL
written in the interface and SQL views. Filtering or sorting on it responds as for a field that
does not exist.

## Down to the row

Next to **Fields**, **Rows** shows a group only certain rows of a table: the ones a filter
keeps, written like a view’s. `@me` designates the signed-in person:

- `commercial eq @me` — each salesperson sees only their own clients;
- `region in ["nord", "est"]` — a team sees only its regions;
- `_created_by eq @me` — everyone sees only what they created.

Permissions add up: a person sees the rows of all their groups, and a group with no rule sees
them all. Whoever manages the table’s schema — the Manage level — always sees everything. The
screen says how many rows a given person sees, and through which group.

A row outside its rule does not exist for the person: not in views, dashboards, search, the
API, MCP or the history, nor to be updated, deleted or linked. A row they create must be part of
their own; updating a row, however, can make it leave their scope — a task handed off to a
colleague. Responses to [shared forms](/basedb/en/fonctionnalites/formulaires-partages/) always
arrive.

## What about SQL?

In the interface, SQL follows the same permissions, applied by PostgreSQL itself: without the
Manage level, a query runs read-only, through a role of the person’s own, where a closed table
does not exist, a hidden field is refused, and only its rows are read, whether the table is
named alone or with its schema. An [SQL view](/basedb/en/fonctionnalites/requetes-et-vues-sql/)
is read with the permissions of whoever reads it, and sharing a query only shares its text.

**Direct `psql` access** to the database, however, is not governed by basedb: it reads
everything, hidden fields included. Restrictions protect the product’s surfaces — interface,
API, MCP —, never against someone who holds SQL access to the database; such access is managed
with PostgreSQL `GRANT`s, set by the operator. A table that carries a row rule has PostgreSQL’s
row-level security turned on: a role created for a third-party tool sees no rows there, unless
it has the `BYPASSRLS` attribute or a policy of its own.

## Accounts and sign-in

- An account is created with a **temporary password**, shown once and to be changed at first
  sign-in.
- Sign-in is by password or through an **OpenID Connect** provider declared by the operator.
- Administration actions require an **elevated session**: a password typed again within the
  last five minutes.
- Sessions can be revoked; revoking a session immediately invalidates its access tokens.

## Your settings

**Settings**, in the profile menu at the bottom left, concerns only you:

| Tab | What you do there |
|---|---|
| **Profile** | the display name; the sign-in address; the identity providers linked to the account, to link or unlink |
| **Security** | change the password; the open sessions, to close one by one or all at once |
| **Appearance** | the interface language; the theme; the date order — `25/09/2026` or `2026-09-25` — and the first day of the week for calendars |
| **Notifications** | the kinds of notification you no longer want |
| **Tokens** | the integration tokens you created, across all your bases, their last use, and revoking them |

basedb speaks **twenty languages**: French, English, German, Spanish, Italian, Portuguese
(Brazil), Dutch, Polish, Czech, Swedish, Danish, Norwegian, Finnish, Romanian, Hungarian,
Turkish, Ukrainian, Japanese, Simplified Chinese and Korean. By default, the interface uses
your browser’s language; **Language**, in **Appearance**, sets another one. Numbers and dates
follow the chosen language.

A link can also request a language: `?lang=de` at the end of a basedb address shows the sign-in
screen, a form, or a shared view or dashboard, in German. This is how the site leads to the demo
in the page’s language. Once signed in, basedb follows your account: the language chosen in
**Appearance**, otherwise the browser’s.

The theme stays specific to the browser; the language, the date order and the first day of the
week follow you from one computer to another. Changing your address or linking a provider
requires an elevated session; an account without a password, which signs in through a
provider, keeps that provider’s address.

## The single enforcement point

All surfaces — interface, API, MCP, shared forms and views, automations — go through the same
permission decision point, in the core. There is no private route for the interface: what the
screen does not show is what the API did not return.

The reverse holds too: the screen **does not offer what would be refused**. Without the Manage
level, the Schema screen can be viewed with no button or pencil, and the import does not offer
to create a table; without the right to create or delete rows, the grid offers neither an add
row nor “Delete”.
