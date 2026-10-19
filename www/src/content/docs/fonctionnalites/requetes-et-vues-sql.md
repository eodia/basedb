---
title: Requêtes et vues SQL
description: Du SQL pour chacun, avec ses propres droits, dans une question que l’on enregistre sous les tables ; de vraies vues PostgreSQL rangées parmi les tables.
---

Vos tables sont de vraies tables PostgreSQL, et l’interface les interroge en SQL, sous leur vrai
nom. Chaque membre de la base peut écrire du SQL dans une **question**, l’**enregistrer** sous les
tables — pour lui seul, pour toute la base ou pour quelques groupes —, et qui gère la base peut en
faire une **vue SQL** : une vraie vue PostgreSQL, rangée parmi les tables, que `psql` et vos
outils lisent aussi.

![Une question SQL enregistrée, ouverte depuis la rubrique « Requêtes » ; au-dessus, deux vues SQL rangées parmi les tables](../../../assets/screens/fr/requete-sql.webp)

## Une question, à la souris ou en SQL

Le **+** de la barre d’onglets — ou menu **⋯** de la base → **Nouvelle question**, ou la palette
Ctrl+K — ouvre une question. En haut de l’onglet, une bascule **Éditeur visuel | SQL** dit comment
vous l’écrivez :

- **SQL** : un éditeur avec coloration et complétion des tables et des champs, **Mettre en forme**
  (Maj+Alt+F), **Ctrl+Entrée** pour exécuter — le texte sélectionné s’exécute seul —, et le
  résultat en tableau ou en graphique, au choix, comme pour toute question ;
- **Éditeur visuel** : la question se construit à la souris (voir les
  [tableaux de bord](/basedb/fonctionnalites/tableaux-de-bord/)).

Passer de l’un à l’autre est libre sur une question vide ; sur une question qui a déjà des étapes ou
du texte, basedb demande d’abord : le SQL ne se convertit pas en étapes, ni les étapes en SQL.

Un texte SQL peut citer des **variables** `{{nom}}` ; un panneau les règle (texte, nombre, date, ou
condition sur une colonne), et un filtre de tableau de bord peut les piloter.

## Chacun avec ses droits

Ce que l’exécution peut lire dépend de qui la lance, et de ce qu’elle est — l’éditeur le dit sous
le texte :

- un **brouillon** (une question pas encore enregistrée) de qui a le niveau **Gestion** sur la base
  garde la **console** : toute la base, écritures et plusieurs instructions comprises. Quand une
  exécution a écrit, elle le dit — « UPDATE · 6 lignes modifiées » — au lieu d’afficher un
  tableau ; un brouillon ne s’exécute jamais tout seul en s’ouvrant ;
- toute autre exécution est **en lecture seule, avec vos propres droits** : celle des niveaux
  **Lecture** ou **Édition**, celle d’un texte à variables, et celle de **toute question
  enregistrée, même par qui gère la base** — ce qu’on partage ne doit pas pouvoir écrire le jour où
  quelqu’un l’ouvre. Une table qui vous est fermée n’existe pas pour elle ; un champ qui vous est
  masqué disparaît de `SELECT *` et est refusé si vous le nommez, même en qualifiant la table ; une
  écriture est refusée.

![La question ne voit que les tables et les champs ouverts à la personne](../../../assets/screens/fr/sql-vos-droits.webp)

Ce n’est pas l’écran qui trie : PostgreSQL lui-même applique vos droits, colonne par colonne, sur
un rôle qui vous est propre. Une question ne peut donc rien vous montrer que la grille, l’API ou le
serveur MCP ne vous montreraient pas.

## Enregistrer une question

**Enregistrer**, dans l’en-tête, demande le nom et la portée, puis range la question — si elle est
écrite en SQL — sous les tables de la base, dans la rubrique **Requêtes** ; une question construite
se retrouve avec les tableaux de bord. Elle se rouvre d’un clic ; **⋯** → **Enregistrer une
copie…** en fait une copie, **Nom et partage…** (dans l’onglet ou dans son menu de la barre
latérale) la renomme, change qui la voit, ou la supprime — **Supprimer** est aussi dans son menu,
d’un clic droit. Un onglet qui la montrait garde son texte.

![Enregistrer une question : son nom, ce qu’elle montre, et qui la voit](../../../assets/screens/fr/requete-enregistrer.webp)

| Portée | Qui la voit | Qui peut la créer et la modifier |
|---|---|---|
| **Personnelle** — un cadenas | vous seul | quiconque voit la base, pour soi |
| **Toute la base** | quiconque voit la base | le niveau **Gestion** sur la base |
| **Des groupes** | les membres des groupes choisis | le niveau **Gestion** sur la base |

