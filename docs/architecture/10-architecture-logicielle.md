# 10 — Architecture logicielle : monorepo, noyau, pools, tests

## Rôle de ce chapitre

Les chapitres précédents décrivent *quoi* écrire dans PostgreSQL. Celui-ci décrit *d'où* l'écriture part, par quelle connexion, dans quelle transaction, sous quel délai — et surtout d'où elle ne peut pas partir. Il fixe la structure du dépôt, le contenu du noyau de la phase 2, les frontières que le code ne doit pas pouvoir franchir, le comportement du produit en exploitation réelle et le mécanisme qui rend chacune de ces frontières vérifiable par une machine plutôt que par de la bonne volonté.

Un principe gouverne l'ensemble : **une règle d'architecture qui n'est pas exécutable en intégration continue n'est pas une règle, c'est un souhait.** Chaque interdit énoncé ici est assorti du contrôle qui le fait respecter.

Un second principe, opérationnel : **tout ce qui attend doit avoir une borne.** Attente de verrou, acquisition de connexion, requête, opération complète, file : chacune porte ici un chiffre, dérivé d'un autre plutôt que saisi deux fois.

---

## 1. Monorepo : paquets, responsabilités, dépendances

### 1.1 Outillage, tranché

| Besoin | Choix | Pourquoi ce choix, alternative rejetée |
|---|---|---|
| Gestionnaire de paquets | **pnpm 10**, workspaces, `node-linker=isolated` | L'isolation stricte des `node_modules` empêche l'import *non déclaré* : un paquet absent du `package.json` d'une application n'est pas résolvable. Premier filtre, pas garantie suffisante (§2.4). *Rejeté* : npm workspaces, dont le hoisting rend tous les paquets importables partout. |
| Orchestration | **Turborepo**, tâches `build`, `typecheck`, `lint`, `test:unit`, `test:int`, `test:vol`, `test:panne` | Cache par empreinte du contenu, graphe de tâches dérivé du graphe de dépendances. *Rejeté* : Nx, plus lourd que ce dépôt ne le justifie. |
| Compilation | **TypeScript 5.x**, `tsc` en références de projets, ESM strict, cible Node 22 LTS | Une seule chaîne, des types exacts entre paquets, pas d'empaqueteur à déboguer côté serveur. Le front conserve la chaîne de Next.js et déclare les paquets internes en `transpilePackages`. |
| Qualité | **Biome** (format + lint) et **dependency-cruiser** (graphe) | Biome ne sait pas exprimer une règle de frontière entre paquets ; dependency-cruiser le fait et échoue en CI. |
| Tests | **Vitest** ; **Testcontainers** pour PostgreSQL 16 ; **fast-check** pour les propriétés | Voir §7. |

### 1.2 Les paquets

| Paquet | Responsabilité en une phrase | Dépendances d'exécution autorisées |
|---|---|---|
| `@basedb/contracts` | Types, formes de charges utiles publiques et **registre des codes d'erreur** (A23) — le seul vocabulaire partagé entre le serveur, le front et le SDK. | bibliothèque de validation de schémas |
| `@basedb/naming` | Slugification, validation des identifiants, quoting, motifs des noms dérivés — tout le contenu normatif du chapitre 01 ; fonctions pures, aucune entrée-sortie. | aucune |
| `@basedb/catalog-schema` | Description Drizzle des tables de `_basedb` et de `_basedb_local`, et fichiers SQL numérotés des migrations de catalogue ; aucune logique. | Drizzle |
| `@basedb/core` | **Le noyau** : catalogue, moteur DDL, migrations, RBAC, sessions et jetons, lecture-écriture des enregistrements, transactions, pools, traduction des erreurs, drain, ordonnanceur. Seul paquet qui déclare le pilote PostgreSQL. | pilote PostgreSQL, Drizzle, validation de schémas, UUIDv7 |
| `@basedb/http` | Intergiciels HTTP partagés : extraction du justificatif, appel à `ouvrirContexte`, traduction erreur métier → réponse HTTP, en-têtes de corrélation, limitation de débit. Rien d'autre. | Hono |
| `@basedb/auth` | Mots de passe, danse OIDC, cookies et jeton d'accès court — **le mécanisme**, dont le chapitre 13 fixe les règles. Produit un justificatif que le noyau vérifie ; ne touche jamais la base. | hachage de mot de passe, client OIDC |
| `@basedb/ai` | Abstraction des fournisseurs OpenAI, Anthropic et Mistral — **le transport**, dont le chapitre 12 fixe les cas d'usage, les modèles admissibles et les quotas. Reçoit la clé en paramètre, ne la lit jamais. | clients HTTP des fournisseurs |
| `@basedb/sdk` | Client HTTP typé dérivé de `@basedb/contracts`. | aucune (`fetch`) |
| `apps/api` | Point d'entrée HTTP : routage, sérialisation, OpenAPI, émetteur de webhooks, routes d'authentification. | Hono |
| `apps/mcp` | Point d'entrée MCP : déclaration des outils, transports stdio et Streamable HTTP. | Hono, SDK MCP |
| `apps/web` | Interface du chapitre 11 ; structure du paquet, état et interdiction des données simulées au §1.5 ci-dessous. | Next 15, React, Tailwind 4, shadcn/ui, Zustand |
| `tooling/*` | Configurations partagées (TypeScript, Biome, Vitest, dependency-cruiser). | — |

Le cadrage demande « un paquet de types partagé » ; il y en a ici sept hors applications, et chaque ajout se justifie par ce qu'il retire d'ailleurs. `@basedb/naming` est **sans dépendance et sans entrée-sortie** : tests de propriétés instantanés, exécution sous locale forcée triviale (§7.4). `@basedb/http` porte l'intergiciel d'authentification, **partagé par deux applications**. `@basedb/auth` et `@basedb/ai` isolent ce que le §2.2 exclut du noyau : cryptographie et redirections d'un côté, appels réseau sortants de l'autre. `@basedb/sdk` porte la pagination par curseur, les erreurs typées et la propagation de `X-Request-Id`. `@basedb/catalog-schema` est séparé pour que `drizzle-kit` s'exécute sur un paquet sans logique.

### 1.3 Graphe autorisé

```
@basedb/naming ──────────────┐
                             ├──> @basedb/core ──> @basedb/http ──> apps/api
@basedb/catalog-schema ──────┤                                  └─> apps/mcp
                             │                        @basedb/auth ──┤
@basedb/contracts ──> @basedb/sdk ──> apps/web        @basedb/ai ────┘
        └──────────────────> (tous les paquets)
```

Sept interdits, chacun vérifié par une règle `dependency-cruiser` qui casse la CI :

1. `apps/web` **ne dépend jamais** de `@basedb/core`, de `@basedb/http`, de `@basedb/auth` ni de `@basedb/ai`, ni directement ni transitivement. Le front parle HTTP, point. Sans cette règle, une action serveur Next.js finirait par ouvrir une connexion PostgreSQL et contourner la couche de permissions.
2. Le pilote PostgreSQL n'est déclaré que par `@basedb/core`. Aucun paquet de `apps/*`, ni `@basedb/auth`, ni `@basedb/ai` ne déclare de pilote de base ni de client SQL — vérifié par liste blanche de dépendances d'exécution par paquet (colonne de droite du §1.2), et non par la seule résolution de modules.
3. `@basedb/naming` ne dépend de rien.
4. `@basedb/auth` et `@basedb/ai` ne dépendent que de `@basedb/contracts` : ils reçoivent en paramètre ce dont ils ont besoin (justificatif, clé de fournisseur), ils ne vont pas le chercher.
5. Aucun import profond : la carte `exports` de chaque paquet n'expose que sa racine. `@basedb/core/src/db/pool` n'est pas atteignable, même en connaissant le chemin.
6. `apps/api` et `apps/mcp` ne se référencent jamais l'une l'autre. Ce qu'elles partagent passe par `@basedb/http`.
7. `apps/web` n'importe aucun module dont le chemin contient `fixtures`, `mocks` ou `msw` hors fichiers de test (§1.5).

### 1.4 Hono plutôt que Fastify

**Décision : Hono**, avec l'adaptateur Node officiel, et les intergiciels communs dans `@basedb/http`.

Trois raisons, dans l'ordre de leur poids. Hono manipule les objets `Request`/`Response` standard : le serveur MCP en transport « Streamable HTTP » réutilise le même arbre de routage et les mêmes intergiciels que l'API. Les tests d'API s'exécutent **sans ouvrir de socket**, ce qui supprime la gestion de ports et rend la suite parallélisable sans coordination. Enfin, notre routage est dynamique (`/api/v1/:base/:table`) et notre spécification OpenAPI est produite depuis le catalogue : le modèle « schéma d'abord » de Fastify, son principal atout, ne sert à rien ici.

*Alternative rejetée* : Fastify, plus rapide sous charge brute et doté d'un écosystème de greffons plus mature — briques qu'il faudra ici prendre dans un écosystème plus jeune ou écrire. Refus accepté parce que l'API de basedb est dominée par le temps PostgreSQL, jamais par le temps de routage.

### 1.5 `apps/web` : structure, état, absence de données simulées

Le chapitre 11 fixe l'ergonomie de l'interface : grille, édition en ligne, vue détail, éditeur de schéma, états vides et états d'erreur. Ce qui suit fixe la structure du paquet et ses règles de dépendance, et rien d'autre.

| Emplacement | Contenu | Règle |
|---|---|---|
| `app/` | Routes Next.js 15, App Router | Les lectures de page se font en composants serveur, via `@basedb/sdk` |
| `components/ui/` | Composants shadcn/ui générés | Jamais modifiés à la main hors mise à jour explicite de la primitive |
| `components/` | Composants composés du produit (grille, vue détail, éditeur de schéma) | Ne connaissent que les types de `@basedb/contracts` |
| `lib/api/` | **Seul** point d'accès réseau ; enveloppe `@basedb/sdk` | Aucun `fetch` ailleurs dans `apps/web` |
| `stores/` | Zustand | **État d'interface éphémère uniquement** |
| `styles/` | Tailwind 4, tokens | — |

**Zustand ne détient jamais de données serveur, ni aucun état destiné à survivre à la session.** Il porte la sélection courante, l'ouverture des panneaux, le brouillon d'une cellule en cours d'édition. Une présentation enregistrée — colonnes visibles, largeurs, filtres, tri — est une **vue enregistrée** du catalogue (`_basedb.view_def`), pas un état de client. Les données proviennent du rendu serveur ; une mutation client passe par `lib/api/` puis invalide par `router.refresh()`. *Alternative rejetée* : TanStack Query, qui dupliquerait en v1 le cache que le rendu serveur fournit déjà.

**Authentification.** Le mécanisme — cookie de session, échange contre un jeton d'accès court, en-tête anti-CSRF — est fixé par le chapitre 13 et exposé par le chapitre 08 ; `apps/web` s'y conforme sans le redéfinir. Une seule règle relève de ce chapitre, parce qu'elle porte sur le graphe de dépendances : **il est interdit que `apps/web` détienne un jeton d'intégration**, un jeton de service partagé court-circuitant l'identité de l'utilisateur et donc tout le RBAC. Contrôle : aucune variable d'environnement de `apps/web` ne porte le préfixe des jetons, et `@basedb/sdk` n'expose aucune méthode d'authentification par jeton côté rendu serveur.

**« Aucune donnée mockée ou en dur »**, exigence du cadrage, rendue exécutable par trois contrôles : l'interdit 7 du §1.3 ; une règle de lint qui refuse dans `apps/web/src` tout littéral de tableau d'objets de plus de deux éléments portant les clés d'un type de `@basedb/contracts` ; un test de bout en bout qui démarre l'API sur une base vide et exige que la grille, la vue détail et l'éditeur de schéma affichent leurs **états vides obtenus de l'API**.

---

## 2. Le noyau : contenu, frontière, inviolabilité

### 2.1 Ce que contient `@basedb/core` en phase 2

| Module | Contenu |
|---|---|
| `catalog` | Lecture et écriture de `_basedb` ; cache du schéma par base, borné et évincé (§4.4) ; chargement en une transaction `REPEATABLE READ, READ ONLY`. |
| `ddl` | Planification d'une opération de schéma en **étapes** (§3.4, A11), ordonnancement — dont l'ordre table cible → contrainte —, **politique d'index** (§3.4.4), construction du SQL qualifié et quoté, contrôle des données avant pose de contrainte. Le contenu SQL de chaque étape relève du chapitre 03. |
| `migration` | Machine à états persistée sur `_basedb.migration` : plan, `step`, `status`, bail, `error_code`, `error_sample`, clé d'idempotence, reprise. |
| `records` | Filtres, tri, pagination par curseur, expansion des liens, **références inverses** (`listerReferents`). Il ne produit **ni historique ni événement sortant** : la capture est faite par déclencheur (A10). |
| `rbac` | Permissions effectives d'un acteur, filtrage des champs, décision unique d'autorisation. Sa signature comporte un **prédicat de lignes** constamment vrai (A20), que le constructeur de requêtes émet. |
| `identity` | Propriétaire de `_basedb.session` et `_basedb.api_token` : création, vérification, révocation, et **seule fabrique du contexte de requête** (§2.4). |
| `naming` | Réexport de `@basedb/naming` plus l'allocation de noms (registre `_basedb.physical_name`, verrou `name_allocation`, boucle de suffixe), qui, elle, touche la base. |
| `errors` | Taxonomie et traduction SQLSTATE → code du registre (§8). |
| `tx` | Ouverture, propagation et fin des transactions ; échéances ; politique de rejeu. |
| `runtime` | Pools, amorçage, réconciliation, **drain** des tampons de capture, ordonnanceur interne. |

