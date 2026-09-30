---
title: Ansichten
description: Raster, Kanban, Kalender, Zeitachse, Galerie, Liste, Landkarte, Formular, Umfrage und Quiz – kollaborativ oder persönlich.
---

Eine Tabelle lässt sich auf **zehn Arten** darstellen. Eine Ansicht kopiert keine Daten und gibt
keine Berechtigung über die der Tabelle selbst hinaus.

:::note
Diese Ansichten sind Arten, **eine** Tabelle darzustellen. Eine [SQL-View](/basedb/de/fonctionnalites/requetes-et-vues-sql/)
ist etwas anderes: eine echte PostgreSQL-View, in SQL über die Tabellen der Datenbank geschrieben
und in der Seitenleiste zwischen ihnen eingeordnet.
:::

| Ansicht | Was sie zeigt | Was sie braucht |
|---|---|---|
| **Raster** | Zeilen, gefiltert, sortiert, gruppiert, mit ausgewählten Spalten | – |
| **Kanban** | Karten in Spalten | eine Einfachauswahl |
| **Kalender** | Zeilen an ihrem Datum, nach Monat oder Woche | ein Datumsfeld |
| **Zeitachse** | Balken zwischen zwei Daten und ihre Abhängigkeiten | ein Startdatum |
| **Galerie** | Karten mit einem Titelbild | – |
| **Liste** | eine Zeile pro Datensatz, in einklappbaren Gruppen | – |
| **Landkarte** | jede Zeile auf einer Karte platziert | eine Adresse, oder ein Breiten- und ein Längengrad |
| **Formular** | eine Seite mit Fragen, um eine Zeile anzulegen | – |
| **Umfrage** | dieselben Fragen, eine pro Bildschirm | – |
| **Quiz** | bewertete Fragen, eine pro Bildschirm, und die Punktzahl am Ende | – |

## Die Ansichtsauswahl

Sie befindet sich links neben „Filtern“. „Alle Zeilen“ ist das Raster der Tabelle, das niemand
gespeichert hat und niemand löschen kann; danach folgen die **kollaborativen Ansichten** in der
Reihenfolge, die festlegt, wer die Datenbank aufbaut, und dann **Meine Ansichten**. Unten ordnet
**Ansicht erstellen** die zehn Arten in zwei Familien: solche, die **die Zeilen zeigen**, und
solche, die **Antworten sammeln** (Formular, Umfrage, Quiz).

- Eine **kollaborative Ansicht** sehen alle. Sie anzulegen, zu konfigurieren, umzubenennen,
  umzusortieren oder zu löschen erfordert die Stufe **Verwalten**. Sie kann **gesperrt** sein: Ein
  Schloss zeigt es an, und niemand ändert sie mehr, bevor er sie entsperrt hat.
- Eine **persönliche Ansicht** sehen nur Sie, und sie erfordert nur, dass Sie die Tabelle lesen
  dürfen. **Persönliche Ansicht erstellen** oder **Als Ansicht speichern** nach dem Filtern und
  Sortieren: Jeder legt seine eigenen Lesarten ab, ohne für die anderen etwas zu ändern.
  **Duplizieren** macht aus einer kollaborativen Ansicht eine persönliche Kopie.

![Eine Kundengalerie](../../../../assets/screens/de/galerie.webp)

## Die Symbolleiste

Über dem Raster, in dieser Reihenfolge:

- **Filtern** kombiniert Bedingungen pro Feld;
- **Spalten** wählt aus, was angezeigt wird – die Systemspalten stehen gesondert unter
  „Systeminformationen“;
- **Gruppieren** ordnet die Zeilen nach einem einwertigen Feld – Einfachauswahl, Verknüpfung,
  Person, Datum, Zahl, Text, Kontrollkästchen … – in einklappbare Gruppen, jede mit ihrer
  Anzahl über den gesamten Filter;
- **Farben** färbt die Zeilen nach einer Einfachauswahl oder nach **Regeln** – ein Filter und
  eine Farbe, höchstens zwanzig – als Randstrich, als Hintergrund oder beides;
- **Zeilenhöhe**: kurz, mittel, hoch, sehr hoch;
- **Suchen …** rechts durchsucht alle Spalten, während Sie tippen; Esc leert die Suche. Sie gilt
  auch für Kanban, Kalender, Zeitachse, Galerie und Liste und wird nie in der Ansicht gespeichert.

Unter jeder Spalte steht eine **Zusammenfassung**, berechnet über alle Zeilen des Filters, nicht
nur über die aktuelle Seite: ausgefüllt, leer, eindeutige Werte, Summe, Durchschnitt, Minimum,
Maximum, angehakte Kästchen.

## Kanban, Kalender, Zeitachse

