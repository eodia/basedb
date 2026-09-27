---
title: Automatisierungen
description: Wenn sich eine Zeile ändert, zu fester Uhrzeit oder per Klick – bearbeiten, anlegen, suchen, verzweigen, die KI fragen, benachrichtigen, einen Webhook aufrufen, in Slack schreiben.
---

Eine Automatisierung sagt **wann**, **falls** und **dann**: Wenn eine Aufgabe auf „Fait“ wechselt,
die Uhrzeit festhalten; wenn eine negative Bewertung eingeht, die Verantwortliche benachrichtigen
und in Slack schreiben; jeden Montag um 9 Uhr die Zeile für das Teammeeting anlegen. Und wenn eine
Aktion nicht genügt, folgt sie einem **Ablauf**: eine Zeile suchen, je nach deren Inhalt den einen
oder anderen Zweig nehmen, in einem Schritt wiederverwenden, was ein vorheriger Schritt gefunden
oder geschrieben hat.

Sie öffnen sich über **Automatisierungen** im Block der geöffneten Datenbank unten in der
Seitenleiste und erfordern die Stufe **Verwalten**.

![Ein Ablauf und eine seiner Ausführungen, darübergelegt](../../../../assets/screens/automatisations.png)

## Der Ablauf

Der Ablauf wird von oben nach unten gezeichnet: der Auslöser, dann jeder Schritt. Ein **+** auf
einer Linie fügt an dieser Stelle einen Schritt hinzu; eine Karte öffnet ihre Einstellungen
rechts. Eine einfache Automatisierung – ein Auslöser und eine Aktion – passt auf zwei Karten und
wird eingestellt wie bisher.

## Wann

