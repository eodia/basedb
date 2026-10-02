---
title: Automatiseringer
description: Når en rad endres, kommer inn i et filter eller forsvinner, når en dato kommer, på et fast tidspunkt, med ett klikk eller et kall – endre, opprette, finne, telle, gjenta, forgrene, vente, prøve, spørre KI, lage en PDF, varsle, sende e-post, kalle en tjeneste.
---

En automatisering sier **når**, **hvis** og **så**: når en oppgave går over til «Fait», notere
klokkeslettet; når en negativ tilbakemelding kommer inn, varsle den ansvarlige og skrive i Slack; hver
mandag kl. 9 opprette raden for teammøtet. Og når én handling ikke er nok, følger den en
**flyt**: finne en rad, ta én gren eller en annen ut fra hva den inneholder, gjenta trinn
på hver rad som samsvarer med et filter, gjenbruke i ett trinn det et tidligere trinn har
funnet eller skrevet, **vente** tre dager før en purring, sende en **PDF** som vedlegg.

De åpnes fra **Automatiseringer**, i blokken for den åpne databasen nederst i
sidepanelet, og krever nivået **Administrere**.

![En flyt og en av kjøringene, lagt oppå den](../../../../assets/screens/nb/automatisations.webp)

## Flyten

Flyten tegnes ovenfra og ned: utløseren, deretter hvert trinn. En **+** på en linje
åpner listen over trinn, ordnet etter kategori – Rader, Kommunikasjon, Dokumenter, KI,
Logikk – med et søkefelt, og legger til det valgte trinnet på det stedet; et kort åpner
innstillingene sine til høyre. En enkel automatisering – én utløser og én handling – får
plass på to kort, og settes opp som før.

## Når

