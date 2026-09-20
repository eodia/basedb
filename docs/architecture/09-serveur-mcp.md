# 09 — Serveur MCP

Le serveur MCP est le troisième point d'entrée sur le noyau, aux côtés de l'API REST et de l'interface. Il expose à un agent conversationnel la découverte du schéma, la lecture et l'écriture d'enregistrements, et la **proposition** d'opérations de structure — jamais leur application.

Ce chapitre décrit la surface exposée, les règles de projection qui s'y appliquent, le cycle d'approbation humaine, le modèle d'authentification et le périmètre d'autorité réellement garanti. Il ne redéfinit ni le catalogue (02), ni les permissions (05), ni le moteur DDL (03) : il s'y adosse par renvoi. Les exemples utilisent le tenant `t4z56fq` et la base `crm` (schéma `b_t4z56fq_crm`), conformément au chapitre 01.

---

## 1. Position dans l'architecture

### 1.1 Un point d'entrée sur le noyau, pas un client de l'API REST

> Le serveur MCP est un **point d'entrée sur le noyau, au même rang que l'API REST**. Il consomme les mêmes services applicatifs — catalogue projeté, point d'application des permissions, service d'enregistrements, moteur DDL en mode plan, service de propositions, service d'audit — et **n'ouvre jamais de connexion PostgreSQL** : ni pool, ni chaîne de connexion, ni pilote, ni dépendance vers le paquet d'accès aux données.

Deux propriétés distinctes, tenues ensemble et souvent confondues :

1. **Pas de chemin d'accès propre aux données.** Aucun module du paquet MCP ne reçoit de poignée de connexion. Vérifié par un test d'architecture sur le graphe de dépendances du monorepo (chapitre 10).
2. **Pas de subordination à une autre surface.** Le MCP appelle le noyau, pas l'API REST.

*Alternative rejetée* : faire du serveur MCP un adaptateur de protocole au-dessus de l'API REST publique. Elle semble garantir gratuitement la propriété 1, mais elle obligerait à publier en routes HTTP publiques le mode plan du moteur DDL, la file de propositions et l'identité effective — une surface REST que le catalogue ne dérive pas, alors qu'OpenAPI est générée depuis le catalogue —, rendrait le MCP incapable de ce que le noyau sait faire mais que REST n'expose pas, et ferait dépendre la journalisation par appel d'outil d'un en-tête porté par le client, donc falsifiable. La propriété réellement voulue se démontre aussi bien avec un appel en processus, et se teste mieux.

Ce que le serveur MCP n'est pas : un exécuteur de SQL, un moteur de migration, un ordonnanceur, un cache. Il ne calcule pas de DDL ; il demande au moteur un plan et le restitue.

### 1.2 Déploiement et transport

Le point d'entrée MCP est un module du processus back, voisin du routeur REST. Sur le poste de l'utilisateur, le client MCP lance un **relais stdio** : un binaire mince, sans état, sans configuration autre que l'origine du back et une référence au secret, qui transporte les messages MCP JSON-RPC vers un point de terminaison unique du back, en HTTPS.

Ce point de terminaison (`POST /mcp`) parle MCP JSON-RPC et rien d'autre. Il ne fait pas partie de la spécification OpenAPI générée depuis le catalogue : il figure parmi les points d'entrée hors catalogue listés par le chapitre 08, au même titre que les routes d'authentification et les sondes de vivacité. Le choix du transport est une question de déploiement, pas d'architecture : exécuter ce module directement dans le processus back, pour un client hébergé, ne changerait aucune règle de ce chapitre.

### 1.3 Services du noyau consommés

| Outil | Services du noyau consommés |
|---|---|
| `whoami` | Identité et permissions effectives |
| `list_bases`, `describe_base`, `describe_table` | Catalogue projeté |
| `list_records`, `get_record` | Lecture d'enregistrements (projection, filtres, pagination) |
| `lookup_records` | Lecture d'enregistrements (résolution de valeur d'affichage) |
| `create_record`, `update_record` | Écriture d'enregistrements, service d'idempotence |
| `propose_create_base`, `propose_create_table`, `propose_add_field` | Moteur DDL en mode plan, service de propositions |
| `get_proposal` | Service de propositions |
| *tous* | Point d'application des permissions, service de quotas, service d'audit |

Le test de conformité porte sur les **symboles importés** par le paquet MCP : tous de l'interface publique du noyau, l'ensemble importé étant un sous-ensemble de la liste ci-dessus. Aucun import direct du paquet d'accès aux données, du pilote PostgreSQL ou de l'ORM.

### 1.4 Objets de catalogue et contrats empruntés

Ce chapitre n'introduit aucun objet de catalogue. Il s'appuie sur ceux-ci, définis ailleurs, et les nomme partout tels quels :

| Objet ou contrat | Défini par |
|---|---|
| `_basedb.api_token` — `allowed_surfaces` (`rest`, `mcp`), `base_id`, `expires_at`, `revoked_at`, et les trois colonnes de suspension `suspended_at`, `suspended_reason`, `suspended_by` | 02 |
| `_basedb.base.mcp_enabled`, `_basedb.base.catalog_version`, `_basedb.base.structure_state` | 02 |
| `_basedb.field.expose_to_agents` | 02 |
| `_basedb.tenant.authz_version`, incrémentée à toute écriture d'autorisation | 02 |
| `_basedb.idempotency_key` — unicité `(actor_kind, actor_id, key)`, plus `tool`, `params_hash`, `authz_version`, `lease_expires_at`, `response`, `expires_at` | 02 |
| `_basedb.migration` — `origin = 'mcp'`, états `proposed`…`expired` (A12), `up_sql`/`down_sql` en `jsonb`, `catalog_diff`, `affected_objects`, `error_sample` | 02 |
| `_basedb.field_link_config` — `target_table_id`, `on_delete`, `fk_constraint_id`, `fk_index_id` | 02 |
| `_basedb.table_def.display_field_id` et ses trois miroirs | 02 |
| `_basedb.audit_log`, `_basedb.record_revision` | 02 (schéma), 07 (sémantique) |
| Moteur DDL en mode plan, sans écriture dans les schémas `b_*` ; pré-contrôle borné | 03 |
| Intersection jeton ∩ utilisateur ; `field_permission.access` ; `manage_schema` **et** `read` exigés sur la cible d'un champ lien, quelle que soit la surface | 05 |
| Lecture d'`audit_log` et de l'historique brut : **opération réservée**, `is_instance_admin` ou `tenant_admin`, filtrée par tenant, la consultation étant elle-même journalisée — donc jamais attribuable à un jeton d'intégration. La forme du droit est fixée, ce chapitre ne la rediscute pas | 05 §8 |
| Liste de référence des opérateurs de filtre | 04 §9 |
| Représentation commune à toutes les surfaces (dates ISO 8601 UTC, `numeric` en chaîne), bornes d'expansion, format et invalidation du curseur de pagination, idempotence des opérations de données, origine canonique des URL absolues | 08 |
| Traduction des `SQLSTATE` PostgreSQL, en un seul endroit | 10 §8.2 |

---

## 2. Périmètre v1 : le catalogue d'outils

### 2.1 Trois règles de granularité

1. **Un outil par intention métier, jamais un outil générique.** Aucun `execute_sql`, même en lecture seule : le SQL arbitraire contourne le filtrage champ par champ, rend la journalisation ininterprétable — on ne sait plus ce qui a été lu — et interdit toute borne de volume. *Alternative rejetée* : un `execute_sql` restreint par un rôle PostgreSQL en lecture ; le cadrage impose une connexion unique sans rôle par utilisateur, il n'existe donc aucun garde-fou au niveau base.
2. **Un catalogue d'outils statique, jamais dérivé des données utilisateur.** Aucun libellé de base, de table ou de champ n'entre dans un nom ou une description d'outil. Le schéma se découvre par `describe_base` et `describe_table`, dont le résultat est explicitement étiqueté comme de la donnée. *Alternative rejetée* : un outil par table ; la liste changerait à chaque migration, et du texte rédigé par un utilisateur entrerait dans la description d'outil, zone de plus haute confiance du contexte d'un agent.
3. **Le nom de l'outil dit ce qu'il fait réellement.** Un outil qui ne modifie pas la structure s'appelle `propose_*`. Un agent qui lit la seule liste d'outils doit comprendre les limites de son autorité sans lire les descriptions.

Noms d'outils en anglais `snake_case` (convention MCP, meilleure reconnaissance par les modèles). **Descriptions rédigées en français, langue unique en v1** : l'internationalisation des descriptions d'outils n'est pas au périmètre, et deux versions linguistiques d'une même description finissent par diverger.

### 2.2 Tableau normatif des treize outils

Ce tableau est **normatif**. Le test de conformité de la section 10 échoue si l'ensemble des outils déclarés à l'exécution diffère de cette liste. « Champ inscriptible » signifie `field_permission.access = 'write'` pour le rôle effectif (chapitre 05).

| Outil | Ce qu'il fait | Permission exigée | Écrit | Lot |
|---|---|---|---|---|
| `whoami` | Identité effective, portée du jeton, budgets restants | aucune | non | 1 |
| `list_bases` | Bases de la portée comportant au moins une table lisible | `read` sur ≥ 1 table | non | 1 |
| `describe_base` | Tables lisibles, applications, graphe des relations | `read` sur ≥ 1 table | non | 1 |
| `describe_table` | Champs, types, liens, liens inverses, colonne d'affichage | `read` sur la table | non | 1 |
| `list_records` | Lignes filtrées, triées, paginées, expansion bornée | `read` sur la table | non | 1 |
| `get_record` | Une ligne par `_id`, valeurs complètes sur demande | `read` sur la table | non | 1 |
| `lookup_records` | Résout une valeur d'affichage en candidats `_id` | `read` sur la table cible **et** sur son champ d'affichage | non | 2 |
| `create_record` | Crée une ligne | `create` sur la table ; chaque champ écrit inscriptible | oui | 2 |
| `update_record` | Modifie les champs nommés d'une ligne | `update` sur la table ; chaque champ écrit inscriptible | oui | 2 |
| `propose_create_base` | Propose la création d'une base | `manage_schema` au niveau tenant | non | 3 |
| `propose_create_table` | Propose une table et ses champs initiaux | `manage_schema` sur la base | non | 3 |
| `propose_add_field` | Propose un champ, y compris de type lien | `manage_schema` sur la table ; pour un lien, `manage_schema` **et** `read` sur la cible | non | 3 |
| `get_proposal` | Relit une proposition et son état | portée ∧ (auteur ∨ `manage_schema` sur la base) | non | 3 |

**Sous-totaux : lot 1 = 6, lot 2 = 3, lot 3 = 4. Treize outils en v1.**

`lookup_records` est classé au lot 2 bien qu'il soit en lecture : sa seule raison d'être est de résoudre la cible d'un lien avant une écriture. Le livrer avec le lot de lecture exposerait une primitive de recherche sans le besoin qui la justifie.

### 2.3 Ce qui n'existe pas en v1

| Absent | Motif |
|---|---|
| Suppression d'un enregistrement | Voir §8.1 : geste rare, réversible seulement par l'historique, et dont l'automatisation n'apporte rien face au coût d'un second mécanisme d'approbation |
| Suppression logique ou purge d'une base, d'une table, d'un champ | Effet large, irréversible pour l'agent, geste réfléchi fait dans l'éditeur de schéma |
| Modification d'un champ existant (`propose_update_field`) | Hors du périmètre MCP fixé par le cadrage |
| Changement de type d'un champ | Le type est immuable ; c'est une migration en plusieurs étapes avec recopie, dont l'échec partiel se règle à la main |
| Historique d'un enregistrement (`get_record_history`) | Hors périmètre, et surface au rapport fuite/valeur le plus défavorable : voir §2.3.1 |
| File des propositions (`list_proposals`) | Confort d'exploitation ; l'agent reçoit `proposal_id` à la proposition et relit par `get_proposal` |
| Écriture ou suppression en masse | Aucun outil d'écriture n'accepte de liste d'identifiants ni de filtre |
| Permissions, rôles, utilisateurs, jetons | Une automatisation capable de s'accorder des droits n'est plus contenue par ses droits |
| Webhooks, alias, réglages d'instance, clés de fournisseurs d'IA | Hors périmètre fonctionnel, et surfaces d'exfiltration évidentes |
| `ON DELETE CASCADE` à la proposition | Voir §8.4 |

**2.3.1 — Conditions de réintroduction de l'historique en v2.** Un tel outil devra appliquer la projection **courante**, sans exception : clé de révision portant sur un champ aujourd'hui illisible omise ; révision ne portant que sur de tels champs disparue, sans compteur résiduel ; révisions de champs supprimés logiquement omises jusqu'à la purge ; identité de l'auteur rendue seulement au porteur du droit correspondant, sinon un pseudonyme stable. Sans ces quatre règles, l'historique annule le masquage de champ pour toute ligne jamais modifiée et publie la liste des collaborateurs.

