---
title: Käyttöoikeudet ja ryhmät
description: Tilit, ryhmät, käyttöoikeustasot projektin, tietokannan ja taulukon mukaan, kenttäkohtaiset rajoitukset ja omat asetuksesi.
---

Käyttöoikeudet annetaan **ryhmille**, ei koskaan henkilöille yksitellen. Projektille,
tietokannalle tai taulukolle asetettu taso periytyy kaikkeen sen alla olevaan, myös siihen,
mitä luodaan myöhemmin.

## Neljä tasoa

| Taso | Sallii |
|---|---|
| **Ei käyttöoikeutta** | ei mitään: resurssi on näkymätön |
| **Lukuoikeus** | rivien näkemisen ja kommentoimisen, henkilökohtaisten näkymien luomisen, rakenteen ja koontinäyttöjen selaamisen, omien kysymysten esittämisen, SQL:n kirjoittamisen vain luku -tilassa ja henkilökohtaisten kyselyjen tallentamisen |
| **Muokkausoikeus** | lisäksi rivien luomisen, muokkaamisen ja poistamisen |
| **Hallintaoikeus** | lisäksi rakenteen muuttamisen, jaettujen näkymien, koontinäyttöjen ja tallennettujen kysymysten luomisen, koontinäytön jakamisen linkillä, kyselyjen jakamisen, SQL-näkymien, automaatioiden, integraatioiden ja tunnusten luomisen; sen SQL näkee koko tietokannan kirjoitukset mukaan lukien |

Käyttöoikeudet **summautuvat**: henkilö saa korkeimman tason, jonka jokin hänen ryhmistään
antaa. Kun taulukolle annetaan vähemmän kuin sen tietokannalle, taulukosta tulee
”hienojakoinen”.

Kaksi ryhmää on aina olemassa: **Ylläpitäjät**, jotka hallinnoivat kaikkea, ja **Kaikki
käyttäjät**, johon jokainen tili kuuluu – mitä sille annetaan, se on kaikilla.

## Kenttätasolle asti

Tasojen ruudukon alla **Kentät** piilottaa sarakkeen ryhmältä tai tekee siitä ryhmälle ei-muokattavan.
Näkymä näyttää myös, mitä tietty henkilö todella näkee ja minkä ryhmän kautta.

Piilotettu kenttä puuttuu kaikkialta: ruudukosta, näkymistä, API:sta, MCP:stä, historiasta,
käyttöliittymässä kirjoitetusta SQL:stä ja SQL-näkymistä. Sen mukaan suodattaminen tai
lajitteleminen toimii kuin kenttää ei olisi olemassa.

## Entä SQL?

Käyttöliittymässä SQL noudattaa samoja käyttöoikeuksia, ja niitä soveltaa PostgreSQL itse: ilman
Hallintaoikeus-tasoa kysely suoritetaan vain luku -tilassa henkilölle omistetulla roolilla, jolle
suljettua taulukkoa ei ole olemassa ja jolta piilotettu kenttä hylätään.
[SQL-näkymää](/basedb/fi/fonctionnalites/requetes-et-vues-sql/) luetaan lukijan
käyttöoikeuksilla, ja kyselyn jakaminen jakaa vain sen tekstin.

**Suoraa `psql`-yhteyttä** tietokantaan basedb ei sen sijaan hallitse: se lukee kaiken,
piilotetut kentät mukaan lukien. Rajoitukset suojaavat tuotteen pintoja – käyttöliittymää, API:a,
MCP:tä –, eivät koskaan henkilöltä, jolla on SQL-yhteys tietokantaan; näitä yhteyksiä hallitaan
ylläpitäjän asettamilla PostgreSQL:n `GRANT`-käskyillä.

## Tilit ja kirjautuminen

- Tili luodaan **tilapäisellä salasanalla**, joka näytetään kerran ja joka on vaihdettava
  ensimmäisellä kirjautumiskerralla.
- Kirjautuminen tapahtuu salasanalla tai ylläpitäjän määrittämän **OpenID Connect**
  -palveluntarjoajan kautta.
- Ylläpitotoiminnot vaativat **korotetun istunnon**: salasana on kirjoitettu uudelleen viimeisten
  viiden minuutin aikana.
- Istuntoja voi mitätöidä; istunnon mitätöinti mitätöi heti sen käyttötunnukset.

## Asetuksesi

Vasemman alakulman profiilivalikon **Asetukset** koskee vain sinua:

| Välilehti | Mitä siellä tehdään |
|---|---|
| **Profiili** | näyttönimi; kirjautumisosoite; tiliin linkitetyt tunnistautumispalvelut, joita voi linkittää tai irrottaa |
| **Suojaus** | salasanan vaihtaminen; avoimet istunnot, jotka voi sulkea yksitellen tai kaikki kerralla |
| **Ulkoasu** | käyttöliittymän kieli; teema; päivämäärien järjestys – `25/09/2026` tai `2026-09-25` – ja kalentereiden viikon ensimmäinen päivä |
| **Ilmoitukset** | ilmoitustyypit, joita et enää halua |
| **Tunnukset** | luomasi integraatiotunnukset kaikissa tietokannoissasi, niiden viimeisin käyttö ja niiden mitätöinti |

basedb puhuu **kahtakymmentä kieltä**: ranskaa, englantia, saksaa, espanjaa, italiaa, portugalia
(Brasilia), hollantia, puolaa, tšekkiä, ruotsia, tanskaa, norjaa, suomea, romaniaa, unkaria,
turkkia, ukrainaa, japania, yksinkertaistettua kiinaa ja koreaa. Oletuksena käyttöliittymä
käyttää selaimesi kieltä; **Ulkoasu**-välilehden **Kieli** asettaa toisen. Luvut ja päivämäärät
noudattavat valittua kieltä.

Teema on selainkohtainen; kieli, päivämäärien järjestys ja viikon ensimmäinen päivä seuraavat
sinua laitteelta toiselle. Osoitteen vaihtaminen tai palveluntarjoajan linkittäminen vaatii korotetun
istunnon; tili, jolla ei ole salasanaa ja joka kirjautuu palveluntarjoajan kautta, säilyttää
tämän palveluntarjoajan osoitteen.

## Yksi soveltamiskohta

Kaikki pinnat – käyttöliittymä, API, MCP, jaetut lomakkeet ja näkymät, automaatiot – kulkevat
saman käyttöoikeuksien päätöskohdan kautta ytimessä. Käyttöliittymällä ei ole yksityisiä
reittejä: mitä näkymä ei näytä, sitä API ei palauttanut.

Päinvastainen pätee myös: näkymä **ei tarjoa sitä, mikä hylättäisiin**. Ilman
Hallintaoikeus-tasoa Rakenne-näkymää voi selata ilman painikkeita ja kynää, eikä tuonti tarjoa
taulukon luomista; ilman oikeutta luoda tai poistaa rivejä ruudukko ei tarjoa lisäysriviä eikä
”Poista”-toimintoa.