- Das **Kanban** ordnet die Karten nach einer Einfachauswahl; wer eine Karte zieht, ändert die
  Zeile, und ein „+“ im Spaltenkopf legt eine Zeile an, die diese Auswahl bereits trägt. Jede Karte
  zeigt einen Titel, ein Titelbild, die ausgewählten Felder und eine **Beschreibung**, die Werte
  der Zeile zitiert – „Lieferung geplant am `{{Date}}` für `{{Client}}`“ –, geschrieben in den
  Einstellungen der Ansicht mit der Schaltfläche **Feld einfügen**.
- Der **Kalender** setzt jede Zeile an ihr Datum, gegebenenfalls mit einem Enddatum; wer eine
  Zeile von einem Tag auf einen anderen zieht, verschiebt sie.
- Die **Zeitachse** zeichnet Balken zwischen einem Start- und einem Enddatum, gruppiert nach einer
  Einfachauswahl oder einer Verknüpfung. Mit der Einstellung **Hängt ab von** – einer Verknüpfung
  der Tabelle auf sich selbst – verbindet ein Pfeil jede Aufgabe mit denen, von denen sie abhängt,
  rot, wenn er in der Zeit zurückläuft.

![Eine Zeitachse mit ihren Abhängigkeiten](../../../../assets/screens/de/chronologie.webp)

![Ein Kalender nach Fälligkeit](../../../../assets/screens/de/calendrier.webp)

## Galerie und Liste

- Die **Galerie** zeigt Karten: ein **Titelbild** (beschnitten oder vollständig), eine Größe
  (kleine, mittlere, große Karten), eine Farbe nach einer Einfachauswahl.
- Die **Liste** zeigt eine Zeile pro Datensatz, **gruppiert** nach einer Einfachauswahl, einer
  Verknüpfung oder einer Person.

![Eine Kundenliste, gruppiert nach Branche](../../../../assets/screens/de/liste.webp)

Im Kanban, in der Galerie und in der Liste lassen sich Karten und Zeilen **von Hand ordnen**, indem
Sie sie ziehen – bis zu 5 000; eine gewählte Sortierung hat Vorrang vor dieser Reihenfolge.

## Landkarte

Die **Landkarte** platziert jede Zeile an ihrem Ort, anhand von:

- einer **Adresse** – einem Kurztext, vorzugsweise im Format **Adresse** (siehe
  [Tabellen und Felder](/basedb/de/fonctionnalites/tables-et-champs/)): „12 rue des Lilas, Lyon“;
- oder einem **Breitengrad** und einem **Längengrad**, zwei Zahlenfeldern, unverändert
  übernommen.

Eine Nadel übernimmt die **Farbe** einer Einfachauswahl, zeigt beim Überfahren den **Titel** der
Zeile und öffnet mit einem Klick ihre Zeilendetails. Die Karte folgt dem Filter und der
Sortierung der Ansicht, bis zu 2 000 Zeilen.

Eine Adresse wird **ein für alle Mal verortet**, durch den Geokodierungsdienst der Instanz –
standardmäßig den von OpenStreetMap –, in dem Takt, den er vorgibt: Auf einer neuen Karte
erscheinen die Nadeln nach und nach, etwa eine pro Sekunde, danach sofort. Eine Anzeige zählt
die platzierten Zeilen, die noch zu verortenden Adressen und die, die es nicht werden konnten:
Eine nicht auffindbare Adresse ist zu präzisieren (Stadt, Postleitzahl), nie stillschweigend
verworfen.

