---
title: Server MCP
description: Conectați un agent AI la basedb prin Model Context Protocol.
---

basedb expune un **server MCP** (`POST /mcp`, la aceeași adresă ca interfața): un agent — Claude, un
asistent de programare, propriul dumneavoastră agent — descoperă acolo bazele, citește și scrie
rânduri, le șterge dacă îi permiteți, și **propune** modificări ale structurii.

## Conectarea unui agent

Creați un token din **Tokenuri API și MCP…** (meniul bazei, sub **API și agenți**), cu accesul MCP bifat. Același token
servește pentru API-ul REST și pentru MCP, și deschide **toată baza**: producția ei și celelalte
medii (vezi mai jos).

Puneți tokenul într-o variabilă de mediu, `BASEDB_TOKEN`, niciodată într-un fișier de configurare.
Un client care comunică MCP prin HTTP — Claude Code, printre altele — vizează direct `…/mcp` cu
antetul `Authorization: Bearer <jeton>`. Cu Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Comanda scrie fișierul `.mcp.json` al proiectului, în care `${BASEDB_TOKEN}` rămâne o referință la
variabilă: tokenul însuși nu apare în el.

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

Un client care știe să lanseze doar programe locale (stdio) trece prin releul din depozit, care
citește tokenul din variabila numită de `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Cereți apoi agentului să apeleze `whoami`: acesta spune cine a creat tokenul, ce bază deschide,
mediile și permisiunile sale.

## Alegerea mediului

O bază poate avea mai multe [medii](/basedb/ro/fonctionnalites/environnements/) — producție,
testare, dezvoltare —, fiecare cu tabelele și rândurile sale. Un token pentru toată baza le
deschide pe toate, iar mediul se alege, de la cel mai larg la cel mai precis:

- **numele bazei**, fără nimic altceva: `crm` este producția, `crm_recette` testarea;
- **adresa serverului**: `…/mcp?environment=recette` vizează testarea pentru toată conexiunea.
  Releul face la fel cu `--environment recette`. Se declară astfel câte un server pentru fiecare
  mediu, toate pe același token:

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

- **argumentul `environment`** al fiecărui instrument care numește o bază, pentru un singur apel:
  `list_records` cu `{"base": "crm", "table": "clients", "environment": "recette"}`.

Un mediu se numește prin insigna sa, fără a ține cont de majuscule sau de diacritice
(`Recette`, `recette`, `developpement` pentru „Développement”), sau prin `production`. `whoami` le
listează pe cele pe care tokenul le deschide; `list_bases` și `describe_base` spun din ce mediu
face parte fiecare bază.

Un token poate fi limitat și la un singur mediu, la crearea sa: nu vede atunci niciun altul.

## Cele cincisprezece instrumente

| Instrument | Rol |
|---|---|
| `whoami` | cine este agentul, cu ce permisiuni, pe ce medii |
| `list_bases`, `describe_base`, `describe_table` | descoperirea structurii, a descrierilor și a aspectului ei |
| `list_records`, `get_record`, `lookup_records` | citire, filtrare, rezolvarea unei valori de afișare |
| `create_record`, `update_record` | scrierea de rânduri |
| `delete_record`, `restore_record` | ștergerea unui rând — cu un token creat pentru aceasta — și readucerea lui |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propunerea unei modificări a structurii |
| `propose_update_look` | propunerea culorii și a pictogramei unui tabel și a opțiunilor lui |

## Culori și pictograme

Un tabel și fiecare opțiune a unei liste de selecție au o culoare și o pictogramă, ca în
interfață. Agentul le alege propunând:

- `propose_create_table` acceptă `color` și `icon` pentru tabel;
- `propose_add_field` acceptă `color` și `icon` pe fiecare opțiune a unui `select` sau a unui
  `multi_select`;
- `propose_update_look` le schimbă pe cele ale unui tabel existent și ale opțiunilor lui: o cheie
  omisă păstrează ce există deja, `null` o șterge.

`color` este o culoare `#rrggbb`. `icon` este numele unei pictograme
[Lucide](https://lucide.dev/icons/) dintre cele pe care interfața le desenează — `truck`,
`circle-check`, `flame`…: schema instrumentului le enumeră, iar un nume necunoscut este refuzat.
`describe_base` și `describe_table` returnează aspectul actual. Un câmp, în schimb, nu are o
pictogramă de ales: interfața o desenează pe cea a tipului său.

## Ștergerea rândurilor

Un token creat cu drepturile **Citire, scriere și ștergere** permite agentului să șteargă
rânduri, **câte unul**, după `_id`-ul lor. `delete_record` redă rândul așa cum era, iar
ștergerea este înregistrată în istoric în numele tokenului; `restore_record` readuce rândul sub
`_id`-ul său — agentul își anulează singur greșeala, iar o persoană o poate face și ea din
istoric.

Agentul nu șterge:

- cu un token în citire, sau în citire și scriere: refuzul spune ce token trebuie creat;
- un rând pe care o relație în cascadă l-ar antrena împreună cu altele (`TOKEN_CASCADE_FORBIDDEN`):
  această ștergere se face în interfață, de o persoană care vede ce antrenează;
- mai multe rânduri dintr-o dată: niciun instrument nu face asta.

## Ce nu face un agent

- **Nu șterge decât cu acordul dumneavoastră**: un token creat pentru aceasta, câte un rând.
- **Nu schimbă structura** — nici aspectul ei: o propune. Propunerea așteaptă în
  **Propunerile agenților…** (meniul bazei), unde o persoană care gestionează structura o aprobă
  sau o refuză; fără decizie, expiră după 24 de ore.
- **Nu are niciodată mai multe permisiuni** decât persoana care i-a creat tokenul: permisiunile
  tokenului sunt intersectate cu ale ei, mediu cu mediu.
- Nu vede câmpurile marcate ca invizibile pentru agenți, nici bazele închise pentru MCP.

Fiecare apel este jurnalizat după forma parametrilor săi, niciodată după valorile lor.
