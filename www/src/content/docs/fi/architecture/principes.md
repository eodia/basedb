---
title: Periaatteet
description: Päätökset, jotka ohjaavat basedb:n arkkitehtuuria.
---

basedb on suunniteltu **arkkitehtuuridokumentin** pohjalta – kuusitoista lukua tietovarastossa
kansiossa [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Sen
luku 00 vahvistaa kaksikymmentäviisi päätöstä; tässä niiden henki.

## Tiedot ovat taulukoita, eivät formaatti

Käyttäjän tietokanta on PostgreSQL-**skeema**, taulukko on taulukko ja kenttä on
**selkeästi nimetty** tyypitetty sarake. Ei EAV:ta (entiteetti–attribuutti–arvo), ei kaiken
nielevää JSON-dokumenttia, ei läpinäkymättömiä nimiä. `_basedb`-katalogi kuvaa nämä objektit;
se ei korvaa niitä.

Tarkoituksellinen seuraus: suora SQL on **oikeutettu** käyttötapa. Rajoitteet on asetettu
tietokantaan, ja historia tallennetaan liipaisimella – mikään ei oleta, että kirjoitus kulkee
sovelluksen kautta.

## Yksi käyttöoikeuksien päätöskohta

Käyttöliittymä, REST API, MCP-palvelin, jaetut lomakkeet, webhookit: kaikki kulkee käyttöoikeuksien
**saman soveltamiskohdan** kautta ytimessä. Käyttöliittymä on API:n kuluttaja siinä missä muutkin
– ei yksityisiä reittejä, ei palvelutunnusta. Resurssi, jota ei saa nähdä, vastaa täsmälleen
kuin resurssi, jota ei ole olemassa.

## Ydin päättää, sovittimet kääntävät

TypeScript-monorepo: `@basedb/core` sisältää kaiken logiikan (katalogi, DDL-moottori,
käyttöoikeudet, tietueet, historia); `apps/api` (Hono), `apps/mcp` ja `apps/web` (Next.js) ovat
sovittimia, jotka eivät kutsu toisiaan. Käyttöliittymä ei koskaan riipu ytimestä: se puhuu
HTTP:tä, piste.

## Mitään ei menetetä ilman päätöstä

Poistaminen siirtää sivuun tuhoamatta: poistettu taulukko säilyttää rivinsä, jotka ovat
luettavissa SQL:llä sivuun siirretyllä nimellä, ja sen voi palauttaa. Fyysisen nimen
uudelleennimeäminen pitää vanhan nimen käytettävissä aliaksen kautta. Pysyvä poisto on ylläpidon
päätös, jota edeltää tarkistettu vienti.

## PostgreSQL eikä mitään muuta

PostgreSQL 16 tai uudempi eikä yhtään pakollista ulkoista riippuvuutta: ei viestijonoa,
välimuistia eikä hakukonetta. Webhookien jono, historian purku ja nopeusrajoitukset – kaikki
mahtuu tietokantaan tai prosessiin.

## Lisätietoja

| Luku | Aihe |
|---|---|
| 00 | Rakenteelliset päätökset ja virhekoodien rekisteri |
| 01 | Nimeäminen ja slugifiointi |
| 02 | `_basedb`-katalogi, totuuden lähde |
| 03 | DDL-moottori ja migraatiot |
| 04 | Kenttätyypit ja niiden vastineet PostgreSQL:ssä |
| 05 | Käyttöoikeudet |
| 06 | Elinkaari: uudelleennimeäminen, poistaminen, pysyvä poisto |
| 07 | Historia |
| 08 | REST API ja webhookit |
| 09 | MCP-palvelin |
| 10 | Ohjelmistoarkkitehtuuri |
| 11 | Käyttöliittymä |
| 12 | Tekoälyintegraatio |
| 13 | Tunnistautuminen |
| 14 | Ympäristöt |
| 15 | Jaetut lomakkeet |
