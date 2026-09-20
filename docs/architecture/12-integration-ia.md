# 12 — Intégration des fournisseurs d'IA

## Rôle de ce chapitre

Ce chapitre spécifie les appels **sortants** vers OpenAI, Anthropic et Mistral : à quoi
ils servent en v1, ce que le noyau expose, où vivent le fournisseur, le modèle et les
clés, ce qui quitte l'installation, ce que cela coûte, et ce qui en est journalisé.

La surface entrante — un agent extérieur qui se connecte au produit — appartient à
« Serveur MCP ». Ici le produit est client d'un modèle tiers ; là il est serveur d'un
agent que l'utilisateur héberge.

---

## 1. Périmètre v1

### 1.1 Deux règles de cadrage

Le cadrage nomme les fournisseurs sans dire à quoi l'IA sert. Le périmètre est donc
dérivé de deux règles, dont tout le reste du chapitre découle :

> **INV-IA1 — Une fonction d'IA ne produit jamais un effet. Elle produit un
> brouillon typé, exprimé dans une grammaire fermée du produit, que le produit
> revalide et qu'un humain applique par les chemins ordinaires.**

> **INV-IA2 — Aucune donnée d'enregistrement ne quitte l'installation. Ce qui part
> se limite aux libellés et aux types du catalogue, et à la phrase saisie par
> l'utilisateur.**

INV-IA1 interdit qu'une réponse de modèle devienne du DDL appliqué, une écriture de
ligne ou une permission accordée. INV-IA2 est la contrepartie de l'auto-hébergement :
qui installe basedb pour que ses données restent chez lui doit pouvoir activer l'IA
sans les en faire sortir.

### 1.2 Les deux usages retenus

| Usage (`usage_kind`) | Entrée | Sortie | Acte qui suit |
|---|---|---|---|
| `structure_draft` | Une description de besoin, plus les libellés et types des tables existantes de la base | Une proposition de tables, champs et liens, dans le vocabulaire de « Types de champs et projection vers PostgreSQL » | Le brouillon est amendé dans l'éditeur de schéma ; l'enregistrement produit une migration proposée, approuvée selon « Moteur DDL et stratégie de migration » |
| `expression_draft` | Une phrase, plus les libellés et types des champs de la table visée | Une formule ou un filtre, dans la grammaire fermée de « Types de champs » et de « API REST, OpenAPI, webhooks, jetons d'intégration » | L'expression s'affiche dans l'éditeur, passe le validateur ordinaire, et n'est enregistrée que par une action explicite |

La réponse est exigée sous forme structurée et validée contre un schéma avant d'être
montrée. Une réponse non conforme est rejetée, jamais réinterprétée : le texte libre
d'un modèle n'est exécuté nulle part.

### 1.3 Pourquoi ceux-là

Ce sont les deux endroits où la barrière à l'entrée est réelle — créer un schéma
correct du premier coup, écrire une expression dans une grammaire qu'on découvre — et
l'IA y remplace une lecture de documentation, pas un jugement métier. Ce sont aussi
les deux seuls usages qui se satisfont du **catalogue seul**, et ils tombent sur des
chemins de validation existants : aucun code de confiance nouveau n'est introduit.

### 1.4 Hors périmètre v1

- **Tout usage portant sur le contenu** : champ de type « IA », enrichissement
  automatique, résumé, traduction, classification, génération dans une cellule. Ils
  violent INV-IA2 et transformeraient chaque écriture en appel facturé.
- **Recherche sémantique et plongements vectoriels** : extension hors de la liste d'A3,
  stockage vectoriel par tenant, réindexation — un sous-système entier pour un besoin
  non demandé.
- **Conversation sur les données** : c'est ce que sert « Serveur MCP », avec l'agent de
  l'utilisateur, ses clés et son budget.
- **Agent autonome, action déclenchée par événement, exécution différée, diffusion en
  continu, cache sémantique, modèle hébergé localement, bascule entre fournisseurs,
  refacturation.**

---

## 2. Abstraction des fournisseurs

### 2.1 Ce que les trois ont en commun

Un appel HTTPS unique authentifié par une clé en en-tête ; une consigne système suivie
d'une liste de messages ; un nom de modèle ; un plafond de jetons produits ; une réponse
contrainte par un schéma JSON ; un décompte des jetons d'entrée et de sortie ; une même
famille d'erreurs — clé refusée, débit dépassé, indisponibilité, réponse tronquée.

