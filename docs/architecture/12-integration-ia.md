# 12 — Intégration des fournisseurs d'IA

## Rôle de ce chapitre

Ce chapitre spécifie les appels **sortants** vers OpenAI, Anthropic et Mistral — et vers
tout serveur qui parle l'API d'OpenAI à l'adresse de l'exploitant (§ 2.5) : à quoi
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

**Une exception, décidée et bornée** : l'option IA d'un champ (§ 1.5) écrit la réponse
d'un modèle dans une cellule et envoie pour cela des valeurs de la ligne. Il enfreint
les deux invariants par construction ; il n'existe que parce que son auteur y a
consenti explicitement, et ses bornes tiennent lieu d'invariant pour lui. Les deux
usages de brouillon restent soumis aux deux invariants sans exception.

### 1.2 Les deux usages retenus

| Usage (`usage_kind`) | Entrée | Sortie | Acte qui suit |
|---|---|---|---|
| `structure_draft` | Une description de besoin, plus les libellés et types des tables existantes de la base | Une proposition de tables, champs et liens, dans le vocabulaire de « Types de champs et projection vers PostgreSQL » | Le brouillon est amendé dans l'éditeur de schéma ; l'enregistrement produit une migration proposée, approuvée selon « Moteur DDL et stratégie de migration » |
| `expression_draft` | Une phrase, plus les libellés et types des champs de la table visée | Une formule ou un filtre, dans la grammaire fermée de « Types de champs » et de « API REST, OpenAPI, webhooks, jetons d'intégration » | L'expression s'affiche dans l'éditeur, passe le validateur ordinaire, et n'est enregistrée que par une action explicite |
| `field_compute` | La consigne d'un champ calculé par l'IA, les valeurs de la ligne qu'elle cite, les libellés de la table et du champ, le format attendu du type du champ | Une chaîne, `{ "value": string }`, relue dans le type du champ | Écrite dans la cellule par le noyau — l'exception du § 1.5 |
| `automation` | La consigne d'une étape IA d'automatisation, les valeurs de la ligne et des étapes précédentes qu'elle cite, le nom de l'automatisation, le format attendu | Une chaîne, `{ "value": string }`, relue dans le type demandé | Citée par les étapes suivantes, qui l'écrivent ou l'envoient par leurs propres chemins (§ 1.8) |
| `copilot` | Une conversation, la structure lisible de la base et, sur consentement, des lignes lues | Une réponse en texte et des propositions typées : filtre, requête, colonnes, table, lignes à insérer ou à modifier | Chaque proposition s'applique d'un clic, par les routes ordinaires (§ 1.6) |
| `template_draft` | Une phrase décrivant un usage, la proposition précédente quand on l'affine, la date du jour | Un modèle de base complet au format du chapitre 20 : tables, champs, relations, lignes d'exemple, vues, tableaux de bord, automatisations | Le modèle s'affiche dans la galerie ; la base n'est créée que par « Créer la base » (§ 1.7) |

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

- **Tout autre usage portant sur le contenu** que l'option IA des champs : enrichissement à
  l'écriture, recherche, classification en masse hors d'une colonne, génération hors
  d'une cellule. Ils violeraient INV-IA2 sans le consentement que le champ exige.
- **Recherche sémantique et plongements vectoriels** : extension hors de la liste d'A3,
  stockage vectoriel par tenant, réindexation — un sous-système entier pour un besoin
  non demandé.
- **Conversation sur les données** hors du copilote (§ 1.6) : c'est ce que sert
  « Serveur MCP », avec l'agent de l'utilisateur, ses clés et son budget.
- **Agent autonome, action déclenchée par événement, diffusion en continu, cache
  sémantique, modèle hébergé localement, bascule entre fournisseurs, refacturation.**
  L'exécution différée n'existe que pour l'option IA des champs, et seulement pour elle.

### 1.5 L'option IA d'un champ — l'exception décidée

*Décision du propriétaire*, prise contre le § 1.4 d'origine, comme la console SQL l'a
été contre les chapitres 09 et 10. L'option est décrite par « Types de champs » (§ 7 bis) ;
ce paragraphe dit ce qui en borne l'exception.

