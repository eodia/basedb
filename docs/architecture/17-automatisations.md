# 17 — Automatisations et champ bouton

## Rôle de ce chapitre

Une **automatisation** fait quelque chose quand quelque chose arrive : quand une ligne
est créée, quand un champ change, à heure fixe, ou quand on clique sur un **bouton** dans
une ligne. Elle modifie la ligne, en crée une autre, prévient quelqu'un ou appelle un
service extérieur. Ce chapitre fixe ce qu'elle peut faire, au nom de qui, et ce qui
l'empêche de s'emballer.

Trois principes, repris des chapitres qui précèdent :

- **rien hors de PostgreSQL** (A4) : les exécutions attendent dans une file en base,
  déclenchées par le drain de l'historique (chapitre 07 §1.4) ou par l'horloge ;
- **au nom de quelqu'un** : une automatisation agit avec les droits de la dernière
  personne qui l'a enregistrée, **redécidés à chaque exécution** — la règle du
  formulaire partagé (chapitre 15 §2) ;
- **l'historique dit qui a écrit** : une écriture d'automatisation est historisée comme
  telle, avec son nom et la personne qui en répond.

---

## 1. Ce qu'est une automatisation

Elle appartient à une base (`_basedb.automation`, chapitre 02). Elle a un nom, une
description, un interrupteur (active ou non), **un déclencheur**, une **condition**
facultative et **une suite d'actions** (dix au plus), exécutées dans l'ordre.

Construire, modifier, supprimer, consulter les automatisations d'une base et leurs
exécutions demande `manage_schema` sur la base, en session : elles nomment des tables et
des champs, et agissent en leur nom. Qui enregistre une automatisation en devient le
**propriétaire** — celle ou celui au nom de qui elle agit.

### 1.1 Déclencheurs

| Nature | Quand | Réglages |
|---|---|---|
| `record_created` | une ligne est créée dans la table | la table |
| `record_updated` | une ligne de la table est modifiée | la table ; les champs surveillés (aucun : tout changement) |
| `schedule` | à intervalle régulier | toutes les heures, chaque jour ou chaque semaine ; l'heure et le jour, dans un fuseau |
| `button` | on clique sur un bouton qui la désigne (§4) | la table |

`record_created` et `record_updated` naissent au **drain** : une écriture faite par
l'interface, l'API, MCP, un formulaire partagé ou en SQL direct les déclenche également.
**Une écriture faite par une automatisation n'en déclenche aucune** : c'est ce qui rend
les boucles impossibles, au prix des chaînes d'automatisations, que la v1 n'offre pas.

### 1.2 Condition

Pour un déclencheur de ligne ou un bouton, une condition facultative écrite dans le
langage des filtres (chapitre 08 §4) : évaluée sur la ligne **au moment de l'exécution**,
sous les droits du propriétaire, elle arrête l'exécution si la ligne n'y satisfait pas
(`skipped`). « Quand une tâche passe à Fait » s'écrit donc : `record_updated` surveillant
`statut`, condition `statut eq "fait"`.

### 1.3 Actions

| Nature | Effet | Réglages |
|---|---|---|
| `update_record` | modifie la ligne qui a déclenché | les champs et leurs valeurs |
| `create_record` | crée une ligne dans une table de la base | la table, les champs et leurs valeurs |
| `notify` | notification interne (chapitre 16 §2), nature `automation` | des personnes et/ou un champ « personne » de la ligne ; un message |
| `webhook` | `POST` d'un JSON vers une adresse | l'adresse (`https`), le corps : l'automatisation, le déclencheur et la ligne |
| `slack` | un message dans un canal Slack (chapitre 19 §1) | une connexion de la base, le message |

Une valeur ou un message peut citer la ligne : `{{nom_du_champ}}` est remplacé par la
valeur du champ telle qu'on la lit — une relation par sa valeur d'affichage, un choix par
son libellé, une personne par son nom —, `{{_id}}` par l'identifiant de la ligne et
`{{_maintenant}}` par l'instant de l'exécution. Un champ que le propriétaire ne peut pas
lire est remplacé par du vide.

`update_record` n'a de sens qu'avec une ligne : il est refusé à l'enregistrement pour un
déclencheur `schedule` (`REQUEST_INVALID`, raison `action_sans_ligne`). Un webhook obéit
aux règles d'adresse des webhooks (chapitre 08 §10.3 : `https`, pas d'adresse privée),
attend 10 secondes au plus, et échoue (`AUTOMATION_WEBHOOK_FAILED`) sur toute réponse
autre que `2xx`.

Il n'y a pas de courriel en v1 : aucun serveur d'envoi n'est configurable en dehors de
l'authentification (chapitre 13 §2.3).

---

## 2. Exécution

### 2.1 La file

Chaque déclenchement ajoute une **exécution** à `_basedb.automation_run`, à l'état
`queued` : dans la transaction du drain pour une ligne, à l'échéance pour une horloge, à
la requête pour un bouton. Un travailleur du processus d'API, comme celui des champs IA
(chapitre 12 §1.5), les prend par lots (`FOR UPDATE SKIP LOCKED`) et les exécute :

1. le propriétaire est-il toujours actif ? l'automatisation toujours active ? — sinon
   `skipped` ;
