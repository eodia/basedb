---
title: Ortam değişkenleri
description: basedb'nin okuduğu tüm değişkenler ve varsayılan değerleri.
---

Hepsi, `docker compose`'un okuduğu ve `docker-compose.yml` dosyasının yanında duran `.env`
dosyasına yazılır (eksiksiz ve açıklamalı şablon `.env.example` dosyasıdır). `docker run` ile bunları `-e` ile geçirin. **Boş bir değer “tanımsız” sayılır.**

## Zorunlu

| Değişken | Rol |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL konteynerinin şifresi |
| `BASEDB_ENCRYPTION_KEY` | kurulum anahtarı: oturumları imzalar, gizli bilgileri şifreler. `openssl rand -base64 32`, bir kez ve kalıcı olarak |

## Veritabanı

| Değişken | Varsayılan | Rol |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL rolü |
| `POSTGRES_DB` | `basedb` | PostgreSQL veritabanı |
| `POSTGRES_PORT` | `5432` | 127.0.0.1 üzerinde yayımlanan port |
| `DATABASE_URL` | `db` konteyneri | size ait bir PostgreSQL 16+ veritabanı |

## İlk başlatma

| Değişken | Varsayılan | Rol |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | boş bir veritabanında kataloğu uygular |
| `BASEDB_BOOTSTRAP` | `1` | ilk yöneticiyi hazırlar |
| `BASEDB_TENANT` | `t4z56fq` | API URL'lerindeki çalışma alanı (tenant) referansı |
| `BASEDB_ADMIN_EMAIL` | — | başlangıçta oluşturulan ilk yöneticinin adresi; boşsa arayüzü ilk açan kişi yöneticiyi oluşturur |
| `BASEDB_ADMIN_PASSWORD` | üretilir, bir kez gösterilir | `BASEDB_ADMIN_EMAIL` ile birlikte yöneticinin şifresi; tanımlıysa **her** başlatmada yöneticiye yeniden uygulanır: giriş yaptıktan sonra kaldırın |

## Google, Microsoft… ile giriş (OIDC)

| Değişken | Varsayılan | Rol |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | sunulan sağlayıcılar, virgülle ayrılmış: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | sağlayıcıda kayıtlı uygulama |
| `BASEDB_OIDC_<NOM>_ISSUER` | `google`, `gitlab` için bilinen değer | OpenID Connect yayımlayıcısı |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | sağlayıcıya göre | düğmenin adı, istenen kapsamlar |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: ilk giriş hesap oluşturmaz |

Bkz. [Hesaplar ve giriş](/basedb/tr/hebergement/connexion/).

## Adresler

| Değişken | Varsayılan | Rol |
|---|---|---|
| `BASEDB_PORT` | `3000` | 127.0.0.1 üzerinde yayımlanan port: arayüz, `/api` ve `/mcp` |
| `BASEDB_VERSION` | `latest` | `eodia/basedb` imajının etiketi |
| `BASEDB_PUBLIC_URL` | — | OIDC dönüşü için basedb'nin herkese açık adresi |
| `BASEDB_DOMAIN` | — | Caddy proxy'sinin HTTPS ile sunduğu alan adı |
| `BASEDB_ORIGINS` | — | sayfaları API'yi tarayıcıdan çağıran diğer siteler, virgülle ayrılmış; aynı adresten sunulan basedb arayüzü için gerekmez |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | tarayıcıdan görüldüğü hâliyle API ve MCP; yalnızca geliştirme ortamı (`pnpm start`) için ayarlanır |

## Dosyalar

| Değişken | Varsayılan | Rol |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | bir dosyanın azami boyutu |
| `BASEDB_S3_BUCKET` | — | S3 depolamasını etkinleştirir |
| `BASEDB_S3_ENDPOINT` | — | S3 uç noktası |
| `BASEDB_S3_REGION` | `us-east-1` | bölge |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | kimlik bilgileri |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | ana makine tabanlı adresleme için `0` |

## Veritabanı şablonları

| Değişken | Varsayılan | Rol |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | herkese açık sitenin kataloğu | kurulumun galerisindeki şablonları nereden okuduğu; hiçbirini okumamak için `off` (gömülü şablonlar kalır) — bkz. [Şablonlar](/basedb/tr/fonctionnalites/modeles/) |

## Yapay zeka

| Değişken | Varsayılan | Rol |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` ya da `mistral` |
| `BASEDB_AI_MODEL` | — | model |
| `BASEDB_AI_API_KEY` | — | anahtar (yoksa `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | saat ve çalışma alanı başına etkileşimli çağrılar |
| `BASEDB_AI_FIELD_QUOTA` | `300` | saat ve çalışma alanı başına yapay zeka alanı hesaplamaları |
| `BASEDB_AI_WORKER` | `1` | `0`: bu süreçte arka plan hesaplaması yapılmaz |

## Herkese açık demo

[demo.basedb.eodia.com](https://demo.basedb.eodia.com) gibi herkese açık bir kurulumda: giriş
ekranı paylaşılan bir hesabı önceden doldurur, ziyaretçi her şeyi okur ve var olanı değiştirir,
ama hiçbir şey oluşturmaz ya da silmez — veritabanı, tablo, satır, dosya, yorum, hesap, jeton,
bağlantı —, ve yapay zeka demonun bir parçası olmadığını yanıtlar. SQL konsolu orada yalnızca
okur. Veritabanını her gece eski hâline getirmek size kalır.

| Değişken | Varsayılan | Rol |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: kurulum herkese açık bir demoya dönüşür |
| `BASEDB_DEMO_ACCOUNTS` | — | dil başına bir hesap, virgülle ayrılmış: `fr=demo@demo.com,en=demo-en@demo.com`; giriş ekranı kendi dilindekini, yoksa İngilizceyi, yoksa ilkini önceden doldurur ve diğerlerini önerir. Demoyu etkinleştirmeden önce bu hesapları, her birini kendi projesiyle birlikte oluşturun: demo, yönetici dahil herkes için oluşturmaları reddeder |
| `BASEDB_DEMO_PASSWORD` | — | `BASEDB_DEMO_ACCOUNTS` ile birlikte, hepsi için aynı olan ve onlarla birlikte yayımlanan şifreleri |

`BASEDB_DEMO_ACCOUNTS` olmadan, paylaşılan hesap `BASEDB_ADMIN_EMAIL` ve
`BASEDB_ADMIN_PASSWORD`'ün adlandırdığı yöneticidir. Demonun bir adresi, ne yazılırsa yazılsın,
yayımlanan şifreyle giriş yapar: yanlış denemeler onu herkes için kilitlemez.

## Yalnızca geliştirme

| Değişken | Rol |
|---|---|
| `BASEDB_DEV_MAIL=1` | e-postaları göndermek yerine günlüklerde gösterir |
| `BASEDB_WEBHOOK_DEV=1` | HTTP'ye ve yerel adreslere giden webhook'lara izin verir |
