---
title: Paylaşılan görünümler
description: Bir görünümü bir bağlantıyla salt okunur olarak göstermek, bir siteye yerleştirmek, bir takvime abone olmak.
---

Bir veri görünümü — ızgara, kanban, takvim, zaman çizelgesi, galeri, liste — **salt okunur
olarak paylaşılır**: bir `/v/<jeton>` bağlantısı onu basedb'yi açamayan birine, hiçbir şey
yazmasına izin vermeden gösterir. Bu, hiçbir şey okutmadan yanıt vermeye izin veren
[paylaşılan formların](/basedb/tr/fonctionnalites/formulaires-partages/) karşılığıdır. Bir
[pano](/basedb/tr/fonctionnalites/tableaux-de-bord/#bir-panoyu-paylaşma) da aynı şekilde
paylaşılır.

## Paylaşma

Görünümün menüsü → **Paylaş…**, ardından:

| Erişim | Kim okur |
|---|---|
| **Herkese açık** | bağlantıya sahip herkes, hesap gerekmeden |
| **Oturum açmış üyeler** | çalışma alanının bir üyesi, oturum açtıktan sonra — gerekirse yalnızca belirli gruplardan |

![Bir takvimin paylaşımı](../../../../assets/screens/partage-vue.png)

**Bağlantı etkin** anahtarı bağlantıyı kaybetmeden askıya alır. Sayfa uygulamanın dışında
açılır: ne kenar çubuğu, ne veritabanı adı, ne tablo adı — görünüm, filtreleri, sütunları ve
başka hiçbir şey. Bir takvim ya da zaman çizelgesi orada bir ajanda gibi okunur.

![Aynı takvim, bağlantısıyla açılmış hâli](../../../../assets/screens/vue-partagee.png)

## Kimin adına okunur

Görünüm, **onu yayımlayan kişinin izinleriyle** okunur ve bu izinler her okumada yeniden
değerlendirilir: o kişiden gizlenen bir alan görüntülenmez ve kişi tabloya erişimini
kaybederse bağlantı hiçbir şey göstermez olur.

## Başka bir siteye yerleştirme

**Başka bir siteye yerleştirmeye izin ver** kutusunu işaretleyin: iletişim kutusu bir
intranete, bir wiki'ye ya da bir tanıtım sitesine yapıştırılacak bir `<iframe>` **yerleştirme
kodu** verir. Bu kutu işaretli değilse sayfa, başka bir sitenin çerçevesi içinde
görüntülenmeyi reddeder.

## Ajandanızda bir takvim

**Herkese açık** olarak paylaşılan bir takvim ya da zaman çizelgesi için iletişim kutusu
**ajanda akışı adresini** verir: Google Takvim, Outlook ya da Apple Takvim'in abone olabileceği
bir iCalendar akışı (`…/calendar.ics`, en fazla 1.000 etkinlik). Ekibin son tarihleri herkesin
ajandasında görünür ve tabloyu izler.

## Diğer veritabanları için bir kaynak

Herkese açık bir bağlantı ayrıca **görünümün API adresini** de verir: görünümün gösterdiği
satırlar, JSON olarak. Bir [senkronize tablo](/basedb/tr/integrations/synchronisation/) — bu
kurulumda ya da başka bir kurulumda — onu kaynak olarak kullanabilir.

## Sınırlar

- Okuma, IP adresi ve bağlantı başına dakikada 120 istekle sınırlıdır.
- Bir form okumak için paylaşılmaz: [yanıt almak için](/basedb/tr/fonctionnalites/formulaires-partages/) paylaşılır.
