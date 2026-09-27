---
title: Kyselyt ja SQL-näkymät
description: SQL:ää kaikille kunkin omilla käyttöoikeuksilla; taulukoiden alle tallennettuja kyselyjä, henkilökohtaisia tai jaettuja; oikeita PostgreSQL-näkymiä taulukoiden joukossa.
---

Taulukkosi ovat oikeita PostgreSQL-taulukoita, ja käyttöliittymä kysyy niiltä SQL:llä niiden
oikeilla nimillä. Jokainen tietokannan jäsen voi kirjoittaa kyselyn ja **tallentaa** sen
taulukoiden alle – vain itselleen, koko tietokannalle tai muutamalle ryhmälle –, ja tietokannan
hallinnoija voi tehdä siitä **SQL-näkymän**: oikean PostgreSQL-näkymän taulukoiden joukkoon,
jota myös `psql` ja työkalusi lukevat.

![Tallennettu kysely avattuna ”Kyselyt”-osiosta; yläpuolella kaksi SQL-näkymää taulukoiden joukossa](../../../../assets/screens/requete-sql.png)

## Kukin omilla käyttöoikeuksillaan

Välilehtipalkin **+** tai tietokannan **⋯**-valikko → **SQL-kysely** avaa SQL-välilehden:
editori, jossa on korostus ja täydennys, **Ctrl+Enter** suorittamiseen ja tulos samassa
ruudukossa kuin taulukkosi. Se, mitä kysely voi lukea, riippuu sen suorittajasta:

- tietokannan **Hallintaoikeus**-tasolla koko tietokanta kirjoitukset mukaan lukien;
- **Lukuoikeus**- tai **Muokkausoikeus**-tasolla kysely suoritetaan **vain luku -tilassa omilla
  käyttöoikeuksillasi**. Sinulta suljettua taulukkoa ei ole sille olemassa; sinulta piilotettu
  kenttä katoaa `SELECT *` -kyselystä ja hylätään, jos nimeät sen, vaikka taulukko olisi
  mainittu; kirjoitus hylätään. Tuloksessa on **Omat käyttöoikeutesi** -merkki.

![”Omat käyttöoikeutesi” -merkki: kysely näkee vain henkilölle avoimet taulukot ja kentät](../../../../assets/screens/sql-vos-droits.png)

Lajittelua ei tee näkymä: PostgreSQL itse soveltaa käyttöoikeuksiasi sarake sarakkeelta sinulle
omistetulla roolilla. Kysely ei siis voi näyttää sinulle mitään, mitä ruudukko, API tai
MCP-palvelin eivät näyttäisi.

## Kyselyn tallentaminen

Välilehden palkin **Tallenna** sijoittaa kyselyn tietokannan taulukoiden alle **Kyselyt**-osioon.
Sen voi avata uudelleen yhdellä napsautuksella; **⋯** → **Tallenna nimellä…** tekee siitä
kopion, ja **Nimi ja jakaminen…** (välilehdessä tai sen sivupalkin valikossa) nimeää sen
uudelleen, muuttaa sitä, kuka sen näkee, tai poistaa sen — **Poista** on myös sen valikossa,
hiiren oikealla painikkeella. Sitä näyttänyt välilehti säilyttää tekstinsä.

![Kyselyn tallentaminen: sen nimi, mitä se näyttää ja kuka sen näkee](../../../../assets/screens/requete-enregistrer.png)

| Laajuus | Kuka sen näkee | Kuka voi luoda ja muokata sitä |
|---|---|---|
| **Henkilökohtainen** – lukko | vain sinä | kuka tahansa, joka näkee tietokannan, itselleen |
| **Koko tietokanta** | kuka tahansa, joka näkee tietokannan | tietokannan **Hallintaoikeus**-taso |
| **Ryhmät** | valittujen ryhmien jäsenet | tietokannan **Hallintaoikeus**-taso |

**Kyselyn jakaminen jakaa sen tekstin, ei koskaan sitä, mitä sen tekijä saa lukea.** Kukin
suorittaa sen omilla käyttöoikeuksillaan: sama kysely kahden henkilön avaamana näyttää kummallekin
sen, mitä hänellä on oikeus nähdä – tai kertoo, ettei jotain saraketta ole hänelle olemassa.

Sivupalkista avattu kysely **suoritetaan heti vain luku -tilassa**: näet sen tuloksen ilman, että
olet päättänyt mitään. **Suorita** ajaa sen sen jälkeen uudelleen sellaisenaan. Nimen vieressä
oleva piste kertoo, että olet muuttanut sen tekstiä tallennuksen jälkeen; **Tallenna** tallentaa
sen, jos voit muokata sitä, ja muussa tapauksessa ehdottaa uuden luomista.

