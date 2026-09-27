---
title: Webhook'lar
description: Her oluşturma, değiştirme ya da silmede başka bir sisteme haber vermek.
---

Bir webhook, bir ya da birkaç tablonun **olaylarını** bir HTTPS adresine gönderir:
`record.created`, `record.updated`, `record.deleted`. Webhook'lar, veritabanının menüsünde
**API ve ajanlar** altındaki **Webhook'lar…** üzerinden yönetilir.

## Yük

Gövde her zaman bir **olaylar dizisidir**; her olay, satırın **önceki** ve **sonraki** hâlini
eksiksiz olarak ve değişen alanların listesini içerir:

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

Doğrudan SQL ile yapılan bir yazma bile kendi olayını üretir: olaylar, tetikleyiciyle kaydedilen
geçmişten yola çıkar.

## İmza, sıra, yeniden denemeler

- **İmzalı**: `X-Basedb-Signature: t=…,v1=…`, ham gövdenin bir HMAC-SHA256 değeri; seri
  durumdan çıkarmadan önce doğrulanmalıdır.
- Satır bazında **sıralı**: aynı satırın iki olayı sırasıyla gelir.
- Başarısızlık durumunda **yeniden denenir**; bir sınırın ötesinde webhook devre dışı bırakılır
  ve arayüzden yeniden etkinleştirilir. Kuyruk ve her teslimat incelenebilir, yeniden
  oynatılabilir ya da bırakılabilir.
- **En az bir kez** teslimat: yinelenenleri `X-Basedb-Delivery-Id` ya da `events[].id`
  üzerinden ayıklayın.

## Hedefler

Webhook'lar yalnızca **herkese açık HTTPS** adreslerine gönderilir. Geliştirme sırasında
`BASEDB_WEBHOOK_DEV=1`, HTTP'yi ve yerel adresleri kabul eder.
