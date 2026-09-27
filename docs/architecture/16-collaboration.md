# 16 — Collaboration : commentaires, notifications, temps réel, annulation

## Rôle de ce chapitre

Plusieurs personnes travaillent sur les mêmes tables. Ce chapitre fixe ce qui les relie
sans qu'elles se parlent ailleurs : **commenter** une ligne et y **mentionner**
quelqu'un, être **notifié** de ce qui vous concerne, **voir** les écritures des autres
arriver sans recharger et **qui** regarde la même table, et **revenir** sur sa dernière
écriture d'un Ctrl+Z.

Le chapitre 10 §10 rangeait « le temps réel et la collaboration » parmi les refus
assumés, et le chapitre 11 §2.4 refusait toute annulation après envoi. Ces deux refus
sont levés par la décision A26 (chapitre 00), dans les bornes que voici — qui sont
celles qui les avaient motivés :

- **aucune brique hors PostgreSQL** (A4) : le temps réel passe par `NOTIFY`, sur la
  seule connexion d'écoute (chapitre 10 §3.1), la présence par une table ;
- **ce que pousse le serveur est un signal, jamais une donnée** : le navigateur relit
  par l'API, sous ses droits ; le flux ne peut donc rien montrer qu'une lecture n'aurait
  pas montré (chapitre 05) ;
- **annuler est un acte, pas un effacement** (chapitre 07 §12.3) : l'annulation est une
  écriture de plus, historisée, refusée si quelqu'un a écrit depuis — ce qui répond
  exactement à l'objection du chapitre 11 (« une seconde écriture déguisée, qui
  écraserait ce qu'un autre a pu écrire entre-temps »).

---

## 1. Commentaires

### 1.1 Ce qu'est un commentaire

Un commentaire est attaché à **une ligne** d'une table (`_basedb.record_comment`,
chapitre 02). Il a un auteur, un texte de 1 à 10 000 caractères et une date ; il peut
être modifié par son auteur (la date de modification est alors montrée) et supprimé.
Les commentaires d'une ligne se lisent dans l'ordre où ils ont été écrits, sous l'onglet
« Commentaires » de la vue détail (chapitre 11 §5.3).

Le texte est brut, rendu avec les liens cliquables et les retours à la ligne ; il n'est
jamais interprété comme du HTML.

Un commentaire survit aux modifications de sa ligne. Il est rattaché à la ligne par son
identifiant, sans clé étrangère — aucune contrainte ne traverse la frontière entre le
catalogue et les données (A9) : supprimer la ligne rend ses commentaires introuvables,
la restaurer (même identifiant, chapitre 07 §12.1) les fait revenir. Ils deviennent
introuvables avec leur table quand celle-ci est supprimée logiquement, et sont purgés
avec elle.

### 1.2 Qui peut quoi

| Geste | Condition |
|---|---|
| Lire les commentaires d'une ligne | pouvoir lire la ligne (`read` sur la table, prédicat de lignes compris) |
| Commenter | pouvoir lire la ligne |
| Modifier un commentaire | en être l'auteur, et pouvoir encore lire la ligne |
| Supprimer un commentaire | en être l'auteur, ou détenir `manage_schema` sur la base |

**Lire suffit pour commenter** : un commentaire ne change aucune donnée, et la personne
qui ne peut que lire est souvent celle qui a une question. Une ligne qu'on ne peut pas
lire n'a pas de commentaires pour soi : la route répond `404`, comme la ligne (chapitre
08 §7.4). Modifier le commentaire d'un autre est refusé par `ACTION_FORBIDDEN` (`403`, raison
`auteur_seul`) — le commentaire est visible, seule l'action est refusée.

### 1.3 Mentions

Une mention s'écrit dans le texte `@[Nom affiché](user:<identifiant>)` ; l'interface
l'insère quand on tape `@` et qu'on choisit une personne parmi les membres du tenant
(`GET /meta/users`), et l'affiche comme une pastille au nom de la personne. Le serveur
relit les mentions dans le texte, sans faire confiance à une liste envoyée à part :

- une mention d'un identifiant qui n'est pas un membre actif du tenant est refusée
  (`REQUEST_INVALID`, raison `mention_inconnue`) ;
- une personne mentionnée qui **ne peut pas lire la ligne** n'est pas notifiée — elle
  ne pourrait pas l'ouvrir, et la notification lui apprendrait l'existence d'une ligne
  qui lui est invisible. La réponse le dit (`meta.unreachable`, la liste de ces
  personnes), et l'interface prévient l'auteur.

