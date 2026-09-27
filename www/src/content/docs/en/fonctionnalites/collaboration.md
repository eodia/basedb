---
title: Collaboration
description: Comments and mentions, notifications, real-time updates and presence.
---

Several people work on the same base at the same time: each one sees the others’ writes come
in, knows who is looking at what, and discusses a row right where it is.

## Comments

A row’s details have a **Comments** tab, between “Details” and “History”. Type `@` to
**mention** a member, Ctrl+Enter to send. Everyone can edit or delete their own comments.

![A conversation about a project](../../../../assets/screens/commentaires.png)

Being able to read the row is enough to comment on it. A mentioned person who cannot read it
is not notified — and the author is told so, rather than believing the message went out.

## Notifications

The bell, at the top right, counts what is unread. Four things arrive there:

- someone **mentions** you in a comment;
- someone **replies** in a conversation where you wrote;
- someone **assigns** you in a Person field — from the interface, the API, a form or an
  automation;
- an [automation](/basedb/en/fonctionnalites/automatisations/) **notifies** you.

Opening a notification opens the row. **Mark all as read** clears the counter; notifications
are kept for 90 days.

![A mention received](../../../../assets/screens/notifications.png)

## Real time

Other people’s writes appear **without reloading**: an edited cell, a moved card, an added
row — whether they come from the interface, the API, an agent or direct SQL. The server only
sends a **signal**, never data: it is the screen that reads again, with your permissions. A
cell you are editing is never replaced under your fingers.

## Presence

The faces of the people looking at **the same table** appear at the top of the screen; those
who have opened **the same row**, in the header of its details. In the grid, other people’s
pointers appear on the cell they are hovering over.

## Undo

Ctrl+Z undoes your last write — see [the history](/basedb/en/fonctionnalites/historique/#undo-ctrlz).

## Limits

- Notifications stay in basedb: none are sent by email for now.
- Beyond a hundred rows changed at once, the screen reloads the whole page rather than row by
  row.
