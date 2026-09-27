---
title: Környezetek
description: Éles, teszt, fejlesztői – összehasonlítás, migrálás, szinkronizálás.
---

Egy adatbázisnak lehetnek **környezetei**: éles, teszt, fejlesztői… Mindegyik teljes értékű
adatbázis – saját sémával, táblákkal, sorokkal és jogosultságokkal –, és mindegyik osztozik az
adatbázis, a táblái és a mezői **leszármazási vonalán**.

## A felületen

Az oldalsáv **adatbázisonként egy sort** mutat, egy jelvénnyel, amely jelzi a megnyitott
környezetet, és lehetővé teszi a váltást. A jelvény addig nem jelenik meg, amíg csak az éles
környezet létezik.

A környezetek az **Adatbázis szerkesztése…** párbeszédablakban adhatók hozzá, nevezhetők át és
törölhetők: az új környezet egy másik környezet **struktúrájának másolataként** jön létre, a
sorai nélkül.

## Környezetek összehasonlítása

Az adatbázis menüjéből, a **További műveletek** alatt a **Környezetek összehasonlítása…**
egy párbeszédablakot nyit meg:

- **Struktúra**: a környezetek oszlopokban, a táblák és a mezők sorokban; ami eltér az éles
  környezettől, az ki van emelve.
- A **Migrációk alkalmazása…** lépésről lépésre előkészíti a tervet, amellyel egyik környezetből
  a másikba lehet jutni. Soha nem jelöli be automatikusan azt, ami a cél egy újabb módosítását
  vonná vissza.
- **Sorok szinkronizálása**: táblánként sorok átvitele egyik környezetből a másikba, azonosító
  alapján.

![Az éles és a teszt környezet összehasonlítása](../../../../assets/screens/environnements.png)

## Honnan tudja a basedb, ki mit változtatott

Az összehasonlítás a **struktúra előzményein** alapul: a táblák vagy mezők minden
létrehozását, módosítását vagy törlését egy, a katalóguson lévő trigger rögzíti, és ez az
előzmények „Struktúra” lapján olvasható. A leszármazási azonosítók egy teszt környezetbeli
mezőt az éles környezetbeli megfelelőjéhez kötnek, akkor is, ha át lett nevezve.

## SQL-ben

Minden környezet egy séma: `b_t4z56fq_ventes` az éles, `b_t4z56fq_ventes_recette` a teszt
környezeté. A lekérdezései a séma – vagy a `search_path` – módosításával váltanak környezetet.
