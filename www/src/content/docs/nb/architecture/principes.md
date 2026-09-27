---
title: Prinsipper
description: Beslutningene som styrer arkitekturen i basedb.
---

basedb er utformet ut fra et **arkitekturdokument** – seksten kapitler, i depotet,
under [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Kapittel
00 fastsetter tjuefem beslutninger; her er ånden i dem.

## Dataene er tabeller, ikke et format

En brukerdatabase er et PostgreSQL-**skjema**, en tabell er en tabell, et felt er en
typet kolonne **navngitt i klartekst**. Ingen EAV (entitet-attributt-verdi), ingen JSON-dokumenter
der alt havner, ingen ugjennomsiktige navn. Katalogen `_basedb` beskriver disse objektene; den erstatter
dem ikke.

Tilsiktet konsekvens: direkte SQL er en **legitim** bruk. Begrensningene ligger i
databasen, historikken fanges opp av triggere – ingenting forutsetter at skrivingen går gjennom
applikasjonen.

## Ett enkelt beslutningspunkt for tillatelser

Grensesnittet, REST-API-et, MCP-serveren, de delte skjemaene, webhookene: alt går gjennom
det **samme håndhevingspunktet** for tillatelser, i kjernen. Grensesnittet er en
konsument av API-et som alle andre – ingen private ruter, ingen tjenestetoken. En
ressurs du ikke kan se, svarer nøyaktig som en ressurs som ikke finnes.

## Kjernen bestemmer, adapterne oversetter

Et TypeScript-monorepo: `@basedb/core` inneholder all logikken (katalog, DDL-motor,
tillatelser, poster, historikk); `apps/api` (Hono), `apps/mcp` og `apps/web`
(Next.js) er adaptere som ikke kaller hverandre. Grensesnittet er aldri avhengig av
kjernen: det snakker HTTP, punktum.

## Ingenting går tapt uten en beslutning

Sletting flytter til side, uten å ødelegge: en slettet tabell beholder radene sine, lesbare i SQL under
et tilsidesatt navn, og kan gjenopprettes. Når et fysisk navn endres, fortsetter det gamle å fungere via et alias.
Permanent tømming er en administrasjonsbeslutning, med en kontrollert eksport i forkant.

## PostgreSQL, og ingenting annet

PostgreSQL 16 eller nyere, og ingen obligatoriske eksterne avhengigheter: verken meldingskø, hurtigbuffer
eller søkemotor. Webhook-køen, tømmingen av historikken, hastighetsgrensene –
alt får plass i databasen eller i prosessen.

## For å gå videre

| Kapittel | Emne |
|---|---|
| 00 | Grunnleggende beslutninger og register over feilkoder |
| 01 | Navngiving og slugifisering |
| 02 | Katalogen `_basedb`, sannhetskilden |
| 03 | DDL-motor og migreringer |
| 04 | Felttyper og hvordan de tilsvarer PostgreSQL |
| 05 | Tillatelser |
| 06 | Livssyklus: navneendring, sletting, permanent tømming |
| 07 | Historikk |
| 08 | REST-API og webhooks |
| 09 | MCP-server |
| 10 | Programvarearkitektur |
| 11 | Grensesnitt |
| 12 | KI-integrasjon |
| 13 | Autentisering |
| 14 | Miljøer |
| 15 | Delte skjemaer |
