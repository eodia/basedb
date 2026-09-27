---
title: Databaseskabeloner
description: Start fra en skabelon, bed AI om en, skriv din egen i JSON — og udgiv den til alle instanser.
---

En **skabelon** opretter en hel database med ét klik: dens tabeller og deres relationer,
eksempelrækker, visninger, et dashboard, automatiseringer og felter, som AI selv udfylder.
[Skabelongalleriet](/basedb/da/modeles/) viser dem, som basedb tilbyder.

## Start fra en skabelon

**Ny database** og derefter **Start fra en skabelon, eller bed AI om en**: galleriet åbnes.

![Skabelongalleriet i applikationen](../../../../assets/screens/modeles.png)

Hver skabelon kan læses i sin helhed, før den bruges — dens tabeller og deres felter, dens
visninger, dens automatiseringer og instruktionen for hvert af dens AI-felter. **Opret
database** beder om en etiket og, hvis der er AI-felter, dit samtykke til, at de værdier, de
citerer, sendes til instansens AI-udbyder. Uden dette samtykke er de almindelige felter, udfyldt
med deres eksempelværdier.

Et tomt projekt tilbyder også **demodatabasen**: et lille bureau med dets kunder, projekter,
opgaver, fakturaer og anmeldelser, som viser alle sider af basedb.

## Bed AI om en skabelon

Øverst i galleriet beskriver du dit behov i én sætning — »opfølgning på mine kunders
reklamationer med en analyse af tonen«. AI foreslår en komplet database: tabeller,
troværdige eksempelrækker, visninger, dashboard og AI-felter, når brugen egner sig til det. Du
læser den som en skabelon, du kan **finjustere** den (»tilføj en tabel med leverandører«) og
derefter oprette den. AI modtager kun din sætning — ingen data fra nogen database — og intet
oprettes, før du klikker.

## Skriv en skabelon i JSON

En skabelon er et JSON-dokument. Her er skelettet:

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

De vigtigste regler:

- **Alt citeres med etiket**: et felt i en visning, et filter (`[Statut] ne "Résolu"`), en
  formel (`[Prix] * [Quantité]`), en AI-instruktion eller en besked (`{{Titre}}`). Et valg
  angives med sin etiket.
- Det **første felt** i en tabel er dens visningsfelt: en tekst, et tal, en dato, en e-mail
  eller en adresse.
- En **relation** erklæres i `links`, aldrig som et felt; en række henviser til den med
  `"@clé"`, `$key` for en række i måltabellen.
- En **dato** kan være relativ til den dag, skabelonen anvendes: `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"`; en dato med klokkeslæt tilføjer klokkeslættet, `"+1d 14:30"`. En person
  skrives `"$moi"`.
- Et **AI-felt** har `"ai": { "prompt": "…" }` og kan få en eksempelværdi, som kun skrives, når
  AI ikke bruges.
- En skabelon indeholder **aldrig** delinger, tilladelser, webhooks, filer eller andre personer
  end `"$moi"`: den kommer nogle gange udefra og må ikke åbne for noget.

Den komplette reference — alle felttyper, alle nøgler for visninger, grænserne — findes i kapitel
20 i arkitekturdokumentationen i repositoriet.

## Udgiv en skabelon til alle instanser

Skabelonerne i det officielle galleri er filerne i mappen
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
i repositoriet, én fil pr. skabelon, navngivet efter dens `key`. Det offentlige websted laver
[galleriet](/basedb/da/modeles/) ud fra dem og udgiver hele kataloget på adressen
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json). Hver instans læser det, når
nogen åbner galleriet, og beholder det i en time: at ændre en fil og udgive webstedet igen er nok
til at ændre galleriet på alle instanser.

Hver skabelon kontrolleres, når webstedet bygges, af den samme validator som serveren: en
ugyldig skabelon får bygningen til at mislykkes i stedet for at nå ud til brugerne.

Instansen læser adressen `BASEDB_TEMPLATES_URL` — som standard det offentlige websteds. Peg den
mod dit eget katalog, eller sæt den til `off` for ikke at læse noget: instansen serverer så de
skabeloner, der er indbygget i dens version.

## Skabelonerne på din instans

En administrator kan **importere en JSON-skabelon** på sin instans fra galleriet
(»Importér en JSON«): den kommer med i galleriet for alle instansens brugere og erstatter en
skabelon med samme nøgle. Et forslag fra AI kan tilføjes der med ét klik.

Enhver database kan også blive til en skabelon: **Gem som skabelon** i databasens menu under
**Flere handlinger**. Dens tabeller, felter, AI-instruktioner, relationer, delte visninger, dashboards og
automatiseringer — og, hvis du vil, op til 50 rækker pr. tabel — downloades som JSON, klar til
at komme med i det officielle katalog eller i instansens. En automatisering, der finder en
række, tager grene eller citerer et tidligere trin, udelades indtil videre, og skærmen siger det.