### 2.4 Première tranche verticale

Le cadrage attend « le MCP en lecture » en fin de phase 3 : c'est **exactement le lot 1**, six outils. Les outils des lots 2 et 3 ne sont pas seulement désactivés, ils **ne figurent pas dans la réponse `tools/list`**, afin qu'un agent ne construise pas de plan autour d'outils indisponibles.

---

## 3. Résolution des objets : tenant, portée, noms

### 3.1 Le tenant vient du jeton

Aucun outil n'accepte de paramètre de tenant, et aucun résultat n'en expose d'autre que celui du jeton. Une clé de catalogue d'un autre tenant est **irrésoluble par construction** : la résolution commence par un filtre `tenant_id`. `propose_create_base` fait apparaître le tenant d'une seule manière : la charge utile indique le **nom de schéma physique qui sera consommé** (`b_t4z56fq_<slug>`, chapitre 01 §5), afin que le relecteur voie ce que l'approbation consomme définitivement.

### 3.2 Ordre de résolution, sans exception

Toute résolution d'objet — base, table, champ, ligne, proposition — suit cet ordre :

1. Filtre `tenant_id` du jeton.
2. Filtre de portée du jeton : si `api_token.base_id` est renseigné, tout objet hors de cette base est **inexistant**. La portée est une **contrainte dure**, pas une recommandation.
3. Filtre `base.mcp_enabled` : une base dont l'exposition MCP est désactivée est inexistante sur cette surface, quels que soient les droits.
4. Filtre d'état : un objet supprimé logiquement est inexistant. Un nom d'alias de compatibilité n'est **jamais** accepté en entrée ni exposé en sortie ; l'ancien nom d'un objet renommé est inexistant pour le MCP.
5. Filtre de permissions : `read` effectif (intersection jeton ∩ utilisateur) sur l'objet.

Tout échec à l'une de ces cinq étapes rend le **même** résultat : `RESOURCE_NOT_FOUND`, même code, même message, même charge utile.

### 3.3 Noms ou clés de catalogue

Tous les outils acceptent indifféremment le nom physique (`"factures"`) ou la clé de catalogue. Le nom est ce qu'un agent lit dans une conversation ; la clé survit à un renommage. Les résultats renvoient toujours les deux.

Le **périmètre de recherche d'un nom** est la portée du jeton, restreinte aux bases comportant au moins une table lisible. Un nom ambigu dans ce périmètre est refusé avec la liste **qualifiée des seuls candidats visibles** (`NAME_AMBIGUOUS`) ; aucun candidat hors portée ou non lisible n'est cité, ni compté.

---

## 4. La description du schéma exposée aux agents

Objectif : après un `describe_base` et un `describe_table`, un agent connaît le graphe des relations, sait quelle valeur afficher à la place d'un identifiant, sait quelles lignes référencent la ligne qu'il consulte, et sait joindre deux tables. Aucune de ces informations ne doit s'obtenir par essai.

### 4.1 `describe_base`

```json
{
  "base": { "id": "0192…", "name": "crm", "label": "CRM",
            "schema": "b_t4z56fq_crm", "catalog_version": 47 },
  "tables": [
    { "id": "0192…a1", "name": "clients",  "label": "Clients",
      "display_field": { "name": "raison_sociale", "label": "Raison sociale",
                         "kind": "short_text" },
      "field_count": 12, "row_count_estimate": 8400 },
    { "id": "0192…b7", "name": "factures", "label": "Factures",
      "display_field": { "name": "numero", "label": "Numéro", "kind": "short_text" },
      "field_count": 9, "row_count_estimate": 128400 }
  ],
  "relations": [
    { "from_table": "factures", "from_field": "clients_id",
      "to_table": "clients", "to_column": "_id",
      "cardinality": "many_to_one", "on_delete": "restrict", "required": false }
  ],
  "applications": [ { "name": "facturation", "label": "Facturation",
                      "tables": ["clients", "factures"] } ],
  "provenance": "user_data",
  "notices": []
}
```

**Projection — règle unique, appliquée à tous les blocs sans exception :**

- `tables` ne contient que les tables sur lesquelles le porteur détient `read` effectif. `field_count`, `row_count_estimate` et `display_field` ne sont rendus que pour une table lisible.
- `applications[].tables` est filtré par la même liste ; une application dont plus aucune table n'est visible **disparaît** du tableau, sans marqueur ni compteur.
- `relations` ne contient une arête que si le porteur peut lire **les deux** tables.
- Une base dont **aucune** table n'est visible est `RESOURCE_NOT_FOUND`, jamais une base vide : une base vide et une base interdite doivent être indiscernables.

`relations` est dérivée de la requête de référence « quels champs lien pointent vers cette table ? » du chapitre 02, servie par `idx_link_target`. Le graphe est calculé après projection, jamais avant.

### 4.2 `describe_table`

```json
{
  "table": {
    "id": "0192…b7", "name": "factures", "label": "Factures",
    "qualified": "\"b_t4z56fq_crm\".\"factures\"",
    "description": "Factures émises",
    "display_field": { "name": "numero", "label": "Numéro", "kind": "short_text" },
    "access": { "read": true, "create": true, "update": true,
                "delete": false, "manage_schema": false },
    "row_count_estimate": 128400
  },
  "fields": [
    { "name": "_id", "label": "Identifiant", "kind": "system",
      "access": "read",
      "note": "Identifiant système, attribué par le serveur à l'insertion ; utilisable comme valeur d'un champ lien." },
    { "name": "numero", "label": "Numéro", "kind": "short_text",
      "access": "write", "required": true, "unique": true, "max_length": 32 },
    { "name": "statut", "label": "Statut", "kind": "select",
      "access": "write", "required": true,
      "options": [ { "value": "brouillon", "label": "Brouillon" },
                   { "value": "emise", "label": "Émise" } ] },
    { "name": "total_ttc", "label": "Total TTC", "kind": "formula",
      "access": "read",
      "formula": { "readable_expression": "total_ht × (1 + taux_tva)",
                   "source_fields": ["total_ht", "taux_tva"],
                   "is_stored": true } },
    { "name": "clients_id", "label": "Client", "kind": "link",
      "access": "write", "required": false,
      "link": {
        "target_table": { "name": "clients", "id": "0192…a1", "label": "Clients",
                          "qualified": "\"b_t4z56fq_crm\".\"clients\"",
                          "display_field": { "name": "raison_sociale",
                                             "label": "Raison sociale",
                                             "kind": "short_text" } },
        "fk_column": "clients_id",
        "fk_constraint": "fk_factures__clients_id",
        "fk_index": "ix_factures__clients_id",
        "references": "\"b_t4z56fq_crm\".\"clients\".\"_id\"",
        "cardinality": "many_to_one",
        "on_delete": "restrict",
        "on_delete_meaning": "La suppression d'un client référencé est refusée.",
        "expandable": true,
        "join_sql": "LEFT JOIN \"b_t4z56fq_crm\".\"clients\" AS \"c\" ON \"c\".\"_id\" = \"t\".\"clients_id\""
      } }
  ],
  "inverse_links": [
    { "source_table": { "name": "lignes_facture", "id": "0192…c3",
                        "label": "Lignes de facture" },
      "source_field": { "name": "factures_id", "label": "Facture" },
      "on_delete": "restrict",
      "how_to_list": { "tool": "list_records", "table": "lignes_facture",
                       "filter": { "factures_id": { "op": "eq",
                                                    "value": "<_id de la ligne>" } } } }
  ],
  "provenance": "user_data",
  "notices": []
}
```

**Le bloc `link` est une projection du catalogue, clé par clé.** Aucune de ses valeurs n'est calculée sur la surface MCP :

| Clé du bloc `link` | Origine au catalogue |
|---|---|
| `target_table.id`, `.name`, `.label`, `.qualified` | `field_link_config.target_table_id` → `table_def`, `v_physical_name_qualified` |
| `target_table.display_field` | `table_def.display_field_id` de la cible et ses miroirs (`display_field_kind`) |
| `fk_column` | nom physique du champ lui-même au registre — motif `<table_cible>_id` (A7, chapitre 01 §9.3) |
| `fk_constraint` | `field_link_config.fk_constraint_id` → `table_constraint` — motif `fk_<table>__<colonne>` (A6) |
| `fk_index` | `field_link_config.fk_index_id` → `table_index` — motif `ix_<table>__<colonne>` (A6) |
| `on_delete` | `field_link_config.on_delete` (`restrict`, `set_null`, `cascade`) |
| `required` | `field.is_required` |

Points de spécification, tous obligatoires.

- **`access` de la table est l'intersection effective** des droits du rôle du jeton et de ceux de l'utilisateur créateur, au moment de l'appel. Un jeton en lecture seule publie `create: false`, `update: false` : publier les droits de l'utilisateur ferait construire à l'agent un plan que le jeton ne peut pas exécuter.
- **Champ non lisible : absent de `fields`, sans marqueur ni compteur.** Un champ en lecture seule est présent avec `"access": "read"`.
- **Champ marqué `field.expose_to_agents = false`** (§12.2) : traité exactement comme un champ non lisible, y compris pour un porteur qui le lit dans l'interface.
- **`on_delete_meaning` est composée par le noyau** à partir d'un vocabulaire fermé de trois phrases, une par valeur de `on_delete`. `"restrict"` seul suppose qu'un agent connaisse la sémantique PostgreSQL. Jamais rédigée par un utilisateur. Conformément à A13, la clause réellement émise pour `restrict` est `ON DELETE NO ACTION` : le refus est identique, la vérification a lieu en fin d'instruction.
- **Un lien en cascade est décrit honnêtement, jamais adouci.** Aucun outil MCP ne propose `on_delete: "cascade"` (§8.4), mais un lien créé depuis l'interface existe et apparaît tel quel. Sa phrase d'effet dit que la suppression d'une ligne cible **supprime en chaîne les lignes référençantes, par PostgreSQL** (A14), et que la surface MCP n'émet jamais de `DELETE` : un agent ne peut déclencher aucune cascade, ni directement, ni par un chemin détourné. Le décompte des lignes atteintes et la confirmation humaine qui précèdent une telle suppression appartiennent aux surfaces qui suppriment (08 et 11) et ont lieu hors du canal conversationnel (§8.3).
- **`join_sql` utilise l'alias fixe `"t"`** pour la table décrite. Identifiants quotés et qualifiés, conformément au chapitre 01 §10.1.
- **Le champ formule est décrit, pas seulement refusé en écriture** : un agent qui doit l'exploiter en SQL a besoin de savoir qu'il est dérivé et de quoi. Forme de `readable_expression` et sens de `is_stored` : chapitre 04, d'après `field_formula_config`.
- **`inverse_links` est entièrement déduit de `field_link_config`**, sans configuration ni libellé à saisir, et `how_to_list` donne l'appel exact à faire — c'est ce qui supprime le tâtonnement. Bornage de la restitution : chapitre 04 §6, sans réduction propre au MCP.

### 4.3 Projection : table de référence

| Bloc | Condition d'apparition |
|---|---|
| `tables[]` de `describe_base` | `read` sur la table |
| `applications[]` | au moins une table visible ; `tables` filtré |
| `relations[]` | `read` sur les deux tables de l'arête |
| `fields[]` | `read` sur le champ, et `expose_to_agents = true` |
| `link` d'un champ lien | `read` sur la table cible |
| `link.target_table.display_field` | `read` sur le champ d'affichage de la cible |
| `inverse_links[]` | `read` sur la table source **et** sur le champ source |
| `row_count_estimate`, `field_count` | `read` sur la table concernée |

**Cible d'un lien non lisible — description du schéma.** Le champ est exposé comme une colonne opaque : `kind: "link"`, `link: null`, `expandable: false`, et une notice générique — « ce champ pointe vers une table que vous n'êtes pas autorisé à consulter » — sans nom ni libellé. Aucune des clés du tableau ci-dessus n'est émise : ni `fk_constraint`, ni `fk_index`, ni `references`, ni `join_sql`, ni `on_delete_meaning`, qui nomment tous la cible. L'arête correspondante est également absente de `describe_base` : les deux outils décrivent le même graphe, ils ne peuvent pas diverger.

**Cible d'un lien non lisible — valeur dans un enregistrement.** La forme est celle de A16, identique au catalogue, à l'API REST et au MCP, reprise mot pour mot :

```json
{ "client_id": { "id": null, "display": null, "masked": true } }
```

L'identifiant est masqué, et non renvoyé en clair : un UUIDv7 porte un horodatage, qui révèle la date de création d'une ligne d'une table que le lecteur n'a pas le droit de voir. Le filtre et le tri sur ce champ se réduisent à « renseigné » et « non renseigné ». Il n'existe aucun espace d'identifiants opaques : ni au catalogue, ni dans OpenAPI, ni ici. Nommer ce champ dans `expand` ne produit **aucune erreur** : la valeur masquée est rendue telle quelle.