## SQL-näkymät

**SQL-näkymä** on oikea PostgreSQL-näkymä tietokannan skeemassa. Se sijoittuu **taulukoiden
joukkoon** omine väreineen ja kuvakkeineen kuten taulukko, ja oikealla oleva pieni **silmä**
kertoo, että kyseessä on näkymä. Napsautus avaa sen välilehdelle: sen rivit ruudukossa ja
**Päivitä** niiden lukemiseen uudelleen.

![Näkymä ”Factures à encaisser” sivupalkista avattuna](../../../../assets/screens/vue-sql.png)

Se luodaan tietokannan **⋯**-valikosta → **Uusi SQL-näkymä…** tai SQL-välilehdeltä: **⋯** →
**Luo SQL-näkymä…**, jolloin välilehden kyselystä tulee sen määritelmä. Valintaikkuna kysyy:

- sen **nimikettä** ja **ulkoasua** – väri, kuvake tai kuva, valittuina kuten taulukolle;
- sen **teknistä nimeä**, joka johdetaan nimikkeestä, jos et anna sitä – se, joka kirjoitetaan
  `FROM`-sanan jälkeen;
- sen **kyselyä**: yksi `SELECT` tietokannan taulukoista ja muista näkymistä. PostgreSQL hylkää
  sen, minkä se hylkää, ja editori osoittaa kohdan.

![SQL-näkymän valintaikkuna: nimike ja ulkoasu, tekninen nimi, kysely, kuvaus](../../../../assets/screens/vue-sql-dialogue.png)

Näkymää luetaan sen jälkeen sen nimellä, niin käyttöliittymästä kuin `psql`:stä tai
BI-työkalustasi:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Näkymä ei koskaan näytä kenttää, jota lukija ei näe.** Kukin lukee sitä omilla
käyttöoikeuksillaan jokaiseen taulukkoon ja jokaiseen sarakkeeseen, jota se lukee; sivupalkki
näyttää sen vain niille, jotka voivat lukea kaiken, mitä se lukee. Se lukee vain **omaa**
tietokantaansa: toinen tietokanta tai basedb:n katalogi hylätään jo luotaessa. Sen luominen,
muokkaaminen tai poistaminen vaatii tietokannan **Hallintaoikeus**-tason. **Poista**, sen
sivupalkin valikossa, poistaa sen kaikilta, myös skripteiltä ja työkaluilta; taulukot, joita se
lukee, eivät muutu.

### Kun rakenne muuttuu

- Taulukon tai kentän **uudelleennimeäminen** ei riko näkymää: PostgreSQL seuraa sitä.
- Näkymän lukeman lasketun kentän **kaavan muuttaminen** poistaa näkymän hetkeksi ja palauttaa
  sen sitten uuteen sarakkeeseen. Jos se ei enää toimi, se jää **korjattavaksi** – kolmio kertoo
  sen sivupalkissa – ja sen määritelmä säilyy: **Muokkaa näkymää…**, korjaa, tallenna.
- Taulukkoa ei poisteta pysyvästi niin kauan kuin näkymä lukee sitä, eikä näkymää poisteta niin
  kauan kuin toinen näkymä lukee sitä: hylkäysviesti nimeää kyseisen näkymän.

## Kysely, SQL-näkymä vai kysymys?

| | Mikä se on | Missä se on | Mihin |
|---|---|---|---|
| **Tallennettu kysely** | SQL-teksti | taulukoiden alla, ”Kyselyt”-osiossa | kyselyn löytämiseen uudelleen ja jakamiseen tekstinä |
| **SQL-näkymä** | oikea PostgreSQL-näkymä | taulukoiden joukossa | nimen antamiseen lukemiselle käyttöliittymää **ja** `psql`:ää, skriptejäsi ja työkalujasi varten |
| **Kysymys** | hiirellä tai SQL:llä rakennettu lukeminen ja sen visualisointi | [koontinäytöissä](/basedb/fi/fonctionnalites/tableaux-de-bord/) | luku, kaavio, ristiintaulukko suodattimien alla |

## Rajoitukset

- Ruudukko näyttää enintään näytön alaosassa valitun määrän **rivejä sivulla**; ”katkaistu”
  kertoo siitä. Kysely pysähtyy 15 sekunnin kuluttua.
- SQL-näkymää luetaan SQL:llä ja käyttöliittymässä; REST API ja MCP-palvelin eivät tarjoa sitä.
- SQL-näkymä pysyy ympäristössä, jossa se luotiin: ympäristön luominen, rakenteen vertailu tai
  mallin tallentaminen eivät vielä ota sitä mukaan.
