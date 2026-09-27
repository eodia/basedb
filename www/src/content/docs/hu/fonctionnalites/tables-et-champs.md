---
title: Táblák és mezők
description: A basedb mezőtípusai, leképezésük a PostgreSQL-ben, a képletek és a számított mezők.
---

A basedb minden táblája egy PostgreSQL-tábla, minden mezője egy típusos oszlop. A megadott
címkéből („Échéance”) egy stabil **slugosítás** olvasható fizikai nevet (`echeance`) képez:
ékezetek nélkül, kisbetűvel, foglalt szavak nélkül.

## A típusok

| Típus | PostgreSQL-oszlop | Megjegyzések |
|---|---|---|
| Rövid szöveg | `text` | egy sor |
| Hosszú szöveg | `text` | Markdown: kivonat a rácsban, formázott megjelenítés rámutatáskor, külön szerkesztő; [hivatkozhat egy oszlopra](#formázott-szöveg-és-változók) |
| Formázott szöveg | `text` + `CHECK` | íráskor megtisztított HTML, vizuális szerkesztőben írva – [lásd lejjebb](#formázott-szöveg-és-változók) |
| Szám | `numeric` | soha nem lebegőpontos: egy összeg nem csúszik el |
| Pénznem, Százalék, Időtartam, Értékelés | `numeric` | egy szám és a [megjelenítési formátuma](#megjelenítési-formátumok): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Jelölőnégyzet | `boolean` | |
| Dátum | `date` | |
| Dátum és idő | `timestamptz` | abszolút időpont, az olvasó időzónájában megjelenítve |
| Egyszeres választás | `text` + `CHECK` | lehetőségenként szín, ikon vagy kép |
| Többszörös választás | `text[]` + `CHECK` | a tömboperátorokkal szűrhető |
| E-mail | `text` + `CHECK` | az adatbázis által ellenőrzött cím, egy kattintással megnyitható |
| Telefon, Vonalkód | `text` | egy rövid szöveg és a formátuma: hívási hivatkozás, fix szélességű betű |
| URL | `text` + `CHECK` | bevitelkor kiegészül (`exemple.fr` → `https://exemple.fr`) |
| Személy | `uuid` | a munkaterület egy tagja; ha kijelöli, [értesítést kap](/basedb/hu/fonctionnalites/collaboration/) |
| Automatikus szám | `bigint` identity | a már meglévő sorokat is megszámozza; senki nem adja meg kézzel |
| Kapcsolat | `uuid` + `FOREIGN KEY` | valódi idegen kulcs a céltáblára |
| Többszörös kapcsolat | `uuid[]` | több kapcsolt sor, integritásukat eseményindító (trigger) biztosítja |
| Képlet | `STORED` generált oszlop | a PostgreSQL számítja – vagy olvasáskor, lásd: [Képletek](#képletek) |
| Kikeresés, Aggregálás, Darabszám | nincs | olvasáskor számítva, egy kapcsolaton keresztül |
| Gomb | nincs | megnyit egy címet, vagy elindít egy [automatizálást](/basedb/hu/fonctionnalites/automatisations/) |
| Fájl, Kép | `jsonb` (metaadatok) | a bájtok a [fájltárolóba](/basedb/hu/fonctionnalites/fichiers/) kerülnek |

Minden táblának vannak **rendszeroszlopai** is: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` – ezeket egy trigger tartja karban, az API-n
keresztül soha nem írhatók. A rács ezeket a **Rendszerinformációk** csoportba sorolja az
oszlopok menüjében: minden táblán megvannak, de kevésnél hasznosak.

![Egy tábla rácsa számított időtartammal, kikereséssel és darabszámmal](../../../../assets/screens/grille.png)

## Az adatbázis által érvényesített megszorítások

Amit a felület ígér, azt a PostgreSQL garantálja. Az egyszeres választás egy `CHECK`
megszorítás; a kapcsolat egy `FOREIGN KEY`; az URL vagy az e-mail-cím egy reguláris kifejezés.
A közvetlen SQL-írást, amely ezeket megsérti, az adatbázis elutasítja, ugyanúgy, mint a
felületen:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Megjelenítési formátumok

A Pénznem, a Százalék, az Időtartam, az Értékelés, a Telefon és a Vonalkód típusként
választható ki, de valójában **formátumok**: az oszlop szám vagy szöveg marad, csak a
megjelenítés változik.

| Formátum | Mire | Így olvasható és adható meg |
|---|---|---|
| Pénznem | egy számra | `12 500,00 €` – euró, dollár, font, svájci frank, kanadai dollár, jen |
| Százalék | egy számra | `15 %` |
| Időtartam | másodpercek számára | `1:30`, és megadható így is: `1h30`, `90 min` |
| Értékelés | egy számra | 1–10 csillag, egy kattintással beállítva |
| Telefon | egy rövid szövegre | hívási hivatkozás |
| Vonalkód | egy rövid szövegre | fix szélességű betűvel |

A formátum utólag is módosítható (**Megjelenítés**, a mező szerkesztésében) a tárolt értékek
érintése nélkül. Nem korlátozza az értéket: egy 5-ös skálán megadott 7-es értékelés 7 marad.

## Képletek

A képlet franciául íródik, a mezők szögletes zárójelben, az argumentumokat `;` választja el:

```text
ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)
SI([Payée]; FAUX; JOURS(AUJOURDHUI(); [Échéance]) > 0)
JOURS([Fin]; [Début])
```

A szerkesztő felkínálja a beszúrható mezőket és egy függvénypanelt; hiba esetén megnevezi a
hibás mezőt vagy karaktert.

| Család | Függvények |
|---|---|
| Logikai | `SI`, `SIVIDE`, `ESTVIDE`, `ET`, `OU`, `NON`, `VRAI`, `FAUX` |
| Számok | `ARRONDI`, `ABS`, `PLAFOND`, `PLANCHER`, `MIN`, `MAX` |
| Szöveg | `MAJUSCULE`, `MINUSCULE`, `SANSESPACES`, `GAUCHE`, `DROITE`, `LONGUEUR`, `TEXTE`, `NOMBRE` |
| Dátumok | `ANNEE`, `MOIS`, `JOUR`, `JOURSEMAINE`, `JOURS`, `AJOUTER_JOURS`, `DATE`, `AUJOURDHUI`, `MAINTENANT` |
| Operátorok | `+ - * /`, `&` szövegek összefűzéséhez, `= <> < <= > >=` |

A képletből a PostgreSQL **generált oszlopa** lesz: a `psql` és az Ön eszközei ugyanúgy
olvassák, mint a többit. Az a képlet, amely a mai naptól függ (`AUJOURDHUI()`, `MAINTENANT()`),
vagy amely kikeresésre, illetve aggregálásra hivatkozik, **olvasáskor számítódik**: a
basedb-ben szűrhető és rendezhető, de közvetlen SQL-ben nem létezik.

A képlet nem hivatkozhat sem másik képletre, sem közvetlenül kapcsolatra – ezt a kikeresés
teszi meg. Egy szöveg részének kinyerése vagy cseréje később érkezik.

## Kikeresések, aggregálások és darabszámok

Három mező olvas **egy kapcsolaton keresztül**, egyik vagy másik irányban – „a projekt
ügyfele”, de „a Projet mezőn keresztül kapcsolt feladatok” is:

- a **kikeresés** a kapcsolt sor egy értékét vagy az értékek listáját hozza vissza: egy projekt
  ügyfelének városát;
- az **aggregálás** a kapcsolt sorokon számol: értékek száma, összeg, átlag, minimum,
  maximum – egy ügyfél árbevétele, az értékeléseinek átlagos pontszáma;
- a **darabszám** a kapcsolt sorokat számolja meg: egy projekt feladatainak számát.

Minden olvasáskor kiszámítódnak, **az olvasó jogosultságaival**: ha a kapcsolt táblához nincs
hozzáférése, a mezőhöz sincs. Szűrhetők és rendezhetők. Egyetlen kapcsolatot követnek, nem
írhatók, nincs oszlopuk – így közvetlen SQL-ben sem léteznek –, és nem szerepelnek sem az
importálásban, sem az űrlapokon, sem az előzményekben.

## A kapcsolatok

A **kapcsolat** egy sort ugyanazon adatbázis egy másik táblájának egy sorához köt. A rács a
célsor **megjelenítési értékét** mutatja – azt az oszlopot, amelyet a táblájához
megjelenítési mezőként jelöl ki –, a szűrők pedig áthaladnak a kapcsolaton
(`clients_id.ville eq "Lyon"`). Az egy sorra mutató sorok a sor részletei panelen jelennek meg.

Jelölje be a **Rekordonként több sor** lehetőséget, és a kapcsolat **többszörös** lesz: egy
feladat több feladattól függ, egy cikk több kategóriába tartozik. A kapcsolt sorok címkékként
jelennek meg, kereséssel választhatók ki, és egy kattintással megnyithatók a sor részletei
panelről. Egy célsor törlése eltávolítja azt azokból a listákból, amelyek hivatkoztak rá – vagy
elutasításra kerül, ha így döntött. A `has_any`, `has_all` és `is_null` szűrők alkalmazhatók,
és ezek is áthaladnak a kapcsolaton (`taches_ids.titre contains "logo"`). A többszörös
kapcsolat egyelőre nem rendezhető, nem csoportosítható és nem importálható.

## Gomb

A **Gomb** mezőnek nincs értéke: cselekszik. **Megnyit egy címet** – `https://` vagy
`mailto:` –, amely hivatkozhat a sorra (`mailto:{{E-mail}}`), vagy **elindít egy
automatizálást**, amelyet ugyanazon a táblán egy gomb vált ki. Megjelenik a cellában, a
kártyán és a sor részletei panelen.

## Leírások

Az adatbázisnak, a táblának és a mezőnek is lehet **leírása**, amely migráció nélkül
módosítható. Átkerül a `COMMENT ON` utasításba, amelyet a `psql` olvas, a generált
dokumentációba, és abba, amit egy ügynök a `describe_table` révén olvas.

## Formázott szöveg és változók

A **formázott szöveg** a hosszú szöveg HTML-változata, amelyet a mező létrehozásakor lehet
kiválasztani („Formázott szöveg (HTML)”): címsorok, félkövér, dőlt, aláhúzott, áthúzott,
listák, idézetek, kód, hivatkozások és elválasztók, egy vizuális szerkesztőben. A HTML-t a
rendszer **íráskor megtisztítja**, akár a felületről, az API-ból, az MCP-szerverről vagy egy
importálásból érkezik, egy `CHECK` megszorítás pedig ezen felül elutasítja a közvetlenül
SQL-ben írt veszélyes formákat is (`<script>`, `on…` attribútumok, `javascript:`). Se kép, se
táblázat, se szín: amit az adatbázis nem őrizne meg, azt fel sem kínálja.

A hosszú szöveg – akár egyszerű, akár formázott – **hivatkozhat a saját sorának egy
oszlopára**. A szerkesztő **Oszlop** menüje a kurzor helyére szúrja be a hivatkozást:
formázott szövegben egy címkét, Markdownban `{{Ville}}` alakot.

> A szállítás várható időpontja `{{Livraison}}`, helyszíne `{{Ville}}`.

- Az oszlop a hivatkozást úgy tárolja, ahogy le van írva – `{{ville}}`, a fizikai nevével: ezt
  olvassa a `psql`.
- Minden más helyen – a rácsban, a sor részletei panelen, az API-ban, az MCP-szerverben, a
  megosztott nézetekben, az automatizálásokban – a szöveg **a sor értékével** olvasható:
  „A szállítás várható időpontja 2026. 10. 02., helyszíne Lyon.” Ha a várost módosítja, a
  szöveg is változik.
- Az egyszeres választás a címkéjével, a személy a nevével, a dátum az Ön formátumában
  jelenik meg; a formázott szövegbe beszúrt érték soha nem jelölőkód.
- Az az oszlop, amelyet az olvasó nem olvashat, semmit nem ad: sem az értékét, sem a nevét.

A formázott szöveget az MI nem töltheti ki: a modell szöveget ír, nem megtisztított HTML-t.

## A struktúra módosítása

Az adatbázis **Struktúra** képernyője – az oldalsávban lévő **⋯** menüjében – felsorolja a táblákat és a mezőiket: hozzáadás, átnevezés, kötelezővé tétel, átrendezés,
leírás, a megjelenítési mező kijelölése.

![Egy adatbázis Struktúra képernyője](../../../../assets/screens/structure.png)

A struktúra módosításához **Kezelés** szintű jogosultság szükséges. Enélkül a képernyő
megtekinthető, de semmit nem kínál fel: se gombot, se ceruzát, se fogantyút – a kötelező
jelleg és a megjelenítési mező csak ki van írva, nem módosítható. A szerver amúgy is elutasít
minden módosítást; a képernyő már nem tesz úgy, mintha elfogadná.

Egy mező hozzáadása, átnevezése vagy típusának módosítása a **migrációs motoron** keresztül
történik: lépésekre bontott terv, rövid zárolások, és megnevezett elutasítás, ha egy adat nem
alakítható át.

Egy adatbázis, tábla vagy mező **átnevezése** egyetlen párbeszédablakban történik. A címke
mindig változik, migráció nélkül. Egy adminisztrátor alatta az „Átnevezés az adatbázisban is:
`clients` → `comptes`” lehetőséget is látja: ha bejelöli, a fizikai név is megváltozik, és
megjelenik a hatáselemzés – azok a lekérdezések, SQL-nézetek és automatizálások, amelyek a
régi névre hivatkoznak. A régi nevet egy **kompatibilitási alias** – egy nézet – továbbra is
kiszolgálja, amíg frissíti a lekérdezéseit.

A törlés semmit nem töröl el azonnal: a tábla vagy az adatbázis félre kerül
(`zz_supprime_…`), és SQL-ben olvasható marad. A törölt adatbázis visszaállítható; egyetlen
tábla visszaállítása a felületről [később érkezik](/basedb/hu/feuille-de-route/). A végleges
**kiürítés** az adminisztrációnak van fenntartva, harminc nappal később, és egy ellenőrzött
CSV-exporttal kezdődik.
