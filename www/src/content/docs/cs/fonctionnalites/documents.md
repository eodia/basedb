---
title: Dokumenty PDF
description: Řádek jako faktura, nabídka nebo tisknutelný list, s propojenými řádky a jejich součty.
---

Řádek se stane **PDF**: faktura se svými řádky a součtem, nabídka, dodací list, list. V detailu
řádku ho tlačítko **Dokument PDF** otevře v nové záložce, odkud ho prohlížeč vytiskne nebo
uloží.

## List bez nastavení

Bez šablony se řádek vytiskne jako **list**: jeho název jako titulek a pak všechna pole, která
můžete číst, ve vašem jazyce.

## Šablony

Kdo vytváří tabulku — úroveň Správa — je píše z detailu řádku:
**Dokument PDF › Šablony dokumentu…**. Šablona je stránka (A4 nebo Letter, na výšku nebo na
šířku), jazyk pro hodnoty, zápatí a posloupnost bloků:

| Blok | Co ukazuje |
|---|---|
| **Text** | formátovaný text — nadpisy, tučné písmo, seznamy, odkazy —, který cituje sloupce řádku pomocí nabídky **Sloupec**: „Faktura `{{numero}}` ze dne `{{date}}`“ |
| **Pole řádku** | zvolená pole, nebo všechna: popisek vlevo, hodnota vpravo |
| **Tabulka propojených řádků** | řádky, které na tento odkazují — řádky faktury — nebo ty, na které odkazuje vícenásobná vazba, se zvolenými sloupci a jejich **součty** |
| **Zalomení stránky** | pokračování na nové stránce |

Editor vedle zobrazuje PDF, které šablona vytvoří z otevřeného řádku, včetně úprav.

Hodnoty se zapisují **v jazyce šablony**: částka se svou měnou („1 234,50 €“), datum vypsané
slovy („30. září 2026“), ano a ne, popisek volby, jméno osoby. Text je sazen vloženými písmy,
která pokrývají všech dvacet jazyků basedb, včetně ideogramů.

## Každý se svými oprávněními

Dokument se čte **s oprávněními toho, kdo ho tiskne**: pole skryté před ním v něm nefiguruje,
propojený řádek, který nevidí, není v tabulce — ani v součtu. Dvě osoby tak mohou z téhož
řádku získat dva různé dokumenty: každá svůj.

## Přes API

```bash
# PDF řádku se šablonou, nebo jako „list“
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` vypíše šablony tabulky.

## Omezení

- V dokumentu žádný obrázek (logo) ani zvolená barva, žádné záhlaví oddělené od zápatí.
- Jeden dokument na řádek: zatím žádné PDF z více řádků, ani generování automatizací.
