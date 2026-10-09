---
title: Artificial intelligence
description: A field’s AI option, drafts, Copilot and the dashboards’ Copilot — and what goes to the provider.
---

AI is **optional**. With no provider configured, nothing goes anywhere. basedb can talk to
**OpenAI**, **Anthropic** and **Mistral**, with your own key — and to any server that speaks
OpenAI’s API: **Azure**, a company gateway, a model you host yourself.

## Configuring a provider

As long as no setting is saved in the interface, the API reads its environment:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral or openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # or BASEDB_AI_API_KEY
```

The key is read from `BASEDB_AI_API_KEY`, or failing that from the provider’s usual name
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, a gateway, a local model

`BASEDB_AI_PROVIDER=openai_compatible` sends the calls, in OpenAI’s format, to the address in
`BASEDB_AI_BASE_URL`: everything that comes before `/chat/completions`, parameters included.
`BASEDB_AI_HEADERS` adds to every call the headers this server requires, as a JSON object.

```bash
# Azure OpenAI: the deployment name as the model, the key in the api-key header
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Azure’s older per-deployment form: the parameter stays after the path
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# A model served by Ollama, without a key
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

With `openai_compatible`, the key is optional: if `BASEDB_AI_API_KEY` is given, it goes out as
`Authorization: Bearer`. A header from `BASEDB_AI_HEADERS` replaces the key’s — a gateway that
wants its own `Authorization`, for example.

`BASEDB_AI_BASE_URL` and `BASEDB_AI_HEADERS` also serve the other three providers, reached
through a gateway: for `anthropic`, the address is everything that comes before `/messages`.
These two variables go with the environment’s provider, and only that one: a workspace that
has chosen another one receives neither the address, nor the headers, nor the key. On startup,
the API logs the provider it settled on, and flags an invalid address or JSON object.

An internal gateway whose TLS certificate is self-signed, or a company proxy that re-signs the
traffic, makes the calls fail: `BASEDB_AI_PROVIDER_SSL_VERIFY=false` stops verifying the
certificate **of this provider only** — every other outgoing call of the instance, and the
provider a workspace may have chosen, stay verified. Startup reports it. Since the key goes
out with every call, reserve this for a network you control.

## The AI option on a field

AI is not a field type but an **option**: the **AI** switch in a field’s form — text, long
text, URL, number, single select, boolean, date — has it filled by a model, from a prompt that
cites other columns:

```text
Summarize {{Notes}} in one sentence.
Category of {{Description}} among the list’s choices.
```

- The field is computed as soon as the row exists, then every time a cited column changes —
  and, if you want, on a schedule (every 15 minutes at most).
- The column **keeps its type**: an answer where nothing can be read in that type (a number
  that cannot be found, a choice that does not exist) is rejected rather than written.
- Turning the option off makes the field editable by hand again, values kept.
- The cited values go to the provider: **turning it on requires explicit consent**.

`BASEDB_AI_FIELD_QUOTA` caps these computations per hour and per workspace (300 by default).

## In an automation

An [automation](/basedb/en/fonctionnalites/automatisations/#ask-ai) can **ask AI** in one of
its steps: a prompt that cites the row and the previous steps, an answer read in the chosen
type, which the following steps write, send or cite. Same rules as for a field: consent when
saving, only what the prompt cites goes out, each call logged and counted toward
`BASEDB_AI_FIELD_QUOTA`.

## Drafts and Copilot

- **Drafts**: describe a table or a formula in one sentence, and receive a proposal to review.
  Only labels, types and the sentence you typed go out — no cell values.
- **Templates**: describe a whole base — “tracking my clients’ complaints” — and receive
  tables, sample rows, views, a dashboard and automations, to refine and then create. Only the
  sentence goes out. See [Base templates](/basedb/en/fonctionnalites/modeles/#asking-the-ai).
- **Copilot**: a conversation about the displayed base. You ask for a filter, a query,
  columns, a table, a test data set; each proposal arrives as a card and is applied in one
  click, through the same routes as the forms.

By default, only the structure goes to the provider. The **“Allow reading data”** box lets
Copilot read rows for the conversation (50 at most per read) and answer from them — each read
is listed under its answer.

## Dashboard Copilot

In the [Dashboards](/basedb/en/fonctionnalites/tableaux-de-bord/#copilot) section, Copilot
proposes questions, changes to the dashboard and values for its filters, to apply in one click.
Same rules: without consent, only the structure goes out — tables and fields, the base’s
dashboards and questions, the definition of the displayed dashboard’s cards (their questions,
their texts) —, never the results or the values chosen in the filters. The **“Allow reading
data”** box adds those values and the cards’ results under the displayed filters, 50 rows at
most per read, each one listed under the answer.

## Automation Copilot

In the [Automations](/basedb/en/fonctionnalites/automatisations/#copilot) section, Copilot
proposes a whole automation — the one on screen, modified, or a new one — which it lays on the
editor’s flow, **without ever saving it**: you review it, then save it. Same rules: without
consent, only the structure goes out — tables and fields, the base’s automations, the one on
screen, its latest runs without any value, people and Slack channels as placeholders —, and the
**“Allow reading data”** box adds rows that were read, 50 at most per read.

`BASEDB_AI_QUOTA` caps interactive calls per hour and per workspace (120 by default).
