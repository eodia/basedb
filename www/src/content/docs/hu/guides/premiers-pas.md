---
title: Első lépések
description: Adatbázis, tábla, mezők, nézet és űrlap létrehozása.
---

Ez a bejárás tíz percet vesz igénybe, és a lényeget fedi le: a végére lesz egy táblája, egy
kanban nézete és egy nyilvános űrlapja, amely ebbe a táblába ír.

:::tip[Hogy mindent egyszerre lásson]
Egy üres projekt felkínálja a **bemutató adatbázist**: egy kis ügynökség az ügyfeleivel,
projektjeivel, feladataival, számláival és értékeléseivel, képletekkel, mindenféle nézettel,
egy irányítópulttal és automatizálásokkal. Az **Új adatbázis** a [sablongalériát](/basedb/hu/fonctionnalites/modeles/)
is megnyitja, ahol az adatbázisát az MI-nek is leírhatja.
:::

## 1. Adatbázis létrehozása

Minden **projektekbe** szerveződik: az oldalsáv tetején lévő választó projektet vált, vagy
újat hoz létre. Az oldalsávban a szűrőtől jobbra lévő **+** hoz létre adatbázist. Adjon neki
címkét – „Ventes” –, és ha szeretné, leírást, színt, ikont.

Az adatbázisból **PostgreSQL-séma** lesz: a fizikai neve (`b_t4z56fq_ventes`) megjelenik az
űrlapon és a generált dokumentációban.

## 2. Tábla és mezőinek létrehozása

Az adatbázis **⋯** menüjéből: **Új tábla**. Ezután adja hozzá a mezőit a **Struktúra**
képernyőn – ugyanebben a menüben – a **Mező** gombbal:

| Mező | Típus |
|---|---|
| Nom | Rövid szöveg |
| Statut | Egyszeres választás – Nouveau, Qualifié, Gagné, Perdu |
| Montant | Pénznem |
| Échéance | Dátum |
| Client | Kapcsolat → Clients |
| Notes | Hosszú szöveg (Markdown) |

Később egy képlet (`JOURS([Échéance]; AUJOURDHUI())`), egy kikeresés (az ügyfél városa) vagy
egy aggregálás (az ügyfelenkénti teljes összeg) ugyanígy adható hozzá – lásd:
[Táblák és mezők](/basedb/hu/fonctionnalites/tables-et-champs/).

**Importálhat egy fájlt** is CSV vagy JSON formátumban: az importálás kitalálja a típusokat,
hagyja, hogy kijavítsa őket, létrehozza a táblát vagy kiegészít egy meglévőt, és soronként
megmondja, mit utasít el.

![Egy adatbázis menüje](../../../../assets/screens/menu-base.png)

## 3. Adatbevitel és szűrés

A rács táblázatkezelőként szerkeszthető: dupla kattintás vagy Enter egy cella
szerkesztéséhez, Esc a megszakításhoz. A **Szűrés** mezőnkénti feltételeket kombinál; a
rendezés az oszlopfejlécből történik; a sáv jobb oldalán lévő **Keresés…** minden oszlopban
keres. Minden módosítás azonnal mentésre kerül – és bekerül az [előzményekbe](/basedb/hu/fonctionnalites/historique/):
a **Ctrl+Z** visszavonja az utolsót.

## 4. Nézet hozzáadása

A nézetválasztó a „Szűrés” gombtól balra az „Összes sor” lehetőséget, majd az Ön nézeteit
kínálja. Hozzon létre egy „Statut” szerint csoportosított **kanbant**: ha egy kártyát egyik
oszlopból a másikba húz, a sor módosul.

![Kanban állapot szerint](../../../../assets/screens/kanban.png)

## 5. Űrlap megosztása

Hozzon létre egy **Űrlap** nézetet, jelölje be a kérdéseket, majd **Megosztás**: válassza a
„Nyilvános” lehetőséget, és másolja ki a hivatkozást. Minden válasz egy sort ad a táblához,
anélkül hogy a válaszadó bármilyen jogosultságot kapna. Részletek:
[Megosztott űrlapok](/basedb/hu/fonctionnalites/formulaires-partages/).

## 6. Olvasás SQL-ben

Az adatbázis **⋯** menüje → **Új SQL-lekérdezés**: a táblái ott vannak, a valódi nevükön.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

A **Mentés** a táblák alá, a „Lekérdezések” rovatba helyezi – csak Önnek, vagy az egész
adatbázisnak –, a **⋯** → **SQL-nézet létrehozása…** pedig valódi PostgreSQL-nézetet készít
belőle, a táblák között elhelyezve. Mindenki a saját jogosultságaival olvassa őket. Lásd:
[Lekérdezések és SQL-nézetek](/basedb/hu/fonctionnalites/requetes-et-vues-sql/).

Ugyanez működik a `psql`-ből vagy a BI-eszközéből is. Lásd: [Közvetlen SQL](/basedb/hu/integrations/sql/).