Cette intersection suffit aux deux usages du § 1.2 et ne s'étend pas : ni appel
d'outils, ni conversation à plusieurs tours, ni fichier joint.

### 2.2 Ce qui diffère

| Point | Traitement |
|---|---|
| Consigne système : message de rôle chez OpenAI et Mistral, paramètre distinct chez Anthropic | Adaptateur |
| Contrainte de schéma : format de réponse chez OpenAI et Mistral, outil unique chez Anthropic | Adaptateur |
| Noms des champs de décompte ; en-têtes de débit et forme des `429` | Adaptateur, qui normalise en `tokens_in` / `tokens_out` et en un délai de réessai |
| Noms de modèles, fenêtre de contexte, plafond de sortie | Table de correspondance par fournisseur |

Des différences de forme sur une même opération : de quoi justifier un adaptateur par
fournisseur, pas une abstraction plus ambitieuse. Aucune option propre à un fournisseur
ne remonte à l'appelant ; ce qui n'existe pas chez les trois n'existe pas dans le
produit.

### 2.3 Ce que le noyau expose

Conformément à « Architecture logicielle : monorepo, noyau, pools, tests », l'appel au
fournisseur n'est pas dans le noyau : **le noyau décide, l'adaptateur appelle.** Le
noyau porte l'usage demandé, l'assemblage de la charge utile, la consigne système issue
d'un gabarit fermé, le schéma de la réponse attendue, la résolution du fournisseur et
du modèle, les contrôles de consentement, de permission et de quota, la validation et
la reprojection de la réponse, et l'événement de journal. L'adaptateur porte le
transport, l'authentification, la forme propre au fournisseur, les délais, les réessais
et la normalisation.

Déroulement d'un appel, dans cet ordre, sans exception :

1. IA activée pour le tenant (§ 3.2) ? Sinon `AI_DISABLED`. Consentement présent et à
   jour (§ 5.3) ? Sinon `AI_CONSENT_REQUIRED`.
2. Droit de l'acte que le brouillon prépare (§ 7) ? Sinon, réponse du modèle de
   permissions. Fournisseur, modèle et clé résolus (§ 3.2, § 4.2) ? Sinon
   `AI_NOT_CONFIGURED`.
3. Quotas disponibles (§ 6) ? Sinon `AI_QUOTA_EXCEEDED`.
4. Assemblage de la charge utile à partir des seuls objets du catalogue lisibles par
   l'acteur, champs masqués et champs non exposés aux agents exclus (§ 5.1) ; au-delà
   des plafonds de taille, `AI_PAYLOAD_TOO_LARGE`.
5. Appel du fournisseur, budget de temps total de 20 secondes.
6. Validation contre le schéma ; en cas d'échec, un seul réessai à charge utile
   identique, puis `AI_RESPONSE_UNUSABLE`.
7. Reprojection du brouillon sur les identifiants réels, et écriture d'une ligne
   `_basedb.ai_call` (§ 6.1) quelle que soit l'issue à partir de l'étape 3.

### 2.4 Quand un fournisseur est indisponible

**Aucun basculement automatique** : un tenant a consenti à un fournisseur nommé
(§ 5.3), et le repli l'enverrait chez un tiers non consenti pour lui épargner un
message d'erreur. **Aucune file, aucun réessai différé** : un brouillon livré dix
minutes plus tard n'a plus d'objet.

Donc : réessai immédiat unique sur `429`, `5xx` et erreur réseau, respectant le délai
annoncé s'il tient dans le budget restant ; puis `AI_PROVIDER_UNAVAILABLE` avec
`Retry-After`. Après cinq échecs consécutifs sur un couple (tenant, fournisseur), le
circuit s'ouvre cinq minutes — refus immédiat, sans consommer ni quota ni temps —, une
sonde par minute le refermant. Les éditeurs restant utilisables à la main, une
indisponibilité d'IA n'est ni un incident de disponibilité, ni un échec de sonde de
vivacité.

---

## 3. Configuration

### 3.1 Où vivent le fournisseur et le modèle

