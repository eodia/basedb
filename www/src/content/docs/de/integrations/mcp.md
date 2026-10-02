---
title: MCP-Server
description: Einen KI-Agenten über das Model Context Protocol an basedb anbinden.
---

basedb stellt einen **MCP-Server** bereit (`POST /mcp`, unter derselben Adresse wie die Oberfläche):
Ein Agent – Claude, ein Coding-Assistent, Ihr eigener Agent – entdeckt dort die Datenbanken, liest
und schreibt Zeilen, löscht sie, wenn Sie es ihm erlauben, und **schlägt** Strukturänderungen
**vor**.

## Einen Agenten anbinden

Legen Sie über **API- und MCP-Token …** (Menü der Datenbank, unter **API und Agenten**) ein Token
an, mit angehaktem MCP-Zugriff. Dasselbe Token dient für die REST-API und für MCP.

Für einen Client, der HTTP spricht, lautet die Adresse `http://localhost:3000/mcp` mit
`Authorization: Bearer <jeton>`. Für einen Client, der Prozesse startet (stdio), liefert das
Repository ein Relay mit, das das Token aus einer Umgebungsvariablen liest – nie aus der
Konfiguration:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

## Die vierzehn Werkzeuge

| Werkzeug | Rolle |
|---|---|
| `whoami` | wer der Agent ist und mit welchen Berechtigungen |
| `list_bases`, `describe_base`, `describe_table` | die Struktur und ihre Beschreibungen entdecken |
| `list_records`, `get_record`, `lookup_records` | lesen, filtern, einen Anzeigewert auflösen |
| `create_record`, `update_record` | Zeilen schreiben |
| `delete_record`, `restore_record` | eine Zeile löschen — mit einem dafür angelegten Token — und sie zurückholen |
| `propose_create_table`, `propose_add_field`, `get_proposal` | eine Strukturänderung vorschlagen |

## Zeilen löschen

Ein Token, das mit den Rechten **Lesen, Schreiben und Löschen** angelegt wurde, erlaubt dem
Agenten, Zeilen zu löschen, **eine nach der anderen**, über ihre `_id`. `delete_record` liefert
die Zeile, wie sie war, und die Löschung wird im Namen des Tokens im Verlauf festgehalten;
`restore_record` bringt die Zeile unter ihrer `_id` zurück — der Agent macht seinen Fehler selbst
ungeschehen, und eine Person kann das auch aus dem Verlauf tun.

Der Agent löscht nicht:

- mit einem Token in Lesen oder in Lesen und Schreiben: Die Ablehnung sagt, welches Token zu
  erstellen ist;
- eine Zeile, die über eine Verknüpfung mit Kaskade andere mitnehmen würde
  (`TOKEN_CASCADE_FORBIDDEN`): Diese Löschung erfolgt in der Oberfläche, durch eine Person, die
  sieht, was sie mitnimmt;
- mehrere Zeilen auf einmal: Das tut kein Werkzeug.

## Was ein Agent nicht tut

- **Er löscht nur mit Ihrer Zustimmung**: ein dafür angelegtes Token, eine Zeile auf einmal.
- **Er ändert die Struktur nicht**: Er schlägt sie vor. Der Vorschlag wartet unter **Vorschläge der
  Agenten …** (Menü der Datenbank), wo eine Person, die die Struktur verwaltet, ihn genehmigt oder
  ablehnt; ohne Entscheidung läuft er nach 24 Stunden ab.
- **Er hat nie mehr Berechtigungen** als die Person, die sein Token angelegt hat: Die Berechtigungen
  des Tokens werden mit ihren geschnitten.
- Er sieht weder die Felder, die für Agenten als unsichtbar markiert sind, noch die Datenbanken, die
  für MCP gesperrt sind.

Jeder Aufruf wird anhand der Form seiner Parameter protokolliert, nie anhand ihrer Werte.
