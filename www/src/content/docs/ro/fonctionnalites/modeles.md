---
title: Șabloane pentru baze
description: Porniți de la un șablon, cereți-l de la AI, scrieți-vă propriul șablon în JSON — și publicați-l pentru toate instanțele.
---

Un **șablon** creează o bază întreagă cu un clic: tabelele și relațiile lor, rânduri de
exemplu, vizualizări, un tablou de bord, automatizări și câmpuri pe care AI-ul le completează
singur. [Galeria de șabloane](/basedb/ro/modeles/) arată ce propune basedb.

## Pornirea de la un șablon

**Bază nouă**, apoi **Porniți de la un șablon sau cereți-l de la AI**: se deschide galeria.

![Galeria de șabloane, în aplicație](../../../../assets/screens/modeles.png)

Fiecare șablon poate fi citit în întregime înainte de a fi folosit — tabelele și câmpurile
lui, vizualizările, automatizările și instrucțiunea fiecăruia dintre câmpurile lui AI.
**Creați baza** cere eticheta bazei și, dacă există câmpuri AI, acordul dumneavoastră ca
valorile pe care le citează să plece la furnizorul de AI al instanței. Fără acest acord, ele
sunt câmpuri obișnuite, completate cu valorile lor de exemplu.

Un proiect gol propune și **baza demonstrativă**: o mică agenție, cu clienții, proiectele,
sarcinile, facturile și recenziile ei, care arată toate fațetele basedb.

## Cereți-l de la AI

În partea de sus a galeriei, descrieți-vă nevoia într-o frază — „urmărirea reclamațiilor
clienților mei, cu o analiză a tonului”. AI-ul propune o bază completă: tabele, rânduri de
exemplu credibile, vizualizări, un tablou de bord și câmpuri AI acolo unde utilizarea se
pretează. O citiți ca pe un șablon, o puteți **rafina** („adaugă un tabel cu furnizorii”),
apoi o creați. AI-ul primește doar fraza dumneavoastră — nicio dată din nicio bază — și nimic
nu este creat înainte de clicul dumneavoastră.

## Scrierea unui șablon în JSON

Un șablon este un document JSON. Iată scheletul lui:

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

Regulile esențiale:

- **Totul se citează după etichetă**: un câmp într-o vizualizare, un filtru
  (`[Statut] ne "Résolu"`), o formulă (`[Prix] * [Quantité]`), o instrucțiune AI sau un mesaj
  (`{{Titre}}`). O opțiune se indică prin eticheta ei.
- **Primul câmp** al unui tabel este câmpul lui de afișare: un text, un număr, o dată, un
  e-mail sau o adresă.
- O **relație** se declară în `links`, niciodată ca un câmp; un rând trimite la ea prin
  `"@clé"`, `$key`-ul unui rând din tabelul vizat.
- O **dată** poate fi relativă la ziua în care se aplică șablonul: `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"`; o dată cu oră adaugă ora, `"+1d 14:30"`. O persoană se scrie `"$moi"`.
- Un **câmp AI** poartă `"ai": { "prompt": "…" }` și poate primi o valoare de exemplu, scrisă
  doar atunci când AI-ul nu este folosit.
- Un șablon nu conține **niciodată** partajări, permisiuni, webhook-uri, fișiere sau persoane
  în afară de `"$moi"`: uneori vine din altă parte și nu trebuie să deschidă nimic.

Referința completă — toate tipurile de câmpuri, toate cheile vizualizărilor, limitele — se află
în capitolul 20 al documentației de arhitectură, în depozit.

## Publicarea unui șablon pentru toate instanțele

Șabloanele din galeria oficială sunt fișierele din dosarul
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
al depozitului, câte un fișier pe șablon, numit după `key`-ul său. Site-ul public face din ele
[galeria](/basedb/ro/modeles/) și publică întregul catalog la adresa
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json). Fiecare instanță îl citește
când cineva deschide galeria și îl păstrează o oră: modificarea unui fișier și republicarea
site-ului sunt suficiente pentru a schimba galeria tuturor instanțelor.

Fiecare șablon este verificat la construirea site-ului, de același validator ca serverul: un
șablon invalid face construirea să eșueze în loc să ajungă la utilizatori.

Instanța citește adresa `BASEDB_TEMPLATES_URL` — în mod implicit cea a site-ului public.
Îndreptați-o către propriul dumneavoastră catalog sau setați `off` pentru a nu citi niciunul:
instanța servește atunci șabloanele integrate în versiunea ei.

## Șabloanele instanței dumneavoastră

Un administrator poate **importa un șablon JSON** în instanța sa, din galerie
(„Importați un JSON”): acesta intră în galeria tuturor utilizatorilor ei și înlocuiește un
șablon cu aceeași cheie. O propunere a AI-ului poate fi adăugată acolo cu un clic.

Orice bază poate deveni și ea un șablon: **Salvați ca șablon** în meniul bazei, sub **Alte
acțiuni**. Tabelele, câmpurile, instrucțiunile AI, relațiile, vizualizările partajate,
tablourile de bord și automatizările ei — și, dacă doriți, până la 50 de rânduri pe tabel — se
descarcă în JSON, gata să intre în catalogul oficial sau în cel al instanței. O automatizare
care caută un rând, ia ramuri sau citează un pas anterior rămâne deocamdată pe dinafară, iar
ecranul spune acest lucru.
