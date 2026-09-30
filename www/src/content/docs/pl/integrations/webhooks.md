---
title: Webhooki
description: Powiadamiaj inny system przy każdym utworzeniu, zmianie lub usunięciu.
---

Webhook wysyła na adres HTTPS **zdarzenia** z jednej lub kilku tabel:
`record.created`, `record.updated`, `record.deleted`. Zarządza się nimi z **Webhooki…** w menu
bazy, w **API i agenci**.

## Ładunek

Treść jest zawsze **tablicą zdarzeń**, każde z pełnym wierszem **przed** i **po** oraz listą
zmienionych pól:

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

Nawet zapis wykonany w bezpośrednim SQL generuje swoje zdarzenie: zdarzenia wychodzą z
historii, rejestrowanej przez wyzwalacz.

## Podpis, kolejność, ponowienia

- **Podpisane**: `X-Basedb-Signature: t=…,v1=…`, HMAC-SHA256 surowej treści, do sprawdzenia
  przed deserializacją.
- **Uporządkowane** według wiersza: dwa zdarzenia tego samego wiersza docierają po kolei.
- **Ponawiane** w razie niepowodzenia; po przekroczeniu limitu webhook jest wyłączany i można
  go ponownie włączyć z interfejsu. Kolejkę i każde dostarczenie można przeglądać, ponawiać lub
  porzucać.
- Dostarczanie **co najmniej raz**: usuwaj duplikaty według `X-Basedb-Delivery-Id` lub
  `events[].id`.

## Adresy docelowe

Webhooki są wysyłane tylko na **publiczne adresy HTTPS**. W środowisku deweloperskim
`BASEDB_WEBHOOK_DEV=1` akceptuje HTTP i adresy lokalne.

Dla **serwera z twojej sieci** administrator instancji podaje go w
`BASEDB_WEBHOOK_ALLOW` – nazwa, domena (`*.intra.example.com`), adres lub zakres
(`10.12.0.0/16`):

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Te cele są przyjmowane niezależnie od ich adresu, portu i schematu, HTTP włącznie. Lista
obejmuje też żądania HTTP automatyzacji i źródła tabel synchronizowanych; ustawia się ją w
środowisku, nigdy z interfejsu.

## Bez webhooka: śledzenie tabeli

Serwer, z którym nie można się połączyć, może też **połączyć się** z basedb i śledzić tabelę
przez strumień w czasie rzeczywistym, z tokenem integracji bazy:

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Strumień (`text/event-stream`) przenosi **sygnały** – zdarzenie `records`, z identyfikatorami
utworzonych, zmienionych lub usuniętych wierszy –, nigdy wartości: program odczytuje potem te
wiersze przez [API REST](/basedb/pl/integrations/api-rest/). Unieważniony token zamyka swój
strumień w ciągu 20 sekund. Dla tabeli czytanej rzadko wystarczy od czasu do czasu odczytać
zmienione wiersze: `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
