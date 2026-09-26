# 00. Décisions structurantes

Ce chapitre fixe les décisions dont dépendent plusieurs autres chapitres. Il fait
autorité : en cas de divergence entre ce chapitre et un autre, celui-ci l'emporte
et l'autre doit être corrigé. Chaque décision porte un numéro stable, cité par les
chapitres qui l'appliquent.

Les quatre premières ont été arbitrées par le commanditaire ; les suivantes
découlent de la relecture croisée du document.

---

## Décisions arbitrées par le commanditaire

### A1 — PostgreSQL 16 minimum

Le produit exige PostgreSQL 16 ou plus. Le démarrage échoue sinon, avec le code
unique `POSTGRES_VERSION_TOO_OLD`.

Ce plancher est ce dont le document dépend réellement : `pg_input_is_valid` pour
pré-valider une conversion de type sans lever d'exception, `EXPLAIN (GENERIC_PLAN)`
pour borner une requête avant exécution, `reltuples = -1` pour distinguer une table
jamais analysée d'une table vide, `UNIQUE NULLS NOT DISTINCT` (15) et les vues
`security_invoker` (15).

Aucun chapitre ne mentionne une autre version, ni en exigence, ni en question
ouverte.

### A2 — Identifiants système en anglais

Les tables et colonnes du catalogue `_basedb`, ainsi que les codes d'erreur de
l'API, sont nommés en anglais, en `snake_case` pour les identifiants SQL et en
`MAJUSCULES_ASCII` pour les codes d'erreur.

Cette règle ne concerne que les objets système. Les bases, tables et champs créés
par les utilisateurs portent les noms métier issus de leurs libellés, en français
ou dans toute autre langue, selon les règles du chapitre 01.

Les libellés affichés dans l'interface et les messages destinés aux humains restent
en français. Un code d'erreur est un identifiant machine, pas un message.

### A3 — Extensions PostgreSQL exigées

`pg_trgm`, `unaccent` et la disponibilité des collations ICU sont des prérequis
d'installation, vérifiés au démarrage. Leur absence empêche le démarrage avec un
code distinct par extension manquante.

Le document ne spécifie pas de chemin de repli sans extension : la recherche
« contient » indexée et la comparaison insensible aux accents s'appuient dessus.

### A4 — PostgreSQL seul, sans dépendance externe

Aucune brique d'infrastructure en dehors de la base : pas de Redis, pas de cache
externe, pas de courtier de messages. Les files d'attente et les verrous vivent
dans PostgreSQL.

Les compteurs de limitation de débit, eux, vivent en mémoire de chaque processus
applicatif. Aucune table de compteurs par fenêtre glissante n'existe : elle mettrait
une écriture en base sur le chemin de chaque requête, pour une protection qui tolère
l'approximation. Conséquence assumée : avec plusieurs instances applicatives, la
limitation de débit est approximative, et le chapitre 08 documente cette
approximation au lieu de l'ignorer.

Deux protections échappent à cette règle parce qu'elles doivent être exactes, et
elles s'appuient sur des colonnes du catalogue plutôt que sur des compteurs : le
verrouillage d'une identité après échecs répétés d'authentification
(`auth_identity.failed_attempts` et `locked_until`) et la suspension d'un jeton
d'intégration, décidée en différé à partir du journal de sécurité.

---

## Nommage et catalogue

### A5 — Un registre unique des noms physiques

`_basedb.physical_name` est le seul détenteur des noms physiques. Les tables
d'objets du catalogue le référencent par clé étrangère et ne dupliquent jamais la
chaîne : les colonnes `schema_name`, `physical_name` et équivalentes disparaissent
du catalogue au profit d'une référence.

Le registre porte les cinq états `active`, `relegated`, `retired`, `alias`, `purged`,
sans lesquels ni la purge, ni la restauration, ni les alias de compatibilité ne
sont implémentables. Son DDL est donné dans le chapitre 02, qui fait autorité sur
le catalogue ; le chapitre 01 définit les règles de calcul des noms, pas leur
stockage.

Une vue de confort exposant le nom qualifié complet est fournie pour la lisibilité
des requêtes de diagnostic.

### A6 — Motifs des noms dérivés et budgets d'octets

Les motifs du chapitre 01 font foi, parce qu'ils restent lisibles dans un message
d'erreur PostgreSQL :

| Objet | Motif | Exemple |
|---|---|---|
| Clé primaire | `pk_<table>` | `pk_factures` |
| Clé étrangère | `fk_<table>__<colonne>` | `fk_factures__client_id` |
| Index | `ix_<table>__<colonne>` | `ix_factures__client_id` |
| Unicité | `uq_<table>__<colonne>` | `uq_factures__numero` |
| Vérification | `ck_<table>__<colonne>__<regle>` | `ck_factures__montant__range` |

Budgets d'octets : 53 pour le slug de base, 48 pour une table, 48 pour un champ,
63 pour un nom dérivé. Quand un nom composite dépasse 63 octets, le budget est
réparti entre ses composants de façon déterministe ; aucun raccourcissement par
empreinte cryptographique, qui rendrait le nom illisible dans un message d'erreur.

Le désambiguïsateur `<id12>` du chapitre 02 est supprimé.

### A7 — Nom de la colonne de clé étrangère

Le nom par défaut est `<table_cible>_id`, conformément au cadrage. S'il est déjà
pris — typiquement un second lien vers la même table cible — le moteur propose le
slug du libellé du champ suivi de `_id` ; en dernier recours seulement, un suffixe
numérique.

Le nom retenu est figé à la création, restitué à l'utilisateur, affiché dans
l'interface et renvoyé par l'API et le MCP. Il ne dépend jamais d'un recalcul
ultérieur ni de l'ordre de création des champs.

Exemple : une table `interventions` liée deux fois à `contacts`, par les champs
« Client » et « Technicien », produit `contacts_id` puis `technicien_id`.

### A8 — Clé de verrou consultatif stockée au catalogue

Les verrous consultatifs utilisent une clé entière attribuée et stockée au
catalogue, jamais `hashtext()`, dont les collisions provoqueraient des blocages
mutuels entre bases sans rapport. Un registre des classes de verrous est défini
dans le chapitre 02.

---

## Structure physique et migrations

### A9 — Un schéma technique colocalisé, `_basedb_local`

Les objets partagés dont les schémas de données dépendent vivent dans un schéma
unique, `_basedb_local`, colocalisé avec les données :

