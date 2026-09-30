---
title: Introductie
description: Wat basedb is, en wat het onderscheidt van collaboratieve spreadsheets.
---

**basedb** is een collaboratieve database in de geest van collaboratieve spreadsheets,
die je zelf host — met één verschil dat al het andere bepaalt: **je gegevens leven in echte
PostgreSQL-tabellen**, getypeerd en met leesbare namen.

![Het raster van een tabel in basedb](../../../../assets/screens/nl/grille.webp)

## Een eenvoudige belofte

Geen generiek model, geen `JSONB` als vergaarbak, geen `field_1837`:

| In basedb | In PostgreSQL |
|---|---|
| Een database “Ventes” | een schema `b_t4z56fq_ventes` |
| Een tabel “Opportunités” | een tabel `opportunites` |
| Een veld “Échéance” (Datum) | een kolom `echeance date` |
| Een enkele keuze “Statut” | een kolom `text` en de bijbehorende `CHECK`-constraint |
| Een relatie “Client” | een kolom `clients_id uuid` en de bijbehorende `FOREIGN KEY` |

Je kunt dus `psql`, een BI-tool of een Python-script openen en je gegevens lezen zonder
via het product te gaan — en er zelfs in schrijven: de constraints blijven gelden, en de
geschiedenis legt de schrijfactie vast.

## Voor wie?

- **Businessteams** die een raster, weergaven en formulieren willen, zonder te wachten op
  een ontwikkeltraject.
- **Technische teams** die niet willen dat hun gegevens opgesloten zitten in een
  gesloten formaat, en hun vertrouwde tools willen aansluiten.
- **AI-agents**, die een MCP-server vinden, duidelijke rechten en voorstellen die aan een
  mens worden voorgelegd.

## Wat je er vindt

- Getypeerde [tabellen en velden](/basedb/nl/fonctionnalites/tables-et-champs/), relaties
  die echte foreign keys zijn — of meervoudig —, formules die PostgreSQL berekent,
  opzoekvelden en aggregaties via relaties.
- Tien [weergaven](/basedb/nl/fonctionnalites/vues/): raster, kanban, kalender, tijdlijn,
  galerie, lijst, landkaart, formulier, enquête, quiz — gezamenlijk of persoonlijk.
- [Formulieren](/basedb/nl/fonctionnalites/formulaires-partages/) en
  [weergaven](/basedb/nl/fonctionnalites/vues-partagees/) die via een link worden gedeeld, en kalenders
  waarop je je vanuit een agenda abonneert.
- [Samenwerking](/basedb/nl/fonctionnalites/collaboration/): opmerkingen en vermeldingen,
  meldingen, realtime updates.
- [Automatiseringen](/basedb/nl/fonctionnalites/automatisations/) en
  [dashboards](/basedb/nl/fonctionnalites/tableaux-de-bord/) met hun vragen, gebouwd met de muis of in SQL.
- [SQL voor iedereen](/basedb/nl/fonctionnalites/requetes-et-vues-sql/), met eigen rechten:
  opgeslagen query’s onder de tabellen, en echte PostgreSQL-views daartussen.
- [Databasesjablonen](/basedb/nl/fonctionnalites/modeles/), te kiezen uit een galerie of
  aan de AI te vragen.
- [Omgevingen](/basedb/nl/fonctionnalites/environnements/) — productie, acceptatie — die
  je vergelijkt en migreert.
- Een [geschiedenis](/basedb/nl/fonctionnalites/historique/) van elke schrijfactie, directe SQL
  inbegrepen, en Ctrl+Z om ongedaan te maken.
- [Rechten](/basedb/nl/fonctionnalites/droits/) per groep, tot op het veld.
- Een [REST-API](/basedb/nl/integrations/api-rest/), een [MCP-server](/basedb/nl/integrations/mcp/),
  [webhooks](/basedb/nl/integrations/webhooks/), Slack en
  [gesynchroniseerde tabellen](/basedb/nl/integrations/synchronisation/).
- [AI](/basedb/nl/fonctionnalites/ia/) als optie: velden die een model berekent, Copilot.

## Stand van het project

basedb is vrije software (AGPL-3.0), ontwikkeld door [Eodia](https://eodia.com/fr/), een
AI-native softwarestudio, en wordt actief doorontwikkeld. De kern, de API, de MCP-server
en de interface werken en worden gedekt door meer dan duizend tests; de
[roadmap](/basedb/nl/feuille-de-route/) zegt wat er nog komt. Het
[architectuurdocument](https://github.com/eodia/basedb/tree/main/docs/architecture), zo’n
twintig hoofdstukken, legt elke beslissing vast.

:::tip[Uitproberen]
Eén commando volstaat zodra de repository is gekloond: `docker compose up -d`. Zie
[de installatie](/basedb/nl/guides/installation/).
:::
