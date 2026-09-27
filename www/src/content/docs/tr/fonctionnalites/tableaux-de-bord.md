---
title: Panolar
description: Fareyle ya da SQL ile sorulan sorular, bunları göstermenin ve ayarlamanın on beş yolu, ızgara düzeninde, sekmeli, ortak filtreler altında panolar — herkesin kendi izinleriyle okunan ve bir bağlantıyla paylaşılan.
---

Bir **pano**, bir ekibin her gün baktığı şeyleri tek bir sayfada toplar: önemli rakamlar,
bunların aydan aya değişimi, bir durumun dağılımı, yaklaşan son tarihler. Oradaki her kart bir
**soru** gösterir — veritabanının fareyle oluşturulmuş ya da SQL ile yazılmış bir okuması — ve
sayfanın üstündeki **filtreler** kendilerine bağlanan kartları yönetir.

![“Pilotage de l’agence” panosu: ayın eğilimi, hedef, yığılmış ciro, değerlendirmelerin duygu durumu](../../../../assets/screens/tableaux-de-bord.png)

Her şey, kenar çubuğunun altındaki açık veritabanı bloğunda yer alan **Panolar** bağlantısından
açılır. Solda veritabanının panoları ve kayıtlı soruları ile hiçbir şey kaydetmeden soru sormak
için **Verileri keşfet** bulunur. Veritabanının her okuyucusu bunlara bakabilir ve
keşfedebilir; oluşturmak, değiştirmek ve kaydetmek **Yönetim** düzeyini gerektirir.

## Fareyle soru sorma

Bir soru, alt alta adımlarla oluşturulur:

![Bir sorunun düzenleyicisi: veriler, filtreler, aylık özet](../../../../assets/screens/question-editeur.png)

| Adım | Orada ne seçilir |
|---|---|
| **Veriler** | başlangıç tablosu ve hiçbir şey özetlenmediğinde gösterilen sütunlar |
| **Verileri birleştir** | veritabanının başka bir tablosu; bir ilişkiyle — kendiliğinden önerilir — ya da aynı nitelikte iki sütunla bağlanır; sol, iç, sağ ya da tam birleştirme |
| **Filtre** | sütun bazında, türünün sunduğu seçeneklerle: eşittir / eşit değildir, içerir, arasında, boş…; bir tarih için bir **dönem**: bugün, son 30 gün, bu ay, geçen çeyrek, … ile … arası; ya da görünümlerin çubuğundaki gibi yazılmış bir ifade |
| **Özetle** | ölçüler — satır sayısı, toplam, ortalama, medyan, minimum, maksimum, benzersiz değerler, standart sapma, kümülatif toplamlar — bir ila üç sütuna **göre** |
| **Sırala**, **Sınırla** | satırların sırası ve en fazla kaç satır |

Bir tarih **gün, hafta, ay, çeyrek ya da yıla göre** ya da sıraya göre gruplanır — haftanın
günü, yılın ayı, günün saati; bir sayı ise aralıklara göre. Bir çoklu seçim, her satırı
seçeneklerinin her birinde sayar. Dönemler sizin saat diliminizde okunur ve hafta,
ayarlarınızda belirlediğiniz günde başlar.

**Görselleştir** soruyu çalıştırır. Sonuç kendisine uygun biçimde gösterilir — bir sayı, bir
çizgi, çubuklar, bir tablo — ve ekranın altından değiştirilebilir:

| Görselleştirme | Ne göstermek için |
|---|---|
| **Sayı**, **Eğilim**, **İlerleme**, **Gösterge** | bir değer; son dönemi bir öncekiyle ve geçen yılın aynı dönemiyle karşılaştırma; bir hedefe doğru ilerleme |
| **Sütun grafiği**, **Çubuk grafiği**, **Çizgi grafiği**, **Alan grafiği**, **Birleşik grafik** | bir boyut boyunca ölçüler; yan yana, yığılmış ya da %100 seriler hâlinde |
| **Pasta grafiği**, **Huni** | paylar, aşamalar |
| **Dağılım grafiği** | birbirine karşı iki ölçü, boyut olarak bir üçüncüsü |
| **Tablo**, **Pivot tablo** | sıralanabilir satırlar; bir boyuta göre satırlar, bir başkasına göre sütunlar, toplamlarıyla |
| **Harita** | Fransa'nın bölgeleri ya da departmanları veya ülkeler, bir değere göre renklendirilmiş; ya da enlem ve boylama göre noktalar |

