---
title: Webhook
description: Avvisare un altro sistema a ogni creazione, modifica o eliminazione.
---

Un webhook invia a un indirizzo HTTPS gli **eventi** di una o più tabelle:
`record.created`, `record.updated`, `record.deleted`. Si gestiscono da **Webhook…** nel
menu del database, sotto **API e agenti**.

## Il payload

Il corpo è sempre un **array di eventi**, ciascuno con la riga **prima** e **dopo**,
complete, e l’elenco dei campi modificati:

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

Anche una scrittura eseguita in SQL diretto produce il suo evento: gli eventi partono dalla cronologia,
catturata da un trigger.

## Firma, ordine, nuovi tentativi

- **Firmato**: `X-Basedb-Signature: t=…,v1=…`, un HMAC-SHA256 del corpo grezzo, da verificare prima di
  deserializzare.
- **Ordinato** per riga: due eventi della stessa riga arrivano in ordine.
- **Ritentato** in caso di errore; oltre un certo limite, il webhook viene disattivato e si riattiva dall’interfaccia.
  La coda e ogni consegna si possono consultare, rieseguire o abbandonare.
- Consegna **almeno una volta**: deduplica su `X-Basedb-Delivery-Id` o `events[].id`.

## Destinazioni

I webhook partono solo verso indirizzi **HTTPS pubblici**. In sviluppo,
`BASEDB_WEBHOOK_DEV=1` accetta HTTP e gli indirizzi locali.

Per un **server della tua rete**, chi amministra l’istanza lo indica in
`BASEDB_WEBHOOK_ALLOW` — un nome, un dominio (`*.intra.example.com`), un indirizzo o un intervallo
(`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Queste destinazioni sono accettate indipendentemente dal loro indirizzo, dalla loro porta e dal loro schema, HTTP
compreso. La lista vale anche per le richieste HTTP delle automazioni e le fonti delle
tabelle sincronizzate; si imposta nell’ambiente, mai dall’interfaccia.

## Senza webhook: seguire una tabella

Un server che non può essere contattato può anche **connettersi** a basedb e seguire una tabella
tramite il flusso in tempo reale, con un token di integrazione del database:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Il flusso (`text/event-stream`) porta dei **segnali** — l’evento `records`, con gli
identificativi delle righe create, modificate o eliminate —, mai i valori: il programma
rilegge poi queste righe tramite l’[API REST](/basedb/it/integrations/api-rest/). Un token revocato
chiude il suo flusso entro 20 secondi. Per una tabella letta raramente, rileggere di tanto in tanto le
righe cambiate è sufficiente: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
