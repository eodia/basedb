---
title: Doğrudan SQL
description: basedb tablolarını psql, bir BI aracı ya da bir betikle okumak ve yazmak.
---

basedb'nin varlık nedeni budur: **tablolarınız gerçek tablolardır**. Her PostgreSQL istemcisi
onları adlarıyla okur.

## Adlar

| Nesne | Fiziksel ad | Örnek |
|---|---|---|
| Veritabanı | bir `b_<tenant>_<nom>` şeması | `b_t4z56fq_ventes` |
| Test ortamı | sonek eklenmiş şema | `b_t4z56fq_ventes_recette` |
| Tablo | slug'a dönüştürülmüş adı | `opportunites` |
| Alan | slug'a dönüştürülmüş adı | `echeance` |
| İlişki | `<table cible>_id` | `clients_id` |
| [SQL görünümü](/basedb/tr/fonctionnalites/requetes-et-vues-sql/) | veritabanının şemasındaki teknik adı | `factures_a_encaisser` |

Her veritabanının **API ve MCP belgeleri** sayfası bu adların hepsini verir ve `psql`'deki `\d`
açıklamaları (`COMMENT ON`) gösterir.

## Arayüzde

Sekme çubuğundaki **+** ya da veritabanının **⋯** menüsü → **Yeni SQL sorgusu**: sonucu
tablolarınızla aynı ızgarada görüntülenen, sözdizimi renklendirmesi ve otomatik tamamlama sunan
bir düzenleyici.

![Kayıtlı bir sorgu ve tabloların arasında yer alan iki SQL görünümü](../../../../assets/screens/requete-sql.png)

- **Herkes orada kendi izinleriyle okur**: Yönetim düzeyi, yazmalar dahil tüm veritabanına
  erişir; diğer üyeler salt okunur SQL yazar; orada kapalı bir tablo yoktur ve gizli bir alan
  kaybolur.
- Bir sorgu tabloların altına **kaydedilir** — kendiniz için, tüm veritabanı için ya da gruplar
  için — ve istenirse bir **SQL görünümüne** dönüşür: tabloların arasında yer alan ve
  `psql`'den okunabilen gerçek bir PostgreSQL görünümü.

Her şey [Sorgular ve SQL görünümleri](/basedb/tr/fonctionnalites/requetes-et-vues-sql/)
sayfasında ayrıntılı olarak anlatılır.

## psql'den

Sağlanan `docker-compose.yml` ile PostgreSQL `127.0.0.1:5432` üzerinde yayımlanır:

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## SQL ile yazma

Buna izin verilir. Kısıtlamalar (tekli seçimler, ilişkiler, URL'ler, zorunluluk) PostgreSQL
tarafından korunur ve arayüzde olduğu gibi geçersiz bir değeri reddeder. Ve yazma **geçmişe
kaydedilir**: geçmiş onu, yazmayı yapan oturumla birlikte “Doğrudan SQL oturumu” olarak
gösterir ve diğer yazmalar gibi geri alınabilir.

:::caution
**Yapıyı** SQL ile değiştirmek (`ALTER TABLE`) basedb kataloğunu atlar; katalog bu değişikliği
bilmez. Arayüzü, API'yi ya da bir ajan önerisini kullanın: geçiş motoru planlar, kısa süreli
kilitler ve kataloğu doğru tutar.
:::
