# 18 — Interfaces, extensions et modèles

## Rôle de ce chapitre

Une base se lit aussi autrement qu'en table : un **tableau de bord** (une « interface »)
rassemble, sur une page, les chiffres, les graphiques et les listes qui répondent aux
questions de tous les jours — combien de tâches en retard, qui porte quoi, ce qui a été
fait cette semaine. Une **extension** y ajoute une page venue d'ailleurs. Un **modèle**
évite de partir d'une base vide.

Deux principes :

- **un tableau de bord n'élargit aucun droit** : chaque bloc lit par les routes
  ordinaires, avec les droits de la personne qui regarde (chapitre 05). Un bloc qui cite
  une table ou un champ qu'elle ne peut pas lire le dit, et ne montre rien — à la
  différence d'une vue partagée (chapitre 15 §10), qui lit sur l'autorité de qui l'a
  publiée ;
- **pas de code tiers dans basedb** : une extension est une page affichée dans un cadre
  isolé, sans accès à la session ni aux données.

---

## 1. Tableaux de bord

### 1.1 Ce qu'est un tableau de bord

Il appartient à une base (`_basedb.dashboard`, chapitre 02) : un nom, une description,
une place dans la liste de la base, et **des blocs** (24 au plus), rangés sur une grille
de trois colonnes — chaque bloc large d'une, deux ou trois colonnes.

| Bloc | Ce qu'il montre | Réglages |
|---|---|---|
| `number` | un chiffre : le nombre de lignes, ou la somme, la moyenne, le minimum, le maximum d'un champ | la table, l'agrégat, le champ, un filtre |
| `chart` | le nombre de lignes par valeur d'un champ — barres ou secteurs | la table, le champ de regroupement, un filtre, le style |
| `list` | les premières lignes d'une table, cliquables | la table, six champs au plus, un filtre, un tri, 20 lignes au plus |
| `text` | un texte en Markdown — une consigne, un titre de section | le texte (5 000 caractères) |
| `embed` | une page extérieure dans un cadre isolé (§2) | l'adresse `https` |

Un bloc de données se sert des routes de lecture existantes : `number` et `chart` de
`GET /data/{base}/{table}/aggregate` (chapitre 08 §1.4), `list` de la liste paginée. Ses
réglages sont validés à l'enregistrement — la table et les champs existent, l'agrégat
convient au type — et relus, droits compris, à chaque affichage.

### 1.2 Qui peut quoi

| Geste | Condition |
|---|---|
| Voir les tableaux de bord d'une base | voir la base : pouvoir lire au moins une de ses tables |
| Voir un bloc | pouvoir lire ce qu'il cite ; sinon « Donnée inaccessible » |
| Construire, modifier, supprimer un tableau de bord | `manage_schema` sur la base, en session |

La liste des tableaux de bord est la même pour tous les lecteurs de la base : ce sont
les blocs qui se taisent, pas le tableau qui disparaît.

---

## 2. Extensions

Une extension v1 est un bloc `embed` : une page à une adresse `https`, affichée dans un
cadre `sandbox` (scripts permis, pas de navigation du cadre parent, pas d'accès à
l'origine de basedb). Aucune information de session ni aucune donnée ne lui est passée :
une page qui a besoin des données les lit par l'API avec un jeton d'intégration qui lui
est propre (chapitre 08 §11), sous la responsabilité de qui l'a construite. Une adresse
`http`, `javascript:` ou sans hôte est refusée (`REQUEST_INVALID`, raison
`adresse_invalide`).

Il n'y a pas de place de marché ni de code exécuté par basedb pour le compte d'une
extension : c'est le même refus que pour les scripts d'automatisation (chapitre 17).

---

## 3. Modèles

*Décision révisée* (A30) : les modèles de base ont leur chapitre, le **20**. Ils y sont
des documents JSON publiés par le site public, importés par l'instance ou proposés par
l'IA ; ils restent appliqués par l'interface, par les routes publiques, avec les droits
de qui les applique.

---

## 4. Routes

| Méthode | Route | Effet | Droit | Acteurs |
|---|---|---|---|---|
| `GET` | `/meta/bases/{base}/dashboards` | les tableaux de bord de la base, dans leur ordre | voir la base | session, jeton |
| `POST` | `/admin/bases/{base}/dashboards` | en créer un : `{label, description?, blocks}` | `manage_schema` | session seule |
| `PATCH` `DELETE` | `/admin/bases/{base}/dashboards/{id}` | le modifier (`blocks` remplacé en entier, `position`) ; le supprimer | `manage_schema` | session seule |

---

## Décisions retenues

- **Les droits du lecteur, pas ceux du constructeur** : un tableau de bord est une
  manière de lire, pas une porte ; celui qui veut montrer des données à qui ne peut pas
  les lire partage une vue (chapitre 15 §10), explicitement.
- **Des blocs sur les routes existantes** : pas de langage de requête propre aux
  tableaux de bord, pas de cache de résultats ; un bloc coûte la requête qu'il fait.
- **Des modèles appliqués par l'interface** : aucune surface serveur de plus, et un
  modèle hérite de toutes les validations de l'API.

## Risques et limites connues

- Un graphique compte les lignes par valeur ; il ne somme pas un champ par groupe.
- Un tableau de bord chargé fait une requête par bloc de données.
- Les modèles : voir le chapitre 20.
