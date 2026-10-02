---
title: Dokumenty PDF
description: Řádek jako faktura, nabídka, karta nebo osvědčení ve vašich barvách, s logem, propojenými řádky a součty.
---

Řádek se stane **PDF**: faktura se svými řádky a součtem, nabídka, dodací list, produktový
list, osvědčení. V detailu řádku ho tlačítko **Dokument PDF** otevře v nové záložce, odkud ho
prohlížeč vytiskne nebo uloží.

## List bez nastavení

Bez šablony se řádek vytiskne jako **list**: jeho název jako titulek a pak všechna pole, která
můžete číst, ve vašem jazyce.

## Vytvořit šablonu

Kdo vytváří tabulku — úroveň Správa — vytváří šablony z detailu řádku:
**Dokument PDF › Šablony dokumentu…**. Nová šablona vychází z **výchozího bodu**:

| Výchozí bod | Co nastaví |
|---|---|
| **Faktura** | záhlaví s logem a kontaktními údaji, „FAKTURA“, číslo a datum; klient; fakturované položky a jejich součet; souhrn bez DPH / s DPH; platební podmínky; právní údaje v zápatí |
| **Cenová nabídka** | titulek na barevném pruhu, informace v mřížce, služby, platnost, pole „Schválení“ |
| **Karta** | velký titulek v celé šířce, fotka z pole obrázku, pole v mřížce, dlouhé texty |
| **Osvědčení** | stránka na šířku v rámečku, text na střed, podpis |
| **Prázdná stránka** | titulek a pole řádku |

Je sestavena ze **sloupců vaší tabulky** — jejího čísla, data, částek, fotky, propojených
řádků — a to, co tabulka nemá, se jednoduše vynechá. Vše se v ní dá potom změnit; náhled
vpravo zobrazuje PDF otevřeného řádku a aktualizuje se při každé úpravě.

## Obsah: bloky

Bloky se řadí shora dolů; tažením za úchyt se přeřazují, kliknutím se otevírají k nastavení.

| Blok | Co ukazuje |
|---|---|
| **Nadpis** | velký titulek a podtitulek, střídmý, v barvě, podtržený, nebo na pruhu — až k okrajům stránky |
| **Text** | formátovaný text — nadpisy, tučné písmo, seznamy, odkazy —, který cituje sloupce řádku pomocí nabídky **Sloupec**: „Faktura `{{numero}}` ze dne `{{date}}`“; zarovnaný nebo zarovnaný do bloku, na barevném pozadí, v rámečku nebo označený pruhem akcentu |
| **Obrázek** | logo, razítko nebo fotka z pole obrázku řádku |
| **Pole řádku** | zvolená pole, nebo všechna: popisek vlevo, popisek nahoře v mřížce po 2 nebo 3, nebo **souhrn** — hodnoty vpravo, poslední (celková splatná částka) tučně; prázdná pole lze skrýt |
| **Tabulka propojených řádků** | řádky, které na tento odkazují — řádky faktury — nebo ty, na které odkazuje vícenásobná vazba, s jejich **součty**; barevné záhlaví, každý druhý řádek podbarvený, záhlaví, šířky a zarovnání sloupců podle vaší volby („Ks“ pro „Množství“) |
| **Sloupce** | dva nebo tři sloupce vedle sebe, každý s vlastními bloky: „Odběratel“ na jedné straně, odkazy na druhé |
| **Oddělovač**, **Mezera** | čára — krátká pro podpis — nebo mezera |
| **Zalomení stránky** | pokračování na nové stránce |

## Styl a stránka

- **Akcentová barva** — barva vaší značky: titulky, pruhy, záhlaví tabulek, odkazy. Text
  na ní je bílý nebo tmavý, podle toho, co se lépe čte.
- **Barva textu**, **písmo** textu a titulků (bezpatkové nebo patkové), **velikost** textu,
  styl mezititulků.
- **Formát** (A4 nebo Letter), **orientace**, **okraje**, jednoduchý nebo dvojitý **rámeček**
  kolem stránky, obsah **vystředěný svisle** — pro osvědčení.
- **Jazyk hodnot**: částky se píšou se svou měnou („1 234,50 €“), data vypsaná slovy
  („30. září 2026“), ano a ne, popisek volby, jméno osoby. Text je sazen vloženými písmy, která
  pokrývají všech dvacet jazyků basedb, včetně ideogramů.

## Záhlaví a zápatí

**Záhlaví** nese vaše **logo** — nahraný obrázek (PNG, JPEG nebo SVG; příliš velký obrázek se
zmenší) nebo pole obrázku řádku —, text vlevo (vaše kontaktní údaje) a text vpravo (co je to za
dokument, jeho číslo, jeho datum), na první stránce nebo na každé. **Zápatí** nese vaše právní
údaje a čísla stránek. Obě citují sloupce řádku, stejně jako text.

## Každý se svými oprávněními

Dokument se čte **s oprávněními toho, kdo ho tiskne**: pole skryté před ním v něm nefiguruje —
ani v textu, ani na obrázku —, propojený řádek, který nevidí, není v tabulce — ani v součtu.
Dvě osoby tak mohou z téhož řádku získat dva různé dokumenty: každá svůj.

## Přes API

```bash
# PDF řádku se šablonou, nebo jako „list“
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` vypíše šablony tabulky.

## Omezení

- Nahraný obrázek váží nejvýše 300 KB, osm na šablonu; obrázek z pole se převezme, pokud je to
  PNG nebo JPEG.
- Hodnota propojeného řádku se mimo tabulku cituje **vyhledáváním** v tabulce dokumentu;
  celková částka s DPH je pole tabulky.
- Jeden dokument na řádek: zatím žádné PDF z více řádků. Může to za vás udělat
  [automatizace](/basedb/cs/fonctionnalites/automatisations/#pdf-a-e-mail) — **Vygenerovat
  PDF** — a odeslat ho v příloze.
