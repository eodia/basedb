---
title: MCP-server
description: Koble en KI-agent til basedb via Model Context Protocol.
---

basedb eksponerer en **MCP-server** (`POST /mcp`, på samme adresse som grensesnittet): en agent – Claude, en
kodeassistent, din egen agent – oppdager databasene der, leser og skriver rader, sletter dem
hvis du tillater det, og **foreslår** endringer i strukturen.

## Koble til en agent

Opprett et token fra **API- og MCP-tokener…** (databasens meny, under **API og agenter**), med MCP-tilgang avkrysset. Det samme tokenet
brukes for REST-API-et og for MCP, og åpner **hele databasen**: produksjonen og de andre
miljøene (se lenger ned).

Legg tokenet i en miljøvariabel, `BASEDB_TOKEN`, aldri i en konfigurasjonsfil.
En klient som snakker MCP over HTTP – blant andre Claude Code – går direkte til `…/mcp` med
headeren `Authorization: Bearer <jeton>`. Med Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Kommandoen skriver filen `.mcp.json` i prosjektet, der `${BASEDB_TOKEN}` forblir en referanse til
variabelen: selve tokenet står ikke der.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

En klient som bare kan starte lokale programmer (stdio), går via reléet i depotet, som leser
tokenet fra variabelen angitt av `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Be deretter agenten om å kalle `whoami`: den sier hvem som opprettet tokenet, hvilken database
det åpner, miljøene dets og tillatelsene dets.

## Velge miljø

En database kan ha flere [miljøer](/basedb/nb/fonctionnalites/environnements/) – produksjon,
test, utvikling –, hver med sine egne tabeller og rader. Et token for hele databasen åpner dem
alle, og miljøet velges, fra det bredeste til det mest presise:

- **databasenavnet**, uten noe annet: `crm` er produksjon, `crm_recette` er test;
- **serveradressen**: `…/mcp?environment=recette` peker på test for hele tilkoblingen. Reléet
  gjør det samme med `--environment recette`. Slik registrerer man én server per miljø, alle med
  det samme tokenet:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **argumentet `environment`** i hvert verktøy som navngir en database, for ett enkelt kall:
  `list_records` med `{"base": "crm", "table": "clients", "environment": "recette"}`.

Et miljø navngis med merket sitt, uten hensyn til store og små bokstaver eller aksenter
(`Recette`, `recette`, `developpement` for «Développement»), eller med `production`. `whoami`
lister dem tokenet åpner; `list_bases` og `describe_base` sier hvilket miljø hver database er.

Et token kan også begrenses til ett enkelt miljø når det opprettes: det ser da ingen andre.

## De femten verktøyene

| Verktøy | Rolle |
|---|---|
| `whoami` | hvem agenten er, med hvilke tillatelser, og på hvilke miljøer |
| `list_bases`, `describe_base`, `describe_table` | oppdage strukturen, beskrivelsene og utseendet |
| `list_records`, `get_record`, `lookup_records` | lese, filtrere, slå opp en visningsverdi |
| `create_record`, `update_record` | skrive rader |
| `delete_record`, `restore_record` | slette en rad – med et token opprettet for det – og gjenopprette den |
| `propose_create_table`, `propose_add_field`, `get_proposal` | foreslå en endring i strukturen |
| `propose_update_look` | foreslå farge og ikon for en tabell og for valgene dens |

## Farger og ikoner

En tabell, og hvert alternativ i et enkeltvalg, har en farge og et ikon, som i grensesnittet.
Agenten velger dem ved å foreslå:

- `propose_create_table` godtar `color` og `icon` for tabellen;
- `propose_add_field` godtar `color` og `icon` på hvert alternativ i en `select` eller en
  `multi_select`;
- `propose_update_look` endrer dem for en eksisterende tabell og valgene dens: en utelatt nøkkel
  beholder det som er satt, `null` fjerner det.

`color` er en farge `#rrggbb`. `icon` er navnet på et [Lucide](https://lucide.dev/icons/)-ikon
blant dem grensesnittet tegner – `truck`, `circle-check`, `flame` …: verktøyets skjema lister
dem opp, og et ukjent navn avvises. `describe_base` og `describe_table` gir tilbake det
nåværende utseendet. Et felt har derimot ikke noe ikon å velge: grensesnittet tegner ikonet for
typen dets.

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
- **Den endrer ikke strukturen** – heller ikke utseendet: den foreslår endringene. Forslaget
  venter i **Agentforslag…** (databasens meny), der en person som administrerer strukturen,
  godkjenner eller avviser det; uten en beslutning utløper det etter 24 timer.
- **Den har aldri flere tillatelser** enn personen som opprettet tokenet: tokenets tillatelser
  er snittet av dem og vedkommendes egne, miljø for miljø.
- Den ser ikke felt som er merket som usynlige for agenter, eller databaser som er stengt for MCP.

Hvert kall logges etter formen på parameterne, aldri etter verdiene deres.
