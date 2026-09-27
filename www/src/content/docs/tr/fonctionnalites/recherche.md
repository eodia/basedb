---
title: Arama
description: Her şeyi bulmak için tek bir alan — tablolar, görünümler, panolar, satırlar, komutlar — ve Copilot'a bir soru sormak için. Ctrl+K.
---

Üst çubuğun ortasındaki **Tablo, satır, komut ara…** alanı aramayı açar: basedb'de
ulaşabileceğiniz her şey için tek bir alan. **Ctrl+K** (Mac'te **⌘K**) onu herhangi bir
ekrandan açar ya da kapatır — bir metin düzenleyicisi içinde hariç, orada bir bağlantı ekler.

## Neyi bulur

| | |
|---|---|
| **Tablolar ve nesneler** | gördüğünüz projeler ve veritabanları; tablolar, SQL görünümleri ve kayıtlı sorgular; açık veritabanının tablolarının görünümleri, kişisel olanlar dahil; projenin veritabanlarının soruları, panoları ve otomasyonları; tabloların sütunları; açık sekmeler |
| **Satırlar** | açık veritabanının tablolarındaki verilerin kendisi: sütunların metni, listelerin seçenekleri, tam bir sayı — en az iki karakterden itibaren. Yapıştırılan bir satır kimliği kendi satırını bulur |
| **Komutlar** | uygulamanın yapabildikleri: veritabanının yapısına, geçmişine, panolarına gitmek; bir tablo, bir soru, bir SQL sorgusu, bir veritabanı, bir proje oluşturmak, bir şablondan başlamak; bir tabloya içe aktarmak; son yazmayı geri almak ya da yeniden uygulamak; sekmeyi kapatmak ya da değiştirmek; temayı değiştirmek; Copilot'u açmak; **Bu sayfanın bağlantısını kopyala**; bir ayarlar ya da yönetim sekmesi açmak; oturumu kapatmak |
| **Copilot** | doğal dilde bir soru, Copilot'a emanet edilir |

**Enter**, seçilen sonucu açar: bir satır kendi tablosunda, ayrıntılarında açılır. Büyük bir
ekranda sağdaki bir panel önizlemesini gösterir — bir satırın değerlerini, bir tablonun
sütunlarını ve açıklamasını, bir panonun ya da bir otomasyonun açıklamasını. Bir basedb
adresini yapıştırın: **Bu bağlantıyı aç** sizi oraya götürür (bkz.
[her ekrana giden bir bağlantı](/basedb/tr/fonctionnalites/collaboration/#her-ekrana-giden-bir-bağlantı)).

Boş alan **son kullandıklarınızı**, açık sekmeleri, veritabanının tablolarını ve birkaç öneriyi
sunar.

## Aklınıza geldiği gibi yazın

- **Ne aksan ne de büyük harf**: `izmir`, “İzmir” şehrini bulur.
- **Kelime başları ve baş harfler**: “Yeni müşteri” için `ym`, “Yeni tablo” için `yenitab`.
- **Bağışlanan bir yazım hatası** — unutulmuş, ikilenmiş, değiştirilmiş ya da yer değiştirmiş
  bir harf; yedi harften uzun bir kelimede bunlardan iki tanesi — ama asla ilk harfte.
- **Yazılan her kelime bir yerde bulunmalıdır**, adında ya da onu içeren şeyde: `satış
  müşteriler`, “Satış” veritabanının “Müşteriler” tablosunu bulur. Tür de yazılabilir:
  `görünüm`, `oto`, `pano`.
- **Önce bir tablo, sonra onda aranan şey**: `müşteriler bursa`, “Müşteriler” tablosunun
  satırlarında “bursa”yı arar.

En üstte **en iyi sonuç** yer alır; sık ve son zamanlarda açtıklarınız öne çıkar. Bu hafıza
tarayıcınızda kalır.

## Aramayı daraltmak

Alanın altındaki düğmeler — **Tümü**, **Tablolar ve nesneler**, **Satırlar**, **Komutlar**,
**Copilot** — neyin arandığını daraltır. İlk yazılan karakter de aynısını yapar:

| Önce şunu yazın | Aramak için |
|---|---|
| `#` | yalnızca tablo ve nesneleri |
| `/` | yalnızca satırları |
| `>` | yalnızca komutları |
| `?` | Copilot'a bir soru |

**Tab**, bir tablo ya da veritabanı üzerinde, **içinde** arar: adı alanda görünür ve arama
yalnızca onun satırlarına, görünümlerine, sütunlarına ve komutlarına yönelir. Boş alan o zaman
en son değiştirilen yirmi satırı gösterir. **⌫**, alan boşken, bundan çıkar; **Esc** bir adım
geri döner, sonra kapanır.

## Copilot'a sormak

Her arama, metin bir soru gibi okunduğunda başa geçen **Copilot'a sor: “…”** ile biter — “?”
ile bitiyorsa, “kaç”, “hangi”, “göster”… ile başlıyorsa ya da beş kelime ve üzerindeyse. Copilot
veritabanı üzerinde açılır ve soruyu siz yazmışsınız gibi alır. Yapıyı okur, satırları değil —
**Verilerin okunmasına izin ver** kutusunu işaretlemediğiniz sürece — ve bir öneri sunar: siz
uygulamadan hiçbir şey değişmez. Yapay zekanın kurulumda ayarlanmış olması gerekir — bkz.
[Yapay zeka](/basedb/tr/fonctionnalites/ia/).

## İzinler ve sınırlar

Arama, ekranın geri kalanıyla aynı yollardan geçer, **kendi izinlerinizle**: size kapalı bir
tablo ya da sütun ne nesneler arasında ne de satırlarda görünür. Otomasyonlar yalnızca kendi
veritabanı üzerinde **Yönetim** düzeyine sahip olanlara önerilir.

- Satırlar açık veritabanında ya da Tab ile girdiğiniz veritabanı veya tabloda aranır: tablo
  başına üç satır, en fazla yirmi dört tabloda; bir tablo içindeyse yirmi satır.
- Sorular, panolar ve otomasyonlar açık projenin olanlardır (en fazla sekiz veritabanı), en
  fazla iki dakikada bir yeniden okunur.
- Her grup birkaç sonuç gösterir, ardından onu tam olarak açan **N diğer sonuç**.

## Klavye kısayolları

Aramanın altındaki **Kısayollar**, ya da **Klavye kısayolları** komutu, hepsini gösterir.
**Ctrl**, Mac'te **⌘** olarak okunur.

| Tuşlar | Etki |
|---|---|
| **Ctrl+K** | aramayı açmak ya da kapatmak |
| **↑** **↓**, **Enter** | sonuçlarda gezinmek, sonucu açmak |
| **Alt+W** | sekmeyi kapatmak |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | sonraki sekme, önceki sekme |
| tekerlek tıklaması | bir sekmeyi kapatmak |
| **Ctrl+A**, **Ctrl+C** | ızgarada, tümünü seçmek, seçilen hücreleri kopyalamak |
| **Ctrl+tıklama** | bir ilişkiyi takip etmek |
| **Ctrl+Z**, **Ctrl+Y** | son yazmayı geri almak, yeniden uygulamak |
| **Ctrl+Enter** | bir yorum göndermek, bir açıklamayı kaydetmek |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | bir metinde: kalın, italik, bağlantı |