| Auslöser | Einstellungen |
|---|---|
| **Eine Zeile wird angelegt** | die Tabelle |
| **Eine Zeile wird geändert** | die Tabelle und bei Bedarf nur die zu überwachenden Felder |
| **Zu fester Uhrzeit** | stündlich, täglich oder wöchentlich, zur gewählten Uhrzeit und in der gewählten Zeitzone |
| **Klick auf eine Schaltfläche** | ein [Feld Schaltfläche](/basedb/de/fonctionnalites/tables-et-champs/#schaltfläche) der Tabelle |

Ein Auslöser auf Zeilen sieht **alle** Schreibvorgänge: die Oberfläche, die API, einen Agenten,
ein freigegebenes Formular und sogar direktes SQL – Automatisierungen gehen vom Verlauf aus, der
sie alle erfasst.

## Nur falls

Eine optionale Bedingung in der [Filtersprache](/basedb/de/integrations/api-rest/#lesen) –
`statut eq "fait"`, `montant gte 10000 and payee eq false` –, ausgewertet auf der Zeile **im
Moment des Handelns**. Eine Ausführung, deren Bedingung nicht erfüllt ist, wird „übersprungen“ und
sagt das.

## Dann

Bis zu dreißig Schritte, der Reihe nach; der erste, der fehlschlägt, stoppt die folgenden.

| Schritt | Was er tut |
|---|---|
| **Zeile bearbeiten** | schreibt Werte in die auslösende Zeile – oder in die, die ein Schritt gefunden oder angelegt hat |
| **Zeile anlegen** | in dieser Tabelle oder einer anderen der Datenbank |
| **Zeile suchen** | die erste Zeile einer Tabelle, die einem Filter entspricht, damit die folgenden Schritte sie zitieren oder bearbeiten |
| **Jemanden benachrichtigen** | eine [Benachrichtigung](/basedb/de/fonctionnalites/collaboration/#benachrichtigungen) an ausgewählte Personen oder an die Person aus einem Feld Person |
| **Webhook aufrufen** | ein `POST` über HTTPS an die Adresse Ihrer Wahl; seine Antwort lässt sich anschließend zitieren |
| **An Slack senden** | eine Nachricht in einen [verbundenen](/basedb/de/integrations/synchronisation/#slack) Kanal |
| **KI fragen** | eine Antwort des [KI-Anbieters](/basedb/de/fonctionnalites/ia/) auf eine Anweisung, die die Zeile und die vorherigen Schritte zitiert – verfassen, zusammenfassen, einordnen –, gelesen als Text, Zahl, Ja oder Nein, Datum oder Auswahl aus einer Liste |
| **Bedingung** | mehrere Zweige: Der erste, dessen Bedingung erfüllt ist, wird genommen, „Sonst“, wenn keiner es ist; die Zweige laufen danach wieder zusammen |

Eine Suche, die nichts findet, stoppt den Ablauf nicht: Die Schritte, die ihre Zeile bearbeiten
sollten, werden übersprungen. Um in diesem Fall etwas anderes zu tun, prüft das eine Bedingung –
ein Zweig mit leerem Filter wird genommen, sobald die Suche etwas gefunden hat.

## KI fragen

Wie ein [KI-Feld](/basedb/de/fonctionnalites/ia/#die-ki-option-eines-felds) sendet der Schritt dem
Anbieter seine Anweisung, in der jedes Zitat durch seinen Wert ersetzt ist:

```text
Cet avis de {{auteur}} demande-t-il une action de notre part ? {{avis}}
```

Sie wählen die **erwartete Antwort** – ein freier oder kurzer Text, eine Zahl, Ja oder Nein, ein
Datum, eine Webadresse oder eine Auswahl aus einer Liste, die Sie aus einem Auswahlfeld übernehmen
können. Das Modell wird darüber informiert, und eine Antwort, die keine solche enthält, lässt den
Schritt fehlschlagen. Die folgenden Schritte zitieren sie mit `{{e1.reponse}}`: im Titel einer
angelegten Aufgabe, in einer Nachricht oder in einem Auswahlfeld, wo sie der Option mit derselben
Bezeichnung zugeordnet wird.

Was die Anweisung zitiert, geht an den Anbieter: Der Schritt verlangt Ihre **Zustimmung**, die bei
jeder Änderung der Anweisung erneut zu geben ist. Jeder Aufruf wird protokolliert und zählt,
zusammen mit den KI-Feldern, gegen `BASEDB_AI_FIELD_QUOTA` (standardmäßig 300 pro Stunde). Die KI
tut nichts von sich aus: Es sind die nach ihr gesetzten Schritte, die schreiben oder benachrichtigen.

## Zitieren

Werte, Nachrichten und Filter zitieren, was vorausgeht, über die Schaltfläche **{ }** neben
jedem Text:

- `{{Titre}}`, `{{_id}}`: die auslösende Zeile;
- `{{e2.titre}}`, `{{e2._id}}`: die Zeile, die Schritt `e2` gefunden, angelegt oder bearbeitet
  hat – jeder Schritt trägt seine Kennung auf seiner Karte;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: was der Webhook `e3` geantwortet hat;
- `{{e4.reponse}}`: die Antwort des KI-Schritts `e4`;
- `{{_maintenant}}`: der Zeitpunkt der Ausführung.

Ein Wert, der aus einem einzigen Zitat besteht, übergibt den Wert selbst: eine Verknüpfung, eine
Person, eine Auswahl – so wird eine angelegte Zeile mit der verknüpft, die eine Suche gefunden hat.
In einem Filter ist ein Zitat immer ein verglichener Wert, nie Filtersprache.

Ein Schritt kann nur zitieren, was mit Sicherheit vor ihm stattgefunden hat: Was ein Zweig
gefunden hat, lässt sich nach der Bedingung nicht mehr zitieren. Der Editor zeigt das vor dem
Speichern auf der Karte an.

## Der Copilot

**Copilot** im Kopfbereich öffnet rechts eine Unterhaltung in natürlicher Sprache über die
Automatisierungen der Datenbank: „Wenn eine Aufgabe in die Prüfung geht, benachrichtige die
zugewiesene Person“, „Füge eine KI-Zusammenfassung in die Notizen ein“, „Warum ist die letzte
Ausführung fehlgeschlagen?“. Er antwortet und **schlägt** eine vollständige Automatisierung **vor** –
die auf dem Bildschirm, geändert, oder eine neue –, mit der Liste dessen, was sich ändert.

Der Copilot speichert nichts: **Auf den Ablauf legen** zeigt den Vorschlag im Editor, wo Sie ihn
vor dem Speichern prüfen – und **Abbrechen** auf der Karte stellt den Ablauf wieder her, wie er
war. Eine neue Automatisierung öffnet sich im Editor, noch anzulegen. Jeder Vorschlag wird geprüft,
wie es ein Speichern würde; was nicht hält, wird verworfen, und das wird gesagt.

Standardmäßig geht **nur die Struktur** zusammen mit der Unterhaltung an den KI-Anbieter: die
Tabellen und ihre Felder, die Automatisierungen der Datenbank, die auf dem Bildschirm so, wie der
Editor sie zeigt, und ihre letzten Ausführungen – deren Status und Fehlercodes, nie ein Wert.
Personen und Slack-Kanäle werden unter Platzhaltern (`p1`, `s1`) übermittelt, nie mit ihrer
Kennung. Das Kästchen **Lesen der Daten erlauben** gestattet dem Copilot für diese Unterhaltung,
Zeilen zu lesen (höchstens 50 pro Lesevorgang), wobei jeder Lesevorgang unter seiner Antwort
aufgelistet wird.

## Testen, verfolgen

**An einer Zeile testen** führt die gespeicherte Automatisierung auf einer gewählten Zeile aus,
und zwar wirklich. Der Reiter **Ausführungen** bewahrt die letzten 50 für 30 Tage auf: wartend,
laufend, erfolgreich, übersprungen mit Grund, fehlgeschlagen mit Code. Wählen Sie eine aus, wird sie
auf den Ablauf gelegt – der genommene Zweig ist nachgezeichnet, jeder durchlaufene Schritt sagt,
was er getan hat und wie lange es gedauert hat, der Rest ist ausgegraut.

## In wessen Namen sie handelt

Eine Automatisierung handelt mit den **Berechtigungen der Person, die sie zuletzt gespeichert
hat**, bei jeder Ausführung neu entschieden: Verliert diese Person eine Berechtigung, schlägt der
Schritt, der sie brauchte, fehl, statt sich darüber hinwegzusetzen, und eine Suche findet nur,
was sie lesen darf. Der Verlauf zeigt sie als „Automatisierung ‚Tâche terminée‘ · im Namen von …“,
und ihre Schreibvorgänge lassen sich wie alle anderen rückgängig machen.

## Grenzen

- Was eine Automatisierung schreibt, löst keine andere aus: Was aufeinander folgen soll, gehört
  in einen einzigen Ablauf.
- Eine Suche liefert eine Zeile, die erste; noch kein „für jede Zeile“ und kein Warten („drei
  Tage danach“).
- Keine E-Mail, kein Skript.
- Eine Bedingung prüft eine Zeile: Um je nach KI-Antwort einen Zweig zu nehmen, schreiben Sie
  diese zuerst in ein Feld der Zeile.
- Eine [Datenbankvorlage](/basedb/de/fonctionnalites/modeles/) übernimmt nur Automatisierungen
  ohne Suche, Bedingung oder KI-Schritt.
- 100 Ausführungen pro Stunde und pro Automatisierung; ein verpasster Zeitpunkt wird nur einmal
  nachgeholt.
- Die Verzögerung zwischen Schreibvorgang und Aktion liegt im Bereich einer Sekunde.
