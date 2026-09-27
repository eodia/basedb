---
title: Veritabanı şablonları
description: Bir şablondan başlamak, onu yapay zekadan istemek, kendi şablonunuzu JSON ile yazmak — ve onu tüm kurulumlar için yayımlamak.
---

Bir **şablon**, tek tıkla eksiksiz bir veritabanı oluşturur: tabloları ve ilişkileri, örnek
satırlar, görünümler, bir pano, otomasyonlar ve yapay zekanın kendisinin doldurduğu alanlar.
[Şablon galerisi](/basedb/tr/modeles/) basedb'nin sunduğu şablonları gösterir.

## Bir şablondan başlama

**Yeni veritabanı**, ardından **Bir şablondan başla ya da yapay zekadan iste**: galeri açılır.

![Uygulamadaki şablon galerisi](../../../../assets/screens/modeles.png)

Her şablon, kullanılmadan önce baştan sona okunabilir — tabloları ve alanları, görünümleri,
otomasyonları ve her yapay zeka alanının talimatı. **Veritabanını oluştur** bir etiket ister ve,
yapay zeka alanları varsa, bu alanların atıf yaptığı değerlerin kurulumun yapay zeka
sağlayıcısına gönderilmesi için onayınızı ister. Bu onay olmadan bunlar, örnek değerleriyle
doldurulmuş sıradan alanlardır.

Varsayılan olarak işaretli olan **Örnek verileri yükle**, veritabanını iş başında görmek için
tabloları örnek satırlarla doldurur. İşaret kaldırıldığında tablolar boş kalır, kendi
verilerinize hazır — görünümler, panolar ve otomasyonlar yine de oluşturulur.

Boş bir proje ayrıca **demo veritabanını** önerir: küçük bir ajans; müşterileri, projeleri,
görevleri, faturaları ve değerlendirmeleriyle basedb'nin tüm yönlerini gösterir.

## Kendi dilinizde

Resmî şablonlar **ekranın dilinde** okunur ve oluşturulur: tablolar, alanlar, seçenekler,
örnek satırlar, görünümler, panolar, otomasyonlar ve yapay zekanın talimatları. Örnek satırlar
dille birlikte dünya değiştirir: Fransızca'daki Lyon fırını “Boulangerie Martin”, Türkçe'de
Bursa'daki “Kaya Fırını” olur.

Kurulumunuza içe aktarılan ya da bir veritabanından kaydedilen bir şablon, birinin yazdığı bir
şablondır: yazıldığı hâliyle okunur.

## Yapay zekadan isteme

Galerinin başında ihtiyacınızı tek bir cümleyle tarif edin — “müşterilerimin şikâyetlerinin
takibi, bir ton analiziyle birlikte”. Yapay zeka eksiksiz bir veritabanı önerir: tablolar,
inandırıcı örnek satırlar, görünümler, pano ve kullanım uygun düştüğünde yapay zeka alanları.
Onu bir şablon gibi okursunuz, **iyileştirebilir** (“bir tedarikçiler tablosu ekle”), ardından
oluşturabilirsiniz. Yapay zeka yalnızca cümlenizi alır — hiçbir veritabanından hiçbir veri
almaz — ve siz tıklamadan önce hiçbir şey oluşturulmaz.

## JSON ile şablon yazma

