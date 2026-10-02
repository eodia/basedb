---
title: MCP sunucusu
description: Bir yapay zeka ajanını Model Context Protocol ile basedb'ye bağlamak.
---

basedb bir **MCP sunucusu** sunar (`POST /mcp`, arayüzle aynı adreste): bir ajan — Claude, bir
kod asistanı, kendi ajanınız — burada veritabanlarını keşfeder, satırları okur ve yazar, izin
verirseniz siler ve yapı değişiklikleri **önerir**.

## Bir ajan bağlama

**API ve MCP token'ları…** (veritabanının menüsünde, **API ve ajanlar** altında) üzerinden, MCP
erişimi işaretli bir token oluşturun. Aynı token hem REST API hem de MCP için kullanılır.

HTTP konuşan bir istemci için adres `http://localhost:3000/mcp`, başlık ise
`Authorization: Bearer <jeton>` şeklindedir. Süreç başlatan (stdio) bir istemci için depo,
token'ı bir ortam değişkeninden okuyan — asla yapılandırmadan okumayan — bir aktarıcı sağlar:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## On dört araç

| Araç | Rol |
|---|---|
| `whoami` | ajanın kim olduğu, hangi izinlere sahip olduğu |
| `list_bases`, `describe_base`, `describe_table` | yapıyı ve açıklamalarını keşfetmek |
| `list_records`, `get_record`, `lookup_records` | okumak, filtrelemek, bir görüntüleme değerini çözümlemek |
| `create_record`, `update_record` | satır yazmak |
| `delete_record`, `restore_record` | bir satırı silmek — bunun için oluşturulmuş bir token'la — ve onu geri yüklemek |
| `propose_create_table`, `propose_add_field`, `get_proposal` | bir yapı değişikliği önermek |

## Satırları silme

**Okuma, yazma ve silme** haklarıyla oluşturulmuş bir token, ajanın satırları `_id`'leriyle, **bir
kerede bir satır**, silmesine izin verir. `delete_record` satırı olduğu hâliyle döndürür ve silme
işlemi token'ın adına geçmişe kaydedilir; `restore_record` satırı `_id`'siyle geri getirir — ajan
kendi hatasını kendisi geri alabilir, bir kişi de bunu geçmişten yapabilir.

Ajan şunları silmez:

- salt okunur ya da okuma ve yazma yetkili bir token'la: ret, hangi token'ın oluşturulması
  gerektiğini söyler;
- kademeli (cascade) bir ilişkinin başka satırlarla birlikte götüreceği bir satırı
  (`TOKEN_CASCADE_FORBIDDEN`): bu silme işlemi, neyi birlikte götürdüğünü gören bir kişi
  tarafından arayüzde yapılır;
- birden fazla satırı aynı anda: hiçbir araç bunu yapmaz.

## Bir ajanın yapmadıkları

- **Yalnızca sizin onayınızla siler**: bunun için oluşturulmuş bir token, bir kerede bir satır.
- **Yapıyı değiştirmez**: önerir. Öneri, veritabanının menüsündeki **Ajan önerileri…** içinde
  bekler; orada yapıyı yöneten bir kişi onu onaylar ya da reddeder; karar verilmezse 24 saat
  sonra süresi dolar.
- **Token'ını oluşturan kişiden asla daha fazla izne sahip olmaz**: token'ın izinleri o kişinin
  izinleriyle kesiştirilir.
- Ajanlara görünmez olarak işaretlenmiş alanları ve MCP'ye kapalı veritabanlarını görmez.

Her çağrı, parametrelerinin değerleriyle değil, yalnızca biçimleriyle günlüğe kaydedilir.
