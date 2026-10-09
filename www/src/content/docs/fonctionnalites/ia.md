---
title: Intelligence artificielle
description: L’option IA d’un champ, les brouillons, le copilote et celui des tableaux de bord — et ce qui part chez le fournisseur.
---

L’IA est **optionnelle**. Sans fournisseur configuré, rien ne part nulle part. basedb sait
parler à **OpenAI**, **Anthropic** et **Mistral**, avec votre propre clé — et à tout serveur
qui parle l’API d’OpenAI : **Azure**, une passerelle d’entreprise, un modèle servi chez vous.

## Configurer un fournisseur

Tant qu’aucun réglage n’est enregistré dans l’interface, l’API lit son environnement :

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic, mistral ou openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # ou BASEDB_AI_API_KEY
```

La clé se lit sous `BASEDB_AI_API_KEY`, ou à défaut sous le nom usuel du fournisseur
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

### Azure, une passerelle, un modèle local

`BASEDB_AI_PROVIDER=openai_compatible` envoie les appels, au format d’OpenAI, à l’adresse de
`BASEDB_AI_BASE_URL` : ce qui précède `/chat/completions`, paramètres compris.
`BASEDB_AI_HEADERS` ajoute à chaque appel les en-têtes que ce serveur demande, en objet JSON.

```bash
# Azure OpenAI : le nom du déploiement comme modèle, la clé dans l’en-tête api-key
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# L’ancienne forme d’Azure, par déploiement : le paramètre reste après le chemin
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# Un modèle servi par Ollama, sans clé
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

Avec `openai_compatible`, la clé est facultative : si `BASEDB_AI_API_KEY` est donnée, elle part
en `Authorization: Bearer`. Un en-tête de `BASEDB_AI_HEADERS` remplace celui de la clé — une
passerelle qui veut son propre `Authorization`, par exemple.

`BASEDB_AI_BASE_URL` et `BASEDB_AI_HEADERS` servent aussi les trois autres fournisseurs, joints
par une passerelle : pour `anthropic`, l’adresse est ce qui précède `/messages`. Ces deux
variables accompagnent le fournisseur de l’environnement, et lui seul : un tenant qui en a
choisi un autre ne reçoit ni l’adresse, ni les en-têtes, ni la clé. Le démarrage de l’API écrit
le fournisseur retenu, et signale une adresse ou un objet JSON invalides.

Une passerelle interne dont le certificat TLS est auto-signé, ou un proxy d’entreprise qui
re-signe le trafic, fait échouer les appels : `BASEDB_AI_PROVIDER_SSL_VERIFY=false` cesse de
vérifier le certificat **de ce fournisseur seulement** — tous les autres appels sortants de
l’instance, et le fournisseur qu’un tenant aurait choisi, restent vérifiés. Le démarrage le
signale. La clé passant dans chaque appel, réservez-le à un réseau que vous maîtrisez.

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

## Dans une automatisation

Une [automatisation](/basedb/fonctionnalites/automatisations/#demander-à-lia) peut **demander
à l’IA** dans l’une de ses étapes : une consigne qui cite la ligne et les étapes précédentes,
une réponse lue dans le type choisi, que les étapes suivantes écrivent, envoient ou citent. Mêmes
règles que pour un champ : consentement à l’enregistrement, seul part ce que la consigne cite,
chaque appel journalisé et compté dans `BASEDB_AI_FIELD_QUOTA`.

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

## Le Copilot des tableaux de bord

Dans la section [Tableaux de bord](/basedb/fonctionnalites/tableaux-de-bord/#le-copilot), le
Copilot propose des questions, des modifications du tableau et des valeurs pour ses filtres, à
appliquer d’un clic. Mêmes règles : sans consentement, seule la structure part — tables et
champs, tableaux et questions de la base, définition des cartes du tableau affiché (leurs
questions, leurs textes) —, jamais les résultats ni les valeurs choisies dans les filtres. La case
**« Autoriser la lecture des données »** ajoute ces valeurs et les résultats des cartes sous les
filtres affichés, 50 lignes au plus par lecture, chacune listée sous la réponse.

## Le Copilot des automatisations

Dans la section [Automatisations](/basedb/fonctionnalites/automatisations/#le-copilot), le Copilot
propose une automatisation entière — celle à l’écran, modifiée, ou une nouvelle — qu’il pose sur le
flux de l’éditeur, **sans jamais l’enregistrer** : vous la relisez, puis l’enregistrez. Mêmes règles :
sans consentement, seule la structure part — tables et champs, automatisations de la base, celle à
l’écran, ses dernières exécutions sans aucune valeur, personnes et canaux Slack sous des repères —,
et la case **« Autoriser la lecture des données »** ajoute des lignes lues, 50 au plus par lecture.

`BASEDB_AI_QUOTA` borne les appels interactifs par heure et par tenant (120 par défaut).
