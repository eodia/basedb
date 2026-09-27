---
title: İşbirliği
description: Yorumlar ve bahsetmeler, bildirimler, gerçek zamanlı güncellemeler ve çevrimiçi durum.
---

Birkaç kişi aynı veritabanı üzerinde aynı anda çalışır: her biri diğerlerinin yazdıklarının
geldiğini görür, kimin neye baktığını bilir ve bir satırı tam bulunduğu yerde tartışır.

## Yorumlar

Bir satırın ayrıntılarında, “Ayrıntılar” ile “Geçmiş” arasında bir **Yorumlar** sekmesi vardır.
Bir üyeden **bahsetmek** için `@` yazın, göndermek için Ctrl+Enter'a basın. Herkes kendi
yorumlarını düzenler ya da siler.

![Bir proje üzerine bir konuşma](../../../../assets/screens/commentaires.png)

Satırı okuyabilmek, ona yorum yapmak için yeterlidir. Kendisinden bahsedilen ama satırı
okuyamayan bir kişiye haber verilmez — ve yazar, mesajın gittiğini sanmak yerine bu konuda
uyarılır.

## Bildirimler

Sağ üstteki zil okunmamış olanları sayar. Oraya dört şey gelir:

- biri bir yorumda sizden **bahseder**;
- biri, sizin de yazdığınız bir konuşmada **yanıt verir**;
- biri sizi bir Kişi alanına **atar** — arayüzden, API'den, bir formdan ya da bir
  otomasyondan;
- bir [otomasyon](/basedb/tr/fonctionnalites/automatisations/) size **haber verir**.

Bir bildirimi açmak satırı açar. **Tümünü okundu olarak işaretle** sayacı sıfırlar; bildirimler
90 gün saklanır.

![Alınan bir bahsetme](../../../../assets/screens/notifications.png)

## Gerçek zamanlı

Başkalarının yazdıkları **sayfayı yenilemeden** görüntülenir: değiştirilen bir hücre, taşınan
bir kart, eklenen bir satır — ister arayüzden, ister API'den, bir ajandan ya da doğrudan
SQL'den gelsin. Sunucu yalnızca bir **sinyal** gönderir, asla veri göndermez: verileri sizin
izinlerinizle yeniden okuyan ekrandır. Düzenlemekte olduğunuz bir hücre asla elinizin altından
değiştirilmez.

## Çevrimiçi durum

**Aynı tabloya** bakan kişilerin yüzleri ekranın üstünde görünür; **aynı satırı** açmış
olanlarınki ise satır ayrıntılarının başlığında. Izgarada, diğerlerinin imleci üzerinde
gezindikleri hücrede görünür.

## Geri alma

Ctrl+Z son yazmanızı geri alır — bkz. [geçmiş](/basedb/tr/fonctionnalites/historique/#geri-al-ctrlz).

## Sınırlar

- Bildirimler basedb içinde kalır: şimdilik hiçbiri e-postayla gönderilmez.
- Bir kerede yüzden fazla satır değiştiğinde ekran, satır satır güncellemek yerine sayfanın
  tamamını yeniden yükler.
