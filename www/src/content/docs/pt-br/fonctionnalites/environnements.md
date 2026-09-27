---
title: Ambientes
description: Produção, homologação, desenvolvimento — comparar, migrar, sincronizar.
---

Uma base pode ter **ambientes**: produção, homologação, desenvolvimento… Cada um é uma
base completa — seu schema, suas tabelas, suas linhas, suas permissões — e todos compartilham a
**linhagem** da base, de suas tabelas e de seus campos.

## Na interface

A barra lateral mostra **uma linha por base**, com um selo que indica o ambiente aberto e
permite trocá-lo. O selo não aparece enquanto só existir a produção.

Os ambientes são adicionados, renomeados e excluídos em **Editar base…**: um
novo ambiente nasce de uma **cópia da estrutura** de outro, sem as linhas.

## Comparar os ambientes

No menu da base, em **Outras ações**, **Comparar ambientes…** abre uma caixa de diálogo:

- **Estrutura**: os ambientes em colunas, tabelas e campos em linhas; o que difere da
  produção fica destacado.
- **Aplicar migrações…** prepara o plano para passar de um ambiente a outro, etapa
  por etapa. Ele nunca marca de antemão o que desfaria uma alteração mais recente no
  destino.
- **Sincronização de linhas**: tabela por tabela, transferir linhas de um ambiente para
  outro, por identificador.

![Comparar a produção e a homologação](../../../../assets/screens/environnements.png)

## Como o basedb sabe quem mudou o quê

A comparação se baseia no **histórico de estruturas**: cada criação, alteração ou
exclusão de tabela ou de campo é capturada por um trigger no catálogo e pode ser lida na
aba “Estrutura” do histórico. Os identificadores de linhagem ligam um campo da homologação
ao seu equivalente na produção, mesmo renomeado.

## Em SQL

Cada ambiente é um schema: `b_t4z56fq_ventes` para a produção,
`b_t4z56fq_ventes_recette` para a homologação. Suas consultas mudam de ambiente mudando
de schema — ou de `search_path`.
