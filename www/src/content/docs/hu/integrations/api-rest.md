---
title: REST API
description: A basedb sorainak olvasása és írása egy programból.
---

A REST API ugyanaz, amelyet a felület is használ: **nincs privát útvonal**. Az URL-jei a
fizikai neveket tartalmazzák – ugyanazokat, amelyeket SQL-ben is olvas.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Token

A felületen az adatbázis **⋯** menüje → **API és ügynökök** → **API- és MCP-tokenek…**: akinek az
adatbázison, vagy annak projektjén, **Kezelés** szintje van, az itt hoz létre egy erre az
adatbázisra — az összes környezetére, vagy csak egyre — korlátozott, alapértelmezés szerint
csak olvasási **integrációs tokent**, miután megerősítette a jelszavát — a jelszó nélküli fiók,
amely egy identitásszolgáltatón keresztül jelentkezik be, ezt még nem teheti meg. Csak egyszer
jelenik meg; helyezze el egy környezeti változóban.

Egy token olvas; létrehoz és módosít, ha írásra jött létre, és **töröl, ha erre jött létre** —
jogosultság: „Olvasás, írás és törlés” —, kivéve egy olyan sort, amelyet egy kaszkádolt
kapcsolat másokkal együtt vinne el. Soha nincs több jogosultsága, mint annak a személynek, aki
létrehozta.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Környezet kiválasztása

Az az adatbázis, amelynek több [környezete](/basedb/hu/fonctionnalites/environnements/) van — éles,
teszt… —, az egész adatbázisra létrehozott token számára **egyetlen** adatbázis marad. Az útvonal az
adatbázist az éles környezete nevével nevezi meg, az `X-Basedb-Environment` fejléc pedig kiválasztja
a környezetet:

```bash
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  -H "X-Basedb-Environment: recette"
```

- A fejléc nélkül azt a környezetet kapja, amelyet az útvonal megnevez: a `b_t4z56fq_ventes` az éles,
  a `b_t4z56fq_ventes_recette` a teszt környezet — mindkét írásmód érvényes marad.
- Az `?environment=recette` ugyanezt teszi egy olyan kliensnél, amely nem küld fejlécet.
- Egy környezet a jelvényével nevezhető meg, a kis- és nagybetűk, valamint az ékezetek
  figyelembevétele nélkül, vagy a `production` névvel. Egy olyan környezet, amellyel az adatbázis nem
  rendelkezik, `404`-gyel válaszol, mint minden hiányzó erőforrás.
- A `GET /api/v1/<tenant>/meta/bases` minden környezetet felsorol az `environment` blokkjával
  (`label`, `production`); a fejléccel csak azt az egyet sorolja fel.

Egy olyan token, amelyet a létrehozásakor egyetlen környezetre korlátoztak, másikat nem nyit meg: a
fejléc ezen nem változtat. A jogosultságai mindig metszetet képeznek annak a személynek a
jogosultságaival, aki létrehozta — környezetenként külön-külön.

## Olvasás

