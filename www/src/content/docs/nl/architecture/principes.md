---
title: Principes
description: De beslissingen die de architectuur van basedb bepalen.
---

basedb is ontworpen op basis van een **architectuurdocument** — zestien hoofdstukken, in de repository,
onder [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Het
hoofdstuk 00 legt vijfentwintig beslissingen vast; dit is de geest ervan.

## Gegevens zijn tabellen, geen formaat

Een gebruikersdatabase is een PostgreSQL-**schema**, een tabel is een tabel, een veld is een
getypeerde kolom **met een leesbare naam**. Geen EAV (entity-attribute-value), geen JSON-document
als vergaarbak, geen ondoorzichtige namen. De catalogus `_basedb` beschrijft deze objecten; hij vervangt ze
niet.

Bewuste consequentie: directe SQL is een **legitiem** gebruik. De constraints worden in
de database gezet, de geschiedenis wordt door triggers vastgelegd — niets gaat ervan uit dat de schrijfactie via
de applicatie loopt.

## Eén enkel beslispunt voor rechten

De interface, de REST-API, de MCP-server, de gedeelde formulieren, de webhooks: alles gaat langs
**hetzelfde handhavingspunt** voor rechten, in de kern. De interface is een
afnemer van de API zoals elke andere — geen private route, geen servicetoken. Een
resource die je niet mag zien, reageert precies zoals een resource die niet bestaat.

## De kern beslist, de adapters vertalen

Een TypeScript-monorepo: `@basedb/core` bevat alle logica (catalogus, DDL-engine,
rechten, records, geschiedenis); `apps/api` (Hono), `apps/mcp` en `apps/web`
(Next.js) zijn adapters die elkaar niet aanroepen. De interface is nooit afhankelijk van de
kern: ze spreekt HTTP, punt.

## Niets gaat verloren zonder beslissing

Verwijderen verbant, zonder te vernietigen: een verwijderde tabel behoudt haar rijen, leesbaar in SQL onder
een verbannen naam, en kan worden hersteld. Een fysieke naam wijzigen houdt de oude beschikbaar via een alias. De
definitieve verwijdering is een beheerbeslissing, voorafgegaan door een gecontroleerde export.

## PostgreSQL, en verder niets

PostgreSQL 16 of hoger, en geen enkele verplichte externe afhankelijkheid: geen message queue, geen cache,
geen zoekmachine. De webhookwachtrij, het leegmaken van de geschiedenis, de rate limits:
alles past in de database of in het proces.

## Verder lezen

| Hoofdstuk | Onderwerp |
|---|---|
| 00 | Structurerende beslissingen en register van foutcodes |
| 01 | Naamgeving en slugificatie |
| 02 | De catalogus `_basedb`, bron van waarheid |
| 03 | DDL-engine en migraties |
| 04 | Veldtypes en projectie naar PostgreSQL |
| 05 | Rechten |
| 06 | Levenscyclus: hernoemen, verwijderen, definitief verwijderen |
| 07 | Geschiedenis |
| 08 | REST-API en webhooks |
| 09 | MCP-server |
| 10 | Softwarearchitectuur |
| 11 | Interface |
| 12 | AI-integratie |
| 13 | Authenticatie |
| 14 | Omgevingen |
| 15 | Gedeelde formulieren |
