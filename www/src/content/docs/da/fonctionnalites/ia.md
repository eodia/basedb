---
title: Kunstig intelligens
description: AI-tilvalget for et felt, kladder, Copilot og dashboardenes Copilot — og hvad der sendes til udbyderen.
---

AI er **valgfrit**. Uden en konfigureret udbyder sendes intet nogen steder hen. basedb kan
tale med **OpenAI**, **Anthropic** og **Mistral** med din egen nøgle.

## Konfigurér en udbyder

Så længe der ikke er gemt nogen indstilling i brugerfladen, læser API'et sit miljø:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic eller mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # eller BASEDB_AI_API_KEY
```

Nøglen læses fra `BASEDB_AI_API_KEY` eller ellers fra udbyderens sædvanlige navn
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## AI-tilvalget for et felt

AI er ikke en felttype, men et **tilvalg**: kontakten **AI** i et felts formular — tekst, lang
tekst, URL, tal, enkeltvalg, boolesk, dato — får feltet udfyldt af en model ud fra en
instruktion, der citerer andre kolonner:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Feltet beregnes, så snart rækken findes, og derefter hver gang en citeret kolonne ændres —
  og, hvis du vil, efter en tidsplan (højst hvert 15. minut).
- Kolonnen **beholder sin type**: et svar, hvor intet kan læses i den type (et tal, der ikke kan
  findes, et valg, der ikke findes), afvises i stedet for at blive skrevet.
- Slår du tilvalget fra, kan feltet igen redigeres manuelt, og værdierne bevares.
- De citerede værdier sendes til udbyderen: **aktiveringen kræver udtrykkeligt samtykke**.

`BASEDB_AI_FIELD_QUOTA` begrænser disse beregninger pr. time og pr. arbejdsområde (300 som
standard).

## I en automatisering

En [automatisering](/basedb/da/fonctionnalites/automatisations/#spørg-ai) kan **spørge AI** i et
af sine trin: en instruktion, der citerer rækken og de tidligere trin, og et svar, der læses i den
valgte type, og som de efterfølgende trin skriver, sender eller citerer. Samme regler som for et
felt: samtykke, når der gemmes, kun det, instruktionen citerer, sendes, og hvert kald logges og
tælles med i `BASEDB_AI_FIELD_QUOTA`.

## Kladder og Copilot

- **Kladder**: beskriv en tabel eller en formel i én sætning, og få et forslag, du kan
  gennemlæse. Kun etiketter, typer og den indtastede sætning sendes — ingen celleværdier.
- **Skabeloner**: beskriv en hel database — »opfølgning på mine kunders reklamationer« — og få
  tabeller, eksempelrækker, visninger, dashboard og automatiseringer, som du kan finjustere og
  derefter oprette. Kun sætningen sendes. Se [Databaseskabeloner](/basedb/da/fonctionnalites/modeles/#bed-ai-om-en-skabelon).
- **Copilot**: en samtale om den viste database. Du beder om et filter, en forespørgsel,
  kolonner, en tabel, et sæt testdata; hvert forslag kommer som et kort og anvendes med ét klik
  ad de samme veje som formularerne.

Som standard sendes kun strukturen til udbyderen. Afkrydsningsfeltet **»Tillad læsning af
data«** lader Copilot læse rækker i samtalen (højst 50 pr. læsning) og svare ud fra dem — hver
læsning listes under svaret.

## Dashboardenes Copilot

I afsnittet [Dashboards](/basedb/da/fonctionnalites/tableaux-de-bord/#copilot) foreslår
Copilot spørgsmål, ændringer af dashboardet og værdier til dets filtre, som kan anvendes med ét
klik. Samme regler: uden samtykke sendes kun strukturen — tabeller og felter, databasens
dashboards og spørgsmål, definitionen af kortene på det viste dashboard (deres spørgsmål, deres
tekster) —, aldrig resultaterne eller de værdier, der er valgt i filtrene. Afkrydsningsfeltet
**»Tillad læsning af data«** tilføjer disse værdier og kortenes resultater under de viste
filtre, højst 50 rækker pr. læsning, hver listet under svaret.

## Automatiseringernes Copilot

I afsnittet [Automatiseringer](/basedb/da/fonctionnalites/automatisations/#copilot) foreslår
Copilot en hel automatisering — den på skærmen, ændret, eller en ny — som den lægger på editorens
flow **uden nogensinde at gemme den**: du gennemlæser den og gemmer den derefter. Samme regler:
uden samtykke sendes kun strukturen — tabeller og felter, databasens automatiseringer, den på
skærmen, dens seneste kørsler uden nogen værdier, personer og Slack-kanaler under
pladsholdere —, og afkrydsningsfeltet **»Tillad læsning af data«** tilføjer læste rækker, højst
50 pr. læsning.

`BASEDB_AI_QUOTA` begrænser de interaktive kald pr. time og pr. arbejdsområde (120 som
standard).
