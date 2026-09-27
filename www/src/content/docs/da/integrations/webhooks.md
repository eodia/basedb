---
title: Webhooks
description: Giv et andet system besked ved hver oprettelse, ændring eller sletning.
---

En webhook sender **hændelserne** fra en eller flere tabeller til en HTTPS-adresse:
`record.created`, `record.updated`, `record.deleted`. De administreres fra **Webhooks…** i
databasens menu under **API og agenter**.

## Payloaden

Kroppen er altid en **liste over hændelser**, hver med den komplette række **før** og **efter**
og listen over ændrede felter:

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

Selv en skrivning i direkte SQL giver sin hændelse: de udgår fra historikken, som fanges af en
trigger.

## Signatur, rækkefølge, genforsøg

- **Signeret**: `X-Basedb-Signature: t=…,v1=…`, en HMAC-SHA256 af den rå krop, som skal
  kontrolleres før deserialisering.
- **Ordnet** pr. række: to hændelser for den samme række ankommer i rækkefølge.
- **Forsøgt igen** ved fejl; derefter deaktiveres webhooken og kan genaktiveres fra
  brugerfladen. Køen og hver levering kan ses, sendes igen eller opgives.
- Levering **mindst én gang**: fjern dubletter ud fra `X-Basedb-Delivery-Id` eller `events[].id`.

## Mål

Webhooks sendes kun til **offentlige HTTPS**-adresser. Under udvikling accepterer
`BASEDB_WEBHOOK_DEV=1` HTTP og lokale adresser.
