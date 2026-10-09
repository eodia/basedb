---
title: MCP-server
description: Tilslut en AI-agent til basedb via Model Context Protocol.
---

basedb stiller en **MCP-server** til rådighed (`POST /mcp`, på samme adresse som brugerfladen): en
agent — Claude, en kodeassistent, din egen agent — kan her opdage databaserne, læse og skrive
rækker, slette dem, hvis du tillader det, og **foreslå** ændringer af strukturen.

## Tilslut en agent

Opret et token fra **API- og MCP-tokens…** (databasens menu under **API og agenter**) med
MCP-adgang markeret. Det samme token bruges til REST-API'et og til MCP, og åbner **hele
databasen**: dens produktion og dens andre miljøer (se længere nede).

Læg tokenet i en miljøvariabel, `BASEDB_TOKEN`, aldrig i en konfigurationsfil. En klient, der taler
MCP over HTTP — blandt andre Claude Code — går direkte til `…/mcp` med headeren
`Authorization: Bearer <jeton>`. Med Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Kommandoen skriver projektets fil `.mcp.json`, hvor `${BASEDB_TOKEN}` forbliver en henvisning til
variablen: selve tokenet står der ikke.

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

En klient, der kun kan starte lokale programmer (stdio), går via repositoriets relæ, som læser
tokenet fra den variabel, som `--token-env` angiver:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Bed derefter agenten om at kalde `whoami`: den fortæller, hvem der har oprettet tokenet, hvilken
database det åbner, dets miljøer og dets tilladelser.

## Vælg miljøet

En database kan have flere [miljøer](/basedb/da/fonctionnalites/environnements/) — produktion,
test, udvikling —, hver med sine tabeller og rækker. Et token til hele databasen åbner dem alle, og
miljøet vælges, fra det bredeste til det mest præcise:

- **databasens navn**, uden andet: `crm` er produktion, `crm_recette` er test;
- **serverens adresse**: `…/mcp?environment=recette` peger på test for hele forbindelsen. Relæet
  gør det samme med `--environment recette`. Man angiver således én server pr. miljø, alle på det
  samme token:

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

- **argumentet `environment`** på hvert værktøj, der angiver en database, for ét enkelt kald:
  `list_records` med `{"base": "crm", "table": "clients", "environment": "recette"}`.

Et miljø angives ved sit mærke, uden hensyn til store og små bogstaver eller accenter (`Recette`,
`recette`, `developpement` for »Développement«), eller ved `production`. `whoami` lister dem, som
tokenet åbner; `list_bases` og `describe_base` fortæller, hvilket miljø hver database er.

Et token kan også begrænses til ét enkelt miljø ved oprettelsen: det ser så ikke noget andet.

## De femten værktøjer

| Værktøj | Rolle |
|---|---|
| `whoami` | hvem agenten er, med hvilke tilladelser, på hvilke miljøer |
| `list_bases`, `describe_base`, `describe_table` | opdag strukturen, dens beskrivelser og dens udseende |
| `list_records`, `get_record`, `lookup_records` | læs, filtrer, slå en visningsværdi op |
| `create_record`, `update_record` | skriv rækker |
| `delete_record`, `restore_record` | slet en række — med et token oprettet til det — og bring den tilbage |
| `propose_create_table`, `propose_add_field`, `get_proposal` | foreslå en ændring af strukturen |
| `propose_update_look` | foreslå farven og ikonet for en tabel og dens valgmuligheder |

## Farver og ikoner

En tabel og hver valgmulighed i et enkeltvalg har en farve og et ikon, som i brugerfladen. Agenten
vælger dem ved at foreslå:

- `propose_create_table` accepterer `color` og `icon` for tabellen;
- `propose_add_field` accepterer `color` og `icon` på hver mulighed i et `select` eller et
  `multi_select`;
- `propose_update_look` ændrer dem for en eksisterende tabel og dens valgmuligheder: en udeladt
  nøgle beholder det, der er sat, `null` fjerner det.

`color` er en farve `#rrggbb`. `icon` er navnet på et [Lucide](https://lucide.dev/icons/)-ikon
blandt dem, som brugerfladen tegner — `truck`, `circle-check`, `flame`…: værktøjets skema opregner
dem, og et ukendt navn afvises. `describe_base` og `describe_table` gengiver det nuværende
udseende. Et felt har derimod intet ikon at vælge: brugerfladen tegner det, der hører til dets
type.

## Slet rækker

Et token oprettet med rettighederne **Læse, skrive og slette** giver agenten mulighed for at
slette rækker, **én ad gangen**, via deres `_id`. `delete_record` gengiver rækken, som den var,
og sletningen historiseres i tokenets navn; `restore_record` bringer rækken tilbage under dens
`_id` — agenten retter selv sin fejl, og det kan en person også gøre fra historikken.

Agenten sletter ikke:

- med et token, der kun læser, eller læser og skriver: afvisningen angiver, hvilket token der skal
  oprettes;
- en række, som en kaskaderelation ville tage med sig sammen med andre (`TOKEN_CASCADE_FORBIDDEN`):
  den sletning sker i brugerfladen, af en person, der ser, hvad den tager med sig;
- flere rækker på én gang: intet værktøj gør det.

## Hvad en agent ikke gør

- **Den sletter kun med din tilladelse**: et token oprettet til det, én række ad gangen.
- **Den ændrer ikke strukturen** — og heller ikke dens udseende: den foreslår ændringen. Forslaget
  venter i **Agenternes forslag…** (databasens menu), hvor en person, der administrerer
  strukturen, godkender eller afviser det; uden en beslutning udløber det efter 24 timer.
- **Den har aldrig flere tilladelser** end den person, der oprettede dens token: tokenets
  tilladelser krydses med personens, miljø for miljø.
- Den ser ikke felter, der er markeret som usynlige for agenter, og heller ikke databaser, der er
  lukket for MCP.

Hvert kald logges med formen på dets parametre, aldrig med deres værdier.
