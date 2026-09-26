# 19 — Intégrations et tables synchronisées

## Rôle de ce chapitre

Une base ne vit pas seule : on veut prévenir une équipe dans Slack, voir ses échéances
dans Google Agenda, et tenir à jour, sans copier-coller, une table qui reflète un
fichier publié ailleurs, un agenda ou la vue d'une autre base. Ce chapitre fixe ces
trois portes, et ce qui les tient fermées au reste.

Principes :

- **des protocoles publics, pas de jeton de service** : un webhook entrant pour Slack,
  le format iCalendar pour les agendas, HTTPS pour les sources ; aucune application
  OAuth à enregistrer chez un tiers, aucun jeton d'accès à un compte Google ou Slack
  conservé par basedb ;
- **les secrets scellés** : une adresse qui vaut autorisation — un webhook Slack, l'adresse
  secrète d'un agenda — est scellée par la clé d'instance (A25) et ne se relit jamais en
  clair par l'API ;
- **aucune adresse privée** : toute adresse appelée par le serveur obéit aux règles des
  webhooks (chapitre 08 §10.3 : `https`, hôte public, pas de redirection suivie).

---

## 1. Slack

Une **connexion** Slack appartient à une base (`_basedb.integration`, chapitre 02) : un
nom et l'adresse d'un *webhook entrant* Slack (`https://hooks.slack.com/…`), créée dans
Slack pour un canal. Seules les adresses de `hooks.slack.com` sont acceptées : le serveur
n'envoie rien ailleurs par ce chemin.

- Construire, tester, supprimer une connexion demande `manage_schema` sur la base, en
  session ; l'API ne rend jamais l'adresse, seulement sa fin (`…/Xy7Q`).
- « Tester » envoie un message au canal et dit ce que Slack a répondu.
- Une automatisation (chapitre 17) gagne l'action **`slack`** : une connexion de la base et
  un message, qui peut citer la ligne (`{{champ}}`). Une réponse autre que `2xx` fait
  échouer l'action (`AUTOMATION_WEBHOOK_FAILED`).

---

## 2. Google Agenda et les agendas iCalendar

### 2.1 Voir ses échéances dans un agenda

Une vue **calendrier** ou **chronologie** partagée publiquement (chapitre 15 §10) publie
aussi un flux iCalendar :

`GET /api/v1/views/{jeton}/calendar.ics`

Chaque ligne de la vue y est un événement : son titre, sa date — un jour entier pour un
champ `date`, une heure pour un `datetime` —, sa fin quand la vue en a une, et en
description les champs que montrent ses cartes. L'identifiant de l'événement est celui de
la ligne : un agenda qui s'abonne met à jour l'événement au lieu d'en créer un autre.
Google Agenda (« Autres agendas », « À partir de l'URL »), Outlook ou Apple Calendar
s'abonnent à cette adresse et la relisent à leur rythme.

Le flux lit sur l'autorité du publiant, exactement comme la page de la vue : mêmes champs,
mêmes lignes, même filtre, 1 000 événements au plus. Un partage réservé aux membres n'a
pas de flux (`VIEW_SHARE_RESTRICTED`) : un agenda qui s'abonne ne se connecte pas.

### 2.2 Importer un agenda

L'autre sens passe par une **table synchronisée** (§3) de source `ics` : l'adresse
secrète d'un agenda Google au format iCal (« Paramètres de l'agenda », « Adresse secrète
au format iCal ») ou tout flux iCalendar public. La table porte le titre, le début, la fin,
le lieu et la description de chaque événement.

---

## 3. Tables synchronisées

### 3.1 Ce qu'est une table synchronisée

Une table dont les lignes viennent d'une **source** extérieure et sont tenues à jour par
le serveur (`_basedb.table_sync`, chapitre 02) :

| Source | Adresse | Colonnes | Clé d'une ligne |
|---|---|---|---|
| `csv` | un fichier CSV publié en `https` (un export, une feuille de calcul publiée) | celles de la première ligne, typées par leur contenu : nombre, date, texte | la colonne `id` si elle existe, sinon la première |
| `ics` | un flux iCalendar (§2.2) | Titre, Début, Fin, Lieu, Description | l'`UID` de l'événement |
| `basedb` | le lien d'une vue partagée d'un basedb, celui-ci ou un autre (chapitre 15 §10) | les champs de la vue | l'identifiant de la ligne |

