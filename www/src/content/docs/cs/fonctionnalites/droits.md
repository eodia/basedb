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
| **Čtení** | vidět řádky a komentovat je, vytvářet si osobní zobrazení, prohlížet strukturu a řídicí panely, klást vlastní otázky, psát SQL jen pro čtení a ukládat své osobní dotazy |
| **Úpravy** | navíc vytvářet, upravovat a odstraňovat řádky |
| **Správa** | navíc měnit strukturu, vytvářet sdílená zobrazení, řídicí panely a uložené otázky, sdílet řídicí panel odkazem, sdílet dotazy, vytvářet pohledy SQL, automatizace, integrace a tokeny; její SQL má přístup k celé databázi včetně zápisů |

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

## A co SQL?

V rozhraní se SQL řídí stejnými oprávněními, která uplatňuje sám PostgreSQL: bez úrovně
Správa se dotaz provede jen pro čtení, pod rolí vlastní dané osobě, kde uzavřená tabulka
neexistuje a skryté pole je odmítnuto. [Pohled SQL](/basedb/cs/fonctionnalites/requetes-et-vues-sql/)
se čte s oprávněními toho, kdo ho čte, a sdílení dotazu sdílí jen jeho text.

**Přímý přístup přes `psql`** k databázi však basedb neřídí: čte vše, včetně skrytých polí.
Omezení chrání přístupové cesty produktu – rozhraní, API, MCP –, nikdy ne před někým, kdo má
k databázi přístup přes SQL; takové přístupy se řídí pomocí `GRANT` v PostgreSQL, které
nastavuje provozovatel.

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
