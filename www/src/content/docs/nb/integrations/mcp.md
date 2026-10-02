---
title: MCP-server
description: Koble en KI-agent til basedb via Model Context Protocol.
---

basedb eksponerer en **MCP-server** (`POST /mcp`, på samme adresse som grensesnittet): en agent – Claude, en
kodeassistent, din egen agent – oppdager databasene der, leser og skriver rader, sletter dem
hvis du tillater det, og **foreslår** endringer i strukturen.

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

## De fjorten verktøyene

| Verktøy | Rolle |
|---|---|
| `whoami` | hvem agenten er, og med hvilke tillatelser |
| `list_bases`, `describe_base`, `describe_table` | oppdage strukturen og beskrivelsene |
| `list_records`, `get_record`, `lookup_records` | lese, filtrere, slå opp en visningsverdi |
| `create_record`, `update_record` | skrive rader |
| `delete_record`, `restore_record` | slette en rad – med et token opprettet for det – og gjenopprette den |
| `propose_create_table`, `propose_add_field`, `get_proposal` | foreslå en endring i strukturen |

## Slette rader

Et token opprettet med rettighetene **Lesing, skriving og sletting** gir agenten mulighet til å
slette rader, **én om gangen**, ved deres `_id`. `delete_record` returnerer raden slik den var,
og slettingen historiseres i tokenets navn; `restore_record` henter raden tilbake under sin
`_id` – agenten retter selv opp sin egen feil, og en person kan også gjøre det fra historikken.

Agenten sletter ikke:

- med et token for lesing, eller for lesing og skriving: avslaget sier hvilket token som må opprettes;
- en rad som en kaskaderelasjon ville ta med andre rader (`TOKEN_CASCADE_FORBIDDEN`): denne
  slettingen gjøres i grensesnittet, av en person som ser hva den tar med;
- flere rader samtidig: ingen verktøy gjør det.

## Det en agent ikke gjør

- **Den sletter bare med din tillatelse**: et token opprettet for det, én rad om gangen.
- **Den endrer ikke strukturen**: den foreslår den. Forslaget venter i **Forslag
  fra agenter…** (databasens meny), der en person som administrerer strukturen, godkjenner eller avviser det;
  uten en beslutning utløper det etter 24 timer.
- **Den har aldri flere tillatelser** enn personen som opprettet tokenet: tokenets tillatelser
  er snittet av dem og vedkommendes egne.
- Den ser ikke felt som er merket som usynlige for agenter, eller databaser som er stengt for MCP.

Hvert kall logges etter formen på parameterne, aldri etter verdiene deres.
