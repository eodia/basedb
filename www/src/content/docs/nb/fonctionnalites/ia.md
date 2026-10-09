---
title: Kunstig intelligens
description: KI-alternativet for et felt, utkastene, Copilot og instrumentbordenes Copilot – og hva som sendes til leverandøren.
---

KI er **valgfritt**. Uten en konfigurert leverandør sendes ingenting noe sted. basedb kan
snakke med **OpenAI**, **Anthropic** og **Mistral**, med din egen nøkkel – og med alle servere som
snakker OpenAIs API: **Azure**, en bedriftsgateway, en modell som kjøres hos deg.

## Konfigurer en leverandør

Så lenge ingen innstilling er lagret i grensesnittet, leser API-et miljøet sitt:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral eller openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # eller BASEDB_AI_API_KEY
```

Nøkkelen leses fra `BASEDB_AI_API_KEY`, eller ellers fra leverandørens vanlige navn
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, en gateway, en lokal modell

`BASEDB_AI_PROVIDER=openai_compatible` sender kallene, i OpenAIs format, til adressen i
`BASEDB_AI_BASE_URL`: det som står foran `/chat/completions`, parametere medregnet.
`BASEDB_AI_HEADERS` legger til i hvert kall de headerne som serveren krever, som et JSON-objekt.

```bash
# Azure OpenAI: navnet på distribusjonen som modell, nøkkelen i headeren api-key
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Azures eldre form, per distribusjon: parameteren blir stående etter stien
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# En modell som kjøres av Ollama, uten nøkkel
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

Med `openai_compatible` er nøkkelen valgfri: hvis `BASEDB_AI_API_KEY` er oppgitt, sendes den som
`Authorization: Bearer`. En header i `BASEDB_AI_HEADERS` erstatter nøkkelens – for eksempel en
gateway som vil ha sin egen `Authorization`.

`BASEDB_AI_BASE_URL` og `BASEDB_AI_HEADERS` gjelder også de tre andre leverandørene, når de nås
via en gateway: for `anthropic` er adressen det som står foran `/messages`. Disse to variablene
hører til miljøets leverandør, og bare til den: en tenant som har valgt en annen, får verken
adressen, headerne eller nøkkelen. Når API-et starter, skriver det den valgte leverandøren til
loggen og melder fra om en ugyldig adresse eller et ugyldig JSON-objekt.

En intern gateway med selvsignert TLS-sertifikat, eller en bedriftsproxy som signerer trafikken
på nytt, får kallene til å feile: `BASEDB_AI_PROVIDER_SSL_VERIFY=false` slutter å kontrollere
sertifikatet **bare for denne leverandøren** – alle instansens andre utgående kall, og
leverandøren en tenant eventuelt har valgt, kontrolleres fortsatt. Det meldes ved oppstart. Siden
nøkkelen følger med i hvert kall, bør du bare bruke det på et nettverk du selv kontrollerer.

## KI-alternativet for et felt

KI er ikke en felttype, men et **alternativ**: bryteren **KI** i skjemaet for et
felt – tekst, lang tekst, URL, tall, enkeltvalg, boolsk, dato – lar det fylles ut av
en modell, ut fra en instruksjon som refererer til andre kolonner:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Feltet beregnes så snart raden finnes, og deretter hver gang en kolonne det refereres til, endres –
  og, om du vil, etter en tidsplan (høyst hvert 15. minutt).
- Kolonnen **beholder typen sin**: et svar der ingenting kan leses i denne typen (et tall
  som ikke finnes, et valg som ikke eksisterer), avvises i stedet for å bli skrevet.
- Å slå av alternativet gjør feltet redigerbart for hånd igjen, med verdiene bevart.
- Verdiene det refereres til, sendes til leverandøren: **aktiveringen krever uttrykkelig
  samtykke**.

`BASEDB_AI_FIELD_QUOTA` begrenser disse beregningene per time og per tenant (300 som standard).

## I en automatisering

En [automatisering](/basedb/nb/fonctionnalites/automatisations/#spør-ki) kan **spørre
KI** i et av trinnene sine: en instruksjon som refererer til raden og de forrige trinnene,
et svar lest i den valgte typen, som de neste trinnene skriver, sender eller refererer til. Samme
regler som for et felt: samtykke ved lagring, bare det instruksjonen refererer til, sendes,
hvert kall logges og telles i `BASEDB_AI_FIELD_QUOTA`.

## Utkast og Copilot

- **Utkast**: beskriv en tabell eller en formel med én setning, og få et forslag å
  lese gjennom. Bare etiketter, typer og setningen du skrev inn, sendes – ingen celleverdier.
- **Maler**: beskriv en hel database – «oppfølging av reklamasjoner fra kundene mine» – og
  få tabeller, eksempelrader, visninger, instrumentbord og automatiseringer, som du finjusterer og så
  oppretter. Bare setningen sendes. Se [Databasemaler](/basedb/nb/fonctionnalites/modeles/#be-ki-om-en-mal).
- **Copilot**: en samtale om den viste databasen. Du ber om et filter, en spørring,
  kolonner, en tabell, et testdatasett; hvert forslag kommer som et kort og tas i bruk
  med ett klikk, via de samme rutene som skjemaene.

Som standard sendes bare strukturen til leverandøren. Avkrysningsboksen **«Tillat lesing av
dataene»** lar Copilot, for samtalen, lese rader (høyst 50 per lesing)
og svare ut fra dem – hver lesing listes under svaret.

## Copilot for instrumentbord

I delen [Instrumentbord](/basedb/nb/fonctionnalites/tableaux-de-bord/#copilot) foreslår
Copilot spørsmål, endringer i instrumentbordet og verdier for filtrene, som
tas i bruk med ett klikk. Samme regler: uten samtykke sendes bare strukturen – tabeller og
felt, databasens instrumentbord og spørsmål, definisjonen av kortene på det viste instrumentbordet (spørsmålene
og tekstene deres) –, aldri resultatene eller verdiene som er valgt i filtrene. Avkrysningsboksen
**«Tillat lesing av dataene»** legger til disse verdiene og resultatene på kortene under de
viste filtrene, høyst 50 rader per lesing, hver av dem listet under svaret.

## Copilot for automatiseringer

I delen [Automatiseringer](/basedb/nb/fonctionnalites/automatisations/#copilot) foreslår Copilot
en hel automatisering – den på skjermen, endret, eller en ny – som den legger på
flyten i editoren, **uten noen gang å lagre den**: du leser den gjennom, og lagrer den så. Samme regler:
uten samtykke sendes bare strukturen – tabeller og felt, databasens automatiseringer, den på
skjermen, de siste kjøringene av den uten noen verdier, personer og Slack-kanaler under stedfortredere –,
og avkrysningsboksen **«Tillat lesing av dataene»** legger til leste rader, høyst 50 per lesing.

`BASEDB_AI_QUOTA` begrenser de interaktive kallene per time og per tenant (120 som standard).
