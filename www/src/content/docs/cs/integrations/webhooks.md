---
title: Webhooky
description: Upozornění jiného systému při každém vytvoření, úpravě nebo odstranění.
---

Webhook odesílá na adresu HTTPS **události** jedné nebo více tabulek:
`record.created`, `record.updated`, `record.deleted`. Spravují se přes **Webhooky…** v nabídce
databáze v části **API a agenti**.

## Datová část

Tělo je vždy **seznam událostí**, každá s úplným řádkem **před** a **po** změně a se seznamem
změněných polí:

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

Svou událost vytvoří i zápis provedený přímo v SQL: události vycházejí z historie, kterou
zachycuje trigger.

## Podpis, pořadí, opakování

- **Podepsáno**: `X-Basedb-Signature: t=…,v1=…`, HMAC-SHA256 nezpracovaného těla, který je
  třeba ověřit před deserializací.
- **Seřazeno** podle řádku: dvě události téhož řádku dorazí ve správném pořadí.
- **Opakováno** v případě selhání; po vyčerpání pokusů se webhook deaktivuje a znovu se
  aktivuje z rozhraní. Frontu i každé doručení lze prohlížet, znovu přehrát nebo zahodit.
- Doručení **alespoň jednou**: deduplikujte podle `X-Basedb-Delivery-Id` nebo `events[].id`.

## Cíle

Webhooky se odesílají jen na **veřejné adresy HTTPS**. Při vývoji `BASEDB_WEBHOOK_DEV=1`
povolí HTTP a místní adresy.

Pro **server ve vaší síti** ho provozovatel instance uvede v `BASEDB_WEBHOOK_ALLOW` — název,
doménu (`*.intra.example.com`), adresu nebo rozsah (`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Tyto cíle se přijímají bez ohledu na jejich adresu, port a schéma, včetně HTTP. Seznam platí
i pro HTTP požadavky automatizací a zdroje synchronizovaných tabulek; nastavuje se
v prostředí, nikdy z rozhraní.

## Bez webhooku: sledování tabulky

Server, kterého nelze zastihnout, se může k basedb i **připojit** a sledovat tabulku
proudem dat v reálném čase, s integračním tokenem databáze:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Proud (`text/event-stream`) nese **signály** — událost `records`, s identifikátory
vytvořených, upravených nebo odstraněných řádků —, nikdy hodnoty: program si tyto řádky
poté znovu přečte přes [REST API](/basedb/cs/integrations/api-rest/). Odvolaný token uzavře
svůj proud do 20 sekund. Pro tabulku čtenou zřídka stačí čas od času znovu přečíst změněné
řádky: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
