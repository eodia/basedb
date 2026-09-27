---
title: API REST
description: Leggere e scrivere le righe di basedb da un programma.
---

L’API REST è la stessa che usa l’interfaccia: **non esiste alcuna route privata**.
I suoi URL riportano i nomi fisici — quelli che leggi anche in SQL.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Un token

Nell’interfaccia, menu **⋯** del database → **API e agenti** → **Token API e MCP…**: qui si crea un **token
di integrazione** limitato a questo database, in sola lettura per impostazione predefinita, dopo aver confermato la propria
password. Viene mostrato una sola volta; mettilo in una variabile d’ambiente.

Un token legge, crea e modifica se è stato creato in scrittura, **non elimina mai**, e non ha mai
più permessi della persona che l’ha creato.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Leggere

| Parametro | Ruolo |
|---|---|
| `filter` | un’espressione leggibile: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | le colonne da restituire |
| `limit`, `cursor` | paginazione tramite cursore cifrato (`next_cursor` nella risposta) |
| `links=display` | le relazioni con il loro valore visualizzato |
| `count=exact` | il totale, con un tetto di 100.000 |
| `variables=raw` | i testi lunghi così come sono scritti, `{{colonne}}` compreso, anziché con i [valori della riga](/basedb/it/fonctionnalites/tables-et-champs/#testo-formattato-e-variabili) |

Gli operatori: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, combinati con `and`, `or`, `not` e parentesi. Un
filtro attraversa una relazione: `clients_id.ville eq "Lyon"`.

## Scrivere

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` modifica una riga con lo stesso corpo `{"values": {…}}`. Gli
errori hanno una forma unica: `{ "code": "…", "details": {…}, "request_id": "…" }`, con un
codice stabile per ogni causa.

Ogni scrittura restituisce l’intestazione `x-basedb-transaction`: passarla a
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`) la annulla, come Ctrl+Z
nell’interfaccia — con un rifiuto se la riga è stata modificata nel frattempo.

## Oltre le righe

Con lo stesso token:

| Route | Ruolo |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | riepiloghi su tutte le righe di un filtro: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | leggere e scrivere i commenti di una riga |
| `POST /api/v1/<tenant>/automations/<id>/run` | avviare un’automazione attivata da un pulsante, su una riga (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | le dashboard di un database |
| `GET /api/v1/<tenant>/meta/users` | i membri dello spazio di lavoro, per un campo Persona |
| `GET /api/v1/<tenant>/meta/templates` | i modelli di database della galleria |

Le [viste condivise](/basedb/it/fonctionnalites/vues-partagees/) si leggono senza account:
`GET /api/v1/views/<jeton>` e `…/rows` in JSON, `…/calendar.ics` in iCalendar.

Costruire — creare un’automazione, una dashboard, un’integrazione — resta riservato a
una sessione dell’interfaccia: un token legge e scrive righe, non modifica il database.

## La documentazione generata

Ogni database ha la sua pagina **Documentazione API e MCP**: per ogni tabella, i suoi endpoint, le sue
colonne, esempi in cURL e in JavaScript. È **filtrata in base ai tuoi permessi** — due
lettori ne ottengono due versioni — ed esiste anche in OpenAPI 3.1
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`).

![La documentazione generata di un database](../../../../assets/screens/documentation-api.png)
