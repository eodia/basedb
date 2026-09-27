---
title: Forespørgsler og SQL-views
description: SQL til alle, hver med sine egne tilladelser; gemte forespørgsler under tabellerne, personlige eller delte; rigtige PostgreSQL-views placeret blandt tabellerne.
---

Dine tabeller er rigtige PostgreSQL-tabeller, og brugerfladen forespørger dem i SQL under deres
rigtige navn. Hvert medlem af databasen kan skrive en forespørgsel og **gemme** den under
tabellerne — for sig selv, for hele databasen eller for nogle grupper —, og den, der administrerer
databasen, kan gøre den til et **SQL-view**: et rigtigt PostgreSQL-view, placeret blandt
tabellerne, som `psql` og dine værktøjer også kan læse.

![En gemt forespørgsel, åbnet fra afsnittet »Forespørgsler«; ovenover to SQL-views placeret blandt tabellerne](../../../../assets/screens/requete-sql.png)

## Hver med sine tilladelser

**+** i fanelinjen eller databasens **⋯**-menu → **Ny SQL-forespørgsel** åbner en SQL-fane: en
editor med syntaksfremhævning og autofuldførelse, **Ctrl+Enter** for at køre og resultatet i
samme gitter som dine tabeller. Hvad forespørgslen kan læse, afhænger af, hvem der kører den:

- med niveauet **Administrere** på databasen hele databasen, skrivninger inklusive;
- med niveauerne **Læse** eller **Redigere** køres forespørgslen **skrivebeskyttet med dine
  egne tilladelser**. En tabel, der er lukket for dig, findes ikke for den; et felt, der er
  skjult for dig, forsvinder fra `SELECT *` og afvises, hvis du nævner det, selv hvis du angiver
  tabellen; en skrivning afvises. Resultatet har mærket **Dine tilladelser**.

![Mærket »Dine tilladelser«: forespørgslen ser kun de tabeller og felter, der er åbne for personen](../../../../assets/screens/sql-vos-droits.png)

Det er ikke skærmen, der sorterer fra: PostgreSQL håndhæver selv dine tilladelser, kolonne for
kolonne, på en rolle, der er din egen. En forespørgsel kan altså ikke vise dig noget, som gitteret,
API'et eller MCP-serveren ikke ville vise dig.

## Gem en forespørgsel

**Gem** i fanens værktøjslinje placerer forespørgslen under databasens tabeller i afsnittet
**Forespørgsler**. Den åbnes igen med ét klik; **⋯** → **Gem som…** laver en kopi, og
**Navn og deling…** (i fanen eller i dens menu i sidepanelet) omdøber den, ændrer, hvem der kan
se den, eller sletter den.

![Gem en forespørgsel: dens navn, hvad den viser, og hvem der kan se den](../../../../assets/screens/requete-enregistrer.png)

| Omfang | Hvem kan se den | Hvem kan oprette og redigere den |
|---|---|---|
| **Personlig** — en hængelås | kun dig | alle, der kan se databasen, for sig selv |
| **Hele databasen** | alle, der kan se databasen | niveauet **Administrere** på databasen |
| **Grupper** | medlemmerne af de valgte grupper | niveauet **Administrere** på databasen |

**At dele en forespørgsel deler dens tekst, aldrig det, som dens forfatter kan læse.** Hver
person kører den med sine egne tilladelser: den samme forespørgsel, åbnet af to personer, viser
hver af dem det, de har tilladelse til at se — eller fortæller dem, at en kolonne ikke findes for
dem.

En forespørgsel, der åbnes fra sidepanelet, **køres med det samme, skrivebeskyttet**: du ser dens
resultat uden at have besluttet noget. **Kør** kører den derefter igen, som den er. En prik ved
siden af dens navn viser, at du har ændret dens tekst, siden den blev gemt; **Gem** gemmer den
der, hvis du kan redigere den, og tilbyder ellers at lave en ny.

## SQL-views

Et **SQL-view** er et rigtigt PostgreSQL-view i databasens skema. Det placeres **blandt
tabellerne** med sin farve og sit ikon ligesom en tabel og et lille **øje** til højre, der viser,
at det er et view. Et klik åbner det i en fane: dets rækker i gitteret og **Opdater** for at
læse dem igen.

![Viewet »Factures à encaisser«, åbnet fra sidepanelet](../../../../assets/screens/vue-sql.png)

Det oprettes via databasens **⋯**-menu → **Nyt SQL-view…** eller fra en SQL-fane:
**⋯** → **Opret SQL-view…**, og fanens forespørgsel bliver dets definition. Dialogen beder om:

- dets **etiket** og dets **udseende** — farve, ikon eller billede, valgt som for en tabel;
- dets **tekniske navn**, afledt af etiketten, hvis du ikke angiver et — det, der skrives efter
  `FROM`;
- dets **forespørgsel**: én enkelt `SELECT` på databasens tabeller og andre views. PostgreSQL
  afviser det, den afviser, og editoren peger på stedet.

![Dialogen for et SQL-view: etiket og udseende, teknisk navn, forespørgsel, beskrivelse](../../../../assets/screens/vue-sql-dialogue.png)

Viewet læses derefter under sit navn, fra brugerfladen såvel som fra `psql` eller dit
BI-værktøj:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Et view viser aldrig et felt, man ikke kan se.** Hver person læser det med sine egne
tilladelser på hver tabel og hver kolonne, det læser; sidepanelet viser det kun for dem, der kan
læse alt det, det læser. Det læser kun **sin egen** database: en anden database eller basedbs
katalog afvises allerede ved oprettelsen. At oprette, redigere eller slette det kræver niveauet
**Administrere** på databasen.

### Når strukturen ændres

- **Omdøbning** af en tabel eller et felt ødelægger ikke et view: PostgreSQL følger med.
- **Ændring af formlen** for et beregnet felt, som viewet læser, fjerner det et øjeblik og sætter
  det derefter på den nye kolonne igen. Holder det ikke længere, bliver det markeret som
  **skal rettes** — en trekant viser det i sidepanelet — med sin definition bevaret: **Rediger
  view…**, ret, gem.
- En tabel slettes ikke permanent, så længe et view læser den, og et view slettes ikke, så længe
  et andet view læser det: afvisningen nævner det pågældende view.

## Forespørgsel, SQL-view eller spørgsmål?

| | Hvad det er | Hvor det findes | Til |
|---|---|---|---|
| **Gemt forespørgsel** | en SQL-tekst | under tabellerne, afsnittet »Forespørgsler« | at finde en forespørgsel igen, dele den som tekst |
| **SQL-view** | et rigtigt PostgreSQL-view | blandt tabellerne | at give en læsning et navn, til brugerfladen **og** til `psql`, dine scripts, dine værktøjer |
| **Spørgsmål** | en læsning bygget med musen eller i SQL og dens visualisering | i [dashboards](/basedb/da/fonctionnalites/tableaux-de-bord/) | et tal, et diagram, en krydstabel, under filtre |

## Begrænsninger

- Gitteret viser højst det antal **rækker pr. side**, der er valgt nederst på skærmen; »afkortet«
  viser det. En forespørgsel stopper efter 15 sekunder.
- Et SQL-view læses i SQL og i brugerfladen; REST-API'et og MCP-serveren eksponerer det ikke.
- Et SQL-view bliver i det miljø, hvor det blev oprettet: at oprette et miljø, sammenligne
  strukturen eller gemme en skabelon tager det endnu ikke med.
