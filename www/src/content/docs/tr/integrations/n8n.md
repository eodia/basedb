---
title: n8n
description: basedb satırlarını bir n8n iş akışından okumak ve yazmak, oluşturulan, değiştirilen ya da silinen her satırda bir iş akışı başlatmak.
---

**n8n-nodes-basedb** paketi n8n'e üç düğüm ekler:

| Düğüm | Rol |
|---|---|
| **basedb** | bir tablonun satırlarını okur ve yazar, bir satırı yorumlar; n8n'in bir yapay zeka ajanı tarafından araç olarak kullanılabilir |
| **basedb Trigger** | son kontrolden bu yana oluşturulan — ya da oluşturulan veya değiştirilen — her satır için bir iş akışı başlatır |
| **basedb Webhook Trigger** | bir satır oluşturulduğu, değiştirildiği ya da silindiği anda bir iş akışı başlatır |

## Kurulum

n8n'de: **Settings › Community Nodes › Install**, ardından `n8n-nodes-basedb`.

Arayüz olmadan — kuyruk kipi, önceden kurulmuş bir Docker imajı — : `~/.n8n/nodes` klasöründe
`npm install n8n-nodes-basedb`, ardından n8n'i yeniden başlatın.

## Kimlik bilgileri

n8n'de bir **basedb API** kimlik bilgisi oluşturun:

| Alan | Değer |
|---|---|
| **Instance URL** | basedb'yi açtığınız adres: `https://basedb.exemple.fr` |
| **Workspace** | çalışma alanının referansı, API adreslerindeki (`/api/v1/<espace>/…`) referans: `t4z56fq`, kurulum `BASEDB_TENANT`'ı belirlemediyse |
| **Token** | bir **entegrasyon token'ı**: veritabanının **⋯** menüsü → **API ve ajanlar** → **API ve MCP token'ları…** |

Bir token **bir** veritabanını açar. Satırlarını okur, yazma yetkisiyle oluşturulduysa yazar, onu
oluşturan kişiden asla daha fazla izne sahip olmaz ve **asla silmez**. Kaydedilirken n8n bağlantıyı
dener ve token reddedilirse bunu bildirir.

## Okumak ve yazmak: basedb düğümü

| İşlem | Ne yapar |
|---|---|
| **Row › Create** | bir satır ekler |
| **Row › Create or Update** | seçilen alanları bu değerleri taşıyan satırı değiştirir, ya da hiçbiri taşımıyorsa ekler |
| **Row › Get** | bir satırı `_id`'siyle okur |
| **Row › Get Many** | bir filtrenin satırlarını, istenen sırada, bir sınıra kadar ya da tümünü, sayfa sayfa okur |
| **Row › Update** | `_id`'siyle ya da başka alanlarla bulunan bir satırı değiştirir |
| **Comment › Create** | bir satırı yorumlar; bir @bahsetme kişiye haber verir |

**Veritabanı** ve **tablo**, token'ın açtığı listelerden seçilir. Yazılacak alanlar basedb'deki
adlarıyla görünür, bir tekli seçim seçenekleriyle, bir Kişi alanı çalışma alanının üyeleriyle;
hesaplanan bir alan — formül, arama, toplama, otomatik numara — orada yer almaz, çünkü onu
basedb'nin kendisi yazar. Alanın reddettiği bir değer, düğümü basedb'nin koduyla ve söylediğiyle
durdurur.

- **Filtre** ve **sıralama**, alanların teknik adlarını, SQL'dekileri kullanır:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Dil bilgisi
  [REST API](/basedb/tr/integrations/api-rest/#okuma)'nınkiyle aynıdır.
- **Sayılar** ondalık metin olarak gelir (`"1250.50"`), hiçbir hane kaybolmasın diye; **Numbers
  as Numbers** seçeneği onları sayıya çevirir.
- Bir **ilişki** `{ "id": …, "display": … }` olarak okunur ve bağlı satırın `_id`'siyle yazılır.
- **Create or Update** hiçbir zaman birden çok satırı değiştirmez: birden çoğu bu değerleri
  taşıyorsa, düğüm tahmin etmek yerine durur.
- **Delete** işlemi yok: bir token silmez. Satırları kaldırmak için onları işaretleyin (bir
  “Arşivlendi” durumu), ya da silmeyi bir
  [otomasyona](/basedb/tr/fonctionnalites/automatisations/) bırakın.

## Bir iş akışı başlatmak

### Her kontrolde: basedb Trigger

Düğüm, basedb'den seçilen hızda (her dakika, her saat…), son seferden bu yana **oluşturulan** —
ya da **oluşturulan veya değiştirilen** — satırları ister, gerekirse ek bir filtreyle. basedb
n8n'e ulaşamadığında dahi her yerde çalışır. İlk kontrolünde tablonun neresinde olduğunu not eder
ve hiçbir şey üretmez; düzenleyiciden bir deneme, sonraki düğümleri bağlayabilmek için son satırı
verir.

### O anda: basedb Webhook Trigger

Oluşturulan, değiştirilen ya da silinen her satır — doğrudan PostgreSQL'e yazılan SQL ile bile —
iş akışını hemen başlatır:

1. Düğümü ekleyin ve **Production URL**'sini kopyalayın.
2. basedb'de, veritabanının **⋯** menüsü → **API ve ajanlar** → **Webhook'lar…**: bu adrese bir
   webhook oluşturun, tablolarını ve olaylarını seçin.
3. basedb **imza gizli anahtarını** bir kez gösterir: onu n8n'in bir **basedb Webhook** kimlik
   bilgisine koyun.
4. İş akışını etkinleştirin.

Her olay bir öğeye dönüşür: `type`'ı (`record.created`, `record.updated`, `record.deleted`),
tablo, satırın **önceki** ve **sonraki** hâli, ve değişen alanlar (`changed`). Düğüm her
iletimin **imzasını** doğrular ve imzası olmayana, sahte olana ya da beş dakikadan eskisine
`401` yanıtı verir. basedb **en az bir kez** iletir: iş akışının bir olayı iki kez işlememesi
gerekiyorsa olayın `id`'si üzerinden tekilleştirin.

:::note
basedb bir webhook'u yalnızca herkese açık bir **HTTPS** adresine gönderir: özel bir ağdaki bir
n8n bunun yerine **basedb Trigger**'ı kullanır. Bkz. [Webhook'lar](/basedb/tr/integrations/webhooks/).
:::

## Düğüm olmadan

n8n'in **HTTP Request** düğümü de basedb ile konuşur: `Authorization: Bearer <jeton>` başlığı,
gidişte ve dönüşte JSON, `after` olarak geçirilen `meta.next_cursor` ile sayfalama
(`{{ $response.body.meta.next_cursor }}`), ve bir arıza sonrası `_updated_at` üzerinde bir filtre
ile ve `…/<table>/deleted?since=` ile devam etme.
