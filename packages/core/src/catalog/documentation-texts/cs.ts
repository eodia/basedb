import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Czech: the French sentence of `documentation.ts` → its translation. */
export const cs: Catalog = {
  'Prise en main': 'Začínáme',
  'API REST': 'REST API',
  'Agents (MCP)': 'Agenti (MCP)',
  Tables: 'Tabulky',
  Référence: 'Reference',
  texte: 'text',
  'texte long': 'dlouhý text',
  'nombre (chaîne décimale)': 'číslo (desetinný řetězec)',
  booléen: 'logická hodnota',
  'date (`2026-09-18`)': 'datum (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'datum a čas UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'jednoduchý výběr',
  'choix multiple (liste de valeurs)': 'vícenásobný výběr (seznam hodnot)',
  'relation (`_id` de la ligne liée)': 'vazba (`_id` propojeného řádku)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'vícenásobná vazba (seznam `_id` propojených řádků, v jejich pořadí)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL odkaz (`https://…` nebo `mailto:…`)',
  'adresse e-mail': 'e-mailová adresa',
  'numéro automatique (lecture seule)': 'automatické číslo (jen pro čtení)',
  'personne (`id` d’un membre de l’espace)': 'osoba (`id` člena pracovního prostoru)',
  formule: 'vzorec',
  'documents (liste de fichiers)': 'dokumenty (seznam souborů)',
  'images (liste de fichiers)': 'obrázky (seznam souborů)',
  'colonne système': 'systémový sloupec',
  'Un texte plus long.': 'Delší text.',
  valeur: 'hodnota',
  Exemple: 'Příklad',
  résultat: 'výsledek',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'nabidka.pdf',
  Exemples: 'Příklady',
  'Lister les lignes': 'Vypsat řádky',
  Réponse: 'Odpověď',
  'Créer une ligne': 'Vytvořit řádek',
  'Déposer un fichier': 'Nahrát soubor',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Tělem je samotný soubor. Odpověď vrací `id`, které pak zapíšete do {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Identita tokenu: kdo ho vytvořil, jeho databáze, jeho skutečná oprávnění a jeho rozpočty.',
  'Les bases que le jeton peut lire.': 'Databáze, které token může číst.',
  'Les tables d’une base et le graphe de leurs relations.': 'Tabulky databáze a graf jejich vazeb.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Pole tabulky: typ, povinnost, možnosti, vazby a která z nich lze upravovat.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Čtení řádků: filtr, řazení, stránkování kurzorem.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Čtení řádku podle jeho `_id`, s dlouhými texty v plné délce, pokud o to požádáte.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Nalezení `_id` řádku podle jeho zobrazované hodnoty, před zápisem vazby.',
  'Créer une ligne.': 'Vytvoření řádku.',
  'Modifier les champs nommés d’une ligne.': 'Úprava pojmenovaných polí řádku.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Odstranění řádku, s tokenem vytvořeným k odstranění — odpověď ho vrátí.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Vrácení odstraněného řádku, pod jeho `_id`, z historie.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Návrh tabulky a jejích prvních polí — rozhoduje osoba.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Návrh pole, seznamu voleb nebo vazby — rozhoduje osoba.',
  'Proposer la couleur et le pictogramme d’une table et des choix de ses listes — une personne décide.':
    'Návrh barvy a ikony tabulky a voleb v jejích seznamech — rozhoduje osoba.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Zpětné přečtení návrhu tokenu a zjištění, jak o něm bylo rozhodnuto.',
  'dépôt basedb': 'repozitář basedb',
  'Depuis un agent (MCP)': 'Ze strany agenta (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Tato databáze není otevřená agentům: žádný nástroj MCP tuto tabulku nevidí, ať je token jakýkoli.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Zjistit její pole a která z nich lze upravovat',
  'Lire ses lignes — filtre, tri, pagination': 'Číst její řádky — filtr, řazení, stránkování',
  'Lire une ligne par son `_id`': 'Přečíst řádek podle jeho `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Najít řádek podle jeho zobrazované hodnoty, {field}',
  'Modifier une ligne': 'Upravit řádek',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Odstranit řádek — s tokenem vytvořeným k odstranění',
  'Ramener une ligne supprimée': 'Vrátit odstraněný řádek',
  'Aucun outil ne vous est ouvert sur cette table.':
    'K této tabulce pro vás není otevřený žádný nástroj.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Token, který vytvoříte, nemá nikdy víc práv než vy: tyto nástroje jsou maximum.',
  Outil: 'Nástroj',
  Pour: 'Účel',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Agent odstraňuje pouze s tokenem vytvořeným s oprávněním „Čtení, zápis a odstranění“, a to jeden řádek po druhém; odstraněný řádek se vrátí pomocí `restore_record`, nebo z historie.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Neviditelné pro agenta:** {fields}. Pro něj tyto sloupce neexistují: nemůže je ani číst, ani filtrovat, ani zapisovat.',
  'Arguments d’un appel': 'Argumenty volání',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Vytvoření tokenu pro tuto databázi vyžaduje úroveň **Správa**, kterou nemáte. Požádejte o něj osobu, která databázi spravuje.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Připojení agenta',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    '**Server MCP** basedb otevírá tuto databázi AI agentovi — Claude nebo libovolnému klientovi MCP: agent ji objevuje, čte a, pokud se tak rozhodnete, v ní vytváří, upravuje a odstraňuje řádky. Řídí se stejnými oprávněními jako REST API.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Tato databáze není otevřená agentům.** Dokud otevřená není, žádný nástroj ji nevidí, ať je předložen jakýkoli token.',
  'Créer un jeton': 'Vytvoření tokenu',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton ouvre **toute la base, tous ses environnements** — production, recette… — ou un seul, si vous le limitez. Il est en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'V rozhraní: v nabídce „⋯“ databáze → **API a agenti** → **Tokeny API a MCP…**, zaškrtnutý přístup **MCP**. Token otevírá **celou databázi, všechna její prostředí** — produkční, testovací… — nebo jen jedno, pokud ho omezíte. Je ve výchozím nastavení **jen pro čtení**: zápis, a odstranění, se volí výslovně. Zobrazí se jen jednou a lze ho zrušit ze stejné obrazovky. Když je zaškrtnuto i pro **REST API**, stejný token slouží programu (viz „Autentizace“).',
  'Garder le jeton hors de la configuration': 'Uchování tokenu mimo konfiguraci',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Token patří do proměnné prostředí `BASEDB_TOKEN`, nikdy do konfiguračního souboru klienta: ten je verzovaný, synchronizovaný a čitelný všemi programy dané relace.',
  'Déclarer le serveur dans le client': 'Nastavení serveru v klientovi',
  'Un client qui parle MCP en HTTP — Claude Code, entre autres — vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Dans le fichier `.mcp.json` d’un projet, `${BASEDB_TOKEN}` est lu dans l’environnement : le jeton ne s’écrit pas dans le fichier. Le même jeton peut déclarer un serveur par environnement.':
    'Klient, který mluví MCP přes HTTP — mimo jiné Claude Code — míří přímo na adresu serveru, `…/mcp`, s hlavičkou {header}. V souboru `.mcp.json` projektu se `${BASEDB_TOKEN}` čte z proměnných prostředí: token se do souboru nepíše. Stejným tokenem lze deklarovat server pro každé prostředí.',
  'Client sans HTTP : le relais': 'Klient bez HTTP: relé',
  'Un client qui ne lance que des programmes locaux (stdio) passe par le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit —, l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`), et l’environnement dans `--environment` (ou `BASEDB_MCP_ENVIRONMENT`).':
    'Klient, který spouští jen místní programy (stdio), používá **relé** `relay.js`, které přenáší jeho zprávy až na server. Token čte z proměnné, kterou pojmenuje `--token-env` — `BASEDB_MCP_TOKEN`, pokud není řečeno jinak —, adresu serveru z `--url` (nebo `BASEDB_MCP_URL`) a prostředí z `--environment` (nebo `BASEDB_MCP_ENVIRONMENT`).',
  'Autre client MCP': 'Jiný klient MCP',
  'votre-instance': 'vase-instance',
  recette: 'testovaci',
  'Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Token je přijat jen pro přístupy zaškrtnuté při jeho vytvoření: token jen pro „MCP“ REST API odmítne, a naopak.',
  'Choisir l’environnement': 'Volba prostředí',
  'Une base peut avoir plusieurs environnements — production, recette, développement —, chacun avec ses tables et ses lignes. Un jeton de toute la base les ouvre tous ; l’environnement se choisit à l’appel, du plus large au plus précis :':
    'Databáze může mít více prostředí — produkční, testovací, vývojové —, každé s vlastními tabulkami a řádky. Token celé databáze je otevírá všechna; prostředí se volí při volání, od nejširšího po nejpřesnější:',
  '**Le nom de la base**, sans rien d’autre : {base} est la production, et chaque environnement garde aussi son propre nom.':
    '**Název databáze**, bez čehokoli dalšího: {base} je produkční prostředí a každé prostředí si zachovává i svůj vlastní název.',
  '**L’adresse du serveur** : {address} — un serveur déclaré par environnement.':
    '**Adresa serveru**: {address} — jeden deklarovaný server na prostředí.',
  '**L’argument `environment`** de chaque outil qui nomme une base, pour un seul appel : {example}.':
    '**Argument `environment`** každého nástroje, který jmenuje databázi, pro jediné volání: {example}.',
  'Un environnement se nomme par son badge, sans tenir compte des majuscules ni des accents, ou `production`. Un environnement que la base n’a pas répond `RESOURCE_NOT_FOUND`.':
    'Prostředí se jmenuje podle svého štítku, bez ohledu na velká písmena a diakritiku, nebo `production`. Prostředí, které databáze nemá, odpoví `RESOURCE_NOT_FOUND`.',
  Vérifier: 'Ověření',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée, les environnements qu’il ouvre (`scope.available`) et ses droits effectifs.':
    'Požádejte agenta, aby zavolal `whoami`: vrátí osobu, která token vytvořila, databázi jeho platnosti, prostředí, která otevírá (`scope.available`), a jeho skutečná oprávnění.',
  Outils: 'Nástroje',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} nástrojů, vždy stejných: jejich název a popis nikdy nezávisí na vašich datech. Schéma se zjistí jejich zavoláním.',
  Rôle: 'Role',
  Écrit: 'Zapisuje?',
  oui: 'ano',
  propose: 'navrhuje',
  non: 'ne',
  'Enchaînement type': 'Typický postup',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, poté `describe_base`: co existuje.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` před jakýmkoli čtením nebo zápisem: pole, jejich typy a ta, která token může zapisovat (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` s `filter`, `sort` a `limit`; pokračujte pomocí `cursor`, dokud je `has_more` rovno `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Pro zápis vazby: `lookup_records` na cílové tabulce, poté `create_record` nebo `update_record` s nalezeným `_id`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Pro změnu struktury: `propose_create_table` nebo `propose_add_field`, poté `get_proposal` pro sledování rozhodnutí.',
  'Pour l’apparence : `color` et `icon` dans `propose_create_table` et dans les choix de `propose_add_field`, ou `propose_update_look` pour une table qui existe.':
    'Pro vzhled: `color` a `icon` v `propose_create_table` a ve volbách `propose_add_field`, nebo `propose_update_look` pro již existující tabulku.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Pro odstranění: nejprve `get_record`, aby bylo jisté, o který řádek jde, poté `delete_record` — ten ho vrátí ve své odpovědi; `restore_record` ho vrátí zpět.',
  'Propositions de structure': 'Návrhy změn struktury',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Agent nikdy strukturu neupravuje sám: pouze ji **navrhuje**. Návrh čeká ve frontě „Návrhy“ dané databáze, kde ho osoba, která může upravovat strukturu, schválí nebo zamítne; bez rozhodnutí vyprší po 24 hodinách. Po schválení se použije jménem osoby, která token vytvořila — pokud k tomu tato osoba stále má právo — a objeví se v historii jako jakákoli jiná změna.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Nejvýše 5 čekajících návrhů na token; nový návrh na stejný objekt nahradí ten předchozí (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Žádné odstraňování, žádné přejmenování, žádná kaskádová vazba (`MCP_CASCADE_FORBIDDEN`).',
  'Couleurs et pictogrammes': 'Barvy a ikony',
  'Une table et chaque choix d’une liste ont une couleur et un pictogramme, comme dans l’application. `color` est une couleur `#rrggbb` ; `icon` est le nom d’un pictogramme parmi ceux que l’application dessine — le schéma de l’outil les énumère. Une clé omise garde ce qui est en place, `null` l’efface. `describe_base` et `describe_table` rendent l’apparence actuelle.':
    'Tabulka a každá volba seznamu mají barvu a ikonu, stejně jako v aplikaci. `color` je barva `#rrggbb`; `icon` je název jedné z ikon, které aplikace vykresluje — schéma nástroje je vyjmenovává. Vynechaný klíč ponechá to, co je nastaveno, `null` to vymaže. `describe_base` a `describe_table` vracejí aktuální vzhled.',
  'Ce qui n’existe pas': 'Co neexistuje',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Žádný nástroj neodstraňuje více řádků najednou, celou tabulku ani pole, nespouští SQL ani nespravuje oprávnění nebo tokeny. Agent, který zavolá takový název — `delete_records`, `run_sql`… — dostane `MCP_OPERATION_EXCLUDED`, ať je cílová databáze jakákoli.',
  Bornes: 'Limity',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: výchozí hodnota 25 řádků, nejvýše 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Filtr má nejvýše 10 predikátů, kombinovaných pomocí A; řazení nejvýše 3 pole.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'V seznamu je text delší než 500 znaků zkrácen a uveden v `_truncated_fields`; `get_record` s `full_fields` ho vrátí celý.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Zápis přijímá `idempotency_key`: jeho zopakování nevytvoří duplicitu.',
  'Ce que voit un agent': 'Co agent vidí',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Agent nikdy nevidí víc než osoba, která vytvořila jeho token — a často méně.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Oprávnění**: oprávnění tokenu, při každém volání porovnaná s oprávněními jeho tvůrce. Pokud se oprávnění této osoby sníží, sníží se s nimi i oprávnění tokenu; pokud je její účet deaktivován, token přestane odpovídat.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Číst, vytvářet, upravovat** — a odstraňovat, jeden řádek po druhém, pouze s tokenem vytvořeným k tomu. Token jen pro čtení odmítne jakýkoli zápis (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Tato databáze**: otevřená agentům.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Tato databáze**: **uzavřená agentům** — žádný nástroj ji nevidí.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Sloupce vyhrazené lidem**: žádné v tom, co z této databáze vidíte.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Sloupce vyhrazené lidem**: {columns}. Pro agenta neexistují.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Data, ne pokyny**: popisy a obsah jsou předávány jako data zadaná uživateli a nástroje to agentovi sdělují.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Záznam**: každé volání je zaznamenáno podle tvaru svých parametrů, nikdy podle jejich hodnot.',
  obligatoire: 'povinné',
  'calculé par l’IA': 'počítáno AI',
  'lecture seule': 'jen pro čtení',
  'HTML riche — **à assainir à l’affichage**':
    'formátované HTML — **při zobrazení nutno vyčistit**',
  'invisible pour les agents': 'neviditelné pro agenty',
  'relation → {table}': 'vazba → {table}',
  'Valeurs : {values}.': 'Hodnoty: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'cíl pro vás není viditelný: buňka má vždy hodnotu {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'odkazuje na {table} (není určen žádný zobrazovací sloupec: buňka zobrazuje identifikátor)',
  'pointe vers {table}, affiché par {field}': 'odkazuje na {table}, zobrazeno podle {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'při odstranění: odstranění cílového řádku je odmítnuto, dokud je odkazován',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'při odstranění: odstranění cílového řádku tuto buňku vyprázdní',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'při odstranění: odstranění cílového řádku odstraní i tento řádek',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'při zápisu je přijímáno holé `uuid`, `null` nebo `{"id": "…"}`; při čtení vždy `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Vypsat řádky — filtr, řazení, stránkování kurzorem',
  'Lire une ligne': 'Přečíst řádek',
  'Supprimer une ligne': 'Odstranit řádek',
  'Lister les lignes qui pointent vers celle-ci': 'Vypsat řádky, které na něj odkazují',
  Méthode: 'Metoda',
  Chemin: 'Cesta',
  lire: 'číst',
  créer: 'vytvářet',
  modifier: 'upravovat',
  supprimer: 'odstraňovat',
  '**En SQL :** {sql}': '**V SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Můžete {verbs}. Slovesa, která v tomto seznamu chybí, pro vás nejsou otevřená, a odpovídající cesty nejsou popsány.',
  'Points d’accès': 'Koncové body',
  Colonnes: 'Sloupce',
  Colonne: 'Sloupec',
  Libellé: 'Popisek',
  Type: 'Typ',
  Description: 'Popis',
  'Champs relation': 'Vazební pole',
  'Colonnes système': 'Systémové sloupce',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Vždy čitelné, nikdy zapisovatelné. Nesou stránkování kurzorem a přírůstkové navazování, a žádné nastavení je neskryje.',
  Expansion: 'Rozšíření',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — hloubka 1 bez výjimky. Propojené objekty přicházejí v `included`, indexované podle názvu tabulky a poté podle identifikátoru, a nejsou vnořené do řádku: 100 řádků odkazujících na 3 cíle přenáší 3 objekty.',
  'Lignes référençantes': 'Odkazující řádky',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} vypíše řádky, které odkazují na daný řádek. Blok, jehož zdrojová tabulka pro vás není viditelná, se v něm vůbec neobjeví — žádný blok, žádný počet, žádná zmínka.',
  'une table que vous ne voyez pas': 'tabulku, kterou nevidíte',
  'Vue d’ensemble': 'Přehled',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Tato databáze se jmenuje {name} — to je název **schématu PostgreSQL**, a je to i to, co píšete do svých URL adres i do volání nástrojů. Tabulky a sloupce nesou stejné názvy zde i v SQL: neexistuje žádná převodní tabulka, kterou byste museli hledat.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Dva přístupy, stejná oprávnění: **REST API** pro vaše programy, **server MCP** pro AI agenty. Každá stránka tabulky říká, jak se k ní dostat oběma způsoby.',
  Élément: 'Prvek',
  Valeur: 'Hodnota',
  'Schéma PostgreSQL': 'Schéma PostgreSQL',
  'Préfixe des routes REST': 'Předpona REST cest',
  'ouverte — voir « Connecter un agent »': 'otevřená — viz „Připojení agenta“',
  '**fermée aux agents**': '**uzavřená agentům**',
  'Tables visibles': 'Viditelné tabulky',
  Format: 'Formát',
  'JSON, dans une enveloppe {envelope}': 'JSON, v obálce {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Tato dokumentace popisuje to, co můžete vidět VY.** Dva čtenáři z ní dostanou dvě různé verze, a to je pravidlo, ne vedlejší efekt. Nezveřejňujte ji v této podobě.',
  Authentification: 'Autentizace',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Všechny datové cesty vyžadují **token**, v hlavičce `Authorization`. Cookie relace zde není nikdy přijímána: prohlížeč ji odesílá při každém požadavku, včetně těch, které vyvolá cizí stránka.',
  'Jeton d’intégration': 'Integrační token',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base — tous ses environnements, ou un seul ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Program — skript, synchronizace, jiná aplikace — předkládá **integrační token**, který začíná na `bdb_`. Platí jen pro tuto databázi — všechna její prostředí, nebo jen jedno; čte, a pokud byl vytvořen pro zápis, i vytváří a upravuje, a **odstraňuje jen tehdy, pokud byl vytvořen i k tomu**; nikdy nemá víc práv než osoba, která ho vytvořila, porovnávaných při každém volání. Administrace, SQL konzole a AI mu zůstávají uzavřené.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Pro vytvoření: v nabídce „⋯“ databáze → **API a agenti** → **Tokeny API a MCP…**, zaškrtnutý přístup **REST API**. Zobrazí se jen jednou.',
  Appel: 'Volání',
  Environnement: 'Prostředí',
  'Un jeton créé pour toute la base ouvre tous ses environnements. Le chemin nomme la base — {base} est la production — et l’en-tête {header} choisit l’environnement ; `?environment=` fait de même pour un client qui ne pose pas d’en-tête. Sans l’un ni l’autre, c’est l’environnement que nomme la base.':
    'Token vytvořený pro celou databázi otevírá všechna její prostředí. Cesta jmenuje databázi — {base} je produkční prostředí — a hlavička {header} vybírá prostředí; `?environment=` dělá totéž pro klienta, který hlavičky nenastavuje. Bez obojího platí prostředí, které jmenuje databáze.',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Chybějící autentizace odpoví `401`, nikdy `404`: musíte se moci znovu přihlásit.',
  Conventions: 'Konvence',
  Enveloppe: 'Obálka',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Všechny odpovědi mají stejný tvar: {envelope}. Chyba nahradí `data` kódem, podrobnostmi a identifikátorem požadavku.',
  Nombres: 'Čísla',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Čísla jsou desetinné řetězce**, bez výjimky: {example}. Číslo s plovoucí desetinnou čárkou by tiše zaokrouhlilo částku.',
  montant: 'castka',
  'Ressource invisible': 'Neviditelný zdroj',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Neviditelný zdroj a neexistující zdroj odpovídají stejně**, bajt po bajtu. `404` vám nikdy neřekne, jestli objekt existuje.',
  Pagination: 'Stránkování',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Stránkování kurzorem**: sledujte `meta.has_next_page` a předávejte `after`. Neexistuje žádná cesta pro export.',
  'Identifiants seuls': 'Pouze identifikátory',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Pro integraci, která chce jen identifikátory, `?links=id` vynechá překlad popisků — a s ním stejný počet zpátečních volání do SQL.',
  Relations: 'Vazby',
  'Aucune relation visible dans cette base.': 'V této databázi nejsou žádné viditelné vazby.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Vazby jsou **skutečné cizí klíče PostgreSQL**. Jsou ověřovány databází, ne aplikací: `INSERT` přímo v SQL podléhá stejným pravidlům.',
  'Codes de réponse': 'Kódy odpovědí',
  Statut: 'Stav',
  Signification: 'Význam',
  'Succès.': 'Úspěch.',
  'Ligne créée.': 'Řádek vytvořen.',
  'Suppression réussie, sans contenu.': 'Úspěšné odstranění, bez obsahu.',
  'Authentification absente ou refusée.': 'Chybějící nebo odmítnutá autentizace.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Neexistující **nebo** neviditelný zdroj — obě odpovědi jsou stejné.',
  'Suppression refusée : la ligne est encore référencée.':
    'Odstranění odmítnuto: řádek je stále odkazován.',
  'Valeur refusée par la validation.': 'Hodnota odmítnuta validací.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Chyba má vždy tento tvar a `request_id` je to, co je třeba uvést podpoře:',
  'La liste complète des codes est servie par {route}.': 'Úplný seznam kódů poskytuje {route}.',
  'Côté MCP': 'Na straně MCP',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Odmítnutí přichází jako výsledek nástroje označený `isError`, jehož text je stabilní objekt JSON: stejný `code` jako u API, pevná věta a `hint`, který říká, jak volání opravit. `retryable` říká, zda má smysl to zkusit znovu beze změny.',
  'Écrire en SQL direct': 'Zápis přímo v SQL',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Otevřete `psql`: funguje to, to je smysl produktu.',
  'Ce qui vous attend :': 'Co vás čeká:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Platí omezení — povinnost, délka, cizí klíč. Odkazovaný řádek nelze odstranit.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Systémové sloupce se při ručním `INSERT` samy nevyplní: `_id`, `_created_at` a `_updated_at` mají výchozí hodnoty, `_created_by` a `_updated_by` očekávají identifikátor uživatele.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**Oprávnění basedb se v přímém SQL neuplatňují.** Řídí povrchy produktu — API, rozhraní, MCP. Připojení PostgreSQL vidí vše, co vidí jeho role. Říkáme to zde proto, že slibovat opak by bylo horší než neslibovat nic.',
  '{base} — documentation API et MCP': '{base} — dokumentace API a MCP',
}
