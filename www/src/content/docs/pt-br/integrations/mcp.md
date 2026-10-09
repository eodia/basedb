---
title: Servidor MCP
description: Conectar um agente de IA ao basedb pelo Model Context Protocol.
---

O basedb expõe um **servidor MCP** (`POST /mcp`, no mesmo endereço da interface): um agente — Claude, um
assistente de código, o seu próprio agente — descobre ali as bases, lê e escreve linhas, exclui
se você permitir, e **propõe** evoluções de estrutura.

## Conectar um agente

Crie um token em **Tokens de API e MCP…** (menu da base, em **API e agentes**), com o acesso MCP marcado. O mesmo token
serve para a API REST e para o MCP, e abre **toda a base**: a produção dela e os outros ambientes
(veja mais adiante).

Coloque o token em uma variável de ambiente, `BASEDB_TOKEN`, nunca em um arquivo de configuração.
Um cliente que fala MCP por HTTP — Claude Code, entre outros — acessa diretamente `…/mcp` com o
cabeçalho `Authorization: Bearer <jeton>`. Com o Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

O comando escreve o arquivo `.mcp.json` do projeto, em que `${BASEDB_TOKEN}` continua sendo uma
referência à variável: o token em si não aparece ali.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Um cliente que só sabe iniciar programas locais (stdio) passa pelo relay do repositório, que lê
o token na variável indicada por `--token-env`:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Peça então ao agente para chamar `whoami`: ele diz quem criou o token, qual base ele abre, os
ambientes dela e as permissões dele.

## Escolher o ambiente

Uma base pode ter vários [ambientes](/basedb/pt-br/fonctionnalites/environnements/) — produção,
homologação, desenvolvimento —, cada um com suas tabelas e suas linhas. Um token de toda a base abre
todos eles, e o ambiente é escolhido, do mais amplo ao mais específico:

- **o nome da base**, sem mais nada: `crm` é a produção, `crm_recette` a homologação;
- **o endereço do servidor**: `…/mcp?environment=recette` aponta para a homologação em toda a
  conexão. O relay faz o mesmo com `--environment recette`. Declara-se assim um servidor por
  ambiente, todos com o mesmo token:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **o argumento `environment`** de cada ferramenta que nomeia uma base, para uma única chamada:
  `list_records` com `{"base": "crm", "table": "clients", "environment": "recette"}`.

Um ambiente é nomeado pelo selo dele, sem diferenciar maiúsculas de minúsculas nem acentos
(`Recette`, `recette`, `developpement` para “Développement”), ou por `production`. `whoami` lista os
que o token abre; `list_bases` e `describe_base` dizem a qual ambiente pertence cada base.

Um token também pode ser limitado a um único ambiente, na criação: ele não vê nenhum outro.

## As quinze ferramentas

| Ferramenta | Função |
|---|---|
| `whoami` | quem é o agente, com quais permissões, em quais ambientes |
| `list_bases`, `describe_base`, `describe_table` | descobrir a estrutura, suas descrições e sua aparência |
| `list_records`, `get_record`, `lookup_records` | ler, filtrar, resolver um valor de exibição |
| `create_record`, `update_record` | escrever linhas |
| `delete_record`, `restore_record` | excluir uma linha — com um token criado para isso — e restaurá-la |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propor uma evolução de estrutura |
| `propose_update_look` | propor a cor e o ícone de uma tabela e de suas opções |

## Cores e ícones

Uma tabela, e cada opção de uma lista de seleção, têm uma cor e um ícone, como na interface. O
agente os escolhe ao propor:

- `propose_create_table` aceita `color` e `icon` para a tabela;
- `propose_add_field` aceita `color` e `icon` em cada opção de um `select` ou de um `multi_select`;
- `propose_update_look` altera os de uma tabela existente e de suas opções: uma chave omitida mantém
  o que já está definido, `null` a apaga.

`color` é uma cor `#rrggbb`. `icon` é o nome de um ícone [Lucide](https://lucide.dev/icons/) entre
os que a interface desenha — `truck`, `circle-check`, `flame`…: o esquema da ferramenta os enumera,
e um nome desconhecido é recusado. `describe_base` e `describe_table` retornam a aparência atual.
Um campo, por sua vez, não tem ícone para escolher: a interface desenha o do seu tipo.

## Excluir linhas

Um token criado com as permissões **Leitura, escrita e exclusão** permite ao agente excluir
linhas, **uma por vez**, pelo `_id` delas. `delete_record` retorna a linha como ela estava,
e a exclusão fica registrada no histórico em nome do token; `restore_record` restaura a linha
pelo `_id` dela — o próprio agente desfaz o erro, e uma pessoa também pode fazer isso pelo
histórico.

O agente não exclui:

- com um token de leitura, ou de leitura e escrita: a recusa diz qual token criar;
- uma linha que uma relação em cascata levaria junto com outras (`TOKEN_CASCADE_FORBIDDEN`):
  essa exclusão é feita na interface, por uma pessoa que vê o que ela leva junto;
- várias linhas de uma vez: nenhuma ferramenta faz isso.

## O que um agente não faz

- **Ele só exclui com o seu consentimento**: um token criado para isso, uma linha por vez.
- **Ele não muda a estrutura** — nem a aparência dela: ele a propõe. A proposta aguarda em
  **Propostas dos agentes…** (menu da base), onde uma pessoa que gerencia a estrutura a aprova ou a
  recusa; sem decisão, ela expira após 24 horas.
- **Ele nunca tem mais permissões** do que a pessoa que criou o token dele: as permissões do token são
  intersectadas com as dela, ambiente por ambiente.
- Ele não vê os campos marcados como invisíveis para os agentes, nem as bases fechadas ao MCP.

Cada chamada é registrada em log pela forma de seus parâmetros, nunca pelos valores.
