# Violations residuelles a corriger — groupe g-11

Chaque entree a ete relevee par un verificateur qui a lu le document apres convergence.
La decision violee est citee ; sa lettre exacte est dans 00-decisions-structurantes.md.

## V1 — 11-interface.md [bloquant]
**Decision violee** : A2 — Identifiants système en anglais (les codes d'erreur de l'API sont nommés en anglais, en MAJUSCULES_ASCII)

**Passage** : Le chapitre emploie quinze codes d'erreur français : `CURSEUR_PERIME` (l. 53), `TRI_NON_DISPONIBLE` et `REQUETE_TROP_COUTEUSE` (l. 66), `CHAMP_INCONNU` (l. 69), `CHAMP_REQUIS_MANQUANT` (l. 135), `CHAMP_NON_INSCRIPTIBLE` (l. 138), `TABLE_EN_MIGRATION` (l. 139, 394), `CATALOGUE_DESYNCHRONISE` (l. 140, 457), `DELAI_DEPASSE` (l. 141), `CREATION_IMPOSSIBLE` (l. 157), `CASCADE_CONFIRMATION_REQUISE` et `CASCADE_TROP_LARGE` (l. 168), `OPTION_UTILISEE` (l. 409), `LONGUEUR_VALEURS_DEPASSEES` (l. 410), `MIGRATION_TROP_LARGE` (l. 411), `ACTION_INTERDITE` (l. 424), plus `VALIDATION` (l. 134) qui n'est pas le code du registre. Exemple, l. 424 : « | Ressource visible, action refusée | `403 ACTION_INTERDITE`, affiché tel quel. »

**Correction a appliquer** : Remplacer chaque occurrence par le code anglais déjà porté par le registre unique et employé par les chapitres 03, 04, 05, 06 et 08 : CURSEUR_PERIME→`CURSOR_STALE` ; TRI_NON_DISPONIBLE→`SORT_UNAVAILABLE` ; REQUETE_TROP_COUTEUSE→`QUERY_TOO_EXPENSIVE` ; CHAMP_INCONNU→`FIELD_UNKNOWN` ; CHAMP_REQUIS_MANQUANT→`REQUIRED_FIELD_MISSING` ; CHAMP_NON_INSCRIPTIBLE→`FIELD_NOT_WRITABLE` ; TABLE_EN_MIGRATION→`TABLE_MIGRATING` ; CATALOGUE_DESYNCHRONISE→`CATALOG_DRIFT_DETECTED` ; DELAI_DEPASSE→`TIMEOUT_EXCEEDED` ; CREATION_IMPOSSIBLE→`CREATE_IMPOSSIBLE` ; CASCADE_CONFIRMATION_REQUISE→`CASCADE_CONFIRMATION_REQUIRED` ; CASCADE_TROP_LARGE→`CASCADE_TOO_LARGE` ; OPTION_UTILISEE→`OPTION_IN_USE` ; LONGUEUR_VALEURS_DEPASSEES→`LENGTH_VALUES_EXCEEDED` ; MIGRATION_TROP_LARGE→`MIGRATION_TOO_LARGE` ; ACTION_INTERDITE→`ACTION_FORBIDDEN` ; VALIDATION→`VALIDATION_FAILED`. Les libellés affichés à l'humain (`error.message`) restent en français, conformément au second alinéa d'A2.

---

## V2 — 11-interface.md [majeur]
**Decision violee** : A2 — Identifiants système en anglais (vocabulaire unique des opérateurs de filtre, chapitre 04 §9)

**Passage** : l. 259-260 : « Elle emploie `contient` si la colonne d'affichage est recherchable — donc servie par l'index trigramme —, `commence_par` sinon. »

**Correction a appliquer** : « Elle emploie `contains` si la colonne d'affichage est recherchable — donc servie par l'index trigramme —, `starts_with` sinon. »

---

## V3 — 11-interface.md [mineur]
**Decision violee** : A14 (codes de la confirmation applicative) et A23 (« Un chapitre peut y ajouter un code, jamais en renommer un »), A2 (codes en MAJUSCULES_ASCII anglais)

**Passage** : Ligne 168 : « `CASCADE_CONFIRMATION_REQUISE` remplit le panneau ; `CASCADE_TROP_LARGE` le refuse et renvoie vers une opération d'administration. »

**Correction a appliquer** : Ces deux codes sont des traductions françaises de `CASCADE_CONFIRMATION_REQUIRED` et `CASCADE_TOO_LARGE`, définis par le chapitre 08 (§8.3 et registre lignes 1326-1327). Écrire : « `CASCADE_CONFIRMATION_REQUIRED` remplit le panneau ; `CASCADE_TOO_LARGE` le refuse et renvoie vers une opération d'administration. » (Le chapitre porte la même faute sur d'autres codes — `TABLE_EN_MIGRATION`, `CREATION_IMPOSSIBLE`, `404 INTROUVABLE` — qui relèvent d'un autre périmètre de relecture.)