- les fonctions `uuid_generate_v7()`, `set_updated_at()`, la fonction de
  normalisation utilisée par les index d'expression, et la fonction de capture ;
- les tables tampon de la capture (révisions et événements sortants).

Son nom est figé, non configurable : il est écrit dans la clause `DEFAULT` de la
colonne `_id` de toutes les tables utilisateur, et le rendre variable imposerait
un `ALTER` de toutes les tables le jour où il change.

Cette décision remplace les cinq emplacements concurrents décrits par les chapitres
02, 03, 04, 06, 07 et 10, et lève l'interdit formulé par le chapitre 10 : aucun
objet d'un schéma `b_*` ne référence `_basedb`, mais tous peuvent référencer
`_basedb_local`, qui suit les données en cas de séparation physique du catalogue.

### A10 — Capture par déclencheur, drain vers le catalogue

L'historique des enregistrements et les événements sortants sont capturés par des
déclencheurs PostgreSQL, dans la transaction qui écrit la donnée, vers les tables
tampon de `_basedb_local`. Un processus de drain les transfère ensuite vers
`_basedb`.

C'est la seule architecture qui tienne la promesse centrale du cadrage : une
écriture SQL directe, faite par un humain sans passer par l'application, est
historisée comme les autres. Elle préserve aussi l'atomicité — si la capture
échoue, l'écriture échoue — sans exiger qu'une transaction couvre les deux pools.

Les trois mécanismes concurrents sont supprimés : la table `_outbox` dans le schéma
de données, le schéma `_basedb_local` alimenté applicativement du chapitre 10, et
`webhook_outbox` dans `_basedb`. Une seule table de révisions, une seule table
d'événements sortants, un seul mécanisme.

Le chapitre 07 est normatif sur la liste des déclencheurs posés sur une table
utilisateur ; le vocabulaire fermé du chapitre 01 est étendu à cette liste.

### A11 — Migrations en plusieurs étapes

Le couple `ADD CONSTRAINT ... NOT VALID` puis `VALIDATE CONSTRAINT`, et
`CREATE INDEX CONCURRENTLY`, sont employés. Une opération de structure est donc un
plan à plusieurs transactions, avec une machine à états, et non une transaction
unique.

C'est la seule façon de poser une clé étrangère ou un index sur une table
volumineuse sans indisponibilité, ce que le cadrage exige explicitement. Le
chapitre 04 est réécrit sur ce modèle au lieu de le contredire ; il conserve la
projection des types, les expressions et les pré-contrôles, qui sont sa matière
propre.

L'exigence « DDL et catalogue dans la même transaction » du cadrage porte sur
chaque étape : aucune étape ne laisse le catalogue et la structure physique
désaccordés, et l'état intermédiaire est explicitement représenté au catalogue.

### A12 — Table `migration` unique

La table `_basedb.migration` intègre les colonnes réclamées par le chapitre 03 :
identité du planificateur, bail d'exécution, tentatives, diagnostic PostgreSQL
complet en cas d'échec, énoncé fautif.

`up_sql` est un tableau ordonné d'énoncés en `jsonb`, pas un bloc de texte.
`sequence` est nullable tant que la migration n'est pas passée en exécution, avec
l'index unique partiel correspondant.

Vocabulaire d'états unique, en anglais (A2) : `proposed`, `approved`, `applying`,
`applied`, `failed`, `interrupted`, `superseded`, `expired`.

---

## Relations

### A13 — Clause `ON DELETE` réellement émise

Pour la valeur `restrict` du catalogue, la clause émise est `ON DELETE NO ACTION`.
`ON UPDATE` vaut toujours `NO ACTION`, la clé primaire `_id` étant immuable.

Le refus exigé par le cadrage est intégralement préservé : `NO ACTION` refuse
exactement les mêmes suppressions que `RESTRICT`. La seule différence est le moment
de la vérification — en fin d'instruction plutôt qu'immédiatement — ce qui permet à
une suppression en lot de réussir quand elle supprime dans la même instruction une
ligne et celles qui la référencent. Avec `RESTRICT`, ce cas échouerait sans raison
métier, notamment sur une table hiérarchique qui se référence elle-même.

Les règles de réconciliation des chapitres 02 et 06 attendent en conséquence
`confdeltype = 'a'` quand le catalogue déclare `restrict`, et non `'r'`.

### A14 — La cascade est exécutée par PostgreSQL

Quand un champ lien est configuré en cascade, la clause `ON DELETE CASCADE` est
réellement émise en base. Une suppression faite directement en SQL cascade donc
comme une suppression faite par l'API : c'est la contrepartie de la promesse
« vraies tables exploitables en SQL ».

L'application n'implémente pas de cascade applicative. Avant d'exécuter une
suppression qui cascade, elle effectue un décompte des lignes atteintes, l'affiche
et exige une confirmation ; mais la suppression en chaîne elle-même est celle de
PostgreSQL.

Les lignes supprimées en chaîne sont historisées et produisent des événements
webhook, parce que la capture est faite par déclencheur (A10) : les déclencheurs
voient les suppressions cascadées, et `pg_trigger_depth() > 1` les distingue des
suppressions directes.

L'autorisation d'un champ lien en cascade reste nominative et réservée, selon le
chapitre 05 ; le catalogue conserve la trace de qui l'a accordée.

### A15 — Colonne d'affichage : refus explicite, jamais de bascule

`display_field_id` est nullable, et l'absence de désignation est un état valide.
Supprimer logiquement le champ désigné comme colonne d'affichage est refusé, avec
le code `DISPLAY_FIELD_IN_USE`.

Aucune bascule automatique vers un champ suivant : elle changerait sans prévenir ce
que voient tous les consommateurs de tous les liens pointant vers cette table. Le
cadrage pose la règle générale sur les relations — mieux vaut un refus explicite
qu'un effet silencieux — et elle s'applique ici.

Les chapitres 04, 06 et 10 sont corrigés en conséquence.

### A16 — Lien dont la table cible est illisible

Forme unique de réponse, reprise mot pour mot par les chapitres 02, 04, 05, 08
et 09 :

```json
{ "client_id": { "id": null, "display": null, "masked": true } }
```

L'identifiant est masqué, et non renvoyé en clair : un UUIDv7 porte un horodatage,
qui révèle la date de création d'une ligne d'une table que le lecteur n'a pas le
droit de voir. Le filtre et le tri sur ce champ se réduisent à « renseigné » et
« non renseigné ».

