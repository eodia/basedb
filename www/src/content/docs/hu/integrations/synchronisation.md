---
title: Slack, naptárak és szinkronizált táblák
description: Értesítés küldése egy Slack-csatornára, naptár összekapcsolása, tábla naprakészen tartása egy CSV-ből, egy naptárból vagy egy másik adatbázisból.
---

Egy adatbázis **Integrációk** képernyője a bal alsó sarokban lévő profilmenüből nyitható meg.
**Kezelés** szintet igényel, és egy helyre gyűjti mindazt, ami az adatbázist a többi
eszközéhez köti.

![Egy adatbázis Integrációk képernyője](../../../../assets/screens/integrations.png)

## Slack

**Csatorna csatlakoztatása**: a Slackben hozzon létre egy *bejövő webhookot* a kívánt
csatornához, majd illessze be a címét (`https://hooks.slack.com/…`, ez az egyetlen elfogadott
forrás). A **Tesztelés** egy próbaüzenetet küld. A cím már a mentéskor titkosításra kerül, és
soha többé nem jelenik meg.

A csatlakoztatott csatorna ezután az [automatizálások](/basedb/hu/fonctionnalites/automatisations/)
egyik művelete lesz: **Küldés Slackre**, egy olyan üzenettel, amely a sorra hivatkozik – „Új
negatív értékelés ({{Auteur}}): {{Avis}}”.

## Naptárak

Két irány, két eszköz:

- **Nézet megjelenítése egy naptárban**: ossza meg nyilvánosan egy naptár vagy idővonal
  nézetét; a megosztási párbeszédablaka megadja egy **iCalendar-csatorna** címét, amelyre a
  Google Naptárból („Egyéb naptárak” → „URL-ből”), az Outlookból vagy az Apple Calendarból lehet
  feliratkozni. Lásd: [Megosztott nézetek](/basedb/hu/fonctionnalites/vues-partagees/#naptár-a-naptáralkalmazásában).
- **Naptár importálása**: hozzon létre egy „Naptár” forrású szinkronizált táblát a naptár titkos
  iCal-címével.

## Szinkronizált táblák

A szinkronizált táblát **egy forrás tartja naprakészen**: ugyanúgy olvasható, szűrhető és
nézetekben megjeleníthető, mint a többi, de kézzel nem írható – ezt egy „Szinkronizált” jelvény
jelzi, és az API minden írást elutasít (`TABLE_SYNCED`).

| Forrás | Mivé válik a tábla |
|---|---|
| **Online CSV-fájl** | a fájl minden oszlopából egy oszlop lesz, a tartalma alapján típussal: szám, dátum vagy szöveg |
| **Naptár** (Google Naptár, iCalendar) | soronként egy esemény: cím, kezdés, befejezés, helyszín, leírás |
| **Egy basedb megosztott nézete** | egy [megosztott nézet](/basedb/hu/fonctionnalites/vues-partagees/#forrás-más-adatbázisok-számára) sorai, ezen a példányon vagy egy másikon |

Az **Új szinkronizált tábla** kiválasztja a forrást és az időközt – 15 percenkénttől napi
egyszerig; a **Szinkronizálás** azonnal újraolvassa. Minden futás létrehozza, módosítja és
törli azt, ami ahhoz szükséges, hogy a tábla megfeleljen a forrásnak, egy **Szinkronizálási
kulcs** mező alapján tájékozódva. Mindezek az írások bekerülnek az előzményekbe.

A szinkronizálás **leállítása** közönséges táblává alakítja a táblát: a sorai megmaradnak, és
ismét kézzel írhatók.

## Korlátok

- A forrás legfeljebb 5 MB, 10 000 sor és 10 másodperc erejéig kerül beolvasásra.
- A sikertelen forrás semmit nem töröl: a tábla a következő futásig megtartja a sorait.
- A forrásban a létrehozás után megjelent oszlop nem kerül hozzáadásra.
- A Slack bejövő webhookon keresztül csatlakozik, Slack-alkalmazáson keresztül egyelőre nem.
