# 17 — Automatisations et champ bouton

## Rôle de ce chapitre

Une **automatisation** fait quelque chose quand quelque chose arrive : quand une ligne
est créée, quand un champ change, à heure fixe, ou quand on clique sur un **bouton** dans
une ligne. Elle modifie la ligne, en crée une autre, prévient quelqu'un, demande une
réponse à l'IA ou appelle un service extérieur — et, quand une seule action ne suffit pas,
elle suit un **flux** : chercher une ligne, bifurquer selon ce qu'elle dit, répéter des
étapes sur chaque ligne qui répond à un filtre, passer à l'étape suivante ce que la
précédente a trouvé ou écrit. Ce chapitre fixe ce qu'elle peut faire, au nom de qui, et ce
qui l'empêche de s'emballer.

Trois principes, repris des chapitres qui précèdent :

- **rien hors de PostgreSQL** (A4) : les exécutions attendent dans une file en base,
  déclenchées par le drain de l'historique (chapitre 07 §1.4) ou par l'horloge ;
- **au nom de quelqu'un** : une automatisation agit avec les droits de la dernière
  personne qui l'a enregistrée, **redécidés à chaque exécution** — la règle du
  formulaire partagé (chapitre 15 §2) ;
- **l'historique dit qui a écrit** : une écriture d'automatisation est historisée comme
  telle, avec son nom et la personne qui en répond.

Et une règle d'usage : **une automatisation simple reste simple**. Un déclencheur, une
condition et une ou deux actions s'écrivent comme avant les flux, sans identifiant à
donner ni ligne à désigner ; ce qui fait un flux ne se montre qu'à qui s'en sert.

---

## 1. Ce qu'est une automatisation

Elle appartient à une base (`_basedb.automation`, chapitre 02). Elle a un nom, une
description, un interrupteur (active ou non), **un déclencheur**, une **condition**
facultative et **un flux d'étapes** : des actions les unes après les autres, dont une
**condition** peut faire plusieurs chemins qui se rejoignent ensuite (§1.5), et une
**boucle** répéter des étapes sur chaque ligne trouvée (§1.8).

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
les boucles impossibles. Ce qu'une chaîne d'automatisations aurait fait s'écrit en un
seul flux.

### 1.2 Condition

Pour un déclencheur de ligne ou un bouton, une condition facultative écrite dans le
langage des filtres (chapitre 08 §4) : évaluée sur la ligne **au moment de l'exécution**,
sous les droits du propriétaire, elle arrête l'exécution si la ligne n'y satisfait pas
(`skipped`). « Quand une tâche passe à Fait » s'écrit donc : `record_updated` surveillant
`statut`, condition `statut eq "fait"`.

Elle diffère d'une condition du flux (§1.5) par ce qu'elle dit de l'exécution : une ligne
qui n'y satisfait pas **écarte** l'exécution, qui le dit ; un chemin non pris est une
exécution qui a réussi autrement.

### 1.3 Étapes

Le flux est la liste `actions` de l'automatisation, dans l'ordre. Chaque étape a une
nature, ses réglages et un **identifiant** — `e1`, `e2`… pour une étape, `c1`, `c2`… pour
un chemin — que l'API donne à qui n'en donne pas, et qui ne change plus : c'est par lui
qu'une étape en désigne une autre (§1.4, §1.6) et qu'une exécution dit où elle est
passée (§2.1). Un identifiant s'écrit `[a-z][a-z0-9_]{0,31}`, est unique dans
l'automatisation, et `trigger` est réservé.