**Ayarlar** neyin gösterileceğini belirler ve sonuç **CSV** olarak indirilebilir.

### Bir grafiği özelleştirme

| Görselleştirme | **Ayarlar**'ın sundukları |
|---|---|
| **Çubuk, çizgi, alan, birleşik** | her serinin rengi ve adı; yığınların üstünde toplamla birlikte yığma; çubuk genişliği; noktalı ya da noktasız, yumuşatılmış ya da basamaklı çizgiler; kategorilerin sırası; eksen başlıkları, ölçek işaretleri, etiketlerin eğimi, sınırlar, logaritmik ölçek; grafik üzerinde değerler; bir hedef |
| **Pasta** | bir halka ve kalınlığı, yarım daire, gül grafiği; ortada toplam; “Diğer”den önceki dilim sayısı; her dilimin rengi ve adı; dilimlerin üzerinde ya da yanında etiketler; lejantın yeri |
| **Huni** | her aşamanın rengi ve adı, aşamaların sırası |
| **Sayı, eğilim, ilerleme, gösterge** | renk, değere göre renkler, sayının altında bir açıklama, karşılaştırma — ve bir düşüşün iyi haber olup olmadığı |
| **Tablo, pivot tablo** | sütunları yeniden adlandırma ve sıralama, hücrelerde çubuklar, değere göre renkler — hücre ya da satır başına —, yoğunluk, sayfa başına satır, satır numaraları, toplamlar |
| **Harita** | renk tonu, bölge adları |

Hepsi için sayı biçimi: ondalıklar, önek ve sonek, `1,2 k` şeklinde kısaltma.

## Tek tıkla keşfetme

Bir çubuğa, bir noktaya ya da bir dilime tıklamak, onun temsil ettiği şeyi açar:

- **Bu satırları gör**: noktanın arkasındaki satırlar, temsil ettiği şeye göre filtrelenmiş;
- **Haftaya göre ayrıntılandır**: bir dönem daha ince bir dönemle açılır — bir yıl çeyreklerine,
  bir ay haftalarına;
- **Şuna göre dağıt…**: bu nokta için aynı ölçü, başka bir sütuna göre;
- **Yalnızca bu değer**, **Bu değeri hariç tut**.

Her adım ayrı bir sorudur ve istenirse kaydedilir; geri oku bir önceki adıma döner. Bir
tablonun satırı, o satırın ayrıntılarını açar.

Bir panoda aynı tıklama ayrıca, ilgili kart sayısıyla birlikte **Panoyu filtrele: “Lyon”**
seçeneğini sunar: asla kaydedilmeyen, filtre çubuğunda kesikli çizgiyle gösterilen ve tek
tıkla kaldırılabilen **geçici** bir filtre; sorusu aynı sütunu — kendi tablosu ya da bir
birleştirme yoluyla — okuyan her karta uygulanır. Yalnızca panonun hiçbir filtresi kart
üzerinde bu sütuna zaten bağlı değilse sunulur ve başka hiçbir kart bu sütunu okumadığında gri
kalır (“tek kart”). SQL soruları bu filtreyi dikkate almaz.

## SQL ile soru yazma

Bir **SQL sorusu**, veritabanının tabloları üzerinde, bu tabloların gerçek adlarıyla yazılan
bir `SELECT`'tir. **Salt okunur olarak, kendi izinlerinizle** çalışır — Yönetim düzeyindekiler
dahil herkes için: size kapalı bir tablo yok sayılır, gizli bir alan reddedilir ve yazma
imkânsızdır. Bir sorguyu grafik olmadan yalnızca tabloların altına kaydetmek ya da gerçek bir
PostgreSQL görünümüne dönüştürmek için bkz.
[Sorgular ve SQL görünümleri](/basedb/tr/fonctionnalites/requetes-et-vues-sql/).

