---
title: Taulukot ja kentät
description: basedb:n kenttätyypit, niiden vastineet PostgreSQL:ssä, kaavat ja lasketut kentät.
---

Jokainen basedb:n taulukko on PostgreSQL-taulukko ja jokainen kenttä tyypitetty sarake.
Kirjoittamastasi nimikkeestä (”Échéance”) tulee luettava fyysinen nimi (`echeance`) vakaalla
**slugifioinnilla**: ilman aksentteja, pienillä kirjaimilla, ilman varattuja sanoja.

## Tyypit

| Tyyppi | PostgreSQL-sarake | Huomiot |
|---|---|---|
| Lyhyt teksti | `text` | yksi rivi |
| Pitkä teksti | `text` | Markdown: ote ruudukossa, muotoiltu näkymä hiiren ollessa päällä, oma editori; voi [viitata sarakkeeseen](#muotoiltu-teksti-ja-muuttujat) |
| Muotoiltu teksti | `text` + `CHECK` | kirjoitettaessa puhdistettua HTML:ää, kirjoitetaan visuaalisessa editorissa – [katso alempaa](#muotoiltu-teksti-ja-muuttujat) |
| Luku | `numeric` | ei koskaan liukulukuja: summa ei ajelehdi |
| Valuutta, Prosentti, Kesto, Arvio | `numeric` | luku ja sen [näyttömuoto](#näyttömuodot): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Valintaruutu | `boolean` | |
| Päivämäärä | `date` | |
| Päivämäärä ja aika | `timestamptz` | absoluuttinen hetki, näytetään lukijan aikavyöhykkeellä |
| Yksi valinta | `text` + `CHECK` | väri, kuvake tai kuva vaihtoehtoa kohden |
| Monivalinta | `text[]` + `CHECK` | suodatettavissa taulukko-operaattoreilla |
| Sähköposti | `text` + `CHECK` | tietokannan tarkistama osoite, avautuu yhdellä napsautuksella |
| Puhelin, Viivakoodi | `text` | lyhyt teksti ja sen muoto: soittolinkki, tasalevyinen fontti |
| URL | `text` + `CHECK` | täydennetään syötettäessä (`exemple.fr` → `https://exemple.fr`) |
| Henkilö | `uuid` | työtilan jäsen; hänen valitsemisensa [ilmoittaa hänelle](/basedb/fi/fonctionnalites/collaboration/) |
| Automaattinen numero | `bigint`, identiteettisarake | numeroi myös jo olemassa olevat rivit; kukaan ei syötä sitä |
| Viittaus | `uuid` + `FOREIGN KEY` | oikea vierasavain kohdetaulukkoon |
| Moniviittaus | `uuid[]` | useita linkitettyjä rivejä, joiden eheyden liipaisin varmistaa |
| Kaava | generoitu sarake `STORED` | PostgreSQL:n laskema – tai luettaessa laskettu, katso [Kaavat](#kaavat) |
| Haku, Kooste, Määrä | ei saraketta | lasketaan luettaessa viittauksen kautta |
| Painike | ei saraketta | avaa osoitteen tai käynnistää [automaation](/basedb/fi/fonctionnalites/automatisations/) |
| Tiedosto, Kuva | `jsonb` (metatiedot) | tavut menevät [tiedostotallennukseen](/basedb/fi/fonctionnalites/fichiers/) |

Jokaisella taulukolla on myös **järjestelmäsarakkeet**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` – liipaisimen ylläpitämiä, eikä API voi koskaan
kirjoittaa niihin. Ruudukko sijoittaa ne sarakevalikossa **Järjestelmätiedot**-ryhmään: ne ovat
jokaisessa taulukossa, mutta hyödyllisiä harvassa.

![Taulukon ruudukko, jossa on laskettu kesto, haku ja määrä](../../../../assets/screens/grille.png)

## Tietokannan valvomat rajoitteet

Minkä käyttöliittymä lupaa, sen PostgreSQL takaa. Yksi valinta on `CHECK`-rajoite, viittaus on
`FOREIGN KEY`, URL tai sähköpostiosoite on säännöllinen lauseke. Suora SQL-kirjoitus, joka
rikkoo niitä, hylätään aivan kuten käyttöliittymässä:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Näyttömuodot

Valuutta, Prosentti, Kesto, Arvio, Puhelin ja Viivakoodi valitaan kuin tyypit, mutta ne ovat
**muotoja**: sarake pysyy lukuna tai tekstinä, vain esitystapa muuttuu.

| Muoto | Kohde | Luetaan ja syötetään |
|---|---|---|
| Valuutta | luku | `12 500,00 €` – euro, dollari, punta, Sveitsin frangi, Kanadan dollari, jeni |
| Prosentti | luku | `15 %` |
| Kesto | sekuntimäärä | `1:30`, ja syötetään `1h30`, `90 min` |
| Arvio | luku | 1–10 tähteä, asetetaan yhdellä napsautuksella |
| Puhelin | lyhyt teksti | soittolinkki |
| Viivakoodi | lyhyt teksti | tasalevyisellä fontilla |

Muotoa voi vaihtaa jälkikäteen (**Näyttö**, kentän muokkauksessa) koskematta tallennettuihin
arvoihin. Se ei rajaa arvoa: arvio 7 viisiportaisella asteikolla pysyy 7:nä.

## Kaavat

Kaava kirjoitetaan englanniksi (myös ranskankieliset nimet toimivat), kentät hakasulkeissa ja argumentit `,`-merkillä erotettuina:

```text
ROUND([Montant HT] * (1 + [Taux de TVA]), 2)
IF([Payée], FALSE, DAYS(TODAY(), [Échéance]) > 0)
DAYS([Fin], [Début])
```

Editori ehdottaa lisättäviä kenttiä ja näyttää funktiopaneelin; virheilmoitus nimeää kentän tai
merkin, josta virhe johtuu.

| Ryhmä | Funktiot |
|---|---|
| Logiikka | `IF`, `IFBLANK`, `ISBLANK`, `AND`, `OR`, `NOT`, `TRUE`, `FALSE` |
| Luvut | `ROUND`, `ABS`, `CEILING`, `FLOOR`, `MIN`, `MAX` |
| Teksti | `UPPER`, `LOWER`, `TRIM`, `LEFT`, `RIGHT`, `LEN`, `TEXT`, `VALUE` |
| Päivämäärät | `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DAYS`, `ADD_DAYS`, `DATE`, `TODAY`, `NOW` |
| Operaattorit | `+ - * /`, `&` tekstin yhdistämiseen, `= <> < <= > >=` |

Kaavasta tulee PostgreSQL:n **generoitu sarake**: `psql` ja työkalusi lukevat sitä kuten muita.
Kaava, joka riippuu päivästä (`TODAY()`, `NOW()`) tai viittaa hakuun tai koosteeseen,
**lasketaan luettaessa**: sitä voi suodattaa ja lajitella basedb:ssä, mutta suorassa SQL:ssä sitä
ei ole.

Kaava ei viittaa toiseen kaavaan eikä suoraan viittauskenttään – haku tekee sen. Tekstin osan
poimiminen tai korvaaminen tulee myöhemmin.

## Haut, koosteet ja määrät

Kolme kenttää lukee **viittauksen kautta**, suuntaan tai toiseen – ”projektin asiakas”, mutta
myös ”Projekti-kentällä linkitetyt tehtävät”:

- **haku** tuo arvon linkitetyltä riviltä tai arvojen luettelon: projektin asiakkaan kaupunki;
- **kooste** laskee linkitetyistä riveistä: arvojen lukumäärä, summa, keskiarvo, minimi,
  maksimi – asiakkaan liikevaihto, sen arvioiden keskiarvo;
- **määrä** laskee linkitetyt rivit: projektin tehtävien lukumäärä.

Ne lasketaan jokaisella lukukerralla **lukijan käyttöoikeuksilla**: jos linkitetty taulukko on
sinulta suljettu, niin on kenttäkin. Niitä voi suodattaa ja lajitella. Ne seuraavat vain yhtä
viittausta, niihin ei voi kirjoittaa, eikä niillä ole saraketta – joten suorassa SQL:ssä niitä
ei ole – eivätkä ne näy tuonnissa, lomakkeissa tai historiassa.

## Viittaukset

**Viittaus** yhdistää rivin saman tietokannan toisen taulukon riviin. Ruudukko näyttää
kohderivin **näyttöarvon** – sarakkeen, jonka määrität sen taulukon näyttökentäksi – ja
suodattimet kulkevat viittauksen läpi (`clients_id.ville eq "Lyon"`). Riviin osoittavat rivit
näkyvät sen rivin tiedoissa.

Valitse **Useita rivejä tietuetta kohden**, niin viittauksesta tulee **moniviittaus**: tehtävä
riippuu useasta tehtävästä, artikkeli kuuluu useaan luokkaan. Linkitetyt rivit näkyvät
tunnisteina, valitaan haulla ja avautuvat yhdellä napsautuksella rivin tiedoista. Kohderivin
poistaminen poistaa sen luetteloista, joissa siihen viitattiin – tai poisto hylätään, jos olet
valinnut niin. Suodattimet `has_any`, `has_all` ja `is_null` ovat käytettävissä, ja nekin
kulkevat viittauksen läpi (`taches_ids.titre contains "logo"`). Moniviittausta ei voi vielä
lajitella, ryhmitellä eikä tuoda.

## Painike

**Painike**-kentällä ei ole arvoa: se toimii. Se **avaa osoitteen** – `https://` tai
`mailto:`, joka voi viitata riviin (`mailto:{{E-mail}}`) – tai **käynnistää automaation**, jonka
käynnistin on saman taulukon painike. Se näkyy solussa, kortissa ja rivin tiedoissa.

## Kuvaukset

Tietokannalla, taulukolla ja kentällä on **kuvaus**, jota voi muokata ilman migraatiota. Se
kopioidaan `COMMENT ON` -kommenttiin, jonka `psql` lukee, luotuun dokumentaatioon ja siihen,
mitä agentti lukee `describe_table`-kutsulla.

## Muotoiltu teksti ja muuttujat

**Muotoiltu teksti** on pitkän tekstin HTML-muunnelma, joka valitaan kenttää luotaessa
(”Muotoiltu teksti (HTML)”): otsikot, lihavointi, kursiivi, alleviivaus, yliviivaus, luettelot,
lainaukset, koodi, linkit ja erottimet visuaalisessa editorissa. HTML **puhdistetaan
kirjoitettaessa**, tuli se käyttöliittymästä, API:sta, MCP-palvelimelta tai tuonnista, ja
`CHECK`-rajoite hylkää lisäksi suoraan SQL:llä kirjoitetut vaaralliset muodot (`<script>`,
`on…`-attribuutit, `javascript:`). Ei kuvia, taulukoita eikä värejä: mitä tietokanta ei
säilyttäisi, sitä ei tarjota.

Pitkä teksti – tavallinen tai muotoiltu – voi **viitata rivinsä sarakkeeseen**. Editorin
**Sarake**-valikko lisää viittauksen kohdistimen kohtaan: tunnisteena muotoiltuun tekstiin,
`{{Ville}}`-muodossa Markdowniin.

> Toimituspäivä `{{Livraison}}`, toimituspaikka `{{Ville}}`.

- Sarake säilyttää viittauksen sellaisena kuin se on kirjoitettu – `{{ville}}`, fyysisellä
  nimellään: sen `psql` lukee.
- Kaikkialla muualla – ruudukossa, rivin tiedoissa, API:ssa, MCP-palvelimella, jaetuissa
  näkymissä, automaatioissa – teksti luetaan **rivin arvolla**: ”Toimituspäivä 2.10.2026,
  toimituspaikka Lyon.” Kaupungin vaihtaminen muuttaa tekstiä.
- Yksi valinta luetaan nimikkeellään, henkilö nimellään, päivämäärä omassa muodossasi;
  muotoiltuun tekstiin lisätty arvo ei ole koskaan merkintäkoodia.
- Sarake, jota lukija ei saa lukea, ei tuota mitään: ei arvoaan eikä nimeään.

Tekoäly ei voi täyttää muotoiltua tekstiä: malli kirjoittaa tekstiä, ei puhdistettua HTML:ää.

## Rakenteen muokkaaminen

Tietokannan **Rakenne**-näkymä – sivupalkin **⋯**-valikossa – luettelee taulukot ja niiden kentät: lisää, nimeä uudelleen, tee pakolliseksi, järjestä,
kuvaile, määritä näyttökenttä.

![Tietokannan Rakenne-näkymä](../../../../assets/screens/structure.png)

Rakenteen muuttaminen vaatii **Hallintaoikeus**-tason. Ilman sitä näkymää voi selata, mutta se
ei tarjoa mitään: ei painiketta, kynää eikä vetokahvaa – pakollisuus ja näyttökenttä kerrotaan,
mutta niitä ei tarjota muutettaviksi. Palvelin hylkää joka tapauksessa jokaisen muutoksen;
näkymä ei enää teeskentele hyväksyvänsä sitä.

Kentän lisääminen, uudelleennimeäminen ja tyypin vaihtaminen kulkevat **migraatiomoottorin**
kautta: vaiheittainen suunnitelma, lyhyet lukot ja nimetty hylkäys, kun tietoa ei voi muuntaa.

Tietokannan, taulukon tai kentän **uudelleennimeäminen** tehdään yhdessä valintaikkunassa.
Nimike vaihtuu aina, ilman migraatiota. Ylläpitäjä näkee alapuolella valinnan ”Nimeä uudelleen
myös tietokannassa: `clients` → `comptes`”: valittuna se vaihtaa myös fyysisen nimen, ja
vaikutusanalyysi tulee näkyviin – kyselyt, SQL-näkymät ja automaatiot, jotka viittaavat vanhaan
nimeen. Vanha nimi pysyy käytettävissä **yhteensopivuusaliaksen** – näkymän – kautta, kunnes
olet päivittänyt kyselysi.

Poistaminen ei pyyhi mitään heti: taulukko tai tietokanta siirretään sivuun (`zz_supprime_…`) ja
pysyy luettavissa SQL:llä. Poistetun tietokannan voi palauttaa; yksittäisen taulukon
palauttaminen käyttöliittymästä on [tulossa](/basedb/fi/feuille-de-route/). Lopullinen
**pysyvä poisto** on varattu ylläpidolle, se tehdään kolmenkymmenen päivän kuluttua ja alkaa
tarkistetulla CSV-viennillä.
