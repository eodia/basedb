---
title: Webhooks
description: Avisar a otro sistema en cada creación, modificación o eliminación.
---

Un webhook envía a una dirección HTTPS los **eventos** de una o varias tablas:
`record.created`, `record.updated`, `record.deleted`. Se gestionan desde **Webhooks…** en el
menú de la base, en **API y agentes**.

## La carga útil

El cuerpo es siempre un **array de eventos**, cada uno con la fila **antes** y **después**,
completas, y la lista de los campos cambiados:

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

Incluso una escritura hecha en SQL directo produce su evento: los eventos parten del historial,
que captura un disparador.

## Firma, orden, reintentos

- **Firmado**: `X-Basedb-Signature: t=…,v1=…`, un HMAC-SHA256 del cuerpo sin procesar, que hay que verificar antes de
  deserializar.
- **Ordenado** por fila: dos eventos de una misma fila llegan en orden.
- **Reintentado** en caso de fallo; superado el límite, el webhook se desactiva y se reactiva desde
  la interfaz. La cola y cada entrega se pueden consultar, volver a enviar o abandonar.
- Entrega **al menos una vez**: deduplica con `X-Basedb-Delivery-Id` o `events[].id`.

## Destinos

Los webhooks solo se envían a direcciones **HTTPS públicas**. En desarrollo,
`BASEDB_WEBHOOK_DEV=1` acepta HTTP y las direcciones locales.
