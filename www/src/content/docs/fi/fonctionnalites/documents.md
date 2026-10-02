---
title: PDF-asiakirjat
description: Rivi laskuna, tarjouksena, korttina tai todistuksena, väreihisi sovitettuna, mukana logo, linkitetyt rivit ja loppusummat.
---

Rivistä tulee **PDF**: lasku riveineen ja loppusummineen, tarjous, lähetysluettelo,
tuotekortti, todistus. Rivin tiedoissa **PDF-asiakirja**-painike avaa sen uuteen välilehteen,
josta selain tulostaa tai tallentaa sen.

## Kortti, säätämättä mitään

Ilman mallia rivi tulostuu **korttina**: sen nimi otsikkona, ja sen jälkeen kaikki kentät,
jotka voit lukea, omalla kielelläsi.

## Luo malli

Se, joka rakentaa taulukkoa – Hallintaoikeus-taso – luo mallit rivin tiedoista:
**PDF-asiakirja › Asiakirjamallit…**. Uusi malli lähtee **lähtökohdasta**:

| Lähtökohta | Mitä se luo |
|---|---|
| **Lasku** | ylätunniste logolla ja yhteystiedoilla, ”LASKU”, numero ja päivämäärä; asiakas; laskutetut rivit ja niiden loppusumma; veroton/verollinen yhteenveto; maksuehdot; lakisääteiset merkinnät alatunnisteessa |
| **Tarjous** | otsikko värillisellä bannerilla, tiedot ruudukossa, palvelut, voimassaolo, ”Hyväksytty”-alue |
| **Rivin tiedot** | suuri, koko leveydeltään ulottuva otsikko, kuvakentän valokuva, kentät ruudukossa, pitkät tekstit |
| **Todistus** | kehystetty vaakasivu, keskitetty teksti, allekirjoitus |
| **Tyhjä sivu** | otsikko ja rivin kentät |

Se rakennetaan **taulukkosi sarakkeista** — sen numerosta, päivämäärästä, summista,
valokuvasta, siihen linkitetyistä riveistä — ja se, mitä taulukossa ei ole, jätetään
yksinkertaisesti pois. Kaikkea voi muokata sen jälkeen; esikatselu oikealla näyttää avoinna
olevan rivin PDF:n ja päivittyy joka muutoksella.

## Sisältö: lohkot

Lohkot seuraavat toisiaan ylhäältä alas; niitä **vedetään** kahvasta järjestyksen
muuttamiseksi, ja avataan säätämistä varten.

| Lohko | Mitä se näyttää |
|---|---|
| **Otsikko** | suuri otsikko ja alaotsikko, pelkistettynä, värillisenä, alleviivattuna, tai bannerilla — sivun reunasta reunaan |
| **Teksti** | muotoiltua tekstiä — otsikot, lihavointi, luettelot, linkit — joka viittaa rivin sarakkeisiin **Sarake**-valikolla: ”Lasku `{{numero}}`, `{{date}}`” ; tasattuna vasemmalle, oikealle tai molemmille, värillisellä taustalla, kehystettynä tai värillisellä palkilla merkittynä |
| **Kuva** | logo, leima, tai rivin kuvakentän valokuva |
| **Rivin kentät** | valitut kentät, tai kaikki: nimike vasemmalla, nimike yllä 2 tai 3 sarakkeen ruudukossa, tai **yhteenveto** — arvot oikealla, viimeinen (maksettava loppusumma) lihavoituna; tyhjät kentät voi piilottaa |
| **Linkitettyjen rivien taulukko** | rivit, jotka viittaavat tähän — laskun rivit — tai ne, joihin moniviittaus viittaa, niiden **loppusummien** kanssa; värillinen otsikkorivi, joka toinen rivi sävytetty, sarakeotsikot, leveydet ja tasaukset omaan makuun (”Kpl” sanalle ”Kappalemäärä”) |
| **Sarakkeet** | kaksi tai kolme rinnakkaista saraketta, kummallakin omat lohkonsa: ”Laskutettava” toisella puolella, viitteet toisella |
| **Erotinviiva**, **Väli** | viiva — lyhyt allekirjoitukselle — tai tyhjä tila |
| **Sivunvaihto** | jatko uudelle sivulle |

## Tyyli ja sivu

- **Korostusväri** — brändisi väri: otsikot, bannerit, taulukon otsikkorivit, linkit. Sen
  päällä oleva teksti on valkoinen tai tumma, sen mukaan, mikä luetaan parhaiten.
- **Tekstin väri**, tekstin ja otsikoiden **fontti** (groteski tai antiikva), tekstin
  **koko**, väliotsikoiden tyyli.
- **Koko** (A4 tai Letter), **suunta**, **marginaalit**, yksin- tai kaksinkertainen **kehys**
  sivun ympärillä, **pystysuunnassa keskitetty** sisältö — todistukselle.
- **Arvojen kieli**: summat kirjoitetaan valuutallaan (”1 234,50 €”), päivämäärät sanoina
  (”30. syyskuuta 2026”), kyllä ja ei, valinnan nimike, henkilön nimi. Teksti ladotaan
  sisäänrakennetuilla fonteilla, jotka kattavat basedb:n kaksikymmentä kieltä, kirjoitusmerkit
  mukaan lukien.

## Ylätunniste ja alatunniste

**Ylätunniste** kantaa **logosi** — lähetetyn kuvan (PNG, JPEG tai SVG; liian painava kuva
pienennetään) tai rivin kuvakentän — vasemmalla olevan tekstin (yhteystietosi) ja oikealla
olevan tekstin (mikä asiakirja on kyseessä, sen numero, päivämäärä), ensimmäisellä sivulla tai
joka sivulla. **Alatunniste** kantaa lakisääteiset merkintäsi ja sivunumerot. Molemmat
viittaavat rivin sarakkeisiin, kuten teksti.

## Kukin omilla käyttöoikeuksillaan

Asiakirja luetaan **sen tulostajan käyttöoikeuksilla**: häneltä piilotettu kenttä ei näy
siinä – ei tekstissä, ei kuvassa –, hänelle näkymätön linkitetty rivi ei ole taulukossa – eikä
loppusummassa. Kaksi henkilöä voi siis saada samasta rivistä kaksi erilaista asiakirjaa:
kullakin on omansa.

## API:lla

```bash
# Rivin PDF mallilla, tai ”kortti”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listaa taulukon mallit.

## Rajoitukset

- Lähetetty kuva painaa enintään 300 kt, kahdeksan mallia kohden; kentän kuva otetaan mukaan,
  jos se on PNG tai JPEG.
- Linkitetyn rivin arvoon viitataan taulukon ulkopuolella **hakulla**, joka kohdistuu
  asiakirjan taulukkoon; verollinen loppusumma on taulukon kenttä.
- Yksi asiakirja riviä kohden: ei vielä useamman rivin PDF:ää.
  [Automaatio](/basedb/fi/fonctionnalites/automatisations/#pdf-ja-sähköposti) voi tehdä sen
  puolestasi — **Luo PDF** — ja lähettää sen liitteenä.
