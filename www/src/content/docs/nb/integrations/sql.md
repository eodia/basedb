---
title: Direkte SQL
description: Les og skriv tabellene i basedb med psql, et BI-verktøy eller et skript.
---

Det er selve grunnen til at basedb finnes: **tabellene dine er ekte tabeller**. Enhver PostgreSQL-klient
leser dem under navnet deres.

## Navnene

| Objekt | Fysisk navn | Eksempel |
|---|---|---|
| Database | et skjema `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Testmiljø | skjemaet med suffiks | `b_t4z56fq_ventes_recette` |
| Tabell | det slugifiserte navnet | `opportunites` |
| Felt | det slugifiserte navnet | `echeance` |
| Relasjon | `<table cible>_id` | `clients_id` |
| [SQL-visning](/basedb/nb/fonctionnalites/requetes-et-vues-sql/) | det tekniske navnet, i databasens skjema | `factures_a_encaisser` |

Siden **API- og MCP-dokumentasjon** for hver database viser dem alle, og `\d` i `psql` viser
beskrivelsene (`COMMENT ON`).

## I grensesnittet

**+** i fanelinjen, eller databasens **⋯**-meny → **SQL-spørring**: en editor
med fargekoding og autofullføring, der resultatet vises i det samme rutenettet som tabellene dine.

![En lagret spørring, og to SQL-visninger plassert blant tabellene](../../../../assets/screens/requete-sql.png)

- **Alle leser med sine egne tillatelser**: nivået Administrere har hele databasen, skriving inkludert; de
  andre medlemmene skriver skrivebeskyttet SQL, der en stengt tabell ikke finnes og et skjult felt
  forsvinner.
- En spørring **lagres** under tabellene – for deg selv, for hele databasen eller for
  grupper –, og blir, om du vil, en **SQL-visning**: en ekte PostgreSQL-visning, plassert blant
  tabellene og lesbar fra `psql`.

Alt er beskrevet i detalj i [Spørringer og SQL-visninger](/basedb/nb/fonctionnalites/requetes-et-vues-sql/).

## Fra psql

Med den medfølgende `docker-compose.yml` er PostgreSQL publisert på `127.0.0.1:5432`:

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

## Skrive i SQL

Det er tillatt. Begrensningene (enkeltvalg, relasjoner, URL-er, obligatorisk) håndheves
av PostgreSQL og avviser en ugyldig verdi, akkurat som i grensesnittet. Og skrivingen
**føres i historikken**: historikken viser den som «Direkte SQL-økt», med økten som
utførte den, og den kan angres som alle andre.

:::caution
Å endre **strukturen** i SQL (`ALTER TABLE`) går utenom basedbs katalog, som ikke ville
kjent til den. Gå via grensesnittet, API-et eller et agentforslag: migreringsmotoren
planlegger, låser kort og holder katalogen nøyaktig.
:::
