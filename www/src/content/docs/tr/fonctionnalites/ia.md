---
title: Yapay zeka
description: Bir alanın yapay zeka seçeneği, taslaklar, Copilot ve panoların Copilot'u — ve sağlayıcıya neyin gittiği.
---

Yapay zeka **isteğe bağlıdır**. Yapılandırılmış bir sağlayıcı olmadan hiçbir yere hiçbir şey
gitmez. basedb, kendi anahtarınızla **OpenAI**, **Anthropic** ve **Mistral** ile konuşabilir —
ve OpenAI API'si ile konuşan her sunucuyla da: **Azure**, kurumsal bir ağ geçidi, kendi
altyapınızda sunulan bir model.

## Bir sağlayıcı yapılandırma

Arayüzde hiçbir ayar kaydedilmediği sürece API kendi ortamını okur:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral ya da openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # ya da BASEDB_AI_API_KEY
```

Anahtar `BASEDB_AI_API_KEY` altında ya da, o yoksa, sağlayıcının alışılmış adı altında okunur
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, bir ağ geçidi, yerel bir model

`BASEDB_AI_PROVIDER=openai_compatible`, çağrıları OpenAI biçiminde `BASEDB_AI_BASE_URL`
adresine gönderir: `/chat/completions` öncesindeki her şey, parametreler dahil.
`BASEDB_AI_HEADERS`, o sunucunun istediği başlıkları her çağrıya bir JSON nesnesi olarak ekler.

```bash
# Azure OpenAI: model olarak dağıtımın adı, anahtar api-key başlığında
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Azure'un dağıtım başına eski biçimi: parametre yolun ardından kalır
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Ollama tarafından sunulan bir model, anahtarsız
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

`openai_compatible` ile anahtar isteğe bağlıdır: `BASEDB_AI_API_KEY` verilmişse
`Authorization: Bearer` olarak gider. `BASEDB_AI_HEADERS`'taki bir başlık, anahtarınkinin yerini
alır — örneğin kendi `Authorization` başlığını isteyen bir ağ geçidi için.

`BASEDB_AI_BASE_URL` ve `BASEDB_AI_HEADERS`, bir ağ geçidi üzerinden ulaşılan diğer üç sağlayıcıya
da hizmet eder: `anthropic` için adres, `/messages` öncesindeki kısımdır. Bu iki değişken ortamın
sağlayıcısına eşlik eder, yalnızca ona: başka bir sağlayıcı seçmiş bir çalışma alanı ne adresi, ne
başlıkları, ne de anahtarı alır. API'nin başlatılması seçilen sağlayıcıyı yazar ve geçersiz bir
adresi ya da JSON nesnesini bildirir.

Sertifikası kendinden imzalı bir iç ağ geçidi ya da trafiği yeniden imzalayan kurumsal bir proxy,
çağrıların başarısız olmasına yol açar: `BASEDB_AI_PROVIDER_SSL_VERIFY=false`, **yalnızca bu
sağlayıcının** sertifikasını doğrulamayı bırakır — kurulumun diğer tüm giden çağrıları ve bir
çalışma alanının seçmiş olabileceği sağlayıcı doğrulanmaya devam eder. Başlatma bunu bildirir.
Anahtar her çağrıda geçtiği için bunu yalnızca denetlediğiniz bir ağa ayırın.

## Bir alanın yapay zeka seçeneği

Yapay zeka bir alan türü değil, bir **seçenektir**: bir alanın formundaki **Yapay zeka**
anahtarı — metin, uzun metin, URL, sayı, tekli seçim, boolean, tarih — alanın, başka sütunlara
atıf yapan bir talimattan yola çıkarak bir model tarafından doldurulmasını sağlar:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Alan, satır oluşur oluşmaz, ardından atıf yapılan bir sütun her değiştiğinde hesaplanır — ve
  istenirse bir zamanlamaya göre (en sık 15 dakikada bir).
- Sütun **türünü korur**: bu türde hiçbir şey okunamayan bir yanıt (bulunamayan bir sayı, var
  olmayan bir seçenek) yazılmak yerine reddedilir.