Dans `_basedb.setting`, seul détenteur, sous la clé composite
`(scope_kind, tenant_id, key)` définie par « Schéma du catalogue `_basedb` ». Par
application du principe de détenteur unique (A5), **aucune colonne de `_basedb.tenant`
ne duplique ces valeurs** : un réglage à deux emplacements finit par diverger, et une
colonne dédiée ne porterait ni le fournisseur, ni le consentement, ni les plafonds.

Liste close des clés, en anglais (A2) :

| Clé | Portée | Surcharge tenant | Valeur |
|---|---|---|---|
| `ai.enabled` | instance, tenant | oui | booléen ; **défaut `false`** |
| `ai.provider` | instance, tenant | oui | `openai`, `anthropic` ou `mistral` |
| `ai.model` | instance, tenant | oui | nom de modèle, vérifié contre la table de correspondance du fournisseur |
| `ai.quota.calls_per_month` | instance, tenant | à la baisse seulement | entier |
| `ai.quota.tokens_per_month` | instance, tenant | à la baisse seulement | entier |
| `ai.consent` | tenant seulement | — | objet de consentement (§ 5.3) |

Le défaut `false` est structurant : **une installation neuve n'appelle aucun
fournisseur tant que personne ne l'a explicitement décidé.**

### 3.2 Résolution

La ligne `('tenant', <tenant_id>, <clé>)` si elle existe, sinon
`('instance', NULL, <clé>)`, sinon le défaut du code. Trois précisions opposables :

- `ai.enabled` se résout en **conjonction** : l'IA n'est active que si l'instance l'a
  activée *et* que le tenant ne l'a pas désactivée. Un tenant peut se retirer, jamais
  s'ajouter.
- `ai.provider` et `ai.model` se résolvent **ensemble** : une surcharge ne portant que
  le modèle est refusée si ce modèle n'appartient pas au fournisseur résolu
  (`AI_MODEL_UNKNOWN`).
- Les valeurs résolues sont mises en cache 30 secondes, alignées sur l'instantané
  d'autorisation de « Modèle de permissions ». Une désactivation prend donc effet en
  moins de 30 secondes ; les appels déjà partis ne sont pas rappelés.

### 3.3 Qui peut modifier

| Acte | Exigence |
|---|---|
| Réglages `ai.*` d'instance, clé d'instance | `is_instance_admin` |
| Surcharge `ai.*` du tenant, clé du tenant, consentement | Opération réservée : `tenant_admin` ou `is_instance_admin`, avec élévation et jeton de confirmation |

Ces deux lignes reprennent « Modèle de permissions », qui fait déjà de la surcharge du
modèle d'IA au niveau tenant une opération réservée. Conséquence du filtre de surface :
aucune n'est atteignable depuis la surface MCP ni depuis un jeton d'intégration.

---

## 4. Les clés

### 4.1 Stockage

Dans `_basedb.secret`, sous `ai.openai.api_key`, `ai.anthropic.api_key` et
`ai.mistral.api_key`, de portée `instance` ou `tenant`. Chiffrement au repos,
dérivation depuis `BASEDB_ENCRYPTION_KEY` et rôle de `key_version` : « Architecture
logicielle » (A25). Le secret en clair n'existe qu'en mémoire du processus serveur, le
temps de l'appel.

**Le statut de la clé est persisté par `_basedb.secret` lui-même** : les colonnes
`status` — `valid` ou `invalid` — et `status_changed_at` vivent sur la ligne du secret.
Ce n'est ni un état calculé à la volée ni un cache applicatif : une clé refusée en
amont doit le rester pour toutes les instances applicatives et après un redémarrage,
faute de quoi chacune redécouvrirait le refus à ses frais.

**Jamais transmise au front** : aucun appel ne part du navigateur, toute requête
transite par le serveur, qui seul lit la clé. L'API la traite en écriture seule —
absente de l'OpenAPI généré en lecture — et ne restitue qu'un objet de présence, qui
recopie `status` et `status_changed_at` tels quels :

```json
{
  "provider": "anthropic", "scope": "tenant", "present": true,
  "last_four": "9f2c", "fingerprint": "sha256:3b1e…",
  "key_version": 1,
  "status": "valid", "status_changed_at": "2026-04-12T09:31:07Z",
  "updated_at": "2026-04-12T09:31:07Z", "updated_by": "…"
}
```

### 4.2 Résolution

