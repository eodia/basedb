---
title: Suche
description: Ein einziges Feld, um alles zu finden — Tabellen, Ansichten, Dashboards, Zeilen, Befehle — und um dem Copilot eine Frage zu stellen. Strg+K.
---

Das Feld **Tabellen, Zeilen, Befehle suchen…**, in der Mitte der oberen Leiste, öffnet die Suche:
ein einziges Feld für alles, was Sie in basedb erreichen können. **Strg+K** (**⌘K** auf dem Mac)
öffnet oder schließt sie von jedem Bildschirm aus — außer in einem Texteditor, wo es einen Link
einfügt.

## Was sie findet

| | |
|---|---|
| **Tabellen und Objekte** | die Projekte und Datenbanken, die Sie sehen; die Tabellen, SQL-Views und gespeicherten Abfragen; die Ansichten der Tabellen der geöffneten Datenbank, persönliche eingeschlossen; die Fragen, Dashboards und Automatisierungen der Datenbanken des Projekts; die Spalten der Tabellen; die geöffneten Reiter |
| **Zeilen** | die Daten selbst, in den Tabellen der geöffneten Datenbank: der Text der Spalten, die Werte der Auswahllisten, eine genaue Zahl — ab zwei Zeichen. Eine eingefügte Zeilen-ID findet ihre Zeile |
| **Befehle** | was die Anwendung kann: zur Struktur, zum Verlauf, zu den Dashboards der Datenbank gehen; eine Tabelle, eine Frage, eine SQL-Abfrage, eine Datenbank, ein Projekt anlegen, von einer Vorlage ausgehen; in eine Tabelle importieren; den letzten Schreibvorgang rückgängig machen oder wiederherstellen; einen Reiter schließen oder wechseln; das Design wechseln; den Copilot öffnen; **Link dieser Seite kopieren**; einen Reiter der Einstellungen oder der Administration öffnen; sich abmelden |
| **Copilot** | eine Frage in natürlicher Sprache, an den Copilot übergeben |

