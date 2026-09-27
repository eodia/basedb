---
title: Prinzipien
description: Die Entscheidungen, die die Architektur von basedb bestimmen.
---

basedb wurde auf Grundlage eines **Architekturdokuments** entworfen – sechzehn Kapitel, im Repository
unter [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Sein
Kapitel 00 legt fünfundzwanzig Entscheidungen fest; hier ihr Geist.

## Die Daten sind Tabellen, kein Format

Eine Benutzerdatenbank ist ein PostgreSQL-**Schema**, eine Tabelle ist eine Tabelle, ein Feld ist
eine typisierte Spalte **mit lesbarem Namen**. Kein EAV (Entity-Attribute-Value), kein JSON-Dokument
als Sammelbecken, kein undurchsichtiger Name. Der Katalog `_basedb` beschreibt diese Objekte; er
ersetzt sie nicht.

Gewollte Folge: Direktes SQL ist eine **legitime** Nutzung. Die Constraints liegen in der Datenbank,
der Verlauf wird per Trigger erfasst – nichts setzt voraus, dass der Schreibvorgang über die
Anwendung läuft.

## Ein einziger Entscheidungspunkt für Berechtigungen

Die Oberfläche, die REST-API, der MCP-Server, die freigegebenen Formulare, die Webhooks: Alles läuft
über **denselben Durchsetzungspunkt** für Berechtigungen im Kern. Die Oberfläche ist ein
API-Konsument wie jeder andere – keine private Route, kein Service-Token. Eine Ressource, die man
nicht sehen darf, antwortet genau wie eine Ressource, die nicht existiert.

## Der Kern entscheidet, die Adapter übersetzen

Ein TypeScript-Monorepo: `@basedb/core` trägt die gesamte Logik (Katalog, DDL-Engine,
Berechtigungen, Datensätze, Verlauf); `apps/api` (Hono), `apps/mcp` und `apps/web` (Next.js) sind
Adapter, die sich nicht gegenseitig aufrufen. Die Oberfläche hängt nie vom Kern ab: Sie spricht
HTTP, Punkt.

## Nichts geht ohne Entscheidung verloren

Löschen legt beiseite, ohne zu zerstören: Eine gelöschte Tabelle behält ihre Zeilen, in SQL unter
einem ausgelagerten Namen lesbar, und lässt sich wiederherstellen. Wird ein physischer Name
umbenannt, bleibt der alte über einen Alias erreichbar. Die Bereinigung ist eine Entscheidung der
Administration, der ein geprüfter Export vorausgeht.

## PostgreSQL und sonst nichts

PostgreSQL 16 oder neuer und keine zwingende externe Abhängigkeit: keine Message Queue, kein Cache,
keine Suchmaschine. Die Webhook-Warteschlange, das Abarbeiten des Verlaufs, die Ratenbegrenzungen –
alles steckt in der Datenbank oder im Prozess.

## Weiterführend

| Kapitel | Thema |
|---|---|
| 00 | Grundlegende Entscheidungen und Register der Fehlercodes |
| 01 | Benennung und Slugifizierung |
| 02 | Der Katalog `_basedb`, Quelle der Wahrheit |
| 03 | DDL-Engine und Migrationen |
| 04 | Feldtypen und Abbildung in PostgreSQL |
| 05 | Berechtigungen |
| 06 | Lebenszyklus: Umbenennen, Löschen, Bereinigen |
| 07 | Verlauf |
| 08 | REST-API und Webhooks |
| 09 | MCP-Server |
| 10 | Softwarearchitektur |
| 11 | Oberfläche |
| 12 | KI-Integration |
| 13 | Authentifizierung |
| 14 | Umgebungen |
| 15 | Freigegebene Formulare |
