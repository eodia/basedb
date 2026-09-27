---
title: Haku
description: Yksi kenttä kaiken löytämiseen — taulukot, näkymät, koontinäytöt, rivit, komennot — ja kysymyksen esittämiseen Copilotille. Ctrl+K.
---

**Etsi taulukoita, rivejä, komentoja…** -kenttä, ylärivin keskellä, avaa haun: yksi kenttä
kaikelle, mihin pääset basedb:ssä. **Ctrl+K** (**⌘K** Macissa) avaa tai sulkee sen mistä tahansa
näkymästä – paitsi tekstieditorissa, jossa se lisää linkin.

## Mitä se löytää

| | |
|---|---|
| **Taulukot ja kohteet** | näkemäsi projektit ja tietokannat; taulukot, SQL-näkymät ja tallennetut kyselyt; avoimen tietokannan taulukoiden näkymät, henkilökohtaiset mukaan lukien; projektin tietokantojen kysymykset, koontinäytöt ja automaatiot; taulukoiden sarakkeet; avoimet välilehdet |
| **Rivit** | itse tiedot, avoimen tietokannan taulukoissa: sarakkeiden teksti, luetteloiden valinnat, tarkka luku – kahdesta merkistä alkaen. Liitetty rivin tunniste löytää sen rivin |
| **Komennot** | mitä sovellus osaa tehdä: siirtyä rakenteeseen, historiaan, tietokannan koontinäyttöihin; luoda taulukon, kysymyksen, SQL-kyselyn, tietokannan, projektin, aloittaa mallista; tuoda tietoja taulukkoon; kumota tai palauttaa viimeisimmän kirjoituksen; sulkea tai vaihtaa välilehteä; vaihtaa teemaa; avata Copilotin; **Kopioi tämän sivun linkki**; avata asetusten tai ylläpidon välilehden; kirjautua ulos |
| **Copilot** | luonnollisella kielellä esitetty kysymys, joka annetaan Copilotille |

