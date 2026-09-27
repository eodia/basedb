---
title: Előzmények
description: Minden írás, bárhonnan érkezzen is, a korábbi értékekkel együtt.
---

A basedb **minden írást** rögzít az előzményekben, bárhonnan érkezzen is: a felületről, az
API-ból, egy MCP-ügynöktől, egy nyilvános űrlapból – sőt egy `psql`-ben kézzel írt
SQL-lekérdezésből is.

![Egy adatbázis előzményei](../../../../assets/screens/historique.png)

## Hogyan történik a rögzítés

Nem az alkalmazás rögzíti, hanem **PostgreSQL-triggerek**, magában az írás tranzakciójában. A
sikertelen írás nem hagy nyomot; a sikeres írásnak pedig nem maradhat el a nyoma. A
revíziók ezután havonta particionált, megváltoztathatatlan naplókba kerülnek.

Az identitást a minden tranzakció elején beállított munkamenet-változók viszik magukkal. Az az
írás, amely nem hordoz ilyet – a közvetlen SQL –, ennek megfelelően kerül rögzítésre, az őt
végrehajtó munkamenettel együtt (`psql`, cím, folyamat): emiatt soha nem kerül elutasításra.

| Szereplő | Megjelenítés |
|---|---|
| egy személy | a neve |
| egy program (API) vagy egy ügynök (MCP) | a tokent létrehozó személy, „a(z) … token révén” |
| egy nyilvános űrlap | „Űrlap »…« · nyilvános válasz” |
| egy automatizálás | „Automatizálás »…« · … nevében”, az érte felelős személlyel |
| közvetlen SQL | „Közvetlen SQL-munkamenet” |

## Mire használható

- Egy sor (a sor részletei panel „Előzmények” lapja), egy tábla vagy egy adatbázis (az
  adatbázis **⋯** menüjében az **Előzmények**) előzményeinek **olvasása**, táblánként szűrve.
- Egy módosítás **visszavonása**: a korábbi értékeket a rendszer mezőről mezőre újra alkalmazza.
- Egy törölt sor **visszaállítása** a „törölte” bejegyzéséből.
- A **struktúra előzményeinek** követése („Struktúra” lap): létrehozott, módosított, törölt
  táblák és mezők.

## Visszavonás (Ctrl+Z)

A rácsban a **Ctrl+Z** (Macen ⌘Z) visszavonja az utolsó írását; a **Ctrl+Shift+Z** vagy a
**Ctrl+Y** visszaállítja. Egy üzenet megerősíti, mi lett visszavonva – „Visszavonva: »Montant«
módosítása” –, egy gombbal, amellyel a visszavonás is visszavonható.

Így vonható vissza egy cella, egy áthelyezett kártya vagy sáv, egy létrehozott vagy törölt sor,
egy beillesztés – és egy teljes importálás is, amely egyetlen műveletnek számít. Legfeljebb
ötven művelet, böngészőlaponként.

Ez nem a képernyő visszaléptetése: ez egy **új írás**, amelyet a szerver az előzmények alapján
végez, és amely szintén bekerül az előzményekbe. Elutasításra kerül, ha azóta valaki módosította
a sort – „A visszavonás nem lehetséges: »Statut« azóta módosult” –, ahelyett hogy felülírná a
munkáját. Így csak a saját, az utolsó huszonnégy órában végzett írásai vonhatók vissza, a
struktúra pedig soha. Egy éppen szerkesztett cellában a Ctrl+Z a szövegre vonatkozik.

## Jogosultságok

Az előzmények az olvasási jogosultságokat követik: az Ön elől elrejtett mező nem jelenik meg az
Ön által olvasott revíziókban.
