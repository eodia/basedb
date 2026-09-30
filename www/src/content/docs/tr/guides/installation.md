---
title: Kurulum
description: basedb'yi Docker Compose ile kurmak ya da geliştirme ortamını başlatmak.
---

basedb **tek bir Docker imajına** sığar: [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 ve arm64). **Arayüz**, **API** ve **MCP sunucusu** tek bir adresten sunulur. İmaj bir
**PostgreSQL 16** veritabanına ihtiyaç duyar; bunu `docker-compose.yml` sağlar.

## Docker Compose ile (önerilen)

Ön koşullar: Compose v2 ile Docker. İki dosya yeter, koda gerek yok:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

`.env` dosyasını açın ve yalnızca iki zorunlu değeri doldurun:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# bir kez ve kalıcı olarak üretilir: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Ardından başlatın:

```bash
docker compose up -d
```

İlk başlatmada basedb kataloğu oluşturur. Ardından
[http://localhost:3000](http://localhost:3000) adresini açın: ilk sayfa sizden adınız, e-posta
adresiniz ve seçtiğiniz şifreyle **yönetici hesabını oluşturmanızı** ister ve hemen ardından
oturumunuz açılır.

:::caution[İlk ziyaret yöneticiyi oluşturur]
Henüz hiçbir yönetici yokken arayüzü ilk açan kişi yöneticiyi oluşturur. Kurulumu
başkalarının erişimine açmadan — bir alan adında ya da tüm ağ arayüzlerinde yayımlanan bir
portla — **önce** yöneticiyi oluşturun.
:::

Müdahalesiz bir kurulum için yöneticiyi `.env` içinde `BASEDB_ADMIN_EMAIL` ile belirtin:
basedb onu ilk başlatmada oluşturur ve şifresini günlüklerinde (`docker compose logs basedb`)
**yalnızca bir kez** gösterir — şifreyi `BASEDB_ADMIN_PASSWORD` ile kendiniz belirlemediğiniz
sürece.

| Adres | Rol |
|---|---|
| http://localhost:3000 | arayüz |
| http://localhost:3000/api | REST API ve belgeleri |
| http://localhost:3000/mcp | ajanlar için MCP sunucusu |
| localhost:5432 | `psql` ve araçlarınız için PostgreSQL |

Portlar yalnızca `127.0.0.1` üzerinde yayımlanır. basedb'yi bir alan adında sunmak için bkz.
[Alan adı ve HTTPS](/basedb/tr/hebergement/https/).

## Kendi PostgreSQL'inizle

Yalnızca imaj yeterlidir; PostgreSQL 16 veya üstü bir veritabanıyla birlikte (veritabanının
sahibi olan bir rol, kullanılabilir `pg_trgm` ve `unaccent` uzantıları):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Üretilen anahtarı saklayın: aşağıdaki kutuya bakın.

:::caution[Kurulum anahtarı]
`BASEDB_ENCRYPTION_KEY` oturumları imzalar ve kayıtlı gizli bilgileri şifreler (yapay zeka
anahtarları, webhook sırları, otomasyonların gizli üst bilgileri, form bağlantıları). Onu
değiştirmek herkesin oturumunu kapatır ve bu gizli bilgileri okunamaz hâle getirir. Bir kez
üretin, veritabanıyla birlikte yedekleyin.
:::

## Geliştirme için

Ön koşullar: Node 22 veya üstü, Docker ve `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` boş portları seçer, geçici bir PostgreSQL 16 başlatır, kataloğu uygular, bir
geliştirme yöneticisi oluşturur (`admin@basedb.local` / `developpement-basedb`, adresi giriş
ekranında önceden doldurulmuş), ardından API'yi, MCP sunucusunu ve arayüzü geliştirme modunda
başlatır. `Ctrl+C` konteyner dahil her şeyi durdurur.

## Sırada ne var?

- [İlk adımlar](/basedb/tr/guides/premiers-pas/): bir veritabanı, bir tablo, bir görünüm, bir form.
- [Ortam değişkenleri](/basedb/tr/hebergement/variables/): dosyalar, yapay zeka, adresler.