La table est créée avec ses colonnes et un champ **Clé de synchronisation** ; ses lignes
sont ensuite **créées, modifiées et supprimées** à chaque synchronisation pour ressembler
à la source : une ligne dont la clé a disparu de la source disparaît de la table.

### 3.2 Lecture seule

Les lignes d'une table synchronisée ne s'écrivent pas à la main : créer, modifier ou
supprimer une ligne est refusé (`TABLE_SYNCED`, `409`) — sinon la synchronisation suivante
effacerait l'écriture sans prévenir. Le méta le dit d'avance : la table y porte
`synced: true`, ses seules actions sont `read` et tous ses champs y sont en lecture seule,
quels que soient les droits du lecteur. On la lit, la filtre, la cite dans une relation, une
recherche, un tableau de bord ou une automatisation comme toute autre table. Arrêter la
synchronisation en fait une table ordinaire, avec ses lignes.

### 3.3 Le rythme, et quand la source ne répond pas

La synchronisation a lieu toutes les *n* minutes (15 au moins, 1 440 au plus), et à la
demande (« Synchroniser maintenant »). Elle est faite par le serveur, sous une identité
système, et historisée comme telle. Bornes : 5 Mo et 10 000 lignes par source, 10 secondes
pour répondre.

Une source injoignable ou illisible n'efface rien : la table garde ses lignes, l'échec est
noté (`SYNC_SOURCE_FAILED`, avec la raison) et montré, et la tentative suivante a lieu à
l'échéance suivante. Une colonne apparue dans la source après la création n'est pas
ajoutée ; une colonne disparue laisse son champ vide.

### 3.4 Qui peut quoi

Créer, régler, lancer ou arrêter une synchronisation demande `manage_schema` sur la
base, en session. L'adresse de la source est scellée et ne se relit pas ; l'écran montre
son hôte.

---

## 4. Routes

| Méthode | Route | Effet | Droit | Acteurs |
|---|---|---|---|---|
| `GET` `POST` | `/admin/bases/{base}/integrations` | connexions Slack de la base ; en ajouter une `{label, url}` | `manage_schema` | session seule |
| `DELETE` | `/admin/bases/{base}/integrations/{id}` | la supprimer | `manage_schema` | session seule |
| `POST` | `/admin/bases/{base}/integrations/{id}/test` | envoyer un message d'essai | `manage_schema` | session seule |
| `GET` | `/views/{jeton}/calendar.ics` | flux iCalendar d'une vue calendrier ou chronologie partagée publiquement | — (le jeton) | aucun |
| `GET` `POST` | `/admin/bases/{base}/synced-tables` | tables synchronisées de la base, leur état ; en créer une `{label, source: {kind, url}, interval_minutes}` | `manage_schema` | session seule |
| `PATCH` `DELETE` | `/admin/bases/{base}/synced-tables/{table}` | régler le rythme ; arrêter la synchronisation | `manage_schema` | session seule |
| `POST` | `/admin/bases/{base}/synced-tables/{table}/run` | synchroniser maintenant | `manage_schema` | session seule |

---

## Décisions retenues

- **Webhooks entrants et iCalendar plutôt qu'OAuth** : ils suffisent à ce qu'on attend
  — poster dans un canal, s'abonner à un agenda, importer un agenda — sans que basedb
  détienne un accès à un compte tiers, ni ne dépende de la validation d'une application
  par Google ou Slack.
- **Une table synchronisée est en lecture seule** : une écriture locale qu'une
  synchronisation écrase en silence serait pire qu'un refus.
- **La source d'une autre base passe par une vue partagée** : c'est la porte que son
  propriétaire a ouverte, avec les champs et les lignes qu'il a choisis, et qu'il peut
  refermer.

## Risques et limites connues

- Un agenda qui s'abonne relit le flux à son rythme (plusieurs heures chez Google) : une
  échéance modifiée n'y apparaît pas tout de suite.
- La synchronisation compare toute la source à chaque fois : elle est faite pour des
  sources de quelques milliers de lignes, pas pour un entrepôt.
- Une table synchronisée n'accepte pas de champ saisi à la main à côté des colonnes de la
  source en v1.
