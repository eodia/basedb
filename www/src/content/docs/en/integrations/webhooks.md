---
title: Webhooks
description: Notify another system on every creation, update or deletion.
---

A webhook sends the **events** of one or more tables to an HTTPS address: `record.created`,
`record.updated`, `record.deleted`. They are managed from **Webhooks…** in the base’s menu,
under **API and agents**.

## The payload

The body is always an **array of events**, each with the row **before** and **after**, in
full, and the list of changed fields:

```json
{ "events": [
  { "id": "0195e…", "type": "record.updated",
    "occurred_at": "2026-09-26T14:03:00.120Z",
    "tenant": "t4z56fq", "base": "b_t4z56fq_ventes", "table": "opportunites",
    "record_id": "0195a…",
    "actor": { "kind": "user" },
    "before": { "statut": "negociation", "montant": "125000", … },
    "after":  { "statut": "gagne", "montant": "125000", … },
    "changed": ["statut"] } ] }
```

Even a write made in direct SQL produces its event: events start from the history, captured
by a trigger.

## Signature, ordering, retries

- **Signed**: `X-Basedb-Signature: t=…,v1=…`, an HMAC-SHA256 of the raw body, to verify before
  deserializing.
- **Ordered** per row: two events for the same row arrive in order.
- **Retried** on failure; beyond that, the webhook is disabled and can be re-enabled from the
  interface. The queue and each delivery can be inspected, replayed or abandoned.
- **At-least-once** delivery: deduplicate on `X-Basedb-Delivery-Id` or `events[].id`.

## Targets

Webhooks only go to **public HTTPS** addresses. In development, `BASEDB_WEBHOOK_DEV=1` accepts
HTTP and local addresses.

For a **server on your network**, the instance’s operator names it in `BASEDB_WEBHOOK_ALLOW` —
a hostname, a domain (`*.intra.example.com`), an address or a range (`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

These targets are accepted whatever their address, port and scheme, HTTP included. The list
also applies to automations’ HTTP requests and synced tables’ sources; it is set in the
environment, never from the interface.

## Without a webhook: following a table

A server that cannot be reached can also **connect** to basedb and follow a table through the
real-time stream, with an integration token of the base:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

The stream (`text/event-stream`) carries **signals** — the `records` event, with the ids of
rows created, updated or deleted —, never the values: the program then reads these rows back
through the [REST API](/basedb/en/integrations/api-rest/). A revoked token closes its stream
within 20 seconds. For a table read rarely, reading the changed rows back from time to time is
enough: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
