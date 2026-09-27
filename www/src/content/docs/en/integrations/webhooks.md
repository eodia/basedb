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