Bir **değişken** `{{nom}}` şeklinde yazılır; değeri olmadığında çıkarılacak bir kısım `[[` ile
`]]` arasına yazılır:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

Bir değişken bir metin, bir sayı, bir tarih — ya da bir **sütun filtresi** olabilir: bu
durumda `{{periode}}`, seçilen sütun (burada `echeance`) üzerinde eksiksiz bir koşula ya da
hiçbir şey seçilmediğinde `TRUE` değerine dönüşür. Panonun bir filtresinin bir SQL sorusunu
diğerleri gibi yönetmesini sağlayan budur.

## Bir panoyu düzenleme

**Düzenle** panoyu düzenleme moduna geçirir:

- **Soru** kayıtlı bir soru yerleştirir ya da karta özel bir soru oluşturur;
- **Başlık** ve **Metin** bir bölüm başlığı ya da Markdown ile yazılmış bir metin ekler;
- **Gömülü sayfa**, hiçbir oturum ya da veri almayan yalıtılmış bir çerçevede bir `https://`
  adresi gösterir;
- **Sekme** kartları birkaç sayfaya dağıtır; çift tıklama bir sekmeyi yeniden adlandırır.

Kartlar, 24 sütunluk bir ızgara üzerinde tutamaçlarından taşınır ve köşelerinden yeniden
boyutlandırılır. **Kaydet** hepsini saklar; **İptal** önceki sürüme döner. Okuma modunda bir
kart başlığı, kartın sorusunu panonun filtreleri dahil keşfetmek üzere açar.

## Filtreler

**Filtre** panonun üstüne bir denetim ekler: bir **tarih** (bir dönem), bir **kategori**
(işaretlenecek değerler), bir **metin**, bir **sayı** ya da çizgileri aydan haftaya veya yıla
geçiren bir **tarih gruplaması**.

Bir filtre kendisine bağlanan kartları yönetir — bir, birkaç ya da tümü. Oluşturulduğunda
kendisine uygun sütunlara kendiliğinden bağlanır; seçildiğinde her kartta filtrelediği sütunu
gösterir (bu sütun değiştirilebilir ya da kaldırılabilir) ve **Tüm uyumlu kartlara bağla**
gerisini tamamlar. Filtrenin bir **varsayılan değeri** olabilir — örneğin “Bu yıl”.

Okuma modunda bir noktaya tıklamak da bir filtreyi ayarlayabilir: şehirler sütunu “Ville”
filtresine bağlı bir kartta **“Lyon” ile filtrele**.

![“Activité” sekmesi: duruma göre yığılmış, son tarihe göre görevler, projelerin hunisi, pivot tabloda tahmini saatler](../../../../assets/screens/tableaux-de-bord-activite.png)

## Copilot

Panolar bölümünün başlığındaki **Copilot**, sağda veritabanı üzerine doğal dilde bir konuşma
açar: “aylık ciro”, “müşteriye göre bir filtre ekle”, “ağustos neden düşüyor?”. Her öneri, tek
tıkla uygulanan bir kart olarak gelir:

| Öneri | Ne yapar |
|---|---|
| **Bir soru** | konuşmada çalıştırılır ve çizilir; düzenleyicide açılır ya da panoya eklenir |
| **Pano değişiklikleri** ya da yeni bir pano | eklenen, değiştirilen ya da kaldırılan kartlar, metinler, ilgili sütuna sahip kartlara kendiliğinden bağlanan filtreler, sekmeler, ad — tek bir kayıt, kart üzerinden **geri alınabilir** |
| **Görüntülenen filtreler için değerler** | “bana geçen ayı göster”: filtreler ayarlanır, hiçbir şey kaydedilmez |

