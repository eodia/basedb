---
title: Verlauf
description: Jeder Schreibvorgang, woher er auch kommt, mit den vorherigen Werten.
---

basedb zeichnet **jeden Schreibvorgang** im Verlauf auf, woher er auch kommt: aus der Oberfläche,
der API, von einem MCP-Agenten, aus einem öffentlichen Formular – und sogar aus einer SQL-Abfrage,
die von Hand in `psql` geschrieben wurde.

![Der Verlauf einer Datenbank](../../../../assets/screens/de/historique.webp)

## Wie er erfasst wird

Nicht von der Anwendung, sondern von **PostgreSQL-Triggern**, in derselben Transaktion wie der
Schreibvorgang. Ein fehlgeschlagener Schreibvorgang hinterlässt keine Spur; ein erfolgreicher kann
keine verfehlen. Die Revisionen werden anschließend in unveränderliche Protokolle übertragen, die
nach Monat partitioniert sind.

Die Identität reist über Sitzungsvariablen, die zu Beginn jeder Transaktion gesetzt werden. Ein
Schreibvorgang ohne sie – direktes SQL – wird als solcher aufgezeichnet, mit der Sitzung, die ihn
ausgeführt hat (`psql`, Adresse, Prozess): Abgelehnt wird er deswegen nie.

| Akteur | Angezeigt als |
|---|---|
| eine Person | ihr Name |
| ein Programm (API) oder ein Agent (MCP) | die Person, die das Token angelegt hat, „über das Token …“ |
| ein öffentliches Formular | „Formular ‚…‘ · öffentliche Antwort“ |
| eine Automatisierung | „Automatisierung ‚…‘ · im Namen von“ der Person, die für sie verantwortlich ist |
| direktes SQL | „Direkte SQL-Sitzung“ |

## Was Sie damit tun können

- Den Verlauf einer Zeile **lesen** (Reiter „Verlauf“ ihrer Zeilendetails), einer Tabelle oder
  einer Datenbank (**Verlauf** im Menü **⋯** der Datenbank), gefiltert nach Tabelle.
- Eine Änderung **rückgängig machen**: Die vorherigen Werte werden Feld für Feld wieder angewendet.
- Eine gelöschte Zeile über ihren Eintrag „hat gelöscht“ **wiederherstellen**.
- Den **Strukturverlauf** verfolgen (Reiter „Struktur“): angelegte, geänderte und gelöschte
  Tabellen und Felder.

## Rückgängig machen (Strg+Z)

Im Raster macht **Strg+Z** (⌘Z auf dem Mac) Ihren letzten Schreibvorgang rückgängig;
**Strg+Umschalt+Z** oder **Strg+Y** stellt ihn wieder her. Eine Meldung bestätigt, was rückgängig
gemacht wurde – „Rückgängig gemacht: Änderung von ‚Montant‘“ – mit einer Schaltfläche, um das
Rückgängigmachen zurückzunehmen.

So lassen sich eine Zelle, eine verschobene Karte oder ein verschobener Balken, eine angelegte oder
gelöschte Zeile, ein Einfügen – und ein ganzer Import, als eine einzige Aktion gezählt, rückgängig
machen. Bis zu fünfzig Aktionen, Reiter für Reiter.

Das ist kein Zurückspulen des Bildschirms: Es ist ein **neuer Schreibvorgang**, den der Server
anhand des Verlaufs ausführt und der ebenfalls im Verlauf landet. Er wird abgelehnt, wenn jemand die
Zeile inzwischen geändert hat – „Rückgängig machen nicht möglich: ‚Statut‘ wurde inzwischen
geändert“ –, statt dessen Arbeit zu überschreiben. So machen Sie nur Ihre eigenen Schreibvorgänge
der letzten vierundzwanzig Stunden rückgängig, und nie die Struktur. In einer Zelle, die gerade
bearbeitet wird, bleibt Strg+Z das des Texts.

## Berechtigungen

Der Verlauf folgt den Leseberechtigungen: Ein Feld, das für Sie verborgen ist, erscheint nicht in
den Revisionen, die Sie lesen.