Au plus 20 mentions par commentaire.

---

## 2. Notifications

### 2.1 Ce qui notifie

Les notifications sont **internes** (`_basedb.notification`) : une cloche dans
l'interface, un compteur de non-lues. Il n'y a pas de courriel en v1 — le seul canal
sortant configuré par l'opérateur est celui de l'authentification (chapitre 13 §2.3).

| Nature (`kind`) | Quand | Qui est notifié |
|---|---|---|
| `mention` | un commentaire vous mentionne | la personne mentionnée, si elle peut lire la ligne |
| `reply` | un commentaire est ajouté à une ligne que vous avez commentée | chaque auteur précédent du fil, s'il peut encore lire la ligne |
| `assigned` | un champ « personne » d'une ligne est mis sur vous | la personne désignée, si elle peut lire la ligne |

On n'est jamais notifié de son propre geste. Une mention l'emporte sur une réponse : la
personne mentionnée dans un fil où elle a écrit reçoit une seule notification, `mention`.

`assigned` naît au **drain** de l'historique (chapitre 07 §1.4) : une révision qui fait
passer un champ `user` à une personne la notifie. C'est donc vrai d'une écriture faite
par l'interface, par l'API, par MCP ou en SQL direct, sans chemin particulier.

### 2.2 Ce que porte une notification

