# Violations residuelles a corriger — groupe g-08-09

Chaque entree a ete relevee par un verificateur qui a lu le document apres convergence.
La decision violee est citee ; sa lettre exacte est dans 00-decisions-structurantes.md.

## V1 — 08-api-rest-webhooks.md [bloquant]
**Decision violee** : A2 — Identifiants système en anglais (vocabulaire unique des opérateurs de filtre, que le chapitre 04 §9 déclare « exposé tel quel par l'API REST et par le MCP (A2) », treize entrées en anglais)

**Passage** : §4.2, l. 326 : « les identifiants qu'il expose dans `filter` sont exactement ceux de ce tableau — `egal`, `egal_insensible`, `different`, `contient`, `commence_par`, `finit_par`, `dans`, `est_vide`, `superieur`, `superieur_egal`, `inferieur`, `inferieur_egal`, `entre`, `avant`, `avant_egal`, `apres`, `apres_egal` ». Même vocabulaire l. 320 (`egal`, `different`, `dans`, `est_vide`), l. 334 (`superieur_egal`, `contient`, `est_vide`), l. 346 (`est_vide`), l. 361/598/1026 (`filter=_updated_at apres_egal …`) et l. 1108 (`egal`, `dans`, `commence_par`, `contient`, `finit_par`).

**Correction a appliquer** : Reprendre mot pour mot les treize opérateurs du chapitre 04 §9 : `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`, `gt`, `gte`, `lt`, `lte`, `between`. La phrase de l. 326 devient « … sont exactement ceux de ce tableau — `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`, `gt`, `gte`, `lt`, `lte`, `between` — » ; supprimer les quatre entrées `avant`/`avant_egal`/`apres`/`apres_egal`, qui n'existent pas au chapitre 04 (les dates emploient `gt`/`gte`/`lt`/`lte`). Réécrire les exemples : `filter=_updated_at gte "2026-09-18T13:59:30Z"` (l. 361, 598, 1026) ; l. 320 → `eq`, `ne`, `in`, `is_null` ; l. 334 → `gte`, `contains`, `is_null` ; l. 346 → `is_null` ; l. 1108 → `eq`, `in`, `starts_with`, `contains`, `ends_with`. Par cohérence, aligner aussi les mots-clés de la grammaire l. 301-303 (`ou`/`et`/`non` → `or`/`and`/`not`) et l'exemple `non (statut dans ["paye","annule"])` l. 328.

---

## V2 — 09-serveur-mcp.md [majeur]
**Decision violee** : A2 — Identifiants système en anglais (vocabulaire unique des opérateurs de filtre, chapitre 04 §9, dérivé par la description MCP « sans en ajouter ni en renommer aucun »)

**Passage** : l. 244 : « "filter": { "factures_id": { "op": "egal", … » ; l. 770 : « "filter": [ { "field": "email", "op": "egal", "value_digest": "h:3f9a1c7d" } ] ».

**Correction a appliquer** : Écrire `"op": "eq"` dans les deux exemples. Corriger aussi le gabarit de l. 333, `{"champ": {"op": …, "value": …}}`, en `{"<field>": {"op": …, "value": …}}` : le nom de clé illustratif doit être un métavariable anglaise, comme partout ailleurs dans le chapitre.

---

## V3 — 09-serveur-mcp.md [majeur]
**Decision violee** : A2 — Identifiants système en anglais (identifiant machine d'un gabarit fermé livré par le noyau, en `snake_case`)

**Passage** : l. 459, charge utile rendue à l'agent : « `"summary_template": "ajout_champ_lien",` ». Le §7.7 (l. 527) précise qu'il s'agit d'un « identifiant d'un gabarit fermé » : c'est un identifiant machine, pas un message destiné à l'humain.

**Correction a appliquer** : « `"summary_template": "add_link_field",` ». Le rendu de ce gabarit reste en français, comme tout message destiné à l'humain (second alinéa d'A2) ; seule la clé change.

---

## V4 — 08-api-rest-webhooks.md [mineur]
**Decision violee** : A2 — Identifiants système en anglais

**Passage** : l. 70 : « | `GET` | `/data/{base}/{table}/{id}/referenced_by/{table_source}.{champ}` | » — le chemin mélange des segments anglais et deux paramètres français ; même forme l. 308 dans la grammaire de filtre : « `path      = ident , [ "." , ident ]        (* profondeur 1, uniquement <champ_lien>.<champ_cible> *)` », et l. 308 de `11-interface.md`.

**Correction a appliquer** : Écrire `/data/{base}/{table}/{id}/referenced_by/{source_table}.{field}` (08 l. 70 et 11 l. 308) et, dans la grammaire, « (* profondeur 1, uniquement `<link_field>.<target_field>` *) » (08 l. 306). Ces segments figurent dans l'URL publique et dans la spécification OpenAPI générée : ce sont des identifiants d'API, pas du texte de prose.

---

## V5 — 08-api-rest-webhooks.md [mineur]
**Decision violee** : A24

**Passage** : §16.3, l. 1252 : « Les durées sont celles de A24, déclarées une fois dans `_basedb.retention_policy` et toutes configurables. Ce chapitre n'en fixe aucune ; il nomme le mode de purge. » puis, dans le tableau : « | `_basedb.idempotency_key` | `_basedb` | 24 h (`expires_at`) | tâche horaire | », « | Compteurs horaires d'usage de jeton | `_basedb` | 90 jours | tâche quotidienne | », « | Journaux techniques | hors base | 30 jours | rotation | » ; même chiffre en §14.3, l. 1162 (« une rétention de 30 jours ») et §16.2, l. 1155.

**Correction a appliquer** : Trois des six lignes fixent des durées pour des objets absents de la table d'A24 et du semis de `retention_policy`, ce qui contredit la phrase d'introduction du même paragraphe. Correction : soit ajouter `idempotency_key` (24 h), `token_usage_counter` (90 jours) et `technical_log` (30 jours) à la table d'A24 et au semis du chapitre 02, soit retirer ces trois lignes du tableau §16.3 et les traiter comme des délais propres au chapitre — sur le modèle explicite de 06-cycle-de-vie.md §8.2, qui écrit « Ce chapitre ne fixe que les délais propres au cycle de vie » — en corrigeant alors la phrase l. 1252 en « Ce chapitre ne fixe que les délais d'expiration qui lui sont propres ».

---

## V6 — 08-api-rest-webhooks.md [mineur]
**Decision violee** : A20 — signature du décideur (cohérence avec le chapitre 05)

**Passage** : L17 (invariant I2) : « …sans avoir reçu le quadruplet `(autorise, colonnes_lisibles, colonnes_ecrivables, predicat_lignes)` issu du point d'application unique (§2.4) » ; et §2.4 L160-167, qui définit un résultat à cinq composantes, sans `champs_effacables`.

**Correction a appliquer** : Le prédicat de lignes est bien présent : le fond d'A20 est appliqué. Reste un écart de nomenclature avec le chapitre 05 §6.1, qui fixe six composantes (`verdict`, `champs_lisibles`, `champs_inscriptibles`, `champs_effacables`, `predicat_lignes`, `raison`) et énonce que sans `champs_effacables` « l'adaptateur REST devrait retester… c'est-à-dire porter une règle d'autorisation hors du point d'application ». Aligner I2 et §2.4 sur le chapitre 05 : parler du « résultat de décision » plutôt que d'un « quadruplet », et reprendre les noms `champs_lisibles` / `champs_inscriptibles` / `champs_effacables` / `predicat_lignes`.

