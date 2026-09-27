---
title: İlk adımlar
description: Bir veritabanı, bir tablo, alanlar, bir görünüm ve bir form oluşturmak.
---

Bu yolculuk on dakika sürer ve temel konuları kapsar: sonunda bir tablonuz, bir kanban
görünümünüz ve içine yazan herkese açık bir formunuz olacak.

:::tip[Her şeyi bir kerede görmek için]
Boş bir proje **demo veritabanını** önerir: küçük bir ajans; müşterileri, projeleri, görevleri,
faturaları ve değerlendirmeleriyle, formüller, her türden görünüm, bir pano ve otomasyonlarla
birlikte. **Yeni veritabanı** ayrıca veritabanınızı yapay zekaya tarif edebileceğiniz
[şablon galerisini](/basedb/tr/fonctionnalites/modeles/) açar.
:::

## 1. Bir veritabanı oluşturun

Her şey **proje** bazında düzenlenir: kenar çubuğunun üstündeki seçici projeyi değiştirir ya da
yeni bir proje oluşturur. Çubukta, filtrenin sağındaki **+** bir veritabanı oluşturur. Ona bir
etiket verin — “Ventes” — ve isterseniz bir açıklama, bir renk, bir simge.

Veritabanı bir **PostgreSQL şeması** olur: fiziksel adı (`b_t4z56fq_ventes`) formda ve
oluşturulan belgelerde görünür.

## 2. Bir tablo ve alanlarını oluşturun

Veritabanının **⋯** menüsünden: **Yeni tablo**. Ardından alanlarını aynı menüdeki **Yapı**
ekranından, bu ekranın **Alan** düğmesiyle ekleyin:

| Alan | Tür |
|---|---|
| Nom | Kısa metin |
| Statut | Tekli seçim — Nouveau, Qualifié, Gagné, Perdu |
| Montant | Para birimi |
| Échéance | Tarih |
| Client | İlişki → Clients |
| Notes | Uzun metin (Markdown) |

Daha sonra bir formül (`JOURS([Échéance]; AUJOURDHUI())`), bir arama (müşterinin şehri) ya da
bir toplama (müşteri başına toplam tutar) aynı şekilde eklenir — bkz.
[Tablolar ve alanlar](/basedb/tr/fonctionnalites/tables-et-champs/).

Bir CSV veya JSON **dosyasını içe de aktarabilirsiniz**: içe aktarma türleri tahmin eder,
bunları düzeltmenize izin verir, tabloyu oluşturur ya da var olan bir tabloyu tamamlar ve neyi
reddettiğini satır satır bildirir.

![Bir veritabanının menüsü](../../../../assets/screens/menu-base.png)

## 3. Veri girin ve filtreleyin

Izgara bir elektronik tablo gibi düzenlenir: bir hücreyi değiştirmek için çift tıklayın ya da
Enter'a basın, vazgeçmek için Esc'ye basın. **Filtrele** alan bazında koşulları birleştirir;
sıralama sütun başlığından yapılır; çubuğun sağındaki **Ara…** tüm sütunlarda arar. Her
değişiklik anında kaydedilir — ve [geçmişe işlenir](/basedb/tr/fonctionnalites/historique/):
**Ctrl+Z** sonuncusunu geri alır.

## 4. Bir görünüm ekleyin

“Filtrele”nin solundaki görünüm seçici önce “Tüm satırlar”ı, ardından görünümlerinizi sunar.
“Statut”a göre gruplanmış bir **kanban** oluşturun: bir kartı bir sütundan diğerine sürüklemek
satırı değiştirir.

![Duruma göre bir kanban](../../../../assets/screens/kanban.png)

## 5. Bir form paylaşın

Bir **Form** görünümü oluşturun, soruları işaretleyin, ardından **Paylaş**: “Herkese açık”ı
seçin, bağlantıyı kopyalayın. Her yanıt tabloya bir satır ekler; yanıtlayan kişiye hiçbir izin
verilmez. Ayrıntılar [Paylaşılan formlar](/basedb/tr/fonctionnalites/formulaires-partages/)
sayfasında.

## 6. SQL ile okuyun

Veritabanının **⋯** menüsü → **Yeni SQL sorgusu**: tablolarınız gerçek adlarıyla oradadır.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Kaydet** sorguyu tabloların altına, “Sorgular” bölümüne yerleştirir — yalnızca sizin için ya
da tüm veritabanı için — ve **⋯** → **SQL görünümü oluştur…** onu tabloların arasında yer alan
gerçek bir PostgreSQL görünümüne dönüştürür. Herkes bunları kendi izinleriyle okur. Bkz.
[Sorgular ve SQL görünümleri](/basedb/tr/fonctionnalites/requetes-et-vues-sql/).

Aynı şey `psql`'den ya da BI aracınızdan da geçerlidir. Bkz. [Doğrudan SQL](/basedb/tr/integrations/sql/).