| Nature | Effet | Réglages | Ce qu'elle donne aux suivantes |
|---|---|---|---|
| `update_record` | modifie une ligne | la ligne (§1.4) ; les champs et leurs valeurs | la ligne, relue après l'écriture |
| `create_record` | crée une ligne dans une table de la base | la table, les champs et leurs valeurs | la ligne créée |
| `find_record` | cherche la première ligne qui répond à un filtre | la table ; le filtre (vide : toute ligne) ; l'ordre (`champ` ou `-champ`, par défaut celui de création) | la ligne trouvée — ou aucune |
| `notify` | notification interne (chapitre 16 §2), nature `automation` | la ligne dont elle parle (§1.4) ; des personnes et/ou un champ « personne » de cette ligne ; un message | — |
| `email` | un courriel par destinataire, par le serveur d'envoi de l'instance (chapitre 16 §2.5) | la ligne dont il parle (§1.4, facultative) ; des personnes, un champ « personne » et/ou un champ « e-mail » de cette ligne, des adresses écrites — 20 au plus ; l'objet et le message, qui citent ce qui précède (§1.6) | — |
| `webhook` | une requête HTTPS vers un service (§1.9) | la méthode (`POST` par défaut, `PUT`, `PATCH`, `GET`, `DELETE`) ; l'adresse (`https`), qui peut citer après son hôte ; des en-têtes, en clair ou secrets ; le corps — le JSON de l'automatisation et sa ligne (§1.4), ou un corps composé en JSON, en formulaire ou en texte | le code de réponse et la réponse (§1.6) |
| `slack` | un message dans un canal Slack (chapitre 19 §1) | une connexion de la base, le message | — |
| `ai` | demande une réponse au fournisseur d'IA (chapitre 12 §1.8) | la consigne, qui cite ce qui précède (§1.6) ; la réponse attendue (`answer`) — texte libre ou court, nombre, oui ou non, date, adresse web, un choix parmi une liste (`options`) ; le consentement (`consent`) | la réponse, lue dans son type |
| `branch` | une condition : des chemins, dont un seul est pris (§1.5) | les chemins, dans l'ordre | — |
| `for_each` | une boucle : ses étapes, une fois pour chaque ligne qui répond (§1.8) | la table ; le filtre (vide : toutes les lignes) ; l'ordre ; la limite (`limit`, 50 par défaut, 200 au plus) ; les étapes (`steps`) | à ses étapes, la ligne du tour ; après elle, le nombre de lignes parcourues |

Un webhook obéit aux règles d'adresse des webhooks (chapitre 08 §10.3 : `https`, pas
d'adresse privée), attend 10 secondes au plus, et échoue (`AUTOMATION_WEBHOOK_FAILED`) sur
toute réponse autre que `2xx`.

Une étape `ai` suit les règles d'un champ IA (chapitre 12 §1.5, §1.8). Ne partent au
fournisseur que sa consigne, les valeurs citées mises en place — une valeur vide s'y lit
« (vide) » —, le format attendu et le nom de l'automatisation. La réponse est relue dans
le type demandé ; une réponse où rien ne s'y lit fait échouer l'étape
(`AI_RESPONSE_UNUSABLE`). La personne qui enregistre l'étape consent à cet envoi
(`consent: true`, faute de quoi `AI_CONSENT_REQUIRED`), et l'écran lui redemande son accord
quand la consigne change ; une étape `ai` est refusée à l'écriture tant que l'IA n'est pas
configurée (`AI_DISABLED`, `AI_NOT_CONFIGURED`) — activer ou désactiver l'automatisation
reste toujours possible. Le fournisseur est appelé par le processus de l'API, qui seul
détient le transport ; chaque appel est une ligne `ai_call` de nature `automation`, sous le
plafond horaire des calculs de fond, partagé avec les cellules IA (chapitre 12 §6.2). La
réponse n'agit sur rien : ce sont les étapes suivantes qui l'écrivent, l'envoient ou la
citent, par leurs propres chemins et avec les droits du propriétaire.

Une étape `email` **met en file** un courriel par boîte — une adresse n'en reçoit qu'un,
quelle que soit la façon dont elle est nommée — dans `_basedb.mail_outbox`, avec son objet
et son texte déjà rendus ; la boucle d'envoi le remet au relais et le reprend en cas
d'échec (chapitre 16 §2.4). L'étape réussit donc quand la file a pris le courriel, et dit
combien ; aucun destinataire — un champ vide, une personne qui ne peut pas lire la ligne —,
elle est passée (`aucun_destinataire`). Une personne du locataire reçoit à son adresse de
connexion, si elle peut lire la table de la ligne, comme pour une notification ; une adresse
écrite ou lue dans un champ « e-mail » reçoit sans condition : c'est l'auteur de
l'automatisation qui l'a voulue. Le courriel est en texte simple, porte
`Auto-Submitted: auto-generated`, et sa réponse (`Reply-To`) va au **propriétaire** de
l'automatisation, pas à l'adresse du relais. Sans serveur d'envoi, l'étape échoue
(`MAIL_NOT_CONFIGURED`) et l'éditeur le dit dès qu'on la règle ; un modèle de base n'en porte
pas (chapitre 20), pas plus qu'un webhook ou un message Slack.

