---
title: Verkkotunnus ja HTTPS
description: Tarjoile basedb verkkotunnuksessa HTTPS:llä mukana toimitetun Caddy-välityspalvelimen takana.
---

Tuotannossa basedb on tarjoiltava **HTTPS**:llä: sen istuntoevästeet ovat `Secure`-evästeitä ja
niissä on etuliite `__Host-`, ja selain hyväksyy ne HTTP:n kautta vain `localhost`-osoitteessa.

Kuva tarjoilee jo kaiken yhdestä osoitteesta – käyttöliittymän, API:n polussa `/api` ja
MCP-palvelimen polussa `/mcp`. Jäljelle jää vain sen sijoittaminen HTTPS-välityspalvelimen
taakse: `docker-compose.yml` tarjoaa sellaisen, **Caddyn**, joka hankkii ja uusii
Let’s Encrypt -varmenteensa itse.

## Käyttöönotto

1. Osoita verkkotunnuksesi DNS palvelimeen; avaa portit 80 ja 443.
2. `.env`-tiedostossa:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Käynnistä `https`-profiililla:

   ```bash
   docker compose --profile https up -d
   ```

Portti 3000 julkaistaan edelleen vain osoitteeseen `127.0.0.1`: kaikki ulkoinen liikenne kulkee
Caddyn kautta.

## Miksi nämä muuttujat

- `BASEDB_DOMAIN`: verkkotunnus, jolle Caddy pyytää varmenteen.
- `BASEDB_PUBLIC_URL`: OIDC-kirjautumisen paluuosoite, jota verrataan merkki merkiltä
  tunnistautumispalvelun puolelle rekisteröityyn osoitteeseen.
- Caddy asettaa `X-Forwarded-For`-otsakkeen vierailijan todellisen osoitteen perusteella, ja
  basedb säilyttää sen, kun se tulee yksityisestä verkosta: API:n nopeusrajoitukset
  (kirjautuminen, jaetut lomakkeet) lasketaan silloin vierailijakohtaisesti.

## Toinen välityspalvelin

Myös Nginx, Traefik tai kuormantasaaja käyvät: ohjaa verkkotunnuksen **kaikki** liikenne kontin
porttiin 3000 ilman vastausten puskurointia (MCP-palvelin ja reaaliaikaisuus lähettävät
vastauksensa virtana), ja varmista, että välityspalvelin **korvaa** `X-Forwarded-For`-otsakkeen
sen sijaan, että täydentäisi sitä.
