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

Für einen **Server Ihres Netzwerks** benennt ihn der Betreiber der Instanz in
`BASEDB_WEBHOOK_ALLOW` – ein Name, eine Domain (`*.intra.example.com`), eine Adresse oder ein
Bereich (`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Diese Ziele werden unabhängig von ihrer Adresse, ihrem Port und ihrem Schema akzeptiert, HTTP
eingeschlossen. Die Liste gilt auch für die HTTP-Anfragen der Automatisierungen und die Quellen
der synchronisierten Tabellen; sie wird in der Umgebung eingestellt, nie über die Oberfläche.

## Ohne Webhook: eine Tabelle verfolgen

Ein Server, der nicht erreichbar ist, kann sich auch mit basedb **verbinden** und eine Tabelle
über den Echtzeit-Datenstrom verfolgen, mit einem Integrationstoken der Datenbank:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Der Datenstrom (`text/event-stream`) trägt **Signale** – das Ereignis `records`, mit den
Kennungen der angelegten, geänderten oder gelöschten Zeilen –, niemals die Werte: Das Programm
liest diese Zeilen anschließend über die [REST-API](/basedb/de/integrations/api-rest/) erneut.
Ein widerrufenes Token schließt seinen Datenstrom innerhalb von 20 Sekunden. Für eine selten
gelesene Tabelle genügt es, die geänderten Zeilen von Zeit zu Zeit erneut zu lesen:
`filter=_updated_at gt "2026-09-30T08:00:00Z"`.
