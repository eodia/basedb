---
title: MCP-palvelin
description: Liitä tekoälyagentti basedb:hen Model Context Protocolin kautta.
---

basedb tarjoaa **MCP-palvelimen** (`POST /mcp`, samassa osoitteessa kuin käyttöliittymä): agentti – Claude,
koodausavustaja tai oma agenttisi – löytää sieltä tietokannat, lukee ja kirjoittaa rivejä, poistaa
niitä, jos sen sallit, ja **ehdottaa** rakenteen muutoksia.

## Agentin liittäminen

Luo tunnus kohdasta **API- ja MCP-tunnukset…** (tietokannan valikossa kohdassa **API ja agentit**) MCP-pääsy valittuna. Sama tunnus
toimii sekä REST API:ssa että MCP:ssä, ja se avaa **koko tietokannan**: sen tuotannon ja muut
ympäristöt (katso alempana).

Tallenna tunnus ympäristömuuttujaan `BASEDB_TOKEN`, älä koskaan asetustiedostoon. HTTP:n yli MCP:tä
puhuva asiakasohjelma – esimerkiksi Claude Code – ottaa yhteyden suoraan osoitteeseen `…/mcp`
otsakkeella `Authorization: Bearer <jeton>`. Claude Codella:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Komento kirjoittaa projektin `.mcp.json`-tiedoston, jossa `${BASEDB_TOKEN}` pysyy viittauksena
muuttujaan: itse tunnusta siinä ei ole.

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

Asiakasohjelma, joka osaa käynnistää vain paikallisia ohjelmia (stdio), käyttää tietovaraston
välittäjää, joka lukee tunnuksen muuttujasta, jonka nimeää `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Pyydä sen jälkeen agenttia kutsumaan `whoami`: se kertoo, kuka tunnuksen loi, minkä tietokannan se
avaa, sen ympäristöt ja sen oikeudet.

## Ympäristön valitseminen

Tietokannalla voi olla useita [ympäristöjä](/basedb/fi/fonctionnalites/environnements/) – tuotanto,
testi, kehitys –, ja jokaisella on omat taulukkonsa ja rivinsä. Koko tietokannan tunnus avaa ne kaikki,
ja ympäristö valitaan laajimmasta tarkimpaan:

- **tietokannan nimi** sellaisenaan: `crm` on tuotanto, `crm_recette` testi;
- **palvelimen osoite**: `…/mcp?environment=recette` kohdistaa koko yhteyden testiympäristöön.
  Välittäjä tekee saman valitsimella `--environment recette`. Näin määritetään yksi palvelin kutakin
  ympäristöä kohden, kaikki samalla tunnuksella:

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

- **argumentti `environment`** jokaisessa työkalussa, joka nimeää tietokannan, yhtä kutsua varten:
  `list_records` argumenteilla `{"base": "crm", "table": "clients", "environment": "recette"}`.

Ympäristö nimetään sen merkin nimikkeellä, kirjainkoosta ja diakriittisistä merkeistä riippumatta
(`Recette`, `recette`, `developpement` nimelle ”Développement”), tai nimellä `production`. `whoami`
listaa ne, jotka tunnus avaa; `list_bases` ja `describe_base` kertovat, mihin ympäristöön kukin
tietokanta kuuluu.

Tunnus voidaan myös rajata yhteen ympäristöön sitä luotaessa: silloin se ei näe mitään muuta.

## Viisitoista työkalua

| Työkalu | Tehtävä |
|---|---|
| `whoami` | kuka agentti on, millä käyttöoikeuksilla ja mihin ympäristöihin |
| `list_bases`, `describe_base`, `describe_table` | rakenteen, sen kuvausten ja ulkoasun tutkiminen |
| `list_records`, `get_record`, `lookup_records` | lukeminen, suodattaminen, näyttöarvon selvittäminen |
| `create_record`, `update_record` | rivien kirjoittaminen |
| `delete_record`, `restore_record` | rivin poistaminen — tätä varten luodulla tunnuksella — ja sen palauttaminen |
| `propose_create_table`, `propose_add_field`, `get_proposal` | rakennemuutoksen ehdottaminen |
| `propose_update_look` | taulukon ja sen valintojen värin ja kuvakkeen ehdottaminen |

## Värit ja kuvakkeet

Taulukolla ja valintaluettelon jokaisella valinnalla on väri ja kuvake, kuten käyttöliittymässä.
Agentti valitsee ne ehdottaessaan:

- `propose_create_table` hyväksyy taulukolle `color`- ja `icon`-avaimet;
- `propose_add_field` hyväksyy `color`- ja `icon`-avaimet `select`- tai `multi_select`-kentän
  jokaiselle vaihtoehdolle;
- `propose_update_look` muuttaa olemassa olevan taulukon ja sen valintojen värin ja kuvakkeen: pois
  jätetty avain säilyttää nykyisen arvon, `null` tyhjentää sen.

`color` on väri muodossa `#rrggbb`. `icon` on käyttöliittymän piirtämän
[Lucide](https://lucide.dev/icons/)-kuvakkeen nimi — `truck`, `circle-check`, `flame`…: työkalun
skeema luettelee ne, ja tuntematon nimi hylätään. `describe_base` ja `describe_table` palauttavat
nykyisen ulkoasun. Kentällä sen sijaan ei ole valittavaa kuvaketta: käyttöliittymä piirtää sen
tyypin kuvakkeen.

## Rivien poistaminen

Tunnus, joka on luotu oikeuksin **Luku, kirjoitus ja poisto**, antaa agentille mahdollisuuden
poistaa rivejä, **yksi kerrallaan**, niiden `_id`-tunnisteen perusteella. `delete_record` palauttaa
rivin sellaisena kuin se oli, ja poisto kirjataan historiaan tunnuksen nimissä; `restore_record`
tuo rivin takaisin sen `_id`-tunnisteella — agentti itse korjaa oman virheensä, ja myös henkilö voi
tehdä sen historiasta.

Agentti ei poista:

- tunnuksella, jolla on vain lukuoikeus tai luku- ja kirjoitusoikeus: hylkäys kertoo, millainen
  tunnus on luotava;
- riviä, jonka poistaminen kaskadoidun viittauksen vuoksi veisi mukanaan muita rivejä
  (`TOKEN_CASCADE_FORBIDDEN`): tämä poisto tehdään käyttöliittymässä, sen henkilön toimesta, joka
  näkee, mitä se veisi mukanaan;
- useita rivejä kerralla: mikään työkalu ei tee sitä.

## Mitä agentti ei tee

- **Se poistaa vain suostumuksellasi**: tätä varten luodulla tunnuksella, yksi rivi kerrallaan.
- **Se ei muuta rakennetta** – eikä sen ulkoasua: se ehdottaa sitä. Ehdotus odottaa kohdassa
  **Agenttien ehdotukset…** (tietokannan valikossa), jossa rakennetta hallinnoiva henkilö hyväksyy
  tai hylkää sen; ilman päätöstä se vanhenee 24 tunnin kuluttua.
- **Sillä ei ole koskaan enempää oikeuksia** kuin sen tunnuksen luoneella henkilöllä: tunnuksen
  käyttöoikeudet leikataan henkilön käyttöoikeuksilla, ympäristö kerrallaan.
- Se ei näe agenteille näkymättömiksi merkittyjä kenttiä eikä MCP:ltä suljettuja tietokantoja.

Jokainen kutsu kirjataan lokiin parametriensa muodon mukaan, ei koskaan niiden arvojen.
