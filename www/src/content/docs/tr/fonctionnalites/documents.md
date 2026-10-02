---
title: PDF belgeleri
description: Kendi renklerinizle fatura, teklif, fiş ya da resmi belge olarak bir satır — logo, bağlı satırlar ve toplamlarla.
---

Bir satır bir **PDF**'e dönüşür: satırlarıyla ve toplamıyla bir fatura, bir teklif, bir irsaliye,
bir ürün fişi, bir resmi belge. Bir satırın ayrıntılarında, **PDF belgesi** düğmesi onu yeni bir
sekmede açar; oradan tarayıcı onu yazdırır ya da kaydeder.

## Hiçbir şey ayarlamadan, fiş

Şablon yokken bir satır **fiş** olarak yazdırılır: başlıkta adı, ardından okuyabildiğiniz tüm
alanlar, kendi dilinizde.

## Şablon oluşturma

Tabloyu kuran kişi — Yönetim düzeyi — şablonları bir satırın ayrıntılarından oluşturur:
**PDF belgesi › Belge şablonları…**. Yeni bir şablon bir **başlangıç noktasından** yola çıkar:

| Başlangıç noktası | Ne oluşturur |
|---|---|
| **Fatura** | logo ve iletişim bilgileriyle üst bilgi, “FATURA”, numara ve tarih; müşteri; faturalanan satırlar ve toplamları; KDV hariç / dahil özet; ödeme koşulları; altbilgide yasal bilgiler |
| **Teklif** | renkli bir bant üzerinde başlık, ızgara düzeninde bilgiler, hizmetler, geçerlilik, “Onay metni” alanı |
| **Föy** | tam genişlikte büyük başlık, görsel alanının fotoğrafı, ızgara düzeninde alanlar, uzun metinler |
| **Belge** | çerçeveli yatay sayfa, ortalanmış metin, imza |
| **Boş sayfa** | bir başlık ve satırın alanları |

**Tablonuzun sütunlarıyla** oluşturulur — numarası, tarihi, tutarları, fotoğrafı, ona bağlı
satırlar — ve tabloda olmayan basitçe bir kenarda bırakılır. Her şey sonradan değiştirilebilir;
sağdaki önizleme, açık satırın PDF'ini gösterir ve her değişiklikte güncellenir.

## İçerik: bloklar

Bloklar yukarıdan aşağıya sıralanır; yeniden sıralamak için tutamaklarından **sürüklenir**,
ayarlamak için açılır.

| Blok | Ne gösterir |
|---|---|
| **Başlık** | büyük bir başlık ve bir alt başlık, sade, renkli, altı çizili, ya da bir bant üzerinde — sayfanın kenarlarına kadar |
| **Metin** | satırın sütunlarına **Sütun** menüsüyle atıf yapan zengin metin — başlıklar, kalın, listeler, bağlantılar: “Fatura `{{numero}}`, `{{date}}` tarihli”; hizalı ya da iki yana yaslı, renkli bir zemin üzerinde, çerçeveli ya da bir vurgu çubuğuyla işaretli |
| **Görsel** | bir logo, bir damga, ya da satırın bir görsel alanının fotoğrafı |
| **Satırın alanları** | seçilen alanlar, ya da hepsi: solda etiket, 2 ya da 3'lü bir ızgarada üstte etiket, ya da **özet** — sağda değerler, sonuncusu (ödenecek toplam tutar) kalın; boş alanlar gizlenebilir |
| **Bağlı satırlar tablosu** | buna işaret eden satırlar — bir faturanın satırları — ya da bir çoklu bağlantının işaret ettikleri, **toplamlarıyla**; renkli üst bilgi, iki satırdan biri renkli, sütun üst bilgileri, genişlikleri ve hizalamaları sizin elinizde (“Miktar” için “Mik.”) |
| **Sütunlar** | yan yana iki ya da üç sütun, her biri kendi bloklarıyla: bir yanda “Fatura edilen”, diğer yanda referanslar |
| **Ayırıcı**, **Boşluk** | bir çizgi — bir imza için kısa — ya da bir boşluk |
| **Sayfa sonu** | devamı yeni bir sayfada |

## Stil ve sayfa

- **Vurgu rengi** — markanızın rengi: başlıklar, bantlar, tablo üst bilgileri, bağlantılar.
  Üzerine gelen metin, en iyi okunana göre beyaz ya da koyudur.
- **Metin rengi**, metnin ve başlıkların **yazı tipi** (tırnaksız ya da tırnaklı), metnin
  **boyutu**, ara başlıkların stili.
- **Biçim** (A4 ya da Letter), **yönlendirme**, **kenar boşlukları**, sayfanın etrafında basit
  ya da çift **çerçeve**, içerik **dikey ortalanmış** — bir resmi belge için.
- **Değerlerin dili**: tutarlar kendi para birimiyle (“1.234,50 €”), tarihler yazıyla (“30 Eylül
  2026”), evet ve hayır, bir seçimin etiketi, bir kişinin adı yazılır. Metin, basedb'nin yirmi
  dilini — ideogramlar dahil — kapsayan gömülü yazı tipleriyle dizilir.

## Üst bilgi ve altbilgi

**Üst bilgi**, **logonuzu** taşır — gönderilen bir görsel (PNG, JPEG ya da SVG; çok büyük bir
görsel küçültülür) ya da satırın görsel alanı —, solda bir metin (iletişim bilgileriniz) ve
sağda bir metin (belgenin ne olduğu, numarası, tarihi), ilk sayfada ya da her sayfada.
**Altbilgi**, yasal bilgilerinizi ve sayfa numaralarını taşır. İkisi de, bir metin gibi, satırın
sütunlarına atıf yapar.

## Herkes kendi izniyle

Bir belge, **onu yazdıran kişinin izinleriyle** okunur: ona göre gizli bir alan orada yer
almaz — ne bir metinde, ne bir görselde —, onun göremediği bağlı bir satır tabloda değildir —
ne de toplamda. İki kişi, aynı satırdan iki farklı belge elde edebilir: her biri kendininkini.

## API ile

```bash
# Bir şablonla, ya da “fiş” olarak bir satırın PDF'i
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` tablonun şablonlarını listeler.

## Sınırlar

- Gönderilen bir görsel en fazla 300 KB olabilir, model başına sekiz tane; bir alanın görseli,
  PNG ya da JPEG ise kullanılır.
- Bağlı bir satırın değeri, tablonun dışında, belge tablosu üzerinde bir **Arama** ile anılır;
  KDV dahil bir toplam, tablonun bir alanıdır.
- Satır başına bir belge: henüz birden çok satırın PDF'i yok. Bir
  [otomasyon](/basedb/tr/fonctionnalites/automatisations/#pdf-ve-e-posta) bunu sizin için
  yapabilir — **PDF oluştur** — ve ek olarak gönderebilir.