---

## V4 — 11-interface.md [mineur]
**Decision violee** : A16 — forme unique de réponse pour un lien dont la table cible est illisible

**Passage** : §4.1, lignes 234-236 : « **Cible illisible.** `masked: true` n'est pas un cas d'erreur, c'est la forme unique de réponse fixée par A16. La cellule reste **modifiable** si le champ est inscriptible et **effaçable** s'il n'est pas obligatoire, mais le sélecteur ne s'ouvre pas, faute de pouvoir lister la cible. » ; tableau ligne 225 : « `masked: true` (A16) | « (non consultable) », en gris, non cliquable »

**Correction a appliquer** : Deux écarts avec le chapitre 05 §5.1, qui fait autorité sur le régime de ce cas. (a) Ligne 306 du chapitre 05 : « le champ est hors de `champs_inscriptibles`, code `FIELD_NOT_WRITABLE` », avec deux exceptions seulement — renvoyer l'objet masqué tel quel (non-changement élidé) et mettre à `NULL` si le champ n'est pas obligatoire. La branche « la cellule reste modifiable si le champ est inscriptible » n'est donc jamais atteinte et laisse croire à un chemin d'édition qui n'existe pas : écrire « La cellule n'est pas modifiable — le champ est hors de `champs_inscriptibles` (chapitre 05 §5.1) — mais elle reste **effaçable** si le champ n'est pas obligatoire ; le sélecteur ne s'ouvre pas, faute de pouvoir lister la cible. » (b) Le libellé de cellule diverge : « (non consultable) » ici, « une pastille neutre « enregistrement lié » » au chapitre 05 ligne 306. Retenir une seule formulation et l'employer dans les deux chapitres.

---

