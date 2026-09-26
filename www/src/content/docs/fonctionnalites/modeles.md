---
title: Modèles de base
description: Partir d’un modèle, le demander à l’IA, écrire le sien en JSON — et le publier pour toutes les instances.
---

Un **modèle** crée une base entière d’un clic : ses tables et leurs relations, des lignes
d’exemple, des vues, un tableau de bord, des automatisations, et des champs que l’IA
remplit elle-même. La [galerie des modèles](/basedb/modeles/) montre ceux que basedb propose.

## Partir d’un modèle

**Nouvelle base**, puis **Partir d’un modèle, ou le demander à l’IA** : la galerie s’ouvre.

![La galerie des modèles, dans l’application](../../../assets/screens/modeles.png)

Chaque modèle se lit en entier avant d’être utilisé — ses tables et leurs champs, ses vues,
ses automatisations, et la consigne de chacun de ses champs IA. **Créer la base** demande
son libellé et, s’il y a des champs IA, votre accord pour que les valeurs qu’ils citent
partent chez le fournisseur d’IA de l’instance. Sans cet accord, ce sont des champs
ordinaires, remplis de leurs valeurs d’exemple.

Un projet vide propose aussi la **base de démonstration** : une petite agence, ses clients,
projets, tâches, factures et avis, qui montre toutes les facettes de basedb.

## Le demander à l’IA

En tête de la galerie, décrivez votre besoin en une phrase — « le suivi des réclamations de
mes clients, avec une analyse du ton ». L’IA propose une base complète : tables, lignes
d’exemple crédibles, vues, tableau de bord, et des champs IA quand l’usage s’y prête. Vous la
lisez comme un modèle, vous pouvez l’**affiner** (« ajoute une table des fournisseurs »),
puis la créer. L’IA ne reçoit que votre phrase — aucune donnée d’aucune base — et rien n’est
créé avant votre clic.

## Écrire un modèle en JSON

Un modèle est un document JSON. En voici le squelette :

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

Les règles essentielles :

- **Tout se cite par libellé** : un champ dans une vue, un filtre (`[Statut] ne "Résolu"`), une
  formule (`[Prix] * [Quantité]`), une consigne IA ou un message (`{{Titre}}`). Un choix se
  donne par son libellé.
- Le **premier champ** d’une table est sa colonne d’affichage : un texte, un nombre, une date,
  un e-mail ou une adresse.
- Une **relation** se déclare dans `links`, jamais comme un champ ; une ligne y renvoie par
  `"@clé"`, la `$key` d’une ligne de la table visée.
- Une **date** peut être relative au jour où le modèle est appliqué : `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"` ; une date-heure ajoute l’heure, `"+1d 14:30"`. Une personne s’écrit `"$moi"`.
- Un **champ IA** porte `"ai": { "prompt": "…" }` et peut recevoir une valeur d’exemple, écrite
  seulement quand l’IA n’est pas utilisée.
- Un modèle ne contient **jamais** de partage, de droit, de webhook, de fichier ou de personne
  autre que `"$moi"` : il vient parfois d’ailleurs, et ne doit rien ouvrir.

La référence complète — tous les types de champs, toutes les clés de vues, les bornes — est au
chapitre 20 de la documentation d’architecture, dans le dépôt.

## Publier un modèle pour toutes les instances

Les modèles de la galerie officielle sont les fichiers du dossier
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
du dépôt, un fichier par modèle, nommé d’après sa `key`. Le site public en fait la
[galerie](/basedb/modeles/) et publie le catalogue entier à l’adresse
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json). Chaque instance le lit
quand quelqu’un ouvre la galerie, et le garde une heure : modifier un fichier et republier le
site suffit à changer la galerie de toutes les instances.

Chaque modèle est vérifié à la construction du site, par le même validateur que le serveur :
un modèle invalide fait échouer la construction au lieu d’arriver chez les utilisateurs.

L’instance lit l’adresse `BASEDB_TEMPLATES_URL` — par défaut celle du site public. Pointez-la
vers un catalogue à vous, ou mettez `off` pour n’en lire aucun : l’instance sert alors les
modèles intégrés à sa version.

## Les modèles de votre instance

Un administrateur peut **importer un modèle JSON** dans son instance, depuis la galerie
(« Importer un JSON ») : il rejoint la galerie de tous ses utilisateurs, et remplace un modèle
de même clé. Une proposition de l’IA peut y être ajoutée d’un clic.

Toute base peut aussi devenir un modèle : **Enregistrer comme modèle** dans le menu de la
base. Ses tables, champs, consignes IA, relations, vues partagées, tableaux de bord et
automatisations — et, si vous le voulez, jusqu’à 50 lignes par table — se téléchargent en
JSON, prêts à rejoindre le catalogue officiel ou celui de l’instance.
