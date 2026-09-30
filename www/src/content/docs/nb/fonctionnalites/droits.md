---
title: Tillatelser og grupper
description: Kontoer, grupper, tilgangsnivåer per prosjekt, database og tabell, begrensninger per felt, og innstillingene dine.
---

Tillatelser gis til **grupper**, aldri til personer én og én. Et nivå
som settes på et prosjekt, en database eller en tabell, arves av alt som ligger
under, inkludert det som opprettes senere.

## De fire nivåene

| Nivå | Tillater |
|---|---|
| **Ingen tilgang** | ingenting: ressursen er usynlig |
| **Lese** | se radene, kommentere dem, lage personlige visninger, se strukturen og instrumentbordene, stille og lagre egne spørsmål, skrive skrivebeskyttet SQL og lagre personlige spørringer |
| **Redigere** | i tillegg opprette, endre og slette rader |
| **Administrere** | i tillegg endre strukturen, opprette de delte visningene og instrumentbordene, dele et instrumentbord med en lenke, dele spørsmål og spørringer, opprette SQL-visninger, automatiseringene, integrasjonene og tokenene; SQL-en har tilgang til hele databasen, skriving inkludert |

Tillatelser **legges sammen**: en person får det høyeste nivået som en av
gruppene vedkommende er med i, gir. Å gi mindre på en tabell enn på databasen gjør den «granulær».

To grupper finnes alltid: **Administratorer**, som administrerer alt, og **Alle
brukere**, som hver konto er med i – det den gruppen får, har alle.

## Helt ned til feltet

Under rutenettet med nivåer skjuler **Felt** en kolonne for en gruppe, eller gjør den skrivebeskyttet
for gruppen. Skjermen viser også hva en bestemt person faktisk ser, og gjennom hvilken gruppe.

Et skjult felt er fraværende overalt: i rutenettet, visningene, API-et, MCP, historikken,
SQL skrevet i grensesnittet og SQL-visningene. Å filtrere eller sortere på det gir samme svar som for et felt
som ikke finnes.

## Helt ned til raden

Ved siden av **Felt** viser **Rader** en gruppe bare visse rader i en tabell: dem et filter
fanger opp, skrevet som filteret i en visning. `@me` betegner den innloggede personen:

- `commercial eq @me` — hver selger ser bare sine egne kunder;
- `region in ["nord", "est"]` — et team ser bare sine egne regioner;
- `_created_by eq @me` — alle ser bare det de selv har opprettet.

Rettighetene legges sammen: en person ser radene til alle sine grupper, og en gruppe uten regel
ser dem alle. Den som administrerer tabellens struktur — nivået Administrere — ser alltid alt.
Skjermen viser hvor mange rader en gitt person ser, og gjennom hvilken gruppe.

En rad utenfor sin regel finnes ikke for personen: ikke i visningene, instrumentbordene, søket,
API-et, MCP-en eller historikken, og heller ikke til å endres, slettes eller kobles til. En rad
personen oppretter, må være blant sine egne; ved å endre en rad kan vedkommende derimot føre den
ut av sitt område — en oppgave overlatt til en kollega. Svarene på
[delte skjemaer](/basedb/nb/fonctionnalites/formulaires-partages/) kommer alltid inn.

## Og SQL?

I grensesnittet følger SQL de samme tillatelsene, håndhevet av PostgreSQL selv: uten nivået
Administrere kjøres en spørring skrivebeskyttet, med en rolle som hører til personen, der en stengt
tabell ikke finnes, et skjult felt avvises og bare radene sine leses, uansett om tabellen navngis
alene eller med skjemaet sitt. En [SQL-visning](/basedb/nb/fonctionnalites/requetes-et-vues-sql/)
leses med tillatelsene til den som leser den, og å dele en spørring deler bare teksten.

Direkte **`psql`-tilgang** til databasen styres derimot ikke av basedb: den leser alt, skjulte
felt inkludert. Begrensningene beskytter produktets flater – grensesnitt, API, MCP –, aldri
mot noen som har SQL-tilgang til databasen; slik tilgang styres med PostgreSQL-`GRANT`,
satt av driftsansvarlig. En tabell som har en radregel, har PostgreSQLs radsikkerhet aktivert: en
rolle opprettet for et tredjepartsverktøy ser ingen rader der, med mindre den har attributtet
`BYPASSRLS` eller sin egen policy.

## Kontoer og innlogging

- En konto opprettes med et **midlertidig passord**, som vises én gang og må endres ved
  første innlogging.
- Innlogging skjer med passord eller via en **OpenID Connect**-leverandør som er satt opp av
  driftsansvarlig.
- Administrasjonshandlinger krever en **forhøyet økt**: et passord skrevet inn på nytt i løpet av de
  siste fem minuttene.
- Økter kan tilbakekalles; å tilbakekalle en økt gjør tilgangstokenene dens ugyldige med en gang.

## Innstillingene dine

**Innstillinger**, i profilmenyen nederst til venstre, gjelder bare deg:

| Fane | Hva du gjør der |
|---|---|
| **Profil** | visningsnavnet; innloggingsadressen; identitetsleverandørene som er koblet til kontoen, som kan kobles til eller fra |
| **Sikkerhet** | endre passordet; de åpne øktene, som kan lukkes én og én eller alle samtidig |
| **Utseende** | grensesnittets språk; temaet; rekkefølgen i datoer – `25/09/2026` eller `2026-09-25` – og første ukedag i kalenderne |
| **Varsler** | typene varsler du ikke lenger vil ha |
| **Tokener** | integrasjonstokenene du har opprettet, i alle databasene dine, når de sist ble brukt, og tilbakekalling av dem |

basedb snakker **tjue språk**: fransk, engelsk, tysk, spansk, italiensk, portugisisk
(Brasil), nederlandsk, polsk, tsjekkisk, svensk, dansk, norsk, finsk, rumensk, ungarsk,
tyrkisk, ukrainsk, japansk, forenklet kinesisk og koreansk. Som standard bruker grensesnittet språket
i nettleseren din; **Språk**, under **Utseende**, velger et annet. Tall og datoer
følger det valgte språket.

En lenke kan også be om et språk: `?lang=de` til slutt i en basedb-adresse viser
innloggingsskjermen, et skjema, en delt visning eller et delt instrumentbord på tysk. Det er
slik nettstedet fører til demoen i språket til siden. Når du er logget inn, følger basedb
kontoen din: språket valgt under **Utseende**, ellers nettleserens.

Temaet hører til nettleseren; språket, datorekkefølgen og første ukedag
følger deg fra én maskin til en annen. Å endre adresse eller koble til en leverandør krever en forhøyet
økt; en konto uten passord, som logger inn via en leverandør, beholder adressen fra denne
leverandøren.

## Ett enkelt håndhevingspunkt

Alle flatene – grensesnitt, API, MCP, delte skjemaer og visninger, automatiseringer –
går gjennom det samme beslutningspunktet for tillatelser, i kjernen. Det finnes ingen private
ruter for grensesnittet: det skjermen ikke viser, er det API-et ikke har returnert.

Det omvendte gjelder også: skjermen **tilbyr ikke det som ville blitt avvist**. Uten nivået
Administrere kan Struktur-skjermen leses uten knapper eller blyanter, og importen tilbyr ikke å
opprette en tabell; uten rett til å opprette eller slette rader tilbyr rutenettet verken en rad
for å legge til eller «Slett».
