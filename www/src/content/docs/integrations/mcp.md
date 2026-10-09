---
title: Serveur MCP
description: Brancher un agent IA sur basedb par le Model Context Protocol.
---

basedb expose un **serveur MCP** (`POST /mcp`, à la même adresse que l’interface) : un agent — Claude, un
assistant de code, votre propre agent — y découvre les bases, lit et écrit des lignes, en
supprime si vous le lui permettez, et **propose** des évolutions de structure.

## Brancher un agent

Créez un jeton depuis **Jetons API et MCP…** (menu de la base, sous **API et agents**), accès MCP coché. Le même jeton
sert à l’API REST et au MCP, et ouvre **toute la base** : sa production et ses autres environnements
(voir plus bas).

Mettez le jeton dans une variable d’environnement, `BASEDB_TOKEN`, jamais dans un fichier de configuration.
Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement `…/mcp` avec l’en-tête
`Authorization: Bearer <jeton>`. Avec Claude Code :

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

La commande écrit le fichier `.mcp.json` du projet, où `${BASEDB_TOKEN}` reste une référence à la
variable : le jeton lui-même n’y figure pas.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Un client qui ne sait lancer que des programmes locaux (stdio) passe par le relais du dépôt, qui lit
le jeton dans la variable que nomme `--token-env` :

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Demandez ensuite à l’agent d’appeler `whoami` : il dit qui a créé le jeton, quelle base il ouvre, ses
environnements et ses droits.

## Choisir l’environnement

Une base peut avoir plusieurs [environnements](/basedb/fonctionnalites/environnements/) — production,
recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous,
et l’environnement se choisit, du plus large au plus précis :

- **le nom de la base**, sans rien d’autre : `crm` est la production, `crm_recette` la recette ;
- **l’adresse du serveur** : `…/mcp?environment=recette` vise la recette pour toute la connexion. Le
  relais fait de même avec `--environment recette`. On déclare ainsi un serveur par environnement, tous
  sur le même jeton :

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **l’argument `environment`** de chaque outil qui nomme une base, pour un seul appel :
  `list_records` avec `{"base": "crm", "table": "clients", "environment": "recette"}`.

Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents
(`Recette`, `recette`, `developpement` pour « Développement »), ou par `production`. `whoami` liste ceux
que le jeton ouvre ; `list_bases` et `describe_base` disent de quel environnement est chaque base.

Un jeton peut aussi être limité à un seul environnement, à sa création : il n’en voit alors aucun autre.

## Les quinze outils

| Outil | Rôle |
|---|---|
| `whoami` | qui est l’agent, avec quels droits, sur quels environnements |
| `list_bases`, `describe_base`, `describe_table` | découvrir la structure, ses descriptions et son apparence |
| `list_records`, `get_record`, `lookup_records` | lire, filtrer, résoudre une valeur d’affichage |
| `create_record`, `update_record` | écrire des lignes |
| `delete_record`, `restore_record` | supprimer une ligne — avec un jeton créé pour cela — et la ramener |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proposer une évolution de structure |
| `propose_update_look` | proposer la couleur et le pictogramme d’une table et de ses choix |

## Couleurs et pictogrammes

Une table, et chaque choix d’une liste de choix, ont une couleur et un pictogramme, comme dans
l’interface. L’agent les choisit en proposant :

- `propose_create_table` accepte `color` et `icon` pour la table ;
- `propose_add_field` accepte `color` et `icon` sur chaque option d’un `select` ou d’un `multi_select` ;
- `propose_update_look` change ceux d’une table existante et de ses choix : une clé omise garde ce qui
  est en place, `null` l’efface.

`color` est une couleur `#rrggbb`. `icon` est le nom d’un pictogramme
[Lucide](https://lucide.dev/icons/) parmi ceux que l’interface dessine — `truck`, `circle-check`,
`flame`… : le schéma de l’outil les énumère, et un nom inconnu est refusé. `describe_base` et
`describe_table` rendent l’apparence actuelle. Un champ, lui, n’a pas de pictogramme à choisir :
l’interface dessine celui de son type.

## Supprimer des lignes

Un jeton créé avec les droits **Lecture, écriture et suppression** permet à l’agent de supprimer
des lignes, **une à la fois**, par leur `_id`. `delete_record` rend la ligne telle qu’elle était,
et la suppression est historisée au nom du jeton ; `restore_record` ramène la ligne sous son
`_id` — l’agent défait lui-même son erreur, et une personne le peut aussi depuis l’historique.

L’agent ne supprime pas :

- avec un jeton en lecture, ou en lecture et écriture : le refus dit quel jeton créer ;
- une ligne qu’une relation en cascade emporterait avec d’autres (`TOKEN_CASCADE_FORBIDDEN`) :
  cette suppression se fait dans l’interface, par une personne qui voit ce qu’elle emporte ;
- plusieurs lignes d’un coup : aucun outil ne le fait.

## Ce qu’un agent ne fait pas

- **Il ne supprime qu’avec votre accord** : un jeton créé pour cela, une ligne à la fois.
- **Il ne change pas la structure** — ni son apparence : il la propose. La proposition attend dans
  **Propositions des agents…** (menu de la base), où une personne qui gère la structure l’approuve ou
  la refuse ; sans décision, elle expire au bout de 24 heures.
- **Il n’a jamais plus de droits** que la personne qui a créé son jeton : les droits du jeton sont
  intersectés avec les siens, environnement par environnement.
- Il ne voit pas les champs marqués invisibles pour les agents, ni les bases fermées au MCP.

Chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.
