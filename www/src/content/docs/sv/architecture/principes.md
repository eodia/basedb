---
title: Principer
description: Besluten som styr basedbs arkitektur.
---

basedb har utformats utifrån ett **arkitekturdokument** – sexton kapitel, i repot, under
[`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Dess
kapitel 00 fastställer tjugofem beslut; här är andan i dem.

## Data är tabeller, inte ett format

En användardatabas är ett PostgreSQL-**schema**, en tabell är en tabell, ett fält är en typad
kolumn **med ett läsbart namn**. Ingen EAV (entitet-attribut-värde), inga JSON-dokument som
slasktratt, inga ogenomskinliga namn. Katalogen `_basedb` beskriver dessa objekt; den ersätter
dem inte.

Avsedd följd: direkt SQL är en **legitim** användning. Villkoren sätts i databasen, historiken
fångas av triggrar – ingenting förutsätter att skrivningen går via programmet.

## En enda beslutspunkt för behörigheter

Gränssnittet, REST-API:et, MCP-servern, de delade formulären, webhooks: allt går via **samma
tillämpningspunkt** för behörigheter, i kärnan. Gränssnittet är en konsument av API:et som
vilken annan som helst – ingen privat väg, ingen tjänstetoken. En resurs som du inte får se
svarar exakt som en resurs som inte finns.

## Kärnan beslutar, adaptrarna översätter

En TypeScript-monorepo: `@basedb/core` bär all logik (katalog, DDL-motor, behörigheter, poster,
historik); `apps/api` (Hono), `apps/mcp` och `apps/web` (Next.js) är adaptrar som inte anropar
varandra. Gränssnittet är aldrig beroende av kärnan: det talar HTTP, punkt.

## Ingenting försvinner utan ett beslut

Att ta bort flyttar undan utan att förstöra: en borttagen tabell behåller sina rader, som går att
läsa i SQL under ett undanflyttat namn, och kan återställas. Att byta ett fysiskt namn låter det
gamla namnet fortsätta fungera via ett alias. Rensning är ett administrativt beslut, som föregås
av en kontrollerad export.

## PostgreSQL och inget annat

PostgreSQL 16 eller senare, och inga obligatoriska externa beroenden: ingen meddelandekö, ingen
cache, ingen sökmotor. Webhook-kön, tömningen av historiken, hastighetsbegränsningarna – allt
ryms i databasen eller i processen.

## Läs vidare

| Kapitel | Ämne |
|---|---|
| 00 | Grundläggande beslut och register över felkoder |
| 01 | Namngivning och slugifiering |
| 02 | Katalogen `_basedb`, sanningskällan |
| 03 | DDL-motor och migreringar |
| 04 | Fälttyper och avbildning i PostgreSQL |
| 05 | Behörigheter |
| 06 | Livscykel: namnbyte, borttagning, rensning |
| 07 | Historik |
| 08 | REST-API och webhooks |
| 09 | MCP-server |
| 10 | Programvaruarkitektur |
| 11 | Gränssnitt |
| 12 | AI-integration |
| 13 | Autentisering |
| 14 | Miljöer |
| 15 | Delade formulär |
