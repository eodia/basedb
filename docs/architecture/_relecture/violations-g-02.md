# Violations residuelles a corriger — groupe g-02

Chaque entree a ete relevee par un verificateur qui a lu le document apres convergence.
La decision violee est citee ; sa lettre exacte est dans 00-decisions-structurantes.md.

## V1 — 02-catalogue.md [mineur]
**Decision violee** : A5 — Un registre unique des noms physiques

**Passage** : l. 254 : « Il n'existe nulle part de colonne `schema_name`, `physical_name`, `rel_name`, `fk_constraint_name` ou équivalente » — puis l. 1408, dans le DDL de `_basedb.audit_log` : « `object_name text NULL,       -- instantane du nom au moment de l'acte` ». L'entorse est assumée et argumentée l. 1419, mais l'affirmation absolue de la l. 254 la contredit textuellement.

**Correction a appliquer** : Amender la l. 254 en nommant l'exception déjà admise : « Il n'existe nulle part de colonne `schema_name`, `physical_name`, `rel_name`, `fk_constraint_name` ou équivalente sur une table d'objet du catalogue, et il n'existe pas de second registre. La seule chaîne de nom conservée hors du registre est `audit_log.object_name`, instantané historique et non référence courante (voir « Journal d'audit »). » Aucune modification du DDL n'est nécessaire.

---

## V2 — 02-catalogue.md [mineur]
**Decision violee** : A24

**Passage** : § « Volumétrie, rétention et exploitation », l. 1743-1749, colonne « Rétention » : « | `app_user`, `session`, `api_token`, `auth_identity` | … | sessions révoquées : 30 jours | … | » et « | Tampons de `_basedb_local` | très chauds, purgés après drain | 24 h après `drained_at` | … | ».

**Correction a appliquer** : Dans le chapitre qui porte pourtant le semis normatif de `retention_policy`, la colonne « Rétention » cite deux durées (30 jours pour les sessions révoquées, 24 h pour les tampons) qui ne correspondent à aucun objet déclaré par A24 — la ligne « Événements sortants drainés | 7 jours » d'A24 visant `_basedb.change_event`, comme l'établit la l. 1459. Correction : ajouter `revoked_session` (30 jours) et `capture_buffer` (24 h) à la table d'A24 et au semis l. 1551-1556 ; ou remplacer ces deux valeurs par « hors `retention_policy`, délai d'entretien fixé au §… » afin qu'aucune durée ne soit déclarée hors de la table d'A24.

---

## V3 — 02-catalogue.md [bloquant]
**Decision violee** : Récapitulatif de demandes au catalogue non absorbé (8 §15.6) ; cohérence d'ensemble : un mécanisme décrit par le chapitre 08 est inapplicable avec le DDL du chapitre 02

**Passage** : « CREATE TABLE _basedb.idempotency_key ( key text COLLATE "C" PRIMARY KEY, token_id uuid NOT NULL REFERENCES _basedb.api_token(id) ON DELETE CASCADE, tool, params_hash, response, created_at, expires_at ); ». Le chapitre 08 §3.3 exige « la ligne est insérée … avec `response` à NULL et un bail daté : c'est la revendication, et l'unicité de `key` dans la portée de l'acteur sérialise deux réessais concurrents », produit `IDEMPOTENCY_IN_PROGRESS` (bail valide), `IDEMPOTENCY_INTERRUPTED` (bail expiré), `IDEMPOTENCY_STALE` (`authz_version` modifiée) et mémorise « la réponse mémorisée et son code HTTP ». Aucune colonne de bail, d'`authz_version` ni de code HTTP n'existe, et `token_id NOT NULL` interdit l'usage par un acteur de session, alors que `Idempotency-Key` est accepté sur toutes les routes `POST` de `/api/v1`. La demande ne survit que sous forme de ligne de récapitulatif dans 08 §15.6 : « `_basedb.idempotency_key` étendue à la portée acteur et à l'état d'une revendication (§3.3) | Schéma du catalogue ».

**Correction a appliquer** : Dans 02-catalogue.md, remplacer le DDL par : clé primaire composite `(actor_kind, actor_id, key)` avec `actor_kind text COLLATE "C" NOT NULL CHECK (actor_kind IN ('user','token'))` et `actor_id uuid NOT NULL` (le `token_id` actuel devenant un cas de `actor_kind = 'token'`), plus `lease_expires_at timestamptz NOT NULL`, `authz_version bigint NOT NULL` et `http_status smallint NULL`. Conserver `idx_idempotency_expiry`. Puis supprimer cette ligne du tableau 08 §15.6.

---

## V4 — 02-catalogue.md [majeur]
**Decision violee** : A5 — un détenteur unique, jamais de duplication ; contredit frontalement le chapitre 12

**Passage** : Vue d'ensemble, ligne 26 : « │  └── authz_version, ai_model » ; DDL de `_basedb.tenant`, ligne 363 : « ai_model       text NULL,                   -- surcharge du modele d'instance (chapitre 12) ». Or 12 §3.1 écrit : « Dans `_basedb.setting`, seul détenteur … Par application du principe de détenteur unique (A5), **aucune colonne de `_basedb.tenant` ne duplique ces valeurs** : un réglage à deux emplacements finit par diverger », et 12 §9 point 3 : « Aucun objet du catalogue autre que `setting`, `secret` et `ai_call` ne mentionne l'IA ». La surcharge de modèle est servie par la clé `ai.model` de portée tenant.

**Correction a appliquer** : Supprimer la colonne `ai_model text NULL` du DDL de `_basedb.tenant` (ligne 363) et le fragment « , ai_model » de la ligne 26 de la vue d'ensemble. Ne rien ajouter ailleurs : la surcharge vit déjà dans `_basedb.setting` sous `('tenant', <tenant_id>, 'ai.model')`, couverte par la contrainte `uq_setting UNIQUE NULLS NOT DISTINCT (scope_kind, tenant_id, key)`.

---

## V5 — 02-catalogue.md [mineur]
**Decision violee** : Cohérence d'ensemble : un espace de nommage annoncé doit être peuplé par le chapitre qui le reçoit ; récapitulatif de demandes non absorbé (04 §11.1)

**Passage** : « Nomenclature des classes de dérive — Les classes sont préfixées par leur chapitre d'origine … : `CAT-` pour ce chapitre, `NOM-` pour le chapitre 01, `DDL-` pour le 03, `CYCLE-` pour le 06, `HIST-` pour le 07. » Aucun code `NOM-` n'existe dans 01-conventions-nommage.md : son §11.4 dit « Le présent chapitre n'y ajoute qu'une classe » sans la nommer, et son contenu recouvre en partie `CAT-NAME` déjà défini ici. Symétriquement, 04 §11.1 réclame « **Trois contrôles de réconciliation**, en plus des classes `CAT-*` du chapitre 02 » — empreinte physique du §1.2, réassainissement HTML, compteur d'attributs du §1.13 — sans nom de classe, et aucun préfixe n'est réservé au chapitre 04 dans cette nomenclature.

**Correction a appliquer** : Dans 01-conventions-nommage.md §11.4, nommer la classe `NOM-REG` et préfixer les cinq lignes de son tableau d'écarts par ce code ; préciser qu'elle se restreint au registre des noms et renvoie à `CAT-NAME` pour la part déjà couverte. Dans 02-catalogue.md, ajouter « `TYPE-` pour le 04 » à la liste des préfixes. Dans 04-types-de-champs.md §11.1, nommer les trois contrôles `TYPE-FP` (empreinte physique du §1.2), `TYPE-HTML` (forme canonique du HTML riche) et `TYPE-ATTR` (compteur d'attributs du §1.13), et remplacer le reste du §11.1 — liste des tables du catalogue, objets de `_basedb_local` — par un renvoi d'une ligne au chapitre 02, ces objets y étant déjà tous définis.

