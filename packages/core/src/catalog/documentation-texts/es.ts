import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Spanish: the French sentence of `documentation.ts` → its translation. */
export const es: Catalog = {
  'Prise en main': 'Primeros pasos',
  'API REST': 'API REST',
  'Agents (MCP)': 'Agentes (MCP)',
  Tables: 'Tablas',
  Référence: 'Referencia',
  texte: 'texto',
  'texte long': 'texto largo',
  'nombre (chaîne décimale)': 'número (cadena decimal)',
  booléen: 'booleano',
  'date (`2026-09-18`)': 'fecha (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'fecha y hora UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'selección única',
  'choix multiple (liste de valeurs)': 'selección múltiple (lista de valores)',
  'relation (`_id` de la ligne liée)': 'relación (`_id` de la fila vinculada)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'relación múltiple (lista de los `_id` de las filas vinculadas, en su orden)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL (`https://…` o `mailto:…`)',
  'adresse e-mail': 'correo electrónico',
  'numéro automatique (lecture seule)': 'número automático (solo lectura)',
  'personne (`id` d’un membre de l’espace)': 'persona (`id` de un miembro del espacio de trabajo)',
  formule: 'fórmula',
  'documents (liste de fichiers)': 'documentos (lista de archivos)',
  'images (liste de fichiers)': 'imágenes (lista de archivos)',
  'colonne système': 'columna del sistema',
  'Un texte plus long.': 'Un texto más largo.',
  valeur: 'valor',
  Exemple: 'Ejemplo',
  résultat: 'resultado',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'presupuesto.pdf',
  Exemples: 'Ejemplos',
  'Lister les lignes': 'Listar las filas',
  Réponse: 'Respuesta',
  'Créer une ligne': 'Crear una fila',
  'Déposer un fichier': 'Subir un archivo',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'El cuerpo es el propio archivo. La respuesta da un `id`, que debe escribirse después en {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'La identidad del token: quién lo creó, su base, sus permisos efectivos y sus cuotas.',
  'Les bases que le jeton peut lire.': 'Las bases que el token puede leer.',
  'Les tables d’une base et le graphe de leurs relations.':
    'Las tablas de una base y el grafo de sus relaciones.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Los campos de una tabla: tipo, obligatoriedad, opciones, relaciones y cuáles se pueden modificar.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Leer filas: filtro, ordenación, paginación por cursor.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Leer una fila por su `_id`, con los textos largos completos si se solicita.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Encontrar el `_id` de una fila por el valor de su campo principal, antes de escribir una relación.',
  'Créer une ligne.': 'Crear una fila.',
  'Modifier les champs nommés d’une ligne.': 'Modificar los campos indicados de una fila.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Proponer una tabla y sus primeros campos — una persona decide.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Proponer un campo, una selección única o una relación — una persona decide.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Releer una propuesta del token y saber en qué ha quedado.',
  'dépôt basedb': 'repositorio basedb',
  'Depuis un agent (MCP)': 'Desde un agente (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Esta base no está abierta a los agentes: ninguna herramienta MCP ve esta tabla, sea cual sea el token.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Conocer sus campos, y cuáles se pueden modificar',
  'Lire ses lignes — filtre, tri, pagination': 'Leer sus filas — filtro, ordenación, paginación',
  'Lire une ligne par son `_id`': 'Leer una fila por su `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Encontrar una fila por el valor de su campo principal, {field}',
  'Modifier une ligne': 'Modificar una fila',
  'Aucun outil ne vous est ouvert sur cette table.':
    'No tienes ninguna herramienta disponible en esta tabla.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Un token que creas nunca tiene más permisos que tú: estas herramientas son un máximo.',
  Outil: 'Herramienta',
  Pour: 'Para',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Eliminar una fila, con un token creado para eliminar — la respuesta la devuelve.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Restaurar una fila eliminada, con su `_id`, desde el historial.',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Eliminar una fila — con un token creado para eliminar',
  'Ramener une ligne supprimée': 'Restaurar una fila eliminada',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Un agente solo elimina con un token creado «Lectura, escritura y eliminación», una fila a la vez; la fila eliminada vuelve mediante `restore_record` o desde el historial.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Para eliminar: `get_record` primero, para estar seguro de la fila, y luego `delete_record` — que la devuelve en su respuesta; `restore_record` la restaura.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Invisibles para un agente:** {fields}. Para él, estas columnas no existen: no puede leerlas, filtrarlas ni escribirlas.',
  'Arguments d’un appel': 'Argumentos de una llamada',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Crear un token para esta base requiere el nivel **Gestión**, que no tienes. Pídeselo a la persona que la gestiona.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Conectar un agente',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'El **servidor MCP** de basedb abre esta base a un agente de IA — Claude o cualquier cliente MCP: la descubre, la lee y, si tú lo decides, crea, modifica y elimina filas en ella. Pasa por los mismos permisos que la API REST.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Esta base no está abierta a los agentes.** Mientras no lo esté, ninguna herramienta la ve, sea cual sea el token presentado.',
  'Créer un jeton': 'Crear un token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'En la interfaz, menú «⋯» de la base → **API y agentes** → **Tokens de API y MCP…**, con el acceso **MCP** marcado. El token está limitado a esta base, en **solo lectura** de forma predeterminada: la escritura, y la eliminación, se eligen explícitamente. Solo se muestra una vez, y se revoca desde la misma pantalla. Marcado también para la **API REST**, el mismo token sirve para un programa (ver «Autenticación»).',
  'Garder le jeton hors de la configuration': 'Mantener el token fuera de la configuración',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'El token se coloca en la variable de entorno `BASEDB_TOKEN`, nunca en el archivo de configuración del cliente: este está versionado, se sincroniza y lo pueden leer todos los programas de la sesión.',
  'Déclarer le serveur dans le client': 'Declarar el servidor en el cliente',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'El cliente lanza el **relé** `relay.js`, que transporta sus mensajes hasta el servidor. Lee el token en la variable que indica `--token-env` — `BASEDB_MCP_TOKEN` si no se indica nada — y la dirección del servidor en `--url` (o `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Otro cliente MCP',
  'votre-instance': 'tu-instancia',
  'Sans relais': 'Sin relé',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Un cliente que habla MCP por HTTP apunta directamente a la dirección del servidor, `…/mcp`, con la cabecera {header}. Un token solo se acepta en los accesos marcados al crearlo: un token con solo «MCP» marcado es rechazado por la API REST, y viceversa.',
  Vérifier: 'Comprobar',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Pide al agente que llame a `whoami`: devuelve la persona que creó el token, la base de su alcance y sus permisos efectivos.',
  Outils: 'Herramientas',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} herramientas, siempre las mismas: su nombre y su descripción nunca dependen de tus datos. El esquema se descubre llamándolas.',
  Rôle: 'Función',
  Écrit: 'Escribe',
  oui: 'sí',
  propose: 'propone',
  non: 'no',
  'Enchaînement type': 'Secuencia típica',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases` y luego `describe_base`: qué existe.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` antes de cualquier lectura o escritura: los campos, sus tipos, y cuáles puede escribir el token (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` con `filter`, `sort` y `limit`; continuar con `cursor` mientras `has_more` sea `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Para escribir una relación: `lookup_records` en la tabla de destino, y luego `create_record` o `update_record` con el `_id` encontrado.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Para hacer evolucionar la estructura: `propose_create_table` o `propose_add_field`, y luego `get_proposal` para seguir la decisión.',
  'Propositions de structure': 'Propuestas de estructura',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Un agente nunca modifica la estructura por sí mismo: **propone**. La propuesta espera en la cola «Propuestas» de la base, donde una persona que puede modificar la estructura la aprueba o la rechaza; sin decisión, caduca a las 24 horas. Una vez aprobada, se aplica en nombre de la persona que creó el token — si esa persona todavía tiene derecho a hacerlo — y aparece en el historial como cualquier otra modificación.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'Como máximo 5 propuestas pendientes por token; una nueva propuesta sobre el mismo objeto sustituye a la anterior (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Sin eliminación, sin cambio de nombre, sin relación en cascada (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'Lo que no existe',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Ninguna herramienta elimina varias filas a la vez, una tabla o un campo, ejecuta SQL ni gestiona los permisos o los tokens. Un agente que llama a un nombre así — `delete_records`, `run_sql`… — recibe `MCP_OPERATION_EXCLUDED`, sea cual sea la base de destino.',
  Bornes: 'Límites',
  '`limit` : 25 lignes par défaut, 100 au plus.':
    '`limit`: 25 filas de forma predeterminada, 100 como máximo.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Un filtro tiene como máximo 10 predicados, combinados con Y; una ordenación, como máximo 3 campos.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'En una lista, un texto de más de 500 caracteres se trunca y se indica en `_truncated_fields`; `get_record` con `full_fields` lo devuelve completo.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Una escritura acepta una `idempotency_key`: repetirla no crea un duplicado.',
  'Ce que voit un agent': 'Lo que ve un agente',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Un agente nunca ve más que la persona que creó su token — y a menudo menos.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Permisos**: los del token, cruzados en cada llamada con los de su creador. Si los permisos de esa persona disminuyen, los del token disminuyen con ellos; si su cuenta se desactiva, el token deja de responder.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Leer, crear, modificar** — y eliminar, una fila a la vez, solo con un token creado para ello. Un token de solo lectura rechaza cualquier escritura (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Esta base**: abierta a los agentes.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Esta base**: **cerrada a los agentes** — ninguna herramienta la ve.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Columnas reservadas para humanos**: ninguna en lo que ves de esta base.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Columnas reservadas para humanos**: {columns}. Para un agente, no existen.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Datos, no instrucciones**: las descripciones y los contenidos se presentan como datos introducidos por usuarios, y las herramientas se lo indican al agente.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Registro**: cada llamada se registra según la forma de sus parámetros, nunca según sus valores.',
  obligatoire: 'obligatorio',
  'calculé par l’IA': 'calculado por la IA',
  'lecture seule': 'solo lectura',
  'HTML riche — **à assainir à l’affichage**':
    'HTML enriquecido — **que debe sanearse al mostrarlo**',
  'invisible pour les agents': 'invisible para los agentes',
  'relation → {table}': 'relación → {table}',
  'Valeurs : {values}.': 'Valores: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'destino no visible para ti: la celda siempre vale {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'apunta a {table} (sin campo principal definido: la celda muestra el identificador)',
  'pointe vers {table}, affiché par {field}': 'apunta a {table}, mostrado por {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'al eliminar: eliminar la fila de destino se rechaza mientras esté referenciada',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'al eliminar: eliminar la fila de destino vacía esta celda',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'al eliminar: eliminar la fila de destino también elimina esta fila',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'al escribir, acepta un `uuid` simple, `null`, o `{"id": "…"}`; al leer, siempre `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Listar las filas — filtro, ordenación, paginación por cursor',
  'Lire une ligne': 'Leer una fila',
  'Supprimer une ligne': 'Eliminar una fila',
  'Lister les lignes qui pointent vers celle-ci': 'Listar las filas que apuntan a esta',
  Méthode: 'Método',
  Chemin: 'Ruta',
  lire: 'leer',
  créer: 'crear',
  modifier: 'modificar',
  supprimer: 'eliminar',
  '**En SQL :** {sql}': '**En SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Puedes {verbs}. Los verbos que faltan en esta lista no están disponibles para ti, y las rutas correspondientes no se describen.',
  'Points d’accès': 'Puntos de acceso',
  Colonnes: 'Columnas',
  Colonne: 'Columna',
  Libellé: 'Etiqueta',
  Type: 'Tipo',
  Description: 'Descripción',
  'Champs relation': 'Campos de relación',
  'Colonnes système': 'Columnas del sistema',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Siempre legibles, nunca modificables. Sostienen la paginación por cursor y la reanudación incremental, y ningún ajuste las oculta.',
  Expansion: 'Expansión',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — profundidad 1 sin excepción. Los objetos vinculados llegan en `included`, indexados por nombre de tabla y luego por identificador, sin anidarse en la fila: 100 filas que apuntan a 3 destinos transportan 3 objetos.',
  'Lignes référençantes': 'Filas que referencian',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} muestra las filas que apuntan a una fila dada. Un bloque cuya tabla de origen no te es visible no aparece en absoluto — ni bloque, ni contador, ni mención.',
  'une table que vous ne voyez pas': 'una tabla que no puedes ver',
  'Vue d’ensemble': 'Visión general',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Esta base se llama {name} — es el nombre del **esquema PostgreSQL**, y el que escribes tanto en tus URL como en las llamadas a las herramientas. Las tablas y las columnas tienen los mismos nombres aquí y en SQL: no hay ninguna tabla de correspondencias que consultar.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Dos accesos, los mismos permisos: la **API REST** para tus programas, el **servidor MCP** para los agentes de IA. Cada página de tabla indica cómo llegar a ella por uno y por otro.',
  Élément: 'Elemento',
  Valeur: 'Valor',
  'Schéma PostgreSQL': 'Esquema PostgreSQL',
  'Préfixe des routes REST': 'Prefijo de las rutas REST',
  'ouverte — voir « Connecter un agent »': 'abierta — ver «Conectar un agente»',
  '**fermée aux agents**': '**cerrada a los agentes**',
  'Tables visibles': 'Tablas visibles',
  Format: 'Formato',
  'JSON, dans une enveloppe {envelope}': 'JSON, dentro de un envoltorio {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Esta documentación describe lo que TÚ puedes ver.** Dos lectores obtienen dos versiones distintas, y esa es la regla, no un efecto secundario. No la publiques tal cual.',
  Authentification: 'Autenticación',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Todas las rutas de datos requieren un **token**, en la cabecera `Authorization`. La cookie de sesión nunca se acepta aquí: un navegador la envía en cada solicitud, incluidas las que provoca una página externa.',
  'Jeton d’intégration': 'Token de integración',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Un programa — script, sincronización, otra aplicación — presenta un **token de integración**, que empieza por `bdb_`. Solo es válido para esta base; lee, crea y modifica si se ha creado con permiso de escritura, y **solo elimina si se ha creado para ello**; nunca tiene más permisos que la persona que lo creó, cruzados en cada llamada. La administración, la consola SQL y la IA le quedan cerradas.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Para crear uno: menú «⋯» de la base → **API y agentes** → **Tokens de API y MCP…**, con el acceso **API REST** marcado. Solo se muestra una vez.',
  Appel: 'Llamada',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'Una autenticación ausente responde `401`, nunca `404`: debes poder volver a conectarte.',
  Conventions: 'Convenciones',
  Enveloppe: 'Envoltorio',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Todas las respuestas tienen la misma forma: {envelope}. Un error sustituye `data` por el código, los detalles y el identificador de la solicitud.',
  Nombres: 'Números',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Los números son cadenas decimales**, sin excepción: {example}. Un flotante redondearía silenciosamente un importe.',
  montant: 'importe',
  'Ressource invisible': 'Recurso invisible',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Un recurso invisible y un recurso inexistente responden lo mismo**, byte por byte. Un `404` nunca te dice si el objeto existe.',
  Pagination: 'Paginación',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Paginación por cursor**: sigue `meta.has_next_page` y pasa `after`. No existe ninguna ruta de exportación.',
  'Identifiants seuls': 'Solo identificadores',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Para una integración que solo quiere identificadores, `?links=id` elimina la resolución de las etiquetas — y otros tantos viajes de ida y vuelta a SQL.',
  Relations: 'Relaciones',
  'Aucune relation visible dans cette base.': 'Ninguna relación visible en esta base.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'Las relaciones son **auténticas claves foráneas de PostgreSQL**. Las verifica la base, no la aplicación: un `INSERT` en SQL directo está sujeto a las mismas reglas.',
  'Codes de réponse': 'Códigos de respuesta',
  Statut: 'Estado',
  Signification: 'Significado',
  'Succès.': 'Éxito.',
  'Ligne créée.': 'Fila creada.',
  'Suppression réussie, sans contenu.': 'Eliminación correcta, sin contenido.',
  'Authentification absente ou refusée.': 'Autenticación ausente o rechazada.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Recurso inexistente **o** invisible — ambas respuestas son idénticas.',
  'Suppression refusée : la ligne est encore référencée.':
    'Eliminación rechazada: la fila todavía está referenciada.',
  'Valeur refusée par la validation.': 'Valor rechazado por la validación.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Un error siempre tiene esta forma, y `request_id` es lo que hay que indicar al soporte:',
  'La liste complète des codes est servie par {route}.':
    'La lista completa de los códigos la sirve {route}.',
  'Côté MCP': 'Del lado de MCP',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Un rechazo llega como un resultado de herramienta marcado `isError`, cuyo texto es un objeto JSON estable: el mismo `code` que la API, una frase fija, y un `hint` que indica cómo corregir la llamada. `retryable` indica si vale la pena reintentarlo tal cual.',
  'Écrire en SQL direct': 'Escribir en SQL directo',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Abre `psql`: funciona, ese es el objetivo del producto.',
  'Ce qui vous attend :': 'Lo que te espera:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'Las restricciones se aplican — obligatoriedad, longitud, clave foránea. Una fila referenciada no se puede eliminar.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'Las columnas del sistema no se rellenan solas en un `INSERT` manual: `_id`, `_created_at` y `_updated_at` tienen valores predeterminados, `_created_by` y `_updated_by` esperan un identificador de usuario.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**Los permisos de basedb no se aplican en SQL directo.** Rigen las superficies del producto — API, interfaz, MCP. Una conexión PostgreSQL ve todo lo que ve su rol. Se dice aquí porque prometer lo contrario sería peor que no prometer nada.',
  '{base} — documentation API et MCP': '{base} — documentación de API y MCP',
}
