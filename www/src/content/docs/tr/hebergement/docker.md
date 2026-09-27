---
title: Docker Compose
description: İmaj, servisler, birimler ve günlük işletim.
---

basedb, amd64 ve arm64 için **tek bir imaj** olarak yayımlanır:
[`eodia/basedb`](https://hub.docker.com/r/eodia/basedb). Deponun `docker-compose.yml` dosyası
onu PostgreSQL ile bir araya getirir. Tüm yapılandırma bir `.env` dosyası üzerinden yapılır
(bkz. [Ortam değişkenleri](/basedb/tr/hebergement/variables/)).

## İmaj

İmaj, basedb'nin üç sürecini içerir ve onları **tek bir port, 3000** üzerinden sunar:

| Yol | Süreç |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | REST API, giriş, arka plan işleri |
| `/mcp` | ajanlar için MCP sunucusu |
| geri kalan her şey — `/`, `/f/…`, `/v/…` | arayüz |

Başlangıçta önce API çalışır: boş bir veritabanında kataloğu uygular ve ilk yöneticiyi
oluşturur; sonraki başlatmalarda bu iki işlemin hiçbir etkisi olmaz. MCP sunucusu, API yanıt
verir vermez başlar. Süreçlerden biri durursa konteynerin tamamı durur ve yeniden başlatma
politikası onu bütünüyle yeniden başlatır.

İmaj `node` kullanıcısıyla, Node 22 üzerinde çalışır; bir sağlık denetimi (`/healthz`) ve Dosya
ile Görsel alanlarının dosyaları için bir birim, `/data`, tanımlar.

| Etiket | İçerik |
|---|---|
| `latest` | yayımlanan son sürüm |
| `0.3` | son 0.3.x sürümü |
| `0.3.1` | tam olarak bu sürüm |

## Servisler

| Servis | İmaj | Port (127.0.0.1 üzerinde) | Birim |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (isteğe bağlı) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Yararlı komutlar

```bash
docker compose up -d                # imajı indir ve başlat
docker compose logs -f basedb       # basedb'yi izle (1. başlatmada yönetici şifresi)
docker compose ps                   # servislerin durumu ve sağlığı
docker compose restart basedb       # basedb'yi yeniden başlat
docker compose down                 # durdur (birimler kalır)
```

Deponun bir klonundan `docker compose up -d --build`, imajı indirmek yerine koddan derler.

## Portları değiştirme

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Var olan bir PostgreSQL veritabanı

`DATABASE_URL` tanımlayın: basedb, `db` konteyneri yerine ona bağlanır (`db` yine de başlar ama
kullanılmaz — isterseniz onu bir `docker-compose.override.yml` dosyasıyla kaldırın). PostgreSQL
16 veya üstü, veritabanının sahibi olan bir rol ve kullanılabilir `pg_trgm` ve `unaccent`
uzantıları gerekir. Bu durumda yalnızca imaj yeterlidir — bkz.
[Kurulum](/basedb/tr/guides/installation/).
