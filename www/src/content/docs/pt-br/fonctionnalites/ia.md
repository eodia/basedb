---
title: Inteligência artificial
description: A opção de IA de um campo, os rascunhos, o Copilot e o dos painéis — e o que vai para o provedor.
---

A IA é **opcional**. Sem provedor configurado, nada vai a lugar nenhum. O basedb sabe
conversar com a **OpenAI**, a **Anthropic** e a **Mistral**, com a sua própria chave.

## Configurar um provedor

Enquanto nenhuma configuração for salva na interface, a API lê o seu ambiente:

```bash
BASEDB_AI_PROVIDER=mistral      # openai, anthropic ou mistral
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # ou BASEDB_AI_API_KEY
```

A chave é lida em `BASEDB_AI_API_KEY` ou, na falta dela, no nome usual do provedor
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`).

## A opção de IA de um campo

A IA não é um tipo de campo, mas uma **opção**: o interruptor **IA** do formulário de um
campo — texto, texto longo, URL, número, seleção única, booleano, data — faz com que ele seja preenchido por
um modelo, a partir de uma instrução que cita outras colunas:

```text
Resuma {{Notes}} em uma frase.
Categoria de {{Description}} entre as opções da lista.
```

- O campo é calculado assim que a linha existe e depois sempre que uma coluna citada muda —
  e, se você quiser, segundo uma programação (no máximo a cada 15 minutos).
- A coluna **mantém seu tipo**: uma resposta em que nada pode ser lido nesse tipo (um número
  não encontrado, uma opção que não existe) é recusada em vez de escrita.
- Desativar a opção torna o campo novamente editável à mão, com os valores mantidos.
- Os valores citados vão para o provedor: **a ativação exige um consentimento
  explícito**.

`BASEDB_AI_FIELD_QUOTA` limita esses cálculos por hora e por tenant (300 por padrão).

## Em uma automação

Uma [automação](/basedb/pt-br/fonctionnalites/automatisations/#perguntar-à-ia) pode **perguntar
à IA** em uma de suas etapas: uma instrução que cita a linha e as etapas anteriores,
uma resposta lida no tipo escolhido, que as etapas seguintes escrevem, enviam ou citam. Mesmas
regras de um campo: consentimento ao salvar, só vai o que a instrução cita,
cada chamada registrada em log e contada em `BASEDB_AI_FIELD_QUOTA`.

## Rascunhos e Copilot

- **Rascunhos**: descrever uma tabela ou uma fórmula em uma frase e receber uma proposta para
  revisar. Só vão rótulos, tipos e a frase digitada — nenhum valor de célula.
- **Modelos**: descrever uma base inteira — “o acompanhamento das reclamações dos meus clientes” — e
  receber tabelas, linhas de exemplo, visões, painel e automações, para refinar e depois
  criar. Só a frase é enviada. Veja [Modelos de base](/basedb/pt-br/fonctionnalites/modeles/#pedir-à-ia).
- **Copilot**: uma conversa sobre a base exibida. Você pede um filtro, uma consulta,
  colunas, uma tabela, um conjunto de dados de teste; cada proposta chega como um cartão e se aplica
  com um clique, pelas mesmas rotas que os formulários.

Por padrão, só a estrutura vai para o provedor. A caixa **“Permitir a leitura dos
dados”** permite que o Copilot, durante a conversa, leia linhas (no máximo 50 por leitura)
e responda a partir delas — cada leitura é listada abaixo da resposta.

## O Copilot dos painéis

Na seção [Painéis](/basedb/pt-br/fonctionnalites/tableaux-de-bord/#o-copilot), o
Copilot propõe perguntas, alterações no painel e valores para os filtros dele, para
aplicar com um clique. Mesmas regras: sem consentimento, só a estrutura é enviada — tabelas e
campos, painéis e perguntas da base, definição dos cartões do painel exibido (suas
perguntas, seus textos) —, nunca os resultados nem os valores escolhidos nos filtros. A caixa
**“Permitir a leitura dos dados”** adiciona esses valores e os resultados dos cartões sob os
filtros exibidos, no máximo 50 linhas por leitura, cada uma listada abaixo da resposta.

## O Copilot das automações

Na seção [Automações](/basedb/pt-br/fonctionnalites/automatisations/#o-copilot), o Copilot
propõe uma automação inteira — a que está na tela, alterada, ou uma nova — que ele aplica ao
fluxo do editor, **sem nunca salvá-la**: você a revisa e depois a salva. Mesmas regras:
sem consentimento, só a estrutura é enviada — tabelas e campos, automações da base, a que está
na tela, suas últimas execuções sem nenhum valor, pessoas e canais do Slack sob marcadores —,
e a caixa **“Permitir a leitura dos dados”** adiciona linhas lidas, no máximo 50 por leitura.

`BASEDB_AI_QUOTA` limita as chamadas interativas por hora e por tenant (120 por padrão).
