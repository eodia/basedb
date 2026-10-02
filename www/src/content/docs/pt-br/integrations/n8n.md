---
title: n8n
description: Ler e escrever as linhas do basedb a partir de um workflow n8n, e disparar um a cada linha criada, alterada ou excluída.
---

O pacote **n8n-nodes-basedb** adiciona três nós ao n8n:

| Nó | Papel |
|---|---|
| **basedb** | ler e escrever as linhas de uma tabela, comentar uma linha; utilizável como ferramenta por um agente de IA do n8n |
| **basedb Trigger** | disparar um workflow para cada linha criada — ou criada ou alterada — desde a última verificação |
| **basedb Webhook Trigger** | disparar um workflow no instante em que uma linha é criada, alterada ou excluída |

## Instalar

No n8n: **Settings › Community Nodes › Install**, depois `n8n-nodes-basedb`.

Sem a interface — modo de fila, imagem Docker já montada —: `npm install
n8n-nodes-basedb` na pasta `~/.n8n/nodes`, depois reinicie o n8n.

## As credenciais

Crie no n8n uma credencial **basedb API**:

| Campo | Valor |
|---|---|
| **Instance URL** | o endereço em que você abre o basedb: `https://basedb.exemple.fr` |
| **Workspace** | a referência do espaço, a mesma dos endereços da API (`/api/v1/<espaco>/…`): `t4z56fq`, exceto se a instância fixar `BASEDB_TENANT` |
| **Token** | um **token de integração**: menu **⋯** da base → **API e agentes** → **Tokens de API e MCP…** |

Um token abre **uma** base. Ele lê suas linhas, as escreve se tiver sido criado com escrita, e
nunca tem mais permissões do que a pessoa que o criou. Ao salvar, o n8n testa a conexão e informa
se o token é recusado.

## Ler e escrever: o nó basedb

| Operação | O que ela faz |
|---|---|
| **Row › Create** | adiciona uma linha |
| **Row › Create or Update** | altera a linha cujos campos escolhidos têm esses valores, ou a adiciona se nenhuma os tiver |
| **Row › Get** | lê uma linha pelo seu `_id` |
| **Row › Get Many** | lê as linhas de um filtro, na ordem pedida, até um limite ou todas, página após página |
| **Row › Update** | altera uma linha, encontrada pelo seu `_id` ou por outros campos |
| **Comment › Create** | comenta uma linha; uma @menção notifica a pessoa |

A **base** e a **tabela** são escolhidas em listas, as que o token abre. Os campos a escrever
aparecem com seu nome no basedb, uma lista de escolha com suas opções, um campo Pessoa com os
membros do espaço; um campo calculado — fórmula, pesquisa, agregação, número automático — não
aparece nela, já que o basedb o escreve por conta própria. Um valor que o campo recusa
interrompe o nó com o código do basedb e o que ele quer dizer.

- O **filtro** e a **ordenação** usam os nomes técnicos dos campos, os do SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. A gramática é a da
  [API REST](/basedb/pt-br/integrations/api-rest/#ler).
- Os **números** chegam em texto decimal (`"1250.50"`), para não perder nenhum dígito; a opção
  **Numbers as Numbers** os converte em números.
- Uma **relação** se lê `{ "id": …, "display": … }` e se escreve pelo `_id` da linha vinculada.
- **Create or Update** nunca altera várias linhas: se várias tiverem os valores, o nó para em
  vez de arriscar um palpite.
- Sem operação **Delete**: para remover linhas, marque-as (um status “Arquivado”), confie a
  exclusão a uma [automação](/basedb/pt-br/fonctionnalites/automatisations/), ou chame a
  [API REST](/basedb/pt-br/integrations/api-rest/) com um token criado para excluir.

## Disparar um workflow

### A cada verificação: basedb Trigger

O nó pergunta ao basedb, no ritmo escolhido (a cada minuto, a cada hora…), as linhas
**criadas** — ou **criadas ou alteradas** — desde a última vez, um filtro adicional se
necessário. Funciona em qualquer lugar, mesmo quando o basedb não consegue alcançar o n8n. Na
primeira verificação, ele anota em que ponto a tabela está e não emite nada; um teste desde o
editor retorna a última linha, para ter algo com que ligar os nós seguintes.

### No instante: basedb Webhook Trigger

Cada linha criada, alterada ou excluída — mesmo por SQL escrito diretamente no PostgreSQL —
dispara o workflow imediatamente:

1. Adicione o nó e copie sua **Production URL**.
2. No basedb, menu **⋯** da base → **API e agentes** → **Webhooks…**: crie um webhook para esse
   endereço, escolha suas tabelas e seus eventos.
3. O basedb exibe uma vez o **segredo de assinatura**: coloque-o em uma credencial
   **basedb Webhook** do n8n.
4. Ative o workflow.

Cada evento se torna um item: seu `type` (`record.created`, `record.updated`,
`record.deleted`), a tabela, a linha **antes** e **depois**, e os campos alterados (`changed`).
O nó verifica a **assinatura** de cada entrega e responde `401` à que não tem uma, à que tem uma
falsa, ou à que data de mais de cinco minutos. O basedb entrega **ao menos uma vez**: elimine
duplicatas pelo `id` do evento se o workflow não deve processá-lo duas vezes.

:::note
O basedb só envia um webhook a um endereço **HTTPS público**: um n8n em uma rede privada usa
antes o **basedb Trigger**. Veja [Webhooks](/basedb/pt-br/integrations/webhooks/).
:::

## Sem o nó

O nó **HTTP Request** do n8n também fala com o basedb: cabeçalho `Authorization: Bearer <token>`,
JSON na ida e na volta, paginação por `meta.next_cursor` passado em `after`
(`{{ $response.body.meta.next_cursor }}`), e retomada após uma falha por um filtro sobre
`_updated_at` e por `…/<table>/deleted?since=`.
