---
title: Automatisations
description: Quand une ligne change, à heure fixe ou d’un clic — modifier, créer, chercher, répéter sur chaque ligne, bifurquer, demander à l’IA, prévenir, envoyer un courriel, appeler un service, écrire sur Slack.
---

Une automatisation dit **quand**, **si** et **alors** : quand une tâche passe à « Fait », noter
l’heure ; quand un avis négatif arrive, prévenir la responsable et écrire sur Slack ; chaque
lundi à 9 h, créer la ligne du point d’équipe. Et quand une action ne suffit pas, elle suit un
**flux** : chercher une ligne, prendre un chemin ou un autre selon ce qu’elle dit, répéter des
étapes sur chaque ligne qui répond à un filtre, réutiliser dans une étape ce qu’une étape
précédente a trouvé ou écrit.

Elles s’ouvrent depuis **Automatisations**, dans le bloc de la base ouverte en bas de la barre
latérale, et demandent le niveau **Gestion**.

![Un flux et l’une de ses exécutions, posée dessus](../../../assets/screens/fr/automatisations.webp)

## Le flux

Le flux se dessine de haut en bas : le déclencheur, puis chaque étape. Un **+** sur un trait
ajoute une étape à cet endroit ; une carte ouvre ses réglages à droite. Une automatisation
simple — un déclencheur et une action — tient en deux cartes, et se règle comme avant.

## Quand

