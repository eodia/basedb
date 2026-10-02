---
title: Automações
description: Quando uma linha muda, entra em um filtro ou desaparece, quando uma data chega, em horário fixo, com um clique ou uma chamada — editar, criar, buscar, contar, repetir, ramificar, aguardar, tentar, perguntar à IA, gerar um PDF, notificar, enviar um e-mail, chamar um serviço.
---

Uma automação diz **quando**, **se** e **então**: quando uma tarefa passa para “Fait”, registrar
a hora; quando chega uma avaliação negativa, notificar a responsável e escrever no Slack; toda
segunda-feira às 9h, criar a linha da reunião de equipe. E quando uma ação não basta, ela segue um
**fluxo**: buscar uma linha, seguir uma ramificação ou outra conforme o que ela diz, repetir
etapas em cada linha que atende a um filtro, reutilizar em uma etapa o que uma etapa anterior
encontrou ou escreveu, **aguardar** três dias antes de um lembrete, enviar um **PDF** em anexo.

Elas são abertas em **Automações**, no bloco da base aberta, na parte de baixo da barra
lateral, e exigem o nível **Gerenciamento**.

![Um fluxo e uma de suas execuções, sobreposta a ele](../../../../assets/screens/pt-br/automatisations.webp)

## O fluxo

O fluxo é desenhado de cima para baixo: o gatilho e depois cada etapa. Um **+** sobre uma linha
abre a lista de etapas, organizadas por categoria — Linhas, Comunicar, Documentos, IA,
Lógica —, com uma busca, e adiciona a escolhida naquele ponto; um cartão abre suas configurações
à direita. Uma automação
simples — um gatilho e uma ação — cabe em dois cartões e se configura como antes.

## Quando