### 1.4 La ligne d'une étape

`update_record`, `notify` et `webhook` agissent sur une ligne, que nomme leur réglage
`record` : `trigger`, la ligne qui a déclenché, ou l'identifiant d'une étape passée avant
elle qui en donne une (`find_record`, `create_record`, `update_record`, et, pour les
étapes qu'elle contient, la boucle `for_each` qui les répète). Absent, c'est la ligne
déclencheuse — ce qu'une automatisation d'avant les flux a toujours fait, et qu'elle
continue de faire telle qu'elle est enregistrée.

Une horloge n'a pas de ligne : `update_record` y est refusé à l'enregistrement tant qu'il
ne nomme pas celle d'une étape (`REQUEST_INVALID`, raison `action_sans_ligne`) ;
`notify`, qui ouvre une ligne, n'y prévient personne sans en nommer une. « Chaque lundi,
relancer la plus vieille facture impayée » s'écrit : `schedule`, puis `find_record` dans
les factures (`payee eq false`, ordre `emise_le`), puis `notify` à propos de sa ligne.

Une recherche qui n'a rien trouvé ne fait pas échouer l'exécution : les étapes qui
agiraient sur sa ligne sont **passées** (`skipped`, `aucune_ligne`) et le flux continue.
Pour faire autre chose quand rien n'est trouvé, une condition le teste (§1.5).

### 1.5 Conditions et chemins

Une étape `branch` porte de 1 à 5 **chemins**, dans l'ordre. Chacun a un nom, des étapes,
et un test `when` : une ligne (`record`, §1.4) et un filtre qu'elle doit satisfaire
(`condition`, dans le langage des filtres, relu sur la ligne à ce moment et sous les
droits du propriétaire). Un filtre vide demande seulement que la ligne existe — ce qui
se lit, après une recherche, « si elle a trouvé ». Le **dernier** chemin peut n'avoir
aucun test (`when: null`) : c'est « Sinon ».

Le **premier** chemin dont le test tient est pris, et lui seul ; aucun ne tient et il n'y
a pas de « Sinon » : aucun n'est pris. Les chemins **se rejoignent** ensuite, et le flux
continue à l'étape qui suit la condition. Un chemin peut porter une condition à son tour,
sur trois niveaux au plus.

Une étape ne voit que ce qui est passé **sur tous les chemins qui mènent à elle** : les
étapes avant elle dans son chemin, et celles d'avant chaque condition qui la contient. Ce
qu'un chemin a trouvé ou écrit ne se cite plus après la condition : ce chemin n'a peut-être
pas été pris. Le noyau le vérifie à l'enregistrement (`REQUEST_INVALID`, raison
`etape_inconnue`, avec l'étape en cause sous `details.step`).

```json
{ "label": "Projet livré",
  "trigger": { "kind": "record_updated", "table": "taches", "fields": ["statut"] },
  "condition": "statut eq \"fait\"",
  "actions": [
    { "kind": "find_record", "table": "taches",
      "filter": "projets_id eq {{projets_id}} and statut ne \"fait\"" },
    { "kind": "branch", "paths": [
      { "label": "Encore du travail", "when": { "record": "e1", "condition": "" },
        "steps": [ { "kind": "notify", "user_field": "assigne_a",
                     "message": "Reste « {{e1.titre}} » sur ce projet" } ] },
      { "label": "Sinon", "when": null,
        "steps": [
          { "id": "projet", "kind": "find_record", "table": "projets",
            "filter": "_id eq {{projets_id}}" },
          { "kind": "update_record", "record": "projet", "values": { "statut": "livre" } } ] } ] } ] }
```

### 1.6 Citer

Une valeur, un message, un filtre cite ce qui précède :

| Citation | Ce qu'elle lit |
|---|---|
| `{{champ}}` | un champ de la ligne déclencheuse |
| `{{_id}}` | l'identifiant de la ligne déclencheuse |
| `{{_maintenant}}` | l'instant de l'exécution |
| `{{e2.champ}}`, `{{e2._id}}` | un champ, l'identifiant de la ligne qu'a donnée l'étape `e2` |
| `{{e3.statut}}`, `{{e3.reponse.cle}}` | le code de réponse du webhook `e3`, une clé de sa réponse (JSON, 64 Kio lus au plus) |
| `{{e4.reponse}}` | la réponse de l'étape IA `e4` : un texte, un nombre, oui ou non, une date, un choix par son libellé |
| `{{e5.champ}}`, `{{e5._id}}` | dans la boucle `e5`, un champ, l'identifiant de la ligne du tour |
| `{{e5.nombre}}` | après la boucle `e5`, le nombre de lignes qu'elle a parcourues |

Dans un message ou un texte, un champ se lit comme on le lit : une relation par sa valeur
d'affichage, un choix par son libellé, une personne par son nom. Une valeur faite d'**une
seule citation**, écrite dans un champ qui n'est pas un texte, passe la valeur elle-même :
une relation par l'identifiant de sa ligne, un choix par sa clé, une personne, un nombre —
c'est ainsi qu'une étape relie la ligne qu'elle crée à celle qu'une autre a trouvée. Un
choix nommé par son **libellé** — tapé tel quel, « À faire », ou répondu par l'IA — est
rangé à la clé du choix de même libellé.

Dans un **filtre**, une citation est toujours une valeur comparée, jamais du langage : un
texte y devient une chaîne entre guillemets, ses guillemets échappés ; un nombre et un
booléen restent nus ; une relation y est l'identifiant de sa ligne. Une valeur écrite par
un formulaire ne peut donc pas changer ce que cherche une automatisation.

La même règle vaut pour ce qu'un webhook envoie (§1.9). Dans son **adresse**, une citation
est encodée (`encodeURIComponent`) : elle ajoute au chemin ou à la requête, jamais un
segment ni un paramètre. Dans un corps **JSON**, une citation entre guillemets est du texte
échappé, qui ne ferme pas la chaîne ; hors guillemets, une valeur JSON — un nombre (une
colonne numérique aussi, que PostgreSQL rend en texte), oui ou non, `null`, une relation, un
choix, une personne par leur texte, plusieurs par une liste, la réponse d'un webhook ou de
l'IA telle qu'elle est venue. Dans un **formulaire**, chaque paire est encodée comme un
formulaire web.

Un champ que le propriétaire ne peut pas lire, une étape qui n'a rien donné : la citation
est vide.

### 1.7 Bornes

| Borne | Valeur |
|---|---|
| Étapes en tout, conditions et ce qu'elles contiennent compris | 30 |
| Chemins par condition | 5 |
| Conditions imbriquées | 3 niveaux |
| Filtre, condition | 4 000 caractères |
| Personnes prévenues nommément par une étape | 20 |
| Réponse d'un webhook lue pour être citée | 64 Kio |
| Consigne d'une étape IA | 8 000 caractères |
| Choix proposés à une étape IA | 50 |
| Lignes parcourues par une boucle | 200 (50 si rien n'est dit) |
| Boucles imbriquées | aucune : une boucle n'en contient pas d'autre |
| En-têtes d'un webhook | 20, de 4 000 caractères chacun |
| Corps composé d'un webhook | 10 000 caractères |
| Durée d'une exécution | 2 minutes, vérifiées à chaque tour de boucle (`DEADLINE_EXCEEDED`) |

### 1.8 Pour chaque ligne

Une étape `for_each` lit, **une fois** et avec les droits du propriétaire, les lignes d'une
table qui répondent à son filtre — qui cite ce qui précède, comme celui d'une recherche —,
dans son ordre, jusqu'à sa limite ; puis elle exécute ses étapes (`steps`) **une fois pour
chacune**. Dans la boucle, son identifiant nomme la **ligne du tour** : `{{e5.client}}` la
cite, `"record": "e5"` la modifie ou en parle, un chemin la teste. Chaque tour repart à
neuf : ce qu'une étape de la boucle a trouvé au tour précédent ne se cite pas au suivant.
Après la boucle, ses étapes ne se citent plus et sa ligne non plus ; `{{e5.nombre}}` dit
combien de lignes elle a parcourues.

La première étape qui échoue arrête l'exécution, à quelque tour que ce soit ; les tours
déjà faits restent faits. Au-delà de sa limite, les lignes restent pour la prochaine
exécution — l'exécution le dit (`more`) : pour les traiter toutes au fil des exécutions, la
boucle fait sortir de son filtre celles qu'elle a traitées (une case « relancée », une date
de relance). Une boucle ne contient pas de boucle : le travail d'une exécution reste celui
d'une liste, pas d'un produit de listes.

```json
{ "label": "Relances du lundi",
  "trigger": { "kind": "schedule", "schedule": { "every": "week", "weekday": 1, "at": "09:00" } },
  "actions": [
    { "kind": "for_each", "table": "factures", "limit": 100, "sort": "echeance",
      "filter": "payee eq false and relancee eq false",
      "steps": [
        { "kind": "email", "record": "e1", "email_field": "contact",
          "subject": "Facture {{e1.numero}}", "message": "Bonjour, la facture {{e1.numero}}…" },
        { "kind": "update_record", "record": "e1", "values": { "relancee": true } } ] },
    { "kind": "notify", "users": ["…"], "message": "{{e1.nombre}} relances envoyées" } ] }
```

### 1.9 Un webhook composé

Sans réglage, un webhook envoie en `POST` le **JSON de l'automatisation** : l'automatisation,
le déclencheur, la ligne envoyée (§1.4), l'instant, et, sous `steps`, ce que les étapes
précédentes ont trouvé ou écrit, par identifiant — ce qu'il a toujours fait. Pour parler à
un service tel qu'il l'attend, l'étape règle :

- la **méthode** : `GET` et `DELETE` n'envoient pas de corps (en donner un est refusé,
  `corps_sans_objet`) ;
