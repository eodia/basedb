---
title: TypeScript SDK
description: basedb satırlarını TypeScript'ten okumak ve yazmak, kurulumunuzdan üretilen tablolarınızın türleriyle.
---

**@basedb/sdk** paketi, TypeScript ya da JavaScript'ten [REST API](/basedb/tr/integrations/api-rest/)'yi
çağırır: türlü satırlar, tüm sayfalar, dosyalar, kodlarıyla birlikte reddedilenler. Hiçbir
bağımlılık yok: standart `fetch`, Node 18 ve sonrasında, Deno, Bun ya da bir tarayıcıda.

```bash
npm install @basedb/sdk
```

## Tablolarınızın türleri

Bir komut, veritabanlarınızın açıklamasını okur ve türlerini programınızın bir dosyasına yazar:

```bash
BASEDB_URL=https://basedb.exemple.fr BASEDB_TOKEN=bdb_… npx @basedb/sdk types --out src/basedb.ts
```

Token'ın açtığı her veritabanı — ya da tekrarlanan `--base` ile adlandırılanlar — ve her tablo
için üç biçim: basedb'nin **okuduğu** hâliyle satır, **oluşturulan** hâliyle, **değiştirilen**
hâliyle. Bir tekli seçim, değerlerinin birleşimine dönüşür; basedb'nin hesapladığı bir alan —
formül, arama, toplama, sayım, otomatik numara — yazılmadan okunur; varsayılan değeri olmayan
zorunlu bir alan oluşturmada istenir. Tablolar değiştiğinde komutu yeniden çalıştırın.

## Okumak ve yazmak

```ts
import { Basedb, BasedbError, filter } from '@basedb/sdk'
import type { Schema } from './basedb.js'

const db = new Basedb<Schema>({ url: 'https://basedb.exemple.fr', token: process.env.BASEDB_TOKEN! })
const opportunites = db.base('b_t4z56fq_ventes').table('opportunites')

const o = await opportunites.create({ titre: 'Audit', montant: 12500, statut: 'nouveau' })
await opportunites.update(o._id, { statut: 'gagne' })

for await (const ligne of opportunites.all({
  filter: filter`statut eq ${'gagne'} and montant gte ${10000}`,
  sort: '-montant',
})) {
  console.log(ligne.titre, ligne.montant)
}
```

Var olmayan bir tablo, alan ya da seçim, program çalışmadan önce bile bir **tür hatasıdır**.

| Metot | Rol |
|---|---|
| `list(options)` | bir sayfa, ve sonraki için `next` |
| `all(options)` | bir filtrenin tüm satırları, sayfa sayfa, okundukları anda |
| `first(options)`, `count(filtre)` | ilk satır, satır sayısı |
| `get(id)` | bir satır |
| `create(valeurs)`, `createMany(lignes)` | bir satır eklemek; birden çoğunu, tümünü ya da hiçbirini |
| `update(id, valeurs)` | alanları değiştirmek; eksik bir alan olduğu gibi kalır, `null` onu boşaltır |
| `aggregate({ aggregates, filter, group })` | bir filtrenin tüm satırları üzerinde toplamlar, ortalamalar, sayımlar |
| `comments(id).list()`, `.add(texte)` | bir satırın yorumları; bir @bahsetme haber verir |
| `upload(champ, octets, { name, type })` | bir dosya yüklemek, satırın ardından `id`'siyle atıf yaptığı |
| `db.undo(ligne)` | bu satırı oluşturan yazmayı geri almak — o zamandan beri değiştiyse reddedilir |

- **`filter`**, eklenen her değeri bir değer olarak yazar: bir kullanıcının yazdığı bir metin
  bir metin olarak kalır, asla filtrenin bir parçası olmaz.
- **Sayılar** ondalık metin olarak okunur (`"12500.0000000000"`), hiçbir hane kaybolmasın diye;
  sayı ya da metin olarak yazılır.
- Bir **ilişki** `{ id, display }` olarak okunur ve bağlı satırın `_id`'siyle yazılır; `links:
  'id'` yalnızca `_id`'yi okur.
- Bir **reddediliş**, bir `BasedbError`'dur: `code`'u — kararlı, neden başına bir tane, tüm
  dillerde aynı —, `status`'ü, `details`'i ve `requestId`'si. Bir yavaşlama isteği (`429`)
  basedb'nin belirttiği süre sonra yeniden denenir.

## Token

Bir **entegrasyon token'ı** arayüzde oluşturulur: veritabanının **⋯** menüsü → **API ve
ajanlar** → **API ve MCP token'ları…**. Bir veritabanını açar, satırlarını okur, yazma
yetkisiyle oluşturulduysa yazar, onu oluşturan kişiden asla daha fazla izne sahip olmaz ve
**yalnızca bunun için oluşturulduysa siler** (“Okuma, yazma ve silme”): aksi hâlde `delete()`
reddedilir.
