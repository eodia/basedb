---
title: İzinler ve gruplar
description: Hesaplar, gruplar, proje, veritabanı ve tablo bazında erişim düzeyleri, alan bazında kısıtlamalar ve ayarlarınız.
---

İzinler asla tek tek kişilere değil, **gruplara** verilir. Bir projeye, veritabanına ya da
tabloya verilen bir düzey, daha sonra oluşturulacaklar dahil, altındaki her şeye iner.

## Dört düzey

| Düzey | Neye izin verir |
|---|---|
| **Erişim yok** | hiçbir şeye: kaynak görünmezdir |
| **Okuma** | satırları görmek, onlara yorum yapmak, kendine kişisel görünümler oluşturmak, yapıya ve panolara bakmak, kendi sorularını sormak ve kaydetmek, salt okunur SQL yazmak ve kişisel sorgularını kaydetmek |
| **Düzenleme** | ek olarak satır oluşturmak, değiştirmek, silmek |
| **Yönetim** | ek olarak yapıyı değiştirmek, paylaşılan görünümleri ve panoları oluşturmak, bir panoyu bağlantıyla paylaşmak, soruları ve sorguları paylaşmak, SQL görünümleri, otomasyonlar, entegrasyonlar ve token'lar oluşturmak; SQL'i yazmalar dahil tüm veritabanına erişir |

İzinler **toplanır**: bir kişi, gruplarından birinin ona verdiği en yüksek düzeyi alır. Bir
tabloya veritabanından daha az izin vermek onu “ince ayarlı” yapar.

Her zaman iki grup vardır: her şeyi yöneten **Yöneticiler** ve her hesabın üyesi olduğu **Tüm
kullanıcılar** — bu gruba verilen her şeye herkes sahip olur.

## Alan düzeyine kadar

Düzeyler tablosunun altında **Alanlar**, bir sütunu bir gruptan gizler ya da o grup için
değiştirilemez yapar. Ekran ayrıca belirli bir kişinin gerçekte neyi gördüğünü ve bunu hangi
grup aracılığıyla gördüğünü de gösterir.

Gizli bir alan her yerde yok sayılır: ızgarada, görünümlerde, API'de, MCP'de, geçmişte,
arayüzde yazılan SQL'de ve SQL görünümlerinde. Onun üzerinde filtrelemek ya da sıralamak, var
olmayan bir alan için olduğu gibi yanıt verir.

## Peki ya SQL?

Arayüzde SQL aynı izinleri izler ve bu izinleri PostgreSQL'in kendisi uygular: Yönetim düzeyi
olmadan bir sorgu, kişiye özel bir rol üzerinde salt okunur olarak çalışır; bu rolde kapalı bir
tablo yoktur ve gizli bir alan reddedilir. Bir [SQL görünümü](/basedb/tr/fonctionnalites/requetes-et-vues-sql/)
onu okuyanın izinleriyle okunur ve bir sorguyu paylaşmak yalnızca metnini paylaşır.

Veritabanına **doğrudan `psql`** erişimi ise basedb tarafından yönetilmez: gizli alanlar dahil
her şeyi okur. Kısıtlamalar ürünün yüzeylerini — arayüz, API, MCP — korur, ama asla veritabanına
SQL erişimi olan birine karşı korumaz; bu erişimler, kurulumu işleten kişinin tanımladığı
PostgreSQL `GRANT` komutlarıyla düzenlenir.

## Hesaplar ve giriş

- Bir hesap, bir kez gösterilen ve ilk girişte değiştirilmesi gereken **geçici bir şifreyle**
  oluşturulur.
- Giriş, şifreyle ya da kurulumu işleten kişinin tanımladığı bir **OpenID Connect**
  sağlayıcısıyla yapılır.
- Yönetim eylemleri bir **yükseltilmiş oturum** gerektirir: son beş dakika içinde yeniden
  girilmiş bir şifre.
- Oturumlar iptal edilebilir; bir oturumu iptal etmek onun erişim token'larını hemen geçersiz
  kılar.

## Ayarlarınız

Sol alttaki profil menüsünde yer alan **Ayarlar** yalnızca sizi ilgilendirir:

| Sekme | Orada ne yapılır |
|---|---|
| **Profil** | görüntülenen ad; giriş adresi; hesaba bağlı kimlik sağlayıcıları, bağlamak ya da bağlantısını kaldırmak için |
| **Güvenlik** | şifreyi değiştirmek; açık oturumlar, tek tek ya da hepsi birden kapatmak için |
| **Görünüş** | arayüzün dili; tema; tarihlerin sırası — `25/09/2026` ya da `2026-09-25` — ve takvimlerde haftanın ilk günü |
| **Bildirimler** | artık almak istemediğiniz bildirim türleri |
| **Token'lar** | tüm veritabanlarınızda oluşturduğunuz entegrasyon token'ları, son kullanımları ve iptalleri |

basedb **yirmi dil** konuşur: Fransızca, İngilizce, Almanca, İspanyolca, İtalyanca, Portekizce
(Brezilya), Felemenkçe, Lehçe, Çekçe, İsveççe, Danca, Norveççe, Fince, Rumence, Macarca,
Türkçe, Ukraynaca, Japonca, Basitleştirilmiş Çince ve Korece. Varsayılan olarak arayüz
tarayıcınızın dilini kullanır; **Görünüş** içindeki **Dil** başka bir dil belirler. Sayılar ve
tarihler seçilen dili izler.

Bir bağlantı da bir dil isteyebilir: bir basedb adresinin sonundaki `?lang=de`, giriş ekranını,
bir formu, paylaşılan bir görünümü ya da paylaşılan bir panoyu Almanca gösterir. Site, demoyu
sayfanın dilinde göstermek için tam olarak bunu kullanır. Giriş yaptıktan sonra basedb
hesabınızı izler: **Görünüş**'te seçilen dili, yoksa tarayıcının dilini.

Tema tarayıcıya özgü kalır; dil, tarih sırası ve haftanın ilk günü sizi bir bilgisayardan
diğerine izler. Adresi değiştirmek ya da bir sağlayıcı bağlamak yükseltilmiş bir oturum gerektirir; bir sağlayıcıyla giriş yapan şifresiz bir hesap, bu
sağlayıcının adresini korur.

## Tek uygulama noktası

Tüm yüzeyler — arayüz, API, MCP, paylaşılan formlar ve görünümler, otomasyonlar — çekirdekteki
aynı izin karar noktasından geçer. Arayüze özel bir yol yoktur: ekranın göstermediği şey, API'nin
döndürmediği şeydir.

Tersi de geçerlidir: ekran **reddedilecek olanı sunmaz**. Yönetim düzeyi olmadan Yapı ekranı
düğme ya da kalem olmadan incelenir ve içe aktarma bir tablo oluşturmayı önermez; satır
oluşturma ya da silme izni olmadan ızgara ne ekleme satırı ne de “Sil” sunar.
