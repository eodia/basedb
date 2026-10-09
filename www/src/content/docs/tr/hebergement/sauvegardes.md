---
title: Yedeklemeler ve güncellemeler
description: Bir basedb kurulumunu yedeklemek, geri yüklemek ve güncellemek.
---

basedb'nin tüm durumu üç şeyde saklıdır: **PostgreSQL veritabanı**, Dosya ve Görsel
alanlarının **dosyaları** ve **kurulum anahtarı**. Üçünü de yedekleyin.

## Veritabanı

Bir basedb kurulumu sıradan bir PostgreSQL veritabanıdır: `pg_dump` yeterlidir.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Geri yüklemek için, boş bir veritabanında:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Dosyalar

Disk depolamasıyla dosyalar, `basedb` servisinin `files` biriminde bulunur:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

S3 depolamasıyla sağlayıcınızın yedekleme politikasını izleyin (sürümleme, çoğaltma).

## Kurulum anahtarı

`BASEDB_ENCRYPTION_KEY`, veritabanında kayıtlı gizli bilgileri şifreler (yapay zeka
anahtarları, webhook sırları, otomasyonların gizli üst bilgileri, form bağlantıları).
**Anahtarı olmadan veritabanının bir yedeği bu gizli bilgileri geri yüklemez.** Anahtarı gizli
bilgi yöneticinizde, yedeklerin yanında saklayın.

## Güncelleme

Önce veritabanını yedekleyin, ardından:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION`, en son sürüm (`latest`) yerine belirli bir sürümü (`0.7.1`) sabitler.

Başlangıçta basedb **kataloğunu kendiliğinden günceller**: sürümünüzde henüz bulunmayan
geçişleri sırayla, her birini kendi işlemi (transaction) içinde uygular ve
`_basedb.catalog_migration` içine kaydeder. Verileriniz yerinde kalır. Günlük bunu belirtir:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Sürüm atlanabilir: eksik geçişlerin hepsi sırayla, bir kerede uygulanır. Başarısız olan bir
geçiş, kataloğu önceki sürümünde bozulmadan bırakır ve basedb başlamaz: günlük, geçişi ve hatayı
adıyla belirtir.

**Geri dönüş yok.** Daha eski bir sürüm, bilmediği bir biçimde yazmak yerine, daha yeni bir
sürümün güncellediği bir katalog üzerinde başlamayı reddeder. Geri dönmek için güncellemeden
önce alınan yedeği geri yükleyin.

Aynı veritabanını kullanan birkaç basedb kurulumu varsa kataloğu yalnızca biri günceller,
diğerleri onu bekler. `BASEDB_MIGRATE=0` bir kurulumun geçiş yapmasını engeller: kurulum
yalnızca kataloğun doğru sürümde olup olmadığını denetler, değilse başlamayı reddeder.
