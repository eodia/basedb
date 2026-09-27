---
title: Tablolar ve alanlar
description: basedb'nin alan türleri, bunların PostgreSQL'deki karşılıkları, formüller ve hesaplanan alanlar.
---

basedb'deki her tablo bir PostgreSQL tablosudur; her alan da tipli bir sütun. Girdiğiniz etiket
(“Échéance”), kararlı bir **slug dönüşümüyle** okunabilir bir fiziksel ada (`echeance`)
dönüşür: aksansız, küçük harfli, ayrılmış sözcük içermeyen.

## Türler

| Tür | PostgreSQL sütunu | Notlar |
|---|---|---|
| Kısa metin | `text` | tek satır |
| Uzun metin | `text` | Markdown: ızgarada bir özet, üzerine gelince işlenmiş hâli, ayrı bir düzenleyici; [bir sütuna atıf yapabilir](#zengin-metin-ve-değişkenler) |
| Zengin metin | `text` + `CHECK` | yazılırken temizlenen, görsel bir düzenleyicide yazılan HTML — [aşağıya bakın](#zengin-metin-ve-değişkenler) |
| Sayı | `numeric` | asla kayan nokta değil: bir tutar kaymaz |
| Para birimi, Yüzde, Süre, Derecelendirme | `numeric` | bir sayı ve onun [görüntüleme biçimi](#görüntüleme-biçimleri): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Onay kutusu | `boolean` | |
| Tarih | `date` | |
| Tarih ve saat | `timestamptz` | mutlak bir an, okuyanın saat diliminde gösterilir |
| Tekli seçim | `text` + `CHECK` | seçenek başına renk, simge ya da görsel |
| Çoklu seçim | `text[]` + `CHECK` | dizi operatörleriyle filtrelenebilir |
| E-posta | `text` + `CHECK` | veritabanının doğruladığı, tek tıkla açılan bir adres |
| Telefon, Barkod | `text` | kısa bir metin ve onun biçimi: arama bağlantısı, sabit genişlikli yazı |
| URL | `text` + `CHECK` | giriş sırasında tamamlanır (`exemple.fr` → `https://exemple.fr`) |
| Kişi | `uuid` | çalışma alanının bir üyesi; onu atamak kendisine [haber verir](/basedb/tr/fonctionnalites/collaboration/) |
| Otomatik numara | `bigint` (identity) | zaten var olan satırları da numaralandırır; kimse elle girmez |
| İlişki | `uuid` + `FOREIGN KEY` | hedef tabloya giden gerçek bir yabancı anahtar |
| Çoklu ilişki | `uuid[]` | bütünlüğü bir tetikleyiciyle korunan birden çok bağlı satır |
| Formül | `STORED` üretilmiş sütun | PostgreSQL tarafından hesaplanır — ya da okuma sırasında, bkz. [Formüller](#formüller) |
| Arama, Toplama, Sayım | yok | okuma sırasında, bir ilişki üzerinden hesaplanır |
| Düğme | yok | bir adres açar ya da bir [otomasyon](/basedb/tr/fonctionnalites/automatisations/) başlatır |
| Dosya, Görsel | `jsonb` (üst veriler) | baytlar [dosya depolamasına](/basedb/tr/fonctionnalites/fichiers/) gider |

Her tablo ayrıca **sistem sütunlarını** taşır: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` — bir tetikleyici tarafından tutulur, API ile asla
yazılamaz. Izgara bunları sütun menüsünde **Sistem bilgileri** altında toplar: her tabloda
bulunurlar, ama pek azında işe yararlar.

![Hesaplanan bir süre, bir arama ve bir sayım içeren bir tablonun ızgarası](../../../../assets/screens/grille.png)

## Veritabanının koruduğu kısıtlamalar

Arayüzün vaat ettiğini PostgreSQL garanti eder. Bir tekli seçim bir `CHECK` kısıtlamasıdır; bir
ilişki bir `FOREIGN KEY`; bir URL ya da e-posta adresi bir düzenli ifade. Bunları ihlal eden
doğrudan SQL yazması, arayüzde olduğu gibi reddedilir:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Görüntüleme biçimleri

Para birimi, Yüzde, Süre, Derecelendirme, Telefon ve Barkod birer tür gibi seçilir, ama aslında
**biçimdir**: sütun bir sayı ya da metin olarak kalır, yalnızca okunuşu değişir.

| Biçim | Neyin üzerinde | Nasıl okunur ve girilir |
|---|---|---|
| Para birimi | bir sayı | `12 500,00 €` — avro, dolar, sterlin, İsviçre frangı, Kanada doları, yen |
| Yüzde | bir sayı | `15 %` |
| Süre | saniye cinsinden bir sayı | `1:30`; `1h30`, `90 min` olarak girilir |
| Derecelendirme | bir sayı | 1 ile 10 arası yıldız, tek tıkla ayarlanır |
| Telefon | kısa bir metin | bir arama bağlantısı |
| Barkod | kısa bir metin | sabit genişlikli yazıyla |

Bir biçim, kayıtlı değerlere dokunmadan sonradan değiştirilebilir (alanın düzenleme ekranında
**Görüntüleme**). Biçim değeri sınırlamaz: 5'lik bir ölçekte 7 olan derecelendirme 7 olarak
kalır.

## Formüller

Bir formül Fransızca yazılır; alanlar köşeli parantez içinde, argümanlar `;` ile ayrılır:

```text
ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)
SI([Payée]; FAUX; JOURS(AUJOURDHUI(); [Échéance]) > 0)
JOURS([Fin]; [Début])
```

Düzenleyici eklenecek alanları ve bir işlevler panelini sunar; bir hata, soruna yol açan alanı
ya da karakteri belirtir.

| Aile | İşlevler |
|---|---|
| Mantık | `SI`, `SIVIDE`, `ESTVIDE`, `ET`, `OU`, `NON`, `VRAI`, `FAUX` |
| Sayılar | `ARRONDI`, `ABS`, `PLAFOND`, `PLANCHER`, `MIN`, `MAX` |
| Metin | `MAJUSCULE`, `MINUSCULE`, `SANSESPACES`, `GAUCHE`, `DROITE`, `LONGUEUR`, `TEXTE`, `NOMBRE` |
| Tarihler | `ANNEE`, `MOIS`, `JOUR`, `JOURSEMAINE`, `JOURS`, `AJOUTER_JOURS`, `DATE`, `AUJOURDHUI`, `MAINTENANT` |
| Operatörler | `+ - * /`, metin birleştirmek için `&`, `= <> < <= > >=` |

Bir formül, PostgreSQL'de bir **üretilmiş sütun** olur: `psql` ve araçlarınız onu diğer
sütunlar gibi okur. Güne bağlı olan (`AUJOURDHUI()`, `MAINTENANT()`) ya da bir aramaya veya
toplamaya atıf yapan formül **okuma sırasında hesaplanır**: basedb'de filtrelenir ve sıralanır,
ama doğrudan SQL'de yoktur.

Bir formül ne başka bir formüle ne de doğrudan bir ilişkiye atıf yapar — bunu bir arama yapar.
Bir metnin bir kısmını ayıklamak ya da değiştirmek daha sonra gelecek.

## Aramalar, toplamalar ve sayımlar

Üç alan **bir ilişki üzerinden**, bir yönde ya da diğerinde okur — “projenin müşterisi”, ama
aynı zamanda “Projet alanıyla bağlı görevler”:

- bir **arama**, bağlı satırdan bir değeri ya da değerlerin listesini getirir: bir projenin
  müşterisinin şehri;
- bir **toplama**, bağlı satırlar üzerinde hesaplama yapar: değer sayısı, toplam, ortalama,
  minimum, maksimum — bir müşterinin cirosu, değerlendirmelerinin ortalama puanı;
- bir **sayım**, bağlı satırları sayar: bir projenin görev sayısı.

Her okumada, **okuyan kişinin izinleriyle** hesaplanırlar: bağlı tablo size kapalıysa alan da
kapalıdır. Filtrelenir ve sıralanırlar. Tek bir ilişkiyi izlerler, yazılamazlar, sütunları
yoktur — dolayısıyla doğrudan SQL'de var olmazlar — ve ne içe aktarmada, ne formlarda ne de
geçmişte yer alırlar.

## İlişkiler

Bir **ilişki**, bir satırı aynı veritabanındaki başka bir tablonun bir satırına bağlar. Izgara
hedef satırın **görüntüleme değerini** gösterir — hedef tablo için bu amaçla belirlediğiniz
sütun — ve filtreler ilişkiyi aşar (`clients_id.ville eq "Lyon"`). Bir satıra işaret eden
satırlar, o satırın ayrıntılarında görünür.

**Kayıt başına birden çok satır** kutusunu işaretlediğinizde ilişki **çoklu** hâle gelir: bir
görev birden çok göreve bağlıdır, bir makale birden çok kategoriye aittir. Bağlı satırlar rozet
olarak görünür, bir aramayla seçilir ve satır ayrıntılarından tek tıkla açılır. Bir hedef satırı
silmek onu kendisine atıf yapan listelerden çıkarır — ya da, bunu seçtiyseniz, reddedilir.
`has_any`, `has_all` ve `is_null` filtreleri uygulanır ve bunlar da ilişkiyi aşar
(`taches_ids.titre contains "logo"`). Bir çoklu ilişki sıralanmaz, gruplamada kullanılmaz ve
henüz içe aktarılamaz.

## Düğme

Bir **Düğme** alanının değeri yoktur: eylem yapar. **Bir adres açar** — `https://` ya da
`mailto:`; satıra atıf yapabilir (`mailto:{{E-mail}}`) — ya da aynı tabloda bir düğmeyle
tetiklenen **bir otomasyonu başlatır**. Hücrede, kartta ve satır ayrıntılarında görünür.

## Açıklamalar

Bir veritabanı, bir tablo ve bir alan, geçiş gerektirmeden değiştirilebilen bir **açıklama**
taşır. Açıklama, `psql`'in okuduğu `COMMENT ON` içine, oluşturulan belgelere ve bir ajanın
`describe_table` ile okuduğu bilgilere kopyalanır.

## Zengin metin ve değişkenler

**Zengin metin**, uzun metnin HTML çeşididir ve alan oluşturulurken seçilir (“Zengin metin
(HTML)”): başlıklar, kalın, italik, altı çizili, üstü çizili, listeler, alıntılar, kod,
bağlantılar ve ayırıcılar, görsel bir düzenleyicide. HTML ister arayüzden, ister API'den, MCP
sunucusundan ya da bir içe aktarmadan gelsin **yazılırken temizlenir**; ayrıca bir `CHECK`
kısıtlaması, doğrudan SQL ile yazılan tehlikeli biçimleri de reddeder (`<script>`, `on…`
öznitelikleri, `javascript:`). Görsel, tablo ya da renk yok: veritabanının saklamayacağı şey
sunulmaz.

Bir uzun metin — basit ya da zengin — **kendi satırındaki bir sütuna atıf yapabilir**.
Düzenleyicinin **Sütun** menüsü atfı imlecin bulunduğu yere ekler: zengin metinde bir rozet,
Markdown'da `{{Ville}}`.

> Teslimat `{{Livraison}}` tarihinde `{{Ville}}` şehrine planlanmıştır.

- Sütun atfı yazıldığı gibi, fiziksel adıyla saklar — `{{ville}}`: `psql`'in okuduğu budur.
- Başka her yerde — ızgara, satır ayrıntıları, API, MCP sunucusu, paylaşılan görünümler,
  otomasyonlar — metin **satırın değeriyle** okunur: “Teslimat 02/10/2026 tarihinde Lyon
  şehrine planlanmıştır.” Şehri değiştirmek metni de değiştirir.
- Bir tekli seçim etiketiyle, bir kişi adıyla, bir tarih sizin biçiminizde okunur; zengin
  metne eklenen bir değer asla biçimlendirme kodu (markup) olmaz.
- Okuyanın okuyamadığı bir sütun hiçbir şey vermez: ne değerini ne de adını.

Zengin metin yapay zeka tarafından doldurulamaz: bir model metin yazar, temizlenmiş HTML değil.

## Yapıyı değiştirme

Veritabanının **Yapı** ekranı — kenar çubuğundaki **⋯** menüsünde — tabloları ve alanlarını listeler: ekleme, yeniden adlandırma, zorunlu kılma, yeniden sıralama,
açıklama yazma, görüntülenen alanı belirleme.

![Bir veritabanının Yapı ekranı](../../../../assets/screens/structure.png)

Yapıyı değiştirmek **Yönetim** düzeyini gerektirir. Bu düzey olmadan ekran incelenebilir ama
hiçbir şey sunmaz: ne düğme, ne kalem, ne tutamaç — zorunluluk ve görüntülenen alan belirtilir,
ama değiştirilmeye sunulmaz. Sunucu zaten her değişikliği reddeder; ekran artık kabul ediyormuş
gibi yapmaz.

Bir alanı eklemek, yeniden adlandırmak ya da türünü değiştirmek **geçiş motorundan** geçer:
adımlara bölünmüş bir plan, kısa kilitler ve bir veri dönüştürülemediğinde gerekçesi belirtilen
bir ret.

Bir veritabanını, tabloyu ya da alanı **yeniden adlandırmak** tek bir iletişim kutusunda
yapılır. Etiket her zaman, geçiş gerektirmeden değişir. Bir yönetici altında “Veritabanında da
yeniden adlandır: `clients` → `comptes`” seçeneğini görür: işaretlendiğinde fiziksel ad da
değişir ve etki analizi görüntülenir — eski ada atıf yapan sorgular, SQL görünümleri ve
otomasyonlar. Eski ad, sorgularınızı güncelleyene kadar bir **uyumluluk takma adı** — bir
görünüm — tarafından sunulmaya devam eder.

Silmek hiçbir şeyi hemen yok etmez: tablo ya da veritabanı bir kenara alınır
(`zz_supprime_…`) ve SQL'de okunabilir kalır. Silinmiş bir veritabanı geri yüklenebilir; tek
bir tabloyu arayüzden geri getirmek [yakında gelecek](/basedb/tr/feuille-de-route/). Kalıcı
**temizleme** yalnızca yönetim paneline aittir, otuz gün sonra yapılabilir ve doğrulanmış bir
CSV dışa aktarımıyla başlar.
