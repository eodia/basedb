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

For en **server i nettverket ditt** navngir driftsansvarlig for instansen den i
`BASEDB_WEBHOOK_ALLOW` – et navn, et domene (`*.intra.example.com`), en adresse eller et område
(`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Disse målene godtas uansett adresse, port og skjema, HTTP inkludert. Listen gjelder også for
HTTP-forespørslene fra automatiseringer og kildene til synkroniserte tabeller; den settes i
miljøet, aldri fra grensesnittet.

## Uten webhook: følge en tabell

En server som ikke kan nås, kan også **koble seg til** basedb og følge en tabell via
sanntidsstrømmen, med et integrasjonstoken for databasen:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Strømmen (`text/event-stream`) bærer **signaler** – hendelsen `records`, med identifikatorene
til radene som er opprettet, endret eller slettet –, aldri verdiene: programmet leser deretter
disse radene på nytt via [REST-API-et](/basedb/nb/integrations/api-rest/). Et tilbakekalt token
stenger strømmen sin innen 20 sekunder. For en tabell som leses sjelden, er det nok å lese de
endrede radene på nytt en gang iblant: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