- l'**adresse**, qui peut citer après son hôte (`https://api.exemple.fr/clients/{{e2.numero}}`) :
  l'hôte s'écrit en toutes lettres (`hote_cite`), c'est lui que les règles d'adresse
  vérifient à l'enregistrement, et encore à chaque exécution ;
- des **en-têtes** (`headers: [{ name, value, secret }]`), dont la valeur peut citer ;
  ceux que HTTP fixe lui-même (`Host`, `Content-Length`, `Connection`…) sont refusés
  (`entete_interdit`) ;
- un **corps composé** (`body`), dans un format (`format`) : `json`, `form` (une paire
  `clé=valeur` par ligne) ou `text` ; il est vérifié à l'enregistrement — un JSON qui ne
  s'analyse pas, citations mises en place, est refusé (`corps_json_invalide`). Son
  `Content-Type` suit le format, sauf si un en-tête l'écrit.

Un **en-tête secret** (`secret: true`) — une clé d'API, un jeton — est **scellé** par la clé
de l'instance (A25, finalité `automation/webhook-header`) avec la base et l'hôte pour
lesquels il a été donné, et n'est **plus jamais montré** : l'API le rend avec son nom, `value:
null` et cet hôte ; le Copilot n'en voit que le nom ; un modèle de base n'en porte pas. Un
enregistrement qui le renvoie sans valeur le **garde** — l'éditeur n'a rien d'autre à
renvoyer —, mais seulement si l'adresse vise toujours le même hôte : sinon il faut le redonner
(`secret_a_redonner`). Changer l'adresse ne suffit donc pas à envoyer le secret ailleurs ; et
un secret descellé pour une autre base ou un autre hôte fait échouer l'étape plutôt que de
partir. Une instance sans clé de chiffrement refuse un en-tête secret (`secret_impossible`)
plutôt que de le garder en clair.

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
3. les étapes, dans l'ordre, une condition descendant le chemin qu'elle prend, une boucle
   répétant les siennes pour chaque ligne ; chacune
   avec les droits du propriétaire, par les mêmes chemins que l'API (masques,
   contraintes, historique). Une étape lit une ligne **telle que les précédentes l'ont
   laissée** : une ligne modifiée est relue. La première étape qui échoue arrête
   l'exécution : `failed`, avec le code de l'échec ; les étapes précédentes restent
   faites.