Même recherche en deux temps que les réglages, mais **pour le fournisseur résolu** : la
clé du tenant si elle existe, sinon celle de l'instance. Une clé posée pour un autre
fournisseur est ignorée, jamais utilisée en repli.

La clé d'instance est utilisable par les tenants — c'est sa raison d'être — et les
plafonds du § 6 bornent ce que l'instance paie. Un tenant ayant posé sa clé consomme la
sienne ; `ai_call.key_scope` conserve laquelle a servi, ce qui rend les coûts
répartissables sans qu'aucune facturation n'existe en v1.

### 4.3 Pose, rotation, révocation

- **Pose** : la clé est vérifiée par un appel de sonde minimal avant d'être écrite. Un
  refus vaut `AI_KEY_REJECTED` et **rien n'est stocké** — sinon une faute de frappe ne
  se révélerait qu'au premier usage réel, chez quelqu'un qui n'a pas posé la clé. La
  ligne écrite porte `status = 'valid'` et `status_changed_at` à l'instant de la pose.
- **Rotation** : une pose remplace la valeur en place, une seule ligne existant par
  couple (portée, fournisseur). La fenêtre de recouvrement est celle du fournisseur, qui
  accepte l'ancienne clé jusqu'à sa révocation chez lui ; le produit n'entretient pas
  deux secrets valides.
- **Révocation** : la suppression fait retomber la portée sur la clé d'instance ; à
  défaut, `AI_NOT_CONFIGURED`. Une clé refusée en exploitation (`401` amont) fait passer
  `_basedb.secret.status` à `'invalid'` et horodate `status_changed_at` ; les appels de
  la portée sont alors refusés avec `AI_KEY_REJECTED`, les administrateurs sont
  notifiés, et seule une nouvelle pose remet `status` à `'valid'`. Le passage à
  `'invalid'` est une écriture sur la ligne du secret, pas un drapeau en mémoire : une
  instance qui démarre après le refus n'a pas à le redécouvrir.
- **Arrêt d'urgence** : `ai.enabled = false` à la portée instance coupe tout appel en
  moins de 30 secondes sans toucher aux clés. C'est le geste des consignes
  d'exploitation, pas la suppression des secrets.

### 4.4 Ce qui est journalisé

Une entrée `audit_log` par acte — `ai.key.set`, `ai.key.revoked` — portant l'auteur,
l'horodatage, la portée, le fournisseur, `key_version`, l'empreinte et les quatre
derniers caractères. **Jamais la clé**, ni en clair, ni chiffrée, ni dans l'audit, ni
dans l'historique, ni dans une charge utile de webhook, ni dans un message d'erreur :
c'est la règle de « Modèle de permissions », dont ce chapitre est le premier
destinataire.

---

## 5. Confidentialité

Des données métier quittent une installation choisie auto-hébergée. Le traitement
retenu est de rendre la sortie **petite, énumérable et refusable**, plutôt que de la
filtrer.

### 5.1 Ce qui part, exhaustivement

| Usage | Contenu de la charge utile |
|---|---|
| `structure_draft` | Le libellé de la base ; pour chaque table et champ sélectionnés, le libellé, le type, le caractère obligatoire, et pour un lien la table cible désignée par son ordinal ; la phrase saisie |
| `expression_draft` | Le libellé de la table visée ; pour chaque champ, libellé, type, caractère obligatoire ; la phrase saisie ; le cas échéant le message du validateur sur l'essai précédent |

**Les descriptions du catalogue ne partent pas.** Un libellé est une étiquette ; une
description est un texte libre de mille caractères, où l'on écrit volontiers un nom de
client, une règle de gestion ou un seuil. La charge utile s'en tient aux libellés et aux
types, et le brouillon qui en revient n'en propose pas non plus.

Les objets sont désignés par un **ordinal éphémère** propre à l'appel, jamais par leur
identifiant ni par leur nom physique ; le noyau reprojette la réponse sur les
identifiants réels.

```json
{
  "intent": "structure_draft",
  "base_label": "CRM",
  "tables": [
    { "ref": "t1", "label": "Clients",
      "fields": [ { "ref": "f1", "label": "Raison sociale", "kind": "text", "required": true } ] },
    { "ref": "t2", "label": "Factures",
      "fields": [ { "ref": "f2", "label": "Client", "kind": "link", "target": "t1" } ] }
  ],
  "request": "ajouter le suivi des relances de paiement"
}
```

