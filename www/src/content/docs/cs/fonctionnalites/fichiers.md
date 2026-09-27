---
title: Soubory
description: Pole Soubor a Obrázek na disku nebo v úložišti kompatibilním s S3.
---

Pole **Soubor** a **Obrázek** přijímají soubory. Bajty **se neukládají do PostgreSQL**:
sloupec uchovává jen to, co je potřeba k jejich výpisu (identifikátor, název, typ, velikost),
a samotné soubory žijí ve vyhrazeném úložišti, odkud se poskytují přes podepsané odkazy.

## Na disku

Ve výchozím nastavení API zapisuje soubory do adresáře – v obrazu Dockeru je to svazek
`files` připojený do `/data/files`. To stačí pro jediného hostitele; API při spuštění oznámí,
kam se soubory ukládají.

## V úložišti kompatibilním s S3

AWS, Scaleway, OVH, Cloudflare R2, Garage, SeaweedFS, MinIO…:

```bash
BASEDB_S3_BUCKET=basedb
BASEDB_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BASEDB_S3_REGION=fr-par
BASEDB_S3_ACCESS_KEY_ID=…
BASEDB_S3_SECRET_ACCESS_KEY=…
# BASEDB_S3_FORCE_PATH_STYLE=0   pro adresování podle hostitele
```

Je-li nastaveno `BASEDB_S3_BUCKET` bez ostatních hodnot, API se odmítne spustit a uvede,
které hodnoty chybí.

## Velikost

`BASEDB_FILES_MAX_MB` omezuje velikost jednoho souboru (ve výchozím nastavení 25 MB).

:::note
Formuláře sdílené odkazem nekladou otázky typu Soubor a Obrázek: neotevírají nahrávání
souborů neznámým lidem.
:::
