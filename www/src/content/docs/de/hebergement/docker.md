---
title: Docker Compose
description: Das Image, die Dienste, die Volumes und der laufende Betrieb.
---

basedb wird als **ein einziges Image** veröffentlicht, [`eodia/basedb`](https://hub.docker.com/r/eodia/basedb),
für amd64 und arm64. Die `docker-compose.yml` des Repositorys kombiniert es mit PostgreSQL. Die
gesamte Konfiguration läuft über eine Datei `.env` (siehe
[Umgebungsvariablen](/basedb/de/hebergement/variables/)).

## Das Image

Es enthält die drei Prozesse von basedb und stellt sie über **einen einzigen Port, 3000** bereit:

| Pfad | Prozess |
|---|---|
| `/api/*`, `/auth/*`, `/healthz` | die REST-API, die Anmeldung, die Hintergrundarbeit |
| `/mcp` | der MCP-Server für Agenten |
| alles andere – `/`, `/f/…`, `/v/…` | die Oberfläche |

Beim Start kommt die API zuerst: Auf einer leeren Datenbank spielt sie den Katalog ein und legt den
ersten Administrator an; bei späteren Starts bleibt beides ohne Wirkung. Der MCP-Server startet,
sobald sie antwortet. Stoppt einer der Prozesse, stoppt der ganze Container, und die
Neustartrichtlinie startet ihn als Ganzes neu.

Das Image läuft unter dem Benutzer `node` auf Node 22, deklariert eine Integritätsprüfung
(`/healthz`) und ein Volume, `/data`, für die Dateien der Felder Datei und Bild.

| Tag | Inhalt |
|---|---|
| `latest` | die zuletzt veröffentlichte Version |
| `0.5` | die neueste Version 0.5.x |
| `0.5.1` | genau diese Version |

## Die Dienste

| Dienst | Image | Port (auf 127.0.0.1) | Volume |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | `db-data` |
| `basedb` | `eodia/basedb` | 3000 | `files` → `/data` |
| `proxy` (optional) | `caddy:2-alpine` | 80, 443 | `caddy-data`, `caddy-config` |

## Nützliche Befehle

```bash
docker compose up -d                # Image herunterladen und starten
docker compose logs -f basedb       # basedb verfolgen (Admin-Passwort beim 1. Start)
docker compose ps                   # Status und Zustand der Dienste
docker compose restart basedb       # basedb neu starten
docker compose down                 # stoppen (die Volumes bleiben)
```

Aus einem Klon des Repositorys baut `docker compose up -d --build` das Image aus dem Quellcode,
statt es herunterzuladen.

## Hinter einem Gateway, unter einem Pfad

Wenn basedb unter einem Pfad veröffentlicht wird – `https://passerelle.example.com/basedb/` statt
an der Wurzel einer Domain –, geben Sie diesen Pfad an:

```bash
BASEDB_PUBLIC_URL=https://passerelle.example.com/basedb
# oder, ohne öffentliche Adresse:
BASEDB_BASE_PATH=/basedb
```

Alles läuft dann unter `/basedb`: die Oberfläche, `/basedb/api`, `/basedb/mcp`, die Freigabelinks
und die der E-Mails. Das Gateway kann **den Pfad beibehalten**, indem es die Anfrage weiterleitet,
oder ihn **entfernen**: basedb akzeptiert beides. `BASEDB_BASE_PATH=/` erzwingt die Wurzel.

Das Image ist für alle Adressen dasselbe: Der Pfad wird beim Start des Containers in die
Oberfläche geschrieben, und ein Pfadwechsel erfordert nur einen Neustart.

## Die Ports ändern

```bash
BASEDB_PORT=3100
POSTGRES_PORT=5433
```

## Eine bestehende PostgreSQL-Datenbank

Setzen Sie `DATABASE_URL`: basedb verbindet sich dann damit statt mit dem Container `db` (der
trotzdem startet, ungenutzt – entfernen Sie ihn per `docker-compose.override.yml`, wenn Ihnen das
lieber ist). Erforderlich sind PostgreSQL 16 oder neuer, eine Rolle als Eigentümer der Datenbank
und die verfügbaren Erweiterungen `pg_trgm` und `unaccent`. Das Image allein genügt dann – siehe
[Installation](/basedb/de/guides/installation/).
