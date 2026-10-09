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
| `BASEDB_BASE_PATH` | der Pfad von `BASEDB_PUBLIC_URL` | der Pfad, unter dem basedb hinter einem Gateway bereitgestellt wird, `/basedb` für `https://passerelle.example.com/basedb/`; siehe [Docker Compose](/basedb/de/hebergement/docker/#hinter-einem-gateway-unter-einem-pfad) |
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

## E-Mails

Ohne E-Mail-Versand verschickt basedb keine E-Mail. Mit ihm gehen die Benachrichtigungen
hinaus, die zehn Minuten lang ungelesen geblieben sind (jede Person wählt in
**Einstellungen › Benachrichtigungen**, welche), die E-Mails des Automatisierungsschritts
**E-Mail senden**, und der Link für **Passwort vergessen**. Die Links zeigen auf
`BASEDB_PUBLIC_URL`; ohne sie trägt eine E-Mail keinen.

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | der SMTP-Server: der Ihres Mail-Anbieters oder eines Versanddienstes |
| `BASEDB_SMTP_PORT` | `587` | `465` für eine von Anfang an verschlüsselte Verbindung |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` bei Port 465) | `none` nur für ein Relais auf derselben Maschine: sonst ginge das Passwort im Klartext |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | die Kennung des Versandkontos, falls es eine verlangt |
| `BASEDB_MAIL_FROM` | — | mit `BASEDB_SMTP_HOST` erforderlich: der Absender, `basedb <no-reply@exemple.fr>` |

Beim Start sagt das Log, wie es steht: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Eine vom Server abgelehnte E-Mail wird 1, 5, 30, 120 und dann
360 Minuten später erneut versucht.

## Landkarten und Adressen

Die Ansicht **Landkarte** platziert eine Adresse mithilfe eines Geokodierungsdienstes:
standardmäßig dem von OpenStreetMap (Nominatim), einmal pro Adresse abgefragt, höchstens eine
Anfrage pro Sekunde, jede Antwort aufbewahrt. Die Kartengrundlage besteht aus **Kacheln**, die
der Browser jeder lesenden Person direkt lädt.

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | ein anderer Dienst, der dasselbe Protokoll spricht (ein eigener Nominatim); `off`: keiner, die Adressen verlassen die Instanz nicht, und nur Breiten- und Längengrad platzieren die Zeilen |
| `BASEDB_MAP_TILES` | die Kacheln von OpenStreetMap | ein anderer Kachel-Server, Muster `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | der Hinweis, den dieser Server verlangt, unten rechts auf der Karte |

Beim Start sagt das Log, welcher Dienst verwendet wird: `Géocodage : https://nominatim.openstreetmap.org.`

## PDF-Dokumente

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_PDF_FONTS` | die Noto-Schriften des Images | ein eigener, in den Container eingebundener Ordner, der `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic` enthält, und für Chinesisch, Japanisch und Koreanisch `NotoSansCJK-Regular.ttc` und `-Bold.ttc` |

## Datenbankvorlagen

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | der Katalog der öffentlichen Website | woher die Instanz die Vorlagen ihrer Galerie liest; `off`, um keine zu lesen (die eingebauten Vorlagen bleiben) – siehe [Vorlagen](/basedb/de/fonctionnalites/modeles/) |

## Künstliche Intelligenz

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_AI_PROVIDER` | – | `openai`, `anthropic`, `mistral` oder `openai_compatible` (Azure, ein Gateway, ein lokales Modell) |
| `BASEDB_AI_MODEL` | – | das Modell |
| `BASEDB_AI_API_KEY` | – | der Schlüssel (sonst `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`); optional bei `openai_compatible` |
| `BASEDB_AI_BASE_URL` | die Adresse des Anbieters | alles, was vor `/chat/completions` steht (`/messages` bei `anthropic`), Parameter eingeschlossen; Pflicht bei `openai_compatible` – siehe [Künstliche Intelligenz](/basedb/de/fonctionnalites/ia/#azure-ein-gateway-ein-lokales-modell) |
| `BASEDB_AI_HEADERS` | – | Header, die jedem Aufruf hinzugefügt werden, als JSON-Objekt: `{"api-key":"…"}` |
| `BASEDB_AI_PROVIDER_SSL_VERIFY` | `true` | `false`: Das TLS-Zertifikat des Anbieters wird nicht geprüft – ein internes Gateway mit selbstsigniertem Zertifikat; siehe [Künstliche Intelligenz](/basedb/de/fonctionnalites/ia/#azure-ein-gateway-ein-lokales-modell) |
| `BASEDB_AI_QUOTA` | `120` | interaktive Aufrufe pro Stunde und pro Arbeitsbereich |
| `BASEDB_AI_FIELD_QUOTA` | `300` | Berechnungen von KI-Feldern pro Stunde und pro Arbeitsbereich |
| `BASEDB_AI_WORKER` | `1` | `0`: keine Hintergrundberechnung in diesem Prozess |

## Webhooks ins interne Netzwerk

| Variable | Standard | Rolle |
|---|---|---|
| `BASEDB_WEBHOOK_ALLOW` | – | Ihre internen Server, durch Kommas getrennt: ein Name (`chat.intra.example.com`), eine Domain und ihre Subdomains (`*.intra.example.com`), eine Adresse oder ein Bereich (`10.12.0.0/16`) |

Webhooks, HTTP-Anfragen von Automatisierungen und synchronisierte Tabellen gehen nur an
öffentliche HTTPS-Adressen. Ein Ziel aus der Liste wird zusätzlich akzeptiert, unabhängig von
seiner Adresse, seinem Port und seinem Schema – HTTP eingeschlossen. Ein unlesbarer Eintrag
verhindert den Start. Siehe [Webhooks](/basedb/de/integrations/webhooks/#ziele).

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
