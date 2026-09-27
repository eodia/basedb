---
title: Jogosultságok és csoportok
description: Fiókok, csoportok, hozzáférési szintek projektenként, adatbázisonként és táblánként, mezőszintű korlátozások és az Ön beállításai.
---

A jogosultságokat **csoportok** kapják, soha nem egyenként a személyek. Egy projekthez,
adatbázishoz vagy táblához rendelt szint mindenre érvényes, ami alatta van, beleértve azt is,
ami később jön létre.

## A négy szint

| Szint | Mit enged |
|---|---|
| **Nincs hozzáférés** | semmit: az erőforrás láthatatlan |
| **Olvasás** | a sorok megtekintését és megjegyzésekkel való ellátását, személyes nézetek készítését, a struktúra és az irányítópultok megtekintését, saját kérdések feltevését, csak olvasási SQL írását és személyes lekérdezések mentését |
| **Szerkesztés** | ezenfelül sorok létrehozását, módosítását és törlését |
| **Kezelés** | ezenfelül a struktúra módosítását, megosztott nézetek, irányítópultok és mentett kérdések létrehozását, irányítópult megosztását hivatkozással, lekérdezések megosztását, SQL-nézetek, automatizálások, integrációk és tokenek létrehozását; az SQL-je a teljes adatbázishoz hozzáfér, az írást is beleértve |

A jogosultságok **összeadódnak**: egy személy azt a legmagasabb szintet kapja, amelyet
valamelyik csoportja ad neki. Ha egy tábla kevesebbet kap, mint az adatbázisa, akkor
„granulárissá” válik.

Két csoport mindig létezik: az **Adminisztrátorok**, akik mindent kezelnek, és a **Minden
felhasználó**, amelynek minden fiók tagja – amit ez a csoport megkap, azt mindenki megkapja.

## Egészen a mezőig

A szintek rácsa alatt a **Mezők** egy oszlopot elrejt egy csoport elől, vagy számára nem
módosíthatóvá tesz. A képernyő azt is megmutatja, hogy egy adott személy valójában mit lát, és
melyik csoportja révén.

Az elrejtett mező mindenhonnan hiányzik: a rácsból, a nézetekből, az API-ból, az MCP-ből, az
előzményekből, a felületen írt SQL-ből és az SQL-nézetekből. A rá vonatkozó szűrés vagy
rendezés úgy viselkedik, mintha a mező nem létezne.

## És az SQL?

A felületen az SQL ugyanazokat a jogosultságokat követi, amelyeket maga a PostgreSQL
érvényesít: Kezelés szint nélkül a lekérdezés csak olvasási módban fut, a személyhez tartozó
saját szerepkörrel, ahol egy hozzáférhetetlen tábla nem létezik, egy elrejtett mező pedig
elutasításra kerül. Egy [SQL-nézetet](/basedb/hu/fonctionnalites/requetes-et-vues-sql/)
mindenki a saját jogosultságaival olvas, és egy lekérdezés megosztása csak a szövegét osztja meg.

A **közvetlen `psql`-hozzáférést** az adatbázishoz viszont nem a basedb szabályozza: mindent
olvas, az elrejtett mezőket is. A korlátozások a termék felületeit védik – felület, API, MCP –,
soha nem azzal szemben, akinek SQL-hozzáférése van az adatbázishoz; ezeket a hozzáféréseket az
üzemeltető által beállított PostgreSQL-`GRANT`-ok szabályozzák.

## Fiókok és bejelentkezés

- A fiók egy **ideiglenes jelszóval** jön létre, amely egyszer jelenik meg, és az első
  bejelentkezéskor meg kell változtatni.
- A bejelentkezés jelszóval vagy az üzemeltető által megadott **OpenID Connect**-szolgáltatóval
  történik.
- Az adminisztrációs műveletekhez **emelt szintű munkamenet** szükséges: az utolsó öt percben
  újra begépelt jelszó.
- A munkamenetek visszavonhatók; egy munkamenet visszavonása azonnal érvényteleníti a
  hozzáférési tokenjeit.

## Az Ön beállításai

A **Beállítások** a bal alsó sarokban lévő profilmenüben csak Önre vonatkozik:

| Lap | Mit tehet itt |
|---|---|
| **Profil** | a megjelenített név; a bejelentkezési cím; a fiókhoz kapcsolt identitásszolgáltatók, amelyeket összekapcsolhat vagy leválaszthat |
| **Biztonság** | a jelszó megváltoztatása; a nyitott munkamenetek, amelyeket egyenként vagy mindet egyszerre bezárhat |
| **Megjelenés** | a felület nyelve; a téma; a dátumok sorrendje – `25/09/2026` vagy `2026-09-25` – és a naptárakban a hét első napja |
| **Értesítések** | azok az értesítéstípusok, amelyeket már nem szeretne kapni |
| **Tokenek** | az Ön által létrehozott integrációs tokenek az összes adatbázisán, az utolsó használatuk és a visszavonásuk |

A basedb **húsz nyelven** beszél: francia, angol, német, spanyol, olasz, portugál (Brazília),
holland, lengyel, cseh, svéd, dán, norvég, finn, román, magyar, török, ukrán, japán,
egyszerűsített kínai és koreai. Alapértelmezés szerint a felület a böngészője nyelvét
használja; a **Megjelenés** lapon a **Nyelv** beállítással másikat választhat. A számok és a
dátumok a választott nyelvet követik.

A téma böngészőnként külön marad; a nyelv, a dátumok sorrendje és a hét első napja gépről gépre
követi Önt. Az e-mail-cím megváltoztatásához vagy egy szolgáltató összekapcsolásához emelt
szintű munkamenet szükséges; a jelszó nélküli fiók, amely egy szolgáltatón keresztül jelentkezik
be, megtartja az adott szolgáltatótól kapott címet.

## Az egyetlen érvényesítési pont

Minden felület – a kezelőfelület, az API, az MCP, a megosztott űrlapok és nézetek, az
automatizálások – a jogosultságokról döntő ugyanazon a ponton halad át, a magban. A
kezelőfelületnek nincs saját, privát útvonala: amit a képernyő nem mutat, azt az API nem adta
vissza.

Fordítva is igaz: a képernyő **nem kínálja fel azt, ami elutasításra kerülne**. Kezelés szint
nélkül a Struktúra képernyő gomb és ceruza nélkül tekinthető meg, és az importálás nem kínálja
fel tábla létrehozását; sorok létrehozására vagy törlésére vonatkozó jogosultság nélkül a rács
nem kínál sem hozzáadási sort, sem „Törlés” lehetőséget.
