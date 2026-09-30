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

Egy **az Ön hálózatán lévő szerver** esetén a példány üzemeltetője a
`BASEDB_WEBHOOK_ALLOW` változóban nevezi meg — egy nevet, egy domaint
(`*.intra.example.com`), egy címet vagy egy tartományt (`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Ezek a célok elfogadottak, bármi legyen is a címük, a portjuk és a sémájuk, a HTTP-t is
beleértve. A lista az automatizálások HTTP-kéréseire és a szinkronizált táblák forrásaira is
vonatkozik; a környezetben állítható be, a felületről soha.

## Webhook nélkül: tábla követése

Egy olyan szerver, amelyet nem lehet elérni, **kapcsolódhat is** a basedb-hez, és követhet
egy táblát a valós idejű folyamon keresztül, az adatbázis egy integrációs tokenjével:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

A folyam (`text/event-stream`) **jelzéseket** hordoz — a `records` eseményt, a létrehozott,
módosított vagy törölt sorok azonosítóival —, sosem az értékeket: a program ezután ezeket a
sorokat a [REST API-n](/basedb/hu/integrations/api-rest/) keresztül olvassa vissza újra. Egy
visszavont token 20 másodpercen belül lezárja a folyamát. Egy ritkán olvasott táblánál elég
időnként újraolvasni a megváltozott sorokat: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
