---
title: n8n
description: Lue ja kirjoita basedb:n rivejä n8n-työnkulusta, ja käynnistä yksi joka kerta, kun rivi luodaan, sitä muokataan tai se poistetaan.
---

Paketti **n8n-nodes-basedb** lisää n8n:ään kolme solmua:

| Solmu | Tehtävä |
|---|---|
| **basedb** | taulukon rivien lukeminen ja kirjoittaminen, rivin kommentoiminen; käytettävissä n8n:n tekoälyagentin työkaluna |
| **basedb Trigger** | työnkulun käynnistäminen joka kerta, kun rivi luodaan – tai luodaan tai sitä muokataan – edellisen tarkistuksen jälkeen |
| **basedb Webhook Trigger** | työnkulun käynnistäminen sillä hetkellä, kun rivi luodaan, sitä muokataan tai se poistetaan |

## Asentaminen

n8n:ssä: **Settings › Community Nodes › Install**, ja sitten `n8n-nodes-basedb`.

Ilman käyttöliittymää – jonossa toimiva tila, valmiiksi asennettu Docker-kuva – : `npm install
n8n-nodes-basedb` kansiossa `~/.n8n/nodes`, ja käynnistä n8n uudelleen.

## Tunnistetiedot

Luo n8n:ssä **basedb API**-tunniste:

| Kenttä | Arvo |
|---|---|
| **Instance URL** | osoite, jossa avaat basedb:n: `https://basedb.exemple.fr` |
| **Workspace** | työtilan tunniste, se, jota API:n osoitteet käyttävät (`/api/v1/<työtila>/…`): `t4z56fq`, paitsi jos instanssi asettaa `BASEDB_TENANT`:n |
| **Token** | **integraatiotunnus**: tietokannan **⋯**-valikko → **API ja agentit** → **API- ja MCP-tunnukset…** |

Tunnus avaa **yhden** tietokannan. Se lukee sen rivejä, kirjoittaa niitä, jos se on luotu
kirjoitusoikeuksin, eikä sillä ole koskaan enempää oikeuksia kuin sen luoneella henkilöllä.
Tallennettaessa n8n kokeilee yhteyttä ja kertoo, jos tunnus hylätään.

## Lukeminen ja kirjoittaminen: solmu basedb

| Toiminto | Mitä se tekee |
|---|---|
| **Row › Create** | lisää rivin |
| **Row › Create or Update** | muokkaa riviä, jonka valitut kentät kantavat näitä arvoja, tai lisää sen, jos mikään ei kanna niitä |
| **Row › Get** | lukee rivin sen `_id`:n perusteella |
| **Row › Get Many** | lukee suodattimen rivit, pyydetyssä järjestyksessä, rajaan asti tai kaikki, sivu kerrallaan |
| **Row › Update** | muokkaa riviä, löydettynä sen `_id`:llä tai muilla kentillä |
| **Comment › Create** | kommentoi riviä; @maininta ilmoittaa henkilölle |

**Tietokanta** ja **taulukko** valitaan luetteloista, niistä, jotka tunnus avaa. Kirjoitettavat
kentät näkyvät nimellään basedb:ssä, yksi valinta -kenttä vaihtoehtoineen, Henkilö-kenttä
työtilan jäsenineen; laskettu kenttä – kaava, haku, kooste, automaattinen numero – ei näy
siellä, koska basedb kirjoittaa sen itse. Arvo, jonka kenttä hylkää, pysäyttää solmun basedb:n
koodilla ja sen selityksellä.

- **Suodatin** ja **järjestys** käyttävät kenttien teknisiä nimiä, SQL:n nimiä:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Kielioppi on
  [REST API:n](/basedb/fi/integrations/api-rest/#lukeminen) kielioppi.
- **Luvut** saapuvat desimaalitekstinä (`"1250.50"`), jotta yksikään numero ei häviä; **Numbers
  as Numbers** -asetus muuntaa ne luvuiksi.
- **Viittaus** luetaan muodossa `{ "id": …, "display": … }` ja kirjoitetaan linkitetyn rivin
  `_id`:llä.
- **Create or Update** ei koskaan muokkaa useaa riviä: jos useampi kantaa näitä arvoja, solmu
  pysähtyy sen sijaan, että arvaisi.
- Ei **Delete**-toimintoa: rivien poistamiseksi merkitse ne (tila ”Arkistoitu”), anna poisto
  [automaation](/basedb/fi/fonctionnalites/automatisations/) tehtäväksi, tai kutsu
  [REST API:a](/basedb/fi/integrations/api-rest/) tunnuksella, joka on luotu poistamista varten.

## Työnkulun käynnistäminen

### Joka tarkistuksella: basedb Trigger

Solmu kysyy basedb:ltä valitulla tahdilla (joka minuutti, joka tunti…) **luodut** – tai
**luodut tai muokatut** – rivit edellisestä kerrasta lähtien, tarvittaessa suodatin päälle.
Se toimii kaikkialla, myös kun basedb ei voi tavoittaa n8n:ää. Ensimmäisellä tarkistuksellaan se
merkitsee, missä taulukko menee, eikä lähetä mitään; editorista tehty koeajo tuo viimeisimmän
rivin, jotta seuraavat solmut saa yhdistettyä.

### Sillä hetkellä: basedb Webhook Trigger

Jokainen luotu, muokattu tai poistettu rivi – myös suoraan PostgreSQL:ään kirjoitetulla SQL:llä –
käynnistää työnkulun välittömästi:

1. Lisää solmu ja kopioi sen **Production URL**.
2. basedb:ssä, tietokannan **⋯**-valikko → **API ja agentit** → **Webhookit…**: luo webhook tähän
   osoitteeseen, valitse sen taulukot ja tapahtumat.
3. basedb näyttää kerran **allekirjoituksen salaisuuden**: aseta se n8n:n **basedb Webhook**
   -tunnisteeseen.
4. Aktivoi työnkulku.

Jokaisesta tapahtumasta tulee elementti: sen `type` (`record.created`, `record.updated`,
`record.deleted`), taulukko, rivi **ennen** ja **jälkeen**, ja muuttuneet kentät (`changed`).
Solmu tarkistaa jokaisen toimituksen **allekirjoituksen** ja vastaa `401`, jos sitä ei ole,
se on väärä, tai toimitus on yli viisi minuuttia vanha. basedb toimittaa **vähintään kerran**:
poista kaksoiskappaleet tapahtuman `id`:n perusteella, jos työnkulun ei pidä käsitellä sitä
kahdesti.

:::note
basedb lähettää webhookin vain **julkiseen HTTPS**-osoitteeseen: yksityisessä verkossa oleva
n8n käyttää mieluummin **basedb Triggeriä**. Katso [Webhookit](/basedb/fi/integrations/webhooks/).
:::

## Ilman solmua

n8n:n **HTTP Request**-solmu puhuu myös basedb:lle: otsake `Authorization: Bearer <tunnus>`,
JSON menossa ja tullessa, sivutus siten että sivun `meta.next_cursor` välitetään
`after`-parametrina (`{{ $response.body.meta.next_cursor }}`), ja jatkaminen katkoksen jälkeen
`_updated_at`-suodattimella ja osoitteella `…/<table>/deleted?since=`.