| Déclencheur | Réglages |
|---|---|
| **Une ligne est créée** | la table |
| **Une ligne est modifiée** | la table, et au besoin les seuls champs à surveiller |
| **À heure fixe** | toutes les heures, chaque jour ou chaque semaine, à l’heure et dans le fuseau choisis |
| **On clique sur un bouton** | un [champ Bouton](/basedb/fonctionnalites/tables-et-champs/#bouton) de la table |

Un déclencheur sur les lignes voit **toutes** les écritures : l’interface, l’API, un agent, un
formulaire partagé, et même le SQL direct — les automatisations partent de l’historique, qui les
capture toutes.

## Seulement si

Une condition facultative, dans le [langage des filtres](/basedb/integrations/api-rest/#lire) —
`statut eq "fait"`, `montant gte 10000 and payee eq false` — évaluée sur la ligne **au moment
d’agir**. Une exécution dont la condition n’est pas remplie est « écartée », et le dit.

## Alors

Jusqu’à trente étapes, dans l’ordre ; la première qui échoue arrête les suivantes.

| Étape | Ce qu’elle fait |
|---|---|
| **Modifier une ligne** | écrit des valeurs dans la ligne qui a déclenché — ou dans celle qu’une étape a trouvée ou créée |
| **Créer une ligne** | dans cette table ou une autre de la base |
| **Chercher une ligne** | la première ligne d’une table qui répond à un filtre, pour que les étapes suivantes la citent ou la modifient |
| **Prévenir quelqu’un** | une [notification](/basedb/fonctionnalites/collaboration/#notifications) à des personnes choisies, ou à celle d’un champ Personne |
| **Envoyer un courriel** | à des personnes de l’équipe, à celle d’un champ Personne, à l’adresse d’un champ E-mail — un client, un fournisseur — ou à des adresses écrites ; l’objet et le texte citent la ligne et les étapes précédentes |
| **Appeler un webhook** | une requête HTTPS vers un service — méthode, adresse, en-têtes et corps à votre main ([détails](#appeler-un-service)) ; sa réponse se cite ensuite |
| **Envoyer sur Slack** | un message dans un canal [connecté](/basedb/integrations/synchronisation/#slack) |
| **Demander à l’IA** | une réponse du [fournisseur d’IA](/basedb/fonctionnalites/ia/) à une consigne qui cite la ligne et les étapes précédentes — rédiger, résumer, classer —, lue comme un texte, un nombre, oui ou non, une date ou un choix dans une liste |
| **Condition** | plusieurs chemins : le premier dont la condition est remplie est pris, « Sinon » quand aucun ne l’est ; les chemins se rejoignent ensuite |
| **Pour chaque ligne** | les étapes qu’elle contient, une fois pour chaque ligne d’une table qui répond à un filtre ([détails](#pour-chaque-ligne)) |

Une recherche qui ne trouve rien n’arrête pas le flux : les étapes qui devaient modifier sa
ligne sont passées. Pour faire autre chose dans ce cas, une condition le teste — un chemin
dont le filtre est vide est pris dès que la recherche a trouvé.

## Pour chaque ligne

L’étape **Pour chaque ligne** lit les lignes d’une table qui répondent à son filtre — vide :
toutes —, dans l’ordre choisi, jusqu’à sa limite (50 par défaut, 200 au plus), puis exécute
une fois pour chacune les étapes placées dans son cadre. « Chaque lundi, relancer les factures
impayées » s’écrit : **À heure fixe**, puis **Pour chaque ligne** des factures
`payee eq false and relancee eq false`, et dans la boucle un courriel au contact de la facture
et **Modifier une ligne** qui coche « Relancée ».

Dans la boucle, l’identifiant de l’étape nomme la **ligne du tour** : `{{e1.client}}` la cite,
et **Modifier une ligne** la propose parmi les lignes à modifier. Après la boucle,
`{{e1.nombre}}` dit combien de lignes elle a parcourues — pour un récapitulatif sur Slack, par
exemple. Le filtre peut citer ce qui précède : déclenchée par une facture payée,
`facture eq {{_id}}` parcourt ses lignes de détail.

Au-delà de la limite, les lignes restantes attendent la prochaine exécution, qui le signale :
faites sortir du filtre celles qui sont traitées — une case « relancée », une date — pour les
traiter toutes au fil des exécutions. Une boucle ne contient pas d’autre boucle, et une
exécution s’arrête au bout de deux minutes.

## Appeler un service

L’étape **Appeler un webhook** envoie par défaut, en `POST`, les données de l’automatisation :
la ligne choisie et ce que les étapes précédentes ont trouvé ou écrit. Pour parler à un
service tel qu’il l’attend, on règle :

- la **méthode** : `POST`, `PUT`, `PATCH`, `GET` ou `DELETE` — ces deux derniers sans corps ;
- l’**adresse**, qui peut citer après son hôte — `https://api.exemple.fr/clients/{{e2.numero}}` ;
  chaque valeur y est encodée ;
- des **en-têtes**, dont la valeur peut citer : `Idempotency-Key: {{_id}}` ;
- le **corps** : les données de l’automatisation, un **JSON à composer**, un **formulaire**
  (une paire `clé=valeur` par ligne) ou un **texte**. Dans un JSON, une citation entre
  guillemets est du texte, et hors guillemets une valeur — un nombre, oui ou non, une liste :

```json
{ "facture": "{{e1.numero}}", "montant": {{e1.montant}}, "payee": {{e1.payee}} }
```

Une clé d’API ou un jeton se met dans un en-tête **secret** (le cadenas) : chiffré par la clé
de l’instance, il n’est plus jamais affiché — ni à l’écran, ni par l’API, ni au Copilot — et ne
part que vers l’hôte pour lequel vous l’avez donné. Changer l’hôte de l’adresse demande de le
redonner ; **Remplacer** en saisit un nouveau.

## Demander à l’IA

Comme un [champ IA](/basedb/fonctionnalites/ia/#loption-ia-dun-champ), l’étape envoie au
fournisseur sa consigne, où chaque citation est remplacée par sa valeur :

```text
Cet avis de {{auteur}} demande-t-il une action de notre part ? {{avis}}
```

On choisit la **réponse attendue** — un texte libre ou court, un nombre, oui ou non, une date,
une adresse web, ou un choix dans une liste, que l’on peut reprendre d’un champ Choix. Le modèle
en est averti, et une réponse qui n’en contient pas fait échouer l’étape. Les étapes suivantes
la citent par `{{e1.reponse}}` : dans le titre d’une tâche créée, un message, ou un champ Choix,
où elle est rangée au choix de même libellé.

Ce que la consigne cite part chez le fournisseur : l’étape demande votre **accord**, à redonner
quand la consigne change. Chaque appel est journalisé et compte, avec les champs IA, dans
`BASEDB_AI_FIELD_QUOTA` (300 par heure par défaut). L’IA ne fait rien d’elle-même : ce sont les
étapes posées après elle qui écrivent ou préviennent.

## Citer

Les valeurs, les messages et les filtres citent ce qui précède, depuis le bouton **{ }** à côté
de chaque texte :

- `{{Titre}}`, `{{_id}}` : la ligne qui a déclenché ;
- `{{e2.titre}}`, `{{e2._id}}` : la ligne trouvée, créée ou modifiée par l’étape `e2` — chaque
  étape porte son identifiant sur sa carte ;
- `{{e3.statut}}`, `{{e3.reponse.numero}}` : ce qu’a répondu le webhook `e3` ;
- `{{e4.reponse}}` : la réponse de l’étape IA `e4` ;
- `{{e5.client}}` dans la boucle `e5`, la ligne du tour ; `{{e5.nombre}}` après elle, le nombre
  de lignes parcourues ;
- `{{_maintenant}}` : l’instant de l’exécution.

Une valeur faite d’une seule citation passe la valeur elle-même : une relation, une personne, un
choix — c’est ainsi qu’une ligne créée se relie à celle qu’une recherche a trouvée. Dans un
filtre, une citation est toujours une valeur comparée, jamais du langage de filtre.

Une étape ne peut citer que ce qui a eu lieu à coup sûr avant elle : ce qu’un chemin a trouvé
ne se cite plus après la condition. L’éditeur le signale sur la carte avant l’enregistrement.

## Le Copilot

**Copilot**, dans l’en-tête, ouvre à droite une conversation en langage naturel sur les
automatisations de la base : « quand une tâche passe en revue, préviens la personne
assignée », « ajoute un résumé par l’IA dans les notes », « pourquoi la dernière exécution a-t-elle
échoué ? ». Il répond et **propose** une automatisation entière — celle que vous avez à l’écran,
modifiée, ou une nouvelle —, avec la liste de ce qui change.

Rien n’est enregistré par le Copilot : **Poser sur le flux** montre la proposition dans l’éditeur,
où vous la relisez avant d’enregistrer — et **Annuler**, sur la carte, rend le flux tel qu’il
était. Une nouvelle automatisation s’ouvre dans l’éditeur, à créer. Chaque proposition est
vérifiée comme le serait un enregistrement ; ce qui ne tient pas est écarté, et dit.

Par défaut, **seule la structure** part chez le fournisseur d’IA, avec la conversation : les tables
et leurs champs, les automatisations de la base, celle à l’écran telle que l’éditeur la montre, et
ses dernières exécutions — leurs statuts et leurs codes d’erreur, jamais une valeur. Les personnes
et les canaux Slack partent sous des repères (`p1`, `s1`), jamais par leur identifiant. La case
**Autoriser la lecture des données** permet au Copilot, pour la conversation, de lire des lignes
(50 au plus par lecture), chaque lecture listée sous sa réponse.

## Tester, suivre

**Tester sur une ligne** exécute l’automatisation enregistrée sur une ligne choisie, pour de
vrai. L’onglet **Exécutions** garde les 50 dernières, 30 jours : en attente, en cours, réussie,
écartée avec sa raison, échouée avec son code. En choisir une la pose sur le flux — le chemin
pris est tracé, chaque étape passée dit ce qu’elle a fait et en combien de temps, le reste est
estompé. Dans une boucle, chaque étape dit aussi combien de fois elle a tourné.

## Au nom de qui elle agit

Une automatisation agit avec les **droits de la personne qui l’a enregistrée en dernier**,
redécidés à chaque exécution : si cette personne perd un droit, l’étape qui en avait besoin
échoue au lieu de passer outre, et une recherche ne trouve que ce qu’elle peut lire.
L’historique l’affiche « Automatisation « Tâche terminée » · au nom de … », et ses écritures
s’annulent comme les autres.

## Limites

- Ce qu’écrit une automatisation n’en déclenche aucune autre : ce qui doit s’enchaîner s’écrit
  dans un seul flux.
- Une recherche donne une ligne, la première ; une boucle en parcourt 200 au plus par
  exécution, et la première étape qui échoue l’arrête. Pas d’attente (« trois jours après »).
- Pas de script. Un courriel part en texte simple, un par destinataire — vingt au plus par
  étape —, par le [serveur d’envoi](/basedb/hebergement/variables/#courriels) de l’instance ;
  une réponse arrive à la personne qui possède l’automatisation.
- Une condition teste une ligne : pour prendre un chemin selon la réponse de l’IA, l’écrire
  d’abord dans un champ de la ligne.
- Un [modèle de base](/basedb/fonctionnalites/modeles/) n’emporte que les automatisations sans
  recherche, boucle, condition ni étape IA, et jamais un webhook.
- Un webhook ne suit pas de redirection et attend 10 secondes au plus ; une réponse autre que
  2xx fait échouer l’étape.
- 100 exécutions par heure et par automatisation ; une échéance horaire manquée n’est rattrapée
  qu’une fois.
- Le délai entre l’écriture et l’action est de l’ordre de la seconde.
