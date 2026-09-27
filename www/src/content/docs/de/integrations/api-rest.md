---
title: REST-API
description: Die Zeilen von basedb aus einem Programm lesen und schreiben.
---

Die REST-API ist dieselbe, die auch die Oberfläche verwendet: **Es gibt keine private Route**.
Ihre URLs tragen die physischen Namen – dieselben, die Sie auch in SQL lesen.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Ein Token

In der Oberfläche, Menü **⋯** der Datenbank → **API und Agenten** → **API- und MCP-Token …**: Dort
legen Sie ein **Integrationstoken** an, das auf diese Datenbank beschränkt und standardmäßig
schreibgeschützt ist, nachdem Sie Ihr Passwort bestätigt haben. Es wird nur einmal angezeigt;
legen Sie es in einer Umgebungsvariablen ab.

Ein Token liest, legt an und ändert, wenn es mit Schreibrecht angelegt wurde, **löscht nie** und hat
nie mehr Berechtigungen als die Person, die es angelegt hat.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Lesen

| Parameter | Rolle |
|---|---|
| `filter` | ein lesbarer Ausdruck: `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | die zurückzugebenden Spalten |
| `limit`, `cursor` | Paginierung über einen verschlüsselten Cursor (`next_cursor` in der Antwort) |
| `links=display` | die Verknüpfungen mit ihrem Anzeigewert |
| `count=exact` | die Gesamtzahl, gedeckelt bei 100 000 |
| `variables=raw` | die Langtexte so, wie sie geschrieben wurden, `{{colonne}}` eingeschlossen, statt mit den [Werten der Zeile](/basedb/de/fonctionnalites/tables-et-champs/#formatierter-text-und-variablen) |

Die Operatoren: `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, kombiniert mit `and`, `or`, `not` und Klammern. Ein Filter
geht durch eine Verknüpfung hindurch: `clients_id.ville eq "Lyon"`.

## Schreiben

```bash
curl -X POST "http://localhost:3000/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` ändert eine Zeile mit demselben Body `{"values": {…}}`. Fehler haben eine
einheitliche Form: `{ "code": "…", "details": {…}, "request_id": "…" }`, mit einem stabilen Code
pro Ursache.

Jeder Schreibvorgang gibt den Header `x-basedb-transaction` zurück: Übergeben an
`POST /api/v1/<tenant>/history/undo` (`{"transaction": "…"}`), macht er ihn rückgängig, wie Strg+Z
in der Oberfläche – abgelehnt, wenn die Zeile inzwischen geändert wurde.

## Über die Zeilen hinaus

Mit demselben Token:

| Route | Rolle |
|---|---|
| `GET …/data/<base>/<table>/aggregate` | Zusammenfassungen über alle Zeilen eines Filters: `aggregates=montant:sum,nom:filled`, `group=statut` |
| `GET …/data/<base>/<table>/<_id>/comments`, `POST` | die Kommentare einer Zeile lesen und schreiben |
| `POST /api/v1/<tenant>/automations/<id>/run` | eine per Schaltfläche ausgelöste Automatisierung auf einer Zeile starten (`{"record": "…"}`) |
| `GET /api/v1/<tenant>/meta/bases/<base>/dashboards` | die Dashboards einer Datenbank |
| `GET /api/v1/<tenant>/meta/users` | die Mitglieder des Arbeitsbereichs, für ein Feld Person |
| `GET /api/v1/<tenant>/meta/templates` | die Datenbankvorlagen der Galerie |

Die [freigegebenen Ansichten](/basedb/de/fonctionnalites/vues-partagees/) lassen sich ohne Konto
lesen: `GET /api/v1/views/<jeton>` und `…/rows` als JSON, `…/calendar.ics` als iCalendar.

Aufbauen – eine Automatisierung, ein Dashboard, eine Integration anlegen – bleibt einer Sitzung in
der Oberfläche vorbehalten: Ein Token liest und schreibt Zeilen, es ändert nicht die Datenbank.

## Die generierte Dokumentation

Jede Datenbank hat ihre Seite **API- und MCP-Dokumentation**: für jede Tabelle ihre Endpunkte, ihre
Spalten, Beispiele in cURL und JavaScript. Sie ist **nach Ihren Berechtigungen gefiltert** – zwei
Lesende erhalten zwei Fassungen –, geschrieben **in der Sprache Ihres Bildschirms**, und existiert
auch als OpenAPI 3.1 (`/api/v1/<tenant>/meta/bases/<base>/openapi.json`). Die Namen, die Pfade und
die Fehlercodes bleiben in allen Sprachen gleich.

![Die generierte Dokumentation einer Datenbank](../../../../assets/screens/documentation-api.png)
