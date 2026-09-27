---
title: Erste Schritte
description: Eine Datenbank, eine Tabelle, Felder, eine Ansicht und ein Formular anlegen.
---

Dieser Rundgang dauert zehn Minuten und deckt das Wesentliche ab: Am Ende haben Sie eine Tabelle,
eine Kanban-Ansicht und ein öffentliches Formular, das in die Tabelle schreibt.

:::tip[Alles auf einmal sehen]
Ein leeres Projekt bietet die **Demo-Datenbank** an: eine kleine Agentur mit ihren Kunden,
Projekten, Aufgaben, Rechnungen und Bewertungen, mit Formeln, Ansichten jeder Art, einem Dashboard
und Automatisierungen. **Neue Datenbank** öffnet außerdem die [Vorlagengalerie](/basedb/de/fonctionnalites/modeles/),
in der Sie Ihre Datenbank der KI beschreiben können.
:::

## 1. Eine Datenbank anlegen

Alles ist nach **Projekt** geordnet: Die Auswahl oben in der Seitenleiste wechselt das Projekt
oder legt ein neues an. In der Leiste legt das **+** rechts neben dem Filter eine Datenbank an.
Geben Sie ihr eine Bezeichnung – „Ventes“ – und, wenn Sie möchten, eine Beschreibung, eine Farbe
und ein Symbol.

Die Datenbank wird zu einem **PostgreSQL-Schema**: Ihr physischer Name (`b_t4z56fq_ventes`)
erscheint im Formular und in der generierten Dokumentation.

## 2. Eine Tabelle und ihre Felder anlegen

Im Menü **⋯** der Datenbank: **Neue Tabelle**. Fügen Sie anschließend ihre Felder über
**Struktur** – im selben Menü – und dessen Schaltfläche
**Feld** hinzu:

| Feld | Typ |
|---|---|
| Nom | Kurztext |
| Statut | Einfachauswahl – Nouveau, Qualifié, Gagné, Perdu |
| Montant | Währung |
| Échéance | Datum |
| Client | Verknüpfung → Clients |
| Notes | Langtext (Markdown) |

Später kommen eine Formel (`JOURS([Échéance]; AUJOURDHUI())`), ein Nachschlagefeld (der Ort
des Kunden) oder eine Aggregation (der Gesamtbetrag pro Kunde) auf dieselbe Weise hinzu – siehe
[Tabellen und Felder](/basedb/de/fonctionnalites/tables-et-champs/).

Sie können auch **eine Datei importieren**, CSV oder JSON: Der Import errät die Typen, lässt Sie
sie korrigieren, legt die Tabelle an oder ergänzt eine bestehende und nennt Zeile für Zeile, was
er ablehnt.

![Menü einer Datenbank](../../../../assets/screens/menu-base.png)

## 3. Eingeben und filtern

Das Raster wird wie eine Tabellenkalkulation bearbeitet: Doppelklick oder Eingabetaste, um eine
Zelle zu bearbeiten, Esc zum Abbrechen. **Filtern** kombiniert Bedingungen pro Feld; sortiert wird
über den Spaltenkopf; **Suchen …** rechts in der Leiste sucht in allen Spalten. Jede Änderung wird
sofort gespeichert – und im [Verlauf](/basedb/de/fonctionnalites/historique/) festgehalten:
**Strg+Z** macht die letzte rückgängig.

## 4. Eine Ansicht hinzufügen

Die Ansichtsauswahl links neben „Filtern“ bietet „Alle Zeilen“ und dann Ihre Ansichten an.
Legen Sie ein **Kanban** an, gruppiert nach „Statut“: Wenn Sie eine Karte von einer Spalte in
eine andere ziehen, wird die Zeile geändert.

![Ein Kanban nach Status](../../../../assets/screens/kanban.png)

## 5. Ein Formular freigeben

Legen Sie eine Ansicht **Formular** an, haken Sie die Fragen an und klicken Sie dann auf
**Freigeben**: Wählen Sie „Öffentlich“ und kopieren Sie den Link. Jede Antwort fügt der Tabelle
eine Zeile hinzu, ohne der antwortenden Person irgendeine Berechtigung zu geben. Details unter
[Freigegebene Formulare](/basedb/de/fonctionnalites/formulaires-partages/).

## 6. In SQL lesen

Menü **⋯** der Datenbank → **Neue SQL-Abfrage**: Ihre Tabellen sind da, unter ihrem echten Namen.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Speichern** legt sie unter den Tabellen ab, in der Rubrik „Abfragen“ – für Sie oder für die
ganze Datenbank –, und **⋯** → **SQL-View erstellen …** macht daraus eine echte PostgreSQL-View,
die zwischen den Tabellen steht. Jeder liest sie mit den eigenen Berechtigungen. Siehe
[Abfragen und SQL-Views](/basedb/de/fonctionnalites/requetes-et-vues-sql/).

Genauso funktioniert es aus `psql` oder Ihrem BI-Tool. Siehe [Direktes SQL](/basedb/de/integrations/sql/).
