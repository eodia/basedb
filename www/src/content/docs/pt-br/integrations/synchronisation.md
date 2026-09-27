---
title: Slack, agendas e tabelas sincronizadas
description: Notificar um canal do Slack, conectar uma agenda, manter uma tabela atualizada a partir de um CSV, de uma agenda ou de outra base.
---

A tela **Integrações** de uma base é aberta pelo menu do perfil, no canto inferior esquerdo. Ela
exige o nível **Gerenciamento** e reúne o que conecta a base ao resto das suas ferramentas.

![A tela Integrações de uma base](../../../../assets/screens/integrations.png)

## Slack

**Conectar canal**: no Slack, crie um *webhook de entrada* para o canal desejado e cole
o endereço dele (`https://hooks.slack.com/…`, única origem aceita). **Testar** envia uma mensagem
de teste. O endereço é criptografado assim que é salvo e nunca mais é exibido.

O canal conectado passa então a ser uma ação das [automações](/basedb/pt-br/fonctionnalites/automatisations/):
**Enviar para o Slack**, com uma mensagem que cita a linha — “Nova avaliação negativa de
{{Auteur}}: {{Avis}}”.

## Agendas

Dois sentidos, dois meios:

- **Ver uma visão em uma agenda**: compartilhe publicamente uma visão de calendário ou de linha do tempo; a
  caixa de diálogo de compartilhamento dela fornece o endereço de um **feed iCalendar**, que pode ser assinado no Google
  Agenda (“Outras agendas” → “Do URL”), no Outlook ou no Apple Calendar. Veja
  [Visões compartilhadas](/basedb/pt-br/fonctionnalites/vues-partagees/#um-calendário-na-sua-agenda).
- **Importar uma agenda**: crie uma tabela sincronizada com a fonte “Agenda” e o endereço
  iCal secreto da agenda.

## Tabelas sincronizadas

Uma tabela sincronizada é **mantida atualizada a partir de uma fonte**: ela pode ser lida, filtrada e
mostrada em visões como as outras, mas não pode ser escrita à mão — um selo
“Sincronizada” lembra isso, e a API recusa qualquer escrita (`TABLE_SYNCED`).

| Fonte | O que a tabela se torna |
|---|---|
| **Arquivo CSV on-line** | uma coluna para cada coluna do arquivo, tipada de acordo com o conteúdo: número, data ou texto |
| **Agenda** (Google Agenda, iCalendar) | um evento por linha: título, início, fim, local, descrição |
| **Visão compartilhada de um basedb** | as linhas de uma [visão compartilhada](/basedb/pt-br/fonctionnalites/vues-partagees/#uma-fonte-para-outras-bases), nesta instância ou em outra |

**Nova tabela sincronizada** escolhe a fonte e o intervalo — de a cada 15 minutos até uma
vez por dia; **Sincronizar** a relê na hora. Cada passagem cria, altera e
exclui o necessário para que a tabela fique igual à fonte, orientando-se por um campo
**Chave de sincronização**. Todas essas escritas passam pelo histórico.

**Parar** a sincronização torna a tabela comum: as linhas dela permanecem e podem ser escritas
à mão novamente.

## Limites

- Uma fonte é lida dentro do limite de 5 MB, 10.000 linhas e 10 segundos.
- Uma fonte com falha não apaga nada: a tabela mantém suas linhas até a passagem seguinte.
- Uma coluna que aparece na fonte depois da criação não é adicionada.
- O Slack é conectado por webhook de entrada, ainda não por um aplicativo do Slack.
