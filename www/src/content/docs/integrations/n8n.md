---
title: n8n
description: Lire et écrire les lignes de basedb depuis un workflow n8n, et en lancer un à chaque ligne créée, modifiée ou supprimée.
---

Le paquet **n8n-nodes-basedb** ajoute trois nœuds à n8n :

| Nœud | Rôle |
|---|---|
| **basedb** | lire et écrire les lignes d’une table, commenter une ligne ; utilisable comme outil par un agent IA de n8n |
| **basedb Trigger** | lancer un workflow pour chaque ligne créée — ou créée ou modifiée — depuis la dernière relève |
| **basedb Webhook Trigger** | lancer un workflow à l’instant où une ligne est créée, modifiée ou supprimée |

## Installer

Dans n8n : **Settings › Community Nodes › Install**, puis `n8n-nodes-basedb`.

Sans l’interface — mode file d’attente, image Docker montée d’avance — : `npm install
n8n-nodes-basedb` dans le dossier `~/.n8n/nodes`, puis redémarrez n8n.

## Les identifiants

Créez dans n8n un identifiant **basedb API** :

| Champ | Valeur |
|---|---|
| **Instance URL** | l’adresse où vous ouvrez basedb : `https://basedb.exemple.fr` |
| **Workspace** | la référence de l’espace, celle des adresses de l’API (`/api/v1/<espace>/…`) : `t4z56fq`, sauf si l’instance fixe `BASEDB_TENANT` |
| **Token** | un **jeton d’intégration** : menu **⋯** de la base → **API et agents** → **Jetons API et MCP…** |

Un jeton ouvre **une** base. Il lit ses lignes, les écrit s’il a été créé en écriture, et n’a
jamais plus de droits que la personne qui l’a créé. À l’enregistrement, n8n essaie la connexion
et dit si le jeton est refusé.

## Lire et écrire : le nœud basedb

| Opération | Ce qu’elle fait |
|---|---|
| **Row › Create** | ajoute une ligne |
| **Row › Create or Update** | modifie la ligne dont les champs choisis portent ces valeurs, ou l’ajoute si aucune ne les porte |
| **Row › Get** | lit une ligne par son `_id` |
| **Row › Get Many** | lit les lignes d’un filtre, dans l’ordre demandé, jusqu’à une limite ou toutes, page après page |
| **Row › Update** | modifie une ligne, trouvée par son `_id` ou par d’autres champs |
| **Comment › Create** | commente une ligne ; une @mention prévient la personne |

La **base** et la **table** se choisissent dans des listes, celles que le jeton ouvre. Les champs
à écrire s’affichent avec leur nom dans basedb, une liste de choix avec ses options, un champ
Personne avec les membres de l’espace ; un champ calculé — formule, recherche, cumul, numéro
automatique — n’y figure pas, puisque basedb l’écrit lui-même. Une valeur que le champ refuse
arrête le nœud sur le code de basedb et ce qu’il veut dire.

- Le **filtre** et le **tri** emploient les noms techniques des champs, ceux du SQL :
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. La grammaire est celle de
  l’[API REST](/basedb/integrations/api-rest/#lire).
- Les **nombres** arrivent en texte décimal (`"1250.50"`), pour ne perdre aucun chiffre ;
  l’option **Numbers as Numbers** les convertit en nombres.
- Une **relation** se lit `{ "id": …, "display": … }` et s’écrit par l’`_id` de la ligne liée.
- **Create or Update** ne modifie jamais plusieurs lignes : si plusieurs portent les valeurs,
  le nœud s’arrête plutôt que de deviner.
- Pas d’opération **Delete** : pour retirer des lignes, marquez-les (un statut « Archivé »),
  confiez la suppression à une [automatisation](/basedb/fonctionnalites/automatisations/), ou
  appelez l’[API REST](/basedb/integrations/api-rest/) avec un jeton créé pour supprimer.

## Lancer un workflow

### À chaque relève : basedb Trigger

Le nœud demande à basedb, au rythme choisi (toutes les minutes, toutes les heures…), les lignes
**créées** — ou **créées ou modifiées** — depuis la dernière fois, un filtre en plus si besoin.
Il marche partout, même quand basedb ne peut pas joindre n8n. À sa première relève, il note où
en est la table et n’émet rien ; un essai depuis l’éditeur rend la dernière ligne, pour avoir
de quoi relier les nœuds suivants.

### À l’instant : basedb Webhook Trigger

Chaque ligne créée, modifiée ou supprimée — même par du SQL écrit directement dans PostgreSQL —
lance le workflow aussitôt :

1. Ajoutez le nœud et copiez son **Production URL**.
2. Dans basedb, menu **⋯** de la base → **API et agents** → **Webhooks…** : créez un webhook vers
   cette adresse, choisissez ses tables et ses événements.
3. basedb affiche une fois le **secret de signature** : placez-le dans un identifiant
   **basedb Webhook** de n8n.
4. Activez le workflow.

Chaque événement devient un élément : son `type` (`record.created`, `record.updated`,
`record.deleted`), la table, la ligne **avant** et **après**, et les champs changés (`changed`).
Le nœud vérifie la **signature** de chaque livraison et répond `401` à celle qui n’en a pas, qui
en a une fausse, ou qui date de plus de cinq minutes. basedb livre **au moins une fois** :
dédoublonnez sur l’`id` de l’événement si le workflow ne doit pas le traiter deux fois.

:::note
basedb n’envoie de webhook qu’à une adresse **HTTPS publique** : un n8n sur un réseau privé
emploie plutôt **basedb Trigger**. Voir [Webhooks](/basedb/integrations/webhooks/).
:::

## Sans le nœud

Le nœud **HTTP Request** de n8n parle aussi à basedb : en-tête `Authorization: Bearer <jeton>`,
JSON à l’aller et au retour, pagination par `meta.next_cursor` passé en `after`
(`{{ $response.body.meta.next_cursor }}`), et reprise après une panne par un filtre sur
`_updated_at` et par `…/<table>/deleted?since=`.
