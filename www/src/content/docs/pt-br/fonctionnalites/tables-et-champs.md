---
title: Tabelas e campos
description: Os tipos de campo do basedb, sua projeção no PostgreSQL, as fórmulas e os campos calculados.
---

Cada tabela do basedb é uma tabela PostgreSQL; cada campo, uma coluna tipada. O rótulo
que você digita (“Échéance”) se torna um nome físico legível (`echeance`) por uma
**slugificação** estável: sem acento, em minúsculas, sem palavra reservada.

## Os tipos

| Tipo | Coluna PostgreSQL | Observações |
|---|---|---|
| Texto curto | `text` | uma linha |
| Texto longo | `text` | Markdown: um trecho na grade, a renderização ao passar o mouse, um editor dedicado; pode [citar uma coluna](#texto-formatado-e-variáveis) |
| Texto formatado | `text` + `CHECK` | HTML sanitizado na escrita, escrito em um editor visual — [veja abaixo](#texto-formatado-e-variáveis) |
| Número | `numeric` | nunca ponto flutuante: um valor não se desvia |
| Moeda, Porcentagem, Duração, Avaliação | `numeric` | um número e seu [formato de exibição](#formatos-de-exibição): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Caixa de seleção | `boolean` | |
| Data | `date` | |
| Data e hora | `timestamptz` | um instante absoluto, exibido no fuso horário de quem lê |
| Seleção única | `text` + `CHECK` | cor, ícone ou imagem por opção |
| Seleção múltipla | `text[]` + `CHECK` | filtrável com os operadores de array |
| E-mail | `text` + `CHECK` | um endereço verificado pelo banco, aberto com um clique |
| Telefone, Código de barras | `text` | um texto curto e seu formato: link de chamada, fonte monoespaçada |
| URL | `text` + `CHECK` | completado na digitação (`exemple.fr` → `https://exemple.fr`) |
| Pessoa | `uuid` | um membro do espaço de trabalho; designá-lo o [notifica](/basedb/pt-br/fonctionnalites/collaboration/) |
| Numeração automática | `bigint` de identidade | numera também as linhas já existentes; ninguém o digita |
| Relação | `uuid` + `FOREIGN KEY` | uma chave estrangeira de verdade para a tabela de destino |
| Relação múltipla | `uuid[]` | várias linhas vinculadas, cuja integridade é mantida por um trigger |
| Fórmula | coluna gerada `STORED` | calculada pelo PostgreSQL — ou na leitura, veja [Fórmulas](#fórmulas) |
| Pesquisa, Agregação, Contagem | nenhuma | calculados na leitura, através de uma relação |
| Botão | nenhuma | abre um endereço ou dispara uma [automação](/basedb/pt-br/fonctionnalites/automatisations/) |
| Arquivo, Imagem | `jsonb` (metadados) | os bytes vão para o [armazenamento de arquivos](/basedb/pt-br/fonctionnalites/fichiers/) |

Cada tabela também tem suas **colunas de sistema**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` — mantidas por um trigger, nunca graváveis
pela API. A grade as agrupa em **Informações do sistema**, no menu de colunas:
elas estão em todas as tabelas, e são úteis em poucas.

![A grade de uma tabela, com uma duração calculada, uma pesquisa e uma contagem](../../../../assets/screens/grille.png)

## Restrições garantidas pelo banco

O que a interface promete, o PostgreSQL garante. Uma seleção única é uma restrição
`CHECK`; uma relação, uma `FOREIGN KEY`; uma URL ou um endereço de e-mail, uma expressão
regular. Uma escrita em SQL direto que as viole é recusada, assim como na interface:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Formatos de exibição

Moeda, Porcentagem, Duração, Avaliação, Telefone e Código de barras são escolhidos como tipos,
mas são **formatos**: a coluna continua sendo um número ou um texto, só a leitura muda.

| Formato | Sobre | Como se lê e se digita |
|---|---|---|
| Moeda | um número | `12 500,00 €` — euro, dólar, libra, franco suíço, dólar canadense, iene |
| Porcentagem | um número | `15 %` |
| Duração | um número de segundos | `1:30`, e se digita `1h30`, `90 min` |
| Avaliação | um número | de 1 a 10 estrelas, definida com um clique |
| Telefone | um texto curto | um link de chamada |
| Código de barras | um texto curto | em fonte monoespaçada |

Um formato pode ser alterado depois (**Exibição**, na edição do campo) sem mexer nos
valores salvos. Ele não limita o valor: uma avaliação de 7 em uma escala de 5 continua sendo 7.

## Fórmulas

Uma fórmula é escrita com funções em inglês (os nomes em francês também funcionam), os campos entre colchetes e os argumentos separados por `,`:

```text
ROUND([Montant HT] * (1 + [Taux de TVA]), 2)
IF([Payée], FALSE, DAYS(TODAY(), [Échéance]) > 0)
DAYS([Fin], [Début])
```

O editor sugere os campos a inserir e um painel de funções; um erro indica o campo ou
o caractere responsável.

| Família | Funções |
|---|---|
| Lógica | `IF`, `IFBLANK`, `ISBLANK`, `AND`, `OR`, `NOT`, `TRUE`, `FALSE` |
| Números | `ROUND`, `ABS`, `CEILING`, `FLOOR`, `MIN`, `MAX` |
| Texto | `UPPER`, `LOWER`, `TRIM`, `LEFT`, `RIGHT`, `LEN`, `TEXT`, `VALUE` |
| Datas | `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DAYS`, `ADD_DAYS`, `DATE`, `TODAY`, `NOW` |
| Operadores | `+ - * /`, `&` para juntar texto, `= <> < <= > >=` |

Uma fórmula se torna uma **coluna gerada** pelo PostgreSQL: o `psql` e suas ferramentas a leem
como as demais. A que depende do dia (`TODAY()`, `NOW()`) ou que cita uma
pesquisa ou uma agregação é **calculada na leitura**: ela pode ser filtrada e ordenada no basedb, mas
não existe em SQL direto.

Uma fórmula não cita outra fórmula nem uma relação diretamente — uma pesquisa faz isso.
Extrair ou substituir uma parte de um texto virá depois.

## Pesquisas, agregações e contagens

Três campos leem **através de uma relação**, em um sentido ou no outro — “o cliente do
projeto”, mas também “as tarefas vinculadas por Projeto”:

- uma **pesquisa** traz um valor da linha vinculada, ou a lista de valores: a cidade do
  cliente de um projeto;
- uma **agregação** calcula sobre as linhas vinculadas: número de valores, soma, média, mínimo,
  máximo — o faturamento de um cliente, a nota média de suas avaliações;
- uma **contagem** conta as linhas vinculadas: o número de tarefas de um projeto.

Eles são calculados a cada leitura, **com as permissões de quem lê**: se a tabela vinculada estiver
fechada para você, o campo também estará. Eles podem ser filtrados e ordenados. Seguem uma única relação, não
podem ser escritos, não têm coluna — portanto não existem em SQL direto — e não aparecem
na importação, nos formulários nem no histórico.

## As relações

Uma **relação** liga uma linha a uma linha de outra tabela da mesma base. A grade
exibe o **valor de exibição** da linha de destino — a coluna que você designa como tal
para a tabela dela — e os filtros atravessam a relação (`clients_id.ville eq "Lyon"`). As linhas
que apontam para uma linha aparecem nos detalhes da linha dela.

Marque **Várias linhas por registro** e a relação se torna **múltipla**: uma tarefa
depende de várias tarefas, um artigo pertence a várias categorias. As linhas vinculadas
aparecem como etiquetas, são escolhidas por uma busca e se abrem com um clique nos
detalhes da linha. Excluir uma linha de destino a retira das listas que a citavam — ou é recusado, se você
escolheu assim. Os filtros `has_any`, `has_all` e `is_null` se aplicam e também atravessam
a relação (`taches_ids.titre contains "logo"`). Uma relação múltipla ainda não pode ser ordenada,
agrupada nem importada.

## Botão

Um campo **Botão** não tem valor: ele age. Ele **abre um endereço** — `https://` ou
`mailto:`, que pode citar a linha (`mailto:{{E-mail}}`) — ou **dispara uma automação**
acionada por um botão na mesma tabela. Ele aparece na célula, no cartão e nos
detalhes da linha.

## Descrições

Uma base, uma tabela e um campo têm uma **descrição**, editável sem migração. Ela é
copiada no `COMMENT ON` que o `psql` lê, na documentação gerada e no que um
agente lê por `describe_table`.

## Texto formatado e variáveis

O **texto formatado** é a variante HTML do texto longo, escolhida na criação do campo
(“Texto formatado (HTML)”): títulos, negrito, itálico, sublinhado, tachado, listas, citações, código,
links e separadores, em um editor visual. O HTML é **sanitizado na escrita**, venha ele
da interface, da API, do servidor MCP ou de uma importação, e uma restrição `CHECK` ainda recusa
as formas perigosas escritas diretamente em SQL (`<script>`, atributos `on…`, `javascript:`).
Nem imagem, nem tabela, nem cor: o que o banco não guardaria não é oferecido.

Um texto longo — simples ou formatado — pode **citar uma coluna da sua linha**. O menu **Coluna** do
editor insere a citação no cursor: uma etiqueta no texto formatado, `{{Ville}}` no
Markdown.

> Entrega prevista em `{{Livraison}}` em `{{Ville}}`.

- A coluna guarda a citação tal como foi escrita — `{{ville}}`, pelo nome físico: é isso
  que o `psql` lê.
- Em todos os outros lugares — a grade, os detalhes da linha, a API, o servidor MCP, as visões compartilhadas, as
  automações — o texto é lido **com o valor da linha**: “Entrega prevista em
  02/10/2026 em Lyon.” Mudar a cidade muda o texto.
- Uma seleção única é lida pelo rótulo, uma pessoa pelo nome, uma data no seu
  formato; um valor inserido em texto formatado nunca é marcação.
- Uma coluna que o leitor não pode ler não mostra nada: nem o valor, nem o nome.

O texto formatado não pode ser preenchido pela IA: um modelo escreve texto, não HTML sanitizado.

## Alterar a estrutura

A tela **Estrutura** da base — no menu **⋯** dela na barra lateral — lista as tabelas e seus campos: adicionar, renomear, tornar obrigatório, reordenar,
descrever, designar o campo de exibição.

![A tela Estrutura de uma base](../../../../assets/screens/structure.png)

Alterar a estrutura exige o nível **Gerenciamento**. Sem ele, a tela pode ser consultada e não oferece
nada: nem botão, nem lápis, nem alça — a obrigatoriedade e o campo de exibição são informados, não
oferecidos. O servidor recusa de qualquer forma cada alteração; a tela não finge mais
aceitá-la.

Adicionar, renomear ou mudar o tipo de um campo passa pelo **motor de migrações**: um plano em
etapas, bloqueios curtos e uma recusa explícita quando um dado não pode ser convertido.

**Renomear** uma base, uma tabela ou um campo é feito em uma única caixa de diálogo. O rótulo muda
sempre, sem migração. Um administrador vê logo abaixo “Renomear também no banco de dados:
`clients` → `comptes`”: marcada, ela muda também o nome físico, e a análise de impacto
aparece — as consultas, as visões SQL e as automações que citam o nome antigo. O nome
antigo continua sendo servido por um **alias de compatibilidade** — uma visão — enquanto você atualiza suas
consultas.

Excluir não apaga nada imediatamente: a tabela ou a base é rebaixada
(`zz_supprime_…`) e continua legível em SQL. Uma base excluída pode ser restaurada; trazer de volta uma tabela
sozinha pela interface está [por vir](/basedb/pt-br/feuille-de-route/). A **purga** definitiva é
reservada à administração, trinta dias depois, e começa por uma exportação CSV verificada.
