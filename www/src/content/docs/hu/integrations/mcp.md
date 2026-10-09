---
title: MCP-szerver
description: MI-ügynök csatlakoztatása a basedb-hez a Model Context Protocol segítségével.
---

A basedb egy **MCP-szervert** tesz elérhetővé (`POST /mcp`, ugyanazon a címen, mint a felület):
egy ügynök – Claude, egy kódasszisztens, az Ön saját ügynöke – itt fedezi fel az
adatbázisokat, olvas és ír sorokat, töröl is, ha Ön ezt megengedi neki, és **javasol**
struktúramódosításokat.

## Ügynök csatlakoztatása

Hozzon létre egy tokent az **API- és MCP-tokenek…** menüpontból (az adatbázis menüjében, az
**API és ügynökök** alatt), bejelölt MCP-hozzáféréssel. Ugyanaz a token szolgál a REST API-hoz
és az MCP-hez, és megnyitja **az egész adatbázist**: az éles környezetét és a többit is (lásd
lejjebb).

Helyezze a tokent egy környezeti változóba, `BASEDB_TOKEN` néven, soha nem konfigurációs fájlba.
Egy kliens, amely HTTP-n beszél MCP-t — többek között a Claude Code — közvetlenül a `…/mcp` címet
célozza meg, az `Authorization: Bearer <jeton>` fejléccel. A Claude Code-dal:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

A parancs beírja a projekt `.mcp.json` fájlját, amelyben a `${BASEDB_TOKEN}` továbbra is a
változóra való hivatkozás marad: maga a token nem szerepel benne.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Az a kliens, amely csak helyi programokat tud indítani (stdio), a tároló közvetítőjén keresztül
csatlakozik; ez a tokent a `--token-env` által megnevezett változóból olvassa:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Ezután kérje meg az ügynököt, hogy hívja meg a `whoami`-t: megmondja, ki hozta létre a tokent,
melyik adatbázist nyitja meg, a környezeteit és a jogosultságait.

## Környezet kiválasztása

Egy adatbázisnak több [környezete](/basedb/hu/fonctionnalites/environnements/) is lehet — éles,
teszt, fejlesztői —, mindegyik saját táblákkal és sorokkal. Az egész adatbázisra szóló token mindet
megnyitja, és a környezet a legáltalánosabbtól a legpontosabbig választható ki:

- **az adatbázis neve**, semmi más: a `crm` az éles, a `crm_recette` a teszt környezet;
- **a szerver címe**: a `…/mcp?environment=recette` az egész kapcsolatra a teszt környezetet célozza.
  A közvetítő ugyanezt teszi a `--environment recette` kapcsolóval. Így környezetenként egy-egy
  szervert lehet megadni, mindegyiket ugyanazzal a tokennel:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **az `environment` argumentum** minden olyan eszközben, amely megnevez egy adatbázist, egyetlen
  hívásra: `list_records` a `{"base": "crm", "table": "clients", "environment": "recette"}`
  paraméterekkel.

Egy környezet a jelvényével nevezhető meg, a kis- és nagybetűk, valamint az ékezetek
figyelembevétele nélkül (`Recette`, `recette`, `developpement` a „Développement” nevű
környezethez), vagy a `production` névvel. A `whoami` felsorolja a token által megnyitottakat; a
`list_bases` és a `describe_base` megmondja, hogy az egyes adatbázisok melyik környezethez
tartoznak.

Egy token a létrehozásakor egyetlen környezetre is korlátozható: ekkor másikat nem lát.

## A tizenöt eszköz

| Eszköz | Szerep |
|---|---|
| `whoami` | ki az ügynök, milyen jogosultságokkal, és mely környezeteken |
| `list_bases`, `describe_base`, `describe_table` | a struktúra, a leírásainak és a megjelenésének felfedezése |
| `list_records`, `get_record`, `lookup_records` | olvasás, szűrés, egy megjelenítési érték feloldása |
| `create_record`, `update_record` | sorok írása |
| `delete_record`, `restore_record` | egy sor törlése — egy erre létrehozott tokennel — és visszahozása |
| `propose_create_table`, `propose_add_field`, `get_proposal` | struktúramódosítás javaslata |
| `propose_update_look` | egy tábla és a lehetőségei színének és ikonjának javaslása |

## Színek és ikonok

Egy táblának és egy egyszeres választás mező minden lehetőségének van színe és ikonja, akárcsak a
felületen. Az ügynök a javaslatában választja ki őket:

- a `propose_create_table` elfogadja a `color` és az `icon` paramétert a táblához;
- a `propose_add_field` elfogadja a `color` és az `icon` paramétert egy `select` vagy
  `multi_select` minden lehetőségén;
- a `propose_update_look` egy meglévő tábla és a lehetőségei színét és ikonját módosítja: egy
  elhagyott kulcs megtartja a meglévőt, a `null` törli.

A `color` egy `#rrggbb` szín. Az `icon` egy [Lucide](https://lucide.dev/icons/)-ikon neve azok
közül, amelyeket a felület megrajzol — `truck`, `circle-check`, `flame`…: az eszköz sémája
felsorolja őket, és egy ismeretlen nevet elutasít. A `describe_base` és a `describe_table`
visszaadja az aktuális megjelenést. Egy mezőnek viszont nincs kiválasztható ikonja: a felület a
típusáét rajzolja.

## Sorok törlése

Az **Olvasás, írás és törlés** jogosultsággal létrehozott token lehetővé teszi az ügynöknek,
hogy sorokat töröljön, **egyszerre egyet**, a `_id`-jük alapján. A `delete_record` olyan
formában adja vissza a sort, amilyen a törlés előtt volt, és a törlés a token nevében kerül az
előzményekbe; a `restore_record` a `_id`-je alatt hozza vissza a sort — az ügynök maga javítja
ki a saját hibáját, és ezt egy személy is megteheti az előzményekből.

Az ügynök nem töröl:

- csak olvasásra, vagy olvasásra és írásra jogosult tokennel: az elutasítás megmondja, milyen
  tokent kell létrehozni;
- egy olyan sort, amelyet egy kaszkádolt kapcsolat másokkal együtt vinne el
  (`TOKEN_CASCADE_FORBIDDEN`): ezt a törlést a felületen végzi el egy személy, aki látja, mit
  visz el vele;
- több sort egyszerre: ezt semelyik eszköz nem teszi meg.

## Amit egy ügynök nem tesz

- **Csak az Ön engedélyével töröl**: egy erre létrehozott tokennel, egyszerre egy sort.
- **Nem módosítja a struktúrát** — a megjelenését sem: javasolja. A javaslat az **Ügynökök
  javaslatai…** menüpontban (az adatbázis menüjében) vár, ahol egy, a struktúrát kezelő személy
  jóváhagyja vagy elutasítja; döntés hiányában 24 óra után lejár.
- **Soha nincs több jogosultsága**, mint annak a személynek, aki a tokenjét létrehozta: a token
  jogosultságai az övéivel metszetet képeznek, környezetenként.
- Nem látja az ügynökök számára láthatatlannak jelölt mezőket, sem az MCP elől elzárt
  adatbázisokat.

Minden hívás a paraméterei alakja szerint kerül naplózásra, soha nem az értékeik szerint.
