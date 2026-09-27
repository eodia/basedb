---
title: Dashboards
description: Fragen, per Maus oder in SQL gestellt, fünfzehn Arten, sie darzustellen und einzustellen, Dashboards im Raster, in Reitern, unter gemeinsamen Filtern – mit den Berechtigungen jeder Person gelesen und per Link freigegeben.
---

Ein **Dashboard** fasst auf einer Seite zusammen, was ein Team jeden Tag ansieht: die Zahlen, auf
die es ankommt, ihre Entwicklung Monat für Monat, die Verteilung eines Status, die nächsten
Fristen. Jede Karte zeigt eine **Frage** – eine Lesart der Datenbank, per Maus erstellt oder in
SQL geschrieben –, und **Filter** oben auf der Seite steuern die Karten, die mit ihnen verbunden
sind.

![Das Dashboard „Pilotage de l’agence“: Trend des Monats, Ziel, gestapelter Umsatz, Stimmung der Bewertungen](../../../../assets/screens/tableaux-de-bord.png)

Alles öffnet sich über **Dashboards** im Block der geöffneten Datenbank unten in der Seitenleiste.
Links stehen die Dashboards und die gespeicherten Fragen der Datenbank sowie **Daten erkunden**, um
eine Frage zu stellen, ohne etwas zu speichern. Alle, die die Datenbank lesen dürfen, können sie
ansehen und erkunden; Anlegen, Bearbeiten und Speichern erfordern die Stufe **Verwalten**.

## Eine Frage per Maus stellen

Eine Frage wird in Schritten aufgebaut, einer unter dem anderen:

![Der Editor einer Frage: die Daten, die Filter, die Zusammenfassung nach Monat](../../../../assets/screens/question-editeur.png)

| Schritt | Was Sie dort wählen |
|---|---|
| **Daten** | die Ausgangstabelle und die angezeigten Spalten, wenn nichts zusammengefasst wird |
| **Daten zusammenführen** | eine andere Tabelle der Datenbank, verbunden über eine Verknüpfung – von selbst vorgeschlagen – oder über zwei gleichartige Spalten; Left, Inner, Right oder Full Join |
| **Filter** | pro Spalte, mit dem, was ihr Typ anbietet: ist / ist nicht, enthält, zwischen, leer …; für ein Datum ein **Zeitraum**: heute, die letzten 30 Tage, dieser Monat, das letzte Quartal, vom … bis …; oder ein Ausdruck, geschrieben wie in der Leiste der Ansichten |
| **Zusammenfassen** | Kennzahlen – Anzahl der Zeilen, Summe, Durchschnitt, Median, Minimum, Maximum, eindeutige Werte, Standardabweichung, kumulierte Werte – **nach** einer bis drei Spalten |
| **Sortieren**, **Begrenzen** | die Reihenfolge der Zeilen und ihre Höchstzahl |

Ein Datum wird **nach Tag, Woche, Monat, Quartal oder Jahr** gruppiert oder nach Rang – Wochentag,
Monat des Jahres, Stunde des Tages; eine Zahl in Klassen. Eine Mehrfachauswahl zählt jede Zeile in
jeder ihrer Optionen. Zeiträume gelten in Ihrer Zeitzone, und die Woche beginnt an dem Tag, der in
Ihren Einstellungen steht.

**Visualisieren** führt die Frage aus. Das Ergebnis wird so dargestellt, wie es am besten passt –
eine Kennzahl, eine Linie, Balken, eine Tabelle – und lässt sich unten auf dem Bildschirm ändern:

| Visualisierung | Um zu zeigen |
|---|---|
| **Kennzahl**, **Trend**, **Fortschritt**, **Messanzeige** | einen Wert; den letzten Zeitraum im Vergleich zum vorherigen und zum selben im Vorjahr; den Fortschritt zu einem Ziel |
| **Säulen**, **Balken**, **Linie**, **Fläche**, **Kombiniert** | Kennzahlen entlang einer Dimension, als Reihen nebeneinander, gestapelt oder zu 100 % |
| **Kreis**, **Trichter** | Anteile, Stufen |
| **Streudiagramm** | zwei Kennzahlen gegeneinander, eine dritte als Größe |
| **Tabelle**, **Kreuztabelle** | die Zeilen, sortierbar; die Zeilen nach einer Dimension, die Spalten nach einer anderen, mit ihren Summen |
| **Landkarte** | die Regionen oder Départements Frankreichs oder die Länder, nach einem Wert eingefärbt; oder Punkte nach Breiten- und Längengrad |

