---
title: Vyhledávání
description: Jedno pole pro nalezení všeho — tabulky, zobrazení, řídicí panely, řádky, příkazy — a pro položení otázky Copilotovi. Ctrl+K.
---

Pole **Hledat tabulky, řádky, příkazy…**, uprostřed horní lišty, otevře vyhledávání: jedno
pole pro vše, k čemu se v basedb můžete dostat. **Ctrl+K** (**⌘K** na Macu) ho odkudkoli otevře
nebo zavře — kromě textového editoru, kde místo toho vloží odkaz.

## Co najde

| | |
|---|---|
| **Tabulky a objekty** | projekty a databáze, které vidíte; tabulky, pohledy SQL a uložené dotazy; zobrazení tabulek otevřené databáze, včetně osobních; otázky, řídicí panely a automatizace databází projektu; sloupce tabulek; otevřené záložky |
| **Řádky** | samotná data v tabulkách otevřené databáze: text sloupců, volby ze seznamů, přesné číslo — od dvou znaků. Vložený identifikátor řádku najde svůj řádek |
| **Příkazy** | co aplikace umí: přejít na strukturu, na historii, na řídicí panely databáze; vytvořit tabulku, otázku, dotaz SQL, databázi, projekt, začít ze šablony; importovat do tabulky; vrátit nebo obnovit poslední zápis; zavřít nebo přepnout záložku; změnit motiv; otevřít Copilot; **Kopírovat odkaz na tuto stránku**; otevřít záložku nastavení nebo administrace; odhlásit se |
| **Copilot** | otázka v přirozeném jazyce, předaná Copilotovi |

**Enter** otevře zvolený výsledek: řádek se otevře ve své tabulce, ve svém detailu řádku. Na
velké obrazovce panel vpravo zobrazí jeho náhled — hodnoty řádku, sloupce a popis tabulky,
popis řídicího panelu nebo automatizace. Vložte adresu basedb: **Otevřít tento odkaz** vás tam
zavede (viz
[odkaz na každou obrazovku](/basedb/cs/fonctionnalites/collaboration/#odkaz-na-každou-obrazovku)).

Prázdné pole nabízí vaše **nedávné**, otevřené záložky, tabulky databáze a několik návrhů.

## Pište, jak přemýšlíte

- **Bez diakritiky a velkých písmen**: `vzdelavani` najde „Vzdělávání“.
- **Začátky slov a iniciály**: `nt` pro „Nová tabulka“, `novdat` pro „Nová databáze“.
- **Jeden překlep se promine** — vynechané, zdvojené, záměněné nebo prohozené písmeno, dva
  u slova delšího než sedm písmen —, nikdy v prvním písmenu.
- **Každé napsané slovo se musí někde najít**, v názvu nebo v tom, co ho obsahuje:
  `prodej zakaznici` najde tabulku „Zákazníci“ databáze „Prodej“. Zadat lze i druh objektu:
  `zobrazení`, `automatizace`, `panel`.
- **Nejprve tabulka, pak to, co v ní hledáte**: `zakaznici praha` hledá „praha“ v řádcích
  tabulky „Zákazníci“.

Nahoře je **nejlepší výsledek**; to, co otevíráte často a nedávno, se posouvá výš. Tato paměť
zůstává ve vašem prohlížeči.

## Omezení vyhledávání

Tlačítka pod polem — **Vše**, **Tabulky a objekty**, **Řádky**, **Příkazy**, **Copilot** —
omezují, co se hledá. Totéž udělá první napsaný znak:

| Napište nejprve | Pro hledání |
|---|---|
| `#` | jen tabulky a objekty |
| `/` | jen řádky |
| `>` | jen příkazy |
| `?` | otázky pro Copilota |

**Tab** na tabulce nebo databázi hledá **uvnitř**: její název se zobrazí v poli a vyhledávání
se pak týká jen jejích řádků, zobrazení, sloupců a příkazů. Prázdné pole pak ukáže dvacet
naposledy změněných řádků. **⌫** v prázdném poli z toho vystoupí; **Esc** se vrátí o krok
zpět, a pak zavře.

## Zeptat se Copilota

Každé vyhledávání končí položkou **Zeptat se Copilota: „…“**, umístěnou nahoře, když se text
čte jako otázka — končí otazníkem, začíná slovy „kolik“, „jaký“, „ukaž“…, nebo má pět a více
slov. Copilot se otevře nad databází a dostane otázku, jako byste ji napsali vy. Čte
strukturu, ne řádky, pokud nezaškrtnete **Povolit čtení dat**, a navrhuje: dokud to
neschválíte, nic se nezmění. Na instanci musí být nastavena AI — viz
[Umělá inteligence](/basedb/cs/fonctionnalites/ia/).

## Oprávnění a omezení

Vyhledávání prochází stejnými cestami jako zbytek obrazovky, **s vašimi oprávněními**: tabulka
nebo sloupec, který je pro vás uzavřený, se neobjeví ani mezi objekty, ani v řádcích.
Automatizace se nabízejí jen tomu, kdo má nad jejich databází úroveň **Správa**.

- Řádky se hledají v otevřené databázi, nebo v databázi či tabulce, do které jste vstoupili
  klávesou Tab: tři řádky na tabulku, nejvýše ve dvaceti čtyřech tabulkách; dvacet řádků
  v jedné tabulce.
- Otázky, řídicí panely a automatizace jsou ty z otevřeného projektu (nejvýše osm databází),
  znovu načtené nejvýše každé dvě minuty.
- Každá skupina zobrazí několik výsledků, poté **N dalších výsledků**, které ji otevřou celou.

## Klávesové zkratky

**Zkratky**, dole ve vyhledávání, nebo příkaz **Klávesové zkratky**, je všechny zobrazí.
**Ctrl** se na Macu čte jako **⌘**.

| Klávesy | Účinek |
|---|---|
| **Ctrl+K** | otevřít nebo zavřít vyhledávání |
| **↑** **↓**, **Enter** | procházet výsledky, otevřít výsledek |
| **Alt+W** | zavřít záložku |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | další záložka, předchozí záložka |
| klik kolečkem myši | zavřít záložku |
| **Ctrl+A**, **Ctrl+C** | v mřížce vybrat vše, kopírovat zvolené buňky |
| **Ctrl+klik** | sledovat vazbu |
| **Ctrl+Z**, **Ctrl+Y** | vrátit poslední zápis, obnovit ho |
| **Ctrl+Enter** | odeslat komentář, uložit popis |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | v textu: tučné, kurzíva, odkaz |