| Gatilho | Configurações |
|---|---|
| **Uma linha é criada** | a tabela |
| **Uma linha é alterada** | a tabela e, se necessário, apenas os campos a monitorar |
| **Em horário fixo** | a cada hora, todo dia ou toda semana, no horário e no fuso escolhidos |
| **Um botão é clicado** | um [campo Botão](/basedb/pt-br/fonctionnalites/tables-et-champs/#botão) da tabela |
| **Uma linha é excluída** | a tabela; as etapas citam a linha como ela estava |
| **Uma linha entra em um filtro** | a tabela e o filtro: a automação dispara quando uma linha entra nele, e só dispara de novo depois de ter saído dele — “uma fatura passa a estar em atraso”, não “uma fatura em atraso é alterada” |
| **Uma data chega** | um campo Data da tabela, uma defasagem — três dias antes, no mesmo dia, uma semana depois — e o horário: lembretes de vencimento, aniversários de contrato |
| **Um webhook é recebido** | nada: a automação recebe seu próprio endereço, que outro programa chama ([detalhes](#um-serviço-que-chama-o-basedb)) |

Um gatilho sobre as linhas vê **todas** as escritas: a interface, a API, um agente, um
formulário compartilhado e até o SQL direto — as automações partem do histórico, que
captura todas elas.

## Somente se

Uma condição opcional, na [linguagem dos filtros](/basedb/pt-br/integrations/api-rest/#ler) —
`statut eq "fait"`, `montant gte 10000 and payee eq false` — avaliada sobre a linha **no momento
de agir**. Uma execução cuja condição não é atendida é “descartada”, e informa isso.

## Então

Até quarenta etapas, em ordem; a primeira que falha interrompe as seguintes — exceto
dentro de um bloco **Tentar** ([detalhes](#tentar)).

| Etapa | O que ela faz |
|---|---|
| **Editar uma linha** | escreve valores na linha que disparou — ou naquela que uma etapa encontrou ou criou |
| **Criar uma linha** | nesta tabela ou em outra da base |
| **Buscar uma linha** | a primeira linha de uma tabela que atende a um filtro, para que as etapas seguintes a citem ou a alterem |
| **Notificar alguém** | uma [notificação](/basedb/pt-br/fonctionnalites/collaboration/#notificações) para pessoas escolhidas, ou para a de um campo Pessoa |
| **Enviar um e-mail** | para pessoas da equipe, para a de um campo Pessoa, para o endereço de um campo E-mail — um cliente, um fornecedor — ou para endereços escritos; o assunto e o texto citam a linha e as etapas anteriores |
| **Chamar um webhook** | uma requisição HTTPS a um serviço — método, endereço, cabeçalhos e corpo à sua escolha ([detalhes](#chamar-um-serviço)); a resposta pode ser citada depois |
| **Enviar para o Slack** | uma mensagem em um canal [conectado](/basedb/pt-br/integrations/synchronisation/#slack) |
| **Perguntar à IA** | uma resposta do [provedor de IA](/basedb/pt-br/fonctionnalites/ia/) a uma instrução que cita a linha e as etapas anteriores — redigir, resumir, classificar —, lida como um texto, um número, sim ou não, uma data ou uma opção de uma lista |
| **Condição** | várias ramificações: a primeira cuja condição é atendida é seguida, “Senão” quando nenhuma é; as ramificações se juntam depois |
| **Para cada linha** | as etapas que ela contém, uma vez para cada linha de uma tabela que atende a um filtro ([detalhes](#para-cada-linha)) |
| **Excluir uma linha** | a linha que disparou, ou a que uma etapa encontrou — ela vai para a lixeira |
| **Contar e somar** | o número de linhas de um filtro, sua soma, sua média, seu mínimo ou máximo, para citar ou testar depois |
| **Gerar um PDF** | o [documento](/basedb/pt-br/fonctionnalites/documents/) de uma linha, arquivado em um campo Arquivo ou anexado a um e-mail |
| **Aguardar** | uma duração, ou até a data de um campo ([detalhes](#aguardar)) |
| **Tentar** | etapas, e outras a fazer se uma delas falhar ([detalhes](#tentar)) |
| **Executar uma automação** | outra automação da base, em uma linha de sua tabela |

Uma busca que não encontra nada não interrompe o fluxo: as etapas que deveriam alterar a linha
dela são puladas. Para fazer outra coisa nesse caso, **Se nenhuma linha for encontrada…**,
abaixo da busca, adiciona uma condição que testa isso.

Uma **condição** testa uma linha com um filtro, ou um **valor**: a resposta da IA, o
código de um webhook, um total — “`{{e2.reponse}}` é igual a Urgente”, “`{{e3.somme.montant}}`
é maior ou igual a 1000”. Os números se comparam como números, os textos sem acentos nem
maiúsculas.

## Para cada linha

A etapa **Para cada linha** lê as linhas de uma tabela que atendem ao seu filtro — vazio:
todas —, na ordem escolhida, até o seu limite (50 por padrão, no máximo 200), e depois executa
uma vez para cada uma as etapas colocadas dentro dela. “Toda segunda-feira, cobrar as faturas
em aberto” se escreve assim: **Em horário fixo**, depois **Para cada linha** das faturas
`payee eq false and relancee eq false`, e dentro do laço um e-mail para o contato da fatura
e **Editar uma linha** que marca “Relançada”.

Dentro do laço, o identificador da etapa nomeia a **linha da vez**: `{{e1.client}}` a cita,
e **Editar uma linha** a propõe entre as linhas a alterar. Depois do laço,
`{{e1.nombre}}` informa quantas linhas ela percorreu — para um resumo no Slack, por
exemplo. O filtro pode citar o que vem antes: disparada por uma fatura paga,
`facture eq {{_id}}` percorre as suas linhas de detalhe.

Além do limite, as linhas restantes aguardam a próxima execução, que informa isso:
tire do filtro as que já foram tratadas — uma caixa “relancée”, uma data — para
tratá-las todas ao longo das execuções. Um laço não contém outro laço, e uma
execução para depois de dois minutos.

## Aguardar

A etapa **Aguardar** coloca a execução em pausa — três horas, dois dias — ou até a data
de um campo de uma linha, com uma defasagem e um horário: “na véspera do vencimento, às 9h”.
A execução aparece **Pausado** na aba **Execuções**, com a data de sua retomada.

Ela retoma na etapa seguinte **relendo** suas linhas: “três dias depois do envio do
orçamento, se ele ainda não foi aceito, cobrar” se escreve **Aguardar** 3 dias, depois uma
condição sobre o status do orçamento, como ele está nesse dia. Desativar a automação interrompe
as execuções pausadas; uma espera não pode ficar dentro de um laço nem de um bloco
**Tentar**, e dura no máximo um ano.

## Tentar

O bloco **Tentar** tem dois caminhos. O primeiro é executado; se uma de suas etapas falhar, o
fluxo continua pelo segundo, **Em caso de falha**, que cita a falha — `{{e4.erreur}}`, o código,
e `{{e4.etape}}`, a etapa —, e depois retoma após o bloco. Uma forma de avisar alguém quando um
serviço não responde, sem parar tudo.

Mais simplesmente: um webhook pode **tentar de novo** por conta própria até três vezes após uma
falha do serviço, e um laço pode **continuar** mesmo com uma linha em falha.

## Um PDF e um e-mail

**Gerar um PDF** faz o documento de uma linha — com um [modelo de
documento](/basedb/pt-br/fonctionnalites/documents/) de sua tabela, ou a ficha de todos os seus
campos — e pode arquivá-lo em um campo Arquivo. **Enviar um e-mail** pode então anexá-lo, com
os arquivos de um campo Arquivo ou Imagem:

- um e-mail **para cada um**, ou **um único para todos**, com destinatários **em cópia**;
- uma mensagem em **texto formatado** — negrito, listas, links — que cita a linha;
- um endereço de **resposta**: o seu por padrão, ou o de um campo E-mail;
- até 50 destinatários, 10 anexos e 15 MB.

“Quando um orçamento passa para Aprovado, enviar a fatura ao cliente, com a contabilidade em
cópia”: **Uma linha entra em um filtro** `statut eq "accepte"`, **Gerar um PDF** com o modelo
Fatura, **Enviar um e-mail** ao campo E-mail do cliente, com a fatura anexada.

## Um serviço que chama o basedb

Com o gatilho **Um webhook é recebido**, a automação tem seu próprio endereço secreto, a ser
dado ao programa que deve dispará-la — uma loja virtual, um formulário externo, uma ferramenta
de automação:

```bash
curl -X POST "https://basedb.example.com/api/v1/hooks/<secret>" \
  -H "content-type: application/json" \
  -d '{"client": {"nom": "Dupont"}, "total": 120}'
```

As etapas citam o que ele enviou: `{{trigger.client.nom}}`, `{{trigger.total}}`; um
formulário é lido da mesma forma, um texto por `{{trigger.texte}}`. O endereço se copia a partir
das configurações do gatilho; **Trocar o endereço** o substitui, e o antigo deixa de funcionar
imediatamente. Uma chamada recebe `202`, a automação roda no mesmo segundo.

## Chamar um serviço

Por padrão, a etapa **Chamar um webhook** envia, em `POST`, os dados da automação:
a linha escolhida e o que as etapas anteriores encontraram ou escreveram. Para falar com um
serviço da forma que ele espera, você configura:

- o **método**: `POST`, `PUT`, `PATCH`, `GET` ou `DELETE` — estes dois últimos sem corpo;
- o **endereço**, que pode citar depois do seu host — `https://api.exemple.fr/clients/{{e2.numero}}`;
  cada valor é codificado nele;
- **cabeçalhos**, cujo valor pode citar: `Idempotency-Key: {{_id}}`;
- o **corpo**: os dados da automação, um **JSON a compor**, um **formulário**
  (um par `chave=valor` por linha) ou um **texto**. Em um JSON, uma citação entre
  aspas é texto, e fora de aspas é um valor — um número, sim ou não, uma lista:

```json
{ "facture": "{{e1.numero}}", "montant": {{e1.montant}}, "payee": {{e1.payee}} }
```

Uma chave de API ou um token vai em um cabeçalho **secreto** (o cadeado): criptografado pela chave
da instância, ele nunca mais é exibido — nem na tela, nem pela API, nem para o Copilot — e só é
enviado ao host para o qual você o forneceu. Mudar o host do endereço exige informá-lo de
novo; **Substituir** permite digitar um novo.

## Perguntar à IA

Como um [campo de IA](/basedb/pt-br/fonctionnalites/ia/#a-opção-de-ia-de-um-campo), a etapa envia ao
provedor a sua instrução, em que cada citação é substituída pelo seu valor:

```text
Esta avaliação de {{auteur}} exige alguma ação da nossa parte? {{avis}}
```

Você escolhe a **resposta esperada** — um texto livre ou curto, um número, sim ou não, uma data,
um endereço web ou uma opção de uma lista, que pode ser reaproveitada de um campo de seleção. O modelo
é avisado disso, e uma resposta que não contenha nada disso faz a etapa falhar. As etapas seguintes
a citam por `{{e1.reponse}}`: no título de uma tarefa criada, em uma mensagem ou em um campo de seleção,
em que ela é colocada na opção de mesmo rótulo.

O que a instrução cita vai para o provedor: a etapa pede o seu **consentimento**, que deve ser dado de novo
quando a instrução muda. Cada chamada é registrada em log e conta, junto com os campos de IA, em
`BASEDB_AI_FIELD_QUOTA` (300 por hora por padrão). A IA não faz nada por conta própria: são as
etapas colocadas depois dela que escrevem ou notificam.

## Citar

Os valores, as mensagens e os filtros citam o que vem antes, pelo botão **{ }** ao lado
de cada texto:

- `{{Titre}}`, `{{_id}}`: a linha que disparou;
- `{{e2.titre}}`, `{{e2._id}}`: a linha encontrada, criada ou alterada pela etapa `e2` — cada
  etapa mostra seu identificador no cartão;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: o que o webhook `e3` respondeu;
- `{{e4.reponse}}`: a resposta da etapa de IA `e4`;
- `{{e5.client}}` no laço `e5`, a linha da vez; `{{e5.nombre}}` depois dele, o número
  de linhas percorridas;
- `{{e6.nombre}}`, `{{e6.somme.montant}}`, `{{e6.moyenne.montant}}`, `{{e6.max.echeance}}`: o
  que a etapa `e6` contou;
- `{{e7.erreur}}`, `{{e7.etape}}`: a falha que o bloco **Tentar** `e7` recuperou;
- `{{e8.nom}}`: o nome do PDF da etapa `e8`;
- `{{trigger.client.nom}}`: o que um webhook de entrada enviou;
- `{{_maintenant}}`: o instante da execução.

Um valor formado por uma única citação passa o próprio valor: uma relação, uma pessoa, uma
opção — é assim que uma linha criada se liga àquela que uma busca encontrou. Em um
filtro, uma citação é sempre um valor comparado, nunca linguagem de filtro.

Uma etapa só pode citar o que com certeza aconteceu antes dela: o que uma ramificação encontrou
não pode mais ser citado depois da condição. O editor sinaliza isso no cartão antes de salvar.

## O Copilot

**Copilot**, no cabeçalho, abre à direita uma conversa em linguagem natural sobre as
automações da base: “quando uma tarefa passar para revisão, avise a pessoa
responsável”, “adicione um resumo feito pela IA nas notas”, “por que a última execução
falhou?”. Ele responde e **propõe** uma automação inteira — a que está na tela,
alterada, ou uma nova —, com a lista do que muda.

Nada é salvo pelo Copilot: **Aplicar ao fluxo** mostra a proposta no editor,
onde você a revisa antes de salvar — e **Cancelar**, no cartão, devolve o fluxo ao estado em que
estava. Uma nova automação abre no editor, pronta para ser criada. Cada proposta é
verificada como um salvamento seria; o que não se sustenta é descartado, e isso é informado.

Por padrão, **somente a estrutura** vai para o provedor de IA, junto com a conversa: as tabelas
e seus campos, as automações da base, a que está na tela tal como o editor a mostra, e
suas últimas execuções — seus status e seus códigos de erro, nunca um valor. As pessoas
e os canais do Slack são enviados sob marcadores (`p1`, `s1`), nunca pelo identificador. A caixa
**Permitir a leitura dos dados** permite que o Copilot, durante a conversa, leia linhas
(no máximo 50 por leitura), com cada leitura listada abaixo da resposta.

## Testar, acompanhar

**Testar em uma linha** executa a automação salva em uma linha escolhida, de
verdade. A aba **Execuções** guarda as 50 últimas, por 30 dias: pendente, em andamento, bem-sucedida,
descartada com o motivo, com falha e o código. Escolher uma a sobrepõe ao fluxo — a ramificação
seguida é destacada, cada etapa executada diz o que fez e em quanto tempo, o resto fica
esmaecido. Em um laço, cada etapa também informa quantas vezes ela rodou.

## Em nome de quem ela age

Uma automação age com as **permissões da pessoa que a salvou por último**,
reavaliadas a cada execução: se essa pessoa perder uma permissão, a etapa que precisava dela
falha em vez de ignorá-la, e uma busca só encontra o que essa pessoa pode ler.
O histórico a exibe como “Automação ‘Tâche terminée’ · em nome de …”, e suas escritas
podem ser desfeitas como as outras.

## Limites

- O que uma automação escreve não dispara nenhuma outra: o que precisa ser encadeado é escrito
  em um único fluxo, ou por **Executar uma automação**, no máximo três níveis.
- Uma busca retorna uma linha, a primeira; um laço percorre no máximo 200 por
  execução. Uma execução dura no máximo dois minutos, sem contar as esperas.
- Sem script. Um e-mail parte pelo [servidor de envio](/basedb/pt-br/hebergement/variables/#e-mails)
  da instância.
- Um [modelo de base](/basedb/pt-br/fonctionnalites/modeles/) só leva as automações sem
  busca, laço, condição nem etapa de IA, e nunca um webhook.
- Um webhook não segue redirecionamentos e aguarda no máximo 10 segundos; uma resposta
  diferente de 2xx faz a etapa falhar, depois de suas tentativas.
- Uma data que chega é buscada a cada minuto; só contam as que chegaram depois do
  registro da automação.
- 100 execuções por hora e por automação; um horário agendado perdido só é recuperado
  uma vez.
- O intervalo entre a escrita e a ação é da ordem de um segundo.
