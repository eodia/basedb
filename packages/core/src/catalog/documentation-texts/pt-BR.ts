import type { Catalog } from './catalog.js'

/** The API and MCP documentation in Brazilian Portuguese: the French sentence of `documentation.ts` → its translation. */
export const ptBR: Catalog = {
  'Prise en main': 'Primeiros passos',
  'API REST': 'API REST',
  'Agents (MCP)': 'Agentes (MCP)',
  Tables: 'Tabelas',
  Référence: 'Referência',
  texte: 'texto',
  'texte long': 'texto longo',
  'nombre (chaîne décimale)': 'número (string decimal)',
  booléen: 'booleano',
  'date (`2026-09-18`)': 'data (`2026-09-18`)',
  'date-heure UTC (`2026-09-18T14:03:00.000Z`)': 'data e hora UTC (`2026-09-18T14:03:00.000Z`)',
  'liste de choix': 'seleção única',
  'choix multiple (liste de valeurs)': 'seleção múltipla (lista de valores)',
  'relation (`_id` de la ligne liée)': 'relação (`_id` da linha vinculada)',
  'relation multiple (liste des `_id` des lignes liées, dans leur ordre)':
    'relação múltipla (lista dos `_id` das linhas vinculadas, na ordem delas)',
  'lien URL (`https://…` ou `mailto:…`)': 'URL (`https://…` ou `mailto:…`)',
  'adresse e-mail': 'endereço de e-mail',
  'numéro automatique (lecture seule)': 'numeração automática (somente leitura)',
  'personne (`id` d’un membre de l’espace)': 'pessoa (`id` de um membro do espaço de trabalho)',
  formule: 'fórmula',
  'documents (liste de fichiers)': 'documentos (lista de arquivos)',
  'images (liste de fichiers)': 'imagens (lista de arquivos)',
  'colonne système': 'coluna do sistema',
  'Un texte plus long.': 'Um texto mais longo.',
  valeur: 'valor',
  Exemple: 'Exemplo',
  résultat: 'resultado',
  'photo.jpg': 'foto.jpg',
  'devis.pdf': 'orcamento.pdf',
  Exemples: 'Exemplos',
  'Lister les lignes': 'Listar as linhas',
  Réponse: 'Resposta',
  'Créer une ligne': 'Criar uma linha',
  'Déposer un fichier': 'Enviar um arquivo',
  'Le corps est le fichier lui-même. La réponse donne un `id`, à écrire ensuite dans {field} : {write}.':
    'O corpo é o próprio arquivo. A resposta traz um `id`, que deve ser escrito depois em {field}: {write}.',
  'L’identité du jeton : qui l’a créé, sa base, ses droits effectifs et ses budgets.':
    'A identidade do token: quem o criou, sua base, suas permissões efetivas e seus orçamentos.',
  'Les bases que le jeton peut lire.': 'As bases que o token pode ler.',
  'Les tables d’une base et le graphe de leurs relations.':
    'As tabelas de uma base e o grafo das relações delas.',
  'Les champs d’une table : type, obligation, options, relations, et lesquels sont modifiables.':
    'Os campos de uma tabela: tipo, obrigatoriedade, opções, relações, e quais podem ser editados.',
  'Lire des lignes : filtre, tri, pagination par curseur.':
    'Ler linhas: filtro, ordenação, paginação por cursor.',
  'Lire une ligne par son `_id`, les textes longs en entier si on le demande.':
    'Ler uma linha pelo `_id`, com os textos longos por completo se solicitado.',
  'Trouver le `_id` d’une ligne par sa valeur d’affichage, avant d’écrire une relation.':
    'Encontrar o `_id` de uma linha pelo valor de exibição dela, antes de escrever uma relação.',
  'Créer une ligne.': 'Criar uma linha.',
  'Modifier les champs nommés d’une ligne.': 'Editar os campos indicados de uma linha.',
  'Supprimer une ligne, avec un jeton créé pour supprimer — la réponse la rend.':
    'Excluir uma linha, com um token criado para excluir — a resposta a retorna.',
  'Ramener une ligne supprimée, sous son `_id`, depuis l’historique.':
    'Restaurar uma linha excluída, pelo `_id` dela, a partir do histórico.',
  'Proposer une table et ses premiers champs — une personne décide.':
    'Propor uma tabela e seus primeiros campos — uma pessoa decide.',
  'Proposer un champ, une liste de choix ou une relation — une personne décide.':
    'Propor um campo, uma lista de opções ou uma relação — uma pessoa decide.',
  'Relire une proposition du jeton et savoir ce qu’il en est advenu.':
    'Reler uma proposta do token e saber o que aconteceu com ela.',
  'dépôt basedb': 'repositório basedb',
  'Depuis un agent (MCP)': 'A partir de um agente (MCP)',
  'Cette base n’est pas ouverte aux agents : aucun outil MCP ne voit cette table, quel que soit le jeton.':
    'Esta base não está aberta a agentes: nenhuma ferramenta MCP vê esta tabela, seja qual for o token.',
  'Connaître ses champs, et lesquels sont modifiables':
    'Conhecer os campos dela, e quais podem ser editados',
  'Lire ses lignes — filtre, tri, pagination': 'Ler as linhas dela — filtro, ordenação, paginação',
  'Lire une ligne par son `_id`': 'Ler uma linha pelo `_id`',
  'Trouver une ligne par sa valeur d’affichage, {field}':
    'Encontrar uma linha pelo valor de exibição dela, {field}',
  'Modifier une ligne': 'Editar uma linha',
  'Supprimer une ligne — avec un jeton créé pour supprimer':
    'Excluir uma linha — com um token criado para excluir',
  'Ramener une ligne supprimée': 'Restaurar uma linha excluída',
  'Aucun outil ne vous est ouvert sur cette table.':
    'Nenhuma ferramenta está disponível para você nesta tabela.',
  'Un jeton que vous créez n’a jamais plus de droits que vous : ces outils sont un maximum.':
    'Um token que você cria nunca tem mais permissões do que você: estas ferramentas são um máximo.',
  Outil: 'Ferramenta',
  Pour: 'Para',
  'Un agent ne supprime qu’avec un jeton créé « Lecture, écriture et suppression », une ligne à la fois ; la ligne supprimée revient par `restore_record` ou depuis l’historique.':
    'Um agente só exclui com um token criado “Leitura, escrita e exclusão”, uma linha por vez; a linha excluída volta por `restore_record` ou a partir do histórico.',
  '**Invisibles pour un agent :** {fields}. Pour lui, ces colonnes n’existent pas : il ne peut ni les lire, ni les filtrer, ni les écrire.':
    '**Invisíveis para um agente:** {fields}. Para ele, essas colunas não existem: ele não pode lê-las, filtrá-las nem escrevê-las.',
  'Arguments d’un appel': 'Argumentos de uma chamada',
  'Créer un jeton pour cette base demande le niveau **Gestion**, que vous n’avez pas. Demandez-en un à la personne qui la gère.':
    'Criar um token para esta base exige o nível **Gerenciamento**, que você não tem. Peça um à pessoa que a gerencia.',
  '<jeton>': '<token>',
  'Connecter un agent': 'Conectar um agente',
  'Le **serveur MCP** de basedb ouvre cette base à un agent IA — Claude ou tout client MCP : il la découvre, la lit et, si vous le décidez, y crée, modifie et supprime des lignes. Il passe par les mêmes permissions que l’API REST.':
    'O **servidor MCP** do basedb abre esta base para um agente de IA — Claude ou qualquer cliente MCP: ele a descobre, a lê e, se você decidir, cria, altera e exclui linhas nela. Ele passa pelas mesmas permissões que a API REST.',
  '**Cette base n’est pas ouverte aux agents.** Tant qu’elle ne l’est pas, aucun outil ne la voit, quel que soit le jeton présenté.':
    '**Esta base não está aberta a agentes.** Enquanto isso não mudar, nenhuma ferramenta a vê, seja qual for o token apresentado.',
  'Créer un jeton': 'Criar um token',
  'Dans l’interface, menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **MCP** coché. Le jeton est limité à cette base, en **lecture seule** par défaut : l’écriture, et la suppression, se choisissent explicitement. Il n’est affiché qu’une fois, et se révoque depuis le même écran. Coché aussi pour l’**API REST**, le même jeton sert à un programme (voir « Authentification »).':
    'Na interface, menu “⋯” da base → **API e agentes** → **Tokens de API e MCP…**, com o acesso **MCP** marcado. O token é limitado a esta base, em **somente leitura** por padrão: a escrita, e a exclusão, são escolhidas explicitamente. Ele só é exibido uma vez, e se revoga na mesma tela. Marcado também para a **API REST**, o mesmo token serve para um programa (veja “Autenticação”).',
  'Garder le jeton hors de la configuration': 'Manter o token fora da configuração',
  'Le jeton se place dans la variable d’environnement `BASEDB_TOKEN`, jamais dans le fichier de configuration du client : celui-ci est versionné, synchronisé, et lisible par tous les programmes de la session.':
    'O token vai na variável de ambiente `BASEDB_TOKEN`, nunca no arquivo de configuração do cliente: ele é versionado, sincronizado e legível por todos os programas da sessão.',
  'Déclarer le serveur dans le client': 'Declarar o servidor no cliente',
  'Le client lance le **relais** `relay.js`, qui transporte ses messages jusqu’au serveur. Il lit le jeton dans la variable que nomme `--token-env` — `BASEDB_MCP_TOKEN` si rien n’est dit — et l’adresse du serveur dans `--url` (ou `BASEDB_MCP_URL`).':
    'O cliente inicia o **relay** `relay.js`, que transporta as mensagens dele até o servidor. Ele lê o token na variável indicada por `--token-env` — `BASEDB_MCP_TOKEN` se nada for dito — e o endereço do servidor em `--url` (ou `BASEDB_MCP_URL`).',
  'Autre client MCP': 'Outro cliente MCP',
  'votre-instance': 'sua-instancia',
  'Sans relais': 'Sem relay',
  'Un client qui parle MCP en HTTP vise directement l’adresse du serveur, `…/mcp`, avec l’en-tête {header}. Un jeton n’est accepté que sur les accès cochés à sa création : un jeton « MCP » seul est refusé par l’API REST, et inversement.':
    'Um cliente que fala MCP por HTTP acessa diretamente o endereço do servidor, `…/mcp`, com o cabeçalho {header}. Um token só é aceito nos acessos marcados no momento da criação: um token só “MCP” é recusado pela API REST, e vice-versa.',
  Vérifier: 'Verificar',
  'Demandez à l’agent d’appeler `whoami` : il rend la personne qui a créé le jeton, la base de sa portée et ses droits effectifs.':
    'Peça ao agente para chamar `whoami`: ele retorna a pessoa que criou o token, a base do escopo dele e as permissões efetivas dele.',
  Outils: 'Ferramentas',
  '{count} outils, toujours les mêmes : leur nom et leur description ne dépendent jamais de vos données. Le schéma se découvre en les appelant.':
    '{count} ferramentas, sempre as mesmas: o nome e a descrição delas nunca dependem dos seus dados. O esquema é descoberto ao chamá-las.',
  Rôle: 'Função',
  Écrit: 'Escreve?',
  oui: 'sim',
  propose: 'propõe',
  non: 'não',
  'Enchaînement type': 'Sequência típica',
  '`list_bases`, puis `describe_base` : ce qui existe.':
    '`list_bases` e depois `describe_base`: o que existe.',
  '`describe_table` avant toute lecture ou écriture : les champs, leurs types, et ceux que le jeton peut écrire (`access: "write"`).':
    '`describe_table` antes de qualquer leitura ou escrita: os campos, os tipos deles, e quais o token pode escrever (`access: "write"`).',
  '`list_records` avec `filter`, `sort` et `limit` ; poursuivre avec `cursor` tant que `has_more` vaut `true`.':
    '`list_records` com `filter`, `sort` e `limit`; continuar com `cursor` enquanto `has_more` for `true`.',
  'Pour écrire une relation : `lookup_records` sur la table cible, puis `create_record` ou `update_record` avec le `_id` trouvé.':
    'Para escrever uma relação: `lookup_records` na tabela de destino, depois `create_record` ou `update_record` com o `_id` encontrado.',
  'Pour faire évoluer la structure : `propose_create_table` ou `propose_add_field`, puis `get_proposal` pour suivre la décision.':
    'Para evoluir a estrutura: `propose_create_table` ou `propose_add_field`, depois `get_proposal` para acompanhar a decisão.',
  'Pour supprimer : `get_record` d’abord, pour être sûr de la ligne, puis `delete_record` — qui la rend dans sa réponse ; `restore_record` la ramène.':
    'Para excluir: `get_record` primeiro, para ter certeza da linha, depois `delete_record` — que a retorna na resposta; `restore_record` a restaura.',
  'Propositions de structure': 'Propostas de estrutura',
  'Un agent ne modifie jamais la structure lui-même : il **propose**. La proposition attend dans la file « Propositions » de la base, où une personne qui peut modifier la structure l’approuve ou la refuse ; sans décision, elle expire au bout de 24 heures. Approuvée, elle est appliquée au nom de la personne qui a créé le jeton — si cette personne a toujours le droit de le faire — et apparaît dans l’historique comme n’importe quelle modification.':
    'Um agente nunca altera a estrutura sozinho: ele **propõe**. A proposta aguarda na fila “Propostas” da base, onde uma pessoa que pode alterar a estrutura a aprova ou a recusa; sem decisão, ela expira depois de 24 horas. Aprovada, ela é aplicada em nome da pessoa que criou o token — se essa pessoa ainda tiver o direito de fazê-lo — e aparece no histórico como qualquer outra alteração.',
  'Au plus 5 propositions en attente par jeton ; une nouvelle proposition sur le même objet remplace la précédente (`superseded`).':
    'No máximo 5 propostas pendentes por token; uma nova proposta sobre o mesmo objeto substitui a anterior (`superseded`).',
  'Pas de suppression, pas de renommage, pas de relation en cascade (`MCP_CASCADE_FORBIDDEN`).':
    'Nada de exclusão, nada de renomeação, nada de relação em cascata (`MCP_CASCADE_FORBIDDEN`).',
  'Ce qui n’existe pas': 'O que não existe',
  'Aucun outil ne supprime plusieurs lignes à la fois, une table ou un champ, n’exécute de SQL ni ne gère les droits ou les jetons. Un agent qui appelle un tel nom — `delete_records`, `run_sql`… — reçoit `MCP_OPERATION_EXCLUDED`, quelle que soit la base visée.':
    'Nenhuma ferramenta exclui várias linhas de uma vez, uma tabela ou um campo, executa SQL ou gerencia permissões ou tokens. Um agente que chama um nome desses — `delete_records`, `run_sql`… — recebe `MCP_OPERATION_EXCLUDED`, seja qual for a base visada.',
  Bornes: 'Limites',
  '`limit` : 25 lignes par défaut, 100 au plus.': '`limit`: 25 linhas por padrão, no máximo 100.',
  'Un filtre compte au plus 10 prédicats, combinés par ET ; un tri, au plus 3 champs.':
    'Um filtro tem no máximo 10 predicados, combinados por E; uma ordenação, no máximo 3 campos.',
  'Dans une liste, un texte de plus de 500 caractères est tronqué et nommé dans `_truncated_fields` ; `get_record` avec `full_fields` le rend entier.':
    'Em uma lista, um texto com mais de 500 caracteres é truncado e citado em `_truncated_fields`; `get_record` com `full_fields` o traz por completo.',
  'Une écriture accepte une `idempotency_key` : la rejouer ne crée pas de doublon.':
    'Uma escrita aceita uma `idempotency_key`: repeti-la não cria duplicata.',
  'Ce que voit un agent': 'O que um agente vê',
  'Un agent ne voit jamais plus que la personne qui a créé son jeton — et souvent moins.':
    'Um agente nunca vê mais do que a pessoa que criou o token dele — e geralmente menos.',
  '**Droits** : ceux du jeton, recoupés à chaque appel avec ceux de son créateur. Si les droits de cette personne baissent, ceux du jeton baissent avec eux ; si son compte est désactivé, le jeton cesse de répondre.':
    '**Permissões**: as do token, cruzadas a cada chamada com as de quem o criou. Se as permissões dessa pessoa diminuírem, as do token diminuem junto; se a conta dela for desativada, o token para de responder.',
  '**Lire, créer, modifier** — et supprimer, une ligne à la fois, seulement avec un jeton créé pour cela. Un jeton en lecture seule refuse toute écriture (`TOKEN_READ_ONLY`).':
    '**Ler, criar, editar** — e excluir, uma linha por vez, somente com um token criado para isso. Um token somente leitura recusa qualquer escrita (`TOKEN_READ_ONLY`).',
  '**Cette base** : ouverte aux agents.': '**Esta base**: aberta a agentes.',
  '**Cette base** : **fermée aux agents** — aucun outil ne la voit.':
    '**Esta base**: **fechada a agentes** — nenhuma ferramenta a vê.',
  '**Colonnes réservées aux humains** : aucune dans ce que vous voyez de cette base.':
    '**Colunas reservadas para humanos**: nenhuma no que você vê desta base.',
  '**Colonnes réservées aux humains** : {columns}. Pour un agent, elles n’existent pas.':
    '**Colunas reservadas para humanos**: {columns}. Para um agente, elas não existem.',
  '**Des données, pas des consignes** : descriptions et contenus sont rendus comme des données saisies par des utilisateurs, et les outils le disent à l’agent.':
    '**Dados, não instruções**: descrições e conteúdos são apresentados como dados inseridos por usuários, e as ferramentas dizem isso ao agente.',
  '**Journal** : chaque appel est journalisé par la forme de ses paramètres, jamais par leurs valeurs.':
    '**Registro**: cada chamada é registrada pela forma dos parâmetros dela, nunca pelos valores deles.',
  obligatoire: 'obrigatório',
  'calculé par l’IA': 'calculado pela IA',
  'lecture seule': 'somente leitura',
  'HTML riche — **à assainir à l’affichage**': 'HTML formatado — **a ser sanitizado na exibição**',
  'invisible pour les agents': 'invisível para os agentes',
  'relation → {table}': 'relação → {table}',
  'Valeurs : {values}.': 'Valores: {values}.',
  'cible non visible pour vous : la cellule vaut toujours {cell}':
    'destino não visível para você: a célula sempre tem o valor {cell}',
  'pointe vers {table} (aucune colonne d’affichage désignée : la cellule montre l’identifiant)':
    'aponta para {table} (nenhuma coluna de exibição definida: a célula mostra o identificador)',
  'pointe vers {table}, affiché par {field}': 'aponta para {table}, exibido por {field}',
  'à la suppression : supprimer la ligne cible est refusé tant qu’elle est référencée':
    'ao excluir: excluir a linha de destino é recusado enquanto ela estiver referenciada',
  'à la suppression : supprimer la ligne cible vide cette cellule':
    'ao excluir: excluir a linha de destino esvazia esta célula',
  'à la suppression : supprimer la ligne cible supprime aussi cette ligne':
    'ao excluir: excluir a linha de destino também exclui esta linha',
  'en écriture, acceptez un `uuid` nu, `null`, ou `{"id": "…"}` ; en lecture, toujours `{"id": …, "display": …}`':
    'na escrita, aceite um `uuid` puro, `null`, ou `{"id": "…"}`; na leitura, sempre `{"id": …, "display": …}`',
  'Lister les lignes — filtre, tri, pagination par curseur':
    'Listar as linhas — filtro, ordenação, paginação por cursor',
  'Lire une ligne': 'Ler uma linha',
  'Supprimer une ligne': 'Excluir uma linha',
  'Lister les lignes qui pointent vers celle-ci': 'Listar as linhas que apontam para esta',
  Méthode: 'Método',
  Chemin: 'Caminho',
  lire: 'ler',
  créer: 'criar',
  modifier: 'editar',
  supprimer: 'excluir',
  '**En SQL :** {sql}': '**Em SQL:** {sql}',
  'Vous pouvez {verbs}. Les verbes absents de cette liste ne vous sont pas ouverts, et les chemins correspondants ne sont pas décrits.':
    'Você pode {verbs}. Os verbos ausentes desta lista não estão disponíveis para você, e os caminhos correspondentes não são descritos.',
  'Points d’accès': 'Pontos de acesso',
  Colonnes: 'Colunas',
  Colonne: 'Coluna',
  Libellé: 'Rótulo',
  Type: 'Tipo',
  Description: 'Descrição',
  'Champs relation': 'Campos de relação',
  'Colonnes système': 'Colunas do sistema',
  'Toujours lisibles, jamais inscriptibles. Elles portent la pagination par curseur et la reprise incrémentale, et aucun réglage ne les masque.':
    'Sempre legíveis, nunca graváveis. Elas sustentam a paginação por cursor e a retomada incremental, e nenhuma configuração as oculta.',
  Expansion: 'Expansão',
  '{expand} — profondeur 1 sans exception. Les objets liés arrivent dans `included`, indexés par nom de table puis par identifiant, et non imbriqués dans la ligne : 100 lignes pointant 3 cibles transportent 3 objets.':
    '{expand} — profundidade 1 sem exceção. Os objetos vinculados chegam em `included`, indexados por nome de tabela e depois por identificador, e não aninhados na linha: 100 linhas apontando para 3 destinos transportam 3 objetos.',
  'Lignes référençantes': 'Linhas que referenciam',
  '{route} liste les lignes qui pointent vers une ligne donnée. Un bloc dont la table source ne vous est pas visible n’y figure pas du tout — ni bloc, ni compteur, ni mention.':
    '{route} lista as linhas que apontam para uma linha específica. Um bloco cuja tabela de origem não é visível para você não aparece de forma alguma — nem bloco, nem contador, nem menção.',
  'une table que vous ne voyez pas': 'uma tabela que você não vê',
  'Vue d’ensemble': 'Visão geral',
  'Cette base s’appelle {name} — c’est le nom du **schéma PostgreSQL**, et celui que vous écrivez dans vos URL comme dans les appels d’outils. Les tables et les colonnes portent les mêmes noms ici et en SQL : il n’y a pas de table de correspondance à consulter.':
    'Esta base se chama {name} — é o nome do **esquema PostgreSQL**, o mesmo que você escreve nas suas URLs e nas chamadas de ferramentas. As tabelas e as colunas têm os mesmos nomes aqui e em SQL: não há tabela de correspondência para consultar.',
  'Deux accès, les mêmes permissions : l’**API REST** pour vos programmes, le **serveur MCP** pour les agents IA. Chaque page de table dit comment l’atteindre par l’un et par l’autre.':
    'Dois acessos, as mesmas permissões: a **API REST** para os seus programas, o **servidor MCP** para os agentes de IA. Cada página de tabela diz como alcançá-la por um e por outro.',
  Élément: 'Elemento',
  Valeur: 'Valor',
  'Schéma PostgreSQL': 'Esquema PostgreSQL',
  'Préfixe des routes REST': 'Prefixo das rotas REST',
  'ouverte — voir « Connecter un agent »': 'aberta — veja “Conectar um agente”',
  '**fermée aux agents**': '**fechada a agentes**',
  'Tables visibles': 'Tabelas visíveis',
  Format: 'Formato',
  'JSON, dans une enveloppe {envelope}': 'JSON, em um envelope {envelope}',
  '**Cette documentation décrit ce que VOUS pouvez voir.** Deux lecteurs en obtiennent deux versions différentes, et c’est la règle, pas un effet de bord. Ne la publiez pas telle quelle.':
    '**Esta documentação descreve o que VOCÊ pode ver.** Dois leitores obtêm duas versões diferentes disso, e essa é a regra, não um efeito colateral. Não a publique como está.',
  Authentification: 'Autenticação',
  'Toutes les routes de données demandent un **jeton**, dans l’en-tête `Authorization`. Le cookie de session n’est jamais accepté ici : un navigateur l’envoie sur chaque requête, y compris celles qu’une page étrangère provoque.':
    'Todas as rotas de dados exigem um **token**, no cabeçalho `Authorization`. O cookie de sessão nunca é aceito aqui: um navegador o envia em cada requisição, inclusive nas provocadas por uma página externa.',
  'Jeton d’intégration': 'Token de integração',
  'Un programme — script, synchronisation, autre application — présente un **jeton d’intégration**, qui commence par `bdb_`. Il ne vaut que pour cette base ; il lit, crée et modifie s’il a été créé en écriture, et **ne supprime que s’il a été créé pour cela** ; il n’a jamais plus de droits que la personne qui l’a créé, recoupés à chaque appel. L’administration, la console SQL et l’IA lui restent fermées.':
    'Um programa — script, sincronização, outro aplicativo — apresenta um **token de integração**, que começa com `bdb_`. Ele só vale para esta base; ele lê, cria e edita se tiver sido criado com escrita, e **só exclui se tiver sido criado para isso**; nunca tem mais permissões do que a pessoa que o criou, cruzadas a cada chamada. A administração, o console SQL e a IA permanecem fechados para ele.',
  'Pour en créer un : menu « ⋯ » de la base → **API et agents** → **Jetons API et MCP…**, accès **API REST** coché. Il n’est affiché qu’une fois.':
    'Para criar um: menu “⋯” da base → **API e agentes** → **Tokens de API e MCP…**, com o acesso **API REST** marcado. Ele só é exibido uma vez.',
  Appel: 'Chamada',
  'Une authentification absente répond `401`, jamais `404` : vous devez pouvoir vous reconnecter.':
    'A ausência de autenticação retorna `401`, nunca `404`: você deve conseguir se reconectar.',
  Conventions: 'Convenções',
  Enveloppe: 'Envelope',
  'Toutes les réponses ont la même forme : {envelope}. Une erreur remplace `data` par le code, les détails et l’identifiant de requête.':
    'Todas as respostas têm o mesmo formato: {envelope}. Um erro substitui `data` pelo código, os detalhes e o identificador da requisição.',
  Nombres: 'Números',
  '**Les nombres sont des chaînes décimales**, sans exception : {example}. Un flottant arrondirait silencieusement un montant.':
    '**Os números são strings decimais**, sem exceção: {example}. Um float arredondaria silenciosamente um valor.',
  montant: 'montante',
  'Ressource invisible': 'Recurso invisível',
  '**Une ressource invisible et une ressource inexistante répondent la même chose**, octet pour octet. Un `404` ne vous dit jamais si l’objet existe.':
    '**Um recurso invisível e um recurso inexistente respondem exatamente o mesmo**, byte a byte. Um `404` nunca diz se o objeto existe.',
  Pagination: 'Paginação',
  '**Pagination par curseur** : suivez `meta.has_next_page` et passez `after`. Il n’existe aucune route d’export.':
    '**Paginação por cursor**: siga `meta.has_next_page` e passe `after`. Não existe nenhuma rota de exportação.',
  'Identifiants seuls': 'Apenas identificadores',
  'Pour une intégration qui ne veut que des identifiants, `?links=id` supprime la résolution des libellés — et autant d’allers-retours SQL.':
    'Para uma integração que só quer identificadores, `?links=id` elimina a resolução dos rótulos — e todas as idas e vindas de SQL correspondentes.',
  Relations: 'Relações',
  'Aucune relation visible dans cette base.': 'Nenhuma relação visível nesta base.',
  'Les relations sont de **vraies clés étrangères PostgreSQL**. Elles sont vérifiées par la base, pas par l’application : un `INSERT` en SQL direct est soumis aux mêmes règles.':
    'As relações são **verdadeiras chaves estrangeiras do PostgreSQL**. Elas são verificadas pela base, não pela aplicação: um `INSERT` em SQL direto está sujeito às mesmas regras.',
  'Codes de réponse': 'Códigos de resposta',
  Statut: 'Status',
  Signification: 'Significado',
  'Succès.': 'Sucesso.',
  'Ligne créée.': 'Linha criada.',
  'Suppression réussie, sans contenu.': 'Exclusão bem-sucedida, sem conteúdo.',
  'Authentification absente ou refusée.': 'Autenticação ausente ou recusada.',
  'Ressource inexistante **ou** invisible — les deux réponses sont identiques.':
    'Recurso inexistente **ou** invisível — as duas respostas são idênticas.',
  'Suppression refusée : la ligne est encore référencée.':
    'Exclusão recusada: a linha ainda está referenciada.',
  'Valeur refusée par la validation.': 'Valor recusado pela validação.',
  'Une erreur a toujours cette forme, et `request_id` est ce qu’il faut citer au support :':
    'Um erro sempre tem este formato, e `request_id` é o que deve ser citado ao suporte:',
  'La liste complète des codes est servie par {route}.':
    'A lista completa dos códigos é servida por {route}.',
  'Côté MCP': 'Lado MCP',
  'Un refus arrive comme un résultat d’outil marqué `isError`, dont le texte est un objet JSON stable : le même `code` que l’API, une phrase fixe, et un `hint` qui dit comment corriger l’appel. `retryable` dit s’il vaut la peine de réessayer tel quel.':
    'Uma recusa chega como um resultado de ferramenta marcado com `isError`, cujo texto é um objeto JSON estável: o mesmo `code` da API, uma frase fixa, e um `hint` que diz como corrigir a chamada. `retryable` diz se vale a pena tentar novamente do jeito que está.',
  'Écrire en SQL direct': 'Escrever em SQL direto',
  'Ouvrez `psql` : ça marche, c’est le but du produit.':
    'Abra o `psql`: funciona, esse é o objetivo do produto.',
  'Ce qui vous attend :': 'O que espera por você:',
  'Les contraintes s’appliquent — obligatoire, longueur, clé étrangère. Une ligne référencée ne se supprime pas.':
    'As restrições se aplicam — obrigatoriedade, comprimento, chave estrangeira. Uma linha referenciada não pode ser excluída.',
  'Les colonnes système ne se remplissent pas toutes seules dans un `INSERT` manuel : `_id`, `_created_at` et `_updated_at` ont des valeurs par défaut, `_created_by` et `_updated_by` attendent un identifiant d’utilisateur.':
    'As colunas do sistema não se preenchem sozinhas em um `INSERT` manual: `_id`, `_created_at` e `_updated_at` têm valores padrão, `_created_by` e `_updated_by` esperam um identificador de usuário.',
  '**Les permissions de basedb ne s’appliquent pas en SQL direct.** Elles gouvernent les surfaces du produit — API, interface, MCP. Une connexion PostgreSQL voit tout ce que son rôle voit. C’est dit ici parce que promettre le contraire serait pire que de ne rien promettre.':
    '**As permissões do basedb não se aplicam em SQL direto.** Elas regem as superfícies do produto — API, interface, MCP. Uma conexão PostgreSQL vê tudo o que a role dela vê. Isso é dito aqui porque prometer o contrário seria pior do que não prometer nada.',
  '{base} — documentation API et MCP': '{base} — documentação de API e MCP',
}
