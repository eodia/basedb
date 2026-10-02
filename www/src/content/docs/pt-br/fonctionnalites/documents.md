---
title: Documentos PDF
description: Uma linha em fatura, orçamento, ficha ou atestado com suas cores, com logotipo, linhas vinculadas e totais.
---

Uma linha se torna um **PDF**: uma fatura com suas linhas e seu total, um orçamento, um
comprovante de entrega, uma ficha de produto, um atestado. Na ficha de uma linha, o botão
**Documento PDF** o abre em uma nova aba, de onde o navegador o imprime ou o salva.

## A ficha, sem configurar nada

Sem modelo, uma linha é impressa como **ficha**: seu nome como título, depois todos os campos
que você pode ler, no seu idioma.

## Criar um modelo

Quem constrói a tabela — o nível Gerenciamento — cria os modelos a partir da ficha de uma linha:
**Documento PDF › Modelos de documento…**. Um novo modelo parte de um **ponto de partida**:

| Ponto de partida | O que ele monta |
|---|---|
| **Fatura** | cabeçalho com logotipo e dados de contato, “FATURA”, número e data; cliente; linhas faturadas e seu total; resumo de subtotal e total; condições de pagamento; informações legais no rodapé |
| **Orçamento** | título em uma faixa de cor, informações em grade, serviços, validade, área “Aprovado” |
| **Ficha** | título grande em toda a largura, foto do campo de imagem, campos em grade, textos longos |
| **Atestado** | página paisagem emoldurada, texto centralizado, assinatura |
| **Página em branco** | um título e os campos da linha |

Ele é construído com **as colunas da sua tabela** — seu número, sua data, seus valores, sua
foto, as linhas vinculadas a ela — e o que a tabela não tem é simplesmente deixado de lado.
Tudo pode ser alterado depois; a pré-visualização, à direita, mostra o PDF da linha aberta e
se atualiza a cada modificação.

## O conteúdo: os blocos

Os blocos se sucedem de cima para baixo; você os **arrasta** pela alça para reordená-los,
e os abre para configurá-los.

| Bloco | O que ele mostra |
|---|---|
| **Título** | um título grande e um subtítulo, discreto, em cor, sublinhado, ou em uma faixa — até as bordas da página |
| **Texto** | texto formatado — títulos, negrito, listas, links — que cita as colunas da linha com o menu **Coluna**: “Fatura `{{numero}}` de `{{date}}`”; alinhado ou justificado, sobre fundo colorido, emoldurado ou marcado com uma barra de cor |
| **Imagem** | um logotipo, um carimbo, ou a foto de um campo de imagem da linha |
| **Campos da linha** | os campos escolhidos, ou todos: rótulo à esquerda, rótulo acima em grade de 2 ou 3, ou **resumo** — valores à direita, o último (o total devido) em negrito; os campos vazios podem ser ocultados |
| **Tabela das linhas vinculadas** | as linhas que apontam para esta — as linhas de uma fatura — ou as que um vínculo múltiplo designa, com seus **totais**; cabeçalho colorido, uma linha a cada duas em cor, cabeçalhos, larguras e alinhamentos de coluna à sua escolha (“Qtd” para “Quantidade”) |
| **Colunas** | duas ou três colunas lado a lado, cada uma com seus blocos: “Faturado a” de um lado, as referências do outro |
| **Separador**, **Espaço** | um traço — curto para uma assinatura — ou um espaço em branco |
| **Quebra de página** | a continuação em uma nova página |

## O estilo e a página

- **Cor de destaque** — a da sua marca: títulos, faixas, cabeçalhos de tabela, links.
  O texto sobre ela fica branco ou escuro, conforme o que se lê melhor.
- **Cor do texto**, **fonte** do texto e dos títulos (sem ou com serifa),
  **tamanho** do texto, estilo dos entretítulos.
- **Formato** (A4 ou Letter), **orientação**, **margens**, **moldura** simples ou dupla ao redor
  da página, conteúdo **centralizado verticalmente** — para um atestado.
- **Idioma dos valores**: os valores monetários são escritos com sua moeda (“1.234,50 €”), as
  datas por extenso (“30 de setembro de 2026”), sim e não, o rótulo de uma opção, o nome de uma
  pessoa. O texto é composto em fontes embutidas que cobrem os vinte idiomas do basedb,
  ideogramas incluídos.

## Cabeçalho e rodapé

O **cabeçalho** traz seu **logotipo** — uma imagem enviada (PNG, JPEG ou SVG; uma imagem muito
pesada é reduzida) ou o campo de imagem da linha —, um texto à esquerda (seus dados de contato) e
um texto à direita (o que é o documento, seu número, sua data), na primeira página ou em todas.
O **rodapé** traz suas informações legais e os números de página. Os dois citam as colunas da
linha, como um texto.

## Cada um com suas permissões

Um documento é lido **com as permissões de quem o imprime**: um campo oculto para essa pessoa
não aparece nele — nem em um texto, nem em uma imagem —, uma linha vinculada que ela não vê não
entra na tabela — nem no total. Duas pessoas podem, portanto, obter dois documentos diferentes
da mesma linha: cada uma tem o seu.

## Pela API

```bash
# O PDF de uma linha com um modelo, ou a "ficha"
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lista os modelos da tabela.

## Limites

- Uma imagem enviada pesa no máximo 300 KB, oito por modelo; uma imagem de um campo é usada se
  for um PNG ou um JPEG.
- Um valor de uma linha vinculada é citado fora da tabela por uma **busca** na tabela do
  documento; um total com impostos é um campo da tabela.
- Um documento por linha: ainda não há PDF de várias linhas. Uma
  [automação](/basedb/pt-br/fonctionnalites/automatisations/#um-pdf-e-um-e-mail) pode fazer isso
  por você — **Gerar um PDF** — e enviá-lo como anexo.
