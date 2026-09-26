---
title: Principes
description: Les décisions qui commandent l’architecture de basedb.
---

basedb a été conçu à partir d’un **document d’architecture** — seize chapitres, dans le dépôt,
sous [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Son
chapitre 00 fixe vingt-cinq décisions ; en voici l’esprit.

## Les données sont des tables, pas un format

Une base utilisateur est un **schéma** PostgreSQL, une table est une table, un champ est une
colonne typée **nommée en clair**. Pas d’EAV (entité-attribut-valeur), pas de document JSON
fourre-tout, pas de nom opaque. Le catalogue `_basedb` décrit ces objets ; il ne les remplace
pas.

Conséquence voulue : le SQL direct est un usage **légitime**. Les contraintes sont posées dans
la base, l’historique est capturé par déclencheur — rien ne suppose que l’écriture passe par
l’application.

## Un seul point de décision des droits

L’interface, l’API REST, le serveur MCP, les formulaires partagés, les webhooks : tout passe par
le **même point d’application** des permissions, dans le noyau. L’interface est un
consommateur de l’API comme un autre — pas de route privée, pas de jeton de service. Une
ressource qu’on ne peut pas voir répond exactement comme une ressource qui n’existe pas.

## Le noyau décide, les adaptateurs traduisent

Un monorepo TypeScript : `@basedb/core` porte toute la logique (catalogue, moteur DDL,
permissions, enregistrements, historique) ; `apps/api` (Hono), `apps/mcp` et `apps/web`
(Next.js) sont des adaptateurs qui ne s’appellent pas entre eux. L’interface ne dépend jamais du
noyau : elle parle HTTP, point.

## Rien ne se perd sans décision

Supprimer relègue, sans détruire : une table supprimée garde ses lignes, lisibles en SQL sous
un nom relégué, et se restaure. Renommer un nom physique garde l’ancien servi par un alias. La
purge est une décision d’administration, précédée d’un export vérifié.

## PostgreSQL, et rien d’autre

PostgreSQL 16 ou plus, et aucune dépendance externe obligatoire : ni file de messages, ni cache,
ni moteur de recherche. La file des webhooks, le drain de l’historique, les limites de débit,
tout tient dans la base ou dans le processus.

## Pour aller plus loin

| Chapitre | Sujet |
|---|---|
| 00 | Décisions structurantes et registre des codes d’erreur |
| 01 | Nommage et slugification |
| 02 | Le catalogue `_basedb`, source de vérité |
| 03 | Moteur DDL et migrations |
| 04 | Types de champs et projection PostgreSQL |
| 05 | Permissions |
| 06 | Cycle de vie : renommage, suppression, purge |
| 07 | Historique |
| 08 | API REST et webhooks |
| 09 | Serveur MCP |
| 10 | Architecture logicielle |
| 11 | Interface |
| 12 | Intégration IA |
| 13 | Authentification |
| 14 | Environnements |
| 15 | Formulaires partagés |
