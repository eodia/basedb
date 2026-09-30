---
title: Webhooks
description: Meddela ett annat system vid varje skapande, ändring eller borttagning.
---

En webhook skickar **händelserna** i en eller flera tabeller till en HTTPS-adress:
`record.created`, `record.updated`, `record.deleted`. De hanteras från **Webhooks…** i
databasens meny, under **API och agenter**.

## Nyttolasten

Kroppen är alltid en **array med händelser**, var och en med raden **före** och **efter**, i sin
helhet, och listan över ändrade fält:

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

Även en skrivning som görs med direkt SQL ger upphov till sin händelse: de utgår från historiken,
som fångas av triggrar.

## Signatur, ordning, nya försök

- **Signerad**: `X-Basedb-Signature: t=…,v1=…`, en HMAC-SHA256 av den råa kroppen, som ska
  kontrolleras innan den deserialiseras.
- **Ordnad** per rad: två händelser för samma rad kommer fram i rätt ordning.
- **Nya försök** vid fel; därefter inaktiveras webhooken och kan aktiveras igen från
  gränssnittet. Kön och varje leverans kan visas, skickas om eller överges.
- Leverans **minst en gång**: deduplicera på `X-Basedb-Delivery-Id` eller `events[].id`.

## Mål

Webhooks skickas bara till **offentliga HTTPS**-adresser. Under utveckling accepterar
`BASEDB_WEBHOOK_DEV=1` HTTP och lokala adresser.

För en **server i ditt nätverk** anger instansens driftsansvarige den i
`BASEDB_WEBHOOK_ALLOW` – ett namn, en domän (`*.intra.example.com`), en adress eller ett
intervall (`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Dessa mål godtas oavsett adress, port och schema, HTTP inräknat. Listan gäller även
automatiseringarnas HTTP-förfrågningar och synkroniserade tabellers källor; den ställs in i
miljön, aldrig från gränssnittet.

## Utan webhook: följa en tabell

En server som inte kan nås kan också **ansluta** till basedb och följa en tabell via
realtidsströmmen, med en integrationstoken för databasen:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Strömmen (`text/event-stream`) bär **signaler** – händelsen `records`, med id:erna för rader
som skapats, ändrats eller tagits bort –, aldrig värdena: programmet läser sedan dessa rader
igen via [REST-API:et](/basedb/sv/integrations/api-rest/). En återkallad token stänger sin
ström inom 20 sekunder. För en tabell som läses sällan räcker det att läsa de ändrade raderna
igen ibland: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
