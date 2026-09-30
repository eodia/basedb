# basedb — document d'architecture (phase 1)

Ce document est le livrable de la phase 1 : l'architecture, sans code. Il fixe le
schéma du catalogue, la stratégie de migration DDL, le modèle de permissions et les
conventions de nommage, de façon assez précise pour que la phase 2 s'écrive sans
nouvelle décision d'architecture.

Seize chapitres, environ 197 000 mots. **Vous n'avez pas à tout lire pour le
valider.** Ce fichier est fait pour ça.

---

## Comment valider en une demi-heure

1. Lisez [00 — Décisions structurantes](00-decisions-structurantes.md). Vingt-cinq
   décisions numérotées, trois pages. Elles commandent tout le reste : si vous êtes
   d'accord avec les vingt-cinq, vous êtes d'accord avec le document.
2. Parcourez le tableau des **arbitrages qui vous attendent**, plus bas. Ce sont les
   choix que je n'ai pas pris à votre place.
3. Ouvrez les chapitres qui vous intéressent, dans l'ordre que vous voulez : ils sont
   autonomes et se renvoient les uns aux autres par leur titre.

Les quatre décisions A1 à A4 sont celles que vous avez déjà arbitrées : PostgreSQL 16
minimum, identifiants système en anglais, extensions `pg_trgm`/`unaccent`/ICU
disponibles, aucune dépendance externe hors PostgreSQL.

---

## Les chapitres

| # | Chapitre | Ce qu'il fixe |
|---|---|---|
| [00](00-decisions-structurantes.md) | Décisions structurantes | Les 25 décisions qui font autorité, et le registre des 213 codes d'erreur en annexe |
| [01](01-conventions-nommage.md) | Nommage et slugification | L'algorithme de slugification pas à pas, les budgets d'octets, le `tenantId`, les noms dérivés, le quoting |
| [02](02-catalogue.md) | Catalogue `_basedb` | Le DDL complet du catalogue — la source de vérité dont l'API, la doc et le MCP dérivent |
| [03](03-moteur-ddl-migrations.md) | Moteur DDL et migrations | Le passage de l'intention au DDL appliqué, les plans en plusieurs étapes, les verrous, la détection de dérive |
| [04](04-types-de-champs.md) | Types de champs | Les neuf types v1 et leur projection PostgreSQL, dont le lien, la formule et le texte riche |
| [05](05-permissions.md) | Permissions | Le RBAC, les restrictions au niveau champ, le point d'application unique, la règle « absence plutôt qu'erreur » |
| [06](06-cycle-de-vie.md) | Cycle de vie | Renommage physique, alias de compatibilité, suppression logique, purge |
| [07](07-historique.md) | Historique | La capture par déclencheur, l'historique des données et des structures, la rétention |
| [08](08-api-rest-webhooks.md) | API REST et webhooks | Le plan d'URL, les filtres, la pagination par curseur, l'expansion des liens, OpenAPI, les jetons |
| [09](09-serveur-mcp.md) | Serveur MCP | Les outils exposés aux agents, les migrations proposées, la confirmation humaine |
| [10](10-architecture-logicielle.md) | Architecture logicielle | Le monorepo, la frontière du noyau, les pools, les transactions, la stratégie de test |
| [11](11-interface.md) | Interface | La grille, l'édition en ligne, la cellule de lien, la vue détail, l'éditeur de schéma ; le SQL de chacun, les requêtes enregistrées et les vues SQL ; les paramètres de la personne |
| [12](12-integration-ia.md) | Intégration IA | OpenAI, Anthropic, Mistral et les serveurs compatibles (Azure, modèle local), la configuration par tenant, les clés côté serveur |
| [13](13-authentification.md) | Authentification | Mot de passe, OAuth/OIDC, sessions, élévation, amorçage |
| [14](14-environnements.md) | Environnements | Production, recette, développement : la lignée, la comparaison, le report de structure, la synchronisation des lignes |
| [15](15-formulaires-partages.md) | Formulaires partagés | Le lien public ou réservé aux membres, l'autorité du publiant, l'attribution des réponses, la fermeture |
| [16](16-collaboration.md) | Collaboration | Commentaires et mentions, notifications internes, temps réel et présence, annulation d'une écriture (Ctrl+Z) |
| [17](17-automatisations.md) | Automatisations | Déclencheurs (ligne créée ou modifiée, horloge, bouton), condition, un flux d'étapes — rechercher, bifurquer, demander à l'IA, citer une étape précédente —, suivi étape par étape, au nom du propriétaire ; le Copilot des automatisations ; le champ bouton |
| [18](18-interfaces-modeles.md) | Tableaux de bord, questions, extensions et modèles | Questions construites à la souris ou en SQL, lues avec les droits du lecteur ; tableaux de bord en grille, en onglets, sous des filtres ; page intégrée ; modèles de base appliqués par l'interface |
| [19](19-integrations-synchronisation.md) | Intégrations et tables synchronisées | Slack par webhook entrant, flux iCalendar pour Google Agenda, tables tenues à jour depuis un CSV, un agenda ou une vue partagée |
| [20](20-modeles.md) | Modèles de base | Un format JSON pour décrire une base entière, publié par le site public, importé par l'instance, proposé par l'IA, exporté d'une base |
| [21](21-documents.md) | Documents PDF | Une ligne en facture, devis ou fiche : modèles par table, blocs de texte riche, de champs et de lignes liées, lus avec les droits du lecteur, composés en PDF avec des polices embarquées |