### 5.2 Ce qui ne part jamais, et ce qui le garantit

Aucune valeur de cellule, aucun `_id`, aucun nom physique, aucun identifiant de tenant,
de base, de table ou de champ, aucune adresse de courriel, aucun nom d'utilisateur,
aucun secret, aucune ligne d'historique, aucun extrait d'erreur PostgreSQL. Trois
mécanismes le garantissent, par ordre de solidité :

1. **La charge utile est assemblée dans le noyau, à partir des seuls objets du
   catalogue.** L'adaptateur d'IA ne détient aucun accès au pool `donnees` : il reçoit
   une charge utile close. Une donnée d'enregistrement ne peut y entrer que par une
   modification délibérée de l'architecture des pools, qu'un test interdit.
2. **Le masque de champs de l'acteur s'applique à l'assemblage** : un champ masqué est
   absent de la charge utile comme il l'est d'une lecture.
3. **Le marqueur `expose_to_agents = false` vaut pour toute surface impliquant un
   modèle tiers**, serveur MCP comme fournisseur d'IA : le libellé d'un champ marqué ne
   part pas. « Numéro de sécurité sociale » n'a pas besoin de contenu pour être
   sensible.

### 5.3 Ce que le tenant peut refuser

`ai.enabled = false` à la portée tenant désactive tout, même si l'instance l'a activée,
et n'est pas surchargeable par l'instance (§ 3.2).

Avant le premier appel d'un tenant, un `tenant_admin` enregistre un consentement dans
le réglage `ai.consent` :

```json
{
  "accepted_at": "2026-04-12T09:28:44Z", "accepted_by": "…",
  "provider": "anthropic", "endpoint": "https://api.anthropic.com",
  "disclosure_version": 1
}
```

Il est **lié au fournisseur et à la version de la notice**. Changer de fournisseur ou
étendre les catégories de données envoyées incrémente `disclosure_version` et
l'invalide : les fonctions d'IA répondent `AI_CONSENT_REQUIRED` jusqu'à une nouvelle
acceptation. Un consentement insensible au changement de destinataire n'en serait pas
un.

### 5.4 Ce qui doit lui être dit

La notice affichée à l'acceptation, consultable ensuite, énonce : le fournisseur et
l'adresse contactée ; les catégories envoyées, reprises littéralement du tableau du
§ 5.1 ; qu'aucune valeur d'enregistrement n'est envoyée ; que la conservation et l'usage
des données par le fournisseur échappent entièrement au produit ; que la phrase saisie
part telle quelle. Chaque écran déclenchant un appel porte, à côté du bouton, la phrase
nommant le destinataire et la catégorie envoyée ; la forme relève de « Interface ».

### 5.5 Ce qui n'est pas garanti

La phrase saisie n'est pas contrôlable : un utilisateur peut y coller une valeur de
cellule, et il n'existe pas de filtrage fiable du texte naturel. La conservation, la
région de traitement et l'usage en apprentissage côté fournisseur échappent au produit ;
le choix de l'offre contractuelle est une décision de l'exploitant. Enfin, les libellés
sont eux-mêmes des données métier : INV-IA2 borne la sortie, elle ne la supprime pas.

---

## 6. Coûts et quotas

### 6.1 Comptage

Une ligne par tentative, à partir de l'étape 3 du § 2.3, dans `_basedb.ai_call`, dont
le DDL est donné par « Schéma du catalogue `_basedb` » : auteur, horodatage, surface,
fournisseur, modèle, portée de la clé, issue, volume de jetons entrant et sortant,
durée et identifiant de requête.

Comme `audit_log`, la table est partitionnée par mois, ne porte aucune clé étrangère
vers les objets qu'elle décrit — ses partitions doivent pouvoir être détachées — et suit
le régime de partitions du même chapitre. Rétention : 24 mois (A24), alignée sur le
journal d'audit.

Le décompte vient du fournisseur ; à défaut, il est estimé depuis le volume de
caractères et `tokens_estimated` vaut `true` — une estimation nommée comme telle vaut
mieux qu'un compteur faussement exact.

