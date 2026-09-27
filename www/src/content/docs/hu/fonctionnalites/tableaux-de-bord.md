---
title: Irányítópultok
description: Egérrel vagy SQL-ben feltett kérdések, tizenötféle megjelenítés és beállítás, rácsba és lapokba rendezett irányítópultok közös szűrőkkel – mindenki a saját jogosultságaival olvassa, és hivatkozással megosztható.
---

Az **irányítópult** egy oldalon gyűjti össze azt, amit egy csapat nap mint nap figyel: a fontos
számokat, azok hónapról hónapra való alakulását, egy állapot megoszlását, a közelgő
határidőket. Minden kártyája egy **kérdést** mutat – az adatbázis egy egérrel összeállított vagy
SQL-ben megírt olvasását –, az oldal tetején lévő **szűrők** pedig a hozzájuk kapcsolt kártyákat
vezérlik.

![A „Pilotage de l’agence” irányítópult: a hónap trendje, célkitűzés, halmozott árbevétel, az értékelések hangulata](../../../../assets/screens/tableaux-de-bord.png)

Minden az **Irányítópultok** menüpontból nyílik, az oldalsáv alján, a megnyitott adatbázis
blokkjában. Bal oldalt az adatbázis irányítópultjai és mentett kérdései láthatók, valamint az
**Adatok felfedezése**, amellyel úgy tehet fel kérdést, hogy semmit nem ment. Az adatbázis
minden olvasója megtekintheti, felfedezheti őket és elmentheti a saját kérdéseit; egy
irányítópult felépítéséhez és egy kérdés megosztásához **Kezelés** szint szükséges.

Egy mentett kérdés **személyes** – csak Ön látja –, a **teljes adatbázisnak** vagy
**csoportoknak** szól. A menüje, jobb kattintással vagy a **⋯**-vel, egy lapon nyitja meg a
táblák mellett, megváltoztatja a nevét és a megosztását, vagy törli. A lapsáv **+** gombja
emellett az **Új kérdés** és az **Új SQL-kérdés** lehetőségeket is felkínálja.

A **Mentés**, egy kérdés fejlécében, megőrzi azt; egy olyan kérdés, amelyet nem módosíthat,
helyette a **Másolat mentése** lehetőséget kínálja, amely az Öné lesz. A **⋯** (**További
műveletek**) emellett a **Név és megosztás…**, a **Másolat mentése…** és a **Kérdés törlése**
lehetőségeket is kínálja; az őt megjelenítő lap megtartja a tartalmát, ismét nem mentett
állapotban.

## Kérdés feltevése egérrel

A kérdés lépésenként, egymás alatt épül fel:

![Egy kérdés szerkesztője: az adatok, a szűrők, a havi összesítés](../../../../assets/screens/question-editeur.png)

| Lépés | Mit választ itt |
|---|---|
| **Adatok** | a kiinduló táblát, és a megjelenített oszlopokat, ha semmi nincs összesítve |
| **Adatok összekapcsolása** | az adatbázis egy másik tábláját, egy kapcsolaton keresztül – ezt magától felkínálja – vagy két azonos jellegű oszloppal; bal oldali, belső, jobb oldali vagy teljes illesztés |
| **Szűrő** | oszloponként, azzal, amit a típusa kínál: egyenlő / nem egyenlő, tartalmazza, között, üres…; dátumnál egy **időszak**: ma, az elmúlt 30 nap, ez a hónap, az előző negyedév, …-tól …-ig; vagy egy kifejezés, ugyanúgy írva, mint a nézetek sávjában |
| **Összesítés** | mértékek – sorok száma, összeg, átlag, medián, minimum, maximum, egyedi értékek, szórás, halmozott értékek – egy–három oszlop **szerint** |
| **Rendezés**, **Korlátozás** | a sorok sorrendje, és hogy legfeljebb hány |

A dátum csoportosítható **nap, hét, hónap, negyedév vagy év szerint**, vagy sorszám szerint – a
hét napja, az év hónapja, a nap órája; a szám pedig sávokra bontható. A többszörös választás
minden sort mindegyik választott lehetőségénél számol. Az időszakok az Ön időzónájában
értendők, és a hét azon a napon kezdődik, amelyet a beállításaiban megadott.

A **Vizualizálás** lefuttatja a kérdést. Az eredmény a neki megfelelő módon jelenik meg – szám,
vonal, oszlopok, táblázat –, és a képernyő alján módosítható:

| Vizualizáció | Mire való |
|---|---|
| **Szám**, **Trend**, **Előrehaladás**, **Mérő** | egyetlen érték; az utolsó időszak az előzővel és a tavalyi azonos időszakkal szemben; az előrehaladás egy cél felé |
| **Oszlopdiagram**, **Sávdiagram**, **Vonaldiagram**, **Területdiagram**, **Kombinált** | mértékek egy dimenzió mentén, egymás melletti, halmozott vagy 100%-os adatsorokban |
| **Kördiagram**, **Tölcsér** | részarányok, szakaszok |
| **Pontdiagram** | két mérték egymással szemben, egy harmadik a pontok méretében |
| **Táblázat**, **Kereszttábla** | a sorok, rendezhetően; sorok az egyik dimenzió, oszlopok egy másik szerint, összesítésekkel |
| **Térkép** | Franciaország régiói vagy megyéi, illetve az országok, egy érték szerint színezve; vagy pontok szélesség és hosszúság szerint |

A **Beállítások** szabályozza, mi jelenjen meg, az eredmény pedig **CSV** formátumban
letölthető.

### Diagram testreszabása

| Vizualizáció | Mit kínál a **Beállítások** |
|---|---|
| **Sáv-, vonal-, terület-, kombinált diagram** | az egyes adatsorok színe és neve; a halmozás, a halmok fölött az összeggel; az oszlopok szélessége; simított vagy lépcsőzetes vonalak, pontokkal vagy anélkül; a kategóriák sorrendje; a tengelyek címe, a beosztások, a címkék dőlésszöge, a határértékek, logaritmikus skála; az értékek a diagramon; egy cél |
| **Kördiagram** | gyűrű és annak vastagsága, félkör, rózsadiagram; az összeg középen; a szeletek száma az „Egyéb” előtt; az egyes szeletek színe és neve; a címkék a szeleteken vagy mellettük; a jelmagyarázat helye |
| **Tölcsér** | az egyes szakaszok színe és neve, a sorrendjük |
| **Szám, trend, előrehaladás, mérő** | a szín, érték szerinti színek, felirat a szám alatt, az összehasonlítás – és hogy a csökkenés jó hír-e |
| **Táblázat, kereszttábla** | oszlopok átnevezése és átrendezése, sávok a cellákban, érték szerinti színek – cellánként vagy soronként –, a sűrűség, a sorok oldalanként, a sorszámok, az összesítések |
| **Térkép** | az árnyalat, a régiók nevei |

Mindegyiknél a számformátum: tizedesjegyek, előtag és utótag, rövidítés `1,2 k` alakban.

## Felfedezés egy kattintással

Egy oszlopra, pontra vagy szeletre kattintva megnyílik az, amit ábrázol:

- **Sorok megtekintése**: a pont mögötti sorok, az általa ábrázolt érték szerint szűrve;
- **Részletezés hetenként**: egy időszak finomabb bontásban – egy év a negyedéveire, egy hónap a
  heteire bontva;
- **Bontás… szerint**: ugyanaz a mérték ennél a pontnál, egy másik oszlop szerint;
- **Csak ez az érték**, **Érték kizárása**.

Minden lépés külön kérdés, amely igény szerint menthető; a vissza nyíl az előző lépésre visz.
Egy táblázat sora a sor részletei panelt nyitja meg.

Irányítópulton ugyanez a kattintás az **Irányítópult szűrése: „Lyon”** lehetőséget is felkínálja,
az érintett kártyák számával: egy **ideiglenes** szűrő, amelyet a rendszer soha nem ment,
szaggatott vonallal jelenik meg a szűrősávban, egy kattintással eltávolítható, és minden olyan
kártyára érvényes, amelynek kérdése ugyanazt az oszlopot olvassa – a táblája vagy egy illesztés
révén. Csak akkor kínálja fel, ha az irányítópult egyetlen szűrője sincs még ehhez az oszlophoz
kapcsolva a kártyán, és szürkén marad („egyetlen kártya”), ha egyetlen másik kártya sem olvassa.
Az SQL-kérdések nem veszik figyelembe.

## Kérdés írása SQL-ben

Az **SQL-kérdés** egy `SELECT` az adatbázis tábláin, a valódi nevükön. **Csak olvasási módban,
az Ön saját jogosultságaival** fut – mindenkinél, a kezelőket is beleértve: az Ön számára
hozzáférhetetlen tábla nem létezik, az elrejtett mező elutasításra kerül, és írni nem lehet. Ha
egyszerűen el szeretne helyezni egy lekérdezést a táblák alatt, diagram nélkül, vagy valódi
PostgreSQL-nézetet szeretne készíteni belőle, lásd: [Lekérdezések és SQL-nézetek](/basedb/hu/fonctionnalites/requetes-et-vues-sql/).

A **változót** `{{nom}}` alakban kell írni; azt a részt pedig, amelyet el kell hagyni, ha nincs
értéke, `[[` és `]]` közé kell tenni:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

