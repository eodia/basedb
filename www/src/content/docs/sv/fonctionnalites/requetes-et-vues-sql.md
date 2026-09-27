---
title: SQL-frågor och SQL-vyer
description: SQL för alla, med egna behörigheter; sparade frågor under tabellerna, personliga eller delade; riktiga PostgreSQL-vyer placerade bland tabellerna.
---

Dina tabeller är riktiga PostgreSQL-tabeller, och gränssnittet frågar dem i SQL, under deras
riktiga namn. Varje medlem i databasen kan skriva en fråga och **spara** den under tabellerna –
för sig själv, för hela databasen eller för några grupper –, och den som hanterar databasen kan
göra en **SQL-vy** av den: en riktig PostgreSQL-vy, placerad bland tabellerna, som `psql` och
dina verktyg också läser.

![En sparad fråga, öppnad från avsnittet ”Frågor”; ovanför, två SQL-vyer placerade bland tabellerna](../../../../assets/screens/requete-sql.png)

## Var och en med sina behörigheter

**+** i flikfältet, eller databasens **⋯**-meny → **Ny SQL-fråga**, öppnar en SQL-flik: en
redigerare med syntaxfärgning och komplettering, **Ctrl+Enter** för att köra och resultatet i
samma rutnät som dina tabeller. Vad frågan kan läsa beror på vem som kör den:

- med nivån **Hantera** på databasen: hela databasen, skrivningar inräknade;
- med nivåerna **Läsa** eller **Redigera** körs frågan **skrivskyddat, med dina egna
  behörigheter**. En tabell som är stängd för dig finns inte för den; ett fält som är dolt för
  dig försvinner ur `SELECT *` och avvisas om du namnger det, även om du anger tabellen; en
  skrivning avvisas. Resultatet har etiketten **Dina behörigheter**.

![Etiketten ”Dina behörigheter”: frågan ser bara de tabeller och fält som är öppna för personen](../../../../assets/screens/sql-vos-droits.png)

Det är inte skärmen som sållar: PostgreSQL själv tillämpar dina behörigheter, kolumn för kolumn,
på en roll som är din egen. En fråga kan alltså inte visa dig något som rutnätet, API:et eller
MCP-servern inte skulle visa dig.

## Spara en fråga

**Spara**, i flikens verktygsfält, placerar frågan under databasens tabeller, i avsnittet
**Frågor**. Den öppnas igen med ett klick; **⋯** → **Spara som…** gör en kopia, och **Namn och
delning…** (i fliken eller i dess meny i sidofältet) byter namn på den, ändrar vem som ser den
eller tar bort den.

![Spara en fråga: dess namn, vad den visar och vem som ser den](../../../../assets/screens/requete-enregistrer.png)

| Omfattning | Vem ser den | Vem kan skapa och ändra den |
|---|---|---|
| **Personlig** – ett hänglås | bara du | alla som ser databasen, för sig själva |
| **Hela databasen** | alla som ser databasen | nivån **Hantera** på databasen |
| **Grupper** | medlemmarna i de valda grupperna | nivån **Hantera** på databasen |

**Att dela en fråga delar dess text, aldrig det som dess författare kan läsa.** Var och en kör
den med sina egna behörigheter: samma fråga, öppnad av två personer, visar var och en det hen
har rätt att se – eller säger att en kolumn inte finns för hen.

En fråga som öppnas från sidofältet **körs genast, skrivskyddat**: du ser resultatet utan att ha
bestämt något. **Kör** kör den sedan igen som den är. En punkt bredvid namnet visar att du har
ändrat texten sedan den sparades; **Spara** sparar ändringen om du får redigera frågan, och
föreslår annars att du gör en ny.

## SQL-vyerna

En **SQL-vy** är en riktig PostgreSQL-vy i databasens schema. Den placeras **bland tabellerna**,
med sin färg och sin ikon precis som en tabell, och ett litet **öga** till höger som visar att
det är en vy. Ett klick öppnar den i en flik: dess rader i rutnätet, och **Uppdatera** för att
läsa dem igen.

![Vyn ”Factures à encaisser”, öppnad från sidofältet](../../../../assets/screens/vue-sql.png)

Den skapas via databasens **⋯**-meny → **Ny SQL-vy…**, eller från en SQL-flik: **⋯** →
**Skapa SQL-vy…**, och flikens fråga blir dess definition. Dialogen frågar efter:

- dess **etikett** och dess **utseende** – färg, ikon eller bild, som väljs som för en tabell;
- dess **tekniska namn**, som härleds från etiketten om du inte anger något – det som skrivs
  efter `FROM`;
- dess **fråga**: en enda `SELECT`, mot tabellerna och de andra vyerna i databasen. PostgreSQL
  avvisar det som det avvisar, och redigeraren pekar ut stället.

![Dialogen för en SQL-vy: etikett och utseende, tekniskt namn, fråga, beskrivning](../../../../assets/screens/vue-sql-dialogue.png)

Vyn läses sedan under sitt namn, från gränssnittet lika väl som från `psql` eller ditt BI-verktyg:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**En vy visar aldrig ett fält som du inte ser.** Var och en läser den med sina egna behörigheter,
för varje tabell och varje kolumn som den läser; sidofältet listar den bara för den som får läsa
allt den läser. Den läser bara **sin egen** databas: en annan databas, eller basedbs katalog,
avvisas redan när vyn skapas. Att skapa, ändra eller ta bort den kräver nivån **Hantera** på
databasen.

### När strukturen ändras

- **Byta namn** på en tabell eller ett fält förstör inte en vy: PostgreSQL följer med.
- **Ändra formeln** för ett beräknat fält som vyn läser tar bort vyn en kort stund och lägger
  sedan tillbaka den på den nya kolumnen. Håller den inte längre **behöver den åtgärdas** – en
  triangel visar det i sidofältet – och dess definition behålls: **Redigera vyn…**, rätta, spara.
- En tabell rensas inte så länge en vy läser den, och en vy tas inte bort så länge en annan vy
  läser den: avslaget namnger vyn det gäller.

## Sparad fråga, SQL-vy eller fråga i en instrumentpanel?

| | Vad det är | Var den finns | Till vad |
|---|---|---|---|
| **Sparad fråga** | en SQL-text | under tabellerna, i avsnittet ”Frågor” | hitta en fråga igen, dela den som text |
| **SQL-vy** | en riktig PostgreSQL-vy | bland tabellerna | ge en läsning ett namn, för gränssnittet **och** för `psql`, dina skript, dina verktyg |
| **Fråga** | en läsning byggd med musen eller i SQL, och dess visualisering | i [instrumentpanelerna](/basedb/sv/fonctionnalites/tableaux-de-bord/) | en siffra, ett diagram, en pivottabell, under filter |

## Begränsningar

- Rutnätet visar högst det antal **rader per sida** som valts längst ned på skärmen; ”avkortat”
  visar det. En fråga avbryts efter 15 sekunder.
- En SQL-vy läses i SQL och i gränssnittet; REST-API:et och MCP-servern exponerar den inte.
- En SQL-vy stannar i den miljö där den skapades: att skapa en miljö, jämföra strukturen eller
  spara en mall tar ännu inte med den.