*Décision révisée* : l'IA était d'abord un type de champ, `ai`, une colonne de texte.
C'est désormais une **option** — un interrupteur « IA » sur le formulaire du champ — que
peut porter un texte court ou long, un lien URL, un nombre, une liste de choix, un
booléen ou une date. La colonne garde son type : le modèle reçoit le format attendu, et
sa réponse est relue dans ce type, ou refusée si rien ne s'y lit (§ 7 bis du chapitre 04).
Les bornes ci-dessous sont inchangées ; elles valent pour chaque champ qui porte l'option.

1. **Nul n'écrit la colonne.** Le décideur la retire de tout masque d'écriture ; seul le
   noyau l'écrit, à la demande d'une personne pour une ligne (« Recalculer », droit
   `update`) ou de lui-même, par le processus de fond. Une réponse de modèle ne devient
   donc jamais que la valeur d'une cellule, dans le type de sa colonne : ni DDL, ni
   permission, ni écriture d'une autre colonne. Le texte d'une cellule qui contient des consignes (« ignore ce qui
   précède… ») n'atteint que la réponse de cette même ligne.
2. **Les valeurs partent sur consentement.** Activer l'option — à la création du champ ou
   sur un champ existant —, ou en changer la consigne ou le planning, demande
   `manage_schema` sur la table, la lecture de **chaque**
   colonne citée, et `consent: true` — faute de quoi `AI_CONSENT_REQUIRED`. Le
   consentement est nominatif (`field_ai_config.consented_by`, `consented_at`) et
   renouvelé à chaque modification : les colonnes citées peuvent avoir changé. Refusé
   tant que l'IA n'est pas configurée (`AI_DISABLED`, `AI_NOT_CONFIGURED`) : une
   colonne qui ne se remplirait jamais serait une colonne de cellules vides que
   personne ne comprendrait.
3. **Ne part que ce qui est cité.** Pour une ligne : la consigne, valeurs en place, et
   les libellés de la table et du champ. Ni `_id`, ni nom physique, ni autre colonne,
   ni description, ni identité de l'auteur.
4. **Chaque appel est compté**, une ligne `ai_call` par tentative, `usage_kind =
   'field_compute'`, surface `system` pour le processus de fond — la personne et sa
   surface pour « Recalculer ». Plafond horaire **propre** (§ 6.2), pour qu'une table de
   mille lignes n'épuise pas celui des brouillons, ni l'inverse.
5. **Le rythme est borné** : au plus un recalcul complet toutes les 15 minutes par
   champ ; le processus de fond fait au plus 20 appels par passage de 10 secondes, 8 par
   champ, pour qu'une grande table n'affame pas les autres.

**Le processus de fond** tourne dans le processus de l'API (`BASEDB_AI_WORKER=0` le
coupe), jamais dans le serveur MCP. À chaque passage, pour chaque champ vivant qui porte
l'option :
il prend un **bail** de cinq minutes sur la ligne de configuration (`lease_until`) —
plusieurs processus peuvent donc tourner sur une même base sans calculer deux fois —,
ouvre un recalcul complet si l'échéance cron est passée (`next_sweep_at`), calcule les
cellules vides puis poursuit le recalcul en cours à partir de son curseur
(`sweep_after`, dernier `_id` traité), et rend le bail avec son bilan (`last_run_at`,
`computed_count`, `last_error`). Un refus qui vaut pour tout le champ — plafond atteint,
fournisseur indisponible, IA désactivée — suspend ce champ de cinq à dix minutes au lieu
de brûler le passage ; une ligne dont l'appel échoue est reprise plus tard, avec un
délai qui double à chaque échec, jusqu'à six heures. Une cellule vide n'est remplie
que si elle l'est encore au moment d'écrire : une valeur arrivée entre-temps n'est pas
écrasée par un calcul plus ancien.

**Une colonne citée qui change rejoue le calcul** (chapitre 04 § 7 bis) : l'écriture
d'une personne vide la cellule, que le passage suivant remplit. Un appel prend quelques
secondes, et une valeur citée peut changer pendant ce temps — la ligne tout juste créée,
ses notes saisies pendant que le modèle répond. L'écriture du noyau est donc
conditionnelle : la ligne est lue avec l'empreinte de ses valeurs citées
(`md5(ROW(…)::text)`), et la réponse n'est écrite que si l'empreinte est encore la
même. Sinon elle est abandonnée — elle répondait pour une ligne qui n'est plus —, et la
cellule, vidée par le changement, est recalculée au passage suivant.

