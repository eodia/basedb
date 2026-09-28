# 15 — Formulaires partagés

## Rôle de ce chapitre

Ce chapitre fixe comment un **formulaire** ou un **questionnaire** (les vues `form` et
`survey` du chapitre 11 §1.6) se partage à quelqu'un qui n'a aucun droit sur la table :
à **n'importe qui** qui a le lien (partage **public**), ou aux **membres** connectés du
tenant — tous, ou ceux de certains groupes (partage **authentifié**).

Il s'appuie sur le catalogue (chapitre 02 : `_basedb.form_share`,
`_basedb.form_share_role`), sur la décision de droits du chapitre 05 (qu'il rejoue, sans
en ajouter), sur l'écriture d'une ligne du chapitre 06 et sur l'historique du chapitre 07
(le type d'acteur `form`). Il ne décrit ni un constructeur de formulaires à part — le
formulaire partagé **est** la vue, telle qu'on la configure dans l'application —, ni une
collecte anonyme hors des tables : chaque réponse est une ligne de la table, ni plus ni
moins.

---

## 1. Ce qu'est un partage

**Un partage est un lien vers une vue formulaire.** Une vue a au plus un partage
(`uq_form_share_view`) ; le lien a la forme `/f/<jeton>`, où le jeton est un secret de
32 caractères (24 octets aléatoires, base64url). Qui a le lien a la porte ; ce que la porte
ouvre dépend de l'**accès** :

| Accès | Qui peut répondre | Ce que voit la personne |
|---|---|---|
| `public` | quiconque a le lien, sans compte | le formulaire, seul |
| `members` | un membre connecté du tenant — de l'un des groupes choisis, s'il y en a | l'écran de connexion d'abord, puis le formulaire et « Vous répondez en tant que … » |

La page `/f/<jeton>` est **hors de l'application** : pas de barre latérale, pas d'onglets,
pas de table — le titre, la description, les questions, le bouton d'envoi et le message de
remerciement de la vue, dans son apparence (thème, accent, police, chapitre 11 §1.4), rien
d'autre. L'accent qu'elle reçoit est celui de la vue, à défaut la couleur de la table. Ni le nom de la base, ni celui de la table, ni les
autres lignes ne sont exposés.

Partager, changer l'accès, régénérer le lien ou arrêter le partage demandent
`manage_schema` sur la table — le même droit que configurer la vue (chapitre 11 §1.6).

---

## 2. Au nom de qui une réponse est écrite

C'est le cœur du chapitre : la personne qui répond n'a **aucun** droit sur la table, et la
réponse doit pourtant y entrer. Elle y entre sur **l'autorité de la personne qui a
publié le partage**, et de personne d'autre.

1. **Le publiant, c'est le dernier qui enregistre.** Créer le partage, le modifier ou
   régénérer son lien fait de celui qui agit le publiant (`form_share.published_by`).
   Un administrateur qui reprend le partage d'un collègue parti le reprend à son nom.
2. **Son droit est redécidé à chaque réponse.** À l'ouverture de la page comme à l'envoi,
   le noyau rejoue la décision du chapitre 05 pour le publiant — action `create` sur la
   table. S'il a perdu ce droit, s'il est désactivé ou supprimé, le formulaire est
   **suspendu** (`FORM_CLOSED`, raison `authority`) jusqu'à ce que quelqu'un qui a le droit
   l'enregistre à nouveau. Il n'y a ni délégation stockée, ni jeton technique qui
   survivrait à son auteur.
3. **Restreinte aux questions.** La réponse ne peut écrire que les champs que le
   formulaire pose **et** que le publiant peut modifier (`writableFields` de la décision).
   Une clé inconnue est refusée (`REQUEST_INVALID`, raison `question_inconnue`), pas
   ignorée : un formulaire partagé n'est pas une porte dérobée vers les autres colonnes.
4. **L'historique dit qui a répondu, pas qui a publié.**

| Accès | `_created_by` / `_updated_by` | Acteur de l'historique (chapitre 07) |
|---|---|---|
| `members` | la personne qui répond | `user`, la personne — comme si elle avait saisi la ligne |
| `public` | `NULL` | `form`, avec `actor_id` = le publiant et `actor_token_id` = le partage |

Le type d'acteur `form` existe pour cela : une réponse publique n'est ni l'œuvre du
publiant, qui ne l'a pas tapée, ni celle d'un inconnu qu'on inventerait. L'historique
l'affiche « Formulaire « Inscription » », avec en indication « réponse publique · publié
par X ». Le déclencheur `set_updated_at` laisse `_updated_by` à `NULL` pour cet acteur, et
les droits d'un acteur `form` sont vides (`loadGrants`) : il n'agit jamais que dans le
cadre de l'autorité du publiant.

---

## 3. Ce qu'un lien demande

Les questions d'un lien sont celles de la vue, dans son ordre, avec ses libellés et ses
aides, à trois filtres près :

- **le champ doit être vivant** — un champ supprimé depuis disparaît du formulaire ;
- **le type doit pouvoir se poser** sans rien révéler ni déposer : texte court, texte
  multiligne, lien URL, nombre, case à cocher, date, date et heure, choix unique, choix
  multiple. Une **relation** lirait une autre table pour proposer ses lignes ; un
  **document** ou une **image** ouvrirait le dépôt de fichiers à des inconnus ; une
  formule ne se saisit pas. Ces questions sont **omises** ;
- **le publiant doit pouvoir écrire le champ.**

Le dialogue de partage liste les questions omises et pourquoi, pour qu'on ne découvre pas
après coup qu'un champ attendu n'a jamais été demandé. Un formulaire dont il ne reste
aucune question est fermé (`FORM_CLOSED`, raison `sans_question`).

Une question est obligatoire si la vue la marque obligatoire ou si le champ l'est
(`is_required`) — à condition d'être **posée** : une question dont la condition (`show_if`)
ne tient pas pour les réponses reçues n'est ni exigée ni écrite, même si une valeur arrive
pour elle ; le serveur en juge avec la même règle que l'écran (`visibleQuestions`,
`@basedb/contracts`). Une réponse entièrement vide est refusée. Les valeurs passent par la même
écriture que n'importe quelle ligne (chapitre 06) : normalisation, validation par type,
unicité, valeurs par défaut — un formulaire partagé ne contourne aucune contrainte.