**Aucun compteur agrégé n'est maintenu** : le contrôle de quota est une agrégation sur
la partition du mois courant, filtrée par tenant, servie par l'index de la table sur
`(tenant_id, occurred_at)`. À quelques centaines d'appels par tenant et par mois, la
lecture est négligeable, et un second détenteur du compte dériverait du journal.

### 6.2 Plafonds

| Plafond | Portée | Effet au dépassement |
|---|---|---|
| `ai.quota.calls_per_month` | Tenant, résolu instance puis tenant | `AI_QUOTA_EXCEEDED` |
| `ai.quota.tokens_per_month` | Tenant, résolu instance puis tenant | `AI_QUOTA_EXCEEDED` |
| Jetons produits par appel | Fixe par usage, non configurable | Réponse tronquée, traitée comme `AI_RESPONSE_UNUSABLE` |
| Charge utile : 200 tables, 2 000 champs, 64 Kio | Fixe | `AI_PAYLOAD_TOO_LARGE` |
| Simultanéité : 1 par utilisateur, 2 par tenant | Fixe | `AI_QUOTA_EXCEEDED`, sans attente |

Une surcharge de tenant sur les quotas mensuels **ne peut que les abaisser** : sinon un
`tenant_admin` relèverait son propre plafond et dépenserait la clé d'instance sans
limite. Relever un plafond est `is_instance_admin`.

Les compteurs vivent dans PostgreSQL (A4) : avec plusieurs instances applicatives, le
contrôle est approximatif dans la fenêtre d'une seconde, comme la limitation de débit de
« API REST ». L'écart est d'un appel concurrent, sans conséquence sur un plafond mensuel.

### 6.3 Au dépassement

Le refus est **préalable à l'appel** : rien n'est envoyé, donc rien n'est facturé. La
réponse porte le plafond atteint, la valeur consommée et la date de réinitialisation,
premier jour du mois civil suivant en UTC. Un appel accepté qui dépasse le plafond en
cours d'exécution n'est pas interrompu : il est compté, et c'est le suivant qui est
refusé — le dépassement est borné par le plafond de jetons d'un appel.

Le tenant est prévenu à 80 % de chaque plafond par notification interne. À l'épuisement,
les fonctions d'IA disparaissent des écrans plutôt que d'échouer au clic :
l'indisponibilité par quota est un état affichable, pas une erreur à découvrir.

---

## 7. Permissions

| Acte | Exigence |
|---|---|
| Demander un `structure_draft` | `manage_schema` @ base |
| Demander un `expression_draft` | `manage_schema` @ table |
| Appliquer un brouillon | Les droits ordinaires de l'acte, sans atténuation : proposition et approbation selon « Moteur DDL et stratégie de migration » |
| Régler `ai.*` d'instance, poser la clé d'instance | `is_instance_admin` |
| Surcharger `ai.*` du tenant, poser ou révoquer sa clé, accepter le consentement | Opération réservée + élévation + jeton de confirmation |
| Consulter les volumes agrégés de son tenant | `tenant_admin` |
| Consulter `_basedb.ai_call` ligne à ligne | Opération réservée, comme `audit_log` : la ligne nomme un auteur et l'objet sur lequel il travaillait |

- **Le droit d'usage d'une fonction d'IA est celui de l'acte qu'elle prépare.** Il
  n'existe pas de verbe `use_ai` : la liste des verbes est fermée par « Modèle de
  permissions », et un droit distinct autoriserait à faire assembler la carte des
  libellés d'une base par quelqu'un qui n'a pas le droit d'en modifier la structure.
- **L'IA n'accorde jamais rien** : la charge utile est assemblée sous le masque de
  l'acteur, le brouillon ne mentionne que des objets qu'il voyait déjà, et son
  application repasse par le point d'application unique.
- **Session seule**, surfaces `ui` et `rest` : un jeton d'intégration brûlerait la clé
  d'instance sans porteur humain identifiable, et un agent qui fait appeler un autre
  modèle par le produit est une boucle sans responsable. Un appel émis par un jeton ou
  depuis la surface MCP reçoit `404`, selon le principe d'absence de « Modèle de
  permissions ».

---

## 8. Journalisation

**Une ligne `_basedb.ai_call` par tentative**, dont le § 6.1 dit le contenu :
auteur, horodatage, surface, fournisseur, modèle, volume et résultat.

