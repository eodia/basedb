---
title: n8n
description: A basedb sorainak olvasása és írása egy n8n-workflowból, és egy workflow indítása minden létrehozott, módosított vagy törölt sornál.
---

A **n8n-nodes-basedb** csomag három csomópontot ad az n8n-hez:

| Csomópont | Szerep |
|---|---|
| **basedb** | egy tábla sorainak olvasása és írása, egy sor megjegyzése; az n8n egy MI-ügynöke eszközként is használhatja |
| **basedb Trigger** | workflow indítása minden létrehozott – vagy létrehozott vagy módosított – sorra, az utolsó lekérdezés óta |
| **basedb Webhook Trigger** | workflow indítása abban a pillanatban, amikor egy sor létrehozásra, módosításra vagy törlésre kerül |

## Telepítés

Az n8n-ben: **Settings › Community Nodes › Install**, majd `n8n-nodes-basedb`.

Felület nélkül – várakozási sor mód, előre összeállított Docker-lemezkép – : `npm install
n8n-nodes-basedb` a `~/.n8n/nodes` mappában, majd indítsa újra az n8n-t.

## A hitelesítő adatok

Hozzon létre az n8n-ben egy **basedb API** hitelesítő adatot:

| Mező | Érték |
|---|---|
| **Instance URL** | a cím, ahol a basedb-t megnyitja: `https://basedb.exemple.fr` |
| **Workspace** | a munkaterület azonosítója, ugyanaz, mint az API címeiben (`/api/v1/<munkaterület>/…`): `t4z56fq`, kivéve ha a példány `BASEDB_TENANT`-ot rögzít |
| **Token** | egy **integrációs token**: az adatbázis **⋯** menüje → **API és ügynökök** → **API- és MCP-tokenek…** |
| **Environment** | nem kötelező: az adatbázis környezete, amelyben dolgozni kell — `recette`, `production`… Üresen: az éles |

Egy token **egy** adatbázist nyit meg — az összes környezetével, vagy csak egyet, ha a
létrehozásakor korlátozták. Olvassa a sorait, írja is, ha íráshoz jött létre, és sosincs több
joga, mint annak a személynek, aki létrehozta. Mentéskor az n8n kipróbálja a kapcsolatot, és
jelzi, ha a tokent elutasítja.

Az éles és a teszt környezetben való munkához hozzon létre két hitelesítő adatot ugyanazzal a
tokennel: az egyikben az **Environment** üres, a másikban `recette`. Ha nincs környezet
kiválasztva, a csomópont adatbázislistája minden környezetet megmutat, a nevével zárójelben.

## Olvasás és írás: a basedb csomópont

| Művelet | Mit csinál |
|---|---|
| **Row › Create** | hozzáad egy sort |
| **Row › Create or Update** | módosítja azt a sort, amelynek kiválasztott mezői ezeket az értékeket hordozzák, vagy hozzáadja, ha semelyik sem hordozza |
| **Row › Get** | egy sort olvas be a `_id` alapján |
| **Row › Get Many** | egy szűrő sorait olvassa be, a kért sorrendben, egy határig vagy az összeset, oldalanként |
| **Row › Update** | módosít egy sort, amelyet a `_id` vagy más mezők alapján talál meg |
| **Comment › Create** | megjegyzést fűz egy sorhoz; egy @mention értesíti a személyt |

Az **adatbázis** és a **tábla** listákból választható ki, azokból, amelyeket a token megnyit.
Az írandó mezők a basedb-ben viselt nevükkel jelennek meg, egy egyszeres választás mező a
lehetőségeivel, egy Személy mező a munkaterület tagjaival; egy számított mező – képlet,
kikeresés, aggregálás, automatikus szám – nem szerepel köztük, mivel azt a basedb maga írja.
Egy olyan érték, amelyet a mező elutasít, a basedb kódjával és annak jelentésével állítja meg
a csomópontot.

- A **szűrő** és a **rendezés** a mezők technikai nevét használja, ugyanazt, mint az SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. A nyelvtana az
  [API RESTé](/basedb/hu/integrations/api-rest/#olvasás).
- A **számok** tizedes szövegként érkeznek (`"1250.50"`), hogy semelyik számjegy se vesszen
  el; a **Numbers as Numbers** beállítás számokká alakítja őket.
- Egy **kapcsolat** `{ "id": …, "display": … }` alakban olvasható, és a kapcsolt sor `_id`-jével
  írható.
- A **Create or Update** soha nem módosít egyszerre több sort: ha több sor is hordozza az
  értékeket, a csomópont megáll, helyette hogy találgatna.
- Nincs **Delete** művelet: sorok eltávolításához jelölje meg őket (egy „Archivált”
  státusszal), bízza a törlést egy
  [automatizálásra](/basedb/hu/fonctionnalites/automatisations/), vagy hívja a
  [REST API-t](/basedb/hu/integrations/api-rest/) egy törlésre létrehozott tokennel.

## Egy workflow indítása

### Minden lekérdezésnél: basedb Trigger

A csomópont a választott ütemben (percenként, óránként…) lekérdezi a basedb-től a legutóbbi
óta **létrehozott** – vagy **létrehozott vagy módosított** – sorokat, ha szükséges egy
szűrővel kiegészítve. Mindenhol működik, még akkor is, ha a basedb nem éri el az n8n-t. Az
első lekérdezésekor feljegyzi, hol áll a tábla, és nem ad ki semmit; a szerkesztőből indított
próba az utolsó sort adja vissza, hogy legyen mihez kapcsolni a következő csomópontokat.

### Azonnal: basedb Webhook Trigger

Minden létrehozott, módosított vagy törölt sor – akár a PostgreSQL-be közvetlenül írt SQL
által is – azonnal elindítja a workflow-t:

1. Adja hozzá a csomópontot, és másolja ki a **Production URL**-jét.
2. A basedb-ben az adatbázis **⋯** menüje → **API és ügynökök** → **Webhookok…**: hozzon létre
   egy webhookot erre a címre, válassza ki a tábláit és az eseményeit.
3. A basedb egyszer megjeleníti az **aláírási titkot**: helyezze el az n8n egy **basedb
   Webhook** hitelesítő adatában.
4. Aktiválja a workflow-t.

Minden esemény egy elemmé válik: a `type`-ja (`record.created`, `record.updated`,
`record.deleted`), a tábla, a sor **előtte** és **utána** állapota, és a megváltozott mezők
(`changed`). A csomópont ellenőrzi minden kézbesítés **aláírását**, és `401`-gyel válaszol
annak, amelyiknek nincs aláírása, hamis az aláírása, vagy öt percnél régebbi. A basedb
**legalább egyszer** kézbesít: az esemény `id`-ja alapján szűrje ki az ismétlődéseket, ha a
workflow-nak nem szabad kétszer feldolgoznia.

:::note
A basedb csak **nyilvános HTTPS**-címre küld webhookot: egy privát hálózaton futó n8n inkább
a **basedb Trigger**-t használja. Lásd: [Webhookok](/basedb/hu/integrations/webhooks/).
:::

## Csomópont nélkül

Az n8n **HTTP Request** csomópontja is beszél a basedb-vel: `Authorization: Bearer <jeton>`
fejléc, JSON oda-vissza, lapozás a `meta.next_cursor` `after`-ként átadott értékével
(`{{ $response.body.meta.next_cursor }}`), és egy leállás utáni folytatás a `_updated_at`
mezőre szűrve és a `…/<table>/deleted?since=` segítségével.
