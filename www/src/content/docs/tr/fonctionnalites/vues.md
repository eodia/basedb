---
title: Görünümler
description: Izgara, kanban, takvim, zaman çizelgesi, galeri, liste, form ve anket — ortak ya da kişisel.
---

Bir tablo **sekiz farklı şekilde** gösterilir. Bir görünüm hiçbir veriyi kopyalamaz ve tablonun
kendisinin verdiğinden fazla bir izin vermez.

:::note
Bu görünümler **tek bir** tabloyu göstermenin yollarıdır. Bir [SQL görünümü](/basedb/tr/fonctionnalites/requetes-et-vues-sql/)
başka bir şeydir: veritabanının tabloları üzerine SQL ile yazılmış, kenar çubuğunda onların
arasında yer alan gerçek bir PostgreSQL görünümü.
:::

| Görünüm | Ne gösterir | Neye ihtiyaç duyar |
|---|---|---|
| **Izgara** | filtrelenmiş, sıralanmış, gruplanmış satırlar, seçilmiş sütunlar | — |
| **Kanban** | sütunlar hâlinde kartlar | bir tekli seçim |
| **Takvim** | tarihlerine yerleştirilmiş satırlar, aylık ya da haftalık | bir tarih alanı |
| **Zaman çizelgesi** | iki tarih arasındaki çubuklar ve bağımlılıkları | bir başlangıç tarihi |
| **Galeri** | kapak görselli kartlar | — |
| **Liste** | kayıt başına bir satır, daraltılabilir gruplar hâlinde | — |
| **Form** | bir satır oluşturmak için bir soru sayfası | — |
| **Anket** | aynı sorular, ekran başına bir soru | — |

## Görünüm seçici

“Filtrele”nin solundadır. “Tüm satırlar”, tablonun kimsenin kaydetmediği ve kimsenin
silemeyeceği ızgarasıdır; ardından veritabanını kuran kişinin seçtiği sırayla **ortak
görünümler**, sonra da **Görünümlerim** gelir.

- Bir **ortak görünümü** herkes görür. Onu oluşturmak, yapılandırmak, yeniden adlandırmak,
  yeniden sıralamak ya da silmek **Yönetim** düzeyini gerektirir. Görünüm **kilitlenebilir**:
  bir asma kilit bunu belirtir ve kilidi açılmadıkça kimse onu değiştiremez.
- Bir **kişisel görünümü** yalnızca siz görürsünüz ve yalnızca tabloyu okuyabilmeyi gerektirir.
  **Kişisel görünüm oluştur** ya da filtreleyip sıraladıktan sonra **Görünüm olarak kaydet**:
  herkes kendi okuma biçimlerini, başkaları için hiçbir şeyi değiştirmeden saklar. Bir ortak
  görünümde **Çoğalt**, görünümün kişisel bir kopyasını oluşturur.

![Müşterilerden oluşan bir galeri](../../../../assets/screens/galerie.png)

## Araç çubuğu

Izgaranın üstünde, bu sırayla:

- **Filtrele** alan bazında koşulları birleştirir;
- **Sütunlar** neyin görüntüleneceğini seçer — sistem sütunları ayrıdır, “Sistem bilgileri”
  altındadır;
- **Grupla** satırları tek değerli bir alana — tekli seçim, ilişki, kişi, tarih, sayı, metin,
  onay kutusu… — göre daraltılabilir gruplara ayırır; her grubun, filtrenin tamamı üzerinden
  hesaplanan bir sayımı vardır;
- **Renkler** satırları bir tekli seçime ya da **kurallara** göre renklendirir — bir filtre ve
  bir renk, en fazla yirmi kural — kenar çizgisi, arka plan ya da ikisi birden;
- **Satır yüksekliği**: kısa, orta, yüksek, çok yüksek;
- sağdaki **Ara…**, siz yazarken tüm sütunlarda arar; Esc aramayı temizler. Kanban, takvim,
  zaman çizelgesi, galeri ve liste için de geçerlidir ve görünüme asla kaydedilmez.

Her sütunun altında, yalnızca sayfa üzerinden değil, filtredeki tüm satırlar üzerinden
hesaplanan bir **Özet** bulunur: dolu, boş, benzersiz değerler, toplam, ortalama, minimum,
maksimum, işaretli kutular.

## Kanban, takvim, zaman çizelgesi

- **Kanban** kartları bir tekli seçime göre düzenler; bir kartı sürüklemek satırı değiştirir,
  sütun başındaki “+” bu seçime sahip yeni bir satır oluşturur. Her kart bir başlık, bir kapak
  görseli, seçilen alanlar ve satırın değerlerine atıf yapan bir **açıklama** gösterir —
  “Teslimat `{{Date}}` tarihinde `{{Client}}` için planlandı” —; bu açıklama, görünümün
  ayarlarında **Alan yerleştir** düğmesiyle yazılır.
- **Takvim** her satırı, isteğe bağlı bir bitiş tarihiyle birlikte kendi tarihine yerleştirir;
  bir satırı bir günden diğerine sürüklemek onu kaydırır.
- **Zaman çizelgesi**, bir tekli seçime ya da bir ilişkiye göre gruplanmış, bir başlangıç ve
  bir bitiş tarihi arasında çubuklar çizer. **Bağlı olduğu** ayarıyla — tablonun kendisine giden
  bir ilişki — bir ok her görevi bağlı olduğu görevlere bağlar; zamanda geriye giden ok kırmızı
  olur.

![Bağımlılıklarıyla bir zaman çizelgesi](../../../../assets/screens/chronologie.png)

![Son tarihe göre bir takvim](../../../../assets/screens/calendrier.png)

## Galeri ve liste

- **Galeri** kartları gösterir: bir **kapak görseli** (kırpılmış ya da tam), bir boyut (küçük,
  orta, büyük kartlar), bir tekli seçime göre bir renk.
- **Liste**, bir tekli seçime, bir ilişkiye ya da bir kişiye göre **gruplanmış** olarak kayıt
  başına bir satır gösterir.

![Sektöre göre gruplanmış bir müşteri listesi](../../../../assets/screens/liste.png)

Kanban, galeri ve listede kartlar ve satırlar sürüklenerek **elle sıralanır** — 5.000'e kadar;
seçilen bir sıralama bu düzenin önüne geçer.

## Form ve anket

Soruları işaretler ve sıralarsınız; her sorunun bir başlığı, bir yardım metni vardır ve soru
zorunlu yapılabilir. Formun bir başlığı, bir tanıtım metni, bir düğme etiketi ve bir teşekkür
mesajı vardır. Form basedb içinde doldurulur ya da
[bir bağlantıyla paylaşılır](/basedb/tr/fonctionnalites/formulaires-partages/).

## Bir görünümü paylaşma

Bir veri görünümü — ızgara, kanban, takvim, zaman çizelgesi, galeri, liste — bir bağlantıyla
**salt okunur olarak paylaşılır**, başka bir siteye yerleştirilir ve bir takvim, bir ajanda
akışına dönüşür. Bkz. [Paylaşılan görünümler](/basedb/tr/fonctionnalites/vues-partagees/).

## Okuyanın görmedikleri

Bir görünüm **okuyucusu için yeniden yansıtılır**: ondan gizlenen bir alan sütunlardan,
kartlardan ve sorulardan kaybolur. Filtresi gizli bir alana atıf yapan bir görünüm hiç
gösterilmez: filtresi olmadan gösterilseydi, gösterilmek için yapıldığından fazlasını
gösterirdi.
