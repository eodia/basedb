# 14 — Environnements

## Rôle de ce chapitre

Ce chapitre fixe ce qu'est un **environnement** d'une base — production, recette,
développement —, comment il naît, comment on compare les environnements d'une base et
comment on reporte de l'un à l'autre la structure et les lignes.

Il s'appuie sur le catalogue (chapitre 02 : `base.lineage_id`, `base.environment`,
`table_def.lineage_id`, `field.lineage_id`, `_basedb.environment_sync`), sur l'historique
des structures (chapitre 07 §8, `_basedb.structure_revision`) et sur les opérations de
structure ordinaires des chapitres 03, 04 et 06, qu'il enchaîne sans en redéfinir aucune.
Il ne décrit ni un moteur de fusion de lignes, ni une branche au niveau de PostgreSQL :
§ 6 dit pourquoi.

---

## 1. Ce qu'est un environnement

**Un environnement est une base à part entière.** Il a son schéma PostgreSQL, ses tables,
ses lignes, ses droits, ses jetons et son historique ; l'API l'adresse par son propre nom
(`/data/{base}/{table}`), et psql le lit sous son propre schéma. Ce qui fait de plusieurs
bases **une** base, c'est leur **lignée** : elles partagent `base.lineage_id`, leur libellé,
leur description et leur apparence, et se distinguent par `environment`.

| | Production | Autre environnement |
|---|---|---|
| Existe | dès la création de la base | quand on l'ajoute |
| `is_production` | vrai | faux |
| Libellé unique dans le projet | oui (`uq_base_label_live`) | non : c'est celui de la base |
| Schéma | `b_<tenant>_<base>` | `b_<tenant>_<base>_<environnement>` |
| Se supprime seul | non (`ENVIRONMENT_IS_PRODUCTION`) | oui, comme une base |

**La production est l'environnement par défaut.** Une base qui n'a qu'elle ne montre aucun
environnement : l'interface ne l'affiche qu'à partir du deuxième.

**Renommer la base, la décrire ou l'habiller vaut pour tous ses environnements** : ces trois
attributs sont ceux de la base. `updateBase` les écrit dans chaque ligne de la lignée, dans la
même transaction. Le libellé d'un environnement — son badge — se change à part, et seulement
lui ; il est borné à 60 caractères (`ck_base_environment`) et unique dans la base
(`uq_base_environment_live`, `LABEL_DUPLICATE`).

**Supprimer la base supprime tous ses environnements**, production en dernier : un échec à
mi-chemin laisse une base qui a encore sa production. Chaque suppression est celle du
chapitre 06 §4.3 — tables reléguées, rien de détruit, restauration possible —, et se
restaure environnement par environnement.

## 2. La lignée

**Les tables et les champs ont eux aussi une lignée**, qui dit « c'est la même table » d'un
environnement à l'autre. Ni le nom physique ni le libellé ne le peuvent : « Clients »
renommée « Comptes » en recette reste la table de la production, et une « Clients » créée de
part et d'autre indépendamment reste deux tables.

- Une table ou un champ créé normalement **ouvre** une lignée (valeur par défaut de la
  colonne).
- Une table ou un champ créé par un report de structure (§ 3) **reprend** celle de son
  modèle : `createTable`, `addField` et `createLinkField` acceptent une lignée imposée, que
  seules les opérations de ce chapitre passent.
- La lignée est unique dans sa base pour une table (`uq_table_lineage`), dans sa table pour
  un champ (`uq_field_lineage`).

Les choix d'une liste n'ont pas de lignée : leur **valeur** est déjà leur identité, celle que
les lignes portent et que la contrainte `ck_…__enum` connaît.

## 3. La structure

### 3.1 Créer un environnement

Ajouter un environnement crée une base vide de la même lignée — même projet, même libellé,
même description, même apparence, droits de la base recopiés —, puis y **reporte la
structure** d'un environnement existant, la production par défaut, par le même mécanisme que
§ 3.3 : chaque table, chaque champ, chaque relation, chaque liste de choix, la colonne
d'affichage et l'ordre des champs. Les lignes ne sont pas copiées ; elles se synchronisent
ensuite (§ 4).

La création est enregistrée dans `environment_sync` (`kind = 'fork'`) : c'est le premier
point commun des deux environnements.

### 3.2 Comparer

La comparaison met **tous les environnements côte à côte**, un par colonne, table par table
et champ par champ, appariés par lignée. Pour chaque objet, chaque colonne dit ce qu'il est
dans cet environnement — absent, supprimé, son libellé, son type, son caractère obligatoire,
ses choix, la cible de sa relation, son option IA —, et ce qui diffère de la production est
marqué. Elle demande `manage_schema` sur chaque environnement.

### 3.3 Reporter : le plan de migration

Reporter la structure d'une **source** sur une **cible** commence par un **plan** : la liste
des étapes qui rendraient la cible semblable à la source. Chaque étape est une opération
ordinaire du noyau, avec ses propres contrôles, son historique et, quand il le faut, sa
migration (chapitre 03) :

