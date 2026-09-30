---
title: Variabili d’ambiente
description: Tutte le variabili lette da basedb, e il loro valore predefinito.
---

Vanno tutte nel file `.env`, accanto a `docker-compose.yml`, che `docker compose`
legge (il modello completo e commentato è `.env.example`). Con `docker run`, passale con `-e`. **Un valore vuoto equivale a «non definito».**

## Obbligatorie

| Variabile | Ruolo |
|---|---|
| `POSTGRES_PASSWORD` | password del container PostgreSQL |
| `BASEDB_ENCRYPTION_KEY` | chiave dell’istanza: firma le sessioni, cifra i segreti. `openssl rand -base64 32`, una volta per tutte |

## Database

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `POSTGRES_USER` | `basedb` | ruolo PostgreSQL |
| `POSTGRES_DB` | `basedb` | database PostgreSQL |
| `POSTGRES_PORT` | `5432` | porta pubblicata su 127.0.0.1 |
| `DATABASE_URL` | il container `db` | un tuo database PostgreSQL 16+ |

## Primo avvio

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | applica il catalogo su un database vuoto |
| `BASEDB_BOOTSTRAP` | `1` | prepara il primo amministratore |
| `BASEDB_TENANT` | `t4z56fq` | riferimento del tenant, negli URL dell’API |
| `BASEDB_ADMIN_EMAIL` | — | indirizzo del primo amministratore, creato all’avvio; se vuoto, lo crea la prima persona che apre l’interfaccia |
| `BASEDB_ADMIN_PASSWORD` | generata, mostrata una volta | con `BASEDB_ADMIN_EMAIL`, la sua password; se definita, viene riapplicata all’amministratore a **ogni** avvio: da rimuovere dopo aver effettuato l’accesso |

## Accesso con Google, Microsoft… (OIDC)

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | i fornitori proposti, separati da virgole: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | l’applicazione registrata presso il fornitore |
| `BASEDB_OIDC_<NOM>_ISSUER` | quello di `google`, `gitlab` | l’emittente OpenID Connect |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | a seconda del fornitore | il nome del pulsante, gli scope richiesti |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: un primo accesso non crea un account |

Vedi [Account e accesso](/basedb/it/hebergement/connexion/).

## Indirizzi

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_PORT` | `3000` | porta pubblicata su 127.0.0.1: l’interfaccia, `/api` e `/mcp` |
| `BASEDB_VERSION` | `latest` | il tag dell’immagine `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | — | indirizzo pubblico di basedb, per il reindirizzamento OIDC |
| `BASEDB_DOMAIN` | — | il dominio servito in HTTPS dal proxy Caddy |
| `BASEDB_ORIGINS` | — | altri siti le cui pagine chiamano l’API dal browser, separati da virgole; non necessario per l’interfaccia di basedb, servita allo stesso indirizzo |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | l’API e MCP visti dal browser; da impostare solo per lo stack di sviluppo (`pnpm start`) |

## File

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | dimensione massima di un file |
| `BASEDB_S3_BUCKET` | — | attiva l’archiviazione S3 |
| `BASEDB_S3_ENDPOINT` | — | endpoint S3 |
| `BASEDB_S3_REGION` | `us-east-1` | regione |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | credenziali |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` per l’indirizzamento basato sull’host |

## Email

Senza un server di invio, basedb non invia alcuna email. Con esso partono le notifiche rimaste
dieci minuti senza essere lette (ognuno sceglie quali in **Impostazioni › Notifiche**), le email
del passaggio **Invia un’email** delle automazioni, e il link di una **password dimenticata**.
I link puntano a `BASEDB_PUBLIC_URL`; senza di essa, un’email non ne porta uno.

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | il server SMTP: quello della tua messaggeria o di un servizio di invio |
| `BASEDB_SMTP_PORT` | `587` | `465` per una connessione cifrata fin da subito |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` sulla porta 465) | `none` solo per un relay sulla stessa macchina: altrimenti la password passerebbe in chiaro |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | l’identificativo dell’account di invio, se ne richiede uno |
| `BASEDB_MAIL_FROM` | — | obbligatoria con `BASEDB_SMTP_HOST`: il mittente, `basedb <no-reply@exemple.fr>` |