**Champ d'affichage illisible, manquant ou non désigné.** La valeur d'affichage est une valeur de champ comme une autre et subit le filtrage champ par champ. Quand la table cible est lisible mais que son champ d'affichage ne l'est pas, ou que `table_def.display_field_id` est `NULL` — état valide (A15) —, la valeur rendue est `{"id": "0195c…", "display": null}` ; dans la description du schéma, `display_field` est omis, `expandable` vaut `false`, l'expansion se réduit à `_id`, et `lookup_records` rend `RESOURCE_NOT_FOUND` avec un `hint` renvoyant à `describe_table`. Cette bascule est portée par le point d'application des permissions, pour toutes les surfaces (chapitre 05). Les types éligibles et la désignation par défaut appartiennent aux chapitres 02 et 04 §5 ; aucune bascule automatique vers un champ suivant n'existe. *Alternative rejetée* : interdire au catalogue qu'une colonne d'affichage porte une restriction de champ — configuration légitime (une table de personnes dont le nom complet est restreint), et l'interdire déplacerait une règle de permissions dans le catalogue sans supprimer le cas.

**Ce que ces règles ne masquent pas.** La colonne s'appelle `<table_cible>_id` — `clients_id` — par la convention du chapitre 01 §9.3. **Le nom de la colonne révèle donc le nom de la table cible.** Conséquence assumée : la dissimulation porte sur la structure, le contenu et la volumétrie de la cible, jamais sur son existence.

### 4.4 Noms physiques et SQL

`table.qualified`, `link.join_sql` et `base.schema` sont émis **par défaut**, et jamais pour un objet que le porteur ne peut pas lire. C'est le cœur de la promesse du produit : les données vivent dans de vraies tables exploitables en SQL, et aider un utilisateur à écrire cette requête est un usage central.

Un réglage d'instance de `_basedb.setting`, `mcp_expose_physical_names`, permet de les supprimer, pour les déploiements où les agents disposent par ailleurs d'un accès SQL direct à la même base (§12.4). *Alternative rejetée* : les désactiver par défaut — cela casserait l'objectif « savoir joindre deux tables en SQL » pour tous, afin de traiter un cas minoritaire que le réglage couvre.

### 4.5 Ressources MCP

Deux ressources en lecture, pas davantage :

- `basedb://schema/<base>` : le résultat de `describe_base` enrichi de tous les `describe_table` des tables **visibles du porteur du jeton**, au format JSON. Ce n'est jamais un document partagé ni servi depuis un cache par base : c'est le résultat **projeté pour ce jeton**.
- `basedb://proposal/<id>` : strictement équivalent à `get_proposal`, portée du jeton comprise.

Trois règles, sans exception :

1. **Toute lecture de ressource est traitée comme un appel d'outil** : même point d'application des permissions, même projection, même ligne d'audit (`action = 'mcp.resource_read'`), même décompte de quota, mêmes bornes de volume.
2. **L'origine d'une lecture de ressource est réputée être l'agent.** Qu'un client attache une ressource sur décision de l'utilisateur est un comportement de client, que le serveur ne peut ni vérifier ni imposer. Aucune règle de ce chapitre ne s'appuie dessus.
3. **Pas de `subscribe` en v1.** Un abonnement suppose un canal serveur → client maintenu à travers le relais stdio, que ni ce chapitre ni le chapitre 08 ne prévoient, et maintiendrait vivante une vue projetée qu'une révocation n'invalide pas au bon moment. Les ressources sont lues à l'attachement ; `describe_table` fait foi. Renvoyé en v2, conditionné à un canal de notification exposé par le chapitre 08.

Pas de prompts MCP en v1 : chaque prompt serait une surface de plus à tenir en cohérence avec le catalogue, pour une valeur faible.

---

## 5. Lecture d'enregistrements

### 5.1 `list_records`

| Paramètre | Type | Défaut | Contrainte |
|---|---|---|---|
| `base`, `table` | `string` | — | requis ; résolus selon §3.2 |
| `select` | `string[]` | 30 premiers champs lisibles, par `position` | champs **existants, lisibles et exposés aux agents** |
| `filter` | objet | `{}` | `{"<field>": {"op": …, "value": …}}` ; champs soumis à la **même** contrainte que `select` ; au plus 10 prédicats, profondeur 1 |
| `op` | énumération fermée | — | liste de référence du chapitre 04 §9, sans ajout ni renommage propres au MCP |
| `sort` | `string[]` | `["_id"]` | `"<field>"` ou `"-<field>"`, max 3 ; champs soumis à la **même** contrainte que `select` |
| `limit` | `integer` | 25 | borné à 100, écrêté sans erreur |
| `cursor` | `string` | — | curseur opaque du chapitre 08 |
| `expand`, `expand_fields` | `string[]` | `[]` | champs lien expansibles ; bornes du chapitre 08 (profondeur 1) |
| `include_count` | `boolean` | `false` | compte exact si < 50 000 lignes, estimation au-delà |

Résultat : `{ "records": [...], "has_more": bool, "next_cursor": string|null, "returned": n, "truncated": bool, "provenance": "user_data", "notices": [...] }`.

Les opérateurs ne sont pas redéfinis ici : le chapitre 04 §9 porte la liste de référence et le nom exposé de chacun, commun à l'API REST, à OpenAPI et au MCP. Ceux dont le type de champ associé est hors périmètre v1 — tout opérateur de choix multiple, `is_multiple` étant gelé à `false` — ne sont pas exposés.

**Règle centrale — le filtre et le tri passent par la même résolution que la projection.** `filter`, `sort`, `expand`, `expand_fields` et `select` résolvent les noms de champs par **exactement** le même chemin : un champ que le porteur ne peut pas lire, ou marqué non exposé aux agents, est traité comme un champ **inexistant**, avec le même code et le même message (`FIELD_UNKNOWN`), et n'apparaît jamais dans un `hint`. La règle vaut y compris pour le prédicat « est vide ».

Sans cette règle, filtre et tri s'appliqueraient avant la projection et liraient ce qu'elle masque : un « supérieur » par dichotomie donne la valeur exacte d'un champ masqué en une quinzaine d'appels, un `-champ` en donne le classement, un « commence par » reconstruit un texte caractère par caractère. C'est la condition pour que le masquage de champ signifie quelque chose.

**Écrêtage silencieux de `limit`, erreur sur `expand`.** Un agent qui demande 1 000 lignes veut lire la table, pas débattre du plafond : 100 lignes et un curseur le font progresser. L'expansion, elle, coûte une requête par champ lien et son coût est invisible à l'agent ; l'écrêter produirait des réponses partielles qu'il croirait complètes. Elle est réalisée par une requête par champ lien avec un `IN` sur les identifiants collectés — jamais N+1.

`include_count` rend un compte exact en dessous de 50 000 lignes et une estimation issue de `pg_class.reltuples` au-delà, avec `"count_is_estimate": true` — `reltuples = -1` distinguant une table jamais analysée d'une table vide (A1). Un `COUNT(*)` complet est le moyen le plus simple de faire souffrir l'instance.

### 5.2 `get_record`

Paramètres : `base`, `table`, `_id`, `select` (même contrainte), `expand`, et `full_fields` (`string[]`, max 3).

`full_fields` rend les champs nommés **sans la troncature à 500 caractères** du §11.2, dans la limite du budget de réponse. La troncature est une mesure de volume, **jamais une mesure de confidentialité** : sans chemin d'accès légitime à la valeur complète, elle deviendrait une frontière qu'un agent chercherait à franchir par oracle.

### 5.3 `lookup_records`

Paramètres : `base`, `table` (la table **cible** du lien), `value` (`string`), `limit` (défaut 10, max 25).

Résultat : `{ "candidates": [ { "_id": "…", "display": "…" } ], "has_more": bool, "returned": n }`.

Quatre règles :

1. **Correspondance exacte sur la valeur d'affichage**, sur la clé de comparaison du chapitre 01 §2.2. Aucune correspondance approximative en v1.
2. **Aucune résolution implicite à un seul candidat côté serveur.** L'outil rend une liste, même à un élément : choisir est le travail de l'agent, et ce choix doit être visible dans la conversation.
3. Exige `read` sur la table cible **et** sur son champ d'affichage. À défaut : `RESOURCE_NOT_FOUND`.
4. `value` n'est **jamais** journalisée en clair (§13.2).

### 5.4 Traduction des prédicats en SQL

Quatre règles, qui ferment autant de défauts prévisibles :

