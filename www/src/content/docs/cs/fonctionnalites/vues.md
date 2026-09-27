---
title: Zobrazení
description: Mřížka, kanban, kalendář, časová osa, galerie, seznam, formulář a dotazník – společná nebo osobní.
---

Tabulku lze zobrazit **osmi způsoby**. Zobrazení nekopíruje žádná data a nedává o nic víc
oprávnění než samotná tabulka.

:::note
Tato zobrazení jsou způsoby, jak ukázat **jednu** tabulku. [Pohled SQL](/basedb/cs/fonctionnalites/requetes-et-vues-sql/)
je něco jiného: skutečný pohled PostgreSQL napsaný v SQL nad tabulkami databáze a zařazený
mezi ně v postranním panelu.
:::

| Zobrazení | Co ukazuje | Co potřebuje |
|---|---|---|
| **Mřížka** | řádky, filtrované, řazené, seskupené, se zvolenými sloupci | – |
| **Kanban** | karty ve sloupcích | jednoduchý výběr |
| **Kalendář** | řádky v jejich datu, po měsících nebo po týdnech | pole typu datum |
| **Časová osa** | pruhy mezi dvěma daty a jejich závislosti | počáteční datum |
| **Galerie** | karty s titulním obrázkem | – |
| **Seznam** | jeden řádek na záznam, ve sbalitelných skupinách | – |
| **Formulář** | stránku otázek pro vytvoření řádku | – |
| **Dotazník** | tytéž otázky, jednu na obrazovku | – |

## Přepínač zobrazení

Nachází se vlevo od „Filtrovat“. „Všechny řádky“ je mřížka tabulky, kterou nikdo neuložil
a nikdo ji nemůže odstranit; následují **společná zobrazení** v pořadí, které zvolil ten, kdo
databázi buduje, a pak **Moje zobrazení**.

- **Společné zobrazení** vidí všichni. Jeho vytvoření, konfigurace, přejmenování, změna
  pořadí nebo odstranění vyžaduje úroveň **Správa**. Může být **uzamčené**: ukazuje to zámek
  a nikdo ho nemůže upravit, dokud ho neodemkne.
- **Osobní zobrazení** vidíte jen vy a vyžaduje jen oprávnění číst tabulku. **Vytvořit osobní
  zobrazení**, nebo **Uložit jako zobrazení** po filtrování a řazení: každý si ukládá své
  vlastní způsoby čtení, aniž by cokoli změnil ostatním. **Duplikovat** společné zobrazení
  vytvoří jeho osobní kopii.

![Galerie klientů](../../../../assets/screens/galerie.png)

## Panel nástrojů

Nad mřížkou, v tomto pořadí:

- **Filtrovat** kombinuje podmínky podle polí;
- **Sloupce** volí, co se zobrazí – systémové sloupce jsou zvlášť, pod „Systémové
  informace“;
- **Seskupit** rozdělí řádky podle pole s jedinou hodnotou – jednoduchý výběr, vazba, osoba,
  datum, číslo, text, zaškrtávací políčko… – do sbalitelných skupin, každou s počtem za celý
  filtr;
- **Barvy** obarví řádky podle jednoduchého výběru nebo podle **pravidel** – filtr a barva,
  nejvýše dvacet – jako proužek, jako pozadí nebo obojí;
- **Výška řádků**: nízká, střední, vysoká, velmi vysoká;
- **Hledat…** vpravo hledá ve všech sloupcích už během psaní; Esc hledání vymaže. Platí také
  pro kanban, kalendář, časovou osu, galerii a seznam a nikdy se neukládá do zobrazení.

Pod každým sloupcem je **Souhrn** počítaný ze všech řádků filtru, nejen ze stránky:
vyplněné, prázdné, jedinečné hodnoty, součet, průměr, minimum, maximum, zaškrtnutá políčka.

## Kanban, kalendář, časová osa

- **Kanban** řadí karty podle jednoduchého výběru; přetažení karty upraví řádek, „+“ v záhlaví
  sloupce vytvoří řádek, který už tuto volbu má. Každá karta ukazuje nadpis, titulní obrázek,
  zvolená pole a **popis**, který cituje hodnoty řádku – „Livraison prévue le `{{Date}}` pour
  `{{Client}}`“ –, napsaný v nastavení zobrazení tlačítkem **Vložit pole**.
- **Kalendář** umístí každý řádek do jeho data, případně s koncovým datem; přetažením řádku
  z jednoho dne na jiný se řádek posune.
- **Časová osa** kreslí pruhy mezi počátečním a koncovým datem, seskupené podle jednoduchého
  výběru nebo vazby. S nastavením **Závisí na** – vazbou tabulky na sebe samu – spojí šipka
  každý úkol s úkoly, na kterých závisí, a je červená, když jde proti času.

![Časová osa se závislostmi](../../../../assets/screens/chronologie.png)

![Kalendář podle termínu](../../../../assets/screens/calendrier.png)

## Galerie a seznam

- **Galerie** ukazuje karty: **titulní obrázek** (oříznutý nebo celý), velikost (malé,
  střední, velké karty), barvu podle jednoduchého výběru.
- **Seznam** ukazuje jeden řádek na záznam, **seskupený** podle jednoduchého výběru, vazby
  nebo osoby.

![Seznam klientů seskupený podle odvětví](../../../../assets/screens/liste.png)

V kanbanu, galerii a seznamu lze karty a řádky **řadit ručně** přetažením – až 5 000; zvolené
řazení má před tímto pořadím přednost.

## Formulář a dotazník

Otázky se zaškrtnou a seřadí; každá má název, nápovědu a může být povinná. Formulář má svůj
nadpis, úvodní text, popisek tlačítka a děkovnou zprávu. Vyplňuje se v basedb, nebo se
[sdílí odkazem](/basedb/cs/fonctionnalites/formulaires-partages/).

## Sdílení zobrazení

Datové zobrazení – mřížka, kanban, kalendář, časová osa, galerie, seznam – se **sdílí jen pro
čtení** odkazem, lze ho vložit na jiný web a z kalendáře se stane kalendářový kanál. Viz
[Sdílená zobrazení](/basedb/cs/fonctionnalites/vues-partagees/).

## Co čtenář nevidí

Zobrazení se **znovu promítá pro svého čtenáře**: pole, které je před ním skryté, zmizí ze
sloupců, z karet i z otázek. Zobrazení, jehož filtr cituje skryté pole, se nezobrazí vůbec:
bez svého filtru by ukázalo víc, než k čemu bylo vytvořeno.
