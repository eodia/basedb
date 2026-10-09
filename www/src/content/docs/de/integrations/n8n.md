---
title: n8n
description: Die Zeilen von basedb aus einem n8n-Workflow lesen und schreiben, und einen bei jeder angelegten, geänderten oder gelöschten Zeile starten.
---

Das Paket **n8n-nodes-basedb** fügt n8n drei Nodes hinzu:

| Node | Rolle |
|---|---|
| **basedb** | die Zeilen einer Tabelle lesen und schreiben, eine Zeile kommentieren; von einem KI-Agenten von n8n als Werkzeug nutzbar |
| **basedb Trigger** | einen Workflow für jede seit der letzten Abfrage angelegte — oder angelegte oder geänderte — Zeile starten |
| **basedb Webhook Trigger** | einen Workflow in dem Moment starten, in dem eine Zeile angelegt, geändert oder gelöscht wird |

## Installieren

In n8n: **Settings › Community Nodes › Install**, dann `n8n-nodes-basedb`.

Ohne die Oberfläche — Warteschlangen-Modus, im Voraus eingebundenes Docker-Image — installieren
Sie mit `npm install n8n-nodes-basedb` im Ordner `~/.n8n/nodes` und starten n8n anschließend neu.

## Die Anmeldedaten

Legen Sie in n8n Anmeldedaten **basedb API** an:

| Feld | Wert |
|---|---|
| **Instance URL** | die Adresse, unter der Sie basedb öffnen: `https://basedb.exemple.fr` |
| **Workspace** | die Kennung des Arbeitsbereichs, die der API-Adressen (`/api/v1/<espace>/…`): `t4z56fq`, außer die Instanz legt `BASEDB_TENANT` fest |
| **Token** | ein **Integrationstoken**: Menü **⋯** der Datenbank → **API und Agenten** → **API- und MCP-Token …** |
| **Environment** | optional: die Umgebung der Datenbank, in der gearbeitet wird – `recette`, `production` … Leer: die Produktion |

Ein Token öffnet **eine** Datenbank – alle ihre Umgebungen oder nur eine, wenn es bei seiner
Erstellung beschränkt wurde. Es liest ihre Zeilen, schreibt sie, wenn es mit Schreibrecht angelegt
wurde, und hat nie mehr Berechtigungen als die Person, die es angelegt hat. Beim Speichern testet
n8n die Verbindung und sagt, ob das Token abgelehnt wird.

Um mit der Produktion und mit dem Staging zu arbeiten, legen Sie zwei Anmeldedaten mit demselben
Token an: eines mit leerem **Environment**, das andere mit `recette`. Ohne gewählte Umgebung zeigt die
Liste der Datenbanken des Nodes jede Umgebung, mit ihrem Namen in Klammern.

## Lesen und schreiben: der Node basedb

| Operation | Was sie tut |
|---|---|
| **Row › Create** | legt eine Zeile an |
| **Row › Create or Update** | ändert die Zeile, deren ausgewählte Felder diese Werte tragen, oder legt sie an, wenn keine sie trägt |
| **Row › Get** | liest eine Zeile über ihre `_id` |
| **Row › Get Many** | liest die Zeilen eines Filters, in der gewünschten Reihenfolge, bis zu einer Grenze oder alle, Seite für Seite |
| **Row › Update** | ändert eine Zeile, gefunden über ihre `_id` oder andere Felder |
| **Comment › Create** | kommentiert eine Zeile; eine @-Erwähnung benachrichtigt die Person |

Die **Datenbank** und die **Tabelle** werden aus Listen gewählt — denen, die das Token öffnet.
Die zu schreibenden Felder erscheinen mit ihrem Namen in basedb, eine Einfachauswahl mit ihren
Optionen, ein Feld Person mit den Mitgliedern des Arbeitsbereichs; ein berechnetes Feld — Formel,
Nachschlagefeld, Aggregation, Autonummer — erscheint dort nicht, da basedb es selbst schreibt.
Ein vom Feld abgelehnter Wert stoppt den Node mit dem Code von basedb und seiner Bedeutung.