**Enter** avaa valitun tuloksen: rivi avautuu taulukossaan, sen tiedoissa. Suurella näytöllä
oikean puolen paneeli näyttää esikatselun – rivin arvot, taulukon sarakkeet ja kuvauksen,
koontinäytön tai automaation kuvauksen. Liitä basedb-osoite: **Avaa tämä linkki** vie sinut
sinne (katso
[linkki jokaiseen näkymään](/basedb/fi/fonctionnalites/collaboration/#linkki-jokaiseen-näkymään)).

Tyhjä kenttä ehdottaa **viimeisimpiäsi**, avoimia välilehtiä, tietokannan taulukoita ja muutamia
ehdotuksia.

## Kirjoita niin kuin ajattelet

- **Ei tarkkeita eikä isoja kirjaimia**: `asiakkaat` löytää ”Asiakkaat”.
- **Sanojen alut ja alkukirjaimet**: `up` sanoista ”Uusi projekti”, `uusitau` sanoista ”Uusi
  taulukko”.
- **Yksi kirjoitusvirhe annetaan anteeksi** – unohtunut, kahdentunut, väärä tai vaihtanut paikkaa
  kirjain, kaksi yli seitsemän kirjaimen sanassa –, ei koskaan ensimmäisessä kirjaimessa.
- **Jokaisen kirjoitetun sanan on löydyttävä jostain**, nimestä tai siitä, missä se sijaitsee:
  `myynti asiakkaat` löytää tietokannan ”Myynti” taulukon ”Asiakkaat”. Myös laji voidaan
  kirjoittaa: `näkymä`, `auto`, `koontinäyttö`.
- **Ensin taulukko, sitten se, mitä siitä etsitään**: `asiakkaat lyon` etsii sanaa ”lyon”
  taulukon ”Asiakkaat” riveiltä.

Kärjessä **paras tulos**; se, mitä avaat usein ja äskettäin, nousee ylös. Tämä muisti pysyy
selaimessasi.

## Rajaa hakua

Kentän alla olevat kuplat – **Kaikki**, **Taulukot ja kohteet**, **Rivit**, **Komennot**,
**Copilot** – rajaavat sitä, mitä etsitään. Ensimmäinen merkki tekee saman:

| Kirjoita ensin | Etsiäksesi |
|---|---|
| `#` | vain taulukot ja kohteet |
| `/` | vain rivit |
| `>` | vain komennot |
| `?` | kysymyksen Copilotille |

**Tab**, taulukolla tai tietokannalla, etsii **sen sisältä**: sen nimi näkyy kentässä, ja haku
kohdistuu enää sen riveihin, näkymiin, sarakkeisiin ja komentoihin. Tyhjä kenttä näyttää tällöin
kaksikymmentä viimeksi muokattua riviä. **⌫**, tyhjässä kentässä, palaa ulos; **Esc** palaa
askeleen taaksepäin ja sulkee sitten.

## Kysy Copilotilta

Jokainen haku päättyy vaihtoehtoon **Kysy Copilotilta: ”…”**, joka nousee kärkeen, kun teksti
kuulostaa kysymykseltä – se päättyy kysymysmerkkiin, alkaa sanalla ”montako”, ”mikä”, ”näytä”…
tai sisältää viisi sanaa tai enemmän. Copilot avautuu tietokannassa ja saa kysymyksen ikään kuin
olisit kirjoittanut sen sinne. Se lukee rakenteen, ei rivejä, ellet valitse **Salli tietojen
lukeminen** -kohtaa, ja se ehdottaa: mikään ei muutu ennen kuin hyväksyt sen. Tekoälyn on oltava
käyttöönotettu instanssissa – katso [Tekoäly](/basedb/fi/fonctionnalites/ia/).

## Käyttöoikeudet ja rajoitukset

Haku kulkee samoja reittejä kuin muukin näkymä, **omilla käyttöoikeuksillasi**: sinulta suljettu
taulukko tai sarake ei näy, ei kohteiden joukossa eikä riveissä. Automaatioita tarjotaan vain
sille, jolla on **Hallintaoikeus**-taso niiden tietokantaan.

- Rivejä etsitään avoimesta tietokannasta, tai tietokannasta tai taulukosta, johon olet
  siirtynyt Tabilla: kolme riviä taulukkoa kohden, enintään kahdellakymmenelläneljällä
  taulukolla; kaksikymmentä riviä yhdessä taulukossa.
- Kysymykset, koontinäytöt ja automaatiot ovat avoimen projektin (enintään kahdeksan
  tietokantaa), luettu uudelleen enintään kahden minuutin välein.
- Jokainen ryhmä näyttää muutaman tuloksen, sitten **N muuta tulosta**, joka avaa sen kokonaan.

## Näppäinoikotiet

**Oikotiet**, haun alareunassa, tai komento **Näppäinoikotiet**, näyttää ne kaikki. **Ctrl** on
**⌘** Macissa.

| Näppäimet | Vaikutus |
|---|---|
| **Ctrl+K** | avaa tai sulje haku |
| **↑** **↓**, **Enter** | selaa tuloksia, avaa tulos |
| **Alt+W** | sulje välilehti |
| **Ctrl+Tab**, **Ctrl+Vaihto+Tab** | seuraava välilehti, edellinen välilehti |
| hiiren keskipainikkeen napsautus | sulje välilehti |
| **Ctrl+A**, **Ctrl+C** | ruudukossa: valitse kaikki, kopioi valitut solut |
| **Ctrl+napsautus** | seuraa viittausta |
| **Ctrl+Z**, **Ctrl+Y** | kumoa viimeisin kirjoitus, palauta se |
| **Ctrl+Enter** | lähetä kommentti, tallenna kuvaus |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | tekstissä: lihavointi, kursivointi, linkki |