L'espace d'identifiants opaques calculés par HMAC, introduit par le seul chapitre
05, est supprimé : il n'existe ni au catalogue, ni dans OpenAPI, ni dans le MCP.

### A17 — Contrainte de clé étrangère à la suppression logique d'un champ lien

La contrainte tombe immédiatement lors de la suppression logique du champ lien. La
colonne renommée survit jusqu'à la purge, mais sans contrainte.

Conserver la contrainte jusqu'à la purge laisserait un champ invisible partout
continuer à refuser des suppressions de lignes dans une autre table, sans que rien
dans l'interface n'explique le refus.

---

## Permissions, API et exploitation

### A18 — Colonnes système toujours lisibles

`_id`, `_created_at`, `_updated_at`, `_created_by` et `_updated_by` sont lisibles
dès que le droit de lecture est accordé sur la table, ne sont jamais inscriptibles,
et ne peuvent pas porter de permission de champ.

L'option `audit_visible` du chapitre 08 est supprimée. Elle rendrait la reprise
incrémentale d'un consommateur impossible pour tout rôle ayant un seul champ
masqué, ce qui coûte plus cher que l'oracle résiduel assumé par le chapitre 05.

### A19 — Webhooks : masque complet exigé

Le rôle porté par un webhook doit avoir un masque de lecture complet sur chaque
table abonnée. Si un seul champ lui est masqué, la création ou la modification de
l'abonnement est refusée, et un masquage survenu après coup désactive le webhook.

La charge utile n'est jamais amputée silencieusement : le cadrage exige une charge
utile complète précisément pour éviter un aller-retour au consommateur, et un
consommateur qui reçoit une ligne incomplète sans le savoir est pire qu'un
consommateur désactivé. Le chapitre 08 est réécrit en conséquence.

### A20 — Restriction de lignes : signature figée, implémentation reportée

Il n'existe pas de permission au niveau ligne en v1. Mais la signature du décideur
d'autorisation comporte dès maintenant un prédicat de lignes, dont la valeur est
constamment vrai, et le constructeur de requêtes l'émet.

Cela fige la surface nécessaire sans rien implémenter, et rend écrivable le test de
non-régression qui garantit qu'aucune requête ne se construit hors du point
d'application unique.

### A21 — Pas de point d'entrée d'export en v1

Aucune route d'export. Un flux illimité percerait le plafond que toutes les autres
règles construisent. Le chapitre 05 est corrigé : l'export n'est pas un chemin de
lecture ordinaire, il n'existe pas.

L'extraction de volume se fait par la pagination par curseur, qui est bornée,
paginée et soumise aux mêmes permissions.

### A22 — La purge conserve la ligne de catalogue

La purge exécute le `DROP` physique et renseigne `purged_at` ; la ligne de
catalogue survit comme pierre tombale. Les index uniques partiels, les références
du journal d'audit et la réconciliation en dépendent.

Une épuration de second niveau, distincte et postérieure à la durée de rétention,
détruit la ligne. Le chapitre 06 est corrigé.

### A23 — Registre unique des codes d'erreur

Un registre unique, publié en annexe de ce chapitre et porté par le paquet de types
partagé, fixe un code par condition. Un chapitre peut y ajouter un code, jamais en
renommer un.

Les familles dédoublées sont fusionnées. Les codes sont en anglais (A2). Le tableau
ci-dessous est le registre des renoncements : un code inscrit dans la colonne
« Codes supprimés » ne peut être réintroduit par aucun chapitre.

| Condition | Code retenu | Codes supprimés |
|---|---|---|
| Suppression d'une table encore référencée | `TABLE_REFERENCED` | `TABLE_REFERENCEE`, `LIEN_TABLE_REFERENCEE`, `SUPPRESSION_TABLE_REFUSEE_REFERENCE` |
| Valeurs orphelines à la pose d'une clé étrangère | `LINK_ORPHAN_VALUES` | `VALEURS_LIEES_INVALIDES`, `LIEN_VALEURS_ORPHELINES`, `LIEN_DONNEES_INCOMPATIBLES` |
| Écriture d'un lien vers une cible inexistante | `LINK_TARGET_NOT_FOUND` | `LIEN_CIBLE_INTROUVABLE`, `VALEUR_LIEN_INEXISTANTE`, `VALEUR_LIEN_INVALIDE`, `VALEUR_LIEE_INTROUVABLE` |
| Suppression d'une ligne encore référencée | `ROW_REFERENCED` | `SUPPRESSION_REFUSEE_REFERENCE`, `ENREGISTREMENT_REFERENCE`, `LIGNE_REFERENCEE` |
| Violation d'unicité | `DUPLICATE_VALUE` | `VALEURS_DUPLIQUEES`, `UNICITE_DOUBLONS`, `VALEUR_DUPLIQUEE`, `VALEUR_DEJA_UTILISEE` |
| Version de PostgreSQL insuffisante | `POSTGRES_VERSION_TOO_OLD` | `VERSION_POSTGRES_INSUFFISANTE` |
| Encodage de base non UTF-8 | `DB_ENCODING_NOT_UTF8` | `ENCODAGE_NON_SUPPORTE` |
| Colonne d'affichage en usage | `DISPLAY_FIELD_IN_USE` | — |
| Ressource inexistante ou invisible | `RESOURCE_NOT_FOUND` | `NOT_FOUND` |
| Authentification absente ou refusée | `AUTHENTICATION_REQUIRED` | `UNAUTHENTICATED` |
| Nuls présents au passage en obligatoire | `REQUIRED_NULL_VALUES` | `NULL_VALUES_PRESENT` |
| Incompatibilité `set_null` / obligatoire | `LINK_SET_NULL_ON_REQUIRED` | `LINK_SET_NULL_REQUIRED` |
| Action réservée à l'administration | `ADMIN_REQUIRED` | `ADMIN_RIGHT_REQUIRED` |

### A24 — Durées de rétention

Une seule valeur par objet, toutes configurables, toutes déclarées ici :

| Objet | Rétention par défaut |
|---|---|
| Historique des enregistrements | 24 mois |
| Historique des structures | 60 mois |
| Journal d'audit | 24 mois |
| Livraisons de webhooks | 90 jours |
| Événements sortants drainés | 7 jours |
| Pierres tombales de catalogue | 12 mois |
| Journal de sécurité | 180 jours |
| Échantillons d'erreur de migration | 30 jours |
| Appels aux fournisseurs d'IA | 24 mois |

### A25 — Clé de chiffrement d'instance

