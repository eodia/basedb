---
title: Directe SQL
description: De tabellen van basedb lezen en schrijven met psql, een BI-tool of een script.
---

Dit is de bestaansreden van basedb: **je tabellen zijn echte tabellen**. Elke PostgreSQL-client
leest ze onder hun naam.

## De namen

| Object | Fysieke naam | Voorbeeld |
|---|---|---|
| Database | een schema `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Acceptatieomgeving | het schema met een achtervoegsel | `b_t4z56fq_ventes_recette` |
| Tabel | de geslugificeerde naam | `opportunites` |
| Veld | de geslugificeerde naam | `echeance` |
| Relatie | `<table cible>_id` | `clients_id` |
| [SQL-view](/basedb/nl/fonctionnalites/requetes-et-vues-sql/) | de technische naam, in het schema van de database | `factures_a_encaisser` |

De pagina **API- en MCP-documentatie** van elke database geeft ze allemaal, en `\d` in `psql` toont
de beschrijvingen (`COMMENT ON`).

## In de interface

De **+** in de tabbladbalk, of het menu **⋯** van de database → **Nieuwe SQL-query**: een editor
met syntaxiskleuring en aanvulling, waarvan het resultaat in hetzelfde raster als je tabellen verschijnt.

![Een opgeslagen query, en twee SQL-views tussen de tabellen](../../../../assets/screens/requete-sql.png)

- **Iedereen leest er met zijn eigen rechten**: het niveau Beheren heeft de hele database, schrijfacties inbegrepen; de
  andere leden schrijven alleen-lezen SQL, waarin een gesloten tabel niet bestaat en een verborgen veld
  verdwijnt.
- Een query **wordt opgeslagen** onder de tabellen — voor jezelf, voor de hele database of voor
  groepen —, en wordt, als je wilt, een **SQL-view**: een echte PostgreSQL-view, tussen
  de tabellen geplaatst en leesbaar vanuit `psql`.

Alles staat uitgebreid beschreven in [Query’s en SQL-views](/basedb/nl/fonctionnalites/requetes-et-vues-sql/).

## Vanuit psql

Met het meegeleverde `docker-compose.yml` wordt PostgreSQL gepubliceerd op `127.0.0.1:5432`:

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

## Schrijven in SQL

Dat mag. De constraints (enkele keuzes, relaties, URL’s, verplichte velden) worden bewaakt
door PostgreSQL en weigeren een ongeldige waarde, net als in de interface. En de schrijfactie wordt
**in de geschiedenis vastgelegd**: de geschiedenis toont haar als “Directe SQL-sessie”, met de sessie die haar
heeft uitgevoerd, en je maakt haar ongedaan zoals alle andere.

:::caution
De **structuur** wijzigen in SQL (`ALTER TABLE`) omzeilt de catalogus van basedb, die er dan niets
van zou weten. Gebruik de interface, de API of een voorstel van een agent: de migratie-engine
plant, houdt locks kort en houdt de catalogus exact.
:::