**Partager une question SQL partage son texte, jamais ce que son auteur peut lire.** Chacun
l’exécute avec ses propres droits : la même question, ouverte par deux personnes, montre à chacune
ce qu’elle a le droit de voir — ou lui dit qu’une colonne n’existe pas pour elle.

Une question ouverte depuis la barre latérale **s’exécute aussitôt, en lecture seule** : vous voyez
son résultat sans avoir rien décidé. **Exécuter** la relance ensuite telle qu’elle est. « Modifiée »
à côté de son nom signale que vous avez changé son texte depuis l’enregistrement ; **Enregistrer**
l’y range si vous pouvez la modifier, et propose sinon d’en faire une copie.

Les **requêtes enregistrées** des versions précédentes sont devenues des questions SQL, avec la même
portée, le même auteur et les mêmes groupes : leur adresse, vos signets et vos onglets ouverts les
retrouvent.

## Les vues SQL

Une **vue SQL** est une vraie vue PostgreSQL du schéma de la base. Elle prend place **parmi les
tables**, avec sa couleur et son pictogramme comme une table, et un petit **œil** à droite qui dit
que c’est une vue. Un clic l’ouvre dans un onglet : ses lignes dans la grille, **Actualiser** pour
les relire.

![La vue « Factures à encaisser », ouverte depuis la barre latérale](../../../assets/screens/fr/vue-sql.webp)

Elle se crée depuis une question SQL — réservé au niveau **Gestion** : **Enregistrer** a une
flèche ▾ → **Enregistrer comme vue SQL…**, et le texte de la question devient sa définition. Une
vue existante se modifie depuis son menu de la barre latérale ou son onglet (**Modifier la vue…**).
Le dialogue demande :

- son **libellé** et son **apparence** — couleur, pictogramme ou image, choisis comme pour une
  table ;
- son **nom technique**, tiré du libellé si vous n’en donnez pas — celui qu’on écrit après
  `FROM` ;
- sa **requête** : un seul `SELECT`, sur les tables et les autres vues de la base. PostgreSQL
  refuse ce qu’il refuse, et l’éditeur pointe l’endroit.

![Le dialogue d’une vue SQL : libellé et apparence, nom technique, requête, description](../../../assets/screens/fr/vue-sql-dialogue.webp)

La vue se lit ensuite sous son nom, depuis l’interface comme depuis `psql` ou votre outil de BI :

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Une vue ne montre jamais un champ qu’on ne voit pas.** Chacun la lit avec ses propres droits,
sur chaque table et chaque colonne qu’elle lit ; la barre latérale ne la liste qu’à qui peut tout
lire de ce qu’elle lit. Elle ne lit que **sa** base : une autre base, ou le catalogue de basedb,
sont refusés dès la création. La créer, la modifier ou la supprimer demande le niveau **Gestion**
sur la base. **Supprimer**, dans son menu de la barre latérale, la retire pour tout le monde,
scripts et outils compris ; les tables qu’elle lit ne sont pas touchées.

### Quand la structure change

- **Renommer** une table ou un champ ne casse pas une vue : PostgreSQL la suit.
- **Changer la formule** d’un champ calculé qu’elle lit la retire un instant, puis la remet sur la
  nouvelle colonne. Si elle ne tient plus, elle reste **à corriger** — un triangle l’indique dans
  la barre latérale — avec sa définition gardée : **Modifier la vue…**, corrigez, enregistrez.
- Une table n’est pas purgée tant qu’une vue la lit, et une vue n’est pas supprimée tant qu’une
  autre vue la lit : le refus nomme la vue en cause.

## Question SQL ou vue SQL ?

| | Ce que c’est | Où elle vit | Pour |
|---|---|---|---|
| **Question SQL** | un texte SQL, ses variables, sa visualisation | sous les tables, rubrique « Requêtes », et dans les [tableaux de bord](/basedb/fonctionnalites/tableaux-de-bord/) | retrouver une lecture, la partager comme texte, en faire un chiffre, un graphique, un tableau croisé sous des filtres |
| **Vue SQL** | une vraie vue PostgreSQL | parmi les tables | donner un nom à une lecture, pour l’interface **et** pour `psql`, vos scripts, vos outils |

## Limites

- Une question rend au plus 2 000 lignes ; un brouillon exécuté par la console s’arrête au bout de
  15 secondes.
- Une vue SQL se lit en SQL et dans l’interface ; l’API REST et le serveur MCP ne l’exposent pas.
- Une vue SQL reste dans l’environnement où elle a été créée : créer un environnement, comparer
  la structure ou enregistrer un modèle ne l’emportent pas encore.