**Einstellungen** regelt, was angezeigt wird, und das Ergebnis lässt sich als **CSV** herunterladen.

### Ein Diagramm anpassen

| Visualisierung | Was **Einstellungen** anbietet |
|---|---|
| **Balken, Linien, Flächen, kombiniert** | Farbe und Name jeder Reihe; die Stapelung, mit der Summe über den Stapeln; die Breite der Balken; geglättete oder gestufte Linien, mit oder ohne Punkte; die Reihenfolge der Kategorien; die Achsentitel, die Teilstriche, die Neigung der Beschriftungen, die Grenzen, eine logarithmische Skala; die Werte im Diagramm; ein Ziel |
| **Kreis** | ein Ring und seine Stärke, ein Halbkreis, eine Rose; die Summe in der Mitte; die Zahl der Anteile vor „Andere“; Farbe und Name jedes Anteils; die Beschriftungen auf den Anteilen oder daneben; die Position der Legende |
| **Trichter** | Farbe und Name jeder Stufe, ihre Reihenfolge |
| **Kennzahl, Trend, Fortschritt, Messanzeige** | die Farbe, Farben je nach Wert, eine Legende unter der Zahl, der Vergleich – und ob ein Rückgang eine gute Nachricht ist |
| **Tabelle, Kreuztabelle** | Spalten umbenennen und umsortieren, Balken in den Zellen, Farben je nach Wert – pro Zelle oder pro Zeile –, die Dichte, die Zeilen pro Seite, die Zeilennummern, die Summen |
| **Landkarte** | der Farbton, die Namen der Regionen |

Für alle das Zahlenformat: Dezimalstellen, Präfix und Suffix, abgekürzt als `1,2 k`.

## Mit einem Klick erkunden

Ein Klick auf einen Balken, einen Punkt oder einen Anteil öffnet, wofür er steht:

- **Diese Zeilen anzeigen**: die Zeilen hinter dem Punkt, gefiltert nach dem, wofür er steht;
- **Nach Woche aufschlüsseln**: ein Zeitraum, aufgefächert in einen feineren – ein Jahr in seine
  Quartale, ein Monat in seine Wochen;
- **Aufteilen nach …**: dieselbe Kennzahl für diesen Punkt, nach einer anderen Spalte;
- **Nur dieser Wert**, **Diesen Wert ausschließen**.

Jeder Schritt ist eine eigene Frage, die sich bei Bedarf speichern lässt; der Zurück-Pfeil kehrt
zum vorherigen Schritt zurück. Eine Zeile einer Tabelle öffnet ihre Zeilendetails.

Auf einem Dashboard bietet derselbe Klick außerdem **Dashboard filtern: „Lyon“** an, mit der Anzahl
der betroffenen Karten: ein **temporärer** Filter, nie gespeichert, gestrichelt in der Filterleiste
angezeigt und mit einem Klick entfernbar, der auf jede Karte wirkt, deren Frage dieselbe Spalte
liest – über ihre Tabelle oder über einen Join. Er wird nur angeboten, wenn auf der Karte noch kein
Filter des Dashboards mit dieser Spalte verbunden ist, und bleibt ausgegraut („einzige Karte“), wenn
keine andere Karte sie liest. SQL-Fragen berücksichtigen ihn nicht.

## Eine Frage in SQL schreiben

Eine **SQL-Frage** ist ein `SELECT` über die Tabellen der Datenbank, unter ihrem echten Namen. Sie
läuft **schreibgeschützt, mit Ihren eigenen Berechtigungen** – für alle, Verwaltende eingeschlossen:
Eine Tabelle, die Ihnen verschlossen ist, existiert nicht, ein verborgenes Feld wird abgelehnt, und
ein Schreibvorgang ist unmöglich. Um eine Abfrage einfach ohne Diagramm unter den Tabellen abzulegen
oder daraus eine echte PostgreSQL-View zu machen, siehe [Abfragen und SQL-Views](/basedb/de/fonctionnalites/requetes-et-vues-sql/).

