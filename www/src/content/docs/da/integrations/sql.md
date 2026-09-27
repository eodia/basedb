---
title: Direkte SQL
description: Læs og skriv basedbs tabeller med psql, et BI-værktøj eller et script.
---

Det er selve grunden til, at basedb findes: **dine tabeller er rigtige tabeller**. Enhver
PostgreSQL-klient kan læse dem under deres navn.

## Navnene

| Objekt | Fysisk navn | Eksempel |
|---|---|---|
| Database | et skema `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Testmiljø | skemaet med et suffiks | `b_t4z56fq_ventes_recette` |
| Tabel | dens slugificerede navn | `opportunites` |
| Felt | dets slugificerede navn | `echeance` |
| Relation | `<table cible>_id` | `clients_id` |
| [SQL-view](/basedb/da/fonctionnalites/requetes-et-vues-sql/) | dets tekniske navn, i databasens skema | `factures_a_encaisser` |

Siden **API- og MCP-dokumentation** for hver database angiver dem alle, og `\d` i `psql` viser
beskrivelserne (`COMMENT ON`).

## I brugerfladen

**+** i fanelinjen eller databasens **⋯**-menu → **SQL-forespørgsel**: en editor med
syntaksfremhævning og autofuldførelse, hvis resultat vises i samme gitter som dine tabeller.

![En gemt forespørgsel og to SQL-views placeret blandt tabellerne](../../../../assets/screens/requete-sql.png)

- **Hver person læser med sine egne tilladelser**: niveauet Administrere har hele databasen,
  skrivninger inklusive; de andre medlemmer skriver skrivebeskyttet SQL, hvor en lukket tabel
  ikke findes, og et skjult felt forsvinder.
- En forespørgsel **gemmes** under tabellerne — for dig selv, for hele databasen eller for
  grupper — og bliver, hvis du vil, til et **SQL-view**: et rigtigt PostgreSQL-view, placeret
  blandt tabellerne og læsbart fra `psql`.

Alt er beskrevet i detaljer i [Forespørgsler og SQL-views](/basedb/da/fonctionnalites/requetes-et-vues-sql/).

## Fra psql

Med den medfølgende `docker-compose.yml` er PostgreSQL udgivet på `127.0.0.1:5432`:

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## Skriv i SQL

Det er tilladt. Begrænsningerne (enkeltvalg, relationer, URL'er, påkrævet) håndhæves af
PostgreSQL og afviser en ugyldig værdi, præcis som i brugerfladen. Og skrivningen **logges i
historikken**: historikken viser den som »Direkte SQL-session« med den session, der udførte den,
og den kan fortrydes som alle andre.

:::caution
Ændrer du **strukturen** i SQL (`ALTER TABLE`), går du uden om basedbs katalog, som ikke ville
kende til den. Brug brugerfladen, API'et eller et agentforslag: migreringsmotoren planlægger,
låser kortvarigt og holder kataloget korrekt.
:::
