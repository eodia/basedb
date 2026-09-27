---
title: MCP-szerver
description: MI-ügynök csatlakoztatása a basedb-hez a Model Context Protocol segítségével.
---

A basedb egy **MCP-szervert** tesz elérhetővé (`POST /mcp`, ugyanazon a címen, mint a felület):
egy ügynök – Claude, egy kódasszisztens, az Ön saját ügynöke – itt fedezi fel az
adatbázisokat, olvas és ír sorokat, és **javasol** struktúramódosításokat.

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

## A tizenkét eszköz

| Eszköz | Szerep |
|---|---|
| `whoami` | ki az ügynök, és milyen jogosultságokkal |
| `list_bases`, `describe_base`, `describe_table` | a struktúra és a leírásainak felfedezése |
| `list_records`, `get_record`, `lookup_records` | olvasás, szűrés, egy megjelenítési érték feloldása |
| `create_record`, `update_record` | sorok írása |
| `propose_create_table`, `propose_add_field`, `get_proposal` | struktúramódosítás javaslata |

## Amit egy ügynök nem tesz

- **Semmit nem töröl.**
- **Nem módosítja a struktúrát**: javasolja. A javaslat az **Ügynökök javaslatai…** menüpontban
  (az adatbázis menüjében) vár, ahol egy, a struktúrát kezelő személy jóváhagyja vagy elutasítja;
  döntés hiányában 24 óra után lejár.
- **Soha nincs több jogosultsága**, mint annak a személynek, aki a tokenjét létrehozta: a token
  jogosultságai az övéivel metszetet képeznek.
- Nem látja az ügynökök számára láthatatlannak jelölt mezőket, sem az MCP elől elzárt
  adatbázisokat.

Minden hívás a paraméterei alakja szerint kerül naplózásra, soha nem az értékeik szerint.
