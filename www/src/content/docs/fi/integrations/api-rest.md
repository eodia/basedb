---
title: REST API
description: Lue ja kirjoita basedb:n rivejä ohjelmasta.
---

REST API on sama, jota käyttöliittymä käyttää: **yksityisiä reittejä ei ole**. Sen URL-osoitteissa
ovat fyysiset nimet – samat, jotka luet myös SQL:ssä.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Tunnus

Käyttöliittymässä tietokannan **⋯**-valikko → **API ja agentit** → **API- ja MCP-tunnukset…**:
siellä luodaan tähän tietokantaan rajattu **integraatiotunnus**, oletuksena vain luku -oikeuksin,
kun olet ensin vahvistanut salasanasi. Se näytetään vain kerran; tallenna se
ympäristömuuttujaan.

Tunnus lukee, luo ja muokkaa, jos se on luotu kirjoitusoikeuksin, **ei koskaan poista**, eikä
sillä ole koskaan enempää oikeuksia kuin sen luoneella henkilöllä.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Lukeminen

| Parametri | Tehtävä |
|---|---|
| `filter` | luettava lauseke: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | palautettavat sarakkeet |
| `limit`, `cursor` | sivutus salatulla kursorilla (`next_cursor` vastauksessa) |
| `links=display` | viittaukset näyttöarvoineen |
| `count=exact` | kokonaismäärä, enintään 100 000 |
| `variables=raw` | pitkät tekstit sellaisinaan kirjoitettuina, `{{colonne}}` mukaan lukien, eikä [rivin arvoilla](/basedb/fi/fonctionnalites/tables-et-champs/#muotoiltu-teksti-ja-muuttujat) |

Operaattorit: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between` yhdistettyinä operaattoreilla `and`, `or`, `not` ja
sulkeilla. Suodatin kulkee viittauksen läpi: `clients_id.ville eq "Lyon"`.

## Kirjoittaminen

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` muokkaa riviä samalla rungolla `{"values": {…}}`. Virheillä on yksi
yhtenäinen muoto: `{ "code": "…", "details": {…}, "request_id": "…" }`, ja kullakin syyllä on
pysyvä koodi.

Jokainen kirjoitus palauttaa otsakkeen `x-basedb-transaction`: sen välittäminen kutsulle
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`) kumoaa kirjoituksen kuten Ctrl+Z
käyttöliittymässä – hylätään, jos riviä on muokattu sen jälkeen.

## Rivien lisäksi

Samalla tunnuksella:

| Reitti | Tehtävä |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | yhteenvedot suodattimen kaikista riveistä: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | rivin kommenttien lukeminen ja kirjoittaminen |
| `POST /api/v1/<tenant>/automations/<id>/run` | painikkeella käynnistettävän automaation suorittaminen rivillä (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | tietokannan koontinäytöt |
| `GET /api/v1/<tenant>/meta/users` | työtilan jäsenet Henkilö-kenttää varten |
| `GET /api/v1/<tenant>/meta/templates` | gallerian tietokantamallit |

[Jaettuja näkymiä](/basedb/fi/fonctionnalites/vues-partagees/) luetaan ilman tiliä:
`GET /api/v1/views/<jeton>` ja `…/rows` JSON-muodossa, `…/calendar.ics` iCalendar-muodossa.

Rakentaminen – automaation, koontinäytön tai integraation luominen – on varattu käyttöliittymän
istunnolle: tunnus lukee ja kirjoittaa rivejä, se ei muuta tietokantaa.

## Luotu dokumentaatio

Jokaisella tietokannalla on **API- ja MCP-dokumentaatio**-sivu: jokaisesta taulukosta sen
päätepisteet, sarakkeet sekä esimerkit cURL:llä ja JavaScriptillä. Se on **suodatettu
käyttöoikeuksiesi mukaan** – kaksi lukijaa saa kaksi eri versiota –, kirjoitettu **näytön
kielellä**, ja se on saatavilla myös OpenAPI 3.1 -muodossa
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`). Nimet, polut ja virhekoodit pysyvät samoina
kaikilla kielillä.

![Tietokannan luotu dokumentaatio](../../../../assets/screens/documentation-api.png)
