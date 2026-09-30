---
title: PDF-Dokumente
description: Eine Zeile als Rechnung, Angebot oder druckbares Datenblatt, mit ihren verknüpften Zeilen und ihren Summen.
---

Eine Zeile wird zu einem **PDF**: eine Rechnung mit ihren Positionen und ihrer Summe, ein
Angebot, ein Lieferschein, ein Datenblatt. In den Zeilendetails öffnet die Schaltfläche
**PDF-Dokument** es in einem neuen Tab, von wo aus der Browser es druckt oder speichert.

## Das Datenblatt, ohne etwas einzustellen

Ohne Vorlage wird eine Zeile als **Datenblatt** gedruckt: ihr Name als Titel, dann alle Felder,
die Sie lesen dürfen, in Ihrer Sprache.

## Die Vorlagen

Wer die Tabelle aufbaut — die Stufe Verwalten — schreibt sie, aus den Zeilendetails einer Zeile:
**PDF-Dokument › Dokumentvorlagen…**. Eine Vorlage ist eine Seite (A4 oder Letter, Hoch- oder
Querformat), eine Sprache für die Werte, eine Fußzeile und eine Folge von Blöcken:

| Block | Was er zeigt |
|---|---|
| **Text** | formatierter Text – Überschriften, fett, Listen, Links –, der die Spalten der Zeile mit dem Menü **Spalte** zitiert: „Rechnung `{{numero}}` vom `{{date}}`“ |
| **Felder der Zeile** | die ausgewählten Felder, oder alle: Beschriftung links, Wert rechts |
| **Tabelle der verknüpften Zeilen** | die Zeilen, die auf diese verweisen — die Positionen einer Rechnung — oder die, auf die eine Mehrfachverknüpfung verweist, mit den ausgewählten Spalten und ihren **Summen** |
| **Seitenumbruch** | die Fortsetzung auf einer neuen Seite |

Der Editor zeigt daneben das PDF, das die Vorlage aus der geöffneten Zeile macht, Änderungen
eingeschlossen.

Die Werte werden **in der Sprache der Vorlage** geschrieben: ein Betrag mit seiner Währung
(„1.234,50 €“), ein ausgeschriebenes Datum („30. September 2026“), Ja und Nein, die Bezeichnung
einer Auswahl, der Name einer Person. Der Text wird in eingebetteten Schriften gesetzt, die alle
zwanzig Sprachen von basedb abdecken, Schriftzeichen eingeschlossen.

## Jede Person mit ihren Berechtigungen

Ein Dokument wird **mit den Berechtigungen der druckenden Person** gelesen: Ein für sie
verborgenes Feld erscheint dort nicht, eine verknüpfte Zeile, die sie nicht sieht, steht nicht in
der Tabelle — auch nicht in der Summe. Zwei Personen können also aus derselben Zeile zwei
verschiedene Dokumente erhalten: Jede bekommt ihres.

## Über die API

```bash
# Le PDF d’une ligne avec un modèle, ou « fiche »
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listet die Vorlagen der Tabelle auf.

## Grenzen

- Kein Bild (Logo) und keine gewählte Farbe in einem Dokument, keine von der Fußzeile getrennte
  Kopfzeile.
- Ein Dokument pro Zeile: noch kein PDF mehrerer Zeilen, und keine Erzeugung durch eine
  Automatisierung.
