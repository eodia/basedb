import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Ukrainian: the French sentence of `documentation.ts` → its translation. */
export const uk: Catalog = {
  'Prise en main': 'Початок роботи',
  'API REST': 'REST API',
  'Agents (MCP)': 'Агенти (MCP)',
  Tables: 'Таблиці',
  Référence: 'Довідка',
  texte: 'текст',
  'texte long': 'довгий текст',
  'nombre (chaîne décimale)': 'число (десятковий рядок)',
  booléen: 'логічне значення',
  'date (`2026-09-18`)': 'дата (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'дата й час UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'список вибору',
  'choix multiple (liste de valeurs)': 'множинний вибір (список значень)',
  'relation (`_id` de la ligne liée)': 'зв’язок (`_id` пов’язаного рядка)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'множинний зв’язок (список `_id` пов’язаних рядків, у їхньому порядку)',
  'lien URL (`https://…` ou `mailto:…`)': 'посилання URL (`https://…` або `mailto:…`)',
  'adresse e-mail': 'адреса електронної пошти',
  'numéro automatique (lecture seule)': 'автоматичний номер (лише читання)',
  'personne (`id` d’un membre de l’espace)': 'особа (`id` учасника робочого простору)',
  formule: 'формула',
  'documents (liste de fichiers)': 'документи (список файлів)',
  'images (liste de fichiers)': 'зображення (список файлів)',
  'colonne système': 'системний стовпець',
  'Un texte plus long.': 'Довший текст.',
  valeur: 'значення',
  Exemple: 'Приклад',
  résultat: 'результат',
  'photo.jpg': 'photo.jpg',
  'devis.pdf': 'koshtorys.pdf',
  Exemples: 'Приклади',
  'Lister les lignes': 'Отримати список рядків',
  Réponse: 'Відповідь',
  'Créer une ligne': 'Створити рядок',
  'Déposer un fichier': 'Завантажити файл',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'Тіло запиту — це сам файл. У відповіді повертається `id`, який потім слід записати в {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'Особа токена: хто його створив, його база, його фактичні дозволи та бюджети.',
  'Les bases que le jeton peut lire.': 'Бази, які може читати токен.',
  'Les tables d’une base et le graphe de leurs relations.': 'Таблиці бази та граф їхніх зв’язків.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Поля таблиці: тип, обов’язковість, варіанти, зв’язки та які з них можна змінювати.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Читання рядків: фільтр, сортування, курсорна пагінація.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Прочитати рядок за його `_id`, з довгими текстами повністю, якщо це запитано.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Знайти `_id` рядка за значенням його відображення, перед тим як записати зв’язок.',
  'Créer une ligne.': 'Створити рядок.',
  'Modifier les champs nommés d’une ligne.': 'Змінити названі поля рядка.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Видалити рядок токеном, створеним для видалення, — відповідь повертає його.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Повернути видалений рядок, під його `_id`, з історії.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Запропонувати таблицю та її перші поля — рішення ухвалює людина.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Запропонувати поле, список вибору або зв’язок — рішення ухвалює людина.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Переглянути пропозицію токена та дізнатися, що з нею сталося.',
  'dépôt basedb': 'репозиторій basedb',
  'Depuis un agent (MCP)': 'Від агента (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Ця база не відкрита для агентів: жоден інструмент MCP не бачить цю таблицю, незалежно від токена.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Дізнатися її поля та які з них можна змінювати',
  'Lire ses lignes — filtre, tri, pagination': 'Читати її рядки — фільтр, сортування, пагінація',
  'Lire une ligne par son `_id`': 'Прочитати рядок за його `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Знайти рядок за значенням його відображення, {field}',
  'Modifier une ligne': 'Змінити рядок',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Видалити рядок — токеном, створеним для видалення',
  'Ramener une ligne supprimée': 'Повернути видалений рядок',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Жоден інструмент не відкритий вам для цієї таблиці.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Токен, який ви створюєте, ніколи не має більше дозволів, ніж ви: ці інструменти — це максимум.',
  Outil: 'Інструмент',
  Pour: 'Призначення',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Агент видаляє лише токеном, створеним із правами «Читання, запис і видалення», і лише по одному рядку; видалений рядок повертається через `restore_record` або з історії.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Невидимі для агента:** {fields}. Для нього ці стовпці не існують: він не може ні читати їх, ні фільтрувати, ні записувати.',
  'Arguments d’un appel': 'Аргументи виклику',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Щоб створити токен для цієї бази, потрібен рівень **Керування**, якого у вас немає. Попросіть його в людини, яка керує базою.',
  '<jeton>': '<токен>',
  'Connecter un agent': 'Підключити агента',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    '**Сервер MCP** basedb відкриває цю базу агенту ШІ — Claude чи будь-якому клієнту MCP: він виявляє її, читає й, якщо ви так вирішите, створює, змінює та видаляє в ній рядки. Він діє за тими самими дозволами, що й REST API.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Ця база не відкрита для агентів.** Поки це так, жоден інструмент її не бачить, незалежно від пред’явленого токена.',
  'Créer un jeton': 'Створити токен',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'В інтерфейсі, у меню бази «⋯» → **API та агенти** → **Токени API і MCP…**, позначте доступ **MCP**. Токен обмежено цією базою, за замовчуванням **лише читання**: запис, і видалення, вибираються явно. Він показується лише один раз і відкликається з того самого екрана. Якщо позначено також **REST API**, той самий токен слугує для програми (див. «Автентифікація»).',
  'Garder le jeton hors de la configuration': 'Тримати токен поза конфігурацією',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'Токен розміщують у змінній середовища `BASEDB_TOKEN`, ніколи у файлі конфігурації клієнта: він версіонується, синхронізується і доступний для читання всім програмам сеансу.',
  'Déclarer le serveur dans le client': 'Оголосити сервер у клієнті',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'Клієнт запускає **ретранслятор** `relay.js`, який передає його повідомлення до сервера. Він читає токен зі змінної, яку називає `--token-env` — `BASEDB_MCP_TOKEN`, якщо нічого не вказано, — і адресу сервера з `--url` (або `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Інший клієнт MCP',
  'votre-instance': 'vasha-instantsiia',
  'Sans relais': 'Без ретранслятора',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Клієнт, який спілкується MCP через HTTP, звертається безпосередньо до адреси сервера, `…/mcp`, із заголовком {header}. Токен приймається лише для тих доступів, що позначено під час його створення: токен лише з доступом «MCP» відхиляється REST API, і навпаки.',
  Vérifier: 'Перевірити',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Попросіть агента викликати `whoami`: він повертає особу, яка створила токен, базу його дії та його фактичні дозволи.',
  Outils: 'Інструменти',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} інструментів, завжди тих самих: їхня назва та опис ніколи не залежать від ваших даних. Схему можна дізнатися, викликавши їх.',
  Rôle: 'Призначення',
  Écrit: 'Записує',
  oui: 'так',
  propose: 'пропонує',
  non: 'ні',
  'Enchaînement type': 'Типова послідовність',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases`, потім `describe_base`: що існує.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` перед будь-яким читанням чи записом: поля, їхні типи та ті з них, які токен може записувати (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` із `filter`, `sort` і `limit`; продовжувати з `cursor`, поки `has_more` дорівнює `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Щоб записати зв’язок: `lookup_records` на цільовій таблиці, потім `create_record` або `update_record` зі знайденим `_id`.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Щоб змінити структуру: `propose_create_table` або `propose_add_field`, потім `get_proposal`, щоб відстежити рішення.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Щоб видалити: спершу `get_record`, щоб переконатися в рядку, потім `delete_record` — який віддає його у своїй відповіді; `restore_record` повертає його назад.',
  'Propositions de structure': 'Пропозиції щодо структури',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Агент ніколи сам не змінює структуру: він **пропонує**. Пропозиція очікує в черзі «Пропозиції» бази, де людина, яка може змінювати структуру, схвалює або відхиляє її; без рішення вона спливає через 24 години. Схвалена, вона застосовується від імені особи, яка створила токен, — якщо ця особа й досі має на це право, — і з’являється в історії як будь-яка інша зміна.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Не більше 5 пропозицій в очікуванні на токен; нова пропозиція щодо того самого об’єкта замінює попередню (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Ніякого видалення, ніякого перейменування, ніякого каскадного зв’язку (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Чого не існує',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Жоден інструмент не видаляє кілька рядків одразу, таблицю чи поле, не виконує SQL і не керує дозволами чи токенами. Агент, який викликає таку назву — `delete_records`, `run_sql`… — отримує `MCP_OPERATION_EXCLUDED`, незалежно від цільової бази.',
  Bornes: 'Обмеження',
  '`limit` : 25 lignes par défaut, 100 au plus.':
    '`limit`: 25 рядків за замовчуванням, не більше 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Фільтр містить не більше 10 предикатів, поєднаних через І; сортування — не більше 3 полів.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'У списку текст, довший за 500 символів, обрізається і зазначається в `_truncated_fields`; `get_record` із `full_fields` повертає його повністю.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Запис приймає `idempotency_key`: повторне надсилання не створює дубліката.',
  'Ce que voit un agent': 'Що бачить агент',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Агент ніколи не бачить більше, ніж особа, яка створила його токен, — а часто й менше.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Дозволи**: ті, що має токен, які при кожному виклику звіряються з дозволами його творця. Якщо дозволи цієї особи зменшуються, дозволи токена зменшуються разом із ними; якщо її обліковий запис вимкнено, токен перестає відповідати.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Читати, створювати, змінювати** — і видаляти, по одному рядку, лише токеном, створеним для цього. Токен лише для читання відхиляє будь-який запис (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Ця база**: відкрита для агентів.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Ця база**: **закрита для агентів** — жоден інструмент її не бачить.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Стовпці, зарезервовані для людей**: жодного серед того, що ви бачите в цій базі.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Стовпці, зарезервовані для людей**: {columns}. Для агента їх не існує.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Дані, а не інструкції**: описи та вміст подаються як дані, введені користувачами, і інструменти повідомляють про це агенту.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Журнал**: кожен виклик журналюється за формою його параметрів, ніколи за їхніми значеннями.',
  obligatoire: 'обов’язкове',
  'calculé par l’IA': 'обчислено ШІ',
  'lecture seule': 'лише читання',
  'HTML riche — **à assainir à l’affichage**': 'Розширений HTML — **очищати перед показом**',
  'invisible pour les agents': 'невидиме для агентів',
  'relation → {table}': 'зв’язок → {table}',
  'Valeurs : {values}.': 'Значення: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'ціль не видима для вас: клітинка завжди має значення {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'вказує на {table} (стовпець відображення не визначено: клітинка показує ідентифікатор)',
  'pointe vers {table}, affiché par {field}': 'вказує на {table}, відображається через {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'при видаленні: видалення цільового рядка відхиляється, доки на нього є посилання',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'при видаленні: видалення цільового рядка спорожняє цю клітинку',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'при видаленні: видалення цільового рядка видаляє також цей рядок',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'у записі приймається голий `uuid`, `null`, або `{"id": "…"}`; у читанні — завжди `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Отримати список рядків — фільтр, сортування, курсорна пагінація',
  'Lire une ligne': 'Прочитати рядок',
  'Supprimer une ligne': 'Видалити рядок',
  'Lister les lignes qui pointent vers celle-ci':
    'Отримати список рядків, що посилаються на цей рядок',
  Méthode: 'Метод',
  Chemin: 'Шлях',
  lire: 'читати',
  créer: 'створювати',
  modifier: 'змінювати',
  supprimer: 'видаляти',
  '**En SQL :** {sql}': '**У SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Ви можете {verbs}. Дієслова, яких немає в цьому переліку, вам недоступні, а відповідні шляхи не описані.',
  'Points d’accès': 'Точки доступу',
  Colonnes: 'Стовпці',
  Colonne: 'Стовпець',
  Libellé: 'Мітка',
  Type: 'Тип',
  Description: 'Опис',
  'Champs relation': 'Поля зв’язку',
  'Colonnes système': 'Системні стовпці',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Завжди доступні для читання, ніколи для запису. Вони забезпечують курсорну пагінацію та інкрементальне відновлення, і жодне налаштування їх не приховує.',
  Expansion: 'Розгортання',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — глибина 1 без винятків. Пов’язані об’єкти надходять у `included`, індексовані за назвою таблиці, а потім за ідентифікатором, а не вкладені в рядок: 100 рядків, що вказують на 3 цілі, передають 3 об’єкти.',
  'Lignes référençantes': 'Рядки, що посилаються',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} повертає список рядків, що вказують на заданий рядок. Блок, вихідна таблиця якого вам не видима, там узагалі не з’являється — ні блока, ні лічильника, ні згадки.',
  'une table que vous ne voyez pas': 'таблиця, яку ви не бачите',
  'Vue d’ensemble': 'Загальний огляд',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Ця база називається {name} — це назва **схеми PostgreSQL**, і саме її ви пишете як у своїх URL, так і у викликах інструментів. Таблиці й стовпці мають однакові назви тут і в SQL: немає жодної таблиці відповідностей, яку треба звіряти.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Два способи доступу, ті самі дозволи: **REST API** для ваших програм, **сервер MCP** для агентів ШІ. Кожна сторінка таблиці пояснює, як звернутися до неї через один і через інший.',
  Élément: 'Елемент',
  Valeur: 'Значення',
  'Schéma PostgreSQL': 'Схема PostgreSQL',
  'Préfixe des routes REST': 'Префікс маршрутів REST',
  'ouverte — voir « Connecter un agent »': 'відкрита — див. «Підключити агента»',
  '**fermée aux agents**': '**закрита для агентів**',
  'Tables visibles': 'Видимі таблиці',
  Format: 'Формат',
  'JSON, dans une enveloppe {envelope}': 'JSON, в оболонці {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Ця документація описує те, що можете бачити САМЕ ВИ.** Двоє читачів отримують дві різні версії, і це правило, а не побічний ефект. Не публікуйте її як є.',
  Authentification: 'Автентифікація',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Усі маршрути даних вимагають **токен** у заголовку `Authorization`. Кука сеансу тут ніколи не приймається: браузер надсилає її з кожним запитом, зокрема з тими, які провокує стороння сторінка.',
  'Jeton d’intégration': 'Токен інтеграції',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Програма — скрипт, синхронізація, інший застосунок — пред’являє **токен інтеграції**, який починається з `bdb_`. Він дійсний лише для цієї бази; він читає, створює й змінює, якщо його створено з правом запису, і **видаляє лише якщо його створено для цього**; він ніколи не має більше дозволів, ніж особа, яка його створила, що звіряються при кожному виклику. Адміністрування, консоль SQL та ШІ для нього залишаються закритими.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Щоб створити такий: у меню бази «⋯» → **API та агенти** → **Токени API і MCP…**, позначте доступ **REST API**. Він показується лише один раз.',
  Appel: 'Виклик',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Відсутня автентифікація відповідає `401`, ніколи не `404`: ви повинні мати змогу знову увійти.',
  Conventions: 'Угоди',
  Enveloppe: 'Оболонка',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Усі відповіді мають однакову форму: {envelope}. Помилка замінює `data` кодом, деталями та ідентифікатором запиту.',
  Nombres: 'Числа',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Числа — це десяткові рядки**, без винятків: {example}. Число з плаваючою комою мовчки округлило б суму.',
  montant: 'suma',
  'Ressource invisible': 'Невидимий ресурс',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Невидимий ресурс і неіснуючий ресурс дають однакову відповідь**, байт у байт. `404` ніколи не каже вам, чи існує об’єкт.',
  Pagination: 'Пагінація',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Курсорна пагінація**: стежте за `meta.has_next_page` і передавайте `after`. Жодного маршруту експорту не існує.',
  'Identifiants seuls': 'Лише ідентифікатори',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Для інтеграції, якій потрібні лише ідентифікатори, `?links=id` прибирає визначення міток — і стільки ж зворотних звернень до SQL.',
  Relations: 'Зв’язки',
  'Aucune relation visible dans cette base.': 'У цій базі немає видимих зв’язків.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Зв’язки — це **справжні зовнішні ключі PostgreSQL**. Вони перевіряються базою, а не застосунком: `INSERT` напряму в SQL підпорядковується тим самим правилам.',
  'Codes de réponse': 'Коди відповідей',
  Statut: 'Статус',
  Signification: 'Значення',
  'Succès.': 'Успіх.',
  'Ligne créée.': 'Рядок створено.',
  'Suppression réussie, sans contenu.': 'Успішне видалення, без вмісту.',
  'Authentification absente ou refusée.': 'Автентифікація відсутня або відхилена.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Ресурс не існує **або** невидимий — обидві відповіді ідентичні.',
  'Suppression refusée : la ligne est encore référencée.':
    'Видалення відхилено: на рядок ще є посилання.',
  'Valeur refusée par la validation.': 'Значення відхилено перевіркою.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Помилка завжди має таку форму, і саме `request_id` слід вказувати в зверненні до підтримки:',
  'La liste complète des codes est servie par {route}.': 'Повний перелік кодів надає {route}.',
  'Côté MCP': 'З боку MCP',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Відмова надходить як результат інструмента, позначений `isError`, текст якого є стабільним об’єктом JSON: той самий `code`, що й в API, фіксована фраза та `hint`, який пояснює, як виправити виклик. `retryable` вказує, чи варто повторити спробу без змін.',
  'Écrire en SQL direct': 'Писати напряму в SQL',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Відкрийте `psql`: це працює, у цьому й полягає мета продукту.',
  'Ce qui vous attend :': 'Що на вас чекає:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Обмеження застосовуються — обов’язковість, довжина, зовнішній ключ. Рядок, на який є посилання, не видаляється.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Системні стовпці не заповнюються самі собою в ручному `INSERT`: `_id`, `_created_at` і `_updated_at` мають значення за замовчуванням, а `_created_by` і `_updated_by` очікують ідентифікатор користувача.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**Дозволи basedb не застосовуються в прямому SQL.** Вони керують поверхнями продукту — API, інтерфейсом, MCP. З’єднання PostgreSQL бачить усе, що бачить його роль. Це сказано тут, бо пообіцяти протилежне було б гірше, ніж не обіцяти нічого.',
  '{base} — documentation API et MCP': '{base} — документація API та MCP',
}