Chaque exécution garde, dans `steps`, **chaque étape par où elle est passée**, dans
l'ordre : son identifiant (`step`), sa nature (`kind`), son résultat (`succeeded`,
`failed`, `skipped`), le chemin pris par une condition (`path`, `null` si aucun), ce
qu'elle a fait (`detail` : les champs écrits, l'identifiant de la ligne créée ou trouvée,
le nombre de personnes prévenues, le code HTTP, la longueur d'une réponse de l'IA) et sa
durée en millisecondes (`ms`). Une boucle y dit combien de lignes elle a parcourues
(`detail`) et si d'autres restaient au-delà de sa limite (`more`) ; une étape qu'elle
contient n'y figure **qu'une fois**, pour tous ses tours : combien (`times`), la durée
cumulée, le pire de ses résultats et ce qu'il a dit — les personnes prévenues et les
courriels, additionnés ; tous les chemins pris par une condition (`taken`). Ni
les valeurs lues ni celles écrites n'y sont recopiées : l'historique les garde, avec ses
droits. Une exécution d'avant les flux, sans identifiants, se lit dans l'ordre des
étapes du premier niveau.

L'écran pose une exécution sur le flux : les étapes passées disent leur résultat et leur
durée, le chemin pris est tracé, le reste est estompé — ce qui s'est passé, et pourquoi
pas.