**Eingabe** öffnet das gewählte Ergebnis: Eine Zeile öffnet sich in ihrer Tabelle, auf ihren
Zeilendetails. Auf einem großen Bildschirm zeigt ein Panel rechts die Vorschau — die Werte einer
Zeile, die Spalten und die Beschreibung einer Tabelle, die Beschreibung eines Dashboards oder einer
Automatisierung. Fügen Sie eine Adresse von basedb ein: **Link öffnen** bringt Sie dorthin (siehe
[Ein Link zu jedem Bildschirm](/basedb/de/fonctionnalites/collaboration/#ein-link-zu-jedem-bildschirm)).

Das leere Feld schlägt Ihre **zuletzt verwendeten** vor, die geöffneten Reiter, die Tabellen der
Datenbank und einige Vorschläge.

## Tippen Sie, wie Sie denken

- **Weder Akzente noch Großbuchstaben**: `schuler` findet „Schüler“.
- **Wortanfänge und Initialen**: `nk` für „Neuer Kunde“, `neutab` für „Neue Tabelle“.
- **Ein Tippfehler wird verziehen** — ein vergessener, verdoppelter, ersetzter oder vertauschter
  Buchstabe, bei einem Wort mit mehr als sieben Buchstaben auch zwei —, nie beim ersten Buchstaben.
- **Jedes eingegebene Wort muss irgendwo vorkommen**, im Namen oder in dem, was ihn enthält:
  `vertrieb kunden` findet die Tabelle „Kunden“ der Datenbank „Vertrieb“. Die Art lässt sich auch
  eingeben: `ansicht`, `automatisierung`, `dashboard`.
- **Erst eine Tabelle, dann das, was man darin sucht**: `kunden lyon` sucht „lyon“ in den Zeilen
  der Tabelle „Kunden“.

Ganz oben steht das **beste Ergebnis**; was Sie oft und vor Kurzem geöffnet haben, steigt nach
oben. Dieses Gedächtnis bleibt in Ihrem Browser.

## Die Suche eingrenzen

Die Chips unter dem Feld — **Alle**, **Tabellen und Objekte**, **Zeilen**, **Befehle**, **Copilot**
— schränken ein, was durchsucht wird. Ein erstes Zeichen bewirkt dasselbe:

| Tippen Sie zuerst | Um zu suchen |
|---|---|
| `#` | nur Tabellen und Objekte |
| `/` | nur Zeilen |
| `>` | nur Befehle |
| `?` | eine Frage an den Copilot |

**Tab** sucht bei einer Tabelle oder einer Datenbank **darin**: Ihr Name wird im Feld angezeigt,
und die Suche bezieht sich dann nur noch auf ihre Zeilen, ihre Ansichten, ihre Spalten und ihre
Befehle. Das leere Feld zeigt dann die zwanzig zuletzt geänderten Zeilen. **⌫** verlässt es bei
leerem Feld wieder; **Esc** geht einen Schritt zurück und schließt dann.

## Den Copilot fragen

Jede Suche endet mit **Copilot fragen: „…“**, das an erster Stelle steht, wenn sich der Text wie
eine Frage liest — er endet mit „?“, beginnt mit „wie viele“, „welche“, „zeig“ … oder umfasst fünf
Wörter oder mehr. Der Copilot öffnet sich auf der Datenbank und erhält die Frage, als hätten Sie
sie selbst eingetippt. Er liest die Struktur, nicht die Zeilen, außer wenn Sie **Lesen der Daten
erlauben** ankreuzen, und er schlägt vor: Nichts ändert sich, bevor Sie es anwenden. Die KI muss
auf der Instanz eingerichtet sein — siehe [Künstliche Intelligenz](/basedb/de/fonctionnalites/ia/).

## Berechtigungen und Grenzen

Die Suche läuft über dieselben Routen wie der Rest des Bildschirms, **mit Ihren Berechtigungen**:
Eine Tabelle oder eine Spalte, die Ihnen verschlossen ist, erscheint nicht, weder unter den
Objekten noch in den Zeilen. Automatisierungen werden nur denen vorgeschlagen, die die Stufe
**Verwalten** auf ihrer Datenbank haben.

- Die Zeilen werden in der geöffneten Datenbank gesucht, oder in der Datenbank oder Tabelle, in die
  Sie mit Tab gewechselt sind: drei Zeilen pro Tabelle, auf höchstens vierundzwanzig Tabellen;
  zwanzig Zeilen in einer Tabelle.
- Die Fragen, Dashboards und Automatisierungen sind die des geöffneten Projekts (höchstens acht
  Datenbanken), höchstens alle zwei Minuten neu gelesen.
- Jede Gruppe zeigt einige Ergebnisse, dann **N weitere Ergebnisse**, was sie vollständig öffnet.

## Tastenkombinationen

**Tastenkürzel**, unten in der Suche, oder der Befehl **Tastenkombinationen**, zeigt sie alle.
**Strg** entspricht **⌘** auf dem Mac.

| Tasten | Wirkung |
|---|---|
| **Strg+K** | Suche öffnen oder schließen |
| **↑** **↓**, **Eingabe** | Ergebnisse durchgehen, Ergebnis öffnen |
| **Alt+W** | Reiter schließen |
| **Strg+Tab**, **Strg+Umschalt+Tab** | nächster Reiter, vorheriger Reiter |
| Klick mit dem Mausrad | einen Reiter schließen |
| **Strg+A**, **Strg+C** | im Raster alles auswählen, gewählte Zellen kopieren |
| **Strg+Klick** | einer Verknüpfung folgen |
| **Strg+Z**, **Strg+Y** | letzten Schreibvorgang rückgängig machen, wiederherstellen |
| **Strg+Eingabe** | einen Kommentar senden, eine Beschreibung speichern |
| **Strg+B**, **Strg+I**, **Strg+K** | in einem Text: fett, kursiv, Link |