| Utløser | Innstillinger |
|---|---|
| **En rad opprettes** | tabellen |
| **En rad endres** | tabellen, og ved behov bare feltene som skal overvåkes |
| **På fast tidspunkt** | hver time, hver dag eller hver uke, på valgt klokkeslett og i valgt tidssone |
| **Noen klikker på en knapp** | et [Knapp-felt](/basedb/nb/fonctionnalites/tables-et-champs/#knapp) i tabellen |
| **En rad slettes** | tabellen; trinnene viser til raden slik den var |
| **En rad kommer inn i et filter** | tabellen og filteret: automatiseringen starter når en rad kommer inn i det, og starter ikke på nytt før den har gått ut igjen – «en faktura blir forsinket», ikke «en forsinket faktura endres» |
| **En dato kommer** | et Dato-felt i tabellen, en forskyvning – tre dager før, samme dag, en uke etter – og klokkeslettet: purringer på forfall, kontraktsjubileer |
| **En webhook mottas** | ingenting: automatiseringen får sin egen adresse, som annen programvare kaller ([detaljer](#en-tjeneste-som-kaller-basedb)) |

En utløser på rader ser **all** skriving: grensesnittet, API-et, en agent, et
delt skjema og til og med direkte SQL – automatiseringene tar utgangspunkt i historikken, som
fanger opp alt.

## Bare hvis

En valgfri betingelse, i [filterspråket](/basedb/nb/integrations/api-rest/#lese) –
`statut eq "fait"`, `montant gte 10000 and payee eq false` – som vurderes på raden **i det øyeblikket
den skal handle**. En kjøring der betingelsen ikke er oppfylt, blir «forkastet», og sier det.

## Så

Opptil førti trinn, i rekkefølge; det første som mislykkes, stopper de neste – unntatt
i en **Prøv**-blokk ([detaljer](#prøv)).

| Trinn | Hva det gjør |
|---|---|
| **Endre en rad** | skriver verdier i raden som utløste – eller i den et trinn har funnet eller opprettet |
| **Opprett en rad** | i denne tabellen eller en annen i databasen |
| **Finn en rad** | den første raden i en tabell som samsvarer med et filter, slik at de neste trinnene kan referere til eller endre den |
| **Varsle noen** | et [varsel](/basedb/nb/fonctionnalites/collaboration/#varsler) til utvalgte personer, eller til den i et Person-felt |
| **Send en e-post** | til personer i teamet, til personen i et Person-felt, til adressen i et E-post-felt – en kunde, en leverandør – eller til adresser du skriver inn; emnet og teksten refererer til raden og de forrige trinnene |
| **Kall en webhook** | en HTTPS-forespørsel til en tjeneste – metode, adresse, headere og brødtekst du styrer selv ([detaljer](#kall-en-tjeneste)); svaret kan refereres til etterpå |
| **Send til Slack** | en melding i en [tilkoblet](/basedb/nb/integrations/synchronisation/#slack) kanal |
| **Spør KI** | et svar fra [KI-leverandøren](/basedb/nb/fonctionnalites/ia/) på en instruksjon som refererer til raden og de forrige trinnene – skrive, oppsummere, klassifisere –, lest som en tekst, et tall, ja eller nei, en dato eller et valg i en liste |
| **Betingelse** | flere grener: den første der betingelsen er oppfylt, blir tatt, «Ellers» når ingen er det; grenene møtes igjen etterpå |
| **For hver rad** | trinnene den inneholder, én gang for hver rad i en tabell som samsvarer med et filter ([detaljer](#for-hver-rad)) |
| **Slett en rad** | raden som utløste, eller den et trinn har funnet – den legges i papirkurven |
| **Tell og summer** | antall rader i et filter, summen, gjennomsnittet, minimum eller maksimum av dem, som kan vises til eller testes etterpå |
| **Generer en PDF** | [dokumentet](/basedb/nb/fonctionnalites/documents/) til en rad, lagt i et Fil-felt eller lagt ved en e-post |
| **Vent** | en varighet, eller til datoen i et felt ([detaljer](#vent)) |
| **Prøv** | noen trinn, og andre som skal utføres hvis ett av dem mislykkes ([detaljer](#prøv)) |
| **Kjør en automatisering** | en annen automatisering i databasen, på en rad i tabellen dens |

Et søk som ikke finner noe, stopper ikke flyten: trinnene som skulle endre raden det skulle finne,
hoppes over. For å gjøre noe annet i det tilfellet legger **Hvis ingen rad blir funnet …**,
under søket, til en betingelse som tester det.

En **betingelse** tester en rad med et filter, eller en **verdi**: KI-svaret, koden til en
webhook, et tall – «`{{e2.reponse}}` er lik Urgent», «`{{e3.somme.montant}}` er større enn
eller lik 1000». Tallene sammenlignes som tall, tekstene uten aksenter eller store bokstaver.

## For hver rad

Trinnet **For hver rad** leser radene i en tabell som samsvarer med filteret sitt – tomt:
alle –, i den valgte rekkefølgen, opp til grensen sin (50 som standard, høyst 200), og
utfører så trinnene som er lagt i det, én gang for hver rad. «Hver mandag, purre på ubetalte
fakturaer» skrives slik: **På fast tidspunkt**, deretter **For hver rad** av fakturaene
`payee eq false and relancee eq false`, og i løkken en e-post til fakturaens kontakt og
**Endre en rad** som krysser av «Relancée».

I løkken navngir trinnets identifikator **gjennomgangens rad**: `{{e1.client}}` refererer
til den, og **Endre en rad** foreslår den blant radene som kan endres. Etter løkken forteller
`{{e1.nombre}}` hvor mange rader den har gjennomgått – for eksempel til et sammendrag på
Slack. Filteret kan referere til det som kom før: utløst av en betalt faktura, gjennomgår
`facture eq {{_id}}` detaljradene til den.

Utover grensen venter de gjenstående radene til neste kjøring, som sier ifra om det: la
filteret utelukke dem som allerede er behandlet – en «Relancée»-avkrysningsboks, en dato –
for å behandle dem alle etter hvert som kjøringene skjer. En løkke kan ikke inneholde en
annen, og en kjøring stopper etter to minutter.

## Vent

Trinnet **Vent** setter kjøringen på pause – tre timer, to dager – eller til datoen i et felt
i en rad, med en forskyvning og et klokkeslett: «dagen før forfall, kl. 9». Kjøringen vises
som **På pause** på fanen **Kjøringer**, med datoen den gjenopptas.

Den fortsetter til neste trinn ved å **lese radene sine på nytt**: «tre dager etter at
tilbudet er sendt, hvis det fortsatt ikke er godtatt, purre» skrives som **Vent** 3 dager,
deretter en betingelse på tilbudets status, slik den er den dagen. Deaktiverer du
automatiseringen, stoppes kjøringer som er på pause; en venting kan ikke plasseres i en løkke
eller i en **Prøv**-blokk, og varer høyst ett år.

## Prøv

Blokken **Prøv** har to grener. Den første kjøres; hvis ett av trinnene i den mislykkes,
fortsetter flyten med den andre, **Ved feil**, som viser til feilen – `{{e4.erreur}}`, koden,
og `{{e4.etape}}`, trinnet –, og fortsetter deretter etter blokken. Dette gjør det mulig å
varsle noen når en tjeneste ikke svarer, uten å stoppe alt.

Enklere sagt: en webhook kan **prøve på nytt** helt av seg selv, opptil tre ganger etter et
avbrudd i tjenesten, og en løkke kan **fortsette** selv om en rad mislyktes.

## En PDF og en e-post

**Generer en PDF** lager dokumentet til en rad – med en
[dokumentmal](/basedb/nb/fonctionnalites/documents/) fra tabellen, eller raddetaljene med
alle feltene dens – og kan legge det i et Fil-felt. **Send en e-post** kan deretter legge det
ved, med filene fra et Fil- eller Bilde-felt:

- en e-post **til hver**, eller **én, til alle**, med mottakere **i kopi**;
- en melding i **formatert tekst** – fet, lister, lenker – som refererer til raden;
- en **svaradresse**: din egen som standard, eller den i et E-post-felt;
- opptil 50 mottakere, 10 vedlegg og 15 MB.

«Når et tilbud går til Godkjent, send fakturaen til kunden, med regnskap i kopi»: **En rad
kommer inn i et filter** `statut eq "accepte"`, **Generer en PDF** med malen Faktura, **Send
en e-post** til kundens E-post-felt, med fakturaen vedlagt.

## En tjeneste som kaller basedb

Med utløseren **En webhook mottas** får automatiseringen sin egen hemmelige adresse, som du
gir til programvaren som skal starte den – en nettbutikk, et eksternt skjema, et
automatiseringsverktøy:

```bash
curl -X POST "https://basedb.example.com/api/v1/hooks/<secret>" \
  -H "content-type: application/json" \
  -d '{"client": {"nom": "Dupont"}, "total": 120}'
```

Trinnene viser til det den har sendt: `{{trigger.client.nom}}`, `{{trigger.total}}`; et
skjema leses på samme måte, en tekst med `{{trigger.texte}}`. Adressen kopieres fra
utløserens innstillinger; **Endre adresse** erstatter den, og den gamle opphører umiddelbart.
Et kall får svaret `202`, og automatiseringen kjører i løpet av et sekund.

## Kall en tjeneste

Trinnet **Kall en webhook** sender som standard, i `POST`, automatiseringens data: den
valgte raden og det de forrige trinnene har funnet eller skrevet. For å snakke med en
tjeneste slik den forventer, stiller du inn:

- **metoden**: `POST`, `PUT`, `PATCH`, `GET` eller `DELETE` – de to siste uten brødtekst;
- **adressen**, som kan referere til noe etter verten sin – `https://api.exemple.fr/clients/{{e2.numero}}`;
  hver verdi kodes der;
- **headere**, der verdien kan referere til noe: `Idempotency-Key: {{_id}}`;
- **brødteksten**: automatiseringens data, en **JSON å sette sammen**, et **skjema**
  (et par `nøkkel=verdi` per linje) eller en **tekst**. I en JSON er en referanse i
  anførselstegn tekst, og utenfor anførselstegn en verdi – et tall, ja eller nei, en liste:

```json
{ "facture": "{{e1.numero}}", "montant": {{e1.montant}}, "payee": {{e1.payee}} }
```

En API-nøkkel eller et token settes i en **hemmelig** header (hengelåsen): kryptert med
instansnøkkelen vises den aldri igjen – verken på skjermen, i API-et eller til Copilot –
og den sendes bare til verten du har gitt den til. Skifter adressens vert, må du gi den på
nytt; **Erstatt** lar deg skrive inn en ny.

## Spør KI

Som et [KI-felt](/basedb/nb/fonctionnalites/ia/#ki-alternativet-for-et-felt) sender trinnet
instruksjonen sin til leverandøren, der hver referanse er erstattet med verdien sin:

```text
Cet avis de {{auteur}} demande-t-il une action de notre part ? {{avis}}
```

Du velger **forventet svar** – en fri eller kort tekst, et tall, ja eller nei, en dato,
en nettadresse, eller et valg i en liste, som kan hentes fra et valgfelt. Modellen
får beskjed om det, og et svar som ikke inneholder det, får trinnet til å mislykkes. De neste trinnene
refererer til det med `{{e1.reponse}}`: i tittelen på en opprettet oppgave, en melding eller et valgfelt,
der det plasseres på valget med samme etikett.

Det instruksjonen refererer til, sendes til leverandøren: trinnet ber om **samtykket** ditt, som må gis på nytt
når instruksjonen endres. Hvert kall logges og telles, sammen med KI-feltene, i
`BASEDB_AI_FIELD_QUOTA` (300 per time som standard). KI gjør ingenting på egen hånd: det er
trinnene som kommer etter den, som skriver eller varsler.

## Referanser

Verdiene, meldingene og filtrene refererer til det som kom før, via knappen **{ }** ved siden av
hver tekst:

- `{{Titre}}`, `{{_id}}`: raden som utløste;
- `{{e2.titre}}`, `{{e2._id}}`: raden som ble funnet, opprettet eller endret av trinnet `e2` – hvert
  trinn viser identifikatoren sin på kortet;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: det webhooken `e3` svarte;
- `{{e4.reponse}}`: svaret fra KI-trinnet `e4`;
- `{{e5.client}}` i løkken `e5`, gjennomgangens rad; `{{e5.nombre}}` etter den, antall rader
  den har gjennomgått;
- `{{e6.nombre}}`, `{{e6.somme.montant}}`, `{{e6.moyenne.montant}}`, `{{e6.max.echeance}}`: det
  trinnet `e6` har talt;
- `{{e7.erreur}}`, `{{e7.etape}}`: feilen som blokken **Prøv** `e7` har fanget opp;
- `{{e8.nom}}`: navnet på PDF-en fra trinnet `e8`;
- `{{trigger.client.nom}}`: det en innkommende webhook har sendt;
- `{{_maintenant}}`: tidspunktet for kjøringen.

En verdi som består av én enkelt referanse, sender selve verdien: en relasjon, en person, et
valg – slik kobles en opprettet rad til den et søk har funnet. I et
filter er en referanse alltid en verdi som sammenlignes, aldri filterspråk.

Et trinn kan bare referere til det som med sikkerhet har skjedd før det: det en gren har funnet,
kan ikke refereres til etter betingelsen. Editoren viser det på kortet før lagring.

## Copilot

**Copilot**, i toppfeltet, åpner til høyre en samtale på naturlig språk om
databasens automatiseringer: «når en oppgave går til gjennomgang, varsle personen som er
tildelt», «legg til et KI-sammendrag i notatene», «hvorfor mislyktes den siste
kjøringen?». Den svarer og **foreslår** en hel automatisering – den du har på skjermen,
endret, eller en ny –, med en liste over hva som endres.

Ingenting lagres av Copilot: **Legg på flyten** viser forslaget i editoren,
der du leser gjennom det før du lagrer – og **Angre**, på kortet, setter flyten tilbake slik den
var. En ny automatisering åpnes i editoren, klar til å opprettes. Hvert forslag
kontrolleres slik en lagring ville blitt; det som ikke holder, forkastes, og det sies ifra.

Som standard sendes **bare strukturen** til KI-leverandøren, sammen med samtalen: tabellene
og feltene deres, databasens automatiseringer, den som er på skjermen slik editoren viser den, og
de siste kjøringene av den – statusene og feilkodene deres, aldri en verdi. Personer
og Slack-kanaler sendes under stedfortredere (`p1`, `s1`), aldri med identifikatoren sin. Avkrysningsboksen
**Tillat lesing av dataene** lar Copilot, for samtalen, lese rader
(høyst 50 per lesing), og hver lesing listes under svaret.

## Test og følg opp

**Test på en rad** kjører den lagrede automatiseringen på en valgt rad, på
ordentlig. Fanen **Kjøringer** tar vare på de 50 siste, i 30 dager: venter, pågår, vellykket,
forkastet med årsak, mislyktes med kode. Velger du en, legges den på flyten – grenen
som ble tatt, er tegnet opp, hvert trinn som ble utført, forteller hva det gjorde og hvor lang tid det tok, resten er
nedtonet. I en løkke forteller hvert trinn også hvor mange ganger det ble kjørt.

## Hvem den handler på vegne av

En automatisering handler med **tillatelsene til personen som lagret den sist**,
vurdert på nytt ved hver kjøring: hvis denne personen mister en tillatelse, mislykkes trinnet som trengte den,
i stedet for å gå videre, og et søk finner bare det vedkommende kan lese.
Historikken viser den som «Automatisering ‹Tâche terminée› · på vegne av …», og skrivingene den gjør,
kan angres som alle andre.

## Begrensninger

- Det en automatisering skriver, utløser ingen andre: det som skal henge sammen, skrives
  i én og samme flyt, eller med **Kjør en automatisering**, høyst tre nivåer.
- Et søk gir én rad, den første; en løkke gjennomgår høyst 200 per kjøring. En kjøring varer
  høyst to minutter, venting ikke inkludert.
- Ingen skript. En e-post sendes via [utsendingsserveren](/basedb/nb/hebergement/variables/#e-poster)
  til instansen.
- En [databasemal](/basedb/nb/fonctionnalites/modeles/) tar bare med automatiseringer uten
  søk, løkke, betingelse eller KI-trinn, og aldri en webhook.
- En webhook følger ingen omdirigering og venter høyst 10 sekunder; et annet svar enn 2xx
  gjør at trinnet mislykkes, etter sine gjentatte forsøk.
- En dato som kommer, sjekkes hvert minutt; bare de som kommer etter at automatiseringen ble
  lagret, telles.
- 100 kjøringer per time og per automatisering; et tapt timetidspunkt tas bare igjen
  én gang.
- Forsinkelsen mellom skrivingen og handlingen er i størrelsesorden ett sekund.
