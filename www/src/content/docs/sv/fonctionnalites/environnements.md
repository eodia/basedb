---
title: Miljöer
description: Produktion, test, utveckling – jämföra, migrera, synkronisera.
---

En databas kan ha **miljöer**: produktion, test, utveckling … Var och en är en fullständig
databas – eget schema, egna tabeller, egna rader, egna behörigheter – och alla delar
**härstamningen** för databasen, dess tabeller och dess fält.

## I gränssnittet

Sidofältet visar **en rad per databas**, med en etikett som visar den öppna miljön och låter dig
byta. Etiketten syns inte så länge det bara finns produktion.

Miljöer läggs till, byter namn och tas bort i **Redigera databasen…**: en ny miljö skapas som en
**kopia av strukturen** i en annan, utan dess rader.

## Jämföra miljöerna

Från databasens meny, under **Fler åtgärder**, öppnar **Jämför miljöer…** en dialog:

- **Struktur**: miljöerna i kolumner, tabeller och fält i rader; det som skiljer sig från
  produktion markeras.
- **Tillämpa migreringar…** förbereder planen för att gå från en miljö till en annan, steg för
  steg. Den kryssar aldrig automatiskt i det som skulle ångra en nyare ändring i målet.
- **Synkronisering av rader**: tabell för tabell, för över rader från en miljö till en annan,
  efter identifierare.

![Jämföra produktion och test](../../../../assets/screens/sv/environnements.webp)

## Hur basedb vet vem som ändrade vad

Jämförelsen bygger på **strukturhistoriken**: varje gång en tabell eller ett fält skapas, ändras
eller tas bort fångas det av en trigger på katalogen, och det kan läsas i historikens flik
”Struktur”. Härstamningsidentifierarna kopplar ett fält i test till dess motsvarighet i
produktion, även om det har bytt namn.

## Via API, SDK och MCP

En **token som skapats för hela databasen** öppnar alla dess miljöer, både dagens och dem som
läggs till senare: en enda token för produktionen och testmiljön. Programmet eller agenten väljer
miljö vid varje anrop:

| Var | Hur |
|---|---|
| [REST-API](/basedb/sv/integrations/api-rest/#välja-miljö) | huvudet `X-Basedb-Environment: recette`, eller `?environment=recette` |
| [SDK](/basedb/sv/integrations/sdk/#miljöerna) | `db.environment('recette')` |
| [MCP](/basedb/sv/integrations/mcp/#välja-miljö) | adressen `…/mcp?environment=recette`, eller argumentet `environment` i ett verktyg |
| [n8n](/basedb/sv/integrations/n8n/#autentiseringsuppgifterna) | fältet **Environment** i autentiseringsuppgiften |

Utan något av detta anger varje databasnamn sin egen miljö: produktionens namn öppnar
produktionen, testmiljöns namn öppnar testmiljön. En token kan också, vid skapandet, begränsas
till den miljö som visas: den ser då ingen annan. I båda fallen begränsas dess behörigheter till
skärningen med personens som skapade den, miljö för miljö.

## I SQL

Varje miljö är ett schema: `b_t4z56fq_ventes` för produktion, `b_t4z56fq_ventes_recette` för
test. Dina frågor byter miljö genom att byta schema – eller `search_path`.
