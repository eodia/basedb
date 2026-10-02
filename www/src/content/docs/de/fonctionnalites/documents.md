---
title: PDF-Dokumente
description: Eine Zeile als Rechnung, Angebot, Datenblatt oder Bescheinigung in Ihren Farben, mit Logo, verknüpften Zeilen und Summen.
---

Eine Zeile wird zu einem **PDF**: eine Rechnung mit ihren Positionen und ihrer Summe, ein
Angebot, ein Lieferschein, ein Produktdatenblatt, eine Bescheinigung. In den Zeilendetails
öffnet die Schaltfläche **PDF-Dokument** es in einem neuen Tab, von wo aus der Browser es
druckt oder speichert.

## Das Datenblatt, ohne etwas einzustellen

Ohne Vorlage wird eine Zeile als **Datenblatt** gedruckt: ihr Name als Titel, dann alle Felder,
die Sie lesen dürfen, in Ihrer Sprache.

## Eine Vorlage erstellen

Wer die Tabelle aufbaut — die Stufe Verwalten — erstellt die Vorlagen aus den Zeilendetails
einer Zeile: **PDF-Dokument › Dokumentvorlagen…**. Eine neue Vorlage geht von einem
**Ausgangspunkt** aus:

| Ausgangspunkt | Was er anlegt |
|---|---|
| **Rechnung** | Kopfzeile mit Logo und Kontaktdaten, „RECHNUNG“, Nummer und Datum; Kunde; berechnete Posten und ihre Summe; Netto-/Brutto-Übersicht; Zahlungsbedingungen; rechtliche Hinweise im Fuß |
| **Angebot** | Titel auf einem farbigen Banner, Informationen im Raster, Leistungen, Gültigkeit, Bereich „Einverstanden“ |
| **Datenblatt** | großer Titel in voller Breite, Foto aus dem Bildfeld, Felder im Raster, lange Texte |
| **Bescheinigung** | gerahmte Seite im Querformat, zentrierter Text, Unterschrift |
| **Leere Seite** | ein Titel und die Felder der Zeile |

Sie wird mit **den Spalten Ihrer Tabelle** erstellt — ihrer Nummer, ihrem Datum, ihren
Beträgen, ihrem Foto, den mit ihr verknüpften Zeilen — und was die Tabelle nicht hat, wird
einfach weggelassen. Alles lässt sich danach ändern; die Vorschau rechts zeigt das PDF der
geöffneten Zeile und aktualisiert sich bei jeder Änderung.

## Der Inhalt: Blöcke

Die Blöcke folgen von oben nach unten; man **zieht** sie an ihrem Griff, um sie neu zu ordnen,
und öffnet sie, um sie einzustellen.

| Block | Was er zeigt |
|---|---|
| **Titel** | ein großer Titel und ein Untertitel, schlicht, in Farbe, unterstrichen, oder auf einem Banner — bis an die Seitenränder |
| **Text** | formatierter Text – Überschriften, fett, Listen, Links –, der die Spalten der Zeile mit dem Menü **Spalte** zitiert: „Rechnung `{{numero}}` vom `{{date}}`“; ausgerichtet oder im Blocksatz, auf getöntem Hintergrund, gerahmt oder mit einer farbigen Leiste markiert |
| **Bild** | ein Logo, ein Stempel, oder das Foto eines Bildfelds der Zeile |
| **Felder der Zeile** | die ausgewählten Felder, oder alle: Beschriftung links, Beschriftung oben im Raster mit 2 oder 3 Spalten, oder als **Übersicht** — Werte rechts, der letzte (der fällige Gesamtbetrag) fett; leere Felder lassen sich ausblenden |
| **Tabelle der verknüpften Zeilen** | die Zeilen, die auf diese verweisen — die Positionen einer Rechnung — oder die, auf die eine Mehrfachverknüpfung verweist, mit ihren **Summen**; farbige Kopfzeile, gestreifte Zeilen, Kopfzeilen, Breiten und Ausrichtungen der Spalten nach Ihrer Wahl („Anz.“ für „Anzahl“) |
| **Spalten** | zwei oder drei Spalten nebeneinander, jede mit eigenen Blöcken: „Rechnung an“ auf der einen Seite, die Referenzen auf der anderen |
| **Trennlinie**, **Abstand** | eine Linie — kurz für eine Unterschrift — oder ein Leerraum |
| **Seitenumbruch** | die Fortsetzung auf einer neuen Seite |

## Stil und Seite

- **Akzentfarbe** — die Ihrer Marke: Titel, Banner, Tabellenköpfe, Links. Der darauf liegende
  Text ist weiß oder dunkel, je nachdem, was sich besser lesen lässt.
- **Textfarbe**, **Schriftart** des Texts und der Titel (serifenlos oder mit Serifen),
  **Textgröße**, Stil der Zwischentitel.
- **Format** (A4 oder Letter), **Ausrichtung**, **Ränder**, einfacher oder doppelter **Rahmen**
  um die Seite, **vertikal zentrierter** Inhalt — für eine Bescheinigung.
- **Sprache der Werte**: Beträge werden mit ihrer Währung geschrieben („1.234,50 €“), Daten
  ausgeschrieben („30. September 2026“), Ja und Nein, die Bezeichnung einer Auswahl, der Name
  einer Person. Der Text wird in eingebetteten Schriften gesetzt, die alle zwanzig Sprachen von
  basedb abdecken, Schriftzeichen eingeschlossen.

## Kopf- und Fußzeile

Die **Kopfzeile** trägt Ihr **Logo** — ein hochgeladenes Bild (PNG, JPEG oder SVG; ein zu
schweres Bild wird verkleinert) oder das Bildfeld der Zeile —, einen Text links (Ihre
Kontaktdaten) und einen Text rechts (was das Dokument ist, seine Nummer, sein Datum), auf der
ersten Seite oder auf jeder. Die **Fußzeile** trägt Ihre rechtlichen Hinweise und die
Seitenzahlen. Beide zitieren die Spalten der Zeile, wie ein Text.

## Jede Person mit ihren Berechtigungen

Ein Dokument wird **mit den Berechtigungen der druckenden Person** gelesen: Ein für sie
verborgenes Feld erscheint dort nicht — weder in einem Text, noch als Bild —, eine verknüpfte
Zeile, die sie nicht sieht, steht nicht in der Tabelle — auch nicht in der Summe. Zwei Personen
können also aus derselben Zeile zwei verschiedene Dokumente erhalten: Jede bekommt ihres.

## Über die API

```bash
# Le PDF d’une ligne avec un modèle, ou « fiche »
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listet die Vorlagen der Tabelle auf.

## Grenzen

- Ein hochgeladenes Bild wiegt höchstens 300 KB, acht pro Vorlage; ein Bild aus einem Feld wird
  übernommen, wenn es ein PNG oder JPEG ist.
- Ein Wert einer verknüpften Zeile wird außerhalb der Tabelle durch ein **Nachschlagefeld** auf
  der Tabelle des Dokuments zitiert; ein Bruttobetrag ist ein Feld der Tabelle.
- Ein Dokument pro Zeile: noch kein PDF mehrerer Zeilen. Eine
  [Automatisierung](/basedb/de/fonctionnalites/automatisations/#ein-pdf-und-eine-e-mail) kann
  das für Sie erledigen — **PDF erstellen** — und es als Anhang senden.