---

## 4. Le lien, un secret

Le jeton est un **secret porteur** : qui le connaît peut répondre (partage public) ou
atteindre l'écran de connexion (partage membres). Le catalogue n'en garde jamais la valeur
en clair :

| Colonne | Contenu | Sert à |
|---|---|---|
| `token_hash` | SHA-256 du jeton, unique | retrouver le partage à partir du lien |
| `token_sealed` | le jeton scellé par la clé d'instance, usage `form-share` | le **réafficher** dans le dialogue de partage |

Contrairement à un jeton d'API (chapitre 08), le lien d'un formulaire doit pouvoir être
recopié à tout moment par ceux qui le gèrent : d'où le scellement plutôt qu'un simple
hachage. Si la clé d'instance change, le lien ne peut plus être réaffiché (le dialogue le
montre vide) mais **fonctionne toujours** — le hachage suffit à le retrouver ; il suffit de
le régénérer pour en obtenir un nouveau visible.

**Régénérer** remplace le jeton : l'ancien lien cesse de fonctionner immédiatement. C'est
le geste à faire quand un lien a circulé plus loin que prévu. **Arrêter le partage**
supprime la ligne `form_share` ; les réponses déjà reçues restent dans la table.

---

## 5. Ouvrir et fermer

Un partage est **ouvert** tant que rien ne l'empêche ; sinon, `FORM_CLOSED` porte la
raison, dans cet ordre de priorité :

| État | Raison | Quand |
|---|---|---|
| `inactive` | désactivé | l'interrupteur « Lien actif » est coupé |
| `closed` | date passée | `closes_at` est dépassée |
| `full` | complet | `response_count` a atteint `max_responses` |
| `authority` | suspendu | le publiant ne peut plus créer de lignes (§2) |
| — | `sans_question` | aucune question ne reste à poser (§3) |

**Le nombre maximal de réponses est exact.** Une place est prise **avant** d'écrire la
ligne, par un `UPDATE … WHERE max_responses IS NULL OR response_count < max_responses` —
deux réponses simultanées ne peuvent pas prendre toutes deux la dernière place — et rendue
si l'écriture échoue (valeur invalide, doublon). `response_count` compte les réponses
**reçues par le lien** ; supprimer des lignes de la table ne rouvre pas de places.

