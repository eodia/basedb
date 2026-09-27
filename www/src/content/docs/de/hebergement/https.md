---
title: Domain und HTTPS
description: basedb unter einer Domain über HTTPS bereitstellen, hinter dem mitgelieferten Caddy-Proxy.
---

In der Produktion muss basedb über **HTTPS** bereitgestellt werden: Seine Sitzungs-Cookies sind
`Secure` und mit `__Host-` präfixiert, und ein Browser akzeptiert sie über HTTP nur auf `localhost`.

Das Image stellt bereits alles unter einer einzigen Adresse bereit – die Oberfläche, die API unter
`/api`, den MCP-Server unter `/mcp`. Es muss nur noch hinter einen HTTPS-Proxy gestellt werden: Die
`docker-compose.yml` bringt einen mit, **Caddy**, der sein Let’s-Encrypt-Zertifikat selbst bezieht
und erneuert.

## Einrichtung

1. Richten Sie den DNS-Eintrag Ihrer Domain auf den Server; öffnen Sie die Ports 80 und 443.
2. In `.env`:

   ```bash
   BASEDB_DOMAIN=basedb.example.com
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

3. Starten Sie mit dem Profil `https`:

   ```bash
   docker compose --profile https up -d
   ```

Port 3000 bleibt nur auf `127.0.0.1` veröffentlicht: Der gesamte externe Datenverkehr läuft über
Caddy.

## Wozu diese Variablen

- `BASEDB_DOMAIN`: die Domain, für die Caddy das Zertifikat anfordert.
- `BASEDB_PUBLIC_URL`: die Rückleitungsadresse einer OIDC-Anmeldung, Zeichen für Zeichen mit der
  beim Identitätsanbieter registrierten verglichen.
- Caddy setzt `X-Forwarded-For` anhand der tatsächlichen Adresse der besuchenden Person, und basedb
  übernimmt den Header, wenn er aus einem privaten Netz kommt: Die Ratenbegrenzungen der API
  (Anmeldung, freigegebene Formulare) zählen dann pro besuchender Person.

## Ein anderer Proxy

Nginx, Traefik oder ein Load Balancer eignen sich ebenfalls: Leiten Sie **den gesamten** Datenverkehr
der Domain an Port 3000 des Containers weiter, ohne Pufferung der Antworten (der MCP-Server und die
Echtzeitfunktionen streamen ihre Antworten fortlaufend), und stellen Sie sicher, dass der Proxy
`X-Forwarded-For` **ersetzt**, statt ihn zu ergänzen.
