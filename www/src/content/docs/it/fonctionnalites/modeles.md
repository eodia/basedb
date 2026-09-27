---
title: Modelli di database
description: Partire da un modello, chiederlo all’IA, scriverne uno in JSON — e pubblicarlo per tutte le istanze.
---

Un **modello** crea un intero database con un clic: le sue tabelle e le loro relazioni, righe
di esempio, viste, una dashboard, automazioni, e campi che l’IA
compila da sola. La [galleria dei modelli](/basedb/it/modeles/) mostra quelli che basedb propone.

## Partire da un modello

**Nuovo database**, poi **Parti da un modello o chiedilo all’IA**: si apre la galleria.

![La galleria dei modelli, nell’applicazione](../../../../assets/screens/modeles.png)

Ogni modello si può leggere per intero prima di usarlo — le sue tabelle e i loro campi, le sue viste,
le sue automazioni e l’istruzione di ciascuno dei suoi campi IA. **Crea database** chiede
la sua etichetta e, se ci sono campi IA, il tuo consenso affinché i valori che citano
vengano inviati al fornitore di IA dell’istanza. Senza questo consenso, sono campi
ordinari, compilati con i loro valori di esempio.

Un progetto vuoto propone anche il **database di dimostrazione**: una piccola agenzia, i suoi clienti,
progetti, attività, fatture e recensioni, che mostra tutte le sfaccettature di basedb.

## Chiederlo all’IA

In cima alla galleria, descrivi la tua esigenza in una frase — «il monitoraggio dei reclami dei
miei clienti, con un’analisi del tono». L’IA propone un database completo: tabelle, righe
di esempio credibili, viste, dashboard, e campi IA quando l’uso si presta. Lo
leggi come un modello, puoi **perfezionarlo** («aggiungi una tabella dei fornitori»),
poi crearlo. L’IA riceve solo la tua frase — nessun dato di nessun database — e nulla viene
creato prima del tuo clic.

## Scrivere un modello in JSON

Un modello è un documento JSON. Eccone lo scheletro:

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

Le regole essenziali:

- **Tutto si cita per etichetta**: un campo in una vista, un filtro (`[Statut] ne "Résolu"`), una
  formula (`[Prix] * [Quantité]`), un’istruzione IA o un messaggio (`{{Titre}}`). Una scelta si
  indica con la sua etichetta.
- Il **primo campo** di una tabella è il suo campo principale: un testo, un numero, una data,
  un’email o un indirizzo web.
- Una **relazione** si dichiara in `links`, mai come campo; una riga vi rimanda con
  `"@clé"`, la `$key` di una riga della tabella di destinazione.
- Una **data** può essere relativa al giorno in cui il modello viene applicato: `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"`; una data e ora aggiunge l’ora, `"+1d 14:30"`. Una persona si scrive `"$moi"`.
- Un **campo IA** contiene `"ai": { "prompt": "…" }` e può ricevere un valore di esempio, scritto
  solo quando l’IA non viene usata.
- Un modello non contiene **mai** condivisioni, permessi, webhook, file o persone
  diverse da `"$moi"`: a volte proviene da altrove, e non deve aprire nulla.

Il riferimento completo — tutti i tipi di campo, tutte le chiavi delle viste, i limiti — si trova nel
capitolo 20 della documentazione di architettura, nel repository.

## Pubblicare un modello per tutte le istanze

I modelli della galleria ufficiale sono i file della cartella
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
del repository, un file per modello, chiamato secondo la sua `key`. Il sito pubblico ne ricava la
[galleria](/basedb/it/modeles/) e pubblica l’intero catalogo all’indirizzo
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json). Ogni istanza lo legge
quando qualcuno apre la galleria, e lo conserva per un’ora: modificare un file e ripubblicare il
sito basta a cambiare la galleria di tutte le istanze.

Ogni modello viene verificato durante la build del sito, dallo stesso validatore del server:
un modello non valido fa fallire la build invece di arrivare agli utenti.

L’istanza legge l’indirizzo `BASEDB_TEMPLATES_URL` — per impostazione predefinita quello del sito pubblico. Puntalo
verso un tuo catalogo, oppure imposta `off` per non leggerne nessuno: l’istanza serve allora i
modelli integrati nella sua versione.

## I modelli della tua istanza

Un amministratore può **importare un modello JSON** nella propria istanza, dalla galleria
(«Importa un JSON»): entra nella galleria di tutti i suoi utenti e sostituisce un modello
con la stessa chiave. Una proposta dell’IA può esservi aggiunta con un clic.

Qualsiasi database può anche diventare un modello: **Salva come modello** nel menu del
database, sotto **Altre azioni**. Le sue tabelle, campi, istruzioni IA, relazioni, viste condivise, dashboard e
automazioni — e, se vuoi, fino a 50 righe per tabella — si scaricano in
JSON, pronti a entrare nel catalogo ufficiale o in quello dell’istanza. Un’automazione che
cerca una riga, prende rami o cita un passaggio precedente resta esclusa per
ora, e la schermata lo indica.
