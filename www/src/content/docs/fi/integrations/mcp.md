---
title: MCP-palvelin
description: Liitä tekoälyagentti basedb:hen Model Context Protocolin kautta.
---

basedb tarjoaa **MCP-palvelimen** (`POST /mcp`, samassa osoitteessa kuin käyttöliittymä): agentti – Claude,
koodausavustaja tai oma agenttisi – löytää sieltä tietokannat, lukee ja kirjoittaa rivejä ja
**ehdottaa** rakenteen muutoksia.

## Agentin liittäminen

Luo tunnus kohdasta **API- ja MCP-tunnukset…** (tietokannan valikossa kohdassa **API ja agentit**) MCP-pääsy valittuna. Sama tunnus
toimii sekä REST API:ssa että MCP:ssä.

HTTP:tä puhuvalle asiakasohjelmalle osoite on `http://localhost:3000/mcp` ja otsake
`Authorization: Bearer <jeton>`. Prosesseja käynnistävälle asiakasohjelmalle (stdio)
tietovarasto tarjoaa välittäjän, joka lukee tunnuksen ympäristömuuttujasta – ei koskaan
määrityksistä:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## Kaksitoista työkalua

| Työkalu | Tehtävä |
|---|---|
| `whoami` | kuka agentti on ja millä käyttöoikeuksilla |
| `list_bases`, `describe_base`, `describe_table` | rakenteen ja sen kuvausten tutkiminen |
| `list_records`, `get_record`, `lookup_records` | lukeminen, suodattaminen, näyttöarvon selvittäminen |
| `create_record`, `update_record` | rivien kirjoittaminen |
| `propose_create_table`, `propose_add_field`, `get_proposal` | rakennemuutoksen ehdottaminen |

## Mitä agentti ei tee

- **Se ei poista mitään.**
- **Se ei muuta rakennetta**: se ehdottaa sitä. Ehdotus odottaa kohdassa **Agenttien
  ehdotukset…** (tietokannan valikossa), jossa rakennetta hallinnoiva henkilö hyväksyy tai hylkää
  sen; ilman päätöstä se vanhenee 24 tunnin kuluttua.
- **Sillä ei ole koskaan enempää oikeuksia** kuin sen tunnuksen luoneella henkilöllä: tunnuksen
  käyttöoikeudet leikataan henkilön käyttöoikeuksilla.
- Se ei näe agenteille näkymättömiksi merkittyjä kenttiä eikä MCP:ltä suljettuja tietokantoja.

Jokainen kutsu kirjataan lokiin parametriensa muodon mukaan, ei koskaan niiden arvojen.
