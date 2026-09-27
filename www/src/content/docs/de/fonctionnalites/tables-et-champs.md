---
title: Tabellen und Felder
description: Die Feldtypen von basedb, ihre Abbildung in PostgreSQL, Formeln und berechnete Felder.
---

Jede Tabelle in basedb ist eine PostgreSQL-Tabelle, jedes Feld eine typisierte Spalte. Die
Bezeichnung, die Sie eingeben („Échéance“), wird durch eine stabile **Slugifizierung** zu einem
lesbaren physischen Namen (`echeance`): ohne Akzente, in Kleinbuchstaben, ohne reservierte Wörter.

## Die Typen

| Typ | PostgreSQL-Spalte | Hinweise |
|---|---|---|
| Kurztext | `text` | eine Zeile |
| Langtext | `text` | Markdown: ein Auszug im Raster, die gerenderte Fassung beim Überfahren, ein eigener Editor; kann [eine Spalte zitieren](#formatierter-text-und-variablen) |
| Formatierter Text | `text` + `CHECK` | HTML, beim Schreiben bereinigt, in einem visuellen Editor verfasst – [siehe unten](#formatierter-text-und-variablen) |
| Zahl | `numeric` | niemals Gleitkomma: Ein Betrag driftet nicht ab |
| Währung, Prozent, Dauer, Bewertung | `numeric` | eine Zahl und ihr [Anzeigeformat](#anzeigeformate): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Kontrollkästchen | `boolean` | |
| Datum | `date` | |
| Datum und Uhrzeit | `timestamptz` | ein absoluter Zeitpunkt, angezeigt in der Zeitzone der lesenden Person |
| Einfachauswahl | `text` + `CHECK` | Farbe, Symbol oder Bild pro Option |
| Mehrfachauswahl | `text[]` + `CHECK` | filterbar mit den Array-Operatoren |
| E-Mail | `text` + `CHECK` | eine von der Datenbank geprüfte Adresse, mit einem Klick zu öffnen |
| Telefon, Barcode | `text` | ein Kurztext und sein Format: Anruflink, Festbreitenschrift |
| URL | `text` + `CHECK` | bei der Eingabe ergänzt (`exemple.fr` → `https://exemple.fr`) |
| Person | `uuid` | ein Mitglied des Arbeitsbereichs; wer eingetragen wird, wird [benachrichtigt](/basedb/de/fonctionnalites/collaboration/) |
| Autonummer | `bigint` Identity | nummeriert auch die bereits vorhandenen Zeilen; niemand gibt sie ein |
| Verknüpfung | `uuid` + `FOREIGN KEY` | ein echter Fremdschlüssel auf die Zieltabelle |
| Mehrfachverknüpfung | `uuid[]` | mehrere verknüpfte Zeilen, deren Integrität ein Trigger sichert |
| Formel | generierte Spalte `STORED` | von PostgreSQL berechnet – oder beim Lesen, siehe [Formeln](#formeln) |
| Nachschlagen, Aggregation, Anzahl | keine | beim Lesen berechnet, über eine Verknüpfung hinweg |
| Schaltfläche | keine | öffnet eine Adresse oder startet eine [Automatisierung](/basedb/de/fonctionnalites/automatisations/) |
| Datei, Bild | `jsonb` (Metadaten) | die Bytes landen im [Dateispeicher](/basedb/de/fonctionnalites/fichiers/) |

Jede Tabelle hat außerdem ihre **Systemspalten**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` – von einem Trigger gepflegt, über die API nie
beschreibbar. Das Raster ordnet sie im Spaltenmenü unter **Systeminformationen** ein:
Sie existieren in jeder Tabelle, nützlich sind sie in wenigen.

![Das Raster einer Tabelle mit einer berechneten Dauer, einem Nachschlagefeld und einer Anzahl](../../../../assets/screens/grille.png)

## Constraints, die die Datenbank durchsetzt

Was die Oberfläche verspricht, garantiert PostgreSQL. Eine Einfachauswahl ist eine
`CHECK`-Constraint, eine Verknüpfung ein `FOREIGN KEY`, eine URL oder eine E-Mail-Adresse ein
regulärer Ausdruck. Ein Schreibvorgang in direktem SQL, der sie verletzt, wird abgelehnt, genau wie
in der Oberfläche:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Anzeigeformate

Währung, Prozent, Dauer, Bewertung, Telefon und Barcode werden wie Typen ausgewählt, sind aber
**Formate**: Die Spalte bleibt eine Zahl oder ein Text, nur die Darstellung ändert sich.

| Format | Auf | Wird so gelesen und eingegeben |
|---|---|---|
| Währung | einer Zahl | `12 500,00 €` – Euro, Dollar, Pfund, Schweizer Franken, Kanadischer Dollar, Yen |
| Prozent | einer Zahl | `15 %` |
| Dauer | einer Anzahl Sekunden | `1:30`, eingegeben als `1h30`, `90 min` |
| Bewertung | einer Zahl | 1 bis 10 Sterne, mit einem Klick gesetzt |
| Telefon | einem Kurztext | ein Anruflink |
| Barcode | einem Kurztext | in Festbreitenschrift |

Ein Format lässt sich nachträglich ändern (**Anzeige** beim Bearbeiten des Felds), ohne die
gespeicherten Werte anzutasten. Es begrenzt den Wert nicht: Eine Bewertung von 7 auf einer
5er-Skala bleibt 7.

## Formeln

Formeln werden auf Französisch geschrieben, Felder in eckigen Klammern, Argumente durch `;` getrennt:

```text
ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)
SI([Payée]; FAUX; JOURS(AUJOURDHUI(); [Échéance]) > 0)
JOURS([Fin]; [Début])
```

Der Editor schlägt die einfügbaren Felder vor und bietet eine Funktionsleiste; eine Fehlermeldung
nennt das betroffene Feld oder Zeichen.

| Familie | Funktionen |
|---|---|
| Logik | `SI`, `SIVIDE`, `ESTVIDE`, `ET`, `OU`, `NON`, `VRAI`, `FAUX` |
| Zahlen | `ARRONDI`, `ABS`, `PLAFOND`, `PLANCHER`, `MIN`, `MAX` |
| Text | `MAJUSCULE`, `MINUSCULE`, `SANSESPACES`, `GAUCHE`, `DROITE`, `LONGUEUR`, `TEXTE`, `NOMBRE` |
| Datumswerte | `ANNEE`, `MOIS`, `JOUR`, `JOURSEMAINE`, `JOURS`, `AJOUTER_JOURS`, `DATE`, `AUJOURDHUI`, `MAINTENANT` |
| Operatoren | `+ - * /`, `&` zum Verbinden von Text, `= <> < <= > >=` |

Eine Formel wird zu einer von PostgreSQL **generierten Spalte**: `psql` und Ihre Werkzeuge lesen
sie wie jede andere. Eine Formel, die vom aktuellen Tag abhängt (`AUJOURDHUI()`, `MAINTENANT()`)
oder ein Nachschlagefeld bzw. eine Aggregation zitiert, wird **beim Lesen berechnet**: Sie lässt
sich in basedb filtern und sortieren, existiert aber nicht in direktem SQL.

Eine Formel zitiert weder eine andere Formel noch direkt eine Verknüpfung – das übernimmt ein
Nachschlagefeld. Teile eines Texts extrahieren oder ersetzen folgt später.

## Nachschlagefelder, Aggregationen und Anzahlen

Drei Felder lesen **über eine Verknüpfung hinweg**, in die eine oder andere Richtung – „der Kunde
des Projekts“, aber auch „die über Projekt verknüpften Aufgaben“:

- ein **Nachschlagefeld** holt einen Wert aus der verknüpften Zeile oder die Liste der Werte: den
  Ort des Kunden eines Projekts;
- eine **Aggregation** rechnet über die verknüpften Zeilen: Anzahl der Werte, Summe, Durchschnitt,
  Minimum, Maximum – den Umsatz eines Kunden, die Durchschnittsbewertung seiner Rezensionen;
- eine **Anzahl** zählt die verknüpften Zeilen: die Zahl der Aufgaben eines Projekts.

Sie werden bei jedem Lesen berechnet, **mit den Berechtigungen der lesenden Person**: Ist Ihnen
die verknüpfte Tabelle verschlossen, ist es das Feld auch. Sie lassen sich filtern und sortieren.
Sie folgen einer einzigen Verknüpfung, sind nicht beschreibbar, haben keine Spalte – existieren
also nicht in direktem SQL – und erscheinen weder im Import noch in Formularen noch im Verlauf.

## Verknüpfungen

Eine **Verknüpfung** verbindet eine Zeile mit einer Zeile einer anderen Tabelle derselben
Datenbank. Das Raster zeigt den **Anzeigewert** der Zielzeile – die Spalte, die Sie für deren
Tabelle als Anzeigefeld festlegen –, und Filter gehen durch die Verknüpfung hindurch
(`clients_id.ville eq "Lyon"`). Die Zeilen, die auf eine Zeile verweisen, erscheinen in deren
Zeilendetails.

Haken Sie **Mehrere Zeilen pro Datensatz** an, wird die Verknüpfung zur **Mehrfachverknüpfung**:
Eine Aufgabe hängt von mehreren Aufgaben ab, ein Artikel gehört zu mehreren Kategorien. Die
verknüpften Zeilen erscheinen als Chips, werden per Suche ausgewählt und öffnen sich mit einem
Klick aus den Zeilendetails. Wird eine Zielzeile gelöscht, verschwindet sie aus den Listen, die sie
zitierten – oder das Löschen wird abgelehnt, wenn Sie es so gewählt haben. Die Filter `has_any`,
`has_all` und `is_null` greifen und gehen ebenfalls durch die Verknüpfung hindurch
(`taches_ids.titre contains "logo"`). Eine Mehrfachverknüpfung lässt sich noch nicht sortieren,
gruppieren oder importieren.

## Schaltfläche

Ein Feld **Schaltfläche** hat keinen Wert: Es handelt. Es **öffnet eine Adresse** – `https://`
oder `mailto:`, die die Zeile zitieren kann (`mailto:{{E-mail}}`) – oder **startet eine
Automatisierung**, die per Schaltfläche in derselben Tabelle ausgelöst wird. Es erscheint in der
Zelle, auf der Karte und in den Zeilendetails.

## Beschreibungen

Eine Datenbank, eine Tabelle und ein Feld haben eine **Beschreibung**, die sich ohne Migration
ändern lässt. Sie wird in das `COMMENT ON` übernommen, das `psql` liest, in die generierte
Dokumentation und in das, was ein Agent über `describe_table` liest.

## Formatierter Text und Variablen

**Formatierter Text** ist die HTML-Variante des Langtexts, die beim Anlegen des Felds gewählt
wird („Formatierter Text (HTML)“): Überschriften, fett, kursiv, unterstrichen, durchgestrichen,
Listen, Zitate, Code, Links und Trennlinien, in einem visuellen Editor. Das HTML wird **beim
Schreiben bereinigt**, ob es aus der Oberfläche, der API, dem MCP-Server oder einem Import stammt,
und eine `CHECK`-Constraint weist zusätzlich gefährliche Formen ab, die direkt in SQL geschrieben
werden (`<script>`, Attribute `on…`, `javascript:`). Keine Bilder, keine Tabellen, keine Farben:
Was die Datenbank nicht behalten würde, wird gar nicht erst angeboten.

Ein Langtext – einfach oder formatiert – kann **eine Spalte seiner Zeile zitieren**. Das Menü
**Spalte** des Editors fügt das Zitat an der Cursorposition ein: ein Chip im formatierten Text,
`{{Ville}}` im Markdown.

> Lieferung geplant am `{{Livraison}}` in `{{Ville}}`.

- Die Spalte speichert das Zitat so, wie es geschrieben wurde – `{{ville}}`, mit seinem physischen
  Namen: Das liest `psql`.
- Überall sonst – im Raster, in den Zeilendetails, in der API, im MCP-Server, in freigegebenen
  Ansichten, in Automatisierungen – wird der Text **mit dem Wert der Zeile** gelesen: „Lieferung
  geplant am 02.10.2026 in Lyon.“ Ändert sich der Ort, ändert sich der Text.
- Eine Einfachauswahl wird über ihre Bezeichnung gelesen, eine Person über ihren Namen, ein Datum
  in Ihrem Format; ein Wert, der in formatierten Text eingefügt wird, ist nie Markup.
- Eine Spalte, die die lesende Person nicht lesen darf, liefert nichts: weder ihren Wert noch
  ihren Namen.

Formatierter Text kann nicht von der KI ausgefüllt werden: Ein Modell schreibt Text, kein
bereinigtes HTML.

## Die Struktur ändern

Der Bildschirm **Struktur** der Datenbank – in ihrem Menü **⋯** in der Seitenleiste – listet die Tabellen und ihre Felder auf: hinzufügen, umbenennen, als erforderlich markieren, umsortieren,
beschreiben, das Anzeigefeld festlegen.

![Der Bildschirm Struktur einer Datenbank](../../../../assets/screens/structure.png)

Die Struktur zu ändern erfordert die Stufe **Verwalten**. Ohne sie lässt sich der Bildschirm
ansehen, bietet aber nichts an: keine Schaltfläche, kein Stift, kein Ziehgriff – ob ein Feld
erforderlich ist und welches das Anzeigefeld ist, wird angezeigt, nicht angeboten. Der Server
lehnt ohnehin jede Änderung ab; der Bildschirm tut nicht mehr so, als würde er sie annehmen.

Hinzufügen, Umbenennen und das Ändern des Typs eines Felds laufen über die
**Migrations-Engine**: ein Plan in Schritten, kurze Sperren und eine benannte Ablehnung, wenn
sich ein Wert nicht umwandeln lässt.

**Umbenennen** einer Datenbank, einer Tabelle oder eines Felds geschieht in einem einzigen Dialog.
Die Bezeichnung ändert sich immer, ohne Migration. Ein Administrator sieht darunter „Auch in der
Datenbank umbenennen: `clients` → `comptes`“: Ist die Option angehakt, ändert sich auch der
physische Name, und die Auswirkungsanalyse erscheint – die Abfragen, SQL-Views und
Automatisierungen, die den alten Namen zitieren. Der alte Name wird weiterhin von einem
**Kompatibilitätsalias** – einer View – bedient, bis Ihre Abfragen aktualisiert sind.

Löschen entfernt nichts sofort: Die Tabelle oder Datenbank wird beiseitegelegt
(`zz_supprime_…`) und bleibt in SQL lesbar. Eine gelöschte Datenbank lässt sich wiederherstellen;
eine einzelne Tabelle aus der Oberfläche zurückzuholen ist [geplant](/basedb/de/feuille-de-route/).
Die endgültige **Bereinigung** ist der Administration vorbehalten, dreißig Tage danach, und
beginnt mit einem geprüften CSV-Export.
