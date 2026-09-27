---
title: Installation
description: basedb mit Docker Compose installieren oder den Entwicklungs-Stack starten.
---

basedb steckt in **einem einzigen Docker-Image**, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb)
(amd64 und arm64): die **Oberfläche**, die **API** und der **MCP-Server**, bereitgestellt unter einer
einzigen Adresse. Es benötigt eine **PostgreSQL-16**-Datenbank, die die `docker-compose.yml` mitbringt.

## Mit Docker Compose (empfohlen)

Voraussetzung: Docker mit Compose v2. Zwei Dateien genügen, der Quellcode wird nicht benötigt:

```bash
mkdir basedb && cd basedb
curl -fsSLO https://raw.githubusercontent.com/eodia/basedb/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/eodia/basedb/main/.env.example -o .env
```

Öffnen Sie `.env` und tragen Sie die beiden einzigen Pflichtwerte ein:

```bash
POSTGRES_PASSWORD=un-mot-de-passe-solide
# einmalig erzeugt: openssl rand -base64 32
BASEDB_ENCRYPTION_KEY=…
```

Starten Sie dann:

```bash
docker compose up -d
```

Beim ersten Start legt basedb den Katalog an. Öffnen Sie anschließend
[http://localhost:3000](http://localhost:3000): Die erste Seite fordert Sie auf, **das
Administratorkonto anzulegen**, mit Ihrem Namen, Ihrer Adresse und einem Passwort Ihrer Wahl, und
Sie sind direkt danach angemeldet.

:::caution[Der erste Besuch legt den Administrator an]
Solange kein Administrator existiert, legt ihn die erste Person an, die die Oberfläche öffnet.
Legen Sie ihn also an, **bevor** die Instanz für andere erreichbar wird – über eine Domain oder
über einen Port, der auf allen Schnittstellen veröffentlicht ist.
:::

Für eine Installation ohne Eingriff benennen Sie den Administrator in `.env` mit
`BASEDB_ADMIN_EMAIL`: basedb legt ihn beim ersten Start an und zeigt sein Passwort **ein
einziges Mal** in seinen Logs an (`docker compose logs basedb`), es sei denn, Sie legen es
mit `BASEDB_ADMIN_PASSWORD` fest.

| Adresse | Rolle |
|---|---|
| http://localhost:3000 | die Oberfläche |
| http://localhost:3000/api | die REST-API und ihre Dokumentation |
| http://localhost:3000/mcp | der MCP-Server für Agenten |
| localhost:5432 | PostgreSQL, für `psql` und Ihre Werkzeuge |

Die Ports werden nur auf `127.0.0.1` veröffentlicht. Um basedb unter einer Domain bereitzustellen,
siehe [Domain und HTTPS](/basedb/de/hebergement/https/).

## Mit Ihrem eigenen PostgreSQL

Das Image allein genügt, zusammen mit einer PostgreSQL-Datenbank ab Version 16 (Rolle als
Eigentümer der Datenbank, Erweiterungen `pg_trgm` und `unaccent` verfügbar):

```bash
docker run -d --name basedb -p 3000:3000 -v basedb-files:/data \
  -e DATABASE_URL=postgres://basedb:secret@db.example.com:5432/basedb \
  -e BASEDB_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  eodia/basedb
```

Bewahren Sie den erzeugten Schlüssel auf: siehe den Hinweis unten.

:::caution[Der Instanzschlüssel]
`BASEDB_ENCRYPTION_KEY` signiert die Sitzungen und verschlüsselt die gespeicherten Geheimnisse
(KI-Schlüssel, Webhook-Geheimnisse, Formular-Links). Wer ihn ändert, meldet alle ab und macht
diese Geheimnisse unlesbar. Erzeugen Sie ihn einmal und sichern Sie ihn zusammen mit der Datenbank.
:::

## Für die Entwicklung

Voraussetzungen: Node 22 oder neuer, Docker und `corepack enable`.

```bash
corepack pnpm install
corepack pnpm exec tsc -b packages/naming packages/contracts packages/catalog-schema packages/core apps/api apps/mcp
corepack pnpm start
```

`pnpm start` wählt freie Ports, startet ein Wegwerf-PostgreSQL 16, spielt den Katalog ein,
legt einen Entwicklungsadministrator an (`admin@basedb.local` / `developpement-basedb`,
Adresse bei der Anmeldung vorausgefüllt) und startet dann API, MCP-Server und Oberfläche im
Entwicklungsmodus. `Ctrl+C` beendet alles, den Container eingeschlossen.

## Und dann?

- [Erste Schritte](/basedb/de/guides/premiers-pas/): eine Datenbank, eine Tabelle, eine Ansicht, ein Formular.
- [Umgebungsvariablen](/basedb/de/hebergement/variables/): Dateien, KI, Adressen.
