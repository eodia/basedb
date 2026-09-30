---
title: PDF belgeleri
description: Bağlı satırları ve toplamlarıyla, fatura, teklif ya da yazdırılabilir bir fiş olarak bir satır.
---

Bir satır bir **PDF**'e dönüşür: satırlarıyla ve toplamıyla bir fatura, bir teklif, bir irsaliye,
bir fiş. Bir satırın ayrıntılarında, **PDF belgesi** düğmesi onu yeni bir sekmede açar; oradan
tarayıcı onu yazdırır ya da kaydeder.

## Hiçbir şey ayarlamadan, fiş

Şablon yokken bir satır **fiş** olarak yazdırılır: başlıkta adı, ardından okuyabildiğiniz tüm
alanlar, kendi dilinizde.

## Şablonlar

Tabloyu kuran kişi — Yönetim düzeyi — bunları bir satırın ayrıntılarından yazar:
**PDF belgesi › Belge şablonları…**. Bir şablon; bir sayfa (A4 ya da Letter, dikey ya da yatay),
değerler için bir dil, bir alt bilgi ve bir blok dizisidir:

| Blok | Ne gösterir |
|---|---|
| **Metin** | zengin metin — başlıklar, kalın, listeler, bağlantılar — **Sütun** menüsüyle satırın sütunlarına atıf yapar: “Fatura `{{numero}}`, `{{date}}` tarihli” |
| **Satırın alanları** | seçilen alanlar, ya da hepsi: solda etiket, sağda değer |
| **Bağlı satırlar tablosu** | buna işaret eden satırlar — bir faturanın satırları — ya da bir çoklu bağlantının işaret ettikleri, seçilen sütunlar ve **toplamlarıyla** |
| **Sayfa sonu** | devamı yeni bir sayfada |

Düzenleyici yanında, şablonun açık satırdan yaptığı PDF'i gösterir, değişiklikler dahil.

Değerler **şablonun dilinde** yazılır: para birimiyle bir tutar (“1.234,50 €”), yazıyla bir
tarih (“30 Eylül 2026”), evet ve hayır, bir seçimin etiketi, bir kişinin adı. Metin, basedb'nin
yirmi dilini — ideogramlar dahil — kapsayan gömülü yazı tipleriyle dizilir.

## Herkes kendi izniyle

Bir belge, **onu yazdıran kişinin izinleriyle** okunur: ona göre gizli bir alan orada yer almaz,
onun göremediği bağlı bir satır tabloda değildir — ne de toplamda. İki kişi, aynı satırdan iki
farklı belge elde edebilir: her biri kendininkini.

## API ile

```bash
# Bir şablonla, ya da “fiş” olarak bir satırın PDF'i
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` tablonun şablonlarını listeler.

## Sınırlar

- Belgede görsel (logo) ya da seçilmiş bir renk yok, alt bilgiden ayrı bir üst bilgi yok.
- Satır başına bir belge: henüz birden çok satırın PDF'i yok, bir otomasyonla üretim de yok.
