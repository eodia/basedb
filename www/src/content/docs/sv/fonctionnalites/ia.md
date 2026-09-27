---
title: Artificiell intelligens
description: AI-alternativet för ett fält, utkasten, Copilot och Copilot för instrumentpaneler – och vad som skickas till leverantören.
---

AI är **valfritt**. Utan en konfigurerad leverantör skickas ingenting någonstans. basedb kan
prata med **OpenAI**, **Anthropic** och **Mistral**, med din egen nyckel.

## Konfigurera en leverantör

Så länge ingen inställning har sparats i gränssnittet läser API:et sin miljö:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic eller mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # eller BASEDB_AI_API_KEY
```

Nyckeln läses från `BASEDB_AI_API_KEY`, eller i annat fall från leverantörens vanliga namn
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## AI-alternativet för ett fält

AI är inte en fälttyp utan ett **alternativ**: reglaget **AI** i ett fälts formulär – text, lång
text, URL, tal, enkelval, boolesk, datum – låter en modell fylla i fältet utifrån en instruktion
som citerar andra kolumner:

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Fältet beräknas så snart raden finns, och sedan varje gång en citerad kolumn ändras – och, om
  du vill, enligt ett schema (som oftast var 15:e minut).
- Kolumnen **behåller sin typ**: ett svar där inget kan tolkas i den typen (ett tal som inte
  går att hitta, ett val som inte finns) avvisas i stället för att skrivas.
- Stänger du av alternativet kan fältet åter redigeras för hand, och värdena behålls.
- De citerade värdena skickas till leverantören: **aktiveringen kräver ett uttryckligt
  samtycke**.

`BASEDB_AI_FIELD_QUOTA` begränsar dessa beräkningar per timme och per arbetsyta (300 som
standard).

## I en automatisering

En [automatisering](/basedb/sv/fonctionnalites/automatisations/#fråga-ai) kan **fråga AI** i
ett av sina steg: en instruktion som citerar raden och de tidigare stegen, ett svar som tolkas i
den valda typen och som de följande stegen skriver, skickar eller citerar. Samma regler som för
ett fält: samtycke när du sparar, bara det som instruktionen citerar skickas, och varje anrop
loggas och räknas mot `BASEDB_AI_FIELD_QUOTA`.

## Utkast och Copilot

- **Utkast**: beskriv en tabell eller en formel med en mening och få ett förslag att läsa
  igenom. Bara etiketter, typer och den inskrivna meningen skickas – inga cellvärden.
- **Mallar**: beskriv en hel databas – ”uppföljning av mina kunders reklamationer” – och få
  tabeller, exempelrader, vyer, en instrumentpanel och automatiseringar, att finslipa och sedan
  skapa. Bara meningen skickas. Se [Databasmallar](/basedb/sv/fonctionnalites/modeles/#be-ai-om-en-mall).
- **Copilot**: en konversation om den visade databasen. Du ber om ett filter, en fråga, kolumner,
  en tabell, testdata; varje förslag kommer som ett kort och tillämpas med ett klick, via samma
  vägar som formulären.

Som standard skickas bara strukturen till leverantören. Rutan **”Tillåt läsning av data”**
låter Copilot, under konversationen, läsa rader (högst 50 per läsning) och svara utifrån dem –
varje läsning listas under svaret.

## Copilot för instrumentpaneler

I avsnittet [Instrumentpaneler](/basedb/sv/fonctionnalites/tableaux-de-bord/#copilot) föreslår
Copilot frågor, ändringar i panelen och värden för dess filter, som tillämpas med ett klick.
Samma regler: utan samtycke skickas bara strukturen – tabeller och fält, databasens paneler och
frågor, definitionen av korten i den visade panelen (deras frågor, deras texter) –, aldrig
resultaten eller de värden som valts i filtren. Rutan **”Tillåt läsning av data”** lägger till
de värdena och resultaten från korten under de visade filtren, högst 50 rader per läsning, och
var och en listas under svaret.

## Copilot för automatiseringar

I avsnittet [Automatiseringar](/basedb/sv/fonctionnalites/automatisations/#copilot) föreslår
Copilot en hel automatisering – den som visas på skärmen, ändrad, eller en ny – som den lägger på
redigerarens flöde, **utan att någonsin spara den**: du läser igenom den och sparar den sedan.
Samma regler: utan samtycke skickas bara strukturen – tabeller och fält, databasens
automatiseringar, den på skärmen, dess senaste körningar utan några värden, personer och
Slack-kanaler under platshållare –, och rutan **”Tillåt läsning av data”** lägger till lästa
rader, högst 50 per läsning.

`BASEDB_AI_QUOTA` begränsar de interaktiva anropen per timme och per arbetsyta (120 som
standard).