**Rien à lire, rien à demander.** Une ligne dont toutes les valeurs citées sont vides
n'est pas envoyée au fournisseur. Pour un champ texte, la cellule reçoit `''`, la réponse
que le modèle donnerait, et une réponse vide du modèle est écrite de même : seul `NULL`
est « à calculer », et une cellule qui ne pouvait rien donner n'est plus reprise à chaque
passage (chapitre 04 § 7 bis). Les autres types n'ont pas de valeur vide à écrire : la
ligne est refusée (`AI_RESPONSE_UNUSABLE`, `rien_a_lire`), comme une réponse où rien ne
se lit dans le type du champ (`type_attendu`), et reprise avec le délai qui double, six
heures au plus. Le coût d'une ligne sans données est donc un appel évité puis quelques
lectures par jour, jamais un appel par passage.

### 1.6 Le copilote — une conversation qui propose

*Décision du propriétaire*, qui remplace les deux onglets « Expression » et « Structure »
du panneau par une conversation. Le copilote répond sur **une base** : il voit sa
structure, telle que la personne la lit, et **propose** ; il n'exécute rien.

**Ce qu'il propose** est une liste fermée de six actions typées, revalidées par le noyau
contre le catalogue et les droits de la personne avant d'être montrées, et appliquées —
d'un clic, carte par carte — par les routes ordinaires, qui revérifient tout :

| Action | Ce que la carte montre | Ce que le clic fait |
|---|---|---|
| `filter` | L'expression et le tri | Filtre la vue de la table ; l'expression est d'abord éprouvée par une lecture d'une ligne |
| `sql` | Une requête `SELECT` | L'ouvre dans un onglet de console, où la personne l'exécute |
| `add_fields` | Les colonnes, à cocher | `POST …/fields`, `…/links` une à une ; une colonne IA demande le consentement du § 1.5 dans la carte |
| `create_table` | La table et ses colonnes | `POST …/tables`, puis les colonnes qu'elle ne peut porter à la création |
| `insert_records` | Un aperçu des lignes, 50 au plus | `POST …/batch`, tout ou rien ; un lien désigné par sa valeur d'affichage est résolu à ce moment |
| `update_records` | Les lignes lues et leurs nouvelles valeurs | `PATCH` ligne par ligne |

Une proposition qui ne tient pas — table ou colonne inconnue, type hors liste, choix
inexistant, droit manquant, requête qui écrit — est écartée **et dite** sous la réponse.
Avant cela, le modèle la reçoit une fois avec la raison et corrige sa réponse ; ce qui
reste écarté après cette correction est dit. Sont admis sans correction ce qui désigne
sans ambiguïté la même chose : une table nommée par son libellé ou qualifiée de son
schéma, la table à l'écran quand aucune n'est nommée, un choix de liste comparé par son
libellé dans un filtre — réécrit en sa valeur, sans quoi le filtre ne trouverait rien.
INV-IA1 tient : la réponse ne devient une écriture que par le geste d'une personne.

**Ce qu'il lit — seconde exception à INV-IA2.** Par défaut, rien que la structure : les
tables et colonnes que la personne lit, leurs types, les libellés des choix, ce qu'elle a
le droit d'y faire, la table à l'écran et son filtre. Une case, sous la conversation,
l'autorise à **lire des lignes** pour cette conversation ; il peut alors demander des
lectures, que le noyau exécute et lui rend avant qu'il réponde — trois tours au plus :

- **`records`** : la lecture ordinaire, sous le masque de la personne et le prédicat de
  lignes, 50 lignes au plus, avec le décompte à la demande ;
- **`sql`** : une requête `SELECT`, seulement pour qui la console SQL est déjà ouverte
  (`manage_schema` sur la base), et jamais sur une base dont une colonne est soustraite
  aux modèles tiers (`expose_to_agents = false`) — SQL ne saurait la cacher. Elle
  s'exécute sous le rôle restreint de la console, dans une transaction `READ ONLY` et par
  le protocole étendu, qui refuse une seconde instruction : ni un `COMMIT; DELETE…`, ni
  une écriture dans une CTE ou une fonction n'en sortent. Elle est journalisée dans
  `audit_log` comme toute requête de console.

Chaque lecture est listée sous la réponse — « 2 lectures · 14 lignes envoyées au
fournisseur » — avec son texte : ce qui a été lu est ce qui est parti. Les valeurs sont
coupées à 300 caractères, une observation à 6 Kio ; les colonnes soustraites aux modèles
tiers ne sont ni décrites ni lues.