Bir şablon bir JSON belgesidir. İşte iskeleti:

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Une phrase pour la galerie.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tables": [
    {
      "key": "tickets",
      "label": "Tickets",
      "fields": [
        { "label": "Titre", "kind": "short_text" },
        { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", "Résolu"] },
        { "label": "Ouvert le", "kind": "date" },
        { "label": "Description", "kind": "long_text" },
        { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande"],
          "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } },
        { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" }
      ]
    },
    { "key": "produits", "label": "Produits", "fields": [{ "label": "Nom", "kind": "short_text" }] }
  ],
  "links": [{ "from": "tickets", "label": "Produit", "to": "produits" }],
  "rows": {
    "produits": [{ "$key": "app", "Nom": "Application mobile" }],
    "tickets": [{ "Titre": "Crash au démarrage", "Statut": "En cours", "Ouvert le": "-3d", "Produit": "@app" }]
  },
  "views": [
    { "table": "tickets", "label": "Tableau", "kind": "kanban", "spec": { "group_by": "Statut" } }
  ],
  "dashboards": [
    { "label": "Vue d’ensemble", "blocks": [
      { "kind": "number", "title": "Ouverts", "table": "tickets", "filter": "[Statut] ne \"Résolu\"" },
      { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" }
    ] }
  ],
  "automations": []
}
```

Temel kurallar:

- **Her şeye etiketiyle atıf yapılır**: bir görünümdeki bir alan, bir filtre
  (`[Statut] ne "Résolu"`), bir formül (`[Prix] * [Quantité]`), bir yapay zeka talimatı ya da
  bir mesaj (`{{Titre}}`). Bir seçenek etiketiyle verilir.
- Bir tablonun **ilk alanı** onun görüntülenen alanıdır: bir metin, bir sayı, bir tarih, bir
  e-posta ya da bir adres.
- Bir **ilişki** asla bir alan olarak değil, `links` içinde bildirilir; bir satır ona `"@clé"`
  ile, yani hedef tablodaki bir satırın `$key` değeriyle başvurur.
- Bir **tarih**, şablonun uygulandığı güne göre göreli olabilir: `"today"`, `"+3d"`, `"-2w"`,
  `"+1m"`; bir tarih-saat, saati de ekler: `"+1d 14:30"`. Bir kişi `"$moi"` olarak yazılır.
- Bir **yapay zeka alanı** `"ai": { "prompt": "…" }` taşır ve yalnızca yapay zeka
  kullanılmadığında yazılan bir örnek değer alabilir.
- Bir şablon **asla** paylaşım, izin, webhook, dosya ya da `"$moi"` dışında bir kişi içermez:
  bazen başka bir yerden gelir ve hiçbir şeye kapı açmamalıdır.

Tam başvuru — tüm alan türleri, tüm görünüm anahtarları, sınırlar — depodaki mimari
belgelerinin 20. bölümündedir.

## Bir şablonu tüm kurulumlar için yayımlama

Resmî galerinin şablonları, deponun
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
klasöründeki dosyalardır; şablon başına bir dosya, `key` değerine göre adlandırılmış. Herkese
açık site bunlardan [galeriyi](/basedb/tr/modeles/) oluşturur ve kataloğun tamamını
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json) adresinde yayımlar. Her
kurulum, biri galeriyi açtığında bu kataloğu okur ve bir saat saklar: bir dosyayı değiştirip
siteyi yeniden yayımlamak, tüm kurulumların galerisini değiştirmeye yeter.

Her şablon, site derlenirken sunucuyla aynı doğrulayıcı tarafından denetlenir: geçersiz bir
şablon, kullanıcılara ulaşmak yerine derlemeyi başarısız kılar.

Resmî bir şablon bir kez, Fransızca yazılır. Başka bir dildeki metinleri bir sözlüktür,
[`packages/templates/i18n/<langue>/<clé>.json`](https://github.com/eodia/basedb/tree/main/packages/templates/i18n)
— önce Fransızca metin, sonra çevirisi —, sitenin katalogun yanında yayımladığı
(`/basedb/modeles/i18n/<langue>.json`). Kurulum her metni oradan geçirir ve her etiketi
anıldığı her yerde izler — formüller, filtreler, görünümler, talimatlar —, ardından sonucu
yeniden okur: şablonu bozacak bir sözlük sunulmaz, Fransızca şablon sunulur. Sözlükte bulunmayan
bir metin Fransızca kalır.

Kurulum `BASEDB_TEMPLATES_URL` adresini okur — varsayılan olarak herkese açık sitenin adresi.
Onu kendi kataloğunuza yönlendirin ya da hiçbir katalog okumamak için `off` yapın: bu durumda
kurulum, kendi sürümüne gömülü şablonları sunar.

## Kurulumunuzun şablonları

Bir yönetici, galeriden (“JSON içe aktar”) kendi kurulumuna **bir JSON şablonu içe
aktarabilir**: şablon tüm kullanıcılarının galerisine katılır ve aynı anahtara sahip bir
şablonun yerini alır. Yapay zekanın bir önerisi de tek tıkla oraya eklenebilir.

Her veritabanı da bir şablona dönüşebilir: veritabanının menüsünde, **Diğer eylemler** altında **Şablon olarak kaydet**. Tabloları, alanları, yapay zeka talimatları, ilişkileri, paylaşılan
görünümleri, panoları ve otomasyonları — ve isterseniz tablo başına 50 satıra kadar — JSON
olarak indirilir; resmî kataloğa ya da kurulumun kataloğuna katılmaya hazırdır. Bir satır
arayan, dallara ayrılan ya da önceki bir adıma atıf yapan bir otomasyon şimdilik dışarıda kalır
ve ekran bunu belirtir.
