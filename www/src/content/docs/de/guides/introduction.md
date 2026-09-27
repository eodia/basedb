---
title: Einführung
description: Was basedb ist und was es von kollaborativen Tabellenkalkulationen unterscheidet.
---

**basedb** ist eine kollaborative Datenbank im Geist kollaborativer Tabellenkalkulationen,
die Sie selbst hosten – mit einem Unterschied, der alles Weitere bestimmt: **Ihre Daten
liegen in echten PostgreSQL-Tabellen**, typisiert und mit lesbaren Namen.

![Das Raster einer Tabelle in basedb](../../../../assets/screens/grille.png)

## Ein einfaches Versprechen

Kein generisches Modell, kein `JSONB` als Sammelbecken, kein `field_1837`:

| In basedb | In PostgreSQL |
|---|---|
| Eine Datenbank „Ventes“ | ein Schema `b_t4z56fq_ventes` |
| Eine Tabelle „Opportunités“ | eine Tabelle `opportunites` |
| Ein Feld „Échéance“ (Datum) | eine Spalte `echeance date` |
| Eine Einfachauswahl „Statut“ | eine Spalte `text` mit ihrer `CHECK`-Constraint |
| Eine Verknüpfung „Client“ | eine Spalte `clients_id uuid` mit ihrem `FOREIGN KEY` |

Sie können also `psql`, ein BI-Tool oder ein Python-Skript öffnen und Ihre Daten lesen, ohne
über das Produkt zu gehen – und sogar hineinschreiben: Die Constraints greifen, und der Verlauf
zeichnet den Schreibvorgang auf.

## Für wen?

- **Fachabteilungen**, die ein Raster, Ansichten und Formulare wollen, ohne auf eine
  Entwicklung zu warten.
- **Technische Teams**, die ihre Daten nicht in einem proprietären Format eingeschlossen sehen
  wollen und ihre gewohnten Werkzeuge anbinden möchten.
- **KI-Agenten**, die einen MCP-Server, klare Berechtigungen und Vorschläge vorfinden, die
  einem Menschen zur Genehmigung vorgelegt werden.

## Was Sie darin finden

- Typisierte [Tabellen und Felder](/basedb/de/fonctionnalites/tables-et-champs/), Verknüpfungen,
  die echte Fremdschlüssel sind – auch mehrfache –, von PostgreSQL berechnete Formeln,
  Nachschlagefelder und Aggregationen über Verknüpfungen hinweg.
- Acht [Ansichten](/basedb/de/fonctionnalites/vues/): Raster, Kanban, Kalender, Zeitachse,
  Galerie, Liste, Formular, Umfrage – kollaborativ oder persönlich.
- [Formulare](/basedb/de/fonctionnalites/formulaires-partages/) und
  [Ansichten](/basedb/de/fonctionnalites/vues-partagees/), die per Link freigegeben werden, und
  Kalender, die sich aus einer Kalender-App abonnieren lassen.
- [Zusammenarbeit](/basedb/de/fonctionnalites/collaboration/): Kommentare und Erwähnungen,
  Benachrichtigungen, Aktualisierungen in Echtzeit.
- [Automatisierungen](/basedb/de/fonctionnalites/automatisations/) und
  [Dashboards](/basedb/de/fonctionnalites/tableaux-de-bord/) mit ihren Fragen, per Maus oder in SQL erstellt.
- [SQL für alle](/basedb/de/fonctionnalites/requetes-et-vues-sql/), jeweils mit den eigenen Berechtigungen:
  gespeicherte Abfragen unter den Tabellen und echte PostgreSQL-Views, die zwischen ihnen stehen.
- [Datenbankvorlagen](/basedb/de/fonctionnalites/modeles/), aus einer Galerie zu übernehmen oder
  bei der KI anzufragen.
- [Umgebungen](/basedb/de/fonctionnalites/environnements/) – Produktion, Staging –, die man
  vergleicht und migriert.
- Ein [Verlauf](/basedb/de/fonctionnalites/historique/) jedes Schreibvorgangs, direktes SQL
  eingeschlossen, und Strg+Z zum Rückgängigmachen.
- [Berechtigungen](/basedb/de/fonctionnalites/droits/) pro Gruppe, bis hinunter zum Feld.
- Eine [REST-API](/basedb/de/integrations/api-rest/), ein [MCP-Server](/basedb/de/integrations/mcp/),
  [Webhooks](/basedb/de/integrations/webhooks/), Slack und
  [synchronisierte Tabellen](/basedb/de/integrations/synchronisation/).
- [KI](/basedb/de/fonctionnalites/ia/) als Option: von einem Modell berechnete Felder, Copilot.

## Projektstatus

basedb ist freie Software (AGPL-3.0), entwickelt von [Eodia](https://eodia.com/fr/), einem
KI-nativen Softwarestudio, und wird aktiv weiterentwickelt. Kern, API, MCP-Server
und Oberfläche funktionieren und sind durch mehr als tausend Tests abgedeckt; die
[Roadmap](/basedb/de/feuille-de-route/) nennt, was noch kommt. Das
[Architekturdokument](https://github.com/eodia/basedb/tree/main/docs/architecture) mit rund
zwanzig Kapiteln hält jede Entscheidung fest.

:::tip[Ausprobieren]
Ist das Repository geklont, genügt ein Befehl: `docker compose up -d`. Siehe
[Installation](/basedb/de/guides/installation/).
:::
