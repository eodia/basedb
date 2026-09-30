---
title: Webhooks
description: Notificar outro sistema a cada criação, alteração ou exclusão.
---

Um webhook envia para um endereço HTTPS os **eventos** de uma ou mais tabelas:
`record.created`, `record.updated`, `record.deleted`. Eles são gerenciados em **Webhooks…** no
menu da base, em **API e agentes**.

## A carga útil

O corpo é sempre um **array de eventos**, cada um com a linha **antes** e **depois**,
completas, e a lista dos campos alterados:

```json
{ "events": [
  { "id": "0195e…", "type": "record.updated",
    "occurred_at": "2026-09-26T14:03:00.120Z",
    "tenant": "t4z56fq", "base": "b_t4z56fq_ventes", "table": "opportunites",
    "record_id": "0195a…",
    "actor": { "kind": "user" },
    "before": { "statut": "negociation", "montant": "125000", … },
    "after":  { "statut": "gagne", "montant": "125000", … },
    "changed": ["statut"] } ] }
```

Até uma escrita feita em SQL direto produz o seu evento: eles partem do histórico,
capturado por trigger.

## Assinatura, ordem, novas tentativas

- **Assinado**: `X-Basedb-Signature: t=…,v1=…`, um HMAC-SHA256 do corpo bruto, a verificar antes de
  desserializar.
- **Ordenado** por linha: dois eventos de uma mesma linha chegam em ordem.
- **Reenviado** em caso de falha; além do limite, o webhook é desativado e pode ser reativado pela
  interface. A fila e cada entrega podem ser consultadas, reenviadas ou abandonadas.
- Entrega **pelo menos uma vez**: elimine duplicatas por `X-Basedb-Delivery-Id` ou `events[].id`.

## Destinos

Os webhooks só são enviados para endereços **HTTPS públicos**. Em desenvolvimento,
`BASEDB_WEBHOOK_DEV=1` aceita HTTP e endereços locais.

Para um **servidor da sua rede**, o operador da instância o nomeia em
`BASEDB_WEBHOOK_ALLOW` — um nome, um domínio (`*.intra.example.com`), um endereço ou uma faixa
(`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Esses destinos são aceitos sejam quais forem seu endereço, sua porta e seu esquema, HTTP
incluído. A lista também vale para as requisições HTTP das automações e as fontes das
tabelas sincronizadas; ela é definida no ambiente, nunca pela interface.

## Sem webhook: acompanhar uma tabela

Um servidor que não pode ser alcançado também pode **se conectar** ao basedb e acompanhar uma
tabela pelo fluxo em tempo real, com um token de integração da base:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

O fluxo (`text/event-stream`) transporta **sinais** — o evento `records`, com os
identificadores das linhas criadas, alteradas ou excluídas —, nunca os valores: o programa relê
essas linhas depois pela [API REST](/basedb/pt-br/integrations/api-rest/). Um token revogado
fecha seu fluxo em até 20 segundos. Para uma tabela lida raramente, basta reler de vez em quando
as linhas alteradas: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
