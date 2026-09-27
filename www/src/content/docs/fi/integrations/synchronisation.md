---
title: Slack, kalenterit ja synkronoidut taulukot
description: Ilmoita Slack-kanavalle, yhdistä kalenteri, pidä taulukko ajan tasalla CSV-tiedostosta, kalenterista tai toisesta tietokannasta.
---

Tietokannan **Integraatiot**-näkymä avataan vasemman alakulman profiilivalikosta. Se vaatii
**Hallintaoikeus**-tason ja kokoaa yhteen sen, mikä yhdistää tietokannan muihin työkaluihisi.

![Tietokannan Integraatiot-näkymä](../../../../assets/screens/integrations.png)

## Slack

**Yhdistä kanava**: luo Slackissa haluamallesi kanavalle *saapuva webhook* (incoming webhook) ja
liitä sen osoite (`https://hooks.slack.com/…`, ainoa hyväksytty alkuperä). **Testaa** lähettää
testiviestin. Osoite salataan heti tallennettaessa, eikä sitä enää koskaan näytetä.

Yhdistetystä kanavasta tulee sitten [automaatioiden](/basedb/fi/fonctionnalites/automatisations/)
toiminto: **Lähetä Slackiin** viestillä, joka viittaa riviin – ”Uusi kielteinen arvio
kirjoittajalta {{Auteur}}: {{Avis}}”.

## Kalenterit

Kaksi suuntaa, kaksi keinoa:

- **Näkymän näyttäminen kalenterissa**: jaa kalenteri- tai aikajananäkymä julkisesti; sen
  jakamisen valintaikkuna antaa **iCalendar-syötteen** osoitteen, jonka voi tilata Google
  Kalenterissa (”Muut kalenterit” → ”URL-osoitteesta”), Outlookissa tai Applen Kalenterissa.
  Katso [Jaetut näkymät](/basedb/fi/fonctionnalites/vues-partagees/#kalenteri-kalenterisovellukseesi).
- **Kalenterin tuominen**: luo synkronoitu taulukko, jonka lähde on ”Kalenteri”, kalenterin
  salaisella iCal-osoitteella.

## Synkronoidut taulukot

Synkronoitu taulukko **pidetään ajan tasalla lähteestä**: sitä luetaan, suodatetaan ja
näytetään näkymissä kuten muitakin, mutta siihen ei kirjoiteta käsin – ”Synkronoitu”-merkki
muistuttaa siitä, ja API hylkää kaikki kirjoitukset (`TABLE_SYNCED`).

| Lähde | Mitä taulukosta tulee |
|---|---|
| **Verkossa oleva CSV-tiedosto** | yksi sarake tiedoston kutakin saraketta kohden, tyypitettynä sisällön mukaan: luku, päivämäärä tai teksti |
| **Kalenteri** (Google Kalenteri, iCalendar) | yksi tapahtuma riviä kohden: otsikko, alku, loppu, paikka, kuvaus |
| **basedb:n jaettu näkymä** | [jaetun näkymän](/basedb/fi/fonctionnalites/vues-partagees/#lähde-muille-tietokannoille) rivit tällä tai toisella instanssilla |

**Uusi synkronoitu taulukko** valitsee lähteen ja aikavälin – 15 minuutin välein tai kerran
päivässä tai jotain siltä väliltä; **Synkronoi** lukee lähteen heti uudelleen. Jokainen ajo
luo, muokkaa ja poistaa sen, mitä tarvitaan, jotta taulukko vastaa lähdettä, ja tunnistaa rivit
**Synkronointiavain**-kentän avulla. Kaikki nämä kirjoitukset kulkevat historian kautta.

Synkronoinnin **lopettaminen** tekee taulukosta tavallisen: sen rivit säilyvät, ja niihin voi taas
kirjoittaa käsin.

## Rajoitukset

- Lähde luetaan enintään 5 Mt:n, 10 000 rivin ja 10 sekunnin rajoissa.
- Epäonnistunut lähde ei poista mitään: taulukko säilyttää rivinsä seuraavaan ajoon asti.
- Lähteeseen luonnin jälkeen ilmestynyttä saraketta ei lisätä.
- Slack yhdistetään saapuvalla webhookilla, ei vielä Slack-sovelluksella.
