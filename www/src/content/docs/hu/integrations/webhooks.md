---
title: Webhookok
description: Egy másik rendszer értesítése minden létrehozáskor, módosításkor vagy törléskor.
---

A webhook egy vagy több tábla **eseményeit** küldi el egy HTTPS-címre: `record.created`,
`record.updated`, `record.deleted`. Az adatbázis menüjében, az **API és ügynökök** alatt lévő
**Webhookok…** menüpontból kezelhetők.

## A hasznos adat

A törzs mindig egy **eseménytömb**, mindegyik eseményben a sor teljes **előtte** és **utána**
állapotával, valamint a megváltozott mezők listájával:

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

Még a közvetlen SQL-ben végzett írás is létrehozza a maga eseményét: az események az
előzményekből indulnak, amelyeket trigger rögzít.

## Aláírás, sorrend, újrapróbálkozások

- **Aláírt**: `X-Basedb-Signature: t=…,v1=…`, a nyers törzs HMAC-SHA256 kivonata, amelyet a
  deszerializálás előtt kell ellenőrizni.
- Soronként **rendezett**: ugyanazon sor két eseménye sorrendben érkezik.
- Hiba esetén **újrapróbálkozik**; ezen túl a webhook kikapcsol, és a felületről kapcsolható
  vissza. A sor és az egyes kézbesítések megtekinthetők, újrajátszhatók vagy elvethetők.
- **Legalább egyszeri** kézbesítés: az `X-Basedb-Delivery-Id` vagy az `events[].id` alapján
  szűrje ki az ismétlődéseket.

## Célcímek

A webhookok csak **nyilvános HTTPS**-címekre indulnak. Fejlesztés közben a
`BASEDB_WEBHOOK_DEV=1` a HTTP-t és a helyi címeket is elfogadja.
