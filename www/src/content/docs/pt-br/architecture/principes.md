---
title: Princípios
description: As decisões que definem a arquitetura do basedb.
---

O basedb foi concebido a partir de um **documento de arquitetura** — dezesseis capítulos, no repositório,
em [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Seu
capítulo 00 fixa vinte e cinco decisões; eis o espírito delas.

## Os dados são tabelas, não um formato

Uma base de usuário é um **schema** PostgreSQL, uma tabela é uma tabela, um campo é uma
coluna tipada **com nome legível**. Nada de EAV (entidade-atributo-valor), nada de documento JSON
para tudo, nada de nome opaco. O catálogo `_basedb` descreve esses objetos; ele não os substitui.

Consequência desejada: o SQL direto é um uso **legítimo**. As restrições são definidas no
banco, o histórico é capturado por trigger — nada pressupõe que a escrita passe pelo
aplicativo.

## Um único ponto de decisão das permissões

A interface, a API REST, o servidor MCP, os formulários compartilhados, os webhooks: tudo passa pelo
**mesmo ponto de aplicação** das permissões, no núcleo. A interface é um
consumidor da API como qualquer outro — sem rota privada, sem token de serviço. Um
recurso que não se pode ver responde exatamente como um recurso que não existe.

## O núcleo decide, os adaptadores traduzem

Um monorepo TypeScript: `@basedb/core` contém toda a lógica (catálogo, motor DDL,
permissões, registros, histórico); `apps/api` (Hono), `apps/mcp` e `apps/web`
(Next.js) são adaptadores que não chamam uns aos outros. A interface nunca depende do
núcleo: ela fala HTTP, e ponto.

## Nada se perde sem decisão

Excluir rebaixa, sem destruir: uma tabela excluída mantém suas linhas, legíveis em SQL sob
um nome rebaixado, e pode ser restaurada. Renomear um nome físico mantém o antigo servido por um alias. A
purga é uma decisão da administração, precedida de uma exportação verificada.

## PostgreSQL, e nada mais

PostgreSQL 16 ou superior, e nenhuma dependência externa obrigatória: nem fila de mensagens, nem cache,
nem mecanismo de busca. A fila dos webhooks, o escoamento do histórico, os limites de taxa,
tudo cabe no banco ou no processo.

## Para ir além

| Capítulo | Assunto |
|---|---|
| 00 | Decisões estruturantes e registro dos códigos de erro |
| 01 | Nomenclatura e slugificação |
| 02 | O catálogo `_basedb`, fonte da verdade |
| 03 | Motor DDL e migrações |
| 04 | Tipos de campo e projeção no PostgreSQL |
| 05 | Permissões |
| 06 | Ciclo de vida: renomeação, exclusão, purga |
| 07 | Histórico |
| 08 | API REST e webhooks |
| 09 | Servidor MCP |
| 10 | Arquitetura de software |
| 11 | Interface |
| 12 | Integração de IA |
| 13 | Autenticação |
| 14 | Ambientes |
| 15 | Formulários compartilhados |
