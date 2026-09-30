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

Para un **servidor de tu red**, quien administra la instancia lo nombra en
`BASEDB_WEBHOOK_ALLOW` —un nombre, un dominio (`*.intra.example.com`), una dirección o un rango
(`10.12.0.0/16`)—:

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Estos destinos se aceptan sea cual sea su dirección, su puerto y su esquema, HTTP incluido. La
lista también vale para las solicitudes HTTP de las automatizaciones y las fuentes de las tablas
sincronizadas; se configura en el entorno, nunca desde la interfaz.

## Sin webhook: seguir una tabla

Un servidor al que no se puede llegar también puede **conectarse** a basedb y seguir una tabla
por el flujo en tiempo real, con un token de integración de la base:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

El flujo (`text/event-stream`) lleva **señales** —el evento `records`, con los identificadores
de las filas creadas, modificadas o eliminadas—, nunca los valores: el programa vuelve a leer
después esas filas con la [API REST](/basedb/es/integrations/api-rest/). Un token revocado
cierra su flujo en los 20 segundos siguientes. Para una tabla que se lee raras veces, basta con
volver a leer de vez en cuando las filas cambiadas: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
