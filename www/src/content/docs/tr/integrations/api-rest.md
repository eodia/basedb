---
title: REST API
description: basedb satırlarını bir programdan okumak ve yazmak.
---

REST API, arayüzün kullandığı API ile aynıdır: **özel bir yol yoktur**. URL'leri fiziksel
adları taşır — SQL'de de okuduğunuz adları.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Bir token

Arayüzde, veritabanının **⋯** menüsü → **API ve ajanlar** → **API ve MCP token'ları…**: şifrenizi
doğruladıktan sonra burada bu veritabanıyla sınırlı, varsayılan olarak salt okunur bir
**entegrasyon token'ı** oluşturulur. Token yalnızca bir kez gösterilir; onu bir ortam
değişkenine koyun.

Bir token okur; yazma yetkisiyle oluşturulduysa oluşturur ve değiştirir; **asla silmez** ve onu
oluşturan kişiden asla daha fazla izne sahip olmaz.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Okuma

| Parametre | Rol |
|---|---|
| `filter` | okunabilir bir ifade: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | döndürülecek sütunlar |
| `limit`, `cursor` | şifreli imleçle sayfalama (yanıtta `next_cursor`) |
| `links=display` | ilişkiler, görüntüleme değerleriyle birlikte |
| `count=exact` | toplam, en fazla 100.000 |
| `variables=raw` | uzun metinler, [satırın değerleriyle](/basedb/tr/fonctionnalites/tables-et-champs/#zengin-metin-ve-değişkenler) değil, `{{colonne}}` dahil yazıldıkları gibi |

Operatörler: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`; `and`, `or`, `not` ve parantezlerle birleştirilir. Bir
filtre bir ilişkiyi aşabilir: `clients_id.ville eq "Lyon"`.

## Yazma

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` aynı `{"values": {…}}` gövdesiyle bir satırı değiştirir. Hataların tek
bir biçimi vardır: `{ "code": "…", "details": {…}, "request_id": "…" }`; her neden için kararlı
bir kod.

Her yazma `x-basedb-transaction` başlığını döndürür: bu değeri
`POST /api/v1/<tenant>/history/undo` adresine (`{"transaction": "…"}`) göndermek, arayüzdeki
Ctrl+Z gibi yazmayı geri alır — satır o zamandan beri değiştirildiyse reddedilir.

## Satırların ötesinde

Aynı token ile:

| Yol | Rol |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | bir filtrenin tüm satırları üzerinde özetler: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | bir satırın yorumlarını okumak ve yazmak |
| `POST /api/v1/<tenant>/automations/<id>/run` | bir düğmeyle tetiklenen bir otomasyonu bir satır üzerinde başlatmak (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | bir veritabanının panoları |
| `GET /api/v1/<tenant>/meta/users` | bir Kişi alanı için çalışma alanının üyeleri |
| `GET /api/v1/<tenant>/meta/templates` | galerideki veritabanı şablonları |

[Paylaşılan görünümler](/basedb/tr/fonctionnalites/vues-partagees/) hesap olmadan okunur:
JSON olarak `GET /api/v1/views/<jeton>` ve `…/rows`, iCalendar olarak `…/calendar.ics`.

İnşa etmek — bir otomasyon, bir pano, bir entegrasyon oluşturmak — arayüzde açılmış bir
oturuma ayrılmıştır: bir token satırları okur ve yazar, veritabanını değiştirmez.

## Oluşturulan belgeler

Her veritabanının bir **API ve MCP belgeleri** sayfası vardır: her tablo için uç noktaları,
sütunları, cURL ve JavaScript örnekleri. Sayfa **izinlerinize göre filtrelenir** — iki okuyucu
iki farklı sürüm görür —, **ekranınızın dilinde** yazılır ve OpenAPI 3.1 olarak da sunulur
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`). Adlar, yollar ve hata kodları tüm
dillerde aynı kalır.

![Bir veritabanının oluşturulan belgeleri](../../../../assets/screens/documentation-api.png)
