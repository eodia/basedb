---
title: Principy
description: Rozhodnutí, která určují architekturu basedb.
---

basedb byl navržen na základě **architektonického dokumentu** – šestnácti kapitol v repozitáři
ve složce [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture).
Jeho kapitola 00 stanovuje dvacet pět rozhodnutí; zde je jejich duch.

## Data jsou tabulky, ne formát

Uživatelská databáze je **schéma** PostgreSQL, tabulka je tabulka, pole je typovaný sloupec
**srozumitelně pojmenovaný**. Žádné EAV (entita-atribut-hodnota), žádný univerzální dokument
JSON, žádný neprůhledný název. Katalog `_basedb` tyto objekty popisuje; nenahrazuje je.

Záměrný důsledek: přímé SQL je **legitimní** způsob použití. Omezení jsou definována
v databázi, historie se zachytává triggerem – nic nepředpokládá, že zápis prochází aplikací.

## Jediný rozhodovací bod oprávnění

Rozhraní, REST API, server MCP, sdílené formuláře, webhooky: vše prochází **stejným bodem
vynucování** oprávnění v jádře. Rozhraní je konzumentem API jako kterýkoli jiný – žádná
soukromá cesta, žádný servisní token. Prostředek, který nesmíte vidět, odpovídá přesně jako
prostředek, který neexistuje.

## Jádro rozhoduje, adaptéry překládají

Monorepo v TypeScriptu: `@basedb/core` nese veškerou logiku (katalog, mechanismus DDL,
oprávnění, záznamy, historii); `apps/api` (Hono), `apps/mcp` a `apps/web` (Next.js) jsou
adaptéry, které se navzájem nevolají. Rozhraní nikdy nezávisí na jádru: komunikuje přes HTTP,
a tečka.

## Nic se neztratí bez rozhodnutí

Odstranění odsouvá, nic neničí: odstraněná tabulka si ponechá své řádky, čitelné v SQL pod
odsunutým názvem, a lze ji obnovit. Po přejmenování fyzického názvu zůstává starý název
dostupný přes alias. Vyčištění je rozhodnutím administrace, kterému předchází ověřený export.

## PostgreSQL a nic jiného

PostgreSQL 16 nebo novější a žádná povinná externí závislost: žádná fronta zpráv, žádná
mezipaměť, žádný vyhledávač. Fronta webhooků, vyprazdňování historie, limity rychlosti – vše
se vejde do databáze nebo do procesu.

## Další informace

| Kapitola | Téma |
|---|---|
| 00 | Zásadní rozhodnutí a registr chybových kódů |
| 01 | Pojmenování a slugifikace |
| 02 | Katalog `_basedb`, zdroj pravdy |
| 03 | Mechanismus DDL a migrace |
| 04 | Typy polí a jejich promítnutí do PostgreSQL |
| 05 | Oprávnění |
| 06 | Životní cyklus: přejmenování, odstranění, vyčištění |
| 07 | Historie |
| 08 | REST API a webhooky |
| 09 | Server MCP |
| 10 | Softwarová architektura |
| 11 | Rozhraní |
| 12 | Integrace AI |
| 13 | Autentizace |
| 14 | Prostředí |
| 15 | Sdílené formuláře |
