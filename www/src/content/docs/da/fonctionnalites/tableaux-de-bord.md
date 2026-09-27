---
title: Dashboards
description: Spørgsmål stillet med musen eller i SQL, femten måder at vise og indstille dem på, dashboards i gitter, i faner, under fælles filtre — læst med hver persons tilladelser og delt via et link.
---

Et **dashboard** samler på én side det, et team kigger på hver dag: de tal, der betyder noget,
deres udvikling måned for måned, fordelingen af en status, de kommende frister. Hvert kort viser
et **spørgsmål** — en læsning af databasen, bygget med musen eller skrevet i SQL — og **filtre**
øverst på siden styrer de kort, der er forbundet med dem.

![Dashboardet »Pilotage de l’agence«: månedens tendens, mål, stablet omsætning, stemningen i anmeldelserne](../../../../assets/screens/tableaux-de-bord.png)

Alt åbnes fra **Dashboards** i blokken for den åbne database nederst i sidepanelet. Til venstre
databasens dashboards og gemte spørgsmål og **Udforsk data** for at stille et spørgsmål uden at
gemme noget. Alle, der kan læse databasen, kan se dem og udforske; at oprette, redigere og gemme
kræver niveauet **Administrere**.

## Stil et spørgsmål med musen

Et spørgsmål bygges i trin, det ene under det andet:

![Editoren for et spørgsmål: data, filtre, opsummering pr. måned](../../../../assets/screens/question-editeur.png)

| Trin | Hvad du vælger |
|---|---|
| **Data** | starttabellen og de kolonner, der vises, når intet opsummeres |
| **Sammenkæd data** | en anden tabel i databasen, forbundet via en relation — foreslået automatisk — eller via to kolonner af samme art; left, inner, right eller full join |
| **Filter** | pr. kolonne, med det, dens type tilbyder: er / er ikke, indeholder, mellem, tom …; for en dato en **periode**: i dag, de seneste 30 dage, denne måned, sidste kvartal, fra … til …; eller et udtryk skrevet som i visningernes værktøjslinje |
| **Opsummer** | mål — antal rækker, sum, gennemsnit, median, minimum, maksimum, unikke værdier, standardafvigelse, akkumulerede værdier — **efter** en til tre kolonner |
| **Sorter**, **Begræns** | rækkefølgen af rækkerne, og hvor mange højst |

En dato grupperes **pr. dag, uge, måned, kvartal eller år** eller efter placering — ugedag, måned
i året, time på dagen; et tal i intervaller. Et flervalg tæller hver række med under hvert af
dens valg. Perioder læses i din tidszone, og ugen begynder på den dag, der er angivet i dine
indstillinger.

**Visualiser** kører spørgsmålet. Resultatet vises på den måde, der passer til det — et tal, en
kurve, søjler, en tabel — og kan ændres nederst på skærmen:

| Visualisering | Til at vise |
|---|---|
| **Tal**, **Tendens**, **Fremskridt**, **Måler** | én værdi; den seneste periode sammenlignet med den foregående og med samme periode sidste år; fremskridtet mod et mål |
| **Søjlediagram**, **Bjælker**, **Linje**, **Område**, **Kombineret** | mål langs en dimension, i serier side om side, stablet eller til 100 % |
| **Cirkel**, **Tragt** | andele, trin |
| **Punktdiagram** | to mål over for hinanden, et tredje som størrelse |
| **Tabel**, **Krydstabel** | rækkerne, der kan sorteres; rækker efter én dimension, kolonner efter en anden, med totaler |
| **Landkort** | Frankrigs regioner eller departementer eller verdens lande, farvet efter en værdi; eller punkter efter breddegrad og længdegrad |

**Indstillinger** bestemmer, hvad der vises, og resultatet kan downloades som **CSV**.

### Tilpas et diagram

| Visualisering | Hvad **Indstillinger** tilbyder |
|---|---|
| **Bjælker, linjer, områder, kombineret** | farve og navn for hver serie; stabling med totalen over stablerne; bjælkernes bredde; udjævnede kurver eller trapper, med eller uden punkter; kategoriernes rækkefølge; aksetitler, inddelinger, etiketternes hældning, grænser, en logaritmisk skala; værdierne på diagrammet; et mål |
| **Cirkel** | en ring og dens tykkelse, en halvcirkel, en rose; totalen i midten; antallet af andele før »Andre«; farve og navn for hver andel; etiketterne på andelene eller ved siden af; forklaringens placering |
| **Tragt** | farve og navn for hvert trin, deres rækkefølge |
| **Tal, tendens, fremskridt, måler** | farven, farver efter værdien, en billedtekst under tallet, sammenligningen — og om et fald er en god nyhed |
| **Tabel, krydstabel** | omdøb og omarranger kolonnerne, bjælker i cellerne, farver efter værdien — pr. celle eller pr. række —, tætheden, rækker pr. side, rækkenumre, totaler |
| **Landkort** | farvetonen, regionernes navne |

