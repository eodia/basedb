---
title: Webhooks
description: Varsle et annet system ved hver opprettelse, endring eller sletting.
---

En webhook sender **hendelsene** fra én eller flere tabeller til en HTTPS-adresse:
`record.created`, `record.updated`, `record.deleted`. De administreres fra **Webhooks…** i
databasens meny, under **API og agenter**.

## Nyttelasten

Kroppen er alltid en **liste med hendelser**, hver med raden **før** og **etter**,
komplett, og listen over endrede felt:

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

Selv en skriving gjort i direkte SQL gir sin hendelse: hendelsene tar utgangspunkt i historikken,
som fanges opp av triggere.

## Signatur, rekkefølge, nye forsøk

- **Signert**: `X-Basedb-Signature: t=…,v1=…`, en HMAC-SHA256 av den rå kroppen, som skal kontrolleres før
  deserialisering.
- **Ordnet** per rad: to hendelser for samme rad kommer i riktig rekkefølge.
- **Nye forsøk** ved feil; etter det deaktiveres webhooken og kan aktiveres igjen fra
  grensesnittet. Køen og hver levering kan ses, sendes på nytt eller forkastes.
- Levering **minst én gang**: fjern duplikater med `X-Basedb-Delivery-Id` eller `events[].id`.

## Mål

Webhooks sendes bare til **offentlige HTTPS**-adresser. Under utvikling
godtar `BASEDB_WEBHOOK_DEV=1` HTTP og lokale adresser.
