---
title: Visninger
description: Gitter, kanban, kalender, tidslinje, galleri, liste, formular og spørgeskema — fælles eller personlige.
---

En tabel kan vises på **otte måder**. En visning kopierer ingen data og giver ingen flere
tilladelser end selve tabellen.

:::note
Disse visninger er måder at vise **én** tabel på. Et [SQL-view](/basedb/da/fonctionnalites/requetes-et-vues-sql/)
er noget andet: et rigtigt PostgreSQL-view, skrevet i SQL oven på databasens tabeller og
placeret blandt dem i sidepanelet.
:::

| Visning | Hvad den viser | Hvad den kræver |
|---|---|---|
| **Gitter** | rækker, filtreret, sorteret, grupperet, med valgte kolonner | — |
| **Kanban** | kort i kolonner | et enkeltvalg |
| **Kalender** | rækker på deres dato, pr. måned eller pr. uge | et datofelt |
| **Tidslinje** | bjælker mellem to datoer og deres afhængigheder | en startdato |
| **Galleri** | kort med et forsidebillede | — |
| **Liste** | én linje pr. række, i grupper, der kan foldes sammen | — |
| **Formular** | en side med spørgsmål til at oprette en række | — |
| **Spørgeskema** | de samme spørgsmål, ét pr. skærm | — |

## Visningsvælgeren

Den sidder til venstre for »Filtrer«. »Alle rækker« er tabellens gitter, som ingen har gemt, og
som ingen kan slette; derefter kommer de **fælles visninger** i den rækkefølge, som den, der
bygger databasen, har valgt, og til sidst **Mine visninger**.

- En **fælles visning** ses af alle. At oprette, konfigurere, omdøbe, omarrangere eller slette
  den kræver niveauet **Administrere**. Den kan **låses**: en hængelås viser det, og ingen kan
  ændre den, før den er låst op igen.
- En **personlig visning** ses kun af dig og kræver kun, at du kan læse tabellen.
  **Opret personlig visning**, eller **Gem som visning** efter at have filtreret og sorteret:
  hver person gemmer sine egne måder at læse på uden at ændre noget for de andre. **Dupliker**
  laver en personlig kopi af en fælles visning.

![Et galleri med kunder](../../../../assets/screens/galerie.png)

## Værktøjslinjen

Over gitteret, i denne rækkefølge:

- **Filtrer** kombinerer betingelser pr. felt;
- **Kolonner** vælger, hvad der vises — systemkolonnerne ligger for sig under
  »Systemoplysninger«;
- **Grupper** samler rækkerne efter et felt med én værdi — enkeltvalg, relation, person, dato,
  tal, tekst, afkrydsningsfelt … — i grupper, der kan foldes sammen, hver med sit antal på tværs
  af hele filteret;
- **Farver** farver rækkerne efter et enkeltvalg eller efter **regler** — et filter og en farve,
  højst tyve — som streg, som baggrund eller begge dele;
- **Rækkehøjde**: lav, mellem, høj, meget høj;
- **Søg…** til højre søger i alle kolonner, mens du skriver; Esc rydder søgningen. Den gælder
  også for kanban, kalender, tidslinje, galleri og liste og gemmes aldrig i visningen.

Under hver kolonne vises en **Opsummering**, beregnet på alle rækker i filteret, ikke kun på
siden: udfyldte, tomme, unikke værdier, sum, gennemsnit, minimum, maksimum, afkrydsede felter.

## Kanban, kalender, tidslinje

- **Kanban** sorterer kortene efter et enkeltvalg; når du trækker et kort, ændres rækken, og et
  »+« øverst i en kolonne opretter en række, der allerede har det valg. Hvert kort viser en
  titel, et forsidebillede, de valgte felter og en **beskrivelse**, der citerer rækkens
  værdier — »Levering planlagt den `{{Date}}` til `{{Client}}`« —, skrevet i visningens
  indstillinger med knappen **Indsæt felt**.
- **Kalenderen** placerer hver række på sin dato, eventuelt med en slutdato; når du trækker en
  række fra én dag til en anden, flyttes den.
- **Tidslinjen** tegner bjælker mellem en startdato og en slutdato, grupperet efter et
  enkeltvalg eller en relation. Med indstillingen **Afhænger af** — en relation fra tabellen
  til sig selv — forbinder en pil hver opgave med dem, den afhænger af, rød når den går
  tilbage i tiden.

![En tidslinje med dens afhængigheder](../../../../assets/screens/chronologie.png)

![En kalender efter forfaldsdato](../../../../assets/screens/calendrier.png)

## Galleri og liste

- **Galleriet** viser kort: et **forsidebillede** (beskåret eller helt), en størrelse (små,
  mellemstore, store kort) og en farve efter et enkeltvalg.
- **Listen** viser én linje pr. række, **grupperet** efter et enkeltvalg, en relation eller en
  person.

![En liste med kunder, grupperet efter branche](../../../../assets/screens/liste.png)

I kanban, galleri og liste kan kort og rækker **sorteres manuelt** ved at trække dem — op til
5 000; en valgt sortering har forrang for denne rækkefølge.

## Formular og spørgeskema

Du markerer spørgsmålene og sætter dem i rækkefølge; hvert spørgsmål har en overskrift, en
hjælpetekst, et eksempelsvar og kan gøres påkrævet. Formularen har sin titel, sin
introduktion, teksten på sin knap og sin takkebesked. Den udfyldes i basedb eller
[deles via et link](/basedb/da/fonctionnalites/formulaires-partages/).

Der er intet at indstille for at komme i gang: en ny formular spørger om det, en person
svarer — ikke status, den tildelte person eller relationerne, som teamet udfylder senere,
medmindre de er påkrævede —, bærer farven fra sin tabel og et lyst tema, og hvert tomt felt
viser et passende eksempel. Alt andet ændrer du, når du vil:

- **Udseende**: otte temaer — Lyst, Blid, Daggry, Hav, Skov, Nat, Papir, Minimal —,
  en accentfarve, en skrifttype, en justering til venstre eller centreret;
- **Spørg kun hvis…**: et spørgsmål stilles kun, hvis et tidligere svar kræver det (»Sentiment
  er Negativ«, »Bedømmelse er højst 2«). Et skjult spørgsmål er hverken påkrævet eller sendt;
- **Flere indstillinger**: knapperne til velkomst og afsendelse, nummereringen,
  fremdriftslinjen, det automatiske skift til næste, beskeden og en slutknap (»Tilbage til
  sitet«), konfetti.

**Spørgeskemaet** fylder hele skærmen: en velkomst, der siger, hvor lang tid det tager,
derefter ét spørgsmål ad gangen, som glider ind. Alt kan også gøres med tastaturet: **Enter**
for at fortsætte, bogstaverne **A**, **B**, **C**… for et valg, **J** eller **N** for ja eller
nej, tallene for en bedømmelse — et enkelt valg går alene videre til næste spørgsmål.
Afsendelsen fejres: et flueben, der tegner sig, og konfetti i formularens farver.

## Del en visning

En datavisning — gitter, kanban, kalender, tidslinje, galleri, liste — kan **deles skrivebeskyttet**
via et link og indlejres på et andet websted, og en kalender bliver et kalenderfeed. Se
[Delte visninger](/basedb/da/fonctionnalites/vues-partagees/).

## Hvad læseren ikke ser

En visning **tilpasses sin læser**: et felt, der er skjult for læseren, forsvinder fra
kolonnerne, kortene og spørgsmålene. En visning, hvis filter citerer et skjult felt, vises slet
ikke: vist uden sit filter ville den vise mere, end den blev lavet til at vise.
