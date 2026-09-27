---
title: Modelos de base
description: Começar de um modelo, pedi-lo à IA, escrever o seu em JSON — e publicá-lo para todas as instâncias.
---

Um **modelo** cria uma base inteira com um clique: suas tabelas e relações, linhas
de exemplo, visões, um painel, automações e campos que a própria IA
preenche. A [galeria de modelos](/basedb/pt-br/modeles/) mostra os que o basedb oferece.

## Começar de um modelo

**Nova base** e depois **Começar de um modelo ou pedir à IA**: a galeria se abre.

![A galeria de modelos, no aplicativo](../../../../assets/screens/modeles.png)

Cada modelo pode ser lido por inteiro antes de ser usado — suas tabelas e seus campos, suas visões,
suas automações e a instrução de cada um de seus campos de IA. **Criar base** pede
o rótulo e, se houver campos de IA, o seu consentimento para que os valores que eles citam
sejam enviados ao provedor de IA da instância. Sem esse consentimento, eles são campos
comuns, preenchidos com seus valores de exemplo.

**Carregar os dados de exemplo**, marcada por padrão, preenche as tabelas com linhas de
exemplo para ver a base em ação. Desmarcada, as tabelas ficam vazias, prontas para os seus
próprios dados — visões, painéis e automações são criados do mesmo jeito.

Um projeto vazio também oferece a **base de demonstração**: uma pequena agência, seus clientes,
projetos, tarefas, faturas e avaliações, que mostra todas as facetas do basedb.

## No seu idioma

Os modelos oficiais são lidos e criados **no idioma da tela**: tabelas, campos, opções, linhas
de exemplo, visões, painéis, automações e instruções da IA. As linhas de exemplo mudam de mundo
com o idioma: a “Boulangerie Martin” de Lyon se torna “Padaria Pão Quente” em São Paulo, em
português do Brasil.

Um modelo importado na sua instância, ou salvo a partir de uma base, foi escrito por alguém: ele
se lê como foi escrito.

## Pedir à IA

No topo da galeria, descreva sua necessidade em uma frase — “o acompanhamento das reclamações dos
meus clientes, com uma análise do tom”. A IA propõe uma base completa: tabelas, linhas
de exemplo verossímeis, visões, painel e campos de IA quando o uso se presta a isso. Você a
lê como um modelo, pode **refiná-la** (“adicione uma tabela de fornecedores”)
e depois criá-la. A IA recebe apenas a sua frase — nenhum dado de nenhuma base — e nada é
criado antes do seu clique.

## Escrever um modelo em JSON

Um modelo é um documento JSON. Este é o esqueleto:

```json
{
  "format": 1,
  "key": "suivi-tickets",
  "label": "Suivi de tickets",
  "summary": "Une phrase pour la galerie.",
  "category": "Produit et technique",
  "icon": "bug",
  "color": "#ef4444",
  "tables": [
    {
      "key": "tickets",
      "label": "Tickets",
      "fields": [
        { "label": "Titre", "kind": "short_text" },
        { "label": "Statut", "kind": "select", "options": ["Nouveau", "En cours", "Résolu"] },
        { "label": "Ouvert le", "kind": "date" },
        { "label": "Description", "kind": "long_text" },
        { "label": "Catégorie", "kind": "select", "options": ["Bug", "Demande"],
          "ai": { "prompt": "Classe ce ticket : {{Titre}} — {{Description}}" } },
        { "label": "Âge (jours)", "kind": "formula", "formula": "JOURS(AUJOURDHUI(); [Ouvert le])" }
      ]
    },
    { "key": "produits", "label": "Produits", "fields": [{ "label": "Nom", "kind": "short_text" }] }
  ],
  "links": [{ "from": "tickets", "label": "Produit", "to": "produits" }],
  "rows": {
    "produits": [{ "$key": "app", "Nom": "Application mobile" }],
    "tickets": [{ "Titre": "Crash au démarrage", "Statut": "En cours", "Ouvert le": "-3d", "Produit": "@app" }]
  },
  "views": [
    { "table": "tickets", "label": "Tableau", "kind": "kanban", "spec": { "group_by": "Statut" } }
  ],
  "dashboards": [
    { "label": "Vue d’ensemble", "blocks": [
      { "kind": "number", "title": "Ouverts", "table": "tickets", "filter": "[Statut] ne \"Résolu\"" },
      { "kind": "chart", "title": "Par catégorie", "table": "tickets", "group_by": "Catégorie", "style": "pie" }
    ] }
  ],
  "automations": []
}
```

