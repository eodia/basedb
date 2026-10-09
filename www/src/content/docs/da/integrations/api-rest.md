---
title: REST-API
description: Læs og skriv basedbs rækker fra et program.
---

REST-API'et er det samme, som brugerfladen bruger: **der findes ingen private ruter**. Dets URL'er
indeholder de fysiske navne — dem, du også læser i SQL.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Et token

I brugerfladen, databasens **⋯**-menu → **API og agenter** → **API- og MCP-tokens…**: den, der har
niveauet **Administrere** på databasen, eller på dens projekt, opretter her et
**integrationstoken**, der er begrænset til denne database — alle dens miljøer eller kun ét — og
som standard er skrivebeskyttet, efter at have bekræftet adgangskoden — en konto uden adgangskode,
der logger ind via en identitetsudbyder, kan ikke gøre det endnu. Det vises kun én gang; læg det i
en miljøvariabel.

Et token læser; det opretter og redigerer, hvis det er oprettet med skriveadgang, og **sletter,
hvis det er oprettet til det** — rettighederne »Læse, skrive og slette« — undtagen en række, som en
kaskaderelation ville tage med sig sammen med andre. Det har aldrig flere tilladelser end den
person, der oprettede det.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Vælg miljøet

En database, der har flere [miljøer](/basedb/da/fonctionnalites/environnements/) — produktion,
test… — forbliver **én** database for et token oprettet til hele databasen. Stien angiver
databasen ved navnet på dens produktion, og headeren `X-Basedb-Environment` vælger miljøet:

```bash
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  -H "X-Basedb-Environment: recette"
```

- Uden headeren er det det miljø, som stien angiver: `b_t4z56fq_ventes` er produktion,
  `b_t4z56fq_ventes_recette` er test — begge skrivemåder gælder fortsat.
- `?environment=recette` gør det samme for en klient, der ikke sætter en header.
- Et miljø angives ved sit mærke, uden hensyn til store og små bogstaver eller accenter, eller ved
  `production`. Et miljø, som databasen ikke har, svarer `404`, som enhver manglende ressource.
- `GET /api/v1/<tenant>/meta/bases` lister hvert miljø med dets blok `environment`
  (`label`, `production`); med headeren lister den kun dette.

Et token, der ved oprettelsen er begrænset til ét enkelt miljø, åbner ikke noget andet: headeren
ændrer intet. Dets tilladelser krydses altid, miljø for miljø, med dem for den person, der
oprettede det.

## Læs

| Parameter | Rolle |
|---|---|
| `filter` | et læsbart udtryk: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | de kolonner, der skal returneres |
| `limit`, `after` | paginering med krypteret cursor: `meta.next_cursor` fra en side, givet videre som `after`, giver den næste (`meta.has_next_page`) |
| `links=display` | relationerne med deres visningsværdi |
| `count=exact` | totalen, med et loft på 100 000 |
| `variables=raw` | lange tekster, som de er skrevet, `{{colonne}}` inklusive, i stedet for med [rækkens værdier](/basedb/da/fonctionnalites/tables-et-champs/#formateret-tekst-og-variabler) |

Operatorerne: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, kombineret med `and`, `or`, `not` og parenteser. Et
filter kan gå på tværs af en relation: `clients_id.ville eq "Lyon"`.

## Skriv

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` redigerer en række med den samme krop `{"values": {…}}`. Fejl har én
fast form: `{ "code": "…", "details": {…}, "request_id": "…" }`, med en stabil kode pr. årsag.

Hver skrivning returnerer headeren `x-basedb-transaction`: sender du den til
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`), fortrydes den, ligesom Ctrl+Z i
brugerfladen — det afvises, hvis rækken er blevet ændret siden.

## Ud over rækkerne

Med det samme token:

| Rute | Rolle |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | opsummeringer over alle rækker i et filter: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | læs og skriv en rækkes kommentarer |
| `POST /api/v1/<tenant>/automations/<id>/run` | start en automatisering, der udløses af en knap, på en række (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | en databases dashboards |
| `GET /api/v1/<tenant>/meta/users` | arbejdsområdets medlemmer, til et Person-felt |
| `GET /api/v1/<tenant>/meta/templates` | galleriets databaseskabeloner |
| `GET /api/v1/<tenant>/events?base=<base>&table=<table>` | følg en tabel i realtid: signaler, som derefter genlæses via ovenstående ruter (se [Webhooks](/basedb/da/integrations/webhooks/#uden-webhook-følg-en-tabel)) |

[Delte visninger](/basedb/da/fonctionnalites/vues-partagees/) kan læses uden konto:
`GET /api/v1/views/<jeton>` og `…/rows` i JSON, `…/calendar.ics` i iCalendar.

At bygge — oprette en automatisering, et dashboard, en integration — er forbeholdt en session i
brugerfladen: et token læser og skriver rækker, det ændrer ikke databasen.

## Farver og ikoner

En tabel og hver valgmulighed i et enkeltvalg har en farve (`color`, `#rrggbb`) og et ikon
(`icon`, navnet på et [Lucide](https://lucide.dev/icons/)-ikon, som brugerfladen tegner: `truck`,
`circle-check`, `flame`…). `GET …/meta/bases/<base>` gengiver dem for databasen, dens tabeller og
dens felters valgmuligheder.

For at vælge dem, med adgangstokenet fra en person, der kan ændre strukturen
(`POST /auth/session/access`) — et integrationstoken ændrer ikke databasen:

| Rute | Krop |
|---|---|
| `POST …/admin/bases/<base>/tables` | `{"label": "Tickets", "color": "#dc2626", "icon": "flame", "fields": […]}` |
| `PATCH …/admin/bases/<base>/tables/<table>` | `{"color": "#2563eb", "icon": "inbox"}` — de tre nøgler `color`, `icon`, `image` rejser sammen: at nævne én erstatter alle tre |
| `POST …/admin/bases/<base>/tables/<table>/fields` | `{"label": "Priorité", "kind": "select", "options": [{"value": "haute", "color": "#dc2626", "icon": "flame"}, …]}` |
| `PUT …/admin/bases/<base>/tables/<table>/fields/<champ>/options` | hele listen af muligheder, i rækkefølge, hver med sin farve og sit ikon |

En agent går via [MCP-serveren](/basedb/da/integrations/mcp/#farver-og-ikoner), hvor den
**foreslår** disse ændringer. Et felt har intet ikon at vælge: brugerfladen tegner det, der hører
til dets type.

## Opret en database fra en skabelon

En applikation, der installeres, opretter sin database i **ét kald**: serveren anvender
skabelonen — tabeller, felter, relationer, eksempelrækker, visninger, dashboards,
automatiseringer — og efterlader ingen database, hvis et trin mislykkes.

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/admin/bases" \
  -H "Authorization: Bearer $ACCES" -H "content-type: application/json" \
  -d '{"template": "crm", "label": "Ventes", "rows": false}'
```

`template` er nøglen til en skabelon fra galleriet, eller en hel skabelon i
[skabelonformatet](/basedb/da/fonctionnalites/modeles/). Med headeren
`Accept: application/x-ndjson` ankommer svaret linje for linje: en linje `{"step": …}` pr.
trin, derefter den oprettede database. Dette kald kræver adgangstokenet fra en person, der kan
oprette en database (`POST /auth/session/access`, efter login): et integrationstoken åbner kun
en eksisterende database.

## Kontroller et token

basedbs tokens kan ikke kontrolleres uden for basedb. En applikation, der modtager et — et
værktøj, der åbnes fra basedb med personens token, for eksempel — spørger, hvad det er værd
(introspektion, RFC 7662), med sit eget integrationstoken:

```bash
curl -X POST "http://localhost:3000/auth/introspect" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  --data-urlencode "token=$JETON_RECU"
```

```json
{ "active": true, "token_type": "access_token",
  "sub": "0195a…", "email": "claire@example.com", "name": "Claire Martin",
  "tenant": "t4z56fq", "groups": ["Commerciaux"], "exp": 1790000000 }
```

Ethvert token, der ikke er gyldigt — ukendt, udløbet, tilbagekaldt, session afsluttet, andet
arbejdsområde — svarer `{"active": false}`, uden at sige hvorfor. Svaret læses direkte: en
udlogning ses med det samme. For et integrationstoken angiver svaret også den database, det
åbner (`base`, dens produktion), om det åbner alle dens miljøer (`environments`: `all`) eller kun
ét (`one`), dets adgang (`read`, `write` eller `delete`) og dets flader.

## Den genererede dokumentation

Hver database har sin side **API- og MCP-dokumentation**: for hver tabel dens endpoints, dens
kolonner og eksempler i cURL og JavaScript. Den er **filtreret efter dine tilladelser** — to
læsere får to versioner —, skrevet **på din skærms sprog**, og findes også i OpenAPI 3.1
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`), som erklærer Bearer-tokenet og headeren
`X-Basedb-Environment`. Navnene, stierne og fejlkoderne forbliver de samme på alle sprog.

![Den genererede dokumentation for en database](../../../../assets/screens/da/documentation-api.webp)
