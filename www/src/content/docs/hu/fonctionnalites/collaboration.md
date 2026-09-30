---
title: Együttműködés
description: Megjegyzések és említések, értesítések, valós idejű frissítések, jelenlét, és egy hivatkozás minden képernyőhöz.
---

Egyszerre több személy dolgozik ugyanazon az adatbázison: mindenki látja beérkezni a többiek
írásait, tudja, ki mit néz, és egy sorról ott beszélget, ahol az található.

## Megjegyzések

Egy sor részletei panelen van egy **Megjegyzések** lap a „Részletek” és az „Előzmények” lap
között. Írjon be egy `@` jelet egy tag **említéséhez**, és nyomja le a Ctrl+Enter billentyűt a
küldéshez. Mindenki a saját megjegyzéseit szerkesztheti vagy törölheti.

![Beszélgetés egy projektről](../../../../assets/screens/hu/commentaires.webp)

Ha valaki olvashatja a sort, megjegyzést is fűzhet hozzá. Az említett személy, aki nem olvashatja
a sort, nem kap értesítést – és erről a szerző tájékoztatást kap, ahelyett hogy azt hinné, az
üzenet elment.

## Értesítések

A jobb felső sarokban lévő csengő számolja az olvasatlanokat. Négy dolog érkezik ide:

- valaki **megemlíti** Önt egy megjegyzésben;
- valaki **válaszol** egy beszélgetésben, amelybe Ön is írt;
- valaki **kijelöli** Önt egy Személy mezőben – a felületről, az API-ból, egy űrlapból vagy egy
  automatizálásból;
- egy [automatizálás](/basedb/hu/fonctionnalites/automatisations/) **értesíti** Önt.

Egy értesítés megnyitása megnyitja a sort. Az **Összes megjelölése olvasottként** lenullázza a
számlálót; az értesítéseket 90 napig őrzi meg a rendszer.

### E-mailben

Ha a példánynak van [levélküldő szervere](/basedb/hu/hebergement/variables/#e-mailek), egy
**tíz percig olvasatlanul maradt** értesítés e-mailben is elmegy: egyetlen e-mail az összes
váró értesítésről, mindegyik sorára mutató hivatkozással. Az, amit időben elolvas, nem megy el.
A **Beállítások › Értesítések** menüpontban minden fajtának két kapcsolója van: a basedb-ben,
és e-mailben.

![Egy beérkezett említés](../../../../assets/screens/hu/notifications.webp)

## Valós idő

A többiek írásai **újratöltés nélkül** jelennek meg: egy módosított cella, egy áthelyezett
kártya, egy hozzáadott sor – akár a felületről, az API-ból, egy ügynöktől vagy közvetlen SQL-ből
érkeznek. A szerver csak egy **jelzést** küld, soha nem adatot: a képernyő olvas újra, az Ön
jogosultságaival. Az a cella, amelyet éppen szerkeszt, soha nem cserélődik le a keze alatt.

## Jelenlét

Az **ugyanazt a táblát** néző személyek arcképe a képernyő tetején jelenik meg; az **ugyanazt a
sort** megnyitóké a sor részletei panel fejlécében. A rácsban a többiek mutatója azon a cellán
látszik, amely fölött éppen járnak.

## Hivatkozás minden képernyőhöz

A böngésző címe azt követi, amit éppen néz: egy táblát, annak egy nézetét, egy sor részleteit,
egy irányítópultot, egy automatizálást, egy kérdést, az Ön beállításait. Illessze be egy
üzenetbe: a kollégája ugyanoda érkezik, a saját jogosultságaival. Tegye könyvjelzőbe; a böngésző
vissza és előre gombjai oda viszik, ahol korábban járt.

| Cím | Mit nyit meg |
|---|---|
| `/bases/ventes/tables/opportunites` | a „Ventes” adatbázis „Opportunités” táblája |
| `/bases/ventes/tables/opportunites?vue=…` | egyik nézete |
| `/bases/ventes/tables/opportunites?ligne=…` | egyik sorának részletei |
| `/bases/ventes/tableaux-de-bord/…` | egy irányítópult |
| `/bases/ventes/automatisations/…` | egy automatizálás |
| `/parametres/apparence` | az Ön beállításai |

Egy cím egy **helyet** nevez meg, nem azt az állapotot, amelyben hagyta: a szűrők, a rendezések
és az oszlopszélességek böngészőnként megmaradnak. Egy adatbázis és egy tábla a PostgreSQL-nevén
íródik bele: átnevezés után a régi cím már semmire nem vezet. Egy olyan cím, amely semmire nem
vezet – egy elgépelés, egy törölt objektum, vagy amit Önnek nincs joga látni –, a „Ez az oldal
nem létezik” feliratot mutatja.

## Visszavonás

A Ctrl+Z visszavonja az utolsó írását – lásd: [Előzmények](/basedb/hu/fonctionnalites/historique/#visszavonás-ctrlz).

## Korlátok

- Nincs e-mail az üzemeltető által beállított levélküldő szerver nélkül.
- Ha egyszerre több mint száz sor változik, a képernyő a teljes oldalt tölti újra, nem soronként
  frissít.
