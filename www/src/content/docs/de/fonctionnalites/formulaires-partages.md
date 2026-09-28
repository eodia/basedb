---
title: Freigegebene Formulare
description: Ein Formular per Link freigeben, öffentlich oder nur für angemeldete Mitglieder.
---

Ein Formular oder eine Umfrage wird **per Link** `/f/<jeton>` **freigegeben**. Die antwortende
Person braucht **keine Berechtigung für die Tabelle**: Jede Antwort fügt eine Zeile hinzu, und
sonst wird ihr nichts von der Tabelle gezeigt. Um Zeilen zu zeigen, statt welche zu empfangen,
wird eine Ansicht [schreibgeschützt](/basedb/de/fonctionnalites/vues-partagees/) freigegeben.

![Der Freigabedialog](../../../../assets/screens/partage-formulaire.png)

## Wer antworten kann

| Zugriff | Wer antwortet | Was angezeigt wird |
|---|---|---|
| **Öffentlich** | alle, die den Link haben, ohne Konto | nur das Formular |
| **Angemeldete Mitglieder** | ein Mitglied des Arbeitsbereichs – bei Bedarf nur bestimmter Gruppen | die Anmeldung, dann das Formular und „Sie antworten als …“ |

Die Seite des Links liegt außerhalb der Anwendung: keine Seitenleiste, kein Datenbankname, keine
anderen Zeilen. Sie trägt die Darstellung des Formulars – sein Thema, seine Farbe, seine
Schriftart – und fragt nur die Fragen, die frühere Antworten verlangen.

![Ein öffentliches Formular](../../../../assets/screens/formulaire-public.png)

## In wessen Namen die Antwort geschrieben wird

Die Zeile wird unter der **Autorität der Person geschrieben, die die Freigabe veröffentlicht hat** –
derjenigen, die sie zuletzt gespeichert hat. Ihr Recht, Zeilen anzulegen, wird **bei jeder
Antwort** geprüft, beschränkt auf die Fragen des Formulars: Verliert sie es, wird das Formular
ausgesetzt, bis jemand, der es besitzt, es erneut speichert.

Der Verlauf nennt, wer geantwortet hat, nicht, wer veröffentlicht hat:

- eine Antwort eines **Mitglieds** wird der Person zugeordnet;
- eine **öffentliche** Antwort wird dem Formular selbst zugeordnet: „Formular ‚Demande de
  devis‘ · öffentliche Antwort · veröffentlicht von Camille“.

## Öffnen und schließen

Der Dialog regelt:

- den Schalter **Link aktiv**;
- ein **Schließdatum**;
- eine **Höchstzahl an Antworten** – exakt, auch bei gleichzeitigen Antworten;
- **Link neu erzeugen**: Der alte funktioniert sofort nicht mehr;
- **Freigabe beenden**: Der Link verschwindet, die Antworten bleiben in der Tabelle.

Ein geschlossenes Formular sagt das in einem Satz, noch bevor es eine Anmeldung verlangt.

## Grenzen

- Fragen vom Typ **Verknüpfung**, **Datei** und **Bild** werden über einen freigegebenen Link nicht
  gestellt; der Dialog weist darauf hin.
- Das Absenden ist auf 20 Antworten pro Minute, pro Adresse und pro Link begrenzt. Hinter dem
  mitgelieferten Proxy (Caddy) ist die Adresse die der besuchenden Person.

Die Einzelheiten stehen in [Kapitel 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
des Architekturdokuments.