- Seçeneği devre dışı bırakmak, değerler korunarak alanı yeniden elle düzenlenebilir hâle
  getirir.
- Atıf yapılan değerler sağlayıcıya gider: **etkinleştirme açık bir onay gerektirir**.

`BASEDB_AI_FIELD_QUOTA` bu hesaplamaları saat ve çalışma alanı başına sınırlar (varsayılan 300).

## Bir otomasyonda

Bir [otomasyon](/basedb/tr/fonctionnalites/automatisations/#yapay-zekaya-sor) adımlarından
birinde **yapay zekaya sorabilir**: satıra ve önceki adımlara atıf yapan bir talimat; seçilen
türde okunan ve sonraki adımların yazdığı, gönderdiği ya da atıf yaptığı bir yanıt. Bir alanla
aynı kurallar geçerlidir: kaydederken onay, yalnızca talimatın atıf yaptığı şey gider, her çağrı
günlüğe kaydedilir ve `BASEDB_AI_FIELD_QUOTA` kotasına sayılır.

## Taslaklar ve Copilot

- **Taslaklar**: bir tabloyu ya da bir formülü tek cümleyle tarif edin ve gözden geçireceğiniz
  bir öneri alın. Yalnızca etiketler, türler ve girilen cümle gider — hiçbir hücre değeri
  gitmez.
- **Şablonlar**: bütün bir veritabanını tarif edin — “müşterilerimin şikâyetlerinin takibi” —
  ve tablolar, örnek satırlar, görünümler, pano ve otomasyonlar alın; bunları iyileştirip
  oluşturun. Yalnızca cümle gider. Bkz.
  [Veritabanı şablonları](/basedb/tr/fonctionnalites/modeles/#yapay-zekadan-isteme).
- **Copilot**: görüntülenen veritabanı üzerine bir konuşma. Bir filtre, bir sorgu, sütunlar,
  bir tablo, bir deneme veri kümesi istersiniz; her öneri bir kart olarak gelir ve formlarla
  aynı yollardan geçerek tek tıkla uygulanır.

Varsayılan olarak sağlayıcıya yalnızca yapı gider. **“Verilerin okunmasına izin ver”** kutusu,
Copilot'un konuşma süresince satırları okumasına (okuma başına en fazla 50) ve onlardan yola
çıkarak yanıt vermesine izin verir — her okuma, yanıtın altında listelenir.

## Panoların Copilot'u

[Panolar](/basedb/tr/fonctionnalites/tableaux-de-bord/#copilot) bölümünde Copilot, tek tıkla
uygulanacak sorular, pano değişiklikleri ve filtreler için değerler önerir. Aynı kurallar:
onay olmadan yalnızca yapı gider — tablolar ve alanlar, veritabanının panoları ve soruları,
görüntülenen panonun kartlarının tanımı (soruları, metinleri) —; asla sonuçlar ya da
filtrelerde seçilen değerler gitmez. **“Verilerin okunmasına izin ver”** kutusu bu değerleri ve
görüntülenen filtrelerle kartların sonuçlarını ekler; okuma başına en fazla 50 satır, her biri
yanıtın altında listelenir.

## Otomasyonların Copilot'u

[Otomasyonlar](/basedb/tr/fonctionnalites/automatisations/#copilot) bölümünde Copilot eksiksiz
bir otomasyon önerir — ekrandakinin değiştirilmiş hâli ya da yeni bir otomasyon — ve onu
düzenleyicinin akışına yerleştirir, **asla kaydetmeden**: siz gözden geçirir, sonra
kaydedersiniz. Aynı kurallar: onay olmadan yalnızca yapı gider — tablolar ve alanlar,
veritabanının otomasyonları, ekrandaki otomasyon, hiçbir değer içermeyen son çalıştırmaları,
takma işaretlerle kişiler ve Slack kanalları —; **“Verilerin okunmasına izin ver”** kutusu ise
okunan satırları ekler, okuma başına en fazla 50.

`BASEDB_AI_QUOTA` etkileşimli çağrıları saat ve çalışma alanı başına sınırlar (varsayılan 120).
