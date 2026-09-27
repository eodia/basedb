---
title: Databasmallar
description: Utgå från en mall, be AI om en, skriv din egen i JSON – och publicera den för alla instanser.
---

En **mall** skapar en hel databas med ett klick: dess tabeller och deras relationer,
exempelrader, vyer, en instrumentpanel, automatiseringar och fält som AI fyller i själv.
[Mallgalleriet](/basedb/sv/modeles/) visar de mallar som basedb erbjuder.

## Utgå från en mall

**Ny databas**, sedan **Utgå från en mall eller be AI om en**: galleriet öppnas.

![Mallgalleriet, i programmet](../../../../assets/screens/modeles.png)

Varje mall kan läsas i sin helhet innan den används – tabellerna och deras fält, vyerna,
automatiseringarna och instruktionen för vart och ett av AI-fälten. **Skapa databasen** frågar
efter dess etikett och, om det finns AI-fält, ditt godkännande till att de värden de citerar
skickas till instansens AI-leverantör. Utan det godkännandet är de vanliga fält, ifyllda med
sina exempelvärden.

**Läs in exempeldata**, ikryssad från början, fyller tabellerna med exempelrader så att du kan se
databasen i praktiken. Avbockad förblir tabellerna tomma, redo för dina egna data — vyer,
instrumentpaneler och automatiseringar skapas ändå.

Ett tomt projekt erbjuder också **demodatabasen**: en liten byrå med kunder, projekt, uppgifter,
fakturor och omdömen, som visar alla sidor av basedb.

## På ditt språk

De officiella mallarna läses och skapas **på skärmens språk**: tabeller, fält, val, exempelrader,
vyer, instrumentpaneler, automatiseringar och AI-instruktioner. Exempelraderna byter värld med
språket: det franska bageriet ”Boulangerie Martin” i Lyon blir ”Martins bageri” i Göteborg på
svenska.

En mall som importeras till din instans, eller sparas från en databas, är skriven av någon: den
läses som den skrevs.

## Be AI om en mall

Högst upp i galleriet beskriver du ditt behov med en mening – ”uppföljning av mina kunders
reklamationer, med en analys av tonen”. AI föreslår en komplett databas: tabeller, trovärdiga
exempelrader, vyer, en instrumentpanel och AI-fält där användningen passar för det. Du läser den
som en mall, du kan **finslipa** den (”lägg till en tabell med leverantörer”) och sedan skapa
den. AI får bara din mening – inga data från någon databas – och ingenting skapas förrän du
klickar.

## Skriva en mall i JSON

En mall är ett JSON-dokument. Här är dess skelett:

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Une phrase pour la galerie.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tables": [
    {
      "key": "tickets",
      "label": "Tickets",
      "fields": [
        { "label": "Titre", "kind": "short_text" },
        { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", "Résolu"] },
        { "label": "Ouvert le", "kind": "date" },
        { "label": "Description", "kind": "long_text" },
        { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande"],
          "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } },
        { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" }
      ]
    },
    { "key": "produits", "label": "Produits", "fields": [{ "label": "Nom", "kind": "short_text" }] }
  ],
  "links": [{ "from": "tickets", "label": "Produit", "to": "produits" }],
  "rows": {
    "produits": [{ "$key": "app", "Nom": "Application mobile" }],
    "tickets": [{ "Titre": "Crash au démarrage", "Statut": "En cours", "Ouvert le": "-3d", "Produit": "@app" }]
  },
  "views": [
    { "table": "tickets", "label": "Tableau", "kind": "kanban", "spec": { "group_by": "Statut" } }
  ],
  "dashboards": [
    { "label": "Vue d’ensemble", "blocks": [
      { "kind": "number", "title": "Ouverts", "table": "tickets", "filter": "[Statut] ne \"Résolu\"" },
      { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" }
    ] }
  ],
  "automations": []
}
```

De viktigaste reglerna:

- **Allt citeras via etikett**: ett fält i en vy, ett filter (`[Statut] ne "Résolu"`), en
  formel (`[Prix] * [Quantité]`), en AI-instruktion eller ett meddelande (`{{Titre}}`). Ett val
  anges med sin etikett.
- Det **första fältet** i en tabell är dess visningsfält: en text, ett tal, ett datum, en
  e-postadress eller en adress.
- En **relation** deklareras i `links`, aldrig som ett fält; en rad pekar dit med `"@clé"`,
  `$key` för en rad i måltabellen.
- Ett **datum** kan vara relativt till den dag då mallen tillämpas: `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"`; ett datum med tid lägger till klockslaget, `"+1d 14:30"`. En person skrivs
  `"$moi"`.
- Ett **AI-fält** har `"ai": { "prompt": "…" }` och kan få ett exempelvärde, som bara skrivs
  när AI inte används.
- En mall innehåller **aldrig** delningar, behörigheter, webhooks, filer eller andra personer än
  `"$moi"`: den kommer ibland utifrån och får inte öppna något.

Den fullständiga referensen – alla fälttyper, alla nycklar för vyer, gränserna – finns i
kapitel 20 i arkitekturdokumentationen, i repot.

## Publicera en mall för alla instanser

Mallarna i det officiella galleriet är filerna i mappen
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
i repot, en fil per mall, namngiven efter dess `key`. Den offentliga webbplatsen gör
[galleriet](/basedb/sv/modeles/) av dem och publicerar hela katalogen på adressen
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json). Varje instans läser den
när någon öppnar galleriet och behåller den i en timme: det räcker att ändra en fil och
publicera om webbplatsen för att ändra galleriet på alla instanser.

Varje mall kontrolleras när webbplatsen byggs, med samma validerare som servern: en ogiltig mall
får bygget att misslyckas i stället för att nå användarna.

En officiell mall skrivs en gång, på franska. Dess texter på ett annat språk är en ordbok,
[`packages/templates/i18n/<langue>/<clé>.json`](https://github.com/eodia/basedb/tree/main/packages/templates/i18n)
— den franska texten, följd av sin översättning —, som webbplatsen publicerar bredvid katalogen
(`/basedb/modeles/i18n/<langue>.json`). Instansen sätter in varje text där och följer varje
etikett där den citeras — formler, filter, vyer, instruktioner —, och läser sedan igenom
resultatet: en ordbok som skulle förstöra mallen serveras inte, då serveras den franska mallen.
En text som saknas i ordboken förblir på franska.

Instansen läser adressen `BASEDB_TEMPLATES_URL` – som standard den offentliga webbplatsens. Peka
den mot en egen katalog, eller sätt den till `off` för att inte läsa någon: instansen visar då
de mallar som är inbyggda i dess version.

## Mallarna på din instans

En administratör kan **importera en JSON-mall** till sin instans, från galleriet
(”Importera JSON”): den hamnar i galleriet för alla instansens användare och ersätter en mall med
samma nyckel. Ett förslag från AI kan läggas till där med ett klick.

Alla databaser kan också bli en mall: **Spara som mall** i databasens meny, under **Fler
åtgärder**. Dess tabeller, fält, AI-instruktioner, relationer, delade vyer, instrumentpaneler och
automatiseringar – och, om du vill, upp till 50 rader per tabell – laddas ned som JSON, redo att
läggas till i den officiella katalogen eller i instansens. En automatisering som hittar en rad,
tar olika grenar eller citerar ett tidigare steg lämnas utanför tills vidare, och skärmen säger
det.