La nature, l'auteur du geste, la base, la table et la ligne concernées, le commentaire
le cas échéant, un extrait (les 200 premiers caractères du commentaire, ou la valeur
d'affichage de la ligne), la date, et la date de lecture. Ouvrir une notification ouvre
la ligne ; si elle n'est plus lisible, la notification le dit et n'ouvre rien.

Les notifications lues ou non sont conservées 90 jours (A24).

### 2.3 Ce que chacun refuse

Chaque personne peut refuser une nature de notification, depuis ses paramètres
(chapitre 11 §10) : `app_user.muted_notifications` liste les natures refusées —
`mention`, `reply`, `assigned`, et `automation` (chapitre 17). Chaque endroit qui écrit
une notification le demande **avant** d'écrire : une notification refusée n'est pas
écrite du tout, plutôt qu'écrite puis cachée. Elle ne compte donc jamais comme non lue,
ne passe pas par le flux, et réaccepter la nature ne fait pas revenir ce qui s'est passé
entre-temps. Une mention refusée n'est pas pour autant « injoignable » (§1.3) : la
personne peut lire la ligne, elle a choisi de ne pas en être avertie.

---

## 3. Temps réel

### 3.1 Le chemin d'un signal

```
écriture ──► capture (déclencheur) ──► NOTIFY basedb_drain ──► drain
                                                               │
                         NOTIFY basedb_live ◄──────────────────┘
                                │
      chaque instance d'API (connexion d'écoute) ──► flux SSE des navigateurs
```

1. La capture (chapitre 07 §1.3) émet `NOTIFY basedb_drain` — une fois par transaction,
   PostgreSQL fusionnant les notifications identiques, et pas du tout quand la file
   de notification est remplie à plus de moitié (chapitre 07 §11.4).
2. L'instance qui l'entend draine aussitôt, sans attendre sa période de sondage.
3. Le drain, pour chaque table dont il vient de déplacer des révisions, émet
   `NOTIFY basedb_live` : la base, la table, au plus 100 identifiants de lignes, la
   nature des écritures et leur auteur. Les commentaires, les notifications et la
   présence émettent le même canal, dans la transaction qui les écrit.
4. Chaque instance d'API écoute `basedb_live` sur sa connexion d'écoute et relaie le
   signal aux flux ouverts qu'il concerne.

Le délai de bout en bout est celui d'un drain, de l'ordre de la centaine de
millisecondes. Un signal perdu — file pleine, instance redémarrée, connexion coupée —
ne perd aucune donnée : il retarde un affichage jusqu'au prochain signal ou au prochain
rechargement.

### 3.2 Le flux

`GET /api/v1/{tenant}/events?base=<base>&table=<table>&record=<id>` ouvre un flux
`text/event-stream`, authentifié comme toute route. Il porte :

| Événement | Données | Envoyé à |
|---|---|---|
| `ready` | l'identifiant de la session de flux | l'ouverture |
| `records` | la base, la table, les identifiants (si le lecteur voit la table sans prédicat de lignes), l'auteur | qui peut lire la table |
| `comments` | la table, la ligne | qui peut lire la table |
| `notifications` | le nombre de non-lues | la personne concernée |
| `presence` | la table, les personnes qui la regardent et la ligne ouverte par chacune | qui regarde la même table |
| `pointer` | la session, la personne (nom), la cellule survolée et la position dans la cellule, ou rien (§3.4) | les autres flux sur la même table |
| `ping` | — | toutes les 20 secondes |

Le navigateur **relit** ce que le signal désigne, par les routes ordinaires : c'est là
que les droits s'appliquent. Le flux décide seulement de la table, avec la décision de
lecture en cache de la connexion ; il ne transporte aucune valeur.

Un même acteur ouvre au plus 10 flux à la fois (`RATE_LIMIT_EXCEEDED` au-delà) ; un flux
est fermé par le serveur après 30 minutes, et le navigateur le rouvre.

### 3.3 Présence

La présence dit qui regarde la même table, et quelle ligne chacun a ouverte. Elle vit
dans `_basedb.presence` (chapitre 02), une table **non journalisée** : c'est un état
éphémère, qu'une reprise après incident peut perdre sans dommage.

- Ouvrir le flux sur une table y inscrit la session ; `POST /api/v1/{tenant}/presence`
  change la ligne ouverte sans rouvrir le flux ; changer de table rouvre le flux, dont
  la table est décidée à l'ouverture ; fermer le flux efface la session.
- Le serveur rafraîchit la ligne toutes les 20 secondes tant que le flux est ouvert ;
  une ligne de plus de 60 secondes est tenue pour partie (une instance tombée ne laisse
  pas de fantômes plus longtemps).
- On ne voit la présence que sur une table qu'on peut lire, et seulement les personnes
  (nom et initiales) — jamais leur adresse.

### 3.4 Pointeurs

Sur la grille d'une table, chacun voit le **pointeur** des autres personnes qui la
regardent : une flèche à leur couleur, avec leur nom.

- **Une cellule, pas des pixels.** Le navigateur envoie la cellule survolée — la ligne
  (`_id`) et la colonne (nom physique) — et la position dans cette cellule, de 0 à 1.
  Chaque écran replace le pointeur dans sa propre mise en page : une autre largeur de
  fenêtre, un autre défilement, d'autres largeurs de colonnes ne le décalent pas. Sur une
  ligne que l'écran n'affiche pas (autre page, filtre, défilement), il n'apparaît pas.
- **Un signal, rien d'écrit.** `POST /presence/pointer` vérifie que la session du flux est
  celle de l'appelant et qu'elle regarde cette table, puis émet `NOTIFY basedb_live`
  (`kind: pointer`) — aucune ligne n'est écrite. Le navigateur envoie au plus huit
  positions par seconde, la dernière toujours, et le départ de la grille aussitôt ;
  le serveur ignore ce qui arrive à moins de 40 ms du précédent pour la même session.
- **Relayé aux autres seulement**, sur le flux de la même table (événement `pointer`),
  jamais à la session qui l'a envoyé. Une colonne que le destinataire ne lit pas n'est pas
  nommée : le pointeur lui arrive sans position et ne s'affiche pas — la liste des
  colonnes lisibles est fixée à l'ouverture du flux.
- Un pointeur immobile depuis une minute est retiré ; une personne qui quitte la table
  emporte le sien. Ses propres autres fenêtres ne s'affichent pas.

---

## 4. Annulation (Ctrl+Z)

### 4.1 Ce qui s'annule

Ctrl+Z (⌘Z) annule **la dernière écriture de la personne dans l'onglet** : une valeur
modifiée dans la grille, le panneau, un kanban, un calendrier ou une chronologie, une
ligne créée, une ou plusieurs lignes supprimées, un collage sur plusieurs cellules, un
import. Ctrl+Maj+Z (ou Ctrl+Y) rétablit ce qui vient d'être annulé. La pile tient
50 gestes, vit dans l'onglet, et disparaît avec lui.

Chaque écriture de données renvoie l'identité de sa transaction dans l'en-tête
`X-Basedb-Transaction` (chapitre 08 §7.5). L'interface l'empile ; annuler, c'est
demander au serveur de revenir sur cette transaction :

`POST /api/v1/{tenant}/history/undo`, corps `{ "transaction": "<identité>" }`.

### 4.2 Ce que fait le serveur

Le serveur draine l'historique, puis retrouve les révisions de cette transaction dont
**l'appelant est l'auteur**, écrites il y a moins de 24 heures (au plus 1 000). Dans une
seule transaction, il :

1. **restaure** chaque ligne que la transaction a supprimée (chapitre 07 §12.1) ;
2. **rétablit** chaque modification — y compris celles faites en cascade par une
   suppression, comme un lien remis à nul — si les champs ont encore la valeur qu'elle
   leur avait donnée ; sinon `REVISION_SUPERSEDED`, et rien n'est écrit ;
3. **supprime** chaque ligne que la transaction a créée, si elle a encore les valeurs de
   sa création ; sinon `REVISION_SUPERSEDED`.

L'ordre compte : une ligne restaurée peut être la cible d'un lien rétabli, un lien
rétabli peut cesser de viser une ligne à supprimer.

Chaque étape exige le droit du geste qu'elle accomplit (`create` pour restaurer,
`update` pour rétablir, `delete` pour supprimer) et le droit d'écrire chaque champ
qu'elle touche. L'annulation est elle-même une écriture ordinaire : historisée au nom
de qui annule, elle renvoie sa propre identité de transaction — et **rétablir** n'est
rien d'autre qu'annuler l'annulation.