| Paraméter | Szerep |
|---|---|
| `filter` | olvasható kifejezés: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | a visszaadandó oszlopok |
| `limit`, `after` | lapozás titkosított kurzorral: egy oldal `meta.next_cursor` értékét `after`-ként átadva megkapja a következőt (`meta.has_next_page`) |
| `links=display` | a kapcsolatok a megjelenítési értékükkel |
| `count=exact` | a teljes darabszám, legfeljebb 100 000 |
| `variables=raw` | a hosszú szövegek úgy, ahogy le vannak írva, a `{{colonne}}` hivatkozásokkal együtt, nem pedig [a sor értékeivel](/basedb/hu/fonctionnalites/tables-et-champs/#formázott-szöveg-és-változók) |

Az operátorok: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, amelyek az `and`, `or`, `not` operátorokkal és zárójelekkel
kombinálhatók. A szűrő áthalad egy kapcsolaton: `clients_id.ville eq "Lyon"`.

## Írás

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

A `PATCH …/<table>/<_id>` ugyanazzal a `{"values": {…}}` törzzsel módosít egy sort. A hibák
egységes formájúak: `{ "code": "…", "details": {…}, "request_id": "…" }`, okonként stabil
kóddal.

Minden írás visszaadja az `x-basedb-transaction` fejlécet: ha ezt átadja a
`POST /api/v1/<tenant>/history/undo` végpontnak (`{"transaction": "…"}`), az visszavonja az
írást, ahogy a Ctrl+Z a felületen – és elutasítja, ha a sort azóta módosították.

## A sorokon túl

Ugyanazzal a tokennel:

| Útvonal | Szerep |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | összesítések egy szűrő összes során: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | egy sor megjegyzéseinek olvasása és írása |
| `POST /api/v1/<tenant>/automations/<id>/run` | gombbal kiváltott automatizálás indítása egy soron (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | egy adatbázis irányítópultjai |
| `GET /api/v1/<tenant>/meta/users` | a munkaterület tagjai, egy Személy mezőhöz |
| `GET /api/v1/<tenant>/meta/templates` | a galéria adatbázissablonjai |
| `GET /api/v1/<tenant>/events?base=<base>&table=<table>` | egy tábla valós idejű követése: jelzések, amelyeket a fenti útvonalak olvasnak vissza utólag (lásd: [Webhookok](/basedb/hu/integrations/webhooks/#webhook-nélkül-tábla-követése)) |

A [megosztott nézetek](/basedb/hu/fonctionnalites/vues-partagees/) fiók nélkül olvashatók:
`GET /api/v1/views/<jeton>` és `…/rows` JSON-ban, `…/calendar.ics` iCalendar formátumban.

Az építés – automatizálás, irányítópult, integráció létrehozása – a felületen nyitott
munkamenetnek van fenntartva: egy token sorokat olvas és ír, az adatbázist nem változtatja meg.

## Színek és ikonok

Egy táblának és egy egyszeres választás mező minden lehetőségének van színe (`color`, `#rrggbb`) és
ikonja (`icon`, egy, a felület által megrajzolt [Lucide](https://lucide.dev/icons/)-ikon neve:
`truck`, `circle-check`, `flame`…). A `GET …/meta/bases/<base>` ezeket adja vissza az adatbázisra, a
táblákra és a mezők lehetőségeire.

Kiválasztásukhoz, egy, a struktúrát módosítani jogosult személy hozzáférési tokenjével
(`POST /auth/session/access`) — egy integrációs token nem változtatja meg az adatbázist:

| Útvonal | Törzs |
|---|---|
| `POST …/admin/bases/<base>/tables` | `{"label": "Tickets", "color": "#dc2626", "icon": "flame", "fields": […]}` |
| `PATCH …/admin/bases/<base>/tables/<table>` | `{"color": "#2563eb", "icon": "inbox"}` — a három kulcs (`color`, `icon`, `image`) együtt mozog: bármelyik megnevezése mindhármat lecseréli |
| `POST …/admin/bases/<base>/tables/<table>/fields` | `{"label": "Priorité", "kind": "select", "options": [{"value": "haute", "color": "#dc2626", "icon": "flame"}, …]}` |
| `PUT …/admin/bases/<base>/tables/<table>/fields/<champ>/options` | a lehetőségek teljes listája, sorrendben, mindegyik a saját színével és ikonjával |

Az ügynök az [MCP-szerveren](/basedb/hu/integrations/mcp/#színek-és-ikonok) keresztül dolgozik, ahol
ezeket a módosításokat **javasolja**. Egy mezőnek nincs kiválasztható ikonja: a felület a típusáét
rajzolja.

## Adatbázis létrehozása egy sablonból

Egy települő alkalmazás **egyetlen hívással** hozza létre az adatbázisát: a szerver
alkalmazza a sablont — táblákat, mezőket, kapcsolatokat, mintasorokat, nézeteket,
irányítópultokat, automatizálásokat —, és ha egy lépés meghiúsul, nem hagy maga után
semmilyen adatbázist.

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/admin/bases" \
  -H "Authorization: Bearer $ACCES" -H "content-type: application/json" \
  -d '{"template": "crm", "label": "Ventes", "rows": false}'
```

A `template` a galéria egy sablonjának kulcsa, vagy egy teljes sablon a
[sablonok formátumában](/basedb/hu/fonctionnalites/modeles/). Az
`Accept: application/x-ndjson` fejléccel a válasz soronként érkezik: egy `{"step": …}` sor
minden lépéshez, majd a létrehozott adatbázis. Ez a hívás egy olyan személy hozzáférési
tokenjét igényli, aki létrehozhat adatbázist (`POST /auth/session/access`, bejelentkezés
után): egy integrációs token csak egy már létező adatbázist nyit meg.

## Token ellenőrzése

A basedb tokenjei a basedb-n kívül nem ellenőrizhetők. Egy alkalmazás, amely kap egyet —
például egy, a basedb-ből a személy tokenjével megnyitott eszköz —, megkérdezi, mit ér
(introspekció, RFC 7662), a saját integrációs tokenjével:

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

Minden token, amely nem ér semmit — ismeretlen, lejárt, visszavont, lezárt munkamenet, másik
munkaterület —, `{"active": false}` választ ad, anélkül hogy megmondaná, miért. A válasz
élőben olvasott: egy kijelentkezés azonnal látható rajta. Egy integrációs token esetén a
válasz azt is elmondja, melyik adatbázist nyitja meg (`base`, az éles környezete), hogy az összes
környezetét nyitja-e meg (`environments`: `all`), vagy csak egyet (`one`), mi a hozzáférése
(`read`, `write` vagy `delete`), és melyek a felületei.

## A generált dokumentáció

Minden adatbázisnak van egy **API- és MCP-dokumentáció** oldala: minden táblához a végpontjai,
az oszlopai, cURL- és JavaScript-példák. **Az Ön jogosultságai szerint szűrt** – két olvasó
két különböző változatot kap –, **az Ön képernyőjének nyelvén** íródik, és OpenAPI 3.1
formátumban is elérhető (`/api/v1/<tenant>/meta/bases/<base>/openapi.json`), amely deklarálja a
Bearer tokent és az `X-Basedb-Environment` fejlécet. A nevek, az útvonalak és a hibakódok minden
nyelven ugyanazok maradnak.

![Egy adatbázis generált dokumentációja](../../../../assets/screens/hu/documentation-api.webp)