| Étape | Opération | Quand |
|---|---|---|
| `create_table` | `createTable`, avec les champs qu'elle peut porter à la création | table absente de la cible |
| `add_field` | `addField`, puis `setFieldRequired` si la source l'exige | champ absent de la cible |
| `add_link` | `createLinkField` vers la table de même lignée | relation absente de la cible |
| `update_table` | `updateTable`, `setTableDescription` | libellé, description, apparence |
| `update_field` | `setFieldLabel`, `setFieldDescription` | libellé, description |
| `set_options` | `setSelectOptions` | choix d'une liste |
| `set_required` | `setFieldRequired` | caractère obligatoire |
| `set_ai`, `remove_ai` | `setAiField`, `disableAiField` | option IA (chapitre 04 §7 bis) |
| `set_display` | `setDisplayColumn` | colonne d'affichage |
| `reorder_fields` | `reorderFields` | ordre des champs |
| `delete_table` | `deleteTable` | table supprimée dans la source |

Les étapes s'appliquent **par phases** — tables créées, champs ajoutés, relations,
modifications, IA, affichage et ordre, suppressions —, pour que ce dont une étape a besoin
existe quand elle s'exécute ; une étape qui dépend d'une étape non appliquée est ignorée, et
dite. Chacune a sa transaction : un échec arrête cette étape et celles qui en dépendent, pas
les autres. Le plan est **recalculé** au moment d'appliquer : l'identifiant d'une étape
(`genre:lignée`) qui n'existe plus est signalé, jamais deviné.

**Ce qu'aucune étape ne règle est dit** à côté du plan : un champ ou une table présents
seulement dans la cible — le produit ne supprime pas de champ —, une table supprimée dans la
cible, une relation dont la cible ou le comportement à la suppression diffèrent, une
formule, une relation en cascade, qui exige sa confirmation propre.

### 3.4 Qui a raison : l'historique des structures

Pour un objet qui diffère des deux côtés, le plan lit **l'historique des structures**
(chapitre 07 §8.1) : la dernière modification de l'objet — sa ligne de catalogue, sa
configuration, ses choix — dans la source et dans la cible.

| Statut | Condition | Coché d'office |
|---|---|---|
| `ready` | la modification la plus récente est celle de la source | oui |
| `target_newer` | la cible a changé l'objet après la source : appliquer l'annulerait | non |
| `conflict` | les deux l'ont changé depuis leur dernière synchronisation | non |
| `needs_consent` | option IA : les valeurs citées partiraient chez le fournisseur | non |

