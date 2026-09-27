---
title: İlkeler
description: basedb'nin mimarisini belirleyen kararlar.
---

basedb bir **mimari belgesinden** yola çıkarak tasarlandı — depoda,
[`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture) altında on
altı bölüm. Belgenin 00. bölümü yirmi beş karar belirler; işte bunların özü.

## Veriler bir biçim değil, tablodur

Bir kullanıcı veritabanı bir PostgreSQL **şemasıdır**, bir tablo bir tablodur, bir alan
**açıkça adlandırılmış** tipli bir sütundur. EAV (varlık-öznitelik-değer) yok, her şeyin içine
atıldığı bir JSON belgesi yok, anlaşılmaz ad yok. `_basedb` kataloğu bu nesneleri tanımlar;
onların yerini almaz.

İstenen sonuç: doğrudan SQL **meşru** bir kullanımdır. Kısıtlamalar veritabanında tanımlanır,
geçmiş tetikleyiciyle kaydedilir — hiçbir şey yazmanın uygulamadan geçtiğini varsaymaz.

## Tek bir izin karar noktası

Arayüz, REST API, MCP sunucusu, paylaşılan formlar, webhook'lar: hepsi çekirdekteki **aynı
izin uygulama noktasından** geçer. Arayüz, API'nin diğerleri gibi bir tüketicisidir — özel yol
yok, servis token'ı yok. Görülemeyen bir kaynak, var olmayan bir kaynakla tamamen aynı yanıtı
verir.

## Çekirdek karar verir, bağdaştırıcılar çevirir

Bir TypeScript monoreposu: `@basedb/core` tüm mantığı taşır (katalog, DDL motoru, izinler,
kayıtlar, geçmiş); `apps/api` (Hono), `apps/mcp` ve `apps/web` (Next.js) birbirini çağırmayan
bağdaştırıcılardır. Arayüz asla çekirdeğe bağımlı değildir: yalnızca HTTP konuşur, o kadar.

## Karar verilmeden hiçbir şey kaybolmaz

Silmek yok etmez, bir kenara alır: silinmiş bir tablo satırlarını korur; bu satırlar bir
kenara alınmış bir ad altında SQL'de okunabilir ve tablo geri yüklenebilir. Bir fiziksel adı
yeniden adlandırmak, eski adın bir takma adla sunulmaya devam etmesini sağlar. Temizleme,
doğrulanmış bir dışa aktarımla başlayan bir yönetim kararıdır.

## PostgreSQL, başka hiçbir şey

PostgreSQL 16 veya üstü ve zorunlu hiçbir dış bağımlılık yok: ne mesaj kuyruğu, ne önbellek, ne
de arama motoru. Webhook kuyruğu, geçmişin boşaltılması, hız sınırları — hepsi veritabanında ya
da süreçte yer alır.

## Daha fazlası için

| Bölüm | Konu |
|---|---|
| 00 | Yapısal kararlar ve hata kodları kaydı |
| 01 | Adlandırma ve slug dönüşümü |
| 02 | Doğruluk kaynağı olarak `_basedb` kataloğu |
| 03 | DDL motoru ve geçişler |
| 04 | Alan türleri ve PostgreSQL karşılıkları |
| 05 | İzinler |
| 06 | Yaşam döngüsü: yeniden adlandırma, silme, temizleme |
| 07 | Geçmiş |
| 08 | REST API ve webhook'lar |
| 09 | MCP sunucusu |
| 10 | Yazılım mimarisi |
| 11 | Arayüz |
| 12 | Yapay zeka entegrasyonu |
| 13 | Kimlik doğrulama |
| 14 | Ortamlar |
| 15 | Paylaşılan formlar |