La clé d'instance, qui protège les curseurs opaques et les secrets de signature,
est lue dans la variable d'environnement `BASEDB_ENCRYPTION_KEY`. Elle porte un
numéro de version permettant la rotation, et la procédure de restauration après
sinistre la nomme explicitement comme élément à sauvegarder séparément de la base.

---

## Périmètre du document

Le plan initial ne couvrait pas quatre sujets nommés par le cadrage. Ils font
l'objet de chapitres propres :

- **11 — Interface** : grille de données, édition en ligne, vue détail, éditeur de
  schéma, et les trois comportements d'interface exigés pour les relations
  (cellule affichant la valeur d'affichage, ouverture du détail de la ligne cible,
  liste des lignes référençantes).
- **12 — Intégration des fournisseurs d'IA** : OpenAI, Anthropic et Mistral, modèle
  configurable au niveau instance et surchargeable par tenant, clés côté serveur.
- **13 — Authentification** : mot de passe et OAuth, sessions, élévation,
  amorçage.

La documentation lisible générée depuis le catalogue, distincte de la sérialisation
OpenAPI mais issue de la même projection, appartient au chapitre 08.

Le journal de suppression des enregistrements, sur lequel repose la reprise d'un
consommateur après panne, appartient au chapitre 07.

Les points d'entrée hors catalogue — routes d'authentification, point de
terminaison MCP, sondes de vivacité — sont listés par le chapitre 08.

---

## Annexe — Registre des codes d'erreur

Ce registre est porté par le paquet de types partagé et semé dans
`_basedb.error_code`. Il applique A23 : un code par condition, ajoutable par un
chapitre, jamais renommé ni resémantisé sans changement de version d'API. Tout code
employé dans le document y figure, et aucun autre. Les valeurs d'avertissement portées
par `meta.warning` — ainsi `REFERENCED_BY_TRUNCATED` — forment un espace de noms
distinct et n'entrent pas à ce registre. Le statut HTTP est celui qu'énonce
le chapitre normatif ; à défaut, celui que la taxonomie du chapitre 10 attache à la
classe du code. Un tiret signale une condition sans réponse HTTP — refus de démarrage,
alerte d'exploitation, ou surface MCP, dont les erreurs sont des résultats d'outil et
non des réponses HTTP. La colonne « Chapitre normatif » fait seule foi sur la paternité
d'un code : un chapitre ne revendique un code que si l'annexe le lui attribue.

### Amorçage et environnement

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `CATALOG_CHECKSUM_MISMATCH` | Somme de contrôle d'une migration de catalogue déjà appliquée divergente | — | 02 |
| `CATALOG_DRIFT` | `42P01` ou `42703` persistant après relecture du schéma et rejeu unique | 500 | 10 |
| `CATALOG_DRIFT_DETECTED` | SQLSTATE de structure inattendu, ou écart de réconciliation, constaté en service | 503 | 08 |
| `CATALOG_VERSION_AHEAD` | La base est en avance sur le code livré | — | 02 |
| `COLLATION_VERSION_MISMATCH` | Version de collation de la base d'accueil différente de celle enregistrée | — | 01 |
| `CONNECTION_CONTRACT_BROKEN` | `search_path` ou `TimeZone` non conformes au premier usage d'une connexion | 500 | 01 |
| `DB_ENCODING_NOT_UTF8` | Base d'accueil dont l'encodage n'est pas `UTF8` | — | 02 |
| `DB_NOT_OWNED` | Le rôle connecté n'est pas propriétaire de la base d'accueil | — | 02 |
| `DEADLINE_EXCEEDED` | `57014` : exécution interrompue par le budget de délai du noyau | 503 | 10 |
| `EXTENSION_PG_TRGM_MISSING` | Extension `pg_trgm` absente (A3) | — | 10 |
| `EXTENSION_UNACCENT_MISSING` | Extension `unaccent` absente (A3) | — | 10 |
| `ICU_COLLATION_MISSING` | Collations ICU indisponibles (A3) | — | 10 |
| `INTERNAL_ERROR` | `SQLSTATE` non cartographié, ou défaut interne ; `request_id` seul | 500 | 05 |
| `POSTGRES_VERSION_TOO_OLD` | Version de PostgreSQL inférieure à 16 (A1) | — | 02 |
| `PRIVILEGES_INSUFFICIENT` | Privilège `CREATE` ou propriété de schéma manquants ; `42501` en service | 500 | 01 |
| `SERIALIZATION_CONFLICT` | `40001` ou `40P01` après rejeu, côté noyau | 503 | 10 |
| `SERVICE_UNAVAILABLE` | `_basedb` injoignable, ressources épuisées (`53300`, `53200`) | 503 | 08 |
| `TIMEOUT_EXCEEDED` | `statement_timeout`, interblocage rejoué sans succès, ou budget de délai épuisé | 504 | 08 |

### Nommage

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `IDENTIFIER_INVALID` | Nom technique saisi hors de l'alphabet A ; ou nom hors alphabet B au constructeur SQL | 422 ; 500 si construit par le noyau | 01 |
| `LABEL_DUPLICATE` | Clé de comparaison de libellé déjà prise parmi les objets actifs du parent | 422 | 01 |
| `LABEL_EMPTY` | Libellé vide après suppression des espaces | 422 | 01 |
| `LABEL_TOO_LONG` | Libellé de plus de 255 caractères en NFC | 422 | 01 |
| `NAME_AMBIGUOUS` | Nom résolvant plusieurs objets visibles | — | 09 |
| `NAME_COLLISION_UNRESOLVED` | Suffixes `_2` à `_99` tous indisponibles | 409 | 01 |
| `NAME_RETIRED` | Renommage d'administration visant un nom déjà enregistré au registre, quel que soit son état | 409 | 06 |
| `NAME_TAKEN_OUTSIDE_REGISTRY` | Nom de schéma présent dans `pg_namespace` sans ligne de registre | 500 | 01 |
| `NAME_TOO_LONG` | Nom dérivé dépassant 63 octets après répartition des budgets (A6) | 500 | 01 |
| `PHYSICAL_NAME_TAKEN` | Nom physique déjà enregistré dans la portée demandée | 409 | 02 |
| `REGISTRY_DIVERGENT` | Écart bloquant entre le registre des noms et le catalogue système | 409 | 01 |
| `SLUG_FALLBACK_APPLIED` | Nom de repli attribué faute de caractère exploitable ; avertissement, pas un refus | — | 01 |
| `TENANT_ID_EXHAUSTED` | Dix tirages consécutifs d'identifiant de tenant en collision ou exclus | 500 | 01 |
| `TOO_MANY_ALIASES` | Plus de cinq alias vivants sur un même objet | 409 | 06 |