**Le défaut d'« Appliquer » n'annule jamais le travail de personne.** La dernière
synchronisation est lue dans `environment_sync` (`fork` ou `structure`, dans un sens ou dans
l'autre) ; chaque report en écrit une, avec son bilan. L'option IA n'est reportée qu'avec le
consentement explicite du chapitre 12 §1.5, donné pour ce report ; sa consigne est traduite,
colonne citée par colonne citée, vers les noms de la cible.

### 3.5 Les droits

Reporter une structure, c'est bâtir : `manage_schema` sur la source et sur la cible. Les
droits posés sur une table ou un champ **créés** par le report sont recopiés de leur modèle —
une colonne masquée à un groupe en production l'est en recette dès qu'elle y existe. Seulement
ceux-là : un droit retiré exprès dans la cible n'est pas rétabli au report suivant.

## 4. Les lignes

**Les lignes se reconnaissent à leur `_id`**, qu'elles gardent d'un environnement à l'autre.
Deux environnements vivant dans la même base PostgreSQL, comparer les lignes d'une table est
**une** requête qui joint les deux schémas sur `_id`, et les recopier **une** instruction par
verbe : rien ne sort de PostgreSQL.

- **Comparer** donne, pour une table et un couple source → cible, le nombre de lignes présentes
  seulement dans la source, seulement dans la cible, différentes et identiques, un échantillon
  de chaque — reconnaissable par la colonne d'affichage, à défaut le premier texte court — et,
  pour une ligne différente, les colonnes qui diffèrent.
- **Synchroniser** ajoute les lignes manquantes avec leur `_id`, met à jour celles qui
  diffèrent, et — seulement si on le demande — supprime celles que la source n'a pas. Tout ou
  rien, dans une transaction ; les déclencheurs de la cible historisent chaque écriture au nom
  de la personne qui synchronise (chapitre 07).

**Ce qui est recopié** : les colonnes appariées par lignée, de même type, que l'on peut lire
dans la source et écrire dans la cible — les masques de champ tiennent ici comme partout. Une
colonne calculée par l'IA dans la cible est recopiée si on la lit : c'est une copie du noyau,
qui épargne à la cible les appels. **Ne sont pas recopiés** les documents et les images —
leurs fichiers sont déposés pour un champ et ne sont pas à la cible de les citer — ni les
formules, que la cible calcule.

**Les relations gardent leur sens** parce que les lignes gardent leur `_id` : la facture
recopiée pointe vers le client recopié. Encore faut-il qu'il y soit : une relation qui désigne
une ligne absente de la cible refuse la copie (`SYNC_REFERENCE_MISSING`), en nommant la table
à synchroniser d'abord. Une valeur que la cible refuse — un choix qu'elle n'offre pas, une
colonne obligatoire vide — la refuse aussi (`SYNC_VALUES_REFUSED`) : c'est la structure qui
est à reporter d'abord.

Droits : `read` sur la table source, et sur la table cible les verbes des écritures demandées
(`create`, `update`, `delete`).

## 5. L'interface

- **La navigation** montre une ligne par base. Quand elle a plusieurs environnements, un
  **badge** à côté du libellé dit lequel est ouvert, et c'est en cliquant dessus qu'on en
  change ; le choix est retenu par le navigateur. Hors production, le fil d'Ariane porte le
  même badge.
- **Le formulaire de la base** — création et modification — liste ses environnements : on y
  ajoute un environnement (copie de la structure de l'environnement choisi), on en renomme,
  on en supprime.
- **« Comparer les environnements »**, dans le menu de la base, ouvre une fenêtre à deux
  volets : « Tables et champs » — la comparaison en colonnes, puis « Appliquer les
  migrations » : le plan d'une source vers une cible, étape par étape, cochées selon § 3.4,
  et le bilan de chacune ; « Synchronisation des lignes » — une entrée par table, les
  compteurs, les échantillons, les trois cases et le bouton.
- **L'historique** d'une base a un second onglet, « Structure », qui lit
  `structure_revision` : un acte par ligne, ce qu'il a changé, de quoi à quoi, et son auteur.

## 6. Ce qui n'est pas fait, et pourquoi

- **Pas de fusion générale des lignes.** Fusionner des lignes modifiées des deux côtés est un
  problème de synchronisation, pas de versionnement : il n'a pas de solution juste sans règle
  métier. La synchronisation recopie dans un sens, table par table, et le dit.
- **Pas de branche PostgreSQL** (copie à l'écriture façon Neon) : elle n'existe pas dans
  PostgreSQL 16 standard, auto-hébergé.
- **Pas d'environnement dans une autre instance.** Le même modèle — lignée, comparaison,
  plan — le permettrait par un export de la structure en fichier ; il reste à écrire.
- **Pas de suppression de champ** dans un report : le produit n'en a pas encore.
- **Pas de verrou « production modifiable seulement par report »** : une option à venir, qui
  ferait de la production une branche protégée.

## 7. Codes d'erreur définis par ce chapitre

| Code | Condition | Statut HTTP |
|---|---|---|
| `ENVIRONMENT_IS_PRODUCTION` | Suppression de l'environnement de production seul | 409 |
| `ENVIRONMENT_MISMATCH` | Comparaison, report ou synchronisation entre deux bases qui ne sont pas deux environnements distincts d'une même base | 422 |
| `SYNC_REFERENCE_MISSING` | Relation vers une ligne absente de l'environnement cible | 409 |
| `SYNC_TABLE_MISSING` | Table absente, supprimée ou sans colonne commune dans l'un des deux environnements | 422 |
| `SYNC_VALUES_REFUSED` | Valeur recopiée refusée par une contrainte de la cible | 422 |

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Un environnement est une base, de la même lignée | Tout le reste — API, SQL, droits, historique, suppression — s'applique sans exception | Un environnement comme couche au-dessus des tables d'une base |
| Tables et champs appariés par lignée | Le nom et le libellé changent ; la lignée, jamais | Appariement par nom physique ou par libellé |
| Report = suite d'opérations ordinaires, recalculée à l'application | Chaque étape a ses contrôles, son historique, sa migration ; rien n'écrit le catalogue en direct | Un script DDL généré d'un bloc |
| Qui a raison se lit dans l'historique des structures | Seul moyen de ne pas annuler une modification plus récente de la cible | Toujours donner raison à la source |
| Lignes appariées par `_id`, copiées dans un sens, tout ou rien | Les relations gardent leur sens ; un échec ne laisse pas de copie partielle | Fusion bidirectionnelle ; copie ligne à ligne |
| Droits des objets créés recopiés, et seulement eux | Une restriction de la production vaut en recette ; un retrait délibéré dans la cible tient | Aucune recopie ; recopie à chaque report |

## État de la mise en œuvre (v1)

**Fait.** Tout ce qui précède : environnements (création par copie de structure, renommage,
suppression, suppression de la base entière), lignée des tables et des champs, comparaison en
colonnes, plan et report de structure avec statuts tirés de l'historique, synchronisation des
lignes, historique des structures lisible, interface complète.

**Écarts assumés.** Le report n'est pas atomique d'un bout à l'autre : chaque étape a sa
transaction, et un échec laisse les étapes précédentes appliquées — c'est le plan suivant qui
montre ce qui reste. La comparaison des lignes est bornée à vingt échantillons par catégorie ;
les compteurs, eux, sont exacts.
