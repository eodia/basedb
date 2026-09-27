---
title: Consultas e visões SQL
description: SQL para todos, com as próprias permissões; consultas salvas abaixo das tabelas, pessoais ou compartilhadas; visões PostgreSQL de verdade organizadas entre as tabelas.
---

Suas tabelas são tabelas PostgreSQL de verdade, e a interface as consulta em SQL, com o nome
verdadeiro. Cada membro da base pode escrever uma consulta e **salvá-la** abaixo das tabelas — só para
si, para toda a base ou para alguns grupos —, e quem gerencia a base pode transformá-la em uma
**visão SQL**: uma visão PostgreSQL de verdade, organizada entre as tabelas, que o `psql` e suas ferramentas também
leem.

![Uma consulta salva, aberta na seção “Consultas”; acima, duas visões SQL organizadas entre as tabelas](../../../../assets/screens/requete-sql.png)

## Cada um com suas permissões

O **+** da barra de abas, ou o menu **⋯** da base → **Consulta SQL**, abre uma
aba SQL: um editor com realce de sintaxe e autocompletar, **Ctrl+Enter** para executar, e o
resultado na mesma grade das suas tabelas. O que a consulta pode ler depende de quem a executa:

- com o nível **Gerenciamento** na base, a base inteira, inclusive escritas;
- com os níveis **Leitura** ou **Edição**, a consulta é executada **somente para leitura, com as suas
  próprias permissões**. Uma tabela fechada para você não existe para ela; um campo
  oculto para você desaparece do `SELECT *` e é recusado se você o nomear, mesmo qualificando a tabela;
  uma escrita é recusada. O resultado exibe a etiqueta **Suas permissões**.

![A etiqueta “Suas permissões”: a consulta só vê as tabelas e os campos abertos para a pessoa](../../../../assets/screens/sql-vos-droits.png)

Não é a tela que filtra: o próprio PostgreSQL aplica as suas permissões, coluna por coluna, em
um papel exclusivo seu. Uma consulta, portanto, não pode mostrar nada que a grade, a API ou o
servidor MCP não mostrariam para você.

## Salvar uma consulta

**Salvar**, na barra da aba, guarda a consulta abaixo das tabelas da base, na
seção **Consultas**. Ela reabre com um clique; **⋯** → **Salvar como…** cria uma
cópia, **Nome e compartilhamento…** (na aba ou no menu dela na barra lateral) a renomeia, muda
quem a vê ou a exclui — **Excluir** também está no menu dela, com um clique com o botão direito.
Uma aba que a mostrava mantém seu texto.

![Salvar uma consulta: o nome, o que ela mostra e quem a vê](../../../../assets/screens/requete-enregistrer.png)

| Alcance | Quem a vê | Quem pode criá-la e editá-la |
|---|---|---|
| **Pessoal** — um cadeado | só você | qualquer pessoa que veja a base, para si |
| **Toda a base** | qualquer pessoa que veja a base | o nível **Gerenciamento** na base |
| **Grupos** | os membros dos grupos escolhidos | o nível **Gerenciamento** na base |

**Compartilhar uma consulta compartilha o texto dela, nunca o que o autor pode ler.** Cada pessoa a executa
com as próprias permissões: a mesma consulta, aberta por duas pessoas, mostra a cada uma o que ela
tem permissão para ver — ou informa que uma coluna não existe para ela.

Uma consulta aberta pela barra lateral **é executada na hora, somente para leitura**: você vê
o resultado sem ter decidido nada. **Executar** a roda de novo em seguida, tal como está. Um ponto
ao lado do nome indica que você alterou o texto desde que foi salva; **Salvar**
guarda a alteração se você puder editá-la e, caso contrário, propõe criar uma nova.

## As visões SQL

Uma **visão SQL** é uma visão PostgreSQL de verdade do schema da base. Ela fica **entre as
tabelas**, com sua cor e seu ícone como uma tabela, e um pequeno **olho** à direita que indica
que é uma visão. Um clique a abre em uma aba: suas linhas na grade, **Atualizar** para
relê-las.

![A visão “Factures à encaisser”, aberta pela barra lateral](../../../../assets/screens/vue-sql.png)

Ela é criada pelo menu **⋯** da base → **Nova visão SQL…**, ou a partir de uma aba SQL:
**⋯** → **Criar visão SQL…**, e a consulta da aba se torna a definição dela. A caixa de diálogo
pede:

- o **rótulo** e a **aparência** — cor, ícone ou imagem, escolhidos como para uma
  tabela;
- o **nome técnico**, derivado do rótulo se você não informar um — o que se escreve depois de
  `FROM`;
- a **consulta**: um único `SELECT`, sobre as tabelas e as outras visões da base. O PostgreSQL
  recusa o que ele recusa, e o editor aponta o local.

![A caixa de diálogo de uma visão SQL: rótulo e aparência, nome técnico, consulta, descrição](../../../../assets/screens/vue-sql-dialogue.png)

A visão é lida depois pelo nome, tanto pela interface quanto pelo `psql` ou pela sua ferramenta de BI:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Uma visão nunca mostra um campo que a pessoa não vê.** Cada pessoa a lê com as próprias permissões,
em cada tabela e cada coluna que ela lê; a barra lateral só a lista para quem pode ler tudo
o que ela lê. Ela só lê a **sua** base: outra base, ou o catálogo do basedb,
são recusados já na criação. Criá-la, editá-la ou excluí-la exige o nível **Gerenciamento**
na base. **Excluir**, no menu dela na barra lateral, a remove para todo mundo, scripts e
ferramentas incluídos; as tabelas que ela lê não são afetadas.

### Quando a estrutura muda

- **Renomear** uma tabela ou um campo não quebra uma visão: o PostgreSQL a acompanha.
- **Alterar a fórmula** de um campo calculado que ela lê a remove por um instante e depois a recria sobre a
  nova coluna. Se ela não se sustentar mais, fica **a corrigir** — um triângulo indica isso na
  barra lateral — com a definição preservada: **Editar visão…**, corrija, salve.
- Uma tabela não é purgada enquanto uma visão a lê, e uma visão não é excluída enquanto outra
  visão a lê: a recusa indica a visão responsável.

## Consulta, visão SQL ou pergunta?

| | O que é | Onde fica | Para quê |
|---|---|---|---|
| **Consulta salva** | um texto SQL | abaixo das tabelas, seção “Consultas” | reencontrar uma consulta, compartilhá-la como texto |
| **Visão SQL** | uma visão PostgreSQL de verdade | entre as tabelas | dar um nome a uma leitura, para a interface **e** para o `psql`, seus scripts, suas ferramentas |
| **Pergunta** | uma leitura construída com o mouse ou em SQL, e sua visualização | nos [painéis](/basedb/pt-br/fonctionnalites/tableaux-de-bord/) | um número, um gráfico, uma tabela dinâmica, sob filtros |

## Limites

- A grade mostra no máximo o número de **linhas por página** escolhido na parte de baixo da tela; “truncado”
  indica isso. Uma consulta é interrompida após 15 segundos.
- Uma visão SQL é lida em SQL e na interface; a API REST e o servidor MCP não a expõem.
- Uma visão SQL fica no ambiente em que foi criada: criar um ambiente, comparar
  a estrutura ou salvar um modelo ainda não a levam junto.
