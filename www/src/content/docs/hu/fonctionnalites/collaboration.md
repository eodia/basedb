---
title: Együttműködés
description: Megjegyzések és említések, értesítések, valós idejű frissítések és jelenlét.
---

Egyszerre több személy dolgozik ugyanazon az adatbázison: mindenki látja beérkezni a többiek
írásait, tudja, ki mit néz, és egy sorról ott beszélget, ahol az található.

## Megjegyzések

Egy sor részletei panelen van egy **Megjegyzések** lap a „Részletek” és az „Előzmények” lap
között. Írjon be egy `@` jelet egy tag **említéséhez**, és nyomja le a Ctrl+Enter billentyűt a
küldéshez. Mindenki a saját megjegyzéseit szerkesztheti vagy törölheti.

![Beszélgetés egy projektről](../../../../assets/screens/commentaires.png)

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

![Egy beérkezett említés](../../../../assets/screens/notifications.png)

## Valós idő

A többiek írásai **újratöltés nélkül** jelennek meg: egy módosított cella, egy áthelyezett
kártya, egy hozzáadott sor – akár a felületről, az API-ból, egy ügynöktől vagy közvetlen SQL-ből
érkeznek. A szerver csak egy **jelzést** küld, soha nem adatot: a képernyő olvas újra, az Ön
jogosultságaival. Az a cella, amelyet éppen szerkeszt, soha nem cserélődik le a keze alatt.

## Jelenlét

Az **ugyanazt a táblát** néző személyek arcképe a képernyő tetején jelenik meg; az **ugyanazt a
sort** megnyitóké a sor részletei panel fejlécében. A rácsban a többiek mutatója azon a cellán
látszik, amely fölött éppen járnak.

## Visszavonás

A Ctrl+Z visszavonja az utolsó írását – lásd: [Előzmények](/basedb/hu/fonctionnalites/historique/#visszavonás-ctrlz).

## Korlátok

- Az értesítések a basedb-ben maradnak: egyelőre egyiket sem küldi el a rendszer e-mailben.
- Ha egyszerre több mint száz sor változik, a képernyő a teljes oldalt tölti újra, nem soronként
  frissít.
