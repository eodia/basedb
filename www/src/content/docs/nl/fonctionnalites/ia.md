---
title: Kunstmatige intelligentie
description: De AI-optie van een veld, concepten, de Copilot en die van dashboards — en wat er naar de provider gaat.
---

AI is **optioneel**. Zonder geconfigureerde provider gaat er nergens iets naartoe. basedb kan
praten met **OpenAI**, **Anthropic** en **Mistral**, met je eigen sleutel — en met elke server
die de API van OpenAI spreekt: **Azure**, een bedrijfsgateway, een model dat je zelf host.

## Een provider configureren

Zolang er in de interface geen instelling is opgeslagen, leest de API zijn omgeving:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral of openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # of BASEDB_AI_API_KEY
```

De sleutel wordt gelezen uit `BASEDB_AI_API_KEY`, of anders uit de gebruikelijke naam van de provider
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, een gateway, een lokaal model

`BASEDB_AI_PROVIDER=openai_compatible` stuurt de aanroepen, in het formaat van OpenAI, naar het
adres in `BASEDB_AI_BASE_URL`: alles wat vóór `/chat/completions` komt, parameters inbegrepen.
`BASEDB_AI_HEADERS` voegt aan elke aanroep de headers toe die die server vraagt, als JSON-object.

```bash
# Azure OpenAI: de naam van de deployment als model, de sleutel in de header api-key
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# De oudere vorm van Azure, per deployment: de parameter blijft na het pad staan
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Een model dat door Ollama wordt geserveerd, zonder sleutel
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

Met `openai_compatible` is de sleutel optioneel: als `BASEDB_AI_API_KEY` is opgegeven, wordt die
verstuurd als `Authorization: Bearer`. Een header uit `BASEDB_AI_HEADERS` vervangt die van de
sleutel — bijvoorbeeld voor een gateway die zijn eigen `Authorization` wil.

`BASEDB_AI_BASE_URL` en `BASEDB_AI_HEADERS` gelden ook voor de drie andere providers, wanneer
die via een gateway worden bereikt: voor `anthropic` is het adres alles wat vóór `/messages`
komt. Deze twee variabelen horen bij de provider van de omgeving, en alleen bij die: een
werkruimte die een andere provider heeft gekozen, krijgt niet het adres, niet de headers en niet
de sleutel. Bij het opstarten van de API noteert het logboek de gekozen provider en wordt een
ongeldig adres of JSON-object gemeld.

Een interne gateway met een zelfondertekend TLS-certificaat, of een bedrijfsproxy die het verkeer
opnieuw ondertekent, laat de aanroepen mislukken: `BASEDB_AI_PROVIDER_SSL_VERIFY=false` stopt met
het controleren van het certificaat **van alleen deze provider** — alle andere uitgaande
aanroepen van de instantie, en de provider die een werkruimte heeft gekozen, blijven gecontroleerd.
Bij het opstarten wordt dit gemeld. Omdat de sleutel in elke aanroep meegaat, gebruik je dit alleen
op een netwerk dat je zelf beheert.

## De AI-optie van een veld

AI is geen veldtype maar een **optie**: de schakelaar **AI** in het formulier van een
veld — tekst, lange tekst, URL, getal, enkele keuze, boolean, datum — laat het invullen door
een model, op basis van een instructie die andere kolommen citeert:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Het veld wordt berekend zodra de rij bestaat, en daarna telkens wanneer een geciteerde kolom verandert —
  en, als je dat wilt, volgens een planning (hooguit elke 15 minuten).
- De kolom **behoudt haar type**: een antwoord waarin niets in dat type te lezen is (een getal dat
  niet te vinden is, een keuze die niet bestaat), wordt geweigerd in plaats van geschreven.
- De optie uitschakelen maakt het veld weer met de hand bewerkbaar, met behoud van de waarden.
- De geciteerde waarden gaan naar de provider: **inschakelen vraagt uitdrukkelijke
  toestemming**.

`BASEDB_AI_FIELD_QUOTA` begrenst deze berekeningen per uur en per werkruimte (standaard 300).

## In een automatisering

Een [automatisering](/basedb/nl/fonctionnalites/automatisations/#ai-raadplegen) kan in een van haar
stappen **de AI raadplegen**: een instructie die de rij en de vorige stappen citeert,
een antwoord dat in het gekozen type wordt gelezen, en dat de volgende stappen schrijven, versturen of citeren. Dezelfde
regels als voor een veld: toestemming bij het opslaan, alleen wat de instructie citeert gaat mee,
elke aanroep wordt gelogd en telt mee in `BASEDB_AI_FIELD_QUOTA`.

## Concepten en Copilot

- **Concepten**: een tabel of een formule in één zin beschrijven, en een voorstel krijgen om na
  te lezen. Alleen labels, types en de ingevoerde zin gaan mee — geen enkele celwaarde.
- **Sjablonen**: een hele database beschrijven — “het opvolgen van klachten van mijn klanten” — en
  tabellen, voorbeeldrijen, weergaven, een dashboard en automatiseringen krijgen, om te verfijnen en daarna
  aan te maken. Alleen de zin gaat mee. Zie [Databasesjablonen](/basedb/nl/fonctionnalites/modeles/#aan-de-ai-vragen).
- **Copilot**: een gesprek over de getoonde database. Je vraagt om een filter, een query,
  kolommen, een tabel, een testset; elk voorstel komt binnen als een kaart en pas je met één klik toe,
  via dezelfde routes als de formulieren.

Standaard gaat alleen de structuur naar de provider. Het vakje **“Lezen van gegevens
toestaan”** laat de Copilot, voor dit gesprek, rijen lezen (hooguit 50 per leesactie)
en op basis daarvan antwoorden — elke leesactie wordt onder zijn antwoord vermeld.

## De Copilot van dashboards

In de sectie [Dashboards](/basedb/nl/fonctionnalites/tableaux-de-bord/#de-copilot) stelt de
Copilot vragen, wijzigingen van het dashboard en waarden voor de filters voor, die je
met één klik toepast. Dezelfde regels: zonder toestemming gaat alleen de structuur mee — tabellen en
velden, dashboards en vragen van de database, de definitie van de kaarten van het getoonde dashboard (hun
vragen, hun teksten) —, nooit de resultaten of de in de filters gekozen waarden. Het vakje
**“Lezen van gegevens toestaan”** voegt die waarden toe, en de resultaten van de kaarten onder de
getoonde filters, hooguit 50 rijen per leesactie, elk vermeld onder het antwoord.

## De Copilot van automatiseringen

In de sectie [Automatiseringen](/basedb/nl/fonctionnalites/automatisations/#de-copilot) stelt de Copilot
een complete automatisering voor — die op het scherm, aangepast, of een nieuwe — die hij op de
flow in de editor plaatst, **zonder haar ooit op te slaan**: jij leest haar na en slaat haar daarna op. Dezelfde regels:
zonder toestemming gaat alleen de structuur mee — tabellen en velden, automatiseringen van de database, die op
het scherm, haar laatste uitvoeringen zonder enige waarde, personen en Slack-kanalen onder markeringen —,
en het vakje **“Lezen van gegevens toestaan”** voegt gelezen rijen toe, hooguit 50 per leesactie.

`BASEDB_AI_QUOTA` begrenst de interactieve aanroepen per uur en per werkruimte (standaard 120).
