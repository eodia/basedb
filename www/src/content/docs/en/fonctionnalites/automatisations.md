---
title: Automations
description: When a row changes, at a set time or at the click of a button — update, create, find, branch, ask AI, notify, send an email, call a webhook, post to Slack.
---

An automation says **when**, **if** and **then**: when a task moves to “Fait”, record the
time; when a negative review comes in, notify the person in charge and post to Slack; every
Monday at 9 a.m., create the row for the team meeting. And when one action is not enough, it
follows a **flow**: find a row, take one branch or another depending on what it says, reuse in
one step what an earlier step found or wrote.

They open from **Automations**, in the block of the open base at the bottom of the sidebar,
and require the **Manage** level.

![A flow, with one of its runs laid over it](../../../../assets/screens/en/automatisations.webp)

## The flow

The flow is drawn from top to bottom: the trigger, then each step. A **+** on a line adds a
step at that point; a card opens its settings on the right. A simple automation — a trigger
and an action — fits in two cards, and is set up as before.

## When

| Trigger | Settings |
|---|---|
| **A row is created** | the table |
| **A row is updated** | the table, and optionally only the fields to watch |
| **At a set time** | every hour, every day or every week, at the chosen time and in the chosen time zone |
| **A button is clicked** | a [Button field](/basedb/en/fonctionnalites/tables-et-champs/#button) of the table |

A trigger on rows sees **all** writes: the interface, the API, an agent, a shared form, and
even direct SQL — automations start from the history, which captures them all.

## Only if

An optional condition, in the [filter language](/basedb/en/integrations/api-rest/#reading) —
`statut eq "fait"`, `montant gte 10000 and payee eq false` — evaluated on the row **at the
moment of acting**. A run whose condition is not met is “skipped”, and says so.

## Then

Up to thirty steps, in order; the first one that fails stops the following ones.

| Step | What it does |
|---|---|
| **Update row** | writes values into the row that triggered — or into the one a step found or created |
| **Create row** | in this table or another one of the base |
| **Find row** | the first row of a table that matches a filter, so that the following steps can cite or update it |
| **Notify someone** | a [notification](/basedb/en/fonctionnalites/collaboration/#notifications) to chosen people, or to the one in a Person field |
| **Send an email** | to people on the team, to the one in a Person field, to the address in an Email field — a client, a supplier — or to written addresses; the subject and text cite the row and the previous steps |
| **Call webhook** | an HTTPS `POST` to the address of your choice; its response can then be cited |
| **Send to Slack** | a message in a [connected](/basedb/en/integrations/synchronisation/#slack) channel |
| **Ask AI** | an answer from the [AI provider](/basedb/en/fonctionnalites/ia/) to a prompt that cites the row and the previous steps — draft, summarize, classify —, read as a text, a number, yes or no, a date or a choice from a list |
| **Condition** | several branches: the first one whose condition is met is taken, “Otherwise” when none is; the branches then join again |

A search that finds nothing does not stop the flow: the steps that were to update its row are
skipped. To do something else in that case, a condition tests it — a branch whose filter is
empty is taken as soon as the search has found something.

## Ask AI

Like an [AI field](/basedb/en/fonctionnalites/ia/#the-ai-option-on-a-field), the step sends its
prompt to the provider, with each citation replaced by its value:

```text
Does this review from {{auteur}} call for action on our part? {{avis}}
```

You choose the **expected answer** — free or short text, a number, yes or no, a date, a web
address, or a choice from a list, which can be taken from a select field. The model is told
so, and an answer that does not contain one makes the step fail. The following steps cite it
as `{{e1.reponse}}`: in the title of a created task, a message, or a select field, where it is
filed under the choice with the same label.

What the prompt cites goes to the provider: the step asks for your **consent**, to be given
again when the prompt changes. Each call is logged and counts, along with AI fields, toward
`BASEDB_AI_FIELD_QUOTA` (300 per hour by default). The AI does nothing on its own: it is the
steps placed after it that write or notify.

## Citing

Values, messages and filters cite what came before, from the **{ }** button next to each
text:

- `{{Titre}}`, `{{_id}}`: the row that triggered;
- `{{e2.titre}}`, `{{e2._id}}`: the row found, created or updated by step `e2` — each step
  shows its identifier on its card;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: what webhook `e3` responded;
- `{{e4.reponse}}`: the answer of AI step `e4`;
- `{{_maintenant}}`: the moment of the run.

A value made of a single citation passes the value itself: a relation, a person, a choice —
this is how a created row is linked to the one a search found. In a filter, a citation is
always a compared value, never filter language.

A step can only cite what has certainly happened before it: what one branch found can no
longer be cited after the condition. The editor points this out on the card before saving.

## Copilot

**Copilot**, in the header, opens a natural-language conversation on the right about the
base’s automations: “when a task moves to review, notify the assignee”, “add an AI summary to
the notes”, “why did the last run fail?”. It answers and **proposes** a whole automation — the
one on screen, modified, or a new one —, with the list of what changes.

Copilot saves nothing: **Apply to the flow** shows the proposal in the editor, where you
review it before saving — and **Cancel**, on the card, returns the flow to how it was. A new
automation opens in the editor, ready to be created. Each proposal is checked as a save would
be; what does not hold is dropped, and said.

By default, **only the structure** goes to the AI provider, along with the conversation: the
tables and their fields, the base’s automations, the one on screen as the editor shows it, and
its latest runs — their statuses and error codes, never a value. People and Slack channels are
sent as placeholders (`p1`, `s1`), never by their identifier. The **Allow reading data** box
lets Copilot read rows for the conversation (50 at most per read), each read listed under its
answer.

## Testing and monitoring

**Test on a row** runs the saved automation on a chosen row, for real. The **Runs** tab keeps
the last 50, for 30 days: pending, running, succeeded, skipped with its reason, failed with its
code. Choosing one lays it over the flow — the branch taken is traced, each step passed says
what it did and how long it took, the rest is dimmed.

## On whose behalf it acts

An automation acts with the **permissions of the person who last saved it**, decided again on
every run: if that person loses a permission, the step that needed it fails instead of
bypassing it, and a search only finds what they can read. The history shows it as
“Automation ‘Tâche terminée’ · on behalf of …”, and its writes can be undone like any others.

## Limits

- What an automation writes triggers no other automation: whatever must follow on is written
  in a single flow.
- A search returns one row, the first; no “for each row” yet, nor waiting (“three days
  later”).
- No scripts. An email goes out as plain text, one per recipient — twenty at most per step —,
  through the instance’s [mail server](/basedb/en/hebergement/variables/#emails); a reply
  reaches the person who owns the automation.
- A condition tests a row: to take a branch based on the AI’s answer, first write it into a
  field of the row.
- A [base template](/basedb/en/fonctionnalites/modeles/) only carries automations without
  searches, conditions or AI steps.
- 100 runs per hour per automation; a missed scheduled time is caught up only once.
- The delay between the write and the action is on the order of a second.