**Ce qui borne un tour** : une conversation de 20 messages et 16 000 caractères au plus,
les plus anciens tombant les premiers ; quatre appels (trois tours de lecture, puis la
réponse), chacun compté dans `ai_call` sous `usage_kind = 'copilot'` et sous le plafond
horaire des usages interactifs (§ 6.2) ; 90 secondes et 8 000 jetons par appel, le temps
d'écrire cinquante lignes.

**Les données lues sont des données** : la consigne fermée le dit au modèle, et une
consigne cachée dans une cellule ne peut produire qu'une proposition, que la personne
lit avant de l'appliquer, jamais une action.

**Sur les tableaux de bord**, le même copilote converse avec ses propres actions — une
question à regarder, des modifications d'un tableau, des valeurs pour ses filtres — et
lit, sur le même consentement, les résultats des cartes : c'est le chapitre 18 §2.6. **Sur
les automatisations**, il propose une automatisation entière — celle de l'écran modifiée, ou
une nouvelle —, vérifiée comme un enregistrement et posée sur le flux de l'éditeur, jamais
enregistrée par lui : c'est le chapitre 17 §6. Les bornes, le journal et le quota sont
ceux-ci.

### 1.7 Proposer un modèle de base

*Décision du propriétaire* (A30). La galerie de modèles (chapitre 20 §5) demande à l'IA un
modèle de base à partir d'une phrase. L'usage produit un brouillon, comme les deux
premiers (INV-IA1) : la proposition est validée par le validateur des modèles, en mode
réparation — ce qui ne tient pas est retiré et dit —, montrée en entier, et ne devient une
base que par le geste de la personne, qui l'applique par les routes ordinaires.

INV-IA2 tient sans exception : la charge utile ne porte que la phrase, la proposition
précédente quand la personne l'affine — un modèle que l'IA a elle-même écrit — et la date du
jour ; aucun libellé, aucune valeur d'aucune base. Le droit demandé est celui de l'acte
préparé : `manage_schema` sur le projet où la base sera créée. Chaque appel est compté dans
`ai_call` sous `usage_kind = 'template_draft'` et sous le plafond horaire des usages
interactifs ; 90 secondes et 12 000 jetons par appel, le temps d'écrire des lignes
d'exemple. Les champs calculés par l'IA que la proposition contient ne sont créés comme tels
qu'avec le consentement du § 1.5, demandé au moment de créer la base.

### 1.8 L'étape IA d'une automatisation

Une automatisation peut demander une réponse au modèle dans une étape (chapitre 17 §1.3).
C'est l'exception du § 1.5 appliquée à une étape plutôt qu'à une colonne, avec les mêmes
bornes :

1. **La réponse n'agit sur rien.** Elle est relue dans le type demandé — texte, nombre,
   oui ou non, date, adresse, un choix parmi une liste — ou refusée
   (`AI_RESPONSE_UNUSABLE`) ; elle devient une donnée que les étapes suivantes citent,
   écrivent ou envoient par leurs propres chemins, avec les droits du propriétaire de
   l'automatisation. Le modèle ne choisit aucune action.
2. **Les valeurs partent sur consentement** : `consent: true` à chaque enregistrement de
   l'étape, faute de quoi `AI_CONSENT_REQUIRED` ; l'écran le redemande quand la consigne
   change. Refusée tant que l'IA n'est pas configurée (`AI_DISABLED`,
   `AI_NOT_CONFIGURED`), comme un champ IA.
3. **Ne part que ce qui est cité** : la consigne, les valeurs qu'elle cite de la ligne et
   des étapes précédentes, le format attendu et le nom de l'automatisation. Une valeur
   citée est lue par le propriétaire, avec ses droits : un champ qu'il ne voit pas se lit
   vide.
4. **Chaque appel est compté**, `usage_kind = 'automation'` (migration de catalogue 0008),
   sous le plafond horaire des calculs de fond, partagé avec les champs IA (§ 6.2). Le
   rythme est celui des exécutions : 100 par heure et par automatisation (chapitre 17
   §2.3).

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

### 2.5 Un serveur compatible, à l'adresse de l'exploitant

Azure, une passerelle d'entreprise, un modèle servi sur la machine de l'exploitant (Ollama,
vLLM…) parlent l'API d'OpenAI sans être OpenAI. Le fournisseur `openai_compatible` les
sert : **ce n'est pas une quatrième forme**, c'est celle d'OpenAI à une autre adresse. Le
principe du § 2.2 tient — rien de propre à Azure ne remonte à l'appelant.