**Une entrée `audit_log` par acte de configuration** : `ai.setting.changed`,
`ai.key.set`, `ai.key.revoked`, `ai.consent.accepted`, `ai.consent.revoked`. Pour un
réglage marqué secret, la charge utile ne porte ni l'ancienne ni la nouvelle valeur.

**Traçabilité du brouillon à l'acte** : quand un brouillon donne lieu à une migration
proposée, l'entrée d'audit de la proposition porte l'identifiant de la ligne `ai_call`
dans sa charge utile. On répond ainsi à « quelles structures ont été dessinées avec
l'aide d'un modèle, et par qui » sans colonne supplémentaire sur aucun objet.

**Jamais journalisés** : la phrase de l'utilisateur, la charge utile envoyée, la réponse
du fournisseur, les libellés transmis, la clé. Le journal deviendrait sinon un second
entrepôt des mêmes données métier, à rétention et lectorat différents.

Alertes d'exploitation : `AI_PROVIDER_UNAVAILABLE` au-delà de 5 % sur une heure ;
`AI_RESPONSE_UNUSABLE` au-delà de 5 %, signe d'un modèle inadapté à la contrainte de
schéma ; ouverture d'un circuit ; clé passée en `invalid` ; plafond atteint.

---

## 9. Ce que le noyau ignore, et ce qui est reporté

Le cadrage exclut l'IA du noyau, et « Architecture logicielle » le formalise : les
appels aux fournisseurs sont un adaptateur. Trois propriétés en découlent, qui tiennent
lieu de test :

1. **Le paquet du noyau ne dépend d'aucun client de fournisseur.** Il connaît la notion
   de brouillon et la grammaire dans laquelle il s'exprime ; il ne connaît ni OpenAI, ni
   Anthropic, ni Mistral.
2. **Retirer l'adaptateur retire les fonctions et ne casse rien d'autre** : le produit
   démarre, les éditeurs fonctionnent, les tests du noyau passent. C'est la configuration
   d'une installation qui ne veut aucun appel sortant.
3. **Aucun objet du catalogue autre que `setting`, `secret` et `ai_call` ne mentionne
   l'IA** : ni colonne sur `field`, ni type de champ, ni état de migration.

Sont reportés, et nommés pour ne pas passer pour des oublis : rotation de
`BASEDB_ENCRYPTION_KEY`, budgets en unité monétaire, diffusion en continu, choix du
modèle par usage plutôt que par tenant, et tout usage portant sur le contenu des
enregistrements — lequel exigerait de rouvrir INV-IA2, donc une décision de cadrage.

---

## 10. Codes d'erreur définis par ce chapitre

Ajoutés au registre unique (A23), en anglais (A2), jamais renommés.

| Code | Condition | Niveau | HTTP |
|---|---|---|---|
| `AI_DISABLED` | `ai.enabled` faux à la portée résolue | Conflit | 409 |
| `AI_NOT_CONFIGURED` | IA activée sans fournisseur, modèle ou clé résolus | Conflit | 409 |
| `AI_CONSENT_REQUIRED` | Consentement absent ou périmé | Conflit | 409 |
| `AI_MODEL_UNKNOWN` | Modèle absent de la table de correspondance du fournisseur résolu | Validation | 422 |
| `AI_KEY_REJECTED` | Clé refusée par le fournisseur, à la pose ou en exploitation | Validation | 422 |
| `AI_QUOTA_EXCEEDED` | Plafond mensuel ou de simultanéité atteint | Conflit | 429 |
| `AI_PAYLOAD_TOO_LARGE` | Charge utile au-delà des plafonds du § 6.2 | Validation | 422 |
| `AI_PROVIDER_UNAVAILABLE` | Délai dépassé, `5xx`, `429` amont, erreur réseau, circuit ouvert | Incident | 503 |
| `AI_RESPONSE_UNUSABLE` | Réponse non conforme au schéma ou tronquée, après un réessai | Incident | 502 |

---

## Décisions retenues