For dem alle: talformatet — decimaler, præfiks og suffiks, forkortet til `1,2 k`.

## Udforsk med ét klik

Et klik på en bjælke, et punkt eller en andel åbner det, den repræsenterer:

- **Se disse rækker**: rækkerne bag punktet, filtreret efter det, det repræsenterer;
- **Opdel pr. uge**: en periode åbnet i en finere — et år i sine kvartaler, en måned i sine uger;
- **Fordel efter…**: det samme mål, for dette punkt, efter en anden kolonne;
- **Kun denne værdi**, **Udelad denne værdi**.

Hvert skridt er et selvstændigt spørgsmål, som kan gemmes, hvis du vil; tilbagepilen går til det
forrige skridt. En række i en tabel åbner dens rækkedetaljer.

På et dashboard tilbyder det samme klik også **Filtrer dashboardet: »Lyon«** med antallet af
berørte kort: et **midlertidigt** filter, der aldrig gemmes, vises stiplet i filterlinjen og kan
fjernes med ét klik, og som gælder for hvert kort, hvis spørgsmål læser den samme kolonne — via
sin tabel eller via en sammenkædning. Det tilbydes kun, hvis intet af dashboardets filtre
allerede er forbundet med den kolonne på kortet, og forbliver nedtonet (»eneste kort«), når intet
andet kort læser den. SQL-spørgsmål tager ikke hensyn til det.

## Skriv et spørgsmål i SQL

Et **SQL-spørgsmål** er en `SELECT` på databasens tabeller under deres rigtige navn. Det køres
**skrivebeskyttet med dine egne tilladelser** — for alle, også dem med niveauet Administrere: en
tabel, der er lukket for dig, findes ikke, et skjult felt afvises, og en skrivning er umulig. For
blot at placere en forespørgsel under tabellerne, uden diagram, eller gøre den til et rigtigt
PostgreSQL-view, se [Forespørgsler og SQL-views](/basedb/da/fonctionnalites/requetes-et-vues-sql/).

En **variabel** skrives `{{nom}}`; en del, der skal fjernes, når den ikke har nogen værdi, står
mellem `[[` og `]]`:

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

En variabel er en tekst, et tal, en dato — eller et **kolonnefilter**: `{{periode}}` bliver så
til en hel betingelse på den valgte kolonne, her `echeance`, eller `TRUE`, når intet er valgt.
Det er det, der gør det muligt for et filter på dashboardet at styre et SQL-spørgsmål ligesom de
andre.

## Arranger et dashboard

**Rediger** sætter dashboardet i redigeringstilstand:

- **Spørgsmål** placerer et gemt spørgsmål eller opretter et, der hører til kortet;
- **Titel** og **Tekst** tilføjer en afsnitstitel eller en tekst i Markdown;
- **Indlejret side** viser en `https://`-adresse i en isoleret ramme, som hverken modtager
  session eller data;
- **Fane** fordeler kortene på flere sider; et dobbeltklik omdøber en fane.

Kortene flyttes med deres håndtag og ændrer størrelse fra deres hjørne på et gitter med 24
kolonner. **Gem** gemmer det hele; **Annuller** går tilbage til den tidligere version. I
læsetilstand åbner en korttitel dens spørgsmål til udforskning, dashboardets filtre inklusive.

## Filtrene

**Filter** tilføjer en kontrol øverst på dashboardet: en **dato** (en periode), en
**kategori** (værdier, der kan krydses af), en **tekst**, et **tal** eller en **datogruppering**,
der skifter kurverne fra måned til uge eller år.

Et filter styrer de kort, der er forbundet med det — ét, flere eller alle. Når det oprettes,
forbinder det sig selv med de kolonner, der passer til det; når det er markeret, viser det på
hvert kort den kolonne, det filtrerer, som kan ændres eller fjernes, og **Forbind med alle
kompatible kort** klarer resten. Det kan have en **standardværdi** — for eksempel »I år«.

I læsetilstand kan et klik på et punkt også indstille et filter: **Filtrer efter »Lyon«** på et
kort, hvis kolonne med byer er forbundet med filteret »Ville«.

