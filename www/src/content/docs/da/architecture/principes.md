---
title: Principper
description: De beslutninger, der styrer basedbs arkitektur.
---

basedb er udviklet ud fra et **arkitekturdokument** — seksten kapitler i repositoriet under
[`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Kapitel 00
fastlægger femogtyve beslutninger; her er ånden i dem.

## Data er tabeller, ikke et format

En brugerdatabase er et PostgreSQL-**skema**, en tabel er en tabel, et felt er en kolonne med en
type og **et læsbart navn**. Ingen EAV (entity-attribute-value), intet JSON-dokument som
rodekasse, ingen uigennemsigtige navne. Kataloget `_basedb` beskriver disse objekter; det
erstatter dem ikke.

Tilsigtet konsekvens: direkte SQL er en **legitim** brug. Begrænsningerne ligger i databasen,
historikken fanges af triggere — intet forudsætter, at skrivningen går gennem applikationen.

## Ét enkelt beslutningspunkt for tilladelser

Brugerfladen, REST-API'et, MCP-serveren, de delte formularer, webhooks: alt går gennem det
**samme håndhævelsespunkt** for tilladelser i kernen. Brugerfladen er en forbruger af API'et
som enhver anden — ingen private ruter, ingen servicetokens. En ressource, du ikke kan se,
svarer præcis som en ressource, der ikke findes.

## Kernen beslutter, adapterne oversætter

Et TypeScript-monorepo: `@basedb/core` rummer al logikken (katalog, DDL-motor, tilladelser,
poster, historik); `apps/api` (Hono), `apps/mcp` og `apps/web` (Next.js) er adaptere, der ikke
kalder hinanden. Brugerfladen afhænger aldrig af kernen: den taler HTTP, punktum.

## Intet går tabt uden en beslutning

Sletning flytter til side uden at ødelægge: en slettet tabel beholder sine rækker, som kan
læses i SQL under et flyttet navn, og kan gendannes. Omdøbes et fysisk navn, serveres det gamle
fortsat via et alias. Den permanente sletning er en administrativ beslutning, der altid indledes
med en kontrolleret eksport.

## PostgreSQL og intet andet

PostgreSQL 16 eller nyere og ingen obligatoriske eksterne afhængigheder: ingen beskedkø, ingen
cache, ingen søgemaskine. Webhook-køen, tømningen af historikken, hastighedsgrænserne — alt
ligger i databasen eller i processen.

## Læs mere

| Kapitel | Emne |
|---|---|
| 00 | Grundlæggende beslutninger og register over fejlkoder |
| 01 | Navngivning og slugificering |
| 02 | Kataloget `_basedb`, sandhedskilden |
| 03 | DDL-motor og migreringer |
| 04 | Felttyper og deres afspejling i PostgreSQL |
| 05 | Tilladelser |
| 06 | Livscyklus: omdøbning, sletning, permanent sletning |
| 07 | Historik |
| 08 | REST-API og webhooks |
| 09 | MCP-server |
| 10 | Softwarearkitektur |
| 11 | Brugerflade |
| 12 | AI-integration |
| 13 | Autentificering |
| 14 | Miljøer |
| 15 | Delte formularer |
