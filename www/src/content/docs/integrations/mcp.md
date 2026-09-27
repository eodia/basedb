---
title: Serveur MCP
description: Brancher un agent IA sur basedb par le Model Context Protocol.
---

basedb expose un **serveur MCP** (`POST /mcp`, à la même adresse que l’interface) : un agent — Claude, un
assistant de code, votre propre agent — y découvre les bases, lit et écrit des lignes, et
**propose** des évolutions de structure.

## Brancher un agent

Créez un jeton depuis **Jetons API et MCP…** (menu de la base, sous **API et agents**), accès MCP coché. Le même jeton
sert à l’API REST et au MCP.

Pour un client qui parle HTTP, l’adresse est `http://localhost:3000/mcp` avec
`Authorization: Bearer <jeton>`. Pour un client qui lance des processus (stdio), le dépôt fournit
un relais qui lit le jeton dans une variable d’environnement — jamais dans la configuration :

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## Les douze outils

| Outil | Rôle |
|---|---|
| `whoami` | qui est l’agent, avec quels droits |
| `list_bases`, `describe_base`, `describe_table` | découvrir la structure et ses descriptions |
| `list_records`, `get_record`, `lookup_records` | lire, filtrer, résoudre une valeur d’affichage |
| `create_record`, `update_record` | écrire des lignes |
| `propose_create_table`, `propose_add_field`, `get_proposal` | proposer une évolution de structure |

## Ce qu’un agent ne fait pas

- **Il ne supprime rien.**
- **Il ne change pas la structure** : il la propose. La proposition attend dans **Propositions
  des agents…** (menu de la base), où une personne qui gère la structure l’approuve ou la refuse ;
  sans décision, elle expire au bout de 24 heures.
- **Il n’a jamais plus de droits** que la personne qui a créé son jeton : les droits du jeton sont
  intersectés avec les siens.
- Il ne voit pas les champs marqués invisibles pour les agents, ni les bases fermées au MCP.

Chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.
