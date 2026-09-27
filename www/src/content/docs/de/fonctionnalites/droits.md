---
title: Berechtigungen und Gruppen
description: Konten, Gruppen, Zugriffsstufen pro Projekt, Datenbank und Tabelle, Einschränkungen pro Feld und Ihre Einstellungen.
---

Berechtigungen werden an **Gruppen** vergeben, nie an einzelne Personen. Eine Stufe, die auf ein
Projekt, eine Datenbank oder eine Tabelle gesetzt wird, gilt für alles darunter, einschließlich
dessen, was später angelegt wird.

## Die vier Stufen

| Stufe | Erlaubt |
|---|---|
| **Kein Zugriff** | nichts: Die Ressource ist unsichtbar |
| **Lesen** | Zeilen sehen und kommentieren, sich persönliche Ansichten anlegen, die Struktur und die Dashboards ansehen, eigene Fragen stellen, schreibgeschütztes SQL schreiben und persönliche Abfragen speichern |
| **Bearbeiten** | außerdem Zeilen anlegen, ändern und löschen |
| **Verwalten** | außerdem die Struktur ändern, freigegebene Ansichten, Dashboards und gespeicherte Fragen anlegen, ein Dashboard per Link freigeben, Abfragen freigeben, SQL-Views, Automatisierungen, Integrationen und Token anlegen; ihr SQL hat die ganze Datenbank, Schreibvorgänge eingeschlossen |

Berechtigungen **addieren sich**: Eine Person erhält die höchste Stufe, die ihr eine ihrer Gruppen
gibt. Einer Tabelle weniger zu geben als ihrer Datenbank macht sie „granular“.

Zwei Gruppen gibt es immer: **Administratoren**, die alles verwalten, und **Alle Benutzer**, zu der
jedes Konto gehört – was man ihr gewährt, haben alle.

## Bis hinunter zum Feld

Unter dem Raster der Stufen verbirgt **Felder** eine Spalte vor einer Gruppe oder macht sie für sie
schreibgeschützt. Der Bildschirm zeigt außerdem, was eine bestimmte Person tatsächlich sieht und
über welche Gruppe.

Ein verborgenes Feld fehlt überall: im Raster, in den Ansichten, in der API, im MCP, im Verlauf, im
SQL, das in der Oberfläche geschrieben wird, und in den SQL-Views. Filtern oder Sortieren danach
antwortet wie bei einem Feld, das nicht existiert.

## Und SQL?

In der Oberfläche folgt SQL denselben Berechtigungen, von PostgreSQL selbst durchgesetzt: Ohne die
Stufe Verwalten läuft eine Abfrage schreibgeschützt über eine eigene Rolle der Person, in der eine
verschlossene Tabelle nicht existiert und ein verborgenes Feld abgelehnt wird. Eine [SQL-View](/basedb/de/fonctionnalites/requetes-et-vues-sql/)
wird mit den Berechtigungen der lesenden Person gelesen, und eine Abfrage freizugeben gibt nur ihren
Text frei.

Ein **direkter `psql`-Zugriff** auf die Datenbank wird dagegen nicht von basedb gesteuert: Er liest
alles, verborgene Felder eingeschlossen. Die Einschränkungen schützen die Oberflächen des Produkts –
Oberfläche, API, MCP –, nie gegenüber jemandem, der SQL-Zugriff auf die Datenbank hat; diese
Zugriffe werden über PostgreSQL-`GRANT`s geregelt, die der Betreiber setzt.

## Konten und Anmeldung

- Ein Konto wird mit einem **temporären Passwort** angelegt, das einmal angezeigt wird und bei der
  ersten Anmeldung zu ändern ist.
- Die Anmeldung erfolgt per Passwort oder über einen **OpenID-Connect**-Anbieter, den der Betreiber
  eingerichtet hat.
- Administrative Aktionen erfordern eine **erhöhte Sitzung**: ein Passwort, das in den letzten fünf
  Minuten erneut eingegeben wurde.
- Sitzungen lassen sich widerrufen; das Widerrufen einer Sitzung macht ihre Zugriffstoken sofort
  ungültig.

## Ihre Einstellungen

**Einstellungen** im Profilmenü unten links betrifft nur Sie:

| Reiter | Was Sie dort tun |
|---|---|
| **Profil** | der angezeigte Name; die Anmeldeadresse; die mit dem Konto verbundenen Identitätsanbieter, zum Verbinden oder Trennen |
| **Sicherheit** | das Passwort ändern; die offenen Sitzungen, einzeln oder alle zu schließen |
| **Darstellung** | die Sprache der Oberfläche; das Design; die Reihenfolge der Datumsangaben – `25/09/2026` oder `2026-09-25` – und der erste Wochentag der Kalender |
| **Benachrichtigungen** | die Arten von Benachrichtigungen, die Sie nicht mehr erhalten möchten |
| **Token** | die Integrationstoken, die Sie angelegt haben, über alle Ihre Datenbanken hinweg, ihre letzte Verwendung und ihr Widerruf |

basedb spricht **zwanzig Sprachen**: Französisch, Englisch, Deutsch, Spanisch, Italienisch,
Portugiesisch (Brasilien), Niederländisch, Polnisch, Tschechisch, Schwedisch, Dänisch, Norwegisch,
Finnisch, Rumänisch, Ungarisch, Türkisch, Ukrainisch, Japanisch, vereinfachtes Chinesisch und
Koreanisch. Standardmäßig übernimmt die Oberfläche die Sprache Ihres Browsers; **Sprache** unter
**Darstellung** legt eine andere fest. Zahlen und Datumsangaben folgen der gewählten Sprache.

Das Design bleibt an den Browser gebunden; Sprache, Datumsreihenfolge und erster Wochentag folgen
Ihnen von einem Rechner zum anderen. Die Adresse zu ändern oder einen Anbieter zu verbinden
erfordert eine erhöhte Sitzung; ein Konto ohne Passwort, das sich über einen Anbieter anmeldet,
behält die Adresse dieses Anbieters.

## Der einzige Durchsetzungspunkt

Alle Oberflächen – Benutzeroberfläche, API, MCP, freigegebene Formulare und Ansichten,
Automatisierungen – laufen über denselben Entscheidungspunkt für Berechtigungen im Kern. Es gibt
keine private Route der Oberfläche: Was der Bildschirm nicht anzeigt, hat die API nicht
zurückgegeben.

Umgekehrt gilt auch: Der Bildschirm **bietet nicht an, was abgelehnt würde**. Ohne die Stufe
Verwalten lässt sich der Bildschirm Struktur ohne Schaltfläche und Stift ansehen, und der Import
bietet nicht an, eine Tabelle anzulegen; ohne das Recht, Zeilen anzulegen oder zu löschen, bietet
das Raster weder eine Zeile zum Hinzufügen noch „Löschen“ an.
