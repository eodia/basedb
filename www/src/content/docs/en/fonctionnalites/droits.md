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
| **Read** | seeing rows, commenting on them, making personal views, viewing the schema and dashboards, asking your own questions, writing read-only SQL and saving your personal queries |
| **Edit** | plus creating, updating and deleting rows |
| **Manage** | plus changing the schema, creating shared views, dashboards and saved questions, sharing a dashboard through a link, sharing queries, creating SQL views, automations, integrations and tokens; its SQL has the whole base, writes included |

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

## What about SQL?

In the interface, SQL follows the same permissions, applied by PostgreSQL itself: without the
Manage level, a query runs read-only, through a role of the person’s own, where a closed table
does not exist and a hidden field is refused. An [SQL view](/basedb/en/fonctionnalites/requetes-et-vues-sql/)
is read with the permissions of whoever reads it, and sharing a query only shares its text.

**Direct `psql` access** to the database, however, is not governed by basedb: it reads
everything, hidden fields included. Restrictions protect the product’s surfaces — interface,
API, MCP —, never against someone who holds SQL access to the database; such access is managed
with PostgreSQL `GRANT`s, set by the operator.

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
