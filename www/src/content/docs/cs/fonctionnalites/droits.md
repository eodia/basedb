---
title: Oprávnění a skupiny
description: Účty, skupiny, úrovně přístupu podle projektu, databáze a tabulky, omezení podle polí a vaše nastavení.
---

Oprávnění se udělují **skupinám**, nikdy jednotlivým osobám. Úroveň nastavená na projekt,
databázi nebo tabulku platí pro vše, co je pod ní, včetně toho, co bude vytvořeno
později.

## Čtyři úrovně

| Úroveň | Umožňuje |
|---|---|
| **Bez přístupu** | nic: prostředek je neviditelný |
| **Čtení** | vidět řádky a komentovat je, vytvářet si osobní zobrazení, prohlížet strukturu a řídicí panely, klást a ukládat vlastní otázky, psát SQL jen pro čtení a ukládat své osobní dotazy |
| **Úpravy** | navíc vytvářet, upravovat a odstraňovat řádky |
| **Správa** | navíc měnit strukturu, vytvářet sdílená zobrazení a řídicí panely, sdílet řídicí panel odkazem, sdílet otázky a dotazy, vytvářet pohledy SQL, automatizace, integrace a tokeny; její SQL má přístup k celé databázi včetně zápisů |

Oprávnění **se sčítají**: osoba dostane nejvyšší úroveň, kterou jí dává některá z jejích
skupin. Když tabulce dáte méně než její databázi, stane se „granulární“.

Vždy existují dvě skupiny: **Správci**, kteří spravují vše, a **Všichni uživatelé**, jejichž
součástí je každý účet – co udělíte této skupině, má každý.

## Až na úroveň pole

Pod mřížkou úrovní **Pole** skryje sloupec před skupinou nebo ho pro ni nastaví jako
neupravitelný. Obrazovka také ukazuje, co konkrétní osoba skutečně vidí a díky které skupině.

Skryté pole chybí všude: v mřížce, v zobrazeních, v API, v MCP, v historii, v SQL psaném
v rozhraní i v pohledech SQL. Filtrování nebo řazení podle něj se chová jako u pole, které
neexistuje.

## Až na úroveň řádku

Vedle **Pole** ukazuje **Řádky** skupině jen některé řádky tabulky: ty, které zachytí filtr,
napsaný stejně jako filtr zobrazení. `@me` označuje přihlášenou osobu:

- `commercial eq @me` — každý obchodník vidí jen své klienty;
- `region in ["nord", "est"]` — tým vidí jen své regiony;
- `_created_by eq @me` — každý vidí jen to, co vytvořil.

Oprávnění se sčítají: osoba vidí řádky všech svých skupin, a skupina bez pravidla vidí
všechny. Kdo správuje strukturu tabulky — úroveň Správa — vidí vždy vše. Obrazovka říká,
kolik řádků vidí daná osoba a díky které skupině.

Řádek mimo své pravidlo pro danou osobu neexistuje: ani ve zobrazeních, v řídicích panelech,
ve vyhledávání, v API, v MCP ani v historii, ani k úpravě, odstranění nebo propojení. Řádek,
který vytvoří, musí patřit mezi její řádky; při úpravě řádku ho naopak může vyřadit ze svého
rozsahu — úkol předaný kolegovi. Odpovědi na
[sdílené formuláře](/basedb/cs/fonctionnalites/formulaires-partages/) vždy dorazí.

## A co SQL?

V rozhraní se SQL řídí stejnými oprávněními, která uplatňuje sám PostgreSQL: bez úrovně
Správa se dotaz provede jen pro čtení, pod rolí vlastní dané osobě, kde uzavřená tabulka
neexistuje, skryté pole je odmítnuto a čtou se jen její řádky, ať je tabulka jmenovaná
samotná, nebo se svým schématem. [Pohled SQL](/basedb/cs/fonctionnalites/requetes-et-vues-sql/)
se čte s oprávněními toho, kdo ho čte, a sdílení dotazu sdílí jen jeho text.

