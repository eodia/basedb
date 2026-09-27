---
title: Behörigheter och grupper
description: Konton, grupper, åtkomstnivåer per projekt, databas och tabell, begränsningar per fält och dina inställningar.
---

Behörigheter ges till **grupper**, aldrig till personer en och en. En nivå som sätts på ett
projekt, en databas eller en tabell gäller för allt som ligger under, även det som skapas
senare.

## De fyra nivåerna

| Nivå | Tillåter |
|---|---|
| **Ingen åtkomst** | ingenting: resursen är osynlig |
| **Läsa** | se raderna, kommentera dem, skapa egna personliga vyer, visa strukturen och instrumentpanelerna, ställa egna frågor, skriva skrivskyddad SQL och spara sina personliga frågor |
| **Redigera** | och dessutom skapa, ändra och ta bort rader |
| **Hantera** | och dessutom ändra strukturen, skapa gemensamma vyer, instrumentpaneler och sparade frågor, dela en instrumentpanel via en länk, dela frågor, skapa SQL-vyer, automatiseringar, integrationer och tokens; SQL på den nivån når hela databasen, skrivningar inräknade |

Behörigheterna **läggs ihop**: en person får den högsta nivå som någon av hens grupper ger. Att
ge en tabell mindre än dess databas gör den ”granulär”.

Två grupper finns alltid: **Administratörer**, som hanterar allt, och **Alla användare**, som
varje konto ingår i – det som ges till den gruppen har alla.

## Ända ned till fältet

Under rutnätet med nivåer döljer **Fält** en kolumn för en grupp, eller gör den oredigerbar för
gruppen. Skärmen visar också vad en viss person faktiskt ser, och via vilken grupp.

Ett dolt fält saknas överallt: i rutnätet, vyerna, API:et, MCP, historiken, den SQL som skrivs i
gränssnittet och SQL-vyerna. Att filtrera eller sortera på det ger samma svar som för ett fält
som inte finns.

## Och SQL?

I gränssnittet följer SQL samma behörigheter, som tillämpas av PostgreSQL själv: utan nivån
Hantera körs en fråga skrivskyddat, på en roll som är personens egen, där en stängd tabell inte
finns och ett dolt fält avvisas. En [SQL-vy](/basedb/sv/fonctionnalites/requetes-et-vues-sql/)
läses med behörigheterna hos den som läser den, och att dela en fråga delar bara dess text.

Direkt **`psql`-åtkomst** till databasen styrs däremot inte av basedb: den läser allt, dolda
fält inräknade. Begränsningarna skyddar produktens ytor – gränssnitt, API, MCP –, aldrig mot
någon som har SQL-åtkomst till databasen; sådan åtkomst regleras med PostgreSQL-`GRANT`, som
driftansvarig sätter.

## Konton och inloggning

- Ett konto skapas med ett **tillfälligt lösenord**, som visas en gång och måste bytas vid första
  inloggningen.
- Inloggning sker med lösenord eller via en **OpenID Connect**-leverantör som driftansvarig har
  angett.
- Administrativa åtgärder kräver en **förhöjd session**: ett lösenord som har skrivits in på nytt
  under de senaste fem minuterna.
- Sessioner kan återkallas; att återkalla en session gör genast dess åtkomsttokens ogiltiga.

## Dina inställningar

**Inställningar**, i profilmenyn längst ned till vänster, gäller bara dig:

| Flik | Vad du gör där |
|---|---|
| **Profil** | visningsnamnet; inloggningsadressen; de identitetsleverantörer som är kopplade till kontot, att koppla eller koppla bort |
| **Säkerhet** | byta lösenord; de öppna sessionerna, att stänga en i taget eller alla |
| **Utseende** | gränssnittets språk; temat; datumordningen – `25/09/2026` eller `2026-09-25` – och kalendrarnas första veckodag |
| **Aviseringar** | de typer av aviseringar som du inte längre vill ha |
| **Tokens** | de integrationstokens du har skapat, i alla dina databaser, när de senast användes, och återkallelse av dem |

basedb talar **tjugo språk**: franska, engelska, tyska, spanska, italienska, portugisiska
(Brasilien), nederländska, polska, tjeckiska, svenska, danska, norska, finska, rumänska,
ungerska, turkiska, ukrainska, japanska, förenklad kinesiska och koreanska. Som standard använder
gränssnittet webbläsarens språk; **Språk**, under **Utseende**, väljer ett annat. Tal och datum
följer det valda språket.

Temat hör till webbläsaren; språket, datumordningen och veckans första dag följer dig från en
dator till en annan. Att byta adress eller koppla en leverantör kräver en förhöjd session; ett
konto utan lösenord, som loggar in via en leverantör, behåller den leverantörens adress.

## Den enda tillämpningspunkten

Alla ytor – gränssnitt, API, MCP, delade formulär och vyer, automatiseringar – går via samma
beslutspunkt för behörigheter, i kärnan. Det finns ingen privat väg för gränssnittet: det som
skärmen inte visar är det som API:et inte har returnerat.

Det omvända gäller också: skärmen **erbjuder inte det som skulle avvisas**. Utan nivån Hantera
kan Struktur-skärmen visas utan knappar eller pennor, och importen erbjuder inte att skapa en
tabell; utan rätt att skapa eller ta bort rader erbjuder rutnätet varken en rad för att lägga
till eller ”Ta bort”.
