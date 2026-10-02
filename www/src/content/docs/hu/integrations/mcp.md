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
és az MCP-hez.

HTTP-t beszélő kliens esetén a cím `http://localhost:3000/mcp`, a következő fejléccel:
`Authorization: Bearer <jeton>`. Folyamatokat indító (stdio) kliens esetén a tároló egy
közvetítőt biztosít, amely a tokent egy környezeti változóból olvassa – soha nem a
konfigurációból:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## A tizennégy eszköz

| Eszköz | Szerep |
|---|---|
| `whoami` | ki az ügynök, és milyen jogosultságokkal |
| `list_bases`, `describe_base`, `describe_table` | a struktúra és a leírásainak felfedezése |
| `list_records`, `get_record`, `lookup_records` | olvasás, szűrés, egy megjelenítési érték feloldása |
| `create_record`, `update_record` | sorok írása |
| `delete_record`, `restore_record` | egy sor törlése — egy erre létrehozott tokennel — és visszahozása |
| `propose_create_table`, `propose_add_field`, `get_proposal` | struktúramódosítás javaslata |

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
- **Nem módosítja a struktúrát**: javasolja. A javaslat az **Ügynökök javaslatai…** menüpontban
  (az adatbázis menüjében) vár, ahol egy, a struktúrát kezelő személy jóváhagyja vagy elutasítja;
  döntés hiányában 24 óra után lejár.
- **Soha nincs több jogosultsága**, mint annak a személynek, aki a tokenjét létrehozta: a token
  jogosultságai az övéivel metszetet képeznek.
- Nem látja az ügynökök számára láthatatlannak jelölt mezőket, sem az MCP elől elzárt
  adatbázisokat.

Minden hívás a paraméterei alakja szerint kerül naplózásra, soha nem az értékeik szerint.
