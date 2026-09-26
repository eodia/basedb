---
title: Introduction
description: Ce qu’est basedb, et ce qui le distingue des tableurs collaboratifs.
---

**basedb** est une base de données collaborative, dans l’esprit d’Airtable ou de Baserow,
que vous hébergez vous-même — avec une différence qui commande tout le reste : **vos données
vivent dans de vraies tables PostgreSQL**, typées et nommées en clair.

![La grille d’une table dans basedb](../../../assets/screens/grille.png)

## Une promesse simple

Pas de modèle générique, pas de `JSONB` fourre-tout, pas de `field_1837` :

| Dans basedb | Dans PostgreSQL |
|---|---|
| Une base « Ventes » | un schéma `b_t4z56fq_ventes` |
| Une table « Opportunités » | une table `opportunites` |
| Un champ « Échéance » (Date) | une colonne `echeance date` |
| Une liste de choix « Statut » | une colonne `text` et sa contrainte `CHECK` |
| Une relation « Client » | une colonne `clients_id uuid` et sa `FOREIGN KEY` |

Vous pouvez donc ouvrir `psql`, un outil de BI ou un script Python et lire vos données sans
passer par le produit — et même y écrire : les contraintes tiennent, et l’historique enregistre
l’écriture.

## Pour qui ?

- **Les équipes métier** qui veulent une grille, des vues et des formulaires, sans attendre
  un développement.
- **Les équipes techniques** qui refusent de voir leurs données enfermées dans un format
  propriétaire, et veulent brancher leurs outils habituels.
- **Les agents IA**, qui trouvent un serveur MCP, des droits clairs et des propositions
  soumises à une personne.

## Ce que vous y trouverez

- Des [tables et des champs](/basedb/fonctionnalites/tables-et-champs/) typés, des relations
  qui sont de vraies clés étrangères.
- Six [vues](/basedb/fonctionnalites/vues/) : grille, kanban, calendrier, chronologie,
  formulaire, questionnaire.
- Des [formulaires partagés](/basedb/fonctionnalites/formulaires-partages/) par un lien,
  publics ou réservés aux membres.
- Des [environnements](/basedb/fonctionnalites/environnements/) — production, recette — que
  l’on compare et que l’on migre.
- Un [historique](/basedb/fonctionnalites/historique/) de chaque écriture, SQL direct compris.
- Des [droits](/basedb/fonctionnalites/droits/) par groupe, jusqu’au champ.
- Une [API REST](/basedb/integrations/api-rest/), un [serveur MCP](/basedb/integrations/mcp/)
  et des [webhooks](/basedb/integrations/webhooks/).
- L’[IA](/basedb/fonctionnalites/ia/) en option : champs calculés par un modèle, copilote.

## État du projet

basedb est un logiciel libre (AGPL-3.0) en développement actif. Le noyau, l’API, le serveur MCP
et l’interface fonctionnent et sont couverts par plus de mille tests ; la
[feuille de route](/basedb/feuille-de-route/) dit ce qui reste à venir. Son
[document d’architecture](https://github.com/eodia/basedb/tree/main/docs/architecture), seize
chapitres, fixe chaque décision.

:::tip[Essayer]
Une commande suffit une fois le dépôt cloné : `docker compose up -d`. Voir
[l’installation](/basedb/guides/installation/).
:::
