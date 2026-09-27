---
title: MCP-server
description: Koble en KI-agent til basedb via Model Context Protocol.
---

basedb eksponerer en **MCP-server** (`POST /mcp`, på samme adresse som grensesnittet): en agent – Claude, en
kodeassistent, din egen agent – oppdager databasene der, leser og skriver rader, og
**foreslår** endringer i strukturen.

## Koble til en agent

Opprett et token fra **API- og MCP-tokener…** (databasens meny, under **API og agenter**), med MCP-tilgang avkrysset. Det samme tokenet
brukes for REST-API-et og for MCP.

For en klient som snakker HTTP, er adressen `http://localhost:3000/mcp` med
`Authorization: Bearer <jeton>`. For en klient som starter prosesser (stdio), leverer depotet
et relé som leser tokenet fra en miljøvariabel – aldri fra konfigurasjonen:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## De tolv verktøyene

| Verktøy | Rolle |
|---|---|
| `whoami` | hvem agenten er, og med hvilke tillatelser |
| `list_bases`, `describe_base`, `describe_table` | oppdage strukturen og beskrivelsene |
| `list_records`, `get_record`, `lookup_records` | lese, filtrere, slå opp en visningsverdi |
| `create_record`, `update_record` | skrive rader |
| `propose_create_table`, `propose_add_field`, `get_proposal` | foreslå en endring i strukturen |

## Det en agent ikke gjør

- **Den sletter ingenting.**
- **Den endrer ikke strukturen**: den foreslår den. Forslaget venter i **Forslag
  fra agenter…** (databasens meny), der en person som administrerer strukturen, godkjenner eller avviser det;
  uten en beslutning utløper det etter 24 timer.
- **Den har aldri flere tillatelser** enn personen som opprettet tokenet: tokenets tillatelser
  er snittet av dem og vedkommendes egne.
- Den ser ikke felt som er merket som usynlige for agenter, eller databaser som er stengt for MCP.

Hvert kall logges etter formen på parameterne, aldri etter verdiene deres.