### 2.2 Ce que le noyau ignore délibérément

HTTP et ses verbes, les en-têtes, les codes de statut, les cookies et leur signature, la danse OIDC, la vérification d'un mot de passe, la négociation de contenu, la pagination *HTTP* (le curseur, lui, est du noyau), la sérialisation de transport, le rendu, la localisation des messages, **l'émission effective des webhooks**, les appels aux fournisseurs d'IA. Le noyau ne connaît ni `req` ni `res`, ne lance pas de minuterie liée à une requête, et ne journalise pas d'accès — il produit des événements que l'adaptateur journalise.

Il ignore les mécanismes d'authentification, mais **il possède les sessions et les jetons** : ce sont des lignes de `_basedb`, et l'instantané de permissions qu'ils portent est la matière même du RBAC. La ligne de partage est écrite au §2.4, verrou 3.

Conséquence structurante : **le noyau n'expose pas de connexion, il expose des opérations.** Une opération est une action nommée du domaine (`creerTable`, `ajouterChampLien`, `listerEnregistrements`, `listerReferents`, `proposerMigration`, `appliquerMigration`, `ouvrirContexte`…), qui prend un contexte en premier argument et rend soit un résultat, soit une erreur typée. Il n'existe aucun moyen, depuis un adaptateur, d'exécuter une chaîne SQL arbitraire.

### 2.3 Les événements sortants ne sont pas produits par le noyau

Une écriture d'enregistrement doit déclencher des webhooks. Si le noyau les émettait, il connaîtrait HTTP et deviendrait non rejouable ; s'il les inscrivait lui-même, une écriture SQL directe n'en produirait aucun. **Conformément à A10, ce sont des déclencheurs PostgreSQL qui inscrivent révisions et événements sortants dans les tampons de `_basedb_local`, dans la transaction qui écrit la donnée** ; le drain les transfère vers `_basedb.change_event` ; un émetteur, hors noyau, consomme ce flux.

Trois propriétés en découlent : aucun webhook n'est envoyé pour une transaction annulée, aucun n'est perdu si le processus meurt, et une opération peut être rejouée sur erreur de sérialisation sans avoir déjà provoqué d'effet extérieur. L'émetteur vit dans `apps/api` et **possède sa propre boucle de relance.** Le détail de la livraison, de la signature et des tentatives relève du chapitre 08 ; la capture, du chapitre 07.

### 2.4 Pourquoi les trois points d'entrée ne peuvent pas contourner le noyau

C'est la garantie architecturale du point d'application unique des permissions. Elle ne repose pas sur une promesse mais sur six verrous, **du plus mécanique au plus humain**.

1. **Carte `exports` fermée.** `@basedb/core` n'exporte que ses opérations. Les pools, le constructeur SQL et l'exécuteur ne figurent dans aucun chemin exporté ; un adaptateur ne dispose d'aucun objet représentant une connexion.
2. **Contexte non falsifiable.** Chaque opération exige un contexte que seul le module `identity` sait construire. Le type est opaque — aucune forme littérale ne le satisfait, il porte une marque interne — et il transporte l'instantané des permissions effectives. Un adaptateur ne peut ni l'inventer ni le modifier.
3. **L'adaptateur n'affirme aucune identité : il transmet un justificatif que le noyau vérifie.** Le noyau expose une unique fabrique, `ouvrirContexte(justificatif)`, où le justificatif est un identifiant de session opaque ou une empreinte de jeton. Le noyau seul les confronte à `_basedb.session` et `_basedb.api_token`, calcule les permissions et scelle le contexte. Restent hors noyau, dans `@basedb/auth` : la danse OIDC, la vérification du mot de passe, le cookie et sa signature — qui produisent l'appel à `creerSession`. Un adaptateur qui « sait » qui est l'utilisateur ne peut rien en faire sans un justificatif que le noyau reconnaît.
4. **Liste blanche de dépendances d'exécution.** Aucun paquet de `apps/*` ne déclare de pilote de base ni de client SQL (§1.3, interdit 2). L'isolation pnpm empêche l'import non déclaré ; cette liste, vérifiée en CI, empêche la déclaration.
5. **Test de complétude d'autorisation.** L'inventaire des opérations exportées est confronté à une table déclarative `opération → action RBAC → portée`. Une opération absente **fait échouer la suite de tests** : c'est ce qui empêche d'ajouter une opération sans droit associé, mode de fuite le plus probable.
6. **Revue obligatoire.** Un fichier `CODEOWNERS` impose un second relecteur sur `packages/core/src/rbac`, sur `packages/core/src/identity`, sur la carte `exports` et sur les règles `dependency-cruiser`. Dernier verrou, le plus faible, et c'est pourquoi il n'est pas le premier.

---

## 3. Connexions, pools, chemins d'écriture

### 3.1 Trois pools, deux connexions hors pool

Le cadrage impose une frontière : catalogue d'un côté, données de l'autre, pour permettre une séparation physique ultérieure sans refonte. Nous la tenons, et nous **dédoublons le côté données en un pool de service et un pool DDL**, sur la même instance et le même rôle, avec des réglages différents : une étape de migration prend des verrous lourds et peut durer ; si elle puise dans le pool de service, elle en épuise les connexions et fait tomber les lectures.

Les trois noms sont ceux du chapitre 01 §10.3 — `catalogue`, `donnees`, `ddl` — et **toute opération de structure emprunte le pool `ddl`**. Ce chapitre porte le dimensionnement et les délais ; le chapitre 01 les paramètres sémantiques de connexion ; le chapitre 03 les écarts par étape de migration.

| Pool | Taille min→max | Délai d'acquisition | File max | `statement_timeout` | `lock_timeout` | `idle_in_transaction_session_timeout` | Usage |
|---|---|---|---|---|---|---|---|
| `catalogue` | 2 → 6 | 5 s | 50 | 5 s | 3 s | 15 s | Lecture et écriture de `_basedb`, journal de migration, drain |
| `donnees` | 4 → 20 | 2 s | 200 | **20 s** (`BASEDB_REQUEST_TIMEOUT_MS`) | 5 s | 30 s | DML sur les schémas `b_*` et sur `_basedb_local` |
| `ddl` | 0 → 2 | 15 s | 10 | **5 s par défaut, relevé étape par étape** (§3.4.3) | 3 s | 60 s | Toute émission de DDL |

Deux connexions vivent **hors pool** :

| Connexion | Réglages | Rôle |
|---|---|---|
| Écoute | `search_path=''`, `keepalives=1`, `keepalives_idle=30`, `keepalives_interval=10`, `keepalives_count=3` | `LISTEN basedb_catalog` (§4.4), `basedb_drain` (réveil du drain, chapitre 07 §11.4) et `basedb_live` (temps réel, chapitre 16 §3) ; reconnexion avec un délai croissant |
| Contrôle | `search_path=''`, `lock_timeout=3s`, `statement_timeout=BASEDB_MIGRATION_STATEMENT_TIMEOUT_MS`, `idle_in_transaction_session_timeout=0` | Étapes 2 à 8 du démarrage (§9.2), verrou `catalog_migration`, et **chien de garde** : `pg_cancel_backend` sur le backend DDL au-delà du budget d'étape, `pg_terminate_backend` 30 s plus tard |

Les paramètres sémantiques — `search_path=''`, `TimeZone=UTC`, `DateStyle`, `IntervalStyle`, `client_encoding` — sont ceux du chapitre 01 §10.3, posés **dans le paquet de démarrage de la connexion**. S'y ajoute un `application_name` distinct par pool, pour que `pg_stat_activity` soit lisible. Une connexion qui ne satisfait pas l'assertion de contrat (`CONNECTION_CONTRACT_BROKEN`) est détruite, pas utilisée.

Le `lock_timeout` du pool `ddl` demande une lecture exacte : **il borne l'attente derrière autrui, pas la détention par nous-mêmes.** Sans lui, un `ALTER TABLE` qui attend derrière une longue lecture bloque toutes les requêtes arrivant ensuite sur la même table, lectures comprises. Avec lui, l'attente échoue vite, le `55P03` est traduit en `LOCK_UNAVAILABLE` et l'étape est réessayée. Ce qui borne la durée pendant laquelle *nous* tenons un verrou, c'est le découpage en étapes courtes du §3.4, le `statement_timeout` par étape et le chien de garde.

Le dépassement du délai d'acquisition ou de la profondeur de file produit `SERVICE_UNAVAILABLE` (503, `Retry-After`), jamais une attente indéfinie : c'est la différence entre un service qui se dégrade et un service qui enfle en mémoire pendant que les clients partent.

### 3.2 Dimensionnement des connexions et mandataire externe

Arithmétique par instance : 6 + 20 + 2 = 28 connexions de pool, plus l'écoute, le contrôle et l'ordonnanceur = **31**. Trois répliques tiennent sous le `max_connections` de 100 d'un PostgreSQL managé, réserve superutilisateur comprise. D'où des tailles volontairement modestes : le cadrage interdit d'écrire dans `postgresql.conf`, donc `max_connections` est un plafond subi, pas un paramètre.

**Contrôle de préflux au démarrage** (étape 2 du §9.2) : lire `max_connections`, `superuser_reserved_connections` et `rolconnlimit` du rôle courant, puis refuser de démarrer si

`(somme des maxima des pools + 3) × BASEDB_EXPECTED_REPLICAS > max_connections − superuser_reserved_connections − 5`

Découvrir cette limite au démarrage est une erreur de configuration ; la découvrir sous charge est une panne où toutes les répliques se refusent mutuellement le service en `53300`.

**Mandataire de connexions externe.** Si un mandataire est interposé, il doit être **en mode session** : le mode transaction casse `LISTEN`/`NOTIFY`, les verrous consultatifs de session et les réglages posés à l'ouverture. Contrainte écrite dans la documentation d'exploitation et vérifiée au démarrage par un contrôle faible mais utile : une connexion du pool `catalogue` pose une variable de session témoin, la relit sur la *même* connexion après un aller-retour, et journalise un avertissement si elle a disparu.

### 3.3 Le chemin d'écriture d'un enregistrement

C'est le chemin le plus fréquent du produit, et c'est lui qui décide si la frontière de pools a une portée réelle ou décorative. Une écriture doit produire de façon atomique la ligne de données **et** sa trace — révision, et événement sortant si la table est abonnée —, or cette trace appartient au catalogue, donc à l'autre côté de la frontière. **La transaction d'écriture ne la franchit jamais** : conformément à A9 et A10, la trace est écrite par déclencheur dans le schéma technique colocalisé `_basedb_local`, puis drainée.

| Espace | Emplacement | Contenu |
|---|---|---|
| `b_<tenantId>_<base>` | avec les données | les tables utilisateur |
| `_basedb_local` | **avec les données**, même base aujourd'hui, même instance demain | fonctions partagées et **tampons de capture** `revision_buffer`, `change_event_buffer` |
| `_basedb` | catalogue | `record_revision` (chapitre 07), `change_event`, `audit_log` — destinations définitives, lues par l'interface et l'API |

Déroulé d'une écriture :

1. Le contexte est ouvert, l'autorisation résolue — prédicat de lignes compris (A20) —, la version de schéma figée (§4.4).
2. Une transaction unique s'ouvre sur **une** connexion du pool `donnees`.
3. Le DML est émis sur `b_*`. Les déclencheurs de la table appellent `_basedb_local.capture_v1()`, qui écrit dans les tampons **dans la même transaction**.
4. Validation. À cet instant, tout est cohérent et rien n'est encore visible à l'extérieur.
5. Le **drain** — tâche du noyau, hors transaction, sous le verrou consultatif de classe `drain` — déverse les tampons dans `_basedb` par lots, par le pool `catalogue`, et renseigne `drained_at`. Il s'exécute immédiatement après validation en mode opportuniste, et périodiquement en filet (§9.4).

Le noyau n'insère donc **aucune ligne de trace lui-même** : il pose le contexte de session que le déclencheur lit (acteur, jeton, opération en lot), et c'est tout. D'où la promesse centrale du cadrage : un `UPDATE` écrit à la main dans psql produit la même révision qu'une écriture d'API, y compris pour les lignes supprimées en chaîne par une cascade PostgreSQL (A14), que `pg_trigger_depth() > 1` distingue.

Trois conséquences, toutes voulues. Le jour de la séparation physique, **le chemin d'écriture ne change pas d'une ligne** : le drain devient inter-instances, c'est tout. Une opération n'a produit aucun effet hors base tant que sa transaction n'est pas validée, ce qui la rend rejouable (§4.3). Enfin, une partition manquante dans `_basedb` (§9.4) fait échouer le drain, pas l'écriture de l'utilisateur.

Prix à payer, assumé : la lecture de l'historique doit tenir compte des lignes non encore drainées, ce que le chapitre 07 spécifie. Ce sont deux lectures sans transaction, sur deux pools, dans aucune jointure : l'interdit du §3.5 est respecté. Le retard du drain est borné par sa période et surveillé (§8.5).

**L'entrée d'audit n'emprunte pas ce chemin.** `_basedb.audit_log` consigne des actes — structure, permissions, administration —, pas des écritures de données, dont la trace est la révision. Elle est écrite sur le pool `catalogue`, dans sa propre transaction, comme le journal de migration (§3.4.2).

### 3.4 Le chemin d'une opération de schéma

#### 3.4.1 Une machine à états persistée, pas une transaction unique

Conformément à A11, une opération de schéma est **une suite d'étapes numérotées, chacune dans sa propre transaction, chacune idempotente et rejouable**, dont l'avancement est persisté hors des transactions qu'il décrit.

