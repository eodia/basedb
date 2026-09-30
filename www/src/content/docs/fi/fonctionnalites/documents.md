---
title: PDF-asiakirjat
description: Rivi laskuna, tarjouksena tai tulostettavana korttina, mukana linkitetyt rivit ja loppusummat.
---

Rivistä tulee **PDF**: lasku riveineen ja loppusummineen, tarjous, lähetysluettelo, kortti.
Rivin tiedoissa **PDF-asiakirja**-painike avaa sen uuteen välilehteen, josta selain tulostaa tai
tallentaa sen.

## Kortti, säätämättä mitään

Ilman mallia rivi tulostuu **korttina**: sen nimi otsikkona, ja sen jälkeen kaikki kentät,
jotka voit lukea, omalla kielelläsi.

## Mallit

Se, joka rakentaa taulukkoa – Hallintaoikeus-taso – kirjoittaa mallit rivin tiedoista:
**PDF-asiakirja › Asiakirjamallit…**. Malli on sivu (A4 tai Letter, pysty- tai vaakasuunta),
kieli arvoille, alatunniste ja sarja lohkoja:

| Lohko | Mitä se näyttää |
|---|---|
| **Teksti** | muotoiltua tekstiä – otsikot, lihavointi, luettelot, linkit –, joka viittaa rivin sarakkeisiin **Sarake**-valikolla: ”Lasku `{{numero}}`, `{{date}}`” |
| **Rivin kentät** | valitut kentät, tai kaikki: nimike vasemmalla, arvo oikealla |
| **Linkitettyjen rivien taulukko** | rivit, jotka viittaavat tähän – laskun riviltä – tai ne, joihin moniviittaus viittaa, valituilla sarakkeilla ja niiden **loppusummilla** |
| **Sivunvaihto** | jatko uudelle sivulle |

Editori näyttää vierellä PDF:n, jonka malli tekee avoinna olevasta rivistä, muutokset mukaan
lukien.

Arvot kirjoitetaan **mallin kielellä**: summa valuuttoineen (”1 234,50 €”), päivämäärä
sanoina (”30. syyskuuta 2026”), kyllä ja ei, valinnan nimike, henkilön nimi. Teksti ladotaan
sisäänrakennetuilla fonteilla, jotka kattavat basedb:n kaksikymmentä kieltä, kirjoitusmerkit
mukaan lukien.

## Kukin omilla käyttöoikeuksillaan

Asiakirja luetaan **sen tulostajan käyttöoikeuksilla**: häneltä piilotettu kenttä ei näy siinä,
hänelle näkymätön linkitetty rivi ei ole taulukossa – eikä loppusummassa. Kaksi henkilöä voi
siis saada samasta rivistä kaksi erilaista asiakirjaa: kullakin on omansa.

## API:lla

```bash
# Rivin PDF mallilla, tai ”kortti”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` listaa taulukon mallit.

## Rajoitukset

- Ei kuvaa (logoa) eikä valittua väriä asiakirjassa, ei alatunnisteesta erillistä
  ylätunnistetta.
- Yksi asiakirja riviä kohden: ei vielä useamman rivin PDF:ää, eikä tuottamista
  automaatiolla.
