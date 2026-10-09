---
title: MCP sunucusu
description: Bir yapay zeka ajanını Model Context Protocol ile basedb'ye bağlamak.
---

basedb bir **MCP sunucusu** sunar (`POST /mcp`, arayüzle aynı adreste): bir ajan — Claude, bir
kod asistanı, kendi ajanınız — burada veritabanlarını keşfeder, satırları okur ve yazar, izin
verirseniz siler ve yapı değişiklikleri **önerir**.

## Bir ajan bağlama

**API ve MCP token'ları…** (veritabanının menüsünde, **API ve ajanlar** altında) üzerinden, MCP
erişimi işaretli bir token oluşturun. Aynı token hem REST API hem de MCP için kullanılır ve
**tüm veritabanını** açar: canlı ortamını ve diğer ortamlarını (aşağıya bakın).

Token'ı `BASEDB_TOKEN` ortam değişkenine koyun, asla bir yapılandırma dosyasına değil. HTTP
üzerinden MCP konuşan bir istemci — özellikle Claude Code — doğrudan `…/mcp` adresini,
`Authorization: Bearer <jeton>` başlığıyla hedefler. Claude Code ile:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Komut, projenin `.mcp.json` dosyasını yazar; orada `${BASEDB_TOKEN}` değişkene bir başvuru olarak
kalır: token'ın kendisi dosyada yer almaz.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Yalnızca yerel programları (stdio) başlatabilen bir istemci, depodaki aktarıcıdan geçer; aktarıcı
token'ı `--token-env` ile adlandırılan değişkenden okur:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Ardından ajandan `whoami` çağrısını yapmasını isteyin: token'ı kimin oluşturduğunu, hangi
veritabanını açtığını, ortamlarını ve izinlerini söyler.

## Ortamı seçme

Bir veritabanının birden çok [ortamı](/basedb/tr/fonctionnalites/environnements/) olabilir — canlı,
test, geliştirme —, her birinin kendi tabloları ve satırları vardır. Tüm veritabanı için
oluşturulmuş bir token hepsini açar ve ortam, en genelden en kesine doğru şöyle seçilir:

- **veritabanının adı**, başka hiçbir şey olmadan: `crm` canlı, `crm_recette` test ortamıdır;
- **sunucunun adresi**: `…/mcp?environment=recette`, tüm bağlantı için test ortamını hedefler.
  Aktarıcı aynı şeyi `--environment recette` ile yapar. Böylece ortam başına bir sunucu tanımlanır,
  hepsi aynı token ile:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **`environment` argümanı**, bir veritabanını adlandıran her araçta, tek bir çağrı için:
  `{"base": "crm", "table": "clients", "environment": "recette"}` ile `list_records`.

Bir ortam, rozetinin adıyla — büyük/küçük harf ve aksan ayrımı yapılmadan (`Recette`, `recette`,
“Développement” için `developpement`) — ya da `production` ile adlandırılır. `whoami` token'ın
açtıklarını listeler; `list_bases` ve `describe_base` her veritabanının hangi ortam olduğunu söyler.

Bir token, oluşturulurken tek bir ortamla da sınırlanabilir: o zaman başka hiçbirini görmez.

## On beş araç

| Araç | Rol |
|---|---|
| `whoami` | ajanın kim olduğu, hangi izinlerle, hangi ortamlarda |
| `list_bases`, `describe_base`, `describe_table` | yapıyı, açıklamalarını ve görünüşünü keşfetmek |
| `list_records`, `get_record`, `lookup_records` | okumak, filtrelemek, bir görüntüleme değerini çözümlemek |
| `create_record`, `update_record` | satır yazmak |
| `delete_record`, `restore_record` | bir satırı silmek — bunun için oluşturulmuş bir token'la — ve onu geri yüklemek |
| `propose_create_table`, `propose_add_field`, `get_proposal` | bir yapı değişikliği önermek |
| `propose_update_look` | bir tablonun ve seçeneklerinin rengini ve simgesini önermek |

## Renkler ve simgeler

Bir tablonun ve bir seçim listesinin her seçeneğinin, arayüzdeki gibi bir rengi ve bir simgesi
vardır. Ajan bunları öneri yaparak seçer:

- `propose_create_table`, tablo için `color` ve `icon` kabul eder;
- `propose_add_field`, bir `select` ya da `multi_select` alanının her seçeneğinde `color` ve `icon`
  kabul eder;
- `propose_update_look`, var olan bir tablonunkileri ve seçeneklerininkileri değiştirir: atlanan
  bir anahtar mevcut değeri korur, `null` onu siler.

`color`, `#rrggbb` biçiminde bir renktir. `icon`, arayüzün çizdiği [Lucide](https://lucide.dev/icons/)
simgelerinden birinin adıdır — `truck`, `circle-check`, `flame`…: aracın şeması bunları sıralar ve
bilinmeyen bir ad reddedilir. `describe_base` ve `describe_table` güncel görünüşü döndürür. Bir
alanın seçilecek bir simgesi yoktur: arayüz, türünün simgesini çizer.

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
- **Yapıyı — görünüşünü de — değiştirmez**: önerir. Öneri, veritabanının menüsündeki **Ajan önerileri…** içinde
  bekler; orada yapıyı yöneten bir kişi onu onaylar ya da reddeder; karar verilmezse 24 saat
  sonra süresi dolar.
- **Token'ını oluşturan kişiden asla daha fazla izne sahip olmaz**: token'ın izinleri o kişinin
  izinleriyle, ortam ortam kesiştirilir.
- Ajanlara görünmez olarak işaretlenmiş alanları ve MCP'ye kapalı veritabanlarını görmez.

Her çağrı, parametrelerinin değerleriyle değil, yalnızca biçimleriyle günlüğe kaydedilir.
