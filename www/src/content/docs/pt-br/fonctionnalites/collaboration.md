---
title: Colaboração
description: Comentários e menções, notificações, atualizações em tempo real, presença e um link para cada tela.
---

Várias pessoas trabalham na mesma base ao mesmo tempo: cada uma vê as escritas das
outras chegarem, sabe quem está olhando o quê e discute uma linha ali mesmo onde ela está.

## Comentários

Os detalhes de uma linha têm uma aba **Comentários**, entre “Detalhes” e “Histórico”. Digite
`@` para **mencionar** um membro, Ctrl+Enter para enviar. Cada pessoa edita ou exclui os
próprios comentários.

![Uma conversa sobre um projeto](../../../../assets/screens/commentaires.png)

Poder ler a linha basta para comentá-la. Uma pessoa mencionada que não pode lê-la
não é notificada — e o autor é avisado disso em vez de achar que a mensagem foi enviada.

## Notificações

O sino, no canto superior direito, conta o que não foi lido. Quatro coisas chegam ali:

- alguém **menciona** você em um comentário;
- alguém **responde** em uma conversa em que você escreveu;
- alguém **designa** você em um campo Pessoa — pela interface, pela API, por um formulário
  ou por uma automação;
- uma [automação](/basedb/pt-br/fonctionnalites/automatisations/) **notifica** você.

Abrir uma notificação abre a linha. **Marcar tudo como lido** zera o contador; as
notificações são mantidas por 90 dias.

![Uma menção recebida](../../../../assets/screens/notifications.png)

## Tempo real

As escritas dos outros aparecem **sem recarregar**: uma célula alterada, um cartão
movido, uma linha adicionada — venham elas da interface, da API, de um agente ou do SQL
direto. O servidor envia apenas um **sinal**, nunca um dado: é a tela que relê, com
as suas permissões. Uma célula que você está editando nunca é substituída enquanto
você digita.

## Presença

Os rostos das pessoas que estão olhando **a mesma tabela** aparecem no topo da tela; os
de quem abriu **a mesma linha**, no cabeçalho dos detalhes dela. Na grade, o ponteiro dos
outros aparece sobre a célula em que eles estão passando o mouse.

## Um link para cada tela

O endereço do navegador acompanha o que você está olhando: uma tabela, uma de suas visões, os
detalhes de uma linha, um painel, uma automação, uma pergunta, suas configurações. Cole-o em uma
mensagem: seu colega chega ao mesmo lugar, com as próprias permissões dele. Marque-o como
favorito; os botões voltar e avançar do navegador levam de volta a onde você estava.

| Endereço | O que ele abre |
|---|---|
| `/bases/ventes/tables/opportunites` | a tabela “Opportunités” da base “Ventes” |
| `/bases/ventes/tables/opportunites?vue=…` | uma de suas visões |
| `/bases/ventes/tables/opportunites?ligne=…` | os detalhes de uma de suas linhas |
| `/bases/ventes/tableaux-de-bord/…` | um painel |
| `/bases/ventes/automatisations/…` | uma automação |
| `/parametres/apparence` | suas configurações |

Um endereço nomeia um **lugar**, não o estado em que você o deixou: filtros, ordenações e
larguras de colunas continuam os de cada navegador. Uma base e uma tabela são escritas ali pelo
seu nome PostgreSQL: renomeadas, o endereço antigo não leva mais a lugar nenhum. Um endereço que
não leva a nada — um erro de digitação, um objeto excluído, ou algo que você não tem permissão
para ver — exibe “Esta página não existe”.

## Desfazer

Ctrl+Z desfaz a sua última escrita — veja [o histórico](/basedb/pt-br/fonctionnalites/historique/#desfazer-ctrlz).

## Limites

- As notificações ficam no basedb: por enquanto, nenhuma é enviada por e-mail.
- Acima de cem linhas alteradas de uma vez, a tela recarrega a página inteira em vez de
  atualizar linha por linha.
