---
title: Busca
description: Um único campo para encontrar tudo — tabelas, visões, painéis, linhas, comandos — e para fazer uma pergunta ao Copilot. Ctrl+K.
---

O campo **Buscar tabelas, linhas, comandos…**, no centro da barra superior, abre a busca: um
único campo para tudo o que você pode alcançar no basedb. **Ctrl+K** (**⌘K** no Mac) a abre ou
fecha em qualquer tela — exceto em um editor de texto, onde ele adiciona um link.

## O que ela encontra

| | |
|---|---|
| **Tabelas e objetos** | os projetos e as bases que você vê; as tabelas, visões SQL e consultas salvas; as visões das tabelas da base aberta, pessoais inclusive; as perguntas, painéis e automações das bases do projeto; as colunas das tabelas; as abas abertas |
| **Linhas** | os próprios dados, nas tabelas da base aberta: o texto das colunas, as opções das listas, um número exato — a partir de dois caracteres. Um identificador de linha colado encontra sua linha |
| **Comandos** | o que o aplicativo sabe fazer: ir para a estrutura, o histórico, os painéis da base; criar uma tabela, uma pergunta, uma consulta SQL, uma base, um projeto, começar de um modelo; importar em uma tabela; desfazer ou refazer a última escrita; fechar ou trocar de aba; mudar de tema; abrir o Copilot; **Copiar o link desta página**; abrir uma aba das configurações ou da administração; sair |
| **Copilot** | uma pergunta em linguagem natural, entregue ao Copilot |

**Enter** abre o resultado escolhido: uma linha se abre em sua tabela, nos seus detalhes. Em uma
tela grande, um painel à direita mostra a prévia — os valores de uma linha, as colunas e a
descrição de uma tabela, a descrição de um painel ou de uma automação. Cole um endereço do
basedb: **Abrir este link** leva você até lá (veja
[um link para cada tela](/basedb/pt-br/fonctionnalites/collaboration/#um-link-para-cada-tela)).

O campo vazio propõe os seus **recentes**, as abas abertas, as tabelas da base e algumas
sugestões.

## Digite como você pensa

- **Nem acentos nem maiúsculas**: `andre` encontra “André”.
- **Começos de palavras e iniciais**: `nc` para “Novo cliente”, `novatab` para “Nova tabela”.
- **Um erro de digitação perdoado** — uma letra esquecida, duplicada, trocada ou invertida, duas
  em uma palavra com mais de sete letras —, nunca na primeira letra.
- **Cada palavra digitada precisa se encontrar em algum lugar**, no nome ou no que o contém:
  `vendas clientes` encontra a tabela “Clientes” da base “Vendas”. O tipo do objeto também pode
  ser digitado: `visão`, `automação`, `painel`.
- **Uma tabela, seguida do que você procura nela**: `clientes sao paulo` procura “sao paulo” nas
  linhas da tabela “Clientes”.

No topo, o **melhor resultado**; o que você abre com frequência e recentemente sobe na lista.
Essa memória fica no seu navegador.

## Restringir a busca

Os botões abaixo do campo — **Tudo**, **Tabelas e objetos**, **Linhas**, **Comandos**,
**Copilot** — restringem o que é buscado. Um primeiro caractere faz o mesmo:

| Digite primeiro | Para buscar |
|---|---|
| `#` | somente as tabelas e objetos |
| `/` | somente as linhas |
| `>` | somente os comandos |
| `?` | uma pergunta ao Copilot |

**Tab**, em uma tabela ou uma base, busca **dentro** dela: o nome dela aparece no campo, e a
busca passa a valer só para suas linhas, suas visões, suas colunas e seus comandos. O campo
vazio mostra então as vinte linhas modificadas mais recentemente. **⌫**, com o campo vazio, sai
dali; **Esc** volta um passo, depois fecha.

## Perguntar ao Copilot

Toda busca termina com **Perguntar ao Copilot: “…”**, colocado em primeiro quando o texto se lê
como uma pergunta — termina com “?”, começa com “quanto”, “qual”, “mostre”…, ou tem cinco
palavras ou mais. O Copilot se abre sobre a base e recebe a pergunta como se você a tivesse
digitado. Ele lê a estrutura, não as linhas, a não ser que você marque **Permitir a leitura dos
dados**, e ele propõe: nada muda antes que você aplique. É preciso que a IA esteja configurada
na instância — veja [Inteligência artificial](/basedb/pt-br/fonctionnalites/ia/).

## Permissões e limites

A busca passa pelas mesmas rotas que o resto da tela, **com as suas permissões**: uma tabela ou
uma coluna fechada para você não aparece, nem entre os objetos nem nas linhas. As automações só
são propostas a quem tem o nível **Gerenciamento** na base delas.

- As linhas são buscadas na base aberta, ou na base ou na tabela em que você entrou pelo Tab:
  três linhas por tabela, em no máximo vinte e quatro tabelas; vinte linhas em uma tabela.
- As perguntas, painéis e automações são os do projeto aberto (no máximo oito bases), relidos no
  máximo a cada dois minutos.
- Cada grupo mostra alguns resultados, depois **N outros resultados**, que o abre por inteiro.

## Atalhos do teclado

**Atalhos**, na parte de baixo da busca, ou o comando **Atalhos do teclado**, mostra todos eles.
**Ctrl** se lê **⌘** no Mac.

| Teclas | Efeito |
|---|---|
| **Ctrl+K** | abrir ou fechar a busca |
| **↑** **↓**, **Enter** | percorrer os resultados, abrir o resultado |
| **Alt+W** | fechar a aba |
| **Ctrl+Tab**, **Ctrl+Shift+Tab** | próxima aba, aba anterior |
| clique com o botão do meio | fechar uma aba |
| **Ctrl+A**, **Ctrl+C** | na grade, selecionar tudo, copiar as células escolhidas |
| **Ctrl+clique** | seguir uma relação |
| **Ctrl+Z**, **Ctrl+Y** | desfazer a última escrita, refazê-la |
| **Ctrl+Enter** | enviar um comentário, salvar uma descrição |
| **Ctrl+B**, **Ctrl+I**, **Ctrl+K** | em um texto: negrito, itálico, link |
