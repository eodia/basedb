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

Pentru un **server din rețeaua dumneavoastră**, exploatantul instanței îl numește în
`BASEDB_WEBHOOK_ALLOW` — un nume, un domeniu (`*.intra.example.com`), o adresă sau o plajă
(`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Aceste destinații sunt acceptate indiferent de adresa, portul și schema lor, HTTP inclusiv.
Lista este valabilă și pentru cererile HTTP ale automatizărilor și sursele tabelelor
sincronizate; se reglează din mediu, niciodată din interfață.

## Fără webhook: urmărirea unui tabel

Un server care nu poate fi contactat se poate și el **conecta** la basedb și poate urmări un
tabel prin fluxul în timp real, cu un token de integrare al bazei:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Fluxul (`text/event-stream`) transportă **semnale** — evenimentul `records`, cu identificatorii
rândurilor create, modificate sau șterse —, niciodată valorile: programul recitește apoi aceste
rânduri prin [API REST](/basedb/ro/integrations/api-rest/). Un token revocat își închide fluxul
în 20 de secunde. Pentru un tabel citit rar, este suficient să recitiți din când în când
rândurile schimbate: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