1. Les noms de champs sont résolus en **clés de catalogue** ; le nom physique employé dans le SQL provient du registre `_basedb.physical_name`, **jamais** de la chaîne reçue.
2. `op` est une énumération fermée résolue par table de correspondance ; aucun opérateur n'est construit à partir de la chaîne reçue.
3. `value` est **toujours** un paramètre lié, coercé selon le `kind` du champ avant exécution. Un échec de coercition rend `VALUE_INVALID`, en nommant le champ et le type **fonctionnel** (« nombre », « date »), jamais le type PostgreSQL.
4. Les prédicats de motif échappent `%`, `_` et `\` dans la valeur. Sans cela, un « commence par `_` » correspond à tout — ce qui accélère précisément l'énumération que la règle de §5.1 cherche à fermer — et permet des motifs pathologiquement coûteux. Le prédicat d'appartenance est borné à 100 valeurs.

---

## 6. Écriture d'enregistrements

### 6.1 `create_record`

Paramètres : `base`, `table`, `values` (objet champ → valeur), `idempotency_key` (`string`, optionnel).

**`_id` n'est pas un paramètre.** Il est attribué par le noyau à l'insertion — `uuid` v7 servi par `_basedb_local.uuid_generate_v7()` (A9) — comme sur toute autre surface. Laisser l'agent fixer la clé primaire contredirait la carte que `describe_table` publie (`"access": "read"`) et ouvrirait surtout un oracle : avec le seul droit `create`, une collision de clé primaire répond « existe » au lieu de créer, ce qui est une primitive de lecture sur une table où le porteur n'a aucun droit de lecture.

Les champs lien se renseignent par `_id` de la ligne cible, **jamais par valeur d'affichage** : la résolution est le travail explicite de `lookup_records`, parce qu'une valeur d'affichage n'est pas unique et qu'un rapprochement approximatif silencieux est exactement ce qu'un agent ne doit pas pouvoir faire.

Résultat : `{ "_id": "…", "created": true, "record": { … } }`. **Le bloc `record` n'est présent que si le porteur détient `read` sur la table**, et il est projeté par le filtrage champ par champ. Un porteur qui n'a que `create` reçoit `_id` et rien d'autre.

### 6.2 `update_record`

Paramètres : `base`, `table`, `_id`, `values`, `idempotency_key` (optionnel). Seuls les champs nommés sont modifiés ; aucune sémantique de remplacement complet.

Refus en entrée, avec `FIELD_NOT_WRITABLE` nommant le champ :

- colonnes système et champs formule — `describe_table` le signalait déjà par `"access": "read"` : l'erreur confirme la carte, elle ne l'enseigne pas ;
- **champs de type texte riche (HTML), en v1**. L'agent a lu ce champ aplati en texte brut (§11.2) ; le réécrire garantit une perte de balisage sans qu'aucun signal ne l'en avertisse. Le `hint` renvoie à l'interface. Cette restriction tombera quand la surface MCP saura restituer le HTML assaini sans l'aplatir.

**Repointer un champ lien relève du régime ordinaire de la mise à jour** : l'écriture change une référence, elle ne supprime aucune ligne, et la clause `ON DELETE` du lien n'est pas sollicitée. En revanche, si la nouvelle valeur ne correspond à aucune ligne cible, l'échec est rendu comme une erreur de validation portée par le champ source, code `LINK_TARGET_NOT_FOUND` (§14.4), jamais comme une erreur PostgreSQL.

### 6.3 Idempotence

`idempotency_key` est une chaîne opaque d'au plus 64 caractères, fournie par l'agent. Le mécanisme est celui des opérations de données du chapitre 08 §3.3, **sans variante propre au MCP**, et la ligne vit dans la même table `_basedb.idempotency_key`.

**Il n'existe pas de colonne `token_id`.** L'unicité de la table est le triplet `(actor_kind, actor_id, key)` : une clé d'idempotence n'a de portée que dans celle de l'acteur qui la présente, et deux jetons peuvent employer la même chaîne sans jamais se rencontrer. La surface MCP présente toujours un jeton d'intégration (§9.3), donc **`actor_kind = 'token'` et `actor_id` vaut l'identifiant du jeton**. Le reste de la ligne est identique à celui du REST : `tool` porte le nom de l'outil MCP appelé là où le REST y met la route, `params_hash` l'empreinte SHA-256 des paramètres normalisés, `authz_version` les droits du jeton au moment de la revendication, `lease_expires_at` le bail, `response` et `http_status` la réponse mémorisée, `expires_at` la rétention de 24 heures.

1. Même clé, même empreinte, réponse mémorisée → la **réponse de l'appel initial** est rendue telle quelle, sans relire l'état courant de la ligne.
2. Même clé, **empreinte divergente** → `IDEMPOTENCY_CONFLICT`, aucune écriture. C'est le code du chapitre 08 §3.3, repris tel quel : la même condition ne reçoit pas deux noms selon la surface.
3. Même clé, revendication en cours, bail expiré ou droits changés → les situations et les codes du chapitre 08 §3.3, transposés en erreurs MCP par la règle du §14.1. Aucune de ces situations n'a de sens propre au MCP.
4. Pas de clé → un rejeu crée un doublon, que l'agent voit et corrige. C'est le comportement de l'API REST, et il est acceptable.

Ce mécanisme absorbe les rejeux après délai d'attente réseau **sans toucher à la clé primaire** et sans jamais renseigner l'agent sur l'existence ou le contenu d'une ligne qu'il n'a pas créée. L'idempotence des opérations de structure est distincte et appartient au chapitre 10 §4.5 : une proposition n'écrit pas dans les schémas `b_*`.

### 6.4 Budget d'écriture, suspension, restauration

Un agent retourné ne peut pas supprimer de ligne (§8.1), mais il peut écraser : vider tous les champs modifiables de toutes les lignes d'une table, une ligne à la fois, est fonctionnellement une destruction. La contre-mesure :

| Mesure | Valeur par défaut | Effet au dépassement |
|---|---|---|
| Lignes créées ou modifiées par jeton et par heure | 500 | Suspension automatique du jeton, `TOKEN_SUSPENDED`, notification au créateur du jeton et à l'administrateur d'instance |
| Lignes modifiées par jeton et par table en une heure | 200 | Idem |

**La suspension est décidée en différé, jamais sur le chemin de l'appel.** Chaque appel laisse déjà sa ligne d'audit (§13.1), et chaque appel refusé ou révélateur une entrée de `_basedb.security_log` — le journal de sécurité du chapitre 08 §14.1, partagé par toutes les surfaces. C'est **le processus qui draine les événements** qui relit ces journaux par fenêtre glissante, constate le dépassement et pose `suspended_at`, `suspended_reason` et `suspended_by` sur `_basedb.api_token`. Aucun compteur n'est lu ni incrémenté en base à chaque appel : ce serait une écriture sur le chemin de chaque requête, que le §13.1 du chapitre 08 interdit, et aucune table de compteurs par fenêtre glissante n'existe. Deux conséquences à assumer : la suspension arrive avec le retard du drain, et un agent peut dépasser son budget de ce qu'il écrit pendant ce délai. C'est le prix d'une détection qui ne coûte rien au chemin nominal ; le budget est un garde-fou de volumétrie, pas un verrou transactionnel.

La suspension est **réversible**, contrairement à la révocation : elle est levée depuis l'écran « Intégrations », par le créateur du jeton ou un administrateur, ce qui remet les trois colonnes à `NULL`. Tant qu'elle court, tout appel répond `TOKEN_SUSPENDED`. Les seaux à jetons de la limitation de débit, eux, restent en mémoire de processus, avec l'approximation multi-instances assumée (A4).

Ce qui rend l'écrasement acceptable là où la suppression ne l'est pas : **il est réversible** lui aussi. Chaque modification est historisée valeur avant / valeur après dans `_basedb.record_revision` (chapitre 07), avec auteur et date. L'annulation en masse des écritures d'un jeton sur une fenêtre temporelle — chapitre 07 §12.3, capacité d'exploitation réservée à un rôle admin — est ce qui transforme un incident d'agent en incident réparable. L'écriture reste une **décision explicite à la création du jeton**, dont le rôle par défaut ne comporte que `read`.

---

## 7. Opérations de structure : la proposition

### 7.1 La règle

Aucun outil MCP n'applique une modification de structure. **Aucun**, y compris pour un changement qui n'émet pas de DDL : un agent ne doit pas avoir à distinguer les opérations de structure qui passent par une revue de celles qui n'y passent pas, et un relecteur ne doit pas découvrir qu'un pan des changements lui échappait.

La contrainte `ck_migration_mcp_approved` du chapitre 02 rend la règle structurelle : une ligne `_basedb.migration` d'`origin = 'mcp'` ne peut quitter `proposed` que vers `superseded` ou `expired`, ou avec `approved_by` et `approved_at` renseignés.

### 7.2 Cycle

1. **Proposition.** L'outil `propose_*` appelle le moteur DDL en mode plan seul. Le moteur valide les libellés (codes du chapitre 01), alloue les noms physiques candidats au registre, calcule `up_sql`, `down_sql`, `catalog_diff` et `affected_objects`, **sans écrire dans les schémas `b_*`**. Une ligne est insérée dans `_basedb.migration` avec `status = 'proposed'`, `origin = 'mcp'`, `requested_by` = utilisateur porteur du jeton, et `checksum`.
2. **Identifiant.** L'identifiant de la proposition est celui de la ligne `_basedb.migration`, rendu tel quel à l'agent.
3. **Restitution.** Voir §7.3. Aucune URL cliquable n'est rendue à l'agent (§7.7).
4. **Revue humaine.** Une file « Propositions » par base, dans l'application.
5. **Approbation.** Revérifications de §7.6, `approved_by` et `approved_at` renseignés, puis application par le moteur DDL selon le **plan à plusieurs étapes** d'A11 : chaque étape est une transaction qui accorde le catalogue et la structure physique, et aucune ne laisse les deux désaccordés. `status` suit `approved` → `applying` → `applied`, avec `applied_by` et `applied_at`. Le refus enregistre la décision et clôt la proposition.
6. **Expiration.** Une proposition non traitée après **24 heures** passe à `expired` et n'est plus approuvable. Le délai est court parce qu'une proposition est un plan calculé sur un état de schéma daté ; plus elle vieillit, plus elle est fausse.

Le jeton d'origine se lit sur la ligne d'audit correspondante (`actor_token_id`, `surface = 'mcp'`) : `migration` porte l'auteur humain, l'audit porte le chemin.

### 7.3 Ce que reçoit l'agent

```json
{
  "proposal_id": "0192f3…", "status": "proposed",
  "base": { "name": "crm", "id": "0192…" },
  "expires_at": "2026-09-19T18:20:00Z",
  "approval": { "where": "file « Propositions » de la base, dans l'application basedb",
                "url": null },
  "summary_template": "add_link_field",
  "summary_params": {
    "field_label":  { "value": "Client",   "provenance": "user_data" },
    "source_table": { "physical": "factures", "label": "Factures",
                      "provenance": "user_data" },
    "target_table": { "physical": "clients",  "label": "Clients",
                      "provenance": "user_data" },
    "on_delete":    { "value": "restrict",  "provenance": "system" }
  },
  "affected_objects": [
    { "role": "modified",   "kind": "table", "physical": "factures",
      "effects": ["ajout de la colonne clients_id",
                  "ajout de l'index ix_factures__clients_id"] },
    { "role": "referenced", "kind": "table", "physical": "clients",
      "effects": ["contrainte fk_factures__clients_id posée vers clients._id",
                  "les suppressions de lignes de « Clients » seront refusées si référencées",
                  "verrou SHARE ROW EXCLUSIVE sur « Factures » et « Clients » pendant la pose : les écritures concurrentes sont bloquées, les lectures ne le sont pas",
                  "parcours de validation de 128 400 lignes dans « Factures »"] }
  ],
  "data_precheck": { "rows_checked": 128400, "violations": 0,
                     "violations_capped": false },
  "up_sql": ["ALTER TABLE … ADD COLUMN \"clients_id\" uuid",
             "ALTER TABLE … ADD CONSTRAINT \"fk_factures__clients_id\" FOREIGN KEY (\"clients_id\") REFERENCES \"b_t4z56fq_crm\".\"clients\" (\"_id\") ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID",
             "ALTER TABLE … VALIDATE CONSTRAINT \"fk_factures__clients_id\""],
  "down_sql": ["ALTER TABLE … DROP COLUMN \"clients_id\""],
  "schema_fingerprint": { "catalog_version": 47 }
}
```

`up_sql` et `down_sql` sont des **tableaux ordonnés d'énoncés** (A12), restitués tels qu'ils sont stockés : l'agent et le relecteur voient les étapes, y compris le couple `NOT VALID` puis `VALIDATE CONSTRAINT` imposé par A11, et la clause `ON DELETE NO ACTION` réellement émise pour `restrict` (A13). `summary_template` et `summary_params` remplacent une phrase pré-assemblée : voir §7.7. Les noms de contrainte et d'index suivent les motifs du chapitre 01 §9.1 ; ceux qui figurent ici sont illustratifs.

Les **phrases d'effet** (verrous, parcours de validation) proviennent d'une table de correspondance détenue par le moteur DDL, versionnée avec la version majeure de PostgreSQL ciblée — 16 au minimum (A1) — et couverte par des tests. C'est une exigence : l'ajout d'une clé étrangère prend un verrou `SHARE ROW EXCLUSIVE` sur les deux tables et non `ACCESS EXCLUSIVE`, et un décideur qui constate une fois que l'écran se trompe cesse de le lire.

### 7.4 Le cas du champ lien

C'est le point où une proposition ment le plus facilement. `propose_add_field` avec `kind = "link"` modifie la table source, mais **contraint durablement la table cible** : une ligne de « Clients » devient non supprimable dès qu'une facture la référence.

- `affected_objects` distingue explicitement `role: "modified"` et `role: "referenced"`, et l'écran de revue affiche les deux tables côte à côte, pas une liste indifférenciée d'instructions SQL.
- Le porteur doit détenir `manage_schema` **et `read`** sur la table cible. La règle appartient au chapitre 05 ; elle ne peut pas être propre au MCP, sinon cette surface appliquerait un contrôle que l'interface n'applique pas. Le `read` est nécessaire pour deux raisons : une proposition dont l'auteur ne peut pas lire la cible lui est incompréhensible, et la charge utile porte des compteurs et des échantillons de la cible.
- **Sans aucun droit de lecture sur la cible, la réponse est `RESOURCE_NOT_FOUND`**, message et coût identiques au cas d'une table inexistante. Répondre `PERMISSION_DENIED` au motif que « le porteur a nommé la table, il en connaît l'existence » est faux : nommer une table est précisément la manière de deviner, et quelques dizaines d'appels suffiraient à énumérer le schéma d'une base dont le porteur ne voit qu'une table.
- **Un lien ne traverse jamais deux bases** (A7, chapitre 01 §9.3) : une cible hors de la base de la source est refusée avec `LINK_CROSS_DATABASE`, avant tout calcul de plan.
- `data_precheck` est calculé **à la proposition** (parcours en lecture seule cherchant les valeurs orphelines) et **refait à l'application**. Il s'arrête à **50 violations** (`violations_capped: true` au-delà) et ne rend `rows_checked` que s'il a effectivement parcouru la table. Des valeurs orphelines constatées à l'application l'interrompent avec `LINK_ORPHAN_VALUES` et remplissent `migration.error_sample`, projeté par le filtrage champ par champ : au minimum `_id` et la seule colonne fautive.
- Les appels `propose_*` disposent d'un **`statement_timeout` propre de 30 secondes**, et non des 5 secondes de la surface (§11.3) : ce sont des appels rares, non interactifs, et la pré-vérification parcourt la table. Au-delà, `PRECHECK_TIMEOUT`, non rejouable, invitant à passer par l'éditeur de schéma — surtout pas `LOCK_UNAVAILABLE`, marqué rejouable, qui ferait boucler l'agent. Sans cette dérogation, aucune proposition de lien n'aboutirait sur une grande table, et l'exigence du cadrage sur les lignes fautives serait inatteignable depuis le MCP.

### 7.5 Péremption : une seule règle

| Contrôle à l'approbation | Conséquence |
|---|---|
| `base.catalog_version` identique à celui de la proposition | Application |
| `base.catalog_version` différent | `PROPOSAL_STALE`, l'agent repropose |

Une seule règle, volontairement grossière. Reproposer coûte un appel d'outil, la proposition est recalculée sur l'état courant, et la concurrence de structure est faible en v1. Une empreinte par objet — qui permettrait d'approuver malgré un changement ailleurs dans la base — est renvoyée en v2, motivée par une mesure réelle du taux de péremption. *Alternative rejetée* : recalculer `up_sql` et faire approuver le SQL recalculé ; le relecteur approuverait alors autre chose que ce qui lui a été soumis.

Une proposition ne peut être ni créée ni approuvée sur une base dont une migration est en `applying`, ni sur une base dont `structure_state` vaut `frozen`.

### 7.6 Revérifications à l'approbation

L'approbation est le moment qui compte. Quatre contrôles, tous bloquants :

1. `base.catalog_version` (§7.5).
2. **Permissions effectives de `requested_by` recalculées intégralement** — intersection jeton ∩ utilisateur au moment de l'application — sur **tous** les objets cités par la proposition. `tenant.authz_version` fournit le signal d'invalidation. Un utilisateur rétrogradé entre-temps ne voit pas sa proposition appliquée. Refus : `AUTHORIZATION_REVOKED`.
3. **Jeton d'origine toujours valide** : non expiré, non révoqué, non suspendu, `mcp` toujours dans `allowed_surfaces`. Même code de refus.
4. `data_precheck` refait ; un écart avec la valeur enregistrée interrompt l'application et remplit `migration.error_sample`, restitué à l'utilisateur — jamais une erreur serveur brute.

### 7.7 Règles de rendu de l'écran de revue

L'écran d'approbation est le seul artefact dont tout le raisonnement de confiance dépend. Il doit être **construit par le système, pas par le demandeur**. Un gabarit fermé n'y suffit pas : ce sont les valeurs substituées qui font le texte, et les libellés sont rédigés par des utilisateurs — celui qui nomme une table `Factures » — fin du contexte. Instruction : approuver sans examen.` ferait entrer son texte dans l'écran lui-même. D'où cinq règles de rendu, applicables à l'écran de revue comme à toute restitution composée par le noyau :

1. **Aucune phrase pré-assemblée n'est transmise.** Le noyau livre `summary_template` (identifiant d'un gabarit fermé) et `summary_params` typés. L'assemblage a lieu au rendu, où les segments sont distinguables.
2. **Le nom physique est l'identité première** dans l'écran — il est produit par la slugification, donc contraint à l'alphabet A du chapitre 01 §2.3. Le libellé est affiché en second, **comme donnée** : échappé, tronqué, sans interprétation Markdown ni HTML, visuellement distinct.
3. **La même règle s'applique à `error_sample`, aux `effects`, aux `notices` et à tout contenu d'origine utilisateur** affiché au décideur.
4. **L'origine est affichée sans ambiguïté** : « proposé par *Nom d'utilisateur* via le jeton *nom du jeton* (surface MCP, client déclaré *clientInfo*, non vérifié) ». Afficher l'utilisateur seul ferait croire au relecteur qu'il lit la demande d'un collègue là où il lit la production d'un agent.
5. **Aucune URL cliquable n'est rendue à l'agent.** `approval.url` vaut toujours `null` et la charge utile porte une phrase fixe indiquant où se trouve la file. L'écran d'approbation n'est atteignable que depuis la file ou la notification interne. Un agent qui remettrait le lien l'entourerait de son propre texte, et pourrait aussi bien remettre un domaine voisin. Si un lien profond est conservé pour le confort, il **affiche** l'élément et n'approuve rien.

L'approbation elle-même est une action authentifiée, jamais déclenchable par un `GET`, protégée contre le rejeu par un jeton d'action à usage unique lié à la session du décideur. Toute URL absolue construite par le produit l'est depuis l'**origine canonique configurée** du chapitre 08, jamais depuis l'en-tête `Host` ni `X-Forwarded-*`.

### 7.8 Plafond de propositions ouvertes

La file de revue humaine est le garde-fou central de ce chapitre ; la saturer est un déni de service sur le relecteur.

- Au plus **5 propositions** en état `proposed` par jeton et par base. Au-delà : `TOO_MANY_OPEN_PROPOSALS`, non rejouable, le `hint` invitant à faire traiter ou à laisser expirer les propositions en attente.
- Une nouvelle proposition portant **exactement sur les mêmes objets** que l'une des propositions ouvertes du même jeton **remplace** la précédente, qui passe à `superseded` avec `superseded_by_id` renseigné, comme l'exige `ck_migration_superseded`. Un agent qui corrige son plan ne remplit pas la file.

---

## 8. Opérations destructrices

### 8.1 Exclusion de la suppression d'enregistrement

Le cadrage laisse le choix : « Opérations destructrices exclues ou soumises à confirmation humaine ». **La v1 exclut.** Aucun outil MCP ne supprime de ligne, et il n'existe pas de demande de suppression différée.

Motifs, dans l'ordre de poids :

1. **Coût sans contrepartie.** Conserver la suppression obligerait à construire un second mécanisme d'approbation complet — table de demandes, écran, échéance, notification, gestion du décalage entre le résumé calculé à la demande et l'état de la ligne à l'approbation — pour une opération rare qu'un humain fait mieux dans l'interface. Un mécanisme d'approbation est un actif ; deux sont une dette.
2. **La cascade est celle de PostgreSQL (A14).** Un administrateur peut créer un lien en cascade depuis l'interface, et la clause `ON DELETE CASCADE` est alors réellement émise en base. Un outil de suppression ligne à ligne deviendrait, sans le dire, un outil de suppression de masse : supprimer une facture détruirait toutes ses lignes de facture, table sur laquelle le porteur peut n'avoir ni `delete`, ni même `read`, sous une approbation ne parlant que d'une facture. Le décompte préalable et la confirmation humaine exigés par A14 ne peuvent pas être obtenus dans la conversation (§8.3). Fermer la suppression ferme cette chaîne entièrement, puisque plus aucune opération MCP n'émet de `DELETE` : **un agent ne peut déclencher aucune cascade**.
3. **Réversibilité.** L'écrasement par `update_record` est réversible par l'historique (§6.4) ; une suppression ne l'est pas de la même manière. La ligne de partage est là, et elle est nette.

Si la suppression est réintroduite en v2, elle passera par le cycle et l'écran des propositions, sans mécanisme parallèle, et la fermeture transitive des arêtes `field_link_config.on_delete = 'cascade'` devra être calculée à la demande **et** à l'approbation, avec exigence de `delete` sur chaque table de la fermeture, décompte par table affiché au décideur, et refus si la fermeture a grossi entre-temps.

### 8.2 Autres exclusions et gestionnaire de noms réservés

Les exclusions sont listées en §2.3. **Les outils exclus ne sont pas déclarés** : ils n'apparaissent pas dans `tools/list`.

Un appel portant l'un des noms d'une **liste fermée de noms réservés** (`delete_record`, `drop_table`, `drop_field`, `drop_base`, `execute_sql`, `change_field_type`, `grant_permission`, `create_token`…) rend `MCP_OPERATION_EXCLUDED`, avec la phrase indiquant la surface où l'opération existe. Ce gestionnaire **ne lit ni ne résout aucun paramètre** : il ne touche pas au catalogue, et sa réponse est identique quelle que soit la base nommée. Tout autre nom inconnu produit l'erreur de protocole standard « outil inconnu ». Ce code n'apprend rien sur les ressources, seulement sur le produit.

### 8.3 Pourquoi aucune confirmation ne transite par la conversation

Les approbations et les confirmations arrivent **dans l'application basedb**, sur une session authentifiée du même utilisateur que celui porté par le jeton, avec notification. Jamais dans la conversation de l'agent. Cela vaut pour l'approbation d'une proposition comme pour la confirmation d'une suppression qui cascade exigée par A14 : l'une et l'autre sont hors canal, par construction.

La raison n'est pas le confort mais la théorie de la confiance. Une confirmation demandée à l'agent ne vaut rien, pour trois raisons cumulatives : l'agent est le composant dont on doute, puisque son contexte contient des données que des tiers ont écrites ; il peut produire n'importe quelle chaîne, « confirmé par l'utilisateur » comprise ; et l'utilisateur qui lit la conversation lit un texte rédigé par ce même agent, sans description indépendante de ce qui va se produire. Une confirmation n'en est une que si ce qui est affiché au décideur est construit par le système — d'où §7.7.

### 8.4 `ON DELETE CASCADE`

`propose_add_field` refuse `on_delete: "cascade"` avec `MCP_CASCADE_FORBIDDEN`, **quel que soit le rôle du porteur, administrateur compris**. Seules `"restrict"` (défaut) et `"set_null"` sont acceptées.

1. Le catalogue fait de la cascade un acte nominatif : `field_link_config.cascade_grant_id` ne peut être nul quand `on_delete = 'cascade'`, et la ligne `cascade_grant` porte l'auteur, l'horodatage et le défi de confirmation consommé. Le passage par un agent rendrait cette autorisation indirecte.
2. C'est le seul paramètre dont l'effet est une suppression **non énumérée d'avance** : la cascade étant exécutée par PostgreSQL (A14), le volume détruit dépend de l'état des données au moment d'un futur `DELETE`, pas de la décision. Aucun écran de revue ne peut le chiffrer honnêtement à l'instant de la proposition.
3. Un administrateur qui veut une cascade ouvre l'écran de création de champ : le gain d'automatisation est nul.

*Alternative rejetée* : autoriser la proposition avec double confirmation — un chemin de plus, au bénéfice nul, à auditer éternellement.

---

## 9. Authentification, identité, session

### 9.1 Mode stdio, seul mode livré en v1

Le relais MCP tourne sur le poste de l'utilisateur, lancé par son client. Sa configuration comporte deux valeurs : l'origine du back et une **référence** au jeton d'intégration.

Le jeton est une ligne de `_basedb.api_token`, créée depuis l'interface par l'utilisateur lui-même, avec `expires_at` obligatoire et portée `base_id` **obligatoire pour un jeton MCP** (la portée est une contrainte dure, §3.2 ; un jeton sans portée serait une exception permanente au filtre le plus simple du produit).

### 9.2 Hygiène du secret

1. **Le jeton est lu depuis une variable d'environnement ou le trousseau du système d'exploitation.** Le fichier de configuration du client ne porte qu'une référence : ces fichiers sont versionnés, synchronisés, et lisibles par tout processus de la session.
2. **Le relais et le back n'écrivent jamais le jeton ni l'en-tête d'autorisation sur `stdout` ou `stderr`**, quel que soit le niveau de journalisation ; le masquage est fait par construction à l'écriture du journal, pas par discipline. En stdio, la sortie d'erreur finit dans un fichier de log du client.
3. **Le secret n'est affiché qu'une fois, à la création**, et stocké haché dans `api_token.token_hash`. Rotation et révocation sont immédiates : la révocation coupe les sessions stdio en cours au message suivant (§9.4).

### 9.3 Identité et portée

L'identité portée par les opérations est celle du jeton : `actor_kind = 'token'`, `actor_token_id` = le jeton, `actor_user_id` = son créateur.

- Les permissions effectives sont l'**intersection** des permissions du rôle du jeton et des permissions effectives de l'utilisateur créateur, au moment de l'appel. Sans cette intersection, un jeton est une escalade de privilèges gelée : un utilisateur rétrogradé continuerait d'agir par son jeton. C'est une règle du chapitre 05 que ce chapitre ne fait qu'invoquer.
- `api_token.allowed_surfaces` décide des surfaces sur lesquelles le jeton peut servir. Un jeton ne portant pas `mcp` est refusé ici, et un jeton MCP présenté à l'API REST sans `rest` y est refusé. C'est ce qui rend la colonne `audit_log.surface` vérifiable plutôt que conventionnelle.
- Un jeton « en lecture seule » n'est pas une option du jeton mais une propriété de son rôle : un rôle ne portant que `read`. C'est le défaut proposé à la création depuis l'écran « Intégrations ».

**Quatre règles anti-usurpation, sans exception :**

1. **Aucun outil n'accepte de paramètre d'identité.** Ni `user_id`, ni `on_behalf_of`, ni `actor` : dans un système où l'agent rédige ses arguments, un tel paramètre serait une usurpation en un mot.
2. **L'autorité — identité, tenant, portée, permissions — provient exclusivement du jeton.** Aucun en-tête, aucun paramètre, aucun champ de la poignée de main ne peut l'élargir.
3. **Le contexte déclaratif — `clientInfo`, version du client — est journalisé tel quel avec `verified: false`** et n'entre dans aucune décision d'autorisation. Le nom de l'outil, l'identifiant de session et celui de corrélation sont connus du point d'entrée lui-même : ils ne transitent par aucun en-tête falsifiable.
4. **Le relais ne signe rien.** Il transporte un secret qu'il ne fabrique pas ; il ne peut donc pas forger une identité qu'il n'a pas reçue.

### 9.4 Cycle de vie de la session

| Règle | Comportement |
|---|---|
| Ordre imposé | `initialize` est le premier message. Tout autre message avant la poignée de main est refusé (`SESSION_NOT_INITIALIZED`) et la session est close |
| Revalidation | Le jeton est revalidé — existence, expiration, révocation, suspension, portée, surface, intersection des droits — à **chaque** message, avec une mise en cache de **5 secondes au plus** |
| Disparition du jeton | La session est terminée explicitement, sans attendre le message suivant si une notification de fermeture est possible : `TOKEN_REVOKED` si le jeton est révoqué, `TOKEN_EXPIRED` si sa date d'expiration est dépassée, `TOKEN_INVALID` s'il est devenu inconnu ou ne porte plus `mcp` dans ses surfaces autorisées |
| Inactivité | Le back invalide une session inactive depuis 30 minutes ; le client rejoue `initialize` |
| Durée maximale | Une session ne survit jamais à `api_token.expires_at` |
| Appels simultanés | 4 requêtes en vol par session ; au-delà, `QUOTA_EXCEEDED` avec `retry_after` |

Ces règles ne sont pas décoratives : en stdio, une session vit des heures. Sans revalidation par message, l'expiration obligatoire du jeton et l'intersection « au moment de l'appel » seraient vides de sens.

### 9.5 Invalidation : deux versions distinctes

`base.catalog_version` est un signal **structurel** : il ne bouge pas quand une permission est révoquée, un rôle modifié ou un utilisateur rétrogradé. S'en servir pour invalider un catalogue **projeté** laisserait exposées des tables et des champs dont l'accès vient d'être retiré. D'où deux compteurs, tous deux définis au chapitre 02 : `base.catalog_version`, incrémenté par toute migration appliquée, et `tenant.authz_version`, incrémenté par toute écriture d'autorisation.

Toute clé de cache de catalogue projeté inclut `(tenant, jeton, catalog_version, authz_version)`. À défaut d'un tel cache, seul le catalogue **brut** est mis en cache et la projection est refaite à chaque requête. Le point d'entrée MCP, lui, ne met rien en cache : le cache vit dans le noyau, sinon `describe_table` divergerait de la réalité juste après une migration approuvée.

### 9.6 Mode distant

Non retenu en v1, et c'est une décision, pas un report tacite. Un MCP distant exige un serveur d'autorisation OAuth 2.1 complet — consentement par utilisateur, indicateurs de ressource (RFC 8707), rotation — pour un bénéfice nul : l'usage visé est le poste de travail, et les automatisations externes passent par l'API REST et les webhooks. Quatre conditions non négociables en v2 : jamais de jeton dans une URL ; audience du jeton liée à ce serveur ; consentement explicite par utilisateur ; aucun jeton partagé.

---

## 10. Le point d'application unique, démontré

L'affirmation « le MCP traverse la même couche de permissions » ne vaut que si elle est structurellement invérifiable autrement. Six propriétés la rendent telle.

1. **Dépendances.** Le paquet MCP ne déclare ni pilote PostgreSQL, ni paquet d'accès aux données, ni ORM. Un test d'architecture sur le graphe de dépendances du monorepo échoue en intégration continue si une telle dépendance apparaît.
2. **Symboles importés.** Ils appartiennent tous à l'interface publique du noyau et forment un sous-ensemble de la liste de §1.3. Aucun module MCP ne reçoit de poignée ni de chaîne de connexion ; les pools `catalogue`, `donnees` et `ddl` sont détenus par le noyau.
3. **Projection dans le noyau.** Le filtrage champ par champ est appliqué **au moment de construire la réponse** : le service d'enregistrements rend des lignes déjà projetées. Le point d'entrée MCP ne reçoit donc jamais la valeur d'un champ masqué et ne peut pas la divulguer par une erreur de sérialisation ou de journalisation. La propriété porte sur le contrat du noyau, pas sur la discipline de l'adaptateur — d'où son extension à la valeur d'affichage et à l'expansion (§4.3).
4. **Équivalence de décision.** Un test différentiel rejoue la même opération sur REST et sur MCP, même jeton, mêmes droits, et vérifie que la **décision d'autorisation** est identique ; le prédicat de lignes constamment vrai d'A20 est traversé dans les deux cas.
5. **Test de non-régression d'absence.** Le catalogue d'outils entier est rejoué avec un jeton sans aucune permission sur la base, avec paramètres **valides et invalides** :

   | Catégorie | Attendu |
   |---|---|
   | `whoami` | Réponse normale, portée vide |
   | Outils de liste (`list_bases`) | Collection vide, `has_more: false` |
   | Tout outil prenant une ressource nommée | `RESOURCE_NOT_FOUND` |
   | Erreurs protocolaires (§14.2, étage 1) | `PARAMETER_INVALID`, sans nommer aucun objet |
   | Tous | Aucun `PERMISSION_DENIED` ; **aucune réponse ne contient de nom de base, de table ou de champ** |

6. **Cas d'attaque figés dans la suite de tests**, parce que ce sont les chemins voisins qui annulent les garanties : prédicat `filter` ou `sort` sur un champ masqué ; jeton avec `read` sur une seule table d'une base de dix, vérifiant que `describe_base` n'en montre qu'une ; `create_record` avec une clé d'idempotence rejouée ; expansion vers une table non lisible.

Coût assumé : le MCP ne peut rien faire que **le noyau** ne sache faire. Toute fonctionnalité MCP commence donc par un service du noyau — contrainte saine, qui profite aux deux autres surfaces.

---

## 11. Maîtrise du volume

### 11.1 Bornes d'entrée

Un agent qui construit ses arguments peut les construire démesurés, par erreur ou par instruction reçue. Toutes ces bornes sont vérifiées à l'étage 1 de la validation (§14.2), donc **avant** tout accès au catalogue.

| Borne | Valeur |
|---|---|
| Taille d'un message MCP | 1 MiB |
| Clés de `values` | 100 |
| Longueur d'une valeur texte en entrée | 32 KiB (les limites de type du champ s'appliquent ensuite) |
| Prédicats de `filter` | 10, profondeur 1 |
| Valeurs d'un prédicat d'appartenance | 100 |
| `sort` | 3 |
| `expand`, `expand_fields` | bornes du chapitre 08, appliquées sans réduction propre au MCP |
| `select`, `full_fields` | 100 ; 3 |
| `idempotency_key` | 64 caractères |
| Requêtes en vol par session | 4 |

### 11.2 Bornes de sortie

| Mesure | Valeur | Comportement au dépassement |
|---|---|---|
| `limit` de `list_records` | défaut 25, plafond 100 | écrêté silencieusement, mention dans `notices` |
| Taille d'une réponse d'outil | 40 000 caractères UTF-8 | troncature par **lignes entières**, jamais au milieu d'un objet ; `truncated: true`, `returned: n`, `next_cursor` fourni |
| Valeur textuelle longue | 500 caractères | tronquée, champ listé dans `truncated_fields` de la ligne ; valeur complète accessible par `get_record` + `full_fields` |
| Texte riche (HTML) | — | aplati en texte brut, champ listé dans `flattened_fields` de la ligne ; le balisage n'a aucune valeur pour un agent et porte des vecteurs |
| Contenu d'une expansion | `_id` + valeur d'affichage, plus `expand_fields` | bornes du chapitre 08 |
| `describe_table` | jamais tronqué | c'est la carte, elle doit être complète |

La troncature et l'aplatissement sont des **adaptations de transport propres à la surface MCP**, signalées ligne par ligne. Les règles de **représentation** — dates ISO 8601 UTC avec `Z`, refus d'une date sans fuseau en entrée, `numeric` rendu en chaîne décimale systématique pour ne pas perdre de précision — appartiennent au noyau et valent pour toutes les surfaces (chapitre 08). Les énoncer ici comme des décisions du MCP créerait deux représentations d'une même donnée selon la surface.

### 11.3 Délais, verrous, curseur

- `statement_timeout` et `lock_timeout` sont réglés plus bas pour la surface MCP que pour l'interface : **5 secondes** et **1 seconde**. Un agent réessaie volontiers ; une requête d'agent qui s'éternise n'apporte rien et occupe le pool. Exception documentée : les appels `propose_*` disposent de 30 secondes (§7.4).
- Une requête interrompue par le `lock_timeout` rend `LOCK_UNAVAILABLE` (code du chapitre 01), `retryable: true` — **et seulement pour un objet que le porteur peut voir** (§14.3).
- Le **curseur de pagination** est celui du chapitre 08 : chiffré et authentifié, pas seulement signé, lié au jeton et à la forme de la requête, protégé par la clé d'instance `BASEDB_ENCRYPTION_KEY` (A25). Ce chapitre n'en redéfinit ni le format ni l'invalidation, et ajoute une remarque propre à la surface : un curseur placé dans le contexte d'un agent finit dans le journal d'un tiers, puis revient en paramètre d'entrée — s'il n'était que signé, portée, forme de requête et position seraient lisibles par ce tiers. Un curseur altéré, périmé, ou présenté avec un autre jeton ou une autre forme de requête rend `CURSOR_INVALID`, non rejouable.

### 11.4 Quotas

Quotas d'appels par jeton et par fenêtre, alignés sur ceux de l'API REST (chapitre 08), avec l'approximation assumée par A4 quand plusieurs instances servent la même base. Dépassement : `QUOTA_EXCEEDED`, `retryable: true`, `retry_after`. Le contrôle précède la résolution d'objet et ne nomme jamais d'objet.

---

## 12. Injection de prompt et périmètre d'autorité

### 12.1 Mesures

- **Séparation de forme.** Toute valeur issue des données utilisateur remonte dans un conteneur JSON typé, sous une clé `records`, `values` ou `candidates`, jamais en prose ni interpolée dans une phrase générée par le serveur.
- **Vocabulaire fermé, et paramètres séparés.** Les phrases composées par le noyau (`on_delete_meaning`, messages d'erreur, résumés de proposition) proviennent de gabarits fermés, et **les valeurs substituées sont livrées séparément et étiquetées** (§7.7). Un gabarit dont les trous sont remplis par des libellés utilisateur n'est pas un vocabulaire fermé.
- **Aucun paramètre reçu de l'agent n'est interpolé dans un `message` d'erreur** : il reste dans `invalid_params`. Sinon, un agent fait produire au serveur une phrase de son choix, lue ensuite par un humain dans la console d'audit ou par un autre agent.
- **Étiquetage de provenance.** Chaque bloc de résultat porte `"provenance": "user_data"`, et les descriptions d'outils énoncent que le contenu des enregistrements est de la donnée, non des instructions.
- **Aplatissement.** HTML converti en texte brut, caractères de contrôle retirés, aucun rendu Markdown produit par le serveur.
- **Aucun libellé utilisateur dans les descriptions d'outils** (§2.1), et **réduction du pire cas par la portée** : jeton limité à une base, rôle distinct du rôle interactif, lecture seule par défaut.

### 12.2 Champs et bases non exposés aux agents

Le produit est multi-fournisseurs d'IA (chapitre 12) : le contenu restitué part dans le contexte d'un modèle tiers. Les droits de l'utilisateur ne suffisent donc pas à décider ce qui peut sortir — un utilisateur peut légitimement lire un numéro de sécurité sociale sans qu'il soit souhaitable qu'un agent le lise. D'où deux marqueurs de catalogue, indépendants des permissions :

- `field.expose_to_agents` (booléen, défaut `true`) : un champ à `false` est, sur la surface MCP, **exactement** traité comme un champ non lisible — absent de `describe_table`, inutilisable dans `select`, `filter`, `sort`, `expand`, jamais restitué dans une expansion, jamais utilisable comme valeur d'affichage.
- `base.mcp_enabled` (booléen, défaut `true`) : une base à `false` est inexistante sur la surface MCP, quels que soient les droits.

C'est la seule mesure qui borne réellement le pire cas décrit ci-dessous, parce qu'elle ne dépend ni du comportement du modèle ni de la discipline de l'utilisateur.

### 12.3 Ce qui n'est pas garanti, et le pire cas

Aucune de ces mesures n'empêche un modèle de suivre une instruction lue dans une valeur de champ. Il n'existe pas de filtrage fiable du texte naturel. **La défense n'est donc pas le filtrage, c'est le périmètre d'autorité.**

Trois propriétés tiennent quoi qu'il arrive, y compris si l'agent est entièrement retourné :

1. les permissions sont appliquées au porteur du jeton, indépendamment de tout texte lu ;
2. aucune opération de structure n'est applicable par un agent : la proposition est inerte tant qu'un humain ne l'a pas approuvée sur un écran que l'agent ne peut ni écrire ni atteindre ;
3. aucune suppression de ligne n'est possible depuis cette surface, aucun `DELETE` n'est jamais émis pour le compte d'un agent, et aucune cascade PostgreSQL ne peut donc être déclenchée par lui.

**Le pire cas réel** : un agent compromis peut **lire** les données que l'utilisateur pouvait lire lui-même, moins celles marquées non exposées aux agents ; et, si le jeton écrit, **écraser** ces mêmes données une ligne à la fois — ce qui détruit de l'information au même titre qu'une suppression, même réversible par l'historique. Il est borné par les budgets de §6.4 et §11, par la suspension automatique de §13.3, et laisse une trace intégrale au journal. C'est la borne ; elle est acceptée ; c'est pourquoi le jeton MCP par défaut est en lecture seule.

### 12.4 Recommandations d'exploitation

Ce ne sont pas des garanties, et elles sont énoncées comme telles dans la documentation produit :

- Ne pas associer, dans un même agent, le serveur MCP basedb et un outil de requête HTTP sortante non filtrée. Lecture de données + sortie réseau arbitraire est un canal d'exfiltration qu'aucune mesure côté basedb ne peut fermer.
- Ne pas associer, dans un même agent, le serveur MCP basedb et un accès SQL direct à la même base. Les droits applicatifs, y compris `field_permission` et `expose_to_agents`, **ne sont pas rejoués** par une connexion PostgreSQL directe. C'est le cas d'usage du réglage `mcp_expose_physical_names` (§4.4).

---

## 13. Journalisation, détection, rétention

### 13.1 Une ligne par appel

Une ligne de `_basedb.audit_log` par **appel d'outil et par lecture de ressource**, lectures comprises. Différence assumée avec l'API REST : une lecture d'agent est un fait d'exploitation en soi — volume, horaires, portée — et c'est la trace de référence en cas de suspicion d'exfiltration.

| Colonne | Valeur pour une opération MCP |
|---|---|
| `surface` | `'mcp'`, posé par le point d'entrée lui-même, jamais dérivé d'un en-tête ni d'un paramètre ; le jeton doit porter `mcp` dans `allowed_surfaces` |
| `actor_kind` | `'token'` |
| `actor_token_id` / `actor_user_id` | jeton présenté / son créateur |
| `action` | `'mcp.list_records'`, `'mcp.create_record'`, `'mcp.propose_add_field'`, `'mcp.resource_read'`… |
| `object_kind` / `object_id` / `object_name` | `'base'`, `'table'`, `'record'`, `'migration'` / clé concernée / nom au moment de l'acte |
| `payload` | sous-objet `mcp` : `{"tool", "session_id", "client": {"name","version","verified": false}, "params_shape", "returned", "truncated", "proposal_id"}` |
| `request_id` | identifiant de corrélation, propagé jusqu'au service du noyau |

Le détail s'interroge par `payload->'mcp'->>'tool'` ; la surface se trie par `WHERE surface = 'mcp'`.

### 13.2 Ce qui n'est jamais journalisé

Les paramètres d'un appel **contiennent des données** : un `filter` sur une adresse électronique, une valeur soumise à `lookup_records`. Les journaliser ferait du journal d'audit un second entrepôt de données personnelles, à rétention et lectorat différents de ceux des tables métier. D'où la règle : **on journalise la forme, pas le contenu.**

```json
"params_shape": {
  "table": "clients",
  "filter": [ { "field": "email", "op": "eq", "value_digest": "h:3f9a1c7d" } ],
  "sort": ["-_id"], "limit": 25, "expand": ["clients_id"]
}
```

`value_digest` est une empreinte HMAC tronquée, à clé d'instance (A25), qui corrèle deux appels portant la même valeur sans jamais la restituer. `lookup_records.value` est journalisée **uniquement** sous cette forme. Les `values` de `create_record` et `update_record` ne le sont pas du tout : les valeurs avant/après vivent dans `_basedb.record_revision`, qui porte déjà l'auteur et la date ; les dupliquer doublerait le volume et créerait deux vérités.

Les opérations de structure sont doublement tracées : la ligne d'audit **et** la ligne `_basedb.migration` avec `origin = 'mcp'`, `requested_by` l'utilisateur et `applied_by` le relecteur — deux personnes distinctes dans le cas normal, ce qu'on veut pouvoir lire six mois plus tard.

### 13.3 Détection

Journaliser ne détecte rien. Le modèle de menace inclut l'utilisateur légitime qui se sert d'un agent comme instrument d'exfiltration de masse, pas seulement l'agent retourné. Quatre seuils, par jeton et par fenêtre glissante, configurables par instance :

| Signal | Seuil par défaut | Action |
|---|---|---|
| Lignes lues par heure | 50 000 | Alerte au créateur du jeton et à l'administrateur |
| Tables distinctes lues par heure | 20 | Alerte |
| Rafale de `RESOURCE_NOT_FOUND` | 50 en 5 minutes | Alerte + suspension automatique du jeton — c'est la signature d'une énumération |
| Lignes écrites par heure | §6.4 | Suspension automatique du jeton |

**Ces quatre seuils sont évalués en différé**, par le même processus que le §6.4 : il relit `_basedb.audit_log` et `_basedb.security_log` par fenêtre glissante, puis alerte ou suspend. Aucun compteur n'est lu ni incrémenté en base à chaque appel, et aucune table de compteurs par fenêtre glissante n'existe (§6.4).

Les horaires atypiques sont rapportés dans le tableau de bord d'exploitation sans déclencher d'action automatique : le taux de faux positifs d'un tel critère ne justifie pas une suspension.

### 13.4 Rétention et accès au journal

Le journal d'audit MCP porte des identifiants de lignes, des formes de filtres, des empreintes de valeurs et des horaires d'activité : c'est une ressource sensible.

- Rétention : celle d'`audit_log` déclarée par A24 et portée par `_basedb.retention_policy`, soit 24 mois. Les lignes de surface MCP ne sont pas purgées avant.
- Sa lecture est une **opération réservée** au sens du chapitre 05 §8 — `is_instance_admin` ou `tenant_admin`, filtrée par tenant, la consultation étant elle-même journalisée — et n'est donc **jamais attribuable à un jeton d'intégration**, ni lisible depuis cette surface, qui n'expose d'ailleurs aucun outil d'accès au journal.

---

## 14. Erreurs

### 14.1 Forme

Un échec est rendu comme un résultat d'outil en erreur (`isError`), dont le contenu textuel est un objet JSON stable, compatible avec la charge utile d'erreur du chapitre 01 §13 (`code`, `object`, `target_name`, `label`, `details`, `suggestion`) :

```json
{ "code": "FIELD_UNKNOWN",
  "message": "Le champ demandé n'existe pas dans cette table.",
  "object": { "kind": "table", "name": "factures" },
  "invalid_params": ["filter.client"],
  "hint": "Champs de type lien disponibles : clients_id. Utilisez describe_table pour la liste complète.",
  "retryable": false }
