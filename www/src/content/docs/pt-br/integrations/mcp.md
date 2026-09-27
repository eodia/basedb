---
title: Servidor MCP
description: Conectar um agente de IA ao basedb pelo Model Context Protocol.
---

O basedb expõe um **servidor MCP** (`POST /mcp`, no mesmo endereço da interface): um agente — Claude, um
assistente de código, o seu próprio agente — descobre ali as bases, lê e escreve linhas e
**propõe** evoluções de estrutura.

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

## As doze ferramentas

| Ferramenta | Função |
|---|---|
| `whoami` | quem é o agente, com quais permissões |
| `list_bases`, `describe_base`, `describe_table` | descobrir a estrutura e suas descrições |
| `list_records`, `get_record`, `lookup_records` | ler, filtrar, resolver um valor de exibição |
| `create_record`, `update_record` | escrever linhas |
| `propose_create_table`, `propose_add_field`, `get_proposal` | propor uma evolução de estrutura |

## O que um agente não faz

- **Ele não exclui nada.**
- **Ele não muda a estrutura**: ele a propõe. A proposta aguarda em **Propostas
  dos agentes…** (menu da base), onde uma pessoa que gerencia a estrutura a aprova ou a recusa;
  sem decisão, ela expira após 24 horas.
- **Ele nunca tem mais permissões** do que a pessoa que criou o token dele: as permissões do token são
  intersectadas com as dela.
- Ele não vê os campos marcados como invisíveis para os agentes, nem as bases fechadas ao MCP.

Cada chamada é registrada em log pela forma de seus parâmetros, nunca pelos valores.
