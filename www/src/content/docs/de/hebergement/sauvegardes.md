---
title: Backups und Updates
description: Eine basedb-Instanz sichern, wiederherstellen und aktualisieren.
---

Der gesamte Zustand von basedb besteht aus drei Dingen: **der PostgreSQL-Datenbank**, **den Dateien**
der Felder Datei und Bild und **dem Instanzschlüssel**. Sichern Sie alle drei.

## Die Datenbank

Eine basedb-Instanz ist eine gewöhnliche PostgreSQL-Datenbank: `pg_dump` genügt.

```bash
docker compose exec -T db pg_dump -U basedb -Fc basedb > basedb-$(date +%F).dump
```

Zum Wiederherstellen, in eine leere Datenbank:

```bash
docker compose exec -T db pg_restore -U basedb -d basedb --clean --if-exists < basedb-2026-09-26.dump
```

## Die Dateien

Beim Speichern auf der Festplatte liegen sie im Volume `files` des Dienstes `basedb`:

```bash
docker run --rm -v basedb_files:/data -v "$PWD":/backup alpine \
  tar czf /backup/basedb-files-$(date +%F).tgz -C /data .
```

Bei einem S3-Speicher folgen Sie der Backup-Richtlinie Ihres Anbieters (Versionierung,
Replikation).

## Der Instanzschlüssel

`BASEDB_ENCRYPTION_KEY` verschlüsselt die in der Datenbank gespeicherten Geheimnisse (KI-Schlüssel,
Webhook-Geheimnisse, geheime Header von Automatisierungen, Formular-Links). **Ein Backup der Datenbank ohne ihren Schlüssel stellt diese
Geheimnisse nicht wieder her.** Bewahren Sie ihn in Ihrem Secret-Manager auf, neben den Backups.

## Aktualisieren

Sichern Sie zuerst die Datenbank, dann:

```bash
docker compose pull
docker compose up -d
```

`BASEDB_VERSION` legt eine bestimmte Version fest (`0.7.0`) statt der neuesten (`latest`).

Beim Start **aktualisiert basedb seinen Katalog selbst**: Es wendet der Reihe nach, jede in ihrer
eigenen Transaktion, die Migrationen an, die Ihrer Version noch fehlen, und trägt sie in
`_basedb.catalog_migration` ein. Ihre Daten bleiben an ihrem Platz. Das Log sagt es:

```text
basedb-1  | [api] Catalogue : 0002_partage_et_comptes.sql appliquée (84 ms).
basedb-1  | [api] Catalogue mis à jour : version 2.
```

Versionen lassen sich überspringen: Alle fehlenden Migrationen laufen auf einmal durch, der Reihe
nach. Eine fehlgeschlagene Migration lässt den Katalog unversehrt auf der vorherigen Version, und
basedb startet nicht: Das Log nennt die Migration und den Fehler.

**Kein Zurück.** Eine ältere Version verweigert den Start auf einem Katalog, den eine neuere
aktualisiert hat, statt in einer Form zu schreiben, die sie nicht kennt. Um zurückzugehen, stellen
Sie das vor dem Update angelegte Backup wieder her.

Laufen mehrere basedb-Instanzen auf derselben Datenbank, aktualisiert nur eine den Katalog, die
anderen warten auf sie. `BASEDB_MIGRATE=0` hindert eine Instanz am Migrieren: Sie prüft nur, ob der
Katalog die richtige Version hat, und verweigert sonst den Start.
