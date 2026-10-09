---
title: API REST
description: Ler e escrever as linhas do basedb a partir de um programa.
---

A API REST é a mesma que a interface usa: **não existe rota privada**.
Suas URLs levam os nomes físicos — os mesmos que você lê em SQL.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Um token

Na interface, menu **⋯** da base → **API e agentes** → **Tokens de API e MCP…**: quem tem o nível
**Gerenciamento** na base, ou no seu projeto, cria ali um **token de integração** limitado a
essa base — todos os ambientes dela, ou apenas um —, somente para leitura por padrão, depois de
confirmar a sua senha — uma conta sem senha, que entra por um provedor de identidade, ainda não
pode fazer isso. Ele só é exibido uma vez; coloque-o em uma variável de ambiente.

Um token lê; cria e altera se tiver sido criado com escrita, e **exclui se tiver sido criado para
isso** — permissões “Leitura, escrita e exclusão”, exceto uma linha que uma relação em cascata
levaria junto com outras. Ele nunca tem mais permissões do que a pessoa que o criou.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Escolher o ambiente

Uma base que tem vários [ambientes](/basedb/pt-br/fonctionnalites/environnements/) — produção,
homologação… — continua sendo **uma** base para um token criado para toda a base. O caminho nomeia a
base pelo nome da produção dela, e o cabeçalho `X-Basedb-Environment` escolhe o ambiente:

```bash
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  -H "X-Basedb-Environment: recette"
```

- Sem o cabeçalho, vale o ambiente que o caminho nomeia: `b_t4z56fq_ventes` é a produção,
  `b_t4z56fq_ventes_recette` a homologação — as duas grafias continuam válidas.
- `?environment=recette` faz o mesmo para um cliente que não envia cabeçalho.
- Um ambiente é nomeado pelo selo dele, sem diferenciar maiúsculas de minúsculas nem acentos, ou por
  `production`. Um ambiente que a base não tem responde `404`, como qualquer recurso ausente.
- `GET /api/v1/<tenant>/meta/bases` lista cada ambiente com seu bloco `environment`
  (`label`, `production`); com o cabeçalho, lista apenas aquele.

Um token limitado a um único ambiente, na criação, não abre nenhum outro: o cabeçalho não muda nada.
As permissões dele são sempre intersectadas, ambiente por ambiente, com as da pessoa que o criou.

## Ler

| Parâmetro | Função |
|---|---|
| `filter` | uma expressão legível: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | as colunas a retornar |
| `limit`, `after` | paginação por cursor criptografado: `meta.next_cursor` de uma página, passado em `after`, dá a seguinte (`meta.has_next_page`) |
| `links=display` | as relações com seu valor de exibição |
| `count=exact` | o total, limitado a 100.000 |
| `variables=raw` | os textos longos tal como foram escritos, incluindo `{{colonne}}`, em vez de com os [valores da linha](/basedb/pt-br/fonctionnalites/tables-et-champs/#texto-formatado-e-variáveis) |

Os operadores: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, combinados por `and`, `or`, `not` e parênteses. Um
filtro atravessa uma relação: `clients_id.ville eq "Lyon"`.

## Escrever

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` altera uma linha com o mesmo corpo `{"values": {…}}`. Os
erros têm um formato único: `{ "code": "…", "details": {…}, "request_id": "…" }`, com um
código estável por causa.

Cada escrita retorna o cabeçalho `x-basedb-transaction`: passá-lo para
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`) a desfaz, como Ctrl+Z na
interface — recusado se a linha tiver sido alterada desde então.

## Além das linhas

Com o mesmo token:

