---
title: Keresés
description: Egyetlen mező mindennek a megtalálásához — táblák, nézetek, irányítópultok, sorok, parancsok — és hogy kérdést tegyen fel a Copilotnak. Ctrl+K.
---

A **Táblák, sorok, parancsok keresése…** mező, a felső sáv közepén, megnyitja a keresést:
egyetlen mező mindenhez, amit a basedb-ben elérhet. A **Ctrl+K** (Macen **⌘K**) bármelyik
képernyőről megnyitja vagy bezárja – kivéve egy szövegszerkesztőben, ahol hivatkozást szúr be.

## Amit megtalál

| | |
|---|---|
| **Táblák és objektumok** | a projektek és az adatbázisok, amelyeket lát; a táblák, az SQL-nézetek és a mentett lekérdezések; a megnyitott adatbázis tábláinak nézetei, a személyeseket is beleértve; a projekt adatbázisainak kérdései, irányítópultjai és automatizálásai; a táblák oszlopai; a nyitott lapok |
| **Sorok** | maguk az adatok, a megnyitott adatbázis tábláiban: az oszlopok szövege, a listák választásai, egy pontos szám – legalább két karaktertől kezdve. Egy beillesztett sorazonosító megtalálja a sorát |
| **Parancsok** | amit az alkalmazás tud csinálni: ugrás a struktúrához, az előzményekhez, az adatbázis irányítópultjaihoz; tábla, kérdés, SQL-lekérdezés, adatbázis, projekt létrehozása, indulás egy sablonból; importálás egy táblába; az utolsó írás visszavonása vagy visszaállítása; egy lap bezárása vagy váltása; témaváltás; a Copilot megnyitása; **Az oldal hivatkozásának másolása**; egy beállítások- vagy adminisztrációs lap megnyitása; kijelentkezés |
| **Copilot** | egy természetes nyelvű kérdés, a Copilotnak átadva |

Az **Enter** megnyitja a kiválasztott találatot: egy sor a táblájában nyílik meg, a részletei
panelen. Nagy képernyőn egy jobb oldali panel mutatja az előnézetét – egy sor értékeit, egy tábla
oszlopait és leírását, egy irányítópult vagy egy automatizálás leírását. Illesszen be egy
basedb-címet: a **Hivatkozás megnyitása** oda viszi (lásd:
[hivatkozás minden képernyőhöz](/basedb/hu/fonctionnalites/collaboration/#hivatkozás-minden-képernyőhöz)).

Az üres mező felkínálja az Ön **legutóbbiait**, a nyitott lapokat, az adatbázis tábláit és
néhány javaslatot.

## Gépeljen úgy, ahogyan gondolkodik

- **Sem ékezetek, sem nagybetűk nem számítanak**: az `arbevetel` megtalálja az „Árbevétel” nevet.
- **Szótöredékek és kezdőbetűk**: a `kp` megtalálja a „Kovács Pékség” nevet, az `újtáb` az „Új
  tábla” parancsot.
- **Egy elgépelést megbocsát** – egy kihagyott, megkettőzött, felcserélt vagy megcserélt betűt,
  hét betűnél hosszabb szóban akár kettőt is –, de sosem az első betűn.
- **Minden begépelt szónak meg kell találnia a helyét**, a névben vagy abban, ami tartalmazza: az
  `értékesítés ügyfelek` megtalálja az „Értékesítés” adatbázis „Ügyfelek” tábláját. A típus is
  beírható: `nézet`, `automatizálás`, `irányítópult`.
- **Egy tábla, majd amit benne keres**: az `ügyfelek debrecen` a „debrecen” szót keresi az
  „Ügyfelek” tábla soraiban.

Elöl a **legjobb találat**; ami gyakran és nemrég megnyitott, feljebb kerül. Ez az emlékezet a
böngészőjében marad.

## A keresés szűkítése

A mező alatti gombok — **Mind**, **Táblák és objektumok**, **Sorok**, **Parancsok**, **Copilot**
— szűkítik, hogy mi legyen keresve. Egy első karakter ugyanezt teszi:

| Gépelje be először | Hogy mit keressen |
|---|---|
| `#` | csak táblákat és objektumokat |
| `/` | csak sorokat |
| `>` | csak parancsokat |
| `?` | egy kérdést a Copilotnak |

A **Tab**, egy táblán vagy adatbázison, **belül** keres: a neve megjelenik a mezőben, és a
keresés innentől csak a soraira, a nézeteire, az oszlopaira és a parancsaira vonatkozik. Az üres
mező ekkor a húsz legutóbb módosított sort mutatja. A **⌫**, üres mezőnél, kilép ebből; az
**Esc** egy szintet visszalép, majd bezár.

## A Copilot megkérdezése

Minden keresés végén ott a **Copilot megkérdezése: „…”**, amely az élre kerül, ha a szöveg
kérdésnek olvasható – „?”-lel végződik, „hány”, „melyik”, „mutasd”… szóval kezdődik, vagy öt
szónál is többől áll. A Copilot megnyílik az adatbázison, és megkapja a kérdést, mintha Ön
gépelte volna be. A struktúrát olvassa, nem a sorokat, hacsak be nem jelöli az **Adatok
olvasásának engedélyezése** lehetőséget, és javaslatot tesz: semmi nem változik, amíg alkalmazza.
Ehhez az MI-nek be kell lennie állítva a példányon – lásd:
[Mesterséges intelligencia](/basedb/hu/fonctionnalites/ia/).

## Jogosultságok és korlátok

A keresés ugyanazokon az útvonalakon halad át, mint a képernyő többi része, **az Ön
jogosultságaival**: egy tábla vagy oszlop, amely Ön elől el van zárva, nem jelenik meg, sem az
objektumok, sem a sorok között. Az automatizálásokat csak azoknak kínálja fel, akiknek
**Kezelés** szintje van az adatbázisukon.

- A sorokat a megnyitott adatbázisban keresi, vagy abban az adatbázisban vagy táblában, ahová a
  Tabbal belépett: legfeljebb három sor táblánként, legfeljebb huszonnégy táblán; húsz sor egy
  táblában.
- A kérdések, irányítópultok és automatizálások a megnyitott projekt sajátjai (legfeljebb nyolc
  adatbázis), legfeljebb kétpercenként újraolvasva.
- Minden csoport néhány találatot mutat, majd az **N további találat**-ot, amely teljes
  egészében megnyitja azt.

## Billentyűparancsok

A **Billentyűparancsok**, a keresés alján, vagy a **Billentyűparancsok** parancs, mindet
megmutatja. Macen a **Ctrl** helyett **⌘** szerepel.

| Billentyűk | Hatás |
|---|---|
| **Ctrl+K** | a keresés megnyitása vagy bezárása |
| **↑** **↓**, **Enter** | lépkedés a találatok között, a találat megnyitása |
| **Alt+W** | a lap bezárása |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | következő lap, előző lap |
| görgőkattintás | egy lap bezárása |
| **Ctrl+A**, **Ctrl+C** | a rácsban: teljes kijelölés, a kiválasztott cellák másolása |
| **Ctrl+kattintás** | egy kapcsolat követése |
| **Ctrl+Z**, **Ctrl+Y** | az utolsó írás visszavonása, annak visszaállítása |
| **Ctrl+Enter** | egy megjegyzés elküldése, egy leírás mentése |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | egy szövegben: félkövér, dőlt, hivatkozás |
