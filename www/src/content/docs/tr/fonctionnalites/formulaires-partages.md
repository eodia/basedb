---
title: Paylaşılan formlar
description: Bir formu herkese açık ya da oturum açmış üyelere ayrılmış bir bağlantıyla paylaşmak.
---

Bir form ya da anket **bir bağlantıyla paylaşılır**: `/f/<jeton>`. Yanıt veren kişinin **tablo
üzerinde hiçbir izne** ihtiyacı yoktur: her yanıt bir satır ekler ve tablodan başka hiçbir şey
ona gösterilmez. Satır almak yerine satır göstermek için bir görünüm
[salt okunur olarak](/basedb/tr/fonctionnalites/vues-partagees/) paylaşılır.

![Paylaşım iletişim kutusu](../../../../assets/screens/partage-formulaire.png)

## Kim yanıt verebilir

| Erişim | Kim yanıt verir | Ne görüntülenir |
|---|---|---|
| **Herkese açık** | bağlantıya sahip herkes, hesap gerekmeden | yalnızca form |
| **Oturum açmış üyeler** | çalışma alanının bir üyesi — gerekirse belirli gruplardan | giriş ekranı, ardından form ve “… olarak yanıt veriyorsunuz” |

Bağlantının sayfası uygulamanın dışındadır: ne kenar çubuğu, ne veritabanı adı, ne de başka
satırlar.

![Herkese açık bir form](../../../../assets/screens/formulaire-public.png)

## Yanıt kimin adına yazılır

Satır, **paylaşımı yayımlayan kişinin yetkisiyle** — onu en son kaydeden kişi — yazılır. Bu
kişinin satır oluşturma izni, formun sorularıyla sınırlı olarak **her yanıtta** doğrulanır:
izni kaybederse form, bu izne sahip biri onu yeniden kaydedene kadar askıya alınır.

Geçmiş, kimin yayımladığını değil, kimin yanıt verdiğini söyler:

- bir **üye** yanıtı o kişiye atfedilir;
- **herkese açık** bir yanıt formun kendisine atfedilir: “‘Demande de devis’ formu · herkese
  açık yanıt · Camille tarafından yayımlandı”.

## Açma ve kapatma

İletişim kutusu şunları ayarlar:

- **Bağlantı etkin** anahtarı;
- bir **kapanış tarihi**;
- bir **azami yanıt sayısı** — eşzamanlı yanıtlarda bile kesin;
- **Bağlantıyı yeniden oluştur**: eski bağlantı hemen çalışmaz olur;
- **Paylaşımı durdur**: bağlantı kaybolur, yanıtlar tabloda kalır.

Kapalı bir form, daha giriş istemeden bunu tek bir cümleyle belirtir.

## Sınırlar

- **İlişki**, **dosya** ve **görsel** türündeki sorular paylaşılan bir bağlantı üzerinden
  sorulmaz; iletişim kutusu bunları belirtir.
- Gönderim, IP adresi ve bağlantı başına dakikada 20 yanıtla sınırlıdır. Sağlanan proxy'nin
  (Caddy) arkasında adres, ziyaretçinin adresidir.

Ayrıntılar, mimari belgesinin
[15. bölümünde](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
yer alır.
