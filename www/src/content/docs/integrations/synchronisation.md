---
title: Slack, agendas et tables synchronisées
description: Prévenir un canal Slack, relier un agenda, tenir une table à jour depuis un CSV, un agenda ou une autre base.
---

L’écran **Intégrations** d’une base s’ouvre depuis le menu du profil, en bas à gauche. Il
demande le niveau **Gestion** et réunit ce qui relie la base au reste de vos outils.

![L’écran Intégrations d’une base](../../../assets/screens/integrations.png)

## Slack

**Connecter un canal** : dans Slack, créez un *webhook entrant* pour le canal voulu, puis collez
son adresse (`https://hooks.slack.com/…`, seule origine acceptée). **Tester** envoie un message
d’essai. L’adresse est chiffrée dès l’enregistrement et n’est plus jamais affichée.

Le canal connecté est ensuite une action des [automatisations](/basedb/fonctionnalites/automatisations/) :
**Envoyer sur Slack**, avec un message qui cite la ligne — « Nouvel avis négatif de
{{Auteur}} : {{Avis}} ».

## Agendas

Deux sens, deux moyens :

- **Voir une vue dans un agenda** : partagez publiquement une vue calendrier ou chronologie ; son
  dialogue de partage donne l’adresse d’un **flux iCalendar**, auquel on s’abonne depuis Google
  Agenda (« Autres agendas » → « À partir de l’URL »), Outlook ou Apple Calendar. Voir
  [Vues partagées](/basedb/fonctionnalites/vues-partagees/#un-calendrier-dans-votre-agenda).
- **Importer un agenda** : créez une table synchronisée de source « Agenda » avec l’adresse
  iCal secrète de l’agenda.

## Tables synchronisées

Une table synchronisée est **tenue à jour depuis une source** : elle se lit, se filtre et se
montre en vues comme les autres, mais ne s’écrit pas à la main — un badge
« Synchronisée » le rappelle, et l’API refuse toute écriture (`TABLE_SYNCED`).

| Source | Ce que devient la table |
|---|---|
| **Fichier CSV en ligne** | une colonne par colonne du fichier, typée d’après son contenu : nombre, date ou texte |
| **Agenda** (Google Agenda, iCalendar) | un événement par ligne : titre, début, fin, lieu, description |
| **Vue partagée d’un basedb** | les lignes d’une [vue partagée](/basedb/fonctionnalites/vues-partagees/#une-source-pour-dautres-bases), sur cette instance ou une autre |

**Nouvelle table synchronisée** choisit la source et l’intervalle — toutes les 15 minutes à une
fois par jour ; **Synchroniser** la relit tout de suite. Chaque passage crée, modifie et
supprime ce qu’il faut pour que la table ressemble à la source, en se repérant sur un champ
**Clé de synchronisation**. Toutes ces écritures passent par l’historique.

**Arrêter** la synchronisation rend la table ordinaire : ses lignes restent, et s’écrivent de
nouveau à la main.

## Limites

- Une source est lue dans la limite de 5 Mo, 10 000 lignes et 10 secondes.
- Une source en échec n’efface rien : la table garde ses lignes jusqu’au passage suivant.
- Une colonne apparue dans la source après la création n’est pas ajoutée.
- Slack se connecte par webhook entrant, pas encore par une application Slack.