Eine **Variable** wird `{{nom}}` geschrieben; ein Teil, der entfallen soll, wenn sie keinen Wert
hat, steht zwischen `[[` und `]]`:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

Eine Variable ist ein Text, eine Zahl, ein Datum – oder ein **Spaltenfilter**: `{{periode}}` wird
dann zu einer ganzen Bedingung auf der gewählten Spalte, hier `echeance`, oder zu `TRUE`, wenn
nichts gewählt ist. So kann ein Filter des Dashboards eine SQL-Frage wie alle anderen steuern.

## Ein Dashboard gestalten

**Bearbeiten** schaltet das Dashboard in den Bearbeitungsmodus:

- **Frage** setzt eine gespeicherte Frage ein oder legt eine eigene für die Karte an;
- **Titel** und **Text** fügen einen Abschnittstitel oder einen Text in Markdown hinzu;
- **Eingebettete Seite** zeigt eine `https://`-Adresse in einem isolierten Rahmen, der weder
  Sitzung noch Daten erhält;
- **Reiter** verteilt die Karten auf mehrere Seiten; ein Doppelklick benennt einen Reiter um.

Die Karten werden über ihren Ziehgriff verschoben und über ihre Ecke in der Größe verändert, auf
einem Raster von 24 Spalten. **Speichern** behält alles; **Abbrechen** kehrt zur vorherigen Version
zurück. Ein Kartentitel öffnet beim Lesen seine Frage zum Erkunden, Filter des Dashboards
eingeschlossen.

## Die Filter

**Filter** fügt oben im Dashboard ein Steuerelement hinzu: ein **Datum** (ein Zeitraum), eine
**Kategorie** (Werte zum Anhaken), einen **Text**, eine **Zahl** oder eine **Datumsgruppierung**,
die die Linien von Monat auf Woche oder Jahr umschaltet.

Ein Filter steuert die Karten, die mit ihm verbunden sind – eine, mehrere oder alle. Beim Anlegen
verbindet er sich von selbst mit den passenden Spalten; ausgewählt zeigt er auf jeder Karte die
Spalte, die er filtert, zum Ändern oder Entfernen, und **Mit allen kompatiblen Karten verbinden**
ergänzt den Rest. Er kann einen **Standardwert** haben – zum Beispiel „Dieses Jahr“.

Beim Lesen kann ein Klick auf einen Punkt auch einen Filter setzen: **Nach „Lyon“ filtern** auf
einer Karte, deren Ortsspalte mit dem Filter „Ville“ verbunden ist.

![Der Reiter „Activité“: Aufgaben nach Fälligkeit, gestapelt nach Status, Projekttrichter, geschätzte Stunden als Kreuztabelle](../../../../assets/screens/tableaux-de-bord-activite.png)

## Der Copilot

**Copilot** im Kopfbereich des Bereichs Dashboards öffnet rechts eine Unterhaltung in natürlicher
Sprache über die Datenbank: „Der Umsatz pro Monat“, „Füge einen Filter nach Kunde hinzu“, „Warum
geht der August zurück?“. Jeder Vorschlag kommt als Karte, die sich mit einem Klick anwenden lässt:

| Vorschlag | Was er bewirkt |
|---|---|
| **Eine Frage** | in der Unterhaltung ausgeführt und gezeichnet; sie öffnet sich im Editor oder wird dem Dashboard hinzugefügt |
| **Änderungen am Dashboard** oder ein neues Dashboard | Karten hinzugefügt, geändert oder entfernt, Texte, Filter, die sich von selbst mit den Karten verbinden, die die Spalte haben, Reiter, Name – ein einziges Speichern, von der Karte aus **rückgängig zu machen** |
| **Werte für die angezeigten Filter** | „Zeig mir den letzten Monat“: Die Filter stellen sich ein, nichts wird gespeichert |

