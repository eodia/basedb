# 20 — Modèles de base

## Rôle de ce chapitre

Ce chapitre fixe ce qu'est un **modèle de base** — un document JSON qui décrit une base
entière —, son format, d'où viennent les modèles (le site public, l'instance), comment
l'IA en propose un à partir d'une phrase, comment une base existante devient un modèle,
et ce qu'est la base de démonstration. Il remplace le §3 du chapitre 18 et révise la
décision A28 sur ce point (A30).

---

## 1. Ce qu'est un modèle

### 1.1 Un document, pas un programme

Un modèle décrit une base : ses tables et leurs champs — listes de choix, formats,
formules, recherches, cumuls, décomptes, champs calculés par l'IA, boutons —, ses
relations, des lignes d'exemple, ses vues de toutes sortes (formulaires compris), ses
tableaux de bord et ses automatisations. Il est **déclaratif** : il cite tout par des
libellés et des clés qu'il se donne, jamais par un nom physique ou un identifiant — ceux-ci
n'existent qu'une fois la base créée.

Le même format sert partout : les fichiers du site public, les modèles importés dans une
instance, la proposition de l'IA, l'export d'une base. Son validateur vit dans
`@basedb/contracts`, partagé par le serveur, l'interface et le site : un modèle accepté
par l'un l'est par les autres.

### 1.2 Appliqué par l'interface

Un modèle est appliqué par l'interface, par les routes publiques, avec les droits de la
personne qui l'applique (A28, maintenue) : il ne peut rien faire qu'elle ne pourrait faire
à la main, et hérite de toutes les validations de l'API. Il n'existe pas de route « créer
une base depuis un modèle ».

### 1.3 Ce qu'un modèle ne contient jamais

Un modèle vient parfois d'ailleurs — le site public, un fichier reçu, une IA. Il ne porte
donc rien qui ouvre une porte ou fasse sortir une donnée sans le geste de quelqu'un :

- ni partage, ni lien public, ni droit, ni groupe ;
- ni action d'automatisation `webhook` ou `slack`, ni connexion, ni table synchronisée ;
- ni fichier, ni image, ni personne — sinon « la personne qui applique le modèle » ;
- ni bloc « page extérieure » dans un tableau de bord ;
- un bouton n'ouvre qu'une adresse `https:` ou `mailto:`, composée de la ligne, au clic.

Un champ calculé par l'IA envoie les valeurs qu'il cite au fournisseur configuré : il n'est
créé comme tel qu'avec le consentement explicite de la personne qui applique le modèle
(chapitre 12 §1.5, §4).

---

## 2. Le format

