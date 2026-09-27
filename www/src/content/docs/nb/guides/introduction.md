---
title: Introduksjon
description: Hva basedb er, og hva som skiller det fra samarbeidsregneark.
---

**basedb** er en samarbeidsdatabase i samme ånd som samarbeidsregneark,
som du hoster selv – med én forskjell som styrer alt det andre: **dataene dine
bor i ekte PostgreSQL-tabeller**, typet og navngitt i klartekst.

![Rutenettet til en tabell i basedb](../../../../assets/screens/grille.png)

## Et enkelt løfte

Ingen generisk modell, ingen `JSONB` der alt havner, ingen `field_1837`:

| I basedb | I PostgreSQL |
|---|---|
| En database «Ventes» | et skjema `b_t4z56fq_ventes` |
| En tabell «Opportunités» | en tabell `opportunites` |
| Et felt «Échéance» (Dato) | en kolonne `echeance date` |
| Et enkeltvalgfelt «Statut» | en `text`-kolonne og dens `CHECK`-begrensning |
| En relasjon «Client» | en kolonne `clients_id uuid` og dens `FOREIGN KEY` |

Du kan altså åpne `psql`, et BI-verktøy eller et Python-skript og lese dataene dine uten å
gå via produktet – og til og med skrive til dem: begrensningene holder, og historikken
registrerer skrivingen.

## For hvem?

- **Fagteamene** som vil ha et rutenett, visninger og skjemaer uten å vente på
  utvikling.
- **De tekniske teamene** som nekter å se dataene sine låst inne i et proprietært
  format, og vil koble til de vanlige verktøyene sine.
- **KI-agentene**, som finner en MCP-server, tydelige tillatelser og forslag
  som legges fram for et menneske.

## Hva du finner

- Typede [tabeller og felt](/basedb/nb/fonctionnalites/tables-et-champs/), relasjoner
  som er ekte fremmednøkler – eller multiple –, formler som beregnes av PostgreSQL,
  og oppslag og aggregeringer på tvers av relasjonene.
- Åtte [visninger](/basedb/nb/fonctionnalites/vues/): rutenett, kanban, kalender, tidslinje,
  galleri, liste, skjema, spørreundersøkelse – felles eller personlige.
- [Skjemaer](/basedb/nb/fonctionnalites/formulaires-partages/) og
  [visninger](/basedb/nb/fonctionnalites/vues-partagees/) som deles med en lenke, og kalendere
  som kan abonneres på fra en kalenderapp.
- [Samarbeid](/basedb/nb/fonctionnalites/collaboration/): kommentarer og omtaler,
  varsler, oppdateringer i sanntid.
- [Automatiseringer](/basedb/nb/fonctionnalites/automatisations/) og
  [instrumentbord](/basedb/nb/fonctionnalites/tableaux-de-bord/) med sine spørsmål, bygget med musen eller i SQL.
- [SQL for alle](/basedb/nb/fonctionnalites/requetes-et-vues-sql/), med egne tillatelser:
  lagrede spørringer under tabellene, og ekte PostgreSQL-visninger plassert blant dem.
- [Databasemaler](/basedb/nb/fonctionnalites/modeles/), som du henter fra et galleri eller
  ber KI om.
- [Miljøer](/basedb/nb/fonctionnalites/environnements/) – produksjon, test – som
  du sammenligner og migrerer.
- En [historikk](/basedb/nb/fonctionnalites/historique/) over hver skriving, direkte SQL inkludert,
  og Ctrl+Z for å angre.
- [Tillatelser](/basedb/nb/fonctionnalites/droits/) per gruppe, helt ned til feltet.
- Et [REST-API](/basedb/nb/integrations/api-rest/), en [MCP-server](/basedb/nb/integrations/mcp/),
  [webhooks](/basedb/nb/integrations/webhooks/), Slack og
  [synkroniserte tabeller](/basedb/nb/integrations/synchronisation/).
- [KI](/basedb/nb/fonctionnalites/ia/) som tillegg: felt som beregnes av en modell, Copilot.

## Prosjektets status

basedb er fri programvare (AGPL-3.0) utviklet av [Eodia](https://eodia.com/fr/), et
KI-nativt programvarestudio, og er under aktiv utvikling. Kjernen, API-et, MCP-serveren
og grensesnittet fungerer og dekkes av over tusen tester;
[veikartet](/basedb/nb/feuille-de-route/) forteller hva som gjenstår. Prosjektets
[arkitekturdokument](https://github.com/eodia/basedb/tree/main/docs/architecture), rundt
tjue kapitler, fastsetter hver beslutning.

:::tip[Prøv det]
Én kommando holder når depotet er klonet: `docker compose up -d`. Se
[installasjonen](/basedb/nb/guides/installation/).
:::
