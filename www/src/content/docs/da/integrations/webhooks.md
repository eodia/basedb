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

For en **server på dit netværk** navngiver instansens driftsansvarlige den i
`BASEDB_WEBHOOK_ALLOW` — et navn, et domæne (`*.intra.example.com`), en adresse eller et
interval (`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Disse mål accepteres, uanset deres adresse, port og skema, HTTP inklusive. Listen gælder også
for automatiseringernes HTTP-forespørgsler og synkroniserede tabellers kilder; den indstilles i
miljøet, aldrig fra brugerfladen.

## Uden webhook: følg en tabel

En server, der ikke kan nås, kan også **oprette forbindelse** til basedb og følge en tabel via
realtidsstrømmen, med et integrationstoken fra databasen:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Strømmen (`text/event-stream`) bærer **signaler** — hændelsen `records`, med id'erne på
rækker, der er oprettet, ændret eller slettet —, aldrig værdierne: programmet genlæser derefter
disse rækker via [REST-API'et](/basedb/da/integrations/api-rest/). Et tilbagekaldt token lukker
sin strøm inden for 20 sekunder. For en tabel, der læses sjældent, er det nok at genlæse de
ændrede rækker fra tid til anden: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