### Structure et migrations

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `ALIAS_DEPENDENT` | Vue d'alias empêchant une purge ou une conversion non reconstructible | 422 | 03 |
| `BASE_NOT_EMPTY` | Suppression logique d'une base dont une table est encore vivante | 409 | 02 |
| `BASE_READ_ONLY` | Opération de cycle de vie demandée sur une base non inscriptible | 503 | 06 |
| `BASE_STRUCTURE_FROZEN` | Opération de structure refusée sur une base gelée | 409 | 03 |
| `COLUMN_HAS_VIEW_DEPENDENCIES` | `DROP COLUMN` bloqué par des vues SQL d'alias, avec leur liste | 422 | 04 |
| `CONCURRENT_CONFLICT` | Entrelacement concurrent de deux opérations de structure sur le même objet | 409 | 06 |
| `CONVERSION_VALUES_INCOMPATIBLE` | Valeurs non convertibles au pré-contrôle d'une conversion, avec échantillon | 422 | 04 |
| `DEFAULT_NOT_ALLOWED` | Expression de défaut hors du vocabulaire autorisé | 422 | 03 |
| `DEFAULT_VOLATILE_FORBIDDEN` | Expression de défaut volatile | 422 | 03 |
| `DEPENDENT_OBJECT` | Objet inconnu du catalogue dépendant d'une vue, d'une table ou d'un schéma à supprimer | 409 | 06 |
| `ENVIRONMENT_IS_PRODUCTION` | Suppression de l'environnement de production seul : c'est la base entière qui se supprime | 409 | 14 |
| `ENVIRONMENT_MISMATCH` | Comparaison, report de structure ou synchronisation entre deux bases qui ne sont pas deux environnements distincts d'une même base | 422 | 14 |
| `EXPORT_STALE` | Écriture détectée sur l'objet depuis l'export préalable | 409 | 06 |
| `EXPORT_UNAVAILABLE` | Répertoire d'export absent, non inscriptible, ou export en échec | 503 | 06 |
| `FIELD_CONFIG_MISSING` | Champ dont le type exige un satellite de configuration absent | 500 | 02 |
| `FIELD_USED_BY_FORMULA` | Suppression ou conversion d'un champ dont une formule vivante dépend | 409 | 06 |
| `ID_IMMUTABLE` | Écriture ou opération de structure visant `_id` ou une autre colonne système (A18) | 422 | 03 |
| `INCOMPATIBLE_VALUES` | Revalidation en échec à la restauration ; `details.constraint` vaut `required` ou `unique` | 422 | 06 |
| `INDEX_LENGTH_EXCEEDED` | Tri ou unicité demandés sur un texte de plus de 500 caractères | 422 | 04 |
| `LENGTH_VALUES_EXCEEDED` | Réduction de `max_length` en deçà de valeurs existantes, avec échantillon | 422 | 04 |
| `LOCK_UNAVAILABLE` | `lock_timeout` atteint sur un verrou consultatif ou sur un verrou de table | 503 | 01 |
| `MIGRATION_EXPIRED` | Proposition de migration de plus de 24 h | 422 | 03 |
| `MIGRATION_IN_PROGRESS` | Bail de structure non obtenu, ou clé d'idempotence rejouée | 409 | 03 |
| `MIGRATION_STALE` | Structure ou planificateur modifiés entre proposition et approbation | 422 | 03 |
| `MIGRATION_TAMPERED` | `checksum` de migration divergent | 500 | 03 |
| `MIGRATION_TOO_LARGE` | Bornes de plan dépassées | 409 | 03 |
| `OPTION_IN_USE` | Suppression d'une option de liste portée par des lignes, avec le décompte | 422 | 04 |
| `PARENT_DELETED` | Restauration d'un objet dont le parent est supprimé | 409 | 06 |
| `PLAN_CYCLIC` | Cycle résiduel en phase 1 du tri du plan | 500 | 03 |
| `PLAN_LOCK_CONFLICT` | Violation de l'invariant I-DDL-5 détectée à la planification | 500 | 03 |
| `PROJECT_NOT_EMPTY` | Suppression d'un projet qui porte encore une base vivante | 409 | 02 |
| `PURGE_TOO_EARLY` | Purge demandée avant le délai minimal | 409 | 06 |
| `REQUIRED_NULL_VALUES` | Passage à obligatoire d'une colonne contenant des nuls, avec échantillon (A23) | 422 | 04 |
| `RESIDUAL_SCHEMA` | `DROP SCHEMA` final d'une base purgée en échec ; état affiché, jamais renvoyé à une écriture | — | 06 |
| `STEP_DEFERRED` | Étape concurrente reportée, transaction longue en cours | — | 03 |
| `SYNC_REFERENCE_MISSING` | Synchronisation de lignes dont une relation désigne une ligne absente de l'environnement cible | 409 | 14 |
| `SYNC_TABLE_MISSING` | Synchronisation d'une table absente, supprimée ou sans colonne commune dans l'un des deux environnements | 422 | 14 |
| `SYNC_VALUES_REFUSED` | Valeur recopiée refusée par une contrainte de l'environnement cible : la structure est à reporter d'abord | 422 | 14 |
| `TABLE_ATTRIBUTES_EXHAUSTED` | Plus de 1 500 numéros d'attribut consommés sur la table | 422 | 04 |
| `TABLE_MIGRATING` | Étape de migration exclusive en cours sur la table | 503 | 08 |
| `TASK_IN_PROGRESS` | Seconde tâche différée demandée sur le même objet | 409 | 06 |
| `TIMEZONE_UNKNOWN` | Fuseau absent de `pg_timezone_names` | 422 | 03 |
| `TOO_MANY_TABLES` | Borne de tables par base atteinte | 422 | 03 |

