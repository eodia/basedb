---
title: Introdução
description: O que é o basedb e o que o diferencia das planilhas colaborativas.
---

O **basedb** é um banco de dados colaborativo, no espírito das planilhas colaborativas,
que você mesmo hospeda — com uma diferença que define todo o resto: **seus dados
vivem em tabelas PostgreSQL de verdade**, tipadas e com nomes legíveis.

![A grade de uma tabela no basedb](../../../../assets/screens/grille.png)

## Uma promessa simples

Nada de modelo genérico, nada de `JSONB` para tudo, nada de `field_1837`:

| No basedb | No PostgreSQL |
|---|---|
| Uma base “Ventes” | um schema `b_t4z56fq_ventes` |
| Uma tabela “Opportunités” | uma tabela `opportunites` |
| Um campo “Échéance” (Data) | uma coluna `echeance date` |
| Uma seleção única “Statut” | uma coluna `text` e sua restrição `CHECK` |
| Uma relação “Client” | uma coluna `clients_id uuid` e sua `FOREIGN KEY` |

Assim, você pode abrir o `psql`, uma ferramenta de BI ou um script Python e ler seus dados sem
passar pelo produto — e até escrever neles: as restrições continuam valendo, e o histórico registra
a escrita.

## Para quem?

- **As equipes de negócio** que querem uma grade, visões e formulários, sem esperar
  por um desenvolvimento.
- **As equipes técnicas** que se recusam a ver seus dados presos em um formato
  proprietário e querem conectar suas ferramentas de sempre.
- **Os agentes de IA**, que encontram um servidor MCP, permissões claras e propostas
  submetidas a uma pessoa.

## O que você vai encontrar

- [Tabelas e campos](/basedb/pt-br/fonctionnalites/tables-et-champs/) tipados, relações
  que são chaves estrangeiras de verdade — ou múltiplas —, fórmulas calculadas pelo PostgreSQL,
  pesquisas e agregações através das relações.
- Oito [visões](/basedb/pt-br/fonctionnalites/vues/): grade, kanban, calendário, linha do tempo,
  galeria, lista, formulário, questionário — colaborativas ou pessoais.
- [Formulários](/basedb/pt-br/fonctionnalites/formulaires-partages/) e
  [visões](/basedb/pt-br/fonctionnalites/vues-partagees/) compartilhados por um link, e calendários
  que podem ser assinados em uma agenda.
- A [colaboração](/basedb/pt-br/fonctionnalites/collaboration/): comentários e menções,
  notificações, atualizações em tempo real.
- [Automações](/basedb/pt-br/fonctionnalites/automatisations/) e
  [painéis](/basedb/pt-br/fonctionnalites/tableaux-de-bord/) com suas perguntas, construídos com o mouse ou em SQL.
- [SQL para todos](/basedb/pt-br/fonctionnalites/requetes-et-vues-sql/), com suas próprias permissões:
  consultas salvas abaixo das tabelas e visões PostgreSQL de verdade organizadas entre elas.
- [Modelos de base](/basedb/pt-br/fonctionnalites/modeles/), para escolher em uma galeria ou
  pedir à IA.
- [Ambientes](/basedb/pt-br/fonctionnalites/environnements/) — produção, homologação — que
  podem ser comparados e migrados.
- Um [histórico](/basedb/pt-br/fonctionnalites/historique/) de cada escrita, incluindo SQL direto,
  e Ctrl+Z para desfazer.
- [Permissões](/basedb/pt-br/fonctionnalites/droits/) por grupo, até o nível do campo.
- Uma [API REST](/basedb/pt-br/integrations/api-rest/), um [servidor MCP](/basedb/pt-br/integrations/mcp/),
  [webhooks](/basedb/pt-br/integrations/webhooks/), Slack e
  [tabelas sincronizadas](/basedb/pt-br/integrations/synchronisation/).
- A [IA](/basedb/pt-br/fonctionnalites/ia/) como opção: campos calculados por um modelo, Copilot.

## Estado do projeto

O basedb é um software livre (AGPL-3.0) desenvolvido pela [Eodia](https://eodia.com/fr/), estúdio de
software nativo em IA, e está em desenvolvimento ativo. O núcleo, a API, o servidor MCP
e a interface funcionam e são cobertos por mais de mil testes; o
[roteiro](/basedb/pt-br/feuille-de-route/) diz o que ainda está por vir. Seu
[documento de arquitetura](https://github.com/eodia/basedb/tree/main/docs/architecture), com
cerca de vinte capítulos, registra cada decisão.

:::tip[Experimentar]
Basta um comando depois de clonar o repositório: `docker compose up -d`. Veja
[a instalação](/basedb/pt-br/guides/installation/).
:::
