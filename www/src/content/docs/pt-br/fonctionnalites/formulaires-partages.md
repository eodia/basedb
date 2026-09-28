---
title: Formulários compartilhados
description: Compartilhar um formulário por um link, público ou reservado aos membros conectados.
---

Um formulário ou um questionário é **compartilhado por um link** `/f/<jeton>`. A pessoa que
responde não precisa de **nenhuma permissão na tabela**: cada resposta adiciona uma linha, e nada
mais da tabela é mostrado a ela. Para mostrar linhas em vez de recebê-las, uma visão
é compartilhada [somente para leitura](/basedb/pt-br/fonctionnalites/vues-partagees/).

![A caixa de diálogo de compartilhamento](../../../../assets/screens/partage-formulaire.png)

## Quem pode responder

| Acesso | Quem responde | O que aparece |
|---|---|---|
| **Público** | qualquer pessoa com o link, sem conta | o formulário, sozinho |
| **Membros conectados** | um membro do tenant — se necessário, de certos grupos | o login, depois o formulário e “Você está respondendo como …” |

A página do link fica fora do aplicativo: nem barra lateral, nem nome da base, nem outras linhas.
Ela usa a aparência do formulário — seu tema, sua cor, sua fonte —, e só faz as perguntas que
as respostas anteriores exigem.

![Um formulário público](../../../../assets/screens/formulaire-public.png)

## Em nome de quem a resposta é escrita

A linha é escrita sob a **autoridade da pessoa que publicou o compartilhamento** — a última a
tê-lo salvo. A permissão dela de criar linhas é verificada **a cada resposta**, restrita às
perguntas do formulário: se ela a perder, o formulário fica suspenso até que alguém
que a tenha o salve novamente.

O histórico informa quem respondeu, não quem publicou:

- uma resposta de **membro** é atribuída à pessoa;
- uma resposta **pública** é atribuída ao próprio formulário: “Formulário ‘Demande de
  devis’ · resposta pública · publicado por Camille”.

## Abrir e fechar

A caixa de diálogo configura:

- o interruptor **Link ativo**;
- uma **data de encerramento**;
- um **número máximo de respostas** — exato, mesmo com respostas simultâneas;
- **Regenerar link**: o antigo para de funcionar na hora;
- **Parar de compartilhar**: o link desaparece, as respostas ficam na tabela.

Um formulário fechado informa isso em uma frase, antes mesmo de pedir um login.

## Limites

- As perguntas do tipo **relação**, **arquivo** e **imagem** não são feitas por um link
  compartilhado; a caixa de diálogo as indica.
- O envio é limitado a 20 respostas por minuto, por endereço e por link. Atrás do proxy fornecido
  (Caddy), o endereço é o do visitante.

Os detalhes estão no [capítulo 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
do documento de arquitetura.