### Relations

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `BATCH_CASCADE_FORBIDDEN` | `delete` déclenchant une cascade à l'intérieur d'un lot | 422 | 08 |
| `CASCADE_CONFIRMATION_REQUIRED` | En-tête de confirmation de cascade absent ou divergent du décompte annoncé | 409 | 08 |
| `CASCADE_CYCLE` | Chaîne de cascades bouclante | 422 | 05 |
| `CASCADE_NOT_IN_MIGRATION` | `ON DELETE CASCADE` présent dans une migration proposée | 422 | 05 |
| `CASCADE_TOO_DEEP` | Cycle détecté, ou profondeur supérieure à 5 au décompte | 409 | 08 |
| `CASCADE_TOO_LARGE` | Décompte de cascade supérieur à 5 000 lignes | 409 | 08 |
| `DISPLAY_FIELD_IN_USE` | Suppression logique du champ désigné comme colonne d'affichage (A15) | 409 | 02 |
| `LINK_CASCADE_NOT_GRANTED` | `cascade` demandé sans droit de gestion du schéma ou sans confirmation saisie (A14) | 422 | 04 |
| `LINK_CROSS_DATABASE` | Champ lien dont la table cible appartient à une autre base | 422 | 01 |
| `LINK_ORPHAN_VALUES` | Valeurs orphelines à la pose d'une clé étrangère (A23) | 409 | 03 |
| `LINK_SELF_REQUIRED` | Champ lien réflexif marqué obligatoire | 422 | 04 |
| `LINK_SET_NULL_ON_REQUIRED` | `set_null` sur un lien obligatoire, ou passage à obligatoire d'un lien en `set_null` (A23) | 422 | 03 |
| `LINK_TARGET_NOT_FOUND` | Écriture d'un lien vers une cible inexistante **ou** invisible (A23) | 409 | 08 |
| `LINK_TARGET_UNSUPPORTED` | Cible d'une clé étrangère autre que `_id` | 422 | 03 |
| `LINK_TYPE_INCOMPATIBLE` | Type de la colonne de lien incompatible avec la clé cible | 422 | 10 |
| `MCP_CASCADE_FORBIDDEN` | `on_delete: "cascade"` demandé par un agent | — | 09 |
| `ROW_REFERENCED` | Suppression d'une ligne encore référencée, refusée par la clause `NO ACTION` (A13, A23) | 409 | 08 |
| `TABLE_REFERENCED` | Suppression d'une table encore référencée par un lien actif (A23) | 409 | 02 |
| `TARGET_PURGED` | Restauration d'un champ lien dont la table cible est purgée | 409 | 06 |

### Permissions et non-divulgation

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `ACTION_FORBIDDEN` | Ressource visible, action non accordée | 403 | 05 |
| `ADMIN_REQUIRED` | Action réservée à l'administration, l'acteur voyant la ressource ; cycle de vie compris (A23) | 403 | 06 |
| `AUTHORIZATION_REVOKED` | Revérification des droits ou du jeton en échec à l'approbation | 403 | 09 |
| `CONFIRMATION_REQUIRED` | Opération réservée présentée sans jeton de confirmation | 409 | 05 |
| `CONFLICT` | Violation d'unicité ou de `CHECK` touchant un champ masqué ; réponse anonyme | 409 | 05 |
| `CREATE_IMPOSSIBLE` | Champ obligatoire non inscriptible par l'acteur | 403 | 05 |
| `EMAIL_TAKEN` | Adresse déjà portée par un compte du tenant | 409 | 05 |
| `EXPAND_UNAVAILABLE` | Expansion d'un champ non expansible ou dont la cible est invisible | 422 | 05 |
| `FIELD_NOT_WRITABLE` | Champ visible mais non inscriptible, colonnes système comprises (A18) | 403 | 05 |
| `FIELD_UNKNOWN` | Champ inexistant, masqué, ou filtre et tri sur un champ masqué | 422 | 05 |
| `FILTER_NOT_SUPPORTED` | Opérateur autre que « renseigné » / « non renseigné », ou tri, sur un lien à cible illisible (A16) | 422 | 05 |
| `GROUP_SYSTEM_IMMUTABLE` | Renommage ou suppression d'un groupe système, retrait d'un membre du groupe de tous les utilisateurs, ou niveau d'accès posé sur le groupe des administrateurs | 409 | 05 |
| `LAST_INSTANCE_ADMIN` | Retrait, désactivation ou suppression du dernier administrateur d'instance | 409 | 02 |
| `LAST_TENANT_ADMIN` | Retrait du dernier membre d'un rôle `tenant_admin` | 409 | 05 |
| `MASK_REDUCED_MID_READ` | Droits réduits pendant une lecture longue | 409 | 05 |
| `PERMISSION_DENIED` | Objet lisible, action non autorisée, sur la surface MCP | — | 09 |
| `PERMISSION_INCONSISTENT` | Écriture accordée sans lecture | 422 | 05 |
| `PERMISSION_OUT_OF_SCOPE` | Règle de champ hors de la portée du rôle | 422 | 05 |
| `PRIVILEGE_ESCALATION` | Accorder plus que ce qu'on détient ; rôle hors des capacités du créateur ; ajout à un rôle système | 403 | 05 |
| `RESOURCE_NOT_FOUND` | Ressource inexistante **ou** invisible, sur toute surface, objet de catalogue compris (A23) | 404 | 05 |
| `ROLE_NOT_DELEGABLE` | Rôle demandé non inclus dans les droits de l'appelant | 403 | 08 |
| `TENANT_ISOLATION_VIOLATED` | Requête visant le schéma d'un autre tenant ; incident, réponse générique | 500 | 05 |
| `VALUE_REJECTED` | Valeur refusée par une contrainte dont tous les champs sont lisibles | 422 | 05 |
| `WEBHOOK_MASK_INCOMPLETE` | Rôle d'un webhook sans masque de lecture complet sur une table abonnée (A19) | 422 | 05 |

