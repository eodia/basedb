---
title: Primeiros passos
description: Criar uma base, uma tabela, campos, uma visão e um formulário.
---

Este percurso leva dez minutos e cobre o essencial: no final, você terá uma tabela, uma visão
kanban e um formulário público que escreve nela.

:::tip[Para ver tudo de uma vez]
Um projeto vazio oferece a **base de demonstração**: uma pequena agência, seus clientes, projetos,
tarefas, faturas e avaliações, com fórmulas, visões de todos os tipos, um painel e
automações. **Nova base** também abre a [galeria de modelos](/basedb/pt-br/fonctionnalites/modeles/),
onde você pode descrever sua base para a IA.
:::

## 1. Criar uma base

Tudo se organiza por **projeto**: o seletor no topo da barra lateral troca de projeto ou
cria um. Na barra, o **+** à direita do filtro cria uma base. Dê a ela um rótulo
— “Ventes” — e, se quiser, uma descrição, uma cor, um ícone.

A base se torna um **schema PostgreSQL**: seu nome físico (`b_t4z56fq_ventes`) aparece no
formulário e na documentação gerada.

## 2. Criar uma tabela e seus campos

No menu **⋯** da base: **Nova tabela**. Depois, adicione os campos dela em
**Estrutura** — nesse mesmo menu — com o botão
**Campo**:

| Campo | Tipo |
|---|---|
| Nom | Texto curto |
| Statut | Seleção única — Nouveau, Qualifié, Gagné, Perdu |
| Montant | Moeda |
| Échéance | Data |
| Client | Relação → Clients |
| Notes | Texto longo (Markdown) |

Mais tarde, uma fórmula (`DAYS([Échéance], TODAY())`), uma pesquisa (a cidade do cliente)
ou uma agregação (o valor total por cliente) são adicionadas da mesma forma — veja
[Tabelas e campos](/basedb/pt-br/fonctionnalites/tables-et-champs/).

Você também pode **importar um arquivo** CSV ou JSON: a importação adivinha os tipos, deixa você
corrigi-los, cria a tabela ou completa uma tabela existente e informa, linha por linha, o que
recusa.

![Menu de uma base](../../../../assets/screens/menu-base.png)

## 3. Inserir e filtrar

A grade se edita como uma planilha: clique duplo ou Enter para editar uma célula, Esc para
cancelar. **Filtrar** combina condições por campo; a ordenação é feita pelo cabeçalho da
coluna; **Buscar…**, à direita da barra, procura em todas as colunas. Cada
alteração é salva na hora — e [registrada no histórico](/basedb/pt-br/fonctionnalites/historique/):
**Ctrl+Z** desfaz a última.

## 4. Adicionar uma visão

O seletor de visões, à esquerda de “Filtrar”, oferece “Todas as linhas” e depois as suas visões.
Crie um **kanban** agrupado por “Statut”: arrastar um cartão de uma coluna para outra altera a
linha.

![Um kanban por status](../../../../assets/screens/kanban.png)

## 5. Compartilhar um formulário

Crie uma visão **Formulário**, marque as perguntas e depois clique em **Compartilhar**: escolha “Público” e
copie o link. Cada resposta adiciona uma linha à tabela, sem dar nenhuma permissão a quem
responde. Detalhes em [Formulários compartilhados](/basedb/pt-br/fonctionnalites/formulaires-partages/).

## 6. Ler em SQL

Menu **⋯** da base → **Consulta SQL**: suas tabelas estão lá, com o nome verdadeiro.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Salvar** a guarda abaixo das tabelas, na seção “Consultas” — para você ou para toda a
base — e **⋯** → **Criar visão SQL…** a transforma em uma visão PostgreSQL de verdade, organizada entre as
tabelas. Cada pessoa as lê com suas próprias permissões. Veja
[Consultas e visões SQL](/basedb/pt-br/fonctionnalites/requetes-et-vues-sql/).

É a mesma coisa pelo `psql` ou pela sua ferramenta de BI. Veja [SQL direto](/basedb/pt-br/integrations/sql/).