C'est ce qui permet d'utiliser les seules formes de DDL qui ne bloquent pas une table volumineuse : `ADD CONSTRAINT … NOT VALID` puis `VALIDATE CONSTRAINT` n'a d'intérêt que si les deux ordres sont dans deux transactions distinctes, et `CREATE INDEX CONCURRENTLY` ne s'exécute pas dans un bloc transactionnel. Une transaction unique tiendrait de plus ses verrous `ACCESS EXCLUSIVE` jusqu'au `COMMIT` : à dix millions de lignes, poser une clé étrangère immobiliserait les deux tables pendant toute la durée du scan.

**L'exigence « DDL et écriture du catalogue dans la même transaction » est tenue étape par étape** : aucune étape ne laisse un objet physique sans sa description, ni une description sans son objet. L'écriture de catalogue qui décrit l'effet physique d'une étape est validée dans la transaction de cette étape, sur la même connexion du pool `ddl`, et l'état intermédiaire est représenté par les codes de `_basedb.physical_state`. Ce qui rend l'ensemble atomique **du point de vue des lecteurs**, c'est `definition_state` : une base, une table ou un champ est créé en `pending`, invisible du cache de schéma, de l'API, de l'interface et du MCP, et ne passe `active` que dans la transaction de la dernière étape. Un plan interrompu ne laisse jamais un champ à moitié utilisable — il laisse un champ inexistant pour tout le monde sauf pour l'écran d'administration des migrations.

#### 3.4.2 Le journal de migration n'est jamais écrit dans la transaction qu'il décrit

Règle absolue. Si le DDL échoue, la transaction est abandonnée et toute instruction suivante rend `25P02` : il serait impossible d'y écrire le statut `failed`, le diagnostic PostgreSQL et l'échantillon de lignes fautives, et le `ROLLBACK` effacerait jusqu'à la trace de la tentative.

Donc : `_basedb.migration` est écrit **sur une connexion du pool `catalogue`, dans ses propres transactions, avant et après** chaque étape. Le passage en `applying` — avec `sequence`, `executor_id` et `lease_until` — est validé avant d'ouvrir la transaction de l'étape ; `step` et le statut terminal (`applied`, `failed`, `interrupted`) après son issue. C'est la seule entorse à la règle « une opération, une transaction, un pool » du §3.5 : le journal n'est pas l'opération, il est son procès-verbal.

Corollaire : **`error_sample` est collecté *avant* la tentative de pose de contrainte**, par une anti-jointure, et non après l'échec — après, il n'y a plus de transaction utilisable.

```sql
SELECT s."_id", s."clients_id"
FROM "b_t4z56fq_crm"."factures" s
LEFT JOIN "b_t4z56fq_crm"."clients" c ON c."_id" = s."clients_id"
WHERE s."clients_id" IS NOT NULL AND c."_id" IS NULL
LIMIT 50;
```

Si elle rend au moins une ligne, la migration est refusée **avant toute modification**, avec `LINK_ORPHAN_VALUES`, le nombre total de lignes fautives et jusqu'à cinquante exemples. L'utilisateur voit ses données, jamais une erreur serveur.

#### 3.4.3 Étapes, délais et budget

| Nature d'étape | Transaction | `statement_timeout` | Reprise |
|---|---|---|---|
| Contrôle (anti-jointure, comptage) | `READ ONLY` | 30 s | Rejouable sans effet |
| Pose de verrou court (`ADD COLUMN`, `ADD CONSTRAINT … NOT VALID`, `RENAME`, `DROP CONSTRAINT`) | propre transaction | 5 s | Rejouable, précédée d'un contrôle d'existence dans `pg_catalog` |
| Validation (`VALIDATE CONSTRAINT`) | propre transaction | `BASEDB_DDL_STEP_BUDGET_MS` (300 s par défaut) | Rejouable : `VALIDATE` sur une contrainte déjà valide est sans effet |
| Hors transaction (`CREATE INDEX CONCURRENTLY`) | aucune | `BASEDB_DDL_STEP_BUDGET_MS` | Voir §3.4.4 |

Les délais sont réglés **par étape**, via `SET LOCAL` à l'intérieur de la transaction ou par `SET` explicite avant une étape hors transaction, et non par un réglage global de pool : c'est la seule façon d'avoir cinq secondes sur une prise de verrou et cinq minutes sur une validation, sur la même connexion.

Le chien de garde de la connexion de contrôle annule le backend DDL au-delà du budget total de l'opération, `BASEDB_DDL_TOTAL_BUDGET_MS` (900 s par défaut). Règle complémentaire : **une migration touche au plus dix tables** ; au-delà, elle est refusée avec `MIGRATION_TOO_LARGE` et doit être découpée. Une migration qui touche cinquante tables est une migration qu'on ne saura ni reprendre ni expliquer.

#### 3.4.4 Politique d'index, et le piège de l'index invalide

**Toute colonne portant une clé étrangère est indexée**, systématiquement, par une étape distincte du plan. Sans cet index, PostgreSQL scanne intégralement la table référençante à *chaque* suppression d'une ligne référencée — pour `NO ACTION`, `SET NULL` et `CASCADE`. À un million de factures, supprimer un client devient une opération de plusieurs secondes qui dépasse le `statement_timeout` et rend `DEADLINE_EXCEEDED` sans explication ; la liste des référents souffrirait du même sort. Est également indexée la colonne de tri par défaut d'une table. La règle de déduplication du chapitre 01 §9.2 s'applique : une colonne ne porte au plus qu'un index généré.

Ces index sont créés `CONCURRENTLY`, hors transaction. Ce mode a un échec caractéristique : une interruption laisse un index `indisvalid = false`, jamais utilisé en lecture mais maintenu à chaque écriture, et le rejeu du même ordre échoue en `42P07` parce que le nom existe déjà. Séquence imposée pour toute étape hors transaction :

1. Enregistrer l'étape comme *démarrée* dans `_basedb.migration` (transaction séparée, pool `catalogue`), l'index passant à l'état `building`, pour qu'un redémarrage sache qu'elle a pu être interrompue.
2. Interroger `pg_index` : si un index portant le nom cible existe avec `indisvalid = false`, le supprimer (`DROP INDEX CONCURRENTLY`).
3. Émettre `CREATE INDEX CONCURRENTLY`.
4. Vérifier `indisvalid = true`, passer l'index à `active` et enregistrer l'étape comme validée.

Un index `indisvalid = false` subsistant dans un schéma `b_*` est une dérive de classe **`CAT-STATE`** (chapitre 02), reprise par le post-test universel du §7.5 et par la ligne de compteurs du §8.5. C'est exactement le genre de dégradation silencieuse qui ne se voit qu'au moment où les performances s'effondrent.

#### 3.4.5 Le plan de pose d'un champ lien

Le plan lui-même — ordre des étapes, verrous, pré-contrôles — est donné par le chapitre 03, et la projection du type par le chapitre 04. Trois propriétés seulement relèvent de ce chapitre, et elles sont vérifiées sur l'instantané du SQL émis (§7.3), pas seulement sur l'état final : chaque étape est une transaction distincte du pool `ddl` ; l'index de la colonne source est créé `CONCURRENTLY`, donc hors transaction ; et **la table cible existe avant la contrainte**, propriété du plan et non du hasard d'exécution.

La clause émise pour la valeur `restrict` du catalogue est `ON DELETE NO ACTION`, et `ON UPDATE` vaut toujours `NO ACTION` (A13) ; `ON DELETE CASCADE` est réellement émise quand le lien est configuré en cascade (A14).

### 3.5 Les interdits qui préservent la séparation future

| Interdit | Contrôle |
|---|---|
| **Aucune requête ne joint `_basedb` à un schéma `b_*` ou à `_basedb_local`** — c'est la jointure, pas la transaction, qui rendrait la séparation impossible | Deux constructeurs SQL distincts, chacun rapportant la **liste des schémas** qu'il a qualifiés ; le harnais de test échoue si une requête en rapporte des deux côtés. La détection porte sur cette liste et jamais sur une sous-chaîne du texte SQL : un slug de base contient facilement `basedb` |
| Une clé étrangère physique entre `b_*` ou `_basedb_local` et `_basedb` | Déjà tranché pour `_created_by` / `_updated_by` au chapitre 02 ; la dérive `CAT-FK1` le détecterait |
| **Aucun objet d'un schéma `b_*` ne référence `_basedb`** | Requête de réconciliation sur `pg_depend`. L'interdit est exact et sans exception : les objets de `b_*` référencent `_basedb_local`, jamais `_basedb` |
| **Une opération n'ouvre au plus qu'une transaction, sur un seul pool** — sans exception pour le DDL ni pour le DML | Le contexte ne porte qu'une poignée de transaction ; en ouvrir une seconde lève une erreur d'invariant. Seuls le *journal* de migration (§3.4.2) et l'entrée d'audit (§3.3) écrivent hors de cette transaction, par une voie qui n'est pas une opération |
| Comparer `now()` obtenu de deux connexions | Toute opération fige son horodatage dans le contexte à sa création et n'utilise que celui-là |
| `LISTEN` ailleurs que sur la connexion d'écoute, `NOTIFY` hors des canaux déclarés | Les canaux sont ceux du catalogue (`basedb_catalog`, `basedb_authz`), de la capture (`basedb_drain`) et du temps réel (`basedb_live`, chapitre 16) |

**Ce dont dépendent les schémas `b_*` tient dans `_basedb_local`** (A9), dont le nom est figé et non configurable, et qui suit les données en cas de séparation physique :

- `uuid_generate_v7()`, source unique des identifiants de lignes, écrite dans le `DEFAULT` de `_id` ;
- `set_updated_at()`, appelée par le déclencheur système de chaque table utilisateur, qui positionne `_updated_at` à `clock_timestamp()` et `_updated_by` depuis la variable de session ;
- `fold_v1()`, fonction de normalisation des index d'expression (chapitre 04) ;
- `capture_v1()`, fonction de capture (chapitre 07), et les deux tables tampon qu'elle alimente.

Les corps de référence sont au chapitre 02 ; la **liste des déclencheurs posés sur une table utilisateur** est normative au chapitre 07 (A10), et ce chapitre ne la duplique pas. Ce dispositif n'est pas un confort : le cadrage promet des données « exploitables directement en SQL », donc un `UPDATE` écrit à la main dans psql doit rafraîchir `_updated_at` et produire une révision, sans quoi l'historique et toute lecture incrémentale deviennent faux. `_updated_by` vaut `NULL` pour une écriture SQL directe : information honnête — « modifié hors application » — et non valeur inventée. Les noms de ces déclencheurs entrent dans les instantanés SQL du §7.3. Une colonne `GENERATED ALWAYS AS … STORED` reste autorisée : elle ne référence rien hors de sa propre ligne.

**Le jour de la séparation**, ce qui change tient en cinq points : `DATABASE_URL_CATALOG` cesse de valoir `DATABASE_URL` ; le drain devient inter-instances, sans changement de code — c'est la raison d'être de la colocalisation décidée par A9 ; les étapes de migration qui écrivent à la fois une définition et un objet physique se dédoublent en deux étapes ordonnées, la machine à états et la réconciliation devenant le juge de l'intervalle ; les vérifications d'amorçage s'exécutent une fois par instance ; et le contrôle de préflux du §3.2 compte les connexions par instance. Aucun mécanisme de transaction distribuée n'est introduit, ni aujourd'hui ni ce jour-là — refus explicite.

---

## 4. Transactions, contexte, échéances, fraîcheur

### 4.1 Frontières

Une transaction est ouverte et validée **par le noyau, à l'intérieur d'une opération**. Aucun adaptateur n'émet `BEGIN`. Une requête HTTP correspond à zéro ou une transaction d'écriture — jamais deux — et une opération composite (créer une table avec ses champs) est **une** opération du noyau, pas une séquence orchestrée par l'API. Les lectures simples s'exécutent en validation implicite, sans `BEGIN` ; les lectures multi-requêtes qui doivent être cohérentes entre elles — chargement du schéma complet d'une base, réconciliation, expansion de liens sur plusieurs tables — s'exécutent dans une transaction `READ ONLY`.

### 4.2 Contenu du contexte, propagation explicite

Le contexte est un **paramètre explicite, premier argument de chaque opération**. Il porte :

| Champ | Rôle |
|---|---|
| `requestId` | UUIDv7, corrélation de bout en bout |
| `acteur` | nature (`user` / `token` / `system`), identifiant, identifiant de jeton |
| `tenantId` | — |
| `surface` | `ui` \| `rest` \| `mcp` \| `system` |
| `horodatage` | figé à la création, seule source de temps du noyau |
| `echeance` | instant au-delà duquel aucune nouvelle instruction n'est émise (§4.3) |
| `permissions` | instantané des permissions effectives, **prédicat de lignes compris** (A20) |
| `versionSchema` | `base.catalog_version`, figée pour toute l'opération (§4.4) |
| `cleIdempotence` | clé de déduplication des opérations de schéma (§4.5) |
| `langue` | pour la mise en forme des messages par l'adaptateur, jamais par le noyau |
| `transaction` | poignée courante, ou rien |

Les valeurs d'`acteur` et de `surface` sont aussi posées en variables de session sur la connexion, parce que c'est là que `capture_v1()` les lit (chapitre 07).