| Décision | Raison | Alternative écartée |
|---|---|---|
| Deux usages, tous deux producteurs de brouillons (INV-IA1) | L'IA se branche en amont d'actes qui ont déjà leur validation | Assistant généraliste sur les données |
| Aucune donnée d'enregistrement envoyée (INV-IA2) | Activer l'IA ne doit pas faire sortir les données d'une installation auto-hébergée | Échantillon de lignes « pour le contexte » |
| Charge utile assemblée dans le noyau, adaptateur sans accès au pool `donnees` ; `expose_to_agents = false` opposable aussi aux fournisseurs d'IA | Fait d'INV-IA2 une propriété testable, pas une consigne ; le marqueur signifie « ne part pas dans le contexte d'un modèle tiers » | Assemblage dans l'adaptateur ; marqueur limité à la surface MCP |
| `_basedb.setting` seul détenteur du fournisseur, du modèle et des plafonds | Détenteur unique (A5) ; une colonne ne porterait ni consentement ni plafonds | Colonne `tenant.ai_model` |
| `ai.enabled` à `false` par défaut, résolu en conjonction | Aucun appel tant que personne ne l'a décidé ; le retrait d'un tenant est un droit | Activation dès qu'une clé existe ; surcharge symétrique |
| Ni bascule entre fournisseurs, ni réessai différé | La bascule viserait un tiers non consenti ; un brouillon tardif n'a plus d'objet | Repli sur un second fournisseur ; file d'appels |
| Clé vérifiée avant stockage, écriture seule, présence seule restituée | Une faute de frappe ne doit pas se révéler chez un tiers utilisateur | Validation au premier usage |
| Consentement lié au fournisseur et à la version de la notice | Un consentement insensible au changement de destinataire n'en est pas un | Acceptation définitive |
| Surcharge de quota à la baisse seulement | Sinon un `tenant_admin` dépense la clé d'instance sans limite | Surcharge libre |
| Pas de verbe `use_ai` ; session seule, ni jeton ni surface MCP | La liste des verbes est fermée ; un jeton brûlerait la clé d'instance sans porteur humain | Verbe dédié ; exposition via jeton |
| Ni phrase, ni charge utile, ni réponse journalisées ; comptage par agrégation de `ai_call` | Le journal ne doit pas devenir un second entrepôt des mêmes données, ni le compteur un second détenteur | Journalisation intégrale ; compteur incrémental |

---

## Risques et limites connues

1. **La phrase saisie part telle quelle** : seule brèche assumée d'INV-IA2, non
   refermable, énoncée dans la notice et à côté du bouton.
2. **Les libellés sont des données métier** : la liste des tables et des champs d'une
   base décrit l'activité d'une organisation, même sans une seule valeur. Et rien
   n'oblige un fournisseur à ce qu'il annonce faire des données reçues.
3. **La qualité des brouillons n'est ni garantie ni mesurée en v1.** Un brouillon
   plausible mais mauvais coûte plus cher qu'un écran vide, parce qu'il sera amendé au
   lieu d'être rejeté : c'est la contrepartie du refus d'appliquer automatiquement.
4. **Le contrôle de quota est approximatif à la seconde** avec plusieurs instances
   applicatives (A4) ; sensible seulement sur la limite de simultanéité.
5. **Aucune rotation de `BASEDB_ENCRYPTION_KEY` en v1**, dont les clés de fournisseurs
   héritent ; un appel déjà parti n'est pas davantage rappelé par une révocation.
6. **Dépendances externes assumées** : la clé composite de `setting` et `secret`, le
   marqueur `expose_to_agents`, le jeton de confirmation et l'élévation. Si l'une n'est pas livrée, la propriété correspondante
   tombe, et il faudra le dire.

---

## Questions ouvertes

1. **Valeurs par défaut des plafonds** — appels et jetons par tenant et par mois, seuil
   de notification à 80 % : à fixer par le commanditaire. Elles déterminent ce que coûte
   une installation dont un seul tenant explore le produit.
2. **Table de correspondance des modèles** : les fournisseurs retirent leurs modèles plus
   vite que le produit ne publie. Le rythme de révision, et le comportement quand le
   modèle configuré a disparu — refus net ou repli sur le défaut d'instance — restent à
   trancher.
3. **Canal de notification** pour un plafond atteint, une clé invalide ou un circuit
   ouvert : notification interne seule en v1 ; un canal externe est un choix de produit,
   commun avec « Serveur MCP ».
4. **Une notice de consentement fournie par le produit suffit-elle** au regard des
   obligations de l'exploitant, ou faut-il permettre à l'instance d'y adjoindre un texte
   propre ? La seconde option est simple à ajouter et n'a pas été arbitrée.