![Fanen »Activité«: opgaver efter frist stablet efter status, projekttragt, estimerede timer i krydstabel](../../../../assets/screens/tableaux-de-bord-activite.png)

## Copilot

**Copilot** i toppen af afsnittet Dashboards åbner til højre en samtale på naturligt sprog om
databasen: »omsætningen pr. måned«, »tilføj et filter pr. kunde«, »hvorfor falder august?«.
Hvert forslag kommer som et kort, der anvendes med ét klik:

| Forslag | Hvad det gør |
|---|---|
| **Et spørgsmål** | køres og tegnes i samtalen; det åbnes i editoren eller tilføjes dashboardet |
| **Ændringer af dashboardet** eller et nyt dashboard | kort, der tilføjes, ændres eller fjernes, tekster, filtre, der automatisk forbindes med de kort, der har kolonnen, faner, navn — én enkelt gemning, som kan **fortrydes** fra kortet |
| **Værdier til de viste filtre** | »vis mig sidste måned«: filtrene indstilles, intet gemmes |

At stille et spørgsmål eller indstille filtrene er åbent for alle, der kan læse databasen; at
ændre eller oprette et dashboard kræver niveauet **Administrere**.

Som standard sendes **kun strukturen** til AI-udbyderen sammen med samtalen: tabellerne og deres
felter, databasens dashboards og gemte spørgsmål og det viste dashboard — dets faner, dets filtre,
definitionen af dets kort (deres spørgsmål, deres tekster). Hverken rækkerne, kortenes resultater
eller de **værdier, der er valgt i filtrene**, som kan være data: fra et filter sendes kun det
faktum, at det har en værdi. Et felt, der er markeret som usynligt for agenter, sendes ikke, og
det gør spørgsmålet på et kort, der citerer det, heller ikke.

Afkrydsningsfeltet **Tillad læsning af data** tilføjer i samtalen værdierne for de viste filtre og
kortenes resultater under disse filtre (højst 50 rækker pr. læsning, listet under svaret), så tallene
kan kommenteres med belæg. Se [Kunstig intelligens](/basedb/da/fonctionnalites/ia/).

## Del et dashboard

**Del** i toppen af et dashboard er tilgængelig for dem, der har niveauet **Administrere** på
databasen. To veje:

- **Del databasen…** inviterer personer til databasen: de åbner dashboardet i basedb, og hvert
  kort læser med deres egne tilladelser;
- **Opret link** giver et link til **kun** dette dashboard, som ikke kræver nogen tilladelser til
  databasen.

| Linkets adgang | Hvem læser |
|---|---|
| **Offentlig** | alle med linket, uden konto |
| **Indloggede medlemmer** | et medlem af arbejdsområdet efter login — om nødvendigt kun fra bestemte grupper |

Linkets side viser dashboardets faner, filtre og kort **skrivebeskyttet**: ingen udforskning,
ingen adgang til rækkerne, ingen egne spørgsmål. Dens kort læser med **tilladelserne for den
person, der har udgivet linket**, vurderet på ny ved hver læsning: mister personen adgangen til
databasen, bliver linket **sat på pause**. Kontakten **Link aktivt** slår det fra uden at miste
det, og **Generér nyt** gør det gamle ugyldigt.

Markér **Tillad indlejring på et andet websted**: dialogen giver en `<iframe>`-**indlejringskode**
til at vise dashboardet på et intranet eller en wiki. Det er den samme mekanisme som for
[delte visninger](/basedb/da/fonctionnalites/vues-partagees/).

## Hver sine tilladelser

Hvert kort læser **med tilladelserne for den, der kigger**: det samme dashboard viser hver person
det, vedkommende har tilladelse til at se — undtagen via et delingslink, der læser med
tilladelserne for den person, der har udgivet det. Et kort, der handler om en tabel eller et felt, der er lukket for dig, viser
»Utilgængelige data« i stedet for et tal, der ville lyve ved at udelade noget. At gemme et
spørgsmål deler kun spørgsmålet, aldrig det, som dets forfatter kan læse.

## Begrænsninger

- Et spørgsmål returnerer højst 2 000 rækker; en opsummering nøjes næsten altid med det.
- Hvert kort kører sin forespørgsel, når det åbnes, og ved hvert filter, uden cache.
- Kortgrundlagene dækker det europæiske Frankrig (regioner, departementer) og verdens lande.
  Kilde: IGN, Admin Express (Licence ouverte); Natural Earth.
