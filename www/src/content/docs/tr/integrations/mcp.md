---
title: MCP sunucusu
description: Bir yapay zeka ajanını Model Context Protocol ile basedb'ye bağlamak.
---

basedb bir **MCP sunucusu** sunar (`POST /mcp`, arayüzle aynı adreste): bir ajan — Claude, bir
kod asistanı, kendi ajanınız — burada veritabanlarını keşfeder, satırları okur ve yazar ve yapı
değişiklikleri **önerir**.

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

## On iki araç

| Araç | Rol |
|---|---|
| `whoami` | ajanın kim olduğu, hangi izinlere sahip olduğu |
| `list_bases`, `describe_base`, `describe_table` | yapıyı ve açıklamalarını keşfetmek |
| `list_records`, `get_record`, `lookup_records` | okumak, filtrelemek, bir görüntüleme değerini çözümlemek |
| `create_record`, `update_record` | satır yazmak |
| `propose_create_table`, `propose_add_field`, `get_proposal` | bir yapı değişikliği önermek |

## Bir ajanın yapmadıkları

- **Hiçbir şey silmez.**
- **Yapıyı değiştirmez**: önerir. Öneri, veritabanının menüsündeki **Ajan önerileri…** içinde
  bekler; orada yapıyı yöneten bir kişi onu onaylar ya da reddeder; karar verilmezse 24 saat
  sonra süresi dolar.
- **Token'ını oluşturan kişiden asla daha fazla izne sahip olmaz**: token'ın izinleri o kişinin
  izinleriyle kesiştirilir.
- Ajanlara görünmez olarak işaretlenmiş alanları ve MCP'ye kapalı veritabanlarını görmez.

Her çağrı, parametrelerinin değerleriyle değil, yalnızca biçimleriyle günlüğe kaydedilir.
