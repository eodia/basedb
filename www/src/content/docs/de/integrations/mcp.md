---
title: MCP-Server
description: Einen KI-Agenten über das Model Context Protocol an basedb anbinden.
---

basedb stellt einen **MCP-Server** bereit (`POST /mcp`, unter derselben Adresse wie die Oberfläche):
Ein Agent – Claude, ein Coding-Assistent, Ihr eigener Agent – entdeckt dort die Datenbanken, liest
und schreibt Zeilen und **schlägt** Strukturänderungen **vor**.

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

## Die zwölf Werkzeuge

| Werkzeug | Rolle |
|---|---|
| `whoami` | wer der Agent ist und mit welchen Berechtigungen |
| `list_bases`, `describe_base`, `describe_table` | die Struktur und ihre Beschreibungen entdecken |
| `list_records`, `get_record`, `lookup_records` | lesen, filtern, einen Anzeigewert auflösen |
| `create_record`, `update_record` | Zeilen schreiben |
| `propose_create_table`, `propose_add_field`, `get_proposal` | eine Strukturänderung vorschlagen |

## Was ein Agent nicht tut

- **Er löscht nichts.**
- **Er ändert die Struktur nicht**: Er schlägt sie vor. Der Vorschlag wartet unter **Vorschläge der
  Agenten …** (Menü der Datenbank), wo eine Person, die die Struktur verwaltet, ihn genehmigt oder
  ablehnt; ohne Entscheidung läuft er nach 24 Stunden ab.
- **Er hat nie mehr Berechtigungen** als die Person, die sein Token angelegt hat: Die Berechtigungen
  des Tokens werden mit ihren geschnitten.
- Er sieht weder die Felder, die für Agenten als unsichtbar markiert sind, noch die Datenbanken, die
  für MCP gesperrt sind.

Jeder Aufruf wird anhand der Form seiner Parameter protokolliert, nie anhand ihrer Werte.