| Variable | Rôle |
|---|---|
| `BASEDB_AI_BASE_URL` | Ce qui précède `/chat/completions` (`/messages` pour `anthropic`), paramètres compris : le `?api-version=…` d'Azure reste après le chemin. Obligatoire pour `openai_compatible`, facultative pour les trois autres, joints alors par une passerelle |
| `BASEDB_AI_HEADERS` | Objet JSON d'en-têtes ajoutés à chaque appel — l'`api-key` d'Azure, la clé d'abonnement d'une passerelle. Ils remplacent ceux de la clé, jamais le type du corps |
| `BASEDB_AI_PROVIDER_SSL_VERIFY` | `false` (`0`, `no`, `off`) : le certificat TLS de ce fournisseur n'est pas vérifié — une passerelle interne au certificat auto-signé, un proxy qui re-signe le trafic. Comme l'adresse et les en-têtes, il accompagne le fournisseur de l'environnement et lui seul (`verifyCertificate` de la requête au transport) ; l'adaptateur passe alors par un agent `undici` propre à cet appel, et tout autre appel sortant reste vérifié — ce que `NODE_TLS_REJECT_UNAUTHORIZED=0` ne permettrait pas. Une valeur illisible laisse la vérification active ; le démarrage signale l'une et l'autre (0.7.1) |

Trois règles :

- **L'environnement seul.** L'adresse et les en-têtes sont la parole de l'exploitant, pas un
  réglage de tenant : une adresse qu'un `tenant_admin` pourrait écrire ferait de l'API une
  porte vers le réseau de l'instance, en-têtes compris.
- **Ils accompagnent le fournisseur de l'environnement, et lui seul.** Un tenant qui a
  choisi un autre fournisseur (§ 3.2) ne reçoit ni l'adresse, ni les en-têtes, ni
  `BASEDB_AI_API_KEY` : la clé Azure ne part pas chez Anthropic.
- **La clé est facultative** pour `openai_compatible` : un modèle local n'en demande pas,
  Azure la lit dans son en-tête. Donnée, elle part en `Authorization: Bearer`.

Les appels sont journalisés sous `openai_compatible` (migration de catalogue 0010), non sous
`openai` : le journal dit à qui les données sont parties. Le circuit du § 2.4 est tenu par
adresse appelée : un déploiement Azure en panne ne ferme pas l'adresse d'OpenAI.

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
| `ai.provider` | instance, tenant | oui | `openai`, `anthropic`, `mistral` ou `openai_compatible` (§ 2.5) |
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

