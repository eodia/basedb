---
title: Introduction
description: Ce qu’est basedb, et ce qui le distingue des tableurs collaboratifs.
---

**basedb** est une base de données collaborative, dans l’esprit des tableurs collaboratifs,
que vous hébergez vous-même — avec une différence qui commande tout le reste : **vos données
vivent dans de vraies tables PostgreSQL**, typées et nommées en clair.

![La grille d’une table dans basedb](../../../assets/screens/fr/grille.webp)

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
  qui sont de vraies clés étrangères — ou multiples —, des formules calculées par PostgreSQL,
  des recherches et des cumuls à travers les relations.
- Dix [vues](/basedb/fonctionnalites/vues/) : grille, kanban, calendrier, chronologie,
  galerie, liste, carte, formulaire, questionnaire, quiz — collaboratives ou personnelles.
- Des [formulaires](/basedb/fonctionnalites/formulaires-partages/) et des
  [vues](/basedb/fonctionnalites/vues-partagees/) partagés par un lien, et des calendriers qui
  s’abonnent depuis un agenda.
- La [collaboration](/basedb/fonctionnalites/collaboration/) : commentaires et mentions,
  notifications, mises à jour en temps réel.
- Des [automatisations](/basedb/fonctionnalites/automatisations/) et des
  [tableaux de bord](/basedb/fonctionnalites/tableaux-de-bord/) et leurs questions, construites à la souris ou en SQL.
- Du [SQL pour chacun](/basedb/fonctionnalites/requetes-et-vues-sql/), avec ses propres droits :
  des requêtes enregistrées sous les tables, et de vraies vues PostgreSQL rangées parmi elles.
- Des [modèles de base](/basedb/fonctionnalites/modeles/), à prendre dans une galerie ou à
  demander à l’IA.
- Des [environnements](/basedb/fonctionnalites/environnements/) — production, recette — que
  l’on compare et que l’on migre.
- Un [historique](/basedb/fonctionnalites/historique/) de chaque écriture, SQL direct compris,
  et Ctrl+Z pour annuler.
- Des [droits](/basedb/fonctionnalites/droits/) par groupe, jusqu’au champ.
- Une [API REST](/basedb/integrations/api-rest/), un [serveur MCP](/basedb/integrations/mcp/),
  des [webhooks](/basedb/integrations/webhooks/), Slack et des
  [tables synchronisées](/basedb/integrations/synchronisation/).
- L’[IA](/basedb/fonctionnalites/ia/) en option : champs calculés par un modèle, copilote.

## État du projet

basedb est un logiciel libre (AGPL-3.0) développé par [Eodia](https://eodia.com/fr/), studio de
logiciel IA-natif, et en développement actif. Le noyau, l’API, le serveur MCP
et l’interface fonctionnent et sont couverts par plus de mille tests ; la
[feuille de route](/basedb/feuille-de-route/) dit ce qui reste à venir. Son
[document d’architecture](https://github.com/eodia/basedb/tree/main/docs/architecture), une
vingtaine de chapitres, fixe chaque décision.

:::tip[Essayer]
Une commande suffit une fois le dépôt cloné : `docker compose up -d`. Voir
[l’installation](/basedb/guides/installation/).
:::
