---
title: Jaetut näkymät
description: Näytä näkymä vain luku -muodossa linkillä, upota se sivustolle, tilaa kalenteri.
---

Tietonäkymän – ruudukko, kanban, kalenteri, aikajana, galleria, luettelo – voi **jakaa vain
luku -muodossa**: linkki `/v/<jeton>` näyttää sen henkilölle, joka ei voi avata basedb:tä,
sallimatta mitään kirjoittamista. Se on [jaettujen lomakkeiden](/basedb/fi/fonctionnalites/formulaires-partages/)
vastinpari: ne antavat vastata sallimatta mitään lukemista. [Koontinäytön](/basedb/fi/fonctionnalites/tableaux-de-bord/#koontinäytön-jakaminen)
voi jakaa samalla tavalla.

## Jakaminen

Näkymän valikko → **Jaa…**, sitten:

| Pääsy | Kuka lukee |
|---|---|
| **Julkinen** | kuka tahansa, jolla on linkki, ilman tiliä |
| **Kirjautuneet jäsenet** | työtilan jäsen kirjauduttuaan – tarvittaessa vain tietyistä ryhmistä |

![Kalenterin jakaminen](../../../../assets/screens/partage-vue.png)

**Linkki käytössä** -kytkin keskeyttää linkin menettämättä sitä. Sivu avautuu sovelluksen
ulkopuolella: ei sivupalkkia, tietokannan nimeä eikä taulukon nimeä – näkymä, sen suodattimet,
sen sarakkeet eikä mitään muuta. Kalenteria tai aikajanaa luetaan siellä kuin kalenteria.

![Sama kalenteri linkin kautta avattuna](../../../../assets/screens/vue-partagee.png)

## Kenen nimissä luetaan

Näkymää luetaan **sen julkaisseen henkilön käyttöoikeuksilla**, jotka tarkistetaan uudelleen
jokaisella lukukerralla: häneltä piilotettu kenttä ei näy, ja jos hän menettää pääsyn
taulukkoon, linkki lakkaa näyttämästä mitään.

## Upottaminen toiselle sivustolle

Valitse **Salli upottaminen toiselle sivustolle**: valintaikkuna antaa `<iframe>`-**upotuskoodin**,
jonka voi liittää intranetiin, wikiin tai esittelysivustolle. Ilman tätä valintaa sivu kieltäytyy
näkymästä toisen sivuston kehyksessä.

## Kalenteri kalenterisovellukseesi

Julkisesti (**Julkinen**) jaetulle kalenterille tai aikajanalle valintaikkuna antaa
**kalenterisyötteen osoitteen**: iCalendar-syötteen (`…/calendar.ics`, enintään 1 000
tapahtumaa), jonka voi tilata Google Kalenteriin, Outlookiin tai Applen Kalenteriin. Tiimin
eräpäivät näkyvät jokaisen kalenterissa ja seuraavat taulukkoa.

## Lähde muille tietokannoille

Julkinen linkki antaa myös **näkymän API-osoitteen**: näkymän näyttämät rivit JSON-muodossa.
[Synkronoitu taulukko](/basedb/fi/integrations/synchronisation/) – tällä tai toisella
instanssilla – voi käyttää sitä lähteenään.

## Rajoitukset

- Lukeminen on rajoitettu 120 pyyntöön minuutissa osoitetta ja linkkiä kohden.
- Lomaketta ei jaeta luettavaksi: se jaetaan [vastausten vastaanottamiseen](/basedb/fi/fonctionnalites/formulaires-partages/).
