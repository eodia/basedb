---
title: Account e accesso
description: Chi può creare un account, e accedere con Google, Microsoft o il single sign-on aziendale.
---

## Primo accesso

Su un’istanza nuova, la prima pagina crea l’**account amministratore**: il tuo nome, il tuo
indirizzo email, la password che preferisci. Crealo prima di rendere l’istanza raggiungibile da
altri — su un dominio, o con una porta pubblicata su tutte le interfacce.

## Creazione di account

Per impostazione predefinita, chiunque raggiunga l’istanza può **creare il proprio account**, e poi i propri
progetti. Non vede nient’altro: i progetti degli altri gli arrivano tramite **invito**.

In **Amministrazione → Utenti**, la scheda «Creazione di account»:

- chiude la creazione di account: solo le persone invitate possono allora crearne uno;
- oppure la riserva a determinati domini — `exemple.fr, autre.fr` ammette solo questi indirizzi.

## Invitare in un progetto o in un database

Chi ha il livello **Gestione** su un progetto o un database lo condivide: menu del progetto (o del
database) → **Condividi…**, un indirizzo, un livello — Lettura, Modifica o Gestione. basedb
genera un **link di invito**, valido 7 giorni, da inviare alla persona come
preferisci: accede, o crea il suo account, aprendolo. La stessa schermata mostra chi ha
accesso, cambia un livello o lo revoca, e conserva i link in sospeso per inviarli di nuovo.

Un gestore non concede mai più di ciò che gestisce: chi gestisce un database lo
condivide, non il suo progetto.

## Accedere con Google, Microsoft…

basedb parla **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Ogni fornitore dichiarato aggiunge un pulsante «Continua con …» alle schermate di
accesso, di creazione dell’account e di invito.

1. Definisci l’indirizzo pubblico di basedb in `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Presso il fornitore, crea un’applicazione web; il suo **URL di reindirizzamento** è
   `https://basedb.example.com/auth/oidc/<nom>/callback`, dove `<nom>` è quello che gli
   assegni qui sotto (`google`, `microsoft`…).

3. Dichiaralo in `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: all’avvio, basedb elenca i fornitori accettati, e indica cosa
   manca a quelli che scarta.

| Variabile, per il fornitore `<NOM>` | Ruolo |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | l’applicazione registrata presso il fornitore |
| `BASEDB_OIDC_<NOM>_ISSUER` | l’emittente; non necessario per `google` e `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | il nome sul pulsante — `Google`, `Microsoft` per impostazione predefinita |
| `BASEDB_OIDC_<NOM>_SCOPES` | `openid email profile` per impostazione predefinita |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: ammette solo gli account esistenti |

Un **primo accesso crea l’account** nella misura in cui la creazione di account lo consente: se è aperta,
lo ammette; se è riservata a determinati domini, solo i loro indirizzi. Un indirizzo già usato da
un account con password non viene mai adottato: chi lo possiede accede con la propria
password. I segreti restano nell’ambiente: nulla ne viene scritto nel database.

:::note
GitHub non è un fornitore OpenID Connect: non può essere usato qui.
:::
