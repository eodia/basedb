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

**Ağınızdaki bir sunucu** için kurulumu işleten kişi onu `BASEDB_WEBHOOK_ALLOW` içinde adlandırır
— bir ad, bir alan adı (`*.intra.example.com`), bir adres ya da bir aralık (`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Bu hedefler, adresleri, portları ve şemaları ne olursa olsun — HTTP dahil — kabul edilir. Liste,
otomasyonların HTTP istekleri ve senkronize tabloların kaynakları için de geçerlidir; ortamda
ayarlanır, arayüzden asla ayarlanmaz.

## Webhook olmadan: bir tabloyu takip etmek

Erişilemeyen bir sunucu basedb'ye **bağlanabilir** de ve veritabanının bir entegrasyon token'ıyla
gerçek zamanlı akış üzerinden bir tabloyu takip edebilir:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Akış (`text/event-stream`) **sinyaller** taşır — oluşturulan, değiştirilen ya da silinen
satırların kimlikleriyle birlikte `records` olayı —, asla değerleri taşımaz: program bu satırları
daha sonra [REST API](/basedb/tr/integrations/api-rest/) ile yeniden okur. İptal edilen bir
token akışını 20 saniye içinde kapatır. Nadiren okunan bir tablo için, değişen satırları zaman
zaman yeniden okumak yeterlidir: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
