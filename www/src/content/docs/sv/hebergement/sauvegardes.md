---
title: Säkerhetskopior och uppdateringar
description: Säkerhetskopiera, återställa och uppdatera en basedb-instans.
---

Hela basedbs tillstånd ryms i tre saker: **PostgreSQL-databasen**, **filerna** i fälten Fil och
Bild, och **instansnyckeln**. Säkerhetskopiera alla tre.

## Databasen

En basedb-instans är en vanlig PostgreSQL-databas: `pg_dump` räcker.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

För att återställa, till en tom databas:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Filerna

Med lagring på disk ligger de i volymen `files` för tjänsten `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Med S3-lagring följer du din leverantörs policy för säkerhetskopiering (versionshantering,
replikering).

## Instansnyckeln

`BASEDB_ENCRYPTION_KEY` krypterar de hemligheter som sparats i databasen (AI-nycklar,
webhook-hemligheter, formulärlänkar). **En säkerhetskopia av databasen utan dess nyckel
återställer inte de hemligheterna.** Förvara den i din hemlighetshanterare, bredvid
säkerhetskopiorna.

## Uppdatera

Säkerhetskopiera först databasen, och sedan:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` låser en viss version (`0.3.2`) i stället för den senaste (`latest`).

Vid start **uppdaterar basedb sin katalog själv**: den tillämpar, i ordning och var och en i sin
egen transaktion, de migreringar som din version ännu inte har, och registrerar dem i
`_basedb.catalog_migration`. Dina data ligger kvar. Loggen visar det:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Du kan hoppa över versioner: alla migreringar som saknas körs på en gång, i ordning. En
migrering som misslyckas lämnar katalogen i den tidigare versionen, orörd, och basedb startar
inte: loggen namnger migreringen och felet.

**Ingen återgång.** En äldre version vägrar att starta på en katalog som en nyare version har
uppdaterat, i stället för att skriva i en form som den inte känner till. För att gå tillbaka
återställer du säkerhetskopian som gjordes före uppdateringen.

Med flera basedb-instanser mot samma databas uppdaterar bara en av dem katalogen, och de andra
väntar på den. `BASEDB_MIGRATE=0` hindrar en instans från att migrera: den kontrollerar bara att
katalogen har rätt version, och vägrar annars att starta.