Désactiver un partage ne le supprime pas : le lien est gardé, et le réactiver rouvre la
même adresse.

---

## 6. Partage réservé aux membres

Un partage `members` demande une session (`AUTHENTICATION_REQUIRED` sinon ; la page
affiche alors l'écran de connexion de l'application, puis recharge le formulaire). Un
partage fermé (§5) le dit **avant** de demander la connexion : se connecter ne le
rouvrirait pas. La
personne doit appartenir au **tenant** du formulaire — un membre d'un autre tenant trouve
`RESOURCE_NOT_FOUND`, comme partout — et, si des groupes sont choisis
(`_basedb.form_share_role`), à **l'un** d'eux ; sinon `FORM_RESTRICTED`.

Répondre ne demande **aucun droit sur la table** : c'est tout l'intérêt. Un membre qui
peut, par ailleurs, lire ou modifier la table n'en voit pas davantage sur la page
partagée. Un partage public ne garde pas de groupes (ils sont effacés à l'enregistrement).

---

## 7. Routes

Administration, sous `manage_schema` sur la table :

| Méthode | Route | Effet |
|---|---|---|
| `GET` | `/api/v1/{tenant}/admin/bases/{base}/tables/{table}/views/{view}/share` | le partage (ou `null`), les groupes du tenant, les questions omises |
| `PUT` | même route | crée ou modifie : `access`, `active`, `closes_at`, `max_responses`, `groups` |
| `POST` | `…/share/regenerate` | nouveau lien, l'ancien cesse de fonctionner |
| `DELETE` | même route | arrête le partage |

Chaque opération est journalisée (`form_share.create`, `form_share.update`,
`form_share.regenerate`, `form_share.delete`).

Réponse, sans droit sur la table — ni tenant dans l'adresse : le jeton suffit à situer le
formulaire :

| Méthode | Route | Effet |
|---|---|---|
| `GET` | `/api/v1/forms/{jeton}` | le formulaire tel que la page l'affiche : `kind`, `title`, `description`, `submit_label`, `success_message`, `allow_another`, `access`, `respondent`, `questions` (avec `placeholder`, `show_if`, `format` d'une note ou d'un montant), `design` (`theme`, `accent`, `font`, `align`, `welcome_label`, `show_progress`, `show_numbers`, `auto_advance`, `celebrate`, `end_link`) |
| `POST` | `/api/v1/forms/{jeton}` | `{ "values": { "<champ>": … } }` → `201 { "received": true }` |

Le jeton du porteur (`Authorization: Bearer`) est **facultatif** sur ces deux routes : il
identifie la personne pour un partage `members`, et un jeton invalide vaut absence de
jeton. La réponse ne renvoie **pas** la ligne créée — ni son identifiant, ni ses valeurs
normalisées : la personne qui répond n'a pas le droit de lire la table.

L'envoi est **limité à 20 réponses par minute par adresse et par lien** (`429
RATE_LIMIT_EXCEEDED`, avec `Retry-After`). Comme celle du chapitre 13 §6, cette limite est
tenue en mémoire du processus, donc **approximative** sur plusieurs instances ; elle
émousse un envoi en rafale, elle ne remplace pas `max_responses`.

---

## 8. Erreurs

| Code | HTTP | Quand | Ce qu'affiche la page |
|---|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | lien inconnu ou remplacé, vue ou table supprimée, autre tenant | « Lien introuvable » |
| `AUTHENTICATION_REQUIRED` | 401 | partage `members` sans session | l'écran de connexion |
| `FORM_RESTRICTED` | 403 | membre hors des groupes choisis | « Formulaire réservé » |
| `FORM_CLOSED` | 409 | §5, `details.reason` ∈ `inactive`, `closed`, `full`, `authority`, `sans_question` | « Ce formulaire n'accepte plus de réponses », avec la raison |
| `REQUEST_INVALID` | 400 | clé inconnue (`question_inconnue`), `values` qui n'est pas un objet | sous le bouton |
| `REQUIRED_VALUE_MISSING` | 422 | question obligatoire vide, réponse vide | sous le bouton |

Un formulaire fermé **pendant** qu'on le remplit bascule la page sur l'écran de fermeture
à l'envoi, plutôt qu'une ligne d'erreur sous le bouton.

---

## 9. Ce que le partage ne fait pas

- **Pas de relation, de document ni d'image** dans un formulaire partagé (§3). Les ouvrir
  demanderait une recherche restreinte dans la table liée et un dépôt de fichiers
  anonyme borné — deux sujets à part entière.
- **Pas de modification après envoi.** Une réponse envoyée est une ligne ; la personne
  qui répond ne la revoit pas et ne la corrige pas. « Envoyer une autre réponse » crée une
  nouvelle ligne.
- **Pas de protection anti-robot** au-delà de la limite par adresse et de
  `max_responses` : un partage public largement diffusé se ferme par la date limite, le
  plafond ou l'interrupteur.
- **La connexion OIDC** depuis la page d'un partage `members` ramène à l'accueil de
  l'application, pas au formulaire : il faut rouvrir le lien. La connexion par mot de
  passe, elle, reste sur la page.
- **Pas de partage par MCP** : un agent crée des lignes avec ses propres droits
  (chapitre 09), il n'a pas besoin d'un lien.
- **Pas de notification** à la réception d'une réponse ; les webhooks du chapitre 08 sur
  la création de ligne s'appliquent, comme à toute ligne.

---

## 10. Partager une vue en lecture seule

Une **vue de données** — grille, kanban, calendrier, chronologie, galerie, liste — se
partage comme un formulaire, par la même ligne `form_share` et les mêmes routes
d'administration (§7), mais pour être **lue** : la page `/v/<jeton>` montre les lignes
de la vue, sans rien permettre d'y changer. C'est le « lien de partage » d'une grille ou
d'un tableau qu'on envoie à qui n'a pas de compte, ou qu'on intègre à un site.

**Au nom de qui on lit.** La règle du §2, transposée : les lignes sont lues sur
l'autorité du publiant, dont le droit `read` sur la table est **redécidé à chaque
lecture**. S'il l'a perdu, la page est suspendue (`VIEW_SHARE_CLOSED`, raison
`authority`). Ce qu'elle montre est l'intersection de trois choses : les champs que la
vue affiche, ceux que le publiant peut lire, ses lignes (prédicat de lignes compris) — et
le filtre et le tri de la vue, qui s'appliquent tels quels. La personne qui lit n'y ajoute
ni filtre ni tri : la page est ce que la vue montre.

**Ce que la page ne montre pas.** Ni le nom de la base, ni celui de la table, ni les
lignes d'une autre table : une relation se lit par sa valeur d'affichage seule, sans
`_id`. Seul le `_id` des lignes de la vue est rendu — c'est lui que range l'ordre
manuel (`manual_order`) ; les fichiers et images passent par des liens signés, comme dans
l'application. Les champs
calculés à la lecture (chapitre 04 §7 ter) y figurent si le publiant peut les lire.

| Accès | Qui peut lire |
|---|---|
| `public` | quiconque a le lien |
| `members` | un membre connecté du tenant, de l'un des groupes choisis s'il y en a (`VIEW_SHARE_RESTRICTED` sinon) |

**Intégrer.** `can_embed` autorise la page dans une `<iframe>` d'un autre site. Seule
l'adresse `/v/<jeton>?embed=1` peut être encadrée — toute autre part avec
`frame-ancestors 'none'` — et elle s'affiche sans en-tête ; encadrée alors que
`can_embed` est faux, elle ne montre aucune ligne et dit que l'intégration n'est pas
autorisée. Le dialogue de partage donne le code à coller. Désactiver le lien (`is_active`) suspend la page
(`VIEW_SHARE_CLOSED`, raison `inactive`) ; `closes_at` et `max_responses` ne concernent
que les formulaires et restent nuls.

Lecture, sans droit sur la table — le jeton suffit à situer la vue :

| Méthode | Route | Effet |
|---|---|---|
| `GET` | `/api/v1/views/{jeton}` | la vue telle que la page l'affiche : `kind`, `title`, `description`, `fields` (visibles, avec leur type, leurs choix, leur format), `spec` (titre, couverture, regroupement…), et la première page de `rows` |
| `GET` | `/api/v1/views/{jeton}/rows?after=` | la page suivante, par curseur |

La lecture est limitée à **120 requêtes par minute par adresse et par lien**, comme
l'envoi d'un formulaire (§7).
