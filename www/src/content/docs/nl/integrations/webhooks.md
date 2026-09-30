---
title: Webhooks
description: Een ander systeem op de hoogte brengen bij elke aanmaak, wijziging of verwijdering.
---

Een webhook stuurt de **gebeurtenissen** van een of meer tabellen naar een HTTPS-adres:
`record.created`, `record.updated`, `record.deleted`. Je beheert ze via **Webhooks…** in het
menu van de database, onder **API en agents**.

## De payload

De body is altijd een **array van gebeurtenissen**, elk met de rij **ervoor** en **erna**,
volledig, en de lijst van gewijzigde velden:

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

Zelfs een schrijfactie in directe SQL levert haar gebeurtenis op: ze vertrekken vanuit de geschiedenis,
die door een trigger wordt vastgelegd.

## Ondertekening, volgorde, nieuwe pogingen

- **Ondertekend**: `X-Basedb-Signature: t=…,v1=…`, een HMAC-SHA256 van de ruwe body, te controleren voordat je
  deserialiseert.
- **Geordend** per rij: twee gebeurtenissen van dezelfde rij komen in volgorde aan.
- **Opnieuw geprobeerd** bij een fout; daarna wordt de webhook uitgeschakeld en kun je hem weer inschakelen vanuit
  de interface. De wachtrij en elke levering kun je bekijken, opnieuw afspelen of opgeven.
- Levering **minstens één keer**: ontdubbel op `X-Basedb-Delivery-Id` of `events[].id`.

## Doelen

Webhooks gaan alleen naar **openbare HTTPS**-adressen. Tijdens ontwikkeling
accepteert `BASEDB_WEBHOOK_DEV=1` HTTP en lokale adressen.

Voor een **server in je netwerk** noemt de beheerder van de instantie die in
`BASEDB_WEBHOOK_ALLOW` — een naam, een domein (`*.intra.example.com`), een adres of een bereik
(`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Deze doelen worden geaccepteerd ongeacht hun adres, poort en schema, HTTP inbegrepen. De lijst
geldt ook voor de HTTP-verzoeken van automatiseringen en de bronnen van gesynchroniseerde
tabellen; je stelt hem in via de omgeving, nooit vanuit de interface.

## Zonder webhook: een tabel volgen

Een server die niet bereikt kan worden, kan ook **verbinding maken** met basedb en een tabel
volgen via de realtimestream, met een integratietoken van de database:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

De stream (`text/event-stream`) draagt **signalen** — de gebeurtenis `records`, met de id’s van
de aangemaakte, gewijzigde of verwijderde rijen —, nooit de waarden: het programma leest deze
rijen vervolgens terug via de [REST-API](/basedb/nl/integrations/api-rest/). Een ingetrokken
token sluit zijn stream binnen 20 seconden. Voor een tabel die zelden gelezen wordt, is het genoeg
om van tijd tot tijd de gewijzigde rijen terug te lezen: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