### 2.2 Au nom de qui

Les écritures d'une automatisation sont faites par un acteur de nature `automation`
(chapitre 07 §2.1) : l'identifiant de son propriétaire, et celui de l'automatisation
comme identifiant de jeton. L'historique les montre « Automatisation « Relance » (Marie
Dupont) ». Si le propriétaire a perdu le droit d'écrire, l'étape échoue avec le refus
ordinaire (`ACTION_FORBIDDEN`, `FIELD_NOT_WRITABLE`…) ; le réenregistrer au nom d'une autre
personne la répare. Une recherche et le test d'un chemin lisent, eux aussi, avec les
droits du propriétaire : une ligne qu'il ne voit pas n'est pas trouvée.

### 2.3 Garde-fous

- **Débit** : 100 exécutions par heure et par automatisation ; au-delà, l'exécution est
  `skipped`, raison `debit` — un import de 10 000 lignes ne déclenche pas
  10 000 webhooks.
- **Pas de chaîne entre automatisations** : §1.1.
- **Un flux qui ne revient pas en arrière** : il se lit de haut en bas ; une condition
  n'envoie jamais en arrière (§1.5), une boucle répète ses étapes sur une liste lue une
  fois et bornée (§1.8), et une exécution s'arrête au bout de 2 minutes
  (`DEADLINE_EXCEEDED`) : le travailleur les prend l'une après l'autre, et une boucle de
  webhooks lents ne doit pas retenir les automatisations de toute l'instance.
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
| `GET` | `/admin/bases/{base}/automations/{id}/runs` | ses 50 dernières exécutions, étape par étape | `manage_schema` | session seule |
| `POST` | `/automations/{id}/run` | l'exécuter pour une ligne : un clic sur un bouton (`read` sur la ligne), ou un essai depuis l'écran (`manage_schema`) | selon le cas | session, jeton |
| `POST` | `/ai/bases/{base}/automation-copilot` | un tour du Copilot des automatisations : `{messages, automation?, draft?, read_data}` ; propose, n'enregistre rien (§6) | `manage_schema` | session seule |

Une automatisation se lit et s'écrit avec son flux entier sous `actions` : les étapes et,
dans une condition, ses chemins (`paths`) et leurs étapes, dans une boucle ses étapes
(`steps`), chacune avec son identifiant. Une table s'y écrit par son nom ou sa clé, et se
lit par sa clé. Un en-tête secret s'y lit sans sa valeur (§1.9).