**Přímý přístup přes `psql`** k databázi však basedb neřídí: čte vše, včetně skrytých polí.
Omezení chrání přístupové cesty produktu – rozhraní, API, MCP –, nikdy ne před někým, kdo má
k databázi přístup přes SQL; takové přístupy se řídí pomocí `GRANT` v PostgreSQL, které
nastavuje provozovatel. Tabulka, která nese pravidlo pro řádky, má zapnuté zabezpečení
PostgreSQL na úrovni řádků: role vytvořená pro nástroj třetí strany v ní nevidí žádný řádek,
pokud nemá atribut `BYPASSRLS` nebo svou vlastní politiku.

## Účty a přihlášení

- Účet se vytváří s **dočasným heslem**, které se zobrazí jednou a při prvním přihlášení je
  nutné ho změnit.
- Přihlašuje se heslem nebo přes poskytovatele **OpenID Connect**, kterého nastavil
  provozovatel.
- Akce administrace vyžadují **privilegovanou relaci**: heslo znovu zadané během posledních
  pěti minut.
- Relace lze odvolat; odvolání relace okamžitě zneplatní její přístupové tokeny.

## Vaše nastavení

**Nastavení** v nabídce profilu vlevo dole se týká jen vás:

| Záložka | Co zde uděláte |
|---|---|
| **Profil** | zobrazované jméno; přihlašovací adresa; poskytovatelé identity propojení s účtem, které lze propojit nebo odpojit |
| **Zabezpečení** | změna hesla; otevřené relace, které lze ukončit jednotlivě nebo všechny najednou |
| **Vzhled** | jazyk rozhraní; motiv; pořadí data – `25/09/2026` nebo `2026-09-25` – a první den týdne v kalendářích |
| **Oznámení** | druhy oznámení, které už nechcete dostávat |
| **Tokeny** | integrační tokeny, které jste vytvořili ve všech svých databázích, jejich poslední použití a jejich odvolání |

basedb umí **dvacet jazyků**: francouzštinu, angličtinu, němčinu, španělštinu, italštinu,
portugalštinu (Brazílie), nizozemštinu, polštinu, češtinu, švédštinu, dánštinu, norštinu,
finštinu, rumunštinu, maďarštinu, turečtinu, ukrajinštinu, japonštinu, zjednodušenou čínštinu
a korejštinu. Ve výchozím nastavení rozhraní převezme jazyk vašeho prohlížeče; **Jazyk** na
záložce **Vzhled** nastaví jiný. Čísla a data se řídí zvoleným jazykem.

Jazyk si může vyžádat i odkaz: `?lang=de` na konci adresy basedb zobrazí v němčině přihlašovací
obrazovku, formulář, sdílené zobrazení nebo sdílený řídicí panel. Takto vede web k demoverzi
v jazyce dané stránky. Po přihlášení basedb sleduje váš účet: zvolený jazyk v **Vzhled**, jinak
jazyk prohlížeče.

Motiv zůstává vázaný na prohlížeč; jazyk, pořadí data a první den týdne vás provázejí
z jednoho počítače na druhý. Změna adresy nebo propojení poskytovatele vyžaduje privilegovanou
relaci; účet bez hesla, který se přihlašuje přes poskytovatele, si ponechává adresu tohoto
poskytovatele.

## Jediný bod vynucování

Všechny přístupové cesty – rozhraní, API, MCP, sdílené formuláře a zobrazení, automatizace –
procházejí stejným rozhodovacím bodem oprávnění v jádře. Neexistuje žádná soukromá cesta
rozhraní: co obrazovka nezobrazí, to API nevrátilo.

Platí to i obráceně: obrazovka **nenabízí to, co by bylo odmítnuto**. Bez úrovně Správa lze
obrazovku Struktura jen prohlížet, bez tlačítek a bez tužky, a import nenabízí vytvoření
tabulky; bez oprávnění vytvářet nebo odstraňovat řádky mřížka nenabízí ani řádek pro
přidání, ani „Odstranit“.
