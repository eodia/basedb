---
title: Künstliche Intelligenz
description: Die KI-Option eines Felds, die Entwürfe, der Copilot und der Copilot der Dashboards – und was an den Anbieter geht.
---

KI ist **optional**. Ohne konfigurierten Anbieter geht nichts irgendwohin. basedb kann mit
**OpenAI**, **Anthropic** und **Mistral** sprechen, mit Ihrem eigenen Schlüssel.

## Einen Anbieter konfigurieren

Solange in der Oberfläche keine Einstellung gespeichert ist, liest die API ihre Umgebung:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic oder mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # oder BASEDB_AI_API_KEY
```

Der Schlüssel wird aus `BASEDB_AI_API_KEY` gelesen oder, falls nicht vorhanden, unter dem üblichen
Namen des Anbieters (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## Die KI-Option eines Felds

KI ist kein Feldtyp, sondern eine **Option**: Der Schalter **KI** im Formular eines Felds – Text,
Langtext, URL, Zahl, Einfachauswahl, Boolean, Datum – lässt es von einem Modell ausfüllen, ausgehend
von einer Anweisung, die andere Spalten zitiert:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Das Feld wird berechnet, sobald die Zeile existiert, und dann jedes Mal, wenn sich eine zitierte
  Spalte ändert – und, wenn gewünscht, nach einem Zeitplan (höchstens alle 15 Minuten).
- Die Spalte **behält ihren Typ**: Eine Antwort, in der sich nichts in diesem Typ lesen lässt (keine
  auffindbare Zahl, eine nicht existierende Option), wird abgelehnt statt geschrieben.
- Wird die Option deaktiviert, lässt sich das Feld wieder von Hand bearbeiten; die Werte bleiben
  erhalten.
- Die zitierten Werte gehen an den Anbieter: **Die Aktivierung erfordert eine ausdrückliche
  Zustimmung**.

`BASEDB_AI_FIELD_QUOTA` begrenzt diese Berechnungen pro Stunde und pro Arbeitsbereich
(standardmäßig 300).

## In einer Automatisierung

Eine [Automatisierung](/basedb/de/fonctionnalites/automatisations/#ki-fragen) kann in einem ihrer
Schritte **die KI fragen**: eine Anweisung, die die Zeile und die vorherigen Schritte zitiert, eine
Antwort, die im gewählten Typ gelesen wird und die die folgenden Schritte schreiben, senden oder
zitieren. Es gelten dieselben Regeln wie für ein Feld: Zustimmung beim Speichern, nur was die
Anweisung zitiert, geht hinaus, jeder Aufruf wird protokolliert und gegen `BASEDB_AI_FIELD_QUOTA`
gezählt.

## Entwürfe und Copilot

- **Entwürfe**: eine Tabelle oder eine Formel in einem Satz beschreiben und einen Vorschlag zum
  Prüfen erhalten. Es gehen nur Bezeichnungen, Typen und der eingegebene Satz hinaus – kein
  Zellenwert.
- **Vorlagen**: eine ganze Datenbank beschreiben – „die Nachverfolgung der Reklamationen meiner
  Kunden“ – und Tabellen, Beispielzeilen, Ansichten, Dashboard und Automatisierungen erhalten, zum
  Verfeinern und anschließenden Anlegen. Nur der Satz geht hinaus. Siehe [Datenbankvorlagen](/basedb/de/fonctionnalites/modeles/#bei-der-ki-anfragen).
- **Copilot**: eine Unterhaltung über die angezeigte Datenbank. Sie bitten um einen Filter, eine
  Abfrage, Spalten, eine Tabelle, einen Testdatensatz; jeder Vorschlag kommt als Karte und wird mit
  einem Klick angewendet, über dieselben Routen wie die Formulare.

Standardmäßig geht nur die Struktur an den Anbieter. Das Kästchen **„Lesen der Daten erlauben“**
gestattet dem Copilot für diese Unterhaltung, Zeilen zu lesen (höchstens 50 pro Lesevorgang) und
auf ihrer Grundlage zu antworten – jeder Lesevorgang wird unter seiner Antwort aufgelistet.

## Der Copilot der Dashboards

Im Bereich [Dashboards](/basedb/de/fonctionnalites/tableaux-de-bord/#der-copilot) schlägt der
Copilot Fragen, Änderungen am Dashboard und Werte für dessen Filter vor, die sich mit einem Klick
anwenden lassen. Dieselben Regeln: Ohne Zustimmung geht nur die Struktur hinaus – Tabellen und
Felder, Dashboards und Fragen der Datenbank, die Definition der Karten des angezeigten Dashboards
(ihre Fragen, ihre Texte) –, nie die Ergebnisse oder die in den Filtern gewählten Werte. Das
Kästchen **„Lesen der Daten erlauben“** fügt diese Werte und die Ergebnisse der Karten unter den
angezeigten Filtern hinzu, höchstens 50 Zeilen pro Lesevorgang, jeder unter der Antwort
aufgelistet.

## Der Copilot der Automatisierungen

Im Bereich [Automatisierungen](/basedb/de/fonctionnalites/automatisations/#der-copilot) schlägt der
Copilot eine vollständige Automatisierung vor – die auf dem Bildschirm, geändert, oder eine neue –,
die er auf den Ablauf im Editor legt, **ohne sie je zu speichern**: Sie prüfen sie und speichern sie
dann. Dieselben Regeln: Ohne Zustimmung geht nur die Struktur hinaus – Tabellen und Felder,
Automatisierungen der Datenbank, die auf dem Bildschirm, ihre letzten Ausführungen ohne jeden Wert,
Personen und Slack-Kanäle unter Platzhaltern –, und das Kästchen **„Lesen der Daten erlauben“**
fügt gelesene Zeilen hinzu, höchstens 50 pro Lesevorgang.

`BASEDB_AI_QUOTA` begrenzt die interaktiven Aufrufe pro Stunde und pro Arbeitsbereich (standardmäßig
120).