2. la condition, sur la ligne relue sous les droits du propriétaire — fausse : `skipped` ;
   une ligne qui ne se lit plus : `skipped` ;
3. les actions, dans l'ordre, chacune avec les droits du propriétaire, par les mêmes
   chemins que l'API (masques, contraintes, historique). La première qui échoue arrête
   l'exécution : `failed`, avec le code de l'échec ; les actions précédentes restent
   faites.

Chaque exécution garde le résultat de chacune de ses actions, et ce qui a été écrit :
l'écran des exécutions dit ce qui s'est passé, et pourquoi pas.

### 2.2 Au nom de qui

Les écritures d'une automatisation sont faites par un acteur de nature `automation`
(chapitre 07 §2.1) : l'identifiant de son propriétaire, et celui de l'automatisation
comme identifiant de jeton. L'historique les montre « Automatisation « Relance » (Marie
Dupont) ». Si le propriétaire a perdu le droit d'écrire, l'action échoue avec le refus
ordinaire (`ACTION_FORBIDDEN`, `FIELD_NOT_WRITABLE`…) ; le réenregistrer au nom d'une autre
personne la répare.

### 2.3 Garde-fous

- **Débit** : 100 exécutions par heure et par automatisation ; au-delà, l'exécution est
  `skipped`, raison `debit` — un import de 10 000 lignes ne déclenche pas
  10 000 webhooks.
- **Pas de chaîne** : §1.1.
- **Horloge** : au plus une exécution en attente par automatisation planifiée ; une
  échéance manquée pendant un arrêt est rattrapée une fois, pas autant de fois qu'elle a
  été manquée.
- **Conservation** : les exécutions sont gardées 30 jours (A24).

---

## 3. Désactiver, supprimer

Désactivée, une automatisation ne déclenche plus rien, et ses exécutions en attente sont
`skipped`. Supprimée (logiquement), elle disparaît des écrans ; un bouton qui la
désignait n'agit plus et le dit (`AUTOMATION_DISABLED`).

---

## 4. Le champ bouton

Un champ de nature **`button`** (chapitre 04 §2.12) n'a pas de colonne : il dessine, dans
chaque ligne, un bouton au libellé choisi. Deux actions :

| Action | Effet |
|---|---|
| `url` | ouvre une adresse dans un nouvel onglet ; l'adresse peut citer la ligne (`https://exemple.fr/devis/{{numero}}`) ; `http(s)` ou `mailto:` seulement |
| `automation` | lance une automatisation de la base dont le déclencheur est `button`, pour cette ligne |

Cliquer demande de **pouvoir lire la ligne** ; ce que fait l'automatisation, elle le fait
avec les droits de son propriétaire — c'est la personne qui a construit le bouton qui
décide de ce qu'il fait, pas celle qui clique. Un clic est limité à 10 par minute et par
personne (`RATE_LIMIT_EXCEEDED`). L'adresse d'un bouton `url` est composée par
l'interface avec les valeurs que le lecteur voit : un champ masqué y est vide.

Un bouton n'a pas de valeur : il n'apparaît pas dans les lignes lues par l'API, ne se
filtre pas, ne se trie pas, ne s'importe pas et ne se demande pas dans un formulaire.

---

## 5. Routes

| Méthode | Route | Effet | Droit | Acteurs |
|---|---|---|---|---|
| `GET` `POST` | `/admin/bases/{base}/automations` | les automatisations de la base ; en créer une | `manage_schema` | session seule |
| `PATCH` `DELETE` | `/admin/bases/{base}/automations/{id}` | la modifier (qui enregistre en devient propriétaire) ; la supprimer | `manage_schema` | session seule |
| `GET` | `/admin/bases/{base}/automations/{id}/runs` | ses 50 dernières exécutions | `manage_schema` | session seule |
| `POST` | `/automations/{id}/run` | l'exécuter pour une ligne : un clic sur un bouton (`read` sur la ligne), ou un essai depuis l'écran (`manage_schema`) | selon le cas | session, jeton |

---

## Décisions retenues

- **Déclenché par le drain**, pas par les routes : une automatisation voit toute
  écriture, d'où qu'elle vienne, comme l'historique.
- **Les droits du propriétaire, redécidés à chaque fois**, comme un formulaire partagé :
  l'automatisation n'a pas de droits à elle, et cesse d'agir quand la personne qui en
  répond ne peut plus.
- **Pas de chaîne en v1** : c'est la seule garantie simple contre une boucle entre deux
  automatisations qui se modifient l'une l'autre.
- **Pas de script** : un script exécuté par le serveur serait une surface d'attaque et
  un moteur d'exécution de plus ; un webhook vers un service qu'on contrôle en tient lieu.

## Risques et limites connues

- Une automatisation qui écrit n'en déclenche pas d'autre : « quand une facture est
  payée, clore le projet, puis prévenir le client » s'écrit en une seule automatisation.
- La condition est évaluée à l'exécution, pas au déclenchement : une ligne modifiée
  entre-temps est jugée telle qu'elle est.
- Le délai entre l'écriture et l'exécution est celui d'un drain plus un tour du
  travailleur, de l'ordre de la seconde.