As regras essenciais:

- **Tudo é citado pelo rótulo**: um campo em uma visão, um filtro (`[Statut] ne "Résolu"`), uma
  fórmula (`[Prix] * [Quantité]`), uma instrução de IA ou uma mensagem (`{{Titre}}`). Uma opção é
  informada pelo rótulo.
- O **primeiro campo** de uma tabela é o seu campo de exibição: um texto, um número, uma data,
  um e-mail ou um endereço.
- Uma **relação** é declarada em `links`, nunca como um campo; uma linha a referencia por
  `"@clé"`, a `$key` de uma linha da tabela de destino.
- Uma **data** pode ser relativa ao dia em que o modelo é aplicado: `"today"`, `"+3d"`,
  `"-2w"`, `"+1m"`; uma data e hora acrescenta a hora, `"+1d 14:30"`. Uma pessoa é escrita `"$moi"`.
- Um **campo de IA** leva `"ai": { "prompt": "…" }` e pode receber um valor de exemplo, escrito
  somente quando a IA não é usada.
- Um modelo **nunca** contém compartilhamento, permissão, webhook, arquivo ou pessoa
  além de `"$moi"`: às vezes ele vem de fora e não deve abrir nada.

A referência completa — todos os tipos de campo, todas as chaves de visões, os limites — está no
capítulo 20 da documentação de arquitetura, no repositório.

## Publicar um modelo para todas as instâncias

Os modelos da galeria oficial são os arquivos da pasta
[`packages/templates/catalog`](https://github.com/eodia/basedb/tree/main/packages/templates/catalog)
do repositório, um arquivo por modelo, com o nome da sua `key`. O site público os transforma na
[galeria](/basedb/pt-br/modeles/) e publica o catálogo inteiro no endereço
[`/basedb/modeles/catalogue.json`](/basedb/modeles/catalogue.json). Cada instância o lê
quando alguém abre a galeria e o guarda por uma hora: alterar um arquivo e republicar o
site basta para mudar a galeria de todas as instâncias.

Cada modelo é verificado na construção do site, pelo mesmo validador do servidor:
um modelo inválido faz a construção falhar em vez de chegar aos usuários.

Um modelo oficial é escrito uma vez, em francês. Seus textos em outro idioma são um
dicionário,
[`packages/templates/i18n/<langue>/<clé>.json`](https://github.com/eodia/basedb/tree/main/packages/templates/i18n)
— o texto em francês, seguido da sua tradução —, que o site publica ao lado do catálogo
(`/basedb/modeles/i18n/<langue>.json`). A instância passa cada texto por ele e acompanha cada
rótulo onde ele é citado — fórmulas, filtros, visões, instruções —, e então relê o resultado: um
dicionário que quebrasse o modelo não é servido, o modelo em francês é. Um texto ausente do
dicionário permanece em francês.

A instância lê o endereço `BASEDB_TEMPLATES_URL` — por padrão, o do site público. Aponte-o
para um catálogo seu, ou defina `off` para não ler nenhum: a instância então serve os
modelos integrados à sua versão.

## Os modelos da sua instância

Um administrador pode **importar um modelo JSON** na sua instância, pela galeria
(“Importar um JSON”): ele entra na galeria de todos os usuários e substitui um modelo
com a mesma chave. Uma proposta da IA pode ser adicionada a ela com um clique.

Qualquer base também pode se tornar um modelo: **Salvar como modelo** no menu da
base, em **Outras ações**. Suas tabelas, campos, instruções de IA, relações, visões compartilhadas, painéis e
automações — e, se você quiser, até 50 linhas por tabela — são baixados em
JSON, prontos para entrar no catálogo oficial ou no da instância. Uma automação que
busca uma linha, segue ramificações ou cita uma etapa anterior fica de fora por
enquanto, e a tela informa isso.