All’avvio, il log dice come stanno le cose: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Un’email che il server rifiuta viene ripresa dopo 1, 5, 30, 120
e poi 360 minuti.

## Mappe e indirizzi

La vista **Mappa** posiziona un indirizzo grazie a un servizio di geocodifica: quello di
OpenStreetMap (Nominatim) per impostazione predefinita, interrogato una volta per indirizzo, al
massimo una richiesta al secondo, ogni risposta conservata. Il fondo della mappa è fatto di
**tessere** che il browser di ogni lettore carica direttamente.

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | un altro servizio che parla lo stesso protocollo (un Nominatim tuo); `off`: nessuno, gli indirizzi non lasciano l’istanza e solo la latitudine e la longitudine posizionano le righe |
| `BASEDB_MAP_TILES` | le tessere di OpenStreetMap | un altro server di tessere, modello `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | la dicitura richiesta da questo server, in basso a destra sulla mappa |

All’avvio, il log dice quale servizio è impiegato: `Géocodage : https://nominatim.openstreetmap.org.`

## Documenti PDF

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_PDF_FONTS` | i font Noto dell’immagine | una tua cartella, montata nel container, che contiene `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, e per il cinese, il giapponese e il coreano `NotoSansCJK-Regular.ttc` e `-Bold.ttc` |

## Modelli di database

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | il catalogo del sito pubblico | da dove l’istanza legge i modelli della sua galleria; `off` per non leggerne nessuno (i modelli integrati restano) — vedi [Modelli](/basedb/it/fonctionnalites/modeles/) |

## Intelligenza artificiale

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` o `mistral` |
| `BASEDB_AI_MODEL` | — | il modello |
| `BASEDB_AI_API_KEY` | — | la chiave (altrimenti `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | chiamate interattive per ora e per tenant |
| `BASEDB_AI_FIELD_QUOTA` | `300` | calcoli dei campi IA per ora e per tenant |
| `BASEDB_AI_WORKER` | `1` | `0`: nessun calcolo in background in questo processo |

## Demo pubblica

Un’istanza aperta a tutti, come [demo.basedb.eodia.com](https://demo.basedb.eodia.com): la
schermata di accesso precompila un account condiviso, il visitatore legge tutto e modifica ciò
che esiste, ma non crea né elimina nulla — database, tabella, riga, file, commento, account,
token, link —, e l’IA risponde che non fa parte della demo. La console SQL vi si limita a
leggere. Riportare il database allo stato iniziale ogni notte resta a tuo carico.

| Variabile | Predefinito | Ruolo |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: l’istanza diventa una demo pubblica |
| `BASEDB_DEMO_ACCOUNTS` | — | un account per lingua, separati da virgole: `fr=demo@demo.com,en=demo-en@demo.com`; la schermata di accesso precompila quello della sua lingua, altrimenti l’inglese, altrimenti il primo, e propone gli altri. Crea questi account, ciascuno con il proprio progetto, prima di attivare la demo: rifiuta le creazioni a tutti, amministratore compreso |
| `BASEDB_DEMO_PASSWORD` | — | con `BASEDB_DEMO_ACCOUNTS`, la loro password, la stessa per tutti, pubblicata insieme a loro |

Senza `BASEDB_DEMO_ACCOUNTS`, l’account condiviso è l’amministratore indicato da
`BASEDB_ADMIN_EMAIL` e `BASEDB_ADMIN_PASSWORD`. Un indirizzo della demo accede con la password
pubblicata, qualunque cosa si digiti: tentativi sbagliati non la bloccano per tutti.

## Solo per lo sviluppo

| Variabile | Ruolo |
|---|---|
| `BASEDB_DEV_MAIL=1` | mostra le email nei log invece di inviarle |
| `BASEDB_WEBHOOK_DEV=1` | consente i webhook verso HTTP e gli indirizzi locali |
