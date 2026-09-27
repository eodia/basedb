---
title: Tiedostot
description: Tiedosto- ja Kuva-kentät levyllä tai S3-yhteensopivassa tallennustilassa.
---

**Tiedosto**- ja **Kuva**-kentät hyväksyvät tiedostoja. Tavut **eivät mene PostgreSQL:ään**:
sarake säilyttää sen, mitä tiedostojen luettelemiseen tarvitaan (tunniste, nimi, tyyppi, koko),
ja itse tiedostot ovat omassa tallennustilassaan, josta ne tarjoillaan allekirjoitetuilla
linkeillä.

## Levyllä

Oletuksena API kirjoittaa tiedostot hakemistoon – Docker-kuvassa polkuun `/data/files`
liitettyyn `files`-taltioon. Se riittää yhdelle palvelimelle; API kertoo käynnistyessään, minne
tiedostot menevät.

## S3-yhteensopivassa tallennustilassa

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   isäntänimeen perustuvaa osoitteistusta varten
```

Jos `BASEDB_S3_BUCKET` on määritetty ilman muita arvoja, API kieltäytyy käynnistymästä ja kertoo,
mitkä puuttuvat.

## Koko

`BASEDB_FILES_MAX_MB` rajoittaa tiedoston kokoa (oletuksena 25 Mt).

:::note
Linkillä jaetut lomakkeet eivät esitä Tiedosto- ja Kuva-kysymyksiä: ne eivät avaa tiedostojen
tallennusta tuntemattomille.
:::