### Données et validation

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `ARCHIVE_MISSING` | Suppression d'une partition non archivée, archivage actif | — | 07 |
| `BULK_OPERATION_REFUSED` | Plafond de lignes capturées dans une transaction dépassé | 422 | 07 |
| `CAPTURE_NOT_CONFORMING` | Arguments de déclencheur, attributs de la fonction de capture ou déclencheur d'immuabilité non conformes | 500 | 07 |
| `CAPTURE_TRIGGER_MISSING` | Table utilisateur sans ses cinq déclencheurs actifs en `tgenabled = 'O'` | 500 | 07 |
| `COMPUTED_FIELD_READ_ONLY` | Écriture sur un champ formule, sur n'importe quel chemin | 422 | 04 |
| `DRAIN_LAGGING` | Retard du drain au-delà de `history.drain_lag_max` (A10) | — | 07 |
| `DUPLICATE_VALUE` | Violation d'unicité, `23505` ; nomme le champ, jamais la valeur en conflit (A23) | 409 | 08 |
| `ERASURE_INCOMPLETE` | Effacement ciblé n'ayant pas pu atteindre les archives | 500 | 07 |
| `FILTER_NOT_INDEXABLE_VOLUME` | Filtre `contains` non indexé demandé au-delà du seuil de cardinalité | 422 | 04 |
| `FORMULA_DEPENDS_ON_FORMULA` | Formule référençant une autre formule | 422 | 04 |
| `FORMULA_FIELD_NOT_FOUND` | Citation d'un libellé de champ inconnu dans la table | 422 | 04 |
| `FORMULA_FUNCTION_NOT_IMMUTABLE` | Fonction ou conversion dépendant de la session | 422 | 04 |
| `FORMULA_LINK_FORBIDDEN` | Formule référençant un champ lien | 422 | 04 |
| `FORMULA_NOT_IMMUTABLE` | Refus serveur `42P17` ; filet de sécurité signalant un défaut du moteur | 422 | 04 |
| `FORMULA_SYNTAX` | Expression non conforme à la grammaire, avec position | 422 | 04 |
| `FORMULA_TYPE_MISMATCH` | Opérandes de types inconciliables, avec position | 422 | 04 |
| `HISTORY_IMMUTABLE` | `UPDATE` ou `DELETE` sur un journal hors maintenance | 500 | 07 |
| `HISTORY_ORPHAN_ROWS` | Lignes de détail sans en-tête sur la même partition | 500 | 07 |
| `HISTORY_PARTITION_MISSING` | Partition du mois courant, de M+1 ou de M+2 absente, ou partition `DEFAULT` non vide | 500 | 07 |
| `HISTORY_UNAVAILABLE` | La capture a échoué, donc l'écriture de données aussi | 503 | 07 |
| `NUMBER_OUT_OF_RANGE` | Dépassement de `precision` / `scale` (`22003`) à l'entrée | 422 | 04 |
| `PARTITION_DETACH_STUCK` | Partition restée en détachement au-delà d'un passage de la tâche | — | 07 |
| `REQUIRED_FIELD_MISSING` | Champ obligatoire absent du corps soumis | 422 | 08 |
| `REQUIRED_VALUE_MISSING` | `NOT NULL` violé en base (`23502`) | 422 | 10 |
| `RESTORE_FIELD_CHANGED` | Champ visé par une annulation en masse supprimé, purgé ou remplacé depuis | 422 | 07 |
| `RESTORE_OUT_OF_RETENTION` | Révisions nécessaires à la restauration déjà purgées | 422 | 07 |
| `RESTORE_RECORD_PRESENT` | Restauration d'une ligne supprimée qui existe de nouveau | 409 | 07 |
| `RESTORE_TARGET_MISSING` | Restauration référençant une ligne absente et hors périmètre | 422 | 07 |
| `RETENTION_INCONSISTENT` | Rétention des structures inférieure à celle des données (A24) | — | 07 |
| `REVISION_SUPERSEDED` | Annulation d'une modification dont un champ a changé depuis | 409 | 07 |
| `SORT_NOT_INDEXABLE_VOLUME` | Tri non indexable demandé au-delà du seuil de cardinalité | 422 | 04 |
| `TEXT_TOO_LONG` | Valeur dépassant `max_length` | 422 | 04 |
| `TRUNCATE_FORBIDDEN` | `TRUNCATE` sur une table utilisateur | 422 | 07 |
| `VALIDATION_FAILED` | Validation métier, avec `details.violations[]` ; forme anonyme sans droit de lecture | 422 | 08 |
| `VALUE_INVALID` | Type JSON ou format incompatible avec le type de champ ; caractère nul ; `22P02` | 422 | 04 |
| `VALUE_NOT_FINITE` | `NaN`, `Infinity` ou `-Infinity` soumis à un champ `number`, `date` ou `datetime` | 422 | 04 |
| `VALUE_OUT_OF_CONSTRAINT` | `CHECK` violé en base (`23514`), règle résolue par le catalogue | 422 | 10 |
| `VALUE_OUT_OF_RANGE` | Dépassement numérique en base (`22003`) | 422 | 10 |
| `VALUE_TOO_LONG` | Dépassement de longueur en base (`22001`) | 422 | 10 |

