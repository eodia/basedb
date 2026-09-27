---
title: Introduktion
description: Vad basedb är, och vad som skiljer det från samarbetsinriktade kalkylark.
---

**basedb** är en databas för samarbete, i samma anda som samarbetsinriktade kalkylark, som du
hostar själv – med en skillnad som styr allt annat: **dina data lever i riktiga
PostgreSQL-tabeller**, typade och med läsbara namn.

![Rutnätet för en tabell i basedb](../../../../assets/screens/grille.png)

## Ett enkelt löfte

Ingen generisk modell, ingen `JSONB` som slasktratt, inga `field_1837`:

| I basedb | I PostgreSQL |
|---|---|
| En databas ”Ventes” | ett schema `b_t4z56fq_ventes` |
| En tabell ”Opportunités” | en tabell `opportunites` |
| Ett fält ”Échéance” (Datum) | en kolumn `echeance date` |
| Ett enkelval ”Statut” | en `text`-kolumn och dess `CHECK`-villkor |
| En relation ”Client” | en kolumn `clients_id uuid` och dess `FOREIGN KEY` |

Du kan alltså öppna `psql`, ett BI-verktyg eller ett Python-skript och läsa dina data utan att
gå via produkten – och till och med skriva till dem: villkoren gäller, och historiken registrerar
skrivningen.

## För vem?

- **Verksamhetsteam** som vill ha ett rutnät, vyer och formulär utan att vänta på utveckling.
- **Tekniska team** som vägrar se sina data inlåsta i ett proprietärt format och vill koppla in
  sina vanliga verktyg.
- **AI-agenter**, som hittar en MCP-server, tydliga behörigheter och förslag som en människa
  godkänner.

## Det här hittar du

- Typade [tabeller och fält](/basedb/sv/fonctionnalites/tables-et-champs/), relationer som är
  riktiga främmande nycklar – eller multipla –, formler som beräknas av PostgreSQL, uppslag och
  aggregeringar genom relationerna.
- Åtta [vyer](/basedb/sv/fonctionnalites/vues/): rutnät, kanban, kalender, tidslinje, galleri,
  lista, formulär, enkät – gemensamma eller personliga.
- [Formulär](/basedb/sv/fonctionnalites/formulaires-partages/) och
  [vyer](/basedb/sv/fonctionnalites/vues-partagees/) som delas via en länk, och kalendrar som
  du kan prenumerera på från en kalenderapp.
- [Samarbete](/basedb/sv/fonctionnalites/collaboration/): kommentarer och omnämnanden,
  aviseringar, uppdateringar i realtid.
- [Automatiseringar](/basedb/sv/fonctionnalites/automatisations/) och
  [instrumentpaneler](/basedb/sv/fonctionnalites/tableaux-de-bord/) med sina frågor, byggda med musen eller i SQL.
- [SQL för alla](/basedb/sv/fonctionnalites/requetes-et-vues-sql/), med egna behörigheter:
  sparade frågor under tabellerna, och riktiga PostgreSQL-vyer placerade bland dem.
- [Databasmallar](/basedb/sv/fonctionnalites/modeles/), att hämta från ett galleri eller be
  AI om.
- [Miljöer](/basedb/sv/fonctionnalites/environnements/) – produktion, test – som du jämför och
  migrerar.
- En [historik](/basedb/sv/fonctionnalites/historique/) över varje skrivning, direkt SQL
  inräknad, och Ctrl+Z för att ångra.
- [Behörigheter](/basedb/sv/fonctionnalites/droits/) per grupp, ända ned till fältet.
- Ett [REST-API](/basedb/sv/integrations/api-rest/), en [MCP-server](/basedb/sv/integrations/mcp/),
  [webhooks](/basedb/sv/integrations/webhooks/), Slack och
  [synkroniserade tabeller](/basedb/sv/integrations/synchronisation/).
- [AI](/basedb/sv/fonctionnalites/ia/) som tillval: fält som beräknas av en modell, Copilot.

## Projektets status

basedb är fri programvara (AGPL-3.0) som utvecklas av [Eodia](https://eodia.com/fr/), en
AI-nativ mjukvarustudio, och är under aktiv utveckling. Kärnan, API:et, MCP-servern och
gränssnittet fungerar och täcks av mer än tusen tester;
[färdplanen](/basedb/sv/feuille-de-route/) visar vad som återstår. Dess
[arkitekturdokument](https://github.com/eodia/basedb/tree/main/docs/architecture), ett tjugotal
kapitel, fastställer varje beslut.

:::tip[Prova]
Ett enda kommando räcker när repot är klonat: `docker compose up -d`. Se
[installationen](/basedb/sv/guides/installation/).
:::