*Alternative rejetée* : un stockage asynchrone contextuel (`AsyncLocalStorage`). Il rend la dépendance invisible, et c'est précisément l'invisibilité qui pose problème — un oubli de propagation ne se voit pas à la lecture, et une opération lancée hors requête hériterait silencieusement d'un contexte étranger. **Rejeté sans exception** : le gestionnaire d'erreur de transport de `@basedb/http`, qui peut s'exécuter avant qu'un contexte existe, journalise avec l'identifiant qu'il tient dans une variable locale.

### 4.3 Isolation, échéances, rejeu

**`READ COMMITTED` partout** ; `REPEATABLE READ` pour les seules lectures multi-requêtes citées au §4.1 ; `SERIALIZABLE` nulle part en v1. Justification : les rares invariants qui exigeraient de la sérialisation — l'allocation d'un nom physique au premier chef — sont déjà protégés par un verrou consultatif de classe `name_allocation` et par l'index unique `uq_physical_name`. Payer le coût de `SERIALIZABLE` sur tout le trafic pour un invariant déjà garanti serait un mauvais échange.

**Échéance.** Le contexte porte une échéance calculée à l'entrée à partir d'un budget par surface : 10 s pour `ui` et `rest`, 60 s pour `mcp`, budget propre de la tâche pour `system`. Avant chaque instruction, le temps restant est posé en `SET LOCAL statement_timeout` — le réglage du pool n'est qu'un plafond de sécurité. Au-delà de l'échéance, aucune nouvelle instruction n'est émise et aucun rejeu n'est tenté : l'opération s'arrête sur `DEADLINE_EXCEEDED`. Sans cette règle, une opération qui émet six requêtes de vingt secondes occupe une connexion deux minutes pour un client parti depuis longtemps ; multiplié par une file d'attente, c'est le mécanisme classique d'effondrement.

**Annulation.** Abandonner côté Node sans annuler côté serveur laisse la requête consommer du CPU jusqu'au bout. Toute interruption — échéance dépassée, client déconnecté, arrêt du processus — déclenche un `pg_cancel_backend`, émis par la connexion de contrôle.

**Politique de rejeu**, unique et chiffrée une seule fois pour tout le document :

| Erreur | Tentatives supplémentaires | Attente |
|---|---|---|
| `55P03` (verrou indisponible), étape de migration | 5 | exponentielle, plafond 2 s, avec gigue |
| `40001` / `40P01` (sérialisation, interblocage) | 3 | exponentielle, plafond 250 ms, avec gigue |
| tout le reste | 0 | — |

Le rejeu n'a lieu que si l'échéance le permet. **Budget global** : si le taux de rejeu sur une fenêtre glissante d'une minute dépasse 10 % des opérations, le rejeu est refusé et l'erreur remonte immédiatement. Sans ce garde-fou, le mécanisme s'auto-alimente : sous contention, trois tentatives supplémentaires multiplient par quatre la charge SQL au moment exact où elle est déjà excessive. Après épuisement, l'utilisateur reçoit `SERIALIZATION_CONFLICT`.

Les migrations ne sont **jamais rejouées automatiquement** au-delà de la reprise d'étape : un DDL qui échoue rend la main à l'utilisateur avec sa cause. Seule l'attente de verrou donne lieu à une nouvelle tentative, l'échec ne disant rien sur la validité de l'opération.

### 4.4 Fraîcheur du cache de schéma

Le cache du schéma d'une base est indispensable — sans lui, chaque requête relirait des milliers de lignes de définition — et c'est aussi la principale source d'incidents en déploiement multi-instances. Trois règles le rendent sûr.

**1. La version est figée par opération, pas par requête.** Au début d'une opération, `base.catalog_version` est lue une fois et posée dans le contexte ; toutes les requêtes de l'opération utilisent cette version. La relire avant chaque requête élémentaire ajouterait un aller-retour par requête sur le pool `catalogue` et en ferait le goulot avant tout le reste.

**2. La péremption est bornée indépendamment de `NOTIFY`.** Le cache porte une durée de vie maximale de 30 secondes ; un sondage de `max(catalog_version)` toutes les 5 secondes, sur le pool `catalogue`, en une requête pour toutes les bases, sert de filet. `NOTIFY basedb_catalog` devient une **optimisation de latence, jamais la seule garantie de fraîcheur** : une connexion d'écoute à demi morte — TCP à demi ouvert, côté client toujours « connecté » — ne déclenche aucune reconnexion et ne livre aucun message, et c'est le cas qui fait réellement mal. D'où les `keepalives` du §3.1 et un compteur de silence : sans message ni sonde de vie pendant 90 secondes, la connexion est fermée et rouverte, et le cache entièrement invalidé.

**3. La péremption n'est pas une dérive.** Entre le `COMMIT` de l'instance A qui relègue une colonne et le traitement du `NOTIFY` par l'instance B, les requêtes en vol de B rendent `42703`. Ce n'est pas un désaccord entre le catalogue et `pg_catalog`, c'est une course inévitable. Sur `42703` et `42P01`, le noyau **force une relecture du schéma de la base concernée et rejoue l'opération une fois** ; ce n'est qu'au second échec que le code devient un incident (§8.2).

**Coût mémoire et éviction.** Une base de 500 tables et 30 champs représente environ 15 000 lignes de définition, soit quelques mégaoctets. Le cache est **par base**, avec éviction LRU bornée par un nombre de bases (32 par défaut) et une taille mémoire (`BASEDB_SCHEMA_CACHE_MAX_MB`, 128 par défaut) ; une base évincée est rechargée en une transaction `REPEATABLE READ, READ ONLY`. Le temps de chargement du schéma d'une base à 500 tables est mesuré par le test de volumétrie du §7.1 et doit rester sous 500 ms.

### 4.5 Idempotence des opérations de schéma

Le scénario est banal : la création d'une table dure 20 secondes, le mandataire HTTP coupe à 15, l'utilisateur reclique — ou n8n réessaie tout seul. La boucle de suffixe du module `naming` fait alors exactement ce qu'on lui demande et crée `clients` puis `clients_2` : deux tables physiques, aucune erreur, et la moitié des enregistrements dans une table fantôme.