### API et intégrations

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `AI_CONSENT_REQUIRED` | Consentement au fournisseur absent ou périmé | 409 | 12 |
| `AI_DISABLED` | `ai.enabled` faux à la portée résolue | 409 | 12 |
| `AI_KEY_REJECTED` | Clé refusée par le fournisseur, à la pose ou en exploitation | 422 | 12 |
| `AI_MODEL_UNKNOWN` | Modèle absent de la table de correspondance du fournisseur résolu | 422 | 12 |
| `AI_NOT_CONFIGURED` | IA activée sans fournisseur, modèle ou clé résolus | 409 | 12 |
| `AI_PAYLOAD_TOO_LARGE` | Charge utile au-delà des plafonds déclarés | 422 | 12 |
| `AI_PROVIDER_UNAVAILABLE` | Délai dépassé, `5xx`, `429` amont, erreur réseau, circuit ouvert | 503 | 12 |
| `AI_QUOTA_EXCEEDED` | Plafond mensuel ou de simultanéité atteint | 429 | 12 |
| `AI_RESPONSE_UNUSABLE` | Réponse non conforme au schéma ou tronquée, après un réessai ; ou, pour un champ calculé par l'IA, sans valeur lisible dans le type du champ | 502 | 12 |
| `BATCH_TOO_LARGE` | Lot au-delà des bornes d'entrée | 413 | 08 |
| `BODY_TOO_LARGE` | Corps au-delà des bornes d'entrée | 413 | 08 |
| `CONCURRENCY_CONFLICT` | Sérialisation ou interblocage sur la surface MCP ; rejouable | — | 09 |
| `CONCURRENCY_LIMIT_EXCEEDED` | Plafond de requêtes simultanées | 429 | 08 |
| `CONTENT_TYPE_INVALID` | Corps non `application/json` | 415 | 08 |
| `CURSOR_INVALID` | Déchiffrement, acteur ou requête divergente ; curseur altéré ou lié à un autre jeton | 400 | 08 |
| `CURSOR_STALE` | Structure de tri ou de filtre modifiée, ou curseur périmé par une migration | 409 | 08 |
| `EXPAND_TOO_DEEP` | Profondeur d'expansion dépassée | 400 | 08 |
| `EXPAND_TOO_WIDE` | Largeur d'expansion dépassée | 400 | 08 |
| `FIELD_NOT_EXPANDABLE` | Champ lien dont la cible ou le champ d'affichage n'est pas lisible | — | 09 |
| `FILTER_DISPLAY_UNAVAILABLE` | Filtre portant sur une valeur d'affichage indisponible | 400 | 08 |
| `FILTER_FIELD_UNKNOWN` | Champ de filtre inexistant **ou** non lisible ; les deux causes ne sont jamais scindées | 400 | 08 |
| `FILTER_OPERATOR_INVALID` | Opérateur hors du vocabulaire fermé | 400 | 08 |
| `FILTER_TOO_COMPLEX` | Budget de complexité du filtre dépassé | 400 | 08 |
| `FILTER_TOO_LONG` | Longueur du filtre dépassée | 400 | 08 |
| `FILTER_VALUE_INVALID` | Valeur de filtre non coercible | 400 | 08 |
| `FORM_CLOSED` | Réponse à un formulaire partagé désactivé, fermé, complet, ou dont la personne qui l'a publié ne peut plus ajouter de lignes | 409 | 15 |
| `FORM_RESTRICTED` | Formulaire partagé réservé à des groupes dont la personne connectée n'est pas membre | 403 | 15 |
| `IDEMPOTENCY_CONFLICT` | Même clé d'idempotence, corps différent | 409 | 08 |
| `IDEMPOTENCY_IN_PROGRESS` | Même clé, revendication sous bail valide | 409 | 08 |
| `IDEMPOTENCY_INTERRUPTED` | Bail expiré, écriture métier partiellement constatée | 409 | 08 |
| `IDEMPOTENCY_STALE` | `authz_version` modifiée depuis la réponse mémorisée | 409 | 08 |
| `MCP_OPERATION_EXCLUDED` | Nom réservé d'une opération exclue en v1 | — | 09 |
| `PARAMETER_INVALID` | Étage protocolaire : type, cardinalité, taille ; ne cite aucun objet | — | 09 |
| `PRECHECK_TIMEOUT` | Pré-vérification au-delà de 30 secondes | — | 09 |
| `PROPOSAL_EXPIRED` | Proposition passée à `expired` au-delà de 24 heures | 409 | 09 |
| `PROPOSAL_STALE` | `catalog_version` modifié depuis la proposition | 409 | 09 |
| `QUERY_TOO_EXPENSIVE` | Budget de complexité ou plan estimé au-delà du seuil | 400 | 08 |
| `QUOTA_EXCEEDED` | Plafond d'appels ou de requêtes simultanées sur la surface MCP ; rejouable | — | 09 |
| `RATE_LIMIT_EXCEEDED` | Seau à jetons épuisé (A4) | 429 | 08 |
| `REQUEST_INVALID` | Corps, paramètre ou bornes d'entrée mal formés | 400 | 08 |
| `RESUME_BEYOND_HORIZON` | `since` antérieur à la rétention de l'historique (A24) | 409 | 08 |
| `SESSION_NOT_INITIALIZED` | Message reçu avant `initialize` | — | 09 |
| `SORT_FIELD_UNKNOWN` | Champ de tri inexistant **ou** non lisible ; les deux causes ne sont jamais scindées | 400 | 08 |
| `SORT_UNAVAILABLE` | Tri impossible sur le champ demandé | 400 | 08 |
| `TOO_MANY_OPEN_PROPOSALS` | Plus de cinq propositions `proposed` pour ce jeton et cette base | — | 09 |
| `VERSION_CONFLICT` | `If-Match` divergent | 412 | 08 |
| `WEBHOOK_TARGET_REJECTED` | URL de livraison refusée par le filtre d'adresses ; état de livraison | — | 08 |
| `WRITE_CONFLICT` | Sérialisation ou interblocage après réessai unique | 409 | 08 |

### Authentification

| Code | Condition | Statut HTTP | Chapitre normatif |
|---|---|---|---|
| `AUTHENTICATION_REQUIRED` | Authentification absente ou refusée : aucun contexte d'acteur, ou porteur refusé par la route, sur toute surface (A23) | 401 | 05 |
| `BOOTSTRAP_SECRET_INVALID` | Secret d'amorçage faux ou expiré | 401 | 13 |
| `CREDENTIALS_INVALID` | Tout échec d'authentification par mot de passe ; message unique | 401 | 13 |
| `ELEVATION_REQUIRED` | Opération exigeant une ré-authentification récente | 403 | 05 |
| `OIDC_ACCOUNT_LINK_REQUIRED` | Adresse déjà portée par un compte sans identité pour ce fournisseur | 409 | 13 |
| `OIDC_PROVIDER_UNKNOWN` | `slug` de fournisseur non déclaré, ou non accepté par le tenant | 404 | 13 |
| `OIDC_STATE_INVALID` | `state`, `nonce` ou cookie d'échange absent, expiré ou discordant | 400 | 13 |
| `OIDC_TOKEN_INVALID` | Jeton d'identité en échec sur l'un des contrôles de validation | 401 | 13 |
| `ORIGIN_REJECTED` | Requête mutante sans origine déclarée exploitable | 403 | 05 |
| `PASSWORD_POLICY_VIOLATION` | Mot de passe refusé par la politique | 422 | 13 |
| `PROVISIONING_REFUSED` | Aucun compte correspondant, provisionnement inactif | 403 | 13 |
| `RESET_TOKEN_INVALID` | Défi de réinitialisation inconnu, expiré ou consommé | 400 | 13 |
| `SESSION_EXPIRED` | Session révoquée, inactive depuis 12 h, ou parvenue à son terme absolu | 401 | 05 |
| `TOKEN_EXPIRED` | Jeton connu, date d'expiration dépassée | 401 | 08 |
| `TOKEN_EXPIRY_REQUIRED` | Durée de vie d'un jeton donnée hors de 1 à 365 jours (l'absence de durée vaut « sans échéance ») | 422 | 05 |
| `TOKEN_INVALID` | Jeton inconnu, ou présenté hors de `allowed_surfaces` | 401 | 05 |
| `TOKEN_PRIVILEGE_REFUSED` | Rôle de jeton portant `manage_schema`, `manage_permissions` ou `manage_tokens` | 422 | 05 |
| `TOKEN_READ_ONLY` | Écriture avec un jeton dont le rôle ne porte que `read` | — | 09 |
| `TOKEN_REVOKED` | Jeton connu, révoqué ; la session MCP est close | 401 | 08 |
| `TOKEN_SUSPENDED` | Budget d'écriture ou seuil d'énumération dépassé | — | 09 |
