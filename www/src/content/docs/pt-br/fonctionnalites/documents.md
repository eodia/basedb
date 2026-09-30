---
title: Documentos PDF
description: Uma linha em fatura, orçamento ou ficha para impressão, com suas linhas vinculadas e seus totais.
---

Uma linha se torna um **PDF**: uma fatura com suas linhas e seu total, um orçamento, um
comprovante de entrega, uma ficha. Na ficha de uma linha, o botão **Documento PDF** o abre em
uma nova aba, de onde o navegador o imprime ou o salva.

## A ficha, sem configurar nada

Sem modelo, uma linha é impressa como **ficha**: seu nome como título, depois todos os campos
que você pode ler, no seu idioma.

## Os modelos

Quem constrói a tabela — o nível Gerenciamento — os escreve, a partir da ficha de uma linha:
**Documento PDF › Modelos de documento…**. Um modelo é uma página (A4 ou Letter, retrato ou
paisagem), um idioma para os valores, um rodapé e uma sequência de blocos:

| Bloco | O que ele mostra |
|---|---|
| **Texto** | texto formatado — títulos, negrito, listas, links — que cita as colunas da linha com o menu **Coluna**: “Fatura `{{numero}}` de `{{date}}`” |
| **Campos da linha** | os campos escolhidos, ou todos: rótulo à esquerda, valor à direita |
| **Tabela das linhas vinculadas** | as linhas que apontam para esta — as linhas de uma fatura — ou as que um vínculo múltiplo designa, com as colunas escolhidas e seus **totais** |
| **Quebra de página** | a continuação em uma nova página |

O editor mostra ao lado o PDF que o modelo faz da linha aberta, incluindo as alterações.

Os valores são escritos **no idioma do modelo**: um valor com sua moeda (“1.234,50 €”),
uma data por extenso (“30 de setembro de 2026”), sim e não, o rótulo de uma opção, o nome
de uma pessoa. O texto é composto em fontes embutidas que cobrem os vinte idiomas do basedb,
ideogramas incluídos.

## Cada um com suas permissões

Um documento é lido **com as permissões de quem o imprime**: um campo oculto para essa pessoa
não aparece nele, uma linha vinculada que ela não vê não entra na tabela — nem no total. Duas
pessoas podem, portanto, obter dois documentos diferentes da mesma linha: cada uma tem o seu.

## Pela API

```bash
# O PDF de uma linha com um modelo, ou a "ficha"
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lista os modelos da tabela.

## Limites

- Sem imagem (logotipo) nem cor escolhida em um documento, sem cabeçalho diferente do rodapé.
- Um documento por linha: ainda não há PDF de várias linhas, nem geração por uma automação.