Soru sormak ya da filtreleri ayarlamak veritabanının her okuyucusuna açıktır; bir panoyu
değiştirmek ya da oluşturmak **Yönetim** düzeyini gerektirir.

Varsayılan olarak yapay zeka sağlayıcısına konuşmayla birlikte **yalnızca yapı** gider: tablolar
ve alanları, veritabanının panoları ve kayıtlı soruları ve görüntülenen pano — sekmeleri,
filtreleri, kartlarının tanımı (soruları, metinleri). Ne satırlar, ne kartların sonuçları, ne
de veri olabilecek **filtrelerde seçilen değerler** gider: bir filtreden yalnızca bir değeri
olduğu bilgisi gider. Ajanlara görünmez olarak işaretlenmiş bir alan gitmez; ona atıf yapan bir
kartın sorusu da gitmez.

**Verilerin okunmasına izin ver** kutusu, konuşma süresince görüntülenen filtrelerin
değerlerini ve bu filtreler altındaki kartların sonuçlarını ekler (okuma başına en fazla 50
satır, yanıtın altında listelenir); böylece rakamlar dayanaklarıyla yorumlanabilir. Bkz.
[Yapay zeka](/basedb/tr/fonctionnalites/ia/).

## Bir panoyu paylaşma

Bir panonun başlığındaki **Paylaş**, veritabanı üzerinde **Yönetim** düzeyine sahip olanlara
sunulur. İki yol vardır:

- **Veritabanını paylaş…** kişileri veritabanına davet eder: panoyu basedb'de açarlar ve her
  kart onların kendi izinleriyle okur;
- **Bağlantı oluştur**, veritabanı üzerinde hiçbir izin gerektirmeyen ve **yalnızca** bu panoya
  giden bir bağlantı verir.

| Bağlantı erişimi | Kim okur |
|---|---|
| **Herkese açık** | bağlantıya sahip herkes, hesap gerekmeden |
| **Oturum açmış üyeler** | çalışma alanının bir üyesi, oturum açtıktan sonra — gerekirse yalnızca belirli gruplardan |

Bağlantının sayfası panonun sekmelerini, filtrelerini ve kartlarını **salt okunur olarak**
gösterir: ne keşif, ne satırlara erişim, ne de kişisel soru. Kartlar, **bağlantıyı yayımlayan
kişinin izinleriyle** okur ve bu izinler her okumada yeniden değerlendirilir: kişi veritabanına
erişimini kaybederse bağlantı **askıya alınır**. **Bağlantı etkin** anahtarı bağlantıyı
kaybetmeden kapatır, **Yeniden oluştur** eskisini geçersiz kılar.

**Başka bir siteye yerleştirmeye izin ver** kutusunu işaretleyin: iletişim kutusu, panoyu bir
intranette ya da bir wiki'de göstermek için bir `<iframe>` **yerleştirme kodu** verir. Bu,
[paylaşılan görünümlerle](/basedb/tr/fonctionnalites/vues-partagees/) aynı mekanizmadır.

## Herkesin kendi izinleri

Her kart **bakan kişinin izinleriyle** okur: aynı pano herkese görmeye hakkı olanı gösterir —
onu yayımlayan kişinin izinleriyle okuyan bir paylaşım bağlantısı dışında. Size kapalı bir tabloya ya da alana dayanan bir kart, eksik bırakarak yanıltacak bir
rakam yerine “Erişilemeyen veri” gösterir. Bir soruyu kaydetmek yalnızca soruyu paylaşır, asla
yazarının okuyabildiklerini değil.

## Sınırlar

- Bir soru en fazla 2.000 satır döndürür; bir özet için bu neredeyse her zaman yeterlidir.
- Her kart sorgusunu açılışta ve her filtre değişikliğinde, önbellek olmadan yapar.
- Harita altlıkları anakara Fransa'yı (bölgeler, departmanlar) ve dünya ülkelerini kapsar.
  Kaynak: IGN, Admin Express (Licence ouverte); Natural Earth.