:::note[Was Ihren Server verlässt]
Der Text der Adressen geht an den Geokodierungsdienst, und der Browser jeder lesenden Person
lädt die Kartengrundlage vom Kachel-Server. Der Betreiber der Instanz kann andere Dienste
wählen, oder keinen wollen: siehe
[Umgebungsvariablen](/basedb/de/hebergement/variables/#landkarten-und-adressen).
:::

## Formular und Umfrage

Sie haken die Fragen an und ordnen sie; jede hat eine Beschriftung, einen Hilfetext, ein
Antwortbeispiel und kann als erforderlich markiert werden. Das Formular hat einen Titel, eine
Einleitung, eine Beschriftung für seine Schaltfläche und eine Dankesnachricht. Es wird in basedb
ausgefüllt oder [per Link freigegeben](/basedb/de/fonctionnalites/formulaires-partages/).

Zu Beginn ist nichts einzustellen: Ein neues Formular fragt, was eine Person antwortet – nicht
den Status, die zugewiesene Person oder die Verknüpfungen, die das Team danach ausfüllt, außer
sie sind erforderlich –, trägt die Farbe seiner Tabelle und ein helles Thema, und jedes leere
Feld zeigt ein passendes Beispiel. Alles andere lässt sich jederzeit ändern:

- **Darstellung**: acht Themen – Hell, Sanft, Morgenröte, Ozean, Wald, Nacht, Papier, Minimal –,
  eine Akzentfarbe, eine Schriftart, eine linksbündige oder zentrierte Ausrichtung;
- **Mit dem heutigen Datum vorausfüllen**: Eine Datumsfrage ist schon mit dem heutigen Tag
  ausgefüllt – bei Datum und Uhrzeit auch mit der Uhrzeit –, den die Person übernimmt oder
  ändert;
- **Nur fragen, wenn…**: Eine Frage wird nur gestellt, wenn eine vorherige Antwort es
  verlangt („Stimmung ist Negativ“, „Bewertung ist höchstens 2“). Eine verborgene Frage ist
  weder erforderlich, noch wird sie gesendet;
- **Weitere Optionen**: die Start- und Sendeschaltflächen, die Nummerierung, die
  Fortschrittsleiste, der automatische Übergang zur nächsten Frage, die Nachricht und eine
  Abschlussschaltfläche („Zurück zur Website“), das Konfetti.

Die **Umfrage** füllt den ganzen Bildschirm: ein Begrüßungsbildschirm, der sagt, wie lange es
dauert, dann eine Frage nach der anderen, die gleitend erscheint. Alles funktioniert auch über
die Tastatur: **Eingabetaste** zum Fortfahren, die Buchstaben **A**, **B**, **C** … für eine
Wahl, **J** oder **N** für Ja oder Nein, Ziffern für eine Bewertung – eine Einfachauswahl geht
allein zur nächsten Frage über. Das Absenden wird gefeiert: Ein Häkchen zeichnet sich, und
Konfetti in den Farben des Formulars erscheint.

## Quiz

Ein Quiz ist eine Umfrage, die Punkte zählt. Unter jeder Frage geben Sie ihre **richtige
Antwort** an und was sie einbringt – **1 Punkt**, wenn Sie nichts angeben, bis zu 100:

| Frage | Richtige Antwort |
|---|---|
| Einfachauswahl | eine Auswahl |
| Mehrfachauswahl | die Auswahlmöglichkeiten, die angekreuzt werden müssen, alle und nur sie |
| Kontrollkästchen | Ja oder Nein |
| Zahl, Bewertung | eine Zahl |
| Datum | ein Tag |
| Kurztext, E-Mail, URL | eine oder mehrere akzeptierte Antworten, getrennt durch `;` – ohne Rücksicht auf Groß-/Kleinschreibung oder Akzente |

Eine Frage ohne richtige Antwort – ein Vorname, ein Kommentar – wird gestellt, ohne bewertet zu
werden. Mindestens eine bewertete Frage ist nötig, um das Quiz zu erstellen.

Der Abschnitt **Bewertung** regelt den Rest:

- **Auflösung**: **nach jeder Frage** – die Antwort wird sofort geprüft, grün, oder rot mit der
  richtigen Antwort, und die Punktzahl wächst oben im Bildschirm –, **am Ende** – die Punktzahl,
  dann die Auflösung –, oder **nie** – nur die Punktzahl, die richtigen Antworten bleiben
  geheim;
- **Bestehensgrenze**: ein Prozentsatz der Punkte; der Abschlussbildschirm sagt dann
  „Bestanden!“ oder „Diesmal nicht…“;
- **Punktzahl speichern in**: ein Zahlenfeld der Tabelle, das die Punktzahl jeder Antwort
  erhält. Sortieren Sie das Raster danach: Das ist die Rangliste. Ein Feld namens „Score“,
  „Punkte“ oder „Note“ wird automatisch gewählt.

Der Abschlussbildschirm zeigt die Punktzahl in einem Ring, der sich füllt, den Prozentsatz,
dann, außer bei „nie“, jede bewertete Frage mit der gegebenen und der richtigen Antwort. Eine
Frage, die eine frühere Antwort verborgen hat, zählt nicht zur Gesamtsumme.

:::note
In der Anwendung kann, wer die Ansicht lesen darf, auch ihre richtigen Antworten lesen. Über
einen [freigegebenen Link](/basedb/de/fonctionnalites/formulaires-partages/#ein-freigegebenes-quiz)
verlassen sie den Server nie: Er ist es, der auswertet und zählt.
:::

## Eine Ansicht freigeben

Eine Datenansicht – Raster, Kanban, Kalender, Zeitachse, Galerie, Liste – wird per Link **schreibgeschützt
freigegeben**, lässt sich in eine andere Website einbetten, und ein Kalender wird zu einem
Kalender-Feed. Siehe [Freigegebene Ansichten](/basedb/de/fonctionnalites/vues-partagees/).

## Was die lesende Person nicht sieht

Eine Ansicht wird **für die jeweils lesende Person neu zugeschnitten**: Ein Feld, das ihr verborgen ist,
verschwindet aus den Spalten, Karten und Fragen. Eine Ansicht, deren Filter ein verborgenes Feld
zitiert, wird gar nicht angezeigt: Ohne ihren Filter gezeigt, zeigte sie mehr, als sie zeigen
sollte.