---

## Les décisions qui engagent le plus

Si vous ne deviez contester que quelques points, ce sont ceux-là.

**Les relations sont de vraies clés étrangères, et la cascade est celle de PostgreSQL**
(A13, A14). Un champ lien pose une contrainte réelle ; une suppression faite en SQL
direct cascade comme une suppression faite par l'API. La clause émise pour un refus
est `ON DELETE NO ACTION` et non `RESTRICT` : le refus est identique, mais la
vérification en fin d'instruction laisse réussir une suppression en lot qui retire
dans la même instruction une ligne et celles qui la référencent — cas réel sur une
table hiérarchique. *C'est le seul endroit où je me suis écarté de la lettre de votre
cadrage.*

**L'historique est capturé par déclencheur, pas par l'application** (A10). C'est la
seule façon qu'une écriture SQL directe, faite par un humain sans passer par
l'application, soit historisée comme les autres — ce que votre cadrage promet.

**Les migrations se font en plusieurs étapes** (A11). `NOT VALID` puis `VALIDATE`,
`CREATE INDEX CONCURRENTLY` : une opération de structure n'est pas une transaction
unique, mais une machine à états. C'est la seule façon de poser une clé étrangère sur
une table volumineuse sans indisponibilité.

**La colonne d'affichage ne bascule jamais toute seule** (A15). Supprimer le champ
désigné est refusé. Une bascule automatique changerait sans prévenir ce que voient
tous les consommateurs de tous les liens pointant vers cette table.

**Un lien dont la cible est illisible renvoie un identifiant masqué** (A16), pas
l'identifiant réel : un UUIDv7 porte un horodatage, qui révélerait la date de création
d'une ligne que le lecteur n'a pas le droit de voir.

---

## Les arbitrages qui vous attendent

Trente-sept questions restent ouvertes. Aucune ne bloque le démarrage de la phase 2 :
ce sont des valeurs par défaut à confirmer sur les premières bases réelles, et des
choix d'exploitation. Elles se regroupent en quatre familles.

| Famille | Ce qu'il faut décider | Quand |
|---|---|---|
| **Seuils et valeurs par défaut** (13 questions) | Volumétrie déclenchant une recopie, seuil d'opération de masse, plafonds des agents MCP et de l'IA, nombre de sessions simultanées. Toutes ont une valeur proposée et argumentée. | Après les premières bases réelles |
| **Canaux de notification** (4 questions) | Courriel, webhook ou notification interne pour les propositions de migration, les alertes de sécurité, les plafonds atteints. La v1 fonctionne avec la notification interne seule. | Phase 3 |
| **Exploitation et hébergement** (10 questions) | Collation de la base d'accueil, `max_connections` disponible, nombre de répliques, emplacement du répertoire d'export, sauvegarde après séparation du catalogue. | Dépend de votre hébergeur |
| **Périmètre v2** (10 questions) | Romanisation des écritures non latines, plusieurs-vers-plusieurs, groupement et totaux en grille, annulation après écriture, import de fichier. | Plus tard |

Deux méritent votre attention plus tôt que les autres :

- **Collation de la base d'accueil** (chapitre 10). Les identifiants physiques sont
  immunisés par `COLLATE "C"`, mais la collation par défaut conditionne le tri de
  toutes les données utilisateur. Se décide à la création de la base, pas après.
- **Second rôle PostgreSQL en lecture seule** (chapitre 02). Faut-il demander à votre
  administrateur d'instance un rôle restreint aux schémas `b_*`, pour que les
  consommateurs SQL directs ne puissent pas lire le catalogue ? Cela sort du cadre
  « un seul rôle propriétaire » que vous avez posé, d'où la question.

---

## Ce que le document ne couvre pas

- Le **plusieurs-vers-plusieurs** : hors périmètre v1, conformément à votre cadrage.
- Le **choix multiple** sur une liste de choix : hors périmètre v1.
- L'**export de données** : aucun point d'entrée. Un flux illimité percerait le
  plafond que toutes les autres règles construisent ; l'extraction passe par la
  pagination par curseur, qui est bornée et soumise aux mêmes permissions.
- Le **second facteur d'authentification**, SAML, l'annuaire d'entreprise : hors v1,
  l'élévation les acceptera comme preuve le jour venu.
- Les **événements de structure** en webhook : reportés.

---

## Prochaine étape

La phase 2 peut démarrer : le noyau seul, avec tests — moteur DDL, catalogue,
migrations, slugification, RBAC. Ni interface, ni MCP, ni IA.

Le chapitre 10 en donne le périmètre exact, la frontière du noyau et les critères de
sortie ; le chapitre 02 en est le premier livrable, puisque le DDL du catalogue
conditionne tout le reste.
