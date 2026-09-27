---
title: Umgebungsvariablen
description: Alle Variablen, die basedb liest, und ihr Standardwert.
---

Alle gehören in die Datei `.env` neben `docker-compose.yml`, die `docker compose` liest (die
vollständige, kommentierte Vorlage ist `.env.example`). Mit `docker run` übergeben Sie sie per `-e`. **Ein leerer Wert gilt als „nicht gesetzt“.**

## Erforderlich

| Variable | Rolle |
|---|---|
| `POSTGRES_PASSWORD` | Passwort des PostgreSQL-Containers |
| `BASEDB_ENCRYPTION_KEY` | Instanzschlüssel: signiert die Sitzungen, verschlüsselt die Geheimnisse. `openssl rand -base64 32`, ein für alle Mal |

## Datenbank

| Variable | Standard | Rolle |
|---|---|---|
| `POSTGRES_USER` | `basedb` | PostgreSQL-Rolle |
| `POSTGRES_DB` | `basedb` | PostgreSQL-Datenbank |
| `POSTGRES_PORT` | `5432` | auf 127.0.0.1 veröffentlichter Port |
| `DATABASE_URL` | der Container `db` | eine eigene PostgreSQL-Datenbank ab Version 16 |

## Erster Start

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | spielt den Katalog auf einer leeren Datenbank ein |
| `BASEDB_BOOTSTRAP` | `1` | bereitet den ersten Administrator vor |
| `BASEDB_TENANT` | `t4z56fq` | Kennung des Arbeitsbereichs (Tenant) in den URLs der API |
| `BASEDB_ADMIN_EMAIL` | – | Adresse des ersten Administrators, beim Start angelegt; leer gelassen, legt ihn die erste Person an, die die Oberfläche öffnet |
| `BASEDB_ADMIN_PASSWORD` | erzeugt, einmal angezeigt | zusammen mit `BASEDB_ADMIN_EMAIL` dessen Passwort; ist es gesetzt, wird es dem Administrator bei **jedem** Start erneut zugewiesen: nach der ersten Anmeldung entfernen |

## Anmeldung mit Google, Microsoft … (OIDC)

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | – | die angebotenen Anbieter, durch Kommas getrennt: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | – | die beim Anbieter registrierte Anwendung |
| `BASEDB_OIDC_<NOM>_ISSUER` | der von `google`, `gitlab` | der OpenID-Connect-Aussteller |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | je nach Anbieter | die Beschriftung der Schaltfläche, die angeforderten Scopes |
| `BASEDB_OIDC_<NOM>_SIGNUP` | – | `off`: Eine erste Anmeldung legt kein Konto an |

Siehe [Konten und Anmeldung](/basedb/de/hebergement/connexion/).

## Adressen

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_PORT` | `3000` | auf 127.0.0.1 veröffentlichter Port: die Oberfläche, `/api` und `/mcp` |
| `BASEDB_VERSION` | `latest` | das Tag des Images `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | – | öffentliche Adresse von basedb, für die OIDC-Rückleitung |
| `BASEDB_DOMAIN` | – | die Domain, die der Caddy-Proxy über HTTPS bereitstellt |
| `BASEDB_ORIGINS` | – | andere Websites, deren Seiten die API aus dem Browser aufrufen, durch Kommas getrennt; für die Oberfläche von basedb, die unter derselben Adresse läuft, nicht nötig |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API und MCP aus Sicht des Browsers; nur für den Entwicklungs-Stack (`pnpm start`) einzustellen |

## Dateien

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | maximale Größe einer Datei |
| `BASEDB_S3_BUCKET` | – | aktiviert den S3-Speicher |
| `BASEDB_S3_ENDPOINT` | – | S3-Endpunkt |
| `BASEDB_S3_REGION` | `us-east-1` | Region |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | – | Zugangsdaten |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` für die Adressierung über den Hostnamen |

## Datenbankvorlagen

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | der Katalog der öffentlichen Website | woher die Instanz die Vorlagen ihrer Galerie liest; `off`, um keine zu lesen (die eingebauten Vorlagen bleiben) – siehe [Vorlagen](/basedb/de/fonctionnalites/modeles/) |

## Künstliche Intelligenz

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic` oder `mistral` |
| `BASEDB_AI_MODEL` | – | das Modell |
| `BASEDB_AI_API_KEY` | – | der Schlüssel (sonst `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | interaktive Aufrufe pro Stunde und pro Arbeitsbereich |
| `BASEDB_AI_FIELD_QUOTA` | `300` | Berechnungen von KI-Feldern pro Stunde und pro Arbeitsbereich |
| `BASEDB_AI_WORKER` | `1` | `0`: keine Hintergrundberechnung in diesem Prozess |

## Öffentliche Demo

Eine für alle offene Instanz, wie [demo.basedb.eodia.com](https://demo.basedb.eodia.com): Der
Anmeldebildschirm füllt ein gemeinsames Konto vorab aus, die besuchende Person liest alles und
ändert, was existiert, legt aber nichts an und löscht nichts – Datenbank, Tabelle, Zeile, Datei,
Kommentar, Konto, Token, Link –, und die KI antwortet, dass sie nicht Teil der Demo ist. Die
SQL-Konsole liest dort nur. Die Datenbank jede Nacht zurückzusetzen bleibt Ihre Aufgabe.

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: Die Instanz wird zu einer öffentlichen Demo |
| `BASEDB_DEMO_ACCOUNTS` | — | ein Konto pro Sprache, durch Kommas getrennt: `fr=demo@demo.com,en=demo-en@demo.com`; der Anmeldebildschirm füllt das seiner Sprache vorab aus, sonst Englisch, sonst das erste, und bietet die anderen an. Legen Sie diese Konten an, jedes mit seinem Projekt, bevor Sie die Demo aktivieren: Sie verweigert allen das Anlegen, Administratoren eingeschlossen |
| `BASEDB_DEMO_PASSWORD` | — | zusammen mit `BASEDB_DEMO_ACCOUNTS` deren Passwort, für alle dasselbe, mit ihnen veröffentlicht |

Ohne `BASEDB_DEMO_ACCOUNTS` ist das gemeinsame Konto der Administrator, den `BASEDB_ADMIN_EMAIL`
und `BASEDB_ADMIN_PASSWORD` benennen. Eine Adresse der Demo meldet sich mit dem veröffentlichten
Passwort an, egal was eingegeben wird: Falsche Versuche sperren sie nicht für alle.

## Nur für die Entwicklung

| Variable | Rolle |
|---|---|
| `BASEDB_DEV_MAIL=1` | zeigt E-Mails in den Logs an, statt sie zu versenden |
| `BASEDB_WEBHOOK_DEV=1` | erlaubt Webhooks an HTTP und lokale Adressen |