| Rota | Função |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | resumos sobre todas as linhas de um filtro: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | ler e escrever os comentários de uma linha |
| `POST /api/v1/<tenant>/automations/<id>/run` | disparar uma automação acionada por um botão, em uma linha (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | os painéis de uma base |
| `GET /api/v1/<tenant>/meta/users` | os membros do espaço de trabalho, para um campo Pessoa |
| `GET /api/v1/<tenant>/meta/templates` | os modelos de base da galeria |
| `GET /api/v1/<tenant>/events?base=<base>&table=<table>` | acompanhar uma tabela em tempo real: sinais, relidos depois pelas rotas acima (veja [Webhooks](/basedb/pt-br/integrations/webhooks/#sem-webhook-acompanhar-uma-tabela)) |

As [visões compartilhadas](/basedb/pt-br/fonctionnalites/vues-partagees/) são lidas sem conta:
`GET /api/v1/views/<jeton>` e `…/rows` em JSON, `…/calendar.ics` em iCalendar.

Construir — criar uma automação, um painel, uma integração — continua reservado a
uma sessão da interface: um token lê e escreve linhas, ele não muda a base.

## Cores e ícones

Uma tabela e cada opção de uma lista de seleção têm uma cor (`color`, `#rrggbb`) e um ícone
(`icon`, o nome de um ícone [Lucide](https://lucide.dev/icons/) que a interface desenha: `truck`,
`circle-check`, `flame`…). `GET …/meta/bases/<base>` os retorna para a base, suas tabelas e as
opções de seus campos.

Para escolhê-los, use o token de acesso de uma pessoa que pode alterar a estrutura
(`POST /auth/session/access`) — um token de integração não muda a base:

| Rota | Corpo |
|---|---|
| `POST …/admin/bases/<base>/tables` | `{"label": "Tickets", "color": "#dc2626", "icon": "flame", "fields": […]}` |
| `PATCH …/admin/bases/<base>/tables/<table>` | `{"color": "#2563eb", "icon": "inbox"}` — as três chaves `color`, `icon`, `image` viajam juntas: nomear uma substitui as três |
| `POST …/admin/bases/<base>/tables/<table>/fields` | `{"label": "Priorité", "kind": "select", "options": [{"value": "haute", "color": "#dc2626", "icon": "flame"}, …]}` |
| `PUT …/admin/bases/<base>/tables/<table>/fields/<champ>/options` | a lista inteira das opções, na ordem, cada uma com sua cor e seu ícone |

Um agente passa pelo [servidor MCP](/basedb/pt-br/integrations/mcp/#cores-e-ícones), onde ele
**propõe** essas alterações. Um campo não tem ícone para escolher: a interface desenha o do seu
tipo.

## Criar uma base a partir de um modelo

Um aplicativo que se instala cria sua base em **uma única chamada**: o servidor aplica o modelo —
tabelas, campos, relações, linhas de exemplo, visões, painéis, automações — e, se
uma etapa falhar, não deixa nenhuma base para trás.

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/admin/bases" \
  -H "Authorization: Bearer $ACCES" -H "content-type: application/json" \
  -d '{"template": "crm", "label": "Ventes", "rows": false}'
```

`template` é a chave de um modelo da galeria, ou um modelo completo no
[formato dos modelos](/basedb/pt-br/fonctionnalites/modeles/). Com o cabeçalho
`Accept: application/x-ndjson`, a resposta chega linha a linha: uma linha `{"step": …}` por
etapa, e depois a base criada. Essa chamada exige o token de acesso de uma pessoa que pode criar
uma base (`POST /auth/session/access`, após o login): um token de integração só abre uma base
existente.

## Verificar um token

Os tokens do basedb não são verificados fora do basedb. Um aplicativo que recebe um —
uma ferramenta aberta a partir do basedb com o token da pessoa, por exemplo — pergunta o que ele
vale (introspecção, RFC 7662), com seu próprio token de integração:

```bash
curl -X POST "http://localhost:3000/auth/introspect" \
  -H "Authorization: Bearer $BASEDB_TOKEN" \
  --data-urlencode "token=$JETON_RECU"
```

```json
{ "active": true, "token_type": "access_token",
  "sub": "0195a…", "email": "claire@example.com", "name": "Claire Martin",
  "tenant": "t4z56fq", "groups": ["Commerciaux"], "exp": 1790000000 }
```

Qualquer token que não valha — desconhecido, expirado, revogado, sessão encerrada, outro espaço de trabalho — responde
`{"active": false}`, sem dizer por quê. A resposta é lida em tempo real: uma desconexão é vista
na hora. Para um token de integração, a resposta também informa a base que ele abre (`base`, a
produção dela), se ele abre todos os ambientes (`environments`: `all`) ou apenas um (`one`), seu
acesso (`read`, `write` ou `delete`) e suas superfícies.

## A documentação gerada

Cada base tem sua página **Documentação de API e MCP**: para cada tabela, seus endpoints, suas
colunas, exemplos em cURL e em JavaScript. Ela é **filtrada pelas suas permissões** — dois
leitores obtêm duas versões —, escrita **no idioma da sua tela**, e existe também em OpenAPI 3.1
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`), que declara o token Bearer e o cabeçalho
`X-Basedb-Environment`. Os nomes, os caminhos e os códigos de erro continuam os mesmos em todos os
idiomas.

![A documentação gerada de uma base](../../../../assets/screens/pt-br/documentation-api.webp)
