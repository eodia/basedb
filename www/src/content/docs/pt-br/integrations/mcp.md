---
title: Servidor MCP
description: Conectar um agente de IA ao basedb pelo Model Context Protocol.
---

O basedb expõe um **servidor MCP** (`POST /mcp`, no mesmo endereço da interface): um agente — Claude, um
assistente de código, o seu próprio agente — descobre ali as bases, lê e escreve linhas, exclui
se você permitir, e **propõe** evoluções de estrutura.

## Conectar um agente

Crie um token em **Tokens de API e MCP…** (menu da base, em **API e agentes**), com o acesso MCP marcado. O mesmo token
serve para a API REST e para o MCP.

Para um cliente que fala HTTP, o endereço é `http://localhost:3000/mcp` com
`Authorization: Bearer <jeton>`. Para um cliente que inicia processos (stdio), o repositório fornece
um relay que lê o token de uma variável de ambiente — nunca da configuração:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## As catorze ferramentas

| Ferramenta | Função |
|---|---|
| `whoami` | quem é o agente, com quais permissões |
| `list_bases`, `describe_base`, `describe_table` | descobrir a estrutura e suas descrições |
| `list_records`, `get_record`, `lookup_records` | ler, filtrar, resolver um valor de exibição |
| `create_record`, `update_record` | escrever linhas |
| `delete_record`, `restore_record` | excluir uma linha — com um token criado para isso — e restaurá-la |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propor uma evolução de estrutura |

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
- **Ele não muda a estrutura**: ele a propõe. A proposta aguarda em **Propostas
  dos agentes…** (menu da base), onde uma pessoa que gerencia a estrutura a aprova ou a recusa;
  sem decisão, ela expira após 24 horas.
- **Ele nunca tem mais permissões** do que a pessoa que criou o token dele: as permissões do token são
  intersectadas com as dela.
- Ele não vê os campos marcados como invisíveis para os agentes, nem as bases fechadas ao MCP.

Cada chamada é registrada em log pela forma de seus parâmetros, nunca pelos valores.
