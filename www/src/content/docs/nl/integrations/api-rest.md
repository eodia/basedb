---
title: REST-API
description: De rijen van basedb lezen en schrijven vanuit een programma.
---

De REST-API is dezelfde die de interface gebruikt: **er bestaat geen private route**.
De URL’s bevatten de fysieke namen — dezelfde die je ook in SQL leest.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Een token

In de interface, menu **⋯** van de database → **API en agents** → **API- en MCP-tokens…**: daar maak je een
**integratietoken** aan dat beperkt is tot deze database, standaard alleen-lezen, nadat je je
wachtwoord hebt bevestigd. Het wordt maar één keer getoond; zet het in een omgevingsvariabele.

Een token leest, maakt aan en wijzigt als het met schrijfrechten is aangemaakt, **verwijdert nooit**, en heeft nooit
meer rechten dan de persoon die het heeft aangemaakt.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Lezen

| Parameter | Rol |
|---|---|
| `filter` | een leesbare expressie: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | de kolommen die moeten worden teruggegeven |
| `limit`, `after` | paginering met een versleutelde cursor: `meta.next_cursor` van een pagina, doorgegeven als `after`, geeft de volgende (`meta.has_next_page`) |
| `links=display` | de relaties met hun weergavewaarde |
| `count=exact` | het totaal, begrensd op 100 000 |
| `variables=raw` | lange teksten zoals ze geschreven zijn, `{{colonne}}` inbegrepen, in plaats van met de [waarden van de rij](/basedb/nl/fonctionnalites/tables-et-champs/#opgemaakte-tekst-en-variabelen) |

De operatoren: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, gecombineerd met `and`, `or`, `not` en haakjes. Een
filter gaat door een relatie heen: `clients_id.ville eq "Lyon"`.

## Schrijven

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` wijzigt een rij met dezelfde body `{"values": {…}}`. Fouten
hebben één vorm: `{ "code": "…", "details": {…}, "request_id": "…" }`, met een
stabiele code per oorzaak.

Elke schrijfactie stuurt de header `x-basedb-transaction` terug: die doorgeven aan
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`) maakt haar ongedaan, zoals Ctrl+Z in
de interface — geweigerd als de rij sindsdien is gewijzigd.

## Meer dan rijen

Met hetzelfde token:

| Route | Rol |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | samenvattingen over alle rijen van een filter: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | de opmerkingen van een rij lezen en schrijven |
| `POST /api/v1/<tenant>/automations/<id>/run` | een automatisering met een knoptrigger starten, op een rij (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | de dashboards van een database |
| `GET /api/v1/<tenant>/meta/users` | de leden van de werkruimte, voor een veld Persoon |
| `GET /api/v1/<tenant>/meta/templates` | de databasesjablonen uit de galerie |

[Gedeelde weergaven](/basedb/nl/fonctionnalites/vues-partagees/) lees je zonder account:
`GET /api/v1/views/<jeton>` en `…/rows` in JSON, `…/calendar.ics` in iCalendar.

Bouwen — een automatisering, een dashboard of een integratie aanmaken — blijft voorbehouden aan
een sessie in de interface: een token leest en schrijft rijen, het verandert de database niet.

## De gegenereerde documentatie

Elke database heeft een pagina **API- en MCP-documentatie**: voor elke tabel de endpoints, de
kolommen, voorbeelden in cURL en in JavaScript. Ze wordt **gefilterd op jouw rechten** — twee
lezers krijgen twee versies —, geschreven **in de taal van je scherm**, en bestaat ook in
OpenAPI 3.1 (`/api/v1/<tenant>/meta/bases/<base>/openapi.json`). De namen, de paden en de
foutcodes blijven in elke taal hetzelfde.

![De gegenereerde documentatie van een database](../../../../assets/screens/nl/documentation-api.webp)
