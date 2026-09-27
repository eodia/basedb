---
title: Näkymät
description: Ruudukko, kanban, kalenteri, aikajana, galleria, luettelo, lomake ja kyselylomake – yhteisiä tai henkilökohtaisia.
---

Taulukon voi näyttää **kahdeksalla tavalla**. Näkymä ei kopioi tietoja eikä anna enempää
käyttöoikeuksia kuin taulukko itse.

:::note
Nämä näkymät ovat tapoja näyttää **yksi** taulukko. [SQL-näkymä](/basedb/fi/fonctionnalites/requetes-et-vues-sql/)
on eri asia: oikea PostgreSQL-näkymä, joka kirjoitetaan SQL:llä tietokannan taulukoiden päälle ja
sijoitetaan niiden joukkoon sivupalkissa.
:::

| Näkymä | Mitä se näyttää | Mitä se tarvitsee |
|---|---|---|
| **Ruudukko** | rivit suodatettuina, lajiteltuina ja ryhmiteltyinä, valitut sarakkeet | – |
| **Kanban** | kortit sarakkeissa | yksi valinta -kentän |
| **Kalenteri** | rivit päivämääränsä kohdalla, kuukausittain tai viikoittain | päivämääräkentän |
| **Aikajana** | palkit kahden päivämäärän välillä ja niiden riippuvuudet | alkupäivämäärän |
| **Galleria** | kortit kansikuvineen | – |
| **Luettelo** | yksi rivi tietuetta kohden, kutistettavissa ryhmissä | – |
| **Lomake** | kysymyssivu rivin luomiseen | – |
| **Kyselylomake** | samat kysymykset, yksi kerrallaan | – |

## Näkymävalitsin

Se on ”Suodata”-painikkeen vasemmalla puolella. ”Kaikki rivit” on taulukon ruudukko, jota
kukaan ei ole tallentanut eikä voi poistaa; sen jälkeen tulevat **yhteiset näkymät** tietokannan
rakentajan valitsemassa järjestyksessä ja sitten **Omat näkymät**.

- **Yhteinen näkymä** näkyy kaikille. Sen luominen, määrittäminen, uudelleennimeäminen,
  järjestäminen tai poistaminen vaatii **Hallintaoikeus**-tason. Sen voi **lukita**: lukon kuva
  kertoo sen, eikä kukaan voi muuttaa näkymää avaamatta ensin lukitusta.
- **Henkilökohtainen näkymä** näkyy vain sinulle ja vaatii vain taulukon lukuoikeuden.
  **Luo henkilökohtainen näkymä** tai **Tallenna näkymäksi** suodatuksen ja lajittelun jälkeen:
  kukin tallentaa omat lukutapansa muuttamatta mitään muille. Yhteisen näkymän **monistaminen**
  tekee siitä henkilökohtaisen kopion.

![Asiakasgalleria](../../../../assets/screens/galerie.png)

## Työkalupalkki

Ruudukon yläpuolella tässä järjestyksessä:

- **Suodata** yhdistää kenttäkohtaisia ehtoja;
- **Sarakkeet** valitsee, mitä näytetään – järjestelmäsarakkeet ovat erikseen kohdassa
  ”Järjestelmätiedot”;
- **Ryhmittele** järjestää rivit yksiarvoisen kentän – yksi valinta, viittaus, henkilö,
  päivämäärä, luku, teksti, valintaruutu… – mukaan kutistettaviin ryhmiin, joista kullakin on
  koko suodatuksen kattava lukumäärä;
- **Värit** värittää rivit yksi valinta -kentän tai **sääntöjen** mukaan – suodatin ja väri,
  enintään kaksikymmentä – reunaviivana, taustana tai molempina;
- **Rivin korkeus**: matala, keskikorkea, korkea, erittäin korkea;
- oikealla oleva **Hae…** hakee kaikista sarakkeista kirjoittaessasi; Esc tyhjentää haun. Se
  toimii myös kanbanissa, kalenterissa, aikajanassa, galleriassa ja luettelossa, eikä sitä
  koskaan tallenneta näkymään.

Jokaisen sarakkeen alla on **Yhteenveto**, joka lasketaan kaikista suodatuksen riveistä eikä
vain sivusta: täytetyt, tyhjät, yksilölliset arvot, summa, keskiarvo, minimi, maksimi,
valitut ruudut.

## Kanban, kalenteri, aikajana

- **Kanban** järjestää kortit yksi valinta -kentän mukaan; kortin vetäminen muuttaa riviä, ja
  sarakkeen yläosan ”+” luo rivin, jolla on jo kyseinen valinta. Jokainen kortti näyttää
  otsikon, kansikuvan, valitut kentät ja **kuvauksen**, joka viittaa rivin arvoihin –
  ”Toimituspäivä `{{Date}}`, asiakas `{{Client}}`” –, ja joka kirjoitetaan näkymän
  asetuksissa **Lisää kenttä** -painikkeella.
- **Kalenteri** sijoittaa jokaisen rivin sen päivämäärän kohdalle, mahdollisen
  loppupäivämäärän kanssa; rivin vetäminen päivästä toiseen siirtää sitä.
- **Aikajana** piirtää palkit alku- ja loppupäivämäärän välille yksi valinta -kentän tai
  viittauksen mukaan ryhmiteltyinä. **Riippuu**-asetuksella – taulukon viittaus itseensä –
  nuoli yhdistää jokaisen tehtävän niihin, joista se riippuu, ja on punainen, kun se kulkee
  ajassa taaksepäin.

![Aikajana riippuvuuksineen](../../../../assets/screens/chronologie.png)

![Kalenteri eräpäivän mukaan](../../../../assets/screens/calendrier.png)

## Galleria ja luettelo

- **Galleria** näyttää kortteja: **kansikuva** (rajattu tai kokonainen), koko (pienet,
  keskikokoiset, suuret kortit) ja väri yksi valinta -kentän mukaan.
- **Luettelo** näyttää yhden rivin tietuetta kohden **ryhmiteltynä** yksi valinta -kentän,
  viittauksen tai henkilön mukaan.

![Asiakasluettelo toimialoittain ryhmiteltynä](../../../../assets/screens/liste.png)

Kanbanissa, galleriassa ja luettelossa kortit ja rivit voi **järjestää käsin** vetämällä –
enintään 5 000; valittu lajittelu ohittaa tämän järjestyksen.

## Lomake ja kyselylomake

Kysymykset valitaan ja järjestetään; kullakin on otsikko ja ohje, ja sen voi merkitä
pakolliseksi. Lomakkeella on otsikko, esittely, painikkeen teksti ja kiitosviesti. Sen voi
täyttää basedb:ssä tai [jakaa linkillä](/basedb/fi/fonctionnalites/formulaires-partages/).

## Näkymän jakaminen

Tietonäkymän – ruudukko, kanban, kalenteri, aikajana, galleria, luettelo – voi **jakaa vain
luku -muodossa** linkillä, upottaa toiselle sivustolle, ja kalenterista tulee
kalenterisyöte. Katso [Jaetut näkymät](/basedb/fi/fonctionnalites/vues-partagees/).

## Mitä lukija ei näe

Näkymä **muodostetaan uudelleen lukijalleen**: häneltä piilotettu kenttä katoaa sarakkeista,
korteista ja kysymyksistä. Näkymää, jonka suodatin viittaa piilotettuun kenttään, ei näytetä
lainkaan: ilman suodatintaan näytettynä se näyttäisi enemmän kuin sen oli tarkoitus näyttää.
