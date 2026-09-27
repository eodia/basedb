---
title: Sorgular ve SQL görünümleri
description: Herkes için, herkesin kendi izinleriyle SQL; tabloların altında kişisel ya da paylaşılan kayıtlı sorgular; tabloların arasında yer alan gerçek PostgreSQL görünümleri.
---

Tablolarınız gerçek PostgreSQL tablolarıdır ve arayüz onları gerçek adlarıyla, SQL ile
sorgular. Veritabanının her üyesi bir sorgu yazabilir, onu tabloların altına **kaydedebilir** —
yalnızca kendisi için, tüm veritabanı için ya da birkaç grup için —; veritabanını yöneten kişi
de ondan bir **SQL görünümü** yapabilir: tabloların arasında yer alan, `psql`'in ve
araçlarınızın da okuduğu gerçek bir PostgreSQL görünümü.

![“Sorgular” bölümünden açılmış kayıtlı bir sorgu; üstte, tabloların arasında yer alan iki SQL görünümü](../../../../assets/screens/requete-sql.png)

## Herkes kendi izinleriyle

Sekme çubuğundaki **+** ya da veritabanının **⋯** menüsü → **Yeni SQL sorgusu**, bir SQL
sekmesi açar: sözdizimi renklendirmesi ve otomatik tamamlama sunan bir düzenleyici, çalıştırmak
için **Ctrl+Enter** ve tablolarınızla aynı ızgarada sonuç. Sorgunun neyi okuyabileceği, onu
kimin çalıştırdığına bağlıdır:

- veritabanı üzerinde **Yönetim** düzeyiyle, yazmalar dahil tüm veritabanı;
- **Okuma** ya da **Düzenleme** düzeyleriyle sorgu **salt okunur olarak, kendi izinlerinizle**
  çalışır. Size kapalı bir tablo sorgu için yoktur; sizden gizlenen bir alan `SELECT *`
  sonucundan kaybolur ve tabloyu nitelendirseniz bile adını verirseniz reddedilir; bir yazma
  reddedilir. Sonuç **İzinleriniz** rozetini taşır.

![“İzinleriniz” rozeti: sorgu yalnızca kişiye açık tabloları ve alanları görür](../../../../assets/screens/sql-vos-droits.png)

Ayıklamayı yapan ekran değildir: izinlerinizi, size özel bir rol üzerinde, sütun sütun
PostgreSQL'in kendisi uygular. Bu yüzden bir sorgu size ızgaranın, API'nin ya da MCP
sunucusunun göstermeyeceği hiçbir şeyi gösteremez.

## Bir sorguyu kaydetme

Sekmenin çubuğundaki **Kaydet**, sorguyu veritabanının tablolarının altına, **Sorgular**
bölümüne yerleştirir. Sorgu tek tıkla yeniden açılır; **⋯** → **Farklı kaydet…** bir kopyasını
oluşturur, **Ad ve paylaşım…** (sekmede ya da kenar çubuğundaki menüsünde) onu yeniden
adlandırır, kimin göreceğini değiştirir ya da siler.

![Bir sorguyu kaydetme: adı, ne gösterdiği ve kimin gördüğü](../../../../assets/screens/requete-enregistrer.png)

| Kapsam | Kim görür | Kim oluşturabilir ve değiştirebilir |
|---|---|---|
| **Kişisel** — bir asma kilit | yalnızca siz | veritabanını gören herkes, kendisi için |
| **Tüm veritabanı** | veritabanını gören herkes | veritabanı üzerinde **Yönetim** düzeyi |
| **Gruplar** | seçilen grupların üyeleri | veritabanı üzerinde **Yönetim** düzeyi |

**Bir sorguyu paylaşmak onun metnini paylaşır, asla yazarının okuyabildiklerini değil.** Herkes
onu kendi izinleriyle çalıştırır: iki kişinin açtığı aynı sorgu, her birine görmeye hakkı
olanı gösterir — ya da bir sütunun kendisi için var olmadığını söyler.

Kenar çubuğundan açılan bir sorgu **hemen, salt okunur olarak çalışır**: hiçbir şeye karar
vermeden sonucunu görürsünüz. **Çalıştır** onu daha sonra olduğu gibi yeniden çalıştırır.
Adının yanındaki bir nokta, kaydedildiğinden beri metnini değiştirdiğinizi belirtir; **Kaydet**,
sorguyu değiştirebiliyorsanız değişikliği ona kaydeder, değiştiremiyorsanız yeni bir sorgu
oluşturmayı önerir.

