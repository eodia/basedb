---
title: Webhooks
description: Ein anderes System bei jedem Anlegen, Ändern oder Löschen benachrichtigen.
---

Ein Webhook sendet die **Ereignisse** einer oder mehrerer Tabellen an eine HTTPS-Adresse:
`record.created`, `record.updated`, `record.deleted`. Verwaltet werden sie über **Webhooks …** im
Menü der Datenbank, unter **API und Agenten**.

## Die Nutzlast

Der Body ist immer ein **Array von Ereignissen**, jedes mit der vollständigen Zeile **vorher** und
**nachher** und der Liste der geänderten Felder:

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

Selbst ein Schreibvorgang in direktem SQL erzeugt sein Ereignis: Sie gehen vom Verlauf aus, den ein
Trigger erfasst.

## Signatur, Reihenfolge, Wiederholungen

- **Signiert**: `X-Basedb-Signature: t=…,v1=…`, ein HMAC-SHA256 des rohen Bodys, vor dem
  Deserialisieren zu prüfen.
- **Geordnet** pro Zeile: Zwei Ereignisse derselben Zeile kommen in der richtigen Reihenfolge an.
- **Wiederholt** bei Fehlschlag; darüber hinaus wird der Webhook deaktiviert und lässt sich in der
  Oberfläche wieder aktivieren. Die Warteschlange und jede Zustellung lassen sich einsehen, erneut
  senden oder verwerfen.
- Zustellung **mindestens einmal**: Deduplizieren Sie anhand von `X-Basedb-Delivery-Id` oder
  `events[].id`.

## Ziele

Webhooks gehen nur an **öffentliche HTTPS-Adressen**. In der Entwicklung akzeptiert
`BASEDB_WEBHOOK_DEV=1` HTTP und lokale Adressen.
