---
title: Intelligence artificielle
description: L’option IA d’un champ, les brouillons et le copilote — et ce qui part chez le fournisseur.
---

L’IA est **optionnelle**. Sans fournisseur configuré, rien ne part nulle part. basedb sait
parler à **OpenAI**, **Anthropic** et **Mistral**, avec votre propre clé.

## Configurer un fournisseur

Tant qu’aucun réglage n’est enregistré dans l’interface, l’API lit son environnement :

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic ou mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # ou BASEDB_AI_API_KEY
```

La clé se lit sous `BASEDB_AI_API_KEY`, ou à défaut sous le nom usuel du fournisseur
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## L’option IA d’un champ

L’IA n’est pas un type de champ mais une **option** : l’interrupteur **IA** du formulaire d’un
champ — texte, texte long, lien URL, nombre, liste de choix, booléen, date — le fait remplir par
un modèle, à partir d’une consigne qui cite d’autres colonnes :

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- Le champ est calculé dès que la ligne existe, puis chaque fois qu’une colonne citée change —
  et, si on le veut, selon un planning (au plus toutes les 15 minutes).
- La colonne **garde son type** : une réponse où rien ne se lit dans ce type (un nombre
  introuvable, un choix qui n’existe pas) est refusée plutôt qu’écrite.
- Désactiver l’option rend le champ de nouveau modifiable à la main, valeurs gardées.
- Les valeurs citées partent chez le fournisseur : **l’activation demande un consentement
  explicite**.

`BASEDB_AI_FIELD_QUOTA` borne ces calculs par heure et par tenant (300 par défaut).

## Brouillons et copilote

- **Brouillons** : décrire une table ou une formule en une phrase, et recevoir une proposition à
  relire. Ne partent que des libellés, des types et la phrase saisie — aucune valeur de cellule.
- **Modèles** : décrire une base entière — « le suivi des réclamations de mes clients » — et
  recevoir tables, lignes d’exemple, vues, tableau de bord et automatisations, à affiner puis à
  créer. Seule la phrase part. Voir [Modèles de base](/basedb/fonctionnalites/modeles/#le-demander-à-lia).
- **Copilote** : une conversation sur la base affichée. On demande un filtre, une requête, des
  colonnes, une table, un jeu d’essai ; chaque proposition arrive comme une carte et s’applique
  d’un clic, par les mêmes routes que les formulaires.

Par défaut, seule la structure part chez le fournisseur. La case **« Autoriser la lecture des
données »** permet au copilote, pour la conversation, de lire des lignes (50 au plus par lecture)
et de répondre à partir d’elles — chaque lecture est listée sous sa réponse.

`BASEDB_AI_QUOTA` borne les appels interactifs par heure et par tenant (120 par défaut).