### 2.1 L'enveloppe

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Bugs et demandes, triés par l'IA, suivis jusqu'à leur résolution.",
  "description": "Texte plus long, montré sur la page du modèle.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tags": ["IA", "Kanban", "Formulaire"],
  "base": { "label": "Suivi de tickets", "description": "À quoi sert la base." },
  "tables": [], "links": [], "rows": {}, "views": [], "dashboards": [], "automations": []
}
```

`key` s'écrit en minuscules, chiffres et tirets (64 caractères au plus) : c'est l'adresse du
modèle dans un catalogue. `icon` est un nom d'icône Lucide ; une icône inconnue est
remplacée par une icône générique. `base.label` vaut `label` quand il manque.

### 2.2 Tables et champs

```json
{
  "key": "tickets",
  "label": "Tickets",
  "description": "Un ticket par problème ou demande.",
  "fields": [
    { "label": "Titre", "kind": "short_text", "required": true },
    { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", { "label": "Résolu", "color": "#10b981" }] },
    { "label": "Estimation", "kind": "number", "format": { "display": "duration" } },
    { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" },
    { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande", "Question"],
      "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } }
  ]
}
```

- Le **premier champ** est la colonne d'affichage ; il est d'un type simple : texte court
  ou long, nombre, date, date-heure, e-mail, adresse, numéro automatique.
- Types admis : ceux du chapitre 04, sauf `link` et `multi_link` (les relations, §2.3),
  `file` et `image`.
- `options` : une liste de libellés, ou d'objets `{label, color}` ; la valeur stockée est
  dérivée du libellé (minuscules, sans accents, `_` pour séparateur).
- `format` : celui du chapitre 04 §2.11 (`currency` et sa devise, `percent`, `duration`,
  `rating` et sa note maximale, `phone`, `barcode`).
- `formula` : l'expression du chapitre 04 §7, qui cite les champs par leur libellé.
- `rollup` pour `lookup`, `rollup` et `count` : `{ "via": "Libellé de la relation",
  "target": "Libellé du champ lu", "aggregate": "sum" }` ; pour une relation d'une autre
  table vers celle-ci, `"table": "clé de cette autre table"`.
- `ai` : `{ "prompt": "…{{Libellé}}…", "refresh": "if_empty" }` ou
  `"refresh": { "cron": "0 8 * * 1", "timezone": "Europe/Paris" }`, sur les sept types du
  chapitre 12 §1.5.
- `button` : `{ "label": "Écrire", "url": "mailto:{{E-mail}}" }` ou
  `{ "label": "Relancer", "automation": "clé d'une automatisation" }` (§2.7).

### 2.3 Relations

```json
{ "from": "tickets", "label": "Produit", "to": "produits", "multiple": false,
  "description": "Le produit concerné." }
```

Une relation ajoute à la table `from` un champ `label` qui désigne des lignes de `to` —
plusieurs si `multiple`. Une relation d'une table vers elle-même (« Dépend de ») est
admise.

### 2.4 Lignes d'exemple

```json
"rows": {
  "produits": [ { "$key": "app", "Nom": "Application mobile" } ],
  "tickets": [
    { "Titre": "Crash au démarrage", "Statut": "En cours", "Produit": "@app",
      "Ouvert le": "-3d", "Assigné à": "$moi", "Catégorie": "Bug" }
  ]
}
```

Les valeurs sont données par libellé de champ :

- un choix par son **libellé** (ou sa valeur), une liste de choix par une liste ;
- une relation par `"@clé"` — la `$key` d'une ligne de la table visée —, une liste pour
  une relation multiple ;
- une date par `"2026-10-01"`, ou relativement au jour où le modèle est appliqué :
  `"+3d"`, `"-2w"`, `"+1m"`, `"today"` ; une date-heure ajoute l'heure, `"+1d 14:30"` ;
- une personne par `"$moi"` seulement ;
- un champ calculé par l'IA peut recevoir une valeur d'exemple : elle n'est écrite que si
  le champ a été créé sans l'IA (§4) ; sinon l'IA remplit la cellule.

### 2.5 Vues

```json
{ "table": "tickets", "label": "Tableau", "kind": "kanban",
  "spec": { "group_by": "Statut", "card_fields": ["Produit", "Priorité"],
            "filter": "[Statut] ne \"Fermé\"", "sorts": [{ "field": "Ouvert le", "direction": "desc" }] } }
```

Sortes : `grid`, `kanban`, `calendar`, `timeline`, `gallery`, `list`, `form`. La `spec` est
celle du chapitre 11, les champs y étant cités par leur libellé :

| Clé | Sortes | Contenu |
|---|---|---|
| `filter` | toutes sauf `form` | l'expression du chapitre 08, un champ cité `[Libellé]`, un choix par son libellé ou sa valeur |
| `sorts` | toutes sauf `form` | `[{field, direction}]` |
| `hidden`, `pinned`, `column_order` | `grid` | des libellés |
| `group_by`, `color_field`, `summaries`, `row_height` | `grid` | idem ; `summaries` : `{libellé: agrégat}` |
| `title_field`, `card_fields` | cartes | idem |
| `group_by`, `group_order`, `hide_empty` | `kanban` | `group_order` : des libellés de choix |
| `date_field`, `end_field`, `color_field`, `mode` | `calendar` | |
| `start_field`, `end_field`, `group_by`, `color_field`, `scale`, `depends_on` | `timeline` | |
| `card_size`, `color_field` | `gallery` | |
| `group_by` | `list` | |
| `title`, `description`, `fields`, `submit_label`, `success_message` | `form` | `fields` : `[{field, required, label, help}]` |

Une vue formulaire n'est pas partagée par le modèle : la partager reste un geste
(chapitre 15).

### 2.6 Tableaux de bord

```json
{ "label": "Vue d'ensemble", "blocks": [
  { "kind": "number", "title": "Tickets ouverts", "table": "tickets", "aggregate": "count", "filter": "[Statut] ne \"Fermé\"" },
  { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" },
  { "kind": "list", "title": "Les plus anciens", "table": "tickets", "fields": ["Titre", "Statut"], "sort": "Ouvert le", "limit": 5 },
  { "kind": "text", "title": "Mode d'emploi", "body": "…" } ] }
```

Les blocs du chapitre 18 §1.1, sans `embed` ; `width` vaut 1 par défaut (sur 3).

### 2.7 Automatisations

```json
{ "key": "resolution", "label": "Date de résolution",
  "trigger": { "kind": "record_updated", "table": "tickets", "fields": ["Statut"] },
  "condition": "[Statut] eq \"Résolu\"",
  "actions": [ { "kind": "update_record", "values": { "Résolu le": "{{_maintenant}}" } } ] }
```

Celles du chapitre 17, les champs cités par libellé — dans les valeurs, les messages
(`{{Libellé}}`) et la condition (`[Libellé]`). Actions admises : `update_record`,
`create_record` (`"table": "clé"`), `notify` (`"user_field": "Libellé"` et un message). Une
automatisation de déclencheur `button` est citée par la `key` d'un champ bouton.

### 2.8 Bornes

30 tables, 100 champs par table, 200 lignes d'exemple par table et 2 000 en tout,
20 vues, 5 tableaux de bord de 12 blocs, 20 automatisations ; 1 Mo de JSON. Un libellé
fait 80 caractères au plus, une description 2 000.

### 2.9 Validation

Tout modèle est validé avant d'être montré ou enregistré : structure, types, libellés
uniques par table, références résolues (tables, champs, relations, choix, clés de lignes,
automatisations), bornes, et les interdits du §1.3. Un modèle refusé l'est par
`TEMPLATE_INVALID` (`422`), avec `details.issues[]` : pour chaque défaut, son chemin
(`tables[1].fields[3].options`) et une phrase.

Une proposition de l'IA est validée en **mode réparation** : ce qui ne tient pas — une vue
qui cite un champ inconnu, une valeur hors liste — est retiré et dit, plutôt que de
refuser le tout (§5).

---

## 3. D'où viennent les modèles

### 3.1 Le catalogue du site public

Les modèles officiels sont des fichiers JSON du dépôt, un par modèle, dans
`packages/templates/catalog/`. Le site public en fait une galerie — une page par modèle,
ses tables, ses vues, ses champs IA — et publie le catalogue entier à l'adresse
`/modeles/catalogue.json` : `{ "format": 1, "templates": [ … ] }`.

Une instance lit ce catalogue à l'adresse `BASEDB_TEMPLATES_URL` — par défaut celle du site
public — quand quelqu'un ouvre la galerie, et le garde une heure. La lecture obéit aux
règles des adresses appelées par le serveur (HTTPS, adresse publique, 5 secondes, 2 Mo) ;
chaque modèle y est validé, et un modèle invalide est écarté sans écarter les autres. Si
le site ne répond pas, l'instance garde la dernière copie lue ; faute de copie, elle sert
les modèles **intégrés** à l'application, ces mêmes fichiers tels qu'ils étaient à sa
construction. `BASEDB_TEMPLATES_URL=off` coupe la lecture : l'instance ne sert alors que
ses modèles intégrés et les siens.

Modifier un modèle officiel, c'est modifier son fichier et republier le site : les
instances le voient à leur prochaine lecture.

### 3.2 Les modèles de l'instance

Un administrateur de l'instance importe un modèle JSON — collé, ou lu d'un fichier —, qui
rejoint la galerie de tous. Importer un modèle de même clé le remplace. Il est enregistré
dans `_basedb.template` (chapitre 02), et se retire de la galerie.

### 3.3 Priorité

Sous une même clé, le modèle de l'instance l'emporte sur celui du site, qui l'emporte sur
le modèle intégré. La galerie dit la source de chacun.

---

## 4. Appliquer un modèle

La galerie montre le modèle avant tout : ses tables et leurs champs, ses relations, ses
vues, ses tableaux de bord, ses automatisations, le nombre de lignes d'exemple, et chaque
champ calculé par l'IA avec sa consigne. La personne choisit le libellé de la base et, si
le modèle a des champs IA, coche ou non le consentement du chapitre 12 §1.5.

L'interface applique ensuite, dans l'ordre : la base ; chaque table avec son premier
champ ; les champs simples ; les relations ; les champs calculés (formules, recherches,
cumuls, décomptes) ; les champs IA ; les colonnes d'affichage ; les lignes, table par
table, les relations résolues par leurs clés ; les automatisations de bouton puis les
boutons ; les vues ; les tableaux de bord ; les autres automatisations. Chaque étape est
dite à l'écran.

Un champ IA est créé **sans l'IA**, comme un champ ordinaire de son type, quand la
personne n'a pas consenti ou que l'IA n'est pas configurée ; ses valeurs d'exemple sont
alors écrites, et l'écran le dit. Une étape qui échoue arrête la suite : la base existe,
incomplète, et l'écran dit jusqu'où elle a été construite.

---

## 5. Proposé par l'IA

La galerie accepte une phrase — « le suivi des réclamations de mes clients, avec une
analyse du ton » — et demande à l'IA une proposition : un modèle complet, avec des lignes
d'exemple crédibles, des vues, un tableau de bord et, quand l'usage s'y prête, des champs
calculés par l'IA. La personne le lit comme tout modèle, peut demander de l'**affiner**
(« ajoute une table des fournisseurs ») ou recommencer, puis crée la base.

C'est l'usage `template_draft` du chapitre 12 : il n'envoie au fournisseur que la phrase,
la proposition précédente quand on affine, et la date du jour — aucune donnée d'aucune
base. Il demande `manage_schema` sur le projet où la base sera créée, compte dans le
plafond horaire des usages interactifs, et dispose de 90 secondes et 12 000 jetons. La
réponse est validée en mode réparation (§2.9) ; ce qui a été retiré est listé sous la
proposition. Rien n'est créé avant que la personne clique « Créer la base ».

---

## 6. Une base devient un modèle

Le menu d'une base propose « Enregistrer comme modèle ». L'interface compose le modèle à
partir de ce que la personne lit : tables, champs et leurs réglages — consignes IA
comprises —, relations, vues, tableaux de bord, automatisations ; et, si elle le demande,
jusqu'à 50 lignes par table. Ce que le §1.3 exclut n'est pas exporté ; une vue, un bloc ou
une automatisation qui citerait quelque chose d'exclu est omis et l'écran le dit.

Le modèle se télécharge en JSON — prêt à rejoindre `packages/templates/catalog/` — ou,
pour un administrateur, rejoint directement le catalogue de l'instance.

---

## 7. La base de démonstration

« Base de démonstration », dans un projet vide, applique le modèle `demo` du catalogue :
une petite agence et ses clients, projets, tâches, factures et avis, qui montre les
relations, les calculs, les champs IA, chaque sorte de vue, un tableau de bord et une
automatisation.

---

## 8. Routes

| Méthode | Route | Effet | Droit | Acteurs |
|---|---|---|---|---|
| `GET` | `/meta/templates` | le catalogue : pour chaque modèle, son résumé, ses comptes, sa source | être connecté | session, jeton |
| `GET` | `/meta/templates/{key}` | un modèle complet | être connecté | session, jeton |
| `POST` | `/admin/templates` | importer un modèle dans l'instance, ou remplacer celui de même clé | administrateur de l'instance | session seule |
| `DELETE` | `/admin/templates/{key}` | retirer un modèle de l'instance | administrateur de l'instance | session seule |
| `POST` | `/admin/templates/draft` | une proposition de l'IA : `{project, request, previous?}` | `manage_schema` sur le projet | session seule |

---

## Décisions retenues

- **Un format JSON unique** pour le site, l'instance, l'IA et l'export : une seule
  validation, partagée, et un modèle écrit à la main ou par l'IA se lit de la même façon.
- **Le site public publie, les instances lisent** : modifier la galerie de toutes les
  instances ne demande ni nouvelle version, ni redéploiement.
- **Appliqué par l'interface** : un modèle, d'où qu'il vienne, ne fait rien que la personne
  ne pourrait faire, et ne contient rien qui ouvre une porte (§1.3).
- **Réparer la proposition de l'IA plutôt que la refuser** : un modèle aux trois quarts
  juste vaut mieux qu'un refus, à condition de dire ce qui a été retiré.

## Risques et limites connues

- L'application d'un modèle n'est pas atomique : une étape qui échoue laisse une base
  incomplète, à compléter ou à supprimer.
- La lecture du catalogue du site est une requête sortante de l'instance ; elle se coupe
  par `BASEDB_TEMPLATES_URL=off`.
- Les lignes d'exemple ne portent ni fichier, ni image : une galerie d'exemple n'a pas de
  couverture.
- L'IA peut proposer un modèle plausible mais maladroit ; la galerie le montre en entier
  avant toute création.
