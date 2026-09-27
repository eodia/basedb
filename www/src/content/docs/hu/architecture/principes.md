---
title: Alapelvek
description: A döntések, amelyek a basedb architektúráját meghatározzák.
---

A basedb egy **architektúra-dokumentum** alapján készült – tizenhat fejezet, a tárolóban, a
[`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture) mappában.
A 00. fejezete huszonöt döntést rögzít; íme a szellemük.

## Az adatok táblák, nem egy formátum

Egy felhasználói adatbázis egy PostgreSQL-**séma**, egy tábla egy tábla, egy mező egy típusos,
**beszédes nevű** oszlop. Nincs EAV (entitás–attribútum–érték), nincs mindent elnyelő
JSON-dokumentum, nincs átláthatatlan név. A `_basedb` katalógus leírja ezeket az objektumokat;
nem helyettesíti őket.

Szándékos következmény: a közvetlen SQL **legitim** használati mód. A megszorítások az
adatbázisban vannak beállítva, az előzményeket trigger rögzíti – semmi sem feltételezi, hogy az
írás az alkalmazáson keresztül történik.

## A jogosultságokról egyetlen pont dönt

A felület, a REST API, az MCP-szerver, a megosztott űrlapok, a webhookok: minden a jogosultságok
**ugyanazon érvényesítési pontján** halad át, a magban. A felület ugyanolyan fogyasztója az
API-nak, mint bármely más – nincs privát útvonal, nincs szolgáltatási token. Egy erőforrás,
amelyet nem láthat, pontosan úgy válaszol, mint egy nem létező erőforrás.

## A mag dönt, az adapterek fordítanak

Egy TypeScript-monorepo: a `@basedb/core` hordozza a teljes logikát (katalógus, DDL-motor,
jogosultságok, rekordok, előzmények); az `apps/api` (Hono), az `apps/mcp` és az `apps/web`
(Next.js) adapterek, amelyek nem hívják egymást. A felület soha nem függ a magtól: HTTP-n
kommunikál, pont.

## Döntés nélkül semmi nem vész el

A törlés félreteszi, nem semmisíti meg az adatot: a törölt tábla megtartja a sorait, amelyek egy
félretett néven SQL-ben olvashatók, és visszaállítható. Egy fizikai név átnevezésekor a régi
nevet egy alias továbbra is kiszolgálja. A végleges kiürítés adminisztrációs döntés, amelyet egy
ellenőrzött export előz meg.

## PostgreSQL, és semmi más

PostgreSQL 16 vagy újabb, és semmilyen kötelező külső függőség: se üzenetsor, se gyorsítótár,
se keresőmotor. A webhookok sora, az előzmények feldolgozása, a sebességkorlátok – minden az
adatbázisban vagy a folyamatban fér el.

## További olvasnivaló

| Fejezet | Téma |
|---|---|
| 00 | Meghatározó döntések és a hibakódok jegyzéke |
| 01 | Elnevezés és slugosítás |
| 02 | A `_basedb` katalógus, az igazság forrása |
| 03 | DDL-motor és migrációk |
| 04 | Mezőtípusok és leképezésük a PostgreSQL-ben |
| 05 | Jogosultságok |
| 06 | Életciklus: átnevezés, törlés, végleges kiürítés |
| 07 | Előzmények |
| 08 | REST API és webhookok |
| 09 | MCP-szerver |
| 10 | Szoftverarchitektúra |
| 11 | Felület |
| 12 | MI-integráció |
| 13 | Hitelesítés |
| 14 | Környezetek |
| 15 | Megosztott űrlapok |