Eine Frage stellen oder die Filter einstellen steht allen offen, die die Datenbank lesen dürfen;
ein Dashboard bearbeiten oder anlegen erfordert die Stufe **Verwalten**.

Standardmäßig geht **nur die Struktur** zusammen mit der Unterhaltung an den KI-Anbieter: die
Tabellen und ihre Felder, die Dashboards und die gespeicherten Fragen der Datenbank sowie das
angezeigte Dashboard – seine Reiter, seine Filter, die Definition seiner Karten (ihre Fragen, ihre
Texte). Weder die Zeilen noch die Ergebnisse der Karten noch die **in den Filtern gewählten Werte**,
die Daten sein können: Von einem Filter geht nur die Tatsache hinaus, dass er einen Wert hat. Ein
Feld, das für Agenten als unsichtbar markiert ist, geht nicht hinaus, ebenso wenig die Frage einer
Karte, die es zitiert.

Das Kästchen **Lesen der Daten erlauben** fügt für die Unterhaltung die Werte der angezeigten Filter
und die Ergebnisse der Karten unter diesen Filtern hinzu (höchstens 50 Zeilen pro Lesevorgang, unter
der Antwort aufgelistet), damit er die Zahlen belegt kommentieren kann. Siehe
[Künstliche Intelligenz](/basedb/de/fonctionnalites/ia/).

## Ein Dashboard freigeben

**Freigeben** im Kopfbereich eines Dashboards steht allen zur Verfügung, die die Stufe **Verwalten**
auf der Datenbank haben. Zwei Wege:

- **Datenbank freigeben …** lädt Personen zur Datenbank ein: Sie öffnen das Dashboard in basedb, und
  jede Karte liest mit ihren eigenen Berechtigungen;
- **Link erstellen** liefert einen Link auf **nur dieses** Dashboard, der keine Berechtigung für
  die Datenbank verlangt.

| Zugriff über den Link | Wer liest |
|---|---|
| **Öffentlich** | alle, die den Link haben, ohne Konto |
| **Angemeldete Mitglieder** | ein Mitglied des Arbeitsbereichs, nach der Anmeldung – bei Bedarf nur bestimmter Gruppen |

Die Seite des Links zeigt die Reiter, Filter und Karten des Dashboards **schreibgeschützt**: kein
Erkunden, kein Zugriff auf die Zeilen, keine eigene Frage. Ihre Karten lesen mit den
**Berechtigungen der Person, die den Link veröffentlicht hat**, bei jedem Lesen neu entschieden:
Verliert sie den Zugriff auf die Datenbank, wird der Link **ausgesetzt**. Der Schalter
**Link aktiv** schaltet ihn ab, ohne ihn zu verlieren, **Neu erzeugen** macht den alten ungültig.

Haken Sie **Einbettung in eine andere Website erlauben** an: Der Dialog liefert einen
**Einbettungscode** `<iframe>`, um das Dashboard in einem Intranet oder einem Wiki anzuzeigen. Es
ist derselbe Mechanismus wie bei den [freigegebenen Ansichten](/basedb/de/fonctionnalites/vues-partagees/).

## Jede Person mit ihren Berechtigungen

Jede Karte liest **mit den Berechtigungen der betrachtenden Person**: Dasselbe Dashboard zeigt
jeder, was sie sehen darf – außer über einen Freigabelink, der mit denen der Person liest, die ihn
veröffentlicht hat. Eine Karte, die sich auf eine Tabelle oder ein Feld bezieht, das Ihnen
verschlossen ist, zeigt „Daten nicht zugänglich“ statt einer Zahl, die durch Weglassen lügen würde.
Eine Frage zu speichern gibt nur die Frage frei, nie das, was ihr Verfasser lesen darf.

## Grenzen

- Eine Frage liefert höchstens 2 000 Zeilen; eine Zusammenfassung kommt fast immer damit aus.
- Jede Karte führt ihre Abfrage beim Öffnen und bei jedem Filter aus, ohne Cache.
- Die Kartengrundlagen decken das europäische Frankreich (Regionen, Départements) und die Länder
  der Welt ab. Quelle: IGN, Admin Express (Licence ouverte); Natural Earth.
