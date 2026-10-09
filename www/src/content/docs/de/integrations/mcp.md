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
an, mit angehaktem MCP-Zugriff. Dasselbe Token dient für die REST-API und für MCP und öffnet **die
ganze Datenbank**: ihre Produktion und ihre anderen Umgebungen (siehe weiter unten).

Legen Sie das Token in einer Umgebungsvariablen ab, `BASEDB_TOKEN`, nie in einer
Konfigurationsdatei. Ein Client, der MCP über HTTP spricht – unter anderem Claude Code –, wendet
sich direkt an `…/mcp` mit dem Header `Authorization: Bearer <jeton>`. Mit Claude Code:

```bash
claude mcp add --transport http --scope project basedb "http://localhost:3000/mcp" \
  --header 'Authorization: Bearer ${BASEDB_TOKEN}'
```

Der Befehl schreibt die Datei `.mcp.json` des Projekts, in der `${BASEDB_TOKEN}` ein Verweis auf die
Variable bleibt: Das Token selbst steht dort nicht.

```json
{
  "mcpServers": {
    "basedb": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
    }
  }
}
```

Ein Client, der nur lokale Programme (stdio) starten kann, nutzt das Relay des Repositorys, das das
Token aus der Variable liest, die `--token-env` nennt:

```bash
claude mcp add basedb -- node <dépôt basedb>/apps/mcp/dist/relay.js \
  --url http://localhost:3000/mcp --token-env BASEDB_TOKEN
```

Bitten Sie anschließend den Agenten, `whoami` aufzurufen: Er sagt, wer das Token angelegt hat, welche
Datenbank es öffnet, welche Umgebungen und welche Berechtigungen.

## Die Umgebung wählen

Eine Datenbank kann mehrere [Umgebungen](/basedb/de/fonctionnalites/environnements/) haben –
Produktion, Staging, Entwicklung –, jede mit eigenen Tabellen und Zeilen. Ein Token für die ganze
Datenbank öffnet sie alle, und die Umgebung wird gewählt, vom Allgemeinsten zum Genauesten:

- **der Name der Datenbank**, sonst nichts: `crm` ist die Produktion, `crm_recette` das Staging;
- **die Adresse des Servers**: `…/mcp?environment=recette` zielt für die ganze Verbindung auf das
  Staging. Das Relay tut dasselbe mit `--environment recette`. So trägt man einen Server pro
  Umgebung ein, alle mit demselben Token:

  ```json
  {
    "mcpServers": {
      "basedb": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      },
      "basedb-recette": {
        "type": "http",
        "url": "http://localhost:3000/mcp?environment=recette",
        "headers": { "Authorization": "Bearer ${BASEDB_TOKEN}" }
      }
    }
  }
  ```

- **das Argument `environment`** jedes Werkzeugs, das eine Datenbank benennt, für einen einzelnen
  Aufruf: `list_records` mit `{"base": "crm", "table": "clients", "environment": "recette"}`.

Eine Umgebung wird mit ihrem Badge benannt, ohne Beachtung der Groß- und Kleinschreibung und der
Akzente (`Recette`, `recette`, `developpement` für „Développement“), oder mit `production`. `whoami`
listet die Umgebungen, die das Token öffnet; `list_bases` und `describe_base` sagen, zu welcher
Umgebung jede Datenbank gehört.

Ein Token kann bei seiner Erstellung auch auf eine einzige Umgebung beschränkt werden: Es sieht dann
keine andere.

## Die fünfzehn Werkzeuge

| Werkzeug | Rolle |
|---|---|
| `whoami` | wer der Agent ist, mit welchen Berechtigungen, auf welchen Umgebungen |
| `list_bases`, `describe_base`, `describe_table` | die Struktur, ihre Beschreibungen und ihre Darstellung entdecken |
| `list_records`, `get_record`, `lookup_records` | lesen, filtern, einen Anzeigewert auflösen |
| `create_record`, `update_record` | Zeilen schreiben |
| `delete_record`, `restore_record` | eine Zeile löschen — mit einem dafür angelegten Token — und sie zurückholen |
| `propose_create_table`, `propose_add_field`, `get_proposal` | eine Strukturänderung vorschlagen |
| `propose_update_look` | Farbe und Symbol einer Tabelle und ihrer Optionen vorschlagen |

## Farben und Symbole

Eine Tabelle und jede Option eines Auswahlfelds haben eine Farbe und ein Symbol, wie in der
Oberfläche. Der Agent wählt sie beim Vorschlagen:

- `propose_create_table` akzeptiert `color` und `icon` für die Tabelle;
- `propose_add_field` akzeptiert `color` und `icon` bei jeder Option eines `select` oder
  `multi_select`;
- `propose_update_look` ändert die einer bestehenden Tabelle und ihrer Optionen: Ein weggelassener
  Schlüssel behält den bestehenden Wert, `null` löscht ihn.

`color` ist eine Farbe `#rrggbb`. `icon` ist der Name eines [Lucide](https://lucide.dev/icons/)-Symbols
unter denen, die die Oberfläche zeichnet – `truck`, `circle-check`, `flame` …: Das Schema des
Werkzeugs zählt sie auf, und ein unbekannter Name wird abgelehnt. `describe_base` und
`describe_table` liefern die aktuelle Darstellung. Ein Feld hat kein Symbol zur Auswahl: Die
Oberfläche zeichnet das seines Typs.

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
- **Er ändert die Struktur nicht** – auch nicht ihre Darstellung: Er schlägt sie vor. Der Vorschlag
  wartet unter **Agentenvorschläge…** (Menü der Datenbank), wo eine Person, die die Struktur
  verwaltet, ihn genehmigt oder ablehnt; ohne Entscheidung läuft er nach 24 Stunden ab.
- **Er hat nie mehr Berechtigungen** als die Person, die sein Token angelegt hat: Die Berechtigungen
  des Tokens werden mit ihren abgeglichen, Umgebung für Umgebung.
- Er sieht weder die Felder, die für Agenten als unsichtbar markiert sind, noch die Datenbanken, die
  für MCP gesperrt sind.

Jeder Aufruf wird anhand der Form seiner Parameter protokolliert, nie anhand ihrer Werte.
