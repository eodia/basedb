---
title: Webhook-uri
description: Anunțați un alt sistem la fiecare creare, modificare sau ștergere.
---

Un webhook trimite la o adresă HTTPS **evenimentele** unuia sau mai multor tabele:
`record.created`, `record.updated`, `record.deleted`. Webhook-urile se gestionează din
**Webhook-uri…** în meniul bazei, sub **API și agenți**.

## Încărcătura utilă

Corpul este întotdeauna un **tablou de evenimente**, fiecare cu rândul **înainte** și
**după**, complete, și cu lista câmpurilor modificate:

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

Chiar și o scriere făcută în SQL direct își produce evenimentul: evenimentele pornesc din
istoric, captat de un trigger.

## Semnătură, ordine, reîncercări

- **Semnat**: `X-Basedb-Signature: t=…,v1=…`, un HMAC-SHA256 al corpului brut, de verificat
  înainte de deserializare.
- **Ordonat** pe rând: două evenimente ale aceluiași rând sosesc în ordine.
- **Reîncercat** în caz de eșec; dincolo de o limită, webhook-ul este dezactivat și se
  reactivează din interfață. Coada și fiecare livrare se pot consulta, relua sau abandona.
- Livrare **cel puțin o dată**: eliminați duplicatele după `X-Basedb-Delivery-Id` sau
  `events[].id`.

## Destinații

Webhook-urile pleacă doar către adrese **HTTPS publice**. În dezvoltare,
`BASEDB_WEBHOOK_DEV=1` acceptă HTTP și adresele locale.