**Décision : toute opération de schéma porte une clé d'idempotence**, fournie dans l'en-tête `Idempotency-Key` ou, à défaut, dérivée côté serveur de (acteur, base, forme canonique de l'opération) sur une fenêtre de 10 minutes. Elle est persistée dans la colonne `idempotency_key` de `_basedb.migration`, sous index unique partiel. Une seconde arrivée avec la même clé ne réexécute rien : elle rend le résultat de la première si elle est terminée, ou `MIGRATION_IN_PROGRESS` (409) sinon. Deux appels concurrents avec des clés différentes produisent `clients` et `clients_2` — comportement documenté, pas accidentel.

L'idempotence des **opérations de données** est un autre mécanisme, porté par `_basedb.idempotency_key` et spécifié par le chapitre 08.

---

## 5. La place de Drizzle et des types

**Drizzle décrit `_basedb` et `_basedb_local`, et rien d'autre.** Ces tables ont une forme connue à la compilation, modifiée par des releases : c'est le terrain d'un ORM typé, et les requêtes du catalogue sont assez nombreuses pour que la sécurité de type paie.

Les schémas `b_*` n'existent pas pour Drizzle. **Il n'existe aucun type TypeScript représentant une table utilisateur**, à aucun moment, dans aucun paquet. C'est la règle qui dissout le conflit entre typage statique et structure dynamique : il n'y a pas de conflit parce qu'il n'y a pas de prétendant. Une ligne de données est, côté serveur, un enregistrement dont les clés sont des noms physiques et dont les valeurs sont validées **à l'exécution** contre le schéma lu dans le catalogue. Le typage utile aux consommateurs est produit plus tard : par la spécification OpenAPI générée, et par un générateur de types hors ligne optionnel, non impliqué dans la compilation du serveur.

Conséquences opérationnelles, toutes vérifiées en CI :

- `drizzle-kit pull` / `introspect` ne s'exécute **jamais** sur un schéma `b_*` : un tel schéma généré ferait entrer une structure utilisateur dans le graphe de compilation, et toute création de table rendrait le dépôt obsolète.
- Drizzle n'émet **aucun DDL**. Les fichiers SQL des migrations de catalogue sont produits par `drizzle-kit generate` puis **relus, figés et versionnés** ; en production ils sont appliqués par notre propre exécuteur (§9.2), parce que nous voulons le verrou consultatif, les sommes de contrôle, l'arrêt sur divergence et l'intervalle de compatibilité du §9.3.
- Le DML sur les schémas `b_*` passe par le constructeur SQL du noyau : identifiants issus du registre, quotés et qualifiés ; valeurs en paramètres liés, sans exception ; prédicat de lignes émis systématiquement (A20).

Un point que l'implémenteur oubliera s'il n'est pas écrit : **le décodage des types PostgreSQL est configuré explicitement sur les trois pools.** `numeric` est rendu en chaîne décimale et jamais converti en flottant (perte de précision silencieuse sur un montant), `int8` en chaîne, `timestamptz` en instant UTC ISO-8601, `date` en chaîne `AAAA-MM-JJ` sans fuseau. Toutes les surfaces exposent ces valeurs telles quelles.

---

## 6. Configuration et secrets

### 6.1 Variables d'environnement

Lues et validées **une fois au démarrage**. Une variable manquante ou malformée provoque un arrêt immédiat avec la liste complète des manques. Aucune valeur par défaut n'est inventée pour un secret.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | Connexion au rôle propriétaire de la base d'accueil |
| `DATABASE_URL_CATALOG` | non | Connexion du pool `catalogue` ; à défaut, vaut `DATABASE_URL`. **C'est le point de bascule de la séparation physique.** |
| `BASEDB_POOL_CATALOG_MAX`, `BASEDB_POOL_DATA_MAX`, `BASEDB_POOL_DDL_MAX` | non | Tailles de pool ; défauts du §3.1 |
| `BASEDB_EXPECTED_REPLICAS` | non | Nombre de répliques attendues, pour le contrôle de préflux du §3.2 ; défaut 3 |
| `BASEDB_REQUEST_TIMEOUT_MS` | non | 20 000 par défaut. **Valeur unique dont dérivent** le `statement_timeout` du pool `donnees` et la durée de drainage (§9.2, étape 14) |
| `BASEDB_MIGRATION_STATEMENT_TIMEOUT_MS` | non | 900 000 ; connexion de contrôle, migrations de catalogue |
| `BASEDB_DDL_STEP_BUDGET_MS` / `BASEDB_DDL_TOTAL_BUDGET_MS` | non | 300 000 / 900 000 ; §3.4.3 |
| `BASEDB_SCHEMA_CACHE_MAX_MB` | non | 128 ; §4.4 |
| `BASEDB_ENCRYPTION_KEY` | oui | Clé d'instance (A25) : 32 octets en base64, préfixés d'un numéro de version. Protège les secrets stockés et les curseurs opaques |
| `BASEDB_SESSION_SECRET` | oui | Signature des cookies de session (chapitre 13) |
| `BASEDB_PUBLIC_URL` | oui | URL publique ; redirections OIDC, liens des webhooks, domaine du cookie |
| `BASEDB_ROLE` | non | `migrate` \| `serve` \| `both` ; **défaut `serve`** (§9.2) |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_TENANT_LABEL` | au premier démarrage | Amorçage |
| `LOG_LEVEL`, `NODE_ENV`, `PORT`, `TZ=UTC` | — | |

Il n'existe **aucune variable de schéma** : le nom `_basedb_local` est figé par A9, écrit en dur dans le `DEFAULT` de `_id` de toutes les tables utilisateur, et le rendre configurable imposerait un `ALTER` de toutes les tables le jour où il changerait.

### 6.2 Deux niveaux de réglage, une liste courte

| Niveau | Support | Clés v1 |
|---|---|---|
| Instance | `_basedb.setting`, portée instance | fournisseur OIDC (chapitre 13), modèle d'IA par défaut (chapitre 12), durées de `_basedb.retention_policy` (A24) |
| Tenant | `_basedb.setting`, portée tenant | **modèle d'IA, seul** (clé `ai.model`) |

Le cadrage ne demande qu'une surcharge par tenant, le modèle d'IA ; c'est la seule qui existe. Tout le reste — tailles de pool, délais, plafonds, URL — est une variable d'environnement, parce qu'un réglage en base est un réglage qu'il faut lire, mettre en cache, invalider et sécuriser. Ordre de résolution : défaut du code < variable d'environnement < réglage d'instance < réglage de tenant, sur les seules clés déclarées surchargeables ; une tentative de surcharge d'une autre clé est refusée par le noyau, pas par l'écran. **Toute nouvelle clé surchargeable par tenant est une décision d'architecture**, au même titre que l'ajout d'une dépendance au noyau (§10).

### 6.3 Secrets et clé d'instance

Les secrets réversibles — clés des fournisseurs d'IA, secrets de signature des webhooks — vivent dans `_basedb.secret`, **chiffrés au repos** en AES-256-GCM avec une clé dérivée de `BASEDB_ENCRYPTION_KEY` (HKDF, sel propre à la ligne), accompagnés du numéro de version de clé (A25). Le secret en clair n'existe qu'en mémoire du processus, le temps de l'appel : le noyau le déchiffre et le passe en paramètre à `@basedb/ai`, qui ne le lit jamais lui-même.

**La rotation de `BASEDB_ENCRYPTION_KEY` n'est pas outillée en v1.** Le numéro de version existe pour que la rotation puisse être ajoutée sans migration de données ni changement de forme ; la procédure (écriture double, rechiffrement progressif, retrait de l'ancienne version) est une décision de v2. Annoncer une rotation sans l'écrire serait une demi-décision.

Trois règles complémentaires : l'API ne restitue jamais qu'un indicateur de présence et les quatre derniers caractères ; **aucun appel à un fournisseur d'IA ne part du navigateur** ; et la configuration exposée au front est construite par **liste blanche explicite de clés**, jamais par filtrage d'un préfixe — un filtre par préfixe finit toujours par laisser passer la variable mal nommée.

### 6.4 Le témoin de clé, vérifié au démarrage

`BASEDB_ENCRYPTION_KEY` vit hors de la base et rendrait le produit silencieusement faux si elle changeait. Un HMAC-SHA-256 d'une constante connue, accompagné du numéro de version, est donc enregistré au premier démarrage dans `_basedb.setting` et vérifié à chaque démarrage suivant. Une divergence est un **arrêt immédiat** avec message dédié : sans ce contrôle, une restauration avec la mauvaise clé ne se manifesterait qu'au premier appel à un fournisseur d'IA, des semaines plus tard. La contrepartie est la règle de sauvegarde du §9.7 : la clé est sauvegardée **séparément de la base** (A25).

---

## 7. Stratégie de test de la phase 2

### 7.1 Cinq niveaux, des rôles disjoints

| Niveau | Périmètre | Base réelle |
|---|---|---|
| Unitaire | Slugification, quoting, planification DDL (le plan et le texte SQL produits), résolution RBAC sur table de vérité, décodage des types, taxonomie d'erreurs | non |
| Propriétés | Slugification, allocation de noms, curseur de pagination | non |
| Intégration | Tout ce qui touche PostgreSQL : moteur DDL, catalogue, migrations, DML, capture, drain, réconciliation | oui, PostgreSQL 16 |
| Volumétrie | Parcours complet par curseur sur une table de 200 000 lignes, avec filtre et tri sur colonne indexée puis non indexée, **insertions concurrentes pendant le parcours** ; chargement du schéma d'une base à 500 tables ; pose d'une clé étrangère sur une table de 1 000 000 de lignes | oui |
| Panne | §7.7 | oui |

Attendus du niveau volumétrie, chiffrés parce que le cadrage l'est (« comportement correct au-delà de 100 000 lignes ») : aucune ligne dupliquée ni omise pour les lignes présentes du début à la fin du parcours ; aucun `statement_timeout` atteint ; **coût par page indépendant du rang de la page**, mesuré par les blocs lus que rapporte `EXPLAIN (ANALYZE, BUFFERS)` et non par un chronomètre, pour que le test ne devienne pas instable sur une machine chargée ; schéma d'une base à 500 tables chargé sous 500 ms ; clé étrangère posée sans dépassement du budget d'étape, chaque étape prenant ses verrous moins de cinq secondes.

### 7.2 Isolation des tests d'intégration, et le rôle sous lequel ils tournent

**Décision : une base PostgreSQL par fichier de test**, créée à partir d'un gabarit contenant un `_basedb` déjà migré. Coût : quelques centaines de millisecondes par fichier, et une parallélisation sans coordination. *Alternatives rejetées* : une transaction englobante annulée à la fin, incompatible avec un code sous test qui émet du DDL et valide ses propres transactions ; un nettoyage par `TRUNCATE`, qui ne défait pas les schémas `b_*` créés.

**Deux rôles distincts, et c'est le point qui rend le contrôle honnête** :

| Rôle | Attributs | Usage |
|---|---|---|
| `basedb_ci_bootstrap` | `CREATEDB` | **Harnais de test uniquement**, jamais le produit : `CREATE DATABASE … OWNER basedb_app TEMPLATE basedb_tpl`, puis `DROP DATABASE` final |
| `basedb_app` | propriétaire de la base créée ; **ni superutilisateur, ni `CREATEDB`, ni `CREATEROLE`** | Seul rôle que `DATABASE_URL` peut désigner, en test comme en production |

Un rôle « propriétaire de la base et rien d'autre » ne possède pas l'attribut `CREATEDB` : sans cette séparation, le harnais ne pourrait pas créer ses bases, ou bien le contrôle censé protéger la contrainte d'infrastructure non négociable du cadrage ne prouverait plus rien.

Le job de conformité devient alors vérifiable. En début de suite, deux assertions : toute connexion ouverte par le produit satisfait `current_user = 'basedb_app'`, et `SELECT rolcreatedb, rolsuper, rolcreaterole FROM pg_roles WHERE rolname = 'basedb_app'` rend trois `false`. Ensuite, **toute commande du produit refusée pour privilège insuffisant (`42501`) fait échouer la CI.**

Deux précautions sur le gabarit, sans lesquelles la suite devient intermittente : il est créé **une seule fois** avant la suite et plus jamais connecté ensuite ; et un `55006` donne lieu à trois nouvelles tentatives à 200 ms d'intervalle avant d'échouer.

### 7.3 Rendre un moteur DDL déterministe

Trois leviers, sans lesquels rien n'est reproductible :

1. **Horloge injectée.** Le noyau ne lit jamais l'heure système ; il lit l'horodatage figé du contexte. Les noms `zz_supprime_<AAAAMMJJ>_…` deviennent prévisibles.
2. **Aléa injecté.** La source aléatoire du repli de slug et du `tenantId`, ainsi que le générateur d'UUIDv7 des identifiants de catalogue, sont fournis au noyau. Semence fixe en test : `table_k3f9x2` est reproductible, et le tirage d'un `tenantId` en collision est *provoquable* pour tester la boucle de rejeu.
3. **Instantanés du SQL émis.** Le SQL généré par chaque opération de schéma — **plan complet, étape par étape, dans l'ordre** — est comparé caractère par caractère à un texte de référence versionné. Un changement involontaire de quoting, de clause `ON DELETE`, de découpage d'étapes ou de nom de contrainte, d'index ou de déclencheur fait échouer le test, même si le résultat en base reste correct. C'est le seul moyen de protéger la stabilité des noms physiques sur la durée.

### 7.4 Ce qu'on teste sur la slugification

Par propriétés, sur des chaînes Unicode arbitraires : le résultat satisfait toujours l'alphabet A ou l'appel lève un code nommé ; la longueur en **octets** ne dépasse jamais le budget applicable (53 / 48 / 48 / 63) ; jamais de `_` en tête, en fin, ni doublé ; idempotence (`slug(slug(x)) = slug(x)`) ; **stabilité par forme de normalisation** (la même chaîne en NFC et en NFD donne le même slug).

Sur l'indépendance à la locale, deux contrôles ciblés plutôt qu'un job global : une **règle de lint** interdisant `toLocaleLowerCase`, `toLocaleUpperCase` et `localeCompare` dans `@basedb/naming` — c'est le vrai risque en JavaScript, `toLowerCase` étant indépendante de la locale quand ses variantes `Locale` ne le sont pas ; et un **job de quelques secondes** qui rejoue les seuls tests de `@basedb/naming` avec `LC_ALL=tr_TR.UTF-8`, rejouer la suite d'intégration complète sous cette locale doublant le coût de CI sans rien prouver de plus.

Par l'exemple : le tableau de bout en bout du chapitre 01 §12 est transcrit tel quel en cas de test, les entrées qui produisent un repli aléatoire étant vérifiées sur leur forme.

Par oracle : créer N libellés aléatoires dans une même base, exiger N noms physiques deux à deux distincts et N lignes de registre. Et un test de **concurrence** : K transactions créant simultanément le même libellé doivent produire `clients`, `clients_2`, … sans trou et sans erreur remontée à l'utilisateur.

### 7.5 Ce qu'on teste sur les relations

| Cas | Attendu |
|---|---|
| Ordre et découpage du plan | Une migration décrivant table source, table cible et lien dans le désordre produit un plan où la cible précède la contrainte, chaque étape dans sa transaction, l'index créé `CONCURRENTLY` hors transaction. Vérifié sur l'instantané du SQL, pas sur le seul résultat |
| Nom de la colonne | Un premier lien vers `clients` produit `clients_id` ; un second, depuis un champ « Client livré », produit `client_livre_id` et non `clients_id_2` (A7) ; le nom est figé |
| Compatibilité de type | Créer un lien sur une colonne source d'un type incompatible avec `_id`, ou modifier ce type alors que la clé étrangère existe, est refusé par `LINK_TYPE_INCOMPATIBLE` (422) avant toute modification |
| Suppression d'une table référencée | Refus `TABLE_REFERENCED`, liste des champs fautifs, **et état de la base strictement inchangé** après l'échec |
| Clé étrangère sur données non conformes | Refus **avant modification**, `LINK_ORPHAN_VALUES`, jusqu'à cinquante lignes fautives et le compte total ; migration en `failed` ; aucun objet créé, colonne intacte, **aucune erreur serveur brute** |
| `restrict` | La clause émise est `ON DELETE NO ACTION`, `confdeltype = 'a'` (A13) ; la suppression d'une ligne référencée est refusée avec `ROW_REFERENCED` et un échantillon de référents, `23503` n'apparaissant jamais tel quel ; une suppression en lot qui supprime dans la même instruction la ligne cible et ses référents **réussit** |
| `set_null` | La colonne source passe à `NULL`. Test négatif : la combinaison avec un champ obligatoire est refusée **au niveau du catalogue**, contrainte à l'appui |
| `cascade` | `ON DELETE CASCADE` réellement émise (A14). Un `DELETE` écrit en psql cascade, et chaque ligne supprimée en chaîne produit une révision `is_cascade = true`. Par l'API, décompte affiché et confirmation exigée ; l'octroi du droit est nominatif et tracé |
| Index de clé étrangère | Après pose d'un lien, un index existe sur la colonne source, `indisvalid = true` ; la suppression d'une ligne référencée d'une table d'un million de lignes reste sous le budget |
| Colonne d'affichage | `display_field_id` nul est un état valide ; supprimer logiquement le champ désigné est refusé par `DISPLAY_FIELD_IN_USE`, et **aucune bascule** ne se produit (A15) |
| Cible illisible | La charge utile est exactement `{ "clients_id": { "id": null, "display": null, "masked": true } }` (A16), sur les trois surfaces ; le filtre se réduit à « renseigné » / « non renseigné » |
| Suppression logique d'un champ lien | La contrainte tombe immédiatement (A17), la colonne reléguée survit jusqu'à la purge sans contrainte ; un rétablissement exigeant revalidation produit `LINK_ORPHAN_VALUES`, pas un incident |
| Références inverses | `listerReferents` rend, pour chaque table référençante lisible par l'acteur, le champ, le compte et un aperçu ; une table interdite n'apparaît pas |
| Écriture SQL directe | Un `UPDATE` émis hors application rafraîchit `_updated_at`, laisse `_updated_by` nul, et produit une révision |

**Les autres décisions structurantes, rendues exécutables.** Chaque ligne est un test d'intégration ou un test d'instantané ; l'ensemble est un critère de sortie (§7.8).

| Décision | Assertion |
|---|---|
| A1 | Le démarrage sur PostgreSQL 15 échoue avec `POSTGRES_VERSION_TOO_OLD` ; aucun chemin de repli n'existe |
| A3 | Le démarrage échoue, avec un code par manque, si `pg_trgm`, `unaccent` ou une collation ICU est absente |
| A4 | Aucune dépendance réseau hors PostgreSQL dans la liste close du §10 ; les compteurs de limitation de débit sont des lignes de `_basedb` |
| A5, A6 | Tout objet physique créé possède une ligne de registre ; les noms dérivés satisfont les motifs du chapitre 01 §9.1 ; aucun nom ne contient d'empreinte |
| A8 | L'instantané du SQL émis ne contient jamais `hashtext(` ; toute clé de verrou vient de `lock_class.key` et d'une colonne `lock_key` |
| A9 | `pg_depend` ne montre aucune dépendance d'un objet de `b_*` vers `_basedb` ; tous les `DEFAULT` de `_id` qualifient `_basedb_local` |
| A10 | Un `INSERT`, un `UPDATE` et un `DELETE` émis en psql produisent chacun une ligne de `revision_buffer` ; le drain est idempotent et rejouable sans doublon |
| A12 | Aucun statut de migration hors du vocabulaire de A12 ; `sequence` est nulle avant `applying` et attribuée sans trou ensuite |
| A18 | Les cinq colonnes système sont lisibles dès la lecture accordée, jamais inscriptibles, et aucune permission de champ ne peut être créée sur elles |
| A19 | Un abonnement de webhook dont le rôle a un champ masqué est refusé ; un masquage postérieur désactive le webhook, charge utile jamais amputée |
| A20 | Chaque requête de données produite par le constructeur porte le prédicat de lignes ; une requête construite hors du point d'application unique fait échouer la suite |
| A21 | La spécification OpenAPI générée ne contient aucune route d'export |
| A22 | Après purge, la ligne de catalogue subsiste avec `purged_at` et la ligne de registre reste en `purged` |
| A23 | Tout code renvoyé par une surface appartient au registre `_basedb.error_code` ; aucun code hors registre, aucun code accentué |
| A25 | Un démarrage avec une `BASEDB_ENCRYPTION_KEY` différente s'arrête sur le témoin du §6.4, avant tout service |

**Post-test global** : après *chaque* test d'intégration, le harnais exécute les requêtes de dérive `CAT-*` du chapitre 02 et exige zéro ligne. Assertion universelle, pas test parmi d'autres : aucun scénario, même en échec partiel, ne doit laisser le catalogue et `pg_catalog` désaccordés.

### 7.6 Le test qui garantit qu'aucun accès ne contourne le RBAC

Quatre tests complémentaires, aucun suffisant seul :

1. **Complétude** (§2.4, verrou 5) : toute opération exportée figure dans la table `opération → action → portée`, sinon la suite échoue.
2. **Refus par défaut, paramétré** : pour chaque entrée de cette table, l'opération est appelée avec un acteur dépourvu du droit. On exige `RESOURCE_NOT_FOUND`, **aucune écriture** (empreinte du contenu des schémas comparée avant et après) et aucun nom d'objet dans le message.
3. **Étanchéité observée** : un espion sur le pool `donnees` enregistre toute requête émise. Pour chaque appel d'adaptateur avec un acteur sans droit, on exige que **zéro requête ne touche un schéma `b_*`**. Ce test attrape le défaut que les deux précédents laissent passer : lire d'abord, filtrer ensuite.
4. **Équivalence des trois surfaces** : le même scénario, joué par l'API, par MCP et par le noyau directement, rend la même décision. Un seul jeu de données, une seule table de vérité.

Pas de seuil de couverture global — il mesure mal. Exigence ciblée : **100 % des branches** des modules `rbac`, `identity` et du constructeur SQL, et tests de mutation sur `naming` et `rbac`.

### 7.7 Tests de panne

Un noyau qui n'est éprouvé qu'en régime nominal n'est pas éprouvé. Six scénarios, tous en intégration, tous suivis du post-test de dérive :

| Scénario | Attendu |
|---|---|
| `SIGKILL` au milieu d'une migration, puis redémarrage | Migration reprise à l'étape suivante ou marquée `interrupted` ; dérives `CAT-*` à zéro ; aucun index invalide subsistant |
| `SIGTERM` pendant une migration, puis redémarrage | La migration en cours va à son terme dans son budget, ou est marquée `interrupted` et reprise (§9.2, étape 14) |
| Deux instances appliquant simultanément une opération de schéma sur la même base | Une réussit, l'autre reçoit `MIGRATION_IN_PROGRESS` ; avec la même clé d'idempotence, une seule table |
| Coupure de la connexion `LISTEN` (socket coupé sans FIN) | Cache rafraîchi au plus tard au bout de 30 s par la borne de péremption ; connexion rouverte au plus tard au bout de 90 s |
| Arrêt du drain pendant une série d'écritures, puis reprise | Aucune révision perdue, aucun doublon dans `_basedb`, `drained_at` renseigné exactement une fois ; l'alerte d'âge du §8.5 s'est déclenchée |
| Saturation du pool `donnees` | `SERVICE_UNAVAILABLE` 503 avec `Retry-After` après le délai d'acquisition, **jamais** une attente indéfinie |

### 7.8 Critères de sortie de la phase 2

Le cadrage impose une validation entre phases ; la voici, sous forme de conditions vérifiables, toutes exécutables par une commande unique :

1. Tous les scénarios du §7.5 au vert, instantanés SQL et tableau des décisions inclus.
2. Post-test de dérive `CAT-*` à zéro sur l'intégralité de la suite.
3. Suite de panne du §7.7 au vert.
4. Job de conformité au rôle restreint (§7.2) au vert, sans aucun `42501`.
5. Suite de volumétrie du §7.1 au vert.
6. Table `opération → action → portée` complète, 100 % des branches sur `rbac`, `identity` et le constructeur SQL.
7. Job de locale (§7.4) et règles `dependency-cruiser` au vert.
8. Une base, une table et les quatre types de colonnes de la tranche verticale, créées et peuplées **exclusivement par les opérations du noyau**, sans API ni interface, et relues en SQL brut dans psql avec des noms lisibles.

---

## 8. Erreurs, journaux, alertes

### 8.1 Taxonomie

Les codes sont ceux du registre unique (A23), publiés dans `@basedb/contracts` et semés dans `_basedb.error_code`. Règle de nommage, sans exception et conformément à A2 : **identifiant anglais, en majuscules ASCII, mots séparés par `_`.** Un code est un identifiant machine ; le message affiché, lui, reste en français et relève de l'adaptateur.

| Classe | Exemples | HTTP | Ce que voit l'utilisateur | Journal |
|---|---|---|---|---|
| Validation | `LABEL_EMPTY`, `LABEL_TOO_LONG`, `LABEL_DUPLICATE`, `IDENTIFIER_INVALID`, `REQUIRED_VALUE_MISSING`, `VALUE_INVALID`, `VALUE_TOO_LONG`, `VALUE_OUT_OF_RANGE`, `VALUE_OUT_OF_CONSTRAINT`, `LINK_TYPE_INCOMPATIBLE`, `LINK_CROSS_DATABASE` | 422 | Code, champ concerné, détail | info |
| Autorisation, ressource invisible | `RESOURCE_NOT_FOUND` | **404** | Le code, rien d'autre | avertissement, avec acteur |
| Autorisation, ressource visible mais action réservée | `ADMIN_REQUIRED` | 403 | Code et action refusée | avertissement, avec acteur |
| Conflit | `NAME_COLLISION_UNRESOLVED`, `PHYSICAL_NAME_TAKEN`, `TABLE_REFERENCED`, `ROW_REFERENCED`, `DUPLICATE_VALUE`, `LINK_TARGET_NOT_FOUND`, `LINK_ORPHAN_VALUES`, `DISPLAY_FIELD_IN_USE`, `BASE_NOT_EMPTY`, `MIGRATION_IN_PROGRESS`, `MIGRATION_TOO_LARGE`, `REGISTRY_DIVERGENT` | 409 | Code et objets nommés que l'acteur a le droit de voir | info |
| Indisponibilité | `LOCK_UNAVAILABLE`, `DEADLINE_EXCEEDED`, `SERIALIZATION_CONFLICT`, `SERVICE_UNAVAILABLE` | 503 | Code, invitation à réessayer, `Retry-After` | avertissement |
| Incident | `NAME_TOO_LONG`, `NAME_TAKEN_OUTSIDE_REGISTRY`, `CATALOG_DRIFT`, `PRIVILEGES_INSUFFICIENT`, `FIELD_CONFIG_MISSING`, SQLSTATE non traduit | 500 | **Un identifiant d'incident, et rien d'autre** | erreur, avec pile et contexte |

Le 403 n'est employé que lorsque l'acteur a déjà le droit de voir l'objet ; sinon, la non-divulgation du §8.4 impose le 404. `NAME_TOO_LONG` et l'usage « incident » d'`IDENTIFIER_INVALID` ne sont levés que par `@basedb/naming` sur un identifiant **construit par le noyau**, jamais sur une saisie : la troncature aux budgets d'octets s'applique en amont, et une saisie hors bornes produit `LABEL_TOO_LONG` en 422.

**Codes ajoutés au registre par ce chapitre** : `REQUIRED_VALUE_MISSING`, `VALUE_TOO_LONG`, `VALUE_OUT_OF_RANGE`, `VALUE_OUT_OF_CONSTRAINT`, `LINK_TYPE_INCOMPATIBLE`, `SERIALIZATION_CONFLICT`, `DEADLINE_EXCEEDED`, `CATALOG_DRIFT`, `EXTENSION_PG_TRGM_MISSING`, `EXTENSION_UNACCENT_MISSING`, `ICU_COLLATION_MISSING`. Les autres codes cités dans cette taxonomie — dont `VALUE_INVALID`, `SERVICE_UNAVAILABLE`, `RESOURCE_NOT_FOUND`, `ADMIN_REQUIRED`, `MIGRATION_IN_PROGRESS` et `MIGRATION_TOO_LARGE` — appartiennent à leur chapitre normatif et sont repris tels quels, sans redéfinition ni variante.

```json
{ "error": { "code": "ROW_REFERENCED", "message": "…",
    "details": { "table": "clients", "referents": [ { "table": "factures", "field": "clients_id", "count": 12 } ] },
    "requestId": "0199c3f2-…" } }
```

### 8.2 Un seul endroit de traduction

La traduction SQLSTATE → code du registre est faite **par l'exécuteur de requêtes du noyau lui-même**, que toute exécution SQL traverse sans exception. Elle n'est donc pas oubliable : il n'existe aucun chemin qui exécute du SQL sans passer par lui. Tous les autres chapitres renvoient à cette table et ne la redéfinissent pas. L'exécuteur reçoit le contexte, donc le schéma mémorisé de la base, et peut remonter d'un nom de contrainte jusqu'au **libellé du champ**, par le registre `_basedb.physical_name` — c'est ce qui permet de dire « la valeur du champ *Numéro* existe déjà » plutôt que « violation de `uq_factures__numero` ».

| SQLSTATE | Code du registre |
|---|---|
| `23505` | `DUPLICATE_VALUE`, champ résolu par le catalogue |
| `23503` | `ROW_REFERENCED` (suppression) ou `LINK_TARGET_NOT_FOUND` (insertion, modification), selon l'opération |
| `23514` | `VALUE_OUT_OF_CONSTRAINT`, règle résolue par le catalogue |
| `23502` | `REQUIRED_VALUE_MISSING` |
| `22001` / `22003` / `22P02` | `VALUE_TOO_LONG` / `VALUE_OUT_OF_RANGE` / `VALUE_INVALID` |
| `40001` / `40P01` | rejeu (§4.3), puis `SERIALIZATION_CONFLICT` |
| `55P03` | `LOCK_UNAVAILABLE` |
| `57014` | `DEADLINE_EXCEEDED` |
| `53300` / `53200` | `SERVICE_UNAVAILABLE` |
| `25P02` | **Incident.** Une instruction a été émise dans une transaction abandonnée : c'est un défaut de notre machine à états, jamais une faute de l'utilisateur |
| `42P01`, `42703` | **Relecture du schéma et rejeu unique** (§4.4, règle 3). Au second échec seulement : `CATALOG_DRIFT`, incident |
| `42P07` | Incident, sauf pendant une étape hors transaction reprise, où il déclenche la séquence du §3.4.4 |
| `42501` | **Incident** `PRIVILEGES_INSUFFICIENT`, avec message d'exploitation dédié : le rôle a perdu un droit |

### 8.3 Journaux et corrélation

Journal structuré, une ligne JSON par événement. Champs imposés : horodatage, niveau, `requestId`, surface, nature et identifiant de l'acteur, tenant, base, opération, durée, issue, code d'erreur, identifiant d'incident. **Ne figurent jamais dans le journal** : valeurs de cellules, secrets, jetons (seul le préfixe de huit caractères), mots de passe, corps de requête. Les lignes fautives d'une migration vont dans `error_sample`, protégé par les permissions et par la rétention du §8.6.

Le `requestId` est un UUIDv7 généré à l'entrée, ou repris de `X-Request-Id` s'il est conforme. Il est rendu dans la réponse, inscrit dans l'entrée d'audit, transmis dans les en-têtes de webhook, et **préfixé en commentaire SQL** (`/* rid=… op=… */`) sur chaque requête émise, ce qui permet de relier une entrée de `pg_stat_activity` ou du journal des requêtes lentes à une requête applicative. Le commentaire ne contient qu'un identifiant hexadécimal et un nom d'opération constant, jamais une valeur d'utilisateur.

Trois conséquences de ce commentaire, à traiter sous peine de dégâts discrets :

- Le texte SQL devient unique à chaque exécution. **Aucune requête portant ce commentaire n'utilise de requête préparée nommée** : le cache du pilote croîtrait sans borne, par connexion. Le mode paramétré non nommé reste employé, sans exception sur la liaison des valeurs.
- `pg_stat_activity.query` est tronqué à `track_activity_query_size`, 1024 octets par défaut. Le commentaire est en tête, donc il survit, mais il ampute d'autant la partie utile : la documentation d'exploitation recommande 4096.
- L'outil d'analyse du journal des requêtes lentes doit **normaliser les commentaires**, sans quoi il voit N requêtes distinctes au lieu d'une.

Un `traceparent` W3C présent est propagé, pour brancher plus tard une chaîne de traces sans toucher aux interfaces.

### 8.4 Non-divulgation

Règle unique, cohérente avec le chapitre 05 : **l'absence de droit produit exactement la même réponse que l'absence d'objet** — même statut, même corps, mêmes en-têtes. Trois conséquences : le contrôle de droit s'effectue **avant** toute requête de données (sinon la durée de réponse trahit l'existence) ; aucun message ne nomme un objet que l'acteur n'a pas le droit de voir ; et **une erreur de validation ne cite jamais un champ masqué**, faute de quoi un 422 suffirait à détecter un champ caché.

### 8.5 Ce qu'on alerte, puisqu'il n'y a pas de métriques

Le §10 exclut toute métrique au-delà du journal structuré. La contrepartie est obligatoire : **une ligne de journal toutes les 60 secondes, portant des compteurs**, émise en `info` et en `warning` dès qu'un seuil est franchi. Sept conditions minimales, chacune annonçant une panne avant qu'elle n'arrive :

| Compteur | Seuil d'alerte |
|---|---|
| Dérives `CAT-*` détectées, toutes classes confondues | ≠ 0 |
| Migration en statut `applying` la plus ancienne | > 15 minutes |
| Âge de la plus vieille ligne non drainée des tampons de `_basedb_local` | > 60 secondes |
| Partition du mois suivant, pour `audit_log`, `change_event` et `webhook_delivery` | absente |
| Lignes dans une partition `DEFAULT` | > 0 |
| Taux de dépassement du délai d'acquisition de connexion, par pool | > 1 % sur la minute |
| Index `indisvalid = false` dans un schéma `b_*` (classe `CAT-STATE`) | ≠ 0 |

### 8.6 Rétention de l'échantillon d'erreur

`_basedb.migration.error_sample` est le **seul endroit où des valeurs de cellules utilisateur entrent dans le catalogue**. Trois règles l'encadrent, faute de quoi la non-divulgation serait contournée par sa propre exception : l'échantillon ne contient que la clé de la ligne et la colonne responsable du refus ; son contenu est effacé au terme de la rétention `migration_error_sample` (30 jours, A24) par l'ordonnanceur, la ligne de migration et le **nombre** de lignes fautives étant conservés sans limite ; et tout export de catalogue à visée de support exclut cette colonne.

---

## 9. Déploiement, amorçage, exploitation

### 9.1 Hypothèses d'environnement

**PostgreSQL 16 ou plus** (A1), une base d'accueil à l'encodage `UTF8` dont le rôle connecté est propriétaire. Node 22 LTS, `TZ=UTC`, système de fichiers sans état. Aucun privilège d'instance, aucun `CREATE DATABASE`, aucun superutilisateur, aucune écriture dans `postgresql.conf`.

**Liste close des prérequis de base de données**, vérifiée au démarrage, sans chemin de repli :

| Prérequis | Pourquoi | Si absent |
|---|---|---|
| `server_version_num` ≥ 160000 | `pg_input_is_valid`, `EXPLAIN (GENERIC_PLAN)`, `reltuples = -1`, `UNIQUE NULLS NOT DISTINCT`, vues `security_invoker` | `POSTGRES_VERSION_TOO_OLD` |
| Encodage `UTF8` | Budgets d'octets et slugification | `DB_ENCODING_NOT_UTF8` |
| Extension `pg_trgm` (A3) | Filtre « contient » indexé | `EXTENSION_PG_TRGM_MISSING` |
| Extension `unaccent` (A3) | Comparaison insensible aux accents | `EXTENSION_UNACCENT_MISSING` |
| Collations ICU disponibles (A3) | Tri linguistique des colonnes texte | `ICU_COLLATION_MISSING` |

Les trois derniers sont des **dépendances d'installation**, pas des objets que le produit crée : le rôle utilisé n'a pas nécessairement le droit d'exécuter `CREATE EXTENSION`. Aucun comportement dégradé n'est spécifié sans elles ; leur absence est un refus de démarrer nommé.

Aucune autre extension n'est utilisée : `uuid-ossp`, `pgcrypto` et `pg_stat_statements` sont écartées, `gen_random_uuid()` du cœur suffisant à la partie aléatoire de l'UUIDv7. La fonction `_basedb_local.uuid_generate_v7()`, dont le corps est au chapitre 02, sert de `DEFAULT` à `_id` : sans elle, un `INSERT INTO "b_t4z56fq_crm"."clients" ("name") VALUES ('x')` écrit en psql — usage promis par le cadrage — violerait `NOT NULL`. Le générateur injecté au noyau (§7.3) ne sert qu'au `requestId` et aux identifiants de catalogue ; il ne produit jamais un `_id` de ligne utilisateur.

### 9.2 Séquence de démarrage

1. Charger et valider la configuration ; échec → sortie immédiate avec la liste des manques.
2. Ouvrir la connexion de contrôle et vérifier les prérequis du §9.1, le droit `CREATE` sur la base, le **contrôle de préflux des connexions** (§3.2) et le **témoin de clé de chiffrement** (§6.4). Un manquement est un arrêt, pas un avertissement.
3. Si `BASEDB_ROLE = serve` : comparer la version de catalogue présente à l'intervalle de compatibilité déclaré par le code (§9.3). En dessous de `catalog_version_min`, **le processus ne sort pas en erreur** : il démarre, `/healthz` répond bon, `/readyz` répond mauvais avec le motif, et il attend en journalisant toutes les dix secondes. C'est à l'orchestrateur de décider d'abandonner : une sortie en erreur produirait un redémarrage en boucle avec recul exponentiel, et une migration de dix minutes causerait une indisponibilité bien plus longue. **Un processus `serve` n'applique jamais de migration.**
4. Rôle `migrate` : prendre `pg_try_advisory_lock(1, 1)` sur la connexion de contrôle — classe `catalog_migration`, clé réservée de portée instance (A8) —, dans une boucle bornée à dix tentatives.
5. Créer `_basedb` et `_basedb_local` si absents, sinon lire `max(version)` de `_basedb.catalog_migration` et **vérifier les sommes de contrôle des migrations déjà appliquées** ; divergence → arrêt `CATALOG_CHECKSUM_MISMATCH`. Base en avance sur ce que le migrateur connaît → arrêt `CATALOG_VERSION_AHEAD`, **du seul rôle `migrate`**.
6. Appliquer les migrations manquantes, chacune dans sa propre transaction, en consignant durée et version applicative. Un fichier marqué `-- basedb:no-transaction` s'exécute hors transaction, avec la séquence du §3.4.4.
7. **Amorçage fonctionnel idempotent**, dans l'ordre fixé par le chapitre 02 : tenant système, utilisateur système, semis des tables de référence, puis — si aucun tenant réel n'existe — le tenant, ses rôles système et l'administrateur d'instance depuis `BOOTSTRAP_ADMIN_EMAIL`. Sans mot de passe fourni, imprimer un lien d'activation à usage unique sur la sortie standard — **jamais de mot de passe par défaut**.
8. Créer les partitions d'`audit_log`, de `change_event` et de `webhook_delivery` pour les **trois** mois à venir, et la partition `DEFAULT` si elle n'existe pas. Relâcher le verrou consultatif.
9. Ouvrir les trois pools et la connexion d'écoute.
10. Lancer la **réconciliation** en lecture seule, incrémentale : ne réexaminer que les bases dont `catalog_version` a changé depuis la dernière réconciliation validée. Sa durée est bornée à 20 secondes ; au-delà, elle bascule en tâche d'arrière-plan et le démarrage continue — à 50 bases de 500 tables, l'interrogation de `pg_catalog` porte sur 25 000 relations, et un démarrage qui n'aboutit pas parce que le contrôle d'intégrité est long est une panne qu'on s'inflige.
11. Passer `base.structure_state` à `frozen` pour chaque base en dérive bloquante (§9.5). En test et en intégration continue, une dérive est un échec de démarrage ; en production, elle gèle la base concernée et elle seule.
12. Démarrer le drain et l'ordonnanceur.
13. Ouvrir le port HTTP. `/healthz` et `/readyz` sont deux sondes distinctes ; voir §9.6.
14. **Arrêt.** À réception de `SIGTERM` : cesser d'accepter de nouvelles requêtes et opérations de schéma ; laisser aux requêtes en cours une durée de drainage égale à `BASEDB_REQUEST_TIMEOUT_MS + 5 s`, soit 25 secondes par défaut — **dérivée de la même valeur que le `statement_timeout` du pool `donnees`**, pour que les deux ne puissent pas diverger ; attendre en parallèle la fin de l'étape de migration en cours dans la limite de `BASEDB_DDL_STEP_BUDGET_MS` ; vider les tampons de capture ; fermer les pools ; relâcher les verrous de session. La documentation d'exploitation impose de régler `terminationGracePeriodSeconds` **au-dessus du plus grand de ces deux budgets**, faute de quoi l'orchestrateur envoie `SIGKILL` et rend le dispositif décoratif.

### 9.3 Versions de catalogue, déploiement progressif, retour arrière

Une égalité stricte entre la version de catalogue et la version attendue par le code rend le déploiement progressif impossible : dès que le migrateur a appliqué N+1, toute réplique encore en version N refuserait de démarrer, et le retour à l'image N−1 après incident serait interdit par construction.

**Décision : le code déclare un intervalle, pas une version.**

| Déclaration | Nature | Comportement |
|---|---|---|
| `catalog_version_min` | dure | En dessous : le processus attend, `/readyz` au rouge (§9.2, étape 3) |
| `catalog_version_max_connu` | souple | Au-dessus : **démarrage normal**, avertissement journalisé. Seul le rôle `migrate` refuse d'agir sur une base plus avancée que ce qu'il connaît |

La contrepartie est la règle de migration en deux temps, déjà imposée aux migrations de catalogue par le chapitre 02 : colonne nullable en release N, remplie et utilisée en N+1, ancienne retirée en N+2. Aucun renommage direct, aucune contrainte `NOT NULL` posée sans remplissage préalable. Elle est testée, sinon elle n'existe pas : un test d'intégration applique les migrations de N+1 sur une base, puis exécute la suite fonctionnelle de N contre cette base. La réversibilité du schéma de catalogue, elle, n'existe pas : on corrige par une migration suivante.

Le défaut `BASEDB_ROLE = serve` découle du même raisonnement : avec `both`, passer à deux répliques donnerait deux migrateurs concurrents. `migrate` est documenté comme une tâche de déploiement dédiée — un Job ou un conteneur d'initialisation — exécutée une fois avant la mise à jour des répliques.

### 9.4 Ordonnanceur interne

Un ordonnanceur minimal appartient au noyau, faute de quoi le produit ne survit pas à son premier mois. Ses tâches sont **purement base**, sans exception :

| Tâche | Période | Raison |
|---|---|---|
| Drain des tampons de `_basedb_local` vers `_basedb` | 5 s, plus déclenchement opportuniste après validation | §3.3 |
| Purge des lignes de tampon drainées depuis plus de 24 h | horaire | — |
| Création des partitions (trois mois d'avance) | quotidienne | §9.2, étape 8 |
| Détachement et archivage des partitions au-delà de `_basedb.retention_policy` | quotidienne | Sans quoi l'historique devient le plus gros objet de la base : à un million de lignes modifiées par mois, il dépasse rapidement les données |
| Purge des jetons, sessions et clés d'idempotence expirés | horaire | — |
| Effacement du contenu d'`error_sample` échu | quotidienne | §8.6 |
| Épuration de second niveau des pierres tombales de catalogue | quotidienne | A22 ; le chapitre 06 en fixe l'ordre |
| Réconciliation planifiée | quotidienne, sous le verrou `maintenance` | §9.5 |
| **Rapport** des alias de compatibilité sans accès depuis N jours | hebdomadaire | **La suppression reste manuelle** : un alias existe pour survivre jusqu'à ce que les consommateurs inconnus se soient manifestés |

La relance des webhooks en échec n'y figure pas : **l'émetteur, hors noyau, possède sa propre boucle de relance.** Un ordonnanceur de noyau qui réémet des webhooks ferait entrer HTTP sortant dans le noyau.

**Exclusion mutuelle.** Chaque tâche prend le verrou consultatif de la classe qui lui correspond au chapitre 02 — `drain` pour le drain, `maintenance` pour le ménage —, tous deux en détention de session. Or un verrou de session est relâché dès que la connexion tombe, y compris sur une coupure réseau que le détenteur ne détecte pas avant plusieurs minutes : « une seule instance à la fois » serait une intention, pas une garantie. Le verrou est donc **doublé d'une ligne de bail en base** portant détenteur, échéance et **jeton de cloisonnement incrémental** que toute écriture de la tâche vérifie. Et, exigence écrite : **chaque tâche est idempotente**, parce que deux exécutions simultanées restent possibles. *Alternative rejetée* : une file de tâches dédiée, injustifiée pour neuf tâches périodiques et contraire à A4.

**Filet sur les partitions.** Une partition manquante ne doit jamais faire échouer une écriture : la partition `DEFAULT` l'absorbe, et sa moindre ligne déclenche l'alerte du §8.5. Combinée aux tampons de `_basedb_local`, cette règle garantit qu'une défaillance du ménage ne devient pas une panne d'écriture à date fixe.

### 9.5 Dérive : détection, gel, réparation

Détecter une dérive sans savoir la réparer ne sert à rien. Le régime d'exécution de la réconciliation, le catalogue des classes `CAT-*` et les requêtes appartiennent au chapitre 02 ; ce chapitre porte les **issues**.

**Gel par base.** Conformément au chapitre 02, un écart bloquant passe `base.structure_state` à `frozen` et lève `REGISTRY_DIVERGENT` : lectures et écritures de données restent servies, les opérations de structure **de cette base seule** sont suspendues, les cinquante autres bases n'étant pas affectées. Refuser aussi les écritures de données aggraverait la panne sans réduire le risque : ce sont les opérations de structure, et elles seules, qui s'appuient sur la description supposée fausse.

**Trois issues de réparation**, proposées par un écran d'administration réservé au rôle admin, chacune consignée dans l'audit avec son auteur :

| Issue | Quand | Effet |
|---|---|---|
| Rejouer | Une migration est restée `applying` ou `interrupted` | La machine à états reprend à l'étape suivante |
| Adopter | L'objet physique est correct, le catalogue est en retard | Le catalogue est aligné sur `pg_catalog` |
| Mettre en orphelin | L'objet physique est inattendu | Il est renommé `zz_orphelin_<date>_<nom>` et sort du champ du produit ; la purge réelle reste manuelle |

### 9.6 Sondes

`/healthz` ne touche pas la base : il dit que le processus vit.

`/readyz` distingue **deux natures d'indisponibilité**, et c'est la distinction qui compte :

| Nature | Réponse | Rotation |
|---|---|---|
| Pas encore migré, pas encore amorcé, intervalle de compatibilité non satisfait | 503 avec motif | **Sort de la rotation** |
| Base lente ou momentanément injoignable | 503 avec motif et `Retry-After` | **Reste dans la rotation** |

Retirer toutes les répliques parce que la base est lente transforme un incident de latence en coupure totale, alors que cela n'a jamais soigné une base lente. Le résultat de `/readyz` est mémorisé 5 secondes — une sonde toutes les 5 secondes sur N répliques créerait sinon un trafic de fond permanent sur le pool `catalogue` — et la bascule au rouge n'a lieu qu'après trois échecs consécutifs, le retour au vert étant immédiat. Le contrôle « partition du mois suivant présente » n'est **pas** dans `/readyz` : il doit alerter un humain (§8.5), pas retirer des répliques.

### 9.7 Sauvegarde et restauration

Le catalogue et les données vivent dans la même base ; ils sont donc sauvegardés et restaurés **ensemble, jamais séparément**. C'est la seule règle de cette section qui n'admet aucune exception.

- **Mode supporté : `pg_dump -Fc` de la base entière.** Une restauration partielle — `-n b_t4z56fq_crm` seul, ou `-n _basedb` seul — crée une dérive immédiate et généralisée, et n'est pas supportée. Elle casserait aussi les `DEFAULT` de clé primaire, qui qualifient `_basedb_local` et exigent que ce schéma existe avant la restauration des tables.
- **`BASEDB_ENCRYPTION_KEY` n'est pas dans le cliché** (A25). Elle est sauvegardée **séparément de la base**, dans un coffre distinct, avec son numéro de version : une sauvegarde qui contiendrait la clé annulerait l'intérêt du chiffrement, et une sauvegarde sans conservation de la clé rend les secrets irrécupérables. Une restauration avec la mauvaise clé est détectée au démarrage par le témoin du §6.4.
- **Migration en cours au moment du cliché** : le cliché est cohérent et contient la ligne de migration dans son état du moment. Après restauration, un processus de rôle `migrate` doit être exécuté **une fois avant l'ouverture du service** : la machine à états reprend l'étape suivante ou marque la migration `interrupted`, et la réconciliation tranche.
- **Restauration à un point dans le temps** : même procédure, plus une réconciliation **complète** avant ouverture du service, le `catalog_version` restauré ne disant rien de ce qui a été réexaminé auparavant.
- **Répétition vérifiée** : un test d'intégration mensuel produit un cliché d'une base de fixtures, le restaure dans une base neuve et exécute les contrôles `CAT-*`. Une sauvegarde jamais restaurée n'est pas une sauvegarde.

---

## 10. Hors phase 2, et liste close des dépendances

Explicitement exclu du noyau, pour qu'il reste petit : tout HTTP et sa sécurité de transport ; **mots de passe, OIDC, cookies** (les sessions et les jetons, eux, appartiennent au noyau — §2.4) ; génération OpenAPI ; émission, signature et relance des webhooks (la **capture** est faite par déclencheur, la **livraison** est hors noyau) ; serveur MCP ; appels aux fournisseurs d'IA ; interface ; SDK. Ces sujets ne sont pas orphelins : ils appartiennent aux chapitres 08, 09, 11, 12 et 13, et aux paquets `@basedb/auth`, `@basedb/ai`, `@basedb/sdk` et `apps/*` du §1.2.

Exclu aussi, et ce sont des refus assumés plutôt que des oublis : les relations « plusieurs vers plusieurs » (v2) ; le cloisonnement effectif du multi-tenant, dont seule la forme de nommage est en place ; la permission au niveau ligne, dont seule la signature est figée (A20) ; la rotation de la clé de chiffrement (§6.3) ; la recherche plein texte ; les pièces jointes ; **toute route d'export** (A21), l'extraction de volume passant par la pagination par curseur ; les vues SQL matérialisées ; **tout cache externe et toute brique d'infrastructure hors PostgreSQL** (A4) ; toute métrique au-delà du journal structuré ; les écrans de renommage physique et de listing des consommateurs — étant entendu que les **primitives DDL** de renommage et d'alias, elles, sont dans le noyau de la phase 2, parce que rien d'autre ne sait émettre du DDL.

Conséquence directe d'A4, à écrire parce qu'elle surprend : **les compteurs de limitation de débit vivent dans PostgreSQL**, comme les files et les verrous. Avec plusieurs instances, la limitation est donc approximative ; le chapitre 08 documente cette approximation, et aucun chapitre ne suppose de magasin de compteurs partagé.

**Liste close des dépendances d'exécution du noyau** : le pilote PostgreSQL, Drizzle, une bibliothèque de validation de schémas, une implémentation d'UUIDv7. Toute addition est une décision d'architecture. C'est le meilleur garde-fou contre la dérive du périmètre : on ne peut pas faire entrer discrètement du HTTP dans un paquet dont la liste de dépendances tient en quatre lignes revues à chaque modification. La même discipline s'applique aux applications, par la liste blanche du §1.2.

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| pnpm 10 en `node-linker=isolated`, Turborepo, TypeScript en références de projets, Biome + dependency-cruiser | Frontières de paquets vérifiables en CI, cache de tâches, une seule chaîne de compilation | npm workspaces (hoisting), Nx (trop lourd) |
| Onze paquets, dont `@basedb/http`, `@basedb/auth` et `@basedb/ai` | Ce que le noyau exclut — intergiciel partagé, cryptographie, réseau sortant — doit vivre dans un paquet testable isolément, pas dans une application | Intergiciel dupliqué ; OIDC et appels d'IA dans `apps/api` |
| Hono | Objets `Request`/`Response` standard partagés avec MCP, tests sans socket, routage dynamique | Fastify (schéma d'abord inutile ici) |
| Zustand pour l'état d'interface éphémère seul ; toute présentation enregistrée est une vue de catalogue | Évite un second cache de données serveur et un état persistant invisible du produit | TanStack Query ; largeurs et filtres stockés côté client |
| Le noyau expose des opérations, jamais une connexion ; contexte opaque produit par `ouvrirContexte(justificatif)` | Point d'application unique des permissions, garanti par la carte `exports` et non par la discipline | Adaptateurs affirmant une identité déjà vérifiée |
| Écriture d'enregistrement : une transaction, une connexion `donnees` ; capture par déclencheur vers `_basedb_local`, puis drain (A9, A10) | Une écriture SQL directe est historisée comme les autres, et la transaction ne franchit jamais la frontière catalogue/données | Historique écrit par le noyau ; `_outbox` dans le schéma de données ; transaction distribuée |
| Trois pools `catalogue` / `donnees` / `ddl`, le DDL sur le pool dédié | Une étape de migration qui puise dans le pool de service fait tomber les lectures | Nomenclatures concurrentes ; DDL sur le pool catalogue |
| Migration = machine à états persistée, étapes numérotées, chacune dans sa transaction (A11) | Seul moyen d'utiliser `NOT VALID`/`VALIDATE` et `CREATE INDEX CONCURRENTLY` sans tenir un `ACCESS EXCLUSIVE` jusqu'au commit | Transaction unique par migration |
| Le journal de migration n'est jamais écrit dans la transaction qu'il décrit ; `error_sample` collecté avant la tentative | Après un échec de DDL, la transaction est abandonnée : rien ne pourrait y être écrit | Statut `failed` écrit dans la transaction du DDL |
| Visibilité des définitions par `definition_state` `pending` → `active` | Tient l'atomicité exigée par le cadrage du point de vue des lecteurs, malgré un plan en plusieurs étapes | Rendre visible une définition partiellement matérialisée |
| Index systématique sur toute colonne de clé étrangère, créé `CONCURRENTLY` en étape distincte | Sans lui, chaque suppression d'une ligne référencée scanne la table référençante | Index laissé au choix de l'utilisateur |
| Intervalle `catalog_version_min` / `catalog_version_max_connu`, `BASEDB_ROLE=serve` par défaut | Rend possibles le déploiement progressif et le retour à l'image précédente | Égalité stricte de version, `both` par défaut |
| Échéance dans le contexte, `SET LOCAL statement_timeout` par instruction, budget global de rejeu | Empêche le serveur de travailler pour des clients partis et le rejeu de s'auto-alimenter | Délais fixes par pool uniquement |
| Délais d'acquisition et files bornées sur les trois pools, contrôle de préflux | Une saturation doit produire un 503 typé, pas une file qui enfle ; `max_connections` est un plafond subi | File illimitée côté Node |
| Cache de schéma à durée de vie bornée, sondage périodique, `42703`/`42P01` = relecture + rejeu unique | En multi-instances, la péremption est une course normale, pas une dérive | `NOTIFY` comme seule garantie de fraîcheur |
| Deux rôles en CI : `basedb_ci_bootstrap` (CREATEDB, harnais) et `basedb_app` (propriétaire seul, produit) | Rend exécutable le job qui protège la contrainte d'infrastructure du cadrage | Un rôle unique, qui invaliderait la démonstration |
| Tout ce dont `b_*` dépend vit dans `_basedb_local`, nom figé ; aucun objet de `b_*` ne référence `_basedb` (A9) | La séparation physique reste possible sans toucher aux tables utilisateur ; un `UPDATE` écrit en psql reste correct | Fonctions dans `public` ou dans `_basedb` ; schéma utilitaire configurable |
| `pg_trgm`, `unaccent` et collations ICU en prérequis d'installation, sans repli (A3) | La recherche « contient » indexée et la comparaison insensible aux accents s'appuient dessus | Prétendre qu'aucune extension n'est requise ; chemin dégradé non spécifié |
| Clé d'idempotence sur toute opération de schéma | Un rejeu client produirait sinon `clients` puis `clients_2` sans aucune erreur | Déduplication par empreinte de SQL |
| Gel de la base en dérive (`frozen`, `REGISTRY_DIVERGENT`), trois issues de réparation | Ce sont les opérations de structure qui reposent sur la description fausse ; les suspendre suffit | Continuer à servir la structure ; ou refuser aussi les écritures de données |
| Codes d'erreur en anglais, un par condition, issus du registre unique (A2, A23) | Un code est un identifiant machine porté par `@basedb/contracts` et `_basedb.error_code` | Codes en français ; codes dédoublés par chapitre |
| Traduction SQLSTATE dans l'exécuteur du noyau, et nulle part ailleurs | Aucun chemin n'exécute de SQL sans le traverser : la traduction n'est pas oubliable | Traduction dans chaque adaptateur |
| `AsyncLocalStorage` rejeté sans exception | Le contexte, premier argument obligatoire, porte déjà `requestId` | Stockage contextuel réservé au journal |
| Une seule surcharge par tenant : le modèle d'IA | C'est la seule que le cadrage demande ; un réglage en base coûte lecture, cache et invalidation | Hiérarchie de réglages généralisée |
| Pas de rotation de clé en v1, numéro de version conservé, clé sauvegardée séparément (A25) | Une rotation annoncée sans procédure est une demi-décision ; une clé sauvegardée avec la base annule le chiffrement | Rotation esquissée ; clé dans le cliché |
| Sauvegarde et restauration de la base entière uniquement | Restaurer un schéma seul crée une dérive immédiate et casse les `DEFAULT` de clé primaire | Restauration partielle par schéma |

## Risques et limites connues

- **Le drain introduit un retard.** L'historique et les webhooks d'une écriture sont visibles avec un décalage borné par la période du drain (5 s) et surveillé (§8.5). En cas d'arrêt prolongé, les tampons croissent et la lecture d'historique, qui doit les fusionner avec `_basedb`, se dégrade avant tout le reste ; aucune contre-pression n'est appliquée aux écritures en v1.
- **La capture par déclencheur a un coût par ligne écrite**, sur toutes les tables utilisateur, et ne renseigne pas `_updated_by` pour une écriture SQL directe. Une écriture hors application est donc identifiable par un `_updated_by` nul : c'est une information, pas une garantie.
- **Le découpage d'une migration en étapes rend la panne visible.** Un plan interrompu laisse une base en `frozen` jusqu'à intervention humaine. C'est voulu — mieux vaut un refus explicite qu'une structure à moitié appliquée — mais cela suppose que quelqu'un lise l'écran d'administration.
- **`VALIDATE CONSTRAINT` reste long sur une table volumineuse** : il ne bloque pas le DML mais consomme des entrées-sorties pendant plusieurs minutes. Le budget d'étape par défaut (300 s) devra être relevé sur les très grosses tables, réglage d'exploitation.
- **Les trois prérequis d'extension sont subis.** Si l'hébergeur ne fournit pas `pg_trgm`, `unaccent` ou les collations ICU et que le rôle n'a pas le droit de les installer, le produit ne démarre pas.
- **Trois répliques tiennent sous `max_connections = 100`** avec les tailles par défaut. Monter à cinq exige de réduire les pools ou d'augmenter `max_connections` ; le contrôle de préflux refuse de démarrer plutôt que de le découvrir sous charge, mais il ne le résout pas.
- **Aucune métrique au-delà du journal.** Le diagnostic repose sur la ligne de compteurs et sur la corrélation par `requestId`. Un besoin de percentiles de latence imposera une brique de plus, décision reportée.
- **L'exclusion mutuelle des tâches planifiées est probabiliste** : le bail et le jeton de cloisonnement rendent une double exécution inoffensive, ils ne la rendent pas impossible. Chaque tâche doit rester idempotente.
- **La détection des requêtes traversant la frontière repose sur les constructeurs SQL.** Un chemin d'exécution qui les contournerait échapperait au contrôle ; c'est le rôle de la carte `exports` de rendre ce contournement impossible, et de la revue de le rester.

## Questions ouvertes

1. **Collation de la base d'accueil.** L'unicité et le tri des identifiants physiques sont immunisés par `COLLATE "C"`, mais la collation par défaut de la base conditionne le comportement des index utilisateur sur colonnes texte. Imposer `LC_COLLATE=C` à la création de la base serait une exigence d'infrastructure supplémentaire, que le cadrage cherche à minimiser ; le refus de démarrer si elle n'est pas tenue reste à arbitrer.
2. **Nombre de répliques cible et `max_connections` disponible chez l'hébergeur retenu.** Les tailles de pool par défaut sont dimensionnées pour trois répliques sur `max_connections = 100` ; une cible différente change les valeurs du §3.1.
