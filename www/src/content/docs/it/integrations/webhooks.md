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
