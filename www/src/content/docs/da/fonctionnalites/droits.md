---
title: Tilladelser og grupper
description: Konti, grupper, adgangsniveauer pr. projekt, database og tabel, begrænsninger pr. felt og dine indstillinger.
---

Tilladelser gives til **grupper**, aldrig til personer én ad gangen. Et niveau, der sættes på et
projekt, en database eller en tabel, gælder for alt derunder, også det, der oprettes senere.

## De fire niveauer

| Niveau | Tillader |
|---|---|
| **Ingen adgang** | intet: ressourcen er usynlig |
| **Læse** | se rækkerne, kommentere dem, lave personlige visninger, se strukturen og dashboards, stille og gemme egne spørgsmål, skrive skrivebeskyttet SQL og gemme personlige forespørgsler |
| **Redigere** | og oprette, redigere og slette rækker |
| **Administrere** | og ændre strukturen, oprette delte visninger og dashboards, dele et dashboard via et link, dele spørgsmål og forespørgsler, oprette SQL-views, automatiseringer, integrationer og tokens; personens SQL har adgang til hele databasen, skrivninger inklusive |

Tilladelser **lægges sammen**: en person får det højeste niveau, som en af personens grupper
giver. Giver du en tabel mindre end dens database, bliver den »granulær«.

To grupper findes altid: **Administratorer**, som administrerer alt, og **Alle brugere**, som
hver konto er med i — det, gruppen får, har alle.

## Helt ned til feltet

Under oversigten over niveauer skjuler **Felter** en kolonne for en gruppe eller gør den
skrivebeskyttet for gruppen. Skærmen viser også, hvad en bestemt person faktisk ser, og via
hvilken gruppe.

Et skjult felt er fraværende overalt: i gitteret, visningerne, API'et, MCP, historikken, den SQL,
der skrives i brugerfladen, og SQL-views. Filtrering eller sortering på det svarer som for et
felt, der ikke findes.

## Og SQL?

I brugerfladen følger SQL de samme tilladelser, håndhævet af PostgreSQL selv: uden niveauet
Administrere køres en forespørgsel skrivebeskyttet på en rolle, der er personens egen, hvor en
lukket tabel ikke findes, og et skjult felt afvises. Et [SQL-view](/basedb/da/fonctionnalites/requetes-et-vues-sql/)
læses med læserens tilladelser, og at dele en forespørgsel deler kun dens tekst.

En **direkte `psql`-adgang** til databasen styres derimod ikke af basedb: den læser alt, skjulte
felter inklusive. Begrænsningerne beskytter produktets flader — brugerflade, API, MCP —, aldrig
mod nogen, der har SQL-adgang til databasen; den slags adgang styres med PostgreSQL-`GRANT`,
som den driftsansvarlige sætter op.

## Konti og login

- En konto oprettes med en **midlertidig adgangskode**, som vises én gang og skal ændres ved
  første login.
- Login sker med adgangskode eller via en **OpenID Connect**-udbyder, som den driftsansvarlige
  har konfigureret.
- Administrationshandlinger kræver en **forhøjet session**: en adgangskode, der er indtastet
  igen inden for de seneste fem minutter.
- Sessioner kan tilbagekaldes; når en session tilbagekaldes, bliver dens adgangstokens straks
  ugyldige.

## Dine indstillinger

**Indstillinger** i profilmenuen nederst til venstre handler kun om dig:

| Fane | Hvad du gør der |
|---|---|
| **Profil** | det viste navn; loginadressen; de identitetsudbydere, der er knyttet til kontoen, som kan tilknyttes eller fjernes |
| **Sikkerhed** | ændre adgangskoden; de åbne sessioner, som kan lukkes én ad gangen eller alle på én gang |
| **Udseende** | brugerfladens sprog; temaet; datoernes rækkefølge — `25/09/2026` eller `2026-09-25` — og kalendernes første ugedag |
| **Notifikationer** | de typer notifikationer, du ikke længere vil have |
| **Tokens** | de integrationstokens, du har oprettet, på tværs af alle dine databaser, deres seneste brug og tilbagekaldelse af dem |

basedb taler **tyve sprog**: fransk, engelsk, tysk, spansk, italiensk, portugisisk
(Brasilien), nederlandsk, polsk, tjekkisk, svensk, dansk, norsk, finsk, rumænsk, ungarsk,
tyrkisk, ukrainsk, japansk, forenklet kinesisk og koreansk. Som standard bruger brugerfladen
din browsers sprog; **Sprog** under **Udseende** vælger et andet. Tal og datoer følger det
valgte sprog.

Et link kan også anmode om et sprog: `?lang=de` sidst i en basedb-adresse viser login-skærmen,
en delt formular, en delt visning eller et delt dashboard på tysk. Det er sådan, sitet fører til
demoen på sidens sprog. Når du er logget ind, følger basedb din konto: det sprog, du har valgt
under **Udseende**, ellers browserens.

Temaet gælder kun for browseren; sproget, datoernes rækkefølge og ugens første dag følger dig
fra computer til computer. At skifte adresse eller tilknytte en udbyder kræver en forhøjet
session; en konto uden adgangskode, der logger ind via en udbyder, beholder udbyderens adresse.

## Det ene håndhævelsespunkt

Alle flader — brugerflade, API, MCP, delte formularer og visninger, automatiseringer — går
gennem det samme beslutningspunkt for tilladelser i kernen. Der findes ingen privat rute for
brugerfladen: det, skærmen ikke viser, er det, API'et ikke har returneret.

Det omvendte gælder også: skærmen **tilbyder ikke det, der ville blive afvist**. Uden niveauet
Administrere kan Struktur-skærmen ses uden knapper eller blyant, og importen tilbyder ikke at
oprette en tabel; uden tilladelse til at oprette eller slette rækker viser gitteret hverken en
række til tilføjelse eller »Slet«.