---

## 6. Le Copilot des automatisations

Le copilote du chapitre 12 §1.6, à côté des automatisations, comme celui des tableaux de bord
(chapitre 18 §2.6) : la personne demande dans ses mots — « quand une tâche passe en revue,
préviens la personne assignée », « ajoute un résumé par l'IA dans les notes », « pourquoi la
dernière exécution a-t-elle échoué ? » — et il répond en quelques phrases et **propose** :
une automatisation entière, celle de l'écran modifiée ou une nouvelle, au plus deux par
réponse.

| Proposition | Ce que la carte montre | Ce que le clic fait |
|---|---|---|
| celle de l'écran, modifiée (`target: "current"`) | Les changements, un par ligne : déclencheur, condition, étapes ajoutées, modifiées, retirées — par leur identifiant | La pose sur le flux de l'éditeur, **sans l'enregistrer** ; la carte propose ensuite de l'annuler, tant que le flux n'a pas changé depuis |
| une nouvelle (`target: "new"`) | Ce qu'elle fait : son déclencheur, sa condition, ses étapes | L'ouvre dans l'éditeur, à créer |

Le noyau fait de chaque proposition ce qu'un enregistrement accepterait : la définition passe
par les vérifications d'un enregistrement (§1 à §1.7 : tables, champs, lignes, citations,
bornes, IA configurée), à blanc, et revient avec ses identifiants ; ce qui ne tient pas est
écarté et dit — le modèle reçoit une fois les raisons, avec les noms qu'il peut employer, et
corrige. Une proposition n'est **jamais enregistrée** par le Copilot : l'éditeur la montre sur
le flux, la personne la relit, et l'enregistre par le chemin ordinaire — c'est là que ses
étapes IA demandent l'accord de §1.3, que la proposition ne donne jamais. Les étapes gardées
gardent leur identifiant, et les citations qui les nomment avec lui.