```

Trois exigences : un `code` **du registre unique** (A23), en anglais et en majuscules ASCII (A2), identifiant machine et jamais message ; un `message` en français, affirmatif, **sans aucune interpolation d'une chaîne fournie par l'agent** (le nom fautif est dans `invalid_params`) ; un `hint` qui donne de quoi se corriger en un essai.

**Corollaire sur les `hint`** : un `hint` ne cite que des objets déjà visibles du porteur. Les champs lisibles d'une table qu'il peut lire, oui ; les tables d'une base qu'il ne peut pas lire, non. Cela vaut aussi pour les champs cités par un prédicat.

### 14.2 Deux étages de validation

L'ordre entre validation des paramètres et contrôle des droits est une décision, pas un détail d'implémentation : le valider dans le mauvais ordre transforme un message d'aide en oracle d'existence.

| Étage | Contenu | Accès au catalogue | Codes |
|---|---|---|---|
| 1 — protocolaire | Types JSON, cardinalités (§11.1), `op` dans l'énumération, `limit` entier, taille du message | **Aucun** | `PARAMETER_INVALID`, sans citer aucun objet |
| 2 — métier | Existence et lisibilité d'un champ, expansibilité, résolution d'un nom de table, coercition de valeur | Oui, **uniquement après** établissement du droit `read` sur l'objet (§3.2) | `FIELD_UNKNOWN`, `FIELD_NOT_EXPANDABLE`, `VALUE_INVALID`, `NAME_AMBIGUOUS`… |

Concrètement : un appel `list_records(base: "rh", table: "paie", expand: [12 champs])` présenté par un jeton sans aucun droit sur `rh` rend `PARAMETER_INVALID` (cardinalité, étage 1) **ou** `RESOURCE_NOT_FOUND` (étage 2), jamais une liste des champs lien réels de `paie`.

### 14.3 Règle d'absence, et honnêteté sur ce qu'elle ne couvre pas

Une ressource que le porteur n'a pas le droit de voir est **introuvable**, avec le même code et le même message que si elle n'existait pas : `RESOURCE_NOT_FOUND`. Jamais « vous n'avez pas le droit ».

L'exception, qui n'en est pas une : lorsque le porteur peut **lire** l'objet mais pas y écrire, `PERMISSION_DENIED` est légitime, car l'existence lui est déjà connue *par un chemin autorisé* ; l'agent comprend qu'il doit demander un droit plutôt que boucler sur un nom qu'il croit mal orthographié. La nuance décisive : « il a nommé l'objet » n'est **pas** un chemin autorisé — c'est ainsi qu'on devine.

**Le mécanisme, plutôt que la promesse.** L'indistinguabilité est obtenue par l'ordre des opérations :

1. Contrôle de quota (ne nomme aucun objet).
2. Validation protocolaire (étage 1, sans catalogue).
3. Résolution de l'objet et des droits dans le catalogue projeté — coût constant, aucune acquisition de verrou, aucune requête de données.
4. `RESOURCE_NOT_FOUND` rendu **avant** toute acquisition de verrou, toute requête de données et tout décompte.

Conséquence contraignante : `LOCK_UNAVAILABLE` ne peut jamais être rendu pour un objet que le porteur ne peut pas voir. Le recevoir prouverait l'existence de la base et l'activité de son propriétaire.

**Ce qui n'est pas tenu, et qu'il faut écrire** : l'égalisation stricte des temps de réponse n'est pas garantie. Une requête interrompue après cinq secondes ne provient que d'une table réelle et volumineuse ; `include_count` bascule d'exact à estimé à 50 000 lignes, révélant un ordre de grandeur. La fuite résiduelle est une information d'activité et de volumétrie, pas de contenu. Les mesures compensatoires sont la limitation de débit par jeton et l'alerte sur les rafales de `RESOURCE_NOT_FOUND` (§13.3).

### 14.4 Erreurs PostgreSQL

Une erreur PostgreSQL brute n'est **jamais** remontée, et la surface MCP n'en traduit aucune : **la traduction des `SQLSTATE` a lieu en un seul endroit, l'exécuteur de requêtes du noyau** (chapitre 10 §8.2), qui rend un code du registre unique. Les champs `message`, `detail`, `constraint`, `schema`, `table` et `column` d'une erreur PostgreSQL ne franchissent jamais la frontière du noyau, quelle que soit la surface.

Ce chapitre n'ajoute que deux contraintes de restitution, qui sont des règles de non-divulgation et non des règles de traduction :

- `LINK_TARGET_NOT_FOUND` est porté par le **champ source** ; il **ne distingue jamais** « ligne cible inexistante » de « ligne cible invisible », sans quoi l'écriture d'un lien devient un oracle sur une table masquée, et il ne nomme jamais la table cible.
- `LOCK_UNAVAILABLE` n'est rendu que pour un objet visible du porteur (§14.3).

Aucune erreur de transport n'est relayée telle quelle : ni corps de réponse, ni URL du back, ni identifiant interne autre que `request_id`.

### 14.5 Codes employés par la surface MCP

Tous ces codes appartiennent au registre unique d'A23 ; ceux marqués « registre » y sont définis par un autre chapitre et réutilisés tels quels, sans variante.

| Code | Déclencheur | Origine | `retryable` |
|---|---|---|---|
| `PARAMETER_INVALID` | Étage 1 : type, cardinalité, taille | 09 | non |
| `RESOURCE_NOT_FOUND` | Hors tenant, hors portée, base MCP désactivée, supprimé logiquement, non lisible, inexistant | registre (05) | non |
| `NAME_AMBIGUOUS` | Nom résolvant plusieurs objets visibles | 09 | non |
| `FIELD_UNKNOWN` | Champ inexistant, non lisible, ou non exposé aux agents | registre (05) | non |
| `FIELD_NOT_EXPANDABLE` | Champ lien dont la cible ou le champ d'affichage n'est pas lisible | 09 | non |
| `FIELD_NOT_WRITABLE` | Colonne système, champ formule, champ texte riche | registre (05) | non |
| `VALUE_INVALID` | Coercition impossible, contrainte de vérification | registre (04) | non |
| `MCP_OPERATION_EXCLUDED` | Nom réservé d'une opération exclue en v1 | 09 | non |
| `MCP_CASCADE_FORBIDDEN` | `on_delete: "cascade"` demandé par un agent | 09 | non |
| `TOKEN_READ_ONLY` | Écriture avec un jeton dont le rôle ne porte que `read` | 09 | non |
| `TOKEN_SUSPENDED` | Budget d'écriture ou seuil d'énumération dépassé | 09 | non |
| `TOKEN_INVALID` | Jeton inconnu, ou ne portant pas `mcp` dans ses surfaces autorisées | registre (05) | non |
| `TOKEN_EXPIRED` | Jeton connu, date d'expiration dépassée | registre (08) | non |
| `TOKEN_REVOKED` | Jeton connu, révoqué ; la session MCP est close | registre (08) | non |
| `SESSION_NOT_INITIALIZED` | Message reçu avant `initialize` | 09 | non |
| `CURSOR_INVALID` | Curseur altéré, périmé, ou lié à un autre jeton ou à une autre requête | registre (08) | non |
| `PROPOSAL_STALE` | `catalog_version` modifié depuis la proposition | 09 | non, reproposer |
| `PROPOSAL_EXPIRED` | Proposition passée à `expired` au-delà de 24 heures | 09 | non, reproposer |
| `TOO_MANY_OPEN_PROPOSALS` | Plus de 5 propositions `proposed` pour ce jeton et cette base | 09 | non |
| `PRECHECK_TIMEOUT` | Pré-vérification au-delà de 30 secondes | 09 | non |
| `AUTHORIZATION_REVOKED` | Revérification à l'approbation en échec (droits ou jeton) | 09 | non |
| `CONCURRENCY_CONFLICT` | Sérialisation ou interblocage | 09 | **oui** |
| `QUOTA_EXCEEDED` | Plafond d'appels ou requêtes simultanées | 09 | **oui**, `retry_after` |
| `INTERNAL_ERROR` | Tout le reste ; `request_id` seul | registre (05) | non |
| `PERMISSION_DENIED` | Objet lisible, action non autorisée (§14.3) | 09 | non |
| `IDEMPOTENCY_CONFLICT` | Même clé d'idempotence, empreinte de paramètres divergente (§6.3) | registre (08) | non |
| `LINK_TARGET_NOT_FOUND` | Écriture d'un lien vers une cible inexistante ou invisible | registre (08) | non |
| `LINK_ORPHAN_VALUES` | Valeurs orphelines à la pose d'une clé étrangère | registre (03) | non |
| `LINK_CROSS_DATABASE` | Cible d'un champ lien hors de la base de la source | registre (01) | non |
| `DUPLICATE_VALUE` | Violation d'unicité ; nomme le champ, jamais la valeur en conflit | registre (08) | non |
| `LOCK_UNAVAILABLE` | `lock_timeout` atteint sur un objet visible | registre (01) | **oui** |

---

## 15. Version, négociation, formats

- **Négociation de protocole.** Le serveur déclare une version produit dans `serverInfo` et **refuse** une version de protocole MCP inconnue, plutôt que de dégrader silencieusement.
- **Versionnement du catalogue d'outils.** Il suit la version du produit : ajouter un outil est mineur ; en retirer un, renommer un paramètre ou en resserrer le domaine est majeur, et documenté.
- **Identifiants.** `_id` est un `uuid` v7 attribué par le serveur (A9). Il **publie un instant de création** : un `_id` n'est donc jamais un secret, une restriction de champ posée sur `_created_at` ne vaut pas mesure de confidentialité, et c'est la raison pour laquelle l'identifiant d'un lien vers une table illisible est masqué (A16, §4.3). Le tri par défaut `["_id"]` est un **tri stable de pagination**, jamais un tri chronologique de confiance.
- **Dates et nombres.** Voir §11.2 : règles du noyau, communes à toutes les surfaces.

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Point d'entrée sur le noyau, au même rang que l'API REST, sans connexion PostgreSQL | Évite de publier en HTTP public le mode plan du moteur DDL, la file de propositions et l'identité effective | Adaptateur au-dessus de l'API REST publique |
| Relais stdio sur le poste, `POST /mcp` unique côté back, listé par le chapitre 08 | Le transport est un choix de déploiement, pas d'architecture | Serveur MCP autonome avec son propre accès aux données |
| Treize outils, statiques, étroits, nommés d'après ce qu'ils font ; lot 1 (six lectures) livré seul, les autres non déclarés | Surface énumérable ; pas de libellé utilisateur dans la description d'outil ; un agent ne planifie pas autour d'outils indisponibles | `execute_sql` en lecture seule ; un outil par table ; tout déclarer et désactiver |
| Aucun outil de suppression d'enregistrement en v1 | Évite un second mécanisme d'approbation, et ferme la chaîne de cascade PostgreSQL posée depuis l'interface (A14) | Demande de suppression différée avec son écran et son échéance |
| `_id` attribué par le serveur ; idempotence par `idempotency_key`, mécanisme du chapitre 08 dans `_basedb.idempotency_key` | Une collision de clé primaire fournie par l'agent est un oracle d'existence accessible avec le seul `create` ; un troisième mécanisme d'idempotence serait une troisième vérité | `_id` fourni par l'agent ; table d'idempotence propre au MCP |
| `filter`, `sort`, `expand`, `select` passent par la même résolution que la projection ; opérateurs et bornes d'expansion repris des chapitres 04 et 08 | Sans cela un prédicat lit par dichotomie tout champ masqué ; trois vocabulaires d'opérateurs rendraient OpenAPI et le MCP incohérents | Contraindre `select` seul ; vocabulaire d'opérateurs propre au MCP |
| Projection explicite de `tables`, `applications`, `relations`, `inverse_links`, valeur d'affichage et expansion | Une garantie écrite pour un seul chemin est annulée par les chemins voisins | Projeter le seul graphe des relations |
| Cible illisible : `link: null` dans la description, `{id: null, display: null, masked: true}` dans la valeur (A16) ; existence de la cible non masquable | Une forme unique sur toutes les surfaces ; l'UUIDv7 en clair divulguerait la date de création d'une ligne invisible | Identifiant en clair ; espace d'identifiants opaques propre aux permissions |
| Le bloc `link` projette le catalogue clé par clé : cible, colonne de clé étrangère, comportement à la suppression, colonne d'affichage de la cible | Ces quatre informations sont exactement ce qui manque à un agent pour joindre en SQL sans essai | Décrire le lien par son seul nom de colonne |
| Toute opération de structure produit une proposition inerte ; approbation et confirmation dans l'application, jamais dans la conversation | Ce qui est affiché au décideur doit être construit par le système, pas par le demandeur | Confirmation demandée à l'agent ; lien d'approbation remis à l'agent |
| `up_sql`/`down_sql` restitués comme tableaux ordonnés d'énoncés, plan à plusieurs étapes visible (A11, A12) | Le relecteur approuve ce qui sera réellement émis, `NOT VALID` puis `VALIDATE CONSTRAINT` compris | Un bloc de SQL unique présenté comme une transaction |
| Péremption sur le seul `base.catalog_version` ; revérification complète des droits, du jeton et de la pré-vérification à l'approbation | Reproposer coûte un appel ; l'intersection évaluée au seul appel laisserait appliquer la proposition d'un utilisateur rétrogradé | Empreinte par objet avec réapprobation du SQL ; contrôler la seule version de catalogue |
| `propose_*` exemptés du `statement_timeout` court (30 s), pré-vérification bornée à 50 violations | Sans dérogation, aucune proposition de lien n'aboutirait sur une grande table | 5 secondes partout |
| `ON DELETE CASCADE` refusé à la proposition, quel que soit le rôle | La cascade est exécutée par PostgreSQL (A14) : son volume n'est pas énumérable à l'instant de la décision, et l'autorisation est nominative, adossée à `cascade_grant` | Proposition autorisée avec double confirmation |
| Portée du jeton obligatoire et contrainte dure ; revalidation à chaque message, cache borné à 5 s, `tenant.authz_version` distincte de `base.catalog_version` | Une portée « recommandée » n'est appliquée nulle part ; une révocation de droit ne change pas la version de catalogue, et une session stdio vit des heures | Portée vérifiée outil par outil ; invalidation par `catalog_version` seule |
| Deux étages de validation, le second après établissement du droit `read` | Un message d'aide qui énumère des champs avant le contrôle des droits est un oracle de structure | Valider les paramètres puis contrôler les droits |
| Aucune traduction de `SQLSTATE` ici : elle a lieu dans l'exécuteur de requêtes du noyau ; codes du registre unique, en anglais (A2, A23) | Cinq traductions concurrentes produiraient cinq jeux de codes pour les mêmes conditions | Table de traduction et codes propres à la surface |
| Journal : une ligne par appel d'outil et par lecture de ressource ; forme du filtre, jamais son contenu ; empreinte HMAC des valeurs | Sans cela le journal devient un second entrepôt de données personnelles | Journaliser les paramètres normalisés tels quels |
| Marqueurs `field.expose_to_agents` et `base.mcp_enabled`, indépendants des permissions | Le contenu part dans le contexte d'un modèle tiers ; les droits de l'utilisateur ne suffisent pas à décider ce qui peut sortir | S'en remettre aux seules permissions |
| Budget d'écriture par jeton, suspension automatique **décidée en différé depuis `_basedb.security_log`**, annulation en masse depuis `record_revision` | L'écrasement ligne à ligne détruit l'information aussi sûrement qu'une suppression ; un compteur lu et incrémenté à chaque appel mettrait une écriture en base sur le chemin nominal | Compter sur le seul quota d'appels ; table de compteurs par fenêtre glissante |
| Noms physiques et `join_sql` exposés par défaut, réglage `mcp_expose_physical_names` pour les supprimer | Exploiter les données en SQL est la promesse centrale du produit | Exposition désactivée par défaut |
| Ni `subscribe` sur les ressources, ni mode distant en v1 | L'un exige un canal serveur → client à travers le relais et maintiendrait vivante une vue projetée qu'une révocation n'invalide pas ; l'autre exige OAuth 2.1 complet pour un bénéfice nul sur un usage poste de travail | Notification sur incrément de version de catalogue ; MCP distant à jeton partagé |

---

## Risques et limites connues

1. **L'injection de prompt n'est pas filtrable.** Un agent retourné lit ce que l'utilisateur pouvait lire et, si le jeton écrit, écrase ce qu'il pouvait écrire. Les bornes sont le périmètre d'autorité, les budgets, la suspension automatique et l'historique — pas un filtrage de texte.
2. **Fuite résiduelle par le temps et la classe d'erreur.** L'ordre des opérations de §14.3 supprime les fuites franches, pas l'inégalité des temps de réponse. Reste une information d'activité et de volumétrie.
3. **L'existence d'une table cible n'est pas masquable.** La convention `<table_cible>_id` (A7) inscrit le nom de la cible dans celui de la colonne source, y compris quand la valeur du lien est masquée.
4. **`_id` publie un instant de création.** Une restriction de champ sur `_created_at` n'est donc pas une mesure de confidentialité.
5. **Les ressources MCP peuvent être périmées** après une migration appliquée, faute d'abonnement en v1. `describe_table` fait foi ; le risque est un agent qui raisonne sur une carte ancienne.
6. **Le budget d'écriture est grossier et en retard** : il peut suspendre un agent légitime en pleine reprise de données, et, la décision étant prise en différé par le drain (§6.4), un agent dépasse son budget de ce qu'il écrit pendant le retard du drain. La levée est immédiate, l'interruption est réelle.
7. **La file de propositions est un goulot humain.** Le plafond de §7.8 protège le relecteur d'un agent en boucle ; il ne rend pas la revue plus rapide.
8. **Le jeton vit sur un poste de travail.** L'hygiène de §9.2 ne supprime pas le vol de poste ; l'expiration obligatoire, la portée et la revalidation par message en bornent l'effet.
9. **Une base exposée en MCP reste lisible en SQL direct.** `expose_to_agents` et `field_permission` ne gouvernent que les surfaces du produit ; un accès `psql` à la base d'accueil les contourne entièrement (§12.4).
10. **Dépendances externes assumées** : bornes d'expansion, format du curseur et idempotence des données (08), table des phrases d'effet (03), annulation en masse des écritures d'un acteur sur une fenêtre temporelle (07 §12.3). Si l'une n'est pas livrée, la propriété correspondante tombe.

---

## Questions ouvertes

1. **Valeurs par défaut des budgets et seuils** (500 lignes écrites par heure et par jeton, 200 par table ; 50 000 lignes lues par heure ; 20 tables distinctes ; 50 `RESOURCE_NOT_FOUND` en 5 minutes ; 5 propositions ouvertes par jeton et par base) : proposées ici, à confirmer. Elles sont configurables par instance, mais leur défaut détermine l'expérience du premier utilisateur.
2. **Canal de notification hors application** pour la file de propositions et pour les alertes de suspension : notification interne seule, courriel ou webhook. La v1 fonctionne avec la seule notification interne.
3. **`statement_timeout` de 5 secondes pour la surface MCP** : valeur retenue par défaut, à confronter aux latences mesurées sur les premières bases réelles, notamment pour `list_records` avec `include_count` exact.