Dans `_basedb.secret`, sous `ai.openai.api_key`, `ai.anthropic.api_key`,
`ai.mistral.api_key` et `ai.openai_compatible.api_key` (facultative, § 2.5), de portée
`instance` ou `tenant`. Chiffrement au repos,
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
| `field_compute` | Le libellé de la table et celui du champ ; la consigne, **les valeurs des colonnes citées de la ligne** mises à leur place — l'exception du § 1.5, sur consentement |
| `automation` | Le nom de l'automatisation ; la consigne de l'étape, **les valeurs de la ligne et des étapes précédentes qu'elle cite** mises à leur place ; le format attendu — l'exception du § 1.8, sur consentement |
| `copilot` | Le libellé de la base ; pour chaque table lisible, son nom physique, son libellé, ses colonnes (nom, libellé, type, libellés des choix, cible d'un lien) et les droits de la personne ; la table à l'écran et son filtre ; la conversation ; **sur consentement**, les lignes lues (§ 1.6). Sur les tableaux de bord : le tableau à l'écran, ses cartes et leurs questions, les questions enregistrées ; **sur consentement**, les résultats des cartes et les valeurs des filtres affichés (chapitre 18 §2.6). Sur les automatisations : leur liste, celle à l'écran telle que l'éditeur la montre, ses dernières exécutions sans aucune valeur, les personnes et canaux Slack sous des références de l'appel ; **sur consentement**, les lignes lues (chapitre 17 §6) |

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

Il est **lié au fournisseur et à la version de la notice**. `endpoint` est l'adresse
résolue, `BASEDB_AI_BASE_URL` comprise (§ 2.5) : la changer change de destinataire, comme
changer de fournisseur. Changer de fournisseur ou
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
| Brouillons et copilote : 120 appels par heure (`BASEDB_AI_QUOTA`) | Tenant | `AI_QUOTA_EXCEEDED` |
| Champs calculés par l'IA et étapes IA des automatisations : 300 appels par heure (`BASEDB_AI_FIELD_QUOTA`) | Tenant, compté à part des brouillons | `AI_QUOTA_EXCEEDED` ; le processus de fond suspend le champ dix minutes, l'étape d'automatisation échoue |

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
| Converser avec le copilote | `read` sur au moins une table de la base ; il ne voit que ce que la personne lit |
| Laisser le copilote lire par SQL | `manage_schema` @ base, comme la console, et consentement de la conversation |
| Activer l'option IA d'un champ, en changer la consigne ou le planning, tout recalculer | `manage_schema` @ table, lecture de chaque colonne citée, consentement explicite |
| Désactiver l'option IA d'un champ | `manage_schema` @ table |
| Recalculer une ligne d'un champ calculé par l'IA | `update` @ table |
| Lire la consigne et l'état d'un champ calculé par l'IA | `read` @ table |
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
  permissions ». Le processus de fond des champs calculés par l'IA n'est pas une surface : c'est le
  noyau, acteur `system`, qui agit dans les bornes qu'une personne a consenties.

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
3. **Aucun objet du catalogue autre que `setting`, `secret`, `ai_call` et le satellite
   `field_ai_config` ne mentionne l'IA** : ni type de champ, ni colonne sur `field`, ni
   état de migration. L'option IA d'un champ est la présence de sa ligne dans le
   satellite, et rien d'autre.

Le fournisseur, le modèle et la clé se prennent dans les réglages, ou à défaut dans
l'environnement (`BASEDB_AI_PROVIDER`, `BASEDB_AI_MODEL`, `BASEDB_AI_API_KEY` — ou, pour
la clé, le nom usuel du fournisseur : `MISTRAL_API_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`) tant qu'aucun écran de réglage n'existe ; un réglage écrit l'emporte.
L'adresse et les en-têtes d'un serveur compatible (`BASEDB_AI_BASE_URL`,
`BASEDB_AI_HEADERS`) ne se prennent que là (§ 2.5).

Sont reportés, et nommés pour ne pas passer pour des oublis : rotation de
`BASEDB_ENCRYPTION_KEY`, budgets en unité monétaire, diffusion en continu, choix du
modèle par usage plutôt que par tenant, et tout usage portant sur le contenu des
enregistrements autre que l'option IA des champs.

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
| `AI_RESPONSE_UNUSABLE` | Réponse non conforme au schéma ou tronquée, après un réessai ; ou, pour un champ calculé par l'IA, sans valeur lisible dans le type du champ | Incident | 502 |

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
| Option IA d'un champ : colonne écrite par le noyau seul, sur consentement nominatif renouvelé à chaque changement de consigne, citations limitées aux colonnes lisibles par l'auteur, plafond horaire propre, 15 minutes au moins entre deux recalculs | Décision du propriétaire ; les bornes tiennent lieu d'invariant pour la seule exception à INV-IA1 et INV-IA2 | Champ refusé (§ 1.4 d'origine) ; calcul à l'écriture, synchrone ; planning libre |
| L'IA est une option de sept types, pas un type ; la réponse est relue dans le type du champ, ou refusée | Un nombre, une catégorie, une date extraits par un modèle doivent se trier, se filtrer et se valider comme tels | Un type `ai` à colonne `text`, une première décision revue à l'usage ; forcer une réponse illisible dans le type |

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
6. **L'option IA fait sortir des valeurs de ligne**, par construction. Le
   consentement nomme les colonnes, mais un fournisseur reste un tiers, et rien ne
   l'oblige à ce qu'il annonce faire des données reçues.
7. **La valeur d'un champ calculé par l'IA est lue par qui lit la table**, y compris un lecteur à
   qui une colonne citée est masquée : la réponse peut en résumer le contenu. L'auteur,
   qui lit toutes les colonnes qu'il cite, en décide en écrivant la consigne ; le masque
   d'un lecteur ne s'étend pas à ce qu'un modèle a tiré d'une colonne qu'il ne voit pas.
8. **Un planning se paie par ligne** : « toutes les 15 minutes » sur mille lignes fait
   96 000 appels par jour, que le plafond horaire arrête bien avant. L'écran annonce le
   rythme ; il ne connaît pas le prix.
9. **Dépendances externes assumées** : la clé composite de `setting` et `secret`, le
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