## V5 — 11-interface.md [majeur]
**Decision violee** : A23 (registre unique des codes d'erreur) et A2 (codes en anglais)

**Passage** : L53 : « `CURSEUR_PERIME` est traité de même, sous un bandeau “la structure a changé, la liste a été rechargée”. »

**Correction a appliquer** : Remplacer `CURSEUR_PERIME` par `CURSOR_STALE` (code du registre, chapitre 08 §6.2 et tableau §16).

---

## V6 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L66 : « `TRI_NON_DISPONIBLE` retire l'option ; `REQUETE_TROP_COUTEUSE` fait échouer le tri… »

**Correction a appliquer** : Remplacer `TRI_NON_DISPONIBLE` par `SORT_UNAVAILABLE` et `REQUETE_TROP_COUTEUSE` par `QUERY_TOO_EXPENSIVE` (chapitre 08 §13.2 et tableau des codes).

---

## V7 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L69 : « Un filtre posé sur un champ devenu invisible produit `CHAMP_INCONNU` : il est retiré de la barre… »

**Correction a appliquer** : Remplacer `CHAMP_INCONNU` par `FILTER_FIELD_UNKNOWN` (code émis par le chapitre 08 §4.4 pour un champ de filtre inconnu ou masqué).

---

## V8 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L116 : « `412 CONFLIT_VERSION` signifie que la projection visible de la ligne a changé. »

**Correction a appliquer** : Remplacer `CONFLIT_VERSION` par `VERSION_CONFLICT` (chapitre 08).

---

## V9 — 11-interface.md [majeur]
**Decision violee** : A23 (un code par condition, pas de doublon) / A2

**Passage** : L134 : ligne « | `VALIDATION` | Cellule, par entrée de `details.violations[]` | Aucune | » du tableau §2.3

**Correction a appliquer** : Remplacer `VALIDATION` par `VALIDATION_FAILED`, seul code du registre pour cette condition (chapitre 08 §8, tableau §16).

---

## V10 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L135 : « | `CHAMP_REQUIS_MANQUANT` | Cellule | Aucune | »

**Correction a appliquer** : Remplacer `CHAMP_REQUIS_MANQUANT` par `REQUIRED_FIELD_MISSING` (chapitre 08).

---

## V11 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L138 : « | `CHAMP_NON_INSCRIPTIBLE` | Cellule | Aucune. Ce code ne devrait pas survenir (§7) | »

**Correction a appliquer** : Remplacer `CHAMP_NON_INSCRIPTIBLE` par `FIELD_NOT_WRITABLE` (chapitre 05 §3.1 et chapitre 09).

---

## V12 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L139 et L394 : « | `TABLE_EN_MIGRATION` (503) | Bandeau de table | … » et « …sous le bandeau `TABLE_EN_MIGRATION`. »

**Correction a appliquer** : Remplacer les deux occurrences de `TABLE_EN_MIGRATION` par `TABLE_MIGRATING` (chapitre 08).

---

## V13 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L140 et L457 : « | `CATALOGUE_DESYNCHRONISE` (503) | Bandeau de table | … » et « `CATALOGUE_DESYNCHRONISE` recharge la description de schéma puis réessaie une fois. »

**Correction a appliquer** : Remplacer les deux occurrences par `CATALOG_DRIFT_DETECTED` (chapitre 08).

---

## V14 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L141 : « | `DELAI_DEPASSE` (504) | Bandeau de ligne | Réessai manuel | »

**Correction a appliquer** : Remplacer `DELAI_DEPASSE` par `TIMEOUT_EXCEEDED` (chapitres 03 et 08).

---

## V15 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L157 : « …la réponse est `CREATION_IMPOSSIBLE` et l'interface **n'ouvre pas** la ligne vierge… »

**Correction a appliquer** : Remplacer `CREATION_IMPOSSIBLE` par `CREATE_IMPOSSIBLE` (chapitre 05 §5 et tableau des codes §16).

---

## V16 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L168 : « `CASCADE_CONFIRMATION_REQUISE` remplit le panneau ; `CASCADE_TROP_LARGE` le refuse et renvoie vers une opération d'administration. »

**Correction a appliquer** : Remplacer par `CASCADE_CONFIRMATION_REQUIRED` et `CASCADE_TOO_LARGE` (chapitre 08).

---

## V17 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L311 : « `meta.warning = "LIENS_INVERSES_TRONQUES"` affiche “d'autres blocs existent” et un bouton de chargement. »

**Correction a appliquer** : Remplacer par `meta.warning = "REFERENCED_BY_TRUNCATED"`, valeur fixée par le chapitre 08 §5.5.

---

## V18 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L409 : « | `OPTION_UTILISEE` | Décompte des lignes portant l'option. Deux actions : archiver, ou remplacer en masse | »

**Correction a appliquer** : Remplacer `OPTION_UTILISEE` par `OPTION_IN_USE` (chapitre 04 §4 et tableau des codes).

---

## V19 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L410 : « | `LONGUEUR_VALEURS_DEPASSEES` | Échantillon des valeurs trop longues. Deux actions : annuler, ou tronquer | »

**Correction a appliquer** : Remplacer `LONGUEUR_VALEURS_DEPASSEES` par `LENGTH_VALUES_EXCEEDED` (chapitre 04 §2 et tableau des codes).

---

## V20 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L411 : « | `MIGRATION_TROP_LARGE` | “Cette opération touche plus de dix tables.” Invitation à la découper | »

**Correction a appliquer** : Remplacer `MIGRATION_TROP_LARGE` par `MIGRATION_TOO_LARGE` (chapitres 03, 06 et 10).

---

## V21 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L424 : « | Ressource visible, action refusée | `403 ACTION_INTERDITE`, affiché tel quel. **Seul** cas où l'interface montre un refus d'accès | »

**Correction a appliquer** : Remplacer `ACTION_INTERDITE` par `ACTION_FORBIDDEN` (chapitres 05 et 08).

---

## V22 — 11-interface.md [majeur]
**Decision violee** : A23 / A2

**Passage** : L456 : « `429 DEBIT_DEPASSE` affiche l'attente jusqu'à `X-RateLimit-Reset`, sans boucle »

**Correction a appliquer** : Remplacer `DEBIT_DEPASSE` par `RATE_LIMIT_EXCEEDED` (chapitre 08 §13.1).

---

## V23 — 11-interface.md [majeur]
**Decision violee** : Question ouverte déjà tranchée, et renvoi à un contenu inexistant

**Passage** : « Questions ouvertes — 1. **Vues de grille enregistrées et partagées** (colonnes, tri, filtre, largeurs) : où vit une vue partagée, et quel droit la crée ? Elle suppose une table de catalogue que le chapitre 02 ne porte pas. » Or 02-catalogue.md porte « CREATE TABLE _basedb.view_def ( … kind text NOT NULL DEFAULT 'grid' CHECK (kind IN ('grid')), spec jsonb NOT NULL DEFAULT '{}'::jsonb, -- filtres, tri, largeurs, ordre des colonnes … ) » et précise « les vues sont partagées à l'échelle de la table, et les vues personnelles sont hors périmètre v1 » ; 05-permissions.md §9 tranche le droit : « la créer, la modifier ou la supprimer logiquement suppose `manage_schema` @ base ». Le §1.4 et la ligne « aucun contrat serveur n'existe pour une vue en v1 » des « Décisions retenues » propagent la même erreur.

**Correction a appliquer** : Supprimer la question ouverte 1. Réécrire §1.4 : « Une disposition de grille nommée et partagée est une vue enregistrée `_basedb.view_def` (kind = 'grid'), dont `spec` porte filtres, tri, largeurs et ordre des colonnes ; la créer ou la modifier suppose `manage_schema` @ base (chapitre 05 §9), elle est partagée à l'échelle de la table et il n'existe pas de vue personnelle. Seule la surcharge locale non enregistrée — largeur tirée à la souris, colonne masquée à la volée — est persistée par navigateur et n'est jamais envoyée au serveur. » Dans « Décisions retenues », remplacer la cellule « aucun contrat serveur n'existe pour une vue en v1 » par « une vue enregistrée est `view_def` ; seule la surcharge locale non enregistrée reste dans le navigateur », et l'alternative écartée « vues persistées au catalogue » par « tout état de colonne persisté au catalogue, y compris non nommé ». Corriger en conséquence le point 4 des « Risques et limites connues ».

---

## V24 — 11-interface.md [majeur]
**Decision violee** : Question ouverte déjà tranchée, et renvoi à une valeur qui n'existe dans aucun chapitre

**Passage** : « Questions ouvertes — 5. **Nombre de blocs de liens inverses chargés d'emblée** : le chapitre 04 annonce 20 blocs et 50 lignes, le chapitre 08 en sert 25 avec un aperçu de 3. Ce chapitre suit le contrat du chapitre 08, qui est la réponse réellement rendue. » Le chiffre 25 n'existe nulle part : 08 §5.6 pose « au plus **20 groupes** par réponse … `count` plafonné à **500** … `preview` de **3 lignes** … la liste paginée d'un groupe suit les bornes ordinaires de `limit` (défaut 50) », et ses « Décisions retenues » répètent « 20 groupes, `count` plafonné à 500, aperçu de 3 ». 04 §6 pose « Au plus **20 blocs** » et « Par bloc, **50 lignes** au plus », soit la même borne et la taille de page : il n'y a ni divergence, ni question.

**Correction a appliquer** : Supprimer la question ouverte 5 et renuméroter. Si le chiffre doit rester visible, l'énoncer comme un fait dans §5.2 : « Le résumé sert au plus 20 blocs, un compteur plafonné à 500 et un aperçu de 3 lignes (chapitre 08 §5.6) ; la liste paginée d'un bloc suit la limite ordinaire de 50. »

---

## V25 — 11-interface.md [majeur]
**Decision violee** : A2 — codes d'erreur en MAJUSCULES_ASCII anglaises ; A23 — registre unique, un code par condition, jamais renommé

**Passage** : §2.3 : « | `VALIDATION` | Cellule … | `CHAMP_REQUIS_MANQUANT` | Cellule … | `CHAMP_NON_INSCRIPTIBLE` | Cellule … | `TABLE_EN_MIGRATION` (503) … | `CATALOGUE_DESYNCHRONISE` (503) … | `DELAI_DEPASSE` (504) … » ; §8 : « `429 DEBIT_DEPASSE` affiche l'attente jusqu'à `X-RateLimit-Reset` … ; `CATALOGUE_DESYNCHRONISE` recharge la description de schéma ». Aucun de ces sept codes n'existe dans le registre : 08 §18 définit `VALIDATION_FAILED`, `REQUIRED_FIELD_MISSING`, `TABLE_MIGRATING`, `CATALOG_DRIFT_DETECTED`, `TIMEOUT_EXCEEDED` et `RATE_LIMIT_EXCEEDED`, et 04 §12 définit `COMPUTED_FIELD_READ_ONLY`.

**Correction a appliquer** : Remplacer un pour un dans le tableau du §2.3 et dans le paragraphe du §8 : `VALIDATION` → `VALIDATION_FAILED` ; `CHAMP_REQUIS_MANQUANT` → `REQUIRED_FIELD_MISSING` ; `CHAMP_NON_INSCRIPTIBLE` → `COMPUTED_FIELD_READ_ONLY` ; `TABLE_EN_MIGRATION` → `TABLE_MIGRATING` ; `CATALOGUE_DESYNCHRONISE` → `CATALOG_DRIFT_DETECTED` (deux occurrences) ; `DELAI_DEPASSE` → `TIMEOUT_EXCEEDED` ; `DEBIT_DEPASSE` → `RATE_LIMIT_EXCEEDED`. Aucun code n'est à ajouter au registre : tous existent déjà.