**Ce qu'il voit** : les tables et colonnes que la personne lit — sans celles soustraites aux
modèles tiers —, les automatisations de la base, celle de l'écran **telle que l'éditeur la
montre**, enregistrée ou non, ses dix dernières exécutions étape par étape — statuts, chemins
pris, codes d'erreur, jamais une valeur —, et les personnes et canaux Slack qu'une étape peut
nommer, sous des références propres à l'appel (`p1`, `s1`) : aucun identifiant ne part.
**Ce qu'il lit**, sur le consentement de la conversation seulement : des lignes, du SQL pour
qui la console est ouverte — chaque lecture avec les droits de la personne, 50 lignes au plus,
trois tours au plus, listée sous la réponse. Le Copilot demande `manage_schema` sur la base,
comme l'écran des automatisations ; ses appels sont ceux du copilote — `usage_kind =
'copilot'`, sous le plafond horaire des usages interactifs.

---

## Décisions retenues

- **Déclenché par le drain**, pas par les routes : une automatisation voit toute
  écriture, d'où qu'elle vienne, comme l'historique.
- **Les droits du propriétaire, redécidés à chaque fois**, comme un formulaire partagé :
  l'automatisation n'a pas de droits à elle, et cesse d'agir quand la personne qui en
  répond ne peut plus.
- **Un flux dans une automatisation, pas de chaîne entre automatisations** : c'est la
  seule garantie simple contre une boucle entre deux automatisations qui se modifient
  l'une l'autre, et ce qu'une chaîne aurait fait s'écrit dans un seul flux.
- **Un arbre, pas un graphe libre** : une condition ouvre des chemins qui se rejoignent
  ensuite, une boucle tient ses étapes comme un chemin tient les siennes, rien ne revient
  en arrière. Ni étape atteinte par deux côtés dont on ne saurait lequel a écrit ; ce
  qu'une étape peut citer se décide à l'enregistrement, et une exécution se lit comme un
  chemin dans l'arbre. Un graphe libre ne se justifierait qu'avec ce qu'il permettrait —
  attendre, reprendre — et qui demanderait une file par étape.
- **Répéter sur une liste, pas revenir en arrière** : une boucle lit ses lignes une fois,
  bornées, puis les parcourt ; elle ne se relance pas sur ce qu'elle a écrit, et ne
  contient pas d'autre boucle. Son travail se sait avant de commencer — une liste, pas une
  condition d'arrêt —, et une étape qu'elle répète se garde une fois dans l'exécution,
  avec ses tours, plutôt que deux cents.
- **Un secret de webhook scellé pour un hôte** : l'écran d'une automatisation se montre à
  qui construit la base, et son flux au fournisseur d'IA du Copilot ; une clé d'API n'a rien
  à y faire. Scellée, elle n'est vue par personne ; liée à l'hôte, elle ne part pas ailleurs
  quand quelqu'un change l'adresse sans la connaître.
- **Une étape relit les lignes**, elle ne reçoit pas de copie : ce qu'elle voit est ce que
  la base contient à cet instant, sous les droits du propriétaire, et une exécution ne
  garde que ses traces (§2.1) — pas les données.
- **Une citation dans un filtre est une valeur**, jamais du langage (§1.6).
- **Le Copilot propose une automatisation entière, que l'éditeur montre avant tout
  enregistrement** : une automatisation agit ensuite seule, avec les droits de celui qui
  l'enregistre ; la voir sur le flux, étape par étape, et l'enregistrer soi-même est le
  consentement qu'elle demande — ce qu'un tableau de bord, qui ne fait que lire, n'exige pas.
- **L'IA dans une étape, aux règles d'une cellule IA** : même consentement, même charge
  utile réduite à ce que la consigne cite, même journal, même plafond que les calculs de
  fond. Sa réponse est une donnée : l'IA ne choisit ni ne déclenche aucune action, ce sont
  les étapes que l'auteur a posées après elle qui agissent.
- **L'éditeur dessine le flux** avec React Flow (`@xyflow/react`, licence MIT), sur une
  mise en page calculée — un arbre n'en demande pas d'autre. Le modèle « Workflow
  Editor » de React Flow Pro n'en est pas la source : sa licence en réserve le code aux
  abonnés, ce qu'un dépôt public ne peut pas être.
- **Pas de script** : un script exécuté par le serveur serait une surface d'attaque et
  un moteur d'exécution de plus ; un webhook vers un service qu'on contrôle en tient lieu,
  et sa réponse se cite dans les étapes suivantes.

## Risques et limites connues

- Une automatisation qui écrit n'en déclenche pas d'autre : « quand une facture est
  payée, retrouver le projet, le clore, puis prévenir le client » s'écrit en un seul flux.
- Une recherche donne **une** ligne, la première qui répond ; pour en traiter plusieurs,
  une boucle (§1.8) — 200 au plus par exécution, et la première étape qui échoue arrête
  toute la boucle : un courriel refusé au tour 3 laisse les tours suivants à la prochaine
  exécution.
- Un flux s'exécute d'une traite : pas d'attente (« trois jours après »), pas de reprise
  d'une exécution échouée là où elle s'est arrêtée.
- Un webhook ne suit pas de redirection, et n'attend pas plus de 10 secondes ; une API qui
  demande une authentification en plusieurs temps (OAuth) passe par un service qu'on
  contrôle, qui détient le jeton.
- Ce qu'un chemin a trouvé ne se cite pas après la condition : ce que plusieurs chemins
  doivent partager se cherche avant elle.
- Une condition ne teste que des lignes : pour bifurquer sur la réponse de l'IA, l'écrire
  d'abord dans un champ de la ligne, que le chemin teste ensuite.
- La condition est évaluée à l'exécution, pas au déclenchement : une ligne modifiée
  entre-temps est jugée telle qu'elle est.
- Un modèle de base (chapitre 20) ne porte encore que des étapes les unes après les
  autres sur la ligne déclencheuse : l'export d'une base laisse de côté, en le disant,
  une automatisation qui cherche, bifurque, boucle, demande à l'IA ou cite une étape.
- Le délai entre l'écriture et l'exécution est celui d'un drain plus un tour du
  travailleur, de l'ordre de la seconde.
