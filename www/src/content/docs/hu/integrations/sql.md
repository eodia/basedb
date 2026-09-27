---
title: Közvetlen SQL
description: A basedb tábláinak olvasása és írása psql-lel, BI-eszközzel vagy szkripttel.
---

Ez a basedb létjogosultsága: **a táblái valódi táblák**. Bármely PostgreSQL-kliens a nevükön
olvassa őket.

## A nevek

| Objektum | Fizikai név | Példa |
|---|---|---|
| Adatbázis | egy `b_<tenant>_<nom>` séma | `b_t4z56fq_ventes` |
| Teszt környezet | az utótaggal ellátott séma | `b_t4z56fq_ventes_recette` |
| Tábla | a slugosított neve | `opportunites` |
| Mező | a slugosított neve | `echeance` |
| Kapcsolat | `<table cible>_id` | `clients_id` |
| [SQL-nézet](/basedb/hu/fonctionnalites/requetes-et-vues-sql/) | a technikai neve, az adatbázis sémájában | `factures_a_encaisser` |

Minden adatbázis **API- és MCP-dokumentáció** oldala mindet megadja, a `psql`-ben pedig a `\d`
megmutatja a leírásokat (`COMMENT ON`).

## A felületen

A lapsáv **+** gombja, vagy az adatbázis **⋯** menüje → **SQL-lekérdezés**: egy szerkesztő
szintaxiskiemeléssel és kódkiegészítéssel, amelynek eredménye ugyanabban a rácsban jelenik meg,
mint a táblái.

![Egy mentett lekérdezés, és két SQL-nézet a táblák között](../../../../assets/screens/requete-sql.png)

- **Itt mindenki a saját jogosultságaival olvas**: a Kezelés szint a teljes adatbázishoz
  hozzáfér, az írást is beleértve; a többi tag csak olvasási SQL-t ír, ahol egy hozzáférhetetlen
  tábla nem létezik, egy elrejtett mező pedig eltűnik.
- Egy lekérdezés **menthető** a táblák alá – saját magának, az egész adatbázisnak vagy
  csoportoknak –, és ha szeretné, **SQL-nézet** lehet belőle: egy valódi PostgreSQL-nézet a
  táblák között elhelyezve, amely a `psql`-ből is olvasható.

Minden részlet megtalálható itt: [Lekérdezések és SQL-nézetek](/basedb/hu/fonctionnalites/requetes-et-vues-sql/).

## A psql-ből

A mellékelt `docker-compose.yml` fájllal a PostgreSQL a `127.0.0.1:5432` címen van közzétéve:

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

## Írás SQL-ben

Megengedett. A megszorításokat (egyszeres választások, kapcsolatok, URL-ek, kötelező mezők) a
PostgreSQL érvényesíti, és elutasítják az érvénytelen értéket, ugyanúgy, mint a felületen. Az
írás pedig **bekerül az előzményekbe**: az előzmények „Közvetlen SQL-munkamenet” néven
jelenítik meg, az azt végrehajtó munkamenettel együtt, és ugyanúgy visszavonható, mint a többi.

:::caution
A **struktúra** SQL-ben történő módosítása (`ALTER TABLE`) megkerüli a basedb katalógusát, amely
így nem tudna róla. Használja a felületet, az API-t vagy egy ügynöki javaslatot: a migrációs
motor megtervezi a módosítást, rövid ideig zárol, és pontosan tartja a katalógust.
:::
