---
title: Zusammenarbeit
description: Kommentare und Erwähnungen, Benachrichtigungen, Aktualisierungen in Echtzeit und Präsenz.
---

Mehrere Personen arbeiten gleichzeitig an derselben Datenbank: Jede sieht die Schreibvorgänge der
anderen eintreffen, weiß, wer was ansieht, und bespricht eine Zeile genau dort, wo sie steht.

## Kommentare

Die Zeilendetails haben einen Reiter **Kommentare** zwischen „Details“ und „Verlauf“. Tippen Sie
`@`, um ein Mitglied zu **erwähnen**, und Strg+Eingabe zum Senden. Jede Person bearbeitet oder
löscht ihre eigenen Kommentare.

![Eine Unterhaltung zu einem Projekt](../../../../assets/screens/commentaires.png)

Wer die Zeile lesen darf, darf sie auch kommentieren. Eine erwähnte Person, die sie nicht lesen
darf, wird nicht benachrichtigt – und die Verfasserin oder der Verfasser erfährt das, statt zu
glauben, die Nachricht sei angekommen.

## Benachrichtigungen

Die Glocke oben rechts zählt, was ungelesen ist. Vier Dinge landen dort:

- jemand **erwähnt** Sie in einem Kommentar;
- jemand **antwortet** in einer Unterhaltung, in der Sie geschrieben haben;
- jemand **trägt** Sie in ein Feld Person **ein** – über die Oberfläche, die API, ein Formular
  oder eine Automatisierung;
- eine [Automatisierung](/basedb/de/fonctionnalites/automatisations/) **benachrichtigt** Sie.

Wer eine Benachrichtigung öffnet, öffnet die Zeile. **Alle als gelesen markieren** leert den
Zähler; Benachrichtigungen werden 90 Tage aufbewahrt.

![Eine erhaltene Erwähnung](../../../../assets/screens/notifications.png)

## Echtzeit

Die Schreibvorgänge der anderen erscheinen **ohne Neuladen**: eine geänderte Zelle, eine
verschobene Karte, eine hinzugefügte Zeile – ob sie aus der Oberfläche, der API, von einem Agenten
oder aus direktem SQL stammen. Der Server sendet nur ein **Signal**, nie Daten: Der Bildschirm
liest selbst neu, mit Ihren Berechtigungen. Eine Zelle, die Sie gerade bearbeiten, wird Ihnen nie
unter den Fingern ersetzt.

## Präsenz

Die Gesichter der Personen, die **dieselbe Tabelle** ansehen, erscheinen oben auf dem Bildschirm;
die derjenigen, die **dieselbe Zeile** geöffnet haben, im Kopf ihrer Zeilendetails. Im Raster
erscheint der Mauszeiger der anderen auf der Zelle, über der er gerade steht.

## Rückgängig machen

Strg+Z macht Ihren letzten Schreibvorgang rückgängig – siehe [den Verlauf](/basedb/de/fonctionnalites/historique/#rückgängig-machen-strgz).

## Grenzen

- Benachrichtigungen bleiben in basedb: Bisher wird keine per E-Mail versandt.
- Ändern sich mehr als hundert Zeilen auf einmal, lädt der Bildschirm die ganze Seite neu statt
  Zeile für Zeile.