- Der **Filter** und die **Sortierung** verwenden die technischen Namen der Felder, die des SQL:
  `statut eq "gagne" and montant gte 10000`, `-montant,nom`. Die Grammatik ist die der
  [REST-API](/basedb/de/integrations/api-rest/#lesen).
- **Zahlen** kommen als Dezimaltext an (`"1250.50"`), um keine Ziffer zu verlieren; die Option
  **Numbers as Numbers** wandelt sie in Zahlen um.
- Eine **Verknüpfung** wird als `{ "id": …, "display": … }` gelesen und über die `_id` der
  verknüpften Zeile geschrieben.
- **Create or Update** ändert nie mehrere Zeilen: Tragen mehrere die Werte, stoppt der Node,
  statt zu raten.
- Keine Operation **Delete**: Um Zeilen zu entfernen, markieren Sie sie (einen Status
  „Archivé“), überlassen Sie das Löschen einer
  [Automatisierung](/basedb/de/fonctionnalites/automatisations/), oder rufen Sie die
  [REST-API](/basedb/de/integrations/api-rest/) mit einem zum Löschen angelegten Token auf.

## Einen Workflow starten

### Bei jeder Abfrage: basedb Trigger

Der Node fragt basedb im gewählten Takt (jede Minute, jede Stunde …) nach den seit dem letzten
Mal **angelegten** — oder **angelegten oder geänderten** — Zeilen, bei Bedarf mit einem
zusätzlichen Filter. Er funktioniert überall, auch wenn basedb n8n nicht erreichen kann. Bei
seiner ersten Abfrage merkt er sich den Stand der Tabelle und gibt nichts aus; ein Test aus dem
Editor liefert die letzte Zeile, um die folgenden Nodes verbinden zu können.

### Augenblicklich: basedb Webhook Trigger

Jede angelegte, geänderte oder gelöschte Zeile — auch durch SQL, das direkt in PostgreSQL
geschrieben wird — startet den Workflow sofort:

1. Fügen Sie den Node hinzu und kopieren Sie seine **Production URL**.
2. In basedb, Menü **⋯** der Datenbank → **API und Agenten** → **Webhooks…**: Legen Sie einen
   Webhook zu dieser Adresse an und wählen Sie seine Tabellen und seine Ereignisse.
3. basedb zeigt einmal das **Signatur-Geheimnis**: Tragen Sie es in Anmeldedaten
   **basedb Webhook** von n8n ein.
4. Aktivieren Sie den Workflow.

Jedes Ereignis wird zu einem Element: sein `type` (`record.created`, `record.updated`,
`record.deleted`), die Tabelle, die Zeile **davor** und **danach**, und die geänderten Felder
(`changed`). Der Node prüft die **Signatur** jeder Zustellung und antwortet mit `401` auf eine
ohne, eine mit einer falschen, oder eine, die älter als fünf Minuten ist. basedb liefert
**mindestens einmal**: Entdoppeln Sie über die `id` des Ereignisses, wenn der Workflow es nicht
zweimal verarbeiten soll.

:::note
basedb sendet einen Webhook nur an eine öffentliche **HTTPS**-Adresse: Ein n8n in einem privaten
Netz verwendet stattdessen **basedb Trigger**. Siehe [Webhooks](/basedb/de/integrations/webhooks/).
:::

## Ohne den Node

Der Node **HTTP Request** von n8n spricht ebenfalls mit basedb: Header
`Authorization: Bearer <jeton>`, JSON hin und zurück, Paginierung über `meta.next_cursor`,
übergeben als `after` (`{{ $response.body.meta.next_cursor }}`), und Wiederaufnahme nach einem
Ausfall über einen Filter auf `_updated_at` und über `…/<table>/deleted?since=`.
