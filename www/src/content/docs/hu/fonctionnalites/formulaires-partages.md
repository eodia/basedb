---
title: Megosztott űrlapok
description: Űrlap megosztása hivatkozással, nyilvánosan vagy csak a bejelentkezett tagok számára.
---

Egy űrlap vagy kérdőív egy `/f/<jeton>` **hivatkozással osztható meg**. A válaszadónak
**semmilyen jogosultságra nincs szüksége a táblán**: minden válasz egy sort ad hozzá, és a
táblából semmi mást nem lát. Ha sorokat szeretne megmutatni, nem fogadni, egy nézet
[csak olvasható módon](/basedb/hu/fonctionnalites/vues-partagees/) is megosztható.

![A megosztási párbeszédablak](../../../../assets/screens/partage-formulaire.png)

## Ki válaszolhat

| Hozzáférés | Ki válaszol | Mi jelenik meg |
|---|---|---|
| **Nyilvános** | bárki, akinek megvan a hivatkozás, fiók nélkül | csak az űrlap |
| **Bejelentkezett tagok** | a munkaterület egy tagja – szükség esetén csak bizonyos csoportokból | a bejelentkezés, majd az űrlap és a „Válaszadóként: …” felirat |

A hivatkozás oldala az alkalmazáson kívül van: se oldalsáv, se adatbázisnév, se más sorok.

![Egy nyilvános űrlap](../../../../assets/screens/formulaire-public.png)

## Kinek a nevében íródik a válasz

A sor **annak a személynek a jogosultságával** íródik, **aki a megosztást közzétette** – azaz
aki utoljára mentette. A sorok létrehozására vonatkozó jogosultságát a rendszer **minden
válasznál** ellenőrzi, az űrlap kérdéseire korlátozva: ha elveszíti, az űrlap felfüggesztődik,
amíg valaki, akinek megvan ez a jogosultsága, újra nem menti.

Az előzmények azt mutatják, ki válaszolt, nem azt, ki tette közzé:

- egy **tag** válasza a személyhez van rendelve;
- egy **nyilvános** válasz magához az űrlaphoz van rendelve: „Űrlap »Demande de devis« ·
  nyilvános válasz · közzétette: Camille”.

## Megnyitás és lezárás

A párbeszédablakban beállítható:

- az **Aktív hivatkozás** kapcsoló;
- a **lezárás dátuma**;
- a **válaszok maximális száma** – pontosan, egyidejű válaszok esetén is;
- **Hivatkozás újragenerálása**: a régi azonnal megszűnik működni;
- **Megosztás leállítása**: a hivatkozás megszűnik, a válaszok a táblában maradnak.

A lezárt űrlap ezt egy mondatban jelzi, még mielőtt bejelentkezést kérne.

## Korlátok

- A **kapcsolat**, **fájl** és **kép** típusú kérdéseket a megosztott hivatkozás nem teszi fel;
  a párbeszédablak jelzi ezeket.
- A beküldés címenként és hivatkozásonként percenként 20 válaszra korlátozott. A mellékelt
  proxy (Caddy) mögött a cím a látogatóé.

A részletek az architektúra-dokumentum [15. fejezetében](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
találhatók.