## SQL görünümleri

Bir **SQL görünümü**, veritabanının şemasındaki gerçek bir PostgreSQL görünümüdür. Bir tablo
gibi rengi ve simgesiyle **tabloların arasında** yer alır; sağındaki küçük bir **göz** onun bir
görünüm olduğunu belirtir. Bir tıklama onu bir sekmede açar: satırları ızgarada, onları yeniden
okumak için **Yenile**.

![Kenar çubuğundan açılmış “Factures à encaisser” görünümü](../../../../assets/screens/vue-sql.png)

Görünüm, veritabanının **⋯** menüsü → **Yeni SQL görünümü…** ile ya da bir SQL sekmesinden
oluşturulur: **⋯** → **SQL görünümü oluştur…**; sekmenin sorgusu görünümün tanımı olur.
İletişim kutusu şunları ister:

- **etiketi** ve **görünüşü** — renk, simge ya da görsel, bir tablodaki gibi seçilir;
- **teknik adı** — `FROM`'dan sonra yazılan ad —, siz vermezseniz etiketten türetilir;
- **sorgusu**: veritabanının tabloları ve diğer görünümleri üzerinde tek bir `SELECT`.
  PostgreSQL reddettiğini reddeder ve düzenleyici hatanın yerini gösterir.

![Bir SQL görünümünün iletişim kutusu: etiket ve görünüş, teknik ad, sorgu, açıklama](../../../../assets/screens/vue-sql-dialogue.png)

Görünüm daha sonra adıyla, arayüzden olduğu gibi `psql`'den ya da BI aracınızdan da okunur:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Bir görünüm, görmediğiniz bir alanı asla göstermez.** Herkes onu, okuduğu her tablo ve her
sütun üzerinde kendi izinleriyle okur; kenar çubuğu onu yalnızca görünümün okuduğu her şeyi
okuyabilen kişilere listeler. Görünüm yalnızca **kendi** veritabanını okur: başka bir
veritabanı ya da basedb kataloğu daha oluşturma anında reddedilir. Onu oluşturmak, değiştirmek
ya da silmek veritabanı üzerinde **Yönetim** düzeyini gerektirir.

### Yapı değiştiğinde

- Bir tabloyu ya da alanı **yeniden adlandırmak** bir görünümü bozmaz: PostgreSQL onu izler.
- Görünümün okuduğu hesaplanan bir alanın **formülünü değiştirmek** görünümü bir anlığına
  kaldırır, ardından yeni sütun üzerinde yeniden kurar. Görünüm artık tutarlı değilse, tanımı
  saklanarak **düzeltilecek** olarak kalır — kenar çubuğunda bir üçgen bunu belirtir —:
  **Görünümü düzenle…**, düzeltin, kaydedin.
- Bir görünüm onu okuduğu sürece bir tablo temizlenmez ve başka bir görünüm onu okuduğu sürece
  bir görünüm silinmez: ret, soruna yol açan görünümü adıyla belirtir.

## Sorgu, SQL görünümü mü yoksa soru mu?

| | Nedir | Nerede yaşar | Ne için |
|---|---|---|---|
| **Kayıtlı sorgu** | bir SQL metni | tabloların altında, “Sorgular” bölümünde | bir sorguyu yeniden bulmak, metin olarak paylaşmak |
| **SQL görünümü** | gerçek bir PostgreSQL görünümü | tabloların arasında | bir okumaya ad vermek; arayüz **ve** `psql`, betikleriniz, araçlarınız için |
| **Soru** | fareyle ya da SQL ile oluşturulmuş bir okuma ve onun görselleştirmesi | [panolarda](/basedb/tr/fonctionnalites/tableaux-de-bord/) | filtreler altında bir rakam, bir grafik, bir pivot tablo |

## Sınırlar

- Izgara en fazla ekranın altında seçilen **sayfa başına satır** sayısı kadar satır gösterir;
  “kesildi” bunu belirtir. Bir sorgu 15 saniye sonra durur.
- Bir SQL görünümü SQL'de ve arayüzde okunur; REST API ve MCP sunucusu onu sunmaz.
- Bir SQL görünümü oluşturulduğu ortamda kalır: bir ortam oluşturmak, yapıyı karşılaştırmak ya
  da bir şablon kaydetmek onu henüz taşımaz.