Une transaction introuvable, trop ancienne ou d'un autre auteur : `404`.

### 4.3 Ce qui ne s'annule pas

- Une écriture d'un autre, ou d'un autre onglet : la pile est celle du geste qu'on
  vient de faire, pas un historique (l'historique de la ligne, lui, permet d'annuler
  n'importe quelle modification, chapitre 07).
- Une modification de **structure** — un champ créé, une table supprimée : elle a son
  propre historique et ses propres garde-fous (chapitres 03 et 06).
- Une écriture qu'un autre a recouverte depuis : l'annulation est refusée, et
  l'interface le dit (« Annulation impossible : Statut a été modifié depuis »).

---

## 5. Routes

| Méthode | Route | Effet |
|---|---|---|
| `GET` | `/data/{base}/{table}/{id}/comments` | les commentaires de la ligne, du plus ancien au plus récent |
| `POST` | `/data/{base}/{table}/{id}/comments` | ajoute un commentaire (`201`) ; `meta.unreachable` |
| `PATCH` | `/comments/{comment}` | modifie son texte (son auteur seul) |
| `DELETE` | `/comments/{comment}` | le supprime (son auteur, ou `manage_schema`) |
| `GET` | `/me/notifications?unread=true&after=` | les notifications de l'appelant, les plus récentes d'abord ; `meta.unread` |
| `POST` | `/me/notifications/read` | marque lues les notifications `ids`, ou toutes (`all: true`) |
| `GET` | `/events?base=&table=&record=` | le flux temps réel (§3.2) |
| `POST` | `/presence` | déplace la présence d'un flux ouvert vers une autre ligne de sa table |
| `POST` | `/presence/pointer` | le pointeur d'un flux ouvert sur sa table : `{session, base, table, at: {record, field, x, y} \| null}` (§3.4) |
| `POST` | `/history/undo` | annule une transaction de l'appelant (§4) |

Toutes sont sous `/api/v1/{tenant}` et exigent une session ou un jeton ; un jeton
d'intégration n'a ni présence ni notifications, mais peut commenter et annuler.

---

## Décisions retenues

- **SSE plutôt que WebSocket** : le flux ne va que du serveur au navigateur, passe par
  les mandataires HTTP sans configuration, et se rouvre de lui-même. Ce que le
  navigateur envoie passe par les routes ordinaires, avec leurs droits et leurs
  limites.
- **Un signal, pas une donnée** : pousser des valeurs obligerait à projeter chaque
  écriture pour chaque lecteur connecté, avec ses champs masqués ; relire est plus
  simple et ne peut pas fuir.
- **Le drain comme source unique** : toute écriture, d'où qu'elle vienne, passe par la
  capture. Brancher le temps réel sur les routes de l'API aurait laissé de côté le SQL
  direct et les scripts.
- **L'annulation par transaction**, appuyée sur l'historique : l'historique connaît déjà
  les valeurs d'avant, dans leur type, et sait refuser une annulation recouverte.
- **Lire suffit pour commenter**, pour ne pas créer une nature de droit de plus.

## Risques et limites connues

- La présence et les signaux dépendent de la connexion d'écoute de chaque instance ;
  coupée, elle se reconnecte avec un délai croissant, et la sonde `/readyz` le signale
  (chapitre 08 §15.1).
- Une rafale d'écritures (import, SQL direct) produit un signal par table et par lot de
  drain, pas un par ligne ; au-delà de 100 lignes, le signal ne nomme plus les lignes
  et l'interface recharge la page affichée.
- Les commentaires d'une ligne supprimée restent en base, introuvables, jusqu'à la purge
  de sa table : c'est ce qui permet à une restauration de les retrouver.
