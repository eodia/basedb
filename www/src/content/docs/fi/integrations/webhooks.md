---
title: Webhookit
description: Ilmoita toiselle järjestelmälle jokaisesta luonnista, muutoksesta tai poistosta.
---

Webhook lähettää HTTPS-osoitteeseen yhden tai useamman taulukon **tapahtumat**:
`record.created`, `record.updated`, `record.deleted`. Niitä hallitaan kohdasta **Webhookit…**
tietokannan valikossa kohdassa **API ja agentit**.

## Hyötykuorma

Runko on aina **tapahtumataulukko**, jossa kullakin tapahtumalla on rivi **ennen** ja **jälkeen**
kokonaisina sekä luettelo muuttuneista kentistä:

```json
{ "events": [
  { "id": "0195e…", "type": "record.updated",
    "occurred_at": "2026-09-26T14:03:00.120Z",
    "tenant": "t4z56fq", "base": "b_t4z56fq_ventes", "table": "opportunites",
    "record_id": "0195a…",
    "actor": { "kind": "user" },
    "before": { "statut": "negociation", "montant": "125000", … },
    "after":  { "statut": "gagne", "montant": "125000", … },
    "changed": ["statut"] } ] }
```

Jopa suoralla SQL:llä tehty kirjoitus tuottaa tapahtumansa: tapahtumat lähtevät historiasta,
jonka liipaisin tallentaa.

## Allekirjoitus, järjestys, uudelleenyritykset

- **Allekirjoitettu**: `X-Basedb-Signature: t=…,v1=…`, raa'an rungon HMAC-SHA256, joka on
  tarkistettava ennen jäsentämistä.
- **Järjestetty** riveittäin: saman rivin kaksi tapahtumaa saapuvat järjestyksessä.
- **Yritetään uudelleen** epäonnistuessa; sen jälkeen webhook poistetaan käytöstä, ja sen voi
  ottaa uudelleen käyttöön käyttöliittymästä. Jonoa ja jokaista toimitusta voi tarkastella, ne voi
  lähettää uudelleen tai hylätä.
- Toimitus **vähintään kerran**: poista kaksoiskappaleet `X-Basedb-Delivery-Id`- tai
  `events[].id`-arvon perusteella.

## Kohteet

Webhookit lähtevät vain **julkisiin HTTPS-osoitteisiin**. Kehityksessä `BASEDB_WEBHOOK_DEV=1`
hyväksyy HTTP:n ja paikalliset osoitteet.

**Oman verkkosi palvelinta** varten instanssin ylläpitäjä nimeää sen muuttujassa
`BASEDB_WEBHOOK_ALLOW` — nimi, verkkotunnus (`*.intra.example.com`), osoite tai osoitealue
(`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Näitä kohteita hyväksytään olipa niiden osoite, portti ja skeema mikä tahansa, HTTP mukaan
lukien. Luettelo koskee myös automaatioiden HTTP-pyyntöjä ja synkronoitujen taulukoiden
lähteitä; se asetetaan ympäristössä, ei koskaan käyttöliittymästä.

## Ei webhookia: taulukon seuraaminen

Palvelin, jota ei voida tavoittaa, voi myös **muodostaa yhteyden** basedb:hen ja seurata
taulukkoa reaaliaikaisen virran avulla, tietokannan integraatiotunnuksella:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Virta (`text/event-stream`) kantaa **signaaleja** — tapahtuman `records`, jossa on luotujen,
muokattujen tai poistettujen rivien tunnisteet —, ei koskaan arvoja: ohjelma lukee nämä rivit
sitten [REST API:n](/basedb/fi/integrations/api-rest/) kautta. Mitätöity tunnus sulkee virtansa
20 sekunnin kuluessa. Harvoin luettavalle taulukolle riittää lukea muuttuneet rivit aika ajoin:
`filter=_updated_at gt "2026-09-30T08:00:00Z"`.