A változó lehet szöveg, szám, dátum – vagy **oszlopszűrő**: ekkor a `{{periode}}` egy teljes
feltétellé válik a kiválasztott oszlopon, itt az `echeance` oszlopon, vagy `TRUE` lesz, ha semmi
nincs kiválasztva. Ez teszi lehetővé, hogy az irányítópult egy szűrője ugyanúgy vezéreljen egy
SQL-kérdést, mint a többit.

## Irányítópult elrendezése

A **Szerkesztés** szerkesztési módba kapcsolja az irányítópultot:

- a **Kérdés** elhelyez egy mentett kérdést – egy személyes kérdés ide másolódik –, vagy létrehoz
  egyet, amely csak a kártyához tartozik;
- a **Cím** szakaszcímet ad hozzá, a **Szöveg** pedig formázott szöveget – címeket, listákat,
  hivatkozásokat –, amely számokra is hivatkozhat (lásd lentebb);
- a **Beágyazott oldal** egy `https://` címet jelenít meg egy elszigetelt keretben, amely sem
  munkamenetet, sem adatot nem kap;
- a **Lap** több oldalra osztja el a kártyákat; dupla kattintással átnevezhető egy lap.

A kártyák a fogantyújuknál fogva mozgathatók, és a sarkuknál átméretezhetők, egy 24 oszlopos
rácson. A **Mentés** mindent megőriz; a **Mégse** visszaáll az előző változatra. Olvasási
módban a kártya címe megnyitja a kérdését felfedezésre, az irányítópult szűrőivel együtt.

### Számok a szövegben

Egy szöveg egy értéket egy dupla kapcsos zárójelbe tett névvel hivatkozik meg: „Ebben a hónapban
`{{chiffre_affaires}}` árbevétel `{{commandes}}` rendelésből.” Minden név egy jelvénnyé válik,
amely egy kattintással – vagy a szerkesztő sávjában lévő **Változó** paranccsal – köthető össze
a következőkkel:

| Forrás | Mit mutat a szöveg |
|---|---|
| **egy kártya** az irányítópultból | amit mutat, a saját szűrői szerint |
| **egy mentett kérdés** a teljes adatbázisból | az értékét, és az irányítópult szűrői ugyanúgy kapcsolódnak hozzá, mint egy kártyához |
| **egy a szövegben megőrzött kérdés** | az értékét; így lehet egy személyes kérdésre hivatkozni |
| **egy szűrő** az irányítópultból | a kiválasztott értéket, ahogy a parancsa mondja |

Egy kérdés értéke az, amelyet a **Szám** vizualizációja mutatna: az első mértéke, az utolsó
soron. A néző jogosultságaival számolódik ki, és mindig szövegként jelenik meg. Egy szöveg
legfeljebb 20 értéket hivatkozhat meg; egy név kisbetűkből, számokból és `_` jelből áll. A
szerkesztő előtt Markdownban írt szövegek úgy olvashatók, mint korábban, és gazdaggá válnak,
amint valaki újraírja őket. A Copilot viszont Markdownban írja a szövegeit.

## A szűrők

A **Szűrő** egy vezérlőt ad az irányítópult tetejére: **dátumot** (egy időszakot),
**kategóriát** (bejelölendő értékeket), **szöveget**, **számot** vagy **dátumcsoportosítást**,
amely a vonaldiagramokat havi nézetről heti vagy éves nézetre váltja.

A szűrő a hozzá kapcsolt kártyákat vezérli – egyet, többet vagy mindet. Létrehozásakor magától
kapcsolódik a neki megfelelő oszlopokhoz; kijelölve minden kártyán megmutatja az általa szűrt
oszlopot, amelyet módosíthat vagy eltávolíthat, az **Összekapcsolás minden kompatibilis
kártyával** pedig kiegészíti a többit. Lehet **alapértelmezett értéke** is – például „Ez az év”.

Olvasási módban egy pontra kattintva egy szűrő is beállítható: **Szűrés: „Lyon”** egy olyan
kártyán, amelynek várososzlopa a „Ville” szűrőhöz van kapcsolva.

![Az „Activité” lap: feladatok határidő szerint, állapot szerint halmozva, a projektek tölcsére, becsült órák kereszttáblában](../../../../assets/screens/tableaux-de-bord-activite.png)

## A Copilot

Az Irányítópultok rész fejlécében lévő **Copilot** jobb oldalt természetes nyelvű beszélgetést
nyit az adatbázisról: „havi árbevétel”, „adj hozzá ügyfél szerinti szűrőt”, „miért esik vissza
augusztus?”. Minden javaslat kártyaként érkezik, amely egy kattintással alkalmazható:

| Javaslat | Mit csinál |
|---|---|
| **Egy kérdés** | lefut és kirajzolódik a beszélgetésben; megnyitható a szerkesztőben, vagy hozzáadható az irányítópulthoz |
| **Az irányítópult módosításai**, vagy egy új irányítópult | hozzáadott, módosított vagy eltávolított kártyák, szövegek, az oszlopot tartalmazó kártyákhoz magától kapcsolódó szűrők, lapok, név – egyetlen mentés, amely a kártyáról **visszavonható** |
| **Értékek a megjelenített szűrőkhöz** | „mutasd az előző hónapot”: a szűrők beállnak, semmi nem kerül mentésre |

Kérdést feltenni vagy a szűrőket beállítani az adatbázis minden olvasója tud; egy irányítópult
módosításához vagy létrehozásához **Kezelés** szint szükséges.

Alapértelmezés szerint **csak a struktúra** kerül az MI-szolgáltatóhoz a beszélgetéssel együtt:
a táblák és a mezőik, az adatbázis irányítópultjai és mentett kérdései, valamint a megjelenített
irányítópult – a lapjai, a szűrői, a kártyái definíciója (a kérdéseik, a szövegeik). Sem a
sorok, sem a kártyák eredményei, sem a **szűrőkben kiválasztott értékek**, amelyek adatok
lehetnek: egy szűrőből csak az kerül elküldésre, hogy van-e értéke. Az ügynökök számára
láthatatlannak jelölt mező nem kerül elküldésre, és az azt hivatkozó kártya kérdése sem.

Az **Adatok olvasásának engedélyezése** jelölőnégyzet a beszélgetés idejére hozzáadja a
megjelenített szűrők értékeit és a kártyák ezek szerint szűrt eredményeit (olvasásonként
legfeljebb 50 sor, a válasz alatt felsorolva), hogy a Copilot a számokra támaszkodva fűzhessen
hozzájuk megjegyzést. Lásd: [Mesterséges intelligencia](/basedb/hu/fonctionnalites/ia/).

## Irányítópult megosztása

Az irányítópult fejlécében lévő **Megosztás** annak érhető el, akinek **Kezelés** szintje van
az adatbázison. Két lehetőség van:

- az **Adatbázis megosztása…** személyeket hív meg az adatbázisba: ők a basedb-ben nyitják meg
  az irányítópultot, és minden kártya az ő saját jogosultságaikkal olvas;
- a **Hivatkozás létrehozása** egy hivatkozást ad **kizárólag** erre az irányítópultra, amely
  semmilyen jogosultságot nem igényel az adatbázison.

| A hivatkozás hozzáférése | Ki olvashatja |
|---|---|
| **Nyilvános** | bárki, akinek megvan a hivatkozás, fiók nélkül |
| **Bejelentkezett tagok** | a munkaterület egy tagja, bejelentkezés után – szükség esetén csak bizonyos csoportokból |

A hivatkozás oldala az irányítópult lapjait, szűrőit és kártyáit mutatja, **csak olvasható
módon**: se felfedezés, se hozzáférés a sorokhoz, se saját kérdés. A kártyái **annak a
személynek a jogosultságaival** olvasnak, **aki a hivatkozást közzétette**, és ezeket a
rendszer minden olvasáskor újra ellenőrzi: ha ez a személy elveszíti a hozzáférését az
adatbázishoz, a hivatkozás **felfüggesztődik**. Az **Aktív hivatkozás** kapcsoló kikapcsolja
anélkül, hogy elveszne, az **Újragenerálás** pedig érvényteleníti a régit.

Jelölje be a **Beágyazás engedélyezése más webhelyen** lehetőséget: a párbeszédablak egy
`<iframe>` **beágyazási kódot** ad, amellyel az irányítópult egy intraneten vagy wikiben
jeleníthető meg. Ez ugyanaz a mechanizmus, mint a
[megosztott nézeteké](/basedb/hu/fonctionnalites/vues-partagees/).

## Mindenki a saját jogosultságaival

Minden kártya **a néző jogosultságaival** olvas: ugyanaz az irányítópult mindenkinek azt
mutatja, amit látni jogosult – kivéve a megosztási hivatkozáson keresztül, amely annak a
személynek a jogosultságaival olvas, aki közzétette. Az a kártya, amely egy Ön számára
hozzáférhetetlen táblára vagy mezőre vonatkozik, a „Nem elérhető adat” feliratot mutatja,
ahelyett hogy egy olyan számot mutatna, amely a hiányzó adatok miatt félrevezető lenne. Egy
kérdés mentése csak a kérdést osztja meg, soha nem azt, amit a szerzője olvashat.

## Korlátok

- Egy kérdés legfeljebb 2000 sort ad vissza; egy összesítésnek ez szinte mindig elég.
- Minden kártya megnyitáskor és minden szűrésnél lefuttatja a lekérdezését, gyorsítótár nélkül.
- A térképalapok Franciaország európai területét (régiók, megyék) és a világ országait fedik le.
  Forrás: IGN, Admin Express (Licence ouverte); Natural Earth.
