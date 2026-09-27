---
title: Freigegebene Ansichten
description: Eine Ansicht schreibgeschützt per Link zeigen, in eine Website einbetten, einen Kalender abonnieren.
---

Eine Datenansicht – Raster, Kanban, Kalender, Zeitachse, Galerie, Liste – wird **schreibgeschützt
freigegeben**: Ein Link `/v/<jeton>` zeigt sie Personen, die basedb nicht öffnen können, ohne
irgendein Schreiben zu erlauben. Das ist das Gegenstück zu den [freigegebenen Formularen](/basedb/de/fonctionnalites/formulaires-partages/),
die antworten lassen, ohne etwas lesen zu lassen. Ein [Dashboard](/basedb/de/fonctionnalites/tableaux-de-bord/#ein-dashboard-freigeben)
wird auf dieselbe Weise freigegeben.

## Freigeben

Menü der Ansicht → **Freigeben …**, dann:

| Zugriff | Wer liest |
|---|---|
| **Öffentlich** | alle, die den Link haben, ohne Konto |
| **Angemeldete Mitglieder** | ein Mitglied des Arbeitsbereichs, nach der Anmeldung – bei Bedarf nur bestimmter Gruppen |

![Die Freigabe eines Kalenders](../../../../assets/screens/partage-vue.png)

Der Schalter **Link aktiv** setzt den Link aus, ohne ihn zu verlieren. Die Seite öffnet sich
außerhalb der Anwendung: keine Seitenleiste, kein Datenbankname, kein Tabellenname – die Ansicht,
ihre Filter, ihre Spalten und sonst nichts. Ein Kalender oder eine Zeitachse liest sich dort wie
ein Terminkalender.

![Derselbe Kalender, über seinen Link geöffnet](../../../../assets/screens/vue-partagee.png)

## In wessen Namen gelesen wird

Die Ansicht wird mit den **Berechtigungen der Person gelesen, die sie veröffentlicht hat**, bei
jedem Lesen neu entschieden: Ein Feld, das ihr verborgen ist, wird nicht angezeigt, und verliert
sie den Zugriff auf die Tabelle, zeigt der Link gar nichts mehr.

## In eine andere Website einbetten

Haken Sie **Einbettung in eine andere Website erlauben** an: Der Dialog liefert einen
**Einbettungscode** `<iframe>`, den Sie in ein Intranet, ein Wiki oder eine Unternehmenswebsite
einfügen. Ohne dieses Häkchen weigert sich die Seite, im Rahmen einer anderen Website angezeigt
zu werden.

## Ein Kalender in Ihrer Kalender-App

Für einen Kalender oder eine Zeitachse, die **öffentlich** freigegeben sind, liefert der Dialog
die **Adresse des Kalender-Feeds**: einen iCalendar-Feed (`…/calendar.ics`, höchstens 1 000
Termine), den Google Kalender, Outlook oder Apple Kalender abonnieren. Die Fristen des Teams
erscheinen im Kalender jeder Person und folgen der Tabelle.

## Eine Quelle für andere Datenbanken

Ein öffentlicher Link liefert außerdem die **API-Adresse der Ansicht**: die Zeilen, die sie zeigt,
als JSON. Eine [synchronisierte Tabelle](/basedb/de/integrations/synchronisation/) – auf dieser
Instanz oder einer anderen – kann sie als Quelle verwenden.

## Grenzen

- Das Lesen ist auf 120 Anfragen pro Minute, pro Adresse und pro Link begrenzt.
- Ein Formular wird nicht zum Lesen freigegeben: Es wird [freigegeben, um Antworten zu empfangen](/basedb/de/fonctionnalites/formulaires-partages/).
