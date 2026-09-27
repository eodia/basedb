---
title: Visninger
description: Rutenett, kanban, kalender, tidslinje, galleri, liste, skjema og spørreundersøkelse – felles eller personlige.
---

En tabell kan vises på **åtte måter**. En visning kopierer ingen data, og gir ingen tillatelser
utover dem tabellen selv gir.

:::note
Disse visningene er måter å vise **én** tabell på. En [SQL-visning](/basedb/nb/fonctionnalites/requetes-et-vues-sql/)
er noe annet: en ekte PostgreSQL-visning, skrevet i SQL mot tabellene i databasen og plassert blant
dem i sidepanelet.
:::

| Visning | Hva den viser | Hva den trenger |
|---|---|---|
| **Rutenett** | rader, filtrert, sortert, gruppert, med utvalgte kolonner | – |
| **Kanban** | kort i kolonner | et enkeltvalgfelt |
| **Kalender** | rader på datoen sin, per måned eller per uke | et datofelt |
| **Tidslinje** | stolper mellom to datoer, og avhengighetene mellom dem | en startdato |
| **Galleri** | kort, med et forsidebilde | – |
| **Liste** | én linje per post, i sammenleggbare grupper | – |
| **Skjema** | en side med spørsmål for å opprette en rad | – |
| **Spørreundersøkelse** | de samme spørsmålene, ett per skjermbilde | – |

## Visningsvelgeren

Den står til venstre for «Filtrer». «Alle rader» er tabellens rutenett, som ingen
har lagret og ingen kan slette; deretter kommer de **felles visningene**, i
rekkefølgen den som bygger databasen har valgt, og så **Mine visninger**.

- En **felles visning** ses av alle. Å opprette, konfigurere, gi nytt navn til,
  endre rekkefølgen på eller slette den krever nivået **Administrere**. Den kan være **låst**: en
  hengelås viser det, og ingen kan endre den før den er låst opp.
- En **personlig visning** ses bare av deg, og krever bare at du kan lese tabellen.
  **Opprett personlig visning**, eller **Lagre som visning** etter at du har filtrert og sortert:
  hver enkelt tar vare på sine egne måter å lese på, uten å endre noe for andre. **Dupliser** på en
  felles visning lager en personlig kopi.

![Et galleri med kunder](../../../../assets/screens/galerie.png)

## Verktøylinjen

Over rutenettet, i denne rekkefølgen:

- **Filtrer** kombinerer betingelser per felt;
- **Kolonner** velger hva som vises – systemkolonnene står for seg, under
  «Systeminformasjon»;
- **Grupper** ordner radene etter et felt med én verdi – enkeltvalg, relasjon,
  person, dato, tall, tekst, avmerkingsboks … – i sammenleggbare grupper, hver med sitt
  antall for hele filteret;
- **Farger** fargelegger radene etter et enkeltvalgfelt, eller etter **regler** – et filter og
  en farge, høyst tjue – som strek, bakgrunn eller begge deler;
- **Radhøyde**: lav, middels, høy, svært høy;
- **Søk…**, til høyre, søker i alle kolonnene mens du skriver; Esc
  tømmer søket. Det gjelder også for kanban, kalender, tidslinje, galleri
  og liste, og lagres aldri i visningen.

Under hver kolonne et **Sammendrag** som beregnes på alle radene i filteret, ikke bare på
siden: utfylte, tomme, unike verdier, sum, gjennomsnitt, minimum, maksimum, avkryssede bokser.

## Kanban, kalender, tidslinje

- **Kanban** ordner kortene etter et enkeltvalgfelt; å dra et kort endrer raden,
  og en «+» øverst i en kolonne oppretter en rad som allerede har det valget. Hvert kort viser en
  tittel, et forsidebilde, de valgte feltene og en **beskrivelse** som refererer til
  verdiene i raden – «Levering planlagt `{{Date}}` for `{{Client}}`» –, skrevet i
  visningens innstillinger med knappen **Sett inn felt**.
- **Kalenderen** plasserer hver rad på datoen sin, eventuelt med en sluttdato; å dra en
  rad fra én dag til en annen flytter den.
- **Tidslinjen** tegner stolper mellom en startdato og en sluttdato, gruppert etter
  et enkeltvalgfelt eller en relasjon. Med innstillingen **Avhenger av** – en relasjon fra tabellen
  til seg selv – kobler en pil hver oppgave til dem den avhenger av, rød når den
  går bakover i tid.

![En tidslinje med avhengigheter](../../../../assets/screens/chronologie.png)

![En kalender etter forfallsdato](../../../../assets/screens/calendrier.png)

## Galleri og liste

- **Galleriet** viser kort: et **forsidebilde** (beskåret eller helt), en
  størrelse (små, middels, store kort), en farge etter et enkeltvalgfelt.
- **Listen** viser én linje per post, **gruppert** etter et enkeltvalgfelt, en
  relasjon eller en person.

![En liste med kunder, gruppert etter bransje](../../../../assets/screens/liste.png)

I kanban, galleri og liste kan kortene og linjene **ordnes for hånd** ved å
dra dem – opptil 5 000; en valgt sortering går foran denne rekkefølgen.

## Skjema og spørreundersøkelse

Du krysser av for spørsmålene og ordner dem; hvert av dem har en tekst, en hjelpetekst og kan gjøres
obligatorisk. Skjemaet har sin tittel, sin innledning, teksten på knappen og takkemeldingen
sin. Det fylles ut i basedb, eller [deles med en lenke](/basedb/nb/fonctionnalites/formulaires-partages/).

## Del en visning

En datavisning – rutenett, kanban, kalender, tidslinje, galleri, liste – kan **deles
skrivebeskyttet** med en lenke, bygges inn på et annet nettsted, og en kalender kan bli en
kalenderstrøm. Se [Delte visninger](/basedb/nb/fonctionnalites/vues-partagees/).

## Det leseren ikke ser

En visning **tilpasses på nytt for hver leser**: et felt som er skjult for leseren, forsvinner fra
kolonnene, kortene og spørsmålene. En visning der filteret refererer til et skjult felt, vises
ikke i det hele tatt: vist uten filteret ville den vise mer enn den ble laget for å
vise.
